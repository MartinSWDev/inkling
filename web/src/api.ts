export type Chip = { id: string; name: string };
export type DeckCard = { id: string; title: string; scene: string; fact?: string };
export type PairSide = { label: string; caption: string };
export type Pair = { id: string; a: PairSide; b: PairSide };
export type Ranked = { code: string; display_name: string; score: number; uncertainty: number; direct: number; reasons: string[] };
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
export const fetchPairs = () => getJson<{ pairs: Pair[] }>("/api/pairs");
export const postScore = (answers: Answers) =>
  fetch("/api/score", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(answers) })
    .then((r) => { if (!r.ok) throw new Error("score " + r.status); return r.json() as Promise<{ ranked: Ranked[]; surprise: string | null; room: string[] }>; });
{}
