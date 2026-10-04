// Crag: a rock outcrop breaking out of the hillside. A tall, faceted limestone mass with a sheer face, two
// shouldering masses stepping down beside it, a fallen slab and scree at the foot, scrub in the cracks and a
// wind-bent umbrella pine holding on at its side. Few big angular shapes, crisp facets: from above, lit
// top planes and a long shadow; up close, a real crag.
export const meta = {
  id: 'crag', name: 'Crag', aliases: ['crags', 'rock outcrop', 'outcrop', 'rocky outcrop', 'tor', 'big rock', 'kayalık', 'sarp kaya', 'yalçın kaya'],
  category: 'nature', stage: 'camp', footprint: { w: 7, d: 6 }, height: 4.5, desc: 'a tall faceted limestone outcrop with shouldering masses, scree, scrub and a clinging pine'
};

const STONE = ['#3e3a35', '#5c564d', '#7d7466', '#9a8f7d', '#b0a590'];
const STONE_WARM = ['#4a3d31', '#695847', '#8b7760', '#a69179', '#baa58b'];
const SCRUB = ['#28351f', '#3e4f2f', '#586b40', '#728550', '#899a60'];
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
  const tone = () => api.pick([STONE, STONE, STONE_WARM]);
  // the main mass: tall, faceted, a little narrower at the top; then two shoulders and a low front ledge
  rock(api, g, { r: 1.75, sx: 1.0, sy: 1.75, sz: 0.85, x: 0.2, z: -0.7, seg: 7, rough: 0.26, rot: api.range(0, 6.28), ramp: tone(), lift: -0.02 });
  rock(api, g, { r: 1.45, sx: 1.1, sy: 1.0, sz: 0.9, x: -1.65, z: -0.2, seg: 6, rough: 0.24, rot: api.range(0, 6.28), ramp: tone() });
  rock(api, g, { r: 1.2, sx: 1.05, sy: 0.95, sz: 0.95, x: 1.95, z: 0.1, seg: 6, rough: 0.24, rot: api.range(0, 6.28), ramp: tone(), lift: -0.03 });
  rock(api, g, { r: 1.05, sx: 1.5, sy: 0.55, sz: 0.85, x: -0.2, z: 1.15, seg: 7, rough: 0.2, rot: api.range(-0.3, 0.3), ramp: tone(), lift: 0.03 });
  // a fallen slab tipped against the shoulder
  rock(api, g, { r: 0.8, sx: 1.4, sy: 0.38, sz: 0.9, x: -2.6, z: 1.15, seg: 6, rough: 0.2, tilt: 0.22, rot: api.range(0, 6.28), ramp: tone() });
  // scree at the foot, mostly in front
  for (let i = 0; i < 7; i++) {
    const a = api.range(0.15, 3.0), d = api.range(2.6, 3.1);
    rock(api, g, { r: api.range(0.16, 0.36), sx: api.range(0.9, 1.4), sy: api.range(0.5, 0.8), x: Math.cos(a) * d * 1.1, z: Math.sin(a) * d * 0.72 + 0.35, seg: 6, rot: api.range(0, 6.28), ramp: tone() });
  }
  // a wind-bent pine at the crag's side, leaning out over the drop; scrub in the cracks and at the base
  g.add(api.pine({ h: 3.6, r: 1.45, lean: 0.9, leanTo: [1, -0.3], x: 2.55, z: -1.35 }));
  scrub(api, g, { r: 0.55, h: 0.55, x: 1.05, z: 1.4 });
  scrub(api, g, { r: 0.45, h: 0.48, x: -2.9, z: -0.9 });
  scrub(api, g, { r: 0.4, h: 0.42, x: -0.95, y: 0.9, z: 0.55 });
  return g;
}
