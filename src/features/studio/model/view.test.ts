import assert from "node:assert/strict";
import { test } from "node:test";
import { rotatedLeft, rotatedRight, viewState } from "./view";

test("the front view is unmirrored", () => {
  assert.deepEqual(viewState(0), { turns: 0, label: "Front", mirrored: false });
});

test("each quarter turn names the side it looks at", () => {
  assert.deepEqual(viewState(1), { turns: 1, label: "Right", mirrored: true });
  assert.deepEqual(viewState(2), { turns: 2, label: "Back", mirrored: false });
  assert.deepEqual(viewState(3), { turns: 3, label: "Left", mirrored: true });
});

test("turns wrap around the four views", () => {
  assert.equal(viewState(4).turns, 0);
  assert.equal(viewState(7).turns, 3);
  assert.equal(viewState(-1).turns, 3);
});

test("the mirror follows the turns' parity, so a full cycle is honest", () => {
  let turns = 0;
  const mirrorings: boolean[] = [];

  for (let step = 0; step < 4; step++) {
    mirrorings.push(viewState(turns).mirrored);
    turns = rotatedLeft(turns);
  }

  assert.deepEqual(mirrorings, [false, true, false, true]);
  assert.equal(turns, 0, "four lefts land back on the front");
});

test("rotating left from the front looks at the left side", () => {
  assert.equal(rotatedLeft(0), 3);
  assert.equal(viewState(rotatedLeft(0)).label, "Left");
});

test("rotating right from the front looks at the right side", () => {
  assert.equal(rotatedRight(0), 1);
  assert.equal(viewState(rotatedRight(0)).label, "Right");
});

test("the two directions undo each other", () => {
  for (let turns = -8; turns < 8; turns++) {
    assert.equal(rotatedRight(rotatedLeft(turns)), viewState(turns).turns);
    assert.equal(rotatedLeft(rotatedRight(turns)), viewState(turns).turns);
  }
});
