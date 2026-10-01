import {
  getProduct,
  isLongStay,
  type RentalProduct,
  weeklyRate,
} from "../model/catalog";
import type { PlacedItem } from "../model/types";
import type { CartEntry } from "./store";

export type SummaryLine = {
  product: RentalProduct;
  quantity: number;
  ratePerWeek: number;
  weeklyTotal: number;
  /** How many of the quantity are in the cart rather than in the room. */
  inCart: number;
};

export type Summary = {
  lines: SummaryLine[];
  itemCount: number;
  perWeek: number;
  deposit: number;
  total: number;
  weeks: number;
  /** Whether the stay earns the cheaper long-stay rate. */
  longStay: boolean;
};

/**
 * The bill covers the room and the cart alike: an item that could not fit is
 * still being rented, it just has nowhere to stand yet.
 */
export function summarize(
  items: PlacedItem[],
  cart: CartEntry[],
  weeks: number,
): Summary {
  const counts = new Map<string, { total: number; inCart: number }>();

  const tally = (productId: string, quantity: number, inCart: number) => {
    const current = counts.get(productId) ?? { total: 0, inCart: 0 };
    counts.set(productId, {
      total: current.total + quantity,
      inCart: current.inCart + inCart,
    });
  };

  for (const item of items) tally(item.productId, 1, 0);
  for (const entry of cart) {
    tally(entry.productId, entry.quantity, entry.quantity);
  }

  const lines: SummaryLine[] = [];
  for (const [productId, count] of counts) {
    const product = getProduct(productId);
    // Decor is staging only and never reaches checkout.
    if (!product) continue;
    const ratePerWeek = weeklyRate(product, weeks);
    lines.push({
      product,
      quantity: count.total,
      ratePerWeek,
      weeklyTotal: ratePerWeek * count.total,
      inCart: count.inCart,
    });
  }

  const perWeek = lines.reduce((sum, line) => sum + line.weeklyTotal, 0);
  const deposit = lines.reduce(
    (sum, line) => sum + (line.product.securityDeposit ?? 0) * line.quantity,
    0,
  );
  const itemCount = lines.reduce((sum, line) => sum + line.quantity, 0);

  return {
    lines,
    itemCount,
    perWeek,
    deposit,
    total: perWeek * weeks + deposit,
    weeks,
    longStay: isLongStay(weeks),
  };
}

export function formatUsd(amount: number): string {
  return amount.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  });
}

/** "1 week" or "4 weeks", so a one-week stay does not read "1 weeks". */
export function formatWeeks(weeks: number): string {
  return weeks === 1 ? "1 week" : `${weeks} weeks`;
}
