// Fallen log: an old trunk lying where it fell, thick dark bark, a clean pale saw-cut at one end and a torn,
// splintered stump-end at the other, two broken branch stubs, a cushion of moss along its back, a little
// group of red-capped mushrooms in its shadow and ferns at the root end.
export const meta = {
  id: 'fallen-log', name: 'Fallen log', aliases: ['log', 'logs', 'fallen tree', 'dead tree', 'tree trunk', 'trunk', 'kütük', 'devrik ağaç', 'ağaç gövdesi'],
  category: 'nature', stage: 'camp', footprint: { w: 5, d: 2 }, height: 0.9, desc: 'a fallen trunk with moss, a saw-cut end, branch stubs, mushrooms and ferns'
};

const BARK = ['#271c14', '#3b2b1e', '#53402d', '#6a533c', '#7c644a'];
const CUT = ['#7a5c3a', '#9c7a50', '#bf9a68', '#d4b07c', '#e2c290'];
const MOSS = ['#2f3a1f', '#47562c', '#64763a', '#7f9048', '#96a657'];
const CAP = ['#5a1210', '#8c2218', '#bb3422', '#d24d34', '#e2684a'];
const STEM = ['#8c8270', '#b0a68f', '#cfc5ab', '#e0d8c0', '#ece6d2'];
const FERN = ['#263a1c', '#3a5428', '#527034', '#6b8a42', '#80a050'];
const STONE = BARK, SCRUB = FERN;
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

export function build(api) {
  const g = api.group();
  const L = 4.2, R0 = 0.36, R1 = 0.28, y = R0 * 0.92;   // lying along x, root end (thicker) at -x
  const log = api.group({ y, rot: api.range(-0.15, 0.15) });
  log.add(api.cylinder({ rb: R0, rt: R1, h: L, rz: Math.PI / 2, ramp: BARK, seg: 14, speck: 0.3 }));   // rb end ends up at +x after rz
  // saw-cut at the thin end, torn splinters at the thick end
  log.add(api.cylinder({ r: R1 * 0.93, h: 0.04, x: -L / 2 - 0.01, rz: Math.PI / 2, ramp: CUT, seg: 14, lift: 0.06 }));
  log.add(api.torus({ r: R1 * 0.5, tube: 0.018, x: -L / 2 - 0.035, rz: Math.PI / 2, ramp: CUT, seg: 14, flat: false, lift: -0.15 }));
  for (let i = 0; i < 4; i++) {
    const a = i / 4 * Math.PI * 2 + api.range(-0.3, 0.3);
    log.add(api.cone({ r: 0.14, h: api.range(0.35, 0.6), seg: 4, x: L / 2 + 0.15, y: Math.sin(a) * R0 * 0.5, z: Math.cos(a) * R0 * 0.5, rz: -Math.PI / 2 + api.range(-0.2, 0.2), ramp: api.pick([BARK, CUT]), lift: -0.04 }));
  }
  // two broken branch stubs
  log.add(api.cylinder({ rb: 0.11, rt: 0.07, h: 0.6, x: -0.5, y: R1 + 0.2, z: -0.1, rz: 0.55, rx: -0.3, ramp: BARK, seg: 8 }));
  log.add(api.cylinder({ rb: 0.09, rt: 0.06, h: 0.45, x: 0.9, y: 0.05, z: R0 + 0.15, rx: 1.15, ramp: BARK, seg: 8 }));
  g.add(log);
  // moss along the back of the log
  rock(api, g, { r: 0.95, sx: 1, sy: 0.16, sz: 0.3, x: 0.35, y: y + R0 * 0.62, z: -0.04, seg: 12, rough: 0.12, smooth: true, sink: 0.3, ramp: MOSS });
  rock(api, g, { r: 0.5, sx: 1, sy: 0.2, sz: 0.4, x: -1.2, y: y + R1 * 0.75, z: 0.0, seg: 10, rough: 0.12, smooth: true, sink: 0.3, ramp: MOSS, lift: -0.05 });
  // red-capped mushrooms in the log's shadow side (front-right)
  [[0.6, 0.62, 0.13], [0.85, 0.72, 0.1], [0.45, 0.8, 0.08]].forEach(([x, z, r]) => {
    g.add(api.cylinder({ r: r * 0.32, h: r * 1.4, x, y: r * 0.7, z, ramp: STEM, seg: 7 }));
    g.add(api.dome({ r, h: r * 0.75, x, y: r * 1.35, z, ramp: CAP, seg: 12 }));
  });
  // ferns at the root end
  scrub(api, g, { x: 2.3, z: -0.45, r: 0.48, h: 0.55, ramp: FERN });
  scrub(api, g, { x: 2.05, z: 0.55, r: 0.36, h: 0.4, ramp: FERN });
  // one outline for the trunk
  api.proxy(api.cylinderGeo({ rb: R0 * 1.02, rt: R1 * 1.02, h: L, rz: Math.PI / 2, seg: 16 }), log);
  return g;
}
