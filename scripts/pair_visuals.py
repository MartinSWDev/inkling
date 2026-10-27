"""
Pick the visuals for the round-4 "this or that" pairs.

For every side of every pair in data/pairs.json:
  - the two scene ideas already in the file (image, image_alt)
  - one extra idea from Muse Wonder, asked to make the concept readable at a glance
Each is rendered in the paper-diorama style and laid out as phone cards.

Run from the repo root:
  python scripts/pair_visuals.py              # all five pairs
  python scripts/pair_visuals.py why_vs_make  # just one
Then open pair_out/index.html. Re-runs reuse images; delete one to redo it.

Cost: 5 Wonder calls + 30 images (about $0.35).
"""
import json
import os
import re
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from image_check import client, post_json, save_b64  # noqa: E402
from style_explore import NEGATIVE, STYLES, identity  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
PAIRS = json.loads((ROOT / "data" / "pairs.json").read_text())["pairs"]
OUT = ROOT / "pair_out"
STYLE = identity(STYLES["diorama"])
NO_SEARCH = {"enable_image_search": False, "enable_web_search": False}


def wonder_ideas(pair):
    """Ask Muse Wonder for one more scene per side, cached in pair_out/<id>/wonder.json."""
    cache = OUT / pair["id"] / "wonder.json"
    if cache.exists():
        return json.loads(cache.read_text())
    prompt = (
        "We are designing a 'this or that' card for 16-18 year olds choosing what to study. "
        "They tap whichever picture feels more like them. Each side is one illustrated scene, "
        "no people's faces, no text or letters anywhere, readable in one second at phone size.\n\n"
        f"Side A: \"{pair['a']['label']}\" ({pair['a']['caption']})\n"
        f"Side B: \"{pair['b']['label']}\" ({pair['b']['caption']})\n\n"
        f"Existing ideas for A: {pair['a']['image']} / {pair['a']['image_alt']}\n"
        f"Existing ideas for B: {pair['b']['image']} / {pair['b']['image_alt']}\n\n"
        "Propose ONE new scene for each side that shows the idea more instantly than the existing ones. "
        "Use concrete objects and settings a teenager recognises, a clear focal point, and make A and B "
        "look obviously different from each other. Hands are fine; faces are not. "
        "Return JSON only: {\"a\": \"<scene>\", \"b\": \"<scene>\"}")
    model = "muse-wonder-1.0"
    try:
        r = client.chat.completions.create(model=model, messages=[{"role": "user", "content": prompt}])
    except Exception as e:  # Wonder is in preview; fall back to Spark rather than stop
        print(f"  Wonder unavailable ({e}); using Spark")
        model = "muse-spark-1.3"
        r = client.chat.completions.create(model=model, messages=[{"role": "user", "content": prompt}])
    text = r.choices[0].message.content
    ideas = json.loads(re.search(r"\{.*\}", text, re.S).group(0))
    ideas["model"] = model
    cache.parent.mkdir(parents=True, exist_ok=True)
    cache.write_text(json.dumps(ideas, indent=2))
    return ideas


def render(job):
    path, scene = job
    if path.exists():
        return
    r = post_json("/images/generations", {
        "model": "muse-image-1.0", "n": 1, "size": "1536x1024", "output_format": "png",
        "tool_enablement": NO_SEARCH,
        "prompt": json.dumps({
            "task": "one card illustration for a 'this or that' choice",
            "visual_identity": STYLE,
            "scene": scene,
            "composition": "one clear focal point in the centre, simple uncluttered background, "
                           "readable at small size",
            "rules": ["no text, letters or numbers anywhere", "no faces; hands are fine"],
            "negative": NEGATIVE})})
    save_b64(r["data"][0], path)
    print("  rendered", path.relative_to(ROOT))


def main():
    wanted = sys.argv[1:]
    pairs = [p for p in PAIRS if not wanted or p["id"] in wanted]
    jobs, plan = [], []
    for p in pairs:
        print(f"{p['id']}: asking for extra ideas")
        w = wonder_ideas(p)
        d = OUT / p["id"]
        d.mkdir(parents=True, exist_ok=True)
        sides = {}
        for side in ("a", "b"):
            opts = [("1", p[side]["image"]), ("2", p[side]["image_alt"]), ("W", w[side])]
            if p[side].get("image_redo"):
                opts.append(("4", p[side]["image_redo"]))
            sides[side] = [(f"{side}{n}.png", scene, n) for n, scene in opts]
            jobs += [(d / f, scene) for f, scene, _ in sides[side]]
        plan.append((p, sides, w.get("model", "")))
    with ThreadPoolExecutor(max_workers=4) as pool:
        list(pool.map(render, jobs))

    blocks = []
    for p, sides, model in plan:
        cols = "".join(f"""<div class="opt"><div class="phone">
<figure><img src="{p['id']}/{a[0]}"><figcaption><b>{p['a']['label']}</b><span>{p['a']['caption']}</span></figcaption></figure>
<div class="or">or</div>
<figure><img src="{p['id']}/{b[0]}"><figcaption><b>{p['b']['label']}</b><span>{p['b']['caption']}</span></figcaption></figure>
</div><p class="tag">Option {a[2] if a[2] != 'W' else 'W (' + model + ')'}{' ✓' if (p['a'].get('chosen', {}).get('file', '').endswith(a[0]) or p['b'].get('chosen', {}).get('file', '').endswith(b[0])) else ''}</p>
<details><summary>scenes</summary><p>A: {a[1]}</p><p>B: {b[1]}</p></details></div>"""
                       for a, b in zip(sides["a"], sides["b"]))
        blocks.append(f"<section><h2>{p['a']['label']} · {p['b']['label']}</h2>"
                      f"<p class='data'>{p['data']}</p><div class='row'>{cols}</div></section>")
    (OUT / "index.html").write_text(f"""<!doctype html><meta charset="utf-8"><title>Inkling pair visuals</title>
<style>*{{box-sizing:border-box}}body{{margin:0;padding:28px;background:#efeaf2;font:14px/1.35 system-ui,-apple-system,sans-serif;color:#2b2340}}
h1{{margin:0 0 6px;font-size:22px}}h2{{margin:30px 0 2px;font-size:18px}}.data{{margin:0 0 12px;color:#6c6280;font-size:12px}}
.row{{display:grid;grid-template-columns:repeat(4,minmax(0,280px));gap:20px}}
@media(max-width:900px){{.row{{grid-template-columns:1fr}}}}
.phone{{background:#fbf8fc;border-radius:22px;padding:10px;box-shadow:0 4px 18px rgba(43,35,64,.12)}}
figure{{margin:0;border-radius:14px;overflow:hidden;background:#fff}}img{{width:100%;aspect-ratio:3/2;object-fit:cover;display:block}}
figcaption{{padding:8px 10px}}figcaption b{{display:block;font-size:15px}}figcaption span{{color:#6c6280;font-size:12px}}
.or{{text-align:center;font-size:11px;letter-spacing:.15em;text-transform:uppercase;color:#6c6280;padding:6px}}
.tag{{margin:8px 4px 2px;font-weight:600}}details{{font-size:12px;color:#6c6280;margin:0 4px}}details p{{margin:4px 0}}</style>
<h1>Inkling · round 4 visuals</h1><p>Options 1 and 2 from pairs.json; W is Muse's extra idea. Pick the clearest per pair.</p>
{''.join(blocks)}""")
    print("\nOpen", (OUT / "index.html").resolve())


if __name__ == "__main__":
    main()
