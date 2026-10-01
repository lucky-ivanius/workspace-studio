import assert from "node:assert/strict";
import { test } from "node:test";
import { ART_BY_SLUG, artFor, CART_ONLY_SLUGS } from "./art";
import { ASSETS } from "./assets";
import { CATALOG_ITEMS, PRODUCTS } from "./catalog";

test("a product with bespoke art is drawn as that art", () => {
  assert.equal(
    artFor({
      slug: "electrical-adjustable-desk",
      categoryIds: ["furniture"],
    }),
    "desk-electric-standing",
  );
});

test("a placeable product without art falls back to its category's stand-in", () => {
  assert.equal(
    artFor({ slug: "apple-mac-studio", categoryIds: ["computer"] }),
    "generic-desk-medium",
  );

  // The first category that carries a rule wins, so a product in two of them is
  // drawn as the kind of thing it is listed under first.
  assert.equal(
    artFor({ slug: "whatever", categoryIds: ["monitors", "gaming"] }),
    "generic-screen",
  );
});

test("a product in no known category stands on the floor rather than a desk", () => {
  // A desk stand-in would refuse to be added until a desk existed, which is a
  // poor guess to make about a category nobody has classified yet.
  const assetId = artFor({ slug: "mystery-box", categoryIds: ["submarines"] });
  assert.ok(assetId);
  assert.equal(ASSETS[assetId].surface, "floor");
});

test("a cart-only product is drawn as nothing at all", () => {
  assert.equal(
    artFor({ slug: "hdmi-2-0-cable", categoryIds: ["office-accessories"] }),
    undefined,
  );
});

test("every art mapping points at an asset that exists", () => {
  for (const [slug, assetId] of Object.entries(ART_BY_SLUG)) {
    assert.ok(ASSETS[assetId], `${slug} maps to unknown asset "${assetId}"`);
  }
});

test("every curated slug still names a product in the catalogue", () => {
  const slugs = new Set(PRODUCTS.map((product) => product.slug));

  for (const slug of Object.keys(ART_BY_SLUG)) {
    assert.ok(slugs.has(slug), `art is mapped for missing product "${slug}"`);
  }

  for (const slug of CART_ONLY_SLUGS) {
    assert.ok(slugs.has(slug), `cart-only names missing product "${slug}"`);
  }
});

test("every placeable catalog item resolves to a real asset", () => {
  for (const item of CATALOG_ITEMS) {
    if (!item.placeable) continue;

    const assetId = artFor({ slug: item.id, categoryIds: item.categoryIds });
    // Staging has its own art rather than a product slug, so it is exempt.
    if (item.product === null) continue;

    assert.ok(assetId, `${item.id} is placeable with nothing to draw`);
    assert.ok(ASSETS[assetId], `${item.id} maps to unknown asset "${assetId}"`);
  }
});

test("the desk, the chair and the monitors a workspace is built from are placeable", () => {
  for (const slug of [
    "electrical-adjustable-desk",
    "ergonomic-office-chair",
    "27-4-k-multimedia-monitor",
    "smart-led-desk-lamp-1-s",
  ]) {
    const item = CATALOG_ITEMS.find((candidate) => candidate.id === slug);
    assert.ok(item, `${slug} is missing from the catalogue`);
    assert.ok(item.placeable, `${slug} should be placeable`);
  }
});

test("a cart-only product never asks for a desk", () => {
  // needsDesk is what the desk's own picker filters on, so a cable must not
  // show up in a list titled "everything here fits on a desk".
  for (const item of CATALOG_ITEMS) {
    if (item.placeable) continue;
    assert.equal(item.needsDesk, false, `${item.id} should not need a desk`);
  }
});
