"""Pre-render every subject object as a green-screen cut-paper sticker.

Run from the repo root:
  python scripts/build_stickers.py --limit 8
  python scripts/build_stickers.py --only CAH07-01-01
Each card: one Muse Image edit (room.png as style reference) on flat #00FF00,
SAM 3.1 box, green key + despill, trim to web/public/stickers/<code>.webp.
Review page: sticker_out/index.html (checkerboard + 6 composite rooms).
"""
import argparse
import json
import random
import sys
import threading
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from api.room import NO_SEARCH, client, data_url, parse_sam, post_json, save_b64  # noqa: E402
from api.style import NEGATIVE, identity  # noqa: E402

ROOM = ROOT / "web" / "public" / "room" / "room.png"
LAYOUT = json.loads((ROOT / "web" / "public" / "room" / "layout.json").read_text())
STICKERS = ROOT / "web" / "public" / "stickers"
INDEX = STICKERS / "stickers.json"
OUT = ROOT / "sticker_out"
SCALE = {"small": 0.5, "medium": 0.75, "large": 1.0}
LARGE_WORDS = ("guitar", "telescope", "mannequin", "suitcase", "harp", "gate", "skeleton",
               "spotlight", "camera on tripod", "wardrobe", "surfboard", "easel", "drum")
_lock = threading.Lock()


def size_class(card):
    slot = card["slot"]
    text = (card["object"] + " " + card["display_name"]).lower()
    if any(w in text for w in LARGE_WORDS) or slot == "floor":
        size = "large" if slot == "floor" or any(w in text for w in LARGE_WORDS) else "medium"
    elif slot == "shelf":
        size = "small"
    else:
        size = "medium"
    return size


def sticker_prompt(card, bigger=False):
    return json.dumps({
        "task": "draw ONLY this object, isolated, as a cut-paper piece in the same style as the reference room, "
                "three-quarter view matching the room's camera, centred on a flat solid #00FF00 background, "
                "no shadow on the background, nothing else" + ("; clearly visible, a little larger" if bigger else ""),
        "visual_identity": identity(), "object": card["object"], "negative": NEGATIVE}, indent=1)


def sam_box(image, card):
    url = data_url(image)
    for label in card["sam_labels"]:
        seg = client().responses.create(
            model="sam-3.1",
            input=[{"type": "message", "role": "user", "content": [
                {"type": "input_text", "text": label},
                {"type": "input_image", "image_url": url}]}],
            metadata={"include_confidence": "true"})
        boxes = [b for b in parse_sam(seg.output_text or "") if b.get("c", 1) >= 0.5]
        if boxes:
            return max(boxes, key=lambda b: b.get("c", 0))
    return None


def cut_out(img, box):
    x1, y1, x2, y2 = (max(0, int(box["x1"]) - 8), max(0, int(box["y1"]) - 8),
                      min(img.width, int(box["x2"]) + 8), min(img.height, int(box["y2"]) + 8))
    crop = img.crop((x1, y1, x2, y2)).convert("RGBA")
    px = crop.load()
    for y in range(crop.height):
        for x in range(crop.width):
            r, g, b, _ = px[x, y]
            if g > 150 and g - r > 60 and g - b > 60:  # chroma green
                px[x, y] = (r, g, b, 0)
            elif g > r and g > b:  # despill green fringe
                px[x, y] = (r, max(r, b), b, px[x, y][3])
    bbox = crop.getchannel("A").getbbox()
    if not bbox:
        return None, 0.0
    crop = crop.crop(bbox)
    frac = sum(1 for v in crop.getchannel("A").getdata() if v > 10) / (crop.width * crop.height)
    if crop.width > 512 or crop.height > 512:
        crop.thumbnail((512, 512))
    return crop, frac


def build_one(card, room_ref):
    code = card["code"]
    raw = OUT / "raw" / (code + ".png")
    raw.parent.mkdir(parents=True, exist_ok=True)
    for attempt in range(3):
        if attempt or not raw.exists():
            r = post_json("/images/edits", {
                "model": "muse-image-1.0", "n": 1, "size": "1024x1024", "output_format": "png",
                "tool_enablement": NO_SEARCH, "images": [{"image_url": room_ref}],
                "prompt": sticker_prompt(card, bigger=attempt > 0)})
            save_b64(r["data"][0], raw)
        box = sam_box(raw, card)
        if not box:
            continue
        sticker, frac = cut_out(Image.open(raw).convert("RGB"), box)
        if sticker is None or frac < 0.02:
            raw.unlink(missing_ok=True)
            continue
        sticker.save(STICKERS / (code + ".webp"), lossless=True)
        return {"code": code, "slot": card["slot"], "size": size_class(card),
                "w": sticker.width, "h": sticker.height}
    return None


def composite_rooms(entries, cards_by_code, n=6):
    room = Image.open(ROOM).convert("RGBA")
    win = LAYOUT["window"]
    view = Image.open(ROOT / "web" / "public" / "views" / "campus_day.webp").convert("RGB")
    spots = LAYOUT["spots"]
    names = []
    rng = random.Random(8)
    for i in range(n):
        canvas = Image.new("RGBA", room.size, (110, 110, 150, 255))
        canvas.paste(view.resize((win["w"], win["h"])), (win["x"], win["y"]))
        canvas.paste(room, (0, 0), room)
        chosen = rng.sample(entries, min(8, len(entries)))
        used = set()
        placed = []
        for e in chosen:
            spot_name = next((s for s, v in spots.items() if v["slot"] == e["slot"] and s not in used), None)
            if not spot_name:
                continue
            used.add(spot_name)
            placed.append((e, spot_name))
        for e, spot_name in sorted(placed, key=lambda t: spots[t[1]]["z"]):
            spot = spots[spot_name]
            st = Image.open(STICKERS / (e["code"] + ".webp")).convert("RGBA")
            mw, mh = spot["max"]
            scale = min(mw / st.width, mh / st.height) * SCALE[e["size"]]
            st = st.resize((max(1, int(st.width * scale)), max(1, int(st.height * scale))))
            ax, ay = spot["anchor"]
            canvas.paste(st, (ax - st.width // 2, ay - st.height), st)
        dest = OUT / ("room%d.png" % (i + 1))
        canvas.convert("RGB").save(dest)
        names.append(dest.name)
    return names


def contact_sheet(entries, cards_by_code):
    tiles = "".join(
        '<figure><img src="../web/public/stickers/%s.webp"><figcaption>%s · %s · %s/%s</figcaption></figure>'
        % (e["code"], cards_by_code[e["code"]]["display_name"], e["code"], e["slot"], e["size"]) for e in entries)
    rooms = composite_rooms(entries, cards_by_code)
    room_imgs = "".join('<figure><img src="%s"></figure>' % n for n in rooms)
    (OUT / "index.html").write_text(
        '<!doctype html><meta charset="utf-8"><title>Inkling stickers</title>'
        '<style>body{font:14px system-ui;margin:20px;background:#efeaf2;color:#2b2340}'
        '.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:14px}'
        'figure{margin:0}figure img{max-width:100%;display:block;border-radius:8px}'
        '.check img{background:repeating-conic-gradient(#ddd 0 25%,#fff 0 50%) 0 0/24px 24px;max-height:160px;margin:auto}'
        '.rooms{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:14px}</style>'
        '<h1>Stickers on a checkerboard</h1><div class="grid check">' + tiles + '</div>'
        '<h2>Composite rooms</h2><div class="rooms">' + room_imgs + '</div>')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=None)
    ap.add_argument("--only", default=None)
    args = ap.parse_args()
    cards = json.loads((ROOT / "data" / "subject_cards.json").read_text())["cards"]
    STICKERS.mkdir(parents=True, exist_ok=True)
    OUT.mkdir(parents=True, exist_ok=True)
    done = {}
    if INDEX.exists():
        done = {e["code"]: e for e in json.loads(INDEX.read_text())}
    todo = [c for c in cards if c["code"] not in done]
    if args.only:
        todo = [c for c in cards if c["code"] == args.only]
    if args.limit:
        todo = todo[:args.limit]
    print("Stickers to build: %d (est. $%.2f at ~$0.01 per image)" % (len(todo), len(todo) * 0.01))
    room_ref = data_url(ROOM)
    failures = []
    with ThreadPoolExecutor(max_workers=6) as pool:
        results = list(pool.map(lambda c: (c, build_one(c, room_ref)), todo))
    for card, entry in results:
        if entry:
            done[entry["code"]] = entry
            print(card["code"], "ok", entry["slot"], entry["size"], flush=True)
        else:
            failures.append(card["code"])
            print(card["code"], "FAILED", flush=True)
    INDEX.write_text(json.dumps(sorted(done.values(), key=lambda e: e["code"]), indent=1))
    by_code = {c["code"]: c for c in cards}
    contact_sheet(sorted(done.values(), key=lambda e: e["code"]), by_code)
    print("Done: %d stickers. Failures: %s" % (len(done), ", ".join(failures) or "none"))


if __name__ == "__main__":
    main()
