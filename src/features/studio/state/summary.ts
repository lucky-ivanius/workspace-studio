import { getProduct, type RentalProduct, weeklyRate } from "../model/catalog";
import type { PlacedItem } from "../model/types";

export type SummaryLine = {
  product: RentalProduct;
  quantity: number;
  ratePerWeek: number;
  weeklyTotal: number;
};

export type Summary = {
  lines: SummaryLine[];
  itemCount: number;
  perWeek: number;
  deposit: number;
  total: number;
  weeks: number;
};

export function summarize(items: PlacedItem[], weeks: number): Summary {
  const counts = new Map<string, number>();
  for (const item of items) {
    counts.set(item.productId, (counts.get(item.productId) ?? 0) + 1);
  }

  const lines: SummaryLine[] = [];
  for (const [productId, quantity] of counts) {
    const product = getProduct(productId);
    // Decor is staging only and never reaches checkout.
    if (!product) continue;
    const ratePerWeek = weeklyRate(product, weeks);
    lines.push({
      product,
      quantity,
      ratePerWeek,
      weeklyTotal: ratePerWeek * quantity,
    });
  }

  lines.sort((a, b) => b.weeklyTotal - a.weeklyTotal);

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
  };
}

export function formatUsd(amount: number): string {
  return amount.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  });
}
