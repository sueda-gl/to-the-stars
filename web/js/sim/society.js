// Folk: seeded generation, willingness, mood / loyalty / energy dynamics, strikes and leaving.
// Pure data in, events out. All numbers live in BAL so they can be tuned in one place.

// ART_DIRECTION §7: our people are ONLY the two fliers of the Red arch reference. Flits (round pistachio-green folk with
// propeller caps) and floaties (marshmallow folk in striped bathing suits under beach parasols). They walk for work and
// fly to travel. The other five species are the neighbouring nations' peoples (envoys, visitors, traders), never settlers.
export const OUR_SPECIES = ['flit', 'floatie'];
export const NEIGHBOUR_SPECIES = ['loaf', 'drop', 'puffer', 'pip', 'scoot'];
export const ALL_SPECIES = [...OUR_SPECIES, ...NEIGHBOUR_SPECIES];
export const SPECIES = OUR_SPECIES;   // what the settlement is made of (makeFolk's default pick, newcomers)
export const isOurs = s => OUR_SPECIES.includes(s);
// Sueda, 2026-10-04: "more agents in the population, especially different types": the TOWNSFOLK join the settlement as
// companies of one species (loaves, twinkles, glims, moths: agents/species-extra.js draws them). createGame({ townsfolk: n })
// adds n of each; they are settlers in every way (jobs, moods, minds) but march, work and stand in their own company.
export const TOWNSFOLK_SPECIES = ['loaf', 'twinkle', 'glim', 'moth'];
export const SKILLS = ['building', 'baking', 'farming', 'crafting', 'trading', 'diplomacy', 'art', 'scouting'];
export const TRAITS = ['proud', 'lazy', 'loyal', 'gossip', 'ambitious', 'timid', 'generous', 'stubborn'];

// plurals for letters: "our flits", "the loaves of Little Lantern"
const PLURAL = { loaf: 'loaves', flit: 'flits', floatie: 'floaties', drop: 'drops', puffer: 'puffers', pip: 'pips', scoot: 'scoots', twinkle: 'twinkles', glim: 'glims', moth: 'moths' };
export const plural = s => PLURAL[s] || (s ? s + 's' : 'folk');
// how a nation's people are called: its peoples (n.peoples) or its leader's species
export const peopleOf = n => n && n.peoples && n.peoples.length ? plural(n.peoples[0]) : n && n.leaderSpecies ? plural(n.leaderSpecies) : 'folk';
// a word of flavour for our two: how they travel
export const FLIGHT = { flit: 'wound up the propeller cap', floatie: 'let the wind take the parasol' };

// species leaning: the skill they tend to be good at, and the trade name they introduce themselves with.
// Our two lean only softly (`soft`): both flits and floaties hold any trade, individuals vary; the roster in
// generateSettlers decides the demo's spread of trades, not the species. The neighbours' species keep firm leanings
// (an envoy from the Loaf Republic is a baker at heart).
export const LEANING = {
  puffer:  { skill: 'building',  trade: 'builder',   alt: 'crafting' },
  loaf:    { skill: 'baking',    trade: 'baker',     alt: 'farming' },
  pip:     { skill: 'farming',   trade: 'farmer',    alt: 'building' },
  scoot:   { skill: 'trading',   trade: 'courier',   alt: 'scouting' },
  drop:    { skill: 'diplomacy', trade: 'diplomat',  alt: 'art' },
  flit:    { skill: 'scouting',  trade: 'scout',     alt: 'trading',   soft: true },
  floatie: { skill: 'art',       trade: 'dreamer',   alt: 'diplomacy', soft: true },
  twinkle: { skill: 'art',       trade: 'artist',    alt: 'diplomacy' },
  glim:    { skill: 'crafting',  trade: 'crafter',   alt: 'building' },
  moth:    { skill: 'scouting',  trade: 'courier',   alt: 'trading' }
};
const TRADE_OF_SKILL = { building: 'builder', baking: 'baker', farming: 'farmer', crafting: 'crafter', trading: 'trader', diplomacy: 'diplomat', art: 'artist', scouting: 'scout' };
export const tradeOf = (species, skill) => { const lean = LEANING[species]; return lean && lean.skill === skill ? lean.trade : TRADE_OF_SKILL[skill] || skill; };
// the twelve settlers' main skills: three builders, two bakers, two farmers, a diplomat (Olla), a scout (the courier),
// a trader, an artist and a crafter, dealt to flits and floaties alike
const SETTLER_SKILLS = ['building', 'building', 'building', 'baking', 'baking', 'farming', 'farming', 'diplomacy', 'scouting', 'trading', 'art', 'crafting'];

export const NAMES = [
  'Olla', 'Pim', 'Tomasso', 'Nonna Bri', 'Fig', 'Lulo', 'Marzi', 'Bibi', 'Cosimo', 'Nerina', 'Pepe', 'Zia Rosa',
  'Teo', 'Momo', 'Dado', 'Vela', 'Ciro', 'Lilo', 'Sorbetto', 'Nino', 'Orsola', 'Tulli', 'Gigi', 'Pina',
  'Rocco', 'Mimmo', 'Fiora', 'Bruno', 'Ambra', 'Luce', 'Dino', 'Zazà', 'Ottavia', 'Pippo', 'Cece', 'Nando',
  'Brina', 'Ugo', 'Mirto', 'Lupa', 'Sole', 'Fusco', 'Tilde', 'Bimba', 'Corvo', 'Nuvola', 'Pesca', 'Gelso',
  'Alba', 'Remo', 'Biscotto', 'Vespa', 'Lina', 'Pomodoro', 'Isola', 'Tazza', 'Nocciola', 'Ferro', 'Melo', 'Zita'
];

export const BAL = {
  moodBase: 65,            // where mood drifts when fed, housed and not overworked
  moodDrift: 4,            // per day toward the base
  hungerMood: -10,         // per day while there is no food
  hungerFloor: 30,         // hunger alone never pushes mood below this (above strikeMood): an unfed town sulks and writes, it does not strike or empty
  homelessMood: -4,        // per day without a home
  overworkMood: -6,        // per day while working at energy < 10
  strikeMood: 25, strikeLoyalty: 45, strikeEnd: 42,
  leaveMood: 10, leaveLoyalty: 20, leaveSeconds: 90,   // leaving needs a broken heart AND no loyalty left, for a while
  noLeaveBefore: 900,      // and never in the first 15 minutes: the demo keeps every folk
  energyWork: -0.35, energyRest: 1.2, energyIdle: 0.25, energyWalk: -0.1,   // per second
  restBelow: 15, restUntil: 65,
  loyaltyHappy: 1.5, loyaltyUnhappy: -2.5, // per day when mood > 60 / < 35
  willingThreshold: 0.35
};

export const moodBand = m => m >= 80 ? 'joyful' : m >= 60 ? 'content' : m >= 40 ? 'uneasy' : m >= 20 ? 'unhappy' : 'furious';

let nextId = 1;
export const resetIds = () => { nextId = 1; };   // legacy: ids now come from rng.seq (per game); the fallback counter is only for rngs without seq

// ---- generation ----
// makeFolk(rng, { species, skill, name, x, z, cast }): species defaults to one of ours; `skill` fixes the main skill
// (the trade follows it), else it is rolled: our species lean only softly (30 % the leaning, 15 % its alt, the rest
// any trade), a neighbour's species firmly (72 / 18 / 10)
export function makeFolk(rng, { species, skill = null, name, x = 0, z = 0, cast } = {}) {
  species = species || rng.pick(SPECIES);
  const lean = LEANING[species] || LEANING.flit;
  const skills = {};
  for (const s of SKILLS) skills[s] = rng.int(0, 5);
  // individuals vary: most follow the species leaning, some are surprising
  const roll = rng.next();
  const [p1, p2] = lean.soft ? [0.3, 0.45] : [0.72, 0.9];
  const main = skill || (roll < p1 ? lean.skill : roll < p2 ? lean.alt : rng.pick(SKILLS.filter(s => s !== lean.skill)));
  skills[main] = rng.int(6, 10);
  const second = rng.pick(SKILLS.filter(s => s !== main));
  skills[second] = Math.max(skills[second], rng.int(4, 7));
  const traits = rng.shuffle(TRAITS).slice(0, rng.chance(0.55) ? 2 : 1);
  const id = rng.seq ? rng.seq('f') : 'f' + (nextId++);
  const a = {
    id, name: name || rng.pick(NAMES), species, trade: tradeOf(species, main),
    skills, known: {}, claims: {}, traits,
    mood: rng.int(58, 78), loyalty: rng.int(45, 70), energy: rng.int(60, 100),
    homeId: null, jobId: null, task: null, x, z, status: 'idle',
    moodAcc: 0, moodReason: '', lowSince: null, flags: {}
  };
  if (cast) Object.assign(a, cast);
  return a;
}

// 12 settlers, flits and floaties only, about half each, the trades dealt from SETTLER_SKILLS (≥3 builders so
// building works, 2 bakers for "who's good at baking?", a scout to carry letters). Olla is always among them, the
// settler with the best diplomacy: the demo names her minister.
export function generateSettlers(rng, { count = 12, spawn = { x: 0, z: 8 } } = {}) {
  const roster = [];
  for (let i = 0; i < count; i++) roster.push(OUR_SPECIES[i % OUR_SPECIES.length]);
  const species = rng.shuffle(roster);
  const mains = rng.shuffle(SETTLER_SKILLS);
  while (mains.length < count) mains.push(rng.pick(SKILLS));
  const names = rng.shuffle(NAMES.filter(n => n !== 'Olla')).slice(0, count);
  const folk = species.map((sp, i) => {
    const ang = (i / count) * Math.PI * 2, r = 2.5 + rng.range(0, 2.5);
    return makeFolk(rng, { species: sp, skill: mains[i], name: names[i], x: +(spawn.x + Math.cos(ang) * r).toFixed(2), z: +(spawn.z + Math.sin(ang) * r).toFixed(2) });
  });
  // Olla: the best diplomat (flit or floatie), so "make Olla our minister" is a good call
  const olla = folk.slice().sort((a, b) => b.skills.diplomacy - a.skills.diplomacy)[0];
  olla.name = 'Olla';
  olla.skills.diplomacy = Math.max(olla.skills.diplomacy, 8);
  olla.trade = 'diplomat';
  olla.traits = olla.traits.map(t => t === 'timid' ? 'generous' : t === 'lazy' ? 'loyal' : t);
  if (olla.traits.length === 2 && olla.traits[0] === olla.traits[1]) olla.traits = [olla.traits[0], 'gossip'];
  // make sure someone bakes well (demo: "who's good at baking?" wants 2-3 answers)
  const bakers = folk.filter(f => f.skills.baking >= 6);
  if (bakers.length < 2) { const f = folk.find(f => f.skills.baking < 6 && f !== olla); if (f) f.skills.baking = rng.int(7, 9); }
  return folk;
}

// the townsfolk companies: `per` of each species, names not yet taken, standing by the spawn; each folk carries
// townsfolk: true and company: its species (fleets.js forms one square per company)
export function generateTownsfolk(rng, taken, { per = 9, spawn = { x: 0, z: 8 }, species = TOWNSFOLK_SPECIES } = {}) {
  const used = new Set(taken.map(f => f.name)), out = [];
  const free = () => { const pool = NAMES.filter(n => !used.has(n)); const n = pool.length ? rng.pick(pool) : rng.pick(NAMES) + ' ' + (out.length + 2); used.add(n); return n; };
  species.forEach((sp, k) => { for (let i = 0; i < per; i++) {
    const a = makeFolk(rng, { species: sp, name: free(), x: +(spawn.x + (k - 1.5) * 3 + rng.range(-1, 1)).toFixed(2), z: +(spawn.z + 3 + rng.range(-1, 1)).toFixed(2) });
    a.townsfolk = true; a.company = sp; out.push(a);
  } });
  return out;
}

// what each folk is best at (their main skill)
export const mainSkill = a => Object.entries(a.skills).sort((p, q) => q[1] - p[1])[0][0];

// a newcomer: always a flit or a floatie (whichever we have fewer of), with a trade weighted toward what the
// settlement lacks (few builders → likely a builder)
export function makeNewcomer(rng, folk, spawn) {
  const alive = folk.filter(f => f.status !== 'left');
  const counts = {}; for (const s of OUR_SPECIES) counts[s] = 0;
  for (const f of alive) if (counts[f.species] != null) counts[f.species]++;
  const fewest = Math.min(...OUR_SPECIES.map(s => counts[s]));
  const species = rng.pick(OUR_SPECIES.filter(s => counts[s] === fewest));
  const have = {}; for (const s of SKILLS) have[s] = 0;
  for (const f of alive) have[mainSkill(f)]++;
  const pool = SKILLS.flatMap(s => Array(Math.max(1, 3 - have[s])).fill(s));
  const used = new Set(folk.map(f => f.name));
  const free = NAMES.filter(n => !used.has(n));
  return makeFolk(rng, { species, skill: rng.pick(pool), name: free.length ? rng.pick(free) : rng.pick(NAMES) + ' II', x: spawn.x + rng.range(-3, 3), z: spawn.z + rng.range(-2, 2) });
}

// who carries letters and gifts: the scout / courier by trade first, then the idle folk who scouts best, then the
// best scout of anyone who `can`. Every flit and floatie flies, so there is always a courier when anyone is free.
// `near` (the tray, the plot edge): with it, the scout still goes first unless another free folk is 12+ units closer
export function pickCourier(agents, can, near = null) {
  const pool = agents.filter(can);
  if (!pool.length) return null;
  if (near) {
    const score = a => Math.hypot(a.x - near.x, a.z - near.z) - (a.trade === 'scout' || a.trade === 'courier' ? 12 : 0) - (a.jobId ? -4 : 0) - a.skills.scouting * 0.4;
    return pool.slice().sort((p, q) => score(p) - score(q))[0];
  }
  const byTrade = pool.filter(a => a.trade === 'scout' || a.trade === 'courier').sort((p, q) => q.skills.scouting - p.skills.scouting);
  if (byTrade.length) return byTrade[0];
  const idle = pool.filter(a => !a.jobId).sort((p, q) => q.skills.scouting - p.skills.scouting);
  if (idle.length) return idle[0];
  return pool.slice().sort((p, q) => q.skills.scouting - p.skills.scouting)[0];
}

// ---- willingness ----
// task: { kind:'build'|'work'|'haul'|'deliver'|'meeting'|'rest'|'assign', skill?, buildingKind?, buildingId?, day? }
export function willing(agent, task, rng, ctx = {}) {
  if (agent.status === 'left') return { yes: false, why: 'is gone', score: -1 };
  if (task.kind === 'rest') return { yes: true, why: 'gladly', score: 1 };
  if (agent.status === 'striking') return { yes: false, why: `${agent.name} is on strike and will not lift a finger until things change`, score: -1 };
  const reasons = [];
  let s = 0.5;
  s += (agent.mood - 50) / 100 * 0.7;
  s += (agent.energy - 50) / 100 * 0.4;
  s += (agent.loyalty - 50) / 100 * 0.3;
  let fit = 0;
  if (task.skill) { fit = (agent.skills[task.skill] - 5) / 10; s += fit * 0.5; }
  const T = agent.traits;
  if (T.includes('lazy')) s -= 0.25;
  if (T.includes('loyal')) s += 0.2;
  if (T.includes('ambitious') && (task.kind === 'build' || task.kind === 'meeting')) s += 0.12;
  if (T.includes('stubborn') && fit < -0.15) s -= 0.3;
  if (T.includes('timid') && (task.kind === 'deliver' || task.kind === 'meeting')) s -= 0.1;
  if (T.includes('generous')) s += 0.08;
  if (ctx.hungry) s -= 0.15;
  if (ctx.homeless) s -= 0.05;
  const jit = rng ? rng.jitter(`${agent.id}|${task.kind}|${task.buildingId || task.skill || ''}|${task.day || 0}`) * 0.1 : 0;
  s += jit;

  // reasons, most pressing first
  if (agent.energy < 20) reasons.push('too tired to stand, let alone work');
  if (ctx.hungry) reasons.push('has had nothing to eat');
  if (agent.mood < 30) reasons.push('is in a black mood');
  if (agent.loyalty < 25) reasons.push('does not see why this place deserves the effort');
  if (task.skill && fit < -0.2 && T.includes('stubborn')) reasons.push(`says ${task.skill} is not ${agent.name}'s craft and never will be`);
  if (task.skill && fit < -0.2 && !T.includes('stubborn')) reasons.push(`is no good at ${task.skill} and knows it`);
  if (T.includes('lazy')) reasons.push('would really rather not');
  if (ctx.homeless) reasons.push('is still sleeping under the stars');
  // hard gates: the exhausted and the furious do not negotiate
  const gated = agent.energy < 20 || agent.mood < 20 || agent.loyalty < 12;
  const yes = !gated && s >= BAL.willingThreshold;
  return { yes, score: +s.toFixed(3), why: yes ? (fit > 0.2 ? 'this is the kind of work ' + agent.name + ' loves' : 'is willing') : (reasons[0] || 'has a bad feeling about it') };
}

// ---- dynamics (called every tick) ----
export function stepFolk(state, dt, ctx, emit, rng) {
  const perDay = dt / 60;
  const housingFree = ctx.housingFree;
  for (const a of state.agents) {
    if (a.status === 'left') continue;
    const working = a.status === 'working' || a.status === 'hauling';
    const walking = a.status === 'walking' || a.status === 'delivering';
    // energy
    if (a.status === 'resting') a.energy += BAL.energyRest * dt;
    else if (working) a.energy += BAL.energyWork * dt;
    else if (walking) a.energy += BAL.energyWalk * dt;
    else a.energy += BAL.energyIdle * dt;
    a.energy = Math.max(0, Math.min(100, a.energy));
    // mood
    let d = 0, why = '';
    if (ctx.hungry) { d += BAL.hungerMood * perDay; why = 'hungry'; }
    if (!a.homeId) { d += BAL.homelessMood * perDay; why = why || 'no home'; }
    if (working && a.energy < 10) { d += BAL.overworkMood * perDay; why = why || 'overworked'; }
    // while the crates are empty the drift toward the base is off, so misery is floored: an unfed town sulks and
    // strikes, it does not empty. Events (a refusal snubbed, a lost seal, a "no") can still push below the floor.
    if (ctx.hungry && d < 0) d = Math.max(d, Math.min(0, BAL.hungerFloor - a.mood));
    const base = Math.min(96, BAL.moodBase + ctx.moodBonus);
    if (!ctx.hungry) { const pull = Math.sign(base - a.mood) * Math.min(Math.abs(base - a.mood), BAL.moodDrift * perDay); d += pull; if (!why) why = pull > 0 ? 'settling in' : 'restless'; }
    nudgeMood(a, d, why, emit, true);
    // loyalty follows mood slowly
    if (a.mood > 60) a.loyalty += BAL.loyaltyHappy * perDay; else if (a.mood < 35) a.loyalty += BAL.loyaltyUnhappy * perDay;
    a.loyalty = Math.max(0, Math.min(100, a.loyalty));
    // strikes
    if (a.status !== 'striking' && a.mood < BAL.strikeMood && a.loyalty < BAL.strikeLoyalty && !a.flags.struck) {
      a.flags.struck = true; a.flags.strikeDay = state.day;
      ctx.onStrike && ctx.onStrike(a);
    } else if (a.status === 'striking' && a.mood >= BAL.strikeEnd) {
      a.flags.struck = false; ctx.onStrikeEnd && ctx.onStrikeEnd(a);
    }
    // leaving
    if (a.mood < BAL.leaveMood && a.loyalty < BAL.leaveLoyalty && state.t >= BAL.noLeaveBefore) { if (a.lowSince == null) a.lowSince = state.t; else if (state.t - a.lowSince > BAL.leaveSeconds && !a.flags.leaving) { a.flags.leaving = true; ctx.onLeave && ctx.onLeave(a); } }
    else a.lowSince = null;
  }
}

// mood change with throttled agent:mood events (quiet drift accumulates until ±5)
export function nudgeMood(a, delta, reason, emit, quiet = false) {
  if (!delta) return;
  a.mood = Math.max(0, Math.min(100, a.mood + delta));
  a.moodAcc += delta;
  if (reason) a.moodReason = reason;
  if (!quiet || Math.abs(a.moodAcc) >= 5) {
    emit && emit('agent:mood', { agentId: a.id, mood: Math.round(a.mood), delta: +a.moodAcc.toFixed(1), reason: a.moodReason });
    a.moodAcc = 0;
  }
}

// who answers "who is good at X?" and what they claim. Proud over-claim, timid under-claim, gossips answer anyway.
export function crowdAnswers(agents, skill, rng, max = 3) {
  const alive = agents.filter(a => a.status !== 'left');
  const scored = alive.map(a => {
    const real = skill ? a.skills[skill] : Math.max(...Object.values(a.skills));
    let eager = real / 10;
    if (a.traits.includes('proud')) eager += 0.35;
    if (a.traits.includes('gossip')) eager += 0.25;
    if (a.traits.includes('ambitious')) eager += 0.15;
    if (a.traits.includes('timid')) eager -= 0.3;
    if (a.status === 'striking') eager -= 0.5;
    eager += rng.range(-0.08, 0.08);
    return { a, real, eager };
  }).sort((p, q) => q.eager - p.eager);
  const n = Math.max(1, Math.min(max, scored.filter(s => s.eager > 0.45).length || 1));
  return scored.slice(0, n).map(({ a, real }) => {
    let claimed = real, tone = 'honest';
    if (a.traits.includes('proud')) { claimed = Math.min(10, real + rng.int(2, 4)); tone = 'proud'; }
    else if (a.traits.includes('timid')) { claimed = Math.max(0, real - rng.int(2, 3)); tone = 'timid'; }
    else claimed = Math.max(0, Math.min(10, real + rng.int(-1, 1)));
    return { agent: a, skill: skill || Object.entries(a.skills).sort((x, y) => y[1] - x[1])[0][0], real, claimed, tone };
  });
}

export const avgMood = agents => { const l = agents.filter(a => a.status !== 'left'); return l.length ? l.reduce((s, a) => s + a.mood, 0) / l.length : 0; };
