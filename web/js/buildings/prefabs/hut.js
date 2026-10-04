// Hut: quick shelter for two. A squat rendered block under a fat straw-thatch gable (a touch crooked),
// a plain ink door with a wooden lintel, one red-shuttered window on the lit side, and a reed lean-to on the right
// sheltering the firewood. Footprint 3 x 3, the door faces +z.
export const meta = { id: 'hut', footprint: { w: 3, d: 3 }, height: 3.2 };

// straw thatch, dark -> light (warm golden straw, so it stands off the cream paper from above)
const THATCH = ['#563c1b', '#82602b', '#a88337', '#c49e48', '#d9b65f'];

export function build(api) {
  const R = api.ramps, g = api.group();
  const wall = api.lambert(api.pick(['#e6d3b0', '#ead9bb', '#e2c896']));
  const lean = api.range(-0.035, 0.035);   // the roof sits a little askew

  // a flat rubble footing, then the block (Lambert: the thatch throws a deep shadow on it)
  const bx = -0.3, bz = -0.1, W = 2.0, D = 1.9, H = 1.7;
  g.add(api.box({ w: W + 0.2, h: 0.14, d: D + 0.2, x: bx, y: 0.07, z: bz, ramp: R.LIMESTONE, lift: -0.06 }));
  g.add(api.box({ w: W, h: H, d: D, x: bx, y: 0.14 + H / 2, z: bz, mat: wall }));

  // the thatch: a deep gable with a heavy overhang and a rolled ridge
  const eaves = 0.14 + H, rh = 1.2;
  g.add(api.gableRoof({ w: W, d: D, h: rh, overhang: 0.38, x: bx, y: eaves + 0.03, z: bz, rz: lean, ramp: THATCH, speck: 0.32 }));
  g.add(api.cylinder({ r: 0.15, h: W + 0.8, seg: 12, x: bx, y: eaves + 0.03 + rh + 0.02, z: bz, rz: Math.PI / 2 + lean, ramp: THATCH, lift: -0.08 }));
  // fat rolled eaves front and back (thatch is thick)
  const over = 0.38, slope = rh / (D / 2), drop = over * slope, ez = D / 2 + over - 0.06;
  [-1, 1].forEach(s => g.add(api.cylinder({ r: 0.12, h: W + 0.76, seg: 10, x: bx, y: eaves + 0.03 - drop + 0.06, z: bz + s * ez, rz: Math.PI / 2 + lean, ramp: THATCH, lift: -0.04 })));

  // front (+z) face at z = bz + D/2: a plain door under a wooden lintel, a stone step
  const fz = bz + D / 2;
  g.add(api.inkDoor({ w: 0.7, h: 1.3, x: bx - 0.35, y: 0.14, z: fz, arched: false, frame: false }));
  g.add(api.box({ w: 0.95, h: 0.12, d: 0.14, x: bx - 0.35, y: 0.14 + 1.36, z: fz + 0.05, ramp: R.WOOD }));
  g.add(api.box({ w: 0.9, h: 0.1, d: 0.34, x: bx - 0.35, y: 0.05, z: fz + 0.22, ramp: R.LIMESTONE }));
  // the lit left face gets a small window with red shutters (the one accent)
  g.add(api.inkWindow({ w: 0.42, h: 0.46, x: bx - W / 2, y: 1.05, z: bz + 0.1, rot: -Math.PI / 2, shutters: R.REDWALL, frame: R.WOOD }));
  // and a tiny square one on the front
  g.add(api.inkWindow({ w: 0.36, h: 0.36, x: bx + 0.55, y: 1.15, z: fz, frame: R.WOOD }));

  // reed lean-to on the right: two posts and a sloped mat, firewood stacked under it
  const lx = bx + W / 2 + 0.38;
  [[-0.75], [0.55]].forEach(([z]) => g.add(api.box({ w: 0.1, h: 1.25, d: 0.1, x: lx + 0.24, y: 0.625, z: bz + z, ramp: R.WOOD })));
  g.add(api.box({ w: 0.78, h: 0.07, d: 1.75, x: lx + 0.02, y: 1.42, z: bz - 0.1, rz: -0.32, ramp: THATCH, lift: 0.04 }));
  const logs = api.group({ x: lx - 0.04, z: bz - 0.1 });
  const rows = [[0.11, [-0.2, 0, 0.2]], [0.29, [-0.1, 0.1]], [0.47, [0]]];
  rows.forEach(([y, xs]) => xs.forEach(x => logs.add(api.cylinder({ r: 0.1, h: 1.2, seg: 10, x, y, rx: Math.PI / 2, ramp: R.WOOD, lift: api.range(-0.05, 0.08) }))));
  g.add(logs);

  // a rain barrel at the front-left corner (the roof leaks)
  g.add(api.barrel({ r: 0.24, h: 0.6, x: bx - W / 2 + 0.05, z: fz + 0.32 }));

  // keylines: one smooth block for the walls, one for the log pile
  api.proxy(api.boxGeo({ w: W, h: H, d: D, x: bx, y: 0.14 + H / 2, z: bz }), g);
  api.proxy(api.boxGeo({ w: 0.62, h: 0.58, d: 1.2, x: lx - 0.04, y: 0.29, z: bz - 0.1 }), g);
  return g;
}
