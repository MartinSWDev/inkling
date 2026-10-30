"""House style for Inkling rooms: paper diorama (copied from scripts/style_explore.py)."""
import json

NEGATIVE = [
    "generic AI illustration", "plastic or glossy CGI rendering", "over-smooth airbrushed gradients",
    "oversaturated or neon colours", "HDR look", "lens flare", "text", "letters", "labels",
    "logos", "watermark", "border", "frame", "people", "faces",
]
DIORAMA = {
    "medium": "ultra-detailed paper-cut diorama, like a premium handmade storybook",
    "visual_language": ["layered paper depth with subtle shadows", "objects look like tiny paper "
                        "stickers with a thin white outline", "clean composition",
                        "whimsical but tidy", "fine paper texture"],
    "palette": "soft pastels: peach, lavender, powder blue, cream, sage",
    "lighting": "warm cosy lamp glow, soft depth of field",
}
HALLS_ROOM = {
    "scene": "a typical UK university halls of residence bedroom, lived in and personal, "
             "evening, warm desk lamp on",
    "layout": "front-on view of the back wall with one window in the middle; a single bed "
              "along the left wall with a duvet, throw and cushions; a desk with a desk "
              "chair along the right wall; two simple wall shelves above the desk; a "
              "pinboard on the wall; plain light walls and a simple wardrobe edge in view",
    "window_view": "a red-brick clock tower beside a slow river at dusk",
    "rules": ["every object fully visible, separated by clear space, not overlapping furniture",
              "every object belongs to the same physical world and style",
              "no armchair, no sofa, no rug in the middle",
              "realistic halls proportions: compact, a small room"],
    "format": "portrait 9:16",
}
SLOT_WORDS = {
    "shelf": "on the wall shelves above the desk",
    "desk": "on the desk",
    "wall": "on the wall beside the window",
    "floor": "on the floor by the bed or desk",
    "bed": "lying on the duvet",
}
# Rough box-centre regions (x, y in 0..1) for accepting fallback SAM labels.
SLOT_REGIONS = {
    "shelf": (0.50, 0.05, 1.00, 0.45),
    "desk": (0.50, 0.30, 1.00, 0.70),
    "wall": (0.00, 0.00, 1.00, 0.50),
    "floor": (0.00, 0.60, 1.00, 1.00),
    "bed": (0.00, 0.35, 0.55, 0.90),
}


def identity():
    return dict(DIORAMA)


def base_prompt():
    return json.dumps({
        "task": "illustrate this empty student room with no subject objects in it yet",
        "visual_identity": identity(), **HALLS_ROOM,
        "objects_by_location": {}, "negative": NEGATIVE,
    }, indent=1)


def add_prompt(cards):
    return json.dumps({
        "task": "add these objects to the room, keep everything else in the room exactly the same",
        "visual_identity": identity(),
        "objects": [{"object": c["object"], "location": SLOT_WORDS[c["slot"]]} for c in cards],
        "negative": NEGATIVE,
    }, indent=1)
