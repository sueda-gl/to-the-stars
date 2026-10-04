// Cow pasture: a green meadow in a post-and-rail fence with an open gate, a long stone water trough, a wooden
// hay rack under a little terracotta roof, two shade trees of mixed kinds, and three cows (pale Podolica grey,
// fawn, chestnut) with lyre horns. Heads dip to graze and tails swish (animate). From above: a green patch with
// a ruled fence line, three solid cow shapes with long shadows, the red roof as the accent. Footprint 12 x 9.
export const meta = {
  id: 'cow-pasture', name: 'Cow pasture',
  aliases: ['cows', 'cow', 'cattle', 'pasture', 'meadow', 'herd', 'cattle pasture', 'cow field', 'oxen', 'inek', 'inekler', 'sığır', 'mera', 'otlak'],
  category: 'animal', stage: 'village', footprint: { w: 12, d: 9 }, height: 4.2,
  desc: 'A fenced green meadow with three grazing cows, a stone trough, a hay rack and shade trees.'
};

const GRASS = ['#4f5a2a', '#6b7637', '#87914a', '#9fa65c', '#b3b76c'];
const HOOF = ['#231b19', '#33282a', '#463839', '#584846', '#6a5853'];
const HORN = ['#6b604e', '#938571', '#b8a98e', '#d3c6a8', '#e6dcc2'];
const MUZZLE = ['#4a3a36', '#6a5650', '#8a7369', '#a58d80', '#b9a293'];
const COATS = [
  ['#7d786e', '#a39d90', '#c3bcac', '#d8d1c0', '#e8e2d2'],   // pale grey Podolica
  ['#7a5326', '#a0702f', '#c08f45', '#d4a75c', '#e1ba72'],   // fawn
  ['#3f2014', '#5f301b', '#7f4224', '#97532d', '#aa6437']    // chestnut
];

// a cow facing +z: a deep boxy barrel on straight legs, a named neck+head pivot, a named tail
function cow(api, o) {
  const s = o.s || 1, coat = COATS[o.coat % COATS.length], g = api.group({ x: o.x, z: o.z, rot: o.rot || 0 });
  [[-0.2, 0.55], [0.2, 0.55], [-0.2, -0.55], [0.2, -0.55]].forEach(([x, z]) => {
    g.add(api.cylinder({ rt: 0.1 * s, rb: 0.07 * s, h: 0.66 * s, x: x * s, y: 0.33 * s, z: z * s, ramp: coat, seg: 7, lift: -0.06 }));
    g.add(api.cylinder({ r: 0.065 * s, h: 0.1 * s, x: x * s, y: 0.05 * s, z: z * s, ramp: HOOF, seg: 7 }));
  });
  // barrel, shoulders and hips: three masses under one outline
  g.add(api.sphere({ r: 0.52 * s, sx: 0.8, sy: 0.9, sz: 1.5, y: 0.98 * s, ramp: coat, speck: 0.2, seg: 20 }));
  g.add(api.sphere({ r: 0.42 * s, sx: 1.0, sy: 1.0, y: 1.04 * s, z: 0.42 * s, ramp: coat, speck: 0.2, seg: 14 }));
  g.add(api.sphere({ r: 0.41 * s, sx: 1.0, sy: 0.98, y: 1.06 * s, z: -0.48 * s, ramp: coat, speck: 0.2, lift: 0.04, seg: 14 }));
  g.add(api.box({ w: 0.62 * s, h: 0.5 * s, d: 0.95 * s, y: 1.02 * s, ramp: coat, speck: 0.2 }));   // squares the back: a cow, not a deer
  api.proxy(api.sphereGeo({ r: 0.58 * s, sx: 0.8, sy: 0.9, sz: 1.55, y: 1.0 * s, seg: 18 }), g);
  // neck + head on one pivot at the shoulders
  const head = api.group({ y: 1.12 * s, z: 0.68 * s }); head.name = 'graze';
  head.userData.ph = api.range(0, 6.28); head.userData.sp = api.range(0.25, 0.42);
  head.add(api.cylinder({ rt: 0.2 * s, rb: 0.27 * s, h: 0.42 * s, y: 0.02 * s, z: 0.14 * s, rx: 1.05, ramp: coat, seg: 10 }));
  head.add(api.cylinder({ rt: 0.14 * s, rb: 0.2 * s, h: 0.55 * s, y: -0.02 * s, z: 0.5 * s, rx: 2.05, ramp: coat, seg: 10 }));
  head.add(api.sphere({ r: 0.16 * s, sx: 1.05, sy: 0.78, y: -0.22 * s, z: 0.66 * s, ramp: MUZZLE, seg: 10 }));
  [-1, 1].forEach(sd => {
    head.add(api.box({ w: 0.2 * s, h: 0.05 * s, d: 0.1 * s, x: sd * 0.2 * s, y: 0.17 * s, z: 0.36 * s, rot: sd * 0.25, rz: sd * -0.3, ramp: coat }));
    head.add(api.tube({ points: [[sd * 0.08 * s, 0.2 * s, 0.4 * s], [sd * 0.2 * s, 0.25 * s, 0.4 * s], [sd * 0.27 * s, 0.4 * s, 0.36 * s], [sd * 0.24 * s, 0.5 * s, 0.33 * s]], r: 0.03 * s, seg: 10, ramp: HORN }));
  });
  head.rotation.x = o.graze ? 0.85 : 0;
  g.add(head);
  // the tail hangs from the hips; it swishes
  const tail = api.group({ y: 1.22 * s, z: -0.86 * s }); tail.name = 'tail'; tail.userData.ph = api.range(0, 6.28);
  tail.add(api.tube({ points: [[0, 0, 0], [0, -0.25 * s, -0.08 * s], [0, -0.62 * s, -0.06 * s]], r: 0.025 * s, seg: 8, ramp: coat }));
  tail.add(api.sphere({ r: 0.06 * s, sy: 1.6, y: -0.68 * s, z: -0.06 * s, ramp: HOOF, seg: 8 }));
  g.add(tail);
  return g;
}

export function build(api) {
  const R = api.ramps, g = api.group();
  const W = 11.2, D = 8.2;

  // the meadow: one irregular rounded-rectangle of grass
  const m = [];
  for (let i = 0; i < 36; i++) {
    const a = i / 36 * Math.PI * 2, c = Math.cos(a), sn = Math.sin(a), k = Math.pow(Math.pow(Math.abs(c), 5) + Math.pow(Math.abs(sn), 5), -0.2);
    m.push([c * k * (W / 2 - 0.1) + 0.08 * Math.sin(a * 7), -sn * k * (D / 2 - 0.1) + 0.08 * Math.cos(a * 5)]);
  }
  g.add(api.extrude({ shape: m, depth: 0.05, rx: -Math.PI / 2, y: 0.025, ramp: GRASS, speck: 0.34 }));
  // a worn earth patch at the trough and gate
  const e = [];
  for (let i = 0; i < 20; i++) { const a = i / 20 * Math.PI * 2, r = 1.35 + 0.2 * Math.sin(a * 3 + 1); e.push([Math.cos(a) * r * 1.4, -Math.sin(a) * r * 0.8]); }
  g.add(api.extrude({ shape: e, depth: 0.03, rx: -Math.PI / 2, x: 2.6, y: 0.06, z: 2.7, ramp: ['#6e5638', '#8a6d48', '#a3845a', '#b8996c', '#c8aa7c'], speck: 0.3 }));

  // post-and-rail fence all round, a gap at the front right with the gate swung in
  const hw = W / 2 - 0.25, hd = D / 2 - 0.25;
  g.add(api.fence({ points: [[3.2, hd], [-hw, hd], [-hw, -hd], [hw, -hd], [hw, hd], [4.6, hd]], h: 1.1, gap: 1.4 }));
  g.add(api.fence({ points: [[3.25, hd - 0.1], [3.7, hd - 1.3]], h: 1.0, gap: 0.65 }));

  // the long stone trough by the gate, water in it
  g.add(api.box({ w: 2.0, h: 0.5, d: 0.55, x: 2.3, y: 0.25, z: hd - 1.1, ramp: R.LIMESTONE }));
  g.add(api.box({ w: 1.8, h: 0.04, d: 0.35, x: 2.3, y: 0.51, z: hd - 1.1, ramp: R.SEA, lift: 0.08 }));
  // a hay rack under a little terracotta roof against the back fence
  const hx = -2.0, hz = -hd + 0.75;
  [-0.8, 0.8].forEach(x => [-0.35, 0.35].forEach(z => g.add(api.box({ w: 0.12, h: 1.55, d: 0.12, x: hx + x, y: 0.775, z: hz + z, ramp: R.WOOD }))));
  g.add(api.box({ w: 1.7, h: 0.75, d: 0.6, x: hx, y: 0.75, z: hz, ramp: R.WOOD, lift: -0.06 }));
  g.add(api.dome({ r: 0.6, h: 0.35, sx: 1.35, x: hx, y: 1.12, z: hz, ramp: R.GOLD, speck: 0.3, seg: 14 }));
  g.add(api.gableRoof({ w: 2.0, d: 1.0, h: 0.45, overhang: 0.15, x: hx, y: 1.55, z: hz, ramp: R.TERRACOTTA }));

  // two shade trees, kinds mixed at random
  const kinds = ['oak', 'olive', 'pine', 'oak', 'olive'];
  const k1 = api.pick(kinds), k2 = api.pick(kinds);
  const plant = (kind, x, z, h) => kind === 'pine' ? g.add(api.pine({ h: h * 1.25, r: h * 0.45, lean: 0.5, x, z }))
    : g.add(api.tree({ kind, h, x, z, lean: 0.3, rot: api.range(0, 6.28) }));
  plant(k1, -hw + 1.0, -hd + 1.1, 3.8);
  plant(k2, hw - 1.2, -0.6, 3.2);

  // three cows: two grazing, one standing chewing, facing different ways
  g.add(cow(api, { x: -2.6 + api.range(-0.3, 0.3), z: 0.9, rot: 0.5 + api.range(-0.3, 0.3), coat: 0, graze: true }));
  g.add(cow(api, { x: 0.6, z: -1.4 + api.range(-0.3, 0.3), rot: -1.9 + api.range(-0.3, 0.3), coat: 1, graze: true }));
  g.add(cow(api, { x: 1.4 + api.range(-0.3, 0.3), z: 1.5, rot: 2.6, coat: 2, graze: false, s: 0.95 }));

  api.proxy(api.boxGeo({ w: 1.8, h: 1.55, d: 0.82, x: hx, y: 0.775, z: hz }), g);
  return g;
}

const parts = new WeakMap();
export function animate(obj, t) {
  let p = parts.get(obj);
  if (!p) { p = { heads: [], tails: [] }; obj.traverse(o => { if (o.name === 'graze') p.heads.push(o); else if (o.name === 'tail') p.tails.push(o); }); parts.set(obj, p); }
  for (const o of p.heads) {
    const u = o.userData, c = Math.sin(t * u.sp + u.ph);
    const k = Math.min(1, Math.max(0, (c + 0.45) / 0.45)), e = k * k * (3 - 2 * k);
    o.rotation.x = e * (0.85 + 0.05 * Math.sin(t * 2.6 + u.ph)) + (1 - e) * 0.06 * Math.sin(t * 1.3);
  }
  for (const o of p.tails) {
    const ph = o.userData.ph, burst = Math.max(0, Math.sin(t * 0.5 + ph));
    o.rotation.z = 0.35 * burst * Math.sin(t * 5 + ph);
    o.rotation.x = 0.1 + 0.08 * burst;
  }
}
