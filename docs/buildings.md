# Buildings (`web/js/buildings/`)

Everything that gets *made* in AGORA goes through here: the Build API (what prefabs and generated code build with), the prefab library, the "pencil, then paint" reveal, construction sites and massing sketches. All of it renders through the verbatim Red arch engine (`web/js/paint/`), which this module uses and never edits.

| file | what |
|---|---|
| `api.js` | `createBuildApi(ctx, kit)`: primitives, roofs, arches, ink openings, props, trees, materials (painted ramps / Lambert / clay), proxies. `compileAsset(code)`, `normalise`, `measure`, `RAMPS`, `LIMITS`, `SHADOWED`, `AssetError`, `internals(api)` |
| `trees.js` | `createTreeBuilders(base)`: the 3D trees behind `api.tree` / `olive` / `oak` / `lemon` / `pine` — round lumpy crowns stacked in height over a dark underside, a tapered leaning trunk, one smooth proxy per crown and one per trunk. Written because the kit's flat pine pads and `api.shrub` pancakes read as discs on the ground from the leader's bird's-eye view (moodboard `9-trees-PROBLEM`). Wired into the api; nothing else to do |
| `BUILD_API.md` | the generated-code contract. The server's codegen prompt embeds it verbatim (`{{BUILD_API}}`). About 3.8k tokens, 3 worked examples |
| `examples/{house,lighthouse,duck}.js` | the three worked examples, byte-identical to the doc's code blocks, rendered in `shots/buildings/ex-*.png` |
| `library.js` | `createLibrary(ctx, kit, { api })`: prefab loading, generated-asset registration, cached templates, clones (compact form), `fit`, footprint refit, `animate` / `release` |
| `compact.js` | `planCompact(root)` / `attachForms(obj, plan, ctx)`: the COMPACT form, parts merged per material (one plan per template, shared by every clone); `obj.agoraForm('full' / 'compact')` |
| `fill.js` | `createFillers(ctx, kit, api, { heightAt, lib, avoid })`: things that take the shape of a pencil mark (ART_DIRECTION §5): fields, forests, orchards, gardens, plazas, vineyards; roads, walls, fences, hedges, rivers, canals |
| `shapes.js` | flat geometry on the ground plane: polygon area / centroid / oriented frame / clipping / inset / chords, polyline smoothing / resampling, scatter, `surfaceGeo` (draped polygon + skirt), `ribbonGeo` (draped strip with sides), `mergeGeos` |
| `reveal.js` | `createReveal(ctx, object, opts)`: pencil sketch → a gouache wash that sweeps up the screen → done |
| `construction.js` | `createSite(building, group, { ctx, api })`: stakes, scaffold, crates; setProgress drives the wash |
| `sketch.js` | `renderSketchFromMassing(api, massing)` for `/api/sketch` JSON, and `SAMPLE_MASSING` |
| `prefabs/house.js`, `prefabs/windmill.js` | the quality bar for the other prefabs |
| `../gallery.html` | the lab: every prefab, reveals, sites, massing, generated code |

## Build API (`api.js`)
```js
import { createBuildApi, compileAsset, normalise, measure, RAMPS, LIMITS, AssetError, internals } from './js/buildings/api.js';
const api = createBuildApi(ctx, kit, { keyDir: backdrop.KEY_DIR, seed: 1 });   // keyDir: the clay shader's light (defaults to the reference key)
```
The full surface, with every parameter and default, is in `BUILD_API.md`. The short version:
- **Solids**, with (x, y, z) at the **centre**: `box`, `cylinder` (`r` or `rt`/`rb`), `cone`, `sphere`, `torus`. `lathe` / `extrude` / `tube` are placed by their profile origin.
- **Architecture**, with y at the eaves or base: `gableRoof`, `hipRoof`, `dome`, `archWall` (Shape + absarc holes, the reference wall), `inkDoor` (y = sill), `inkWindow` / `archOpening` (y = centre; `shutters`, `frame`), `column`, `columns`, `stairs`. `door` and `window` are aliases, matching the server's stock assets.
- **Props**: `fence`, `wheel`, `blade` (a windmill sail), `sail`, `flag`, `crate`, `barrel`, `pot`, `shrub`. **Trees**: `tree({ kind })`, `olive`, `oak`, `lemon` and `pine` are the round 3D trees from `trees.js` (they read from above: lit top lump, shaded side lumps, dark underside, visible trunk, long shadow). `cypress`, `bush` and `pine({ kit: true })` / `kitPine` are the kit's own (built into a group at native size and scaled down, so the leaves shrink too; the kit's leaf queue is saved and restored around the call).
- Every part takes `rot` (about y), `rx`, `rz`, `sx`, `sy`, `sz`, and one colour source: `ramp` (an array or a `RAMPS` name) / `color: '#hex'` (turned into a 5-stop ramp) / `mat` (`api.lambert(hex, lift = 0.22)` or `api.clay(base, shade, deep)`).
- **Materials**, all in the reference grammar:
  - `paint(geo, ramp)` = `kit.bake` + `kit.paintMat`, casting shadows.
  - `lambert(hex)`: the big-plane material, casting and receiving shadows. `lift` adds `hex × lift` as emissive, so pale walls stay pale under the dusk key. That is the only deviation from a bare Lambert; `lift: 0` is the reference.
  - `clay(base, shade, deep)`: folk.js's `clayMat` shader, copied verbatim (folk exports it only on a folk instance, and the API doesn't take one).
- `RAMPS`: TERRACOTTA, LIMESTONE, REDWALL, OCHRE, WHITEWASH, WOOD, SLATE, SEA, OLIVE, PINE, PINK, RED, YELLOW, BLUE, SAGE, LAVENDER, SAND, IRON, GOLD, INK, GLASS, with aliases STONE, CREAM, WHITE, TERRA, GREEN, BRICK, METAL, WATER. All run dark → light. Stop 2 is roughly the front-face colour; tops take the last stop.
- **Keylines**: `proxy(geo, parent)` makes an invisible mesh that is tagged `agoraLine` and goes in `ctx.lineOnly`. `colourOnly(obj)` tags `agoraColour` and adds it to `ctx.colourOnly`.
- `api.THREE` is a whitelist: Vector2/3, Shape, Path, CatmullRomCurve3, Quadratic/Cubic Bezier, Color, Euler, Quaternion, Matrix4, MathUtils.
- `rand` / `range` / `pick` / `seed(n)` give seeded variation.
- `spin(obj, {axis, speed})` and `bob(obj, {amp, speed})` tag motion that `library.animate` plays. `floats(g, { line })` marks a floating thing: `normalise` keeps the build's height `line` as y = 0 (the water line) instead of grounding the lowest point; the wrapper gets `userData.agora.floats = true` and `draft` (metres below the line). Place it with y = the water surface.
- **Lines and areas**: `path` (alias `road`), `wall`, `patch`, `stripes` take `points: [[x, z], ...]`. Internally they also take `heightAt(x, z)` + `base` to drape over the terrain (fill.js passes them; generated code never needs to).
- `variant()` returns the variant the library is building (0-2; generated code always sees 0). Prefabs use it for deliberate styles (house: whitewash / ochre / rose, gable / hip / turned roof, wing left or right).
- The api object is frozen. ctx, kit and the internal helpers live in a WeakMap (`internals(api)` → `{ finish, register, unregister, toRamp, clayMat, KEY, ... }`), so generated code can't reach them.

**Ground-huggers.** The painter's colour pass renders into a target with a 16-bit depth buffer (three r128 `DEPTH_COMPONENT16`), so at the leader's distance (~80 m, near 0.5) one depth step is ~0.2 m: a yard or a road 0.1 m above the ground lost the depth test and vanished (the review's "invisible road"). `normalise` therefore gives every part that lies flat on the ground (top < 0.8 m, thinner than 0.8 m, wider than 0.8 m) a polygon-offset twin of its material, one more depth step per 10 cm of height so layers keep their order (crops over earth over paper). Fillers do the same for their flat parts. Proper fix (paint owner, structural, not a look change): give `rtScene` a 24-bit depth (`stencilBuffer: true` gives DEPTH24_STENCIL8 in r128) or keep the world camera's near plane ≥ 2.

**Painted light is baked in the finished object's frame.** Primitives bake at once. Then `finish()` (inside `normalise`) re-bakes every painted part using its normals transformed into the wrapper's frame, so sub-groups rotated by the build code, and the quarter turn from `library.create(…, { rot })`, are still lit from the upper left. `finish` also hands every part that is ≥ 90 % inside a proxy's box to `colourOnly`, because a proxy stands in for the lines of what it encloses (otherwise the coincident surfaces would fight in the normal pass). Doors and windows still draw in the SKETCH: `inkDoor` / `inkWindow` add an invisible "sketch ridge" (a thin steep ridge along the opening's outline, tagged `agoraSketch`, in no list) that the reveal lends to `ctx.lineOnly` while the object is a drawing.

**`compileAsset(code, { name })` → `make(api, { turn }) → wrapper group`**
- It wraps exactly as the server does: `new Function('api', ...SHADOWED, "'use strict';" + code + "\nreturn build(api);")`. The extra `SHADOWED` parameters (`THREE`, `window`, `document`, `globalThis`, `self`, `fetch`, `localStorage`, timers, `Function`, …) are always `undefined` inside `build`, so valid code behaves identically.
- Shadowing alone is not a sandbox (`[].constructor.constructor('return window')()` and indirect `eval` reach the global object). So `build` runs **sealed**: for the length of the synchronous call, the `constructor` slots of `Function.prototype` (and the async / generator function prototypes) and `globalThis.eval` are replaced by a thrower, then restored in `finally`; `import(` is refused at compile time. `check.mjs` probes all three. It is still the same realm: an asset could mutate a shared cached material or loop forever; the server's token checks (`validate.js` blocks `constructor`, `eval`, `import`, …) remain the first line.
- Errors are `AssetError`s with readable messages that start with the asset's name. The cases are: no `function build(` (the old temporal-dead-zone bug that turned this and syntax errors into `ReferenceError: Cannot access 'name' before initialization` is fixed), syntax, `import()`, a throw inside build (including the sealed escape hatches), a non-group return, an empty group, a non-finite bbox, > 400 meshes, or > 120k triangles.
- `normalise` grounds the object (min y = 0, or the water line for `floats`), recentres x/z, scales anything > 60 m down to 60 m and anything < 0.8 m up to 0.8 m, and returns a wrapper `Group` whose `userData.agora = { size:{w,h,d}, meshes, tris, scaled, turn }`. On failure it unregisters the half-built root from the ctx lists.

## Library (`library.js`)
```js
import { createLibrary, CATALOG_IDS } from './js/buildings/library.js';
const lib = createLibrary(ctx, kit, { api, onError: ({ id, error }) => ... });
await lib.load();                       // imports prefabs/<id>.js for every catalogue id; missing files (404) are skipped,
                                        // transient failures retried twice (cache-busted), real errors reported
lib.ids();                              // loaded prefab ids, catalogue order
lib.has('house');                       // prefab or registered asset
lib.register(asset)                     // { ok, id, error? }; asset = { id, name, code, meta? } from /api/codegen or /api/assets.
                                        // Compiles AND builds once, so a broken asset fails here (show/repair it), not when placed.
const obj = lib.create('house', { rot: b.rot, variant: k });   // never throws: unknown id / broken asset → a painted
                                        // block-and-roof fallback (obj.userData.agora.fallback = true, .error)
lib.create('temple', { rot, fit: { w: 9, d: 7 } })   // a single object named for a drawn area: scaled uniformly (0.2-6x,
                                        // 8 % margin) to fit; userData.agora.size is the fitted size, .fit the factor
lib.create(id, { compact: false })      // full parts instead of the compact form (both work in a reveal)
obj.agoraForm('full' | 'compact')       // switch by hand; obj.agoraForms = { form, parts, merged, release() }
lib.compactable(obj)                    // give an object made elsewhere (a massing sketch) the two forms
lib.create(asset)                       // registers on the fly if needed
lib.animate(obj, t) / lib.update(t)     // prefab animate(obj, t), else spin/bob tags; update(t) runs every live object
lib.release(obj)                        // remove from parent AND from ctx.lineOnly / colourOnly; always use this
lib.info('windmill')                    // { id, size:{w,h,d}, meshes, tris, footprint?, height? }
```
- Templates are cached per `id#variant@quarter` (variants default to 3, `api.seed` is fixed per id and variant, `api.variant()` tells the prefab which). Clones share geometry and materials, and get their proxies and colour-only parts registered in the ctx lists.
- **Compact form** (`compact.js`): every placed object comes out with its parts merged per (material, shadow flags, list), planned once per template so all clones share the merged geometry. Proxies merge into one invisible keyline mesh, colour-only parts merge apart from the solids, InstancedMeshes and clay ShaderMaterials stay, and moving parts merge into the frame of their own moving node (a spin / bob group, or a named node when the prefab has `animate()`), so sails still turn and a hull still bobs. A prefab drops from 19-82 meshes to 2-12 (windmill 57 → 11, market 80 → 5). With all 21 prefabs in the gallery: 1452 draw calls on a repaint and 264 on a folk-only frame (were 4178 / 3215), 342 scene meshes (were 1028). The reveal switches an object to its full parts while it paints and back on `done()`.
- **Footprints**: a prefab whose ground extent (moving parts and proxies excluded, instanced leaves included) exceeds its `meta.footprint` by > 4 % is squeezed uniformly to fit (never below 0.86, so doors keep their folk scale); `lib.info(id).refit` reports it. Bigger misses are fixed in the prefab (house, woodcutter). `check.mjs` asserts every prefab but the windmill (sails) is within 6 %.
- `rot`: the template is baked at the nearest quarter turn and only the remainder goes on `obj.rotation.y`. Don't rotate placed buildings by large angles yourself.
- Generated asset ids should be the server's `gen-<slug>-<hash>`. Registering the same id again replaces it.

## Reveal (`reveal.js`): "pencil, then paint"
```js
import { createReveal } from './js/buildings/reveal.js';
const r = createReveal(ctx, obj, { mode: 'wash' | 'parts', onBloom({ x, z, radius, p }), onPaint(p), onDone() });
r.hide();                  // nothing on the paper
await r.sketch(1);         // pencil lines draw on part by part (big masses first, ground up, small details last)
await r.paint(4);          // the gouache wash sweeps up the screen (eased): from the ground at eye level, from the near eaves from above
r.done();                  // original materials back; every list exactly as before
r.setSketch(p); r.setPaint(p); r.stop();   // drive it yourself (sites, scrubbing, screenshots)
r.state                    // 'idle' | 'hidden' | 'sketch' | 'painting' | 'done';  r.progress 0..1
```
- **sketch**: solid parts go into `ctx.lineOnly` with `visible = false`, so the painter shows them only in the normal/depth pass and only pencil lines land on the paper. Colour-only parts (leaves, lattice, bands) are taken out of `ctx.colourOnly` and hidden, and draw through their proxies. The openings' sketch ridges join for the last 30 % of the drawing (doors and windows are the last marks) and leave as the paint arrives. Shadows are off.
- **paint (`wash`)**: the materials are cloned once per reveal. Built-ins use `onBeforeCompile`; ShaderMaterials such as clay are string-patched. They clip against a front in **screen height** (each fragment's NDC y from a clip-position varying), so whatever covers something on screen is painted at the same moment as what it covers: from the leader's bird's-eye the roof now paints from its near eaves while the walls do, instead of a hollow cutaway with the roof popping in last. The ragged edge is sized in metres (`uRevealK` = NDC per metre at the object): a slow wobble round the object, bristle noise and grain; "fingers" of colour creep ahead as a smooth lift of the edge itself, so they are always joined to the front (the old blots floated as isolated splotches); the wet edge pools about 17 % darker. The front is re-aimed in `onBeforeRender` for whichever camera renders (once per camera pose), so a site held at 40 % stays at 40 % while the player pans. Shadows switch on per part once the wash has passed its top and the paint is past 55 % (no shadow falls on the paper through a roof that is still a drawing). The keylines stay intact (the normal pass uses `overrideMaterial`). `onBloom` fires every step with a radius that grows to about 1.6× the footprint, which is the hook for the world's colour bloom (the gallery shows a stand-in disc).
- `createReveal(ctx, obj, { camera })` overrides `ctx.camera` for the initial aim (the per-render re-aim uses the rendering camera anyway).
- **`parts` mode**: parts switch from pencil to paint one at a time in draw order. It has no clip, so it is the cheap fallback.
- In Raw 3D a sketch is invisible (there are no keylines in Raw). Riso and Gouache both work.

## Construction sites (`construction.js`)
```js
import { createSite } from './js/buildings/construction.js';
const obj = lib.create(b.kind, { rot: b.rot }); obj.position.set(b.x, 0, b.z); scene.add(obj);
const site = createSite(b, obj, { ctx, api, onBloom, sketchSeconds: 0.9 });   // draws the pencil building at once
scene.add(site.object);
game.on('building:progress', e => e.id === b.id && site.setProgress(e.progress));   // the wash follows the work
game.on('building:done', async () => { await site.finish(); });  // paint completes, scaffold sinks away, building settles
```
`site.object` holds stakes and a chalk outline on the footprint, a light scaffold (few big shapes: four corner poles, a mid pole only on sides over 6.5 m, one ring of ledgers at two thirds of the height, one walking plank across the front; the old cage of poles every 2.4 m, ledgers every 1.7 m and a full-height brace drowned the pencil building), and a crate pile by the front-right corner (crates disappear as progress rises). `setProgress(p)`: p ≤ 0.02 keeps the pencil, anything above maps to `reveal.setPaint`. `finish()` resolves after about 0.9 s and removes `site.object`. Call `site.dispose()` if you drop a site early. `reset()` replays (gallery).

For the 3–5 s creation moment of a *known* prefab (CONCEPT) without a long site, use the reveal directly: `r.hide(); await r.sketch(1); await r.paint(4); r.done()`.

## Fillers (`fill.js`): the shape of a pencil mark (ART_DIRECTION §5, ARCHITECTURE §10)
```js
import { createFillers, FILL_KINDS } from './js/buildings/fill.js';
const fill = createFillers(ctx, kit, api, { heightAt: (x, z) => world.groundY(x, z), lib, avoid: (x, z) => world.isWater(x, z) });
const obj = fill.make(kind, mark);       // mark = marks.current(): {kind:'area', poly} | {kind:'line', pts} | {kind:'point', x, z}
scene.add(obj);                          // already placed: at the mark's centroid, y = the ground there
const r = createReveal(ctx, obj); r.hide(); await r.sketch(1); await r.paint(3.5); r.done();
fill.release(obj);                       // remove + unregister (both forms)
const f = fill.frame(mark);              // { x, z, rot, w, d, area }: where a SINGLE object named for an area goes:
lib.create('temple', { rot: f.rot, fit: { w: f.w, d: f.d } }).position.set(f.x, groundY, f.z);
```
- Areas: `field(poly, { crop: 'mixed' | 'wheat' | 'green' | 'lavender', width })` crop bands across the long axis clipped exactly to the outline, with an earth skirt (its pencil outline); `forest(poly, { density, mix: { pine, oak, cypress, olive } })` round 3D trees (`api.tree`) scattered inside over a dark forest floor (≤ 70 trees); `orchard(poly, { kind })` lemon / orange / olive trees in rows on a dry lawn; `garden(poly)` a lawn inside a clipped hedge, gravel paths crossing on the axes, flower mounds, cypresses at the sharpest corners; `plaza(poly)` warm limestone paving a step darker than the paper, a kerb, a terracotta inlay ring, trees in the corners; `vineyard(poly)` rows of vines (one merged mesh) on earth.
- Strokes: `road(pts, { width })` a sand strip with kerbs (the same `api.path` as the road prefab); `wall(pts, { h, d, merlons, towers, red })` a Lambert wall with coping and merlons, square towers with hip roofs at the ends and sharp corners; `fence(pts)` posts and two rails (one mesh) with a thin keyline sheet; `hedge(pts)`; `river(pts, { width })` deep ultramarine-teal water between sand banks; `canal(pts)` straight-edged with stone kerbs.
- `make` maps aliases (`FILL_KINDS`: fields, meadow, wheat, lavender, woods, grove, park, square, piazza, district, vines, path, street, rampart, palisade, stream, channel, …). An area kind on a stroke fills a 6 m band along it; a stroke kind on an area runs round it ("a wall around this"); a point gets a default 8 x 6 area / 8 m line.
- Draping: with `heightAt`, every surface is tessellated (≤ 2 m edges) and follows the ground, strips are resampled every 1.5 m, trees stand on the ground; skirts and strip sides run 0.2-0.6 m into the ground. Flat parts get the ground-hug depth nudge.
- The group comes back compact (`userData.agora = { fill: true, kind, size, centroid, area | length, ... }`). Every filler releases cleanly (check.mjs asserts no list leak).
- Also answers the marks lab's call shape: `createFillers(ctx, kit, api, { groundY, library, avoid, trees })`, `fill(kind, mark, o)` (= `make`), `reveal(obj)` (= `createReveal`), `release(obj)`.

## Massing sketches (`sketch.js`)
`renderSketchFromMassing(api, { name, footprint, height, parts:[{ shape, x, y, z, w, h, d | r, rot, color }] })` returns a normalised wrapper (not registered in the library).
- `(x, y, z)` is each part's bounding-box **centre**, the same rule as the primitives and the server's `mock/sketch.js`.
- Shapes are `box | cylinder | cone | sphere | gable | dome` (unknown → box). Parts are capped at 16. `rot` is in radians, and `|rot| > 6.3` is read as degrees. `color` is any hex.

The flow for an unknown thing:
```js
const c = net.create({ request, snapshot }, {
  onSketch(m) { sk = renderSketchFromMassing(lib.api, m); place(sk); rs = createReveal(ctx, sk); rs.hide(); rs.sketch(0.8); },
  onDone(asset) { const res = lib.register(asset); if (sk) lib.release(sk);
                  const obj = lib.create(asset.id, { rot }); place(obj); const r = createReveal(ctx, obj); r.hide();
                  r.sketch(0.6).then(() => r.paint(4)).then(() => r.done()); },
  onError() { if (sk) rs.paint(4).then(() => rs.done()); }   // never fails visibly: paint the sketch itself
});
```

## The manifest, the library and the catalogues (2026-10-04)
- `scripts/build-manifest.mjs` reads every `prefabs/<id>.js` `meta` (imported in Node; parsed from the source when an import fails) and writes `prefabs/manifest.js`: `MANIFEST = [{ id, name, aliases, category, stage, footprint, height, desc, water, area, line, file }]`, plus `MANIFEST_IDS` / `ids` (what `game.js` loads), `byId` and `CATEGORY_ORDER` (building, farm, animal, nature, water, landmark, prop). Re-run it after adding or renaming a prefab; `--check` fails when it is stale. 101 prefabs today.
- `library.js`: `lib.load()` now imports every manifest id (`ALL_IDS`: the fixed `CATALOG_IDS` first), `lib.ids()` keeps that order, `lib.meta(id)` is the manifest entry without a build, `lib.byCategory()` groups ids in `CATEGORY_ORDER`, and `lib.info(id)` merges the manifest meta with the template's size / refit.
- Sim `catalog.js` builds `PREFAB_ENTRIES` from the manifest with light demo numbers per category (`PREFAB_TUNING`, a few per-id touches in `PREFAB_TOUCH`; never anything that blocks a creation), categories now include `farm` and `animal`, and an id always beats an alias (`barn`, `pier`, `sawmill`, `tent`, `stalls`, `watchtower`, `footbridge`, `copse`, `meadow`, `piazza` used to be aliases of older kinds). The Ministry's creative nouns stay `kind: null` (`RESERVED_IDS` = statue, `RESERVED_WORDS` = duck, boat, statue, tree, tower, clock tower, lighthouse, rocket, dragon): the statue prefab is a library piece, not a catalogue kind. Area prefabs the fillers know (`meadow`, `piazza`) are `shape: 'area'`; the other `area` prefabs (wheat-field, lavender-field, …) are points that `markSpot` scales into a drawn outline.
- The server imports the sim catalogue (so the command prompt and the mock alias index carry every prefab and its aliases) and falls back to the manifest when that import fails; `forge` / `smithy` moved from the workshop to the smithy prefab.
- `gallery.html` (no parameters) lays the whole book out grouped by category with a red heading per group, packed into near-square rows; `?cat=farm` shows one group; `?view=bird` is the leader camera. Shots: `shots/library/{all,farm,animal}-bird.png`, taken with `shots/library/shoot.mjs <out> <url-path> [w] [h] [evalScript]`.

## Writing a prefab (for the prefab builders)
- The file is `prefabs/<catalogue id>.js`. Export `build(api)` (returns `api.group()`), an optional `meta = { id, footprint:{w,d}, height }`, and an optional `animate(obj, t)` (find parts with `obj.getObjectByName`).
- Use **only** `api` (the same surface as generated code). Respect the catalogue footprint (sim `catalog.js`). The front faces +z, the ground is y = 0, and a folk is about 1.3 m.
- Look rules: whitewash or limestone Lambert walls, painted-ramp roofs and trim, ink openings, one accent colour, one proxy per big mass, `colourOnly` or a proxy for any lattice or cluster. It must read **from above** (ART_DIRECTION §1): a clear roof shape, footprint and cast shadow.
- Variation: `api.pick` / `api.range` (variants 0–2 are cached separately). Animation: `api.spin` / `api.bob`, or `export function animate`.
- Check it: `web/gallery.html?only=<id>`, `&view=bird`, `?reveal=<id>`, `?site=<id>`, `?only=<id>&rot=1.57`. Then run `node shots/buildings/check.mjs`.

## Gallery (`web/gallery.html`)
It uses the real engine: `createContext` → `createKit` → `createBackdrop` → `createBuildApi` / `createLibrary`, a cream Lambert ground (`#e9dcc8`, far edge at z = −60 so the reference sea shows beyond), four folk for scale (a nav that keeps them off the exhibits), `createPainter` and `mountPaintUI`. It opens in Gouache. Drag to orbit and scroll to zoom.

Parameters:
- `?only=<id>`, `?reveal=<id>` (&mode=parts), `?massing=demo` (&paint=1), `?code=<url>` (&reveal=1), `?site=<id>`, `?file=prefabs/a.js,...`
- `?fill=<kind>` a filler on a hand-drawn demo mark (`&reveal=1` loops pencil → paint, `&crop=`), `?fill=all` every filler; `?only=<id>&fit=8,6` a fitted object inside a drawn outline
- `?freeze=sketch:p | paint:p | site:p`
- `?view=bird | top | eye`, `?yaw= ?pitch= ?dist= ?rot= ?variant=`, `?nofolk ?notags`, `#riso #raw`

The grid packs rows by each prefab's own width (the assembly no longer crowds the bridge's tag) and `fitFrame()` pulls the camera back until the framed box is on screen (no cropped house in the bird view). The page has an empty favicon, so a clean run logs no console errors.

`window.__gallery` exposes `{ ready, lib, api, ctx, painter, scene, exhibit, frameOn, fitFrame, fillers, createReveal, renderSketchFromMassing, reveal, site, rig }`.

## How it was verified
```
~/.nvm/versions/node/v22.22.3/bin/node shots/buildings/shoot.mjs            # 15 standard screenshots → shots/buildings/*.png (+ JSON: page errors, bad responses)
~/.nvm/versions/node/v22.22.3/bin/node shots/buildings/check.mjs            # contract checks, exit 0/1, writes stock.png
~/.nvm/versions/node/v22.22.3/bin/node shots/buildings/sequence.mjs 'reveal=house' 0.9,2.1,4.8,7.6 reveal-live   # live timing
~/.nvm/versions/node/v22.22.3/bin/node shots/buildings/snap.mjs name='query' ...   # any gallery states → shots/buildings/v2/*.png (+ errors JSON)
~/.nvm/versions/node/v22.22.3/bin/node shots/buildings/eval.mjs 'query' 'js'       # run JS in the gallery page (SHOT=file.png screenshots after)
~/.nvm/versions/node/v22.22.3/bin/node shots/buildings-review/probe.mjs notags     # draw calls / meshes / fps of the full grid, compile + escape probes
```
`check.mjs` (headless Chrome, `--use-angle=metal`, served by `python3 -m http.server`) currently passes:
- the 3 doc examples and all 8 server stock assets (`server/mock/assets/*.js`) compile, measure sane and render
- 8 broken inputs are rejected with clear messages, and `create()` never throws and returns the fallback: syntax, a throw, empty, no return, NaN, 600 meshes, no `build`. An `escape` probe that only returns its group when `THREE`, `window`, `document`, `api.ctx` and `api.kit` are all unreachable is accepted.
- a 300 m asset is scaled to 60 m and a 5 cm one is scaled up to 0.8 m
- there is no ctx-list leak after the broken assets
- all 9 server mock massing families render
- the reveal bookkeeping on a windmill holds: hide → sketch (solids in lineOnly and invisible, colour-only out) → paint (out of lineOnly, clip materials) → done (lists and materials exactly restored, compact form back) → `release` (lists back to before the create)
- the sandbox: `[].constructor.constructor('return window')()`, `(0, eval)('this')` and `import()` are all rejected, and the seal is restored afterwards; no-`build` and syntax errors give `AssetError`s named after the asset (the TDZ regression)
- `api.floats` keeps a duck's water line (min y −0.6, draft 0.6); `fit` scales a house up into 8 x 6 and down into 2 x 2
- every prefab but the windmill sits within 6 % of its catalogue footprint; compact meshes per prefab are listed
- all 12 fillers (+ aliases grove, lavender) build on a drawn area / stroke and release with no list leak

## Decisions (made without asking)
- **Object-parameter primitives** (`api.box({ w, h, d, x, y, z, ramp })`), matching the server's codegen prompt and stock assets. y is the centre for solids, the eaves for roofs, the sill for doors and the centre for windows, all stated in BUILD_API.md. Aliases `door` / `window`, `rt` / `rb` and `ramps.STONE` / `CREAM` / `INK` / `GLASS` keep the server's stock code valid.
- Big walls are Lambert with a small emissive lift (0.22), because a bare Lambert whitewash reads tan under the dusk key and melts into the cream paper.
- Ramps were retuned so the top stop is the sunlit local colour, not a pastel: bake puts top faces at v ≈ 0.95.
- The paint reveal is a wash clip with a wet edge whose front runs in SCREEN height (it was world height: a hollow cutaway from above). Per-part pops (`mode: 'parts'`) are the fallback.
- Library objects are compact by default; the reveal expands and re-compacts them. A plan is made per template (the merged geometry is shared by all clones).
- Fillers live in `fill.js` (ARCHITECTURE §10 contract, plus `orchard`, `hedge`, `canal`, `make`, `frame`); the area / stroke primitives they draw with are on the Build API too (`path`, `wall`, `patch`, `stripes`) so prefabs (the road) and generated code share them.
- Flat ground parts get graded polygon offsets (see "Ground-huggers"), because the paint engine's colour target has a 16-bit depth buffer and is verbatim.
- Floating things opt in with `api.floats(g, { line })`; everything else is still grounded on its lowest point (the old doc said both).
- `createSite` takes `{ ctx, api }` as a third argument (ARCHITECTURE §5 amended).
- Example 1 in BUILD_API.md is the hip-roof + pergola house (it reads from above). It replaced my earlier gable house after ART_DIRECTION's bird's-eye call.

## Gaps
- The world module owns the real colour bloom: `onBloom` gives the centre, radius and progress, and the gallery disc is only a stand-in.
- A sketch is invisible in Raw 3D.
- Lambert walls inside a reveal pop their shadows per part, not continuously.
- The keyline pass's "lost edges" (a screen-space noise mask in the verbatim sepMat) can break a long pencil silhouette, most visibly on a tall pale shaft in the sketch phase. It is the reference's look; not changed.
- Ground-hug offsets are in depth-buffer steps, so at extreme distances (> ~130 m with near 0.5) a hugged slab can overdraw the foot of a wall standing on it. The real fix is a 24-bit colour-pass depth or a larger camera near plane (paint / world owners).
- Variants are deliberate for the house only; other prefabs vary by seeded picks (colours, small props).
