"use client";

import { PlusIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SelectionAnchor } from "../engine/scene";

/**
 * Floats at the top-right corner of the selected item. Positioned from the
 * scene's anchor rather than from the DOM, because the item it belongs to lives
 * on the canvas and travels with the camera.
 */
export function SelectionToolbar({
  anchor,
  onRemove,
  onAdd,
}: {
  anchor: SelectionAnchor;
  onRemove: () => void;
  /** Opens the picker for this desk, so whatever is chosen lands on it. */
  onAdd: (hostId: string) => void;
}) {
  return (
    <div
      // Lifted clear of the art so the corner it points at stays visible.
      // pointer-events-none on the wrapper keeps floor clicks reaching Pixi.
      className="pointer-events-none absolute flex -translate-y-[calc(100%+6px)] items-center gap-0.5 rounded-full border bg-popover p-1 shadow-md"
      style={{ left: anchor.x, top: anchor.y }}
    >
      {anchor.isDesk && (
        <Button
          variant="ghost"
          size="xs"
          className="pointer-events-auto"
          onClick={() => onAdd(anchor.instanceId)}
        >
          <PlusIcon data-icon="inline-start" />
          Add
        </Button>
      )}

      <Button
        variant="ghost"
        size="icon-xs"
        className="pointer-events-auto"
        onClick={onRemove}
        aria-label="Delete selected"
      >
        <Trash2Icon />
      </Button>
    </div>
  );
}
