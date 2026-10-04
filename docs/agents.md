# Agents bridge (`web/js/agents/`)

Sim agent ⇄ painted creature. Each sim folk becomes a verbatim Red arch creature (`folk.make.*`). The sim drives where they go, and the bridge adds the story poses **on top of** the reference motion: the fly-in arrival, walking and flying, carrying, hammering, letters, strikes, leaving, celebrating and listening. Every pose is an override applied **after** `folk.update()` each frame.

**Our people are only the two fliers (ART_DIRECTION §7): flits and floaties, and they walk AND fly.** Every settler becomes a flit or a floatie (a sim flit / floatie keeps its kind; anything else becomes whichever of the two we have fewer of, so 12 settlers are 6 + 6). They arrive from the sky in a staggered flock and land, walk for work (hauling, hammering, queuing with a letter) and fly to travel, celebrate and leave. **The other five species are the neighbours' peoples**: envoys walk in from the plot edge toward their nation — drops from the Drop Riviera (n1), loaves from the Loaf Republic (n2), puffers / pips / scoots (in turn) from the third nation (n3) — hand the letter over and walk back.

The one behaviour change in `folk.js` is the **`a.driven` seam**: `updateFlits` / `updateFloaties` skip a flier whose record has `driven = true`, and `createFolk` also returns the shared leg rig (`stepLegs`, `poseLegs`). Nothing in the reference sets `driven`, so the fidelity gate stays at 0 diff (all 6 cases mean 0/255, max 0; folk positions and headings max diff 0) and the verbatim audit is unchanged (0 unexplained lines).

| file | what |
|---|---|
| `agents.js` | `createAgents(ctx, folk, game, world?, opts?)`: the bridge, plus a re-export of `createAgentNav` |
| `fliers.js` | `createFlierMotion(ctx, folk, { props, groundY, isWater, grounded })`: our fliers' other half. Walking on planted feet, landing, taking off, the long glide down from the sky; decides walk vs fly per trip |
| `props.js` | `createProps(ctx, folk)`: crate, basket, envelope (red wax seal), mallet, protest placard, nub arms for scoots/flits, and the paper-dust pool. Clay cel (`folk.cloth`), shared geometry, layers 5+6 |
| `nav.js` | `createAgentNav(game)`: a `createFolk` nav for a plot without the arch. Plot bounds, buildings as round obstacles (kept in sync by the bridge; fields, gardens, plazas and roads are walkable), no pool or wall |
| `identity.js` | `createIdentity(ctx, folk, props)`: who is who. Per-folk flying gear and clothes by trade, the minister's seal; additive accessories only, baked to ~1 draw call per colour (ART_DIRECTION §11) |
| `fleets.js` | `createFleets(B)`: squares by trade, the roll-call (step forward, hop, wave), the minister's ceremony. Follows the sim's `fleet:*` / `ceremony:start` events, or runs standalone (`agents.formFleets`) |
| `work.js` | `createWork(B)`: visible work. Build sites (the crew + helpers: haul, drop on piles, hammer, hand planks up, flap round the scaffold), workplaces (hoe, knead + loaves, chop, pick, sell, dock), the camp (forage / gather), couriers' post rounds |
| `bubbles.js` | `createBubbles(ctx, { project })`: the paper speech bubbles, a DOM overlay over the folk's heads (through her lens); they yield to letter tags |
| `colour-rule.js` | `applyColourRule(rec, folk)`: ART_DIRECTION §13, no green and yellow on one creature (re-dyes the reference's yellow caps / brims / blades in our layer) |
| `portraits.js` | `createPortraits(ctx, folk, { get })`: each folk's painted head-and-shoulders portrait (offscreen render, Kuwahara, keyline, paper circle), cached per folk (§14) |
| `pins.js` | `createPins(ctx, …)`: letters living in the world as **tiny paper tags** over the sender (§15): portrait, name, one line, 2–3 quick replies; at the leader view knots of senders fold into **stacks** that fan out on a click, leader lines, never overlapping |
| `../../agents-lab.html` | the lab: real paint engine, relief ground, real sim, buttons for every behaviour |
| `../../../shots/agents/shoot.mjs` | the review shots in Gouache into `shots/agents/`: `bird-*` (leader view), `close-*`, `seq-*` (8-frame take-off / landing strips) |
| `../../../shots/agents/check.mjs` | 30 functional checks with the real sim |
| `../../../shots/agents/pins-check.mjs` | 29 checks for §13 / §14 / §15 (colour audit of settlers and 18 envoys, portraits, letter tags with real mouse clicks on a reply, the tag and the folk) on the running :8870 server |
| `../../../shots/agents/jitter/record.mjs`, `analyse.mjs`, `strip.mjs` | the §15 motion probe: records every folk's rendered pose per frame in the real game (clock pinned to 1/60 s), reports jitter by state, and a one-frame-at-a-time strip + onion skin |
| `../../../shots/agents/leader-tags.mjs` | the tags + bubbles at the 64 m leader view in the running game: stacks, the fan (a real click), the screen edge, close up, the overlap audit (`shots/agents/leader/`) |
| `../../../shots/agents/tags-game.mjs` | the tags on real-shaped sim letters in the running game (`tags-game.png`, `tags-game-close.png`) |
| `../../../shots/agents/probe.mjs` | ad-hoc driver: `node shots/agents/probe.mjs '<async js>' out.png` against the lab on :8870 |

## Walking and flying (`fliers.js`)
A flier is always in one of five modes (`rec.mv.mode`):

| mode | who writes the creature | what you see |
|---|---|---|
| `air` | folk.js (reference flight: route, bob, bank, pendulum, dangling legs) | cruising; fliers.js only watches for the landing spot and slows the approach |
| `land` | fliers.js | drifts over the spot and comes down (flits 0.5 s + 0.17 s per unit of height, smoothstep; floaties 0.9 s + 0.3 s/unit, easing out). Legs reach for the paper and compress on contact; the propeller winds down to a quarter; the floatie's parasol leans back. Touchdown: a squash that springs back and a small ring of paper dust |
| `ground` | fliers.js | walks like a pip on the shared leg rig (`folk.stepLegs` / `poseLegs`): feet stay planted, the body dips on each footfall and rises with the swinging foot, sways side to side. The propeller spins down and stops; the floatie holds the parasol over its head tilted back as a sunshade (the body stays upright under it, the canopy sits behind), its free arm swinging with the steps. The heading follows the path only (≤ 4.2 rad/s, eased); crowding is a sidestep against every walker and grounded flier (0.95 m, +0.25 for each parasol; standing folk only shuffle for a real overlap), building obstacles, plot bounds; held off its spot by the crowd, it stops where it is. Idle: looks at you now and then, a flit gives its propeller a twirl, a floatie waves |
| `lift` | fliers.js | a 0.16 s crouch while the propeller spins up, then a hop and a rise to just above folk.js's floor (flits in 0.75 s, ease-out; floaties in 1.15 s while the parasol rights itself), legs left dangling. Hands over to folk.js at the same height and bob phase, so there is no pop |
| `glide` | fliers.js | the Act 1 arrival: a quadratic curve from ~9–11 units up and ~12–16 beyond the spot (in the direction the camera looks, so they come in over the far side of the view) down to just above it, with a leaf-like side drift, then `land` |

**Walk or fly** is decided per trip (`fm.go`): a trip longer than `walkMax` or one that would cross water is flown and landed; anything shorter is walked. `walkMax` by sim task: `haul` / `work` 18, `walk` / `gather` / `strike` / resting 9, a courier's run to the lens 9. Gifts and departures always fly and never land (`land: false`). Landing spots are moved off water (`dry`). Listening freezes a flier in place (`fm.hold`): planted feet on the ground, a hover in the air; the trip carries on afterwards.

**Calm motion (ART_DIRECTION §15: "the creatures are lagging, glitching, buzzing").** Measured in the real game (`shots/agents/jitter/record.mjs`, clock pinned to 1/60 s, 80 s from the landing through the fleets, the roll-call, the ceremony and the first work; RMS of the frame-to-frame second difference, i.e. what changes direction between frames):

| | position | heading | direction reversals | heading flips |
|---|---|---|---|---|
| before, all states | 3.52 mm | 9.64 mrad | 0.08 /s | 0.11 /s |
| before, standing in the squares (fleets) | 5.71 mm | 13.94 mrad | 0.20 /s | 0.20 /s |
| after, all states | **0.56 mm** | **3.21 mrad** | **0.02 /s** | **0.07 /s** |
| after, in the squares | **0.57 mm** | **2.17 mrad** | 0.05 /s | 0.10 /s |

The worst single folk before (a floatie walking back to its slot during the election) swung its parasol ±0.2 rad every 3–4 frames (~8 Hz) for 9 s: `shots/agents/jitter-before.png` (16 consecutive frames + onion skin, smeared) vs `jitter-after.png` (sharp; the busiest folk after is the minister floating up). The causes, all in the ground walker and the pose pass:
1. **Two controllers summed into the heading.** The walker turned toward path + crowd push; near a spot they cancelled and the heading flipped every few frames; a floatie's canopy is offset by the heading, so it zig-zagged 4–5 cm. Now the heading follows the **path only**, the turn rate is capped (4.2 rad/s) and eased in and out (critically damped, so a walk never starts or stops with a kink); the crowd is a sidestep velocity that never turns anyone.
2. **Fleet slots inside the crowd radius.** The sim's squares are 1.6 m apart, the crowd radius was 1.7 m for two floaties, so neighbours pushed forever and a folk walking back to its slot never arrived (`arrived` never true; it hunted round the slot until the squares broke). Now the radius is 0.95 m + 0.25 per parasol (1.45 m for two floaties), standing folk only make room for a real overlap (> 0.2 m), and a walker held off its spot by the crowd stops where it is after 0.7 s without progress (within 1.3 m).
3. **The `moving` threshold flickered.** A folk easing into its spot crossed 0.25 m/s back and forth, so the facing (work site / camera / the minister) switched on and off. Now it has hysteresis (on at 0.25, off at 0.12), and a walker with a path always faces its path (it used to keep a work facing while setting off and shuffle sideways at 0.15 m/s).
4. **Facing turned the canopy about the wrong point.** The pose pass rotated a driven floatie after `write()` placed its canopy: the body swung round the parasol tip. `fm.seat(rec)` re-seats the canopy behind the body for the new heading; the facing turn is rate-eased too.
5. **Pops.** Touchdown squashed 30 % in one frame (now eased in over 4 frames, 22 %); floaties left the cruise with a 3 cm first-frame drop (now smoothstep); the hello-hop fired on top of the touchdown squash (now 0.32 s later, as does the hop after a celebration); a walker that took off stopped dead from 1.2 m/s (now slows over the crouch); the talking wiggle ran at 2.7 Hz (now 1.3 Hz, smaller).

Not ours, noted for their owners: the painter repaints the world (and places the camera, `world.beforeDraw` → `rig.place`) at 24 fps while the folk are drawn every frame, so a moving camera judders on a 60 Hz screen (2-3-2-3 frames); and the folk Kuwahara (`paint/post.js`, `folkPaintMat`) warps with screen-fixed noise, so the brush pattern crawls over a moving folk. Neither is touched here (web/js/paint and the world are not this module's).

**Celebrating** (`celebrate`): a little looping flight round the spot and back down on it, a hop on landing. When a building is done, ~75% of the folk within 14 units fly one, staggered 0.35 s apart. A mood lift of +8 or more does it too (+4..7 is a hop), and an idle folk with mood ≥ 62 does it now and then (on average every 30 s once it has stood idle for 8 s). It holds the `joy` lock (≤ 25 s); a task that arrives meanwhile waits in `pending`.

## Who is who (`identity.js`, ART_DIRECTION §11 "Individuality")
Every settler (and every stand-in gift carrier) is dressed once, right after `folk.make.*`, from a hash of the sim agent (id + name) and the order folk of its species were dressed. A seed replays the same crowd; `ctx.rnd` is never touched. **Additive only**: the Red arch creatures are not moved or hidden, and `folk.js` is untouched; the one exception is the colour rule (§13, below), which swaps the material of a reference cap / brim / blade that is yellow on a green folk. Everything else is extra clay-cel pieces (`folk.cloth`) on FACE_LAYER 5 + MASK_LAYER 6.

| | flits | floaties |
|---|---|---|
| flying gear (per folk) | rotor: `classic` (the reference's 2 blades), `tri` (a stacked 3-blade top rotor), `double` (a counter-spinning second rotor on a longer mast), `cross` (+ a bar = 4 blades), `tips` (painted tip paddles); a painted hub finial; flying goggles (brass rims, aqua glass, a leather strap); a tail-fin; a knit beanie under the propeller (only for trades with no hat) | parasol overlay: `gores` (the reference + a painted hem), `wide` stripes, `polka` dots, `scallop` fringe, `two-tone` halves, a painted `ring`; tassels; a painted handle sleeve with two bands and a finial; a sun-visor (trades with no hat) |
| clothes by trade | builder: coral hard-hat band + peak + lamp, tool belt (pouches, hammer). crafter: leather apron + belt. baker: toque + white apron. farmer: straw-hat brim + ribbon, seed satchel. courier/scout: red messenger satchel + fluttering scarf. trader: teal neckerchief + coin purse. diplomat: plum sash + rosette. scholar (artist, dreamer): round glasses + quill | the same trades as small hats on the head (hard hat, toque, straw hat), belts, aprons, satchels, sash, glasses + quill; **plus a trade pennant on the parasol tip** in the trade's colour, because from straight above a floatie is its parasol |

Every style shows up within the first five flits / six floaties (the style is dealt by dressing order, the colours by the hash). Palette: the reference's own (`PAL`: red, cobalt, yellow, plum, cream, teal, pink (called *coral* in words), green, ochre, navy, aqua, straw, tan...). Trade colours (`KIT_COLOUR`): **builder coral** (was yellow, §13), crafter leather, baker crust, farmer green, courier red, trader teal, diplomat plum, scholar cobalt.
- The minister wears the red wax seal on a red ribbon (`minister:set`, the ceremony).
- A trade change (a new job, an entrepreneur's venture) re-dresses the trade layer only (`idn.step` notices `sim.trade` changed).
- **Baking**: the pieces that never move on their own are merged per parent (body / rotor / canopy / handle / each moving group) and per material into one mesh; striped cloth keeps its own mesh (the stripe shader reads object space). 12 dressed folk: 257 meshes under the roots (was 377 unbaked), ~375 draw calls for a lab frame.
- `agents.identity(id)` → `{ species, kit, trade, gear, extras[], outfit, colour, rotor, canopy, words }`, e.g. *"a double rotor in cobalt blue, flying goggles, a red tail-fin, a hard-hat band and a tool belt"*: the UI card's line.

## The colour rule (`colour-rule.js`, ART_DIRECTION §13): no green and yellow on a creature
- **Flits never wear yellow.** identity.js no longer deals yellow to a flit (rotor, hub, fin, beanie, scarf, accents); its gold / straw pieces are swapped as they are made (`NO_YELLOW`: yellow → cream, ochre pouches / brass goggle rims / seeds / coin purse → tan, the straw hat → cream). Builders wear **coral** hard hats (both species, so the trade still reads by colour from above). The minister's seal centre is cream.
- **Floaties** keep any accent, but a floatie wearing anything green (a green canopy, the farmer's green pennant, a teal suit or parasol from the reference) gets no yellow either (`L.noYellow`).
- **The reference's own pieces** (`folk.make.*` stays verbatim): its random cap colours include `['#2f62d8', '#f2c14e']` and `['#f2c14e', '#e2483a']`. `applyColourRule(rec, folk)` runs right after `idn.dress` (and after a re-dress): the skin is the first painted mesh on the body (clay `uBase` or the puffers' cel `uLit`) and is never touched; on a green skin every yellow / lemon / gold / straw accessory (hue 36–68°, saturated) is re-dyed, on a yellow skin (puffers) every green one, on anything else wearing both (a floatie) the yellow one. The new colour is an approved accent (red `#e2483a`, blue `#2f62d8`, cream `#f4ead6`, violet `#7a3d8c`, coral `#e85a71`, teal `#2b8a7a`; never teal on a yellow body) the folk isn't already wearing, so cap and brim stay two colours, and one yellow becomes one accent on that folk (cap, brim and blade together). Plain cloth uses the shared `folk.cloth` cache; striped / knit / clipped garments get a re-dyed clone that shares the key light. The neighbours' envoys get the same pass in `makeFolk` (pips are green, puffers yellow).
- Carried props: the basket's wicker is browner, the "lemon" in it is an orange, the sack is a greyer burlap, so nothing yellow rides on a flit.
- `agents.colourRule(id)` → `{ skin, swaps: [{ from, to }] }` (the lab's **Colour rule** sheet lists them). The audit in `pins-check.mjs` scans every settler and 18 envoys.

## Letters in the world, portraits (`pins.js`, `portraits.js`, ART_DIRECTION §14)
**Portraits.** `agents.portrait(id, { size = 96, bg = 'paper' | 'none', ring = true })` → `Promise<dataURL | null>` (it waits up to 30 s for a folk that hasn't landed yet); `agents.portraitNow(id, o)` → `dataURL | null` synchronously. The folk is cloned exactly as dressed (its body colour, rotor / parasol, clothes, the minister's seal; held props and nub arms left out), posed at rest (propeller blades across; a floatie's **parasol tipped back behind its head like a halo**, the handle left out, so its pattern reads), rendered offscreen at 3× with a fixed 3/4 front camera lit by the scene's own key light, then painted on the CPU: a small Kuwahara (brush patches), a soft ink keyline round the silhouette, paper tooth, on a paper circle with a warm wash and a hairline ink ring (`bg: 'none'` gives the cut-out on transparency). The renderer's state (target, clear colour, shadow-map flags) is restored, so it can be called any time. ~40 ms per portrait the first time, cached per folk and size; `agents.portraitRev(id)` changes when the look changes (a new trade, the minister's seal) and the next call re-renders. Readable from 40 px (notifications) to 96 px (letter header).

**Letter tags** (§15, replacing the §14 envelopes; calm at the leader view since 2026-10-04, §19). `agents.letterPin(target, { letterId, unread = true, onOpen, onReply, onClick, from, subject, gist, replies, portrait, initial, minister })`:
- `target` is a sim agent id (or an envoy / temp id), or a point `{ x, z, y? (absolute), h? (above ground, default 2.2) }` for a building or a nation's road.
- **A tiny rectangular paper tag above the sender's head, and nothing else**: the sender's painted portrait (18 px; a red wax initial for a point target such as the Ministry *M* or a nation), the **name**, **one line** (`gist`, else `subject`; at most 40 characters, cut on a word with …), and **2–3 quick replies** as tiny underlined italic words (`replies`: a letter's `options` `[{ label, says }]` or strings; labels shortened to a word or three: *Send a gift (3 goods or 3 coin)* → *send a gift*, *Understood, rest then* → *understood*). ~120–260 × 44 px close up (12.5 px type), **~1.22× at the 64 m leader view (15 px type)**: the size is set by font size (`--s` on the tag, every length in `em`), never by a scale transform, so the text stays crisp; it changes in steps of .02 so the tag is not re-laid out every frame. Paper `--paper`, hairline ink edge, a hairline **leader line** down to the head; the fonts follow the UI's `--ag-font-text` / `--ag-font-display`. **The minister** (`minister: true`, or the folk who holds the seal) has the name in red and a red ring round the portrait.
- **A reply word** calls `onReply(letterId, says, { agentId, label, index, screen, rect })`, exactly what the letter's own options do (the game's `onLetterOption(id, says)`: `game.markRead(id)` + `commands.handle(says)`); the chosen word turns red with a tick, the others fade, and the tag folds away 1.1 s later (return `false` from `onReply` to keep it). **The tag body** (portrait / name / line) calls `onOpen(letterId, { agentId, target, screen, rect })`: the game opens that letter in the top-right inbox. `onClick` (the old envelope callback) is used when there is no `onOpen`. Pointer events stop at the tag (no pencil mark, no folk card).
- **Stacks** (the leader view: several senders standing together). From 28 m out, tags whose anchors are within an ellipse of ~84 × 46 px (× the size) of each other on screen are one knot (single linkage; a knot holds until they are 1.3× further apart, so it does not flicker at the edge). A knot shows **one stack tag**: up to three overlapped portraits (the minister's with a red ring), **"3 letters · Olla, Pippo, Momo"** (the count is the unread letters, else all; up to three names, the minister first in red, then unread, then newest; read names paler; *+n* for more), drawn as a little pile of paper (two sheets peeking out behind), with a hairline leader line to **every** sender's head. **A click fans it out**: the individual tiny tags in two columns beside the knot (the left column left of its senders, the right column right of its), each with its own leader line; the column's top tag goes to its farthest sender, so lines never cross and never run through a tag of the same column; side and row are fixed when it opens (folk walking about do not shuffle it; a newcomer joins at the top of the shorter column). **Esc or a click anywhere else folds it back**; zooming in until the knot falls apart does too. Close up (< 28 m) there are no stacks, only single tags. `agents.pinStacks()` → `[{ id, count, text, members: [{ agentId, from, minister, unread }], rect, opacity }]`; `agents.expandStack(stackId | agentId)`; `agents.collapseStacks()`.
- **Placement**: a DOM marker (`.agt-layer`, z-index 9, under the UI's 10) placed every frame, easing (never popping) toward its slot. **Priority**: the minister's tag first, then unread, then read; then the newest, then the nearest. In that order every tag and stack takes the first good slot round its anchor (straight up, higher, up-left / up-right, beside, further out: 21 candidates), with a leader line back to its sender (+ a small dot on the head when it stands off by more than 14 px). **Tags never overlap each other**: a slot on a tag already placed is ruled out (it costs 10⁶); a slot over a folk's screen box costs its area (a floatie is two boxes: canopy and body), and one off the top or bottom of the view costs too. It keeps its slot unless that slot is ruled out or another is clearly better (> 1600 px² less folk covered), and after a move it holds for 0.8 s: a folk walking under a tag for a moment is fine (the leader line says whose tag it is), a hopping tag is not. Straight up wins back as soon as it is clear. Kept inside the view sideways. z-order: open fans on top, then priority, then distance.
- **The lens** (the game on her Tower Planet): her post bends the frame with a fisheye (`uFish .38`), so a plain `camera.project` is off by ~25–36 px near the edges (measured: 36 px at x ≈ 130, `lens-edge.png`) and a tag would point at the folk next to its sender. With `world.adapter` + `world.planet`, the bridge projects every tag, stack, leader line, bubble, `agents.screenOf(id)` (the card, the talk) and the folk boxes through `adapter.toScreen(x, y, z)` (flat point → the sphere → `planet.toScreen`, her inverse lens), and `agents.pickAgent` un-bends the click through her `fish()` before the ray. And because her camera is placed inside `planet.frame`, the overlays are placed in her **`afterFinish` hook** (after the folk pass put the folk back in flat space), on this frame's camera, not last frame's. Flat worlds (the agents lab) keep the plain projection, placed in `agents.update`.
- **Zoom**: 1.0 up to ~18 m, ~1.22 at the 64 m leader view (1.26 far out); fully opaque up to 130 m, faded out by 190 m (§19: never hidden at the leader view; at the high map views the inbox carries the letters); hidden behind the camera or off screen.
- **One tag per sender**: the newest unread letter, with a red *+n* when there are more. Read (`setPinUnread(id, false)`): 74 %.
- `agents.unpin(letterId)` (the tag rises and fades when its last letter goes), `agents.unpinAll()`, `agents.setPinUnread(letterId, on)`, `agents.pinReply(letterId, i)` (answer with the i-th reply: tests, voice), `agents.pinFor(agentId)` → `{ letterId, letterIds, unread, count, replies, open(), reply(i) } | null` (works for a sender folded into a stack too), `agents.pins()` (list with screen positions, opacity, slot, `stack` id or null, `fanned`, `minister`), `agents.pinRect(letterId)` → the tag's screen rect (null while folded in a stack), `agents.pinAnchor(letterId)` → its world point, `agents.showPins(on)` (off also folds an open stack), `agents.placePins()` (snap tags, stacks and bubbles into place before a still), `agents.pinStacks()`, `agents.expandStack(id)`, `agents.collapseStacks()`.
- `agents.pinLetter(letter, { onOpen, onReply, onClick, target?, gist?, replies? })` does it from a sim letter: the target from `letter.from` (`agents.senderTarget(from)`: `agent` / `minister` with an id → that folk; `neighbour` → a point on the plot edge where that nation's road leaves, with the nation's initial; `ministry`, the minister with no folk, and the election (`neighbour` `all`) → the plot centre; `shadeling` → none, returns null), the gist (`letter.meta.gist` > `subject` > the body's first sentence), the replies (`letter.options`, none once `resolved`), `from`, `unread = !letter.read`, `minister = from.kind === 'minister'`.

### How game.js should call it (the integration pass)
```js
// 1. a letter lands (desk.js onNew, right after ui.letters.addLetter(Lt)):
agents.pinLetter(Lt, {
  onOpen: id => ui.letters.open(id),                                   // §15: it opens INSIDE the top-right inbox
  onReply: (id, says) => { ui.letters.markResolved && ui.letters.markResolved(id); return onLetterOption(id, says); }   // as the letter's own options
});
// 2. read / answered / folded in the inbox: quiet it, or take it away
agents.setPinUnread(id, false);      // ...or agents.unpin(id) (game.markRead / ui.letters.markResolved)
// 3. a click on a folk (input.js, before the agent card):
const pin = agents.pinFor(id); if (pin && pin.unread) { pin.open(); return; }   // pin.open() calls that letter's onOpen
// 4. portraits for the UI: inbox rows, the opened letter, the agent card header (§15: everywhere a folk appears)
const url = await agents.portrait(senderId, { size: 80 });            // paper circle + ring
// (for a neighbour / the Ministry there is no folk: keep the UI's heraldry / scales)
// 5. off the map: stages.onChange(s => agents.showPins(s === 'world')); also false in ui.cinema(true) / the meeting.
```
`agents.update(dt, t)` already places the tags every frame (on the planet: in her `afterFinish`, right after the frame it was called before); the lab's headless driver calls `agents.placePins()` before a still. The knobs are `TAGS` in pins.js (`fadeFrom` 130, `fadeTo` 190, `stackFrom` 28, `knotX` 84, `knotY` 46, `knotKeep` 1.3, `sizeNear` 1, `sizeFar` 1.26). Placing ~10 tags + 2 bubbles costs ~0.2 ms a frame.

## Fleets, the roll-call, the minister (`fleets.js`, ART_DIRECTION §11)
The sim runs the script (`sim/fleets.js`: `game.spawnAll()` lands the settlers and forms fleets by trade, `introduceFleets`, `election:ask`, `electMinister`, `releaseFleets`); the bridge makes it visible by listening:

| event | what the folk do |
|---|---|
| `fleet:form { fleets:[{ id, name, members, centre, slots:[{agentId,x,z}], caption }] }` | each member takes its slot: not landed yet → it **glides straight into its square** from the sky; on the ground → walks (≤ 5 m) or flies and lands there. Then it stands facing the lens, lock `'fleet'` (sim tasks wait in `pending`) |
| `fleet:introduce { fleetId }` | the roll-call: front row first, left to right, 0.62 s apart, each member **steps 0.8 m toward the lens, hops and waves** (a flit's right nub waves overhead and its propeller twirls; a floatie waves its free hand), then walks back to its slot. Several roll-calls may overlap (the sim runs them back to back) |
| `ceremony:start { agentId }` | the **chosen one floats up** (flit ~2 m, floatie ~3 m, its propeller / parasol carrying it), a deep bow then a small one, floats back down to its place; the paper ring marks it; **everyone else turns to look at it and cheer-hops three times**, arms up; it wears the red seal from now on. Confetti-free, spotlight-free |
| `fleet:release` | the squares break; pending tasks run |
| `agent:say { agentId, text, ttl }` | the speech bubble (below) |

Standalone (no sim script, e.g. a director beat): `agents.formFleets(list?, { centre, spacing = 1.9, gap = 3.2, perRow = 3 })` lays out ceil(√n) squares facing the camera (default list `agents.fleetsByTrade()`), `agents.introduceFleet(id)` / `agents.ceremony(id)` return Promises, `agents.releaseFleets()`. Fleets formed before `spawnAll` are adopted as each folk spawns.
`agents.fleetInfo(id)` → `{ id, name, caption, centre:{x,y,z}, radius, members, ready }` for framing a square; `agents.fleetsReady()`; `agents.fleetCaption(f)` → *"The Builders · two flits, two floaties"*.
**The minister choice:** `agents.highlight(id, on)` on hover: a soft hover lift (+0.25 m, the propeller spins up / the parasol carries it) and a cream paper ring with an ink thread on the ground. The click is the game's (`game.electMinister(id)`).

## Visible work (`work.js`, ART_DIRECTION §11 "Visible building", "Jobs")
**Why folk stood idle during builds (the visual side):** (1) only the sim's crew (2–4 folk) ever got a task on a site, everyone else strolled; (2) the crew's visuals ran on the sim's clock: the sim walks at 3 u/s, our folk at 1.15–1.45 u/s, so a crew member was still walking to the stockpile when the sim already had it hauling, and still walking to the site when it was already back on the way to the stockpile, and the 6 s hammer bursts were mostly spent walking (a house went up in ~23 s with almost no hammering seen); (3) `haul` arriving mid-walk made crates appear and vanish mid-trip; (4) the sim's `carrying: 'bread'` drew nothing. Now a **role** (not a lock) runs a visible loop decoupled from the sim's timing:

| role | who | the loop |
|---|---|---|
| `build` crew | the sim's crew of a site (`walk/haul/work` with its `buildingId`) | hammer at a spot round the site (mallet a size up, dust on every blow), every third cycle fetch a load first; spots rotate slowly |
| `build` helpers | idle folk and camp workers, nearest first, up to 4 per building (6 per landmark, 2 per prop, 3 per field/garden), mixed: `haul` (to the stockpile, stoop, pick up a crate / plank / stone / sack, fly or walk it to the site edge, stoop, drop it on a growing pile, dust), `lift` + `catch` (a floatie lifts a plank over its head, a flit hovering above takes it, carries it over the scaffold and places it in a puff), `hover` (flap / drift round the scaffold, peering down), `hammer` | until the site is done (piles poof away, most of them celebrate) |
| `job` | the sim's production workers (`work` / `walk` at a finished building) | by kind: `hoe` (fields, farms, gardens, orchards, groves: rows inside the outline, the hoe in two hands, dust where it lands), `bake` (knead at the door with flour puffs, carry a tray of loaves to the rack, set it down), `chop` (axe, carry logs to a stack), `pick` (quarry: pick, carry stones), `sell` (market: goods held out, turning to either side), `dock` (shift crates), else `hammer` at a bench. The sim's own product haul to the stockpile is drawn as is |
| `camp` | the sim's camp workers (`gather` / `work` with `camp: true`) | foragers stoop along the shore (a floatie carries a basket), gatherers chop driftwood and pick up stones; the camp's haul to the crates carries a basket / a log / a stone |
| `post` | idle scouts / couriers, now and then | an envelope flown to a house (or a neighbour), held up, handed over with a hop, three times |
| `act` | `agents.act(id, style, { x, z, ms, face })` | any of the styles at a spot (entrepreneurs, director beats); `agents.stopAct(id)` |

A real sim task (rest, meeting, letter, strike, leave, a new job) ends a role at once; the sim's idle strolls, standing about and (for a helper) its camp trips are ignored while a role runs. Explicit commands (`walkTo`, `fly`, `debugPose`, `deliverTest`) end it too. Piles live in the live folk pass only (`props.liveOnly`: off layer 0, so the held world painting never bakes a stale copy). `agents.workStats()` / `agents.roleOf(id)` for debugging.
New carried things (`props.make`): crate, basket, plank, stone, log, loaves (a tray with a baguette and two buns), sack; tools: mallet, axe, pick, hoe.

## Speech bubbles (`bubbles.js`)
`agents.bubble(id, text, { ms, tone: 'say'|'think', who })`: a small paper sheet (`--paper`, `--ink`, the text face `--ag-font-text` (Sentient, §17) 14.5 px, max-width 204 px, wraps) over the folk's head with a tail pointing down at it, re-positioned every frame from the head's world position through the lens (kept on screen, the tail slides to keep pointing; two sheets never overlap, the higher one moves up). **A letter tag wins over a bubble** (the minds' lines and conversations add many): a bubble a tag or stack would cover first slides sideways along its tail (as far as the tail can still reach the head: up to half its width); if it is covered anyway it **fades to a whisper** (`.agb.dim`, 9 %) and stays faded for at least 0.7 s (no blinking as tags ease past). Text is cut at ~90 characters on a word boundary. `ms` defaults to reading time (2.6–7 s); `ms: 0` stays until replaced. `tone: 'think'` with no text shows three bobbing dots (waiting for an answer). While it talks, the folk turns to the lens and wiggles a little; one hop when it starts. `agents.clearBubble(id)`; `agents.headOf(id)` / `agents.screenOf(id)` for the card and the camera. The sim's `agent:say` (talk replies, the ceremony's thanks, ventures, "Done!", idle chatter) shows up automatically.

## Wiring (game.js)
```js
import { createAgents, createAgentNav } from './agents/agents.js';
const game  = createGame({ seed });
const nav   = world.nav || createAgentNav(game);           // any nav works; the bridge wraps bounds/flyPush
const folk  = createFolk(ctx, backdrop, nav);
const agents = createAgents(ctx, folk, game, world, {
  onDelivered: msg => ui.envelopeFlyIn(msg),             // see "Letters" below
  groundY: (x, z) => world.groundY(x, z)                 // optional; default world.groundY, else geography heightAt (>= 0)
});
game.spawnAll();                                          // AFTER createAgents: 12 settlers drop over ~3 s
// loop — the ORDER matters (poses override what folk.update just wrote):
game.tick(dt); folk.update(dt, t); agents.update(dt, t); painter.frame(dt, t, beforeDraw);
// voice:
onSpeechStart: agents.crowdListen(true);   onSpeechEnd: agents.crowdListen(false);
// clicks:
const id = agents.pickAgent(e.clientX, e.clientY);       // sim agent id | null
const painted = agents.speciesOf(id);                     // 'flit' | 'floatie' (what the folk looks like)
```

## API
```js
const agents = createAgents(ctx, folk, game, world = null, { onDelivered, groundY, emit = true, overlay = document.body })   // overlay: where the bubble layer goes
agents.update(dt, t)                    // after folk.update, before painter.frame
agents.pickAgent(clientX, clientY, { radiusPx = 34 }) -> agentId | null   // raycast on folk roots, then the nearest folk within 34 px
agents.crowdListen(on, { radius = 22, center = view centre }) -> bool   // folk near the view stop, hop once (staggered) and face the lens; off = they carry on
agents.onDelivered = fn(msg)            // also settable via opts; msg below
agents.envoyIn(neighbourId, { letterId, species, slot }) -> rec       // walk one in by hand (envoy:send does this for you); species defaults to the nation's people
agents.giftOut(neighbourId, { carrierId, gift }) -> rec               // fly one out by hand (gift:send does this for you)
agents.speciesOf(id) -> 'flit' | 'floatie' | null                     // the painted species of a sim agent (the sim keeps its own for skills)
agents.celebrate(id, delay = 0) -> bool                               // a little flight of joy, back down on the same spot
agents.fly(id, x, z, { fly = true, land = true, y, speed })           // send one of ours somewhere (fly: false walks it)
agents.extraObstacles                                                 // [[x, z, r]]: kept clear of on top of the buildings (lab props, scenery)
agents.fm                                                             // the flier motion (fliers.js): go, stand, hold, arrived, glide, down, ...
agents.get(id) / agents.creature(id) / agents.recs / agents.temps / agents.listening
agents.frontPoint(ndcX, ndcY) / agents.edgeExit(x, z)                // where couriers stop / where a nation's road leaves the plot
agents.dispose()                        // unsubscribe, despawn temps, restore nav hooks, free prop GPU data, piles, bubbles
// who is who / fleets / work / talk (ART_DIRECTION §11), see the sections above
agents.identity(id) -> { species, kit, trade, gear, extras, outfit, colour, rotor, canopy, words }
agents.formFleets(list?, opts) -> layout · agents.fleetsByTrade() · agents.fleetInfo(id) · agents.fleetsReady(id?) · agents.fleetCaption(f)
agents.introduceFleet(id, { each, forward }) -> Promise · agents.ceremony(id) -> Promise · agents.releaseFleets(ids?) · agents.setMinister(id)
agents.highlight(id, on = true)                                       // hover lift + paper ring (the minister choice)
agents.bubble(id, text, { ms, tone, who }) · agents.clearBubble(id) · agents.bubbles() · agents.placeBubbles() · agents.headOf(id) · agents.screenOf(id)
agents.act(id, 'hammer'|'hoe'|'bake'|'chop'|'pick'|'sell'|'lift'|'think', { x, z, ms, face }) · agents.stopAct(id) · agents.roleOf(id) · agents.workStats()
// lab / debug: agents.debugPose(id, 'work'|'strike'|'rest'|'meeting'|null, carry?, faceAt?), walkTo(id, x, z, { fly? }), startLeave(id, {x,z}),
//              deliverTest(id), hop(id)
```
`msg = { kind: 'courier'|'envoy', agentId, neighbourId?, letterId?, letterIds:[...], landed?, screen:{x,y} }`. `screen` is the client position of the envelope at the moment of handing over, so the UI can fly a paper envelope from there into the stack. The same payload is also emitted on the sim emitter as `agents:delivered`.

## Events consumed (sim → visuals)
| event | what the folk do |
|---|---|
| `agent:spawn` | queued; one released every 0.25 s as a flit or a floatie. Each glides down from the sky in a loose flock (from high beyond the far side of the view), lands on its spot with a squash and a puff of dust, hops once and faces you for ~2.5 s. 12 settlers are all down ~9 s after `spawnAll`; tasks that arrive meanwhile wait |
| `agent:task walk/haul/gather` | a trip to `to`, walked (1.45 u/s flits, 1.15 u/s floaties) or flown and landed (see walk or fly). `carrying:'crate'` → on the ground a flit hugs it to its tummy with both nub arms, a floatie hugs it in its free arm; in the air it dangles under the flit. `'bread'` → a basket (a floatie carries it hanging from its free hand) |
| `agent:task work` | finish the trip to the site spot (landing if it flew), face the building, hammer: the flit's right nub swings a mallet, the floatie's free arm does (the parasol stays up), up slow and down fast (~1.9 Hz), leaning into each blow, a little hop on every other strike and dust on the odd ones |
| `agent:task deliver` (letter) | **courier**: walks if the lens's clear patch is near, else flies there and lands, re-aiming if the camera moves. There it holds the envelope up (a flit with both arms over its head, a floatie in its free arm; billboarded, 1.45×). Nearby folk turn to look. After 1.8 s `onDelivered` fires, the envelope shrinks into the "tray" and the courier hops. It stays on the ground; its next task decides |
| `agent:task strike` | walks to the square. Puffed up (×1.12), angry slanted eyes, facing you, stomping (hop + squash + dust) every 1.1 s. A placard goes up in the flit's right nub (other fist out) or in the floatie's free arm |
| `agent:task leave` / `agent:leave` | sulking, takes off and flies past the plot edge toward the nation, then a poof (squash, shrink, dust), then `folk.remove` + free |
| `agent:task idle` (`resting`) | stands; half-closed eyes and a slump (puffers use the reference `sleepy` mood) |
| `agent:task meeting` | stands and faces you |
| `agent:mood` | delta ≥ +4: a hop. delta ≤ −4: a huff (puffed, quick stomps). Mood < 30 while standing: a sulk (half puffed, slow stomps) |
| `agent:refuse` | a head shake and a huff |
| `agent:listen`, `crowd:listen` | that folk / the answering folk turn to you and hop |
| `envoy:send {neighbourId, letterId, votes?, all?}` | a temp walker of **that nation's people** (a drop for n1, a loaf for n2, a puffer / pip / scoot in turn for n3) walks in from 4 units beyond the plot edge facing the nation (from just inside it when that side is sea: no boats), at most 22 units from the hand-over (10 for loaves, who hop at ~1 u/s; a pop of dust when it starts inside the plot), to a clear patch in the view, and holds the letter up. It calls **`game.deliverLetter(letterId)`** (the sim waits for this) and `onDelivered`, then walks back the way it came, poofs and is despawned. ~10–12 s from appearing to the hand-over. For the election (`all`, `votes`) one envoy walks in from each voter; they wait for each other and raise their letters together; the first hands it over |
| `gift:send {neighbourId, gift, carrierId}` | the sim's carrier (else a stand-in flit / floatie that pops up at the stockpile; a flit when the nation is across water) takes off with a basket (food words) or a crate, flies out past the plot edge toward the nation and poofs. A sim carrier goes "away" (hidden) and pops back in, flying, at that edge on its next sim task (the `journey` task is absorbed) |
| `building:done` | ~75% of our folk within 14 units fly a little celebratory loop, staggered |
| `letter:sent`, `letter:new` | letters that ride in a busy courier's bag join its envelope |
| `building:*` | when the nav is ours (`createAgentNav`), buildings become round obstacles (synced every 0.5 s); fields, gardens, plazas and roads stay walkable |
| `agent:task` with `buildingId` / `camp` | becomes a visible work role (see Visible work) |
| `fleet:form`, `fleet:introduce`, `fleet:release`, `ceremony:start` | squares, the roll-call, the ceremony (see Fleets) |
| `minister:set` | the red seal moves to the new minister |
| `agent:say` | a speech bubble |

## Decisions (made without asking)
- **The sim owns where and when; the bridge owns how it looks.** The sim moves agents abstractly at 3 u/s. Our folk walk at 1.15–1.45 u/s because faster gaits look frantic (and fly at 2.3–3.3 u/s). They lag a little, which only eats into hammering time. A new task never teleports anyone; it re-routes from where the creature stands.
- **Our species mapping lives in the bridge.** Whatever species the sim gives a settler, the painted one is a flit or a floatie (balanced); `speciesOf(id)` tells the UI which. The sim's own species stays for skills and letters.
- **A real seam, not a fake landing.** The old bridge "landed" fliers by sinking the hovering creature until a foot touched. Now a grounded flier is genuinely taken off folk.js's hands (`a.driven`) and walked on the reference leg rig, so feet plant, step and push off like the pips'. The seam is three added lines in folk.js (a skip in each flier update, the leg rig in the return); the reference never sets `driven`, so the fidelity gate is untouched.
- **The floatie's sunshade**: on the ground the parasol leans back 0.3 rad with the body kept upright under it (the root, i.e. the canopy, moves behind the body by HANG·sin(tilt)), so it reads as a parasol held over the shoulder; it rights itself on take-off.
- **Envoys walk, ours fly.** Neighbours have no wings in this story, so they walk in from their nation's side of the plot. When that side is sea they start just inside the edge with a pop of dust ("came off the boat" without drawing one).
- **Locks.** Spawning, a courier run, an envoy, a gift, a departure or a celebration finishes before the next sim task is applied. The latest task waits in `rec.pending`. Listening also defers tasks.
- **"Arms crossed" became a placard aloft with the other fist on the hip.** Puffer arms are 0.15 long and can't cross in front of a 0.34-radius body. From the leader's height a placard reads instantly, and arms crossed would not. The angry face, the puffing and the stomping are as asked.
- Loaves (envoys) have no arms: letters ride **on the hat**. Scoots carry letters in their mouth and rear up to present. Flits get two nub arms (the drops'/pips' nub, the flit's own clay) whenever they stand on the ground (swinging with the steps, thrown up when they hop) and when they need hands in the air.
- Letters are always **billboarded** to the lens and shown 1.45× bigger when held up, so the envelope and red seal read at bird's-eye.
- Attachments carry FACE_LAYER 5 + MASK_LAYER 6 (as folk bodies do), so they paint in the Gouache folk pass. Dust puffs are opaque clay balls in paper tones, in `colourOnly` (no keylines) and on layers 5+6, from a reused pool (no per-puff allocation). Visual-only randomness (dust, spawn sky offset, seeds) uses `Math.random`, never `ctx.rnd`. The only rnd the bridge spends is inside `folk.make.*`.
- Despawn frees only GPU data that no remaining creature uses (it diffs geometries and materials against every live folk). The check shows 97 → 97 geometries over 4 extra envoys.
- The bridge **wraps** `nav.bounds` and `nav.flyPush` (whatever nav is passed) so leaving walkers and incoming envoys can cross the plot edge. `dispose()` restores them.
- Off the plot, walkers follow the relief via `groundY` (default `world.groundY`, else `geography.heightAt` clamped ≥ 0); flying heights are above the relief too. Water tests use `world.isWater` when the world has it, else `geography.isWater`.

## How to test
```
~/.nvm/versions/node/v22.22.3/bin/node shots/agents/check.mjs      # 30 functional checks, real sim (≈ 4 min)
~/.nvm/versions/node/v22.22.3/bin/node shots/agents/shoot.mjs      # the review set in Gouache -> shots/agents/*.png
~/.nvm/versions/node/v22.22.3/bin/node shots/agents/shoot.mjs close-hammer seq-flit-landing --raw
~/.nvm/versions/node/v22.22.3/bin/node tests/fidelity/compare.mjs  # folk.js seam: must stay mean 0 / max 0
python3 -m http.server -d web 8000  →  http://127.0.0.1:8000/agents-lab.html   (buttons; drag / wheel / click a folk)
```
`window.__lab.run(seconds, dt)` advances sim + folk + agents in fixed steps (no clock) and paints one frame. `__lab.cam(x, y, z, fx, fy, fz)` places the camera.

Review shots for ART_DIRECTION §11 (the close overhead landing camera, `over-*`: ~20 m out, ~75° down): `id-sheet` (the twelve close up), `id-flits`, `id-floaties`, `id-sheet-over`, `over-landing`, `over-fleets`, `over-intro`, `over-highlight`, `over-ceremony`, `over-build`, `close-build`, `over-production`, `over-bubbles`.

Review shots for the leader view (2026-10-04, `node shots/agents/leader-tags.mjs` on the running :8870, into `shots/agents/leader/`: 7 senders, one the minister, four standing together, and two conversations): **`leader.png`** (64 m: two stacks, *7 letters · Olla, Nocciola, Orsola +2* and *2 letters · Pippo, Nando*, the bubbles sliding clear or faded under them), **`leader-expanded.png`** (a real click on the stack: the fan in two columns, the minister in red, the read one paler), `edge.png` / `edge-crop.png` (a knot at the left edge, 40 m), `close.png` (22 m: single tags, no stacks, no overlaps), **`lens-edge.png`** (`node shots/agents/leader-lens.mjs`: red dot = through her lens, on the folk; blue = the old plain projection, 36 px off, on the neighbouring floatie; a click at the red dot picks that folk, at the blue one nobody), `before-*.png` (the same takes before this pass). The script prints the overlap audit (tags / stacks never overlap) for each take.

Review shots for §13 / §14 / §15: `colour-sheet` (the twelve close up with every re-dye listed), `colour-flits`, `colour-floaties`, `portraits` (the sheet at 96 px and 40 px), **`tags-close`** (three senders, one with two letters), **`tags-bird`** (the leader view, 30 m), `tags-oblique`, `pins-close`, `pins-sheet-over`, `pins-sheet-bird`, `pins-bird`, `pins-over`, `pins-bubble` (from before the leader pass: the tag stepped aside for a speech bubble; now the bubble yields); `jitter-before` / `jitter-after` (the motion strips); `tags-game` / `tags-game-close` (in the running game).

The lab (`agents-lab.html?spawn` flies the settlers in on open, loose; **Arrival in fleets** is the game's opening): **Portraits** (a sheet of all twelve at 96 and 40 px) · **Letter tags** (three folk get a letter, the first a second one; a reply word answers it there, the tag or the folk opens it) · **Colour rule** (the twelve close up + what was re-dyed on each) · **Identity sheet** · **Arrival in fleets** (the sim's `spawnAll`: they glide into squares) · **Introduce** (the sim's roll-call; the lab camera visits each square as the game's does) · **Highlight** (Olla) · **Ceremony** (`game.electMinister`, else the bridge's own) · **Release fleets** · **Busy build** (a house with the whole crowd) · **Farm & bakery** (finished workplaces) · **Bubbles** · **Overhead** (the landing camera) · **Fly-in arrival** · **Walk & haul** (a real house build: crates, then hammering) · **Hammer** (3 flits + 3 floaties round a post frame) · **Letter delivery** (a real courier) · **Take off & land** (2 flits + 2 floaties cross the plot) · **Short walk** (everyone strolls 3.5 units: walked, never flown) · **Celebrate** · **Drop / Loaf / Third-nation envoy** · **All three** (the election line-up) · **Gift out** · **Gift across the bay** · Strike · Leave · Listen · Pause sim · Bird's-eye · Close. Click a folk for its name and painted species.

## Known gaps
- Portraits are a CPU paint (~40 ms each at 96 px, once per folk and size); asking for many sizes of many folk in one frame can hitch. The tags ask for 48 px only.
- Tags follow the folk in the air too (a flit on its way somewhere carries its tag with it). A sender who has left the plot (gone to the neighbours) has no anchor: its tag hides until `unpin`.
- In a tight crowd seen low and close (a folk standing right behind another), no slot is free of folk; the tag takes the least-covering one and may sit on the edge of a canopy. Its leader line still points at the right head.
- A knot is single-linkage on screen, so a working crew strung out in a line can chain into one big stack (*11 letters · Olla, Nocciola, Pina +6*). Calm, but the fan of a very big knot is two tall columns.
- An open fan's columns are clamped inside the view sideways; a knot hugging the left or right edge can push one column onto the other side's senders (never onto the other column).
- The game pins every sim letter (`game.js` `letter:new` → `agents.pinLetter`, opening in the inbox) and unpins on read / resolved; `pinFor` is the click on a folk (input.js). The leader pass changed only `web/js/agents/*` (no game.js edits: the lens and the `afterFinish` timing come from the `world` the game already passes to `createAgents`).
- The Kuwahara in the portrait is a small CPU pass, not the paint engine's warped Kuwahara (web/js/paint is not touched).
- Helpers are a visual cheat: a camp worker drawn helping on a site still produces its camp output in the sim (and the sim's crew is not slowed by how long our folk take to walk). The sim's numbers are unchanged.
- Floaties fly slowly (~1.8 u/s): a floatie hauling from a far stockpile takes ~12 s a leg; flits are picked as haulers first.
- The trade read from straight above is mostly colour: flits by their hat / band (yellow builders, white bakers, straw farmers), floaties by the pennant on the parasol tip; clothes on the body read from the oblique close views.
- Walking legs are straight lines with crowd pushing. There's no path-finding round buildings; a walk that would cross water is flown instead, but envoys (walkers) can still wade through the lake.
- If the visual courier reaches the lens **before** the sim courier reaches the tray, letters added to its bag in between land through `letter:new` only (no envelope animation for those).
- Envoys take ~10–12 s from appearing to the hand-over. The sim's safety net is 25 s.
- The sim moves faster than our walkers, so a long haul is flown (crate dangling) rather than walked; short ones are walked.
- Fliers in the air don't avoid buildings (they cruise above the plot at 2.7–3.4 units; tall buildings can be flown through).
- At full leader-view distance (30+ units) the poses are tiny. They are tuned to read at the "watch them work" zoom (12–16 units up), and placards and envelopes still read from above.
