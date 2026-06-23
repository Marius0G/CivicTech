// Device-independent proof of the Phase 2 tool bridge.
//
// Runs executeTool() with a MOCK ToolContext where:
//   • injectAndWait actually EXECUTES the injected JS against the real form HTML in jsdom
//     (so we test the exact code the WebView runs, incl. postMessage + requestId),
//   • callServerTool returns canned backend responses,
//   • openForm records the navigation.
// Asserts the router routes/fills/reads correctly.
//
// Needs: jsdom, typescript.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { JSDOM } from 'jsdom';
import ts from 'typescript';

const here = dirname(fileURLToPath(import.meta.url));
const b64 = (s) => Buffer.from(s).toString('base64');
const tx = (src) =>
  ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2019 },
  }).outputText;

// Transpile injection.ts + countryOptions.ts, then tools.ts with its relative imports rewired.
const injUrl = 'data:text/javascript;base64,' +
  b64(tx(readFileSync(join(here, 'src', 'injection.ts'), 'utf8')));
const coUrl = 'data:text/javascript;base64,' +
  b64(tx(readFileSync(join(here, 'src', 'countryOptions.ts'), 'utf8')));
let toolsJs = tx(readFileSync(join(here, 'src', 'tools.ts'), 'utf8'));
toolsJs = toolsJs.replace(/['"]\.\/injection['"]/g, JSON.stringify(injUrl));
toolsJs = toolsJs.replace(/['"]\.\/countryOptions['"]/g, JSON.stringify(coUrl));
const tools = await import('data:text/javascript;base64,' + b64(toolsJs));
const { executeTool, TOOL_DEFS, ESC_ELIGIBILITY_URL } = tools;

const html = readFileSync(
  join(here, '..', 'spike-webview-autopilot', 'fixtures', 'eligibility.html'),
  'utf8'
);

// --- mock ToolContext ---
const serverCalls = [];
let openedUrl = null;
let rid = 0;
const ctx = {
  backendUrl: 'http://mock',
  newRequestId: () => `r${++rid}`,
  openForm: async (url) => { openedUrl = url; },
  // Execute the injected JS for real against the page HTML.
  injectAndWait: async (js, requestId) => {
    const dom = new JSDOM(html, { runScripts: 'dangerously' });
    const win = dom.window;
    let captured = null;
    win.ReactNativeWebView = { postMessage: (s) => { captured = JSON.parse(s); } };
    win.eval(js);
    if (!captured) throw new Error('injected script posted nothing');
    if (captured.requestId !== requestId) throw new Error('requestId mismatch');
    return captured;
  },
  callServerTool: async (name, args) => {
    serverCalls.push(name);
    if (name === 'get_profile')
      return { profile: { name: 'Maria', country: 'RO', birthdate: '2006-05-14', nationality: 'Romanian' } };
    if (name === 'search_eu_info') return { stub: true, query: args.query, results: [] };
    return { ok: true };
  },
};

const checks = [];
const check = (label, cond) => checks.push([label, !!cond]);

// 1) tool defs
check('6 tools defined', TOOL_DEFS.length === 6);
check('tool names correct',
  ['open_form', 'fill_form', 'read_page', 'get_profile', 'search_eu_info', 'web_search']
    .every((n) => TOOL_DEFS.some((t) => t.name === n)));

// 2) open_form (client) -> navigates
const openOut = JSON.parse(await executeTool('open_form', { url: ESC_ELIGIBILITY_URL }, ctx));
check('open_form returns ok', openOut.ok === true);
check('open_form navigated WebView', openedUrl === ESC_ELIGIBILITY_URL);

// 3) read_page (client) -> reads real DOM
const readOut = JSON.parse(await executeTool('read_page', {}, ctx));
check('read_page sees country field', readOut.hasCountry === true);
check('read_page sees birthdate field', readOut.hasBirthdate === true);
check('read_page found many country options', readOut.countryOptionCount > 200);

// 4) fill_form with a country NAME from the model -> resolved to its code and filled.
serverCalls.length = 0;
const fillOut = JSON.parse(await executeTool('fill_form', { country: 'France', birthdate: '2005-01-01' }, ctx));
check('fill_form ok with model-supplied data', fillOut.ok === true);
check('fill_form resolved "France" -> FR', fillOut.countryLabel === 'France');
check('fill_form with full args skips get_profile', !serverCalls.includes('get_profile'));

// 5) fill_form with no args -> pulls saved profile (RO/Romania).
serverCalls.length = 0;
const fillOut2 = JSON.parse(await executeTool('fill_form', {}, ctx));
check('fill_form ok without args', fillOut2.ok === true);
check('fill_form resolved Romania from profile', fillOut2.countryLabel === 'Romania');
check('fill_form without args calls get_profile', serverCalls.includes('get_profile'));

// 6) server tools route to backend
const profOut = JSON.parse(await executeTool('get_profile', {}, ctx));
check('get_profile routed to server', profOut.profile?.country === 'RO');
const searchOut = JSON.parse(await executeTool('search_eu_info', { query: 'erasmus' }, ctx));
check('search_eu_info routed to server', searchOut.stub === true && searchOut.query === 'erasmus');

let allPass = true;
console.log('\n  Phase 2 tool-bridge proof\n');
for (const [label, pass] of checks) {
  console.log(`   ${pass ? '✅' : '❌'}  ${label}`);
  if (!pass) allPass = false;
}
console.log('');
if (!allPass) { console.error('  ❌ Phase 2 proof FAILED\n'); process.exit(1); }
console.log('  ✅ Phase 2 proof PASSED — tools route correctly; WebView fill/read run against the real form.\n');
