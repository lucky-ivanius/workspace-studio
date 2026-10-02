"use client";

import { PlusIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  type CameraState,
  type SelectionAnchor,
  StudioScene,
} from "../engine/scene";
import { useStudioStore } from "../state/store";
import { useAddFlow } from "../state/use-add-flow";
import { AddItemDialog } from "./add-item-dialog";
import { AddToCartDialog } from "./add-to-cart-dialog";
import { SelectionToolbar } from "./selection-toolbar";
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
  const [anchor, setAnchor] = useState<SelectionAnchor | null>(null);
  /**
   * null  → closed
   * ""    → open for any surface (global Add button)
   * str   → open for a specific host desk
   */
  const [pickingForDesk, setPickingForDesk] = useState<string | null>(null);

  const isEmpty = useStudioStore((state) => state.items.length === 0);
  const removeItem = useStudioStore((state) => state.removeItem);
  const { add, confirm, cancel, pending } = useAddFlow();

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const scene = new StudioScene({
      onSelect: (instanceId) => useStudioStore.getState().select(instanceId),
      onMove: (instanceId, cell) =>
        useStudioStore.getState().moveItem(instanceId, cell),
      onCameraChange: setCamera,
      onSelectionChange: setAnchor,
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

  const ready = status === "ready";

  return (
    <div className="relative h-full w-full overflow-hidden rounded-xl border bg-muted/30">
      <div ref={hostRef} className="h-full w-full" />

      {ready && isEmpty && (
        <div className="absolute inset-0 flex items-center justify-center p-6">
          <Empty className="max-w-sm rounded-2xl border bg-card/90 backdrop-blur-sm">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <PlusIcon />
              </EmptyMedia>
              <EmptyTitle>Nothing in the room yet</EmptyTitle>
              <EmptyDescription>
                Start with a desk, then hang monitors, lamps and the rest off
                it.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button onClick={() => setPickingForDesk("")}>
                <PlusIcon data-icon="inline-start" />
                Add item
              </Button>
            </EmptyContent>
          </Empty>
        </div>
      )}

      {ready && !isEmpty && (
        <div className="absolute top-3 left-3">
          <Button size="lg" onClick={() => setPickingForDesk("")}>
            <PlusIcon data-icon="inline-start" />
            Add item
          </Button>
        </div>
      )}

      {/* Hidden mid-drag: the pointer is already on the item it would cover. */}
      {ready && anchor && !anchor.dragging && (
        <SelectionToolbar
          anchor={anchor}
          onRemove={() => removeItem(anchor.instanceId)}
          onAdd={setPickingForDesk}
        />
      )}

      {ready && (
        <div className="absolute top-3 right-3">
          <ZoomMenu camera={camera} commands={commands} />
        </div>
      )}

      {!ready && (
        <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
          {status === "loading"
            ? "Preparing your workspace…"
            : "Could not start the canvas."}
        </p>
      )}

      <AddItemDialog
        open={pickingForDesk !== null}
        onOpenChange={(open) => {
          if (!open) setPickingForDesk(null);
        }}
        deskOnly={Boolean(pickingForDesk)}
        title={pickingForDesk ? "Add to this desk" : "Add to your workspace"}
        description={
          pickingForDesk
            ? "Everything here fits on a desk."
            : "Pick something to drop into the room. Anything that cannot fit goes to your cart instead."
        }
        onPick={(productId) => {
          const result = add(productId, pickingForDesk || undefined);
          // Only a placement puts something on the canvas worth looking at.
          // A cart confirmation needs the picker to stay where it is, and a
          // cart-only product leaves the room unchanged, so closing over it
          // would look like nothing happened at all.
          if (result.status === "placed") setPickingForDesk(null);
        }}
      />

      <AddToCartDialog
        pending={pending}
        onConfirm={confirm}
        onCancel={cancel}
      />
    </div>
  );
}
