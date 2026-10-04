// Request text helpers: the noun of a creation ("a lighthouse near the house" -> "lighthouse"), the location tail
// ("near the house" -> an anchor), the category and water-ness of a thing. Pure string work, shared by actions and state.

const PREPS = 'on|onto|upon|at|by|near|nearby|close to|next to|in|into|inside|beside|behind|in front of|across|over|under|underneath|around|along|above|below|beneath|toward|towards|outside|between|opposite|facing|there|here|where|for|from|overlooking';
const TAIL_RE = new RegExp(`^(.*?)[,;]?\\s+(?:right |just |somewhere |over |up |down |out )?(?:${PREPS})\\b(.*)$`, 'i');
const LEAD_RE = /^(?:please\s+|ok\s+|okay\s+|so\s+|now\s+|and\s+|then\s+)*(?:(?:let's|let us|lets|can we|could we|can you|could you|i want|i'd like|i would like|we need|we want|give us|give me|make us|make me)\s+)?(?:please\s+)?(?:build|make|put|place|create|add|raise|erect|plant|spawn|drop|set|have|get|install|draw|paint|conjure|summon|want|need)?\s*(?:us|me|up)?\s*/i;
const ART_RE = /^(?:a|an|the|some|one|two|three|four|five|six|\d+|a couple of|a few|several|a pair of)\s+/i;
const ANOTHER_RE = /^(?:another(?: one)?(?: of (?:those|them|these))?|one more|the same(?: again)?|same again|again|more of (?:those|them|these)|another of (?:those|them))$/i;

export const clean = s => String(s || '').toLowerCase().replace(/[“”"']/g, '').replace(/[.,!?;:]+$/g, '').replace(/\s+/g, ' ').trim();

// "build a lighthouse on the cliff please" -> { noun:'lighthouse', tail:'on the cliff', another:false, raw }
export function splitRequest(text) {
  let t = clean(text).replace(/\s+please$/, '');
  t = t.replace(LEAD_RE, '').trim();
  let tail = '';
  // a leading tail: "next to the duck, a swan" -> noun "a swan", tail "next to the duck"
  const lead = t.match(/^((?:next to|close to|near|by|beside|behind|in front of|on|in|at|over|under|around|along)\b[^,]*),\s*(.+)$/);
  if (lead) { tail = lead[1].trim(); t = lead[2].trim(); }
  const m = t.match(TAIL_RE);
  if (m && m[1].trim()) { tail = (tail ? tail + ' ' : '') + t.slice(m[1].length).trim(); t = m[1].trim(); }
  t = t.replace(/[,;:]+$/g, '').trim();
  const another = ANOTHER_RE.test(t) || ANOTHER_RE.test(t.replace(ART_RE, ''));
  const noun = t.replace(ART_RE, '').trim();
  return { noun, tail, another, raw: clean(text) };
}

// the stripped noun phrase ("a lighthouse near the house" -> "lighthouse")
export const stripLocation = text => splitRequest(text).noun;
// the head of the noun phrase ("giant rubber duck" -> "duck"), singular
export function headNoun(noun) {
  const words = clean(noun).split(' ').filter(w => w && !/^(of|and|with)$/.test(w));
  const w = words[words.length - 1] || '';
  return w.length > 3 && /s$/.test(w) && !/ss$/.test(w) ? w.slice(0, -1) : w;
}

const WORDS = {
  landmark: ['lighthouse', 'tower', 'monument', 'statue', 'arch', 'obelisk', 'pyramid', 'castle', 'palace', 'cathedral', 'colossus', 'dragon', 'fortress', 'dome', 'spire', 'minaret', 'pagoda', 'stadium', 'colosseum', 'amphitheatre', 'amphitheater', 'wheel', 'rocket', 'skyscraper', 'gate', 'belltower', 'campanile', 'observatory', 'windmill', 'bridge', 'aqueduct', 'ziggurat', 'mausoleum', 'shrine', 'totem', 'beacon', 'crane', 'ship', 'galleon', 'zeppelin', 'balloon', 'airship', 'whale', 'giant', 'huge', 'enormous', 'tall', 'great', 'grand'],
  prop: ['duck', 'bench', 'boat', 'raft', 'cart', 'wagon', 'barrel', 'crate', 'lantern', 'lamp', 'sign', 'signpost', 'flag', 'flagpole', 'pole', 'basket', 'bucket', 'chair', 'table', 'umbrella', 'parasol', 'swing', 'kite', 'buoy', 'canoe', 'gondola', 'sailboat', 'dinghy', 'swan', 'cat', 'dog', 'goat', 'sheep', 'cow', 'chicken', 'pig', 'horse', 'donkey', 'snowman', 'scarecrow', 'teapot', 'cup', 'mug', 'bottle', 'ball', 'box', 'chest', 'bell', 'anchor', 'wheelbarrow', 'bicycle', 'bike', 'car', 'bus', 'tractor', 'tent', 'hammock', 'fence', 'gazebo', 'kiosk', 'stall', 'pot', 'vase', 'bird', 'frog', 'turtle', 'fish', 'octopus', 'robot', 'toy', 'cake', 'pie', 'bread', 'mushroom', 'hat', 'shoe', 'boot', 'sock', 'piano', 'guitar', 'drum', 'clock', 'mailbox', 'postbox', 'sundial', 'birdhouse', 'doghouse', 'dolphin', 'seal', 'unicorn', 'elephant', 'giraffe', 'lion', 'bear', 'rabbit', 'bunny', 'owl'],
  nature: ['tree', 'pine', 'cypress', 'oak', 'palm', 'olive', 'willow', 'birch', 'maple', 'bush', 'shrub', 'hedge', 'flower', 'rose', 'tulip', 'sunflower', 'rock', 'boulder', 'cliff', 'hill', 'mound', 'pond', 'meadow', 'grass', 'reed', 'cactus', 'vine', 'lily', 'waterlily', 'moss', 'fern', 'bamboo', 'orchard', 'woods', 'forest', 'grove', 'island', 'dune', 'stump', 'log', 'lotus', 'volcano', 'geyser', 'waterfall', 'spring', 'crater', 'stone']
};
const WATER_WORDS = ['duck', 'boat', 'ship', 'raft', 'swan', 'buoy', 'lily', 'waterlily', 'lotus', 'island', 'sailboat', 'canoe', 'gondola', 'ferry', 'submarine', 'whale', 'dolphin', 'octopus', 'galleon', 'dinghy', 'yacht', 'barge', 'kraken', 'turtle', 'frog', 'fish', 'seal', 'pedalo', 'kayak', 'lighthouse boat'];

const wordsOf = s => clean(s).replace(/[^a-z0-9 ]+/g, ' ').split(' ').filter(Boolean).map(w => w.length > 3 && /s$/.test(w) && !/ss$/.test(w) ? w.slice(0, -1) : w);

// 'building' | 'prop' | 'landmark' | 'nature' from the words of a request noun. The head noun decides; size words
// promote a prop to a landmark ("a giant rubber duck" is still a prop, but a bigger one: see sizeOf).
export function inferCategory(noun) {
  const ws = wordsOf(noun);
  if (!ws.length) return 'building';
  const head = ws[ws.length - 1];
  for (const c of ['prop', 'nature', 'landmark']) if (WORDS[c].includes(head)) return c;
  for (const c of ['landmark', 'prop', 'nature']) if (ws.some(w => WORDS[c].includes(w))) return c;
  return 'building';
}
export const SIZE_WORDS = ['giant', 'huge', 'enormous', 'massive', 'colossal', 'towering', 'tall', 'great', 'grand', 'big', 'large', 'gigantic'];
export const sizeOf = noun => { const ws = wordsOf(noun); return ws.some(w => ['giant', 'huge', 'enormous', 'massive', 'colossal', 'gigantic', 'towering'].includes(w)) ? 'giant' : ws.some(w => ['big', 'large', 'tall', 'great', 'grand'].includes(w)) ? 'big' : ws.some(w => ['tiny', 'little', 'small', 'wee', 'mini'].includes(w)) ? 'small' : 'normal'; };
// things that float: placed ON water when the request (or the asset) does not say otherwise
export const isWaterThing = noun => wordsOf(noun).some(w => WATER_WORDS.includes(w));

const WATER_NOUNS = 'lake|pond|water|sea|bay|ocean|waves|harbou?r|lagoon';
const ON_WATER_RE = new RegExp(`\\b(?:in|into|inside|on|onto|upon|out on|across|out in|afloat on|floating on|floating in)\\s+(?:the\\s+|our\\s+)?(?:middle of the\\s+|centre of the\\s+|center of the\\s+)?(${WATER_NOUNS})\\b`);
const SEA_RE = /\b(sea|bay|ocean|waves|harbou?r|lagoon|coast|cliff|cliffs|shore|beach|headland|promontory|quay|pier|seaside|seafront)\b/;
const CENTRE_RE = /\b(middle|centre|center|square|plaza|piazza|heart|town|village)\b/;

// the location tail -> an anchor for findSpot, or null when the tail says nothing useful
// -> { mode:'water', water:'lake'|'sea' } | { mode:'near', ref:'edge'|'water'|<text> } | { mode:'center' }
export function anchorFromTail(tail) {
  let t = clean(tail).replace(/^(?:over |up |down |right )?(?:there|here)[,;]?\s*/, '').replace(/[,;]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!t) return null;
  const w = t.match(ON_WATER_RE);
  if (w) return { mode: 'water', water: /^(lake|pond)$/.test(w[1]) ? 'lake' : 'sea' };
  if (/\b(lake|pond)\b/.test(t)) return { mode: 'near', ref: 'water' };
  if (SEA_RE.test(t)) return { mode: 'near', ref: 'edge' };
  if (CENTRE_RE.test(t)) return { mode: 'center' };
  if (/^(?:over |up |down |right )?(?:there|here)$/.test(t)) return null;   // a pointer, if there is one
  t = t.replace(/\bin front of\b/g, 'before').replace(/\bnext to\b/g, 'beside').replace(/\bclose to\b/g, 'near');
  const m = t.match(/^(?:right |just |somewhere )?(?:over |up |down )?(?:to|of|by|near|beside|behind|before|at|on|in|around|from|facing|opposite|along|above|below|under|over|across|for|towards?|into|onto|inside|outside|between|underneath|beneath|upon|overlooking)\s+(?:the|our|that|this|my|a|an|your)?\s*(.+)$/);
  if (m && m[1]) return { mode: 'near', ref: m[1].trim() };
  return null;
}

// "Giant Rubber Duck"
export const titleOf = noun => clean(noun).replace(/\b\w/g, c => c.toUpperCase()) || 'Something New';
