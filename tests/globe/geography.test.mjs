// node --test tests/globe/geography.test.mjs — the shared layout agrees with the sim and is self-consistent
import test from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../../web/js/globe/geography.js';
import { createGame } from '../../web/js/sim/state.js';

test('home lake = the sim lake (seed 7) and setWater adopts a live one', () => {
  const g = createGame({ seed: 7 });
  assert.deepEqual(G.homeLake(7), g.state.water.find(w => w.kind === 'lake').poly);
  const g2 = createGame({ seed: 12 });
  G.setWater(g2.state.water);
  assert.deepEqual(G.getLake(), g2.state.water.find(w => w.kind === 'lake').poly);
  G.setWater(g.state.water);
});
test('plot is level land, the sea starts past its far edge, nations sit at the sim neighbour positions', () => {
  for (let x = -29; x <= 29; x += 4) for (let z = -25; z <= 29; z += 4) if (!G.inLake(x, z)) { assert.equal(G.heightAt(x, z), 0); assert.equal(G.landKind(x, z), 'cream'); }
  for (let x = -30; x <= 30; x += 5) { assert.ok(G.isWater(x, G.PLOT.z0 - 4.5), 'sea at x=' + x); assert.ok(!G.isWater(x, G.PLOT.z0 - 1)); }
  const sim = createGame({ seed: 7 }).state.neighbours;
  for (const n of G.places.nations) { const s = sim.find(q => q.id === n.id); assert.equal(n.x, s.x); assert.equal(n.z, s.z); assert.ok(G.heightAt(n.x, n.z) > 0, n.id + ' on land'); }
  assert.ok(G.heightAt(G.places.wonder.x, G.places.wonder.z) > 0);
});
test('flat <-> sphere round-trips', () => {
  for (const [x, y, z] of [[0, 0, 2], [30, 0, -26], [-95, 5, -40], [100, 3, -55], [0, 12, -130], [200, 0, 300]]) {
    const p = G.flatToSphere(x, y, z), f = G.sphereToFlat(...p);
    assert.ok(Math.abs(f.x - x) < 1e-6 && Math.abs(f.z - z) < 1e-6 && Math.abs(f.y - y) < 1e-6, JSON.stringify([x, y, z, f]));
  }
});
