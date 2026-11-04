import React, { useEffect, useState } from "react";
import {
  AbsoluteFill, Img, OffthreadVideo, continueRender, delayRender, interpolate, spring,
  staticFile, useCurrentFrame, useVideoConfig, Easing,
} from "remotion";

export const C = {
  bg: "#F3EDE4", paper: "#FBF6EE", ink: "#2A2238", muted: "#6c6280", line: "#ddd2c2",
  accent: "#E59A2C", accentInk: "#5a3600", lilac: "#C9B8E8", peach: "#F6C9A8", sage: "#B9CDB0",
  butter: "#F3D98B", teal: "#3f8f88", wall: "#dcd0ee",
};
export const DISPLAY = "Fraunces, Georgia, serif";
export const BODY = "Figtree, 'Helvetica Neue', Arial, sans-serif";
export const FPS = 30;
export const sec = (s: number) => Math.round(s * FPS);
export const EASE = Easing.bezier(0.22, 1, 0.36, 1); // expo-ish out
export const EASE_IN_OUT = Easing.bezier(0.65, 0, 0.35, 1);

const fontCss = `
@font-face{font-family:Fraunces;font-weight:700;src:url(${staticFile("fonts/fraunces-700.ttf")})}
@font-face{font-family:Fraunces;font-weight:900;src:url(${staticFile("fonts/fraunces-900.ttf")})}
@font-face{font-family:Figtree;font-weight:400;src:url(${staticFile("fonts/figtree-400.ttf")})}
@font-face{font-family:Figtree;font-weight:600;src:url(${staticFile("fonts/figtree-600.ttf")})}
`;
export const Fonts: React.FC = () => {
  const [handle] = useState(() => delayRender("fonts"));
  useEffect(() => {
    Promise.all(["700 80px Fraunces", "900 80px Fraunces", "400 30px Figtree", "600 30px Figtree"].map((f) => document.fonts.load(f)))
      .then(() => continueRender(handle)).catch(() => continueRender(handle));
  }, [handle]);
  return <style>{fontCss}</style>;
};

/** 0..1 progress between two frames with easing. */
export const prog = (f: number, a: number, b: number, ease = EASE) =>
  interpolate(f, [a, b], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });

export const useSpring = (delay = 0, cfg: any = { damping: 200, stiffness: 120, mass: 0.9 }) => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig();
  return spring({ frame: f - delay, fps, config: cfg });
};

/** Warm paper backdrop with grain and soft vignette. */
export const Paper: React.FC<{ tint?: string; children?: React.ReactNode }> = ({ tint = C.bg, children }) => (
  <AbsoluteFill style={{ background: tint }}>
    <AbsoluteFill style={{ backgroundImage: `url(${staticFile("paper-grain.png")})`, backgroundSize: "256px", opacity: 0.5, mixBlendMode: "multiply" }} />
    <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 45%, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0) 55%, rgba(42,34,56,0.10) 100%)" }} />
    {children}
  </AbsoluteFill>
);

/** Words slide up from a mask, staggered. */
export const Words: React.FC<{
  text: string; delay?: number; size?: number; weight?: number; family?: string; color?: string;
  stagger?: number; style?: React.CSSProperties; lineHeight?: number; out?: number; align?: "left" | "center";
}> = ({ text, delay = 0, size = 64, weight = 900, family = DISPLAY, color = C.ink, stagger = 3, style, lineHeight = 1.04, out, align = "left" }) => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig();
  const words = text.split(" ");
  const o = out !== undefined ? 1 - prog(f, out, out + 12) : 1;
  return (
    <div style={{ fontFamily: family, fontWeight: weight, fontSize: size, color, lineHeight, letterSpacing: family === DISPLAY ? "-0.02em" : "-0.005em", textAlign: align, opacity: o, ...style }}>
      {words.map((w, i) => {
        const p = spring({ frame: f - delay - i * stagger, fps, config: { damping: 200, stiffness: 140, mass: 0.8 } });
        return (
          <span key={i} style={{ display: "inline-block", overflow: "hidden", verticalAlign: "top", paddingBottom: size * 0.12, marginBottom: -size * 0.12 }}>
            <span style={{ display: "inline-block", transform: `translateY(${(1 - p) * 110}%)`, opacity: p > 0.01 ? 1 : 0 }}>
              {w}{i < words.length - 1 ? " " : ""}
            </span>
          </span>
        );
      })}
    </div>
  );
};

/** Fade + rise wrapper. */
export const Rise: React.FC<{ delay?: number; y?: number; out?: number; style?: React.CSSProperties; children: React.ReactNode; scale?: boolean }> = ({ delay = 0, y = 40, out, style, children, scale }) => {
  const f = useCurrentFrame(); const p = useSpring(delay);
  const o = out !== undefined ? 1 - prog(f, out, out + 12) : 1;
  return <div style={{ opacity: p * o, transform: `translateY(${(1 - p) * y}px) scale(${scale ? 0.92 + 0.08 * p : 1})`, ...style }}>{children}</div>;
};

export const fmt = (n: number) => Math.round(n).toLocaleString("en-GB");
export const Count: React.FC<{ to: number; from?: number; start: number; dur?: number; suffix?: string; style?: React.CSSProperties }> = ({ to, from = 0, start, dur = 45, suffix = "", style }) => {
  const f = useCurrentFrame();
  const v = from + (to - from) * prog(f, start, start + dur, Easing.bezier(0.16, 1, 0.3, 1));
  return <span style={{ fontVariantNumeric: "tabular-nums", ...style }}>{fmt(v)}{suffix}</span>;
};

export const Pill: React.FC<{ children: React.ReactNode; bg?: string; color?: string; border?: string; size?: number; style?: React.CSSProperties }> = ({ children, bg = C.paper, color = C.ink, border = C.line, size = 30, style }) => (
  <span style={{ display: "inline-flex", alignItems: "center", gap: 10, fontFamily: BODY, fontWeight: 600, fontSize: size, color, background: bg, border: `2px solid ${border}`, borderRadius: 999, padding: `${size * 0.32}px ${size * 0.7}px`, boxShadow: "0 1px 0 rgba(42,34,56,.12), 0 10px 24px rgba(30,24,48,.10)", whiteSpace: "nowrap", ...style }}>{children}</span>
);

export const Eyebrow: React.FC<{ n?: string; children: React.ReactNode; delay?: number; out?: number; color?: string }> = ({ n, children, delay = 0, out, color = C.accent }) => (
  <Rise delay={delay} y={16} out={out}>
    <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: 30, color: C.muted, display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
      {n && <span style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: 30, color }}>{n}</span>}
      <span>{children}</span>
    </div>
  </Rise>
);

/** iPhone-ish device frame. Screen is 390x844 aspect. */
export const PHONE_ASPECT = 900 / 1590; // Safari viewport of the phone recording
export const PHONE_ASPECT_OLD = 780 / 1688;
export const Phone: React.FC<{ h?: number; children: React.ReactNode; style?: React.CSSProperties; aspect?: number }> = ({ h = 880, children, style, aspect = PHONE_ASPECT }) => {
  const sh = h - 28, sw = sh * aspect;
  return (
    <div style={{ width: sw + 28, height: h, borderRadius: 64, background: "#1d1828", padding: 14, boxSizing: "border-box",
      boxShadow: "0 2px 0 rgba(255,255,255,.08) inset, 0 50px 100px rgba(30,24,48,.28), 0 18px 36px rgba(30,24,48,.18)", position: "relative", ...style }}>
      <div style={{ width: sw, height: sh, borderRadius: 52, overflow: "hidden", position: "relative", background: C.wall }}>
        {children}
        <div style={{ position: "absolute", top: 14, left: "50%", transform: "translateX(-50%)", width: sw * 0.3, height: 30, borderRadius: 20, background: "#0e0b14" }} />
      </div>
    </div>
  );
};

/** A slice of the captured phone footage. from/to in capture seconds. */
export const PhoneClip: React.FC<{ from: number; src?: string }> = ({ from, src = "phone2.mp4" }) => (
  <OffthreadVideo src={staticFile(src)} trimBefore={sec(from)} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
);

/** Crossfade wrapper for scene entry (paper scenes are opaque). */
export const SceneIn: React.FC<{ children: React.ReactNode; ov?: number }> = ({ children, ov = 14 }) => {
  const f = useCurrentFrame();
  const p = prog(f, 0, ov, EASE_IN_OUT);
  return <AbsoluteFill style={{ opacity: p, transform: `scale(${1.015 - 0.015 * p})` }}>{children}</AbsoluteFill>;
};

export const Pal: React.FC<{ paper?: string; h?: number; style?: React.CSSProperties; bob?: number; delay?: number }> = ({ paper = "lined", h = 200, style, bob = 0, delay = 0 }) => {
  const f = useCurrentFrame(); const p = useSpring(delay, { damping: 12, stiffness: 160, mass: 0.7 });
  const b = bob ? Math.sin((f - delay) / 7) * bob : 0;
  return <Img src={staticFile(`characters/${paper}.webp`)} style={{ height: h, transform: `translateY(${(1 - p) * 120 + b}px) scale(${0.6 + 0.4 * p}) rotate(${Math.sin((f - delay) / 11) * (bob ? 3 : 0)}deg)`, opacity: p > 0.02 ? 1 : 0, filter: "drop-shadow(0 18px 24px rgba(30,24,48,.22))", ...style }} />;
};

export const Sticker: React.FC<{ code: string; size: number; style?: React.CSSProperties }> = ({ code, size, style }) => (
  <Img src={staticFile(`stickers/${code}.webp`)} style={{ width: size, height: size, objectFit: "contain", filter: "drop-shadow(0 10px 14px rgba(30,24,48,.18))", ...style }} />
);
