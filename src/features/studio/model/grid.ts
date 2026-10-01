export const TILE_WIDTH = 64;
export const TILE_HEIGHT = 32;

export const ROOM_COLS = 24;
export const ROOM_ROWS = 24;

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

/**
 * Screen position of a tile corner rather than a tile centre: the point where
 * tiles (x-1, y-1) and (x, y) meet. Corner (0, 0) is the room's back tip and
 * (ROOM_COLS, ROOM_ROWS) its front tip.
 */
export function gridCorner(x: number, y: number): ScreenPoint {
  return {
    x: (x - y) * (TILE_WIDTH / 2),
    y: (x + y - 1) * (TILE_HEIGHT / 2),
  };
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
  const left = gridCorner(0, ROOM_ROWS).x;
  const right = gridCorner(ROOM_COLS, 0).x;
  const top = gridCorner(0, 0).y;
  const bottom = gridCorner(ROOM_COLS, ROOM_ROWS).y;
  return {
    left,
    right,
    top,
    bottom,
    width: right - left,
    height: bottom - top,
  };
}

/** Middle of the floor, where the camera rests until the user drags it. */
export function roomCenter(): ScreenPoint {
  const bounds = roomBounds();
  return {
    x: bounds.left + bounds.width / 2,
    y: bounds.top + bounds.height / 2,
  };
}

/** The floor rhombus, as a flat point list for Graphics.poly. */
export function roomOutline(): number[] {
  return [
    gridCorner(0, 0),
    gridCorner(ROOM_COLS, 0),
    gridCorner(ROOM_COLS, ROOM_ROWS),
    gridCorner(0, ROOM_ROWS),
  ].flatMap((point) => [point.x, point.y]);
}

/**
 * Tile boundaries as lines spanning the whole floor. Stroking these is far
 * cheaper than outlining every tile: a 24x24 room is 50 lines, not 576 rhombi.
 */
export function roomGridLines(): Array<[ScreenPoint, ScreenPoint]> {
  const lines: Array<[ScreenPoint, ScreenPoint]> = [];

  for (let x = 0; x <= ROOM_COLS; x++) {
    lines.push([gridCorner(x, 0), gridCorner(x, ROOM_ROWS)]);
  }
  for (let y = 0; y <= ROOM_ROWS; y++) {
    lines.push([gridCorner(0, y), gridCorner(ROOM_COLS, y)]);
  }

  return lines;
}
