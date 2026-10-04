// Cypress row: a windbreak line of tall dark Italian cypresses along x, the Mediterranean's own boundary mark,
// with a little irregularity (heights alternate and wander, one younger tree in the line) standing in a
// narrow strip of turned earth. From above: a dotted line of dark spindles and long parallel shadows.
export const meta = {
  id: 'cypress-row', name: 'Cypress row', aliases: ['cypresses', 'cypress trees', 'row of cypresses', 'cypress line', 'cypress avenue', 'windbreak', 'servi', 'selvi', 'selviler', 'servi sırası'],
  category: 'nature', stage: 'hamlet', footprint: { w: 11, d: 2 }, height: 6.5, desc: 'a windbreak line of tall dark cypresses in a strip of earth'
};

const EARTH = ['#4a3a2a', '#634f3b', '#7c654c', '#8e765b', '#9a8266'];
const CYPRESS = ['#0b1208', '#18240f', '#2b3c1a', '#4a5a2a', '#6d7a3c'];   // the kit's cypress green, a value deeper (a flame has no leaf flecks)
// triangles in a built part. Trees differ a lot in cost (the kit's cypress is ~29k, a round tree ~3.7k), so the
// object counts as it plants and stays well inside the 120k budget whatever tree module is wired in.
function trisOf(o) {
  let t = 0;
  o.traverse(m => { if (m.isMesh && m.geometry && m.geometry.attributes.position) { const q = m.geometry, n = (q.index ? q.index.count : q.attributes.position.count) / 3; t += m.isInstancedMesh ? n * m.count : n; } });
  return t;
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

// a painted cypress flame: a turned spindle with soft bulges and vertical flame ridges, one outline. Used only
// when the api's cypress is the heavy eye-level kit tree (a row of seven of those would break the budget).
function flame(api, g, h, x, z) {
  const w = h * api.range(0.1, 0.12), prof = [[0.12, 0], [0.7, 0.05], [0.95, 0.18], [1.0, 0.34], [0.9, 0.55], [0.66, 0.75], [0.36, 0.9], [0.06, 1.0]];
  const geo = api.latheGeo({ points: prof.map(([r, y]) => [r * w, y * h]), seg: 14 });
  const p = geo.attributes.position, ph = api.range(0, 6.28);
  for (let i = 0; i < p.count; i++) {
    const px = p.getX(i), py = p.getY(i), pz = p.getZ(i), a = Math.atan2(pz, px);
    const k = 1 + 0.1 * Math.sin(a * 5 + py * 1.3 + ph) + 0.06 * Math.sin(py * 4.1 + ph);
    p.setXYZ(i, px * k, py, pz * k);
  }
  geo.computeVertexNormals(); geo.translate(x, 0, z);
  g.add(api.mesh(geo, CYPRESS, { speck: 0.32, lift: -0.05 }));
}

export function build(api) {
  const g = api.group();
  const n = 7, gap = 1.55, young = 1 + Math.floor(api.rand() * (n - 2));
  flat(api, g, blobPts(api, n * gap / 2 + 0.4, 0.75, { wob: 0.05, n: 36 }), { depth: 0.04, ramp: EARTH });
  const spot = i => [(i - (n - 1) / 2) * gap + api.range(-0.12, 0.12), api.range(-0.12, 0.12)];
  const heightOf = i => (i === young ? api.range(2.6, 3.2) : api.range(5.0, 6.4) * (i % 2 ? 0.92 : 1));
  // the young tree first, through the api: if the api's cypress is light, every tree is the api's
  const [yx, yz] = spot(young), first = api.cypress({ h: heightOf(young), x: yx, z: yz });
  g.add(first);
  const light = trisOf(first) < 9000;
  for (let i = 0; i < n; i++) {
    if (i === young) continue;
    const [x, z] = spot(i), h = heightOf(i);
    if (light) g.add(api.cypress({ h, x, z })); else flame(api, g, h, x, z);
  }
  return g;
}
