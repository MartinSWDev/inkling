"""Apply data/subject_card_overrides.json to data/subject_cards.json (keeps Spark's originals under 'spark').
Run after scripts/subject_cards.py:  python scripts/apply_card_overrides.py"""
import json
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
cards_path = ROOT / "data" / "subject_cards.json"
data = json.loads(cards_path.read_text())
over = json.loads((ROOT / "data" / "subject_card_overrides.json").read_text())["overrides"]
n = 0
for c in data["cards"]:
    o = over.get(c["code"])
    if not o:
        continue
    c.setdefault("spark", {})
    for k, v in o.items():
        c["spark"].setdefault(k, c.get(k))
        c[k] = v
    n += 1
data["overrides_applied"] = n
cards_path.write_text(json.dumps(data, indent=1, ensure_ascii=False))

seen = defaultdict(list)
for c in data["cards"]:
    seen[c["sam_labels"][0].lower()].append(c["display_name"])
print(f"Applied {n} overrides.")
for k, v in seen.items():
    if len(v) > 1:
        print(f"  shared first SAM label '{k}': {', '.join(v)}")
