# Marks (`web/js/marks/marks.js`)

The sovereign's pencil on the map (ART_DIRECTION §5, ARCHITECTURE §10). Where you click or draw is exactly where
things are built. Nothing is placed at random.

| input | mark | what it is for |
|---|---|---|
| left click | a small hand-drawn pencil **✕** (two slightly bowed, tapered strokes, upright for the current camera) | "a house here": the ✕ is the object's centre |
| left drag that closes near its start, or loops over itself | an **area**: pencil outline (overshooting where the hand closes it, part of it retraced lighter) + very faint graphite hatching that draws in | "this is a field / a forest / a garden": the filler fills exactly the shape |
| left drag, open | a **line**: a slightly wobbly pencil line | "a road / a wall / a river" follows it |
| Esc | clears the latest mark (ignored while typing or when disabled) | |
| right-click on a mark (≤ 5 px of travel) | clears that mark (the ✕, within ~14 px of an outline or line, or anywhere inside an area) | |

Strokes are resampled, simplified (RDP) and smoothed (centripetal Catmull-Rom). An area is closed if the end lands
within `max(3 m, 8 % of the stroke)` of the start, or if the stroke crosses itself (the loop part becomes the area, so a
tail before the loop is ignored). Areas under 4 m² become lines, and anything shorter than 7 px of travel is a click.
Every mark drapes on `world.groundY` (vertex y = ground + 0.05, sampled ≤ 0.6 m apart). In the vertex shader it is
also pulled 0.22 m toward the eye, so it never sinks into the relief.

## How it reads as pencil (the route that won)
Marks are screen-space ribbons on `FACE_LAYER` (5) only, with alpha capped at 0.44. That puts them in the paint
engine's **folk soft-shadow channel**: `post.js` draws layer 5 over a depth-only world every frame and composites
alpha < 0.45 as `mix(paint, ink, a)` **after** the Kuwahara pass. It does not mask keylines. So:
- the graphite stays crisp and grainy. The shader adds paper-tooth grain in css px, lengthwise streaks, hand pressure along the stroke, a soft edge and tapered ends.
- marks draw **live** while you drag, even though the world itself is repainted only at 24 fps.
- widths are in css px (3 px outline, ~2 px hatching, ~4.6 px ✕), so the pencil reads the same from the region view and from 15 m up.
- marks are depth-tested against the painted world: trees and buildings hide them correctly. `MaxEquation` blending means crossing strokes don't stack into blobs.

Ink is `#25212b` (graphite with a touch of the reference's violet). Over cream paper it lands at mid-grey, like an HB/2B pencil.

`?pencil=keyline|colour` in the lab switches to the two routes the brief asked to test (`shots/marks/routes-compare.png`, left to right overlay / keyline / colour):
- **keyline** (tents in `ctx.lineOnly`, drawn by the edge pass): thin ribbons are sub-pixel at bird's-eye, and the sep pass's *lost edges* noise breaks them up. The loop came out as a few dashes. Rejected.
- **colour** (a graphite ribbon in `ctx.colourOnly`, so it goes through Kuwahara): it survives only as a smooth, even, digital line with no tooth. It updates only on held frames, and hatching is lost. Rejected.

Limits: marks don't show in Raw 3D or Riso. Raw has no folk pass, and Riso reads layer 5 only as faces. The game uses Gouache only, so this is fine.

## API
```js
import { createMarks } from './js/marks/marks.js';
const marks = createMarks(ctx, world, {
  onChange,            // ({ type: 'add'|'remove'|'consume'|'clear'|'draft', mark, current }) => {}
  canvas,              // default ctx.renderer.domElement
  buildings,           // () => [{ id, name, kind, x, z }]   (for summarize().near)
  ignore,              // (pointerEvent) => true to leave a left click alone (e.g. a folk is under the cursor)
  claimLeft: true,     // stop left pointer events reaching the camera (capture phase + stopImmediatePropagation)
  keys: true,          // Esc clears the latest
  groundY, pick,       // default world.groundY / world.pick
  max: 12, width: 3.0, ink: '#25212b', autoUpdate: true, style: 'overlay'
});
marks.current()   // null | {id, kind:'point', x, z}
                  //      | {id, kind:'area', poly:[[x,z]...] (CCW, ~0.6 m apart), centroid:{x,z}, bbox:{x0,z0,x1,z1,w,d}, areaM2}
                  //      | {id, kind:'line', pts:[[x,z]...], length, centroid (the middle along it), bbox}
marks.list()      // every live (not consumed) mark, oldest first
marks.get(id)
marks.summarize(id?) // compact JSON for /api/command `mark`, sim/marks.js normaliseMark reads it:
                  // {id, kind, centroid:{x,z}, bbox?, areaM2? | length?, from?, to?, near?:{name, id, dist, where:'8 m N of it'}}
marks.consume(id, seconds = 1.5)   // leaves current() at once; the pencil is rubbed into the paint in grainy patches
marks.add({kind:'point', x, z} | {kind:'area', poly} | {kind:'line', pts})   // programmatic (director, tests)
marks.remove(id) · marks.clear() · marks.setEnabled(bool) · marks.enabled · marks.drawing
marks.handles(e)  // true if a pointerdown would be a mark (enabled, left button, not ignored, on the ground)
marks.hitTest(clientX, clientY) -> the mark under the cursor or null
marks.update()    // only if autoUpdate:false (it runs its own rAF otherwise; cheap)
marks.dispose()
```
The geometry helpers are exported too: `polyArea, polyCentroid, bboxOf, pathLength, pointInPoly, resample, simplify, catmull, classifyStroke`.

## Wiring into game.js
```js
import { createMarks } from './marks/marks.js';
import { createFillers } from './buildings/fill.js';
const marks = createMarks(ctx, world, {
  buildings: () => game.state.buildings,
  ignore: e => agents.pickAgent(e.clientX, e.clientY) != null,      // clicking a folk still opens its card
});
const fillers = createFillers(ctx, kit, lib.api, { groundY: world.groundY, library: lib, avoid: world.isWater });

// camera (ART_DIRECTION §5): left is the pencil's. world/camera.js still pans on left-drag, but marks stop those
// events in the capture phase, so the camera only ever sees right-drag / WASD / wheel / Q-E.
// While a modal owns the pointer (a letter, the ledger, the typed input): marks.setEnabled(false), and true again after.

// every command carries the mark
net.command({ transcript, pointer, mark: marks.summarize(), snapshot });

// a build at {mode:'mark'}
const m = marks.current();
if (m && fillers.kinds[kind]) {                       // field / forest / garden / road / wall / river ...
  const g = fillers.fill(kind, m); scene.add(g);
  const r = createReveal(ctx, g); r.hide(); marks.consume(m.id);
  await r.sketch(1); await r.paint(3); r.done();
} else if (m) {                                       // a single object: the ✕ is its centre (area: centroid; line: middle)
  const at = m.kind === 'point' ? { x: m.x, z: m.z } : m.centroid;   // -> game.placeBuilding(kind, { ...at, mark: m })
  marks.consume(m.id);                                // when its pencil sketch starts
}
```
`marks.consume` returns the mark, so the sim can store `shape: { poly | pts }`. Consume it when the object's sketch starts: the mark fades over 1.5 s while the object's pencil takes over.

## Lab and checks
`web/marks-lab.html` runs the real paint engine, `createWorld` (relief), the Build API and library, the fillers and the marks, under a bird's-eye camera (pitch 1.0, dist 84).
- Buttons fill the current mark: field / wheat / lavender / vineyard / kitchen garden / forest / garden / plaza / orchard, and road / wall / fence / hedge / river / canal.
- "House on the mark" puts a library house exactly on the ✕.
- The pencil → paint reveal plays, and the mark fades as it starts.
- URL options: `?shot=1` (no chrome), `?nofolk=1`, `?pencil=`, `#raw`.
- `window.__marks` exposes `{ marks, fillers, world, painter, lib, made, fillCurrent(kind, opts, {freeze:'sketch:1'|'paint:p'}), placeOnMark(kind), screen(x, z), stats() }`.

```
~/.nvm/versions/node/v22.22.3/bin/node shots/marks/check.mjs      # 14 behaviour checks with the real mouse/keyboard, exit 0/1
~/.nvm/versions/node/v22.22.3/bin/node shots/marks/shoot.mjs [--pencil=overlay|keyline|colour] [--only=field,forest,road,point,more]
~/.nvm/versions/node/v22.22.3/bin/node shots/marks/gallery.mjs    # every filler at once -> fills-gallery.png
```
`check.mjs` covers:
- a click is a point exactly at the cursor
- a left drag never pans the camera
- right-click clears a mark
- a closed drag becomes an area, with its centroid where it was drawn
- Esc clears the latest mark
- a self-crossing loop becomes an area
- an open drag becomes a line with the drawn length
- `summarize` is compact
- consume leaves `current()` at once and is gone after 1.5 s
- `handles()` answers correctly
- at most 12 marks stay live
- `clear()` works
- a mark on a hill (y 18) drapes exactly on the ground

`shoot.mjs` draws with the real mouse and writes `shots/marks/{field,forest,road}-{1-mark,2-sketch,3-painting,4-painted}.png` and `point-*.png`. `sequence-sheet.png` and `point-sheet.png` are contact sheets, and `live-drawing.png` is a mid-drag frame.

## Notes
- `web/js/buildings/fill.js` was meant to be this module's partner. A concurrent buildings builder replaced it with an implementation built on its `api.stripes / api.patch / api.tree` and compact forms. It keeps the same contract (`fill(kind, mark)`, `reveal`, `release`, `groundY`, `avoid`, `library`), so the lab and the wiring above use it unchanged. See that file's header for its own API.
