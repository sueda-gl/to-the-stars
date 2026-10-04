// Olive press: a limestone press-house under a terracotta gable, two big ink-dark arches in its front; before it,
// the long timber beam of a lever press runs out from the wall over a stack of rope baskets, a stone weight
// hanging at its tip; on the right the round stone mill (a trapetum) where an upright millstone rolls round its
// basin of dark olive paste, pushed by a sweep beam; tall oil jars against the wall and olive trees about it.
// Doubles as a winery / wine press. From above: one gable roof, a ring of stone with a dark green centre, a long
// beam. Footprint 9.5 x 6.6, the arches face +z.
export const meta = {
  id: 'olive-press', name: 'Olive press',
  aliases: ['olive press', 'olive presses', 'oil press', 'olive mill', 'press house', 'winery', 'wineries', 'wine press', 'winepress', 'vintner', 'zeytinyağı', 'zeytinyağı fabrikası', 'yağhane', 'mengene', 'şaraphane', 'bağevi'],
  category: 'building', stage: 'village', footprint: { w: 9.5, d: 6.6 }, height: 4.4,
  desc: 'A limestone press-house with a lever beam press, a round stone olive mill that turns, oil jars and olive trees.'
};

export function build(api) {
  const R = api.ramps, g = api.group();
  const P = 0.14;
  const stone = api.lambert('#e6d6b6');
  const PASTE = ['#1d1810', '#2b2416', '#3a321d', '#4a4124', '#58502c'];
  g.add(api.box({ w: 6.4, h: P, d: 5.0, y: P / 2, ramp: R.LIMESTONE, speck: 0.22 }));

  // ---- the press-house ----
  const hx = -1.0, hz = -1.35, hw = 4.2, hd = 2.3, hh = 3.0, front = hz + hd / 2;
  g.add(api.box({ w: hw, h: hh, d: hd, x: hx, y: P + hh / 2, z: hz, mat: stone }));
  g.add(api.gableRoof({ w: hw, d: hd, h: 1.1, overhang: 0.26, x: hx, y: P + hh, z: hz, ramp: R.TERRACOTTA }));
  g.add(api.inkDoor({ w: 1.15, h: 2.05, x: hx - 0.25, y: P, z: front, frame: R.LIMESTONE }));
  g.add(api.inkDoor({ w: 1.15, h: 2.05, x: hx + 1.35, y: P, z: front, frame: R.LIMESTONE }));
  g.add(api.inkWindow({ w: 0.5, h: 0.6, x: hx - hw / 2, y: P + 1.9, z: hz, rot: -Math.PI / 2, shutters: R.SAGE }));

  // ---- the lever press: a beam from a socket in the wall over the baskets to a hanging stone ----
  const bx = -2.45, y0 = P + 2.1, y1 = P + 1.0, z0 = front, z1 = 2.25;
  const ang = Math.atan2(y0 - y1, z1 - z0), L = Math.hypot(z1 - z0, y0 - y1);
  g.add(api.box({ w: 0.28, h: 0.3, d: L, x: bx, y: (y0 + y1) / 2, z: (z0 + z1) / 2, rx: ang, ramp: R.WOOD }));
  [-0.32, 0.32].forEach(dx => g.add(api.box({ w: 0.14, h: 2.0, d: 0.14, x: bx + dx, y: P + 1.0, z: 0.3, ramp: R.WOOD, lift: -0.05 })));
  g.add(api.cylinder({ r: 0.62, h: 0.26, x: bx, y: P + 0.13, z: 0.55, ramp: R.LIMESTONE, lift: -0.05, seg: 20 }));
  for (let i = 0; i < 5; i++) g.add(api.cylinder({ r: 0.42 - (i % 2) * 0.03, h: 0.11, x: bx, y: P + 0.32 + i * 0.12, z: 0.55, ramp: R.SAND, lift: 0.04 * (i % 2), seg: 16 }));
  g.add(api.cylinder({ r: 0.36, h: 0.5, x: bx, y: P + 0.55, z: z1 + 0.05, ramp: R.LIMESTONE, lift: 0.05, seg: 14 }));
  g.add(api.pot({ r: 0.2, h: 0.36, plant: false, x: bx + 0.75, y: P, z: 0.95, ramp: R.TERRACOTTA }));

  // ---- the round mill: a stone basin, the dark paste, a millstone rolling round a post on its sweep ----
  const mx = 1.85, mz = 0.85, br = 1.15, bh = 0.62;
  g.add(api.cylinder({ rb: br + 0.05, rt: br, h: bh, x: mx, y: P + bh / 2, z: mz, ramp: R.LIMESTONE, seg: 28 }));
  g.add(api.colourOnly(api.cylinder({ r: br - 0.16, h: 0.03, x: mx, y: P + bh + 0.005, z: mz, ramp: PASTE, speck: 0.3, seg: 28 })));
  g.add(api.cylinder({ r: 0.11, h: 1.35, x: mx, y: P + bh + 0.6, z: mz, ramp: R.WOOD, seg: 10 }));
  const mill = api.group({ x: mx, y: P + bh, z: mz }); mill.name = 'mill';
  mill.add(api.cylinder({ r: 0.5, h: 0.3, x: 0.52, y: 0.5, rz: Math.PI / 2, ramp: R.LIMESTONE, lift: 0.08, seg: 20 }));
  mill.add(api.box({ w: 2.45, h: 0.14, d: 0.14, x: 1.0, y: 0.52, ramp: R.WOOD }));
  g.add(mill);

  // ---- oil jars against the wall, olive trees ----
  const jar = [[0, 0], [0.22, 0.04], [0.36, 0.4], [0.38, 0.7], [0.27, 1.0], [0.16, 1.1], [0.2, 1.14], [0.12, 1.15]];
  [[1.7, -1.45], [2.45, -1.6], [3.0, -1.0]].forEach(([x, z], i) => g.add(api.lathe({ points: jar, seg: 16, x, y: P, z, ramp: R.TERRACOTTA, lift: 0.04 * i })));
  const kinds = ['olive', 'olive', 'olive', 'lemon', 'cypress', 'oak'];
  [[-3.55, -2.3], [3.4, -2.55], [-0.2, -3.0]].forEach(([x, z]) => { const k = api.pick(kinds); g.add(api.tree({ kind: k, h: k === 'cypress' ? 4.2 : k === 'oak' ? 3.6 : 2.9, x, z })); });

  api.proxy(api.boxGeo({ w: hw, h: hh, d: hd, x: hx, y: P + hh / 2, z: hz }), g);
  api.proxy(api.cylinderGeo({ r: br + 0.05, h: bh, x: mx, y: P + bh / 2, z: mz, seg: 28 }), g);
  api.proxy(api.cylinderGeo({ r: 0.44, h: 0.62, x: bx, y: P + 0.56, z: 0.55, seg: 16 }), g);
  return g;
}

export function animate(obj, t) {
  const m = obj.getObjectByName('mill'); if (m) m.rotation.y = -0.35 * t;
}
