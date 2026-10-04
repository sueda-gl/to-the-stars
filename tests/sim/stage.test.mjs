import { test } from 'node:test';
import assert from 'node:assert/strict';
import { game, finish } from './helpers.mjs';
import { STAGES } from '../../web/js/sim/catalog.js';
import { ECO, computeProsperity, stageFor } from '../../web/js/sim/economy.js';

test('stageFor follows the thresholds', () => {
  assert.equal(stageFor(0), 'camp');
  assert.equal(stageFor(ECO.thresholds.hamlet), 'hamlet');
  assert.equal(stageFor(ECO.thresholds.village + 1), 'village');
  assert.equal(stageFor(ECO.thresholds.town), 'town');
  assert.equal(stageFor(ECO.thresholds.civilisation + 100), 'civilisation');
});

test('prosperity rises with buildings and the stage progresses in order, unlocking the catalogue', () => {
  const g = game();
  assert.equal(g.state.stage, 'camp');
  assert.ok(!g.catalog.unlocked('camp').includes('assembly'));
  const seen = [];
  g.on('stage', p => seen.push(p.stage));
  g.state.resources.food = 300;
  const plan = ['house', 'house', 'farm', 'windmill', 'well', 'woodcutter', 'quarry', 'bakery', 'house', 'granary', 'market', 'workshop', 'garden', 'dock', 'fountain', 'tavern', 'temple', 'tower', 'house', 'house', 'bridge'];
  let p0 = computeProsperity(g.state, g.catalog);
  for (const kind of plan) {
    if (!g.catalog.isUnlocked(kind, g.state.stage)) continue;
    finish(g, kind);
    g.tick(0.1);
    const p = computeProsperity(g.state, g.catalog);
    assert.ok(p >= p0, 'prosperity never falls when a building finishes');
    p0 = p;
  }
  assert.ok(seen.length >= 2, `stages seen: ${seen}`);
  for (let i = 1; i < seen.length; i++) assert.ok(STAGES.indexOf(seen[i]) === STAGES.indexOf(seen[i - 1]) + 1, 'no skipped stage');
  assert.ok(STAGES.indexOf(g.state.stage) >= STAGES.indexOf('village'), `reached ${g.state.stage}`);
  assert.ok(g.state.letters.some(l => l.kind === 'ministry' && l.meta.kind === 'stage'), 'ministry announced it');
  // the assembly needs a town
  if (g.state.stage === 'town' || g.state.stage === 'civilisation') assert.ok(g.catalog.unlocked(g.state.stage).includes('assembly'));
  const snap = g.snapshot();
  assert.deepEqual(snap.unlocked, g.catalog.unlocked(g.state.stage));
});

test('the assembly can be placed once town is reached and meetings move to it', () => {
  const g = game();
  g.state.stage = 'town';
  g.state.resources = { food: 200, wood: 200, stone: 200, coin: 100, goods: 50 };
  const r = g.apply({ type: 'build', kind: 'assembly', at: { mode: 'auto' } });
  assert.equal(r.ok, true, r.reason);
  const b = g.state.buildings[0];
  assert.deepEqual(b.footprint, { w: 20, d: 14 });
  g.completeBuilding(b);
  const m = g.apply({ type: 'call_meeting' });
  assert.ok(Math.abs(m.effects[0].where.x - b.x) < 1, 'meeting at the Red arch');
  assert.ok(g.find('meeting:start', p => p.assembly === true));
});
