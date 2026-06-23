"""Curated EU-youth knowledge corpus for the RAG tool (Phase 4).

Hand-written from official sources (European Youth Portal, Erasmus+, European Solidarity
Corps, DiscoverEU). Shipped with the app so `search_eu_info` works at demo time WITHOUT live
scraping — the demo-day-robust choice. Each chunk carries its source URL so the frog can cite.

Keep chunks short and self-contained (one fact / topic each) — that's what RAG retrieves well.
"""

from typing import TypedDict


class Chunk(TypedDict):
    id: str
    title: str
    url: str
    text: str


CORPUS: list[Chunk] = [
    {
        "id": "esc-what",
        "title": "What is the European Solidarity Corps",
        "url": "https://youth.europa.eu/solidarity_en",
        "text": (
            "The European Solidarity Corps is an EU programme that funds young people to do "
            "volunteering, traineeships or jobs on solidarity projects across Europe and "
            "beyond. Activities cover the environment, social inclusion, health, education "
            "and helping communities. The EU covers travel, accommodation and a living "
            "allowance, so taking part is essentially free for the volunteer."
        ),
    },
    {
        "id": "esc-eligibility",
        "title": "European Solidarity Corps eligibility (age and residence)",
        "url": "https://youth.europa.eu/solidarity/young-people/register_en",
        "text": (
            "To join the European Solidarity Corps you must be between 18 and 30 years old "
            "to START an activity (you can register from age 17). You need to be a legal "
            "resident of an EU member state or a partner country. After registering you "
            "create a profile and organisations can invite you to projects."
        ),
    },
    {
        "id": "esc-register",
        "title": "How to register for the European Solidarity Corps",
        "url": "https://youth.europa.eu/solidarity/register/check_en",
        "text": (
            "Registration starts with a short eligibility check where you enter your country "
            "of residence and your date of birth. If you qualify, you log in with an EU Login "
            "account and complete your Solidarity Corps profile: interests, skills, languages "
            "and the kinds of projects you want. Then you can apply to placements."
        ),
    },
    {
        "id": "erasmus-what",
        "title": "What is Erasmus+",
        "url": "https://erasmus-plus.ec.europa.eu/",
        "text": (
            "Erasmus+ is the EU programme for education, training, youth and sport. For young "
            "people it funds studying or training abroad, youth exchanges, and volunteering. "
            "It is open to students, apprentices, young people and youth workers. Grants help "
            "cover travel and living costs while you are abroad."
        ),
    },
    {
        "id": "erasmus-students",
        "title": "Erasmus+ for higher-education students",
        "url": "https://erasmus-plus.ec.europa.eu/opportunities/individuals/students",
        "text": (
            "University students can spend a study period of 2 to 12 months abroad at a "
            "partner university, or do a traineeship abroad, with an Erasmus+ grant. You "
            "apply through your home university's international office, not directly to the "
            "EU. Your time abroad is recognised towards your degree via learning agreements."
        ),
    },
    {
        "id": "erasmus-exchanges",
        "title": "Erasmus+ youth exchanges",
        "url": "https://youth.europa.eu/go-abroad/volunteering/youth-exchanges_en",
        "text": (
            "Youth exchanges let groups of young people aged 13 to 30 from different countries "
            "meet for a short project (usually 5 to 21 days) around a shared theme. They are "
            "organised by youth groups or NGOs, not schools. Travel and board are funded by "
            "Erasmus+, so participants pay little or nothing."
        ),
    },
    {
        "id": "discovereu-what",
        "title": "DiscoverEU free travel passes",
        "url": "https://youth.europa.eu/discovereu_en",
        "text": (
            "DiscoverEU gives 18-year-olds a free travel pass (mostly by rail) to explore "
            "Europe for up to 30 days. The EU runs application rounds where you answer a short "
            "quiz; passes are allocated based on quota. You must be 18 at the time of the "
            "specified application round and a resident of an EU member state or associated "
            "country."
        ),
    },
    {
        "id": "eu-login",
        "title": "EU Login account",
        "url": "https://youth.europa.eu/solidarity_en",
        "text": (
            "EU Login is the European Commission's single sign-on. You need a free EU Login "
            "account to register for the European Solidarity Corps, Erasmus+ youth activities "
            "and DiscoverEU. You create it once with your email and reuse it across all EU "
            "youth services."
        ),
    },
    {
        "id": "youth-portal",
        "title": "The European Youth Portal",
        "url": "https://youth.europa.eu/home_en",
        "text": (
            "The European Youth Portal is the EU's information hub for young people, covering "
            "opportunities to study, work, volunteer and travel in Europe, plus your rights. "
            "It links to Erasmus+, the European Solidarity Corps and DiscoverEU and is "
            "available in all official EU languages."
        ),
    },
    {
        "id": "esc-allowance",
        "title": "Costs and allowances in the Solidarity Corps",
        "url": "https://youth.europa.eu/solidarity/young-people/volunteering_en",
        "text": (
            "Volunteering in the European Solidarity Corps is free for the volunteer: the "
            "programme covers travel, accommodation, food, insurance and gives a small monthly "
            "pocket-money allowance. Volunteering placements typically last between 2 and 12 "
            "months, though shorter projects exist for groups."
        ),
    },
    {
        "id": "eures-jobs",
        "title": "EURES — working in another EU country",
        "url": "https://eures.europa.eu/index_en",
        "text": (
            "EURES is the European job mobility portal. It lists job vacancies across EU and "
            "EEA countries and gives practical advice on living and working abroad, recognised "
            "qualifications and your rights as an EU worker. EU citizens can work in any member "
            "state without a work permit."
        ),
    },
    {
        "id": "youth-rights",
        "title": "Free movement and youth rights in the EU",
        "url": "https://europa.eu/youreurope/citizens/index_en.htm",
        "text": (
            "As an EU citizen you have the right to live, study, work and travel in any EU "
            "country. Your Europe is the official site explaining these rights, including "
            "health cover with the European Health Insurance Card (EHIC), recognition of "
            "diplomas, and consumer protections when abroad."
        ),
    },
]


def corpus_fingerprint() -> str:
    """A stable id of the corpus contents so a cached embedding index can be invalidated."""
    import hashlib

    h = hashlib.sha256()
    for c in CORPUS:
        h.update(c["id"].encode())
        h.update(c["text"].encode())
    return h.hexdigest()[:16]
