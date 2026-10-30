from api.room import centre_in_region, parse_sam
from api.style import SLOT_REGIONS, add_prompt, base_prompt


def test_parse_sam():
    text = "x <|box;x1=10;y1=20;x2=110;y2=220;w=1080;h=1920;c=0.9|> y"
    (box,) = parse_sam(text)
    assert box["x2"] == 110 and box["c"] == 0.9
    assert parse_sam("no boxes") == []


def test_fallback_regions_cover_room():
    box = {"x1": 800, "y1": 100, "x2": 900, "y2": 300, "w": 1080, "h": 1920}
    assert centre_in_region(box, "shelf")
    assert not centre_in_region(box, "bed")
    assert set(SLOT_REGIONS) == {"shelf", "desk", "wall", "floor", "bed"}


def test_prompts_are_json_with_identity():
    import json
    base = json.loads(base_prompt())
    assert base["visual_identity"]["medium"].startswith("ultra-detailed paper-cut")
    add = json.loads(add_prompt([{"object": "a kettlebell", "slot": "floor"}]))
    assert add["objects"][0]["location"] == "on the floor by the bed or desk"
