// Sawmill: a limestone mill-house, its gable end to the front, beside a stone-lined mill race where a big timber
// water wheel turns in the blue water; on the left an open saw-house (a little tile roof on four posts) where a
// frame saw rises and falls through a log on its carriage; a log pile behind, a sticker stack of sawn planks in
// front, and a tree. From above: a gable roof, a blue stripe of water with the round wheel in it, a small roof
// over a long log, golden planks. Footprint 7.6 x 6.4, the doors face +z.
export const meta = {
  id: 'sawmill', name: 'Sawmill',
  aliases: ['sawmill', 'sawmills', 'saw mill', 'lumber mill', 'timber mill', 'water mill', 'watermill', 'mill wheel', 'water wheel', 'hızar', 'bıçkıhane', 'kereste atölyesi', 'su değirmeni'],
  category: 'building', stage: 'village', footprint: { w: 7.6, d: 6.4 }, height: 4.2,
  desc: 'A mill-house with a turning water wheel in a stone race, an open saw-house with a frame saw, logs and planks.'
};

const PLANK = ['#5e3b20', '#84582f', '#a87443', '#c08a55', '#d29f68'];
const WATER = ['#0f2c3a', '#143f50', '#1a5163', '#236072', '#2c6c7d'];   // fresh-sawn pine

export function build(api) {
  const R = api.ramps, g = api.group();
  const P = 0.12;
  // the timber yard: a beaten-earth slab (the race runs past its right edge)
  g.add(api.box({ w: 6.0, h: P, d: 5.2, x: -0.45, y: P / 2, ramp: R.SAND, speck: 0.26 }));

  // ---- the mill race: two stone walls, water between ----
  const cx = 3.25, cw = 1.0;
  [cx - cw / 2 - 0.15, cx + cw / 2 + 0.15].forEach(x => g.add(api.box({ w: 0.3, h: 0.55, d: 5.3, x, y: 0.275, z: 0, ramp: R.LIMESTONE, speck: 0.3 })));
  g.add(api.box({ w: cw, h: 0.1, d: 5.3, x: cx, y: 0.2, z: 0, ramp: WATER, speck: 0.14 }));

  // ---- the mill-house ----
  const hx = 1.0, hz = -0.6, hw = 2.2, hd = 3.0, hh = 2.9;
  const stone = api.lambert('#e6d6b6');
  g.add(api.box({ w: hw, h: hh, d: hd, x: hx, y: P + hh / 2, z: hz, mat: stone }));
  g.add(api.gableRoof({ w: hd, d: hw, h: 1.05, overhang: 0.24, x: hx, y: P + hh, z: hz, rot: Math.PI / 2, ramp: R.TERRACOTTA }));
  g.add(api.inkDoor({ w: 1.0, h: 1.7, x: hx, y: P, z: hz + hd / 2, arched: false, frame: R.WOOD }));
  g.add(api.inkWindow({ w: 0.45, h: 0.45, x: hx, y: P + 2.45, z: hz + hd / 2, frame: false }));
  g.add(api.inkWindow({ w: 0.55, h: 0.65, x: hx - hw / 2, y: P + 1.6, z: hz - 0.4, rot: -Math.PI / 2, shutters: R.SAGE }));

  // ---- the water wheel (turns about x) and its axle into the house ----
  const WR = 1.3, wy = 1.25, wz = -0.55;
  g.add(api.cylinder({ r: 0.09, h: cx - (hx + hw / 2) + 0.1, x: (cx + hx + hw / 2) / 2, y: wy, z: wz, rz: Math.PI / 2, ramp: R.IRON, seg: 10 }));
  const wheel = api.group({ x: cx, y: wy, z: wz }); wheel.name = 'wheel';
  [-0.3, 0.3].forEach(x => {
    wheel.add(api.torus({ r: WR - 0.06, tube: 0.07, flat: false, rot: Math.PI / 2, x, ramp: R.WOOD, seg: 32 }));
    for (let k = 0; k < 4; k++) wheel.add(api.box({ w: 0.08, h: WR * 2 - 0.1, d: 0.1, x, rx: k * Math.PI / 4, ramp: R.WOOD, lift: -0.05 }));
  });
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * Math.PI * 2, rr = WR - 0.2;
    wheel.add(api.box({ w: 0.72, h: 0.42, d: 0.06, y: Math.cos(a) * rr, z: Math.sin(a) * rr, rx: a, ramp: R.WOOD, lift: 0.06 }));
  }
  wheel.add(api.cylinder({ r: 0.2, h: 0.8, rz: Math.PI / 2, ramp: R.WOOD, lift: -0.1, seg: 12 }));
  g.add(wheel);
  api.spin(wheel, { axis: 'x', speed: -0.5 });

  // ---- the saw-house: four posts, a small tile roof, a frame saw over a log on its carriage ----
  const sx = -1.75, sz = -0.35;
  [-0.48, 0.48].forEach(dx => g.add(api.box({ w: 0.1, h: 0.1, d: 4.0, x: sx + dx, y: P + 0.05, z: sz + 0.1, ramp: R.WOOD, lift: -0.1 })));   // rails
  g.add(api.cylinder({ r: 0.38, h: 3.3, x: sx, y: P + 0.48, z: sz - 0.2, rx: Math.PI / 2, ramp: R.WOOD, lift: 0.08, seg: 16 }));         // the log
  g.add(api.box({ w: 0.62, h: 0.09, d: 1.1, x: sx, y: P + 0.86, z: sz + 1.25, ramp: PLANK, lift: 0.04 }));                                   // a slab just sawn
  const posts = [[-1.0, -0.75], [1.0, -0.75], [-1.0, 0.75], [1.0, 0.75]];
  posts.forEach(([dx, dz]) => g.add(api.box({ w: 0.16, h: 2.8, d: 0.16, x: sx + dx, y: P + 1.4, z: sz + dz, ramp: R.WOOD })));
  g.add(api.box({ w: 2.1, h: 0.16, d: 0.16, x: sx, y: P + 2.25, z: sz, ramp: R.WOOD }));   // the frame's top beam
  g.add(api.gableRoof({ w: 2.0, d: 1.5, h: 0.6, overhang: 0.2, x: sx, y: P + 2.8, z: sz, ramp: R.TERRACOTTA }));
  // the saw sash: a rectangle of timber with the blade down its middle (rises and falls)
  const sash = api.group({ x: sx, y: P + 1.35, z: sz }); sash.name = 'sash';
  [-0.4, 0.4].forEach(dx => sash.add(api.box({ w: 0.08, h: 1.5, d: 0.08, x: dx, ramp: R.WOOD, lift: 0.05 })));
  [-0.72, 0.72].forEach(dy => sash.add(api.box({ w: 0.88, h: 0.08, d: 0.08, y: dy, ramp: R.WOOD, lift: 0.05 })));
  sash.add(api.box({ w: 0.04, h: 1.4, d: 0.16, ramp: R.IRON, lift: 0.15 }));
  g.add(sash);

  // ---- logs behind, planks in front ----
  const lx = -3.0;
  [[-0.27, 0], [0.27, 0], [0, 0.44]].forEach(([dx, dy], i) => g.add(api.cylinder({ r: 0.25, h: 2.4, x: lx + dx, y: P + 0.25 + dy, z: -1.1, rx: Math.PI / 2, ramp: R.WOOD, lift: 0.04 * i, seg: 12 })));
  for (let l = 0; l < 3; l++) {
    for (let i = 0; i < 4; i++) g.add(api.box({ w: 1.9, h: 0.08, d: 0.24, x: -1.3, y: P + 0.12 + l * 0.15, z: 1.75 + i * 0.27, ramp: PLANK, lift: 0.05 * ((i + l) % 2) }));
    if (l < 2) [-0.75, 0, 0.75].forEach(dx => g.add(api.colourOnly(api.box({ w: 0.06, h: 0.06, d: 1.15, x: -1.3 + dx, y: P + 0.19 + l * 0.15, z: 2.15, ramp: R.WOOD }))));
  }
  const kind = api.pick(['pine', 'olive', 'oak', 'cypress', 'pine']);
  g.add(api.tree({ kind, h: kind === 'cypress' ? 4.6 : kind === 'pine' ? 5.0 : 3.6, x: -0.35, z: -2.45 }));

  api.proxy(api.boxGeo({ w: hw, h: hh, d: hd, x: hx, y: P + hh / 2, z: hz }), g);
  api.proxy(api.cylinderGeo({ r: WR + 0.02, h: 0.75, x: cx, y: wy, z: wz, rz: Math.PI / 2, seg: 32 }), g);
  api.proxy(api.boxGeo({ w: 1.95, h: 0.45, d: 1.15, x: -1.3, y: P + 0.3, z: 2.15 }), g);
  return g;
}

export function animate(obj, t) {
  const w = obj.getObjectByName('wheel'); if (w) w.rotation.x = -0.5 * t;
  const s = obj.getObjectByName('sash'); if (s) { if (s.userData.y0 === undefined) s.userData.y0 = s.position.y; s.position.y = s.userData.y0 + 0.28 * Math.sin(t * 2.6); }
}
