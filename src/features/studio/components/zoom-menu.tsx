"use client";

import { ChevronDownIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { CameraState } from "../engine/scene";

export type ZoomCommands = {
  zoomIn: () => void;
  zoomOut: () => void;
  zoomTo: (zoom: number) => void;
  zoomToFit: () => void;
};

export function ZoomMenu({
  camera,
  commands,
}: {
  camera: CameraState;
  commands: ZoomCommands;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="outline" size="sm" />}
        aria-label={`Zoom, currently ${Math.round(camera.zoom * 100)} percent`}
      >
        <span className="tabular-nums">{Math.round(camera.zoom * 100)}%</span>
        <ChevronDownIcon data-icon="inline-end" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end">
        <DropdownMenuGroup>
          <DropdownMenuItem
            disabled={!camera.canZoomIn}
            onClick={commands.zoomIn}
          >
            Zoom in
            <DropdownMenuShortcut>+</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={!camera.canZoomOut}
            onClick={commands.zoomOut}
          >
            Zoom out
            <DropdownMenuShortcut>-</DropdownMenuShortcut>
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => commands.zoomTo(0.5)}>
            Zoom to 50%
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => commands.zoomTo(1)}>
            Zoom to 100%
            <DropdownMenuShortcut>⇧0</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => commands.zoomTo(2)}>
            Zoom to 200%
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          <DropdownMenuItem onClick={commands.zoomToFit}>
            Zoom to fit
            <DropdownMenuShortcut>⇧1</DropdownMenuShortcut>
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
