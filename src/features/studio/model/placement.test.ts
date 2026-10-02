import assert from "node:assert/strict";
import { test } from "node:test";
import { artFor } from "./art";
import { cellsOverlap, isInsideRoom } from "./grid";
import { canPlace, deskAt, findPlacement, zIndexOf } from "./placement";
import type { PlacedItem } from "./types";

/** Product ids, as the store and the catalogue know them. */
const DESK = "electrical-adjustable-desk";
const KEYBOARD = "apple-magic-keyboard";
const PLANT = "plant-monstera";
const CHAIR = "ergonomic-office-chair";
const LAMP = "smart-led-desk-lamp-1-s";

/**
 * Placement reasons about art rather than products, so the two namespaces are
 * kept apart here on purpose.
 */
function art(productId: string) {
  const asset = artFor(productId);
  if (!asset) throw new Error(`${productId} has no art`);
  return asset;
}

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
  assert.equal(findPlacement([], art(KEYBOARD)), undefined);
});

test("a keyboard lands on the desk that is already in the room", () => {
  const desk = place(DESK, { x: 0, y: 0 });
  const placement = findPlacement([desk], art(KEYBOARD));

  assert.deepEqual(placement, {
    cell: { x: 0, y: 0 },
    surface: "desk",
    hostId: desk.instanceId,
  });
});

test("a chair tucks in front of the desk rather than beside it", () => {
  const desk = place(DESK, { x: 0, y: 0 });
  const placement = findPlacement([desk], art(CHAIR));

  // Desk is 8 wide and 4 deep, so a 4-wide chair centres at x=2, y=4.
  assert.deepEqual(placement, { cell: { x: 2, y: 4 }, surface: "floor" });
});

test("two floor items cannot share tiles", () => {
  const desk = place(DESK, { x: 0, y: 0 });

  assert.equal(
    canPlace([desk], art(CHAIR), {
      cell: { x: 0, y: 0 },
      surface: "floor",
    }),
    false,
  );
  assert.equal(
    canPlace([desk], art(CHAIR), {
      cell: { x: 0, y: 4 },
      surface: "floor",
    }),
    true,
  );
});

test("a rug lies flat, so other items may stand on it", () => {
  const rug = place("rug-woven", { x: 0, y: 0 });

  assert.equal(
    canPlace([rug], art(CHAIR), {
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
    canPlace([desk], art(KEYBOARD), {
      cell: { x: 2, y: 1 },
      ...onDesk,
    }),
    true,
  );
  // The desk ends at x=8, so a 2-wide keyboard cannot start at x=7.
  assert.equal(
    canPlace([desk], art(KEYBOARD), {
      cell: { x: 7, y: 0 },
      ...onDesk,
    }),
    false,
  );
  assert.equal(
    canPlace([desk], art(KEYBOARD), {
      cell: { x: 0, y: 4 },
      ...onDesk,
    }),
    false,
  );
});

test("a keyboard and a lamp leave most of the desk free", () => {
  const desk = place(DESK, { x: 0, y: 0 });
  const surface = art(DESK).deskSurface;
  assert.ok(surface);

  const keyboard = art(KEYBOARD).footprint;
  const lamp = art(LAMP).footprint;
  const slots = surface.footprint.w * surface.footprint.d;
  const taken = keyboard.w * keyboard.d + lamp.w * lamp.d;

  assert.equal(slots, 32);
  assert.ok(taken / slots < 0.2, `${taken} of ${slots} slots is too much`);

  // Both still fit side by side, back row.
  const onDesk = { surface: "desk" as const, hostId: desk.instanceId };
  assert.equal(
    canPlace([desk], art(KEYBOARD), {
      cell: { x: 0, y: 0 },
      ...onDesk,
    }),
    true,
  );
  const withKeyboard = [desk, place(KEYBOARD, { x: 0, y: 0 }, desk.instanceId)];
  assert.equal(
    canPlace(withKeyboard, art(LAMP), {
      cell: { x: 3, y: 0 },
      ...onDesk,
    }),
    true,
  );
});

test("a desk item needs a host that exists", () => {
  const desk = place(DESK, { x: 0, y: 0 });

  assert.equal(
    canPlace([desk], art(KEYBOARD), {
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
  assert.equal(deskAt(items, { x: 1, y: 5 }), undefined);
});

test("an item on a desk draws over that desk", () => {
  const desk = place(DESK, { x: 0, y: 0 });
  const keyboard = place(KEYBOARD, { x: 0, y: 0 }, desk.instanceId);
  const items = [desk, keyboard];

  assert.ok(zIndexOf(keyboard, items) > zIndexOf(desk, items));
});

test("a floor item nearer the camera draws over a desk and everything on it", () => {
  const desk = place(DESK, { x: 0, y: 0 });
  const keyboard = place(KEYBOARD, { x: 0, y: 0 }, desk.instanceId);
  // Depth runs along the x+y diagonal, so a 2x2 plant at (6,6) reaches 16,
  // past the desk's front corner at x+w+y+d = 12, and (0,2) stops short at 6.
  const plantInFront = place(PLANT, { x: 6, y: 6 });
  const plantBehind = place(PLANT, { x: 0, y: 2 });
  const items = [desk, keyboard, plantInFront, plantBehind];

  assert.ok(zIndexOf(plantInFront, items) > zIndexOf(keyboard, items));
  assert.ok(zIndexOf(plantBehind, items) < zIndexOf(desk, items));
});

test("the room fills up and eventually refuses another desk", () => {
  const items: PlacedItem[] = [];
  const asset = art(DESK);

  for (let attempt = 0; attempt < 100; attempt++) {
    const placement = findPlacement(items, asset);
    if (!placement) break;
    items.push(place(DESK, placement.cell));
  }

  assert.equal(findPlacement(items, asset), undefined);

  // Centre-out packing is looser than wall-to-wall, but every desk it did place
  // must sit inside the room without touching another.
  assert.ok(items.length >= 8, `only fitted ${items.length} desks`);
  for (const item of items) {
    assert.ok(
      isInsideRoom(item.cell, asset.footprint),
      `${item.cell.x},${item.cell.y} escaped the room`,
    );
    for (const other of items) {
      if (other === item) continue;
      assert.equal(
        cellsOverlap(item.cell, asset.footprint, other.cell, asset.footprint),
        false,
      );
    }
  }
});

test("the first desk lands in the middle of the room, not in a corner", () => {
  const placement = findPlacement([], art(DESK));
  assert.ok(placement);

  // An 8x4 desk centred in a 24x24 room.
  assert.deepEqual(placement.cell, { x: 8, y: 10 });
});
