"""Pre-render one paper-diorama illustration per Things/Big-questions card.

Run from the repo root: python scripts/build_cards.py [--only radio]
Outputs web/public/cards/<card_id>.webp (room.png as style reference, no text).
"""
import argparse
import json
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from api.room import NO_SEARCH, data_url, post_json, save_b64  # noqa: E402
from api.style import NEGATIVE, identity  # noqa: E402

SCENE_OVERRIDES = {
    # The literal card title trips the image filter; same scene, safer wording.
    "virus": "tiny crown-shaped microbes floating among soft round paper cells under a microscope, cheerful science scene",
}

ROOM = ROOT / "web" / "public" / "room" / "room.png"
OUT = ROOT / "web" / "public" / "cards"
RAW = ROOT / "card_out" / "raw"


def build_one(card, room_ref):
    dest = OUT / (card["id"] + ".webp")
    if dest.exists():
        return card["id"], "skip"
    raw = RAW / (card["id"] + ".png")
    raw.parent.mkdir(parents=True, exist_ok=True)
    prompt = json.dumps({
        "task": "draw this scene as a wide paper-diorama illustration in the same style as the reference room; "
                "fill the whole frame with the scene; no words anywhere",
        "visual_identity": identity(), "scene": SCENE_OVERRIDES.get(card["id"], card["title"]), "negative": NEGATIVE}, indent=1)
    try:
        r = post_json("/images/edits", {
            "model": "muse-image-1.0", "n": 1, "size": "1024x1024", "output_format": "png",
            "tool_enablement": NO_SEARCH, "images": [{"image_url": room_ref}], "prompt": prompt})
        save_b64(r["data"][0], raw)
        img = Image.open(raw).convert("RGB")
        w, h = img.size
        crop_h = int(w * 2 / 3)
        img.crop((0, (h - crop_h) // 2, w, (h + crop_h) // 2)).resize((768, 512)).save(dest, quality=86)
        return card["id"], "ok"
    except Exception as exc:
        return card["id"], "FAILED " + str(exc)[:120]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", default=None)
    args = ap.parse_args()
    decks = json.loads((ROOT / "data" / "scoring_decks.json").read_text())
    cards = decks["things"] + decks["questions"]
    if args.only:
        cards = [c for c in cards if c["id"] == args.only]
    OUT.mkdir(parents=True, exist_ok=True)
    todo = [c for c in cards if not (OUT / (c["id"] + ".webp")).exists()]
    print("Card art to build: %d (est. $%.2f)" % (len(todo), len(todo) * 0.01))
    with ThreadPoolExecutor(max_workers=6) as pool:
        for cid, status in pool.map(lambda c: build_one(c, data_url(ROOM)), todo):
            print(cid, status, flush=True)


if __name__ == "__main__":
    main()
