# Inkling launch video

The demo video and the 30-second ad, built in [Remotion](https://remotion.dev) from real footage of the game.

- `src/` the scenes (`scenesA.tsx`, `scenesB.tsx`), the ad (`ad.tsx`), shared motion kit (`kit.tsx`) and the timeline (`Root.tsx`).
- `capture/` Playwright scripts that record the game in a phone emulator (`play.cjs`) and the simulation page (`sim.cjs`). Their output is `public/phone.mp4`, `public/sim.mp4` and the game's own share video.
- `inkling_voiceover.srt` the voice-over cue sheet, timed to the demo cut.

## Render

Needs Node 20+ and ffmpeg. Remotion downloads its own headless Chrome on first run; to use an installed Chrome instead, set `REMOTION_BROWSER` to its path.

```sh
sh setup.sh      # links game assets from ../web/public and extracts the tunnel frames
npm install
node render.mjs                 # demo video: one file per scene in out/, then join (below)
node render_ad.mjs Ad AdPortrait   # the standalone ad, 16:9 and 9:16
```

Join the demo scenes and finish the file:

```sh
cd out && ls 0*.mp4 | sed "s/^/file '/;s/$/'/" > list.txt
ffmpeg -y -f concat -safe 0 -i list.txt -c copy joined.mp4
ffmpeg -y -i joined.mp4 -vf "scale=in_range=pc:out_range=tv,format=yuv420p" -c:v libx264 -preset veryfast -crf 17 -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv -movflags +faststart inkling_launch.mp4
```

Re-render one scene after a change: `node render.mjs sim` (ids: ad intro round1 rounds reveal courses share models sim built end), then join again.
Preview a range at low resolution: `node preview.mjs Launch 0 300 preview.mp4`. Stills: `node stills.mjs 120 600`.

Footage files in `public/` (`phone.mp4`, `sim.mp4`, `sharevideo.mp4`, `fb_*.png`, `tun/`) are not in git; re-record them with the capture scripts against a local build.
