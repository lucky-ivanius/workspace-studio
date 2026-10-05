"use client";

import { RotateCwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export type ViewCommands = {
  rotateView: () => void;
};

/**
 * Steps the room through its four views, clockwise only — the single control
 * the room needs, since every drawing has one facing and two turns land back
 * where they started.
 */
export function ViewControls({ commands }: { commands: ViewCommands }) {
  return (
    <div className="flex items-center rounded-4xl border bg-background p-0.5">
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label="Rotate view clockwise"
        onClick={commands.rotateView}
      >
        <RotateCwIcon />
      </Button>
    </div>
  );
}
