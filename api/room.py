"""Live room loop: Muse Image edits + SAM 3.1 verification (shapes from scripts/image_check.py)."""
import base64
import json
import os
import re
import shutil
import sys
import threading
import urllib.error
import urllib.request
import uuid
from pathlib import Path

from dotenv import load_dotenv
from openai import OpenAI

try:
    from .style import SLOT_REGIONS, add_prompt, base_prompt
except ImportError:  # run as a plain script inside api/
    from style import SLOT_REGIONS, add_prompt, base_prompt  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")
BASE = "https://api.meta.ai/v1"
KEY = os.environ.get("MODEL_API_KEY", "")
NO_SEARCH = {"enable_image_search": False, "enable_web_search": False}
CACHE = ROOT / "api" / "cache"
BASE_PNG = CACHE / "base.png"
ROOMS = CACHE / "rooms"
CARDS = {c["code"]: c for c in json.loads((ROOT / "data" / "subject_cards.json").read_text())["cards"]}
_lock = threading.Lock()
_client = None


def client():
    global _client
    if _client is None:
        if not KEY:
            raise RuntimeError("MODEL_API_KEY missing from .env")
        _client = OpenAI(base_url=BASE, api_key=KEY)
    return _client


def post_json(path, body):
    req = urllib.request.Request(BASE + path, data=json.dumps(body).encode(), method="POST",
                                 headers={"Authorization": "Bearer " + KEY, "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=300) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        raise RuntimeError("HTTP %s from %s: %s" % (e.code, path, e.read().decode()[:500]))


def data_url(path):
    return "data:image/png;base64," + base64.b64encode(Path(path).read_bytes()).decode()


def save_b64(item, path):
    if not item.get("b64_json"):
        raise RuntimeError("No b64_json in response: " + json.dumps(item)[:300])
    Path(path).write_bytes(base64.b64decode(item["b64_json"]))


def parse_sam(text):
    boxes = []
    for chunk in re.findall(r"<\|box;([^|]*)\|>", text or ""):
        b = dict(p.split("=", 1) for p in chunk.split(";") if "=" in p)
        boxes.append({k: float(v) for k, v in b.items()})
    return boxes


def centre_in_region(box, slot):
    x1, y1, x2, y2, w, h = box["x1"], box["y1"], box["x2"], box["y2"], box["w"], box["h"]
    cx, cy = (x1 + x2) / 2 / w, (y1 + y2) / 2 / h
    rx1, ry1, rx2, ry2 = SLOT_REGIONS[slot]
    return rx1 <= cx <= rx2 and ry1 <= cy <= ry2


def sam_find(image, card):
    """Try sam_labels in order; fallbacks only count inside the slot region."""
    url = data_url(image)
    for i, label in enumerate(card["sam_labels"]):
        seg = client().responses.create(
            model="sam-3.1",
            input=[{"type": "message", "role": "user", "content": [
                {"type": "input_text", "text": label},
                {"type": "input_image", "image_url": url}]}],
            metadata={"include_confidence": "true"})
        boxes = [b for b in parse_sam(seg.output_text or "") if b.get("c", 1) >= 0.5]
        if not boxes:
            continue
        best = max(boxes, key=lambda b: b.get("c", 0))
        if i == 0 or centre_in_region(best, card["slot"]):
            return {"label": label, "box": best}
    return None


def ensure_base():
    with _lock:
        if BASE_PNG.exists():
            return BASE_PNG
        CACHE.mkdir(parents=True, exist_ok=True)
        r = post_json("/images/generations", {
            "model": "muse-image-1.0", "n": 1, "size": "1080x1920", "output_format": "png",
            "tool_enablement": NO_SEARCH, "prompt": base_prompt()})
        save_b64(r["data"][0], BASE_PNG)
        return BASE_PNG


def _edit(current, cards, dest):
    r = post_json("/images/edits", {
        "model": "muse-image-1.0", "n": 1, "size": "1080x1920", "output_format": "png",
        "tool_enablement": NO_SEARCH, "images": [{"image_url": data_url(current)}],
        "prompt": add_prompt(cards)})
    save_b64(r["data"][0], dest)
    return dest


def _load(room_id):
    f = ROOMS / room_id / "room.json"
    return json.loads(f.read_text()) if f.exists() else None


def _save(state):
    d = ROOMS / state["room_id"]
    d.mkdir(parents=True, exist_ok=True)
    (d / "room.json").write_text(json.dumps(state, indent=1))


def grow_room(room_id, add):
    """Add subject codes to a room (at most 2 per edit), SAM-verify each, retry once."""
    state = _load(room_id) if room_id else None
    if state is None:
        room_id = uuid.uuid4().hex[:12]
        d = ROOMS / room_id
        d.mkdir(parents=True, exist_ok=True)
        shutil.copy(ensure_base(), d / "step-000.png")
        state = {"room_id": room_id, "placed": [], "failed": [], "steps": ["step-000.png"],
                 "image": "step-000.png"}
        _save(state)
    d = ROOMS / room_id
    done = {p["code"] for p in state["placed"]}
    todo = [CARDS[c] for c in add if c in CARDS and c not in done]
    unknown = [c for c in add if c not in CARDS]
    failed = list(unknown)
    step = len(state["steps"])
    current = d / state["image"]
    for i in range(0, len(todo), 2):
        batch = todo[i:i + 2]
        nxt = d / ("step-%03d.png" % step)
        step += 1
        _edit(current, batch, nxt)
        current = nxt
        state["steps"].append(nxt.name)
        state["image"] = nxt.name
        for card in batch:
            hit = sam_find(current, card)
            if hit:
                state["placed"].append({"code": card["code"], "box": hit["box"],
                                        "label": hit["label"], "confidence": hit["box"].get("c")})
                continue
            retry = d / ("step-%03d.png" % step)
            step += 1
            _edit(current, [card], retry)
            hit = sam_find(retry, card)
            if hit:
                current = retry
                state["steps"].append(retry.name)
                state["image"] = retry.name
                state["placed"].append({"code": card["code"], "box": hit["box"],
                                        "label": hit["label"], "confidence": hit["box"].get("c")})
            else:
                failed.append(card["code"])
        _save(state)
    state["failed"] = failed
    _save(state)
    return {"room_id": room_id, "image_url": "/api/rooms/%s/%s" % (room_id, state["image"]),
            "placed": state["placed"], "failed": failed}
