/**
 * The four directions the room can be watched from, one clockwise quarter turn
 * apart.
 *
 * Every drawing has a single facing, so a view that would show the room from
 * its blind side is drawn as its horizontal mirror — two turns meet at the
 * back, where the mirror cancels out, and a full cycle lands back on the
 * front. The scene mirrors the whole world container on the odd turns, so the
 * layout flips along with the art. Real facings per view replace this stopgap
 * later.
 */
import type { QuarterTurns } from "./types";

export type ViewState = {
  /** Quarter turns clockwise from the front. Always 0-3. */
  turns: QuarterTurns;
  /** True when the art must be drawn mirrored for this view. */
  mirrored: boolean;
};

function normalize(turns: number): QuarterTurns {
  return (((turns % 4) + 4) % 4) as QuarterTurns;
}

export function viewState(turns: number): ViewState {
  const quarter = normalize(turns);
  return { turns: quarter, mirrored: quarter % 2 === 1 };
}

/** One quarter turn clockwise: front -> right -> back -> left. */
export function rotatedClockwise(turns: number): QuarterTurns {
  return normalize(turns + 1);
}
