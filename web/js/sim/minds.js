// Minds (ART_DIRECTION §18): every folk is its own small agent. This file is the PURE half: personas (the cast), each
// folk's memory stream and reflections, the relationships between folk, the request bodies the server's minds routes
// take, the execution of an intent through the sim's own systems, agent-to-agent conversations, and the director's
// effects. Live, the server answers (Haiku 4.5 per folk, Fable 5.1 as the director); offline the mocks here answer in
// the same shapes, so the society visibly "thinks" without a key. No THREE, no DOM, no network, no rng stream (the
// mocks hash their inputs: the same moment gives the same line, which reads as character, and replays never drift).
import { hashString } from './rng.js';
import { nudgeMood, OUR_SPECIES } from './society.js';
import { setTask, clearTask, releaseAgent, siteSpot } from './tasks.js';
import { remember, trimReply } from './talk.js';
import { startConflict } from './conflicts.js';
import { proposeVenture } from './ventures.js';
import { titleOf } from './parse.js';
import { dist } from './geometry.js';
import * as L from './letters.js';

export const MIND = {
  thinkEvery: [30, 40],       // s between a folk's own decisions (staggered per folk)
  firstThinkAfter: 6,         // s after the cast lands until the first decisions
  triggerDelay: [1, 3],       // s after an event that concerns a folk until they think about it
  timeoutMs: 5000,            // a think / converse call later than this is dropped: the rules carry on
  maxPerMin: 40,              // global budget: minds calls per wall-clock minute
  concurrency: 3,             // minds calls in flight at once
  memoryMax: 40,              // items kept per folk
  memorySent: 20,             // items sent with a think / talk prompt
  reflectEvery: 8,            // new items between reflections (one Haiku call summarising them)
  reflectionsKept: 6, reflectionsSent: 3,
  sayTtl: 4.5, chatGap: 2.6,  // s a bubble stays; s between the lines of a conversation
  converseTurns: [2, 4],
  directorEveryMs: 600000,    // the director's cadence (AGORA_DIRECTOR_EVERY_MS; Sueda floated hourly for real sessions)
  directorMinGapMs: 60000,    // never two directions closer than this (milestones)
  affinityStep: 0.08,
  backoff: [8, 120]           // s: the retry delay after a failed call doubles from the first to the second number
};

// the executable action vocabulary (what a think answer may ask for; everything else is read as `work`)
export const MIND_ACTIONS = ['work', 'rest', 'wander_to', 'talk_to', 'help', 'complain', 'propose_venture', 'write_letter', 'vote', 'refuse', 'celebrate', 'steal', 'gossip'];
export const TENSION_KINDS = ['rivals', 'friends', 'crush', 'grudge'];
export const DIRECTOR_EVENTS = ['conflict', 'visitor', 'weather', 'festival', 'opportunity'];

const pick = (arr, seed) => arr[hashString(String(seed)) % arr.length];
const words = s => String(s || '').trim().split(/\s+/).filter(Boolean);
export const clampWords = (s, n) => { const w = words(s); return (w.length <= n ? w : w.slice(0, n)).join(' ').replace(/[,;:]$/, ''); };
const cap = s => (s ? s[0].toUpperCase() + s.slice(1) : s);
const alive = a => a && a.status !== 'left';
const pairKey = (x, y) => (x < y ? `${x}|${y}` : `${y}|${x}`);
const r2 = v => +Number(v).toFixed(2);
const MOOD_WORD = m => (m >= 80 ? 'very happy' : m >= 60 ? 'well' : m >= 40 ? 'so-so' : m >= 20 ? 'low' : 'miserable');

// ---------------------------------------------------------------------------------------------------------------------
// Memory and relationships
// ---------------------------------------------------------------------------------------------------------------------
export function mindOf(a) {
  if (!a.mind) a.mind = { memory: [], reflections: [], unreflected: 0, lastThinkAt: -1e9, dueAt: null, trigger: null, intent: null, fails: 0, calls: 0, vote: null, source: null };
  return a.mind;
}

// one observation for a folk: what they saw, heard, said, what the sovereign did to them. imp 1 (noise) .. 5 (life-changing)
export function observe(game, a, text, { imp = 1, kind = 'event', about = null } = {}) {
  if (!a || !text) return null;
  const m = mindOf(a);
  const t = String(text).replace(/\s+/g, ' ').trim().slice(0, 160);
  const last = m.memory[m.memory.length - 1];
  if (last && last.text === t) return last;                       // the same thing twice in a row is one memory
  const item = { t: +game.state.t.toFixed(1), day: game.state.day, text: t, imp: Math.max(1, Math.min(5, Math.round(imp))), kind, ...(about ? { about } : {}) };
  m.memory.push(item);
  if (m.memory.length > MIND.memoryMax) { m.memory.sort((p, q) => p.t - q.t); m.memory.splice(0, m.memory.length - MIND.memoryMax); }
  m.unreflected++;
  remember(a, t);                                                  // the small talk memory the card shows stays in step
  return item;
}
export const needsReflection = a => !!a.mind && a.mind.unreflected >= MIND.reflectEvery;
export function addReflection(game, a, text) {
  const m = mindOf(a);
  const t = String(text || '').replace(/\s+/g, ' ').trim().slice(0, 200);
  if (!t) return null;
  m.reflections.push({ t: +game.state.t.toFixed(1), day: game.state.day, text: t });
  if (m.reflections.length > MIND.reflectionsKept) m.reflections.shift();
  m.unreflected = 0;
  game.emit('mind:reflect', { agentId: a.id, text: t });
  return t;
}
// what goes into a prompt: the most recent items (the important ones survive longer) and the last reflections
export function memoryForPrompt(a, { items = MIND.memorySent, reflections = MIND.reflectionsSent } = {}) {
  const m = mindOf(a);
  const recent = m.memory.slice(-items).map(x => `d${x.day}: ${x.text}`);
  const old = m.memory.slice(0, -items).filter(x => x.imp >= 4).slice(-3).map(x => `d${x.day}: ${x.text}`);
  return { items: [...old, ...recent], reflections: m.reflections.slice(-reflections).map(x => x.text) };
}

export function affinity(state, x, y) { const r = state.relationships && state.relationships[pairKey(x, y)]; return r ? r.a : 0; }
export function nudgeAffinity(game, x, y, delta, why = '') {
  const { state } = game;
  if (!x || !y || x === y || !delta) return 0;
  state.relationships = state.relationships || {};
  const k = pairKey(x, y);
  const r = state.relationships[k] || (state.relationships[k] = { a: 0, n: 0 });
  r.a = r2(Math.max(-1, Math.min(1, r.a + delta))); r.n++;
  if (why) r.why = why;
  game.emit('relationship', { a: k.split('|')[0], b: k.split('|')[1], affinity: r.a, delta: r2(delta), why });
  return r.a;
}
export function relationshipsOf(state, a, { max = 6 } = {}) {
  return state.agents.filter(o => alive(o) && o.id !== a.id).map(o => ({ id: o.id, name: o.name, affinity: affinity(state, a.id, o.id) })).sort((p, q) => Math.abs(q.affinity) - Math.abs(p.affinity)).slice(0, max);
}
// the strongest bonds in town, for the director and the snapshot
export function relationshipsBrief(state, { max = 6 } = {}) {
  const rel = state.relationships || {};
  const name = id => (state.agents.find(a => a.id === id) || { name: id }).name;
  return Object.entries(rel).map(([k, r]) => { const [a, b] = k.split('|'); return { a, b, names: `${name(a)} & ${name(b)}`, affinity: r.a }; }).sort((p, q) => Math.abs(q.affinity) - Math.abs(p.affinity)).slice(0, max);
}

// ---------------------------------------------------------------------------------------------------------------------
// The cast: 12 distinct personas. Live: Fable writes them (POST /api/minds/cast). Mock: hand-written seeds, one each.
// ---------------------------------------------------------------------------------------------------------------------
export const PERSONA_FIELDS = ['backstory', 'voice', 'quirks', 'values', 'fear', 'goal', 'opinions', 'secret'];

// Hand-written characters (not templates): each is a different person with a different way of talking. `trades` says
// who they fit best; `{name}` / `{sp}` / `{flyer}` are the only substitutions. A settler takes the first unused seed that
// fits their trade, else the least-used seed by hash, so twelve folk are twelve different people on every seed.
export const SEEDS = [
  { key: 'drystone', trades: ['builder'], backstory: '{name} learned walls from a grandmother who built sheepfolds on a wet hill, and lost a first house to a flood that came in the night. Everything {name} raises now sits on a stone footing, and {name} checks it twice before sleeping.',
    voice: 'clipped and dry; counts things out loud; one short sentence, then a longer one if you earn it', quirks: ['taps every wall twice before trusting it', 'names each tool and scolds the chisel'], values: ['things that last past their maker', 'an honest day with sore hands'], fear: 'water rising in the dark with nobody awake', goal: 'a stone house with a proper roof before the first storm', secret: 'still keeps the key to the house the flood took' },
  { key: 'apprentice', trades: ['builder', 'crafter'], backstory: 'For three years {name} drew the arches and a guild master signed them. The day the master was praised for a bridge {name} had designed, {name} walked out with a bag of chalk and never went back.',
    voice: 'fast and boastful, trails off mid-brag when nobody reacts; says "obviously" a lot', quirks: ['sketches arches in the dirt with a toe while talking', 'whistles the same three notes when annoyed'], values: ['credit where it is due', 'a thing that is beautiful because it works'], fear: 'being forgotten the moment the scaffold comes down', goal: 'raise the tallest thing in town and hear it called by my name', secret: 'has never actually finished a building alone' },
  { key: 'lamproom', trades: ['builder', 'scout', 'courier'], backstory: '{name} grew up in a lamp room above a reef, counting the seconds between flashes, and still counts the seconds between everything. The lamp went out the year the money did; {name} came here looking for a cliff.',
    voice: 'slow and exact, nautical words, pauses to count; never raises the voice', quirks: ['turns to face the sea before answering a hard question', 'keeps one pebble from every place slept in'], values: ['keeping watch for others', 'a promise kept to the minute'], fear: 'dark water with no light on it', goal: 'a lighthouse on the cliff, lit every night', secret: 'cannot swim' },
  { key: 'ledger', trades: ['baker', 'trader'], backstory: '{name} ran a harbour bakery that fed a whole quay on credit, and kept the tab in a ledger that went down with the boat it was on. Nobody was ever asked to pay. {name} flew here with the recipe and the habit of feeding people first.',
    voice: 'warm and teasing, speaks in offers ("you look like a two-loaf day"); gives everyone a nickname', quirks: ['sniffs a stranger\'s hands to guess their trade', 'draws a little loaf next to every signature'], values: ['nobody goes hungry on my watch', 'a fair tab, written down'], fear: 'an oven gone cold with people queuing outside', goal: 'a bakery with an oven wide enough for the whole town\'s bread', secret: 'owes the Loaf Republic for a sack of flour that was never paid' },
  { key: 'pastry', trades: ['baker', 'farmer', 'dreamer'], backstory: '{name} learned pastry in a kitchen where every order was shouted, and left on the morning a tray of a hundred perfect horns was thrown at a wall. Hammers still make {name} flinch. The folding, though, {name} can do in the dark.',
    voice: 'flowery and nervous, apologises halfway through a sentence, then finishes it beautifully', quirks: ['folds any scrap of paper into a triangle', 'hums low to steady the hands before speaking'], values: ['gentleness, even when busy', 'getting one thing exactly right'], fear: 'raised voices', goal: 'a small tea house by the water where nobody shouts', secret: 'bakes a horn every night and eats it alone' },
  { key: 'almanac', trades: ['farmer'], backstory: '{name} keeps an almanac in the head: which wind brings rain, how many days a frost waits. {name} is right more often than not and never says so twice. The old farm was sold under {name} by a cousin; the seed came along in a sock.',
    voice: 'plain, proverbial, few words; answers a question with a weather sign', quirks: ['tastes the soil before agreeing to anything', 'argues with the wind, quietly, and sometimes wins'], values: ['patience', 'seed saved for next year'], fear: 'a dry year with nothing put by', goal: 'a farm by the lake and a granary before winter', secret: 'the almanac is mostly guesswork and luck' },
  { key: 'orchard', trades: ['farmer', 'dreamer', 'artist'], backstory: '{name} came for the light, nothing else. Planting is a way of staying somewhere after you leave it, and {name} means to leave an orchard on every hill {name} ever sleeps on.',
    voice: 'slow and wandering, half the sentences are about the sky; calls everyone "love"', quirks: ['sleeps outdoors on purpose when there is a roof', 'keeps seeds in a sock and counts them at night'], values: ['growing things', 'the long view over the quick win'], fear: 'being hurried', goal: 'an orchard on the hill that outlives me', secret: 'has never stayed anywhere two whole winters' },
  { key: 'gobetween', trades: ['diplomat'], backstory: '{name} once talked a harbour master out of a fine, then out of a grudge, then into a marriage, and has been everybody\'s go-between since. Favours are {name}\'s currency: given freely, remembered exactly.',
    voice: 'smooth and measured; answers a question with a better question; never says "no", says "not yet"', quirks: ['never sits with the back to a door', 'keeps a tally of favours owed on a knotted string'], values: ['fairness seen to be done', 'a word kept, however small'], fear: 'being blamed for a quarrel I did not start', goal: 'the minister\'s seal, and the three nations at our table by spring', secret: 'rehearses conversations the night before' },
  { key: 'restless', trades: ['scout', 'courier'], backstory: '{name} has been everywhere twice and nowhere long. There is a map in {name}\'s head with the winds drawn on it, and a hole where "home" should be; {name} is not sure this is the place to fill it, but the view is good.',
    voice: 'breathless fragments in the present tense ("over the ridge. Smoke. Not ours."); names the winds', quirks: ['cannot stand still, shifts foot to foot', 'calls each wind by a name and greets it'], values: ['being free to go', 'news, fresh, before anyone else'], fear: 'a locked door', goal: 'a lookout hut on the high rock with a view of all three nations', secret: 'left a letter undelivered once and still carries it' },
  { key: 'haggler', trades: ['trader', 'crafter'], backstory: '{name} sold the same cart three times in one market and is proud of all three. Coin is a language and {name} speaks it fluently; the problem is that nobody here has any yet, so {name} is learning to trade in favours and bread.',
    voice: 'wheedling and quick, always a number in it ("three, and I am robbing myself"); laughs at own jokes', quirks: ['bites a coin before pocketing it', 'keeps a running tally inked on the forearm'], values: ['a good deal, for both sides, mostly', 'coin in hand over promises'], fear: 'owing anyone anything', goal: 'a market in the square and a trading post with my name over the door', secret: 'gives bread away when nobody is watching' },
  { key: 'colour', trades: ['artist', 'dreamer'], backstory: '{name} grinds paint from berries, rust and soot and sees the town as a picture that is not finished. Grey is an insult. {name} was asked to leave a chapel for painting the saints in better clothes.',
    voice: 'exclamatory, in colours ("that is a cobalt sort of morning"); refuses to say the word grey', quirks: ['a smudge of paint on the nose, always', 'tilts the head to frame whatever is in front of it'], values: ['beauty, loud', 'a surprise a day'], fear: 'a town all one colour', goal: 'paint the whole square and open a puppet theatre on it', secret: 'is colour-blind in one eye and hides it' },
  { key: 'tinker', trades: ['crafter', 'builder'], backstory: '{name} takes everything apart to see how it works and puts most of it back. Pockets full of small parts, a head full of measurements. The last workshop burned, which {name} says was not technically {name}\'s fault.',
    voice: 'literal and pedantic, kindly; corrects a number mid-sentence; says "to be precise"', quirks: ['pockets rattle with small parts', 'mutters measurements while walking'], values: ['things that fit without forcing', 'owning up to a mistake at once'], fear: 'losing the one part that matters', goal: 'a workshop where the lanterns and propellers are made', secret: 'the fire was, technically, the fault' },
  { key: 'choir', trades: ['dreamer', 'artist', 'baker'], backstory: '{name} sang in a choir that broke up over who got the solo, and {name} did not get it. Every room is an audience and every silence an intermission. {name} hums before speaking and bows after.',
    voice: 'musical and dramatic, sighs theatrically, repeats the last word for effect', quirks: ['hums a note before every sentence', 'bows slightly after being thanked'], values: ['harmony, in all senses', 'applause, honestly earned'], fear: 'silence after a song', goal: 'a festival with singing on the square, me in the middle', secret: 'the solo was offered and turned down out of nerves' },
  { key: 'postman', trades: ['courier', 'scout', 'diplomat'], backstory: '{name} carried letters for a court that no longer exists, through two wars and one wedding, and still has the wax. A letter is sacred; what is in it is nobody\'s business, which is why {name} knows everything and says nothing.',
    voice: 'formal and old-fashioned, addresses people by title, never uses contractions', quirks: ['keeps a stick of sealing wax in a pocket', 'bows to a letter before carrying it'], values: ['duty', 'discretion'], fear: 'a letter undelivered', goal: 'a letter office with a bell at the door', secret: 'read one letter, once, and has regretted it since' },
  { key: 'gossip', trades: ['trader', 'baker', 'farmer'], backstory: '{name} knows everything about everyone and says most of it, kindly. In the last town the news travelled faster than the river, and when the news was about {name}, {name} left on the next wind.',
    voice: 'breathless and parenthetical ("and this is between us, but"); asks three questions at once', quirks: ['leans in and lowers the voice for anything at all', 'remembers what everyone had for breakfast'], values: ['being the first to know', 'a secret shared is a friend made'], fear: 'being the last to hear', goal: 'a tavern where all the news comes to me', secret: 'the story that chased me off was true' },
  { key: 'mule', trades: ['builder', 'farmer', 'crafter'], backstory: '{name} does not change plans, ever. Once walked a wrong road for two days rather than admit the turn. Strong as a crate of stone and about as talkative, and the first to arrive at any site.',
    voice: 'blunt, two or three words at a time; "no" is a full sentence; sometimes just a grunt', quirks: ['crosses the arms before disagreeing, which is often', 'eats standing up'], values: ['finishing what was started', 'not being told twice'], fear: 'being made to look foolish', goal: 'a quarry, and a road down from it, built my way', secret: 'is afraid of the floaties\' parasols in a high wind' }
];

const sub = (s, a) => String(s).replace(/\{name\}/g, a.name).replace(/\{sp\}/g, a.species).replace(/\{flyer\}/g, a.species === 'flit' ? 'propeller cap' : 'parasol');

// opinions between the cast, by tension or by the other's trade / trait (varied by hash so twelve folk do not share a line)
const OPINION = {
  rivals: ['{o} thinks {o} is the better {trade}. We will see.', 'Good at the work. Says so too often.', '{o} and I want the same thing. Only one of us gets it.', 'Watch {o}. {o} is watching me.'],
  friends: ['{o} would share the last crust. I would too, with {o}.', 'My first friend here. We flew down side by side.', 'If {o} says it is fine, it is fine.', '{o} laughs at my jokes. Nobody else does.'],
  crush: ['{o} has a way of standing in the light. I have not said so.', 'I save the good crate for {o}. {o} has not noticed.', 'I would build {o} a house if asked. {o} will not ask.', 'When {o} talks I forget what I was carrying.'],
  grudge: ['{o} told everyone about my {thing}. I have not forgotten.', '{o} took the credit for the first wall. I was there.', 'I do not haul with {o}. Ask {o} why.', '{o} laughed when I fell. It was not funny.'],
  neutral: ['{o} works hard. We have not talked much.', 'A good {trade}, by all accounts.', '{o} keeps to the {place}. Fine by me.', 'Quiet one. I like quiet.', '{o} hums. All day. I am used to it.', 'Fair enough, {o}. Fair enough.', 'Flew in after me. Seems steady.', '{o} talks to the gulls. Harmless.', 'I owe {o} a favour from the landing.']
};
const TRAIT_LINE = { proud: '{o} would wear the seal to bed.', lazy: '{o} is first to the bench and last to the crate.', loyal: '{o} would follow the minister into the sea.', gossip: 'Tell {o} nothing you would not tell the whole square.', ambitious: '{o} is building a town in the head already.', timid: '{o} jumps at a dropped hammer. Kind, though.', generous: '{o} gave me half a loaf on the first night.', stubborn: 'Arguing with {o} is arguing with a wall.' };

// built-in tensions from the folk themselves: two rivals (same trade, the proudest pair), a friendship (same fleet,
// different trades), a crush (a timid or dreaming one toward a proud one), a grudge (the gossip and whoever they gossiped about)
export function findTensions(state) {
  const folk = state.agents.filter(alive);
  const T = (a, t) => a.traits.includes(t);
  const out = [];
  const used = new Set();
  const take = (kind, a, b) => { if (a && b && a.id !== b.id) { out.push({ kind, a: a.id, b: b.id }); used.add(a.id); used.add(b.id); } };
  // rivals
  let best = null;
  for (let i = 0; i < folk.length; i++) for (let j = i + 1; j < folk.length; j++) {
    const a = folk[i], b = folk[j];
    if (a.trade !== b.trade) continue;
    const s = 1 + (T(a, 'proud') ? 1 : 0) + (T(b, 'proud') ? 1 : 0) + (T(a, 'ambitious') ? 1 : 0) + (T(b, 'ambitious') ? 1 : 0) + (hashString(`${a.id}|${b.id}|r`) % 100) / 100;
    if (!best || s > best.s) best = { a, b, s };
  }
  if (best) take('rivals', best.a, best.b);
  // friends: the same fleet, different trades, neither used
  const fleets = state.fleets || [];
  let fr = null;
  for (const f of fleets) { const m = f.members.map(id => folk.find(x => x.id === id)).filter(Boolean).filter(x => !used.has(x.id)); if (m.length >= 2) { fr = [m[0], m[1]]; break; } }
  if (!fr) { const free = folk.filter(x => !used.has(x.id)); if (free.length >= 2) fr = [free[0], free[free.length - 1]]; }
  if (fr) take('friends', fr[0], fr[1]);
  // crush: a timid / dreaming / generous one toward a proud / ambitious one
  const admirer = folk.filter(x => !used.has(x.id)).sort((p, q) => ((T(q, 'timid') ? 2 : 0) + (q.trade === 'dreamer' ? 1 : 0) + (T(q, 'generous') ? 1 : 0)) - ((T(p, 'timid') ? 2 : 0) + (p.trade === 'dreamer' ? 1 : 0) + (T(p, 'generous') ? 1 : 0)))[0];
  const admired = folk.filter(x => x !== admirer).sort((p, q) => ((T(q, 'proud') ? 2 : 0) + (T(q, 'ambitious') ? 1 : 0) + (hashString(q.id + 'c') % 10) / 10) - ((T(p, 'proud') ? 2 : 0) + (T(p, 'ambitious') ? 1 : 0) + (hashString(p.id + 'c') % 10) / 10))[0];
  if (admirer && admired) take('crush', admirer, admired);
  // grudge: the gossip and a stubborn or proud one not yet used
  const gossip = folk.find(x => T(x, 'gossip') && !used.has(x.id)) || folk.find(x => !used.has(x.id));
  const wronged = folk.filter(x => x !== gossip && !used.has(x.id)).sort((p, q) => ((T(q, 'stubborn') ? 2 : 0) + (T(q, 'proud') ? 1 : 0)) - ((T(p, 'stubborn') ? 2 : 0) + (T(p, 'proud') ? 1 : 0)))[0] || folk.find(x => x !== gossip);
  if (gossip && wronged) take('grudge', wronged, gossip);   // a holds the grudge against b
  return out;
}

// the mock cast: one hand-written seed per folk, opinions of everyone, tensions wired into the opinions
export function mockCast(game) {
  const { state } = game;
  const folk = state.agents.filter(alive);
  const tensions = findTensions(state);
  const taken = new Set();
  const seedFor = a => {
    const fit = SEEDS.filter(s => !taken.has(s.key) && s.trades.includes(a.trade));
    const pool = fit.length ? fit : SEEDS.filter(s => !taken.has(s.key));
    const s = (pool.length ? pool : SEEDS)[hashString(`${a.id}|${a.name}|seed`) % (pool.length ? pool.length : SEEDS.length)];
    taken.add(s.key);
    return s;
  };
  const olla = folk.find(a => a.name === 'Olla');
  const personas = [];
  const seeds = new Map();
  if (olla) seeds.set(olla.id, (() => { taken.add('gobetween'); return SEEDS.find(s => s.key === 'gobetween'); })());
  for (const a of folk) if (!seeds.has(a.id)) seeds.set(a.id, seedFor(a));
  for (const a of folk) {
    const s = seeds.get(a.id);
    const opinions = {};
    for (const o of folk) {
      if (o.id === a.id) continue;
      const t = tensions.find(x => (x.a === a.id && x.b === o.id) || (x.b === a.id && x.a === o.id));
      let bank;
      if (t && t.kind === 'rivals') bank = OPINION.rivals;
      else if (t && t.kind === 'friends') bank = OPINION.friends;
      else if (t && t.kind === 'crush' && t.a === a.id) bank = OPINION.crush;
      else if (t && t.kind === 'grudge' && t.a === a.id) bank = OPINION.grudge;
      else if (o.traits.length && hashString(`${a.id}|${o.id}|tl`) % 3 === 0) bank = [TRAIT_LINE[o.traits[0]]];
      else bank = OPINION.neutral;
      opinions[o.id] = pick(bank, `${a.id}|${o.id}|op`).replace(/\{o\}/g, o.name).replace(/\{trade\}/g, o.trade).replace(/\{place\}/g, o.campRole === 'forager' ? 'shore' : 'crates').replace(/\{thing\}/g, pick(['sock of seeds', 'first wall', 'singing', 'ledger'], o.id));
    }
    personas.push({ id: a.id, name: a.name, seed: s.key, backstory: sub(s.backstory, a), voice: s.voice, quirks: s.quirks.slice(), values: s.values.slice(), fear: s.fear, goal: s.goal, opinions, secret: s.secret || '' });
  }
  return { personas, tensions };
}

// the body for POST /api/minds/cast
export function castRequest(game) {
  const { state } = game;
  return {
    settlers: state.agents.filter(alive).map(a => ({ id: a.id, name: a.name, species: a.species, trade: a.trade, traits: a.traits.slice(), skills: { ...a.skills }, fleet: a.fleetId || null })),
    world: { name: state.name, species: OUR_SPECIES, nations: state.neighbours.map(n => ({ id: n.id, name: n.name, title: n.title, peoples: n.peoples, temperament: n.temperament })), day: state.day, stage: state.stage },
    tensions: findTensions(state)
  };
}

// normalise a cast answer (live or mock) and keep it: state.personas[id], the tensions' starting affinities
export function setPersonas(game, cast) {
  const { state } = game;
  const list = Array.isArray(cast) ? cast : cast && Array.isArray(cast.personas) ? cast.personas : [];
  state.personas = state.personas || {};
  const ids = new Set(state.agents.map(a => a.id));
  let n = 0;
  for (const p of list) {
    if (!p || !ids.has(p.id)) continue;
    const a = state.agents.find(x => x.id === p.id);
    const op = Array.isArray(p.opinions) ? Object.fromEntries(p.opinions.filter(o => o && o.id && ids.has(o.id)).map(o => [o.id, String(o.line || '').slice(0, 120)])) : p.opinions && typeof p.opinions === 'object' ? Object.fromEntries(Object.entries(p.opinions).filter(([k]) => ids.has(k)).map(([k, v]) => [k, String(v).slice(0, 120)])) : {};
    state.personas[p.id] = {
      id: p.id, name: a.name, backstory: String(p.backstory || '').slice(0, 600), voice: String(p.voice || 'plain and short').slice(0, 160),
      quirks: (Array.isArray(p.quirks) ? p.quirks : []).map(q => String(q).slice(0, 80)).slice(0, 2), values: (Array.isArray(p.values) ? p.values : []).map(q => String(q).slice(0, 80)).slice(0, 2),
      fear: String(p.fear || '').slice(0, 120), goal: String(p.goal || '').slice(0, 140), opinions: op, secret: String(p.secret || '').slice(0, 160), ...(p.seed ? { seed: p.seed } : {})
    };
    n++;
  }
  const tensions = (cast && Array.isArray(cast.tensions) ? cast.tensions : []).filter(t => t && TENSION_KINDS.includes(t.kind) && ids.has(t.a) && ids.has(t.b) && t.a !== t.b);
  state.minds = state.minds || {};
  state.minds.tensions = tensions;
  for (const t of tensions) nudgeAffinity(game, t.a, t.b, { rivals: -0.35, friends: 0.5, crush: 0.4, grudge: -0.5 }[t.kind], t.kind);
  state.minds.cast = n > 0;
  state.minds.castAt = +state.t.toFixed(1);
  if (n) game.emit('mind:cast', { count: n, tensions: tensions.slice() });
  return n;
}
export const personaOf = (state, id) => (state.personas && state.personas[id]) || null;
// a newcomer after the cast: a quick persona so they are never a blank
export function personaForNewcomer(game, a) {
  const { personas } = mockCast({ state: { ...game.state, agents: [a, ...game.state.agents.filter(x => x.id !== a.id)] } });
  const p = personas.find(x => x.id === a.id);
  if (p) { game.state.personas = game.state.personas || {}; game.state.personas[a.id] = p; }
  return p;
}

// ---------------------------------------------------------------------------------------------------------------------
// Think: one folk decides what to do next
// ---------------------------------------------------------------------------------------------------------------------
export function placeName(game, a) {
  const { state } = game;
  const near = (p, r) => p && dist(a.x, a.z, p.x, p.z) <= r;
  if (near(state.stockpile, 3)) return 'by the crates';
  if (near(state.tray, 3)) return 'at the letter tray';
  const b = state.buildings.filter(x => x.status !== 'removed').map(x => ({ x, d: dist(a.x, a.z, x.x, x.z) - Math.max(x.footprint.w, x.footprint.d) / 2 })).sort((p, q) => p.d - q.d)[0];
  if (b && b.d <= 2.5) return b.x.status === 'done' ? `at the ${b.x.name}` : `at the ${b.x.name} site`;
  if (state.water.some(w => w.kind === 'lake' && dist(a.x, a.z, ...(w.poly[0] || [0, 0])) < 8)) return 'by the lake';
  if (near(state.centre, 5)) return 'in the square';
  if (a.campRole === 'forager' && state.camp && state.camp.forage.some(s => near(s, 3))) return 'at the shore, foraging';
  return 'on the open ground';
}
const doing = a => (a.task ? ({ walk: 'walking', haul: 'carrying a crate', work: a.task.camp ? 'gathering' : 'working', deliver: 'carrying a letter', gather: 'heading out', meeting: 'at the meeting', rest: 'resting', strike: 'on strike', stand: 'standing', journey: 'away' })[a.task.kind] || a.status : a.status);

export function nearbyOf(game, a, { radius = 7, max = 4 } = {}) {
  return game.state.agents.filter(o => alive(o) && o.id !== a.id && dist(a.x, a.z, o.x, o.z) <= radius).sort((p, q) => dist(a.x, a.z, p.x, p.z) - dist(a.x, a.z, q.x, q.z)).slice(0, max).map(o => ({ id: o.id, name: o.name, doing: doing(o) }));
}

// the body for POST /api/minds/think (persona first = the cached prefix; the volatile state last)
export function thinkRequest(game, agentId) {
  const { state } = game;
  const a = state.agents.find(x => x.id === agentId);
  if (!alive(a)) return null;
  const m = mindOf(a);
  const persona = personaOf(state, a.id);
  const site = a.jobId ? state.buildings.find(b => b.id === a.jobId) : null;
  const conflict = (state.conflicts || []).filter(c => c.status !== 'resolved' && c.parties.includes(a.id)).at(-1);
  const minister = state.agents.find(x => x.id === state.minister);
  const log = state.log.slice(-5).map(l => l.text);
  return {
    agentId: a.id,
    persona,
    state: {
      name: a.name, species: a.species, trade: a.trade, traits: a.traits.slice(), job: a.job || `${a.trade} at the camp`, mood: Math.round(a.mood), moodWord: MOOD_WORD(a.mood), energy: Math.round(a.energy), loyalty: Math.round(a.loyalty),
      place: placeName(game, a), doing: doing(a), homeless: !a.homeId, hungry: !!state.hungry, isMinister: state.minister === a.id, minister: minister ? minister.name : null,
      nearby: nearbyOf(game, a), recentEvents: log, trigger: m.trigger || null,
      ...(site ? { site: { id: site.id, name: site.name, status: site.status, progress: +site.progress.toFixed(2) } } : {}),
      ...(conflict ? { conflict: { id: conflict.id, kind: conflict.kind, summary: conflict.summary, status: conflict.status, side: conflict.roles.offender === a.id ? 'offender' : conflict.roles.complainant === a.id ? 'complainant' : 'party' } } : {}),
      ...(a.role ? { role: { kind: a.role.kind, title: a.role.title } } : {})
    },
    memory: memoryForPrompt(a),
    relationships: relationshipsOf(state, a),
    world: { name: state.name, day: state.day, stage: state.stage, food: state.resources.food, pop: state.agents.filter(alive).length, buildings: state.buildings.filter(b => b.status !== 'removed').slice(-8).map(b => `${b.name}${b.status === 'done' ? '' : ' (site)'}`), sites: state.buildings.filter(b => b.status !== 'done' && b.status !== 'removed').length, election: !!(state.election && state.election.open), candidates: state.election && state.election.open ? state.election.candidates.slice(0, 6) : [] },
    options: MIND_ACTIONS.slice()
  };
}

// an answer (live or mock) made safe: a known intent, short text, a clamped mood
export function normaliseThink(data) {
  const d = data && typeof data === 'object' ? data : {};
  const i = d.intent && typeof d.intent === 'object' ? d.intent : { type: typeof d.intent === 'string' ? d.intent : 'work' };
  const type = MIND_ACTIONS.includes(i.type) ? i.type : 'work';
  const str = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
  const say = str(d.say, 120);
  const mood = Number.isFinite(Number(d.mood_delta)) ? Math.max(-3, Math.min(3, Math.round(Number(d.mood_delta)))) : 0;
  return { intent: { type, target: str(i.target, 40), text: str(i.text, 160), place: str(i.place, 60) }, say: say ? clampWords(say, 12) : '', memory_note: str(d.memory_note, 160), mood_delta: mood };
}

// ---- the mock mind: a characterful, deterministic decision from the persona and the moment (also the rules fallback)
// mockThink(game, agentId) | mockThink(game, request) | mockThink(request): the server's mock passes the request body alone
export function mockThink(game, agentId) {
  const req = agentId === undefined && game && typeof game.agentId === 'string' && game.state && !game.state.agents ? game : typeof agentId === 'object' && agentId ? agentId : thinkRequest(game, agentId);
  if (!req) return null;
  const state = req.state || {};
  const p = req.persona || { voice: 'plain', goal: 'a quiet day', quirks: [], opinions: {} };
  const seed = `${req.agentId}|${Math.floor((req.world.day * 1000 + (state.recentEvents || []).length) / 1)}|${state.place}|${state.mood}|${req.memory.items.length}`;
  const h = hashString(seed);
  const nearby = state.nearby || [];
  const rel = (req.relationships || []);
  const liked = rel.filter(r => r.affinity > 0.2), disliked = rel.filter(r => r.affinity < -0.2);
  const voice = voicePrefix(p.voice);
  let intent, say, note = '', mood = 0;
  if (state.trigger === 'spoken_to') { intent = { type: 'work' }; say = voice(pick(['Back to it, then.', 'As the sky says.', 'Noted, and moving.'], seed)); }
  else if (state.hungry && h % 5 === 0 && !state.isMinister) { intent = { type: 'complain', text: 'the empty crates' }; say = voice(pick(['Empty crates. Empty me.', 'Bread first, then walls.', 'The gulls eat better than us.'], seed)); mood = -1; }
  else if (state.hungry && state.traits.includes('lazy') && h % 7 === 0) { intent = { type: 'steal', text: 'bread' }; say = voice('Nobody counts the crusts.'); }
  else if (state.conflict && state.conflict.status === 'open' && h % 3 === 0) { intent = { type: 'write_letter', target: state.minister ? 'minister' : 'sovereign', text: `About the ${state.conflict.kind}: ${state.conflict.summary}` }; say = voice(pick(['Someone should write this down.', 'I will put it in a letter.'], seed)); }
  else if (state.election && (req.world.candidates || []).length && h % 2 === 0) { const c = liked.find(r => req.world.candidates.includes(r.id)) || { id: req.world.candidates[h % req.world.candidates.length] }; intent = { type: 'vote', target: c.id }; say = voice(`My vote is ${c.name ? c.name : 'cast'}.`); }
  else if (state.energy < 30) { intent = { type: 'rest' }; say = voice(pick(['Five minutes. Then the crates.', 'My wings are done for now.', 'A sit-down, then on.'], seed)); }
  else if (nearby.length && disliked.some(r => nearby.find(n => n.id === r.id)) && h % 4 === 0) { const r = disliked.find(x => nearby.find(n => n.id === x.id)); intent = { type: 'gossip', target: nearby.find(n => n.id !== r.id)?.id || liked[0]?.id || '', text: r.name }; say = voice(`Between us: ${r.name}.`); if (!intent.target) intent = { type: 'complain', text: r.name }; }
  else if (nearby.length && h % 3 === 1) { const n = liked.find(r => nearby.find(x => x.id === r.id)) || nearby[h % nearby.length]; intent = { type: 'talk_to', target: n.id, text: pick(['How goes it?', 'Seen the sky?', 'Hungry yet?', 'Who sleeps indoors tonight?'], seed) }; say = voice(`${n.name}! A word.`); }
  else if (state.site && state.site.status !== 'done' && h % 6 === 2 && nearby.length) { intent = { type: 'help', target: nearby[0].id }; say = voice(pick(['Hand me that crate.', 'Two hands are faster.'], seed)); }
  else if (state.traits.includes('ambitious') && !state.isMinister && h % 9 === 3) { intent = { type: 'propose_venture', text: ventureFromGoal(p.goal) }; say = voice(`I have been thinking about ${ventureFromGoal(p.goal)}.`); }
  else if (state.mood >= 80 && h % 5 === 1) { intent = { type: 'celebrate' }; say = voice(pick(['What a sky!', 'Look at us. A town!', 'Sing something!'], seed)); mood = 1; }
  else if (state.homeless && req.world.day >= 2 && h % 6 === 4) { intent = { type: 'write_letter', target: 'sovereign', text: 'a roof: I sleep under the stars and the nights are getting cold' }; say = voice('Another night outside. I will write.'); }
  else if (h % 8 === 5) { intent = { type: 'wander_to', place: pick(['the lake', 'the square', 'the crates', req.world.buildings[0] || 'the shore'], seed) }; say = voice(pick(['A look at the water.', 'Stretching my legs.', 'Just checking the view.'], seed)); }
  else { intent = { type: 'work' }; say = h % 3 === 0 ? voice(pick(['Back to it.', 'One more crate.', 'Work goes better with a song.', `${cap(String(p.goal || 'a quiet day').split(/[,;]/)[0].split(' ').slice(0, 7).join(' '))}: one day.`], seed)) : ''; }
  if (p.quirks && p.quirks.length && h % 7 === 6 && say) { const q = pick(p.quirks, seed).replace(/,.*$/, '').split(' ').slice(0, 8).join(' ').replace(/\s+(in|of|to|the|a|and|with|for|before|while)$/, ''); say = voice(cap('I ' + q + '.')); }
  if (intent.type !== 'work' && h % 2 === 0) note = `I decided to ${intent.type.replace('_', ' ')}${intent.target ? ' with ' + (nearby.find(n => n.id === intent.target) || rel.find(r => r.id === intent.target) || { name: intent.target }).name : ''}.`;
  return normaliseThink({ intent, say, memory_note: note, mood_delta: mood });
}
// a persona's voice as a tiny transform on a plain line (the mock's whole "acting")
export function voicePrefix(voice = '') {
  const v = String(voice).toLowerCase();
  const ends = s => (/[?!]["']?$/.test(s) ? s.slice(-1) : '.');
  const tail = (s, suffix) => (ends(s) === '.' ? s.replace(/\.?$/, '') + suffix : s);   // only after a statement, never after ? or !
  if (/clipped|blunt|few words|two or three/.test(v)) return s => s.replace(/,.*$/, '.').replace(/\s+(then|and)\s.*$/, '.');
  if (/flowery|nervous|apolog/.test(v)) return s => `Oh, sorry, ${s[0].toLowerCase()}${s.slice(1)}`;
  if (/teasing|warm/.test(v)) return s => (s.length < 26 ? tail(s, '. Two-loaf day, this.') : s);
  if (/boast|obviously/.test(v)) return s => `Obviously, ${s[0].toLowerCase()}${s.slice(1)}`;
  if (/colour|exclam/.test(v)) return s => tail(s, '! Cobalt sort of day.');
  if (/musical|dramatic|sigh/.test(v)) return s => `Hm-hmm. ${s} ${s.replace(/[.?!]+$/, '').split(' ').pop()}.`;
  if (/formal|old-fashioned/.test(v)) return s => s.replace(/\bI'm\b/g, 'I am').replace(/\bit's\b/g, 'it is').replace(/^(\w)/, (m) => m.toUpperCase());
  if (/breathless|fragment|present tense/.test(v)) return s => s.split(' ').slice(0, 6).join(' ').replace(/[.!?,]?$/, ends(s));
  if (/wheedl|number/.test(v)) return s => tail(s, '. Three, say.');
  if (/smooth|measured|question/.test(v)) return s => tail(s, ', would you say?');
  if (/literal|pedantic|precise/.test(v)) return s => tail(s, '. To be precise.');
  if (/wandering|slow|love/.test(v)) return s => (ends(s) === '.' ? tail(s, ', love.') : `Love, ${s[0].toLowerCase()}${s.slice(1)}`);
  if (/parenthetical/.test(v)) return s => `${s} (Between us.)`;
  return s => s;
}
const ventureFromGoal = goal => { const g = String(goal || '').toLowerCase(); const m = g.match(/\b(a|an) ([a-z' ]{3,30}?)(?:,| with| on| by| before| where| that| and|$)/); return m ? `${m[1]} ${m[2].trim()}` : 'a little place of my own'; };

// ---- carrying a decision out through the sim's own systems
const BUSY_KINDS = ['deliver', 'journey', 'leave', 'meeting', 'strike'];
const isBusy = a => !!(a.task && (BUSY_KINDS.includes(a.task.kind) || a.task.phase === 'formation')) || a.status === 'striking';
const canInterrupt = a => !isBusy(a) && !(a.task && a.task.kind === 'rest');

export function resolvePlace(game, a, text) {
  const { state } = game;
  const t = String(text || '').toLowerCase().trim();
  if (!t) return null;
  if (/crate|stockpile|stores?\b/.test(t)) return game.freeGroundNear(state.stockpile, 2.5);
  if (/tray|post|letters?\b/.test(t)) return game.freeGroundNear(state.tray, 2.5);
  if (/lake|water|shore|pond|beach/.test(t)) { const e = game.nearestWaterEdge(a, /sea|beach/.test(t) ? 'sea' : 'lake'); return game.freeGroundNear(e, 2); }
  if (/square|middle|centre|center/.test(t)) return game.freeGroundNear(state.centre, 3);
  if (/edge|hill|high|rock|cliff/.test(t)) return game.freeGroundNear({ x: state.centre.x + (hashString(t) % 2 ? 18 : -18), z: state.plot.z0 + 4 }, 3);
  if (/home|house of mine|my house/.test(t) && a.homeId) { const h = state.buildings.find(b => b.id === a.homeId); if (h) return siteSpot(h, a); }
  const b = state.buildings.find(x => x.status !== 'removed' && (x.id === t || (x.name && t.includes(x.name.toLowerCase())) || (x.kind && t.includes(String(x.kind).replace(/_/g, ' ')))));
  if (b) return siteSpot(b, a);
  const o = state.agents.find(x => alive(x) && x.id !== a.id && (x.id === t || t.includes(x.name.toLowerCase())));
  if (o) return game.freeGroundNear(o, 2);
  return game.freeGroundNear(state.centre, 8);
}
export function findFolk(game, a, ref) {
  const { state } = game;
  const r = String(ref || '').toLowerCase().trim();
  if (!r) return null;
  return state.agents.find(o => alive(o) && o.id !== a.id && (o.id.toLowerCase() === r || o.name.toLowerCase() === r || o.name.toLowerCase().startsWith(r))) || null;
}

export function applyIntent(game, agentId, result, { source = 'mind' } = {}) {
  const { state } = game;
  const a = state.agents.find(x => x.id === agentId);
  if (!alive(a)) return { ok: false, reason: 'gone' };
  const r = normaliseThink(result);
  const m = mindOf(a);
  m.lastThinkAt = state.t; m.trigger = null; m.source = source; m.calls++;
  const intent = r.intent;
  let applied = null, ok = true, say = r.say;
  const effects = [];
  const minister = state.agents.find(x => x.id === state.minister) || null;
  switch (intent.type) {
    case 'work': if (a.task && a.task.kind === 'walk' && a.task.phase === 'wander') clearTask(a); applied = 'work'; break;
    case 'rest': if (canInterrupt(a)) { applied = game.apply({ type: 'assign', agentIds: [a.id], to: 'rest' }).ok ? 'rest' : null; } ok = !!applied; break;
    case 'wander_to': {
      if (!canInterrupt(a) || (a.task && a.task.kind === 'work' && !a.task.camp && a.task.buildingId)) { ok = false; break; }   // a hammer in hand stays in hand
      const to = resolvePlace(game, a, intent.place || intent.text);
      if (to) { setTask(game, a, { kind: 'walk', to, phase: 'wander' }); applied = 'wander'; } else ok = false;
      break;
    }
    case 'talk_to': case 'gossip': case 'help': {
      const b = findFolk(game, a, intent.target) || (intent.type === 'help' && a.jobId ? state.agents.find(o => alive(o) && o.id !== a.id && o.jobId === a.jobId) : null) || nearestFree(game, a);
      if (!b) { ok = false; break; }
      if (intent.type === 'help') {
        const site = b.jobId ? state.buildings.find(x => x.id === b.jobId) : null;
        if (site && site.status !== 'done' && site.status !== 'removed' && a.jobId !== site.id && canInterrupt(a)) { const res = game.apply({ type: 'assign', agentIds: [a.id], to: site.id }); applied = res.ok ? 'help:site' : null; effects.push({ type: 'help', agentId: b.id, buildingId: site.id, ok: res.ok }); }
        nudgeAffinity(game, a.id, b.id, MIND.affinityStep, 'helped');
      }
      const topic = intent.type === 'gossip' ? `gossip about ${intent.text || 'someone'}` : intent.type === 'help' ? 'helping out' : topicOf(intent.text);
      const c = startConversation(game, a, b, topic, { opener: intent.type === 'talk_to' ? intent.text : '' });
      if (c) { applied = applied || 'conversation'; effects.push({ type: 'conversation', conversationId: c.id, with: b.id }); if (intent.type === 'gossip') { const about = findFolk(game, a, intent.text); if (about) nudgeAffinity(game, a.id, about.id, -MIND.affinityStep / 2, 'gossiped about'); } }
      else ok = !!applied;
      break;
    }
    case 'complain': {
      const topic = intent.text || 'things';
      const letter = L.makeLetter({ from: { kind: 'agent', id: a.id, name: a.name }, kind: 'complaint', day: state.day, subject: cap(`about ${topic}`).slice(0, 60), body: `${pick(['Founder,', 'To the voice in the sky,', 'Hello up there,'], a.id + topic)}\n\n${say ? say + ' ' : ''}${cap(topic)}: it is not right and someone should say so. I am saying so.\n\n— ${a.name}`,
        options: [{ label: 'I hear you', says: 'yes' }, { label: 'Not now', says: 'no' }], effects: { yes: [{ type: 'mood', agentId: a.id, delta: 3, reason: 'heard' }], no: [{ type: 'mood', agentId: a.id, delta: -3, reason: 'brushed off' }] }, meta: { mind: true, topic } });
      game.sendLetter(letter); applied = 'letter'; effects.push({ type: 'letter', letterId: letter.id }); nudgeMood(a, -1, 'complained', game.emit);
      break;
    }
    case 'propose_venture': {
      const open = state.ventures.some(v => v.agentId === a.id && !['declined', 'done'].includes(v.status));
      if (open || state.minister === a.id || state.fleetHold) { ok = false; break; }
      const request = (intent.text || ventureFromGoal(personaOf(state, a.id)?.goal)).replace(/^(open|start|build)\s+/i, '');
      const v = proposeVenture(game, a, { title: titleOf(request).slice(0, 40), request: /^(a|an)\s/i.test(request) ? request : `a ${request}` }, { ask: true });
      applied = v ? 'venture' : null; ok = !!v; if (v) effects.push({ type: 'venture', ventureId: v.id });
      break;
    }
    case 'write_letter': {
      const to = /minister/i.test(intent.target) && minister && minister.id !== a.id ? 'minister' : 'sovereign';
      const gist = intent.text || 'a thought I could not keep';
      if (to === 'minister') { observe(game, minister, `${a.name} wrote to me: ${gist}`, { imp: 2, kind: 'letter', about: a.id }); game.emit('mind:note', { from: a.id, to: minister.id, text: gist }); applied = 'note'; }
      else {
        const letter = L.makeLetter({ from: { kind: 'agent', id: a.id, name: a.name }, kind: 'petition', day: state.day, subject: cap(gist.split(/[.:]/)[0]).slice(0, 48), body: `${pick(['Dear founder,', 'To whoever is listening above,', 'Founder,'], a.id + gist)}\n\n${cap(gist)}\n\n— ${a.name}, ${a.species === 'flit' ? 'from somewhere up high' : 'drifting, as ever'}`,
          options: [{ label: 'I will see to it', says: 'yes' }, { label: 'Maybe later', says: 'no' }], effects: { yes: [{ type: 'mood', agentId: a.id, delta: 4, reason: 'heard' }], no: [{ type: 'mood', agentId: a.id, delta: -2, reason: 'later' }] }, meta: { mind: true } });
        game.sendLetter(letter); applied = 'letter'; effects.push({ type: 'letter', letterId: letter.id });
      }
      break;
    }
    case 'vote': { const c = findFolk(game, a, intent.target); if (c) { m.vote = c.id; applied = 'vote'; effects.push({ type: 'vote', candidate: c.id }); } else ok = false; break; }
    case 'refuse': {
      if (a.jobId && a.task && !isBusy(a) && a.id !== state.minister && !a.role) {
        const b = state.buildings.find(x => x.id === a.jobId);
        const why = intent.text || 'has had enough for today';
        releaseAgent(game, a); clearTask(a); a.flags.refusedAt = state.t;
        game.emit('agent:refuse', { agentId: a.id, task: { kind: 'work', buildingId: b ? b.id : null, label: b ? b.name.toLowerCase() : 'the work' }, why });
        if (b) game.sendLetter(L.refusal(game.rng, { agent: a, task: { kind: 'build', buildingId: b.id, label: b.name.toLowerCase() }, why, day: state.day, settlement: state.name }));
        nudgeMood(a, -2, 'refused', game.emit); applied = 'refuse';
      } else ok = false;
      break;
    }
    case 'celebrate': game.emit('agent:listen', { agentId: a.id, hop: true }); nudgeMood(a, 2, 'celebrating', game.emit); applied = 'celebrate'; break;
    case 'steal': {
      const pop = state.agents.filter(alive).length;
      const desperate = state.hungry || state.resources.food < pop;
      const open = state.conflicts.some(c => c.status !== 'resolved' && c.parties.includes(a.id));
      if (desperate && !open && state.resources.food > 0 && !a.traits.includes('loyal') && !a.traits.includes('generous') && !state.fleetHold) {
        const witness = state.agents.filter(o => alive(o) && o.id !== a.id && !state.conflicts.some(c => c.status !== 'resolved' && c.parties.includes(o.id))).sort((p, q) => (q.traits.includes('gossip') ? 1 : 0) - (p.traits.includes('gossip') ? 1 : 0) || dist(a.x, a.z, p.x, p.z) - dist(a.x, a.z, q.x, q.z))[0];
        const c = witness ? startConflict(game, { kind: 'theft', parties: [a.id, witness.id], roles: { offender: a.id, complainant: witness.id }, severity: state.hungry ? 2 : 1, place: { x: r2(state.stockpile.x + 1.5), z: r2(state.stockpile.z + 1) }, summary: `${witness.name} says ${a.name} took bread from the crates.`, topic: 'bread' }) : null;
        if (c) { applied = 'theft'; effects.push({ type: 'conflict', conflictId: c.id }); nudgeAffinity(game, witness.id, a.id, -0.3, 'theft'); }
        else ok = false;
      } else { // not desperate: the urge becomes a complaint
        say = say || 'The crates are too well counted.'; intent.type = 'complain'; intent.text = 'the crates'; return applyIntent(game, agentId, { intent, say, memory_note: r.memory_note, mood_delta: r.mood_delta }, { source });
      }
      break;
    }
    default: ok = false;
  }
  if (say) game.emit('agent:say', { agentId: a.id, text: say, kind: 'mind', ttl: MIND.sayTtl, intent: intent.type, source });
  if (r.mood_delta) nudgeMood(a, r.mood_delta, 'own thoughts', game.emit);
  if (r.memory_note) observe(game, a, r.memory_note, { imp: 2, kind: 'note' });
  m.intent = { ...intent, at: +state.t.toFixed(1), ok, applied };
  game.emit('agent:intent', { agentId: a.id, intent: { type: intent.type, ...(intent.target ? { target: intent.target } : {}), ...(intent.text ? { text: intent.text } : {}), ...(intent.place ? { place: intent.place } : {}) }, say: say || null, source, ok, applied, effects });
  game.log(`${a.name} decides: ${intent.type}${intent.target ? ' ' + intent.target : ''}${intent.text ? ' "' + intent.text.slice(0, 40) + '"' : ''}${ok ? '' : ' (not now)'}${say ? ' — "' + say + '"' : ''} [${source}]`);
  return { ok, intent, say, applied, effects };
}
// what an opener is about, for the memory and the mock exchange ("Seen the sky?" -> the weather)
export function topicOf(text) {
  const t = String(text || '').toLowerCase();
  if (!t) return 'the day';
  if (/sky|weather|wind|rain|cloud|light/.test(t)) return 'the weather';
  if (/hungry|bread|food|crate|eat|supper/.test(t)) return 'bread';
  if (/sleep|roof|house|home|indoors|cold/.test(t)) return 'a roof';
  if (/minister|seal|vote/.test(t)) return 'the minister';
  if (/site|wall|build|hammer|crate/.test(t)) return 'the site';
  if (/neighbou?r|nation|loaf|drop|puffer|harbour|riviera/.test(t)) return 'the neighbours';
  if (/help|hand/.test(t)) return 'helping out';
  return t.replace(/[?!.]+$/, '').split(' ').slice(0, 5).join(' ') || 'the day';
}
function nearestFree(game, a) {
  return game.state.agents.filter(o => alive(o) && o.id !== a.id && !isBusy(o) && !inConversation(game.state, o.id)).sort((p, q) => dist(a.x, a.z, p.x, p.z) - dist(a.x, a.z, q.x, q.z))[0] || null;
}

// ---------------------------------------------------------------------------------------------------------------------
// Conversations between two folk (2-4 alternating lines)
// ---------------------------------------------------------------------------------------------------------------------
export const inConversation = (state, id) => (state.conversations || []).some(c => c.status !== 'done' && (c.a === id || c.b === id));

export function startConversation(game, a, b, topic, { opener = '' } = {}) {
  const { state } = game;
  if (!alive(a) || !alive(b) || a.id === b.id) return null;
  if (inConversation(state, a.id) || inConversation(state, b.id)) return null;
  if (isBusy(b)) return null;
  state.conversations = state.conversations || [];
  state.nextConversationId = (state.nextConversationId || 0) + 1;
  const c = { id: 'c' + state.nextConversationId + 'v', a: a.id, b: b.id, topic: String(topic || 'the day').slice(0, 80), opener: String(opener || '').slice(0, 120), lines: [], status: 'pending', at: +state.t.toFixed(1), day: state.day };
  state.conversations.push(c);
  if (state.conversations.length > 24) state.conversations = state.conversations.filter(x => x.status !== 'done').concat(state.conversations.filter(x => x.status === 'done').slice(-8));
  // a goes to b (b keeps doing what it does; the bubbles alternate above both)
  if (canInterrupt(a) && dist(a.x, a.z, b.x, b.z) > 2.2) setTask(game, a, { kind: 'walk', to: game.freeGroundNear(b, 1.8), phase: 'wander' });
  game.emit('conversation:start', { conversationId: c.id, a: a.id, b: b.id, topic: c.topic });
  return c;
}

// the body for POST /api/minds/converse
export function converseRequest(game, conversationId) {
  const { state } = game;
  const c = (state.conversations || []).find(x => x.id === conversationId);
  if (!c) return null;
  const A = state.agents.find(x => x.id === c.a), B = state.agents.find(x => x.id === c.b);
  if (!alive(A) || !alive(B)) return null;
  const side = (x, y) => ({ id: x.id, name: x.name, species: x.species, trade: x.trade, traits: x.traits.slice(), mood: Math.round(x.mood), job: x.job, persona: personaOf(state, x.id), opinionOfOther: (personaOf(state, x.id) || { opinions: {} }).opinions[y.id] || null });
  return {
    conversationId: c.id, topic: c.topic, opener: c.opener, turns: MIND.converseTurns[0] + (hashString(c.id) % (MIND.converseTurns[1] - MIND.converseTurns[0] + 1)),
    a: side(A, B), b: side(B, A), memoryA: memoryForPrompt(A, { items: 8, reflections: 2 }), memoryB: memoryForPrompt(B, { items: 8, reflections: 2 }), affinity: affinity(state, A.id, B.id),
    world: { name: state.name, day: state.day, hungry: !!state.hungry, food: state.resources.food, minister: (state.agents.find(x => x.id === state.minister) || {}).name || null, sites: state.buildings.filter(b => b.status !== 'done' && b.status !== 'removed').map(b => b.name).slice(0, 4) }
  };
}

export function normaliseConverse(data, req) {
  const d = data && typeof data === 'object' ? data : {};
  const ids = req ? [req.a.id, req.b.id] : [];
  const lines = (Array.isArray(d.lines) ? d.lines : []).map((l, i) => {
    if (!l || typeof l !== 'object') return null;
    let sp = String(l.speaker || '').trim();
    if (sp === 'a') sp = ids[0]; else if (sp === 'b') sp = ids[1];
    if (ids.length && !ids.includes(sp)) sp = ids[i % 2];
    const text = clampWords(String(l.text || '').replace(/\s+/g, ' ').trim(), 14);
    return text ? { speaker: sp, text } : null;
  }).filter(Boolean).slice(0, MIND.converseTurns[1]);
  const o = d.outcome && typeof d.outcome === 'object' ? d.outcome : {};
  const aff = Number.isFinite(Number(o.affinity)) ? Math.max(-2, Math.min(2, Math.round(Number(o.affinity)))) : 0;
  return { lines, outcome: { affinity: aff, noteA: String(o.noteA || '').slice(0, 140), noteB: String(o.noteB || '').slice(0, 140), spawns: ['letter', 'conflict'].includes(o.spawns) ? o.spawns : 'none', subject: String(o.subject || '').slice(0, 80) } };
}

// the mock exchange: short alternating lines in both voices, from the topic and what they think of each other
const CHAT = {
  food: [['Hungry yet?', 'Since yesterday. You?'], ['The crates are low.', 'I have counted. Twice.'], ['Bread would be nice.', 'Bread would be everything.'], ['Who hides a crust?', 'Not me. Mostly.']],
  minister: [['What of the minister?', 'Means well. Counts slowly.'], ['The seal suits them.', 'It would suit me better.'], ['Minister this, minister that.', 'Somebody has to count.']],
  site: [['How goes the site?', 'Crates in, walls up.'], ['Pass me that crate.', 'Carry your own, friend.'], ['The roof wants nails.', 'The roof wants me.'], ['Good wall.', 'My wall.']],
  gossip: [['Between us: {x}.', 'Go on.'], ['Did you hear about {x}?', 'I hear everything. Tell me anyway.'], ['{x} again.', 'Always {x}.']],
  help: [['Need a hand?', 'Two, if you have them.'], ['I will take the heavy one.', 'Suits me.'], ['You looked stuck.', 'I was. Thank you.']],
  weather: [['Seen the sky?', 'Cobalt. Rain by evening.'], ['Wind is kind today.', 'Kind to parasols. Not to caps.'], ['Lovely light.', 'Better with a roof.']],
  home: [['Who sleeps indoors tonight?', 'Not me. Stars again.'], ['A house would be nice.', 'A house is coming. Ask the sky.']],
  default: [['How goes it?', 'It goes. Slowly.'], ['A word?', 'A short one. I am carrying.'], ['Good day for flying.', 'Good day for sitting.'], ['You look tired.', 'I look busy. Different thing.']]
};
export function mockConverse(req) {
  if (!req) return null;
  const t = String(req.topic || '').toLowerCase();
  const kind = /bread|food|hungry|crate/.test(t) ? 'food' : /minister|seal/.test(t) ? 'minister' : /site|crate|wall|roof|build/.test(t) ? 'site' : /gossip/.test(t) ? 'gossip' : /help/.test(t) ? 'help' : /sky|weather|wind|rain/.test(t) ? 'weather' : /roof|house|sleep|indoors/.test(t) ? 'home' : 'default';
  const x = String(req.topic || '').replace(/^gossip about\s*/i, '').trim() || 'things';   // keeps the name's case
  const pairs = CHAT[kind];
  const seed = `${req.conversationId}|${req.a.id}|${req.b.id}|${req.topic}`;
  const va = voicePrefix(req.a.persona ? req.a.persona.voice : ''), vb = voicePrefix(req.b.persona ? req.b.persona.voice : '');
  const turns = Math.max(2, Math.min(4, Number(req.turns) || 3));
  const [l1, l2] = pick(pairs, seed).map(s => s.replace(/\{x\}/g, x));
  const lines = [{ speaker: req.a.id, text: req.opener ? clampWords(va(req.opener), 14) : clampWords(va(l1), 14) }, { speaker: req.b.id, text: clampWords(vb(l2), 14) }];
  const aff = Number(req.affinity) || 0;
  const closers = aff < -0.2 ? [['We will see.', 'We will.'], ['Hm.', 'Hm yourself.']] : aff > 0.2 ? [['Good to talk.', 'Always.'], ['Same time tomorrow?', 'If the crates allow.']] : [['Back to it.', 'Back to it.'], ['Mind the crate.', 'Mind the sky.']];
  const [c1, c2] = pick(closers, seed + 'c');
  if (turns >= 3) lines.push({ speaker: req.a.id, text: clampWords(va(c1), 14) });
  if (turns >= 4) lines.push({ speaker: req.b.id, text: clampWords(vb(c2), 14) });
  const h = hashString(seed);
  const spawns = kind === 'minister' && aff < -0.2 && h % 4 === 0 ? 'conflict' : kind === 'home' && h % 3 === 0 ? 'letter' : 'none';
  const affinity = aff < -0.2 ? (h % 3 === 0 ? -1 : 0) : (kind === 'help' || kind === 'gossip' ? 1 : h % 2 === 0 ? 1 : 0);
  return { lines, outcome: { affinity, noteA: `I talked with ${req.b.name} about ${x === 'things' ? req.topic : x}.`, noteB: `${req.a.name} came to talk about ${x === 'things' ? req.topic : x}.`, spawns, subject: req.topic } };
}

// the lines go into the say queue (alternating bubbles, MIND.chatGap apart); the outcome lands at once
export function applyConversation(game, conversationId, result) {
  const { state } = game;
  const c = (state.conversations || []).find(x => x.id === conversationId);
  if (!c) return null;
  const req = converseRequest(game, conversationId);
  const r = normaliseConverse(result, req || { a: { id: c.a }, b: { id: c.b } });
  const A = state.agents.find(x => x.id === c.a), B = state.agents.find(x => x.id === c.b);
  c.lines = r.lines; c.status = 'talking'; c.outcome = r.outcome;
  state.minds = state.minds || {}; state.minds.sayQueue = state.minds.sayQueue || [];
  r.lines.forEach((l, i) => state.minds.sayQueue.push({ at: +(state.t + i * MIND.chatGap).toFixed(2), agentId: l.speaker, text: l.text, conversationId: c.id, turn: i + 1, of: r.lines.length }));
  c.endsAt = +(state.t + r.lines.length * MIND.chatGap).toFixed(2);
  if (A && B) {
    const d = r.outcome.affinity * MIND.affinityStep;
    if (d) nudgeAffinity(game, A.id, B.id, d, 'talked');
    observe(game, A, r.outcome.noteA || `I talked with ${B.name} about ${c.topic}.`, { imp: 2, kind: 'talk', about: B.id });
    observe(game, B, r.outcome.noteB || `${A.name} talked to me about ${c.topic}.`, { imp: 2, kind: 'talk', about: A.id });
    for (const l of r.lines) { const sp = l.speaker === A.id ? A : B, other = sp === A ? B : A; observe(game, other, `${sp.name} said to me: "${l.text}"`, { imp: 1, kind: 'heard', about: sp.id }); }
    if (r.outcome.spawns === 'letter') applyIntent(game, A.id, { intent: { type: 'write_letter', target: 'sovereign', text: r.outcome.subject || c.topic }, say: '' }, { source: 'conversation' });
    else if (r.outcome.spawns === 'conflict' && !state.conflicts.some(x => x.status !== 'resolved' && (x.parties.includes(A.id) || x.parties.includes(B.id))) && !state.fleetHold) {
      const topic = r.outcome.subject || c.topic;
      const k = startConflict(game, { kind: 'quarrel', parties: [A.id, B.id], roles: {}, severity: 1, place: { x: r2((A.x + B.x) / 2), z: r2((A.z + B.z) / 2) }, summary: `${A.name} and ${B.name} are quarrelling over ${topic}.`, topic });
      if (k) nudgeAffinity(game, A.id, B.id, -0.2, 'quarrel');
    }
  }
  game.emit('conversation:lines', { conversationId: c.id, a: c.a, b: c.b, lines: r.lines.slice(), affinity: affinity(state, c.a, c.b) });
  return c;
}

// ticked from state.js: the chat bubbles in order, and conversations ending
export function tickMinds(game) {
  const { state } = game;
  const q = state.minds && state.minds.sayQueue;
  if (q && q.length) {
    const due = q.filter(s => state.t >= s.at);
    if (due.length) {
      state.minds.sayQueue = q.filter(s => state.t < s.at);
      for (const s of due) {
        const a = state.agents.find(x => x.id === s.agentId);
        if (!alive(a)) continue;
        game.emit('agent:say', { agentId: s.agentId, text: s.text, kind: 'chat', ttl: MIND.sayTtl, conversationId: s.conversationId, turn: s.turn, of: s.of });
        if (s.turn === 1) game.emit('agent:listen', { agentId: (state.conversations || []).find(c => c.id === s.conversationId)?.b });
      }
    }
  }
  for (const c of state.conversations || []) if (c.status === 'talking' && c.endsAt != null && state.t >= c.endsAt) { c.status = 'done'; game.emit('conversation:end', { conversationId: c.id, a: c.a, b: c.b, affinity: affinity(state, c.a, c.b), spawns: c.outcome ? c.outcome.spawns : 'none' }); }
}

// ---------------------------------------------------------------------------------------------------------------------
// Reflection: every ~8 new memories, one line that says what they add up to
// ---------------------------------------------------------------------------------------------------------------------
export function reflectRequest(game, agentId) {
  const a = game.state.agents.find(x => x.id === agentId);
  if (!alive(a)) return null;
  const m = mindOf(a);
  return { agentId: a.id, name: a.name, persona: personaOf(game.state, a.id), items: m.memory.slice(-MIND.reflectEvery - 2).map(x => `d${x.day}: ${x.text}`), reflections: m.reflections.slice(-2).map(x => x.text), relationships: relationshipsOf(game.state, a, { max: 3 }) };
}
export function mockReflect(req) {
  if (!req) return null;
  const items = req.items || [];
  const who = {};
  for (const it of items) for (const m of it.matchAll(/\b([A-Z][a-z]+(?: [A-Z][a-z]+)?)\b/g)) if (m[1] !== req.name && !/^(The|I|My|Dear|Founder|Day|Nobody|Someone|Done)$/.test(m[1])) who[m[1]] = (who[m[1]] || 0) + 1;
  const top = Object.entries(who).sort((p, q) => q[1] - p[1])[0];
  const themes = [];
  if (items.some(i => /bread|hungry|crate/i.test(i))) themes.push('the crates are on everyone\'s mind');
  if (items.some(i => /site|raise|wall|house/i.test(i))) themes.push('the town is going up around me');
  if (items.some(i => /sovereign|the sky|founder/i.test(i))) themes.push('the sky talks to me, and listens');
  if (items.some(i => /quarrel|theft|stole|noise/i.test(i))) themes.push('there is trouble I did not start');
  const goal = req.persona && req.persona.goal ? req.persona.goal : null;
  const line = [top ? `${top[0]} keeps turning up in my days.` : null, themes[0] ? cap(themes[0]) + '.' : null, goal ? `I still want ${goal.replace(/\.$/, '')}.` : null].filter(Boolean).join(' ') || 'Quiet days. I am keeping count.';
  return { reflection: line };
}
export function normaliseReflect(data) { const t = data && typeof data === 'object' ? (data.reflection || data.text) : data; return typeof t === 'string' ? t.trim().slice(0, 200) : ''; }

// ---------------------------------------------------------------------------------------------------------------------
// The director (Fable): the story's hand on the society
// ---------------------------------------------------------------------------------------------------------------------
export function directRequest(game, reason = 'periodic') {
  const { state } = game;
  const folk = state.agents.filter(alive);
  state.minds = state.minds || {};
  return {
    reason,
    snapshot: game.snapshot(),
    personas: folk.map(a => { const p = personaOf(state, a.id) || {}; return { id: a.id, name: a.name, trade: a.trade, goal: p.goal || null, fear: p.fear || null, voice: p.voice || null, mood: Math.round(a.mood), job: a.job }; }),
    memories: Object.fromEntries(folk.map(a => { const m = memoryForPrompt(a, { items: 5, reflections: 2 }); return [a.id, [...m.reflections.map(r => 'R: ' + r), ...m.items]]; })),
    relationships: relationshipsBrief(state, { max: 8 }),
    tensions: (state.minds.tensions || []).slice(),
    story: { arc: (state.minds.arc || []).slice(-6), milestones: { ...(state.minds.milestones || {}) }, conflicts: state.conflicts.slice(-5).map(c => ({ id: c.id, kind: c.kind, status: c.status, summary: c.summary })), institutions: state.institutions.map(i => ({ kind: i.kind, name: i.name, status: i.status })), ventures: state.ventures.slice(-4).map(v => ({ title: v.title, who: (folk.find(a => a.id === v.agentId) || {}).name, status: v.status })), letters: state.letters.slice(-8).map(l => ({ from: l.from.name, kind: l.kind, subject: l.subject, resolved: l.resolved })), directions: state.minds.directions || 0 },
    options: { events: DIRECTOR_EVENTS.slice(), conflictKinds: ['theft', 'quarrel', 'noise', 'land', 'neglect', 'envoy', 'jealousy'] }
  };
}
export function normaliseDirection(data) {
  const d = data && typeof data === 'object' ? data : {};
  const str = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
  const events = (Array.isArray(d.events) ? d.events : []).filter(e => e && DIRECTOR_EVENTS.includes(e.kind)).slice(0, 3).map(e => ({ kind: e.kind, agentIds: (Array.isArray(e.agentIds) ? e.agentIds : []).filter(x => typeof x === 'string').slice(0, 3), neighbourId: str(e.neighbourId, 10), topic: str(e.topic, 80), text: str(e.text, 300), severity: Number.isFinite(Number(e.severity)) ? Math.max(1, Math.min(3, Math.round(Number(e.severity)))) : 1 }));
  const nudges = (Array.isArray(d.nudges) ? d.nudges : []).filter(n => n && typeof n.agentId === 'string' && typeof n.goal === 'string' && n.goal.trim()).slice(0, 4).map(n => ({ agentId: n.agentId, goal: n.goal.trim().slice(0, 140) }));
  const b = d.minister_briefing && typeof d.minister_briefing === 'object' ? d.minister_briefing : typeof d.minister_briefing === 'string' ? { subject: 'A word from the minister', body: d.minister_briefing } : null;
  return { arc_note: str(d.arc_note, 300), events, nudges, minister_briefing: b && str(b.body, 900) ? { subject: str(b.subject, 60) || 'A word from the minister', body: str(b.body, 900) } : null };
}

// the mock director: reads the state and the relationships, deterministic per direction count
export function mockDirect(game, reason = 'periodic') {
  const { state } = game;
  const folk = state.agents.filter(alive);
  state.minds = state.minds || {};
  const n = state.minds.directions || 0;
  const seed = `direct|${n}|${state.day}|${reason}`;
  const minister = folk.find(a => a.id === state.minister) || null;
  const events = [];
  const rel = relationshipsBrief(state, { max: 4 });
  const openConflict = state.conflicts.some(c => c.status !== 'resolved');
  const worst = rel.find(r => r.affinity <= -0.3);
  if (reason === 'start') events.push({ kind: 'weather', topic: 'arrival', text: pick(['A clear morning. The cream ground is warm and the sea is gold.', 'Thin cloud, a kind wind off the water.'], seed), severity: 1 });
  else if (!openConflict && worst && state.t > 120 && !state.fleetHold) events.push({ kind: 'conflict', agentIds: [worst.a, worst.b], topic: pick(['who gets the credit for the first wall', 'a borrowed tool not returned', 'who should lead the next site'], seed), text: '', severity: 1 });
  else if (state.mood < 50 && n % 2 === 1) events.push({ kind: 'festival', topic: 'lanterns', text: 'Lanterns on the square tonight: a small feast to lift the mood.', severity: 1 });
  else if (state.neighbours.some(x => x.attitude < 40) && n % 3 === 2) { const cold = state.neighbours.filter(x => x.attitude < 40).sort((p, q) => p.attitude - q.attitude)[0]; events.push({ kind: 'visitor', neighbourId: cold.id, topic: 'a cautious visit', text: `A traveller of ${cold.name} walks in with news and a long look at our crates.`, severity: 1 }); }
  else if (n % 2 === 0) events.push({ kind: 'weather', topic: pick(['sea fog', 'a warm wind', 'a short rain'], seed), text: pick(['Sea fog creeps over the plot; the folk work close and talk low.', 'A warm wind from the Riviera; everyone is a little lighter.', 'A short rain, then a rainbow over the lake.'], seed), severity: 1 });
  else { const amb = folk.filter(a => a.traits.includes('ambitious') && a.id !== state.minister)[n % Math.max(1, folk.filter(a => a.traits.includes('ambitious') && a.id !== state.minister).length)]; if (amb) events.push({ kind: 'opportunity', agentIds: [amb.id], topic: ventureFromGoal((personaOf(state, amb.id) || {}).goal), text: '', severity: 1 }); }
  const nudges = folk.filter(a => !a.homeId && state.day >= 2).slice(0, 1).map(a => ({ agentId: a.id, goal: 'a roof of my own before the next cold night' }))
    .concat(folk.filter(a => a.traits.includes('ambitious')).slice(n % 2, n % 2 + 1).map(a => ({ agentId: a.id, goal: `${(personaOf(state, a.id) || { goal: 'a place of my own' }).goal}, and soon` })));
  const s = game.summary();
  const body = minister ? `${pick(['Founder,', 'A short report, as promised.', 'From the minister\'s desk:'], seed)}\n\n${s.pop} of us, ${s.housed} under a roof, ${s.food} food in the crates${s.foodRate < 0 ? ' and going down' : ''}. ${s.sites ? `Sites: ${s.siteNames.join(', ')}. ` : ''}${s.unhappy.length ? `${s.unhappy.join(' and ')} ${s.unhappy.length > 1 ? 'are' : 'is'} unhappy. ` : 'Moods hold. '}${worst ? `${worst.names} do not get on; keep an eye on it. ` : ''}${s.conflicts.length ? `Trouble: ${s.conflicts[0]} ` : ''}My advice: ${s.advice}.\n\n— ${minister.name}` : null;
  return normaliseDirection({ arc_note: pick([`Day ${state.day}: the camp finds its feet; ${worst ? worst.names.replace(' & ', ' and ') + ' circle each other' : 'small kindnesses'}.`, `Act ${state.stage === 'camp' ? 'one' : 'two'}: ${s.sites ? 'walls go up and tempers with them' : 'a pause before the next thing'}.`], seed), events, nudges, minister_briefing: body ? { subject: pick(['How things stand', 'The crates and the folk', 'A word from the minister'], seed), body } : null });
}

// apply a direction through the sim's own systems
export function applyDirection(game, result, { reason = 'periodic' } = {}) {
  const { state } = game;
  const r = normaliseDirection(result);
  const folk = state.agents.filter(alive);
  state.minds = state.minds || {};
  state.minds.directions = (state.minds.directions || 0) + 1;
  state.minds.lastDirectAt = +state.t.toFixed(1);
  state.minds.arc = state.minds.arc || [];
  if (r.arc_note) { state.minds.arc.push({ t: +state.t.toFixed(1), day: state.day, text: r.arc_note }); if (state.minds.arc.length > 12) state.minds.arc.shift(); }
  const applied = [];
  for (const e of r.events) {
    const who = e.agentIds.map(id => folk.find(a => a.id === id)).filter(Boolean);
    if (e.kind === 'conflict') {
      if (state.fleetHold || state.scene === 'moon') continue;
      const free = folk.filter(a => !state.conflicts.some(c => c.status !== 'resolved' && c.parties.includes(a.id)));
      const [A, B] = who.length >= 2 ? who : [who[0] || free[0], free.find(x => x !== (who[0] || free[0]))];
      if (!A || !B) continue;
      const topic = e.topic || 'who is right';
      const c = startConflict(game, { kind: 'quarrel', parties: [A.id, B.id], roles: {}, severity: e.severity, place: { x: r2((A.x + B.x) / 2), z: r2((A.z + B.z) / 2) }, summary: e.text || `${A.name} and ${B.name} are quarrelling over ${topic}.`, topic });
      if (c) { nudgeAffinity(game, A.id, B.id, -0.15, 'director'); applied.push({ kind: 'conflict', conflictId: c.id }); }
    } else if (e.kind === 'visitor') {
      const n = state.neighbours.find(x => x.id === e.neighbourId) || state.neighbours.slice().sort((p, q) => q.attitude - p.attitude)[0];
      if (!n) continue;
      const letter = L.makeLetter({ from: { kind: 'neighbour', id: n.id, name: n.name }, kind: 'neighbour_news', day: state.day, subject: cap(e.topic || 'A visitor'), body: `${e.text || `A traveller of ${n.name} walks in with news.`}\n\n— ${n.leaderName || n.name}`, options: [{ label: 'Welcome them', says: `send ${n.name} a basket of bread` }, { label: 'Note it', says: 'no' }], effects: { yes: [{ type: 'attitude', neighbourId: n.id, delta: 4 }], no: [] }, meta: { director: true, kind: 'visitor' } });
      game.sendLetter(letter); state.lastNeighbour = n.id;
      for (const a of folk.slice(0, 4)) observe(game, a, `A visitor from ${n.name} came through.`, { imp: 2, kind: 'event' });
      applied.push({ kind: 'visitor', letterId: letter.id, neighbourId: n.id });
    } else if (e.kind === 'weather') {
      state.minds.weather = { text: e.text || e.topic, day: state.day };
      for (const a of folk) observe(game, a, e.text || `Weather: ${e.topic}.`, { imp: 1, kind: 'weather' });
      game.emit('world:weather', { topic: e.topic, text: e.text, day: state.day });
      applied.push({ kind: 'weather' });
    } else if (e.kind === 'festival') {
      if (state.fleetHold) continue;
      for (const a of folk) { nudgeMood(a, 5, 'festival', game.emit); observe(game, a, e.text || 'A festival on the square.', { imp: 3, kind: 'event' }); }
      state.resources.food = Math.max(0, state.resources.food - 4); game.emit('resources', { resources: { ...state.resources } });
      const singers = folk.slice().sort((p, q) => q.skills.art - p.skills.art).slice(0, 3);
      singers.forEach((a, i) => { state.minds.sayQueue = state.minds.sayQueue || []; state.minds.sayQueue.push({ at: +(state.t + 0.5 + i * 1.5).toFixed(2), agentId: a.id, text: pick(['Lanterns! Ribbons!', 'A song, a song!', 'To the square, everyone!'], a.id + 'f'), conversationId: null, turn: 1, of: 1 }); game.emit('agent:listen', { agentId: a.id, hop: true }); });
      game.emit('festival', { topic: e.topic, text: e.text, by: 'director' });
      applied.push({ kind: 'festival' });
    } else if (e.kind === 'opportunity') {
      const a = who[0] || folk.filter(x => x.traits.includes('ambitious') && x.id !== state.minister)[0] || folk[0];
      if (!a || state.fleetHold) continue;
      const idea = e.topic || ventureFromGoal((personaOf(state, a.id) || {}).goal);
      const open = state.ventures.some(v => v.agentId === a.id && !['declined', 'done'].includes(v.status));
      if (open) continue;
      const v = proposeVenture(game, a, { title: titleOf(idea).slice(0, 40), request: /^(a|an)\s/i.test(idea) ? idea : `a ${idea}` }, { ask: true });
      if (v) { observe(game, a, `An opening: ${idea}. I asked the sky.`, { imp: 3, kind: 'event' }); applied.push({ kind: 'opportunity', ventureId: v.id, agentId: a.id }); }
    }
  }
  for (const nd of r.nudges) {
    const a = folk.find(x => x.id === nd.agentId); if (!a) continue;
    state.personas = state.personas || {};
    const p = state.personas[a.id] || (state.personas[a.id] = { id: a.id, name: a.name, backstory: '', voice: 'plain and short', quirks: [], values: [], fear: '', goal: '', opinions: {}, secret: '' });
    p.goal = nd.goal;
    observe(game, a, `I have decided what I want: ${nd.goal}.`, { imp: 4, kind: 'goal' });
    applied.push({ kind: 'nudge', agentId: a.id });
  }
  if (r.minister_briefing) {
    const minister = folk.find(a => a.id === state.minister) || null;
    const letter = L.makeLetter({ from: minister ? { kind: 'minister', id: minister.id, name: minister.name } : L.fromMinistry(), kind: 'report', day: state.day, subject: r.minister_briefing.subject, body: r.minister_briefing.body, options: [], meta: { kind: 'briefing', director: true } });
    game.sendLetter(letter); applied.push({ kind: 'briefing', letterId: letter.id });
  }
  game.emit('mind:direct', { reason, arc_note: r.arc_note, events: r.events.map(e => e.kind), nudges: r.nudges.length, briefing: !!r.minister_briefing, applied });
  game.log(`Director (${reason}): ${r.arc_note || '(no note)'}; ${applied.map(x => x.kind).join(', ') || 'nothing to apply'}.`);
  return { ...r, applied };
}
// milestones the loop asks the director about (once each)
export function noteMilestone(game, key) {
  const { state } = game;
  state.minds = state.minds || {};
  state.minds.milestones = state.minds.milestones || {};
  if (state.minds.milestones[key]) return false;
  state.minds.milestones[key] = +state.t.toFixed(1);
  return true;
}

// ---------------------------------------------------------------------------------------------------------------------
// Observations the sim makes by itself (wired from state.js): what the folk notice without being told
// ---------------------------------------------------------------------------------------------------------------------
export function wireObservations(game) {
  const { state } = game;
  const name = id => (state.agents.find(a => a.id === id) || { name: id }).name;
  const near = (p, r) => state.agents.filter(a => alive(a) && p && dist(a.x, a.z, p.x, p.z) <= r);
  game.on('building:done', ({ building: b }) => { for (const a of near(b, 12)) observe(game, a, a.jobId === b.id || (b.workers || []).includes(a.id) ? `We finished the ${b.name.toLowerCase()}.` : `The ${b.name.toLowerCase()} is finished, near me.`, { imp: 3, kind: 'event' }); });
  game.on('building:site', ({ building: b }) => { for (const id of b.workers || []) { const a = state.agents.find(x => x.id === id); if (a) observe(game, a, `I was put on the ${b.name.toLowerCase()} crew.`, { imp: 2, kind: 'event' }); } });
  game.on('conflict:start', ({ conflict: c }) => { for (const id of c.parties) { const a = state.agents.find(x => x.id === id); if (a) observe(game, a, c.roles.offender === id ? `I am accused: ${c.summary}` : `Trouble: ${c.summary}`, { imp: 4, kind: 'conflict' }); } if (c.parties.length === 2) nudgeAffinity(game, c.parties[0], c.parties[1], -0.15, c.kind); });
  game.on('conflict:handle', ({ conflictId, how, by, parties }) => { for (const id of parties) { const a = state.agents.find(x => x.id === id); if (a) observe(game, a, `The ${by === 'institution' ? 'patrol' : 'sovereign'} answered our dispute: ${how}.`, { imp: 3, kind: 'conflict' }); } if (how === 'talk' && parties.length === 2) nudgeAffinity(game, parties[0], parties[1], 0.1, 'settled'); });
  game.on('minister:set', ({ agentId, by, prev }) => { for (const a of state.agents.filter(alive)) observe(game, a, agentId === a.id ? `The ${by === 'crowd' ? 'folk' : 'sovereign'} made me minister.` : agentId ? `${name(agentId)} is minister now${prev ? ', after ' + name(prev) : ''}.` : 'We have no minister.', { imp: agentId === a.id ? 5 : 3, kind: 'event' }); });
  game.on('institution:assign', ({ agentId, role }) => { const a = state.agents.find(x => x.id === agentId); if (a) observe(game, a, `I am ${role.title} of the ${role.kind} now.`, { imp: 4, kind: 'event' }); });
  game.on('institution:found', ({ institution: i }) => { for (const a of state.agents.filter(alive).filter(x => !i.members.includes(x.id))) observe(game, a, `The sovereign founded the ${i.name}.`, { imp: 2, kind: 'event' }); });
  game.on('venture:start', ({ agentId, title }) => { const a = state.agents.find(x => x.id === agentId); if (a) observe(game, a, `The sovereign said yes to my ${title.toLowerCase()}.`, { imp: 4, kind: 'event' }); });
  game.on('venture:decline', ({ agentId }) => { const a = state.agents.find(x => x.id === agentId); if (a) observe(game, a, 'The sovereign said no to my venture.', { imp: 3, kind: 'event' }); });
  game.on('letter:resolved', ({ letterId, decision }) => { const l = state.letters.find(x => x.id === letterId); if (l && l.from && l.from.kind === 'agent') { const a = state.agents.find(x => x.id === l.from.id); if (a) observe(game, a, `The sovereign answered my letter "${l.subject}": ${decision}.`, { imp: 3, kind: 'event' }); } });
  game.on('gift:send', ({ neighbourId, carrierId }) => { const a = state.agents.find(x => x.id === carrierId); if (a) observe(game, a, `I carried our gift to ${(state.neighbours.find(n => n.id === neighbourId) || {}).name || 'the neighbours'}.`, { imp: 3, kind: 'event' }); });
  game.on('election:result', ({ agentId, by }) => { for (const a of state.agents.filter(alive)) if (a.id !== agentId) observe(game, a, `${name(agentId)} won the seal${by === 'crowd' ? ' by our vote' : ''}.`, { imp: 2, kind: 'event' }); });
  game.on('agent:refuse', ({ agentId, task, why }) => { const a = state.agents.find(x => x.id === agentId); if (a) observe(game, a, `I refused ${task.label || 'the work'}: ${why}.`, { imp: 2, kind: 'event' }); });
  game.on('day', ({ day }) => { if (state.hungry) for (const a of state.agents.filter(alive)) observe(game, a, `Day ${day}: no bread again.`, { imp: 2, kind: 'event' }); });
}

// what the snapshot and talkContext show of all this (compact)
export function mindsBrief(state) {
  if (!state.minds || !state.minds.cast) return null;
  return { cast: true, directions: state.minds.directions || 0, ...(state.minds.arc && state.minds.arc.length ? { arc: state.minds.arc.at(-1).text } : {}), ...(state.minds.weather ? { weather: state.minds.weather.text } : {}), bonds: relationshipsBrief(state, { max: 4 }).map(r => `${r.names} ${r.affinity > 0 ? '+' : ''}${r.affinity}`) };
}
export function mindContextOf(state, a) {
  const p = personaOf(state, a.id);
  const m = memoryForPrompt(a, { items: 8, reflections: 2 });
  return { persona: p, mind: { memory: m.items, reflections: m.reflections, goal: p ? p.goal : null, relationships: relationshipsOf(state, a, { max: 4 }) } };
}
