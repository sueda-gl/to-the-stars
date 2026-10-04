// Boulders: a cluster of weathered grey-limestone boulders, one big rounded mass with two companions leaning
// on it and a few loose stones, a lichen-ochre cap on the biggest, a tuft of scrub tucked into the lee.
// Few big faceted shapes: from the bird's-eye they read as lit tops with long shadows; up close as real stone.
export const meta = {
  id: 'boulders', name: 'Boulders', aliases: ['boulder', 'rocks', 'rock pile', 'big rocks', 'kaya', 'kayalar', 'taşlar'],
  category: 'nature', stage: 'camp', footprint: { w: 4.5, d: 3.5 }, desc: 'a cluster of weathered limestone boulders with scrub in the lee'
};

const STONE = ['#3f3a35', '#5c554c', '#7a7164', '#968b7a', '#aca08b'];
const STONE_WARM = ['#4a3c2f', '#695644', '#8a745c', '#a48d71', '#b8a184'];
const SCRUB = ['#2b3820', '#425431', '#5e7243', '#7b8f55', '#94a566'];
const SCRUB2 = ['#2e3a2a', '#47573f', '#647857', '#81946f', '#9aab84'];
const LICHEN = ['#4f4a2c', '#6e683e', '#8e8752', '#a9a166', '#bbb377'];

// a faceted boulder: a low-poly sphere pushed out of round by smooth noise, flat underneath, flat-shaded facets
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
  geo.translate(o.x || 0, o.y || 0, o.z || 0);
  const m = api.mesh(geo, o.ramp || STONE, { speck: o.speck ?? 0.24, lift: o.lift || 0 });
  geo.computeBoundingBox(); m.userData.top = geo.boundingBox.max.y;
  g.add(m); return m;
}
// a scrub mound: a round, softly lumpy bush (smooth-shaded, one outline), never a flat pad
function scrub(api, g, { x = 0, z = 0, r = 0.5, h = r * 0.85, ramp }) {
  rock(api, g, { r, sx: 1, sy: h / r, sz: 1, x, z, seg: 12, rough: 0.12, sink: 0.05, smooth: true, rot: api.range(0, 6.28), ramp, speck: 0.3 });
}

export function build(api) {
  const g = api.group();
  const tone = () => api.pick([STONE, STONE, STONE_WARM]);
  // the big one, a leaning companion on its shaded side and a low flat one in front
  const big = rock(api, g, { r: 1.25, sx: 1.15, sy: 0.85, sz: 0.95, x: -0.3, z: -0.2, rot: api.range(0, 6.28), ramp: tone() });
  rock(api, g, { r: 0.85, sx: 1.0, sy: 0.95, sz: 0.85, x: 1.15, z: 0.25, rot: api.range(0, 6.28), tilt: -0.18, ramp: tone(), lift: -0.04 });
  rock(api, g, { r: 0.7, sx: 1.3, sy: 0.55, sz: 0.9, x: -0.45, z: 1.2, rot: api.range(0, 6.28), ramp: tone(), lift: 0.03 });
  // a lichen cap on the big boulder's sunlit crown
  rock(api, g, { r: 0.62, sx: 1.1, sy: 0.3, sz: 0.9, x: -0.45, y: big.userData.top - 0.32, z: -0.3, rot: api.range(0, 6.28), ramp: LICHEN, rough: 0.1, sink: 0, lift: -0.04 });
  // loose stones
  const loose = [[1.75, -0.85, 0.32], [-1.75, 0.55, 0.28], [0.75, 1.35, 0.22], [-1.6, -0.9, 0.36]];
  for (let i = 0; i < loose.length; i++) {
    const [x, z, r] = loose[i];
    rock(api, g, { r: r * api.range(0.85, 1.15), sx: api.range(0.9, 1.3), sy: api.range(0.5, 0.75), x, z, rot: api.range(0, 6.28), seg: 6, ramp: tone() });
  }
  // scrub in the lee of the stones
  scrub(api, g, { r: 0.55, h: 0.55, x: 0.55, z: -1.2, ramp: SCRUB });
  scrub(api, g, { r: 0.38, h: 0.36, x: 1.75, z: -0.3, ramp: SCRUB2 });
  return g;
}
