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

Photoreal renders and clean alpha fight each other in most models. If the edges
come back fringed, or you get a white card instead of transparency, re-run with
`on a flat neutral mid-grey #808080 background, no gradient, no vignette` in
place of the transparency line and key it out afterwards. Grey keys far more
cleanly than white against a product that is mostly matte black.

## The prompt

```text
Turn the product in IMAGE 1 into a single photorealistic isometric sprite for a
room-builder, matching the projection and volume of the grey block in IMAGE 2.

IMAGE 1 is the subject. Study it closely and reproduce the real product: its
silhouette, proportions, exact colours, and above all its actual materials and
finishes. The result should look like the same physical object, photographed
again from a different angle — not an illustration of it. Ignore only the
photo's camera angle, its lighting and its background.

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

RENDERING — photorealistic, not illustrated:
- Treat this as a physically-based 3D render of the real product: a product
  photographer's studio shot, taken with an orthographic lens locked to the
  isometric angle above. Octane/Cycles quality, high sample count, clean.
- Physically accurate materials with real surface response: correct roughness,
  correct specular falloff, correct sheen. Anisotropic streaking on brushed
  metal, fine moulding texture on matte plastic, visible weave on fabric, grain
  and pore on wood, real depth on glass and gloss.
- Keep the real manufacturing detail: panel gaps, seams, screw recesses,
  chamfered edges, moulded vents, rubber feet, the slight bevel where two
  mouldings meet. These are what make it read as a real object.
- Soft contact shadow and ambient occlusion in every crevice and under every
  overhang. Subtle fresnel at grazing edges.
- Realistic materials, realistic micro-detail — but still a parallel projection.
  Photoreal shading does NOT mean photographic perspective. The geometry rules
  above override the camera realism every time.

MATERIALS: {{MATERIALS}}

LIGHTING:
- Soft studio lighting: one large key softbox from the upper left, a weaker fill
  from the right, and a dim top bounce. Consistent across every asset.
- Top surfaces read lightest, down-left surfaces mid, down-right surfaces
  darkest, so the form still reads as isometric volume.
- Specular highlights are soft and broad, not hot pinpricks.
- No cast shadow on the ground and no ground plane or backdrop — only the
  product's own self-shadowing, plus a soft contact darkening right where it
  meets the diamond.
- Nothing from outside the frame may appear in reflections: no studio windows,
  no softbox rectangles, no room, no photographer.

FORM:
- Keep the silhouette, the proportions, the real colours, and the details that
  identify the product: {{SIGNATURE_DETAILS}}.
- Logos and badges only as a faint embossed or printed suggestion at the right
  place and scale. No legible text anywhere — it turns to mush at sprite size.
- It has to read at small size against a warm off-white floor (#E6E0D4) on a
  #F4F1EA background, so keep the overall value separation strong and the
  silhouette crisp even while the surfaces stay photoreal.
- No illustration treatments: no outline, no cel shading, no flat vector fills,
  no toy or clay or low-poly look, no cartoon proportions, no stylised gloss.

OUTPUT:
- One product, centred, alone, on a fully transparent background.
- Square canvas, 1024x1024, product centred with a little margin. I will scale
  and crop to {{CANVAS}} myself.
- Nothing else in frame: no desk, no floor, no wall, no room, no props, no
  people, no packaging, no shadow plate, no mockup frame, no caption, no
  annotation, no watermark, no colour swatches, no multiple angles, no
  turnaround sheet.

PRODUCT: {{NAME}} — {{DESCRIPTION}}
REAL SIZE: {{WIDTH_CM}} cm wide x {{DEPTH_CM}} cm deep x {{HEIGHT_CM}} cm tall.
It sits on {{SURFACE}}.
```

### Variables

| Variable                | Where it comes from                                                        |
| ----------------------- | -------------------------------------------------------------------------- |
| `{{NAME}}`              | `name` + `brand` on the catalog entry                                      |
| `{{DESCRIPTION}}`       | one line from `summary`: form, colour, finish                               |
| `{{MATERIALS}}`         | every surface named with its finish and roughness — see below               |
| `{{SIGNATURE_DETAILS}}` | the 2–3 things that identify it — stand shape, accent colour, panel bezel  |
| `{{WIDTH_CM}}` etc.     | `footprint.w * 20`, `footprint.d * 20`, `heightCm`                          |
| `{{SURFACE}}`           | `"a desk"` or `"the floor"`, from `studio.surface`                          |
| `{{CANVAS}}`            | the size `pnpm assets:placeholders --for <slug>` printed                    |
| `{{FACING}}`            | one sentence on what "front" means for this product — see below            |

`{{MATERIALS}}` is what buys the realism, so spend the most words here. Name each
surface, its material, its finish and how glossy it is — the model guesses badly
left to itself, and a monitor rendered in uniform semi-gloss plastic looks like a
toy. Read the finishes off the product photo rather than off the spec sheet.

- Monitor — `Bezel and rear shell in matte charcoal ABS with a fine sandblasted moulding texture, roughness high, almost no specular. Screen is anti-glare matte glass, very dark grey when off, a faint even sheen rather than a mirror. Neck in dark satin-anodised aluminium with soft vertical anisotropic streaking. Base in the same matte plastic with small black rubber pads underneath.`
- Chair — `Backrest in black elastic mesh, real weave visible, slightly translucent at the edges. Seat in woven fabric with visible fibre. Frame in matte black nylon, armrest pads in soft-touch rubber, gas lift in polished chrome with a crisp vertical highlight, castors in dark glossy nylon.`
- Desk — `Top in light oak veneer, real grain and pores, matte lacquer with a gentle broad sheen. Legs in powder-coated steel, fine orange-peel texture, low gloss. Visible weld seams and adjustment holes.`

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
MATERIALS: Bezel and rear shell in matte charcoal ABS plastic with a fine
sandblasted moulding texture — high roughness, almost no specular, so it absorbs
the key light rather than catching it. The panel itself is anti-glare matte
glass: near-black when idle, with a faint even sheen and no mirror reflection.
Neck in dark satin-anodised aluminium with soft vertical anisotropic streaking
and a crisp chamfer where it meets the shell. Base in the same matte plastic,
small black rubber feet underneath. Visible panel gaps around the rear shell,
moulded ventilation slots, and ambient occlusion where the neck joins the base.
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
