import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import path from "path";
const comp = process.env.COMP || "Launch"; const frames = process.argv.slice(2).map(Number);
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts"), publicDir: path.resolve("public") });
const browserExecutable = process.env.REMOTION_BROWSER || null; // null = Remotion downloads its own headless Chrome
const CONC = +(process.env.CONC || Math.max(1, (await import("os")).cpus().length - 1));
const composition = await selectComposition({ serveUrl, id: comp, browserExecutable });
for (const f of frames) {
  await renderStill({ composition, serveUrl, frame: f, output: `stills/${comp}_f${String(f).padStart(5, "0")}.jpg`, imageFormat: "jpeg", jpegQuality: 88, browserExecutable, chromiumOptions: { gl: process.env.REMOTION_GL || "angle" } });
  console.log("still", f);
}
