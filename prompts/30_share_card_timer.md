# 30 · Share the inkling card from the share page; live feed timer ticks from the click

## A. Share page: "Share image" is back, sharing the inkling card

`web/src/App.tsx` share page row becomes: **Share video · Share image · Download video · Copy text · Start over** (wrap to two lines if needed; `.row` already wraps).

"Share image" (`ImageIcon` or `Share2` icon) builds the inkling card with the existing `composeInklingCard` (pal if ready, sticker, subject, plain, inkling text, provider footer, URL pill) and shares it exactly as "Share my inkling" does on the inkling page: `navigator.share({ files, text })` when files can be shared, otherwise `download(canvas, "my-inkling.png")` plus copying the text and a tip "Image saved — post it from your phone." If the inkling text has not arrived yet, build the card without the text (hero only) rather than disabling the button. Factor the card-share handler into one function used by both pages so they can't drift.

Keep the pal-in-the-room share image code (`composeRoomCanvas(..., palUrl)` → `imageRef`) but it is no longer wired to a button; leave it for the video thumbnail use later.

## B. Live student feed: timer starts on the click

`web/src/Simulation.tsx`: the `thinking · N s` counter only updates when `@@think` events arrive, so when the stream is buffered (local dev) or the model is slow to start, it sits at 0. Start a client-side interval the moment the button is pressed (`t0 = Date.now()`, tick every 250 ms into a `liveElapsed` state), show `N s` on the current status row from that timer whether or not any `think` event has arrived, and keep the reasoning-token count from the latest `think` event beside it when present. Stop the interval on `done` or `error`. Also use `t0` for the row timestamps so they reflect when each row was added client-side.

Checks: build and tests pass; share page shows the five buttons and Share image produces the 1080×1920 card; on `/simulation` the seconds count up immediately after clicking Run a live student. Report files changed.

## C. Next pill label on the inkling page

The Next pill on the inkling page currently says "Share", which reads as the share action for the card. Change the label logic to: explore page → "Your inkling", inkling page → "Next", everything else → "Next". Also move the `.inklingshare` row **above** the credit line (`.inklingtag`) so the two buttons sit directly under the text, and give them `btn alt` (Share my inkling) and `btn` (Save image) at full width on narrow screens (`flex:1 1 140px`).
