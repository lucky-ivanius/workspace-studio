/**
 * Which catalogue entries the room draws, and what they are drawn as.
 *
 * Every decision lives in catalog.json, in a `studio` block on the entry.
 * monis.rent only seeds that file; the `studio` blocks are ours, written by hand,
 * and `pnpm catalog:sync` preserves them. So putting a PNG in
 * `public/assets/studio` and flipping one flag is the whole of adding art — no
 * code changes, no mapping table.
 *
 * How an entry is drawn, in order:
 *
 * 1. `placeable: false`, or no `studio` block at all — not drawn. Adding it puts
 *    it straight in the cart.
 * 2. `art: "some-drawing"` — a drawing shared with near-identical siblings, which
 *    declares its own shape under `studio.drawings`. A 27" panel looks the same
 *    on an isometric desk whoever made it.
 * 3. `public/assets/studio/<slug>.png` exists — its own art, shaped by whatever
 *    the entry declares and otherwise by its category's stand-in.
 * 4. Otherwise — its category's stand-in, so a product is placeable the moment
 *    it is marked so, with or without art.
 *
 * The file listing comes from art-index.json, written by `pnpm art:index`: this
 * module runs in the browser, so it cannot look in the folder itself.
 */

import artIndex from "./art-index.json";
import { isoAsset } from "./assets";
import catalog from "./catalog.json";
import type { ArtShape, AssetSpec, Drawing, StudioAttributes } from "./types";

/**
 * catalog.json is hand-edited, so its curated half is read through one declared
 * shape rather than trusted field by field. `artProblems` is the guard: it names
 * every mistake in the data and `art.test.ts` fails on any of them.
 */
const data = catalog as unknown as {
  studio: {
    /** Drawings shared by more than one entry, or borrowed as stand-ins. */
    drawings: Drawing[];
    /** The stand-in for a category that names none. */
    fallbackDrawing: string;
  };
  categories: Array<{ id: string; studio?: { generic?: string | null } }>;
  products: Array<{
    slug: string;
    categoryIds: string[];
    studio?: StudioAttributes;
  }>;
  decor: Array<{ id: string; studio?: StudioAttributes }>;
};

/** The art on disk, by name without the extension. */
const ON_DISK: ReadonlySet<string> = new Set(artIndex.names);

const DRAWINGS = new Map(
  data.studio.drawings.map((drawing) => [drawing.id, drawing]),
);

const GENERIC_BY_CATEGORY = new Map(
  data.categories.flatMap((category) => {
    const generic = category.studio?.generic;
    return generic ? [[category.id, generic] as const] : [];
  }),
);

/**
 * A product whose categories carry no stand-in stands on the floor rather than
 * on a desk. A desk stand-in would demand a desk before the product could be
 * added at all, which is a poor guess to make about a category nobody has
 * classified yet.
 *
 * Without this one drawing there is nothing to draw an unclassified product as,
 * so a missing fallback is a broken catalogue rather than a reportable problem.
 */
function fallbackDrawing(): Drawing {
  const drawing = DRAWINGS.get(data.studio.fallbackDrawing);
  if (drawing) return drawing;

  throw new Error(
    `catalog.json names "${data.studio.fallbackDrawing}" as its fallback ` +
      `drawing, but studio.drawings does not declare it.`,
  );
}

const FALLBACK = fallbackDrawing();

/** What an entry looks like to this module: an id, categories, and intent. */
export type ArtSubject = {
  /** The entry's catalogue id, which is also the name its own art would have. */
  id: string;
  categoryIds: string[];
  studio: StudioAttributes | undefined;
};

function standInFor(categoryIds: string[]): Drawing {
  for (const id of categoryIds) {
    const name = GENERIC_BY_CATEGORY.get(id);
    const drawing = name === undefined ? undefined : DRAWINGS.get(name);
    if (drawing) return drawing;
  }

  return FALLBACK;
}

/** The entry's own measurements, falling back to the stand-in it replaces. */
function shapeOf(studio: StudioAttributes, standIn: ArtShape): ArtShape {
  return {
    footprint: studio.footprint ?? standIn.footprint,
    heightCm: studio.heightCm ?? standIn.heightCm,
    surface: studio.surface ?? standIn.surface,
    seat: studio.seat ?? standIn.seat,
    flat: studio.flat ?? standIn.flat,
    surfaceHeightCm: studio.surfaceHeightCm ?? standIn.surfaceHeightCm,
  };
}

/**
 * The four rules at the top of this file, applied. Exported so the rules can be
 * read and tested on their own, without a product that happens to exercise them.
 */
export function artOf({
  id,
  categoryIds,
  studio,
}: ArtSubject): AssetSpec | undefined {
  if (!studio?.placeable) return undefined;

  const shared =
    studio.art === undefined ? undefined : DRAWINGS.get(studio.art);
  if (shared) return isoAsset(shared);

  const standIn = standInFor(categoryIds);
  if (ON_DISK.has(id)) return isoAsset({ id, ...shapeOf(studio, standIn) });

  return isoAsset(standIn);
}

const SUBJECTS: ArtSubject[] = [
  ...data.products.map((product) => ({
    id: product.slug,
    categoryIds: product.categoryIds,
    studio: product.studio,
  })),
  ...data.decor.map((item) => ({
    id: item.id,
    categoryIds: [],
    studio: item.studio,
  })),
];

const BY_CATALOG_ID = new Map<string, AssetSpec>();
const BY_ASSET_ID = new Map<string, AssetSpec>();
const SUBJECT_BY_ID = new Map(SUBJECTS.map((subject) => [subject.id, subject]));

for (const subject of SUBJECTS) {
  const asset = artOf(subject);
  if (!asset) continue;

  BY_CATALOG_ID.set(subject.id, asset);
  BY_ASSET_ID.set(asset.id, asset);
}

/** The art a catalogue entry is drawn with, or undefined when it is cart-only. */
export function artFor(catalogId: string): AssetSpec | undefined {
  return BY_CATALOG_ID.get(catalogId);
}

/**
 * The art an entry would be drawn with once it has art of its own, whether or
 * not the PNG exists yet — which is to say the canvas a new drawing has to be
 * made at. `pnpm assets:placeholders --for <id>` draws exactly this.
 */
export function ownArtFor(catalogId: string): AssetSpec | undefined {
  const subject = SUBJECT_BY_ID.get(catalogId);
  if (!subject?.studio?.placeable) return undefined;

  const { studio, categoryIds } = subject;
  return isoAsset({
    id: catalogId,
    ...shapeOf(studio, standInFor(categoryIds)),
  });
}

/**
 * Every drawing the room can reach, deduplicated. This is what the texture
 * bundle loads, so art nothing points at costs nothing.
 */
export const ASSET_LIST: AssetSpec[] = [...BY_ASSET_ID.values()].sort((a, b) =>
  a.id.localeCompare(b.id),
);

function isPositiveInt(value: unknown): boolean {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function shapeProblems(what: string, shape: Partial<ArtShape>): string[] {
  const found: string[] = [];

  if (shape.footprint !== undefined) {
    const { w, d } = shape.footprint;
    if (!isPositiveInt(w) || !isPositiveInt(d)) {
      found.push(`${what}: footprint must be whole tiles, got ${w}x${d}.`);
    }
  }

  if (shape.heightCm !== undefined && !(shape.heightCm > 0)) {
    found.push(`${what}: heightCm must be above zero, got ${shape.heightCm}.`);
  }

  if (
    shape.surface !== undefined &&
    shape.surface !== "floor" &&
    shape.surface !== "desk"
  ) {
    found.push(`${what}: surface must be "floor" or "desk".`);
  }

  if (shape.surfaceHeightCm !== undefined && shape.surface === "desk") {
    found.push(
      `${what}: only something standing on the floor can carry a desk surface.`,
    );
  }

  return found;
}

/**
 * Everything wrong with the curated half of catalog.json, in sentences meant to
 * be read by whoever edited it. The test suite asserts there is nothing here,
 * and the dev build logs it, so a typo in the data is never a silent blank.
 */
export function artProblems(): string[] {
  const found: string[] = [];

  // A product and a prop sharing an id would quietly draw as one another, since
  // both the room and the art folder know an entry by that one name.
  const seen = new Set<string>();
  for (const { id } of SUBJECTS) {
    if (seen.has(id))
      found.push(`"${id}": two catalogue entries share this id.`);
    seen.add(id);
  }

  for (const drawing of data.studio.drawings) {
    found.push(...shapeProblems(`drawing "${drawing.id}"`, drawing));

    if (drawing.footprint === undefined || drawing.heightCm === undefined) {
      found.push(
        `drawing "${drawing.id}": a shared drawing needs a footprint and a ` +
          `heightCm, because the entries borrowing it do not declare one.`,
      );
    }

    if (!ON_DISK.has(drawing.id)) {
      found.push(
        `drawing "${drawing.id}": no public/assets/studio/${drawing.id}.png. ` +
          `Draw it, or run pnpm assets:placeholders for a stand-in.`,
      );
    }
  }

  for (const category of data.categories) {
    const generic = category.studio?.generic;
    if (generic && !DRAWINGS.has(generic)) {
      found.push(
        `category "${category.id}": generic "${generic}" is not a declared ` +
          `drawing.`,
      );
    }
  }

  for (const { id, studio } of SUBJECTS) {
    if (studio === undefined) continue;
    found.push(...shapeProblems(`"${id}"`, studio));

    if (studio.art !== undefined && !DRAWINGS.has(studio.art)) {
      found.push(
        `"${id}": art "${studio.art}" is not a declared drawing. Name one of ` +
          `studio.drawings, or drop the field and call the PNG ${id}.png.`,
      );
    }

    if (
      studio.art !== undefined &&
      DRAWINGS.has(studio.art) &&
      (studio.footprint !== undefined || studio.heightCm !== undefined)
    ) {
      found.push(
        `"${id}": names the shared drawing "${studio.art}" and also declares ` +
          `measurements. The drawing's own shape wins, so they are a lie.`,
      );
    }

    if (!studio.placeable && Object.keys(studio).length > 1) {
      found.push(
        `"${id}": is not placeable, so its measurements are never used.`,
      );
    }
  }

  return found;
}
