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
SCALE = {"small": 0.6, "medium": 0.8, "large": 1.0}
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


VIEWS_BY_SLOT = {
    "wall": "perfectly flat and front-on, parallel to the picture plane, no visible sides or depth "
            "(at most a thin frame edge), like a print pinned flat to a wall",
    "shelf": "front view at eye level, seen very slightly from above (about 15 degrees) so only a "
             "sliver of the top shows; object square to the camera, not rotated",
    "desk": "front view at eye level, seen very slightly from above (about 15 degrees) so only a "
            "sliver of the top shows; object square to the camera, not rotated",
    "floor": "front view at eye level, seen very slightly from above (about 15 degrees) so only a "
             "sliver of the top shows; object square to the camera, not rotated",
    "bed": "lying flat as if on a duvet, seen from slightly above",
}


def sticker_prompt(card, bigger=False):
    return json.dumps({
        "task": "draw ONLY this object, isolated, as a cut-paper piece in the same style as the reference room, "
                + VIEWS_BY_SLOT[card["slot"]] + ", object upright and level, not tilted, "
                "centred on a flat solid #00FF00 background, "
                "the whole object fully in frame with a wide green margin, no outline, no border, no sticker edge, "
                "no shadow on the background, nothing else" + ("; clearly visible, a little larger" if bigger else ""),
        "visual_identity": identity(), "object": card["object"], "negative": NEGATIVE}, indent=1)


def sam_present(image, card):
    """SAM is only an 'is the object there' check; it no longer crops anything."""
    url = data_url(image)
    for label in card["sam_labels"]:
        seg = client().responses.create(
            model="sam-3.1",
            input=[{"type": "message", "role": "user", "content": [
                {"type": "input_text", "text": label},
                {"type": "input_image", "image_url": url}]}],
            metadata={"include_confidence": "true"})
        if [b for b in parse_sam(seg.output_text or "") if b.get("c", 1) >= 0.5]:
            return label
    return None


def _largest_share(alpha_small):
    px = alpha_small.load()
    w, h = alpha_small.size
    seen = [bytearray(w) for _ in range(h)]
    total = best = 0
    from collections import deque
    for y in range(h):
        for x in range(w):
            if px[x, y] <= 10:
                continue
            total += 1
            if seen[y][x]:
                continue
            n, q = 0, deque([(x, y)])
            seen[y][x] = 1
            while q:
                cx, cy = q.popleft()
                n += 1
                for nx, ny in ((cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)):
                    if 0 <= nx < w and 0 <= ny < h and not seen[ny][nx] and px[nx, ny] > 10:
                        seen[ny][nx] = 1
                        q.append((nx, ny))
            best = max(best, n)
    return best / total if total else 0.0


def keyed_sticker(img):
    """Crop to the keyed alpha (never the SAM box); reject stickers touching the frame edge."""
    from PIL import ImageFilter
    crop = img.convert("RGBA")
    px = crop.load()
    for y in range(crop.height):
        for x in range(crop.width):
            r, g, b, _ = px[x, y]
            if g > 150 and g - r > 60 and g - b > 60:  # chroma green
                px[x, y] = (r, g, b, 0)
            elif g > r and g > b:  # despill green fringe
                px[x, y] = (r, max(r, b), b, px[x, y][3])
    alpha = crop.getchannel("A").filter(ImageFilter.MinFilter(3)).filter(ImageFilter.MinFilter(3))
    crop.putalpha(alpha)
    bbox = alpha.getbbox()
    if not bbox:
        return None, 0.0, 0.0
    if bbox[0] <= 2 or bbox[1] <= 2 or bbox[2] >= crop.width - 2 or bbox[3] >= crop.height - 2:
        return None, 0.0, 0.0  # clipped by the frame
    frac = sum(1 for v in alpha.getdata() if v > 10) / (crop.width * crop.height)
    share = _largest_share(alpha.resize((128, 128)))
    crop = crop.crop(bbox)
    if crop.width > 512 or crop.height > 512:
        crop.thumbnail((512, 512))
    return crop, frac, share


def build_one(card, room_ref):
    code = card["code"]
    raw = OUT / "raw" / (code + ".png")
    raw.parent.mkdir(parents=True, exist_ok=True)
    for attempt in range(3):
        try:
            entry = _attempt(card, room_ref, raw, attempt)
            if entry:
                return entry
        except Exception as exc:  # one bad call must not kill the batch
            print(code, "attempt error:", str(exc)[:160], flush=True)
    return None


def _attempt(card, room_ref, raw, attempt):
    code = card["code"]
    if True:
        if attempt or not raw.exists():
            r = post_json("/images/edits", {
                "model": "muse-image-1.0", "n": 1, "size": "1024x1024", "output_format": "png",
                "tool_enablement": NO_SEARCH, "images": [{"image_url": room_ref}],
                "prompt": sticker_prompt(card, bigger=attempt > 0)})
            save_b64(r["data"][0], raw)
        label = sam_present(raw, card)
        sticker, frac, share = keyed_sticker(Image.open(raw).convert("RGB"))
        ok = sticker is not None and 0.01 < frac < 0.7 and (label is not None or share >= 0.85)
        if not ok:
            raw.unlink(missing_ok=True)
            return None
        sticker.save(STICKERS / (code + ".webp"), lossless=True)
        return {"code": code, "slot": card["slot"], "size": size_class(card),
                "w": sticker.width, "h": sticker.height, "label": label or "alpha-fallback"}
    return None


def _shadow(canvas, st, x, y, wall=False):
    """Soft contact shadow: ellipse under standing objects, offset silhouette for wall items."""
    from PIL import ImageDraw, ImageFilter
    layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    if wall:
        sil = Image.new("RGBA", st.size, (30, 20, 40, 90))
        sil.putalpha(st.getchannel("A").point(lambda a: a * 90 // 255))
        layer.paste(sil, (x + 7, y + 10), sil)
    else:
        d.ellipse([x + st.width * 0.12, y + st.height - 7, x + st.width * 0.88, y + st.height + 7],
                  fill=(30, 20, 40, 64))  # ~25% multiply shadow
    canvas.alpha_composite(layer.filter(ImageFilter.GaussianBlur(5)))


def composite_rooms(entries, cards_by_code, n=6):
    room = Image.open(ROOM).convert("RGBA")
    win = LAYOUT["window"]
    view = Image.open(ROOT / "web" / "public" / "views" / "campus_day.webp").convert("RGB")
    spots = LAYOUT["spots"]
    names = []
    rng = random.Random()
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
            if e["slot"] == "wall":
                st = st.rotate(rng.uniform(-2, 2), expand=True, resample=Image.BICUBIC)
            x, y = ax - st.width // 2, ay - st.height
            _shadow(canvas, st, x, y, wall=e["slot"] == "wall")
            canvas.paste(st, (x, y), st)
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
    by_code_all = {c["code"]: c for c in cards}
    for f in STICKERS.glob("*.webp"):  # resume after a crashed run: files on disk count as done
        code = f.stem
        if code not in done and code in by_code_all:
            im = Image.open(f)
            done[code] = {"code": code, "slot": by_code_all[code]["slot"], "size": size_class(by_code_all[code]),
                          "w": im.width, "h": im.height, "label": "resumed"}
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
