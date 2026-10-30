"""Build the layered room: keyed room.png (magenta window) + 8 window views.

Run from the repo root: python scripts/build_room.py
Outputs web/public/room/room.png, web/public/room/layout.json,
web/public/views/<view>_<time>.webp. Resumable: existing files are kept.
"""
import json
import sys
from pathlib import Path

from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from api.room import NO_SEARCH, data_url, post_json, save_b64  # noqa: E402
from api.style import HALLS_ROOM, NEGATIVE, identity  # noqa: E402

RAW = ROOT / "api" / "cache" / "room_raw.png"
ROOM = ROOT / "web" / "public" / "room" / "room.png"
LAYOUT = ROOT / "web" / "public" / "room" / "layout.json"
VIEWS_DIR = ROOT / "web" / "public" / "views"
VIEWS = {
    "city": "a cut-paper city skyline with a red-brick clock tower beside a slow river",
    "coast": "a cut-paper seaside: sea, harbour wall, lighthouse and small boats",
    "campus": "a cut-paper campus town: lawn, old university buildings and students' bicycles without people",
    "countryside": "cut-paper rolling countryside: fields, hedgerows, sheep and a winding lane",
}
TIMES = {"day": "bright daylight, fresh colours", "dusk": "dusk, warm orange and violet sky, first lights on"}


def room_prompt():
    room = dict(HALLS_ROOM)
    room["window_view"] = ("the window panes filled with flat solid magenta #FF00FF, "
                           "no reflections, no view, just flat magenta glass")
    room["rules"] = room["rules"] + ["shelves, desk top and pinboard completely empty: "
                                      "no plants, no books, no notes, no mugs, nothing on them"]
    return json.dumps({"task": "illustrate this empty student room", "visual_identity": identity(),
                       **room, "objects_by_location": {}, "negative": NEGATIVE}, indent=1)


def key_out(raw):
    img = Image.open(raw).convert("RGB")
    px = img.load()
    alpha = Image.new("L", img.size, 255)
    apx = alpha.load()
    for y in range(img.height):
        for x in range(img.width):
            r, g, b = px[x, y]
            if r > 150 and r - g > 80 and b - g > 40:  # magenta panes (paper texture shifts the blue)
                apx[x, y] = 0
    alpha = alpha.filter(ImageFilter.GaussianBlur(0.7))
    out = img.convert("RGBA")
    out.putalpha(alpha)
    return out


def window_box(rgba):
    alpha = rgba.getchannel("A")
    return alpha.getbbox()  # (x1, y1, x2, y2) of transparent + opaque; recompute below


def transparent_box(rgba):
    a = rgba.getchannel("A").load()
    xs, ys = [], []
    step = 4
    for y in range(0, rgba.height, step):
        for x in range(0, rgba.width, step):
            if a[x, y] < 40:
                xs.append(x)
                ys.append(y)
    if not xs:
        return None
    return {"x": min(xs), "y": min(ys), "w": max(xs) - min(xs), "h": max(ys) - min(ys)}


def main():
    ROOM.parent.mkdir(parents=True, exist_ok=True)
    VIEWS_DIR.mkdir(parents=True, exist_ok=True)
    print("Room build: 1 room + 8 views (est. $0.09 at ~$0.01 per image)")
    if not RAW.exists():
        RAW.parent.mkdir(parents=True, exist_ok=True)
        r = post_json("/images/generations", {
            "model": "muse-image-1.0", "n": 1, "size": "1080x1920", "output_format": "png",
            "tool_enablement": NO_SEARCH, "prompt": room_prompt()})
        save_b64(r["data"][0], RAW)
        print("rendered raw room")
    room = key_out(RAW)
    room.save(ROOM)
    box = transparent_box(room)
    layout = json.loads(LAYOUT.read_text()) if LAYOUT.exists() else {}
    layout["window"] = box
    layout.setdefault("spots", {})
    LAYOUT.write_text(json.dumps(layout, indent=1))
    print("room.png", room.size, "window", box)
    aspect = box["w"] / box["h"]
    for view, scene in VIEWS.items():
        for time_name, light in TIMES.items():
            dest = VIEWS_DIR / ("%s_%s.webp" % (view, time_name))
            if dest.exists():
                continue
            prompt = json.dumps({
                "task": "draw ONLY the scene outside a window as a cut-paper diorama in the style of the reference room; fill the whole frame with the scene",
                "visual_identity": identity(), "scene": scene, "lighting": light,
                "negative": NEGATIVE}, indent=1)
            r = post_json("/images/edits", {
                "model": "muse-image-1.0", "n": 1, "size": "1080x1920", "output_format": "png",
                "tool_enablement": NO_SEARCH, "images": [{"image_url": data_url(RAW)}], "prompt": prompt})
            tmp = ROOT / "api" / "cache" / ("view_%s_%s.png" % (view, time_name))
            save_b64(r["data"][0], tmp)
            img = Image.open(tmp).convert("RGB")
            w, h = img.size
            crop_h = min(h, int(w / aspect))
            top = (h - crop_h) // 2
            img.crop((0, top, w, top + crop_h)).resize((768, int(768 / aspect))).save(dest, quality=86)
            print("view", dest.name)


if __name__ == "__main__":
    main()
