import { useEffect, useRef } from "react";
import { BUILDINGS, PAPERS, PAPER_COLOURS, type Paper, type SimStudent } from "./simData";
import { sfx } from "./design/sound";

/** Canvas replay of 200 students walking a paper town (prompts/14 C).
 *  Positions are a pure function of sim-time, so pause/speed/replay are exact. */

export const WORLD_W = 2400, WORLD_H = 720;
const SPEED = 150; // px per second at 1x
const SIGNS = [
  { label: "Your subjects", x: 500, y: 300 },
  { label: "Things you'd get stuck into", x: 820, y: 400 },
  { label: "This or that", x: 1140, y: 300 },
  { label: "Big questions", x: 1460, y: 400 },
];
const START = { x: 150, y: 360 };
/** Door position for each destination building (grid on the right). */
export function doorFor(paper: Paper) {
  const i = PAPERS.indexOf(paper);
  const col = i % 4, row = Math.floor(i / 4);
  return { x: 1795 + col * 172, y: 150 + row * 215 };
}
export function iconFor(s: SimStudent, round: number): "heart" | "check" | "x" | "star" {
  if (round === 0) return s.answers.hearts.length ? "heart" : "check";
  if (round === 1) return s.answers.yes.things * 2 >= s.answers.yes.things_total ? "check" : "x";
  if (round === 2) return s.answers.pairs_decided >= 3 ? "star" : "check";
  return s.answers.yes.questions_up > 0 ? "star" : s.answers.yes.questions ? "check" : "x";
}

/** Greedy word wrap to a pixel width using the context's current font. */
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const out: string[] = []; let line = "";
  for (const w of text.split(" ")) {
    const t = line ? line + " " + w : w;
    if (line && ctx.measureText(t).width > maxW) { out.push(line); line = w; } else line = t;
  }
  if (line) out.push(line);
  return out;
}

interface Leg { x1: number; y1: number; x2: number; y2: number; t0: number; t1: number; sign: number }
interface Itin { start: number; legs: Leg[]; arrive: number; seed: number }

function itinerary(s: SimStudent, idx: number): Itin {
  const seed = ((idx * 2654435761) % 1000) / 1000;
  const wave = Math.floor(idx / 20);
  let t = wave * 2.6 + seed * 1.2;
  const start = t;
  const legs: Leg[] = [];
  let px = START.x, py = START.y;
  const walk = (x: number, y: number, sign: number) => {
    const d = Math.hypot(x - px, y - py);
    legs.push({ x1: px, y1: py, x2: x, y2: y, t0: t, t1: t + d / SPEED, sign });
    t += d / SPEED; px = x; py = y;
  };
  SIGNS.forEach((sg, i) => { walk(sg.x, sg.y, i); t += 0.7; }); // pause at each signpost
  const door = doorFor(s.dest_paper);
  walk(door.x + (seed - 0.5) * 96, door.y + 14, -1); // stand in front of the door, spread out
  return { start, legs, arrive: t, seed };
}

function posAt(it: Itin, t: number) {
  if (t < it.start) return { x: START.x, y: START.y, state: "wait" as const, sign: -1 };
  for (const leg of it.legs) {
    if (t < leg.t0) return { x: leg.x1, y: leg.y1, state: "pause" as const, sign: leg.sign };
    if (t <= leg.t1) {
      const k = leg.t1 === leg.t0 ? 1 : (t - leg.t0) / (leg.t1 - leg.t0);
      return { x: leg.x1 + (leg.x2 - leg.x1) * k, y: leg.y1 + (leg.y2 - leg.y1) * k, state: "walk" as const, sign: leg.sign };
    }
  }
  const last = it.legs[it.legs.length - 1];
  return { x: last.x2, y: last.y2, state: "done" as const, sign: -1 };
}

export interface SimSceneProps {
  students: SimStudent[];
  playing: boolean;
  speed: number;
  replayKey: number;
  finalState: boolean;
  selectedId: string | null;
  soundOn: boolean;
  onSelect: (s: SimStudent) => void;
  onBuilding?: (paper: Paper, ids: string[]) => void;
  onArrive?: (count: number) => void;
}

export default function SimScene(p: SimSceneProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef({ t: 0, last: 0, arrived: 0, lastPop: 0 });
  const propsRef = useRef(p);
  propsRef.current = p;
  const imagesRef = useRef<Record<string, HTMLImageElement | "bad">>({});

  useEffect(() => { stateRef.current = { t: 0, last: 0, arrived: 0, lastPop: 0 }; }, [p.replayKey]);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const itins = p.students.map((s, i) => itinerary(s, i));
    const total = Math.max(...itins.map((i) => i.arrive), 1);
    const tryImg = (key: string, src: string) => {
      if (imagesRef.current[key]) return imagesRef.current[key];
      const img = new Image();
      img.onload = () => { imagesRef.current[key] = img; };
      img.onerror = () => { imagesRef.current[key] = "bad"; };
      img.src = src;
      imagesRef.current[key] = img;
      return img;
    };
    let raf = 0;
    const drawBuilding = (x: number, y: number, w: number, paper: Paper | "sixthform", label: string, count?: number) => {
      const img = tryImg("b-" + paper, `/sim/buildings/${paper}.webp`);
      let topY = y - 88; // roof top (placeholder height)
      if (img instanceof HTMLImageElement && img.complete && img.naturalWidth) {
        const h = Math.min(w * 1.15, w * img.naturalHeight / img.naturalWidth); const dw = h * img.naturalWidth / img.naturalHeight; // keep the art's own shape
        ctx.drawImage(img, x - dw / 2, y - h, dw, h); topY = y - h;
      } else {
        ctx.save();
        ctx.fillStyle = paper === "sixthform" ? "#e8b4a0" : PAPER_COLOURS[paper as Paper];
        ctx.strokeStyle = "rgba(42,34,56,.45)"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.roundRect(x - w / 2, y - 62, w, 62, 6); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x - w / 2 - 6, y - 62); ctx.lineTo(x, y - 88); ctx.lineTo(x + w / 2 + 6, y - 62); ctx.closePath();
        ctx.fillStyle = "#b08968"; ctx.fill(); ctx.stroke();
        ctx.fillStyle = "rgba(255,255,255,.75)";
        for (let wy = 0; wy < 2; wy++) for (let wx = 0; wx < 3; wx++) ctx.fillRect(x - w / 2 + 10 + wx * (w / 3.4), y - 54 + wy * 24, 14, 16);
        ctx.restore();
      }
      ctx.save();
      ctx.font = "600 21px Figtree, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
      ctx.fillStyle = "#2A2238";
      const lab = wrapText(ctx, label, Math.max(w + 30, 156)).slice(0, 3);
      const lw = Math.max(...lab.map((ln) => ctx.measureText(ln).width)) + 18;
      ctx.fillStyle = "rgba(251,246,238,.92)"; ctx.strokeStyle = "rgba(42,34,56,.18)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.roundRect(x - lw / 2, y + 8, lw, lab.length * 24 + 10, 8); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#2A2238";
      lab.forEach((ln, li) => ctx.fillText(ln, x, y + 28 + li * 24));
      if (count !== undefined) {
        const txt = String(count);
        ctx.font = "900 24px Fraunces, serif";
        const pw = Math.max(40, ctx.measureText(txt).width + 22), py = topY - 14;
        ctx.fillStyle = "#FBF6EE"; ctx.strokeStyle = "rgba(42,34,56,.35)"; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.roundRect(x - pw / 2, py - 24, pw, 32, 16); ctx.fill(); ctx.stroke();
        ctx.fillStyle = "#2A2238"; ctx.fillText(txt, x, py);
      }
      ctx.restore();
    };
    const drawPal = (x: number, y: number, paper: Paper, hop: number, ring: boolean, done: boolean, hit: boolean) => {
      const bob = Math.abs(Math.sin(hop)) * 7;
      const yy = y - bob;
      const img = tryImg("c-" + paper, `/characters/${paper}.webp`);
      ctx.save();
      if (done) ctx.globalAlpha = 0.92;
      if (img instanceof HTMLImageElement && img.complete && img.naturalWidth) {
        const ph = 40, pw = ph * img.naturalWidth / img.naturalHeight; ctx.drawImage(img, x - pw / 2, yy - ph, pw, ph);
      } else {
        ctx.beginPath(); ctx.arc(x, yy - 16, 15, 0, Math.PI * 2);
        ctx.fillStyle = PAPER_COLOURS[paper]; ctx.fill();
        ctx.strokeStyle = "rgba(42,34,56,.5)"; ctx.lineWidth = 1.6; ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x - 9, yy - 22); ctx.lineTo(x - 2, yy - 14); ctx.lineTo(x - 8, yy - 8);
        ctx.moveTo(x + 8, yy - 24); ctx.lineTo(x + 2, yy - 16); ctx.stroke();
        ctx.fillStyle = "#2A2238";
        ctx.beginPath(); ctx.arc(x - 5, yy - 18, 1.8, 0, Math.PI * 2); ctx.arc(x + 5, yy - 18, 1.8, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(x, yy - 13, 4.5, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
      }
      if (ring) { ctx.beginPath(); ctx.arc(x, yy - 16, 23, 0, Math.PI * 2); ctx.strokeStyle = "#e59a2c"; ctx.lineWidth = 3; ctx.stroke(); }
      if (done) {
        if (hit) { // gold star
          ctx.fillStyle = "#e5a91c"; ctx.strokeStyle = "#8a5d00"; ctx.lineWidth = 1;
          ctx.beginPath();
          for (let i = 0; i < 10; i++) { const r = i % 2 ? 4 : 9, a = -Math.PI / 2 + (i * Math.PI) / 5; ctx[i ? "lineTo" : "moveTo"](x + 13 + r * Math.cos(a), yy - 40 + r * Math.sin(a)); }
          ctx.closePath(); ctx.fill(); ctx.stroke();
        } else { ctx.beginPath(); ctx.arc(x + 12, yy - 40, 5, 0, Math.PI * 2); ctx.fillStyle = "#9a93a8"; ctx.fill(); }
      }
      ctx.restore();
    };
    const drawIcon = (x: number, y: number, kind: string) => {
      ctx.save(); ctx.translate(x, y); ctx.lineWidth = 2.4; ctx.strokeStyle = "#2A2238"; ctx.fillStyle = "#fff";
      ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.beginPath();
      if (kind === "check") { ctx.moveTo(-5, 0); ctx.lineTo(-1.5, 4); ctx.lineTo(6, -4.5); ctx.stroke(); }
      else if (kind === "x") { ctx.moveTo(-4.5, -4.5); ctx.lineTo(4.5, 4.5); ctx.moveTo(4.5, -4.5); ctx.lineTo(-4.5, 4.5); ctx.stroke(); }
      else if (kind === "star") { for (let i = 0; i < 10; i++) { const r = i % 2 ? 3 : 7, a = -Math.PI / 2 + (i * Math.PI) / 5; ctx[i ? "lineTo" : "moveTo"](r * Math.cos(a), r * Math.sin(a)); } ctx.closePath(); ctx.fillStyle = "#e5a91c"; ctx.fill(); ctx.stroke(); }
      else { ctx.moveTo(0, 6); ctx.bezierCurveTo(-8, -1, -5, -7, 0, -3.4); ctx.bezierCurveTo(5, -7, 8, -1, 0, 6); ctx.closePath(); ctx.fillStyle = "#d4577a"; ctx.fill(); ctx.stroke(); }
      ctx.restore();
    };
    const frame = (now: number) => {
      const props = propsRef.current;
      const st = stateRef.current;
      const dt = st.last ? Math.min(0.05, (now - st.last) / 1000) : 0;
      st.last = now;
      if (props.playing && !props.finalState) st.t += dt * props.speed;
      const t = props.finalState ? total + 1 : st.t;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const cw = canvas.clientWidth, ch = canvas.clientHeight;
      if (canvas.width !== cw * dpr) { canvas.width = cw * dpr; canvas.height = ch * dpr; }
      ctx.setTransform((cw * dpr) / WORLD_W, 0, 0, (cw * dpr) / WORLD_W, 0, 0);
      // Sky + ground
      ctx.fillStyle = "#fdf6ea"; ctx.fillRect(0, 0, WORLD_W, WORLD_H);
      const ground = tryImg("ground", "/sim/buildings/ground.webp");
      if (ground instanceof HTMLImageElement && ground.complete && ground.naturalWidth) { // cover the whole scene: crop the picture to the scene's aspect (no stretching), then a paper wash
        const sw = ground.naturalWidth, sh = Math.min(ground.naturalHeight, sw * WORLD_H / WORLD_W), sy = (ground.naturalHeight - sh) * 0.6;
        ctx.drawImage(ground, 0, sy, sw, sh, 0, 0, WORLD_W, WORLD_H);
        const wash = ctx.createLinearGradient(0, 0, 0, WORLD_H);
        wash.addColorStop(0, "rgba(253,246,234,.78)"); wash.addColorStop(0.55, "rgba(253,246,234,.62)"); wash.addColorStop(1, "rgba(253,246,234,.5)");
        ctx.fillStyle = wash; ctx.fillRect(0, 0, WORLD_W, WORLD_H); }
      else { ctx.fillStyle = "#dfe8cf"; ctx.fillRect(0, WORLD_H - 260, WORLD_W, 260); ctx.fillStyle = "#e9dfca"; ctx.fillRect(0, WORLD_H - 120, WORLD_W, 120); }
      // Path
      ctx.save(); ctx.strokeStyle = "#efe3cb"; ctx.lineWidth = 30; ctx.lineCap = "round"; ctx.beginPath();
      ctx.moveTo(START.x, START.y);
      for (const s of SIGNS) ctx.lineTo(s.x, s.y);
      ctx.lineTo(1700, 360); ctx.stroke();
      ctx.strokeStyle = "rgba(42,34,56,.18)"; ctx.lineWidth = 2; ctx.setLineDash([10, 12]); ctx.stroke(); ctx.restore();
      // Signposts
      ctx.save(); ctx.textAlign = "center";
      for (const s of SIGNS) {
        ctx.fillStyle = "#8a6844"; ctx.fillRect(s.x - 3, s.y - 46, 6, 48);
        ctx.fillStyle = "#FBF6EE"; ctx.strokeStyle = "rgba(42,34,56,.4)";
        ctx.font = "600 20px Figtree, sans-serif";
        const sl = wrapText(ctx, s.label, 196).slice(0, 2);
        const bh = sl.length > 1 ? 62 : 40;
        ctx.beginPath(); ctx.roundRect(s.x - 110, s.y - 46 - bh, 220, bh, 9); ctx.fill(); ctx.stroke();
        ctx.fillStyle = "#2A2238";
        sl.forEach((ln, li) => ctx.fillText(ln, s.x, s.y - 46 - bh + 27 + li * 23));
      }
      ctx.restore();
      // Buildings + counters
      const counts: Record<string, number> = {};
      const inside: Record<string, string[]> = {};
      itins.forEach((it, i) => { if (t >= it.arrive) { const dp = p.students[i].dest_paper; counts[dp] = (counts[dp] || 0) + 1; (inside[dp] ||= []).push(p.students[i].id); } });
      (canvas as unknown as { _inside: typeof inside })._inside = inside;
      drawBuilding(START.x, START.y + 70, 150, "sixthform", "Sixth form");
      for (const paper of PAPERS) { const d = doorFor(paper); drawBuilding(d.x, d.y + 30, 128, paper, BUILDINGS[paper], counts[paper] || 0); }
      // Students
      let arrived = 0;
      const order = itins.map((it, i) => ({ it, i, pos: posAt(it, t) })).sort((a, b) => a.pos.y - b.pos.y);
      for (const { it, i, pos } of order) {
        const s = p.students[i];
        if (t < it.start) continue;
        const done = pos.state === "done";
        if (done) arrived++;
        drawPal(pos.x, pos.y, s.paper, t * 9 + it.seed * 6, props.selectedId === s.id, done, s.hit3);
        if (pos.state === "pause" && pos.sign >= 0) drawIcon(pos.x, pos.y - 62, iconFor(s, pos.sign));
      }
      if (arrived !== st.arrived) {
        st.arrived = arrived;
        props.onArrive?.(arrived);
        if (props.soundOn && now - st.lastPop > 180) { st.lastPop = now; sfx.land(arrived % 8); }
      }
      (canvas as unknown as { _pos: typeof order })._pos = order;
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.students, p.replayKey]);

  const onClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * WORLD_W;
    const y = ((e.clientY - rect.top) / rect.height) * WORLD_H;
    // Buildings first: tap a building to see everyone who has arrived there
    if (p.onBuilding) {
      for (const paper of PAPERS) {
        const d = doorFor(paper), base = d.y + 30;
        if (x > d.x - 80 && x < d.x + 80 && y > base - 150 && y < base + 80) {
          const inside = (canvas as unknown as { _inside?: Record<string, string[]> })._inside || {};
          p.onBuilding(paper, inside[paper] || []);
          return;
        }
      }
    }
    const order = (canvas as unknown as { _pos?: { i: number; pos: { x: number; y: number } }[] })._pos || [];
    let best: { i: number; d: number } | null = null;
    for (const o of order) { const d = Math.hypot(o.pos.x - x, o.pos.y - 18 - y); if (d < 42 && (!best || d < best.d)) best = { i: o.i, d }; }
    if (best) p.onSelect(p.students[best.i]);
  };

  return <canvas ref={canvasRef} className="simcanvas" onClick={onClick} role="img"
    aria-label="Animation of simulated students walking from sixth form to subject buildings" />;
}
