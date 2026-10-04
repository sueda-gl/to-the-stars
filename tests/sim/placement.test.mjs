import { test } from 'node:test';
import assert from 'node:assert/strict';
import { game } from './helpers.mjs';
import { rectsOverlap, rectInPlot, rectTouchesPoly, pointInPoly, polyCentroid } from '../../web/js/sim/geometry.js';
import { createRng } from '../../web/js/sim/rng.js';

const rectOf = b => ({ x: b.x, z: b.z, w: b.footprint.w, d: b.footprint.d });

function assertClean(g) {
  const bs = g.state.buildings;
  for (let i = 0; i < bs.length; i++) {
    const r = rectOf(bs[i]);
    assert.ok(rectInPlot(r, g.state.plot, 0), `${bs[i].kind} inside the plot`);
    for (const w of g.state.water) assert.ok(!rectTouchesPoly(r, w.poly, 0), `${bs[i].kind} at (${r.x},${r.z}) is not in the ${w.kind}`);
    // Sueda (ART_DIRECTION §9): fields / gardens / areas are buildable land, so a building may sit on an area; nothing else overlaps
    const isArea = b => !!(b.shape && b.shape.poly) || ['garden', 'farm', 'field', 'forest', 'vineyard', 'plaza', 'grove'].includes(b.kind);
    for (let j = i + 1; j < bs.length; j++) if (!isArea(bs[i]) && !isArea(bs[j])) assert.ok(!rectsOverlap(r, rectOf(bs[j]), 0), `${bs[i].kind} and ${bs[j].kind} overlap`);
  }
}

test('placement never overlaps, never lands in water, always inside the plot', () => {
  const g = game();
  g.state.resources = { food: 999, wood: 999, stone: 999, coin: 999, goods: 0 };
  g.state.stage = 'town';
  const rng = createRng(99);
  const kinds = g.catalog.ids();
  const lake = g.state.water.find(w => w.kind === 'lake').poly;
  const lc = polyCentroid(lake);
  const modes = [
    () => ({ mode: 'pointer', x: rng.range(-34, 34), z: rng.range(-30, 34) }),
    () => ({ mode: 'pointer', x: lc.x + rng.range(-3, 3), z: lc.z + rng.range(-2, 2) }),   // pointing into the lake
    () => ({ mode: 'center' }),
    () => ({ mode: 'auto' }),
    () => ({ mode: 'near', ref: 'water' }),
    () => ({ mode: 'near', ref: 'edge' }),
    () => ({ mode: 'near', ref: g.state.buildings.length ? rng.pick(g.state.buildings).id : 'water' })
  ];
  let placed = 0;
  for (let i = 0; i < 45; i++) {
    const kind = rng.pick(kinds.filter(k => k !== 'assembly'));
    const r = g.apply({ type: 'build', kind, at: rng.pick(modes)() });
    if (r.ok) placed++;
    assertClean(g);
  }
  assert.ok(placed >= 30, `placed ${placed}`);
  // a point in the lake is never a building centre
  for (const b of g.state.buildings) assert.ok(!pointInPoly(b.x, b.z, lake));
});

test('pointer placement is exact when free, and nudges off water when not', () => {
  const g = game();
  g.state.resources.wood = 999; g.state.resources.stone = 999;
  const lake = g.state.water.find(w => w.kind === 'lake').poly;
  const lc = polyCentroid(lake);
  const r1 = g.apply({ type: 'build', kind: 'hut', at: { mode: 'pointer', x: 8, z: 8 } });
  assert.equal(r1.ok, true);
  assert.deepEqual([g.state.buildings[0].x, g.state.buildings[0].z], [8, 8]);
  const r2 = g.apply({ type: 'build', kind: 'hut', at: { mode: 'pointer', x: lc.x, z: lc.z } });
  assert.equal(r2.ok, true);
  const b = g.state.buildings[1];
  assert.ok(!rectTouchesPoly(rectOf(b), lake, 0));
  assert.ok(Math.hypot(b.x - lc.x, b.z - lc.z) < 14, 'close to where pointed');
  // the second house "in the middle" sits next to the first, not on it
  g.apply({ type: 'build', kind: 'house', at: { mode: 'center' } });
  g.apply({ type: 'build', kind: 'house', at: { mode: 'center' } });
  const [h1, h2] = g.state.buildings.slice(2);
  assert.ok(!rectsOverlap(rectOf(h1), rectOf(h2), 0));
  assert.ok(Math.hypot(h2.x - h1.x, h2.z - h1.z) < 9);
});

test('findSpot is deterministic per seed and returns null when the plot is full', () => {
  const a = game({ seed: 3 }), b = game({ seed: 3 });
  for (let i = 0; i < 5; i++) assert.deepEqual(a.findSpot('farm', null), b.findSpot('farm', null));
  const g = game();
  let n = 0;
  while (g.findSpot('assembly', null, { mode: 'pointer' })) { const s = g.findSpot('assembly', null, { mode: 'pointer' }); g.placeBuilding('assembly', s); if (++n > 50) break; }
  assert.ok(n >= 3 && n < 50, `fits ${n} assemblies`);
  assert.equal(g.findSpot('assembly', null), null);
});

test('a dock goes to the water, a lighthouse to the far edge', () => {
  const g = game();
  g.state.stage = 'hamlet'; g.state.resources.wood = 99;
  g.apply({ type: 'build', kind: 'dock', at: { mode: 'auto' } });
  const dock = g.state.buildings[0];
  const nearWater = g.state.water.some(w => rectTouchesPoly(rectOf(dock), w.poly, 4));
  assert.ok(nearWater, `dock near water at (${dock.x},${dock.z})`);
});
