// Pond: a small round pond of deep blue-green water set a hand's depth into a grassy bank, edged with a few
// mossy stones and a clump of reeds, with lily pads (notched, each turned its own way) and two pale pink
// water-lilies. From above: a dark lens of water ringed by a lighter bank; up close, pads lying on the surface.
export const meta = {
  id: 'pond', name: 'Pond', aliases: ['ponds', 'lily pond', 'pool', 'small pond', 'water hole', 'gölet', 'havuz', 'nilüferli gölet', 'su birikintisi'],
  category: 'nature', stage: 'camp', footprint: { w: 6.5, d: 5.5 }, height: 1.6, desc: 'a small round pond with lily pads and water-lilies, a grassy bank, stones and reeds'
};

const BANK = ['#36421f', '#4d5a2a', '#667337', '#7e8a45', '#909a52'];
const MUDBANK = ['#3c3022', '#574632', '#715c43', '#887155', '#998266'];
const WATER = ['#0f2c44', '#163f5e', '#1f5577', '#2a6a8c', '#377c9c'];
const PAD = ['#2a4222', '#3f5f30', '#5a7f40', '#78a050', '#93b862'];
const LILY = ['#7a3a52', '#b05a78', '#d8869e', '#eeb2c0', '#f6d0d6'];
const STONE = ['#3f3a35', '#5c554c', '#7a7164', '#968b7a', '#aca08b'];
const BLADE = ['#2f3a17', '#4a5a22', '#6a7a2e', '#8c983e', '#a5ad4f'];
const SCRUB = BANK;
// a faceted boulder: a low-poly sphere pushed out of round by smooth noise, flat underneath, flat-shaded facets
// (smooth: true keeps it round-shaded, for bushes and mounds)
function rockGeo(api, { r = 1, sx = 1, sy = 0.7, sz = 1, seg = 7, rough = 0.2, sink = 0.12, smooth = false } = {}) {
  let geo = api.sphereGeo({ r: 1, seg });
  const p = geo.attributes.position, a = api.range(0, 9), b = api.range(0, 9), c = api.range(0, 9);
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const k = 1 + rough * (Math.sin(x * 2.1 + a) * Math.cos(y * 2.7 + b) + 0.6 * Math.sin(z * 3.3 + c + x * 1.7));
    x *= k; y *= k; z *= k;
    if (y < -0.3) y = -0.3 + (y + 0.3) * 0.2;   // a flattened foot, so it sits instead of balancing
    p.setXYZ(i, x * r * sx, y * r * sy, z * r * sz);
  }
  if (!smooth) geo = geo.toNonIndexed();
  geo.computeVertexNormals(); geo.computeBoundingBox();
  geo.translate(0, -geo.boundingBox.min.y - sink * r * sy, 0);
  return geo;
}
function rock(api, g, o) {
  const geo = rockGeo(api, o);
  geo.rotateY(o.rot || 0);
  if (o.tilt) geo.rotateZ(o.tilt);
  if (o.tiltX) geo.rotateX(o.tiltX);
  geo.translate(o.x || 0, o.y || 0, o.z || 0);
  const m = api.mesh(geo, o.ramp || STONE, { speck: o.speck ?? 0.24, lift: o.lift || 0 });
  geo.computeBoundingBox(); m.userData.top = geo.boundingBox.max.y;
  g.add(m); return m;
}
// a scrub mound: a round, softly lumpy bush (smooth-shaded, one outline), never a flat pad
function scrub(api, g, { x = 0, y = 0, z = 0, r = 0.5, h = r * 0.85, ramp = SCRUB }) {
  return rock(api, g, { r, sx: 1, sy: h / r, sz: 1, x, y, z, seg: 12, rough: 0.12, sink: 0.05, smooth: true, rot: api.range(0, 6.28), ramp, speck: 0.3 });
}
// a soft irregular outline [[x, z], ...] round (cx, cz), radii rx / rz
function blobPts(api, rx, rz, { cx = 0, cz = 0, n = 32, wob = 0.08 } = {}) {
  const p1 = api.range(0, 6.28), p2 = api.range(0, 6.28), pts = [];
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2, k = 1 + wob * Math.sin(a * 3 + p1) + wob * 0.6 * Math.sin(a * 5 + p2);
    pts.push([cx + Math.cos(a) * rx * k, cz + Math.sin(a) * rz * k]);
  }
  return pts;
}
// a flat painted ground piece of that outline: top at y + depth (shape [x, -z] so it lands on world x / z).
// Ground tints are colour only (no pencil ring: never a cut-out disc on the paper) unless line: true.
function flat(api, g, pts, { y = 0, depth = 0.05, ramp, speck = 0.28, lift = 0, holes = null, line = false } = {}) {
  const T = api.THREE, s = new T.Shape(); s.isShape = true;
  pts.forEach(([x, z], i) => (i ? s.lineTo(x, -z) : s.moveTo(x, -z)));
  if (holes) holes.forEach(h => { const ph = new T.Path(); h.forEach(([x, z], i) => (i ? ph.lineTo(x, -z) : ph.moveTo(x, -z))); s.holes.push(ph); });
  const m = api.extrude({ shape: s, depth, rx: -Math.PI / 2, y: y + depth / 2, ramp, speck, lift, curveSeg: 4 });
  if (!line) api.colourOnly(m);
  g.add(m); return m;
}

export function build(api) {
  const T = api.THREE, g = api.group();
  // the bank (a ring of grass, a muddy inner lip), and the water set just below its top
  const outer = blobPts(api, 3.15, 2.6, { wob: 0.07 }), lip = blobPts(api, 2.45, 1.95, { wob: 0.06 }), water = lip.map(([x, z]) => [x * 0.97, z * 0.97]);
  flat(api, g, outer, { depth: 0.16, ramp: BANK, holes: [lip] });
  flat(api, g, lip.map(([x, z]) => [x * 1.02, z * 1.02]), { depth: 0.1, ramp: MUDBANK, holes: [water], line: true });
  flat(api, g, water, { depth: 0.05, ramp: WATER, speck: 0.12, line: true });
  // lily pads: flat discs with a notch, lying on the water; the pads group drifts slowly (animate)
  const pads = api.group(); pads.name = 'pads';
  const spots = [[-0.95, -0.35, 0.52], [-0.3, 0.45, 0.42], [0.6, -0.65, 0.46], [1.3, 0.35, 0.4], [-1.55, 0.7, 0.34], [0.45, 1.15, 0.3]];
  spots.forEach(([x, z, r]) => {
    const s = new T.Shape(); s.isShape = true; const cut = 0.32, a0 = api.range(0, 6.28);
    s.moveTo(0, 0);
    for (let i = 0; i <= 16; i++) { const a = a0 + cut + i / 16 * (Math.PI * 2 - 2 * cut); s.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
    pads.add(api.extrude({ shape: s, depth: 0.04, rx: -Math.PI / 2, x, y: 0.1, z, ramp: PAD, speck: 0.18, lift: api.range(-0.06, 0.04) }));
  });
  // two water-lilies: a cup of pale pink petals on a pad
  [[-0.95, -0.35], [0.6, -0.65], [1.3, 0.35]].forEach(([x, z]) => {
    pads.add(api.cone({ r: 0.18, h: 0.16, x, y: 0.2, z, rx: Math.PI, seg: 7, ramp: LILY, lift: 0.06 }));
    pads.add(api.sphere({ r: 0.06, x, y: 0.22, z, ramp: api.ramps.YELLOW }));
  });
  g.add(pads);
  // stones on the bank, a clump of reeds on the far side
  [[2.35, -0.9, 0.42], [2.6, 0.35, 0.3], [-2.55, 0.9, 0.36], [-0.6, 2.15, 0.3], [1.3, 1.95, 0.26]].forEach(([x, z, r]) =>
    rock(api, g, { r, sx: api.range(1, 1.35), sy: api.range(0.55, 0.75), x, y: 0.1, z, rot: api.range(0, 6.28), ramp: STONE }));
  const rx = -1.65, rz = -1.55;
  rock(api, g, { r: 0.45, sy: 0.4, x: rx, y: 0.08, z: rz, seg: 9, smooth: true, rough: 0.14, sink: 0, ramp: MUDBANK });
  for (let i = 0; i < 9; i++) {
    const a = i / 9 * Math.PI * 2 + api.range(-0.3, 0.3), h = api.range(1.1, 1.5) * (i % 3 ? 1 : 0.8), t = api.range(0.12, 0.26);
    const b = api.cone({ r: 0.07, h, seg: 4, x: rx + Math.cos(a) * (0.12 + Math.sin(t) * h / 2), y: 0.15 + Math.cos(t) * h / 2, z: rz + Math.sin(a) * (0.12 + Math.sin(t) * h / 2), rz: -Math.cos(a) * t, rx: Math.sin(a) * t, ramp: BLADE, speck: 0.1 });
    api.colourOnly(b); g.add(b);
  }
  scrub(api, g, { x: 2.3, y: 0.12, z: 1.25, r: 0.45, h: 0.42, ramp: ['#2b3820', '#425431', '#5e7243', '#7b8f55', '#94a566'] });
  return g;
}

// the pads turn very slowly on the still water
export function animate(obj, t) {
  const p = obj.getObjectByName('pads');
  if (p) p.rotation.y = Math.sin(t * 0.12) * 0.05;
}
