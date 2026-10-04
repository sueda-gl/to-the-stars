// Horse stable: a long whitewashed stable under a terracotta gable, three stalls with ink Dutch doors (a grey
// horse leans its head out over the middle one), a hayloft opening on the lit gable end, and in front a sandy
// paddock in a post-and-rail fence where a chestnut horse with a dark mane and white socks grazes and swishes
// its tail (animate). A stone trough, a stack of golden bales, a shade tree. Footprint 9 x 7, doors face +z.
export const meta = {
  id: 'horse-stable', name: 'Horse stable',
  aliases: ['stable', 'stables', 'horse', 'horses', 'paddock', 'horse barn', 'stud', 'ahır', 'at', 'atlar', 'at ahırı', 'tavla'],
  category: 'animal', stage: 'village', footprint: { w: 9, d: 7 }, height: 4.3,
  desc: 'A whitewashed three-stall stable with a fenced paddock and a grazing chestnut horse.'
};

const SAND = ['#8a7354', '#a99070', '#c4ab86', '#d6be98', '#e2cca6'];
const CHESTNUT = ['#4a2210', '#6e3418', '#924822', '#a85a2c', '#bb6b37'];
const GREY = ['#625d58', '#837d76', '#a39d94', '#bdb7ad', '#d0cbc1'];
const MANE = ['#1d1512', '#2b201b', '#3a2c25', '#493830', '#57443a'];
const SOCK = ['#8f8573', '#bcb19c', '#dcd3c0', '#efe9da', '#faf6ec'];

// the head and neck of a horse (shared by the paddock horse and the one looking out of the stall)
function headNeck(api, coat, mane, s) {
  const n = api.group();
  n.add(api.cylinder({ rt: 0.15 * s, rb: 0.26 * s, h: 0.85 * s, y: 0.34 * s, z: 0.2 * s, rx: 0.55, ramp: coat, seg: 10 }));
  n.add(api.box({ w: 0.07 * s, h: 0.8 * s, d: 0.12 * s, y: 0.42 * s, z: 0.06 * s, rx: 0.55, ramp: mane }));
  n.add(api.cylinder({ rt: 0.1 * s, rb: 0.16 * s, h: 0.62 * s, y: 0.66 * s, z: 0.6 * s, rx: 2.2, ramp: coat, seg: 10 }));
  [-1, 1].forEach(sd => n.add(api.cone({ r: 0.045 * s, h: 0.15 * s, x: sd * 0.07 * s, y: 0.95 * s, z: 0.36 * s, rx: -0.2, ramp: coat, seg: 6 })));
  n.add(api.box({ w: 0.06 * s, h: 0.2 * s, d: 0.08 * s, y: 0.9 * s, z: 0.42 * s, rx: 0.9, ramp: mane }));   // the forelock
  return n;
}

function horse(api, o) {
  const s = o.s || 1, coat = o.coat || CHESTNUT, g = api.group({ x: o.x, z: o.z, rot: o.rot || 0 });
  [[-0.17, 0.6, 1], [0.17, 0.6, 0], [-0.17, -0.6, 0], [0.17, -0.6, 1]].forEach(([x, z, sock]) => {
    g.add(api.cylinder({ rt: 0.08 * s, rb: 0.055 * s, h: 0.95 * s, x: x * s, y: 0.475 * s, z: z * s, ramp: coat, seg: 7, lift: -0.05 }));
    g.add(api.cylinder({ r: 0.065 * s, h: (sock ? 0.3 : 0.1) * s, x: x * s, y: (sock ? 0.15 : 0.05) * s, z: z * s, ramp: sock ? SOCK : MANE, seg: 7 }));
  });
  g.add(api.sphere({ r: 0.5 * s, sx: 0.68, sy: 0.78, sz: 1.5, y: 1.25 * s, ramp: coat, speck: 0.18, seg: 20 }));
  g.add(api.sphere({ r: 0.4 * s, sx: 0.95, y: 1.3 * s, z: 0.48 * s, ramp: coat, speck: 0.18, seg: 14 }));
  g.add(api.sphere({ r: 0.42 * s, sx: 0.95, y: 1.32 * s, z: -0.52 * s, ramp: coat, speck: 0.18, lift: 0.05, seg: 14 }));
  api.proxy(api.sphereGeo({ r: 0.55 * s, sx: 0.7, sy: 0.8, sz: 1.55, y: 1.28 * s, seg: 18 }), g);
  const neck = api.group({ y: 1.42 * s, z: 0.6 * s }); neck.name = 'graze';
  neck.userData.ph = api.range(0, 6.28); neck.userData.sp = api.range(0.22, 0.35);
  neck.add(headNeck(api, coat, MANE, s));
  neck.rotation.x = o.graze ? 1.5 : 0;
  g.add(neck);
  const tail = api.group({ y: 1.5 * s, z: -0.92 * s }); tail.name = 'tail'; tail.userData.ph = api.range(0, 6.28);
  tail.add(api.tube({ points: [[0, 0, 0], [0, -0.05 * s, -0.22 * s], [0, -0.4 * s, -0.3 * s], [0, -0.8 * s, -0.26 * s]], r: 0.075 * s, seg: 12, ramp: MANE }));
  g.add(tail);
  return g;
}

export function build(api) {
  const R = api.ramps, g = api.group();
  const wall = api.lambert('#efe4d2');
  const bx = 0, bz = -2.0, bw = 6.4, bd = 2.6, bh = 2.5;

  // the stable: limestone plinth, whitewash block, terracotta gable with the ridge along x
  g.add(api.box({ w: bw + 0.3, h: 0.2, d: bd + 0.3, x: bx, y: 0.1, z: bz, ramp: R.LIMESTONE }));
  g.add(api.box({ w: bw, h: bh, d: bd, x: bx, y: 0.2 + bh / 2, z: bz, mat: wall }));
  g.add(api.gableRoof({ w: bw, d: bd, h: 1.15, overhang: 0.3, x: bx, y: 0.2 + bh, z: bz, ramp: R.TERRACOTTA }));
  // three Dutch doors: an ink opening with the lower leaf shut in wood
  const fz = bz + bd / 2;
  [-2.1, 0, 2.1].forEach(x => {
    g.add(api.inkDoor({ w: 1.05, h: 1.95, x, y: 0.2, z: fz, arched: false, frame: R.LIMESTONE }));
    g.add(api.box({ w: 1.0, h: 1.05, d: 0.08, x, y: 0.2 + 0.525, z: fz + 0.05, ramp: R.WOOD }));
  });
  // the hayloft opening on the lit gable end, with hay spilling from it
  g.add(api.inkWindow({ w: 0.8, h: 0.7, x: bx - bw / 2, y: 2.25, z: bz, rot: -Math.PI / 2, frame: R.WOOD }));
  // a grey horse looks out over the middle door
  const peek = api.group({ x: 0, y: 1.25, z: fz - 0.15 }); peek.name = 'peek'; peek.userData.ph = api.range(0, 6.28);
  const hn = headNeck(api, GREY, MANE, 0.9); hn.rotation.x = 0.35; peek.add(hn); peek.rotation.y = 0.55;
  g.add(peek);

  // the paddock in front: sand, a post-and-rail fence, a trough and bales
  const pz = 1.55, pw = 8.2, pd = 3.6;
  const sand = [];
  for (let i = 0; i < 28; i++) {
    const a = i / 28 * Math.PI * 2, c = Math.cos(a), sn = Math.sin(a), k = Math.pow(Math.pow(Math.abs(c), 5) + Math.pow(Math.abs(sn), 5), -0.2);
    sand.push([c * k * (pw / 2 - 0.1), -(pz + sn * k * (pd / 2 - 0.05))]);
  }
  g.add(api.extrude({ shape: sand, depth: 0.04, rx: -Math.PI / 2, y: 0.02, ramp: SAND, speck: 0.3 }));
  g.add(api.fence({ points: [[-pw / 2 + 0.1, pz - pd / 2 + 0.05], [-pw / 2 + 0.1, pz + pd / 2 - 0.1], [-0.4, pz + pd / 2 - 0.1]], h: 1.15, gap: 1.35 }));
  g.add(api.fence({ points: [[1.1, pz + pd / 2 - 0.1], [pw / 2 - 0.1, pz + pd / 2 - 0.1], [pw / 2 - 0.1, pz - pd / 2 + 0.05]], h: 1.15, gap: 1.35 }));
  g.add(api.box({ w: 0.55, h: 0.5, d: 1.5, x: -pw / 2 + 0.6, y: 0.25, z: pz + 0.2, ramp: R.LIMESTONE }));
  g.add(api.box({ w: 0.35, h: 0.04, d: 1.3, x: -pw / 2 + 0.6, y: 0.51, z: pz + 0.2, ramp: R.SEA, lift: 0.08 }));
  const bale = (x, y, z, rot) => g.add(api.box({ w: 0.9, h: 0.42, d: 0.5, x, y, z, rot, ramp: R.GOLD, speck: 0.32 }));
  bale(3.25, 0.21, pz - 1.0, 0.1); bale(3.3, 0.21, pz - 0.45, -0.05); bale(3.28, 0.63, pz - 0.72, 0.15);

  // the chestnut horse grazing in the paddock, side-on
  g.add(horse(api, { x: -0.6 + api.range(-0.3, 0.3), z: pz + 0.15, rot: 1.35 + api.range(-0.25, 0.25), graze: true }));

  // a shade tree by the stable's far corner, random kind
  const kind = api.pick(['oak', 'olive', 'pine']);
  if (kind === 'pine') g.add(api.pine({ h: 5.0, r: 2.0, lean: 0.5, x: bw / 2 + 0.9, z: bz - 0.4 }));
  else g.add(api.tree({ kind, h: 3.9, x: bw / 2 + 0.9, z: bz - 0.3, lean: 0.3, leanTo: [1, 0], rot: api.range(0, 6.28) }));

  api.proxy(api.boxGeo({ w: bw, h: bh, d: bd, x: bx, y: 0.2 + bh / 2, z: bz }), g);
  return g;
}

const parts = new WeakMap();
export function animate(obj, t) {
  let p = parts.get(obj);
  if (!p) { p = { necks: [], tails: [], peek: [] }; obj.traverse(o => { if (o.name === 'graze') p.necks.push(o); else if (o.name === 'tail') p.tails.push(o); else if (o.name === 'peek') p.peek.push(o); }); parts.set(obj, p); }
  for (const o of p.necks) {
    const u = o.userData, c = Math.sin(t * u.sp + u.ph);
    const k = Math.min(1, Math.max(0, (c + 0.5) / 0.5)), e = k * k * (3 - 2 * k);
    o.rotation.x = e * (1.5 + 0.05 * Math.sin(t * 2.2 + u.ph)) + (1 - e) * 0.05 * Math.sin(t * 1.1);
  }
  for (const o of p.tails) { const ph = o.userData.ph, b = Math.max(0, Math.sin(t * 0.45 + ph)); o.rotation.z = 0.4 * b * Math.sin(t * 4.5 + ph); }
  for (const o of p.peek) { const ph = o.userData.ph; o.rotation.y = 0.55 + 0.3 * Math.sin(t * 0.4 + ph); o.children[0].rotation.x = 0.35 + 0.15 * Math.sin(t * 0.7 + ph); }
}
