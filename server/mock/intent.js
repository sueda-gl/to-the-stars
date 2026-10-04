// Heuristic intent parser for mock mode (and as a safety net when the live mind is unreachable).
// Maps speech to §4 + §9 actions well enough to run the CONCEPT.md demo script, the director beats
// (web/js/director.js DEFAULT_BEATS) and the UI chips (web/js/ui/ui.js DEFAULT_CHIPS / MORE_CHIPS) offline.
import { SKILLS, RESOURCES } from '../catalogue.js';
import { normaliseActions, snapshotLetters, normaliseMark } from '../schemas.js';

const NUMBERS = { one: 1, a: 1, an: 1, two: 2, three: 3, four: 4, five: 5, six: 6, couple: 2, pair: 2, few: 3, several: 3, bir: 1, iki: 2, 'üç': 3, uc: 3, 'dört': 4, dort: 4, 'beş': 5, bes: 5, 'altı': 6, alti: 6 };

const SKILL_WORDS = {
  baking: ['bak', 'bread', 'oven', 'pastry', 'cook', 'ekmek', 'fırın', 'firin', 'pişir'],
  building: ['build', 'carpent', 'hammer', 'mason', 'construct', 'inşa', 'insa', 'usta'],
  farming: ['farm', 'grow', 'plant', 'crop', 'harvest', 'garden', 'çiftçi', 'ciftci', 'tarım', 'tarim', 'ekin'],
  crafting: ['craft', 'make things', 'carve', 'smith', 'weav', 'zanaat', 'el işi'],
  trading: ['trad', 'sell', 'merchant', 'haggl', 'market', 'ticaret', 'satış', 'satis', 'pazarlık'],
  diplomacy: ['diploma', 'negotiat', 'talk', 'speech', 'minister material', 'lead', 'diplomasi', 'konuş'],
  art: ['art', 'paint', 'music', 'sing', 'draw', 'sculpt', 'sanat', 'resim', 'müzik'],
  scouting: ['scout', 'explor', 'find', 'track', 'look around', 'izci', 'keşif', 'kesif'],
};

const WATER_WORDS = ['water', 'sea', 'lake', 'shore', 'beach', 'coast', 'pond', 'bay', 'harbour', 'harbor', 'deniz', 'göl', 'gol', 'kıyı', 'kiyi', 'sahil'];
const EDGE_WORDS = ['cliff', 'edge', 'border', 'hill', 'ridge', 'outskirts', 'far end', 'corner', 'uç', 'kenar', 'tepe', 'yamaç', 'sınır'];
const CENTER_RE = /\b(in|at|to|on)?\s*(the\s+)?(middle|center|centre|heart|town\s*square|square|plaza|main street)\b|(?<![\p{L}])(ortaya|ortada|ortasına|merkeze|merkezde|meydana|meydanda)(?![\p{L}])/u;
const POINTER_RE = /\b(right\s+)?(there|here|over there|that spot|this spot|where i('m| am)? pointing)\b|(?<![\p{L}])(oraya|buraya|şuraya|suraya|orada|burada|şurada)(?![\p{L}])/u;
// "this / that / this area / along this / along here / inside this": the mark on the paper (ART_DIRECTION §5), when there is one
const MARK_RE = /\b(this|that|these|this one|this area|that area|this spot|this bit|this part|this patch|this line|this stroke|along (this|here|there|that|the line)|inside (this|here)|in (this|here)|on (this|that)|here|there|right here|over there)\b|(?<![\p{L}])(burası|burasi|şurası|surasi|bunu|bura|şura|buraya|oraya|şuraya|boyunca)(?![\p{L}])/u;
// "this is a field" / "make this a market district" / "this area should be a forest" / "let this be a garden" / "this will be a road" / "burası tarla olsun"
const MARK_IS_RE = /^(?:(?:make|let|turn)\s+)?(?:this|that|here|this one|this area|that area|this spot|this bit|this part|this patch|this line|this stroke|burası|burasi|şurası|surasi|bunu)(?:\s+(?:area|spot|bit|patch|part|line|one))?\s+(?:is|be|as|into|should be|will be|becomes|can be|shall be|a|an|the|olsun|olacak)\s+(?:a\s+|an\s+|the\s+|into a\s+|into an\s+)?([\p{L}][\p{L}' -]*?)(?:\s+(?:please|now|here|there))?[.!?]?$/u;
const NEAR_RE = /\b(?:near|next to|beside|by|close to|around|behind|in front of|opposite|at)\s+(?:the\s+|our\s+|a\s+)?([a-zçğıöşü' -]+?)(?:\s+(?:please|now|first|too|as well)\b|[,.!?]|$)/;
const NEAR_TR_RE = /([a-zçğıöşü]+?)(?:nın|nin|nun|nün|ın|in|un|ün)?\s+(?:yanına|yanında|yakınına|yakınında|önüne|arkasına)\b/;
const BUILD_VERB_RE = /(?<![\p{L}])(build|make|put|place|raise|erect|construct|plant|add|set up|start|create|need|want|get|give us|let'?s have|spawn|drop|summon|yap|kur|dik|inşa et|insa et|yapalım|kuralım|dikelim|ekelim|koy)(?![\p{L}])/u;
const YES_RE = /^(yes|yeah|yep|yup|sure|ok|okay|alright|all right|fine|agreed|approved?|accept(ed)?|do it|go ahead|of course|absolutely|deal|ally|allies|apologi[sz]e|evet|tamam|olur|peki|kabul)(?![\p{L}])/u;
const NO_RE = /^(no|nope|nah|not now|not yet|refuse|denied|deny|decline|ignore|dismiss|later|never|pass|hayır|hayir|olmaz|yok|reddet)(?![\p{L}])/u;
// The sovereign's phrase is "a <thing>"; where it goes is a tail. Cut the tail so only the NOUN picks the kind.
const LOCATION_TAIL_RE = /\b(on|at|by|near|next to|beside|in|into|along|there|here|over there|where|facing|towards|toward|behind|opposite|across|up|down|for|with)\b.*$/;
// A catalogue noun with one of these in front is something new ("a giant tree", "a clock tower", "a glass house").
const UNUSUAL_RE = /\b(giant|huge|enormous|massive|colossal|gigantic|towering|tiny|golden|gold|silver|glass|crystal|marble|floating|flying|upside|clock|rubber|haunted|magic|ruined|ancient|dragon|dev|kocaman|devasa|altın|cam|minik)\b/;
// Bare noun phrases are builds ("a dragon statue in the square", "two boats by the dock", "giant rubber duck").
const NOUN_PHRASE_RE = /^(?:a|an|the|some|one|two|three|four|five|six|a couple of|a few|another|more|bir|iki|üç|dört|beş)\s+[\p{L}][\p{L}' -]*$/u;
const NEIGHBOUR_WORDS = /\b(neighbou?rs?|nations?|countries|other towns?|across the (water|bay)|them|komşu(lar|lara|lar[ıi])?|the (lantern|harbour|harbor|rock|republic|riviera|sky-?hold))\b/;
// ART_DIRECTION §15: institutions ("start a police patrol team", "set up a night watch", "make a court", "open a school",
// "a builders' guild", "a festival committee", "form a council") and answers to a conflict ("talk to them", "punish the
// thief", "compensate them", "ignore the quarrel"). A watchtower / courthouse named as a building stays a build.
const INSTITUTION_NOUN_RE = /\b(police( patrol)?( team| force| squad)?|patrol( team| squad)?|guards?( team)?|constables?|constabulary|night ?watch(men)?|watch team|watchmen|sentries|sentry|militia|peacekeepers?|court( of law)?|tribunal|judges?|magistrates?|justice|school|academy|teachers?|lessons|guild|union|brotherhood|association|festival committee|committee|council|assembly of elders|choir|band|club|society|fire brigade|brigade|team of (guards|watchmen|judges|teachers))\b/;
const INSTITUTION_VERB_RE = /\b(start|set up|setup|found|form|create|make|establish|organi[sz]e|appoint|put together|raise|open|begin|assemble|let'?s have|we need|i want|give (me|us)|get (me|us)|have|hire|recruit|call|name)\b/;
const INSTITUTION_BARE_RE = /^(?:a|an|the|our|some|new|two|three|four|\d)?\s*(?:new\s+)?[\p{L}\p{N}' -]*$/u;
const CONFLICT_TALK_RE = /^(?:(?:go|please|just)\s+)?(?:talk|speak|have a word|have words|sit down|reason|mediate|make peace|calm (?:them|him|her|it)( down)?|hear (?:them|him|her|both sides) out|settle it|sort it out)(?:\s+(?:to|with)\s+(?:them|him|her|both|the two|the pair|everyone|[\p{L}' -]+))?\b/u;
const CONFLICT_PUNISH_RE = /\b(punish|fine|scold|jail|lock (?:him|her|them) up|banish|arrest|penali[sz]e|discipline|reprimand)\b/u;
const CONFLICT_COMP_RE = /\b(compensate|repay|reimburse|make it up to|pay (?:them|him|her) back|apologi[sz]e and|give (?:them|him|her) (?:bread|food|coin|something))\b/u;
const CONFLICT_IGNORE_RE = /^(?:ignore|forget|dismiss|let (?:it|them) be|leave (?:it|them)(?: be| alone)?|never mind|do nothing about)\s+(?:the\s+)?(?:theft|thief|quarrel|noise|complaint|dispute|grumbling|grudge|row|fight|conflict|jealousy)\b/u;
const CONFLICT_KIND_WORDS = { theft: /thie(f|ves)|theft|stole|steal|crates|bread/, quarrel: /quarrel|row|fight|argu|rival/, noise: /noise|nois|sleep|hammering/, land: /land|plot|dispute/, neglect: /neglect|lazy|duty|slack/, envoy: /envoy|nets|neighbou?r|nation/, jealousy: /jealous|seal|grumbl/ };

export function tidy(s) {
  return String(s || '').toLowerCase().replace(/[’`]/g, "'").replace(/[^\p{L}\p{N}'\s.,!?-]/gu, ' ').replace(/\s+/g, ' ').trim();
}
function lev(a, b) {
  const m = a.length, n = b.length; let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) { const cur = [i]; for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = cur; }
  return prev[n];
}
// "Olla's", "Olla'yı", "Ollanın" -> "olla". Only apostrophe suffixes and real multi-letter Turkish suffixes.
const stripPossessive = (w) => w.replace(/'s$/, '').replace(/'[\p{L}]{1,3}$/u, '').replace(/(nın|nin|nun|nün|yı|yi|yu|yü)$/u, '');

// Fuzzy name lookup: exact token, then 4-letter prefix (speech recognition mangles names).
export function findAgent(text, agents = [], selected = null) {
  const t = tidy(text);
  if (/\b(him|her|them|this one|selected|the selected|bu|onu)\b/.test(t) && selected) return agents.find(a => a.id === selected) || null;
  const raw = t.split(/[\s,.!?]+/).filter(Boolean);
  const tokens = Array.from(new Set([...raw, ...raw.map(stripPossessive)])).filter(Boolean);
  let best = null;
  for (const a of agents) {
    const name = tidy(a.name);
    if (!name) continue;
    if (tokens.includes(name) || t.includes(name)) return a;
    if (name.length >= 3 && tokens.some(w => w.length >= 3 && w[0] === name[0] && lev(w, name) <= (name.length >= 6 ? 2 : 1))) best = best || a;
  }
  return best;
}

// A nation by name (any word of its name that is 4+ letters: "the Lantern", "Grey Harbour", "Sorrento").
export function findNeighbour(text, neighbours = []) {
  const t = ` ${tidy(text)} `;
  for (const n of neighbours) {
    const name = tidy(n.name);
    if (name && t.includes(` ${name} `)) return n;
  }
  for (const n of neighbours) {
    const words = tidy(n.name).replace(/-/g, ' ').split(/\s+/).filter(w => w.length >= 4 && !['the', 'little', 'grey', 'gray', 'great', 'upper', 'lower', 'north', 'south', 'east', 'west', 'folk'].includes(w));
    if (words.some(w => t.includes(` ${w} `) || t.includes(` ${w}s `))) return n;
    if (n.leaderName && t.includes(` ${tidy(n.leaderName).split(' ').pop()} `)) return n;
  }
  return null;
}

// Longest alias wins; returns { id, alias } or null.
export function matchKind(text, catalogue) {
  const t = ` ${tidy(text)} `;
  for (const [alias, id] of catalogue.aliasIndex) {
    if (t.includes(` ${alias} `) || t.includes(` ${alias}s `) || t.includes(` ${alias}es `)) return { id, alias };
  }
  return null;
}

export function findBuilding(text, snapshot, catalogue) {
  const buildings = snapshot?.buildings || [];
  const t = tidy(text);
  for (const b of buildings) if (b.id && t.includes(tidy(b.id))) return b;
  for (const b of buildings) if (b.name && tidy(b.name).length > 2 && t.includes(tidy(b.name))) return b;
  const k = matchKind(t, catalogue);
  if (k) {
    const same = buildings.filter(b => b.kind === k.id);
    return same.find(b => b.status === 'done') || same[same.length - 1] || null;
  }
  return null;
}

export function detectSkill(text) {
  const t = tidy(text);
  let best = null, bestPos = Infinity;
  for (const s of SKILLS) for (const w of SKILL_WORDS[s]) { const i = t.indexOf(w); if (i >= 0 && i < bestPos) { best = s; bestPos = i; } }
  return best;
}

function detectCount(text) {
  const t = tidy(text);
  const d = t.match(/\b([1-9])\b/); if (d) return Math.min(6, Number(d[1]));
  for (const [w, n] of Object.entries(NUMBERS)) if (n > 1 && new RegExp(`(?<![\\p{L}])${w}(?![\\p{L}])`, 'u').test(t)) return n;
  return 1;
}

function resolveAt(clause, ctx) {
  const t = tidy(clause);
  const { pointer, snapshot, catalogue, mark } = ctx;
  // A mark on the paper is deliberate and exact: "here / there / this / along this", or a bare thing with no place at all,
  // goes exactly on it (a point mark beats the pointer; an area / line mark is the shape itself).
  if (mark && (MARK_RE.test(t) || POINTER_RE.test(t) || MARK_IS_RE.test(t) || !/\b(in|at|on|by|near|next to|beside|behind|into|along|across|middle|centre|center|square|edge|cliff|lake|sea|shore|coast|water)\b/.test(t))) return { mode: 'mark' };
  // The cursor is exact: when the sovereign points AND names a place ("there, in the lake"), the pointer wins.
  if (pointer && POINTER_RE.test(t)) return { mode: 'pointer' };
  if (CENTER_RE.test(t)) return { mode: 'center' };
  const near = t.match(NEAR_RE) || t.match(NEAR_TR_RE);
  if (near) {
    const ref = near[1].trim();
    if (WATER_WORDS.some(w => ref.includes(w))) return { mode: 'near', ref: 'water' };
    if (EDGE_WORDS.some(w => ref.includes(w))) return { mode: 'near', ref: 'edge' };
    const n = findNeighbour(ref, snapshot?.neighbours); if (n) return { mode: 'near', ref: n.id };
    const b = findBuilding(ref, snapshot, catalogue); if (b) return { mode: 'near', ref: b.id };
    if (/\b(middle|center|centre)\b/.test(ref)) return { mode: 'center' };
  }
  if (/\b(on|at|up|by)\s+(the\s+)?(cliff|hill|ridge|edge)\b|\b(tepeye|tepede|kenara|uca)\b/.test(t)) return { mode: 'near', ref: 'edge' };
  if (/\b(on|at|by|along|into|in|across)\s+(the\s+)?(sea|water|shore|beach|coast|lake|bay|harbour|harbor)\b|\b(denize|kıyıya|sahile|göle|gölde|denizde)\b/.test(t)) return { mode: 'near', ref: 'water' };
  if (POINTER_RE.test(t)) return pointer ? { mode: 'pointer' } : { mode: 'auto' };
  return { mode: 'auto' };
}

// Turn "build a lighthouse on the cliff please" into "a lighthouse on the cliff".
function requestPhrase(clause) {
  let r = tidy(clause).replace(/[.!?]+$/, '');
  r = r.replace(/^(and|then|also|please|hey|ok|okay|so|now|can you|could you|would you|i want|i'd like|i would like|we need|we want|we should|let'?s|lets|go|go and)\s+/g, '');
  r = r.replace(/^(build|make|put|place|raise|erect|construct|plant|add|set up|create|start|need|want|get|give us|spawn|drop|summon)\s+(up\s+|me\s+|us\s+|down\s+)?/, '');
  r = r.replace(/\s*\b(please|now|right away|quickly|asap)\b\s*$/, '').trim();
  return r || tidy(clause);
}
const titleCase = (s) => s.replace(/\b\p{L}/gu, c => c.toUpperCase());

// The NOUN of a build phrase: the request minus its location tail and leading article / count.
export function nounOf(clause) {
  const r = requestPhrase(clause).replace(/,.*$/, '');
  return r.replace(LOCATION_TAIL_RE, '').replace(/^(a|an|the|some|one|two|three|four|five|six|a couple of|a few|another|more|bir|iki|üç|dört|beş|altı)\s+/, '').replace(/\s+(there|here)$/, '').trim();
}

function parseBuild(clause, ctx) {
  const t = tidy(clause);
  // "this is a field", "make this a market district", "this area should be a forest": the mark (or the pointer) becomes that thing
  const isM = t.match(MARK_IS_RE);
  if (isM && isM[1].length >= 3 && !/^(it|that|this|mine|ours|yours|good|fine|done|ok|okay)$/.test(isM[1])) {
    const what = isM[1].replace(/^(?:a|an|the)\s+/, '').trim();
    const head = what.replace(/\s+(the size of|the shape of|shaped like|like a|like the|as big as|made of|out of|of)\s+.*$/, '');
    const kind = matchKind(head, ctx.catalogue);
    const at = ctx.mark ? { mode: 'mark' } : ctx.pointer ? { mode: 'pointer' } : { mode: 'auto' };
    if (kind && !(what !== kind.alias && UNUSUAL_RE.test(what))) return { type: 'build', kind: kind.id, at, count: 1, assign: null };
    return { type: 'build', kind: null, request: what, name: titleCase(what), at, count: 1 };
  }
  const noun = nounOf(t);
  const hasVerb = BUILD_VERB_RE.test(t);
  // "a teapot the size of a house" is a teapot: only the head of the noun phrase picks the kind
  const head = noun.replace(/\s+(the size of|the shape of|shaped like|like a|like the|as big as|as tall as|made of|out of|of)\s+.*$/, '');
  let kind = matchKind(head, ctx.catalogue) || (hasVerb && head === noun ? matchKind(t.replace(LOCATION_TAIL_RE, ''), ctx.catalogue) : null);
  // Turkish puts the place first ("ortaya bir ev"): the whole clause is the noun phrase there.
  if (!kind && /(?<![\p{L}])(yap|kur|dik|inşa|insa|yapalım|kuralım|dikelim|ekelim|koy|bir|iki|üç)(?![\p{L}])/u.test(t)) kind = matchKind(t, ctx.catalogue);
  const bare = NOUN_PHRASE_RE.test(t.replace(/[.!?]+$/, '').replace(/,.*$/, '')) && noun.length >= 3 && !/^(it|that|this|them|him|her|yes|no)$/.test(noun);
  if (!kind && !hasVerb && !bare) return null;
  if (!kind && hasVerb && /\b(minister|meeting|trade|letter|reply|tell|ask|moon|gift|neighbou?r)\b/.test(t)) return null;
  // A catalogue noun with an unusual modifier is a new thing for the Ministry ("a giant tree", "a clock tower").
  if (kind && noun !== kind.alias && UNUSUAL_RE.test(noun)) kind = null;
  const at = resolveAt(t, ctx);
  const count = detectCount(t.replace(NEAR_RE, ''));
  let assign = null;
  const withM = t.match(/\b(?:with|have|let|ask)\s+([\p{L}' -]+?)\s+(?:build|do|make|on it|work)\b/u) || t.match(/\bwith\s+([\p{L}'-]+)\b/u);
  if (withM) { const a = findAgent(withM[1], ctx.snapshot?.agents, ctx.selected); if (a) assign = [a.id]; }
  if (kind) return { type: 'build', kind: kind.id, at, count, assign };
  const request = requestPhrase(t);
  const single = count > 1 ? noun.replace(/(?<![su])s$/, '') : noun;
  return { type: 'build', kind: null, request, name: single ? titleCase(single) : null, at, count };
}

function latestLetter(snapshot, from = null) {
  const letters = snapshotLetters(snapshot);
  if (from) {
    const match = letters.filter(l => { const f = l.from; const nm = typeof f === 'string' ? f : f?.name; const id = f?.id; return id === from.id || (nm && from.name && tidy(nm) === tidy(from.name)); });
    if (match.length) return match[match.length - 1];
  }
  return letters[letters.length - 1] || null;
}

// The nation a gift or visit means: a name in the text, else "them" = the most recent letter's nation, else the friendliest.
function targetNeighbour(text, snapshot) {
  const ns = snapshot?.neighbours || [];
  const named = findNeighbour(text, ns);
  if (named) return named;
  for (const l of [...snapshotLetters(snapshot)].reverse()) {
    const f = l.from; const nm = typeof f === 'string' ? f : f?.name; const id = f?.id;
    const n = ns.find(x => x.id === id || (nm && x.name && tidy(nm) === tidy(x.name)));
    if (n) return n;
  }
  return [...ns].sort((a, b) => (b.attitude ?? 50) - (a.attitude ?? 50))[0] || null;
}

const GIFT_ITEMS = [
  [/\b(bread|loaf|loaves|basket|cake|pie|fish|cheese|wine|olives?|lemons?|food|dinner|ekmek|yemek|sepet)\b/, 'food'],
  [/\b(wood|planks?|timber|logs?|odun|kereste)\b/, 'wood'], [/\b(stone|marble|taş|tas)\b/, 'stone'],
  [/\b(coins?|gold|money|silver|altın|para)\b/, 'coin'], [/\b(goods|cloth|pots?|rugs?|lanterns?|toys?|kumaş|mal)\b/, 'goods'],
];
const TR_ITEMS = { ekmek: 'bread', yemek: 'food', sepet: 'baskets', odun: 'wood', kereste: 'timber', 'taş': 'stone', tas: 'stone', 'altın': 'gold', para: 'coins', 'kumaş': 'cloth', mal: 'goods' };
function giftOf(t, neighbours = []) {
  // the nation's name must not read as the gift ("send a gift to Little Lantern" is not a lantern)
  let s = t;
  for (const n of neighbours) {
    for (const w of `${tidy(n.name)} ${tidy(n.leaderName || '')}`.replace(/-/g, ' ').split(/\s+/)) if (w.length >= 4) s = s.replace(new RegExp(`\\b${w}s?\\b`, 'g'), ' ');
  }
  const named = s.match(/\b((?:basket|crate|cart|box|sack|barrel|jar|loaf|loaves|bottle|bag|purse|roll)s? of [\p{L}]+)/u);
  let gift = named ? `a ${named[1]}` : null, give = null;
  for (const [re, res] of GIFT_ITEMS) {
    const m = s.match(re);
    if (m) { const n = s.match(/\b([1-9]\d?)\b/); give = { [res]: n ? Math.min(50, Number(n[1])) : 3 }; if (!gift) gift = res === 'coin' ? 'a purse of coins' : `some ${TR_ITEMS[m[1]] || m[1]}`; break; }
  }
  return { gift: gift || 'a gift', give };
}

// Whole-word test that works for Turkish letters too (\b does not know ş, ğ, ı).
const W = (t, words) => words.some(w => new RegExp(`(?<![\\p{L}])${w}(?![\\p{L}])`, 'u').test(t));
function parseMoon(t) {
  const text = t.replace(/[.!?]+$/, '');
  const say = (do_) => ({ type: 'moon', do: do_, text });
  if (W(t, ['seed', 'seeds', 'tohum', 'tohumu', 'sow', 'plant'])) return [say('seed')];
  if (W(t, ['daylight', 'daytime', 'morning', 'dawn', 'noon', 'gündüz', 'sabah']) || (W(t, ['the day', 'day back', 'bring back', 'sun back', 'gün']) && !W(t, ['home', 'earth']))) return [say('daylight')];
  if (W(t, ['home', 'earth', 'back', 'return', 'leave', 'go down', 'neighbours', 'neighbors', 'plot', 'town', 'eve', 'dünya', 'dünyaya', 'dön', 'dönelim'])) return [say('go_home')];
  if (W(t, ['evening', 'golden', 'sunset', 'dusk', 'night', 'twilight', 'lantern', 'lanterns', 'akşam', 'akşamı', 'gün batımı', 'altın saat', 'gece'])) return [say('golden_hour')];
  if (W(t, ['gift', 'present', 'hediye', 'give them', 'offer them', 'bring them'])) return [say('gift')];
  if (W(t, ['peace', 'hello', 'hi', 'greet', 'greetings', 'friend', 'friends', 'we come', 'barış', 'merhaba', 'selam', 'dost'])) return [say('greet')];
  if (W(t, ['wait', 'bekle', 'bekleyelim', 'stay', 'watch', 'listen'])) return [say('golden_hour')];
  return [{ type: 'noop', why: 'the shadelings only understand a seed, a greeting, the evening and going home' }];
}

function parseClause(clause, ctx) {
  const t = tidy(clause);
  if (!t) return [];
  const { snapshot, catalogue, selected, scene } = ctx;
  const agents = snapshot?.agents || [];
  const neighbours = snapshot?.neighbours || [];
  const out = [];

  // On the moon, speech means the shadelings' six verbs (ARCHITECTURE §9).
  if (scene === 'moon') return parseMoon(t);

  // "ignore the quarrel / the theft": the named conflict is left to lie (a bare "ignore it" answers the latest letter, below)
  const openConflicts = Array.isArray(snapshot?.conflicts) ? snapshot.conflicts.filter(c => c && c.status !== 'resolved') : [];
  if (openConflicts.length && CONFLICT_IGNORE_RE.test(t)) {
    let target = null;
    for (const [kind, re] of Object.entries(CONFLICT_KIND_WORDS)) if (re.test(t)) { target = openConflicts.filter(c => c.kind === kind).at(-1) || null; if (target) break; }
    return [{ type: 'resolve_conflict', conflictId: target ? target.id : '', how: 'ignore', text: t }];
  }
  // yes / no to the latest letter (or the named nation's), possibly followed by more ("yes, build a bakery near the windmill")
  const yes = YES_RE.test(t), no = !yes && NO_RE.test(t);
  if (yes || no) {
    const letter = latestLetter(snapshot, findNeighbour(t, neighbours));
    // "yes, go ahead" / "ok ok sure": one answer, so every leading yes/no word is consumed before recursing.
    let rest = t;
    for (let guard = 0; guard < 6 && (yes ? YES_RE : NO_RE).test(rest); guard++) rest = rest.replace(yes ? YES_RE : NO_RE, '').replace(/^[\s,.!-]+/, '');
    // "accept the trade with X", "ally with X", "apologise to X", "ignore it", "not yet": the object of the answer is not a new command
    rest = rest.replace(/^(?:the\s+)?(?:trade|offer|deal|alliance|proposal|invitation|complaint)?\s*(?:with|to|from)?\s*(?:the\s+)?(?:[\p{L}' -]+)?$/u, (m) => (findNeighbour(m, neighbours) || /^(?:the\s+)?(?:trade|offer|deal|alliance|proposal|invitation|complaint|it|them|that|this)?\s*(?:with|to|from)?\s*(?:the\s+)?$/u.test(m) ? '' : m)).trim();
    if (letter) out.push({ type: 'reply_letter', letterId: letter.id, decision: yes ? 'yes' : 'no', text: t });
    else if (!rest) out.push({ type: 'noop', why: 'no letter is waiting for an answer' });
    if (rest && rest.length > 2) { const more = parseClause(rest, ctx); out.push(...(letter ? more.filter(a => a.type !== 'noop') : more)); }
    return out;
  }

  if (/\b(call|hold|convene|start|summon|have|let'?s have|gather for|time for)\b.*\b(meeting|assembly|gathering)\b|\b(call|hold|convene)\b.*\bcouncil\b|\b(meeting|assembly) (now|time|please)\b|^(meeting|assembly)$|(?<![\p{L}])(toplantı|toplanti)(?![\p{L}])/u.test(t))
    return [{ type: 'call_meeting' }];

  // ---- ART_DIRECTION §15: institutions and conflicts ----
  const instM = t.match(INSTITUTION_NOUN_RE);
  if (instM && (INSTITUTION_VERB_RE.test(t) || INSTITUTION_BARE_RE.test(t.replace(/[.!?]+$/, ''))) && !/\b(demolish|tear down|tower|house|hall\b)/.test(t.replace(/\b(night ?watch|court|school|guild)\b/g, ''))) {
    const noun = instM[0];
    const members = detectCount(t.replace(/\b(one|a|an)\b/g, ''));
    const leadM = t.match(/\b(?:led|headed|run|captained|commanded) by\s+([\p{L}'-]+)/u) || t.match(/\b(?:with|under|put)\s+([\p{L}'-]+)\s+(?:in charge|as (?:captain|chief|leader|judge|teacher|head|sergeant)|leading|at the head)/u) || t.match(/^([\p{L}'-]+)\s+(?:leads|heads|runs|should lead|will lead|can lead)\b/u);
    const lead = leadM ? findAgent(leadM[1], agents, selected) : null;
    const kindText = /police|patrol|guard|constab|militia|peacekeep/.test(noun) ? 'police patrol' : /watch|sentr/.test(noun) ? 'night watch' : /court|tribunal|judge|magistrate|justice/.test(noun) ? 'court' : /school|academy|teacher|lesson/.test(noun) ? 'school' : /guild|union|brotherhood|association/.test(noun) ? (t.match(/\b([\p{L}]+?)s?'?s?\s+(?:guild|union)\b/u) || [, ''])[1].replace(/'s?$/, '').concat(' guild').trim() : /festival/.test(noun) ? 'festival committee' : noun;
    const placeM = t.match(/\b(?:with|and|in|from)\s+(?:a|an)\s+(watch ?tower|tower|courthouse|court house|schoolhouse|guildhall|guild hall|station|lookout tower)\b/u);
    return [{ type: 'found_institution', kind: kindText, count: members > 1 ? members : 0, agentId: lead ? lead.id : '', request: placeM ? `a ${placeM[1]}` : '' }];
  }
  const conflicts = Array.isArray(snapshot?.conflicts) ? snapshot.conflicts.filter(c => c && c.status !== 'resolved') : [];
  const how = CONFLICT_TALK_RE.test(t) && !/\b(minister|neighbou?r|nation|moon|shadeling)\b/.test(t) ? 'talk' : CONFLICT_PUNISH_RE.test(t) ? 'punish' : CONFLICT_COMP_RE.test(t) ? 'compensate' : CONFLICT_IGNORE_RE.test(t) ? 'ignore' : null;
  if (how && (conflicts.length || how !== 'talk' || /\b(them|both|the two|the pair)\b/.test(t))) {
    let target = null;
    for (const [kind, re] of Object.entries(CONFLICT_KIND_WORDS)) { if (re.test(t)) { target = conflicts.filter(c => c.kind === kind).at(-1) || null; if (target) break; } }
    const named = findAgent(t.replace(/^[\p{L} ]*?\b(to|with)\b/u, ''), agents, selected);
    if (!target && named) target = conflicts.find(c => (c.parties || []).includes(named.id)) || null;
    // "talk to Olla" names someone outside every dispute: that is a message, not a settlement
    if (!(how === 'talk' && named && !target)) return [{ type: 'resolve_conflict', conflictId: target ? target.id : '', how, text: t }];
  }

  if (/\b(minister|bakan|chancellor|chief|head of|prime)\b/.test(t) && /(?<![\p{L}])(make|appoint|name|choose|pick|elect|promote|be|is|as|yap|olsun|seç|sec)(?![\p{L}])/u.test(t)) {
    const a = findAgent(t.replace(/\b(minister|bakan|our|the|new)\b/g, ' '), agents, selected);
    if (a) return [{ type: 'appoint_minister', agentId: a.id }];
    return [{ type: 'noop', why: 'could not tell which folk should be minister' }];
  }

  if (/\b(who|which of you|anyone|anybody|is there (anyone|someone)|kim|hanginiz|kimler)\b/.test(t) && /(?<![\p{L}])(good|best|skilled|can|knows|know|able|talented|handy|iyi|yapabilir|bilir|usta)(?![\p{L}])/u.test(t))
    return [{ type: 'ask_crowd', question: clause.trim(), skill: detectSkill(t) }];

  // ---- §9: the moon, the globe, the nations ----
  if ((/\b(moon|shadelings?|ay'?a|aya|pliss\w*|lantern planet|other planet|another planet|the lounge)\b/.test(t) && (/\b(go|fly|launch|visit|travel|take|let'?s|off|up|ready|blast|leave for|head|gidelim|uçalım|ucalim|gidiyoruz)\b/.test(t) || /^(to )?(the moon|pliss[eé])$|^(moon|pliss[eé])$/.test(t)))
    || /^(launch|lift ?off|blast ?off|fırlat|kalkış)\b/.test(t))
    return [{ type: 'go_moon' }];
  if (/\b(come back|back home|go home|take (me|us) (back|home|down)|back down|down to the (plot|ground|town|village)|return to (the )?(plot|earth|home)|eve dön|geri dön|aşağı)\b/.test(t))
    return [{ type: 'show', target: 'home' }];
  if (/\b(show|see|look at|view|visit|fly to|take (me|us) to|go to|zoom (out )?to|pull up to|göster|gidelim|bakalım|ziyaret)\b/.test(t) || /^(the )?(neighbou?rs|nations|globe|world)\b/.test(t)) {
    const named = findNeighbour(t, neighbours);
    if (named && !/\b(all|every|the neighbou?rs\b)/.test(t)) return [{ type: 'visit_neighbour', neighbourId: named.id }];
    if (NEIGHBOUR_WORDS.test(t) || /\b(globe|world|planet|orbit|map|from above|the sky|dünya|dünyayı|haritayı|komşuları)\b/.test(t)) return [{ type: 'show', target: 'globe' }];
  }
  // gifts: "send them a basket of bread", "send bread to our neighbours", "a gift for Little Lantern", "komşulara ekmek gönder"
  if ((/\b(send|gift|give|bring|carry|take|offer|deliver|ship|gönder|götür|verelim)\b/.test(t) || /\b(gift|present|hediye)\b/.test(t)) && (NEIGHBOUR_WORDS.test(t) || findNeighbour(t, neighbours) || /\b(gift|present|hediye)\b/.test(t)) && !/\b(trade|for \d+|in exchange)\b/.test(t)) {
    const n = targetNeighbour(t, snapshot);
    if (n) {
      // the nation's own envy / greeting letter asked for exactly this: answer it rather than a second gift
      const letter = latestLetter(snapshot, n);
      const asksGift = letter && (letter.options || []).some(o => /gift|send/i.test(typeof o === 'string' ? o : o.label || o.says || ''));
      if (asksGift) return [{ type: 'reply_letter', letterId: letter.id, decision: 'yes', text: t }];
      return [{ type: 'send_gift', neighbourId: n.id, ...giftOf(t, neighbours) }];
    }
    return [{ type: 'noop', why: 'there is no neighbour to send that to yet' }];
  }

  const nameM = t.match(/\b(?:call|name)\s+(?:our|the|this)\s+(?:settlement|town|village|city|place|civilisation|civilization|hamlet|camp|land)\s+([\p{L}\p{N}' -]+)/u) || t.match(/\b(?:our|the)\s+(?:settlement|town|village|city)\s+(?:is|shall be|will be)\s+(?:called|named)\s+([\p{L}\p{N}' -]+)/u);
  if (nameM) return [{ type: 'name_settlement', name: titleCase(nameM[1].trim()) }];

  if (/(?<![\p{L}])(demolish|tear down|knock down|remove|destroy|take down|get rid of|yık|yik|kaldır|kaldir)(?![\p{L}])/u.test(t)) {
    const b = findBuilding(t, snapshot, catalogue);
    return [b ? { type: 'demolish', buildingId: b.id } : { type: 'noop', why: 'could not tell which building to demolish' }];
  }

  if (/\b(trade|swap|exchange|sell|buy|takas)\b/.test(t) || (/\boffer\b/.test(t) && /\d+/.test(t))) {
    const n = findNeighbour(t, neighbours) || neighbours[0];
    const m = t.match(/(\d+)\s+(\p{L}+)\s+(?:for|in exchange for|against|karşılığında)\s+(\d+)\s+(\p{L}+)/u);
    const res = (w) => RESOURCES.find(r => w.startsWith(r)) || (w.startsWith('money') || w.startsWith('gold') ? 'coin' : null);
    if (n && m && res(m[2]) && res(m[4])) return [{ type: 'trade', neighbourId: n.id, give: { [res(m[2])]: Number(m[1]) }, get: { [res(m[4])]: Number(m[3]) } }];
    return [{ type: 'noop', why: 'a trade needs a neighbour and amounts, e.g. "trade 10 wood for 5 food with Grey Harbour"' }];
  }

  const restM = t.match(/\b(?:let|tell|send)\s+([\p{L}'-]+)\s+(?:to\s+)?(rest|sleep|take a break|have a rest|dinlen)/u) || t.match(/^([\p{L}'-]+)\s+(?:should|can|may)\s+(rest|sleep|take a break)/u);
  if (restM) { const a = findAgent(restM[1], agents, selected); if (a) return [{ type: 'assign', agentIds: [a.id], to: 'rest' }]; }

  const assignM = t.match(/\b(?:assign|send|put|move|get|have|let|ask)\s+([\p{L}' -]+?)\s+(?:to|on|onto|at|work on|work at|work in|build|help with)\s+(?:the\s+|our\s+)?(.+)$/u) || t.match(/^([\p{L}'-]+)\s+(?:should|can|will)\s+(?:work|build|help)\s+(?:on|at|in|with)\s+(?:the\s+)?(.+)$/u) || t.match(/^([\p{L}'-]+)(?:'?[yiıuü]) (.+?)(?:ye|ya|e|a) (?:gönder|ata|koy)/u);
  if (assignM) {
    const names = assignM[1].split(/\s+(?:and|ve|,)\s+|,\s*/).map(s => findAgent(s, agents, selected)).filter(Boolean);
    if (names.length) {
      const target = assignM[2];
      if (/\b(rest|sleep|break|home|dinlen)\b/.test(target)) return [{ type: 'assign', agentIds: names.map(a => a.id), to: 'rest' }];
      const b = findBuilding(target, snapshot, catalogue);
      if (b) return [{ type: 'assign', agentIds: names.map(a => a.id), to: b.id }];
      if (/\b(idle|nothing|free|stop)\b/.test(target)) return [{ type: 'assign', agentIds: names.map(a => a.id), to: 'idle' }];
      const k = matchKind(target, catalogue);
      if (k) return [{ type: 'noop', why: `there is no ${catalogue.byId.get(k.id)?.name?.toLowerCase() || k.id} to send ${names.map(a => a.name).join(' and ')} to yet` }];
    }
  }

  const msgM = t.match(/^(?:tell|ask|say to|write to|message|inform)\s+([\p{L}'-]+)\s+(?:that\s+|to\s+)?(.+)$/u);
  if (msgM) {
    const a = findAgent(msgM[1], agents, selected);
    if (a) return [{ type: 'message_agent', agentId: a.id, text: msgM[2].trim() }];
  }

  const b = parseBuild(t, ctx);
  if (b) return [b];
  return [{ type: 'noop', why: `could not map "${clause.trim()}"` }];
}

const SPLIT_RE = /\s*(?:\band then\b|\bthen\b|\bafter that\b|\bsonra\b|;|\. )\s*|\s*,?\s*\band\s+(?=(?:also\s+|then\s+|a\s|an\s|the\s|some\s|build|make|put|place|call|appoint|tell|ask|assign|send|demolish|trade|plant|show|visit|start|set up|found|form|open|talk|punish|compensate|ignore|\d))/i;

export function parseIntent({ transcript, pointer = null, selected = null, snapshot = null, catalogue, scene = 'earth', mark = null }) {
  const text = String(transcript || '').trim();
  mark = normaliseMark(mark);
  const ctx = { pointer, selected, snapshot, catalogue, scene: scene === 'moon' ? 'moon' : 'earth', mark };
  if (!text) return { actions: [{ type: 'noop', why: 'nothing heard' }], say: { from: 'minister', text: 'We heard only the wind, sovereign.' } };
  let raw = [];
  const clauses = text.split(SPLIT_RE).map(s => s.trim()).filter(Boolean);
  if (clauses.length > 1) {
    const parts = clauses.map(c => parseClause(c, ctx));
    if (parts.every(p => p.length && p.every(a => a.type !== 'noop'))) raw = parts.flat();
  }
  if (!raw.length) raw = parseClause(text, ctx);
  const { actions } = normaliseActions(raw, snapshot, catalogue, { scene: ctx.scene, mark, pointer });
  const final = actions.length ? actions : [{ type: 'noop', why: 'could not map that' }];
  return { actions: final, say: sayFor(final, ctx) };
}

function sayFor(actions, ctx) {
  const a = actions[0];
  const name = (k) => ctx.catalogue.byId.get(k)?.name?.toLowerCase() || k;
  const nation = (id) => (ctx.snapshot?.neighbours || []).find(n => n.id === id)?.name || 'the neighbours';
  switch (a.type) {
    case 'build':
      if (!a.kind) return { from: 'ministry', text: `We have never built ${a.request}. The pencils are out; the builders will prepare the ground${a.at.mode === 'mark' ? ' on your mark' : ''}.` };
      if (a.at.mode === 'mark') { const k = a.at.mark?.kind, sh = ctx.catalogue.byId.get(a.kind)?.shape || 'point'; return { from: 'ministry', text: `${a.count > 1 ? a.count + ' ' + name(a.kind) + 's' : 'A ' + name(a.kind)}, ${k === 'area' ? (sh === 'area' ? 'filling the outline you drew' : 'at the heart of the outline you drew') : k === 'line' ? 'along the line you drew' : 'exactly on your mark'}.` }; }
      return { from: 'ministry', text: `${a.count > 1 ? a.count + ' ' + name(a.kind) + 's' : 'A ' + name(a.kind)} ${a.at.mode === 'center' ? 'in the middle' : a.at.mode === 'pointer' ? 'where you point' : a.at.mode === 'near' ? 'near the ' + (a.at.ref === 'water' ? 'water' : a.at.ref === 'edge' ? 'edge' : (ctx.snapshot?.buildings || []).find(b => b.id === a.at.ref)?.name?.toLowerCase() || 'place') : 'where there is room'}. The site is marked.` };
    case 'ask_crowd': return { from: 'minister', text: 'Your question is posted on the board. Letters will follow.' };
    case 'appoint_minister': return { from: 'ministry', text: 'The seal changes hands.' };
    case 'call_meeting': return { from: 'minister', text: 'The folk are called to gather.' };
    case 'reply_letter': return { from: 'minister', text: a.decision === 'yes' ? 'Your answer is yes. It will be delivered.' : a.decision === 'no' ? 'Your answer is no. It will be delivered gently.' : 'Your answer will be delivered.' };
    case 'assign': return { from: 'ministry', text: a.to === 'rest' ? 'They are sent to rest.' : 'They are reassigned.' };
    case 'demolish': return { from: 'ministry', text: 'It will come down by evening.' };
    case 'trade': return { from: 'minister', text: 'A courier runs to the neighbours with your offer.' };
    case 'send_gift': return { from: 'minister', text: `A courier sets off for ${nation(a.neighbourId)} with ${a.gift}.` };
    case 'visit_neighbour': return { from: 'minister', text: `We rise above the bay and cross to ${nation(a.neighbourId)}.` };
    case 'show': return { from: 'minister', text: a.target === 'home' ? 'Down to the plot by the sea.' : 'Up, above the bay, where the three nations can be seen at once.' };
    case 'go_moon': return { from: 'minister', text: 'The nations have been asked. If they agree, we fly.' };
    case 'moon': return { from: 'minister', text: a.do === 'seed' ? 'A seed, offered.' : a.do === 'golden_hour' ? 'We wait for the gold.' : a.do === 'daylight' ? 'The day returns.' : a.do === 'greet' ? 'Our greeting hangs in the still air.' : a.do === 'gift' ? 'A gift, laid in the grass.' : 'Home, then.' };
    case 'name_settlement': return { from: 'minister', text: `From today this place is ${a.name}.` };
    case 'message_agent': return { from: 'minister', text: 'Your words are carried over.' };
    case 'found_institution': return { from: 'ministry', text: `A ${a.name || a.kind} is founded; the Ministry picks the hands${a.request ? ' and marks a site for ' + a.request : ''}.` };
    case 'resolve_conflict': return { from: 'minister', text: a.how === 'punish' ? 'It will be punished, and seen to be.' : a.how === 'compensate' ? 'They will be made whole from the crates.' : a.how === 'ignore' ? 'We let it lie, then.' : 'I will have a word with them.' };
    default: return { from: 'minister', text: `Forgive me, sovereign: ${a.why}. Try "build a house in the middle" or "who is good at baking?"` };
  }
}
