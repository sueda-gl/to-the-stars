// Stream stones: a ford of flat stepping stones across a shallow stream, worn pale on top, a couple of
// larger dark wet rocks mid-stream, pebbles on the shingle and tussocks of grass at the water's edge. y = 0 is
// the water line: it drops onto the world's river, and alone it carries its own pool of water and shingle.
export const meta = {
  id: 'stream-stones', name: 'Stream stones', aliases: ['stepping stones', 'stream crossing', 'ford', 'brook', 'stream', 'creek', 'river stones', 'dere', 'dere taşları', 'basamak taşları', 'geçit'],
  category: 'nature', stage: 'camp', water: true, footprint: { w: 6, d: 4.5 }, height: 0.7, desc: 'a run of shallow stream with flat stepping stones across it, pebbles and grass on the banks'
};

const WATER = ['#12324b', '#194764', '#215e7e', '#2d7393', '#3b86a3'];
const BANK = ['#36421f', '#4d5a2a', '#667337', '#7e8a45', '#909a52'];
const SAND = ['#6f5c43', '#8f7859', '#ae966f', '#c4ad84', '#d3be95'];
const STONE = ['#4a453f', '#69625a', '#8a8072', '#a89d89', '#c0b59e'];
const DARK = ['#2f2c29', '#47423c', '#615a51', '#7a7266', '#8d8577'];
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
  const g = api.group();
  // a soft lens of shingle and, inside it, the water (outlined: the water's edge is a drawn line)
  flat(api, g, blobPts(api, 3.2, 1.75, { wob: 0.1, n: 30 }), { depth: 0.06, ramp: SAND, line: true });
  flat(api, g, blobPts(api, 2.85, 1.3, { wob: 0.12, n: 30 }), { y: 0.06, depth: 0.06, ramp: WATER, speck: 0.12, line: true });
  // stepping stones across (front to back), slightly staggered, flat-topped and pale where feet wear them
  for (let i = 0; i < 5; i++) {
    const t = -1.25 + i * 0.62;
    rock(api, g, { r: 0.36 + api.range(-0.03, 0.05), sx: 1.15, sy: 0.42, sz: 0.95, x: 0.15 + api.range(-0.15, 0.15) + t * 0.18, y: 0.08, z: t, rot: api.range(0, 6.28), seg: 7, rough: 0.14, ramp: STONE, lift: 0.05 });
  }
  // bigger rocks mid-stream, darker and wet
  rock(api, g, { r: 0.48, sy: 0.72, x: -1.75, y: 0.08, z: 0.15, rot: api.range(0, 6.28), ramp: DARK });
  rock(api, g, { r: 0.34, sy: 0.65, x: 1.85, y: 0.08, z: -0.35, rot: api.range(0, 6.28), ramp: DARK });
  rock(api, g, { r: 0.22, sy: 0.6, x: 1.25, y: 0.08, z: 0.55, rot: api.range(0, 6.28), ramp: DARK, seg: 6 });
  // pebbles on the shingle, both sides
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + api.range(-0.2, 0.2);
    rock(api, g, { r: api.range(0.12, 0.2), sy: 0.6, x: Math.cos(a) * 3.0, y: 0.02, z: Math.sin(a) * 1.5, seg: 6, rot: api.range(0, 6.28), ramp: api.pick([STONE, DARK]) });
  }
  // grass tussocks at the water's edge
  [[-2.5, 1.35], [1.1, 1.6], [2.8, -1.0], [-0.9, -1.65]].forEach(([x, z]) => scrub(api, g, { x, y: 0.02, z, r: api.range(0.3, 0.42), h: 0.36, ramp: BANK }));
  return g;
}
