"""
Inkling anchor test: can we keep one room consistent?

  A. Grow: edit an existing room to add two new objects and change nothing else.
     (This is how the room fills after each round, and the "missing object" retry.)
  B. House look: draw a different room (different objects) using an existing room
     as the style and layout anchor plus a new object sheet.

Base room defaults to style_out/halls/diorama_bluehour/room.png.
Writes to anchor_out/<base>/ and anchor_out/<base>/anchor.html.

Run from the repo root:
  pip install pillow            # optional: measures how much of the room changed
  python scripts/anchor_test.py
  python scripts/anchor_test.py diorama_golden   # another base

Cost: 3 images ($0.03) + ~16 SAM calls (~$0.04).
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from image_check import OBJECTS, client, data_url, parse_sam, png_size, post_json, save_b64  # noqa: E402
from style_explore import NEGATIVE, STYLES, identity  # noqa: E402

base_key = sys.argv[1] if len(sys.argv) > 1 else "diorama_bluehour"
BASE = Path("style_out/halls") / base_key / "room.png"
if not BASE.exists():
    sys.exit(f"{BASE} not found. Run style_explore.py first.")
style = STYLES[base_key]
OUT = Path("anchor_out") / base_key
OUT.mkdir(parents=True, exist_ok=True)
NO_SEARCH = {"enable_image_search": False, "enable_web_search": False}

GROW = [(["globe"], "a small desk globe", "on the wall shelves above the desk"),
        (["guitar", "acoustic guitar"], "an acoustic guitar", "leaning against the end of the bed")]
NEW_OBJECTS = [(["globe"], "a small desk globe", "shelf"),
               (["guitar", "acoustic guitar"], "an acoustic guitar", "floor"),
               (["stethoscope"], "a stethoscope", "desk"),
               (["camera", "film camera"], "a vintage film camera", "desk"),
               (["plant", "potted plant"], "a small potted plant", "shelf"),
               (["football", "ball"], "a football", "floor")]


def sam(img_url, labels):
    for label in labels:
        seg = client.responses.create(
            model="sam-3.1",
            input=[{"type": "message", "role": "user", "content": [
                {"type": "input_text", "text": label},
                {"type": "input_image", "image_url": img_url}]}],
            metadata={"include_confidence": "true"})
        boxes = [b for b in parse_sam(seg.output_text or "") if b.get("c", 1) >= 0.5]
        if boxes:
            return max(boxes, key=lambda b: b.get("c", 0))
    return None


def check(img, objects, title):
    url = data_url(img)
    found = [(labels[0], sam(url, labels)) for labels, *_ in objects]
    hits = sum(1 for _, b in found if b)
    print(f"  {title}: {hits}/{len(objects)} found  " +
          "  ".join(f"{n}:{b['c']:.2f}" if b else f"{n}:--" for n, b in found))
    return found


def changed_share(a, b, ignore_boxes):
    """Share of pixels (outside the new objects) that changed noticeably. Needs Pillow."""
    try:
        from PIL import Image, ImageChops
    except ImportError:
        return None
    ia, ib = Image.open(a).convert("L"), Image.open(b).convert("L")
    if ia.size != ib.size:
        ib = ib.resize(ia.size)
    diff = ImageChops.difference(ia, ib).point(lambda v: 255 if v > 40 else 0)
    w, h = ia.size
    px = diff.load()
    for bx in ignore_boxes:
        if not bx:
            continue
        sx, sy = w / bx["w"], h / bx["h"]
        for x in range(int(bx["x1"] * sx), min(w, int(bx["x2"] * sx))):
            for y in range(int(bx["y1"] * sy), min(h, int(bx["y2"] * sy))):
                px[x, y] = 0
    return sum(1 for v in diff.getdata() if v) / (w * h)


# --- A. Grow the existing room ----------------------------------------------
print(f"\nA. Grow {base_key}: add {', '.join(d for _, d, _ in GROW)}")
grown = OUT / "grown.png"
if not grown.exists():
    adds = " ".join(f"Add {d} {where}." for _, d, where in GROW)
    r = post_json("/images/edits", {
        "model": "muse-image-1.0", "n": 1, "size": "1080x1920", "output_format": "png",
        "tool_enablement": NO_SEARCH, "images": [{"image_url": data_url(BASE)}],
        "prompt": f"{adds} Draw them in exactly the same style, palette and lighting as the room. "
                  "Change nothing else: same furniture, same objects in the same places, same window, "
                  "same framing. No text."})
    save_b64(r["data"][0], grown)
print("  size:", png_size(grown))
orig_found = check(grown, OBJECTS, "original six still there")
new_found = check(grown, [(l, d, w) for l, d, w in GROW], "new objects added")
share = changed_share(BASE, grown, [b for _, b in new_found])
if share is not None:
    verdict = "very stable" if share < 0.05 else "some drift" if share < 0.15 else "redrawn"
    print(f"  pixels changed outside the new objects: {share:.1%} ({verdict})")
else:
    print("  (pip install pillow to measure how much of the room changed)")

# --- B. House look: new objects, base room as anchor --------------------------
print(f"\nB. House look: a different room anchored on {base_key}")
sheet2 = OUT / "sheet_new.png"
if not sheet2.exists():
    r = post_json("/images/edits", {
        "model": "muse-image-1.0", "n": 1, "size": "1536x1024", "output_format": "png",
        "tool_enablement": NO_SEARCH, "images": [{"image_url": data_url(BASE)}],
        "prompt": json.dumps({
            "task": "a reference sheet of six NEW objects, drawn in exactly the style of the attached room",
            "layout": "2 rows by 3 columns on a plain neutral background, one object per cell, same scale",
            "objects": [d for _, d, _ in NEW_OBJECTS], "negative": NEGATIVE})})
    save_b64(r["data"][0], sheet2)
room2 = OUT / "room_new.png"
if not room2.exists():
    by_slot = {}
    slot_words = {"shelf": "on the wall shelves above the desk", "desk": "on the desk",
                  "floor": "on the floor, beside the bed or tucked in a corner"}
    for _, d, slot in NEW_OBJECTS:
        by_slot.setdefault(slot_words[slot], []).append(d)
    r = post_json("/images/edits", {
        "model": "muse-image-1.0", "n": 1, "size": "1080x1920", "output_format": "png",
        "tool_enablement": NO_SEARCH,
        "images": [{"image_url": data_url(BASE)}, {"image_url": data_url(sheet2)}],
        "prompt": json.dumps({
            "task": "draw a new student room. Image 1 is the house style: match its style, palette, "
                    "lighting, camera angle and room layout exactly. Image 2 shows the objects to place. "
                    "Do not include any of image 1's objects (fish tank, telescope, synthesiser, books, "
                    "easel, brain model).",
            "visual_identity": identity(style), "objects_by_location": by_slot,
            "rules": ["every object fully visible and separated", "no text, no logos, no people"],
            "negative": NEGATIVE})})
    save_b64(r["data"][0], room2)
print("  size:", png_size(room2))
check(room2, NEW_OBJECTS, "new objects present")
# Leak check uses only each object's precise first label: fallbacks like
# "electronic device" would match the laptop and give false positives.
leak = check(room2, [([l[0]], d, s) for l, d, s in OBJECTS], "old objects leaked in (want 0)")

# --- Page ----------------------------------------------------------------------
pct = f"{share:.1%} of pixels changed" if share is not None else "install Pillow to measure change"
(OUT / "anchor.html").write_text(f"""<!doctype html><meta charset="utf-8"><title>Inkling anchor test</title>
<style>*{{box-sizing:border-box}}body{{margin:0;padding:28px;background:#efeaf2;font:14px/1.35 system-ui,sans-serif;color:#2b2340}}
h1{{margin:0 0 4px;font-size:22px}}h2{{font-size:16px;margin:22px 0 10px}}p{{margin:0;color:#6c6280}}
.row{{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;max-width:1100px}}
figure{{margin:0;background:#fbf8fc;border-radius:14px;padding:8px}}img{{width:100%;border-radius:10px;display:block}}
figcaption{{padding:8px 4px 2px}}</style>
<h1>Anchor test · {base_key}</h1><p>Muse Image /images/edits with reference images</p>
<h2>A. Grow the same room (add globe and guitar, change nothing else) · {pct}</h2>
<div class="row"><figure><img src="../../{BASE}"><figcaption>Before</figcaption></figure>
<figure><img src="grown.png"><figcaption>After</figcaption></figure></div>
<h2>B. House look: different objects, anchored on the room above</h2>
<div class="row"><figure><img src="../../{BASE}"><figcaption>Anchor room</figcaption></figure>
<figure><img src="sheet_new.png"><figcaption>New object sheet (drawn in the anchor's style)</figcaption></figure>
<figure><img src="room_new.png"><figcaption>New room · old objects leaked: {sum(1 for _, b in leak if b)}</figcaption></figure></div>""")
print("\nOpen", (OUT / "anchor.html").resolve())
