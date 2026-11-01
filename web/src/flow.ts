/** One scene state machine for the whole experience. The room never remounts;
 * scenes move around it. Round count/copy live here so they cannot drift.
 */
import { ROUND_ACCENTS } from "./design/tokens";

export const ROUNDS = [
  { n: 1, title: "Your subjects", how: "Tap the ones you take. Heart your favourites.", min: 3 },
  { n: 2, title: "Things you'd get stuck into", how: "Swipe right for yes, left for not for me.", min: 5 },
  { n: 3, title: "This or that", how: "Tap the one that's more you.", min: 5 },
  { n: 4, title: "Big questions", how: "Swipe right to explore, up if you need to know.", min: 5 },
] as const;
export const ROUND_COUNT = ROUNDS.length;
export const roundAccent = (round: number) => ROUND_ACCENTS[Math.min(round - 1, ROUND_ACCENTS.length - 1)];

export type Scene =
  | { kind: "landing" }
  | { kind: "unfold" }
  | { kind: "intro" }
  | { kind: "roundTitle"; round: number }
  | { kind: "round"; round: number }
  | { kind: "roundOutro"; round: number }
  | { kind: "finale" }
  | { kind: "reveal"; page: number }
  | { kind: "share" };

export type FlowEvent =
  | { type: "START" } | { type: "UNFOLDED" } | { type: "GO" }
  | { type: "TITLE_DONE" } | { type: "CONTINUE" } | { type: "OUTRO_DONE" }
  | { type: "FINALE_TAP" } | { type: "REVEAL_NEXT" } | { type: "REVEAL_PREV" }
  | { type: "TO_SHARE" } | { type: "RESTART" };

export const initialScene: Scene = { kind: "landing" };

export function flowReducer(scene: Scene, ev: FlowEvent): Scene {
  switch (scene.kind) {
    case "landing": return ev.type === "START" ? { kind: "unfold" } : scene;
    case "unfold": return ev.type === "UNFOLDED" ? { kind: "intro" } : scene;
    case "intro": return ev.type === "GO" ? { kind: "roundTitle", round: 1 } : scene;
    case "roundTitle": return ev.type === "TITLE_DONE" ? { kind: "round", round: scene.round } : scene;
    case "round": return ev.type === "CONTINUE"
      ? (scene.round >= ROUND_COUNT ? { kind: "finale" } : { kind: "roundOutro", round: scene.round }) : scene;
    case "roundOutro": return ev.type === "OUTRO_DONE" ? { kind: "roundTitle", round: scene.round + 1 } : scene;
    case "finale": return ev.type === "FINALE_TAP" ? { kind: "reveal", page: 0 } : scene;
    case "reveal":
      if (ev.type === "REVEAL_NEXT") return scene.page >= 3 ? { kind: "share" } : { kind: "reveal", page: scene.page + 1 };
      if (ev.type === "REVEAL_PREV") return { kind: "reveal", page: Math.max(0, scene.page - 1) };
      if (ev.type === "TO_SHARE") return { kind: "share" };
      return scene;
    case "share":
      if (ev.type === "RESTART") return { kind: "landing" };
      if (ev.type === "REVEAL_PREV") return { kind: "reveal", page: 3 };
      return scene;
    default: return scene;
  }
}
