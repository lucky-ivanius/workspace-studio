import type { Footprint, GridCell } from "./grid";

export type Surface = "floor" | "desk";

export type ProductCategory =
  | "desk"
  | "chair"
  | "monitor"
  | "lighting"
  | "decor"
  | "extras";

/**
 * PNG dimensions are declared in design pixels. Source files are authored at
 * ASSET_PIXEL_RATIO (see assets.ts), so a 256x320 design asset ships as a
 * 512x640 file and still renders 1:1 at default zoom.
 */
export type AssetSpec = {
  id: string;
  src: string;
  width: number;
  height: number;
  /** Real height of the object, the number the art is drawn to. */
  heightCm: number;
  /** Tiles the item occupies on its surface. */
  footprint: Footprint;
  /**
   * Offset in design px from the image's top-left to the point that sits on the
   * footprint's base center. This is the contract between art and the grid.
   */
  anchor: { x: number; y: number };
  surface: Surface;
  /** Chairs read best tucked in front of a desk; drives default placement. */
  seat?: boolean;
  /** Rugs and mats lie flat, so other floor items may stand on them. */
  flat?: boolean;
  /** Present on desks: lets other items sit on top. */
  deskSurface?: { elevation: number; footprint: Footprint; offset: GridCell };
};

export type Product = {
  id: string;
  /** Matches the monis.rent product slug so live data can be joined in. */
  slug: string;
  name: string;
  category: ProductCategory;
  assetId: string;
  /** USD per week. See catalog.ts for provenance. */
  pricePerWeek: number;
  summary: string;
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
