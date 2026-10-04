# The painted globe (`web/js/globe/`)

Earth and the Moon as two small painted planets: **the shape** from Tower Planet (`mapFlat` + the orbit ⇄ surface
camera), **the look** from the Red arch. Everything renders through the verbatim paint engine
(`web/js/paint/`, which is used and never edited): `createContext` / `createKit` / `createPainter`, the
Gouache / Riso / Raw editions, held frames, warped Kuwahara, and pencil keylines from smooth proxies. The
**terrain is our map's** (`geography.js`), not Tower Planet's.

Lab: `web/globe-lab.html` has a button for every API call, the editions pill, and sliders for town growth,
world colour and nations. Stills: `?view=orbit|home|nation0|nation1|nation2|wonder|moon|moonorbit|growth|growthorbit|far&edition=gouache|riso|raw`
(extras: `&el=&az=&dist=` for orbit, `&growth=0..1`, `&bloom=0..1`, `&ui=1` to keep the chrome).

## Files
| file | what |
|---|---|
| `geography.js` | **the single flat world layout** shared by the globe and the gouache map. Pure data + pure functions, no THREE, no rnd stream (hashed noise only). |
| `landform.js` | **the designed landform** (2026-10-04, ART_DIRECTION §8): the coast, ridges, river gorge, islands, stacks, shoals, the range, the erosion pass; one height for map and globe (`geography.LANDFORM`). Pure, hashed noise only. |
| `globe.js` | `createGlobe()`: scene, bodies, towns, wonder, forests, glows, Moon, lights, camera rig, input, loop. |
| `terrain.js` | `buildBody()`: one mesh per planet on a non-uniform flat grid wrapped by `mapFlat`. Painted vertex colours (two sets) and the Lambert + Red arch sea material. |
| `towns.js` | the Red arch architectural grammar (blocks with parapets, round arches cut like the reference wall, barrel vaults, domes, belvederes, limestone terraces, lemon / cypress / umbrella pine), the three nations, and the home village pieces. |
| `space.js` | painted dusk space (the reference sky's own colour stops, laid out by angle above the nearest limb), the reference sun disc, and riso-dot stars. |

## geography.js: the shared layout (for the map module too)
Flat design space = **map coordinates**: x east, z south (the sea / north is −z), y up, 1 unit ≈ 1 m. **k = 1**:
a point (x, z) on the map is the same (x, z) on the globe. The globe wraps it with `flatToSphere` (Tower
Planet's `mapFlat`, azimuthal-equidistant around `GEO.C = {x:0, z:2}`, the plot centre on the +Y pole,
`GEO.RP = 170`).

- **Home plot** = sim `state.plot {x0:-30,x1:30,z0:-26,z1:30}`, level at y = 0. The lake is the sim's
  (`homeLake(seed)` reproduces `createGame`'s pick + `blobPoly`; `setWater(game.state.water)` adopts the live one).
- **Sea** starts at the sim's own sea line past the plot's far edge (`SIM_SEA_LINE`) and opens north into a bay.
  The sun sets over it.
- **Nations** sit at the sim neighbour positions, each on its own site: `n1` (−95,−40) the Drop Riviera on the
  long west **headland**; `n2` (100,−55) the Loaf Republic, a **hill town** on a coastal hill above the east coast;
  `n3` (0,−130) the Flit Sky-hold on the **island** across the bay.
- Exports: `heightAt(x,z)` (0 on the plot, < 0 = water depth), `isWater`, `waterKind` (`'sea'|'lake'|'river'|null`),
  `landKind` (`'cream'` in the plot, `'meadow'|'sand'|'pine'|'rock'`; `'sea'|'lake'|'river'` on water),
  `landWeights` (soft weights), `landField` (signed coast field), `places` (home, nations, wonder, each with a
  `view` = the dive's final camera as offsets), `placeById`, `homeSpots`, `flatToSphere` / `sphereToFlat` /
  `frameAt`, `GEO`, `PLOT`, `RIVER`, `MOON` (the Moon's own layout: meadow, lake, spires, lounge, craters,
  `heightAt`, `landKind`, `flatToSphere`).
- **The landform (2026-10-04, `landform.js`; replaces the v2 mirror of ground.js and the old ellipse continent).**
  `LANDFORM = createLandform({ PLOT, C, nations, wonder, lakeDist })`; `reliefAt(x, z)` = THE ground height of the
  map and the globe (true sea level 0, water < 0; our lake a smooth bowl to the sim's polygon), `heightAt` keeps the
  v1 contract (0 on the plot) and is the landform elsewhere. The composition:
  - **coast**: the mainland's north coast is a designed polyline (`COAST`, Chaikin-smoothed, grid-accelerated
    distance, sign by ray parity), following the sim's sea line as a crescent **beach** in front of the plot; west of it
    the river's **estuary**; east of it the wonder's small **cove** (the Red arch's bluff looks out over it), the rocky
    **east point** with three **stacks**, the **east cove**, then the hill town's cliffs and the long east coast. The
    west **headland** is a tapered arm (`HEADLAND`) with a waist and a swell for the town; `ISLAND` (the Sky-hold, with
    a harbour cove facing home) and `ISLAND2`; `STACKS` (irregular, squat, flat-topped), `ISLETS`, `SHOALS` (pale
    sandbars under the water off the beach and the estuary). The mainland's far coast runs round the planet's limb
    (`farBound`, ~285..345 from home) and other continents lie on the far side, so from orbit there is **no ring of sea
    round a plateau**. The coast wanders by noise except along the plot.
  - **land meets water without walls**: beaches rise ~0.7 m over 10 m; at a rocky coast (`cliffAt` 0..1, designed by
    spots: the headland, the island's north, the east point, the hill town) the land is at most a **low cliff** (~2.5 m
    on a beach coast, ~7 m on a rocky one) over ~3.6 m, with anything higher stepping back inland over ~18 m as a steep
    slope; a wave-cut rock platform at a cliff's foot; then a shallow **shelf** (~1.5 m deep, 6..18 m wide) before the
    bay deepens (~6, ~15, ~27 m out in the deep). Site platforms never reach out over a cliff.
  - **ridgelines**: designed spines (west ridge along the floodplain, the headland's crest, the east ridge from the hill
    town south, a spur to the wonder's bluff, the back hills, the island's crest) and the **limestone range** (`RANGE`,
    44..68 m) are envelopes whose shape comes from a **domain-warped ridged multifractal** (spurs off every crest,
    valleys between, saddles and summits along it); the uplands roll everywhere off our valley, the floodplain and the
    shore; heights unite with a continuous p-norm union (no creases where a term switches off).
  - **the river**: out of the range through a narrow **gorge** (z ~86..114: valley floor 3.4 m wide, walls over ~7 m),
    then meandering over a **floodplain** (floor flattened 19 m either side, valley walls over 28 m) at the foot of the
    west ridge to the estuary. Its channel is water (< 0) all the way; `riverDist` / `riverWidth` read the smoothed line
    with a soft along-line parameter (continuous across the meanders' medial axes).
  - **erosion**: a 2 m grid over ±290 m (85 k cells, built lazily on the first height query, ~0.6 s): 90 k droplets
    (hydraulic: gullies on slopes only, capped fans) + 10 thermal passes (talus under steep faces), stored as a blurred
    **delta** over the analytic height (Catmull-Rom sampled), never on our plot, the sites or the shore.
  - **our valley**: a plain rising gently inland (0.8 → 3.5 m), a low hill and a knoll at the back, swells, a shallow dry
    valley, a knoll over the beach (the director's "cliff"), a level bank round the lake.
  - **cover** (`landWeights` / `landWeightsSoft` / `landKind`): sand on beaches and river bars (not under cliffs),
    limestone on steep faces, cliff faces and the range's tops (snow-free), woods on the mid slopes, down the ravines the
    erosion carved and along the river, meadow elsewhere; `cream` = our plot / `homeWeight`.
  - Kept for old callers: `RIVER` (the control points), `plotRelief`, `detailRelief` (0), `riverMeanderX` (identity),
    `homeWeight` / `homeSD`, `lakeSD`, `CAMP`, `GLOWS`, `MOON` (unchanged).
- `tests/globe/geography.test.mjs` (`node --test`) checks the lake against the sim, that the plot is level, that
  the sea starts past the far edge, that the nations sit at the sim neighbour positions, and the wrap round-trip;
  `tests/globe/landform.test.mjs` checks the composition (headland / hill town / island, the river is water, the range
  rises > 45 m) and **no slab** (the steepest shore step over 2 m < 12 m; a shallow shelf in front of the beach).
  `tests/world/landform-preview.mjs` renders the landform hillshaded without a browser (`shots/terrain/landform-*.png`).

**Globe-only terrain adaptations** (x and z are identical to the map's; the globe samples `reliefAt`, the map v2's
relief; `diveView()` returns **map** heights):
- heights × **VS** (2026-10-04, a believable small planet): 1 over our land (so the dive's end shows the map's own
  relief), falling (squared smoothstep over 6..90 m from the plot) to **0.2** for the far relief: the range is a low
  painted crest on the limb (~13 units on a 170 radius), not spikes. Water depths are unchanged. The **shading** uses
  the relief as if it were ~0.85 of the map's (`buildBody({ normalBoost })`: normals and the painted value only), so
  from orbit it still reads as a shaded relief map. The globe mesh is denser away from home (slope 0.022).
- **Unbending round home** (`FLAT_K = 0.6`): the map is flat, the planet is not. At the top-down dive end the
  curvature pulled points 40 m out ~30 px toward the centre, so the cross-fade ghosted the coast and the river. The
  Earth's wrap lifts the ground by 0.6 d^2/2R (fading out 55 -> 160 m from the plot's centre), which halves that
  (measured: river 30 -> 11 px, the corner at (-40,-20) 35 -> 19 px, the coast 29 -> 20 px; the lake 6 px). Every
  placement goes through the wrap. Normals and the shader's "level up" come from the lifted surface's own tangents
  with the lift's weight frozen per point (`levelWrap`), so level ground stays level for the light and the trees.
- **Our lake** is `reliefAt`'s bowl: a signed distance to the sim's polygon, so the painted water edge follows it.
- **The wonder's bluff**: the ground under the scaled terrace sits 0.25 below the terrace top (a coplanar ground
  z-fought through the pool as a diagonal sand seam), the relief round it stays below terrace level, and beyond
  the terrace's far edge (where the arch looks) the bluff drops into a small cove of the bay, so the arch frames a
  sea horizon as in the reference. The cove never reaches into our plot.

## API (`web/js/globe/globe.js`)
```js
import { createGlobe } from './js/globe/globe.js';
const globe = createGlobe({
  renderer,            // optional: share the game's WebGLRenderer (else one is made like the reference's, or on `canvas`)
  canvas,              // optional
  onReady: g => {},    // called next tick
  edition: 1,          // 0 Riso, 1 Gouache (the game: Gouache only), 2 Raw
  autoSpin: true,      // a slow idle spin in orbit after 3.5 s without input
  water: game.state.water, seed: 11, width, height
});
globe.start(); globe.stop(); globe.resize(w?, h?);
globe.painter                     // the Red arch painter (painter.setMode(0|1|2), painter.G, ...)
// every move resolves true when it arrived, false when a newer move or a cut (snapTo / snapToFlat) superseded it.
// Moves are chains of tweens with a generation counter: an interrupted chain stops dead and never commits state
// (body / mode / lastPlace), so the newest call always owns the camera (typed or voice commands mid-voyage).
// The new move inherits the camera's velocity (eye + look, decaying over ~0.35 s): position AND velocity are
// continuous at the hand-off (no stall, no kink); cuts reset it.
await globe.orbit({ az, el, dist, ms })     // eased move to an Earth orbit pose (az/el in the north-up bay frame;
                                            // from the Moon it flies back first and still lands on the asked pose)
await globe.dive(placeId, { ms })           // 'home' | 'n1' | 'n2' | 'n3' | 'wonder' | 'moon'; one swoop arc
                                            // (from the ground it pulls up, swings over and comes down)
await globe.rise({ ms })                    // back to the default orbit (on the Moon: the Moon's orbit)
await globe.flyToMoon({ ms })               // rise -> bezier flight away from the Earth -> dive to the meadow
await globe.flyToEarth({ ms })              // the reverse, to the default Earth orbit
globe.snapTo()  / snapTo({az, el, dist}) / snapTo(placeId)   // cuts, no animation
globe.snapToFlat({ eye:{x,y,z}, look:{x,y,z}, fov }, 'earth') // cut to a camera given in MAP coordinates
globe.diveView(placeId)          // -> { eye:{x,y,z}, look:{x,y,z}, fov, sun, body } in MAP coordinates
globe.places                     // { home:{id,name}, nations:[{id,name,simName,species}x3], wonder:{id,name}, moon:{id,name} }
globe.setHomeGrowth(0..1)        // village pieces appear in the cream patch (scale-in); colour blooms from cream
                                 // round each one, warms the plot, then spreads over the ivory land round it
globe.setHomeBuildings([{x,z,rot}])  // optional: stand the village pieces at the sim's real building positions
globe.setNationGrowth('n1', 0..1)    // that town's buildings appear by threshold (default 0.75)
globe.setWorldBloom(0..1)        // 0 = the ivory relief map of the start state (ART_DIRECTION mb 1), 1 = painted land
globe.setAutoSpin(on); globe.setInput(on);
globe.mode / body / busy / lastPlace   // lastPlace = the place you're down at, null in orbit
globe.toWorld(x,y,z,'earth'|'moon'); globe.toFlat(vec3, body)
globe.tick(dt) / render()        // if the game drives the loop itself instead of start(). render() is safe on its
                                 // own (repeat paints, cross-fades): per-view visibility lives on parent groups /
                                 // shader uniforms, never on ctx.colourOnly members (the painter forces those visible)
globe.stats()                    // camera clearance above both grounds (tests)
```
Drag spins and the wheel zooms, **only in orbit and never during a scripted move** (`interact.mjs` checks both).
Every move is a single eased tween (in-out cubic on the direction slerp, smootherstep bezier on the radius,
with a lift proportional to the arc). A guard keeps the eye ≥ ground + 1.2 on both bodies every frame.
Near / far follow the altitude, and the painter's edge-pass uniforms are kept in sync.

## The look: how the Red arch grammar was applied
- **Our land** (2026-10-04): no cream square and no pencil border. It is the same ivory paper as the land round it
  (a hair lighter), shaded by its own gentle rolling relief, and fades out by `homeWeight` (rounded, ragged). A warm
  **ground glow** pools on our camp (body shader, `GLOWS`; it grows with the town), the nations get the same pools
  plus their halo sprites. The lake keeps the sim's polygon.
- **Two painted colour sets per vertex**, both from `kit.bake`'s formula (`0.5 n·L + 0.3 n.y + 0.4 + speck`,
  against the fixed light `L`, **in flat space**, so every place is painted the way the flat map paints it). The
  start state is the **ivory relief** of ART_DIRECTION mb 1: warm paper lit slopes, violet shadow sides, and
  muted forest masses. The **painted** set uses meadow (green lowlands → straw hills), sand, pine and rock ramps,
  plus each nation's own ground colours. The shader mixes them by `uBloom` + per-vertex `aBloom` (our town's
  spreading colour; the nations' and the wonder's land are always in colour). The plot stays flat cream until
  our own town colours it.
- **Lambert big forms** (`MeshLambertMaterial` + vertex colour, shadows). The **reference light colours and
  intensities**: hemi 0xb8cfd8 / 0xc89a6a 0.62, key 0xffe0bc 0.85. They are re-aimed every frame from the
  viewer's upper left (the reference's key side), so the lit face is always the one you look at. The shadow
  frustum fits the planet in orbit and the view near the ground.
- **The sea** is painted in the same mesh wherever the interpolated height is below 0. It uses the reference
  colours (shallows 0.36,0.72,0.78 → 0.17,0.47,0.66 → deeper), foam at the shore, the reference's sun-disc
  glint (`smoothstep(uCos…)` with its ripple normals) plus a warm sheen. A limb haze runs warm on the lit side
  and cool blue on the shadow side.
- **Space**: the reference sky's stops (peach → cream → teal → deep blue), measured from the nearest limb, so
  from the ground it IS the reference sky. The **red sun disc** always sits just above the limb, ahead-left
  (centred in the arch for the wonder view): sundown from everywhere. There are sparse cream riso dots, no
  black, no bloom, and no tone mapping.
- **Keylines**: the planet's silhouette and the cliffs come from the terrain itself. **Coasts** and the **plot's
  border** get invisible **tents** in `ctx.lineOnly`: per segment a low ridge, two faces sloping 40° either side of
  the line, one-sided, wound outward, flat normals. Against the ground the faces differ by ~40° (under the edge
  shader's normal threshold), against each other by ~80°, so exactly one continuous line draws along the ridge.
  The tent width follows the view (~3 internal pixels at the surface below the camera, rescaled in place when it
  changes > 12%), so it never goes sub-pixel (the old thin vertical ribbons aliased into dashes and dots from
  orbit). **2026-10-04**: the marching-squares segments are **chained into polylines** (they share end points
  exactly), rounded with two Chaikin passes, and each polyline's tent **shares its ridge vertices** (mitred), so the
  ridge, and the pencil line, is unbroken. Tents are ~4.5 internal pixels wide (sized against the painter's internal
  size, so they survive the reduced-size normal pass at DPR 2), float 0.4 w above the ground, and a waterline tent
  sits on the bank's lip (the highest ground within 0.6 m), so steep river banks no longer bury half of it (that
  broke the river's banks into dots). The plot's own border tent is gone (ART_DIRECTION mb 1).
  Coast tents show above altitude 14. The remaining gaps in long lines are the reference's own
  **"lost edges"** (`post.js`: `line *= smoothstep(0.18, 0.42, vnoise(q/45.0 + 17.0))`), by design and on every
  keyline including the arch.
  Towns get pencil lines up close and paint without them from afar: **every child of a town is its own LOD unit
  with a hashed switch altitude** (140 × 0.55..1.6, i.e. 77..224 up), so a town gains its lines piece by piece over
  the whole lower half of a dive. The fine openings and the kit's keyline proxies are not switched: they **grow in**
  (scale 0 -> 1, quantised to 1/16) over the band just above each unit's switch altitude. (Older note:) From
  afar the ink-dark openings (`towns.js` tags them `userData.fine`) and the kit's keyline proxies (tree crowns,
  shrubs) are scaled to nothing too.
- **Orbit paint** (2026-10-04): decisive saturated shapes, not pastel mush.
  - **Brush**: the reference's own Brush size control (`painter.G.brush`, through the painter API; post.js untouched)
    is turned down with altitude, x 0.34 above ~240 up -> x 1 below ~70, i.e. a Kuwahara radius of 2 internal pixels
    in orbit (was 4-6). The user's Gouache-settings value stays the base.
  - **Painted light** (`uPaintLight`, 0.75 in orbit -> 0.3 near the ground): a two-tone value structure over the
    Lambert, warm lit planes against cobalt / violet shadow planes, a brushed terminator, plus a **hillshade** term
    (the slope against the light relative to level ground) so even gentle relief reads. Near the ground the
    **map's own cobalt shade** (world/ground.js's terms and constants) is applied to the Lambert, so the dive's end
    is shaded as the map it fades into; there the key light also turns into the **map's sun** (bearing of the
    reference key, 0.5 rad up) for any view looking well down (> ~35-63 deg); eye-level and oblique views keep the
    viewer's own upper-left key.
  - **Sea**: teal shallows -> ultramarine deep (mb 5). **Limb haze** 0.04 -> 0.18 (was 0.08 -> 0.44); the space
    shader's peach ring is a third as wide and the deep space a more saturated dusk blue.
  - **Nations**: deeper, more saturated ground ramps under the towns, warm orange halo sprites (58 units), and the
    ground glow pools, so from orbit they read as little coloured towns with lights.
  - **Forests** in the start state are muted olive-sepia masses (mb 1) until `setWorldBloom` colours them.
- **Towns** (`towns.js`): Riviera = coral `#ff8f78` + terracotta `#c23a2c` stacked on coral-tinted limestone
  terraces, with a campanile, an arcade, a dome, lemons, cypresses and umbrella pines. Loaf Republic =
  sea-glass `#4cc7b8` barrel vaults and domes on white limestone, with an arcade and a bell tower. Flit
  Sky-hold = pistachio `#a8dc6e` / lemon towers with round-arched belvederes and arched bridges on the
  island's rock. **The wonder is the Red arch itself**, built by the verbatim `buildRedArch(ctx, kit)`,
  re-parented, scaled 0.2 and turned to look down the bay. Its mirror pool is swapped for still painted water
  (the Reflector would re-render the planet every paint), and its wall (the reference's 120 × 42, built for a
  camera that never leaves the terrace) is rebuilt with the same arch, trimmed to 52 × 28: still wider and taller
  than the reference framing sees up to ~2.5:1, and no longer a long red slash from orbit. Diving to `'wonder'`
  reproduces the reference framing in miniature: the pool, the pines, the sun centred in the arch over a sea
  horizon.
- **Forests**: miniature umbrella pines (a leaning trunk under 2–3 flat pads, dark underside + sunlit top,
  baked) and cypress spindles, instanced over the pine land, under one `forest` group. They **grow in** as the
  camera comes down through ~210 → 100 altitude: each instance has a hashed threshold (`aT`) against a `uReveal`
  uniform and scales up out of the ground over its own slice (same scaling in the shadow pass via
  `customDepthMaterial`), so the forest sprinkles in over a dive instead of switching on in one frame. The reveal
  runs over a long log-spaced band (FOREST_ALT x 0.62 .. x 2.4, ~100 .. 385 up), i.e. the whole second half of a dive.
- **Glows** (ART_DIRECTION "warm glows mark settlements"): soft warm apricot halo sprites over the nations and
  our camp (growing with the town), normal alpha blending (additive went hot white over the cream plot). Each
  hangs in its own holder group (visibility lives there). They fade near the ground and on the far side.
- **The Moon landing** (2026-10-04, the hand-off to the shadelings' Alpine lounge): `flyToMoon` ends on
  **lounge.html's opening view in miniature**: 3 m up, 8 m in front of the lounge, looking north over it (fov 52,
  as lounge.html): the oxblood rug and the white tulip table centred, the olive sofa facing the viewer with an
  armchair angled in either side, dark-wood side tables with books, the pleated paper lamp whose shade glows (unlit
  paint) and pools warm light on the grass (glow slot 4); behind them **a tiny lake as a band** (deep teal, a pale
  lilac sky reflection, a pencil rim), the shrub cones on a gentle rise, the cream limestone spires with lilac
  shadow sides on the skyline, and above them the lounge's own **night-blue sky** over a pale lilac-cream horizon
  (the space shader's `uMoonSky`; no sun disc there), so the landing cross-fades into the lounge. The meadow is the
  lounge's lawn (sage, `ramps.sage`); its edge into the lilac regolith is thresholded **per pixel against
  world-space noise** (`uMoon`), so it is brushy and never follows the grid. Round the landing the meadow is a
  **stage** (`MOON.stageAt`: it rises with distance to cancel 70 % of the curvature, so the lake and the cones sit
  up in view as on lounge.html's flat meadow); the lake's water is its own mesh following the stage (a
  level-on-sphere lake tilted away from the viewer and vanished edge-on). Cypresses and flowering shrubs flank the
  set. From orbit it reads as a little green garden ringed by spires, with the lake and the red rug.
- **The Moon** (radius 54) (older notes; the layout above supersedes its positions): cool lilac regolith with soft craters, and the Alpine lounge's world in miniature:
  an olive meadow that frays into the regolith over a brushy noisy band (soft `MOON.landWeights`, a dry dust tint
  in the band; no per-vertex switch, no grid staircase), a lake whose shore is a signed distance, faceted leaning
  limestone spires (7 sides, lilac shadow sides, smooth proxies), **shrub-covered cones** (a dark core under
  hundreds of baked kit leaf clumps + a proxy cone), the kit's own cypresses and flowering shrubs, and the lounge:
  oxblood rug, olive sofa and two armchairs, a white tulip table, a pleated paper floor lamp. Everything is built
  at a local origin in the kit grammar and stood on the Moon (`MOON.spires / cones / cypresses / bushes / lounge`
  in geography.js). The landing view is a composed tableau: lounge centre, lake right, cones and spires on the
  skyline, the sun low on the left. The Moon sits up and to the right of the Earth in the default orbit.

## Look (the LOOK CONTRACT, shared with the map and the gouache lab)
`globe.getLook()` / `globe.setLook(partial)`: plain JSON, applied live (unknown keys ignored).
- `sunAz` / `sunEl` (306 / 38): the globe's key follows the VIEW (the reference's key from the viewer's upper left), so
  here they are screen-relative: the bearing on the view (0 = from the top of the screen, 90 right, 180 bottom, 270
  left) and the height toward the viewer, in degrees. (Near the ground the dive still turns the key into the map's sun.)
- `keyIntensity`, `keyColor`, `hemiIntensity`, `hemiSky`, `hemiGround`: the globe's own reference lights.
- `shadowTint` (`#2f3d92`), `shadowStrength` (0.62): the body shader's cobalt shade and the painted light's shadow hue.
- `creamColor` (`#f6e6c0`): the ivory ramp of the start state; `bloomPalette` ([deep green, meadow green, light green,
  ochre, straw, woods], the map's order): the painted meadow / straw / woods ramps. Both repaint the planet's vertex
  colours from cached cover weights (~0.1 s, debounced).
- `waterShallow` (`#55b8bf`), `waterDeep` (`#174694`): the shelf → the deep; `haze` (1): multiplies the limb haze.
- `coastLine` (1): the coast tents' angle (29° + 11° × weight; 0 removes them).
- `brush` (null): replaces the user's base brush (still scaled down with altitude).
- `camPitch` (orbit `el`, -0.08 rad), `camDist` (orbit distance), `camFov` (40): the default orbit.
- `reliefScale` is stored but map-only for now (the planet's mesh is built once).

## Hand-off notes for game.js
- **Opening (`?intro=globe`)**: `globe.snapTo()` (title over the orbit; idle spin on), then `await globe.dive('home')`.
  The dive ends **(nearly) top-down**, ~100 up: map coords eye (0,100,16) → look (0,0,−4), fov 46, pitch ~80°, the
  plot whole with the bay above it and **no horizon / limb in frame** (ART_DIRECTION: "the descent is top-down").
  Cross-fade there to the gouache map: `world.descent({ from: 'globe' })` starts from the same numbers
  (`geography.places.home.view`) and eases into the leader view. Then `globe.stop()`.
- **"Show me the neighbours"**: `globe.start(); globe.snapToFlat(mapCamera)` under a quick cross-fade, then
  `await globe.dive('n2')` (one arc: up, over, down). `globe.rise()` brings it back to orbit.
- **Voyage**: `await globe.flyToMoon()`, then hand to `web/worlds/lounge.html` via `lounge-driver.js`.
  `globe.flyToEarth()` comes back.
- Drive the town: `setHomeGrowth(prosperity-ish 0..1)` or `setHomeBuildings(state.buildings)`;
  `setNationGrowth(id, n.prosperity/100)`; `setWorldBloom()` as the world wakes up.
- **Gouache only in the game** (`edition: 1`). The editions pill lives in the lab only.
- One painter per globe: sharing the game's renderer is fine (`createGlobe({ renderer })`), but don't render the
  map and the globe in the same frame except during a cross-fade.

## Verification (all re-runnable)
```
~/.nvm/versions/node/v22.22.3/bin/node --test tests/globe/geography.test.mjs   # 3/3 pass
~/.nvm/versions/node/v22.22.3/bin/node tests/globe/shots.mjs                    # stills -> shots/globe/*.png (+ results.json)
~/.nvm/versions/node/v22.22.3/bin/node tests/globe/moves.mjs                    # dive/neighbour/rise/wonder/moon/back: contact sheets + min clearance
~/.nvm/versions/node/v22.22.3/bin/node tests/globe/interact.mjs                 # drag spins, wheel zooms, drag ignored mid-dive, paint cost
~/.nvm/versions/node/v22.22.3/bin/node tests/globe/refcost.mjs                  # the Red arch's own paint cost, for comparison
~/.nvm/versions/node/v22.22.3/bin/node tests/globe/verify.mjs                   # interrupts, render() hazard, stepped sheets -> shots/globe-fix/
```
`tests/globe/verify.mjs` (after the 2026-10-03 review; 2026-10-04 adds flyToMoon -> flyToEarth mid-flight, rapid
fire dive n1 / dive n2 / flyToMoon, rise during the Moon descent, orbit mid-dive, and a **continuity** check that the
eye's step in the interrupt frame matches the steps around it, all PASS): interrupted moves (the newest move wins, the old chain
resolves false and never resumes), `render()` after a painted tick paints the identical picture (orbit / home / n2,
mean diff 0), stepped dives with contact sheets (`shots/globe-fix/sheet-*.png`), and the stills the review
flagged. On the first runs, all stills had no page errors, and every move ended in the right mode/body with min
clearance ≥ 1.5 (Earth) and 15 (Moon). Paint cost in headless Chrome (Metal) at 1440×900: Gouache ~30–45 ms,
Riso ~40–68 ms, Raw ~8–18 ms, against the Red arch reference's own ~45 ms. Build ~0.4–0.6 s. The globe
skips the empty folk pass (`renderWorld` + `composite`).

More (2026-10-04):
```
~/.nvm/versions/node/v22.22.3/bin/node tests/globe/look.mjs <outdir> '[[name, setupJs, moveJs|null, frames, ms], ...]'
    # stepped stills / contact sheets from the lab (g = the globe); a name starting with '?' prints eval(setupJs)
~/.nvm/versions/node/v22.22.3/bin/node tests/globe/lab-interrupt.mjs   # the lab's interrupt buttons in REAL time on :8870
```
The lab (`web/globe-lab.html`) has two interrupt buttons: "Interrupt: Moon -> home" (flyToMoon, 1.5 s later dive
home) and "Rapid fire" (dive n1, dive n2, flyToMoon 0.35 s apart); the status line shows each promise's result.
Before / after stills: `shots/globe/before/`, `shots/globe/after/`.

## Known gaps
- Globe build is ~2.3 s in the lab (was ~0.5 s): the landform's erosion grid (~0.6 s, shared with the map in the game:
  one geography module) and ~170 k vertices of landform + cover weights. `reliefScale` doesn't re-wrap the planet.
- At the top-down dive end the residual curvature (after the unbend) still offsets points 40 m out by ~10-20 px
  against the flat map (the centre matches within ~6 px). A full unbend (FLAT_K 1) would remove it but shows from
  orbit as a plateau round home.
- `reliefAt` mirrors world/ground.js's relief by copy until ground.js imports `plotRelief` / `detailRelief` /
  `riverMeanderX` from geography; if the map's relief changes, re-sync the MIRROR block.
- The map's trees are green in its start state; the globe's are muted olive until `setWorldBloom` (mb 1). At the
  dive end the cross-fade therefore also colours the trees.
- Long keylines keep the reference's deliberate "lost edges" (see Keylines). Making them unbroken would mean
  editing the verbatim post stack.
- Sky glows / limb ring are tuned for 16:10. Portrait works, but it's less composed.
- From orbit the nation towns are small coloured smudges plus a glow. That reads, but not as architecture.
- The sim names neighbour `n3` "Grey Harbour (puffer)", while the story arc calls it the Flit Sky-hold. The globe
  shows the arc's names and keeps `simName`.
