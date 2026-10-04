// Dovecote: a square whitewashed pigeon tower on a limestone plinth, a terracotta hip roof crowned by a little
// lantern, two rows of ink pigeon holes with stone perch ledges near the top, an arched door at the foot and a
// round stone basin of water. Doves sit on the ledges and at the basin; a small flock wheels round the roof
// (animate: the flock circles, wings beat). From above: a square red roof on a white block, a ring of white birds.
// Footprint 4 x 4 (the flock circles above it), the door faces +z.
export const meta = {
  id: 'dovecote', name: 'Dovecote',
  aliases: ['dove cote', 'dovecot', 'pigeon tower', 'pigeon house', 'pigeon loft', 'columbarium', 'doves', 'pigeons', 'güvercinlik', 'güvercin', 'güvercinler'],
  category: 'animal', stage: 'town', footprint: { w: 4, d: 4 }, height: 6.6,
  desc: 'A whitewashed pigeon tower with a terracotta roof and doves wheeling round it.'
};

const DOVE = ['#6f6e74', '#97969c', '#bab9be', '#d6d5d8', '#ecebee'];
const DOVE_DARK = ['#3c3b42', '#55545c', '#706f78', '#8a8992', '#a3a2aa'];
const BEAK = ['#6a3530', '#8f4c45', '#b46a5f', '#c98073', '#d69384'];

// a dove facing +z (~0.45 m long, stylised a little large so it reads from the leader's view)
function dove(api, o) {
  const s = o.s || 1.35, g = api.group({ x: o.x, y: o.y || 0, z: o.z, rot: o.rot || 0 }), c = o.dark ? DOVE_DARK : DOVE;
  g.add(api.sphere({ r: 0.085 * s, sx: 0.85, sy: 0.8, sz: 1.9, y: 0.1 * s, ramp: c, seg: 10 }));
  g.add(api.sphere({ r: 0.058 * s, y: 0.17 * s, z: 0.13 * s, ramp: c, seg: 8 }));
  g.add(api.colourOnly(api.cone({ r: 0.015 * s, h: 0.05 * s, y: 0.165 * s, z: 0.2 * s, rx: Math.PI / 2, ramp: BEAK, seg: 4 })));
  g.add(api.colourOnly(api.box({ w: 0.11 * s, h: 0.02 * s, d: 0.14 * s, y: 0.1 * s, z: -0.19 * s, rx: -0.15, ramp: c })));
  if (o.fly) {
    [-1, 1].forEach(sd => {
      const w = api.group({ x: sd * 0.05 * s, y: 0.13 * s }); w.name = 'wing'; w.userData.sd = sd; w.userData.ph = o.ph;
      w.add(api.box({ w: 0.3 * s, h: 0.018 * s, d: 0.13 * s, x: sd * 0.15 * s, rot: sd * -0.15, ramp: c }));
      g.add(w);
    });
  }
  return g;
}

export function build(api) {
  const R = api.ramps, g = api.group();
  const tw = 2.3, th = 4.2, base = 0.3, f = tw / 2;

  // plinth, the white tower, a limestone band where the pigeon storey starts
  g.add(api.box({ w: tw + 0.6, h: base, d: tw + 0.6, y: base / 2, ramp: R.LIMESTONE }));
  g.add(api.box({ w: tw, h: th, d: tw, y: base + th / 2, mat: api.lambert('#f1e8d8') }));
  g.add(api.box({ w: tw + 0.12, h: 0.12, d: tw + 0.12, y: base + 2.95, ramp: R.LIMESTONE }));
  // the hip roof and its lantern (a tiny white cote with ink holes and its own roof)
  g.add(api.hipRoof({ w: tw, d: tw, h: 0.95, overhang: 0.22, y: base + th, ramp: R.TERRACOTTA }));
  g.add(api.box({ w: 0.62, h: 0.55, d: 0.62, y: base + th + 0.75, mat: api.lambert('#f1e8d8') }));
  g.add(api.inkWindow({ w: 0.2, h: 0.24, y: base + th + 0.76, z: 0.31, arched: true, frame: false }));
  g.add(api.inkWindow({ w: 0.2, h: 0.24, x: -0.31, y: base + th + 0.76, rot: -Math.PI / 2, arched: true, frame: false }));
  g.add(api.hipRoof({ w: 0.62, d: 0.62, h: 0.38, overhang: 0.1, y: base + th + 1.02, ramp: R.TERRACOTTA }));

  // two rows of pigeon holes on the front and the lit side, each row over a stone perch ledge
  for (let row = 0; row < 2; row++) {
    const y = base + 3.35 + row * 0.55;
    for (let i = 0; i < 3; i++) {
      const u = (i - 1) * 0.6 + (row ? 0.3 : 0) * 0;
      g.add(api.inkWindow({ w: 0.2, h: 0.26, x: u, y, z: f, arched: true, frame: false }));
      g.add(api.inkWindow({ w: 0.2, h: 0.26, x: -f, y, z: u, rot: -Math.PI / 2, arched: true, frame: false }));
    }
    g.add(api.box({ w: tw + 0.06, h: 0.06, d: 0.2, y: y - 0.17, z: f + 0.08, ramp: R.LIMESTONE }));
    g.add(api.box({ w: 0.2, h: 0.06, d: tw + 0.06, x: -f - 0.08, y: y - 0.17, ramp: R.LIMESTONE }));
  }
  g.add(api.inkDoor({ w: 0.75, h: 1.45, y: base, z: f }));
  g.add(api.inkWindow({ w: 0.35, h: 0.5, x: -f, y: base + 1.7, rot: -Math.PI / 2, frame: R.LIMESTONE }));

  // a round stone basin of water in front, two doves drinking at it
  const bx = -1.35, bz = 1.95;
  g.add(api.cylinder({ rb: 0.5, rt: 0.55, h: 0.4, x: bx, y: 0.2, z: bz, ramp: R.LIMESTONE, seg: 20 }));
  g.add(api.cylinder({ r: 0.44, h: 0.03, x: bx, y: 0.4, z: bz, ramp: R.SEA, lift: 0.1, seg: 20 }));
  g.add(dove(api, { x: bx + 0.42, y: 0.4, z: bz + 0.15, rot: -1.9 }));
  g.add(dove(api, { x: bx - 0.2, y: 0, z: bz + 0.7, rot: 2.4, dark: true }));
  // doves perched on the ledges
  const ly = base + 3.35 - 0.14;
  g.add(dove(api, { x: -0.75, y: ly, z: f + 0.1, rot: 0.2 }));
  g.add(dove(api, { x: 0.35, y: ly + 0.55, z: f + 0.1, rot: -0.3, dark: true }));
  g.add(dove(api, { x: -f - 0.1, y: ly, z: 0.55, rot: -Math.PI / 2 + 0.3 }));

  // the flock wheeling round the roof: one group that turns, each dove banking on its own wingbeat
  const flock = api.group(); flock.name = 'flock';
  const n = 5, a0 = api.range(0, 6.28);
  for (let i = 0; i < n; i++) {
    const a = a0 + i / n * Math.PI * 2 + api.range(-0.3, 0.3), r = api.range(2.0, 2.6), y = base + th + api.range(0.6, 1.9);
    const d = dove(api, { x: Math.cos(a) * r, y, z: Math.sin(a) * r, rot: -a, fly: true, ph: api.range(0, 6.28) });
    d.rotation.z = 0.35; d.name = 'flyer'; d.userData.ph = api.range(0, 6.28); d.userData.y0 = y;
    flock.add(d);
  }
  g.add(flock);

  api.proxy(api.boxGeo({ w: tw, h: th, d: tw, y: base + th / 2 }), g);
  return g;
}

const parts = new WeakMap();
export function animate(obj, t) {
  let p = parts.get(obj);
  if (!p) { p = { flock: [], flyers: [], wings: [] }; obj.traverse(o => { if (o.name === 'flock') p.flock.push(o); else if (o.name === 'flyer') p.flyers.push(o); else if (o.name === 'wing') p.wings.push(o); }); parts.set(obj, p); }
  for (const f of p.flock) f.rotation.y = -0.55 * t;
  for (const d of p.flyers) d.position.y = d.userData.y0 + 0.25 * Math.sin(t * 0.9 + d.userData.ph);
  for (const w of p.wings) w.rotation.z = w.userData.sd * (0.15 + 0.65 * Math.sin(t * 11 + (w.userData.ph || 0)));
}
