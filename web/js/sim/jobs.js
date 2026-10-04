// Jobs (ART_DIRECTION §11): every folk always has a job and a workplace. Before any building stands they work the camp:
// foragers bring food from the lake shore, gatherers bring driftwood and stones from the plot's edges; the minister
// inspects. A finished building staffs itself (tasks.staffBuilding), a site crews itself (tasks.assignWorkers), and the
// camp takes whoever is left, so nobody stands idle. Production per day = each worker's skill x mood (economy.workerEff).

import { workerEff } from './economy.js';
import { pointInPoly, distToEdge } from './geometry.js';

export const JOB = {
  campFood: 0.35,        // food per day per forager at average skill and mood (a camp of twelve still runs short: plant a farm)
  campWood: 0.45,        // wood per day per gatherer
  campStone: 0.25,       // stone per day per gatherer
  gatherSeconds: 7,      // seconds spent at a camp spot before carrying the find back
  wanderChance: 0.22,    // between camp trips: a short stroll instead
  inspectSeconds: 6,     // the minister stands at a site this long
  refreshEvery: 0.5      // seconds between job-label refreshes
};

export const FORAGER_TRADES = ['farmer', 'baker', 'dreamer', 'artist', 'diplomat'];
export const campRoleFor = a => (FORAGER_TRADES.includes(a.trade) ? 'forager' : 'gatherer');

// the camp's working spots: three on the lake shore (forage), three along the plot's edges off the water (gather)
export function campSpots(state) {
  const { plot } = state;
  const lakeEntry = state.water.find(w => w.kind === 'lake');
  const lake = lakeEntry ? lakeEntry.poly : null;
  const dry = (x, z) => x > plot.x0 + 1.5 && x < plot.x1 - 1.5 && z > plot.z0 + 1.5 && z < plot.z1 - 1.5 && !state.water.some(w => pointInPoly(x, z, w.poly) || distToEdge(x, z, w.poly) < 0.8);
  const c0 = state.centre;
  const forage = [];
  if (lake) {
    // the shore points nearest the camp (couriers and crews stay within a short walk of the tray and the crates)
    const c = lake.reduce((s, p) => ({ x: s.x + p[0] / lake.length, z: s.z + p[1] / lake.length }), { x: 0, z: 0 });
    const near = lake.map(([px, pz]) => { const dx = px - c.x, dz = pz - c.z, l = Math.hypot(dx, dz) || 1; return { x: +(px + dx / l * 1.4).toFixed(2), z: +(pz + dz / l * 1.4).toFixed(2) }; })
      .filter(p => dry(p.x, p.z)).sort((p, q) => Math.hypot(p.x - c0.x, p.z - c0.z) - Math.hypot(q.x - c0.x, q.z - c0.z));
    for (const p of near) { if (forage.length >= 3) break; if (forage.every(f => Math.hypot(f.x - p.x, f.z - p.z) >= 2.5)) forage.push(p); }
  }
  if (!forage.length) forage.push({ x: +(c0.x - 10).toFixed(2), z: +(c0.z - 6).toFixed(2) });
  // driftwood and stones: three spots a short walk from the middle, off the water and clear of the crates and the tray
  const gather = [[c0.x - 13, c0.z - 7], [c0.x + 13, c0.z - 7], [c0.x + 11, c0.z + 12], [c0.x - 14, c0.z + 4], [c0.x, c0.z - 12]]
    .filter(([x, z]) => dry(x, z)).slice(0, 3).map(([x, z]) => ({ x: +x.toFixed(2), z: +z.toFixed(2) }));
  if (!gather.length) gather.push({ x: c0.x, z: c0.z - 6 });
  return { forage, gather };
}

// a role at a finished workplace, by kind then by its skill
const ROLE_BY_KIND = { farm: 'farmer', field: 'farmer', bakery: 'baker', windmill: 'miller', woodcutter: 'woodcutter', sawmill: 'sawyer', quarry: 'quarrier', workshop: 'crafter', market: 'trader', stalls: 'stallholder', dock: 'fisher', pier: 'fisher', 'fishing-nets': 'fisher', grove: 'gardener', orchard: 'orchardist', vineyard: 'vintner', garden: 'gardener', forest: 'forester', tavern: 'host', smithy: 'smith', potter: 'potter', weaver: 'weaver', kiln: 'kiln keeper', 'olive-press': 'presser', beehives: 'beekeeper', school: 'teacher', library: 'librarian', temple: 'keeper', tower: 'lookout', assembly: 'usher' };
const ROLE_BY_SKILL = { building: 'mason', baking: 'baker', farming: 'farmer', crafting: 'crafter', trading: 'trader', diplomacy: 'envoy', art: 'artist', scouting: 'lookout' };
const article = n => (/^[aeiou]/i.test(n) ? 'an' : 'a');

export function jobLabel(game, a) {
  const { state, catalog } = game;
  if (a.status === 'left') return 'gone';
  if (a.id === state.minister) return 'minister';
  if (a.role) { const i = state.institutions.find(x => x.id === a.role.institutionId); if (i && i.status === 'active') return `${a.role.title} of the ${i.name}`; }   // ART_DIRECTION §15
  const b = a.jobId ? state.buildings.find(x => x.id === a.jobId) : null;
  if (b && b.status !== 'removed') {
    if (b.venture && b.venture.ownerId === a.id) return `keeper of the ${b.venture.title}`;
    if (b.status !== 'done') return `builder at the ${b.name} site`;
    const e = catalog.get(b.kind);
    const role = ROLE_BY_KIND[b.kind] || (e && ROLE_BY_SKILL[e.skill]) || 'worker';
    return `${role} at the ${b.name}`;
  }
  const role = a.campRole || campRoleFor(a);
  return `${role} at the camp`;
}

// a.job / a.workplaceId for the card, the snapshot and the talk mind; cheap, every JOB.refreshEvery s
export function refreshJobs(game, force = false) {
  const { state } = game;
  if (!force && state.t < (state.nextJobRefreshAt || 0)) return;
  state.nextJobRefreshAt = state.t + JOB.refreshEvery;
  for (const a of state.agents) {
    if (a.status === 'left') continue;
    if (!a.campRole) a.campRole = campRoleFor(a);
    a.job = jobLabel(game, a);
    a.workplaceId = a.jobId || null;
  }
}

// who works the camp right now: no building job, not the minister, on their feet
export const campWorkers = state => state.agents.filter(a => a.status !== 'left' && !a.jobId && !a.role && a.id !== state.minister && a.status !== 'resting' && a.status !== 'striking' && a.status !== 'meeting' && !(a.task && (a.task.kind === 'stand' || (a.task.kind === 'walk' && a.task.phase === 'formation'))));

// the camp's per-day output: each forager / gatherer by skill x mood
export function campRates(state) {
  const r = { food: 0, wood: 0, stone: 0 };
  for (const a of campWorkers(state)) {
    const role = a.campRole || campRoleFor(a);
    if (role === 'forager') r.food += JOB.campFood * workerEff(a, 'farming');
    else { const eff = workerEff(a, 'crafting'); r.wood += JOB.campWood * eff; r.stone += JOB.campStone * eff; }
  }
  for (const k of Object.keys(r)) { r[k] = +r[k].toFixed(3); if (!r[k]) delete r[k]; }
  return r;
}

// the "article + noun" the card shows: "a forager at the camp"
export const jobPhrase = a => (a.job ? `${article(a.job)} ${a.job}` : 'a helper');
