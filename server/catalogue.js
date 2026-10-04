// The building catalogue as the server knows it: ids are fixed by ARCHITECTURE.md §2.
// The sim's web/js/sim/catalog.js is the game's source of truth; at boot we try to import it
// and prefer its entries (merging our aliases in). This copy keeps the server standalone.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { WEB_DIR } from './config.js';

export const SKILLS = ['building', 'baking', 'farming', 'crafting', 'trading', 'diplomacy', 'art', 'scouting'];
export const RESOURCES = ['food', 'wood', 'stone', 'coin', 'goods'];
export const STAGES = ['camp', 'hamlet', 'village', 'town', 'civilisation'];
export const SPECIES = ['puffer', 'loaf', 'drop', 'scoot', 'flit', 'pip', 'floatie'];

const E = (id, name, aliases, footprint, cost, workers, skill, buildSeconds, perDay, housing, stage, desc, extra = {}) =>
  ({ id, name, aliases, footprint, cost, workers, skill, buildSeconds, perDay, housing, stage, desc, category: 'building', shape: 'point', ...extra });
export const SHAPES = ['point', 'area', 'line'];   // how a kind takes the ground: a spot, a drawn outline, a drawn stroke (§10)

export const BUILTIN_CATALOGUE = [
  E('house', 'House', ['home', 'cottage', 'dwelling', 'houses', 'homes', 'ev', 'evler', 'konut'], { w: 3, d: 3 }, { wood: 8, stone: 2 }, 2, 'building', 40, {}, 3, 'camp', 'A small painted house. Shelters three folk.'),
  E('hut', 'Hut', ['shack', 'shelter', 'cabin', 'tent', 'huts', 'kulübe', 'kulube', 'baraka'], { w: 2, d: 2 }, { wood: 4 }, 1, 'building', 20, {}, 2, 'camp', 'A quick shelter for two.'),
  E('well', 'Well', ['water well', 'wells', 'kuyu'], { w: 1, d: 1 }, { stone: 4 }, 1, 'building', 25, { food: 1 }, 0, 'camp', 'Fresh water; a little food from the garden around it.'),
  E('farm', 'Farm', ['farms', 'farmstead', 'farmhouse', 'vegetable patch', 'çiftlik', 'ciftlik'], { w: 4, d: 4 }, { wood: 4, coin: 1 }, 2, 'farming', 45, { food: 4 }, 0, 'camp', 'Rows of crops. Feeds the village.'),
  E('windmill', 'Windmill', ['mill', 'wind mill', 'windmills', 'yel değirmeni', 'yel degirmeni', 'değirmen', 'degirmen'], { w: 3, d: 3 }, { wood: 10, stone: 4 }, 1, 'crafting', 60, { food: 2, goods: 1 }, 0, 'camp', 'Grinds grain; sails turn in the sea wind.'),
  E('bakery', 'Bakery', ['baker', 'bread shop', 'oven', 'bakeries', 'fırın', 'firin', 'ekmek fırını'], { w: 3, d: 3 }, { wood: 8, stone: 6, coin: 2 }, 2, 'baking', 50, { food: 5, goods: 1 }, 0, 'hamlet', 'Warm ovens. Turns grain into bread and cheer.'),
  E('granary', 'Granary', ['storehouse', 'storage', 'barn', 'silo', 'warehouse', 'ambar', 'depo'], { w: 3, d: 4 }, { wood: 10, stone: 2 }, 1, 'building', 45, {}, 0, 'hamlet', 'Keeps food from spoiling; raises the food cap.'),
  E('woodcutter', 'Woodcutter', ['lumber', 'lumberjack', 'sawmill', 'logging camp', 'wood cutter', 'oduncu', 'kereste'], { w: 3, d: 3 }, { wood: 4, stone: 2 }, 2, 'building', 40, { wood: 4 }, 0, 'camp', 'A hut by a grove; yields wood when a grove has grown.'),
  E('grove', 'Grove', ['trees', 'tree', 'koru', 'ağaç', 'agac'], { w: 4, d: 4 }, { coin: 1 }, 1, 'farming', 30, {}, 0, 'camp', 'Planted trees. They grow, then feed the woodcutter.'),
  E('quarry', 'Quarry', ['stone pit', 'mine', 'quarries', 'taş ocağı', 'tas ocagi', 'maden'], { w: 4, d: 4 }, { wood: 6 }, 2, 'building', 50, { stone: 3 }, 0, 'hamlet', 'Cut stone from the hillside.'),
  // ('smithy' / 'forge' belong to the smithy prefab now)
  E('workshop', 'Workshop', ['atelier', 'crafts', 'craft shop', 'carpenter', 'atölye', 'atolye'], { w: 3, d: 3 }, { wood: 10, stone: 4, coin: 2 }, 2, 'crafting', 55, { goods: 3 }, 0, 'hamlet', 'Makes goods from wood and stone.'),
  E('market', 'Market', ['shop', 'store', 'bazaar', 'stall', 'stalls', 'market square', 'pazar', 'dükkan', 'dukkan', 'çarşı', 'carsi'], { w: 4, d: 4 }, { wood: 8, coin: 4 }, 2, 'trading', 50, { coin: 3 }, 0, 'village', 'Stalls and awnings. Turns goods into coin.'),
  E('dock', 'Dock', ['pier', 'harbour', 'harbor', 'jetty', 'port', 'quay', 'boat dock', 'iskele', 'liman', 'rıhtım'], { w: 3, d: 6 }, { wood: 14, stone: 4 }, 2, 'trading', 60, { food: 2, coin: 2 }, 0, 'village', 'A pier into the sea for fishing and trade. Must touch water.'),
  E('fountain', 'Fountain', ['fountains', 'basin', 'çeşme', 'cesme', 'havuz'], { w: 2, d: 2 }, { stone: 8, coin: 2 }, 1, 'art', 35, {}, 0, 'village', 'A stone fountain. Lifts moods around it.'),
  E('tavern', 'Tavern', ['inn', 'pub', 'bar', 'cafe', 'café', 'tea house', 'meyhane', 'han', 'kahve'], { w: 4, d: 3 }, { wood: 12, stone: 4, coin: 4 }, 2, 'baking', 60, { coin: 2 }, 0, 'village', 'Lamps and long tables. Folk rest and gossip here.'),
  E('temple', 'Temple', ['shrine', 'chapel', 'church', 'sanctuary', 'tapınak', 'tapinak', 'mabet'], { w: 4, d: 5 }, { stone: 16, coin: 6 }, 3, 'art', 90, {}, 0, 'town', 'A small painted temple. Loyalty grows.'),
  E('tower', 'Tower', ['watchtower', 'lookout', 'turret', 'towers', 'kule', 'gözetleme kulesi'], { w: 2, d: 2 }, { stone: 12, wood: 4 }, 2, 'building', 70, {}, 0, 'village', 'A tall stone lookout over the sea.'),
  E('bridge', 'Bridge', ['footbridge', 'crossing', 'köprü', 'kopru'], { w: 2, d: 6 }, { wood: 10, stone: 6 }, 2, 'building', 55, {}, 0, 'village', 'Crosses water. Must span the lake edge.'),
  E('road', 'Road', ['path', 'street', 'lane', 'cobbles', 'track', 'yol', 'sokak', 'patika'], { w: 6, d: 2 }, { stone: 2 }, 1, 'building', 10, {}, 0, 'camp', 'A cobbled lane along the line you drew. Folk walk faster on it.', { category: 'prop', shape: 'line' }),
  E('garden', 'Garden', ['park', 'flowers', 'flower bed', 'flowerbed', 'bahçe', 'bahce', 'çiçek'], { w: 5, d: 5 }, { wood: 2, coin: 1 }, 1, 'art', 25, { food: 1 }, 0, 'camp', 'Flowering shrubs and a bench, filling the outline you drew. Mood rises.', { category: 'nature', shape: 'area' }),
  E('assembly', 'Assembly', ['red arch', 'arch', 'gathering place', 'great hall', 'parliament', 'forum', 'agora', 'meclis', 'kemer'], { w: 14, d: 14 }, { stone: 40, wood: 20, coin: 20 }, 4, 'building', 180, {}, 0, 'town', 'The Red arch at sundown: the gathering place for formal meetings.', { category: 'landmark' }),
  // area kinds (ART_DIRECTION §5): "this is a field" with a drawn outline fills exactly that outline
  E('field', 'Field', ['fields', 'crop field', 'wheat field', 'cornfield', 'corn field', 'meadow', 'pasture', 'farmland', 'crops', 'tarla', 'ekin', 'çayır', 'cayir'], { w: 8, d: 6 }, { coin: 1 }, 2, 'farming', 40, { food: 6 }, 0, 'camp', 'Striped crop bands clipped to the outline you drew.', { category: 'nature', shape: 'area' }),
  E('forest', 'Forest', ['woods', 'wood', 'woodland', 'pine forest', 'pines', 'cypresses', 'orman', 'ormanlık'], { w: 10, d: 10 }, {}, 1, 'farming', 40, { wood: 2 }, 0, 'camp', 'Trees scattered inside the outline. Shade now, timber later.', { category: 'nature', shape: 'area' }),
  E('orchard', 'Orchard', ['orchards', 'fruit trees', 'apple orchard', 'olive orchard', 'lemon grove', 'meyve bahçesi', 'bahçe ağaçları'], { w: 8, d: 8 }, { coin: 2 }, 1, 'farming', 40, { food: 3 }, 0, 'camp', 'Fruit trees in rows inside the outline.', { category: 'nature', shape: 'area' }),
  E('vineyard', 'Vineyard', ['vines', 'grapes', 'grape vines', 'vineyards', 'bağ', 'üzüm bağı'], { w: 8, d: 6 }, { coin: 2 }, 2, 'farming', 50, { food: 2, coin: 2 }, 0, 'hamlet', 'Rows of vines on the slope you drew.', { category: 'nature', shape: 'area' }),
  E('plaza', 'Plaza', ['square', 'town square', 'piazza', 'paved square', 'district', 'market district', 'paving', 'courtyard', 'meydan', 'alan'], { w: 8, d: 8 }, { stone: 6 }, 2, 'building', 40, {}, 0, 'camp', 'Paved and painted to the outline. Folk gather here.', { category: 'landmark', shape: 'area' }),
  // line kinds: "a road along here" with a drawn stroke follows exactly that stroke
  E('wall', 'Wall', ['walls', 'stone wall', 'city wall', 'town wall', 'rampart', 'ramparts', 'duvar', 'sur', 'surlar'], { w: 6, d: 1 }, { stone: 6 }, 2, 'building', 40, {}, 0, 'camp', 'A stone wall along the line you drew.', { category: 'building', shape: 'line' }),
  E('fence', 'Fence', ['fences', 'palisade', 'picket fence', 'railing', 'hedge', 'çit', 'cit', 'parmaklık'], { w: 6, d: 0.6 }, { wood: 3 }, 1, 'crafting', 15, {}, 0, 'camp', 'A wooden fence along the line.', { category: 'prop', shape: 'line' }),
  E('river', 'River', ['rivers', 'stream', 'brook', 'creek', 'canal', 'channel', 'waterway', 'nehir', 'dere', 'ırmak', 'irmak', 'kanal'], { w: 6, d: 2.5 }, {}, 2, 'building', 40, {}, 0, 'camp', 'Water painted along the line you drew.', { category: 'nature', shape: 'line' }),
];

// Fuzzy-ish alias index: lowercased aliases + ids + names, longest first for greedy matching.
export function buildAliasIndex(catalogue) {
  const pairs = [];
  for (const e of catalogue) {
    const names = new Set([e.id, (e.name || '').toLowerCase(), ...(e.aliases || []).map(a => a.toLowerCase())]);
    for (const n of names) if (n) pairs.push([n, e.id]);
  }
  pairs.sort((a, b) => b[0].length - a[0].length);
  return pairs;
}

// Compact catalogue for the system prompt (deterministic key order so the cache prefix is stable).
export function catalogueForPrompt(catalogue) {
  return catalogue.map(e => ({
    id: e.id, name: e.name, aliases: e.aliases, stage: e.stage, cost: e.cost, workers: e.workers, skill: e.skill,
    buildSeconds: e.buildSeconds, perDay: e.perDay, housing: e.housing, footprint: e.footprint, desc: e.desc,
    category: e.category || 'building', shape: SHAPES.includes(e.shape) ? e.shape : 'point',
  }));
}

function normaliseEntries(x) {
  if (!x) return null;
  if (Array.isArray(x)) return x.every(e => e && typeof e.id === 'string') ? x : null;
  if (typeof x === 'object') {
    if (typeof x.all === 'function') return normaliseEntries(x.all());
    if (typeof x.list === 'function') return normaliseEntries(x.list());
    if (Array.isArray(x.entries)) return normaliseEntries(x.entries);
    const vals = Object.values(x);
    if (vals.length && vals.every(e => e && typeof e === 'object' && typeof e.id === 'string')) return vals;
  }
  return null;
}

// The prefab library's manifest (web/js/buildings/prefabs/manifest.js, from scripts/build-manifest.mjs): the standalone
// fallback when the sim catalogue can't be imported, so the prompt and the mock still know every prefab id and alias.
const LIGHT = {
  building: { cost: { wood: 4, stone: 2 }, workers: 2, skill: 'building', buildSeconds: 30 }, farm: { cost: { coin: 1 }, workers: 1, skill: 'farming', buildSeconds: 25, perDay: { food: 2 } },
  animal: { cost: { wood: 3 }, workers: 1, skill: 'farming', buildSeconds: 25, perDay: { food: 2 } }, nature: { cost: {}, workers: 1, skill: 'farming', buildSeconds: 15 },
  landmark: { cost: { stone: 6, coin: 2 }, workers: 2, skill: 'art', buildSeconds: 40 }, prop: { cost: { wood: 2 }, workers: 1, skill: 'crafting', buildSeconds: 12 }
};
export async function loadManifestEntries() {
  const file = path.join(WEB_DIR, 'js', 'buildings', 'prefabs', 'manifest.js');
  if (!fs.existsSync(file)) return [];
  const mod = await import(pathToFileURL(file).href);
  // the Ministry's creative nouns stay kind:null (sim catalog.js RESERVED): the statue prefab is a library piece, not a kind
  const RESERVED_IDS = ['statue'], RESERVED_WORDS = ['duck', 'ducks', 'boat', 'boats', 'statue', 'statues', 'tree', 'tower', 'clock tower', 'lighthouse', 'rocket', 'dragon'];
  return (mod.MANIFEST || []).filter(m => !RESERVED_IDS.includes(m.id)).map(m => {
    const L = LIGHT[m.category] || LIGHT.building;
    return E(m.id, m.name, (m.aliases || []).filter(a => !RESERVED_WORDS.includes(a)), { w: Math.max(1, Math.round(m.footprint.w)), d: Math.max(1, Math.round(m.footprint.d)) }, L.cost, L.workers, L.skill, L.buildSeconds, L.perDay || {}, 0,
      STAGES.includes(m.stage) ? m.stage : 'camp', m.desc || '', { category: m.category || 'building', shape: 'point', water: !!m.water });
  });
}
// an id always beats an alias ('barn' was the granary's alias; now it is a prefab of its own)
function idsBeatAliases(entries) {
  const ids = new Set(entries.map(e => e.id));
  for (const e of entries) e.aliases = (e.aliases || []).filter(a => !ids.has(a) || a === e.id);
  return entries;
}

// Try the sim's catalogue (which itself carries the prefab manifest); merge our aliases so Turkish words and plurals keep working.
export async function loadCatalogue() {
  const file = path.join(WEB_DIR, 'js', 'sim', 'catalog.js');
  let source = 'builtin';
  let entries = BUILTIN_CATALOGUE.map(e => ({ ...e, aliases: e.aliases.slice() }));
  if (fs.existsSync(file)) {
    try {
      const mod = await import(pathToFileURL(file).href);
      let found = null;
      for (const k of ['CATALOG', 'CATALOGUE', 'catalog', 'catalogue', 'default', 'entries', 'BUILDINGS']) {
        found = normaliseEntries(mod[k]); if (found) break;
      }
      if (!found) for (const v of Object.values(mod)) { found = normaliseEntries(v); if (found) break; }
      if (found) {
        const mine = new Map(BUILTIN_CATALOGUE.map(e => [e.id, e]));
        entries = found.map(e => {
          const b = mine.get(e.id);
          const aliases = Array.from(new Set([...(e.aliases || []), ...(b?.aliases || [])]));
          return { ...(b || {}), ...e, aliases };
        });
        for (const b of BUILTIN_CATALOGUE) if (!entries.some(e => e.id === b.id)) entries.push(b);
        source = 'web/js/sim/catalog.js';
      }
    } catch (err) {
      source = `builtin (sim catalog failed to import: ${err.message})`;
    }
  }
  if (!source.startsWith('web/')) {
    try { const extra = await loadManifestEntries(); for (const m of extra) if (!entries.some(e => e.id === m.id)) entries.push(m); if (extra.length) source += ' + prefabs/manifest.js'; }
    catch (err) { source += ` (manifest failed: ${err.message})`; }
  }
  idsBeatAliases(entries);
  return { entries, source, aliasIndex: buildAliasIndex(entries), byId: new Map(entries.map(e => [e.id, e])) };
}
