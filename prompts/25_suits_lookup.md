# 25 · Tolerant "suits" lookup for live students

A live student (Hannah, Skipton) was not added because the model returned `suits` as `["CAH06-01-03 Agriculture", "CAH03-02-01 Sport and exercise sciences", ...]` (code + name in one string) and the lookup wanted bare codes. Fix in `web/src/simData.ts` (`runLiveStudent`, where `suits` is resolved) and the server prompt.

1. Add `normaliseSuits(raw: unknown, subjects: {code: string; display_name: string}[]): string[]`:
   - accept a string or an array; for each entry, first look for a code with `/CAH\d{2}-\d{2}-\d{2}/i` and use it (upper-cased) if that code exists in `subjects`;
   - otherwise try a case-insensitive exact match on `display_name`, then a match where the entry contains the display name or vice versa;
   - drop anything unresolved; de-duplicate; keep at most 4.
   Use it for the live student's `suits`, and also when rendering the persona card's "Would suit:" line so it always shows names.
2. Only emit "the student's suited subjects were not in the list, so no one was added." when the normalised list is empty. If some resolved and some didn't, add them and note `(1 suited subject was not recognised)` in the scored row.
3. In `functions/api/student.ts` persona prompt, state: `"suits": an array of 2 to 4 subject codes exactly as given in the list, codes only, no names`.
4. Unit test in `simData.test.ts`: `normaliseSuits(["CAH06-01-03 Agriculture", "sport and exercise sciences", "nonsense"], subjects)` → `["CAH06-01-03","CAH03-02-01"]`.
5. `npm --prefix web run build` and `npm --prefix web test` pass. Report the files changed.
