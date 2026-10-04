// Entrepreneurs (ART_DIRECTION §11): ambitious folk (or the very skilled in a good mood) now and then propose a venture
// of their own (a tea house, a boat workshop, a flower stall, an olive press...) by speech bubble and letter with
// yes / no. Approved, they place and build it themselves near their home: a catalogue noun becomes that prefab, anything
// else goes through building:needsDesign -> codegen like every spoken creation (the mock stock is the fallback).
// Rarely they just start a small one. The finished place is theirs to keep, and it earns a little.

import { remember } from './talk.js';
import { takeJob } from './tasks.js';
import { nudgeMood } from './society.js';
import * as L from './letters.js';

export const VENTURE = {
  firstAfter: 150,           // s after the start until the first proposal can come
  every: [70, 130],          // s between proposals
  retryAfter: 35,            // s until the next look when nobody is eligible
  chance: 0.8,               // chance an eligible folk speaks up when the moment comes
  cooldown: 300,             // s before the same folk proposes again
  maxOpen: 1,                // open proposals at a time
  maxVentures: 4,            // ventures in a game (approved or started)
  selfStart: 0.15,           // chance a small venture is simply started (a note instead of a question)
  skillHigh: 8, moodHigh: 70, moodMin: 50,
  defaultPerDay: { coin: 2, goods: 1 }   // what a venture earns when its design says nothing
};

// ideas by trade. `small` ones may be started without asking.
export const VENTURE_IDEAS = {
  baker: [{ title: 'Tea House', request: 'a small tea house' }, { title: 'Bun Cart', request: 'a bun cart', small: true }],
  builder: [{ title: 'Boat Workshop', request: 'a boat workshop' }, { title: 'Stone Yard', request: 'a stone yard' }],
  farmer: [{ title: 'Flower Stall', request: 'a flower stall', small: true }, { title: 'Olive Press', request: 'an olive press' }],
  crafter: [{ title: 'Pottery', request: 'a pottery' }, { title: 'Lantern Workshop', request: 'a lantern workshop' }],
  trader: [{ title: 'Spice Stall', request: 'a spice stall', small: true }, { title: 'Trading Post', request: 'a trading post' }],
  scout: [{ title: 'Kite Shop', request: 'a kite shop', small: true }, { title: 'Lookout Hut', request: 'a lookout hut' }],
  courier: [{ title: 'Kite Shop', request: 'a kite shop', small: true }],
  diplomat: [{ title: 'Letter Office', request: 'a letter office' }],
  artist: [{ title: 'Puppet Theatre', request: 'a puppet theatre' }, { title: 'Paint Shop', request: 'a paint shop', small: true }],
  dreamer: [{ title: 'Puppet Theatre', request: 'a puppet theatre' }, { title: 'Hammock Garden', request: 'a hammock garden', small: true }]
};
const DEFAULT_IDEAS = [{ title: 'Tea House', request: 'a small tea house' }, { title: 'Flower Stall', request: 'a flower stall', small: true }];

const alive = a => a.status !== 'left';
const mainSkill = a => Object.entries(a.skills).sort((p, q) => q[1] - p[1])[0];

export function eligible(game, a) {
  const { state } = game;
  if (!alive(a) || a.id === state.minister || a.role || a.status === 'striking' || a.mood < VENTURE.moodMin) return false;   // an institution's member keeps to their post
  if (a.task && ['deliver', 'journey', 'leave', 'stand'].includes(a.task.kind)) return false;
  if ((a.flags.ventureAt ?? -Infinity) > state.t - VENTURE.cooldown) return false;
  if (state.ventures.some(v => v.agentId === a.id && v.status !== 'declined')) return false;   // one venture each
  const [, best] = mainSkill(a);
  return a.traits.includes('ambitious') || (best >= VENTURE.skillHigh && a.mood >= VENTURE.moodHigh);
}

export function ideaFor(game, a) {
  const { state, rng } = game;
  const list = VENTURE_IDEAS[a.trade] || DEFAULT_IDEAS;
  const taken = new Set(state.ventures.map(v => v.title));
  const fresh = list.filter(i => !taken.has(i.title));
  return { ...rng.pick(fresh.length ? fresh : list) };
}

export function tickVentures(game) {
  const { state, rng } = game;
  if (state.nextVentureAt == null) state.nextVentureAt = VENTURE.firstAfter;
  if (state.t < state.nextVentureAt) return;
  if (state.fleetHold || state.scene === 'moon' || state.meeting) { state.nextVentureAt = state.t + 10; return; }
  if (state.ventures.filter(v => v.status === 'proposed').length >= VENTURE.maxOpen || state.ventures.filter(v => v.status !== 'declined').length >= VENTURE.maxVentures) { state.nextVentureAt = state.t + VENTURE.retryAfter; return; }
  const pool = state.agents.filter(a => eligible(game, a));
  if (!pool.length || !rng.chance(VENTURE.chance)) { state.nextVentureAt = state.t + VENTURE.retryAfter; return; }
  state.nextVentureAt = state.t + rng.range(VENTURE.every[0], VENTURE.every[1]);
  proposeVenture(game, rng.pick(pool));
}

// a folk asks (bubble + letter with yes / no), or, rarely, just starts a small one
export function proposeVenture(game, a, idea = null, { ask = null } = {}) {
  const { state, rng } = game;
  idea = idea || ideaFor(game, a);
  const v = { id: 'v' + (state.nextVentureId = (state.nextVentureId || 0) + 1), agentId: a.id, title: idea.title, request: idea.request, small: !!idea.small, status: 'proposed', askedAt: state.t, day: state.day, letterId: null, buildingId: null };
  state.ventures.push(v);
  a.flags.ventureAt = state.t;
  const selfStart = ask === false || (ask !== true && v.small && rng.chance(VENTURE.selfStart));
  if (selfStart) {
    v.status = 'started';
    game.emit('agent:say', { agentId: a.id, text: `I am opening a ${v.title.toLowerCase()} by my ${a.homeId ? 'house' : 'tent'}. Come by!`, kind: 'venture', ventureId: v.id, ttl: 6 });
    const letter = L.ventureLetter(rng, { agent: a, venture: v, day: state.day, settlement: state.name, started: true });
    game.sendLetter(letter); v.letterId = letter.id;
    remember(a, `started my own ${v.title.toLowerCase()}`);
    startVenture(game, v);
    return v;
  }
  game.emit('agent:say', { agentId: a.id, text: `I would like to open a ${v.title.toLowerCase()}. May I?`, kind: 'venture', ventureId: v.id, ttl: 6 });
  const letter = L.ventureLetter(rng, { agent: a, venture: v, day: state.day, settlement: state.name });
  game.sendLetter(letter); v.letterId = letter.id;
  game.emit('venture:propose', { ventureId: v.id, agentId: a.id, title: v.title, request: v.request, letterId: letter.id });
  game.log(`${a.name} proposes a ${v.title.toLowerCase()}.`);
  return v;
}

// the sovereign's answer (reply_letter yes / no -> applyEffect 'venture')
export function ventureDecision(game, ventureId, decision) {
  const { state } = game;
  const v = state.ventures.find(x => x.id === ventureId);
  if (!v) return null;
  const a = state.agents.find(x => x.id === v.agentId);
  if (v.status !== 'proposed') return { type: 'venture', ventureId: v.id, status: v.status };
  if (decision === 'no') {
    v.status = 'declined';
    if (a) { nudgeMood(a, -3, 'venture refused', game.emit); game.emit('agent:say', { agentId: a.id, text: 'Maybe next spring, then.', kind: 'venture', ventureId: v.id, ttl: 4 }); remember(a, `was told no about my ${v.title.toLowerCase()}`); }
    game.emit('venture:decline', { ventureId: v.id, agentId: v.agentId });
    return { type: 'venture', ventureId: v.id, status: 'declined' };
  }
  v.status = 'approved';
  if (a) { nudgeMood(a, 8, 'venture approved', game.emit); game.emit('agent:say', { agentId: a.id, text: 'Yes! I will start today.', kind: 'venture', ventureId: v.id, ttl: 4 }); remember(a, `was allowed to open my ${v.title.toLowerCase()}`); }
  const b = startVenture(game, v);
  return { type: 'venture', ventureId: v.id, status: v.status, buildingId: b ? b.id : null };
}

// place and build it near the owner's home (or where they stand); the owner is on the crew first
export function startVenture(game, v) {
  const { state } = game;
  const a = state.agents.find(x => x.id === v.agentId);
  if (!a) { v.status = 'declined'; return null; }
  const home = a.homeId ? state.buildings.find(b => b.id === a.homeId) : null;
  const at = home ? { mode: 'near', ref: home.id } : { mode: 'pointer', x: a.x, z: a.z };
  const r = game.apply({ type: 'build', kind: null, request: v.request, name: v.title, at, assign: [a.id] });
  if (!r.ok || !r.buildings || !r.buildings.length) { v.status = 'declined'; game.log(`${a.name}'s ${v.title.toLowerCase()} found no ground: ${r.reason}`); return null; }
  const b = state.buildings.find(x => x.id === r.buildings[0]);
  b.venture = { id: v.id, ownerId: a.id, title: v.title };
  b.name = v.title;
  v.buildingId = b.id;
  v.status = 'building';
  if (!b.workers.includes(a.id)) takeJob(game, a, b);
  game.emit('venture:start', { ventureId: v.id, agentId: a.id, buildingId: b.id, title: v.title, x: b.x, z: b.z, generated: !b.kind });
  game.log(`${a.name} starts the ${v.title} at (${b.x}, ${b.z}).`);
  return b;
}

// the building is done: the owner keeps it, and it earns a little
export function onVentureDone(game, b) {
  const { state, catalog } = game;
  if (!b.venture) return;
  const v = state.ventures.find(x => x.id === b.venture.id);
  if (v) v.status = 'done';
  const e = catalog.get(b.kind);
  if (e) {
    if (!Object.keys(e.perDay).length) e.perDay = { ...VENTURE.defaultPerDay };
    if (!e.workers) e.workers = 1;
  }
  const a = state.agents.find(x => x.id === b.venture.ownerId);
  if (a && a.status !== 'left' && a.id !== state.minister) {
    takeJob(game, a, b);
    nudgeMood(a, 6, 'my own place', game.emit);
    remember(a, `opened my ${b.venture.title.toLowerCase()}`);
    game.emit('agent:say', { agentId: a.id, text: `The ${b.venture.title.toLowerCase()} is open. Come by!`, kind: 'venture', ventureId: b.venture.id, ttl: 5 });
  }
  game.emit('venture:done', { ventureId: b.venture.id, agentId: b.venture.ownerId, buildingId: b.id, title: b.venture.title });
}
