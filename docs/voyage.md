# Voyage: Earth → the shadelings' moon (`web/js/voyage/`, `web/worlds/`, `web/js/world/moon.js`)

Act 3 of the story arc. The neighbours' world is Sueda's **"Alpine lounge"**, used **exactly as is**:
`web/worlds/lounge.html` is a byte-identical copy of `reference/alpine-lounge-final.html`
(sha256 `8d9ff437041bf3ce01601c198768a6f5029e41503296f0b45273c26f843788ef`, the line in `reference/SHA256`).
**Never edit it.** We play it from the parent page. It sits in a same-origin `<iframe>`, and we reach it only through its DOM:
- synthetic pointer events on its `canvas#c`
- clicks on its own `#toggle` (Golden hour) and `#paint` (Raw render / Gouache) buttons
- one `<style>` we inject and later remove, to hide its chrome

## Files
| file | what |
|---|---|
| `web/worlds/lounge.html` | the scene, byte-identical (checked by `tests/voyage/driver-check.mjs`, before and after the run) |
| `web/worlds/lounge-sw.js` + `web/worlds/vendor/three@0.147.0/…` | offline for the stage: a service worker scoped to `worlds/` that answers the lounge's three r147 jsDelivr requests from local copies downloaded from that CDN |
| `web/js/voyage/lounge-driver.js` | `createLoungeDriver(iframe)`, which drives the lounge from outside |
| `web/js/voyage/voyage.js` | `createVoyage(...)`: lift-off, then the riso/gouache passage, then a crossfade into the lounge, and the reverse |
| `web/js/world/moon.js` | `createSkyMoon(ctx, …)`: the painted moon in Earth's sky (an addition; no paint module is touched) |
| `web/voyage-lab.html` | the lab: Earth (coast / arch / static painting), the sky moon, every voyage and driver control |
| `tests/voyage/driver-check.mjs` | checks the driver against the real scene (see Verification) |
| `tests/voyage/offline-check.mjs` | the moon loads with jsDelivr and Google Fonts unreachable |
| `tests/voyage/shots.mjs` | all screenshots in `shots/voyage/` |
| `tests/voyage/instrument.mjs`, `host.html` | test-only: writes `tests/voyage/out/lounge-instrumented.html`, the lounge plus ONE line exposing its closure, used only to check the driver's model |

## API

```js
import { createVoyage } from './js/voyage/voyage.js';
const voyage = createVoyage({
  container: document.body,      // the voyage root (position:fixed, z-index 40) is appended here
  onArrive(driver) {},           // the meadow is on screen and ready
  onReturn() {},                 // back on Earth, the sheet has lifted
  onState(state) {},             // 'earth' | 'departing' | 'passage' | 'arriving' | 'moon' | 'returning'
  hooks: {
    liftOff(ms) {},              // tip the Earth camera up toward the moon over ms (the sheet comes down over it)
    land(ms) {},                 // bring it back down over ms (the sheet lifts off it)
    moonScreen() {}              // -> {x, y, r} css px of the sky moon right now: the passage moon starts exactly there
  },
  src: 'worlds/lounge.html',     // relative to the page (web/)
  passageMs: 4200, liftMs: 1400, landMs: 1500, fadeMs: 1500,
  hideChrome: true,              // hide the lounge's own hint + buttons on arrival (the game UI takes over)
  keepAlive: false,              // false: unload the lounge on return (it costs GPU every frame while loaded)
  offline: true,                 // register worlds/lounge-sw.js (three r147 served locally)
  words: { out: { kicker, title, then, sub, wait }, home: { … } },   // passage copy (defaults below)
  zIndex: 40, log: null
});
await voyage.depart(snapshot?)   // -> driver. snapshot: canvas | img | url of the Earth frame (optional, see below)
voyage.arrive()                  // during the passage: cut to the crossfade. From Earth: straight to the moon (no passage)
await voyage.returnHome()        // the lounge fades into the home passage, Earth rises, the sheet lifts, then land(ms)
voyage.preload()                 // optional: load the lounge early (hidden). depart() does this itself
voyage.state, voyage.driver, voyage.el, voyage.iframe, voyage.still(dir, p, lift) /* frozen passage frame, for labs */
```
Default copy: outbound has the kicker "Earth's envoy, by election", the title "To the Moon" (which swaps to "The Shadelings" halfway) and the sub "a meadow, a lake, a red rug". If the lounge is slow to load, the passage holds and shows "the shadelings are lighting their lanterns…". Homebound has the kicker "the envoy returns", the title "Home" (then "The Coast") and the sub "back to the cream plot by the sea".

```js
const d = voyage.driver;                       // or createLoungeDriver(iframe, { log })
await d.ready()                                // canvas#c has class 'ready'
await d.dropSeed('auto' | {u, v} | {x, z}, { frame = true })
     // -> { ok, clientX, clientY, u, v, world:{x, z} }  or { ok:false, reason }
await d.setGoldenHour(on)                      // clicks #toggle only if aria-pressed differs; returns the new state
await d.setPainted(on)                         // #paint: true = her gouache post, false = raw render
await d.look(dx, dy, { ms = 900, settle = 1100 })  // a synthetic OrbitControls drag (css px). +dx swings the view left, like a hand
await d.lookTo({ theta, phi })                 // to an absolute orbit pose (opening: theta 0, phi 1.628). d.lookHome() goes back to it
await d.hideOwnChrome(on)                      // inject/remove a <style> hiding .hint/.bar (the file stays untouched)
d.state()                                      // { ready, goldenHour, painted, chromeHidden, camera:{radius, phi, theta} }
d.tap(clientX, clientY), d.wouldSeed(cx, cy), d.groundAt(cx, cy), d.project(x, y, z), d.camera, d.SEED_VIEW
```

```js
import { createSkyMoon, MOON_DEFAULT } from './js/world/moon.js';
const moon = createSkyMoon(ctx, { position: V(-138, 97, -323), radius: 24, ring: false, light: [0.62, -0.42, 0.66] });
// -> THREE.Group in the scene. Its disc is in ctx.colourOnly (no keylines) and ctx.folkHidden (like the sun).
// The disc is a camera-facing billboard (set in onBeforeRender), so it stays a clean circle from any viewpoint.
// moon.visible = false to hide it (hide the GROUP: the painter re-shows colourOnly members on every repaint)
// moon.userData.setRing(on) · setLight(x, y, z) · setGlow(0..1) (a flat paper halo) · dispose() · radius
```

## How the seed actually works (measured, not guessed)
The lounge drops a seed only when a tap's ground hit (the plane y = 0) passes its own `shValid()`. One of its tests is `groundH(x, z) ≥ WATER_Y + 0.35 = 0.05`. Right round the set, her meadow sits a hair *below* that line. So in practice seeds take only on the **left meadow (x < −4.8)** and a strip at the back right (x > 5.5, z < 1). From the opening framing that is a small, far patch at the left edge: on a 400-point grid of taps, only 9 spawn a seed. The scene is used as is, so the driver works with it:
- It carries verbatim copies of the scene's pure maths (`h3`, `vnoise`, `fbm`, `lakeD`, `groundH`, `shValid`, the obstacle list) and a model of its OrbitControls camera (target (0, 2.05, −3), rotateSpeed 0.5, the polar/azimuth clamps, the wheel dolly, the resize fov rule). Listeners on the iframe's canvas feed the model *every* drag and wheel, the player's own included. From this it predicts, before tapping, whether a tap will land on valid grass and exactly where.
- `dropSeed('auto')` searches the current view for the best spot. It scores a spot by how much of the crowd is within the scene's 7.5 m gather radius, how near and central it is, whether it sits low in the frame, and whether furniture hides it. It also needs a 0.35 m valid margin, so a camera still settling under damping can't push the tap off the grass. If the best spot is farther than 8 m, it first turns the camera to `SEED_VIEW` (theta −0.78, phi 1.6): standing in the left meadow, looking across at the sofas. It then drops the seed in the foreground, so the gathering happens big and near.
- Synthetic pointers: OrbitControls calls `setPointerCapture(id)`, which throws for a pointer the browser doesn't know. During our gesture only, the driver shadows `setPointerCapture`/`releasePointerCapture` on the canvas *instance* with a try/catch, then deletes the shadow. The file is untouched, and real pointers capture normally.

## Integration notes for `game.js`
**Create it once at boot** (`offline: true` registers the service worker early): `const voyage = createVoyage({ container: document.body, hooks, onArrive, onReturn, onState })`. Pass the game UI's root a higher z-index than 40 so letters, the caption and the mic stay on top during the voyage.

**The sky moon from the start**: after `createBackdrop`, call `createSkyMoon(ctx, { position, radius: 24 })`. `MOON_DEFAULT` = (−138, 97, −323) is high left of the sun for a coast camera near (0, 5.5, 19) looking out to sea. For a different camera, put it about 380 from the camera, about 14° up and about 22° left of the sun's bearing, and keep it inside the sky dome (600) and the far plane. During the descent it is simply there. The painter paints it like the sun.

**Lift-off (`hooks.liftOff(ms)`)**: on the coast, animate a value `k` from 0 to 1 over `ms` (ease-in, u²). Each repaint, in `beforeDraw` after you place your normal camera:
```js
camera.position.y += 9 * s; camera.position.z -= 3 * s;                    // s = smoothstep(k)
camera.lookAt(look.clone().lerp(moonPos.clone().add(V(90, -55, 0)), s));  // aim a little below-right of the moon
painter.markDirty();                                                       // repaint every frame while it moves
```
The sky fills the frame, the horizon drops and the moon rides high left. `web/voyage-lab.html` (`placeLifted`, `animateLift`) is the reference implementation. **`hooks.land(ms)`** runs the same thing from k = 1 back to 0. **`hooks.moonScreen()`** returns the moon's projected centre and radius in css px; the lab's `moonScreen()` is 6 lines you can copy. With it, the passage moon starts exactly where the sky moon was, and the torn ink sheet hands it over. Without it, the passage moon starts high left.

**Snapshot (optional)**: `depart(renderer.domElement)` makes the Earth frame drop away as a picture under the sheet. The canvas has no `preserveDrawingBuffer`, so draw and capture in the same task: `painter.renderPainted(); voyage.depart(renderer.domElement)`. With `liftOff`, you don't need it: the live camera tilts under the sheet.

**Pause the Earth while away**: once `onState` reports `'passage'`, the screen is fully covered, so skip `painter.frame` (and the sim's visual tick if you like) until `'returning'`. The lounge renders her full Kuwahara post every frame, so two painted worlds at once is wasteful. Resume on `'returning'` so Earth is painted before the sheet lifts. On return, the lounge iframe is unloaded (`keepAlive: false`). The next departure reloads it during the passage; from cache this takes about 2 s.

**Election → departure**: when the sim's election letter is accepted, or the voice says "let's go to the moon" / "take us to the moon" / "visit the neighbours on the moon", call `voyage.depart()`. "Build a rocket" can run its codegen'd build first and then depart. For director mode, `voyage.arrive()` from Earth jumps straight there.

**Voice on the moon** (route these before `/api/command` while `voyage.state === 'moon'`; the logic mind needs no moon actions):
| say | do |
|---|---|
| "offer them a seed", "give them a seed", "drop a seed", "plant something" | `await driver.dropSeed('auto')`. If the cursor is over the lounge, `dropSeed({ u, v })` with the pointer's fraction of the viewport (it snaps to the nearest valid grass). About 6 s later the shadelings ring the seed and hop. That is the moment to deliver their letter. |
| "wait for the evening", "wait for golden hour", "let the sun go down", "light the lamps" | `driver.setGoldenHour(true)`. The scene eases to dusk over about 3 s, the lantern beads glow and the lamp-lovers drift to the floor lamp. |
| "morning", "back to midday", "bring the sun back" | `driver.setGoldenHour(false)` |
| "show me the real thing", "raw", "without the paint" / "paint it again" | `driver.setPainted(false / true)` |
| "look left / right", "look around" | `driver.look(±160, 0)`; "look at them" → `driver.lookHome()` |
| "we come in peace", "hello", anything social | no scene action: send it to `/api/letter` (`purpose:'reply'`) with the shadelings as the correspondent, and have them answer by letter in their own voice (lantern-light, seeds, the lamp, the rug) |
| "go home", "back to Earth", "return", "take us home" | `voyage.returnHome()` |

Their letters can arrive like Earth letters: the UI tray sits above the iframe. A nice beat: right after a seed gathers, a lantern-shaped letter from "the shadelings of the red rug".

## Verification (all run on this Mac, Chrome headless `--use-angle=metal`, 1440×900)
`~/.nvm/versions/node/v22.22.3/bin/node tests/voyage/driver-check.mjs` checks the driver against the real scene, using the instrumented copy only to *read* state:
```
PASS camera model matches at rest (err 5.33e-15)
PASS tap validity model agrees on 400/400 points (9 spawn a seed), max landing error 2.34e-14 m
PASS look(140,-40) turned the real camera (theta -0.489), model err 0.0052 m
PASS after look(): tap model agrees on 110/110
PASS lookHome() back to the opening framing (err 0.0051)
PASS dropSeed('auto') at (-4.76, -1.42): shadelings within 1 m: 2 -> 8 after 6 s
PASS setGoldenHour(true) twice stays on, scene mix -> 0.999
PASS setPainted(false/true) -> false/true
PASS hideOwnChrome on/off: bar opacity 0 -> 1
PASS lounge.html still byte-identical after the run
```
`tests/voyage/offline-check.mjs` maps cdn.jsdelivr.net and the Google Fonts hosts to a dead port. The lounge still loads and is ready (`shots/voyage/offline-arrived.png`).
`tests/voyage/shots.mjs [sky|still|voyage|snap]` writes to `shots/voyage/`:
- `sky-moon-{riso,gouache,raw,ring-riso,lifted}`
- `still-{out,home}-*`, `still-sheet-tearing`
- `voyage-0-earth` → `voyage-1a-liftoff` (the sheet takes the moon) → `voyage-1-liftoff` → `voyage-2-passage-early` → `voyage-3-passage-mid` → `voyage-4-crossfade`
- `moon-1-arrived`, `moon-2-seed-dropped`, `moon-3-seed-gathered-6s`, `moon-4-golden-hour`, `moon-5-golden-seed`
- `home-1..4`, `snap-1..2`
A live departure reaches `'moon'` in about 7.7 s (lift 1.4 + passage 4.2 + crossfade 1.5); the lounge was ready inside the passage every run.

## Decisions (made without asking)
- **The seed view.** Her meadow only takes seeds on the left, so `dropSeed('auto')` turns the camera to `SEED_VIEW` before dropping. Pass `{ frame: false }` to keep the camera still and drop only within the current view (it may then report `ok:false`).
- **The lab's Earth** defaults to a **coast** stand-in: the Red arch backdrop, a cream Lambert plot, cypresses, shrubs and folk, all from the paint modules. That is the game's opening, and the only view where the sky moon can be judged; in the Red arch reference itself the wall hides the sky. `?earth=arch` gives the Red arch with the moon in its window; `?earth=image` gives the static reference painting (and the snapshot path).
- **Passage art.** The bodies are painted on the CPU once (720 px; about 60 ms each): moon tones match `moon.js`, and the Earth uses the Red arch sea, cream land and a coral coast. The night is the reference ink `#3d5588` → `#18203f` with a 45° halftone and paper specks. Stars are paper dots, some with a pink plate. The Riso pink `#f15060` is the misregistered plate, and it slides *into* register as you arrive. The registration marks match the editions. The tear has a pale fibrous core. There are no glows, gradients-as-light, lens flares or sci-fi UI.
- **The crossfade** zooms through the moon: it doubles in size as the canvas fades, while the iframe settles from scale 1.035 to 1.
- A `?still=out|home&p=` URL hook and `voyage.still()` exist for designing and testing frames.

## Gaps
- **No world mapping.** The driver can't read shadeling positions; it only knows where they tend to be. 'auto' assumes the crowd's habits (group centres + the fallback strip in front of the sofa); it is right in every run so far.
- **A player's drag may desync the model.** If the player drags the lounge *while* the driver is mid-gesture, the model can drift a few cm (damping). `lookHome()` re-syncs. The tap check has a 0.35 m margin for exactly this.
- **Narrow windows.** On a portrait window (aspect < 1) her scene changes its fov. The model follows it, but `SEED_VIEW` was tuned at 16:10, so check at the venue's resolution.
- **Two WebGL scenes in the passage.** During the passage the Earth and the hidden lounge both render. game.js should pause the Earth from `'passage'` on (see above).
- **The service worker needs a secure context.** It only works on `localhost`, `127.0.0.1` or https. On a LAN IP over http, the lounge falls back to the CDN as written.
