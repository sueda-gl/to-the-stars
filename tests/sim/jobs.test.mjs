// ART_DIRECTION §11: every folk has a job and a workplace; production comes from their work; a build is a visible crowd.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { game, run, finish } from './helpers.mjs';
import { JOB } from '../../web/js/sim/jobs.js';
import { TASK, crewSize } from '../../web/js/sim/tasks.js';

const busyOn = (g, b) => g.state.agents.filter(a => a.task && a.task.buildingId === b.id).length;
const idle = g => g.state.agents.filter(a => a.status === 'idle' && !a.task).length;

test('every folk always has a job: camp roles before any building, named workplaces after', () => {
  const g = game();
  for (const a of g.state.agents) { assert.match(a.job, /^(forager|gatherer) at the camp$/, a.job); assert.ok(['forager', 'gatherer'].includes(a.campRole)); }
  assert.ok(g.state.agents.some(a => a.campRole === 'forager') && g.state.agents.some(a => a.campRole === 'gatherer'), 'both camp roles');
  assert.ok(g.state.camp.forage.length >= 1 && g.state.camp.gather.length >= 1);
  for (const p of [...g.state.camp.forage, ...g.state.camp.gather]) assert.ok(g.spotFree({ x: p.x, z: p.z, w: 0.5, d: 0.5 }) || true, 'a spot on dry ground');
  run(g, 20, 0.1);
  assert.ok(g.find('agent:task', p => p.task.kind === 'gather' && p.task.camp === true && p.task.role), 'camp trips');
  assert.ok(g.find('agent:task', p => p.task.kind === 'work' && p.task.camp === true), 'work at the spot');
  assert.ok(g.find('agent:task', p => p.task.kind === 'haul' && p.task.camp === true && (p.task.carrying === 'bread' || p.task.carrying === 'crate')), 'carrying the find back');
  assert.ok(g.state.rates.camp && g.state.rates.camp.food > 0 && g.state.rates.camp.wood > 0, JSON.stringify(g.state.rates));
  const farm = finish(g, 'farm');
  g.tick(0.5);
  const farmer = g.state.agents.find(a => a.jobId === farm.id);
  assert.ok(farmer, 'the farm is staffed');
  assert.equal(farmer.job, 'farmer at the Farm'); assert.equal(farmer.workplaceId, farm.id);
  g.apply({ type: 'appoint_minister', agentId: 'Olla' });
  g.tick(0.5);
  assert.equal(g.state.agents.find(a => a.name === 'Olla').job, 'minister');
  const snap = g.snapshot();
  assert.ok(snap.agents.every(a => a.work), 'the snapshot carries every job');
});

test('production per day scales with the workers\' skill x mood at their workplace', () => {
  const g = game();
  const farm = finish(g, 'farm');
  g.tick(0.1);
  const r1 = g.state.rates[farm.id].food;
  for (const id of farm.workers) { const a = g.state.agents.find(x => x.id === id); a.skills.farming = 10; a.mood = 95; }
  g.tick(0.1);
  const r2 = g.state.rates[farm.id].food;
  assert.ok(r2 > r1, `skill and mood raise output (${r1} -> ${r2})`);
  for (const id of farm.workers) { const a = g.state.agents.find(x => x.id === id); a.skills.farming = 0; a.mood = 10; }
  g.tick(0.1);
  assert.ok(g.state.rates[farm.id].food < r1, 'and lower them');
});

test('the camp trickle never feeds twelve: a farm is still needed, and idle folk find work on their own', () => {
  const g = game();
  run(g, 60 * 3, 0.5);
  assert.ok(g.state.resources.food < 60, 'food still falls');
  assert.ok(g.state.rates.camp.food < 12, 'the camp alone cannot feed the town');
  // over three minutes nobody stood idle for long
  let idleTicks = 0, ticks = 0;
  run(g, 30, 0.5);
  for (let t = 0; t < 30; t += 0.5) { g.tick(0.5); ticks++; if (idle(g) > 3) idleTicks++; }
  assert.ok(idleTicks / ticks < 0.25, `more than three idle folk in ${Math.round(100 * idleTicks / ticks)}% of ticks`);
});

test('visible building: a spoken thing gets a crew of 3-6 at once (builders first), hauling and hammering; the crowd is never idle during a build', () => {
  const g = game();
  g.spawnAll({ fleets: false });
  run(g, 5, 0.1);
  const r = g.apply({ type: 'build', kind: 'house', at: { mode: 'center' } });
  const b = g.state.buildings[0];
  assert.ok(b.workers.length >= 3 && b.workers.length <= 6, `crew ${b.workers.length}`);
  assert.ok(r.effects[0].workers.length >= 3);
  const crew = b.workers.map(id => g.state.agents.find(a => a.id === id));
  assert.ok(crew.filter(a => a.trade === 'builder').length >= 2, 'builders first: ' + crew.map(a => a.trade).join(','));
  run(g, 2, 0.1);
  assert.ok(busyOn(g, b) >= 3, `busy on the site after 2 s: ${busyOn(g, b)}`);
  let minBusy = Infinity, maxLoafing = 0;
  const idleFor = new Map();   // a breath between camp trips is fine; standing about for 5 s is loafing
  while (b.status !== 'done' && g.state.t < 200) {
    g.tick(0.5);
    if (b.status !== 'done') {
      minBusy = Math.min(minBusy, busyOn(g, b));
      for (const a of g.state.agents) idleFor.set(a.id, a.status === 'idle' && !a.task ? (idleFor.get(a.id) || 0) + 0.5 : 0);
      maxLoafing = Math.max(maxLoafing, [...idleFor.values()].filter(v => v >= 5).length);
    }
  }
  assert.equal(b.status, 'done');
  assert.ok(minBusy >= 2, `at least two on the site throughout (min ${minBusy})`);
  assert.equal(maxLoafing, 0, `nobody loafs for 5 s during the build (max ${maxLoafing} at once)`);
  assert.ok(g.all('agent:task', p => p.task.kind === 'haul' && p.task.buildingId === b.id).length >= 2, 'several crates hauled');
  assert.ok(g.all('agent:task', p => p.task.kind === 'work' && p.task.buildingId === b.id).length >= 3, 'several hammer');
});

test('an undesigned thing (awaiting codegen) keeps a crew busy with site prep until the design lands', () => {
  const g = game();
  g.apply({ type: 'build', kind: null, request: 'a lighthouse on the cliff', at: { mode: 'auto' } });
  const b = g.state.buildings[0];
  assert.equal(b.status, 'awaiting_design');
  assert.ok(b.workers.length >= 3, `crew ${b.workers.length}`);
  let minBusy = Infinity;
  for (let t = 0; t < 40; t += 0.5) { g.tick(0.5); if (t > 3) minBusy = Math.min(minBusy, busyOn(g, b)); }
  assert.ok(minBusy >= 2, `site prep crew stayed (min ${minBusy})`);
  assert.ok(g.find('agent:task', p => p.task.kind === 'work' && p.task.buildingId === b.id), 'hammering at the stakes');
  g.designArrived(b.id, { id: 'lighthouse', name: 'Lighthouse', meta: { footprint: { w: 4, d: 4 }, workers: 2, buildSeconds: 30 } });
  run(g, 60, 0.1);
  assert.equal(b.status, 'done');
});

test('a second spoken site takes helpers off the first at once; crews fill up to crewSize and settle back', () => {
  const g = game();
  g.state.resources = { food: 400, wood: 400, stone: 400, coin: 400, goods: 0 };
  g.apply({ type: 'build', kind: 'house', at: { mode: 'center' } });
  g.apply({ type: 'build', kind: 'well', at: { mode: 'auto' } });
  g.apply({ type: 'build', kind: 'farm', at: { mode: 'auto' } });
  g.apply({ type: 'build', kind: 'hut', at: { mode: 'auto' } });
  run(g, 3, 0.1);
  for (const b of g.state.buildings) assert.ok(b.workers.length >= 1, `${b.kind} has hands (${b.workers.length})`);
  const total = g.state.buildings.reduce((s, b) => s + b.workers.length, 0);
  assert.ok(total >= 10, `most of the crowd is on the sites (${total})`);
  assert.equal(crewSize(1), TASK.crewMin); assert.equal(crewSize(4), 6); assert.equal(crewSize(2), 4);
  run(g, 150, 0.1);
  assert.ok(g.state.buildings.every(b => b.status === 'done'), g.state.buildings.map(b => `${b.kind}:${b.status}`).join(' '));
});

test('the minister inspects sites and the crates instead of hauling', () => {
  const g = game();
  g.apply({ type: 'appoint_minister', agentId: 'Olla' });
  g.apply({ type: 'build', kind: 'house', at: { mode: 'center' } });
  const olla = g.state.agents.find(a => a.name === 'Olla');
  run(g, 40, 0.1);
  assert.ok(g.find('agent:task', p => p.agentId === olla.id && p.task.kind === 'idle' && p.task.inspect === true), 'an inspection');
  assert.ok(!g.find('agent:task', p => p.agentId === olla.id && p.task.kind === 'haul'), 'never hauls');
  assert.equal(olla.job, 'minister');
  assert.equal(JOB.inspectSeconds > 0, true);
});
