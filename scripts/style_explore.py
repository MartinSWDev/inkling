"""
Inkling style exploration: the same six objects and the same room in several
art styles, side by side, with a SAM detection score for each.

Prompt structure adapted from @Maercihh's city-postcard prompts: a FIXED visual
identity block per style, a separate content block, and a negative list that
bans the generic AI look. Only the style block changes between runs.

Run from the repo root:
  python scripts/style_explore.py --new            # the six round-two styles, halls layout
  python scripts/style_explore.py --photo          # eight photographic variants
  python scripts/style_explore.py --light          # paper diorama in six lighting moods
  python scripts/style_explore.py                  # every style, halls layout
  python scripts/style_explore.py paper riso       # just these
  python scripts/style_explore.py --layout cosy    # the original armchair room
Halls rooms go to style_out/halls/<style>/ (open style_out/halls/index.html).
The first run's cosy rooms stay in style_out/<style>/. Object sheets are shared.

Cost per style: 2 images ($0.02) + up to ~10 SAM calls (~$0.025).
All styles: about $0.35. Re-runs reuse saved images.
"""
import json
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from image_check import OBJECTS, client, data_url, parse_sam, png_size, post_json, save_b64  # noqa: E402

OUT = Path("style_out")

# Shared across every style: the content and the things we never want.
NEGATIVE = [
    "generic AI illustration", "plastic or glossy CGI rendering", "over-smooth airbrushed gradients",
    "oversaturated or neon colours", "HDR look", "lens flare", "text", "letters", "labels",
    "logos", "watermark", "border", "frame", "people", "faces",
]
RULES = ["every object fully visible, separated by clear space, not overlapping furniture",
         "every object belongs to the same physical world and style",
         "draw each object as it appears in the reference sheet"]
WINDOW = "a red-brick clock tower beside a slow river at dusk"
LAYOUTS = {
    # The first run (kept in style_out/<style>/).
    "cosy": {
        "out": OUT,
        "room": {
            "scene": "a cosy student bedroom in the evening, one warm desk lamp as the key light",
            "layout": "front-on view of the back wall, window centred, a wooden shelf on the left, "
                      "a desk on the right, a teal armchair bottom-left, a round rug",
            "window_view": WINDOW, "rules": RULES, "format": "portrait 9:16"},
        "slots": {"shelf": "on the shelf", "desk": "on the desk", "floor": "on the floor"},
    },
    # Realistic UK university halls room (style_out/halls/<style>/).
    "halls": {
        "out": OUT / "halls",
        "room": {
            "scene": "a typical UK university halls of residence bedroom, lived in and personal, "
                     "evening, warm desk lamp on",
            "layout": "front-on view of the back wall with one window in the middle; a single bed "
                      "along the left wall with a duvet, throw and cushions; a desk with a desk "
                      "chair along the right wall; two simple wall shelves above the desk; a "
                      "pinboard on the wall; plain light walls and a simple wardrobe edge in view",
            "window_view": WINDOW,
            "rules": RULES + ["no armchair, no sofa, no rug in the middle",
                              "realistic halls proportions: compact, a small room"],
            "format": "portrait 9:16"},
        "slots": {"shelf": "on the wall shelves above the desk", "desk": "on the desk",
                  "floor": "on the floor, beside the bed or tucked in a corner"},
    },
}

# Each style is a fixed visual identity. Keep them distinct from each other.
STYLES = {
    "gouache": {
        "medium": "soft gouache illustration on textured paper",
        "visual_language": ["rounded shapes", "visible brush grain", "slightly uneven hand-drawn edges"],
        "palette": "muted earthy palette with one warm accent",
        "lighting": "warm lamp glow, soft shadows",
    },
    "paper": {
        "medium": "handcrafted layered paper-cut collage, photographed",
        "visual_language": ["multiple visibly separated paper layers", "soft paper shadows between layers",
                            "fine tactile paper grain", "slightly imperfect hand-cut edges",
                            "clean simplified shapes"],
        "palette": "powder blue, warm ivory, cream, muted sage, dusty grey, desaturated terracotta",
        "lighting": "soft diffuse light, gentle matte highlights",
    },
    "riso": {
        "medium": "three-colour risograph print",
        "visual_language": ["flat overlapping ink layers", "slight misregistration between colours",
                            "visible halftone grain", "uneven ink coverage", "simple bold shapes"],
        "palette": "fluorescent pink, teal and warm yellow inks on off-white stock",
        "lighting": "implied by flat colour blocks, no gradients",
    },
    "linocut": {
        "medium": "hand-carved linocut print",
        "visual_language": ["bold carved lines", "gouge marks in large areas", "chunky simplified forms",
                            "slightly patchy ink transfer"],
        "palette": "deep navy and burnt orange ink on cream paper",
        "lighting": "high-contrast carved light and shadow",
    },
    "inkwash": {
        "medium": "pen and ink sketch with loose watercolour wash, like an architect's sketchbook",
        "visual_language": ["confident fine ink lines", "loose washes that bleed past the lines",
                            "visible paper texture", "white paper left showing"],
        "palette": "sepia ink with soft washes of blue, green and ochre",
        "lighting": "warm lamp glow suggested with wash",
    },
    "felt": {
        "medium": "needle-felted wool and embroidered fabric diorama, photographed",
        "visual_language": ["fuzzy wool fibres", "visible stitches", "soft rounded handmade forms",
                            "felt and fabric textures"],
        "palette": "soft wool colours, sage, mustard, dusty rose, cream",
        "lighting": "soft studio light, shallow depth of field",
    },
    "miniature": {
        "medium": "photograph of a real handmade dollhouse-scale miniature room",
        "visual_language": ["real miniature props", "tilt-shift shallow depth of field",
                            "tiny real-world material details", "slight handmade imperfection"],
        "palette": "natural real-world colours, warm",
        "lighting": "warm practical lamp light inside the miniature",
    },
    "photo": {
        "medium": "editorial interior photograph shot on 35mm film",
        "visual_language": ["real objects and real materials", "natural film grain", "lived-in details",
                            "realistic proportions"],
        "palette": "natural warm tones, slightly faded film colour",
        "lighting": "warm evening lamp light mixed with blue dusk from the window",
    },
    # Round two
    "diorama": {
        "medium": "ultra-detailed paper-cut diorama, like a premium handmade storybook",
        "visual_language": ["layered paper depth with subtle shadows", "objects look like tiny paper "
                            "stickers with a thin white outline", "clean composition",
                            "whimsical but tidy", "fine paper texture"],
        "palette": "soft pastels: peach, lavender, powder blue, cream, sage",
        "lighting": "warm cosy lamp glow, soft depth of field",
    },
    "clay": {
        "medium": "stop-motion claymation set, photographed",
        "visual_language": ["plasticine with visible fingerprints and tool marks", "chunky rounded "
                            "handmade forms", "slightly wonky handmade proportions", "matte clay"],
        "palette": "warm saturated but soft clay colours",
        "lighting": "soft studio key light, tilt-shift depth of field",
    },
    "pixel": {
        "medium": "16-bit pixel art scene from a cosy life-sim video game",
        "visual_language": ["crisp pixels, no anti-aliasing", "limited 32-colour palette",
                            "careful dithering", "readable chunky objects"],
        "palette": "warm cosy game palette with a dusk-blue window",
        "lighting": "pixel lamp glow with dithered light pool",
    },
    "zine": {
        "medium": "hand-made zine collage: cut-out magazine photos, torn paper and tape",
        "visual_language": ["torn and scissor-cut edges", "masking tape strips", "mixed photo and "
                            "paper textures", "slightly misaligned layers", "photocopy grain"],
        "palette": "faded print colours with one bright accent",
        "lighting": "flat, as if scanned",
    },
    "pencil": {
        "medium": "coloured pencil drawing in a sketchbook",
        "visual_language": ["visible pencil strokes and hatching", "paper tooth showing through",
                            "soft layered colour", "slightly loose hand-drawn lines"],
        "palette": "soft warm pencil colours",
        "lighting": "warm lamp glow built up with layered pencil",
    },
    "screenprint": {
        "medium": "mid-century two-tone screenprint, like a 1960s book illustration",
        "visual_language": ["flat shapes", "slightly offset colour layers", "simple geometric "
                            "forms", "textured ink", "confident graphic composition"],
        "palette": "mustard, teal, brick red and off-white",
        "lighting": "suggested with flat colour shapes",
    },
    # Round three: photographic variants (camera, film stock, grade)
    "photo_portra35": {
        "medium": "photograph shot on a 35mm film camera, Kodak Portra 400",
        "visual_language": ["real objects and real materials", "fine natural film grain",
                            "lived-in details", "realistic proportions"],
        "palette": "Portra's natural warm tones, soft highlights",
        "lighting": "motivated practical lighting: warm tungsten desk lamp, cool blue dusk through the window",
    },
    "photo_mf_portra": {
        "medium": "interiors magazine photograph, Hasselblad medium-format camera, 80mm lens, Kodak Portra 400 120 film",
        "visual_language": ["real objects and real materials", "very fine grain", "gentle depth of field",
                            "carefully styled but lived-in", "realistic proportions"],
        "palette": "natural warm tones, soft creamy highlights",
        "lighting": "motivated practical lighting: warm tungsten desk lamp, cool blue dusk through the window",
    },
    "photo_mf_ektar": {
        "medium": "medium-format still-life photograph on Kodak Ektar 100",
        "visual_language": ["real objects and real materials", "almost grainless", "crisp detail",
                            "rich but natural saturation", "realistic proportions"],
        "palette": "vivid true-to-life colour, deep blues and warm woods",
        "lighting": "soft daylight from the window with the desk lamp on",
    },
    "photo_gold": {
        "medium": "casual snapshot on a 35mm point-and-shoot camera, Kodak Gold 200",
        "visual_language": ["real objects and real materials", "visible grain", "slightly imperfect framing",
                            "nostalgic, personal, lived-in", "realistic proportions"],
        "palette": "warm golden yellows, slightly faded",
        "lighting": "warm lamp light, no flash",
    },
    "photo_fuji_pastel": {
        "medium": "medium-format photograph on Fujifilm Pro 400H",
        "visual_language": ["real objects and real materials", "airy overexposed look", "soft grain",
                            "lived-in details", "realistic proportions"],
        "palette": "soft pastel greens and cyans, creamy whites",
        "lighting": "bright soft daylight from the window",
        "window_view": "a red-brick clock tower beside a slow river on a bright morning",
    },
    "photo_cinestill": {
        "medium": "night photograph on CineStill 800T film",
        "visual_language": ["real objects and real materials", "red halation glow around lights",
                            "visible grain", "moody but readable", "realistic proportions"],
        "palette": "tungsten-balanced: warm interior, deep blue night outside",
        "lighting": "desk lamp and fairy lights as the only light, room still clearly readable",
        "window_view": "a red-brick clock tower beside a river at night, lit windows",
    },
    "photo_cine": {
        "medium": "film still from a quiet indie drama, 35mm anamorphic",
        "visual_language": ["real objects and real materials", "visible film grain",
                            "slight halation around lights", "lived-in details"],
        "palette": "cinematic teal and amber grade",
        "lighting": "warm practical lamp against cool blue dusk from the window",
    },
    "photo_flash": {
        "medium": "candid photo from a 2000s compact digital camera with direct on-camera flash",
        "visual_language": ["real objects and real materials", "harsh flash on the foreground",
                            "dark vignette falloff", "slightly blown highlights", "candid, unstyled"],
        "palette": "flash-white foreground, dim warm background",
        "lighting": "direct on-camera flash, desk lamp faintly visible",
        "window_view": "a red-brick clock tower beside a river at night",
    },
    # Round three: paper diorama with different lighting (shares the diorama sheet)
    "diorama_morning": {
        "sheet": "diorama",
        "medium": "ultra-detailed paper-cut diorama, like a premium handmade storybook",
        "visual_language": ["layered paper depth with subtle shadows", "objects look like tiny paper "
                            "stickers with a thin white outline", "fine paper texture"],
        "palette": "fresh pastels: pale yellow, mint, powder blue, cream",
        "lighting": "bright early-morning sun streaming through the window, long soft shadows",
        "window_view": "a red-brick clock tower beside a slow river on a clear morning",
    },
    "diorama_golden": {
        "sheet": "diorama",
        "medium": "ultra-detailed paper-cut diorama, like a premium handmade storybook",
        "visual_language": ["layered paper depth with subtle shadows", "objects look like tiny paper "
                            "stickers with a thin white outline", "fine paper texture"],
        "palette": "warm peach, apricot, lavender, cream",
        "lighting": "golden-hour sun low through the window, warm glow across the room",
        "window_view": "a red-brick clock tower beside a slow river at sunset",
    },
    "diorama_rain": {
        "sheet": "diorama",
        "medium": "ultra-detailed paper-cut diorama, like a premium handmade storybook",
        "visual_language": ["layered paper depth with subtle shadows", "objects look like tiny paper "
                            "stickers with a thin white outline", "paper raindrops on the window glass"],
        "palette": "soft greys, sage, dusty blue, with a warm lamp accent",
        "lighting": "rainy afternoon: soft grey light from the window, desk lamp on for warmth",
        "window_view": "a red-brick clock tower beside a river in the rain",
    },
    "diorama_midnight": {
        "sheet": "diorama",
        "medium": "ultra-detailed paper-cut diorama, like a premium handmade storybook",
        "visual_language": ["layered paper depth with subtle shadows", "objects look like tiny paper "
                            "stickers with a thin white outline", "paper-cut stars"],
        "palette": "deep navy outside, warm amber pool of lamp light inside",
        "lighting": "midnight: the desk lamp lights the room warmly, every object still clearly readable",
        "window_view": "a red-brick clock tower beside a river at night under a starry sky",
    },
    "diorama_fairy": {
        "sheet": "diorama",
        "medium": "ultra-detailed paper-cut diorama, like a premium handmade storybook",
        "visual_language": ["layered paper depth with subtle shadows", "objects look like tiny paper "
                            "stickers with a thin white outline", "a string of paper fairy lights above the bed"],
        "palette": "warm cream, blush pink, gold, dusk blue",
        "lighting": "evening: fairy lights and desk lamp, cosy warm glow",
        "window_view": "a red-brick clock tower beside a river at dusk",
    },
    "diorama_bluehour": {
        "sheet": "diorama",
        "medium": "ultra-detailed paper-cut diorama, like a premium handmade storybook",
        "visual_language": ["layered paper depth with subtle shadows", "objects look like tiny paper "
                            "stickers with a thin white outline"],
        "palette": "cool blues and violets with a soft screen-glow accent",
        "lighting": "blue hour: cool light from the window, a soft glow from a laptop screen on the desk",
        "window_view": "a red-brick clock tower beside a river at blue hour, first lights coming on",
    },
}

GROUPS = {
    "new": ["diorama", "clay", "pixel", "zine", "pencil", "screenprint"],
    "photo": ["photo_portra35", "photo_mf_portra", "photo_mf_ektar", "photo_gold",
              "photo_fuji_pastel", "photo_cinestill", "photo_cine", "photo_flash"],
    "light": ["diorama", "diorama_morning", "diorama_golden", "diorama_rain",
              "diorama_midnight", "diorama_fairy", "diorama_bluehour"],
}


def identity(style):
    return {k: v for k, v in style.items() if k not in ("sheet", "window_view")}


def sheet_prompt(style):
    return json.dumps({
        "task": "reference sheet of six separate objects for later use",
        "visual_identity": identity(style),
        "layout": "2 rows by 3 columns on a plain neutral background, one object per cell, "
                  "same scale, clean separation between cells",
        "objects": [d for _, d, _ in OBJECTS],
        "negative": NEGATIVE,
    }, indent=1)


def room_prompt(style, layout):
    by_slot = {}
    for _, d, slot in OBJECTS:
        by_slot.setdefault(layout["slots"][slot], []).append(d)
    return json.dumps({
        "task": "illustrate this room using the attached reference sheet for the objects",
        "visual_identity": identity(style),
        **layout["room"],
        **({"window_view": style["window_view"]} if "window_view" in style else {}),
        "objects_by_location": by_slot,
        "negative": NEGATIVE,
    }, indent=1)


def run_style(key, layout_key):
    style, layout = STYLES[key], LAYOUTS[layout_key]
    out = layout["out"] / key
    out.mkdir(parents=True, exist_ok=True)
    no_search = {"enable_image_search": False, "enable_web_search": False}
    room = out / "room.png"
    # The object sheet depends only on the style, so share it across layouts.
    sheet_key = style.get("sheet", key)
    sheet = OUT / sheet_key / "sheet.png"
    sheet.parent.mkdir(parents=True, exist_ok=True)
    if not sheet.exists():
        r = post_json("/images/generations", {
            "model": "muse-image-1.0", "n": 1, "size": "1536x1024", "output_format": "png",
            "tool_enablement": no_search, "prompt": sheet_prompt(STYLES[sheet_key])})
        save_b64(r["data"][0], sheet)
    if not room.exists():
        r = post_json("/images/edits", {
            "model": "muse-image-1.0", "n": 1, "size": "1080x1920", "output_format": "png",
            "tool_enablement": no_search, "images": [{"image_url": data_url(sheet)}],
            "prompt": room_prompt(style, layout)})
        save_b64(r["data"][0], room)

    room_url, found = data_url(room), []
    for labels, _, _ in OBJECTS:
        hit = None
        for label in labels:
            seg = client.responses.create(
                model="sam-3.1",
                input=[{"type": "message", "role": "user", "content": [
                    {"type": "input_text", "text": label},
                    {"type": "input_image", "image_url": room_url}]}],
                metadata={"include_confidence": "true"})
            boxes = [b for b in parse_sam(seg.output_text or "") if b.get("c", 1) >= 0.5]
            if boxes:
                hit = max(b.get("c", 0) for b in boxes)
                break
        found.append((labels[0], hit))
    score = sum(1 for _, c in found if c)
    print(f"{key:10s} {score}/{len(OBJECTS)} found  " +
          "  ".join(f"{n}:{c:.2f}" if c else f"{n}:--" for n, c in found), flush=True)
    return key, score, found, png_size(room)


def main():
    args = sys.argv[1:]
    layout_key = "halls"
    if "--layout" in args:
        i = args.index("--layout")
        layout_key = args[i + 1]
        del args[i:i + 2]
    if layout_key not in LAYOUTS:
        sys.exit(f"Unknown layout {layout_key}; options: {', '.join(LAYOUTS)}")
    group = None
    for g in GROUPS:
        if f"--{g}" in args:
            group, args = g, GROUPS[g]
    keys = [k for k in args if k in STYLES] or list(STYLES)
    unknown = [k for k in args if k not in STYLES]
    if unknown:
        print("Unknown styles ignored:", ", ".join(unknown), "| options:", ", ".join(STYLES))
    out_dir = LAYOUTS[layout_key]["out"]
    print(f"Layout '{layout_key}': rendering {len(keys)} styles (4 at a time)...\n")
    with ThreadPoolExecutor(max_workers=4) as pool:
        results = list(pool.map(lambda k: run_style(k, layout_key), keys))
    # Include any other styles already rendered in this layout, so the page shows them all.
    done = {k for k, *_ in results}
    for k in STYLES:
        if k not in done and (out_dir / k / "room.png").exists():
            results.append((k, None, [], png_size(out_dir / k / "room.png")))

    sheet_rel = "" if out_dir == OUT else "../"
    cards = "".join(f"""<figure><img src="{k}/room.png" loading="lazy">
<figcaption><b>{k}</b> · SAM {f"{s}/{len(OBJECTS)}" if s is not None else "see earlier run"}<br><small>{STYLES[k]['medium']}</small>
<details><summary>sheet</summary><img src="{sheet_rel}{k}/sheet.png" loading="lazy"></details></figcaption></figure>"""
                    for k, s, _, _ in results)
    (out_dir / "index.html").write_text(f"""<!doctype html><meta charset="utf-8"><title>Inkling styles</title>
<style>body{{font:15px system-ui;margin:20px;background:#1e1829;color:#f1ecf6}}
.grid{{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:18px}}
figure{{margin:0}} img{{width:100%;border-radius:8px;display:block}}
figcaption{{padding:8px 2px}} small{{color:#b1a7c2}} summary{{cursor:pointer;color:#f0b24a}}</style>
<h1>Same room, {len(results)} styles</h1><div class="grid">{cards}</div>""")
    if group:
        by_key = {k: (sc, sz) for k, sc, _, sz in results}
        tiles = "".join(
            f'<figure><img src="{k}/room.png"><figcaption><b>{k.replace("_", " ")}</b>'
            f'<span>SAM {by_key[k][0]}/{len(OBJECTS)}</span></figcaption>'
            f'<small>{STYLES[k]["lighting"] if group == "light" else STYLES[k]["medium"]}</small></figure>'
            for k in GROUPS[group] if k in by_key)
        page = out_dir / f"{group}.html"
        page.write_text(f"""<!doctype html><meta charset="utf-8"><title>Inkling {group}</title>
<style>*{{box-sizing:border-box}}body{{margin:0;padding:28px;background:#efeaf2;font:14px/1.35 system-ui,-apple-system,sans-serif;color:#2b2340}}
h1{{margin:0 0 18px;font-size:22px}}.grid{{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;max-width:1400px}}
@media(max-width:900px){{.grid{{grid-template-columns:repeat(2,1fr)}}}}
figure{{margin:0;background:#fbf8fc;border-radius:14px;padding:8px;box-shadow:0 2px 10px rgba(43,35,64,.08)}}
img{{width:100%;aspect-ratio:9/16;object-fit:cover;border-radius:10px;display:block}}
figcaption{{display:flex;justify-content:space-between;align-items:baseline;padding:8px 4px 2px}}
figcaption span{{font-size:11px;letter-spacing:.08em;color:#6c6280}}small{{display:block;padding:0 4px 4px;color:#6c6280;font-size:12px}}</style>
<h1>Inkling · {group} · halls room</h1><div class="grid">{tiles}</div>""")
        print("Compare page:", page.resolve())
    print("\nOpen", (out_dir / "index.html").resolve())


if __name__ == "__main__":
    main()
