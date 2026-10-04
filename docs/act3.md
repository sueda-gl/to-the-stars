# Act 3: the landing (`web/act3-lab.html`, `web/js/voyage/landing-bridge.js`)

ART_DIRECTION §16: Earth orbit → fly to Plissé → cross-fade into Plissé (verbatim) → descend → the Alpine lounge (verbatim) → and back. This is the whole landing as one sequence, with no dead stops.

```
http://localhost:8870/act3-lab.html             Play the landing / Back home / step buttons / bridge stills
http://localhost:8870/act3-lab.html?golden=1    arrive at golden hour (her Golden hour button, clicked while the lounge waits hidden)
```

## What you see (≈ 23 s out, ≈ 24 s home)
| s | stage | what happens |
|---|---|---|
| 0–8.2 | Tower Planet (Grain) | plisse-lab's flight: Earth slides away and the stand-in Plissé swells into her arrival framing. Plissé (and then the lounge) builds hidden underneath. |
| 8.2 | cut 0 (plisse-lab's, 1.7 s) | the stand-in hands over to `web/worlds/plisse.html`, the original. |
| ≈ 9.1 | Plissé (verbatim) | her camera, driven from outside (`approach()`), turns to face the **dusk ring** (1 s one-finger drag), then **pinches in to her closest allowed view, distance 14** (2.1 s two-finger pinch, log-eased). This starts while cut 0 is still finishing, because the Tower view tracks her live pose. |
| ≈ 12.2 | cut 1 (0.9 s) | the moment her pinch comes to rest, the landing bridge fades in at **her exact pose and her exact clocks**: the same walkers in the same places and the same paint. The dive eases in from zero. |
| +0–7.6 | bridge, Plissé part | the dive onto the ring. It descends on a log scale from altitude 3.75 to 0.8, pitching from straight down to 28° below the local horizon. Shadelings and elder lanterns pass by. The horizon curves: navy night on the right, cream day on the left. The air thickens (stars fade, a dusk haze). |
| +5.0–7.4 | bridge, the wipe | the lounge's meadow rises over the pleats from the bottom of the frame, in a torn painted wipe. |
| +4.6–10.6 | bridge, lounge part | the camera drops onto the red rug from 24 m up (the landing mark), comes down and levels out. The lake, the shrub cones and the peaks rise into view. It ends on the lounge's opening framing, at rest. |
| ≈ 22.4 | cut 2 (0.9 s) | `web/worlds/lounge.html`, the original, fades in over the bridge's matching last frame (it starts while the bridge's last 0.45 s settles). |

**Back home** reverses this: the lounge is turned back to its opening framing if the player moved it (`lookHome`). Cut 2 runs backwards while the bridge rises (t 10.6 → 0). Plissé reloads behind it, takes the bridge's clocks, and pinches to the same ring view. Cut 1 runs backwards. Plissé pinches out to her opening view, then plisse-lab's return (1.3 s fade, flight home) finishes in Earth orbit.

## The landing bridge (`web/js/voyage/landing-bridge.js`)
It is our own three r147 scene. It runs in a same-origin `srcdoc` iframe that loads the worlds' vendored three (`web/worlds/vendor/three@0.147.0/`), so its `THREE` never meets the Tower Planet's (r128).

- **Paint:** a **verbatim copy** of the shared gouache post of plisse.html (lines 349–533) = lounge.html (lines 780–965): ldr → tensor → paint (anisotropic Kuwahara) → comp, with the same uniforms and values.
  - The renderer is set up as both worlds set it: sRGB, ACES. Exposure is 1 for the Plissé scene, and the lounge's own `applyMode` exposure (0.92 midday) for the lounge scene.
  - The lounge's shadow map is on. No light in Plissé casts shadows, so her frame is unchanged.
- **Plissé part:** her scene code, copied (lines 98–114, 126–134, 136–347), with the same `mulberry32(11)` stream, so the same 190 walkers and 7 elders.
  - **Walkers:** `lon = lon0 + w · walkTime` (her `w.lon += w.w·dt`, summed). Their wobble, legs and the moons run on her scene time. Both clocks come from her driver.
  - **Hi-res landing patch:** her sphere is 368×200, which is faceted at walker height. The patch is 561² vertices round the landing site, and each vertex carries two versions:
    - her coarse mesh, sampled barycentrically on her own triangles (position, normal, colour, glow);
    - the fine surface (same `surf()`, same per-vertex colour and glow code).
  - `uFine` blends coarse to fine between altitude 2.7 and 1.3. At the start it draws exactly her coarse surface. Her coarse sphere discards inside the patch (on a cloned material, that mesh only).
  - **Additions:** `FogExp2` (density 0 = her frame), and a fade on her atmosphere shell (the camera passes through it at r 10.7).
- **Lounge part:** her scene code, copied (lines 91–107, 121–778) with the same stream: terrain, peaks, cones, shrubs, Reflector lake, set, the 3 sleepers and the 26 walkers (their wander code too). It ends on camera (0, 1.5, 6.6) → (0, 2.05, −3), fov 52 (portrait: her rule).
- **The wipe:** both scenes render to HDR targets. They mix under an fbm front that climbs the frame, and the mix is the input of the verbatim ldr pass, so the gouache paints the seam as one picture.
- Every copied line that differs is marked `[bridge]`. The two world files are never touched.

```js
import { createLandingBridge, BRIDGE, facingRing } from './js/voyage/landing-bridge.js';
const bridge = createLandingBridge({ container, zIndex: 32, golden });   // builds hidden at load (≈ 1.6 s)
await bridge.ready();
bridge.syncClock({ sceneTime: d.sceneTime(), walkTime: d.walkTime() });   // her clocks, now
bridge.start({ theta, phi, radius });           // her pose (d.cameraNow()): frame 0 is her frame
bridge.follow(() => ({ clock: {...}, pose }))   // or read them in the bridge's own frame, each frame
await bridge.play(1);                           // 0 -> BRIDGE.T (10.6 s); play(-1): rising home (waits for her clocks before uncovering Plissé)
bridge.hold(t) / hold(null); bridge.pause(on); bridge.setGolden(on); bridge.setOpacity(v); bridge.state()
BRIDGE.ring    // { theta -0.0180, phi 1.3512, radius 14 } = facingRing({ lat: 0.1 })
```
**Why `lat 0.1`:** head-on at distance 14, the ring is her terminator and reads near-black. Lifted 0.1 rad toward the day side, the lit olive edge, where most walkers are, sits in the middle of the frame.

## Driver additions (additive; see docs/plisse.md)
`web/js/voyage/plisse-driver.js`:
- `approach({ theta, phi, radius }, { turnMs, pinchMs, rest })`, `turn()`, `pinch(radius)`:
  - frame-locked synthetic **touch** gestures, stepped on the parent's `requestAnimationFrame` (one event per frame, so her camera moves every frame; §19);
  - `pinch` is her own OrbitControls two-finger dolly (continuous, not 5 % wheel notches), modelled exactly, clamped 14..75.
- `walkTime()`: her walkers' clock.
- **Exact clock:** a pass-through shim on the frame's `performance.now` records the values her THREE.Clock reads (it is the only caller in her page). That makes `sceneTime()` / `walkTime()` exact even when another frame's shader compile lands inside a rendering update.
  - Before this, the frame-stamp model was ≈ 0.4 s off in the full sequence, and the walkers ghosted at cut 1.
  - The values returned are unchanged and her file is untouched.

`lounge-driver.js` is unchanged.

## Verification (`tests/act3/`, Chrome headless metal, 1440×900, live :8870, never restarted)
| test | what it covers |
|---|---|
| `sequence.mjs strip` | a frame every 1 s from Play to the lounge → `shots/act3/seq-NN.png`, `seq-strip.png` |
| `sequence.mjs home` | a frame every 1 s over Back home → `home-NN.png`, `home-strip.png` |
| `sequence.mjs mid [golden]` | both cut midpoints, parked at 50 % through the test hook `__lab.fadeHold`, with each side alone at the same instant: `mid-1a/1/1b`, `mid-2a/2/2b`, `mid-3-lounge-after` (`golden-…` for `?golden=1`) |
| `bridge-stills.mjs [t,…]` | the bridge alone on its timeline: `bridge-tNN.N.png` |
| `cut-check.mjs` | her Plissé after `approach()` vs the bridge's frame 0: `cut1-a/b/c` |

Every run checks both world files byte-identical before and after (sha256 `c04218c1…` plisse, `8d9ff437…` lounge): PASS.

**Results:**
- **Cut 2:** the lounge, sky, lake band, set and rug coincide exactly (midday and golden). Only the wandering shadelings ghost, because their random walks differ.
- **Cut 1:** ground, glow patches and walkers coincide. A faint double appears on the walkers as the dive eases in (≈ 2 % zoom at the 50 % point).

## Notes and gaps
- **Same-origin frames share one main thread.** Each world's scene build (≈ 0.5–1 s) blocks every frame on the page, so the lounge builds under the flight (when Plissé is ready), never during the dive.
  - The flight therefore has hitches: the longest headless frame gap in flight is ≈ 0.85 s, which plisse-lab already had for Plissé alone.
  - In the game, build both worlds at the start of Act 3, or during a calm beat.
- **GPU:** during the dive, the bridge and the hidden lounge both paint. Plissé is unloaded after cut 1, the bridge is paused after cut 2, and the Tower renders only while on screen. Headless ran ≈ 20 fps with three painted scenes; a real GPU window is much smoother.
- **The lake mirror:** her lake mirrors the peaks at any shallow angle. That is why the drop comes straight down onto the rug and only levels out low. The mirrored peaks still show for ≈ 1 s in the lake before the real ones rise.
- **Values:** her dusk ring is dark (it is the terminator), and the lounge's midday is bright, so the wipe is a strong value change. `?golden=1` arrives at her golden hour, which is closer in value. Its last cut waits ≈ 4 s after the click for her ease to dusk; the dive covers that.
- **Pre-existing, not from this work:** `tests/plisse/driver-check.mjs` "lookHome()" fails with the original driver too (theta 0.139/0.169), so it is a timing issue in that test under load.

## Performance (2026-10-04, docs/perf.md)
The lab builds both worlds at load and keeps them tiny / frozen (`driver.setSize`, `driver.throttle`) until just
before each cut; the bridge's loop runs only from the dive to cut 2; Plissé stays mounted (frozen, opacity 0) after cut
1 so the way home starts at her ring pose with no reload. Flight 14.5 → 59 fps, dive 14 → 41 fps (dpr 1). stages.js
must mirror this: the exact list is in docs/perf.md §5.
