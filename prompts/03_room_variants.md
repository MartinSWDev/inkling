# Room variants + recolouring so not every room looks the same

Do this AFTER the sticker full run. Stickers don't depend on the room, so nothing is redone.

## 1. Variants — `scripts/build_variants.py`
- Start from `web/public/room/room.png` (variant `v0`). Make ~5 more with Muse Image edits of v0, one change set each, always ending with: "keep the exact same camera, room shape, window position and size, wall shelves, and the bed and desk in the same places and sizes; same cut-paper style". Ideas:
  - v1 metal-frame bed with a striped duvet, round rug
  - v2 wooden bed with a patchwork quilt, desk with a drawer unit, string lights
  - v3 divan bed with a plain duvet, white desk, sash window painted green
  - v4 bunk-free low bed with throw pillows, dark wood desk, plant on the floor corner
  - v5 bed with a headboard, fold-down wall desk... (pick changes that keep the footprints)
- Window: re-key the glass for every variant (magenta in the edit prompt, like room.png) → RGBA `room/<v>.png` + webp.
- Spots: run SAM 3.1 on each variant for "bed", "desk", "wall shelf" (and "pinboard"/"board" if present). Shift each spot's anchor by the offset between v0's and the variant's boxes; if a surface moved more than ~8% or SAM misses it, flag the variant. Write `room/layout.json` as `{variants: {v0: {spots...}, v1: {...}}}`.
- Reject a variant if the window box moved more than ~2% (views must still fit) — re-roll it.
- Contact sheet `variant_out/index.html`: each variant with its spots drawn, and the same 8 stickers composited into each.

## 2. Recolouring — SAM masks, applied in the browser
- For each variant, SAM 3.1 masks: "wall", "duvet" (or "bedding"), "rug" (if present), "curtains" (if present). Decode the masks to PNG alpha (`room/<v>_mask_<part>.png`, downscaled 50% is fine).
- Define ~6 palettes in `web/src/palettes.ts` (e.g. sage, peach, lilac, sky, butter, charcoal-night), each giving a colour per part.
- Client applies a palette by drawing the room, then each part's mask filled with the palette colour using `multiply`/`color` blend on a canvas (or CSS mask-image + mix-blend-mode), keeping the paper texture. Must stay instant (<1 frame after load).

## 3. In the game
- New player: random variant + random palette (seeded, stored in the result so the share image matches).
- Reveal "Make it yours" page (merge with the view page): pick palette swatches, view and day/dusk; changes are instant.
- Paint my room uses the current composite, so it inherits the variant and palette.

## Done when
- 6 variants pass the spot/window checks; the contact sheet looks consistent; palette swaps are instant on a phone.
- Commit after each part.
