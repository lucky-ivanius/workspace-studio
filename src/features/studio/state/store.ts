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
  /**
   * Gives back one copy of a product, cart first and the newest sprite last.
   * This is the `-` on a summary line, so it has to undo an `+` without
   * disturbing the room the user arranged.
   */
  removeCopy: (productId: string) => void;
  moveItem: (instanceId: string, cell: GridCell) => boolean;
  /**
   * Takes one item out of the room. Whatever stood on it moves to the cart, so
   * clearing a desk off the canvas never changes what anything else costs.
   */
  removeItem: (instanceId: string) => void;
  select: (instanceId: string | null) => void;
  setRentalWeeks: (weeks: number) => void;
  clear: () => void;
};

let ordinalCounter = 0;

/**
 * Adds one cart copy of each id, stacking onto whatever is already there.
 * Staging is never billed, so a prop among the ids is dropped rather than
 * carted.
 */
function withCopies(cart: CartEntry[], productIds: string[]): CartEntry[] {
  let next = cart;

  for (const productId of productIds) {
    if (!getProduct(productId)) continue;

    next = next.some((entry) => entry.productId === productId)
      ? next.map((entry) =>
          entry.productId === productId
            ? { ...entry, quantity: entry.quantity + 1 }
            : entry,
        )
      : [...next, { productId, quantity: 1 }];
  }

  return next;
}

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
    set({ cart: withCopies(get().cart, [productId]) });
  },

  removeCopy(productId) {
    const { items, cart } = get();

    // A cart copy is the cheapest one to give back, because nothing is drawn
    // for it: the room the user arranged stays exactly as it is. Only once the
    // cart is empty does a sprite have to go.
    if (cart.some((entry) => entry.productId === productId)) {
      set({
        cart: cart.flatMap((entry) => {
          if (entry.productId !== productId) return [entry];
          return entry.quantity > 1
            ? [{ ...entry, quantity: entry.quantity - 1 }]
            : [];
        }),
      });
      return;
    }

    // The newest copy goes first, so repeated clicks undo the adds in the order
    // they were made.
    let newest: PlacedItem | undefined;
    for (const item of items) {
      if (item.productId !== productId) continue;
      if (!newest || item.ordinal > newest.ordinal) newest = item;
    }

    if (newest) get().removeItem(newest.instanceId);
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
    const { items, cart, selectedId } = get();

    // Anything resting on this loses its surface, but not the user's decision to
    // rent it, so it moves to the cart rather than off the bill. Removing a desk
    // is removing a desk: it may not quietly change what a monitor costs.
    const riders = items.filter((item) => item.hostId === instanceId);
    const gone = new Set([
      instanceId,
      ...riders.map((item) => item.instanceId),
    ]);

    set({
      items: items.filter((item) => !gone.has(item.instanceId)),
      cart: withCopies(
        cart,
        riders.map((item) => item.productId),
      ),
      // A rider can be the selection while its desk is the one going, so the
      // whole set has to be checked or the toolbar would point at nothing.
      selectedId: selectedId && gone.has(selectedId) ? null : selectedId,
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
