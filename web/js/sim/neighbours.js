// Three AI settlements on the horizon. They grow on their own and write: greetings, trade offers, envy, alliance, complaints.

import { neighbourLetter } from './letters.js';
import { plural, isOurs } from './society.js';

export const NB = {
  letterEvery: [3, 6],      // days between letters from one neighbour (three of them: about one neighbour letter every 90 s)
  firstLetterAt: 45,        // seconds after the start, the first greeting
  envyRatio: 1.25,          // they envy us when our prosperity exceeds theirs by this ratio
  allianceAttitude: 65,
  complaintAttitude: 30
};

// ART_DIRECTION §7: the five walking species are the nations' peoples (`peoples`, the first is the leader's); envoys,
// visitors and traders are of the nation's species. Our settlers are only flits and floaties.
const ROSTER = [
  // titles are the story arc's nation names (geography.js uses the same ids and positions)
  { id: 'n1', name: 'Sorrento-on-the-Rock', title: 'The Drop Riviera', leaderSpecies: 'drop', peoples: ['drop'], leaderName: 'Donna Perla', temperament: 'proud', prosperity: 60, growth: 2.5, attitude: 50, x: -95, z: -40,
    desc: 'terraces, lemon trees and a very old bell', surplus: 'goods', wants: 'food' },
  { id: 'n2', name: 'Little Lantern', title: 'The Loaf Republic', leaderSpecies: 'loaf', peoples: ['loaf'], leaderName: 'Baker Odo', temperament: 'warm', prosperity: 40, growth: 1.8, attitude: 62, x: 100, z: -55,
    desc: 'a bakers\' village that smells of crust at dawn', surplus: 'food', wants: 'wood' },
  { id: 'n3', name: 'Grey Harbour', title: 'The Puffer Harbour', leaderSpecies: 'puffer', peoples: ['puffer', 'pip', 'scoot'], leaderName: 'Harbourmaster Brusco', temperament: 'gruff', prosperity: 85, growth: 3.2, attitude: 40, x: 0, z: -130,
    desc: 'stone quays and tall grey cranes across the bay, where puffers build, pips keep the allotments and scoots run the docks', surplus: 'stone', wants: 'coin' }
];

export function createNeighbours(rng) {
  return ROSTER.map((n, i) => ({ ...n, peoples: n.peoples.slice(), allied: false, nextLetterAt: NB.firstLetterAt + i * 20 + rng.range(0, 10), lettersSent: 0, gifts: 0, visits: 0 }));
}

// the species of the envoy a nation sends (the leader's people most often, the others now and then)
export function envoySpecies(n, rng) {
  const ps = n.peoples && n.peoples.length ? n.peoples : [n.leaderSpecies];
  if (ps.length === 1 || !rng) return ps[0];
  return rng.next() < 0.6 ? ps[0] : rng.pick(ps.slice(1));
}
// a nation title that names one of OUR species is stale (the globe's old "Flit Sky-hold"): the sim keeps its own
export const staleTitle = title => typeof title === 'string' && title.toLowerCase().split(/[^a-z]+/).some(w => isOurs(w) || isOurs(w.replace(/s$/, '')));

export function stepNeighbours(game, dt) {
  const { state, rng } = game;
  for (const n of state.neighbours) {
    n.prosperity += n.growth * dt / 60;
    if (state.t >= n.nextLetterAt) {
      n.nextLetterAt = state.t + rng.range(NB.letterEvery[0], NB.letterEvery[1]) * 60;
      const forced = n.nextKind || null; n.nextKind = null;
      writeLetter(game, n, forced);
    }
  }
}

export function dailyNeighbours(game) {
  for (const n of game.state.neighbours) n.attitude = Math.max(0, Math.min(100, n.attitude + (n.allied ? 0.5 : 0) - (game.state.prosperity > n.prosperity * NB.envyRatio && n.temperament !== 'warm' ? 1 : 0)));
}

export function writeLetter(game, n, forced = null) {
  const { state, rng } = game;
  let kind = forced;
  if (!kind) {
    if (n.lettersSent === 0) kind = 'greeting';
    else if (n.attitude >= NB.allianceAttitude && !n.allied) kind = 'alliance';
    else if (n.attitude < NB.complaintAttitude) kind = 'complaint';
    else if (state.prosperity > n.prosperity * NB.envyRatio && n.temperament !== 'warm') kind = 'envy';
    else kind = 'trade';
  }
  n.lettersSent++;
  const get = {}, give = {};
  if (kind === 'trade') {
    const want = n.wants, have = n.surplus;
    const amt = 4 + Math.floor(n.prosperity / 40);
    get[have] = amt; give[want] = Math.max(2, Math.round(amt * (n.temperament === 'sly' ? 1.3 : n.temperament === 'warm' ? 0.7 : 1)));
  }
  const letter = neighbourLetter(rng, { neighbour: n, kind, day: state.day, settlement: state.name, our: state.resources, give, get });
  game.sendLetter(letter);
  return letter;
}

export function neighbourBrief(state) {
  return state.neighbours.map(n => ({ id: n.id, name: n.name, title: n.title, species: n.leaderSpecies, peoples: n.peoples, temperament: n.temperament, attitude: Math.round(n.attitude), prosperity: Math.round(n.prosperity), allied: n.allied, ...(n.gifts ? { gifts: n.gifts } : {}) }));
}

// id, name, story title, leader, any of its peoples or a word of any of them ("the riviera", "loaf republic", "brusco",
// "the scoots"). "The flits" names nobody: flits are ours.
export function findNeighbour(state, ref) {
  if (ref == null || ref === '') return null;
  const r = String(ref).toLowerCase().trim();
  const ns = state.neighbours;
  const exact = ns.find(n => n.id === r || n.name.toLowerCase() === r || (n.title || '').toLowerCase() === r);
  if (exact) return exact;
  const words = r.replace(/[^a-z0-9 -]+/g, ' ').split(/[\s-]+/).filter(w => w.length >= 3 && !['the', 'our', 'with', 'from', 'and', 'nation', 'neighbour', 'neighbor', 'neighbours', 'neighbors', 'town', 'people', 'folk'].includes(w));
  let best = null, bs = 0;
  for (const n of ns) {
    const peoples = (n.peoples || [n.leaderSpecies]).flatMap(s => [s, plural(s)]);
    const hay = `${n.id} ${n.name} ${n.title || ''} ${n.leaderName} ${peoples.join(' ')}`.toLowerCase().replace(/[^a-z0-9 -]+/g, ' ').split(/[\s-]+/);
    const sc = words.filter(w => hay.some(h => h === w || (w.length >= 4 && (h.startsWith(w) || w.startsWith(h))))).length;
    if (sc > bs) { bs = sc; best = n; }
  }
  return best;
}
// the point on the plot's edge where the way to a neighbour leaves the map (and where its envoys enter)
export function edgeToward(state, n, inset = 1.5) {
  const p = state.plot, c = state.centre;
  const dx = n.x - c.x, dz = n.z - c.z;
  if (!dx && !dz) return { x: c.x, z: p.z0 + inset };
  let t = Infinity;
  if (dx > 0) t = Math.min(t, (p.x1 - inset - c.x) / dx); else if (dx < 0) t = Math.min(t, (p.x0 + inset - c.x) / dx);
  if (dz > 0) t = Math.min(t, (p.z1 - inset - c.z) / dz); else if (dz < 0) t = Math.min(t, (p.z0 + inset - c.z) / dz);
  const l = Math.hypot(dx, dz);
  return { x: +(c.x + dx * t).toFixed(2), z: +(c.z + dz * t).toFixed(2), dir: { x: +(dx / l).toFixed(3), z: +(dz / l).toFixed(3) }, distance: +l.toFixed(1) };
}
