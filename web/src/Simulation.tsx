import { useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw, Shuffle, Volume2, VolumeX, X } from "lucide-react";
import AppMenu from "./Menu";
import SimScene from "./SimScene";
import { loadSnapshot, type SimSnapshot, type SimStudent } from "./simData";
import { setSoundEnabled, unlock } from "./design/sound";

const ICON = { size: 20, strokeWidth: 2 } as const;
const ICON_SM = { size: 16, strokeWidth: 2 } as const;
const pct = (v: number | null | undefined) => (v == null ? "—" : Math.round(v * 100) + "%");

function StudentCard({ s, snap, onClose }: { s: SimStudent; snap: SimSnapshot; onClose: () => void }) {
  const name = (code: string | null) => (code ? snap.subjects[code] || code : "—");
  return (
    <aside className="studentcard" role="dialog" aria-label={"Student " + s.first_name}>
      <div className="studenthead">
        <h3>{s.first_name}, {s.age}</h3>
        <button className="menubtn iconbtn" aria-label="Close student card" onClick={onClose}><X {...ICON_SM} aria-hidden="true" /></button>
      </div>
      <p className="note">{s.where} · {s.certainty === "no idea" ? "says they have no idea yet"
        : s.certainty === "torn" ? "torn between subjects" : "knows what they like"}</p>
      <p>{s.enjoys}</p>
      <p><b>Subjects they take:</b> {s.answers.chips.map((c) => c.name + (c.love ? " ♥" : "")).join(", ") || "—"}
        {s.answers.typed.length ? " · also " + s.answers.typed.join(", ") : ""}</p>
      <p><b>Rounds:</b> said yes to {s.answers.yes.things} of {s.answers.yes.things_total} activities,{" "}
        {s.answers.yes.questions} of {s.answers.yes.questions_total} big questions
        ({s.answers.yes.questions_up} “need to know”), chose in {s.answers.pairs_decided} of {s.answers.pairs.length} pairs.</p>
      <p><b>Their top 3:</b> {s.top3.map(name).join(" · ")}</p>
      <p><b>Wildcard:</b> {name(s.wildcard)}</p>
      <p><b>Would genuinely suit:</b> {s.suits.map(name).join(" · ")}</p>
      <p><span className={"hitbadge " + (s.hit3 ? "hit" : "miss")}>{s.hit3 ? "Hit — top 3 included a subject they'd suit" : "Miss — top 3 missed their subjects"}</span></p>
    </aside>
  );
}

export default function Simulation() {
  const [snap, setSnap] = useState<SimSnapshot | null>(null);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [replayKey, setReplayKey] = useState(0);
  const [selected, setSelected] = useState<SimStudent | null>(null);
  const [arrived, setArrived] = useState(0);
  const [soundOn, setSoundOn] = useState(false);
  const [reduced] = useState(() => typeof window !== "undefined"
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [started, setStarted] = useState(false);
  const sceneWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => { loadSnapshot().then(setSnap); }, []);
  const finalState = reduced && !started;

  useEffect(() => {
    if (!snap || reduced) return;
    const el = sceneWrapRef.current;
    if (!el) return;
    const ob = new IntersectionObserver(([e]) => { if (e.isIntersecting) setPlaying(true); }, { threshold: 0.25 });
    ob.observe(el);
    return () => ob.disconnect();
  }, [snap, reduced]);

  const followRandom = () => {
    if (!snap?.students.length) return;
    setSelected(snap.students[Math.floor(Math.random() * snap.students.length)]);
  };

  return (
    <div className="simpage">
      <header className="simhead">
        <AppMenu path="/simulation" />
        <h1>The simulation</h1>
        <p className="simlede">{snap ? snap.students.length : 200} simulated students play Inkling, then walk to the subject they&apos;d suit. Watch what happens.</p>
        {snap?.placeholder && <span className="previewbadge">Preview data</span>}
      </header>
      <main className="simmain">
        <section className="simscene-card">
          <div className="simscene-wrap" ref={sceneWrapRef}>
            {snap ? (
              <SimScene students={snap.students} playing={playing} speed={speed} replayKey={replayKey}
                finalState={finalState} selectedId={selected?.id ?? null} soundOn={soundOn}
                onSelect={setSelected} onArrive={setArrived} />
            ) : <p className="note" style={{ padding: 18 }}>Loading the simulation…</p>}
            {selected && snap && <StudentCard s={selected} snap={snap} onClose={() => setSelected(null)} />}
          </div>
          <div className="simcontrols">
            {finalState ? (
              <button className="btn alt" onClick={() => { setStarted(true); setPlaying(true); }}>
                <Play {...ICON_SM} aria-hidden="true" /> Play</button>
            ) : (
              <button className="btn alt" aria-label={playing ? "Pause" : "Play"}
                onClick={() => { setStarted(true); setPlaying(!playing); }}>
                {playing ? <Pause {...ICON_SM} aria-hidden="true" /> : <Play {...ICON_SM} aria-hidden="true" />}
                {playing ? "Pause" : "Play"}</button>
            )}
            <button className="btn" aria-label="Replay" onClick={() => { setStarted(true); setArrived(0); setReplayKey((k) => k + 1); setPlaying(true); }}>
              <RotateCcw {...ICON_SM} aria-hidden="true" /> Replay</button>
            <div className="speeds" role="group" aria-label="Speed">
              {[1, 2, 4].map((v) => (
                <button key={v} aria-pressed={speed === v} className={speed === v ? "on" : ""}
                  onClick={() => setSpeed(v)}>{v}×</button>
              ))}
            </div>
            <button className="btn" onClick={followRandom}><Shuffle {...ICON_SM} aria-hidden="true" /> Follow a random student</button>
            <button className="btn" aria-label={soundOn ? "Sound on" : "Sound off"} aria-pressed={soundOn}
              onClick={() => { const on = !soundOn; setSoundOn(on); setSoundEnabled(on); if (on) unlock(); }}>
              {soundOn ? <Volume2 {...ICON_SM} aria-hidden="true" /> : <VolumeX {...ICON_SM} aria-hidden="true" />}</button>
            <span className="arrived" role="status">{snap ? `${arrived} / ${snap.students.length} arrived` : ""}</span>
          </div>
          <p className="note">Tap a student to see their card. Buildings and paper pals are paper-coloured
            placeholders until the cut-out images land.</p>
        </section>
        <div id="sim-results">{snap ? <Results snap={snap} onPick={setSelected} /> : null}</div>
      </main>
    </div>
  );
}

function Results({ snap, onPick }: { snap: SimSnapshot; onPick: (s: SimStudent) => void }) {
  void onPick;
  return null;
}
