# Polish 13 (user playthrough). Fresh session OK — everything needed is here.

Speed rules: after each group run only build + tests + one 390×844 screenshot of the changed screen. Run the full mobile check once at the end, one device per command: DEVICE=iphone13|iphone-se|pixel7|desktop (add the DEVICE env var to web/scripts/mobile_check.ts if it isn't there; share-video step only for iphone13). No dark-mode captures. Commit after each group.

## A. Icons: use Lucide everywhere
Add lucide-react and replace every hand-drawn/emoji/text icon with Lucide, one consistent stroke width (2) and size scale: sound (Volume2 / VolumeX), heart (Heart, filled when favourited), tick (Check), ✕ (X), ★ (Star or Sparkles for "Tell me more"), arrows in the hint row (ArrowLeft / ArrowRight / ArrowUp), share (Share2), copy link (Link), save (Download), close (X), back/next (ChevronLeft / ChevronRight), start over (RotateCcw), external links (ExternalLink). Icons inherit currentColor; buttons keep their aria-labels.

## B. Subject chips with long names
Long names collide with the fixed-width heart. Chip layout: tick on the LEFT (only shown when selected, reserving its space so text doesn't jump), label in the middle allowed to wrap onto 2 lines (`overflow-wrap:anywhere; hyphens:auto;` and lang="en-GB" on <html>), heart on the RIGHT as its own 44px target. Chip height grows to fit 2 lines; no ellipsis, no overlap. Test with "Art & Design", "Languages", and a typed long subject like "Computer games and animation".

## C. Objects land at the END of each round (no mid-round layout shift)
Stop stickers appearing while cards are being answered (rounds 2–4) and while chips are tapped (round 1 already waits). Collect what each action earned; on Continue/round end, the controls fold away and all of that round's new objects drop in with a stagger (pentatonic pops), then the "+N in your room" tag, then the next round. Room rules (caps, stability) unchanged; update the vitest cases that assumed per-action placement.

## D. Fact note overlaps the question
In round 4 the "Did you know?" note covers the "Would you want to find out?" tag. Place the fact note directly BELOW the question tag (push it down by the tag's height + 8px), or temporarily replace the tag's text with the fact for 3s and fade back. Never overlapping.

## E. Sticker tag hidden behind the finale caption
On "This is your room." tapping an object shows its subject tag BEHIND the caption. Tags must sit above everything in the room layer and above captions (z-index), and reposition below the sticker if they'd collide with the caption at the top.

## F. City view is wrong
web/public/views/city_dusk.webp is a picture of the ROOM (the generator used room.png as reference and Muse Image redrew the room), and city_day looks like a small clock-tower town, not a city. Regenerate both with /v1/images/generations (NOT edits, no reference image), same paper-diorama identity and the same 768×1297 portrait framing as the other views: a proper UK city view from a high window — terraced streets and rooftops in the foreground, taller modern and Victorian buildings, a few cranes, a river with a bridge, distant tower blocks; day = soft daylight, dusk = warm sky with lit windows. No people's faces, no text or signs. Look at all 8 view images side by side afterwards (save review_out/views_sheet.png) and confirm each is the right scene and none shows a room or window frame. Rebuild the views thumbnails.

## G. Landing on desktop
Replace the dark plum gradient backdrop behind the phone frame with a solid light paper colour (e.g. #F3EDE4, slightly darker than the frame's paper so the frame still reads). On desktop only (hidden below 700px wide), stickers gently "rain" down the empty space left and right of the frame: a dozen random stickers at a time, slow fall (8–14s), slight sway and rotation, low opacity (0.85), behind the frame, paused when prefers-reduced-motion. Keep it light — not a screensaver. Mobile shows nothing extra.

## H. Share video layout
In the video the subject text sits in the wrong place and the three subject cards aren't aligned (different heights/positions). Fix the top-3 sequence: three cards identical in width and height, left-aligned to the same x, evenly spaced on a fixed grid in the lower third, sticker in a fixed-size square on the left of each card, name vertically centred beside it (wrap/shrink to fit, never outside the card). The wildcard card and end card text centred. Save frames at 0.3, 1.5, 3, 4.5, 6, 7.5, 8.8, 9.7s to review_out/video_frames/ and check alignment by eye before reporting.
