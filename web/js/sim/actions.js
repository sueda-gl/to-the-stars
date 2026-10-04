// game.apply(action): every action type of ARCHITECTURE §4 and §9, validated, with effects the UI can narrate.

import { slug, GENERATED_DEFAULTS, defaultsFor } from './catalog.js';
import { willing, crowdAnswers, nudgeMood, SKILLS } from './society.js';
import { assignWorkers, takeJob, releaseAgent, setTask, startMeeting, siteSpot } from './tasks.js';
import { assignHomes, RES, ECO, foodCap } from './economy.js';
import { findNeighbour, edgeToward } from './neighbours.js';
import { splitRequest, anchorFromTail, inferCategory, isWaterThing, titleOf, sizeOf } from './parse.js';
import { sendGift, startElection, startVoyage, moonDo } from './story.js';
import { normaliseMark } from './marks.js';
import { pointInPoly } from './geometry.js';
import { onMinisterChosen } from './fleets.js';
import { ventureDecision } from './ventures.js';
import { foundInstitution, resolveConflict, findConflict } from './conflicts.js';
import * as L from './letters.js';

const SKILL_WORDS = {
  baking: ['bak', 'bread', 'oven', 'cook', 'pastry'], building: ['build', 'hammer', 'construct', 'mason', 'carpent'], farming: ['farm', 'grow', 'plant', 'crop', 'garden', 'harvest'],
  crafting: ['craft', 'make', 'workshop', 'carve', 'mill'], trading: ['trade', 'sell', 'market', 'merchant', 'coin', 'barter'], diplomacy: ['diploma', 'minister', 'negotiat', 'speak', 'talk', 'lead'],
  art: ['art', 'paint', 'sing', 'music', 'beaut', 'sculpt', 'draw'], scouting: ['scout', 'explore', 'fish', 'sail', 'boat', 'lookout', 'watch']
};
export function inferSkill(text) {
  const t = String(text || '').toLowerCase();
  for (const [s, words] of Object.entries(SKILL_WORDS)) if (words.some(w => t.includes(w))) return s;
  return null;
}

function shortfall(res, cost) {
  return Object.entries(cost).filter(([k, v]) => (res[k] || 0) < v).map(([k, v]) => `${v - (res[k] || 0)} more ${k}`);
}

export function applyAction(game, action) {
  if (!action || typeof action !== 'object') return { ok: false, reason: 'no action', effects: [] };
  // own keys only: 'constructor' / '__proto__' / 'toString' are not actions
  const h = typeof action.type === 'string' && Object.hasOwn(HANDLERS, action.type) ? HANDLERS[action.type] : null;
  if (!h) return { ok: false, reason: `unknown action type "${action.type}"`, effects: [] };
  try {
    const r = h(game, action) || { ok: true, effects: [] };
    r.effects = r.effects || [];
    game.log(`[${action.type}] ${r.ok ? 'ok' : 'no: ' + r.reason}`);
    if (!r.ok && r.reason) game.emit('toast', { text: r.reason });
    return r;
  } catch (e) {
    return { ok: false, reason: 'error: ' + e.message, effects: [] };
  }
}

// the last thing spoken into being ("another one over there")
function lastCreation(game) {
  const { state } = game;
  for (let i = state.creations.length - 1; i >= 0; i--) { const b = state.buildings.find(x => x.id === state.creations[i]); if (b && b.status !== 'removed') return b; }
  return state.buildings.filter(b => b.status !== 'removed').at(-1) || null;
}

// what to build: { kind } for a catalogue id, or { request, noun, category, water } for something new. Trusts an explicit
// kind that resolves; otherwise the NOUN of the request is resolved alone, its location tail stripped
// ("a lighthouse near the house" is a lighthouse, "a wind mill over there" is a windmill, "another one" is the last thing).
export function resolveCreation(game, a) {
  const { catalog } = game;
  const kindText = typeof a.kind === 'string' ? a.kind.trim() : '';
  let request = typeof a.request === 'string' ? a.request.trim() : '';
  let kind = kindText && !kindText.startsWith('pending:') ? catalog.resolve(kindText) : null;
  let parsed = splitRequest(request || kindText);
  let cloneOf = null;
  if (!kind && kindText.startsWith('pending:')) cloneOf = game.state.buildings.find(b => b.requestKind === kindText.slice(8) && b.status !== 'removed') || null;
  if (!kind && !cloneOf && parsed.another) cloneOf = lastCreation(game);
  if (cloneOf) {
    if (cloneOf.kind) kind = cloneOf.kind;
    else { request = cloneOf.request || cloneOf.name; parsed = { ...splitRequest(request), tail: parsed.tail }; }
  }
  if (!kind) kind = catalog.resolve(parsed.noun);
  if (kind) return { kind, parsed, entry: catalog.get(kind), cloneOf };
  if (!request) request = kindText || a.name || 'something new';
  const noun = parsed.noun || splitRequest(request).noun || request;
  const category = inferCategory(noun);
  return { kind: null, request, noun, parsed, category, water: isWaterThing(noun), size: sizeOf(noun), cloneOf };
}

// the anchor to search from: the LLM's `at` when it is specific, else what the request's location tail says
// ("in the lake" -> on the water, "on the cliff" -> the sea edge, "near the house" -> that building, "in the middle" -> centre)
export function resolveAt(game, at, c) {
  // a mark on the paper wins over every word (ART_DIRECTION §5): at.mark (the full mark the orchestrator attached), else the
  // mark the sim was told about (game.setMark). Mode 'mark' with no mark at all degrades to a pointer / auto placement.
  if (at && at.mode === 'mark') {
    const mark = normaliseMark(at.mark) || game.state.mark || null;
    if (mark) return { mode: 'mark', mark };
    at = Number.isFinite(at.x) && Number.isFinite(at.z) ? { mode: 'pointer', x: at.x, z: at.z } : { mode: 'auto' };
  }
  const inferred = anchorFromTail(c.parsed ? c.parsed.tail : '');
  const specific = at && ((at.mode === 'pointer' && Number.isFinite(at.x) && Number.isFinite(at.z)) || at.mode === 'water' || at.mode === 'center' || ((at.mode === 'near' || !at.mode) && at.ref));
  const floats = (c.entry && c.entry.water) || c.water;
  if (inferred && inferred.mode === 'water') return { ...inferred, ...(at && Number.isFinite(at.x) && Number.isFinite(at.z) ? { x: at.x, z: at.z } : {}) };
  if (specific) return at.mode === 'water' ? { water: 'lake', ...at } : at;
  if (inferred) return at && Number.isFinite(at.x) && Number.isFinite(at.z) ? { ...inferred, x: at.x, z: at.z } : inferred;
  if (floats) return { mode: 'water', water: 'lake', ...(at && Number.isFinite(at.x) && Number.isFinite(at.z) ? { x: at.x, z: at.z } : {}) };
  return at || null;
}

const HANDLERS = {
  build(game, a) {
    const { state, catalog, rng } = game;
    const c = resolveCreation(game, a);
    const kind = c.kind;
    const count = Math.max(1, Math.min(6, a.count | 0 || 1));
    const effects = [];
    const made = [];
    const assign = Array.isArray(a.assign) ? a.assign : a.assign ? [a.assign] : null;
    const at = resolveAt(game, a.at, c);
    const mode = at && at.mode ? at.mode : 'auto';
    let mark = mode === 'mark' ? at.mark : null;
    // a marked thing that floats by nature (a duck) takes the water only when the mark is on it; everything else sits on the ground
    const markOnWater = mark && mark.kind === 'point' && state.water.some(w => pointInPoly(mark.x, mark.z, w.poly));
    const floating = mode === 'water' || !!(markOnWater && ((c.entry && c.entry.water) || c.water));
    // the site that a mark gives (exact, or minimally nudged); null when nothing fits within reach
    const markedSpot = (kind, footprint, category) => game.markSpot(kind, mark, { footprint, floating, category });
    // after the site effect: the mark used (and its id, so the pencil can fade), the nudge if any, and what the thing crosses
    const markEffect = (b) => {
      effects.push({ type: 'mark', used: true, kind: mark.kind, id: b.id, ...(mark.id !== undefined ? { markId: mark.id } : {}), exact: !b.nudge, ...(b.shape && b.shape.poly ? { areaM2: b.shape.areaM2 } : b.shape && b.shape.pts ? { length: b.shape.length } : {}) });
      if (b.nudge) effects.push({ type: 'nudge', id: b.id, from: b.nudge.from, to: b.nudge.to, dist: b.nudge.dist, why: b.nudge.why });
      const over = game.overlapping(b.shape && (b.shape.poly || b.shape.pts) ? { ...b.shape, footprint: b.footprint } : { x: b.x, z: b.z, w: b.footprint.w, d: b.footprint.d }, b.id);
      if (over.length) effects.push({ type: 'overlaps', id: b.id, ids: over });
      if (state.mark && (mark.id === undefined || state.mark.id === mark.id)) state.mark = null;   // used: the pencil fades into the paint
    };
    // CONCEPT priority 6: creation is never blocked on resources (or on the stage, bar the Assembly): costs are flavour.
    // The crates pay what they hold, the rest is a Ministry note. Only "no ground" stops a site.
    let stop = null;
    for (let i = 0; i < count && !stop; i++) {
      if (mark && i === 1) {   // "two houses here": the first sits on the mark, the others close by it
        at.mode = 'near'; at.x = made[0].x; at.z = made[0].z; delete at.mark;
      }
      if (i > 0) mark = null;
      if (kind) {
        const e = c.entry;
        if (kind === 'assembly' && !catalog.isUnlocked(kind, state.stage)) { stop = `The ${e.name} needs a ${e.stage}; we are a ${state.stage}.`; break; }
        const spot = mark ? markedSpot(kind, null, null) : game.findSpot(kind, resolveAnchor(game, at, e), { mode: mark === null && mode === 'mark' ? 'near' : mode, water: at && at.water });
        if (!spot) { stop = mark ? `No room for a ${e.name.toLowerCase()} within ${game.MARK.maxNudge} m of your mark.` : `No dry, empty ground for a ${e.name.toLowerCase()} there.`; break; }
        const miss = shortfall(state.resources, e.cost);
        const b = game.placeBuilding(kind, spot, { name: a.name, assign, floating: spot.floating ?? floating });
        made.push(b);
        effects.push({ type: 'site', id: b.id, kind, name: b.name, x: b.x, z: b.z, workers: b.workers.slice(), category: b.category, ...(b.floating ? { floating: true } : {}), ...(b.shape ? { shape: b.shape } : {}) });
        if (mark) markEffect(b);
        if (assign && assign.length) { const r = assignWorkers(game, b, assign); for (const ref of r.refused) refuseLetter(game, ref.agent, { kind: 'build', buildingId: b.id, label: b.name.toLowerCase() }, ref.why); }
        if (!catalog.isUnlocked(kind, state.stage)) ministryAside(game, 'locked', b, effects, state.stage);
        if (miss.length) ministryAside(game, 'short', b, effects, miss.join(', '));
      } else {
        const request = c.request;
        const name = (typeof a.name === 'string' && a.name.trim()) || titleOf(c.noun);
        const sl = slug(c.noun || name);
        const D = defaultsFor(c.category);
        const spot = mark ? markedSpot(null, D.footprint, c.category) : game.findSpot(null, resolveAnchor(game, at, null), { mode: mark === null && mode === 'mark' ? 'near' : mode, water: at && at.water, footprint: D.footprint });
        if (!spot) { stop = mark ? `No room for the ${name.toLowerCase()} within ${game.MARK.maxNudge} m of your mark.` : `No dry, empty ground for the ${name.toLowerCase()} there.`; break; }
        const miss = shortfall(state.resources, D.cost);
        const b = game.placeBuilding(null, spot, { name, request, requestKind: sl, noun: c.noun, category: c.category, floating: spot.floating ?? floating, assign });
        made.push(b);
        effects.push({ type: 'needsDesign', id: b.id, request, name, noun: c.noun, category: c.category, size: c.size, x: b.x, z: b.z, ...(b.floating ? { floating: true } : {}), ...(b.shape ? { shape: b.shape } : {}) });
        if (mark) markEffect(b);
        game.emit('building:needsDesign', { building: b, request, noun: c.noun, category: c.category, size: c.size });
        if (!c.cloneOf || c.cloneOf.status !== 'awaiting_design') game.sendLetter(L.ministryNotice(rng, { kind: 'needs_design', day: state.day, settlement: state.name, request, name, building: b }));
        if (miss.length) ministryAside(game, 'short', b, effects, miss.join(', '));
      }
    }
    if (!made.length) return { ok: false, reason: stop, effects };
    // a partial count is still a success: the sites that fit are there and paid for
    if (stop) { effects.push({ type: 'partial', placed: made.length, wanted: count, reason: stop }); game.emit('toast', { text: `Only ${made.length} of ${count} fit: ${stop}` }); }
    return { ok: true, effects, buildings: made.map(b => b.id) };
  },

  ask_crowd(game, a) {
    const { state, rng } = game;
    const skill = (a.skill && SKILLS.includes(a.skill)) ? a.skill : inferSkill(a.question);
    const answers = crowdAnswers(state.agents, skill, rng, 3);
    const ids = [];
    for (const ans of answers) {
      ans.agent.known[ans.skill] = true;
      ans.agent.claims[ans.skill] = ans.claimed;
      const letter = L.skillAnswer(rng, { agent: ans.agent, skill: ans.skill, claimed: ans.claimed, tone: ans.tone, question: a.question || `who is good at ${ans.skill}?`, day: state.day, settlement: state.name });
      game.sendLetter(letter); ids.push(letter.id);
    }
    game.emit('crowd:listen', { question: a.question, answering: answers.map(x => x.agent.id) });
    return { ok: true, effects: [{ type: 'letters', ids, skill }] };
  },

  appoint_minister(game, a) {
    const { state, rng } = game;
    const agent = findAgent(game, a.agentId || a.name);
    if (!agent) return { ok: false, reason: `Nobody here called ${a.agentId || a.name}.`, effects: [] };
    if (state.minister === agent.id) return { ok: true, effects: [{ type: 'minister', agentId: agent.id, already: true }] };
    const prev = state.minister;
    state.minister = agent.id;
    releaseAgent(game, agent);
    nudgeMood(agent, 8, 'made minister', game.emit);
    agent.loyalty = Math.min(100, agent.loyalty + 10);
    if (prev) { const p = state.agents.find(x => x.id === prev); if (p) nudgeMood(p, -6, 'lost the seal', game.emit); }
    const by = a.by === 'crowd' ? 'crowd' : 'sovereign';
    game.emit('minister:set', { agentId: agent.id, by, prev: prev || null });
    game.emit('toast', { text: `${agent.name} is minister` });
    if (!a.silent) game.sendLetter(L.ministerAccept(rng, { agent, day: state.day, settlement: state.name }));
    // an open "choose your minister" ask is answered by this (the click, or "make Olla our minister"): a short ceremony
    onMinisterChosen(game, agent, by);
    return { ok: true, effects: [{ type: 'minister', agentId: agent.id, by, ...(state.ceremony ? { ceremony: true } : {}) }] };
  },

  assign(game, a) {
    const { state, rng, catalog } = game;
    const raw = Array.isArray(a.agentIds) ? a.agentIds : a.agentIds != null && a.agentIds !== '' ? [a.agentIds] : a.agentId ? [a.agentId] : [];
    const ids = raw.map(id => findAgent(game, id)).filter(Boolean);
    if (!ids.length) return { ok: false, reason: 'No such folk to assign.', effects: [] };
    const effects = [];
    if (a.to === 'idle') { for (const ag of ids) { releaseAgent(game, ag); effects.push({ type: 'idle', agentId: ag.id }); } return { ok: true, effects }; }
    if (a.to === 'rest') { for (const ag of ids) { releaseAgent(game, ag); setTask(game, ag, { kind: 'rest', to: { x: ag.x, z: ag.z } }); ag.task.arrived = true; ag.status = 'resting'; nudgeMood(ag, 4, 'sent to rest', game.emit); effects.push({ type: 'rest', agentId: ag.id }); } return { ok: true, effects }; }
    const to = typeof a.to === 'string' ? a.to.trim() : '';
    if (!to) return { ok: false, reason: 'Say where to send them: a building, "idle" or "rest".', effects: [] };
    const b = findBuilding(game, to);
    if (!b || b.status === 'removed') return { ok: false, reason: `No building "${a.to}" to assign to.`, effects: [] };
    const e = catalog.get(b.kind) || { skill: 'building' };
    for (const ag of ids) {
      const w = willing(ag, { kind: b.status === 'done' ? 'work' : 'build', skill: e.skill, buildingId: b.id, buildingKind: b.kind, day: state.day }, rng, { hungry: state.hungry, homeless: !ag.homeId });
      if (w.yes) { takeJob(game, ag, b); effects.push({ type: 'assigned', agentId: ag.id, buildingId: b.id }); }
      else { refuseLetter(game, ag, { kind: 'build', buildingId: b.id, label: b.name.toLowerCase() }, w.why); effects.push({ type: 'refused', agentId: ag.id, why: w.why }); }
    }
    return { ok: effects.some(e => e.type === 'assigned'), reason: effects.every(e => e.type === 'refused') ? `${ids.map(x => x.name).join(', ')} refused: ${effects[0].why}` : undefined, effects };
  },

  reply_letter(game, a) {
    const { state } = game;
    // an explicit id must match; without one, the most recent open letter (preferring one that asked a question)
    let letter = null;
    if (a.letterId != null && a.letterId !== '') letter = state.letters.find(l => l.id === a.letterId) || null;
    else { const open = state.letters.filter(l => !l.resolved && l.delivered); letter = open.filter(l => l.options && l.options.length).slice(-1)[0] || open.slice(-1)[0] || null; }
    if (!letter) return { ok: false, reason: a.letterId ? `No letter "${a.letterId}" in the tray.` : 'No letter to answer.', effects: [] };
    letter.resolved = true; letter.read = true; letter.reply = { decision: a.decision, text: a.text };
    const decision = ['yes', 'no', 'other'].includes(a.decision) ? a.decision : 'other';
    const effs = (letter.effects && (letter.effects[decision] || (decision === 'other' ? letter.effects.yes : null))) || [];
    const applied = [];
    for (const eff of effs) { const r = applyEffect(game, eff, letter); if (r) applied.push(r); }
    if (letter.from.kind === 'agent' && !effs.some(e => e.type === 'mood')) { const ag = state.agents.find(x => x.id === letter.from.id); if (ag) nudgeMood(ag, decision === 'no' ? -2 : 3, 'got a reply', game.emit); }
    if (letter.from.kind === 'neighbour' && state.neighbours.some(n => n.id === letter.from.id)) state.lastNeighbour = letter.from.id;
    game.emit('letter:resolved', { letterId: letter.id, decision });
    return { ok: true, effects: applied };
  },

  demolish(game, a) {
    const { state, catalog } = game;
    const b = findBuilding(game, a.buildingId);
    if (!b || b.status === 'removed') return { ok: false, reason: 'Nothing there to demolish.', effects: [] };
    // half of what was really paid (not the catalogue price: a pending site paid the default, a palace paid what the crates had)
    const paid = b.paidCost && typeof b.paidCost === 'object' ? b.paidCost : (catalog.get(b.kind) || { cost: {} }).cost || {};
    const refund = {};
    for (const [k, v] of Object.entries(paid)) { const r = Math.floor((Number(v) || 0) / 2); if (r > 0) refund[k] = r; }
    addResources(game, refund);
    for (const id of b.workers.slice()) { const ag = state.agents.find(x => x.id === id); if (ag) releaseAgent(game, ag); }
    b.status = 'removed'; b.workers = [];
    state.buildings = state.buildings.filter(x => x.id !== b.id);
    assignHomes(state, catalog);
    game.emit('building:remove', { id: b.id });
    game.emit('resources', { resources: { ...state.resources } });
    return { ok: true, effects: [{ type: 'demolished', id: b.id, refund }] };
  },

  call_meeting(game) {
    const { state, rng } = game;
    if (state.meeting) return { ok: false, reason: 'A meeting is already in session.', effects: [] };
    const m = startMeeting(game);
    const minister = state.agents.find(x => x.id === state.minister) || null;
    game.sendLetter(L.ministerReport(rng, { agent: minister, day: state.day, settlement: state.name, summary: game.summary(), occasion: 'meeting' }));
    return { ok: true, effects: [{ type: 'meeting', where: m.where, attendees: m.attendees.length, minister: minister ? minister.id : null }] };
  },

  message_agent(game, a) {
    const { state, rng } = game;
    const agent = findAgent(game, a.agentId || a.name);
    if (!agent) return { ok: false, reason: `Nobody here called ${a.agentId || a.name}.`, effects: [] };
    nudgeMood(agent, 3, 'spoken to', game.emit);
    const minister = state.agents.find(x => x.id === state.minister) || null;
    const letter = L.talkReply(rng, { agent, text: a.text || '', day: state.day, settlement: state.name, minister });
    game.sendLetter(letter);
    game.emit('agent:listen', { agentId: agent.id });
    return { ok: true, effects: [{ type: 'letters', ids: [letter.id] }] };
  },

  trade(game, a) {
    const { state } = game;
    const n = pickNeighbour(game, a.neighbourId);
    if (!n) return { ok: false, reason: 'No such neighbour.', effects: [] };
    if (n.attitude < 25) return { ok: false, reason: `${n.name} will not trade with us right now.`, effects: [] };
    const give = cleanBundle(a.give), get = cleanBundle(a.get);
    if (!Object.keys(give).length && !Object.keys(get).length) return { ok: false, reason: 'Nothing to trade: name what we give and what we get (food, wood, stone, coin, goods).', effects: [] };
    const miss = shortfall(state.resources, give);
    if (miss.length) return { ok: false, reason: `We cannot give that: we need ${miss.join(', ')}.`, effects: [] };
    doTrade(game, n, give, get);
    state.lastNeighbour = n.id;
    return { ok: true, effects: [{ type: 'trade', neighbourId: n.id, give, get }] };
  },

  name_settlement(game, a) {
    game.state.name = String(a.name || '').trim().slice(0, 40) || game.state.name;
    game.emit('toast', { text: `Welcome to ${game.state.name}` });
    return { ok: true, effects: [{ type: 'name', name: game.state.name }] };
  },

  // ---- §9: diplomacy you can see, the election, the moon ----
  // a courier walks the gift to the plot's edge toward the nation, is away for the journey, and the thank-you comes by envoy
  send_gift(game, a) {
    const { state } = game;
    const n = pickNeighbour(game, a.neighbourId);
    if (!n) return { ok: false, reason: 'No such neighbour to send a gift to.', effects: [] };
    const give = cleanBundle(a.give);
    const gift = (typeof a.gift === 'string' && a.gift.trim()) || (Object.keys(give).length ? Object.entries(give).map(([k, v]) => `${v} ${k}`).join(' and ') : 'a basket of bread');
    if (state.scene === 'moon') return { ok: false, reason: 'We are on the moon; the gift can go when we are home.', effects: [] };
    const r = sendGift(game, { neighbour: n, gift, give });
    return { ok: true, effects: [{ type: 'gift', neighbourId: n.id, gift, carrierId: r.courierId, travel: r.travel, to: r.exit, paid: r.paid }] };
  },

  // the camera's business; the sim logs it, remembers who was visited and lets the nation know it was noticed
  visit_neighbour(game, a) {
    const { state } = game;
    const n = pickNeighbour(game, a.neighbourId);
    if (!n) return { ok: false, reason: 'No such neighbour to visit.', effects: [] };
    n.visits = (n.visits || 0) + 1;
    n.attitude = Math.min(100, n.attitude + 2);
    state.lastNeighbour = n.id;
    game.emit('neighbour:visit', { neighbourId: n.id, x: n.x, z: n.z, name: n.name, title: n.title });
    game.log(`Visiting ${n.name}.`);
    return { ok: true, effects: [{ type: 'visit', neighbourId: n.id, x: n.x, z: n.z }] };
  },

  // elected: the voyage starts now. Not yet: the three nations write within ~3 s, and the voyage follows the letter.
  go_moon(game) {
    const { state } = game;
    if (state.scene === 'moon') return { ok: true, effects: [{ type: 'voyage', already: true }] };
    const r = startElection(game, { thenVoyage: true });
    if (r === 'elected') return { ok: true, effects: [{ type: 'voyage', elected: true }] };
    game.emit('toast', { text: 'Word is sent to the three nations' });
    return { ok: true, effects: [{ type: 'election', pending: true, inSeconds: 3 }] };
  },

  // only on the moon: seed | golden_hour | daylight | greet | gift | go_home; the shadelings answer by letter
  moon(game, a) {
    const { state } = game;
    const what = String(a.do || '').trim();
    const DO = ['seed', 'golden_hour', 'daylight', 'greet', 'gift', 'go_home'];
    if (!DO.includes(what)) return { ok: false, reason: `On the moon you can: ${DO.join(', ')}.`, effects: [] };
    if (state.scene !== 'moon') return { ok: false, reason: 'We are not on the moon. Say "let us go to the moon" first.', effects: [] };
    return { ok: true, effects: [moonDo(game, what, typeof a.text === 'string' ? a.text.trim() : '')] };
  },

  // pull up to orbit / come back down (camera only; the sim notes it)
  show(game, a) {
    const target = a.target === 'globe' || a.target === 'home' ? a.target : null;
    if (!target) return { ok: false, reason: 'Show what: the globe or home?', effects: [] };
    game.emit('show', { target });
    game.log(`Show: ${target}.`);
    return { ok: true, effects: [{ type: 'show', target }] };
  },

  // ---- ART_DIRECTION §15: institutions and conflicts ----
  // found_institution { kind: 'police patrol' | 'night watch' | 'court' | 'school' | 'guild' | 'festival committee' | free text,
  //                     members?: n | [agentId | name, ...] (ART_DIRECTION §20: the sovereign's own picks, taken as given; a
  //                     number or nothing = the sim picks fitting folk), leader?: agentId | name, name?: string,
  //                     request?: 'a watchtower' (also raises a place) }
  found_institution(game, a) {
    const r = foundInstitution(game, { kind: a.kind || a.request || a.name, members: Array.isArray(a.members) ? a.members : (a.members ?? a.count), leader: a.leader || a.agentId, name: a.name, request: a.request && a.kind ? a.request : null });
    return r.ok ? { ok: true, effects: r.effects, institutionId: r.institution.id } : r;
  },
  // resolve_conflict { conflictId?, how: 'talk' | 'punish' | 'compensate' | 'ignore' | free text }: no id = the newest open one
  resolve_conflict(game, a) {
    const c = findConflict(game, a.conflictId);
    if (!c) return { ok: false, reason: 'There is no dispute waiting for your word.', effects: [] };
    return resolveConflict(game, c, a.how || a.text || 'talk', { by: 'sovereign' });
  },

  noop(game, a) {
    game.emit('toast', { text: a.why || 'The minister did not understand.' });
    return { ok: true, effects: [{ type: 'noop', why: a.why }] };
  }
};

function catalogDefaults() { return GENERATED_DEFAULTS; }

// a Ministry aside about a site that went ahead anyway (short on materials / ambitious for the stage).
// Throttled per kind so a burst of builds is one letter, not twenty; the effect is always recorded.
const ASIDE_EVERY = 90;
function ministryAside(game, kind, b, effects, detail) {
  const { state, rng } = game;
  effects.push({ type: kind, id: b.id, detail });
  state.nextAsideAt = state.nextAsideAt || {};
  if ((state.nextAsideAt[kind] ?? 0) > state.t) return;
  state.nextAsideAt[kind] = state.t + ASIDE_EVERY;
  game.sendLetter(L.ministryNotice(rng, { kind, day: state.day, settlement: state.name, name: b.name, building: b, reason: detail }));
}

export function findAgent(game, ref) {
  if (!ref) return null;
  const r = String(ref).toLowerCase();
  return game.state.agents.find(a => a.status !== 'left' && (a.id === ref || a.name.toLowerCase() === r)) || game.state.agents.find(a => a.status !== 'left' && a.name.toLowerCase().startsWith(r)) || null;
}

// a building by id, kind, name, request noun or a word of its name ("the duck" -> Giant Rubber Duck); the newest wins
export function findBuilding(game, ref) {
  if (ref == null || ref === '') return null;
  const { state, catalog } = game;
  const r = String(ref).toLowerCase().trim();
  const live = state.buildings.filter(b => b.status !== 'removed');
  const byExact = live.filter(b => b.id === ref || b.kind === r || (b.name || '').toLowerCase() === r || (b.noun || '') === r || (b.requestKind || '') === r);
  if (byExact.length) return byExact.at(-1);
  const kind = catalog.resolve(r);
  if (kind) { const bk = live.filter(b => b.kind === kind); if (bk.length) return bk.at(-1); }
  const words = r.replace(/^(the|a|an|our|that|this|my)\s+/, '').replace(/[^a-z0-9 ]+/g, ' ').split(' ').filter(w => w.length >= 3);
  if (!words.length) return null;
  const sing = w => w.length > 3 && /s$/.test(w) && !/ss$/.test(w) ? w.slice(0, -1) : w;
  const ws = words.map(sing);
  let best = null, bs = 0;
  for (const b of live) {
    const hay = `${b.name || ''} ${b.noun || ''} ${b.request || ''} ${b.kind || ''}`.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(' ').filter(Boolean).map(sing);
    const sc = ws.filter(w => hay.includes(w)).length;
    if (sc >= bs && sc > 0) { bs = sc; best = b; }   // ties go to the newest
  }
  return best;
}

// a neighbour by anything that names it; "the neighbours" / nothing = the last one mentioned, else the friendliest
export function pickNeighbour(game, ref) {
  const { state } = game;
  const r = ref == null ? '' : String(ref).toLowerCase().trim();
  if (!r || /^(the )?(neighbou?rs?|nations?|them|everyone|all)$/.test(r)) {
    const last = state.lastNeighbour && state.neighbours.find(n => n.id === state.lastNeighbour);
    return last || state.neighbours.slice().sort((p, q) => q.attitude - p.attitude)[0] || null;
  }
  return findNeighbour(state, ref);
}

function refuseLetter(game, agent, task, why) {
  game.emit('agent:refuse', { agentId: agent.id, task, why });
  game.sendLetter(L.refusal(game.rng, { agent, task, why, day: game.state.day, settlement: game.state.name }));
}

// where to search from, per at.mode / at.ref
export function resolveAnchor(game, at, entry) {
  const { state } = game;
  if (!at) return entry && entry.wantsWater ? game.nearestWaterEdge(state.centre) : null;
  const mode = at.mode || 'auto';
  if (mode === 'water') return Number.isFinite(at.x) && Number.isFinite(at.z) ? { x: at.x, z: at.z } : game.waterCentre(at.water === 'sea' ? 'sea' : 'lake');
  if (mode === 'pointer' && Number.isFinite(at.x) && Number.isFinite(at.z)) return { x: at.x, z: at.z };
  if (mode === 'center') return { ...state.centre };
  if (mode === 'near' || at.ref) {
    const ref = at.ref;
    if (ref === 'water' || ref === 'lake' || ref === 'pond') return game.nearestWaterEdge(Number.isFinite(at.x) ? { x: at.x, z: at.z } : state.centre, 'lake');
    if (ref === 'edge' || ref === 'cliff' || ref === 'sea' || ref === 'coast' || ref === 'shore' || ref === 'beach' || ref === 'bay') return game.nearestWaterEdge(Number.isFinite(at.x) ? { x: at.x, z: at.z } : { x: state.centre.x, z: state.plot.z0 }, 'sea');
    if (ref === 'center' || ref === 'centre' || ref === 'middle' || ref === 'square') return { ...state.centre };
    const b = ref && findBuilding(game, ref);
    if (b) return { x: b.x, z: b.z };
    const n = ref && findNeighbour(state, ref);
    if (n) { const e = edgeToward(state, n, 6); return { x: e.x, z: e.z }; }
    if (Number.isFinite(at.x) && Number.isFinite(at.z)) return { x: at.x, z: at.z };
  }
  if (Number.isFinite(at.x) && Number.isFinite(at.z)) return { x: at.x, z: at.z };
  return entry && entry.wantsWater ? game.nearestWaterEdge(state.centre) : null;
}

// only real resources, whole positive amounts, nothing absurd: an LLM's slip never corrupts the stockpile.
// Takes { wood: 5 } or the server schema's [{ res:'wood', n:5 }].
export const MAX_TRADE = 500;
export function cleanBundle(obj) {
  const out = {};
  if (Array.isArray(obj)) { const o = {}; for (const it of obj) if (it && typeof it === 'object' && typeof it.res === 'string') o[it.res] = (o[it.res] || 0) + Number(it.n); obj = o; }
  if (!obj || typeof obj !== 'object') return out;
  for (const k of RES) { const v = Math.floor(Number(obj[k])); if (Number.isFinite(v) && v > 0) out[k] = Math.min(MAX_TRADE, v); }
  return out;
}
export const resCapOf = (state, k) => k === 'food' ? foodCap(state) : ECO.resCap;
export function addResources(game, delta) {
  const { state } = game;
  for (const k of RES) {
    const v = Number(delta && delta[k]);
    if (!Number.isFinite(v) || !v) continue;
    state.resources[k] = Math.max(0, Math.min(resCapOf(state, k), Math.round(state.resources[k] + v)));
  }
}
export function doTrade(game, n, giveIn, getIn) {
  const { state } = game;
  const give = cleanBundle(giveIn), get = cleanBundle(getIn);
  for (const [k, v] of Object.entries(give)) state.resources[k] = Math.max(0, state.resources[k] - v);
  for (const [k, v] of Object.entries(get)) state.resources[k] = Math.min(resCapOf(state, k), state.resources[k] + v);
  n.attitude = Math.min(100, n.attitude + 5);
  game.emit('resources', { resources: { ...state.resources } });
  game.emit('toast', { text: `Traded with ${n.name}` });
  game.log(`Traded ${JSON.stringify(give)} for ${JSON.stringify(get)} with ${n.name}.`);
}

// consequences of a reply
export function applyEffect(game, eff, letter) {
  const { state, catalog } = game;
  const agent = eff.agentId ? state.agents.find(a => a.id === eff.agentId) : null;
  const n = eff.neighbourId ? state.neighbours.find(x => x.id === eff.neighbourId) : null;
  switch (eff.type) {
    case 'mood': if (agent) { nudgeMood(agent, eff.delta, eff.reason, game.emit); return { type: 'mood', agentId: agent.id, delta: eff.delta }; } return null;
    case 'loyalty': if (agent) { agent.loyalty = Math.max(0, Math.min(100, agent.loyalty + eff.delta)); return { type: 'loyalty', agentId: agent.id, delta: eff.delta }; } return null;
    case 'assign': return applyAction(game, { type: 'assign', agentIds: eff.agentIds, to: eff.to }).effects[0] || null;
    case 'force_assign': {
      const b = eff.to ? state.buildings.find(x => x.id === eff.to) : null;
      if (agent && b && b.status !== 'done') { takeJob(game, agent, b); return { type: 'assigned', agentId: agent.id, buildingId: b.id, forced: true }; }
      return null;
    }
    case 'build': return applyAction(game, { type: 'build', kind: eff.kind, at: { mode: 'auto' } }).effects[0] || null;
    case 'festival': { for (const a of state.agents) if (a.status !== 'left') nudgeMood(a, 6, 'festival', game.emit); state.resources.food = Math.max(0, state.resources.food - 5); return { type: 'festival' }; }
    case 'resources': { addResources(game, eff.delta); game.emit('resources', { resources: { ...state.resources } }); return { type: 'resources', delta: eff.delta }; }
    case 'attitude': if (n) { n.attitude = Math.max(0, Math.min(100, n.attitude + eff.delta)); return { type: 'attitude', neighbourId: n.id, delta: eff.delta }; } return null;
    case 'trade': if (n) { const miss = shortfall(state.resources, cleanBundle(eff.give)); if (miss.length) { game.emit('toast', { text: `Cannot trade: need ${miss.join(', ')}` }); return { type: 'trade_failed', miss }; } doTrade(game, n, eff.give, eff.get); return { type: 'trade', neighbourId: n.id }; } return null;
    case 'gift': if (n) { const k = state.resources.goods >= 3 ? 'goods' : 'coin'; const r = applyAction(game, { type: 'send_gift', neighbourId: n.id, gift: `3 ${k}`, give: { [k]: 3 } }); return r.effects[0] || { type: 'gift', neighbourId: n.id, res: k }; } return null;
    case 'ally': if (n) { n.allied = true; game.emit('toast', { text: `Allied with ${n.name}` }); return { type: 'ally', neighbourId: n.id }; } return null;
    case 'ally_ask': if (n && !n.allied) { n.nextKind = 'alliance'; n.nextLetterAt = Math.min(n.nextLetterAt, state.t + 30); return { type: 'ally_ask', neighbourId: n.id }; } return null;
    case 'go_moon': return applyAction(game, { type: 'go_moon' }).effects[0] || null;
    case 'voyage': return applyAction(game, { type: 'go_moon' }).effects[0] || null;
    case 'venture': return ventureDecision(game, eff.ventureId, eff.decision || (letter && letter.reply ? letter.reply.decision : 'yes'));
    case 'conflict': { const c = findConflict(game, eff.conflictId); if (!c) return null; const r = resolveConflict(game, c, eff.how || (letter && letter.reply ? letter.reply.text : 'talk'), { by: 'sovereign' }); return r.effects[0] || null; }
    case 'institution': return applyAction(game, { type: 'found_institution', kind: eff.kind, members: eff.members, leader: eff.leader }).effects[0] || null;
    default: return null;
  }
}
