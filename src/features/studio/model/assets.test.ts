import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { ASSET_LIST, footprintCm, sourcePixelSize } from "./assets";

const PUBLIC_DIR = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../public",
);

/** Width and height from a PNG's IHDR chunk. */
function pngSize(file: string) {
  const header = readFileSync(file).subarray(0, 24);

  assert.equal(
    header.subarray(0, 8).toString("hex"),
    "89504e470d0a1a0a",
    `${file} is not a PNG`,
  );
  assert.equal(header.subarray(12, 16).toString("ascii"), "IHDR");

  return { width: header.readUInt32BE(16), height: header.readUInt32BE(20) };
}

test("every registry asset has a PNG at exactly its declared size", () => {
  for (const spec of ASSET_LIST) {
    const file = resolve(PUBLIC_DIR, spec.src.replace(/^\//, ""));
    const expected = sourcePixelSize(spec);

    assert.deepEqual(
      pngSize(file),
      expected,
      `${spec.id}: file is the wrong size. Redraw it at ` +
        `${expected.width}x${expected.height}, or change its footprint and ` +
        `heightCm in model/assets.ts.`,
    );
  }
});

test("asset ids are unique", () => {
  const ids = ASSET_LIST.map((spec) => spec.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("the declared size is derived from the footprint and height", () => {
  // A 2x1 monitor 50 cm tall: span 3, so 192 wide, 96 of base plus 80 of body.
  const monitor = ASSET_LIST.find((spec) => spec.id === "monitor-27-4k");
  assert.ok(monitor);

  assert.equal(monitor.width, 192);
  assert.equal(monitor.height, 176);
  assert.deepEqual(monitor.anchor, { x: 96, y: 128 });
  assert.deepEqual(sourcePixelSize(monitor), { width: 384, height: 352 });
});

test("a footprint maps to real centimetres", () => {
  const desk = ASSET_LIST.find((spec) => spec.id === "desk-electric-standing");
  assert.ok(desk);

  // Four tiles by two at 40 cm each.
  assert.deepEqual(footprintCm(desk), { width: 160, depth: 80 });
});

test("only desks carry a surface, and it sits at the desk's own height", () => {
  for (const spec of ASSET_LIST) {
    if (!spec.deskSurface) continue;

    assert.equal(spec.surface, "floor", `${spec.id} should stand on the floor`);
    assert.deepEqual(spec.deskSurface.footprint, spec.footprint);
    assert.ok(spec.deskSurface.elevation > 0);
  }
});

test("desk-mounted art is short enough to read on a desk", () => {
  for (const spec of ASSET_LIST) {
    if (spec.surface !== "desk") continue;
    assert.ok(
      spec.heightCm <= 60,
      `${spec.id} is ${spec.heightCm}cm, too tall to sit on a desk`,
    );
  }
});
