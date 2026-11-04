# 27 · Share the inkling page; download the video

Two changes in `web/src/App.tsx` (share page buttons ~line 820–860; inkling page from prompt 23), plus a new helper in `web/src/Room.tsx` and a little CSS in `web/src/styles.css`. Reuse `shareMessage` from `share.ts`, `download` and the `loadImg`/canvas pattern from `Room.tsx`. Nothing else changes.

## A. Share page buttons

Replace the three-button row with:
1. **Share video** — unchanged behaviour (share sheet with the file + text; falls back to download where files can't be shared).
2. **Download video** — new, `Download` icon: always saves the cached video blob (`videoRef.current`) as `inkling.<ext>` with the `a.download` pattern already used in the fallback, then copies the share text to the clipboard and shows the tip "Video saved — post it from your phone or upload it to Instagram." Disabled while `videoStatus !== "ready"`.
3. **Copy text** — unchanged.
Remove the **Share image** button and its handler (keep `composeRoomCanvas` and `imageRef`; they are used by the inkling share below). Keep **Start over**. The `.sharehint` note text stays.

## B. Share the inkling page

Add `composeInklingCard(opts: { palUrl?: string; stickerCode: string; subject: string; plain: string; text: string; provider: "baseten" | "meta" | null }): Promise<HTMLCanvasElement>` to `Room.tsx`: a 1080×1920 PNG in the same paper style as `composeRoomCanvas` (paper background `#FBF6EE` with the grain image, ink `#2A2238`, accent `#E59A2C`, Fraunces 900 for the subject, Figtree for body; fonts are already loaded on the page, so `ctx.font` with those family names works). Layout top to bottom: small eyebrow "My inkling" (Figtree 600, 40px, muted), the pal image 640×640 centred with 28px radius (skip if no `palUrl`), subject name (Fraunces 900, 96px, wrapped), plain description (Figtree 400, 40px, muted, wrapped), the inkling text (Figtree 400, 44px, wrapped to 900px, line height 1.4), then a footer: "Written live by Muse Spark Open on Baseten · pal drawn by Muse Image" (or "…by Muse Spark via the Meta Model API"), and the pill "findyourinkling.com". Write a small `wrapText(ctx, text, maxWidth)` helper. Draw the sticker (`/stickers/{code}.webp`, 160px) at the top-left of the subject name block.

On the inkling page (`.inklingpc`), once the text is done (`liveInkling.done`), show a `.row` under the tag with:
- **Share my inkling** (`Share2` icon): build the card, `toBlob` PNG, `navigator.share({ files, text })` where `text` is `My inkling on Inkling 🏠: {subject}. {first sentence of the inkling text} Find your inkling: https://www.findyourinkling.com`; if files can't be shared, `download(canvas, "my-inkling.png")` and copy the text.
- **Save image** (`Download` icon): `download(canvas, "my-inkling.png")`.
Both work when the pal failed (no image). Hide the row entirely if the text failed. Keep the page fitting 390×700: the row is 2 buttons in one line; shrink the pal column to 96px under `@media(max-height:700px)` if needed.

## C. Checks

`npm --prefix web run build`, `npm --prefix web test` pass. Under `wrangler pages dev`: the share page shows Share video / Download video / Copy text / Start over; Download video saves a file; the inkling page shows the two buttons after the text finishes and Save image produces a 1080×1920 PNG with the pal, subject, text and footer. Report the files changed and attach nothing.
