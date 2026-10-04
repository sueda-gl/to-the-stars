// Beach rocks: a spit of pale sand where the sea has rounded three big grey boulders smooth, their lower
// halves stained dark by the tide, with a scatter of pebbles and a line of wrack (dried weed) along the
// high-water mark. Smooth round shapes, unlike the angular inland rocks.
export const meta = {
  id: 'beach-rocks', name: 'Beach rocks', aliases: ['beach rock', 'shore rocks', 'sea rocks', 'pebbles', 'shingle', 'rocky beach', 'kumsal kayaları', 'sahil taşları', 'çakıl'],
  category: 'nature', stage: 'camp', footprint: { w: 6.5, d: 4.5 }, height: 1.6, desc: 'sea-rounded boulders with tide-dark bases on a spit of sand, pebbles and a wrack line'
};

const SAND = ['#7b6a50', '#9b8665', '#baa37c', '#cfb991', '#ddc9a2'];
const WETSAND = ['#6a604f', '#867b66', '#a2977f', '#b6ab92', '#c3b8a0'];
const STONE = ['#45464a', '#626268', '#818087', '#9d9ba0', '#b4b1b3'];
const WARM = ['#4d453d', '#6c6258', '#8c8174', '#a69b8c', '#bbb09f'];
const TIDE = ['#22242a', '#33363d', '#474a50', '#5a5d61', '#696b6e'];
const WRACK = ['#1e1a12', '#2e2819', '#433a24', '#564b2e', '#635637'];
const SCRUB = WRACK;
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
  // sand, with a darker wet band toward the sea side (+z, the front)
  flat(api, g, blobPts(api, 3.2, 2.2, { wob: 0.1 }), { depth: 0.05, ramp: SAND });
  flat(api, g, blobPts(api, 2.6, 0.7, { cz: 1.35, wob: 0.12 }), { y: 0.05, depth: 0.03, ramp: WETSAND, speck: 0.2 });
  // the big rounded boulders, each with a tide-dark skirt
  const big = [[-0.9, -0.3, 1.1, 0.78, STONE], [0.75, 0.25, 0.85, 0.72, WARM], [1.9, -0.75, 0.55, 0.8, STONE]];
  big.forEach(([x, z, r, sy, ramp]) => {
    const rot = api.range(0, 6.28);
    rock(api, g, { r, sx: 1.1, sy, sz: 0.95, x, y: 0.03, z, rot, seg: 14, rough: 0.1, smooth: true, ramp, sink: 0.05 });
    rock(api, g, { r: r * 1.05, sx: 1.1, sy: sy * 0.32, sz: 1.0, x, y: 0.03, z, rot, seg: 14, rough: 0.1, smooth: true, ramp: TIDE, sink: 0.05 });
  });
  // pebbles
  for (let i = 0; i < 9; i++) {
    const x = api.range(-2.7, 2.7), z = api.range(-0.4, 1.8);
    rock(api, g, { r: api.range(0.1, 0.2), sx: api.range(1, 1.4), sy: 0.55, x, y: 0.04, z, seg: 8, rough: 0.08, smooth: true, rot: api.range(0, 6.28), ramp: api.pick([STONE, WARM, TIDE]) });
  }
  // the wrack line: low heaps of dried weed along the high-water mark, behind the rocks
  for (let i = 0; i < 7; i++) {
    const x = -2.6 + i * 0.85 + api.range(-0.2, 0.2), z = -1.45 + 0.2 * Math.sin(i * 1.7);
    rock(api, g, { r: api.range(0.2, 0.32), sx: 1.7, sy: 0.25, sz: 0.6, x, y: 0.03, z, seg: 9, rough: 0.2, smooth: true, rot: api.range(-0.3, 0.3), ramp: WRACK, sink: 0.2 });
  }
  return g;
}
