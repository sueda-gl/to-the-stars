# AGORA — architecture and module contracts

Every builder reads this file before writing code. When a contract here and your instinct disagree, the contract wins. If a contract is truly unworkable, change it **here** in the same commit and say so in your report.

## Ownership
| Area | Path | Owner model | Notes |
|---|---|---|---|
| Paint engine (verbatim extraction) | `web/js/paint/` | **Opus 5.5** (visual) | Byte-faithful to the reference. Only behaviour hooks may be added. |
| Reference rebuild + fidelity check | `web/reference.html`, `tests/fidelity/` | Opus 5.5 | Must match the original pixel for pixel (see Fidelity). |
| World (terrain, water, colour bloom, neighbours' skyline, cameras) | `web/js/world/` | Opus 5.5 | |
| Buildings (Build API, prefab library, construction visuals) | `web/js/buildings/` | Opus 5.5 | Also writes `web/js/buildings/BUILD_API.md`, which the server feeds to the codegen model. |
| Agents bridge (sim agent ⇄ creature, poses, spawn, picking) | `web/js/agents/` | Opus 5.5 | |
| UI (HUD, letters, caption, agent card, minister seal, meeting) | `web/js/ui/`, `web/css/agora.css` | Opus 5.5 | |
| Simulation (pure JS, no THREE, no DOM) | `web/js/sim/`, `tests/sim/` | **Fable 5.1** (logic) | Runs in the browser **and** under `node --test`. |
| Server, LLM layer, prompts, mock mode | `server/`, `package.json`, `.env.example` | Fable 5.1 | |
| Voice, net client, action executor, game orchestration | `web/js/voice/`, `web/js/net/`, `web/js/game.js` | Fable 5.1 | |

## Runtime
- **NEVER kill or restart the shared server on :8870.** Sueda is using it live, and a watchdog keeps it up. To test server changes, run your own instance: `PORT=<free port> node server/index.js`. The watchdog restarts :8870 on its own if it dies, and it picks up new server code on its next restart.
- Node: `~/.nvm/versions/node/v22.22.3/bin/node` (the system default is 18; use 22 explicitly). npm is in the same bin directory.
- Start: `npm start` runs `node server/index.js` on **PORT 8870** (env `PORT`). It serves `web/` statically plus `/api/*`.
- Three is `web/vendor/three.min.js` (r128) + `web/vendor/Reflector.js`, both loaded as classic scripts, which gives a **global `THREE`**. All our code is ES modules (`<script type="module">`) that use the global `THREE`. No bundler, no npm packages in the browser.
- Headless check that works on this Mac: `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --use-angle=metal --enable-unsafe-swiftshader --window-size=1440,900 --virtual-time-budget=8000 --screenshot=out.png URL`. For JS-level checks, use puppeteer-core with the same Chrome binary (install it as a devDependency if you need it). Python 3 has PIL for pixel diffs.

## 1. Paint engine: `web/js/paint/` (verbatim)
Extract the reference's single closure into factories that share **one context object** so the random stream and the build order can be reproduced exactly. Required exports:

```js
// web/js/paint/context.js
export function createContext({ renderer, scene, camera, seed = 11 })
// -> ctx = { THREE, renderer, scene, camera, rnd, R, V, Y, col, ramp, L, colourOnly:[], lineOnly:[],
//            folkHidden:[],        // objects hidden during the folk pass (reference: sky, sea, pool, foam, sun)
//            reflectors:[],        // Reflectors resized to the internal paint size on resize (reference: pool)
//            reduceMotion, flags:{ closeUp:false } }

// web/js/paint/kit.js — painting kit, verbatim functions bound to ctx
export function createKit(ctx)  // -> { bake, paintMat, blob, proxy, leaf, chain, crown, pine, cypress, bush,
                                //      finishLeaves(),  // builds the InstancedMesh for every leaf queued so far; callable repeatedly
                                //      stoneTexture(), slab(x0,x1,z0,z1,y0,y1), PALETTES:{PINE,UNDER,TRUNK,CYP,LEAF,PINK,RED} }

// web/js/paint/backdrop.js — verbatim sky / sun / ridges / sea / foam / hemi + key light
export function createBackdrop(ctx, { camBase })   // -> { sky, sun, sea, seaMat, foam, hemi, key, KEY_DIR, sunDir, update(t) }

// web/js/paint/folk.js — all 7 species verbatim (geometry, materials, wardrobe, motion)
export function createFolk(ctx, backdrop, nav = referenceNav(ctx))
// -> folk = { creatures, hoppers, drops, scoots, flits, pips, floaties, allLimbs,
//             make: { puffer(i), loaf(i), drop(i), scoot(i), flit(i), pip(i), floatie(i) },   // each returns the agent record it pushed
//             update(dt, t),                    // = updateCreatures (calls every species update)
//             MOODS, wrapAngle, setCloseUp(on) }
// nav hooks (the ONLY behaviour seam). The defaults reproduce the reference exactly:
//   nav.pickTarget(a)            -> sets a.path (reference: SPOTS + route() through the arch)
//   nav.obstacles                -> array of [x, z, r]   (reference: OBST)
//   nav.bounds(pos)              -> clamps pos in place  (reference: x∈[-13,13], z∈[-13.6,16])
//   nav.extraPush(a, push)       -> world-specific pushes (reference: pool channel + arch wall)
//   nav.flyTarget(f) / nav.floatTarget(f) -> new flight routes (reference: flitTarget / floatie route)
//   nav.closeFocus               -> V(6.1, 1.1, 9.6)
//   nav.onArrive(a)              -> optional, called when a path empties (default no-op)
// Agents with a.controlled === true skip their own wandering: they keep a.path / a.wait as set from outside.

// web/js/paint/post.js — verbatim post stack + editions
export function createPainter(ctx, folk)
// -> painter = { setMode(m), get mode(), G, G_DEFAULT, CONTROLS, applyG(), resize(), markDirty(),
//                renderWorld(), renderFolk(), composite(), renderPainted(),
//                frame(dt, t, beforeDraw),  // the reference frame() body minus camera placement: held frames
//                                           // (12 fps Riso / 24 fps Gouache), the folk every frame in Gouache, Raw = plain render
//                materials:{ kuwaharaMat, edgeMat, sepMat, printMat, folkPaintMat }, internalSize:{iw, ih} }

// web/js/paint/ui.js — the reference's DOM controls (editions pill, Gouache settings, Up close), same markup and CSS
export function mountPaintUI(painter, { root = document.body, closeUp = true })

// web/js/paint/redArch.js — the reference's terrace, pool, wall, pines, cypresses, bushes, gulls (in the same order)
export function buildRedArch(ctx, kit, { origin = V(0,0,0), scale = 1 } = {})   // -> { group, pool, OBST, SPOTS, ... }
```
Rules:
- The **order of rnd() calls** in `reference.html` must equal the original, or the pixels won't match. Every module takes `ctx.rnd`. Never make a new RNG inside a verbatim path.
- **CSS**: copy the reference `<style>` verbatim into `web/css/paint.css`. Game styles go in `web/css/agora.css`.
- **Font**: Instrument Serif via Google Fonts, exactly as in the reference.
- Do not add tone mapping, bloom or colour grading. Do not change any shader string or any constant.

### Fidelity gate
`web/reference.html` rebuilds the Red arch scene **only from the modules** and supports `#gouache`, `#raw` and `?still=1` (sets `window.__STILL`, matching the original's still hook). The original's frame time depends on the clock, so the comparison forces `window.__STILL = true` and compares the first painted frame. `tests/fidelity/compare.mjs` (or `.py`) screenshots the original and the rebuild in Riso, Gouache and Raw at 1440×900 and reports a pixel diff. The pass bar is mean abs diff < 0.5/255 with no visible structural difference. Save the PNGs to `shots/fidelity/`.

## 2. Simulation: `web/js/sim/` (pure ES modules, no THREE/DOM)
```js
// state.js
export function createGame({ seed = 7 } = {}) // -> game (state below) + methods
game.state = {
  t: 0, day: 1, stage: 'camp',            // camp | hamlet | village | town | civilisation
  resources: { food, wood, stone, coin, goods },
  prosperity: 0, mood: 0,                  // derived each tick
  plot: { x0:-30, x1:30, z0:-26, z1:30 },  // your land in world units; y=0 ground
  water: [ { kind:'lake'|'sea', poly:[[x,z],...] } ],   // shared with the world module (world reads it, sim owns it)
  buildings: [ { id, kind, name, x, z, rot, footprint:{w,d}, status:'site'|'building'|'done'|'awaiting_design',
                 progress:0..1, workers:[agentId], generated:false, assetId:null } ],
  agents: [ { id, name, species, trade, skills:{building,baking,farming,crafting,trading,diplomacy,art,scouting},
              known:{skill:true}, traits:[], mood, loyalty, energy, homeId, jobId, task:null|{kind,target,...},
              x, z, status:'idle'|'walking'|'hauling'|'working'|'resting'|'striking'|'delivering'|'meeting'|'left' } ],
  letters: [ { id, from:{kind:'agent'|'minister'|'ministry'|'neighbour', id, name}, subject, body, kind, day, read:false,
               options:[{label, says}], resolved:false } ],
  minister: null | agentId,
  neighbours: [ { id, name, leaderSpecies, temperament, prosperity, attitude, x, z } ],
  log: []
}
game.tick(dt)                        // economy + tasks + moods; emits events
game.on(event, fn) / game.emit(...)  // events below
game.apply(action) -> { ok, reason?, effects:[...] }   // executes ONE validated action (schema in §4)
game.snapshot() -> compact JSON for the LLM (≤ ~2.5k tokens): resources, stage, buildings (id, kind, name, x, z, status),
                   agents (id, name, species, trade, known skills, mood band, status), minister, unread letter subjects,
                   neighbours, catalog ids that are unlocked
game.catalog                         // from catalog.js
game.findSpot(kind, near:{x,z}|null) -> {x,z,rot}   // non-overlapping placement inside the plot, off the water
```
Events the visual and UI layers subscribe to (payloads are plain JSON):
`agent:spawn {agent}` · `agent:task {agentId, task:{kind:'walk'|'haul'|'work'|'deliver'|'gather'|'meeting'|'idle'|'strike'|'leave', to:{x,z}, carrying?:'crate'|'letter'|'bread'|null}}` · `agent:mood {agentId, mood, delta, reason}` · `agent:leave {agentId}` · `building:site {building}` · `building:progress {id, progress}` · `building:done {building}` · `building:needsDesign {building, request}` · `building:remove {id}` · `letter:new {letter}` · `minister:set {agentId}` · `resources {resources}` · `stage {stage}` · `meeting:start {where:{x,z}}` · `meeting:end` · `day {day}` · `toast {text}`

`catalog.js` — the building catalogue. **IDs are fixed** (the visual prefabs use the same ids):
`house, hut, well, farm, windmill, bakery, granary, woodcutter, grove, quarry, workshop, market, dock, fountain, tavern, temple, tower, bridge, road, garden, assembly`
Each entry looks like `{ id, name, aliases:[...], footprint:{w,d}, cost:{wood,stone,coin,...}, workers:n, skill:'building'|..., buildSeconds, perDay:{food:+3,...}, housing:n, stage:'camp'|..., desc }`. `assembly` is the Red arch (unlocks at town; needs a big footprint).
Generated buildings get catalogue entries at runtime: `game.catalog.add(entry)`.

Willingness: `society.willing(agent, task) -> { yes:boolean, why:string }`, deterministic from mood, energy, loyalty, traits and skill fit, plus a small seeded jitter. A refusal produces an `agent:refuse {agentId, task, why}` event. The net layer turns it into an in-character letter.

**Mock / offline text**: `web/js/sim/letters.js` holds templated letters so the game works with no LLM at all.

## 3. Server: `server/` (Node 22, `@anthropic-ai/sdk`)
Endpoints (JSON in, JSON out unless noted):
- `GET /api/health` → `{ ok, mock:boolean, models:{logic, visual}, stt:'webspeech'|'deepgram' }`
- `POST /api/command` `{ transcript, pointer:{x,z,near?}|null, selected?:agentId, snapshot }` → `{ actions:[Action], say?:{from:'minister'|'ministry', text} }`. Logic model, **effort low**, structured output (`output_config.format` JSON schema), prompt caching on the static system prompt + catalogue. The target is < 4 s.
- `POST /api/society` `{ snapshot, recent:[...] }` → `{ letters:[LetterDraft], events:[{kind, ...}] }`. Logic model, effort medium.
- `POST /api/letter` `{ purpose:'refusal'|'skill_answer'|'report'|'reply', agent, context, snapshot }` → `{ subject, body, options? }`. Logic model, effort low.
- `POST /api/codegen` `{ request:"a lighthouse on the cliff", kindHint, snapshot }` → **SSE** (`text/event-stream`) events: `status {stage:'drafting'|'writing'|'checking'|'repairing'}`, `done {asset:{id, name, aliases, meta:{footprint, cost, workers, skill, buildSeconds, perDay, housing}, code}}`, `error {message}`. Visual model (`claude-opus-5-5`), effort high, streaming. Its system prompt embeds `web/js/buildings/BUILD_API.md`, read from disk at request time. The server checks the code is syntactically valid (`new Function`) and has no forbidden tokens; on failure it repairs up to 2 times. On success it caches to `server/data/assets/<id>.json`.
- `GET /api/assets` → the list of cached generated assets (with code) so they reload instantly on boot.
- Models come from `.env`: `AGORA_MODEL_LOGIC=claude-fable-5-1`, `AGORA_MODEL_VISUAL=claude-opus-5-5`. Use the server-side fallbacks (`betas:["server-side-fallback-2026-07-01"]`, `fallbacks:"default"`). Check `stop_reason` (`refusal`, `max_tokens`). Never send `budget_tokens`, temperature or forced `tool_choice` (all are 400s on these models).
- **Mock mode**: when no credential is set or `AGORA_MOCK=1`, every endpoint returns plausible deterministic responses (a heuristic intent parser, templated letters, a stock "tower" codegen built only from the Build API). The UI shows a small "offline mind" note. The game must be fully demoable in mock mode.
- Keys never reach the browser. `.env` is gitignored; `.env.example` is documented.

## 4. Actions (LLM → game), JSON schema owned by the server, executed by `game.apply`
```
{ type:'build', kind:<catalog id or null>, request:<free text if kind null or unusual>, name?:string,
  at:{ mode:'pointer'|'center'|'near'|'auto', ref?:<buildingId|'water'|'edge'|neighbourId>, x?, z? }, count?:1..6, assign?:[agentId] }
{ type:'ask_crowd', question:string, skill?:<skill>|null }            // folk reply by letter (skill_answer)
{ type:'appoint_minister', agentId }
{ type:'assign', agentIds:[...], to:<buildingId>|'idle'|'rest' }
{ type:'reply_letter', letterId, decision:'yes'|'no'|'other', text }
{ type:'demolish', buildingId }
{ type:'call_meeting' }
{ type:'message_agent', agentId, text }                             // you talk to one folk; they answer by letter
{ type:'trade', neighbourId, give:{res:n}, get:{res:n} }
{ type:'name_settlement', name }
{ type:'noop', why }                                                // couldn't map it; the minister replies with a note
```
`kind:null` + `request` → `building:needsDesign` → net layer → `/api/codegen` → `game.catalog.add` → site completes when the asset is in.

## 5. Build API: `web/js/buildings/api.js` (+ `BUILD_API.md`)
`createBuildApi(ctx, kit)` → `api` with the **only** surface that prefabs *and generated code* may use. Generated code is `function build(api) { ...; return group; }` and runs through `new Function('api', code + '\nreturn build(api);')`. It has no access to window, document, fetch or THREE except through `api.THREE` (for Vector2/Shape/curves). It must provide primitives (box, cylinder, cone, sphere, lathe, extrude, gable / hip / dome roofs, arch openings, columns, stairs, ink-dark windows and doors, fences, wheels, sails), materials in the reference grammar (`api.paint(geo, ramp)`, `api.lambert(hex)`, `api.clay(base, shade, deep)`, `api.ramps.*` palettes), `api.proxy(geo)` for keylines, `api.colourOnly(obj)`, and `api.group()`. Ground is y=0, the footprint is centred on the origin, 1 unit ≈ 1 m, and a folk is about 1.3 units tall. The docs file must be self-sufficient for a model that never saw the code, with 2 worked examples.

Prefabs: `web/js/buildings/prefabs/<id>.js` export `build(api)` (+ optional `meta`, `animate(obj, t)`) for every catalogue id. `web/js/buildings/library.js` `createLibrary(ctx, kit, { api })` exposes `{ load(), has(id), ids(), create(id|asset, { rot, variant }) -> THREE.Group, register(asset) -> {ok, id, error?}, animate(obj, t), update(t), release(obj) }`; pass the building's `rot` to `create` (the painted light is baked per quarter turn) and always remove with `release`. Construction visuals: `web/js/buildings/construction.js` → `createSite(building, group, { ctx, api })` returns `{ object, reveal, setProgress(p), finish() -> Promise, reset() }` (amended: it needs ctx + api). It shows stakes, a scaffold and a crate stack; the building is drawn in pencil at once and the paint wash climbs with the progress. Details: `docs/buildings.md`. (Amended 2026-10-04: `create(id, { rot, variant, fit:{w,d}, compact })` — objects come out in a COMPACT form, parts merged per material, which a reveal expands and re-compacts; `fit` scales a single object to a drawn area; generated floating things call `api.floats(g)`. `fill.js` §10 is implemented by the buildings track.)

## 6. World / agents / UI (visual layer)
- `web/js/world/world.js` `createWorld(ctx, kit, game)` builds the cream paper ground for the plot, the surrounding land, the water from `game.state.water` (lake via the verbatim Reflector + PoolShader, the far sea via the verbatim seaMat), the neighbours' distant settlements (prefabs, already coloured), and the **colour bloom** (cream → painted ground around finished buildings). It exposes `pick(clientX, clientY) -> {x,z}|null`, `cameraRig` with `descent()` (sky → plot), the RTS controls (drag pan, wheel zoom, right-drag or Q/E rotate), and `upClose(target)` for meetings.
- `web/js/agents/agents.js` `createAgents(ctx, folk, game)` maps sim species `puffer|loaf|drop|scoot|flit|pip|floatie` → `folk.make.*`, applies the spawn animation, maps sim tasks onto `a.path`/`a.wait` (controlled), adds carry and work poses (crate in arms, hammering, letter held aloft), handles `pickAgent(clientX, clientY) -> agentId|null`, and does the courier walk-to-camera for letter delivery.
- `web/js/ui/*` holds the HUD, letter tray and letter reader, live caption and mic pill, agent card, minister seal, notices and meeting overlay. It is styled with the reference tokens (`--paper #f3ecdc`, `--ink #3d5588`, `--red #e0503f`), Instrument Serif and the pill buttons, with riso inks for accents (`#f15060`, `#ffe800`, `#0078bf`).

## 7. Orchestration: `web/js/game.js`, `web/index.html`
`index.html` loads the vendored three, `css/paint.css` and `css/agora.css`, then `js/game.js`. game.js wires: renderer → `createContext` → `createBackdrop` → `createKit` → `createWorld` → `createFolk(ctx, backdrop, gameNav)` → `createPainter` → `createAgents` → `createGame` → UI → voice → net. It runs the loop (`painter.frame`) and the sim tick, and routes events.

## 8. Phase-2 additions (hackathon priorities, see the CONCEPT.md PRIORITIES)
- **Generalised creation.** The `build` action covers *any* object (`kind` = catalogue id or null + `request`). The catalogue gains a `category: 'building'|'prop'|'landmark'|'nature'`. Generated assets can be anything.
- **Massing sketch**: `POST /api/sketch { request, snapshot } → { name, footprint:{w,d}, height, parts:[{shape:'box'|'cylinder'|'cone'|'sphere'|'gable'|'dome', x,y,z, w,h,d|r, rot?, color:'#hex'}] }`, ≤ 16 parts; `x,y,z` is the **centre** of each part's bounding box (as the Build API primitives), `rot` in radians. It is fast (logic model at effort low, or the mock), and the client renders it with the Build API.
- **Pencil → paint reveal** (`web/js/buildings/reveal.js`): object states `sketch` (its meshes are pushed to `ctx.lineOnly` only and stay invisible in the colour pass, so it draws as pencil keylines on the paper), `painting` (a ground-up colour reveal by part bbox, or a clip plane), and `done`.
- **Codegen speed**: try `speed:"fast"` + beta `fast-mode-2026-02-01` on `claude-opus-5-5`, and fall back to standard on 429 or error.
- **Typed command fallback**: the same `/api/command` path as voice. The UI has a text field (press Enter), and its example chips submit text directly.
- **Director mode** `?director=1` (`web/js/director.js`): a scripted sequence of beats. Each beat has a caption, an utterance (shown as if spoken, then sent through the normal command path) and waits, plus camera moves. It is used to record the demo video with `tests/record/record.mjs`: puppeteer CDP screencast → ffmpeg (installed at /opt/homebrew/bin/ffmpeg).
- **Neighbour diplomacy visuals**: envoys fly between the neighbour towns and your plot carrying letters. `send_gift` / `trade` actions make a courier walk or fly to the horizon. `visit_neighbour {neighbourId}` makes the camera fly over to the neighbour's town and back.

## Conventions
- No external runtime deps in the browser. Keep the server deps to `@anthropic-ai/sdk` (and `ws` only if the Deepgram relay is added).
- ES modules, 2-space indent, terse comments in the reference's voice.
- Each owner ships a short `docs/<area>.md` covering what's there and how to test it.
- Screenshots go in `shots/<area>/`. Look at your screenshots before you claim visual work is done.

## 9. Phase-3 contracts (story, diplomacy, moon); both sim and server implement these exactly
New actions (they extend §4; the server schema and `game.apply` both support them):
```
{ type:'send_gift', neighbourId, gift:string, give?:{food|wood|stone|coin|goods:n} }   // a courier physically walks/flies to the horizon
{ type:'visit_neighbour', neighbourId }      // the camera rises to the globe and dives to that nation, then returns (UI/camera only; sim logs it)
{ type:'go_moon' }                           // if not yet elected: an election letter from all 3 nations arrives within ~3 s, then the voyage starts
{ type:'moon', do:'seed'|'golden_hour'|'daylight'|'greet'|'gift'|'go_home', text?:string }   // only valid when scene==='moon'
{ type:'show', target:'globe'|'home' }       // pull up to orbit / come back down
```
Every `/api/command` request carries `scene:'earth'|'moon'`, and the prompt maps speech accordingly. On the moon, "offer them a seed" → `moon seed`, "wait for the evening" / "golden hour" → `moon golden_hour`, "we come in peace" → `moon greet` (the shadelings answer by letter), "let's go home" → `moon go_home`.
New sim events: `gift:send {neighbourId, gift, carrierId}` · `gift:arrive {neighbourId}` (→ a thank-you letter + attitude up) · `envoy:send {neighbourId, letterId}` (a neighbour letter arrives *carried*: the visual layer flies a flit/floatie in from the nation's horizon direction and lands it, and the letter enters the tray on landing) · `neighbour:visit {neighbourId}` · `election {votes:[neighbourId...]}` · `voyage:start` · `voyage:home` · `moon:do {do, text}`.
Horizon directions: `geography.js` exports each nation's flat (x, z). The direction from the plot centre to the nation is where envoys and couriers enter and leave the map.
Generated assets may be **any object** (category 'prop' | 'landmark' | 'nature' | 'building'). Resolve the noun only: strip location tails ("near the house") before matching catalogue aliases, and an explicit `kind:null` from the LLM is trusted.

## 10. Marks (cursor marking, see ART_DIRECTION §5)
`web/js/marks/marks.js` **createMarks(ctx, world, { onChange })** returns:
- `current()` → `null | {kind:'point', x, z} | {kind:'area', poly:[[x,z]...], centroid:{x,z}, bbox, areaM2} | {kind:'line', pts:[[x,z]...], length}`
- `consume(markId)` (the mark fades into the painting), `clear()`, `list()`, `setEnabled()`
- Input: left click marks a point; left-drag draws a closed area (auto-close when the end is near the start, or treat as a line otherwise); right-drag, WASD and edge scroll go to the camera. The marks are drawn as pencil lines on the ground (lineOnly keyline geometry, or a ground decal that reads as pencil through the gouache pass).

`web/js/buildings/fill.js` **createFillers(ctx, kit, api, { trees })** returns:
- `field(poly, {crop})`, `forest(poly, {density})`, `garden(poly)`, `plaza(poly)`, `vineyard(poly)`, `road(pts, {width})`, `wall(pts)`, `fence(pts)`, `river(pts)`
- Each returns a THREE.Group ready for the reveal (pencil → paint) and painted in the Red arch grammar.

Commands carry the mark: `/api/command` gets `mark` (the current mark summary). The command prompt maps "here / there / this / that" to `at:{mode:'mark'}` when a mark exists. Area-kinds (farm / field / grove / forest / garden / road / wall / ...) become `{type:'build', kind, at:{mode:'mark'}}`, and the game fills the mark's shape. The sim stores `shape:{poly|pts}` on the building and places it **exactly** at the mark (a minimal nudge only when overlapping).

## 11. Arrival, fleets, minister, jobs, ventures, talk (ART_DIRECTION §11; sim + server implemented 2026-10-04, see docs/sim.md, docs/server.md)
Sim contracts the visual / UI / orchestration layers build on:
- `game.spawnAll()` now also **forms the fleets**: `fleet:form { fleets:[{ id, name, trade, members, centre:{x,z}, slots:[{agentId,x,z}], caption }], focus }` (square grids, 1.6 m apart, on an arc in front of the landing spot on the camera side); the folk walk to their slots (`agent:task walk` + `formation:true`) and stand (`idle` + `formation:true, fleetId`).
- The orchestrator runs the intro: `game.introduceFleets()` → the order; the sim then emits `fleet:introduce { fleetId, index, total, name, caption, members, centre }` every 3.4 s (the camera visits the square, the UI shows the caption card, members hop via `agent:listen { hop:true }`), then **`election:ask { kind:'minister', candidates, text }`** ("Choose your minister: click one of them."). The click → **`game.electMinister(agentId)`** (= `apply appoint_minister`) → `minister:set { agentId, by }`, `election:result`, **`ceremony:start { agentId, name, where, seconds }`** … `ceremony:end`, `fleet:release`. Not driven within 14 s → the sim runs the intro itself; no click for 90 s → the folk go to work (the ask stays open); 150 s → the crowd votes (`game.crowdElection('minister')`, `election:result { by:'crowd', votes }`, a Ministry letter kind `election_result`).
- Every agent has `job` (label; snapshot `work`), `workplaceId`, `campRole`, `fleetId`; camp work is `agent:task gather|work|haul` with `camp:true, role`; the minister inspects (`idle` + `inspect:true`). A site's crew is 3–6 at once.
- Ventures: `venture:propose|start|decline|done`, letters of kind `venture` (yes / no), `agent:say` bubbles.
- **Talk**: click a folk → `POST /api/talk` with `game.talkContext(agentId, text)` → `game.talk(agentId, text, result)` (or `game.talk(agentId, text)` offline) → **`agent:say { agentId, text, kind, ttl }`** = the paper speech bubble above that folk (the agents / UI layer draws it; `kind` is `talk | idle | done | ceremony | venture`). Spontaneous `agent:say` lines come ≈ 3 a minute.

Amended 2026-10-04 (server + sim, implemented; docs/server.md, docs/sim.md):
- The catalogue carries `shape: 'point' | 'area' | 'line'` per kind. Area kinds: `field, forest, orchard, vineyard, plaza, garden`; line kinds: `road, wall, fence, river`. `farm` and `grove` stay point prefabs (`field` / `forest` are no longer their aliases).
- The server answers `at: { mode:'mark', x, z, mark }` where `mark` is the **full** normalised mark it received (polygon / stroke / `id` kept, only the summary went to the model). A `pointer` answer while a mark exists is promoted to `mark`; a `mark` answer with no mark falls back to `pointer`. Send `marks.current()` (poly / pts included) as `mark`, or the summary plus `game.setMark(marks.current())` before `apply`.
- `game.apply(build)` with `at.mode:'mark'` reads `at.mark`, else `game.state.mark` (`game.setMark`). Results carry `effects[{type:'mark', used:true, kind, id, markId}]` (→ `marks.consume(markId)`), `{type:'nudge', from, to, dist, why}` when a marked point had to move (≤ 8 m, never further) and `{type:'overlaps', ids}`. Buildings get `shape` (`{poly, bbox, centroid, areaM2}` / `{pts, bbox, length, width}`), `x/z` = centroid / midpoint, `rot` = the stroke's heading, `footprint` = the bbox for shaped kinds. Area / line kinds without a mark get a default rectangle / straight strip in `shape`, so a filler always has geometry. Folk work inside the outline / beside the stroke (`siteSpot`).
