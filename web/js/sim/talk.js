// Talk (ART_DIRECTION §11): folk answer in simple, short, plain sentences in a paper speech bubble. This file holds
// the offline mind for it (`mockTalk`, shared with the server's mock /api/talk), the small per-folk memory, and the
// spontaneous one-liners (`agent:say` a few times a minute, never spam). Pure: no THREE, no DOM, no rng stream
// (replies hash the words so the same question gets the same answer twice, which reads as character).

import { hashString } from './rng.js';

export const SAY = {
  firstAfter: 24,        // s after the start until the first spontaneous line
  every: [14, 26],       // s between lines (≈ 3 a minute)
  ttl: 4.5,              // s a bubble stays
  maxTalks: 6, maxEvents: 8
};

const pick = (arr, seed) => arr[hashString(String(seed)) % arr.length];
const cap = s => (s ? s[0].toUpperCase() + s.slice(1) : s);
const MOOD_WORD = m => (m >= 80 ? 'very happy' : m >= 60 ? 'well' : m >= 40 ? 'so-so' : m >= 20 ? 'low' : 'miserable');
const SKILL_WORD = { building: 'building', baking: 'baking', farming: 'farming', crafting: 'making things', trading: 'trading', diplomacy: 'talking people round', art: 'painting', scouting: 'scouting' };

// ---- memory ----
export function remember(a, text) {
  if (!a) return;
  a.memory = a.memory || { talks: [], events: [] };
  a.memory.events.push(text);
  if (a.memory.events.length > SAY.maxEvents) a.memory.events.shift();
}
export function recordTalk(a, you, me, t = 0, day = 1) {
  a.memory = a.memory || { talks: [], events: [] };
  a.memory.talks.push({ t: +Number(t).toFixed(1), day, you: String(you || '').slice(0, 200), me: String(me || '').slice(0, 200) });
  if (a.memory.talks.length > SAY.maxTalks) a.memory.talks.shift();
}

// at most two short sentences, plain words
export function trimReply(text, { sentences = 2, chars = 170 } = {}) {
  let s = String(text || '').replace(/\s+/g, ' ').trim();
  if (!s) return '';
  const raw = (s.match(/[^.!?]+[.!?]+["']?|[^.!?]+$/g) || [s]).map(p => p.trim()).filter(Boolean);
  // "A well? Yes." is one breath, not two sentences: a question or a cry of one or two words rides with what follows
  const parts = [];
  let glue = false;
  for (const p of raw) {
    if (glue) parts[parts.length - 1] += ' ' + p; else parts.push(p);
    glue = p.split(' ').length <= 2 && /[?!]["']?$/.test(p);
  }
  s = parts.slice(0, sentences).join(' ').trim();
  if (s.length > chars) s = s.slice(0, chars - 1).replace(/\s+\S*$/, '') + '…';
  return s;
}

// ---- intents ----
const RX = {
  greeting: /^(hi|hello|hey|hallo|good (morning|day|evening)|greetings|yo)\b/i,
  howAreYou: /how are you|how do you (feel|do)|are you (ok|okay|well|alright|happy)|your mood|feeling/i,
  name: /who are you|your name|what are you called|introduce/i,
  whatDo: /what do you do|what are you doing|your (job|work|trade)|what is your (job|work|trade)|do for work|busy with/i,
  skills: /good at|what can you|your skills?|best at|any good/i,
  want: /what do you (want|need|wish|dream)|what would you like|anything you need|wish for|dream of/i,
  town: /\b(this (town|place|camp|village|settlement)|like it here|the town|our town|the settlement|the camp|the plot|living here|life here)\b/i,
  minister: /minister/i,
  neighbours: /neighbou?r|nation|loaf|lantern|riviera|sorrento|drop|puffer|harbou?r|grey/i,
  food: /hungry|hunger|food|bread|eat|supper|dinner|meal/i,
  home: /\b(house|home|roof|sleep|bed|cold at night)\b/i,
  fleet: /fleet|square|team|crew|your group/i,
  thanks: /thank|well done|good job|bravo|proud of you|nice work/i,
  conflict: /quarrel|thie(f|ves)|stole|steal|theft|stolen|nois[ey]|dispute|fight|argu|complain|patrol|court|judge|guard|watchm|your (post|duty|beat)|trouble|grudge|jealous/i,
  build: /\b(build|make|raise|put up|could we have|can we have|we need a|i want a|let'?s have|would you like a|should we build|what should (we|i) build)\b/i,
  rest: /\b(rest|tired|sleep|take a break|day off)\b/i,
  bye: /\b(bye|goodbye|see you|farewell|later)\b/i,
  yes: /^(yes|yeah|yep|sure|ok|okay|fine|alright|go ahead)\b/i,
  no: /^(no|nope|not now|never|don't|do not)\b/i
};
export function talkIntent(text) {
  const t = String(text || '').trim();
  if (!t) return 'empty';
  for (const k of ['greeting', 'howAreYou', 'name', 'whatDo', 'skills', 'want', 'minister', 'neighbours', 'conflict', 'food', 'home', 'fleet', 'thanks', 'rest', 'town', 'build', 'bye', 'yes', 'no']) if (RX[k].test(t)) return k;
  return 'other';
}

// the thing after "build / make / we need a ..." -> a build request, or null
export function buildNoun(text) {
  const t = String(text || '').toLowerCase().replace(/[?!.]+$/g, '').trim();
  const m = t.match(/(?:build|make|raise|put up|have|need|want|like)\s+(?:us\s+|me\s+)?(?:a|an|the|some|two|three)?\s*([a-z][a-z \-']{2,40})$/);
  if (!m) return null;
  const noun = m[1].replace(/\b(here|there|please|now|today|for us|for me)\b/g, '').replace(/\s+/g, ' ').trim();
  if (!noun || /^(it|that|this|something|anything|one)$/.test(noun)) return null;
  return noun;
}

// ---- the offline mind ----
// ctx: { agent:{ name, species, trade, traits, mood, skills?, known?, job, memory?, isMinister?, fleet? }, text, history, snapshot }
export function mockTalk({ agent = {}, text = '', history = [], snapshot = {} } = {}) {
  const a = agent;
  const T = Array.isArray(a.traits) ? a.traits : [];
  const proud = T.includes('proud'), timid = T.includes('timid'), gossip = T.includes('gossip'), lazy = T.includes('lazy'), ambitious = T.includes('ambitious'), generous = T.includes('generous');
  const mood = Number.isFinite(a.mood) ? a.mood : 65;
  const name = a.name || 'I';
  const job = a.job || (a.trade ? `${a.trade} at the camp` : 'odd jobs');
  const seed = `${a.id || name}|${text}|${(history || []).length}`;
  const skills = a.skills && typeof a.skills === 'object' ? a.skills : {};
  const best = Object.entries(skills).sort((p, q) => q[1] - p[1])[0];
  const bestWord = best ? SKILL_WORD[best[0]] || best[0] : SKILL_WORD[{ builder: 'building', baker: 'baking', farmer: 'farming', crafter: 'crafting', trader: 'trading', diplomat: 'diplomacy', artist: 'art', dreamer: 'art', scout: 'scouting', courier: 'scouting' }[a.trade] || 'building'];
  const flier = a.species === 'floatie' ? 'My parasol likes the wind today.' : 'My propeller is wound and ready.';
  const hungry = !!snapshot.hungry || (snapshot.res && Number(snapshot.res.food) <= 0);
  const homeless = !!a.homeless;
  const minister = snapshot.minister ? (snapshot.agents || []).find(x => x.id === snapshot.minister) : null;
  const isMinister = !!a.isMinister || (minister && minister.id === a.id);
  const intent = talkIntent(text);
  let reply, moodDelta = 0, action = null;
  switch (intent) {
    case 'empty': reply = pick(['Yes? I am listening.', 'You called? I am here.', 'Say it again, I did not catch it.'], seed); break;
    case 'greeting': reply = pick([`Hello! I am ${name}, the ${a.trade || 'helper'}.`, `Hi there. ${flier}`, `Good day to you. ${hungry ? 'A bit of bread would make it better.' : 'It is a fine one.'}`, `Hello up there. I am ${name}.`], seed); moodDelta = 1; break;
    case 'howAreYou':
      reply = hungry ? pick(['Hungry, to be honest. The crates are empty.', 'My stomach is loud today. Food first, then anything.'], seed)
        : homeless ? pick(['Fine by day, cold by night. I have no roof yet.', 'Alright. A house would help; I sleep outside.'], seed)
        : mood >= 60 ? pick([`I am ${MOOD_WORD(mood)}, thank you. Few ask.`, `Good! ${flier}`, 'Well, and busy. That is the best way.'], seed)
        : pick([`I am ${MOOD_WORD(mood)}. It will pass.`, 'Not my best day. A kind word helps, so thank you.'], seed);
      moodDelta = generous || timid ? 2 : 1; break;
    case 'name': reply = `I am ${name}, a ${a.species || 'flier'} and a ${a.trade || 'helper'}. ${proud ? 'You will remember the name.' : 'Nice to meet you.'}`; break;
    case 'whatDo': reply = pick([`I am ${job.startsWith('minister') ? 'the minister' : 'a ' + job}. ${lazy ? 'It is a lot of walking.' : 'I like it.'}`, `Right now: ${job}. ${hungry ? 'On an empty stomach.' : 'Keeping busy.'}`, `My work is ${job}. ${proud ? 'Nobody does it better.' : 'Someone has to.'}`], seed); break;
    case 'skills': {
      const n = best ? best[1] : 6;
      reply = proud ? `${cap(bestWord)}, and I am the best here. Ten out of ten.` : timid ? `A little ${bestWord}, maybe. Others are better.` : `${cap(bestWord)}, mostly. About ${n} out of ten, honestly.`;
      break;
    }
    case 'want': {
      const wants = [];
      if (hungry) wants.push('something to eat');
      if (homeless) wants.push('a roof to sleep under');
      if (ambitious) wants.push(a.trade === 'baker' ? 'a little tea house of my own' : a.trade === 'builder' ? 'a workshop of my own' : 'a place of my own');
      if (!wants.length) wants.push(pick(['a well in the square', 'a bench by the water', 'a day with no crates', 'a garden to sit in'], seed));
      reply = `I would like ${wants[0]}. ${wants[1] ? 'And ' + wants[1] + '.' : hungry ? 'Soon, please.' : 'If you ask.'}`;
      break;
    }
    case 'town': reply = pick([`${hungry ? 'It would be lovelier with bread.' : 'I like it here.'} The sea is pretty at sundown.`, `It is small, but it is ours. ${homeless ? 'A house would make it home.' : 'I sleep well.'}`, `Good people, cream ground, big sky. ${ambitious ? 'It could be a real town.' : 'What more do you want?'}`], seed); break;
    case 'minister':
      reply = isMinister ? 'I take the seal seriously. I count the crates twice.'
        : minister ? (gossip ? `${minister.name}? Means well. Counts slowly, between us.` : `${minister.name} does fine. ${ambitious ? 'I would do it too, if asked.' : 'Better them than me.'}`)
        : ambitious ? 'We have no minister yet. I would do it. Yesterday, if possible.' : 'No minister yet. Olla would be good, or whoever stands still long enough.';
      break;
    case 'neighbours': reply = pick(['Their lights are pretty at night. The harbour folk are gruff.', 'The bakers across the water are kind. The rock people are proud.', 'I keep my propeller away from their nets. Mostly.'], seed); break;
    case 'conflict': {   // ART_DIRECTION §15: a member of an institution speaks of their post; a party of a dispute takes their side
      const role = a.role && typeof a.role === 'object' ? a.role : null;
      const c = a.conflict && typeof a.conflict === 'object' ? a.conflict : null;
      if (role) reply = pick([role.kind === 'patrol' ? 'All quiet by the crates. I walk the round twice a day.' : role.kind === 'watch' ? 'I walk the edges after dark. Nothing gets past my lantern.' : role.kind === 'court' ? 'Bring it to the square. I hear every side, then I decide.' : role.kind === 'school' ? 'Lessons at the square. Even the lazy ones come.' : `I am ${role.title} of the ${role.name || 'society'} now. It is an honour.`, `I wear the ${role.badge || 'badge'} now. ${proud ? 'It suits me.' : 'I will not let you down.'}`], seed);
      else if (c) reply = c.kind === 'theft' ? (c.side === 'offender' ? pick(['It was one crust. Everyone was hungry.', 'I took nothing. Ask anyone. Well, not Pim.'], seed) : `I saw it with my own eyes. ${c.status === 'handled' || c.status === 'resolved' ? 'It is settled now.' : 'Will you do something?'}`)
        : c.kind === 'quarrel' ? pick([`${c.other || 'They'} started it. ${c.status === 'handled' || c.status === 'resolved' ? 'We have shaken hands, mostly.' : 'I will not haul with them.'}`, 'It is about who is right. I am.'], seed)
        : c.kind === 'noise' ? 'I have not slept for the hammering. Three nights now.'
        : c.kind === 'land' ? 'That plot is mine. I paced it out first.'
        : c.kind === 'neglect' ? (lazy ? 'I will get to it. The work will still be there.' : 'I am worn out, that is all. A rest and I am back.')
        : c.kind === 'jealousy' ? 'The seal should have been mine. I say it to you only.' : 'It is not right, and someone should say so.';
      else reply = pick(['Nothing I know of. The crates are quiet.', `No trouble that I have seen. ${gossip ? 'Ask me again tomorrow.' : 'Ask the minister.'}`, 'Everyone gets along. Mostly.'], seed);
      break;
    }
    case 'food': reply = hungry ? 'Yes, hungry. A farm or a bakery, please.' : pick(['We have bread for now. A farm would keep it that way.', 'Not hungry yet. Ask me in a few days.'], seed); if (hungry) action = { type: 'build', request: 'a farm', say: 'a farm' }; break;
    case 'home': reply = homeless ? 'I sleep under the stars. A house in the middle would be lovely.' : 'I have a roof, thank you. Some still sleep outside.'; if (homeless) action = { type: 'build', request: 'a house', say: 'a house' }; break;
    case 'fleet': reply = a.fleet ? `I stand with ${a.fleet}. Good people.` : `I am with the ${a.trade || 'helper'}s. Good people.`; break;
    case 'thanks': reply = proud ? 'Naturally. But it is nice to hear.' : timid ? 'Oh. That means a lot. Thank you.' : 'Thank you! That makes the work lighter.'; moodDelta = 3; break;
    case 'rest': reply = lazy ? 'Rest? Yes please. Right now.' : 'I could use a rest, if the work allows.'; action = { type: 'rest' }; moodDelta = 2; break;
    case 'build': {
      const noun = buildNoun(text);
      if (noun) { reply = pick([`A ${noun}? Yes. I will fetch the others.`, `A ${noun}. Good idea. Say the word and we start.`, `${cap(noun)}, yes. ${proud ? 'Leave it to me.' : 'We can do that.'}`], seed); action = { type: 'build', request: `a ${noun}`, say: `build a ${noun}` }; }
      else reply = pick([hungry ? 'A farm first, then anything you like.' : homeless ? 'A house, please. Then a well.' : 'A well in the square, or a bench by the water.', 'Something tall. The neighbours would notice.'], seed);
      break;
    }
    case 'bye': reply = pick(['See you. I will be at work.', `Bye for now. ${flier}`], seed); break;
    case 'yes': reply = pick(['Good. Then I will get on with it.', 'Thank you. I will tell the others.'], seed); moodDelta = 2; break;
    case 'no': reply = pick(['All right. Another day, then.', 'I understand. It stings a little.'], seed); moodDelta = -1; break;
    default: reply = pick([`I heard you. I will think on it while I work.`, `Noted. ${gossip ? 'I will tell everyone you said so.' : 'I will keep it to myself.'}`, `I am not sure what you mean, but I am on your side.`, `${flier} Say more?`], seed);
  }
  return { reply: trimReply(reply), mood: moodDelta, action };
}

// ---- spontaneous one-liners ----
export function spontaneousLine(game, a) {
  const { state } = game;
  const seed = `${a.id}|${Math.floor(state.t / 7)}`;
  const T = a.traits;
  const b = a.jobId ? state.buildings.find(x => x.id === a.jobId) : null;
  // the pressing things speak first; otherwise one line from everything true about this folk right now
  if (state.hungry) return pick(['My stomach is talking louder than me.', 'Any bread? No? Thought so.', 'Empty crates. Empty me.'], seed);
  if (a.status === 'striking') return pick(['Not one more crate until things change.', 'I said no, and I meant it.'], seed);
  if (a.status === 'resting') return pick(['Five more minutes.', 'Just resting my wings.'], seed);
  if (a.id === state.minister) return pick(['Counting the crates again.', 'A minister never sits.', 'All in order. Mostly.'], seed);
  if (a.role) return pick(a.role.kind === 'patrol' ? ['All quiet by the crates.', 'Who goes there?', 'Walking the round.'] : a.role.kind === 'watch' ? ['Lantern lit. Nothing moves.', 'The night is long and mine.'] : a.role.kind === 'court' ? ['Order, order.', 'I have heard both sides.'] : a.role.kind === 'school' ? ['Chalk up. Lesson time.', 'Who can spell parasol?'] : a.role.kind === 'festival' ? ['Ribbons! More ribbons.', 'A festival soon, I promise.'] : ['The meeting is called.', 'We keep standards here.'], seed);
  const conflict = state.conflicts ? state.conflicts.filter(c => c.status !== 'resolved' && c.parties.includes(a.id)).at(-1) : null;
  if (conflict && conflict.status !== 'handled') { const other = conflict.parties.find(id => id !== a.id); const o = other ? state.agents.find(x => x.id === other) : null; return pick(conflict.kind === 'theft' ? (conflict.roles.offender === a.id ? ['It was one crust.', 'Everyone was hungry.'] : ['Someone has been at the crates.', 'I know what I saw.']) : conflict.kind === 'quarrel' ? [`${o ? o.name : 'They'} started it.`, 'I will not haul with them.'] : conflict.kind === 'noise' ? ['Three nights without sleep.', 'That hammering!'] : conflict.kind === 'land' ? ['That plot is mine.', 'I paced it out first.'] : conflict.kind === 'neglect' ? ['I will get to it.', 'Later. Always later.'] : ['It is not right.', 'Someone should say so.'], seed); }
  if (b && b.status !== 'done') return pick([`This ${b.name.toLowerCase()} is going up nicely.`, 'Pass me a nail!', 'Mind the crate!', 'Hammer, hammer, hammer.'], seed);
  const lines = [];
  if (b && b.venture && b.venture.ownerId === a.id) lines.push(`Come by the ${b.venture.title.toLowerCase()}!`, 'Open for business.');
  else if (b) lines.push(`Busy day at the ${b.name.toLowerCase()}.`, 'Work goes better with a song.', 'One more trip to the crates.');
  if (!a.homeId && state.day >= 2) lines.push('Another night under the stars.', 'A roof would be nice.');
  if (!b && a.campRole === 'forager') lines.push('Found some reeds for supper.', 'Berries, if the gulls left any.');
  if (!b && a.campRole === 'gatherer') lines.push('Driftwood. Good enough.', 'Stones for the pile.');
  if (T.includes('gossip')) lines.push('Did you hear about Pim? No? Later.', 'I know something. Ask me.');
  if (T.includes('ambitious')) lines.push('One day I will have a place of my own.', 'This town could be great.');
  if (T.includes('lazy')) lines.push('Is it evening yet?', 'Who put this crate here?');
  if (T.includes('proud')) lines.push('Nobody hauls like me.', 'Watch and learn.');
  if (a.species === 'floatie') lines.push('The wind is kind today.', 'Drifting. Thinking.', 'Lovely light.');
  else lines.push('Good day for flying.', 'Propeller needs oil.');
  lines.push('The sea is gold.', 'What a sky.', 'Back to it.');
  return pick(lines, seed);
}

export function tickSay(game) {
  const { state, rng } = game;
  if (state.nextSayAt == null) state.nextSayAt = SAY.firstAfter;
  if (state.t < state.nextSayAt) return;
  state.nextSayAt = state.t + rng.range(SAY.every[0], SAY.every[1]);
  if (state.fleetHold || state.meeting || state.scene === 'moon') return;
  const folk = state.agents.filter(a => a.status !== 'left' && !(a.task && ['deliver', 'journey', 'leave', 'stand'].includes(a.task.kind)));
  if (!folk.length) return;
  const a = rng.pick(folk);
  game.emit('agent:say', { agentId: a.id, text: spontaneousLine(game, a), kind: 'idle', ttl: SAY.ttl });
}

// what the server's /api/talk (or the offline mind) needs to know about one folk
export function talkContext(game, agentId, text = '') {
  const { state } = game;
  const a = state.agents.find(x => x.id === agentId);
  if (!a) return null;
  const fleet = (state.fleets || []).find(f => f.members.includes(a.id));
  const known = Object.fromEntries(Object.keys(a.known || {}).map(k => [k, a.claims[k] ?? a.skills[k]]));
  const mem = a.memory || { talks: [], events: [] };
  return {
    agentId: a.id,
    agent: { id: a.id, name: a.name, species: a.species, trade: a.trade, traits: a.traits.slice(), mood: Math.round(a.mood), moodWord: MOOD_WORD(a.mood), energy: Math.round(a.energy), loyalty: Math.round(a.loyalty),
      skills: { ...a.skills }, known, job: a.job || `${a.trade} at the camp`, status: a.status, homeless: !a.homeId, isMinister: state.minister === a.id, fleet: fleet ? fleet.name : null,
      memory: mem.events.slice(-5), campRole: a.campRole || null,
      // ART_DIRECTION §15: their post in an institution, and the dispute they are part of
      role: a.role ? { ...a.role, name: (state.institutions.find(i => i.id === a.role.institutionId) || {}).name || null } : null,
      conflict: (() => { const c = (state.conflicts || []).filter(x => x.status !== 'resolved' && x.parties.includes(a.id)).at(-1); if (!c) return null; const other = c.parties.find(id => id !== a.id); const o = other ? state.agents.find(x => x.id === other) : null; return { id: c.id, kind: c.kind, status: c.status, summary: c.summary, side: c.roles.offender === a.id ? 'offender' : c.roles.complainant === a.id ? 'complainant' : 'party', other: o ? o.name : null }; })() },
    text: String(text || ''),
    history: mem.talks.map(t => ({ you: t.you, me: t.me })),
    snapshot: game.snapshot()
  };
}
