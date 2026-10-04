import { test } from 'node:test';
import assert from 'node:assert/strict';
import { game, run, finish } from './helpers.mjs';
import { ECO } from '../../web/js/sim/economy.js';

test('initial state matches the contract', () => {
  const g = game();
  const s = g.state;
  assert.deepEqual(s.resources, { food: 60, wood: 30, stone: 20, coin: 10, goods: 0 });
  assert.deepEqual(s.plot, { x0: -30, x1: 30, z0: -26, z1: 30 });
  assert.equal(s.stage, 'camp');
  assert.equal(s.minister, null);
  assert.equal(s.agents.length, 12);
  const species = new Set(s.agents.map(a => a.species));
  assert.deepEqual([...species].sort(), ['flit', 'floatie'], 'our settlers are only flits and floaties (ART_DIRECTION §7)');
  assert.equal(s.agents.filter(a => a.species === 'flit').length, 6, 'half flits');
  assert.ok(s.agents.filter(a => a.trade === 'builder').length >= 3, '>=3 builders');
  assert.ok(s.agents.some(a => a.name === 'Olla'), 'Olla is among the settlers');
  assert.equal(s.neighbours.length, 3);
  for (const n of s.neighbours) assert.ok(n.x < s.plot.x0 || n.x > s.plot.x1 || n.z < s.plot.z0 || n.z > s.plot.z1, 'neighbour outside the plot');
  assert.ok(s.water.some(w => w.kind === 'lake') && s.water.some(w => w.kind === 'sea'));
  const lake = s.water.find(w => w.kind === 'lake').poly;
  const xs = lake.map(p => p[0]), zs = lake.map(p => p[1]);
  const w = Math.max(...xs) - Math.min(...xs), d = Math.max(...zs) - Math.min(...zs);
  assert.ok(w > 7 && w < 14 && d > 5 && d < 10, `lake ~10x7, got ${w.toFixed(1)}x${d.toFixed(1)}`);
  // the middle stays buildable
  assert.ok(g.spotFree({ x: 0, z: 2, w: 4, d: 4 }), 'centre is free of water');
});

test('a day is 60 s and folk eat 1 food a day', () => {
  const g = game();
  run(g, 60);
  assert.equal(g.state.day, 2);
  assert.equal(g.count('day'), 1);
  // twelve eaten; the camp's foragers bring back a little (JOB.campFood per forager per day, far short of what is eaten)
  assert.ok(g.state.resources.food >= 48 && g.state.resources.food <= 52, `food ${g.state.resources.food}`);
  assert.ok(g.state.rates.camp && g.state.rates.camp.food > 0 && g.state.rates.camp.food < 6, `camp food/day ${JSON.stringify(g.state.rates.camp)}`);
});

test('a staffed farm produces food, scaled by its workers', () => {
  const g = game();
  const farm = finish(g, 'farm');
  assert.ok(farm.workers.length >= 1, 'farm auto-staffed');
  const before = g.state.resources.food;
  run(g, 60);
  const net = g.state.resources.food - before;
  assert.ok(net > -12, `farm offsets hunger (net ${net})`);
  assert.ok(g.state.rates[farm.id].food > 0);
  assert.ok(g.count('resources') > 0);
});

test('inputs gate outputs: a bakery with no wood bakes nothing', () => {
  const g = game();
  g.state.resources.wood = 0;
  for (const a of g.state.agents) a.campRole = 'forager';   // no gatherers: no driftwood arrives either
  const bakery = finish(g, 'bakery');
  g.tick(0.1);
  assert.ok(bakery.workers.length >= 1);
  const before = g.state.resources.food;
  run(g, 30);
  assert.ok(g.state.resources.food <= before, 'no bread without firewood');
});

test('the food cap grows with a granary', () => {
  const g = game();
  g.state.resources.food = 500; g.state.acc.food = 2;
  g.tick(0.5);
  assert.equal(g.state.resources.food, ECO.foodCap, 'capped when it next moves');
  g.state.stage = 'hamlet';
  finish(g, 'granary');
  g.state.resources.food = 500; g.state.acc.food = 2; g.tick(0.5);
  assert.ok(g.state.resources.food > ECO.foodCap);
});

test('immigration when there is housing and good mood', () => {
  const g = game();
  g.state.resources.food = 100;
  for (let i = 0; i < 4; i++) finish(g, 'house');
  for (const a of g.state.agents) a.mood = 80;
  const pop0 = g.state.agents.length;
  run(g, 60 * 6);
  assert.ok(g.state.agents.length > pop0, 'someone arrived');
  assert.ok(g.count('agent:spawn') >= 1);
  assert.ok(g.state.letters.some(l => l.kind === 'newcomer'));
});
