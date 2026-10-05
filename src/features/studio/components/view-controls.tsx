"use client";

import { RotateCcwIcon, RotateCwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ViewState } from "../model/view";

export type ViewCommands = {
  rotateViewLeft: () => void;
  rotateViewRight: () => void;
};

/**
 * Steps the room through its four views. The label names the side you are
 * looking at; until art has real facings, the odd sides mirror every drawing.
 */
export function ViewControls({
  view,
  commands,
}: {
  view: ViewState;
  commands: ViewCommands;
}) {
  return (
    <div className="flex items-center gap-0.5 rounded-4xl border bg-background p-0.5">
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label="Rotate view left"
        onClick={commands.rotateViewLeft}
      >
        <RotateCcwIcon />
      </Button>
      <span className="min-w-12 text-center text-xs font-medium text-muted-foreground">
        {view.label}
      </span>
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label="Rotate view right"
        onClick={commands.rotateViewRight}
      >
        <RotateCwIcon />
      </Button>
    </div>
  );
}
