import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import path from "path";
const [id, a, b, out] = process.argv.slice(2);
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts"), publicDir: path.resolve("public") });
const browserExecutable = process.env.REMOTION_BROWSER || null; // null = Remotion downloads its own headless Chrome
const CONC = +(process.env.CONC || Math.max(1, (await import("os")).cpus().length - 1));
const composition = await selectComposition({ serveUrl, id, browserExecutable });
await renderMedia({ composition, serveUrl, codec: "h264", crf: 24, x264Preset: "veryfast", scale: 0.4, frameRange: [+a, +b], outputLocation: out, imageFormat: "jpeg", jpegQuality: 80, concurrency: CONC, browserExecutable, chromiumOptions: { gl: process.env.REMOTION_GL || "angle" }, muted: true, enforceAudioTrack: false });
console.log("ok");
