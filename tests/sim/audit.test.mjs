// Regressions from the round-1 adversarial audit: stuck resumed workers, orphaned sites, trade/reply validation,
// idempotent designArrived, rescued courier letters, garbage asset meta, per-game ids, snapshot `recent`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { game, run } from './helpers.mjs';
import { createGame } from '../../web/js/sim/index.js';

const crewOf = (g, b) => b.workers.map(id => g.state.agents.find(a => a.id === id));

test('a crew resumes hammering after a meeting (no frozen work task)', () => {
  const g = game();
  g.apply({ type: 'build', kind: 'windmill', at: { mode: 'pointer', x: 12, z: -4 } });
  const b = g.state.buildings[0];
  run(g, 20, 0.1);
  assert.equal(b.status, 'building');
  g.apply({ type: 'call_meeting' });
  run(g, 25, 0.1);                                   // meeting lasts 20 s
  const p0 = b.progress;
  run(g, 60, 0.1);
  assert.ok(b.progress > p0 + 0.1, `progress stalled at ${p0}`);
  assert.ok(!g.state.agents.some(a => a.task && a.task.kind === 'work' && !a.task.arrived), 'no work task without arrived');
});

test('the scout on a crew goes back to work after a courier run', () => {
  const g = game();
  const scout = g.state.agents.find(a => a.trade === 'scout');   // the courier by trade (every flit and floatie flies; the scout carries first)
  g.apply({ type: 'build', kind: 'hut', at: { mode: 'center' }, assign: [scout.id] });
  const b = g.state.buildings[0];
  run(g, 15, 0.1);
  g.apply({ type: 'ask_crowd', question: 'who bakes?' });   // the scout becomes the courier
  run(g, 15, 0.1);
  const p0 = b.progress;
  run(g, 120, 0.1);
  assert.ok(b.progress > p0 + 0.1 || b.status === 'done', `hut stuck at ${p0}`);
});

test('production workers resume after a meeting', () => {
  const g = game();
  const spot = g.findSpot('farm', null); const b = g.placeBuilding('farm', spot); g.completeBuilding(b);
  run(g, 30, 0.1);
  g.apply({ type: 'call_meeting' });
  run(g, 30, 0.1);
  run(g, 30, 0.1);
  assert.ok(g.state.rates[b.id] && g.state.rates[b.id].food > 0, 'farm produces again');
  assert.ok(crewOf(g, b).every(a => a.task && a.task.kind !== 'gather' && a.task.kind !== 'meeting'));
});

test('an unstaffed site is crewed once folk free up', () => {
  const g = game();
  g.state.resources = { food: 400, wood: 400, stone: 400, coin: 400, goods: 0 };
  for (const k of ['house', 'farm', 'bakery', 'quarry', 'windmill', 'house', 'farm', 'well']) g.apply({ type: 'build', kind: k, at: { mode: 'auto' } });
  assert.equal(g.state.buildings.length, 8);
  run(g, 240, 0.1);
  const open = g.state.buildings.filter(b => b.status !== 'done');
  assert.ok(open.every(b => b.workers.length > 0), 'every unfinished site has a crew: ' + open.map(b => `${b.kind}:${b.workers.length}`).join(' '));
  run(g, 240, 0.1);
  assert.ok(g.state.buildings.every(b => b.status === 'done'), g.state.buildings.map(b => `${b.kind}:${b.status}`).join(' '));
});

test('quiet restaffing emits no agent:refuse spam', () => {
  const g = game();
  g.state.resources = { food: 400, wood: 400, stone: 400, coin: 400, goods: 0 };
  for (let i = 0; i < 10; i++) g.apply({ type: 'build', kind: 'hut', at: { mode: 'auto' } });
  const n0 = g.count('agent:refuse');
  run(g, 60, 0.1);
  assert.ok(g.count('agent:refuse') - n0 <= 2, 'refuse events after placement: ' + (g.count('agent:refuse') - n0));
});

test('trade accepts only real resources, whole positive amounts, within caps', () => {
  const g = game();
  const n = g.state.neighbours[0]; n.attitude = 60;
  const r1 = g.apply({ type: 'trade', neighbourId: n.id, give: { wood: -500 }, get: { food: -5 } });
  assert.equal(r1.ok, false);
  assert.deepEqual(g.state.resources, { food: 60, wood: 30, stone: 20, coin: 10, goods: 0 });
  const r2 = g.apply({ type: 'trade', neighbourId: n.id, give: { wood: 5 }, get: { gold: 999, food: 1e9 } });
  assert.equal(r2.ok, true);
  assert.equal(g.state.resources.wood, 25);
  assert.equal(g.state.resources.food, 120);          // food cap
  assert.equal('gold' in g.state.resources, false);
  const r3 = g.apply({ type: 'trade', neighbourId: n.id, give: { wood: 'lots' }, get: {} });
  assert.equal(r3.ok, false);
});

test('reply_letter with an unknown id does not resolve another letter', () => {
  const g = game();
  g.apply({ type: 'ask_crowd', question: 'who bakes?' });
  run(g, 10, 0.1);
  const r = g.apply({ type: 'reply_letter', letterId: 'l999', decision: 'yes' });
  assert.equal(r.ok, false);
  assert.ok(g.state.letters.every(l => !l.resolved));
  const r2 = g.apply({ type: 'reply_letter', decision: 'yes' });   // no id: the latest open letter
  assert.equal(r2.ok, true);
  assert.equal(g.state.letters.filter(l => l.resolved).length, 1);
});

test('snapshot lists opened-but-unresolved letters under recent', () => {
  const g = game();
  g.apply({ type: 'ask_crowd', question: 'who bakes?' });
  run(g, 10, 0.1);
  const id = g.snapshot().unread[0].id;
  assert.equal(g.markRead(id), true);
  const s = g.snapshot();
  assert.ok(!s.unread.some(l => l.id === id));
  assert.ok(s.recent.some(l => l.id === id));
  g.apply({ type: 'reply_letter', letterId: id, decision: 'yes' });
  assert.ok(!(g.snapshot().recent || []).some(l => l.id === id));
});

test('designArrived is idempotent', () => {
  const g = game();
  g.apply({ type: 'build', kind: null, request: 'a lighthouse', at: { mode: 'center' } });
  const b = g.state.buildings[0];
  b.progress = 1;
  const asset = { id: 'lighthouse', name: 'Lighthouse', meta: { footprint: { w: 4, d: 4 }, buildSeconds: 30 } };
  g.designArrived(b.id, asset);
  g.designArrived(b.id, asset);
  g.designArrived(b.id, { ...asset });
  assert.equal(g.count('building:done'), 1);
  assert.equal(g.all('letter:sent').length + g.state.pendingLetters.length >= 1, true);
  assert.equal(g.state.letters.filter(l => l.kind === 'ministry' && /plans|design|drawn/i.test(l.subject + l.body)).length <= 2, true);
});

test('letters in a striking courier\'s bag still land', () => {
  const g = game();
  const scout = g.state.agents.find(a => a.trade === 'scout');
  g.apply({ type: 'ask_crowd', question: 'who bakes?' });
  g.tick(0.1);
  assert.equal(scout.task.kind, 'deliver');
  const ids = scout.task.letterIds.slice();
  scout.mood = 5; scout.loyalty = 5; g.tick(0.1);
  assert.equal(scout.status, 'striking');
  run(g, 10, 0.1);
  for (const id of ids) assert.equal(g.state.letters.find(l => l.id === id).delivered, true, id + ' delivered');
});

test('catalog.add coerces garbage meta', () => {
  const g = game();
  const e = g.catalog.add({ id: 'thing', name: '', meta: { perDay: null, cost: null, buildSeconds: 0, footprint: { w: 'x' }, workers: 99, skill: 'magic', housing: -3, stage: 'nope' }, aliases: [1, null, 'A Thing'] });
  assert.deepEqual(e.perDay, {});
  assert.deepEqual(e.footprint, { w: 5, d: 5 });
  assert.equal(e.buildSeconds, 70);
  assert.equal(e.workers, 6);
  assert.equal(e.skill, 'building');
  assert.equal(e.housing, 0);
  assert.equal(e.stage, 'camp');
  assert.deepEqual(e.aliases, ['a thing']);
  assert.ok(e.cost.wood > 0 || e.cost.stone > 0);
  const r = g.apply({ type: 'build', kind: 'thing', at: { mode: 'center' } });
  assert.equal(r.ok, true);
  g.state.buildings[0].progress = 1;
  run(g, 5, 0.1);
  assert.equal(g.state.buildings[0].status, 'done');
  run(g, 5, 0.1);                                      // staffBuilding ran without throwing
});

test('build with an unresolvable kind asks for that kind, not "something new"', () => {
  const g = game();
  const r = g.apply({ type: 'build', kind: 'zzz', at: { mode: 'center' } });
  assert.equal(r.ok, true);
  assert.equal(r.effects[0].request, 'zzz');
  assert.equal(g.state.buildings[0].request, 'zzz');
});

test('two games in one page keep their own folk and letter ids', () => {
  const a = createGame({ seed: 1 }); const b = createGame({ seed: 2 });
  a.apply({ type: 'ask_crowd', question: 'who bakes?' }); b.apply({ type: 'ask_crowd', question: 'who bakes?' });
  assert.deepEqual(a.state.letters.map(l => l.id), ['l1', 'l2', 'l3']);
  assert.deepEqual(b.state.letters.map(l => l.id), ['l1', 'l2', 'l3']);
  a.apply({ type: 'ask_crowd', question: 'who farms?' });
  assert.deepEqual(a.state.letters.map(l => l.id), ['l1', 'l2', 'l3', 'l4', 'l5', 'l6']);
  assert.deepEqual(a.state.agents.map(x => x.id), b.state.agents.map(x => x.id));
  assert.equal(a.state.agents[0].id, 'f1');
});
