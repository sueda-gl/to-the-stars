// Olive trees pair: two old olives, stout grey twisted trunks leaning toward each other under round silver-sage
// crowns, standing in a low oval terrace of dry-stone kerb with a bed of warm earth, a couple of field stones
// and a basket-sized heap of pruned branches. The oldest planted thing on the farm.
export const meta = {
  id: 'olive-pair', name: 'Olive trees', aliases: ['olive trees', 'olives', 'two olives', 'olive tree', 'pair of olives', 'zeytin', 'zeytin ağacı', 'zeytin ağaçları', 'iki zeytin'],
  category: 'nature', stage: 'hamlet', footprint: { w: 6, d: 4.5 }, height: 3.6, desc: 'two old olive trees leaning together on a dry-stone terrace bed'
};

const EARTH = ['#55402c', '#6f553b', '#886a4b', '#9a7a59', '#a68664'];
const STONE = ['#4c463f', '#6c645a', '#8e8576', '#aca28f', '#c3b9a3'];
const TWIG = ['#2b241c', '#45392c', '#5e5040', '#746656', '#867868'];
const SCRUB = EARTH;
// an angular stone block: a box whose corners are knocked out of square and whose top narrows (strata, megaliths)
function blockGeo(api, { w = 1, h = 1, d = 1, taper = 0.15, j = 0.12, lean = 0 } = {}) {
  let geo = api.boxGeo({ w, h, d, y: h / 2 });
  const p = geo.attributes.position, s = api.range(0, 50);
  const n = (x, y, z, k) => Math.sin(x * 12.9898 + y * 78.233 + z * 37.719 + s * k) * 0.5 + Math.sin(x * 4.1 - z * 7.7 + y * 3.3 + s) * 0.5;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), t = y / h, k = 1 - taper * t;
    p.setXYZ(i, x * k + j * w * n(x, y, z, 1) + lean * y, y + j * h * 0.35 * n(x, y, z, 2), z * k + j * d * n(x, y, z, 3));
  }
  geo = geo.toNonIndexed(); geo.computeVertexNormals();
  return geo;
}
function block(api, g, o) {
  const geo = blockGeo(api, o);
  if (o.tilt) geo.rotateZ(o.tilt);
  if (o.tiltX) geo.rotateX(o.tiltX);
  geo.rotateY(o.rot || 0);
  geo.translate(o.x || 0, o.y || 0, o.z || 0);
  const m = api.mesh(geo, o.ramp || STONE, { speck: o.speck ?? 0.26, lift: o.lift || 0 });
  geo.computeBoundingBox(); m.userData.top = geo.boundingBox.max.y;
  g.add(m); return m;
}
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
  // the terrace bed: warm earth inside a kerb of rough stones round an oval
  const RX = 2.7, RZ = 1.85;
  flat(api, g, blobPts(api, RX, RZ, { wob: 0.04, n: 36 }), { depth: 0.12, ramp: EARTH });
  const n = 18;
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2, x = Math.cos(a) * RX, z = Math.sin(a) * RZ;
    block(api, g, { w: api.range(0.75, 0.95), h: api.range(0.26, 0.34), d: 0.42, x, z, rot: -Math.atan2(RZ * Math.cos(a), -RX * Math.sin(a)), taper: 0.18, j: 0.1, ramp: STONE, lift: api.range(-0.05, 0.05) });
  }
  // the two olives, leaning toward each other
  g.add(api.tree({ kind: 'olive', h: api.range(3.1, 3.5), r: 1.15, lean: 0.6, leanTo: [1, 0.15], x: -1.15, y: 0.1, z: api.range(-0.25, 0.1), rot: api.range(0, 6.28) }));
  g.add(api.tree({ kind: 'olive', h: api.range(2.7, 3.1), r: 1.0, lean: 0.55, leanTo: [-1, -0.1], x: 1.2, y: 0.1, z: api.range(-0.05, 0.3), rot: api.range(0, 6.28) }));
  // a heap of pruned branches by the kerb and two field stones
  for (let i = 0; i < 5; i++) {   // paint only: a heap of sticks would scribble
    const t = api.cylinder({ rb: 0.06, rt: 0.03, h: 1.1, x: 1.65 + api.range(-0.1, 0.1), y: 0.18 + (i % 3) * 0.06, z: 0.95 + api.range(-0.15, 0.15), rz: Math.PI / 2, rot: api.range(-0.6, 0.6), ramp: TWIG, seg: 5 });
    api.colourOnly(t); g.add(t);
  }
  rock(api, g, { r: 0.3, sy: 0.6, x: -3.3, z: 0.9, rot: api.range(0, 6.28), ramp: STONE });
  rock(api, g, { r: 0.22, sy: 0.6, x: -3.05, z: 1.35, rot: api.range(0, 6.28), ramp: STONE });
  return g;
}
