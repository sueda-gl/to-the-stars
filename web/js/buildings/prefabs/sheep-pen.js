// Sheep pen: a round dry-stone fold (it reads as a ring from the leader's bird's-eye view) open to the front,
// a little lean-to shelter with a terracotta roof against the back wall, hay under it, a stone water trough,
// a swung-open wooden gate, and a small flock of fluffy cream sheep (one dark one, one lamb) grazing inside and
// out, with one shade tree behind the wall. The sheep's heads dip and lift (animate). Footprint 9 x 8, gate to +z.
export const meta = {
  id: 'sheep-pen', name: 'Sheep pen',
  aliases: ['sheep', 'sheepfold', 'sheep fold', 'fold', 'flock', 'flock of sheep', 'sheep farm', 'lambs', 'ağıl', 'koyun', 'koyunlar', 'koyun ağılı', 'sürü'],
  category: 'animal', stage: 'hamlet', footprint: { w: 9, d: 8 }, height: 4.2,
  desc: 'A round dry-stone fold with a lean-to shelter and a small flock of grazing sheep.'
};

const FLEECE = ['#8d806d', '#b8aa91', '#d8ccb2', '#ece3cd', '#f8f2e1'];
const DARK_FLEECE = ['#2e2522', '#433631', '#5a4a42', '#6d5b51', '#7d6a5e'];
const FACE = ['#231b19', '#33282a', '#463839', '#584846', '#6a5853'];
const EARTH = ['#6e5638', '#8a6d48', '#a3845a', '#b8996c', '#c8aa7c'];
const DRYSTONE = ['#5f5950', '#81796d', '#a29988', '#bdb4a0', '#d2cab6'];   // a cool grey field stone: the ring parts from the warm paper and the earth

// one sheep facing +z in its own group; its head is a named pivot so animate() can dip it
function sheep(api, o) {
  const s = o.s || 1, sh = api.group({ x: o.x, z: o.z, rot: o.rot || 0 });
  const wool = o.dark ? DARK_FLEECE : FLEECE;
  // legs: four short dark sticks
  [[-0.15, 0.27], [0.15, 0.27], [-0.15, -0.27], [0.15, -0.27]].forEach(([x, z]) =>
    sh.add(api.colourOnly(api.cylinder({ r: 0.045 * s, h: 0.36 * s, x: x * s, y: 0.18 * s, z: z * s, ramp: FACE, seg: 6 }))));
  // the fleece: one round body and two fluffy lumps on the back (one outline for all three)
  sh.add(api.sphere({ r: 0.4 * s, sx: 0.95, sy: 0.82, sz: 1.3, y: 0.58 * s, ramp: wool, speck: 0.28, seg: 18 }));
  sh.add(api.sphere({ r: 0.27 * s, y: 0.78 * s, z: -0.16 * s, ramp: wool, speck: 0.3, lift: 0.05, seg: 14 }));
  sh.add(api.sphere({ r: 0.24 * s, y: 0.76 * s, z: 0.2 * s, ramp: wool, speck: 0.3, lift: 0.08, seg: 14 }));
  sh.add(api.sphere({ r: 0.12 * s, y: 0.6 * s, z: -0.52 * s, ramp: wool, seg: 10 }));   // a tuft of a tail
  api.proxy(api.sphereGeo({ r: 0.45 * s, sx: 0.98, sy: 0.92, sz: 1.32, y: 0.62 * s, seg: 18 }), sh);
  // the head: a dark long face with a woolly cap and two ears, pivoting at the neck
  const head = api.group({ y: 0.66 * s, z: 0.44 * s }); head.name = 'graze';
  head.userData.ph = api.range(0, 6.28); head.userData.sp = api.range(0.35, 0.6);
  head.add(api.sphere({ r: 0.13 * s, sx: 0.85, sz: 1.45, y: -0.04 * s, z: 0.14 * s, rx: 0.5, ramp: FACE, seg: 12 }));
  head.add(api.sphere({ r: 0.12 * s, y: 0.05 * s, z: 0.06 * s, ramp: wool, seg: 10 }));
  head.add(api.colourOnly(api.box({ w: 0.36 * s, h: 0.04 * s, d: 0.08 * s, y: 0.03 * s, z: 0.08 * s, ramp: FACE })));
  head.rotation.x = o.graze ? 0.75 : 0.1;
  sh.add(head);
  return sh;
}

export function build(api) {
  const R = api.ramps, g = api.group();
  const cz = -0.3, Rw = 3.15, th = 0.5, wh = 0.78, gap = 0.27;   // fold centre z, wall centre radius, thickness, height, half-gap (rad)

  // trampled earth inside the fold
  const disc = [];
  for (let i = 0; i < 32; i++) { const a = i / 32 * Math.PI * 2, r = Rw - 0.22 + 0.08 * Math.sin(a * 4 + 1); disc.push([Math.sin(a) * r, -(cz + Math.cos(a) * r)]); }
  g.add(api.extrude({ shape: disc, depth: 0.04, rx: -Math.PI / 2, y: 0.02, ramp: EARTH, speck: 0.3 }));

  // the dry-stone ring: an annulus laid flat and raised, open at the front
  const ring = (r0, r1) => {
    const pts = [], n = 28;
    for (let i = 0; i <= n; i++) { const a = gap + (Math.PI * 2 - 2 * gap) * i / n; pts.push([Math.sin(a) * r1, -(cz + Math.cos(a) * r1)]); }
    for (let i = n; i >= 0; i--) { const a = gap + (Math.PI * 2 - 2 * gap) * i / n; pts.push([Math.sin(a) * r0, -(cz + Math.cos(a) * r0)]); }
    return pts;
  };
  g.add(api.extrude({ shape: ring(Rw - th / 2, Rw + th / 2), depth: wh, rx: -Math.PI / 2, y: wh / 2, ramp: DRYSTONE, speck: 0.4 }));
  // gate-post stones at the opening
  [-1, 1].forEach(sd => g.add(api.box({ w: 0.42, h: 1.05, d: 0.42, x: sd * Math.sin(gap) * Rw, y: 0.525, z: cz + Math.cos(gap) * Rw, ramp: DRYSTONE, lift: 0.06 })));

  // the lean-to: a raised back wall on the fold's back arc, two posts, a terracotta slab roof falling to the front
  const bz = cz - Rw + 0.1;
  g.add(api.box({ w: 2.9, h: 1.7, d: 0.5, y: 0.85, z: bz, mat: api.lambert('#e3d2b4') }));
  [-1.25, 1.25].forEach(x => g.add(api.box({ w: 0.14, h: 1.3, d: 0.14, x, y: 0.65, z: bz + 1.45, ramp: R.WOOD })));
  g.add(api.box({ w: 3.2, h: 0.13, d: 1.95, y: 1.5, z: bz + 0.82, rx: 0.27, ramp: R.TERRACOTTA }));
  g.add(api.dome({ r: 0.7, h: 0.55, x: -0.55, y: 0.02, z: bz + 0.75, ramp: R.GOLD, speck: 0.3, seg: 16 }));   // hay in the shade

  // a stone water trough on the lit side, and the gate swung open outward on the right
  g.add(api.box({ w: 0.5, h: 0.42, d: 1.3, x: -2.1, y: 0.21, z: cz + 0.5, ramp: R.LIMESTONE }));
  g.add(api.box({ w: 0.32, h: 0.04, d: 1.1, x: -2.1, y: 0.43, z: cz + 0.5, ramp: R.SEA, lift: 0.08 }));
  const gx = Math.sin(gap) * Rw, gz = cz + Math.cos(gap) * Rw;
  g.add(api.fence({ points: [[gx + 0.15, gz + 0.1], [gx + 0.9, gz + 1.25]], h: 0.85, gap: 0.6 }));

  // one shade tree behind the wall: a random kind each variant
  const kind = api.pick(['olive', 'oak', 'olive', 'pine']);
  if (kind === 'pine') g.add(api.pine({ h: 4.2, r: 1.7, lean: 0.5, x: 3.2, z: -2.9 }));
  else g.add(api.tree({ kind, h: kind === 'oak' ? 3.6 : 2.9, x: 3.3, z: -2.8, lean: 0.35, leanTo: [1, -0.4], rot: api.range(0, 6.28) }));

  // the flock: five in the fold (one dark), a lamb, and two grazing just outside the gate
  const spots = [[-1.1, -0.9, 0.6], [0.6, -1.5, -2.2], [1.5, 0.2, 2.6], [-0.4, 0.6, 1.2], [-1.6, -2.0, -0.4], [0.2, 2.6, 0.3], [1.6, 3.3, -0.9]];
  const dark = Math.floor(api.range(0, 4));
  spots.forEach(([x, z, rot], i) => g.add(sheep(api, { x: x + api.range(-0.15, 0.15), z: z + cz + api.range(-0.15, 0.15), rot: rot + api.range(-0.3, 0.3), dark: i === dark, graze: i % 3 !== 1, s: api.range(0.92, 1.05) })));
  g.add(sheep(api, { x: -0.25, z: cz + 0.05, rot: 1.0, s: 0.6, graze: false }));   // the lamb, by the dark ewe's side

  // keylines: the lean-to as one block
  api.proxy(api.boxGeo({ w: 2.9, h: 1.7, d: 0.5, y: 0.85, z: bz }), g);
  return g;
}

// heads dip to graze and come up to look around, each sheep on its own slow rhythm
const heads = new WeakMap();
export function animate(obj, t) {
  let list = heads.get(obj);
  if (!list) { list = []; obj.traverse(o => { if (o.name === 'graze') list.push(o); }); heads.set(obj, list); }
  for (const o of list) {
    const u = o.userData, c = Math.sin(t * u.sp + u.ph);
    const k = Math.min(1, Math.max(0, (c + 0.55) / 0.4)), e = k * k * (3 - 2 * k);   // down most of the time, up now and then
    o.rotation.x = 0.05 + e * (0.73 + 0.06 * Math.sin(t * 3.1 + u.ph));
  }
}
