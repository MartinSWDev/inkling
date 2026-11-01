export type Chip = { id: string; name: string; terms: string[] };
export type DeckCard = { id: string; title: string; scene: string; fact?: string; terms: Record<string, number> };
export type PairSide = { label: string; caption: string; scores: Record<string, number> };
export type Pair = { id: string; a: PairSide; b: PairSide };
export type Ranked = { code: string; display_name: string; score: number; uncertainty: number; direct: number; reasons: string[] };
export type Subject = {
  code: string; display_name: string; name: string; plain?: string; why_line?: string; keywords: string[]; neighbours: string[];
  slot: string; object: string; profile: Record<string, number> | null; course_count: number;
};
export type Answers = {
  chips: { id: string; state: string }[];
  typed: string[];
  swipes: { card_id: string; answer: string }[];
  subject_swipes: { code: string; answer: string }[];
  pairs: { pair_id: string; side: string | null }[];
  shown: string[];
};

export const emptyAnswers = (): Answers => ({ chips: [], typed: [], swipes: [], subject_swipes: [], pairs: [], shown: [] });

async function getJson<T>(url: string): Promise<T> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(url + " " + r.status);
  return r.json() as Promise<T>;
}

export const fetchContent = () =>
  getJson<{ chips: Chip[]; extra_names: string[]; things: DeckCard[]; questions: DeckCard[]; pairs: Pair[] }>("/api/content");
export const fetchSubjects = () => getJson<{ count: number; subjects: Subject[] }>("/api/subjects");
