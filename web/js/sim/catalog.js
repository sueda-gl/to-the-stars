// The building catalogue. IDs are fixed (visual prefabs share them). Generated buildings are added at runtime.
// `shape` says how a kind takes the ground: 'point' (a prefab at a spot), 'area' (fills an outline: field, forest, orchard,
// vineyard, plaza, garden) or 'line' (follows a stroke: road, wall, fence, river). See ART_DIRECTION §5 / ARCHITECTURE §10.
// Units: footprint in world units (1 ≈ 1 m), buildSeconds at the nominal worker count and average skill,
// perDay in resources per 60 s day at full staffing, value feeds prosperity, moodBonus lifts the folk's mood ceiling.

import { MANIFEST } from '../buildings/prefabs/manifest.js';   // every prefab's meta (scripts/build-manifest.mjs)

export const STAGES = ['camp', 'hamlet', 'village', 'town', 'civilisation'];
export const stageIndex = s => Math.max(0, STAGES.indexOf(s));

const E = (id, name, o) => ({
  id, name, aliases: [], footprint: { w: 4, d: 4 }, cost: {}, workers: 1, skill: 'building', buildSeconds: 40,
  perDay: {}, housing: 0, stage: 'camp', value: 4, moodBonus: 0, desc: '', generated: false, category: 'building', water: false, shape: 'point', ...o
});

export const BASE_ENTRIES = [
  E('house', 'House', { aliases: ['home', 'cottage', 'dwelling', 'casa'], footprint: { w: 4, d: 4 }, cost: { wood: 8, stone: 2 }, workers: 2, buildSeconds: 40, housing: 4, value: 6,
    desc: 'A snug painted house. Sleeps four folk.' }),
  E('hut', 'Hut', { aliases: ['shack', 'cabin', 'tent', 'shelter'], footprint: { w: 3, d: 3 }, cost: { wood: 5 }, workers: 1, buildSeconds: 20, housing: 2, value: 2,
    desc: 'Quick shelter for two. Cheap, a little leaky.' }),
  E('well', 'Well', { category: 'prop', aliases: ['water well', 'spring'], footprint: { w: 2, d: 2 }, cost: { stone: 6 }, workers: 1, buildSeconds: 25, value: 3, moodBonus: 3,
    desc: 'Fresh water in the square. Folk like living near one.' }),
  E('farm', 'Farm', { aliases: ['farmstead', 'farmhouse', 'crops', 'vegetable patch', 'allotment'], footprint: { w: 8, d: 6 }, cost: { wood: 6, coin: 1 }, workers: 2, skill: 'farming', buildSeconds: 45,
    perDay: { food: 8 }, value: 5, desc: 'Rows of crops. Two farmers feed eight.' }),
  E('windmill', 'Windmill', { aliases: ['mill', 'wind mill'], footprint: { w: 4, d: 4 }, cost: { wood: 7, stone: 4 }, workers: 1, skill: 'crafting', buildSeconds: 60,
    perDay: { food: 2, goods: 2 }, value: 8, desc: 'Turns grain into flour and the breeze into a landmark.' }),
  E('bakery', 'Bakery', { aliases: ['bread shop', 'oven', 'boulangerie', 'panificio'], footprint: { w: 5, d: 4 }, cost: { wood: 6, stone: 4, coin: 2 }, workers: 2, skill: 'baking', buildSeconds: 50,
    perDay: { food: 12, wood: -1 }, value: 8, moodBonus: 2, desc: 'Warm bread every morning: two bakers feed a dozen. Needs a little firewood.' }),
  E('granary', 'Granary', { aliases: ['storehouse', 'barn', 'silo', 'warehouse'], footprint: { w: 5, d: 5 }, cost: { wood: 12, stone: 4 }, workers: 0, buildSeconds: 40, stage: 'hamlet', value: 6,
    desc: 'Keeps the food dry. Raises the stockpile cap.' }),
  E('woodcutter', 'Woodcutter', { aliases: ['lumber', 'lumberjack', 'sawmill', 'timber yard', 'logging'], footprint: { w: 4, d: 4 }, cost: { wood: 3, stone: 1 }, workers: 1, skill: 'crafting', buildSeconds: 30,
    perDay: { wood: 5 }, value: 4, desc: 'Yields timber. Yields much more once a grove has grown.' }),
  E('grove', 'Grove', { category: 'nature', aliases: ['trees', 'olive grove', 'plant trees', 'copse'], footprint: { w: 6, d: 6 }, cost: { coin: 2, food: 2 }, workers: 1, skill: 'farming', buildSeconds: 30,
    perDay: { food: 1 }, value: 3, moodBonus: 1, desc: 'Saplings now, shade and timber later. Grows for a few days.' }),
  E('quarry', 'Quarry', { aliases: ['stone pit', 'mine', 'stonecutter'], footprint: { w: 7, d: 6 }, cost: { wood: 8 }, workers: 2, buildSeconds: 50,
    perDay: { stone: 5 }, value: 5, desc: 'Pale stone from the hill. Hard work.' }),
  E('workshop', 'Workshop', { aliases: ['atelier', 'crafts', 'carpenter', 'studio'], footprint: { w: 5, d: 5 }, cost: { wood: 12, stone: 6 }, workers: 2, skill: 'crafting', buildSeconds: 55, stage: 'hamlet',   // 'forge' is the smithy's now
    perDay: { goods: 4, wood: -2 }, value: 8, desc: 'Turns wood into goods for the market.' }),
  E('market', 'Market', { aliases: ['shop', 'bazaar', 'stalls', 'store', 'mercato'], footprint: { w: 7, d: 5 }, cost: { wood: 10, stone: 4, coin: 5 }, workers: 2, skill: 'trading', buildSeconds: 50, stage: 'hamlet',
    perDay: { coin: 4, goods: -2 }, value: 9, moodBonus: 2, desc: 'Sells goods for coin. Loud and cheerful.' }),
  E('dock', 'Dock', { aliases: ['pier', 'harbour', 'harbor', 'jetty', 'port', 'fishing dock'], footprint: { w: 6, d: 4 }, cost: { wood: 16 }, workers: 2, skill: 'scouting', buildSeconds: 60, stage: 'hamlet',
    perDay: { food: 4, coin: 1 }, value: 8, wantsWater: true, desc: 'Boats and nets at the shore. Fish and a little trade.' }),
  E('fountain', 'Fountain', { category: 'landmark', aliases: ['fontana'], footprint: { w: 3, d: 3 }, cost: { stone: 10, coin: 3 }, workers: 1, skill: 'art', buildSeconds: 35, stage: 'village', value: 7, moodBonus: 4,
    desc: 'A splash of pride in the square. Lifts spirits.' }),
  E('tavern', 'Tavern', { aliases: ['inn', 'pub', 'bar', 'osteria', 'cafe', 'café'], footprint: { w: 6, d: 5 }, cost: { wood: 14, stone: 6, coin: 4 }, workers: 2, skill: 'baking', buildSeconds: 60, stage: 'village',
    perDay: { coin: 3, food: -2 }, value: 10, moodBonus: 6, desc: 'Songs after dark. Costs a little food, earns coin and smiles.' }),
  E('temple', 'Temple', { category: 'landmark', aliases: ['shrine', 'chapel', 'church', 'sanctuary'], footprint: { w: 8, d: 8 }, cost: { stone: 24, coin: 8 }, workers: 3, skill: 'art', buildSeconds: 90, stage: 'village', value: 16, moodBonus: 8,
    desc: 'Columns and a quiet. Loyalty grows under its roof.' }),
  E('tower', 'Tower', { category: 'landmark', aliases: ['watchtower', 'lookout', 'keep', 'turret'], footprint: { w: 4, d: 4 }, cost: { stone: 16, wood: 4 }, workers: 2, buildSeconds: 70, stage: 'village', value: 12,
    desc: 'A lookout over the bay. The neighbours notice.' }),
  E('bridge', 'Bridge', { category: 'landmark', aliases: ['footbridge', 'crossing'], footprint: { w: 8, d: 3 }, cost: { wood: 12, stone: 6 }, workers: 2, buildSeconds: 50, stage: 'hamlet', value: 6, wantsWater: true,
    desc: 'Arches over the water. Pretty, and practical.' }),
  E('road', 'Road', { category: 'prop', shape: 'line', aliases: ['path', 'street', 'lane', 'cobbles', 'track', 'alley'], footprint: { w: 6, d: 2 }, cost: { stone: 2 }, workers: 1, buildSeconds: 10, value: 1,
    desc: 'A strip of cobbles. Folk walk faster on it.' }),
  E('garden', 'Garden', { category: 'nature', shape: 'area', aliases: ['park', 'flowers', 'flower bed', 'vegetable garden', 'giardino', 'flower garden'], footprint: { w: 5, d: 5 }, cost: { coin: 2, food: 1 }, workers: 1, skill: 'farming', buildSeconds: 30, stage: 'hamlet',
    perDay: { food: 1 }, value: 4, moodBonus: 3, desc: 'Flowers and herbs. Everyone is calmer for it.' }),
  E('assembly', 'Assembly', { category: 'landmark', aliases: ['red arch', 'gathering place', 'parliament', 'forum', 'agora', 'senate', 'hall'], footprint: { w: 20, d: 14 }, cost: { wood: 40, stone: 60, coin: 20 }, workers: 4, buildSeconds: 150, stage: 'town',
    value: 50, moodBonus: 10, desc: 'The Red arch. Where formal meetings are held, on the terrace by the pool.' }),
  // ---- area kinds (ART_DIRECTION §5): drawn as an outline on the paper, filled exactly; without a mark they are a rectangle of this footprint ----
  E('field', 'Field', { category: 'nature', shape: 'area', aliases: ['fields', 'crop field', 'wheat field', 'cornfield', 'corn field', 'barley field', 'meadow', 'pasture', 'farmland', 'crops'], footprint: { w: 8, d: 6 }, cost: { coin: 1 }, workers: 2, skill: 'farming', buildSeconds: 40,
    perDay: { food: 6 }, value: 4, desc: 'Striped crop bands clipped to the outline you drew. Two farmers work it.' }),
  E('forest', 'Forest', { category: 'nature', shape: 'area', aliases: ['woods', 'wood', 'woodland', 'pine forest', 'pines', 'cypresses', 'trees here'], footprint: { w: 10, d: 10 }, cost: {}, workers: 1, skill: 'farming', buildSeconds: 40,
    perDay: { wood: 2 }, value: 4, moodBonus: 1, desc: 'Trees scattered inside the outline. Shade now, timber later.' }),
  E('orchard', 'Orchard', { category: 'nature', shape: 'area', aliases: ['orchards', 'fruit trees', 'apple orchard', 'olive orchard', 'lemon grove'], footprint: { w: 8, d: 8 }, cost: { coin: 2 }, workers: 1, skill: 'farming', buildSeconds: 40,
    perDay: { food: 3 }, value: 4, moodBonus: 1, desc: 'Fruit trees in rows inside the outline.' }),
  E('vineyard', 'Vineyard', { category: 'nature', shape: 'area', aliases: ['vines', 'grapes', 'grape vines', 'vineyards', 'wine'], footprint: { w: 8, d: 6 }, cost: { coin: 2 }, workers: 2, skill: 'farming', buildSeconds: 50, stage: 'hamlet',
    perDay: { food: 2, coin: 2 }, value: 5, moodBonus: 1, desc: 'Rows of vines on the slope you drew. Coin by autumn.' }),
  E('plaza', 'Plaza', { category: 'landmark', shape: 'area', aliases: ['square', 'town square', 'piazza', 'paved square', 'district', 'market district', 'paving', 'courtyard'], footprint: { w: 8, d: 8 }, cost: { stone: 6 }, workers: 2, buildSeconds: 40,
    value: 6, moodBonus: 3, desc: 'Paved and painted to the outline. Folk gather here.' }),
  // ---- line kinds: drawn as an open stroke, followed exactly ----
  E('wall', 'Wall', { category: 'building', shape: 'line', aliases: ['walls', 'stone wall', 'city wall', 'town wall', 'rampart', 'ramparts', 'barrier'], footprint: { w: 6, d: 1 }, cost: { stone: 6 }, workers: 2, buildSeconds: 40,
    value: 3, desc: 'A stone wall along the line you drew.' }),
  E('fence', 'Fence', { category: 'prop', shape: 'line', aliases: ['fences', 'palisade', 'picket fence', 'railing', 'hedge'], footprint: { w: 6, d: 0.6 }, cost: { wood: 3 }, workers: 1, skill: 'crafting', buildSeconds: 15,
    value: 1, desc: 'A wooden fence along the line.' }),
  E('river', 'River', { category: 'nature', shape: 'line', aliases: ['rivers', 'stream', 'brook', 'creek', 'canal', 'channel', 'waterway'], footprint: { w: 6, d: 2.5 }, cost: {}, workers: 2, buildSeconds: 40,
    value: 4, moodBonus: 2, desc: 'Water painted along the line you drew.' })
];
export const CORE_IDS = BASE_ENTRIES.map(e => e.id);

// ---- the prefab library (web/js/buildings/prefabs/manifest.js): every prefab a builder added gets a catalogue entry with
// light, demo-friendly numbers by category (nothing here blocks a creation, ART_DIRECTION), plus a few per-id touches.
// `area` prefabs that the fillers know (fill.js FILL_KINDS) fill a drawn outline; the other area prefabs sit at the
// outline's centroid scaled to fit it (shape 'point' + markSpot's fit), so a wheat field drawn on the paper still lands.
const FILLABLE = ['meadow', 'piazza'];
// the Ministry's own creative nouns (CONCEPT demo: "a rubber duck", "a dragon statue", "a boat"): these stay kind:null so the
// Ministry draws them (the mock's stock assets, the live codegen). The statue prefab lives in the library and the gallery, not
// in the catalogue; a prefab may not claim these words as aliases either.
export const RESERVED_IDS = ['statue'];
const RESERVED_WORDS = ['duck', 'ducks', 'boat', 'boats', 'statue', 'statues', 'tree', 'tower', 'clock tower', 'lighthouse', 'rocket', 'dragon'];   // 'clock tower' = tower + an unusual modifier: the Ministry's
const PREFAB_TUNING = {
  building: { cost: { wood: 4, stone: 2 }, workers: 2, skill: 'building', buildSeconds: 30, value: 6, moodBonus: 0 },
  farm:     { cost: { coin: 1 }, workers: 1, skill: 'farming', buildSeconds: 25, perDay: { food: 2 }, value: 4, moodBonus: 1 },
  animal:   { cost: { wood: 3 }, workers: 1, skill: 'farming', buildSeconds: 25, perDay: { food: 2 }, value: 4, moodBonus: 1 },
  nature:   { cost: {}, workers: 1, skill: 'farming', buildSeconds: 15, value: 3, moodBonus: 2 },
  landmark: { cost: { stone: 6, coin: 2 }, workers: 2, skill: 'art', buildSeconds: 40, value: 10, moodBonus: 4 },
  prop:     { cost: { wood: 2 }, workers: 1, skill: 'crafting', buildSeconds: 12, value: 2, moodBonus: 1 }
};
const PREFAB_TOUCH = {
  barn: { cost: { wood: 6 }, value: 4 }, warehouse: { cost: { wood: 6, stone: 2 }, value: 6 }, tent: { cost: { wood: 2 }, housing: 2, buildSeconds: 12 }, 'lean-to': { cost: { wood: 2 }, housing: 1, buildSeconds: 12 },
  smithy: { skill: 'crafting', perDay: { goods: 3, wood: -1 }, value: 7 }, sawmill: { skill: 'crafting', perDay: { wood: 4 } }, potter: { skill: 'crafting', perDay: { goods: 2 } },
  weaver: { skill: 'crafting', perDay: { goods: 2 } }, kiln: { skill: 'crafting', perDay: { goods: 1, wood: -1 } }, charcoal: { skill: 'crafting', perDay: { wood: 1 } },
  stonemason: { perDay: { stone: 2 } }, 'olive-press': { skill: 'farming', perDay: { food: 2, coin: 1 } }, stalls: { skill: 'trading', perDay: { coin: 2, goods: -1 }, moodBonus: 1 },
  school: { value: 8, moodBonus: 3 }, library: { value: 10, moodBonus: 4 }, 'town-hall': { value: 16, moodBonus: 4 }, bathhouse: { value: 10, moodBonus: 5 },
  pier: { wantsWater: true, skill: 'scouting', perDay: { food: 2 } }, shipyard: { wantsWater: true, skill: 'crafting', perDay: { goods: 1, coin: 1 } }, crane: { wantsWater: true },
  'fishing-nets': { wantsWater: true, perDay: { food: 2 } }, canoe: { wantsWater: true }, 'beach-rocks': { wantsWater: true }, 'dune-grass': { wantsWater: true },
  watchtower: { value: 5 }, 'wall-tower': { value: 5 }, 'town-wall': { value: 4 }, 'palisade-gate': { value: 4 },
  beehives: { perDay: { food: 1, coin: 1 } }, 'wheat-field': { workers: 2, perDay: { food: 4 } }, 'olive-grove': { perDay: { food: 3 } }, 'vegetable-patch': { perDay: { food: 2 } },
  'pumpkin-patch': { perDay: { food: 2 } }, 'lavender-field': { perDay: { coin: 1, food: 1 }, moodBonus: 2 }, 'sunflower-field': { perDay: { food: 1, coin: 1 }, moodBonus: 2 },
  'flower-meadow': { perDay: {}, moodBonus: 3 }, haystacks: { perDay: { food: 1 } }, 'irrigation-ditch': { perDay: { food: 1 } }, orchard: {}, vineyard: {},
  'sheep-pen': { perDay: { food: 2, goods: 1 } }, 'cow-pasture': { workers: 2, perDay: { food: 3 } }, 'goat-pen': { perDay: { food: 2 } }, 'chicken-coop': { perDay: { food: 2 } },
  'pig-sty': { perDay: { food: 2 } }, 'horse-stable': { perDay: { coin: 1 }, moodBonus: 1 }, dovecote: { perDay: { food: 1 } }, 'duck-pond': { perDay: { food: 1 }, moodBonus: 2 },
  amphitheatre: { cost: { stone: 10, coin: 4 }, workers: 3, value: 20, moodBonus: 8 }, aqueduct: { value: 14 }, campanile: { value: 12 }, observatory: { value: 12 }, obelisk: { value: 8 },
  statue: { value: 8, moodBonus: 4 }, 'standing-stones': { value: 6 }, pond: { moodBonus: 3 }, campfire: { moodBonus: 2 }, 'hearth-ring': { moodBonus: 2 }, gazebo: { moodBonus: 2 }
};
export const PREFAB_ENTRIES = MANIFEST.filter(m => !CORE_IDS.includes(m.id) && !RESERVED_IDS.includes(m.id)).map(m => {
  const T = PREFAB_TUNING[m.category] || PREFAB_TUNING.building, X = PREFAB_TOUCH[m.id] || {};
  return E(m.id, m.name, {
    aliases: (m.aliases || []).filter(a => a !== m.id && !RESERVED_WORDS.includes(a)), category: m.category, stage: STAGES.includes(m.stage) ? m.stage : 'camp',
    footprint: { w: Math.max(1, Math.round(m.footprint.w)), d: Math.max(1, Math.round(m.footprint.d)) }, desc: m.desc || '',
    water: !!m.water, shape: m.area && FILLABLE.includes(m.id) ? 'area' : 'point',
    ...T, ...X, cost: { ...(X.cost || T.cost) }, perDay: { ...(X.perDay || T.perDay || {}) }
  });
});
BASE_ENTRIES.push(...PREFAB_ENTRIES);
// an id always beats an alias: 'barn' / 'pier' / 'sawmill' / 'tent' used to be aliases of the granary, dock, woodcutter and
// hut; now each is its own prefab, so those aliases go (resolve() would otherwise find the older entry first).
{
  const ids = new Set(BASE_ENTRIES.map(e => e.id));
  for (const e of BASE_ENTRIES) e.aliases = e.aliases.filter(a => !ids.has(a) || a === e.id);
}

export const FIXED_IDS = BASE_ENTRIES.map(e => e.id);

// defaults for a thing nobody has designed yet (used while a design is awaited and as fallbacks for generated entries).
// Per category: props and nature are cheap, quick and tiny (a duck is 2x2 and free); landmarks are the prosperity makers.
export const CATEGORIES = ['building', 'prop', 'landmark', 'nature', 'farm', 'animal'];
export const SHAPES = ['point', 'area', 'line'];   // how a kind occupies the ground (ARCHITECTURE §10)
export const GENERATED_DEFAULTS = { footprint: { w: 5, d: 5 }, cost: { wood: 5, stone: 9, coin: 2 }, workers: 2, skill: 'building', buildSeconds: 70, perDay: {}, housing: 0, value: 16, moodBonus: 2, category: 'building' };
export const GENERATED_BY_CATEGORY = {
  building: GENERATED_DEFAULTS,
  landmark: { ...GENERATED_DEFAULTS, value: 30, moodBonus: 4, buildSeconds: 60, category: 'landmark' },
  prop: { ...GENERATED_DEFAULTS, footprint: { w: 2, d: 2 }, cost: {}, workers: 1, skill: 'crafting', buildSeconds: 12, value: 5, moodBonus: 2, category: 'prop' },
  nature: { ...GENERATED_DEFAULTS, footprint: { w: 3, d: 3 }, cost: {}, workers: 1, skill: 'farming', buildSeconds: 15, value: 4, moodBonus: 2, category: 'nature' },
  farm: { ...GENERATED_DEFAULTS, footprint: { w: 6, d: 5 }, cost: { coin: 1 }, workers: 1, skill: 'farming', buildSeconds: 25, perDay: { food: 2 }, value: 4, moodBonus: 1, category: 'farm' },
  animal: { ...GENERATED_DEFAULTS, footprint: { w: 5, d: 5 }, cost: { wood: 3 }, workers: 1, skill: 'farming', buildSeconds: 25, perDay: { food: 2 }, value: 4, moodBonus: 1, category: 'animal' }
};
export const defaultsFor = category => GENERATED_BY_CATEGORY[category] || GENERATED_DEFAULTS;

const RES_IDS = ['food', 'wood', 'stone', 'coin', 'goods'];
const SKILL_IDS = ['building', 'baking', 'farming', 'crafting', 'trading', 'diplomacy', 'art', 'scouting'];
const num = (v, lo, hi, dflt) => { const n = Number(v); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : dflt; };
const bundle = (o, lo, hi, dflt) => {
  if (!o || typeof o !== 'object') return { ...dflt };
  const out = {};
  for (const k of RES_IDS) { const n = Number(o[k]); if (Number.isFinite(n) && n !== 0) out[k] = Math.round(Math.max(lo, Math.min(hi, n))); }
  return out;
};
// generated metadata comes from a model (or a cache file): every field is coerced, never trusted
export function coerceMeta(m, D = null) {
  m = m && typeof m === 'object' ? m : {};
  if (!D) D = CATEGORIES.includes(m.category) ? GENERATED_BY_CATEGORY[m.category] : GENERATED_DEFAULTS;
  const fp = m.footprint && typeof m.footprint === 'object' ? m.footprint : {};
  return {
    footprint: { w: num(fp.w, 1, 30, D.footprint.w), d: num(fp.d, 1, 30, D.footprint.d) },
    cost: m.cost === undefined ? { ...D.cost } : bundle(m.cost, 0, 200, D.cost),
    workers: Math.round(num(m.workers, 0, 6, D.workers)),
    skill: SKILL_IDS.includes(m.skill) ? m.skill : D.skill,
    buildSeconds: Number(m.buildSeconds) > 0 ? num(m.buildSeconds, 5, 600, D.buildSeconds) : D.buildSeconds,   // 0 / missing = unset
    perDay: bundle(m.perDay, -20, 20, D.perDay),
    housing: Math.round(num(m.housing, 0, 20, D.housing)),
    value: Math.round(num(m.value, 0, 100, D.value)),
    moodBonus: Math.round(num(m.moodBonus, -10, 20, D.moodBonus)),
    stage: STAGES.includes(m.stage) ? m.stage : 'camp',
    category: CATEGORIES.includes(m.category) ? m.category : (D.category || 'building'),
    wantsWater: !!m.wantsWater,
    water: !!(m.water || m.floating || m.floats),  // floating things: placed ON the water
    shape: SHAPES.includes(m.shape) ? m.shape : 'point',   // 'area' | 'line' fill a mark's outline / stroke; 'point' sits at it
    ...(areasOf(m.areas) ? { areas: areasOf(m.areas) } : {})   // §22b: what it gives when raised ({money, happiness, science} 0..6), if the model said
  };
}
function areasOf(a) {
  if (!a || typeof a !== 'object') return null;
  const out = {};
  for (const k of ['money', 'happiness', 'science']) { const n = Math.round(Number(a[k])); if (Number.isFinite(n) && n > 0) out[k] = Math.min(6, n); }
  return Object.keys(out).length ? out : null;
}

export const slug = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 24) || 'thing';

export function createCatalog() {
  const entries = new Map();
  const add = (entry) => {
    if (!entry || !entry.id) throw new Error('catalog.add needs an id');
    // meta fields may also sit on the entry itself; the entry's own copies win, then everything is coerced
    const raw = { ...(entry.meta && typeof entry.meta === 'object' ? entry.meta : {}) };
    for (const k of ['footprint', 'cost', 'workers', 'skill', 'buildSeconds', 'perDay', 'housing', 'value', 'moodBonus', 'stage', 'category', 'wantsWater', 'water', 'shape', 'areas']) if (entry[k] !== undefined) raw[k] = entry[k];
    const e = {
      ...E(String(entry.id), typeof entry.name === 'string' && entry.name.trim() ? entry.name.trim().slice(0, 40) : String(entry.id), {}),
      generated: true,
      ...coerceMeta(raw),
      id: String(entry.id),
      desc: typeof entry.desc === 'string' ? entry.desc.slice(0, 200) : '',
      code: typeof entry.code === 'string' ? entry.code : undefined
    };
    e.aliases = (Array.isArray(entry.aliases) ? entry.aliases : []).filter(a => typeof a === 'string' && a.trim()).map(a => a.trim().toLowerCase().slice(0, 40)).slice(0, 12);
    if (e.code === undefined) delete e.code;
    entries.set(e.id, e);
    return e;
  };
  for (const e of BASE_ENTRIES) entries.set(e.id, { ...e, cost: { ...e.cost }, perDay: { ...e.perDay }, footprint: { ...e.footprint }, aliases: e.aliases.slice() });

  const cat = {
    entries,
    get: id => entries.get(id) || null,
    has: id => entries.has(id),
    ids: () => [...entries.keys()],
    list: () => [...entries.values()],
    add,
    // 'wind mill' / 'mill' / 'windmills' -> 'windmill'; null when nothing matches
    resolve(text) {
      if (!text) return null;
      const t = String(text).toLowerCase().trim();
      if (entries.has(t)) return t;
      const base = t.replace(/s$/, '');
      for (const e of entries.values()) {
        if (e.id === base || e.name.toLowerCase() === t || e.name.toLowerCase() === base) return e.id;
        if (e.aliases.includes(t) || e.aliases.includes(base)) return e.id;
      }
      // whole-word match inside a longer phrase ("a wind mill there" -> windmill; "lighthouse" must not match house)
      const words = ' ' + t.replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ') + ' ';
      const hasWord = w => words.includes(' ' + w + ' ') || words.includes(' ' + w + 's ');
      let best = null, bestLen = 0;
      for (const e of entries.values()) {
        for (const w of [e.id, e.name.toLowerCase(), ...e.aliases]) if (w.length > bestLen && hasWord(w)) { best = e.id; bestLen = w.length; }
      }
      return best;
    },
    unlocked: stage => [...entries.values()].filter(e => stageIndex(e.stage) <= stageIndex(stage)).map(e => e.id),
    isUnlocked: (id, stage) => { const e = entries.get(id); return !!e && stageIndex(e.stage) <= stageIndex(stage); },
    costTotal: id => { const e = entries.get(id); return e ? Object.values(e.cost).reduce((a, b) => a + b, 0) : 0 }
  };
  return cat;
}
