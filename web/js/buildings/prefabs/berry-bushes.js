// Berry bushes: three round, dark-leaved bramble bushes heavy with fruit (red currants on one, blackberries on
// the others: chunky berries on the sunlit tops, never confetti), and a wicker basket half full on the ground
// in front. Round volumes with one outline each, so from above they read as three lit domes and a basket.
export const meta = {
  id: 'berry-bushes', name: 'Berry bushes', aliases: ['berry bush', 'berries', 'bramble', 'brambles', 'blackberries', 'currants', 'fruit bushes', 'böğürtlen', 'meyve çalısı', 'dut çalısı'],
  category: 'nature', stage: 'camp', footprint: { w: 4, d: 3 }, height: 1.4, desc: 'three round bramble bushes heavy with red and dark berries, a basket in front'
};

const LEAF = ['#1f2c1c', '#34472c', '#4d633d', '#6a7f4f', '#829660'];
const LEAF2 = ['#23301d', '#3a4c2b', '#566a3a', '#728649', '#899c58'];
const RED = ['#5a1012', '#8e1d1e', '#c1302a', '#dc4a36', '#ec6a4a'];
const DARK = ['#1c1428', '#2d1f3e', '#43305a', '#5a4573', '#6f5a88'];
const SCRUB = LEAF;
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
  const R = api.ramps, g = api.group();
  const bushes = [[-1.1, -0.3, 0.72, RED], [0.55, -0.5, 0.64, DARK], [1.3, 0.55, 0.5, DARK]];
  bushes.forEach(([x, z, r, berry], k) => {
    const leaf = k % 2 ? LEAF2 : LEAF;
    // the bush: a main dome with two lower side lobes, so the outline scallops like a bramble, not a boulder
    const main = scrub(api, g, { x, z, r, h: r * 1.15, ramp: leaf });
    const a0 = api.range(0, 6.28);
    for (let i = 0; i < 2; i++) {
      const a = a0 + i * 2.4;
      scrub(api, g, { x: x + Math.cos(a) * r * 0.62, z: z + Math.sin(a) * r * 0.55, r: r * 0.62, h: r * 0.72, ramp: leaf });
    }
    const top = main.userData.top;
    // berries in bunches of three on the lit upper half (toward the upper-left light and the front)
    const n = 6 + Math.round(r * 6);
    for (let i = 0; i < n; i++) {
      const a = api.range(-2.6, 1.9), ph = api.range(0.25, 1.05);
      const bx = x + Math.cos(a) * Math.sin(ph) * r * 0.98, bz = z + Math.sin(a) * Math.sin(ph) * r * 0.98;
      const by = top * (0.42 + 0.58 * Math.cos(ph));
      for (let j = 0; j < 3; j++) {   // colour only: berries are paint, not pencil
        const b = api.sphere({ r: 0.075, seg: 7, x: bx + (j - 1) * 0.08, y: by - (j % 2) * 0.06, z: bz + (j % 2) * 0.05, ramp: berry, lift: 0.04, speck: 0.06 });
        api.colourOnly(b); g.add(b);
      }
    }
  });
  // a wicker basket in front, half full of berries
  g.add(api.cylinder({ rb: 0.24, rt: 0.3, h: 0.32, x: -0.35, y: 0.16, z: 0.95, ramp: R.WOOD, lift: 0.08, seg: 14 }));
  g.add(api.torus({ r: 0.3, tube: 0.035, x: -0.35, y: 0.32, z: 0.95, ramp: R.WOOD, seg: 16 }));
  g.add(api.sphere({ r: 0.26, sy: 0.35, x: -0.35, y: 0.3, z: 0.95, ramp: RED, seg: 12 }));
  g.add(api.tube({ points: [[-0.62, 0.32, 0.95], [-0.5, 0.62, 0.95], [-0.2, 0.62, 0.95], [-0.08, 0.32, 0.95]], r: 0.025, ramp: R.WOOD }));
  return g;
}
