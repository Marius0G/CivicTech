// Tool definitions + executor/router for the Realtime model.
//
// Definitions are sent to the model via session.update on connect. When the model calls a
// tool, executeTool() routes it:
//   • client tools (open_form, fill_form, read_page) -> WebView (via ctx)
//   • server tools (get_profile, search_eu_info, web_search) -> POST {backendUrl}/tools/{name}
// and returns a string that the app feeds back as the function_call_output.

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
      "Fill the currently open eligibility form with the user's country and date of birth. If you don't have them, call get_profile first.",
    parameters: {
      type: 'object',
      properties: {
        country: { type: 'string', description: 'Country option value, e.g. "RO" for Romania.' },
        birthdate: { type: 'string', description: 'Date of birth as yyyy-mm-dd.' },
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
    description: "Get the user's saved details (name, country, date of birth, nationality).",
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
      // Use what the model supplied; fall back to the saved profile for anything missing.
      // Resolve the country to the exact Drupal <option> code (the model usually says a name).
      let country: string = args.country;
      let birthdate: string = args.birthdate;
      if (!country || !birthdate) {
        const p = await ctx.callServerTool('get_profile', {});
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
    case 'web_search': {
      const result = await ctx.callServerTool(name, args);
      return JSON.stringify(result);
    }
    default:
      return JSON.stringify({ error: `unknown tool ${name}` });
  }
}
