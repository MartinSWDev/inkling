import { useEffect, useState } from "react";
import AppMenu from "./Menu";
import { Sparkles, Image as ImageIcon, ScanSearch, Code2, Database, FlaskConical, CalendarDays, ArrowRight, ExternalLink } from "lucide-react";

const ICON = { size: 18, strokeWidth: 2 } as const;
const PALS = ["graph","blueprint","printout","lab","manuscript","watercolour","parchment","map","legal","kraft","lined"] as const;

type Cal = {
  held_out?: { before: { hit3:number; hit5:number; family3:number; subjects_reached:number }; after: { hit3:number; hit5:number; family3:number; subjects_reached:number } };
};

export default function Built() {
  const [cal, setCal] = useState<Cal | null>(null);

  useEffect(() => {
    document.title = "How Inkling was built";
    let meta = document.querySelector('meta[name="description"]') as HTMLMetaElement | null;
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "description";
      document.head.appendChild(meta);
    }
    meta.content = "How Inkling was built with Meta's Muse Spark Open, Muse Image and SAM 3.1";
    fetch("/data/score_calibration.json").then(r => r.json()).then(d => setCal(d)).catch(()=>{});
  }, []);

  const heldBefore = cal?.held_out?.before;
  const heldAfter = cal?.held_out?.after;

  return (
    <div className="simpage builtpage">
      <header className="simhead">
        <AppMenu path="/built" />
        <h1>How Inkling was built</h1>
        <p className="simlede">One week, one developer, Meta&apos;s models doing the heavy lifting once — so the game is free to play at any scale.</p>
        <div className="built-pals" aria-hidden="true">
          {PALS.map(p => (
            <img key={p} src={`/characters/${p}.webp`} alt="" loading="lazy" draggable={false} />
          ))}
        </div>
      </header>

      <main className="simmain">
        {/* What each Meta model did */}
        <section aria-label="What each Meta model did">
          <h2 style={{fontFamily:"var(--display)",fontWeight:900,fontSize:26,margin:"0 0 12px"}}>What each Meta model did</h2>
          <div className="model-grid">

            {/* Muse Spark Open */}
            <div className="simcard model-card">
              <div className="model-head">
                <span className="model-icon"><Sparkles {...ICON} aria-hidden="true" /></span>
                <div>
                  <h3>Muse Spark Open — the text brain</h3>
                  <p>open weights, meta-models/muse-spark-open-1026 on Baseten · one-off batch jobs</p>
                </div>
              </div>
              <div className="model-body">
                <p>All text work ran once as batch jobs. No AI calls happen while you play.</p>
                <ul>
                  <li>Wrote a card for each of the 163 UK degree subjects (HESA CAH3) — description, &ldquo;good if you…&rdquo;, room object, related subjects and keywords. From HESA course titles and graduate jobs.</li>
                  <li>Reviewed its own cards. 74 cards were changed — duplicate objects removed, room balance fixed, stereotypes replaced. Originals kept.</li>
                  <li>Wrote 2,481 aliases plus 70 school and college subjects (A-level, BTEC, T-level, Highers) so &ldquo;Add another subject&rdquo; understands what teenagers type.</li>
                  <li>Rated 5,118 course titles 0–3 for relevance so &ldquo;See courses&rdquo; shows the right degrees.</li>
                  <li>Tagged 695 UK teaching locations as city / coast / campus town / countryside.</li>
                  <li>Linked 499 live apprenticeship standards to 159 of 163 subjects for &ldquo;Rather earn while you learn?&rdquo;.</li>
                  <li>Wrote and played 200 simulated students to test the scoring. Each persona played every round.</li>
                </ul>
                <p className="note">You see this in the room, the search, the course lists, the campus filters, and the simulation.</p>
                <div className="model-visual" aria-hidden="true">
                  <span className="json-snippet">{'{ "display_name": "Zoology",'}<br/>{'  "plain": "You study animals, how their bodies work, how they behave and where they live.",'}<br/>{'  "why_line": "Good if you\'re curious about why animals act the way they do.",'}<br/>{'  "object": "pair of field binoculars with neck strap", "slot": "shelf" }'}</span>
                </div>
                <div className="script-links">
                  <a href="https://github.com/MartinSWDev/inkling/blob/main/scripts/subject_cards.py" target="_blank" rel="noreferrer">scripts/subject_cards.py <ExternalLink size={12} aria-hidden="true" /></a>
                  <a href="https://github.com/MartinSWDev/inkling/blob/main/scripts/apply_card_overrides.py" target="_blank" rel="noreferrer">scripts/apply_card_overrides.py <ExternalLink size={12} aria-hidden="true" /></a>
                  <a href="https://github.com/MartinSWDev/inkling/blob/main/scripts/subject_aliases.py" target="_blank" rel="noreferrer">scripts/subject_aliases.py <ExternalLink size={12} aria-hidden="true" /></a>
                  <a href="https://github.com/MartinSWDev/inkling/blob/main/scripts/course_relevance.py" target="_blank" rel="noreferrer">scripts/course_relevance.py <ExternalLink size={12} aria-hidden="true" /></a>
                  <a href="https://github.com/MartinSWDev/inkling/blob/main/scripts/campus_settings.py" target="_blank" rel="noreferrer">scripts/campus_settings.py <ExternalLink size={12} aria-hidden="true" /></a>
                  <a href="https://github.com/MartinSWDev/inkling/blob/main/scripts/apprenticeship_links.py" target="_blank" rel="noreferrer">scripts/apprenticeship_links.py <ExternalLink size={12} aria-hidden="true" /></a>
                  <a href="https://github.com/MartinSWDev/inkling/blob/main/scripts/simulate_students.py" target="_blank" rel="noreferrer">scripts/simulate_students.py <ExternalLink size={12} aria-hidden="true" /></a>
                </div>
              </div>
            </div>

            {/* Muse Image */}
            <div className="simcard model-card">
              <div className="model-head">
                <span className="model-icon"><ImageIcon {...ICON} aria-hidden="true" /></span>
                <div>
                  <h3>Muse Image — the paper world</h3>
                  <p>muse-image-1.0 · one paper-diorama style</p>
                </div>
              </div>
              <div className="model-body">
                <p>Drew everything you see as paper.</p>
                <ul>
                  <li>The halls room, plus a taller phone version (outpainted).</li>
                  <li>162 subject stickers, 16 window views, 34 card illustrations, 11 scrunched-paper pals, and 13 simulation-town buildings.</li>
                </ul>
                <p className="note">All in one paper-diorama style so the room feels real and loads instantly.</p>
                <div className="model-visual" aria-hidden="true">
                  {PALS.slice(0,5).map(p => (
                    <img key={p} src={`/characters/${p}.webp`} alt="" loading="lazy" draggable={false} />
                  ))}
                  {["graph","blueprint","lab"].map(p => (
                    <img key={p} className="building" src={`/sim/buildings/${p}.webp`} alt="" loading="lazy" draggable={false} onError={e => (e.currentTarget.style.display="none")} />
                  ))}
                </div>
                <div className="script-links">
                  <a href="https://github.com/MartinSWDev/inkling/blob/main/scripts/build_stickers.py" target="_blank" rel="noreferrer">scripts/build_stickers.py <ExternalLink size={12} aria-hidden="true" /></a>
                  <a href="https://github.com/MartinSWDev/inkling/blob/main/scripts/build_characters.py" target="_blank" rel="noreferrer">scripts/build_characters.py <ExternalLink size={12} aria-hidden="true" /></a>
                  <a href="https://github.com/MartinSWDev/inkling/blob/main/scripts/build_buildings.py" target="_blank" rel="noreferrer">scripts/build_buildings.py <ExternalLink size={12} aria-hidden="true" /></a>
                </div>
              </div>
            </div>

            {/* SAM 3.1 */}
            <div className="simcard model-card">
              <div className="model-head">
                <span className="model-icon"><ScanSearch {...ICON} aria-hidden="true" /></span>
                <div>
                  <h3>SAM 3.1 — the checker</h3>
                  <p>finds and checks every object</p>
                </div>
              </div>
              <div className="model-body">
                <p>Found and checked objects in the sticker renders and the early in-room renders.</p>
                <p>Stickers are cut out on a green key. SAM confirms the object is there and where it is.</p>
                <p className="note">This keeps stickers clean and the room tidy.</p>
              </div>
            </div>

            {/* Muse Code */}
            <div className="simcard model-card">
              <div className="model-head">
                <span className="model-icon"><Code2 {...ICON} aria-hidden="true" /></span>
                <div>
                  <h3>Muse Code — the coding partner</h3>
                  <p>Meta's coding agent</p>
                </div>
              </div>
              <div className="model-body">
                <p>Coding partner for most of the build. Prompts are in prompts/.</p>
                <p>Used early for scene ideas for the &ldquo;This or that&rdquo; pictures.</p>
                <p>The /built page itself was written by Muse Spark Open through Aider on Baseten after the Muse Code credits ran out.</p>
              </div>
            </div>

          </div>
        </section>

        {/* Live during play */}
        <section className="simcard">
          <h2>Live during play</h2>
          <ul>
            <li><b>Your inkling</b> (Muse Spark Open, on Baseten): when you reach your top 3, it writes two or three sentences about how your answers connect to them, streamed in live — with a wildcard sentence when you have one. If it is unavailable, you just see the cards.</li>
            <li><b>Your paper pal</b> (Muse Image, Meta Model API): on the share page, it draws a paper pal of your top subject&apos;s paper type, proudly holding its room object, and it appears on your share image too. If it fails, the card simply never appears.</li>
            <li><b>Live students</b> (Muse Spark Open, on Baseten): “Run a live student” on the simulation page writes a brand-new student and plays every round as them, streamed as a live log, then the same scoring code walks them to their building.</li>
          </ul>
        </section>

        {/* Why open weights */}
        <section className="simcard">
          <h2>Why open weights</h2>
          <p>Every text step runs on an open model. A school, careers service or exam board could run the whole pipeline on its own servers, in its own language, and keep pupils&apos; answers in-house.</p>
          <p>Batch jobs built the world, so the game itself works with no AI calls. The live touches above are optional extras that degrade silently — that keeps the core free at any scale.</p>
        </section>

        {/* Data underneath */}
        <section className="simcard">
          <div className="model-head">
            <span className="model-icon"><Database {...ICON} aria-hidden="true" /></span>
            <h2 style={{margin:0}}>The data underneath</h2>
          </div>
          <div className="data-credits">
            <p>No AI-generated facts about courses. Every number comes from these sources.</p>
            <blockquote>Contains HESA Discover Uni data (HESA, www.hesa.ac.uk), licensed under CC BY 4.0.</blockquote>
            <p>28,753 courses from 315 providers loaded.</p>
            <blockquote>This includes information from the O*NET 31.0 Database by the U.S. Department of Labor, Employment and Training Administration (USDOL/ETA). Used under the CC BY 4.0 license. O*NET® is a trademark of USDOL/ETA. Inkling has modified all or some of this information. USDOL/ETA has not approved, endorsed, or tested these modifications.</blockquote>
            <blockquote>Contains public sector information licensed under the Open Government Licence v3.0. Apprenticeship standards © Skills England.</blockquote>
            <p>499 live apprenticeship standards are linked to subjects. Campus settings cover 695 UK teaching locations.</p>
          </div>
        </section>

        {/* Build journey */}
        <section className="simcard">
          <div className="model-head">
            <span className="model-icon"><CalendarDays {...ICON} aria-hidden="true" /></span>
            <h2 style={{margin:0}}>Build journey</h2>
          </div>
          <p className="note">95 commits in one week, from the git history.</p>
          <div className="timeline">
            <div className="timeline-item">
              <b>Mon 26 Oct</b> <span className="count">· 2 commits</span>
              <p>Idea and smoke tests for Spark, Image and SAM.</p>
            </div>
            <div className="timeline-item">
              <b>Tue 27 Oct</b> <span className="count">· 3 commits</span>
              <p>HESA data loaded. 28,753 courses from 315 providers.</p>
            </div>
            <div className="timeline-item">
              <b>Fri 30 Oct</b> <span className="count">· 8 commits</span>
              <p>Subject cards for 163 subjects. First live room loop — minutes per room.</p>
            </div>
            <div className="timeline-item">
              <b>Sat 31 Oct</b> <span className="count">· 11 commits</span>
              <p>Paper-diorama rebuild. Swipes and reveal. Pre-rendered stickers so the room is instant and free per player.</p>
            </div>
            <div className="timeline-item">
              <b>Sun 1 Nov</b> <span className="count">· 70 commits</span>
              <p>Mobile polish, share video with sound, apprenticeships, campus settings, simulation of 200 students, sink-corrected scoring.</p>
            </div>
            <div className="timeline-item">
              <b>Mon 2 Nov</b> <span className="count">· live</span>
              <p>Live at <a href="https://www.findyourinkling.com">www.findyourinkling.com</a> as a static Cloudflare Pages site. Zero AI calls while playing. Fixes from phone testing.</p>
            </div>
          </div>
          <div className="pivot">Honest pivot: live generation took minutes per room → pre-render everything once. The room went from slow to instant.</div>
        </section>

        {/* Testing it properly */}
        <section className="simcard">
          <div className="model-head">
            <span className="model-icon"><FlaskConical {...ICON} aria-hidden="true" /></span>
            <h2 style={{margin:0}}>Testing it properly</h2>
          </div>
          <p>200 simulated students play Inkling. Each has a ground truth — subjects they&apos;d genuinely suit — written before they play.</p>
          <p>Problem found: &ldquo;sink&rdquo; subjects. Zoology was in 45 students&apos; top 3 but suited 1. Biology 41 vs 2, Ecology 41 vs 2, Engineering 31 vs 4, Linguistics 29 vs 2.</p>
          <p>Fix: calibrated = (raw − subject mean) / (subject sd + 0.25 × average sd), learned from the simulated students.</p>
          <div className="calibration">
            <div className="kpi">
              <b>{heldBefore ? Math.round(heldBefore.hit3*100)+"%" : "38%"} → {heldAfter ? Math.round(heldAfter.hit3*100)+"%" : "54%"}</b>
              <span>top-3 hit (held-out: tuned on 100, tested on other 100)</span>
            </div>
            <div className="kpi">
              <b>{heldBefore ? Math.round(heldBefore.hit5*100)+"%" : "56%"} → {heldAfter ? Math.round(heldAfter.hit5*100)+"%" : "67%"}</b>
              <span>top-5 hit</span>
            </div>
            <div className="kpi">
              <b>{heldBefore ? Math.round(heldBefore.family3*100)+"%" : "49%"} → {heldAfter ? Math.round(heldAfter.family3*100)+"%" : "67%"}</b>
              <span>right subject family in top 3</span>
            </div>
            <div className="kpi">
              <b>{heldBefore ? heldBefore.subjects_reached : 53} → {heldAfter ? heldAfter.subjects_reached : 99}</b>
              <span>subjects that ever reach a top 3</span>
            </div>
          </div>
          <p>All 200 students with the fix: top-3 hit 51%, top-5 63.5%, 121 of 163 subjects appear in someone&apos;s top 3. A typical game is 42 answers. The result settles after about 30.</p>
          <p>Reachability check: all 163 subjects can reach a top 3.</p>
          <p><a href="/simulation">See the simulation <ArrowRight size={14} style={{display:"inline",verticalAlign:"middle"}} aria-hidden="true" /></a> for the full replay and example students.</p>
          <p className="note">These are simulated students, so this measures whether Inkling&apos;s questions and scoring are consistent with stated interests — not a study of real students.</p>
        </section>

        {/* What's next */}
        <section className="simcard">
          <h2>What&apos;s next</h2>
          <p>Data refresh: weekly apprenticeships, monthly courses via a scheduled job.</p>
          <p>More countries with country-specific data packs:</p>
          <table className="country-table">
            <thead>
              <tr><th>Pack</th><th>What it includes</th></tr>
            </thead>
            <tbody>
              <tr><td>Courses and outcomes</td><td>local course lists and graduate outcomes</td></tr>
              <tr><td>Entry and cost</td><td>entry requirements and cost info</td></tr>
              <tr><td>Earn while you learn</td><td>apprenticeship or equivalent routes</td></tr>
              <tr><td>Jobs data</td><td>local jobs and skills data</td></tr>
              <tr><td>Local cards and wording</td><td>subject cards written for that country</td></tr>
              <tr><td>Local room</td><td>a local room and window views drawn by Muse Image</td></tr>
            </tbody>
          </table>
          <p>Adaptive questions from a larger card pool, so the game asks what matters most for you.</p>
        </section>

        {/* Footer */}
        <section className="simcard built-footer">
          <p><b>Play it at <a href="/">www.findyourinkling.com</a></b></p>
          <p>Built for the Meta Global AI Developer Hackathon 2026 (indie track).</p>
          <p><a href="https://github.com/MartinSWDev/inkling" target="_blank" rel="noreferrer">GitHub repo <ExternalLink size={14} style={{display:"inline",verticalAlign:"middle"}} aria-hidden="true" /></a></p>
          <span className="built-tag">Built with Meta Muse</span>
        </section>

      </main>
    </div>
  );
}
