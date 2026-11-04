import { Config } from "@remotion/cli/config";
if (process.env.REMOTION_BROWSER) Config.setBrowserExecutable(process.env.REMOTION_BROWSER);
Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(92);
