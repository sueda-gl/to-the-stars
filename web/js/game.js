// ALOUD (was AGORA), the game. Her Tower Planet (ART_DIRECTION §12) is the title's orbit, the descent, the nations' towns
// and the voyage; HOME is the old seaside map (web/js/world, §21) the planet hands over to as we land (stages.js).
// Boot order: createPlanet (her renderer, scene, post, her loop body) -> the fine ground patch (game/fine-ground.js) ->
// the home geography (planet/home.js) -> the surface adapter (planet/adapter.js) -> her paint context (the flat camera)
// + the folk pass on top of her finish (planet/folkpass.js; the nations' own folk) -> createGame (the seaside map's water
// and nations) -> her facade (game/planet-world.js) -> the seaside map: its own renderer + paint context, createWorld
// ({dressing, autoBloom:false, input:{left:'none'}}), createFolk(makeNav), the Red arch painter (Gouache) -> Build API +
// library -> agents -> UI (font G, the §23 title) -> voice -> net -> marks / fillers -> stages (orbit, descents and the
// hand-off, Plissé) -> director (?director=1).
// Flags: ?intro=globe|sky|none  ?opening=play|auto|none  ?director=1  ?lab=1  ?seed=7  ?speed=0.5  ?font=A..G  ?autostart=1  ?minds=live|mock|off
// Everything here is wiring; the pieces live in web/js/game/*.js. docs/game.md describes it.

import { createPlanet } from './planet/planet.js';
import { createPlanetGeography } from './planet/home.js';
import { createSurfaceAdapter } from './planet/adapter.js';
import { createFolkPass } from './planet/folkpass.js';
import { createFineGround } from './game/fine-ground.js';
import { createPlanetWorld } from './game/planet-world.js';
import { createRenderer, createContext } from './paint/context.js';
import { createKit } from './paint/kit.js';
import { createFolk } from './paint/folk.js';
import { createBackdrop } from './paint/backdrop.js';
import { createPainter } from './paint/post.js';
import * as geography from './globe/geography.js';
import { createWorld, worldCamBase } from './world/world.js';
import { makeNav } from './world/nav.js';
import { frameTitlePlanet } from './ui/title.js';
import { createGame, letters as L, campSpots, MIND, INSTITUTION_SPECS, institutionKind } from './sim/index.js';
import { createMindLoop } from './sim/mindloop.js';
import { createBuildApi } from './buildings/api.js';
import { createLibrary } from './buildings/library.js';
import { createAgents } from './agents/agents.js';
import { createUI, DEFAULT_CHIPS, MORE_CHIPS } from './ui/ui.js';
import { createRewards } from './ui/rewards.js';
import { createVoice, langFromQuery } from './voice/voice.js';
import { createApi } from './net/api.js';
import { createDirector, DEFAULT_BEATS, isDirectorMode } from './director.js';
import { createStages } from './game/stages.js';
import { createCreation } from './game/creation.js';
import { createCommands } from './game/commands.js';
import { createDesk } from './game/desk.js';
import { createInput } from './game/input.js';
import { makeDirectorHooks } from './game/director-hooks.js';
import { createOpening } from './game/opening.js';
import { createPick } from './game/pick.js';
import { createOnboarding } from './game/onboarding.js';
import { createMailDots } from './game/mail-dots.js';
import { createMinistry } from './game/ministry.js';
import { createFutureToggle } from './ui/future-toggle.js';
import { createFuture } from './game/future.js';

const Q = new URLSearchParams(location.search);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const LOG = Q.get('log') != null;
const log = (...a) => { if (LOG) console.log('[agora]', ...a); };
const errors = [];
addEventListener('error', e => { errors.push(String(e.message || e.error)); });
addEventListener('unhandledrejection', e => { errors.push('rejection: ' + String(e.reason && e.reason.message || e.reason)); });

const seed = +(Q.get('seed') || 7) || 7;
const lab = Q.get('lab') === '1';
const director = isDirectorMode();
const intro = Q.get('intro') || 'globe';          // globe (her orbit, the title, her descent) | sky (a top-down drop) | none
const openingMode = Q.get('opening') || (isDirectorMode() ? 'auto' : 'play');   // play (click a minister) | auto (the best diplomat is picked) | none (old: spawn loose)
const speed = +(Q.get('speed') || 1) || 1;
const mindsFlag = Q.get('minds');                      // live | mock | off: overrides /api/health.minds.status (tests, a session without a key)
const boot = document.getElementById('boot');

// ---------- her planet (look code verbatim): the title's orbit, the descent, the nations' towns, the voyage ----------
const planet = createPlanet({ autoStart: false, input: false, fail: msg => { if (boot) boot.textContent = msg; } });
if (!planet) throw new Error('WebGL could not start');
planet.renderer.domElement.classList.add('ag-planet');
const fine = createFineGround(planet);                                   // task §3: 0.6 m ground under the home region
const geo = createPlanetGeography(planet, { drawn: fine });
const adapter = createSurfaceAdapter(planet, { geography: geo, drawn: fine });
const pctx = createContext({ renderer: planet.renderer, scene: planet.scene, camera: adapter.flatCamera, seed: 11 });
const pass = createFolkPass(planet, { adapter, ctx: pctx });
const pkit = createKit(pctx);

// ---------- the sim: the seaside map's own water and nations (createGame's layout = web/js/globe/geography.js) ----------
// the townsfolk companies (Sueda 2026-10-04: more folk, more kinds): nine each of loaves, twinkles, glims, moths; ?townsfolk=0 for the twelve alone
const game = createGame({ seed, name: 'Agora', offline: true, townsfolk: Q.has('townsfolk') ? +Q.get('townsfolk') || 0 : 9 });
try { game.state.camp = campSpots(game.state); } catch (e) { log('camp spots', e.message); }

// her surface facade: her camera (orbit, descents, the nations' visits) and the nations' towns with their own folk
const pworld = createPlanetWorld({ planet, geo, adapter, ctx: pctx, game, fine, log });
const pfolk = createFolk(pctx, pass.backdrop, makeNav(game, pworld));
pfolk.update(0.016, 0);
pass.attach(pfolk);
// her saved paint look, everywhere (web/assets/look.json): the master look is `trailer.t6_*` (brush, wobble, saturation, warmth,
// tooth, pooling, lines, lineWeight, lineStrength); a top-level `painter` section wins over it. Applied to both Red-arch
// painters (the seaside map's and her planet folk pass's) through their own applyG(); G_DEFAULT and her shaders untouched.
fetch('assets/look.json').then(r => r.json()).then(j => {
  if (!j) return;
  const look = {};
  for (const [k, v] of Object.entries(j.trailer || {})) if (k.startsWith('t6_')) look[k.slice(3)] = v;
  Object.assign(look, j.painter || {});
  if (!Object.keys(look).length) return;
  for (const p of [painter, pass.painter]) {
    if (!p || !p.G) continue;
    for (const k of Object.keys(look)) if (k in p.G) p.G[k] = look[k];
    try { p.applyG && p.applyG(); p.markDirty && p.markDirty(); } catch (e) { log('look', e.message); }
  }
  try { world.usePainter(painter); } catch (_) {}   // the map rescales the brush per view from G.brush: re-read its base
  log('look applied', JSON.stringify(look));
}).catch(() => {});
// "pencil, then paint" on her pipeline: the keyline proxies (ctx.lineOnly) exist only in her normal / depth pass,
// colour-only things (leaves, decals) never produce lines: the same swap the Red arch painter does, round her finish
planet.renderHook({
  beforeFinish() { for (const o of pctx.colourOnly) o.visible = false; for (const o of pctx.lineOnly) o.visible = true; },
  afterFinish() { for (const o of pctx.colourOnly) o.visible = true; for (const o of pctx.lineOnly) o.visible = false; }
});

// ---------- home: the old seaside map (ART_DIRECTION §21), exactly as in world-lab, + its trees and green spots ----------
// its own renderer (canvas.ag-sea, under hers), paint context, the Red arch backdrop and painter (Gouache only, §1)
const seaRenderer = createRenderer();
seaRenderer.domElement.classList.add('ag-sea');
const ctx = createContext({ renderer: seaRenderer, scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(46, innerWidth / innerHeight, 0.5, 1400), seed: 11 });
const kit = createKit(ctx);
const backdrop = createBackdrop(ctx, { camBase: worldCamBase() });
// §9: no colour bloom round new buildings; left belongs to the pencil (marks)
const world = createWorld(ctx, kit, game, { geography, backdrop, dressing: true, autoBloom: false, input: { left: 'none' } });
// the words the game's modules use that the map's rig spells differently (opening / stages / director hooks / rewards)
world.homePose = () => ({ ...world.rig.view });
world.jump = p => world.rig.setPose({ ...world.rig.pose(), ...p });
world.stop = () => world.rig.stop();
{ const proj = world.project; world.project = (x, y, z) => proj(x, y == null ? world.groundY(x, z) : y, z); }
if (world.lake && !world.lake.centre) { try { world.lake.centre = game.waterCentre('lake'); } catch (_) {} }
const nav = makeNav(game, world);
const folk = createFolk(ctx, backdrop, nav);
folk.update(0.016, 0);
const painter = createPainter(ctx, folk, { framing: world.framing });
painter.setMode(1);                                               // Gouache (§1: no Riso)
world.usePainter(painter);
painter.resize();
addEventListener('resize', () => painter.resize());
// built now (the title plays meanwhile): every program compiled and one painted frame at the hand-off pose
const seaReady = world.readyForHandoff({ painter }).catch(e => { log('seaside', e.message); return null; });

// ---------- building, agents ----------
const api = createBuildApi(ctx, kit, { keyDir: backdrop.KEY_DIR });
const papi = createBuildApi(pctx, pkit, { keyDir: pass.backdrop.KEY_DIR });       // the nations' towns on her planet
const lib = createLibrary(ctx, kit, { api, onError: ({ id, error }) => log('library', id, error && error.message) });
const agents = createAgents(ctx, folk, game, world, {});
const net = createApi({ log });
let live = false;
const agentOf = id => game.state.agents.find(a => a.id === id) || null;

// ---------- stages, UI ----------
const stages = createStages({ game, world: pworld, planet, geo, agents, log, sea: { world, painter, canvas: seaRenderer.domElement, ready: seaReady, camera: ctx.camera } });
let releaseTitle = null;                              // frameTitlePlanet's release (the title framing eases back to hers at Begin)
let commands = null, voice = null, marks = null, desk = null, creation = null, input = null, fillers = null, opening = null, pick = null, onboarding = null;
let minds = null, mindsStarted = false;               // the agent minds' loop (ART_DIRECTION §18), created after /api/health

// a spoken / typed command: "what happens next?" is the director's cue (docs/minds.md §4); everything else is the Ministry's
function handleCommand(text, opts = {}) {
  if (game.future && game.future.active) return game.future.command(text, opts);   // the peek at the future: nothing reaches her real game
  if (minds && /\b(what|and)\s+(happens|comes)\s+next\b|\bwhat'?s\s+next\b|\bnext\s+chapter\b/i.test(String(text || ''))) {
    try { minds.direct('demand'); } catch (e) { log('direct', e.message); }
    ui.notice('The story turns a page…', { kind: 'ministry', ttl: 3600 });
    return { actions: [], say: null, director: true };
  }
  return commands && commands.handle(text, opts);
}

// ---------- the folk, for the card and the talk (ART_DIRECTION §11) ----------
const workplaceOf = a => { const id = a && (a.workplaceId || a.jobId); const b = id ? game.state.buildings.find(x => x.id === id) : null; return b ? b.name : null; };
function dressed(a) {
  if (!a) return null;
  let wears = null; try { const idn = agents.identity(a.id); wears = idn && idn.words || null; } catch (_) {}
  const v = (game.state.ventures || []).filter(x => x.agentId === a.id).pop();
  const venture = v ? { name: v.title, status: v.status === 'done' ? 'open' : v.status === 'declined' ? null : (v.status === 'proposed' ? 'proposed' : 'started') } : null;
  return { ...a, ...(wears ? { wears } : {}), ...(venture && venture.status ? { venture } : {}) };
}
const lastSaid = new Map();
const uiDrawsBubble = id => !!(ui && ui.talk && ui.talk.isOpen && ui.talk.agentId === id);
function dropBridgeBubble(id) { try { agents.clearBubble(id); document.querySelectorAll(`.agb[data-agent="${id}"]`).forEach(e => e.remove()); } catch (_) {} }
async function talkTo(id, text) {
  let res = null;
  try { res = await net.talk(game.talkContext(id, text)); } catch (e) { log('talk', e.message); }
  const r = game.talk(id, text, res && res.reply ? res : undefined);
  return (r && r.reply) || '';
}
const replyTo = (id, says) => { if (id !== 'ag-welcome' && id !== 'meeting') { try { game.markRead(id); } catch (_) {} } return commands && commands.handle(says, { source: 'chip' }); };
const ui = createUI({
  font: 'M',                                        // ART_DIRECTION §24: Montserrat everywhere (css/aloud.css); the title keeps Melodrama
  onCommand: (text, source) => handleCommand(text, { source }),
  onLetterOption: replyTo,
  onLetterRead: () => { try { mailDots && mailDots.refresh(); } catch (_) {} },      // §24: the red dot goes with the last unread letter
  onAgentAction: (id, what) => {
    if (typeof id === 'string' && id.startsWith('neighbour:')) {
      const nid = id.slice('neighbour:'.length);
      if (what === 'visit') game.apply({ type: 'visit_neighbour', neighbourId: nid });
      else if (what === 'gift') game.apply({ type: 'send_gift', neighbourId: nid, gift: 'a basket of bread', give: { food: 3 } });
      return;
    }
    if (what === 'minister') game.apply({ type: 'appoint_minister', agentId: id });
  },
  onTalk: (id, text) => talkTo(id, text),
  // §24: her own words written back under a letter: a build said as a reply is done; else the sender answers (the
  // resident through Talk / the minds, the mocks offline; the Ministry with its advice; a nation politely)
  onWriteBack: async (L, text) => {
    const f = (L && L.from) || {};
    try { game.markRead(L.id); } catch (_) {}
    if (/^(please\s+)?(build|make|plant|put|place|dig|raise|add|open)\b|^(a|an)\s+\w+/i.test(text)) { handleCommand(text, { source: 'typed' }); return { who: f.name, text: 'Thank you! We will start right away.' }; }
    if ((f.kind === 'agent' || f.kind === 'minister') && agentOf(f.id)) { const r = await talkTo(f.id, text); return { who: f.name, text: r || 'Thank you for writing back.' }; }
    if (f.kind === 'ministry') return { who: 'Ministry of Builds', text: ministry.advise(text) };
    if (f.kind === 'neighbour') return { who: f.name, text: 'Thank you for your kind words, neighbour. We will remember them.' };
    return { who: f.name || 'They', text: 'Thank you.' };
  },
  bubble: (id, text, { thinking } = {}) => {
    if (uiDrawsBubble(id)) { dropBridgeBubble(id); return false; }
    try {
      if (thinking) { agents.bubble(id, '', { tone: 'think', ms: 0 }); return true; }
      if (lastSaid.get(id) === text) return true;
      agents.bubble(id, text);
      return true;
    } catch (_) { return false; }
  },
  onStart: () => { if (releaseTitle) { const r = releaseTitle; releaseTitle = null; r(1400); } begin(); },
  onMic: down => { if (!voice) return; if (down) voice.start(); else voice.stop(); },
  onOnboardingDone: () => {},
  lookup: {
    agent: id => dressed(agentOf(id)), neighbour: id => game.state.neighbours.find(n => n.id === id) || null,
    anchor: id => { try { return agents.screenOf(id); } catch (_) { return null; } },
    workplace: a => workplaceOf(a)
  },
  getPortrait: id => (agents.portrait ? agents.portrait(id, { size: 96, ring: false }) : null),
  paintChrome: lab, holdMs: 200
});
// ---------- rewards (ART_DIRECTION §22b): the tally under the name; reward:gain -> a "+n" stamp over the new thing, tokens into the tally ----------
let rewards = null;
try {
  rewards = createRewards({
    layer: ui.el, anchor: ui.el.querySelector('.ag-place'),
    locate: p => {
      const b = p.buildingId ? game.state.buildings.find(x => x.id === p.buildingId) : null;
      const x = b ? b.x : p.x, z = b ? b.z : p.z;
      if (!Number.isFinite(x) || !Number.isFinite(z)) return null;
      const s = world.project(x, null, z);
      return s && Number.isFinite(s.x) ? { x: s.x, y: s.y - 30, behind: !!s.behind || s.visible === false } : null;
    },
    busy: () => stages.scene !== 'world' || ui.titleCard.visible || ui.meeting.visible || ui.el.classList.contains('is-cinema')
  });
  rewards.attach(game);
} catch (e) { log('rewards', e.message); }
game.on('agent:say', ({ agentId, text, kind, conversationId }) => {
  if (agentId == null || !text) return;
  lastSaid.set(agentId, String(text));
  if (kind === 'talk' && uiDrawsBubble(agentId)) dropBridgeBubble(agentId);
  // §18: a line of a two-folk conversation: the bridge drew the bubble over this speaker; the two turn to face each other
  // for the bubble's life (the listener toward the speaker, the speaker toward the listener: never the lens, that is talk)
  if (kind === 'chat' && conversationId) {
    const c = (game.state.conversations || []).find(x => x.id === conversationId); if (!c) return;
    const other = c.a === agentId ? c.b : c.a;
    const sp = agents.get(agentId), li = agents.get(other);
    if (!sp || !li || !sp.a || !li.a) return;
    const until = (sp.talkUntil || 0) + 0.6;                      // the bridge's clock: bubble() set talkUntil = now + the bubble's life
    li.faceAt = { x: sp.a.pos.x, z: sp.a.pos.z }; li.faceUntil = until;
    sp.faceAt = { x: li.a.pos.x, z: li.a.pos.z }; sp.faceUntil = until;
  }
});

// ---------- the minds (ART_DIRECTION §18, docs/minds.md "What the game layer must do") ----------
// Bubbles: the bridge already draws every agent:say over its folk (kind 'mind' = a folk's own line as it decides, kind 'chat' = one
// line of a conversation, 2.6 s apart, alternating speakers). Everything else the minds emit is a quiet line in the ledger (Tab) only.
const nameOf = id => { const a = agentOf(id); return a ? a.name : 'someone'; };
const quiet = text => { try { ui.ledger.note(text); } catch (_) {} };
const BOND_WHY = {
  rivals: (A, B) => `${A} and ${B}: rivals from the first day`, friends: (A, B) => `${A} and ${B}: old friends`,
  crush: (A, B) => `${A} has a soft spot for ${B}`, grudge: (A, B) => `${A} holds a grudge against ${B}`,
  help: (A, B) => `${B} helped ${A} with the work`, theft: (A, B) => `${A} will not forget ${B}'s theft`, quarrel: (A, B) => `${A} and ${B} quarrelled`,
  settled: (A, B) => `${A} and ${B} made up`, gossip: (A, B) => `${A} talked about ${B} behind their back`
};
const warmth = v => (v >= 0.5 ? 'close now' : v >= 0.2 ? 'getting on' : v <= -0.5 ? 'at odds' : v <= -0.2 ? 'cool with each other' : 'neither warm nor cold');
game.on('mind:cast', ({ count }) => quiet(`${count} folk, each with a life behind them: the personas are cast.`));
game.on('relationship', ({ a, b, delta, why, affinity }) => {
  if (Math.abs(delta || 0) < 0.08) return;
  const A = nameOf(a), B = nameOf(b), f = BOND_WHY[why];
  quiet(f ? f(A, B) : why === 'talked' ? `${A} and ${B} talked and are ${warmth(affinity)}` : `${A} and ${B}: ${delta > 0 ? 'warmer' : 'cooler'}${why ? ' (' + why + ')' : ''}`);
});
game.on('conversation:end', ({ a, b, affinity, spawns }) => quiet(`${nameOf(a)} and ${nameOf(b)} talked; ${warmth(affinity)}${spawns === 'letter' ? ', and a letter followed' : spawns === 'conflict' ? ', and it ended in a quarrel' : ''}.`));
game.on('mind:reflect', ({ agentId, text }) => quiet(`${nameOf(agentId)} reflects: ${text}`));
game.on('mind:note', ({ from, text }) => quiet(`${nameOf(from)} wrote to the minister: ${text}`));
game.on('mind:direct', ({ reason, arc_note, events, briefing }) => quiet(`The story turns${arc_note ? ': ' + arc_note : ''}${events && events.length ? ' (' + events.join(', ') + ')' : ''}${briefing ? '; the minister writes' : ''}.`));
game.on('world:weather', ({ text }) => { if (text) quiet(text); });
game.on('festival', ({ text }) => { if (text) quiet(text); });
let lastMindMode = null, mindHealth = null;
// the server answers 'live' even when it reached for the models and fell back to its mock (no credit, a failed call):
// the sources of the last twelve decisions say so (source 'server-mock'), and the ledger's line says "answered offline"
const recentSources = [];
const mindFallback = () => recentSources.length >= 4 && recentSources.filter(s => s === 'server-mock').length >= recentSources.length * 0.75;
const mindLine = (s = minds ? minds.status() : null) => { if (!s) return; try { ui.ledger.setMind({ mode: s.mode, cast: s.cast, castCount: Object.keys(game.state.personas || {}).length, calls: Object.values(s.calls || {}).reduce((x, y) => x + y, 0), perHour: mindHealth && mindHealth.usd ? mindHealth.usd.perHour : null, fallback: s.mode === 'live' && mindFallback() }); } catch (_) {} };
game.on('agent:intent', ({ source }) => { if (!source || source === 'conversation') return; const was = mindFallback(); recentSources.push(source); if (recentSources.length > 12) recentSources.shift(); if (mindFallback() !== was) mindLine(); });
game.on('mind:status', s => {
  mindLine(s);
  if (s.mode !== lastMindMode) {
    if (lastMindMode != null || s.mode !== 'live') quiet(s.mode === 'live' ? 'The folk think for themselves again (live minds).' : s.mode === 'rules' ? 'The minds are resting; the rules carry the town for a minute.' : 'The folk think with their own words (offline minds).');
    lastMindMode = s.mode;
  }
});
// the fleet captions may carry the cast persona's one-line backstory when the cast has landed by then (docs/minds.md), else not
function backstoryLine(fleetName) {
  const f = (game.state.fleets || []).find(x => x.name === fleetName), P = game.state.personas || {};
  for (const id of (f && f.members) || []) {
    const p = P[id]; if (!p || !p.backstory) continue;
    let s = String(p.backstory).split(/(?<=[.!?])\s/)[0].trim(); if (!s) continue;
    if (s.length > 110) { const c = s.slice(0, 109).lastIndexOf(', '); s = c > 50 ? s.slice(0, c) + '.' : s.slice(0, 108).replace(/\s+\S*$/, '') + '…'; }   // a clause, not a cut word
    const a = agentOf(id);
    return a && !s.startsWith(a.name) ? `${a.name} — ${s}` : s;
  }
  return null;
}
{ const capt = ui.fleet.caption; ui.fleet.caption = (o = {}) => capt({ ...o, note: o.note !== undefined ? o.note : backstoryLine(o.name) }); }
// the cast at spawn: after the fleets form (the squares), before the introductions; the loose spawn (?opening=none) casts right away
game.on('fleet:form', () => { if (minds) { try { minds.cast(); } catch (e) { log('cast', e.message); } } });
// the loop starts after the election (the seal), or when the squares break without one (the sim's 90 s net); the first
// decisions are re-staggered from that moment, so twelve folk do not all speak in the same second
function staggerMinds(first = MIND.firstThinkAfter) {
  const S = game.state, folk = S.agents.filter(a => a.status !== 'left'), n = Math.max(1, folk.length);
  folk.forEach((a, i) => { if (a.mind) { a.mind.dueAt = S.t + first + i * (MIND.thinkEvery[0] / n); a.mind.trigger = null; } });
}
function startMinds(why = '') {
  if (!minds || mindsStarted) return; mindsStarted = true;
  try { minds.start(); } catch (e) { log('minds start', e.message); return; }
  staggerMinds();
  log('minds started', why, minds.status().mode);
}
game.on('minister:set', () => startMinds('minister'));
// the squares break (the ceremony's end, or the sim's net): the loop's own pokes (the decree) fell due while the squares stood,
// so the first round is spread again from this moment (one folk every ~2.5 s, not twelve at once)
game.on('fleet:release', () => { startMinds('released'); if (minds && mindsStarted) staggerMinds(2); });
ui.hud.set({ name: game.state.name, stage: game.state.stage, day: 1, prosperity: 0, prosperityMax: 36, resources: { ...game.state.resources } });

// ART_DIRECTION §24: no tags over heads; a folk with unread mail gets a red dot (game/mail-dots.js); its click reads the letter
function openInInbox(id) {
  try {
    const Lt = ui.letters.all.find(l => l.id === id) || game.state.letters.find(l => l.id === id);
    if (Lt && ui.letters.openCompact) ui.letters.openCompact(Lt); else ui.letters.open(id);
  } catch (e) { log('open letter', e.message); }
}
const mailDots = createMailDots({ ui, agents, stages, open: id => openInInbox(id) });
// §24: the Ministry of Builds directs her (the first jobs, top left) and answers the phone (babble + subtitles)
const ministry = createMinistry({ game, ui, agents, log, talkTo: (id, text) => talkTo(id, text),
  command: text => handleCommand(text, { source: 'chip' }),
  mindsLive: () => { try { return !!minds && minds.status().mode === 'live' && !mindFallback(); } catch (_) { return false; } } });
// "peek at the future" (game/future.js, another hand: game.future.enter / exit, guarded on .ready): the onboarding's step and, after it, a corner switch
const futureToggle = createFutureToggle({ layer: ui.el, future: () => game.future || (window.__agora && window.__agora.future) || null, log });
// off the seaside (her orbit, a flight, Plissé) the folk's speech bubbles stay home with them (they were drawn over her planet)
stages.onChange(s => document.body.classList.toggle('ag-aloft', s !== 'world'));

const MOON_CHIPS = ['Offer them a seed', 'Wait for the evening', 'We come in peace', 'Let’s go home'];
stages.onChange(s => { try { ui.voiceBar.setChips(s === 'moon' ? MOON_CHIPS : [...DEFAULT_CHIPS, ...MORE_CHIPS]); } catch (_) {} });

// ---------- institutions (ART_DIRECTION §20): "start a police patrol" -> "Who joins the Police Patrol? click folk, then Done" ----------
const titleCase = t => String(t || '').replace(/\b\p{L}/gu, c => c.toUpperCase());
function institutionName(a) {
  if (a.name) return a.name;
  const text = String(a.kind || a.request || ''), kind = institutionKind(text), spec = INSTITUTION_SPECS[kind] || INSTITUTION_SPECS.generic;
  if (kind === 'generic') return titleCase(text.replace(/^(start|found|form|set up|make|create|open)\s+/i, '').replace(/^(a|an|the|our|new)\s+/i, '').replace(/\b(team|group)\b/g, '').trim()) || spec.name;
  return spec.name;
}
function pickMembers(a, { apply }) {
  if (!pick || (opening && opening.active) || stages.scene !== 'world') return false;
  const name = institutionName(a), kind = institutionKind(a.kind || a.request || ''), spec = INSTITUTION_SPECS[kind] || INSTITUTION_SPECS.generic;
  const want = Number(a.members ?? a.count) > 0 ? Math.round(Number(a.members ?? a.count)) : null;
  pick.start({
    title: `Who joins the ${name}?`, hint: want ? `Click ${want} folk, then Done` : `Click folk (${spec.members} or so), then Done`, min: 1, max: 8,
    onDone: ids => { const r = apply(ids); if (!(r && r.ok !== false)) { try { ui.notice((r && r.reason) || `The ${name.toLowerCase()} could not be formed.`, { kind: 'minister', ttl: 5000 }); } catch (_) {} } },
    onCancel: () => { try { ui.notice(`No ${name.toLowerCase()} for now. Say it again when you are ready.`, { kind: 'ministry', ttl: 4500 }); } catch (_) {} }
  });
  try { ui.notice(`${name}: click the residents who join, then Done.`, { kind: 'ministry', ttl: 4000 }); } catch (_) {}
  return true;
}

// ---------- the sim -> the screen ----------
game.on('minister:set', ({ agentId }) => { try { ui.ministerSeal.set(agentOf(agentId), { quiet: !!(opening && opening.active) }); ui.agentCard.refresh(); } catch (_) {} });
game.on('stage', ({ stage }) => { if (!rewards) ui.notice(`We are a ${stage} now.`, { kind: 'ministry', ttl: 5000 }); });   // with rewards: the level-up banner
game.on('election:result', ({ agentId, by }) => { if (by === 'crowd' && !(opening && opening.active)) { const a = agentOf(agentId); ui.notice(`The folk have voted: ${a ? a.name : 'someone'} carries the minister's seal.`, { kind: 'ministry', ttl: 6000 }); } });
game.on('venture:start', ({ agentId, title }) => { const a = agentOf(agentId); ui.notice(`${a ? a.name : 'Someone'} is starting ${/^(a|an|the)\s/i.test(title) ? title : 'a ' + String(title).toLowerCase()}.`, { kind: 'info', ttl: 5000 }); });
game.on('venture:done', ({ agentId, title }) => { const a = agentOf(agentId); ui.notice(`${a ? a.name + '’s' : 'The'} ${String(title).toLowerCase()} is open.`, { kind: 'info', ttl: 5000 }); try { ui.agentCard.refresh(); } catch (_) {} });
game.on('show', ({ target }) => { (target === 'globe' ? stages.showGlobe() : stages.homeFromGlobe()).catch(e => log('show', e.message)); });
game.on('neighbour:visit', ({ neighbourId }) => { stages.visitNation(neighbourId).then(() => stages.homeFromGlobe()).catch(e => log('visit', e.message)); });
game.on('voyage:start', () => { stages.goMoon().catch(e => log('moon', e.message)); });
// act 3 lands in stages (Plissé, the dive, the lounge: ~35 s): a seed, the evening or "home" said during the voyage waits for the lounge
const whenLanded = async () => { const t0 = performance.now(); while (performance.now() - t0 < 90000 && (stages.flying || (stages.scene === 'moon' && !stages.driver))) await sleep(200); };
game.on('voyage:home', () => { whenLanded().then(() => stages.goHome()).catch(e => log('home', e.message)); });
game.on('moon:do', ({ do: d }) => {
  if (d !== 'seed' && d !== 'golden_hour' && d !== 'daylight') return;
  whenLanded().then(() => {
    const drv = stages.driver; if (!drv || stages.act3 !== 'lounge') { log('moon:do', d, 'not in the lounge'); return; }   // stages.driver = the Alpine lounge's driver (lounge-driver.js)
    return d === 'seed' ? drv.dropSeed('auto') : drv.setGoldenHour(d === 'golden_hour');
  }).catch(e => log('moon:do', e.message));
});
game.on('gift:arrive', ({ neighbourId }) => { const n = game.state.neighbours.find(x => x.id === neighbourId); if (n) ui.notice(`${n.title || n.name} received our gift.`, { kind: 'neighbour', neighbourId, ttl: 4500 }); });
game.on('election', () => ui.notice('The three nations have elected us Earth’s envoy.', { kind: 'neighbour', ttl: 6000 }));
const THRESH = { camp: 36, hamlet: 70, village: 115, town: 230, civilisation: 400 };
function feedHud() {
  if (game.future && game.future.active) return;                  // the future's tally stands while she peeks
  const s = game.state;
  ui.hud.set({ name: s.name, stage: s.stage, day: s.day, prosperity: Math.round(s.prosperity), prosperityMax: THRESH[s.stage] || 400, resources: { ...s.resources } });
  if (rewards && rewards.idle && game.rewards) { try { const t = game.rewards.totals(); rewards.setTotals(t); rewards.setCiv({ level: t.level, progress: t.levelProgress }); } catch (_) {} }
  ui.neighbours.set(s.neighbours.map(n => ({ id: n.id, name: n.title || n.name, attitude: n.attitude, allied: !!n.allied, leaderSpecies: n.leaderSpecies, leaderName: n.leaderName })));
  if (ui.letters.openId) { try { game.markRead(ui.letters.openId); } catch (_) {} }
}

// ---------- the loop: the sim and the folk in flat space, the leader camera, then her frame (+ the folk pass) ----------
// ---------- the loop: the sim; the seaside map (its rig, the folk, the painter) while it is home; her frame while she shows ----------
const clock = new THREE.Clock();
let simOn = false, raf = 0, seaSig = '';
const perf = { frames: 0, ms: 0 };
function frame(now) {
  const dt = Math.min(clock.getDelta(), 0.1), t = clock.elapsedTime;
  const t0 = performance.now();
  try {
    stages.beforeFrame(now);                                 // the landing / lift shot: the map's camera for this frame, the swap in the cloud
    if (simOn && !(game.future && game.future.active)) game.tick(dt);   // paused while she peeks at the future (game/future.js)
    input && input.update(dt);
    world.update(dt, t);                                     // the map's rig: its tweens resolve even while it is hidden
    world.rig.place();                                       // the camera every frame (§19), before the overlays are placed
    if (stages.scene !== 'moon' || stages.fading) {
      folk.update(dt, t);
      agents.update(dt, t);
      lib.update(t);
      creation && creation.update(dt);
      game.future && game.future.update(dt, t);
    }
    if (stages.paintSea) {
      // §19: the painter holds the world at 24 fps; while the camera moves it repaints every frame (no held-frame judder)
      const c = world.rig.cur, sig = `${c.tx.toFixed(3)}|${c.ty.toFixed(3)}|${c.tz.toFixed(3)}|${c.yaw.toFixed(4)}|${c.pitch.toFixed(4)}|${c.dist.toFixed(3)}|${c.fov.toFixed(3)}`;
      if (sig !== seaSig) { seaSig = sig; painter.markDirty(); }
      painter.frame(dt, t, tt => world.beforeDraw(tt));
    }
    if (stages.paintPlanet) {
      pworld.update(dt, t);
      pfolk.update(dt, t);
      planet.frame(now);
    }
    stages.afterFrame(now);                                  // the cloud over both canvases, seen by the live camera
  } catch (e) { errors.push('frame: ' + e.message); console.error('[agora] frame', e); }
  perf.frames++; perf.ms += performance.now() - t0;
  raf = requestAnimationFrame(frame);
}

// ---------- the opening ----------
let began = false, skipped = false, introDone = false;
async function runIntro() {
  // the descent ends on the opening's LANDING pose (low oblique, ART_DIRECTION §15), so the folk are seen coming down
  const to = opening && openingMode !== 'none' ? opening.landingPose() : undefined;
  if (intro === 'globe') { await stages.diveHome({ skip: skipped, to }); }
  else if (intro === 'sky') { await stages.diveHome({ skip: true, to }); if (!skipped) { const p = world.descent({ to: { ...world.homePose(), ...(to || {}) }, ms: 6000, from: 'sky' }); await p; } }
  else { await stages.diveHome({ skip: true, to }); }
  introDone = true;
}
function skipIntro() { if (introDone || skipped) return; skipped = true; try { stages.skipDive(); } catch (_) {} try { world.stop(); } catch (_) {} }
addEventListener('keydown', e => { if (began && !introDone && e.key !== 'Shift') skipIntro(); }, true);
addEventListener('pointerdown', () => { if (began && !introDone) skipIntro(); }, true);

async function begin({ spawn = true, onboarding: guided = true } = {}) {
  if (began) return; began = true;
  if (!director && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) navigator.mediaDevices.getUserMedia({ audio: true }).then(s => s.getTracks().forEach(tr => tr.stop())).catch(() => {});
  simOn = true;
  await runIntro();
  if (spawn) {
    if (openingMode === 'none' || !opening) {
      game.spawnAll({ fleets: openingMode !== 'none' }); await sleep(1400);
      if (openingMode === 'none' && minds) { try { minds.cast(); } catch (e) { log('cast', e.message); } startMinds('loose spawn'); }   // no squares, no election: cast and think at once
    }
    // §24: the six-step onboarding panel drives the opening (the fleets, the election) by real game events
    else if (guided && openingMode === 'play' && !director && onboarding) { try { await onboarding.run(); } catch (e) { log('onboarding', e.message); } }
    else { if (!director) ui.cinema(true); try { await opening.run({ auto: openingMode === 'auto' }); } catch (e) { log('opening', e.message); } if (!director) ui.cinema(false); }
  }
  if (desk) desk.startSociety();
}

// ---------- boot ----------
(async () => {
  let createMarks = null, createFillers = null, createTrees = null;
  try { ({ createMarks } = await import('./marks/marks.js')); } catch (e) { log('no marks module', e.message); }
  try { ({ createFillers } = await import('./buildings/fill.js')); } catch (e) { log('no fill module', e.message); }
  try { ({ createTrees } = await import('./buildings/painted-trees.js')); } catch (e) { log('no painted trees', e.message); }

  opening = createOpening({ game, world, ui, agents, marksRef: () => marks, log });
  pick = createPick({ game, ui, agents, log });                        // §20: she clicks an institution's members
  onboarding = createOnboarding({ game, ui, world, agents, opening, ministry: () => ministry, futureToggle, mailDots, log, showCard: (a, at) => ui.agentCard.show(dressed(a), at, { isMinister: game.state.minister === a.id }),
    voyage: { go: async () => { if (futureToggle && futureToggle.on) { try { await futureToggle.set(false); } catch (_) {} } return stages.goMoon(); },
      home: () => stages.goHome(), landed: () => !stages.flying && stages.scene === 'moon' && stages.act3 === 'lounge' && !!stages.driver,
      away: () => stages.flying || stages.scene === 'moon', golden: async () => { const d = stages.driver; if (d && d.setGoldenHour) return d.setGoldenHour(true); } } });   // §24: the nine steps, one small panel
  ui.onboarding.attach(onboarding);
  input = createInput({ ctx, world, agents, ui, game, stages, marksRef: () => marks,
    onFolkClick: (agent, at) => { if (pick.active) { pick.toggle(agent.id); return true; } if (opening.onFolkClick(agent, at)) return true; ui.agentCard.show(dressed(agent), at, { isMinister: game.state.minister === agent.id }); return true; },
    onFolkHover: id => { if (pick.active) pick.hover(id); else opening.onFolkHover(id); }
  });
  stages.onChange(s => { if (s !== 'world' && pick.active) pick.cancel(); });
  if (createMarks) {
    try {
      marks = createMarks(ctx, world, { onChange: ({ current }) => { try { game.setMark(current); } catch (_) {} }, buildings: () => game.state.buildings, ignore: e => input.overFolk(e) });
      if (world.adoptMarks) world.adoptMarks(marks);                 // (her planet's facade only: the pencil on the sphere)
      stages.onChange(s => marks.setEnabled(s === 'world' && !(opening && opening.active)));
    } catch (e) { log('marks failed', e.message); marks = null; }
  }
  if (createFillers) {
    try { fillers = createFillers(ctx, kit, api, { trees: createTrees ? createTrees(ctx, kit, { seed: 5 }) : null, groundY: (x, z) => world.groundY(x, z), heightAt: (x, z) => world.groundY(x, z), library: lib, lib, avoid: (x, z) => world.isWater(x, z) }); }
    catch (e) { log('fillers failed', e.message); fillers = null; }
  }
  commands = createCommands({ game, net, world, marks, ui, agents, stages, cursor: input, onPickMembers: pickMembers, log });
  desk = createDesk({ game, net, ui, world, folk, stages, commands, live: () => live, log });
  creation = createCreation({ ctx, game, lib, api, world, fillers, marks, net, ui, stages, log, focusCamera: true });
  // "peek at a developed civilisation" (game/future.js, docs/game.md): game.future.enter() / exit(), .ready once prebuilt
  game.future = createFuture({ game, ctx, kit, world, folk, agents, ui, rewards, painter, canvas: seaRenderer.domElement, mailDots, marks: () => marks, desk, commands, creation, stages, ministry, onboarding: () => onboarding, log });

  try {
    let ids = null;
    try { const m = await import('./buildings/prefabs/manifest.js'); ids = m.ids || m.IDS || m.default; if (ids && !Array.isArray(ids)) ids = Object.keys(ids); } catch (_) {}
    await lib.load(ids && ids.length ? ids : undefined);
  } catch (e) { log('library load', e.message); }
  try { await pworld.buildTowns({ api: papi, folk: pfolk }); } catch (e) { log('towns', e.message); }   // the three nations' towns on her planet (planet/towns.js)
  const health = await net.health().catch(() => null);
  live = !!(health && health.ok && !health.mock);
  game.offline = !live;
  ui.offlineNote(!health);
  // the minds' loop (ART_DIRECTION §18): mode from /api/health.minds ('live' | 'mock' | 'off'; ?minds= overrides); no server at all
  // = the mocks in the browser at the same cadence; 'off' = no loop, the sim unchanged. The cast comes at spawn, the start after the election.
  {
    const hm = health && health.minds ? health.minds : null;
    const status = mindsFlag && ['live', 'mock', 'off'].includes(mindsFlag) ? mindsFlag : hm ? hm.status : 'mock';
    mindHealth = hm;
    if (status !== 'off') {
      const call = health && status === 'live' ? (route, body, o) => net.minds(route, body, o) : null;
      minds = createMindLoop(game, {
        call,
        visible: () => !document.hidden,
        paused: () => (game.future && game.future.active) || stages.scene !== 'world' || ui.titleCard.visible || ui.ledger.isOpen || ui.letters.isFanned || ui.meeting.visible || ui.decree.visible || ui.el.classList.contains('is-cinema'),
        mode: call ? 'live' : 'mock',
        directorEveryMs: hm && Number.isFinite(hm.directorEveryMs) ? hm.directorEveryMs : 600000,
        log: t => log('minds', t)
      });
      game.attachMinds(minds);
      mindLine();
      // the cost line (live only): /api/health every 60 s -> minds.usd.perHour (a 10-minute window)
      if (call) setInterval(() => net.health().then(h => { if (h && h.minds) { mindHealth = h.minds; mindLine(); } }).catch(() => {}), 60000);
    } else log('minds off');
  }
  try { for (const a of await net.assets()) { const r = lib.register(a); if (r.ok) { try { game.catalog.add(a); } catch (_) {} } } } catch (e) { log('assets', e.message); }

  voice = createVoice({
    lang: langFromQuery(),
    onStart: () => { ui.voiceBar.setState('listening'); ui.voiceBar.setCaption('…', false); if (stages.scene === 'world') agents.crowdListen(true); },
    onPartial: t => { ui.voiceBar.setCaption(t, false); if (ministry.call.isOpen) ministry.call.setPartial(t); },
    onFinal: (t, meta) => { const pt = meta && (meta.pointerAtThere || meta.pointerAtEnd || meta.pointerAtStart); ui.voiceBar.setCaption(t, true);
      if (ministry.call.isOpen) { ui.voiceBar.setState('done', ''); agents.crowdListen(false); ministry.call.say(t, { source: 'voice' }); return; }   // §24: on the phone to the Ministry
      if (ui.talk.target != null && stages.scene === 'world') { ui.voiceBar.setState('done', ''); agents.crowdListen(false); ui.talk.say(t, { source: 'voice' }); return; }
      handleCommand(t, { pointer: pt, source: 'voice' }); },
    onError: e => { agents.crowdListen(false); if (e.code === 'empty') { ui.voiceBar.setState('idle'); ui.voiceBar.setCaption(''); return; } if (e.delivered) return; ui.voiceBar.setState('error', e.message || 'the folk didn’t catch that'); },
    onLevel: v => ui.voiceBar.setLevel(v),
    onState: s => { if (s === 'idle' && ui.voiceBar.state === 'listening') ui.voiceBar.setState('idle'); }
  });
  voice.holdKey('Space');

  setInterval(feedHud, 1000);
  feedHud();

  // the title over her orbit (Grain, spinning); the seaside map is built underneath, waiting for the hand-off
  try { await stages.introGlobe(); } catch (e) { log('orbit intro failed', e.message); }
  frame(performance.now());
  await planet.ready;
  // perf (docs/perf.md §5.1): the seaside map (its programs + one painted frame), the landing bridge, Plissé and the lounge
  // are built behind the boot screen (each build is a main-thread stall: under the title they froze her spinning orbit),
  // then rest tiny and frozen until the voyage needs them. Capped, so a slow load never holds the boot screen for long.
  await Promise.race([Promise.all([seaReady, stages.preload().catch(e => log('preload', e.message))]), sleep(15000)]);
  boot.classList.add('is-off'); setTimeout(() => boot.remove(), 900);

  let dir = null;
  if (director) {
    const hooks = makeDirectorHooks({ game, world, ui, voice, commands, creation, agents, stages, folk, desk, opening, intro: () => begin({ spawn: false, onboarding: false }), letters: L, log });
    dir = createDirector({ beats: DEFAULT_BEATS, hooks, timing: { speed }, log: (...a) => log('director', ...a) });
    ui.cinema(false);
    setTimeout(() => dir.play(), 300);
  } else if (Q.get('autostart') === '1') {
    setTimeout(() => begin(), 100);
  } else {
    // §23: "Aloud" (Melodrama 600, white) on top, her planet alone below it, Begin as quiet text; ?title= / ?titlefont= try others
    releaseTitle = frameTitlePlanet(planet);
    ui.titleCard.show({ name: Q.get('title') || undefined, font: Q.get('titlefont') || undefined });
  }

  window.__agora = {
    game, world, planet, geo, adapter, fine, pass, ui, rewards, commands, stages, creation, lib, agents, folk, net, errors, ctx, kit, api, fillers, perf,
    painter, pworld, pfolk, pctx, seaReady,
    letters: L, talkTo, dressed,
    get minds() { return minds; }, get mindsStarted() { return mindsStarted; },
    get opening() { return opening; }, get onboarding() { return onboarding; }, mailDots, ministry, futureToggle, get future() { return game.future; }, get input() { return input; }, get pick() { return pick; }, pickMembers,
    get marks() { return marks; }, get voice() { return voice; }, get director() { return dir; }, get live() { return live; }, get desk() { return desk; },
    begin, handle: (t, p) => commands.handle(t, { pointer: p || null, source: 'test' }),
    skip: skipIntro, get introDone() { return introDone; }
  };
})().catch(e => { errors.push('boot: ' + e.message); console.error('[agora] boot', e); if (boot) boot.textContent = 'something tore: ' + e.message; });
