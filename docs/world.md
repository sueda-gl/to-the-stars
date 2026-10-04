# World (`web/js/world/`)

The gouache map, seen the way a leader sees it (ART_DIRECTION §1): a **high oblique bird's-eye** over a painted
relief of a real place. Since 2026-10-04 (ART_DIRECTION §8, "not a slab") the place is a **designed landform**
(`web/js/globe/landform.js`, exposed by `geography.js` as `LANDFORM` / `reliefAt`), the same heights on the map and the
globe: our home in a coastal valley behind a crescent beach, the river out of the mountains through a gorge and across
a floodplain to an estuary, ridgelines with spurs and eroded ravines, the west headland (Drop Riviera), the hill town
above the east coast (Loaf Republic), the island across the bay (Flit Sky-hold), a second island, sea stacks, shoals,
and a limestone range at the back. **The map's coast is the globe's coast.** It starts as the ivory relief map of mb 1 (paper land,
soft relief light, teal paper-crinkled sea, warm glows on our camp and the far towns) and colour blooms in as we
build (striped fields, meadows, sand paths, round trees: mb 4 / 5). Everything is drawn by the verbatim paint
engine (`web/js/paint/`, never edited).

| file | what |
|---|---|
| `world.js` | `createWorld()`: wires everything; the key light's map-side aim; building pads; bloom + trees on `building:done`; the old tracks; `worldCamBase()`; re-exports `makeNav`, `DEFAULT_VIEW`, `VIEWS`, `ZOOM`, `pitchForDist` |
| `ground.js` | one relief mesh for the whole region (±214 m, 0.5 m grid near the plot): the landform's heights with the waterline lowered onto the map's sea plane (`mapY`), per-vertex cover WEIGHTS + painted value (colour is computed per pixel from the look: cream start, bloom palette), Lambert + hemi + a shadow-tint term + painted two-tone light, the bloom, farm patchwork, tracks, foam; pencil **contour tents**; `groundY` reads the mesh itself; building pads; the sea's depth map (true bathymetry); `setLook` / `getLook` for its share of the look |
| `relief.js` | superseded by `globe/landform.js` (unused) |
| `water.js` | `buildSea`: the reference sea shader (copied) on a plane past the far plane, coloured by depth, with a crinkled-paper surface; `buildLake`: the reference pool's `Reflector` + `PoolShader` (copied), cut to the sim's lake |
| `dressing.js` | **§21 seaside dressing** (2026-10-04): `planDressing` plans the painted trees (composed copses, the lake's shore, the coast's umbrella pines, lone trees) and the green meadow spots; `meadowMask` bakes the spots into a mask the ground paints |
| `scenery.js` | the woods (thousands of low-poly trees in the trees.js grammar, instanced) and the plot trees (trees.js itself, via the build api) that grow in round finished buildings |
| `glow.js` | warm settlement glows (alpha sprites, colour-only), fading as the camera comes down |
| `horizon.js` | the nations, built with the globe's own `globe/towns.js` `buildNation`, on their headlands / island |
| `camera.js` | the leader rig: views, input, damping, scripted moves, picking |
| `nav.js` | `makeNav(game, world)`: the paint engine's nav seam for our plot |
| `moon.js` | **not mine** (moon/voyage builder); the world imports `createSkyMoon` from it |

## Sueda 08:30 (§21): the old seaside map is home again, + trees and green spots
The game lands on THIS map (the cross-fade from her planet is below). The map is **exactly** the one in her 08:28
screenshot (world-lab leader view: cream plain, wide teal sea, sea stacks, the lake, the river, the woods, the two
headland towns). Nothing in it was changed; only two things were added, and both can be turned off:
- **Trees** (`dressing.js` `planDressing` → `scenery.dressTrees`). The approved painted trees from `buildings/trees.js`
  through the build api, 13 variants (olive ×3, oak ×2, umbrella pine ×3 incl. a two-tier one, cypress ×2, lemon,
  orange), mixed at random per copse theme (olive grove, coastal umbrella pines, mixed, lake shore, oaks). ~87 trees:
  20 composed copses round the plain (west toward the river, south, east toward the woods, the east headland), the
  plot's four corners, the lake's outer / seaward shore, a few umbrella pines along the coast behind the beach, and
  lone trees. **Never in the buildable centre**: an ellipse over the plot's middle (and a wider rim ellipse inside the
  plot) stays clear; also clear: the spawn (9 m), the tracks, the river (5 m), the beach's wet edge, steep slopes, the
  old woods, the nations. Trees inside the plot (~23: corners, lake shore) are ordinary **plot trees**: nav obstacles
  (nav rebuilds on `world.ready`), cleared by a new site's footprint (`clearRect`), re-stood on pads. The rest are
  static `InstancedMesh`es per variant (one colour mesh + one instanced pencil proxy per crown, as trees.js draws
  them), `folkHidden` (they never stand in front of the folk) and skipped by the lake's mirror. Instance rotation is
  kept to ±0.3 rad so the baked upper-left light stays upper-left.
- **Green spots** (`dressing.js` `meadowMask` → `ground.setMeadows`). ~25 soft meadow patches: lumpy clusters of
  3–4 ellipses baked into a 512² mask over ±140 m; the ground shader thresholds it with brushy noise (dry-stroke rim,
  grass-stroke texture close up, pigment pooled at the rim), in the bloom palette's meadow greens with a few drier
  dabs. They sit beside the river, round the lake (its outer side), under some copses, at the plot's back corners and
  edges and south of it; never on the beach, in water or in the centre. Cream with colour (mb 1), not a flood. They
  are part of the cream start state, so a bloom / the farm patchwork paints over them; buildings may stand on them (§9).
- **No fisheye.** The map never had a lens (the lens is her planet's `uFish`); nothing here adds one.
- Options: `createWorld(…, { dressing: true })`; look key `meadows` (0..1, strength of the green spots, live);
  `world.dressing` = `{ trees, meadows, centre, inCentre, stats }` (the plan). Lab: `?dress=0` (and the "Without
  trees + greens" button) shows the old map to compare; `?autobloom=0` = the game's §9 rule (no bloom round buildings).
- Cost (headless Chrome, Metal, leader view, one `renderPainted` incl. shadow / keyline / folk / mirror passes):
  1256 → 1352 draw calls, 4.51 M → 5.42 M triangles (+20 %); none of it is in the per-frame folk pass except the ~23
  in-plot trees. Wall time on this shared machine is too noisy to quote (13.4 vs 14.9 ms in one pair of runs).
- Shots (`shots/world/dress-*.png`): `dress-default` (leader, start), `dress-old-default` (the same without the
  dressing), `dress-folk-custom` (closer, the folk by the lake), `dress-lake-custom`, `dress-buildings-custom` (six
  buildings, no bloom, 82 m), `dress-buildings-leader-custom`, `dress-eye`, `dress-top`, `dress-descent`,
  `dress-close20start`, `dress-phone-default` (390×844).

### The landing hand-off (planet → this map): one shot through a cloud
```js
const pose = world.handoffPose({ aspect: innerWidth / innerHeight });
// { eye:{x,y,z}, look:{x,y,z}, up:{0,1,0}, fov /* the rig's */, fovV /* at that aspect (portrait widens) */, aspect,
//   pose /* {tx,ty,tz,yaw,pitch,dist,fov}: the leader view */, near, far,
//   descend: { x, z, dist, pitch, yaw, fov }  /* game coords, ready for planet/adapter.js descendTo / cameraLocal */ }
await world.readyForHandoff({ painter });   // world.ready + the trees.js kinds + the dressing built, every program
                                            // compiled (renderer.compile), one painted frame made. Resolves with the pose.
```
Leader pose today: target (0, 0.6, −12), yaw 0.1, pitch 1.0 (57° down), dist 168, fov 40 → eye ≈ (9.06, 141.97, 78.32).
The rig and her planet use the same convention (yaw 0 = the eye on the game's +z side looking toward the sea, pitch
= angle down, look at the ground), and `adapter.descendTo` converts game x / z / yaw to her planet itself.

**The landing is one uncut shot through a cloud (2026-10-04, Sueda: "i want the descent to earth to be seamless … no
cuts in between").** Her planet's home terrain and this landform cannot be made to agree (at the hand-off her camera is
~170 m over a 170 m planet: you see its curve and space; this map is flat), so the two are never shown blended: the
swap happens inside a bank of cloud. `web/js/game/stages.js` (flyDown / flyUp) + `web/js/game/cloud-pass.js`:

1. **Build early, paint late** (unchanged): the world is built under the title, canvas under hers (`z 0` vs her `z 1`),
   `readyForHandoff({ painter })` once, its loop not run until the swap.
2. **Down** (`stages.diveHome({ to })` / `homeFromGlobe()`): her `descendTo(handoffPose().descend)` (6 s). A bank of her
   clouds stands over the landing target (the puffs are billboards in a flat frame on the target: her planet's tangent
   frame there, this map's own axes here, so both cameras see them at the same pixels when their poses match). The swap
   height is twice the end view's eye height (170-265 m; the map shows its edge only above ~300 m). Her camera flies
   into the bank; at the point of her path where it is at that height (past her focus slide, s ≥ .62) the inside of the
   cloud is fully opaque, and in that frame her canvas goes (`display: none`) and this map starts painting at the same
   pose. This map's camera then carries straight on from her path (same pose, same speed: a Hermite from her path's state
   at the swap, eased to rest) out of the bottom of the cloud, down to `to` (the opening's landing camera; the leader view
   from homeFromGlobe). Her lens is never touched (the swap is hidden, it does not need to match).
3. **Up** (`stages.lift()`, used by showGlobe / visitNation / goMoon): this map's camera rises from wherever it is into
   the cloud (twice its eye height up), turning half way to her orbit's up; in the opaque frame her canvas comes back at
   the same pose (her camera via `cameraFree` in the cloud's frame), and her camera rises on out of the bank (which
   shrinks away) to her orbit facing home, at rest, exactly where `world.orbit({ over: geo.centre })` puts it.
4. The cloud: her four cloud tones, lit from the viewer's upper left like hers, lumpy balls in rows; a 2D canvas over
   both (`z 2`, under the UI) drawn after both paint (`stages.afterFrame`), the map's pose set before anything is placed
   (`stages.beforeFrame`). The two canvases never paint in the same frame (no doubled GPU frame).
5. Skipping the descent (any key / click) is still a hard cut onto the map (`land({ snap: true })`).
6. Verification: `tests/handoff/record.mjs` (dpr 2 screencast of the descent, the lift and the way home) +
   `tests/handoff/analyse.py` (strips every 0.1-0.2 s and the frame-to-frame difference per 50 ms): shots/handoff/.

## API
```js
import * as geography from './js/globe/geography.js';
import { createWorld, worldCamBase, makeNav, DEFAULT_VIEW, VIEWS } from './js/world/world.js';

const camera = new THREE.PerspectiveCamera(46, innerWidth / innerHeight, 0.5, 1400);   // far >= 1400: the sky dome
const backdrop = createBackdrop(ctx, { camBase: worldCamBase() });   // camBase = the 'eye' view's eye (the sun sets there)
const world = createWorld(ctx, kit, game, { geography, backdrop,
  view = DEFAULT_VIEW,            // the leader view
  input = {},                     // rig input options (below); default: left is NOT used (marks own it)
  scenery = true, trees = true, neighbours = true, moon = true, glows = true,
  autoBloom = true, autoLevel = true, plotOutline = true });
const folk = createFolk(ctx, backdrop, makeNav(game, world));
const painter = createPainter(ctx, folk, { framing: world.framing });
await world.ready;                // nations, sky moon, the trees.js plot-tree kinds

// loop (place the camera only on painted frames, like the reference rig):
world.update(dt, t);              // camera damping / tweens, bloom + tree growth; returns true while paint is spreading
folk.update(dt, t);               // + lift each folk by world.groundY (agents.js does this)
painter.frame(dt, t, tt => world.beforeDraw(tt));   // rig.place(), the shadow camera, sea / lake / glows
```

### Camera
Views (`VIEWS`, `world.view(name, {ms, snap})`):
- `leader` (= `DEFAULT_VIEW`, `world.home()`): `{ tx:0, ty:0.6, tz:-12, yaw:0.1, pitch:1.0, dist:168, fov:40 }`, about 57° down. It frames the whole plot, the bay, the island and both headlands' towns at the top corners.
- `eye`: the old low 3/4 view `{ tx:-6, tz:-18, yaw:0.36, pitch:0.205, dist:66, fov:46 }`, with the horizon, the sun, the moon and the nations. Use it for up close, meetings and cinematic shots.
- `top`: `{ pitch:1.45, dist:330 }`, nearly straight down over the region, like a relief map.

Zoom runs from `ZOOM.min` 12 m (the folk read) to `ZOOM.max` 250 m (the region). As you zoom, the pitch eases along `pitchForDist(d)` (0.66 at 12 m → 1.0 at 168 m → 1.1 at 250 m), keeping any tilt you added. Everything is damped. The target is clamped to 150 m from the plot centre and rides the ground.

Input (`createWorld(…, { input })` or `world.rig.setInput({...})`; `world.rig.input` reads it). The defaults:

| option | default | |
|---|---|---|
| `pan` | `[2, 1]` | the buttons that pan: right and middle |
| `rotateMod` | `['alt', 'shift']` | held with a pan button, it turns and tilts instead |
| `rotateButton` | `null` | a button that always turns and tilts |
| `left` | `'none'` | `'none'` (marks own it) or `'pan'` / `'rotate'` (the lab uses `pan`) |
| `closeOrbit` | `[0, 2, 1]` | buttons that orbit in up-close mode |
| `wheel`, `keys`, `zoomTilt` | `true` | |
| `edgeScroll` | `false` | `edgePx 14`, `edgeSpeed 0.55` |

The keys are Q / E (turn), R / F (tilt), WASD and the arrows (pan), and + / − (zoom). Keys are ignored while typing. The eye never goes under the hills.

Every move returns a `Promise<boolean>`: true when it finished, false when interrupted.
- `world.descent({ from: 'sky' | 'globe' | {eye, look, fov} | pose, ms, to })`
  - `'sky'` (default, 5.2 s) starts 340 m up, looking nearly straight down (pitch 1.47) at the region like a relief map, slightly turned. The height falls in log space and the view stays top-down for the first third. Then it tilts and turns into the leader view.
  - `'globe'` (3 s) starts exactly at the globe's dive end over home (`geography.places.home.view`, read live; today eye (0,100,16) → look (0,0,−4), pitch 1.37) and eases into the leader view.
  - It can't be interrupted.
- `world.focus(x, z, { dist, yaw, pitch, ms })` glides to a creation site at a pitch that suits the distance.
- `world.lookAt`, `world.lookToward` (the old long-lens look from the plot's edge) are unchanged.
- `world.showNeighbour(id)` is now the leader's tilted look from our coast toward that nation (pitch 0.6). `{ cinematic: true }` gives the old long-lens horizon shot.
- `world.visit(id)` flies to a nation's town at a high oblique (pitch 0.7, 74 m). `world.back()` returns from it.
- `world.upClose({x, z, y?}, { r:9, pitch:0.2 })` is the reference's low orbit, used for the Assembly and meetings. `y` defaults to the ground there + 1.1.
- `world.rig`: `pose()`, `setPose(p)`, `goView(name)`, `stop()`, `busy`, `mode` ('map' | 'close' | 'visit'), `enabled`, `dragging`, `wasDrag()`, `globeView()`, `view` (the home pose), `views`, `input`, `setInput()`, `surface(x, z)`, `goal` / `cur`.

### Picking and ground
- `world.pick(clientX, clientY)` marches the view ray over the visible surface (the same surface `groundY` reads, the lake's water, the sea or river surface). It returns `{x, z, y, inPlot, onWater, water:'lake'|'sea'|'river'|null}`, or null for the sky.
- `world.groundY(x, z)` is **the mesh itself**: the same triangle split the GPU draws, so anything stood on it touches it, inside the plot too. The plot is **no longer y = 0**: it rolls ±1–3 m, with a low hill at the back, a knoll, a bank round the lake and a slope down to the beach.
- **Building pads.** When a site is laid out (`building:site`, and again on `building:design`), the ground under its footprint is levelled to the height at its centre, with a 0.7 m margin and a 2.6 m soft skirt (cut and fill). This happens for buildings, not for outlines, strokes or floating things. After it, `world.groundY(b.x, b.z)` = `world.siteY(b)` = the pad height, and every corner of the footprint is the same height. The world's listener runs first, because the world is created first. **Stand building visuals at `world.siteY(b)` (or `world.groundY(b.x, b.z)`), never at 0.**
  - `world.level(key, { x, z, w, d, rot, y?, margin, skirt })` / `world.unlevel(key)` do the same by hand, e.g. for a plaza.
  - `world.levelBuilding(b)` re-levels a building.
- `world.isWater(x, z)`, `world.waterAt(x, z)` ('lake' | 'sea' | 'river' | null), `world.inPlot(x, z)`.

### Colour bloom
- `world.bloomBuilding(b, { ms:2000, delay, paths:true, trees:true })` does four things:
  - paints a brushy disc of radius `max(w,d)*0.7 + 5.5`;
  - lays sand paths to its two nearest finished buildings within 24 m;
  - grows 2–4 trees.js trees in the free ground of its ring;
  - widens the town's own wash (key `__town`), centred on what's built.

  Inside our plot, bloomed land is **farmland**: a patchwork of 14 × 10 m parcels in four kinds (striped crop bands, meadow, ripe ochre, straw), with darker hedgerows between them. Outside the plot it is the painted ground cover.
- `world.bloom(x, z, r, { ms, key, delay, instant })`, `world.path(...)` and `world.unbloom(key)` are unchanged. The shader holds 48 blooms and 24 paths.
- `world.setWorldBloom(v, { ms })` (0..1) spreads colour over the whole region as a ragged front out from our plot. 1 = all painted (the lab's "full bloom"). The nations' own land is in colour from the start.
- `world.plant(x, z, { kind:'olive'|'oak'|'lemon'|'pine', s, delay, ms })` grows one plot tree. A new site clears trees off its footprint.

### Look (the LOOK CONTRACT, shared with the globe and the gouache lab)
`world.getLook()` → plain JSON of every key below; `world.setLook(partial)` applies any subset **live** (marks the
painter dirty) and returns the new look. Unknown keys are ignored. Defaults are today's look.

| key | default | what |
|---|---|---|
| `sunAz`, `sunEl` | 257.4, 32.1 | the key light: compass bearing it comes FROM (0 = north / the sea / -z, 90 east, 180 south, 270 west) and its height, degrees. Moves the light, its shadow camera and the sea's crinkle light |
| `keyIntensity`, `keyColor` | 0.85, `#ffe0bc` | the reference key (`backdrop.key`) |
| `hemiIntensity`, `hemiSky`, `hemiGround` | 0.62, `#b8cfd8`, `#c89a6a` | the reference hemisphere light |
| `shadowTint`, `shadowStrength` | `#3a4a9a`, 0.62 | what the key does not reach (cast shadows, slopes turned away) shifts to this hue at the same value |
| `creamColor` | `#f3e3bf` | the paper land of the start state (mb 1); its dark end mixes toward the shadow tint |
| `bloomPalette` | `['#3f5a24','#6b8a35','#a3b356','#c9a24e','#e3cf8c','#2c4219']` | [deep green, meadow green, light green, ochre, straw, woods]: the painted land (meadows green in the lowlands, ochre / straw up the warm hills, woods) and the striped fields |
| `reliefScale` | 1 | vertical scale of the hills (our land is never scaled: buildings stand on it); re-stands the mesh, keyline proxy, contours and woods (~0.3 s) |
| `contours`, `contourSpacing`, `contourOpacity` | true, 2.5 m, 0.55 | the pencil contour lines (index line every 5th, heavier) |
| `waterShallow`, `waterDeep` | `#93cfc3`, `#1d4f93` | the sea: the shelf's teal over sand → the deep ultramarine (`water.js`) |
| `coastLine` | 1 | stored for the lab; the map's coast line is the land proxy's edge (always on; see Gaps) |
| `haze` | 0.18 | aerial haze toward the far land and sea (from above; the eye view keeps the reference's own horizon haze) |
| `brush` | null | the Kuwahara radius for the map (`painter.G.brush`); null = the user's own Gouache setting, scaled by the view (×1 at the leader view → ×0.62 at the top / descent views) |
| `camPitch`, `camDist`, `camFov` | 1.0, 168, 40 | the leader view (`rig.view`); applied to the current pose when the map is idle |

The world finds the painter itself (`window.__agora.painter` in the game, `window.__lab.painter` in the labs) or takes
it from `world.usePainter(painter)`. Per view it also keeps the contour tents ~3.6 internal px wide
(`ground.setViewScale`), hides the minor contours beyond 280 m and all contours in the eye / up-close views.

### Neighbours
- `world.nation(id)` and `world.nations()` are as before (`{ id, name, x, y, z, dir, edge, colours }`).
- `world.neighbours` (after `ready`) and `world.moon` are as before. The moon is placed for the eye view.
- `world.glows.add(id, x, y, z, { size, strength, near })` / `set(id, {...})`: there is a glow over our spawn and one over each nation.

Also: `world.ground` (the mesh, its `uniforms`, `pads`, `setTracks`), `world.sea`, `world.lake`, `world.scenery`, `world.keyDir`, `world.backdrop`, `world.root`, `world.camBase`.

### `makeNav(game, world, { margin = 1.2 })` → nav (docs/paint.md seam)
- `pickTarget` is overridden. It picks a free point (inside the plot, off the lake by 0.8, off every building and plot tree). 45 % of picks go near a finished building, 25 % near the centre, and in close-up 55 % go to the meeting place. There's one detour waypoint round the lake.
- `obstacles` is **our own array**, rebuilt in place on `building:site|design|done|remove`. A building is 1–n circles along its long side; each plot tree is one circle round its trunk.
- `bounds` clamps to the plot. `extraPush` keeps walkers out of the lake. `flyTarget`, `floatTarget` and `flyPush` keep fliers over the plot. `spots` are round `state.spawn`.
- Extras: `freePoint(near?, radius)`, `routeTo(from, to)`, `blocked(x, z)`, `rebuildObstacles()`, `refreshWater()`.
- The nav is flat (x, z). Lift each folk by `world.groundY(x, z)` after `folk.update`: `agents.js` does it, and so does the lab's `standFolk()`.

### Changes from the low-camera world (for game.js and the other builders)
1. `DEFAULT_VIEW` is the leader view. `worldCamBase()` now returns the eye view's eye.
2. A left drag does nothing by default (`input.left = 'none'`). Right / middle drag pans, Alt or Shift + drag turns. Pass `input: { left: 'pan' }` for the old feel.
3. **The plot has relief.** Use `world.groundY` / `world.siteY(b)` for everything stood on it (buildings, props, marks, folk). For example, `game/creation.js` `groundYOf` must not return 0 in the plot.
4. `showNeighbour` frames from above (`{ cinematic:true }` for the old shot), and `visit` is higher.
5. `plotOutline` is now a faint dotted pencil line drawn in the ground shader, seen only from above.

## The map side of the look (choices worth knowing)
- **Relief: the designed landform** (`globe/landform.js`, docs/globe.md "The landform"). The map samples
  `LANDFORM.height` (true sea level 0) at every vertex and lowers the waterline onto its own sea plane:
  `mapY(h) = h - 0.9 (1 - smoothstep(0, 1.6, h))` (identity above 1.6 m), river channels below the plane; the sea bed
  drops fast under the plane (16-bit depth: the sea plane must win from 400 m up). Our lake is a smooth bowl to the
  sim's polygon with its bank at `LAKE_Y`. The plot's own landform (a plain rising gently inland from the beach, a low
  hill and a knoll at the back, the knoll over the beach where the director's lighthouse goes, a shallow dry valley)
  is part of the landform, so the globe shows it too.
- **Start state (mb 1).** Cream paper land (`creamColor`) shaded by the painted value and the light; limestone a cooler
  paper, beaches lighter, the woods (and the ground under them) muted olive-sepia masses. The woods' instanced trees
  are tinted the same way (`scenery.setIvory`) until the world blooms. The plain's gentle swells stay clean paper (the
  shadow tint and the painted light only act on real slopes, > ~8°): no mushy blotches.
- **Colour blooms** from `bloomPalette`: greens in the lowlands, ochre / straw up the warm hills, woods, limestone, sand;
  our bloomed land is the striped field patchwork (mb 4).
- **Light.** The reference key + hemi (Lambert, real shadows; `sunAz` / `sunEl` from the look, default the old map aim:
  from the west-south-west, ~32° up). Then the **shadow-tint** term (cast shadows full, slopes turned away 55 %) at the
  same value, and a **painted two-tone light** (0.58): lit planes warm, turned planes toward the tint, a brushed
  terminator, read relative to level ground (a relief map's hillshade, so a 15° slope reads).
- **Pencil contour lines** are invisible tents in `ctx.lineOnly`, one per contour polyline (marching squares on the
  TRUE heights, every `contourSpacing` m, chained exactly by grid edge, Douglas-Peucker 6 cm, a slow wobble of a few
  cm). Each tent is a ridge 0.09 m + 0.4 w above the ground along its normal whose two faces meet at 2θ: the edge pass
  draws a line where 1 - cos 2θ passes its threshold, so θ sets the darkness (`contourOpacity` 0..1 → θ 32.4°..36.2°,
  index lines +1°). Never on our plot, under the woods (a line would cross the crowns: masked by the trees' cells),
  on cliffs (> ~52°, they'd bunch) or under water.
- **Sea.** The reference sea shader (copied), coloured by the landform's TRUE depth (`ground.depthTexture`): a pale teal
  shelf (sand under a metre of water: beaches, shoals off the beach and the estuary), the bay's teal, ultramarine in
  the deep (`waterShallow` → `waterDeep`); crinkled paper facets a little calmer than before; open sea past the map's
  edge. It discards over land with the edge on the waterline.
- **The lake** keeps the reference pool. The woods are hidden while its mirror renders, since from above it only shows the sky.
- **Trees.** The woods follow the landform's woods weight (mid slopes, the ravines the erosion carved, galleries
  along the river), ~1 500 instances. They are 7 low-poly variants in the trees.js grammar: a round lump core, a top lump, side lumps, a dark underside and a trunk, baked with `kit.bake`. About 2 700 instances in 7 draw calls. They are colour-only and kept out of the folk pass (`folkHidden`, which made that pass 3× cheaper). Every InstancedMesh carries an `instanceColor`: r128 shares one override program per material between instanced meshes with and without one, and the kit's leaves always have one. The plot trees are trees.js's own olive, oak, lemon and pine (`api.tree`, `api.pine`), merged per kind, instanced, with instanced pencil proxies.
- **Old tracks.** Four tracks walk from the plot's edges toward the Riviera (fording the river), the Loaf Republic, the south hills and the east. They choose the gentlest 4 m step toward their goal. They are drawn in the ground shader: umber on the paper, sand where painted.
- **Glows** are alpha sprites (an additive glow turns white on the cream), colour-only and folk-hidden. They fade below about 1.5× their `near` distance.

## Lab and checks
`web/world-lab.html` runs the real paint engine with `createGame({seed:7})`, `createWorld`, and 12 folk through `makeNav`, stood on the relief.
- **Buttons:** Descent, Leader / Eye / Top view, Build a town, Full bloom, Descent from the globe, Bloom somewhere, Place a building, Up close, Back, the three nations, Home, Without / With trees + greens (§21 compare).
- **Query:** `?view=leader|eye|top`, `?bloom=0|1|full`, `?intro=sky|globe`, `?left=none` (the game's input), `?shot=1`, `?seed=`, `?dress=0` (the old map without the §21 trees + green spots), `?autobloom=0` (the game's §9 rule). `#gouache` / `#raw` pick the edition.
- **`window.__lab`:** `step(sec, dt)`, `navCheck`, `place`, `town`, `full`, `ACT`, `world`, `game`, `folk`, `painter`.

```
~/.nvm/versions/node/v22.22.3/bin/node tests/world/shoot.mjs [cases…]   # -> shots/world/<case>.png
  default (leader, start) town bloommid full fullwide descent0 descent descent2 descentend globe close20 close20start
  close20raw eye top wide horizon horizon2 horizon3 visit close raw pick nav perf chrome custom
  env: QUERY='&view=eye', POSE='{"dist":40}', PRE / RUN (js), TAG=prefix-, VIEWPORT=390x844
~/.nvm/versions/node/v22.22.3/bin/node tests/world/input.mjs   # real pointer / wheel / key events against the rig
OUT=shots/terrain TAG=final- node tests/world/shoot.mjs default full fullwide close20 descent top eye visit horizon2
node tests/world/landform-preview.mjs [tag] [half] [px] [cx] [cz]   # the landform alone, hillshaded, no browser (~3 s)
node --test tests/globe/landform.test.mjs                           # the composition + "no slab" checks
```
Terrain pass (2026-10-04): `shots/terrain/final-*.png` (leader start / full bloom / wide / close town / descent / top /
eye / the island / the hill town), `shots/terrain/landform-*.png` (hillshaded previews), `shots/terrain/look-custom.png`
(every look key changed live). input.mjs 14/14; pads exact; nav ok (it varies run to run with the lab's async town);
`renderPainted` ~4 ms; world-lab build ~2.5 s (the landform's 2 m erosion grid ~0.6 s, shared with the globe).

Results on this Mac (2026-10-04, headless Chrome, Metal, 1440×900):
- **input.mjs**: 14/14.
  - left drag ignored; right and middle drag pan; Alt + right turns and tilts;
  - the wheel zooms 12–250 m and eases the pitch; Q turns; W moves; the target is clamped at 150 m;
  - the descent can't be interrupted and lands on the leader view;
  - `pick` vs the visible surface over 120 screen points: worst 0.013 m.
- **pick / pads**: for 7 buildings, all four footprint corners equal the pad height exactly (`PADS` in the `pick` case).
- **nav**: `{ ok:true, walkers:10, samples:36000, off:0, wet:0, inside:12, arrivals:24, minMoved:33, obstacles:25 }` (8 buildings plus their trees).
- **perf**: `renderPainted` about 11 ms GPU-finished (it was 4.6 ms on the flat world). The woods and the 268 k-triangle relief cost the difference. The headless rAF rate isn't a usable number on this shared machine.
- No page errors in any case.

## Gaps
- (§21) `tests/world/input.mjs` "pick lands on the visible surface" fails its 0.02 m bar by a hair (worst 0.024–0.035 m,
  at the far hill town). Identical with `?dress=0`, so it predates the dressing.
- (§21) At the leader distance a few new buildings read faint (cream walls on the cream plain) until bloom / their
  own colour; closer (≤ 90 m) they read well (`dress-buildings-custom.png`).
- (§21) The dressing's trees are static: a mark claiming a forest or a field outside the plot doesn't thin them.
- `coastLine` doesn't thin the map's coast: that line is the land proxy's depth edge (always full). Making it a weight
  needs a sea-level proxy plane in the keyline world plus a coast tent (hidden at eye level so it never draws a horizon).
- The reference's "lost edges" (post.js, verbatim) still lift every keyline here and there, contours and coast included.
- More than 48 blooms or 24 paths: the oldest drop out of the shader. A big town wants the settled blooms baked into a mask texture. The same goes for marks' area fills: fields clipped to an outline are not drawn by the world yet.
- The woods are static: they don't thin when a mark claims a forest, and they don't react to the sim.
- The river is the layout's straight valley with a map-side meander. The globe draws the straight one.
- Portrait screens widen the fov (the reference's rule) but keep the same target.
- The default view can't show all three nations at once. Both headlands sit at the top corners and the island at the top edge. Zoom out to about 210 m (`wide`) or use `showNeighbour`.
