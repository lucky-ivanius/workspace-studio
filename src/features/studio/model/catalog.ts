import { artFor } from "./art";
import { getAsset } from "./assets";
import catalog from "./catalog.json";

/**
 * The Bali catalogue, synced from the monis.rent Strapi API by
 * `pnpm catalog:sync`. Prices are USD per week straight from the storefront.
 *
 * Variants are not modelled: a product is one rentable thing.
 */
export type ProductImage = {
  /** Card and gallery size, around 750px. */
  url: string;
  /** Thumbnail strip size, around 156px. */
  thumbnailUrl: string;
  width: number;
  height: number;
  alt: string;
};

export type ProductSpec = {
  label: string;
  value: string;
};

export type RentalProduct = {
  id: string;
  /** Matches the monis.rent product slug, and is the id. */
  slug: string;
  name: string;
  brand: string | null;
  /** One-line pitch, as shown on a product card. */
  summary: string;
  description: string;
  /** Strapi category slugs. A product may sit in more than one. */
  categoryIds: string[];
  /** Weekly rate for stays under one month. */
  pricePerWeek: number;
  /** Weekly rate once the rental runs past one month. */
  longStayPricePerWeek: number | null;
  monthlyPrice: number | null;
  discountPercent: number | null;
  securityDeposit: number | null;
  setupCost: number | null;
  purchasePrice: number | null;
  /** The storefront's merchandising rank. Lower comes first. */
  sortOrder: number;
  images: ProductImage[];
  specs: ProductSpec[];
  /** What arrives in the box. */
  included: string[];
  tags: string[];
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
  summary: string;
};

export type CatalogCategory = {
  id: string;
  name: string;
  description: string;
};

export const CATALOG_SOURCE = catalog.source;
export const CATALOG_SYNCED_AT = catalog.syncedAt;

export const PRODUCTS = catalog.products as RentalProduct[];

/** Staging sits in its own category rather than one of monis.rent's. */
export const STAGING_CATEGORY_ID = "staging";

export const DECOR: DecorItem[] = [
  {
    id: "plant-monstera",
    assetId: "plant-monstera",
    name: "Monstera",
    summary: "A big leafy plant for the corner. Sets the scene, not rented.",
  },
  {
    id: "rug-woven",
    assetId: "rug-woven",
    name: "Woven Rug",
    summary: "Warms up the floor under a desk. Sets the scene, not rented.",
  },
];

export const CATALOG_CATEGORIES: CatalogCategory[] = [
  ...(catalog.categories as CatalogCategory[]),
  {
    id: STAGING_CATEGORY_ID,
    name: "Staging",
    description:
      "Props that make the room feel lived in. Never part of the rental.",
  },
];

const BY_ID = new Map(PRODUCTS.map((product) => [product.id, product]));
const DECOR_BY_ID = new Map(DECOR.map((item) => [item.id, item]));
const CATEGORY_BY_ID = new Map(
  CATALOG_CATEGORIES.map((category) => [category.id, category]),
);

export function getProduct(id: string): RentalProduct | undefined {
  return BY_ID.get(id);
}

export function getDecor(id: string): DecorItem | undefined {
  return DECOR_BY_ID.get(id);
}

export function getCategory(id: string): CatalogCategory | undefined {
  return CATEGORY_BY_ID.get(id);
}

export function assetIdFor(id: string): string | undefined {
  const product = BY_ID.get(id);
  if (product) return artFor(product);
  return DECOR_BY_ID.get(id)?.assetId;
}

/** Name for any catalog id, rental or staging. Falls back to the id itself. */
export function displayName(id: string): string {
  return BY_ID.get(id)?.name ?? DECOR_BY_ID.get(id)?.name ?? id;
}

/** The "From $X/week" figure the storefront shows. */
export function fromPricePerWeek(product: RentalProduct): number {
  return product.longStayPricePerWeek ?? product.pricePerWeek;
}

export function weeklyRate(product: RentalProduct, weeks: number): number {
  return weeks > 4 ? fromPricePerWeek(product) : product.pricePerWeek;
}

/**
 * One card in the add dialog, flattening rentals and staging into one shape so
 * the grid does not have to care which it is showing.
 */
export type CatalogItem = {
  id: string;
  name: string;
  summary: string;
  categoryIds: string[];
  /** Weekly rate, or null for staging items that never reach checkout. */
  pricePerWeek: number | null;
  discountPercent: number | null;
  imageUrl: string;
  /**
   * Whether the item is drawn in the room at all. A cart-only product is still
   * rented and still billed, it simply never appears on the canvas.
   */
  placeable: boolean;
  /** Whether the item needs a desk to stand on. */
  needsDesk: boolean;
  /** Lowercased name, brand, summary and tags, for the search box. */
  haystack: string;
  /** Absent for staging, which has no storefront page or spec sheet. */
  product: RentalProduct | null;
};

function haystackOf(parts: Array<string | null>): string {
  return parts.filter(Boolean).join(" ").toLowerCase();
}

function itemOf(product: RentalProduct): CatalogItem {
  const assetId = artFor(product);
  const asset = assetId === undefined ? undefined : getAsset(assetId);

  return {
    id: product.id,
    name: product.name,
    summary: product.summary,
    categoryIds: product.categoryIds,
    pricePerWeek: fromPricePerWeek(product),
    discountPercent: product.discountPercent,
    imageUrl: product.images[0]?.url ?? "",
    placeable: asset !== undefined,
    needsDesk: asset?.surface === "desk",
    haystack: haystackOf([
      product.name,
      product.brand,
      product.summary,
      ...product.tags,
      ...product.categoryIds.map((id) => getCategory(id)?.name ?? null),
    ]),
    product,
  };
}

function itemOfDecor(item: DecorItem): CatalogItem {
  const asset = getAsset(item.assetId);
  return {
    id: item.id,
    name: item.name,
    summary: item.summary,
    categoryIds: [STAGING_CATEGORY_ID],
    pricePerWeek: null,
    discountPercent: null,
    // Its own studio art, which is exactly what will appear in the room.
    imageUrl: asset.src,
    placeable: true,
    needsDesk: asset.surface === "desk",
    haystack: haystackOf([item.name, item.summary, "staging"]),
    product: null,
  };
}

export const CATALOG_ITEMS: CatalogItem[] = [
  ...PRODUCTS.map(itemOf),
  ...DECOR.map(itemOfDecor),
];

/** The items a desk can host, for the add menu on a selected desk. */
export const DESK_ITEMS: CatalogItem[] = CATALOG_ITEMS.filter(
  (item) => item.needsDesk,
);

export function itemsIn(items: CatalogItem[], categoryId: string | null) {
  if (categoryId === null) return items;
  return items.filter((item) => item.categoryIds.includes(categoryId));
}

/** Every word in the query has to appear somewhere in the item. */
export function searchItems(items: CatalogItem[], query: string) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return items;
  return items.filter((item) =>
    words.every((word) => item.haystack.includes(word)),
  );
}

/** Categories that still hold something, with how many, for the filter rail. */
export function categoriesOf(items: CatalogItem[]) {
  const counts = new Map<string, number>();
  for (const item of items) {
    for (const id of item.categoryIds) {
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }

  return CATALOG_CATEGORIES.filter((category) => counts.has(category.id)).map(
    (category) => ({ ...category, count: counts.get(category.id) ?? 0 }),
  );
}
