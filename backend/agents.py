"""One PydanticAI agent per professor, all routed through Portkey, sharing the course-catalog tools."""

import os
from functools import cache

from openai import AsyncOpenAI
from pydantic_ai import Agent
from pydantic_ai.models.openai import OpenAIResponsesModel
from pydantic_ai.providers.openai import OpenAIProvider

import db
from professors import PROFESSORS, build_prompt

DEFAULT_MODEL = "gpt-5.6-luna"  # override with OPENAI_MODEL in .env


def model_name() -> str:
    return os.getenv("OPENAI_MODEL", DEFAULT_MODEL)


def build_model() -> OpenAIResponsesModel:
    """OpenAI model routed through Portkey, using the Responses API (Chat Completions rejects tool calls for
    reasoning models)."""
    headers = {"x-portkey-api-key": os.environ["PORTKEY_API_KEY"]}
    if os.getenv("PORTKEY_PROVIDER"):
        headers["x-portkey-provider"] = os.environ["PORTKEY_PROVIDER"]
    client = AsyncOpenAI(
        base_url=os.getenv("PORTKEY_BASE_URL", "https://api.portkey.ai/v1"),
        api_key="portkey",  # Portkey authenticates with the header above, not with an OpenAI key
        default_headers=headers,
    )
    return OpenAIResponsesModel(model_name(), provider=OpenAIProvider(openai_client=client))


# ---------- tools: every professor can look things up in the catalog


def search_courses(query: str, limit: int = 8) -> list[dict]:
    """Search the Yale SOM Fall 2026 course catalog by keywords (course title, number, description, instructor,
    category). Every word must match somewhere, so use one to three distinctive words, e.g. 'regression',
    'negotiation', 'MGT 403', 'finance'. Returns up to `limit` sections with a short description."""
    return db.search_courses(query, limit)


def get_course(course_number: str) -> list[dict]:
    """Full details for one course number such as 'MGT 409': every section's days, times, room, and instructor,
    plus the full description and syllabus link."""
    return db.get_course(course_number)


def courses_by_professor(name: str) -> dict:
    """Look up a professor by name (first, last, or both): their bio and every course section they teach."""
    return {"bio": db.faculty_bio(name), "courses": db.courses_by_faculty(name)}


def courses_in_room(room: str) -> list[dict]:
    """Courses that meet in a room, given its number like '2200' or 'EVANS 4200'."""
    return db.courses_in_room(room)


def list_categories() -> list[dict]:
    """Course categories in the catalog (Core, Finance, Marketing, ...) with how many sections each has."""
    return db.categories()


TOOLS = [search_courses, get_course, courses_by_professor, courses_in_room, list_categories]


@cache
def professor_agent(prof_id: str) -> Agent:
    return Agent(build_model(), instructions=build_prompt(PROFESSORS[prof_id]), tools=TOOLS)
