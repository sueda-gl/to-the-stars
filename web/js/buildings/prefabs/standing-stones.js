// Standing stones: a ring of nine weathered megaliths on a trodden grass circle, tall and leaning a little,
// one long fallen and half sunk, a trilithon (two uprights and a lintel) marking the way in at the back, and
// a low flat altar stone in the middle. The oldest made thing in the land: from above, a clear ring.
export const meta = {
  id: 'standing-stones', name: 'Standing stones', aliases: ['stone circle', 'standing stone', 'menhir', 'menhirs', 'megaliths', 'henge', 'dolmen', 'dikili taş', 'dikili taşlar', 'taş çember', 'menhirler'],
  category: 'landmark', stage: 'village', footprint: { w: 10, d: 10 }, height: 3.4, desc: 'a ring of nine weathered megaliths with a trilithon and a flat altar stone'
};

const STONE = ['#3f3c39', '#5d5954', '#7e786f', '#9b958a', '#b2aca0'];
const STONE_WARM = ['#47403a', '#685e55', '#8a7f72', '#a69b8c', '#bab0a0'];
const LICHEN = ['#5e5426', '#857a3a', '#a89b52', '#c2b46a', '#d3c682'];
const GRASS = ['#36421f', '#4d5a2a', '#667337', '#7e8a45', '#909a52'];
const WORN = ['#6a5a40', '#8a7655', '#a8936c', '#bea882', '#cdb892'];
const SCRUB = GRASS;
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
  const Rr = 3.7;
  // the trodden ring under the stones, the grass inside and out
  flat(api, g, blobPts(api, 4.9, 4.9, { wob: 0.04, n: 40 }), { depth: 0.04, ramp: GRASS });
  flat(api, g, blobPts(api, Rr + 0.75, Rr + 0.75, { wob: 0.03, n: 40 }), { y: 0.04, depth: 0.03, ramp: WORN, holes: [blobPts(api, Rr - 0.7, Rr - 0.7, { wob: 0.04, n: 40 })] });
  // the ring: nine places, the back one (−z) is the trilithon, one has fallen
  const n = 10, fallenAt = 3 + Math.floor(api.rand() * 3);
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + i / n * Math.PI * 2 + api.range(-0.06, 0.06), x = Math.cos(a) * Rr, z = Math.sin(a) * Rr, ramp = api.pick([STONE, STONE, STONE_WARM]);
    if (i === 0) continue;   // the trilithon goes here
    if (i === fallenAt) {    // lying along the ring, half in the turf
      block(api, g, { w: 0.62, h: 2.6, d: 0.42, x, y: 0.18, z, tilt: Math.PI / 2 - 0.06, rot: -a + api.range(-0.3, 0.3), taper: 0.18, j: 0.08, ramp });
      continue;
    }
    const h = api.range(2.1, 2.9), s = block(api, g, { w: api.range(0.65, 0.85), h, d: api.range(0.4, 0.5), x, z, rot: -a + Math.PI / 2 + api.range(-0.2, 0.2), tilt: api.range(-0.07, 0.07), tiltX: api.range(-0.05, 0.05), taper: api.range(0.15, 0.3), j: 0.09, ramp });
    if (i % 3 === 1) block(api, g, { w: 0.4, h: 0.06, d: 0.3, x, y: s.userData.top - 0.1, z, rot: -a, taper: 0.4, j: 0.1, ramp: LICHEN });
  }
  // the trilithon at the back
  const tz = -Rr - 0.1, tr = api.pick([STONE, STONE_WARM]);
  block(api, g, { w: 0.8, h: 3.0, d: 0.55, x: -0.75, z: tz, taper: 0.12, j: 0.06, ramp: tr });
  block(api, g, { w: 0.8, h: 3.0, d: 0.55, x: 0.75, z: tz, taper: 0.12, j: 0.06, ramp: tr });
  block(api, g, { w: 2.6, h: 0.52, d: 0.62, x: 0, y: 2.92, z: tz, taper: 0.05, j: 0.05, ramp: tr, lift: 0.04 });
  // the altar stone in the middle, and its little apron of worn earth
  flat(api, g, blobPts(api, 1.1, 0.85, { wob: 0.1 }), { y: 0.04, depth: 0.03, ramp: WORN });
  block(api, g, { w: 1.6, h: 0.4, d: 0.95, y: 0.02, rot: api.range(-0.2, 0.2), taper: 0.06, j: 0.06, ramp: STONE_WARM, lift: 0.05 });
  return g;
}
