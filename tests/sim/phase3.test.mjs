// Phase 3: the noun of a request (the last audit), generalised creation (props, water, categories), §9 actions and
// events (gifts that travel, envoys, the election, the voyage, the moon), demo-friendliness, the snapshot.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { game, run, finish } from './helpers.mjs';
import { splitRequest, anchorFromTail, inferCategory } from '../../web/js/sim/parse.js';
import { pointInPoly, rectTouchesPoly } from '../../web/js/sim/geometry.js';
import { BAL } from '../../web/js/sim/society.js';

const lakeOf = g => g.state.water.find(w => w.kind === 'lake').poly;
const rectOf = b => ({ x: b.x, z: b.z, w: b.footprint.w, d: b.footprint.d });

// ---------- 1. the noun, not the tail ----------
test('kind:null resolves the noun only: location tails never pick the building', () => {
  const g = game();
  const cases = [
    ['a lighthouse near the house', null, 'lighthouse'],
    ['a lighthouse on the cliff', null, 'lighthouse'],
    ['a rubber duck in the lake', null, 'rubber duck'],
    ['a dragon statue in the square', null, 'dragon statue'],
    ['a bench by the windmill', null, 'bench'],
    ['a statue of a dragon in front of the house', null, 'statue of a dragon'],
    ['a giant lighthouse', null, 'giant lighthouse'],
    ['a tree next to the bakery', null, 'tree']
  ];
  for (const [req, , noun] of cases) {
    const r = g.apply({ type: 'build', kind: null, request: req, at: { mode: 'auto' } });
    assert.equal(r.ok, true, req + ': ' + r.reason);
    const e = r.effects[0];
    assert.equal(e.type, 'needsDesign', req + ' needs a design, got ' + e.type);
    assert.equal(e.noun, noun, req);
  }
  assert.equal(g.state.buildings.filter(b => b.kind === 'house').length, 0, 'no house was built by mistake');
  assert.equal(g.state.buildings.filter(b => b.kind === 'windmill' || b.kind === 'bakery').length, 0);
  // known nouns still resolve through the tail
  for (const [req, kind] of [['a house near the lake', 'house'], ['a wind mill over there', 'windmill'], ['a well in the middle', 'well'], ['put a bakery next to the windmill', 'bakery']]) {
    const r = g.apply({ type: 'build', kind: null, request: req, at: { mode: 'auto' } });
    assert.equal(r.ok, true, req + ': ' + r.reason);
    assert.equal(r.effects[0].kind, kind, req);
  }
  // an explicit, resolvable kind is trusted even with a misleading request
  const r = g.apply({ type: 'build', kind: 'well', request: 'a lighthouse near the house', at: { mode: 'auto' } });
  assert.equal(r.effects[0].kind, 'well');
});

test('splitRequest / anchorFromTail / inferCategory on the audit examples', () => {
  assert.deepEqual(splitRequest('Build a lighthouse on the cliff').noun, 'lighthouse');
  assert.equal(splitRequest('put a giant rubber duck there, in the lake').noun, 'giant rubber duck');
  assert.deepEqual(anchorFromTail('there, in the lake'), { mode: 'water', water: 'lake' });
  assert.deepEqual(anchorFromTail('on the cliff'), { mode: 'near', ref: 'edge' });
  assert.deepEqual(anchorFromTail('by the sea'), { mode: 'near', ref: 'edge' });
  assert.deepEqual(anchorFromTail('near the house'), { mode: 'near', ref: 'house' });
  assert.deepEqual(anchorFromTail('in the middle'), { mode: 'center' });
  assert.deepEqual(anchorFromTail('next to the duck'), { mode: 'near', ref: 'duck' });
  assert.equal(anchorFromTail('over there'), null);
  assert.equal(splitRequest('another one over there').another, true);
  assert.equal(splitRequest('one more').another, true);
  assert.equal(inferCategory('rubber duck'), 'prop');
  assert.equal(inferCategory('dragon statue'), 'landmark');
  assert.equal(inferCategory('lighthouse'), 'landmark');
  assert.equal(inferCategory('olive tree'), 'nature');
  assert.equal(inferCategory('bath house'), 'building');
});

// ---------- 2. generalised creation ----------
test('a duck is a free 2x2 prop that floats on the lake; the crew works from the shore', () => {
  const g = game();
  const res0 = { ...g.state.resources };
  const r = g.apply({ type: 'build', kind: null, request: 'a rubber duck in the lake', at: { mode: 'auto' } });
  assert.equal(r.ok, true, r.reason);
  const d = g.state.buildings[0];
  assert.equal(d.category, 'prop');
  assert.deepEqual(d.footprint, { w: 2, d: 2 });
  assert.equal(d.floating, true);
  assert.deepEqual(g.state.resources, res0, 'props are free');
  assert.ok(pointInPoly(d.x, d.z, lakeOf(g)), `on the lake at (${d.x}, ${d.z})`);
  assert.ok(d.workSpot && !pointInPoly(d.workSpot.x, d.workSpot.z, lakeOf(g)), 'the crew stands on the shore');
  assert.ok(r.effects[0].floating && r.effects[0].category === 'prop');
  run(g, 30, 0.1);
  assert.ok(d.progress > 0, 'built from the shore');
  for (const a of g.state.agents) assert.ok(!pointInPoly(a.x, a.z, lakeOf(g)), `${a.name} does not walk into the lake`);
  // a pointer into the lake with "in the lake": on the water near the pointer, not nudged to the shore
  const lake = lakeOf(g); const c = { x: lake.reduce((s, p) => s + p[0], 0) / lake.length, z: lake.reduce((s, p) => s + p[1], 0) / lake.length };
  const r2 = g.apply({ type: 'build', kind: null, request: 'a swan in the lake', at: { mode: 'pointer', x: c.x + 2, z: c.z } });
  assert.equal(r2.ok, true, r2.reason);
  const s = g.state.buildings[1];
  assert.ok(pointInPoly(s.x, s.z, lake), 'the swan floats too');
  assert.ok(Math.hypot(s.x - c.x - 2, s.z - c.z) < 4, 'near where pointed');
  // things that float go to the lake even without a tail; a known kind "in the lake" floats as well
  const r3 = g.apply({ type: 'build', kind: null, request: 'a little boat', at: { mode: 'auto' } });
  assert.ok(g.state.buildings[2].floating && pointInPoly(g.state.buildings[2].x, g.state.buildings[2].z, lake), 'a boat floats by itself');
  assert.ok(r3.ok);
  const g2 = game();
  const r4 = g2.apply({ type: 'build', kind: null, request: 'a hut in the lake', at: { mode: 'auto' } });
  assert.equal(r4.ok, true, r4.reason);
  assert.equal(r4.effects[0].kind, 'hut');
  assert.ok(g2.state.buildings[0].floating && pointInPoly(g2.state.buildings[0].x, g2.state.buildings[0].z, lakeOf(g2)), 'a hut in the lake floats (it is what was asked)');
  // at.mode 'water' is accepted directly, and the sea is a place too
  const r5 = g2.apply({ type: 'build', kind: null, request: 'a galleon', at: { mode: 'water', water: 'sea' } });
  assert.equal(r5.ok, true, r5.reason);
  const sea = g2.state.water.find(w => w.kind === 'sea').poly;
  assert.ok(pointInPoly(g2.state.buildings[1].x, g2.state.buildings[1].z, sea), 'the galleon is at sea');
  assert.ok(g2.state.buildings[1].z < g2.state.plot.z0, 'just off the plot');
});

test('on the cliff / by the sea land on the sea side; near the duck finds the duck; a dragon statue is a landmark', () => {
  const g = game();
  g.apply({ type: 'build', kind: null, request: 'a lighthouse on the cliff', at: { mode: 'auto' } });
  const lh = g.state.buildings[0];
  assert.ok(lh.z < -12, `on the cliff side (z=${lh.z})`);
  assert.equal(lh.category, 'landmark');
  g.apply({ type: 'build', kind: null, request: 'a hut by the sea', at: { mode: 'auto' } });
  assert.ok(g.state.buildings[1].z < -12, 'by the sea is the far edge');
  g.apply({ type: 'build', kind: null, request: 'a rubber duck', at: { mode: 'auto' } });
  const duck = g.state.buildings[2];
  g.apply({ type: 'build', kind: null, request: 'a bench next to the duck', at: { mode: 'auto' } });
  const bench = g.state.buildings[3];
  assert.ok(!bench.floating && Math.hypot(bench.x - duck.x, bench.z - duck.z) < 9, `the bench sits by the duck (${Math.hypot(bench.x - duck.x, bench.z - duck.z).toFixed(1)} away)`);
  assert.ok(!rectTouchesPoly(rectOf(bench), lakeOf(g), 0));
  const r = g.apply({ type: 'build', kind: null, request: 'a dragon statue in the square', at: { mode: 'auto' } });
  const dragon = g.state.buildings[4];
  assert.equal(dragon.category, 'landmark');
  assert.ok(Math.hypot(dragon.x - g.state.centre.x, dragon.z - g.state.centre.z) < 8, 'in the square = the middle');
  assert.equal(r.effects[0].name, 'Dragon Statue');
  // a generated landmark adds prosperity when raised
  const p0 = g.state.prosperity;
  dragon.progress = 1;
  g.designArrived(dragon.id, { id: 'dragon_statue', name: 'Dragon Statue', meta: { footprint: { w: 3, d: 3 }, cost: {} } });
  assert.equal(dragon.status, 'done');
  assert.ok(g.state.prosperity >= p0 + 25, `prosperity ${p0} -> ${g.state.prosperity}`);
  assert.equal(g.catalog.get('dragon_statue').category, 'landmark', 'the asset keeps the request\'s category');
});

test('"another one" repeats the last creation, pending designs included; the design lands on every sibling', () => {
  const g = game();
  g.apply({ type: 'build', kind: null, request: 'a rubber duck in the lake', at: { mode: 'auto' } });
  const r = g.apply({ type: 'build', kind: null, request: 'another one over there', at: { mode: 'pointer', x: 8, z: 8 } });
  assert.equal(r.ok, true, r.reason);
  assert.equal(g.state.buildings[1].requestKind, g.state.buildings[0].requestKind);
  assert.equal(g.state.buildings[1].noun, 'rubber duck');
  assert.equal(g.state.letters.filter(l => l.kind === 'ministry' && l.meta.kind === 'needs_design').length, 1, 'one plans letter, not two');
  // the LLM may also name the pending kind from the snapshot
  const r2 = g.apply({ type: 'build', kind: 'pending:rubber_duck', at: { mode: 'auto' } });
  assert.equal(r2.ok, true);
  assert.equal(g.state.buildings.length, 3);
  for (const b of g.state.buildings) b.progress = 1;
  g.designArrived(g.state.buildings[0].id, { id: 'rubber_duck', name: 'Rubber Duck', meta: { footprint: { w: 2, d: 2 }, cost: {}, category: 'prop' } });
  assert.ok(g.state.buildings.every(b => b.status === 'done' && b.kind === 'rubber_duck'), g.state.buildings.map(b => b.status).join(' '));
  // learned: "another duck" is now a known kind
  const r3 = g.apply({ type: 'build', kind: null, request: 'another duck', at: { mode: 'auto' } });
  assert.equal(r3.effects[0].kind, 'rubber_duck');
  const r4 = g.apply({ type: 'build', kind: 'house', at: { mode: 'auto' } });
  const r5 = g.apply({ type: 'build', kind: null, request: 'one more', at: { mode: 'auto' } });
  assert.equal(r5.effects[0].kind, 'house', 'one more = another house');
  assert.ok(r4.ok && r5.ok);
});

// ---------- 3. §9 actions and events ----------
test('send_gift: a courier walks the gift to the plot edge toward the nation, is away, and the thank-you comes by envoy', () => {
  const g = game();
  const n = g.state.neighbours.find(x => x.id === 'n2');
  const att0 = n.attitude;
  const r = g.apply({ type: 'send_gift', neighbourId: 'Little Lantern', gift: 'a basket of bread', give: { food: 5 } });
  assert.equal(r.ok, true, r.reason);
  const e = r.effects[0];
  assert.equal(e.type, 'gift'); assert.equal(e.neighbourId, 'n2'); assert.ok(e.carrierId, 'a carrier');
  assert.equal(g.state.resources.food, 55);
  const sent = g.all('gift:send')[0];
  assert.ok(sent && sent.neighbourId === 'n2' && sent.carrierId === e.carrierId && sent.gift === 'a basket of bread');
  assert.ok(sent.to.x > 20 && sent.to.z < 0, `exits toward Little Lantern (east, seaward): ${JSON.stringify(sent.to)}`);
  assert.ok(Math.abs(sent.to.x - 28.5) < 0.01, 'on the plot edge');
  const courier = g.state.agents.find(a => a.id === e.carrierId);
  assert.ok(['flit', 'floatie'].includes(courier.species), 'one of ours carries it');
  assert.equal(courier.trade, 'scout', 'the scout by trade carries first');
  assert.ok(g.find('agent:task', p => p.agentId === courier.id && p.task.carrying === 'gift' && p.task.kind === 'deliver'));
  run(g, 12, 0.1);
  assert.equal(courier.task.kind, 'journey', 'off the map');
  assert.ok(g.find('agent:task', p => p.agentId === courier.id && p.task.kind === 'journey' && p.task.away === true));
  assert.equal(g.count('gift:arrive'), 0);
  run(g, 25, 0.1);
  assert.equal(g.count('gift:arrive'), 1);
  assert.ok(g.find('gift:arrive', p => p.neighbourId === 'n2' && p.carrierId === courier.id));
  assert.ok(n.attitude >= att0 + 12, `attitude ${att0} -> ${n.attitude}`);
  const thanks = g.state.letters.find(l => l.kind === 'neighbour_thanks');
  assert.ok(thanks, 'a thank-you letter');
  assert.ok(g.find('envoy:send', p => p.letterId === thanks.id && p.neighbourId === 'n2'), 'it comes by envoy');
  run(g, 5, 0.1);
  assert.equal(thanks.delivered, true, 'landed by itself (no visual layer listening)');
  assert.equal(g.state.lastNeighbour, 'n2');
  run(g, 20, 0.1);
  assert.ok(courier.task === null || courier.task.kind !== 'journey', 'the courier is back');
  assert.ok(courier.x > g.state.plot.x0 && courier.x < g.state.plot.x1);
  // the gift is a story effect too: the envy letter's "send a gift" option goes through the same courier
  const g2 = game();
  const r2 = g2.apply({ type: 'send_gift', neighbourId: 'the puffers', gift: 'honey' });
  assert.equal(r2.effects[0].neighbourId, 'n3', 'the Puffer Harbour by its species');
  const r3 = g2.apply({ type: 'send_gift', gift: 'more honey' });
  assert.equal(r3.effects[0].neighbourId, 'n3', 'no neighbour named = the last one mentioned');
});

test('every neighbour letter is an envoy: envoy:send, then game.deliverLetter lands it; without a listener it lands by itself', () => {
  const g = game();
  g.on('envoy:send', () => {});
  run(g, 60, 0.1);
  const ev = g.all('envoy:send')[0];
  assert.ok(ev, 'the first greeting flew');
  assert.ok(ev.neighbourId && ev.letterId && ev.from && Number.isFinite(ev.enter.x) && Number.isFinite(ev.dir.x));
  const letter = g.state.letters.find(l => l.id === ev.letterId);
  assert.equal(letter.kind, 'neighbour_greeting');
  assert.equal(letter.delivered, false, 'waits for the visual layer');
  assert.equal(g.deliverLetter(letter.id), true);
  assert.equal(letter.delivered, true);
  assert.ok(g.find('letter:new', p => p.letter.id === letter.id));
  assert.equal(g.deliverLetter(letter.id), false, 'idempotent');
  assert.equal(g.state.lastNeighbour, letter.from.id);
  // the safety net: a letter nobody lands still arrives after envoyTimeout
  const before = g.state.letters.length;
  g.state.neighbours[2].nextLetterAt = g.state.t;
  run(g, 1, 0.1);
  const l2 = g.state.letters[before];
  assert.ok(l2 && l2.from.kind === 'neighbour');
  run(g, 20, 0.1);
  assert.equal(l2.delivered, false);
  run(g, 6, 0.1);
  assert.equal(l2.delivered, true, 'landed by the safety net');
  // no listener: by itself in 2.5 s
  const g2 = game();
  run(g2, 60, 0.1);
  const l3 = g2.state.letters.find(l => l.kind === 'neighbour_greeting');
  assert.ok(l3 && l3.delivered, 'landed by itself');
  assert.ok(g2.count('envoy:send') >= 1, 'the event is still emitted');
  const g3 = game({ envoyDelivery: 'immediate' });
  g3.on('envoy:send', () => {});
  run(g3, 60, 0.1);
  assert.ok(g3.state.letters.find(l => l.kind === 'neighbour_greeting').delivered, 'immediate option');
});

test('visit_neighbour and show are logged events; the nation remembers the visit', () => {
  const g = game();
  const r = g.apply({ type: 'visit_neighbour', neighbourId: 'the riviera' });
  assert.equal(r.ok, true, r.reason);
  assert.ok(g.find('neighbour:visit', p => p.neighbourId === 'n1' && p.x === -95 && p.z === -40));
  assert.equal(g.state.lastNeighbour, 'n1');
  assert.equal(g.state.neighbours[0].visits, 1);
  const s = g.apply({ type: 'show', target: 'globe' });
  assert.equal(s.ok, true);
  assert.ok(g.find('show', p => p.target === 'globe'));
  assert.equal(g.apply({ type: 'show', target: 'mars' }).ok, false);
  assert.equal(g.apply({ type: 'visit_neighbour', neighbourId: 'atlantis' }).ok, false);
});

test('go_moon when not elected: an election letter from all three within ~3 s, then voyage:start; moon actions; go_home', () => {
  const g = game();
  g.apply({ type: 'build', kind: 'house', at: { mode: 'center' } });
  assert.equal(g.state.story.elected, false);
  const r = g.apply({ type: 'go_moon' });
  assert.equal(r.ok, true);
  assert.equal(r.effects[0].type, 'election');
  assert.equal(g.apply({ type: 'moon', do: 'seed' }).ok, false, 'not on the moon yet');
  run(g, 3, 0.1);
  const el = g.state.letters.find(l => l.kind === 'election');
  assert.ok(el, 'the election letter was sent');
  assert.deepEqual(el.meta.votes, ['n1', 'n2', 'n3']);
  assert.ok(g.find('envoy:send', p => p.letterId === el.id && p.all === true && p.votes.length === 3), 'three envoys carry it');
  run(g, 3, 0.1);
  assert.equal(el.delivered, true, `landed within ~6 s of the word (t=${g.state.t.toFixed(1)})`);
  assert.ok(g.find('election', p => p.votes.length === 3));
  assert.equal(g.state.story.elected, true);
  assert.equal(g.count('voyage:start'), 1, 'the voyage starts after the letter');
  assert.equal(g.state.scene, 'moon');
  assert.ok(g.state.t < 7);
  // the moon
  assert.equal(g.apply({ type: 'go_moon' }).effects[0].already, true);
  assert.equal(g.apply({ type: 'send_gift', neighbourId: 'n1', gift: 'x' }).ok, false, 'no earthly gifts from the moon');
  run(g, 10, 0.1);
  const fc = g.state.letters.find(l => l.kind === 'shadeling' && l.meta.kind === 'first_contact');
  assert.ok(fc && fc.delivered, 'first contact on arrival');
  assert.equal(fc.from.id, 'moon');
  const greet = g.apply({ type: 'moon', do: 'greet', text: 'we come in peace' });
  assert.equal(greet.ok, true);
  assert.ok(g.find('moon:do', p => p.do === 'greet' && p.text === 'we come in peace'));
  const seed = g.apply({ type: 'moon', do: 'seed' });
  assert.equal(seed.effects[0].seeds, 1);
  run(g, 9, 0.1);
  const gl = g.state.letters.find(l => l.kind === 'shadeling' && l.meta.kind === 'greet');
  assert.ok(gl && gl.delivered && /peace/i.test(gl.body), 'they answered the greeting');
  const sl = g.state.letters.find(l => l.kind === 'shadeling' && l.meta.kind === 'seed');
  assert.ok(sl && sl.delivered, 'thanks for the seed');
  g.apply({ type: 'moon', do: 'golden_hour' });
  assert.equal(g.state.moon.golden, true);
  run(g, 6, 0.1);
  assert.ok(g.state.letters.some(l => l.kind === 'shadeling' && l.meta.kind === 'golden_hour' && l.delivered), 'golden hour letter');
  assert.equal(g.apply({ type: 'moon', do: 'dance' }).ok, false);
  const home = g.apply({ type: 'moon', do: 'go_home' });
  assert.equal(home.ok, true);
  assert.equal(g.count('voyage:home'), 1);
  assert.equal(g.state.scene, 'earth');
  assert.equal(g.state.story.returned, true);
  run(g, 12, 0.1);
  assert.ok(g.state.letters.some(l => l.kind === 'shadeling' && l.meta.kind === 'farewell' && l.delivered), 'a farewell');
  assert.ok(g.state.letters.some(l => l.kind === 'ministry' && l.meta.kind === 'homecoming'), 'the Ministry writes the homecoming letter ~10 s after');
  run(g, 8, 0.1);   // a courier carries it from wherever they were working (the camp's spots are a short walk from the tray)
  assert.ok(g.state.letters.some(l => l.kind === 'ministry' && l.meta.kind === 'homecoming' && l.delivered), 'the Ministry welcomes the envoy home');
  assert.equal(g.apply({ type: 'moon', do: 'seed' }).ok, false, 'back on earth');
  // elected: go_moon starts the voyage at once
  const r2 = g.apply({ type: 'go_moon' });
  assert.equal(r2.effects[0].type, 'voyage');
  assert.equal(g.count('voyage:start'), 2);
  // JSON-safe state and events
  JSON.stringify(g.state);
  for (const { p } of g.events_) JSON.stringify(p);
});

test('setScene(moon) brings the first contact at once; answering the election letter with yes departs', () => {
  const g = game();
  g.apply({ type: 'go_moon' });
  run(g, 2.6, 0.1);
  g.setScene('moon');
  run(g, 2.5, 0.1);
  assert.ok(g.state.letters.some(l => l.meta.kind === 'first_contact' && l.delivered));
  // a passive election: outshine the nations (or reach town) and the letter comes on its own; yes = go
  const g2 = game();
  g2.state.resources = { food: 300, wood: 400, stone: 400, coin: 100, goods: 50 };
  for (const k of ['house', 'house', 'house', 'farm', 'windmill', 'well', 'bakery', 'market', 'tavern', 'temple', 'tower', 'fountain']) finish(g2, k);
  run(g2, 300, 0.1);
  assert.ok(!g2.state.letters.some(l => l.kind === 'election'), 'no passive election before six minutes');
  run(g2, 80, 0.1);
  const el = g2.state.letters.find(l => l.kind === 'election');
  assert.ok(el && el.delivered, `elected on merit (stage ${g2.state.stage}, prosperity ${g2.state.prosperity})`);
  assert.equal(g2.count('voyage:start'), 0, 'but no voyage until asked');
  g2.apply({ type: 'reply_letter', letterId: el.id, decision: 'yes' });
  assert.equal(g2.count('voyage:start'), 1);
});

// ---------- 4. demo-friendliness ----------
test('free play for 15 minutes with no food production: letters, no strikes from hunger alone, nobody leaves', () => {
  for (const seed of [7, 11]) {
    const g = game({ seed });
    g.apply({ type: 'build', kind: 'house', at: { mode: 'center' } });
    g.apply({ type: 'build', kind: null, request: 'a lighthouse on the cliff', at: { mode: 'auto' } });
    run(g, 900, 0.1);
    assert.equal(g.state.agents.filter(a => a.status === 'left').length, 0, `seed ${seed}: nobody left`);
    assert.equal(g.count('agent:leave'), 0);
    assert.ok(g.state.hungry, 'the crates did empty (hunger is flavour)');
    assert.ok(g.state.letters.some(l => l.kind === 'complaint' && l.meta.reason === 'hunger'), 'hunger letters still happen');
    assert.ok(g.state.mood >= BAL.hungerFloor - 1, `mood floored at ${g.state.mood}`);
    assert.equal(g.state.agents.filter(a => a.status === 'striking').length, 0, `seed ${seed}: hunger alone does not strike`);
    assert.ok(g.state.buildings[0].status === 'done', 'the house got built');
  }
});

test('the crates last five minutes and the minister (or the Ministry) suggests a farm before hunger', () => {
  const g = game();
  run(g, 200, 0.1);
  assert.ok(!g.state.hungry, 'not hungry at 3.3 min');
  const s = g.state.letters.find(l => l.meta && l.meta.kind === 'suggest');
  assert.ok(s, 'a suggestion letter');
  assert.ok(s.options.some(o => /farm/i.test(o.label)) && s.options.some(o => /well/i.test(o.label)));
  assert.equal(s.from.kind, 'ministry');
  g.apply({ type: 'reply_letter', letterId: s.id, decision: 'yes' });
  assert.ok(g.state.buildings.some(b => b.kind === 'farm'), 'yes builds the farm');
  const g2 = game();
  g2.apply({ type: 'appoint_minister', agentId: 'Olla' });
  run(g2, 120, 0.1);
  const s2 = g2.state.letters.find(l => l.meta && l.meta.kind === 'suggest');
  assert.ok(s2 && s2.from.kind === 'minister', 'from the minister when there is one');
});

test('a thing nobody volunteers for is still raised: the Ministry presses someone into service', () => {
  const g = game();
  for (const a of g.state.agents) { a.mood = 30; a.loyalty = 50; a.energy = 40; a.traits = ['lazy']; }
  const r = g.apply({ type: 'build', kind: null, request: 'a tiny teapot', at: { mode: 'auto' } });
  assert.equal(r.ok, true);
  const b = g.state.buildings[0];
  run(g, 60, 0.1);
  assert.ok(b.workers.length >= 1, 'a crew was pressed');
  assert.ok(g.state.letters.some(l => l.kind === 'ministry' && l.meta.kind === 'conscripted'), 'and the Ministry said so');
  run(g, 120, 0.1);
  assert.equal(b.progress, 1, 'the teapot got built');
});

test('a ten-minute demo with eight creations reaches town (the Assembly unlocks)', () => {
  const g = game();
  const stages = []; g.on('stage', p => stages.push([Math.round(g.state.t), p.stage]));
  g.apply({ type: 'build', kind: 'house', at: { mode: 'center' } }); run(g, 40, 0.1);
  g.apply({ type: 'build', kind: 'windmill', at: { mode: 'pointer', x: 12, z: -4 } }); run(g, 20, 0.1);
  g.apply({ type: 'appoint_minister', agentId: 'Olla' });
  g.apply({ type: 'build', kind: null, request: 'a lighthouse on the cliff', at: { mode: 'auto' } });
  const lh = g.state.buildings.at(-1); run(g, 25, 0.1);
  g.designArrived(lh.id, { id: 'lighthouse', name: 'Lighthouse', meta: { footprint: { w: 4, d: 4 }, buildSeconds: 50 } });
  g.apply({ type: 'build', kind: null, request: 'a rubber duck in the lake', at: { mode: 'auto' } });
  const duck = g.state.buildings.at(-1); run(g, 8, 0.1);
  g.designArrived(duck.id, { id: 'rubber_duck', name: 'Rubber Duck', meta: { footprint: { w: 2, d: 2 }, cost: {}, category: 'prop' } });
  run(g, 40, 0.1);
  g.apply({ type: 'build', kind: null, request: 'a dragon statue in the square', at: { mode: 'auto' } });
  const dr = g.state.buildings.at(-1); run(g, 25, 0.1);
  g.designArrived(dr.id, { id: 'dragon_statue', name: 'Dragon Statue', meta: { footprint: { w: 3, d: 3 }, buildSeconds: 40 } });
  run(g, 60, 0.1);
  g.apply({ type: 'build', kind: 'farm', at: { mode: 'auto' } }); run(g, 30, 0.1);
  g.apply({ type: 'build', kind: 'bakery', at: { mode: 'near', ref: 'windmill' } }); run(g, 30, 0.1);
  g.apply({ type: 'build', kind: 'well', at: { mode: 'center' } });
  run(g, 600 - g.state.t, 0.1);
  assert.ok(g.state.buildings.every(b => b.status === 'done'), g.state.buildings.map(b => `${b.name}:${b.status}`).join(', '));
  assert.ok(['town', 'civilisation'].includes(g.state.stage), `stage ${g.state.stage}, prosperity ${g.state.prosperity}, stages ${JSON.stringify(stages)}`);
  assert.ok(g.catalog.unlocked(g.state.stage).includes('assembly'));
  assert.ok(stages[0][1] === 'hamlet' && stages[0][0] <= 120, 'a hamlet within two minutes: ' + JSON.stringify(stages));
});

// ---------- 5. snapshot ----------
test('snapshot carries scene, elected, lastNeighbour, the last 3 creations with positions, and stays compact', () => {
  const g = game();
  g.apply({ type: 'build', kind: 'house', at: { mode: 'center' } });
  g.apply({ type: 'build', kind: null, request: 'a rubber duck in the lake', at: { mode: 'auto' } });
  g.apply({ type: 'build', kind: null, request: 'a dragon statue', at: { mode: 'auto' } });
  g.apply({ type: 'build', kind: 'well', at: { mode: 'auto' } });
  g.apply({ type: 'send_gift', neighbourId: 'n2', gift: 'bread' });
  const s = g.snapshot();
  assert.equal(s.scene, 'earth');
  assert.equal(s.elected, false);
  assert.equal(s.lastNeighbour, 'n2');
  assert.equal(s.creations.length, 3);
  assert.deepEqual(s.creations.map(c => c.name), ['Rubber Duck', 'Dragon Statue', 'Well']);
  assert.ok(s.creations[0].onWater === true && s.creations[0].kind === 'pending:rubber_duck' && Number.isFinite(s.creations[0].x));
  assert.ok(s.neighbours[0].title === 'The Drop Riviera');
  assert.ok(!('moon' in s), 'no moon block on earth before the voyage');
  const json = JSON.stringify(s);
  assert.ok(json.length < 6000, `compact: ${json.length} chars`);
  assert.deepEqual(JSON.parse(json), s);
  g.apply({ type: 'go_moon' }); run(g, 8, 0.1);
  const s2 = g.snapshot();
  assert.equal(s2.scene, 'moon'); assert.equal(s2.elected, true);
  assert.deepEqual(s2.moon, { seeds: 0, golden: false, greeted: 0, home: false });
});

test('trade takes the server schema\'s [{res, n}] bundles and remembers the neighbour', () => {
  const g = game();
  const n = g.state.neighbours[1];
  const r = g.apply({ type: 'trade', neighbourId: 'loaf republic', give: [{ res: 'wood', n: 5 }], get: [{ res: 'food', n: 8 }, { res: 'gold', n: 9 }] });
  assert.equal(r.ok, true, r.reason);
  assert.equal(g.state.resources.wood, 25);
  assert.equal(g.state.resources.food, 68);
  assert.equal(g.state.lastNeighbour, n.id);
});
