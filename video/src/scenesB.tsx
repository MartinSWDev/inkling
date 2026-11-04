import React from "react";
import { AbsoluteFill, Img, OffthreadVideo, Sequence, staticFile, useCurrentFrame, interpolate } from "remotion";
import { BODY, C, Count, DISPLAY, EASE, EASE_IN_OUT, Eyebrow, Pal, Paper, Phone, Pill, Rise, Sticker, Words, prog, sec, useSpring } from "./kit";
import { PALS, STICKERS } from "./assets";

const Tile: React.FC<{ n: number; label: string; delay: number; suffix?: string; accent?: boolean }> = ({ n, label, delay, suffix, accent }) => (
  <Rise delay={delay} y={30} scale>
    <div style={{ background: accent ? C.ink : C.paper, borderRadius: 30, border: `2px solid ${accent ? C.ink : C.line}`, padding: "22px 30px", height: 150, boxSizing: "border-box",
      boxShadow: "0 1px 0 rgba(42,34,56,.12), 0 18px 40px rgba(30,24,48,.10)", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
      <div style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: 64, lineHeight: 1, color: accent ? C.butter : C.ink, letterSpacing: "-0.03em" }}><Count to={n} start={delay + 4} dur={40} suffix={suffix} /></div>
      <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: 24, color: accent ? C.paper : C.muted }}>{label}</div>
    </div>
  </Rise>
);

/* ---------- S7 Meta models (1:46–2:12) ---------- */
export const S7Models: React.FC = () => (
  <Paper>
    {/* a: two jobs */}
    <Sequence durationInFrames={110} layout="none"><Fader len={110}><TwoJobs /></Fader></Sequence>
    {/* b: Spark Open on Baseten, writing a card */}
    <Sequence from={100} durationInFrames={300} layout="none"><Fader len={300}><SparkOpen /></Fader></Sequence>
    {/* c: Muse Image */}
    <Sequence from={390} durationInFrames={170} layout="none"><Fader len={170}><MuseImage /></Fader></Sequence>
    {/* d: SAM + Code */}
    <Sequence from={548} durationInFrames={146} layout="none"><Fader len={146}><SamCode /></Fader></Sequence>
    {/* e: open weights */}
    <Sequence from={682} layout="none"><Fader len={112}><OpenWeights /></Fader></Sequence>
  </Paper>
);
const Fader: React.FC<{ children: React.ReactNode; len: number }> = ({ children, len }) => {
  const f = useCurrentFrame();
  const o = prog(f, 0, 14, EASE_IN_OUT) * (1 - prog(f, len - 14, len, EASE_IN_OUT));
  return <AbsoluteFill style={{ opacity: o }}><Paper>{children}</Paper></AbsoluteFill>;
};

const TwoJobs: React.FC = () => {
  const f = useCurrentFrame();
  const out = prog(f, 96, 110, EASE_IN_OUT);
  const col = (title: string, lines: string[], delay: number, bg: string) => (
    <Rise delay={delay} y={40} scale style={{ flex: 1 }}>
      <div style={{ background: bg, border: `2px solid ${C.line}`, borderRadius: 36, padding: "44px 48px", height: 520, boxSizing: "border-box", boxShadow: "0 1px 0 rgba(42,34,56,.12), 0 24px 50px rgba(30,24,48,.10)" }}>
        <div style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: 92, color: C.ink, letterSpacing: "-0.02em", lineHeight: 1 }}>{title}</div>
        <div style={{ marginTop: 34, display: "grid", gap: 14 }}>
          {lines.map((l, i) => <Rise key={l} delay={delay + 14 + i * 5} y={12}><div style={{ fontFamily: BODY, fontWeight: 600, fontSize: 34, color: C.muted }}>{l}</div></Rise>)}
        </div>
      </div>
    </Rise>
  );
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", opacity: 1 - out, transform: `scale(${1 + out * 0.04})` }}>
      <Eyebrow delay={0}>Meta's models did two jobs</Eyebrow>
      <div style={{ display: "flex", gap: 40, width: 1560, marginTop: 10 }}>
        {col("Built it.", ["Muse Spark Open wrote every card", "Muse Image drew the paper world", "SAM 3.1 checked every sticker", "Muse Code helped build it"], 6, C.paper)}
        {col("Runs live in it.", ["Muse Spark writes your inkling", "Muse Image draws your paper pal", "Spark Open plays live students", "on Baseten and the Meta Model API"], 14, C.butter)}
      </div>
    </AbsoluteFill>
  );
};

const ModelHead: React.FC<{ name: string; role: string; chips?: string[]; delay?: number }> = ({ name, role, chips = [], delay = 0 }) => (
  <div>
    <Eyebrow delay={delay}>{role}</Eyebrow>
    <Words text={name} size={120} delay={delay + 4} />
    <div style={{ display: "flex", gap: 14, marginTop: 26 }}>
      {chips.map((c, i) => <Rise key={c} delay={delay + 16 + i * 5} y={14} scale><Pill size={28} bg={i === 0 ? C.butter : C.paper} border={i === 0 ? C.accent : C.line}>{c}</Pill></Rise>)}
    </div>
  </div>
);

const REQ = [
  "POST https://inference.baseten.co/v1/chat/completions",
  '{ "model": "meta-models/muse-spark-open-1026",',
  '  "messages": [ card_rules, "zoology" ] }',
  "",
  "→ 200 OK · streaming",
];
const CARD: [string, string][] = [
  ["display_name", "Zoology"],
  ["plain", "You study animals, how their bodies work, how they behave and where they live."],
  ["why_line", "Good if you're curious about why animals act the way they do."],
  ["object", "pair of field binoculars with neck strap"],
  ["slot", "shelf"],
];
const SparkOpen: React.FC = () => {
  const f = useCurrentFrame();
  const typed = (i: number, len: number) => Math.floor(prog(f, 24 + i * 9, 36 + i * 9, (x) => x) * len);
  const cardAt = 80;
  const stamp = useSpring(190, { damping: 10, stiffness: 180 });
  return (
    <AbsoluteFill style={{ padding: "90px 110px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <ModelHead name="Muse Spark Open" role="Wrote and checked every word, before launch" chips={["Open weights", "7 batch jobs"]} delay={2} />
        <Rise delay={10} y={14} scale><Pill size={34} bg={C.ink} color={C.butter} border={C.ink}>Running on Baseten</Pill></Rise>
      </div>
      <div style={{ display: "flex", gap: 40, marginTop: 24 }}>
        <div style={{ width: 860, background: "#221c30", borderRadius: 30, padding: "30px 36px", height: 440, boxSizing: "border-box", boxShadow: "0 30px 70px rgba(30,24,48,.25)" }}>
          <div style={{ display: "flex", gap: 10, marginBottom: 22 }}>{["#e26d5c", "#e5b84c", "#7cb47a"].map((c) => <div key={c} style={{ width: 16, height: 16, borderRadius: 9, background: c }} />)}</div>
          {REQ.map((l, i) => <div key={i} style={{ fontFamily: "Menlo, 'DejaVu Sans Mono', monospace", fontSize: 25, lineHeight: "48px", color: i === 1 ? C.butter : i === 4 ? "#9fd3a0" : "#e9e2f5", whiteSpace: "pre" }}>{l.slice(0, typed(i, l.length))}</div>)}
          <div style={{ fontFamily: "Menlo, 'DejaVu Sans Mono', monospace", fontSize: 25, lineHeight: "48px", color: "#b3a9c2" }}>{f > cardAt ? `${Math.min(163, Math.floor((f - cardAt) / 1.2))} / 163 subject cards` : ""}</div>
        </div>
        <div style={{ flex: 1, position: "relative" }}>
          <Rise delay={cardAt - 8} y={30} scale>
            <div style={{ background: C.paper, borderRadius: 30, border: `2px solid ${C.line}`, padding: "28px 34px", boxShadow: "0 1px 0 rgba(42,34,56,.12), 0 24px 50px rgba(30,24,48,.12)", minHeight: 440, boxSizing: "border-box" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 14 }}>
                <Sticker code="CAH03-01-06" size={90} />
                <div style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: 54, color: C.ink }}>{CARD[0][1].slice(0, typed(6, 7))}</div>
              </div>
              {CARD.slice(1).map(([k, v], i) => (
                <div key={k} style={{ display: "grid", gridTemplateColumns: "150px 1fr", gap: 14, fontFamily: BODY, fontSize: 25, lineHeight: 1.35, marginBottom: 10, opacity: f > cardAt + 10 + i * 18 ? 1 : 0 }}>
                  <span style={{ color: C.muted, fontFamily: "Menlo, 'DejaVu Sans Mono', monospace", fontSize: 21 }}>{k}</span>
                  <span style={{ color: C.ink }}>{v.slice(0, Math.floor(prog(f, cardAt + 10 + i * 18, cardAt + 26 + i * 18, (x) => x) * v.length))}</span>
                </div>
              ))}
            </div>
          </Rise>
          <div style={{ position: "absolute", right: -10, top: -26, transform: `rotate(-8deg) scale(${stamp})`, opacity: stamp > 0.02 ? 1 : 0 }}>
            <Pill size={30} bg={C.accent} color={C.accentInk} border={C.accent}>reviewed by itself · 74 cards fixed</Pill>
          </div>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 22, marginTop: 26 }}>
        <Tile n={163} label="subject cards" delay={200} accent />
        <Tile n={5118} label="course titles rated" delay={208} />
        <Tile n={695} label="campuses tagged by setting" delay={216} />
        <Tile n={499} label="apprenticeships linked" delay={224} />
      </div>
    </AbsoluteFill>
  );
};

const MuseImage: React.FC = () => {
  const f = useCurrentFrame();
  const cols = 18, rows = 9, size = 96, gx = 106, gy = 112;
  const list = STICKERS.slice(0, cols * rows);
  const ox = (1920 - cols * gx) / 2 + 5, oy = (1080 - rows * gy) / 2 + 4;
  return (
    <AbsoluteFill>
      {list.map((c, i) => {
        const col = i % cols, row = Math.floor(i / cols);
        const cx = ox + col * gx, cy = oy + row * gy;
        const dx = cx - 960, dy = cy - 540, d = Math.hypot(dx, dy);
        const p = prog(f, 6 + d / 28, 30 + d / 28);
        const fx = 960 + dx * 2.2, fy = 540 + dy * 2.2;
        const x = fx + (cx - fx) * p, y = fy + (cy - fy) * p;
        return <Sticker key={c} code={c} size={size} style={{ position: "absolute", left: x, top: y, opacity: p * (1 - 0.65 * prog(f, 70, 100)), transform: `rotate(${(1 - p) * ((i % 7) - 3) * 12}deg)` }} />;
      })}
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", opacity: prog(f, 70, 92) }}>
        <div style={{ background: "rgba(251,246,238,.94)", borderRadius: 40, padding: "54px 70px", boxShadow: "0 40px 90px rgba(30,24,48,.20)", border: `2px solid ${C.line}`, textAlign: "center", backdropFilter: "blur(6px)" }}>
          <Eyebrow delay={74}>Drew the whole paper world</Eyebrow>
          <Words text="Muse Image" size={140} delay={78} align="center" />
          <div style={{ display: "flex", gap: 40, marginTop: 30, justifyContent: "center", fontFamily: BODY, fontWeight: 600, fontSize: 26, color: C.muted }}>
            {[[162, "stickers"], [16, "window views"], [34, "card pictures"], [11, "paper pals"]].map(([n, l], i) => (
              <Rise key={l as string} delay={92 + i * 6} y={14}><div><div style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: 70, color: C.ink }}><Count to={n as number} start={94 + i * 6} dur={30} /></div>{l}</div></Rise>
            ))}
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const CODE = [
  'client = OpenAI(base_url="https://inference.baseten.co/v1")',
  'MODEL = "meta-models/muse-spark-open-1026"',
  "",
  "for subject in subjects:",
  "    card = client.chat.completions.create(",
  "        model=MODEL, messages=prompt(subject))",
  "    cards.append(review(card))",
];
const SamCode: React.FC = () => {
  const f = useCurrentFrame();
  const box = prog(f, 20, 44);
  const scan = interpolate((f - 20) % 50, [0, 50], [0, 1]);
  return (
    <AbsoluteFill style={{ flexDirection: "row", padding: "120px 110px", gap: 80 }}>
      <div style={{ flex: 1 }}>
        <Eyebrow delay={2}>Checks every sticker</Eyebrow>
        <Words text="SAM 3.1" size={110} delay={6} />
        <div style={{ position: "relative", width: 520, height: 520, marginTop: 30, background: C.paper, borderRadius: 34, border: `2px solid ${C.line}`, overflow: "hidden" }}>
          <Img src={staticFile("stickers/CAH03-01-06.webp")} style={{ position: "absolute", left: 60, top: 60, width: 400, height: 400, objectFit: "contain" }} />
          <div style={{ position: "absolute", left: 82, top: 112, width: 356 * box, height: 300 * box, border: `5px solid ${C.accent}`, borderRadius: 14, opacity: box }} />
          <div style={{ position: "absolute", left: 60, top: 60 + scan * 400, width: 400, height: 4, background: "rgba(229,154,44,.55)", opacity: f > 20 && f < 120 ? 1 : 0 }} />
          <Rise delay={46} y={10} style={{ position: "absolute", left: 82, top: 64 }}><Pill size={22} bg={C.accent} color="#fff" border={C.accent}>binoculars · found</Pill></Rise>
        </div>
      </div>
      <div style={{ flex: 1.15 }}>
        <Eyebrow delay={10}>Helped me build it</Eyebrow>
        <Words text="Muse Code" size={110} delay={14} />
        <div style={{ marginTop: 30, background: "#221c30", borderRadius: 30, padding: "34px 38px", height: 520, boxSizing: "border-box", boxShadow: "0 30px 70px rgba(30,24,48,.25)" }}>
          <div style={{ display: "flex", gap: 10, marginBottom: 26 }}>{["#e26d5c", "#e5b84c", "#7cb47a"].map((c) => <div key={c} style={{ width: 16, height: 16, borderRadius: 9, background: c }} />)}</div>
          {CODE.map((l, i) => {
            const shown = Math.floor(prog(f, 24 + i * 10, 34 + i * 10, (x) => x) * l.length);
            return <div key={i} style={{ fontFamily: "Menlo, 'DejaVu Sans Mono', monospace", fontSize: 25, lineHeight: "50px", color: i === 1 ? C.butter : "#e9e2f5", whiteSpace: "pre" }}>{l.slice(0, shown)}</div>;
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};

const OpenWeights: React.FC = () => (
  <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", flexDirection: "row", gap: 70 }}>
    <Rise delay={6} y={40} scale><Img src={staticFile("sim/buildings/sixthform.webp")} style={{ height: 520, filter: "drop-shadow(0 30px 40px rgba(30,24,48,.25))" }} /></Rise>
    <div style={{ width: 900 }}>
      <Eyebrow delay={2}>Open weights</Eyebrow>
      <Words text="A school could run all of this on its own servers." size={96} delay={6} />
      <Words text="Pupils' answers never have to leave the building." family={BODY} weight={400} size={38} color={C.muted} delay={34} stagger={2} style={{ marginTop: 26 }} />
    </div>
  </AbsoluteFill>
);

/* ---------- S8 Simulation (2:05–2:35) ---------- */
export const S8Sim: React.FC = () => (
  <Paper>
    <Sequence durationInFrames={150} layout="none"><Fader len={150}><Students /></Fader></Sequence>
    <Sequence from={136} durationInFrames={180} layout="none"><Fader len={180}><SimFootage /></Fader></Sequence>
    <Sequence from={302} durationInFrames={194} layout="none"><Fader len={194}><Sinks /></Fader></Sequence>
    <Sequence from={482} durationInFrames={164} layout="none"><Fader len={164}><Fix /></Fader></Sequence>
    <Sequence from={632} durationInFrames={88} layout="none"><Fader len={88}><Feedback /></Fader></Sequence>
    <Sequence from={706} layout="none"><Fader len={208}><LiveStudent /></Fader></Sequence>
  </Paper>
);

/** Real screen recording: the live student feed filling in, then the student on the map. */
const LiveStudent: React.FC = () => {
  const f = useCurrentFrame();
  const W = 1200, k = W / 2366;
  const mapK = 1500 / 2296;
  return (
    <AbsoluteFill style={{ alignItems: "center" }}>
      <div style={{ position: "absolute", left: 110, top: 70, width: 1700, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <Eyebrow delay={2} color={C.accent}>Or run one live</Eyebrow>
          <Words text="A new student, written and played live." size={72} delay={6} />
        </div>
        <Rise delay={14} y={14} scale><Pill size={30} bg={C.ink} color={C.butter} border={C.ink}>Live · Muse Spark Open · Baseten</Pill></Rise>
      </div>
      <Sequence durationInFrames={126} layout="none">
        <div style={{ position: "absolute", left: (1920 - W) / 2, top: 250, width: W, height: 1534 * k, borderRadius: 28, overflow: "hidden", boxShadow: "0 40px 90px rgba(30,24,48,.22)", border: `3px solid ${C.paper}`, opacity: 1 - prog(f, 118, 126) }}>
          <OffthreadVideo src={staticFile("sim2.mp4")} trimBefore={sec(24.3)} muted style={{ width: W, height: 1534 * k }} />
        </div>
      </Sequence>
      <Sequence from={120} layout="none">
        <div style={{ position: "absolute", left: 210, top: 330, width: 1500, height: 676 * mapK, borderRadius: 28, overflow: "hidden", boxShadow: "0 40px 90px rgba(30,24,48,.22)", border: `3px solid ${C.paper}`, opacity: prog(f, 120, 130) }}>
          <OffthreadVideo src={staticFile("sim2.mp4")} trimBefore={sec(33.5)} muted style={{ position: "absolute", width: 2366 * mapK, height: 1534 * mapK, left: -44 * mapK, top: -224 * mapK, maxWidth: "none" }} />
          <Rise delay={150} y={10} style={{ position: "absolute", right: 24, bottom: 20 }}><Pill size={24} bg={C.accent} color={C.accentInk} border={C.accent}>Rhys, 17 · walking to Engineering</Pill></Rise>
        </div>
      </Sequence>
    </AbsoluteFill>
  );
};

const Students: React.FC = () => {
  const f = useCurrentFrame();
  const cols = 20, rows = 10, gx = 52, gy = 60;
  const ox = 1920 - cols * gx - 100, oy = 230;
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: 110, top: 300, width: 520 }}>
        <Eyebrow delay={4}>Before any real student played</Eyebrow>
        <div style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: 220, color: C.ink, lineHeight: 0.9, letterSpacing: "-0.04em" }}><Count to={200} start={10} dur={60} /></div>
        <Words text="simulated students played every round." size={58} delay={20} />
        <Words text="Each with the subjects they'd suit written down first." family={BODY} weight={400} size={32} color={C.muted} delay={70} stagger={2} style={{ marginTop: 22 }} />
      </div>
      {Array.from({ length: 200 }, (_, i) => {
        const col = i % cols, row = Math.floor(i / cols);
        const p = prog(f, 10 + (col + row * 2) * 0.9, 30 + (col + row * 2) * 0.9);
        const hop = Math.max(0, Math.sin((f - i * 1.7) / 6)) * 4;
        return <Img key={i} src={staticFile(`characters/${PALS[(i * 7) % PALS.length]}.webp`)} style={{ position: "absolute", left: ox + col * gx, top: oy + row * gy + (1 - p) * 50 - hop, height: 54, opacity: p, transform: `scale(${0.6 + 0.4 * p})` }} />;
      })}
    </AbsoluteFill>
  );
};

const SimFootage: React.FC = () => {
  const f = useCurrentFrame();
  // canvas region inside sim.mp4 (1920x1080): x 277, y 183, w 1366, h 410
  const W = 1700, k = W / 1366;
  const z = 1 + 0.04 * prog(f, 0, 220, (x) => x);
  return (
    <AbsoluteFill style={{ alignItems: "center" }}>
      <div style={{ marginTop: 110, textAlign: "center" }}>
        <Words text="Then they walked to the subjects they'd suit." size={78} delay={4} align="center" />
      </div>
      <div style={{ marginTop: 50, width: W, height: 410 * k, borderRadius: 34, overflow: "hidden", position: "relative", boxShadow: "0 40px 90px rgba(30,24,48,.22)", border: `3px solid ${C.paper}`, transform: `scale(${z})` }}>
        <OffthreadVideo src={staticFile("sim.mp4")} trimBefore={sec(0.6)} muted style={{ position: "absolute", width: 1920 * k, height: 1080 * k, left: -277 * k, top: -183 * k, maxWidth: "none" }} />
      </div>
      <Rise delay={30} y={14} style={{ marginTop: 34 }}><div style={{ fontFamily: BODY, fontSize: 28, color: C.muted }}>findyourinkling.com/simulation</div></Rise>
    </AbsoluteFill>
  );
};

const SINKS = [["Zoology", 45, 1], ["Biology", 41, 2], ["Ecology", 41, 2], ["Engineering", 31, 4]] as const;
const Sinks: React.FC = () => {
  const f = useCurrentFrame();
  const max = 45, W = 980;
  return (
    <AbsoluteFill style={{ padding: "120px 120px", flexDirection: "row", gap: 90 }}>
      <div style={{ width: 600 }}>
        <Eyebrow delay={2}>What the simulation showed</Eyebrow>
        <Words text="Where the scoring needed work." size={100} delay={6} />
        <Words text="Broad subjects matched so many keywords that they came up for everyone." family={BODY} weight={400} size={34} color={C.muted} delay={28} stagger={2} style={{ marginTop: 26 }} />
      </div>
      <div style={{ flex: 1, paddingTop: 70 }}>
        <div style={{ display: "flex", gap: 30, fontFamily: BODY, fontWeight: 600, fontSize: 24, color: C.muted, marginBottom: 30 }}>
          <span><span style={{ display: "inline-block", width: 18, height: 18, borderRadius: 4, background: C.lilac, marginRight: 10 }} />In their top 3</span>
          <span><span style={{ display: "inline-block", width: 18, height: 18, borderRadius: 4, background: C.accent, marginRight: 10 }} />Actually suited them</span>
        </div>
        {SINKS.map(([name, top, suit], i) => {
          const p = prog(f, 24 + i * 10, 64 + i * 10);
          const hl = i === 0;
          return (
            <div key={name} style={{ marginBottom: 34, opacity: hl ? 1 : 1 - 0.4 * prog(f, 120, 140) }}>
              <div style={{ fontFamily: hl ? DISPLAY : BODY, fontWeight: hl ? 900 : 600, fontSize: hl ? 46 : 30, color: C.ink, marginBottom: 10 }}>{name}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
                <div style={{ height: hl ? 44 : 30, width: (W * top / max) * p, background: C.lilac, borderRadius: 10 }} />
                <span style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: hl ? 44 : 30, color: C.ink, opacity: p }}><Count to={top} start={24 + i * 10} dur={40} /></span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 18, marginTop: 8 }}>
                <div style={{ height: hl ? 44 : 30, width: Math.max(10, (W * suit / max) * p), background: C.accent, borderRadius: 10 }} />
                <span style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: hl ? 44 : 30, color: C.accent, opacity: p }}>{suit}</span>
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

const Fix: React.FC = () => {
  const f = useCurrentFrame();
  const v = 38 + 16 * prog(f, 36, 80, EASE);
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      <Eyebrow delay={2}>After the fix, on students it had never seen</Eyebrow>
      <div style={{ display: "flex", alignItems: "baseline", gap: 40 }}>
        <Rise delay={6}><div style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: 200, color: C.muted, opacity: 0.55, letterSpacing: "-0.04em" }}>38%</div></Rise>
        <Rise delay={20}><div style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: 120, color: C.muted }}>→</div></Rise>
        <Rise delay={30}><div style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: 340, color: C.ink, lineHeight: 1, letterSpacing: "-0.05em" }}>{Math.round(v)}%</div></Rise>
      </div>
      <div style={{ width: 1200, height: 28, borderRadius: 14, background: "rgba(42,34,56,.1)", marginTop: 20, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${v}%`, background: C.accent, borderRadius: 14 }} />
      </div>
      <Words text="of students had a subject that fits them in their top 3." family={BODY} weight={600} size={40} color={C.ink} delay={50} stagger={2} align="center" style={{ marginTop: 34 }} />
      <Rise delay={120} y={20} style={{ marginTop: 40 }}>
        <Pill size={30}><span style={{ fontFamily: DISPLAY, fontWeight: 900 }}>53 → 99</span> subjects that can make someone's top 3</Pill>
      </Rise>
    </AbsoluteFill>
  );
};

/* ---------- S9 Built this week (2:35–2:43) ---------- */
const DAYS = [["Mon 26", 2], ["Tue 27", 3], ["Wed 28", 0], ["Thu 29", 0], ["Fri 30", 8], ["Sat 31", 11], ["Sun 1", 70], ["Mon 2", 4], ["Tue 3", 2]] as const;
export const S9Built: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <Paper>
      <div style={{ position: "absolute", left: 120, top: 150, width: 640 }}>
        <Eyebrow delay={2}>26 Oct – 4 Nov</Eyebrow>
        <Words text="Built for this hackathon, from an empty repo." size={92} delay={6} />
        <Rise delay={40} y={16} style={{ marginTop: 30 }}>
          <div style={{ fontFamily: BODY, fontSize: 30, color: C.muted }}><span style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: 64, color: C.ink }}><Count to={100} start={40} dur={50} /></span> commits</div>
        </Rise>
      </div>
      <div style={{ position: "absolute", left: 860, bottom: 230, display: "flex", alignItems: "flex-end", gap: 20, height: 560 }}>
        {DAYS.map(([d, n], i) => {
          const p = prog(f, 16 + i * 5, 50 + i * 5);
          return (
            <div key={d} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, width: 92 }}>
              <div style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: 30, color: C.ink, opacity: p }}>{n || ""}</div>
              <div style={{ width: 70, height: Math.max(6, (n / 70) * 470 * p), background: n >= 70 ? C.accent : C.lilac, borderRadius: 12 }} />
              <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: 22, color: C.muted }}>{d}</div>
            </div>
          );
        })}
      </div>
      <Rise delay={110} y={16} style={{ position: "absolute", left: 120, right: 120, bottom: 80 }}>
        <div style={{ display: "flex", gap: 18, alignItems: "center", fontFamily: BODY, fontSize: 26, color: C.muted, borderTop: `2px solid ${C.line}`, paddingTop: 28 }}>
          Real data from <Pill size={24}>Discover Uni (HESA)</Pill><Pill size={24}>O*NET</Pill><Pill size={24}>Skills England</Pill>
        </div>
      </Rise>
    </Paper>
  );
};

/* ---------- S10 End card (2:43–2:50) ---------- */
export const S10End: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <Paper>
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 50 }}>
          <div style={{ transform: `rotate(${Math.sin(f / 5) * 6}deg)`, transformOrigin: "50% 90%" }}><Pal paper="lined" h={300} delay={0} /></div>
          <div>
            <Words text="Find your inkling." size={150} delay={6} />
            <div style={{ display: "flex", gap: 20, alignItems: "center", marginTop: 34 }}>
              <Rise delay={26} y={20} scale><Pill size={44} bg={C.accent} color={C.accentInk} border={C.accent}>findyourinkling.com</Pill></Rise>
              <Rise delay={34} y={20}><div style={{ fontFamily: BODY, fontSize: 30, color: C.muted }}>Free · no sign-up · any phone</div></Rise>
            </div>
          </div>
        </div>
      </AbsoluteFill>
      <Rise delay={50} y={10} style={{ position: "absolute", bottom: 60, width: "100%", textAlign: "center" }}>
        <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: 24, color: C.muted }}>Built with Meta Muse · Muse Spark Open on Baseten · Muse Image · SAM 3.1 · Muse Code</div>
      </Rise>
    </Paper>
  );
};

/* ---------- feedback beat (after the fix): the real prompt, captured from the live build ---------- */
export const Feedback: React.FC = () => {
  const f = useCurrentFrame();
  const phone = useSpring(4, { damping: 18, stiffness: 90 });
  const tapAt = 66;
  const press = prog(f, tapAt, tapAt + 8);
  const ring = prog(f, tapAt + 4, tapAt + 28);
  const swap = prog(f, tapAt + 10, tapAt + 22, EASE_IN_OUT);
  // button centre in the 390-wide capture: (161, 677) -> phone screen 403 wide
  const k = 403 / 390, bx = 161 * k, by = 677 * k;
  return (
    <AbsoluteFill style={{ flexDirection: "row", alignItems: "center", padding: "0 150px", gap: 140 }}>
      <div style={{ width: 800 }}>
        <Eyebrow delay={2}>Next, real students</Eyebrow>
        <Words text="Every thumbs up or down tunes the weightings." size={100} delay={6} />
        <Words text="Anonymous: the vote, the answers and the result. No names or accounts." family={BODY} weight={400} size={36} color={C.muted} delay={32} stagger={2} style={{ marginTop: 26 }} />
      </div>
      <div style={{ transform: `translateY(${(1 - phone) * 700}px)` }}>
        <Phone h={900}>
          <Img src={staticFile("fb_ask.png")} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 1 - swap }} />
          <Img src={staticFile("fb_thanks.png")} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: swap }} />
          <div style={{ position: "absolute", left: bx - 30, top: by - 30, width: 60, height: 60, borderRadius: 40, background: "rgba(42,34,56,.18)", opacity: press > 0 && swap < 1 ? 1 - swap : 0, transform: `scale(${0.6 + 0.4 * press})` }} />
          <div style={{ position: "absolute", left: bx - 34, top: by - 34, width: 68, height: 68, borderRadius: 40, border: `4px solid ${C.accent}`, opacity: ring > 0 ? 1 - ring : 0, transform: `scale(${1 + ring * 0.8})` }} />
        </Phone>
      </div>
    </AbsoluteFill>
  );
};
