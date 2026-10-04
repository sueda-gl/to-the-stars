// Duck pond: a round pond of still teal water in a grassy bank, a few pale rim stones, three clumps of reeds
// with bulrushes, lily pads (one in flower), a little duck house on stilts with a terracotta roof and a plank
// ramp, a shade tree, and real-sized ducks: a mallard drake, a duck leading three ducklings in a slow circle,
// another duck dabbling and a white one resting on the bank. They bob and drift (animate). From above: a
// teal oval in a green rim, a tiny red roof, and the flotilla. Footprint 8 x 7.
export const meta = {
  id: 'duck-pond', name: 'Duck pond',
  aliases: ['ducks', 'duck', 'pond', 'ducklings', 'mallards', 'village pond', 'ördek', 'ördekler', 'ördek göleti', 'gölet', 'havuz'],
  category: 'animal', stage: 'village', footprint: { w: 8, d: 7 }, height: 3.6,
  desc: 'A reedy pond with a duck house on stilts and a family of small bobbing ducks.'
};

const GRASS = ['#4f5a2a', '#6b7637', '#87914a', '#9fa65c', '#b3b76c'];
const WATER = ['#174a5a', '#1f6476', '#2c8194', '#4799a6', '#69b2b6'];
const MUD = ['#4a3a28', '#5f4a33', '#76603f', '#8a724c', '#9a8258'];
const REED = ['#2c3816', '#465a22', '#677a32', '#8a9546', '#a8ad5c'];
const RUSH = ['#2e1c12', '#45291a', '#5e3a24', '#744a2f', '#86593a'];
const BILL = ['#7a4e14', '#a46c1c', '#cc8d2a', '#e0a63c', '#ecbc55'];
const DRAKE_HEAD = ['#0f2a1a', '#174026', '#215834', '#2e7043', '#3d8452'];
const DRAKE = ['#6b6862', '#8f8b83', '#b0aba1', '#c8c3b8', '#d9d4c9'];
const BREAST = ['#3f2014', '#5f301b', '#7f4224', '#97532d', '#aa6437'];
const HEN = ['#4e3a26', '#6e5235', '#8d6b46', '#a68257', '#b89469'];
const WHITE = ['#8f8573', '#bcb19c', '#dcd3c0', '#efe9da', '#faf6ec'];
const CHICK = ['#7a5a1a', '#a37a26', '#c99a36', '#ddb24a', '#ebc65e'];

// a duck facing +z; y is the water line (or the ground it sits on). ~0.55 m long at s = 1
function duck(api, o) {
  const s = o.s || 1.6, g = api.group({ x: o.x, y: o.y || 0, z: o.z, rot: o.rot || 0 });
  const body = o.kind === 'drake' ? DRAKE : o.kind === 'white' ? WHITE : o.kind === 'chick' ? CHICK : HEN;
  const head = o.kind === 'drake' ? DRAKE_HEAD : body;
  g.add(api.sphere({ r: 0.16 * s, sx: 0.85, sy: 0.6, sz: 1.5, y: 0.06 * s, ramp: body, speck: 0.18, seg: 14 }));
  if (o.kind === 'drake') g.add(api.sphere({ r: 0.1 * s, sy: 0.8, y: 0.07 * s, z: 0.13 * s, ramp: BREAST, seg: 10 }));
  if (o.kind !== 'chick') g.add(api.colourOnly(api.cone({ r: 0.06 * s, h: 0.12 * s, y: 0.12 * s, z: -0.22 * s, rx: -1.0, ramp: o.kind === 'drake' ? ['#1d1a1a', '#2b2626', '#3a3434', '#4a4342', '#59514f'] : body, seg: 6 })));
  const hd = api.group({ y: 0.12 * s, z: 0.15 * s }); hd.name = 'dabble'; hd.userData.ph = api.range(0, 6.28);
  hd.add(api.sphere({ r: 0.08 * s, y: 0.07 * s, z: 0.03 * s, ramp: head, seg: 10 }));
  hd.add(api.colourOnly(api.sphere({ r: 0.05 * s, sx: 0.9, sy: 0.35, sz: 1.5, y: 0.05 * s, z: 0.12 * s, ramp: BILL, seg: 8 })));
  g.add(hd);
  g.name = o.still ? '' : 'float'; g.userData.ph = api.range(0, 6.28);
  return g;
}

export function build(api) {
  const R = api.ramps, g = api.group();
  const blob = (rx, rz, n, p1, p2, jit) => {
    const pts = [];
    for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, r = 1 + jit * Math.sin(a * 2 + p1) + jit * 0.6 * Math.sin(a * 3 + p2); pts.push([Math.cos(a) * rx * r, -Math.sin(a) * rz * r]); }
    return pts;
  };
  const p1 = api.range(0, 6.28), p2 = api.range(0, 6.28);

  // grass bank, a muddy margin, then the water (each a thin slab a little higher than the last)
  g.add(api.extrude({ shape: blob(3.85, 3.3, 36, p1, p2, 0.06), depth: 0.05, rx: -Math.PI / 2, y: 0.025, ramp: GRASS, speck: 0.34 }));
  g.add(api.extrude({ shape: blob(3.05, 2.55, 36, p1, p2, 0.07), depth: 0.03, rx: -Math.PI / 2, y: 0.065, ramp: MUD, speck: 0.3 }));
  g.add(api.extrude({ shape: blob(2.8, 2.32, 36, p1, p2, 0.07), depth: 0.03, rx: -Math.PI / 2, y: 0.085, ramp: WATER, speck: 0.12, lift: 0.04 }));
  const W = 0.1;   // the water line

  // a few grey rim stones
  const STONE = ['#5c554c', '#7d7467', '#9b9181', '#b3a994', '#c4b9a2'];
  [[-2.95, 0.7, 0.26, 1.3], [2.75, 1.2, 0.24, 1.0], [0.6, 2.55, 0.2, 1.4]].forEach(([x, z, r, sx]) =>
    g.add(api.sphere({ r, sx, sy: 0.5, x, y: r * 0.4, z, seg: 7, ramp: STONE, speck: 0.3, rot: api.range(0, 6) })));

  // reed clumps: a fan of blades and a couple of bulrushes, colour only (a pencil hull round them read as a teepee)
  const reeds = (x, z, n, h) => {
    const c = api.group({ x, z });
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2 + api.range(-0.3, 0.3), d = api.range(0.05, 0.22), hh = h * api.range(0.7, 1.05);
      c.add(api.colourOnly(api.cone({ r: 0.075, h: hh, x: Math.cos(a) * d, y: hh / 2, z: Math.sin(a) * d, rx: Math.sin(a) * 0.18, rz: -Math.cos(a) * 0.18, ramp: REED, seg: 5, lift: api.range(-0.08, 0.08) })));
    }
    for (let i = 0; i < 2; i++) {
      const a = api.range(0, 6.28), d = 0.12;
      c.add(api.colourOnly(api.cylinder({ r: 0.012, h: h * 1.05, x: Math.cos(a) * d, y: h * 0.52, z: Math.sin(a) * d, ramp: REED, seg: 4 })));
      c.add(api.colourOnly(api.cylinder({ r: 0.045, h: 0.22, x: Math.cos(a) * d, y: h * 0.98, z: Math.sin(a) * d, ramp: RUSH, seg: 8 })));
    }
    g.add(c);
  };
  reeds(-2.55, -0.55, 9, 1.25); reeds(2.25, -1.5, 8, 1.1); reeds(-1.2, 2.25, 7, 0.95);

  // lily pads, one in flower
  [[-1.4, -0.9, 0.24], [-1.0, -1.4, 0.2], [1.5, 1.3, 0.26], [1.95, 0.85, 0.2]].forEach(([x, z, r], i) => {
    g.add(api.colourOnly(api.cylinder({ r, h: 0.02, x, y: W + 0.005, z, ramp: R.SAGE, lift: 0.08, seg: 14 })));
    if (i === 2) g.add(api.sphere({ r: 0.08, sy: 0.7, x, y: W + 0.05, z, ramp: R.PINK, seg: 8 }));
  });

  // the duck house on stilts at the back edge, a plank ramp down to the water
  const hx = 1.2, hz = -2.05;
  [[-0.4, -0.3], [0.4, -0.3], [-0.4, 0.3], [0.4, 0.3]].forEach(([x, z]) => g.add(api.box({ w: 0.08, h: 0.45, d: 0.08, x: hx + x, y: 0.225, z: hz + z, ramp: R.WOOD })));
  g.add(api.box({ w: 1.15, h: 0.07, d: 0.9, x: hx, y: 0.48, z: hz, ramp: R.WOOD }));
  g.add(api.box({ w: 0.8, h: 0.55, d: 0.62, x: hx, y: 0.79, z: hz - 0.05, mat: api.lambert('#efe4d2') }));
  g.add(api.gableRoof({ w: 0.8, d: 0.62, h: 0.32, overhang: 0.1, x: hx, y: 1.065, z: hz - 0.05, ramp: R.TERRACOTTA }));
  g.add(api.inkDoor({ w: 0.26, h: 0.32, x: hx, y: 0.52, z: hz + 0.26, frame: false }));
  g.add(api.box({ w: 0.26, h: 0.03, d: 0.75, x: hx, y: 0.3, z: hz + 0.75, rx: 0.5, ramp: R.WOOD, lift: 0.05 }));

  // a shade tree on the bank, random kind
  const kind = api.pick(['oak', 'olive', 'pine', 'oak']);
  if (kind === 'pine') g.add(api.pine({ h: 4.6, r: 1.8, lean: 0.6, x: -2.6, z: -2.55 }));
  else g.add(api.tree({ kind, h: kind === 'oak' ? 3.5 : 2.8, x: -2.55, z: -2.45, lean: 0.4, leanTo: [0.6, 0.6], rot: api.range(0, 6.28) }));

  // the ducks: a drake, a dabbling duck, a white duck asleep on the bank, and a family that swims a slow circle
  g.add(duck(api, { kind: 'drake', x: 0.4, y: W, z: -0.6, rot: 2.4 }));
  const dab = duck(api, { x: -0.6, y: W, z: 0.95, rot: -0.7 }); dab.children[dab.children.length - 1].rotation.x = 1.2; g.add(dab);
  g.add(duck(api, { kind: 'white', x: 3.25, y: 0.05, z: 0.35, rot: -2.0, still: true }));
  const fam = api.group({ x: 0.15, y: W, z: 0.35 }); fam.name = 'family';
  fam.add(duck(api, { x: 1.1, z: 0, rot: 0 }));   // the family turns clockwise seen from above: the mother heads +z, chicks trail behind
  for (let i = 0; i < 3; i++) { const a = -(0.42 + i * 0.3); fam.add(duck(api, { kind: 'chick', s: 0.85, x: Math.cos(a) * 1.1, z: Math.sin(a) * 1.1, rot: -a })); }
  g.add(fam);
  return g;
}

const parts = new WeakMap();
export function animate(obj, t) {
  let p = parts.get(obj);
  if (!p) { p = { float: [], fam: [], heads: [] }; obj.traverse(o => { if (o.name === 'float') p.float.push(o); else if (o.name === 'family') p.fam.push(o); else if (o.name === 'dabble') p.heads.push(o); }); parts.set(obj, p); }
  for (const d of p.float) {
    const u = d.userData; if (u.y0 === undefined) { u.y0 = d.position.y; u.r0 = d.rotation.y; }
    d.position.y = u.y0 + 0.012 * Math.sin(t * 1.6 + u.ph);
    d.rotation.y = u.r0 + 0.12 * Math.sin(t * 0.3 + u.ph);
  }
  for (const f of p.fam) f.rotation.y = -0.18 * t;
  for (const h of p.heads) { const s = Math.sin(t * 0.5 + h.userData.ph); h.rotation.x = s > 0.75 ? 1.3 : 0.05 * Math.sin(t * 2 + h.userData.ph); }
}
