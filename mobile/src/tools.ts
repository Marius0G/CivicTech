// Tool definitions + executor/router for the Realtime model.
//
// Definitions are sent to the model via session.update on connect. When the model calls a
// tool, executeTool() routes it:
//   • client tools (open_form, fill_form, read_page) -> WebView (via ctx)
//   • server tools (get_profile, search_eu_info, web_search) -> POST {backendUrl}/tools/{name}
// and returns a string that the app feeds back as the function_call_output.
//
// EU data residency: fill_form reads the saved values from the INTERNAL /tools/fill_values
// endpoint (not advertised to the model) and injects them straight into the WebView. Those
// values are never returned to the model — get_profile only ever exposes field NAMES.

import { EligibilityProfile, buildInjectedJavaScript, buildReadPageJavaScript } from './injection';
import { COUNTRY_OPTIONS } from './countryOptions';

// Map a country the model said (a code like "RO" OR a name like "Romania"/"france") to the
// exact Drupal <option> value. The model usually says the name; the form needs the code.
const NAME_TO_CODE: Record<string, string> = Object.entries(COUNTRY_OPTIONS).reduce(
  (acc, [code, label]) => {
    acc[label.toLowerCase()] = code;
    return acc;
  },
  {} as Record<string, string>
);

function resolveCountryCode(input: string): string {
  if (!input) return input;
  if (COUNTRY_OPTIONS[input]) return input; // already a valid code, e.g. "RO"
  const byName = NAME_TO_CODE[String(input).toLowerCase().trim()];
  return byName || input; // fall back to raw (fill will report a clear error if invalid)
}

// ---- Tool schemas advertised to the Realtime model ----
export const TOOL_DEFS = [
  {
    type: 'function',
    name: 'open_form',
    description:
      'Open an official EU web form in the in-app browser so it can be filled. Use the European Solidarity Corps eligibility form when the user wants to sign up.',
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'The form URL to open.' },
      },
      required: ['url'],
    },
  },
  {
    type: 'function',
    name: 'fill_form',
    description:
      "Fill the currently open form from the user's saved details. Call it with no arguments — the app reads the saved values on-device and inserts them; you do NOT see the values. Only pass an argument to override a field the user just told you out loud.",
    parameters: {
      type: 'object',
      properties: {
        country: { type: 'string', description: 'Optional override, e.g. "RO" for Romania.' },
        birthdate: { type: 'string', description: 'Optional override as yyyy-mm-dd.' },
      },
      required: [],
    },
  },
  {
    type: 'function',
    name: 'read_page',
    description:
      'Inspect the open form: which fields exist, current values, and valid country option codes.',
    parameters: { type: 'object', properties: {} },
  },
  {
    type: 'function',
    name: 'get_profile',
    description:
      "Check WHICH of the user's details are on file (returns field names only, never the values — they stay private in the EU). To fill a form, call fill_form; it uses the saved values directly without showing them to you.",
    parameters: { type: 'object', properties: {} },
  },
  {
    type: 'function',
    name: 'search_eu_info',
    description: 'Search indexed official EU sources for youth programmes, rights and funding.',
    parameters: {
      type: 'object',
      properties: { query: { type: 'string' } },
      required: ['query'],
    },
  },
  {
    type: 'function',
    name: 'web_search',
    description: 'Search the live web (official europa.eu domains) for up-to-date EU information.',
    parameters: {
      type: 'object',
      properties: { query: { type: 'string' } },
      required: ['query'],
    },
  },
  {
    type: 'function',
    name: 'save_preference',
    description:
      "Remember a light, NON-sensitive preference the user mentions (e.g. key='climate', value='warm'). Never store sensitive personal data (ID, address) this way.",
    parameters: {
      type: 'object',
      properties: {
        key: { type: 'string', description: "Short preference name, e.g. 'climate'." },
        value: { type: 'string', description: "Short value, e.g. 'warm'." },
      },
      required: ['key', 'value'],
    },
  },
] as const;

export const CLIENT_TOOLS = new Set(['open_form', 'fill_form', 'read_page']);

// The default form the buddy signs people up on.
export const ESC_ELIGIBILITY_URL = 'https://youth.europa.eu/solidarity/register/check_en';

/** Everything executeTool needs from the app, so the router itself stays testable. */
export interface ToolContext {
  backendUrl: string;
  newRequestId: () => string;
  /** Navigate the WebView; resolves once navigation is requested. */
  openForm: (url: string) => Promise<void>;
  /** Inject JS and resolve with the postMessage payload matching requestId. */
  injectAndWait: (js: string, requestId: string) => Promise<any>;
  /** POST {backendUrl}/tools/{name} with args; resolve parsed JSON. */
  callServerTool: (name: string, args: any) => Promise<any>;
}

/** Execute one tool call and return the string output to hand back to the model. */
export async function executeTool(name: string, args: any, ctx: ToolContext): Promise<string> {
  args = args || {};
  switch (name) {
    case 'open_form': {
      const url = args.url || ESC_ELIGIBILITY_URL;
      await ctx.openForm(url);
      return JSON.stringify({ ok: true, opened: url });
    }
    case 'read_page': {
      const id = ctx.newRequestId();
      const msg = await ctx.injectAndWait(buildReadPageJavaScript(id), id);
      return JSON.stringify(msg.result ?? { error: msg.error ?? 'no result' });
    }
    case 'fill_form': {
      // EU data residency: read the saved values from the INTERNAL fill_values endpoint (not a
      // model tool — the LLM never sees this) and inject them directly. The model may pass an
      // override for a field the user said out loud; otherwise everything comes from the vault.
      let country: string = args.country;
      let birthdate: string = args.birthdate;
      if (!country || !birthdate) {
        const p = await ctx.callServerTool('fill_values', {});
        country = country || p.profile.country;
        birthdate = birthdate || p.profile.birthdate;
      }
      const profile: EligibilityProfile = { country: resolveCountryCode(country), birthdate };
      const id = ctx.newRequestId();
      const msg = await ctx.injectAndWait(buildInjectedJavaScript(profile, id), id);
      return JSON.stringify(msg.result ?? { error: msg.error ?? 'no result' });
    }
    case 'get_profile':
    case 'search_eu_info':
    case 'web_search':
    case 'save_preference': {
      const result = await ctx.callServerTool(name, args);
      return JSON.stringify(result);
    }
    default:
      return JSON.stringify({ error: `unknown tool ${name}` });
  }
}
