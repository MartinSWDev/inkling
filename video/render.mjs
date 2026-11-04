import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import path from "path"; import fs from "fs";
const only = process.argv.slice(2);
const starts = [0, 24.4, 34.4, 48.4, 63.4, 80.4, 89.4, 100.4, 108.4, 134.4, 164.4, 171.4, 177.4];
const ids = ["ad", "intro", "round1", "rounds", "reveal", "inkling", "courses", "share", "models", "sim", "built", "end"];
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts"), publicDir: path.resolve("public") });
const browserExecutable = process.env.REMOTION_BROWSER || null; // null = Remotion downloads its own headless Chrome
const CONC = +(process.env.CONC || Math.max(1, (await import("os")).cpus().length - 1));
const composition = await selectComposition({ serveUrl, id: "Launch", browserExecutable });
for (let i = 0; i < ids.length; i++) {
  if (only.length && !only.includes(ids[i])) continue;
  const a = Math.round(starts[i] * 30), b = Math.round(starts[i + 1] * 30) - 1;
  const tmp = `out/${String(i).padStart(2, "0")}_${ids[i]}.tmp.mp4`, fin = tmp.replace(".tmp", "");
  const t0 = Date.now();
  await renderMedia({ composition, serveUrl, codec: "h264", crf: 17, x264Preset: "veryfast", pixelFormat: "yuv420p", frameRange: [a, b], outputLocation: tmp,
    imageFormat: "jpeg", jpegQuality: 92, concurrency: CONC, browserExecutable, chromiumOptions: { gl: process.env.REMOTION_GL || "angle" }, muted: true, enforceAudioTrack: false });
  fs.renameSync(tmp, fin);
  console.log("done", ids[i], ((Date.now() - t0) / 1000).toFixed(0) + "s");
}
