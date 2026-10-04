// Pine stand: a stand of five umbrella pines, the Roman stone pine of the Mediterranean coast: tall bare
// leaning trunks under flat dark domes, no two the same height, leaning away from each other toward the light,
// over a carpet of russet needles with a little scrub. From above: overlapping dark domes, long shadows.
export const meta = {
  id: 'pine-stand', name: 'Pine stand', aliases: ['pines', 'pine trees', 'pine grove', 'umbrella pines', 'stone pines', 'pinewood', 'pine wood', 'çam', 'çamlar', 'çamlık', 'fıstık çamı'],
  category: 'nature', stage: 'camp', footprint: { w: 10, d: 9 }, height: 7.5, desc: 'five umbrella pines of different heights over a carpet of russet needles'
};

const NEEDLES = ['#4a3726', '#664c34', '#7f6043', '#917051', '#9d7b5b'];
const SCRUB = ['#2b3820', '#425431', '#5e7243', '#7b8f55', '#94a566'];
const STONE = NEEDLES;
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
  flat(api, g, blobPts(api, 4.2, 3.7, { wob: 0.12 }), { depth: 0.03, ramp: NEEDLES, speck: 0.32 });
  // five pines on a loose ring with one near the middle; each leans outward, the canopies just touching
  const n = 5, a0 = api.range(0, 6.28), spots = [[api.range(-0.4, 0.4), api.range(-0.4, 0.4)]];
  for (let i = 0; i < n - 1; i++) { const a = a0 + i / (n - 1) * Math.PI * 2 + api.range(-0.3, 0.3), d = api.range(2.3, 2.9); spots.push([Math.cos(a) * d * 1.1, Math.sin(a) * d * 0.95]); }
  spots.forEach(([x, z], i) => {
    const h = i === 0 ? api.range(6.8, 7.6) : api.range(5.0, 6.6);
    g.add(api.pine({ h, r: h * api.range(0.36, 0.42), lean: api.range(0.5, 1.0), leanTo: i === 0 ? [-0.6, 0.4] : [x, z], x, z }));
  });
  // a little scrub and a fallen cone-coloured mound or two
  for (let i = 0; i < 3; i++) { const a = a0 + 0.5 + i * 2.1; scrub(api, g, { x: Math.cos(a) * 3.6, z: Math.sin(a) * 3.1, r: api.range(0.4, 0.6), h: api.range(0.4, 0.55) }); }
  return g;
}
