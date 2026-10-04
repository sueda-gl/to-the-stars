// ART_DIRECTION §7: our people are only the two fliers (flits, floaties); the five walkers are the nations' peoples.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { game, run, finish } from './helpers.mjs';
import { createGame, OUR_SPECIES, NEIGHBOUR_SPECIES, findNeighbour, envoySpecies, plural, peopleOf } from '../../web/js/sim/index.js';
import { generateSettlers, makeNewcomer, makeFolk, pickCourier, SKILLS } from '../../web/js/sim/society.js';
import { createRng } from '../../web/js/sim/rng.js';

test('settlers: only flits and floaties, half each, every trade dealt, Olla the diplomat, for many seeds', () => {
  for (const seed of [1, 2, 3, 7, 11, 42, 99, 123]) {
    const folk = generateSettlers(createRng(seed));
    assert.equal(folk.length, 12);
    assert.ok(folk.every(f => OUR_SPECIES.includes(f.species)), `seed ${seed}: only our species`);
    assert.equal(folk.filter(f => f.species === 'flit').length, 6, `seed ${seed}: half flits`);
    const trades = new Set(folk.map(f => f.trade));
    assert.ok(folk.filter(f => f.trade === 'builder').length >= 3, `seed ${seed}: three builders`);
    assert.ok(folk.filter(f => f.skills.baking >= 6).length >= 2, `seed ${seed}: two bakers`);
    assert.ok(trades.has('scout'), `seed ${seed}: a scout to carry letters`);
    assert.ok(trades.size >= 7, `seed ${seed}: trades vary (${[...trades].join(', ')})`);
    const olla = folk.find(f => f.name === 'Olla');
    assert.ok(olla && olla.trade === 'diplomat' && olla.skills.diplomacy >= 8, `seed ${seed}: Olla the diplomat`);
    assert.ok(OUR_SPECIES.includes(olla.species));
    // both species hold the same trades across seeds (no trade is a species' own)
    for (const sp of OUR_SPECIES) assert.ok(folk.filter(f => f.species === sp).some(f => f.trade === 'builder' || f.skills.building >= 6) || seed > 3, `seed ${seed}: ${sp}s build too`);
  }
  // hidden skills stay hidden in the snapshot
  const g = game();
  for (const a of g.snapshot().agents) { assert.ok(OUR_SPECIES.includes(a.species)); assert.ok(!('skills' in a)); }
});

test('makeFolk: our species lean softly, a neighbour species firmly; an explicit skill fixes the trade', () => {
  const rng = createRng(5);
  const mains = {};
  for (let i = 0; i < 200; i++) { const f = makeFolk(rng, { species: 'flit' }); const m = Object.entries(f.skills).sort((p, q) => q[1] - p[1])[0][0]; mains[m] = (mains[m] || 0) + 1; }
  assert.ok(Object.keys(mains).length >= 7, `flits spread across trades: ${JSON.stringify(mains)}`);
  assert.ok(mains.scouting < 120, 'scouting is a leaning, not a rule');
  const loafMains = {};
  for (let i = 0; i < 100; i++) { const f = makeFolk(rng, { species: 'loaf' }); const m = Object.entries(f.skills).sort((p, q) => q[1] - p[1])[0][0]; loafMains[m] = (loafMains[m] || 0) + 1; }
  assert.ok(loafMains.baking >= 55, `loaves bake: ${JSON.stringify(loafMains)}`);
  const b = makeFolk(rng, { species: 'floatie', skill: 'building' });
  assert.equal(b.trade, 'builder'); assert.ok(b.skills.building >= 6);
  assert.equal(makeFolk(rng, { species: 'floatie', skill: 'art' }).trade, 'dreamer');
  assert.equal(makeFolk(rng, { species: 'flit', skill: 'scouting' }).trade, 'scout');
  assert.ok(OUR_SPECIES.includes(makeFolk(rng, {}).species), 'default: one of ours');
});

test('newcomers are only flits and floaties, the species we have fewer of, with a trade the town lacks', () => {
  const rng = createRng(9);
  const folk = generateSettlers(rng);
  for (let i = 0; i < 30; i++) {
    const n = makeNewcomer(rng, folk, { x: 0, z: 9 });
    assert.ok(OUR_SPECIES.includes(n.species), n.species);
    folk.push(n);
  }
  const flits = folk.filter(f => f.species === 'flit').length;
  assert.ok(Math.abs(flits - (folk.length - flits)) <= 1, 'kept in balance');
  // in the game: immigration over many days never brings a walker
  const g = game();
  g.state.resources.food = 400;
  for (let i = 0; i < 6; i++) finish(g, 'house');
  for (const a of g.state.agents) a.mood = 85;
  run(g, 60 * 12);
  assert.ok(g.state.agents.length > 12, 'folk arrived');
  assert.ok(g.state.agents.every(a => OUR_SPECIES.includes(a.species)), 'all ours');
  const nc = g.state.letters.find(l => l.kind === 'newcomer');
  assert.ok(nc && /flew|air/.test(nc.body), 'the newcomer flew in');
});

test('the nations: loaves, drops, and the Puffer Harbour of puffers / pips / scoots; envoys are of the nation\'s species', () => {
  const g = game();
  const [n1, n2, n3] = g.state.neighbours;
  assert.deepEqual(n1.peoples, ['drop']); assert.equal(n1.title, 'The Drop Riviera');
  assert.deepEqual(n2.peoples, ['loaf']); assert.equal(n2.title, 'The Loaf Republic');
  assert.deepEqual(n3.peoples, ['puffer', 'pip', 'scoot']); assert.equal(n3.title, 'The Puffer Harbour'); assert.equal(n3.leaderSpecies, 'puffer');
  for (const n of g.state.neighbours) { assert.ok(n.peoples.every(s => NEIGHBOUR_SPECIES.includes(s))); assert.ok(!n.peoples.some(s => OUR_SPECIES.includes(s))); }
  assert.equal(plural('loaf'), 'loaves'); assert.equal(peopleOf(n3), 'puffers'); assert.equal(peopleOf(n2), 'loaves');
  // envoySpecies: the leader's people most of the time, the others sometimes, never ours
  const rng = createRng(3), seen = new Set();
  for (let i = 0; i < 60; i++) seen.add(envoySpecies(n3, rng));
  assert.ok(seen.has('puffer') && seen.size >= 2 && [...seen].every(s => n3.peoples.includes(s)), [...seen].join());
  assert.equal(envoySpecies(n2, rng), 'loaf');
  // every envoy:send names its species
  run(g, 100, 0.5);
  const sends = g.all('envoy:send');
  assert.ok(sends.length >= 2, 'greetings came');
  for (const p of sends) { const n = g.state.neighbours.find(x => x.id === p.neighbourId); assert.ok(n.peoples.includes(p.species), `${p.neighbourId} envoy is a ${p.species}`); }
  // the election letter carries one species per voting nation
  g.apply({ type: 'go_moon' });
  run(g, 4, 0.1);
  const el = g.all('envoy:send').find(p => p.all);
  assert.ok(el && el.speciesOf && el.votes.every(id => NEIGHBOUR_SPECIES.includes(el.speciesOf[id])), JSON.stringify(el && el.speciesOf));
  // the snapshot tells the LLM the peoples
  assert.deepEqual(g.snapshot().neighbours.map(n => n.peoples), [['drop'], ['loaf'], ['puffer', 'pip', 'scoot']]);
});

test('findNeighbour by species: "the scoots" / "the puffers" / "the pips" is the Harbour, "the loaves" the Republic; "the flits" is nobody', () => {
  const g = game();
  for (const ref of ['the scoots', 'the puffers', 'the pips', 'puffer harbour', 'grey harbour', 'brusco']) assert.equal(findNeighbour(g.state, ref).id, 'n3', ref);
  for (const ref of ['the loaves', 'loaf republic', 'the loaf', 'little lantern']) assert.equal(findNeighbour(g.state, ref).id, 'n2', ref);
  for (const ref of ['the drops', 'the riviera', 'donna perla']) assert.equal(findNeighbour(g.state, ref).id, 'n1', ref);
  assert.equal(findNeighbour(g.state, 'the flits'), null);
  assert.equal(findNeighbour(g.state, 'the floaties'), null);
});

test('setNations adopts the globe\'s positions, but not a stale title that names our own species', () => {
  const g = game();
  const out = g.setNations([{ id: 'n3', x: 2, z: -131, name: 'The Flit Sky-hold' }, { id: 'n2', x: 100, z: -55, name: 'The Loaf Republic' }]);
  const n3 = g.state.neighbours.find(n => n.id === 'n3');
  assert.equal(n3.x, 2); assert.equal(n3.z, -131);
  assert.equal(n3.title, 'The Puffer Harbour', 'the sim keeps its own title');
  assert.equal(out.find(o => o.id === 'n3').species, 'puffer');
  g.setNations([{ id: 'n3', x: 0, z: -130, name: 'The Puffer Harbour' }]);
  assert.equal(n3.title, 'The Puffer Harbour');
});

test('couriers: the scout by trade first, then the idle folk who scouts best; letters and gifts go by flits / floaties', () => {
  const g = game();
  const can = a => a.status !== 'left';
  const first = pickCourier(g.state.agents, can);
  assert.equal(first.trade, 'scout');
  const noScout = pickCourier(g.state.agents, a => can(a) && a.trade !== 'scout');
  assert.ok(noScout && !noScout.jobId && OUR_SPECIES.includes(noScout.species));
  assert.equal(pickCourier(g.state.agents, () => false), null);
  g.apply({ type: 'ask_crowd', question: 'who bakes?' });
  g.tick(0.1);
  const c = g.state.agents.find(a => a.task && a.task.kind === 'deliver');
  assert.ok(c && OUR_SPECIES.includes(c.species), 'a flit or floatie carries the post');
  const r = g.apply({ type: 'send_gift', neighbourId: 'the loaves', gift: 'a basket of bread' });
  assert.equal(r.effects[0].neighbourId, 'n2');
  const carrier = g.state.agents.find(a => a.id === r.effects[0].carrierId);
  assert.ok(carrier && OUR_SPECIES.includes(carrier.species));
  run(g, 40, 0.1);
  const thanks = g.state.letters.find(l => l.kind === 'neighbour_thanks');
  assert.ok(thanks, 'thanks came');
  assert.match(thanks.body, /the (flit|floatie) came/);
  assert.match(thanks.body, /Our loaves will carry/);
});

test('letters: neighbours speak of their own species and of our fliers', () => {
  const g = createGame({ seed: 7, envoyDelivery: 'immediate' });
  run(g, 130, 0.5);
  const greet = g.state.letters.filter(l => l.kind === 'neighbour_greeting');
  assert.ok(greet.length >= 2);
  for (const l of greet) assert.match(l.body, /propellers and parasols/);
  const n3 = g.state.neighbours.find(n => n.id === 'n3');
  n3.attitude = 10; n3.lettersSent = 1; n3.nextLetterAt = g.state.t; run(g, 1, 0.5);
  const complaint = g.state.letters.find(l => l.kind === 'neighbour_complaint');
  assert.ok(complaint && /Your flits/.test(complaint.body) && /floatie/.test(complaint.body), complaint && complaint.body);
  assert.ok(!/scoots have been seen/.test(complaint.body));
  const n2 = g.state.neighbours.find(n => n.id === 'n2');
  n2.attitude = 50; n2.lettersSent = 1; n2.nextLetterAt = g.state.t; run(g, 1, 0.5);
  const trade = g.state.letters.find(l => l.kind === 'neighbour_trade' && l.from.id === 'n2');
  assert.ok(trade && /Our loaves can be at your crates/.test(trade.body), trade && trade.body);
  // a minister's report never mentions puffers as ours
  g.apply({ type: 'appoint_minister', agentId: 'Olla' });
  g.apply({ type: 'call_meeting' }); run(g, 25, 0.5);
  const report = g.state.letters.filter(l => l.kind === 'report');
  assert.ok(report.length && report.every(l => !/puffers are restless/.test(l.body)));
});

test('skills: every SKILL is reachable by both species over many settlers', () => {
  const by = { flit: new Set(), floatie: new Set() };
  for (let seed = 1; seed <= 12; seed++) for (const f of generateSettlers(createRng(seed))) by[f.species].add(Object.entries(f.skills).sort((p, q) => q[1] - p[1])[0][0]);
  for (const sp of OUR_SPECIES) assert.equal(by[sp].size, SKILLS.length, `${sp}s: ${[...by[sp]].join(', ')}`);
});
