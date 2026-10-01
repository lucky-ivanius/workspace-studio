"use client";

import { create } from "zustand";
import { getAsset } from "../model/assets";
import { assetIdFor } from "../model/catalog";
import { clampToRoom, type GridCell } from "../model/grid";
import {
  assetOf,
  canPlace,
  deskAt,
  findPlacement,
  type Placement,
} from "../model/placement";
import type { PlacedItem } from "../model/types";

export type StudioState = {
  items: PlacedItem[];
  selectedId: string | null;
  /** Rental length drives which price tier the summary uses. */
  rentalWeeks: number;

  addProduct: (productId: string) => string | null;
  moveItem: (instanceId: string, cell: GridCell) => boolean;
  removeItem: (instanceId: string) => void;
  select: (instanceId: string | null) => void;
  setRentalWeeks: (weeks: number) => void;
  clear: () => void;
};

let ordinalCounter = 0;

/**
 * Resolves where an item should land when dragged to `cell`. Desk-mounted items
 * follow whichever desk is under the pointer; floor items stay on the floor.
 */
function resolveTarget(
  items: PlacedItem[],
  item: PlacedItem,
  cell: GridCell,
): Placement | undefined {
  const asset = assetOf(item);

  if (asset.surface === "floor") {
    return { cell: clampToRoom(cell, asset.footprint), surface: "floor" };
  }

  const host = deskAt(items, cell, item.instanceId);
  if (!host) return undefined;
  return { cell, surface: "desk", hostId: host.instanceId };
}

export const useStudioStore = create<StudioState>()((set, get) => ({
  items: [],
  selectedId: null,
  rentalWeeks: 4,

  addProduct(productId) {
    const assetId = assetIdFor(productId);
    if (!assetId) return null;

    const asset = getAsset(assetId);
    const { items } = get();
    const placement = findPlacement(items, asset);
    if (!placement) return null;

    const instanceId = crypto.randomUUID();
    ordinalCounter += 1;

    set({
      items: [
        ...items,
        {
          instanceId,
          productId,
          cell: placement.cell,
          surface: placement.surface,
          hostId: placement.hostId,
          ordinal: ordinalCounter,
        },
      ],
      selectedId: instanceId,
    });

    return instanceId;
  },

  moveItem(instanceId, cell) {
    const { items } = get();
    const item = items.find((candidate) => candidate.instanceId === instanceId);
    if (!item) return false;

    const target = resolveTarget(items, item, cell);
    if (!target) return false;

    const asset = assetOf(item);
    if (!canPlace(items, asset, target, instanceId)) return false;

    set({
      items: items.map((candidate) =>
        candidate.instanceId === instanceId
          ? {
              ...candidate,
              cell: target.cell,
              surface: target.surface,
              hostId: target.hostId,
            }
          : candidate,
      ),
    });

    return true;
  },

  removeItem(instanceId) {
    const { items, selectedId } = get();
    set({
      // Anything resting on a removed desk goes with it.
      items: items.filter(
        (item) => item.instanceId !== instanceId && item.hostId !== instanceId,
      ),
      selectedId: selectedId === instanceId ? null : selectedId,
    });
  },

  select(instanceId) {
    set({ selectedId: instanceId });
  },

  setRentalWeeks(weeks) {
    set({ rentalWeeks: Math.max(1, Math.round(weeks)) });
  },

  clear() {
    set({ items: [], selectedId: null });
  },
}));
