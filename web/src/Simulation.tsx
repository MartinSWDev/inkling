import { useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw, Shuffle, Sparkles, Volume2, VolumeX, X } from "lucide-react";
import AppMenu from "./Menu";
import SimScene from "./SimScene";
import { BUILDINGS, PAPER_COLOURS, loadSnapshot, runLiveStudent, type Paper, type SimSnapshot, type SimStudent } from "./simData";
import { setSoundEnabled, unlock } from "./design/sound";

const ICON = { size: 20, strokeWidth: 2 } as const;
const ICON_SM = { size: 16, strokeWidth: 2 } as const;
const pct = (v: number | null | undefined) => (v == null ? "—" : Math.round(v * 100) + "%");

function BuildingCard({ paper, students, onPick, onClose }: { paper: Paper; students: SimStudent[]; onPick: (s: SimStudent) => void; onClose: () => void }) {
  return (
    <aside className="studentcard buildingcard" role="dialog" aria-label={BUILDINGS[paper]}>
      <div className="studenthead">
        <h3 className="studentname"><img className="cardbuilding" src={`/sim/buildings/${paper}.webp`} alt="" draggable={false} />{BUILDINGS[paper]}</h3>
        <button className="menubtn iconbtn" aria-label="Close" onClick={onClose}><X {...ICON_SM} aria-hidden="true" /></button>
      </div>
      <p className="note">{students.length ? `${students.length} ${students.length === 1 ? "student" : "students"} ended up here. Tap one to read their story.` : "Nobody has arrived here yet."}</p>
      <div className="insidegrid">
        {students.map((s) => (
          <button key={s.id} className="insidepal" onClick={() => onPick(s)} aria-label={`${s.first_name}, ${s.hit3 ? "hit" : "miss"}`}>
            <img src={`/characters/${s.paper}.webp`} alt="" draggable={false} />
            <span>{s.first_name}</span>
            <span className={"insidemark " + (s.hit3 ? "hit" : "miss")} aria-hidden="true">{s.hit3 ? "★" : "·"}</span>
          </button>
        ))}
      </div>
    </aside>
  );
}
function StudentCard({ s, snap, onClose, backTo }: { s: SimStudent; snap: SimSnapshot; onClose: () => void; backTo?: string }) {
  const name = (code: string | null) => (code ? snap.subjects[code] || code : "—");
  return (
    <aside className="studentcard" role="dialog" aria-label={"Student " + s.first_name}>
      <div className="studenthead">
        <h3 className="studentname"><img className="cardpal" src={`/characters/${s.paper}.webp`} alt="" draggable={false} />{s.first_name}, {s.age}</h3>
        <button className="menubtn iconbtn" aria-label="Close student card" onClick={onClose}><X {...ICON_SM} aria-hidden="true" /></button>
      </div>
      {backTo && <button className="linkbtn backlink" onClick={onClose}>← Back to {backTo}</button>}
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

type HeldOut = { before: { hit3: number; subjects_reached: number }; after: { hit3: number; subjects_reached: number } };

export default function Simulation() {
  const [snap, setSnap] = useState<SimSnapshot | null>(null);
  const [heldOut, setHeldOut] = useState<HeldOut | null>(null);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [replayKey, setReplayKey] = useState(0);
  const [selected, setSelected] = useState<SimStudent | null>(null);
  const [building, setBuilding] = useState<{ paper: Paper; ids: string[] } | null>(null);
  const [arrived, setArrived] = useState(0);
  const [soundOn, setSoundOn] = useState(false);
  const [reduced] = useState(() => typeof window !== "undefined"
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [started, setStarted] = useState(false);
  const sceneWrapRef = useRef<HTMLDivElement>(null);
  // One brand-new student, written and played live (prompts/21 E).
  const [liveStudents, setLiveStudents] = useState<SimStudent[]>([]);
  const [liveProvider, setLiveProvider] = useState<"baseten" | "meta" | null>(null);
  const [liveLog, setLiveLog] = useState("");
  const [runLivePhase, setRunLivePhase] = useState<"idle" | "writing" | "scoring" | "walking" | "error">("idle");
  const displayStudents = snap ? [...snap.students, ...liveStudents] : [];

  const runLive = async () => {
    if (runLivePhase === "writing" || runLivePhase === "scoring") return;
    setRunLivePhase("writing");
    setLiveLog("");
    setLiveProvider(null);
    const student = await runLiveStudent((line) => setLiveLog((log) => log + line), (provider) => setLiveProvider(provider));
    if (!student) { setRunLivePhase("error"); return; }
    setRunLivePhase("scoring");
    setLiveStudents((list) => [...list, student]);
    setSelected(student);
    setRunLivePhase("walking");
  };

  useEffect(() => { loadSnapshot().then(setSnap); }, []);
  useEffect(() => {
    fetch("/data/score_calibration.json").then((r) => r.json())
      .then((d) => { if (d?.held_out) setHeldOut(d.held_out as HeldOut); })
      .catch(() => setHeldOut(null));
  }, []);
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
    setBuilding(null);
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
              <SimScene students={displayStudents} playing={playing} speed={speed} replayKey={replayKey}
                finalState={finalState} selectedId={selected?.id ?? null} soundOn={soundOn}
                onSelect={(s) => { setBuilding(null); setSelected(s); }} onArrive={setArrived}
                onBuilding={(paper, ids) => { setSelected(null); setBuilding({ paper, ids }); }} />
            ) : <p className="note" style={{ padding: 18 }}>Loading the simulation…</p>}
            {selected && snap && <StudentCard s={selected} snap={snap} onClose={() => setSelected(null)}
              backTo={building ? BUILDINGS[building.paper] : undefined} />}
            {!selected && building && snap && <BuildingCard paper={building.paper}
              students={building.ids.map((id) => displayStudents.find((s) => s.id === id)).filter((s): s is SimStudent => !!s)}
              onPick={setSelected} onClose={() => setBuilding(null)} />}
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
            <span className="arrived" role="status">{snap ? `${arrived} / ${displayStudents.length} arrived` : ""}</span>
          </div>
          <p className="note">Tap a building to see who ended up there, then tap a student to read their story.</p>
        </section>
        <section className="simcard livepanel" aria-label="Run a live student">
          <h2>Run a live student</h2>
          <button className="btn alt" onClick={runLive}
            disabled={runLivePhase === "writing" || runLivePhase === "scoring"}>
            <Sparkles {...ICON_SM} aria-hidden="true" />
            {runLivePhase === "writing" ? "Writing a new student…" : runLivePhase === "scoring" ? "Scoring…" : "Run a live student"}</button>
          <p className="note">Costs a few pence in model calls. The batch above was free to replay.</p>
          {runLivePhase === "error" && <p className="note">That live run failed — the log below says why. The batch simulation is unaffected.</p>}
          {runLivePhase === "walking" && <p className="note">Added — watch them walk to their building, or tap them for their story.</p>}
          {(liveLog || runLivePhase === "writing") && (<>
            <p className="note">{liveProvider === "meta" ? "Live student · Muse Spark via the Meta Model API" : "Live student · Muse Spark Open on Baseten"}</p>
            <pre className="livelog" aria-live="polite">{liveLog || "Waiting for the model…"}</pre></>)}
        </section>
        <div id="sim-results">{snap ? <Results snap={snap} students={displayStudents} heldOut={heldOut} onPick={setSelected} /> : null}</div>
      </main>
    </div>
  );
}

function Results({ snap, students, heldOut, onPick }: { snap: SimSnapshot; students: SimStudent[]; heldOut: HeldOut | null; onPick: (s: SimStudent) => void }) {
  const sm = snap.summary;
  const arrivedByPaper: Record<string, number> = {};
  for (const s of students) arrivedByPaper[s.dest_paper] = (arrivedByPaper[s.dest_paper] || 0) + 1;
  const arrivals = Object.entries(arrivedByPaper)
    .map(([paper, n]) => ({ paper: paper as keyof typeof BUILDINGS, n }))
    .sort((a, b) => b.n - a.n);
  const maxArr = Math.max(1, ...arrivals.map((a) => a.n));
  const hits = students.filter((s) => s.hit3).slice(0, 4);
  const misses = students.filter((s) => !s.hit3).slice(0, 2);
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

      {heldOut && (
        <section className="simcard" aria-label="Before and after">
          <h2>Before and after</h2>
          <p>We found broad subjects like Zoology and Engineering were winning everyone&apos;s top 3. Correcting for that, measured on students the fix wasn&apos;t tuned on: {pct(heldOut.before.hit3)} → {pct(heldOut.after.hit3)} got a subject they&apos;d suit in their top 3; subjects reached {heldOut.before.subjects_reached} → {heldOut.after.subjects_reached}.</p>
        </section>
      )}

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
        <p className="note">This page replays a fixed snapshot, so it costs nothing to view. “Run a live student” above makes live model calls instead.</p>
      </section>

      <section aria-label="Example students">
        <h2 style={{ fontFamily: "var(--display)", fontWeight: 900 }}>Example students</h2>
        <div className="examplegrid">
          {examples.map((s) => (
            <button key={s.id} className="simcard examplecard" onClick={() => { onPick(s); window.scrollTo({ top: 0, behavior: "smooth" }); document.querySelector(".simpage")?.scrollTo({ top: 0, behavior: "smooth" }); }}>
              <img className="expal" src={`/characters/${s.paper}.webp`} alt="" draggable={false} />
              <span className="exbody">
                <b>{s.first_name}, {s.age}</b> · {s.where}<br />
                <span className="note">{s.enjoys}</span><br />
                <span>Top 3: {s.top3.map(name).join(" · ")}</span><br />
                <span className={"hitbadge " + (s.hit3 ? "hit" : "miss")}>{s.hit3 ? "Hit" : "Miss"}</span>
              </span>
            </button>
          ))}
        </div>
      </section>
    </>
  );
}
