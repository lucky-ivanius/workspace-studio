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
  ROOM_COLS,
  ROOM_ROWS,
  roomBounds,
  roomOutline,
  screenToTile,
  tileDiamond,
} from "../model/grid";
import { assetOf, elevationOf, zIndexOf } from "../model/placement";
import type { PlacedItem } from "../model/types";
import { loadStudioAssets } from "./assets";

export type SceneCallbacks = {
  onSelect: (instanceId: string | null) => void;
  /**
   * Asked on every drag frame. Illegal targets are rejected by the store, which
   * simply leaves the item where it was.
   */
  onMove: (instanceId: string, cell: GridCell) => void;
};

const BACKGROUND = 0xf4f1ea;
const FLOOR_FILL = 0xe6e0d4;
const FLOOR_LINE = 0xcfc6b4;
const SELECTION = 0x4f46e5;
const VIEWPORT_PADDING = 96;

type DragState = {
  instanceId: string;
  /** Cell offset between the grabbed point and the item's origin cell. */
  grab: GridCell;
  elevation: number;
};

export class StudioScene {
  private app = new Application();
  private world = new Container();
  private floor = new Graphics();
  private footprintFill = new Graphics();
  private footprintRing = new Graphics();
  private itemLayer = new Container({ sortableChildren: true });
  private sprites = new Map<string, Sprite>();
  private drag: DragState | undefined;
  private items: PlacedItem[] = [];
  private selectedId: string | null = null;
  private resizeObserver: ResizeObserver | undefined;
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

    this.resizeObserver = new ResizeObserver(() => this.centreCamera());
    this.resizeObserver.observe(host);
    this.centreCamera();
  }

  destroy(): void {
    this.destroyed = true;
    this.resizeObserver?.disconnect();
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

    for (let x = 0; x < ROOM_COLS; x++) {
      for (let y = 0; y < ROOM_ROWS; y++) {
        this.floor
          .poly(tileDiamond(x, y))
          .stroke({ width: 1, color: FLOOR_LINE, alpha: 0.9 });
      }
    }
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

  private bindPointer(): void {
    const stage = this.app.stage;
    stage.eventMode = "static";
    stage.hitArea = this.app.screen;

    stage.on("pointerdown", (event: FederatedPointerEvent) => {
      // Reached only when the press misses every sprite.
      if (event.target === stage) this.callbacks.onSelect(null);
    });

    stage.on("globalpointermove", (event: FederatedPointerEvent) =>
      this.updateDrag(event),
    );
    stage.on("pointerup", () => this.endDrag());
    stage.on("pointerupoutside", () => this.endDrag());
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

  private centreCamera(): void {
    if (this.destroyed || !this.app.renderer) return;

    const { width, height } = this.app.screen;
    const bounds = roomBounds();
    const scale = Math.min(
      (width - VIEWPORT_PADDING) / bounds.width,
      (height - VIEWPORT_PADDING) / bounds.height,
      1,
    );

    this.world.scale.set(scale);
    this.world.position.set(
      width / 2 - (bounds.left + bounds.width / 2) * scale,
      height / 2 - (bounds.top + bounds.height / 2) * scale,
    );
  }
}
