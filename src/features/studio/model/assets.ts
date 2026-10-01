import { type Footprint, TILE_HEIGHT, TILE_WIDTH } from "./grid";
import type { AssetSpec, Surface } from "./types";

/**
 * Source PNGs are authored at 2x so they stay sharp on retina displays while
 * the registry keeps reasoning in design pixels.
 */
export const ASSET_PIXEL_RATIO = 2;

export const ASSET_DIR = "/assets/studio";

/**
 * One grid tile is 20 cm of floor, which makes an 8x4 desk 160x80 cm — the size
 * monis.rent actually rents. Heights are declared in cm and converted with the
 * same scale as the floor axes, so objects stay in proportion to each other.
 *
 * Tiles this small let a monitor, a lamp and a keyboard share a desk with room
 * left over, while every position still snaps to a grid line.
 */
export const CM_PER_TILE = 20;
export const PX_PER_CM = TILE_WIDTH / 2 / CM_PER_TILE;

type IsoAssetInput = {
  id: string;
  footprint: Footprint;
  /** Real height of the object. */
  heightCm: number;
  surface: Surface;
  seat?: boolean;
  flat?: boolean;
  /** Height of the work surface, for desks that carry other items. */
  surfaceHeightCm?: number;
};

/**
 * Derives the exact PNG canvas from the grid footprint, so art and placement can
 * never drift apart. The base diamond fills the bottom of the canvas edge to
 * edge; everything above it is headroom for the object itself.
 */
function isoAsset({
  id,
  footprint,
  heightCm,
  surface,
  seat,
  flat,
  surfaceHeightCm,
}: IsoAssetInput): AssetSpec {
  const span = footprint.w + footprint.d;
  const baseWidth = span * (TILE_WIDTH / 2);
  const baseHeight = span * (TILE_HEIGHT / 2);
  const standHeight = Math.round(heightCm * PX_PER_CM);
  const height = baseHeight + standHeight;

  return {
    id,
    src: `${ASSET_DIR}/${id}.png`,
    width: baseWidth,
    height,
    heightCm,
    footprint,
    anchor: { x: baseWidth / 2, y: height - baseHeight / 2 },
    surface,
    seat,
    flat,
    deskSurface:
      surfaceHeightCm === undefined
        ? undefined
        : {
            elevation: Math.round(surfaceHeightCm * PX_PER_CM),
            footprint,
            offset: { x: 0, y: 0 },
          },
  };
}

const SPECS = [
  // Desks: 160x80, 120x80 and 200x80 cm.
  isoAsset({
    id: "desk-electric-standing",
    footprint: { w: 8, d: 4 },
    heightCm: 75,
    surface: "floor",
    surfaceHeightCm: 75,
  }),
  isoAsset({
    id: "desk-mechanical-wooden",
    footprint: { w: 6, d: 4 },
    heightCm: 72,
    surface: "floor",
    surfaceHeightCm: 72,
  }),
  isoAsset({
    id: "desk-dual-motor",
    footprint: { w: 10, d: 4 },
    heightCm: 75,
    surface: "floor",
    surfaceHeightCm: 75,
  }),

  // Chairs claim the floor their casters sweep: 80x80 and 60x60 cm.
  isoAsset({
    id: "chair-ergonomic-mesh",
    footprint: { w: 4, d: 4 },
    heightCm: 120,
    surface: "floor",
    seat: true,
  }),
  isoAsset({
    id: "chair-task-compact",
    footprint: { w: 3, d: 3 },
    heightCm: 95,
    surface: "floor",
    seat: true,
  }),

  // Monitors are one tile deep: a screen on a stand barely eats into a desk.
  isoAsset({
    id: "monitor-24-fhd",
    footprint: { w: 3, d: 1 },
    heightCm: 45,
    surface: "desk",
  }),
  isoAsset({
    id: "monitor-27-4k",
    footprint: { w: 3, d: 1 },
    heightCm: 50,
    surface: "desk",
  }),
  isoAsset({
    id: "monitor-34-ultrawide",
    footprint: { w: 4, d: 1 },
    heightCm: 48,
    surface: "desk",
  }),

  isoAsset({
    id: "lamp-smart-led",
    footprint: { w: 1, d: 1 },
    heightCm: 45,
    surface: "desk",
  }),
  isoAsset({
    id: "laptop-stand",
    footprint: { w: 2, d: 1 },
    heightCm: 16,
    surface: "desk",
  }),
  isoAsset({
    id: "keyboard-mx",
    footprint: { w: 2, d: 1 },
    heightCm: 3,
    surface: "desk",
  }),
  isoAsset({
    id: "coffee-machine",
    footprint: { w: 1, d: 2 },
    heightCm: 33,
    surface: "desk",
  }),
  isoAsset({
    id: "speaker-marshall",
    footprint: { w: 1, d: 1 },
    heightCm: 32,
    surface: "desk",
  }),

  isoAsset({
    id: "plant-monstera",
    footprint: { w: 2, d: 2 },
    heightCm: 90,
    surface: "floor",
  }),
  isoAsset({
    id: "rug-woven",
    footprint: { w: 8, d: 8 },
    heightCm: 1,
    surface: "floor",
    flat: true,
  }),
] satisfies AssetSpec[];

export const ASSETS: Record<string, AssetSpec> = Object.fromEntries(
  SPECS.map((spec) => [spec.id, spec]),
);

export const ASSET_LIST = SPECS;

export function getAsset(id: string): AssetSpec {
  const spec = ASSETS[id];
  if (!spec) throw new Error(`Unknown asset "${id}"`);
  return spec;
}

/** Exact dimensions the PNG file on disk must have. */
export function sourcePixelSize(spec: AssetSpec) {
  return {
    width: spec.width * ASSET_PIXEL_RATIO,
    height: spec.height * ASSET_PIXEL_RATIO,
  };
}

/** Real-world footprint, for product copy and tooltips. */
export function footprintCm(spec: AssetSpec) {
  return {
    width: spec.footprint.w * CM_PER_TILE,
    depth: spec.footprint.d * CM_PER_TILE,
  };
}
