"use client";

import { create } from "zustand";
import { artFor } from "../model/art";
import { getProduct } from "../model/catalog";
import { clampToRoom, type GridCell } from "../model/grid";
import {
  assetOf,
  canPlace,
  deskAt,
  findPlacement,
  hasDesk,
  type Placement,
} from "../model/placement";
import type { PlacedItem } from "../model/types";

/** A product waiting in the cart because the room could not take it. */
export type CartEntry = {
  productId: string;
  quantity: number;
};

/**
 * Why an add did or did not reach the canvas. `needs-desk` and `no-space` are
 * both recoverable by putting the product in the cart instead, which is the
 * choice the UI offers. `carted` has already done that, because the product is
 * one the room never draws.
 */
export type AddResult =
  | { status: "placed"; instanceId: string }
  | { status: "carted" }
  | { status: "needs-desk" }
  | { status: "no-space" }
  | { status: "unknown" };

export type StudioState = {
  items: PlacedItem[];
  cart: CartEntry[];
  selectedId: string | null;
  /** Rental length drives which price tier the summary uses. */
  rentalWeeks: number;

  /**
   * Tries to place a product in the room. `hostId` asks for a particular desk,
   * used by the menu on a selected desk; any desk with room will do otherwise.
   * A cart-only product skips the room and goes to the cart.
   */
  addProduct: (productId: string, hostId?: string) => AddResult;
  addToCart: (productId: string) => void;
  removeFromCart: (productId: string) => void;
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
  cart: [],
  selectedId: null,
  rentalWeeks: 4,

  addProduct(productId, hostId) {
    const asset = artFor(productId);
    if (!asset) {
      // No art means the product is cart-only, so there is nothing to find room
      // for. An id that names no product at all is simply ignored.
      if (!getProduct(productId)) return { status: "unknown" };
      get().addToCart(productId);
      return { status: "carted" };
    }

    const { items } = get();
    const placement = findPlacement(items, asset, hostId);

    if (!placement) {
      return asset.surface === "desk" && !hasDesk(items)
        ? { status: "needs-desk" }
        : { status: "no-space" };
    }

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

    return { status: "placed", instanceId };
  },

  addToCart(productId) {
    // Staging items are never billed, so the cart only takes rentals.
    if (!getProduct(productId)) return;

    const { cart } = get();
    const existing = cart.find((entry) => entry.productId === productId);

    set({
      cart: existing
        ? cart.map((entry) =>
            entry.productId === productId
              ? { ...entry, quantity: entry.quantity + 1 }
              : entry,
          )
        : [...cart, { productId, quantity: 1 }],
    });
  },

  removeFromCart(productId) {
    const { cart } = get();
    set({
      cart: cart.flatMap((entry) => {
        if (entry.productId !== productId) return [entry];
        return entry.quantity > 1
          ? [{ ...entry, quantity: entry.quantity - 1 }]
          : [];
      }),
    });
  },

  moveItem(instanceId, cell) {
    const { items } = get();
    const item = items.find((candidate) => candidate.instanceId === instanceId);
    if (!item) return false;

    const target = resolveTarget(items, item, cell);
    if (!target) return false;

    const asset = assetOf(item);
    if (!canPlace(items, asset, target, instanceId)) return false;

    // Anything resting on a moved desk rides along. Desk items hold absolute
    // cells, so shifting them by the same delta keeps each one on the spot of
    // the surface it already occupied, and preserves the fit the desk vouched
    // for: the surface travels with the desk, so nothing can slide off it or
    // onto a neighbour.
    const shift = {
      x: target.cell.x - item.cell.x,
      y: target.cell.y - item.cell.y,
    };

    set({
      items: items.map((candidate) => {
        if (candidate.instanceId === instanceId) {
          return {
            ...candidate,
            cell: target.cell,
            surface: target.surface,
            hostId: target.hostId,
          };
        }

        if (candidate.hostId !== instanceId) return candidate;

        return {
          ...candidate,
          cell: {
            x: candidate.cell.x + shift.x,
            y: candidate.cell.y + shift.y,
          },
        };
      }),
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
    set({ items: [], cart: [], selectedId: null });
  },
}));
