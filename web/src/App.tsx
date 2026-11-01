import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type CSSProperties } from "react";
import { motion } from "motion/react";
import { Answers, DeckCard, Pair, Subject, emptyAnswers, fetchContent, fetchSubjects } from "./api";
import { RoomView, assignStickers, composeRoomCanvas, download, useRoomAssets } from "./Room";
import { handsOnPicks, isPractical, lengthLabel, levelLabel, qualifiedSubjects, scoreAnswers, type Apprenticeship } from "./scoring";
import { ROUND_CAPS, collectRoundAdds, diverseTop, ensureFloorOrBed, ensureResults } from "./roomRules";
import { ROUNDS, flowReducer, initialScene, roundAccent } from "./flow";
import { popUp } from "./design/motion";
import { buzz, setSoundEnabled, soundEnabled, sfx, unlock } from "./design/sound";
import { makeShareVideo, shareUrl, type ShareData } from "./share";
import { suggestAliases } from "./aliases";
import { heartChip, toggleChip } from "./chips";
import AppMenu from "./Menu";
import { ArrowLeft, ArrowRight, ArrowUp, Check, ChevronLeft, ChevronRight, Download, ExternalLink, Heart, Link as LinkIcon, Plus, RotateCcw, Share2, Sparkles, Volume2, VolumeX, X } from "lucide-react";

const ICON = { size: 20, strokeWidth: 2 } as const;
const ICON_SM = { size: 16, strokeWidth: 2 } as const;
const VIEWS = [{ id: "city", name: "City" }, { id: "coast", name: "Coast" }, { id: "campus", name: "Campus town" }, { id: "countryside", name: "Countryside" }];
const SCENES: Record<string, [string, string]> = { sea: ["#1f6f8b", "#8fd0e6"], desk: ["#5a4a7a", "#c9b7e8"], wood: ["#6e4329", "#d9b48f"], night: ["#1c1a3a", "#6b5aa8"], dark: ["#101418", "#2f3a48"], green: ["#2f6b3a", "#a9d9a0"], light: ["#e8dfd0", "#fff8ea"] };

function heat(roundIdx: number, n: number) {
  if (roundIdx === 2) return n / 5;
  if (roundIdx === 0) return 1 - Math.exp(-n / 3.2);
  return 1 - Math.exp(-n / 5.1);
}

function CardArt({ card }: { card: DeckCard }) {
  const [failed, setFailed] = useState(false);
  const [a, b] = SCENES[card.scene] || SCENES.light;
  if (!failed) return (<div className="cardart"><img src={"/cards/" + card.id + ".webp"} alt="" draggable={false} onDragStart={(e) => e.preventDefault()} onError={() => setFailed(true)} /></div>);
  return (<div className="cardart"><svg viewBox="0 0 300 200" preserveAspectRatio="xMidYMid slice">
    <defs><linearGradient id={"g" + card.id} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={a} /><stop offset="1" stopColor={b} /></linearGradient></defs>
    <rect width="300" height="200" fill={"url(#g" + card.id + ")"} /><ellipse cx="150" cy="176" rx="90" ry="12" fill="#000" opacity=".15" />
    <circle cx="110" cy="90" r="34" fill="#fff" opacity=".25" /><circle cx="185" cy="70" r="20" fill="#fff" opacity=".2" />
  </svg></div>);
}

function StickerRain() {
  const [items, setItems] = useState<{ code: string; left: number; size: number; dur: number; delay: number; rot: number }[]>([]);
  useEffect(() => {
    fetch("/stickers/stickers.json").then((r) => r.json())
      .then((list: { code: string }[]) => {
        const pool = [...list].sort(() => Math.random() - 0.5).slice(0, 12);
        setItems(pool.map((s, i) => ({
          code: s.code,
          // Keep the rain in the empty space beside the centred phone frame.
          left: i % 2 === 0 ? 2 + Math.random() * 30 : 68 + Math.random() * 28,
          size: 44 + Math.random() * 34, dur: 8 + Math.random() * 6,
          delay: -Math.random() * 14, rot: -14 + Math.random() * 28,
        })));
      }).catch(() => null);
  }, []);
  if (!items.length) return null;
  return (<div className="stickerrain" aria-hidden="true">{items.map((it) => (
    <img key={it.code} className="rainsticker" src={"/stickers/" + it.code + ".webp"} alt="" draggable={false}
      style={{ left: it.left + "vw", width: it.size, animationDuration: it.dur + "s", animationDelay: it.delay + "s", "--rain-rot": it.rot + "deg" } as CSSProperties} />
  ))}</div>);
}

export default function App() {
  const [content, setContent] = useState<Awaited<ReturnType<typeof fetchContent>> | null>(null);
  const [scene, dispatch] = useReducer(flowReducer, initialScene);
  const [howOpen, setHowOpen] = useState(false);
  const [soundOn, setSoundOn] = useState(soundEnabled());
  const round = scene.kind === "roundTitle" || scene.kind === "round" || scene.kind === "roundOutro" ? scene.round : 4;
  const phase: "intro" | "play" | "reveal" =
    scene.kind === "reveal" || scene.kind === "share" || scene.kind === "finale" ? "reveal"
    : scene.kind === "round" || scene.kind === "roundTitle" || scene.kind === "roundOutro" ? "play" : "intro";
  const [answers, setAnswers] = useState<Answers>(emptyAnswers());
  const answersRef = useRef(answers);
  answersRef.current = answers;
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [typedNames, setTypedNames] = useState<string[]>([]);
  const [other, setOther] = useState("");
  const [otherOpen, setOtherOpen] = useState(false);
  const wheelRef = useRef(0);
  const [deckIdx, setDeckIdx] = useState(0);
  const [pairIdx, setPairIdx] = useState(0);
  const [fact, setFact] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [isPhone, setIsPhone] = useState(() => typeof window !== "undefined" && window.matchMedia("(max-width: 640px)").matches);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    const on = () => setIsPhone(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  const [view, setView] = useState("campus");
  const [viewTime, setViewTime] = useState(() => { const h = new Date().getHours(); return h >= 18 || h < 6 ? "dusk" : "day"; });
  const [canShareFiles] = useState(() => {
    try { return !!navigator.canShare?.({ files: [new File(["x"], "t.mp4", { type: "video/mp4" })] }); }
    catch { return false; }
  });
  const [videoStatus, setVideoStatus] = useState<"idle" | "preparing" | "ready">("idle");
  const videoRef = useRef<{ key: string; blob: Blob; ext: string } | null>(null);
  const imageRef = useRef<{ key: string; blob: Blob } | null>(null);
  const videoGenRef = useRef("");
  const [wildcardFlipped, setWildcardFlipped] = useState(false);
  const [liftStep, setLiftStep] = useState(0);
  useEffect(() => { if (liftStep > 0) sfx.marimba(liftStep - 1); }, [liftStep]);
  useEffect(() => {
    if (scene.kind !== "reveal" || scene.page !== 0) return;
    setLiftStep(0);
    const iv = window.setInterval(() => setLiftStep((s) => Math.min(3, s + 1)), 420);
    const stop = window.setTimeout(() => window.clearInterval(iv), 2200);
    return () => { window.clearInterval(iv); window.clearTimeout(stop); };
  }, [scene]);

  // Reveal order: top 3 -> wildcard -> [hands-on routes] -> views -> explore -> share.
  const practical = isPractical(answers);
  const viewsPage = practical ? 3 : 2;
  const explorePage = practical ? 4 : 3;
  const sharePage = explorePage + 1;
  const pageCount = sharePage + 1;
  const revealPage = scene.kind === "reveal" ? scene.page : scene.kind === "share" ? sharePage : 0;
  const page = revealPage;
  const toastTimer = useRef<number>(0);

  useEffect(() => {
    fetchContent().then(setContent).catch(() => setToast("Could not load the game content. Check the API is running."));
    fetchSubjects().then((d) => setSubjects(d.subjects)).catch(() => null);
  }, []);
  useEffect(() => {
    const onTap = () => unlock();
    window.addEventListener("pointerdown", onTap, { once: true });
    return () => window.removeEventListener("pointerdown", onTap);
  }, []);
  useEffect(() => {
    if (scene.kind === "unfold") { const t = window.setTimeout(() => dispatch({ type: "UNFOLDED" }), 1400); return () => window.clearTimeout(t); }
    if (scene.kind === "roundTitle") { const t = window.setTimeout(() => dispatch({ type: "TITLE_DONE" }), 1250); return () => window.clearTimeout(t); }
    if (scene.kind === "roundOutro") {
      const added = roomCodes.length - roundStartCount;
      const t = window.setTimeout(() => dispatch({ type: "OUTRO_DONE" }), added >= 1 ? 1000 + added * 170 : 30);
      return () => window.clearTimeout(t);
    }
  }, [scene.kind]);
  // Preload room layers, common stickers, card art and views while the landing is shown.
  useEffect(() => {
    if (!content) return;
    const urls = ["/room/room.png", ...["city", "coast", "campus", "countryside"].flatMap((v) => ["day", "dusk"].map((t) => `/views/${v}_${t}.webp`)),
      ...[...content.things, ...content.questions].map((c) => `/cards/${c.id}.webp`)];
    for (const u of urls) { const img = new Image(); img.src = u; }
    fetch("/stickers/stickers.json").then((r) => r.json()).then((list: { code: string }[]) => {
      for (const s of list.slice(0, 40)) { const img = new Image(); img.src = `/stickers/${s.code}.webp`; }
    }).catch(() => null);
  }, [content]);
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
      { chips: content.chips, things: content.things, questions: content.questions }, content.aliases || {});
  }, [answers, content, subjects]);
  const ranked = live?.ranked ?? [];
  const surprise = live?.surprise ?? null;
  const [roomCodes, setRoomCodes] = useState<string[]>([]);
  const [dropCodes, setDropCodes] = useState<string[]>([]);
  const [roundStartCount, setRoundStartCount] = useState(0);
  const roundBaselineRef = useRef<Record<string, number>>({});
  useEffect(() => { if (scene.kind === "roundTitle") { setRoundStartCount(roomCodes.length); roundBaselineRef.current = { ...scoresRef.current }; } }, [scene.kind, roomCodes.length]);
  const [confetti, setConfetti] = useState<string | null>(null);
  const [pairPick, setPairPick] = useState<"a" | "b" | null>(null);
  const [tapCode, setTapCode] = useState<string | null>(null);
  const [courseSheet, setCourseSheet] = useState<{ code: string; name: string } | null>(null);
  const [sheetTab, setSheetTab] = useState<"courses" | "apprenticeships">("courses");
  type SubjectFile = { courses: { title: string; provider: string; url: string; ucas_code: string; setting?: string | null; town?: string | null }[]; jobs: string[]; apprenticeships: Apprenticeship[] };
  const [subjectFiles, setSubjectFiles] = useState<Record<string, SubjectFile>>({});
  const requestedFiles = useRef(new Set<string>());
  const loadSubjectFile = useCallback((code: string) => {
    if (requestedFiles.current.has(code)) return;
    requestedFiles.current.add(code);
    fetch(`/subjects/${code}.json`).then((r) => r.json())
      .then((d) => setSubjectFiles((p) => ({ ...p, [code]: { courses: d.courses || [], jobs: d.jobs || [], apprenticeships: d.apprenticeships || [] } })))
      .catch(() => setSubjectFiles((p) => ({ ...p, [code]: { courses: [], jobs: [], apprenticeships: [] } })));
  }, []);
  function openCourses(code: string, name: string) {
    setCourseSheet({ code, name });
    setSheetTab("courses");
    loadSubjectFile(code);
  }
  useEffect(() => { setTapCode(null); }, [scene]);
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
    const topCodes = diverseTop(ranked.filter((r) => r.code !== surprise), (c) => c.split("-").slice(0, 2).join("-")).map((r) => r.code);
    const results = [...topCodes, ...(wildcardFlipped && surprise ? [surprise] : [])];
    let codes = ensureResults(roomCodes, results, ranked);
    codes = ensureFloorOrBed(codes, ranked, qualifiedAll, (c) => assets.stickers[c]?.slot, results);
    return codes;
  }, [phase, assets, roomCodes, ranked, qualifiedAll, wildcardFlipped, surprise]);
  const assigned = useMemo(
    () => (assets ? assignStickers(displayCodes, assets.stickers, assets.layout, phase === "reveal" ? 1.35 : 1.2, 0) : []),
    [assets, displayCodes, phase]);
  // Everything earned this round lands together at round end (prompts/13 C):
  // no stickers appear while cards/chips are being answered.
  function landRoundAdds() {
    if (!content || !subjects.length) return;
    const profiles: Record<string, Record<string, number>> = {};
    for (const s of subjects) if (s.profile) profiles[s.code] = s.profile;
    const decks = { chips: content.chips, things: content.things, questions: content.questions };
    const scored = scoreAnswers(answersRef.current, subjects, profiles, content.pairs, decks, content.aliases || {});
    const qualified = qualifiedSubjects(answersRef.current, subjects, profiles, content.pairs, decks);
    const adds = collectRoundAdds(roomCodes, roundBaselineRef.current, scored.ranked, qualified, ROUND_CAPS[round - 1]);
    if (adds.length) {
      setRoomCodes([...roomCodes, ...adds]);
      setDropCodes(adds);
      adds.forEach((_, i) => window.setTimeout(() => sfx.land(roomCodes.length + i), i * 140));
      buzz();
    }
    scoresRef.current = Object.fromEntries(scored.ranked.map((r) => [r.code, r.score]));
  }

  function nextRound() {
    landRoundAdds();
    setDeckIdx(0);
    sfx.fold();
    dispatch({ type: "CONTINUE" });
  }

  // Mid-round actions only rescore; the room itself is updated in landRoundAdds.
  function applyAction(snap: Answers, heart: boolean) {
    void heart;
    if (!content || !subjects.length) return;
    const profiles: Record<string, Record<string, number>> = {};
    for (const s of subjects) if (s.profile) profiles[s.code] = s.profile;
    const decks = { chips: content.chips, things: content.things, questions: content.questions };
    const scored = scoreAnswers(snap, subjects, profiles, content.pairs, decks, content.aliases || {});
    scoresRef.current = Object.fromEntries(scored.ranked.map((r) => [r.code, r.score]));
  }

  function syncChips(nextPicked: Record<string, string>, nextTyped: string[], heart = false) {
    setPicked(nextPicked); setTypedNames(nextTyped);
    const snap = { ...answersRef.current,
      chips: Object.entries(nextPicked).map(([id, state]) => ({ id, state })), typed: nextTyped };
    setAnswers(snap);
    applyAction(snap, heart);
  }

  function chipsContinue() {
    nextRound();
  }

  // --- Real swipe gestures (rounds 2 and 4) ---
  const cardRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ sx: number; sy: number; lx: number; ly: number; lt: number; vx: number; vy: number } | null>(null);
  const [dragT, setDragT] = useState({ x: 0, y: 0, animate: false });
  useEffect(() => { setDragT({ x: 0, y: 0, animate: false }); dragRef.current = null; }, [deckIdx, round]);
  const flick = useCallback((kind: "yes" | "no" | "up") => {
    sfx.whoosh();
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
    if (kind === "no") sfx.no(); else sfx.yes();
    if (kind !== "no") buzz();
    const snap = { ...answersRef.current, swipes: [...answersRef.current.swipes, { card_id: current.id, answer: kind }] };
    setAnswers(snap);
    applyAction(snap, false);
    setFact(null);
    if (round === 4 && kind !== "no" && current.fact) {
      const f = current.fact;
      window.setTimeout(() => setFact(f), 60);
      window.setTimeout(() => setFact((cur) => (cur === f ? null : cur)), 3060);
    }
    setDeckIdx(deckIdx + 1);
  }

  function answerPair(pair: Pair, side: "a" | "b" | null) {
    const snap = { ...answersRef.current, pairs: [...answersRef.current.pairs, { pair_id: pair.id, side }] };
    setAnswers(snap);
    applyAction(snap, false);
    sfx.pop(); buzz();
    if (side) {
      setPairPick(side);
      window.setTimeout(() => {
        setPairPick(null);
        if (pairIdx + 1 < (content?.pairs.length || 0)) setPairIdx(pairIdx + 1);
        else nextRound();
      }, 260);
    } else if (pairIdx + 1 < (content?.pairs.length || 0)) setPairIdx(pairIdx + 1);
    else nextRound();
  }

  function restart() {
    setRoomCodes([]); scoresRef.current = {};
    setAnswers(emptyAnswers()); setPicked({}); setTypedNames([]); setDeckIdx(0); setPairIdx(0);
    setWildcardFlipped(false);
    dispatch({ type: "RESTART" });
  }

  const parentOf = (code: string) => code.split("-").slice(0, 2).join("-");
  const top3 = diverseTop(ranked.filter((r) => r.code !== surprise), parentOf);
  const wildcardRow = surprise ? ranked.find((r) => r.code === surprise) : undefined;
  const exploreList = wildcardRow && !top3.some((r) => r.code === wildcardRow.code) ? [...top3, wildcardRow] : top3;
  const plainOf = (code: string) => subjects.find((s) => s.code === code)?.plain;
  const whyOf = (code: string) => subjects.find((s) => s.code === code)?.why_line;
  // Load per-subject files (courses, graduate jobs, apprenticeships) for the
  // explore list once the reveal starts.
  useEffect(() => {
    if (scene.kind !== "reveal" && scene.kind !== "share") return;
    for (const r of exploreList) loadSubjectFile(r.code);
  }, [scene.kind, exploreList, loadSubjectFile]);
  const handsOn = useMemo(() => {
    if (!practical) return [];
    const bySubject: Record<string, Apprenticeship[]> = {};
    for (const r of exploreList) bySubject[r.code] = subjectFiles[r.code]?.apprenticeships || [];
    return handsOnPicks(bySubject, exploreList.map((r) => r.code));
  }, [practical, exploreList, subjectFiles]);

  // Pre-render the share video + still in the background once the reveal
  // starts (wildcard is known by then), so Share can fire inside the tap's
  // transient user activation instead of after a 10s recording.
  const shareKey = displayCodes.join(",") + "|" + view + "|" + viewTime + "|" + top3.map((r) => r.code).join(",") + "|" + (surprise ?? "");
  useEffect(() => {
    if (!assets || (scene.kind !== "reveal" && scene.kind !== "share")) return;
    if (videoRef.current?.key === shareKey) { setVideoStatus("ready"); return; }
    if (videoGenRef.current === shareKey) return;
    videoGenRef.current = shareKey;
    setVideoStatus("preparing");
    const data: ShareData = { t: top3.map((r) => r.code), w: surprise, v: view, vt: viewTime, r: displayCodes };
    makeShareVideo({ assigned, viewId: view, viewTime, layout: assets.layout,
      top: top3.map((r) => ({ code: r.code, name: r.display_name })),
      wildcard: wildcardRow ? { code: wildcardRow.code, name: wildcardRow.display_name } : null, shortUrl: shareUrl(data) })
      .then(({ blob, ext }) => {
        videoRef.current = { key: shareKey, blob, ext };
        if (videoGenRef.current === shareKey) setVideoStatus("ready");
      })
      .catch((e: Error) => { console.log("share video render failed:", e?.name); if (videoGenRef.current === shareKey) { videoGenRef.current = ""; setVideoStatus("idle"); } });
    composeRoomCanvas(assigned, view, viewTime, assets.layout)
      .then((canvas) => canvas.toBlob((b) => { if (b) imageRef.current = { key: shareKey, blob: b }; }))
      .catch(() => null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene.kind, assets, shareKey]);

  if (!content) return <div className="app" data-mode="intro"><p style={{ padding: 24, color: "#fff" }}>Loading Inkling…</p></div>;
  const pair = content.pairs[pairIdx];

  const inGame = scene.kind === "round" || scene.kind === "roundTitle" || scene.kind === "roundOutro";
  return (<>
    {scene.kind === "landing" && <StickerRain />}
    <div className="app" data-mode={phase === "reveal" ? "reveal" : phase === "intro" ? "intro" : "swipe"} lang="en-GB"
      style={{ "--round-accent": roundAccent(round) } as CSSProperties}>
      <div className="room-wrap">
        <RoomView assigned={assigned} viewId={view} viewTime={viewTime} tall={isPhone} celebrate={scene.kind === "finale"} dropCodes={scene.kind === "roundOutro" ? dropCodes : []}
          liftCodes={scene.kind === "reveal" && page === 0 ? top3.slice(0, liftStep).map((r) => r.code)
            : scene.kind === "reveal" && page === 1 && wildcardFlipped && surprise ? [surprise] : []}
          onStickerTap={(code) => { setTapCode(code); sfx.pop(); }}
          tapInfo={tapCode ? (() => { const s = subjects.find((x) => x.code === tapCode); if (!s) return null;
            const inRounds = scene.kind === "round" || scene.kind === "roundTitle" || scene.kind === "roundOutro";
            return { code: tapCode, name: s.display_name, line: inRounds ? undefined : s.why_line }; })() : null} />
        {scene.kind === "finale" && <span className="lampwarm" aria-hidden="true" />}
      </div>
      {tapCode && <button className="tagcatcher" aria-label="Close sticker tag" onClick={() => setTapCode(null)} />}

      {scene.kind === "roundOutro" && (<button className="outroskip" aria-label="Continue" onClick={() => dispatch({ type: "OUTRO_DONE" })} />)}
      {scene.kind === "roundOutro" && roomCodes.length - roundStartCount >= 1 && (<button className="outrotag" onClick={() => dispatch({ type: "OUTRO_DONE" })}>
        <motion.span initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 380, damping: 20 }}>
          {"+" + (roomCodes.length - roundStartCount) + " in your room"}
        </motion.span>
      </button>)}

      {inGame && (<div className="top"><div className="segs">
        {ROUNDS.map((r, i) => {
          const totals = [content.chips.length, content.things.length, content.pairs.length, content.questions.length];
          return (<div key={r.n} className={"seg" + (i < round - 1 ? " done" : "")}>
            <i style={{ width: (i === round - 1 ? Math.min(1, heat(i, progress)) * 100 : i < round - 1 ? 100 : 0) + "%" }} />
            {i === round - 1 && <em className="mintick" style={{ left: (r.min / Math.max(1, totals[i]) * 100) + "%" }} />}
          </div>);
        })}
      </div><div className="topline"><b>{ROUNDS[round - 1].title}</b>
        <button className="soundbtn iconbtn" aria-label={soundOn ? "Sound on" : "Sound off"} aria-pressed={soundOn}
          onClick={() => { const on = !soundOn; setSoundOn(on); setSoundEnabled(on); }}>
          {soundOn ? <Volume2 {...ICON} aria-hidden="true" /> : <VolumeX {...ICON} aria-hidden="true" />}
        </button></div></div>)}
      <div className={"toast" + (toast ? "" : " off")}>{toast}</div>
      {fact && scene.kind === "round" && (<motion.div className="factnote" role="status"
        initial={{ scale: 0.7, opacity: 0, rotate: -4 }} animate={{ scale: 1, opacity: 1, rotate: -1.5 }}
        transition={{ type: "spring", stiffness: 380, damping: 20 }}>
        <b>Did you know?</b>{fact}</motion.div>)}

      {scene.kind === "landing" && <AppMenu path="/" />}
      {scene.kind === "landing" && (<section className="landing">
        <motion.div className="foldedsquare" aria-hidden="true" animate={{ scale: [1, 1.01, 1] }} transition={{ duration: 4, repeat: Infinity }}>
          <img className="miniview" src={"/views/" + view + "_" + viewTime + ".webp"} alt="" />
          <img className="miniroom" src="/room/room.png" alt="" />
        </motion.div>
        <h1 className="wordmark">Inkling</h1>
        <p className="lede">Not sure what to study? Find the degree subjects that fit you.</p>
        <button className="btn alt bigbtn" onClick={() => { unlock(); sfx.pop(); dispatch({ type: "START" }); }}>Find my subjects</button>
        <p className="smallprint">Takes about 3 minutes · free · no sign-up</p>
        <button className="musetag" onClick={() => setHowOpen(true)}>Built with Meta Muse</button>
        <p className="smallprint">Course data from Discover Uni</p>
        <button className="linkbtn" onClick={() => setHowOpen(true)}>How it works</button>
        <button className="soundbtn iconbtn landing-sound" aria-label={soundOn ? "Sound on" : "Sound off"} aria-pressed={soundOn}
          onClick={() => { const on = !soundOn; setSoundOn(on); setSoundEnabled(on); }}>
          {soundOn ? <Volume2 {...ICON} aria-hidden="true" /> : <VolumeX {...ICON} aria-hidden="true" />}
        </button>
        {howOpen && (<div className="howsheet" role="dialog" aria-label="How it works"><div className="sheet2">
          <h2>How it works</h2>
          <p className="note">Four quick rounds. Your answers fill a paper room with what you're into, then you see degree subjects worth exploring. Answers stay on your phone; the share link only carries subject codes.</p>
          <p className="note">Course data comes from the UK Discover Uni dataset. Contains HESA Discover Uni data (HESA, www.hesa.ac.uk), licensed under CC BY 4.0.</p>
          <p className="note">Contains public sector information licensed under the Open Government Licence v3.0. Apprenticeship standards © Skills England.</p>
          <p className="note">Muse Spark Open (open weights, on Baseten) wrote and reviewed the subject cards. Muse Image drew the room, stickers and card art. SAM 3.1 cut out and checked every object. Muse Image paints your room on request.</p>
          <button className="btn alt" onClick={() => setHowOpen(false)}><X {...ICON_SM} aria-hidden="true" /> Close</button>
        </div></div>)}
      </section>)}

      {scene.kind === "unfold" && (<section className={"unfold3d" + (isPhone ? " tall" : "")} aria-hidden="true">
        {[
          { key: "floor", clip: "polygon(0% 74.6%, 100% 74.6%, 100% 100%, 0% 100%)", from: { rotateX: 68, scale: 0.92, opacity: 0.45 }, delay: 0, origin: "50% 100%" },
          { key: "back", clip: "polygon(0% 0%, 100% 0%, 91.4% 9%, 91.4% 77.4%, 8.6% 77.4%, 8.6% 9%)", from: { rotateX: 55, opacity: 0.25 }, delay: 0.2, origin: "50% 100%" },
          { key: "left", clip: "polygon(0% 0%, 11.5% 0%, 11.5% 100%, 0% 100%)", from: { rotateY: 45, opacity: 0.25 }, delay: 0.55, origin: "100% 50%" },
          { key: "right", clip: "polygon(88.5% 0%, 100% 0%, 100% 100%, 88.5% 100%)", from: { rotateY: -45, opacity: 0.25 }, delay: 0.55, origin: "0% 50%" },
        ].map((p) => (
          <motion.div key={p.key} className="uslice" style={{ clipPath: p.clip, transformOrigin: p.origin }}
            initial={p.from} animate={{ rotateX: 0, rotateY: 0, scale: 1, opacity: 1 }}
            transition={{ delay: p.delay, type: "spring", stiffness: 220, damping: 28 }}>
            <img src={isPhone ? "/room/room_tall.webp" : "/room/room.png"} alt="" />
          </motion.div>))}
        {assets && (<motion.img className="uview" src={"/views/" + view + "_" + viewTime + ".webp"} alt=""
          style={{ left: ((assets.layout.window.x - assets.layout.window.w * 0.14) / 1152 * 100) + "%",
            top: ((assets.layout.window.y - assets.layout.window.h * 0.1 + (isPhone && assets.layout.tall ? assets.layout.tall.topOffset : 0)) / (isPhone && assets.layout.tall ? assets.layout.tall.height : 2048) * 100) + "%",
            width: (assets.layout.window.w * 1.28 / 1152 * 100) + "%", height: (assets.layout.window.h * 1.28 / (isPhone && assets.layout.tall ? assets.layout.tall.height : 2048) * 100) + "%" }}
          initial={{ opacity: 0.9 }} animate={{ opacity: 1 }} transition={{ delay: 0, duration: 0.3 }} />)}
        <motion.div className="ulamp" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.05, duration: 0.35 }} />
      </section>)}

      {scene.kind === "intro" && (<section className="intro">
        <motion.div className="sheet2" variants={popUp} initial="hidden" animate="shown">
          <h2>Before we start</h2>
          <p className="note">Four quick rounds. Answer on gut feel — there are no wrong answers. Your room fills up with what you're into, then you'll see subjects worth exploring.</p>
          <div className="daypick" role="group" aria-label="Day or dusk">
            {(["day", "dusk"] as const).map((t) => (
              <button key={t} aria-pressed={viewTime === t} onClick={() => { setViewTime(t); sfx.pop(); }}>
                <img src={"/views/" + view + "_" + t + ".webp"} alt="" draggable={false} />
                <span className="daylabel">{viewTime === t && <Check {...ICON_SM} aria-hidden="true" />}{t === "day" ? "Day" : "Dusk"}</span>
              </button>))}
          </div>
          <button className="btn alt" onClick={() => { sfx.pop(); buzz(); dispatch({ type: "GO" }); }}>Let's go</button>
        </motion.div>
      </section>)}

      {scene.kind === "roundTitle" && (<button className="titlecard" aria-label={"Start round " + round} onClick={() => dispatch({ type: "TITLE_DONE" })}>
        <motion.span className="titleinner" initial={{ rotateY: 90, opacity: 0 }} animate={{ rotateY: 0, opacity: 1 }} transition={{ type: "spring", stiffness: 260, damping: 24 }}>
          <span className="titlenum">{"Round " + round}</span>
          <span className="titlebig">{ROUNDS[round - 1].title}</span>
          <span className="titlehow">{ROUNDS[round - 1].how}</span>
        </motion.span>
      </button>)}

      {scene.kind === "round" && (<div className={"overlay" + (round === 1 ? " r1center" : "") + (round === 2 || round === 4 ? " cardlayout" : "")}>
        {round === 1 && (<div className="sheet2 chipsheet">
          <div><p className="eyebrow">Round 1 · your subjects</p><h2>What are you studying?</h2><p className="hint2">Tap the ones you take. Heart your favourites.</p></div>
          <div className="chips">{content.chips.map((chip) => {
            const st = picked[chip.id];
            return (<button key={chip.id} className={"chip" + (st === "love" ? " loved" : "")} aria-pressed={!!st}
              onClick={(e) => { if ((e.target as HTMLElement).closest(".heart")) return; const nxt = toggleChip(st as "take" | "love" | undefined); const n = { ...picked }; if (nxt) n[chip.id] = nxt; else delete n[chip.id]; sfx.pop(); syncChips(n, typedNames); }}>
              <span className={"checkmark" + (st ? "" : " off")} aria-hidden="true"><Check {...ICON_SM} /></span>
              <span className="chiplabel">{chip.name}</span>
              {confetti === chip.id && (<span className="flecks" aria-hidden="true">{[0, 1, 2, 3, 4, 5].map((i) => (
                <motion.i key={i} initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                  animate={{ x: Math.cos(i * 1.05) * 34, y: Math.sin(i * 1.05) * 26 - 8, opacity: 0, scale: 0.5 }}
                  transition={{ duration: 0.55, ease: "easeOut" }} />))}</span>)}
              <span className="heart" role="button" aria-label={"Favourite " + chip.name}
                onClick={(e) => { e.stopPropagation(); e.preventDefault(); const nxt = heartChip(st as "take" | "love" | undefined); const loving = nxt === "love"; if (loving) { setConfetti(chip.id); buzz(); window.setTimeout(() => setConfetti(null), 600); } sfx.pop(); syncChips({ ...picked, [chip.id]: nxt }, typedNames, loving); }}>{st === "love" ? <Heart {...ICON} fill="currentColor" aria-hidden="true" /> : <Heart {...ICON} aria-hidden="true" />}</span>
            </button>);
          })}</div>
          <div>{otherOpen
            ? (<div className="other"><input value={other} list="other-list" placeholder="Type a subject" autoComplete="off" autoFocus
                onChange={(e) => setOther(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && other.trim()) { syncChips(picked, [...typedNames, other.trim()]); setOther(""); } }} />
                <datalist id="other-list">{content.extra_names.map((n) => <option key={n} value={n} />)}</datalist>
                {other.trim().length >= 2 && (<div className="suggestrow">
                  {suggestAliases(content.aliases || {}, other, (code) => subjects.find((s) => s.code === code)?.display_name)
                    .map((name) => <button key={name} className="suggestchip" onClick={() => { syncChips(picked, [...typedNames, name]); setOther(""); }}>{name}</button>)}
                </div>)}</div>)
            : <button className="linkbtn addanother" onClick={() => setOtherOpen(true)}><Plus {...ICON_SM} aria-hidden="true" /> Add another subject</button>}
            {typedNames.length > 0 && <p className="hint2">Added: {typedNames.join(", ")}</p>}</div>
          {Object.keys(picked).length + typedNames.length >= 3
            ? <button className="btn alt" onClick={chipsContinue}>Continue</button>
            : <p className="hint2" style={{ textAlign: "center" }}>Pick at least 3</p>}
        </div>)}

        {(round === 2 || round === 4) && (<div className="cardround">
          <div className="qtag">{round === 2 ? "Would you get stuck into this?" : "Would you want to find out?"}</div>
          <div className={"hintrow" + (deckIdx < 2 ? " nudge" : "")} style={{ opacity: deckIdx >= 2 ? 0.4 : 1 }}>
            <span><span className="harrow hl"><ArrowLeft {...ICON_SM} aria-hidden="true" /></span> Not for me</span>
            <span className="hcount">{Math.min(deckIdx + 1, ROUNDS[round - 1].min)} of {ROUNDS[round - 1].min}</span>
            {round === 4 && <span><span className="harrow hu"><ArrowUp {...ICON_SM} aria-hidden="true" /></span> Tell me more</span>}
            <span>Yes <span className="harrow hr"><ArrowRight {...ICON_SM} aria-hidden="true" /></span></span>
          </div>
          <div className="deck">
            {deck[deckIdx + 1] && <div className="card peek" aria-hidden="true"><CardArt card={deck[deckIdx + 1]} /></div>}
            {current
              ? <div className="card swipe" ref={cardRef} role="group" aria-label={current.title}
                  style={{ transform: `translate(${dragT.x}px, ${dragT.y}px) rotate(${dragT.x / 20}deg)`, transition: dragT.animate ? "transform .28s cubic-bezier(.2,.9,.3,1.2)" : "none" }}
                  onPointerDown={onCardDown} onPointerMove={onCardMove} onPointerUp={onCardUp} onPointerCancel={onCardUp}
                  onWheel={(e) => {
                    const now = performance.now();
                    if (now - wheelRef.current < 700) return;
                    if (round === 4 && e.deltaY < -50) { wheelRef.current = now; flick("up"); }
                    else if (e.deltaX > 50) { wheelRef.current = now; flick("no"); }
                    else if (e.deltaX < -50) { wheelRef.current = now; flick("yes"); }
                  }}>
                  <div className="stamp yes" style={{ opacity: Math.max(0, Math.min(1, dragT.x / 80)) }}>{round === 4 ? "Tell me" : "Yes"}</div>
                  <div className="stamp no" style={{ opacity: Math.max(0, Math.min(1, -dragT.x / 80)) }}>Not for me</div>
                  {round === 4 && <div className="stamp up" style={{ opacity: Math.max(0, Math.min(1, -dragT.y / 80)) }}>Need to know</div>}
                  <CardArt card={current} />
                </div>
              : <div className="card" style={{ placeItems: "center", display: "grid", padding: 16 }}><p className="note">That's every card in this round.</p></div>}
          </div>
          {current && <div className="titlebar">{current.title}</div>}
          <div className="actioncol">
            <div className="continurow">
              {deckIdx >= ROUNDS[round - 1].min && <button className="btn alt" id="continue" onClick={nextRound}>{round < 4 ? "Continue" : "Build my room"}</button>}
            </div>
            <div className="actions">
              <button className="no" aria-label="Not for me" onClick={() => decide("no")}><X {...ICON} aria-hidden="true" /></button>
              <button className="up" aria-label="Need to know" disabled={round !== 4} style={round !== 4 ? { visibility: "hidden" } : undefined} onClick={() => decide("up")}><Sparkles {...ICON} aria-hidden="true" /></button>
              <button className="yes" aria-label="Yes" onClick={() => decide("yes")}><Check {...ICON} aria-hidden="true" /></button>
            </div>
          </div>
        </div>)}

        {round === 3 && pair && (<div className="sheet2">
          <div className="pfoot"><span className="qtag">Which is more you?</span><span className="count">{pairIdx + 1} / {content.pairs.length}</span></div>
          <div className="pairs">
            {(["a", "b"] as const).map((side) => (
              <button key={side} className={"pcard" + (pairPick === side ? " picked" : pairPick ? " dim" : "")} onClick={() => answerPair(pair, side)}>
                <img src={"/img/" + pair.id + "_" + side + ".jpg"} alt="" draggable={false} onDragStart={(e) => e.preventDefault()} />
                <span className="lbl"><b>{pair[side].label}</b><small>{pair[side].caption}</small></span>
              </button>
            ))}
          </div>
          <div className="pfoot"><span className="hint2">Tap a picture</span><button className="linkbtn" onClick={() => answerPair(pair, null)}>Can't decide</button></div>
        </div>)}
      </div>)}

      {scene.kind === "finale" && (<div className="finale">
        <motion.span className="finaletag" initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 300, damping: 20 }}>This is your room.</motion.span>
        <button className="btn alt nextpill finale-next" onClick={() => { sfx.chord(); dispatch({ type: "FINALE_TAP" }); }}>See my subjects</button>
      </div>)}

      {(scene.kind === "reveal" || scene.kind === "share") && (<section className="story">
        <div className="sprog">{Array.from({ length: pageCount }, (_, i) => <i key={i} className={i < page ? "done" : i === page ? "now" : ""} />)}</div>
        <button className="zone left" aria-label="Back" onClick={() => dispatch({ type: "REVEAL_PREV", last: explorePage })} />
        <button className="zone right" aria-label="Next" onClick={() => dispatch({ type: "REVEAL_NEXT", last: explorePage })} />
        {(scene.kind === "share" || page >= 1) && <button className="backbtn" onClick={() => dispatch({ type: "REVEAL_PREV", last: explorePage })}><ChevronLeft {...ICON_SM} aria-hidden="true" /> Back</button>}
        {scene.kind === "reveal" && <button className="btn alt nextpill" onClick={() => dispatch({ type: "REVEAL_NEXT", last: explorePage })}>{page === explorePage ? "Share" : "Next"} <ChevronRight {...ICON_SM} aria-hidden="true" /></button>}
        <div className="pages">
          <div className={"page" + (page === 0 ? " on" : "")}><div className="top3wrap">
            <h2 className="top3head">Your top 3</h2>
            {top3.map((r, i) => (
              <motion.div key={r.code} className="top3card" variants={popUp} custom={i} initial="hidden" animate="shown" transition={{ delay: i * 0.25 }}>
                <img src={"/stickers/" + r.code + ".webp"} alt="" draggable={false} onDragStart={(e) => e.preventDefault()} />
                <div><h3>{r.display_name}</h3>
                <p>{plainOf(r.code) || "It kept coming up in your answers."}</p></div>
              </motion.div>))}
            {!top3.length && <div className="pc bottom"><h2>Not sure yet</h2><p className="note">Play a few more cards to fill this in.</p></div>}
          </div></div>
          <div className={"page" + (page === 1 ? " on" : "")}><div className="wildwrap">
            {wildcardRow ? (<button className="wildcard" aria-label={wildcardFlipped ? wildcardRow.display_name : "Flip the wildcard card"}
              onClick={() => { if (!wildcardFlipped) { setWildcardFlipped(true); sfx.wildcard(); buzz(); } }}>
              <motion.span className="wildinner" animate={{ rotateY: wildcardFlipped ? 180 : 0 }} transition={{ type: "spring", stiffness: 260, damping: 26 }}>
                <span className="wildface wildback">?<small className="tapflip">Tap to reveal your wildcard</small></span>
                <span className="wildface wildfront">
                  <img src={"/stickers/" + wildcardRow.code + ".webp"} alt="" draggable={false} onDragStart={(e) => e.preventDefault()} />
                  <b>{wildcardRow.display_name}</b>
                  <small>{whyOf(wildcardRow.code) || ""}</small>
                  <small>A wildcard: it never came up, but it fits your answers.</small></span>
              </motion.span>
            </button>) : <div className="pc bottom"><h2>No wildcard this time</h2><p className="note">Everything you got was on a card.</p></div>}
          </div></div>
          {practical && (<div className={"page" + (page === 2 ? " on" : "")}><div className="pc bottom"><h2>Hands-on routes</h2>
            <p className="note">Get paid, train on the job, no tuition fees.</p>
            <div className="handsonlist">{handsOn.map((a) => (
              <div key={a.ref} className="handsoncard"><b>{a.title}</b>
                <small>{levelLabel(a.level)} · {lengthLabel(a.months)}{a.degree ? " · Degree included" : ""}</small>
                <small>{a.reason}</small>
                <a href={a.url} target="_blank" rel="noreferrer">Official page <ExternalLink {...ICON_SM} aria-hidden="true" /></a></div>))}
              {!handsOn.length && <p className="note">Loading routes…</p>}</div>
            <p className="note">Apprenticeship standards shown are for England.</p>
          </div></div>)}
          <div className={"page" + (page === explorePage ? " on" : "")}><div className="pc bottom"><h2>Subjects to explore</h2>
            <ul className="subjects">{exploreList.map((r) => { const jobs = subjectFiles[r.code]?.jobs || []; return (
              <li key={r.code} className={r.code === surprise ? "surprise" : ""}><div><b>{r.display_name}</b>
                <small>{r.code === surprise ? "A wildcard: it never came up, but it fits your answers." : (plainOf(r.code) || "")}</small>
                {jobs.length > 0 && <small className="jobline">Graduates often work as: {jobs.map((j) => j.charAt(0).toLowerCase() + j.slice(1)).join(", ")}</small>}
                <span className="explinks"><button className="linkbtn courselink" onClick={() => openCourses(r.code, r.display_name)}>See courses</button></span></div>
                {r.code === surprise && <span className="pct"><span className="tag">surprise</span></span>}</li>); })}
            </ul></div></div>
          <div className={"page" + (page === viewsPage ? " on" : "")}><div className="pc bottom"><h2>Where do you see yourself studying?</h2>
            <div className="views swatches">{VIEWS.map((v) => (
              <button key={v.id} aria-pressed={v.id === view} onClick={() => setView(v.id)}>
                <img src={"/views/" + v.id + "_day.webp"} alt="" />
                <span>{v.name}</span></button>))}</div>
            <p className="note">It changes the view from your window.</p></div></div>
          <div className={"page" + (page === sharePage ? " on" : "")}><div className="pc bottom sharepc"><h2>Share your room</h2>
            <div className="share"><div className="phone">
                <RoomView assigned={assigned} viewId={view} viewTime={viewTime} />
                <div className="over"><b>What's your inkling?</b>
                  <span>{top3.map((r) => r.display_name).join(" · ")}{wildcardRow ? " · " + wildcardRow.display_name + " (wildcard)" : ""}</span></div>
              </div>
              <div><p className="note">{videoStatus === "preparing" ? "Preparing your video…" : "A 10-second video of your room filling up, or send the link."}</p>
                <div className="row" style={{ marginTop: 10 }}>
                  <button className="btn alt" disabled={videoStatus !== "ready"} onClick={async () => {
                    // Blob was pre-rendered at reveal start: share() fires
                    // immediately inside this tap's user activation.
                    const cached = videoRef.current;
                    if (!cached || cached.key !== shareKey) return;
                    const data: ShareData = { t: top3.map((r) => r.code), w: surprise, v: view, vt: viewTime, r: displayCodes };
                    const url = shareUrl(data);
                    const file = new File([cached.blob], "inkling." + cached.ext, { type: cached.blob.type });
                    if (navigator.canShare?.({ files: [file] })) {
                      try { await navigator.share({ files: [file], text: "What's your inkling?", url }); }
                      catch (e) {
                        if ((e as Error).name !== "AbortError") { console.log("share video failed:", (e as Error).name); tip("Sharing didn't work on this browser — try Share image."); }
                      }
                    } else {
                      const u = URL.createObjectURL(cached.blob); const a = document.createElement("a");
                      a.href = u; a.download = file.name; a.click(); URL.revokeObjectURL(u);
                      try { await navigator.clipboard.writeText("What's your inkling? " + url); } catch { /* clipboard optional */ }
                      tip("Video saved — post it from your phone or upload it to Instagram.");
                    }
                  }}><Share2 {...ICON_SM} aria-hidden="true" /> {videoStatus === "preparing" ? "Preparing your video…" : "Share video"}</button>
                  <button className="btn" onClick={async () => {
                    const data: ShareData = { t: top3.map((r) => r.code), w: surprise, v: view, vt: viewTime, r: displayCodes };
                    try { await navigator.clipboard.writeText(shareUrl(data)); tip("Link copied."); } catch { tip(shareUrl(data)); }
                  }}><LinkIcon {...ICON_SM} aria-hidden="true" /> Copy link</button>
                  <button className="btn" onClick={async () => {
                    if (!assets) return;
                    const data: ShareData = { t: top3.map((r) => r.code), w: surprise, v: view, vt: viewTime, r: displayCodes };
                    const url = shareUrl(data);
                    const cachedImg = imageRef.current?.key === shareKey ? imageRef.current.blob : null;
                    const file = cachedImg ? new File([cachedImg], "inkling-room.png", { type: "image/png" }) : null;
                    if (file && navigator.canShare?.({ files: [file] })) {
                      try { await navigator.share({ files: [file], text: "What's your inkling?", url }); }
                      catch (e) {
                        if ((e as Error).name !== "AbortError") { console.log("share image failed:", (e as Error).name); tip("Sharing didn't work on this browser."); }
                      }
                    } else {
                      download(await composeRoomCanvas(assigned, view, viewTime, assets.layout), "inkling-room.png");
                    }
                  }}><Download {...ICON_SM} aria-hidden="true" /> Share image</button>
                  <button className="btn ghost" onClick={restart}><RotateCcw {...ICON_SM} aria-hidden="true" /> Start over</button>
                </div>
                <p className="note sharehint">{canShareFiles ? "Opens your share sheet — pick Instagram, TikTok or WhatsApp" : "Saves the video — post it from your phone"}</p></div></div>
          </div></div>
        </div>
      </section>)}

      {courseSheet && (<div className="coursesheetwrap">
        <button className="coursescrim" aria-label="Close courses" onClick={() => setCourseSheet(null)} />
        <motion.div className="coursesheet" initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: "spring", stiffness: 300, damping: 30 }}>
          <div className="pfoot"><h2>{courseSheet.name}</h2>
            <button className="linkbtn" onClick={() => setCourseSheet(null)}><X {...ICON_SM} aria-hidden="true" /> Close</button></div>
          <div className="sheettabs" role="tablist" aria-label="Routes">
            <button role="tab" aria-selected={sheetTab === "courses"} className={sheetTab === "courses" ? "on" : ""} onClick={() => setSheetTab("courses")}>University courses</button>
            <button role="tab" aria-selected={sheetTab === "apprenticeships"} className={sheetTab === "apprenticeships" ? "on" : ""} onClick={() => setSheetTab("apprenticeships")}>Apprenticeships</button>
          </div>
          {sheetTab === "apprenticeships" && (() => {
            const file = subjectFiles[courseSheet.code];
            if (!file) return <ul className="courselist"><li><small>Loading apprenticeships…</small></li></ul>;
            const list = file.apprenticeships || [];
            return (<>
              <p className="note">Get paid, train on the job, no tuition fees.</p>
              {!list.length && <ul className="courselist"><li><small>No close apprenticeships for this subject</small></li></ul>}
              <ul className="courselist apprlist">{list.map((a) => (
                <li key={a.ref}><div><b>{a.title}</b>
                  <small>{levelLabel(a.level)} · {lengthLabel(a.months)}</small>
                  {a.degree && <span className="settingtag">Degree included</span>}
                  <small>{a.reason}</small></div>
                  <a href={a.url} target="_blank" rel="noreferrer">Official page <ExternalLink {...ICON_SM} aria-hidden="true" /></a></li>))}</ul>
              <p className="note">Apprenticeship standards shown are for England.</p>
              <p className="note">Contains public sector information licensed under the Open Government Licence v3.0. Apprenticeship standards © Skills England.</p>
            </>);
          })()}
          {sheetTab === "courses" && (() => {
            const all = subjectFiles[courseSheet.code]?.courses;
            if (!all) return <ul className="courselist"><li><small>Loading courses…</small></li></ul>;
            if (!all.length) return <ul className="courselist"><li><small>No course pages yet for this subject.</small></li></ul>;
            const chosen = { city: "city", coast: "coast", campus: "campus town", countryside: "countryside" }[view] || "campus town";
            const heading = { city: "In a city", coast: "In a coastal town", "campus town": "In a campus town", countryside: "In the countryside" }[chosen];
            const adj = { city: "city", coast: "coastal", "campus town": "campus town", countryside: "countryside" }[chosen];
            const inChosen = all.filter((c) => c.setting === chosen);
            const elsewhere = all.filter((c) => c.setting !== chosen);
            const render = (list: typeof all) => list.map((c, i) => (
              <li key={c.title + i}><div><b>{c.title}</b><small>{c.provider}</small>
                {c.setting && <span className="settingtag">{c.setting}{c.town ? " · " + c.town : ""}</span>}</div>
                <a href={c.url} target="_blank" rel="noreferrer">Course page <ExternalLink {...ICON_SM} aria-hidden="true" /></a></li>));
            return (<>
              {inChosen.length > 0 && (<><h3 className="coursehead">{heading}</h3><ul className="courselist">{render(inChosen)}</ul></>)}
              {inChosen.length === 0 && <p className="note">{"No " + adj + " courses for this subject — here are the others."}</p>}
              {elsewhere.length > 0 && (<><h3 className="coursehead">Elsewhere</h3><ul className="courselist">{render(elsewhere)}</ul></>)}
            </>);
          })()}
          <p className="note">Course data: Discover Uni (HESA), CC BY 4.0. Graduate job data: Discover Uni (HESA). Campus settings tagged by Muse Spark Open from HESA location data.</p>
        </motion.div>
      </div>)}
    </div></>
  );
}
