# Minds — real AI agents (ART_DIRECTION §18)

Every one of our folk is its own small agent: a **persona** (cast once by Fable 5.1 at spawn), a private **memory stream** with periodic reflections, **relationships** that move with what happens, a **decision** every 30–40 s (Claude Haiku 4.5, `claude-haiku-4-5`) from the sim's executable action vocabulary, **conversations** with other folk (2–4 alternating Haiku turns, shown as bubbles above both), and a **director** (Fable 5.1, `claude-fable-5-1`) that steers the story at the start, every ~10 min, at milestones and on demand. The rules engine executes everything and is the safety net: a failed or late call, no credit, `AGORA_MINDS=off`, or the server being down all leave the folk living on the rules, with the same deterministic mock minds speaking for them.

Sueda's design question ("how do I get realistic individual personas? run the personas on Haiku and Fable as a director every hour?") is exactly this split: twelve cheap minds with a cached persona prefix, one expensive director with the whole picture, on a configurable cadence (`AGORA_DIRECTOR_EVERY_MS`; 10 min for the demo, hourly for real sessions).

```
web/js/sim/minds.js       pure: personas (cast, mock cast, tensions), memory + reflections, relationships, think / converse / reflect / direct
                          request bodies, the mocks, applyIntent / applyConversation / applyDirection, the sim's own observations
web/js/sim/mindloop.js    the scheduler: cadence, triggers, budget, concurrency, timeouts, fallback, the director's clock and milestones
server/minds.js           /api/minds/* (cast, think, converse, reflect, direct) + persona-aware /api/talk; schemas; the server budget; cost accounting
server/prompts/persona.md the shared rules block (world, action vocabulary, formats, examples, almanac): ONE cache entry for all twelve minds
server/prompts/cast.md, direct.md (Fable), converse.md, reflect.md (the per-call user-turn templates)
tests/sim/minds.test.mjs, tests/server/minds.test.mjs
```

```
export PATH=~/.nvm/versions/node/v22.22.3/bin:$PATH
node --test tests/sim/minds.test.mjs          # 8 tests: cast distinctness, intents executable, conversations, memory, director, the loop (mock + live fake), voices
node --test tests/server/minds.test.mjs       # 10 tests: routes in mock, schemas, live path with a fake client, budget, health cost, off mode
```

## What the game layer must do (web/js/game.js — not edited here)

1. **Create the loop after the sim and the net** and attach it:
   ```js
   import { createMindLoop } from './sim/mindloop.js';
   const minds = createMindLoop(game, {
     call: (route, body, { timeoutMs }) => net.minds(route, body, { timeoutMs }),   // POST /api/minds/<route>; see "net" below
     visible: () => !document.hidden,                                               // skip when the tab is hidden
     paused: () => ui.menuOpen || stages.scene !== 'world',                         // pause on menus / the globe / Plissé (the loop also pauses on the sim's own moon scene, fleetHold and meetings)
     mode: health.minds && health.minds.status === 'live' ? 'live' : 'mock',       // from GET /api/health; 'mock' answers locally without a server
     directorEveryMs: health.minds ? health.minds.directorEveryMs : 600000,
   });
   game.attachMinds(minds);   // game.tick(dt) now calls minds.update() once per frame
   minds.start();             // after the folk are spawned (opening landing): casts once, then the cadence; the director runs at the start
   ```
   `health.minds.status` is `'live' | 'mock' | 'off'`. On `'off'`, do not create the loop (the sim is unchanged). Without a server at all, `createMindLoop(game, {})` (no `call`) runs the mocks locally at the same cadence.
2. **`net.minds(route, body, { timeoutMs })`** (web/js/net/api.js, the net builder): `POST /api/minds/${route}` with the JSON body, resolving to the JSON answer. Client timeouts must sit **above** the loop's own: think 5 s (loop) vs 4.5 s (server); converse 12 s vs 2–4 × 4 s; reflect 8 s vs 7 s; cast 60 s vs 90 s server (use 95 s); direct 90 s vs 60 s. A 503 `{ code: 'off' }` or any error rejects: the loop falls back to the rules for that call.
3. **Bubbles.** Listen to `agent:say` as today. New kinds:
   - `{ kind: 'mind', agentId, text (≤ 12 words), intent, source: 'mind' | 'mock' | 'rules' | 'server-mock', ttl }`: the folk's own line as they decide.
   - `{ kind: 'chat', agentId, text (≤ 14 words), conversationId, turn, of, ttl }`: one line of a two-folk exchange, emitted `MIND.chatGap` 2.6 s apart, alternating speakers. Draw it above **that** speaker; the first line of a conversation also sends `agent:listen { agentId: the other }` so the listener turns. `conversation:start { conversationId, a, b, topic }` comes first (a walks over to b), `conversation:lines { conversationId, a, b, lines, affinity }` when the lines land, `conversation:end { conversationId, a, b, affinity, spawns }` after the last bubble.
4. **Pokes.** `minds.poke(agentId, reason)` on things only the game layer sees, if any; the sim already pokes on talk (`game.talk`), conflicts, decrees (minister set, conflict handled), a building done within 12 m, institution assignments, answered letters. `minds.direct('demand')` on a "what happens next?" command or a debug key.
5. **Status.** `mind:status` (emitted on every change and every failure): `{ mode: 'live' | 'mock' | 'rules', enabled, inFlight, calls: { cast, think, converse, reflect, direct }, failures, perMin, lastError: { kind, code, message, at } | null, cast, rulesUntil, director: { runs, lastAt, nextAt, pending }, agentId?, error? }`. Show it as one quiet line in the ledger (Tab) only; never a HUD. `mode: 'rules'` means five calls failed in a row and the rules carry the town for a minute. `minds.status()` returns the same object.
6. **Cost.** `GET /api/health` → `minds.usd.perHour` (a 10-minute window, estimated from usage × the rates table) and `minds.usd.total`; the ledger may show "≈ $x.xx/h" when live.
7. **Nothing else changes.** Talk is the same call (`net.talk(game.talkContext(id, text))`): after the cast the body carries `persona` + `mind` and the server routes it to Haiku with the persona prefix; the reply shape is unchanged. Letters, conflicts, ventures, institutions, elections all arrive through the existing events; the minds only *cause* more of them (`agent:intent` tells you why: `{ agentId, intent: { type, target?, text?, place? }, say, source, ok, applied, effects }`).

## Event contract (the sim emits; all plain JSON)
| event | payload | when |
|---|---|---|
| `mind:cast` | `{ count, tensions:[{ kind:'rivals'\|'friends'\|'crush'\|'grudge', a, b }] }` | the personas landed (live or mock) |
| `mind:status` | see above | the loop started/stopped, a call failed, the director ran |
| `agent:intent` | `{ agentId, intent:{ type, target?, text?, place? }, say, source:'mind'\|'mock'\|'rules'\|'server-mock'\|'conversation', ok, applied, effects:[…] }` | every decision, applied (`ok:false` = not now: busy, nobody to talk to…). `applied`: `work\|rest\|wander\|conversation\|help:site\|letter\|note\|venture\|vote\|refuse\|celebrate\|theft` |
| `agent:say` | `{ agentId, text, kind:'mind', intent, source, ttl }` / `{ agentId, text, kind:'chat', conversationId, turn, of, ttl }` | the folk's own line / one line of a conversation |
| `conversation:start` / `conversation:lines` / `conversation:end` | `{ conversationId, a, b, topic }` / `{ …, lines:[{ speaker, text }], affinity }` / `{ …, affinity, spawns:'none'\|'letter'\|'conflict' }` | an exchange begins (a walks to b) / its lines are known (bubbles follow) / the last bubble faded |
| `relationship` | `{ a, b, affinity (−1..1), delta, why }` | a bond moved (talked, helped, gossiped about, theft, quarrel, settled, the cast's tensions) |
| `mind:reflect` | `{ agentId, text }` | a reflection was added |
| `mind:note` | `{ from, to, text }` | a folk wrote to the minister (goes into the minister's memory) |
| `mind:direct` | `{ reason, arc_note, events:[kinds], nudges, briefing, applied:[{ kind, … }] }` | the director's hand landed |
| `world:weather` | `{ topic, text, day }` | a weather event (colour the sky / the bubbles if you like) |
| `festival` | `{ topic, text, by:'director' }` | the director's festival (everyone +5 mood, 4 food, three singers hop and sing) |

Existing events the minds feed: `letter:new` (complaints, petitions, visitor letters from a nation, the minister's briefing `kind:'report', meta.kind:'briefing'`), `conflict:start` (a theft from a `steal`, a quarrel from a conversation or the director), `venture:propose` (from `propose_venture` / an opportunity), `agent:refuse`, `agent:listen { hop:true }` (celebrate), `agent:task` (wander_to, help on a site, rest).

## The action vocabulary (what a think answer may ask for)
`work` · `rest` · `wander_to(place)` · `talk_to(agentId, opener)` · `help(agentId)` · `complain(topic)` · `propose_venture(idea)` · `write_letter(to:'sovereign'|'minister', gist)` · `vote(candidate)` · `refuse(task, why)` · `celebrate` · `steal` (only when the town is hungry / food < population, never for the loyal or generous; otherwise it becomes a complaint; it starts a theft conflict with a witness) · `gossip(about, to)`. Anything else is read as `work`. `applyIntent` carries each out through the sim's own systems (tasks, letters, ventures, conflicts, moods, affinities) and never breaks a busy task (couriers, journeys, meetings, formations, strikes).

## Memory, reflections, relationships
- `agent.mind = { memory:[{ t, day, text, imp 1–5, kind, about? }] (≤ 40), reflections:[{ t, day, text }] (≤ 6), unreflected, lastThinkAt, dueAt, trigger, intent, fails, calls, vote, source }`. Observations come from the sim itself (`wireObservations`: buildings done nearby, crews joined, conflicts, decrees, institution posts, ventures answered, letters answered, gifts carried, elections, refusals, hungry days), from talk (what the sovereign said and what they answered), from conversations (what was said to them, the outcome notes), from their own `memory_note`s, from the director (weather, festivals, goals).
- Every 8 new items a reflection is asked for (one Haiku call; the mock summarises: the person who keeps turning up, a theme, the goal). Prompts get the last 20 items (+ up to 3 old important ones) and 3 reflections; talk gets 8 + 2.
- `state.relationships['f1|f7'] = { a: −1..1, n, why }`. The cast's tensions set the start (rivals −0.35, friends +0.5, crush +0.4, grudge −0.5); conversations ±0.08 per outcome point, help +0.08, gossip −0.04 toward the subject, theft −0.3, quarrel −0.15/−0.2, a dispute settled by talk +0.1. `game.affinity(a, b)`, `game.relationships()` (the strongest), `relationshipsOf` per folk in prompts. The crowd's vote (`fleets.bond`) adds the affinity and +1.5 for a declared `vote`.
- Persisted in `game.state` (plain JSON: `personas`, `relationships`, `conversations`, `minds { cast, directions, arc, milestones, tensions, weather, sayQueue }`, `agents[].mind`). The snapshot carries `agents[].goal` and `minds: { cast, directions, arc (last note), weather?, bonds:[4 strongest] }` (< 600 chars).

## The director
`directRequest(reason)` → `{ reason, snapshot, personas (goal, fear, voice, mood, job), memories (last 5 + reflections per folk), relationships (8 strongest), tensions, story { arc, milestones, conflicts, institutions, ventures, letters, directions }, options }`. Answer `{ arc_note, events:[{ kind:'conflict'|'visitor'|'weather'|'festival'|'opportunity', agentIds, neighbourId, topic, text, severity }], nudges:[{ agentId, goal }], minister_briefing:{ subject, body } }` → `applyDirection`: a quarrel between two named folk (through `startConflict`, the minister's letter follows), a nation's visitor letter (by envoy, with "Welcome them" → a gift), weather (everyone remembers it; `world:weather`), a festival, an opportunity (that folk proposes a venture), goal nudges (the persona's goal is replaced and remembered at importance 4), the minister's briefing (a `report` letter from the minister, or the Ministry). Runs: at `start`, every `directorEveryMs` (wall clock), at milestones (`first_building`, `election`, `first_conflict`, `institution`, each once, at least 60 s apart), and on `minds.direct('demand')`.

## Cadence, budget, fallback (mindloop.js)
- First decisions `MIND.firstThinkAfter` 6 s after the cast, staggered across the folk; then every 30–40 s per folk (hashed, so a replay staggers the same way). Triggers (spoken to, a conflict involving them, a decree, a building done within 12 m, an institution post, an answered letter) pull the next decision to 1–3 s away.
- Budget: `maxPerMin` 40 persona calls per wall-clock minute, `concurrency` 3 in flight (think / converse / reflect; the cast and the director do not count), nothing scheduled while the tab is hidden, a menu is open, on the moon, while the squares stand or during a meeting (answers that land meanwhile are still applied; late answers are dropped).
- Timeouts: think 5 s, converse 12 s, reflect 8 s, cast 60 s, direct 90 s. On a timeout or an error the **rules answer for that folk** (`mockThink`, `source:'rules'`) and that folk backs off (8 s doubling to 120 s); five consecutive failures put the whole loop on the rules for a minute (`mode:'rules'`: thinks, conversations, reflections and even a due direction all answer from the local mocks, no call leaves the browser), then it tries live again. A failed conversation gets the mock lines; a failed direction the mock direction; a failed cast the mock cast. The sim's tasks never stop in any of these.
- The server has its own cap (`AGORA_MINDS_MAX_PER_MIN` 60): over it the routes answer from the mock with `meta.budget = true` (counted in `health.minds.budget.rejected`).

## Cost (12 minds, Haiku 4.5 personas, Fable 5.1 director)
Rates: Fable 5.1 $10 in / $50 out / $0.25 cache read per MTok (bundled `shared/models.md`); Haiku 4.5 $1 / $5 / $0.10 cache read / $1.25 cache write per MTok (**from memory, unverified**: the bundled docs carry no Haiku 4.5 rate table; `health.minds.usd.rates[model].source` says so; replace from the live pricing page when a key with credit is in hand). Haiku 4.5 caches a prefix only from **4096 tokens** (`shared/prompt-caching.md`), so `persona.md` is written past it (≈ 4.9k tokens by the 3.8 chars/token estimate in health): one cache entry for the shared rules serves all twelve minds, and each persona block (≈ 500 tokens) caches on top of it.

| call | per hour | tokens per call (est.) | $/call | $/hour |
|---|---|---|---|---|
| think (12 folk, every 35 s) | ≈ 1 230 | 4 900 cached read + 550 fresh in + 120 out | 0.0017 | 2.1 |
| converse (≈ 15 % of decisions, 3 turns) | ≈ 185 × 3 = 555 | 5 400 cached read + 350 in + 60 out | 0.0012 | 0.7 |
| reflect (every ~8 memories ≈ every 4 min per folk) | ≈ 180 | 5 400 cached read + 250 in + 60 out | 0.0011 | 0.2 |
| talk (the sovereign, ~10) | ≈ 10 | 5 400 cached read + 500 in + 60 out | 0.0014 | 0.01 |
| director, every 10 min (Fable, effort medium) | 6 | 7 000 in (≈ 1 400 cached from the 2nd) + 900 out (+ thinking) | ≈ 0.11 | 0.7 |
| **total, demo cadence** | | | | **≈ $3.7/h** |
| director hourly instead (Sueda's real-session idea) | 1 | | | **≈ $3.1/h** |
| cast (once) | 1 | 3 000 in + 4 500 out | ≈ 0.26 | – |
| if the shared prefix fell under the cache minimum | | 5 400 fresh in per persona call | 0.0066 | ≈ 13/h → keep `persona.md` long |

The server's `health.minds.usd.perHour` is the live number (a 10-minute window). `AGORA_MINDS_MAX_PER_MIN` and `MIND.maxPerMin` are the levers if the bill runs hot; `MIND.thinkEvery` the other.

## Live facts baked in (from the bundled Claude API docs)
- Haiku 4.5: `claude-haiku-4-5`, 200K context, 64K max output, structured outputs supported (`output_config.format`, `shared/tool-use-concepts.md`); no `thinking` param (omitted = off), no `output_config.effort`, no fallbacks beta (`plain: true` in `llm.js`); `maxRetries: 0` and short timeouts (the loop has the rules behind it).
- Fable 5.1 (cast, director): `betas: ['server-side-fallback-2026-07-01']`, `fallbacks: 'default'`, `output_config.effort: 'medium'`, structured outputs, no thinking param, `max_tokens` 16000; needs an org with 30-day retention.
- Every schema has 0 union-typed parameters (the 16 cap is tested); all keys required, `additionalProperties: false`; answers are re-validated (`normaliseThink` / `normaliseConverse` / `normaliseDirection`) and bad JSON falls back to the mock.
- Caching: `system` = `[shared rules (cache_control), persona (cache_control)]`, the volatile state in the user turn. Two breakpoints, both past the minimum once the shared block is read. Changing `persona.md` invalidates every mind's cache (write once per session).
- The live path is untested against the API (the key had no credit on 2026-10-04); `tests/server/minds.test.mjs` exercises it with a fake client (request shapes, both models, the fallback, the budget, the accounting).

## Mock mode
`AGORA_MINDS=mock` (or no key) and the browser's loop without a server both use `web/js/sim/minds.js`'s mocks: `mockCast` (16 hand-written seed characters, one each, opinions from the tensions and the others' traits), `mockThink` (a decision from the persona, the mood, hunger, who is nearby, the trigger and the day, in the persona's voice via `voicePrefix`), `mockConverse` (topic-matched two- to four-line exchanges in both voices), `mockReflect`, `mockDirect` (weather at the start, then a quarrel between the pair who get on worst, a festival when the mood is low, a cold nation's visitor, an opportunity for an ambitious folk; a briefing with real numbers). Deterministic (hashes, no rng stream), so `?seed=` replays are stable and tests can assert on them.
