/** Simulation data (prompts/14 B): real snapshot if present, else a clearly
 *  labelled dev placeholder (30 fake students generated here). Never ship the
 *  placeholder as data — it only exists so the page builds before data/sim. */

export type Paper = "lined" | "graph" | "manuscript" | "blueprint" | "parchment" | "map"
  | "watercolour" | "lab" | "legal" | "printout" | "kraft";
export const PAPERS: Paper[] = ["lined", "graph", "manuscript", "blueprint", "parchment", "map",
  "watercolour", "lab", "legal", "printout", "kraft"];
export const BUILDINGS: Record<Paper, string> = {
  lined: "Library", graph: "Maths & engineering tower", manuscript: "Concert hall",
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
