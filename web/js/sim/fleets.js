// Fleets (ART_DIRECTION §11): after landing our folk form neat square formations by trade, each fleet is introduced in a
// calm scripted sequence, then the game asks the sovereign to click a minister. Later elections are run by the crowd.
// Pure data in state.fleets / state.election / state.intro; events out: fleet:form, fleet:introduce, election:ask,
// election:result, ceremony:start / ceremony:end, fleet:release.

import { setTask, clearTask, releaseAgent } from './tasks.js';
import { nudgeMood } from './society.js';
import { pointInPoly } from './geometry.js';
import { remember } from './talk.js';
import * as L from './letters.js';

export const FLEET = {
  spacing: 1.6,          // metres between folk in a square
  arcRadius: 7.5,        // the squares stand on an arc this far from the camera focus (the landing spot)
  arcSpan: 150,          // degrees of arc the squares spread over, on the camera side (+z)
  minPerFleet: 2, maxPerFleet: 4,
  introFirstAfter: 1.0,  // s after introduceFleets() until the first fleet is named
  introEvery: 3.4,       // s between fleets
  memberHopEvery: 0.3,   // s between the members' hops inside one introduction
  autoIntroAfter: 14,    // s after fleet:form: if nobody ran the intro the sim runs it (headless, mock, an old UI)
  ceremonySeconds: 5,    // the little ceremony after the click
  holdMax: 90,           // s after election:ask the folk stand waiting at most; then they go to work (the ask stays open)
  crowdAfter: 150,       // s after election:ask with no click: the crowd elects on its own
  crowdOnLeave: 8        // s after a minister leaves until the crowd elects a new one
};

// trade -> fleet. Groups too small to be a square (< minPerFleet) merge into their `fallback`.
export const FLEET_GROUPS = [
  { id: 'builders', name: 'The Builders', trade: 'builder', trades: ['builder'], fallback: 'crafters' },
  { id: 'farmers', name: 'The Farmers', trade: 'farmer', trades: ['farmer'], fallback: 'bakers' },
  { id: 'bakers', name: 'The Bakers', trade: 'baker', trades: ['baker'], fallback: 'farmers' },
  { id: 'couriers', name: 'The Couriers', trade: 'courier', trades: ['scout', 'courier', 'trader'], fallback: 'scholars' },
  { id: 'scholars', name: 'The Scholars', trade: 'scholar', trades: ['diplomat', 'artist', 'dreamer'], fallback: 'couriers' },
  { id: 'crafters', name: 'The Crafters', trade: 'crafter', trades: ['crafter'], fallback: 'builders' }
];
const groupOfTrade = trade => FLEET_GROUPS.find(g => g.trades.includes(trade)) || FLEET_GROUPS[0];
const alive = a => a.status !== 'left';
const PLURAL = { flit: 'flits', floatie: 'floaties', loaf: 'loaves', twinkle: 'twinkles', glim: 'glims', moth: 'moths' };
const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
// "four flits, two floaties"
export function speciesCount(members) {
  const n = {};
  for (const a of members) n[a.species] = (n[a.species] || 0) + 1;
  return Object.entries(n).map(([s, c]) => `${WORDS[c] || c} ${c === 1 ? s : PLURAL[s] || s + 's'}`).join(', ');
}

// the square: n members on a ceil(sqrt n) grid, `spacing` apart, centred on (cx, cz); the best member stands in front (+z)
export function squareSlots(n, cx, cz, spacing = FLEET.spacing) {
  const cols = Math.max(1, Math.ceil(Math.sqrt(n))), rows = Math.max(1, Math.ceil(n / cols));
  const out = [];
  for (let i = 0; i < n; i++) {
    const r = Math.floor(i / cols), c = i % cols;
    const inRow = r === rows - 1 ? n - r * cols : cols;   // a short last row is centred too
    out.push({ x: +(cx + (c - (inRow - 1) / 2) * spacing).toFixed(2), z: +(cz + ((rows - 1) / 2 - r) * spacing).toFixed(2) });
  }
  return out;
}

// group the alive folk into fleets of minPerFleet..maxPerFleet by trade
const COMPANY_NAME = { loaf: 'The Loaves', twinkle: 'The Twinkles', glim: 'The Glims', moth: 'The Moths' };
export function groupFolk(folk) {
  const buckets = new Map(FLEET_GROUPS.map(g => [g.id, []]));
  // the townsfolk stand in their own companies: one square per species (3 x 3 for nine), whatever their trades
  const companies = new Map();
  for (const a of folk) { if (a.townsfolk && a.company) { if (!companies.has(a.company)) companies.set(a.company, []); companies.get(a.company).push(a); } }
  for (const a of folk) if (!(a.townsfolk && a.company)) buckets.get(groupOfTrade(a.trade).id).push(a);
  // merge the small groups into their fallback (into the largest bucket if the fallback is empty too)
  for (let pass = 0; pass < 4; pass++) {
    let moved = false;
    for (const g of FLEET_GROUPS) {
      const list = buckets.get(g.id);
      if (!list.length || list.length >= FLEET.minPerFleet) continue;
      const total = [...buckets.values()].reduce((s, l) => s + l.length, 0);
      if (total < FLEET.minPerFleet) break;   // a camp of one: one fleet of one, so be it
      let into = buckets.get(g.fallback);
      if (!into || !into.length) into = [...FLEET_GROUPS].map(x => buckets.get(x.id)).filter(l => l !== list && l.length).sort((p, q) => q.length - p.length)[0];
      if (!into) continue;
      into.push(...list); list.length = 0; moved = true;
    }
    if (!moved) break;
  }
  const fleets = [];
  for (const g of FLEET_GROUPS) {
    const list = buckets.get(g.id).slice().sort((p, q) => q.skills[mainOf(q)] - p.skills[mainOf(p)]);
    if (!list.length) continue;
    const chunks = [];
    for (let i = 0; i < list.length; i += FLEET.maxPerFleet) chunks.push(list.slice(i, i + FLEET.maxPerFleet));
    // a last chunk of one joins the previous (5 builders -> 3 + 2, never 4 + 1)
    if (chunks.length > 1 && chunks.at(-1).length < FLEET.minPerFleet) { const last = chunks.pop(); const prev = chunks.at(-1); while (last.length && prev.length > FLEET.minPerFleet + 1) last.push(prev.pop()); chunks.push(...(last.length >= FLEET.minPerFleet ? [last] : [])); if (last.length && last.length < FLEET.minPerFleet) prev.push(...last); }
    chunks.forEach((members, i) => fleets.push({ id: chunks.length > 1 ? `${g.id}-${i + 1}` : g.id, name: chunks.length > 1 ? `${g.name} ${['I', 'II', 'III', 'IV', 'V'][i] || i + 1}` : g.name, trade: g.trade, members }));
  }
  for (const [sp, members] of companies) fleets.push({ id: 'company-' + sp, name: COMPANY_NAME[sp] || `The ${sp}s`, trade: members[0].trade, members, company: sp });
  return fleets;
}
const mainOf = a => Object.entries(a.skills).sort((p, q) => q[1] - p[1])[0][0];

// ---- forming ----
export function formFleets(game, { focus = null } = {}) {
  const { state } = game;
  const folk = state.agents.filter(alive);
  if (!folk.length) return [];
  const f = focus || state.spawn;
  const all = groupFolk(folk);
  const groups = all.filter(g => !g.company), companies = all.filter(g => g.company);
  const n = groups.length;
  const span = FLEET.arcSpan * Math.PI / 180;
  const a0 = Math.PI / 2 - span / 2;   // the arc opens toward +z (the camera side)
  const dry = (slots) => !slots.some(s => state.water.some(w => pointInPoly(s.x, s.z, w.poly)) || s.x < state.plot.x0 + 1 || s.x > state.plot.x1 - 1 || s.z < state.plot.z0 + 1 || s.z > state.plot.z1 - 1);
  const out = g => (cx, cz, slots) => ({ id: g.id, name: g.name, trade: g.trade, members: g.members.map(a => a.id), centre: { x: cx, z: cz }, slots: slots.map((s, j) => ({ agentId: g.members[j].id, x: s.x, z: s.z })), caption: `${g.name} · ${speciesCount(g.members)}`, ...(g.company ? { company: g.company } : {}) });
  const fleets = groups.map((g, i) => {
    const ang = n === 1 ? Math.PI / 2 : a0 + (i / (n - 1)) * span;
    let r = FLEET.arcRadius, cx, cz, slots;
    for (let tries = 0; tries < 5; tries++) {   // pull a square in off the water / the plot's edge
      cx = +(f.x + Math.cos(ang) * r).toFixed(2); cz = +(f.z + Math.sin(ang) * r).toFixed(2);
      slots = squareSlots(g.members.length, cx, cz);
      if (dry(slots)) break;
      r -= 1.5;
    }
    return out(g)(cx, cz, slots);
  });
  // the townsfolk companies: a row of squares behind the focus, facing the camera over the trades' arc
  const widths = companies.map(g => Math.ceil(Math.sqrt(g.members.length)) * FLEET.spacing);
  let x = f.x - (widths.reduce((a, w) => a + w, 0) + FLEET.spacing * (companies.length - 1)) / 2;
  companies.forEach((g, i) => {
    let cx = +(x + widths[i] / 2).toFixed(2), back = 6, cz, slots;
    for (let tries = 0; tries < 6; tries++) { cz = +(f.z - back).toFixed(2); slots = squareSlots(g.members.length, cx, cz); if (dry(slots)) break; back -= 1.2; }
    fleets.push(out(g)(cx, cz, slots));
    x += widths[i] + FLEET.spacing;
  });
  state.fleets = fleets;
  state.fleetHold = true;
  state.intro = { started: false, done: false, formedAt: state.t, order: fleets.map(x => x.id) };
  state.fleetBeats = [{ at: state.t + FLEET.autoIntroAfter, what: 'auto_intro' }];
  for (const fl of fleets) for (const s of fl.slots) {
    const a = state.agents.find(x => x.id === s.agentId);
    if (!a) continue;
    a.fleetId = fl.id;
    a.resume = null;
    if (a.task && ['deliver', 'journey', 'leave'].includes(a.task.kind)) continue;
    setTask(game, a, { kind: 'walk', to: { x: s.x, z: s.z }, phase: 'formation', fleetId: fl.id });
  }
  game.emit('fleet:form', { fleets: fleets.map(copyFleet), focus: { x: f.x, z: f.z } });
  game.log(`Fleets formed: ${fleets.map(x => `${x.name} (${x.members.length})`).join(', ')}.`);
  return fleets.map(copyFleet);
}
const copyFleet = fl => ({ id: fl.id, name: fl.name, trade: fl.trade, members: fl.members.slice(), centre: { ...fl.centre }, slots: fl.slots.map(s => ({ ...s })), caption: fl.caption });

// a newcomer joins the fleet of its trade (or starts one); no formation walk after the intro
export function joinFleet(game, a) {
  const { state } = game;
  if (!state.fleets) return null;
  const g = groupOfTrade(a.trade);
  let fl = state.fleets.find(x => x.id === g.id || x.id.startsWith(g.id + '-'));
  if (!fl) { fl = { id: g.id, name: g.name, trade: g.trade, members: [], centre: { ...state.spawn }, slots: [], caption: g.name }; state.fleets.push(fl); }
  if (!fl.members.includes(a.id)) fl.members.push(a.id);
  a.fleetId = fl.id;
  return fl;
}

export const fleetOf = (state, a) => (state.fleets || []).find(f => f.members.includes(a.id)) || null;

// ---- the introduction ----
// Schedules fleet:introduce for every fleet in order, then election:ask. Returns the order (fleet ids).
export function introduceFleets(game, { every = FLEET.introEvery, first = FLEET.introFirstAfter } = {}) {
  const { state } = game;
  if (!state.fleets) formFleets(game);
  const intro = state.intro;
  if (intro.started) return intro.order.slice();
  intro.started = true; intro.startedAt = state.t; intro.every = every;
  state.fleetBeats = (state.fleetBeats || []).filter(b => b.what !== 'auto_intro');
  let at = state.t + Math.max(0, first);
  state.fleets.forEach((fl, i) => { state.fleetBeats.push({ at, what: 'introduce', fleetId: fl.id, index: i }); at += Math.max(0, every); });
  state.fleetBeats.push({ at, what: 'ask' });
  game.emit('fleet:intro', { order: intro.order.slice(), every, first, seconds: +(at - state.t).toFixed(1) });
  game.log('The fleets are introduced.');
  if (every === 0 && first === 0) tickFleets(game);   // tests: everything now
  return intro.order.slice();
}

function introduce(game, fleetId, index) {
  const { state } = game;
  const fl = state.fleets.find(f => f.id === fleetId);
  if (!fl) return;
  const members = fl.members.map(id => state.agents.find(a => a.id === id)).filter(a => a && alive(a));
  fl.caption = `${fl.name} · ${speciesCount(members)}`;
  game.emit('fleet:introduce', { fleetId: fl.id, index, total: state.fleets.length, name: fl.name, trade: fl.trade, caption: fl.caption, members: fl.members.slice(), centre: { ...fl.centre } });
  members.forEach((a, j) => state.fleetBeats.push({ at: state.t + j * FLEET.memberHopEvery, what: 'hop', agentId: a.id }));
  game.log(`Introducing ${fl.caption}.`);
}

function askMinister(game) {
  const { state } = game;
  state.intro.done = true;
  if (state.minister) { releaseFleets(game); return; }   // already chosen by voice during the intro
  const candidates = state.agents.filter(alive).map(a => a.id);
  state.election = { kind: 'minister', open: true, askedAt: state.t, candidates };
  game.emit('election:ask', { kind: 'minister', candidates, fleets: state.fleets.map(f => f.id), text: 'Choose your minister: click one of them.' });
  state.fleetBeats.push({ at: state.t + FLEET.holdMax, what: 'hold_over' }, { at: state.t + FLEET.crowdAfter, what: 'crowd_if_open' });
  game.log('Choose your minister: click one of them.');
}

// the sovereign clicked one (or said "make Olla our minister"): the appoint action runs, then the little ceremony
export function electMinister(game, agentId) {
  const r = game.apply({ type: 'appoint_minister', agentId, by: 'sovereign' });
  return r.ok ? { ok: true, agentId: game.state.minister, effects: r.effects } : r;
}

// called by the appoint_minister handler: closes an open ask and holds the ceremony
export function onMinisterChosen(game, agent, by = 'sovereign') {
  const { state } = game;
  const wasAsked = state.election && state.election.open;
  if (wasAsked) { state.election.open = false; state.election.resolvedAt = state.t; state.election.agentId = agent.id; }
  if (by !== 'crowd') game.emit('election:result', { kind: 'minister', agentId: agent.id, by, asked: !!wasAsked });   // the crowd's result carries the tally (crowdElection)
  remember(agent, by === 'crowd' ? 'the folk voted me minister' : 'the sovereign chose me as minister');
  if (!(wasAsked || (state.intro && state.intro.started && !state.intro.done))) return;   // a later voice appointment: no ceremony
  const where = { x: agent.x, z: agent.z };
  state.ceremony = { kind: 'minister', agentId: agent.id, endsAt: state.t + FLEET.ceremonySeconds };
  game.emit('ceremony:start', { kind: 'minister', agentId: agent.id, where, seconds: FLEET.ceremonySeconds, name: agent.name });
  for (const a of state.agents) if (alive(a) && a.id !== agent.id) { a.moodAcc = Math.max(0, a.moodAcc); nudgeMood(a, 5, 'a minister chosen', game.emit); }   // +5: every folk hops (the bridge hops at +4)
  game.emit('agent:say', { agentId: agent.id, text: by === 'crowd' ? 'Thank you all. I will do my best.' : 'Me? Thank you. I will do my best.', kind: 'ceremony', ttl: 5 });
  state.fleetBeats = (state.fleetBeats || []).filter(b => b.what !== 'hold_over' && b.what !== 'crowd_if_open');
  state.fleetBeats.push({ at: state.t + FLEET.ceremonySeconds, what: 'ceremony_end' });
}

// everyone standing in formation goes to work
export function releaseFleets(game) {
  const { state } = game;
  if (!state.fleetHold) return 0;
  state.fleetHold = false;
  let n = 0;
  for (const a of state.agents) {
    if (!alive(a) || !a.task) continue;
    if (a.task.kind === 'stand' || (a.task.kind === 'walk' && a.task.phase === 'formation')) { clearTask(a); n++; }
  }
  game.emit('fleet:release', { released: n });
  game.log('The fleets break and go to work.');
  return n;
}

// ---- later elections: the crowd votes ----
// how much `voter` thinks of `cand`: same fleet, same roof, same workplace, gossip, loyalty to the sitting minister
export function bond(state, voter, cand) {
  let b = 0;
  if (voter.fleetId && voter.fleetId === cand.fleetId) b += 1;
  if (voter.homeId && voter.homeId === cand.homeId) b += 1;
  if (voter.jobId && voter.jobId === cand.jobId) b += 0.8;
  for (const l of state.letters) if (l.kind === 'gossip' && l.from.id === voter.id && l.meta && l.meta.aboutId === cand.id) b += 0.5;
  if (cand.id === state.minister) b += voter.traits.includes('loyal') ? 1.2 : voter.traits.includes('stubborn') ? -0.6 : 0.3;
  if (voter.mind && voter.mind.vote === cand.id) b += 1.5;   // ART_DIRECTION §18: a mind's declared vote
  if (state.relationships) { const k = voter.id < cand.id ? `${voter.id}|${cand.id}` : `${cand.id}|${voter.id}`; const r = state.relationships[k]; if (r) b += r.a; }   // and how they get on
  return b;
}
export function voteScore(state, voter, cand, rng) {
  let s = cand.skills.diplomacy * 0.35 + cand.mood / 40 + cand.loyalty / 80 + bond(state, voter, cand) * 0.8;
  if (cand === voter) s += voter.traits.includes('ambitious') ? 1.5 : voter.traits.includes('proud') ? 0.4 : -2;
  if (cand.status === 'striking') s -= 2;
  if (cand.traits.includes('gossip') && voter.traits.includes('timid')) s -= 0.4;
  s += rng ? rng.range(-0.35, 0.35) : 0;
  return s;
}
export function crowdElection(game, kind = 'minister') {
  const { state, rng } = game;
  if (kind !== 'minister') return { ok: false, reason: `The crowd only elects a minister (not "${kind}").`, effects: [] };
  const folk = state.agents.filter(alive);
  if (!folk.length) return { ok: false, reason: 'Nobody here to vote.', effects: [] };
  const tally = {};
  const ballots = [];
  for (const v of folk) {
    const best = folk.map(c => ({ c, s: voteScore(state, v, c, rng) })).sort((p, q) => q.s - p.s)[0].c;
    tally[best.id] = (tally[best.id] || 0) + 1;
    ballots.push({ voter: v.id, for: best.id });
  }
  const ranked = Object.entries(tally).sort((p, q) => q[1] - p[1]);
  const winner = folk.find(a => a.id === ranked[0][0]);
  if (state.election && state.election.open) { state.election.open = false; state.election.by = 'crowd'; }
  const prev = state.minister;
  const r = game.apply({ type: 'appoint_minister', agentId: winner.id, by: 'crowd', silent: true });
  const result = { kind, agentId: winner.id, by: 'crowd', votes: tally, voters: folk.length, prev };
  game.emit('election:result', { ...result, ballots });
  game.sendLetter(L.electionResult(rng, { winner, tally: ranked.map(([id, n]) => ({ agent: folk.find(a => a.id === id), votes: n })), voters: folk.length, day: state.day, settlement: state.name, prev: prev ? folk.find(a => a.id === prev) : null, kind }));
  game.log(`The crowd elects ${winner.name} minister (${ranked[0][1]} of ${folk.length}).`);
  return { ok: r.ok, effects: [{ type: 'election', ...result }] };
}

// ---- the per-tick step ----
export function tickFleets(game) {
  const { state } = game;
  if (state.ceremony && state.t >= state.ceremony.endsAt) { const c = state.ceremony; state.ceremony = null; game.emit('ceremony:end', { kind: c.kind, agentId: c.agentId }); releaseFleets(game); }
  if (!state.fleetBeats || !state.fleetBeats.length) return;
  const due = state.fleetBeats.filter(b => state.t >= b.at);
  if (!due.length) return;
  state.fleetBeats = state.fleetBeats.filter(b => state.t < b.at);
  for (const b of due) {
    if (b.what === 'auto_intro') { if (!state.intro.started) introduceFleets(game); }
    else if (b.what === 'introduce') introduce(game, b.fleetId, b.index);
    else if (b.what === 'hop') game.emit('agent:listen', { agentId: b.agentId, hop: true });
    else if (b.what === 'ask') askMinister(game);
    else if (b.what === 'hold_over') { if (state.fleetHold && !state.ceremony) releaseFleets(game); }
    else if (b.what === 'crowd_if_open') { if (state.election && state.election.open && !state.minister) { game.log('No minister was chosen; the folk vote.'); crowdElection(game, 'minister'); } }
    else if (b.what === 'ceremony_end') { if (state.ceremony) { const c = state.ceremony; state.ceremony = null; game.emit('ceremony:end', { kind: c.kind, agentId: c.agentId }); } releaseFleets(game); }
    else if (b.what === 'crowd_on_leave') { if (!state.minister) crowdElection(game, 'minister'); }
  }
}

// the minister left or struck: the crowd picks another
export function onMinisterGone(game, agent) {
  const { state } = game;
  if (state.minister !== agent.id) return;
  state.minister = null;
  releaseAgent(game, agent);
  game.emit('minister:set', { agentId: null, left: agent.id });
  state.fleetBeats = state.fleetBeats || [];
  state.fleetBeats.push({ at: state.t + FLEET.crowdOnLeave, what: 'crowd_on_leave' });
}
