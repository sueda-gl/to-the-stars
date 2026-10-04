// Shipyard: a sand-and-timber yard at the water's edge with a slipway of two greased timber ways running down
// off the quay on piles (point them at the water), and on the ways a ship half built: keel, stem and transom,
// a row of bare ribs, the bottom strakes and the gunwale already on, the upper planking still to come, shored up
// on each side. A whitewashed loft shed under a terracotta gable, a stack of planks and curved knees, a tar
// cauldron steaming on its fire, a coil of rope, a tree. From above: the long boat-shaped outline with its ribs,
// two rails running to the sea. Footprint 9.8 x 7.8, the slipway runs to +z (toward the water).
export const meta = {
  id: 'shipyard', name: 'Shipyard',
  aliases: ['shipyard', 'shipyards', 'boatyard', 'boat yard', 'dockyard', 'slipway', 'shipwright', 'shipwrights', 'boat builder', 'ship under construction', 'tersane', 'tersaneler', 'gemi tezgahı', 'kayıkhane'],
  category: 'building', stage: 'town', footprint: { w: 9.8, d: 7.8 }, height: 3.7, shore: true,
  desc: 'A quay-side yard with a ship half built on a slipway that runs down into the water, a loft shed, timber and tar.'
};

const GLOW = ['#6e1a0c', '#b0301a', '#e0501f', '#f47a2a', '#ffa847'];

export function build(api) {
  const R = api.ramps, g = api.group();
  const Q = 0.3;   // quay height
  g.add(api.box({ w: 9.6, h: Q, d: 4.8, y: Q / 2, z: -1.2, ramp: R.SAND, speck: 0.26 }));
  g.add(api.box({ w: 9.7, h: 0.2, d: 0.35, y: Q - 0.06, z: 1.12, ramp: R.LIMESTONE, lift: -0.04 }));   // the quay's stone edge

  // ---- the slipway: two ways on sleepers, then on piles past the quay edge ----
  const zA = -3.3, zB = 3.8, yA = Q + 0.28, yB = 0.12, slope = Math.atan2(yA - yB, zB - zA), Lw = Math.hypot(zB - zA, yA - yB);
  const wayY = z => yA - (z - zA) * (yA - yB) / (zB - zA);
  [-0.6, 0.6].forEach(x => g.add(api.box({ w: 0.24, h: 0.16, d: Lw, x, y: (yA + yB) / 2, z: (zA + zB) / 2, rx: slope, ramp: R.WOOD, lift: -0.05 })));
  for (let i = 0; i < 5; i++) { const z = -3.0 + i * 0.95; g.add(api.box({ w: 1.7, h: wayY(z) - 0.08 - Q + 0.04, d: 0.22, y: (Q + wayY(z) - 0.08) / 2, z, ramp: R.WOOD, lift: -0.12 })); }
  [1.9, 2.9, 3.7].forEach(z => [-0.6, 0.6].forEach(x => g.add(api.cylinder({ r: 0.1, h: wayY(z), x, y: wayY(z) / 2 - 0.05, z, ramp: R.WOOD, lift: -0.15, seg: 8 }))));

  // ---- the hull on the ways (a group tipped down the slope) ----
  const hz = -0.4, blocks = 0.3, base = wayY(hz) + 0.08 + blocks;
  [-2.1, -0.4, 1.3].forEach(z => g.add(api.box({ w: 0.42, h: blocks + 0.05, d: 0.34, y: wayY(z) + 0.08 + blocks / 2, z, ramp: R.WOOD, lift: 0.05 })));
  const hull = api.group({ y: base, z: hz }); hull.rotation.x = slope;
  const HALF = 2.6;
  const beam = z => 1.0 * Math.sqrt(Math.max(0.05, 1 - Math.pow((z + 0.35) / 3.0, 2)));
  const sheer = z => 1.45 + 0.28 * Math.pow(z / HALF, 2);
  const halfU = z => { const b = beam(z), h = sheer(z); return [[0, 0.02], [b * 0.38, 0.07], [b * 0.76, h * 0.22], [b * 0.97, h * 0.58], [b, h]]; };
  const at = (z, s, side) => {   // the point a share s of the way from keel to gunwale, on one side
    const p = halfU(z), lens = [0]; for (let i = 1; i < p.length; i++) lens.push(lens[i - 1] + Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]));
    const t = s * lens[lens.length - 1]; let k = 1; while (k < p.length - 1 && lens[k] < t) k++;
    const f = (t - lens[k - 1]) / Math.max(1e-6, lens[k] - lens[k - 1]);
    return [side * (p[k - 1][0] + (p[k][0] - p[k - 1][0]) * f), p[k - 1][1] + (p[k][1] - p[k - 1][1]) * f, z];
  };
  hull.add(api.box({ w: 0.22, h: 0.24, d: HALF * 2 + 0.3, y: 0.0, ramp: R.WOOD, lift: -0.08 }));                                // keel
  hull.add(api.tube({ points: [[0, 0.0, HALF + 0.1], [0, 0.55, HALF + 0.5], [0, 1.3, HALF + 0.7], [0, 2.0, HALF + 0.78]], r: 0.11, seg: 12, radial: 6, ramp: R.WOOD }));   // stem
  hull.add(api.box({ w: 0.2, h: 1.9, d: 0.2, y: 0.9, z: -HALF - 0.08, ramp: R.WOOD }));                                          // sternpost
  hull.add(api.box({ w: beam(-HALF) * 2 + 0.1, h: 0.8, d: 0.1, y: sheer(-HALF) - 0.35, z: -HALF - 0.05, ramp: R.WOOD, lift: 0.06 }));   // transom
  // ribs: bare U frames
  for (let i = 0; i < 11; i++) {
    const z = -HALF + 0.2 + i * (HALF * 2 - 0.4) / 10, p = halfU(z);
    const pts = p.slice().reverse().map(q => [-q[0], q[1], z]).concat(p.slice(1).map(q => [q[0], q[1], z]));
    hull.add(api.tube({ points: pts, r: 0.055, seg: 14, radial: 5, ramp: R.WOOD, lift: 0.04 }));
  }
  // planking: bottom strakes full length, two more on the bow half, and the gunwale (the boat's outline from above)
  const strake = (s, z0, z1, r, ramp, lift) => [-1, 1].forEach(side => {
    const pts = []; for (let k = 0; k <= 8; k++) pts.push(at(z0 + (z1 - z0) * k / 8, s, side));
    hull.add(api.tube({ points: pts, r, seg: 20, radial: 6, ramp, lift }));
  });
  [0.1, 0.2, 0.3, 0.4].forEach((s, i) => strake(s, -HALF, HALF, 0.13, R.WOOD, 0.08 + 0.03 * (i % 2)));
  [0.5, 0.6].forEach((s, i) => strake(s, 0.3, HALF, 0.13, R.WOOD, 0.1 + 0.03 * i));
  strake(1.0, -HALF, HALF, 0.08, R.WOOD, -0.05);
  g.add(hull);
  // shores: props from the ground to the bilge on each side
  [-1, 1].forEach(side => [-1.6, 0.0, 1.5].forEach(z => {
    const x0 = side * 2.15, x1 = side * (beam(z - hz) + 0.05), y1 = base + 0.75 - (z - hz) * Math.tan(slope);
    g.add(api.tube({ points: [[x0, Q, z], [x1, y1, z]], r: 0.06, seg: 2, radial: 5, ramp: R.WOOD, lift: -0.08 }));
  }));

  // ---- the loft shed (back left) ----
  const sx = -3.5, sz = -2.45, sw = 2.5, sd = 1.9, sh = 2.3;
  g.add(api.box({ w: sw, h: sh, d: sd, x: sx, y: Q + sh / 2, z: sz, mat: api.lambert('#efe4d2') }));
  g.add(api.gableRoof({ w: sw, d: sd, h: 0.9, overhang: 0.22, x: sx, y: Q + sh, z: sz, ramp: R.TERRACOTTA }));
  g.add(api.inkDoor({ w: 1.1, h: 1.6, x: sx + 0.3, y: Q, z: sz + sd / 2, arched: false, frame: R.WOOD }));
  g.add(api.inkWindow({ w: 0.45, h: 0.5, x: sx - sw / 2, y: Q + 1.5, z: sz, rot: -Math.PI / 2, shutters: R.BLUE }));

  // ---- timber: a plank stack and curved knees (back right); the tar cauldron; a rope coil ----
  for (let l = 0; l < 3; l++) for (let i = 0; i < 4; i++) g.add(api.box({ w: 0.26, h: 0.09, d: 2.6, x: 3.1 + i * 0.3, y: Q + 0.05 + l * 0.11, z: -2.2, ramp: R.WOOD, lift: 0.1 + 0.04 * ((i + l) % 2) }));
  for (let i = 0; i < 3; i++) g.add(api.tube({ points: [[3.0 + i * 0.45, Q + 0.1, -0.6], [3.1 + i * 0.45, Q + 0.12, 0.0], [3.5 + i * 0.45, Q + 0.14, 0.25]], r: 0.09, seg: 8, radial: 5, ramp: R.WOOD, lift: 0.05 }));
  const tx = 2.35, tz = 0.35;
  for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2; g.add(api.sphere({ r: 0.13, seg: 6, x: tx + Math.cos(a) * 0.32, y: Q + 0.1, z: tz + Math.sin(a) * 0.32, ramp: R.LIMESTONE, lift: -0.1 })); }
  const fire = api.sphere({ r: 0.2, sy: 0.6, x: tx, y: Q + 0.08, z: tz, ramp: GLOW, lift: 0.15, seg: 10 }); fire.name = 'fire'; g.add(fire);
  g.add(api.lathe({ points: [[0.12, 0], [0.32, 0.08], [0.38, 0.28], [0.35, 0.45], [0.3, 0.45]], seg: 16, x: tx, y: Q + 0.2, z: tz, ramp: R.IRON }));
  g.add(api.colourOnly(api.cylinder({ r: 0.3, h: 0.02, x: tx, y: Q + 0.64, z: tz, ramp: R.INK, seg: 16 })));
  g.add(api.torus({ r: 0.32, tube: 0.09, x: -1.95, y: Q + 0.09, z: 0.5, ramp: R.SAND, seg: 20 }));
  g.add(api.torus({ r: 0.2, tube: 0.08, x: -1.95, y: Q + 0.25, z: 0.5, ramp: R.SAND, lift: 0.05, seg: 16 }));
  const smoke = api.group({ x: tx, y: Q + 0.9, z: tz }); smoke.name = 'smoke';
  const puff = api.clay('#d9d2c6', '#aea596', '#7d7468');
  for (let i = 0; i < 2; i++) { const p = api.sphere({ r: 0.26, y: i * 0.5, mat: puff, seg: 12 }); p.name = 'puff' + i; p.castShadow = false; api.colourOnly(p); smoke.add(p); }
  g.add(smoke);
  const kind = api.pick(['pine', 'cypress', 'olive', 'pine']);
  g.add(api.tree({ kind, h: kind === 'cypress' ? 4.4 : kind === 'pine' ? 4.8 : 3.0, x: -1.3, z: -3.15 }));

  api.proxy(api.boxGeo({ w: sw, h: sh, d: sd, x: sx, y: Q + sh / 2, z: sz }), g);
  return g;
}

export function animate(obj, t) {
  const f = obj.getObjectByName('fire'); if (f) f.scale.setScalar(0.9 + 0.12 * Math.sin(t * 4.1));
  const smoke = obj.getObjectByName('smoke'); if (!smoke) return;
  for (let i = 0; i < 2; i++) {
    const p = smoke.getObjectByName('puff' + i); if (!p) continue;
    const k = (t * 0.22 + i / 2) % 1;
    p.position.set(k * 0.4, k * 1.4, -k * 0.2);
    p.scale.setScalar(Math.max(0.001, Math.sin(k * Math.PI) * (0.6 + k * 0.6)));
  }
}
