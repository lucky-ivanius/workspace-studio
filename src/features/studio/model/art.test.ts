import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { ASSET_LIST, artFor, artOf, artProblems } from "./art";
import artIndex from "./art-index.json";
import { CATALOG_ITEMS, DECOR, PRODUCTS } from "./catalog";

const ART_DIR = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../public/assets/studio",
);

test("catalog.json has nothing wrong with it", () => {
  // One assertion for every rule the data has to follow. The messages are the
  // documentation: if this fails, read it and fix the entry it names.
  assert.deepEqual(artProblems(), []);
});

test("the art index matches the folder", () => {
  const onDisk = readdirSync(ART_DIR)
    .filter((file) => file.endsWith(".png"))
    .map((file) => file.slice(0, -".png".length))
    .sort();

  assert.deepEqual(
    artIndex.names,
    onDisk,
    "art-index.json has drifted from public/assets/studio. Run pnpm art:index.",
  );
});

test("a product is drawn with art named after its slug", () => {
  // The whole point: the PNG is called electrical-adjustable-desk.png, and
  // nothing anywhere had to say so.
  assert.equal(
    artFor("electrical-adjustable-desk")?.id,
    "electrical-adjustable-desk",
  );
});

test("a product can borrow a drawing shared with its siblings", () => {
  // Six 27" panels look the same on an isometric desk whoever made them.
  assert.equal(artFor("27-4-k-multimedia-monitor")?.id, "monitor-27-4k");
  assert.equal(artFor("apple-studio-display")?.id, "monitor-27-4k");
});

test("a placeable product with no art of its own borrows its category's stand-in", () => {
  // Which is what lets a hundred-odd products share a handful of drawings.
  assert.equal(
    artOf({
      id: "nothing-drawn-for-this-yet",
      categoryIds: ["computer"],
      studio: { placeable: true },
    })?.id,
    "generic-desk-medium",
  );

  // The first category that carries a stand-in wins, so a product in two of
  // them is drawn as the kind of thing it is listed under first.
  assert.equal(
    artOf({
      id: "nothing-drawn-for-this-yet",
      categoryIds: ["monitors", "gaming"],
      studio: { placeable: true },
    })?.id,
    "generic-screen",
  );
});

test("art of its own wins the moment the PNG exists", () => {
  // The whole point. Nothing but the file name says this drawing belongs to
  // this product, so dropping monitor-27-4k.png in as apple-mac-studio.png
  // would be the entire change.
  const borrowed = artOf({
    id: "apple-mac-studio",
    categoryIds: ["computer"],
    studio: { placeable: true },
  });
  assert.equal(borrowed?.id, "generic-desk-medium");

  const own = artOf({
    id: "plant-monstera",
    categoryIds: ["computer"],
    studio: { placeable: true },
  });
  assert.equal(own?.id, "plant-monstera");
});

test("a product is drawn as nothing until it is marked placeable", () => {
  // Cables, consumables and anything held in the hand: adding one puts it
  // straight in the cart.
  assert.equal(artFor("hdmi-2-0-cable"), undefined);
});

test("an id nothing in the catalogue carries is drawn as nothing", () => {
  assert.equal(artFor("mystery-box"), undefined);
});

test("a product's own measurements shape its own art", () => {
  const desk = artFor("electrical-adjustable-desk");
  assert.ok(desk);

  assert.deepEqual(desk.footprint, { w: 8, d: 4 });
  assert.equal(desk.heightCm, 75);
  assert.equal(desk.surface, "floor");
  // 75 cm of desk, so anything placed on it is raised by 120 design px.
  assert.equal(desk.deskSurface?.elevation, 120);
});

test("the room never loads art nothing points at", () => {
  const drawn = new Set(ASSET_LIST.map((spec) => spec.id));

  const reachable = new Set(
    [...PRODUCTS.map((product) => product.id), ...DECOR.map((item) => item.id)]
      .map((id) => artFor(id)?.id)
      .filter((id): id is string => id !== undefined),
  );

  assert.deepEqual([...drawn].sort(), [...reachable].sort());
});

test("every placeable catalog item has art, and every other has none", () => {
  for (const item of CATALOG_ITEMS) {
    const asset = artFor(item.id);
    assert.equal(
      item.placeable,
      asset !== undefined,
      `${item.id}: placeable and art disagree`,
    );
  }
});

test("the desk, the chair and the monitors a workspace is built from are placeable", () => {
  for (const id of [
    "electrical-adjustable-desk",
    "ergonomic-office-chair",
    "27-4-k-multimedia-monitor",
    "smart-led-desk-lamp-1-s",
    "plant-monstera",
  ]) {
    const item = CATALOG_ITEMS.find((candidate) => candidate.id === id);
    assert.ok(item, `${id} is missing from the catalogue`);
    assert.ok(item.placeable, `${id} should be placeable`);
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

test("an unclassified product stands on the floor rather than on a desk", () => {
  // A desk stand-in would refuse to be added until a desk existed, which is a
  // poor guess to make about a category nobody has classified yet.
  const asset = artOf({
    id: "mystery-box",
    categoryIds: ["submarines"],
    studio: { placeable: true },
  });

  assert.equal(asset?.id, "generic-floor-small");
  assert.equal(asset?.surface, "floor");
});

test("art of its own is shaped by the stand-in it replaces until told otherwise", () => {
  // Dropping monitor-27-4k.png in as a product's own art, with nothing but
  // placeable set, gets the monitor stand-in's shape rather than a guess.
  const asset = artOf({
    id: "monitor-27-4k",
    categoryIds: ["monitors"],
    studio: { placeable: true },
  });

  assert.equal(asset?.id, "monitor-27-4k");
  assert.deepEqual(asset?.footprint, { w: 3, d: 1 });
  assert.equal(asset?.heightCm, 45);
});
