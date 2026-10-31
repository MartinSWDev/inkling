/** Inkling design tokens: a pop-up book made of paper. Colour taken from the room. */
export const COLORS = {
  paper: "#FBF6EE",
  ink: "#2A2238",
  plumBackdrop: "#1E1830",
  lilac: "#C9B8E8",
  peach: "#F6C9A8",
  sage: "#B9CDB0",
  butter: "#F3D98B",
} as const;

/** One accent per round (1..4). */
export const ROUND_ACCENTS = [COLORS.lilac, COLORS.peach, COLORS.sage, COLORS.butter] as const;

/** Type scale in px at 390 wide. */
export const TYPE = { xs: 13, sm: 15, md: 17, lg: 22, xl: 30, xxl: 44, hero: 64 } as const;

export const RADII = { sheet: 20, chip: 14, card: 18, label: 10 } as const;

/** Paper contact shadow: tight 1px layer + wide low-opacity plum layer. No glow. */
export const PAPER_SHADOW = "0 1px 0 rgba(42,34,56,.16), 0 18px 36px rgba(30,24,48,.18)";
export const PAPER_SHADOW_SMALL = "0 1px 0 rgba(42,34,56,.16), 0 8px 18px rgba(30,24,48,.16)";

export const TOUCH_MIN = 48;
