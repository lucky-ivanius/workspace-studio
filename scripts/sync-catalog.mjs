#!/usr/bin/env node
/**
 * Pulls the Bali catalogue from the monis.rent Strapi API and writes
 * src/features/studio/model/catalog.json.
 *
 *   pnpm catalog:sync
 *
 * The generated JSON is committed, so the app never depends on the API at build
 * or request time and the test suites stay hermetic.
 *
 * This script records what the storefront says and nothing more. Which products
 * appear in the room, and what they are drawn as, is curated in
 * src/features/studio/model/art.ts.
 *
 * Variants are deliberately ignored. A product is one rentable thing here.
 */

import { writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = resolve(ROOT, "src/features/studio/model/catalog.json");

const ORIGIN = "https://strapi.monis.rent";
const API = `${ORIGIN}/api`;
const STOREFRONT = "https://monis.rent";

/**
 * monis.rent runs a merchant per city off one Strapi, and the same product
 * exists once per city. The brief is Bali, so these two are the catalogue and
 * every other merchant's copy is a duplicate.
 */
const BALI_MERCHANTS = new Set(["monisrent", "gromrent"]);

async function fetchAll(path, params) {
  const results = [];

  for (let page = 1; ; page++) {
    const query = new URLSearchParams({
      "pagination[page]": String(page),
      "pagination[pageSize]": "100",
      ...params,
    });

    const response = await fetch(`${API}/${path}?${query}`);
    if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);

    const body = await response.json();
    if (!body.data) throw new Error(`${path}: ${JSON.stringify(body.error)}`);

    results.push(...body.data);
    if (page >= body.meta.pagination.pageCount) return results;
  }
}

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function number(value) {
  return typeof value === "number" ? value : null;
}

function relation(value) {
  const data = value?.data;
  if (!data) return [];
  return Array.isArray(data) ? data : [data];
}

function absolute(url) {
  return url.startsWith("http") ? url : `${ORIGIN}${url}`;
}

/**
 * Strapi pre-renders each upload at a few widths. Taking them means the dialog
 * never downloads a 920px original to fill a 240px card, and no image proxy is
 * needed on our side.
 */
function imageOf(entry) {
  const image = entry.attributes;
  const formats = image.formats ?? {};
  const pick = (...names) =>
    names.map((name) => formats[name]?.url).find(Boolean) ?? image.url;

  return {
    url: absolute(pick("medium", "large", "small")),
    thumbnailUrl: absolute(pick("thumbnail", "small")),
    width: image.width ?? 0,
    height: image.height ?? 0,
    alt: text(image.alternativeText) || text(image.caption),
  };
}

function productOf(entry) {
  const product = entry.attributes;
  const slug = text(product.slug);

  const categoryIds = relation(product.product_categories)
    .map((category) => text(category.attributes.slug))
    .filter(Boolean);

  return {
    id: slug,
    slug,
    name: text(product.name),
    brand: text(relation(product.product_brand)[0]?.attributes.brand) || null,
    summary: text(product.short_description),
    description: text(product.description),
    categoryIds,

    pricePerWeek: number(product.weekly_price),
    longStayPricePerWeek: number(product.over_one_month_weekly_price),
    monthlyPrice: number(product.monthly_price),
    discountPercent: number(product.sale),
    securityDeposit: number(product.security_deposit),
    setupCost: number(product.setup_cost),
    purchasePrice: number(product.purchase_price),
    /** The storefront's own merchandising rank. Lower comes first. */
    sortOrder: number(product.sort_order) ?? 9999,

    images: relation(product.images).map(imageOf),
    specs: (product.product_specs ?? [])
      .map((spec) => ({ label: text(spec.headline), value: text(spec.text) }))
      .filter((spec) => spec.label && spec.value),
    included: relation(product.product_whats_includeds)
      .map((item) => text(item.attributes.label))
      .filter(Boolean),
    tags: relation(product.product_tags)
      .map((tag) => text(tag.attributes.name))
      .filter(Boolean),

    productUrl: `${STOREFRONT}/products/${slug}`,
  };
}

/** A product is rentable here only if it has a name, a price and a picture. */
function isComplete(product) {
  return (
    product.slug !== "" &&
    product.name !== "" &&
    product.pricePerWeek !== null &&
    product.pricePerWeek > 0 &&
    product.images.length > 0
  );
}

const [rawCategories, rawProducts] = await Promise.all([
  fetchAll("product-categories", {}),
  fetchAll("products", {
    "populate[images]": "*",
    "populate[product_categories]": "*",
    "populate[product_specs]": "*",
    "populate[product_whats_includeds]": "*",
    "populate[product_brand]": "*",
    "populate[product_tags]": "*",
    "populate[merchant]": "*",
  }),
]);

const skipped = { offStore: 0, nonBali: 0, incomplete: 0 };

const products = [];
for (const entry of rawProducts) {
  const attributes = entry.attributes;

  if (!attributes.show_product_in_store || attributes.state !== "active") {
    skipped.offStore += 1;
    continue;
  }

  const merchant = relation(attributes.merchant)[0]?.attributes.slug;
  if (!BALI_MERCHANTS.has(merchant)) {
    skipped.nonBali += 1;
    continue;
  }

  const product = productOf(entry);
  if (!isComplete(product)) {
    skipped.incomplete += 1;
    process.stdout.write(`  skip  ${product.slug || entry.id} (incomplete)\n`);
    continue;
  }

  products.push(product);
}

// The storefront's own merchandising order, which leads with the things a
// workspace is actually built from rather than the cheapest cable.
products.sort(
  (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
);

const stocked = new Set(products.flatMap((product) => product.categoryIds));

const categories = rawCategories
  .map((entry) => entry.attributes)
  .filter((category) => category.state === "active")
  .map((category) => ({
    id: text(category.slug),
    name: text(category.name),
    description: text(category.short_description),
    sortOrder: number(category.sort_product_categories) ?? 999,
  }))
  .filter((category) => stocked.has(category.id))
  .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));

await writeFile(
  OUT,
  `${JSON.stringify(
    {
      source: API,
      syncedAt: new Date().toISOString(),
      categories,
      products,
    },
    null,
    2,
  )}\n`,
);

process.stdout.write(
  `\nWrote ${products.length} products in ${categories.length} categories to ${OUT}\n` +
    `  skipped ${skipped.nonBali} outside Bali, ${skipped.offStore} off-store, ` +
    `${skipped.incomplete} incomplete\n` +
    `\nArt and placeability are curated in model/art.ts; run pnpm test to see\n` +
    `whether this sync left any of it pointing at a product that no longer exists.\n`,
);
