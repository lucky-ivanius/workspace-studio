# Generating product art with an image model

Every drawing in `public/assets/studio` has exactly one correct size and one
correct projection — see "The asset contract" in [FOUNDATION.md](./FOUNDATION.md).
This file is the prompt that turns a product photo into art that obeys it.

## Before you prompt

1. Set `studio.placeable: true` on the entry in `model/catalog.json`. Give it a
   real `footprint` and `heightCm` if the category stand-in is the wrong shape.
2. `pnpm assets:placeholders --for <slug>` — it prints the exact canvas and
   leaves a block PNG at that size, with a white tick on the anchor.
3. Feed the model two images:
   - **Image 1** — the product photo (`images[0].url` on the catalog entry).
   - **Image 2** — the placeholder block from step 2. This is the volume and
     projection the art has to fill.
4. Fill in the variables, paste the prompt, then scale the result to the exact
   canvas and overwrite the PNG. `pnpm test` fails if the size is wrong.

## The prompt

```text
Turn the product in IMAGE 1 into a single game-ready isometric sprite for a
room-builder, matching the projection and volume of the grey block in IMAGE 2.

IMAGE 1 is the subject: use it only for silhouette, proportion, colour and
material. Ignore its camera angle, its lighting and its background entirely.

IMAGE 2 is the geometry contract: the block's diamond base is the footprint, its
height is the headroom, and its faces show the exact camera. Replace the block
with the product. The product must stand on that same diamond and must not grow
past the block's top or sides.

PROJECTION — this is the strictest requirement:
- True 2:1 dimetric isometric, the classic video-game axonometric. Every
  receding edge runs at a 1:2 slope (26.57 degrees from horizontal). Not 30
  degrees, not true isometric.
- Parallel projection. No perspective, no vanishing point, no foreshortening,
  no lens distortion. Parallel edges stay parallel and keep their length.
- Camera is fixed high and in front. You see the top face plus the two front
  faces, nothing else.
- Axes: the WIDTH axis recedes down-and-right, the DEPTH axis recedes
  down-and-left. So the product's FRONT faces down-and-LEFT, and its back faces
  up-and-right. {{FACING}}
- Keep it vertical: no tilt, no rotation off the isometric axes.

LIGHTING:
- One soft light from the upper left, consistent with every other asset.
- Top faces lightest, the down-left faces mid-tone, the down-right faces
  darkest. Three clear value steps, flat within each face.
- No cast shadow, no ground plane, no reflection. At most a very soft contact
  darkening where the product meets the diamond.

STYLE:
- Clean, semi-flat vector 3D: flat base colours, two or three shading steps,
  crisp straight edges, a thin rim highlight on lit top edges.
- No outline, no cel-shade stroke, no photo texture, no noise, no grain, no
  gradient banding, no bloom, no glow spill.
- Simplify. Keep the silhouette, the proportions, the real colours, and the two
  or three details that make the product recognisable: {{SIGNATURE_DETAILS}}.
  Drop logos, badges and all text.
- It has to read at small size against a warm off-white floor (#E6E0D4) on a
  #F4F1EA background, so keep the values separated and the edges clean.

OUTPUT:
- One product, centred, alone, on a fully transparent background.
- Square canvas, 1024x1024, product centred with a little margin. I will scale
  and crop to {{CANVAS}} myself.
- Nothing else in frame: no desk, no floor, no wall, no room, no props, no
  people, no packaging, no shadow plate, no mockup frame, no label, no text, no
  watermark, no colour swatches, no multiple angles, no turnaround sheet.

PRODUCT: {{NAME}} — {{DESCRIPTION}}
REAL SIZE: {{WIDTH_CM}} cm wide x {{DEPTH_CM}} cm deep x {{HEIGHT_CM}} cm tall.
It sits on {{SURFACE}}.
```

### Variables

| Variable                | Where it comes from                                                       |
| ----------------------- | ------------------------------------------------------------------------- |
| `{{NAME}}`              | `name` + `brand` on the catalog entry                                     |
| `{{DESCRIPTION}}`       | one line from `summary`: form, colour, finish                             |
| `{{SIGNATURE_DETAILS}}` | the 2–3 things that identify it — stand shape, accent colour, panel bezel |
| `{{WIDTH_CM}}` etc.     | `footprint.w * 20`, `footprint.d * 20`, `heightCm`                        |
| `{{SURFACE}}`           | `"a desk"` or `"the floor"`, from `studio.surface`                        |
| `{{CANVAS}}`            | the size `pnpm assets:placeholders --for <slug>` printed                  |
| `{{FACING}}`            | one sentence on what "front" means for this product — see below           |

`{{FACING}}` is the line people get wrong, because a monitor's front and a
plant's front are not the same idea. Examples:

- Monitor — `The screen faces down-and-left, toward the viewer's lower left. You see the front of the panel and its left-facing edge; the stand's neck and base are visible below it.`
- Chair — `The seat back faces up-and-right and the seat faces down-and-left, so the chair looks like it is turned away from the camera toward a desk behind it.`
- Desk — `The long edge runs down-and-right. The user's side is the down-left long edge; put drawers and cable trays on the up-right side.`
- Lamp, plant, speaker — `Roughly symmetrical, so face its most characteristic side down-and-left.`

### Worked example — `34-4-k-curved-monitor-180-hz`

Canvas today is **256×272 px** (inherited from the `generic-screen` stand-in:
3×1 tiles, 45 cm). The base diamond fills the bottom 128 px, full canvas width.

```text
PRODUCT: Xiaomi Mi Curved 34" Gaming Monitor — a matte black ultrawide panel
with a 1500R curve, thin three-side bezel, a short cylindrical neck on a flat
V-shaped base.
REAL SIZE: 60 cm wide x 20 cm deep x 45 cm tall. It sits on a desk.
FACING: The screen faces down-and-left, toward the viewer's lower left. The
curve is visible as the panel's ends bending slightly toward the camera. You see
the front of the panel and its left-facing edge; the neck and base are visible
below it.
SIGNATURE DETAILS: the 1500R curve, the thin bezel with a slightly thicker chin,
the slim neck on a wide flat base, and a dim dark-red glow on the screen instead
of a readable image.
```

> The real panel is 810×243×521 mm, which is 4×1 tiles and 52 cm — not the 3×1
> and 45 cm it inherits. Declaring that in `catalog.json` moves the canvas to
> 320×326 px, so decide the shape before you generate the art.
