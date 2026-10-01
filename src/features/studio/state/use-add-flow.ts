"use client";

import { useCallback, useState } from "react";
import { displayName, getProduct } from "../model/catalog";
import { type AddResult, useStudioStore } from "./store";

/** The product an add attempt stalled on, waiting on the cart confirmation. */
type Pending = {
  productId: string;
  reason: "needs-desk" | "no-space";
};

/**
 * One place for "try to put this in the room, and ask about the cart if it
 * won't fit". Every add button goes through this so the fallback is identical
 * wherever the add came from.
 */
export function useAddFlow() {
  const addProduct = useStudioStore((state) => state.addProduct);
  const addToCart = useStudioStore((state) => state.addToCart);
  const [pending, setPending] = useState<Pending | null>(null);

  const add = useCallback(
    (productId: string, hostId?: string): AddResult => {
      const result = addProduct(productId, hostId);

      if (result.status === "needs-desk" || result.status === "no-space") {
        setPending({ productId, reason: result.status });
      }

      return result;
    },
    [addProduct],
  );

  const confirm = useCallback(() => {
    if (pending) addToCart(pending.productId);
    setPending(null);
  }, [addToCart, pending]);

  const cancel = useCallback(() => setPending(null), []);

  return {
    add,
    confirm,
    cancel,
    pending: pending
      ? {
          reason: pending.reason,
          name: displayName(pending.productId),
          // Staging items never reach checkout, so the cart is not an option.
          cartable: getProduct(pending.productId) !== undefined,
        }
      : null,
  };
}
