// The developed civilisation, as data (Sueda, 2026-10-04 pm: "a glimpse of how this game would look fully played").
// A pure function of the player's REAL early state: it never writes to it. game/future.js shows it (the city, the crowd,
// the mailbox, the tally, the cabinet) while the real game is paused, and puts the real one back on exit.
//
//   const F = makeFutureState(game.state, { day })
//   F.level / F.progress / F.totals { money, happiness, science }    the reward tally (a high civ level, big numbers)
//   F.population { total, species: [{ species, plural, n }] }          every species, the town grown
//   F.cabinet [{ role, title, remit, agentId, name, species, trade }]  five ministers, each one of HER residents
//   F.letters [letter]                                                  the mailbox at this stage (science first)
//   F.replyFor(says) -> { text, letterId } | null                       what the city answers to a letter's quick reply
//
// The cabinet is drawn from her own residents (the minister she chose keeps Builds), so their painted portraits are
// the ones she already knows. Letter ids start with 'fut-' and never reach the sim.

export const FUTURE_LEVEL = 'Republic';
export const FUTURE_DAY = 412;

const ROLES = [
  { role: 'builds', title: 'Minister of Builds', short: 'Builds', remit: 'the Ministry of Builds, every new street', skill: ['building'], prefer: [] },
  { role: 'science', title: 'Minister of Science', short: 'Science', remit: 'the Academy, the observatory, the rocket', skill: ['crafting', 'scouting'], prefer: ['twinkle'] },
  { role: 'industry', title: 'Minister of Industry', short: 'Industry', remit: 'the power station, the works, the silos', skill: ['building', 'crafting'], prefer: ['moth', 'loaf'] },
  { role: 'culture', title: 'Minister of Culture', short: 'Culture', remit: 'the opera, the library, the festivals', skill: ['art'], prefer: ['glim'] },
  { role: 'diplomacy', title: 'Minister of Diplomacy', short: 'Diplomacy', remit: 'the neighbours, the harbour, the treaties', skill: ['diplomacy', 'trading'], prefer: ['floatie', 'flit'] }
];

export const SPECIES_PLURAL = { flit: 'flits', floatie: 'floaties', loaf: 'loaves', twinkle: 'twinkles', glim: 'glims', moth: 'moths', puffer: 'puffers', drop: 'drops', pip: 'pips', scoot: 'scoots' };
// the grown town: ours (the twelve's people and the four townsfolk companies) and the neighbours' peoples who moved in
const POPULATION = [['loaf', 236], ['flit', 214], ['floatie', 188], ['twinkle', 171], ['glim', 162], ['moth', 149], ['puffer', 58], ['drop', 44], ['pip', 31], ['scoot', 31]];

function pickCabinet(state) {
  const alive = (state.agents || []).filter(a => a && a.status !== 'left');
  const used = new Set(), out = [];
  const skill = (a, ks) => ks.reduce((s, k) => s + ((a.skills || {})[k] || 0), 0);
  for (const R of ROLES) {
    let best = null;
    if (R.role === 'builds' && state.minister != null) best = alive.find(a => a.id === state.minister) || null;
    if (!best) {
      let bs = -1e9;
      for (const a of alive) {
        if (used.has(a.id)) continue;
        const sp = R.prefer.indexOf(a.species), sc = skill(a, R.skill) + (sp >= 0 ? 3 - sp * 0.5 : 0) - (out.some(o => o.species === a.species) ? 6 : 0);
        if (sc > bs) { bs = sc; best = a; }
      }
    }
    if (best) used.add(best.id);
    out.push({ role: R.role, title: R.title, short: R.short, remit: R.remit, agentId: best ? best.id : null, name: best ? best.name : 'Someone', species: best ? best.species : null, trade: best ? best.trade : null });
  }
  return out;
}

function letters(cab, state, day) {
  const by = r => cab.find(c => c.role === r) || { name: 'Someone', agentId: null };
  const from = (c, line) => c.agentId != null ? { kind: 'agent', id: c.agentId, name: c.name, species: c.species, trade: line } : { kind: 'folk', name: c.name, trade: line };
  const sci = by('science'), ind = by('industry'), cul = by('culture'), dip = by('diplomacy'), bld = by('builds');
  // the flight director: a resident who is not in the cabinet (a scout if there is one)
  const inCab = new Set(cab.map(c => c.agentId));
  const crew = (state.agents || []).filter(a => a && a.status !== 'left' && !inCab.has(a.id));
  const fd = crew.slice().sort((a, b) => (((b.skills || {}).scouting || 0) - ((a.skills || {}).scouting || 0)))[0] || null;
  const fdc = fd ? { agentId: fd.id, name: fd.name, species: fd.species } : { agentId: null, name: 'Captain Vela' };
  const ns = state.neighbours || [];
  const nb = ns.find(n => n.id === 'n3') || ns[0] || null;
  const L = [];
  const add = (o, read = false) => L.push({ day, read, resolved: false, meta: { future: true }, ...o });
  // newest first in the mailbox = added last here
  add({ id: 'fut-census', kind: 'notice', from: { kind: 'ministry', id: 'builds', name: 'Ministry of Builds' }, subject: 'The census is in',
    body: `Dear leader,\n\nThe census is in: 1,284 residents in ten species, 341 buildings, 3 bridges and 1 rocket.\n\nThe twelve who landed on the beach with very little now have grandchildren, a harbour and an opera. Nobody has counted the gulls.\n\n— ${bld.name}, for the Ministry of Builds` }, true);
  add({ id: 'fut-treaty', kind: 'envoy', from: nb ? { kind: 'neighbour', id: nb.id, name: nb.name } : { kind: 'folk', name: 'Our neighbours' }, subject: 'A trade treaty?',
    body: `Dear friends across the water,\n\nYour harbour is busy, your bread is famous and your rocket is the talk of our coast. We would like to sign a trade treaty: our salt, glass and sea-silk for your flour, tools and telescopes.\n\nOur ships could visit every week. We will bring the treaty, a pen and a very large cake.${nb && nb.leaderName ? `\n\n— ${nb.leaderName}` : ''}`,
    options: [{ label: 'Sign the treaty', says: 'sign the trade treaty' }, { label: 'Ask them over to talk first', says: 'invite the neighbours to talk' }] });
  add({ id: 'fut-opera', kind: 'request', from: from(cul, 'Minister of Culture'), subject: 'A festival at the opera',
    body: `Dear leader,\n\nThe opera house is one year old next week! We would love a festival: music on the steps, lanterns over the square, and a play about the day we landed with very little.\n\nThe glims have offered to be the lights. The loaves are already baking. All we need is your yes, and perhaps a few more benches.\n\n— ${cul.name}, Minister of Culture`,
    options: [{ label: 'Yes, a festival!', says: 'hold a festival at the opera' }, { label: 'Add fireworks over the harbour', says: 'fireworks over the harbour' }] });
  add({ id: 'fut-power', kind: 'report', from: from(ind, 'Minister of Industry'), subject: 'The power station had a good month',
    body: `Dear leader,\n\nGood news from the east end. The power station made 4.2 gigawatt-hours this month, our best yet. Every street lamp is on, the bakeries can bake at night, and the silos are full to the top.\n\nThe chimneys are a little smoky. We are testing a cleaner furnace, and the moths say they could look after some wind turbines on the hill.\n\n— ${ind.name}, Minister of Industry`,
    options: [{ label: 'Try the cleaner furnace', says: 'try the cleaner furnace' }, { label: 'Wind turbines on the hill', says: 'build wind turbines on the hill' }] });
  add({ id: 'fut-rocket', kind: 'request', from: from(fdc, 'Flight director, the rocket programme'), subject: 'Test flight on Thursday',
    body: `Dear leader,\n\nThe rocket on the sea pad is fuelled, polished and very tall. We would like to try a short test flight on Thursday: straight up, a small loop, and straight back down onto the pad.\n\nNobody will be inside. Only a sandwich, to see if it stays fresh in space.\n\nThe harbour will be closed for the morning. We would be honoured if you pressed the button.\n\n— ${fdc.name}, Flight director`,
    options: [{ label: 'Go for launch', says: 'go for launch' }, { label: 'Wait for clear skies', says: 'wait for clear skies' }] });
  add({ id: 'fut-observatory', kind: 'request', from: from(sci, 'Minister of Science'), subject: 'A launch observatory, please',
    body: `Dear leader,\n\nThe Academy has finished its new telescope, the best one we have ever made. But the old dome on the hill is too small for it, and the rocket team keeps asking us where the clouds are.\n\nWe would like a launch observatory by the sea pad: a tall dome that can watch the sky and the rocket at the same time. The students have drawn three versions already. One of them has a slide.\n\n— ${sci.name}, Minister of Science`,
    options: [{ label: 'Build it by the pad', says: 'build a launch observatory by the pad' }, { label: 'The one with the slide', says: 'build the observatory with the slide' }] });
  return L;
}

// what the city answers when she picks a quick reply in the preview (nothing reaches her real game)
const REPLIES = {
  'sign the trade treaty': 'The treaty is signed. The first ship of salt and glass sails on Monday, with the cake.',
  'invite the neighbours to talk': 'An invitation crosses the water. They will come for tea and bring the treaty anyway.',
  'hold a festival at the opera': 'The opera’s festival is on: lanterns go up over the square tonight.',
  'fireworks over the harbour': 'Fireworks it is. The gulls have been warned.',
  'try the cleaner furnace': 'The works fire up the cleaner furnace. The chimneys already breathe a little paler.',
  'build wind turbines on the hill': 'The moths are measuring the wind on the hill for twelve turbines.',
  'go for launch': 'Go for launch! Thursday morning, the harbour closes and the sandwich goes up.',
  'wait for clear skies': 'The flight waits for clear skies. The sandwich goes back in the fridge.',
  'build a launch observatory by the pad': 'The Academy breaks ground by the sea pad: a tall dome for the sky and the rocket.',
  'build the observatory with the slide': 'The observatory with the slide is approved. The students cheered loudly.'
};

export function makeFutureState(state = {}, { day = FUTURE_DAY } = {}) {
  const cabinet = pickCabinet(state);
  const species = POPULATION.map(([sp, n]) => ({ species: sp, plural: SPECIES_PLURAL[sp] || sp + 's', n }));
  const total = species.reduce((s, x) => s + x.n, 0);
  const L = letters(cabinet, state, day);
  return {
    day, level: FUTURE_LEVEL, progress: 0.64,
    totals: { money: 48260, happiness: 1940, science: 3780 },
    population: { total, species },
    buildings: 341,
    cabinet,
    letters: L,
    replyFor(says) {
      const k = String(says || '').trim().toLowerCase();
      if (!REPLIES[k]) return null;
      const lt = L.find(l => (l.options || []).some(o => o.says === k));
      return { text: REPLIES[k], letterId: lt ? lt.id : null };
    }
  };
}
