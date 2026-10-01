"use client";

import dynamic from "next/dynamic";

/**
 * Pixi needs a real canvas and a GPU context, so the scene is client-only.
 * Loading it through next/dynamic keeps pixi.js out of the server bundle and
 * out of the initial page payload.
 */
export const StudioCanvasLoader = dynamic(
  () => import("./studio-canvas").then((module) => module.StudioCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center rounded-xl border bg-muted/30 text-sm text-muted-foreground">
        Loading studio…
      </div>
    ),
  },
);
