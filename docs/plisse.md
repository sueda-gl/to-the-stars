# Plissé: Earth → the lantern planet (`web/worlds/plisse.html`, `web/js/voyage/plisse-driver.js`, `web/js/planet/plisse-standin.js`)

ART_DIRECTION §16: Plissé replaces the Moon as the Act-3 destination. It has two parts:

- **In Earth's space**, a stand-in Plissé is drawn in the Tower Planet's style. Her Grain finish dithers it like the Earth.
- **On arrival**, the view cross-fades into Sueda's original, used **exactly as is**. `web/worlds/plisse.html` is a byte-identical copy of `reference/plisse-the-lantern-planet.html` (sha256 `c04218c1a5d2010f045676faaeb89f90bf335c2c1433a21cbeca3fae52275fd3`, the line in `reference/SHA256`, and also the hash of `~/Downloads/Plissé — the lantern planet.html`).

**Never edit plisse.html.** Its shaders and looks are preserved. It runs in a same-origin `<iframe>`, and we reach it only from outside, as with the Alpine lounge (docs/voyage.md):
- synthetic pointer drags and wheel events on her `canvas#c`, for her OrbitControls;
- a click on her own `#paint` button;
- one `<style>` that we inject and remove, to hide her title card, hint and button bar.

```
http://localhost:8870/plisse-lab.html            the lab: Earth orbit + Plissé in the sky, Travel / Return, driver buttons
http://localhost:8870/worlds/plisse.html         the original, alone
```

## Files
| file | what |
|---|---|
| `web/worlds/plisse.html` | the original, byte-identical. Checked before and after every test run. |
| `web/js/voyage/plisse-driver.js` | `createPlisseDriver(iframe)`, `ARRIVAL`, `registerPlisseOffline()` |
| `web/js/planet/plisse-standin.js` | `createPlisseStandin(planet \| scene, opts)`, `PLISSE`, `plisseFov` |
| `web/plisse-lab.html` | the lab, with `window.__lab` for tests |
| `web/worlds/lounge-sw.js` | **unchanged**. Its worker (scope `worlds/`) already answers every `cdn.jsdelivr.net/npm/three@0.147.0/…` request from `web/worlds/vendor/three@0.147.0/`. That folder holds both files plisse.html loads: `build/three.min.js` and `examples/js/controls/OrbitControls.js`. Both are sha256-identical to jsDelivr (checked 2026-10-04). Fonts fall back offline, and her chrome is hidden in the game anyway. |
| `tests/plisse/driver-check.mjs` | the driver against the real scene (results below) |
| `tests/plisse/shots.mjs` | every lab screenshot in `shots/plisse/`. `W=430 H=932 PRE=portrait-` gives the portrait set. |
| `tests/plisse/clock-probe.mjs` | her clock vs the driver's `sceneTime()` |

The tests run on the live :8870 server and never restart it. Use `~/.nvm/versions/node/v22.22.3/bin/node tests/plisse/<x>.mjs`.

## What the visitor sees first (her arrival framing)
- The camera is at **(7, 8, 41)**, looking at the origin, y up, distance 42.36.
- Fov is **38** on landscape. On portrait her rule is `min(70, 38 / aspect^0.7)`.
- Plissé (radius 10, rim ≈ 10.33) is centred and fills about 72 % of the window height.
- Her lantern axis points at her star (−1, .16, .05), which is off-screen left. So:
  - the cream **day end with its red cap is the left limb**;
  - the **dusk ring** runs top to bottom just left of centre: olive and mustard, teal pools, the shadelings, the elder lanterns as spikes at the top and bottom, and warm lantern patches;
  - the **navy night end** is on the right, with its pleats converging on the far cap and glowing warm in the folds.
- The red pleated moon (r 19) and the bead (r 15.5) sit wherever her clock has put them.
- She then **auto-rotates**: theta falls 2π/3600·0.18 rad *per frame* (≈ 1°/s at 60 fps), so the view slides right round the dusk ring.
  - Her own `start` listener switches this off for good on the first drag or wheel. This includes the driver's `look()` / `zoom()`.
  - The driver cannot switch it back on: her `controls` live in a closure.

`driver.arrivalPose()` / `ARRIVAL` return this pose as data. `standin.arrivalPose(cam)` gives the matching Tower Planet camera.

## Driver API
```js
import { createPlisseDriver, registerPlisseOffline, ARRIVAL } from './js/voyage/plisse-driver.js';
await registerPlisseOffline('worlds/plisse.html');   // once, before the iframe loads (secure context only)
const d = createPlisseDriver(iframe, { log });        // then iframe.src = 'worlds/plisse.html'
await d.ready()                    // her first frame (canvas.ready)
await d.ready({ settled: true })   // ... + her own 1.4 s canvas fade-in: wait for this before cross-fading
d.isReady(), d.isSettled()
await d.hideOwnChrome(on)          // a <style> hiding .title, .hint, .bar (visibility too, so her button leaves the tab order)
await d.look(dx, dy, { ms = 900, settle = 1100 })   // a synthetic OrbitControls drag in css px; +dx swings the view left
await d.lookTo({ theta, phi })     // an absolute orbit pose in one drag
await d.zoom(f, { ms = 600 })      // distance × f (f < 1 = closer), as her wheel does it: 5 % notches, clamped 14..75
await d.lookHome()                 // back to her opening framing (distance by notches, then one drag)
await d.setPainted(on)             // her #paint: true = her gouache, false = her raw render
await d.approach({ theta, phi, radius }, { turnMs, pinchMs, rest })   // act3: a one-finger turn, then her two-finger pinch
await d.turn({ theta, phi }, { ms }), await d.pinch(radius, { ms })   // act3: frame-locked touch gestures (parent rAF, 1 event/frame)
d.walkTime()                       // act3: her walkers' clock (sum of her clamped dt), for copying her shadelings (docs/act3.md)
d.cameraNow()                      // the model: { theta, phi, radius, position, target, up, fov, aspect, autoRotate, frames }
d.sceneTime()                      // seconds on her THREE.Clock (for syncing the stand-in's moons and folk)
d.arrivalPose(), d.state(), d.camera (the model), d.window / d.document / d.canvas
```

**The camera model** (her closure can't be read):
- It is OrbitControls r147 with her settings (rotateSpeed .5, damping .06, distance 14..75, no pan, no polar or azimuth limits).
- It is fed by every pointer and wheel event that reaches her canvas, both ours and the player's.
- **Her frames are counted on the frame's own `requestAnimationFrame`**, and the damped auto-rotation is replayed per frame exactly. So throttling hits the model and her scene alike.
- **Her clock origin** is the moment her first frame's callback *runs*, not when `ready` appears:
  - her first frame starts late (her script builds the planet first) and compiles every shader;
  - the driver attaches before she renders, keeps the run times of its own rAF callbacks (in the frame's own `performance` time base), and takes the frame before the one where `ready` appears.

**Focus** works as in lounge-driver.js, so the game's Space push-to-talk keeps working:
1. `mousedown` inside the frame is default-prevented, so a click never focuses it.
2. If focus gets in anyway, every key is re-dispatched on the parent window, and Space / Tab / Enter never act inside. Her `#paint` button would otherwise toggle on Space.
3. Focus is handed back on pointerup and on focus.

Pointer moves are mirrored to the parent for the voice's "there". The iframe gets `tabindex=-1`.

## Stand-in API
```js
import { createPlisseStandin } from './js/planet/plisse-standin.js';
const plisse = createPlisseStandin(planet, { radius: 86 });   // AFTER createPlanet (her draw order); or (scene, …) + plisse.update(dt)
plisse.composeFor(camera, { screen: [0.77, 0.25], dist: 2400 })   // put it on the ray through a screen point (through her lens)
plisse.arrivalPose(driver.cameraNow() | null, { fish })  // -> { position, look, up, fov: 40, dist }: the Tower camera that matches plisse.html
plisse.flight({ from, to })        // -> { at(s) }: s 0..1, `to` may be a function (re-read every sample)
plisse.flyTo(planet | camera, ms, { to, from, apply, onProgress })   // drives it; resolves at the end pose (.cancel())
plisse.syncClock(() => driver.sceneTime(), { ms: 2000 })            // ease its moons and folk onto her clock; null = own clock
plisse.setToon(far, near), plisse.setMatch(v), plisse.position, plisse.group, plisse.uniforms, plisse.visible, plisse.dispose()
```

**What it recreates** from her file (the maths is copied verbatim):
- `surf()` on the same 368×200 sphere: 46 pleats, ribs at lat ±0.95, flat red end caps, fbm relief;
- her vertex colours: day cream, the dusk olive / mustard ring with teal pools, night navy, red ribs and caps;
- her `glow`: light leaking through the night folds, the far cap and the dusk-ring lantern patches;
- her additive atmosphere, brightest on the dusk ring;
- both moons on her orbits (the red one pleated 18×);
- the **190 shadelings and 7 elder lanterns**, placed from her own `mulberry32(11)` sequence in her call order (her 1180 stars are drawn and skipped first) and moved by her formulas.

At the end of the approach they stand where the original draws them.

**The Tower Planet's side:**
- It is lit by its own fixed star, as hers is, and not by the Tower Planet's camera-following sun. Her r147 lighting is recomputed: linear colours, key #ffe2b0 × 1.25, hemisphere #4a5694 / #140f1c × 0.32, ACES, sRGB.
- The lighting is banded in four soft steps like her toon ramp.
- It renders inside her scene, so her **Grain finish** grades it, dithers it to 6 levels with grain, ink-outlines it and lenses it like the Earth (§16: grain / dither allowed).
- `uSat` = 1/1.22 pre-cancels her Grain grade's saturation, so Plissé's colours land as Plissé's.
- As it fills the screen, the toon steps soften (`toonNear` 0.35) and her gouache value grade comes in (`uMatch`), so the last frames before the fade already carry the original's muted paper values.
- Folk are culled while they are sub-pixel.
- Cost: build ≈ 95 ms, ≈ 0.2 ms per frame of JS.

## The voyage (the lab is the reference implementation)
1. **Earth orbit.** Plissé hangs upper right, about 2400 from the camera, radius 86 (portrait: higher, above the tower). The lab stops her orbit spin so it stays composed ("Orbit spin" lets it turn; then it drifts out and back about every 3 min, as a real body would).
2. **Travel.** The lab:
   - mounts the iframe (opacity 0) and creates the driver;
   - flies `flight({ from: orbit pose, to: () => standin.arrivalPose(driver.cameraNow()) })` over 8.2 s through `planet.cameraFree({ …, snap: true })`;
   - on `ready`, hides her chrome and syncs the stand-in to her clock.

   On the flight, the camera turns to face Plissé while the Earth slides off left. It then comes in on a log distance scale and swings round to her arrival direction, which the end pose follows as her camera auto-rotates.
3. **Cross-fade** (1.7 s) once the camera has come to rest on her framing (s = 1) and she is settled. Her iframe is only ever faded with opacity: never scaled, filtered or blended. During the fade the Tower view stays locked to her modelled camera, so it follows her auto-rotation. Then the Earth stops rendering and the iframe takes pointer input.
   - **Lens match** (default on, "Lens match" toggles it): her Grain finish has a fisheye (`uFish` .38) and plisse.html has none. A frame-filling Plissé can't line up through it: the moons landed about 40 px further out. So from s .55 → .92 her lens relaxes to flat, and it returns on the way home. Nothing else of her look is touched.
4. **Return.** The lab locks the Tower camera to her current pose (wherever the player has dragged), fades the iframe out over 1.3 s, flies back (0.85× the time), calls `planet.orbit()` and unloads the iframe.

**Verified seams:** at the 50/50 hold the planet's rim, ribs, pleats, glow patches, elders, folk and both moons coincide (`shots/plisse/4-crossfade-50.png`). The rim is matched in screen space: her fov rule and aspect, the Tower's fov 40 and the current lens.

## Verification (Chrome headless `--use-angle=metal`, 1440×900, :8870)
`tests/plisse/driver-check.mjs` reads her real clock and camera through a test-only property trap in the test browser and compares them with the model:
```
PASS plisse.html byte-identical before
PASS scene clock: driver sceneTime() matches her THREE.Clock  real 9.042 s, driver 9.042 s
PASS auto-rotation modelled (frame-counted, damped)  err 1.28e-14 rad, 360 frames
PASS auto-rotation 3 s later  err 1.35e-14 rad
PASS look(140,-40) turned the real camera and stopped her autoRotate  model err 1.44e-3
PASS zoom(0.7): wheel notches, radius modelled  radius real 29.579 model 29.579
PASS lookHome() back to her opening framing  theta 0.1673/0.1691 phi 1.3812/1.3808 r 42.356/42.356
PASS hideOwnChrome on/off (.title .hint .bar)
PASS setPainted(false/true) through her #paint
PASS click on Plissé: focus stays on the parent, Space push-to-talk heard
PASS focus forced into the frame: Space forwarded to the parent, her #paint not pressed
PASS no page errors
PASS plisse.html byte-identical after
```

`shots/plisse/` contains:
- `1-earth-orbit`
- `2-flight-18|50|80`
- `3-standin-end-pose`
- `4-crossfade-50`
- `4b-iframe-only-at-hold`
- `5-arrived-original`
- `6-return-mid`
- `7-back-in-orbit`
- `portrait-1|4|5-*`

## Integration notes for the game
- Create the stand-in right after `createPlanet`, and call `composeFor(planet.camera)` when Act 3 opens (or stop the orbit spin). Its default spot is relative to the opening orbit pose.
- Register the offline worker at boot. Mount the iframe at departure. The original needs ≈ 1–2 s to ready plus her 1.4 s fade-in, which the 8 s flight covers.
- **Pause the Earth while on Plissé.** The lab skips `planet.frame` in state `plisse`, because her Kuwahara post renders every frame.
- The game UI root needs a z-index above the iframe (lab: 30).

## Act 3 additions (2026-10-04, docs/act3.md)
- **Touch pinch, modelled.** The model now tracks two-finger pinches (her TOUCH.DOLLY_PAN with pan off: each move does dollyOut(dEnd/dStart), applied at once and clamped 14..75). While two pointers are down, nothing rotates.
- **Exact clocks.** On attach, the driver puts a pass-through shim on the frame's `performance.now`, which her THREE.Clock (the only caller) reads. `sceneTime()` and `walkTime()` are then hers exactly. If the driver attaches after her clock has started, the older frame-stamp model is used. Values are returned unchanged, and the file is untouched.

## Gaps
- **Her auto-rotation can't be restarted** after any drive. `lookHome()` returns to the opening *pose*, not the drift.
- **Middle-button dolly** on her canvas is not modelled (two-finger touch is, since act3): rare, and `lookHome()` doesn't re-sync distance from them.
- **Grain and gouache differ in kind.** The cross-fade blends her dithered Grain into the smooth gouache. Shapes and colours match; brush texture can't.
