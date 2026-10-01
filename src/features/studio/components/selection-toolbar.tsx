"use client";

import { PlusIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { SelectionAnchor } from "../engine/scene";
import { DESK_GROUPS } from "../model/catalog";

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
  /** Adds a product, naming this desk so the item lands on it. */
  onAdd: (productId: string, hostId: string) => void;
}) {
  return (
    <div
      // Lifted clear of the art so the corner it points at stays visible.
      // pointer-events-none on the wrapper keeps floor clicks reaching Pixi.
      className="pointer-events-none absolute flex -translate-y-[calc(100%+6px)] items-center gap-0.5 rounded-full border bg-popover p-1 shadow-md"
      style={{ left: anchor.x, top: anchor.y }}
    >
      {anchor.isDesk && (
        <DropdownMenu>
          <DropdownMenuTrigger
            className="pointer-events-auto"
            render={<Button variant="ghost" size="xs" />}
          >
            <PlusIcon data-icon="inline-start" />
            Add
          </DropdownMenuTrigger>

          <DropdownMenuContent align="start">
            <DropdownMenuGroup>
              {DESK_GROUPS.map((group) => (
                <DropdownMenuSub key={group.id}>
                  <DropdownMenuSubTrigger>
                    {group.addLabel}
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    <DropdownMenuGroup>
                      {group.entries.map((entry) => (
                        <DropdownMenuItem
                          key={entry.id}
                          onClick={() => onAdd(entry.id, anchor.instanceId)}
                        >
                          {entry.name}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuGroup>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              ))}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
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
