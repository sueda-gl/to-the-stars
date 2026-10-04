# AGORA — art direction (Sueda's calls, 2026-10-03 23:15). This file overrides anything older.

Moodboard: `reference/moodboard/` (numbers as below). Judge every screenshot against it and against `shots/fidelity/original-gouache.png`.

## 1. The map: a leader's bird's-eye view of real geography
- **Camera = leader view, not ground level.** We lead the civilisation and need a comprehensive view of the map and its geography. The default view is a **high oblique bird's-eye**: about 55–65° down, high enough to frame the whole plot *plus* the surrounding coast, hills and water (mb 1, 4, 5). Zoom ranges from region overview down to close enough (~15–20 m) to watch the folk work. Pan, rotate, smooth damping.
- **The descent is top-down.** From high above, looking (nearly) straight down onto the area like a relief map (mb 1), it eases into the leader view over our plot. No ground-level horizon shot. The Red arch eye-level framing is used **only in specific scenes**: the Assembly / meetings / "up close".
- **Real relief geography, not a flat terrace.** Hills, ridges, mountains toward the edges, coastal cliffs and headlands, a river and the lake, a bay, islands offshore. It comes from `web/js/globe/geography.js` `heightAt`, so the globe and the map agree.
- **Start state (mb 1): a cream / ivory relief landscape.** Uncoloured paper land with soft relief shading and long warm shadows, against teal sea with a crinkled-paper surface feel. Warm **glows** mark settlements: our first camp, and the neighbours far off.
- **As we build, colour blooms in (mb 2, 4, 5).**
  - Fields as striped bands of green and ochre with flat gouache shading (mb 4), pine and cypress masses, sand paths and roads.
  - Shadows are cobalt / violet tinted (mb 4); highlights are warm.
  - Water is deep ultramarine-to-teal (mb 5).
- **Rendering stays Sueda's Red arch gouache pipeline** (verbatim engine in `web/js/paint/`): warped Kuwahara, pencil keylines from smooth proxies, painted vertex light, a warm key light from the left with soft shadows.
- **Gouache only. No Riso** (she won't use it). The game never shows the editions pill; Raw exists only for debugging (`?lab=1`).
- **Place names**, optional and sparing, are small hand-lettered italic serif labels on the map (mb 2), e.g. our settlement, the bay, the nations' directions.
- **Neighbours** are visible as distant coloured, glowing settlements toward the map edges / across the water, and on the globe.

## 2. Earth ⇄ Moon
- The voyage uses the **real three.js globe**: Earth and the Moon in 3D (`web/js/globe/` `flyToMoon`). There is **no separate 2D animated passage**. `web/js/voyage/voyage.js`'s riso passage is kept in the repo for another project but **not used** in the game. Arrival is still the shadelings' world (`web/worlds/lounge.html`, verbatim) via `lounge-driver.js`.

## 3. UI: uncluttered. The world is the interface.
**Disliked:** mb 6 (the voice bar with the "say …" pill and 4 chips) and mb 8 (HUD card + minister pill + neighbours pill + letter list + chips + voice bar + editions pill + Gouache settings + Up close all at once).
**Liked:** mb 7, the **envelope stack** with the red wax seal and count badge. Keep that look exactly.

At rest the screen shows **only**:
1. the world;
2. the envelope stack, top-right (only when letters exist), with its count;
3. a single small, quiet voice affordance, bottom-centre: a small mic mark with "hold Space" in tiny italic, which fades after the first use;
4. at most the settlement name as small italic text, top-left, with no card.

Everything else is **transient or on demand**:
- **While speaking**, one line of live caption in large italic serif near the bottom. It fades out a few seconds after the command lands. The folk turn to listen.
- **Typed fallback** (press Enter or `/`, or click the mic mark) opens a single minimal underlined input line in place of the mic mark. Esc closes it.
- **Suggestions** appear only in onboarding: inside the welcome letter, one or two phrases at a time. After 30 s of idle at most one faint rotating hint line appears, never a chip bar.
- **Notices** (Ministry of Builds etc.) are one short line of text with the pencil-scribble progress, top-centre, and they fade. One at a time.
- **Ledger** (minister, neighbours, resources, prosperity) is on demand only (Tab, or click the settlement name): a single paper sheet. It is never persistent.
- **Agent card** appears on click only. It's small and closes on outside click.
- No persistent HUD card, minister pill, neighbours pill, edition pill, Gouache settings or Up close in the game. They live in the labs / `?lab=1` only.

**Reading a letter** (she's not sure how it should look, so design it beautifully and show it):
- Clicking the envelope stack opens **one letter at a time**, like unfolding real mail: a centred paper sheet with deckled edges, the wax seal, and the sender's name and trade, over the world dimmed and softly blurred.
- The body is set in large Instrument Serif with generous margins, the date in the corner and a signature at the end.
- Replies are 2–3 quiet underlined text links at the foot ("say *yes, build it*"), or the player just speaks.
- A small "next letter" control shows when more are waiting. Esc or an outside click folds it away. The arrival animation is the envelope sliding onto the stack.

## 4. Unchanged
- The verbatim rules for her reference code.
- Instrument Serif, and the paper tokens `--paper #f3ecdc`, `--ink #3d5588`, `--red #e0503f`.
- No human figures; few big shapes, mid values, crisp silhouettes.
- Buildings must also read **from above**: roofs, courtyards and footprints matter at bird's-eye.

## 5. Marking the land with the cursor (Sueda, 2026-10-03): placement is NEVER arbitrary
- **Click** on the ground leaves a small **pencil ✕** on the paper. "A house here / there / this" builds **exactly** on the ✕, with the ✕ as the object's centre.
- **Left-drag a closed loop** draws a **pencil outline of an area**. "This is a field" / "a forest here" / "a garden" / "a vineyard" / "make this a market district" **fills exactly that shape**:
  - fields become striped crop bands clipped to the outline (mb 4);
  - a forest scatters 3D trees inside it;
  - a garden or plaza paints and paves it.
  - Single objects named for an area are placed at its centroid and scaled to fit it.
- **Left-drag an open stroke** draws a **pencil line**. "A road" / "a wall" / "a river" / "a fence" / "a canal" follows the line.
- **No mark:** "there" means the cursor's ground point at the moment the word is spoken, and "the middle" means the plot centre.
- **Blocked spots:** the object is nudged by the smallest amount that fits, and the move is shown, never silently relocated far away.
- **Marks stay visible** as pencil until used. They fade into the painting as the object is drawn ("pencil, then paint"). Esc or right-click on a mark clears it.
- **Camera with marking:** right-drag pans (or WASD / edge scroll), the wheel zooms, Q/E rotate. Left-click and left-drag are reserved for marking. Clicking a folk still opens their card.

## 6. Language (Sueda, 2026-10-04)
**English only.** No Turkish (or other) aliases, prompts, voice languages or tests are needed. Don't spend effort on them. Existing Turkish bits may stay where they're harmless, but nothing new is added.

## 7. Our people (Sueda, 2026-10-04 01:10)
- **Our species are ONLY the two fliers from the Red arch reference: flits** (round pistachio-green folk with propeller caps) **and floaties** (marshmallow folk in striped bathing suits hanging from beach parasols).
- **They both walk AND fly.** They walk on the ground for work: hauling, hammering, gathering, queuing to deliver. They fly to travel, arrive, celebrate and scout.
- **The other five species become the neighbouring nations' peoples**: loaves = the Loaf Republic, drops = the Drop Riviera, puffers / pips / scoots = the third nation. They appear as envoys, visitors and traders, and in their own towns, never as our settlers.
- Our folk arriving in Act 1 **fly down from the sky** with the descent.

## 8. The map must not look like a slab (Sueda: "the map is a bit ugly … it just looks like a not very well thought slab thing")
- **Avoid:**
  - flat cream plateaus with blurry vertical walls dropping to the sea
  - blobby low-frequency relief that the Kuwahara pass smears
  - dashed coast outlines
  - mushy greys
- **Aim for (mb 1, mb 5):**
  - a **designed** landform: articulated ridgelines and valleys, river gorges, terraced slopes, varied coastlines with beaches, coves, headlands and sea stacks
  - crisp light/shadow structure: warm lit faces, cobalt shadows
  - hand-drawn **pencil contour lines** on the relief, which are on-brand: paper maps
  - fine paper-map detail that holds through the paint pass
- Composition matters from both the globe and the leader view.

## 9. Build exactly what's asked (Sueda, 2026-10-04 01:23)
- "If I want a house I only want a house." There is **no automatic colour bloom**: no fields, trees, paths or green patches appear around a new building. Fields, gardens, forests and roads appear only when asked for (voice + mark). The legacy bloom is behind `?bloom=1`.
- **Existing green spaces (fields, gardens, lawns, areas) are buildable land.** A new building may be placed on them, and it takes the spot.

## 10. Space (Sueda, 2026-10-04)
- Around the globe it is **dark like real space**, as in the Tower Planet reference (`#05060d`). It's **deep night-blue** (≈ rgb 0.045, 0.075, 0.2) with cream stars and **no halo/atmosphere ring** round the planet (Sueda removed it). This lives in `web/js/globe/space.js` (the orbit term only); the ground-level sky stays the Red arch dusk. Keep it.

## 11. Arrival, fleets, minister, jobs, talking, inbox (Sueda, 2026-10-04 02:30)
- **Landing camera:** close and overhead (~15–25 m, pitch ~70–80°), so the arriving folk are big and readable, as in her screenshot. It is not the far leader view.
- **Fleets:** after landing, the folk form **neat square formations by trade** (builders, farmers, bakers, scouts/couriers, diplomats/scholars…). The **fleet introduction** is a calm sequence: the camera visits each square, a caption card names it ("The Builders · four flits, two floaties"), and each member hops or waves as it's introduced.
- **Minister:** right after the introductions the game asks: "Choose your minister: click one of them." The clicked folk is elected (seal, little ceremony). Later elections are run by the crowd (folk vote; the result arrives by letter).
- **Jobs and economy:** every folk has a job and a workplace, and production comes from their work. **Entrepreneurs**: ambitious folk propose (and sometimes start) their own ventures (a tea house, a boat workshop…). They ask by letter or speech bubble, and Sueda can approve.
- **Visible building:** when something is built, folk visibly gather, carry, hammer and hand up materials. No idle crowds during a build.
- **Individuality** (additive accessories only; the reference creatures stay verbatim):
  - flying gear variants: propeller styles and colours, double rotors, goggles, parasol patterns and fringes
  - clothes and colours by trade: scarves, hats, aprons, tool belts, satchels
- **Agent card + Talk:** click a folk to see name, job, personality traits, mood and known skills, plus **Talk**. Folk answer in **simple, short, plain sentences** in a small paper speech bubble above them (voice or typing). Letters stay for formal matters. *(This supersedes "folk can't speak".)*
- **Inbox, no side panel:** clicking the envelope stack **fans all letters out across the centre**, like mail on a table: cards with seal, sender and subject. Click to read; Esc gathers them back.

## 12. THE WORLD IS SUEDA'S TOWER PLANET (2026-10-04 03:10)
`reference/the-tower-planet-clean.html` (her latest edit) **replaces our globe and map**:
- One continuous world: orbit in the **Grain** style, descending automatically into **Red-arch Gouache with a clear daylight sky** (`uBlend` and `DAYLIGHT` by altitude). Used **exactly as is**: look code verbatim.
- The game lives on its surface. Sim, placement and marks work in the flat design space; an adapter maps everything onto the sphere with `mapFlat` and the surface normal.
- The tower on its crag = the ancient wonder. Our home is a cream coastal site with a lake. The three nations are towns elsewhere on the planet. A Moon is added to its space for Act 3.
- The old `web/js/globe` and `web/js/world` stay in the repo, unused.

## 13. Colour rule for our folk (Sueda, 2026-10-04)
**No green and yellow together on a creature.** Flits (green bodies) never get yellow caps, propellers, scarves or accessories. The reference's random cap colours that include yellow are re-coloured in our agents layer (additive override; the reference file stays untouched). Floaties are fine with any of the approved accents, except yellow next to any green element.

## 14. Mail system (Sueda, 2026-10-04): letters live in the world + a notifications corner
- **In the world:** every unread letter floats as a small envelope with the **sender's painted portrait** above its sender (folk, building, or a neighbour's envoy). Clicking the folk/envelope opens it.
- **Envelope stack (top-right) stays.** Click: the camera glides to the **latest unread** letter's sender and opens it as a **compact card beside the sender**, so the world and the effect of your reply stay visible. No full-screen letter.
- **Notifications** slide in under the stack: *(portrait) Name sent a letter · "Subject"*. A few stack up, then they collapse.
- **Notification management:** a slim recent-notifications column under the stack (click = jump + open; dismiss; mark read; dismiss all). Compact, never a big docked panel.
- **Portraits:** each folk's own head, rendered small through the gouache pass, shown in the wax seal / letter header / notifications.
- The fan-out spread (from §11) survives only as an optional "see all at once" view (e.g. long-press or shift-click the stack). It is not the default.

## 15. Sueda, 2026-10-04 03:55
- **Opening cameras are low and oblique** (landing ~35°, square visits ~28°, ceremony ~24°), so the folk read from the side: faces, clothes, gear. Never straight down at hats.
- **Folk must move smoothly.** No buzzing, jitter or glitching (a bug to fix).
- **Letters in the world = tiny rectangular text tags above the sender's head:** the name, a one-line message, and 2–3 ready-made quick replies. Nothing else. Keep it as small as possible.
- **Inbox stays at the top right.** Opening a letter shows it **inside the top-right inbox area** (the inbox expands to read it), not beside the folk and not mid-screen. Inbox rows show the **sender's painted portrait** (not just a wax-seal initial).
- **Conflicts:** folk have disputes (theft, quarrels, noise, rivalries, shortages). The minister brings them to Sueda, and she answers with **institutions** (e.g. "start a police patrol team"). These become real groups of folk with uniforms, patrols and effects on the conflicts. Rule-based offline, richer with the live API.
- **Portraits everywhere a folk appears:** the agent card header, the tiny letter tags, the opened letter in the inbox, and the inbox rows all show **that folk's painted portrait** (agents.portrait), never just a wax-seal initial. Nations/Ministry keep their shields/seals.
- Bug: the agent card repeats the workplace ("Farmer at the Field *at the Field*").

## 16. PLISSÉ REPLACES THE MOON (Sueda, 2026-10-04 04:00)
`reference/plisse-the-lantern-planet.html`: a pleated paper-lantern world, tidally locked, with shadelings on its dusk ring, elder lanterns and two moons (three r147, MeshStandard + ACES, its own anisotropic-Kuwahara gouache). It **replaces the Moon** as the Act-3 destination.
- **Seen from Earth's space (the Tower Planet view):** a stand-in Plissé is drawn **in the Tower Planet's space style (grain / dither allowed)** so both planets read as one universe. The stand-in recreates its silhouette (pleats, ribs, red end caps, dusk ring) for distance only.
- **Landing / arriving:** cross-fade into **`web/worlds/plisse.html` = the original file, byte-identical (sha256 above)**. Its shaders and looks are **preserved exactly and never altered**. It's driven only from outside (camera nudges via synthetic pointer/wheel on its canvas, hiding its own chrome by style injection), like the Alpine lounge.
- The old painted Moon and any Moon added to the Tower Planet are replaced by this.
- **The Alpine lounge stays: it is THE MAIN SCENE of Act 3** (Sueda) = landing on Plissé's surface. Path: Earth orbit → fly to Plissé (stand-in in space style) → cross-fade into Plissé (verbatim) → descend → the Alpine lounge (verbatim) with seeds / golden hour / shadelings → and back.

## 17. Typeface (Sueda, 2026-10-04 04:08): G = Basteleur + Sentient, replacing Instrument Serif everywhere
- **Display** (title, headings, letter subjects, signatures, captions, fleet names): **Basteleur**, set **slanted/italic** exactly as in the letter she chose ("On the matter of bread" … "Olla").
- **Text** (letter bodies, tags, rows, cards, buttons, hints): **Sentient**.
- `web/css/fonts.css` defines `--ag-font-display` / `--ag-font-text` with local woff2 files (offline-safe). No Instrument Serif anywhere in the game UI. The reference pages (paint lab etc.) keep theirs.

## 18. Real AI agents (Sueda, 2026-10-04): Haiku personas + a Fable director
- **Each of our folk is its own Claude Haiku 4.5 agent** (`claude-haiku-4-5`). It has a stable persona (backstory, voice, quirks, values, fears, goals, opinions of the others), a private memory stream (observations, what was said to it, what the sovereign did, periodic reflections), and acts every ~30–40 s staggered, or on relevant events. It picks from the sim's executable action vocabulary and writes its own speech line. Agent-to-agent conversations are 2–4 turn exchanges between two personas, shown as bubbles.
- **Fable 5.1 = the director.** It casts the 12 distinct personas with built-in tensions at the start, then steers the story at the start, every ~10 min, at milestones and on demand (configurable): events, conflicts, goal nudges, the minister's briefing, narrative coherence.
- Fable still interprets the sovereign's commands; Opus 5.5 still designs new things. The rules engine executes everything and is the safety net (no credit / failed call → rules).
- The persona prefix is cached; estimated cost ≈ $3–4/hour for 12 minds.

## 19. Motion + tags (2026-10-04, from the jitter fix)
- **The camera must move every frame** (60 Hz). No held-frame camera judder. If the world paint is held, still update the camera smoothly, or repaint while the camera moves.
- **Folk brush crawl:** the reference folk pass's screen-fixed brush noise crawls over moving folk. Never change its look (verbatim); reduce the crawl only through scheduling (e.g. stable repaint cadence) if at all.
- **Letter tags must be visible from the leader view** (not hidden beyond 55 m). Scale them for legibility at the default leader distance.

## 20. Sueda, 2026-10-04 08:06
- **The minister click must work reliably and without lag.** Folk picking goes through her fisheye lens.
- **Until the election is finished the camera stays lower** (~20–25°, closer, folk read as characters). It rises to the leader view only after the minister is chosen.
- **The inbox occupies the top-right corner itself.** When the list or reader opens, **the envelope stack hides** and the list/reader takes its place at the very top-right, with the sender's painted portrait. Closing it brings the stack back. Never mid-screen.
- **Institutions:** Sueda **picks the members herself** by clicking folk ("Who joins the Police Patrol? click folk, then Done"). Auto-pick only if she says "you choose".

## 21. Sueda, 2026-10-04 08:30
- **Home = the old seaside map at landing.** Her Tower Planet is used for orbit and the descent. As we land, it hands over (a seamless cross-fade at a matched framing) to the **old seaside world (web/js/world, as in her 08:28 screenshot: cream plain, wide teal sea, sea stacks, the lake), exactly as it was**, with **no fisheye** and **trees + green spots added** (the approved 3D painted trees, green meadow patches). The nations and the Plissé voyage still go up through her planet's orbit.
- **Title screen:** her planet **alone** in dark space (nothing over it), with a **cooler, darker display font and a better name**. Build a title lab with name × font options for her to pick.
- **Guide/hint text** (onboarding lines like "One more thing: rest your cursor…"): **not blue**, in a cooler style that fits the darker title direction.
- **Performance:** the game gets very slow and lags, especially in the space travel. Improve frame rate **without dropping quality** (no look changes; scheduling, LOD of hidden scenes, pausing off-screen worlds, resolution of intermediate targets only where invisible, etc.). She also tested in Safari; the target is Chrome, but Safari must not be awful.
- **Gouache lab:** `web/js/lab/planet-look.js` (G / ?lab=1) controls her planet's paint, colours, lens and folk paint. Save-as-default writes look.json. Keep it working.

## 22. Rewards for every creation (Sueda, 2026-10-04)
Every build or placement gives something back, shown with a delightful animation that makes cause → effect obvious. There are **four core areas, no more**:
- **Food** (sheaf of wheat): farms, fields, cattle and animals, bakeries, fishing, orchards, wells/water
- **Shelter** (little house): houses, huts, homes, anything people live in
- **Craft** (hammer / cog): workshops, smithy, quarry, woodcutter, mill, market, dock, roads/bridges, trade
- **Joy** (lantern / heart): plazas, fountains, gardens, taverns, festivals, temples, statues, monuments, anything social or cultural. Taverns and huts also give a little Joy.

Generated (AI-designed) things are classified by meaning (a lighthouse gives Craft and Joy, a rubber duck gives Joy). The **Prosperity** headline comes from the four. On completion, painted tokens rise from the new thing with a "+n" stamp and fly into a compact four-area tally (top-left, under the settlement name, quiet at rest, pulsing on gain). Optional small milestone moments ("Food 25: the folk are well fed").

## 22b. Reward areas, revised by Sueda (supersedes the four in §22)
- **Money** (coin): markets, workshops, smithy, quarry, mill, dock, farms/fields/animals (produce sold), trade.
- **Happiness** (small smiling lantern): houses, huts, plazas, gardens, fountains, taverns, temples, statues, festivals.
- **Science / R&D** (little telescope / flask): school, library, observatory, windmill/engineering, lighthouse. Novel AI-designed things give some Science ("we learned to build it").
- **Civ level** (rising banner): every creation adds progress. Level-ups (Camp → Hamlet → Village → Town → Civilisation) are a bigger animated moment.
The animation design is unchanged: a "+n" stamp, tokens arcing into a compact tally top-left, pulse + count-up.

## 23. Title (Sueda, 2026-10-04 08:55; REVISED 2026-10-04 pm: the pop title)
- The game is called **"Aloud"**, tagline "A civilisation, spoken aloud".
- **Title look (revised): the same pop-comic print as the cards and the icons** (reference/feedback-1120/icon-aesthetic-pop-comic.png).
  **Titan One** (Rodrigo Fuenzalida, **OFL**, vendored: `assets/fonts/TitanOne-Regular.woff2`, licence in `assets/fonts/licenses/TitanOne-OFL.txt`),
  **lemon letters with a bold ink outline**, a **pink halftone shade** on the lower side, a **misregistered pink print shadow** (+ an ink one
  under it), **little stars / sparkles** round the word; the tagline in Montserrat caps between pink bars; **Begin as a lemon sticker pill**
  (ink outline, cream die-cut edge, pink offset). It stays readable over her planet (a soft pool of night under the type).
  The earlier Melodrama 600 look stays available as `font: 'melodrama'` (title.js `TITLE_FONTS`).
- **Layout:** the title at the **top**, her planet alone below it in dark space, Begin under it with the hint.
- Module: `web/js/ui/title.js` (TITLE_DEFAULT aloud / **pop**) + `web/css/title.css` (`.tt[data-font="pop"]`). The game's title card uses this.

## §24 — UI + onboarding overhaul (Sueda, 2026-10-04 11:20; refs in reference/feedback-1120/)
- FONT: all game UI text = **Montserrat** (vendored locally, OFL). The Aloud title stays Melodrama 600 (§23). No more blue serif ink (Basteleur/Sentient in blue) anywhere in the game UI — the fleet intro ("Fleet two of five / The Farmers"), "Choose your minister", hints, cards, mail: all restyled. Text colour: ink near-black / warm white on a soft panel, accents per the new icon palette; never the old blue.
- ONBOARDING lives in ONE dedicated place: a clean panel on the LOWER HALF of the screen (readable Montserrat, short lines, step dots, a clear next/continue or "do it" prompt). Steps, in order, right after landing:
  1. "Welcome to planet R-99. You've been allotted a small part of this planet to grow your civilisation — your country." (entry moment)
  2. Meet your residents: everyone has different talents and opinions, and each could play an important role in building this new civilisation. Be a good leader; treat them well.
  3. Letters: residents write to you — "click here to see the letter" (points at the mailbox; completes when a letter is opened).
  4. First build: speak (hold Space) or type to build — "you can build anything with speech or text; it's generated in real time by AI" (completes on first build).
  5. Pick a minister — you'll speak with them directly (completes on election).
  6. Open the residents' letters and be fair → onboarding ends, the game starts right away.
  It must show every core function. Delete the "Welcome, founder" letter.
- ICONS: replace the UI icons with a new set in the pop-comic aesthetic of reference/feedback-1120/icon-aesthetic-pop-comic.png (hot pink + lemon yellow + cream, bold dark outlines, halftone dots, little stars, risograph print texture). §13 still applies: never green and yellow together.
- Delete the "Agora" text at the top left.
- NO letter/name tags above folk heads (and no floating nation "Welcome from …" tags) — they clutter. A folk who has sent something gets a small RED DOT above it; the content lives only in the mailbox (top right). Keep speech bubbles rare and small.
- MAILBOX: when open, the envelope icon disappears — only the list (and the opened letter) shows.

## §25 — Townsfolk: more kinds of folk (Sueda, 2026-10-04: "more agents in the population especially different types, like the blue square ones … yellow star things … square batches of 3x3 in the first scene with distinctive accessories")
- **Extends §7.** Beside our flits and floaties, the settlement has **townsfolk companies**: the **loaves** (her teal rounded boxes, "the blue square ones", verbatim from folk.js) and three new species made in her clay-cel grammar (`web/js/agents/species-extra.js`, folk.js untouched): **twinkles** (soft five-point lemon stars that walk on their lower points), **glims** (paper lanterns on plum legs), **moths** (fawn teardrop moths that hover, powder-blue + pink wings).
- **One uniform per species**, so a company reads as one: loaves a cobalt bow tie + satchel; twinkles a striped cobalt nightcap + cream satchel; glims a red tassel, a red bow on the handle, a coral scarf; moths brass goggles + a streaming coral scarf. The trade shows as a small painted badge. §13 holds (a twinkle is yellow: never green on it).
- **Squares of nine (3 × 3):** the game forms one square per company behind the trades' arc (`createGame({ townsfolk: 9 })`, `?townsfolk=0` = the twelve alone); the trailer's t1 reception has the four companies march in through the arch and halt in a row of squares before the launch.
- The neighbours' envoys are unchanged (the Loaf Republic still sends loaves).
- **Round 2 (Sueda, 2026-10-04 pm)**:
  - The onboarding panel is SMALL: a slim strip low on the screen that **tucks itself into a corner pill** (bottom-left, "③ Open the letter")
    after the read (~4–6 s) or as soon as she acts; a click on the pill opens it; each new step pops it out again. Steps: welcome · residents ·
    **a letter from the red dot over the resident who wrote** (camera on them, the dot bigger and pulsing) · build · **mark the land** (a ✕ or a
    loop) · minister · **neighbours** (a nation's letter: "keep your relationships good") · **peek at the future** (a toggle: `game.future.enter /
    exit`) · **the Ministry** ("The Ministry will tell you the details from here").
  - **Cards are pop-comic print**: cream stock, bold ink outline, cream sticker edge, the pink drum off register (offset shadow), a corner of pink
    halftone; Montserrat body text.
  - **The Ministry directs**: the first jobs as a short list (top left: homes for the residents, a bakery, a field, then a well, a market …),
    a "say it" chip each; **all Ministry words are plain and short** (what happened, what to do).
  - **Call the Ministry** (button under the mailbox): a compact pop call card with the minister's portrait; the minister answers in **babble**
    (high, cute WebAudio chirps timed to the text) with an English live-translation subtitle; she speaks (hold Space / the mic) or types.
  - **Letters**: exactly **two** choices + a small quiet "not now" link, and a **"Write back…"** field; the sender answers in a short thread.

