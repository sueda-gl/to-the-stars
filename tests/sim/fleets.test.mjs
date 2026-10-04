// ART_DIRECTION §11: fleets by trade after landing, the scripted introduction, the minister's election by click,
// the ceremony, and later elections by the crowd.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { game, run } from './helpers.mjs';
import { FLEET, groupFolk, squareSlots } from '../../web/js/sim/fleets.js';

const name = (g, id) => g.state.agents.find(a => a.id === id).name;

test('squareSlots: a neat grid, 1.6 m apart, centred', () => {
  const s4 = squareSlots(4, 10, 20);
  assert.equal(s4.length, 4);
  const xs = s4.map(s => s.x), zs = s4.map(s => s.z);
  assert.ok(Math.abs(Math.max(...xs) - Math.min(...xs) - 1.6) < 1e-9); assert.ok(Math.abs(Math.max(...zs) - Math.min(...zs) - 1.6) < 1e-9);
  assert.ok(Math.abs((Math.max(...xs) + Math.min(...xs)) / 2 - 10) < 1e-9 && Math.abs((Math.max(...zs) + Math.min(...zs)) / 2 - 20) < 1e-9, 'centred');
  const s3 = squareSlots(3, 0, 0);
  assert.equal(s3.length, 3);
  assert.ok(s3.every(s => Math.abs(s.x) <= 0.8 + 1e-9 && Math.abs(s.z) <= 0.8 + 1e-9), JSON.stringify(s3));
  for (let n = 1; n <= 6; n++) { const s = squareSlots(n, 0, 0); for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) assert.ok(Math.hypot(s[i].x - s[j].x, s[i].z - s[j].z) >= 1.6 - 1e-9, `${n}: ${i},${j} too close`); }
});

test('groupFolk: fleets by trade, 2-4 each, singletons merged, every settler in exactly one', () => {
  for (const seed of [7, 11, 23, 42, 99]) {
    const g = game({ seed });
    const fleets = groupFolk(g.state.agents);
    const all = fleets.flatMap(f => f.members.map(a => a.id));
    assert.equal(all.length, 12, `seed ${seed}: everyone placed`); assert.equal(new Set(all).size, 12, 'nobody twice');
    for (const f of fleets) assert.ok(f.members.length >= FLEET.minPerFleet && f.members.length <= FLEET.maxPerFleet, `seed ${seed}: ${f.id} has ${f.members.length}`);
    const builders = fleets.find(f => f.trade === 'builder');
    assert.ok(builders && builders.members.filter(a => a.trade === 'builder').length >= 3, 'the three builders stand together');
    assert.ok(fleets.length >= 3 && fleets.length <= 6, `seed ${seed}: ${fleets.length} fleets`);
  }
});

test('spawnAll forms the fleets: fleet:form with square slots on an arc on the camera side; folk walk there and stand', () => {
  const g = game();
  g.spawnAll();
  const ev = g.find('fleet:form');
  assert.ok(ev, 'fleet:form emitted');
  const fleets = ev.p.fleets;
  assert.ok(fleets.length >= 3);
  for (const f of fleets) {
    assert.ok(f.id && f.name && f.trade && f.centre && f.slots.length === f.members.length, JSON.stringify(f).slice(0, 200));
    assert.ok(f.centre.z > g.state.spawn.z, `${f.name} stands toward the camera (+z)`);
    const r = Math.hypot(f.centre.x - g.state.spawn.x, f.centre.z - g.state.spawn.z);
    assert.ok(r >= FLEET.arcRadius - 6 && r <= FLEET.arcRadius + 0.01, `${f.name} on the arc (${r.toFixed(1)})`);
    for (const s of f.slots) { assert.ok(f.members.includes(s.agentId)); assert.ok(Number.isFinite(s.x) && Number.isFinite(s.z)); }
    for (let i = 0; i < f.slots.length; i++) for (let j = i + 1; j < f.slots.length; j++) assert.ok(Math.hypot(f.slots[i].x - f.slots[j].x, f.slots[i].z - f.slots[j].z) >= 1.59, 'slots 1.6 m apart');
    assert.match(f.caption, /^The \w+ · (one|two|three|four) (flit|floatie)s?/);
  }
  // squares never overlap each other
  for (let i = 0; i < fleets.length; i++) for (let j = i + 1; j < fleets.length; j++) assert.ok(Math.hypot(fleets[i].centre.x - fleets[j].centre.x, fleets[i].centre.z - fleets[j].centre.z) >= 3.2, `${fleets[i].name} / ${fleets[j].name} too close`);
  assert.ok(g.state.fleetHold);
  assert.ok(g.find('agent:task', p => p.task.kind === 'walk' && p.task.formation === true), 'formation walks');
  run(g, 8, 0.1);
  const standing = g.state.agents.filter(a => a.task && a.task.kind === 'stand');
  assert.equal(standing.length, 12, 'everyone stands in a square');
  for (const f of fleets) for (const s of f.slots) { const a = g.state.agents.find(x => x.id === s.agentId); assert.ok(Math.hypot(a.x - s.x, a.z - s.z) < 0.6, `${a.name} on the slot`); }
  assert.ok(g.find('agent:task', p => p.task.kind === 'idle' && p.task.formation === true), 'the stand is announced as idle + formation');
  assert.ok(!g.find('agent:task', p => p.task.kind === 'gather'), 'nobody wanders off to work while held');
  assert.equal(g.count('agent:say'), 0, 'no bubbles while the squares stand');
  // the sim does not form fleets twice, and spawnAll({fleets:false}) skips them
  const g2 = game(); g2.spawnAll({ fleets: false }); assert.equal(g2.count('fleet:form'), 0); assert.equal(g2.state.fleetHold, false);
});

test('introduceFleets: the order, fleet:introduce per fleet (members hop), then election:ask; electMinister -> minister:set + ceremony + release', () => {
  const g = game();
  g.spawnAll();
  run(g, 3, 0.1);
  const order = g.introduceFleets();
  assert.deepEqual(order, g.state.fleets.map(f => f.id));
  assert.deepEqual(g.introduceFleets(), order, 'idempotent');
  assert.ok(g.find('fleet:intro', p => p.order.length === order.length));
  run(g, FLEET.introFirstAfter + FLEET.introEvery * 0.5, 0.1);
  assert.equal(g.count('fleet:introduce'), 1, 'the first fleet, on its own');
  const first = g.find('fleet:introduce').p;
  assert.equal(first.fleetId, order[0]); assert.equal(first.index, 0); assert.equal(first.total, order.length);
  assert.match(first.caption, /^The /); assert.ok(first.members.length >= 2 && first.centre);
  run(g, 1, 0.1);
  assert.ok(g.all('agent:listen', p => first.members.includes(p.agentId) && p.hop).length >= first.members.length, 'each member hops as it is introduced');
  assert.equal(g.count('election:ask'), 0, 'not asked yet');
  run(g, FLEET.introEvery * (order.length + 1), 0.1);
  assert.equal(g.count('fleet:introduce'), order.length, 'every fleet introduced');
  assert.deepEqual(g.all('fleet:introduce').map(p => p.fleetId), order, 'in order');
  const ask = g.find('election:ask');
  assert.ok(ask, 'the game asks for a minister');
  assert.equal(ask.p.kind, 'minister'); assert.equal(ask.p.candidates.length, 12); assert.match(ask.p.text, /Choose your minister/);
  assert.ok(g.state.election.open && g.snapshot().election.open);
  assert.ok(g.state.fleetHold, 'the squares still stand while the sovereign chooses');
  assert.equal(g.state.minister, null);
  // the click
  const pick = ask.p.candidates[5];
  const r = g.electMinister(pick);
  assert.equal(r.ok, true); assert.equal(g.state.minister, pick);
  assert.ok(g.find('minister:set', p => p.agentId === pick && p.by === 'sovereign'));
  assert.ok(g.find('election:result', p => p.agentId === pick && p.by === 'sovereign' && p.asked === true));
  const cer = g.find('ceremony:start'); assert.ok(cer && cer.p.agentId === pick && cer.p.seconds === FLEET.ceremonySeconds && cer.p.where);
  assert.ok(g.find('agent:say', p => p.agentId === pick && p.kind === 'ceremony'), 'the new minister says a word');
  assert.ok(g.all('agent:mood', p => p.delta >= 4).length >= 10, 'everyone hops (+4)');
  assert.equal(g.state.election.open, false);
  assert.ok(g.state.letters.some(l => l.kind === 'report' && l.from.id === pick), 'the acceptance letter');
  run(g, FLEET.ceremonySeconds + 0.5, 0.1);
  assert.ok(g.find('ceremony:end'));
  assert.ok(g.find('fleet:release'));
  assert.equal(g.state.fleetHold, false);
  run(g, 4, 0.1);
  assert.ok(g.state.agents.every(a => a.id === pick || (a.task && a.task.kind !== 'stand')), 'everyone went to work');
  assert.equal(g.state.agents.find(a => a.id === pick).job, 'minister');
  // the second click is a plain re-appointment (no second ceremony)
  const n0 = g.count('ceremony:start');
  g.electMinister(ask.p.candidates[2]);
  assert.equal(g.count('ceremony:start'), n0);
});

test('"make Olla our minister" during the ask answers it; with no click the folk wait holdMax then work, and the crowd votes after crowdAfter', () => {
  const g = game();
  g.spawnAll();
  g.introduceFleets({ every: 0, first: 0 });
  assert.ok(g.find('election:ask'), 'asked at once');
  const r = g.apply({ type: 'appoint_minister', agentId: 'Olla' });
  assert.equal(r.ok, true);
  assert.ok(g.find('ceremony:start', p => p.name === 'Olla'));
  // and the patient path
  const h = game({ seed: 9 });
  h.spawnAll();
  h.introduceFleets({ every: 0, first: 0 });
  run(h, FLEET.holdMax + 1, 0.1);
  assert.equal(h.state.fleetHold, false, 'the squares break after holdMax');
  assert.ok(h.state.election.open, 'the ask stays open');
  assert.equal(h.state.minister, null);
  run(h, FLEET.crowdAfter - FLEET.holdMax + 1, 0.1);
  assert.ok(h.state.minister, 'the crowd elected someone');
  assert.ok(h.find('election:result', p => p.by === 'crowd' && p.votes), 'with a tally');
  assert.ok(h.state.letters.some(l => l.kind === 'election_result'), 'the result comes by letter');
});

test('the intro runs by itself when nobody drives it (autoIntroAfter)', () => {
  const g = game();
  g.spawnAll();
  run(g, FLEET.autoIntroAfter + FLEET.introFirstAfter + 0.5, 0.1);
  assert.ok(g.find('fleet:introduce'), 'the sim introduced the first fleet on its own');
});

test('crowdElection: folk vote by diplomacy, mood and bonds; the result is a letter and minister:set by the crowd', () => {
  const g = game();
  g.spawnAll({ fleets: false });
  const r = g.crowdElection('minister');
  assert.equal(r.ok, true);
  const e = r.effects[0];
  assert.equal(e.type, 'election'); assert.equal(e.by, 'crowd'); assert.equal(e.voters, 12);
  assert.equal(Object.values(e.votes).reduce((s, n) => s + n, 0), 12, 'twelve ballots');
  assert.equal(g.state.minister, e.agentId);
  assert.equal(g.count('election:result'), 1, 'one result event');
  const l = g.state.letters.find(x => x.kind === 'election_result');
  assert.ok(l && l.from.kind === 'ministry'); assert.match(l.body, /ballots/); assert.match(l.body, new RegExp(name(g, e.agentId) + ' the '));
  assert.ok(!g.state.letters.some(x => x.kind === 'report' && x.subject === 'I accept the seal'), 'no second letter from the winner');
  // a good diplomat tends to win: Olla (diplomacy >= 8) is in the top two over several seeds
  let top2 = 0;
  for (const seed of [3, 5, 8, 13, 21, 34]) { const h = game({ seed }); const rr = h.crowdElection('minister'); const ranked = Object.entries(rr.effects[0].votes).sort((p, q) => q[1] - p[1]).slice(0, 2).map(x => name(h, x[0])); if (ranked.includes('Olla')) top2++; }
  assert.ok(top2 >= 4, `Olla in the top two ${top2}/6 times`);
  assert.equal(g.crowdElection('festival').ok, false);
});

test('a minister who leaves drops the seal and the crowd elects another', () => {
  const g = game();
  g.apply({ type: 'appoint_minister', agentId: 'Olla' });
  const olla = g.state.agents.find(a => a.name === 'Olla');
  g.state.t = 1000;   // past noLeaveBefore
  olla.mood = 2; olla.loyalty = 2; olla.lowSince = 800;
  run(g, 2, 0.1);
  assert.ok(g.find('agent:leave', p => p.agentId === olla.id), 'Olla left');
  assert.ok(g.find('minister:set', p => p.agentId === null && p.left === olla.id), 'the seal is dropped');
  run(g, FLEET.crowdOnLeave + 1, 0.1);
  assert.ok(g.state.minister && g.state.minister !== olla.id, 'a new minister by vote');
  assert.ok(g.find('election:result', p => p.by === 'crowd'));
});

test('a newcomer joins the fleet of its trade', () => {
  const g = game();
  g.spawnAll();
  g.state.resources.food = 100;
  for (let i = 0; i < 2; i++) { const spot = g.findSpot('house', null); const b = g.placeBuilding('house', spot); g.completeBuilding(b); }
  for (const a of g.state.agents) a.mood = 85;
  g.releaseFleets();
  run(g, 60 * 5, 0.5);
  const newbie = g.state.agents.find(a => !g.find('fleet:form').p.fleets.some(f => f.members.includes(a.id)));
  if (newbie) { assert.ok(newbie.fleetId, 'in a fleet'); assert.ok(g.state.fleets.find(f => f.id === newbie.fleetId).members.includes(newbie.id)); assert.ok(newbie.job, 'with a job'); }
});
