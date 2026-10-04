// Stonemason's yard: a red screen wall with two ink-dark arched niches under a tile lean-to at the back (the
// masons' shade), and in front a pale yard white with stone dust: a stack of squared ashlar blocks, two column
// drums lying on the ground, a capital half-carved on its banker, rough boulders fresh from the quarry and a
// timber shear-legs hoist holding a block on its rope. From above: one tile strip, a red wall, pale blocks
// throwing crisp shadows on white dust. Footprint 8.5 x 6.3, the yard opens to +z.
export const meta = {
  id: 'stonemason', name: "Stonemason's yard",
  aliases: ['stonemason', 'stonemasons', 'stonemason yard', "stonemason's yard", 'mason', 'masons', 'masonry', 'stone yard', 'stoneworks', 'stonecutter', 'taşçı', 'taş atölyesi', 'taş ustası'],
  category: 'building', stage: 'village', footprint: { w: 8.5, d: 6.3 }, height: 4.6,
  desc: 'A dusty yard of cut blocks, column drums and a half-carved capital, a shear-legs hoist and a red wall with a tile lean-to.'
};

export function build(api) {
  const R = api.ramps, g = api.group();
  const P = 0.1;
  const DUST = ['#9d958a', '#b9b2a6', '#d2ccc0', '#dfd9cd', '#e8e3d8'];
  g.add(api.box({ w: 6.0, h: P, d: 4.8, y: P / 2, ramp: DUST, speck: 0.3 }));

  // ---- the back: a red screen wall with two niches, a tile lean-to on two posts in front of it ----
  const wz = -2.1, ww = 3.8, wh = 2.6, wx = -0.9;
  g.add(api.box({ w: ww, h: wh, d: 0.4, x: wx, y: P + wh / 2, z: wz, mat: api.lambert('#c23a2c', 0.14) }));
  g.add(api.box({ w: ww + 0.16, h: 0.16, d: 0.52, x: wx, y: P + wh + 0.08, z: wz, ramp: R.LIMESTONE }));
  [-0.9, 0.9].forEach(dx => g.add(api.inkWindow({ w: 0.8, h: 1.4, x: wx + dx, y: P + 1.1, z: wz + 0.2, arched: true, frame: R.LIMESTONE })));
  const zHi = wz + 0.2, zLo = -0.75, yHi = P + 2.4, yLo = P + 1.95, ang = Math.atan2(yHi - yLo, zLo - zHi + 0.25), L = Math.hypot(zLo - zHi + 0.25, yHi - yLo);
  [wx - ww / 2 + 0.2, wx + ww / 2 - 0.2].forEach(x => g.add(api.box({ w: 0.14, h: yLo - P, d: 0.14, x, y: (yLo + P) / 2, z: zLo, ramp: R.WOOD })));
  g.add(api.box({ w: ww + 0.2, h: 0.13, d: L, x: wx, y: (yHi + yLo) / 2 + 0.07, z: (zHi + zLo + 0.25) / 2, rx: ang, ramp: R.TERRACOTTA }));
  // a banker (work bench of stone) under the lean-to with a block on it
  g.add(api.box({ w: 1.4, h: 0.7, d: 0.7, x: wx - 0.4, y: P + 0.35, z: -1.4, ramp: R.LIMESTONE, lift: -0.06 }));
  g.add(api.box({ w: 0.7, h: 0.5, d: 0.55, x: wx - 0.5, y: P + 0.95, z: -1.4, rot: 0.15, ramp: R.LIMESTONE, lift: 0.08 }));

  // ---- the stack of squared blocks (back right) ----
  const bx = 1.75, bz = -1.3;
  g.add(api.box({ w: 1.3, h: 0.7, d: 0.85, x: bx - 0.35, y: P + 0.35, z: bz, ramp: R.LIMESTONE }));
  g.add(api.box({ w: 1.2, h: 0.7, d: 0.85, x: bx + 0.95, y: P + 0.35, z: bz + 0.1, rot: -0.06, ramp: R.LIMESTONE, lift: -0.04 }));
  g.add(api.box({ w: 1.25, h: 0.65, d: 0.8, x: bx + 0.25, y: P + 1.025, z: bz + 0.05, rot: 0.08, ramp: R.LIMESTONE, lift: 0.06 }));
  g.add(api.box({ w: 1.0, h: 0.6, d: 0.75, x: bx + 1.0, y: P + 0.3, z: bz + 1.05, rot: 0.3, ramp: R.LIMESTONE, lift: 0.02 }));

  // ---- column drums lying in the yard; a capital half-carved on a banker ----
  g.add(api.cylinder({ r: 0.42, h: 0.9, x: -2.0, y: P + 0.42, z: 0.75, rz: Math.PI / 2, rot: 0.25, ramp: R.LIMESTONE, seg: 20 }));
  g.add(api.cylinder({ r: 0.42, h: 0.75, x: -1.95, y: P + 0.42, z: 1.75, rz: Math.PI / 2, rot: -0.1, ramp: R.LIMESTONE, lift: 0.05, seg: 20 }));
  const cx = -0.2, cz = 0.85;
  g.add(api.box({ w: 0.9, h: 0.55, d: 0.9, x: cx, y: P + 0.275, z: cz, ramp: R.LIMESTONE, lift: -0.06 }));
  g.add(api.cylinder({ rb: 0.32, rt: 0.42, h: 0.38, x: cx, y: P + 0.74, z: cz, ramp: R.LIMESTONE, lift: 0.05, seg: 20 }));
  g.add(api.box({ w: 0.95, h: 0.2, d: 0.95, x: cx, y: P + 1.03, z: cz, ramp: R.LIMESTONE, lift: 0.1 }));
  // rough boulders fresh from the quarry, and a heap of chips
  g.add(api.sphere({ r: 0.55, seg: 6, sy: 0.72, x: 0.9, y: P + 0.36, z: 1.75, rot: 0.4, ramp: R.LIMESTONE, lift: -0.08, speck: 0.28 }));
  g.add(api.sphere({ r: 0.4, seg: 5, sy: 0.8, x: 1.55, y: P + 0.28, z: 1.95, rot: 1.1, ramp: R.LIMESTONE, lift: -0.04, speck: 0.28 }));
  g.add(api.cone({ r: 0.55, h: 0.3, seg: 10, x: -0.95, y: P + 0.15, z: -0.3, ramp: DUST, speck: 0.35 }));

  // ---- the shear-legs: three poles to an apex, a rope, a block hanging (it sways) ----
  const hx = 1.25, hz = 0.35, top = 3.4;
  [[-1.1, 0.7], [1.1, 0.7], [0, -1.2]].forEach(([dx, dz]) => g.add(api.tube({ points: [[hx + dx, P, hz + dz], [hx, P + top, hz]], r: 0.07, seg: 2, radial: 6, ramp: R.WOOD })));
  g.add(api.cylinder({ r: 0.12, h: 0.2, x: hx, y: P + top - 0.1, z: hz, rz: Math.PI / 2, ramp: R.WOOD, lift: -0.1 }));
  const load = api.group({ x: hx, y: P + top - 0.2, z: hz }); load.name = 'load';
  load.add(api.cylinder({ r: 0.025, h: 1.75, y: -0.875, ramp: R.SAND, seg: 5 }));
  load.add(api.box({ w: 0.8, h: 0.5, d: 0.55, y: -2.0, ramp: R.LIMESTONE, lift: 0.1 }));
  g.add(load);

  const kind = api.pick(['cypress', 'olive', 'pine', 'oak']);
  g.add(api.tree({ kind, h: kind === 'cypress' ? 4.4 : kind === 'pine' ? 4.5 : 3.2, x: 3.3, z: -2.35 }));

  api.proxy(api.boxGeo({ w: ww, h: wh, d: 0.4, x: wx, y: P + wh / 2, z: wz }), g);
  return g;
}

export function animate(obj, t) {
  const l = obj.getObjectByName('load'); if (l) { l.rotation.z = 0.05 * Math.sin(t * 1.1); l.rotation.x = 0.03 * Math.sin(t * 0.8 + 1); }
}
