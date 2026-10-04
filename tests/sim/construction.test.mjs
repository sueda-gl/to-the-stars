import { test } from 'node:test';
import assert from 'node:assert/strict';
import { game, run } from './helpers.mjs';

test('a house goes from site to done with hauling and work events', () => {
  const g = game();
  const r = g.apply({ type: 'build', kind: 'house', at: { mode: 'center' } });
  assert.equal(r.ok, true, r.reason);
  const b = g.state.buildings[0];
  assert.equal(b.status, 'site');
  assert.equal(b.kind, 'house');
  assert.ok(Math.abs(b.x) < 2 && Math.abs(b.z - 2) < 2, 'in the middle');
  assert.equal(g.state.resources.wood, 30 - 8);
  assert.ok(b.workers.length >= 1, 'workers assigned');
  assert.ok(g.find('building:site'));
  run(g, 10, 0.1);
  assert.ok(g.find('agent:task', p => p.task.kind === 'haul' && p.task.carrying === 'crate'), 'someone hauls a crate');
  const statuses = new Set([b.status]);
  run(g, 20, 0.1); statuses.add(b.status);
  assert.ok(g.find('agent:task', p => p.task.kind === 'work'), 'someone works at the site');
  assert.ok(g.count('building:progress') > 0);
  run(g, 120, 0.1); statuses.add(b.status);
  assert.equal(b.status, 'done');
  assert.ok(statuses.has('building'), 'passed through building');
  assert.ok(g.find('building:done', p => p.building.id === b.id));
  assert.equal(b.workers.length, 0, 'construction crew released');
  assert.ok(g.state.agents.filter(a => a.homeId === b.id).length === 4, 'four folk moved in');
});

test('a pointed windmill lands where pointed and the mill gets a worker when done', () => {
  const g = game();
  const r = g.apply({ type: 'build', kind: 'windmill', at: { mode: 'pointer', x: 12, z: -4 } });
  assert.equal(r.ok, true);
  const b = g.state.buildings[0];
  assert.ok(Math.hypot(b.x - 12, b.z + 4) < 0.01);
  run(g, 150, 0.1);
  assert.equal(b.status, 'done');
  assert.ok(b.workers.length >= 1, 'production worker assigned');
});

test('explicit assignment is honoured and respects willingness', () => {
  const g = game();
  const builders = g.state.agents.filter(a => a.trade === 'builder');
  const r = g.apply({ type: 'build', kind: 'hut', at: { mode: 'auto' }, assign: [builders[0].id] });
  assert.equal(r.ok, true);
  const b = g.state.buildings[0];
  assert.deepEqual(b.workers, [builders[0].id]);
});

test('demolish refunds half and removes the building', () => {
  const g = game();
  g.apply({ type: 'build', kind: 'house', at: { mode: 'center' } });
  const b = g.state.buildings[0];
  const wood = g.state.resources.wood;
  const r = g.apply({ type: 'demolish', buildingId: b.id });
  assert.equal(r.ok, true);
  assert.equal(g.state.resources.wood, wood + 4);
  assert.equal(g.state.buildings.length, 0);
  assert.ok(g.find('building:remove', p => p.id === b.id));
  assert.ok(g.state.agents.every(a => a.jobId !== b.id));
});

test('validation: only the Assembly is stage-gated, a shortfall is a note not a wall, unknown type', () => {
  const g = game();
  assert.equal(g.apply({ type: 'build', kind: 'assembly', at: { mode: 'auto' } }).ok, false);
  g.state.resources.wood = 0;
  const r = g.apply({ type: 'build', kind: 'house', at: { mode: 'auto' } });
  assert.equal(r.ok, true, 'creation is never blocked on resources');
  assert.ok(r.effects.some(e => e.type === 'short' && /8 more wood/.test(e.detail)), JSON.stringify(r.effects));
  assert.equal(g.state.resources.wood, 0, 'the crates never go negative');
  assert.equal(g.state.resources.stone, 18, 'what the crates had is paid');
  assert.deepEqual(g.state.buildings[0].paidCost, { stone: 2 });
  assert.ok(g.state.letters.some(l => l.kind === 'ministry' && l.meta.kind === 'short'), 'the Ministry notes the shortfall');
  assert.equal(g.apply({ type: 'dance' }).ok, false);
  assert.equal(g.apply({ type: 'noop', why: 'could not map' }).ok, true);
});
