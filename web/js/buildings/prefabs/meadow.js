// Wildflower meadow: an irregular patch of long summer grass, swelling in soft green mounds, carrying broad
// drifts of colour (poppy red, buttercup yellow, wild lavender, chamomile white) the way a painter blocks them
// in: big soft shapes, never confetti. A few tall spikes of foxglove and mullein stand up for scale.
export const meta = {
  id: 'meadow', name: 'Wildflower meadow', aliases: ['wildflower meadow', 'meadow', 'meadows', 'wildflowers', 'flower meadow', 'flowers', 'flower field', 'çayır', 'kır çiçekleri', 'çiçek tarlası', 'çimen'],
  category: 'nature', stage: 'camp', area: true, footprint: { w: 9, d: 7 }, height: 0.9, desc: 'a patch of long grass with broad drifts of poppies, buttercups, lavender and chamomile'
};

const GRASS = ['#36421f', '#4d5a2a', '#667337', '#7e8a45', '#909a52'];
const GRASS2 = ['#33402a', '#4a5a38', '#637548', '#7b8d58', '#8e9e66'];
const POPPY = ['#5e1410', '#8e2418', '#c23a24', '#d9533a', '#e86d4f'];
const BUTTER = ['#7a5a12', '#a77d18', '#cfa224', '#e2ba36', '#eccb4f'];
const LAV = ['#3b2f55', '#55467a', '#7362a0', '#8d7cb7', '#a294c8'];
const CHAM = ['#7c7466', '#a69d8b', '#cbc3ae', '#e2dbc6', '#efe9d6'];
const SPIKE = ['#4a2140', '#6e3460', '#985086', '#b46ba0', '#c788b4'];
const SCRUB = GRASS;
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
  // the grass patch (a painted tint, no pencil ring), and soft swells of longer grass on it
  flat(api, g, blobPts(api, 4.4, 3.4, { wob: 0.1 }), { depth: 0.04, ramp: GRASS });
  const swells = [[-2.7, -1.3, 0.9], [2.0, -1.7, 0.85], [3.0, 1.0, 0.7], [-1.2, 1.7, 0.75], [0.4, 0.1, 0.6]];
  swells.forEach(([x, z, r]) => scrub(api, g, { x, y: 0.02, z, r: r * api.range(0.9, 1.15), h: 0.38, ramp: api.pick([GRASS, GRASS2]) }));
  // the drifts: a broad wash of flower colour laid into the grass (paint only), with a few low rounded clumps
  // of the same flowers standing up out of it, so it has body at eye level and reads as a colour field from above
  const drifts = [[POPPY, -2.0, 0.2, 1.5, 0.8], [BUTTER, 1.3, 0.8, 1.35, 0.7], [LAV, 0.1, -1.9, 1.3, 0.6], [CHAM, -0.6, 2.2, 1.0, 0.5], [POPPY, 2.7, -0.4, 0.8, 0.55], [BUTTER, -3.1, 1.5, 0.7, 0.45], [LAV, -1.8, -2.2, 0.8, 0.45]];
  drifts.forEach(([ramp, x, z, rx, rz]) => {
    const rot = api.range(-0.5, 0.5), c = Math.cos(rot), sn = Math.sin(rot);
    flat(api, g, blobPts(api, rx, rz, { wob: 0.22, n: 20 }).map(([px, pz]) => [x + px * c - pz * sn, z + px * sn + pz * c]), { y: 0.04, depth: 0.04, ramp, speck: 0.36 });
    const k = rx > 1.1 ? 3 : 2;
    for (let i = 0; i < k; i++) {
      const t = (i - (k - 1) / 2) / k * 1.3 + api.range(-0.1, 0.1), px = t * rx, pz = api.range(-0.25, 0.25) * rz;
      api.colourOnly(scrub(api, g, { x: x + px * c - pz * sn, y: 0.06, z: z + px * sn + pz * c, r: api.range(0.26, 0.38), h: api.range(0.24, 0.34), ramp }));   // paint, no pencil rings
    }
  });
  // a few tall spikes: foxgloves (purple) and mullein (yellow), each a slim cone on a stalk
  const spikes = [[-2.3, -0.4, SPIKE], [-1.85, 0.75, SPIKE], [1.0, 1.4, BUTTER], [0.9, -1.2, SPIKE], [3.3, 0.3, BUTTER]];
  spikes.forEach(([x, z, ramp]) => {
    const h = api.range(0.75, 1.0);
    g.add(api.cylinder({ r: 0.025, h, x, y: h / 2, z, ramp: GRASS, seg: 5 }));
    g.add(api.cone({ r: 0.12, h: h * 0.55, x, y: h * 0.82, z, ramp, seg: 8, lift: 0.04 }));
  });
  return g;
}
