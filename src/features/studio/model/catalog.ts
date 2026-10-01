import { getAsset } from "./assets";
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

/** Name for any catalog id, rental or staging. Falls back to the id itself. */
export function displayName(id: string): string {
  return BY_ID.get(id)?.name ?? DECOR_BY_ID.get(id)?.name ?? id;
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

/** One row in the add-item dialog, flattening rentals and staging into one shape. */
export type CatalogEntry = {
  id: string;
  name: string;
  description: string;
  /** Weekly rate, or null for staging items that never reach checkout. */
  pricePerWeek: number | null;
  /** Whether the item needs a desk to stand on. */
  needsDesk: boolean;
};

export type CatalogGroup = {
  /** Tab value, and the key the desk menu keys off. */
  id: string;
  label: string;
  /** Wording for the desk menu, e.g. "Add monitor". */
  addLabel: string;
  entries: CatalogEntry[];
};

const GROUPS: {
  id: string;
  label: string;
  addLabel: string;
  category: ProductCategory;
}[] = [
  { id: "desk", label: "Desks", addLabel: "Add desk", category: "desk" },
  { id: "chair", label: "Chairs", addLabel: "Add chair", category: "chair" },
  {
    id: "monitor",
    label: "Monitors",
    addLabel: "Add monitor",
    category: "monitor",
  },
  {
    id: "lighting",
    label: "Lighting",
    addLabel: "Add lamp",
    category: "lighting",
  },
  { id: "extras", label: "Extras", addLabel: "Add extra", category: "extras" },
];

function entryOf(product: RentalProduct): CatalogEntry {
  return {
    id: product.id,
    name: product.name,
    description: product.description,
    pricePerWeek: fromPricePerWeek(product),
    needsDesk: getAsset(product.assetId).surface === "desk",
  };
}

export const CATALOG_GROUPS: CatalogGroup[] = [
  ...GROUPS.map((group) => ({
    id: group.id,
    label: group.label,
    addLabel: group.addLabel,
    entries: productsIn(group.category).map(entryOf),
  })),
  {
    id: "staging",
    label: "Staging",
    addLabel: "Add staging",
    entries: DECOR.map((item) => ({
      id: item.id,
      name: item.name,
      description: "Sets the scene. Not part of the rental.",
      pricePerWeek: null,
      needsDesk: getAsset(item.assetId).surface === "desk",
    })),
  },
].filter((group) => group.entries.length > 0);

/** The groups a desk can host, for the menu on a selected desk. */
export const DESK_GROUPS: CatalogGroup[] = CATALOG_GROUPS.map((group) => ({
  ...group,
  entries: group.entries.filter((entry) => entry.needsDesk),
})).filter((group) => group.entries.length > 0);
