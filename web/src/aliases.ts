/** Typed-subject alias lookup (Spark Open batch index + hand extras, served
 * in /api/content). Normalise, exact match, then fuzzy edit distance <= 2.
 */
export type AliasIndex = Record<string, Record<string, number>>;

export function normalise(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (Math.abs(m - n) > 2) return 99;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 1; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++)
    dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[m][n];
}

/** Exact match first; fuzzy only for words over 5 letters. Returns the {code: weight} map. */
export function lookupAlias(index: AliasIndex, typed: string): Record<string, number> | null {
  const q = normalise(typed);
  if (!q) return null;
  if (index[q]) return index[q];
  if (q.length <= 5) return null;
  let best: string | null = null, bestD = 3;
  for (const key of Object.keys(index)) {
    if (key.length <= 5 || Math.abs(key.length - q.length) > 2) continue;
    const d = levenshtein(q, key);
    if (d < bestD) { bestD = d; best = key; }
  }
  return best ? index[best] : null;
}

/** Up to 5 subject display names suggested by alias keys matching what's typed. */
export function suggestAliases(index: AliasIndex, typed: string, nameOf: (code: string) => string | undefined, max = 5): string[] {
  const q = normalise(typed);
  if (q.length < 2) return [];
  const out: string[] = [];
  for (const [key, map] of Object.entries(index)) {
    if (!key.startsWith(q) && !key.includes(" " + q)) continue;
    for (const code of Object.keys(map)) {
      const name = nameOf(code);
      if (name && !out.includes(name)) out.push(name);
      if (out.length >= max) return out;
    }
  }
  return out;
}
