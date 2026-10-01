import catalog from "./catalog.json";
import type { ProductCategory } from "./types";

/**
 * Rentable items, synced from monis.rent by `pnpm catalog:sync`.
 * Prices are USD and come straight from the storefront.
 */
export type RentalProduct = {
  id: string;
  slug: string;
  assetId: string;
  category: ProductCategory;
  name: string;
  description: string;
  /** Weekly rate for stays under one month. */
  pricePerWeek: number;
  /** Weekly rate once the rental runs past one month. */
  longStayPricePerWeek: number | null;
  monthlyPrice: number | null;
  discountPercent: number | null;
  securityDeposit: number | null;
  productUrl: string;
};

/**
 * Staging items that make a setup feel like a room. They are not rented, so
 * they carry no price and never reach checkout.
 */
export type DecorItem = {
  id: string;
  assetId: string;
  name: string;
};

export const CATALOG_SOURCE = catalog.source;
export const CATALOG_SYNCED_AT = catalog.syncedAt;

export const PRODUCTS = catalog.products as RentalProduct[];

export const DECOR: DecorItem[] = [
  { id: "plant-monstera", assetId: "plant-monstera", name: "Monstera" },
  { id: "rug-woven", assetId: "rug-woven", name: "Woven Rug" },
];

const BY_ID = new Map(PRODUCTS.map((product) => [product.id, product]));
const DECOR_BY_ID = new Map(DECOR.map((item) => [item.id, item]));

export function getProduct(id: string): RentalProduct | undefined {
  return BY_ID.get(id);
}

export function getDecor(id: string): DecorItem | undefined {
  return DECOR_BY_ID.get(id);
}

export function assetIdFor(id: string): string | undefined {
  return BY_ID.get(id)?.assetId ?? DECOR_BY_ID.get(id)?.assetId;
}

export function productsIn(category: ProductCategory): RentalProduct[] {
  return PRODUCTS.filter((product) => product.category === category);
}

/** The "From $X/week" figure the storefront shows. */
export function fromPricePerWeek(product: RentalProduct): number {
  return product.longStayPricePerWeek ?? product.pricePerWeek;
}

export function weeklyRate(product: RentalProduct, weeks: number): number {
  return weeks > 4 ? fromPricePerWeek(product) : product.pricePerWeek;
}
