# Share video polish (it's the viral piece)

Frames reviewed from review_out/share-video-inkling.mp4. Fix, re-render, and save 8 frames (0.5, 2, 3.5, 5, 6.5, 8, 9, 9.8s) to review_out/video_frames/ for review.

1. End card: it prints the long encoded result URL as text, overflowing the frame. Never print the code. End card = the finished room (dimmed/blurred slightly) + "What's your inkling?" (Fraunces, big) + a short line "Find yours at <SHORT_DOMAIN>" where SHORT_DOMAIN comes from one config constant (placeholder "inkling.app" until we deploy). The full /r/<code> link goes in the share text/caption, not the video.
2. Wildcard card: long names overflow ("Counselling, psy…"). Wrap to max 3 lines and shrink the font to fit the card; same fitting for the top-3 cards and the share preview.
3. Hook in the first second: a caption on a paper tag at the top from 0.0–2.5s: "Filling my room with what I'm into…", and the first sticker lands by 0.6s (not an empty room for a second).
4. Top-3 cards in the video: include each subject's sticker on the left of its card (like the reveal page), bigger type, and stagger them in with the pop spring; keep them off the floor objects if possible (put them over the wall/window area instead).
5. Wordmark: "Inkling" top-left is tiny — make it a small paper label, readable at phone size.
6. Keep total length 10s; the final frame (end card) holds ≥1.2s so it's readable when the video loops.
