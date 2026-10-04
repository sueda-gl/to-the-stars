// Cliff stones: a piece of sea-cliff or scarp. Thick horizontal beds of ochre and pale limestone lie one on
// another, each set back from the one below and broken along its front into ragged buttresses, so the face
// (toward +z) steps up in sheer ledges to a turf top with scrub; fallen blocks lie tumbled at the foot.
// From above: banded contour-like ledges, a hard ragged edge and a deep cast shadow.
export const meta = {
  id: 'cliff-stones', name: 'Cliff stones', aliases: ['cliff', 'cliffs', 'cliff face', 'rock face', 'bluff', 'escarpment', 'scarp', 'sea cliff', 'uçurum', 'yar', 'falez', 'kayalık yamaç'],
  category: 'nature', stage: 'camp', footprint: { w: 8.5, d: 5 }, height: 4.8, desc: 'stepped beds of ochre and pale limestone rising in sheer ledges to a turf top, fallen blocks at the foot'
};

const STONE = ['#4a3f33', '#6a5b49', '#8d7a62', '#a8937a', '#bba68c'];
const OCHRE = ['#54412c', '#755c40', '#957754', '#ab8c67', '#ba9b75'];
const PALE = ['#58524a', '#7a7265', '#9b9282', '#b4ab98', '#c5bca8'];
const TURF = ['#2f3a1c', '#45542a', '#5e6e37', '#768745', '#879852'];
const SCRUB = ['#28351f', '#3e4f2f', '#586b40', '#728550', '#899a60'];
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
  const beds = [[STONE, 1.35], [OCHRE, 1.15], [PALE, 1.25], [STONE, 1.0]];
  const back = -2.0;
  let y = 0, top = [];
  beds.forEach(([ramp, h], k) => {
    // the bed's plan: a straight back, a ragged buttressed front set back as it rises, shorter on the right
    const W0 = -4.1 + k * 0.3 + api.range(-0.15, 0.15), W1 = 4.1 - k * 1.05 + api.range(-0.2, 0.2);
    const front = 1.9 - k * 0.36, pts = [[W0, back], [W1, back]], n = 12;
    for (let i = 0; i <= n; i++) {
      const x = W1 - (W1 - W0) * i / n, jag = api.range(-0.42, 0.12) + 0.12 * Math.sin(i * 2.3 + k);
      pts.push([x, front + jag - (i === 0 || i === n ? 0.5 : 0)]);
    }
    flat(api, g, pts, { y, depth: h, ramp, speck: 0.3, lift: k % 2 ? -0.02 : 0.02, line: true });
    top = pts; y += h - 0.02;
  });
  // the turf on the top bed, inset from its edge, and scrub on the ledges
  flat(api, g, top.map(([x, z]) => [x * 0.9 - 0.05, (z - back) * 0.82 + back + 0.05]), { y, depth: 0.08, ramp: TURF, speck: 0.3 });
  scrub(api, g, { x: -2.2, y, z: -0.7, r: 0.55, h: 0.55 });
  scrub(api, g, { x: -0.4, y, z: -1.2, r: 0.45, h: 0.45 });
  scrub(api, g, { x: 2.15, y: 1.35 + 1.15 - 0.04, z: 0.2, r: 0.42, h: 0.42 });
  scrub(api, g, { x: 3.45, y: 1.33, z: 0.6, r: 0.38, h: 0.38 });
  // fallen blocks tumbled at the foot of the face
  const fallen = [[-2.6, 2.35, 0.85], [-0.8, 2.55, 0.6], [0.8, 2.4, 0.95], [2.6, 2.2, 0.55], [-3.6, 2.2, 0.45]];
  fallen.forEach(([x, z, s]) => block(api, g, { w: s * 1.2, h: s * 0.75, d: s, x, z, rot: api.range(0, 6.28), tilt: api.range(-0.25, 0.25), taper: 0.12, j: 0.14, ramp: api.pick([STONE, OCHRE, PALE]) }));
  for (let i = 0; i < 6; i++) rock(api, g, { r: api.range(0.14, 0.26), sy: 0.6, x: api.range(-3.8, 3.8), z: api.range(2.1, 2.9), seg: 6, rot: api.range(0, 6.28), ramp: api.pick([STONE, PALE]) });
  return g;
}
