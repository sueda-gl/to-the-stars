# AGORA Build API (for generated code)

You write **one function**, `function build(api) { ... return g; }`, that builds a thing out of painted parts. It runs in the browser as `new Function('api', "'use strict';" + code + "\nreturn build(api);")`. The only thing in scope is `api`. The result is drawn by a gouache painting engine (Sueda's "Red arch at sundown"): flat brush patches, pencil keylines, warm dusk light from the upper left.

## Rules
- Plain ES5-style JavaScript: `var`, `for` loops (at most ~40 iterations each), `Math`. No `this`, `window`, `document`, `fetch`, `import`, `eval`, `Function`, timers, `while(true)`/`for(;;)`, no `THREE` global.
- Start with `var g = api.group();`, add parts with `g.add(part)`, and `return g;`. Sub-groups are fine (`var arm = api.group({ x: 1 }); arm.add(...); g.add(arm);`), and so are `part.position.set(x, y, z)` and `part.rotation.y = a`.
- Deterministic: use `api.rand()` / `api.range(a, b)` / `api.pick(list)` for variation, never `Math.random`.
- **Space**: y is up, the ground is y = 0, the footprint is centred on the origin, the front faces **+z**. 1 unit = 1 m. A folk is about 1.3 m tall, a door 1.5-1.8 m, a house 3-5 m, a tower 8-12 m.
- After `build` returns, the object is grounded (its lowest point moves to y = 0) and recentred on x/z automatically. Anything bigger than 60 m is scaled down to 60 m; anything under 0.8 m is scaled up.
- **Things that float** (a boat, a duck, a buoy): call `api.floats(g, { line })` on the group you return. Then it is NOT grounded: the build's height `line` (default 0) becomes the water line, and everything below it sits in the water (the draft). Without `floats` a hull is lifted to sit on top of the water.
- **Size for the leader's view**: the game camera looks down from about 80 m. A prop smaller than ~2 m is a speck; a landmark needs a footprint of 4-8 m and a clear top shape; "giant" things (a giant duck, a colossus) are 8-25 m. Give the size you mean: nothing is rescaled between 0.8 m and 60 m.
- **Budget**: at most 400 meshes and 120 000 triangles (aim for 8-40 parts). Segments are capped at 48 (16-28 is plenty).

## Style (the painter's grammar)
- **Few big shapes, crisp silhouettes, mid values.** A strong main mass, one or two secondary masses, a few accents. No fine detail, no text, no logos, no human figures (a statue is an animal or an abstract form on a plinth).
- Mediterranean palette: whitewash and limestone walls, terracotta roofs, red-wall (#c23a2c) accents, ochre, olive and pine greens, sea blues. One strong accent colour per object.
- Openings are **ink-dark recesses** (`api.inkDoor`, `api.inkWindow`), never holes or glass.
- The light is painted from the upper left: you never add lights, shadows, textures or materials of your own.
- It must read **from above** too (the camera is a high bird's-eye): give it a clear roof shape and footprint.

## Placement conventions (read carefully)
| what | (x, y, z) means |
|---|---|
| `box`, `cylinder`, `cone`, `sphere`, `torus` | the **centre** of the part (a 2 m tall box standing on the ground has `y: 1`) |
| `gableRoof`, `hipRoof`, `dome` | `y` = the **eaves** (the bottom of the roof = the top of the walls) |
| `inkDoor` | `y` = the **sill** (bottom); `z` = the wall face it sits on |
| `inkWindow`, `archOpening` | `y` = the **centre** of the window; `z` (or x) = the wall face |
| `archWall`, `column(s)`, `stairs`, `fence`, `flag`, `crate`, `barrel`, `pot`, `shrub`, trees | `y` = the **base** it stands on (default 0) |
| `wheel` | the hub centre |
| `lathe`, `extrude`, `tube` | where the profile's origin goes |

Every part takes optional `rot` (turn about the vertical axis, radians), `rx`, `rz` (tilts, radians) and `sx`, `sy`, `sz` (stretch). Openings face +z at `rot: 0`; `rot: Math.PI / 2` faces +x, `-Math.PI / 2` faces -x, `Math.PI` faces -z.

## Colour: every part takes ONE of
- `ramp: api.ramps.NAME` — painted light baked into the part (the default look; props, roofs, trim, anything small or medium).
- `ramp: '#hex'` or `color: '#hex'` — any colour; it is turned into a painted ramp around that colour.
- `mat: api.lambert('#hex')` — for **big walls**: real light and real shadows (the roof shades the wall). Use pale colours (`'#efe4d2'` whitewash, `'#e3d2b4'` limestone, `'#c23a2c'` red wall, `'#d9a441'` ochre).
- `mat: api.clay(base, shade, deep)` — the creatures' clay cel shader, three hard tones: for toys and smooth sculpted props (a rubber duck, a balloon, a giant fruit). Example `api.clay('#f6cf3a', '#e09a3c', '#b0623e')`. `api.clay('#hex')` derives shade and deep.

`api.ramps` (dark → light; a face toward the light takes the light end):
| name | stops |
|---|---|
| TERRACOTTA | #6c2a1c #93402a #b65231 #cd653a #de7b47 |
| LIMESTONE (= STONE) | #8c7860 #ae977a #cdb795 #e1cfae #eee0c4 |
| WHITEWASH (= CREAM, WHITE) | #a39686 #c7bba9 #e3d9c7 #efe7d7 #f8f1e3 |
| REDWALL (= BRICK) | #641c15 #8a281e #b3362a #c64434 #d6573e |
| OCHRE | #734d1a #9c6c20 #c4902d #dbab41 #e9c25a |
| WOOD | #432b1b #634028 #865c38 #a2764b #b98c5d |
| SLATE | #353c48 #4b5462 #646d7c #7f8897 #9aa1ad |
| SEA (= WATER) | #164357 #1d5d72 #287e92 #3f9aaa #62b3ba |
| OLIVE (= GREEN) | #2f3716 #4a5422 #6a7432 #8a9445 #a6ad5c |
| PINE | #202a0f #4a5a1c #7f8f30 #b7b452 #e2d978 |
| SAGE | #38452f #526449 #6f8762 #8ea67d #a8bd94 |
| YELLOW | #8a5414 #c08519 #e5ac22 #f2c42a #f8d84e |
| GOLD | #6e4512 #9c681a #c9952c #e2b444 #f0cc62 |
| BLUE | #1d2a52 #2a4178 #33528e #4a6fae #6f93c8 |
| LAVENDER | #3f3055 #5a477c #7a64a2 #9682bc #ae9fd0 |
| PINK | #5a1530 #a83863 #e0779a #f6b6c6 |
| RED | #4e1210 #a62c26 #e0603f #f4a07c |
| SAND | #7d684e #a08868 #c6ab84 #dcc49c #e9d6b2 |
| IRON (= METAL) | #1f1d24 #302c35 #45414b #5b5661 #746e78 |
| INK | #21182a #2e2236 #3b2c40 #4a3848 (openings) |
| GLASS | #1b2a38 #26404f #3a5e6c #6f939a |

Optional on any painted part: `lift` (-0.3..0.3, lighter/darker overall) and `speck` (0..0.4, mottling, default 0.16).

## Parts (every function returns a part to `g.add(...)`; defaults in brackets)
Solids, centre-placed:
- `api.box({ w [1], h [1], d [1], x, y, z, rot, ...colour })`
- `api.cylinder({ r [0.5] | rt, rb (top/bottom radius), h [1], seg [20], open [false], ... })` — `rt`/`rb` make a taper.
- `api.cone({ r [0.5], h [1], seg [20], ... })` — apex up; tilt with `rx`/`rz`.
- `api.sphere({ r [0.5], seg [20], sx, sy, sz, ... })` — squash with `sy: 0.6`.
- `api.torus({ r [0.5], tube [0.1], seg [24], flat [true], ... })` — a ring lying flat (rims, railings, hoops).
- `api.lathe({ points: [[r, y], ...], seg [20], x, y, z })` — a turned profile (vases, domes, bottles, towers): radius-height pairs from bottom to top.
- `api.extrude({ shape: [[x, y], ...] | api.THREE.Shape, depth [0.3], bevel, ... })` — a flat outline in the XY plane, thickened along z (centred). Use `rx: -Math.PI / 2` to lay it flat.
- `api.tube({ points: [[x, y, z], ...], r [0.08], seg [24], closed })` — a smooth pipe through points (ropes, handles, necks, tails).

Architecture:
- `api.gableRoof({ w, d, h [d*0.38], overhang [0.25], x, y (eaves), z, rot, ... })` — ridge along x, slopes face ±z. Default TERRACOTTA.
- `api.hipRoof({ w, d, h, overhang [0.25], ... })` — slopes on all four sides (a pyramid when w = d).
- `api.dome({ r [2], h [r], x, y (base), z, seg [28] })` — a half sphere; `h` flattens or raises it.
- `api.archWall({ w [6], h [4], d [0.5], arches [1], archW, archH, x, y, z, rot, ... })` — a wall slab pierced by round-headed arches (the Red arch's own shape). Default REDWALL.
- `api.inkDoor({ w [0.9], h [1.7], x, y (sill), z (face), rot, arched [true], frame [LIMESTONE | false] })` — an ink-dark doorway with a pale step.
- `api.inkWindow({ w [0.6], h [0.9], x, y (centre), z (face), rot, arched [false], shutters ['#hex' | ramp], frame [LIMESTONE | false] })` — ink-dark window with a sill; `shutters` adds painted shutters. `api.archOpening(o)` = an arched window. `api.door` / `api.window` are aliases.
- `api.column({ r [0.22], h [3], x, y, z, base [true], capital [true] })` and `api.columns({ n [4], spacing [1.6] | from: [x, z], to: [x, z], r, h, x, y, z, rot })` — a colonnade.
- `api.stairs({ w [1.6], steps [4], rise [0.18], run [0.32], x, y, z, rot })` — climbs toward -z; (x, z) is the centre of the flight.

Props and nature (base-placed unless noted):
- `api.fence({ points: [[x, z], ...] | length [4], h [0.9], gap [1.2], ... })` — posts and two rails along a path.
- `api.wheel({ r [0.6], w [0.12], spokes [6], x, y (hub), z, rot })` — a cart wheel, axle along x.
- `api.blade({ len [3], w [0.75], angle, cloth [WHITEWASH | false], x, y, z })` — a windmill sail: spar + lattice + cloth from the origin along +y, facing +z; `angle` turns it in its plane. Put several in a hub group.
- `api.sail({ w [2], h [3], billow [0.35], tri [false], ... })` — a boat sail, billowed toward +z, from the mast foot at (x, y, z).
- `api.flag({ pole [3], w [1], h [0.6], ...colour })`, `api.crate({ s [0.6] })`, `api.barrel({ r [0.35], h [0.9] })`, `api.pot({ r [0.3], plant [true], flowers [ramp] })`.
- `api.shrub({ r [0.8], h, ...colour })` — one painted mound of foliage (cheap; prefer it for hedges and bushes).
- `api.tree({ kind ['oak' | 'olive' | 'lemon' | 'orange' | 'pine' | 'cypress'], h, r, lean, leanTo: [dx, dz], x, y, z, rot, ramp, trunk, fruit [ramp | false], lumps })` — a proper 3D tree: a tapered trunk under a round crown of a few big lumps (a core, a top lump, side lumps a little lower) over a dark underside, with one smooth outline for the crown. It reads as a volume from the game's bird's-eye view (the view is 55-65 degrees down: squashed blobs and flat pads turn into discs on the ground, so never build a tree out of `api.shrub` pancakes). `h` is the total height, `r` the crown radius, `y` the base. Shortcuts: `api.olive(o)`, `api.oak(o)`, `api.lemon(o)` (with fruit), `api.pine({ h [6], r [0.4 h], lean, leanTo, x, z })` (a domed umbrella pine). **`kind: 'random'`** picks one of every type (umbrella pine, olive, cypress, oak, lemon, orange; `mix: { pine, olive, cypress, oak, lemon, orange }` reweights) from the same seeded `api.rand`, so a scattering of trees is a proper Mediterranean mix, not one species.
- `api.cypress({ h [5], w, x, z })`, `api.bush({ s [0.6], spread, lobes [2], h, flowers [PINK | ramp | false], bloom })` — the painter's own cypresses and flowering shrubs (dense: use at most ~4 per object). `api.pine({ kit: true })` / `api.kitPine(o)` is the painter's eye-level umbrella pine with flat needle pads: only for a set piece seen from the ground.

Groups and helpers:
- `api.group({ x, y, z, rot })` — a container; move or rotate it as a whole.
- `api.mesh(geometry, mat | ramp)` and `api.paint(geometry, ramp)` — turn a geometry into a part.
- Geometry makers for proxies or `api.mesh`: `api.boxGeo(o)`, `api.cylinderGeo(o)`, `api.coneGeo(o)`, `api.sphereGeo(o)`, `api.latheGeo(o)`, `api.extrudeGeo(o)` — same options; when you give x/y/z they are baked into the geometry.
- `api.THREE`: `Vector2`, `Vector3`, `Shape`, `Path`, `CatmullRomCurve3`, `QuadraticBezierCurve(3)`, `CubicBezierCurve`, `Color`, `Euler`, `Quaternion`, `Matrix4`, `MathUtils` only.
- `api.rand()`, `api.range(a, b)`, `api.pick(list)`.

Lines and areas on the ground (an object that runs along a path or covers a patch; points are `[x, z]` pairs, y is the ground):
- `api.path({ points, width [2.2], h [0.12], ramp [warm sand], kerb [darker ramp | false] })` — a road / path / jetty deck along a polyline (smoothed; `smooth: false` keeps corners). Alias `api.road`.
- `api.wall({ points, h [2.2], d [0.6], mat | ramp, cap [true], merlons [false] })` — a solid wall along a polyline (pale Lambert limestone by default), with a coping.
- `api.patch({ points, h [0.1], ramp })` — a flat painted slab in any outline: paving, a pond rim, a bed, a lawn.
- `api.stripes({ points, bands: [ramps...], width [2.6], angle })` — a striped field clipped to the outline (bands across its long axis).

## Pencil lines (keylines)
Every part draws its own pencil outline. Noisy clusters (many small bits, railings, rings of pots) scribble, so give the mass a **smooth proxy**: `api.proxy(api.cylinderGeo({ r: 1.4, h: 7, y: 3.5 }), g);`. A proxy is invisible; it draws the outline instead of every part it encloses (those parts stop drawing lines). `api.colourOnly(part)` removes one part's lines by hand. Doors and windows made with `api.inkDoor` / `api.inkWindow` still appear in the pencil drawing the object starts as (they carry their own sketch line), so a proxy round a wall never loses its openings. Make proxies the SAME size as the mass (a proxy that pokes out draws lines in the air); one per big mass.

**Openings on round or tapered walls** (towers, lighthouses, domes): put the opening on the surface at that height and turn it to face outward. On a cylinder of radius r: `x = r * Math.sin(a), z = r * Math.cos(a), rot = a` (a = 0 is the front). On a taper from `rb` at the base y0 to `rt` at y0 + h, the radius at height y is `rb + (rt - rb) * (y - y0) / h`; add 0.02 so the ink sits proud of the wall.

## Motion (optional)
`api.spin(part, { axis: 'z', speed: 0.6 })` turns a part (or group) forever (radians per second about its own axis: windmill hubs, carousels, lamps). `api.bob(part, { amp: 0.08, speed: 1 })` floats it up and down (boats, ducks, balloons). Spin/bob the group you want to pivot; put its pivot at the group's origin.

## Worked example 1: a house (reads from above: hip roof, a pergola)
```js
function build(api) {
  var R = api.ramps, g = api.group();
  var wall = api.lambert('#f3e9d8');
  // limestone plinth, whitewashed block, terracotta hip roof (reads as a square from above)
  g.add(api.box({ w: 4.2, h: 0.3, d: 3.6, y: 0.15, ramp: R.LIMESTONE }));
  g.add(api.box({ w: 3.6, h: 2.6, d: 3.0, y: 0.3 + 1.3, mat: wall }));
  g.add(api.hipRoof({ w: 3.6, d: 3.0, h: 1.3, overhang: 0.3, y: 2.9, ramp: R.TERRACOTTA }));
  // front (+z) face is at z = 1.5: an arched door, two shuttered windows, one on the left face
  g.add(api.inkDoor({ w: 0.9, h: 1.6, y: 0.3, z: 1.5 }));
  g.add(api.inkWindow({ w: 0.6, h: 0.8, x: -1.1, y: 1.7, z: 1.5, shutters: R.SAGE }));
  g.add(api.inkWindow({ w: 0.6, h: 0.8, x: 1.1, y: 1.7, z: 1.5, shutters: R.SAGE }));
  g.add(api.inkWindow({ w: 0.6, h: 0.8, x: -1.8, y: 1.7, rot: -Math.PI / 2 }));
  // a pergola of four posts and a slatted top on the right; a pot of red flowers by the door
  var p = api.group({ x: 2.5, z: 0.6 });
  var posts = [[-0.6, -0.9], [0.6, -0.9], [-0.6, 0.9], [0.6, 0.9]];
  for (var i = 0; i < posts.length; i++) p.add(api.box({ w: 0.12, h: 2.0, d: 0.12, x: posts[i][0], y: 1.0, z: posts[i][1], ramp: R.WOOD }));
  for (var k = 0; k < 5; k++) p.add(api.box({ w: 1.5, h: 0.08, d: 0.1, y: 2.04, z: -0.9 + k * 0.45, ramp: R.WOOD }));
  g.add(p);
  g.add(api.pot({ r: 0.26, x: 0.8, y: 0.3, z: 2.0, flowers: R.RED }));
  // keylines: one box for the house, one for the pergola
  api.proxy(api.boxGeo({ w: 3.6, h: 2.6, d: 3.0, y: 1.6 }), g);
  api.proxy(api.boxGeo({ w: 1.4, h: 2.1, d: 2.0, x: 2.5, y: 1.05, z: 0.6 }), g);
  return g;
}
```

## Worked example 2: a lighthouse
```js
function build(api) {
  var R = api.ramps;
  var g = api.group();
  g.add(api.cylinder({ r: 2.1, h: 0.6, y: 0.3, ramp: R.LIMESTONE, seg: 24 }));                        // plinth
  g.add(api.cylinder({ rb: 1.45, rt: 1.0, h: 7.4, y: 0.6 + 3.7, mat: api.lambert('#f1e7d6'), seg: 24 })); // shaft
  for (var i = 0; i < 3; i++) {                                                                       // red bands
    var y = 1.9 + i * 2.2, r = 1.45 - (y - 0.6) / 7.4 * 0.45;
    g.add(api.cylinder({ rb: r + 0.03, rt: r - 0.03, h: 0.7, y: y, ramp: R.REDWALL, seg: 24 }));
  }
  g.add(api.cylinder({ r: 1.35, h: 0.22, y: 8.11, ramp: R.IRON, seg: 24 }));                          // gallery deck
  g.add(api.torus({ r: 1.3, tube: 0.04, y: 8.55, ramp: R.IRON }));                                     // railing
  g.add(api.cylinder({ r: 0.75, h: 1.1, y: 8.77, ramp: R.GOLD, seg: 16 }));                            // lamp room
  g.add(api.cone({ r: 1.0, h: 0.95, y: 9.8, ramp: R.REDWALL, seg: 16 }));
  g.add(api.sphere({ r: 0.14, y: 10.35, ramp: R.IRON }));
  g.add(api.inkDoor({ w: 0.75, h: 1.35, y: 0.6, z: 1.43 }));
  g.add(api.inkWindow({ w: 0.36, h: 0.55, y: 4.6, z: 1.22, arched: true }));
  g.add(api.box({ w: 2.0, h: 1.6, d: 1.6, x: 2.3, y: 0.8, z: 0.6, mat: api.lambert('#efe4d2') }));   // keeper's hut
  g.add(api.gableRoof({ w: 2.0, d: 1.6, h: 0.7, x: 2.3, y: 1.6, z: 0.6, ramp: R.TERRACOTTA }));
  g.add(api.inkDoor({ w: 0.55, h: 1.0, x: 2.6, y: 0, z: 1.4 }));
  api.proxy(api.cylinderGeo({ rb: 1.45, rt: 1.0, h: 7.4, y: 4.3, seg: 24 }), g);                      // smooth shaft line
  return g;
}
```

## Worked example 3: a giant rubber duck (a floating prop)
```js
function build(api) {
  var g = api.group();
  var yellow = api.clay('#f6cf3a', '#e09a3c', '#b0623e');   // clay cel paint: toy-like, three hard tones
  var beak = api.clay('#f08a3c', '#d0602e', '#9c3f2a');
  g.add(api.sphere({ r: 1.6, sx: 0.85, sy: 0.72, y: 1.05, mat: yellow, seg: 32 }));        // body, long along z
  g.add(api.cone({ r: 0.7, h: 1.2, y: 1.55, z: -1.65, rx: -1.05, mat: yellow }));          // tail, tipped back (-z)
  g.add(api.sphere({ r: 0.95, y: 2.45, z: 0.95, mat: yellow, seg: 28 }));                   // head, facing +z
  g.add(api.sphere({ r: 0.42, sz: 1.6, sy: 0.45, y: 2.3, z: 1.95, mat: beak }));            // flat beak
  g.add(api.sphere({ r: 0.13, x: 0.52, y: 2.75, z: 1.6, ramp: api.ramps.INK }));            // eyes
  g.add(api.sphere({ r: 0.13, x: -0.52, y: 2.75, z: 1.6, ramp: api.ramps.INK }));
  g.add(api.sphere({ r: 0.75, sz: 1.4, sy: 0.4, x: 1.05, y: 1.45, z: -0.2, rot: -0.2, mat: yellow })); // wings
  g.add(api.sphere({ r: 0.75, sz: 1.4, sy: 0.4, x: -1.05, y: 1.45, z: -0.2, rot: 0.2, mat: yellow }));
  api.bob(g, { amp: 0.06, speed: 0.8 });                                                   // it bobs on the water
  api.floats(g, { line: 0.5 });                                                            // y = 0.5 is the water line
  return g;
}
```

## Checklist before you answer
1. `function build(api)` exists and returns the group; every part is added with `g.add`.
2. Parts sit on each other (check the centre / eaves / sill rules) and nothing floats by accident (a boat or a duck calls `api.floats`).
3. Front faces +z, doors and windows sit exactly on wall faces.
4. 8-40 parts, one accent colour, a clear roof or top shape, a proxy for any noisy cluster.
