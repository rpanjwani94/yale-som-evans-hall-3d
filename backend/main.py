"""FastAPI backend: chat with the professors in the Evans Hall walk-through.

Run from this folder:  .venv/bin/python -m uvicorn main:app --port 8000
"""

import logging
from collections import OrderedDict
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent / ".env")

from fastapi import FastAPI, HTTPException  # noqa: E402  (needs the .env loaded first)
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402
from pydantic import BaseModel, Field  # noqa: E402
from pydantic_ai.messages import ModelMessage  # noqa: E402

from agents import model_name, professor_agent  # noqa: E402
from professors import PROFESSORS  # noqa: E402

log = logging.getLogger("professors")
app = FastAPI(title="Yale SOM Virtual: professors")
# the Vite dev server proxies /api, so CORS only matters if the frontend calls the backend directly
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"], allow_methods=["*"], allow_headers=["*"])

MAX_SESSIONS = 200
HISTORY: OrderedDict[tuple[str, str], list[ModelMessage]] = OrderedDict()  # (session, professor) -> conversation so far


class ChatIn(BaseModel):
    session_id: str = Field(min_length=8, max_length=64)
    message: str = Field(min_length=1, max_length=2000)


class ChatOut(BaseModel):
    reply: str


@app.get("/api/health")
def health():
    return {"ok": True, "model": model_name()}


@app.get("/api/professors")
def professors():
    return [{"id": p.id, "name": p.display_name} for p in PROFESSORS.values()]


@app.post("/api/professors/{prof_id}/chat", response_model=ChatOut)
async def chat(prof_id: str, body: ChatIn):
    if prof_id not in PROFESSORS:
        raise HTTPException(404, f"No professor named {prof_id!r}")
    key = (body.session_id, prof_id)
    history = HISTORY.get(key, [])
    try:
        result = await professor_agent(prof_id).run(body.message, message_history=history)
    except Exception as e:  # model or network failure: log the type only, never the request (it carries the key header)
        log.error("chat with %s failed: %s", prof_id, type(e).__name__)
        raise HTTPException(502, "The professor couldn't answer right now. Try again in a moment.") from None
    HISTORY[key] = result.all_messages()
    HISTORY.move_to_end(key)
    while len(HISTORY) > MAX_SESSIONS:
        HISTORY.popitem(last=False)
    return ChatOut(reply=result.output)


@app.delete("/api/professors/{prof_id}/chat/{session_id}")
def reset(prof_id: str, session_id: str):
    HISTORY.pop((session_id, prof_id), None)
    return {"ok": True}
