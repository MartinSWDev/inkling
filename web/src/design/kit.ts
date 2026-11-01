/** Shared sound kit (prompts/11 G): one WebAudio voice set used by the live
 * game (design/sound.ts) and baked into the share video (share.ts renders it
 * with an OfflineAudioContext). No audio files.
 * Master chain: voices -> master gain -> limiter -> destination, with a
 * light generated-noise convolution reverb as a send.
 */

export type Kit = {
  pop: (t: number, step: number) => void;
  whoosh: (t: number) => void;
  yes: (t: number) => void;
  no: (t: number) => void;
  marimba: (t: number, i: number) => void;
  wildcard: (t: number) => void;
  endChord: (t: number) => void;
};

const PENTA = [523.25, 587.33, 659.25, 783.99, 880.0]; // C D E G A

function noiseBuffer(ctx: BaseAudioContext, seconds: number): AudioBuffer {
  const len = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  return buf;
}

export function createKit(ctx: BaseAudioContext, destination: AudioNode): Kit {
  const master = ctx.createGain(); master.gain.value = 0.9;
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -12; limiter.knee.value = 18; limiter.ratio.value = 8;
  master.connect(limiter); limiter.connect(destination);
  // Light shared reverb: 0.4s generated-noise impulse, low send.
  const verb = ctx.createConvolver(); verb.buffer = noiseBuffer(ctx, 0.4);
  const verbGain = ctx.createGain(); verbGain.gain.value = 0.18;
  master.connect(verbGain); verbGain.connect(verb); verb.connect(limiter);

  function tone(t: number, f0: number, f1: number, dur: number, peak: number, type: OscillatorType, when = 0) {
    const o = ctx.createOscillator(); o.type = type;
    const start = t + when;
    o.frequency.setValueAtTime(f0, start);
    o.frequency.exponentialRampToValueAtTime(Math.max(30, f1), start + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, start);
    g.gain.linearRampToValueAtTime(peak, start + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    o.connect(g); g.connect(master);
    o.start(start); o.stop(start + dur + 0.05);
  }
  function noise(t: number, fFrom: number, fTo: number, dur: number, peak: number, type: BiquadFilterType = "bandpass") {
    const src = ctx.createBufferSource(); src.buffer = noiseBuffer(ctx, dur);
    const flt = ctx.createBiquadFilter(); flt.type = type; flt.Q.value = 0.9;
    flt.frequency.setValueAtTime(fFrom, t);
    flt.frequency.exponentialRampToValueAtTime(Math.max(40, fTo), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(flt); flt.connect(g); g.connect(master);
    src.start(t); src.stop(t + dur + 0.05);
  }

  return {
    /** Sticker land: bright pop with pitch drop + wooden tick, climbing a
     * major pentatonic ladder with each successive sticker. */
    pop(t, step) {
      const f = PENTA[step % 5] * Math.pow(2, Math.floor(step / 5) % 2);
      tone(t, f * 1.35, f, 0.12, 0.16, "sine");
      tone(t, f * 1.35, f, 0.1, 0.08, "triangle");
      noise(t + 0.085, 2400, 1800, 0.03, 0.05); // wooden tick
    },
    whoosh(t) { noise(t, 1200, 3000, 0.15, 0.1); },
    yes(t) { tone(t, 659.25, 659.25, 0.09, 0.1, "sine"); tone(t, 783.99, 783.99, 0.14, 0.1, "sine", 0.07); },
    no(t) { tone(t, 233, 185, 0.16, 0.08, "sine"); },
    /** Top-3 arrival: warm marimba, ascending across the three cards. */
    marimba(t, i) {
      const f = [523.25, 659.25, 783.99][Math.min(2, Math.max(0, i))];
      tone(t, f, f, 0.5, 0.14, "sine");
      tone(t, f * 2, f * 2, 0.22, 0.035, "sine");
    },
    /** Wildcard flip: paper flick + sparkle pings + soft major chord. */
    wildcard(t) {
      noise(t, 3000, 5200, 0.09, 0.09, "highpass");
      [1567, 2093, 2637].forEach((f, i) => tone(t + 0.05 + i * 0.06, f * (1 + (Math.random() - 0.5) * 0.01), f, 0.3, 0.06, "sine"));
      [523.25, 659.25, 783.99].forEach((f) => tone(t + 0.08, f, f, 0.7, 0.05, "sine"));
    },
    /** End card: gentle resolving C major chord. */
    endChord(t) {
      [261.63, 329.63, 392.0, 523.25].forEach((f, i) => tone(t + i * 0.03, f, f, 1.3, 0.07, "sine"));
    },
  };
}
