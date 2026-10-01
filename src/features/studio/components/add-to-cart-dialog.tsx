"use client";

import { ShoppingCartIcon } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export type PendingAdd = {
  reason: "needs-desk" | "no-space";
  name: string;
  /** Staging items are never billed, so there is no cart to fall back to. */
  cartable: boolean;
};

export function AddToCartDialog({
  pending,
  onConfirm,
  onCancel,
}: {
  pending: PendingAdd | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!pending) return null;

  return (
    <AlertDialog
      open
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogTitle>{title(pending)}</AlertDialogTitle>
          <AlertDialogDescription>
            {description(pending)}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>
            {pending?.cartable ? "Cancel" : "Close"}
          </AlertDialogCancel>
          {pending?.cartable && (
            <AlertDialogAction onClick={onConfirm}>
              <ShoppingCartIcon data-icon="inline-start" />
              Add to cart
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function title(pending: PendingAdd | null): string {
  if (pending?.reason === "needs-desk") return "There's no desk";
  return "No space left";
}

function description(pending: PendingAdd | null): string {
  if (!pending) return "";

  const where =
    pending.reason === "needs-desk"
      ? `${pending.name} needs a desk to stand on, and there isn't one in the room.`
      : `There's no room left for ${pending.name} on the canvas.`;

  return pending.cartable
    ? `${where} Add it to your cart instead? It will be rented, but it won't show up in the canvas.`
    : `${where} It is a staging item, so there is nothing to add to a cart. Make some space and try again.`;
}
