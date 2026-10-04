// Templated letters for mock mode. Deterministic per (day, state) so the demo is repeatable.
// If web/js/sim/letters.js exists and exports something usable it is preferred (see loadLetterTemplates).
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { WEB_DIR } from '../config.js';

const hash = (s) => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const pick = (arr, seed) => arr[hash(seed) % arr.length];
const cap = (s) => s ? s[0].toUpperCase() + s.slice(1) : s;

// our folk are flits and floaties (both hold any trade); the walkers are the nations' peoples (ART_DIRECTION §7)
const SPECIES_VOICE = {
  flit: 'the propeller caps', floatie: 'the parasols',
  puffer: 'the builders', loaf: 'the bakers', drop: 'the artists', scoot: 'the couriers', pip: 'the farmers',
};
const PLURAL = { loaf: 'loaves', flit: 'flits', floatie: 'floaties', drop: 'drops', puffer: 'puffers', pip: 'pips', scoot: 'scoots' };
const peopleOf = n => (n && (n.peoples && n.peoples[0] || n.leaderSpecies)) ? (PLURAL[n.peoples && n.peoples[0] || n.leaderSpecies] || 'folk') : 'folk';

export function stateFacts(snapshot = {}) {
  const agents = (snapshot.agents || []).filter(a => a.status !== 'left');
  const buildings = snapshot.buildings || [];
  const res = snapshot.resources || snapshot.res || {};   // contract: resources; the sim's own snapshot: res
  const housing = buildings.filter(b => b.status === 'done').reduce((n, b) => n + (b.housing || ({ house: 3, hut: 2 })[b.kind] || 0), 0);
  const pop = agents.length;
  const idle = agents.filter(a => a.status === 'idle');
  const idleBuilders = idle.filter(a => a.trade === 'builder');
  const sites = buildings.filter(b => b.status === 'site' || b.status === 'building');
  const food = Number(res.food ?? 0);
  return {
    agents, buildings, res, pop, housing, idle, idleBuilders, sites,
    hungry: pop > 0 && food < pop * 2,
    starving: pop > 0 && food <= 0,
    homeless: Math.max(0, pop - housing),
    hasFarm: buildings.some(b => ['farm', 'bakery', 'well', 'garden'].includes(b.kind) && b.status === 'done'),
    neighbours: snapshot.neighbours || [],
    minister: agents.find(a => a.id === snapshot.minister) || null,
    day: snapshot.day || 1,
    stage: snapshot.stage || 'camp',
  };
}

function agentFrom(a) { return { kind: 'agent', id: a.id, name: a.name }; }

export function societyLetters(snapshot, recent = [], { max = 2 } = {}) {
  const f = stateFacts(snapshot);
  const out = [], events = [];
  const seed = `${f.day}:${f.pop}:${f.buildings.length}`;
  const recentSubjects = new Set((recent || []).map(r => (typeof r === 'string' ? r : r?.subject) || '').map(s => s.toLowerCase()));
  const push = (l) => { if (out.length < max && !recentSubjects.has(l.subject.toLowerCase())) out.push(l); };

  if (f.pop && (f.starving || f.hungry)) {
    const a = pick(f.agents.filter(x => x.trade === 'baker' || x.trade === 'farmer').concat(f.agents), seed + 'h');
    push({
      from: agentFrom(a), kind: 'complaint',
      subject: f.starving ? "We're hungry" : 'The crates are nearly empty',
      body: `${a.name} writes: the food crates hold ${f.res.food ?? 0} for ${f.pop} of us. ${f.hasFarm ? 'The fields are slow.' : 'Nothing grows here yet.'} Could we have a farm, or ${f.buildings.some(b => b.kind === 'windmill') ? 'a bakery near the windmill' : 'a windmill and a bakery'}? Moods are thin on empty stomachs.`,
      options: [
        { label: f.buildings.some(b => b.kind === 'windmill') ? 'Build a bakery near the windmill' : 'Build a farm in the middle', says: f.buildings.some(b => b.kind === 'windmill') ? 'build a bakery near the windmill' : 'build a farm in the middle' },
        { label: 'Build a farm by the water', says: 'build a farm near the water' },
        { label: 'Not now', says: 'no' },
      ],
    });
    events.push({ kind: 'mood', agentId: a.id, neighbourId: null, delta: -3, note: 'hunger' });
  }

  if (f.homeless > 0 && f.day >= 1) {
    const a = pick(f.agents, seed + 'home');
    push({
      from: agentFrom(a), kind: 'petition', subject: `${f.homeless} of us sleep under the sky`,
      body: `Dear sovereign, the nights are long on the cream ground. ${f.homeless} of us have no roof; ${a.name} counted. A house shelters three, a hut two. We would raise the walls ourselves if you say where.`,
      options: [
        { label: 'A house in the middle', says: 'build a house in the middle' },
        { label: 'Two huts there', says: 'build two huts there' },
        { label: 'Later', says: 'no' },
      ],
    });
  }

  if (f.idleBuilders.length >= 2 && f.sites.length === 0) {
    const a = f.idleBuilders[hash(seed + 'idle') % f.idleBuilders.length];
    push({
      from: agentFrom(a), kind: 'idea', subject: 'Idle hands, ready hammers',
      body: `${a.name} here, with ${f.idleBuilders.length - 1} other builders sitting on the crates. We could raise a windmill, a well, or a tower by the sea. Say the word and point.`,
      options: [
        { label: 'A windmill there', says: 'a windmill there' },
        { label: 'A well in the middle', says: 'build a well in the middle' },
        { label: 'Rest for today', says: `let ${a.name} rest` },
      ],
    });
  }

  if (f.neighbours.length && f.day % 3 === 0) {
    const n = pick(f.neighbours, seed + 'n');
    const envious = (n.attitude ?? 50) < 40;
    push({
      from: { kind: 'neighbour', id: n.id, name: n.name }, kind: 'neighbour',
      subject: envious ? `${n.name} eyes your shore` : `${n.name} proposes a trade`,
      body: envious
        ? `Our ${n.leaderSpecies || 'leader'} watched your colour spread from the ridge. We were here first. A gift of 5 wood would keep the peace, or build a tower so we know you mean to stay.`
        : `Greetings from ${n.name}. We have stone to spare and lack food. Ten stone for eight food, delivered by our ${peopleOf(n)}? Our ${n.leaderSpecies || 'leader'} sends regards.`,
      options: envious
        ? [{ label: 'Send 5 wood', says: `trade 5 wood for 1 coin with ${n.name}` }, { label: 'Build a tower', says: 'build a tower near the edge' }, { label: 'Ignore', says: 'no' }]
        : [{ label: 'Accept', says: `trade 8 food for 10 stone with ${n.name}` }, { label: 'Decline', says: 'no' }],
    });
    events.push({ kind: 'neighbour', agentId: null, neighbourId: n.id, delta: envious ? -2 : 1, note: envious ? 'envy' : 'offer' });
  }

  if (!out.length && f.pop >= 2) {
    const a = pick(f.agents, seed + 'g'), b = pick(f.agents.filter(x => x.id !== a.id), seed + 'g2') || a;
    const gossip = [
      `${a.name} writes: ${b.name} hums while hauling and the crates arrive faster. Perhaps ${b.name} should lead the next site.`,
      `${a.name} writes: the sea was gold at sundown and ${b.name} said we should build a bench to watch it. A garden, maybe?`,
      `${a.name} writes: ${b.name} claims to be the best baker in three valleys. Nobody has seen bread yet.`,
    ];
    push({
      from: agentFrom(a), kind: 'gossip', subject: pick(['Small news from the crates', 'Overheard by the stockpile', 'A note between hammer blows'], seed + 's'),
      body: pick(gossip, seed + 'gb'),
      options: [{ label: 'Ask who bakes', says: 'who is good at baking?' }, { label: 'A garden there', says: 'a garden there' }, { label: 'Noted', says: 'yes' }],
    });
  }
  return { letters: out, events };
}

const SKILL_VERB = { building: 'raise walls', baking: 'bake', farming: 'grow things', crafting: 'make things', trading: 'haggle', diplomacy: 'talk for us', art: 'paint and sing', scouting: 'find the way' };

export const LETTER_PURPOSES = ['refusal', 'skill_answer', 'report', 'reply', 'conflict', 'election', 'envoy', 'gift_thanks', 'shadeling_contact', 'shadeling_seed', 'shadeling_golden', 'shadeling_farewell'];
export const SHADELINGS = { kind: 'neighbour', id: 'shadelings', name: 'the shadelings', species: 'shadeling' };
export const ALL_NATIONS = { kind: 'neighbour', id: 'nations', name: 'the three nations' };

// The nation a nation-letter is about: context.neighbour (object or id), else the most recent letter's sender, else the friendliest.
export function pickNeighbour(context = {}, snapshot = {}) {
  const ns = snapshot.neighbours || [];
  const c = context.neighbour;
  if (c && typeof c === 'object' && c.name) return { ...(ns.find(n => n.id === c.id) || {}), ...c };
  const id = typeof c === 'string' ? c : context.neighbourId;
  if (id) { const n = ns.find(x => x.id === id); if (n) return n; }
  for (const key of ['letters', 'recent', 'unread']) for (const l of [...(snapshot[key] || [])].reverse()) {
    const from = l?.from; const nm = typeof from === 'string' ? from : from?.name; const fid = from?.id;
    const n = ns.find(x => x.id === fid || (nm && x.name && nm.toLowerCase() === x.name.toLowerCase()));
    if (n) return n;
  }
  return [...ns].sort((a, b) => (b.attitude ?? 50) - (a.attitude ?? 50))[0] || { id: null, name: 'the neighbours', temperament: 'warm', leaderName: 'their leader' };
}
const STYLE = {
  proud: { open: (n) => `From the high seat of ${n.name},`, close: (n) => `${n.leaderName || 'the leader'}, who does not usually write first` },
  warm: { open: () => 'Dear neighbours,', close: (n) => `with warm regards, ${n.leaderName || 'your friend'} of ${n.name}` },
  gruff: { open: () => 'To the lot by the bay.', close: (n) => `${n.leaderName || 'the harbourmaster'}. ${n.name}.` },
  sly: { open: () => 'Dearest friends across the water,', close: (n) => `your devoted ${n.leaderName || 'friend'}` },
};
const styleOf = (n) => STYLE[n.temperament] || { open: () => 'Neighbours,', close: (x) => x.leaderName || x.name };
const resList = (o) => Object.entries(o || {}).filter(([, v]) => v > 0).map(([k, v]) => `${v} ${k}`).join(' and ');

// In-character letters for /api/letter. Every result carries `from` and `kind` so the client can file it.
export function letterFor({ purpose, agent = {}, context = {}, snapshot = {} }) {
  const name = agent.name || 'A folk';
  const traits = agent.traits || [];
  const proud = traits.includes('proud') || traits.includes('ambitious');
  const timid = traits.includes('timid');
  const skill = context.skill || 'building';
  const level = Number(agent.skills?.[skill] ?? context.level ?? 5);
  const f = stateFacts(snapshot);
  const l = letterBody({ purpose, agent, context, snapshot, name, proud, timid, skill, level, f });
  const from = l.from || (purpose === 'report' ? { kind: 'minister', id: agent.id || null, name: f.minister?.name || name } : { kind: 'agent', id: agent.id || null, name });
  const kind = l.kind || (purpose === 'reply' ? 'reply' : purpose);
  return { subject: l.subject, body: l.body, options: l.options || [], from, kind };
}

function letterBody({ purpose, agent, context, snapshot, name, proud, timid, skill, level, f }) {
  const town = snapshot.name || 'the plot by the sea';
  const built = f.buildings.filter(b => b.status === 'done');
  const landmark = built.find(b => b.generated || /pending|gen-/.test(b.kind || '')) || built[built.length - 1];
  switch (purpose) {
    case 'election': {
      const ns = f.neighbours.length ? f.neighbours : [{ name: 'Sorrento-on-the-Rock', temperament: 'proud', leaderName: 'Donna Perla' }, { name: 'Little Lantern', temperament: 'warm', leaderName: 'Baker Odo' }, { name: 'Grey Harbour', temperament: 'gruff', leaderName: 'Harbourmaster Brusco' }];
      const voice = (n) => n.temperament === 'proud' ? `${n.name} concedes, with reluctance, that your ${landmark ? landmark.name.toLowerCase() : 'roofs'} can be seen from our terraces, and that it is handsome.`
        : n.temperament === 'gruff' ? `${n.name}: you build straight and you feed your folk. Good enough.`
        : `${n.name} has watched the colour spread over ${town} every evening and clapped, honestly.`;
      return {
        from: ALL_NATIONS, kind: 'election',
        subject: 'You are elected Earth\'s envoy',
        body: `To the sovereign of ${town}, from all three nations at once.\n\n${ns.map(voice).join(' ')}\n\nThe moon has hung over all of us for a long time, and something glows on it at dusk. None of us dares go. We have voted, and it was not close: ${f.pop ? `${f.pop} folk` : 'your folk'} and one voice from the sky make a better envoy than any of us. Build a rocket. Carry a seed. Speak for the Earth.\n\n— ${ns.map(n => n.leaderName || n.name).join(', ')}`,
        options: [{ label: 'Build a rocket', says: 'build a rocket' }, { label: 'To the moon', says: "let's go to the moon" }, { label: 'Not yet', says: 'not yet' }],
      };
    }
    case 'envoy': {
      const n = pickNeighbour(context, snapshot);
      const st = styleOf(n);
      const kind = ['greeting', 'trade', 'envy', 'alliance', 'complaint', 'news'].includes(context.kind) ? context.kind : (n.attitude ?? 50) < 35 ? 'envy' : (n.attitude ?? 50) >= 65 ? 'alliance' : 'trade';
      const give = context.give && typeof context.give === 'object' ? context.give : { [n.wants || 'food']: 6 };
      const get = context.get && typeof context.get === 'object' ? context.get : { [n.surplus || 'stone']: 8 };
      const L = {
        greeting: { subject: `Welcome from ${n.name}`, body: `${st.open(n)}\n\nSo there is someone on the empty plot at last. We are ${n.name}${n.desc ? ', ' + n.desc : ''}. Our envoy flew the long way round to have a look at you. ${n.temperament === 'warm' ? 'If you run short of bread in the first days, ask.' : n.temperament === 'gruff' ? 'Keep your gulls off our nets.' : 'You will find us hard to impress.'}`, options: [{ label: 'Send them bread', says: 'send them a basket of bread' }, { label: 'Show me the neighbours', says: 'show me the neighbours' }] },
        trade: { subject: `A trade: our ${resList(get)} for your ${resList(give)}`, body: `${st.open(n)}\n\nWe have more ${Object.keys(get)[0]} than we can use and hear you are short. We offer ${resList(get)} for ${resList(give)}. Our ${peopleOf(n)} can be at your crates by sundown.`, options: [{ label: 'Accept the trade', says: `accept the trade with ${n.name}` }, { label: 'Decline', says: 'no' }] },
        envy: { subject: 'We see your lights', body: `${st.open(n)}\n\nWe see new roofs on ${town} every evening${landmark ? `, and now a ${landmark.name.toLowerCase()}` : ''}. ${n.temperament === 'gruff' ? 'Do not get ideas.' : 'Charming. Ours are older.'} A small gift would show you remember who was here first.`, options: [{ label: 'Send a gift', says: `send a basket of bread to ${n.name}` }, { label: 'Ignore them', says: 'ignore it' }] },
        alliance: { subject: 'An alliance', body: `${st.open(n)}\n\nOur folk like your folk. Let us call it an alliance: shared roads, open markets, and a seat for your minister at our table. Say yes out loud and our envoy will carry it home.`, options: [{ label: 'Yes, allies', says: `ally with ${n.name}` }, { label: 'Not yet', says: 'not yet' }] },
        complaint: { subject: 'Your folk on our shore', body: `${st.open(n)}\n\nYour flits have been seen buzzing over our side of the water, and a floatie, which we are fairly sure is yours, drifted parasol-first into our nets. Call them home or we will take it as rudeness.`, options: [{ label: 'Apologise', says: `apologise to ${n.name}` }, { label: 'They are only gulls', says: 'dismiss it' }] },
        news: { subject: `News from ${n.name}`, body: `${st.open(n)}\n\nNothing to ask, for once. ${n.temperament === 'warm' ? 'The ovens are full and the children are learning to fly kites off the quay.' : n.temperament === 'gruff' ? 'The cranes are up. The fish are late.' : 'Our bell has been rehung and sounds, if anything, older.'} We thought you should know that ${town} is talked about here, mostly kindly.`, options: [{ label: 'Send them bread', says: 'send them a basket of bread' }, { label: 'Visit them', says: `show me ${n.name}` }] },
      }[kind];
      return { from: { kind: 'neighbour', id: n.id, name: n.name }, kind: 'envoy', subject: L.subject, body: `${L.body}\n\n— ${st.close(n)}`, options: L.options };
    }
    case 'gift_thanks': {
      const n = pickNeighbour(context, snapshot);
      const st = styleOf(n);
      const gift = context.gift || 'your gift';
      const line = n.temperament === 'warm' ? `${gift} arrived still warm, and was shared round the square before the courier had sat down.`
        : n.temperament === 'gruff' ? `${gift} arrived. We counted it. It was all there. The harbour folk say thank you, which they do not say often.`
        : `${gift} arrived at the high seat and was received with, let us say, composure. The children were less composed.`;
      return { from: { kind: 'neighbour', id: n.id, name: n.name }, kind: 'thanks', subject: `Thank you for ${gift}`, body: `${st.open(n)}\n\n${line.charAt(0).toUpperCase() + line.slice(1)} Your courier was given water and a bench in the shade. Consider the water between us a little narrower.\n\n— ${st.close(n)}`, options: [{ label: 'Show me the neighbours', says: 'show me the neighbours' }, { label: 'Send more', says: `send ${n.name} a basket of bread` }, { label: 'Noted', says: 'yes' }] };
    }
    case 'shadeling_contact': return { from: SHADELINGS, kind: 'shadeling', subject: 'something has landed',
      body: 'something has landed in the grass\nit is not a seed, it is tall\nwe lit a little, to see\nyou cast a shadow the long way\nwhat do you carry\nthe evening is far\n\n— we who glow',
      options: [{ label: 'Offer them a seed', says: 'offer them a seed' }, { label: 'We come in peace', says: 'we come in peace' }, { label: 'Wait for the evening', says: 'wait for the evening' }] };
    case 'shadeling_seed': return { from: SHADELINGS, kind: 'shadeling', subject: 'a seed, a seed',
      body: 'a seed\nit went into the grass with a small sound\nwe stood round it on our long legs\nwe will keep it warm until the light goes gold\nthen you will see\n\n— the shadelings',
      options: [{ label: 'Wait for the evening', says: 'wait for the evening' }, { label: 'We come in peace', says: 'we come in peace' }, { label: 'Home', says: "let's go home" }] };
    case 'shadeling_golden': return { from: SHADELINGS, kind: 'shadeling', subject: 'now we are lit',
      body: 'now we are lit\nthe lake a coin, the rug a fire\nthis is our hour, and you are in it\nstay as long as the gold does\n\n— we who glow',
      options: [{ label: 'Offer them a seed', says: 'offer them a seed' }, { label: 'Home', says: "let's go home" }] };
    case 'shadeling_farewell': return { from: SHADELINGS, kind: 'shadeling', subject: 'go softly',
      body: 'go softly\nwe will keep the seed\nthe grass remembers where you stood\ncome back when the light goes gold\nwe will be lit\n\n— the shadelings',
      options: [{ label: 'Home', says: "let's go home" }, { label: 'Stay for the evening', says: 'wait for the evening' }] };
    case 'refusal': {
      const why = context.why || context.task?.why || 'I am worn out';
      return {
        subject: `I cannot, not today`,
        body: `${name} writes, with respect: ${why}. ${agent.mood < 40 ? 'The mood in the crates is low and so is mine.' : 'Ask again when I have rested, and I will go gladly.'} ${f.idle.length ? `${f.idle[0].name} is free and willing.` : 'Perhaps another has the energy.'}`,
        options: [
          ...(f.idle.length ? [{ label: `Send ${f.idle[0].name} instead`, says: `assign ${f.idle[0].name} to the ${context.buildingName || 'site'}` }] : []),
          { label: `Let ${name} rest`, says: `let ${name} rest` },
          { label: 'Insist', says: `tell ${name} we need you today` },
        ],
      };
    }
    case 'skill_answer': {
      const claim = proud ? Math.min(10, level + 3) : timid ? Math.max(0, level - 3) : level;
      const line = proud ? `Nobody here can ${SKILL_VERB[skill] || skill} like I can. Three valleys know it.` : timid ? `I can ${SKILL_VERB[skill] || skill} a little, though others are surely better.` : `I can ${SKILL_VERB[skill] || skill} well enough; put me to it and judge.`;
      return {
        subject: `On ${skill}: ${name}`,
        body: `${name} writes: you asked who is good at ${skill}. ${line} Call it ${claim} out of ten${proud ? ', if you must count' : ''}. ${agent.trade ? `By trade I am a ${agent.trade}.` : ''}`.trim(),
        options: [{ label: `Put ${name} on it`, says: `assign ${name} to the ${context.buildingName || 'bakery'}` }, { label: `Make ${name} minister`, says: `make ${name} our minister` }, { label: 'Thank them', says: `tell ${name} thank you` }],
      };
    }
    case 'report': {
      const m = f.minister || agent;
      return {
        subject: `Minister's report, day ${f.day}`,
        body: `${m.name || name} reports: we are ${f.pop} folk in a ${f.stage}, with ${f.res.food ?? 0} food, ${f.res.wood ?? 0} wood, ${f.res.stone ?? 0} stone. ${f.sites.length ? `${f.sites.length} site${f.sites.length > 1 ? 's' : ''} under way.` : 'No sites under way.'} ${f.homeless ? `${f.homeless} sleep outside.` : 'Everyone has a roof.'} ${f.hungry ? 'Food is short; I advise a farm.' : 'Food will hold.'} ${f.neighbours.length ? `${f.neighbours[0].name} watches from the ridge.` : ''}`.trim(),
        options: [{ label: 'Build a farm', says: 'build a farm in the middle' }, { label: 'Build a house', says: 'build a house there' }, { label: 'Thank the minister', says: `tell ${m.name || name} well done` }],
      };
    }
    // ART_DIRECTION §15: the minister (the writer, `agent`; the Ministry when there is none) brings a conflict with quick replies.
    // context.conflict = { id, kind, summary, parties, severity, place }, context.institutions = ['patrol', ...] already founded
    case 'conflict': {
      const c = context.conflict && typeof context.conflict === 'object' ? context.conflict : { kind: 'quarrel', summary: 'Two of ours are at odds over a borrowed tool.', severity: 1 };
      const inst = Array.isArray(context.institutions) ? context.institutions : [];
      const minister = agent && agent.id ? agent : (f.minister || null);
      const T = minister && Array.isArray(minister.traits) ? minister.traits : [];
      const want = { theft: inst.includes('patrol') ? 'the patrol will see to it' : 'a police patrol would make it rare', quarrel: inst.includes('court') ? 'the court can hear it' : 'a court would settle such things', noise: 'a night watch would settle it', land: 'a court would settle it', neglect: 'a school would do more than a scolding', envoy: 'an apology and a small gift would mend it', jealousy: 'a word from you would end it' }[c.kind] || 'a word from you would end it';
      const advice = !minister ? `The Ministry suggests that ${want}.` : T.includes('proud') ? `If you ask me, punish it, and let them see you did. Though ${want}.` : T.includes('timid') ? `Perhaps a quiet word is enough. Or ${want}.` : T.includes('generous') ? `Feed them and they will forget it. Failing that, ${want}.` : T.includes('ambitious') ? `Give me a ${c.kind === 'theft' || c.kind === 'noise' ? 'patrol' : 'court'} to command and you will not hear of this twice.` : T.includes('stubborn') ? `I have said before: ${want}. I say it again.` : T.includes('gossip') ? `Between us, it is not the first time. ${cap(want)}.` : `Whatever you decide, I will carry it out. My own view: ${want}.`;
      const subject = { theft: 'A theft at the crates', quarrel: 'A quarrel', noise: 'A noise complaint', land: 'A dispute over land', neglect: 'A duty neglected', envoy: 'An envoy is displeased', jealousy: 'Grumbling about the seal' }[c.kind] || 'A dispute';
      const options = ({
        theft: [['Talk to them', 'talk to them'], ['Punish the thief', 'punish the thief'], ['Start a police patrol', 'start a police patrol'], ['Ignore', 'ignore it']],
        quarrel: [['Talk to them', 'talk to them'], ['Set up a court', 'set up a court'], ['Punish them both', 'punish them both'], ['Ignore', 'ignore it']],
        noise: [['Talk to them', 'talk to them'], ['Start a night watch', 'start a night watch'], ['Compensate them', 'compensate them'], ['Ignore', 'ignore it']],
        land: [['Talk to them', 'talk to them'], ['Set up a court', 'set up a court'], ['Ignore', 'ignore it']],
        neglect: [['Talk to them', 'talk to them'], ['Punish them', 'punish them'], ['Open a school', 'open a school'], ['Ignore', 'ignore it']],
        envoy: [['Apologise and compensate', 'compensate them'], ['Talk to them', 'talk to them'], ['Ignore', 'ignore it']],
        jealousy: [['Talk to them', 'talk to them'], ['Start a council', 'start a council'], ['Ignore', 'ignore it']],
      }[c.kind] || [['Talk to them', 'talk to them'], ['Ignore', 'ignore it']]).map(([label, says]) => ({ label, says }));
      return { from: minister && minister.id ? { kind: 'minister', id: minister.id, name: minister.name || name } : { kind: 'ministry', id: 'builds', name: 'Ministry of Builds' }, kind: 'conflict', subject,
        body: `${minister && minister.name ? minister.name : 'The Ministry'} writes: ${c.summary || 'there is a dispute.'} ${c.severity >= 2 ? 'It has gone on long enough to sour the crates.' : 'It is small, for now.'} ${advice}`, options };
    }
    case 'reply':
    default: {
      const said = context.text || context.message || '';
      return {
        subject: `Re: ${(context.subject || said || 'your words').slice(0, 40)}`,
        body: `${name} writes: I read your words${said ? ` ("${said.slice(0, 60)}")` : ''} twice by the lamp. ${context.decision === 'no' ? 'I understand, though it stings a little.' : context.decision === 'yes' ? 'Thank you. I will tell the others and we start at first light.' : 'I will do as you say and write again when it is done.'}`,
        options: [{ label: 'Call a meeting', says: 'call a meeting' }, { label: 'Ask the crowd', says: 'who is good at building?' }],
      };
    }
  }
}

// Optional: prefer the sim's templated letters if it exports a compatible function.
export async function loadLetterTemplates() {
  const file = path.join(WEB_DIR, 'js', 'sim', 'letters.js');
  if (!fs.existsSync(file)) return { source: 'server/mock/letters.js', societyLetters, letterFor };
  try {
    const mod = await import(pathToFileURL(file).href);
    const sl = typeof mod.societyLetters === 'function' ? mod.societyLetters : null;
    const lf = typeof mod.letterFor === 'function' ? mod.letterFor : null;
    if (sl || lf) return { source: 'web/js/sim/letters.js (partial)', societyLetters: sl || societyLetters, letterFor: lf || letterFor };
  } catch (err) {
    return { source: `server/mock/letters.js (sim letters failed: ${err.message})`, societyLetters, letterFor };
  }
  return { source: 'server/mock/letters.js', societyLetters, letterFor };
}
