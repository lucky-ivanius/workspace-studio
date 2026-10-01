import type { Footprint, GridCell } from "./grid";

export type Surface = "floor" | "desk";

/**
 * The shape of one drawing: the two numbers every PNG dimension is derived from,
 * plus the handful of flags that say how the thing behaves once it is in the
 * room. See `isoAsset` in assets.ts for what is computed from them.
 */
export type ArtShape = {
  /** Tiles occupied on its surface, at 20 cm per tile. */
  footprint: Footprint;
  /** Real height of the object, the number the art is drawn to. */
  heightCm: number;
  surface: Surface;
  /** Chairs read best tucked in front of a desk; drives default placement. */
  seat?: boolean;
  /** Rugs and mats lie flat, so other floor items may stand on them. */
  flat?: boolean;
  /** Height of the work surface, for desks that carry other items. */
  surfaceHeightCm?: number;
};

/** A drawing: a PNG in `public/assets/studio`, and the shape it is drawn to. */
export type Drawing = ArtShape & { id: string };

/**
 * What the room needs to know about a catalogue entry, hand-written in the
 * `studio` block of catalog.json. Everything is optional: an entry with no block
 * at all is cart-only, which is the safe default for a product nobody has looked
 * at yet.
 */
export type StudioAttributes = Partial<ArtShape> & {
  /**
   * Whether the room draws it. False, or absent, means adding it goes straight
   * to the cart.
   */
  placeable?: boolean;
  /**
   * A drawing shared with near-identical siblings, by name. Omit it and the
   * entry is drawn with art named after its own slug, falling back to its
   * category's stand-in while no such art exists.
   */
  art?: string;
};

/**
 * PNG dimensions are declared in design pixels. Source files are authored at
 * ASSET_PIXEL_RATIO (see assets.ts), so a 256x320 design asset ships as a
 * 512x640 file and still renders 1:1 at default zoom.
 */
export type AssetSpec = Drawing & {
  src: string;
  width: number;
  height: number;
  /**
   * Offset in design px from the image's top-left to the point that sits on the
   * footprint's base center. This is the contract between art and the grid.
   */
  anchor: { x: number; y: number };
  /** Present on desks: lets other items sit on top. */
  deskSurface?: { elevation: number; footprint: Footprint; offset: GridCell };
};

export type PlacedItem = {
  instanceId: string;
  productId: string;
  cell: GridCell;
  surface: Surface;
  /** Desk instance this item rests on, when surface is "desk". */
  hostId?: string;
  ordinal: number;
};
