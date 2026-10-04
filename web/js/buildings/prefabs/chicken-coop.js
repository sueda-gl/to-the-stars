// Chicken coop: a little whitewashed hen house raised on wooden stilts under a terracotta gable, a cleated ramp
// down from its ink pop-hole, a nest box on the lit side, a low wattle-and-post fence round a sandy run, a
// grain trough and a water dish, and a rooster with six hens (rust, cream and black) pecking (animate).
// From above: a small red roof, a pale run with a crisp fence line and a scatter of plump birds. Footprint 6 x 5.
export const meta = {
  id: 'chicken-coop', name: 'Chicken coop',
  aliases: ['chickens', 'chicken', 'hens', 'hen house', 'henhouse', 'coop', 'poultry', 'rooster', 'chicken run', 'tavuk', 'tavuklar', 'kümes', 'horoz'],
  category: 'animal', stage: 'hamlet', footprint: { w: 6, d: 5 }, height: 2.7,
  desc: 'A whitewashed hen house on stilts with a fenced sandy run, a rooster and six pecking hens.'
};

const RUN = ['#8a7354', '#a99070', '#c4ab86', '#d6be98', '#e2cca6'];
const LEGS = ['#7a4e14', '#a46c1c', '#cc8d2a', '#e0a63c', '#ecbc55'];
const COATS = [
  ['#5a2a14', '#7f3b1c', '#a34e26', '#bd6233', '#cf7643'],   // rust
  ['#8f8573', '#bcb19c', '#dcd3c0', '#efe9da', '#faf6ec'],   // cream
  ['#1f1a1a', '#2d2625', '#3e3432', '#4f4440', '#5f534d']    // black
];
const TAIL = ['#121113', '#1c1a1e', '#28252b', '#35313a', '#433e48'];   // the rooster's near-black sickles (green read as a carrot top)

// a hen (or the rooster) facing +z, ~0.5 m tall; the head is a named pivot so animate() can peck
function hen(api, o) {
  const s = (o.s || 1.25) * (o.rooster ? 1.2 : 1), coat = COATS[o.coat % COATS.length], R = api.ramps;
  const g = api.group({ x: o.x, z: o.z, rot: o.rot || 0 });
  [-0.05, 0.05].forEach(x => g.add(api.colourOnly(api.cylinder({ r: 0.02 * s, h: 0.16 * s, x: x * s, y: 0.08 * s, ramp: LEGS, seg: 5 }))));
  g.add(api.sphere({ r: 0.18 * s, sx: 0.85, sy: 0.88, sz: 1.2, y: 0.28 * s, ramp: coat, speck: 0.2, seg: 14 }));
  if (o.rooster) {
    // the rooster: a black breast, a proud chest, and dark sickle feathers arching back and down
    g.add(api.sphere({ r: 0.12 * s, sx: 0.9, y: 0.3 * s, z: 0.1 * s, ramp: COATS[2], seg: 10 }));
    g.add(api.tube({ points: [[0, 0.32 * s, -0.14 * s], [0, 0.48 * s, -0.24 * s], [0, 0.46 * s, -0.4 * s], [0, 0.3 * s, -0.46 * s]], r: 0.05 * s, seg: 12, ramp: TAIL }));
    g.add(api.tube({ points: [[0.03 * s, 0.3 * s, -0.14 * s], [0.04 * s, 0.4 * s, -0.3 * s], [0.04 * s, 0.26 * s, -0.4 * s]], r: 0.042 * s, seg: 10, ramp: TAIL }));
    g.add(api.cone({ r: 0.1 * s, h: 0.16 * s, y: 0.4 * s, z: 0.02 * s, rx: -0.3, ramp: ['#7a3d10', '#a65a16', '#cf7d22', '#e39a34', '#efb34c'], seg: 8 }));   // the golden hackles
  } else {
    g.add(api.cone({ r: 0.1 * s, h: 0.2 * s, y: 0.38 * s, z: -0.16 * s, rx: -0.7, ramp: coat, seg: 8, lift: -0.04 }));
  }
  const head = api.group({ y: 0.34 * s, z: 0.15 * s }); head.name = 'peck';
  head.userData.ph = api.range(0, 6.28); head.userData.sp = api.range(0.5, 0.9);
  head.add(api.sphere({ r: 0.08 * s, y: 0.08 * s, z: 0.03 * s, ramp: coat, seg: 10 }));
  head.add(api.colourOnly(api.cone({ r: 0.028 * s, h: 0.08 * s, y: 0.07 * s, z: 0.12 * s, rx: Math.PI / 2, ramp: LEGS, seg: 5 })));
  head.add(api.colourOnly(api.box({ w: 0.025 * s, h: (o.rooster ? 0.09 : 0.05) * s, d: 0.1 * s, y: 0.17 * s, z: 0.03 * s, ramp: R.RED })));
  head.add(api.colourOnly(api.sphere({ r: 0.022 * s, sy: 1.4, y: 0.02 * s, z: 0.09 * s, ramp: R.RED, seg: 6 })));
  g.add(head);
  return g;
}

export function build(api) {
  const R = api.ramps, g = api.group();

  // the sandy run
  const run = [];
  for (let i = 0; i < 28; i++) {
    const a = i / 28 * Math.PI * 2, c = Math.cos(a), sn = Math.sin(a), k = Math.pow(Math.pow(Math.abs(c), 4) + Math.pow(Math.abs(sn), 4), -0.25);
    run.push([c * k * 2.8 + 0.05 * Math.sin(a * 6), -sn * k * 2.3]);
  }
  g.add(api.extrude({ shape: run, depth: 0.04, rx: -Math.PI / 2, y: 0.02, ramp: RUN, speck: 0.32 }));

  // the hen house: whitewash on four stilts, a terracotta gable, a pop-hole and a ramp down to the run
  const hx = -1.15, hz = -1.2, hw = 2.0, hd = 1.5, lift = 0.5, hh = 1.2;
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => g.add(api.box({ w: 0.14, h: lift, d: 0.14, x: hx + a * (hw / 2 - 0.12), y: lift / 2, z: hz + b * (hd / 2 - 0.12), ramp: R.WOOD })));
  g.add(api.box({ w: hw + 0.1, h: 0.1, d: hd + 0.1, x: hx, y: lift + 0.05, z: hz, ramp: R.WOOD }));
  g.add(api.box({ w: hw, h: hh, d: hd, x: hx, y: lift + 0.1 + hh / 2, z: hz, mat: api.lambert('#efe4d2') }));
  g.add(api.gableRoof({ w: hw, d: hd, h: 0.7, overhang: 0.2, x: hx, y: lift + 0.1 + hh, z: hz, ramp: R.TERRACOTTA }));
  g.add(api.inkDoor({ w: 0.36, h: 0.5, x: hx + 0.45, y: lift + 0.12, z: hz + hd / 2, frame: R.WOOD }));
  g.add(api.inkWindow({ w: 0.36, h: 0.3, x: hx - 0.45, y: lift + 0.85, z: hz + hd / 2, shutters: '#4f7f8c', frame: false }));
  const rampLen = 1.25, ang = Math.atan2(lift + 0.12, 1.1);
  g.add(api.box({ w: 0.36, h: 0.05, d: rampLen, x: hx + 0.45, y: (lift + 0.12) / 2, z: hz + hd / 2 + 0.55, rx: ang, ramp: R.WOOD, lift: 0.04 }));
  // the nest box on the lit (-x) side, its own little sloped lid
  g.add(api.box({ w: 0.5, h: 0.55, d: 1.0, x: hx - hw / 2 - 0.25, y: lift + 0.4, z: hz, mat: api.lambert('#efe4d2') }));
  g.add(api.box({ w: 0.68, h: 0.07, d: 1.15, x: hx - hw / 2 - 0.27, y: lift + 0.72, z: hz, rz: 0.35, ramp: R.TERRACOTTA }));

  // the fence: posts and rails round the run, a gap at the front right
  g.add(api.fence({ points: [[1.4, 2.25], [-2.75, 2.25], [-2.75, -2.25], [2.75, -2.25], [2.75, 2.25], [2.3, 2.25]], h: 0.8, gap: 0.75 }));
  // grain trough and a water dish
  g.add(api.box({ w: 1.0, h: 0.18, d: 0.3, x: 1.2, y: 0.09, z: -0.8, ramp: R.WOOD }));
  g.add(api.box({ w: 0.86, h: 0.03, d: 0.18, x: 1.2, y: 0.18, z: -0.8, ramp: R.GOLD, speck: 0.35 }));
  g.add(api.cylinder({ r: 0.28, h: 0.12, x: -0.6, y: 0.06, z: 1.3, ramp: R.LIMESTONE, seg: 16 }));
  g.add(api.cylinder({ r: 0.22, h: 0.02, x: -0.6, y: 0.12, z: 1.3, ramp: R.SEA, lift: 0.08, seg: 16 }));

  // a lemon or orange tree shading the corner, random
  g.add(api.tree({ kind: api.pick(['lemon', 'orange', 'olive']), h: 2.3, x: 2.15, z: -1.55, lean: 0.25, rot: api.range(0, 6.28) }));

  // the flock: a rooster on the run, six hens round the trough and the dish
  g.add(hen(api, { x: 0.35, z: 0.55, rot: -0.9, rooster: true, coat: 0 }));
  const spots = [[1.0, -0.35, 3.0], [1.6, -0.3, -2.6], [0.6, -1.15, 1.2], [-0.2, 1.55, 2.0], [-1.1, 1.0, 0.8], [1.6, 1.25, -1.0]];
  spots.forEach(([x, z, rot], i) => g.add(hen(api, { x: x + api.range(-0.12, 0.12), z: z + api.range(-0.12, 0.12), rot: rot + api.range(-0.4, 0.4), coat: [0, 1, 0, 2, 1, 0][(i + Math.floor(api.range(0, 6))) % 6] })));

  api.proxy(api.boxGeo({ w: hw, h: hh, d: hd, x: hx, y: lift + 0.1 + hh / 2, z: hz }), g);
  return g;
}

// quick pecks in bursts, with pauses to look about
const heads = new WeakMap();
export function animate(obj, t) {
  let list = heads.get(obj);
  if (!list) { list = []; obj.traverse(o => { if (o.name === 'peck') list.push(o); }); heads.set(obj, list); }
  for (const o of list) {
    const u = o.userData, burst = Math.sin(t * u.sp + u.ph) > 0 ? 1 : 0;
    const peck = Math.pow(Math.max(0, Math.sin(t * 7 + u.ph * 3)), 6);
    o.rotation.x = burst * (0.25 + 0.95 * peck) - (1 - burst) * 0.1;
    o.rotation.y = (1 - burst) * 0.35 * Math.sin(t * 1.7 + u.ph);
  }
}
