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

/** Fetch a pack's file; if a non-UK pack's file is missing (pack not shipped
 * yet), fall back to the live UK file with a console.warn. For base "" the
 * URL is exactly the live one and no fallback is involved. */
async function getPacked<T>(base: string, path: string): Promise<T> {
  if (!base) return getJson<T>(path);
  try {
    return await getJson<T>(base + path);
  } catch (e) {
    console.warn("pack file missing, using UK data:", base + path, (e as Error).message);
    return getJson<T>(path);
  }
}

export type Content = { chips: Chip[]; extra_names: string[]; things: DeckCard[]; questions: DeckCard[]; pairs: Pair[];
  aliases: Record<string, Record<string, number>> };

export const fetchContent = (base = "") => getPacked<Content>(base, "/data/content.json");
export const fetchSubjects = (base = "") => getPacked<{ count: number; subjects: Subject[] }>(base, "/data/subjects.json");
