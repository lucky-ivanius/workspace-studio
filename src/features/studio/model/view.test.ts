import assert from "node:assert/strict";
import { test } from "node:test";
import { rotatedClockwise, viewState } from "./view";

test("the front view is unmirrored", () => {
  assert.deepEqual(viewState(0), { turns: 0, mirrored: false });
});

test("each odd turn is drawn mirrored, each even turn upright", () => {
  assert.deepEqual(viewState(1), { turns: 1, mirrored: true });
  assert.deepEqual(viewState(2), { turns: 2, mirrored: false });
  assert.deepEqual(viewState(3), { turns: 3, mirrored: true });
});

test("turns wrap around the four views", () => {
  assert.equal(viewState(4).turns, 0);
  assert.equal(viewState(7).turns, 3);
  assert.equal(viewState(-1).turns, 3);
});

test("clockwise steps walk the parity cycle and land back on the front", () => {
  let turns = 0;
  const mirrorings: boolean[] = [];

  for (let step = 0; step < 4; step++) {
    mirrorings.push(viewState(turns).mirrored);
    turns = rotatedClockwise(turns);
  }

  assert.deepEqual(mirrorings, [false, true, false, true]);
  assert.equal(turns, 0, "four clockwise turns land back on the front");
});

test("rotating clockwise from the front takes one turn", () => {
  assert.equal(rotatedClockwise(0), 1);
  assert.equal(rotatedClockwise(3), 0);
  assert.equal(rotatedClockwise(-2), 3);
});
