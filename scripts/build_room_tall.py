"""Make the tall phone room (prompts/11 A): extend room.png to 1152x2496.

Places the original room centred on a 1152x2496 canvas (top offset 224),
asks Muse Image (/images/edits, paper-diorama identity, search off) to
extend the ceiling above and the floor below in the same style, then
composites the ORIGINAL room pixels back over the middle with a 24px
feathered seam and re-keys the window glass (alpha from the original).
Outputs web/public/room/room_tall.png + .webp; layout.json gains
tall={height, topOffset} so sticker/spot coordinates shift by a constant.
Run from the repo root: python scripts/build_room_tall.py [--force]
"""
import argparse
import json
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from api.room import NO_SEARCH, data_url, post_json, save_b64  # noqa: E402
from api.style import DIORAMA, NEGATIVE  # noqa: E402

W, H, TOP = 1152, 2496, 224
SRC = ROOT / "web" / "public" / "room" / "room.png"
if not SRC.exists():  # the client ships room.webp; the PNG only exists right after build_room.py
    SRC = SRC.with_suffix(".webp")
OUT_PNG = ROOT / "web" / "public" / "room" / "room_tall.png"
OUT_WEBP = ROOT / "web" / "public" / "room" / "room_tall.webp"
RAW = ROOT / "room_out" / "room_tall_edit.png"
LAYOUT = ROOT / "web" / "public" / "room" / "layout.json"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--force", action="store_true")
    args = ap.parse_args()
    if OUT_PNG.exists() and not args.force:
        print("room_tall exists; --force to redo")
        return
    room = Image.open(SRC).convert("RGBA")
    assert room.size == (1152, 2048), room.size
    # Canvas: original centred, bands pre-filled from edge rows so the edit
    # starts from ceiling/floor colours rather than blank.
    canvas = Image.new("RGBA", (W, H), (233, 220, 200, 255))
    top_strip = room.crop((0, 0, W, 8)).resize((W, TOP))
    bot_strip = room.crop((0, 2040, W, 2048)).resize((W, H - TOP - 2048))
    canvas.paste(top_strip, (0, 0))
    canvas.paste(bot_strip, (0, TOP + 2048))
    canvas.alpha_composite(room, (0, TOP))
    RAW.parent.mkdir(parents=True, exist_ok=True)
    seed = RAW.with_name("room_tall_seed.png")
    canvas.convert("RGB").save(seed)

    prompt = json.dumps({
        "task": "extend this paper-diorama student bedroom image vertically: continue the plain ceiling and wall upward in the blank band at the top, and continue the wooden floorboards downward in the blank band at the bottom, in exactly the same style, colours and lighting. Do not change, move or redraw anything in the middle of the image (room, window, bed, desk, shelves stay pixel-identical in position). No new furniture, no objects, no people.",
        "visual_identity": DIORAMA, "negative": NEGATIVE}, indent=1)
    if not RAW.exists() or args.force:
        r = post_json("/images/edits", {
            "model": "muse-image-1.0", "n": 1, "size": "1152x2496", "output_format": "png",
            "tool_enablement": NO_SEARCH, "images": [{"image_url": data_url(seed)}], "prompt": prompt})
        save_b64(r["data"][0], RAW)
    edited = Image.open(RAW).convert("RGBA").resize((W, H))

    # Composite the original back over the middle, feathering 24px seams.
    mask = Image.new("L", (W, 2048), 255)
    px = mask.load()
    for y in range(24):
        a = int(255 * (y + 1) / 24)
        for x in range(W):
            px[x, y] = a
            px[x, 2047 - y] = a
    base = edited.copy()
    base.paste(room, (0, TOP), mask)
    # Re-key the window glass: wherever the original is transparent, so is this.
    orig_alpha = room.getchannel("A")
    key_mask = orig_alpha.point(lambda a: 255 if a < 200 else 0)
    alpha_img = base.getchannel("A")
    region_alpha = alpha_img.crop((0, TOP, W, TOP + 2048))
    region_alpha = Image.composite(Image.new("L", (W, 2048), 0), region_alpha, key_mask)
    alpha_img.paste(region_alpha, (0, TOP))
    base.putalpha(alpha_img)
    base.save(OUT_PNG)
    base.save(OUT_WEBP, quality=88)  # webp keeps the keyed glass alpha
    layout = json.loads(LAYOUT.read_text())
    layout["tall"] = {"height": H, "topOffset": TOP, "file": "/room/room_tall.webp"}
    LAYOUT.write_text(json.dumps(layout, indent=1))
    print(f"wrote {OUT_PNG} {OUT_PNG.stat().st_size//1024}KB, {OUT_WEBP} {OUT_WEBP.stat().st_size//1024}KB, topOffset={TOP}")


if __name__ == "__main__":
    main()
