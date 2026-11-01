import { useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw, Shuffle, Volume2, VolumeX, X } from "lucide-react";
import AppMenu from "./Menu";
import SimScene from "./SimScene";
import { BUILDINGS, PAPER_COLOURS, loadSnapshot, type SimSnapshot, type SimStudent } from "./simData";
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
  const sm = snap.summary;
  const arrivals = Object.entries(sm.arrivals_by_paper)
    .map(([paper, n]) => ({ paper: paper as keyof typeof BUILDINGS, n }))
    .sort((a, b) => b.n - a.n);
  const maxArr = Math.max(1, ...arrivals.map((a) => a.n));
  const hits = snap.students.filter((s) => s.hit3).slice(0, 4);
  const misses = snap.students.filter((s) => !s.hit3).slice(0, 2);
  const examples = [...hits, ...misses];
  const name = (code: string) => snap.subjects[code] || code;
  return (
    <>
      <section aria-label="Headline results">
        <div className="results-grid">
          <div className="simcard"><p className="bignum">{pct(sm.hit3)}</p><p className="note">Top 3 included a subject they&apos;d suit</p></div>
          <div className="simcard"><p className="bignum">{pct(sm.hit5)}</p><p className="note">…in their top 5</p></div>
          <div className="simcard"><p className="bignum">{pct(sm.family3)}</p><p className="note">Right subject family in top 3</p></div>
          <div className="simcard"><p className="bignum">{sm.median_answers_to_settle ?? "—"}</p><p className="note">Answers before the top 3 settled (median)</p></div>
          <div className="simcard"><p className="bignum">{sm.subjects_ever_in_top3} of {sm.total_subjects}</p><p className="note">Different subjects reached</p></div>
          <div className="simcard"><p className="bignum">{sm.students}</p><p className="note">Simulated students</p></div>
        </div>
      </section>

      <section className="simcard" aria-label="Arrivals per building">
        <h2>Where they ended up</h2>
        <div className="bars">
          {arrivals.map(({ paper, n }) => (
            <div className="bar-row" key={paper}>
              <span>{BUILDINGS[paper] || paper}</span>
              <span className="bar-track"><span className="bar-fill" style={{ display: "block", width: (n / maxArr * 100) + "%", background: PAPER_COLOURS[paper] || "#c9b8e8" }} /></span>
              <span>{n}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="simcard" aria-label="Knowing versus no idea">
        <h2>“No idea” versus “I know”</h2>
        <p>Students who&apos;d say they have no idea ({sm.no_idea_count}): <b className="bignum" style={{ fontSize: 28 }}>{pct(sm.hit3_no_idea)}</b> got a suited subject in their top 3.</p>
        <p>Students who know what they like ({sm.knows_count}): <b className="bignum" style={{ fontSize: 28 }}>{pct(sm.hit3_knows)}</b></p>
      </section>

      <section className="simcard">
        <h2>How this works</h2>
        <p>200 students were written and played by Muse Spark Open (Meta&apos;s open-weights model, on Baseten). Each student answers every card in character; the real Inkling scoring code then ranks subjects for them. Each persona&apos;s ground truth — the subjects they&apos;d genuinely suit — was written before they played.</p>
        <p className="note">These are simulated students, so this measures whether Inkling&apos;s questions and scoring are consistent with a student&apos;s stated interests — not a study of real students.</p>
      </section>

      <section className="simcard">
        <h2>Run it yourself</h2>
        <pre className="simcmd">python scripts/simulate_students.py --limit 20{"\n"}python scripts/simulate_students.py{"\n"}python scripts/export_sim_snapshot.py</pre>
        <p className="note">This page replays a fixed snapshot, so it costs nothing to view. No live calls are made.</p>
      </section>

      <section aria-label="Example students">
        <h2 style={{ fontFamily: "var(--display)", fontWeight: 900 }}>Example students</h2>
        <div className="examplegrid">
          {examples.map((s) => (
            <button key={s.id} className="simcard examplecard" onClick={() => { onPick(s); window.scrollTo({ top: 0, behavior: "smooth" }); document.querySelector(".simpage")?.scrollTo({ top: 0, behavior: "smooth" }); }}>
              <b>{s.first_name}, {s.age}</b> · {s.where}<br />
              <span className="note">{s.enjoys}</span><br />
              <span>Top 3: {s.top3.map(name).join(" · ")}</span><br />
              <span className={"hitbadge " + (s.hit3 ? "hit" : "miss")}>{s.hit3 ? "Hit" : "Miss"}</span>
            </button>
          ))}
        </div>
      </section>
    </>
  );
}
