"""Crawl the official EU youth portals into the Chroma vector DB (Phase 4, bulk ingest).

Why crawl (not an API): there is no public content API for the European Youth Portal / Erasmus+
program pages — the prose we need (what each programme is, eligibility, rights, how to apply)
lives only as HTML. The portals are Drupal sites with permissive robots and no sitemaps, so we
do a polite breadth-first crawl from a few hub pages, staying on-topic and English-only.

Language handling (discovered by inspection):
  • youth.europa.eu        — English pages END WITH `_en`; other langs use `_bg`, `_cs`, …
  • erasmus-plus.ec…       — English is the DEFAULT (no suffix); other langs are `/bg/…` prefixes
  • europa.eu/youreurope   — English default; scoped to the citizens' rights section only
So we DROP any url whose last path segment ends `_<lang>` (lang≠en) or whose first segment is a
non-en language code. That keeps English + language-neutral pages and avoids 24× duplicates.

Usage:
  .venv/Scripts/python.exe crawl_eu.py                 # default plan (all sources)
  .venv/Scripts/python.exe crawl_eu.py --max 200       # cap pages
  .venv/Scripts/python.exe crawl_eu.py --dry-run       # discover URLs, don't embed/store

Needs OPENAI_API_KEY (embeddings). Network required. Re-running is safe (upsert by URL).
"""

import argparse
import asyncio
import sys
from collections import deque
from urllib.parse import urldefrag, urljoin, urlparse, urlsplit, urlunsplit

import httpx
from bs4 import BeautifulSoup

from app.config import get_settings
from app.rag import add_documents
from scrape_eu import chunk_text, extract_text, _doc_id

# Language codes to DROP (English is kept). The 24 official EU languages plus the EEA /
# candidate-country languages the European Youth Portal also serves (Icelandic, Norwegian,
# Macedonian, Serbian, Turkish, Albanian, Bosnian, Ukrainian, …).
EU_LANGS = {
    # EU official (minus en)
    "bg", "cs", "da", "de", "et", "el", "es", "fr", "ga", "hr", "it", "lv",
    "lt", "hu", "mt", "nl", "pl", "pt", "ro", "sk", "sl", "fi", "sv",
    # EEA / enlargement / neighbourhood languages used on the portals
    "is", "no", "nb", "nn", "mk", "sr", "tr", "sq", "bs", "me", "uk", "ka", "hy", "az",
}

# Seed hub pages + which host/path-prefixes each crawl is allowed to wander into.
# (prefix "" = anywhere on the host.)
PLAN = [
    # European Youth Portal — the whole site is youth-focused, let it roam.
    {"seeds": [
        "https://youth.europa.eu/home_en",
        "https://youth.europa.eu/solidarity_en",
        "https://youth.europa.eu/go-abroad_en",
        "https://youth.europa.eu/go-abroad/studying_en",
        "https://youth.europa.eu/go-abroad/working_en",
        "https://youth.europa.eu/go-abroad/volunteering_en",
        "https://youth.europa.eu/go-abroad/traineeships_en",
        "https://youth.europa.eu/get-involved_en",
        "https://youth.europa.eu/discovereu_en",
        "https://youth.europa.eu/eu-initiatives_en",
        "https://youth.europa.eu/year-of-youth_en",
    ], "host": "youth.europa.eu", "prefixes": [""]},
    # Erasmus+ — entire site is on-topic.
    {"seeds": [
        "https://erasmus-plus.ec.europa.eu/",
        "https://erasmus-plus.ec.europa.eu/opportunities",
        "https://erasmus-plus.ec.europa.eu/opportunities/individuals",
        "https://erasmus-plus.ec.europa.eu/about-erasmus",
    ], "host": "erasmus-plus.ec.europa.eu", "prefixes": [""]},
    # Your Europe — citizens' rights (europa.eu root is huge, so scope tightly).
    {"seeds": [
        "https://europa.eu/youreurope/citizens/index_en.htm",
        "https://europa.eu/youreurope/citizens/residence/index_en.htm",
        "https://europa.eu/youreurope/citizens/work/index_en.htm",
        "https://europa.eu/youreurope/citizens/education/index_en.htm",
        "https://europa.eu/youreurope/citizens/health/index_en.htm",
        "https://europa.eu/youreurope/citizens/travel/index_en.htm",
        "https://europa.eu/youreurope/citizens/consumers/index_en.htm",
        "https://europa.eu/youreurope/citizens/vehicles/index_en.htm",
        "https://europa.eu/youreurope/citizens/family/index_en.htm",
    ], "host": "europa.eu", "prefixes": ["/youreurope/citizens"]},
    # EU Careers / EPSO — jobs & traineeships across EU institutions. English = /en/ segment.
    {"seeds": [
        "https://eu-careers.europa.eu/en",
        "https://eu-careers.europa.eu/en/job-opportunities",
        "https://eu-careers.europa.eu/en/job-opportunities/traineeships",
        "https://eu-careers.europa.eu/en/eu-careers/why-an-eu-career",
        "https://eu-careers.europa.eu/en/about-epso",
    ], "host": "eu-careers.europa.eu", "prefixes": ["/en"]},
    # Europass — CVs, skills, careers. English = /en/ segment. (/en/find-jobs is a JS shell.)
    {"seeds": [
        "https://europass.europa.eu/en",
        "https://europass.europa.eu/en/europass-tools",
        "https://europass.europa.eu/en/work-europe",
        "https://europass.europa.eu/en/work-europe/plan-your-career",
        "https://europass.europa.eu/en/europass-employment-and-recruitment",
    ], "host": "europass.europa.eu", "prefixes": ["/en"]},
    # EURES — working abroad & job mobility. English = _en suffix. (Live vacancy search is JS.)
    {"seeds": [
        "https://eures.europa.eu/index_en",
        "https://eures.europa.eu/jobseekers_en",
        "https://eures.europa.eu/living-and-working/living-and-working-conditions_en",
        "https://eures.europa.eu/jobseekers/hints-and-tips-jobseekers_en",
        "https://eures.europa.eu/eures-services_en",
    ], "host": "eures.europa.eu", "prefixes": [""]},
    # European Education Area — study opportunities, recognition. English = bare path (no code).
    {"seeds": [
        "https://education.ec.europa.eu/",
        "https://education.ec.europa.eu/focus-topics",
        "https://education.ec.europa.eu/education-levels",
    ], "host": "education.ec.europa.eu", "prefixes": [""]},
    # Blue Book Traineeship — flagship paid Commission traineeship. English = _en suffix.
    {"seeds": [
        "https://traineeships.ec.europa.eu/index_en",
        "https://traineeships.ec.europa.eu/who-can-apply_en",
        "https://traineeships.ec.europa.eu/administrative-traineeship/blue-book-admin_en",
    ], "host": "traineeships.ec.europa.eu", "prefixes": [""]},
    # The EU official portal — "what the EU does", rights, live-work-study. English = _en suffix.
    {"seeds": [
        "https://european-union.europa.eu/index_en",
        "https://european-union.europa.eu/principles-countries-history_en",
        "https://european-union.europa.eu/institutions-law-budget_en",
        "https://european-union.europa.eu/priorities-and-actions/actions-topic_en",
        "https://european-union.europa.eu/live-work-study_en",
        "https://european-union.europa.eu/easy-read_en",
    ], "host": "european-union.europa.eu", "prefixes": [""]},
    # Digital Skills and Jobs Platform — upskilling & digital careers. English = /en prefix.
    {"seeds": [
        "https://digital-skills-jobs.europa.eu/en",
        "https://digital-skills-jobs.europa.eu/en/inspiration",
        "https://digital-skills-jobs.europa.eu/en/training",
    ], "host": "digital-skills-jobs.europa.eu", "prefixes": ["/en"]},
    # ALMA — supervised work-mobility for disadvantaged young NEETs. Narrow prefix (host is huge).
    {"seeds": [
        "https://employment-social-affairs.ec.europa.eu/policies-and-activities/skills-and-qualifications/alma-active-inclusion-initiative-young-people_en",
    ], "host": "employment-social-affairs.ec.europa.eu",
     "prefixes": ["/policies-and-activities/skills-and-qualifications"]},
    # EU citizenship & fundamental rights (commission.europa.eu is huge — scope tightly).
    {"seeds": [
        "https://commission.europa.eu/strategy-and-policy/policies/justice-and-fundamental-rights/democracy-eu-citizenship-anti-corruption/eu-citizenship_en",
        "https://commission.europa.eu/aid-development-cooperation-fundamental-rights/your-fundamental-rights-eu/know-your-rights/citizens-rights_en",
    ], "host": "commission.europa.eu", "prefixes": [
        "/strategy-and-policy/policies/justice-and-fundamental-rights",
        "/aid-development-cooperation-fundamental-rights/your-fundamental-rights-eu",
    ]},
]

SKIP_EXT = (
    ".pdf", ".jpg", ".jpeg", ".png", ".gif", ".svg", ".webp", ".css", ".js",
    ".zip", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".mp4", ".mp3", ".ics",
)
SKIP_SUBSTR = ("/sites/", "/themes/", "/profiles/", "/core/", "/admin/", "/user/",
               "/search", "/media/oembed", "/node/add", "/comment/")

MIN_TEXT_CHARS = 250  # skip near-empty pages (nav-only shells)
EMBED_BATCH = 100     # docs per embed+upsert call


def is_english(path: str) -> bool:
    """Reject non-English language variants (keeps `_en` and language-neutral defaults)."""
    segs = [s for s in path.split("/") if s]
    if not segs:
        return True
    # /bg/... or /pt-pt/... style locale prefix (take the base before any '-').
    first_base = segs[0].lower().split("-")[0]
    if first_base in EU_LANGS:
        return False
    last = segs[-1]
    stem = last.rsplit(".", 1)[0]  # strip .htm etc.
    tail = stem.rsplit("_", 1)[-1].lower()
    if tail in EU_LANGS and tail != "en":  # foo_bg style
        return False
    return True


def allowed(url: str, host: str, prefixes: list[str]) -> bool:
    p = urlparse(url)
    if p.scheme not in ("http", "https") or p.netloc != host:
        return False
    path = p.path.lower()
    if any(path.endswith(e) for e in SKIP_EXT):
        return False
    if any(s in path for s in SKIP_SUBSTR):
        return False
    if not any(p.path.startswith(pref) for pref in prefixes):
        return False
    return is_english(p.path)


def normalize(url: str) -> str:
    """Drop fragment AND query (these portals are path-routed; query is mostly tracking)."""
    u, _ = urldefrag(url)
    s = urlsplit(u)
    return urlunsplit((s.scheme, s.netloc, s.path, "", ""))


def extract_links(base_url: str, html: str) -> list[str]:
    soup = BeautifulSoup(html, "html.parser")
    out = []
    for a in soup.find_all("a", href=True):
        out.append(normalize(urljoin(base_url, a["href"])))
    return out


async def fetch(client: httpx.AsyncClient, url: str) -> str | None:
    """GET a page, retrying transient network errors (DNS/timeout) a few times."""
    for attempt in range(3):
        try:
            r = await client.get(url, timeout=25.0, follow_redirects=True)
        except httpx.HTTPError:
            await asyncio.sleep(1 + attempt)  # transient blip — back off and retry
            continue
        if r.status_code != 200:
            return None
        if "text/html" not in r.headers.get("content-type", ""):
            return None
        return r.text
    return None


async def crawl_source(client, src, max_pages, sem) -> list[dict]:
    """BFS one source; return collected {id,title,url,text} chunk-docs."""
    host, prefixes = src["host"], src["prefixes"]
    seen: set[str] = set()
    queue: deque[str] = deque()
    for s in src["seeds"]:
        if s not in seen:
            seen.add(s)
            queue.append(s)
    docs: list[dict] = []
    pages = 0

    while queue and pages < max_pages:
        url = queue.popleft()
        async with sem:
            html = await fetch(client, url)
        if not html:
            continue
        title, text = extract_text(html)
        if len(text) >= MIN_TEXT_CHARS:
            pages += 1
            for i, ch in enumerate(chunk_text(text)):
                docs.append({"id": _doc_id(url, i), "title": title or url, "url": url, "text": ch})
            print(f"  [{host}] {pages:>3}/{max_pages}  {url}")
        for link in extract_links(url, html):
            if link not in seen and allowed(link, host, prefixes):
                seen.add(link)
                queue.append(link)
    return docs


async def main(max_pages: int, dry_run: bool) -> None:
    settings = get_settings()
    if not settings.has_key and not dry_run:
        print("ERROR: OPENAI_API_KEY not set (needed for embeddings).", file=sys.stderr)
        sys.exit(1)

    sem = asyncio.Semaphore(5)  # polite concurrency
    all_docs: list[dict] = []
    async with httpx.AsyncClient(headers={"User-Agent": "EUYouthBuddy/0.1 (hackathon; contact: demo)"}) as client:
        for src in PLAN:
            print(f"\n=== crawling {src['host']} (cap {max_pages} pages) ===")
            docs = await crawl_source(client, src, max_pages, sem)
            print(f"  -> {len(docs)} chunks from {src['host']}")
            all_docs.extend(docs)

    print(f"\nCollected {len(all_docs)} chunks total from {len(PLAN)} sources.")
    if dry_run:
        print("(dry run — nothing embedded/stored)")
        return

    total = 0
    for i in range(0, len(all_docs), EMBED_BATCH):
        batch = all_docs[i : i + EMBED_BATCH]
        total += await add_documents(settings, batch)
        print(f"  embedded+upserted {total}/{len(all_docs)}")
    print(f"\nDone. Ingested {total} chunks into the Chroma DB (.chroma/).")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--max", type=int, default=150, help="max content pages per source")
    ap.add_argument("--dry-run", action="store_true", help="discover URLs only; no embedding/storage")
    a = ap.parse_args()
    asyncio.run(main(a.max, a.dry_run))
