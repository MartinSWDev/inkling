/** Tiny WebAudio paper sounds (synthesised, no assets) + haptics.
 * Sound is off until the first tap (browser policy), then on; toggle persists.
 */
let ctx: AudioContext | null = null;
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
  if (enabled) ac();
}
function ac(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) { const AC = window.AudioContext || (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext; if (AC) ctx = new AC(); }
  if (ctx?.state === "suspended") void ctx.resume();
  return ctx;
}
function env(g: GainNode, t: number, peak: number, dur: number) {
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(peak, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
}
function noiseBurst(freq: number, dur: number, peak = 0.12) {
  const c = ac(); if (!c || !enabled || !unlocked) return;
  const t = c.currentTime;
  const len = Math.max(1, Math.floor(c.sampleRate * dur));
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource(); src.buffer = buf;
  const f = c.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = freq; f.Q.value = 0.9;
  const g = c.createGain(); env(g, t, peak, dur);
  src.connect(f).connect(g).connect(c.destination); src.start(t);
}
function tone(freqA: number, freqB: number, dur: number, peak = 0.06, type: OscillatorType = "sine") {
  const c = ac(); if (!c || !enabled || !unlocked) return;
  const t = c.currentTime;
  const o = c.createOscillator(); o.type = type;
  o.frequency.setValueAtTime(freqA, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(30, freqB), t + dur);
  const g = c.createGain(); env(g, t, peak, dur);
  o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur + 0.05);
}

export const sfx = {
  thwip: () => noiseBurst(1800, 0.09, 0.1),
  flick: () => noiseBurst(900, 0.14, 0.08),
  fold: () => noiseBurst(500, 0.18, 0.07),
  pop: () => tone(520, 760, 0.09, 0.05, "triangle"),
  chord: () => { [392, 494, 587].forEach((f, i) => window.setTimeout(() => tone(f, f, 0.5, 0.045, "sine"), i * 70)); },
};

export function buzz(ms = 8) {
  try { navigator.vibrate?.(ms); } catch { /* unsupported */ }
}
