#!/usr/bin/env node
/**
 * Renders placeholder isometric art for every entry in the asset registry.
 *
 *   pnpm assets:placeholders          # only fills in missing files
 *   pnpm assets:placeholders --force  # redraws everything
 *
 * Each PNG is written at the exact size the registry declares, so real art can
 * replace a placeholder file-for-file without touching any code. The generator
 * draws the footprint rhombus the grid actually uses plus a block of the
 * declared height, which makes alignment mistakes obvious on screen.
 *
 * Existing files are left alone by default so real art is never clobbered.
 *
 * PNGs are encoded here with zlib alone — no image dependency to install.
 */

import { mkdir, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

import {
  ASSET_LIST,
  ASSET_PIXEL_RATIO,
  sourcePixelSize,
} from "../src/features/studio/model/assets.ts";
import {
  TILE_HEIGHT,
  TILE_WIDTH,
  tileToScreen,
} from "../src/features/studio/model/grid.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = resolve(ROOT, "public/assets/studio");

// Readable families so items stay distinguishable before real art lands.
const PALETTES = {
  desk: { top: [196, 154, 108], left: [160, 119, 78], right: [132, 95, 60] },
  chair: { top: [96, 108, 128], left: [72, 83, 102], right: [55, 64, 80] },
  monitor: { top: [84, 92, 104], left: [58, 65, 76], right: [42, 48, 58] },
  lamp: { top: [240, 196, 108], left: [206, 158, 74], right: [170, 126, 54] },
  plant: { top: [104, 168, 112], left: [76, 134, 86], right: [56, 105, 66] },
  rug: { top: [198, 128, 122], left: [168, 102, 98], right: [142, 84, 80] },
  default: {
    top: [150, 140, 196],
    left: [118, 108, 166],
    right: [92, 84, 134],
  },
};

/** Stand-in blocks, tinted by shape class so a room of them still reads. */
const GENERIC_PALETTES = {
  "generic-screen": PALETTES.monitor,
  "generic-desk-small": {
    top: [172, 178, 190],
    left: [138, 145, 158],
    right: [110, 117, 129],
  },
  "generic-desk-medium": {
    top: [142, 160, 188],
    left: [112, 129, 156],
    right: [88, 103, 127],
  },
  "generic-desk-tall": {
    top: [164, 146, 190],
    left: [132, 115, 158],
    right: [105, 90, 129],
  },
  "generic-floor-small": {
    top: [138, 184, 180],
    left: [108, 151, 148],
    right: [84, 122, 119],
  },
  "generic-floor-large": {
    top: [186, 164, 136],
    left: [152, 131, 106],
    right: [123, 104, 82],
  },
  "generic-floor-wide": {
    top: [190, 160, 170],
    left: [156, 128, 138],
    right: [126, 101, 111],
  },
};

function paletteFor(id) {
  if (GENERIC_PALETTES[id]) return GENERIC_PALETTES[id];
  const family = Object.keys(PALETTES).find((key) => id.startsWith(`${key}-`));
  return PALETTES[family ?? "default"];
}

function createCanvas(width, height) {
  return { width, height, data: new Uint8Array(width * height * 4) };
}

function blend(canvas, x, y, [r, g, b], alpha) {
  if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) return;
  const i = (y * canvas.width + x) * 4;
  const dstA = canvas.data[i + 3] / 255;
  const outA = alpha + dstA * (1 - alpha);
  if (outA === 0) return;

  const src = [r, g, b];
  for (let c = 0; c < 3; c++) {
    canvas.data[i + c] = Math.round(
      (src[c] * alpha + canvas.data[i + c] * dstA * (1 - alpha)) / outA,
    );
  }
  canvas.data[i + 3] = Math.round(outA * 255);
}

function insidePolygon(points, px, py) {
  let inside = false;
  for (let i = 0, j = points.length - 2; i < points.length; j = i, i += 2) {
    const xi = points[i];
    const yi = points[i + 1];
    const xj = points[j];
    const yj = points[j + 1];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi)
      inside = !inside;
  }
  return inside;
}

/** 2x2 supersampled polygon fill; placeholders only, so brute force is fine. */
function fillPolygon(canvas, points, colour, alpha = 1) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < points.length; i += 2) {
    minX = Math.min(minX, points[i]);
    maxX = Math.max(maxX, points[i]);
    minY = Math.min(minY, points[i + 1]);
    maxY = Math.max(maxY, points[i + 1]);
  }

  for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
    for (let x = Math.floor(minX); x <= Math.ceil(maxX); x++) {
      let hits = 0;
      for (const [ox, oy] of [
        [0.25, 0.25],
        [0.75, 0.25],
        [0.25, 0.75],
        [0.75, 0.75],
      ]) {
        if (insidePolygon(points, x + ox, y + oy)) hits++;
      }
      if (hits > 0) blend(canvas, x, y, colour, (hits / 4) * alpha);
    }
  }
}

function translate(points, dx, dy) {
  return points.map((value, index) =>
    index % 2 === 0 ? value + dx : value + dy,
  );
}

/** Outline of a w x d footprint in screen space, relative to its base centre. */
function footprintRhombus({ w, d }, scale) {
  const centre = tileToScreen((w - 1) / 2, (d - 1) / 2);
  const corner = (gx, gy, dx, dy) => {
    const point = tileToScreen(gx, gy);
    return [
      (point.x - centre.x + dx) * scale,
      (point.y - centre.y + dy) * scale,
    ];
  };

  return [
    ...corner(0, 0, 0, -TILE_HEIGHT / 2),
    ...corner(w - 1, 0, TILE_WIDTH / 2, 0),
    ...corner(w - 1, d - 1, 0, TILE_HEIGHT / 2),
    ...corner(0, d - 1, -TILE_WIDTH / 2, 0),
  ];
}

function encodePng(canvas) {
  const { width, height, data } = canvas;
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    const rowStart = y * (width * 4 + 1);
    raw[rowStart] = 0;
    Buffer.from(data.buffer, y * width * 4, width * 4).copy(raw, rowStart + 1);
  }

  const chunk = (type, body) => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(body.length);
    const typed = Buffer.concat([Buffer.from(type, "ascii"), body]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(typed));
    return Buffer.concat([length, typed, crc]);
  };

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function render(spec) {
  const scale = ASSET_PIXEL_RATIO;
  const { width, height } = sourcePixelSize(spec);
  const canvas = createCanvas(width, height);

  const anchorX = spec.anchor.x * scale;
  const anchorY = spec.anchor.y * scale;
  const baseHeight = (spec.footprint.w + spec.footprint.d) * (TILE_HEIGHT / 2);
  const standHeight = (spec.height - baseHeight) * scale;

  const base = translate(
    footprintRhombus(spec.footprint, scale),
    anchorX,
    anchorY,
  );
  const top = translate(base, 0, -standHeight);
  const palette = paletteFor(spec.id);

  // Contact shadow on the grid.
  fillPolygon(canvas, base, [20, 24, 32], 0.18);

  const [, , rightX, rightY, frontX, frontY, leftX, leftY] = base;
  const [, , , topRightY, topFrontX, topFrontY, topLeftX, topLeftY] = top;

  // Right-hand wall, left-hand wall, then the lit top face.
  fillPolygon(
    canvas,
    [rightX, rightY, frontX, frontY, topFrontX, topFrontY, rightX, topRightY],
    palette.right,
  );
  fillPolygon(
    canvas,
    [leftX, leftY, frontX, frontY, topFrontX, topFrontY, topLeftX, topLeftY],
    palette.left,
  );
  fillPolygon(canvas, top, palette.top);

  // Anchor tick: the point the grid places at the footprint centre.
  for (let offset = -3; offset <= 3; offset++) {
    blend(
      canvas,
      Math.round(anchorX) + offset,
      Math.round(anchorY),
      [255, 255, 255],
      0.75,
    );
    blend(
      canvas,
      Math.round(anchorX),
      Math.round(anchorY) + offset,
      [255, 255, 255],
      0.75,
    );
  }

  return encodePng(canvas);
}

await mkdir(OUT_DIR, { recursive: true });

const force = process.argv.includes("--force");
let written = 0;
let skipped = 0;

for (const spec of ASSET_LIST) {
  const file = resolve(OUT_DIR, `${spec.id}.png`);
  const { width, height } = sourcePixelSize(spec);

  if (!force && (await stat(file).catch(() => null))) {
    process.stdout.write(`  skip  ${spec.id}.png  (already exists)\n`);
    skipped += 1;
    continue;
  }

  await writeFile(file, render(spec));
  process.stdout.write(`  draw  ${spec.id}.png  ${width}x${height}\n`);
  written += 1;
}

process.stdout.write(`\nDrew ${written}, skipped ${skipped}, in ${OUT_DIR}\n`);
if (skipped > 0 && !force) {
  process.stdout.write("Pass --force to redraw existing files.\n");
}
