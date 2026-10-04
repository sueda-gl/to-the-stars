// Rewards (ART_DIRECTION §22 / §22b): every creation gives something back, in four areas and no more:
//   money      (coin)              markets, workshops, smithy, quarry, mill, dock, farms / fields / animals, trade
//   happiness  (smiling lantern)   houses, huts, plazas, gardens, fountains, taverns, temples, statues, festivals
//   science    (telescope / flask) school, library, observatory, windmill / engineering, lighthouse; novel AI-designed things
//   civ        (rising banner)     every creation adds progress; level-ups (camp → hamlet → …) are the big moment
// The table below names every catalogue id and every starter-library prefab (web/js/buildings/prefabs/manifest.js) plus the
// area fills (field / forest / garden / plaza / vineyard …), the line kinds (road / wall / fence / river) and the institutions.
// A generated thing is classified by meaning: the codegen meta's optional `areas` wins, else the words of its name / request
// / aliases / desc, else its category. Civ comes from the entry's prosperity `value`, so the civ tally is literally the
// progress toward the next level. Nothing here blocks or costs anything: a reward is always a gift.

export const AREAS = ['money', 'happiness', 'science', 'civ'];
export const AREA_META = {
  money:     { label: 'Money',     icon: 'coin',      colour: '#d9a441' },
  happiness: { label: 'Happiness', icon: 'lantern',   colour: '#e39a8c' },
  science:   { label: 'Science',   icon: 'telescope', colour: '#5f9ea0' },
  civ:       { label: 'Civ',       icon: 'banner',    colour: '#e0503f' }
};

export const REWARD = {
  milestones: [10, 25, 50, 100, 200],   // money / happiness / science; civ's milestones are the level-ups
  maxPerArea: 8,                         // one creation never gives more than this in one area
  civFromValue: 0.5, civMin: 1, civMax: 15,   // civ gain = value × civFromValue, clamped
  novelScience: 1,                       // "we learned to build it": the first of a generated kind
  areaPerM2: 1 / 80, areaBonusMax: 3,    // a drawn outline: +1 to the main area per 80 m², at most +3
  linePerM: 1 / 20, lineBonusMax: 2,     // a drawn stroke: +1 per 20 m, at most +2
  prosperityWeight: 0.3,                 // money + happiness + science feed the prosperity headline this much per point
  institutionCiv: 3
};

// money / happiness / science per id; civ is derived from the catalogue value (see gainsFor)
const M = (money, happiness, science) => { const o = {}; if (money) o.money = money; if (happiness) o.happiness = happiness; if (science) o.science = science; return o; };
export const REWARD_TABLE = {
  // ---- the fixed catalogue (sim/catalog.js) ----
  house: M(0, 3, 0), hut: M(0, 2, 0), well: M(1, 1, 0), farm: M(3, 0, 0), windmill: M(2, 0, 2), bakery: M(2, 1, 0), granary: M(2, 0, 0),
  woodcutter: M(2, 0, 0), grove: M(1, 1, 0), quarry: M(3, 0, 0), workshop: M(3, 0, 1), market: M(4, 0, 0), dock: M(3, 0, 0), fountain: M(0, 3, 0),
  tavern: M(1, 3, 0), temple: M(0, 4, 0), tower: M(0, 1, 1), bridge: M(1, 0, 2), road: M(1, 0, 0), garden: M(0, 3, 0), assembly: M(0, 4, 2),
  // area fills and line kinds (ART_DIRECTION §5)
  field: M(3, 0, 0), forest: M(1, 1, 0), orchard: M(2, 1, 0), vineyard: M(2, 1, 0), plaza: M(0, 4, 0), wall: M(0, 0, 1), fence: M(1, 0, 0), river: M(0, 2, 0),
  // ---- the starter library (prefabs/manifest.js) ----
  amphitheatre: M(0, 5, 1), aqueduct: M(1, 0, 3), barn: M(2, 0, 0), bathhouse: M(0, 4, 0), 'beach-rocks': M(0, 1, 0), beehives: M(2, 0, 0),
  'berry-bushes': M(1, 1, 0), boulders: M(0, 1, 0), campanile: M(0, 3, 1), campfire: M(0, 2, 0), canoe: M(1, 1, 0), cart: M(1, 0, 0), charcoal: M(2, 0, 0),
  'chicken-coop': M(2, 0, 0), 'cliff-stones': M(0, 1, 0), copse: M(0, 1, 0), 'cow-pasture': M(3, 0, 0), crag: M(0, 1, 0), crane: M(2, 0, 2),
  'cypress-row': M(0, 1, 0), dovecote: M(1, 1, 0), 'drying-rack': M(1, 0, 0), 'duck-pond': M(0, 2, 0), 'dune-grass': M(0, 1, 0), 'fallen-log': M(0, 1, 0),
  firewood: M(1, 0, 0), 'fishing-nets': M(2, 0, 0), 'flower-meadow': M(0, 3, 0), footbridge: M(1, 0, 1), gazebo: M(0, 2, 0), 'goat-pen': M(2, 0, 0),
  haystacks: M(1, 0, 0), 'hearth-ring': M(0, 1, 0), 'horse-stable': M(2, 1, 0), 'irrigation-ditch': M(2, 0, 1), kiln: M(2, 0, 1), 'lavender-field': M(1, 2, 0),
  'lean-to': M(0, 1, 0), library: M(0, 1, 4), meadow: M(0, 2, 0), obelisk: M(0, 2, 1), observatory: M(0, 1, 4), 'olive-grove': M(2, 1, 0), 'olive-pair': M(0, 1, 0),
  'olive-press': M(3, 0, 0), 'palisade-gate': M(0, 1, 0), piazza: M(0, 4, 0), pier: M(3, 0, 0), 'pig-sty': M(2, 0, 0), 'pine-stand': M(0, 1, 0), pond: M(0, 2, 0),
  potter: M(2, 0, 1), 'pumpkin-patch': M(2, 0, 0), reeds: M(0, 1, 0), sawmill: M(3, 0, 1), school: M(0, 1, 4), 'sheep-pen': M(2, 0, 0), shipyard: M(3, 0, 2),
  signpost: M(1, 0, 0), smithy: M(3, 0, 1), stalls: M(3, 0, 0), 'standing-stones': M(0, 2, 1), statue: M(0, 3, 0), stonemason: M(2, 0, 1), 'stream-stones': M(0, 1, 0),
  'sunflower-field': M(2, 1, 0), 'supply-pile': M(1, 0, 0), tent: M(0, 1, 0), 'town-hall': M(0, 3, 2), 'town-wall': M(0, 0, 1), trail: M(1, 0, 0),
  'vegetable-patch': M(2, 0, 0), 'wall-tower': M(0, 0, 1), warehouse: M(3, 0, 0), watchtower: M(0, 0, 1), 'water-trough': M(1, 0, 0), weaver: M(2, 0, 1), 'wheat-field': M(3, 0, 0)
};
// institutions (ART_DIRECTION §15 / §20): a real group of folk is a creation too
export const INSTITUTION_REWARDS = {
  patrol: M(0, 2, 0), watch: M(0, 1, 1), court: M(0, 2, 1), school: M(0, 1, 3), guild: M(2, 0, 1), festival: M(0, 4, 0), generic: M(0, 1, 0)
};

// words that say what a generated thing is for (a lighthouse: science; a rubber duck: happiness; a tannery: money)
const WORDS = {
  money: ['market', 'shop', 'stall', 'bazaar', 'trade', 'trader', 'trading', 'merchant', 'workshop', 'smith', 'smithy', 'forge', 'quarry', 'mine', 'mill', 'dock', 'pier', 'harbour', 'harbor', 'port', 'wharf', 'farm', 'field', 'barn', 'cattle', 'cow', 'ox', 'sheep', 'goat', 'pig', 'chicken', 'hen', 'fish', 'fishing', 'fisherman', 'orchard', 'vineyard', 'winery', 'brewery', 'dairy', 'crop', 'wheat', 'grain', 'granary', 'warehouse', 'bank', 'mint', 'coin', 'gold', 'silver', 'bakery', 'press', 'kiln', 'tannery', 'loom', 'sawmill', 'lumber', 'timber', 'shipyard', 'boat', 'ship', 'galleon', 'barge', 'caravan', 'cart', 'wagon', 'silo', 'store', 'storehouse', 'tavern', 'inn', 'ferry', 'salt', 'oil', 'beehive', 'hive', 'honey'],
  happiness: ['house', 'hut', 'home', 'cottage', 'villa', 'plaza', 'square', 'piazza', 'garden', 'park', 'fountain', 'tavern', 'inn', 'pub', 'cafe', 'tea', 'temple', 'shrine', 'chapel', 'church', 'statue', 'monument', 'festival', 'fair', 'theatre', 'theater', 'amphitheatre', 'amphitheater', 'arena', 'bath', 'bathhouse', 'pool', 'playground', 'swing', 'duck', 'toy', 'rubber', 'flower', 'tree', 'pond', 'bench', 'lantern', 'music', 'dance', 'carousel', 'ferris', 'circus', 'kite', 'balloon', 'cat', 'dog', 'bunny', 'rabbit', 'unicorn', 'dragon', 'castle', 'palace', 'pavilion', 'gazebo', 'beach', 'picnic', 'cake', 'pie', 'ice', 'cream', 'snowman', 'swan', 'whale', 'dolphin', 'bird', 'owl', 'frog', 'turtle', 'elephant', 'giraffe', 'lion', 'bear', 'teapot', 'mushroom', 'hat', 'piano', 'guitar', 'drum', 'bell', 'flag', 'parasol', 'umbrella', 'hammock', 'fire', 'campfire', 'bonfire', 'wonder', 'pyramid', 'arch', 'totem', 'mausoleum', 'cathedral', 'pagoda', 'minaret', 'dome', 'spire', 'colossus', 'giant'],
  science: ['school', 'library', 'observatory', 'telescope', 'academy', 'university', 'college', 'lab', 'laboratory', 'windmill', 'engine', 'engineering', 'machine', 'clock', 'clocktower', 'lighthouse', 'beacon', 'aqueduct', 'bridge', 'crane', 'rocket', 'airship', 'zeppelin', 'printing', 'scroll', 'book', 'books', 'map', 'compass', 'astrolabe', 'sundial', 'alchemy', 'alchemist', 'flask', 'star', 'moon', 'planet', 'dam', 'canal', 'waterwheel', 'pump', 'tower', 'watchtower', 'armillary', 'globe', 'robot', 'automaton', 'submarine', 'scholar', 'archive', 'museum', 'workshop', 'forge', 'furnace', 'glassworks', 'wheel']
};
const SIZE_BY_CATEGORY = { landmark: 3, building: 2, prop: 2, nature: 2, farm: 2, animal: 2 };
const BASE_BY_CATEGORY = { landmark: M(0, 3, 1), building: M(2, 0, 0), prop: M(0, 1, 0), nature: M(0, 1, 0), farm: M(2, 0, 0), animal: M(2, 0, 0) };

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const wordsOf = s => String(s || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(' ').filter(Boolean)
  .map(w => w.length > 3 && /s$/.test(w) && !/ss$/.test(w) ? w.slice(0, -1) : w);

// money / happiness / science from words + a category (the generated path). Exported for the tests and the UI's preview.
export function classifyWords(text, category = 'building') {
  const ws = wordsOf(text);
  const head = ws[ws.length - 1];
  const hits = { money: 0, happiness: 0, science: 0 };
  for (const w of ws) for (const a of Object.keys(hits)) if (WORDS[a].includes(w)) hits[a] += w === head ? 2 : 1;   // the head noun counts double
  const ranked = Object.keys(hits).filter(a => hits[a] > 0).sort((a, b) => hits[b] - hits[a] || Object.keys(hits).indexOf(a) - Object.keys(hits).indexOf(b));
  if (!ranked.length) return { ...(BASE_BY_CATEGORY[category] || BASE_BY_CATEGORY.building) };
  const size = SIZE_BY_CATEGORY[category] || 2;
  const out = {};
  out[ranked[0]] = size;
  if (ranked[1]) out[ranked[1]] = 1;
  if (category === 'landmark' && !out.happiness) out.happiness = 1;   // a landmark always lifts the heart a little
  return out;
}

// the codegen meta's optional `areas` ({money, happiness, science} 0..6), sanitised; null when it says nothing
export function coerceAreas(a) {
  if (!a || typeof a !== 'object') return null;
  const out = {};
  for (const k of ['money', 'happiness', 'science']) { const n = Math.round(Number(a[k])); if (Number.isFinite(n) && n > 0) out[k] = clamp(n, 0, 6); }
  return Object.keys(out).length ? out : null;
}

// what finishing building `b` gives: {money?, happiness?, science?, civ}. `novel` = the first of a generated kind.
export function gainsFor(game, b, { novel = false } = {}) {
  const { catalog } = game;
  const entry = b.kind ? catalog.get(b.kind) : null;
  const category = (entry && entry.category) || b.category || 'building';
  let gains;
  if (entry && entry.areas) gains = { ...entry.areas };
  else if (b.kind && REWARD_TABLE[b.kind]) gains = { ...REWARD_TABLE[b.kind] };
  else gains = classifyWords(`${b.name || ''} ${b.noun || ''} ${b.request || ''} ${entry ? entry.aliases.slice(0, 4).join(' ') + ' ' + (entry.desc || '') : ''}`, category);
  if (novel) gains.science = (gains.science || 0) + REWARD.novelScience;
  // a drawn outline or stroke: bigger land, a little more of the main thing
  const main = ['money', 'happiness', 'science'].filter(k => gains[k] > 0).sort((a, c) => gains[c] - gains[a])[0];
  if (main && b.shape) {
    if (b.shape.poly && !b.shape.rect && b.shape.areaM2 > 0) gains[main] += clamp(Math.floor(b.shape.areaM2 * REWARD.areaPerM2), 0, REWARD.areaBonusMax);
    else if (b.shape.pts && !b.shape.straight && b.shape.length > 0) gains[main] += clamp(Math.floor(b.shape.length * REWARD.linePerM), 0, REWARD.lineBonusMax);
  }
  for (const k of Object.keys(gains)) { gains[k] = clamp(Math.round(gains[k]), 0, REWARD.maxPerArea); if (!gains[k]) delete gains[k]; }
  const value = entry ? entry.value : 4;
  gains.civ = clamp(Math.round(value * REWARD.civFromValue), REWARD.civMin, REWARD.civMax);
  return gains;
}

const LINES = {
  money:     { 10: 'the first coins clink', 25: 'a purse for the town', 50: 'traders come from afar', 100: 'a rich little coast', 200: 'wealth beyond counting' },
  happiness: { 10: 'laughter in the lanes', 25: 'the folk are content', 50: 'the lanterns stay lit late', 100: 'the happiest coast there is', 200: 'a golden age of cheer' },
  science:   { 10: 'we begin to wonder', 25: 'the first scholars', 50: 'the stars are mapped', 100: 'an age of invention', 200: 'the world is understood' }
};
const LEVEL_LINES = { hamlet: 'a hamlet now: the first lanes', village: 'a village now: a bell will ring', town: 'a town now: the Assembly may rise', civilisation: 'a civilisation: the nations look up' };

export function initRewards(state) {
  state.areas = { money: 0, happiness: 0, science: 0, civ: 0 };
  state.rewards = { learned: [], passed: { money: [], happiness: [], science: [] }, gains: 0 };
}

// the tally the UI draws: the four numbers, the level and the progress toward the next (from the stage thresholds)
export function totalsOf(game) {
  const { state } = game;
  const { STAGES_, thresholds } = game.rewards._stage;
  const i = STAGES_.indexOf(state.stage), next = STAGES_[i + 1] || null;
  const lo = i > 0 ? thresholds[STAGES_[i]] : 0, hi = next ? thresholds[next] : null;
  const progress = hi == null ? 1 : clamp((state.prosperity - lo) / Math.max(1, hi - lo), 0, 1);
  return { ...state.areas, level: state.stage, levelIndex: i, levelNext: next, levelProgress: +progress.toFixed(3), prosperity: state.prosperity };
}

// add `gains` to the tally, emit reward:gain (+ reward:milestone when a line is crossed). Never throws, never blocks.
function award(game, gains, where) {
  const { state } = game;
  const before = { ...state.areas };
  for (const k of AREAS) if (gains[k]) state.areas[k] += gains[k];
  state.rewards.gains++;
  let milestone = null;
  for (const k of ['money', 'happiness', 'science']) {
    if (!gains[k]) continue;
    for (const at of REWARD.milestones) {
      if (before[k] < at && state.areas[k] >= at && !state.rewards.passed[k].includes(at)) {
        state.rewards.passed[k].push(at);
        const m = { area: k, at, text: `${AREA_META[k].label} ${at}: ${LINES[k][at]}` };
        if (!milestone) milestone = m;
        game.emit('reward:milestone', { ...m, totals: totalsOf(game) });
        game.log(m.text + '.');
      }
    }
  }
  const payload = { ...where, gains, totals: totalsOf(game), ...(milestone ? { milestone } : {}) };
  game.emit('reward:gain', payload);
  return payload;
}

// wire the sim: completeBuilding calls game.rewards.onDone(b) itself (before refreshDerived, so the level-up follows the
// gain); institutions and level-ups come through events.
export function createRewards(game, { STAGES, thresholds }) {
  const { state } = game;
  initRewards(state);
  const rewards = {
    AREAS, AREA_META, REWARD, REWARD_TABLE, INSTITUTION_REWARDS,
    _stage: { STAGES_: STAGES, thresholds },
    totals: () => totalsOf(game),
    gainsFor: (b, opts) => gainsFor(game, b, opts),
    // what a request would give, before it is built ("a lighthouse" -> {happiness, science, civ}); kind ids, aliases or free text
    preview(text) {
      const id = game.catalog.resolve(text);
      if (id) return gainsFor(game, { kind: id, name: game.catalog.get(id).name }, {});
      return gainsFor(game, { kind: null, name: String(text || ''), request: String(text || ''), category: 'building' }, { novel: true });
    },
    onDone(b) {
      if (!b || b.rewarded) return null;
      b.rewarded = true;
      const novel = !!b.generated && !!b.kind && !state.rewards.learned.includes(b.kind);
      if (novel) state.rewards.learned.push(b.kind);
      const gains = gainsFor(game, b, { novel });
      return award(game, gains, { source: 'building', buildingId: b.id, kind: b.kind, name: b.name, x: b.x, z: b.z, generated: !!b.generated, novel, category: b.category || null, shape: b.shape && b.shape.poly ? 'area' : b.shape && b.shape.pts ? 'line' : 'point' });
    },
    onInstitution(inst) {
      const base = INSTITUTION_REWARDS[inst.kind] || INSTITUTION_REWARDS.generic;
      const gains = { ...base, civ: REWARD.institutionCiv };
      const lead = state.agents.find(a => a.id === inst.leader) || null;
      const at = lead ? { x: lead.x, z: lead.z } : { ...state.centre };
      return award(game, gains, { source: 'institution', buildingId: null, institutionId: inst.id, kind: inst.kind, name: inst.name, x: at.x, z: at.z, agentId: lead ? lead.id : null, generated: false, novel: false, category: 'institution', shape: 'point' });
    }
  };
  game.on('institution:found', ({ institution }) => { try { rewards.onInstitution(institution); } catch (e) { game.log(`[rewards] institution: ${e.message}`); } });
  let level = state.stage;   // the level actually held before a level-up (a rich start can jump a stage; `from` tells the truth)
  game.on('stage', ({ stage }) => {
    try {
      const m = { area: 'civ', at: stage, text: `Civ: ${LEVEL_LINES[stage] || stage}`, levelUp: { from: level, to: stage } };
      level = stage;
      game.emit('reward:milestone', { ...m, totals: totalsOf(game) });
    } catch (e) { game.log(`[rewards] stage: ${e.message}`); }
  });
  return rewards;
}
