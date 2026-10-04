// Firewood stack: the winter's wood, split and stacked to season. A rick of logs between pairs of end stakes,
// pale cut ends to the front, under a sloping plank cover weighted with stones; beside it a chopping block with
// the axe bitten in, a few split billets and a basket of kindling. Footprint 3.2 x 1.8, the cut ends face +z.
export const meta = {
  id: 'firewood', name: 'Firewood stack', aliases: ['firewood stack', 'woodpile', 'wood pile', 'log pile', 'log stack', 'wood stack', 'rick', 'odun', 'odun yığını', 'odunluk'],
  category: 'prop', stage: 'camp', footprint: { w: 3.2, d: 1.8 }, height: 1.7,
  desc: 'A rick of split logs between end stakes under a stone-weighted plank cover, with a chopping block and axe.'
};

export function build(api) {
  const R = api.ramps, g = api.group();
  const x0 = -0.35, W = 2.0, D = 0.9, lr = 0.12;    // rick centre x, length along x, depth (log length), log radius

  // a couple of sleeper rails keep the bottom course off the ground
  [-0.28, 0.28].forEach(z => g.add(api.box({ w: W + 0.2, h: 0.1, d: 0.12, x: x0, y: 0.05, z, ramp: R.WOOD, lift: -0.2 })));

  // the rick: four courses, logs along z, each with a pale cut end on the front face
  const courses = 4, per = Math.floor(W / (lr * 2.05));
  for (let c = 0; c < courses; c++) {
    const m = per - (c === courses - 1 ? 1 : 0);
    for (let i = 0; i < m; i++) {
      const x = x0 + (i - (m - 1) / 2) * lr * 2.05 + (c % 2 ? lr * 0.3 : 0), y = 0.1 + lr + c * lr * 1.8, r = lr * api.range(0.88, 1.06);
      g.add(api.cylinder({ r, h: D, x, y, rx: Math.PI / 2, ramp: R.WOOD, lift: api.range(-0.1, 0.08), seg: 8 }));
      g.add(api.colourOnly(api.cylinder({ r: r * 0.86, h: 0.02, x, y, z: D / 2 + 0.005, rx: Math.PI / 2, color: '#dcb57e', lift: api.range(-0.05, 0.08), speck: 0.1, seg: 8 })));
    }
  }
  const top = 0.1 + courses * lr * 1.8 + 0.05;
  // pairs of end stakes holding the stack in
  [-1, 1].forEach(s => [-0.32, 0.32].forEach(z => g.add(api.cylinder({ rb: 0.05, rt: 0.04, h: top + 0.25, x: x0 + s * (W / 2 + 0.07), y: (top + 0.25) / 2, z, ramp: R.WOOD, lift: 0.1, seg: 6 }))));

  // the plank cover, falling to the back, weighted with three stones
  const tilt = 0.22;
  // (it covers the back two-thirds, so from above the front course of logs still shows)
  g.add(api.box({ w: W + 0.4, h: 0.07, d: D * 0.72, x: x0, y: top + 0.08, z: -D * 0.2, rx: -tilt, color: '#5e4330', speck: 0.3 }));
  [[-0.6, -0.1], [0.15, -0.3], [0.75, -0.15]].forEach(([dx, dz], i) =>
    g.add(api.sphere({ r: 0.15, sx: 1.3, sy: 0.7, x: x0 + dx, y: top + 0.2 + (dz + D * 0.2) * Math.tan(tilt), z: dz, rot: i, ramp: R.LIMESTONE, lift: api.range(-0.08, 0.06), seg: 10 })));

  // the chopping block with an axe bitten in, split billets, a basket of kindling
  const cx = 1.25, cz = 0.35;
  g.add(api.cylinder({ rb: 0.3, rt: 0.27, h: 0.48, x: cx, y: 0.24, z: cz, ramp: R.WOOD, seg: 14 }));
  g.add(api.cylinder({ r: 0.25, h: 0.02, x: cx, y: 0.485, z: cz, color: '#dcb57e', speck: 0.1, seg: 14 }));
  g.add(api.box({ w: 0.06, h: 0.8, d: 0.06, x: cx + 0.14, y: 0.8, z: cz + 0.1, rz: -0.6, rx: 0.25, ramp: R.OCHRE }));
  g.add(api.box({ w: 0.3, h: 0.17, d: 0.05, x: cx - 0.02, y: 0.56, z: cz + 0.02, rz: -0.6, ramp: R.IRON }));
  for (let i = 0; i < 3; i++) g.add(api.box({ w: 0.12, h: 0.12, d: 0.45, x: cx - 0.45 + i * 0.16, y: 0.06, z: cz + 0.55 + (i % 2) * 0.1, rot: 0.6 + i * 0.35, color: '#c99a62', lift: 0.05 }));
  g.add(api.cylinder({ rb: 0.2, rt: 0.25, h: 0.32, x: cx + 0.05, y: 0.16, z: cz - 0.7, color: '#b98c5d', speck: 0.4, seg: 12 }));
  g.add(api.cone({ r: 0.22, h: 0.22, x: cx + 0.05, y: 0.4, z: cz - 0.7, ramp: R.WOOD, lift: 0.1, speck: 0.4, seg: 10 }));

  // keylines: the rick as one block (its logs keep their colour; the cut ends are paint only)
  api.proxy(api.boxGeo({ w: W, h: top - 0.1, d: D, x: x0, y: 0.1 + (top - 0.1) / 2 }), g);
  return g;
}
