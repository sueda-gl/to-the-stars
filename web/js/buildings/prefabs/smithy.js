// Smithy: a limestone forge-house under a terracotta gable, and against its right side its stone chimney breast
// and an open-air hearth whose coals glow orange up at the sky, the square stack smoking past the eaves, a tile
// lean-to over the fuel at the back; in front of it the anvil on its stump with a bar still glowing, a quench
// trough, a cart wheel waiting for its tyre, a barrel and one tree. From above: a gable, a mono-pitch, a tall
// square stack with a long shadow, and one hot orange spot. Footprint 7 x 5.6, front faces +z.
export const meta = {
  id: 'smithy', name: 'Smithy',
  aliases: ['smithy', 'smithies', 'forge', 'forges', 'blacksmith', 'blacksmiths', 'smith', 'ironworks', 'demirci', 'demirhane', 'nalbant'],
  category: 'building', stage: 'village', footprint: { w: 7, d: 5.6 }, height: 7.7,
  desc: 'A limestone forge-house with an open shed: glowing hearth, smoking chimney, anvil and quench trough.'
};

const GLOW = ['#6e1a0c', '#b0301a', '#e0501f', '#f47a2a', '#ffa847'];

export function build(api) {
  const R = api.ramps, g = api.group();
  const stone = api.lambert('#e6d6b6');
  const P = 0.2;

  // plinth
  g.add(api.box({ w: 5.0, h: P, d: 4.3, y: P / 2, z: -0.1, ramp: R.LIMESTONE, speck: 0.22 }));

  // ---- the forge-house (left): x -2.4..0.4, z -2.1..0.9 ----
  const hx = -1.0, hz = -0.6, hw = 2.8, hd = 3.0, hh = 2.6;
  g.add(api.box({ w: hw, h: hh, d: hd, x: hx, y: P + hh / 2, z: hz, mat: stone }));
  g.add(api.gableRoof({ w: hw, d: hd, h: 1.15, overhang: 0.24, x: hx, y: P + hh, z: hz, ramp: R.TERRACOTTA }));
  const front = hz + hd / 2;
  g.add(api.inkDoor({ w: 1.1, h: 1.85, x: hx - 0.45, y: P, z: front, frame: R.LIMESTONE }));
  g.add(api.inkWindow({ w: 0.55, h: 0.7, x: hx + 0.75, y: P + 1.55, z: front, shutters: R.SLATE }));
  g.add(api.inkWindow({ w: 0.5, h: 0.6, x: hx - hw / 2, y: P + 1.6, z: hz, rot: -Math.PI / 2 }));

  // ---- the forge (right of the house, in the open so the coals glow up at the sky) ----
  // a stone chimney breast against the house's side wall, its square stack climbing past the eaves
  const wallX = hx + hw / 2;
  const fz = -0.55;
  g.add(api.box({ w: 0.75, h: 2.1, d: 1.1, x: wallX + 0.375, y: P + 1.05, z: fz, mat: stone }));
  g.add(api.box({ w: 0.6, h: 3.3, d: 0.6, x: wallX + 0.32, y: P + 2.1 + 1.65, z: fz - 0.1, mat: stone }));
  g.add(api.box({ w: 0.76, h: 0.14, d: 0.76, x: wallX + 0.32, y: P + 5.45, z: fz - 0.1, ramp: R.TERRACOTTA }));
  // the hearth: a waist-high stone block, the coals glowing in a bed on its top, an iron fire-back
  const fx = wallX + 1.25;
  g.add(api.box({ w: 1.25, h: 0.8, d: 1.15, x: wallX + 1.0, y: P + 0.4, z: fz, ramp: R.LIMESTONE, lift: -0.04 }));
  g.add(api.box({ w: 0.08, h: 0.75, d: 1.0, x: wallX + 0.78, y: P + 1.15, z: fz, ramp: R.IRON }));
  const ember = api.sphere({ r: 0.46, sy: 0.34, sz: 1.05, x: fx, y: P + 0.82, z: fz, ramp: GLOW, lift: 0.12, speck: 0.3, seg: 16 });
  ember.name = 'ember'; g.add(ember);
  // the bellows, a dark leather wedge behind the hearth
  g.add(api.sphere({ r: 0.4, sx: 0.85, sy: 0.38, x: fx - 0.1, y: P + 0.62, z: fz - 0.95, rot: 0.3, ramp: R.WOOD, lift: -0.15 }));

  // a lean-to over the fuel at the back right, on two posts, its tile roof falling to +x
  const sx0 = wallX, sx1 = 2.45, lz = -1.75, ld = 1.0;
  [[sx1 - 0.08, lz + ld / 2 - 0.05]].forEach(([x, z]) => g.add(api.box({ w: 0.14, h: 1.9, d: 0.14, x, y: P + 0.95, z, ramp: R.WOOD })));
  const yHi = P + 2.3, yLo = P + 1.85, run = sx1 + 0.25 - sx0, ang = Math.atan2(yHi - yLo, run), L = Math.hypot(run, yHi - yLo);
  g.add(api.box({ w: L, h: 0.13, d: ld + 0.3, x: (sx0 + sx1 + 0.25) / 2, y: (yHi + yLo) / 2 + 0.07, z: lz, rz: -ang, ramp: R.TERRACOTTA }));
  for (let i = 0; i < 3; i++) g.add(api.cylinder({ r: 0.13, h: 1.5, x: 1.1 + i * 0.03, y: P + 0.13 + i * 0.24, z: lz - 0.1 + (i % 2) * 0.12, rz: Math.PI / 2, ramp: R.WOOD, lift: 0.05 * i, seg: 10 }));

  // the anvil on its stump, a bar glowing on it, and the quench trough
  const ax = 1.55, az = 0.75;
  g.add(api.cylinder({ rb: 0.32, rt: 0.28, h: 0.5, x: ax, y: P + 0.25, z: az, ramp: R.WOOD }));
  g.add(api.box({ w: 0.66, h: 0.24, d: 0.28, x: ax, y: P + 0.62, z: az, ramp: R.IRON }));
  g.add(api.cone({ r: 0.12, h: 0.32, x: ax + 0.48, y: P + 0.66, z: az, rz: -Math.PI / 2, ramp: R.IRON }));
  g.add(api.box({ w: 0.5, h: 0.06, d: 0.07, x: ax - 0.05, y: P + 0.77, z: az + 0.04, rot: 0.25, ramp: GLOW, lift: 0.3 }));
  g.add(api.box({ w: 0.5, h: 0.45, d: 1.05, x: 2.15, y: P + 0.225, z: -0.45, ramp: R.LIMESTONE }));
  g.add(api.box({ w: 0.36, h: 0.02, d: 0.9, x: 2.15, y: P + 0.455, z: -0.45, ramp: R.SEA }));

  // yard: a cart wheel leaning on the post, a heap of charcoal and two sacks, a barrel, a tree behind
  const wh = api.wheel({ r: 0.52, x: 2.62, y: 0.58, z: -1.75 }); wh.rotation.z = 0.16; g.add(wh);
  g.add(api.cone({ r: 0.6, h: 0.55, x: 0.1, y: P + 0.27, z: 1.45, seg: 9, ramp: R.IRON, lift: -0.05, speck: 0.3 }));
  g.add(api.sphere({ r: 0.28, sy: 0.85, x: -0.65, y: P + 0.22, z: 1.55, ramp: R.SAND }));
  g.add(api.sphere({ r: 0.25, sy: 0.85, x: -0.6, y: P + 0.2, z: 1.0, ramp: R.SAND, lift: -0.05 }));
  g.add(api.barrel({ r: 0.3, h: 0.8, x: -2.15, y: P, z: 1.35 }));
  const kind = api.pick(['olive', 'oak', 'lemon', 'pine', 'cypress', 'olive']);
  g.add(api.tree({ kind, h: kind === 'cypress' ? 4.4 : kind === 'pine' ? 4.6 : 3.2, x: -2.75, z: -2.2 }));

  // smoke: soft grey puffs rising from the stack (animated below)
  const smoke = api.group({ x: wallX + 0.32, y: P + 5.55, z: fz - 0.1 }); smoke.name = 'smoke';
  const puff = api.clay('#e4ddd2', '#bdb3a6', '#8f8578');
  for (let i = 0; i < 3; i++) { const p = api.sphere({ r: 0.34, y: 0.3 + i * 0.55, x: i * 0.15, mat: puff, seg: 14 }); p.name = 'puff' + i; p.castShadow = false; api.colourOnly(p); smoke.add(p); }
  g.add(smoke);

  // keylines
  api.proxy(api.boxGeo({ w: hw, h: hh, d: hd, x: hx, y: P + hh / 2, z: hz }), g);
  api.proxy(api.boxGeo({ w: 0.6, h: 3.3, d: 0.6, x: wallX + 0.32, y: P + 3.75, z: fz - 0.1 }), g);
  return g;
}

// the coals breathe, the smoke rises
export function animate(obj, t) {
  const e = obj.getObjectByName('ember');
  if (e) { const k = 1 + 0.08 * Math.sin(t * 3.1) + 0.05 * Math.sin(t * 7.3); e.scale.set(k, 0.9 + 0.2 * (k - 0.9), k); }
  const smoke = obj.getObjectByName('smoke'); if (!smoke) return;
  for (let i = 0; i < 3; i++) {
    const p = smoke.getObjectByName('puff' + i); if (!p) continue;
    const k = (t * 0.2 + i / 3) % 1;
    p.position.set(0.05 + k * 0.6, 0.1 + k * 1.9, -k * 0.25);
    p.scale.setScalar(Math.max(0.001, Math.sin(k * Math.PI) * (0.7 + k * 0.7)));
  }
}
