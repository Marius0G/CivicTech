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
            "Fill the currently open eligibility form with the user's country and date of birth. "
            "If you don't have them, call get_profile first (or just call fill_form with no "
            "arguments and it will use the saved profile)."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "country": {"type": "string", "description": 'Country option value, e.g. "RO".'},
                "birthdate": {"type": "string", "description": "Date of birth as yyyy-mm-dd."},
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
        "description": "Get the user's saved details (name, country, date of birth, nationality).",
        "parameters": {"type": "object", "properties": {}},
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
