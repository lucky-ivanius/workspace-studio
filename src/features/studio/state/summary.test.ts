import assert from "node:assert/strict";
import { test } from "node:test";
import { getProduct } from "../model/catalog";
import type { PlacedItem } from "../model/types";
import { formatUsd, summarize } from "./summary";

/** Named by role, so the monis.rent slugs live in one place. */
const DESK = "electrical-adjustable-desk";
const MONITOR = "27-4-k-multimedia-monitor";
const PLANT = "plant-monstera";

let nextOrdinal = 0;

function product(id: string) {
  const found = getProduct(id);
  assert.ok(found, `missing product ${id}`);
  return found;
}

function place(productId: string): PlacedItem {
  nextOrdinal += 1;
  return {
    instanceId: `${productId}-${nextOrdinal}`,
    productId,
    cell: { x: 0, y: 0 },
    surface: "floor",
    ordinal: nextOrdinal,
  };
}

test("an empty studio costs nothing", () => {
  const summary = summarize([], [], 4);

  assert.deepEqual(summary.lines, []);
  assert.equal(summary.itemCount, 0);
  assert.equal(summary.perWeek, 0);
  assert.equal(summary.total, 0);
});

test("duplicates collapse into one line with a quantity", () => {
  const summary = summarize(
    [place(MONITOR), place(MONITOR), place(DESK)],
    [],
    2,
  );

  assert.equal(summary.lines.length, 2);
  assert.equal(summary.itemCount, 3);

  const monitors = summary.lines.find((line) => line.product.id === MONITOR);
  assert.ok(monitors);
  assert.equal(monitors.quantity, 2);
  assert.equal(monitors.weeklyTotal, monitors.ratePerWeek * 2);
  assert.equal(monitors.inCart, 0);
});

test("a cart item is billed even though it is not in the room", () => {
  const monitor = product(MONITOR);
  const summary = summarize([], [{ productId: monitor.id, quantity: 2 }], 4);

  assert.equal(summary.lines.length, 1);
  assert.equal(summary.itemCount, 2);
  assert.equal(summary.lines[0].inCart, 2);
  assert.equal(summary.perWeek, monitor.pricePerWeek * 2);
});

test("a product in the room and in the cart shares one line", () => {
  const monitor = product(MONITOR);
  const summary = summarize(
    [place(monitor.id)],
    [{ productId: monitor.id, quantity: 2 }],
    4,
  );

  assert.equal(summary.lines.length, 1);
  assert.equal(summary.lines[0].quantity, 3);
  assert.equal(summary.lines[0].inCart, 2);
  assert.equal(summary.perWeek, monitor.pricePerWeek * 3);
});

test("staging items never reach checkout", () => {
  const summary = summarize([place(DESK), place(PLANT)], [], 4);

  assert.equal(summary.lines.length, 1);
  assert.equal(summary.itemCount, 1);
});

test("stays over a month use the long-stay rate", () => {
  const desk = product(DESK);
  assert.notEqual(desk.longStayPricePerWeek, desk.pricePerWeek);

  assert.equal(
    summarize([place(desk.id)], [], 4).lines[0].ratePerWeek,
    desk.pricePerWeek,
  );
  assert.equal(
    summarize([place(desk.id)], [], 12).lines[0].ratePerWeek,
    desk.longStayPricePerWeek,
  );
});

test("the total is the weekly rate for the whole stay plus deposits", () => {
  const desk = product(DESK);
  const summary = summarize([place(desk.id), place(desk.id)], [], 3);

  const expectedPerWeek = desk.pricePerWeek * 2;
  const expectedDeposit = (desk.securityDeposit ?? 0) * 2;

  assert.equal(summary.perWeek, expectedPerWeek);
  assert.equal(summary.deposit, expectedDeposit);
  assert.equal(summary.total, expectedPerWeek * 3 + expectedDeposit);
});

test("a cart item carries its deposit too", () => {
  const desk = product(DESK);
  const summary = summarize([], [{ productId: desk.id, quantity: 2 }], 1);

  assert.equal(summary.deposit, (desk.securityDeposit ?? 0) * 2);
});

test("whole dollars lose the trailing zeros, cents keep them", () => {
  assert.equal(formatUsd(57), "$57");
  assert.equal(formatUsd(6.5), "$6.50");
});
