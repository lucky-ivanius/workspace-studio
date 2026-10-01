import { TILE_HEIGHT, TILE_WIDTH } from "./grid";
import type { AssetSpec, Drawing } from "./types";

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

/**
 * Derives the exact PNG canvas from the grid footprint, so art and placement can
 * never drift apart. The base diamond fills the bottom of the canvas edge to
 * edge; everything above it is headroom for the object itself.
 *
 * This is the whole of the art contract. Every drawing in the room comes through
 * here, whether its shape was declared on a product, on a shared drawing, or
 * borrowed from a category's stand-in — see art.ts for who decides which.
 */
export function isoAsset(drawing: Drawing): AssetSpec {
  const { id, footprint, heightCm, surfaceHeightCm } = drawing;

  const span = footprint.w + footprint.d;
  const baseWidth = span * (TILE_WIDTH / 2);
  const baseHeight = span * (TILE_HEIGHT / 2);
  const standHeight = Math.round(heightCm * PX_PER_CM);
  const height = baseHeight + standHeight;

  return {
    ...drawing,
    src: `${ASSET_DIR}/${id}.png`,
    width: baseWidth,
    height,
    anchor: { x: baseWidth / 2, y: height - baseHeight / 2 },
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
