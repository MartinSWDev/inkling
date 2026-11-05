/** Country data packs (UK / USA / Other). The UK pack is the live default and
 * its URLs are byte-identical to the pre-pack app; "other" plays the UK files
 * but hides the UK-only course and apprenticeship pages. */
export type Country = "uk" | "us" | "other";
export const COUNTRIES: readonly Country[] = ["uk", "us", "other"] as const;

export type Pack = {
  label: string;
  flag: string;
  /** Prefix for data URLs; "" keeps the live UK paths exactly. */
  base: string;
  showCourses: boolean;
  regionLabel: string;
  studentNoun: string;
  chipsHint: string;
  /** Label of the first tab on the course sheet. */
  coursesTab: string;
  /** Whether the Apprenticeships tab shows even when a subject has none loaded yet. */
  showApprenticeships: boolean;
};

const UK_CHIPS_HINT = "Tap the ones you take. Heart your favourites.";

export const PACKS: Record<Country, Pack> = {
  uk: { label: "UK", flag: "🇬🇧", base: "", showCourses: true, regionLabel: "Setting", studentNoun: "sixth-former", chipsHint: UK_CHIPS_HINT, coursesTab: "University courses", showApprenticeships: true },
  us: { label: "USA", flag: "🇺🇸", base: "/packs/us", showCourses: true, regionLabel: "Region", studentNoun: "high-schooler",
    chipsHint: "Tap the classes you take. AP, IB or Honors counts as a favourite.", coursesTab: "College programs", showApprenticeships: false },
  other: { label: "Other", flag: "🌍", base: "", showCourses: false, regionLabel: "Setting", studentNoun: "sixth-former", chipsHint: UK_CHIPS_HINT, coursesTab: "University courses", showApprenticeships: true },
};

export type DataFile = "content" | "subjects";

export const isCountry = (v: unknown): v is Country => typeof v === "string" && (COUNTRIES as readonly string[]).includes(v);

/** URL of a pack's data file. For uk/other this is exactly the live path. */
export function urlFor(country: Country, file: DataFile): string {
  return PACKS[country].base + "/data/" + file + ".json";
}
/** URL of a pack's per-subject file. */
export function subjectUrlFor(country: Country, code: string): string {
  return PACKS[country].base + "/subjects/" + code + ".json";
}

const STORAGE_KEY = "inkling.country";
const URL_KEY = "c";

export function getCountry(): Country {
  if (typeof window === "undefined") return "uk";
  try {
    const q = new URLSearchParams(window.location.search).get(URL_KEY);
    if (isCountry(q)) return q;
  } catch { /* no URL access */ }
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    if (isCountry(s)) return s;
  } catch { /* storage optional */ }
  return "uk";
}

export function setCountry(c: Country): void {
  try { localStorage.setItem(STORAGE_KEY, c); } catch { /* storage optional */ }
  if (typeof window === "undefined") return;
  try {
    const u = new URL(window.location.href);
    if (c === "uk") u.searchParams.delete(URL_KEY); else u.searchParams.set(URL_KEY, c);
    window.history.replaceState(window.history.state, "", u.pathname + u.search + u.hash);
  } catch { /* history optional */ }
}

const ASKED_KEY = "inkling.country.asked";
export function countryAsked(): boolean {
  try { return localStorage.getItem(ASKED_KEY) === "1"; } catch { return false; }
}
export function markCountryAsked(): void {
  try { localStorage.setItem(ASKED_KEY, "1"); } catch { /* storage optional */ }
}
