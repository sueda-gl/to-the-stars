// Letters: the only way folk talk. Model + rich templated text so the game plays with no LLM at all.
// A letter: { id, from:{kind, id, name}, subject, body, kind, day, read, options:[{label, says}], resolved,
//             effects:{ yes:[...], no:[...], other:[...] }, meta:{...} }
// effects are plain descriptors the actions module applies on reply_letter.

import { peopleOf, FLIGHT } from './society.js';

let nextId = 1;
export const resetLetterIds = () => { nextId = 1; };   // legacy: queueLetter re-ids every letter from the game's own counter

export function makeLetter({ from, subject, body, kind, day = 1, options = [], effects = {}, meta = {} }) {
  return { id: 'l' + (nextId++), from, subject, body, kind, day, read: false, options, resolved: false, effects, meta, delivered: false };
}

const fromAgent = a => ({ kind: 'agent', id: a.id, name: a.name });
const fromMinister = a => ({ kind: 'minister', id: a ? a.id : null, name: a ? a.name : 'the Minister' });
export const fromMinistry = () => ({ kind: 'ministry', id: 'builds', name: 'Ministry of Builds' });
const fromNeighbour = n => ({ kind: 'neighbour', id: n.id, name: n.name });

// how our folk sign off (flits: propeller caps; floaties: parasols). The neighbours' species are here for envoys and
// visitors who might one day write as individuals.
const SPECIES_SIGN = {
  flit: 'from somewhere up high', floatie: 'drifting, as ever',
  puffer: 'with dusty hands', loaf: 'warm from the oven', drop: 'with a small bow', scoot: 'in a hurry, as always', pip: 'from under a sun hat'
};
const sign = a => `\n\n— ${a.name}, ${SPECIES_SIGN[a.species] || 'yours'}`;
const flew = a => FLIGHT[a.species] ? `I ${FLIGHT[a.species]} and flew` : 'I walked';
const greet = (rng, settlement) => rng.pick(['Dear founder,', 'To the voice in the sky,', 'Founder,', `To whoever is listening above ${settlement || 'the camp'},`, 'Hello up there,']);

// ---------- skill answers ----------
const PROUD = [
  (a, s) => `Good at ${s}? I am the best ${s === 'baking' ? 'baker' : s === 'building' ? 'builder' : 'at it'} this side of the sea. Ask anyone. Ask the gulls. I'd say ten out of ten, and I am being modest.`,
  (a, s) => `You need not look further. My ${s} is legendary, or will be, once you give me the chance. Put me in charge of it and watch.`,
  (a, s) => `Finally someone asks. I have been waiting to show what I can do with ${s}. Nobody here comes close, whatever they write you.`
];
const TIMID = [
  (a, s) => `I... do a little ${s}, if nobody else is free. I would not want to get in the way. Probably others are better. But I will try, if you ask.`,
  (a, s) => `Please don't put me forward for ${s}. I only know the basics. Well. A bit more than the basics. But I would rather help quietly.`,
  (a, s) => `My mother said I was all right at ${s}. I don't know. If it's just for a day, maybe.`
];
const HONEST = [
  (a, s, c) => c >= 7 ? `Yes, ${s} is my trade. I have done it since I was small and I am rather good, honestly. Give me the work and the tools and I will not let you down.`
             : c >= 4 ? `I can do ${s}, middling well. I will manage if nobody better steps forward, but you should ask around first.`
             : `Not me, I'm afraid. My ${s} is poor. But I know what I am good for, and I will tell you if you ask.`,
  (a, s, c) => c >= 7 ? `${s[0].toUpperCase() + s.slice(1)}: that is what I do. I am proud of it without being loud about it. Count me in.`
             : c >= 4 ? `I'll be straight with you: I'm fair at ${s}, no more. Useful in a pinch.`
             : `I'd be lying if I said I was any good at ${s}. Someone else, please.`
];
export function skillAnswer(rng, { agent, skill, claimed, tone, question, day, settlement }) {
  const pool = tone === 'proud' ? PROUD : tone === 'timid' ? TIMID : HONEST;
  const body = `${greet(rng, settlement)}\n\nYou asked: “${question}”.\n\n${rng.pick(pool)(agent, skill, claimed)}${sign(agent)}`;
  return makeLetter({ from: fromAgent(agent), kind: 'skill_answer', day, subject: rng.pick([`About ${skill}`, `Re: who's good at ${skill}`, `I can ${skill === 'baking' ? 'bake' : 'help'}`, `${agent.name} here`]), body,
    meta: { skill, claimed, tone, agentId: agent.id } });
}

// ---------- refusals ----------
export function refusal(rng, { agent, task, why, day, settlement }) {
  const what = task.label || task.kind;
  const lines = [
    `I am writing to say no. Not to be difficult, but ${agent.name} ${why}. Perhaps ${task.alt ? task.alt + ' could do it' : 'someone else can'}.`,
    `About the ${what}: I will have to decline. The truth is I ${why.replace(/^is /, 'am ').replace(/^has /, 'have ').replace(/^does /, 'do ').replace(/^says /, 'say ')}. Ask me again another day.`,
    `No. I'm sorry. ${agent.name} ${why}, and that is all there is to it.`
  ];
  return makeLetter({ from: fromAgent(agent), kind: 'refusal', day, subject: rng.pick(['I must decline', `About the ${what}`, 'Not today', 'A small no']),
    body: `${greet(rng, settlement)}\n\n${rng.pick(lines)}${sign(agent)}`,
    options: [{ label: 'Understood, rest then', says: `tell ${agent.name} to rest` }, { label: 'I insist', says: `assign ${agent.name} anyway` }],
    effects: { yes: [{ type: 'mood', agentId: agent.id, delta: 6, reason: 'was heard' }, { type: 'assign', agentIds: [agent.id], to: 'rest' }],
               no: [{ type: 'mood', agentId: agent.id, delta: -8, reason: 'was ignored' }, { type: 'loyalty', agentId: agent.id, delta: -4 }, { type: 'force_assign', agentId: agent.id, to: task.buildingId || null }] },
    meta: { task, why } });
}

// ---------- complaints ----------
export function complaint(rng, { agent, reason, day, settlement, extra = {} }) {
  const T = {
    hunger: {
      subject: rng.pick(['We are hungry', 'There is no bread', 'Empty bowls']),
      body: rng.pick([
        `The stockpile is bare. ${agent.name} has eaten nothing since yesterday and the little ones are chewing bark. A farm, a bakery, anything. Please.`,
        `We stood by the crates this morning and found only crumbs. We cannot build on an empty stomach. Put something edible in the ground, or trade for it, before tempers go.`,
        `Hungry. All of us. Nobody says it out loud but it is in every face. If food does not come, people will start thinking about the neighbours' tables.`
      ]),
      options: [{ label: 'Build a farm', says: 'build a farm' }, { label: 'Build a bakery', says: 'build a bakery' }, { label: 'Trade for food', says: 'trade with the neighbours for food' }],
      effects: { yes: [{ type: 'mood', agentId: agent.id, delta: 4, reason: 'hope' }], no: [{ type: 'mood', agentId: agent.id, delta: -6, reason: 'ignored' }] }
    },
    homeless: {
      subject: rng.pick(['Still sleeping outside', 'A roof, please', 'The nights are cold']),
      body: rng.pick([
        `${agent.name} has been sleeping under the stars for days. It was romantic the first night. Could we have a house, or even a hut? I would help build it.`,
        `There is no roof over half of us. The dew gets in everything. A house in the middle would do, or a few huts along the edge.`,
        `I write from a damp blanket. I am not complaining. Well, I am. Somewhere to sleep would change my whole opinion of this place.`
      ]),
      options: [{ label: 'Build a house', says: 'build a house' }, { label: 'Build a hut', says: 'build a hut' }, { label: 'Not now', says: 'not now' }],
      effects: { yes: [{ type: 'mood', agentId: agent.id, delta: 4, reason: 'hope' }], no: [{ type: 'mood', agentId: agent.id, delta: -5, reason: 'ignored' }] }
    },
    overwork: {
      subject: rng.pick(['I need a day off', 'My hands are shaking', 'Enough for now']),
      body: rng.pick([
        `${agent.name} has carried crates until the arms gave out. One day of rest and I will come back twice as strong. Is that fair?`,
        `I have not sat down since the ${extra.building || 'site'} started. May I rest? Someone fresher could take my place for a day.`,
        `The work is good but there is too much of it on too few of us. Let me rest, or find more hands, or both.`
      ]),
      options: [{ label: 'Rest, you have earned it', says: `let ${agent.name} rest` }, { label: 'Finish first', says: 'keep working' }],
      effects: { yes: [{ type: 'mood', agentId: agent.id, delta: 10, reason: 'granted rest' }, { type: 'loyalty', agentId: agent.id, delta: 5 }, { type: 'assign', agentIds: [agent.id], to: 'rest' }],
                 no: [{ type: 'mood', agentId: agent.id, delta: -10, reason: 'denied rest' }, { type: 'loyalty', agentId: agent.id, delta: -4 }] }
    }
  }[reason];
  return makeLetter({ from: fromAgent(agent), kind: 'complaint', day, subject: T.subject, body: `${greet(rng, settlement)}\n\n${T.body}${sign(agent)}`, options: T.options, effects: T.effects, meta: { reason, agentId: agent.id } });
}

// ---------- petitions, gossip, ideas ----------
export function petition(rng, { agent, day, settlement, catalog, stage, built }) {
  const wishes = [
    { kind: 'well', text: 'a well in the square, so we stop walking to the lake with buckets' },
    { kind: 'garden', text: 'a garden with herbs and a bench, somewhere to sit in the evening' },
    { kind: 'fountain', text: 'a fountain. Yes, a fountain. We would feel like a real town' },
    { kind: 'tavern', text: 'a tavern, for songs after dark and somewhere for the scouts to tell their stories' },
    { kind: 'grove', text: 'a grove of trees near the water, for shade and for timber later' },
    { kind: 'market', text: 'a market so our goods go somewhere instead of piling up' }
  ].filter(w => catalog.isUnlocked(w.kind, stage) && !built.has(w.kind));
  const w = wishes.length ? rng.pick(wishes) : { kind: null, text: 'a day of festival, with bread for everyone' };
  const body = rng.pick([
    `A few of us were talking and we agree: what this place needs is ${w.text}. We would build it ourselves if you say the word.`,
    `${agent.name} humbly asks for ${w.text}. It is not much and it would mean a lot.`,
    `May I suggest ${w.text}? I have drawn it in the sand already. The others laughed, but kindly.`
  ]);
  return makeLetter({ from: fromAgent(agent), kind: 'petition', day, subject: rng.pick(['A humble request', 'An idea for the square', `What about ${w.kind || 'a festival'}?`]),
    body: `${greet(rng, settlement)}\n\n${body}${sign(agent)}`,
    options: [{ label: 'Yes, let us', says: w.kind ? `build a ${w.kind}` : 'hold a festival' }, { label: 'Not yet', says: 'not yet' }],
    effects: { yes: [{ type: 'mood', agentId: agent.id, delta: 8, reason: 'petition granted' }, { type: 'loyalty', agentId: agent.id, delta: 4 }, ...(w.kind ? [{ type: 'build', kind: w.kind }] : [{ type: 'festival' }])],
               no: [{ type: 'mood', agentId: agent.id, delta: -4, reason: 'petition refused' }] },
    meta: { wish: w.kind } });
}

export function gossip(rng, { agent, about, day, settlement, minister }) {
  const topics = [
    `Did you know ${about.name} hums while hauling? The same four notes. All day. I am not saying stop it. I am saying you should know.`,
    `${about.name} told me their ${Object.entries(about.skills).sort((a, b) => b[1] - a[1])[0][0]} is better than anyone's. I keep my opinion to myself. Mostly.`,
    `Between us, ${about.name} has been eyeing the neighbours' lights at night. Nothing in it, surely. Just thought you'd want to hear it from a friend.`,
    `There is talk that ${about.name} would make a fine minister. I did not start it. I only passed it on. Twice.`,
    `${about.name} and I disagree about where the ${rng.pick(['bakery', 'well', 'market'])} should go. I say by the water, they say in the middle. You decide, you are the sky.`
  ];
  if (minister && minister.id !== agent.id) topics.push(`Our minister ${minister.name} means well, but the last report counted the crates twice. Keep an eye on the numbers, that is all.`);
  return makeLetter({ from: fromAgent(agent), kind: 'gossip', day, subject: rng.pick(['Just between us', 'Something I heard', 'Not to gossip, but']),
    body: `${greet(rng, settlement)}\n\n${rng.pick(topics)}${sign(agent)}`, meta: { aboutId: about.id } });
}

export function idea(rng, { agent, day, settlement, catalog, stage, built }) {
  const cand = catalog.unlocked(stage).filter(k => !built.has(k) && k !== 'road');
  const kind = cand.length ? rng.pick(cand) : 'house';
  const e = catalog.get(kind);
  const body = rng.pick([
    `I had a thought in the night: what if we built a ${e.name.toLowerCase()}? ${e.desc} I could help with it.`,
    `${agent.name} has an idea and will not sleep until it is written down: a ${e.name.toLowerCase()}. ${e.desc}`,
    `Hear me out. A ${e.name.toLowerCase()}. Near the ${rng.pick(['water', 'middle', 'edge of the plot'])}. ${e.desc}`
  ]);
  return makeLetter({ from: fromAgent(agent), kind: 'idea', day, subject: rng.pick([`An idea: a ${e.name.toLowerCase()}`, 'I had a thought', 'Could we?']),
    body: `${greet(rng, settlement)}\n\n${body}${sign(agent)}`,
    options: [{ label: `Build a ${e.name.toLowerCase()}`, says: `build a ${kind}` }, { label: 'Maybe later', says: 'maybe later' }],
    effects: { yes: [{ type: 'mood', agentId: agent.id, delta: 6, reason: 'idea taken up' }, { type: 'build', kind }], no: [{ type: 'mood', agentId: agent.id, delta: -2, reason: 'idea shelved' }] },
    meta: { kind } });
}

export function strikeLetter(rng, { agent, day, settlement }) {
  return makeLetter({ from: fromAgent(agent), kind: 'strike', day, subject: rng.pick(['I am putting down my tools', 'Strike', 'Enough']),
    body: `${greet(rng, settlement)}\n\n${rng.pick([
      `${agent.name} has stopped work. Not forever, but until something changes: food, a roof, a kind word, anything. I will be in the square if you want to talk.`,
      `I am on strike. I have carried and hammered and gone to bed hungry and nobody has written back. I will stand in the middle until it is better.`
    ])}${sign(agent)}`,
    options: [{ label: 'I hear you', says: `talk to ${agent.name}` }, { label: 'Suit yourself', says: 'ignore it' }],
    effects: { yes: [{ type: 'mood', agentId: agent.id, delta: 14, reason: 'was heard' }, { type: 'loyalty', agentId: agent.id, delta: 6 }], no: [{ type: 'mood', agentId: agent.id, delta: -6, reason: 'dismissed' }, { type: 'loyalty', agentId: agent.id, delta: -8 }] } });
}

export function farewell(rng, { agent, neighbour, day, settlement }) {
  return makeLetter({ from: fromAgent(agent), kind: 'leaving', day, subject: rng.pick(['Goodbye', 'I am leaving', 'Gone to ' + neighbour.name]),
    body: `${greet(rng, settlement)}\n\n${rng.pick([
      `By the time you read this ${agent.name} will be in the air over the water, bound for ${neighbour.name}. They have bread there, and roofs, and someone who answers letters. I wish you well, truly.`,
      `I waited as long as I could. ${neighbour.name} has offered me a place and I am taking it. Do better by the others than you did by me.`
    ])}${sign(agent)}`, meta: { neighbourId: neighbour.id } });
}

export function newcomer(rng, { agent, day, settlement, housingFree }) {
  const skill = Object.entries(agent.skills).sort((a, b) => b[1] - a[1])[0][0];
  return makeLetter({ from: fromAgent(agent), kind: 'newcomer', day, subject: rng.pick(['A new arrival', `${agent.name} has come`, 'Room for one more?']),
    body: `${greet(rng, settlement)}\n\n${rng.pick([
      `I heard there was a place by the sea where the roofs were new and the bread was warm, so ${flew(agent)}. I am ${agent.name}, a ${agent.trade}. ${agent.traits.includes('proud') ? 'The best one you will meet.' : agent.traits.includes('timid') ? 'Not a very good one, maybe, but willing.' : 'I will earn my keep.'} Where should I sleep?`,
      `${agent.name}, newly arrived, ${agent.trade} by trade, ${skill} by inclination. Your settlement looked kind from the air. I hope it is.`
    ])}${sign(agent)}` });
}

export function talkReply(rng, { agent, text, day, settlement, minister }) {
  const T = agent.traits;
  const skillTop = Object.entries(agent.skills).sort((a, b) => b[1] - a[1])[0];
  const lines = [];
  if (/how are you|feeling|mood|alright|ok\b/i.test(text)) lines.push(agent.mood > 65 ? 'I am well, thank you for asking. Few do.' : agent.mood > 40 ? 'Getting by. The days are long but the sea is pretty.' : 'Not well, honestly. You will have seen it in the other letters.');
  if (/good at|skill|what do you do|trade/i.test(text)) lines.push(T.includes('proud') ? `What am I good at? Everything, but especially ${skillTop[0]}.` : T.includes('timid') ? `Nothing much. A little ${skillTop[0]}, when nobody is watching.` : `${skillTop[0]}, mostly. I have a knack.`);
  if (/thank|well done|bravo|good job|proud of/i.test(text)) lines.push(T.includes('proud') ? 'Naturally. But it is nice to hear.' : 'That means a great deal. More than you think.');
  if (/minister/i.test(text)) lines.push(minister && minister.id === agent.id ? 'I take the office seriously. The reports will be honest, or as honest as I can count.' : T.includes('ambitious') ? 'If you are asking whether I would serve as minister: yes. Yesterday, if possible.' : 'Me, minister? Olla would be better. Or whoever stands still long enough.');
  if (/neighbou?r/i.test(text)) lines.push('The neighbours? Their lights are pretty at night. I do not trust the ones to the north.');
  if (!lines.length) lines.push(rng.pick([`I read your words twice. “${text}” I will think about it and do my best.`, `Thank you for speaking to me directly. ${T.includes('gossip') ? 'I will tell everyone you did.' : 'I will keep it to myself.'}`, 'Noted. I am not sure what you mean, but I am on your side.']));
  return makeLetter({ from: fromAgent(agent), kind: 'reply', day, subject: rng.pick(['You spoke to me', 'In reply', `${agent.name} writes back`]), body: `${greet(rng, settlement)}\n\n${lines.join(' ')}${sign(agent)}` });
}

// ---------- minister ----------
export function ministerAccept(rng, { agent, day, settlement }) {
  const body = agent.skills.diplomacy >= 7
    ? `I accept the seal with a steady hand. I will chair the meetings, write you plain reports and tell you what the folk will not say to your face. First order of business: I will walk the plot and count what we have.`
    : agent.skills.diplomacy >= 4
      ? `I accept, though I did not expect it. I will do my best with the reports. Numbers are not my strong suit, but honesty is.`
      : `Minister! Me! I will make speeches. I will make lists. I may lose the lists. Thank you, thank you.`;
  return makeLetter({ from: fromMinister(agent), kind: 'report', day, subject: 'I accept the seal', body: `${greet(rng, settlement)}\n\n${body}${sign(agent)}` });
}

// the state report. A poor diplomat misreports the numbers (fudge), and a proud one dresses them up.
export function ministerReport(rng, { agent, day, settlement, summary, occasion = 'meeting' }) {
  const dip = agent ? agent.skills.diplomacy : 0;
  const fudge = n => dip >= 6 ? n : Math.max(0, Math.round(n * rng.range(dip >= 3 ? 0.8 : 0.55, dip >= 3 ? 1.25 : 1.6)));
  const s = summary;
  const foodDays = s.pop ? (s.food / s.pop).toFixed(1) : '∞';
  // §24: plain and short (one fact a line, what to do last)
  const lines = [
    `${occasion === 'meeting' ? 'The meeting is open. Here is where we stand.' : 'Here is where we stand.'}`,
    `Residents: ${fudge(s.pop)}, ${fudge(s.housed)} with a home.`,
    `Food: about ${fudge(+foodDays)} days left. Wood ${fudge(s.wood)}, stone ${fudge(s.stone)}, coin ${fudge(s.coin)}.`,
    s.sites ? `Being built: ${s.siteNames.join(', ')}.` : 'Nothing is being built right now.',
    s.unhappy.length ? `Unhappy: ${s.unhappy.join(', ')}.` : 'Everyone is in good spirits.',
    s.strikers.length ? `On strike: ${s.strikers.join(', ')}.` : '',
    s.conflicts && s.conflicts.length ? `Waiting for your decision: ${s.conflicts.join(' ')}` : '',
    s.institutions && s.institutions.length ? `In office: ${s.institutions.join(', ')}.` : '',
    `We are a ${s.stage}. ${s.nextStage ? `About ${fudge(s.toNext)} more prosperity to become a ${s.nextStage}.` : 'We are as big as it gets.'}`,
    s.neighbours.length ? 'Neighbours: ' + s.neighbours.map(n => `${n.name} (${n.attitude >= 60 ? 'friendly' : n.attitude >= 35 ? 'unsure' : 'unfriendly'})`).join(', ') + '.' : '',
    dip >= 4 ? `What to do next: ${s.advice}` : rng.pick(['What to do next: build something big.', 'What to do next: I think we are doing well.', 'What to do next: maybe a festival.'])
  ].filter(Boolean);
  return makeLetter({ from: fromMinister(agent), kind: 'report', day, subject: occasion === 'meeting' ? `Minutes, day ${day}` : `Report, day ${day}`,
    body: `${greet(rng, settlement)}\n\n${lines.join('\n')}${agent ? sign(agent) : '\n\n— the Ministry'}` });
}

// ---------- ministry of builds ----------
export function ministryNotice(rng, { kind, day, settlement, request, building, name, reason }) {
  // ART_DIRECTION §24 (Sueda: "I don't understand what the Ministry says"): plain, short, clear. What happened, what to do.
  const it = name || request || 'it';
  const M = {
    needs_design: { subject: `New design: ${it}`, body: `We have never built ${/^(a|an|the)\s/i.test(it) ? it : 'a ' + it} before, so we are drawing it now.\n\nThe crew is already preparing the ground. Building starts as soon as the drawing is ready.` },
    design_arrived: { subject: `Ready to build: ${name}`, body: `The drawing for the ${name} is ready. The crew is building it now.\n\nNext time it will be quicker: we keep the drawing.` },
    raised: { subject: `Finished: ${name}`, body: `The ${name} is finished.${building && building.generated ? ' It is the first one here.' : ''}` },
    stalled: { subject: `Work stopped: ${name}`, body: `Nobody is working on the ${name}. ${reason || 'The residents are tired, hungry or unhappy.'}\n\nWhat to do: name someone for the job, or give the residents food and homes.` },
    conscripted: { subject: `Workers found: ${name}`, body: `Nobody wanted to build the ${name}, so we asked ${reason || 'someone'} to do it. They are not happy about it.\n\nTip: food and homes make residents keener to work.` },
    homecoming: { subject: `The envoy is back`, body: `The rocket is home safely. ${reason || 'The three nations have heard about the shadelings.'}\n\nExpect visitors soon.` },
    suggest: { subject: `Food is running low`, body: `Our food will run out soon.\n\nWhat to do: ${reason || 'build a farm by the lake and a well in the square'}.` },
    unaffordable: { subject: `Not enough materials: ${name}`, body: `We cannot start the ${name}. It costs more than we have: ${reason}.\n\nWhat to do: build a quarry or a woodcutter, or trade with the neighbours.` },
    short: { subject: `Low on materials: ${name}`, body: `We started the ${name}, but we are short of ${reason}.\n\nWhat to do: build a quarry or a woodcutter, or trade with the neighbours.` },
    locked: { subject: `Big project: ${name}`, body: `A ${name} is a lot for a ${reason}, but we started it because you asked.\n\nGrowing the settlement unlocks more buildings.` },
    no_room: { subject: `No space for the ${name}`, body: `There is no free, dry ground for the ${name} there.\n\nWhat to do: point at another spot.` },
    stage: { subject: `We are a ${name} now`, body: `The settlement is now a ${name}. New buildings are unlocked.${name === 'town' ? ' You can now build the Assembly (the Red arch) and hold meetings there.' : ''}` }
  }[kind];
  const options = kind === 'suggest' ? [{ label: 'Build a farm', says: 'build a farm by the lake' }, { label: 'Build a well', says: 'build a well in the square' }, { label: 'Later', says: 'later' }] : [];
  const effects = kind === 'suggest' ? { yes: [{ type: 'build', kind: 'farm' }], no: [] } : {};
  return makeLetter({ from: fromMinistry(), kind: 'ministry', day, subject: M.subject, body: M.body + '\n\n— Ministry of Builds', options, effects, meta: { kind, buildingId: building ? building.id : null } });
}

// the minister's version of the gentle suggestion (same options; in their voice)
export function ministerSuggest(rng, { agent, day, settlement, what }) {
  const dip = agent ? agent.skills.diplomacy : 0;
  const body = dip >= 7
    ? `A small matter before it becomes a large one: the crates are finite and nobody has planted anything. I suggest ${what}. I have paced out the ground already.`
    : dip >= 4 ? `I counted the food twice and got two answers, but both were "not enough for long". Perhaps ${what}?`
    : `I had a dream about bread. Then I woke up and there was none being made. ${what[0].toUpperCase() + what.slice(1)}? Just a thought.`;
  return makeLetter({ from: fromMinister(agent), kind: 'report', day, subject: rng.pick(['Before we run short', 'A suggestion', 'About the crates']),
    body: `${greet(rng, settlement)}\n\n${body}${agent ? sign(agent) : ''}`,
    options: [{ label: 'Build a farm', says: 'build a farm by the lake' }, { label: 'Build a well', says: 'build a well in the square' }, { label: 'Later', says: 'later' }],
    effects: { yes: [{ type: 'build', kind: 'farm' }, ...(agent ? [{ type: 'mood', agentId: agent.id, delta: 4, reason: 'advice taken' }] : [])], no: [] }, meta: { kind: 'suggest' } });
}

// ---------- neighbours ----------
export function neighbourLetter(rng, { neighbour: n, kind, day, settlement, our, give, get }) {
  const style = {
    proud: { open: `From the high seat of ${n.name},`, close: `${n.leaderName}, who does not usually write first` },
    warm: { open: `Dear neighbours,`, close: `with warm regards, ${n.leaderName} of ${n.name}` },
    gruff: { open: `To the new lot by the bay.`, close: `${n.leaderName}. ${n.name}.` },
    sly: { open: `Dearest friends across the water,`, close: `your devoted ${n.leaderName}` }
  }[n.temperament] || { open: 'Neighbours,', close: n.leaderName };
  const res = o => Object.entries(o).map(([k, v]) => `${v} ${k}`).join(' and ');
  const people = peopleOf(n);   // "loaves", "drops", "puffers": the nation's own folk carry its trade and its envoys
  const L = {
    trade: {
      subject: `A trade: our ${res(get)} for your ${res(give)}`,
      body: `${style.open}\n\nWe have more ${Object.keys(get)[0]} than we can use and hear you are short. We offer ${res(get)} for ${res(give)}. Our ${people} can be at your crates by sundown.${n.temperament === 'sly' ? ' A fair price, between friends. Mostly fair.' : ''}`,
      options: [{ label: 'Accept the trade', says: `accept the trade with ${n.name}` }, { label: 'Decline', says: 'decline' }],
      effects: { yes: [{ type: 'trade', neighbourId: n.id, give, get }, { type: 'attitude', neighbourId: n.id, delta: 6 }], no: [{ type: 'attitude', neighbourId: n.id, delta: -3 }] }
    },
    envy: {
      subject: rng.pick(['We see your lights', 'You have been busy', 'Hm.']),
      body: `${style.open}\n\nWe see new roofs on your plot every evening. ${n.temperament === 'gruff' ? 'Do not get ideas.' : n.temperament === 'proud' ? 'Charming. Ours are older, and taller.' : 'Some of our young ones talk of walking over. We would take that badly.'} A gift of ${rng.pick(['goods', 'coin'])} would show you remember who was here first.`,
      options: [{ label: 'Send a gift (3 goods or 3 coin)', says: `send a gift to ${n.name}` }, { label: 'Ignore them', says: 'ignore it' }],
      effects: { yes: [{ type: 'gift', neighbourId: n.id }, { type: 'attitude', neighbourId: n.id, delta: 15 }], no: [{ type: 'attitude', neighbourId: n.id, delta: -8 }] }
    },
    alliance: {
      subject: 'An alliance',
      body: `${style.open}\n\nOur folk like your folk. Let us call it an alliance: shared roads, open markets, and a seat for your minister at our table. We ask only that you say yes out loud.`,
      options: [{ label: 'Yes, allies', says: `ally with ${n.name}` }, { label: 'Not yet', says: 'not yet' }],
      effects: { yes: [{ type: 'ally', neighbourId: n.id }, { type: 'attitude', neighbourId: n.id, delta: 10 }, { type: 'resources', delta: { coin: 4 } }], no: [{ type: 'attitude', neighbourId: n.id, delta: -5 }] }
    },
    complaint: {
      subject: rng.pick(['Your folk on our shore', 'Keep to your side', 'A complaint']),
      body: `${style.open}\n\nYour flits have been seen buzzing over our side of the water, and a floatie, which we are fairly sure is yours, drifted parasol-first into our nets. Call them home or we will take it as rudeness.`,
      options: [{ label: 'Apologise', says: `apologise to ${n.name}` }, { label: 'They are only gulls', says: 'dismiss it' }],
      effects: { yes: [{ type: 'attitude', neighbourId: n.id, delta: 8 }], no: [{ type: 'attitude', neighbourId: n.id, delta: -6 }] }
    },
    thanks: {
      subject: rng.pick([`Your gift arrived`, `Thank you for ${give && give.gift ? give.gift.replace(/^(a|an|the|some)\s+/i, 'the ') : 'the gift'}`, 'Received, with thanks']),
      body: `${style.open}\n\nYour ${give && give.carrier ? give.carrier : 'courier'} came over the ${n.z < -100 ? 'water' : 'hill'} with ${give && give.gift ? give.gift : 'a gift'}. ${n.temperament === 'gruff' ? 'It was not necessary. It was noticed.' : n.temperament === 'proud' ? 'We have had finer, but not lately, and not from neighbours so new.' : n.temperament === 'warm' ? 'The whole square came out to look. You have friends here now.' : 'How thoughtful. We will remember it, in the nicest way.'} Our ${people} will carry something back before long.`,
      options: [{ label: 'You are welcome', says: `tell ${n.name} they are welcome` }, { label: 'Propose an alliance', says: `ally with ${n.name}` }],
      effects: { yes: [{ type: 'attitude', neighbourId: n.id, delta: 3 }], no: [{ type: 'ally_ask', neighbourId: n.id }] }
    },
    greeting: {
      subject: `Welcome from ${n.name}`,
      body: `${style.open}\n\nSo there is someone on the empty plot at last: we watched you come down out of the sky on propellers and parasols. We are ${n.name}, ${n.desc}. ${n.temperament === 'warm' ? 'If you run short of bread in the first days, ask.' : n.temperament === 'proud' ? 'You will find us hard to impress.' : n.temperament === 'gruff' ? 'Keep your propellers off our nets.' : 'We are sure we will be the best of friends.'}`,
      effects: {}
    }
  }[kind];
  return makeLetter({ from: fromNeighbour(n), kind: 'neighbour_' + kind, day, subject: L.subject, body: `${L.body}\n\n— ${style.close}`, options: L.options || [], effects: L.effects, meta: { neighbourId: n.id, kind } });
}

// the three nations elect you Earth's envoy (one letter, three seals)
export function electionLetter(rng, { neighbours, day, settlement, reason }) {
  const names = neighbours.map(n => n.title || n.name);
  const leaders = neighbours.map(n => `${n.leaderName} of ${n.name}`);
  const body = `To the founder of ${settlement || 'the new town'},\n\nWe three do not agree on much. We agree on this. ${reason || 'Your plot by the sea has outshone every one of ours, and it did so by speaking things into being.'} Earth needs a voice to carry to the moon, where the shadelings light their lanterns and nobody from here has ever gone.\n\nBy a vote of three to none, you are elected Earth's envoy. Build your rocket. Take a seed. Tell them we are kind, mostly.\n\n— ${leaders.join('\n— ')}`;
  return makeLetter({ from: { kind: 'neighbour', id: 'all', name: names.join(', ') }, kind: 'election', day, subject: rng.pick(['You are elected', 'Earth\'s envoy: you', 'A vote of three nations']), body,
    options: [{ label: 'To the moon', says: 'let us go to the moon' }, { label: 'Not yet', says: 'not yet' }],
    effects: { yes: [{ type: 'go_moon' }], no: [] }, meta: { kind: 'election', votes: neighbours.map(n => n.id) } });
}

// ---------- the shadelings (the moon) ----------
const fromShadelings = () => ({ kind: 'neighbour', id: 'moon', name: 'the shadelings of the red rug' });
const lantern = rng => rng.pick(['by lantern-light', 'from under the lamp', 'written on a leaf', 'in the dusk', 'from the rug']);
export function shadelingLetter(rng, { kind, day, text, seeds = 0, golden = false, first = true, settlement }) {
  const S = {
    first_contact: {
      subject: rng.pick(['You came down the sky', 'Visitors', 'A lantern for you']),
      body: `Envoy of the blue world,\n\nWe saw your little fire cross the dark and set down on our meadow. We are the shadelings. We keep lanterns, a red rug, a lake and a lamp that we love. We have never had a guest. Please do not step on the lamp.\n\nIf you have brought something that grows, show us. If you have brought only words, those are good too. We will gather when the sun goes soft.`,
      options: [{ label: 'Offer them a seed', says: 'offer them a seed' }, { label: 'We come in peace', says: 'we come in peace' }, { label: 'Wait for the evening', says: 'wait for the evening' }]
    },
    seed: {
      subject: first ? rng.pick(['The seed took', 'Something is growing', 'Thank you for the seed']) : rng.pick(['Another one', 'More seeds, more lanterns']),
      body: first
        ? `Envoy,\n\nThe seed went into the grass and we all came to look. Then we all came closer. Then someone hopped and we could not stop. A green thing is already pushing up where you dropped it. On the blue world, do you drop seeds every day? How do you get anything done?\n\nWe will plant lanterns around it tonight so it is not lonely.`
        : `Envoy,\n\nAnother seed. We have counted ${seeds} now and argued about who looks after each. There was hopping again. If you keep this up we will have a meadow of green things and no one to keep the lamp.`,
      options: [{ label: 'Wait for the evening', says: 'wait for the evening' }, { label: 'Say goodbye', says: 'let us go home' }]
    },
    golden_hour: {
      subject: rng.pick(['The sun went soft', 'Lantern time', 'Evening']),
      body: `Envoy,\n\nYou waited, and the light turned to honey, and so we lit the beads. This is our favourite hour and now it is yours too. The lamp-lovers have gone to sit by the floor lamp; do not mind them, they do that.\n\nStay until the lake goes copper. Then go home and tell the three nations what the moon looks like at dusk: like a rug, with friends on it.`,
      options: [{ label: 'Offer them a seed', says: 'offer them a seed' }, { label: 'Say goodbye', says: 'let us go home' }]
    },
    daylight: {
      subject: 'Morning again',
      body: `Envoy,\n\nDaylight. The beads are out and the lamp-lovers are sulking. It is fine. It will be evening again; it always is.`,
      options: []
    },
    greet: {
      subject: first ? rng.pick(['We heard you', 'Peace, yes', 'Hello from the rug']) : rng.pick(['You said more', 'Noted, by lantern']),
      body: `Envoy,\n\nYou said: “${text || 'we come in peace'}”. ${first ? 'We talked it over in the lantern-light and decided we believe you. Nobody has lied to us before, so we are not sure what it sounds like, but your voice is warm and your rocket is small.' : 'We passed it from lantern to lantern until everyone had heard it twice.'} ${/peace|friend|kind|love|hello|greet/i.test(text || '') ? 'Peace is what we have most of. Take some home.' : /home|earth|leave|go/i.test(text || '') ? 'Go when you must. Leave a seed if you can.' : 'We do not know all your words but we like the sound of them.'}`,
      options: [{ label: 'Offer them a seed', says: 'offer them a seed' }, { label: 'Wait for the evening', says: 'wait for the evening' }]
    },
    gift: {
      subject: rng.pick(['A gift, for us?', 'We will keep it by the lamp']),
      body: `Envoy,\n\nA gift from the blue world. We have put it on the rug, which is where we put things we love, next to the lamp, which is where we put things we love most. Thank you. We have nothing to give back but a lantern, and you may take one.`,
      options: []
    },
    farewell: {
      subject: rng.pick(['Come back when the sun goes soft', 'Goodbye, envoy', 'Lanterns for the road']),
      body: `Envoy,\n\nYour fire is lifting off our meadow and we are all waving, which you cannot see because we are small and it is ${golden ? 'dusk' : 'daytime'}. ${seeds ? `The ${seeds > 1 ? seeds + ' seeds' : 'seed'} will grow. We will tell it about you.` : 'You left no seed, but you left words, and those grow too.'} Tell the three nations the moon says hello, and that the rug has room.\n\nCome back when the sun goes soft.`,
      options: []
    }
  }[kind] || S_FALLBACK(rng, text);
  return makeLetter({ from: fromShadelings(), kind: 'shadeling', day, subject: S.subject, body: `${S.body}\n\n— the shadelings, ${lantern(rng)}`, options: S.options || [], effects: {}, meta: { kind, scene: 'moon' } });
}
const S_FALLBACK = (rng, text) => ({ subject: 'From the rug', body: `Envoy,\n\nWe heard “${text || 'something'}” and nodded, in the way we nod.`, options: [] });

// ---------- entrepreneurs (ART_DIRECTION §11) ----------
// a folk asks to open a venture of their own (yes / no), or tells you they have started a small one
export function ventureLetter(rng, { agent, venture: v, day, settlement, started = false }) {
  const T = agent.traits;
  const what = v.title.toLowerCase();
  if (started) {
    return makeLetter({ from: fromAgent(agent), kind: 'venture', day, subject: rng.pick([`My ${what}`, `A ${what}, opening soon`, 'I went ahead']),
      body: `${greet(rng, settlement)}\n\n${rng.pick([
        `I have started a ${what} by my ${agent.homeId ? 'house' : 'tent'}. It is small and it is mine. ${T.includes('proud') ? 'You will want to be seen there.' : 'I hope you do not mind; it will earn a little for the crates.'}`,
        `Small news: a ${what}. I am building it myself, near where I sleep. Come by when it is open; the first one is free.`
      ])}${sign(agent)}`, options: [], effects: {}, meta: { kind: 'venture', ventureId: v.id, agentId: agent.id, started: true } });
  }
  const pitch = T.includes('ambitious') ? `I have wanted a ${what} since we landed. I would build it myself, near my ${agent.homeId ? 'house' : 'tent'}, and it would bring in a little coin. Say yes and I start today.`
    : T.includes('timid') ? `I know it is a lot to ask. A small ${what}, by my ${agent.homeId ? 'house' : 'tent'}? I would build it myself, in my own hours. If not, I understand.`
    : T.includes('proud') ? `A ${what}. Mine. The finest for three valleys, built by my own hands near my ${agent.homeId ? 'house' : 'tent'}. It will earn for the crates and it will be talked about. Say yes.`
    : `May I open a ${what}? I would build it myself, near my ${agent.homeId ? 'house' : 'tent'}, and keep it, and it would earn a little for all of us.`;
  return makeLetter({ from: fromAgent(agent), kind: 'venture', day, subject: rng.pick([`May I open a ${what}?`, `A ${what} of my own`, `An idea: a ${what}`]),
    body: `${greet(rng, settlement)}\n\n${pitch}${sign(agent)}`,
    options: [{ label: `Yes, open a ${what}`, says: 'yes' }, { label: 'Not now', says: 'no' }],
    effects: { yes: [{ type: 'venture', ventureId: v.id, decision: 'yes' }], no: [{ type: 'venture', ventureId: v.id, decision: 'no' }] },
    meta: { kind: 'venture', ventureId: v.id, agentId: agent.id } });
}

// the crowd's election: the ballots are counted (from the Ministry's book)
export function electionResult(rng, { winner, tally, voters, day, settlement, prev = null, kind = 'minister' }) {
  const lines = tally.slice(0, 3).map(t => `${t.agent.name}: ${t.votes}`).join(', ');
  const body = `Founder,\n\n${prev ? `${prev.name} no longer carries the seal, so the folk gathered and voted.` : 'No minister had been chosen, so the folk gathered in the square and voted among themselves.'} ${voters} ballots were cast. ${lines}.\n\n${winner.name} the ${winner.trade} carries the seal now${winner.traits.includes('proud') ? ', and says it was never in doubt' : winner.traits.includes('timid') ? ', and looked at the ground when it was announced' : ''}. The Ministry has recorded the count. You may still name another minister by voice.`;
  return makeLetter({ from: fromMinistry(), kind: 'election_result', day, subject: rng.pick([`The folk elect ${winner.name}`, `A minister, by vote: ${winner.name}`, 'The ballots are counted']), body: body + '\n\n— Ministry of Builds',
    options: [{ label: `Congratulate ${winner.name}`, says: `tell ${winner.name} congratulations` }, { label: 'Call a meeting', says: 'call a meeting' }],
    effects: { yes: [{ type: 'mood', agentId: winner.id, delta: 4, reason: 'congratulated' }], no: [] }, meta: { kind: 'election_result', electionKind: kind, agentId: winner.id, tally: tally.map(t => ({ id: t.agent.id, votes: t.votes })) } });
}

// ---------- conflicts and institutions (ART_DIRECTION §15) ----------
// the minister brings a conflict to the sovereign (the Ministry when no minister sits), with quick replies the
// parser executes. The advice line is the minister's own: it depends on their traits. meta.quick says how many of
// the options the tiny in-world tag shows (the first ones); the inbox shows them all.
const CONFLICT_SUBJECT = {
  theft: ['A theft at the crates', 'Bread gone missing', 'Someone has been at the stockpile'],
  quarrel: ['A quarrel', 'Two of ours at odds', 'Raised voices'],
  noise: ['A noise complaint', 'No sleep for the noise'],
  land: ['A dispute over land', 'Two claims on one plot'],
  neglect: ['A duty neglected', 'Tools down'],
  envoy: ['An envoy is displeased', 'A grievance from across the water'],
  jealousy: ['Grumbling about the seal', 'Someone wants my seal']
};
const CONFLICT_DETAIL = {
  theft: c => `${c.names[c.roles.offender] || 'The thief'} says it was only a crust. The crates say ${3} food.`,
  quarrel: c => `Neither will haul with the other, and the rest of us are picking sides.`,
  noise: c => `The ${c.topic || 'workshop'} keeps odd hours, and the walls are thin paper.`,
  land: c => `Both have paced it out. Both have drawn it in the sand. Neither will rub theirs out.`,
  neglect: c => `The place runs at half pace, and the others notice.`,
  envoy: c => `The envoy waited at the edge of the plot for a word, and did not get one.`,
  jealousy: c => `It is said quietly, which is worse than loudly.`
};
const CONFLICT_OPTIONS = {
  theft: [['Talk to them', 'talk to them'], ['Punish the thief', 'punish the thief'], ['Start a police patrol', 'start a police patrol'], ['Build a granary with a lock', 'build a granary'], ['Ignore', 'ignore it']],
  quarrel: [['Talk to them', 'talk to them'], ['Set up a court', 'set up a court'], ['Punish them both', 'punish them both'], ['Ignore', 'ignore it']],
  noise: [['Talk to them', 'talk to them'], ['Start a night watch', 'start a night watch'], ['Compensate them', 'compensate them'], ['Ignore', 'ignore it']],
  land: [['Talk to them', 'talk to them'], ['Set up a court', 'set up a court'], ['Ignore', 'ignore it']],
  neglect: [['Talk to them', 'talk to them'], ['Punish them', 'punish them'], ['Open a school', 'open a school'], ['Ignore', 'ignore it']],
  envoy: [['Apologise and compensate', 'compensate them'], ['Talk to them', 'talk to them'], ['Ignore', 'ignore it']],
  jealousy: [['Talk to them', 'talk to them'], ['Start a council', 'start a council'], ['Ignore', 'ignore it']]
};
function ministerAdvice(rng, minister, c, institutions) {
  const T = minister ? minister.traits : [];
  const want = { theft: institutions.includes('patrol') ? 'the patrol will see to it' : 'a police patrol would make it rare', quarrel: institutions.includes('court') ? 'the court can hear it' : 'a court would settle such things', noise: 'a night watch would settle it', land: institutions.includes('court') ? 'the court can hear it' : 'a court would settle it', neglect: 'a school would do more than a scolding', envoy: 'an apology and a small gift would mend it', jealousy: 'a word from you, or a role to fill, would end it' }[c.kind];
  if (!minister) return `The Ministry suggests that ${want}. It has suggested it before.`;
  if (T.includes('proud')) return `If you ask me, punish it, and let them see you did. Though ${want}.`;
  if (T.includes('timid')) return `Perhaps a quiet word is enough. I would rather not make enemies. Or ${want}.`;
  if (T.includes('generous')) return `Feed them and they will forget it. A crust goes a long way. Failing that, ${want}.`;
  if (T.includes('ambitious')) return `Give me a ${c.kind === 'theft' || c.kind === 'noise' ? 'patrol' : 'court'} to command and you will not hear of this twice.`;
  if (T.includes('stubborn')) return `I have said before: ${want}. I say it again.`;
  if (T.includes('gossip')) return `Between us, it is not the first time. ${want[0].toUpperCase() + want.slice(1)}.`;
  if (T.includes('lazy')) return `Could it wait? It could probably wait. Still, ${want}.`;
  return `Whatever you decide, I will carry it out to the letter. My own view: ${want}.`;
}
export function conflictLetter(rng, { minister, conflict: c, names = {}, day, settlement, institutions = [] }) {
  const cc = { ...c, names, roles: c.roles || {} };
  const subject = rng.pick(CONFLICT_SUBJECT[c.kind] || ['A dispute']);
  const body = `${greet(rng, settlement)}\n\n${c.summary} ${(CONFLICT_DETAIL[c.kind] || (() => ''))(cc)}\n\n${ministerAdvice(rng, minister, c, institutions)}${minister ? sign(minister) : '\n\n— Ministry of Builds'}`;
  const options = (CONFLICT_OPTIONS[c.kind] || CONFLICT_OPTIONS.quarrel).map(([label, says]) => ({ label, says }));
  return makeLetter({ from: minister ? fromMinister(minister) : fromMinistry(), kind: 'conflict', day, subject, body, options,
    effects: { yes: [{ type: 'conflict', conflictId: c.id, how: 'talk' }], no: [{ type: 'conflict', conflictId: c.id, how: 'ignore' }] },
    meta: { kind: 'conflict', conflictId: c.id, conflictKind: c.kind, parties: c.parties.slice(), severity: c.severity, place: { ...c.place }, quick: 3, ...(minister ? { agentId: minister.id } : {}) } });
}

// the Ministry records a founded institution: who wears the badge
export function institutionLetter(rng, { institution: i, names, day, settlement }) {
  const list = names.length > 1 ? names.slice(0, -1).join(', ') + ' and ' + names.at(-1) : names[0];
  const does = { patrol: 'They will walk the crates, the square and the workshops by day.', watch: 'They will walk the edges of the plot with lanterns after dark.', court: 'Quarrels will be heard in the square, and judged.', school: 'Lessons will be held in the square for whoever is free.', guild: 'Standards will be kept, and rivals made to shake hands.', festival: 'There will be ribbons, and bread, and a day off now and then.' }[i.kind] || 'They will meet in the square and see to it.';
  return makeLetter({ from: fromMinistry(), kind: 'ministry', day, subject: `The ${i.name} is founded`,
    body: `Founder,\n\n${list} ${names.length > 1 ? 'wear' : 'wears'} the ${i.badge} of the ${i.name} from today. ${does} The Ministry has noted it in the book.\n\n— Ministry of Builds`,
    options: [], effects: {}, meta: { kind: 'institution', institutionId: i.id, institutionKind: i.kind, members: i.members.slice() } });
}

export function meetingMinutes(rng, { minister, day, settlement, attendance }) {
  return makeLetter({ from: fromMinister(minister), kind: 'report', day, subject: `Meeting closed, day ${day}`,
    body: `${attendance} folk attended. Decisions were ${rng.pick(['few but firm', 'many and loud', 'postponed until bread'])}. Spirits lifted a little for having been asked.${minister ? sign(minister) : ''}` });
}
