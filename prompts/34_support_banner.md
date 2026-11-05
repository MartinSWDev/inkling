# 34 · "Support it on X" line on the share page

Small UI addition in `web/src/App.tsx` (share page, under the share buttons' `.sharehint` note) and `web/src/styles.css`. Nothing else.

- Add a dismissible `.supportline` below the share hint:
  `Found this useful? It's up for a hackathon prize decided partly on X. A like or repost on the launch post helps a lot.` followed by a small button-styled link **Open the post** (`https://x.com/MartinSWDev/status/2118059722070790600`, `target="_blank" rel="noreferrer"`, `ExternalLink` icon) and an `×` dismiss button (aria-label "Hide this").
- Dismiss hides it for the session and remembers it in `localStorage["inkling.support.hidden"]` (wrap every read/write in try/catch; if storage throws, the line still renders and dismiss just hides it in state).
- Style: paper card like `.note`, 13px, muted ink, lilac left border (`3px solid var(--lilac)`), 10px padding, margin-top 10px, flex row that wraps on narrow screens; the link is a `btn ghost` at 13px. It must not push the share buttons off a 390×700 screen: if the share page already measures `scrollHeight > clientHeight` at that size with the line shown, drop the line's text to the first sentence only under `@media (max-height: 720px)`.
- No tracking, no new dependencies.

Checks: build and tests pass; at 390×700 the share page still fits; the line disappears on × and stays hidden after a reload. Report files changed.
