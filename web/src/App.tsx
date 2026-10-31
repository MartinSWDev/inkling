import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Answers, DeckCard, Pair, Subject, emptyAnswers, fetchContent, fetchSubjects } from "./api";
import { RoomView, assignStickers, composeRoomCanvas, download, useRoomAssets } from "./Room";
import { qualifiedSubjects, scoreAnswers } from "./scoring";
import { ROUND_CAPS, ensureFloorOrBed, growRoom } from "./roomRules";

const ROUNDS = [
  { id: "subjects", label: "Round 1 · Your subjects", short: "Your subjects", min: 3 },
  { id: "things", label: "Round 2 · Things", short: "Things", min: 5 },
  { id: "pairs", label: "Round 3 · This or that", short: "This or that", min: 5 },
  { id: "questions", label: "Round 4 · Big questions", short: "Big questions", min: 5 },
];
const VIEWS = [{ id: "city", name: "City" }, { id: "coast", name: "Coast" }, { id: "campus", name: "Campus town" }, { id: "country", name: "Countryside" }];
const SCENES: Record<string, [string, string]> = { sea: ["#1f6f8b", "#8fd0e6"], desk: ["#5a4a7a", "#c9b7e8"], wood: ["#6e4329", "#d9b48f"], night: ["#1c1a3a", "#6b5aa8"], dark: ["#101418", "#2f3a48"], green: ["#2f6b3a", "#a9d9a0"], light: ["#e8dfd0", "#fff8ea"] };

function heat(roundIdx: number, n: number) {
  if (roundIdx === 2) return n / 5;
  if (roundIdx === 0) return 1 - Math.exp(-n / 3.2);
  return 1 - Math.exp(-n / 5.1);
}

function CardArt({ card }: { card: DeckCard }) {
  const [failed, setFailed] = useState(false);
  const [a, b] = SCENES[card.scene] || SCENES.light;
  if (!failed) return (<div className="cardart"><img src={"/cards/" + card.id + ".webp"} alt="" onError={() => setFailed(true)} /></div>);
  return (<div className="cardart"><svg viewBox="0 0 300 200" preserveAspectRatio="xMidYMid slice">
    <defs><linearGradient id={"g" + card.id} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={a} /><stop offset="1" stopColor={b} /></linearGradient></defs>
    <rect width="300" height="200" fill={"url(#g" + card.id + ")"} /><ellipse cx="150" cy="176" rx="90" ry="12" fill="#000" opacity=".15" />
    <circle cx="110" cy="90" r="34" fill="#fff" opacity=".25" /><circle cx="185" cy="70" r="20" fill="#fff" opacity=".2" />
  </svg></div>);
}

export default function App() {
  const [content, setContent] = useState<Awaited<ReturnType<typeof fetchContent>> | null>(null);
  const [phase, setPhase] = useState<"intro" | "play" | "reveal">("intro");
  const [round, setRound] = useState(1);
  const [answers, setAnswers] = useState<Answers>(emptyAnswers());
  const answersRef = useRef(answers);
  answersRef.current = answers;
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [typedNames, setTypedNames] = useState<string[]>([]);
  const [other, setOther] = useState("");
  const [deckIdx, setDeckIdx] = useState(0);
  const [pairIdx, setPairIdx] = useState(0);
  const [fact, setFact] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [page, setPage] = useState(0);
  const [view, setView] = useState("campus");
  const [viewTime, setViewTime] = useState(() => { const h = new Date().getHours(); return h >= 18 || h < 6 ? "dusk" : "day"; });
  const [selfie, setSelfie] = useState<string | null>(null);
  const [stats, setStats] = useState({ things: [0, 0], questions: [0, 0] });
  const toastTimer = useRef<number>(0);

  useEffect(() => {
    fetchContent().then(setContent).catch(() => setToast("Could not load the game content. Check the API is running."));
    fetchSubjects().then((d) => setSubjects(d.subjects)).catch(() => null);
  }, []);
  const tip = useCallback((msg: string, ms = 3200) => {
    setToast(msg); window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(""), ms);
  }, []);

  const deck: DeckCard[] = round === 2 ? (content?.things || []) : (content?.questions || []);
  const current = deck[deckIdx];
  const progress = round === 1
    ? Object.values(picked).reduce((a, v) => a + (v === "love" ? 1.5 : 1), 0) + typedNames.length
    : round === 3 ? pairIdx : deckIdx;

  const assets = useRoomAssets();
  // Scoring runs in the browser: every answers change rescores and refills the room.
  const live = useMemo(() => {
    if (!content || !subjects.length) return null;
    const profiles: Record<string, Record<string, number>> = {};
    for (const s of subjects) if (s.profile) profiles[s.code] = s.profile;
    return scoreAnswers(answers, subjects, profiles, content.pairs,
      { chips: content.chips, things: content.things, questions: content.questions });
  }, [answers, content, subjects]);
  const ranked = live?.ranked ?? [];
  const surprise = live?.surprise ?? null;
  const [roomCodes, setRoomCodes] = useState<string[]>([]);
  const scoresRef = useRef<Record<string, number>>({});
  const qualifiedAll = useMemo(() => {
    if (!content || !subjects.length) return new Set<string>();
    const profiles: Record<string, Record<string, number>> = {};
    for (const s of subjects) if (s.profile) profiles[s.code] = s.profile;
    return qualifiedSubjects(answers, subjects, profiles, content.pairs,
      { chips: content.chips, things: content.things, questions: content.questions });
  }, [answers, content, subjects]);
  const displayCodes = useMemo(() => {
    if (phase !== "reveal" || !assets) return roomCodes;
    return ensureFloorOrBed(roomCodes, ranked, qualifiedAll, (c) => assets.stickers[c]?.slot);
  }, [phase, assets, roomCodes, ranked, qualifiedAll]);
  const assigned = useMemo(
    () => (assets ? assignStickers(displayCodes, assets.stickers, assets.layout, phase === "reveal" ? 1.25 : 1) : []),
    [assets, displayCodes, phase]);

  function nextRound() {
    if (round < 4) { setRound(round + 1); setDeckIdx(0); }
    else setPhase("reveal");
  }

  // One action changes at most one room object, and only qualified subjects qualify.
  function applyAction(snap: Answers, heart: boolean) {
    if (!content || !subjects.length) return;
    const profiles: Record<string, Record<string, number>> = {};
    for (const s of subjects) if (s.profile) profiles[s.code] = s.profile;
    const decks = { chips: content.chips, things: content.things, questions: content.questions };
    const scored = scoreAnswers(snap, subjects, profiles, content.pairs, decks);
    if (round > 1 || heart) {
      const qualified = qualifiedSubjects(snap, subjects, profiles, content.pairs, decks);
      setRoomCodes((prev) => growRoom(prev, scoresRef.current, scored.ranked, qualified, ROUND_CAPS[round - 1]));
    }
    scoresRef.current = Object.fromEntries(scored.ranked.map((r) => [r.code, r.score]));
  }

  function syncChips(nextPicked: Record<string, string>, nextTyped: string[], heart = false) {
    setPicked(nextPicked); setTypedNames(nextTyped);
    const snap = { ...answersRef.current,
      chips: Object.entries(nextPicked).map(([id, state]) => ({ id, state })), typed: nextTyped };
    setAnswers(snap);
    applyAction(snap, heart);
  }

  function chipsContinue() { nextRound(); }

  // --- Real swipe gestures (rounds 2 and 4) ---
  const cardRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ sx: number; sy: number; lx: number; ly: number; lt: number; vx: number; vy: number } | null>(null);
  const [dragT, setDragT] = useState({ x: 0, y: 0, animate: false });
  useEffect(() => { setDragT({ x: 0, y: 0, animate: false }); dragRef.current = null; }, [deckIdx, round]);
  const flick = useCallback((kind: "yes" | "no" | "up") => {
    setDragT((d) => ({ x: kind === "yes" ? 640 : kind === "no" ? -640 : d.x, y: kind === "up" ? -640 : d.y, animate: true }));
    window.setTimeout(() => decide(kind), 170);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, deckIdx, round]);
  function onCardDown(e: React.PointerEvent) {
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    dragRef.current = { sx: e.clientX, sy: e.clientY, lx: e.clientX, ly: e.clientY, lt: performance.now(), vx: 0, vy: 0 };
    setDragT({ x: 0, y: 0, animate: false });
  }
  function onCardMove(e: React.PointerEvent) {
    const d = dragRef.current; if (!d) return;
    const now = performance.now(), dt = Math.max(1, now - d.lt);
    const ivx = (e.clientX - d.lx) / dt * 1000, ivy = (e.clientY - d.ly) / dt * 1000;
    dragRef.current = { ...d, lx: e.clientX, ly: e.clientY, lt: now, vx: d.vx * 0.7 + ivx * 0.3, vy: d.vy * 0.7 + ivy * 0.3 };
    setDragT({ x: e.clientX - d.sx, y: e.clientY - d.sy, animate: false });
  }
  function onCardUp(e: React.PointerEvent) {
    const d = dragRef.current; dragRef.current = null;
    if (!d) return;
    const w = cardRef.current?.offsetWidth || 300, h = cardRef.current?.offsetHeight || 220;
    const dx = e.clientX - d.sx, dy = e.clientY - d.sy;
    if (round === 4 && (dy < -0.3 * h || d.vy < -600)) return flick("up");
    if (dx > 0.3 * w || d.vx > 600) return flick("yes");
    if (dx < -0.3 * w || d.vx < -600) return flick("no");
    setDragT({ x: 0, y: 0, animate: true });
  }
  useEffect(() => {
    if (phase !== "play" || (round !== 2 && round !== 4)) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") flick("yes");
      else if (e.key === "ArrowLeft") flick("no");
      else if (e.key === "ArrowUp" && round === 4) flick("up");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, round, flick]);

  function decide(kind: "yes" | "no" | "up") {
    if (!current) return;
    const snap = { ...answersRef.current, swipes: [...answersRef.current.swipes, { card_id: current.id, answer: kind }] };
    setAnswers(snap);
    applyAction(snap, false);
    const key = round === 2 ? "things" : "questions";
    setStats((s) => ({ ...s, [key]: [s[key][0] + 1, s[key][1] + (kind === "no" ? 0 : 1)] }));
    if (round === 4 && kind !== "no" && current.fact) {
      setFact(current.fact); window.setTimeout(() => setFact(null), 2600);
    }
    setDeckIdx(deckIdx + 1);
  }

  function answerPair(pair: Pair, side: "a" | "b" | null) {
    const snap = { ...answersRef.current, pairs: [...answersRef.current.pairs, { pair_id: pair.id, side }] };
    setAnswers(snap);
    applyAction(snap, false);
    if (pairIdx + 1 < (content?.pairs.length || 0)) setPairIdx(pairIdx + 1);
    else nextRound();
  }

  function restart() {
    setRoomCodes([]); scoresRef.current = {};
    setAnswers(emptyAnswers()); setPicked({}); setTypedNames([]); setDeckIdx(0); setPairIdx(0);
    setPage(0); setSelfie(null); setStats({ things: [0, 0], questions: [0, 0] }); setRound(1); setPhase("play");
  }

  const revealList = (() => {
    const top = ranked.filter((r) => r.score > 0).slice(0, 5);
    const sur = surprise ? ranked.find((r) => r.code === surprise) : undefined;
    if (sur && !top.some((r) => r.code === sur.code)) return [...top.slice(0, 4), sur];
    return top;
  })();
  const doer = stats.things[0] ? stats.things[1] / stats.things[0] : 0;
  const wonder = stats.questions[0] ? stats.questions[1] / stats.questions[0] : 0;
  const doerText = Math.abs(doer - wonder) < 0.15
    ? "A bit of both: you like doing things and wondering about them."
    : doer > wonder ? "You're more of a doer than a wonderer." : "You're more of a wonderer than a doer.";

  if (!content) return <div className="app" data-mode="intro"><p style={{ padding: 24, color: "#fff" }}>Loading Inkling…</p></div>;
  const pair = content.pairs[pairIdx];

  return (
    <div className="app" data-mode={phase === "reveal" ? "reveal" : phase === "intro" ? "intro" : "swipe"} lang="en-GB">
      <div className="room-wrap">
        <RoomView assigned={assigned} viewId={view} viewTime={viewTime} band={phase === "play"} />
      </div>

      {phase !== "reveal" && (<div className="top"><div className="segs">
        {ROUNDS.map((r, i) => {
          const totals = [content.chips.length, content.things.length, content.pairs.length, content.questions.length];
          return (<div key={r.id} className={"seg" + (i < round - 1 ? " done" : "")}>
            <i style={{ width: (phase === "play" && i === round - 1 ? Math.min(1, heat(i, progress)) * 100 : i < round - 1 ? 100 : 0) + "%" }} />
            {phase === "play" && i === round - 1 && <em className="mintick" style={{ left: (r.min / Math.max(1, totals[i]) * 100) + "%" }} />}
          </div>);
        })}
      </div><div className="topline"><b>{phase === "intro" ? "Inkling" : ROUNDS[round - 1].short}</b><span>{phase === "play" ? "Round " + round + " of 4" : ""}</span></div></div>)}
      <div className={"toast" + (toast ? "" : " off")}>{toast}</div>

      {phase === "intro" && (<section className="intro"><div className="sheet2">
        <h1>Inkling</h1>
        <p className="lede">Don't know what to study? You've probably got an inkling.</p>
        <p className="note">Four quick rounds. Your room fills with what you're into, then you'll see subjects worth exploring.</p>
        <button className="btn alt" onClick={() => setPhase("play")}>Start</button>
      </div></section>)}

      {phase === "play" && (<div className="overlay">
        {round === 1 && (<div className="sheet2">
          <div><p className="eyebrow">Round 1 · Your subjects</p><h2>What are you studying?</h2><p className="hint2">Tap the ones you take. Heart your favourites.</p></div>
          <div className="chips">{content.chips.map((chip) => {
            const st = picked[chip.id];
            return (<button key={chip.id} className={"chip" + (st === "love" ? " loved" : "")} aria-pressed={!!st}
              onClick={() => { const n = { ...picked }; if (n[chip.id]) delete n[chip.id]; else n[chip.id] = "take"; syncChips(n, typedNames); }}>
              <span>{chip.name}</span>
              <span className="heart" role="button" aria-label={"Love " + chip.name}
                onClick={(e) => { e.stopPropagation(); syncChips({ ...picked, [chip.id]: picked[chip.id] === "love" ? "take" : "love" }, typedNames, picked[chip.id] !== "love"); }}>♥</span>
            </button>);
          })}</div>
          <div><p className="hint2" style={{ marginBottom: 6 }}>Something else?</p>
            <div className="other"><input value={other} list="other-list" placeholder="Type a subject" autoComplete="off"
              onChange={(e) => setOther(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && other.trim()) { syncChips(picked, [...typedNames, other.trim()]); setOther(""); } }} />
              <datalist id="other-list">{content.extra_names.map((n) => <option key={n} value={n} />)}</datalist></div>
            {typedNames.length > 0 && <p className="hint2">Added: {typedNames.join(", ")}</p>}</div>
          {Object.keys(picked).length + typedNames.length >= 3
            ? <button className="btn alt" onClick={chipsContinue}>Continue</button>
            : <p className="hint2" style={{ textAlign: "center" }}>Pick at least 3</p>}
        </div>)}

        {(round === 2 || round === 4) && (<div style={{ display: "grid", gap: 10, justifyItems: "center", width: "100%" }}>
          <p className="theme">{ROUNDS[round - 1].label}<b>{round === 2 ? "Would you get stuck into this?" : "Would you want to find out?"}</b></p>
          <div className="deck">
            {deck[deckIdx + 1] && <div className="card peek" aria-hidden="true"><CardArt card={deck[deckIdx + 1]} /></div>}
            {current
              ? <div className="card swipe" ref={cardRef} role="group" aria-label={current.title}
                  style={{ transform: `translate(${dragT.x}px, ${dragT.y}px) rotate(${dragT.x / 20}deg)`, transition: dragT.animate ? "transform .28s cubic-bezier(.2,.9,.3,1.2)" : "none" }}
                  onPointerDown={onCardDown} onPointerMove={onCardMove} onPointerUp={onCardUp} onPointerCancel={onCardUp}>
                  <div className="stamp yes" style={{ opacity: Math.max(0, Math.min(1, dragT.x / 80)) }}>{round === 4 ? "Tell me" : "Yes"}</div>
                  <div className="stamp no" style={{ opacity: Math.max(0, Math.min(1, -dragT.x / 80)) }}>Not for me</div>
                  {round === 4 && <div className="stamp up" style={{ opacity: Math.max(0, Math.min(1, -dragT.y / 80)) }}>Need to know</div>}
                  <CardArt card={current} />
                  <span className="counttab">{Math.min(deckIdx + 1, ROUNDS[round - 1].min)} of {ROUNDS[round - 1].min}</span>
                  <div className="paperlabel">{current.title}</div>
                  {fact && <div className="fact"><b>Did you know?</b>{fact}</div>}
                </div>
              : <div className="card" style={{ placeItems: "center", display: "grid", padding: 16 }}><p className="note">That's every card in this round.</p></div>}
          </div>
          <div className="actioncol">
            <div className="continurow">
              {deckIdx >= ROUNDS[round - 1].min && <button className="btn alt" id="continue" onClick={nextRound}>{round < 4 ? "Continue" : "Build my room"}</button>}
            </div>
            <div className="actions">
              <button className="no" aria-label="Not for me" onClick={() => decide("no")}>✕</button>
              <button className="up" aria-label="Need to know" disabled={round !== 4} style={round !== 4 ? { visibility: "hidden" } : undefined} onClick={() => decide("up")}>★</button>
              <button className="yes" aria-label="Yes" onClick={() => decide("yes")}>✓</button>
            </div>
          </div>
        </div>)}

        {round === 3 && pair && (<div className="sheet2">
          <div className="pfoot"><div><p className="eyebrow">Round 3 · This or that</p><h2>Which is more you?</h2></div><span className="count">{pairIdx + 1} / {content.pairs.length}</span></div>
          <div className="pairs">
            {(["a", "b"] as const).map((side) => (
              <button key={side} className="pcard" onClick={() => answerPair(pair, side)}>
                <img src={"/img/" + pair.id + "_" + side + ".jpg"} alt="" />
                <span className="lbl"><b>{pair[side].label}</b><small>{pair[side].caption}</small></span>
              </button>
            ))}
          </div>
          <div className="pfoot"><span className="hint2">Tap a picture</span><button className="linkbtn" onClick={() => answerPair(pair, null)}>Can't decide</button></div>
        </div>)}
      </div>)}

      {phase === "reveal" && (<section className="story">
        <div className="sprog">{[0, 1, 2, 3, 4, 5].map((i) => <i key={i} className={i < page ? "done" : i === page ? "now" : ""} />)}</div>
        <button className="zone left" aria-label="Back" onClick={() => setPage(Math.max(0, page - 1))} />
        <button className="zone right" aria-label="Next" onClick={() => setPage(Math.min(5, page + 1))} />
        <div className="pages">
          <div className={"page" + (page === 0 ? " on" : "")}><div className="pc roomcap"><p className="eyebrow">Your room</p>
            <h2>{assigned.length} thing{assigned.length === 1 ? "" : "s"} landed. Here's your room.</h2><p className="note">Tap the right side to continue, left to go back.</p></div></div>
          <div className={"page" + (page === 1 ? " on" : "")}><div className="pc mid big"><p className="eyebrow">You're into</p>
            <h2>{revealList.slice(0, 3).map((r) => r.display_name.toLowerCase()).join(", ") || "not sure yet"}</h2><p className="note">{doerText}</p></div></div>
          <div className={"page" + (page === 2 ? " on" : "")}><div className="pc bottom"><p className="eyebrow">Subjects to explore</p>
            <ul className="subjects">{revealList.map((r) => (
              <li key={r.code} className={r.code === surprise ? "surprise" : ""}><div><b>{r.display_name}</b>
                <small>{r.code === surprise ? "Never on a card. It scored from everything around it." : (r.reasons.length ? "Because of: " + r.reasons.join(" · ") : "")}</small>
                <a href={"https://www.discoveruni.gov.uk/search/?q=" + encodeURIComponent(r.display_name)} target="_blank" rel="noreferrer">See courses on Discover Uni</a></div>
                {r.code === surprise && <span className="pct"><span className="tag">surprise</span></span>}</li>))}
            </ul></div></div>
          <div className={"page" + (page === 3 ? " on" : "")}><div className="pc bottom"><p className="eyebrow">Where do you see yourself studying?</p><h2>Pick a view</h2>
            <div className="views">{VIEWS.map((v) => <button key={v.id} aria-pressed={v.id === view} onClick={() => setView(v.id)}>{v.name}</button>)}</div>
            <div className="views" style={{ marginTop: 8 }}>{["day", "dusk"].map((t) => <button key={t} aria-pressed={t === viewTime} onClick={() => setViewTime(t)}>{t === "day" ? "Day" : "Dusk"}</button>)}</div>
            <p className="note">It changes your window, and later helps suggest places to study.</p></div></div>
          <div className={"page" + (page === 4 ? " on" : "")}><div className="pc bottom"><p className="eyebrow">Put yourself in it</p><h2>Add a selfie</h2>
            <input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (!f) return; const rd = new FileReader(); rd.onload = () => setSelfie(String(rd.result)); rd.readAsDataURL(f); }} />
            {selfie && <img src={selfie} alt="Your selfie" style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 99 }} />}
            <p className="note">Stays in your browser here. In the real build SAM 3.1 cuts you out and Muse Image repaints you in the room's style.</p></div></div>
          <div className={"page" + (page === 5 ? " on" : "")}><div className="pc bottom"><p className="eyebrow">Share</p>
            <div className="share"><div className="phone"><RoomView assigned={assigned} viewId={view} viewTime={viewTime} />
              <div className="over"><b>got an inkling?</b>made with Inkling</div></div>
              <div><p style={{ fontStyle: "italic", margin: "0 0 6px" }}>"my inkling: {revealList.slice(0, 2).map((r) => r.display_name.toLowerCase()).join(" + ") || "still working it out"}. got an inkling?"</p>
                <p className="note">Downloads a 9:16 share card and a story background made from your room.</p>
                <div className="row" style={{ marginTop: 10 }}>
                  <button className="btn alt" onClick={async () => {
                    if (!assets) return;
                    const canvas = await composeRoomCanvas(assigned, view, viewTime, assets.layout);
                    const ctx = canvas.getContext("2d")!;
                    ctx.fillStyle = "rgba(43,35,64,.82)"; ctx.fillRect(0, 1620, 1080, 300);
                    ctx.fillStyle = "#fff"; ctx.font = "64px Georgia"; ctx.fillText(revealList[0]?.display_name || "My inkling", 48, 1710);
                    ctx.font = "44px Georgia"; ctx.fillText("got an inkling?", 48, 1780);
                    download(canvas, "inkling-share.png");
                  }}>Share card</button>
                  <button className="btn" onClick={async () => {
                    if (!assets) return;
                    const canvas = await composeRoomCanvas(assigned, view, viewTime, assets.layout);
                    const ctx = canvas.getContext("2d")!;
                    ctx.fillStyle = "#e59a2c"; ctx.fillRect(0, 0, 1080, 90); ctx.fillRect(0, 1830, 1080, 90);
                    ctx.save(); ctx.translate(120, 240); ctx.rotate(-0.18); ctx.font = "120px Georgia"; ctx.fillStyle = "rgba(255,255,255,.9)";
                    ctx.fillText((revealList[0]?.display_name || "I").slice(0, 2).toUpperCase(), 0, 0); ctx.restore();
                    download(canvas, "inkling-story.png");
                  }}>Story background</button>
                  <button className="btn ghost" onClick={restart}>Start over</button>
                </div></div></div>
            <details><summary>What the model thinks</summary><pre>{ranked.slice(0, 12).map((r) => r.display_name + "  score " + r.score.toFixed(2) + "  unc " + r.uncertainty.toFixed(2)).join("\n")}</pre></details>
          </div></div>
        </div>
      </section>)}
    </div>
  );
}
