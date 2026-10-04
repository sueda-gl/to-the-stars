// Regressions from the round-2 adversarial audit: creation never blocked on resources or stage (bar the Assembly),
// an unfed town sulks but does not empty, construction drafts production workers, partial counts, assign to:null,
// refunds from paidCost, tick(Infinity), prototype-key actions, string agentIds, design footprints that no longer fit.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { game, run, finish } from './helpers.mjs';

test('after the four demo creations, every further spoken creation still lands', () => {
  const g = game();
  g.apply({ type: 'build', kind: 'house', at: { mode: 'center' } }); run(g, 45, 0.1);
  g.apply({ type: 'build', kind: 'windmill', at: { mode: 'pointer', x: 12, z: -4 } }); run(g, 20, 0.1);
  g.apply({ type: 'build', kind: null, request: 'a lighthouse on the cliff', at: { mode: 'near', ref: 'edge' } }); run(g, 60, 0.1);
  g.apply({ type: 'build', kind: 'bakery', at: { mode: 'auto' } }); run(g, 10, 0.1);
  assert.ok(g.state.resources.stone < 9, 'the crates are nearly empty: ' + JSON.stringify(g.state.resources));
  for (const req of ['a rubber duck in the lake', 'a dragon statue in the square', 'a giant lighthouse']) {
    const r = g.apply({ type: 'build', kind: null, request: req, at: { mode: 'auto' } });
    assert.equal(r.ok, true, req + ': ' + r.reason);
    assert.ok(r.effects.some(e => e.type === 'needsDesign'));
  }
  for (const k of ['hut', 'well', 'road', 'temple']) {   // temple is a village building: ambitious for a camp, but it lands
    const r = g.apply({ type: 'build', kind: k, at: { mode: 'auto' } });
    assert.equal(r.ok, true, k + ': ' + r.reason);
  }
  assert.ok(g.state.letters.filter(l => l.kind === 'ministry' && l.meta.kind === 'locked').length >= 1, 'the Ministry remarks on the temple');
  for (const k of Object.keys(g.state.resources)) assert.ok(g.state.resources[k] >= 0, k + ' never negative');
  // the short / locked asides are throttled: seven short creations in a row, far fewer letters
  assert.ok(g.state.letters.filter(l => l.kind === 'ministry' && l.meta.kind === 'short').length <= 2, 'short letters throttled');
  assert.ok(g.state.buildings.every(b => b.status !== 'removed'), 'all sites exist');
  assert.equal(g.state.buildings.length, 11);
});

test('the Assembly alone stays gated to town', () => {
  const g = game();
  const r = g.apply({ type: 'build', kind: 'assembly', at: { mode: 'auto' } });
  assert.equal(r.ok, false);
  assert.match(r.reason, /town/);
});

test('an unfed town for twelve idle minutes sulks and strikes but nobody leaves', () => {
  for (const seed of [1, 7, 42]) {
    const g = game({ seed });
    run(g, 720, 0.1);
    const alive = g.state.agents.filter(a => a.status !== 'left');
    assert.equal(alive.length, 12, `seed ${seed}: everyone still here`);
    assert.ok(g.state.hungry, 'the crates are empty');
    assert.ok(g.state.mood >= 15, `seed ${seed}: mood floored (${g.state.mood})`);
    assert.ok(g.state.letters.some(l => l.kind === 'complaint' && l.meta.reason === 'hunger'), 'they wrote about it');
    assert.equal(g.count('agent:leave'), 0);
  }
});

test('a spoken creation drafts a production worker when everyone holds a job', () => {
  const g = game();
  g.state.resources = { food: 300, wood: 400, stone: 400, coin: 400, goods: 0 }; g.state.stage = 'town';
  for (const k of ['farm', 'bakery', 'windmill', 'woodcutter', 'quarry', 'workshop', 'market', 'dock', 'tavern', 'grove']) finish(g, k);
  run(g, 5, 0.1);
  assert.equal(g.state.agents.filter(a => a.jobId).length, 12, 'every folk holds a production job');
  const r = g.apply({ type: 'build', kind: null, request: 'a dragon statue', at: { mode: 'auto' } });
  assert.equal(r.ok, true);
  const d = g.state.buildings.at(-1);
  assert.ok(d.workers.length >= 1, 'a crew was drafted at once');
  const farm = g.state.buildings.find(b => b.kind === 'farm');
  assert.ok(!d.workers.some(id => farm.workers.includes(id)), 'the drafted hands came from a thinner job than the farm');
  run(g, 300, 0.1);
  assert.equal(d.progress, 1, 'the statue was built while the design was awaited');
  assert.equal(g.state.letters.filter(l => l.kind === 'ministry' && l.meta.kind === 'stalled').length, 0);
  g.designArrived(d.id, { id: 'dragon_statue', name: 'Dragon Statue', meta: { footprint: { w: 4, d: 4 }, cost: {}, workers: 2 } });
  assert.equal(d.status, 'done');
  run(g, 30, 0.1);
  // the released crew went back to work (17 slots for 12 folk: every folk holds a job again, and the farm is full)
  assert.equal(g.state.agents.filter(a => a.jobId).length, 12, 'everyone back at a job');
  assert.equal(farm.workers.length, 2, 'the farm is fully staffed');
});

test('twenty creations at once all get crewed in the end, with few stalled letters', () => {
  const g = game();
  g.state.resources = { food: 300, wood: 400, stone: 400, coin: 400, goods: 0 };
  for (let i = 0; i < 20; i++) g.apply({ type: 'build', kind: i % 2 ? 'hut' : 'well', at: { mode: 'auto' } });
  run(g, 600, 0.1);
  const done = g.state.buildings.filter(b => b.status === 'done').length;
  assert.ok(done >= 18, `${done}/20 done`);
  assert.ok(g.state.letters.filter(l => l.kind === 'ministry' && l.meta.kind === 'stalled').length <= 3, 'stalled letters throttled');
});

test('count that only partly fits is ok:true with a partial effect, never a failure toast', () => {
  const g = game();
  const toasts = []; g.on('toast', p => toasts.push(p.text));
  const r = g.apply({ type: 'build', kind: 'assembly', count: 3, at: { mode: 'auto' } });
  assert.equal(r.ok, false);   // nothing placed at all: still a refusal
  g.state.stage = 'town';
  const r2 = g.apply({ type: 'build', kind: 'assembly', count: 6, at: { mode: 'center' } });
  assert.equal(r2.ok, true);
  const placed = r2.effects.filter(e => e.type === 'site').length;
  assert.ok(placed >= 1 && placed < 6, 'some assemblies fit, not six: ' + placed);
  const partial = r2.effects.find(e => e.type === 'partial');
  assert.ok(partial && partial.placed === placed && partial.wanted === 6);
  assert.ok(toasts.some(t => t.startsWith(`Only ${placed} of 6 fit`)));
  assert.ok(!toasts.some(t => /Not enough/.test(t)));
});

test('assign with no destination is refused, never matched to a pending site', () => {
  const g = game();
  g.apply({ type: 'build', kind: null, request: 'a statue', at: { mode: 'center' } });
  for (const to of [null, undefined, '', 42]) {
    const r = g.apply({ type: 'assign', agentIds: ['f2'], to });
    assert.equal(r.ok, false, 'to=' + String(to));
    assert.ok(!g.state.buildings[0].workers.includes('f2') || g.state.buildings[0].workers.length <= 2);
  }
  // a string agentIds is coerced, not thrown at
  const r = g.apply({ type: 'assign', agentIds: 'f2', to: 'rest' });
  assert.equal(r.ok, true, r.reason);
  assert.equal(g.state.agents.find(a => a.id === 'f2').status, 'resting');
});

test('demolish refunds half of what was really paid', () => {
  const g = game();
  g.apply({ type: 'build', kind: null, request: 'a statue', at: { mode: 'center' } });
  const r = g.apply({ type: 'demolish', buildingId: g.state.buildings[0].id });
  assert.deepEqual(r.effects[0].refund, { wood: 2, stone: 4, coin: 1 });
  const g2 = game();
  g2.apply({ type: 'build', kind: null, request: 'a palace', at: { mode: 'center' } });
  const b = g2.state.buildings[0];
  g2.designArrived(b.id, { id: 'palace', name: 'Palace', meta: { footprint: { w: 5, d: 5 }, cost: { wood: 200, stone: 200, coin: 200 } } });
  const w0 = g2.state.resources.wood;
  g2.apply({ type: 'demolish', buildingId: b.id });
  assert.equal(g2.state.resources.wood, w0 + 2);
  // short creation: paid only what the crates had, refund is half of that
  const g3 = game();
  g3.state.resources.wood = 3;
  g3.apply({ type: 'build', kind: 'house', at: { mode: 'center' } });
  assert.deepEqual(g3.state.buildings[0].paidCost, { wood: 3, stone: 2 });
  const r3 = g3.apply({ type: 'demolish', buildingId: g3.state.buildings[0].id });
  assert.deepEqual(r3.effects[0].refund, { wood: 1, stone: 1 });
});

test('tick never hangs: Infinity, NaN, negative, strings and huge dts are bounded', () => {
  const g = game();
  for (const dt of [Infinity, -Infinity, NaN, -5, 'x', null, undefined, {}]) { g.tick(dt); assert.equal(g.state.t, 0, String(dt)); }
  const t0 = Date.now();
  g.tick(1e12);
  assert.equal(g.state.t, 3600, 'one call simulates at most an hour');
  assert.ok(Date.now() - t0 < 5000);
});

test('prototype keys are not actions and garbage shapes never throw out', () => {
  const g = game();
  for (const type of ['constructor', '__proto__', 'toString', 'hasOwnProperty', 42, null, {}]) {
    const r = g.apply({ type });
    assert.equal(r.ok, false, String(type));
    assert.match(r.reason, /unknown action type/);
    assert.ok(!('state' in r), 'never leaks the game object');
  }
  assert.equal(g.apply({ type: 'assign', agentIds: 'f1' }).ok, false);
  assert.equal(g.apply({ type: 'assign', agentIds: { a: 1 }, to: 'rest' }).ok, false);
  assert.equal(g.apply({ type: 'build', kind: 'house', assign: 'f1', at: { mode: 'auto' } }).ok, true, 'a string assign is coerced');
});

test('a design whose real footprint no longer fits shifts the site instead of overlapping', () => {
  const g = game();
  g.state.resources = { food: 300, wood: 400, stone: 400, coin: 400, goods: 0 };
  g.apply({ type: 'build', kind: null, request: 'a cathedral', at: { mode: 'center' } });
  const c = g.state.buildings[0];
  // ring the 5x5 site with huts so a 20x20 plan cannot stay where it is
  for (let i = 0; i < 8; i++) g.apply({ type: 'build', kind: 'hut', at: { mode: 'near', ref: c.id } });
  const before = { x: c.x, z: c.z };
  g.designArrived(c.id, { id: 'cathedral', name: 'Cathedral', meta: { footprint: { w: 20, d: 20 }, cost: {}, workers: 3 } });
  const ev = g.all('building:design', p => p.building.id === c.id)[0];
  assert.ok(ev && ev.moved === true, 'the site moved: ' + JSON.stringify(ev && { moved: ev.moved, x: ev.building.x, z: ev.building.z }));
  assert.deepEqual(c.footprint, { w: 20, d: 20 });
  assert.ok(c.x !== before.x || c.z !== before.z);
  const rect = { x: c.x, z: c.z, w: 20, d: 20 };
  assert.ok(g.spotFree(rect, c.id), 'the new spot overlaps nothing');
  run(g, 5, 0.1);
  assert.ok(c.workers.length >= 1, 'the crew carries on at the new spot');
});
