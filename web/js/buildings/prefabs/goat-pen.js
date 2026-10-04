// Goat pen: a post-and-rail paddock round a heap of pale limestone boulders (goats climb: one stands on top),
// a low dry-stone shelter with a terracotta lean-to roof and an ink doorway, a wooden hay manger and a stone
// trough. Four goats in cream, chestnut and black-and-tan, with curved horns, beards and up-flicked tails; their
// heads dip to browse (animate). From above: a fenced square, the grey rock heap and its shadow, the red roof.
// Footprint 7 x 6, the gate faces +z.
export const meta = {
  id: 'goat-pen', name: 'Goat pen',
  aliases: ['goats', 'goat', 'goat paddock', 'goat yard', 'herd of goats', 'keçi', 'keçiler', 'keçi ağılı'],
  category: 'animal', stage: 'camp', footprint: { w: 7, d: 6 }, height: 3.0,
  desc: 'A fenced paddock round a boulder heap, with a stone shelter and four browsing goats.'
};

const EARTH = ['#6e5638', '#8a6d48', '#a3845a', '#b8996c', '#c8aa7c'];
const ROCK = ['#5c554c', '#7d7467', '#9b9181', '#b3a994', '#c4b9a2'];
const HORN = ['#5d5141', '#7d6e58', '#a39276', '#c2b293', '#d8caa9'];
const HOOF = ['#231b19', '#33282a', '#463839', '#584846', '#6a5853'];
const COATS = [
  ['#8f8573', '#b9ad96', '#d9cfb9', '#ece5d2', '#f7f2e4'],   // cream
  ['#4a2a17', '#6b3c1f', '#8d5228', '#a96734', '#bf7c44'],   // chestnut
  ['#1f1a1a', '#2d2625', '#3e3432', '#4f4440', '#5f534d']    // black (tan face)
];

// a goat facing +z: slim body high on long legs, a named head pivot (for browsing), horns that sweep back
function goat(api, o) {
  const s = o.s || 1, coat = COATS[o.coat % COATS.length], g = api.group({ x: o.x, y: o.y || 0, z: o.z, rot: o.rot || 0 });
  [[-0.12, 0.27], [0.12, 0.27], [-0.12, -0.27], [0.12, -0.27]].forEach(([x, z], i) =>
    g.add(api.colourOnly(api.cylinder({ rt: 0.05 * s, rb: 0.035 * s, h: 0.48 * s, x: x * s, y: 0.24 * s, z: z * s, rx: i < 2 ? -0.05 : 0.08, ramp: o.coat === 2 ? HOOF : coat, seg: 6 }))));
  g.add(api.sphere({ r: 0.34 * s, sx: 0.78, sy: 0.82, sz: 1.42, y: 0.66 * s, ramp: coat, speck: 0.22, seg: 18 }));
  g.add(api.cone({ r: 0.06 * s, h: 0.2 * s, y: 0.86 * s, z: -0.44 * s, rx: -0.55, ramp: coat, seg: 6 }));   // the tail, flicked up
  api.proxy(api.sphereGeo({ r: 0.36 * s, sx: 0.8, sy: 0.86, sz: 1.42, y: 0.66 * s, seg: 16 }), g);
  // neck + head on one pivot at the withers
  const head = api.group({ y: 0.78 * s, z: 0.36 * s }); head.name = 'browse';
  head.userData.ph = api.range(0, 6.28); head.userData.sp = api.range(0.4, 0.75);
  head.add(api.cylinder({ rt: 0.08 * s, rb: 0.11 * s, h: 0.34 * s, y: 0.12 * s, z: 0.08 * s, rx: 0.5, ramp: coat, seg: 8 }));
  head.add(api.sphere({ r: 0.11 * s, sx: 0.8, sz: 1.6, y: 0.27 * s, z: 0.25 * s, rx: 0.55, ramp: o.coat === 2 ? COATS[1] : coat, seg: 12 }));
  [-1, 1].forEach(sd => {
    head.add(api.box({ w: 0.16 * s, h: 0.035 * s, d: 0.07 * s, x: sd * 0.12 * s, y: 0.32 * s, z: 0.16 * s, rot: sd * 0.3, ramp: coat }));
    head.add(api.tube({ points: [[sd * 0.04 * s, 0.34 * s, 0.2 * s], [sd * 0.07 * s, 0.47 * s, 0.12 * s], [sd * 0.09 * s, 0.5 * s, -0.02 * s], [sd * 0.1 * s, 0.44 * s, -0.1 * s]], r: 0.022 * s, seg: 10, ramp: HORN }));
  });
  head.add(api.colourOnly(api.cone({ r: 0.035 * s, h: 0.12 * s, y: 0.13 * s, z: 0.34 * s, rx: Math.PI, ramp: HOOF, seg: 5 })));   // the beard
  head.rotation.x = o.graze ? 0.9 : 0.3;
  g.add(head);
  return g;
}

export function build(api) {
  const R = api.ramps, g = api.group();
  const W = 6.4, D = 5.4;

  // the bare paddock floor
  const floor = [];
  for (let i = 0; i < 32; i++) {
    const a = i / 32 * Math.PI * 2, c = Math.cos(a), sn = Math.sin(a), k = Math.pow(Math.pow(Math.abs(c), 4) + Math.pow(Math.abs(sn), 4), -0.25);
    floor.push([c * k * (W / 2 - 0.15), -sn * k * (D / 2 - 0.15) + 0.04 * Math.sin(a * 5)]);
  }
  g.add(api.extrude({ shape: floor, depth: 0.04, rx: -Math.PI / 2, y: 0.02, ramp: EARTH, speck: 0.3, lift: 0.04 }));

  // post-and-rail fence round three sides and the front, leaving a gap by the trough
  g.add(api.fence({ points: [[-0.5, D / 2], [-W / 2, D / 2], [-W / 2, -D / 2], [W / 2, -D / 2], [W / 2, D / 2], [0.9, D / 2]], h: 0.95, gap: 1.05 }));

  // the boulder heap: three faceted limestone rocks, big to small, and a goat on the top one
  const rx0 = -0.8, rz0 = -0.2;
  g.add(api.sphere({ r: 0.95, sy: 0.7, sx: 1.15, x: rx0, y: 0.5, z: rz0, seg: 7, ramp: ROCK, speck: 0.36, rot: api.range(0, 6) }));
  g.add(api.sphere({ r: 0.62, sy: 0.72, x: rx0 + 1.05, y: 0.32, z: rz0 + 0.5, seg: 6, ramp: ROCK, speck: 0.36, lift: -0.04, rot: api.range(0, 6) }));
  g.add(api.sphere({ r: 0.45, sy: 0.7, x: rx0 - 0.95, y: 0.24, z: rz0 + 0.7, seg: 6, ramp: ROCK, speck: 0.36, lift: 0.03, rot: api.range(0, 6) }));

  // the shelter in the back right corner: dry stone, a terracotta lean-to roof falling to the front, an ink door
  const sx = 1.85, sz = -1.75;
  g.add(api.box({ w: 2.3, h: 1.35, d: 1.5, x: sx, y: 0.675, z: sz, mat: api.lambert('#e3d2b4') }));
  g.add(api.box({ w: 2.6, h: 0.12, d: 1.9, x: sx, y: 1.5, z: sz, rx: 0.2, ramp: R.TERRACOTTA }));
  g.add(api.inkDoor({ w: 0.7, h: 0.95, x: sx - 0.3, y: 0, z: sz + 0.75, arched: false, frame: R.WOOD }));
  // a wooden hay manger against the shelter, and a stone trough by the gate
  g.add(api.box({ w: 1.1, h: 0.5, d: 0.45, x: sx + 0.5, y: 0.45, z: sz + 1.05, ramp: R.WOOD }));
  g.add(api.dome({ r: 0.42, h: 0.3, sx: 1.25, x: sx + 0.5, y: 0.66, z: sz + 1.05, ramp: R.GOLD, speck: 0.3, seg: 12 }));
  g.add(api.box({ w: 1.2, h: 0.36, d: 0.45, x: 0.2, y: 0.18, z: D / 2 - 0.6, ramp: R.LIMESTONE }));
  g.add(api.box({ w: 1.0, h: 0.04, d: 0.27, x: 0.2, y: 0.37, z: D / 2 - 0.6, ramp: R.SEA, lift: 0.08 }));

  // goats: one on the summit, one climbing, two browsing on the floor
  g.add(goat(api, { x: rx0 + 0.05, y: 0.9, z: rz0, rot: 0.6, coat: 0, graze: false }));
  g.add(goat(api, { x: rx0 + 1.75, z: rz0 + 0.95, rot: -2.3, coat: 2, graze: true, s: 0.95 }));
  g.add(goat(api, { x: 1.1, z: 1.0, rot: 2.6 + api.range(-0.3, 0.3), coat: 1, graze: true }));
  g.add(goat(api, { x: -2.2, z: 1.75, rot: 0.9 + api.range(-0.3, 0.3), coat: Math.floor(api.range(0, 3)), graze: true, s: 0.75 }));   // a kid

  // a shade tree outside the back fence, random kind
  const kind = api.pick(['olive', 'oak', 'lemon', 'olive']);
  g.add(api.tree({ kind, h: kind === 'oak' ? 3.4 : 2.8, x: -2.6, z: -D / 2 - 0.6, lean: 0.3, leanTo: [-1, -0.3], rot: api.range(0, 6.28) }));

  api.proxy(api.boxGeo({ w: 2.3, h: 1.35, d: 1.5, x: sx, y: 0.675, z: sz }), g);
  return g;
}

const heads = new WeakMap();
export function animate(obj, t) {
  let list = heads.get(obj);
  if (!list) { list = []; obj.traverse(o => { if (o.name === 'browse') list.push(o); }); heads.set(obj, list); }
  for (const o of list) {
    const u = o.userData, c = Math.sin(t * u.sp + u.ph);
    const k = Math.min(1, Math.max(0, (c + 0.3) / 0.5)), e = k * k * (3 - 2 * k);
    o.rotation.x = e * (0.95 + 0.07 * Math.sin(t * 4.3 + u.ph)) + (1 - e) * (0.3 + 0.08 * Math.sin(t * 0.9 + u.ph));
  }
}
