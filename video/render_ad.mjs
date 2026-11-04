import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import path from "path"; import fs from "fs";
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts"), publicDir: path.resolve("public") });
const browserExecutable = process.env.REMOTION_BROWSER || null; // null = Remotion downloads its own headless Chrome
const CONC = +(process.env.CONC || Math.max(1, (await import("os")).cpus().length - 1));
for (const id of process.argv.slice(2)) {
  const composition = await selectComposition({ serveUrl, id, browserExecutable });
  const tmp = `out/${id}.tmp.mp4`, fin = `out/${id}.mp4`; const t0 = Date.now();
  await renderMedia({ composition, serveUrl, codec: "h264", crf: 17, x264Preset: "veryfast", pixelFormat: "yuv420p", outputLocation: tmp, imageFormat: "jpeg", jpegQuality: 92, concurrency: CONC, browserExecutable, chromiumOptions: { gl: process.env.REMOTION_GL || "angle" }, muted: true, enforceAudioTrack: false });
  fs.renameSync(tmp, fin); console.log("done", id, ((Date.now() - t0) / 1000).toFixed(0) + "s");
}
