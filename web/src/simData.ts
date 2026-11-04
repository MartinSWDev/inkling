/** Simulation data (prompts/14 B): real snapshot if present, else a clearly
 *  labelled dev placeholder (30 fake students generated here). Never ship the
 *  placeholder as data — it only exists so the page builds before data/sim. */

export type Paper = "lined" | "graph" | "manuscript" | "blueprint" | "parchment" | "map"
  | "watercolour" | "lab" | "legal" | "printout" | "kraft";
export const PAPERS: Paper[] = ["lined", "graph", "manuscript", "blueprint", "parchment", "map",
  "watercolour", "lab", "legal", "printout", "kraft"];
export const BUILDINGS: Record<Paper, string> = {
  lined: "Library", graph: "Maths & engineering", manuscript: "Concert hall",
  blueprint: "Architect's studio", parchment: "Museum", map: "Field station",
  watercolour: "Art studio", lab: "Science & health lab", legal: "Courthouse & offices",
  printout: "Computer lab", kraft: "Farm",
};
export const PAPER_COLOURS: Record<Paper, string> = {
  lined: "#fdfbf5", graph: "#dcead2", manuscript: "#f6ecd2", blueprint: "#7ea6cf",
  parchment: "#e8d3a2", map: "#cfe0c3", watercolour: "#f3d9e2", lab: "#eef0da",
  legal: "#f6e27a", printout: "#cfe6cf", kraft: "#c9a876",
};

export interface SimAnswers {
  chips: { name: string; love: boolean }[];
  hearts: string[];
  typed: string[];
  yes: { things: number; things_total: number; questions: number; questions_up: number; questions_total: number };
  pairs: { pair: string; chose: string | null }[];
  pairs_decided: number;
}
export interface SimStudent {
  id: string; first_name: string; age: number; where: string; enjoys: string;
  certainty: string; paper: Paper; dest_paper: Paper;
  suits: string[]; top3: string[]; wildcard: string | null;
  hit3: boolean; hit5: boolean; family3: boolean; settled_after: number | null;
  answers: SimAnswers;
}
export interface SimSummary {
  students: number; hit3: number; hit5: number; family3: number;
  hit3_excluding_no_idea?: number; median_answers_to_settle: number | null;
  answers_per_game?: number | null; subjects_ever_in_top3: number; total_subjects: number;
  hit3_no_idea: number | null; hit3_knows: number | null;
  no_idea_count: number; knows_count: number; arrivals_by_paper: Record<string, number>;
}
export interface SimSnapshot {
  about: string; summary: SimSummary; subjects: Record<string, string>;
  buildings: Record<Paper, string>; students: SimStudent[]; placeholder?: boolean;
}

function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FAKE_SUBJECTS = [
  "Biology", "Computer Science", "History", "Psychology", "Geography", "Music",
  "Architecture", "Law", "Medicine", "Art & Design", "Economics", "Physics",
  "English Literature", "Engineering", "Sociology", "Chemistry", "Film Studies",
  "Mathematics", "Nursing", "Veterinary Science", "Politics", "Philosophy",
  "Marine Biology", "Journalism",
];
const NAMES = ["Amara", "Ben", "Cerys", "Dev", "Ellie", "Finlay", "Grace", "Harry", "Isla", "Jay",
  "Kira", "Liam", "Maya", "Noah", "Orla", "Priya", "Quinn", "Rosa", "Sam", "Tara",
  "Umar", "Violet", "Will", "Xanthe", "Yusuf", "Zara", "Alfie", "Beth", "Callum", "Daisy"];
const PLACES = ["Leeds", "Cardiff", "rural Norfolk", "Glasgow", "Bristol", "Belfast", "Cornwall",
  "Newcastle", "a village in Shropshire", "Manchester", "Brighton", "Inverness"];
const ENJOYS = [
  "Spends weekends fixing up an old bike and helping at a Saturday coding club.",
  "Plays in a youth orchestra and writes short stories nobody is allowed to read yet.",
  "Works Saturdays in a café and is always sketching the customers on napkins.",
  "Keeps bees with their grandad and films time-lapses of the garden changing.",
  "Coaches an under-11s football team and loves a spreadsheet more than is normal.",
  "Volunteers at the local museum and can talk about Romans for a very long time.",
];

export function placeholderSnapshot(): SimSnapshot {
  const rnd = mulberry32(14);
  const subjects: Record<string, string> = {};
  FAKE_SUBJECTS.forEach((n, i) => { subjects["F" + String(i + 1).padStart(2, "0")] = n; });
  const codes = Object.keys(subjects);
  const pick = <T,>(arr: T[]) => arr[Math.floor(rnd() * arr.length)];
  const sample = (n: number) => [...codes].sort(() => rnd() - 0.5).slice(0, n);
  const students: SimStudent[] = NAMES.map((first_name, i) => {
    const suits = sample(1 + Math.floor(rnd() * 2));
    const hit = rnd() < 0.62;
    const top3 = hit ? [...suits.slice(0, 1), ...sample(2)] : sample(3);
    const paper = pick(PAPERS);
    const chipPool = ["Maths", "English", "Biology", "Chemistry", "Physics", "Computing",
      "Art & Design", "History", "Geography", "Languages"];
    const chips = [...chipPool].sort(() => rnd() - 0.5).slice(0, 3 + Math.floor(rnd() * 2))
      .map((name) => ({ name, love: rnd() < 0.35 }));
    return {
      id: "p" + String(i + 1).padStart(2, "0"), first_name, age: 16 + Math.floor(rnd() * 3),
      where: pick(PLACES), enjoys: pick(ENJOYS),
      certainty: rnd() < 0.2 ? "no idea" : rnd() < 0.5 ? "torn" : "knows",
      paper, dest_paper: pick(PAPERS), suits, top3: [...new Set(top3)].slice(0, 3),
      wildcard: pick(codes), hit3: hit, hit5: hit || rnd() < 0.5,
      family3: hit || rnd() < 0.4, settled_after: 8 + Math.floor(rnd() * 30),
      answers: {
        chips, hearts: chips.filter((c) => c.love).map((c) => c.name), typed: [],
        yes: { things: Math.floor(rnd() * 14), things_total: 18, questions: Math.floor(rnd() * 13),
          questions_up: Math.floor(rnd() * 5), questions_total: 16 },
        pairs: [0, 1, 2, 3, 4].map((n) => ({ pair: "pair" + n, chose: rnd() < 0.8 ? pick(["Indoors", "Outdoors"]) : null })),
        pairs_decided: 4,
      },
    };
  });
  // Destination follows the top-1 subject's paper in the real data; fake it the same way.
  for (const s of students) s.dest_paper = s.paper;
  const n = students.length || 1;
  const arrivals: Record<string, number> = {};
  for (const s of students) arrivals[s.dest_paper] = (arrivals[s.dest_paper] || 0) + 1;
  const noIdea = students.filter((s) => s.certainty === "no idea");
  const knows = students.filter((s) => s.certainty !== "no idea");
  const settled = students.map((s) => s.settled_after).filter((x): x is number => x != null).sort((a, b) => a - b);
  return {
    about: "Preview data: 30 fake students generated in code until data/sim exists.",
    placeholder: true, subjects, buildings: BUILDINGS, students,
    summary: {
      students: n, hit3: students.filter((s) => s.hit3).length / n,
      hit5: students.filter((s) => s.hit5).length / n, family3: students.filter((s) => s.family3).length / n,
      median_answers_to_settle: settled[Math.floor(settled.length / 2)] ?? null,
      subjects_ever_in_top3: new Set(students.flatMap((s) => s.top3)).size, total_subjects: 163,
      hit3_no_idea: noIdea.length ? noIdea.filter((s) => s.hit3).length / noIdea.length : null,
      hit3_knows: knows.length ? knows.filter((s) => s.hit3).length / knows.length : null,
      no_idea_count: noIdea.length, knows_count: knows.length, arrivals_by_paper: arrivals,
    },
  };
}

function parseJsonBlock(text: string): Record<string, unknown> | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const v: unknown = JSON.parse(text.slice(start, end + 1));
    return typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** One brand-new student, written and played live by Muse Spark Open via
 * /api/student (prompts/21 E). Everything the model writes is passed to
 * onLog exactly as it streams in; the two JSON blocks are then scored here,
 * in the browser, by the same scoring code as the batch snapshot. Returns
 * null (after logging why) on any failure. */
export async function runLiveStudent(
  onLog: (line: string) => void,
  onHeaders?: (provider: "baseten" | "meta" | null, model: string | null) => void,
): Promise<SimStudent | null> {
  const { scoreAnswers } = await import("./scoring");
  const { paperFor } = await import("./live");
  const { fetchContent, fetchSubjects } = await import("./api");
  try {
    const res = await fetch("/api/student", { method: "POST" });
    const providerHeader = res.headers.get("x-provider");
    onHeaders?.(providerHeader === "baseten" || providerHeader === "meta" ? providerHeader : null, res.headers.get("x-model"));
    if (!res.ok || !res.body) { onLog(`\nThe live student could not start (HTTP ${res.status}).`); return null; }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let full = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      full += chunk;
      onLog(chunk);
    }
    if (full.includes("@@error")) return null; // the message is already in the log

    const personaPart = full.split("@@persona")[1]?.split("@@play")[0] ?? "";
    const playPart = full.split("@@play")[1]?.split("@@done")[0] ?? "";
    const persona = parseJsonBlock(personaPart);
    const play = parseJsonBlock(playPart);
    if (!persona || !play) { onLog("\nThe model did not return the student as JSON, so no one was added."); return null; }

    const [content, subjectsData] = await Promise.all([fetchContent(), fetchSubjects()]);
    const subjects = subjectsData.subjects;
    const codes = new Set(subjects.map((s) => s.code));
    const suits = (Array.isArray(persona.suits) ? persona.suits : [])
      .filter((c): c is string => typeof c === "string" && codes.has(c)).slice(0, 3);
    if (!suits.length) { onLog("\nThe student's suited subjects were not in the list, so no one was added."); return null; }

    const rec = (v: unknown): Record<string, unknown> =>
      typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
    const things = rec(play.things);
    const questions = rec(play.questions);
    const pairsPlayed = rec(play.pairs);
    const answers = {
      chips: (Array.isArray(play.chips) ? play.chips : [])
        .map((c) => rec(c))
        .filter((c) => typeof c.id === "string" && content.chips.some((x) => x.id === c.id))
        .map((c) => ({ id: c.id as string, state: c.state === "love" ? "love" : "take" })),
      typed: (Array.isArray(play.typed) ? play.typed : []).filter((t): t is string => typeof t === "string"),
      swipes: [
        ...Object.entries(things).filter(([, a]) => a === "yes" || a === "no")
          .map(([card_id, answer]) => ({ card_id, answer: answer as "yes" | "no" })),
        ...Object.entries(questions).filter(([, a]) => a === "yes" || a === "no" || a === "up")
          .map(([card_id, answer]) => ({ card_id, answer: answer as "yes" | "no" | "up" })),
      ],
      subject_swipes: [],
      pairs: Object.entries(pairsPlayed)
        .filter(([, side]) => side === "a" || side === "b" || side === null)
        .map(([pair_id, side]) => ({ pair_id, side: side as "a" | "b" | null })),
      shown: [],
    };
    const profiles = Object.fromEntries(subjects.map((s) => [s.code, s.profile ?? {}]));
    const result = scoreAnswers(answers, subjects, profiles, content.pairs,
      { chips: content.chips, things: content.things, questions: content.questions },
      content.aliases || {});
    const topCodes = result.ranked.map((r) => r.code);
    const top3 = topCodes.slice(0, 3);
    const truth = new Set(suits);
    const chipName = new Map(content.chips.map((c) => [c.id, c.name]));
    const pairLabel = new Map(content.pairs.map((p) => [p.id, p]));
    const str = (v: unknown, fallback: string) => (typeof v === "string" && v ? v : fallback);
    return {
      id: "live-" + Date.now(),
      first_name: str(persona.first_name, "Sam"),
      age: typeof persona.age === "number" ? persona.age : 17,
      where: str(persona.where, "somewhere in the UK"),
      enjoys: str(persona.enjoys, ""),
      certainty: str(persona.certainty, "torn"),
      paper: paperFor(suits[0]),
      dest_paper: paperFor(top3[0]),
      suits,
      top3,
      wildcard: result.surprise,
      hit3: top3.some((c) => truth.has(c)),
      hit5: topCodes.slice(0, 5).some((c) => truth.has(c)),
      family3: top3.some((c) => suits.some((s) => s.slice(0, 8) === c.slice(0, 8))),
      settled_after: null,
      answers: {
        chips: answers.chips.map((c) => ({ name: chipName.get(c.id) || c.id, love: c.state === "love" })),
        hearts: answers.chips.filter((c) => c.state === "love").map((c) => chipName.get(c.id) || c.id),
        typed: answers.typed,
        yes: {
          things: Object.values(things).filter((a) => a === "yes").length,
          things_total: Object.keys(things).length,
          questions: Object.values(questions).filter((a) => a === "yes" || a === "up").length,
          questions_up: Object.values(questions).filter((a) => a === "up").length,
          questions_total: Object.keys(questions).length,
        },
        pairs: Object.entries(pairsPlayed).map(([pid, side]) => {
          const p = pairLabel.get(pid);
          return { pair: pid, chose: p && (side === "a" || side === "b") ? p[side].label : null };
        }),
        pairs_decided: Object.values(pairsPlayed).filter((s) => s === "a" || s === "b").length,
      },
    };
  } catch (e) {
    onLog(`\nThe live student failed (${e instanceof Error ? e.message : "network error"}).`);
    return null;
  }
}

export async function loadSnapshot(): Promise<SimSnapshot> {
  try {
    const r = await fetch("/sim/snapshot.json");
    if (!r.ok) throw new Error("no snapshot");
    const d = (await r.json()) as SimSnapshot;
    if (!d.students?.length || !d.summary) throw new Error("bad snapshot");
    return d;
  } catch {
    return placeholderSnapshot();
  }
}
