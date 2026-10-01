"use client";

import { useEffect, useRef, useState } from "react";
import { StudioScene } from "../engine/scene";
import { useStudioStore } from "../state/store";

export function StudioCanvas() {
  const hostRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const scene = new StudioScene({
      onSelect: (instanceId) => useStudioStore.getState().select(instanceId),
      onMove: (instanceId, cell) =>
        useStudioStore.getState().moveItem(instanceId, cell),
    });

    let unsubscribe: (() => void) | undefined;

    scene
      .mount(host)
      .then(() => {
        const render = () => {
          const { items, selectedId } = useStudioStore.getState();
          scene.sync(items, selectedId);
        };
        render();
        unsubscribe = useStudioStore.subscribe(render);
        setStatus("ready");
      })
      .catch((error: unknown) => {
        console.error("Studio canvas failed to start", error);
        setStatus("error");
      });

    return () => {
      unsubscribe?.();
      scene.destroy();
    };
  }, []);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-xl border bg-muted/30">
      <div ref={hostRef} className="h-full w-full" />
      {status !== "ready" && (
        <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
          {status === "loading"
            ? "Preparing your workspace…"
            : "Could not start the canvas."}
        </p>
      )}
    </div>
  );
}
