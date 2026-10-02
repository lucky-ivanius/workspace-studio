import { artFor } from "./art";
import {
  cellsOverlap,
  type Footprint,
  footprintDepth,
  type GridCell,
  isInsideRoom,
  ROOM_COLS,
  ROOM_ROWS,
} from "./grid";
import type { AssetSpec, PlacedItem } from "./types";

export type Placement = {
  cell: GridCell;
  surface: AssetSpec["surface"];
  hostId?: string;
};

type Area = { cell: GridCell; footprint: Footprint };

export function assetOf(item: PlacedItem): AssetSpec {
  const asset = artFor(item.productId);
  if (!asset) throw new Error(`No art for catalog entry "${item.productId}"`);
  return asset;
}

/** Desks are the only items carrying a surface that others can sit on. */
function desksAmong(items: PlacedItem[]) {
  return items.flatMap((item) => {
    const surface = assetOf(item).deskSurface;
    if (!surface) return [];
    return [
      {
        item,
        area: {
          cell: {
            x: item.cell.x + surface.offset.x,
            y: item.cell.y + surface.offset.y,
          },
          footprint: surface.footprint,
        } satisfies Area,
      },
    ];
  });
}

/**
 * Whether anything in the room can host desk items. Tells "there is no desk
 * yet" apart from "every desk is full", which the two read the same to
 * findPlacement but not to the person adding a monitor.
 */
export function hasDesk(items: PlacedItem[]): boolean {
  return items.some((item) => assetOf(item).deskSurface !== undefined);
}

/**
 * Desks with `preferredHostId` first, so an item added from one desk's own menu
 * lands on that desk whenever it still has room.
 */
function desksByPreference(items: PlacedItem[], preferredHostId?: string) {
  const desks = desksAmong(items);
  if (!preferredHostId) return desks;

  return [
    ...desks.filter((desk) => desk.item.instanceId === preferredHostId),
    ...desks.filter((desk) => desk.item.instanceId !== preferredHostId),
  ];
}

export function elevationOf(item: PlacedItem, items: PlacedItem[]): number {
  if (item.surface !== "desk" || !item.hostId) return 0;
  const host = items.find((candidate) => candidate.instanceId === item.hostId);
  return host ? (assetOf(host).deskSurface?.elevation ?? 0) : 0;
}

/**
 * Draw order follows the support hierarchy first, then isometric depth. Keying a
 * desk item off its host means it always draws over that desk, while a floor
 * item one tile nearer the camera still draws over both. Flat items sort by
 * their rearmost tile, so anything standing on a rug draws over the rug instead
 * of the rug's long front edge winning the sort.
 */
const HOST_STEP = 100_000;
const SURFACE_OFFSET = 1_000;
const ITEM_STEP = 100;

export function zIndexOf(item: PlacedItem, items: PlacedItem[]): number {
  const asset = assetOf(item);
  const own = asset.flat
    ? item.cell.x + item.cell.y + 2
    : footprintDepth(item.cell, asset.footprint);
  const tieBreak = item.ordinal % ITEM_STEP;

  if (item.surface === "desk" && item.hostId) {
    const host = items.find(
      (candidate) => candidate.instanceId === item.hostId,
    );
    if (host) {
      const hostDepth = footprintDepth(host.cell, assetOf(host).footprint);
      return (
        hostDepth * HOST_STEP + SURFACE_OFFSET + own * ITEM_STEP + tieBreak
      );
    }
  }

  return own * HOST_STEP + tieBreak;
}

function contains(outer: Area, cell: GridCell, footprint: Footprint): boolean {
  return (
    cell.x >= outer.cell.x &&
    cell.y >= outer.cell.y &&
    cell.x + footprint.w <= outer.cell.x + outer.footprint.w &&
    cell.y + footprint.d <= outer.cell.y + outer.footprint.d
  );
}

export function canPlace(
  items: PlacedItem[],
  asset: AssetSpec,
  placement: Placement,
  ignoreId?: string,
): boolean {
  const others = items.filter((item) => item.instanceId !== ignoreId);

  if (placement.surface === "floor") {
    if (!isInsideRoom(placement.cell, asset.footprint)) return false;
    return others
      .filter((item) => item.surface === "floor")
      .every((item) => {
        const other = assetOf(item);
        if (other.flat || asset.flat) return true;
        return !cellsOverlap(
          placement.cell,
          asset.footprint,
          item.cell,
          other.footprint,
        );
      });
  }

  const host = desksAmong(others).find(
    (desk) => desk.item.instanceId === placement.hostId,
  );
  if (!host) return false;
  if (!contains(host.area, placement.cell, asset.footprint)) return false;

  return others
    .filter(
      (item) => item.surface === "desk" && item.hostId === placement.hostId,
    )
    .every(
      (item) =>
        !cellsOverlap(
          placement.cell,
          asset.footprint,
          item.cell,
          assetOf(item).footprint,
        ),
    );
}

/**
 * Floor cells a footprint could occupy, nearest the middle of the room first.
 * A room this large would strand the first desk in a back corner under plain
 * reading order, so placement works outward from the centre instead.
 */
function floorCandidates(footprint: Footprint): GridCell[] {
  const center = {
    x: (ROOM_COLS - footprint.w) / 2,
    y: (ROOM_ROWS - footprint.d) / 2,
  };
  const cells: GridCell[] = [];

  for (let y = 0; y <= ROOM_ROWS - footprint.d; y++) {
    for (let x = 0; x <= ROOM_COLS - footprint.w; x++) {
      cells.push({ x, y });
    }
  }

  // Sorting is stable, so cells the same distance out keep reading order.
  return cells.sort(
    (a, b) =>
      Math.hypot(a.x - center.x, a.y - center.y) -
      Math.hypot(b.x - center.x, b.y - center.y),
  );
}

/** Where an item lands when it is added from the catalog. */
export function findPlacement(
  items: PlacedItem[],
  asset: AssetSpec,
  preferredHostId?: string,
): Placement | undefined {
  if (asset.surface === "desk") {
    for (const desk of desksByPreference(items, preferredHostId)) {
      for (let y = 0; y < desk.area.footprint.d; y++) {
        for (let x = 0; x < desk.area.footprint.w; x++) {
          const candidate: Placement = {
            cell: { x: desk.area.cell.x + x, y: desk.area.cell.y + y },
            surface: "desk",
            hostId: desk.item.instanceId,
          };
          if (canPlace(items, asset, candidate)) return candidate;
        }
      }
    }
    return undefined;
  }

  if (asset.seat) {
    for (const desk of desksByPreference(items, preferredHostId)) {
      const candidate: Placement = {
        cell: {
          x:
            desk.area.cell.x +
            Math.floor((desk.area.footprint.w - asset.footprint.w) / 2),
          y: desk.area.cell.y + desk.area.footprint.d,
        },
        surface: "floor",
      };
      if (canPlace(items, asset, candidate)) return candidate;
    }
  }

  for (const cell of floorCandidates(asset.footprint)) {
    const candidate: Placement = { cell, surface: "floor" };
    if (canPlace(items, asset, candidate)) return candidate;
  }
  return undefined;
}

/** Which desk, if any, sits under a cell. Drives drag targeting for desk items. */
export function deskAt(
  items: PlacedItem[],
  cell: GridCell,
  ignoreId?: string,
): PlacedItem | undefined {
  return desksAmong(items.filter((item) => item.instanceId !== ignoreId)).find(
    (desk) => contains(desk.area, cell, { w: 1, d: 1 }),
  )?.item;
}
