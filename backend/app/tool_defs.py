"""Tool schemas advertised to the Realtime model, registered SERVER-SIDE at session
creation (more reliable than a client session.update). Mirrors mobile/src/tools.ts.

The client still EXECUTES these (client tools via the WebView, server tools via /tools/*);
this only tells the model the tools exist and their argument shapes.
"""

TOOL_DEFS = [
    {
        "type": "function",
        "name": "open_form",
        "description": (
            "Open an official EU web form in the in-app browser so it can be filled. "
            "Use the European Solidarity Corps eligibility form when the user wants to sign up. "
            "Default URL: https://youth.europa.eu/solidarity/register/check_en"
        ),
        "parameters": {
            "type": "object",
            "properties": {"url": {"type": "string", "description": "The form URL to open."}},
            "required": ["url"],
        },
    },
    {
        "type": "function",
        "name": "fill_form",
        "description": (
            "Fill the currently open form from the user's saved details. Just call it with no "
            "arguments — the app reads the saved values on-device and inserts them; you do NOT "
            "see or need the values. Only pass an argument to override a field the user just told "
            "you out loud."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "country": {"type": "string", "description": 'Optional override, e.g. "RO".'},
                "birthdate": {"type": "string", "description": "Optional override, yyyy-mm-dd."},
            },
            "required": [],
        },
    },
    {
        "type": "function",
        "name": "read_page",
        "description": "Inspect the open form: which fields exist, current values, valid country codes.",
        "parameters": {"type": "object", "properties": {}},
    },
    {
        "type": "function",
        "name": "get_profile",
        "description": (
            "Check WHICH of the user's details are on file (e.g. is a date of birth saved?). "
            "Returns field names only — never the values, which stay private in the EU. To fill "
            "a form, call fill_form; it uses the saved values directly without showing them to you."
        ),
        "parameters": {"type": "object", "properties": {}},
    },
    {
        "type": "function",
        "name": "save_preference",
        "description": (
            "Remember a light, NON-sensitive preference the user mentions (e.g. key='climate', "
            "value='warm'). Never store sensitive personal data (ID, address) this way."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "key": {"type": "string", "description": "Short preference name, e.g. 'climate'."},
                "value": {"type": "string", "description": "Short value, e.g. 'warm'."},
            },
            "required": ["key", "value"],
        },
    },
    {
        "type": "function",
        "name": "search_eu_info",
        "description": "Search indexed official EU sources for youth programmes, rights and funding.",
        "parameters": {
            "type": "object",
            "properties": {"query": {"type": "string"}},
            "required": ["query"],
        },
    },
    {
        "type": "function",
        "name": "web_search",
        "description": "Search the live web (official europa.eu domains) for up-to-date EU info.",
        "parameters": {
            "type": "object",
            "properties": {"query": {"type": "string"}},
            "required": ["query"],
        },
    },
]
