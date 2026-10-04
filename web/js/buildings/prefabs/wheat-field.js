// Wheat field: a 12 x 10 m patch of ripe wheat in long bands of two golds running across the field (from the
// leader's bird's-eye they read as the moodboard's striped bands; at the edge, a standing wall of wheat), a
// grass verge along the front with a few poppy patches (the one red accent). The bands lean in the wind.
export const meta = {
  id: 'wheat-field', name: 'Wheat field', category: 'farm', stage: 'hamlet', area: true,
  aliases: ['wheat', 'wheat fields', 'wheatfield', 'grain field', 'grain', 'cornfield', 'corn field', 'barley field', 'barley', 'field of wheat', 'buğday tarlası', 'buğday', 'tarla', 'ekin tarlası'],
  footprint: { w: 12, d: 10 }, height: 1.1,
  desc: 'ripe golden wheat in long two-tone bands, a grass verge with poppies in front; the bands sway in the wind'
};

// the wheat's cross-section (x across the band, y up): a rounded crest over a shoulder that meets the next
// band's shoulder, so the packed bands read as wind ripples (lit crest, shaded trough) from above and give
// a rolling, not boxy, silhouette from the edge
const band = (w, h) => [[-w / 2, 0], [-w / 2, h * 0.6], [-w * 0.36, h * 0.86], [-w * 0.13, h], [w * 0.13, h], [w * 0.36, h * 0.86], [w / 2, h * 0.6], [w / 2, 0]];
const bank = (w, h) => [[-w / 2, 0], [-w * 0.3, h * 0.8], [0, h], [w * 0.3, h * 0.8], [w / 2, 0]];
// mid-value golds (fill.js CROPS.wheat / barley): two tones so neighbouring bands stripe
const WHEAT = ['#6f5418', '#94722a', '#b48e3a', '#c9a246', '#d6b052'];
const BARLEY = ['#75611f', '#9a8233', '#b99c46', '#cbb057', '#d9c26a'];
const POPPY = ['#5a1410', '#8f231a', '#b8301f', '#cc3f28', '#d84d32'];

export function build(api) {
  const R = api.ramps, g = api.group();
  const W = 12, D = 10, L = W - 0.7;
  // no slab under the wheat: a ground-hugging slab gets a polygon-offset material that paints over anything
  // less than about a metre above it at the leader's distance. The earth is a rim round the crop instead, with
  // a pale track along the back

  // the bands run across the field (along x), packed close; a group per band with its pivot at the foot, so
  // animate() can lean it in the wind. One proxy outlines the whole crop: the stripes are colour, not lines
  const n = 8, z0 = -D / 2 + 0.65, z1 = D / 2 - 1.15, pitch = (z1 - z0) / n, bw = pitch + 0.02;
  const swap = api.rand() < 0.5, rim = (w, d, x, z, c) => g.add(api.box({ w, h: 0.06, d, x, y: 0.03, z, color: c, speck: 0.08 }));
  rim(W, z0 + D / 2, 0, (-D / 2 + z0) / 2, '#c9ad7f');
  rim((W - L) / 2, z1 - z0, -(W + L) / 4, (z0 + z1) / 2, '#7a5636'); rim((W - L) / 2, z1 - z0, (W + L) / 4, (z0 + z1) / 2, '#7a5636');
  rim(W, D / 2 - z1, 0, (z1 + D / 2) / 2, '#7a5636');
  for (let i = 0; i < n; i++) {
    const row = api.group({ y: 0, z: z0 + pitch * (i + 0.5) });
    row.name = 'row' + i;
    const ramp = (i % 2 === 0) !== swap ? WHEAT : BARLEY;
    row.add(api.extrude({ shape: band(bw, api.range(0.92, 1.05)), depth: L, rot: Math.PI / 2, ramp, speck: 0.1, lift: api.range(-0.04, 0.03) }));
    g.add(row);
  }
  api.proxy(api.boxGeo({ w: L, h: 0.98, d: z1 - z0, y: 0.49, z: (z0 + z1) / 2 }), g);

  // the front verge: a low grass bank with a few poppy patches in it (the one red accent)
  g.add(api.extrude({ shape: bank(1.0, 0.3), depth: W - 0.3, y: 0.06, z: D / 2 - 0.6, rot: Math.PI / 2, ramp: R.SAGE, speck: 0.1 }));
  // poppy drifts: long low swells of red along the bank (big enough that the brush keeps them whole)
  for (let i = 0; i < 3; i++) {
    const x = -W / 2 + 2.2 + i * 3.8 + api.range(-0.6, 0.6);
    g.add(api.sphere({ r: 0.34, sy: 0.85, sx: api.range(3.0, 4.2), x, y: 0.42, z: D / 2 - 0.6 + api.range(-0.06, 0.06), ramp: POPPY, speck: 0.08, seg: 16 }));
  }
  return g;
}

// the bands lean in the wind, a wave running across the field
export function animate(obj, t) {
  for (let i = 0; i < 8; i++) {
    const r = obj.getObjectByName('row' + i);
    if (r) r.rotation.x = Math.sin(t * 1.1 - i * 0.6) * 0.025 + 0.01;
  }
}
