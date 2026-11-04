import React from "react";
import { AbsoluteFill, Img, Sequence, interpolate, staticFile, useCurrentFrame, Easing } from "remotion";
import { BODY, C, Count, DISPLAY, PHONE_ASPECT_OLD, Pal, Paper, Phone, PhoneClip, Pill, Sticker, prog, sec, useSpring } from "./kit";
import { STICKERS } from "./assets";

/* Vocabulary (from the reference): words arrive one at a time, blurred then sharp, earlier words fade to grey,
 * the key word in colour; real UI in 3D perspective with a camera that keeps moving; a progress bar that counts
 * up to a Done tick with confetti; a soft gradient blob as the transition. Lots of white space. */

const ACC = C.accent;
const SOFT = Easing.out(Easing.cubic);

/** One line of words that arrive one by one. `at` = frame each word lands. `hot` = indices in accent colour.
 * Earlier words soften to grey once a later one lands (like the reference). */
const Line: React.FC<{ words: string[]; at: number[]; hot?: number[]; size?: number; out?: number; icons?: Record<number, React.ReactNode>; weight?: number }> = ({ words, at, hot = [], size = 86, out, icons = {}, weight = 500 }) => {
  const f = useCurrentFrame();
  const o = out !== undefined ? 1 - prog(f, out, out + 10) : 1;
  const blurOut = out !== undefined ? Math.round(prog(f, out, out + 10) * 10 * 2) / 2 : 0;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", alignItems: "center", gap: size * 0.32, fontFamily: BODY, fontWeight: weight, fontSize: size, letterSpacing: "-0.015em", opacity: o, filter: blurOut ? `blur(${blurOut}px)` : undefined }}>
      {words.map((w, i) => {
        const p = prog(f, at[i], at[i] + 9, SOFT);
        const isHot = hot.includes(i);
        // Earlier words soften to grey over 8 frames once the next word lands (no CSS transitions: they
        // run in wall-clock time between frame captures and flicker in a render).
        const color = isHot ? ACC : C.ink;
        // No CSS transitions (they run in wall-clock time between frame captures and flicker);
        // blur only while the word is arriving, then exactly 0 so the text is pixel-stable.
        const blur = p < 0.999 ? Math.round((1 - p) * 14 * 2) / 2 : 0;
        return (
          <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 18, opacity: p, filter: blur ? `blur(${blur}px)` : undefined, transform: p < 0.999 ? `translate3d(0, ${Math.round((1 - p) * 18)}px, 0) scale(${0.96 + 0.04 * p})` : undefined, color, fontWeight: isHot ? 700 : weight }}>
            {icons[i]}{w}
          </span>
        );
      })}
    </div>
  );
};

const Centre: React.FC<{ children: React.ReactNode; pad?: string }> = ({ children, pad = "0 160px" }) => (
  <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", padding: pad, textAlign: "center" }}>{children}</AbsoluteFill>
);

/** Soft lilac/peach blob that sweeps across to cover, used between beats. */
const Blob: React.FC<{ at: number; dur?: number; color?: string }> = ({ at, dur = 13, color = C.lilac }) => {
  const f = useCurrentFrame();
  const p = prog(f, at, at + dur, Easing.inOut(Easing.cubic));
  const q = prog(f, at + dur, at + dur * 2, Easing.inOut(Easing.cubic));
  const x = interpolate(p + q, [0, 2], [120, -200]);
  return <AbsoluteFill style={{ pointerEvents: "none" }}>
    <div style={{ position: "absolute", left: `${x}%`, top: "-30%", width: "160%", height: "160%", borderRadius: "50%", background: `radial-gradient(closest-side, ${color} 55%, rgba(255,255,255,0) 100%)`, opacity: p > 0 && q < 1 ? 1 : 0, filter: "blur(40px)" }} />
  </AbsoluteFill>;
};

/** Phones arranged as a tunnel in 3D; the camera flies through. */
const Tunnel: React.FC<{ portrait: boolean; len: number }> = ({ portrait, len }) => {
  const f = useCurrentFrame();
  const z = interpolate(f, [0, len], [0, portrait ? 2300 : 3000], { extrapolateRight: "clamp" });
  const ph = portrait ? 1100 : 1150;
  const spots = portrait
    ? [{ x: -560, y: -200, rx: 0, ry: 72, z: -300 }, { x: 560, y: 200, rx: 0, ry: -72, z: -900 }, { x: -560, y: -200, rx: 0, ry: 72, z: -1500 }, { x: 560, y: 200, rx: 0, ry: -72, z: -2100 }, { x: 0, y: 0, rx: 0, ry: 0, z: -3000 }]
    : [{ x: -760, y: 0, rx: 0, ry: 72, z: -300 }, { x: 760, y: 0, rx: 0, ry: -72, z: -900 }, { x: -760, y: 0, rx: 0, ry: 72, z: -1500 }, { x: 760, y: 0, rx: 0, ry: -72, z: -2100 }, { x: 0, y: 0, rx: 0, ry: 0, z: -3600 }];
  const fade = 1 - prog(f, len - 10, len);
  return (
    <AbsoluteFill style={{ perspective: 900, perspectiveOrigin: "50% 50%", opacity: fade }}>
      <div style={{ position: "absolute", left: "50%", top: "50%", transformStyle: "preserve-3d", transform: `translateZ(${z}px) rotateZ(${Math.sin(f / 60) * 1.5}deg)` }}>
        {spots.map((s, i) => (
          <div key={i} style={{ position: "absolute", left: 0, top: 0, transformStyle: "preserve-3d", transform: `translate3d(${s.x}px, ${s.y}px, ${s.z}px) rotateX(${s.rx}deg) rotateY(${s.ry}deg) translate(-50%, -50%)` }}>
            <Phone h={ph} aspect={PHONE_ASPECT_OLD}><Img src={staticFile(`tun/${i}/${String(Math.min(192, f + 1)).padStart(4, "0")}.jpg`)} style={{ width: "100%", height: "100%", objectFit: "cover" }} /></Phone>
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};

/** Progress bar counting objects into the room, then Done + sticker confetti. */
const Building: React.FC<{ portrait: boolean; title?: React.ReactNode }> = ({ portrait, title }) => {
  const f = useCurrentFrame();
  const p = prog(f, 6, 60, Easing.out(Easing.cubic));
  const n = Math.round(p * 8);
  const done = useSpring(66, { damping: 10, stiffness: 170 });
  const w = portrait ? 900 : 1300;
  const burst = prog(f, 70, 130, Easing.out(Easing.quad));
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      <div style={{ opacity: 1 - prog(f, 62, 70), transform: `translateY(${-prog(f, 62, 70) * 30}px)` }}>
        <div style={{ marginBottom: 30 }}>{title ?? <div style={{ fontFamily: BODY, fontWeight: 500, fontSize: 56, color: C.ink, textAlign: "center" }}>Building your room</div>}</div>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "flex-end", width: w, fontFamily: DISPLAY, fontWeight: 900, fontSize: 84, color: ACC, marginBottom: 14 }}>{n}<span style={{ color: "#b3a9c2", fontSize: 52, marginLeft: 8 }}>/8 objects</span></div>
        <div style={{ width: w, height: 44, borderRadius: 24, background: "rgba(42,34,56,.08)", overflow: "hidden" }}>
          <div style={{ width: `${p * 100}%`, height: "100%", borderRadius: 20, background: `linear-gradient(90deg, ${C.peach}, ${ACC})`, boxShadow: `0 8px 24px rgba(229,154,44,.35)` }} />
        </div>
      </div>
      <div style={{ position: "absolute", opacity: done > 0.02 ? 1 : 0, transform: `scale(${0.5 + 0.5 * done})`, textAlign: "center" }}>
        <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: 52, color: ACC, marginBottom: 18 }}>Done</div>
        <div style={{ width: 150, height: 150, borderRadius: 80, margin: "0 auto", background: C.paper, border: `3px solid ${C.line}`, boxShadow: "0 20px 50px rgba(30,24,48,.14)", display: "grid", placeItems: "center" }}>
          <svg width="76" height="76" viewBox="0 0 24 24" fill="none"><path d="M5 12.5l4.5 4.5L19 7.5" stroke={ACC} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={30} strokeDashoffset={30 * (1 - prog(f, 72, 86))} /></svg>
        </div>
      </div>
      <AbsoluteFill style={{ pointerEvents: "none" }}>
        {Array.from({ length: 34 }, (_, i) => {
          const a = (i / 34) * Math.PI * 2 + (i % 3) * 0.3; const r = (240 + (i % 5) * 110) * burst; const g = burst * burst * 420;
          return <Sticker key={i} code={STICKERS[(i * 13) % STICKERS.length]} size={54 + (i % 4) * 16} style={{ position: "absolute", left: `calc(50% + ${Math.cos(a) * r}px)`, top: `calc(50% + ${Math.sin(a) * r * 0.8 + g}px)`, opacity: burst > 0 ? (1 - burst) * 1.2 : 0, transform: `rotate(${burst * (i % 2 ? 300 : -300)}deg)` }} />;
        })}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** Top-3 cards popping in one by one in light 3D, then the wildcard. */
const TOP3 = [["CAH07-01-01", "Physics"], ["CAH26-01-01", "Earth sciences"], ["CAH09-01-01", "Mathematics"]];
const Cards: React.FC<{ portrait: boolean; outAt?: number }> = ({ portrait, outAt = 136 }) => {
  const f = useCurrentFrame();
  const list = TOP3.filter(([c]) => STICKERS.includes(c)).concat(TOP3.length < 3 ? [] : []);
  const items = (list.length === 3 ? list : [[STICKERS[6], "Physics"], [STICKERS[150], "Earth sciences"], [STICKERS[55], "Mathematics"]]) as [string, string][];
  const wild = settle(useSpring(70, { damping: 11, stiffness: 150 }));
  const out = 1 - prog(f, outAt, outAt + 10);
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", perspective: 1400, opacity: out }}>
      <div style={{ display: "flex", flexDirection: portrait ? "column" : "row", gap: 26 }}>
        {items.map(([code, name], i) => {
          const p = settle(useSpringAt(8 + i * 11));
          return <div key={code} style={{ width: portrait ? 760 : 440, background: C.paper, borderRadius: 28, border: `2px solid ${C.line}`, padding: portrait ? "22px 28px" : "28px 26px", boxShadow: "0 30px 60px rgba(30,24,48,.14)", display: "flex", flexDirection: portrait ? "row" : "column", alignItems: "center", gap: 18, opacity: p, transform: p < 1 ? `translate3d(0, ${Math.round((1 - p) * 80)}px, 0) scale(${0.85 + 0.15 * p})` : undefined }}>
            <Sticker code={code} size={portrait ? 120 : 170} />
            <div style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: portrait ? 46 : 44, color: C.ink, textAlign: portrait ? "left" : "center" }}><span style={{ color: ACC, marginRight: 10 }}>{i + 1}</span>{name}</div>
          </div>;
        })}
        <div style={{ width: portrait ? 760 : 440, background: C.butter, borderRadius: 28, border: `2px solid ${ACC}`, padding: portrait ? "22px 28px" : "28px 26px", boxShadow: "0 30px 60px rgba(90,54,0,.16)", display: "flex", flexDirection: portrait ? "row" : "column", alignItems: "center", gap: 18, opacity: wild, transform: wild < 1 ? `rotateY(${(1 - wild) * 180}deg) scale(${0.85 + 0.15 * wild})` : undefined }}>
          <Sticker code={STICKERS[22]} size={portrait ? 120 : 170} />
          <div style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: portrait ? 46 : 44, color: C.accentInk, textAlign: portrait ? "left" : "center" }}>Wildcard</div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
const useSpringAt = (d: number) => useSpring(d, { damping: 12, stiffness: 150, mass: 0.8 });
/** Springs never quite reach 1; snap once they are close so settled elements stop re-rasterising. */
const settle = (p: number) => (Math.abs(1 - p) < 0.004 ? 1 : p);

/** "Backed by real data": three counters and the sources. */
const DataBeat: React.FC<{ portrait: boolean; S: number }> = ({ portrait, S }) => {
  const f = useCurrentFrame();
  const stats: [number, string][] = [[28753, "courses"], [315, "universities"], [499, "apprenticeships"]];
  const o = 1 - prog(f, 108, 118);
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", opacity: o }}>
      <Line words={["Backed", "by", "real", "data."]} at={[4, 10, 16, 22]} hot={[2, 3]} size={S} />
      <div style={{ display: "flex", flexDirection: portrait ? "column" : "row", gap: portrait ? 18 : 34, marginTop: 44, alignItems: "center" }}>
        {stats.map(([n, l], i) => {
          const p = useSpringAt(34 + i * 8);
          return <div key={l} style={{ opacity: p, transform: `translateY(${(1 - p) * 40}px) scale(${0.9 + 0.1 * p})`, background: C.paper, border: `2px solid ${C.line}`, borderRadius: 30, padding: portrait ? "18px 40px" : "24px 44px", boxShadow: "0 1px 0 rgba(42,34,56,.12), 0 18px 40px rgba(30,24,48,.10)", textAlign: "center", minWidth: portrait ? 520 : 360 }}>
            <div style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: portrait ? 78 : 84, color: C.ink, lineHeight: 1, letterSpacing: "-0.03em" }}><Count to={n} start={36 + i * 8} dur={40} /></div>
            <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: 30, color: C.muted, marginTop: 8 }}>{l}</div>
          </div>;
        })}
      </div>
      <div style={{ marginTop: 34, fontFamily: BODY, fontWeight: 600, fontSize: 28, color: "#b3a9c2", opacity: useSpringAt(70) }}>Discover Uni (HESA) · Skills England · O*NET</div>
    </AbsoluteFill>
  );
};

const ShareBeat: React.FC<{ portrait: boolean }> = ({ portrait }) => {
  const f = useCurrentFrame(); const p = useSpring(0, { damping: 16, stiffness: 110 });
  const out = 1 - prog(f, 110, 120);
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", perspective: 1400, opacity: out }}>
      <div style={{ transform: `translateX(${portrait ? 0 : -330}px) translateY(${portrait ? 200 : 0}px) rotateY(${(1 - p) * -70 + 18}deg) rotateX(${4}deg) translateZ(${(1 - p) * -900}px)`, opacity: p }}>
        <Phone h={portrait ? 980 : 820}><PhoneClip from={112.5} /></Phone>
      </div>
      <div style={{ position: "absolute", left: portrait ? 0 : 1040, right: portrait ? 0 : 120, top: portrait ? 150 : "50%", transform: portrait ? "none" : "translateY(-50%)" }}>
        <Line words={["Share", "your", "room."]} at={[14, 22, 30]} hot={[2]} size={portrait ? 84 : 92} />
        <div style={{ marginTop: 26 }}><Line words={["A", "ten-second", "video,", "made", "on", "your", "phone."]} at={[44, 50, 56, 62, 68, 74, 80]} size={portrait ? 40 : 42} /></div>
      </div>
    </AbsoluteFill>
  );
};

/* ---------------- the ad ---------------- */
export const Ad: React.FC<{ portrait?: boolean; cta?: boolean }> = ({ portrait = false, cta = true }) => {
  const S = portrait ? 78 : 88;
  const pad = portrait ? "0 60px" : "0 180px";
  const hat = <Sticker code={STICKERS[28]} size={S * 1.1} />;
  const tool = <Sticker code={STICKERS[61]} size={S * 1.1} />;
  return (
    <Paper>
      {/* 0–2.6 Q1 */}
      <Sequence durationInFrames={80} layout="none"><Centre pad={pad}>
        <Line words={["Struggling", "to", "pick", "a", "subject", "for", "uni?"]} at={[2, 9, 15, 21, 27, 35, 41]} hot={[4]} size={S} out={66} icons={{ 6: hat }} />
      </Centre></Sequence>
      {/* 2.6–5.2 Q2 */}
      <Sequence from={78} durationInFrames={80} layout="none"><Centre pad={pad}>
        <Line words={["No", "idea", "which", "way", "to", "go", "for", "an", "apprenticeship?"]} at={[2, 7, 12, 17, 22, 27, 32, 37, 43]} hot={[8]} size={S} out={66} icons={{ 8: tool }} />
      </Centre></Sequence>
      {/* 5.2–8.4 Q3 */}
      <Sequence from={156} durationInFrames={96} layout="none"><Centre pad={pad}>
        <Line words={["Maybe", "you've", "just", "got…"]} at={[2, 9, 16, 24]} size={S} out={84} />
        <div style={{ marginTop: 30 }}><Line words={["an", "inkling?"]} at={[48, 52]} hot={[1]} size={S * 1.9} out={84} weight={700} icons={{ 1: <Pal paper="lined" h={S * 1.9} delay={54} bob={5} /> }} /></div>
      </Centre></Sequence>
      {/* 8.4–12.4 promise, over the room tunnel */}
      <Sequence from={252} durationInFrames={120} layout="none">
        <Tunnel portrait={portrait} len={120} />
        <Centre pad={pad}><div style={{ textShadow: "0 2px 0 rgba(251,246,238,.9), 0 0 24px rgba(251,246,238,.95), 0 0 48px rgba(251,246,238,.9)" }}>
          <Line words={["Inkling", "uncovers", "the", "subjects", "that", "fit", "you."]} at={[6, 13, 20, 27, 34, 41, 48]} hot={[5, 6]} size={S * 0.92} out={106} weight={600} />
        </div></Centre>
      </Sequence>
      <Blob at={366} color={C.lilac} />
      {/* 12.4–16.4 how: your interests become a room */}
      <Sequence from={372} durationInFrames={120} layout="none">
        <Building portrait={portrait} title={<Line words={["From", "what", "you're", "actually", "into."]} at={[2, 8, 14, 20, 26]} hot={[3, 4]} size={S * 0.8} weight={600} />} />
      </Sequence>
      <Blob at={486} color={C.peach} />
      {/* 16.4–20.4 trust: real data */}
      <Sequence from={492} durationInFrames={120} layout="none"><DataBeat portrait={portrait} S={S} /></Sequence>
      <Blob at={606} color={C.sage} />
      {/* 20.4–24.4 result: top 3 + wildcard; stays up for the crossfade into the intro */}
      <Sequence from={612} durationInFrames={cta ? 120 : 140} layout="none">
        <Cards portrait={portrait} outAt={cta ? 108 : 130} />
        <div style={{ position: "absolute", left: 0, right: 0, top: portrait ? 120 : 90, textAlign: "center" }}><Line words={["Your", "top", "3.", "Plus", "a", "wildcard."]} at={[4, 10, 16, 60, 66, 72]} hot={[5]} size={portrait ? 64 : 70} out={cta ? 108 : 130} weight={600} /></div>
      </Sequence>
      {/* 24.4–28.4 share */}
      {cta && <Sequence from={732} durationInFrames={124} layout="none"><ShareBeat portrait={portrait} /></Sequence>}
      {cta && <Blob at={726} color={C.peach} />}
      {/* 28.4–32.4 CTA */}
      {cta && <Sequence from={852} layout="none"><Centre pad={pad}>
        <Line words={["Find", "your", "inkling."]} at={[4, 12, 20]} hot={[2]} size={S * 1.6} weight={700} icons={{ 0: <Pal paper="lined" h={S * 1.6} delay={2} bob={6} /> }} />
        <div style={{ marginTop: 34, display: "flex", gap: 18, alignItems: "center", justifyContent: "center", flexWrap: "wrap", opacity: 1 }}>
          <div style={{ opacity: useSpringAt(34) }}><Pill size={portrait ? 38 : 44} bg={ACC} color={C.accentInk} border={ACC}>findyourinkling.com</Pill></div>
          <div style={{ fontFamily: BODY, fontSize: 30, color: C.muted, opacity: useSpringAt(42) }}>Free · 2 minutes · no sign-up</div>
        </div>
      </Centre></Sequence>}
    </Paper>
  );
};
export const AD_LEN = 732;          // 24.4s, demo opener ends before the share beat
export const AD_LEN_CTA = 852 + 120; // 32.4s standalone
