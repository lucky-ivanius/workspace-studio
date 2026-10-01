import assert from "node:assert/strict";
import { test } from "node:test";
import { getAsset } from "./assets";
import { canPlace, deskAt, findPlacement, zIndexOf } from "./placement";
import type { PlacedItem } from "./types";

const DESK = "desk-electric-standing";
const CHAIR = "chair-ergonomic-mesh";
const MONITOR = "monitor-27-4k";
const PLANT = "plant-monstera";

let nextOrdinal = 0;

function place(
  productId: string,
  cell: { x: number; y: number },
  hostId?: string,
): PlacedItem {
  nextOrdinal += 1;
  return {
    instanceId: `${productId}-${nextOrdinal}`,
    productId,
    cell,
    surface: hostId ? "desk" : "floor",
    hostId,
    ordinal: nextOrdinal,
  };
}

test("a desk-mounted item has nowhere to go until a desk exists", () => {
  assert.equal(findPlacement([], getAsset(MONITOR)), undefined);
});

test("a monitor lands on the desk that is already in the room", () => {
  const desk = place(DESK, { x: 0, y: 0 });
  const placement = findPlacement([desk], getAsset(MONITOR));

  assert.deepEqual(placement, {
    cell: { x: 0, y: 0 },
    surface: "desk",
    hostId: desk.instanceId,
  });
});

test("a chair tucks in front of the desk rather than beside it", () => {
  const desk = place(DESK, { x: 0, y: 0 });
  const placement = findPlacement([desk], getAsset(CHAIR));

  // Desk is 4 wide and 2 deep, so a 2-wide chair centres at x=1, y=2.
  assert.deepEqual(placement, { cell: { x: 1, y: 2 }, surface: "floor" });
});

test("two floor items cannot share tiles", () => {
  const desk = place(DESK, { x: 0, y: 0 });

  assert.equal(
    canPlace([desk], getAsset(CHAIR), {
      cell: { x: 0, y: 0 },
      surface: "floor",
    }),
    false,
  );
  assert.equal(
    canPlace([desk], getAsset(CHAIR), {
      cell: { x: 0, y: 2 },
      surface: "floor",
    }),
    true,
  );
});

test("a rug lies flat, so other items may stand on it", () => {
  const rug = place("rug-woven", { x: 0, y: 0 });

  assert.equal(
    canPlace([rug], getAsset(CHAIR), {
      cell: { x: 1, y: 1 },
      surface: "floor",
    }),
    true,
  );
});

test("a desk item must stay within its desk", () => {
  const desk = place(DESK, { x: 0, y: 0 });
  const onDesk = { surface: "desk" as const, hostId: desk.instanceId };

  assert.equal(
    canPlace([desk], getAsset(MONITOR), { cell: { x: 2, y: 1 }, ...onDesk }),
    true,
  );
  // The desk ends at x=4, so a 2-wide monitor cannot start at x=3.
  assert.equal(
    canPlace([desk], getAsset(MONITOR), { cell: { x: 3, y: 0 }, ...onDesk }),
    false,
  );
  assert.equal(
    canPlace([desk], getAsset(MONITOR), { cell: { x: 0, y: 2 }, ...onDesk }),
    false,
  );
});

test("a desk item needs a host that exists", () => {
  const desk = place(DESK, { x: 0, y: 0 });

  assert.equal(
    canPlace([desk], getAsset(MONITOR), {
      cell: { x: 0, y: 0 },
      surface: "desk",
      hostId: "nope",
    }),
    false,
  );
});

test("the desk under a cell is reported, and only within its footprint", () => {
  const desk = place(DESK, { x: 1, y: 1 });
  const items = [desk];

  assert.equal(deskAt(items, { x: 2, y: 1 })?.instanceId, desk.instanceId);
  assert.equal(deskAt(items, { x: 0, y: 0 }), undefined);
  assert.equal(deskAt(items, { x: 1, y: 3 }), undefined);
});

test("an item on a desk draws over that desk", () => {
  const desk = place(DESK, { x: 0, y: 0 });
  const monitor = place(MONITOR, { x: 0, y: 0 }, desk.instanceId);
  const items = [desk, monitor];

  assert.ok(zIndexOf(monitor, items) > zIndexOf(desk, items));
});

test("a floor item nearer the camera draws over a desk and everything on it", () => {
  const desk = place(DESK, { x: 0, y: 0 });
  const monitor = place(MONITOR, { x: 0, y: 0 }, desk.instanceId);
  // Depth runs along the x+y diagonal, so (3,3) is nearer the camera than the
  // desk's front corner at x+w+y+d = 6, and (0,2) is further away.
  const plantInFront = place(PLANT, { x: 3, y: 3 });
  const plantBehind = place(PLANT, { x: 0, y: 2 });
  const items = [desk, monitor, plantInFront, plantBehind];

  assert.ok(zIndexOf(plantInFront, items) > zIndexOf(monitor, items));
  assert.ok(zIndexOf(plantBehind, items) < zIndexOf(desk, items));
});

test("the room fills up and eventually refuses another desk", () => {
  const items: PlacedItem[] = [];
  let placements = 0;

  for (let attempt = 0; attempt < 20; attempt++) {
    const placement = findPlacement(items, getAsset(DESK));
    if (!placement) break;
    items.push(place(DESK, placement.cell));
    placements += 1;
  }

  // A 10x10 room holds ten 4x2 desks: two per band of two rows, five bands.
  assert.equal(placements, 10);
  assert.equal(findPlacement(items, getAsset(DESK)), undefined);
});
