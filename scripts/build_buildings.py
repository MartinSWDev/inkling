"""
Paper-diorama buildings for the simulation scene (prompts/14 C), drawn with
Muse Image and cut out like the characters (see build_characters.py).

  python scripts/build_buildings.py            # render any missing buildings
Outputs web/public/sim/buildings/<name>.webp (11 destinations + sixth form)
and a ground strip. Re-runs skip files that exist; delete one to redo it.
The page uses paper-coloured placeholders until these exist.
"""
import json
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "scripts"))
from api.room import NO_SEARCH, post_json, save_b64  # noqa: E402
from api.style import DIORAMA  # noqa: E402
from build_characters import key_green  # noqa: E402

OUT = ROOT / "sim_building_out"
PUB = ROOT / "web" / "public" / "sim" / "buildings"

BUILDINGS = {
    "sixthform": "a friendly UK sixth form college building, brick and glass, students' entrance",
    "lined": "a cosy public library with tall windows and a small clock",
    "graph": "a maths and engineering tower, angular, with a crane-like spire",
    "manuscript": "a concert hall with a curved roof and golden doors",
    "blueprint": "an architect's studio with a slanted glass roof and drawing boards visible",
    "parchment": "a museum with columns and a domed roof",
    "map": "a field station hut with a weather vane and map boards outside",
    "watercolour": "an art studio with big north-facing windows and paint pots outside",
    "lab": "a science and health lab, white and glass, with a green cross sign (no words)",
    "legal": "a courthouse and offices with pillars and steps",
    "printout": "a computer lab with glowing screens visible through windows (no words)",
    "kraft": "a farm with a barn, silo and fence",
}
NEG = ["plastic or glossy CGI rendering", "oversaturated or neon colours", "text", "letters",
       "words", "logos", "watermark", "border", "frame", "people's faces"]


def prompt(desc):
    return json.dumps({
        "task": "one paper-diorama building cut-out, side-on, for a children's picture-book town",
        "visual_identity": DIORAMA,
        "building": desc + ", made of layered cut paper with torn edges and soft pastel colours",
        "composition": "single building, whole building in frame with a wide margin, ground line at the bottom",
        "background": "flat solid pure green #00FF00, nothing else, no ground shadow",
        "negative": NEG})


def render(name):
    src, dst = OUT / f"{name}.png", PUB / f"{name}.webp"
    if dst.exists():
        print("  skip", name)
        return name, None
    r = post_json("/images/generations", {"model": "muse-image-1.0", "n": 1, "size": "1024x1024",
                                          "output_format": "png", "tool_enablement": NO_SEARCH,
                                          "prompt": prompt(BUILDINGS[name])})
    save_b64(r["data"][0], src)
    size, edge = key_green(src, dst)
    print(f"  {name}: {size}{' — touches edge, redo' if edge else ''}")
    return name, size


def ground():
    dst = PUB / "ground.webp"
    if dst.exists():
        return
    r = post_json("/images/generations", {"model": "muse-image-1.0", "n": 1, "size": "1536x1024",
                                          "output_format": "png", "tool_enablement": NO_SEARCH,
                                          "prompt": json.dumps({
                                              "task": "a wide paper-diorama ground strip: rolling pastel hills, a winding pale path, torn-paper edges",
                                              "visual_identity": DIORAMA, "negative": NEG + ["buildings", "people"]})})
    src = OUT / "ground.png"
    save_b64(r["data"][0], src)
    from PIL import Image
    Image.open(src).convert("RGB").save(dst, "WEBP", quality=88)
    print("  ground strip saved")


def main():
    OUT.mkdir(exist_ok=True)
    PUB.mkdir(parents=True, exist_ok=True)
    only = sys.argv[sys.argv.index("--only") + 1] if "--only" in sys.argv else None
    names = [n for n in BUILDINGS if not only or n == only]
    with ThreadPoolExecutor(max_workers=4) as pool:
        list(pool.map(render, names))
    if not only:
        ground()
    print(f"Done. Buildings in {PUB.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
