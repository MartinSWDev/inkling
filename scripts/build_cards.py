"""Pre-render one standalone paper-diorama scene per Things/Big-questions card.

Generated from scratch (/images/generations, no room reference image): the
activity or idea itself, close-up, filling the frame. Not a bedroom.
Run from the repo root: python scripts/build_cards.py [--only radio] [--force]
Outputs web/public/cards/<card_id>.webp (4:3).
"""
import argparse
import json
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from api.room import NO_SEARCH, post_json, save_b64  # noqa: E402
from api.style import DIORAMA, NEGATIVE  # noqa: E402

# Visual scenes for the question cards (their titles are questions, not scenes).
# No people, no text. The "virus" wording also avoids the image filter.
SCENES = {
    "virus": "tiny crown-shaped microbes floating among soft round paper cells under a microscope, cheerful science scene",
    "dream": "a swirling night sky of paper clouds, stars and a crescent moon with sleepy spiral wisps",
    "deep": "the deep ocean floor: a small submarine beam lighting coral, fish and a sunken ship in dark blue water",
    "life": "a telescope on a hill pointed at a starry sky with a ringed planet and distant galaxies",
    "crime": "brass scales of justice, a wooden gavel and rolled blank scrolls on a desk, close-up",
    "romans": "an ancient Roman market table with bread, olives, grapes, clay amphorae and old coins",
    "rich": "a paper globe with tiny trade ships, coins and two contrasting landscapes, one lush port and one dry plain",
    "aiart": "a friendly robot hand holding a paintbrush, painting swirls on a canvas on an easel",
    "words": "colourful blank speech bubbles and swirling sound waves floating between paper houses",
    "catchy": "paper musical instruments with bouncing sound waves and a vinyl record, joyful and close-up",
    "city": "a miniature paper city model with parks, a tram, bridges and tiny blank-fronted buildings",
    "rules": "blank wooden signposts pointing different ways at a crossroads, one fence rail playfully askew",
    "bees": "paper bees following a dotted spiral flight path back to a hive among flowers",
    "quake": "a tall paper skyscraper steady on a shaking cracked ground plate beside a seismograph drum",
    "fake": "a blank paper megaphone with swirling rumour ribbons and a magnifying glass over an empty page",
    "species": "a rare red panda in a lush paper habitat under a protective glass dome with seedlings",
}

OUT = ROOT / "web" / "public" / "cards"
RAW = ROOT / "card_out" / "raw"


def build_one(card, force):
    dest = OUT / (card["id"] + ".webp")
    if dest.exists() and not force:
        return card["id"], "skip"
    raw = RAW / (card["id"] + ".png")
    raw.parent.mkdir(parents=True, exist_ok=True)
    scene = SCENES.get(card["id"], card["title"])
    prompt = json.dumps({
        "task": "draw this activity as a standalone close-up scene filling the whole frame; "
                "a new scene, not a bedroom, no room interior, no window; no words anywhere",
        "visual_identity": DIORAMA, "scene": scene, "negative": NEGATIVE}, indent=1)
    try:
        r = post_json("/images/generations", {
            "model": "muse-image-1.0", "n": 1, "size": "1024x768", "output_format": "png",
            "tool_enablement": NO_SEARCH, "prompt": prompt})
        save_b64(r["data"][0], raw)
        img = Image.open(raw).convert("RGB")
        w, h = img.size
        crop_h = min(h, int(w * 3 / 4))
        crop_w = int(crop_h * 4 / 3)
        img.crop(((w - crop_w) // 2, (h - crop_h) // 2, (w + crop_w) // 2, (h + crop_h) // 2)).resize((768, 576)).save(dest, quality=86)
        return card["id"], "ok"
    except Exception as exc:
        return card["id"], "FAILED " + str(exc)[:160]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", default=None)
    ap.add_argument("--force", action="store_true")
    args = ap.parse_args()
    decks = json.loads((ROOT / "data" / "scoring_decks.json").read_text())
    cards = decks["things"] + decks["questions"]
    if args.only:
        cards = [c for c in cards if c["id"] == args.only]
    OUT.mkdir(parents=True, exist_ok=True)
    todo = [c for c in cards if args.force or not (OUT / (c["id"] + ".webp")).exists()]
    print("Card art to build: %d (est. $%.2f)" % (len(todo), len(todo) * 0.01))
    with ThreadPoolExecutor(max_workers=6) as pool:
        for cid, status in pool.map(lambda c: build_one(c, args.force), todo):
            print(cid, status, flush=True)


if __name__ == "__main__":
    main()
