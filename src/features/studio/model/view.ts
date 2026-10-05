/**
 * The four directions the room can be watched from, one quarter turn apart.
 *
 * Every drawing has a single facing, so a view that would show the room from
 * its blind side is drawn as its horizontal mirror — two turns meet at the
 * back, where the mirror cancels out, and a full cycle lands back on the
 * front. The scene mirrors the whole world container on the odd turns, so the
 * layout flips along with the art. Real facings per view replace this stopgap
 * later.
 */
export const VIEW_LABELS = ["Front", "Right", "Back", "Left"] as const;

export type ViewLabel = (typeof VIEW_LABELS)[number];

export type ViewState = {
  /** Quarter turns clockwise from the front. Always 0-3. */
  turns: 0 | 1 | 2 | 3;
  label: ViewLabel;
  /** True when the art must be drawn mirrored for this view. */
  mirrored: boolean;
};

const LABEL_BY_TURNS: Record<ViewState["turns"], ViewLabel> = {
  0: "Front",
  1: "Right",
  2: "Back",
  3: "Left",
};

function normalize(turns: number): ViewState["turns"] {
  return (((turns % 4) + 4) % 4) as ViewState["turns"];
}

export function viewState(turns: number): ViewState {
  const quarter = normalize(turns);
  return {
    turns: quarter,
    label: LABEL_BY_TURNS[quarter],
    mirrored: quarter % 2 === 1,
  };
}

/** One quarter turn anticlockwise: front -> left -> back -> right. */
export function rotatedLeft(turns: number): number {
  return normalize(turns - 1);
}

/** One quarter turn clockwise: front -> right -> back -> left. */
export function rotatedRight(turns: number): number {
  return normalize(turns + 1);
}
