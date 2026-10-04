# Performance (2026-10-04, ART_DIRECTION §21 "the game gets very slow and lags, especially in the space travel")

Scope: scheduling only. No look changed: every shader, target size and setting a viewer can see is as it was; the two
verbatim worlds (`web/worlds/plisse.html`, `web/worlds/lounge.html`) are byte-identical before and after (sha256 checked
by every test run). What changed is *when* each painted pipeline runs and at what size while it is invisible.

Measured on Sueda's machine (Apple M1 Pro) with Chrome headless=new on the real GPU (`--use-angle=metal`, ANGLE Metal),
1440×900, device pixel ratio 1 (and 2 for the voyage, which is what her screen shows). Harness: `tests/perf/`.

```
PORT=8897 node server/index.js                                            # a server of your own (never restart :8870)
node tests/perf/voyage.mjs --tag after --dpr 1 --home                     # act3-lab, per phase, out and home
node tests/perf/voyage.mjs --tag after --dpr 2                            # the same at her pixel ratio
node tests/perf/game.mjs --tag after --dpr 1                              # the game, title -> voyage -> home (+ diagnostics)
node tests/perf/world-alone.mjs --page worlds/lounge.html --dpr 1         # one world alone: the ceiling
node tests/perf/trace-lab.mjs --home                                      # every 500 ms: what is awake, frozen, tiny
```
(`~/.nvm/versions/node/v22.22.3/bin/node`; `--tag before` runs are the same scripts against the old files.)

## 1. How it is measured (`tests/perf/probe.js`, `lib.mjs`)
A probe is injected into **every** frame (top page and each iframe) before its scripts run. It counts WebGL draw calls,
framebuffer binds and contexts per realm, the top page's rAF gaps (median / p95 / p99 / max), long tasks (> 50 ms,
PerformanceObserver), and reads CDP `Performance.getMetrics` for CPU, script, layout and style time. "draws/s per ctx"
says which pipelines are alive in a phase, "rAF/s per frame" whether a hidden world is still being driven. GPU time
cannot be read directly (`EXT_disjoint_timer_query*` is not exposed by Chrome here); a phase with a low cpu% and a long
frame is GPU-bound. Screenshots per phase go to `shots/perf/<tag>-<run>-<phase>.png`.

Caveat: another builder runs headless Chrome tests on the same GPU at the same time, so single runs vary by ±20 %;
the before/after pairs below were run back to back, and the direction of every change is far larger than the noise.

## 2. What was found
1. **Chrome never throttles a hidden same-origin iframe.** opacity 0, `visibility: hidden`, `display: none` and
   off-screen all keep `requestAnimationFrame` at 60 Hz (`tests/perf/_raf-iframe-probe` result, 2026-10-04). So every
   world mounted "hidden" (Plissé, the lounge, the landing bridge) painted its whole pipeline every frame for nobody.
2. **Four painted pipelines ran at once during the flight** (Tower Planet + hidden Plissé + hidden lounge + hidden
   bridge), three during the approach and the dive. Flight: **14.5 fps** (dpr 1), **7.8 fps** (dpr 2).
3. **The bridge rendered from page load** (opacity 0) until the dive, even in Earth orbit: orbit 37 fps instead of 60.
4. The worlds alone (their own cost, nothing else on the page, dpr 1): Tower Planet **60 fps**, Plissé **27 fps**,
   lounge **20 fps** (the lounge is the same at dpr 2: it is bound by ~600 draw calls per frame × 3 passes (shadow map,
   reflector, scene) in ANGLE's Metal encoder, not by pixels; Plissé is bound by her 1800×1125 anisotropic Kuwahara,
   radius 6.2 = up to 625 taps a pixel). These are her verbatim files: their cost is the floor of those scenes.
5. Main-thread hitches: the two world builds (~0.5–1 s each, same-origin frames share the main thread) and the bridge
   build (~1.6 s) landed inside the flight / the dive in the game (long tasks of 686 and 1539 ms measured, `stages.js`
   mounts the lounge at the dive and builds the bridge at departure).
6. In the leader view the Tower Planet is GPU-bound at ~33 fps (dpr 1) with ~720 draw calls a frame over four scene
   passes (shadow map 4096², colour, normals, folk) and ten full-screen passes: that is her pipeline plus the folk pass
   and it stays (§21: no look changes). DOM overlays cost < 1 % (style + layout), the game's JS ~5 ms a frame.

## 3. What was changed (no look change)
| file | change |
|---|---|
| `web/js/voyage/raf-gate.js` (new) | `installRafGate(win)`: shadows an iframe window's `requestAnimationFrame` / `cancelAnimationFrame` (own properties; the world's file untouched, like the `performance.now` shim). `set(0)` freezes the world (callbacks queued, nothing runs), `set(null)` frees it (queued callbacks run on the next real frame), `set(fps)` runs every k-th real frame (frame-aligned: a timer-driven trickle landed mid-frame and starved the visible scene: the rising bridge fell to 9 fps). three's `setAnimationLoop` re-reads `window.requestAnimationFrame` every frame, so it follows the gate. |
| `web/js/voyage/plisse-driver.js`, `lounge-driver.js` | `driver.throttle(0 \| fps \| null)` (the gate; the driver's own frame-counting tick is gated with her loop, so the camera model stays in step), `driver.setSize(scale)`: the iframe becomes `scale` of the viewport (same aspect) while hidden. The world renders at that size (its `resize()` rebuilds its targets), its clocks, gestures and animations keep running exactly, and the cost is one per cent of the pixels; `setSize(1)` restores it (call it ≥ 2 frames before the frame is shown: the first full-size frame is the heavy one). `state()` reports `throttle`; `driver.sized`, `driver.throttled`. |
| `web/js/voyage/landing-bridge.js` | The loop runs only between `pause(false)` and `pause(true)` (`setAnimationLoop(null)` when paused, no rAF at all). It **starts paused** after two warm-up frames (shaders compiled, both scenes drawn once). Only the scene(s) drawn this frame are stepped (`PL.update` while the pleats show, `LO.update` while the meadow shows). Per-frame allocations removed (`plisseAt`, `bez`), `surf()` once per walker placement (same numbers). `state()` adds `looping`, `draws`, `pixelRatio`, `targets`. |
| `web/js/planet/plisse-standin.js` | `syncClock(fn, { ms, walk })`: the stand-in's folk follow her **walk clock** (`driver.walkTime()`, a sum of her per-frame dt ≤ 0.05 s) and its moons her scene clock, so the folk still stand where she draws them at the cross-fade whatever her frame rate was while hidden. Without `walk` they run on the scene clock as before. |
| `web/act3-lab.html` | The reference schedule (below). `window.__lab.held` reports what is frozen / tiny. |
| `web/js/agents/pins.js`, `bubbles.js` | Every per-frame DOM write (transform, opacity, pointer-events, z-index, the SVG leader lines, `--tail`, the `dim` / `min` classes, visibility) happens only when its value changed: a still tag or bubble costs no style invalidation. |
| `web/js/planet/folkpass.js` | no per-frame `Color` allocation. |

### The schedule (act3-lab.html, to be mirrored by stages.js)
| when | Plissé (`pd`) | lounge (`ld`) | bridge |
|---|---|---|---|
| page load (calm) | mounted, `setSize(0.1)`, awake → **frozen** once ready (`throttle(0)`) | mounted, `setSize(0.1)`, awake → **frozen** once settled (ready + 1.45 s, + 4.2 s after a golden-hour click) | built, warm-up, **paused** |
| flight out, s < 0.74 | awake, tiny (her clocks exact; the stand-in follows them) | frozen | paused |
| flight out, s ≥ 0.74 (2.2 s before the fade) | **`setSize(1)`**, awake | frozen | paused |
| cross-fade, Plissé, approach | awake, full | frozen | paused |
| cut 1 done | **frozen**, opacity 0, tiny; **kept** (not unmounted: the way home starts at her ring pose, no reload) | frozen | `pause(false)` at the dive |
| dive, t < T − 2.2 | frozen | frozen | running (Plissé part only stepped) |
| dive, t ≥ T − 2.2 | frozen | **`setSize(1)` + awake** | running |
| lounge | frozen | awake, full | `pause(true)` |
| rising home | **awake, tiny** (her gestures and clocks run for the bridge's copies) → `setSize(1)` at t ≤ 2.2 | fades out, unmounted | `pause(false)` |
| Plissé uncovered, lift-off, leaving | awake, full | — | paused |
| return flight, Earth | frozen, tiny; unmounted when she fades out, remounted at once for the next voyage | — | paused |

Why these tools and not others: Plissé's cost is pixels, so "tiny" keeps her exact at ~1 % of the cost; the lounge's
cost is draw calls, so only "frozen" helps it (her shadelings wander at random: nothing needs their clock while hidden);
the bridge needs nothing while hidden. A world's walkers can never catch up lost time (their dt is clamped to 0.05 s),
so Plissé is never frozen while the bridge copies her clocks; the stand-in's folk follow her walk clock for the same
reason.

## 4. Before / after
All numbers: fps = frames of the top page per second over the phase; gap = the longest frame gap in the phase (ms,
the lab's own probe); "pipelines" = the painted pipelines drawing in that phase (from draws/s per context).

### The voyage (act3-lab.html, `tests/perf/voyage.mjs`), 1440×900

| phase | dpr 1 before | dpr 1 after | dpr 2 before | dpr 2 after | pipelines before → after |
|---|---|---|---|---|---|
| Earth orbit (Plissé in the sky) | 37 fps | **59** fps | 21 fps | **60** fps | Tower + hidden bridge → Tower |
| flight to Plissé (8.2 s) | 14.5 fps, gap 750 | **59** fps, gap 33 | 7.8 fps, gap 967 | **49** fps, gap 67 | Tower + Plissé + lounge + bridge → Tower + tiny Plissé (full for the last 2.2 s) |
| cross-fade into Plissé | 24 fps | **50** fps | — | — | 4 → 2 |
| Plissé, the approach to the ring | 15.6 fps | **52** fps | — | 28 fps | Plissé + lounge + bridge → Plissé |
| the dive (bridge, 10.6 s) | 13.9 fps, gap 433 | **41** fps, gap 100 | 7.9 fps | **20** fps | bridge + lounge (+ Plissé until cut 1) → bridge (+ the lounge for the last 2.2 s) |
| cut 2 (bridge → lounge, 0.9 s) | ~20 fps | ~21 fps | — | — | both, by design |
| the lounge, idle | 36 fps | **43** fps | 15.6 fps | **22** fps | lounge (+ the paused bridge's rAF) → lounge |
| rising home (bridge, 10.6 s) | 23 fps | **36** fps | — | — | bridge + reloading Plissé → bridge + tiny Plissé (full for the last 2.2 s) |
| lift-off from Plissé | 40 fps | **56** fps | — | — | Plissé + bridge → Plissé |
| leaving (fade to the Tower) | 48 fps | 46 fps | — | — | Plissé + Tower, by design |
| return flight | 60 fps | 60 fps | — | — | Tower |

(dpr 2 headless shows ~1 s stalls at the same points before and after — at her arrival, the approach, the dive and
the lounge — that the dpr 1 runs do not have; they are GPU-driver allocation stalls of the big HDR MSAA targets and
were not introduced here: the before run has them at the same places.)

The worlds alone (their own pages, dpr 1): Tower Planet 60 fps, Plissé 27 fps, the lounge 20 fps (19 at dpr 2).

### The game (`tests/perf/game.mjs`, dpr 1, `?intro=globe&opening=auto&minds=mock`, stages.js NOT yet integrated)

| phase | before | after | note |
|---|---|---|---|
| title over the orbit | 60 fps | 60 fps | |
| the descent | 32 fps | 56 fps | |
| landing + fleets + election (34 s) | 34 fps | 52 fps | |
| leader view, idle | 33 fps | 42 fps | GPU-bound: her four scene passes + ten full-screen passes + the folk pass |
| building (house, then a windmill) | 31 / 42 fps | 42 / 44 fps | |
| rise to orbit + bridge build | long task 1539 ms | 1.5 s | `stages.ensureBridge()` at departure: integration item 1 |
| flight out | 22.7 fps, gap 317 | 41.7 fps | the bridge no longer renders hidden; Plissé still full-size hidden (item 2) |
| Plissé + approach | 18.8 fps, long task 686 | 43 fps, no long task | the lounge build moved out of this phase by the bridge fix |
| the dive | 20.4 fps | 17.8 fps, long task 576 | stages.js mounts the lounge at the dive and renders it hidden: items 1 and 4 |
| the lounge, idle | 28 fps | 28.6 fps | |
| rising home | 14.5 fps | 10 fps | stages.js reloads Plissé at full size under the bridge: items 3 and 5 |
| Plissé, lift-off | 33 fps | 32 fps | |
| return flight | 40 fps | 55 fps | |
| home, idle | 16 fps | 38 fps | |

The pre-voyage game numbers move by ±30 % between runs (the shared GPU, see §1: a second after-run gave idle 44, building
28 / 29 fps; a second before-run was lost to a mid-run breakage of the other builder's game files); the descent /
landing / idle gains are mostly that noise plus the DOM caching, not a change in her pipeline. The voyage gains are
3–4× and stable across three after-runs.

### What one leader-view frame draws (diagnostics in `tests/perf/game.mjs`)
objects 1569–1748, meshes 1189–1346, shadow casters 845–994, 1.1–1.35 M triangles in the scene. Per frame (dpr 1):
her colour pass incl. the 4096² shadow map **249–474 draws**, her normal pass **36–77**, four full-screen passes, then
the folk pass **502–523 draws** (12 folk × ~40 parts, the reference creatures plus their accessories), two full-screen
passes. So the folk are two thirds of the frame's draw calls; her world is cheap in draws (the towns and buildings are
already bucketed by material). All targets 1440×900 (her `paintScale` cap), the screen at the device ratio.


## 5. What still needs game.js / stages.js (the integration stage)
`web/js/game/stages.js` runs the same chain as the lab; it must adopt the schedule above. Exactly:
1. **Build early, in calm moments.** At boot (after `planet.ready`, before or during the title) call `stages.ensureBridge()`
   and mount both worlds tiny: `mountPlisse()` then `pd.setSize(0.1)` and, on `pd.ready()`, `pd.throttle(0)`;
   `mountLounge()` then `ld.setSize(0.1)` and, once `loungeSettled()`, `ld.throttle(0)`. Today `ensureBridge()` runs
   at `goMoon()` (a 1.5 s long task under the rise to orbit) and `mountLounge()` at the dive (a 0.7 s long task in the
   first second of the dive, exactly where Sueda sees the lag). The lounge needs `ld.setSize(0.1)` BEFORE `src` is set.
2. **Flight out** (`flyPath`): in its per-frame step, `pd.throttle(null)` from the start, `pd.setSize(1)` when
   `s >= 0.74`. The stand-in sync becomes `standin.syncClock(() => pd.sceneTime(), { ms: 2000, walk: () => pd.walkTime() })`.
3. **After cut 1**: replace `unmountPlisse()` with `pd.throttle(0); plisseEl.style.opacity = '0'; pd.setSize(0.1)`.
4. **The dive's gate loop** (`b.state().t >= BRIDGE.T - 0.45 && loungeSettled()`): when `t >= BRIDGE.T - 2.2` call
   `ld.setSize(1); ld.throttle(null)` (once).
5. **goHome**: at the start `pd.throttle(null)` (she is still mounted, tiny, at the ring: `pd.approach(BRIDGE.ring)` is
   then a 0.9 s no-op turn); `pd.setSize(1)` when `bridge.state().t <= 2.2`; keep `await pd.ready({ settled: true })`;
   after `fade(plisseEl, 1, 0, 1300)` and `unmountPlisse()`, remount her tiny and frozen for the next voyage (or leave
   her unmounted and accept the load at the next departure: the lab remounts).
6. **The lounge's golden hour** while hidden (`?golden` / "wait for the evening" said before landing): wake her
   (`ld.throttle(null)`) before `setGoldenHour`, freeze again 4.2 s later; while she is on screen nothing changes.
7. `game.js`: nothing. The title wash and its `mix-blend-mode` letters are gone once Begin is clicked; the harness
   measures after a real click.

Everything else (the frame loop's `stages.paintWorld` gate, `agents.showPins(false)` off the map) already does the
right thing.

## 6. Safari
Not measured here (the target is Chrome; `tests/perf` drives Chrome through puppeteer). What differs in Safari:
- Safari **does** throttle rAF in iframes it considers off-screen / hidden in some versions; the gate makes the behaviour
  explicit either way, and a frozen world is frozen in both.
- WebGL2 is available (Safari ≥ 15); the worlds' HalfFloat MSAA targets need it. `EXT_disjoint_timer_query` absent too.
- Safari clamps the drawing buffer harder on Retina (her worlds cap their pixel ratio at 1.75 / 1.25 anyway).
- `backdrop-filter` (the letter reader's veil) is costlier on Safari; it is transient.
- The `performance.now` shim and the rAF gate are plain property shadows: they work in Safari.
If she tests in Safari and a phase is "awful", the first suspect is the lounge (draw-call bound: Safari's WebGL on
Metal has a higher per-draw cost than ANGLE's); nothing in our scheduling can lower that, only her file could.

## 7. Still open (not scheduling)
- The lounge alone at 20 fps and Plissé alone at 27 fps (dpr 1) are the verbatim files' own cost: a cross-fade between
  two of them is at best ~15 fps for its 0.9 s, and the lounge on screen is ~20–40 fps depending on what else the GPU
  is doing. Only a change inside her files (fewer draw calls in the lounge: the 26 shadelings × 8 meshes, the furniture
  ribs; a smaller Kuwahara radius in Plissé) could lift that, which §16 forbids.
- The leader view (~33–44 fps at dpr 1): her pipeline + the folk pass, GPU-bound. The next lever with no look change is
  the folk pass's ~500 draw calls a frame: each folk is ~40 meshes (`web/js/paint/folk.js`, verbatim, plus the
  accessories from `web/js/agents/identity.js`); baking each folk's rigid parts (body + cap + stripes + accessories that
  never move relative to each other) into one mesh per material would cut it 3–4×. Not done here: it touches the
  verbatim creatures' hierarchy and needs its own fidelity check.
- Her 4096² PCF-soft shadow map is re-rendered every frame (her clouds rotate and cast shadows, so an "idle" skip would
  freeze their shadows); left as is.

## 8. Tests
- `tests/act3/sequence.mjs mid` waits for Plissé at opacity 0 after cut 1 (she stays mounted, frozen) instead of her
  removal. `mid`, `strip` and `home` pass; both world files byte-identical before and after; the cuts coincide as in
  docs/act3.md (`shots/act3/mid-1-plisse-to-bridge.png`, `mid-2-bridge-to-lounge.png`, `seq-strip.png`, `home-strip.png`).
- `tests/plisse/driver-check.mjs`: all pass except `lookHome()` (pre-existing, timing under load, noted in docs/act3.md).
- `tests/voyage/driver-check.mjs`: all pass.
- `tests/perf/`: `probe.js`, `lib.mjs`, `voyage.mjs`, `game.mjs`, `world-alone.mjs`, `trace-lab.mjs`.

