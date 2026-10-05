import {
  Application,
  Container,
  type FederatedPointerEvent,
  Graphics,
  Sprite,
  Texture,
} from "pixi.js";
import { ASSET_PIXEL_RATIO } from "../model/assets";
import {
  anchorToScreen,
  type GridCell,
  roomBounds,
  roomCenter,
  roomGridLines,
  roomOutline,
  type ScreenPoint,
  screenToTile,
  tileDiamond,
} from "../model/grid";
import { assetOf, elevationOf, zIndexOf } from "../model/placement";
import type { PlacedItem } from "../model/types";
import {
  rotatedLeft,
  rotatedRight,
  type ViewState,
  viewState,
} from "../model/view";
import { loadStudioAssets } from "./assets";

/** Everything the zoom control needs to render itself. */
export type CameraState = {
  zoom: number;
  canZoomIn: boolean;
  canZoomOut: boolean;
};

/**
 * Where to pin the floating toolbar for the selected item, in CSS pixels
 * relative to the canvas. Recomputed whenever the item or the camera moves.
 */
export type SelectionAnchor = {
  instanceId: string;
  /** Top-right corner of the item's art. */
  x: number;
  y: number;
  /** Desks get the extra "add to this desk" menu. */
  isDesk: boolean;
  /** True mid-drag, so the toolbar can step out of the way. */
  dragging: boolean;
};

export type SceneCallbacks = {
  onSelect: (instanceId: string | null) => void;
  /**
   * Asked on every drag frame. Illegal targets are rejected by the store, which
   * simply leaves the item where it was.
   */
  onMove: (instanceId: string, cell: GridCell) => void;
  /** Fires when the zoom changes, never on a pan. */
  onCameraChange: (camera: CameraState) => void;
  /** Fires when the view turns to another side of the room. */
  onViewChange: (view: ViewState) => void;
  /** Fires whenever the selected item's screen position changes. */
  onSelectionChange: (anchor: SelectionAnchor | null) => void;
};

const BACKGROUND = 0xf4f1ea;
const FLOOR_FILL = 0xe6e0d4;
const FLOOR_LINE = 0xcfc6b4;
const FLOOR_EDGE = 0xb9ae98;
const SELECTION = 0x4f46e5;

/** Slack left around the room when fitting it to the view. */
const VIEWPORT_PADDING = 64;
const MIN_ZOOM = 0.2;
const MAX_ZOOM = 4;
/** Multiplier for one step of the zoom in / zoom out commands. */
const ZOOM_STEP = 1.25;
/**
 * Zoom per pixel of wheel delta. A mouse notch is ~100px, so one notch is about
 * 20%, while a trackpad pinch arrives in small deltas and stays smooth.
 */
const ZOOM_PER_PIXEL = 0.002;
/** Momentum can deliver huge deltas; past this a single event would teleport. */
const MAX_WHEEL_DELTA = 180;
/** A press that travels less than this is a click on the floor, not a pan. */
const PAN_THRESHOLD = 4;

type DragState = {
  instanceId: string;
  /** Cell offset between the grabbed point and the item's origin cell. */
  grab: GridCell;
  elevation: number;
};

type PanState = {
  /** Pointer position when the press started, in screen px. */
  from: ScreenPoint;
  /** Camera focus when the press started, so the pan never drifts. */
  focus: ScreenPoint;
  moved: boolean;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function sameAnchor(
  a: SelectionAnchor | null,
  b: SelectionAnchor | null,
): boolean {
  if (!a || !b) return a === b;
  return (
    a.instanceId === b.instanceId &&
    a.x === b.x &&
    a.y === b.y &&
    a.isDesk === b.isDesk &&
    a.dragging === b.dragging
  );
}

/**
 * Top-right of the sprite's art, in CSS pixels relative to the canvas.
 * `autoDensity` keeps stage space in CSS pixels, so these drop straight into an
 * absolutely positioned style over the canvas.
 */
function anchorOf(
  sprite: Sprite,
  instanceId: string,
  item: PlacedItem,
  draggingId: string | undefined,
): SelectionAnchor {
  const bounds = sprite.getBounds();
  return {
    instanceId,
    x: Math.round(bounds.maxX),
    y: Math.round(bounds.minY),
    isDesk: assetOf(item).deskSurface !== undefined,
    dragging: draggingId === instanceId,
  };
}

export class StudioScene {
  private app = new Application();
  private world = new Container();
  private floor = new Graphics();
  private footprintFill = new Graphics();
  private footprintRing = new Graphics();
  private itemLayer = new Container({ sortableChildren: true });
  private sprites = new Map<string, Sprite>();
  private drag: DragState | undefined;
  private pan: PanState | undefined;
  /** World point held at the middle of the view. Panning moves it. */
  private focus: ScreenPoint = roomCenter();
  /** Quarter turns clockwise from the front view. */
  private turns: ViewState["turns"] = 0;
  /** While true, a resize re-fits the zoom instead of preserving it. */
  private followFit = true;
  private items: PlacedItem[] = [];
  private selectedId: string | null = null;
  /** Last anchor handed to React, so identical ones are not re-sent. */
  private anchor: SelectionAnchor | null = null;
  private resizeObserver: ResizeObserver | undefined;
  private detachInput: (() => void) | undefined;
  private destroyed = false;

  constructor(private readonly callbacks: SceneCallbacks) {}

  async mount(host: HTMLElement): Promise<void> {
    await Promise.all([
      this.app.init({
        background: BACKGROUND,
        antialias: true,
        resolution: Math.min(window.devicePixelRatio || 1, 2),
        autoDensity: true,
        preference: ["webgpu", "webgl"],
        resizeTo: host,
      }),
      loadStudioAssets(),
    ]);

    // A React strict-mode remount can unmount us while init is in flight.
    if (this.destroyed) {
      this.app.destroy({ removeView: true });
      return;
    }

    host.appendChild(this.app.canvas);

    this.world.addChild(
      this.floor,
      this.footprintFill,
      this.itemLayer,
      this.footprintRing,
    );
    this.app.stage.addChild(this.world);

    this.drawFloor();
    this.bindPointer();
    this.detachInput = this.bindDeviceInput();

    this.resizeObserver = new ResizeObserver(() => this.updateCamera());
    this.resizeObserver.observe(host);
    this.updateCamera();
  }

  destroy(): void {
    this.destroyed = true;
    this.resizeObserver?.disconnect();
    this.detachInput?.();
    this.sprites.clear();
    if (this.app.renderer) {
      this.app.destroy({ removeView: true }, { children: true });
    }
  }

  /** Reconciles the scene against the store. Safe to call on every change. */
  sync(items: PlacedItem[], selectedId: string | null): void {
    if (this.destroyed || !this.app.renderer) return;

    this.items = items;
    this.selectedId = selectedId;

    const live = new Set(items.map((item) => item.instanceId));
    for (const [instanceId, sprite] of this.sprites) {
      if (live.has(instanceId)) continue;
      this.itemLayer.removeChild(sprite);
      sprite.destroy();
      this.sprites.delete(instanceId);
    }

    for (const item of items) {
      const sprite =
        this.sprites.get(item.instanceId) ?? this.createSprite(item);
      this.positionSprite(sprite, item);
    }

    this.drawSelection();
    this.reportSelection();
  }

  private createSprite(item: PlacedItem): Sprite {
    const asset = assetOf(item);
    const sprite = new Sprite(Texture.from(asset.id));

    sprite.label = item.instanceId;
    sprite.anchor.set(
      asset.anchor.x / asset.width,
      asset.anchor.y / asset.height,
    );
    sprite.scale.set(1 / ASSET_PIXEL_RATIO);
    sprite.eventMode = "static";
    sprite.cursor = "grab";

    sprite.on("pointerdown", (event: FederatedPointerEvent) =>
      this.beginDrag(item.instanceId, event),
    );

    this.itemLayer.addChild(sprite);
    this.sprites.set(item.instanceId, sprite);
    return sprite;
  }

  private positionSprite(sprite: Sprite, item: PlacedItem): void {
    const asset = assetOf(item);
    const elevation = elevationOf(item, this.items);
    const point = anchorToScreen(item.cell, asset.footprint, elevation);

    sprite.position.set(point.x, point.y);
    sprite.zIndex = zIndexOf(item, this.items);
    sprite.alpha = this.drag?.instanceId === item.instanceId ? 0.75 : 1;
  }

  private drawFloor(): void {
    this.floor.clear();
    this.floor.poly(roomOutline()).fill(FLOOR_FILL);

    for (const [from, to] of roomGridLines()) {
      this.floor.moveTo(from.x, from.y).lineTo(to.x, to.y);
    }
    this.floor.stroke({ width: 1, color: FLOOR_LINE, alpha: 0.8 });

    this.floor.poly(roomOutline()).stroke({ width: 2, color: FLOOR_EDGE });
  }

  /**
   * Selection is shown twice: a tinted footprint under the item, and a ring
   * above it. Tall art covers its own footprint, so the under-layer alone would
   * be invisible.
   */
  private drawSelection(): void {
    this.footprintFill.clear();
    this.footprintRing.clear();
    if (!this.selectedId) return;

    const item = this.items.find(
      (candidate) => candidate.instanceId === this.selectedId,
    );
    if (!item) return;

    const asset = assetOf(item);
    const elevation = elevationOf(item, this.items);

    for (let dx = 0; dx < asset.footprint.w; dx++) {
      for (let dy = 0; dy < asset.footprint.d; dy++) {
        const diamond = tileDiamond(item.cell.x + dx, item.cell.y + dy).map(
          (value, index) => (index % 2 === 0 ? value : value - elevation),
        );
        this.footprintFill.poly(diamond).fill({ color: SELECTION, alpha: 0.2 });
        this.footprintRing
          .poly(diamond)
          .stroke({ width: 2, color: SELECTION, alpha: 0.55 });
      }
    }
  }

  /**
   * Tells React where to pin the selected item's toolbar. The sprite's own
   * bounds are used rather than the grid, so the anchor tracks the art the user
   * actually sees, including a tall monitor that overhangs its footprint.
   */
  private reportSelection(): void {
    const sprite = this.selectedId
      ? this.sprites.get(this.selectedId)
      : undefined;

    const item = this.items.find(
      (candidate) => candidate.instanceId === this.selectedId,
    );

    const next: SelectionAnchor | null =
      sprite && item && this.selectedId
        ? anchorOf(sprite, this.selectedId, item, this.drag?.instanceId)
        : null;

    // Panning calls this on every pointer frame; most frames say nothing new.
    if (sameAnchor(this.anchor, next)) return;
    this.anchor = next;
    this.callbacks.onSelectionChange(next);
  }

  private bindPointer(): void {
    const stage = this.app.stage;
    stage.eventMode = "static";
    stage.hitArea = this.app.screen;
    // Items carry "grab", so the floor gets a cursor of its own.
    stage.cursor = "move";

    stage.on("pointerdown", (event: FederatedPointerEvent) => {
      // Reached only when the press misses every sprite.
      if (event.target === stage) this.beginPan(event);
    });

    stage.on("globalpointermove", (event: FederatedPointerEvent) => {
      this.updatePan(event);
      this.updateDrag(event);
    });
    stage.on("pointerup", () => this.release());
    stage.on("pointerupoutside", () => this.release());
  }

  private release(): void {
    this.endPan();
    this.endDrag();
  }

  private beginDrag(instanceId: string, event: FederatedPointerEvent): void {
    const item = this.items.find(
      (candidate) => candidate.instanceId === instanceId,
    );
    if (!item) return;

    this.callbacks.onSelect(instanceId);

    const elevation = elevationOf(item, this.items);
    const pointer = this.cellUnderPointer(event, elevation);
    this.drag = {
      instanceId,
      grab: { x: pointer.x - item.cell.x, y: pointer.y - item.cell.y },
      elevation,
    };

    const sprite = this.sprites.get(instanceId);
    if (sprite) {
      sprite.cursor = "grabbing";
      sprite.alpha = 0.75;
    }
    this.reportSelection();
  }

  private updateDrag(event: FederatedPointerEvent): void {
    if (!this.drag) return;

    const pointer = this.cellUnderPointer(event, this.drag.elevation);
    this.callbacks.onMove(this.drag.instanceId, {
      x: pointer.x - this.drag.grab.x,
      y: pointer.y - this.drag.grab.y,
    });
  }

  private endDrag(): void {
    if (!this.drag) return;

    const sprite = this.sprites.get(this.drag.instanceId);
    if (sprite) {
      sprite.cursor = "grab";
      sprite.alpha = 1;
    }
    this.drag = undefined;
    this.reportSelection();
  }

  private beginPan(event: FederatedPointerEvent): void {
    this.pan = {
      from: { x: event.global.x, y: event.global.y },
      focus: { ...this.focus },
      moved: false,
    };
  }

  /**
   * Moves the floor with the pointer one-for-one. The focus is recomputed from
   * the press anchor each frame, so hitting a clamp and coming back lands the
   * camera exactly where the pointer says it should be.
   */
  private updatePan(event: FederatedPointerEvent): void {
    if (!this.pan) return;

    const dx = event.global.x - this.pan.from.x;
    const dy = event.global.y - this.pan.from.y;
    if (!this.pan.moved && Math.hypot(dx, dy) < PAN_THRESHOLD) return;

    this.pan.moved = true;
    // Each axis divides by its own scale: on a mirrored view x carries the
    // mirror's sign, and panning is a screen-space gesture, so a drag right
    // moves the room right whichever way it faces.
    this.focus = {
      x: this.pan.focus.x - dx / this.world.scale.x,
      y: this.pan.focus.y - dy / this.world.scale.y,
    };
    this.applyFocus();
  }

  private endPan(): void {
    if (!this.pan) return;

    // A press that went nowhere was a click on empty floor.
    if (!this.pan.moved) this.callbacks.onSelect(null);
    this.pan = undefined;
  }

  /** Converts a pointer event to a grid cell, undoing the item's elevation. */
  private cellUnderPointer(
    event: FederatedPointerEvent,
    elevation: number,
  ): GridCell {
    const local = this.world.toLocal(event.global);
    const tile = screenToTile(local.x, local.y + elevation);
    return { x: Math.round(tile.x), y: Math.round(tile.y) };
  }

  /**
   * Wheel and keyboard, on the DOM rather than through Pixi. Pixi registers its
   * own wheel listener as passive, so a federated handler could not call
   * preventDefault, and the browser would zoom the whole page on a pinch.
   */
  private bindDeviceInput(): () => void {
    const canvas = this.app.canvas;

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();

      const deltaX = normalizeWheel(
        event.deltaX,
        event.deltaMode,
        this.app.screen.width,
      );
      const deltaY = normalizeWheel(
        event.deltaY,
        event.deltaMode,
        this.app.screen.height,
      );

      // A trackpad pinch arrives as a wheel event with ctrlKey set, which is
      // also the convention for modifier-zoom with a mouse.
      if (event.ctrlKey || event.metaKey) {
        const rect = canvas.getBoundingClientRect();
        this.zoomBy(Math.exp(-deltaY * ZOOM_PER_PIXEL), {
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
        });
        return;
      }

      // Two-finger scroll pans, the same as dragging the floor. Per-axis for
      // the same reason as the pan above.
      this.focus = {
        x: this.focus.x + deltaX / this.world.scale.x,
        y: this.focus.y + deltaY / this.world.scale.y,
      };
      this.applyFocus();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return;

      const command = zoomShortcut(event);
      if (!command) return;

      event.preventDefault();
      command(this);
    };

    canvas.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("keydown", onKeyDown);

    return () => {
      canvas.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKeyDown);
    };
  }

  zoomIn(): void {
    this.zoomBy(ZOOM_STEP);
  }

  zoomOut(): void {
    this.zoomBy(1 / ZOOM_STEP);
  }

  /** Absolute zoom, held at the middle of the view. 1 is one world px per screen px. */
  zoomTo(zoom: number): void {
    this.setZoom(zoom, this.viewCenter());
  }

  zoomToFit(): void {
    if (this.destroyed || !this.app.renderer) return;

    this.focus = roomCenter();
    this.applyScale(this.fitZoom());
    this.followFit = true;
    this.applyFocus();
    this.callbacks.onCameraChange(this.cameraState());
  }

  /** Steps the view one quarter turn anticlockwise around the room. */
  rotateViewLeft(): void {
    this.setViewTurns(rotatedLeft(this.turns));
  }

  /** Steps the view one quarter turn clockwise around the room. */
  rotateViewRight(): void {
    this.setViewTurns(rotatedRight(this.turns));
  }

  /**
   * Turns the room to a new side. Until art has real facings, a turn to an odd
   * side mirrors the whole world container rather than each sprite: art,
   * positions, tiles and the drag mapping flip together, so a laptop standing
   * on a desk is still standing on it afterwards, and the floor — symmetric
   * about its centre — looks untouched.
   */
  private setViewTurns(turns: number): void {
    if (this.destroyed || !this.app.renderer) return;

    const view = viewState(turns);
    if (view.turns === this.turns) return;

    this.turns = view.turns;
    this.applyScale(this.zoom());

    this.reportSelection();
    this.callbacks.onViewChange(view);
  }

  private zoomBy(factor: number, at?: ScreenPoint): void {
    this.setZoom(this.zoom() * factor, at ?? this.viewCenter());
  }

  /** Zoom magnitude. The world's x scale carries the view's mirror sign. */
  private zoom(): number {
    return Math.abs(this.world.scale.x);
  }

  /** Applies a zoom magnitude, mirroring the world on the odd views. */
  private applyScale(zoom: number): void {
    this.world.scale.set(viewState(this.turns).mirrored ? -zoom : zoom, zoom);
  }

  /**
   * Changes the zoom while holding the world point under `at` still, which is
   * what makes pinching and wheel-zooming feel anchored to the pointer. The
   * mirrored x axis anchors with the sign flipped, but the gesture reads the
   * same on screen whichever way the room faces.
   */
  private setZoom(zoom: number, at: ScreenPoint): void {
    if (this.destroyed || !this.app.renderer) return;

    const from = this.zoom();
    const to = clamp(zoom, MIN_ZOOM, MAX_ZOOM);
    if (to === from) return;

    const center = this.viewCenter();
    const mirror = viewState(this.turns).mirrored ? -1 : 1;
    this.focus = {
      x: this.focus.x + (at.x - center.x) * mirror * (1 / from - 1 / to),
      y: this.focus.y + (at.y - center.y) * (1 / from - 1 / to),
    };

    this.followFit = false;
    this.applyScale(to);
    this.applyFocus();
    this.callbacks.onCameraChange(this.cameraState());
  }

  private cameraState(): CameraState {
    const zoom = this.zoom();
    return {
      zoom,
      canZoomIn: zoom < MAX_ZOOM,
      canZoomOut: zoom > MIN_ZOOM,
    };
  }

  private viewCenter(): ScreenPoint {
    return { x: this.app.screen.width / 2, y: this.app.screen.height / 2 };
  }

  /** Zoom that shows the whole room, with a little slack around it. */
  private fitZoom(): number {
    const { width, height } = this.app.screen;
    const bounds = roomBounds();
    return clamp(
      Math.min(
        (width - VIEWPORT_PADDING) / bounds.width,
        (height - VIEWPORT_PADDING) / bounds.height,
      ),
      MIN_ZOOM,
      MAX_ZOOM,
    );
  }

  /**
   * Re-applies the camera after a resize. The zoom is re-fitted only while the
   * user has not set one of their own; a pan or zoom always survives.
   */
  private updateCamera(): void {
    if (this.destroyed || !this.app.renderer) return;

    if (this.followFit) this.applyScale(this.fitZoom());
    this.applyFocus();
    this.callbacks.onCameraChange(this.cameraState());
  }

  /**
   * Points the camera at `focus`, first pulling it back onto the floor. Keeping
   * the focus inside the room means any corner can be brought into view and the
   * room can never be dragged off screen.
   */
  private applyFocus(): void {
    const { width, height } = this.app.screen;
    const bounds = roomBounds();

    this.focus = {
      x: clamp(this.focus.x, bounds.left, bounds.right),
      y: clamp(this.focus.y, bounds.top, bounds.bottom),
    };

    this.world.position.set(
      width / 2 - this.focus.x * this.world.scale.x,
      height / 2 - this.focus.y * this.world.scale.y,
    );

    // The one funnel every camera change passes through, so the toolbar stays
    // pinned to its item through pans, zooms and resizes alike.
    this.reportSelection();
  }
}

/** Wheel deltas arrive in pixels, lines or pages depending on the device. */
function normalizeWheel(delta: number, mode: number, pageSize: number): number {
  const pixels =
    mode === WheelEvent.DOM_DELTA_LINE
      ? delta * 16
      : mode === WheelEvent.DOM_DELTA_PAGE
        ? delta * pageSize
        : delta;

  return clamp(pixels, -MAX_WHEEL_DELTA, MAX_WHEEL_DELTA);
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
  );
}

/**
 * The shortcuts the zoom menu advertises. Digit codes rather than `key`, because
 * shifted number keys produce punctuation that varies by layout.
 */
function zoomShortcut(
  event: KeyboardEvent,
): ((scene: StudioScene) => void) | undefined {
  if (event.altKey || event.ctrlKey || event.metaKey) return undefined;

  if (event.shiftKey) {
    if (event.code === "Digit0") return (scene) => scene.zoomTo(1);
    if (event.code === "Digit1") return (scene) => scene.zoomToFit();
    return undefined;
  }

  if (event.key === "+" || event.key === "=") return (scene) => scene.zoomIn();
  if (event.key === "-") return (scene) => scene.zoomOut();
  return undefined;
}
