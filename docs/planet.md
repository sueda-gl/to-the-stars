# The Tower Planet (`web/js/planet/`)

Sueda's `reference/the-tower-planet-clean.html` (ART_DIRECTION §12), extracted into ES modules **without changing
the look**. The orbit is in Grain; as the camera comes down it turns into Red-arch Gouache under a clear daylight
sky (`uBlend` and `DAYLIGHT` by altitude). `web/planet.html` rebuilds her page from the modules alone, with her UI
(Walk the road, Grain / Gouache, Colours), and it matches the original **pixel for pixel: mean 0/255, max 0** in all
10 cases (see Tests).

```
http://localhost:8870/planet.html        the rebuild (her page, her chrome); window.__planet = the API below
```

## How it was extracted
`tests/planet/extract.py` slices her file by line number into the modules. Each `«a-b»` marker copies lines a..b
byte for byte, and any substitution in a copied line is asserted to hit exactly once. It is the same method as the
Red arch (`tests/fidelity/extract.py`, docs/paint.md). **Re-running it overwrites** context / terrain / materials /
build / post / views / ui.js and planet.html. `planet.js` (the facade) is hand-written. If you change a generated
module, change the template in extract.py too, or the next extraction loses your edit.

`tests/planet/verbatim.mjs` checks every line of her `<style>` and main `<script>` (1014 code lines):
- 997 are copied verbatim;
- 17 sit at listed seams;
- 0 are unexplained.

The markup and CSS (lines 1–86) are byte-identical in planet.html. Three is the vendored r128
(`web/vendor/three.min.js`), the same bytes as the copy she inlines on line 93.

| file | what (verbatim unless noted) |
|---|---|
| `context.js` | noise + helpers (`mulberry32`, `ihash`, `vnoise`, `fbm`, `smooth`, `lerp`, `col`) as exports. `createContext({canvas, renderer, fail})` makes her renderer (PCF soft shadows, canvas prepended to body), scene, and camera (fov 40, 0.8–9000). It also returns `isMobile`, `reduceMotion`, and `rand`/`R`; her file never draws from `rand`, so no random order needs preserving. |
| `terrain.js` | her flat design space: `C`, `RP`, `TOWER_*`, `mapFlat`, the road (`pathPts`, `curve`, `PS`, `PB`, `pathDist`), `Hland`, `Hfar`, `landMask`, `heightCore`, `H`, `prof`, `cragR`. Below a marked line is the **surface API** (new). Pure apart from the global `THREE`, so it also runs under node after the vendored three is `eval`'d. |
| `materials.js` | `GLSL_COMMON`, `STONE_FRAG`, `ROCK_FRAG`, `GROUND_FRAG`, `COLOUR_KEYS`, `DEFAULT_COLOURS`. `createMaterials(ctx)` makes `uTime`, `SUN`, `BG`, `DAYLIGHT`, `PALU`, `gradTex` and `toon()`. `createColours(ctx, emit)` holds her colour model (`UNI`, `warmTint`, `setColour`), with the DOM half moved to ui.js. |
| `build.js` | her `build()`: the sky with its DAYLIGHT term, the atmosphere, the one planet mesh (land, sea, coast), then the road, crag, arcades, helix ramp, terrace and tower. These are built flat and baked through `mapFlat`. After them come the 6 clouds (`mulberry32(197)`) and the sun. |
| `post.js` | her Red Arch gouache pass (`kuwaharaMat`, `edgeMat`, `paintLineMat`), the lens + grain + gouache finish (`post`: fisheye `uFish .38`, 6-level grain, pencil lines, paper tooth), `makeRT`, `paintPass` and `renderFinish`. |
| `views.js` | her orbit and road-walk cameras, `computeFit`/`resize`, drag/pinch/wheel input, the style state, and the loop body (her uBlend + DAYLIGHT by altitude). New here: the `local`, `path` and `free` camera modes, overrides, render hooks, and `pick`/`toScreen` through her lens. |
| `ui.js` | `mountPlanetUI(planet)`: her chrome bound to the API (Walk / Back, Grain / Gouache radios with arrow keys, the Colours panel, Space, Esc). **The game doesn't mount it** (ART_DIRECTION §3). |
| `planet.js` | `createPlanet()`: builds everything in her order and exposes the API (hand-written). |

**Order is part of the look.** three.js breaks draw ties by program, then material id, then object id. So
`createPlanet` keeps her construction order: context → materials → post (its materials, the quad and
`paintNormalMat` exist before the world, as in her closure) → colours → views → `build()` → `resize()` → loop. Add
your own objects **after** `createPlanet` returns, for example under `planet.surface`.

## API
```js
import { createPlanet } from './js/planet/planet.js';      // needs the global THREE (vendor/three.min.js)
const planet = createPlanet({ canvas, renderer, autoStart = true, input = true, autoResize = true, fail, onFirstFrame });
```
- **`canvas` / `renderer`**: optional. Without them her renderer is made, and its canvas is prepended to `<body>`.
  The host page must make the canvas full-window; her CSS is
  `canvas{position:fixed;inset:0;width:100%;height:100%;display:block;touch-action:none}`. `resize()` reads
  `innerWidth`/`innerHeight`.
- **`input:false`**: her drag / pinch / wheel listeners are not attached. The game drives the camera itself.
- **Loop**: `start()`, `stop()`, `running`, `ready` (a Promise for the first frame). With `autoStart:false`, call
  `planet.frame(now)` from your own rAF.
- **Hooks**: `renderHook({ beforeRender(dt, now), beforeFinish, afterFinish })` returns an unsubscribe.
  - `beforeRender` runs after her camera and sun are placed, before the scene renders into `post.rt`.
  - `beforeFinish` runs after that render, with `post.rt` holding colour + depth, before her finish.
  - `afterFinish` runs after the finish has drawn to the screen.
  - `onFrame(fn)` is shorthand for `beforeRender`.
- **Objects**: `scene`, `camera`, `renderer`, `world` (`sky`, `atmosphere`, `ground`, `clouds`, `cloudMat`, `sun`,
  `sunTarget`), `surface` (an empty Group for game things), `post` (her materials, `rt`, `targets`, `makeRT`,
  `renderFinish`), `uniforms` (`uTime`, `SUN`, `BG`, `DAYLIGHT`, `PALU`), `terrain` (the module), `ctx`.
- **Paint**:
  - `setBlend(v)` is her style button: 0 = Grain, 1 = Gouache, and it stops the auto descent.
  - `autoBlend(true)` hands the blend back to her altitude curve.
  - `setDaylight(v)` / `autoDaylight(true)` work the same way for daylight.
  - `blend` and `daylight` read the current values.
- **Colours**: `setColour(k, hex)`, `setColours({k: hex})`, `getColours()`, with her keys `bg glow shallow deep g2 g1
  wood sand rock shadow`. `COLOUR_KEYS` and `DEFAULT_COLOURS` are exported. `on('colour', ({k, hex}) => …)`.
- **Events**: `on(type, fn)` returns an off function. The types are:
  - `mode`: `'orbit' | 'walk' | 'path' | 'local' | 'free'`
  - `walking`: a boolean
  - `style`: 0 or 1 (crosses 0.5)
  - `colour`
- **Cameras** (`mode`, `state()`):
  - `orbit()` is her "Back to orbit": a smooth return, with Grain again by altitude.
  - `walk()` / `setWalking(v)` is her road journey.
  - `descendTo({ fx, fz, alt | dist, pitch = 1.05, yaw = 0, ms = 5200, fov })` returns a Promise. It is a flight
    from wherever the camera is to a local view over flat point (fx, fz):
    - the focus slides across the globe first;
    - the height falls on a log scale while the view stays top-down (ART_DIRECTION §1);
    - in the last stretch the view tips into `pitch`, and fov 40 → `fov` (default 50) as it comes down.
    - Her uBlend and DAYLIGHT curves run on the real altitude, so Grain turns to Gouache and daylight on the way
      down (measured: alt 728 → 426 → 234 → 127 → 58; blend 0 → .24 → .71 → .92 → .99; daylight 0 → 0 → 0 →
      .35 → .93).
    - It resolves `true` on landing (mode `local`), or `false` if another camera call interrupts it.
    - `alt` is the camera's height over the focus (`dist = alt / sin(pitch)`).
  - `cameraLocal({ fx, fz, dist, pitch, yaw, fov, snap })` is a camera `dist` from the ground point:
    - `pitch` is measured from the local horizon (π/2 = straight down);
    - `yaw` is the flat bearing (0 = the camera is south of the point, looking north toward the tower; +yaw swings
      it east).
    - It eases with her k = 1 − e^(−1.8 dt) unless `snap`.
    - It keeps the camera ≥ 2.5 above the ground under it.
    - Use it every frame (with `snap:true`) for RTS pan / zoom / rotate, for the leader view (dist ~110, pitch
      ~1.05) and for the close landing view (dist ~22, pitch ~1.25).
  - `cameraFree({ position, look, up, fov, snap })` takes world-space poses (the Moon voyage, cut scenes). Blend and
    daylight still follow the altitude.
  - `setOrbit({az, el, dist})` and `orbitSpin(on)` (her idle spin) control the orbit view.
- **Picking**:
  - `pick(clientX, clientY)` returns `{ fx, fz, world, height, onWater, t } | null`. It goes through **her fisheye**:
    the screen shows the scene at `fish(uv)`, so a naive raycast would be off by up to ~60 px at the edges. The ray
    marches the analytic ground `max(H, 0)`; the tower and crag are not picked.
  - `toScreen(worldVec)` returns `{ x, y, behind }`, the inverse lens (12 fixed-point steps), for DOM overlays such
    as bubbles, labels and the mark cursor.

### The surface API (`terrain.js`, also on `planet.*`)
Flat design space: x east, z south, y = altitude. `C = (8, −150)` (the crag) sits on the +Y pole, and `RP = 170`.
`mapFlat` is azimuthal-equidistant round C: 1 flat unit = 1 world unit along the ground.

| call | returns |
|---|---|
| `heightAtFlat(fx,fz)` | her `H`: < 0 = water depth. The planet mesh draws `max(h,0)` (sea surface at altitude 0). |
| `groundAtFlat(fx,fz)` | `max(0, H)`: the drawn ground |
| `isWaterFlat(fx,fz)` | `H < 0` |
| `onCragFlat(fx,fz)` | within 50 of C (the crag's foot) |
| `flatToWorld(fx,y,fz,out?)` | `mapFlat` (allocates when `out` is omitted) |
| `surfaceToWorld(fx,fz,lift=0,out?)` | the drawn ground + lift |
| `worldToFlat(p)` | `{x, y, z}` (y = altitude), the exact inverse (round trip < 1e-12) |
| `upAtFlat` / `normalAtFlat` | the radial up / the ground's normal (central differences) |
| `frameAt(fx,fz,{lift,yaw})` | `{position, quaternion, up, east, south, height, ground, water}`. The quaternion stands an object built upright in flat space (y up, +x east, +z south, `yaw` = its rotation.y) on the planet. |
| `placeOnSurface(obj,fx,fz,opts)` | sets `obj.position` / `quaternion` from `frameAt` |
| `wrapFlatGeometry(geo, matrix?)` | her baking step: every vertex goes through `mapFlat`. Use it for ground decals (fields, roads, marks) built at `H + lift`. |
| `raycastSurface(origin, dir)` | the analytic ground hit (used by `pick`) |

## Seams (the only behaviour changes; `verbatim.mjs -v` lists them)
- `createContext` takes an optional `renderer` / `canvas` (lines 216, 218).
- `build(ctx)` reads `scene`, `PALU`, `toon` and the rest from ctx (334).
- `renderFinish` reads `ctx.world`.
- Her DOM code is split from the state:
  - `setWalking`, `toWalk`, `toOrbit` and `setColour` keep their state in views.js / materials.js;
  - their DOM halves are in ui.js via events (960–963, 998);
  - the pickers start from `getColours()` (1010).
- In `frame()`:
  - `wy` becomes `let`, so the new cameras can use their focus height (1034);
  - `fovT` gets the new modes (1056);
  - wide shadows also cover a high flight or free camera (1068);
  - the loop's own `requestAnimationFrame` moved to `planet.js` (1093);
  - her boot (1097–1100) is `createPlanet` + `start()`.
- In `orbit` and `walk` every line runs as she wrote it, which the pixel gate proves.

## Tests
```
export PATH=~/.nvm/versions/node/v22.22.3/bin:$PATH
node tests/planet/fidelity.mjs [--only=a,b]   # the pixel gate, ~2 min
node tests/planet/verbatim.mjs [-v]           # the line audit
node tests/planet/api.mjs                     # the API, 16 checks + shots/planet/api/
node tests/planet/live.mjs                    # real clock on :8870 (no restart): spin, then a descendTo
```
`fidelity.mjs` serves the repo with `python3 -m http.server`. Both pages get the same **frozen clock**:
`performance.now` and `requestAnimationFrame` are replaced before any script runs, and `__step(n)` advances n
fixed 1/60 s frames. Her file is loaded **unedited** from `reference/`, so no copy or still hook is needed.

It drives the same clicks and pickers on both pages and screenshots each at 1440×900, DPR 1, with a fresh browser
per page (one 4096² shadow map per GPU process; reusing one browser stalled on the 5th page). It waits 1.6 s of real
time for her CSS fades. Results, last run:

| case | what | mean / max | uBlend / DAYLIGHT / alt |
|---|---|---|---|
| orbit-first | the first frame | 0 / 0 | 0 / 0 / 728 |
| orbit-grain | 4 s of spin, clouds, sea | 0 / 0 | 0 / 0 / 728 |
| orbit-gouache | the Gouache button in orbit | 0 / 0 | 1 / 0 / 728 |
| descent-mid | Walk, 0.53 s: half Grain, half Gouache | 0 / 0 | .593 / 0 / 282 |
| descent-late | Walk, 1.5 s | 0 / 0 | .992 / .941 / 55 |
| walk-gouache | on the road, daylight | 0 / 0 | 1 / 1 / 7.9 |
| walk-paused | Pause mid-road | 0 / 0 | 1 / 1 / 7.6 |
| back-to-orbit | Back to orbit | 0 / 0 | 0 / 0 / 694 |
| colours | 4 pickers changed (bg, g2, deep, shadow) | 0 / 0 | |
| walk-colours-grain | Grain on the road + a land colour | 0 / 0 | 0 / 1 / 7.7 |
| control | the rebuild 1 s later vs the original | **4.60** (must fail) | |

The gate also fails on any page error, any 4xx except favicon, or originals with fewer than 2000 colours. The PNGs
are in `shots/planet/`:
- `original-*`, `rebuild-*`;
- `diff-*` (the original dimmed + the difference ×16 + red over 8/255; all black);
- `sheet-fidelity.png`;
- `results.json`.

API shots are in `shots/planet/api/`:
- `descent-0..6`, `descent-landed`, `descent-sheet.png`;
- `local-close-markers*` (four upright red posts placed with `placeOnSurface` on the slope, with shadows);
- `local-leader`, `orbit-back`, `flight2-*`, `free-space`.

## Known limits (for the wiring)
- **Mesh resolution.** The planet is one 420×280 lat-long sphere, about 1.9 world units per row. Below ~40 m the
  coast shows her mesh's stair steps, as in `descent-landed`. Her look code stays as is, so a close home site needs
  a finer local patch on top, or the camera stays at or above the leader distance.
- **Her terrain is not level.** It is 2–4 m rolling meadow round the home candidates, and **there is no lake**. A
  lake, if wanted, is an added water mesh: the ground shader draws water only from the planet mesh's `aW` attribute.
- **Her post is not the Red-arch paint engine in `web/js/paint`.** It has no folk pass, no FACE_LAYER / MASK_LAYER,
  no held frames, and it renders every frame. Folk made by `web/js/paint/folk.js` would be Kuwahara-smeared and lit
  by her camera-following sun. Compositing a folk pass needs `renderHook` (`beforeFinish` has `post.rt` colour +
  depth).
- **Her light follows the camera.** The shadow box is ±110 round the focus in local / walk, and ±300 in orbit.
- **Daylight never quite reaches 1 at the leader height.** Her curve is `smooth(190, max(32, wy+20), alt)`, which
  gives ≈ .93 at 55 m and 1 only below ~32 m.

## Our home on the planet (2026-10-04): `home.js`, `adapter.js`, `folkpass.js`, `web/planet-lab.html`
New files only. Her modules and `web/js/paint` are imported and never edited.

```
http://localhost:8870/planet-lab.html     ?view=orbit|descend|leader|towards|landing|close|n1|n2|n3|wonder  ?nolabels  ?shot
node tests/planet/lab.mjs [--only=orbit,descent,leader,towards,landing,close,pick,walk]   # 15 checks + shots/planet/home/
```

### The site (`home.js`, `createPlanetGeography(planet)`)
- **Home** is the cream coastal plain **east of her road**, between the road and the east chain's foot, with the sea
  along its south-east shore (`shots/planet/home/map-site.png`, `map-game.png`). It was chosen by a search over
  placements of the sim's 60 × 56 plot: no water inside, the sea along game z0, ≥ 3 m clear of the road (it is 7 m),
  and the gentlest middle (~3 m of relief over the middle 40 × 40 m). The back corner climbs onto the chain's foot as a low hill.
- **Frame.** Game coordinates stay the sim's. `toPlanet(x, z) = (44, 21) + R(165°)·(x, z)` and `fromPlanet` is its
  inverse. The turn puts her coast where the sim expects its sea line (game z ≈ −26…−28) and the tower inland, behind the plot.
- **Lake.** Her terrain has a real hollow at planet (52.9, 7.6), which is game (−12, 10.6). It is filled on the DRAWN mesh to just
  under its lip: level 5.014 m, 57.8 m², 0.44 m deep, a 21-point polygon. It is drawn as a level sheet in **her own ground
  material** (`planet.world.ground.material`, aW = depth × 8: a ~10 cm foam lip, was × 4.5), so it gets her sea's paint and foam lip. The shore is
  the true intersection with her ground.
- **Sea polygon** for the sim: her painted waterline (the ground shader's own `aW > -0.4`) traced round the plot
  (101 points, game x ±110, z −90…18).
- **Nations** stand on real sites, each picked by a flatness search:
  - n1, the Drop Riviera: a **headland**, planet (204, 46) = game (−148, −66), across the water to the east.
  - n2, the Loaf Republic: a **hill town** on the west hills above the west bay, 16 m up, planet (−86, 12) = game (123, 42).
  - n3, the Puffer Harbour: an **island harbour** on the SE island, planet (170, 128) = game (−94, −136).
  - **Wonder** = her tower, game (−9.5, 174.5).
- **API** = `globe/geography.js`'s: `heightAt` (< 0 = water depth; on land the drawn altitude), `isWater`, `waterKind`
  (`'sea'|'lake'|null`), `landWeights`/`landKind` (from her per-vertex sand/rock/snow; cream on the plot), `places`
  (`home.view` = the leader pose, `home.towerView`, `home.landing`; `nations[]` with x/z + fx/fz; `wonder`),
  `placeById`, `inPlot`, `inLake`, `homeSpots`, `GLOWS`, `flatToSphere`/`sphereToFlat`/`frameAt`, `PLOT`, `CAMP`.
  It adds `water` (the sim's polys), `LAKE_Y`, `groundY`, `surfaceY`, `waterLevel`, `onRoad`, `toPlanet`/`fromPlanet`
  and `stats()`. `setWater()` does NOT adopt the sim's seeded lake: her terrain fixes ours, so push it the other way
  (integration step 2 below).

### The adapter (`adapter.js`)
- `createDrawnGround(planet)` reads **the mesh the GPU draws** (her 420 × 280 sphere, ~2 m a cell; the triangle is
  located by SphereGeometry's own layout, then hit by the radial ray). Between vertices it differs from her H by up to
  0.6 m, so everything stands on this, not on H. In node it rebuilds the same vertices from `heightCore`.
- `createSurfaceAdapter(planet, { geography })`, all in game coordinates:
  - `groundY(x, z)`: the drawn altitude.
  - `surfaceY(x, z)`: the water surface where there is water.
  - `toWorld(x, y, z)` / `toFlat(world)`: exact round trip (7e-14).
  - `frame(x, z, {rot, yOffset, y, normal})`.
  - `place(obj, x, z, {rot, footprint, yOffset, y, normal})`: upright on the radial up; with a footprint it sits on the
    lowest ground under it. It adds the object to `planet.surface` and tags it `userData.planetWorld`.
  - `pick(cx, cy)`: through her fish lens, on the drawn ground + lake + sea. It returns
    `{x, z, y, fx, fz, world, water, onWater, inPlot}`; the round trip error is ~1e-11 m.
  - `toScreen`.
  - `cameraLocal`/`descendTo` take game `{x, z, yaw}` (game yaw 0 = camera on the +z side looking toward −z;
    `yawToPlanet = yaw − 165°`).
  - `flatCamera` + `syncFlatCamera()`: her camera expressed in game space, the `ctx.camera` for folk.js.
- **Folk mapping**:
  - Every scene child that is not hers, not `planet.surface`, and not tagged `planetWorld` is **flat space**: folk
    roots, world-space legs and feet, blobs, the agents' props, puffs and piles.
  - `hideFlat()` / `showFlat()` hide them from her passes.
  - `mapFolk(folk)` sets each object to `mapFlat(toPlanet(x, z), y)` × the local frame × the game turn. Blobs lie on the
    drawn triangle's slope.
  - `restore()` puts the flat transforms back.
- **Walk test** (lab, `walkTest`): a flit walks 41.7 m across the plot in flat space; 607 samples. The worst planted
  foot is 3.9 cm from the drawn ground, the same as in flat space (3.9 cm: the leg rig lifts both feet by the body
  centre's ground). Tilt from the radial up: 0.000002°.

### The folk pass (`folkpass.js`)
`createFolkPass(planet, { adapter, ctx })` returns `pass.backdrop` (KEY_DIR + the reference hemi 0.62 / key 0.85,
on FACE_LAYER only, so her passes never see them) for `createFolk(ctx, pass.backdrop, nav)`, then `pass.attach(folk)`:
- **beforeRender:** sync the flat camera, hide flat objects.
- **afterFinish:** show them, `mapFolk`, then the Red arch `renderFolk` sequence:
  - colour clear over **her depth texture** (`post.rt.depthTexture` shared as the depth attachment: terrain, tower,
    buildings occlude);
  - blobs on;
  - `camera.layers.set(FACE_LAYER)` render with her camera;
  - the painter's verbatim `folkPaintMat` (radius and warp from `painter.G` exactly as `renderFolk`).
- **Composite:** onto her finished frame through her `fish()` lens. The formulas are the Red arch Gouache composite's
  (body/face opaque with paper tooth + pooling, soft shadow by alpha); below uBlend 1 they are quantised like her grain.
- Then `restore()`. The painter (`createPainter({...ctx, camera: herCamera}, folk)`) is made only for its materials and `G`.
- `depth: 'rerender'` does the reference's own depth-only redraw instead. The pass never redraws her shadow map and
  is skipped above altitude 420.
- `keyMode`: `'reference'` (default) or `'sun'` (her SUN).
  - In `'reference'`, KEY_DIR = the reference key (−28, 22, 20) in the view's frame on the ground: the upper left in
    front, whichever way the leader turns.

### Lab and shots (`shots/planet/home/`)
- **Shots:** `orbit-grain`, `descent-2/3` (blend .13 / .54), `leader` (90 m, pitch 1.0), `leader-towards`, `landing`
  (22 m, pitch 1.3), `close` (eye level, for meetings), `pick` (the ✕ by the windmill).
- **Sheets and maps:** `sheet-home.png`, `map-planet/region/site/game.png`, `results.json`.
- **`tests/planet/lab.mjs`:** 15/15.
- **The ✕** is a pencil-ink strip mesh on FACE_LAYER under `planet.surface`. It is drawn crisp in the folk pass and
  occluded by nearer ground.

### Notes / limits
- **Daylight at the leader view** is her curve: 0.74 at 85 m up (it reaches 1 only below 32 m). Left as is.
  `planet.setDaylight(1)` would force it, and that is Sueda's call.
- **Pale diagonal stripes** close up (`landing`, `close`) are her ground shader's world-anchored hedge lines
  (`hedge` → `uWood*1.7`). Her look, untouched.
- **Mesh resolution:** below ~40 m her 2 m cells show (stair-step coasts, faceted swells). The landing view is inland
  and reads fine.
- **The leader view sometimes has one of her orbiting clouds** passing under the camera (her clouds, her rotation).
- **The agents bridge** (`agents.js`) adds `groundY` to driven fliers' blobs every frame without resetting them (a
  flat-world bug that the planet only exposes). The lab places blobs itself. `mapFolk` keeps a blob whose flat y is more
  than 30 m off the ground (a parked one: agents.js parks unplaced folk's blobs at y −100 and the offset drifts them) under
  the ground; it used to show as a dark disc at the plot's origin.
- **The lake sheet** (polish 2026-10-04) covers only the flooded hollow plus a 1 m lip, and its vertices over dry ground dive
  0.2 m under it: no stray foam squares from other low spots, no box-edge cut.

## The nations' towns (2026-10-04): `towns.js`
New file; her modules, `web/js/paint` and the prefabs are only called. `world.buildTowns({ api, folk })` (game.js, right
after `lib.load()`) builds them once; `world.towns` → `{ list, get(id), stats(), people, layouts, styles, dispose() }`.

```
node tests/planet/towns.mjs [--only n1,n2,n3,stages,horizon,orbit]   # 7 checks + shots/planet/towns/ (on :8870, no restart)
```

| | site (home.js) | the town | colourway |
|---|---|---|---|
| n1 **Drop Riviera** | the headland above its cove (visit from the south, over the cove) | a little square with a fountain and a market loggia on the 7–8 m plateau, a coral campanile at its corner, houses round it and stepping down to the cliff edge and up the east slope on stone terraces, a windmill on the rock across the cove; umbrella pines, cypresses, an olive | coral / peach / blush washes, her terracotta roofs, coral-red arcades, teal shutters |
| n2 **Loaf Republic** | the spur above the west plain (visit from the south-west) | a tight hill town of 15 houses climbing the spur to its campanile, a market loggia on the lower shoulder, a windmill on the ridge above | white and sea-glass washes, sea-glass teal roofs, domes and arcades, pale stone |
| n3 **Puffer Harbour** | the island's sheltered basin (visit from the open sea, east) | a stone pier running out into the basin with three canoes, a grey-stone warehouse at its head, a row of striped stalls on the quay, yellow houses round the basin, the starter lighthouse (`buildings/examples/lighthouse.js`) on the point | warm yellow and cream washes, ochre-gold tiles, grey stone, harbour-blue doors and lighthouse bands |

- **Layouts** (`TOWN_LAYOUTS`) are authored in each town's LOCAL frame: metres, the visit camera on the +z side, so house
  fronts (+z) face the visitor and the painted light falls the same way on every town. local → her flat space by
  `R(yaw)` (her cameraLocal bearing: n1 0, n2 −π/4, n3 π/2), then `fromPlanet`. Every spot was fitted against her
  terrain (least relief, dry, no overlaps; the fitter lives in the session scratchpad, the result is plain data here).
- **The dye** (`dyeApi(api, style, k, variant)`): a thin wrapper over the Build API that the prefab's `build(api)` gets
  instead of the api. Pale washes → the town's walls (each distinct wash in one building its own, so two-tone stays
  two-tone; `k` picks where in the palette a building starts), beige limestone → its stone, the Red-arch red → its
  accent, `TERRACOTTA` / `REDWALL` / `LIMESTONE` / `WHITEWASH` ramps → its roof / accent / stone / wall ramps, shutters
  → its shutter colour; walls get a little more `lift` so they stay warm in her shade. The prefab code is untouched.
- **On the sphere:** every building is placed in its own frame (`adapter.place`, so a 40 m town follows the curvature),
  standing on the high side of its footprint less a little (it sinks ≤ 1.6 m into the slope uphill) with a **stone
  terrace** (podium + cap, nation stone) down to the low side and 1.2 m into the ground; slim towers sink deeper.
  Floating things (pier, canoes) sit on the sea level.
- **Merged:** all parts are baked into the town root's frame and merged per material and role (solid / colour-only /
  keyline proxy, so her pencil pass still draws the outlines): **22–26 draw calls a town** for ~600–780 parts. Only the
  windmills stay whole so their sails turn (`mod.animate`). Build time ~210 ms for all three.
- **Folk:** 6 drops (n1), 6 loaves (n2), 3 puffers + 2 pips + 2 scoots (n3), `folk.make.*` with `controlled` (folk.js
  never wanders them home), the §13 colour rule on pips / puffers, `nav.bounds` unbound for them only. They stand and
  look about, and every 6–16 s may walk to another of their spots on the square / quay, only along a line clear of the
  buildings. A `planet.renderHook` `beforeRender` lifts root, legs and shadow onto the drawn ground (as the agents bridge
  does for ours); the folk pass maps and paints them like any folk.
- **Visits:** `build()` sets each nation's `view` (dist 40–44, pitch ~0.8, the town's yaw) and moves its `x/z/fx/fz` to the
  town's heart (`view.look`; the original site is kept in `n.site`), so `stages.visitNation` (her descendTo) lands on
  the town. Measured landings: n1 alt 39, n2 48, n3 36, Gouache 1, daylight ≥ 0.98.
- **Shots** (`shots/planet/towns/`): `visit-n*` (the visit camera), `close-n*` (20 m, low), `high-n*` (110 m),
  `stage-visit-n*` (the real orbit → visitNation path), `orbit-home|n1|n2|n3` (tiny coral / teal / yellow settlements),
  `horizon-n*` (from home, low, turned toward each), `leader-home`.
- **Limits:** from home the planet is small (R 170): the towns are 130–165 m away, past a 26–52 m-high camera's
  horizon. The Loaf Republic's campanile and windmill show on the skyline; the Drop Riviera's tower just peeks past the
  sea stacks; the Puffer Harbour faces east behind its own island's 20 m hills, so it reads from orbit and on a visit,
  not from home. Her coarse sphere (1.9 m cells) makes the coast stair-step under the visits (her look, as at home).
