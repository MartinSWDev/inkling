/** Live game sound: the shared kit (design/kit.ts) on a live AudioContext.
 * Sound is off until the first tap (browser policy), then on; toggle persists.
 */
import { createKit, type Kit } from "./kit";

let ctx: AudioContext | null = null;
let kit: Kit | null = null;
let enabled = typeof localStorage !== "undefined" && localStorage.getItem("inkling-sound") === "on";
let unlocked = false;

export const soundEnabled = () => enabled;
export function setSoundEnabled(on: boolean) {
  enabled = on;
  try { localStorage.setItem("inkling-sound", on ? "on" : "off"); } catch { /* private mode */ }
  if (on) unlock();
}
export function unlock() {
  unlocked = true;
  // Default ON after the first tap when the user has never chosen.
  try { if (localStorage.getItem("inkling-sound") === null) enabled = true; } catch { enabled = true; }
  if (enabled) ac();
}
function ac(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) { const AC = window.AudioContext || (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext; if (AC) ctx = new AC(); }
  if (ctx?.state === "suspended") void ctx.resume();
  return ctx;
}
function live(): { kit: Kit; t: number } | null {
  const c = ac();
  if (!c || !enabled || !unlocked) return null;
  if (!kit) kit = createKit(c, c.destination);
  return { kit, t: c.currentTime };
}

export const sfx = {
  /** Sticker lands: pentatonic pop, `step` = how many are already placed. */
  land: (step: number) => { const l = live(); if (l) l.kit.pop(l.t, step); },
  whoosh: () => { const l = live(); if (l) l.kit.whoosh(l.t); },
  yes: () => { const l = live(); if (l) l.kit.yes(l.t); },
  no: () => { const l = live(); if (l) l.kit.no(l.t); },
  marimba: (i: number) => { const l = live(); if (l) l.kit.marimba(l.t, i); },
  wildcard: () => { const l = live(); if (l) l.kit.wildcard(l.t); },
  chord: () => { const l = live(); if (l) l.kit.endChord(l.t); },
  // Legacy gentle UI taps.
  pop: () => { const l = live(); if (l) l.kit.yes(l.t); },
  thwip: () => { const l = live(); if (l) l.kit.pop(l.t, 0); },
  flick: () => { const l = live(); if (l) l.kit.whoosh(l.t); },
  fold: () => { const l = live(); if (l) l.kit.whoosh(l.t); },
};

export function buzz(ms = 8) {
  try { navigator.vibrate?.(ms); } catch { /* unsupported */ }
}
