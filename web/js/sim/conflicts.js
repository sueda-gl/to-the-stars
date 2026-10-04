// Conflicts and institutions (ART_DIRECTION §15). Folk have disputes that emerge from the state, their traits and
// their relationships: theft at the crates when food is short, quarrels between rivals, noise complaints near
// workshops and taverns, two folk claiming the same plot, neglected duties, an envoy's grievance, jealousy of the
// minister. The minister (or the Ministry, when no minister sits) brings each one to the sovereign by letter with
// quick replies; ignored, a conflict escalates (mood and loyalty drop, a strike, after a long time someone leaves).
// The sovereign answers with words (talk / punish / compensate / ignore) or with INSTITUTIONS: a police patrol, a
// night watch, a court, a school, a guild, a festival committee, or anything else named. An institution is a real
// group of folk with a role, a uniform tag for the visual layer, scheduled behaviour (patrol routes, court sessions,
// lessons, festivals) and effects on the conflicts (theft down sharply with a patrol, quarrels settled at court...).
// Pure: no THREE, no DOM. Rule-based offline; the live minds only write the letters in richer words.

import { nudgeMood, willing, BAL, avgMood } from './society.js';
import { setTask, clearTask, releaseAgent, strike, leave } from './tasks.js';
import { remember } from './talk.js';
import { dist } from './geometry.js';
import { edgeToward } from './neighbours.js';
import { ECO } from './economy.js';
import * as L from './letters.js';

export const CONFLICT = {
  firstAfter: 200,          // s of play before the first conflict can come (~3-4 min: after the opening and the first builds)
  every: [120, 200],        // s between conflicts
  unhappyFactor: 0.55,      // the interval shrinks when the town is unhappy (mood < 50) or hungry
  unhappyMood: 50,
  retryAfter: 30,           // s until the next look when nothing fits
  maxOpen: 3,               // open conflicts at a time
  escalateAfter: 150,       // s an unanswered conflict waits before it escalates
  ignoredEscalateAfter: 60, // ... sooner once the sovereign said "ignore"
  maxSeverity: 3,
  settleSeconds: 25,        // s between 'handled' and 'resolved' (the folk calm down)
  leaveAfter: 420,          // s at full severity before the aggrieved folk leaves (never before BAL.noLeaveBefore)
  theftFood: 3,             // food that goes missing in a theft
  granaryTheft: 0.5,        // a finished granary halves theft
  patrolPause: 2.2,         // s a patrol stands at each point of its route
  settleWalkSeconds: 4,     // s an institution's member stands at a conflict while settling it
  attendEvery: [10, 18]     // s between a non-patrol member's visits to the venue
};

export const CONFLICT_KINDS = ['theft', 'quarrel', 'noise', 'land', 'neglect', 'envoy', 'jealousy'];
export const HOWS = ['talk', 'punish', 'compensate', 'ignore'];
const NOISY = ['workshop', 'tavern', 'windmill', 'smithy', 'quarry', 'woodcutter', 'sawmill', 'market', 'kiln', 'bakery'];

const alive = a => a && a.status !== 'left';
const name = (game, id) => { const a = game.state.agents.find(x => x.id === id); return a ? a.name : id; };
const plain = o => JSON.parse(JSON.stringify(o));
const slug = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30);
const titleCase = s => String(s || '').replace(/\b\p{L}/gu, c => c.toUpperCase());
const r2 = v => +v.toFixed(2);

// ---------- institution specs ----------
// kind -> how it is staffed, what it does, what it changes. `fit(a)` scores a candidate; `remit` names the conflict
// kinds its members settle; `effects` scale the chance of new conflicts (theft 0.15 = 85 % fewer thefts); `duty`
// 'patrol' walks a route (watch: at night only); `schedule` runs sessions (court), lessons (school), festivals...
const T = (a, t) => a.traits.includes(t);
export const INSTITUTION_SPECS = {
  patrol: { name: 'Police Patrol', title: 'constable', badge: 'blue armband', members: 2, duty: 'patrol',
    fit: a => a.skills.scouting * 0.5 + a.skills.building * 0.3 + (T(a, 'loyal') ? 2 : 0) + (T(a, 'stubborn') ? 1 : 0) - (T(a, 'lazy') ? 2 : 0) - (T(a, 'timid') ? 1.5 : 0) + a.mood / 50,
    remit: ['theft', 'noise'], effects: { theft: 0.15, noise: 0.3 }, say: 'I will keep the crates safe.' },
  watch: { name: 'Night Watch', title: 'watchman', badge: 'lantern', members: 2, duty: 'patrol', night: true,
    fit: a => a.skills.scouting * 0.6 + (T(a, 'loyal') ? 1.5 : 0) - (T(a, 'lazy') ? 2 : 0) + a.energy / 60,
    remit: ['theft', 'noise'], effects: { theft: 0.35, noise: 0.5 }, say: 'Nothing moves by night without my lantern seeing it.' },
  court: { name: 'Court', title: 'judge', badge: 'black sash', members: 1, duty: 'attend',
    fit: a => a.skills.diplomacy + (T(a, 'loyal') ? 1.5 : 0) + (T(a, 'generous') ? 1 : 0) - (T(a, 'gossip') ? 1 : 0) - (T(a, 'proud') ? 0.5 : 0),
    remit: ['quarrel', 'land', 'jealousy', 'envoy'], effects: { fairness: 2 }, schedule: { kind: 'session', every: 90, seconds: 12, onlyWithRemit: true }, say: 'Bring your quarrels to the square. I will hear them.' },
  school: { name: 'School', title: 'teacher', badge: 'chalk pouch', members: 1, duty: 'attend',
    fit: a => a.skills.art * 0.5 + a.skills.diplomacy * 0.4 + (T(a, 'generous') ? 1 : 0) + (T(a, 'timid') ? 0.5 : 0),
    remit: ['neglect'], effects: { neglect: 0.5 }, schedule: { kind: 'lesson', every: 120, seconds: 14, pupils: 3 }, say: 'Lessons at the square. Bring a stick to draw with.' },
  guild: { name: 'Guild', title: 'guild member', badge: 'guild pin', members: 3, duty: 'attend',
    fit: a => Math.max(...Object.values(a.skills)) * 0.5 + (T(a, 'proud') ? 0.5 : 0) + a.mood / 50,
    remit: [], effects: { quarrel: 0.3 }, schedule: { kind: 'meeting', every: 150, seconds: 10 }, say: 'The guild meets. Standards will be kept.' },
  festival: { name: 'Festival Committee', title: 'committee member', badge: 'ribbon', members: 2, duty: 'attend',
    fit: a => a.skills.art * 0.6 + (T(a, 'generous') ? 1.5 : 0) + (T(a, 'gossip') ? 0.5 : 0) - (T(a, 'lazy') ? 0.5 : 0) + a.mood / 40,
    remit: [], effects: { mood: 1 }, schedule: { kind: 'festival', every: 180, seconds: 18 }, say: 'A festival! Ribbons on everything.' },
  generic: { name: 'Society', title: 'member', badge: 'cream sash', members: 2, duty: 'attend',
    fit: a => a.mood / 30 + (T(a, 'loyal') ? 1 : 0) + (T(a, 'ambitious') ? 0.5 : 0),
    remit: [], effects: {}, schedule: { kind: 'gathering', every: 150, seconds: 8 }, say: 'We meet at the square.' }
};
const BADGES = ['red armband', 'teal scarf', 'plum rosette', 'cream sash', 'ochre band', 'cobalt pin'];
const TRADE_WORDS = { builder: 'building', baker: 'baking', farmer: 'farming', crafter: 'crafting', trader: 'trading', diplomat: 'diplomacy', artist: 'art', dreamer: 'art', scout: 'scouting', courier: 'scouting' };

// "start a police patrol team" / "night watch" / "a court" / "builders' guild" / anything -> the spec kind + a name
export function institutionKind(text) {
  const t = String(text || '').toLowerCase();
  if (/night ?watch|watchmen|watchman|sentr|lookouts?\b/.test(t)) return 'watch';
  if (/police|patrol|guards?\b|constab|sheriff|peace ?keep|security|militia/.test(t)) return 'patrol';
  if (/\bcourt|judge|tribunal|justice|magistrat|\blaw\b/.test(t)) return 'court';
  if (/school|teach|lesson|academy|tutor/.test(t)) return 'school';
  if (/guild|union|brotherhood|association/.test(t)) return 'guild';
  if (/festival|fete|feast|celebrat|carnival|party/.test(t)) return 'festival';
  return 'generic';
}

// ---------- conflicts: emergence ----------
function institutionFactor(state, key) {
  let f = 1;
  for (const i of state.institutions) { if (i.status !== 'active') continue; const s = INSTITUTION_SPECS[i.kind] || INSTITUTION_SPECS.generic; if (s.effects[key] != null) f = Math.min(f, s.effects[key]); }
  return f;
}
const hasGranary = state => state.buildings.some(b => b.kind === 'granary' && b.status === 'done');
const openConflicts = state => state.conflicts.filter(c => c.status === 'open' || c.status === 'escalated');
const canBeParty = (state, a) => alive(a) && a.status !== 'striking' && !(a.task && ['deliver', 'journey', 'leave', 'stand'].includes(a.task.kind)) && !state.conflicts.some(c => c.status !== 'resolved' && c.parties.includes(a.id));

function candidates(game) {
  const { state, rng } = game;
  const folk = state.agents.filter(a => canBeParty(state, a));
  const minister = state.agents.find(a => a.id === state.minister) || null;
  const civilians = folk.filter(a => a.id !== state.minister && !a.role);
  const pop = state.agents.filter(alive).length;
  const unhappy = avgMood(state.agents) < CONFLICT.unhappyMood;
  const out = [];
  const jit = (a, k) => rng.jitter(`${a.id}|${k}|${state.day}`) * 0.6;
  // 1. theft at the stockpile: food is short. A patrol / a night watch / a locked granary make it rare.
  if (civilians.length >= 2 && (state.hungry || state.resources.food < pop * 2)) {
    const factor = institutionFactor(state, 'theft') * (hasGranary(state) ? CONFLICT.granaryTheft : 1);
    const thief = civilians.map(a => ({ a, s: (T(a, 'lazy') ? 1 : 0) + (T(a, 'ambitious') ? 0.5 : 0) - (T(a, 'loyal') ? 1.5 : 0) - (T(a, 'generous') ? 1 : 0) + (50 - a.mood) / 50 + (50 - a.loyalty) / 50 + jit(a, 'thief') })).sort((p, q) => q.s - p.s)[0].a;
    const witness = civilians.filter(a => a !== thief).sort((p, q) => (T(q, 'gossip') ? 1 : 0) - (T(p, 'gossip') ? 1 : 0) || jit(q, 'w') - jit(p, 'w'))[0];
    if (witness) out.push({ kind: 'theft', weight: 3 * factor * (state.hungry ? 2.5 : 1), parties: [thief.id, witness.id], roles: { offender: thief.id, complainant: witness.id }, severity: state.hungry ? 2 : 1,
      place: { x: r2(state.stockpile.x + 1.5), z: r2(state.stockpile.z + 1) }, summary: `${witness.name} says ${thief.name} took bread from the crates.`, topic: 'bread' });
  }
  // 2. quarrels between rivals: same trade, both ambitious / proud, a stubborn one; worse in a low mood. A guild calms its trade.
  {
    let best = null;
    for (let i = 0; i < civilians.length; i++) for (let j = i + 1; j < civilians.length; j++) {
      const a = civilians[i], b = civilians[j];
      let s = 0; let topic = 'a borrowed tool';
      if (a.trade === b.trade) { s += 1; topic = `who is the better ${a.trade}`; }
      if (T(a, 'ambitious') && T(b, 'ambitious')) { s += 1; topic = 'who should lead the next site'; }
      if (T(a, 'proud') && T(b, 'proud')) { s += 0.8; const last = state.buildings.filter(x => x.status === 'done').at(-1); topic = last ? `who gets the credit for the ${last.name.toLowerCase()}` : 'who flew in first'; }
      if (T(a, 'stubborn') || T(b, 'stubborn')) s += 0.5;
      if (a.jobId && a.jobId === b.jobId) s += 0.5;
      s += (65 - (a.mood + b.mood) / 2) / 30;
      s += (rng.jitter(`${a.id}|${b.id}|q|${state.day}`) - 0.5) * 0.4;
      if (a.trade === b.trade) s *= institutionFactor(state, 'quarrel');
      if (s >= 1 && (!best || s > best.s)) best = { a, b, s, topic };
    }
    if (best) out.push({ kind: 'quarrel', weight: 2 * (unhappy ? 1.5 : 1), parties: [best.a.id, best.b.id], roles: {}, severity: 1,
      place: { x: r2((best.a.x + best.b.x) / 2), z: r2((best.a.z + best.b.z) / 2) }, summary: `${best.a.name} and ${best.b.name} are quarrelling over ${best.topic}.`, topic: best.topic });
  }
  // 3. noise near a workshop / tavern / mill: a folk whose home stands close by cannot sleep
  {
    const noisy = state.buildings.filter(b => b.status === 'done' && NOISY.includes(b.kind));
    const homes = new Map(state.buildings.filter(b => b.status === 'done').map(b => [b.id, b]));
    let pick = null;
    for (const a of civilians) {
      const h = a.homeId ? homes.get(a.homeId) : null; if (!h) continue;
      for (const b of noisy) { const d = dist(h.x, h.z, b.x, b.z); if (d < 9 && (!pick || d < pick.d)) pick = { a, b, d }; }
    }
    if (pick) { const worker = state.agents.find(x => x.jobId === pick.b.id && x.id !== pick.a.id); out.push({ kind: 'noise', weight: 1.5 * institutionFactor(state, 'noise'), parties: worker ? [pick.a.id, worker.id] : [pick.a.id], roles: { complainant: pick.a.id, ...(worker ? { offender: worker.id } : {}) }, severity: 1, buildingId: pick.b.id,
      place: { x: pick.b.x, z: pick.b.z }, summary: `${pick.a.name} cannot sleep for the noise from the ${pick.b.name}.`, topic: pick.b.name }); }
  }
  // 4. a dispute over land: two ambitious folk want the same plot
  {
    const wanting = civilians.filter(a => T(a, 'ambitious') || Math.max(...Object.values(a.skills)) >= 8).sort((p, q) => jit(q, 'land') - jit(p, 'land'));
    if (wanting.length >= 2) {
      const near = state.buildings.filter(b => b.status === 'done').sort((p, q) => dist(p.x, p.z, state.centre.x, state.centre.z) - dist(q.x, q.z, state.centre.x, state.centre.z))[0];
      const spot = game.freeGroundNear(near ? { x: near.x, z: near.z } : state.centre, 6);
      out.push({ kind: 'land', weight: 1.2, parties: [wanting[0].id, wanting[1].id], roles: {}, severity: 2, place: spot,
        summary: `${wanting[0].name} and ${wanting[1].name} both claim the plot by the ${near ? near.name.toLowerCase() : 'square'} for their own.`, topic: 'the plot' });
    }
  }
  // 5. a neglected duty: a worn-out or lazy worker lets a workplace go
  {
    const slack = civilians.filter(a => a.jobId && state.buildings.some(b => b.id === a.jobId && b.status === 'done') && (T(a, 'lazy') || a.energy < 35)).sort((p, q) => (T(q, 'lazy') ? 1 : 0) - (T(p, 'lazy') ? 1 : 0) || p.energy - q.energy);
    if (slack.length) { const a = slack[0], b = state.buildings.find(x => x.id === a.jobId); out.push({ kind: 'neglect', weight: (T(a, 'lazy') ? 1.5 : 1) * institutionFactor(state, 'neglect'), parties: [a.id], roles: { offender: a.id }, severity: 1, buildingId: b.id, place: { x: b.x, z: b.z },
      summary: `${a.name} has let the ${b.name.toLowerCase()} go: ${T(a, 'lazy') ? 'tools down since noon' : 'too worn out to keep up'}.`, topic: b.name }); }
  }
  // 6. an envoy's grievance: a cold nation complains about one of ours over their side of the water
  {
    const cold = state.neighbours.filter(n => !n.allied && n.attitude < 45 && !state.conflicts.some(c => c.status !== 'resolved' && c.neighbourId === n.id)).sort((p, q) => p.attitude - q.attitude)[0];
    const flier = civilians.sort((p, q) => q.skills.scouting - p.skills.scouting)[0];
    if (cold && flier) { const e = edgeToward(state, cold, 3); out.push({ kind: 'envoy', weight: (45 - cold.attitude) / 20, parties: [flier.id], roles: { offender: flier.id }, severity: 2, neighbourId: cold.id, place: { x: r2(e.x), z: r2(e.z) },
      summary: `An envoy of ${cold.name} complains that ${flier.name} flew over their nets.`, topic: cold.name }); }
  }
  // 7. jealousy of the minister
  if (minister && canBeParty(state, minister)) {
    const env = civilians.filter(a => (T(a, 'ambitious') || T(a, 'proud')) && (a.mood < 70 || a.loyalty < 55)).sort((p, q) => jit(q, 'j') - jit(p, 'j'))[0];
    if (env) out.push({ kind: 'jealousy', weight: 0.8, parties: [env.id, minister.id], roles: { complainant: env.id }, severity: 1, place: { x: r2(minister.x), z: r2(minister.z) },
      summary: `${env.name} grumbles that the seal should have been theirs, not ${minister.name}'s.`, topic: 'the seal' });
  }
  return out.filter(c => c.weight > 0);
}

export function tickConflicts(game) {
  const { state, rng } = game;
  if (!state.conflicts) return;
  escalate(game);
  tickInstitutions(game);
  if (state.nextConflictAt == null) state.nextConflictAt = CONFLICT.firstAfter;
  if (state.t < state.nextConflictAt) return;
  if (state.fleetHold || state.meeting || state.scene === 'moon') { state.nextConflictAt = state.t + 10; return; }
  if (openConflicts(state).length >= CONFLICT.maxOpen) { state.nextConflictAt = state.t + CONFLICT.retryAfter; return; }
  const pool = candidates(game);
  if (!pool.length) { state.nextConflictAt = state.t + CONFLICT.retryAfter; return; }
  const last = state.conflicts.at(-1);
  for (const c of pool) if (last && c.kind === last.kind) c.weight *= 0.4;   // variety
  const total = pool.reduce((s, c) => s + c.weight, 0);
  let r = rng.range(0, total), pick = pool[pool.length - 1];
  for (const c of pool) { r -= c.weight; if (r <= 0) { pick = c; break; } }
  const unhappy = avgMood(state.agents) < CONFLICT.unhappyMood || state.hungry;
  state.nextConflictAt = state.t + rng.range(CONFLICT.every[0], CONFLICT.every[1]) * (unhappy ? CONFLICT.unhappyFactor : 1);
  startConflict(game, pick);
}

// tests and the director drive it: game.startConflict('theft') or a full draft
export function startConflict(game, draft) {
  const { state, rng } = game;
  if (typeof draft === 'string') { const pool = candidates(game); draft = pool.find(c => c.kind === draft) || null; if (!draft) return null; }
  const { weight, ...rest } = draft;
  const c = { id: 'c' + (state.nextConflictId = (state.nextConflictId || 0) + 1), ...rest, since: +state.t.toFixed(1), day: state.day, status: 'open', letterId: null, how: null, handledAt: null, ignored: false, escalations: 0 };
  state.conflicts.push(c);
  if (c.kind === 'theft') { const before = state.resources.food; state.resources.food = Math.max(0, before - CONFLICT.theftFood); if (state.resources.food !== before) game.emit('resources', { resources: { ...state.resources } }); }
  for (const id of c.parties) { const a = state.agents.find(x => x.id === id); if (a) nudgeMood(a, c.roles.offender === id ? -1 : -3, c.kind, game.emit); }
  const complainant = state.agents.find(x => x.id === (c.roles.complainant || c.parties[0]));
  if (complainant && c.kind !== 'envoy') game.emit('agent:say', { agentId: complainant.id, text: bubbleFor(game, c, complainant), kind: 'conflict', conflictId: c.id, ttl: 5 });
  const minister = state.agents.find(a => a.id === state.minister) || null;
  const letter = L.conflictLetter(rng, { minister, conflict: c, names: Object.fromEntries(c.parties.map(id => [id, name(game, id)])), day: state.day, settlement: state.name, institutions: state.institutions.filter(i => i.status === 'active').map(i => i.kind) });
  game.sendLetter(letter); c.letterId = letter.id;
  game.emit('conflict:start', { conflict: plain(c) });
  game.log(`Conflict: ${c.summary}`);
  return c;
}

function bubbleFor(game, c, a) {
  const other = c.parties.find(id => id !== a.id);
  switch (c.kind) {
    case 'theft': return `${name(game, other)} was at the crates. I saw it.`;
    case 'quarrel': return `${name(game, other)} started it.`;
    case 'noise': return 'I have not slept a wink. The noise!';
    case 'land': return 'That plot is mine. I said so first.';
    case 'neglect': return 'I will get to it. Later.';
    case 'jealousy': return 'The seal should have been mine.';
    default: return 'This is not right.';
  }
}

// ---------- escalation ----------
function escalate(game) {
  const { state } = game;
  for (const c of state.conflicts) {
    if (c.status === 'handled') { if (state.t - c.handledAt >= CONFLICT.settleSeconds) finishConflict(game, c); continue; }
    if (c.status !== 'open' && c.status !== 'escalated') continue;
    const sinceLast = state.t - (c.lastEscalatedAt ?? c.since);
    const limit = c.ignored ? CONFLICT.ignoredEscalateAfter : CONFLICT.escalateAfter;
    if (c.severity >= CONFLICT.maxSeverity) {
      // at full severity, after a long time, the aggrieved folk leaves (never in the first 15 minutes)
      if (sinceLast > CONFLICT.leaveAfter && state.t >= BAL.noLeaveBefore && !c.leaving) {
        const victim = state.agents.find(x => x.id === (c.roles.complainant || c.parties[0]));
        if (victim && alive(victim) && !victim.flags.leaving) { c.leaving = true; victim.flags.leaving = true; leave(game, victim); game.emit('conflict:escalate', { conflictId: c.id, kind: c.kind, severity: c.severity, parties: c.parties.slice(), place: { ...c.place }, summary: c.summary, consequence: 'left', agentId: victim.id }); c.status = 'resolved'; c.how = 'left'; c.resolvedAt = state.t; game.emit('conflict:resolve', { conflictId: c.id, kind: c.kind, how: 'left', by: 'nobody', parties: c.parties.slice() }); }
      }
      continue;
    }
    if (sinceLast < limit) continue;
    c.severity++; c.escalations++; c.lastEscalatedAt = state.t; c.status = 'escalated';
    let consequence = 'mood';
    // sours, never breaks by itself: like hunger, an unanswered conflict floors at BAL.hungerFloor (the demo cannot be killed by silence)
    const floored = (a, d) => nudgeMood(a, Math.min(0, Math.max(d, BAL.hungerFloor - a.mood)), `${c.kind} unanswered`, game.emit);
    for (const id of c.parties) {
      const a = state.agents.find(x => x.id === id); if (!a || !alive(a)) continue;
      floored(a, c.roles.offender === id ? -3 : -6);
      a.loyalty = Math.max(0, a.loyalty - (c.roles.offender === id ? 2 : 4));
    }
    if (c.kind === 'theft') { const before = state.resources.food; state.resources.food = Math.max(0, before - CONFLICT.theftFood); if (before !== state.resources.food) game.emit('resources', { resources: { ...state.resources } }); }
    if (c.severity >= CONFLICT.maxSeverity) {
      // full severity: the aggrieved folk is hit hard, and strikes if that leaves them below the strike's end mood (so the strike lasts)
      // The strike comes when the sovereign said "ignore" (or after the demo's 15-minute grace for the merely unanswered).
      const victim = state.agents.find(x => x.id === (c.roles.complainant || c.parties[0]));
      if (victim && alive(victim)) { floored(victim, -8); victim.loyalty = Math.max(0, victim.loyalty - 4); }
      if (victim && alive(victim) && (c.ignored || state.t >= BAL.noLeaveBefore) && victim.status !== 'striking' && !victim.flags.struck && victim.mood < BAL.strikeEnd) { victim.flags.struck = true; victim.flags.strikeDay = state.day; strike(game, victim); consequence = 'strike'; }
    }
    game.emit('conflict:escalate', { conflictId: c.id, kind: c.kind, severity: c.severity, parties: c.parties.slice(), place: { ...c.place }, summary: c.summary, consequence });
    game.log(`Conflict escalates: ${c.summary} (severity ${c.severity}${consequence === 'strike' ? ', a strike' : ''})`);
  }
}

// ---------- resolution ----------
// free text -> one of HOWS
export function normaliseHow(how) {
  const h = String(how || '').toLowerCase().trim();
  if (HOWS.includes(h)) return h;
  if (/punish|fine\b|jail|lock (him|her|them) up|scold|banish|arrest|prison|flog|penal/.test(h)) return 'punish';
  if (/compensat|repay|pay (them|him|her)|make it up|give (them|him|her)|feed|bread|gift|apolog/.test(h)) return 'compensate';
  if (/ignore|nothing|leave it|let it be|never mind|later|not now/.test(h)) return 'ignore';
  return 'talk';
}

export function findConflict(game, ref) {
  const { state } = game;
  const open = state.conflicts.filter(c => c.status !== 'resolved');
  if (ref) { const byId = open.find(c => c.id === ref) || state.conflicts.find(c => c.id === ref); if (byId) return byId; const r = String(ref).toLowerCase(); const byKind = open.filter(c => c.kind === r || c.summary.toLowerCase().includes(r)); if (byKind.length) return byKind.at(-1); }
  // the newest unanswered one, preferring one whose letter still waits
  return open.filter(c => !c.how).at(-1) || open.at(-1) || null;
}

// the sovereign's (or an institution's) answer. by: 'sovereign' | 'institution' | 'minister'
export function resolveConflict(game, c, howIn, { by = 'sovereign', agentId = null, institutionId = null } = {}) {
  const { state } = game;
  if (!c) return { ok: false, reason: 'No open conflict to settle.', effects: [] };
  if (c.status === 'resolved') return { ok: true, effects: [{ type: 'conflict', conflictId: c.id, status: 'resolved', already: true }] };
  const how = by === 'institution' ? (HOWS.includes(howIn) ? howIn : 'talk') : normaliseHow(howIn);
  const letter = c.letterId ? state.letters.find(l => l.id === c.letterId) : null;
  if (letter && !letter.resolved) { letter.resolved = true; letter.read = true; letter.reply = { decision: how === 'ignore' ? 'no' : 'other', text: String(howIn || how) }; game.emit('letter:resolved', { letterId: letter.id, decision: letter.reply.decision }); }
  const agents = c.parties.map(id => state.agents.find(x => x.id === id)).filter(alive);
  const offender = c.roles.offender ? state.agents.find(x => x.id === c.roles.offender) : null;
  const victim = c.roles.complainant ? state.agents.find(x => x.id === c.roles.complainant) : null;
  const n = c.neighbourId ? state.neighbours.find(x => x.id === c.neighbourId) : null;
  if (how === 'ignore') {
    c.ignored = true; c.how = 'ignore'; c.howText = String(howIn || how);
    for (const a of agents) if (a !== offender) nudgeMood(a, -3, 'ignored', game.emit);
    game.emit('conflict:handle', { conflictId: c.id, kind: c.kind, how, by, agentId: null, parties: c.parties.slice(), place: { ...c.place } });
    game.log(`Conflict ignored: ${c.summary}`);
    return { ok: true, effects: [{ type: 'conflict', conflictId: c.id, how, status: c.status }] };
  }
  c.status = 'handled'; c.handledAt = state.t; c.how = how; c.howText = String(howIn || how); c.by = by;
  if (how === 'talk' || how === 'court') {
    for (const a of agents) { nudgeMood(a, by === 'institution' ? 3 : 4, 'heard out', game.emit); a.loyalty = Math.min(100, a.loyalty + 2); remember(a, `was heard out about ${c.topic || 'a quarrel'}`); }
    if (n) n.attitude = Math.min(100, n.attitude + 3);
  } else if (how === 'punish') {
    const culprits = offender ? [offender] : agents;
    for (const a of culprits) { if (!alive(a)) continue; nudgeMood(a, offender ? -8 : -4, 'punished', game.emit); a.loyalty = Math.max(0, a.loyalty - (offender ? 5 : 2)); remember(a, `was punished over ${c.topic || 'a quarrel'}`); }
    if (victim && alive(victim)) nudgeMood(victim, 4, 'justice', game.emit);
    if (offender) for (const a of state.agents) if (alive(a) && !c.parties.includes(a.id)) a.loyalty = Math.min(100, a.loyalty + 1);   // justice seen to be done
    if (n) n.attitude = Math.min(100, n.attitude + 5);
  } else if (how === 'compensate') {
    const res = n ? (state.resources.goods >= 3 ? 'goods' : 'coin') : (c.kind === 'theft' || c.kind === 'noise' ? 'food' : 'coin');
    const amount = 3;
    state.resources[res] = Math.max(0, state.resources[res] - amount);
    game.emit('resources', { resources: { ...state.resources } });
    const who = victim || agents[0];
    if (who && alive(who)) { nudgeMood(who, 6, 'compensated', game.emit); remember(who, `was given ${amount} ${res} to make up for ${c.topic || 'it'}`); }
    if (n) n.attitude = Math.min(100, n.attitude + 8);
  }
  if (c.roles.complainant) { const a = state.agents.find(x => x.id === c.roles.complainant); if (a && alive(a) && a.status === 'striking' && a.mood >= BAL.strikeMood) { a.flags.struck = false; clearTask(a); } }
  // someone goes to the place: the institution's member, else the minister
  let actor = agentId ? state.agents.find(x => x.id === agentId) : null;
  if (!actor && by === 'sovereign' && state.minister) { const m = state.agents.find(x => x.id === state.minister); if (m && alive(m) && !(m.task && ['deliver', 'journey', 'leave', 'stand', 'meeting', 'gather'].includes(m.task.kind)) && m.status !== 'resting' && m.status !== 'striking') actor = m; }
  if (actor && !(actor.task && actor.task.phase === 'settle')) { setTask(game, actor, { kind: 'walk', to: { ...c.place }, phase: 'settle', duty: 'settle', conflictId: c.id, ...(institutionId ? { institutionId } : {}) }); }
  game.emit('conflict:handle', { conflictId: c.id, kind: c.kind, how, by, agentId: actor ? actor.id : null, institutionId, parties: c.parties.slice(), place: { ...c.place } });
  game.log(`Conflict handled (${how}, by ${by}): ${c.summary}`);
  return { ok: true, effects: [{ type: 'conflict', conflictId: c.id, how, status: c.status, agentId: actor ? actor.id : null }] };
}

function finishConflict(game, c) {
  c.status = 'resolved'; c.resolvedAt = game.state.t;
  game.emit('conflict:resolve', { conflictId: c.id, kind: c.kind, how: c.how, by: c.by || 'sovereign', parties: c.parties.slice() });
  game.log(`Conflict resolved: ${c.summary}`);
}

// ---------- institutions ----------
function jobValueOf(game, a) {
  const b = game.state.buildings.find(x => x.id === a.jobId);
  const e = b && b.status === 'done' && game.catalog.get(b.kind);
  if (!e) return 0;
  return Object.entries(e.perDay).reduce((s, [k, v]) => s + (v > 0 ? v * (k === 'food' ? 2 : 1) : 0), 0) / Math.max(1, b.workers.length);
}

// pick fitting, willing folk for an institution (never the minister, never someone already in one)
export function pickMembers(game, spec, n, { leader = null, trade = null, exclude = [] } = {}) {
  const { state, rng } = game;
  const pool = state.agents.filter(a => alive(a) && a.id !== state.minister && !a.role && !exclude.includes(a.id) && a.status !== 'striking' && !(a.task && ['deliver', 'journey', 'leave'].includes(a.task.kind)) && (!trade || a.trade === trade));
  const scored = pool.map(a => { const w = willing(a, { kind: 'assign', skill: null, day: state.day }, rng, { hungry: state.hungry, homeless: !a.homeId }); return { a, s: spec.fit(a) - jobValueOf(game, a) * 0.5 + (w.yes ? 1 : -1.5) + (a.id === leader ? 100 : 0), willing: w.yes }; })
    .sort((p, q) => q.s - p.s);
  return scored.slice(0, n).map(x => ({ agent: x.a, pressed: !x.willing }));
}

// found_institution { kind, members?, leader?, name?, request? }: a real group of folk with a role, a uniform tag,
// a schedule and effects. `request` (or a place-like kind: watchtower, courthouse, schoolhouse) also raises a building.
// `members` as an ARRAY of agent ids / names (ART_DIRECTION §20: the sovereign clicked them) is taken as given: no
// auto-pick, the first one leads unless `leader` names another of them; folk who left or already hold a role are
// skipped (the result says who, in `skipped`). A number (or nothing) picks fitting, willing folk as before.
export function foundInstitution(game, { kind: kindText, members, leader, name: nameIn, request } = {}) {
  const { state, rng } = game;
  const text = String(kindText || nameIn || '').trim();
  const kind = institutionKind(text);
  const spec = INSTITUTION_SPECS[kind];
  const effects = [];
  // a guild is of a trade when one is named ("the builders' guild")
  let trade = null;
  if (kind === 'guild') { for (const [tr] of Object.entries(TRADE_WORDS)) if (new RegExp(`\\b${tr}s?'?s?\\b`).test(text.toLowerCase())) trade = tr; }
  const title = kind === 'generic' ? (titleCase(text.replace(/^(a|an|the|our|new)\s+/i, '').replace(/\b(team|group)\b/g, '').trim()) || 'Society')
    : kind === 'guild' && trade ? `${titleCase(trade)}s' Guild` : spec.name;
  const instName = (typeof nameIn === 'string' && nameIn.trim()) || title;
  const leaderId = leader ? (state.agents.find(a => alive(a) && (a.id === leader || a.name.toLowerCase() === String(leader).toLowerCase()) || a.name.toLowerCase().startsWith(String(leader).toLowerCase())) || {}).id || null : null;
  let n = Math.max(1, Math.min(6, Number.isFinite(Number(members)) && Number(members) > 0 ? Math.round(Number(members)) : spec.members));
  if (kind === 'guild' && trade && !(Number(members) > 0)) n = Math.min(4, Math.max(2, state.agents.filter(a => alive(a) && a.trade === trade && !a.role && a.id !== state.minister).length));
  let picked, skipped = [];
  if (Array.isArray(members)) {
    const chosen = [];
    for (const ref of members) {
      const a = state.agents.find(x => x.id === ref) || state.agents.find(x => alive(x) && typeof ref === 'string' && x.name.toLowerCase() === ref.toLowerCase());
      if (!a || chosen.includes(a)) continue;
      if (!alive(a) || a.role) { skipped.push({ id: a.id, name: a.name, why: !alive(a) ? 'left' : `already in the ${(state.institutions.find(i => i.id === a.role.institutionId) || {}).name || 'institution'}` }); continue; }
      chosen.push(a);
    }
    if (!chosen.length) return { ok: false, reason: skipped.length ? `${skipped.map(s => s.name).join(', ')} cannot join: ${skipped[0].why}.` : `Nobody was chosen for the ${instName.toLowerCase()}.`, effects: [], skipped };
    picked = chosen.slice(0, 8).map(a => ({ agent: a, pressed: false, chosen: true }));
  } else {
    picked = pickMembers(game, spec, n, { leader: leaderId, trade });
    if (!picked.length && trade) picked = pickMembers(game, spec, n, { leader: leaderId });
    if (!picked.length) return { ok: false, reason: `Nobody is free to form a ${instName.toLowerCase()}.`, effects: [] };
  }
  const badge = kind === 'generic' ? BADGES[rng.int(0, BADGES.length - 1)] : spec.badge;
  const inst = { id: 'i' + (state.nextInstitutionId = (state.nextInstitutionId || 0) + 1), kind, name: instName, text, badge, title: spec.title, members: [], leader: null, founded: +state.t.toFixed(1), day: state.day, status: 'active', buildingId: null, trade, nextActAt: state.t + 3, nextSessionAt: spec.schedule ? state.t + Math.min(spec.schedule.every, 40) : null, session: null, acts: 0 };
  state.institutions.push(inst);
  for (const { agent: a, pressed } of picked) {
    releaseAgent(game, a);
    if (a.task && !['deliver', 'journey', 'leave', 'meeting', 'gather'].includes(a.task.kind)) clearTask(a);
    a.role = { institutionId: inst.id, kind, title: spec.title, badge, leader: false };
    inst.members.push(a.id);
    nudgeMood(a, pressed ? -2 : T(a, 'ambitious') ? 5 : 3, pressed ? 'pressed into the ' + instName.toLowerCase() : 'given a role', game.emit);
    remember(a, `joined the ${instName}`);
  }
  inst.leader = (leaderId && inst.members.includes(leaderId)) ? leaderId : inst.members[0];
  inst.chosen = Array.isArray(members);   // picked by the sovereign (§20), not by the sim
  const lead = state.agents.find(a => a.id === inst.leader); if (lead) lead.role.leader = true;
  game.emit('institution:found', { institution: plain(inst) });
  for (const id of inst.members) { const a = state.agents.find(x => x.id === id); game.emit('institution:assign', { institutionId: inst.id, kind, agentId: id, role: { ...a.role }, uniform: { institution: kind, badge, title: spec.title, leader: a.role.leader } }); }
  if (lead) game.emit('agent:say', { agentId: lead.id, text: spec.say, kind: 'institution', institutionId: inst.id, ttl: 5 });
  game.log(`${instName} founded: ${inst.members.map(id => name(game, id)).join(', ')} (${badge}).`);
  game.sendLetter(L.institutionLetter(rng, { institution: inst, names: inst.members.map(id => name(game, id)), day: state.day, settlement: state.name }));
  game.emit('toast', { text: `${instName} founded` });
  effects.push({ type: 'institution', id: inst.id, kind, name: instName, members: inst.members.slice(), leader: inst.leader, badge, title: spec.title, chosen: inst.chosen, ...(skipped.length ? { skipped } : {}) });
  // a place for it: the request names a building ("a watchtower"), or the kind is place-like
  const place = typeof request === 'string' && request.trim() ? request.trim() : /tower|house|hall|station|courthouse|schoolhouse|guildhall/.test(text.toLowerCase()) ? text : null;
  if (place) {
    const req = /^(a|an|the)\s/i.test(place) ? place : `a ${place}`;
    const r = game.apply({ type: 'build', kind: null, request: req, name: /tower/.test(place.toLowerCase()) ? null : instName, at: { mode: 'auto' } });
    if (r.ok && r.buildings && r.buildings.length) { inst.buildingId = r.buildings[0]; const b = state.buildings.find(x => x.id === inst.buildingId); if (b) b.institution = { id: inst.id, kind }; effects.push({ type: 'institution_site', id: inst.id, buildingId: inst.buildingId }); }
  }
  // the new patrol settles open conflicts in its remit at once; the court holds its first session soon
  return { ok: true, effects, institution: inst, skipped };
}

export function findInstitution(game, ref) {
  const { state } = game;
  if (!ref) return null;
  const r = String(ref).toLowerCase();
  return state.institutions.find(i => i.id === ref) || state.institutions.find(i => i.status === 'active' && (i.kind === r || i.name.toLowerCase() === r || i.name.toLowerCase().includes(r) || institutionKind(r) === i.kind && i.kind !== 'generic')) || null;
}

const venueOf = (game, inst) => {
  const { state } = game;
  const b = inst.buildingId ? state.buildings.find(x => x.id === inst.buildingId && x.status === 'done') : null;
  if (b) return { x: b.x, z: b.z + b.footprint.d / 2 + 2 };
  const assembly = state.buildings.find(x => x.kind === 'assembly' && x.status === 'done');
  if (assembly && inst.kind === 'court') return { x: assembly.x, z: assembly.z + assembly.footprint.d / 2 + 3 };
  if (inst.kind === 'watch') return { x: state.stockpile.x + 2, z: state.stockpile.z - 2 };
  return { x: state.centre.x, z: state.centre.z + 1 };
};
const isNight = state => state.dayAcc >= ECO.daySeconds * 0.66;

// the route a patrol walks: the crates, the square, the market / noisy places, the tray; the night watch adds the plot's edges
export function patrolRoute(game, inst) {
  const { state } = game;
  const pts = [{ x: state.stockpile.x + 2.2, z: state.stockpile.z + 0.5 }];
  const places = state.buildings.filter(b => b.status === 'done' && (NOISY.includes(b.kind) || b.kind === 'granary' || b.kind === 'market'));
  for (const b of places.slice(0, 3)) pts.push({ x: b.x + b.footprint.w / 2 + 1.2, z: b.z });
  pts.push({ x: state.centre.x + 1.5, z: state.centre.z - 1 });
  if (inst.kind === 'watch') { const p = state.plot; pts.push({ x: p.x1 - 3, z: state.centre.z }, { x: state.centre.x, z: p.z0 + 3 }, { x: p.x0 + 3, z: state.centre.z }); }
  pts.push({ x: state.tray.x - 2, z: state.tray.z - 1.5 });
  const dry = pt => game.freeGroundNear(pt, 1.5);
  return pts.map(p => { const d = dry({ x: r2(p.x), z: r2(p.z) }); return { x: r2(d.x), z: r2(d.z) }; });
}

// what an idle member does: patrol the route (watch: at night), attend a session, visit the venue
export function planDuty(game, a) {
  const { state, rng } = game;
  if (!a.role) return false;
  const inst = state.institutions.find(i => i.id === a.role.institutionId);
  if (!inst || inst.status !== 'active') { delete a.role; return false; }
  const spec = INSTITUTION_SPECS[inst.kind] || INSTITUTION_SPECS.generic;
  if (inst.session && inst.session.members.includes(a.id)) {
    if (!(a.task && a.task.duty === 'session')) { setTask(game, a, { kind: 'walk', to: { ...inst.session.where }, phase: 'session', duty: 'session', institutionId: inst.id, timer: Math.max(1, inst.session.endsAt - state.t) }); }
    return true;
  }
  if (spec.duty === 'patrol' && (!spec.night || isNight(state))) {
    const route = patrolRoute(game, inst);
    const i = (a.flags.patrolIdx || 0) % route.length;
    if (i === 0) game.emit('institution:patrol', { institutionId: inst.id, kind: inst.kind, agentId: a.id, route: route.map(p => ({ ...p })), night: !!spec.night });
    a.flags.patrolIdx = i + 1;
    setTask(game, a, { kind: 'walk', to: { ...route[i] }, phase: 'patrol', duty: 'patrol', institutionId: inst.id, timer: CONFLICT.patrolPause });
    return true;
  }
  // between sessions: now and then to the venue, stand a while (a judge paces the square, a watchman naps by the crates)
  if ((a.nextWander ?? 0) <= state.t) {
    const [lo, hi] = CONFLICT.attendEvery; a.nextWander = state.t + rng.range(lo, hi);
    const v = venueOf(game, inst);
    setTask(game, a, { kind: 'walk', to: game.freeGroundNear(v, 2.5), phase: 'attend', duty: 'attend', institutionId: inst.id, timer: 6 });
    return true;
  }
  return true;   // waiting for the next visit: never falls through to the camp
}

// a member arrived at a conflict's place: the institution settles it
export function onSettleArrive(game, a, conflictId, institutionId) {
  const c = game.state.conflicts.find(x => x.id === conflictId);
  if (!c || c.status === 'resolved' || !institutionId) return;
  if (c.status !== 'handled') resolveConflict(game, c, 'talk', { by: 'institution', agentId: a.id, institutionId });
  game.emit('institution:act', { kind: 'settle', institutionId, agentId: a.id, conflictId: c.id, place: { ...c.place } });
}

function tickInstitutions(game) {
  const { state, rng } = game;
  for (const inst of state.institutions) {
    if (inst.status !== 'active') continue;
    inst.members = inst.members.filter(id => { const a = state.agents.find(x => x.id === id); return a && alive(a) && a.role && a.role.institutionId === inst.id; });
    if (!inst.members.length) { inst.status = 'dormant'; game.emit('institution:disband', { institutionId: inst.id, kind: inst.kind, name: inst.name }); game.log(`${inst.name} has no members left.`); continue; }
    const spec = INSTITUTION_SPECS[inst.kind] || INSTITUTION_SPECS.generic;
    // settle open conflicts in the remit: a free member walks there (patrol / watch); the court waits for its session
    if (!spec.schedule && inst.nextActAt <= state.t) {
      const c = state.conflicts.find(x => (x.status === 'open' || x.status === 'escalated') && spec.remit.includes(x.kind) && !x.settlingBy);
      if (c) {
        const m = inst.members.map(id => state.agents.find(x => x.id === id)).find(a => a && a.status !== 'resting' && a.status !== 'striking' && !(a.task && ['deliver', 'journey', 'leave', 'meeting', 'gather'].includes(a.task.kind)));
        if (m) { c.settlingBy = m.id; inst.nextActAt = state.t + 20; inst.acts++; setTask(game, m, { kind: 'walk', to: { ...c.place }, phase: 'settle', duty: 'settle', conflictId: c.id, institutionId: inst.id }); }
      }
    }
    if (!spec.schedule) continue;
    // sessions, lessons, meetings, festivals
    if (inst.session) {
      if (state.t >= inst.session.endsAt) endSession(game, inst, spec);
      continue;
    }
    if (inst.nextSessionAt == null || state.t < inst.nextSessionAt || state.fleetHold || state.meeting || state.scene === 'moon') continue;
    const remit = state.conflicts.filter(x => (x.status === 'open' || x.status === 'escalated') && spec.remit.includes(x.kind));
    if (spec.schedule.onlyWithRemit && !remit.length) { inst.nextSessionAt = state.t + 30; continue; }
    const where = venueOf(game, inst);
    const members = inst.members.slice();
    const extra = [];
    if (spec.schedule.kind === 'session') for (const c of remit) for (const id of c.parties) if (!members.includes(id) && !extra.includes(id)) extra.push(id);
    if (spec.schedule.kind === 'lesson') { const pupils = state.agents.filter(a => alive(a) && !a.role && a.id !== state.minister && !a.jobId && a.status === 'idle').sort((p, q) => rng.jitter(q.id + state.day) - rng.jitter(p.id + state.day)).slice(0, spec.schedule.pupils || 3); for (const p of pupils) extra.push(p.id); }
    inst.session = { kind: spec.schedule.kind, where: { x: r2(where.x), z: r2(where.z) }, endsAt: state.t + spec.schedule.seconds, members: members.concat(extra), conflictIds: remit.map(c => c.id), startedAt: state.t };
    inst.nextSessionAt = state.t + spec.schedule.every;
    inst.acts++;
    let k = 0;
    for (const id of inst.session.members) {
      const a = state.agents.find(x => x.id === id); if (!a || !alive(a) || a.status === 'striking' && !remit.some(c => c.parties.includes(id))) continue;
      if (a.task && ['deliver', 'journey', 'leave', 'meeting', 'gather'].includes(a.task.kind)) continue;
      if (a.status === 'striking') { a.flags.struck = false; }
      const ang = (k++ / 8) * Math.PI * 2, r = 1.6 + (k % 2);
      a.resume = a.task && a.task.kind !== 'work' && !a.role ? a.task : null;
      setTask(game, a, { kind: 'walk', to: { x: r2(where.x + Math.cos(ang) * r), z: r2(where.z + Math.sin(ang) * r) }, phase: 'session', duty: 'session', institutionId: inst.id, timer: spec.schedule.seconds, ...(remit.some(c => c.parties.includes(id)) ? { conflictId: remit.find(c => c.parties.includes(id)).id } : {}) });
    }
    for (const c of remit) c.settlingBy = inst.leader;
    game.emit('institution:act', { kind: spec.schedule.kind, institutionId: inst.id, agentId: inst.leader, agentIds: inst.session.members.slice(), where: { ...inst.session.where }, seconds: spec.schedule.seconds, conflictIds: inst.session.conflictIds.slice() });
    game.log(`${inst.name}: ${spec.schedule.kind} at (${inst.session.where.x}, ${inst.session.where.z})${remit.length ? ' over ' + remit.map(c => c.kind).join(', ') : ''}.`);
  }
}

function endSession(game, inst, spec) {
  const { state } = game;
  const s = inst.session; inst.session = null;
  const members = s.members.map(id => state.agents.find(x => x.id === id)).filter(alive);
  if (s.kind === 'session') {
    for (const id of s.conflictIds) { const c = state.conflicts.find(x => x.id === id); if (c && c.status !== 'resolved' && c.status !== 'handled') { resolveConflict(game, c, 'talk', { by: 'institution', agentId: inst.leader, institutionId: inst.id }); c.how = 'court'; game.emit('institution:act', { kind: 'verdict', institutionId: inst.id, agentId: inst.leader, conflictId: c.id, place: { ...s.where } }); } }
    const fair = (spec.effects && spec.effects.fairness) || 0;
    if (fair && s.conflictIds.length) for (const a of state.agents) if (alive(a) && !s.members.includes(a.id)) nudgeMood(a, fair, 'a fair hearing', game.emit, true);
  } else if (s.kind === 'lesson') {
    for (const a of members) { if (inst.members.includes(a.id)) continue; const weakest = Object.entries(a.skills).sort((p, q) => p[1] - q[1])[0]; a.skills[weakest[0]] = Math.min(10, +(weakest[1] + 0.2).toFixed(2)); nudgeMood(a, 1, 'a lesson', game.emit, true); }
  } else if (s.kind === 'festival') {
    for (const a of state.agents) if (alive(a)) nudgeMood(a, 5, 'festival', game.emit);
    state.resources.food = Math.max(0, state.resources.food - 4);
    game.emit('resources', { resources: { ...state.resources } });
    game.emit('toast', { text: 'A festival in the square' });
  } else {
    for (const a of members) nudgeMood(a, 2, 'the ' + inst.name.toLowerCase(), game.emit, true);
  }
  for (const a of members) if (a.task && a.task.duty === 'session') clearTask(a);
  game.emit('institution:act', { kind: s.kind + '_end', institutionId: inst.id, agentId: inst.leader, agentIds: s.members.slice(), where: { ...s.where }, conflictIds: s.conflictIds.slice() });
}

// a folk left: drop them from their institution
export function onAgentGone(game, a) {
  if (!a.role) return;
  const inst = game.state.institutions.find(i => i.id === a.role.institutionId);
  if (inst) inst.members = inst.members.filter(id => id !== a.id);
  delete a.role;
}

// ---------- for the snapshot, the summary and talk ----------
export function conflictsBrief(state) {
  return state.conflicts.filter(c => c.status !== 'resolved').slice(-5).map(c => ({ id: c.id, kind: c.kind, parties: c.parties.slice(), severity: c.severity, status: c.status, summary: c.summary, since: Math.round(state.t - c.since), ...(c.how ? { how: c.how } : {}) }));
}
export function institutionsBrief(state) {
  return state.institutions.filter(i => i.status === 'active').map(i => ({ id: i.id, kind: i.kind, name: i.name, members: i.members.slice(), leader: i.leader, badge: i.badge, ...(i.buildingId ? { buildingId: i.buildingId } : {}) }));
}
export function conflictOf(state, agentId) {
  return state.conflicts.filter(c => c.status !== 'resolved' && c.parties.includes(agentId)).at(-1) || null;
}
