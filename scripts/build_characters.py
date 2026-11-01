"""
Inkling's scrunched-paper pals, drawn with Muse Image and cut out (Meta Model API credits, ~1p per image).

A pal is a crumpled ball of paper with a little ink face, stubby paper arms and legs, and a curl of ink
on top. The PAPER tells you the subject: graph paper (maths/physics/engineering), manuscript (music, drama,
dance), blueprint (architecture), parchment (history), map (geography), watercolour (art & design),
lab notebook (sciences, medicine, psychology), yellow legal pad (law, business, social sciences),
green-striped printout (computing), brown kraft (agriculture, vets), lined notebook (everything else).

Step 1 — pick the look (4 renders of the default lined-paper pal):
  python scripts/build_characters.py --base
  open char_out/index.html, choose 1-4
Step 2 — make every paper type from your pick, cut out on transparency:
  python scripts/build_characters.py --variants --pick 2
Outputs web/public/characters/<paper>.webp (+ characters.json). Re-runs skip files that exist;
delete one to redo it. --only graph redoes a single paper.
"""
import json
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from api.room import NO_SEARCH, client, data_url, parse_sam, post_json, save_b64  # noqa: E402
from api.style import DIORAMA  # noqa: E402

OUT = ROOT / "char_out"
PUB = ROOT / "web" / "public" / "characters"

PAPERS = {
    "lined": ("a page of white lined notebook paper with pale blue lines and a pink margin line", "everything else (default)"),
    "graph": ("pale green graph paper with a fine square grid", "maths, physics, engineering, economics"),
    "manuscript": ("cream music manuscript paper with staff lines and a few hand-drawn notes", "music, drama, dance"),
    "blueprint": ("a deep blue architectural blueprint with fine white grid and line drawings", "architecture, building, planning"),
    "parchment": ("aged golden parchment with soft brown edges", "history, classics, philosophy, theology"),
    "map": ("a printed map with pastel land, blue rivers and contour lines (no words)", "geography, earth and environmental sciences"),
    "watercolour": ("thick white watercolour paper with soft splodges of pastel paint", "art, design, photography"),
    "lab": ("a squared lab notebook page with a faint coffee ring", "sciences, medicine, health, psychology"),
    "legal": ("a yellow legal pad page with thin blue lines and a red margin", "law, business, social sciences, politics"),
    "printout": ("old green-and-white striped computer printout paper with tractor-feed holes down the sides", "computing, AI, software"),
    "kraft": ("brown kraft paper with natural fibres", "agriculture, animal science, vets, food"),
}
NEG = [n for n in ("plastic or glossy CGI rendering", "oversaturated or neon colours", "text", "letters", "words",
                   "logos", "watermark", "border", "frame", "realistic human", "shadow on the background")]


def pal_prompt(paper_desc, variant_note=""):
    return json.dumps({
        "task": "one original mascot character, full body, isolated, centred, for a cut-out sticker",
        "visual_identity": {**DIORAMA, "lighting": "soft even studio light, gentle paper shading"},
        "character": ("a small, cute character made from a scrunched-up ball of " + paper_desc + ": crumpled facets "
                      "and creases all over its round body, a simple happy face drawn in ink on the paper (two curved "
                      "closed-eye smiles or dot eyes, small smile, pink blush), short rolled-paper arms and legs, and a "
                      "single curl of dark ink rising from the top like a little tuft. Friendly, readable at small size. "
                      + variant_note),
        "composition": "front view, whole character in frame with a wide margin, standing upright",
        "background": "flat solid pure green #00FF00, nothing else, no ground shadow",
        "negative": NEG})


def render(path, body):
    if path.exists():
        return
    r = post_json(body.pop("_endpoint"), body)
    save_b64(r["data"][0], path)
    print("  rendered", path.relative_to(ROOT))


def key_green(src, dst, max_side=640):
    im = Image.open(src).convert("RGBA")
    a = np.asarray(im).astype(np.float32)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    green = (g - np.maximum(r, b))  # how much greener than the other channels
    alpha = np.clip(255 - (green - 40) * 4, 0, 255)
    alpha[green < 40] = 255
    # despill: pull green down towards the other channels on edge pixels
    spill = (green > 0) & (alpha > 0)
    a[..., 1] = np.where(spill, np.maximum(r, b) + np.minimum(green, 20) * 0.2, g)
    a[..., 3] = alpha
    out = Image.fromarray(a.astype(np.uint8), "RGBA")
    m = out.split()[3].filter(ImageFilter.MinFilter(3))  # erode 1px to lose the rim
    out.putalpha(m)
    bbox = m.point(lambda v: 255 if v > 20 else 0).getbbox()
    if not bbox:
        raise RuntimeError(f"{src.name}: nothing left after keying")
    out = out.crop(bbox)
    out.thumbnail((max_side, max_side), Image.LANCZOS)
    out.save(dst, "WEBP", quality=90)
    edge = (bbox[0] <= 2 or bbox[1] <= 2 or bbox[2] >= im.width - 2 or bbox[3] >= im.height - 2)
    return out.size, edge


def sam_present(path):
    seg = client().responses.create(model="sam-3.1", input=[{"type": "message", "role": "user", "content": [
        {"type": "input_text", "text": "crumpled paper ball"}, {"type": "input_image", "image_url": data_url(path)}]}],
        metadata={"include_confidence": "true"})
    boxes = [b for b in parse_sam(seg.output_text or "") if b.get("c", 1) >= 0.4]
    return max((b.get("c", 0) for b in boxes), default=0)


def page(title, items):
    cells = "".join(f'<figure><img src="{src}"><figcaption>{cap}</figcaption></figure>' for src, cap in items)
    (OUT / "index.html").write_text(f"""<!doctype html><meta charset="utf-8"><title>{title}</title>
<style>body{{margin:0;padding:24px;background:#F3EDE4;font:14px system-ui;color:#2A2238}}h1{{font:600 22px Georgia}}
.g{{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:16px}}
figure{{margin:0;background:repeating-conic-gradient(#eee 0 25%,#fff 0 50%) 0 0/20px 20px;border-radius:14px;padding:10px;text-align:center}}
img{{max-width:100%;max-height:260px}}figcaption{{background:#FBF6EE;border-radius:8px;padding:6px;margin-top:6px}}</style>
<h1>{title}</h1><div class="g">{cells}</div>""")
    print("Open", (OUT / "index.html").resolve())


def main():
    OUT.mkdir(exist_ok=True)
    PUB.mkdir(parents=True, exist_ok=True)
    if "--base" in sys.argv:
        notes = ["", "Slightly taller than wide.", "Very round, chunky creases.", "Waving one arm."]
        jobs = [(OUT / f"base_{i}.png", {"_endpoint": "/images/generations", "model": "muse-image-1.0", "n": 1,
                 "size": "1024x1024", "output_format": "png", "tool_enablement": NO_SEARCH,
                 "prompt": pal_prompt(PAPERS["lined"][0], notes[i - 1])}) for i in range(1, 5)]
        with ThreadPoolExecutor(max_workers=4) as pool:
            list(pool.map(lambda j: render(*j), jobs))
        page("Inkling pal — pick a base (1-4)", [(f"base_{i}.png", f"Option {i}") for i in range(1, 5)])
        print("Cost so far: ~4 images. Next: python scripts/build_characters.py --variants --pick <1-4>")
        return

    if "--variants" in sys.argv:
        pick = int(sys.argv[sys.argv.index("--pick") + 1])
        ref = OUT / f"base_{pick}.png"
        if not ref.exists():
            sys.exit(f"{ref} not found — run --base first")
        only = sys.argv[sys.argv.index("--only") + 1] if "--only" in sys.argv else None
        papers = [p for p in PAPERS if not only or p == only]
        jobs = []
        for p in papers:
            body = {"_endpoint": "/images/edits", "model": "muse-image-1.0", "n": 1, "size": "1024x1024",
                    "output_format": "png", "tool_enablement": NO_SEARCH, "images": [{"image_url": data_url(ref)}],
                    "prompt": json.dumps({
                        "task": "redraw this exact character design (same shape, face, pose, proportions, arms, legs and ink "
                                "tuft) but made from a different paper",
                        "paper": PAPERS[p][0], "background": "flat solid pure green #00FF00, nothing else",
                        "keep": "same character, same framing and size, same paper-craft style", "negative": NEG})}
            jobs.append((OUT / f"{p}.png", body))
        with ThreadPoolExecutor(max_workers=4) as pool:
            list(pool.map(lambda j: render(*j), jobs))
        meta, items = {}, []
        for p in papers:
            src = OUT / f"{p}.png"
            dst = PUB / f"{p}.webp"
            size, edge = key_green(src, dst)
            conf = sam_present(src)
            meta[p] = {"file": f"/characters/{p}.webp", "w": size[0], "h": size[1], "subjects": PAPERS[p][1],
                       "sam_confidence": round(conf, 2)}
            flag = (" — touches edge, redo" if edge else "") + (" — SAM unsure" if conf < 0.5 else "")
            items.append((f"../web/public/characters/{p}.webp", f"{p}: {PAPERS[p][1]} (SAM {conf:.2f}){flag}"))
            print(f"  {p}: {size} SAM {conf:.2f}{flag}")
        if not only:
            (PUB / "characters.json").write_text(json.dumps({
                "about": "Scrunched-paper pals drawn by Muse Image (muse-image-1.0), cut out and checked with SAM 3.1.",
                "base_pick": pick, "papers": meta}, indent=1))
        page("Inkling pals — every paper", items)
        return
    print(__doc__)


if __name__ == "__main__":
    main()
