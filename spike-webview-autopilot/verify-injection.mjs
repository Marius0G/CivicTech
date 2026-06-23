// Device-independent proof of the Phase 0 load-bearing trick.
//
// Loads the REAL eligibility page HTML (fixtures/eligibility.html) into jsdom and runs the
// SAME `fillEligibilityForm` function the WebView injects — asserting both fields get set.
// This de-risks selectors + fill logic without a phone.
//
//   node verify-injection.mjs          (uses the saved fixture; offline)
//
// Requires: jsdom, typescript (dev deps).

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { JSDOM } from 'jsdom';
import ts from 'typescript';

const here = dirname(fileURLToPath(import.meta.url));

// 1) Transpile injection.ts -> JS and import it, so the test uses the real source (single
//    source of truth: the same function string is what gets injected into the WebView).
const tsSource = readFileSync(join(here, 'src', 'injection.ts'), 'utf8');
const js = ts.transpileModule(tsSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2019 },
}).outputText;
const mod = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));
const { fillEligibilityForm, buildInjectedJavaScript } = mod;

// 2) Load the real page into a DOM.
const html = readFileSync(join(here, 'fixtures', 'eligibility.html'), 'utf8');
const dom = new JSDOM(html);
const doc = dom.window.document;
// jsdom needs Event on the function's global; fillEligibilityForm uses `new Event(...)`.
globalThis.Event = dom.window.Event;

// 3) Run the exact fill the app will run.
const profile = { country: 'RO', birthdate: '2006-05-14' };
const result = fillEligibilityForm(doc, profile);

// 4) Assert.
const checks = [
  ['country <select> found & set', result.countrySet],
  ['country resolved to Romania', result.countryLabel === 'Romania'],
  ['birthdate <input> found & set', result.birthdateSet],
  ['DOM value of country is "RO"', doc.querySelector('#edit-address-country').value === 'RO'],
  ['DOM value of birthdate is set', doc.querySelector('#edit-birthdate').value === '2006-05-14'],
  ['no errors reported', result.errors.length === 0],
];

let allPass = true;
console.log('\n  Phase 0 injection proof — ESC eligibility form\n');
for (const [label, pass] of checks) {
  console.log(`   ${pass ? '✅' : '❌'}  ${label}`);
  if (!pass) allPass = false;
}
console.log('\n  result:', JSON.stringify(result));

// 5) Show the actual injected payload (truncated) so you can see what hits the WebView.
const payload = buildInjectedJavaScript(profile);
console.log('\n  injected payload (' + payload.length + ' chars), head:\n   ' + payload.slice(0, 120) + '…\n');

if (!allPass) {
  console.error('  ❌ Phase 0 proof FAILED\n');
  process.exit(1);
}
console.log('  ✅ Phase 0 proof PASSED — the autopilot fill works against the real form.\n');
