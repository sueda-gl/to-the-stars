// Tasks: what folk physically do. Construction (haul crates from the stockpile, hammer at the site),
// production at finished buildings, resting, strikes, leaving, meetings and letter delivery by couriers.
// The sim tracks positions abstractly (units/s) so events stay coherent; the agents bridge animates them.

import { willing, BAL, nudgeMood, pickCourier } from './society.js';
import { workerEff } from './economy.js';
import { dist, pointInsidePoly, pointAlong } from './geometry.js';
import { ministryNotice, strikeLetter, farewell, meetingMinutes } from './letters.js';
import { edgeToward, envoySpecies } from './neighbours.js';
import { defaultsFor } from './catalog.js';
import { JOB, campRoleFor } from './jobs.js';
import { remember } from './talk.js';

// the catalogue entry of a building, or the category defaults of a thing still awaiting its design
export const entryOf = (catalog, b) => catalog.get(b.kind) || defaultsFor(b.category);
// a site's crew (ART_DIRECTION §11, visible building): the nominal workers plus helpers, 3..6, so a build is a crowd
export const crewSize = need => Math.min(TASK.crewMax, Math.max(TASK.crewMin, (need || 1) + 2));

export const TASK = {
  speed: 3,            // walking units/s
  courierSpeed: 4.5,
  workBurst: 6,        // seconds of hammering between hauls
  crateUnits: 8,       // one crate per 8 resource units of cost
  maxCrates: 6,
  tripEvery: 25,       // production workers carry output to the stockpile this often
  meetingSeconds: 20,
  fallbackDeliver: 2.5,// seconds for a letter to land when no courier is free
  envoyFallback: 2.5,  // seconds for a neighbour letter to land by itself when no visual layer flies envoys
  envoyTimeout: 25,    // safety net: a carried neighbour letter lands by itself if the visual layer never lands it
  arrive: 0.5,
  wanderEvery: [6, 14],
  stalledAfter: 20,    // seconds a site has no workers before the Ministry writes
  restaffEvery: 10,    // seconds between quiet attempts to crew an under-staffed site with whoever is free
  stalledLetterEvery: 60,  // at most one "site stalled" Ministry letter per minute, however many sites stall
  crewMin: 3, crewMax: 6,  // a site's crew: nominal workers + 2 helpers, within these (visible building)
  refusalMemory: 30        // s a folk who refused a site is left alone (one refusal letter, not one per site in a burst)
};

const STATUS_OF = { walk: 'walking', haul: 'hauling', work: 'working', deliver: 'delivering', journey: 'delivering', gather: 'walking', meeting: 'meeting', idle: 'idle', strike: 'striking', leave: 'walking', rest: 'resting', stand: 'idle' };
// tasks a folk is not pulled off for a job, a nap or a meeting
const BUSY = ['deliver', 'journey', 'gather', 'meeting'];
// a camp 'gather' trip (phase 'camp') is ordinary work, not the meeting's gathering
const isBusy = t => !!t && BUSY.includes(t.kind) && !(t.kind === 'gather' && t.phase === 'camp');

export function setTask(game, a, task) {
  if (a.task && a.task.kind === 'deliver' && a.task !== task) rescueLetters(game, a);   // a courier pulled off the road: the post still arrives
  a.task = task;
  a.status = STATUS_OF[task.kind] || 'idle';
  const payload = { agentId: a.id, task: { kind: task.kind === 'rest' || task.kind === 'stand' ? 'idle' : task.kind, to: task.to ? { x: +task.to.x.toFixed(2), z: +task.to.z.toFixed(2) } : null, carrying: task.carrying || null } };
  if (task.kind === 'rest') payload.task.resting = true;
  if (task.kind === 'stand') { if (task.fleetId) payload.task.formation = true; if (task.inspect) payload.task.inspect = true; }
  for (const k of ['fleetId', 'camp', 'role', 'spot', 'duty', 'institutionId', 'conflictId']) if (task[k] !== undefined) payload.task[k] = task[k];   // duty: an institution's patrol / settle / session / attend (ART_DIRECTION §15)
  if (task.phase === 'formation') payload.task.formation = true;
  if (task.buildingId) payload.task.buildingId = task.buildingId;
  if (task.letterIds) payload.task.letterIds = task.letterIds.slice();
  if (task.gift) { payload.task.gift = task.gift; payload.task.neighbourId = task.neighbourId; }
  if (task.kind === 'journey') { payload.task.away = true; payload.task.seconds = +(task.until - game.state.t).toFixed(1); }
  game.emit('agent:task', payload);
}

export function clearTask(a) { a.task = null; a.status = 'idle'; }

// letters still in a courier's bag land by the fallback route (strike, leaving, sent to rest mid-delivery)
export function rescueLetters(game, a) {
  const ids = (a.task && a.task.letterIds) || [];
  for (const id of ids) {
    const l = game.state.letters.find(x => x.id === id);
    if (l && !l.delivered && !game.state.pendingLetters.some(p => p.id === id)) game.state.pendingLetters.push({ id, at: game.state.t + TASK.fallbackDeliver });
  }
}

// a standing spot at the edge of a building, on the side facing `from` (a floating thing is worked from the shore).
// A marked area is worked at spread-out points INSIDE its outline, a marked line at points ALONG it (each call moves on,
// so every haul and every production trip lands somewhere else in the field / along the wall).
export function siteSpot(b, from) {
  if (b.floating && b.workSpot) return { ...b.workSpot };
  if (b.shape && b.shape.poly) { b.shape.cursor = (b.shape.cursor || 0) + 1; return pointInsidePoly(b.shape.poly, b.shape.cursor); }
  if (b.shape && b.shape.pts) {
    b.shape.cursor = (b.shape.cursor || 0) + 1;
    const p = pointAlong(b.shape.pts, (b.shape.cursor * 0.6180339887) % 1);
    const off = (b.shape.width || Math.min(b.footprint.w, b.footprint.d) || 1) / 2 + 0.6;   // stand beside the stroke, on the side facing `from`
    const nx = -Math.sin(p.angle), nz = Math.cos(p.angle);
    const side = from && (from.x - p.x) * nx + (from.z - p.z) * nz < 0 ? -1 : 1;
    return { x: +(p.x + nx * off * side).toFixed(2), z: +(p.z + nz * off * side).toFixed(2) };
  }
  const dx = from.x - b.x, dz = from.z - b.z, l = Math.hypot(dx, dz) || 1;
  const r = Math.max(b.footprint.w, b.footprint.d) / 2 + 0.8;
  return { x: b.x + dx / l * r, z: b.z + dz / l * r };
}

const productOf = kind => (kind === 'bakery' || kind === 'tavern') ? 'bread' : 'crate';

// ---- worker assignment ----
// pick workers for a site by skill fit + willingness. requested: optional explicit agent ids (the player's "assign").
// quiet: a background retry (no agent:refuse events, so the net layer writes no letters about it)
export function assignWorkers(game, b, requested = null, { quiet = false } = {}) {
  const { state, rng, catalog } = game;
  const e = entryOf(catalog, b);
  const need = Math.max(1, e.workers || 1);
  // a crew is a crowd (3..6): the nominal workers plus helpers. Builders by trade first, then the best fit, the nearest first.
  const want = requested ? requested.length : crewSize(need);
  const free = a => a.status !== 'left' && a.status !== 'striking' && a.status !== 'resting' && (!a.jobId || a.jobId === b.id) && a.id !== state.minister && !a.role && !isBusy(a.task);   // an institution's member keeps to their post
  const fit = a => a.skills[e.skill || 'building'] + (a.trade === 'builder' ? 2.5 : 0) + (a.jobId === b.id ? 10 : 0) - dist(a.x, a.z, b.x, b.z) / 12;
  let pool = requested ? state.agents.filter(a => requested.includes(a.id)) : state.agents.filter(free);
  if (!requested) pool = pool.sort((p, q) => fit(q) - fit(p));
  const assigned = [], refused = [];
  const ctx = { hungry: state.hungry, homeless: false };
  const tryPool = list => {
    for (const a of list) {
      if (assigned.length >= want) break;
      if (b.workers.includes(a.id)) { assigned.push(a.id); continue; }
      if (!requested && (a.flags.refusedAt ?? -Infinity) > state.t - TASK.refusalMemory) continue;   // said no a moment ago: not asked again, not written about again
      const w = willing(a, { kind: 'build', skill: e.skill, buildingId: b.id, buildingKind: b.kind, day: state.day }, rng, { ...ctx, homeless: !a.homeId });
      if (w.yes) { takeJob(game, a, b); assigned.push(a.id); }
      else { a.flags.refusedAt = state.t; refused.push({ agent: a, why: w.why, helper: assigned.length >= need }); }   // a helper's no is nobody's business
    }
  };
  tryPool(pool);
  // nobody free: a spoken creation pre-empts production. Draft from finished buildings (the thinnest-value job first,
  // best builder first) until the site has at least one pair of hands; the farm gets restaffed when the crew is released.
  if (!requested && !assigned.length) {
    const doneIds = new Set(state.buildings.filter(x => x.status === 'done').map(x => x.id));
    const drafted = state.agents.filter(a => a.status !== 'left' && a.status !== 'striking' && a.status !== 'resting' && a.id !== state.minister && !a.role && a.jobId && doneIds.has(a.jobId) && !refused.some(r => r.agent === a))
      .sort((p, q) => jobValue(game, p) - jobValue(game, q) || q.skills[e.skill || 'building'] - p.skills[e.skill || 'building']);
    tryPool(drafted);
  }
  // fall back to the minister if nobody else will and the site would otherwise stall
  if (!requested && !assigned.length && state.minister) {
    const m = state.agents.find(a => a.id === state.minister && !a.jobId);
    if (m && willing(m, { kind: 'build', skill: e.skill, buildingId: b.id, day: state.day }, rng, ctx).yes) { takeJob(game, m, b); assigned.push(m.id); }
  }
  if (!quiet) for (const r of refused) if (!r.helper) game.emit('agent:refuse', { agentId: r.agent.id, task: { kind: 'build', buildingId: b.id, buildingKind: b.kind, label: (catalog.get(b.kind) || {}).name || b.name }, why: r.why });
  return { assigned, refused: refused.filter(r => !r.helper) };
}

// the least unwilling free folk takes the site anyway (mood -3); null when nobody at all can (all striking, resting or gone)
export function conscript(game, b) {
  const { state, rng, catalog } = game;
  const e = entryOf(catalog, b);
  const pool = state.agents.filter(a => a.status !== 'left' && a.status !== 'striking' && a.status !== 'resting' && a.id !== state.minister && !a.role && !(a.task && (isBusy(a.task) || a.task.kind === 'leave')));
  if (!pool.length) return null;
  const scored = pool.map(a => ({ a, s: willing(a, { kind: 'build', skill: e.skill, buildingId: b.id, buildingKind: b.kind, day: state.day }, rng, { hungry: state.hungry, homeless: !a.homeId }).score + (a.jobId ? -0.2 : 0) }))
    .sort((p, q) => q.s - p.s);
  const a = scored[0].a;
  takeJob(game, a, b);
  nudgeMood(a, -3, 'pressed into service', game.emit);
  game.log(`${a.name} pressed into service at the ${b.name}.`);
  return a;
}

// how much a folk's current production job is worth per day (food counts double: nobody drafts the last farmer first)
function jobValue(game, a) {
  const b = game.state.buildings.find(x => x.id === a.jobId);
  const e = b && game.catalog.get(b.kind);
  if (!e) return 0;
  return Object.entries(e.perDay).reduce((s, [k, v]) => s + (v > 0 ? v * (k === 'food' ? 2 : 1) : 0), 0) / Math.max(1, b.workers.length);
}

export function takeJob(game, a, b) {
  if (a.jobId && a.jobId !== b.id) releaseAgent(game, a);
  a.jobId = b.id;
  if (!b.workers.includes(a.id)) b.workers.push(a.id);
  if (a.task && !isBusy(a.task)) clearTask(a);
}

export function releaseAgent(game, a) {
  if (a.jobId) { const b = game.state.buildings.find(x => x.id === a.jobId); if (b) b.workers = b.workers.filter(id => id !== a.id); }
  a.jobId = null;
  if (a.task && !isBusy(a.task) && a.task.kind !== 'strike' && a.task.kind !== 'leave') clearTask(a);
}

// an uncrewed site takes a helper off the fullest crew (anyone beyond that site's nominal workers), so a second spoken
// thing gets hands at once instead of waiting for the first to finish
export function poachHelpers(game, b, count = 1) {
  const { state, catalog } = game;
  const got = [];
  for (let i = 0; i < count; i++) {
    const donors = state.buildings.filter(x => x !== b && x.status !== 'done' && x.status !== 'removed' && x.workers.length > Math.max(1, entryOf(catalog, x).workers || 1)).sort((p, q) => q.workers.length - p.workers.length);
    if (!donors.length) break;
    const d = donors[0];
    const e = entryOf(catalog, d);
    const a = d.workers.map(id => state.agents.find(x => x.id === id)).filter(x => x && x.status !== 'left' && !isBusy(x.task)).sort((p, q) => p.skills[e.skill || 'building'] - q.skills[e.skill || 'building'])[0];
    if (!a) break;
    takeJob(game, a, b); got.push(a.id);
  }
  return got;
}

// staff a finished production building with willing idle folk, best skill first
export function staffBuilding(game, b) {
  const { state, rng, catalog } = game;
  const e = catalog.get(b.kind);
  if (!e || !e.workers || !Object.keys(e.perDay).length) return [];
  const pool = state.agents.filter(a => a.status !== 'left' && a.status !== 'striking' && a.status !== 'resting' && !a.jobId && !a.role && a.id !== state.minister).sort((p, q) => q.skills[e.skill] - p.skills[e.skill]);
  const got = [];
  for (const a of pool) {
    if (b.workers.length >= e.workers) break;
    if (willing(a, { kind: 'work', skill: e.skill, buildingId: b.id, day: state.day }, rng, { hungry: state.hungry, homeless: !a.homeId }).yes) { takeJob(game, a, b); got.push(a.id); }
  }
  return got;
}

// ---- letters ----
// queueLetter(game, letter, { delay }): a folk's letter goes by courier (the scout by trade, else the idle folk who scouts
// best, else the 2.5 s fallback; every flit and floatie flies);
// a neighbour's letter is an envoy of the nation's species (envoy:send with `species`; the visual layer lands it with
// game.deliverLetter, or it lands by itself);
// `delay` (seconds) lands a letter by itself after that long (the shadelings' letters, farewells)
export function queueLetter(game, letter, { delay = null } = {}) {
  const { state } = game;
  letter.id = 'l' + (state.nextLetterId++);   // ids are per game, in sending order
  state.letters.push(letter);
  if (delay != null) { state.pendingLetters.push({ id: letter.id, at: state.t + Math.max(0, Number(delay) || 0) }); return null; }
  const nation = letter.from && letter.from.kind === 'neighbour' ? state.neighbours.find(n => n.id === letter.from.id) : null;
  if (nation || (letter.from && letter.from.kind === 'neighbour' && letter.from.id === 'all')) {
    const n = nation || state.neighbours[0];
    const exit = edgeToward(state, n);
    const listened = game.envoyDelivery !== 'immediate' && (game.envoyDelivery === 'event' || game.events.count('envoy:send') > 0);
    let at = state.t + (listened ? TASK.envoyTimeout : TASK.envoyFallback);
    if (letter.meta && letter.meta.urgent) at = Math.min(at, state.t + 3);
    letter.envoy = true;
    state.pendingLetters.push({ id: letter.id, at });
    const votes = letter.meta && letter.meta.votes ? letter.meta.votes.slice() : null;
    const speciesOf = votes ? Object.fromEntries(votes.map(id => { const v = state.neighbours.find(x => x.id === id); return [id, v ? envoySpecies(v, game.rng) : n.leaderSpecies]; })) : null;
    game.emit('envoy:send', { neighbourId: n.id, letterId: letter.id, kind: letter.kind, species: speciesOf ? speciesOf[n.id] : envoySpecies(n, game.rng), from: { x: n.x, z: n.z }, enter: { x: exit.x, z: exit.z }, dir: exit.dir, ...(votes ? { votes, all: true, speciesOf } : {}) });
    return null;
  }
  if (letter.from && letter.from.id === 'moon') { state.pendingLetters.push({ id: letter.id, at: state.t + TASK.fallbackDeliver }); return null; }
  const busyCourier = state.agents.find(a => a.task && a.task.kind === 'deliver' && a.task.phase !== 'gift' && a.status !== 'left');
  if (busyCourier) { busyCourier.task.letterIds.push(letter.id); return busyCourier; }
  const can = a => a.status !== 'left' && a.status !== 'striking' && a.status !== 'resting' && a.status !== 'meeting' && !(a.task && (a.task.kind === 'deliver' || a.task.kind === 'journey' || a.task.kind === 'leave' || a.task.duty === 'session'));
  const courier = pickCourier(state.agents, can, state.tray);
  if (courier) {
    courier.resume = courier.task && courier.task.kind !== 'deliver' ? courier.task : null;
    setTask(game, courier, { kind: 'deliver', to: { ...state.tray }, carrying: 'letter', letterIds: [letter.id] });
    game.emit('letter:sent', { letterId: letter.id, courierId: courier.id });
    return courier;
  }
  state.pendingLetters.push({ id: letter.id, at: state.t + TASK.fallbackDeliver });
  return null;
}

export function landLetter(game, id, courierId = null) {
  const { state } = game;
  const letter = state.letters.find(l => l.id === id);
  if (!letter || letter.delivered) return;
  letter.delivered = true;
  const i = state.pendingLetters.findIndex(p => p.id === id);
  if (i >= 0) state.pendingLetters.splice(i, 1);
  game.emit('letter:new', { letter, courierId });
  if (game.onLetterLanded) game.onLetterLanded(letter);
}

// ---- meetings ----
export function startMeeting(game) {
  const { state, catalog } = game;
  const assembly = state.buildings.find(b => b.kind === 'assembly' && b.status === 'done');
  const where = assembly ? { x: assembly.x, z: assembly.z + assembly.footprint.d / 2 + 3 } : { ...state.centre };
  state.meeting = { where, endsAt: state.t + TASK.meetingSeconds, attendees: [] };
  let i = 0;
  for (const a of state.agents) {
    if (a.status === 'left' || a.status === 'striking' || (a.task && (a.task.kind === 'deliver' || a.task.kind === 'journey' || a.task.kind === 'leave'))) continue;
    const ang = (i++ / 12) * Math.PI * 2, r = 2 + (i % 3);
    a.resume = a.task && a.task.kind !== 'gather' && a.task.kind !== 'meeting' ? a.task : null;
    setTask(game, a, { kind: 'gather', to: { x: where.x + Math.cos(ang) * r, z: where.z + Math.sin(ang) * r } });
    state.meeting.attendees.push(a.id);
  }
  game.emit('meeting:start', { where, assembly: !!assembly });
  return state.meeting;
}

export function endMeeting(game) {
  const { state, rng } = game;
  if (!state.meeting) return;
  const m = state.meeting; state.meeting = null;
  const minister = state.agents.find(a => a.id === state.minister) || null;
  for (const id of m.attendees) { const a = state.agents.find(x => x.id === id); if (a && a.status !== 'left') { nudgeMood(a, 3, 'meeting', game.emit); if (a.task && (a.task.kind === 'gather' || a.task.kind === 'meeting')) clearTask(a); } }
  game.emit('meeting:end', {});
  game.sendLetter(meetingMinutes(rng, { minister, day: state.day, settlement: state.name, attendance: m.attendees.length }));
}

// ---- strikes & leaving (called by society via ctx) ----
export function strike(game, a) {
  releaseAgent(game, a);
  setTask(game, a, { kind: 'strike', to: { x: game.state.centre.x + game.rng.range(-2, 2), z: game.state.centre.z + game.rng.range(-2, 2) } });
  game.log(`${a.name} is on strike.`);
  game.sendLetter(strikeLetter(game.rng, { agent: a, day: game.state.day, settlement: game.state.name }));
  game.emit('toast', { text: `${a.name} is on strike` });
}
export function strikeEnd(game, a) { clearTask(a); game.log(`${a.name} picks up the tools again.`); }
export function leave(game, a) {
  const n = game.state.neighbours.slice().sort((p, q) => q.attitude - p.attitude)[0];
  releaseAgent(game, a);
  if (game.onAgentGone) game.onAgentGone(a);
  a.homeId = null;
  setTask(game, a, { kind: 'leave', to: { x: n.x, z: n.z } });
  a.task.leftAt = game.state.t + 25;
  game.sendLetter(farewell(game.rng, { agent: a, neighbour: n, day: game.state.day, settlement: game.state.name }));
  game.emit('agent:leave', { agentId: a.id, to: n.id });
  game.log(`${a.name} has left for ${n.name}.`);
}

// ---- the per-tick step ----
export function stepTasks(game, dt) {
  const { state, rng, catalog } = game;
  // pending (courier-less) letters
  for (let i = state.pendingLetters.length - 1; i >= 0; i--) if (state.t >= state.pendingLetters[i].at) { landLetter(game, state.pendingLetters[i].id); state.pendingLetters.splice(i, 1); }
  if (state.meeting && state.t >= state.meeting.endsAt) endMeeting(game);

  for (const a of state.agents) {
    if (a.status === 'left') continue;
    // need to rest?
    if (a.energy < BAL.restBelow && a.status !== 'resting' && a.status !== 'striking' && !(a.task && (a.task.kind === 'rest' || a.task.kind === 'leave' || isBusy(a.task)))) {
      a.resume = null;
      if (a.jobId) game.onExhausted(a);
      const home = a.homeId ? state.buildings.find(b => b.id === a.homeId) : null;
      const to = home ? siteSpot(home, state.centre) : { x: state.spawn.x + rng.range(-3, 3), z: state.spawn.z + rng.range(-2, 2) };
      setTask(game, a, { kind: 'rest', to });
      a.task.walking = true; a.status = 'walking';
      continue;
    }
    if (!a.task) { plan(game, a); continue; }
    const t = a.task;
    if (t.to && !t.arrived) {
      const sp = t.kind === 'deliver' ? TASK.courierSpeed : TASK.speed;
      const d = dist(a.x, a.z, t.to.x, t.to.z);
      if (d <= TASK.arrive || d <= sp * dt) { a.x = t.to.x; a.z = t.to.z; t.arrived = true; onArrive(game, a); }
      else { a.x += (t.to.x - a.x) / d * sp * dt; a.z += (t.to.z - a.z) / d * sp * dt; }
    } else if (t.arrived) {
      advance(game, a, dt);
    }
  }
  // completion, and crews for sites nobody is working on (retried quietly while folk are free)
  const anyFree = state.agents.some(a => a.status !== 'left' && a.status !== 'striking' && a.status !== 'resting' && !a.jobId && !a.role && a.id !== state.minister);
  const anyProduction = state.agents.some(a => a.status !== 'left' && a.jobId && a.id !== state.minister && state.buildings.some(x => x.id === a.jobId && x.status === 'done'));
  for (const b of state.buildings) {
    if (b.status === 'removed') continue;
    if (b.status === 'done') {
      // a finished workplace that lost hands (drafted to a site, a strike, a nap) takes idle folk back, quietly
      const e = catalog.get(b.kind);
      if (anyFree && e && e.workers && Object.keys(e.perDay).length && b.workers.length < e.workers && (b.nextStaffAt ?? 0) <= state.t) { b.nextStaffAt = state.t + TASK.restaffEvery; staffBuilding(game, b); }
      continue;
    }
    if (b.progress >= 1 && b.status !== 'awaiting_design') { game.completeBuilding(b); continue; }
    const need = Math.max(1, entryOf(catalog, b).workers || 1);
    const crew = crewSize(need);
    if (!b.workers.length) {
      b.idleSince = b.idleSince ?? state.t;
      // an uncrewed site never waits: free folk at once, else hands off the fullest crew
      if ((b.nextPoachAt ?? 0) <= state.t) { b.nextPoachAt = state.t + 2; if (anyFree) assignWorkers(game, b, null, { quiet: true }); if (!b.workers.length) poachHelpers(game, b, 2); }
      if (state.t - b.idleSince > TASK.stalledAfter && !b.stalledNotice) {
        b.stalledNotice = true; b.nextStaffAt = state.t + TASK.restaffEvery;
        const r = assignWorkers(game, b);
        // nobody volunteers: a spoken thing must still rise, so the Ministry presses the least unwilling folk into service
        const pressed = r.assigned.length ? null : conscript(game, b);
        if (!r.assigned.length && (state.nextStalledLetterAt ?? 0) <= state.t) {
          state.nextStalledLetterAt = state.t + TASK.stalledLetterEvery;
          game.sendLetter(ministryNotice(rng, { kind: pressed ? 'conscripted' : 'stalled', day: state.day, settlement: state.name, name: b.name, building: b, reason: pressed ? pressed.name : r.refused[0] ? `${r.refused[0].agent.name} ${r.refused[0].why}.` : 'Everyone is busy or gone.' }));
        }
      }
    } else b.idleSince = null;
    if (b.workers.length < crew && (b.nextStaffAt ?? 0) <= state.t) {
      b.nextStaffAt = state.t + TASK.restaffEvery;
      // free folk fill any under-crewed site; an uncrewed site may also draft from production (inside assignWorkers)
      if (anyFree || (!b.workers.length && anyProduction)) assignWorkers(game, b, null, { quiet: true });
    }
  }
}

function plan(game, a) {
  const { state, rng, catalog } = game;
  // back from a meeting or a courier run: walks and hauls carry on, a 'work' task is re-planned from the job (it has no `to`)
  if (a.resume) { const r = a.resume; a.resume = null; if (r.to && r.kind !== 'work' && !(r.kind === 'walk' && r.phase === 'formation')) { setTask(game, a, { ...r, arrived: false }); return; } }
  if (a.status === 'resting' && a.energy < BAL.restUntil) return;
  const b = a.jobId ? state.buildings.find(x => x.id === a.jobId) : null;
  if (b && b.status !== 'done' && b.status !== 'removed') {
    const inFlight = state.agents.filter(o => o.task && o.task.kind === 'haul' && o.task.buildingId === b.id).length;
    if (b.cratesDelivered + inFlight < b.cratesNeeded) setTask(game, a, { kind: 'walk', to: { x: state.stockpile.x + rng.range(-1, 1), z: state.stockpile.z + rng.range(-1, 1) }, phase: 'to_stock', buildingId: b.id });
    else setTask(game, a, { kind: 'walk', to: siteSpot(b, state.stockpile), phase: 'to_site', buildingId: b.id });
    return;
  }
  if (b && b.status === 'done') { setTask(game, a, { kind: 'walk', to: siteSpot(b, state.centre), phase: 'to_work', buildingId: b.id }); return; }
  if (a.status !== 'idle' || a.task) return;
  if ((a.pauseUntil || 0) > state.t) return;   // a breath between camp trips
  // standing in a fleet square (the arrival, the introductions, the minister's election): wait there
  if (state.fleetHold) { const fl = (state.fleets || []).find(f => f.members.includes(a.id)); const s = fl && fl.slots.find(x => x.agentId === a.id); if (s) { setTask(game, a, { kind: 'walk', to: { x: s.x, z: s.z }, phase: 'formation', fleetId: fl.id }); return; } }
  // the minister inspects: a site, a building, the crates, now and then
  if (a.id === state.minister) {
    if ((a.nextWander ?? 0) <= state.t) {
      const [lo, hi] = TASK.wanderEvery; a.nextWander = state.t + rng.range(lo, hi);
      const places = state.buildings.filter(x => x.status !== 'removed');
      const sites = places.filter(x => x.status !== 'done');
      const target = sites.length && rng.chance(0.7) ? rng.pick(sites) : places.length && rng.chance(0.6) ? rng.pick(places) : null;
      setTask(game, a, { kind: 'walk', to: target ? siteSpot(target, state.centre) : game.freeGroundNear(state.stockpile, 4), phase: 'inspect', buildingId: target ? target.id : undefined });
    }
    return;
  }
  // an institution's member (ART_DIRECTION §15): patrol the route, attend the session, keep to the venue
  if (a.role && game.planDuty && game.planDuty(a)) return;
  // no building job: work the camp (foragers at the shore, gatherers at the edges), with the odd stroll between trips
  const camp = state.camp;
  if (camp && !(a.flags.campTrips && rng.chance(JOB.wanderChance))) {
    a.campRole = a.campRole || campRoleFor(a);
    a.flags.campTrips = (a.flags.campTrips || 0) + 1;
    const spots = a.campRole === 'forager' ? camp.forage : camp.gather;
    const s = spots[(a.flags.campTrips + a.id.length) % spots.length];
    setTask(game, a, { kind: 'gather', to: { x: +(s.x + rng.range(-1.2, 1.2)).toFixed(2), z: +(s.z + rng.range(-1.2, 1.2)).toFixed(2) }, phase: 'camp', role: a.campRole, camp: true });
    return;
  }
  // a stroll (the old idle wander), then back to the camp's work
  if ((a.nextWander ?? 0) <= state.t) {
    const [lo, hi] = TASK.wanderEvery; a.nextWander = state.t + rng.range(lo, hi);
    const to = game.freeGroundNear(a.homeId ? state.buildings.find(x => x.id === a.homeId) || state.centre : state.centre, 7);
    setTask(game, a, { kind: 'walk', to, phase: 'wander' });
  }
}

function onArrive(game, a) {
  const { state, rng, catalog } = game;
  const t = a.task;
  const b = t.buildingId ? state.buildings.find(x => x.id === t.buildingId) : null;
  switch (t.kind) {
    case 'walk':
      if (t.phase === 'to_stock') { if (!b || b.status === 'done' || b.status === 'removed') return clearTask(a); setTask(game, a, { kind: 'haul', to: siteSpot(b, state.stockpile), carrying: 'crate', buildingId: b.id }); }
      else if (t.phase === 'to_site') { if (!b || b.status === 'done') return clearTask(a); setTask(game, a, { kind: 'work', to: null, buildingId: b.id, timer: TASK.workBurst }); a.task.arrived = true; }
      else if (t.phase === 'to_work') { if (!b || b.status !== 'done') return clearTask(a); setTask(game, a, { kind: 'work', to: null, buildingId: b.id, timer: TASK.tripEvery, produce: true }); a.task.arrived = true; }
      else if (t.phase === 'back') { clearTask(a); }
      else if (t.phase === 'formation') { setTask(game, a, { kind: 'stand', to: null, fleetId: t.fleetId }); a.task.arrived = true; }   // in the square, until released
      else if (t.phase === 'inspect') { setTask(game, a, { kind: 'stand', to: null, inspect: true, timer: JOB.inspectSeconds, buildingId: t.buildingId }); a.task.arrived = true; }
      else if (t.phase === 'patrol' || t.phase === 'attend') { setTask(game, a, { kind: 'stand', to: null, duty: t.duty, institutionId: t.institutionId, timer: t.timer || 2 }); a.task.arrived = true; }   // a pause on the route / at the venue
      else if (t.phase === 'settle') { setTask(game, a, { kind: 'stand', to: null, duty: 'settle', conflictId: t.conflictId, institutionId: t.institutionId, timer: 4 }); a.task.arrived = true; if (game.onSettleArrive) game.onSettleArrive(a, t.conflictId, t.institutionId); }
      else if (t.phase === 'session') { setTask(game, a, { kind: 'stand', to: null, duty: 'session', institutionId: t.institutionId, conflictId: t.conflictId, timer: t.timer || 10 }); a.task.arrived = true; }
      else clearTask(a);
      break;
    case 'haul':
      if (b && b.status !== 'done' && b.status !== 'removed') {
        b.cratesDelivered++;
        if (b.status === 'site') { b.status = 'building'; }
        game.emit('building:progress', { id: b.id, progress: +b.progress.toFixed(3), crates: b.cratesDelivered, cratesNeeded: b.cratesNeeded });
        setTask(game, a, { kind: 'work', to: null, buildingId: b.id, timer: TASK.workBurst }); a.task.arrived = true;
      } else if (t.product) { clearTask(a); if (t.camp) a.pauseUntil = state.t + rng.range(1.5, 4); }   // output dropped at the stockpile
      else clearTask(a);
      break;
    case 'deliver':
      if (t.phase === 'gift') {   // at the plot's edge: off the map toward the nation, back when the gift is handed over
        setTask(game, a, { kind: 'journey', to: null, carrying: 'gift', gift: t.gift, neighbourId: t.neighbourId, give: t.give, until: state.t + (t.travel || 10), exit: t.exit || { x: a.x, z: a.z } });
        a.task.arrived = true;
        break;
      }
      for (const id of t.letterIds || []) landLetter(game, id, a.id);
      clearTask(a);
      if (b == null && a.jobId) { /* plan() resumes the job */ }
      break;
    case 'gather':
      if (t.phase === 'camp') { setTask(game, a, { kind: 'work', to: null, camp: true, role: t.role, spot: t.to, timer: JOB.gatherSeconds }); a.task.arrived = true; }   // forage / gather at the spot
      else { setTask(game, a, { kind: 'meeting', to: null }); a.task.arrived = true; }
      break;
    case 'rest': a.status = 'resting'; t.walking = false; game.emit('agent:task', { agentId: a.id, task: { kind: 'idle', to: null, carrying: null, resting: true } }); break;
    case 'strike': break;
    case 'leave': a.status = 'left'; break;
    default: clearTask(a);
  }
}

function advance(game, a, dt) {
  const { state, rng, catalog } = game;
  const t = a.task;
  if (t.kind === 'work' && t.camp) {
    // the camp: forage or gather for a while, then carry the find to the crates (a basket of food, a crate of wood and stone)
    t.timer -= dt;
    if (t.timer <= 0) setTask(game, a, { kind: 'haul', to: { x: state.stockpile.x + rng.range(-1, 1), z: state.stockpile.z + rng.range(-1, 1) }, carrying: t.role === 'forager' ? 'bread' : 'crate', product: true, camp: true, role: t.role, buildingId: null });
    return;
  }
  if (t.kind === 'stand') {
    if (t.timer != null) { t.timer -= dt; if (t.timer <= 0) clearTask(a); }   // the minister's inspection ends; a fleet square waits for its release
    return;
  }
  if (t.kind === 'work') {
    const b = state.buildings.find(x => x.id === t.buildingId);
    if (!b || b.status === 'removed') return clearTask(a);
    if (!t.produce) {
      if (b.status === 'done') return clearTask(a);
      const e = entryOf(catalog, b);
      const rate = workerEff(a, e.skill) / (Math.max(1, e.workers) * (e.buildSeconds || 60));
      if (b.progress < 1) {
        const before = Math.floor(b.progress * 10);
        b.progress = Math.min(1, b.progress + rate * dt);
        if (Math.floor(b.progress * 10) !== before || b.progress >= 1) game.emit('building:progress', { id: b.id, progress: +b.progress.toFixed(3), crates: b.cratesDelivered, cratesNeeded: b.cratesNeeded });
      }
      t.timer -= dt;
      if (t.timer <= 0) {
        const inFlight = state.agents.filter(o => o.task && o.task.kind === 'haul' && o.task.buildingId === b.id).length;
        if (b.cratesDelivered + inFlight < b.cratesNeeded) setTask(game, a, { kind: 'walk', to: { x: state.stockpile.x + rng.range(-1, 1), z: state.stockpile.z + rng.range(-1, 1) }, phase: 'to_stock', buildingId: b.id });
        else t.timer = TASK.workBurst;
      }
    } else {
      t.timer -= dt;
      if (t.timer <= 0) {
        const e = catalog.get(b.kind);
        const makes = e && Object.values(e.perDay).some(v => v > 0);
        if (makes) setTask(game, a, { kind: 'haul', to: { x: state.stockpile.x + rng.range(-1, 1), z: state.stockpile.z + rng.range(-1, 1) }, carrying: productOf(b.kind), product: true, buildingId: null, from: b.id });
        else t.timer = TASK.tripEvery;
      }
    }
  } else if (t.kind === 'rest') {
    if (a.energy >= BAL.restUntil) clearTask(a);
  } else if (t.kind === 'strike') {
    // handled by society (mood recovers -> strikeEnd)
  } else if (t.kind === 'journey') {
    if (state.t >= t.until) {
      const done = t; clearTask(a);
      a.x = done.exit.x; a.z = done.exit.z;
      if (game.onJourneyEnd) game.onJourneyEnd(a, done);
      setTask(game, a, { kind: 'walk', to: game.freeGroundNear(state.spawn, 4), phase: 'back' });
    }
  } else if (t.kind === 'leave') {
    if (state.t >= t.leftAt) { a.status = 'left'; a.task = null; }
  } else if (t.kind === 'meeting') {
    // wait for endMeeting
  } else if (t.kind === 'walk' && t.phase === 'wander') { clearTask(a); }
}
