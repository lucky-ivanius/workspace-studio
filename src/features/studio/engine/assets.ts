import { Assets, type Texture } from "pixi.js";
import { ASSET_LIST, sourcePixelSize } from "../model/assets";

export const STUDIO_BUNDLE = "studio";

let initialised: Promise<void> | undefined;

/**
 * Registers every registry asset as one bundle. Textures are authored at 2x and
 * drawn at half scale, which keeps them sharp on retina displays.
 */
export function loadStudioAssets(): Promise<void> {
  initialised ??= (async () => {
    await Assets.init({
      manifest: {
        bundles: [
          {
            name: STUDIO_BUNDLE,
            assets: ASSET_LIST.map((spec) => ({
              alias: spec.id,
              src: spec.src,
            })),
          },
        ],
      },
    });
    await Assets.loadBundle(STUDIO_BUNDLE);

    if (process.env.NODE_ENV !== "production") {
      reportSizeMismatches();
    }
  })();

  return initialised;
}

/**
 * The grid places art by its declared size, so a file that does not match its
 * registry entry will sit at the wrong spot. Say so loudly instead of leaving
 * someone to debug a subtly misaligned sprite.
 */
function reportSizeMismatches(): void {
  for (const spec of ASSET_LIST) {
    const texture = Assets.get<Texture>(spec.id);
    if (!texture) continue;

    const expected = sourcePixelSize(spec);
    const actual = {
      width: texture.source.pixelWidth,
      height: texture.source.pixelHeight,
    };

    if (actual.width === expected.width && actual.height === expected.height) {
      continue;
    }

    console.error(
      `Asset "${spec.id}" is ${actual.width}x${actual.height} but the registry ` +
        `declares ${expected.width}x${expected.height}. Redraw the PNG at the ` +
        `declared size, or update its footprint and heightCm in model/assets.ts.`,
    );
  }
}
