# Playtest 5 fixes (user's own playthrough). Do in order, commit after each, review against the prompts/06 checklist.

## A. Swipe drag on desktop (confirmed cause)
Dragging a card on desktop drags the IMAGE (the browser's native image drag), not the card. The card art <img> (CardArt in App.tsx, and pair images) has no draggable={false}.
- Add draggable={false} and onDragStart={e => e.preventDefault()} to every <img> in cards/pairs/stickers, plus `-webkit-user-drag:none; pointer-events:none` on .card img.
- Expected behaviour (confirm in the capture with a mouse drag): pressing on the card and moving moves the card with the pointer, rotating as it goes, the Yes/Not for me stamp fading in; releasing past the threshold flicks it out, otherwise it springs back.

## B. No jumps when the quiz starts
1. The window view changes when the first round starts (the intro/unfold shows one view, the round shows another). Pick the view and day/dusk once (see C) and use the same view from the unfold onwards — never swap it unless the player changes it.
2. The room zooms in when the quiz starts (framing change between intro and round 1). Either use the round framing from the intro onwards, or animate the framing change smoothly over ~600ms with the `settle` spring. No instant jump.

## C. Day / dusk at the very start
- Move the day/dusk choice to the intro note ("Before we start"): two side-by-side paper swatches "Day" and "Dusk" (small thumbnails of the room lit each way). Choosing one updates the room instantly behind the note; default from the clock. "Let's go" continues.
- Remove the day/dusk toggle from the views page; that page keeps only city/coast/campus town/countryside.

## D. Tap objects in the finale
On "This is your room." the stickers can't be tapped. Pass onStickerTap to the room in the finale (and every reveal page) and show the tag (name + why line). Check the finale overlay/caption isn't covering stickers with pointer-events.

## E. Wildcard copy
"Tap to flip" → "Tap to reveal your wildcard".

## F. Courses ordered by the player's chosen setting
New data: data/campus_settings.json (Muse Spark Open tagged every HESA location as city / coast / campus town / countryside; run scripts/campus_settings.py first if the file doesn't exist yet — ask me).
- In scripts/build_course_lists.py, read data/raw/on_2026_10_20_13_24_40/COURSELOCATION.csv (PUBUKPRN, UKPRN, KISCOURSEID, KISMODE, LOCID) to find each course's location(s); attach `setting` (and `town`) from campus_settings.json `locations["UKPRN:LOCID"]`, falling back to `providers[UKPRN]`. Ignore entries with confidence "low" (12 of them, several clearly wrong, e.g. Royal College of Music as "campus town, Maidenhead"): treat those as unknown and fall back to the provider setting, or show no tag. Keep up to 16 courses per subject so each setting has some.
- Course sheet: show the player's chosen setting first under a heading like "In a coastal town" then "Elsewhere", each course with a small setting tag and town. If none match, say "No coastal courses for this subject — here are the others."
- Credit line in the sheet and README: "Campus settings tagged by Muse Spark Open from HESA location data."

## G. Share — make it actually work, and native
The Share video button fails because navigator.share() is called after a ~10s recording: browsers only allow share() within a few seconds of the tap (transient user activation), so it throws and falls into the error tip.
- Pre-render: start making the video in the background as soon as the reveal starts (after the wildcard is known); cache the Blob. On the share page show "Share video" enabled only when it's ready (with a small "Preparing your video…" state before that).
- Tapping "Share video" then calls navigator.share({ files:[file], text, url }) immediately — on phones this opens the native share sheet, where Instagram, TikTok, WhatsApp and Snapchat appear for video files. Also add "Share image" that shares the 9:16 still the same way.
- If navigator.canShare({files}) is false (most desktop browsers): download the file and copy the caption + link to the clipboard, and show "Video saved — post it from your phone or upload it to Instagram."
- Handle AbortError (user closed the share sheet) silently; only show an error for real failures, and log the error name.
- Verify in the capture: video is ready before the share page; the button path runs without errors; the fallback downloads. Note that the native sheet can only be confirmed on a real phone.
