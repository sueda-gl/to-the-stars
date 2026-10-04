// The seaside dressing (ART_DIRECTION §21, Sueda 08:30: "the same seaside view exactly how it was, also add trees and
// green spots"). The old map stays exactly as it was (cream plain, wide teal sea, sea stacks, the lake, the woods);
// this only PLANS what is added on top of it:
//   - trees: the approved painted trees (buildings/trees.js through the build api: olive, oak, pine, cypress, lemon,
//     orange, mixed at random) as composed copses and lone trees round the plain, on the lake's shore, along the
//     coast and at the edges. Never in the buildable centre. scenery.js draws them (instanced, one pencil proxy per
//     crown, like trees.js); the ones inside our plot are ordinary plot trees (nav obstacles, cleared by a new site).
//   - green spots: soft painted meadow patches on the cream plain and near water (ground.js paints them from a mask
//     with brushy edges). Cream with colour (mb 1), never a green flood.
// Everything is seeded and depends only on the landform, the plot and the sim's lake, so every load is the same map.

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// copse themes: weights per tree kind (the build api's kinds)
const MIX = {
  grove: { olive: 3, cypress: 0.7, oak: 0.6, lemon: 0.35, orange: 0.35 },          // an olive grove with a cypress or two
  coast: { pine: 3.2, olive: 0.6, cypress: 0.3 },                                   // umbrella pines behind the beach
  mixed: { pine: 1.6, olive: 1.6, cypress: 1.1, oak: 1.2, lemon: 0.3, orange: 0.3 }, // trees.js RANDOM_MIX-ish
  shore: { olive: 1.6, cypress: 1.4, oak: 0.8, pine: 0.6 },                         // the lake's shore
  oaks: { oak: 2.4, olive: 0.8, pine: 0.6 }
};
// the instance scale per kind: landscape trees, a little larger than the prefab scale (trees.js defaults:
// olive 2.7 m, oak 4.6, lemon 2.1, orange 2.3, pine 6, cypress 5)
const SCALE = { olive: [1.45, 1.85], oak: [1.15, 1.45], pine: [1.15, 1.4], cypress: [1.35, 1.7], lemon: [1.5, 1.8], orange: [1.45, 1.75] };
const CROWN = { olive: 1.05, oak: 1.75, pine: 2.4, cypress: 0.7, lemon: 0.72, orange: 0.8 };   // crown radius at s = 1

// the composed copses, relative to our plot P (x0 -30 .. x1 30, z0 -26 (the beach) .. z1 30) and the lake.
// [x, z, radius, count, theme]
function copsePlan(P) {
  const cx = (P.x0 + P.x1) / 2, W = P.x1 - P.x0, D = P.z1 - P.z0;
  const X = f => cx + W * f, Z = f => P.z0 + D * f;   // fractions of the plot
  return [
    // along the coast behind the beach: umbrella pines, a few and well apart (the sea must stay wide)
    [X(0.36), Z(0.07), 3.5, 2, 'coast'], [X(0.55), Z(0.1), 3, 1, 'coast'], [X(-0.38), Z(0.08), 3, 1, 'coast'],
    [X(0.83), Z(0.06), 5, 3, 'coast'], [X(0.08), Z(0.07), 2, 1, 'coast'],
    // the plot's own corners and edges (never the middle)
    [X(-0.44), Z(0.94), 4.5, 4, 'grove'], [X(0.44), Z(0.93), 4.5, 4, 'grove'], [X(0.46), Z(0.18), 3, 2, 'mixed'],
    [X(-0.47), Z(0.74), 3, 2, 'grove'], [X(0.47), Z(0.72), 3, 2, 'oaks'],
    // the plain beyond the plot: west (toward the river), south, east (toward the woods)
    [X(-0.68), Z(0.38), 6.5, 7, 'mixed'], [X(-0.66), Z(0.78), 6, 6, 'grove'], [X(-0.72), Z(1.1), 6, 5, 'oaks'],
    [X(-0.32), Z(1.14), 6.5, 6, 'grove'], [X(-0.13), Z(1.26), 5, 4, 'mixed'], [X(0.36), Z(1.12), 6, 6, 'grove'],
    [X(0.62), Z(0.6), 5, 5, 'mixed'], [X(0.64), Z(0.26), 4.5, 4, 'oaks'], [X(0.66), Z(0.98), 5, 4, 'grove'],
    // the east headland's plain
    [X(0.9), Z(0.2), 5, 4, 'mixed']
  ];
}

// the meadow patches: [x, z, radius] in plot fractions (+ the lake's own, added by the planner)
function meadowPlan(P) {
  const cx = (P.x0 + P.x1) / 2, W = P.x1 - P.x0, D = P.z1 - P.z0;
  const X = f => cx + W * f, Z = f => P.z0 + D * f;
  return [
    [X(-0.66), Z(0.42), 11], [X(-0.64), Z(0.8), 9], [X(-0.75), Z(0.12), 7],   // the plain by the river
    [X(-0.36), Z(1.08), 8.5], [X(-0.1), Z(1.24), 6.5], [X(0.4), Z(1.1), 7.5],   // south of the plot
    [X(0.62), Z(0.6), 9], [X(0.64), Z(0.95), 7], [X(0.88), Z(0.2), 9],          // east, toward the woods / headland
    [X(-0.44), Z(0.92), 6.5], [X(0.43), Z(0.9), 6.5],                          // the plot's back corners
    [X(0.47), Z(0.36), 5], [X(-0.47), Z(0.6), 4.5],                            // the plot's side edges
    [X(-0.56), Z(0.06), 5], [X(0.58), Z(0.08), 4.5]                            // the coast's ends
  ];
}

export function planDressing(geo, ground, st, { seed = 2141, lakePoly = null, woods = null, treesOn = true, meadowsOn = true } = {}) {
  const P = st.plot;
  const rnd = mulberry(seed);
  const R = (a, b) => a + (b - a) * rnd();
  const pick = mix => { const ks = Object.keys(mix), tot = ks.reduce((a, k) => a + mix[k], 0); let x = rnd() * tot; for (const k of ks) { x -= mix[k]; if (x <= 0) return k; } return ks[ks.length - 1]; };
  const lake = lakePoly && lakePoly.length > 2 ? lakePoly : null;
  const lakeC = lake ? lake.reduce((a, [x, z]) => [a[0] + x / lake.length, a[1] + z / lake.length], [0, 0]) : null;
  const lakeD = (x, z) => (lake ? distToPoly(x, z, lake) * (pointInPoly(x, z, lake) ? -1 : 1) : 1e9);
  const spawn = st.spawn || st.centre;
  // the buildable centre: an ellipse over the middle of the plot (the town grows here; no tree ever stands in it)
  const KC = { x: (P.x0 + P.x1) / 2 + 1, z: (P.z0 + P.z1) / 2 + 2, rx: (P.x1 - P.x0) * 0.37, rz: (P.z1 - P.z0) * 0.36 };
  const inCentre = (x, z) => ((x - KC.x) / KC.rx) ** 2 + ((z - KC.z) / KC.rz) ** 2 < 1;
  const inRim = (x, z) => ((x - KC.x) / (KC.rx * 1.2)) ** 2 + ((z - KC.z) / (KC.rz * 1.22)) ** 2 < 1;
  const tracks = ground.tracks || [];
  const nearTrack = (x, z, d) => tracks.some(([ax, az, bx, bz]) => segDist(x, z, ax, az, bx, bz) < d);
  // the woods' trunks, binned (no painted tree inside the old woods)
  const cell = 4, wood = new Map();
  if (woods) for (const v of woods) for (const t of v.list) { const k = Math.floor(t.x / cell) * 4099 + Math.floor(t.z / cell); wood.set(k, (wood.get(k) || 0) + 1); }
  const inWoods = (x, z) => { for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) { const k = (Math.floor(x / cell) + i) * 4099 + Math.floor(z / cell) + j; if (wood.get(k)) { /* near a trunk */ if (Math.abs(i) + Math.abs(j) <= 1) return true; } } return false; };
  const nations = (geo.places && geo.places.nations) || [];
  const slopeAt = (x, z) => { const e = 1.2; return Math.hypot(ground.groundY(x + e, z) - ground.groundY(x - e, z), ground.groundY(x, z + e) - ground.groundY(x, z - e)) / (2 * e); };
  const riverD = (x, z) => (geo.riverDist ? geo.riverDist(x, z).d : 1e9);
  // can a tree stand here?
  function treeOk(x, z, r) {
    if (ground.shoreS(x, z) < 2.6 + r * 0.4) return false;          // off the beach's wet edge and the cliffs' lip
    const y = ground.groundY(x, z);
    if (y < 0.25) return false;                                      // the river banks, the lake
    if (riverD(x, z) < 5 + r) return false;
    if (slopeAt(x, z) > 0.5) return false;
    if (lakeD(x, z) < 2.2 + r * 0.5) return false;
    if (inCentre(x, z)) return false;
    if (Math.hypot(x - spawn.x, z - spawn.z) < 9) return false;
    if (nearTrack(x, z, 1.4 + r * 0.5)) return false;
    if (inWoods(x, z)) return false;
    for (const n of nations) if (Math.hypot(x - n.x, z - n.z) < (n.r || 15) + 6) return false;
    // inside the plot: only its rim and corners (the wide ellipse), and a walkable edge (nav margin) clear of trunks
    if (geo.inPlot(x, z) && (inRim(x, z) || x < P.x0 + 1.6 || x > P.x1 - 1.6 || z > P.z1 - 1.6)) return false;
    return true;
  }
  const trees = [];
  const spaced = (x, z, r) => trees.every(t => Math.hypot(t.x - x, t.z - z) > (t.r + r) * 0.82 + 0.6);
  function add(x, z, kind, theme) {
    const [s0, s1] = SCALE[kind] || [1, 1.3], s = R(s0, s1), r = (CROWN[kind] || 1) * s;
    if (!treeOk(x, z, r) || !spaced(x, z, r)) return false;
    trees.push({ x, z, kind, s, r, rot: R(-0.3, 0.3), theme, inPlot: geo.inPlot(x, z) });
    return true;
  }
  const stats = [];
  if (treesOn) {
    // 1. the composed copses
    for (const [cx, cz, rad, n, theme] of copsePlan(P)) {
      let got = 0;
      const want = Math.round(n * 1.3);
      for (let k = 0; k < want * 14 && got < want; k++) {
        const a = rnd() * Math.PI * 2, d = rad * Math.sqrt(rnd()) * (got === 0 ? 0.3 : 1);
        if (add(cx + Math.cos(a) * d, cz + Math.sin(a) * d * 0.85, pick(MIX[theme]), theme)) got++;
      }
      stats.push([Math.round(cx), Math.round(cz), theme, got + '/' + want]);
    }
    // 2. the lake's shore: a few trees on the far (sea) and outer sides, with gaps so the water reads
    if (lake) {
      const outward = [lakeC[0] - (P.x0 + P.x1) / 2, lakeC[1] - (P.z0 + P.z1) / 2]; const ol = Math.hypot(...outward) || 1;
      const ux = outward[0] / ol, uz = outward[1] / ol;
      let got = 0;
      for (let k = 0; k < 120 && got < 7; k++) {
        const [px, pz] = lake[Math.floor(rnd() * lake.length)];
        const nx = px - lakeC[0], nz = pz - lakeC[1], nl = Math.hypot(nx, nz) || 1;
        // the outer half of the shore (away from the plot's middle) and its seaward side
        if ((nx * ux + nz * uz) / nl < -0.15 && nz / nl > -0.3) continue;
        const d = R(3.2, 6.5), x = px + nx / nl * d, z = pz + nz / nl * d;
        const kind = pick(MIX.shore);
        const [s0, s1] = SCALE[kind], s = R(s0, s1), r = CROWN[kind] * s;
        // the shore may reach into the centre's ellipse: it's the lake's, nothing is built there
        if (ground.shoreS(x, z) < 2.6 || lakeD(x, z) < 2.4 + r * 0.6 || Math.hypot(x - spawn.x, z - spawn.z) < 9 || !spaced(x, z, r) || nearTrack(x, z, 1.4 + r * 0.5)) continue;
        if (!geo.inPlot(x, z) && !treeOk(x, z, r)) continue;
        trees.push({ x, z, kind, s, r, rot: R(-0.3, 0.3), theme: 'shore', inPlot: geo.inPlot(x, z), shore: true });
        got++;
      }
    }
    // 3. lone trees scattered over the plain round the plot (a Poisson-ish dart throw, sparse)
    let lone = 0;
    for (let k = 0; k < 1400 && lone < 38; k++) {
      const x = R(P.x0 - 34, P.x1 + 34), z = R(P.z0 - 4, P.z1 + 40);
      const dp = geo.distOutsidePlot(x, z);
      if (dp < 0.01 && rnd() < 0.7) continue;          // mostly outside the plot
      if (dp > 30) continue;
      if (trees.some(t => Math.hypot(t.x - x, t.z - z) < 11)) continue;   // lone: away from the copses
      if (add(x, z, pick(MIX.mixed), 'lone')) lone++;
    }
  }

  // ---------- the meadows ----------
  const meadows = [];
  if (meadowsOn) {
    for (const [x, z, r] of meadowPlan(P)) meadows.push({ x, z, r: r * 0.85, seed: rnd() * 100 });
    if (lake) {   // a green shore round the lake's outer side, and a little on the near side
      meadows.push({ x: lakeC[0] - 2, z: lakeC[1] - 3, r: 9.5, seed: rnd() * 100 });
      meadows.push({ x: lakeC[0] + 6, z: lakeC[1] + 4.5, r: 5, seed: rnd() * 100 });
    }
    // under most copses a little grass
    for (const t of trees) if (t.theme !== 'coast' && rnd() < 0.12) meadows.push({ x: t.x + R(-2, 2), z: t.z + R(-2, 2), r: R(2.5, 4.2), seed: rnd() * 100 });
  }
  return { trees, meadows, centre: KC, inCentre, stats };
}

// the meadow mask: a DataTexture over the region (R = 0..1 field; the ground shader thresholds it with brushy noise).
// Each patch is a lumpy cluster of 3-4 ellipses; the field fades out toward the beach, the water, steep slopes and
// the woods (the woods' land has its own colour).
export function meadowMask(geo, ground, meadows, { size = 512, half = 140, C = { x: 0, z: 0 }, lakePoly = null } = {}) {
  const data = new Uint8Array(size * size * 4);
  const blobs = [];
  for (const m of meadows) {
    const r = mulberry(Math.floor(m.seed * 1000) + 7);
    const n = 3 + Math.floor(r() * 2);
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2, d = m.r * (i === 0 ? 0 : 0.35 + r() * 0.35);
      const rx = m.r * (i === 0 ? 0.78 : 0.42 + r() * 0.3), rz = rx * (0.6 + r() * 0.5), rot = r() * Math.PI;
      blobs.push({ x: m.x + Math.cos(a) * d, z: m.z + Math.sin(a) * d, rx, rz, c: Math.cos(rot), s: Math.sin(rot), R: Math.max(rx, rz) * 1.6 + 2 });
    }
  }
  const step = half * 2 / size;
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    const x = C.x - half + (i + 0.5) * step, z = C.z - half + (j + 0.5) * step;
    let f = 0;
    for (const b of blobs) {
      const dx = x - b.x, dz = z - b.z;
      if (Math.abs(dx) > b.R || Math.abs(dz) > b.R) continue;
      const u = (dx * b.c - dz * b.s) / b.rx, v = (dx * b.s + dz * b.c) / b.rz;
      f = Math.max(f, 1 - smooth(0.55, 1.45, Math.hypot(u, v)));
    }
    if (f > 0) {
      const s = ground.shoreS(x, z), y = ground.groundY(x, z);
      f *= smooth(1.6, 4.5, s);                     // never on the beach's foam / wet sand
      if (y < 0.1) f = 0;
      if (geo.riverDist) f *= smooth(2.5, 5, geo.riverDist(x, z).d);
      if (lakePoly) { const d = distToPoly(x, z, lakePoly); if (pointInPoly(x, z, lakePoly)) f = 0; else f *= smooth(0.12, 0.7, d); }
    }
    const o = (j * size + i) * 4; data[o] = Math.round(Math.min(1, f) * 255); data[o + 3] = 255;
  }
  const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.needsUpdate = true;
  return { texture: t, box: new THREE.Vector4(C.x - half, C.z - half, half * 2, half * 2) };
}

function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function segDist(x, z, ax, az, bx, bz) { const dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1))); return Math.hypot(ax + dx * t - x, az + dz * t - z); }
function pointInPoly(x, z, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, zi] = poly[i], [xj, zj] = poly[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) inside = !inside; }
  return inside;
}
function distToPoly(x, z, poly) { let b = Infinity; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) b = Math.min(b, segDist(x, z, poly[j][0], poly[j][1], poly[i][0], poly[i][1])); return b; }
