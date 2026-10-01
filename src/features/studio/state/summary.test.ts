import assert from "node:assert/strict";
import { test } from "node:test";
import { getProduct } from "../model/catalog";
import type { PlacedItem } from "../model/types";
import { formatUsd, summarize } from "./summary";

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
  const summary = summarize([], 4);

  assert.deepEqual(summary.lines, []);
  assert.equal(summary.itemCount, 0);
  assert.equal(summary.perWeek, 0);
  assert.equal(summary.total, 0);
});

test("duplicates collapse into one line with a quantity", () => {
  const summary = summarize(
    [
      place("monitor-27-4k"),
      place("monitor-27-4k"),
      place("desk-electric-standing"),
    ],
    2,
  );

  assert.equal(summary.lines.length, 2);
  assert.equal(summary.itemCount, 3);

  const monitors = summary.lines.find(
    (line) => line.product.id === "monitor-27-4k",
  );
  assert.ok(monitors);
  assert.equal(monitors.quantity, 2);
  assert.equal(monitors.weeklyTotal, monitors.ratePerWeek * 2);
});

test("staging items never reach checkout", () => {
  const summary = summarize(
    [place("desk-electric-standing"), place("plant-monstera")],
    4,
  );

  assert.equal(summary.lines.length, 1);
  assert.equal(summary.itemCount, 1);
});

test("stays over a month use the long-stay rate", () => {
  const desk = product("desk-electric-standing");
  assert.notEqual(desk.longStayPricePerWeek, desk.pricePerWeek);

  assert.equal(
    summarize([place(desk.id)], 4).lines[0].ratePerWeek,
    desk.pricePerWeek,
  );
  assert.equal(
    summarize([place(desk.id)], 12).lines[0].ratePerWeek,
    desk.longStayPricePerWeek,
  );
});

test("the total is the weekly rate for the whole stay plus deposits", () => {
  const desk = product("desk-electric-standing");
  const summary = summarize([place(desk.id), place(desk.id)], 3);

  const expectedPerWeek = desk.pricePerWeek * 2;
  const expectedDeposit = (desk.securityDeposit ?? 0) * 2;

  assert.equal(summary.perWeek, expectedPerWeek);
  assert.equal(summary.deposit, expectedDeposit);
  assert.equal(summary.total, expectedPerWeek * 3 + expectedDeposit);
});

test("whole dollars lose the trailing zeros, cents keep them", () => {
  assert.equal(formatUsd(57), "$57");
  assert.equal(formatUsd(6.5), "$6.50");
});
