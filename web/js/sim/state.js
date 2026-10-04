// createGame: the whole simulation behind one object. Pure JS; runs in the browser and under node --test.

import { createRng } from './rng.js';
import { createEmitter } from './events.js';
import { createCatalog, STAGES, GENERATED_DEFAULTS, defaultsFor } from './catalog.js';
import { generateSettlers, generateTownsfolk, stepFolk, moodBand, avgMood, nudgeMood } from './society.js';
import { ECO, stepEconomy, computeProsperity, stageFor, nextStageInfo, dailyEconomy, assignHomes, housingTotal, moodBonusTotal, population, productionRates } from './economy.js';
import { TASK, stepTasks, assignWorkers, poachHelpers, queueLetter, landLetter, staffBuilding, releaseAgent, strike, strikeEnd, leave } from './tasks.js';
import { createNeighbours, stepNeighbours, dailyNeighbours, neighbourBrief, staleTitle } from './neighbours.js';
import { applyAction } from './actions.js';
import { tickStory, onLetterLanded, giftArrive, setScene } from './story.js';
import { headNoun } from './parse.js';
import * as L from './letters.js';
import { blobPoly, rectsOverlap, rectInPlot, rectTouchesPoly, rectTouchesPolyline, pointInPoly, distToEdge, polyCentroid, dist, rectPoly, ptsBBox } from './geometry.js';
import { normaliseMark } from './marks.js';
import { formFleets, introduceFleets, electMinister, crowdElection, releaseFleets, joinFleet, onMinisterGone, tickFleets, fleetOf } from './fleets.js';
import { campSpots, refreshJobs, campRoleFor } from './jobs.js';
import { tickVentures, onVentureDone, proposeVenture } from './ventures.js';
import { tickSay, talkContext, mockTalk, recordTalk, remember, trimReply } from './talk.js';
import { tickConflicts, startConflict, planDuty, onSettleArrive, onAgentGone, conflictsBrief, institutionsBrief, foundInstitution, resolveConflict, findConflict } from './conflicts.js';
import { MIND, tickMinds, wireObservations, observe, mindsBrief, mindContextOf, personaOf, setPersonas, mockCast, castRequest, thinkRequest, mockThink, applyIntent, converseRequest, mockConverse, applyConversation, reflectRequest, mockReflect, addReflection, directRequest, mockDirect, applyDirection, affinity, nudgeAffinity, relationshipsBrief, mindOf, voicePrefix } from './minds.js';
import { createRewards } from './rewards.js';

// marks: a blocked point is nudged by the smallest amount that fits, never relocated far (ART_DIRECTION §5)
export const MARK = { step: 0.5, maxNudge: 8 };

export const SOC = {
  societyEvery: 90,      // seconds between offline society letters (gossip / ideas / petitions)
  firstSocietyAt: 40,
  hungerLetterDelay: 3,  // seconds after the crates empty
  hungerLetterEvery: 120,
  homelessLetterEvery: 120, homelessFromDay: 2,
  overworkLetterDays: 2,
  suggestAt: 110,        // the minister (or the Ministry) gently suggests a farm / well if nothing feeds the town yet
  maxTickSeconds: 3600   // one tick() call simulates at most an hour: a broken clock (Infinity, a sleeping tab) can never freeze the page
};

// envoyDelivery: 'auto' = neighbour letters wait for game.deliverLetter(id) when something listens to envoy:send, else
// land by themselves after 2.5 s; 'immediate' = always land by themselves; 'event' = always wait (with a 25 s safety net)
export function createGame({ seed = 7, name = 'Agora', offline = true, envoyDelivery = 'auto', townsfolk = 0 } = {}) {
  const rng = createRng(seed);
  const catalog = createCatalog();
  const events = createEmitter();
  const plot = { x0: -30, x1: 30, z0: -26, z1: 30 };
  const centre = { x: 0, z: 2 };
  const spawn = { x: 0, z: 9 };
  const stockpile = { x: -9, z: 13 };
  const tray = { x: 1, z: 26 };

  // a lake off-centre (the middle stays buildable), and the sea beyond the far edge
  const lakeSpots = [{ x: -16, z: -9 }, { x: 16, z: -11 }, { x: -17, z: 15 }, { x: 18, z: 16 }];
  const ls = rng.pick(lakeSpots);
  const lake = blobPoly(rng, ls.x, ls.z, 5, 3.5, 14);
  const sea = [[-400, plot.z0 - 2], [-40, plot.z0 - 3.2], [0, plot.z0 - 2.4], [40, plot.z0 - 3.6], [400, plot.z0 - 2], [400, -400], [-400, -400]];

  const state = {
    t: 0, day: 1, stage: 'camp', name, seed, scene: 'earth',
    resources: { food: 60, wood: 30, stone: 20, coin: 10, goods: 0 },
    prosperity: 0, mood: 0,
    plot, water: [{ kind: 'lake', poly: lake }, { kind: 'sea', poly: sea }],
    buildings: [], agents: [], letters: [], minister: null, neighbours: createNeighbours(rng), log: [],
    centre, spawn, stockpile, tray,
    acc: { food: 0, wood: 0, stone: 0, coin: 0, goods: 0 }, hungry: false, hungerSince: null,
    meeting: null, pendingLetters: [], rates: {},
    nextSocietyAt: SOC.firstSocietyAt, nextHungerLetterAt: 0, nextHomelessLetterAt: SOC.homelessFromDay * ECO.daySeconds, nextSuggestAt: SOC.suggestAt,
    nextBuildingId: 1, nextLetterId: 1, dayAcc: 0,
    // story (§9): the election, the voyage, the moon; gifts on the road; beats waiting to happen
    story: { elected: false, electionAt: null, electionLetterId: null, voyagePending: false, returned: false, departedAt: null, voyages: 0 },
    moon: { contacted: false, seeds: 0, golden: false, goldenOnce: false, greeted: 0, gifts: 0 },
    lastNeighbour: null, creations: [], journeys: [], scheduled: [],
    mark: null,   // the cursor mark the sim was last told about (game.setMark); a build with at.mode 'mark' uses at.mark, else this
    // ART_DIRECTION §11: fleets (squares by trade after landing), the minister's election, ventures, the camp's jobs
    fleets: null, fleetHold: false, intro: null, election: null, ceremony: null, fleetBeats: [], ventures: [], camp: null, nextSayAt: null,
    // ART_DIRECTION §15: disputes the minister brings, and the institutions the sovereign founds to answer them
    conflicts: [], institutions: [], nextConflictAt: null,
    // ART_DIRECTION §18: the cast (personas), the folk's relationships, their conversations, the director's story
    personas: {}, relationships: {}, conversations: [], minds: { cast: false, directions: 0, arc: [], milestones: {}, sayQueue: [], tensions: [] },
    // ART_DIRECTION §22b: what every creation gave back (money, happiness, science, civ) and the lines already crossed
    areas: { money: 0, happiness: 0, science: 0, civ: 0 }, rewards: { learned: [], passed: { money: [], happiness: [], science: [] }, gains: 0 }
  };
  state.agents = generateSettlers(rng, { spawn });
  if (townsfolk > 0) state.agents.push(...generateTownsfolk(rng, state.agents, { per: townsfolk, spawn }));   // the companies (society.js)
  state.camp = campSpots(state);
  for (const a of state.agents) a.campRole = campRoleFor(a);

  const game = {
    state, rng, catalog, events, offline, envoyDelivery, TASK, ECO, SOC, MARK,
    on: (ev, fn) => events.on(ev, fn), off: (ev, fn) => events.off(ev, fn), once: (ev, fn) => events.once(ev, fn),
    emit: (ev, payload) => events.emit(ev, payload),
    log(text) { state.log.push({ t: +state.t.toFixed(1), day: state.day, text }); if (state.log.length > 300) state.log.shift(); },
    sendLetter(letter, opts) { return queueLetter(game, letter, opts); },
    // the visual layer landed a carried letter (an envoy touched down): it enters the tray now. Safe on any undelivered letter.
    deliverLetter(id) { const l = state.letters.find(x => x.id === id); if (!l || l.delivered) return false; landLetter(game, id, null); return true; },
    apply: action => applyAction(game, action),
    // the UI opened a letter: it leaves `unread` and shows under `recent` until resolved
    markRead(id) { const l = state.letters.find(x => x.id === id); if (l) l.read = true; return !!l; },
    // mark every agent spawned (visual layer calls this after wiring listeners; harmless if never called). Then the folk
    // form their fleets (ART_DIRECTION §11); `{ fleets: false }` skips that (tests of the plain economy)
    spawnAll({ fleets = true } = {}) { for (const a of state.agents) if (a.status !== 'left') events.emit('agent:spawn', { agent: a }); if (fleets) formFleets(game); },
    // ---- fleets, the minister's election (ART_DIRECTION §11) ----
    formFleets: opts => formFleets(game, opts),                 // squares by trade -> fleet:form; folk walk to their slots and wait
    introduceFleets: opts => introduceFleets(game, opts),       // the scripted intro: fleet:introduce per fleet, then election:ask. Returns the order
    electMinister: agentId => electMinister(game, agentId),    // the click: appoint + minister:set + a short ceremony
    crowdElection: kind => crowdElection(game, kind),          // later elections: the folk vote, the result comes by letter
    releaseFleets: () => releaseFleets(game),                  // break the squares (done by itself after the ceremony / holdMax)
    fleetOf: agentId => { const a = state.agents.find(x => x.id === agentId); return a ? fleetOf(state, a) : null; },
    // ---- talk (ART_DIRECTION §11): simple, short answers in a bubble ----
    // talkContext(id, text) -> the body for POST /api/talk. talk(id, text, result?) records the exchange, says the reply
    // (agent:say), applies the mood nudge and any action; with no `result` the offline mind (mockTalk) answers.
    // the body for POST /api/talk; with a cast it also carries `persona` and `mind` (memory, reflections, goal, bonds), ART_DIRECTION §18
    talkContext: (agentId, text) => { const c = talkContext(game, agentId, text); if (c && state.minds && state.minds.cast) Object.assign(c, mindContextOf(state, state.agents.find(x => x.id === agentId))); return c; },
    talk(agentId, text, result = null) {
      const a = state.agents.find(x => x.id === agentId && x.status !== 'left');
      if (!a) return { ok: false, reason: 'Nobody here by that id.', reply: '' };
      const ctx = talkContext(game, a.id, text);
      const r = result && typeof result === 'object' && typeof result.reply === 'string' && result.reply.trim() ? result : mockTalk(ctx);
      const p = result ? null : personaOf(state, a.id);   // offline: the mock answer in the persona's voice (ART_DIRECTION §18)
      const reply = trimReply(p && p.voice ? voicePrefix(p.voice)(r.reply) : r.reply);
      recordTalk(a, text, reply, state.t, state.day);
      observe(game, a, `The sovereign said to me: "${String(text).slice(0, 80)}" and I answered: "${reply.slice(0, 80)}"`, { imp: 3, kind: 'talk' });
      if (game.minds) game.minds.poke(a.id, 'spoken_to');
      const mood = Math.max(-5, Math.min(5, Math.round(Number(r.mood) || 0)));
      if (mood) nudgeMood(a, mood, 'spoken to', game.emit);
      game.emit('agent:listen', { agentId: a.id });
      game.emit('agent:say', { agentId: a.id, text: reply, kind: 'talk', ttl: Math.min(9, 3 + reply.length / 18) });
      let applied = null;
      const act = r.action && typeof r.action === 'object' && r.action.type && r.action.type !== 'none' ? r.action : null;
      if (act) {
        if (act.type === 'build') applied = game.apply({ type: 'build', kind: act.kind || null, request: act.request || act.text || '', at: { mode: 'near', ref: a.homeId || undefined, x: a.x, z: a.z }, assign: [a.id] });
        else if (act.type === 'rest') applied = game.apply({ type: 'assign', agentIds: [a.id], to: 'rest' });
        else if (act.type === 'assign') applied = game.apply({ type: 'assign', agentIds: [a.id], to: act.to || act.text || 'idle' });
        else if (act.type === 'ask_crowd') applied = game.apply({ type: 'ask_crowd', question: act.question || act.text || text });
        else if (act.type === 'call_meeting') applied = game.apply({ type: 'call_meeting' });
      }
      game.log(`${a.name} says: "${reply}"`);
      return { ok: true, agentId: a.id, reply, mood, action: act, applied };
    },
    proposeVenture: (agentId, idea, opts) => { const a = state.agents.find(x => x.id === agentId); return a ? proposeVenture(game, a, idea, opts) : null; },
    // ---- conflicts and institutions (ART_DIRECTION §15) ----
    startConflict: draft => startConflict(game, draft),                      // tests / the director: 'theft' | 'quarrel' | ... or a full draft
    resolveConflict: (ref, how, opts) => resolveConflict(game, findConflict(game, ref), how, opts),
    foundInstitution: opts => foundInstitution(game, opts),                   // = apply({ type:'found_institution', ... })
    findConflict: ref => findConflict(game, ref),
    planDuty: a => planDuty(game, a),                                         // tasks.plan asks an institution's member what to do
    onSettleArrive: (a, conflictId, institutionId) => onSettleArrive(game, a, conflictId, institutionId),
    onAgentGone: a => onAgentGone(game, a),
    onNewcomer(a) { a.campRole = campRoleFor(a); joinFleet(game, a); refreshJobs(game, true); mindOf(a); },
    // ---- minds (ART_DIRECTION §18): personas, memory, relationships, the director. The loop (mindloop.js) is attached by the game layer;
    // without one the pure functions still work (tests, the offline mocks). game.tick drives loop.update().
    minds: null,
    MIND,
    attachMinds(loop) { game.minds = loop || null; return game.minds; },
    castPersonas(cast = null) { return setPersonas(game, cast || mockCast(game)); },   // keep a cast (live or mock); returns how many landed
    castRequest: () => castRequest(game),
    mockCast: () => mockCast(game),
    personaOf: agentId => personaOf(state, agentId),
    observe: (agentId, text, opts) => { const a = state.agents.find(x => x.id === agentId); return a ? observe(game, a, text, opts) : null; },
    thinkRequest: agentId => thinkRequest(game, agentId),
    mockThink: agentId => mockThink(game, agentId),
    applyIntent: (agentId, result, opts) => applyIntent(game, agentId, result, opts),
    converseRequest: id => converseRequest(game, id),
    mockConverse: id => mockConverse(converseRequest(game, id)),
    applyConversation: (id, result) => applyConversation(game, id, result),
    reflectRequest: agentId => reflectRequest(game, agentId),
    reflect: (agentId, text = null) => { const a = state.agents.find(x => x.id === agentId); return a ? addReflection(game, a, text || (mockReflect(reflectRequest(game, agentId)) || {}).reflection) : null; },
    directRequest: reason => directRequest(game, reason),
    mockDirect: reason => mockDirect(game, reason),
    applyDirection: (result, opts) => applyDirection(game, result, opts),
    affinity: (a, b) => affinity(state, a, b),
    nudgeAffinity: (a, b, delta, why) => nudgeAffinity(game, a, b, delta, why),
    relationships: opts => relationshipsBrief(state, opts),
    // the orchestrator tells the sim which world is on screen ('earth' | 'moon'); the moon's first letter follows setScene('moon')
    setScene: scene => setScene(game, scene),
    // adopt the globe's nation layout (geography.js places.nations: [{id, x, z, name?}]) if it ever differs from the sim's own.
    // A title that names one of OUR species (the old "Flit Sky-hold") is stale and is not adopted: flits are settlers now
    setNations(list) { for (const p of list || []) { const n = state.neighbours.find(x => x.id === p.id); if (n && Number.isFinite(p.x) && Number.isFinite(p.z)) { n.x = p.x; n.z = p.z; if (typeof p.name === 'string' && p.name && !staleTitle(p.name)) n.title = p.name; } } return state.neighbours.map(n => ({ id: n.id, x: n.x, z: n.z, title: n.title, species: n.leaderSpecies, peoples: n.peoples })); },
    // the marks module tells the sim what is drawn on the paper (ART_DIRECTION §5): a point, a closed area or an open line.
    // A build action with at.mode 'mark' and no at.mark of its own uses it. null clears it. Returns the normalised mark.
    setMark(mark) { state.mark = normaliseMark(mark); return state.mark; },
    onLetterLanded: letter => onLetterLanded(game, letter),
    onJourneyEnd: (a, t) => giftArrive(game, { neighbourId: t.neighbourId, gift: t.gift, carrierId: a.id, give: t.give })
  };

  // ---- placement ----
  const reserved = [{ x: stockpile.x, z: stockpile.z, w: 3.5, d: 3.5 }, { x: tray.x, z: tray.z, w: 4, d: 3 }, { x: spawn.x, z: spawn.z, w: 2, d: 2 }];
  const rectOf = b => ({ x: b.x, z: b.z, w: b.footprint.w, d: b.footprint.d });
  // does building b block this rect? An area blocks inside its outline, a line within its width, a prefab by its footprint.
  const lineHalfWidth = b => Math.max(0.3, (b.shape && b.shape.width ? b.shape.width : Math.min(b.footprint.w, b.footprint.d)) / 2);
  const blocks = (b, rect, margin) => b.shape && b.shape.poly ? rectTouchesPoly(rect, b.shape.poly, margin * 0.5)
    : b.shape && b.shape.pts ? rectTouchesPolyline(rect, b.shape.pts, lineHalfWidth(b) + margin * 0.5)
    : rectsOverlap(rect, rectOf(b), margin);
  // the land predicate. opts.ignoreAreas: a marked point inside a field is still the sovereign's choice (areas are walkable).
  game.spotFree = (rect, exclude = null, { ignoreAreas = false } = {}) => {
    if (!rectInPlot(rect, plot, 0.5)) return false;
    for (const w of state.water) if (rectTouchesPoly(rect, w.poly, 0.6)) return false;
    for (const b of state.buildings) if (b.id !== exclude && b.status !== 'removed' && !(ignoreAreas && b.shape && b.shape.poly) && blocks(b, rect, 1)) return false;
    for (const r of reserved) if (rectsOverlap(rect, r, 0.5)) return false;
    return true;
  };
  // which buildings a rect / polygon / polyline overlaps (for the record: areas and lines are placed exactly, and say what they cross)
  game.overlapping = (shape, exclude = null) => state.buildings.filter(b => b.id !== exclude && b.status !== 'removed' && (
    shape.poly ? (b.shape && b.shape.poly ? b.shape.poly.some(([x, z]) => pointInPoly(x, z, shape.poly)) || shape.poly.some(([x, z]) => pointInPoly(x, z, b.shape.poly)) : b.shape && b.shape.pts ? b.shape.pts.some(([x, z]) => pointInPoly(x, z, shape.poly)) : rectTouchesPoly(rectOf(b), shape.poly, 0))
    : shape.pts ? (b.shape && b.shape.poly ? shape.pts.some(([x, z]) => pointInPoly(x, z, b.shape.poly)) : b.shape && b.shape.pts ? false : rectTouchesPolyline(rectOf(b), shape.pts, lineHalfWidth({ footprint: shape.footprint || { w: 2, d: 2 } })))
    : blocks(b, shape, 0))).map(b => b.id);
  // a floating thing: its centre on the lake (or the sea just off the plot), a little inside the shore, overlapping nothing
  game.spotFreeWater = (rect, exclude = null, which = null) => {
    if (rect.x < plot.x0 || rect.x > plot.x1 || rect.z < plot.z0 - 14 || rect.z > plot.z1) return false;
    const inset = Math.min(1.2, Math.min(rect.w, rect.d) / 2);
    if (!state.water.some(w => (!which || w.kind === which) && pointInPoly(rect.x, rect.z, w.poly) && distToEdge(rect.x, rect.z, w.poly) >= inset)) return false;
    for (const b of state.buildings) if (b.id !== exclude && b.status !== 'removed' && blocks(b, rect, 0.8)) return false;
    return true;
  };
  game.waterCentre = (which = 'lake') => {
    if (which === 'sea') return { x: centre.x, z: plot.z0 - 6 };
    const w = state.water.find(x => x.kind === 'lake');
    return w ? polyCentroid(w.poly) : { x: centre.x, z: plot.z0 - 6 };
  };
  // findSpot(kind, near, { mode, footprint, exclude, water }) -> {x, z, rot} | null. Spirals out from the anchor; pointer tries
  // the exact point first. mode 'water' searches the lake ('water': 'lake' | 'sea') for a floating thing.
  game.findSpot = (kind, near = null, { mode = near ? 'near' : 'auto', footprint = null, exclude = null, water = 'lake' } = {}) => {
    const e = kind ? catalog.get(kind) : null;
    const fp = footprint || (e ? e.footprint : GENERATED_DEFAULTS.footprint);
    if (mode === 'water') {
      const which = water === 'sea' ? 'sea' : 'lake';
      const anchor = near || game.waterCentre(which);
      const ok = (x, z) => game.spotFreeWater({ x, z, w: fp.w, d: fp.d }, exclude, which);
      if (ok(anchor.x, anchor.z)) return { x: +anchor.x.toFixed(2), z: +anchor.z.toFixed(2), rot: 0, floating: true };
      const c = game.waterCentre(which);
      for (const a0 of [anchor, c]) {
        for (let r = 0.75; r <= 24; r += 0.75) {
          const n = Math.max(8, Math.round(r * 6));
          for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2, x = a0.x + Math.cos(a) * r, z = a0.z + Math.sin(a) * r; if (ok(x, z)) return { x: +x.toFixed(2), z: +z.toFixed(2), rot: 0, floating: true }; }
        }
      }
      return null;
    }
    let anchor = near || (mode === 'center' ? centre : (e && e.wantsWater ? game.nearestWaterEdge(centre) : centre));
    anchor = { x: Math.max(plot.x0 + fp.w / 2 + 0.5, Math.min(plot.x1 - fp.w / 2 - 0.5, anchor.x)), z: Math.max(plot.z0 + fp.d / 2 + 0.5, Math.min(plot.z1 - fp.d / 2 - 0.5, anchor.z)) };
    const rot = mode === 'auto' ? rng.pick([0, 0, 0, Math.PI]) : 0;
    // Sueda: fields / gardens / green areas are buildable when the sovereign points there; auto placement prefers open land
    const ok = (x, z) => game.spotFree({ x, z, w: fp.w, d: fp.d }, exclude, { ignoreAreas: !!near });
    if (ok(anchor.x, anchor.z)) return { x: +anchor.x.toFixed(2), z: +anchor.z.toFixed(2), rot };
    const step = 1.25;
    for (let r = step; r <= 70; r += step) {
      const n = Math.max(8, Math.round(r * 5));
      const a0 = mode === 'pointer' ? 0 : rng.range(0, Math.PI * 2);
      for (let i = 0; i < n; i++) {
        const a = a0 + (i / n) * Math.PI * 2;
        const x = anchor.x + Math.cos(a) * r, z = anchor.z + Math.sin(a) * r;
        if (ok(x, z)) return { x: +x.toFixed(2), z: +z.toFixed(2), rot };
      }
    }
    return null;
  };
  // Placement AT a mark (ART_DIRECTION §5: never arbitrary). mark = normaliseMark(...). Returns
  //   { x, z, rot, footprint, shape:null|{poly,bbox,centroid,areaM2}|{pts,bbox,length}, floating, nudge:null|{from,to,dist,why} } or null.
  // point  -> the centre is the point. Blocked (another building, water for a land thing, off the plot): the smallest move
  //           that fits, within MARK.maxNudge, reported as `nudge`; nothing within reach -> null (never a far relocation).
  // area   -> an area kind fills the outline: shape.poly, x/z = centroid, footprint = the outline's bbox. A point kind named
  //           for an area sits at the centroid, its footprint shrunk to fit the outline (blocked -> the same small nudge).
  // line   -> any kind follows the stroke: shape.pts, x/z = the midpoint along it, rot = its heading, footprint = the bbox.
  game.markSpot = (kind, mark, { footprint = null, floating = null, category = null } = {}) => {
    const m = normaliseMark(mark);
    if (!m) return null;
    const e = kind ? catalog.get(kind) : null;
    const fp0 = footprint || (e ? { ...e.footprint } : { ...defaultsFor(category).footprint });
    const kindShape = e ? e.shape || 'point' : 'point';
    const r2 = v => +v.toFixed(2);
    if (m.kind === 'line') {
      const bb = m.bbox;
      const fp = kindShape === 'line' ? { w: r2(Math.max(1, bb.w)), d: r2(Math.max(1, bb.d)) } : fp0;
      return { x: m.x, z: m.z, rot: -m.angle || 0, footprint: fp, shape: { pts: m.pts.map(p => p.slice()), bbox: { ...bb }, length: m.length, width: kindShape === 'line' ? Math.min(fp0.w, fp0.d) : undefined }, floating: false, nudge: null, exact: true };
    }
    if (m.kind === 'area') {
      const bb = m.bbox;
      const shape = { poly: m.poly.map(p => p.slice()), bbox: { ...bb }, centroid: { x: m.x, z: m.z }, areaM2: m.areaM2 };
      if (kindShape === 'area') return { x: m.x, z: m.z, rot: 0, footprint: { w: r2(Math.max(1, bb.w)), d: r2(Math.max(1, bb.d)) }, shape, floating: false, nudge: null, exact: true };
      // a single thing named for an area: at the centroid, scaled down to fit the outline (never up)
      const fp = { w: r2(Math.max(0.8, Math.min(fp0.w, bb.w))), d: r2(Math.max(0.8, Math.min(fp0.d, bb.d))) };
      const spot = nudgeTo(m.x, m.z, fp, { floating, ignoreAreas: true, inside: shape.poly });
      return spot ? { ...spot, footprint: fp, shape: { ...shape, fit: true } } : null;
    }
    const spot = nudgeTo(m.x, m.z, fp0, { floating, ignoreAreas: true });
    return spot ? { ...spot, footprint: fp0, shape: null } : null;
  };
  // the smallest move from (x, z) that fits a footprint: the exact point first, then rings MARK.step apart up to MARK.maxNudge,
  // the nearest angle first. floating: true searches the water (a duck marked on the lake), else the ground.
  function nudgeTo(x, z, fp, { floating = null, ignoreAreas = false, inside = null } = {}) {
    const onWater = state.water.some(w => pointInPoly(x, z, w.poly));
    const wantWater = floating === true;   // the caller decides: a floating thing on a watery mark takes the water
    const which = z < plot.z0 ? 'sea' : 'lake';
    const okLand = (px, pz) => game.spotFree({ x: px, z: pz, w: fp.w, d: fp.d }, null, { ignoreAreas });
    const okWater = (px, pz) => game.spotFreeWater({ x: px, z: pz, w: fp.w, d: fp.d }, null, which);
    const ok = wantWater ? okWater : okLand;
    const r2 = v => +v.toFixed(2);
    if (ok(x, z)) return { x: r2(x), z: r2(z), rot: 0, floating: wantWater, nudge: null, exact: true };
    let why = !wantWater && onWater ? 'water' : !rectInPlot({ x, z, w: fp.w, d: fp.d }, plot, 0.5) ? 'edge' : 'overlap';
    for (let r = MARK.step; r <= MARK.maxNudge + 1e-6; r += MARK.step) {
      const n = Math.max(8, Math.round(r * 8));
      let best = null;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2, px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
        if (!ok(px, pz)) continue;
        const score = inside && !pointInPoly(px, pz, inside) ? 1 : 0;   // prefer staying inside the outline
        if (!best || score < best.score) best = { px, pz, score };
      }
      if (best) return { x: r2(best.px), z: r2(best.pz), rot: 0, floating: wantWater, nudge: { from: { x: r2(x), z: r2(z) }, to: { x: r2(best.px), z: r2(best.pz) }, dist: r2(Math.hypot(best.px - x, best.pz - z)), why }, exact: false };
    }
    return null;
  }
  game.nearestWaterEdge = (from, kind = null) => {
    let best = null, bd = Infinity;
    for (const w of state.water) {
      if (kind && w.kind !== kind) continue;
      for (const [x, z] of w.poly) {
        if (x < plot.x0 - 2 || x > plot.x1 + 2 || z < plot.z0 - 6 || z > plot.z1 + 2) continue;
        const d = dist(from.x, from.z, x, z);
        if (d < bd) { bd = d; best = { x: Math.max(plot.x0 + 3, Math.min(plot.x1 - 3, x)), z: Math.max(plot.z0 + 3, Math.min(plot.z1 - 3, z)) }; }
      }
    }
    return best || { x: centre.x, z: plot.z0 + 4 };
  };
  game.freeGroundNear = (pt, radius) => {
    for (let i = 0; i < 10; i++) {
      const a = rng.range(0, Math.PI * 2), r = rng.range(1, radius);
      const x = pt.x + Math.cos(a) * r, z = pt.z + Math.sin(a) * r;
      if (x < plot.x0 + 1 || x > plot.x1 - 1 || z < plot.z0 + 1 || z > plot.z1 - 1) continue;
      if (state.water.some(w => pointInPoly(x, z, w.poly))) continue;
      if (state.buildings.some(b => Math.abs(b.x - x) < b.footprint.w / 2 + 0.5 && Math.abs(b.z - z) < b.footprint.d / 2 + 0.5)) continue;
      return { x: +x.toFixed(2), z: +z.toFixed(2) };
    }
    return { x: pt.x, z: pt.z };
  };

  // ---- buildings ----
  // opts: name, request, requestKind, noun, category ('building' | 'prop' | 'landmark' | 'nature'; sets the defaults of an
  // undesigned thing), floating (placed on the water: the crew works from the shore), assign
  // shape ({poly,...} | {pts,...}) and footprint come from game.markSpot for a marked thing; an area kind placed without a
  // mark gets a rectangle outline of its footprint, so the visual layer always has a polygon / polyline to fill.
  game.placeBuilding = (kind, spot, { name, request, requestKind, noun, category, floating, assign, shape = null, footprint = null } = {}) => {
    const e = kind ? catalog.get(kind) : null;
    const D = e ? null : defaultsFor(category);
    const cost = e ? e.cost : D.cost;
    // the crates pay what they hold; the rest is forgiven (costs are flavour, never a wall). paidCost is what really left the crates.
    const paidCost = {}, short = {};
    for (const [k, v] of Object.entries(cost)) {
      const have = Math.max(0, state.resources[k] || 0), pay = Math.min(have, v);
      if (pay > 0) paidCost[k] = pay;
      if (v > pay) short[k] = v - pay;
      state.resources[k] = have - pay;
    }
    const fp = footprint ? { ...footprint } : spot.footprint ? { ...spot.footprint } : e ? { ...e.footprint } : { ...D.footprint };
    const total = Object.values(cost).reduce((a, b) => a + b, 0);
    const isFloating = !!(floating || spot.floating);
    let shp = shape || spot.shape || null;
    if (!shp && e && e.shape === 'area') { const poly = rectPoly({ x: spot.x, z: spot.z, w: fp.w, d: fp.d }); shp = { poly, bbox: ptsBBox(poly), centroid: { x: spot.x, z: spot.z }, areaM2: +(fp.w * fp.d).toFixed(1), rect: true }; }
    if (!shp && e && e.shape === 'line') { const rot = spot.rot || 0, hw = fp.w / 2, c = Math.cos(-rot), sn = Math.sin(-rot); const pts = [[+(spot.x - c * hw).toFixed(2), +(spot.z - sn * hw).toFixed(2)], [+(spot.x + c * hw).toFixed(2), +(spot.z + sn * hw).toFixed(2)]]; shp = { pts, bbox: ptsBBox(pts), length: fp.w, width: fp.d, straight: true }; }
    const b = {
      id: 'b' + (state.nextBuildingId++), kind, name: name || (e ? e.name : request), x: spot.x, z: spot.z, rot: spot.rot || 0, footprint: fp,
      status: kind ? 'site' : 'awaiting_design', progress: 0, workers: [], generated: false, assetId: null,
      category: e ? e.category : (D.category || 'building'), floating: isFloating,
      request: request || null, requestKind: requestKind || null, noun: noun || null,
      cratesNeeded: Math.max(1, Math.min(TASK.maxCrates, Math.round(total / TASK.crateUnits))), cratesDelivered: 0,
      startedDay: state.day, doneDay: null, paidCost, short,
      ...(shp ? { shape: shp } : {}), ...(spot.nudge ? { nudge: spot.nudge } : {})
    };
    if (isFloating) b.workSpot = game.nearestWaterEdge({ x: b.x, z: b.z }, b.z < plot.z0 ? 'sea' : null);
    state.buildings.push(b);
    state.creations.push(b.id);
    if (state.creations.length > 12) state.creations.shift();
    game.emit('resources', { resources: { ...state.resources } });
    game.log(`Site: ${b.name} at (${b.x}, ${b.z})${isFloating ? ' on the water' : ''}${shp && shp.poly && !shp.rect ? ` filling a ${shp.areaM2} m² outline` : shp && shp.pts && !shp.straight ? ` along a ${shp.length} m line` : ''}${spot.nudge ? ` (nudged ${spot.nudge.dist} m off the mark: ${spot.nudge.why})` : ''}${kind ? '' : ' (awaiting design)'}.`);
    let refused = [];
    if (!assign || !assign.length) { const r = assignWorkers(game, b); if (!r.assigned.length) { poachHelpers(game, b, 2); if (!b.workers.length) refused = r.refused; } }   // nobody free: helpers off another crew
    game.emit('building:site', { building: b });
    for (const ref of refused.slice(0, 1)) game.sendLetter(L.refusal(rng, { agent: ref.agent, task: { kind: 'build', buildingId: b.id, label: b.name.toLowerCase() }, why: ref.why, day: state.day, settlement: state.name }));
    return b;
  };
  game.completeBuilding = b => {
    if (b.status === 'done') return;
    b.status = 'done'; b.progress = 1; b.doneDay = state.day;
    const crew = b.workers.map(id => state.agents.find(x => x.id === id)).filter(Boolean);
    for (const a of crew) { releaseAgent(game, a); remember(a, `helped raise the ${b.name.toLowerCase()}`); }
    b.workers = [];
    assignHomes(state, catalog);
    game.emit('building:done', { building: b });
    game.log(`Done: ${b.name}.`);
    game.emit('toast', { text: `${b.name} is finished` });
    if (crew.length) game.emit('agent:say', { agentId: rng.pick(crew).id, text: rng.pick([`Done! Look at that ${b.name.toLowerCase()}.`, 'Finished. Not bad at all.', 'There. Stand back and admire it.']), kind: 'done', ttl: 4 });
    if (b.venture) onVentureDone(game, b);
    staffBuilding(game, b);
    if (b.generated) game.sendLetter(L.ministryNotice(rng, { kind: 'raised', day: state.day, settlement: state.name, name: b.name, building: b }));
    // the reward (ART_DIRECTION §22b): reward:gain now, and a level-up (reward:milestone civ) from refreshDerived right after
    try { game.rewards.onDone(b); } catch (e) { game.log(`[rewards] ${e.message}`); }
    refreshDerived();
  };
  // the codegen path: an asset (id, name, aliases, meta{footprint,cost,...}, code?) arrived for an awaiting_design site.
  // Every other site still awaiting the same request ("another one") takes the design too.
  game.designArrived = (buildingId, asset) => {
    const b = state.buildings.find(x => x.id === buildingId);
    if (!b || !asset || !asset.id) return b || null;
    if (b.status === 'done' || b.status === 'removed' || b.assetId === asset.id) return b;   // idempotent: a repeat changes nothing
    const first = !b.assetId;
    const aliases = [...(Array.isArray(asset.aliases) ? asset.aliases : []), ...(b.noun ? [b.noun, headNoun(b.noun)] : []), ...(b.request ? [b.request.toLowerCase()] : [])];
    const meta = { ...(asset.meta && typeof asset.meta === 'object' ? asset.meta : {}) };
    if (!meta.category && b.category) meta.category = b.category;       // the request's category stays unless the model says otherwise
    if (meta.water === undefined && b.floating) meta.water = true;
    const entry = catalog.has(asset.id) ? catalog.get(asset.id) : catalog.add({ ...asset, meta, aliases });
    const siblings = state.buildings.filter(x => x !== b && x.status === 'awaiting_design' && !x.assetId && b.requestKind && x.requestKind === b.requestKind);
    for (const s of [b, ...siblings]) applyDesign(s, entry, s === b ? first : true);
    return b;
  };
  function applyDesign(b, entry, first) {
    b.kind = entry.id; b.generated = true; b.assetId = entry.id;
    // the real footprint replaces the placeholder. If it no longer fits where the site is, the site shifts to the
    // nearest ground that takes it (the crew re-plans its next leg from the new spot); only when nothing fits anywhere
    // does the placeholder footprint stay, so the rendered object never overlaps a neighbour by design.
    let moved = false;
    if (entry.footprint && entry.footprint.w && !(b.shape && (b.shape.poly || b.shape.pts))) {   // an outline or a stroke is the sovereign's; it never shifts
      const rect = { x: b.x, z: b.z, w: entry.footprint.w, d: entry.footprint.d };
      const free = b.floating ? game.spotFreeWater(rect, b.id) : game.spotFree(rect, b.id);
      if (free) b.footprint = { ...entry.footprint };
      else {
        const spot = game.findSpot(null, { x: b.x, z: b.z }, { mode: b.floating ? 'water' : 'near', water: b.z < plot.z0 ? 'sea' : 'lake', footprint: entry.footprint, exclude: b.id });
        if (spot) { b.x = spot.x; b.z = spot.z; b.footprint = { ...entry.footprint }; moved = true; if (b.floating) b.workSpot = game.nearestWaterEdge({ x: b.x, z: b.z }, b.z < plot.z0 ? 'sea' : null); game.log(`${b.name} shifted to (${b.x}, ${b.z}) to fit its ${entry.footprint.w}x${entry.footprint.d} plan.`); }
        else game.log(`${b.name}: no ground takes a ${entry.footprint.w}x${entry.footprint.d} plan; keeping the ${b.footprint.w}x${b.footprint.d} site.`);
      }
    }
    b.status = b.cratesDelivered > 0 || b.progress > 0 ? 'building' : 'site';
    game.emit('building:design', { building: b, asset: { id: entry.id, name: entry.name }, moved });
    if (first) game.sendLetter(L.ministryNotice(rng, { kind: 'design_arrived', day: state.day, settlement: state.name, name: b.name, building: b }));
    if (b.progress >= 1) game.completeBuilding(b);
  }

  // ---- derived numbers, stage ----
  function refreshDerived() {
    state.mood = +avgMood(state.agents).toFixed(1);
    state.prosperity = computeProsperity(state, catalog);
    const st = stageFor(state.prosperity);
    if (STAGES.indexOf(st) > STAGES.indexOf(state.stage)) {
      state.stage = st;
      game.emit('stage', { stage: st });
      game.emit('toast', { text: `You are a ${st} now` });
      game.log(`Stage: ${st}.`);
      game.sendLetter(L.ministryNotice(rng, { kind: 'stage', day: state.day, settlement: state.name, name: st }));
    }
  }

  // ---- society letters driven by the sim ----
  function societyLetters() {
    const alive = state.agents.filter(a => a.status !== 'left');
    if (state.hungry) {
      if (state.hungerSince == null) { state.hungerSince = state.t; state.nextHungerLetterAt = state.t + SOC.hungerLetterDelay; }
      if (state.t >= state.nextHungerLetterAt && alive.length) {
        state.nextHungerLetterAt = state.t + SOC.hungerLetterEvery;
        const a = rng.pick(alive.filter(x => x.status !== 'striking').concat(alive).slice(0, alive.length));
        game.sendLetter(L.complaint(rng, { agent: a, reason: 'hunger', day: state.day, settlement: state.name }));
        game.emit('toast', { text: 'The folk are hungry' });
      }
    } else state.hungerSince = null;
    if (state.t >= state.nextHomelessLetterAt) {
      state.nextHomelessLetterAt = state.t + SOC.homelessLetterEvery;
      const hl = alive.filter(a => !a.homeId);
      if (hl.length) game.sendLetter(L.complaint(rng, { agent: rng.pick(hl), reason: 'homeless', day: state.day, settlement: state.name }));
    }
    // a gentle nudge before hunger: nothing feeds the town yet, so the minister (or the Ministry) suggests a farm and a well
    if (state.nextSuggestAt != null && state.t >= state.nextSuggestAt) {
      state.nextSuggestAt = null;
      const feeds = state.buildings.some(b => b.status !== 'removed' && ['farm', 'bakery', 'dock', 'grove', 'garden'].includes(b.kind));
      if (!feeds && !state.hungry) {
        const minister = state.agents.find(x => x.id === state.minister) || null;
        const what = state.buildings.some(b => b.kind === 'well') ? 'a farm by the lake' : 'a farm by the lake and a well in the square';
        game.sendLetter(minister ? L.ministerSuggest(rng, { agent: minister, day: state.day, settlement: state.name, what }) : L.ministryNotice(rng, { kind: 'suggest', day: state.day, settlement: state.name, name: 'farm', reason: what }));
      }
    }
    if (game.offline && state.t >= state.nextSocietyAt && alive.length >= 2) {
      state.nextSocietyAt = state.t + SOC.societyEvery;
      const n = rng.pick([0, 1, 1, 2]);
      const built = new Set(state.buildings.map(b => b.kind));
      const minister = state.agents.find(x => x.id === state.minister) || null;
      for (let i = 0; i < n; i++) {
        const a = rng.pick(alive);
        const k = rng.pick(a.traits.includes('gossip') ? ['gossip', 'gossip', 'idea'] : a.traits.includes('ambitious') ? ['idea', 'petition'] : ['gossip', 'idea', 'petition']);
        if (k === 'gossip') { const others = alive.filter(x => x.id !== a.id); game.sendLetter(L.gossip(rng, { agent: a, about: rng.pick(others), day: state.day, settlement: state.name, minister })); }
        else if (k === 'idea') game.sendLetter(L.idea(rng, { agent: a, day: state.day, settlement: state.name, catalog, stage: state.stage, built }));
        else game.sendLetter(L.petition(rng, { agent: a, day: state.day, settlement: state.name, catalog, stage: state.stage, built }));
      }
    }
  }

  // a worker ran out of energy on the job: the second time in a short span they write about it
  game.onExhausted = a => {
    a.flags.exhausted = (a.flags.exhausted || 0) + 1;
    if (a.flags.exhausted >= 2 && (a.flags.overworkDay == null || state.day - a.flags.overworkDay >= SOC.overworkLetterDays)) {
      a.flags.overworkDay = state.day; a.flags.exhausted = 0;
      const b = state.buildings.find(x => x.id === a.jobId);
      game.sendLetter(L.complaint(rng, { agent: a, reason: 'overwork', day: state.day, settlement: state.name, extra: { building: b ? b.name.toLowerCase() : 'site' } }));
    }
  };

  // ---- tick ----
  // a striking or leaving minister drops the seal; the crowd elects another (fleets.js)
  const folkCtx = { onStrike: a => { strike(game, a); onMinisterGone(game, a); }, onStrikeEnd: a => strikeEnd(game, a), onLeave: a => { leave(game, a); onMinisterGone(game, a); onAgentGone(game, a); } };
  game.tick = dt => {
    dt = Number(dt);
    let left = Number.isFinite(dt) ? Math.min(SOC.maxTickSeconds, Math.max(0, dt)) : 0;
    while (left > 0) {
      const h = Math.min(0.1, left); left -= h;
      state.t += h;
      state.dayAcc += h;
      if (state.dayAcc >= ECO.daySeconds) {
        state.dayAcc -= ECO.daySeconds; state.day++;
        game.emit('day', { day: state.day });
        dailyEconomy(game); dailyNeighbours(game);
      }
      stepEconomy(game, h);
      stepTasks(game, h);
      folkCtx.hungry = state.hungry; folkCtx.moodBonus = moodBonusTotal(state, catalog); folkCtx.housingFree = housingTotal(state, catalog) - population(state);
      stepFolk(state, h, folkCtx, game.emit, rng);
      stepNeighbours(game, h);
      societyLetters();
      tickStory(game);
      tickFleets(game);
      tickVentures(game);
      tickConflicts(game);
      tickSay(game);
      tickMinds(game);
      refreshJobs(game);
      refreshDerived();
    }
    if (game.minds) { try { game.minds.update(); } catch (e) { game.log(`[minds] update failed: ${e.message}`); } }   // the mind loop's beat (once per tick call, not per substep)
  };

  // ---- summary for the minister / snapshot ----
  game.summary = () => {
    const alive = state.agents.filter(a => a.status !== 'left');
    const sites = state.buildings.filter(b => b.status !== 'done');
    const r = state.resources;
    const pop = alive.length;
    const housed = alive.filter(a => a.homeId).length;
    const ns = nextStageInfo(state.prosperity, state.stage);
    const rates = productionRates(state, catalog);
    const foodRate = Object.values(rates).reduce((s, x) => s + (x.food || 0), 0) - pop;
    let advice = 'build a house for the ones sleeping outside';
    if (r.food < pop * 2 && foodRate < 0) advice = 'plant a farm or build a bakery before the crates run dry';
    else if (housed < pop) advice = `build ${Math.ceil((pop - housed) / 4)} more house${pop - housed > 4 ? 's' : ''}`;
    else if (!Object.keys(rates).some(k => k !== 'camp')) advice = 'put folk to work: a farm, a woodcutter, a quarry';
    else if (ns.next && catalog.get('market') && !state.buildings.some(b => b.kind === 'market')) advice = 'a market would turn our goods into coin';
    else advice = ns.next ? `keep building; ${ns.next} is within reach` : 'enjoy it';
    return { pop, housed, food: r.food, wood: r.wood, stone: r.stone, coin: r.coin, goods: r.goods, sites: sites.length, siteNames: sites.map(b => b.name),
      unhappy: alive.filter(a => a.mood < 40).map(a => a.name), strikers: alive.filter(a => a.status === 'striking').map(a => a.name),
      stage: state.stage, prosperity: state.prosperity, nextStage: ns.next, toNext: ns.need, neighbours: neighbourBrief(state), advice, foodRate: +foodRate.toFixed(1),
      elected: state.story.elected, scene: state.scene,
      conflicts: conflictsBrief(state).map(c => c.summary), institutions: institutionsBrief(state).map(i => i.name),
      areas: { ...state.areas } };
  };

  // compact JSON for the LLM (≤ ~2.5k tokens)
  game.snapshot = () => {
    refreshJobs(game, true);
    const alive = state.agents.filter(a => a.status !== 'left');
    const unread = state.letters.filter(l => l.delivered && !l.read && !l.resolved).slice(-8);
    const recent = state.letters.filter(l => l.delivered && l.read && !l.resolved).slice(-4);
    const byId = new Map(state.buildings.map(b => [b.id, b]));
    const creations = state.creations.map(id => byId.get(id)).filter(b => b && b.status !== 'removed').slice(-3)
      .map(b => ({ id: b.id, name: b.name, kind: b.kind || 'pending:' + b.requestKind, x: Math.round(b.x), z: Math.round(b.z), status: b.status, ...(b.floating ? { onWater: true } : {}) }));
    return {
      day: state.day, t: Math.round(state.t), stage: state.stage, name: state.name, scene: state.scene, elected: state.story.elected,
      res: { ...state.resources }, prosperity: state.prosperity, mood: Math.round(state.mood), hungry: state.hungry,
      areas: { ...state.areas },
      housing: { total: housingTotal(state, catalog), pop: alive.length },
      minister: state.minister,
      buildings: state.buildings.map(b => ({ id: b.id, kind: b.kind || 'pending:' + b.requestKind, name: b.name, x: Math.round(b.x), z: Math.round(b.z), status: b.status, ...(b.status !== 'done' ? { p: +b.progress.toFixed(2) } : {}), ...(b.shape && b.shape.poly ? { shape: 'area' } : b.shape && b.shape.pts ? { shape: 'line' } : {}) })),
      creations,
      agents: alive.map(a => ({ id: a.id, name: a.name, species: a.species, trade: a.trade,
        ...(Object.keys(a.known).length ? { known: Object.fromEntries(Object.keys(a.known).map(k => [k, a.claims[k] ?? a.skills[k]])) } : {}),
        traits: a.traits, mood: moodBand(a.mood), status: a.status, ...(a.jobId ? { job: a.jobId } : {}), ...(a.job ? { work: a.job } : {}), ...(a.fleetId ? { fleet: a.fleetId } : {}), ...(a.homeId ? {} : { homeless: true }), ...(a.role ? { role: a.role.kind } : {}),
        ...(state.personas[a.id] && state.personas[a.id].goal ? { goal: state.personas[a.id].goal } : {}) })),
      ...(state.minds && state.minds.cast ? { minds: mindsBrief(state) } : {}),
      ...(state.fleets ? { fleets: state.fleets.map(f => ({ id: f.id, name: f.name, members: f.members.slice() })) } : {}),
      ...(state.conflicts.some(c => c.status !== 'resolved') ? { conflicts: conflictsBrief(state) } : {}),
      ...(state.institutions.some(i => i.status === 'active') ? { institutions: institutionsBrief(state) } : {}),
      ...(state.election && state.election.open ? { election: { kind: state.election.kind, open: true, candidates: state.election.candidates.length } } : {}),
      ...(state.ventures.length ? { ventures: state.ventures.slice(-3).map(v => ({ id: v.id, agentId: v.agentId, title: v.title, status: v.status })) } : {}),
      unread: unread.map(l => ({ id: l.id, from: l.from.name, kind: l.kind, subject: l.subject, ...(l.options && l.options.length ? { options: l.options.map(o => o.label) } : {}) })),
      ...(recent.length ? { recent: recent.map(l => ({ id: l.id, from: l.from.name, subject: l.subject, ...(l.options && l.options.length ? { options: l.options.map(o => o.label) } : {}) })) } : {}),
      neighbours: neighbourBrief(state),
      ...(state.lastNeighbour ? { lastNeighbour: state.lastNeighbour } : {}),
      ...(state.scene === 'moon' || state.story.returned ? { moon: { seeds: state.moon.seeds, golden: state.moon.golden, greeted: state.moon.greeted, home: state.story.returned && state.scene === 'earth' } } : {}),
      unlocked: catalog.unlocked(state.stage),
      centre, plot
    };
  };

  game.rewards = createRewards(game, { STAGES, thresholds: ECO.thresholds });   // ART_DIRECTION §22b: the four areas + the level-ups
  for (const a of state.agents) mindOf(a);
  wireObservations(game);   // what the folk notice by themselves (ART_DIRECTION §18)
  refreshJobs(game, true);
  refreshDerived();
  return game;
}

export { moodBand, nudgeMood, STAGES };
