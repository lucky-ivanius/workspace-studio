export const TILE_WIDTH = 128;
export const TILE_HEIGHT = 64;

export const ROOM_COLS = 10;
export const ROOM_ROWS = 10;

export const ROOM_WIDTH = (ROOM_COLS + ROOM_ROWS) * (TILE_WIDTH / 2);
export const ROOM_HEIGHT = (ROOM_COLS + ROOM_ROWS) * (TILE_HEIGHT / 2);

export type GridCell = { x: number; y: number };
export type Footprint = { w: number; d: number };
export type ScreenPoint = { x: number; y: number };

export function tileToScreen(x: number, y: number): ScreenPoint {
  return {
    x: (x - y) * (TILE_WIDTH / 2),
    y: (x + y) * (TILE_HEIGHT / 2),
  };
}

export function screenToTile(x: number, y: number): ScreenPoint {
  const halfW = TILE_WIDTH / 2;
  const halfH = TILE_HEIGHT / 2;
  return {
    x: (x / halfW + y / halfH) / 2,
    y: (y / halfH - x / halfW) / 2,
  };
}

export function screenToCell(x: number, y: number): GridCell {
  const tile = screenToTile(x, y);
  return { x: Math.round(tile.x), y: Math.round(tile.y) };
}

export function footprintCenter(
  cell: GridCell,
  footprint: Footprint,
): ScreenPoint {
  return {
    x: cell.x + (footprint.w - 1) / 2,
    y: cell.y + (footprint.d - 1) / 2,
  };
}

/**
 * Screen position of a footprint's base center, lifted by `elevation` px.
 * Sprites are positioned here and offset by their declared anchor.
 */
export function anchorToScreen(
  cell: GridCell,
  footprint: Footprint,
  elevation = 0,
): ScreenPoint {
  const center = footprintCenter(cell, footprint);
  const screen = tileToScreen(center.x, center.y);
  return { x: screen.x, y: screen.y - elevation };
}

export function footprintCells(
  cell: GridCell,
  footprint: Footprint,
): GridCell[] {
  const cells: GridCell[] = [];
  for (let dx = 0; dx < footprint.w; dx++) {
    for (let dy = 0; dy < footprint.d; dy++) {
      cells.push({ x: cell.x + dx, y: cell.y + dy });
    }
  }
  return cells;
}

export function isInsideRoom(cell: GridCell, footprint: Footprint): boolean {
  return (
    cell.x >= 0 &&
    cell.y >= 0 &&
    cell.x + footprint.w <= ROOM_COLS &&
    cell.y + footprint.d <= ROOM_ROWS
  );
}

export function clampToRoom(cell: GridCell, footprint: Footprint): GridCell {
  return {
    x: Math.min(Math.max(cell.x, 0), ROOM_COLS - footprint.w),
    y: Math.min(Math.max(cell.y, 0), ROOM_ROWS - footprint.d),
  };
}

export function cellsOverlap(
  a: GridCell,
  aFootprint: Footprint,
  b: GridCell,
  bFootprint: Footprint,
): boolean {
  return (
    a.x < b.x + bFootprint.w &&
    b.x < a.x + aFootprint.w &&
    a.y < b.y + bFootprint.d &&
    b.y < a.y + aFootprint.d
  );
}

/**
 * Painter's-algorithm depth for the isometric view: the front corner of the
 * footprint. Larger values are nearer the camera.
 */
export function footprintDepth(cell: GridCell, footprint: Footprint): number {
  return cell.x + footprint.w + cell.y + footprint.d;
}

export function tileDiamond(x: number, y: number): number[] {
  const { x: cx, y: cy } = tileToScreen(x, y);
  const halfW = TILE_WIDTH / 2;
  const halfH = TILE_HEIGHT / 2;
  return [cx, cy - halfH, cx + halfW, cy, cx, cy + halfH, cx - halfW, cy];
}

export function roomBounds() {
  const left = tileToScreen(0, ROOM_ROWS - 1).x - TILE_WIDTH / 2;
  const right = tileToScreen(ROOM_COLS - 1, 0).x + TILE_WIDTH / 2;
  const top = tileToScreen(0, 0).y - TILE_HEIGHT / 2;
  const bottom = tileToScreen(ROOM_COLS - 1, ROOM_ROWS - 1).y + TILE_HEIGHT / 2;
  return {
    left,
    right,
    top,
    bottom,
    width: right - left,
    height: bottom - top,
  };
}

/** The floor rhombus, as a flat point list for Graphics.poly. */
export function roomOutline(): number[] {
  const back = tileToScreen(0, 0);
  const right = tileToScreen(ROOM_COLS - 1, 0);
  const front = tileToScreen(ROOM_COLS - 1, ROOM_ROWS - 1);
  const left = tileToScreen(0, ROOM_ROWS - 1);

  return [
    back.x,
    back.y - TILE_HEIGHT / 2,
    right.x + TILE_WIDTH / 2,
    right.y,
    front.x,
    front.y + TILE_HEIGHT / 2,
    left.x - TILE_WIDTH / 2,
    left.y,
  ];
}
