#!/usr/bin/env node
/**
 * Pulls live product data from monis.rent and writes src/features/studio/model/catalog.json.
 *
 * monis.rent has no public API, so this reads the fields the product pages embed
 * in their RSC payload. Run it whenever the catalog needs refreshing:
 *
 *   pnpm catalog:sync
 *
 * The generated JSON is committed, so the app never depends on the scrape at
 * build or request time.
 */

import { writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = resolve(ROOT, "src/features/studio/model/catalog.json");
const ORIGIN = "https://monis.rent";

/** Every studio product, keyed by the monis.rent slug it renders. */
const SOURCES = [
  {
    slug: "electrical-adjustable-desk",
    assetId: "desk-electric-standing",
    category: "desk",
  },
  {
    slug: "adjustable-wooden-desk",
    assetId: "desk-mechanical-wooden",
    category: "desk",
  },
  {
    slug: "dual-motor-electric-standing-desk",
    assetId: "desk-dual-motor",
    category: "desk",
  },
  {
    slug: "ergonomic-office-chair",
    assetId: "chair-ergonomic-mesh",
    category: "chair",
  },
  {
    slug: "24-full-hd-office-monitor-a24i-2026",
    assetId: "monitor-24-fhd",
    category: "monitor",
  },
  {
    slug: "27-4-k-multimedia-monitor",
    assetId: "monitor-27-4k",
    category: "monitor",
  },
  {
    slug: "34-4-k-curved-monitor-180-hz",
    assetId: "monitor-34-ultrawide",
    category: "monitor",
  },
  {
    slug: "smart-led-desk-lamp-1-s",
    assetId: "lamp-smart-led",
    category: "lighting",
  },
  {
    slug: "ergonomic-laptop-stand",
    assetId: "laptop-stand",
    category: "extras",
  },
  { slug: "logitech-mx-keyboard", assetId: "keyboard-mx", category: "extras" },
  {
    slug: "nespresso-essenza-coffee-machine",
    assetId: "coffee-machine",
    category: "extras",
  },
  {
    slug: "marshall-woburn-ii-bluetooth",
    assetId: "speaker-marshall",
    category: "extras",
  },
];

/**
 * Walks outward from `index` to the smallest enclosing `{...}` that parses as
 * JSON. Brace counting alone is not reliable inside embedded payloads, so the
 * parse itself is the validation step.
 */
function enclosingObject(html, index) {
  let depth = 0;
  for (let start = index; start >= 0; start--) {
    const char = html[start];
    if (char === "}") depth++;
    else if (char === "{") {
      if (depth === 0) {
        const parsed = parseFrom(html, start);
        if (parsed && parsed.end > index) return parsed.value;
      } else depth--;
    }
  }
  return undefined;
}

function parseFrom(html, start) {
  let depth = 0;
  let inString = false;
  for (let i = start; i < html.length; i++) {
    const char = html[i];
    if (inString) {
      if (char === "\\") i++;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === "{") depth++;
    else if (char === "}") {
      depth--;
      if (depth === 0) {
        try {
          return { value: JSON.parse(html.slice(start, i + 1)), end: i };
        } catch {
          return undefined;
        }
      }
    }
  }
  return undefined;
}

function number(value) {
  return typeof value === "number" ? value : null;
}

async function scrape({ slug, assetId, category }) {
  const url = `${ORIGIN}/products/${slug}`;
  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok) throw new Error(`${slug}: HTTP ${response.status}`);

  const html = await response.text();
  const index = html.indexOf(`"slug":"${slug}"`);
  if (index === -1) throw new Error(`${slug}: product payload not found`);

  const product = enclosingObject(html, index);
  if (!product) throw new Error(`${slug}: could not parse product payload`);

  const weeklyCents = number(product.stripe_weekly_full_price_amount);
  if (weeklyCents === null) throw new Error(`${slug}: no weekly price`);

  return {
    id: assetId,
    slug,
    assetId,
    category,
    name: typeof product.name === "string" ? product.name : slug,
    description:
      typeof product.description === "string" ? product.description : "",
    pricePerWeek: weeklyCents / 100,
    longStayPricePerWeek: number(product.over_one_month_weekly_price),
    monthlyPrice: number(product.monthly_price),
    discountPercent: number(product.sale),
    securityDeposit: number(product.security_deposit),
    productUrl: url,
  };
}

const results = [];
const failures = [];

for (const source of SOURCES) {
  try {
    results.push(await scrape(source));
    process.stdout.write(`  ok   ${source.slug}\n`);
  } catch (error) {
    failures.push(source.slug);
    process.stdout.write(`  fail ${source.slug} — ${error.message}\n`);
  }
}

await writeFile(
  OUT,
  `${JSON.stringify({ source: ORIGIN, syncedAt: new Date().toISOString(), products: results }, null, 2)}\n`,
);

process.stdout.write(`\nWrote ${results.length} products to ${OUT}\n`);
if (failures.length > 0) {
  process.stdout.write(`Failed: ${failures.join(", ")}\n`);
  process.exitCode = 1;
}
