"""
Inkling day-two image check: answers the two open Muse Image questions and
runs the first real compositor loop.

  1. Portrait: does size="1080x1920" give a 9:16 image?
  2. Object sheet: generate one sheet of 6 objects in the chosen style.
  3. Reference: generate a room through /v1/images/edits with the sheet as
     the reference image. Does the room reuse the sheet's objects and style?
  4. Verify: ask SAM 3.1 to find each object in the room. Target: 5 of 6.

Writes everything to image_out/<style>/ including check.html, which shows
the sheet, the room and SAM's boxes. Open it in a browser.

Run from the repo root:
  python scripts/image_check.py            # style A (gouache)
  python scripts/image_check.py --style B  # pixel art; try two and compare

Cost: 2 images ($0.02) + 6 SAM calls (about $0.015) per style.
Re-running reuses saved images; delete image_out/<style>/ to regenerate.

Docs: https://dev.meta.ai/docs/image-generation
      https://dev.meta.ai/docs/api-reference/images/edit-image
      https://dev.meta.ai/docs/sam/segmenting
"""
import argparse
import base64
import json
import os
import re
import struct
import sys
import urllib.error
import urllib.request
from pathlib import Path

from dotenv import load_dotenv
from openai import OpenAI

BASE = "https://api.meta.ai/v1"
STYLES = {
    "A": "Soft gouache illustration, rounded shapes, visible brush grain, warm lamp light, "
         "muted palette with one warm accent",
    "B": "16-bit pixel art, limited 32-colour palette, crisp dithering, no anti-aliasing",
    "C": "Claymation diorama, fingerprint texture, tilt-shift depth of field, soft studio light",
    "D": "Hand-painted anime background style, golden hour, delicate line work",
}
# (SAM labels tried in order, description for the image prompts, room slot).
# SAM matches what an object LOOKS like, so give a few plain visual nouns.
OBJECTS = [
    (["fish tank", "fish bowl"], "a small fish tank with a blue light", "shelf"),
    (["telescope"], "a telescope on a tripod", "floor"),
    (["synthesizer", "drum machine", "music controller", "electronic device"],
     "a compact synthesiser with glowing pads", "desk"),
    (["books", "stack of books"], "a stack of three heavy law books", "shelf"),
    (["easel", "canvas"], "an easel holding a half-finished canvas", "floor"),
    (["brain model", "brain"], "an anatomical brain model", "desk"),
]

load_dotenv()
KEY = os.environ.get("MODEL_API_KEY") or sys.exit("MODEL_API_KEY missing from .env")
client = OpenAI(base_url=BASE, api_key=KEY)


def post_json(path, body):
    """Raw JSON POST, for the /images/edits JSON form the SDK doesn't send."""
    req = urllib.request.Request(
        BASE + path, data=json.dumps(body).encode(), method="POST",
        headers={"Authorization": f"Bearer {KEY}", "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=300) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        sys.exit(f"HTTP {e.code} from {path}: {e.read().decode()[:500]}")


def png_size(path):
    with open(path, "rb") as f:
        head = f.read(24)
    if head[:8] != b"\x89PNG\r\n\x1a\n":
        return None
    return struct.unpack(">II", head[16:24])


def data_url(path):
    return "data:image/png;base64," + base64.b64encode(path.read_bytes()).decode()


def save_b64(item, path):
    if not item.get("b64_json"):
        sys.exit(f"No b64_json in response: {json.dumps(item)[:300]}")
    path.write_bytes(base64.b64decode(item["b64_json"]))


def parse_sam(text):
    boxes = []
    for chunk in re.findall(r"<\|box;([^|]*)\|>", text):
        b = dict(p.split("=", 1) for p in chunk.split(";") if "=" in p)
        boxes.append({k: float(v) for k, v in b.items()})
    return boxes


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--style", default="A", choices=STYLES)
    style_key = ap.parse_args().style
    style = STYLES[style_key]
    out = Path("image_out") / style_key
    out.mkdir(parents=True, exist_ok=True)
    no_search = {"enable_image_search": False, "enable_web_search": False}

    # 1 + 2. Object sheet (square) ------------------------------------------
    sheet = out / "sheet.png"
    print(f"\n--- Object sheet, style {style_key} ---")
    if sheet.exists():
        print("reusing", sheet)
    else:
        listing = "\n".join(f"{i + 1}. {d}" for i, (_, d, _) in enumerate(OBJECTS))
        r = post_json("/images/generations", {
            "model": "muse-image-1.0", "n": 1, "size": "1536x1024",
            "output_format": "png", "response_format": "b64_json",
            "tool_enablement": no_search,
            "prompt": f"{style}. A sprite sheet on a plain neutral background, 2 rows by 3 columns, "
                      f"each cell one object seen from the front at the same scale, same line weight "
                      f"and palette throughout:\n{listing}\n"
                      "Clean separation between cells, no text, no labels, no shadows outside each cell."})
        save_b64(r["data"][0], sheet)
        print("saved", sheet)
    print("size:", png_size(sheet))

    # 3. Room via /images/edits with the sheet as reference, portrait ---------
    room = out / "room.png"
    print("\n--- Room (reference = sheet, size 1080x1920) ---")
    if room.exists():
        print("reusing", room)
    else:
        by_slot = {}
        for _, d, slot in OBJECTS:
            by_slot.setdefault(slot, []).append(d)
        placement = " ".join(f"On the {s}: {', '.join(ds)}." for s, ds in by_slot.items())
        r = post_json("/images/edits", {
            "model": "muse-image-1.0", "n": 1, "size": "1080x1920",
            "output_format": "png", "response_format": "b64_json",
            "tool_enablement": no_search,
            "images": [{"image_url": data_url(sheet)}],
            "prompt": f"{style}. A cosy student bedroom, evening, one warm desk lamp as the key light. "
                      "Front-on view of the back wall, window centred, a wooden shelf on the left, "
                      "a desk on the right, a teal armchair bottom-left, a round rug. "
                      f"{placement} Through the window: a red-brick clock tower beside a slow river. "
                      "Draw each object exactly as it appears in the reference sheet, in the same style. "
                      "Keep every object fully visible and separated by clear space. "
                      "Portrait. No text, no logos, no people."})
        save_b64(r["data"][0], room)
        if r["data"][0].get("revised_prompt"):
            (out / "room_revised_prompt.txt").write_text(r["data"][0]["revised_prompt"])
        print("saved", room)
    size = png_size(room)
    print("size:", size, "-> portrait" if size and size[1] > size[0] else "-> NOT portrait")

    # 4. SAM verification, one call per object --------------------------------
    print("\n--- SAM 3.1 verification ---")
    room_url = data_url(room)
    found = []
    for labels, _, slot in OBJECTS:
        best, used = None, None
        for label in labels:
            seg = client.responses.create(
                model="sam-3.1",
                input=[{"type": "message", "role": "user", "content": [
                    {"type": "input_text", "text": label},
                    {"type": "input_image", "image_url": room_url}]}],
                metadata={"include_confidence": "true"})
            boxes = [b for b in parse_sam(seg.output_text or "") if b.get("c", 1) >= 0.5]
            best = max(boxes, key=lambda b: b.get("c", 0), default=None)
            if best:
                used = label
                break
        name = labels[0]
        mark = "FOUND" if best else "missing"
        conf = f" (confidence {best['c']:.2f})" if best and "c" in best else ""
        via = f" via '{used}'" if used and used != name else ""
        print(f"  {name:12s} {mark}{conf}{via}")
        found.append({"name": name, "label": used, "slot": slot, "box": best})
    hits = sum(1 for f in found if f["box"])
    print(f"\n{hits} of {len(OBJECTS)} objects found.",
          "Compositor loop works." if hits >= 5 else "Simplify the room prompt or try another style.")
    (out / "sam.json").write_text(json.dumps(found, indent=2))

    # Visual check page -------------------------------------------------------
    w, h = size or (1080, 1920)
    rects = "".join(
        f'<div class="b" style="left:{f["box"]["x1"] / f["box"]["w"] * 100}%;'
        f'top:{f["box"]["y1"] / f["box"]["h"] * 100}%;'
        f'width:{(f["box"]["x2"] - f["box"]["x1"]) / f["box"]["w"] * 100}%;'
        f'height:{(f["box"]["y2"] - f["box"]["y1"]) / f["box"]["h"] * 100}%">'
        f'<span>{f["name"]}</span></div>' for f in found if f["box"])
    (out / "check.html").write_text(f"""<!doctype html><meta charset="utf-8">
<title>Inkling image check, style {style_key}</title>
<style>body{{font:15px system-ui;margin:20px;background:#1e1829;color:#f1ecf6}}
.row{{display:flex;gap:20px;flex-wrap:wrap;align-items:flex-start}}
img{{max-width:100%;display:block;border-radius:8px}}
.room{{position:relative;width:min(420px,100%)}}
.b{{position:absolute;border:2px solid #f0b24a;border-radius:4px}}
.b span{{position:absolute;top:-20px;left:0;background:#f0b24a;color:#2a1a00;font-size:12px;padding:1px 5px;border-radius:3px;white-space:nowrap}}</style>
<h1>Style {style_key}: {hits} of {len(OBJECTS)} found</h1><p>{style}</p>
<div class="row"><div style="width:min(520px,100%)"><h2>Object sheet</h2><img src="sheet.png"></div>
<div><h2>Room {w}×{h}</h2><div class="room"><img src="room.png">{rects}</div></div></div>""")
    print("\nOpen", (out / "check.html").resolve())


if __name__ == "__main__":
    main()
