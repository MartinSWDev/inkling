import React from "react";
import { AbsoluteFill, Composition, Sequence } from "remotion";
import { Fonts, SceneIn, sec } from "./kit";
import { S1Intro, S2Round1, S3Rounds, S4Reveal, S4Inkling, S5Courses, S6Share } from "./scenesA";
import { S7Models, S8Sim, S9Built, S10End } from "./scenesB";
import { Ad, AD_LEN_CTA } from "./ad";

export const SCENES = [
  { id: "ad", C: () => <Ad cta={false} />, start: 0, dur: 24.4 },
  { id: "intro", C: S1Intro, start: 24.4, dur: 10 },
  { id: "round1", C: S2Round1, start: 34.4, dur: 14 },
  { id: "rounds", C: S3Rounds, start: 48.4, dur: 15 },
  { id: "reveal", C: S4Reveal, start: 63.4, dur: 17 },
  { id: "inkling", C: S4Inkling, start: 80.4, dur: 9 },
  { id: "courses", C: S5Courses, start: 89.4, dur: 11 },
  { id: "share", C: S6Share, start: 100.4, dur: 8 },
  { id: "models", C: S7Models, start: 108.4, dur: 26 },
  { id: "sim", C: S8Sim, start: 134.4, dur: 30 },
  { id: "built", C: S9Built, start: 164.4, dur: 7 },
  { id: "end", C: S10End, start: 171.4, dur: 6 },
];
const OV = 14;
export const TOTAL = sec(177.4);

const Launch: React.FC = () => (
  <AbsoluteFill style={{ background: "#F3EDE4" }}>
    <Fonts />
    {SCENES.map((s, i) => (
      <Sequence key={s.id} from={sec(s.start)} durationInFrames={sec(s.dur) + (i < SCENES.length - 1 ? OV : 0)} name={s.id}>
        {i === 0 ? <s.C /> : <SceneIn ov={OV}><s.C /></SceneIn>}
      </Sequence>
    ))}
  </AbsoluteFill>
);

export const Root: React.FC = () => (
  <>
    <Composition id="Launch" component={Launch} durationInFrames={TOTAL} fps={30} width={1920} height={1080} />
    <Composition id="Ad" component={() => <AbsoluteFill><Fonts /><Ad /></AbsoluteFill>} durationInFrames={AD_LEN_CTA} fps={30} width={1920} height={1080} />
    <Composition id="AdPortrait" component={() => <AbsoluteFill><Fonts /><Ad portrait /></AbsoluteFill>} durationInFrames={AD_LEN_CTA} fps={30} width={1080} height={1920} />
  </>
);
