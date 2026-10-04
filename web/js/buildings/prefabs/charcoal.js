// Charcoal mound: a charcoal burner's clearing. A great dome of earth and turf over the stacked wood smoulders,
// grey smoke rising from its crown and a side vent, little fire-holes glowing round its flank; a ladder leans on
// it; a cross-stacked pile of billets waits beside it; the burner's round hut with a thatched cone roof stands
// at the edge, and trees ring the clearing. From above: a dark round dome with a smoking top, a square pile of
// logs, a cone roof, tree crowns. Footprint 7.8 x 6
export const meta = {
  id: 'charcoal', name: 'Charcoal mound',
  aliases: ['charcoal', 'charcoal mound', 'charcoal kiln', 'charcoal pile', 'charcoal clamp', 'charcoal burner', "collier's mound", 'colliery mound', 'kömür', 'kömür ocağı', 'kömür yığını', 'mangal kömürü'],
  category: 'prop', stage: 'camp', footprint: { w: 7.8, d: 6 }, height: 4.5,
  desc: "A smouldering earth-covered charcoal mound with glowing vents and smoke, a ladder, a log pile and the burner's hut, among trees."
};

const GLOW = ['#6e1a0c', '#b0301a', '#e0501f', '#f47a2a', '#ffa847'];

export function build(api) {
  const R = api.ramps, g = api.group();
  const SOOT = ['#3e352d', '#53483d', '#6a5d4f', '#7d6f5f', '#8c7e6c'];
  const TURF = ['#241e17', '#352b20', '#4a3c2b', '#5b4b36', '#6a5840'];
  const STRAW = ['#5e4a2a', '#7e663c', '#9f8452', '#b59a63', '#c4aa73'];
  g.add(api.cylinder({ r: 2.7, h: 0.05, y: 0.025, x: 0.1, z: -0.4, sz: 0.9, ramp: SOOT, speck: 0.32, seg: 24 }));

  // the mound
  const mx = -0.2, mz = 0.1;
  const prof = [[1.75, 0], [1.7, 0.35], [1.48, 0.9], [1.05, 1.35], [0.5, 1.62], [0.12, 1.7], [0, 1.7]];
  g.add(api.lathe({ points: prof, seg: 28, x: mx, y: 0.04, z: mz, ramp: TURF, speck: 0.36 }));
  g.add(api.colourOnly(api.cylinder({ r: 0.16, h: 0.03, x: mx, y: 1.73, z: mz, ramp: GLOW, lift: 0.1, seg: 10 })));
  [0.6, 2.2, 3.5, 5.0].forEach((a, i) => {
    const r = 1.52, y = 0.75 + (i % 2) * 0.18;
    const v = api.sphere({ r: 0.11, x: mx + Math.sin(a) * (r - (i % 2) * 0.12), y, z: mz + Math.cos(a) * (r - (i % 2) * 0.12), ramp: GLOW, lift: 0.12, seg: 8 });
    v.name = 'vent' + i; v.castShadow = false; api.colourOnly(v); g.add(v);
  });
  // a ladder leaning on the mound's lit flank
  const lad = api.group({ x: mx + 2.05, z: mz + 0.35 }); lad.rotation.y = -0.15;
  const top = [-1.25, 1.45], len = Math.hypot(top[0], top[1]), la = Math.atan2(top[1], -top[0]);
  [-0.22, 0.22].forEach(dz => lad.add(api.box({ w: len, h: 0.07, d: 0.07, x: top[0] / 2, y: top[1] / 2, z: dz, rz: -la, ramp: R.WOOD, lift: 0.06 })));
  for (let i = 1; i < 5; i++) { const f = i / 5; lad.add(api.colourOnly(api.box({ w: 0.05, h: 0.05, d: 0.46, x: top[0] * f, y: top[1] * f, ramp: R.WOOD }))); }
  g.add(lad);

  // the billet pile, cross-stacked (back right)
  const px = 1.95, pz = -1.45;
  for (let l = 0; l < 3; l++) for (let i = 0; i < 4; i++) {
    const along = l % 2 === 0, o = -0.36 + i * 0.24;
    g.add(api.cylinder({ r: 0.11, h: 1.0, x: px + (along ? 0 : o), y: 0.17 + l * 0.21, z: pz + (along ? o : 0), rx: along ? 0 : Math.PI / 2, rz: along ? Math.PI / 2 : 0, ramp: R.WOOD, lift: 0.05 * ((i + l) % 2), seg: 8 }));
  }

  // the burner's hut: a round wattle wall and a thatched cone (back left)
  const hx = -2.05, hz = -1.55;
  g.add(api.cylinder({ r: 0.85, h: 0.75, x: hx, y: 0.375, z: hz, ramp: R.WOOD, lift: 0.08, seg: 16 }));
  g.add(api.cone({ r: 1.12, h: 1.65, x: hx, y: 0.75 + 0.82, z: hz, ramp: STRAW, speck: 0.32, seg: 16 }));
  g.add(api.inkDoor({ w: 0.5, h: 0.72, x: hx + 0.25, y: 0, z: hz + 0.82, rot: 0.3, arched: false, frame: false }));

  // trees round the clearing: each a different painted kind, in a seeded order
  const kinds = ['pine', 'cypress', 'olive', 'oak'], k0 = Math.floor(api.rand() * 4);
  const size = { pine: { h: 4.4, r: 1.5 }, cypress: { h: 4.2 }, olive: { h: 2.8 }, oak: { h: 3.4, r: 1.25 } };
  [[-0.2, -2.75], [2.95, -0.05], [-3.25, -2.85]].forEach(([x, z], i) => { const k = kinds[(k0 + i) % 4]; g.add(api.tree(Object.assign({ kind: k, x, z }, size[k]))); });

  // smoke: from the crown and from one side vent
  const puff = api.clay('#cfc8bd', '#a39b8f', '#766e64');
  [['smoke', mx, 1.9, mz, 3, 0.36], ['smoke2', mx + 0.9, 1.3, mz + 0.9, 2, 0.22]].forEach(([nm, x, y, z, n, r]) => {
    const s = api.group({ x, y, z }); s.name = nm;
    for (let i = 0; i < n; i++) { const p = api.sphere({ r, y: i * 0.5, mat: puff, seg: 12 }); p.name = 'puff' + i; p.castShadow = false; api.colourOnly(p); s.add(p); }
    g.add(s);
  });

  api.proxy(api.latheGeo({ points: prof, seg: 28, x: mx, y: 0.04, z: mz }), g);
  api.proxy(api.boxGeo({ w: 1.0, h: 0.66, d: 1.0, x: px, y: 0.39, z: pz }), g);
  return g;
}

export function animate(obj, t) {
  for (let i = 0; i < 4; i++) { const v = obj.getObjectByName('vent' + i); if (v) v.scale.setScalar(0.85 + 0.2 * Math.sin(t * 2.7 + i * 1.7)); }
  [['smoke', 3, 0.14, 2.4], ['smoke2', 2, 0.2, 1.2]].forEach(([nm, n, sp, hgt]) => {
    const s = obj.getObjectByName(nm); if (!s) return;
    for (let i = 0; i < n; i++) {
      const p = s.getObjectByName('puff' + i); if (!p) continue;
      const k = (t * sp + i / n) % 1;
      p.position.set(k * 0.7, k * hgt, -k * 0.3);
      p.scale.setScalar(Math.max(0.001, Math.sin(k * Math.PI) * (0.7 + k * 0.8)));
    }
  });
}
