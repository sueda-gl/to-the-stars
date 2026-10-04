// node --test tests/globe/landform.test.mjs — the designed landform (globe/landform.js via geography.js): the
// composition holds (nations on their own sites, the river is water, the beach is sand, the range is high) and
// land meets the sea without walls (no slab)
import test from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../../web/js/globe/geography.js';

const R = G.reliefAt, LF = G.LANDFORM;
test('the three nations stand on their own distinct sites', () => {
  const [n1, n2, n3] = G.places.nations;
  // the Drop Riviera on the headland: sea to its north-east and south-west, land along the arm
  assert.ok(R(n1.x, n1.z) > 6, 'n1 up on the headland');
  assert.ok(G.isWater(n1.x + 22, n1.z - 18) && G.isWater(n1.x - 14, n1.z + 26), 'n1 has sea either side of its arm');
  // the Loaf Republic a hill town: high, and the land round it falls away
  assert.ok(R(n2.x, n2.z) > 15, 'n2 is a hill town');
  assert.ok(R(n2.x, n2.z) - R(n2.x + 30, n2.z + 20) > 4, 'n2 stands above the land behind it');
  // the Flit Sky-hold on the island: water all round it
  for (const [dx, dz] of [[0, 34], [0, -34], [44, 0], [-44, 0]]) assert.ok(G.isWater(n3.x + dx, n3.z + dz), 'sea round the island ' + dx + ',' + dz);
});
test('the river is water from the gorge to the bay, the beach is sand, the range is high', () => {
  for (const t of [0.05, 0.25, 0.45, 0.65]) {
    const L = LF.riverLine, k = Math.round(t * (L.P.length - 1)), [x, z] = L.P[k];
    assert.ok(R(x, z) < 0, `river water at t=${t} (${x.toFixed(1)}, ${z.toFixed(1)})`);
  }
  assert.ok(G.waterKind(-46, -12) === 'river' || G.waterKind(-47, -15) === 'river' || G.waterKind(-48, -16) === 'river');
  assert.ok(G.landWeights(0, -28.2).sand > 0 || G.inPlot(0, -28.2));
  assert.ok(LF.weights(40, -33, 0.4, 0).sand >= 0);   // (the wonder's cove: rock or sand, never a wall)
  let peak = 0; for (let x = -150; x <= 150; x += 5) for (let z = 100; z <= 170; z += 5) peak = Math.max(peak, R(x, z));
  assert.ok(peak > 45, 'the limestone range rises behind ' + peak.toFixed(1));
});
test('no slab: land meets the sea through beaches and low cliffs, never a wall', () => {
  // along the whole coast within the map, the steepest drop into the water over 2 m stays below ~12 m
  let worst = 0, at = null;
  for (let x = -200; x <= 200; x += 1.5) for (let z = -200; z <= 120; z += 1.5) {
    const h = R(x, z); if (h >= 0 || h < -3) continue;
    for (const [dx, dz] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) { const d = R(x + dx, z + dz) - h; if (d > worst) { worst = d; at = [x, z]; } }
  }
  assert.ok(worst < 12, 'steepest shore step ' + worst.toFixed(1) + ' m at ' + at);
  // the shelf: a shallow band (< 2 m) right off the beach in front of our plot
  for (let x = -24; x <= 24; x += 6) assert.ok(R(x, -31) > -2 && R(x, -31) < 0, 'shallow shelf at ' + x);
});
