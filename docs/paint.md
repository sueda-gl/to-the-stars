# Paint engine (`web/js/paint/`)

Sueda's "Red arch at sundown" (`reference/red-arch-at-sundown.html`), extracted into ES modules **without changing the look**. Every shader string, constant, palette, geometry parameter, material and CSS rule is copied from the original's lines by `tests/fidelity/extract.py`, which slices the file by line number and applies only asserted structural edits. The rebuild (`web/reference.html`) matches the original **pixel for pixel**: mean diff 0/255 and max diff 0 in Riso, Gouache, Raw and close-up, including after 10 s of simulated motion.

Three is the vendored r128 (`web/vendor/three.min.js` + `Reflector.js`, sha256-identical to the jsDelivr files the original loads), loaded as classic scripts, so `THREE` is a global.

## Module map
| file | what (all verbatim unless noted) |
|---|---|
| `context.js` | `mulberry32`, `createRenderer()` (the reference renderer: PCF soft shadows, `shadowMap.autoUpdate=false`, canvas prepended to body), `createContext()` → the shared `ctx` |
| `kit.js` | `bake` (painted light → vertex colours), `paintMat`, `blob`, `stoneTexture`/`slab`, foliage: `leaf`/`proxy`/`chain`/`crown`/`pine`/`cypress`/`bush`/`finishLeaves`, palettes |
| `backdrop.js` | sky dome, sun disc, two far ridges, sea shader, foam strip, hemi + key light (shadow camera ±30 round (0,0,-6)), `KEY_DIR` |
| `redArch.js` | the Red arch scene (terrace slabs, pool lining, pool `Reflector`+`PoolShader`, flat keyline stand-in, the red wall, 4 pines, 2 cypresses, 7 shrubs, the leaf mesh, the dead `person()` machinery, 5 gulls) + the reference walk data `OBST`, `SPOTS`, `CLOSE_FOCUS`, `route()`, `PW`, `camBase`, `lookBase`, and `referenceNav(ctx)` |
| `folk.js` | all 7 species (geometry, clay cel `clayMat`, `celMat`, wardrobes `cloth`/`garment`/`wear`, faces, the shared leg rig, every update function), `FACE_LAYER=5`, `MASK_LAYER=6` |
| `post.js` | `folkPaintMat`, `kuwaharaMat`, `edgeMat`, `sepMat`, `printMat`, render targets, `renderWorld`/`renderFolk`/`composite`, the held-frame `frame()`, gouache settings `G` |
| `ui.js` | `mountPaintUI` (editions pill, Gouache settings panel, Up close button, keys 1/2/3, C, L, hash flags) and `createOrbitRig` (the reference camera: pointer parallax far away, drag-orbit and wheel-zoom up close) |
| `../../css/paint.css` | the reference `<style>`, byte-identical (`diff` against lines 10–64 is empty) |

## API

```js
import { createRenderer, createContext, mulberry32 } from './js/paint/context.js';
const renderer = createRenderer();                       // reference settings; prepends the canvas to <body>
const ctx = createContext({ renderer, scene, camera, seed = 11 });
// ctx = { THREE, renderer, scene, camera, rnd, R(a,b), V(x,y,z), Y, col(hex), ramp(cols,v), L (painted light dir),
//         mulberry32, reduceMotion, colourOnly:[], lineOnly:[], folkHidden:[], reflectors:[], flags:{ closeUp:false } }

import { createKit } from './js/paint/kit.js';
const kit = createKit(ctx);
// kit.parent: where kit pieces are added (null = ctx.scene). Set it to a Group to build into that group.
// bake(geo, hexCols, speck=0.18, lift=0) -> geo with painted vertex colours (spends rnd per vertex)
// paintMat (MeshBasic, vertexColors) · blob(r, pos, sy, lump, seg, sz) -> lumpy SphereGeometry (spends rnd)
// proxy(geo) -> invisible smooth mesh, in ctx.lineOnly: what the keylines see instead of noisy detail
// leaf(pos, s, colour, rotY, sy) queues one instanced clump; finishLeaves() -> InstancedMesh of everything queued
//   (callable repeatedly; each call makes one mesh and empties the queue; the mesh goes in ctx.colourOnly)
// chain(group, pts, r0, r1) bark-y trunk · crown(c, rad, nPads) umbrella-pine crown · pine(trunkPts, r0, r1, crowns)
// cypress(x, z, h, w) · bush(cx, cz, spread, lobes, flowersRamp, height, bloom)
// stoneTexture() -> CanvasTexture (spends 27 000 rnd) · getStoneTex() cached one · slab(x0,x1,z0,z1,y0=-2.2,y1=0) -> Mesh
// PALETTES = { PINE, UNDER, TRUNK, CYP, LEAF, PINK, RED }

import { createBackdrop } from './js/paint/backdrop.js';
const backdrop = createBackdrop(ctx, { camBase });   // camBase: the sun disc is placed 380 out from it, facing it
// -> { sky, sun, sunPos, sea, seaMat, foam, hemi, key, KEY_DIR, sunDir, update(t) }   update(t) animates the sea

import { buildRedArch, referenceNav, OBST, SPOTS, CLOSE_FOCUS, route, PW, camBase, lookBase } from './js/paint/redArch.js';
const arch = buildRedArch(ctx, kit, { origin = V(0,0,0), scale = 1 });
// -> { group, pool, wall, lining, birds, people, person, PW, OBST, SPOTS, CLOSE_FOCUS, route, update(t) }
// everything goes in arch.group (identity by default; move or scale it to place the Assembly)
// update(t): pool ripples + gulls; call it where the reference did (when the world is repainted)

import { createFolk, FACE_LAYER, MASK_LAYER } from './js/paint/folk.js';
const folk = createFolk(ctx, backdrop, nav = referenceNav(ctx));
// folk = { creatures, hoppers, drops, scoots, flits, pips, floaties, allLimbs, nav,
//          make: { puffer(i), loaf(i), drop(i), scoot(i), flit(i), pip(i), floatie(i) },  // each returns its record
//          update(dt, t), setCloseUp(on), remove(agent),
//          MOODS, IDLE_MOODS, wrapAngle, FACE_LAYER, MASK_LAYER, clayMat, celMat, cloth, tones, garment, wear }
// i picks the colourway (i % palette length). Each make spends rnd on the wardrobe, size, spawn spot, timings.
// species -> list: puffer creatures · loaf hoppers · drop drops · scoot scoots · flit flits · pip pips · floatie floaties

import { createPainter } from './js/paint/post.js';
const painter = createPainter(ctx, folk, { framing = null });
// painter = { setMode(0 Riso | 1 Gouache | 2 Raw), mode, G, G_DEFAULT, CONTROLS, applyG(), resize(w?, h?), makeTargets(),
//             markDirty(), dirty, camZ, resScale, renderWorld(), renderFolk(), composite(), renderPainted(),
//             frame(dt, t, beforeDraw) -> drew, pass(mat, target), INKS,
//             materials: { kuwaharaMat, edgeMat, sepMat, printMat, folkPaintMat, normalMat, depthOnlyMat },
//             internalSize: { iw, ih }, subscribe(fn('mode'|'g', value)) }
// framing(camera, w, h): replaces the reference's fov / camZ rule in resize() (the game owns its camera)
// frame(): held frames (Riso 12 fps, Gouache 24 fps; Raw every frame); beforeDraw(t) runs only on a repaint;
//          in Gouache the folk are repainted every frame on top of the held world.

import { mountPaintUI, createOrbitRig } from './js/paint/ui.js';
const rig = createOrbitRig(painter, { camBase, lookBase, closeFocus });  // -> { update(dt), place(), aim, cur, orbit, closeT }
const ui = mountPaintUI(painter, { root = document.body, closeUp = true, keys = true, hash = true, rig = null });
// -> { setMode, setCloseUp, setLines, applyG, panel, toggle, buttons }. Hash flags: #gouache #raw #close #nolines #settings
```

The reference loop, as in `web/reference.html`:
```js
const clock = new THREE.Clock();
function frame() {
  const dt = Math.min(clock.getDelta(), 0.1), t = clock.elapsedTime * (ctx.reduceMotion ? 0.15 : 1);
  folk.update(dt * (ctx.reduceMotion ? 0.4 : 1), t);
  rig.update(dt);
  painter.frame(dt, t, t => { rig.place(); backdrop.update(t); arch.update(t); });
  requestAnimationFrame(frame);
}
```

### Things you must know when you add your own scene
- **Keylines** come from a separate render of everything that is *not* in `ctx.colourOnly`, plus the invisible `ctx.lineOnly` proxies, with normal material. Put noisy things (leaves, folk, water, sky) in `colourOnly` and give big masses a smooth `kit.proxy(geo)`. The painter forces `visible` on `colourOnly`/`lineOnly`/`folkHidden` members every repaint (true/false and back to true), so to hide one of them, hide its **parent** or remove it.
- **The folk pass** draws only layer `FACE_LAYER` (5) over a depth-only world. Folk meshes enable layers 5 and 6 (`MASK_LAYER` = "pencil lines stop here"). Anything you hang on a folk (a crate or a letter) must `layers.enable(5)` (and 6 unless it's a face part), or it vanishes in Gouache. Folk legs live in world space (`folk.allLimbs`).
- **Lights**: shadows are manual (`renderer.shadowMap.autoUpdate = false`); the painter sets `needsUpdate` on each repaint. Big planes: `MeshLambertMaterial` + `receiveShadow`. Props: `kit.bake(geo, ramp)` + `kit.paintMat`, or `folk.clayMat(base, shade, deep)`.
- **Reflectors** pushed into `ctx.reflectors` get resized to the internal paint size.
- No tone mapping, bloom or grading anywhere. Don't add them.

## The rnd-order rule
There is **one** random stream, `ctx.rnd = mulberry32(seed)`, and almost everything spends from it: `bake` (one call per vertex), `blob`, `stoneTexture` (27 000 calls), every pine pad, leaf, cypress and bush clump, `finishLeaves` (2 per leaf), the gulls, the 4 unused lemon geometries at the top of `createFolk`, each `make.*` (wardrobe picks, size, spawn spot, timings), every `folk.update` (blinks, moods, hops, new targets) and `setCloseUp(true)`. The ridges have their own `mulberry32(seed)`.

So the **order of construction is part of the look**. To reproduce the reference, call the modules in this order: `createContext` → `createKit` → `createBackdrop` → `buildRedArch` → `createFolk` → make 10 puffers, 10 loaves, 8 drops, 8 scoots, 13 flits, 10 pips, 8 floaties (i = 0..n-1) → `folk.update(0.016, 0)` → `createPainter` → `createOrbitRig` → `mountPaintUI` → `painter.resize()`.

Material creation order matters too, because three.js sorts opaque draws by program and then material id, and that sort decides coplanar ties. That is why `createKit` comes before `createBackdrop` here (`paintMat` was the first material in the original), why `proxyMat` and `stoneTex` are made on first use, and why each species' shared geometry and materials are made lazily on its first `make.*` (`initLoaves`, `initDrops`, and so on). In the reference order that lands exactly where the original made them. In the game, any order works; you'll just get a different, equally valid painting. Never create a new RNG inside a copied path.

## The nav seam (the only behaviour change)
`createFolk(ctx, backdrop, nav)`. The default `referenceNav(ctx)` is the reference code moved behind these hooks, so the defaults reproduce it exactly (the motion test checks positions after 10 s: max diff 0).

| hook | called | reference default |
|---|---|---|
| `nav.pickTarget(a)` | a walker's wait ran out (not if `a.controlled`) | close-up: 55% go to the stage near `closeFocus`; else a random `SPOTS` entry, routed through the arch / round the pool by `route()`. Sets `a.path` |
| `nav.obstacles` | every frame, all walkers | `OBST` (array of `[x, z, r]`); read live, so you can replace or mutate it |
| `nav.bounds(pos)` | after moving (and a loaf's hop target) | clamp x∈[-13,13], z∈[-13.6,16] |
| `nav.extraPush(a, push, species)` | every frame; `species` ∈ puffer/pip/scoot/drop/loaf | pool channel + arch wall pushes (`loaf` gets its hop-direction version: `push` is the hop direction) |
| `nav.flyTarget(f)` | a flit's route is empty | `flitTarget`: random point, crossing the wall only through the arch. Sets `f.route` |
| `nav.floatTarget(f)` | a floatie's route is empty | random point (+ arch waypoint). Pushes onto `f.route` |
| `nav.flyPush(f, want, species)` | every frame for fliers (`flit`/`floatie`) | steer off the wall either side of the arch |
| `nav.spots` | spawn, in every walker `make.*` | `SPOTS`, the spawn spot is `spots[floor(rnd()*len)]` ± jitter (an addition: lets a game spawn on its own plot) |
| `nav.closeFocus` | the default pickTarget's close-up branch | `CLOSE_FOCUS` V(6.1, 1.1, 9.6) |
| `nav.onArrive(a)` | a walker's path just emptied (after the reference set its idle `wait`) | no-op |

**`a.controlled = true`** on any record means the game owns it. Walkers then never call `pickTarget` (and `setCloseUp` leaves held puffers alone): set `a.path = [V(x,0,z), ...]` and `a.wait = 0` to send one, and on arrival it idles for the reference's wait, then stands still until you give it a new path (overwrite `a.wait` in `onArrive` if you want it to stand by immediately). Held fliers with an empty `route` hover where they are. Set `f.route = [V(x,y,z)]` to fly them.

Other useful levers: `ctx.flags.closeUp = true` (or `folk.setCloseUp(true)`) makes every idle folk face the camera, which is how "the folk turn toward you to listen" should be done. A record's `pos` can be overwritten right after `make.*`, since legs are placed on the first update (copy it to `root.position` too). For fliers, `pos.y` is height. `folk.remove(a)` takes one out of the scene and every list.

`web/paint-sandbox.html` demonstrates the seam: a 120×120 cream Lambert ground (`#e9dcc8`) under the backdrop, one folk of each species, and a nav that wanders a 40×40 square with no obstacles, no pool and no arch. `window.__sandbox.check(steps, dt)` runs the sim and checks the hooks: nobody leaves the square, everyone moves, walkers cross the old pool channel freely, `onArrive` fires, and three held walkers (puffer, loaf, pip) reach their given corners and stay there while a held flit hovers.

## Fidelity test
```
~/.nvm/versions/node/v22.22.3/bin/node tests/fidelity/compare.mjs [--sandbox]
~/.nvm/versions/node/v22.22.3/bin/node tests/fidelity/verbatim.mjs [-v]
```
`compare.mjs` serves the repo root with `python3 -m http.server` on a free port. It drives headless Chrome (puppeteer-core, a devDependency, `--use-angle=metal`) at 1440×900, DPR 1, and sets `window.__STILL = true` before any script runs on both pages (the original renders exactly one frame, with clock delta 0, then stops). It screenshots the original (`/reference/red-arch-at-sundown.html`) and the rebuild (`/web/reference.html`), then diffs them with PIL (`tests/fidelity/diff.py`). The bar is mean abs diff < 0.5/255. The cases are:
- `riso`, `gouache`, `raw`: first frame of each edition
- `gouache-close`: `#gouache-close` (the close-up camera, plus `setCloseUp`'s rnd)
- `motion-riso`, `motion-gouache-close`: 600 fixed steps of `updateCreatures(1/60)` through `window.__arch`, then `renderPainted()`. This compares pixels *and* every folk's position and heading (must be exactly equal)
- `control`: the rebuild with `?seed=12` must FAIL the bar (it does: 13.0/255), so the gate can tell scenes apart
- it also fails if the original screenshots look blank (fewer than 2000 distinct colours), on any page error, or on any 4xx/5xx except favicon

Output goes to `shots/fidelity/`: `original-*.png`, `rebuild-*.png`, `diff-*.png` (the original dimmed, with the difference ×16 and >8/255 in red), `results.json` and `sandbox.png`.

`verbatim.mjs` checks that each of the original's 2023 code lines appears byte for byte (indentation aside) in the modules. Today 1888 are copied verbatim and 44 differ only by a dropped `const` (lazy species init). The other 91 sit at listed seams: the nav hooks, `ctx` lists, the split of `frame()`/`setMode`/`setCloseUp` between painter/ui/page, and population loops moved to the caller. It fails on any unexplained line.

## Decisions (made without asking)
- `createKit` before `createBackdrop` in `reference.html` (game.js may use the other order; only material-id tie order differs).
- Lazy per-species initialisation, so the reference order reproduces the original's material ids, and so unused species cost nothing.
- Added hooks beyond the architecture list, with defaults equal to the reference: `nav.flyPush`, `nav.spots`. `extraPush` takes a third `species` argument (the loaf's version differs).
- The puffer's `else` branch became `else if (c.path.length)`: identical for the reference (a puffer never has wait ≤ 0 with no path there) and safe for held agents.
- `painter.frame` doesn't update creatures or place the camera; the page does (`folk.update`, `rig.update`, `beforeDraw`). `setMode`/`applyG` live on the painter and the DOM syncs via `subscribe`.
- `folk.remove(a)` was added for agents leaving. It's purely structural.
- `reference.html` accepts `?seed=` only so the negative control exists.
