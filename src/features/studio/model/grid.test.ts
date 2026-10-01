import assert from "node:assert/strict";
import { test } from "node:test";
import {
  anchorToScreen,
  cellsOverlap,
  clampToRoom,
  footprintDepth,
  gridCorner,
  isInsideRoom,
  ROOM_COLS,
  ROOM_ROWS,
  roomBounds,
  roomCenter,
  roomGridLines,
  screenToTile,
  tileToScreen,
} from "./grid";

test("the origin tile sits at the world origin", () => {
  assert.deepEqual(tileToScreen(0, 0), { x: 0, y: 0 });
});

test("moving one tile along x goes right and down by half a tile", () => {
  assert.deepEqual(tileToScreen(1, 0), { x: 32, y: 16 });
});

test("moving one tile along y goes left and down by half a tile", () => {
  assert.deepEqual(tileToScreen(0, 1), { x: -32, y: 16 });
});

test("screen coordinates convert back to the tile they came from", () => {
  for (const [x, y] of [
    [0, 0],
    [3, 7],
    [9, 2],
  ]) {
    const screen = tileToScreen(x, y);
    assert.deepEqual(screenToTile(screen.x, screen.y), { x, y });
  }
});

test("a footprint is anchored at the centre of the tiles it covers", () => {
  // An 8x4 desk at the origin centres on tile (3.5, 1.5).
  assert.deepEqual(anchorToScreen({ x: 0, y: 0 }, { w: 8, d: 4 }), {
    x: 64,
    y: 80,
  });
});

test("elevation lifts an anchor straight up", () => {
  const floor = anchorToScreen({ x: 2, y: 2 }, { w: 1, d: 1 }, 0);
  const raised = anchorToScreen({ x: 2, y: 2 }, { w: 1, d: 1 }, 120);
  assert.equal(raised.x, floor.x);
  assert.equal(raised.y, floor.y - 120);
});

test("a footprint fits only while it stays fully inside the room", () => {
  assert.equal(isInsideRoom({ x: 0, y: 0 }, { w: 8, d: 4 }), true);
  assert.equal(
    isInsideRoom({ x: ROOM_COLS - 8, y: ROOM_ROWS - 4 }, { w: 8, d: 4 }),
    true,
  );
  assert.equal(isInsideRoom({ x: ROOM_COLS - 7, y: 0 }, { w: 8, d: 4 }), false);
  assert.equal(isInsideRoom({ x: -1, y: 0 }, { w: 1, d: 1 }), false);
});

test("clamping pulls a footprint back inside the room", () => {
  assert.deepEqual(clampToRoom({ x: 99, y: -5 }, { w: 8, d: 4 }), {
    x: ROOM_COLS - 8,
    y: 0,
  });
});

test("footprints overlap only when their tiles intersect", () => {
  assert.equal(
    cellsOverlap(
      { x: 0, y: 0 },
      { w: 2, d: 2 },
      { x: 1, y: 1 },
      { w: 2, d: 2 },
    ),
    true,
  );
  assert.equal(
    cellsOverlap(
      { x: 0, y: 0 },
      { w: 2, d: 2 },
      { x: 2, y: 0 },
      { w: 2, d: 2 },
    ),
    false,
  );
  assert.equal(
    cellsOverlap(
      { x: 0, y: 0 },
      { w: 2, d: 2 },
      { x: 0, y: 2 },
      { w: 2, d: 2 },
    ),
    false,
  );
});

test("depth grows towards the camera", () => {
  const back = footprintDepth({ x: 0, y: 0 }, { w: 2, d: 2 });
  const front = footprintDepth({ x: 1, y: 1 }, { w: 2, d: 2 });
  assert.equal(back, 4);
  assert.equal(front, 6);
});

test("a grid corner is where the tiles around it meet", () => {
  const centre = tileToScreen(0, 0);

  // The four corners of tile (0, 0), read off the grid rather than the tile.
  assert.deepEqual(gridCorner(0, 0), { x: centre.x, y: centre.y - 16 });
  assert.deepEqual(gridCorner(1, 0), { x: centre.x + 32, y: centre.y });
  assert.deepEqual(gridCorner(1, 1), { x: centre.x, y: centre.y + 16 });
  assert.deepEqual(gridCorner(0, 1), { x: centre.x - 32, y: centre.y });
});

test("the floor is ruled by one line per tile boundary in each axis", () => {
  const lines = roomGridLines();
  assert.equal(lines.length, ROOM_COLS + ROOM_ROWS + 2);

  // Every line starts and ends on the room's edge.
  const bounds = roomBounds();
  for (const [from, to] of lines) {
    for (const point of [from, to]) {
      assert.ok(point.x >= bounds.left && point.x <= bounds.right);
      assert.ok(point.y >= bounds.top && point.y <= bounds.bottom);
    }
  }
});

test("the room's bounds enclose it exactly, and its centre is inside", () => {
  const bounds = roomBounds();
  assert.deepEqual(bounds, {
    left: -768,
    right: 768,
    top: -16,
    bottom: 752,
    width: 1536,
    height: 768,
  });

  assert.deepEqual(roomCenter(), { x: 0, y: 368 });
});
