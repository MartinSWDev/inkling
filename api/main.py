"""Inkling API skeleton. Run: uvicorn api.main:app --reload (keys stay server-side)."""
import json
from pathlib import Path
from typing import List, Optional

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from starlette.concurrency import run_in_threadpool

from api.room import grow_room

ROOT = Path(__file__).resolve().parent.parent
app = FastAPI(title="Inkling API")


def _load(name):
    return json.loads((ROOT / "data" / name).read_text())


@app.get("/api/health")
def health():
    return {"ok": True}


@app.get("/api/subjects")
def subjects():
    cards = _load("subject_cards.json")["cards"]
    profiles = _load("subject_profiles.json")["subjects"]
    counts = {s["code"]: s["course_count"] for s in _load("subjects.json")["subjects"] if s["level"] == 3}
    merged = [{**c, "profile": profiles.get(c["code"]), "course_count": counts.get(c["code"], 0)}
              for c in cards]
    return {"count": len(merged), "subjects": merged}


@app.get("/api/pairs")
def pairs():
    return _load("pairs.json")


class RoomRequest(BaseModel):
    room_id: Optional[str] = None
    add: List[str] = []


@app.post("/api/room")
async def room(req: RoomRequest):
    return await run_in_threadpool(grow_room, req.room_id, req.add)


@app.get("/api/rooms/{room_id}/{filename}")
def room_file(room_id: str, filename: str):
    f = ROOT / "api" / "cache" / "rooms" / room_id / filename
    if not f.is_file():
        raise HTTPException(404, "room file not found")
    return FileResponse(f)
