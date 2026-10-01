#!/usr/bin/env node
/**
 * Pulls the Bali catalogue from the monis.rent Strapi API into
 * src/features/studio/model/catalog.json.
 *
 *   pnpm catalog:sync
 *
 * monis.rent is a seed, not the source of truth. Everything outside a `studio`
 * block is theirs and is overwritten on every run; every `studio` block is ours,
 * written by hand, and is carried across untouched — along with the whole `decor`
 * list and the top-level `studio` section, which they know nothing about.
 *
 * A product the API has never shown before arrives with `placeable: false`, so a
 * sync can never put something in the room that nobody has looked at.
 *
 * The generated JSON is committed, so the app never depends on the API at build
 * or request time and the test suites stay hermetic.
 *
 * Variants are deliberately ignored. A product is one rentable thing here.
 */

import { readFile, writeFile } from "node:fs/promises";
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

/**
 * Everything in the current file that is ours rather than the storefront's. A
 * first run has none of it, which is why every lookup falls back.
 */
const existing = JSON.parse(await readFile(OUT, "utf8").catch(() => "{}"));

const curated = {
  studio: existing.studio ?? { drawings: [], fallbackDrawing: null },
  decor: existing.decor ?? [],
  byProduct: new Map(
    (existing.products ?? []).map((product) => [product.slug, product.studio]),
  ),
  byCategory: new Map(
    (existing.categories ?? []).map((category) => [
      category.id,
      category.studio,
    ]),
  ),
};

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

/**
 * `studio` sits right under the slug rather than at the end of the entry: it is
 * the half of the record a person edits, and a product's description alone can
 * run to forty lines.
 */
const fresh = [];
const withStudio = products.map((product) => {
  const { id, slug, ...rest } = product;
  const studio = curated.byProduct.get(slug);
  if (!studio) fresh.push(slug);

  return { id, slug, studio: studio ?? { placeable: false }, ...rest };
});

/** Curation for a product the storefront has stopped carrying is dead weight. */
const kept = new Set(withStudio.map((product) => product.slug));
const dropped = [...curated.byProduct]
  .filter(([slug, studio]) => studio?.placeable && !kept.has(slug))
  .map(([slug]) => slug);

await writeFile(
  OUT,
  `${JSON.stringify(
    {
      source: API,
      syncedAt: new Date().toISOString(),
      studio: curated.studio,
      categories: categories.map((category) => ({
        ...category,
        studio: curated.byCategory.get(category.id) ?? { generic: null },
      })),
      products: withStudio,
      decor: curated.decor,
    },
    null,
    2,
  )}\n`,
);

const list = (slugs) =>
  slugs.map((slug) => `    ${slug}\n`).join("") || "    none\n";

process.stdout.write(
  `\nWrote ${withStudio.length} products in ${categories.length} categories to ${OUT}\n` +
    `  skipped ${skipped.nonBali} outside Bali, ${skipped.offStore} off-store, ` +
    `${skipped.incomplete} incomplete\n` +
    `\n  new, and cart-only until you say otherwise:\n${list(fresh)}` +
    `\n  gone from the storefront, so their curation went with them:\n${list(dropped)}` +
    `\nEvery studio block was carried across. Run pnpm test: it reads them back\n` +
    `and names anything the catalogue can no longer draw.\n`,
);
