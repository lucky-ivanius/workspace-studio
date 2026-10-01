"use client";

import { useEffect, useRef, useState } from "react";
import { type CameraState, StudioScene } from "../engine/scene";
import { useStudioStore } from "../state/store";
import { ZoomMenu } from "./zoom-menu";

export function StudioCanvas() {
  const hostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<StudioScene | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [camera, setCamera] = useState<CameraState>({
    zoom: 1,
    canZoomIn: true,
    canZoomOut: true,
  });

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const scene = new StudioScene({
      onSelect: (instanceId) => useStudioStore.getState().select(instanceId),
      onMove: (instanceId, cell) =>
        useStudioStore.getState().moveItem(instanceId, cell),
      onCameraChange: setCamera,
    });
    sceneRef.current = scene;

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
      sceneRef.current = null;
    };
  }, []);

  // The scene is created inside the effect, so every command reads it off the ref.
  const commands = useRef({
    zoomIn: () => sceneRef.current?.zoomIn(),
    zoomOut: () => sceneRef.current?.zoomOut(),
    zoomTo: (zoom: number) => sceneRef.current?.zoomTo(zoom),
    zoomToFit: () => sceneRef.current?.zoomToFit(),
  }).current;

  return (
    <div className="relative h-full w-full overflow-hidden rounded-xl border bg-muted/30">
      <div ref={hostRef} className="h-full w-full" />

      {status === "ready" && (
        <div className="absolute top-3 right-3">
          <ZoomMenu camera={camera} commands={commands} />
        </div>
      )}

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
