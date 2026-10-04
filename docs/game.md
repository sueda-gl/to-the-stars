# The game (`web/index.html`, `web/js/game.js`, `web/js/game/`)

The orchestration: every module in the repo, wired into one playable thing. Owner: Fable 5.1 (logic). Nothing here
changes a look; it only calls Sueda's Tower Planet (web/js/planet, her look verbatim), the paint engine's folk, the
buildings, the agents, the UI, the voice, the net, the marks and the Plissé driver through their documented APIs
(docs/*.md). **Since 2026-10-04 the game lives on Sueda's Tower Planet (ART_DIRECTION §12)**: see "The planet in the
game" below. The old map (`web/js/world`) and globe (`web/js/globe`) stay in the repo, unused by the game.

```
http://localhost:8870/                 the game (the server must run: npm start; live with a key, mock without)
http://localhost:8870/?intro=sky       the other opening (a top-down drop from 700 m instead of her orbit)
http://localhost:8870/?director=1      the scripted three-act demo (tests/record/record.mjs records it)
http://localhost:8870/?lab=1           + the reference's editions pill / Gouache settings / Up close (Raw for debugging)
```

| flag | values | what |
|---|---|---|
| `intro` | `globe` (default) · `sky` · `none` | `globe`: the title over her **orbit** (Grain, spinning, turned to face home), Begin → her `descendTo` home (Grain → Gouache and the clear daylight by altitude, her curves) into a bank of cloud, where the seaside map takes over unseen and carries the same camera move on down to the opening's low oblique landing camera: one uncut shot (docs/world.md "The landing hand-off"). `sky`: a top-down drop from 700 m over home. `none`: straight to the landing view. Any key or click skips the descent. |
| `opening` | `play` (default) · `auto` · `none` | the §11 opening after the descent. `play`: the fleets, the introductions, "Choose your minister: click one of them". `auto` (director mode's default, tests): the best diplomat is picked by itself after the ask. `none`: the old loose spawn (`spawnAll({fleets:false})`), straight to the welcome letter. |
| `director` | `1` | director mode: `DEFAULT_BEATS` play through the real caption + command path (see below); `window.__directorDone` at the end |
| `speed` | `0.3`…`1` | director timing multiplier (`?director=1&speed=0.5` plays faster) |
| `minds` | `live` · `mock` · `off` | overrides `/api/health.minds.status`: the server's minds routes, the mocks in the browser, or no loop at all (see "The minds in the game") |
| `lab` | `1` | mounts the paint chrome (editions pill etc.); the game never shows it otherwise (ART_DIRECTION §3) |
| `seed` | int | the sim's seed (folk, letters); the paint seed is fixed at 11; the lake is her terrain's |
| `font` | `A`…`G` · `now` | the UI typeface set (docs/ui.md); the game sets **G** (ART_DIRECTION §17) |
| `lang` | `en-US` · `tr-TR` | Web Speech language |
| `autostart` | `1` | no title card: Begin at once (tests) |
| `log` | any | `[agora]` console logging |

## Home is the seaside map; the title is "Aloud" (ART_DIRECTION §21–§23, integrated 2026-10-04)
- **Two canvases.** Her planet (`canvas.ag-planet`, z 1) is the title's orbit, the descents, the nations' towns (with their own
  folk: `pctx` / `pfolk` / `papi`, the folk pass) and the voyage. Home is `web/js/world` (`canvas.ag-sea`, z 0, its own
  renderer, paint context, Red arch backdrop and painter in Gouache), created at boot with `{ dressing: true, autoBloom: false,
  input: { left: 'none' } }`. **The game's `world` is the seaside map**: folk, agents, buildings (creation.js `scene.add` at
  `world.siteY`), marks, fills, picks and the rewards' `locate` all live there. The sim keeps its own seaside water and nations
  (no more `state.water = geo.water`). game.js adds `homePose / jump / stop / lake.centre` and a `project(x, null, z)` that
  reads the ground. `window.__agora.world` = the map, `.pworld` = her facade, `.painter` = the map's painter.
- **Hand-off** (`stages.js`, docs/world.md "The landing hand-off"): `diveHome` / `homeFromGlobe` descend her camera to
  `world.handoffPose().descend` (5.2 s, her lens easing to 0 over the last 1.5 s), `land()` snaps the map's rig to the pose,
  paints 2 frames under her, fades her canvas out (1 s), stops her. `lift()` (show the globe, a visit, the voyage) is the
  reverse: the map's leader view, her camera at the same framing, her canvas fades in, then the orbit (her lens eases back).
  `stages.surface` = `'sea' | 'planet'`, `paintSea` / `paintPlanet` drive the loop, `stages.step` names the current move.
  Off the map (`body.ag-aloft`) the folk's bubbles are hidden. The opening glides on from the leader view to its landing camera.
- **Perf** (docs/perf.md §5): the seaside map's programs, the landing bridge, Plissé and the lounge are built behind the boot
  screen (`stages.preload()`), then rest tiny and frozen; Plissé is awake + tiny in the flight (full size at s ≥ 0.74), frozen
  + tiny after cut 1; the lounge wakes at full size 2.2 s before cut 2; going home Plissé wakes tiny and grows 2.2 s before she
  is uncovered. Both worlds are now **kept** (frozen, tiny) after a voyage instead of reloaded, and the paused bridge's frame is
  `visibility: hidden`. The goMoon fixes (stand-in `planetWorld`, the Earth-clearance floor, the blend hold, `autoBlend(true)`
  on the way home) are unchanged.
- **Title**: `ui.titleCard` delegates to `ui/title.js` (§23), parented to `document.body`; game.js calls
  `frameTitlePlanet(planet)` before it shows and `release(1400)` in `onStart` before `begin()`.

## §24: the UI overhaul + the onboarding (2026-10-04 11:20, `css/aloud.css`, `game/onboarding.js`, `game/mail-dots.js`)
- **Type + palette**: every UI text is **Montserrat** (vendored: `assets/fonts/Montserrat-*.woff2`, variable 100–900 + italic,
  latin + latin-ext, OFL in `assets/fonts/licenses/Montserrat-OFL.txt`; font set `M`). `css/aloud.css` (after agora.css) sets
  the tokens for every set / scheme: ink `#2a2740`, warm white, frosted rounded panels, the pop icons' accents (icons.js
  `PALETTE`: hot pink, lemon, coral, cream; red for the dot). No blue serif ink anywhere; the "Aloud" title keeps Melodrama 600.
- **Icons**: every UI icon is the pop-comic set (`ui/icons.js`, `assets/icons/pop/`) through `ui/icon-slots.js` (`iconSlot(name, size,
  fallback)`): the mailbox, the arriving envelope, the mic (+ `mic-live` while listening) and the `space-key`, close / prev / next,
  the fleet species marks, the rewards tally (money / happiness / science / civ, rewards.js), the onboarding's step markers
  and pictures, the red dot (`alert-dot`), check, type.
- **Clutter**: no settlement name top-left (the ledger stays on Tab; the rewards tally takes the corner); **no letter tags
  over heads** and no floating "Welcome from …" tags (agents.pinLetter is no longer called): a folk with an unread letter
  gets ONE small red dot above its head (`game/mail-dots.js`, `window.__agora.mailDots.list()`); a click on the dot opens
  that letter in the mailbox, a click on the folk is still its card. Speech bubbles: at most **two** at a time (a third idle
  line is dropped; a player's talk, a thinking bubble and the ceremony force their way in), idle lines cut at 64 characters,
  12.5 px Montserrat (`agents/bubbles.js` `MAX_LIVE`, `SHORT`).
- **Mailbox** (top right): one round pop button with the red count; a click opens the **list**, and while it is open the
  icon disappears (the list, and the letter read in it, take its place; × / Esc fold it). No chevron, no hover-open.
- **The onboarding** (`?opening=play`, the default; not in director / `?opening=auto`): `begin()` runs `onboarding.run()`,
  which drives the guided opening (`opening.run({ guided: true })`) through six steps, each completed by the real thing:
  1 *Welcome to planet R-99* (the folk glide into their squares; Continue) · 2 *Meet your residents* (one wide view over every
  square, ONE panel line: "48 residents in 9 companies · 9 loaves · 9 twinkles …"; Continue breaks the squares, the folk go
  to work, the camera rises; no per-fleet tour) · 3 a resident writes (a red dot over them; the ring on the mailbox, then on
  the row; done when a letter is opened) · 4 *Build anything, aloud* (the ring on the mic; "Type it" and two examples open the
  typed line pre-filled; done on the first `building:site` / `building:needsDesign`, voice or typed) · 5 *Pick a minister*
  (the camera comes closer, the ring on the best diplomat, hover names the folk in the panel; done on `minister:set`, then
  the ceremony and the rise) · 6 *Open their letters, be fair* (two residents write with requests; done when a letter is
  opened, or "Start playing"). Then the society's letters start. "Skip tutorial" ends it at any step (the folk elect a
  minister themselves when none was chosen). `window.__agora.onboarding` → `{ current, id, state, goto(n), skip() }`.
- Guided opening (`opening.js`): `run({ guided })` waits after the squares form (no skip link, no auto intro);
  `introduce()` → the sim's ask → the squares break, the ask stays open with no crowd deadline (`'paused'`, not active: clicks
  open cards, the pencil works); `elect()` opens the election by click (the pencil rests); `finishGuided()`.
```
node tests/game/onboarding.mjs [--url http://localhost:8870/?minds=mock] [--dpr 2]   # the whole first-time flow by real clicks + typing;
                                                                                     #   32 checks; shots/game/onboarding/*.png
```

## Peek at a developed civilisation (`game/future.js`, `sim/future-state.js`; Sueda 2026-10-04 pm)
The onboarding's *future* step (and the corner switch after it, `ui/future-toggle.js`, the UI's hand) swaps her early game
for the trailer's developed city (`trailer/t6-city.js` plan, seeds 27 / api 1 / fillers 5, so it is the t6 city) standing in
the LIVE seaside map: the camera orbits / pans / zooms as usual, ~95 folk of every species walk the streets (loaves,
twinkles, glims, moths, flits, puffers, drops, pips, scoots) and the floaties and flits fly circuits; smoke from the power
station and works, canoes on the bay, sails turning. Then back to today, exactly as she left it.

| API (`game.future`, also `window.__agora.future`) | what |
|---|---|
| `ready` | true once the prebuild is done (the toggle waits on it: "getting ready…") |
| `prepare()` | the prebuild, time-sliced (~6 ms a slice; ~6–15 s): the city (345 things), roads, smoke, boats, the trees it clears, the crowd, then the batching (the trailer's cells + a second merge of every static mesh per material in 64 m cells, 1,077 meshes into 165) and a GPU warm-up. **Starts by itself** at the onboarding's `mark` step (or ~25 s after a landing without an onboarding). |
| `await enter()` → `true` | snapshot (sim state, letters, notes, tally, camera, marks, bloom), then the painted wipe: the frame she leaves is brushed away in slanted strokes (~1.2–1.5 s, the swap itself 3–25 ms). Refuses (false) off the seaside (globe, flights, Plissé). |
| `await exit()` → `true` | the wipe back; everything restored; `lastCheck = { same }` compares the sim's signature with the snapshot (anything drifted is put back in place). |
| `toggle()`, `active`, `busy`, `progress`, `state`, `stats` | `active` is true from the snapshot until the restore; `state` = the future's data; `stats` = prepare / enter / exit timings. |
| `command(text)` | while active every command and letter reply lands here: the city answers with a Ministry notice and the letter is stamped answered; nothing reaches her game. |

**While active** (game.js wiring, nothing else): `game.tick` is skipped (the sim, the minds and the post are paused),
`feedHud` stands still, the minds' `paused` is true, `handleCommand` routes to `future.command`. future.js itself parks the
real folk and buildings in an invisible group (never disposed; re-parked each frame if an envoy pops back), disables the pencil,
pauses the desk's society letters, hides the mail dots / bubbles / the Ministry's list and call button (`body.ag-fut-on`),
swaps the mailbox (`ui.letters.setLetters` + the notes column) and the tally (`rewards.setTotals / setCiv / show`), and shows the
"Developed civilisation · PREVIEW" badge (top centre) and **the cabinet** (top left, under the tally).

**The future** (`makeFutureState(state)`): a **Republic**, 48,260 money · 1,940 happiness · 3,780 science; 1,284 residents in ten
species; five ministers drawn from HER residents with their painted portraits (Builds = the minister she chose; Science, Industry,
Culture, Diplomacy by skill, one species each where possible); six letters: *A launch observatory, please* (Science), *Test
flight on Thursday* (the flight director), *The power station had a good month* (Industry), *A festival at the opera* (Culture),
*A trade treaty?* (Grey Harbour) and *The census is in* (the Ministry, read). Each has two quick replies the city answers.

```
node tests/game/future.mjs [--url http://localhost:8897/?minds=mock&autostart=1]   # 33 checks; shots/game/future/*.png
```
2026-10-04, headless dpr 2 on a loaded machine: 32/33 (the one miss: `ctx.colourOnly` length, meshes the game's own construction
wash / props retired during the peek; not the future's). Enter 1.2–1.5 s (swap 3–25 ms), exit 1.15–1.3 s (swap 3–5 ms); the sim
signature identical after exit; buildings, folk, letters, notes, tally, camera, bloom and lineOnly identical.
Known: in the future the painted world costs ~2x today's draw calls (≈7k a painted frame, 66 animated objects keep their own
meshes); the headless fps was 11–17 in the city vs 17–37 today on a busy machine. The parked city costs nothing measurable.

## The planet in the game (ART_DIRECTION §12, 2026-10-04)
`createPlanet({ autoStart:false, input:false })` makes her renderer / scene / post (the canvas is `canvas.ag-planet`, her CSS
rule in index.html); the game owns the loop and calls `planet.frame(now)` once a frame. On top of her objects, under
`planet.surface`, go: the **fine ground patch**, the **home lake** (home.js), every **building / site / fill**, the **marks**
and the folk pass's lights. The folk, their legs, blobs and the agents' props stay direct scene children in flat space
and are mapped onto the sphere for the render by the adapter (`planet/folkpass.js`, exactly as `planet-lab.html`).

| piece | file | what |
|---|---|---|
| fine ground | `game/fine-ground.js` | `createFineGround(planet)`: her sphere is ~1.9 m a vertex at home, so close views (the 19 m landing, the 8–12 m fleet visits) showed stair-stepped shading and a stair-stepped lake shore. A 0.6 m grid over the home region (game x, z ±92 m; 95 k vertices) with **her** height function (`terrain.H`), **her** ground material and **her** per-vertex paint computed by her own formulas (build.js 79–135), blended into her drawn sphere over 12 m at its border; under it her sphere is sunk by up to 1.2 m (covered, invisible, no z-fight). It is also the adapter's "drawn ground" (`alt / altAlong / normal / wat / cover`), so `createPlanetGeography({drawn})` and `createSurfaceAdapter({drawn})` agree with what is drawn: feet, buildings, the lake, picks. From orbit nothing changes (shots: `10-fine-on` vs `11-fine-off`). |
| world facade | `game/planet-world.js` | `createPlanetWorld({ planet, geo, adapter, ctx, game, fine })` = the game's `world`: `groundY / surfaceY / waterY / isWater / inPlot / pick / project / nation / lake / siteY`, `place(obj, building)` (the lowest ground under the footprint, the object's own `rotation.y` kept, floating things on the water level), `attach(obj)` (a site copied from its building), `placeFill(group)` (stood at the centroid, then **every vertex and instance curved onto the sphere**, so a 20 m field lies on the ground to its corners), `adoptMarks(marks)` (the pencil root under `planet.surface`; every ribbon it adds is curved: positions through the map, `aDir` through the local frame), the camera (below) and `rig` with the old rig's words (`mode 'map' \| 'close'`, `enabled`, `goal`, `pose()`, `setPose()`, `stop()`, `wasDrag()`, `busy`, `view`) for input.js / opening.js / desk.js. `levelBuilding / bloomBuilding` are no-ops (§9). |
| stages | `game/stages.js` | `'world'` (down, her local camera) · `'globe'` (her orbit / a flight) · `'moon'` (Plissé). `introGlobe()` = `world.orbit({over: home})`; `diveHome({to})` = `world.descent` (7.5 s); `showGlobe()` = orbit from where we are; `visitNation(id)` = her `descendTo` the nation's site (home.js `NATION_SITES`, 5.2 s, the rise and the hop are hers); `homeFromGlobe()` = out to her orbit if at a nation, then the same one-shot descent through the cloud to the leader view; `lift()` (before showGlobe / visitNation / goMoon) = the same shot backwards, up through the cloud to her orbit; `goMoon()` / `goHome()` = act 3 (below). `paintWorld` is false only on Plissé. |
| creation | `game/creation.js` | unchanged logic; `place` / `addSite` / `addFill` go through `world.place / attach / placeFill` when the world has them (the flat map's `scene.add` otherwise). |

**Camera (task §4, §15, §19).** The leader view `LEADER = { dist 64, pitch 0.95 (~54°), yaw −0.35, fov 50 }` frames the
60 × 56 m plot with the lake, the coast and her road, about 52 m up (inside her clear-daylight band, her curve). It was 75 m
until the 2026-10-04 polish pass: at 64 m the folk read ~17 % bigger. The camera is placed **every frame** (`world.update(dt)` → `adapter.cameraLocal({snap:true})`): a damped goal
for input, eased tweens for scripted moves (`focus`, `home`, `upClose` / `back`), her `descendTo` for the descent and the
visits (`world.descent({to, ms})`, mode `'flight'`), her orbit for "show the globe" (`world.orbit({over})`, turned to face
the point we leave so the rise is straight up). Input on her canvas: **right / middle drag pans** (the ground follows
the pointer; Shift / Alt + drag turns and tilts), **wheel zooms 15–150 m** (the pitch eases a little lower as you come
close), **Q / E turn**, R / F tilt, WASD / arrows pan, + / −; the target is clamped to ±64 m of the plot centre (inside the
fine patch). **Left is the pencil's.** Scripted tweens may go closer than the wheel (fleet visits 8–12 m, ceremony 10 m).
The opening's cameras are the ones in `opening.js` (`LANDING` 16 m / 0.62 ≈ 35°, aimed 2 m past the spawn = the squares' arc, so the
folk fill the frame under the title; `SQUARE` 0.48 ≈ 28°; `CEREMONY` 12 m / 0.42 ≈ 24°, the target pushed along the view by
lift / tan(pitch) + 3.3 m because the minister floats up 2–3 m: it now bows in the lower half instead of sitting on the seal title), then `world.home({ms:3200})` rises to the leader view.

**Pencil, then paint, on her pipeline.** The Red arch reveal keeps proxies in `ctx.lineOnly` (visible only in the normal /
depth pass) and leaves in `ctx.colourOnly` (never lines). game.js adds a `planet.renderHook` that makes the same swap round
**her** finish (`beforeFinish`: proxies on, colour-only off; `afterFinish`: back), so her edge pass draws the sketch and the
wash (the reveal's clip, aimed at her camera) climbs in her colour pass.

**Letters (§24, superseding §15's tags).** `letter:new` → the mailbox only; a folk with an unread letter gets a red dot
(`game/mail-dots.js`), whose click opens it in the top-right inbox. Portraits: `getPortrait → agents.portrait`. Font: `createUI({ font: 'G' })` +
`css/fonts.css` (Basteleur slanted display, Sentient text, vendored).

**The sim's water** is her terrain's: `game.state.water = geo.water` (the lake in her hollow at the knoll's foot, ~60 m²,
and her painted sea), then `campSpots` is re-run. `game.setNations(geo.places.nations)` moves the three nations to their
sites on her planet (the Drop Riviera at game (… ), the Loaf Republic, the Puffer Harbour; `geo.stats()`).

**Act 3 (§16), the chain of `web/act3-lab.html`.** `stages.goMoon()`: the stand-in Plissé (`planet/plisse-standin.js`, lazy)
is composed in her sky; rise to her orbit → `standin.flight` on her free camera (8.2 s, the lens relaxing as in plisse-lab) →
the cross-fade into `worlds/plisse.html` (verbatim, `voyage/plisse-driver.js`, loaded during the flight; `iframe#ag-plisse`,
z 5) → scene `'moon'`, `game.setScene('moon')` → her camera eases to the dusk ring (`pd.approach(BRIDGE.ring)`) → the **landing
bridge** (`voyage/landing-bridge.js`, built once lazily, z 6: `start(pd.cameraNow())`, `syncClock` from her clocks, `play(1)`,
the dive painted into the meadow) → the cross-fade into `worlds/lounge.html` (verbatim, `voyage/lounge-driver.js`,
`iframe#ag-lounge`, z 7, preloaded during the dive) = **`stages.driver`** (`dropSeed`, `setGoldenHour` for the sim's `moon:do`).
`goHome()` runs it in reverse: the lounge's camera home → `bridge.play(-1)` while Plissé reloads behind it and eases to the
ring → Plissé lifts off (`pd.pinch(ARRIVAL.radius)`, `pd.turn(ARRIVAL)`) → the flight back → her orbit → `descendTo` home.
Every iframe is only faded, never scaled or filtered; all three sit under the UI (z 10). `stages.act3` → `'earth' | 'plisse'
| 'lounge'`; `stages.plisse` / `stages.bridge` / `stages.driver`. Measured (mock): Earth → the lounge 35 s, home 38 s.

**Known limits / what's left** (2026-10-04):
- The three nations have no towns on the planet yet (home.js places their sites; the visit lands on bare ground). `globe/towns.js
  buildNation` through `world.place` is the next step.
- DOM things over the folk (speech bubbles, letter tags, the card anchor) are projected with the flat camera, which has no fisheye:
  near the screen edges they sit a little off their folk (her lens `uFish .38` is untouched). Centre-screen is exact.
- The lake's north-west shore shows a straight foam edge (home.js's lake sheet, as in planet-lab); the agents' own sun shadows are
  the folk pass's soft blobs (the folk are not in her shadow pass).
- The old look lab (`?lab=1` Gouache settings for the map) is not mounted: her look has no settings in the game. `assets/look.json`'s
  painter keys (brush, wobble, tooth, pooling) are applied to the folk pass.
- The pan / zoom feel and the leader distance are a first setting for Sueda to judge (`LEADER`, `ZOOM`, `pitchForDist` in planet-world.js).

## The opening (`game/opening.js`, ART_DIRECTION §11; Sueda 2026-10-04)
`createOpening({ game, world, ui, agents, marksRef, log })` → `opening.run({ auto })` resolves when the camera is back up. The sim owns
the script (`sim/fleets.js`), the agents bridge owns the poses (`agents/fleets.js`), the opening owns the camera, the UI and the click:

| phase | what happens |
|---|---|
| `landing` | the descent ends on **the close overhead landing camera** (`LANDING`: dist 16 m, pitch 0.62 rad ≈ 35°, target = `state.spawn` + 2 m, on the squares' arc; `opening.landingPose()` is what `runIntro` hands the dive / the sky drop as `to`). `game.spawnAll()` at once: the folk glide down big and readable, straight into their squares (`fleet:form`). The pencil (marks) rests; `ui.cinema(true)` keeps the frame clean (not in director mode). A quiet **skip link** sits bottom-right (*skip the introductions*); **any key twice** (the link turns red: *press any key again to skip*) does the same. |
| `intro` | once the folk are down (`agents.fleetsReady()`, ≤ 12.5 s) `game.introduceFleets({ every: 3.4 (auto 2.6), first: 0.8 })`; on every `fleet:introduce` the camera glides to that square (`world.focus`, dist 11–16 by the square's radius, pitch 1.12) and `ui.fleet.caption({ name, counts, index, total })` names it (counts by `agents.speciesOf`); the bridge does the roll-call. Skip: the remaining `introduce`/`hop` beats are dropped and the sim's `ask` beat pulled to now (`state.fleetBeats`, the only sim data the game writes). |
| `election` | `election:ask` → the camera back to the landing view, `ui.election.prompt()`; the link reads *let the folk choose* (→ `game.crowdElection('minister')`). **Hover** (input.js `onFolkHover`, a raycast every 70 ms) → `agents.highlight(id)` + `ui.election.hover(agent)` + a pointer cursor; **click** (input.js `onFolkClick` → `opening.onFolkClick`) → `game.electMinister(id)`. `auto` picks the best diplomat 1.6 s after the ask. A voice "make Olla our minister" works too (the sim closes the ask). |
| `ceremony` | `minister:set` / `election:result` → `ui.election.elected(agent)` (the seal moment; once per election); `ceremony:start` → the camera on the minister (`CEREMONY`: dist 12, pitch 0.42, the target lift / tan(pitch) + 3.3 m along the view so the floating folk bows in the lower half, clear of the title). The crowd's vote holds no sim ceremony (the ask is closed before the appointment), so the opening releases the squares itself 3.6 s after the seal moment. |
| `rising` → `done` | `fleet:release` (or `ceremony:end` when the squares already broke) → `world.home({ ms: 3200 })` eases up to the leader view → `finish()`: marks back on, `run()` resolves → `begin()` continues with the welcome letter. The sim's 90 s net (`hold_over`) releases the squares with the ask still open: the camera rises, a guide hint says to click a folk, and a click still elects. |

`window.__agora.opening` → `{ phase, electing, active, hoverId, introduced, run, skip, landingPose }`.

## Talk, the card, bubbles, jobs and ventures (game.js, ART_DIRECTION §11)
- **Card**: a click on a folk (input.js) → `ui.agentCard.show(dressed(agent))`: the sim agent plus `wears` (`agents.identity(id).words`) and `venture` (from `state.ventures`); `lookup.agent` returns the same dressed copy, `lookup.workplace` the building's name, `lookup.anchor` = `agents.screenOf(id)`. During the opening election the click elects instead (`Make minister` is hidden by the UI while `election.active`).
- **Talk**: `onTalk(id, text)` → `talkTo`: `net.talk(game.talkContext(id, text))` (`api.talk`, 22 s, the server's mock answers offline) → `game.talk(id, text, result)` (mood, memory, an offered action such as a build near them) → the sim's `agent:say {kind:'talk'}` → the bridge's paper bubble. The UI's `bubble` hook: while the UI's typed line is open for that folk the UI draws the bubble over its line (the designed layout) and the bridge's duplicate is dropped (`dropBridgeBubble`); otherwise (voice with just the card open, idle chatter, ventures, "Done!") the bridge's bubble over the head is the one, and a thinking bubble (`tone:'think'`) waits for the reply. **Voice**: a final transcript with `ui.talk.target != null` (a card or talk line open) goes to `ui.talk.say(text, {source:'voice'})`, not to the Ministry. Esc deselects (the UI's order: talk line → card → …).
- **Events → notices**: `election:result {by:'crowd'}` (outside the opening) *The folk have voted: X carries the minister's seal*; `venture:start` *X is starting a tea house*; `venture:done` *X's tea house is open*; `minister:set` refreshes the seal (quiet during the opening) and the open card. Jobs, the camp loop, build crews and helpers, entrepreneurs' sites: all sim events the agents bridge already draws (nothing to wire).
- **Inbox**: the UI fans the letters out on the stack click by itself (`ui.letters.fan()` / `inbox.open()`); the game only feeds `addLetter` as before. `window.__agora.letters` (= `sim/letters.js`) is exposed for tests.

## The minds in the game (game.js, ART_DIRECTION §18; docs/minds.md "What the game layer must do")
Every folk thinks for itself (Haiku 4.5 personas, a Fable 5.1 director; the mocks offline). game.js only wires the loop
(`sim/mindloop.js`) to the net, the opening, the bridge's bubbles and the ledger; the sim executes everything.

| piece | what |
|---|---|
| **net** | `net.minds(route, body, { timeoutMs })` (`net/api.js`) = `POST /api/minds/<cast\|think\|converse\|reflect\|direct>`. One attempt, no retry; the client waits `MINDS_TIMEOUTS` (think 6.5 s, converse 14 s, reflect 10 s, cast 95 s, direct 95 s; never less than the loop's own + 1 s), so the loop's race (5 / 12 / 8 / 60 / 90 s) and the server's live caps fire first. A 503 `{ code: 'off' }` or any error rejects: the loop answers that call from the rules. |
| **the loop** | after `/api/health`: `health.minds.status` `'live'` → `createMindLoop(game, { call: net.minds, mode: 'live', directorEveryMs })`; `'mock'` or no server → the mocks in the browser (`call: null`); `'off'` → no loop, the sim unchanged. `?minds=live\|mock\|off` overrides. `visible` = `!document.hidden`; `paused` = off the surface (`stages.scene !== 'world'`), the title card, the ledger, the fanned inbox, a meeting, a decree, or the director's cinema frame (the loop also pauses itself while the squares stand and during meetings). `game.attachMinds(loop)`: `game.tick` drives it. |
| **cast at spawn** | `fleet:form` (the squares, right after the landing) → `minds.cast()`: live, Fable writes the twelve; mock, the hand-written seeds. It lands before the introductions (mock: at once; live: usually within the ~12 s of the landing). **Fleet captions** then carry one member's one-line backstory (`ui.fleet.caption` is wrapped: `note` = the first sentence of the first member's persona, cut at a clause past 110 characters; no cast yet → no note). `?opening=none` casts right after the loose spawn. |
| **start after the election** | `minister:set` (the seal) → `minds.start()`; `fleet:release` (the squares break, also the sim's 90 s net with no minister) starts it if nothing did, and **re-staggers** the first round (`staggerMinds`: one folk every `thinkEvery[0] / n` ≈ 2.5 s from 2 s on), because the loop's own decree pokes fell due while the squares stood and twelve bubbles in one second is not a society. |
| **bubbles** | the bridge draws every `agent:say` over its folk (docs/agents.md), so a `kind:'mind'` line (a folk's own words as it decides) and each `kind:'chat'` line (one turn of a two-folk exchange, 2.6 s apart, alternating speakers; the sim's say queue) need nothing from game.js except the facing: on a chat line both records get `faceAt` / `faceUntil` (the listener toward the speaker, the speaker toward the listener, for the bubble's life, from the bridge's own `talkUntil`), so a conversation reads as two folk turned to each other, not two folk addressing the lens. |
| **the ledger (Tab) only** | `mind:cast`, `relationship` (\|delta\| ≥ 0.08: *Nando and Pippo: old friends*, *Zita holds a grudge against Olla*, *… talked and are getting on*), `conversation:end` (*Olla and Pim talked; cool with each other, and a letter followed*), `mind:reflect`, `mind:note`, `mind:direct` (*The story turns: … (weather); the minister writes*), `world:weather`, `festival`, and a mode change from `mind:status` → `ui.ledger.note(text)`: an **"Of late"** section, the last 4 of 12 kept, each cut to 96 characters so the sheet never scrolls. Never a notice, never a HUD. The foot carries one line from `ui.ledger.setMind`: *live minds · ≈ $0.12/h* (`/api/health` → `minds.usd.perHour`, polled every 60 s), *minds resting (rules)*, *minds of their own (offline)*, or *live minds, answered offline* when ≥ 75 % of the last twelve decisions came back `source:'server-mock'` (the server reached for the models and fell back: a key without credit does exactly this). |
| **the director** | its `minister_briefing` is already a `report` letter from the minister (`meta.kind:'briefing', meta.director:true`, `applyDirection`), delivered by the existing `letter:new` path (inbox + the tag over the minister); `desk.js` skips its live rewrite for `meta.director` letters (they are written in character already). "what happens next?" / "what's next" / "next chapter" (typed or spoken, `handleCommand`) → `minds.direct('demand')` + a quiet Ministry notice, instead of the command route. |
| **tests** | `window.__agora.minds` (the loop), `__agora.mindsStarted`. |

```
node tests/game/minds.mjs [--minds live|mock] [--opening auto|play] [--window 120]   # the cast at spawn (before the introductions), a backstory in the
                                                                                   #   caption, the start after the election, >= 3 mind bubbles and a
                                                                                   #   two-folk conversation within 2 min (alternating, 2.6 s, facing),
                                                                                   #   the ledger's lines + mind line, the briefing letter; shots/game/minds/
```
2026-10-04 on :8870 (a key without credit: the server answers every call from its mock, `source:'server-mock'`): `--opening play` 23/23 in 65 s,
first mind bubbles 7 s after the opening, the first conversation at 15 s, 0 page errors; `--minds mock --opening auto` 23/23 in 46 s. Shots
`shots/game/minds/`: `01-caption-backstory`, `02-leader-after-opening`, `03-conversation-leader`, `04-conversation-close`, `05-ledger`,
`06-briefing-letter`, `07-briefing-open` (and `mock-*`).

## Boot (game.js)
`createPlanet({autoStart:false, input:false})` → `createFineGround(planet)` → `createPlanetGeography(planet, {drawn: fine})` →
`createSurfaceAdapter(planet, {geography, drawn: fine})` → `createContext({ renderer: planet.renderer, scene: planet.scene,
camera: adapter.flatCamera, seed 11 })` → `createFolkPass(planet, {adapter, ctx})` → `createKit` → `createGame({seed})` +
`setNations(geo.places.nations)` + `state.water = geo.water` + `campSpots` → `createPlanetWorld(...)` →
`createFolk(ctx, pass.backdrop, makeNav(game, world))`, `pass.attach(folk)` → the pencil / paint render hook →
`createBuildApi` + `createLibrary` → `createAgents(ctx, folk, game, world)` → `createStages` → `createUI({font:'G'})` → the
letter tags → optional modules by dynamic import (`marks/marks.js` + `world.adoptMarks`, `buildings/fill.js`,
`buildings/painted-trees.js`) → `createInput`, `createCommands`, `createDesk`, `createCreation` → `lib.load()` →
`/api/health` → **the mind loop** (`createMindLoop`, mode from `health.minds`; see "The minds in the game") → `/api/assets` → `createVoice` (`holdKey('Space')`) → `stages.introGlobe()` (her orbit under the title) →
the loop → `await planet.ready` → the title card.

The loop (`frame`): `game.tick(dt)` always; `input.update`; `world.update(dt)` (the camera, every frame); while the planet is
drawn (`stages.paintWorld`, i.e. not on Plissé): `folk.update` → `agents.update` → `lib.update` → `creation.update` →
`planet.frame(now)` (her frame body + the folk pass + the pencil hook). ~2.5 ms CPU a frame on this Mac, the folk pass 0.7 ms.

`window.__agora` exposes everything for tests: `{ game, world, planet, geo, adapter, fine, pass, ui, commands, stages, creation,
lib, agents, folk, net, marks, voice, director, desk, minds, mindsStarted, errors, perf, handle(text, pointer?), begin, skip, introDone, live }`.

## Modules (`web/js/game/`)
| file | what |
|---|---|
| `stages.js` | the planet's stages (above): `'world' \| 'globe' \| 'moon'`, her orbit / descents for the opening and the visits, Plissé for act 3 (`iframe.ag-stage-moon`, z 6; the paper veil for cuts). |
| `planet-world.js` | the world facade over her planet (above): ground, placement, the leader camera, `rig`. |
| `fine-ground.js` | the fine ground patch under the home region (above). |
| `creation.js` | `createCreation(...)`: `building:site` → a prefab (`lib.create`, `rot`, `fit` for a thing named for an area) in a construction site (`buildings/construction.js`: pencil at once, the wash follows `max(sim progress, a 7.5 s clock)`, `finish()` on `building:done`), or a **fill** for area / line kinds (`fillers.make(kind, shape)` on the sim's exact polygon / polyline, `fillers.reveal`). Floating things sit on `LAKE_Y` / `SEA_Y`. The colour bloom (`world.bloomBuilding`) comes at 45 % of the wash. `building:needsDesign` → Ministry notice with the pencil scribble → `net.create` (sketch + codegen in parallel): the massing sketch (`renderSketchFromMassing`) is drawn in pencil as soon as it lands; `done` → `lib.register` → `game.designArrived` → `building:design` → the sketch is swapped for the real object in a site; failure → the sketch itself is painted and registered as the design (massing kept for "another one"). Camera: `world.focus` on every site. `pending()` feeds the director's idle. |
| `commands.js` | `createCommands(...)`: `handle(text, {pointer:{x,y}, source, beat})` → `world.pick` at the deictic moment (or the cursor), the full mark (`marks.current()` + `summarize()`), `game.snapshot()` + scene → `net.command` → per action: `at.mode 'mark'` gets the full mark, `at.mode 'pointer'` gets the picked x/z, "in the lake" words turn `near water` into `water` mode (so it floats) → `game.apply` → effects routed (`mark` → `marks.consume`, `nudge` → a notice, refusals → a minister notice). `res.say` is shown when the command did nothing or built nothing. Server down → `localParse` (catalogue nouns, meetings, moon, globe) so typed commands still land, with an offline note. |
| `desk.js` | `createDesk(...)`: `letter:new` → `ui.letters.addLetter`. When live, every courier / envoy letter is **rewritten in character** by `/api/letter` while it travels (`letter:sent` / `envoy:send` prefetch; purposes refusal, skill_answer, report, reply, envoy, gift_thanks, election, shadeling_*), merged on landing (2.5 s grace, the template is the fallback). Society: every 90 s on the map, `net.society` → `game.sendLetter` (couriers / envoys carry them). Meeting: `meeting:start` → `folk.setCloseUp`, `world.upClose(where)`, the report from `/api/letter report` (live) or the sim's `ministerReport`, `ui.meeting.show`; `meeting:end` → back. `stats` counts prefetches / rewrites. |
| `input.js` | the cursor (`pick()` = the ground under the pointer, else the plot centre), a click on a folk → `onFolkClick(agent, at)` (returns true when consumed: the election) else `ui.agentCard`, `onFolkHover(id)` (a raycast every 70 ms, `hoverId`), edge scroll. The rig's own input does the rest (right-drag pans, shift/alt-drag turns, WASD, Q/E, wheel; left is the pencil's). |
| `opening.js` | the §11 opening (above): the landing camera, the fleets, the introductions, the election by click, the ceremony, the skip. |
| `director-hooks.js` | `makeDirectorHooks(...)`: `say` types the utterance into the live caption word by word, `command` runs the real path, `pointer` moves a drawn cursor (`.ag-cursor`) to named spots (windmill / cliff / lake / middle) and `voice.injectPointer`, `camera` (`descent` = the intro, `meeting` = home first), `idle` (no command in flight, no codegen, no site younger than 4.5 s), `waitEvent` (game events, e.g. `letter:new`, `stage:moon`, `stage:world`), `pickAgentName(skill)`, `openLetter` / `closeLetter`, `spawn`, `envoy` (a greeting by envoy), `gift`, `visitNeighbour`, `meeting`, `goHome`, `endMeeting`. |

## Marks (ART_DIRECTION §5)
`createMarks(ctx, world, { onChange → game.setMark(current), buildings, ignore: a folk under the cursor })`. Left click = a
pencil ✕, a closed drag = an area, an open drag = a line; Esc / right-click clears. Every `/api/command` carries the mark;
builds with `at.mode 'mark'` are placed by the sim **exactly** on it (`game.markSpot`, a minimal nudge only on overlap,
said as a notice), area kinds (field, forest, orchard, vineyard, garden, plaza; farm / grove / market by alias) fill the
outline, line kinds (road, wall, fence, river, canal) follow the stroke, a single object named for an area sits at the
centroid scaled to fit. The mark is consumed (its pencil fades) as the object's pencil sketch takes over. Marks are
disabled off the map (globe, Moon).

## The three acts
1. **Build.** Speak / type → the folk haul and hammer, pencil then paint (creation.js, on her surface).
2. **Earth's nations.** Envoys fly letters in (agents), `send_gift` walks a courier to the plot's edge, `show globe` /
   `visit_neighbour` rise to her orbit / descend to the nation's site and back, the ledger (Tab) shows attitudes.
3. **Plissé.** `go_moon` → the election letter (sim) → `voyage:start` → `stages.goMoon()` (the flight to the stand-in, the
   cross-fade into plisse.html); `moon` actions go to the landing bridge's driver when it lands; `go_home` → `voyage:home` →
   `stages.goHome()`. Space push-to-talk keeps working (the driver keeps focus out of the iframe).

## Director mode
`DEFAULT_BEATS` (web/js/director.js): descent → title → spawn (**= the whole opening now**: `hooks.spawn` runs `opening.run({ auto: true })`, the best diplomat is picked by itself, ~36 s; the later "make X our minister" beat is then a plain re-appointment) → house → windmill (pointer) → baking (letter) → open it →
minister → lighthouse (cliff) → duck (lake) → envoy → letter → bread → show the neighbours → home → meeting → end →
rocket → the Moon → seed → golden hour → home → outro. Moon utterances are functions (`say: () => '…'`) so the earth-side
intent test skips them. Live run on this Mac (2026-10-04, real Claude, the lighthouse / duck / rocket were cache hits):
**216 s** end to end, no page errors; beat starts (s): descent 2.8 · spawn 9.5 · house 12 · windmill 27 · baking 38 ·
letter 54 · minister 56 · lighthouse 65 · duck 79 · envoy 94 · bread 103 · neighbours 113 · home 125 · meeting 134 ·
rocket 147 · moon 153 (arrived 176) · seed 176 · golden 187 · home 196 · outro 209. `shots/game/director-sheet.png` is one
frame every 5 s. `tests/record/record.mjs --url 'http://localhost:8870/?director=1'` records it (`&speed=0.8` trims it
under 3 min; an uncached lighthouse adds the codegen time, ~10–60 s).

## Robustness
Every callback is wrapped; `window.__agora.errors` collects `error` / `unhandledrejection` / frame exceptions (the smoke
test asserts it stays empty). Optional modules missing → the game runs without marks / fills. Server down → offline note,
local parse for typed builds. Codegen failure → the sketch is painted. The lounge is unloaded on return.

## Verification
```
export PATH=~/.nvm/versions/node/v22.22.3/bin:$PATH
node tests/game/planet.mjs [--opening auto|play|none] [--skip-moon]   # the planet: title over her orbit (Grain), mid-descent, the low oblique landing
                                                                       #   (Gouache 1, daylight 1), fleet visit (~28°), election, ceremony (~24°), the leader
                                                                       #   view (~53°, 75 m), a house (pencil, paint, on the sphere), a drawn loop -> a lavender
                                                                       #   field on the sphere, right-drag pan / wheel / Q, show the neighbours (orbit), visit n2,
                                                                       #   home, Plissé and back; 32 checks, 0 page errors; shots/game/planet/*.png
```
`tests/game/planet.mjs` last runs (2026-10-04, mock on :8870): **32/32 in 125 s** (`--opening auto`) and **32/32 in 159 s** (`--opening play`, the election by a real click), 0 page errors; `tests/game/smoke.mjs --opening auto --skip-moon --quick` 28/29 (the known mock-parser miss: `lavender-field`); `?director=1&speed=0.6` end to end in 199 s, 0 errors (house, windmill, lighthouse, duck, neighbours, meeting, Plissé → the lounge → a seed, golden hour → home; `hooks.idle` now also waits while `stages.flying`, and a seed / the evening / "home" said during the voyage wait for the lounge); `?intro=sky` lands on the leader view. Shots `shots/game/planet/`:
`00-title-orbit`, `02-descent-mid`, `04-landing`, `06-fleet-intro`, `07-election`, `08-ceremony`, `09-leader` (`09b-leader-75`),
`10-house-pencil`, `11-house-paint`, `12-area-mark`, `13-field-fill`, `14-leader-moved`, `15-orbit-neighbours`, `16-visit-flight`,
`17-visit-n2`, `18-back-home`, `19-flight-to-plisse`, `20-plisse`, `21-leaving-plisse`, `22-home-again`; `10-fine-on` / `11-fine-off`
(the landing ground with and without the fine patch), `12-close-fine` (9 m).

### Older (the flat map, before the planet)
```
export PATH=~/.nvm/versions/node/v22.22.3/bin:$PATH
node tests/game/smoke.mjs [--intro globe|sky|none] [--opening auto|none] [--skip-moon] [--quick]   # headless, asserts no page errors; shots/game/smoke-*.png
node tests/game/opening.mjs [--url http://localhost:8893]                   # §11: the opening (landing camera, fleets, captions, the election by CLICK, ceremony,
                                                                             #   leader view, welcome letter), a busy build (>= 3 on the site), talk (mock, typed + voice
                                                                             #   routed to the folk), the inbox fanned with 7 letters; 38 checks; shots/game/op-*.png
node tests/game/drive.mjs '<url>' '<steps js>'                               # ad-hoc driver used for the shots below
node --test tests/voice/director.test.mjs                                    # the beats (updated for act 3)
```
`tests/game/smoke.mjs` last run (live, 2026-10-04): 33 checks pass in 181 s, 0 page errors, 0 recorded errors.
2026-10-04 (§11 wiring, mock on a private :8893): `opening.mjs` 38/38 in 68 s; `smoke.mjs --opening auto --skip-moon --quick` 28/29, the one miss is the mock
parser answering "this is a lavender field" with `kind:'lavender-field'` (a generated thing drawn inside the outline) instead of the catalogue's `field`
(server/mock/intent.js, not the game); director mode `?director=1&speed=0.6`: the opening auto-elects, the house and windmill beats land after it, 0 errors.
Shots: `op-01…15` (landing · squares · fleet intro · election prompt · hover · elected + ceremony · cheer · leader view + welcome · busy build ×2 · card · talk ·
voice talk · inbox), `glb-*` (the globe dive ending on the landing camera, the key skip, the crowd link), `crowd-*`, `dir-*`, `sky-01`.

Shots in `shots/game/`: `00-title` (title over the orbiting globe), `01-dive`, `02-crossfade`, `03-world-spawn`,
`04-welcome-letter`, `05/06-house pencil → paint`, `07/08-windmill`, `09–12 marks: point, house on the mark, field
pencil → paint`, `13/14-duck`, `15/16-letters`, `17-ledger`, `18-gift`, `19-globe`, `20-visit-n2`, `21-back-home`,
`22-meeting`, `23–26 the Moon (arrival, seed, golden hour, leaving)`, `27-home-again`, `30–38 real-mouse marks, typed
input, forest / road fills, the floating duck, the agent card, a live letter`, `40–43 ?intro=sky + skip`, `50–53 the pencil ✕ and a drawn ellipse → a lavender field filling it`, `director/`
(one frame every 5 s of the director run).
