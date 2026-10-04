// Economy: days, food, production scaled by the assigned workers' skill and mood, stockpile caps,
// prosperity, stage thresholds and immigration. Every number here is a knob (see docs/sim.md).

import { STAGES } from './catalog.js';
import { avgMood, makeNewcomer } from './society.js';
import { newcomer as newcomerLetter } from './letters.js';
import { campRates } from './jobs.js';

export const ECO = {
  daySeconds: 60,
  foodPerFolk: 1,                       // eaten per folk per day
  townsfolkEat: 0.12, townsfolkWorth: 0.25,   // the townsfolk companies (society.js): small eaters, light on the prosperity headcount
  thresholds: { hamlet: 36, village: 70, town: 115, civilisation: 230 },   // a ~10 min demo with 7-8 creations (two of them landmarks) reaches town
  foodCap: 120, granaryCap: 150,        // stockpile cap for food (granaries add to it)
  resCap: 400,                          // cap for the other resources
  immigration: { chance: 0.6, mood: 60, maxPop: 40 },
  groveGrowDays: 3,                     // a grove is "grown" after this many days; woodcutters yield more then
  ungrownWoodFactor: 0.4,
  areasWeight: 0.3                      // prosperity per point of money / happiness / science (rewards.js, §22b)
};

export const RES = ['food', 'wood', 'stone', 'coin', 'goods'];

// how much one folk is worth at a job, 1.0 ≈ average skill (5), content mood
export function workerEff(agent, skill) {
  const sk = skill ? agent.skills[skill] : 5;
  return (0.55 + 0.9 * sk / 10) * (0.7 + 0.6 * agent.mood / 100);
}

export function housingTotal(state, catalog) {
  return state.buildings.filter(b => b.status === 'done').reduce((s, b) => s + ((catalog.get(b.kind) || {}).housing || 0), 0);
}
export function moodBonusTotal(state, catalog) {
  return state.buildings.filter(b => b.status === 'done').reduce((s, b) => s + ((catalog.get(b.kind) || {}).moodBonus || 0), 0);
}
export const population = state => state.agents.filter(a => a.status !== 'left').length;
export const townsfolkCount = state => state.agents.filter(a => a.status !== 'left' && a.townsfolk).length;

// workers currently effective at a building (assigned, present, not resting / striking)
function staffing(state, b, entry) {
  const present = state.agents.filter(a => a.jobId === b.id && a.status !== 'left' && a.status !== 'resting' && a.status !== 'striking' && a.status !== 'meeting');
  if (!entry.workers) return 1;
  const eff = present.reduce((s, a) => s + workerEff(a, entry.skill), 0);
  return Math.min(1.6, eff / entry.workers);
}

// per-day rates for every finished building, scaled by staffing
export function productionRates(state, catalog) {
  const rates = {};
  const groveGrown = state.buildings.some(b => b.kind === 'grove' && b.status === 'done' && (state.day - (b.doneDay || 0)) >= ECO.groveGrowDays);
  for (const b of state.buildings) {
    if (b.status !== 'done') continue;
    const e = catalog.get(b.kind); if (!e || !Object.keys(e.perDay).length) continue;
    const f = staffing(state, b, e);
    const r = {};
    for (const [k, v] of Object.entries(e.perDay)) {
      let val = v * (v < 0 ? Math.min(1, f) : f);
      if (b.kind === 'woodcutter' && !groveGrown) val *= ECO.ungrownWoodFactor;
      r[k] = val;
    }
    rates[b.id] = r;
  }
  // the camp: foragers and gatherers (everyone without a building job) bring a trickle of food, wood and stone
  const camp = campRates(state);
  if (Object.keys(camp).length) rates.camp = camp;
  return rates;
}

export function foodCap(state) {
  return ECO.foodCap + state.buildings.filter(b => b.kind === 'granary' && b.status === 'done').length * ECO.granaryCap;
}

export function stepEconomy(game, dt) {
  const { state, catalog } = game;
  const acc = state.acc;
  const perDay = dt / ECO.daySeconds;
  const rates = productionRates(state, catalog);
  state.rates = rates;
  for (const r of Object.values(rates)) {
    // inputs gate outputs: a bakery with no wood bakes nothing
    const inputsOk = Object.entries(r).every(([k, v]) => v >= 0 || state.resources[k] + acc[k] > 0);
    if (!inputsOk) continue;
    for (const [k, v] of Object.entries(r)) acc[k] += v * perDay;
  }
  acc.food -= (population(state) - townsfolkCount(state) * (1 - ECO.townsfolkEat)) * ECO.foodPerFolk * perDay;
  let changed = false;
  for (const k of RES) {
    const whole = acc[k] > 0 ? Math.floor(acc[k]) : Math.ceil(acc[k]);
    if (whole !== 0) {
      acc[k] -= whole;
      const cap = k === 'food' ? foodCap(state) : ECO.resCap;
      const before = state.resources[k];
      state.resources[k] = Math.max(0, Math.min(cap, state.resources[k] + whole));
      if (state.resources[k] !== before) changed = true;
    }
  }
  if (state.resources.food <= 0 && acc.food < 0) acc.food = 0;   // nothing left to eat: hunger is a mood effect, not debt
  state.hungry = state.resources.food <= 0;
  if (changed) game.emit('resources', { resources: { ...state.resources } });
}

export function computeProsperity(state, catalog) {
  let p = 0;
  for (const b of state.buildings) if (b.status === 'done') p += (catalog.get(b.kind) || {}).value || 4;
  const pop = population(state);
  const housed = state.agents.filter(a => a.status !== 'left' && a.homeId).length;
  p += pop - townsfolkCount(state) * (1 - ECO.townsfolkWorth);   // a company of townsfolk counts lightly: the stages keep their pace
  p += pop ? (housed / pop) * 10 : 0;
  p += avgMood(state.agents) / 10;
  p += state.resources.goods * 0.5 + state.resources.coin * 0.3;
  p += state.neighbours.filter(n => n.allied).length * 8;
  p += state.story ? (state.story.returned ? 20 : 0) + (state.story.elected ? 6 : 0) : 0;   // the envoy's standing
  // ART_DIRECTION §22b: the headline comes from the four areas too (civ is the value sum above already; the rest weigh in lightly)
  if (state.areas) p += ((state.areas.money || 0) + (state.areas.happiness || 0) + (state.areas.science || 0)) * ECO.areasWeight;
  return Math.round(p);
}

export function stageFor(prosperity) {
  let s = 'camp';
  for (const st of STAGES.slice(1)) if (prosperity >= ECO.thresholds[st]) s = st;
  return s;
}
export function nextStageInfo(prosperity, stage) {
  const i = STAGES.indexOf(stage);
  const next = STAGES[i + 1];
  return next ? { next, need: ECO.thresholds[next] - prosperity } : { next: null, need: 0 };
}

// once per day: immigration and anything else that happens at dawn
export function dailyEconomy(game) {
  const { state, catalog, rng } = game;
  const housing = housingTotal(state, catalog);
  const pop = population(state);
  const free = housing - pop;
  const mood = avgMood(state.agents);
  if (free >= 1 && mood >= ECO.immigration.mood && state.resources.food >= pop && pop < ECO.immigration.maxPop && rng.chance(ECO.immigration.chance)) {
    const a = makeNewcomer(rng, state.agents, state.spawn);
    state.agents.push(a);
    if (game.onNewcomer) game.onNewcomer(a);   // a fleet, a camp role, a job label
    game.emit('agent:spawn', { agent: a });
    game.log(`${a.name} the ${a.species} arrived, drawn by the lights.`);
    game.sendLetter(newcomerLetter(rng, { agent: a, day: state.day, settlement: state.name, housingFree: free }));
    game.emit('toast', { text: `${a.name} has arrived` });
  }
}

// re-home folk: fill houses with the homeless, prefer keeping existing homes
export function assignHomes(state, catalog) {
  const homes = state.buildings.filter(b => b.status === 'done' && (catalog.get(b.kind) || {}).housing > 0);
  const cap = new Map(homes.map(h => [h.id, catalog.get(h.kind).housing]));
  for (const a of state.agents) {
    if (a.status === 'left') { a.homeId = null; continue; }
    if (a.homeId && cap.has(a.homeId) && cap.get(a.homeId) > 0) cap.set(a.homeId, cap.get(a.homeId) - 1); else a.homeId = null;
  }
  for (const a of state.agents) {
    if (a.status === 'left' || a.homeId) continue;
    const h = homes.find(h => cap.get(h.id) > 0);
    if (h) { a.homeId = h.id; cap.set(h.id, cap.get(h.id) - 1); }
  }
}
