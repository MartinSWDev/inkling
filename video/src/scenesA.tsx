import React from "react";
import { AbsoluteFill, Freeze, Img, OffthreadVideo, Sequence, interpolate, staticFile, useCurrentFrame } from "remotion";
import { BODY, C, Count, DISPLAY, EASE, EASE_IN_OUT, Eyebrow, Pal, Paper, Phone, PhoneClip, Pill, Rise, Sticker, Words, prog, sec, useSpring } from "./kit";
import { STICKERS } from "./assets";
import TITLES from "./course_titles.json";

/* ---------- S1 Hook (0:00–0:24) ---------- */
export const S1Hook: React.FC = () => {
  const f = useCurrentFrame();
  const aOut = prog(f, 96, 110, EASE_IN_OUT);              // hello
  const bIn = prog(f, 100, 118), bOut = prog(f, 380, 398, EASE_IN_OUT); // catalogue
  const cIn = prog(f, 392, 408), cOut = prog(f, 540, 556, EASE_IN_OUT); // number
  const dIn = prog(f, 550, 566);                            // wordmark
  return (
    <Paper>
      {/* A: who I am */}
      <AbsoluteFill style={{ opacity: 1 - aOut, justifyContent: "center", alignItems: "center", flexDirection: "row", gap: 56, transform: `translateY(${-aOut * 40}px)` }}>
        <Pal paper="lined" h={300} delay={2} bob={6} />
        <div>
          <Words text="Hi, I'm Martin." size={150} delay={10} stagger={5} />
          <Words text="I build university websites." family={BODY} weight={600} size={54} color={C.muted} delay={54} stagger={3} style={{ marginTop: 18 }} />
        </div>
      </AbsoluteFill>
      {/* B: the catalogue problem */}
      <AbsoluteFill style={{ opacity: bIn * (1 - bOut) }}>
        <Catalogue start={100} />
      </AbsoluteFill>
      {/* C: the number */}
      <AbsoluteFill style={{ opacity: cIn * (1 - cOut), justifyContent: "center", alignItems: "center", transform: `scale(${1 + cOut * 0.06})` }}>
        <div style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: 330, color: C.ink, letterSpacing: "-0.04em", lineHeight: 1 }}>
          <Count to={344760} start={396} dur={52} />
        </div>
        <Words text="UK school leavers applied to uni this year." family={BODY} weight={600} size={54} color={C.ink} delay={416} stagger={3} style={{ marginTop: 64 }} align="center" />
        <Rise delay={432} style={{ position: "absolute", bottom: 70 }}>
          <div style={{ fontFamily: BODY, fontSize: 24, color: C.muted }}>UCAS, 30 June 2026 deadline</div>
        </Rise>
      </AbsoluteFill>
      {/* D: what I built */}
      <AbsoluteFill style={{ opacity: dIn, justifyContent: "center", alignItems: "center" }}>
        <StickerRing start={552} />
        <Words text="So for this hackathon, I built" family={BODY} weight={600} size={44} color={C.muted} delay={558} align="center" />
        <div style={{ display: "flex", alignItems: "center", gap: 30, marginTop: 6 }}>
          <Wordmark start={574} />
          <Pal paper="lined" h={200} delay={594} bob={5} />
        </div>
        <Words text="Four quick rounds to confirm your inkling, then explore from there." family={BODY} weight={400} size={46} delay={614} stagger={2} align="center" style={{ marginTop: 18 }} />
        <Words text="Let me show you." size={58} weight={700} color={C.accent} delay={750} align="center" style={{ marginTop: 40 }} />
      </AbsoluteFill>
    </Paper>
  );
};

/** A generic, unbranded university course finder: a search box nobody knows what to type into,
 * over an endless catalogue of real course titles. */
const Catalogue: React.FC<{ start: number }> = ({ start }) => {
  const f = useCurrentFrame() - start;
  const titles = TITLES as string[];
  const scroll = Math.max(0, f - 20) * 9;
  const caret = Math.floor(f / 15) % 2 === 0;
  const win = useSpring(start, { damping: 18, stiffness: 90 });
  const strike = prog(f, 150, 170);
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: 120, top: 120, width: 980, height: 840, background: C.paper, borderRadius: 30, border: `2px solid ${C.line}`, overflow: "hidden",
        boxShadow: "0 40px 90px rgba(30,24,48,.18)", transform: `translateY(${(1 - win) * 120}px)`, opacity: win }}>
        <div style={{ height: 54, background: "#efe6d8", display: "flex", alignItems: "center", gap: 10, padding: "0 22px", borderBottom: `2px solid ${C.line}` }}>
          {["#e26d5c", "#e5b84c", "#7cb47a"].map((c) => <div key={c} style={{ width: 14, height: 14, borderRadius: 8, background: c }} />)}
          <div style={{ marginLeft: 20, flex: 1, height: 30, borderRadius: 8, background: C.paper, fontFamily: BODY, fontSize: 17, color: C.muted, display: "flex", alignItems: "center", padding: "0 14px" }}>Course finder</div>
        </div>
        <div style={{ padding: "34px 40px 0" }}>
          <div style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: 54, color: C.ink }}>Find your course</div>
          <div style={{ marginTop: 20, height: 74, borderRadius: 16, border: `2.5px solid ${C.ink}`, background: "#fff", display: "flex", alignItems: "center", padding: "0 24px", fontFamily: BODY, fontSize: 30, color: C.muted }}>
            <span style={{ width: 3, height: 34, background: caret ? C.ink : "transparent", marginRight: 10 }} />Search 400+ courses
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 18 }}>
            {["Subject", "Level", "Study mode", "Start date"].map((t) => <Pill key={t} size={20}>{t} ▾</Pill>)}
          </div>
        </div>
        <div style={{ position: "absolute", left: 40, right: 40, top: 330, bottom: 0, overflow: "hidden" }}>
          <div style={{ transform: `translateY(${-scroll}px)`, display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 14 }}>
            {titles.slice(0, 160).map((t, i) => (
              <div key={i} style={{ height: 92, borderRadius: 14, border: `1.5px solid ${C.line}`, background: "#fff", padding: "14px 18px", boxSizing: "border-box" }}>
                <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: 20, color: C.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t}</div>
                <div style={{ fontFamily: BODY, fontSize: 16, color: C.muted, marginTop: 6 }}>{["BSc (Hons)", "BA (Hons)", "MEng", "BSc (Hons) with placement"][i % 4]} · 3 years</div>
              </div>
            ))}
          </div>
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 160, background: `linear-gradient(rgba(251,246,238,0), ${C.paper})` }} />
        </div>
      </div>
      <div style={{ position: "absolute", left: 1190, top: 280, width: 640 }}>
        <div style={{ position: "relative", display: "inline-block" }}>
          <Words text="Built for students who already know what they want." size={78} delay={start + 40} />
          <div style={{ position: "absolute", left: 0, top: "52%", height: 8, width: `${strike * 100}%`, background: C.accent, borderRadius: 4 }} />
        </div>
        <Words text="Many don't." size={120} color={C.accent} delay={start + 176} style={{ marginTop: 34 }} />
        <Rise delay={start + 196} style={{ marginTop: 34 }}>
          <div style={{ background: C.paper, border: `2px solid ${C.line}`, borderRadius: 26, padding: "20px 26px", display: "inline-flex", alignItems: "center", gap: 20, boxShadow: "0 20px 40px rgba(30,24,48,.12)" }}>
            <div style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: 76, color: C.accent, lineHeight: 1 }}><Count to={27} start={start + 198} dur={30} suffix="%" /></div>
            <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: 24, color: C.ink, lineHeight: 1.25 }}>of graduates would pick<br />a different course<div style={{ fontWeight: 400, fontSize: 17, color: C.muted, marginTop: 6 }}>Bristol, HEPI and Advance HE, 2025</div></div>
          </div>
        </Rise>
      </div>
    </AbsoluteFill>
  );
};

const Wordmark: React.FC<{ start: number }> = ({ start }) => {
  const f = useCurrentFrame();
  return (
    <div style={{ display: "flex", fontFamily: DISPLAY, fontWeight: 900, fontSize: 250, color: C.ink, letterSpacing: "-0.04em", lineHeight: 1 }}>
      {"Inkling".split("").map((ch, i) => {
        const p = prog(f, start + i * 3, start + i * 3 + 18);
        return <span key={i} style={{ display: "inline-block", transform: `translateY(${(1 - p) * 60}px) rotate(${(1 - p) * (i % 2 ? 8 : -8)}deg)`, opacity: p }}>{ch}</span>;
      })}
    </div>
  );
};

const RING = ["CAH09-01-01", "CAH03-01-06", "CAH13-01-01", "CAH11-01-01", "CAH25-01-02", "CAH20-01-01", "CAH02-02-02", "CAH10-01-07", "CAH07-01-01", "CAH19-01-01", "CAH06-01-01", "CAH17-01-01"];
const StickerRing: React.FC<{ start: number }> = ({ start }) => {
  const f = useCurrentFrame();
  const list = RING.filter((c) => STICKERS.includes(c)).concat(STICKERS.slice(40, 52)).slice(0, 12);
  return (
    <AbsoluteFill>
      {list.map((c, i) => {
        const a = (i / list.length) * Math.PI * 2 + (f - start) / 260;
        const p = prog(f, start + i * 2, start + i * 2 + 26);
        const rx = 820 * (0.75 + 0.25 * p), ry = 400 * (0.75 + 0.25 * p);
        return <Sticker key={c} code={c} size={120} style={{ position: "absolute", left: 960 + Math.cos(a) * rx - 60, top: 540 + Math.sin(a) * ry - 60, opacity: p * 0.9, transform: `rotate(${Math.sin(a * 3) * 10}deg)` }} />;
      })}
    </AbsoluteFill>
  );
};

/* ---------- phone scene scaffold ---------- */
const PhoneStage: React.FC<{ x?: number; children: React.ReactNode; enter?: boolean; scale?: number }> = ({ x = 560, children, enter = true, scale = 1 }) => {
  const p = useSpring(0, { damping: 18, stiffness: 90, mass: 1 });
  const y = enter ? (1 - p) * 900 : 0;
  return (
    <div style={{ position: "absolute", left: x, top: 540, transform: `translate(-50%,-50%) translateY(${y}px) scale(${scale})` }}>
      <Phone h={900}>{children}</Phone>
    </div>
  );
};
const Copy: React.FC<{ x?: number; w?: number; children: React.ReactNode; top?: number }> = ({ x = 980, w = 820, children, top = 300 }) => (
  <div style={{ position: "absolute", left: x, top, width: w }}>{children}</div>
);
const RoundDots: React.FC<{ on: number; delay?: number }> = ({ on, delay = 0 }) => (
  <Rise delay={delay} y={10}>
    <div style={{ display: "flex", gap: 12, marginTop: 34 }}>
      {[1, 2, 3, 4].map((i) => <div key={i} style={{ width: 70, height: 10, borderRadius: 6, background: i <= on ? C.accent : "rgba(42,34,56,.12)" }} />)}
    </div>
  </Rise>
);

/* ---------- S2 Round 1 (16s) ---------- */
export const S2Round1: React.FC = () => (
  <Paper>
    <PhoneStage><PhoneClip from={5.0} /></PhoneStage>
    <Copy top={250}>
      <Eyebrow delay={10} out={166}>Inkling, noun</Eyebrow>
      <Words text="What's an inkling?" size={120} delay={16} out={166} />
      <Words text="That feeling you sort of know what you'd like to do, but you're not sure." family={BODY} weight={400} size={38} color={C.muted} delay={40} stagger={2} out={166} style={{ marginTop: 24 }} />
    </Copy>
    <Sequence from={180} layout="none">
      <Copy>
        <Eyebrow n="01" delay={0}>Round 1 of 4</Eyebrow>
        <Words text="Tap the subjects you take." size={110} delay={4} />
        <RoundDots on={1} delay={12} />
      </Copy>
    </Sequence>
    <Sequence from={330} layout="none">
      <Copy top={700}>
        <Words text="Not listed? Start typing and pick it." family={BODY} weight={600} size={38} color={C.muted} delay={0} stagger={2} />
        <div style={{ display: "flex", gap: 14, marginTop: 20, flexWrap: "wrap" }}>
          {["A-levels", "BTECs", "T-levels", "Highers"].map((t, i) => <Rise key={t} delay={10 + i * 5} y={20} scale><Pill bg={i === 0 ? C.lilac : C.paper} size={30}>{t}</Pill></Rise>)}
        </div>
      </Copy>
    </Sequence>
  </Paper>
);

/* ---------- S3 Rounds 2–4 (0:30–0:50) ---------- */
const CLIPS3 = [
  { from: 24.0, len: 4.5, n: "02", round: 2, label: "Round 2", head: "Things you'd get stuck into.", sub: "Swipe right for yes, left for no." },
  { from: 34.3, len: 2.2, n: "02", round: 2, label: "End of each round", head: "Everything you choose lands in your room.", sub: "" },
  { from: 36.4, len: 4.0, n: "03", round: 3, label: "Round 3", head: "This or that.", sub: "Pick the picture that's more you." },
  { from: 46.0, len: 3.5, n: "04", round: 4, label: "Round 4", head: "Questions you'd want answered.", sub: "Swipe up if you really want to know." },
  { from: 56.0, len: 0.8, n: "04", round: 4, label: "Round 4", head: "Questions you'd want answered.", sub: "" },
];
export const S3Rounds: React.FC = () => {
  let t = 0;
  const seq = CLIPS3.map((c) => { const s = { ...c, start: t, dur: sec(c.len) }; t += sec(c.len); return s; });
  return (
    <Paper>
      <PhoneStage enter={false}>
        {seq.map((c, i) => (
          <Sequence key={i} from={c.start} durationInFrames={c.dur + (i < seq.length - 1 ? 6 : 20)} layout="none">
            <ClipFade first={i === 0}><PhoneClip from={c.from} /></ClipFade>
          </Sequence>
        ))}
      </PhoneStage>
      {seq.map((c, i) => {
        const prev = seq[i - 1];
        const same = prev && prev.head === c.head;
        return (
          <Sequence key={"c" + i} from={c.start} durationInFrames={c.dur} layout="none">
            <Copy>
              <Eyebrow n={c.n} delay={same ? -30 : 2}>{c.label}</Eyebrow>
              <Words text={c.head} size={c.head.length > 24 ? 100 : 116} delay={same ? -30 : 6} />
              {c.sub && <Words text={c.sub} family={BODY} weight={400} size={38} color={C.muted} delay={same ? -30 : 16} stagger={2} style={{ marginTop: 22 }} />}
              <RoundDots on={c.round} delay={-30} />
            </Copy>
          </Sequence>
        );
      })}
    </Paper>
  );
};
const ClipFade: React.FC<{ children: React.ReactNode; first?: boolean }> = ({ children, first }) => {
  const f = useCurrentFrame();
  const o = first ? 1 : prog(f, 0, 6);
  return <AbsoluteFill style={{ opacity: o }}>{children}</AbsoluteFill>;
};

/* ---------- S4 Room reveal (0:50–1:10) ---------- */
export const S4Reveal: React.FC = () => {
  const f = useCurrentFrame();
  const scale = 1 + 0.06 * prog(f, 0, 40);
  return (
    <Paper>
      <div style={{ position: "absolute", left: 960, top: 540, transform: `translate(-50%,-50%) scale(${scale})` }}>
        <Phone h={900}>
          <Sequence durationInFrames={sec(18.4)} layout="none"><PhoneClip from={59.8} /></Sequence>
        </Phone>
      </div>
      {/* left column */}
      <div style={{ position: "absolute", left: 110, top: 330, width: 560 }}>
        <Words text="This is your room." size={104} delay={14} out={212} />
        <Sequence from={225} layout="none">
          <Eyebrow delay={0}>Your top 3</Eyebrow>
          <div style={{ display: "flex", flexDirection: "column", gap: 16, alignItems: "flex-start" }}>
            {["Performing arts", "Forensic & archaeological sciences", "Chemistry"].map((t, i) => <Rise key={t} delay={6 + i * 7} y={24}><Pill size={40} bg={C.paper}><span style={{ fontFamily: DISPLAY, fontWeight: 900, color: C.accent }}>{i + 1}</span>{t}</Pill></Rise>)}
          </div>
        </Sequence>
      </div>
      {/* right column */}
      <div style={{ position: "absolute", left: 1290, top: 360, width: 520 }}>
        <Sequence from={110} durationInFrames={250} layout="none">
          <Words text="Tap any object to see its subject." family={BODY} weight={600} size={46} color={C.ink} delay={0} stagger={2} out={236} />
        </Sequence>
        <Sequence from={400} layout="none">
          <Eyebrow delay={0} color={C.accent}>+ a wildcard</Eyebrow>
          <Words text="One you'd never have gone looking for." size={72} delay={4} />
          <Rise delay={64} y={20} scale style={{ marginTop: 24 }}><Pill size={40} bg={C.butter} border={C.accent}>Dance</Pill></Rise>
        </Sequence>
      </div>
    </Paper>
  );
};


/* ---------- S4b Your inkling, written live (9s) ---------- */
const REQ_LINES = [
  ["POST /api/inkling", "→ Muse Spark 1.2 · Meta Model API"],
  ["x-provider: meta", "streaming · 60 words"],
  ["POST /api/pal", "→ Muse Image · one paper pal"],
];
export const S4Inkling: React.FC = () => {
  const f = useCurrentFrame();
  const typed = (i: number, len: number) => Math.floor(prog(f, 30 + i * 14, 44 + i * 14, (x) => x) * len);
  return (
    <Paper>
      <PhoneStage enter={false}>
        <Sequence durationInFrames={198} layout="none"><PhoneClip from={100.3} /></Sequence>
        <Sequence from={198} layout="none"><Freeze frame={0}><PhoneClip from={106.6} /></Freeze></Sequence>
      </PhoneStage>
      <Copy top={200}>
        <Eyebrow delay={4} color={C.accent}>Live, while you play</Eyebrow>
        <Words text="Your inkling, written for you." size={104} delay={8} />
        <Words text="Muse Spark reads your answers and says why your top subject fits. Muse Image draws your paper pal." family={BODY} weight={400} size={34} color={C.muted} delay={30} stagger={2} style={{ marginTop: 20 }} />
        <Rise delay={26} y={24} scale style={{ marginTop: 34 }}>
          <div style={{ background: "#221c30", borderRadius: 26, padding: "26px 32px", boxShadow: "0 30px 70px rgba(30,24,48,.25)", width: 800, boxSizing: "border-box" }}>
            <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>{["#e26d5c", "#e5b84c", "#7cb47a"].map((c) => <div key={c} style={{ width: 14, height: 14, borderRadius: 8, background: c }} />)}</div>
            {REQ_LINES.map(([a, b], i) => (
              <div key={a} style={{ display: "flex", justifyContent: "space-between", fontFamily: "Menlo, 'DejaVu Sans Mono', monospace", fontSize: 24, lineHeight: "46px", whiteSpace: "pre" }}>
                <span style={{ color: "#e9e2f5" }}>{a.slice(0, typed(i, a.length))}</span>
                <span style={{ color: i === 1 ? "#9fd3a0" : C.butter }}>{b.slice(0, typed(i, b.length))}</span>
              </div>
            ))}
          </div>
        </Rise>
        <div style={{ display: "flex", gap: 14, marginTop: 30, flexWrap: "wrap" }}>
          <Rise delay={120} y={16} scale><Pill size={28} bg={C.ink} color={C.butter} border={C.ink}>Live · Muse Spark · Meta Model API</Pill></Rise>
          <Rise delay={128} y={16} scale><Pill size={28} bg={C.butter} border={C.accent}>Live · Muse Image</Pill></Rise>
        </div>
      </Copy>
    </Paper>
  );
};

/* ---------- S5 Courses & apprenticeships (1:10–1:25) ---------- */
export const S5Courses: React.FC = () => { const f = useCurrentFrame(); const out = prog(f, 236, 254, EASE_IN_OUT); return (
  <Paper>
    <PhoneStage enter={false}>
      <Sequence durationInFrames={sec(3.5) + 6} layout="none"><PhoneClip from={86.0} /></Sequence>
      <Sequence from={sec(3.5)} layout="none"><ClipFade><PhoneClip from={89.6} /></ClipFade></Sequence>
    </PhoneStage>
    <div style={{ opacity: 1 - out, transform: `translateY(${-out * 40}px)` }}><Copy top={250}>
      <Eyebrow delay={4}>Real data, not AI guesses</Eyebrow>
      <Words text="Real UK courses." size={116} delay={8} />
      <Rise delay={24} y={16}>
        <div style={{ display: "flex", gap: 40, marginTop: 30, fontFamily: BODY, color: C.muted, fontSize: 28 }}>
          <div><div style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: 72, color: C.ink }}><Count to={28753} start={26} dur={40} /></div>courses</div>
          <div><div style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: 72, color: C.ink }}><Count to={315} start={30} dur={40} /></div>providers</div>
          <div style={{ alignSelf: "flex-end", paddingBottom: 6 }}>Discover Uni (HESA)</div>
        </div>
      </Rise>
      <Sequence from={120} layout="none">
        <div style={{ marginTop: 50 }}>
          <Words text="By city, coast, campus town or countryside." family={BODY} weight={600} size={36} color={C.ink} stagger={2} />
          <div style={{ display: "flex", gap: 12, marginTop: 18 }}>
            {[["City", C.lilac], ["Coast", "#cfe3ee"], ["Campus town", C.sage], ["Countryside", C.butter]].map(([t, b], i) => <Rise key={t} delay={10 + i * 5} y={18} scale><Pill bg={b} size={26}>{t}</Pill></Rise>)}
          </div>
        </div>
      </Sequence>
    </Copy></div>
    <Sequence from={246} layout="none">
      <ApprCard />
    </Sequence>
  </Paper>
); };
const ApprCard: React.FC = () => {
  const p = useSpring(0, { damping: 16, stiffness: 110 });
  const items = [["Archaeological specialist (degree)", "Degree apprenticeship · about 3 years · degree included"], ["Cultural heritage conservator (degree)", "Degree apprenticeship · about 3 years · degree included"]];
  return (
    <div style={{ position: "absolute", left: 980, top: 300, width: 820, transform: `translateY(${(1 - p) * 120}px) rotate(${(1 - p) * 4 - 1}deg)`, opacity: p,
      background: C.paper, borderRadius: 30, border: `2px solid ${C.line}`, padding: "30px 36px", boxShadow: "0 30px 70px rgba(30,24,48,.18)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: 46, color: C.ink }}>Rather earn while you learn?</div>
      </div>
      {items.map(([a, b], i) => (
        <Rise key={a} delay={12 + i * 8} y={14}>
          <div style={{ marginTop: 18, paddingTop: 16, borderTop: `1.5px solid ${C.line}` }}>
            <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: 28, color: C.ink }}>{a}</div>
            <div style={{ fontFamily: BODY, fontSize: 22, color: C.muted, marginTop: 4 }}>{b}</div>
          </div>
        </Rise>
      ))}
      <Rise delay={34} y={10}><div style={{ marginTop: 18, fontFamily: BODY, fontWeight: 600, fontSize: 24, color: C.teal }}><Count to={499} start={34} dur={30} /> live apprenticeship standards, linked to subjects</div></Rise>
    </div>
  );
};

/* ---------- S6 Share (1:25–1:35) ---------- */
export const S6Share: React.FC = () => {
  const f = useCurrentFrame();
  const sv = useSpring(18, { damping: 16, stiffness: 100 });
  const draw = prog(f, 20, 50);
  return (
    <Paper>
      <div style={{ position: "absolute", left: 120, top: 330, width: 560 }}>
        <Eyebrow delay={4}>Made for sharing</Eyebrow>
        <Words text="A 10-second video of your room." size={96} delay={8} />
        <Words text="With your top 3, ready for Instagram, TikTok or WhatsApp." family={BODY} weight={400} size={34} color={C.muted} delay={26} stagger={2} style={{ marginTop: 24 }} />
      </div>
      <PhoneStage x={960} enter={false}>
        <Freeze frame={0}><PhoneClip from={112.5} /></Freeze>
      </PhoneStage>
      <svg width={1920} height={1080} style={{ position: "absolute", left: 0, top: 0 }}>
        <path d="M 1190 420 C 1290 330, 1350 330, 1420 400" fill="none" stroke={C.accent} strokeWidth={6} strokeLinecap="round" strokeDasharray="14 14" pathLength={1} style={{ strokeDasharray: `${draw} 1`, strokeDashoffset: 0 }} />
      </svg>
      <div style={{ position: "absolute", left: 1610, top: 560, transform: `translate(-50%,-50%) rotate(${3 - 3 * sv + 3}deg) scale(${0.85 + 0.15 * sv})`, opacity: sv }}>
        <div style={{ width: 430, height: 764, borderRadius: 36, overflow: "hidden", boxShadow: "0 40px 90px rgba(30,24,48,.3)", border: `8px solid ${C.paper}` }}>
          <Sequence from={18} layout="none">
            <OffthreadVideo src={staticFile("sharevideo.mp4")} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </Sequence>
        </div>
      </div>
    </Paper>
  );
};

/* ---------- S1 Intro (10s): who I am, built this week ---------- */
export const S1Intro: React.FC = () => {
  const f = useCurrentFrame();
  const aOut = prog(f, 150, 164, EASE_IN_OUT);
  const bIn = prog(f, 156, 172);
  return (
    <Paper>
      <AbsoluteFill style={{ opacity: 1 - aOut, justifyContent: "center", alignItems: "center", flexDirection: "row", gap: 56, transform: `translateY(${-aOut * 40}px)` }}>
        <Pal paper="lined" h={300} delay={2} bob={6} />
        <div>
          <Words text="Hi, I'm Martin." size={150} delay={8} stagger={5} />
          <Words text="I build university websites. I see this every day." family={BODY} weight={600} size={50} color={C.muted} delay={50} stagger={3} style={{ marginTop: 18 }} />
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{ opacity: bIn, justifyContent: "center", alignItems: "center" }}>
        <StickerRing start={160} />
        <Words text="So for this hackathon, from an empty repo, I built" family={BODY} weight={600} size={44} color={C.muted} delay={166} align="center" />
        <div style={{ display: "flex", alignItems: "center", gap: 30, marginTop: 6 }}>
          <Wordmark start={182} />
          <Pal paper="lined" h={200} delay={202} bob={5} />
        </div>
        <Rise delay={214} y={14} style={{ marginTop: 22 }}><Pill size={30}>26 Oct – 4 Nov 2026 · 100 commits · all new</Pill></Rise>
        <Words text="Let me show you." size={58} weight={700} color={C.accent} delay={250} align="center" style={{ marginTop: 34 }} />
      </AbsoluteFill>
    </Paper>
  );
};
