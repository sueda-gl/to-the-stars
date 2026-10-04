// Copse: a small natural wood of mixed trees, every one picked at random from the painter's kinds (round oaks,
// silver olives, domed umbrella pines, dark cypress spindles, the odd lemon or orange), the big crowns placed
// first with room between them, taller toward the middle, and scrub where the wood meets the open ground.
// Each variant is a different wood.
export const meta = {
  id: 'copse', name: 'Copse', aliases: ['wood', 'woods', 'thicket', 'small forest', 'trees', 'clump of trees', 'stand of trees', 'spinney', 'koru', 'koruluk', 'ağaçlık'],
  category: 'nature', stage: 'camp', footprint: { w: 10, d: 9 }, height: 6, desc: 'a small wood of randomly mixed trees: oaks, olives, umbrella pines, cypresses, a fruit tree'
};

const SCRUB = ['#28351f', '#3e4f2f', '#586b40', '#728550', '#899a60'];
const SCRUB2 = ['#2e3a2a', '#47573f', '#647857', '#81946f', '#9aab84'];
const STONE = SCRUB;
// triangles in a built part. Trees differ a lot in cost (the kit's cypress is ~29k, a round tree ~3.7k), so the
// object counts as it plants and stays well inside the 120k budget whatever tree module is wired in.
function trisOf(o) {
  let t = 0;
  o.traverse(m => { if (m.isMesh && m.geometry && m.geometry.attributes.position) { const q = m.geometry, n = (q.index ? q.index.count : q.attributes.position.count) / 3; t += m.isInstancedMesh ? n * m.count : n; } });
  return t;
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

// one tree of `kind`, h metres tall, at (x, z)
function plant(api, kind, h, x, z) {
  if (kind === 'cypress') return api.cypress({ h, x, z });
  if (kind === 'pine') return api.pine({ h, lean: api.range(0.3, 0.7), x, z });
  if (kind === 'olive') return api.tree({ kind: 'olive', h, lean: api.range(0.3, 0.55), x, z, rot: api.range(0, 6.28) });
  return api.tree({ kind, h, x, z, rot: api.range(0, 6.28) });
}

export function build(api) {
  const g = api.group();
  const fruit = api.pick(['lemon', 'orange']);
  const kinds = ['oak', 'oak', 'olive', 'olive', 'olive', 'pine', 'pine', 'cypress', 'cypress', fruit];
  const size = { oak: [3.9, 5.0], olive: [2.6, 3.4], pine: [4.8, 6.2], cypress: [4.4, 6.0], lemon: [2.1, 2.6], orange: [2.2, 2.7] };
  const reach = { oak: 0.4, olive: 0.4, pine: 0.42, cypress: 0.14, lemon: 0.36, orange: 0.36 };   // crown radius / height
  // pick the trees, biggest crowns first
  const n = Math.round(api.range(7, 9)), list = [];
  for (let i = 0; i < n; i++) { const k = api.pick(kinds), h = api.range(size[k][0], size[k][1]); list.push({ k, h, r: h * reach[k] }); }
  list.sort((a, b) => b.r - a.r);
  // place each at the best of 30 tries: inside a soft ellipse, crowns just touching at most; taller in the middle
  const placed = [];
  list.forEach(t => {
    let best = null, score = -Infinity;
    for (let i = 0; i < 30; i++) {
      const a = api.range(0, 6.28), d = Math.sqrt(api.rand()), x = Math.cos(a) * d * 3.7, z = Math.sin(a) * d * 3.2;
      let gap = 9; placed.forEach(p => { gap = Math.min(gap, Math.hypot(x - p.x, z - p.z) - (p.r + t.r) * 0.85); });
      const s = Math.min(gap, 0.6) - d * 0.4;
      if (s > score) { score = s; best = { x, z, d }; }
    }
    placed.push(Object.assign(t, best));
  });
  // plant, counting triangles: a costly kind that would break the budget is swapped for an olive
  let used = 0; const cost = { cypress: 30000 };
  placed.forEach(t => {
    let k = t.k, h = t.h * (1.08 - t.d * 0.2);
    if (used + (cost[k] || 6000) > 95000) { k = 'olive'; h = api.range(2.6, 3.2); }
    const tree = plant(api, k, h, t.x, t.z), c = trisOf(tree);
    cost[k] = c; used += c; g.add(tree);
  });
  // scrub where the wood meets the open ground
  for (let i = 0; i < 4; i++) {
    const a = i / 4 * Math.PI * 2 + api.range(-0.5, 0.5);
    scrub(api, g, { x: Math.cos(a) * 4.1, z: Math.sin(a) * 3.6, r: api.range(0.42, 0.62), h: api.range(0.45, 0.65), ramp: api.pick([SCRUB, SCRUB2]) });
  }
  return g;
}
