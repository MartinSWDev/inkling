"""
Inkling smoke test: one call each to Muse Spark, Muse Image and SAM 3.1.

Run from the repo root:  python scripts/smoke_test.py
Needs MODEL_API_KEY in a .env file (and .env in .gitignore).

Step 3 follows the SAM "Segmenting with prompts" docs:
https://dev.meta.ai/docs/sam/segmenting
To re-run only step 3, the image from step 2 is reused if it already exists.
"""
import base64
import os
import re
import sys
from pathlib import Path

from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()
key = os.environ.get("MODEL_API_KEY")
if not key:
    sys.exit("MODEL_API_KEY is missing. Add it to .env in the repo root.")

client = OpenAI(base_url="https://api.meta.ai/v1", api_key=key)
out = Path("smoke_out")
out.mkdir(exist_ok=True)


def step(name):
    print(f"\n--- {name} ---")


def parse_sam_boxes(text):
    """SAM returns special-token text, one record per match, e.g.
    <0f>0<|box;x1=181;y1=365;x2=556;y2=486;w=1516;h=1600|><|mask;...|>
    This pulls out each box as a dict of numbers. Masks are ignored here."""
    boxes = []
    for chunk in re.findall(r"<\|box;([^|]*)\|>", text):
        b = {}
        for pair in chunk.split(";"):
            if "=" in pair:
                k, v = pair.split("=", 1)
                try:
                    b[k] = float(v) if "." in v else int(v)
                except ValueError:
                    b[k] = v
        boxes.append(b)
    return boxes


# 1. Muse Spark 1.3: text. Proves the key, billing and base URL.
step("1. Muse Spark 1.3")
try:
    r = client.chat.completions.create(
        model="muse-spark-1.3",
        messages=[{
            "role": "user",
            "content": "Name one physical object a marine biology student "
                       "might keep in their bedroom. Reply in under 10 words.",
        }],
    )
    print("OK:", r.choices[0].message.content.strip())
except Exception as e:
    sys.exit(f"FAILED: {e}\nFix this before going further (key, billing, or base URL).")


# 2. Muse Image 1.0: one image. Confirms whether you get base64 or a URL.
step("2. Muse Image 1.0")
image_path = out / "tank.png"


def generate_image():
    img = client.images.generate(
        model="muse-image-1.0",
        prompt=("Soft gouache illustration, warm lamp light. A small fish tank "
                "with a blue light on a wooden shelf, plain background. "
                "No text, no logos."),
    )
    item = img.data[0]
    if getattr(item, "b64_json", None):
        image_path.write_bytes(base64.b64decode(item.b64_json))
        print(f"OK: saved base64 image to {image_path}")
    elif getattr(item, "url", None):
        print(f"OK: got a signed URL (download it before it expires):\n{item.url}")
    else:
        print("Got a response, but no b64_json or url. Raw:", item)


if image_path.exists():
    print(f"SKIPPED: reusing {image_path} (delete it to generate a new one)")
else:
    try:
        generate_image()
    except Exception as e:
        print(f"FAILED: {e}")


# 3. SAM 3.1: find the fish tank in the image from step 2.
step("3. SAM 3.1")
if not image_path or not image_path.exists():
    print("SKIPPED: no local image from step 2. If you got a URL, download it "
          "to smoke_out/tank.png and run again.")
else:
    # Images go inline as a base64 data URL (the files endpoint is for video).
    # The prompt must be a short noun phrase naming ONE thing.
    try:
        data_url = "data:image/png;base64," + base64.b64encode(image_path.read_bytes()).decode()
        seg = client.responses.create(
            model="sam-3.1",
            input=[{
                "type": "message",
                "role": "user",
                "content": [
                    {"type": "input_text", "text": "fish tank"},
                    {"type": "input_image", "image_url": data_url},
                ],
            }],
            metadata={"include_confidence": "true"},
        )
        text = seg.output_text or ""
        boxes = parse_sam_boxes(text)
        if not boxes:
            print("OK, but no matches (an empty result is a normal answer, not an error).")
        for b in boxes:
            print(f"OK: box x1={b['x1']} y1={b['y1']} x2={b['x2']} y2={b['y2']} "
                  f"in a {b['w']}x{b['h']} image"
                  + (f", confidence {b['c']}" if "c" in b else ""))
        print("Raw (first 300 chars):", text[:300])
    except Exception as e:
        print(f"FAILED: {e}")

print("\nDone. Outputs are in", out.resolve())
