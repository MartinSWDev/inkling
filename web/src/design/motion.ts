/** Paper motion system (motion / Framer Motion v11+). Transform + opacity only. */
import type { Transition, Variants } from "motion/react";

export const springs = {
  pop: { type: "spring", stiffness: 520, damping: 26, mass: 0.8 },
  settle: { type: "spring", stiffness: 300, damping: 30 },
  fold: { type: "spring", stiffness: 220, damping: 28 },
  flick: { type: "spring", stiffness: 700, damping: 40 },
} satisfies Record<string, Transition>;

export const STAGGER = 0.07;
export const stagger = (i: number) => ({ delay: Math.min(i, 6) * STAGGER });

/** Pop-up book: starts lying flat (rotated -90deg on X from its bottom edge), springs up. */
export const popUp: Variants = {
  hidden: { rotateX: -90, opacity: 0, transformOrigin: "50% 100%" },
  shown: (i: number = 0) => ({
    rotateX: 0, opacity: 1, transformOrigin: "50% 100%",
    transition: { ...springs.pop, delay: Math.min(i, 6) * STAGGER },
  }),
  exit: { rotateX: -90, opacity: 0, transition: { duration: 0.22 } },
};

/** Fold away: the reverse of pop-up, quicker. */
export const foldAway: Variants = {
  hidden: { rotateX: -90, opacity: 0, transformOrigin: "50% 0%" },
  shown: { rotateX: 0, opacity: 1, transition: springs.fold },
  exit: { rotateX: 88, opacity: 0, transition: { duration: 0.22 } },
};

/** Sticker drop into the room. */
export const stickerDrop: Variants = {
  hidden: { scale: 0.6, y: -40, rotate: -6, opacity: 0 },
  shown: {
    scale: [0.6, 1.08, 1], y: [-40, 0, 0], rotate: [-6, 2, 0], opacity: [0, 1, 1],
    transition: { duration: 0.45, times: [0, 0.7, 1], ease: "easeOut" },
  },
};

/** Card flip on the Y axis (wildcard, round titles). */
export const cardFlip: Variants = {
  front: { rotateY: 0, transition: springs.settle },
  back: { rotateY: 180, transition: springs.settle },
};

/** Subtle page turn for reveal scene changes. */
export const pageTurn: Variants = {
  hidden: { rotateY: -8, opacity: 0, transformOrigin: "0% 50%" },
  shown: { rotateY: 0, opacity: 1, transition: { duration: 0.4, ease: "easeOut" } },
  exit: { rotateY: 6, opacity: 0, transition: { duration: 0.25 } },
};

export const fadeSwap: Variants = {
  hidden: { opacity: 0 },
  shown: { opacity: 1, transition: { duration: 0.15 } },
  exit: { opacity: 0, transition: { duration: 0.15 } },
};

export const reducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
