// Plain words for the UI: what a trait means, how a fleet is counted, how a job reads, and the folk's own simple
// replies when no model is answering (mock mode). Pure functions, no DOM. Used by ui.js; exported for the game.

// every trait the sim deals (sim/society.js TRAITS) plus a few the agents layer may add, each with a plain meaning
export const TRAIT_MEANINGS = {
  proud: 'thinks their work is the best (and says so)',
  lazy: 'would rather rest than haul',
  loyal: 'sticks with you, even on bad days',
  gossip: 'knows everyone’s news, and shares it',
  ambitious: 'wants to start something of their own',
  timid: 'shy; says they are worse than they are',
  generous: 'gives away what they have',
  stubborn: 'hard to talk out of anything',
  cheerful: 'finds the good side of most things',
  curious: 'asks about everything',
  grumpy: 'complains, then does it anyway',
  patient: 'happy to wait and do it properly',
  dreamy: 'often somewhere else in their head',
  brave: 'first to go where nobody has been',
  careful: 'measures twice, builds once',
  chatty: 'will talk to anyone, about anything',
  hardworking: 'works until the job is done',
  thrifty: 'never wastes a plank or a crumb'
};
export const traitMeaning = t => TRAIT_MEANINGS[String(t || '').toLowerCase()] || '';

const NUM = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
export const numWord = n => NUM[n] ?? String(n);
const PLURAL = { flit: 'flits', floatie: 'floaties', loaf: 'loaves', drop: 'drops', puffer: 'puffers', pip: 'pips', scoot: 'scoots', twinkle: 'twinkles', glim: 'glims', moth: 'moths' };
// { flit: 4, floatie: 2 } -> "four flits · two floaties" (zero counts left out; one -> "one flit")
export function fleetLine(counts = {}) {
  return Object.entries(counts).filter(([, n]) => n > 0)
    .map(([sp, n]) => `${numWord(n)} ${n === 1 ? sp : PLURAL[sp] || sp + 's'}`).join(' · ');
}
const ORD = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
export const ordWord = n => ORD[n] || String(n);

// the job of a folk, whatever shape the sim / agents give it. The sim writes the whole label ("farmer at the Field",
// "builder at the Windmill site", "forager at the camp") while the game's lookup.workplace also names the building
// ("Field"): the place is said ONCE (ART_DIRECTION §15 bug: "Farmer at the Field at the Field").
const bare = s => String(s || '').trim().replace(/^(the|a|an)\s+/i, '').toLowerCase();
export function jobOf(agent = {}, lookup = {}) {
  const j = agent.job;
  let title = (j && typeof j === 'object' ? j.title || j.name : typeof j === 'string' ? j : null) || agent.trade || null;
  const own = agent.workplace && typeof agent.workplace === 'object' ? agent.workplace.name : agent.workplace || (j && typeof j === 'object' ? j.place || j.workplace : null) || null;
  let place = own;
  // "role at the place" in the title: split it; the title's place is the sim's own words (it knows "… site")
  const m = typeof title === 'string' ? /^(.+?)\s+at\s+(.+)$/i.exec(title.trim()) : null;
  if (m) {
    title = m[1];
    const said = m[2];
    // an explicit, different workplace on the agent wins; otherwise the title's own place
    if (!own || bare(own) === bare(said) || bare(said).startsWith(bare(own)) || bare(own).startsWith(bare(said))) place = said;
  }
  if (!place && typeof lookup.workplace === 'function') { try { const w = lookup.workplace(agent); place = w && typeof w === 'object' ? w.name : w; } catch (_) {} }
  // the title already names it ('keeper of the Tea house' + workplace 'Tea house'): say it once
  if (place && typeof title === 'string' && bare(place) && title.toLowerCase().includes(bare(place))) place = null;
  return { title, place: place || null };
}
// "at the Field" / "at the camp": the article once, never twice
export const atPlace = place => !place ? '' : `at ${/^the\b/i.test(place) ? place : 'the ' + place}`;
// an entrepreneur's venture: { name, status: 'dream'|'proposed'|'started'|'open' } or a string
export function ventureOf(agent = {}) {
  const v = agent.venture || agent.ambition || null;
  if (!v) return null;
  if (typeof v === 'string') return { name: v, status: 'dream' };
  return { name: v.name || v.title || 'something of their own', status: v.status || 'dream' };
}
export const ventureLine = v => !v ? '' : v.status === 'started' || v.status === 'building' ? `is starting ${v.name}` : v.status === 'open' ? `runs ${v.name}` : v.status === 'proposed' ? `has asked to open ${v.name}` : `dreams of opening ${v.name}`;
const a = w => /^[aeiou]/i.test(w) ? 'an' : 'a';
const strip = s => String(s || '').replace(/^(a|an|the)\s+/i, '');

// ---------- the folk's own words (mock mode): short, plain sentences ----------
// Used when no reply comes back from the game (no model, no server). Deterministic for the same question.
export function plainReply(agent = {}, text = '', { mood } = {}) {
  const t = String(text).toLowerCase().trim();
  const name = agent.name || 'I';
  const { title, place } = jobOf(agent);
  const job = title ? `${a(title)} ${title}` : 'one of the folk';
  const m = mood ?? agent.mood ?? 60;
  const traits = agent.traits || [];
  const v = ventureOf(agent);
  const feel = m < 30 ? 'Not good. I am tired and a bit cross.' : m < 45 ? 'So-so. Some days are heavy.' : m < 60 ? 'I am fine, thank you.' : m < 78 ? 'Good! The sun is nice today.' : 'Very happy! I love it here.';
  if (/^(hi|hello|hey|good (morning|evening|day)|ciao|greetings)\b/.test(t)) return `Hello! I am ${name}. I am ${job}.`;
  if (/how are you|how do you feel|are you (ok|okay|happy|sad|tired)|how’s it going|how is it going/.test(t)) return feel;
  if (/(your )?name|who are you/.test(t)) return `I am ${name}. ${agent.species ? `I am ${a(agent.species)} ${agent.species}.` : ''}`.trim();
  if (/what do you do|your job|work|what are you doing|busy/.test(t)) return place ? `I am ${job}. I work at ${place.startsWith('the ') ? place : 'the ' + strip(place)}.` : `I am ${job}. I am waiting for work.`;
  if (/dream|want|wish|like to|would you like|plan|idea/.test(t)) return v ? `I want to open ${v.name}. Can I?` : traits.includes('ambitious') ? 'One day I will open my own shop.' : 'A warm house and good bread. That is all.';
  if (/build|make|help|can you|could you|please/.test(t)) return traits.includes('lazy') ? 'Now? I was resting. Fine, I will help.' : traits.includes('stubborn') ? 'Only if we do it my way.' : 'Yes. Show me where, and I will help.';
  if (/minister|vote|elect/.test(t)) return 'The minister speaks for all of us. Choose well.';
  if (/neighbour|neighbor|loaf|drop|puffer|harbour|lantern|sorrento/.test(t)) return 'The neighbours are nice, mostly. They like bread.';
  if (/moon/.test(t)) return 'The moon? I have only seen it from far away.';
  if (/thank/.test(t)) return 'You are welcome!';
  if (/\?$/.test(t)) return traits.includes('timid') ? 'Oh. I do not know. Maybe?' : traits.includes('proud') ? 'I know the answer. I always do. Yes.' : 'Hmm. I think so, yes.';
  if (traits.includes('gossip')) return 'Did you hear? Somebody is building something new.';
  if (traits.includes('generous')) return 'Here, take half of my bread.';
  return 'I hear you. I will think about it.';
}
