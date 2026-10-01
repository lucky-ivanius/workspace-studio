import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { useStudioStore } from "./store";

beforeEach(() => {
  useStudioStore.setState({
    items: [],
    cart: [],
    selectedId: null,
    rentalWeeks: 4,
  });
});

const store = () => useStudioStore.getState();

/** Adds a product and asserts it reached the room, returning its instance id. */
function place(productId: string, hostId?: string): string {
  const result = store().addProduct(productId, hostId);
  assert.equal(result.status, "placed", `${productId} was not placed`);
  assert.ok(result.status === "placed");
  return result.instanceId;
}

test("adding a product places it and selects it", () => {
  const id = place("desk-electric-standing");

  assert.equal(store().items.length, 1);
  assert.equal(store().selectedId, id);
  // Centred in the room, so the first desk is not stranded in a corner.
  assert.deepEqual(store().items[0].cell, { x: 8, y: 10 });
  assert.equal(store().items[0].surface, "floor");
});

test("a desk accessory asks for a desk until one exists", () => {
  assert.deepEqual(store().addProduct("monitor-27-4k"), {
    status: "needs-desk",
  });
  assert.equal(store().items.length, 0);

  place("desk-electric-standing");
  place("monitor-27-4k");

  assert.equal(store().items.length, 2);
  assert.equal(store().items[1].surface, "desk");
});

test("a full room reports no space rather than a missing desk", () => {
  const desk = place("desk-electric-standing");

  // An 8x4 desk surface holds eight 4x1 ultrawides and no more.
  for (let index = 0; index < 8; index++) {
    place("monitor-34-ultrawide", desk);
  }

  assert.deepEqual(store().addProduct("monitor-34-ultrawide", desk), {
    status: "no-space",
  });
});

test("an unknown product is ignored", () => {
  assert.deepEqual(store().addProduct("not-a-product"), {
    status: "unknown",
  });
  assert.equal(store().items.length, 0);
});

test("a desk item prefers the desk it was added from", () => {
  const first = place("desk-electric-standing");
  store().moveItem(first, { x: 0, y: 0 });
  const second = place("desk-electric-standing");
  store().moveItem(second, { x: 0, y: 8 });

  const monitor = place("monitor-27-4k", second);

  assert.equal(
    store().items.find((item) => item.instanceId === monitor)?.hostId,
    second,
  );
});

test("a desk item falls back to another desk when its own is full", () => {
  const first = place("desk-electric-standing");
  store().moveItem(first, { x: 0, y: 0 });
  const second = place("desk-electric-standing");
  store().moveItem(second, { x: 0, y: 8 });

  for (let index = 0; index < 8; index++) {
    place("monitor-34-ultrawide", first);
  }

  const overflow = place("monitor-34-ultrawide", first);
  assert.equal(
    store().items.find((item) => item.instanceId === overflow)?.hostId,
    second,
  );
});

test("a floor item moves to a free tile", () => {
  const id = place("desk-electric-standing");

  assert.equal(store().moveItem(id, { x: 2, y: 4 }), true);
  assert.deepEqual(store().items[0].cell, { x: 2, y: 4 });
});

test("a move outside the room is clamped rather than refused", () => {
  const id = place("desk-electric-standing");

  assert.equal(store().moveItem(id, { x: 99, y: 99 }), true);
  // The room is 24x24 and the desk is 8x4.
  assert.deepEqual(store().items[0].cell, { x: 16, y: 20 });
});

test("a move onto another item is refused and changes nothing", () => {
  const first = place("desk-electric-standing");
  store().moveItem(first, { x: 0, y: 0 });

  const second = place("desk-electric-standing");

  const before = store().items.find((item) => item.instanceId === second)?.cell;
  assert.equal(store().moveItem(second, { x: 0, y: 0 }), false);
  assert.deepEqual(
    store().items.find((item) => item.instanceId === second)?.cell,
    before,
  );
});

test("a desk item dragged off every desk stays put", () => {
  place("desk-electric-standing");
  const monitor = place("monitor-27-4k");

  const before = store().items.find(
    (item) => item.instanceId === monitor,
  )?.cell;
  assert.equal(store().moveItem(monitor, { x: 20, y: 20 }), false);
  assert.deepEqual(
    store().items.find((item) => item.instanceId === monitor)?.cell,
    before,
  );
});

test("moving a missing item is a no-op", () => {
  assert.equal(store().moveItem("nope", { x: 1, y: 1 }), false);
});

test("moving a desk carries whatever stands on it", () => {
  const desk = place("desk-electric-standing");
  const monitor = place("monitor-27-4k");
  const lamp = place("lamp-smart-led");

  const cellOf = (id: string) =>
    store().items.find((item) => item.instanceId === id)?.cell;

  const deskBefore = cellOf(desk);
  const monitorBefore = cellOf(monitor);
  const lampBefore = cellOf(lamp);
  assert.ok(deskBefore && monitorBefore && lampBefore);

  assert.equal(store().moveItem(desk, { x: 1, y: 2 }), true);

  // The desk landed where it was asked to, so everything on it shifted by the
  // same delta and kept its spot on the surface.
  const shift = {
    x: 1 - deskBefore.x,
    y: 2 - deskBefore.y,
  };
  assert.deepEqual(cellOf(desk), { x: 1, y: 2 });
  assert.deepEqual(cellOf(monitor), {
    x: monitorBefore.x + shift.x,
    y: monitorBefore.y + shift.y,
  });
  assert.deepEqual(cellOf(lamp), {
    x: lampBefore.x + shift.x,
    y: lampBefore.y + shift.y,
  });
});

test("a desk's riders stay on it through a clamped move", () => {
  const desk = place("desk-electric-standing");
  const monitor = place("monitor-27-4k");

  // Far outside the room, so the desk clamps and the monitor must follow the
  // clamped cell rather than the one that was asked for.
  assert.equal(store().moveItem(desk, { x: 99, y: 99 }), true);

  const moved = store().items.find((item) => item.instanceId === desk);
  const rider = store().items.find((item) => item.instanceId === monitor);
  assert.ok(moved && rider);

  assert.deepEqual(moved.cell, { x: 16, y: 20 });
  assert.equal(rider.hostId, desk);
  // The monitor sat at the desk's origin, so it rides at the clamped origin.
  assert.deepEqual(rider.cell, { x: 16, y: 20 });
});

test("a refused desk move leaves its riders alone", () => {
  const first = place("desk-electric-standing");
  store().moveItem(first, { x: 0, y: 0 });

  const second = place("desk-electric-standing");
  const monitor = place("monitor-27-4k", second);

  const before = store().items.find(
    (item) => item.instanceId === monitor,
  )?.cell;

  // The second desk cannot land on the first, so nothing it carries may move.
  assert.equal(store().moveItem(second, { x: 0, y: 0 }), false);
  assert.deepEqual(
    store().items.find((item) => item.instanceId === monitor)?.cell,
    before,
  );
});

test("removing a desk also removes whatever sits on it", () => {
  const desk = place("desk-electric-standing");
  place("monitor-27-4k");
  place("lamp-smart-led");
  place("plant-monstera");
  assert.equal(store().items.length, 4);

  store().removeItem(desk);

  // Only the plant stood on the floor.
  assert.equal(store().items.length, 1);
  assert.equal(store().items[0].productId, "plant-monstera");
});

test("removing the selected item clears the selection", () => {
  const id = place("desk-electric-standing");

  store().removeItem(id);
  assert.equal(store().selectedId, null);
});

test("the cart stacks duplicates and gives them back one at a time", () => {
  store().addToCart("monitor-27-4k");
  store().addToCart("monitor-27-4k");
  store().addToCart("lamp-smart-led");

  assert.deepEqual(store().cart, [
    { productId: "monitor-27-4k", quantity: 2 },
    { productId: "lamp-smart-led", quantity: 1 },
  ]);

  // Nothing is placed, so the cart is the only record of these.
  assert.equal(store().items.length, 0);

  store().removeFromCart("monitor-27-4k");
  assert.deepEqual(store().cart, [
    { productId: "monitor-27-4k", quantity: 1 },
    { productId: "lamp-smart-led", quantity: 1 },
  ]);

  store().removeFromCart("monitor-27-4k");
  assert.deepEqual(store().cart, [
    { productId: "lamp-smart-led", quantity: 1 },
  ]);
});

test("an unknown product never reaches the cart", () => {
  store().addToCart("not-a-product");
  assert.deepEqual(store().cart, []);
});

test("clearing empties the room and the cart alike", () => {
  place("desk-electric-standing");
  store().addToCart("monitor-27-4k");

  store().clear();

  assert.deepEqual(store().items, []);
  assert.deepEqual(store().cart, []);
  assert.equal(store().selectedId, null);
});

test("rental length is kept to whole weeks of at least one", () => {
  store().setRentalWeeks(0);
  assert.equal(store().rentalWeeks, 1);

  store().setRentalWeeks(12);
  assert.equal(store().rentalWeeks, 12);
});
