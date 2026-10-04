// Trail: a short winding footpath of packed pale earth, worn darker down the middle where feet go, edged with
// pebbles and tussocks of grass, and a little cairn of stacked flat stones at the bend as a waymark. It runs
// along x (about 9 m) and lies flat on the ground.
export const meta = {
  id: 'trail', name: 'Trail', aliases: ['footpath', 'foot path', 'path', 'track', 'dirt path', 'dirt track', 'trail segment', 'patika', 'keçi yolu', 'toprak yol', 'iz'],
  category: 'prop', stage: 'camp', footprint: { w: 9, d: 3 }, height: 0.7, desc: 'a short winding footpath of packed earth with pebbles, grass tussocks and a waymark cairn'
};

const TRACK = ['#6c5638', '#8b714c', '#a98d62', '#bea478', '#ccb489'];
const WORN = ['#5a4630', '#765d40', '#927553', '#a68966', '#b59877'];
const STONE = ['#4c463f', '#6c645a', '#8e8576', '#aca28f', '#c3b9a3'];
const SCRUB = ['#2f3d1e', '#46582b', '#617439', '#7b8f48', '#91a457'];
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
  const curve = new T.CatmullRomCurve3([[-4.5, 0, 0.7], [-2.4, 0, -0.5], [-0.3, 0, 0.35], [1.9, 0, -0.55], [4.5, 0, 0.45]].map(p => new T.Vector3(p[0], 0, p[2])));
  const P = curve.getPoints(30);
  const side = (off, wob, ph) => P.map((p, i) => { const q = P[Math.min(P.length - 1, i + 1)], o = P[Math.max(0, i - 1)], dx = q.x - o.x, dz = q.z - o.z, l = Math.hypot(dx, dz) || 1, w = off * (1 + wob * Math.sin(i * 1.9 + ph)) * Math.min(1, 0.3 + 0.7 * Math.min(i, P.length - 1 - i) / 5); return [p.x - dz / l * w, p.z + dx / l * w]; });
  const band = (a, b, ph) => side(a, 0.12, ph).concat(side(b, 0.12, ph + 1).reverse());
  flat(api, g, band(0.62, -0.62, 0), { depth: 0.04, ramp: TRACK });
  flat(api, g, band(0.2, -0.2, 2), { y: 0.04, depth: 0.03, ramp: WORN, speck: 0.3 });
  // pebbles and tussocks along both edges
  for (let i = 0; i < 12; i++) {
    const k = Math.round(api.range(0.08, 0.92) * (P.length - 1)), p = P[k], q = P[Math.min(P.length - 1, k + 1)], o = P[Math.max(0, k - 1)];
    const dx = q.x - o.x, dz = q.z - o.z, l = Math.hypot(dx, dz) || 1, s = i % 2 ? 1 : -1, off = api.range(0.72, 1.0) * s;
    const x = p.x - dz / l * off, z = p.z + dx / l * off;
    if (i % 3 === 0) scrub(api, g, { x, z, r: api.range(0.28, 0.42), h: api.range(0.28, 0.4) });
    else rock(api, g, { r: api.range(0.16, 0.27), sx: api.range(1, 1.3), sy: 0.6, x, z, seg: 6, rot: api.range(0, 6.28), lift: -0.12 });
  }
  // the waymark cairn at the inside of the middle bend
  const c = P[Math.round(P.length * 0.5)], cx = c.x + 0.1, cz = c.z - 1.15;
  let y = 0;
  [[0.42, 0.2], [0.34, 0.18], [0.26, 0.16], [0.18, 0.15]].forEach(([r, h], i) => {
    const m = rock(api, g, { r, sx: 1, sy: h / r, sz: 0.85, x: cx + api.range(-0.04, 0.04), y, z: cz, seg: 7, rough: 0.1, sink: 0.15, rot: api.range(0, 6.28), lift: i * 0.03 });
    y = m.userData.top - 0.05;
  });
  return g;
}
