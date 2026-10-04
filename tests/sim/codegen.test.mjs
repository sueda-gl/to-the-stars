import { test } from 'node:test';
import assert from 'node:assert/strict';
import { game, run } from './helpers.mjs';

test('unknown building: awaiting_design -> ministry notice -> catalog.add -> completion', () => {
  const g = game();
  const r = g.apply({ type: 'build', kind: null, request: 'a lighthouse on the cliff', at: { mode: 'near', ref: 'edge' } });
  assert.equal(r.ok, true, r.reason);
  const b = g.state.buildings[0];
  assert.equal(b.status, 'awaiting_design');
  assert.equal(b.kind, null);
  assert.equal(b.name, 'Lighthouse');
  assert.ok(b.z < -12, `on the cliff side (z=${b.z})`);
  assert.ok(g.find('building:needsDesign', p => p.building.id === b.id && /lighthouse/.test(p.request)));
  const notice = g.state.letters.find(l => l.kind === 'ministry' && l.meta.kind === 'needs_design');
  assert.ok(notice);
  assert.match(notice.body, /never built a lighthouse before/i);
  assert.match(notice.body, /drawing it now/i);   // §24: the Ministry speaks plainly
  assert.equal(g.state.resources.stone, 20 - 9, 'default cost paid');
  // the crew works meanwhile
  run(g, 40, 0.1);
  assert.ok(b.workers.length >= 1);
  assert.ok(b.progress > 0, 'site progresses while the design is awaited');
  assert.ok(g.find('agent:task', p => p.task.kind === 'haul' && p.task.carrying === 'crate'));
  // but never completes without the asset
  run(g, 200, 0.1);
  assert.equal(b.status, 'awaiting_design');
  assert.equal(b.progress, 1);
  // the asset arrives (what /api/codegen returns)
  const asset = { id: 'lighthouse', name: 'Lighthouse', aliases: ['light house', 'beacon'], meta: { footprint: { w: 4, d: 4 }, cost: { stone: 20, wood: 4 }, workers: 2, skill: 'building', buildSeconds: 60, perDay: { coin: 1 }, housing: 0 } };
  const entry = g.catalog.add(asset);
  assert.equal(entry.generated, true);
  assert.equal(entry.footprint.w, 4);
  assert.equal(entry.perDay.coin, 1);
  assert.equal(g.catalog.resolve('a light house please'), 'lighthouse');
  g.designArrived(b.id, asset);
  assert.equal(b.status, 'done');
  assert.equal(b.kind, 'lighthouse');
  assert.equal(b.generated, true);
  assert.equal(b.assetId, 'lighthouse');
  assert.ok(g.find('building:done', p => p.building.id === b.id));
  assert.ok(g.state.letters.some(l => l.kind === 'ministry' && l.meta.kind === 'raised'));
  // learned forever: the next lighthouse is a known kind
  g.state.resources.stone = 50; g.state.resources.wood = 50;
  const r2 = g.apply({ type: 'build', kind: 'lighthouse', at: { mode: 'auto' } });
  assert.equal(r2.ok, true);
  assert.equal(g.state.buildings[1].status, 'site');
});

test('a design arriving early completes the site when its work is done', () => {
  const g = game();
  g.apply({ type: 'build', kind: null, request: 'a tiny observatory', at: { mode: 'auto' } });
  const b = g.state.buildings[0];
  run(g, 5, 0.1);
  g.designArrived(b.id, { id: 'observatory', name: 'Observatory', meta: { footprint: { w: 5, d: 5 }, buildSeconds: 30, workers: 2 } });
  assert.notEqual(b.status, 'done');
  assert.ok(['site', 'building'].includes(b.status));
  run(g, 200, 0.1);
  assert.equal(b.status, 'done');
});

test('kind null with a request that is actually a known kind resolves to it', () => {
  const g = game();
  const r = g.apply({ type: 'build', kind: null, request: 'a wind mill over there', at: { mode: 'auto' } });
  assert.equal(r.ok, true);
  assert.equal(g.state.buildings[0].kind, 'windmill');
  assert.equal(g.count('building:needsDesign'), 0);
});
