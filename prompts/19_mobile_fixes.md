# Mobile fixes from live play-testing (findyourinkling.com)

Each item was checked in a phone emulator against the live build. Fix all five, then run the checks at the end.

## A. The game must always fit the screen (first load, every browser)
Problem: on some phones the first screen is too tall or too wide, and the menu and sound buttons sit off screen.
Cause, confirmed: on mobile, `.app` is `position:fixed; left:50%; top:50%; transform:translate(-50%,-50%); width:100vw; height:100svh`. Browsers without `svh` support (older iOS/Android WebViews, and in-app browsers like X, Instagram and TikTok) drop the height. When that happens, `.app` collapses to 0 px tall at the vertical centre, and the menu button renders around y=344 instead of y=12. iOS can also keep a zoomed-in page after focusing an input under 16px (see B).
Fix:
1. Under `@media (max-width:640px)`, `.app` becomes `position:fixed; inset:0; width:auto; height:auto; transform:none; border-radius:0`. That means no viewport units at all on phones. Check that nothing inside relied on the transform (for example fixed-position children, or tags/popovers positioned against `.app`).
2. Desktop framing keeps its 9:16 box, but add `vh` fallbacks in front of every `svh` and `dvh` declaration (for example `height:calc(100vh - 48px); height:calc(100svh - 48px);`). Do the same for `.simpage` and the student card's `max-height`. Grep the CSS for `svh` and `dvh` and fix every one.
3. `html, body { position:fixed; inset:0; overflow:hidden; overscroll-behavior:none }` on the game route only. The /simulation and /built pages must still scroll.
4. Corner buttons (menu, sound, back) use `top: max(12px, env(safe-area-inset-top))`, with matching left and right insets. The bottom buttons use `env(safe-area-inset-bottom)`.
5. Viewport meta: `width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content`. Do not disable zoom.
6. Smaller issue seen at 390×664: during round 1 there's a strip of lavender `.app` background about 13px high under the room. The room must always reach the bottom edge, at every aspect ratio.
All icon placements stay exactly where they are now. Only the container sizing changes.

## B. "Add another subject": layout, scrolling and typed chips
Problems, confirmed:
- The suggestion chips render inside the `.other` flex row, which squeezes the text box to about 30px wide next to them.
- When the sheet grows, it slides up over the "Your subjects" title and the sound button.
- The sheet doesn't scroll, so anything below the input (the native datalist dropdown, the suggestions, the Continue button) can be cut off with no way to reach it.
- An added subject only appears as small text: "Added: Psychology".
Fix:
1. The input is always full width. Suggestion chips go in their own row below the input, wrapping, never beside it.
2. The input gets `font-size:16px` (stops iOS zooming in on focus, which also caused part of A).
3. The chip sheet gets a `max-height` that keeps it below the title and corner buttons (for example the space between the title bottom and the Continue area), with `overflow-y:auto` and `overscroll-behavior:contain`. When the input is focused, call `scrollIntoView({block:'center'})` after the keyboard opens (short delay, or on `visualViewport` resize) so the input and suggestions stay visible above the keyboard.
4. Remove the `<datalist>`, because the suggestion chips already do its job. Two lists of suggestions is confusing, and the native popup is what you couldn't scroll past.
5. A subject added by typing becomes a real chip at the start of the chip grid: selected, with the heart, the same style as the others, plus a small × to remove it. Delete the "Added: …" text.
6. To keep the grid the same size, each typed chip hides one of the built-in chips the player hasn't tapped (take the last untapped one in the list). If every built-in chip is tapped, the grid just grows and the sheet scrolls. Removing a typed chip brings the hidden built-in chip back.
7. Scoring must stay the same: typed subjects are passed exactly as they are now.

## C. Sticker info tags must stay on screen
Problem, confirmed at 360×640: tapping a sticker near the top or right edge opens its tag partly off screen. One tag's top was at y=-32, and another's right edge reached x=364 on a 360-wide screen. Tags also cover the "This is your room." banner.
Fix: after rendering, measure the tag and clamp it inside `.app` with a 12px margin. Width is `min(260px, app width - 24px)`. If there isn't room above the sticker, flip the tag below it. Keep a small pointer aiming at the sticker. While a tag is open, it sits above the finale banner (or the banner fades). This applies everywhere stickers can be tapped: the room during rounds, the finale and the reveal pages.

## D. Share page: let the preview be the room
Problem, confirmed: in the phone-shaped preview, the dark "What's your inkling? / subjects" box covers most of the room.
Fix: the preview shows only the finished room (the video's filled-room frame), with no text box over it. Show "What's your inkling?" and the subject list as normal text directly under the preview, above the buttons. Don't change the video itself: its end card with the subjects and URL stays. Make sure the whole share page, including "Start over" and the hint line, fits at 360×640 without scrolling. If it doesn't, shrink the preview.

## E. Checks (run one device per command, with the DEVICE env as before)
Sizes: 360×640, 375×667, 390×664 (iPhone with Safari bars), 390×844, 412×915.
1. Landing: menu and sound buttons fully on screen. `document.scrollingElement` is no bigger than the viewport in either direction.
2. No-svh test: in Playwright, intercept the CSS and replace `svh` with an invalid unit, e.g. `page.route('**/*.css', … text.replace(/(\d+)svh/g,'$1qqq'))`. Then repeat check 1. `.app` must fill the viewport and the menu must be at the top left.
3. Round 1: add a typed subject. The input stays full width, the suggestions appear below it, the typed chip appears first in the grid and one untapped built-in chip hides. Removing the typed chip brings the built-in one back. The sheet scrolls to Continue and never covers the title or sound button.
4. Finale: tap every sticker. Each tag's bounding box stays within the viewport, with the 12px margin.
5. Share page: the preview shows the room with no text over it, the subjects appear below it, and everything is visible at 360×640.
Screenshot each check and look at the screenshots before reporting. Then build, and give me the deploy command (I'll run it).
