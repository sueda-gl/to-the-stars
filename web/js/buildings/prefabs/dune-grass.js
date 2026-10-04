// Dune grass: a low sand dune swelling in two humps, combed by the wind, with tussocks of marram grass on
// its crest and flanks (stiff blades fanning out, green going to straw) and a few blown sand ripples.
// From above: a pale lit dune with dark tufts and a soft shadow on its lee side.
export const meta = {
  id: 'dune-grass', name: 'Dune grass', aliases: ['dune', 'dunes', 'sand dune', 'marram', 'marram grass', 'beach grass', 'kum tepesi', 'kumul', 'kumsal otu'],
  category: 'nature', stage: 'camp', footprint: { w: 7, d: 4.5 }, height: 1.9, desc: 'a low two-humped sand dune with tussocks of marram grass on its crest'
};

const SAND = ['#8a6c45', '#ab8a5c', '#c8a672', '#d9b985', '#e4c794'];
const BLADE = ['#36421f', '#4f5f2c', '#6c7b3b', '#8a984d', '#a1ac5e'];
const STRAW = ['#5f4f22', '#86702f', '#a98f42', '#c3a957', '#d4bb69'];
const RIPPLE = ['#7a5f3d', '#977852', '#b39265', '#c6a575', '#d1b180'];
const SCRUB = BLADE, STONE = SAND;
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
  // two humps: [x, z, radius, height, stretch]
  const humps = [[-0.9, -0.2, 2.4, 1.05, 1.35], [1.6, 0.35, 1.7, 0.75, 1.25]];
  humps.forEach(([x, z, r, h, sx]) => rock(api, g, { r, sx, sy: h / r, sz: 0.85, x, z, seg: 22, rough: 0.05, smooth: true, sink: 0, ramp: SAND, speck: 0.2, rot: api.range(-0.2, 0.2) }));
  // the sand's surface height at (x, z): the higher of the two ellipsoid caps
  const hAt = (x, z) => Math.max(0, ...humps.map(([hx, hz, r, h, sx]) => { const u = (x - hx) / (r * sx), v = (z - hz) / (r * 0.85), q = 1 - u * u - v * v; return q > 0 ? 0.44 * h + Math.sqrt(q) * h * 0.96 : 0; }));
  // marram tussocks: blades fanning out, mostly on the crest and the lee
  const tufts = [[-1.3, -0.5, 1.25], [-0.3, 0.15, 1.1], [0.55, -0.85, 0.95], [1.8, 0.1, 1.05], [-2.35, 0.35, 0.85], [2.6, 0.85, 0.75], [-1.7, 0.95, 0.8], [0.9, 1.15, 0.7], [-0.6, -1.25, 0.8], [1.35, 0.85, 0.7], [-2.9, -0.5, 0.6]];
  tufts.forEach(([x, z, s]) => {
    const y = hAt(x, z) - 0.08, n = 13, a0 = api.range(0, 6.28);
    for (let i = 0; i < n; i++) {
      const a = a0 + i / n * Math.PI * 2 + api.range(-0.25, 0.25), h = s * api.range(0.95, 1.4), t = api.range(0.2, 0.55);
      const b = api.cone({ r: 0.075, h, seg: 3, x: x + Math.cos(a) * Math.sin(t) * h / 2, y: y + Math.cos(t) * h / 2, z: z + Math.sin(a) * Math.sin(t) * h / 2,
        rz: -Math.cos(a) * t, rx: Math.sin(a) * t, ramp: i % 3 === 0 ? STRAW : BLADE, speck: 0.1, lift: api.range(-0.05, 0.05) });
      api.colourOnly(b); g.add(b);   // grass is paint, not pencil
    }
  });
  // wind ripples combed across the windward (front) slope: low darker ridges laid on the sand, paint only
  for (let k = 0; k < 6; k++) {
    const z0 = 0.35 + k * 0.32, pts = [];
    for (let i = 0; i <= 10; i++) { const x = -3.0 + i * 0.6, z = z0 + 0.12 * Math.sin(i * 0.9 + k), y = hAt(x, z); if (y > 0.2) pts.push([x, y + 0.005, z]); }
    if (pts.length > 2) { const r = api.tube({ points: pts, r: 0.035, seg: 24, ramp: RIPPLE, speck: 0.1 }); api.colourOnly(r); g.add(r); }
  }
  return g;
}
