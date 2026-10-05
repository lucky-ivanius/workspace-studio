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
import { rotatedClockwise } from "./view";

export type Placement = {
  cell: GridCell;
  surface: AssetSpec["surface"];
  hostId?: string;
};

type Area = { cell: GridCell; footprint: Footprint };

/**
 * The footprint after quarter turns clockwise. Odd turns transpose it — the
 * same move the mirrored view makes — so a 2x1 drawing covers a 1x2 set of
 * tiles, and two turns hand back the shape it started with.
 */
export function rotatedFootprint(
  footprint: Footprint,
  turns: number,
): Footprint {
  return Math.abs(Math.round(turns)) % 2 === 1
    ? { w: footprint.d, d: footprint.w }
    : footprint;
}
/** The tiles an item occupies right now, with its own rotation applied. This —
 * not the drawing's raw footprint — is what placement, draw order and the
 * selection tiles must read.
 */
export function footprintOf(item: PlacedItem): Footprint {
  return rotatedFootprint(assetOf(item).footprint, item.turns);
}

/** Centre of a footprint's rectangle, in continuous grid coordinates. */
function centreOf(cell: GridCell, footprint: Footprint) {
  return { x: cell.x + footprint.w / 2, y: cell.y + footprint.d / 2 };
}

/** The whole-tile cell that puts a footprint's centre on `centre`. */
function reAnchor(
  centre: { x: number; y: number },
  footprint: Footprint,
): GridCell {
  return {
    x: Math.round(centre.x - footprint.w / 2),
    y: Math.round(centre.y - footprint.d / 2),
  };
}

/**
 * The cell that keeps a footprint's centre still when it turns from `from`
 * into `to`. A footprint with an odd side cannot keep its centre exactly on
 * the tile grid, so the cell rounds to the nearest whole tile and the item
 * may sit half a tile from where it was — the usual price of spinning a 2x1
 * into a 1x2.
 */
export function rotatedCell(
  cell: GridCell,
  from: Footprint,
  to: Footprint,
): GridCell {
  return reAnchor(centreOf(cell, from), to);
}

/**
 * A desk's surface travels with the desk. The footprint transposes as the
 * desk's own does; the offset follows the clockwise turn about the desk's
 * centre, so the tiles things stand on are the tiles the turned desk offers.
 */
function rotatedSurface(
  deskFootprint: Footprint,
  surface: NonNullable<AssetSpec["deskSurface"]>,
  turns: number,
): NonNullable<AssetSpec["deskSurface"]> {
  if (Math.abs(Math.round(turns)) % 2 === 0) return surface;

  return {
    elevation: surface.elevation,
    footprint: rotatedFootprint(surface.footprint, turns),
    // The old offset (ox, oy) with extent (sw, sd) inside a desk of depth D
    // lands at (D - oy - sd, ox) once the desk has turned.
    offset: {
      x: deskFootprint.d - surface.offset.y - surface.footprint.d,
      y: surface.offset.x,
    },
  };
}

export function assetOf(item: PlacedItem): AssetSpec {
  const asset = artFor(item.productId);
  if (!asset) throw new Error(`No art for catalog entry "${item.productId}"`);
  return asset;
}

/** Desks are the only items carrying a surface that others can sit on. */
function desksAmong(items: PlacedItem[]) {
  return items.flatMap((item) => {
    const asset = assetOf(item);
    const surface = asset.deskSurface;
    if (!surface) return [];
    const turned = rotatedSurface(asset.footprint, surface, item.turns);
    return [
      {
        item,
        area: {
          cell: {
            x: item.cell.x + turned.offset.x,
            y: item.cell.y + turned.offset.y,
          },
          footprint: turned.footprint,
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
  const footprint = footprintOf(item);
  const own = asset.flat
    ? item.cell.x + item.cell.y + 2
    : footprintDepth(item.cell, footprint);
  const tieBreak = item.ordinal % ITEM_STEP;

  if (item.surface === "desk" && item.hostId) {
    const host = items.find(
      (candidate) => candidate.instanceId === item.hostId,
    );
    if (host) {
      const hostDepth = footprintDepth(host.cell, footprintOf(host));
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

/**
 * Whether `asset` — turned to `turns` — may sit at `placement`. `ignoreId`
 * takes the item being moved out of its own way.
 */
export function canPlace(
  items: PlacedItem[],
  asset: AssetSpec,
  placement: Placement,
  ignoreId?: string,
  turns = 0,
): boolean {
  const others = items.filter((item) => item.instanceId !== ignoreId);
  const footprint = rotatedFootprint(asset.footprint, turns);

  if (placement.surface === "floor") {
    if (!isInsideRoom(placement.cell, footprint)) return false;
    return others
      .filter((item) => item.surface === "floor")
      .every((item) => {
        const other = assetOf(item);
        if (other.flat || asset.flat) return true;
        return !cellsOverlap(
          placement.cell,
          footprint,
          item.cell,
          footprintOf(item),
        );
      });
  }

  const host = desksAmong(others).find(
    (desk) => desk.item.instanceId === placement.hostId,
  );
  if (!host) return false;
  if (!contains(host.area, placement.cell, footprint)) return false;

  return others
    .filter(
      (item) => item.surface === "desk" && item.hostId === placement.hostId,
    )
    .every(
      (item) =>
        !cellsOverlap(placement.cell, footprint, item.cell, footprintOf(item)),
    );
}

/**
 * The room after `instanceId` turns one quarter clockwise, or undefined when
 * the turn would not fit.
 *
 * The mover's cell keeps its footprint's centre, and a desk carries its
 * riders: each one orbits the desk's centre with the turn — the back corner
 * arrives at the right corner — and turns with it. The orbit maps the desk's
 * surface exactly onto the surface the turned desk offers, so an arrangement
 * that fit before the turn fits after it — up to the half-tile rounding of
 * odd footprints, which the checks below refuse rather than fudge. Every
 * moved item is validated against the room as it would stand after the turn,
 * so a turn that would clip a neighbour is refused whole.
 */
export function rotated(
  items: PlacedItem[],
  instanceId: string,
): PlacedItem[] | undefined {
  const item = items.find((candidate) => candidate.instanceId === instanceId);
  if (!item) return undefined;

  const asset = assetOf(item);
  const turns = rotatedClockwise(item.turns);
  const moved = new Map<string, PlacedItem>();

  moved.set(instanceId, {
    ...item,
    cell: rotatedCell(
      item.cell,
      footprintOf(item),
      rotatedFootprint(asset.footprint, turns),
    ),
    turns,
  });

  if (item.surface === "floor" && asset.deskSurface) {
    const about = centreOf(item.cell, footprintOf(item));

    for (const rider of items) {
      if (rider.hostId !== instanceId) continue;
      const riderAsset = assetOf(rider);
      const riderTurns = rotatedClockwise(rider.turns);
      const centre = centreOf(rider.cell, footprintOf(rider));
      const next = rotatedFootprint(riderAsset.footprint, riderTurns);

      // The rider orbits the desk's centre with the turn: a spot at offset
      // (dx, dy) from the centre moves to (-dy, dx) — the back corner
      // arrives at the right corner, exactly as turning the desk by hand
      // would carry it.
      const dx = centre.x - about.x;
      const dy = centre.y - about.y;
      moved.set(rider.instanceId, {
        ...rider,
        cell: reAnchor({ x: about.x - dy, y: about.y + dx }, next),
        turns: riderTurns,
      });
    }
  }

  const next = items.map(
    (candidate) => moved.get(candidate.instanceId) ?? candidate,
  );

  for (const mover of moved.values()) {
    const placement: Placement =
      mover.surface === "desk"
        ? { cell: mover.cell, surface: "desk", hostId: mover.hostId }
        : { cell: mover.cell, surface: "floor" };
    if (
      !canPlace(next, assetOf(mover), placement, mover.instanceId, mover.turns)
    ) {
      return undefined;
    }
  }

  return next;
}

/** Whether the item can take its clockwise quarter turn where it stands. */
export function canRotate(items: PlacedItem[], instanceId: string): boolean {
  return rotated(items, instanceId) !== undefined;
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
