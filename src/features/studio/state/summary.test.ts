import assert from "node:assert/strict";
import { test } from "node:test";
import { getProduct } from "../model/catalog";
import type { PlacedItem } from "../model/types";
import { formatUsd, formatWeeks, summarize } from "./summary";

/** Named by role, so the monis.rent slugs live in one place. */
const DESK = "electrical-adjustable-desk";
const KEYBOARD = "apple-magic-keyboard";
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
    [place(KEYBOARD), place(KEYBOARD), place(DESK)],
    [],
    2,
  );

  assert.equal(summary.lines.length, 2);
  assert.equal(summary.itemCount, 3);

  const keyboards = summary.lines.find((line) => line.product.id === KEYBOARD);
  assert.ok(keyboards);
  assert.equal(keyboards.quantity, 2);
  assert.equal(keyboards.weeklyTotal, keyboards.ratePerWeek * 2);
  assert.equal(keyboards.inCart, 0);
});

test("a cart item is billed even though it is not in the room", () => {
  const keyboard = product(KEYBOARD);
  const summary = summarize([], [{ productId: keyboard.id, quantity: 2 }], 2);

  assert.equal(summary.lines.length, 1);
  assert.equal(summary.itemCount, 2);
  assert.equal(summary.lines[0].inCart, 2);
  assert.equal(summary.perWeek, keyboard.pricePerWeek * 2);
});

test("a product in the room and in the cart shares one line", () => {
  const keyboard = product(KEYBOARD);
  const summary = summarize(
    [place(keyboard.id)],
    [{ productId: keyboard.id, quantity: 2 }],
    2,
  );

  assert.equal(summary.lines.length, 1);
  assert.equal(summary.lines[0].quantity, 3);
  assert.equal(summary.lines[0].inCart, 2);
  assert.equal(summary.perWeek, keyboard.pricePerWeek * 3);
});

test("staging items never reach checkout", () => {
  const summary = summarize([place(DESK), place(PLANT)], [], 4);

  assert.equal(summary.lines.length, 1);
  assert.equal(summary.itemCount, 1);
});

test("the long-stay rate starts at four weeks, the month the storefront bills", () => {
  const desk = product(DESK);
  assert.notEqual(desk.longStayPricePerWeek, desk.pricePerWeek);
  // The storefront's own monthly figure is four weeks of the long-stay rate,
  // which is what puts the boundary at four rather than past it.
  assert.equal(desk.monthlyPrice, (desk.longStayPricePerWeek ?? 0) * 4);

  const rateAt = (weeks: number) =>
    summarize([place(desk.id)], [], weeks).lines[0].ratePerWeek;

  assert.equal(rateAt(1), desk.pricePerWeek);
  assert.equal(rateAt(3), desk.pricePerWeek);
  assert.equal(rateAt(4), desk.longStayPricePerWeek);
  assert.equal(rateAt(12), desk.longStayPricePerWeek);
});

test("a four week stay costs the storefront's monthly price", () => {
  const desk = product(DESK);
  const summary = summarize([place(desk.id)], [], 4);

  assert.equal(summary.longStay, true);
  assert.equal(summary.total - summary.deposit, desk.monthlyPrice);
});

test("a stay under a month is not a long stay", () => {
  assert.equal(summarize([], [], 1).longStay, false);
  assert.equal(summarize([], [], 3).longStay, false);
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

test("one week is not 1 weeks", () => {
  assert.equal(formatWeeks(1), "1 week");
  assert.equal(formatWeeks(2), "2 weeks");
  assert.equal(formatWeeks(12), "12 weeks");
});
