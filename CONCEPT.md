# AGORA — a civilisation you speak into being

> **READ `ART_DIRECTION.md` FIRST. It holds Sueda's latest calls and overrides this file wherever they differ:** bird's-eye relief map, gouache only (no Riso), real 3D Earth→Moon, minimal UI.

Working title. A hackathon entry for an AI game-making hackathon. **Goal: win.** The judges see a 3–5 minute live demo, so every system serves a moment that reads instantly on stage.

## PRIORITIES (updated 2026-10-03, the hackathon is happening NOW)
1. **Voice → anything appears in the world, seamlessly.** This is THE memorable moment. A juror tries one sentence ("a giant lighthouse there", "a rubber duck in the lake", "a dragon statue in the square") and it has to land, beautifully. Generated objects are not limited to buildings: props, landmarks, statues, boats, trees, odd things.
2. **Developed, gorgeous world visuals** in the Red arch look, to show off: a living coastline, the neighbouring countries on the horizon fully built and coloured, and the camera's descent.
3. **Neighbouring countries you interact with, visibly.** Envoys (flits and floaties) fly letters in, caravans walk the road, and gifts you send physically travel. "Show me the neighbours" flies the camera there.
4. **Onboarding a juror can follow in 20 seconds:** a title card, the descent, then the first letter, which teaches "hold Space and speak". It comes with clickable example phrases and a **typed-command fallback** (noisy venues, no mic).
5. **A banger demo video**, recorded by a scripted **director mode** (`?director=1`) that plays the demo beats with captions. It must be reproducible, so we can re-record after every improvement.
6. The economy is **light**: enough for letters and refusals to have reasons. Never block creation on resources during the demo; costs are flavour.

### The creation moment ("pencil, then paint")
When something is spoken into being, it first appears as a **pencil underdrawing** on the cream paper, using the reference's own keyline world. The object is drawn into the line pass only, so only its pencil outline shows. Then **paint washes in** from the ground up. Colour also blooms into the paper ground around it. The folk rush over to "build" while this happens.
- **Known prefabs:** the drawing takes about 1 s, the paint about 3–5 s.
- **Unknown things:** a fast first call returns a **massing sketch** (a few primitives as JSON) within a few seconds, and it is drawn in pencil right away. The visual mind (Opus 5.5, fast mode when available) writes the full code meanwhile. When it lands, the sketch is replaced by the real object, which paints in. If codegen fails, the massing sketch itself is painted, so it **never fails visibly**.
- Every generated asset is cached and reusable ("another one over there" is instant).

## The pitch in one breath
You descend from the sky onto an empty, colourless cream plot of land by the sea, with rival settlements on the horizon. Little folk spawn around you. You can't click to build. **You speak.** "Let's put a house in the middle." "A windmill there" (pointing with the cursor). The folk walk off, carry crates and hammer, and the house rises, and colour bleeds into the paper world around it. The folk can't speak back. They **write you letters.** You learn who is good at what, appoint a minister, hold formal meetings, and keep them fed, housed and willing. When you ask for something nobody has built before, like a lighthouse, the **Ministry of Builds** writes that it will take time. The builders get to work while an AI writes the three.js code for it live, and it is raised in the world when it's done.

## Visual language: non-negotiable
Sueda's **"Red arch at sundown"** (`reference/red-arch-at-sundown.html`, sha256 in `reference/SHA256`) is the visual language. It is used **exactly as is**:
- the gouache pipeline (warped Kuwahara, proxy-world keylines, separation, print), the Riso / Gouache / Raw 3D editions and the Gouache settings panel
- the sky, sun, sea, ridges, lights, painting kit (bake / blob / ramps / pines / cypresses / bushes), the stone texture, and the clay cel shader
- **all seven creature species with their wardrobes and motion**: puffers (builders), loaves (bakers), drops (Mediterranean flair), scoots (couriers), flits (fliers), pips (walkers in sun hats) and floaties (parasol drifters)
- the palette, the CSS tokens, the Instrument Serif UI and the pill buttons

Shader code, materials, geometry, palettes and creature construction are **copied verbatim**, never "improved". New things (buildings, terrain, UI panels) are *authored in that grammar*: painted vertex colours from the fixed light `L`, Lambert on big planes with real shadows, clay cel material for small props, warm palette, no pure black or white, and no tone mapping or bloom. The only edits allowed in copied code are **behaviour hooks** (where creatures walk), not looks. The Red arch scene itself becomes the late-game **Assembly**, the civilised country's gathering place where formal meetings are held. It is rebuilt verbatim from the extracted modules.

Sueda's standing feedback for painted scenes:
- no human figures (the reference already removed them)
- fine, noisy things get smooth keyline proxies
- few big shapes, mid values, crisp silhouettes
- story over stills

## Core loop
1. **Speak.** Hold Space (or the mic pill) and talk. The words appear live as an italic caption, and the folk turn toward you to listen.
2. **Interpret.** The transcript, a compact world snapshot, and the cursor's ground point ("there") go to the **logic mind** (Claude Fable 5.1). It returns structured actions.
3. **Validate.** The simulation checks resources, workers, and each folk's willingness. Folk who refuse say so in a letter.
4. **Act in the world.**
   - A known building places instantly as a construction site: folk haul crates from the stockpile, hammer, and the building rises part by part.
   - An unknown building gets a Ministry of Builds notice ("we have never built a lighthouse; plans are being drawn"). The **visual mind** (Claude Opus 5.5) writes its three.js code against our Build API. The site works meanwhile, and the building is raised when the code arrives. It is cached forever after, so your civilisation *learned* to build lighthouses.
5. **Society answers.** Every ~90 s the logic mind looks at the state and writes 0–2 letters from folk: petitions, gossip, complaints, ideas, quarrels, and replies to your questions. The minister writes a report. You decide by voice. Your choices change moods, loyalty and the economy, and with them **prosperity**.

## Folk
- Every folk has a name, a species, a trade and **hidden skills** (0–10 in building, baking, farming, crafting, trading, diplomacy, art and scouting). Each also has 1–2 traits (proud, lazy, loyal, gossip, ambitious, timid, generous, stubborn), plus mood (0–100), loyalty (0–100) and energy.
- Each species has a leaning: puffers build, loaves bake, pips farm, scoots carry letters and trade, drops do art and diplomacy, flits scout, floaties dream and entertain. Individuals vary, so **you need to know your crowd**.
- Ask by voice ("who here is good at baking?") and folk answer by letter. Proud folk over-claim and timid ones under-claim. Skills you've learned show up on their cards.
- They **can't speak**, only write. A scoot courier physically walks each letter to the foreground, and the envelope then lands in your tray.
- Angry, tired or disloyal folk **refuse** or **strike**. At very low mood they may leave for a neighbour.
- **Minister**: you appoint one by voice. The minister writes the formal reports, chairs **meetings** (voice: "call a meeting"), and gives advice. A good diplomat makes a good minister, and a bad one may misreport.
- Formal meetings are held at the gathering place. The camera goes "up close" and the folk gather. Before the Assembly is built that is the town centre; once it exists it is the Red arch.

## Economy (simple, legible, enough to say no)
- **Resources**: food, wood, stone, coin and goods. Also tracked: population, housing, mood (the average) and prosperity (a score).
- **Start**: settlers' crates (wood 30, stone 20, food 40, coin 10) and the bare land. Nothing grows until you plant or build.
- Buildings have a cost, workers (with a preferred skill), build time, production or consumption per day, housing and an unlock stage.
- One **day** is 60 s. Each folk eats 1 food a day. Without housing, mood drains; without food, mood crashes. Groves you plant grow, and then a woodcutter yields wood.
- **Stages** follow prosperity: Camp → Hamlet → Village → Town → Civilisation. Stages unlock buildings, the Assembly arrives at Town, and newcomers arrive when you have housing and good mood.
- **Neighbours**: 3 AI settlements on the horizon, each with a name, a leader species and a temperament. They grow on their own and send letters (trade offers, envy, alliance, complaints). You answer by voice.

## Demo script (what has to be flawless)
1. **Descent:** the camera descends through painted sky onto the cream plot, past neighbours glowing with colour on the horizon. Title card.
2. **Spawn:** folk drop or pop into existence on the cream with a squash-and-stretch.
3. **First word:** "Let's build a house in the middle." The site appears, folk haul and hammer, the house rises, and colour blooms round it.
4. **Pointing:** "A windmill there" (cursor on a spot) builds a windmill there.
5. **Getting to know them:** "Who's good at baking?" brings 2–3 letters within seconds. "Make Olla our minister" changes the seal on the UI.
6. **The unknown:** "Build a lighthouse on the cliff" brings a Ministry of Builds notice. Folk work while the AI writes code, then the lighthouse rises: a new asset nobody shipped.
7. **Society:** a complaint letter ("we're hungry") prompts "build a bakery near the windmill". Someone refuses because they're tired, so you assign someone else.
8. **Meeting:** "Call a meeting" sends the camera up close, where the folk gather and the minister's report is read.

## Tech
- three.js r128 (vendored, the same build the reference loads). Plain ES modules, no bundler.
- A Node 22 server keeps the API keys on the server and offers `/api/command`, `/api/society`, `/api/letter`, `/api/codegen` and `/api/assets`. It uses `@anthropic-ai/sdk`. **Mock mode** runs when no key is set, so the game is fully playable and demoable offline.
- Models (configurable in `.env`): logic is `claude-fable-5-1` and visual (codegen) is `claude-opus-5-5`.
- Voice uses the Web Speech API in Chrome by default, with an optional Deepgram relay later.

## STORY ARC (added 2026-10-03): Earth, then the Moon
- **Act 1, Build (Earth).** The descent; speak your town into being on the cream coastal plot.
- **Act 2, Earth's nations.** Three rival nations sit on the horizon, each led by one of the reference species: a Loaf Republic, a Drop Riviera, a Flit Sky-hold. Their envoys fly letters in, and you trade and send gifts. As your town outshines them, they **elect you Earth's envoy** (a letter from all three).
- **Act 3, The Moon.** "Build a rocket" is a voice-generated asset. The camera lifts off through the painted sky, past a painted moon, to the **shadelings' world**: Sueda's `reference/alpine-lounge-final.html`, used **exactly as is**. That is three r147 with its own anisotropic-Kuwahara gouache, the lantern creatures on stilt legs, the golden-hour switch and the seed-drop. You speak there too: "offer them a seed", "wait for the evening", "we come in peace". It's driven only from outside, with synthetic pointer events on its canvas and clicks on its own buttons, so the file stays byte-identical. The shadelings answer by letter in their own voice.
- A painted moon/planet disc hangs in Earth's sky from the start, so the goal is visible.
- For jurors, "let's go to the moon" works any time after the first build: an election letter arrives in seconds.

## THE GLOBE (corrected 2026-10-03): the shape from Tower Planet, the LOOK from the Red arch
Sueda: "I don't want the world's toon look; I want the look from my first reference; I just gave the world for the shape of it."
- From `reference/the-tower-planet.html` take **only the shape and mechanics**: `mapFlat` (flat design space → sphere, RP 170), the terrain / heightfield approach, and the orbit ↔ surface camera logic.
- **Not** its toon materials, jelly creatures, print post, lens, fonts or palettes.
- **Everything is painted in the Red arch grammar** and rendered through the Red arch paint engine (`web/js/paint/`, Riso / Gouache / Raw editions, the verbatim post stack):
  - painted vertex-colour bake against the light `L`
  - Lambert big forms with soft shadows
  - the sea's colours and the sun from the reference
  - umbrella pines and cypresses from the kit
  - the gouache pass with pencil keylines from smooth proxies
- **Terrain comes from OUR map, not from Tower Planet** (Sueda: "the globe terrain doesn't need to be the same, we need to adapt it for the map anyways"). One flat world layout, `web/js/globe/geography.js`, is the single source of truth. It holds the coastline, the sea north of the plot (−z), the home plot = sim `state.plot` with its lake, the nations at the sim neighbour positions, and the land between. The globe wraps that layout onto the sphere with `mapFlat`. The gouache map reads the same layout, so a dive from orbit lands exactly on the map.
- **Earth.** Continents and sea. **Our plot** is a cream, uncoloured patch. The **three nations** are coloured towns in the Red arch architectural grammar (terracotta / red walls, arches, limestone). The **Moon** is a second small painted planet in space.
- **Opening.** Title over orbit, then a dive onto our cream patch, then a hand-off to the gouache map's descent. Then the folk spawn.
- **Overworld.** "Show me the neighbours" pulls up to orbit, spins to a nation and dives into it. Our town appears on the globe as it grows.
- **Voyage.** Up to orbit, a flight across to the Moon, a dive, then the Alpine lounge (verbatim; it's the shadelings' own world and look).
- **Opening choice (Sueda is undecided; build both, she picks by eye).** `?intro=globe` (default) gives a ~4 s orbit establishing shot (home cream patch, the nations, the Moon), then a dive to the map; any key or click skips it. `?intro=sky` lands directly, the camera dropping through the painted sky onto the map, and the globe is then seen first during the Moon voyage.
