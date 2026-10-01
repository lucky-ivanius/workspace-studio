import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { useStudioStore } from "./store";

/**
 * Representative products, named by the role they play in these tests rather
 * than repeating monis.rent slugs at thirty call sites.
 */
const DESK = "electrical-adjustable-desk";
const MONITOR = "27-4-k-multimedia-monitor";
const ULTRAWIDE = "34-4-k-curved-monitor-180-hz";
const LAMP = "smart-led-desk-lamp-1-s";
const PLANT = "plant-monstera";
/** A cable: rentable, but nothing the room could draw. */
const CART_ONLY = "hdmi-2-0-cable";

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
  const id = place(DESK);

  assert.equal(store().items.length, 1);
  assert.equal(store().selectedId, id);
  // Centred in the room, so the first desk is not stranded in a corner.
  assert.deepEqual(store().items[0].cell, { x: 8, y: 10 });
  assert.equal(store().items[0].surface, "floor");
});

test("a desk accessory asks for a desk until one exists", () => {
  assert.deepEqual(store().addProduct(MONITOR), {
    status: "needs-desk",
  });
  assert.equal(store().items.length, 0);

  place(DESK);
  place(MONITOR);

  assert.equal(store().items.length, 2);
  assert.equal(store().items[1].surface, "desk");
});

test("a full room reports no space rather than a missing desk", () => {
  const desk = place(DESK);

  // An 8x4 desk surface holds eight 4x1 ultrawides and no more.
  for (let index = 0; index < 8; index++) {
    place(ULTRAWIDE, desk);
  }

  assert.deepEqual(store().addProduct(ULTRAWIDE, desk), {
    status: "no-space",
  });
});

test("an unknown product is ignored", () => {
  assert.deepEqual(store().addProduct("not-a-product"), {
    status: "unknown",
  });
  assert.equal(store().items.length, 0);
  assert.deepEqual(store().cart, []);
});

test("a cart-only product skips the room and goes straight to the cart", () => {
  assert.deepEqual(store().addProduct(CART_ONLY), { status: "carted" });

  assert.equal(store().items.length, 0);
  assert.deepEqual(store().cart, [{ productId: CART_ONLY, quantity: 1 }]);
  // Nothing was placed, so nothing became the selection either.
  assert.equal(store().selectedId, null);
});

test("a cart-only product never asks for a desk, even when one exists", () => {
  place(DESK);

  assert.deepEqual(store().addProduct(CART_ONLY), { status: "carted" });
  assert.deepEqual(store().addProduct(CART_ONLY), { status: "carted" });

  assert.equal(store().items.length, 1);
  assert.deepEqual(store().cart, [{ productId: CART_ONLY, quantity: 2 }]);
});

test("a desk item prefers the desk it was added from", () => {
  const first = place(DESK);
  store().moveItem(first, { x: 0, y: 0 });
  const second = place(DESK);
  store().moveItem(second, { x: 0, y: 8 });

  const monitor = place(MONITOR, second);

  assert.equal(
    store().items.find((item) => item.instanceId === monitor)?.hostId,
    second,
  );
});

test("a desk item falls back to another desk when its own is full", () => {
  const first = place(DESK);
  store().moveItem(first, { x: 0, y: 0 });
  const second = place(DESK);
  store().moveItem(second, { x: 0, y: 8 });

  for (let index = 0; index < 8; index++) {
    place(ULTRAWIDE, first);
  }

  const overflow = place(ULTRAWIDE, first);
  assert.equal(
    store().items.find((item) => item.instanceId === overflow)?.hostId,
    second,
  );
});

test("a floor item moves to a free tile", () => {
  const id = place(DESK);

  assert.equal(store().moveItem(id, { x: 2, y: 4 }), true);
  assert.deepEqual(store().items[0].cell, { x: 2, y: 4 });
});

test("a move outside the room is clamped rather than refused", () => {
  const id = place(DESK);

  assert.equal(store().moveItem(id, { x: 99, y: 99 }), true);
  // The room is 24x24 and the desk is 8x4.
  assert.deepEqual(store().items[0].cell, { x: 16, y: 20 });
});

test("a move onto another item is refused and changes nothing", () => {
  const first = place(DESK);
  store().moveItem(first, { x: 0, y: 0 });

  const second = place(DESK);

  const before = store().items.find((item) => item.instanceId === second)?.cell;
  assert.equal(store().moveItem(second, { x: 0, y: 0 }), false);
  assert.deepEqual(
    store().items.find((item) => item.instanceId === second)?.cell,
    before,
  );
});

test("a desk item dragged off every desk stays put", () => {
  place(DESK);
  const monitor = place(MONITOR);

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
  const desk = place(DESK);
  const monitor = place(MONITOR);
  const lamp = place(LAMP);

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
  const desk = place(DESK);
  const monitor = place(MONITOR);

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
  const first = place(DESK);
  store().moveItem(first, { x: 0, y: 0 });

  const second = place(DESK);
  const monitor = place(MONITOR, second);

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

test("removing a desk sends whatever sat on it to the cart", () => {
  const desk = place(DESK);
  place(MONITOR);
  place(LAMP);
  place(PLANT);
  assert.equal(store().items.length, 4);

  store().removeItem(desk);

  // Only the plant stood on the floor, so only the plant is still drawn.
  assert.equal(store().items.length, 1);
  assert.equal(store().items[0].productId, PLANT);

  // The monitor and the lamp lost their surface, not their place on the bill.
  assert.deepEqual(store().cart, [
    { productId: MONITOR, quantity: 1 },
    { productId: LAMP, quantity: 1 },
  ]);
});

test("each copy on a desk is carted, so the quantity survives", () => {
  const desk = place(DESK);
  place(MONITOR);
  place(MONITOR);

  store().removeItem(desk);

  assert.deepEqual(store().items, []);
  assert.deepEqual(store().cart, [{ productId: MONITOR, quantity: 2 }]);
});

test("removing a desk clears a selection that was standing on it", () => {
  place(DESK);
  const monitor = place(MONITOR);
  assert.equal(store().selectedId, monitor);

  // The desk goes while the monitor is the selection, so the toolbar would
  // otherwise be left pointing at an item that is no longer drawn.
  store().removeCopy(DESK);
  assert.equal(store().selectedId, null);
});

test("removing the selected item clears the selection", () => {
  const id = place(DESK);

  store().removeItem(id);
  assert.equal(store().selectedId, null);
});

test("the cart stacks duplicates and gives them back one at a time", () => {
  store().addToCart(MONITOR);
  store().addToCart(MONITOR);
  store().addToCart(LAMP);

  assert.deepEqual(store().cart, [
    { productId: MONITOR, quantity: 2 },
    { productId: LAMP, quantity: 1 },
  ]);

  // Nothing is placed, so the cart is the only record of these.
  assert.equal(store().items.length, 0);

  store().removeCopy(MONITOR);
  assert.deepEqual(store().cart, [
    { productId: MONITOR, quantity: 1 },
    { productId: LAMP, quantity: 1 },
  ]);

  store().removeCopy(MONITOR);
  assert.deepEqual(store().cart, [{ productId: LAMP, quantity: 1 }]);
});

test("a cart copy is given back before anything in the room", () => {
  place(DESK);
  const first = place(MONITOR);
  // The `+` on a summary line, which rents another without drawing it.
  store().addToCart(MONITOR);
  const second = place(MONITOR);

  assert.equal(store().items.length, 3);
  assert.deepEqual(store().cart, [{ productId: MONITOR, quantity: 1 }]);

  // The cart copy costs nothing to give back, so the room is left alone.
  store().removeCopy(MONITOR);
  assert.deepEqual(store().cart, []);
  assert.equal(store().items.length, 3);

  // Only now does a sprite go, and it is the newest one.
  store().removeCopy(MONITOR);
  assert.deepEqual(
    store()
      .items.filter((item) => item.productId === MONITOR)
      .map((item) => item.instanceId),
    [first],
  );
  assert.ok(
    !store().items.some((item) => item.instanceId === second),
    "the newest monitor should be the one that went",
  );
});

test("the last copy of a product leaves the setup entirely", () => {
  place(DESK);
  const monitor = place(MONITOR);

  store().removeCopy(MONITOR);

  assert.ok(!store().items.some((item) => item.instanceId === monitor));
  assert.equal(store().selectedId, null);
});

test("giving back a copy of something nobody has is a no-op", () => {
  place(DESK);

  store().removeCopy(MONITOR);

  assert.equal(store().items.length, 1);
  assert.deepEqual(store().cart, []);
});

test("giving back a desk carts whatever stands on it", () => {
  place(DESK);
  place(MONITOR);

  store().removeCopy(DESK);

  // The desk is off the canvas and off the bill, and the monitor is still
  // rented: `-` on the desk line may only change the desk's own quantity.
  assert.deepEqual(store().items, []);
  assert.deepEqual(store().cart, [{ productId: MONITOR, quantity: 1 }]);
});

test("a carted rider is given back by its own line, one click", () => {
  place(DESK);
  place(MONITOR);
  store().removeCopy(DESK);

  // It is a cart copy now, so the next `-` on the monitor needs no sprite.
  store().removeCopy(MONITOR);

  assert.deepEqual(store().cart, []);
  assert.deepEqual(store().items, []);
});

test("an unknown product never reaches the cart", () => {
  store().addToCart("not-a-product");
  assert.deepEqual(store().cart, []);
});

test("a staging item never reaches the cart", () => {
  // Staging is scenery, so it is never billed and has no cart to fall back to.
  store().addToCart(PLANT);
  assert.deepEqual(store().cart, []);
});

test("clearing empties the room and the cart alike", () => {
  place(DESK);
  store().addToCart(MONITOR);

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
