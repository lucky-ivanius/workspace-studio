import assert from "node:assert/strict";
import { test } from "node:test";
import {
  anchorToScreen,
  cellsOverlap,
  clampToRoom,
  footprintDepth,
  isInsideRoom,
  ROOM_COLS,
  ROOM_ROWS,
  screenToTile,
  tileToScreen,
} from "./grid";

test("the origin tile sits at the world origin", () => {
  assert.deepEqual(tileToScreen(0, 0), { x: 0, y: 0 });
});

test("moving one tile along x goes right and down by half a tile", () => {
  assert.deepEqual(tileToScreen(1, 0), { x: 64, y: 32 });
});

test("moving one tile along y goes left and down by half a tile", () => {
  assert.deepEqual(tileToScreen(0, 1), { x: -64, y: 32 });
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
  // A 4x2 desk at the origin centres on tile (1.5, 0.5).
  assert.deepEqual(anchorToScreen({ x: 0, y: 0 }, { w: 4, d: 2 }), {
    x: 64,
    y: 64,
  });
});

test("elevation lifts an anchor straight up", () => {
  const floor = anchorToScreen({ x: 2, y: 2 }, { w: 1, d: 1 }, 0);
  const raised = anchorToScreen({ x: 2, y: 2 }, { w: 1, d: 1 }, 120);
  assert.equal(raised.x, floor.x);
  assert.equal(raised.y, floor.y - 120);
});

test("a footprint fits only while it stays fully inside the room", () => {
  assert.equal(isInsideRoom({ x: 0, y: 0 }, { w: 4, d: 2 }), true);
  assert.equal(
    isInsideRoom({ x: ROOM_COLS - 4, y: ROOM_ROWS - 2 }, { w: 4, d: 2 }),
    true,
  );
  assert.equal(isInsideRoom({ x: ROOM_COLS - 3, y: 0 }, { w: 4, d: 2 }), false);
  assert.equal(isInsideRoom({ x: -1, y: 0 }, { w: 1, d: 1 }), false);
});

test("clamping pulls a footprint back inside the room", () => {
  assert.deepEqual(clampToRoom({ x: 20, y: -5 }, { w: 4, d: 2 }), {
    x: ROOM_COLS - 4,
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
