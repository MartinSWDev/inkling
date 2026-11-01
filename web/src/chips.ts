/** Round-1 chip state transitions. The heart only toggles favourite —
 * it never deselects the chip. */
export type ChipState = "take" | "love";

/** Tapping the chip body toggles selection. */
export function toggleChip(cur: ChipState | undefined): ChipState | undefined {
  return cur ? undefined : "take";
}

/** Tapping the heart toggles favourite, selecting the chip if needed. */
export function heartChip(cur: ChipState | undefined): ChipState {
  return cur === "love" ? "take" : "love";
}
