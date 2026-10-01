import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { useStudioStore } from "./store";

beforeEach(() => {
  useStudioStore.setState({ items: [], selectedId: null, rentalWeeks: 4 });
});

const store = () => useStudioStore.getState();

test("adding a product places it and selects it", () => {
  const id = store().addProduct("desk-electric-standing");

  assert.ok(id);
  assert.equal(store().items.length, 1);
  assert.equal(store().selectedId, id);
  // Centred in the room, so the first desk is not stranded in a corner.
  assert.deepEqual(store().items[0].cell, { x: 8, y: 10 });
  assert.equal(store().items[0].surface, "floor");
});

test("a desk accessory is refused until a desk exists", () => {
  assert.equal(store().addProduct("monitor-27-4k"), null);
  assert.equal(store().items.length, 0);

  store().addProduct("desk-electric-standing");
  const monitor = store().addProduct("monitor-27-4k");

  assert.ok(monitor);
  assert.equal(store().items.length, 2);
  assert.equal(store().items[1].surface, "desk");
});

test("an unknown product is ignored", () => {
  assert.equal(store().addProduct("not-a-product"), null);
  assert.equal(store().items.length, 0);
});

test("a floor item moves to a free tile", () => {
  const id = store().addProduct("desk-electric-standing");
  assert.ok(id);

  assert.equal(store().moveItem(id, { x: 2, y: 4 }), true);
  assert.deepEqual(store().items[0].cell, { x: 2, y: 4 });
});

test("a move outside the room is clamped rather than refused", () => {
  const id = store().addProduct("desk-electric-standing");
  assert.ok(id);

  assert.equal(store().moveItem(id, { x: 99, y: 99 }), true);
  // The room is 24x24 and the desk is 8x4.
  assert.deepEqual(store().items[0].cell, { x: 16, y: 20 });
});

test("a move onto another item is refused and changes nothing", () => {
  const first = store().addProduct("desk-electric-standing");
  assert.ok(first);
  store().moveItem(first, { x: 0, y: 0 });

  const second = store().addProduct("desk-electric-standing");
  assert.ok(second);

  const before = store().items.find((item) => item.instanceId === second)?.cell;
  assert.equal(store().moveItem(second, { x: 0, y: 0 }), false);
  assert.deepEqual(
    store().items.find((item) => item.instanceId === second)?.cell,
    before,
  );
});

test("a desk item dragged off every desk stays put", () => {
  store().addProduct("desk-electric-standing");
  const monitor = store().addProduct("monitor-27-4k");
  assert.ok(monitor);

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

test("removing a desk also removes whatever sits on it", () => {
  const desk = store().addProduct("desk-electric-standing");
  store().addProduct("monitor-27-4k");
  store().addProduct("lamp-smart-led");
  store().addProduct("plant-monstera");
  assert.ok(desk);
  assert.equal(store().items.length, 4);

  store().removeItem(desk);

  // Only the plant stood on the floor.
  assert.equal(store().items.length, 1);
  assert.equal(store().items[0].productId, "plant-monstera");
});

test("removing the selected item clears the selection", () => {
  const id = store().addProduct("desk-electric-standing");
  assert.ok(id);

  store().removeItem(id);
  assert.equal(store().selectedId, null);
});

test("rental length is kept to whole weeks of at least one", () => {
  store().setRentalWeeks(0);
  assert.equal(store().rentalWeeks, 1);

  store().setRentalWeeks(12);
  assert.equal(store().rentalWeeks, 12);
});
