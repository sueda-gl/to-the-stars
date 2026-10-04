# Trees (`web/js/buildings/trees.js`)

Sueda's note (2026-10-03, `reference/moodboard/9-trees-PROBLEM.png`): "there is an issue with how trees look". From the leader's bird's-eye camera the groves looked like pale discs on thin orange sticks. Every pad had its own thick pencil ring, the umbrella pine's ring floated outside its crown like a halo, each grove sat on a beige cut-out earth disc with a dark outline, and the shadows were flat grey.

`trees.js` is now the **one** tree module. `api.js` already imports `createTreeBuilders` from it, so `api.tree`, `api.pine`, `api.olive`, `api.oak` and `api.lemon`, the world's plot trees (`world/scenery.js`), every prefab and every area fill draw these trees, and `api.js` itself is unchanged. `painted-trees.js` is a one-line re-export kept for old imports.

## The look
A crown is painted in four steps.

1. **It is a volume, not a plate.** A few merged lumpy lobes form the crown. Their painted normals are pulled toward one rounded envelope, so the whole crown is lit as one dome from the upper left: lemon-lit on the top left and deep on the right. The normals are also bent down in the crevices between lobes, so each lobe keeps its own lit cap. Finally they are bent down underneath, which gives the dark underbelly of the Red arch pads.
2. **Flat value patches (gouache dabs).** The surface is cut into Voronoi cells of about a third of the crown radius. The seeds are drawn by area, and one Lloyd step evens the cells so no slivers turn into stray marks. Each cell takes one flat painted normal and is nudged up or down at random, which makes it a lit dab or a dark dab. The lit top rarely gets a dark dab. After `kit.bake`, each patch is one crisp value, the way the Red arch's foliage reads, not a smooth clay gradient. The nudge is vertical, so it survives `finish()`'s re-bake after any rotation (checked: the brightest normal stays upper left after a quarter turn).
   - **Cypresses** get tall flame dabs: cells half the radius across, stretched 2× vertically, ±0.24 (two clear values). Next to the kit's cypress in the Assembly they read as the same painter.
3. **One pencil line per crown.** The crown is colour-only. Its keyline comes from one invisible hull, built like this:
   - it works in the crown's own normalised space (divided by its half-extents, so a flat pine canopy becomes a ball there);
   - every crown vertex and triangle centre is binned by direction on a 40×22 sphere grid;
   - empty bins are filled, lone spikes are capped, and the result is smoothed three times, never below 98.5 % of what was binned;
   - the poles are levelled and the pole and seam normals are merged.

   Measured: the hull's bounding box is 0–2.6 % larger than the paint (no halo). 8–10 % of painted vertices sit outside the line, at a median of 0.2 % and at most 1.4 % of the crown size (the gouache laps over the pencil). There are no folds or pole stars across the crown.
4. **Trunks** are tapered tubes with a root flare. They start below the ground and end inside the crown, and limbs reach into the lobes. Trunks draw their own pencil line (as the kit's do), which also stops crown lines behind them from showing through. `trunkLines: false` makes a trunk colour-only.

Species:
- **Umbrella pine:** a leaning trunk and a wide, flat-topped canopy of thin layered pads, each with a lit top and a dark underside. Above 7.5 m it can grow a second, lower canopy on a side limb.
- **Cypress:** a dappled flame.
- **Olive:** a short forked grey trunk under a deep, low, silver-sage crown with a warm lit top.
- **Round tree:** oak, lemon or orange (lemon and orange carry chunky fruit dabs).
- **Shrub:** optionally with blossom.
- **Grove:** n trees with room between the crowns, plus scrub at the edge. It has no base disc.

Shadows are cobalt/violet in the world because `world/ground.js` tints them. The trees don't tint anything, and the lab ground uses the same numbers.

## API
### Build API (what prefabs and generated code call; unchanged names)
```js
api.tree({ kind: 'oak' | 'olive' | 'lemon' | 'orange' | 'pine' | 'cypress', h, r, s /* scales h and r */,
           lean /* fraction of r */, leanTo: [dx, dz], x, y /* base */, z, rot, ramp, trunk /* bark ramp or radius m */,
           fruit /* ramp | true | false */, lumps, seed, trunkLines })
api.olive(o) / api.oak(o) / api.lemon(o)                 // tree with that kind
api.pine({ h = 6, r = 0.4 h, lean = 0.5, leanTo, ... })  // the painted umbrella pine
api.pine({ kit: true }) / api.kitPine(o)                 // the kit's eye-level pine (unchanged)
api.cypress(o) / api.bush(o)                             // the kit's dappled cypress and flowering bush (unchanged:
                                                          // the Assembly's Red arch set piece keeps them)
```
**Random mix (2026-10-04):** `api.tree({ kind: 'random' })` (also `'mixed'` / `'any'`) picks a type from `RANDOM_MIX = { pine: 2, olive: 2.2, cypress: 1.3, oak: 1, lemon: 0.5, orange: 0.4 }` (or `o.mix`) with the api's own `rand`, so prefab variants stay stable; `createTreeBuilders` also returns `randomKind(mix)` and `RANDOM_MIX`. The forest filler (`fill.js`) now mixes pine / oak / olive / cypress and draws its cypresses with `api.tree({ kind: 'cypress' })` (the light painted one), and the world's plot trees (`world/scenery.js` `KINDS`) include the cypress. Checked: `shots/library/random-trees-bird.png` (14 random trees in a row, bird view).

Default sizes stay at prefab scale: olive 2.7 m (r 1.05), oak 4.6 (r 1.75), lemon 2.1 (r 0.72), orange 2.3 (r 0.8), pine 6 (r 2.4), and cypress 5 (w 0.12 h). `kind: 'cypress'` is the **painted** cypress (about 1.3k triangles, against 28k for `api.cypress`). Measured: `tree({ kind: 'pine', s: 0.5 })` is 3.1 m tall, `tree({ kind: 'cypress', s: 0.5 })` is 2.6 m, and `olive({ s: 2 })` is 5.9 m. `pine({ leanTo: [-1, 0.3] })` puts the crown at x −0.51 (away from the woodcutter's shed).

`createTreeBuilders(base)` also returns `grove`, `roundTree`, `shrub` (painted, one outline) and `paintedCypress`. `api.js` exposes `grove` and `roundTree` once the one-line patch below is applied.

### Standalone (labs, scenery)
```js
import { createTrees, TREE_RAMPS } from './js/buildings/trees.js';
const trees = createTrees(ctx, kit, { seed: 5 });   // own shape stream; kit.bake still spends ctx.rnd
// each returns a THREE.Group, ground y = 0 at the trunk base, metres. Common: x, y, z, rot, seed, ramp, lift, trunk, bark
trees.umbrellaPine({ h = 8, r = 0.42 h, lean = 0.14 h /* m */, dir | leanTo, tiers /* 1|2 */, lumps })
trees.cypress({ h = 9, w = 0.11 h, patch, dapple })
trees.olive({ h = 5, r = 0.5 h, lean /* m */, dir | leanTo, lumps })
trees.roundTree({ h = 6.5, r = 0.36 h, tall = 1.6, fruit /* false | true | 'ORANGE' | ramp */, fruitCount })
trees.shrub({ r = 0.9, h = 1.1 r, lobes = 3, spread = 0.7 r, flowers /* false | 'PINK' | 'RED' | ramp */, bloom = 0.5 })
trees.grove({ n = 7 /* 1-16 */, r, mix = { pine: 2, olive: 3, cypress: 1, round: 1.4, shrub: 0 }, scale = 1, shrubs = 0.35 n,
              patch = false /* | true | '#hex' */ })   // group.userData.agora.trees lists what it planted
TREE_RAMPS: PINE, OLIVE, OAK, CYPRESS, ROUND, LEAF, TRUNK, OLIVE_BARK, PINK, RED, LEMON, ORANGE (dark -> light)
```
**Tags** follow `api.js`. Painted meshes carry `userData.agora = { part: 'leaves' | 'trunk', ramp, speck, lift }`, and crowns are `agoraColour` (colour-only). The single proxy per tree or grove carries `{ part: 'proxy' }` and `agoraLine` (invisible, line-only). `normalise`/`finish`, library clones, reveal and `measure` all work unchanged.

**Perf** (warm, M-series Chrome):

| what | meshes + proxy | triangles | build time |
|---|---|---|---|
| umbrella pine, 8 m | 2 + 1 | ~7k | ~6 ms |
| olive, 5 m | 2 + 1 | ~3.8k | ~4 ms |
| cypress, 9 m | 2 + 1 | ~2.4k | ~2 ms |
| `api.tree` (prefab scale) | 2–3 + 1 | ~3–4k | — |
| grove of 12 | 8 + 1 | ~47k | ~55 ms |

## For the lead
1. **Nothing to apply for the fix itself.** `trees.js` is live through the existing `createTreeBuilders` import.
2. **Optional, `api.js`** (`shots/trees/v3/api.js.patch`, one line: exposes `api.grove` and `api.roundTree`). Tested on a staged copy: it applies, both build, and all 21 prefabs build with no fallback.
   ```
   -    tree: trees.tree, olive: trees.olive, oak: trees.oak, lemon: trees.lemon,
   +    tree: trees.tree, olive: trees.olive, oak: trees.oak, lemon: trees.lemon, grove: trees.grove, roundTree: trees.roundTree,
   ```
   `BUILD_API.md` then gains: "`api.grove({ n [7], scale [1], mix { pine, olive, cypress, round }, shrubs })`: a whole painted grove in a few meshes, no base disc; `api.roundTree({ h, r, fruit })`. `api.tree({ kind: 'cypress' })` is the light painted cypress; `api.cypress` is the kit's heavy eye-level one (set pieces only)."
3. **`prefabs/grove.js`** still lays the beige extruded earth disc that Sueda complained about. Replace it with `shots/trees/v3/grove.proposed.js`. That version has the same 6×6 footprint and uses only `api.tree`, `api.pine` and `api.shrub`, so it needs no `api.js` change. It measures 6.2 × 5.5 × 6.2 m. Render: `shots/trees/v3/grove-proposed-{bird,eye}.png`.
4. **`fill.js` forest** (line ~116) calls `api.cypress` (the kit's, 28k triangles each) for forest cypresses. Use `api.tree({ kind: 'cypress', h })` there instead, which is about 20× lighter and the same painter. Keep `api.cypress` in the Assembly, temple and garden set pieces.
5. The old `shots/trees/painted/api.js.patch` (which re-routed `api.cypress` and `api.bush` and broke the Assembly) has been renamed `*.superseded`. **Do not apply it.**

## Lab and checks
`web/trees-lab.html` runs the real engine (gouache, cream ground, the world's cobalt shadows). Every exhibit goes through `normalise()`. URL parameters:
- `?view=bird` (default), `eye` or `top`
- `?set=engine` (default; `createTrees`), or `?set=api`: the same trees as the game builds them through the live build api (`api.pine`, `api.tree` for every kind, `api.cypress`/`api.bush` from the kit, `api.shrub`), plus the grove prefab
- `?only=groves|row`, `?ground=plain`, `?yaw=`, `?pitch=`, `?dist=` (a multiplier), `?nofolk`, `?notags`
- `window.__trees.stats()`

Scripts (dev server on :8870):
- `shots/trees/v3/check.mjs`: build times, counts, hull containment, all prefabs (no fallback), api semantics (`s`, `leanTo`, ramps by name, hex or number), the quarter-turn re-bake check, and 4xx/page errors.
- `shots/trees/v3/crease.mjs`: hull folds and trunk piercing.
- `shots/trees/v3/hullfit.mjs`: hull vs paint size.
- `shots/trees/v3/prof.mjs`: warm timings.
- `shots/trees/v3/shoot-proposed.mjs`: renders `grove.proposed.js`.
- `shots/trees/v3/shoot-world.mjs`: the world-lab town with plot trees, optionally close.
- `shots/trees/v3/patchcheck.mjs <port>`: a staged copy with the patch applied.
- `shots/trees/shoot.mjs <out.png> <url>`: one screenshot.

Shots are in `shots/trees/v3/`:
- `bird`, `eye`, `top`, `groves-bird`, `row-eye-close`
- `api-bird`, `api-row-bird`, `api-row-eye`
- `assembly-eye`, `woodcutter-bird`, `grove-bird`
- `grove-proposed-{bird,eye}`, `world-close`

The previous versions are kept as `trees.repair-pass.js`, `painted-trees.v2.js` and `trees-lab.v2.html`.
