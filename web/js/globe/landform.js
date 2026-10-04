// The designed landform (2026-10-04, ART_DIRECTION §1 + §8 "not a slab"): ONE terrain height for the gouache map
// and the painted globe. Pure functions, no THREE, no DOM, no rnd stream (hashed noise only), so it never shifts.
// geography.js builds it once (createLandform) and exposes it as reliefAt / heightAt / landField / landWeights.
//
// Map coordinates: x east, z south (north / the sea is -z), 1 unit ~ 1 m, TRUE sea level = 0 (the map lowers its
// waterline to its own sea plane, world/ground.js mapY). The composition, from the bay outward:
//   - our home: a coastal valley (the sim's plot) rising gently inland from a crescent beach, with the sim's lake;
//   - the river: out of the mountains through a narrow GORGE (z ~ 86..114), then meandering across a floodplain at
//     the foot of the west ridge to an estuary in the bay's south-west corner;
//   - ridgelines with articulated spurs (designed spines x a domain-warped ridged multifractal), carved by a
//     hydraulic + thermal erosion pass on a 2 m grid (gullies, fans, talus), valley floors flattened along the river;
//   - the coast: a sandy crescent beach in front of the plot, an estuary, a rocky east point with sea stacks, a
//     small east cove, low cliffs with talus on the headland / island / hill-town coast; land meets water through
//     beaches and rock platforms over a shallow SHELF, never a wall;
//   - the three nations on their own sites: the Drop Riviera on the long west HEADLAND, the Loaf Republic a HILL
//     TOWN above the east coast, the Flit Sky-hold on the ISLAND across the bay; a second, smaller island to the
//     north-west; stacks and islets;
//   - a limestone range at the back (south), snow-free; the mainland continues past it to a far coast round the
//     planet's limb (no ring of sea round a plateau), other continents on the far side.

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
// a soft union of two non-negative heights that is EXACTLY the other one when either is 0 (continuous when a term
// switches off at its edge, unlike a polynomial smooth-max)
const union = (a, b) => { a = Math.max(a, 0); b = Math.max(b, 0); return Math.sqrt(Math.sqrt(a * a * a * a + b * b * b * b)); };
const smax = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.max(a, b) + h * h * k * 0.25; };

// ---------- noise (hashed) ----------
function h2(x, z) { let h = Math.imul(x | 0, 374761393) ^ Math.imul(z | 0, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; }
const fade = t => t * t * t * (t * (t * 6 - 15) + 10);
export function vnoise(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z), fx = x - xi, fz = z - zi, u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  const a = h2(xi, zi), b = h2(xi + 1, zi), c = h2(xi, zi + 1), d = h2(xi + 1, zi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
// gradient noise, ~[-0.7, 0.7]
const GX = new Float32Array(256), GZ = new Float32Array(256);
for (let i = 0; i < 256; i++) { const a = h2(i, 911) * Math.PI * 2; GX[i] = Math.cos(a); GZ[i] = Math.sin(a); }
function grad(ix, iz, fx, fz) { const k = (Math.imul(ix, 1619) ^ Math.imul(iz, 31337) ^ Math.imul(ix * iz | 0, 1013)) & 255; return GX[k] * fx + GZ[k] * fz; }
export function pnoise(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z), fx = x - xi, fz = z - zi, u = fade(fx), v = fade(fz);
  const a = grad(xi, zi, fx, fz), b = grad(xi + 1, zi, fx - 1, fz), c = grad(xi, zi + 1, fx, fz - 1), d = grad(xi + 1, zi + 1, fx - 1, fz - 1);
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}
export function fbm(x, z, o = 4) { let a = 0.5, f = 1, s = 0, n = 0; for (let i = 0; i < o; i++) { s += a * vnoise(x * f + i * 17.1, z * f - i * 9.3); n += a; f *= 2.03; a *= 0.5; } return s / n; }
// Musgrave's ridged multifractal on gradient noise: sharp crests, the small octaves only where a crest already is
function ridged(x, z, o = 5) {
  let sum = 0, f = 1, amp = 1, w = 1, norm = 0;
  for (let i = 0; i < o; i++) {
    let r = 1 - Math.abs(pnoise(x * f + i * 5.31, z * f - i * 3.77) * 1.45);
    r = r * r * w;
    sum += r * amp; norm += amp;
    w = clamp(r * 1.8, 0, 1);
    f *= 2.07; amp *= 0.46;
  }
  return sum / norm;
}

// ---------- polylines ----------
function chaikin(pts, it = 2) {
  let p = pts;
  for (let k = 0; k < it; k++) {
    const out = [p[0]];
    for (let i = 0; i < p.length - 1; i++) { const a = p[i], b = p[i + 1]; out.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]); }
    out.push(p[p.length - 1]); p = out;
  }
  return p;
}
function makeLine(pts, { smoothIt = 2, vals = null } = {}) {
  const P = smoothIt ? chaikin(pts, smoothIt) : pts;
  const n = P.length - 1, ax = new Float64Array(n), az = new Float64Array(n), dx = new Float64Array(n), dz = new Float64Array(n), l2 = new Float64Array(n), cum = new Float64Array(n + 1);
  let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
  for (let i = 0; i < n; i++) {
    ax[i] = P[i][0]; az[i] = P[i][1]; dx[i] = P[i + 1][0] - P[i][0]; dz[i] = P[i + 1][1] - P[i][1]; l2[i] = dx[i] * dx[i] + dz[i] * dz[i] || 1e-9;
    cum[i + 1] = cum[i] + Math.sqrt(l2[i]);
  }
  for (const [x, z] of P) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
  // per-vertex values (e.g. amplitudes) carried along the ORIGINAL control points: interpolate by arc length
  let V = null;
  if (vals) {
    const cl = [0]; for (let i = 1; i < pts.length; i++) cl.push(cl[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    V = t => { const L = t * cl[cl.length - 1]; for (let i = 0; i < cl.length - 1; i++) if (L <= cl[i + 1]) return lerp(vals[i], vals[i + 1], (L - cl[i]) / (cl[i + 1] - cl[i] || 1)); return vals[vals.length - 1]; };
  }
  return { P, n, ax, az, dx, dz, l2, cum, len: cum[n], box: { x0, x1, z0, z1 }, V };
}
// nearest point: { d, t (0..1 by length), px, pz } ; skips quickly when farther than maxD from the box
const NEAR = { d: 0, t: 0, px: 0, pz: 0, i: 0 };
function lineNear(L, x, z, maxD = 1e9) {
  const b = L.box;
  if (x < b.x0 - maxD || x > b.x1 + maxD || z < b.z0 - maxD || z > b.z1 + maxD) { NEAR.d = 1e9; NEAR.t = 0; return NEAR; }
  let best = 1e18, bi = 0, bu = 0;
  for (let i = 0; i < L.n; i++) {
    let u = ((x - L.ax[i]) * L.dx[i] + (z - L.az[i]) * L.dz[i]) / L.l2[i]; u = u < 0 ? 0 : u > 1 ? 1 : u;
    const qx = L.ax[i] + L.dx[i] * u - x, qz = L.az[i] + L.dz[i] * u - z, d2 = qx * qx + qz * qz;
    if (d2 < best) { best = d2; bi = i; bu = u; }
  }
  NEAR.d = Math.sqrt(best); NEAR.i = bi; NEAR.t = (L.cum[bi] + bu * Math.sqrt(L.l2[bi])) / L.len;
  NEAR.px = L.ax[bi] + L.dx[bi] * bu; NEAR.pz = L.az[bi] + L.dz[bi] * bu;
  return NEAR;
}
// the same with a SOFT along-line parameter: t blended over the segments about as near as the nearest one, so
// anything read off t (amplitudes, the gorge, the valley floor) is continuous across the medial axis of a bend
const DS = new Float64Array(4096), TS = new Float64Array(4096);
function lineNearSoft(L, x, z, maxD = 1e9, sigma = 7) {
  const b = L.box;
  if (x < b.x0 - maxD || x > b.x1 + maxD || z < b.z0 - maxD || z > b.z1 + maxD) { NEAR.d = 1e9; NEAR.t = 0; return NEAR; }
  let best = 1e18, bi = 0, bu = 0;
  for (let i = 0; i < L.n; i++) {
    let u = ((x - L.ax[i]) * L.dx[i] + (z - L.az[i]) * L.dz[i]) / L.l2[i]; u = u < 0 ? 0 : u > 1 ? 1 : u;
    const qx = L.ax[i] + L.dx[i] * u - x, qz = L.az[i] + L.dz[i] * u - z, d = Math.sqrt(qx * qx + qz * qz);
    DS[i] = d; TS[i] = (L.cum[i] + u * Math.sqrt(L.l2[i])) / L.len;
    if (d < best) { best = d; bi = i; bu = u; }
  }
  let sw = 0, st = 0, spz = 0;
  for (let i = 0; i < L.n; i++) { const e = (DS[i] - best) / sigma; if (e > 3) continue; const w = Math.exp(-e * e); sw += w; st += w * TS[i]; spz += w * (L.az[i] + L.dz[i] * 0.5); }
  NEAR.d = best; NEAR.i = bi; NEAR.t = st / sw; NEAR.pz = spz / sw; NEAR.px = L.ax[bi] + L.dx[bi] * bu;
  return NEAR;
}
// a north-facing coast (land to the south, +z): ray-cast toward -z, odd crossings = land
function southOf(L, x, z) {
  let c = 0;
  for (let i = 0; i < L.n; i++) {
    const xa = L.ax[i], xb = xa + L.dx[i];
    if ((xa <= x) === (xb <= x)) continue;
    const zc = L.az[i] + L.dz[i] * (x - xa) / L.dx[i];
    if (zc < z) c++;
  }
  return (c & 1) === 1;
}

// ---------- the layout (designed) ----------
// the mainland's north coast, west -> east (land to the south). In front of the plot it follows the sim's sea line
// (state.js: z0-2 .. z0-3.6) as a crescent beach; past it: the estuary (west) and the east point / east cove /
// the hill town's cliffs (east). The far ends run out past the planet's limb (the far boundary cuts them).
export const COAST = [
  [-640, 230], [-330, 84], [-282, 66], [-250, 60], [-226, 44], [-204, 38], [-186, 26], [-168, 23], [-150, 14], [-136, 4], [-120, 1], [-104, -1], [-90, -8],
  [-76, -9], [-66, -13], [-58, -17],
  [-51, -23], [-47, -26.5], [-43.5, -24.5], [-40, -23.5], [-36.5, -25.5], [-33, -28.3],
  [-24, -28.9], [-10, -28.6], [4, -28.5], [18, -28.9], [30, -29.5],
  [33, -29.4], [35.5, -27], [37.5, -24], [40.5, -21.8], [44, -22.2], [46.8, -25], [48.5, -30], [49.8, -36], [51.5, -42], [54, -47.5], [57.5, -48.5], [60.5, -45],
  [65, -40.2], [70, -38.8], [75, -39.6],
  [77.5, -43.5], [76.5, -51], [76, -60], [79.5, -71.5], [90, -83], [107, -92], [118, -95], [126, -104], [128, -114], [138, -119], [152, -122], [166, -134], [184, -142],
  [202, -160], [226, -172], [256, -200], [300, -230], [640, -470]
];
// the west headland (the Drop Riviera): a tapered arm from its base to the tip, swelling round the town
export const HEADLAND = { b: [-56, -18], t: [-124, -63], r0: 13.5, r1: 9.5 };
export const ISLAND = { x: 0, z: -131, rx: 31, rz: 21, rot: 0.12 };          // the Flit Sky-hold's island
export const ISLAND2 = { x: -63, z: -104, rx: 15, rz: 9.5, rot: -0.45 };     // the smaller island, north-west
// sea stacks [x, z, radius, height]
export const STACKS = [[61, -56, 2.8, 4.6], [56.5, -61, 1.9, 3.2], [64.5, -51.5, 1.5, 2.4], [-133, -71, 3.2, 5.6], [-128, -78.5, 2.1, 3.8], [-139.5, -64, 2, 3],
  [-23, -39, 2.3, 3.2], [-17.5, -41.5, 1.5, 2], [25, -40.5, 2, 2.8], [-25, -143, 2.6, 4.4], [34, -118, 2, 3.2], [-76, -98, 1.8, 2.8]];
// islets [x, z, radius]
export const ISLETS = [[42, -152, 5.5], [-98, -128, 6.5], [-160, -92, 8], [132, -146, 8.5], [-32, -186, 5], [80, -196, 7], [-205, -60, 9], [190, -110, 9]];
// sandbars [x, z, rx, rz, angle, strength]
const SHOALS = [[-35, -38, 9, 2.6, -0.5, 0.9], [-6, -36.5, 11, 2.2, 0.08, 0.7], [17, -39, 7, 2, -0.15, 0.6], [6, -114.5, 6, 2.5, 0.3, 0.8]];
// the river, mouth -> source (smoothed into meanders)
export const RIVER_PTS = [[-40, -33], [-41.5, -25], [-47.5, -18], [-50, -9], [-43.5, -2], [-42.5, 7], [-50, 13], [-58.5, 18], [-59, 28], [-50.5, 34], [-46, 43],
  [-50, 52], [-58, 58], [-63, 67], [-59, 77], [-62, 88], [-65.5, 99], [-61.5, 109], [-66, 120], [-74, 130], [-80, 144]];
// designed ridgelines: control points, crest heights (m) and half-widths (m)
const SPINES = [
  { name: 'west', pts: [[-62, -12], [-72, 8], [-83, 30], [-92, 56], [-99, 84]], amp: [10, 18, 15, 24, 30], w: 36 },
  { name: 'head', pts: [[-58, -18], [-78, -30], [-98, -43], [-119, -60]], amp: [6, 8, 9, 6], w: 12 },
  { name: 'east', pts: [[100, -58], [95, -32], [90, -6], [92, 26], [99, 56], [108, 86]], amp: [18, 13, 18, 15, 26, 34], w: 32 },
  { name: 'spur', pts: [[90, -8], [72, -5], [56, -10]], amp: [14, 8, 4], w: 16 },
  { name: 'back', pts: [[-36, 66], [-12, 74], [14, 69], [40, 76], [70, 68]], amp: [8, 13, 10, 14, 17], w: 24 },
  { name: 'island', pts: [[-20, -133], [-4, -136], [14, -131], [24, -126]], amp: [10, 16, 13, 8], w: 13 }
];
// the limestone range at the back: a main crest, spurs off it come from the articulation
const RANGE = { pts: [[-260, 160], [-196, 140], [-140, 128], [-100, 122], [-52, 136], [-8, 128], [40, 134], [92, 124], [150, 132], [210, 150], [270, 176]],
  amp: [44, 52, 58, 64, 56, 66, 60, 68, 58, 50, 40], w: 62 };
// the hinterland uplands: low hills everywhere off our valley, the floodplain and the coast
const VALLEY_AXIS = [[0, -28], [0, 10], [-6, 40], [-20, 62]];
// a uniform grid over a long polyline: each cell lists the segments that can be nearer than maxD to any point in it
function lineGrid(L, cell, maxD) {
  const x0 = L.box.x0 - maxD, z0 = L.box.z0 - maxD, nx = Math.ceil((L.box.x1 + maxD - x0) / cell) + 1, nz = Math.ceil((L.box.z1 + maxD - z0) / cell) + 1;
  const cells = new Array(nx * nz), r = maxD + cell * 0.7072;
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const cx = x0 + (i + 0.5) * cell, cz = z0 + (j + 0.5) * cell, list = [];
    for (let k = 0; k < L.n; k++) {
      let u = ((cx - L.ax[k]) * L.dx[k] + (cz - L.az[k]) * L.dz[k]) / L.l2[k]; u = u < 0 ? 0 : u > 1 ? 1 : u;
      if (Math.hypot(L.ax[k] + L.dx[k] * u - cx, L.az[k] + L.dz[k] * u - cz) < r) list.push(k);
    }
    cells[j * nx + i] = list.length ? Int32Array.from(list) : null;
  }
  return { x0, z0, nx, nz, cell, cells, maxD };
}
function gridNearD(L, G, x, z) {
  const i = Math.floor((x - G.x0) / G.cell), j = Math.floor((z - G.z0) / G.cell);
  if (i < 0 || j < 0 || i >= G.nx || j >= G.nz) return G.maxD;
  const list = G.cells[j * G.nx + i]; if (!list) return G.maxD;
  let best = 1e18;
  for (let q = 0; q < list.length; q++) {
    const k = list[q];
    let u = ((x - L.ax[k]) * L.dx[k] + (z - L.az[k]) * L.dz[k]) / L.l2[k]; u = u < 0 ? 0 : u > 1 ? 1 : u;
    const qx = L.ax[k] + L.dx[k] * u - x, qz = L.az[k] + L.dz[k] * u - z, d2 = qx * qx + qz * qz;
    if (d2 < best) best = d2;
  }
  return Math.min(G.maxD, Math.sqrt(best));
}

export function createLandform({ PLOT, C, nations = [], wonder = null, lakeDist = () => 1e9 }) {
  const coastL = makeLine(COAST, { smoothIt: 2 });
  const coastG = lineGrid(coastL, 24, 90);
  const riverL = makeLine(RIVER_PTS, { smoothIt: 3 });
  const spines = SPINES.map(s => ({ ...s, L: makeLine(s.pts, { smoothIt: 2, vals: s.amp }) }));
  const hb = HEADLAND, hdx = hb.t[0] - hb.b[0], hdz = hb.t[1] - hb.b[1], hl2 = hdx * hdx + hdz * hdz;
  const distOutsidePlot = (x, z) => Math.hypot(Math.max(PLOT.x0 - x, 0, x - PLOT.x1), Math.max(PLOT.z0 - z, 0, z - PLOT.z1));
  const inPlotRect = (x, z) => x >= PLOT.x0 && x <= PLOT.x1 && z >= PLOT.z0 && z <= PLOT.z1;
  const flatD = (x, z) => Math.hypot(x - C.x, z - C.z);

  // ---------- the coast: a signed land field (~ m to the coast, + land) ----------
  function headlandField(x, z) {
    let u = ((x - hb.b[0]) * hdx + (z - hb.b[1]) * hdz) / hl2; const uc = clamp(u, 0, 1);
    const d = Math.hypot(hb.b[0] + hdx * uc - x, hb.b[1] + hdz * uc - z);
    const r = lerp(hb.r0, hb.r1, uc) + 5.5 * Math.exp(-(((uc - 0.6) / 0.17) ** 2)) - 3 * Math.exp(-(((uc - 0.3) / 0.08) ** 2));   // a waist, then the town's swell
    return { s: r - d, u };
  }
  function ellipseField(E, x, z) {
    const c = Math.cos(E.rot), s = Math.sin(E.rot), dx = x - E.x, dz = z - E.z, lx = dx * c - dz * s, lz = dx * s + dz * c;
    const q = Math.hypot(lx / E.rx, lz / E.rz);
    return (1 - q) * Math.min(E.rx, E.rz) * (q < 1 ? 1 : (E.rx + E.rz) / (2 * Math.min(E.rx, E.rz)));
  }
  function farBound(x, z) {   // the mainland's far coast round the limb (flat distance ~285..345)
    const a = Math.atan2(z - C.z, x - C.x);
    return 300 + (vnoise(Math.cos(a) * 2.2 + 7, Math.sin(a) * 2.2 - 3) - 0.5) * 70 + (vnoise(Math.cos(a) * 7 + 1, Math.sin(a) * 7) - 0.5) * 18 - flatD(x, z);
  }
  function farField(x, z) {   // other continents on the far side of the planet (noise on the direction)
    const d = flatD(x, z); if (d < 330) return -60;
    const a = Math.atan2(z - C.z, x - C.x), r = d / 534;
    const c = fbm(Math.cos(a) * r * 4.2 + 11.3, Math.sin(a) * r * 4.2 - 2.7, 4) + fbm(x / 70 + 3, z / 70, 3) * 0.25;
    return (c - 0.66) * 220 * smooth(330, 380, d) - 60 * (1 - smooth(330, 380, d));
  }
  const FIELD = { s: 0, main: 0, head: 0, isl: 0, isl2: 0, stack: -1e9, stackH: 0, islet: -1e9 };
  let lfx = NaN, lfz = NaN;
  function fields(x, z) {
    const F = FIELD;
    if (x === lfx && z === lfz) return F;   // the same point again (height then weights): reuse
    lfx = x; lfz = z;
    let main = gridNearD(coastL, coastG, x, z);
    main = southOf(coastL, x, z) ? main : -main;
    main = Math.min(main, farBound(x, z));
    const hf = headlandField(x, z); F.head = hf.s; F.headU = hf.u;
    F.isl = ellipseField(ISLAND, x, z) - 7 * Math.exp(-(((x - 6) / 6.5) ** 2 + ((z + 108) / 6) ** 2));   // a harbour cove on its south side
    F.isl2 = ellipseField(ISLAND2, x, z);
    F.stack = -1e9; F.stackH = 0;
    for (const [cx, cz, r, h] of STACKS) { const dx = x - cx, dz = z - cz; if (dx * dx + dz * dz > (r + 4) * (r + 4)) continue; const a = Math.atan2(dz, dx), v = r * (0.82 + 0.3 * vnoise(Math.cos(a) * 1.6 + cx, Math.sin(a) * 1.6 + cz)) - Math.hypot(dx, dz); if (v > F.stack) { F.stack = v; F.stackH = h; } }
    F.islet = -1e9; for (const [cx, cz, r] of ISLETS) F.islet = Math.max(F.islet, r - Math.hypot(x - cx, z - cz));
    F.main = main;
    let s = smax(main, F.head, 6);
    s = Math.max(s, F.isl, F.isl2, F.islet, farField(x, z));
    // the coast wanders (never along the plot: the sim's sea line is exact there)
    const dp = distOutsidePlot(x, z), wig = smooth(6, 40, dp);
    if (wig > 0) s += ((fbm(x / 30 + 3.7, z / 30 - 1.3, 3) - 0.5) * 8 + pnoise(x / 8.5, z / 8.5) * 2.2) * wig;
    s = Math.max(s, F.stack);
    F.s = s;
    return F;
  }
  function coast(x, z) { return fields(x, z).s; }

  // how rocky a stretch of coast is (0 a sandy beach .. 1 cliffs)
  function segD(x, z, ax, az, bx, bz) { const dx = bx - ax, dz = bz - az; let t = ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz); t = clamp(t, 0, 1); return Math.hypot(ax + dx * t - x, az + dz * t - z); }
  const CLIFF_SPOTS = [   // [x, z, radius, target]
    [54, -47, 15, 1], [86, -66, 26, 0.9], [120, -100, 30, 0.7], [0, -146, 22, 0.95], [-20, -126, 14, 0.8], [24, -128, 14, 0.85], [5, -110, 12, 0.08],
    [-63, -104, 18, 0.7], [-41, -26, 10, 0], [70, -39, 8, 0.05], [-88, -6, 32, 0.22], [-150, 14, 40, 0.35], [43, -23, 7, 0.75]
  ];
  function cliffAt(x, z) {
    let c = 0.32 + (fbm(x / 46 + 3.1, z / 46 - 2.2, 3) - 0.5) * 0.9;
    // the headland: cliffs all round, a little beach in its inner crook
    { const dh = segD(x, z, hb.b[0], hb.b[1], hb.t[0], hb.t[1]); c = lerp(c, 0.95, 1 - smooth(16, 26, dh)); }
    for (const [cx, cz, r, t] of CLIFF_SPOTS) c = lerp(c, t, 1 - smooth(r * 0.55, r, Math.hypot(x - cx, z - cz)));
    // our crescent beach: sand from the estuary to the east point's root
    c = lerp(c, 0, 1 - smooth(10, 18, segD(x, z, -36, -29, 34, -29.5)));
    for (const [cx, cz, r] of STACKS) c = lerp(c, 1, 1 - smooth(r + 1, r + 4, Math.hypot(x - cx, z - cz)));
    return clamp(c, 0, 1);
  }

  // ---------- the river ----------
  // half-width: an estuary at the mouth, narrowing upstream; it rises in the mountains
  const riverWidth = t => lerp(2.3, 1.0, t) * (1 + 1.1 * (1 - smooth(0, 0.07, t))) * (1 - smooth(0.86, 0.99, t));
  const RIV = { d: 1e9, t: 1, w: 0, pz: 0, along: 0 };
  let lrx = NaN, lrz = NaN;
  function riverAt(x, z) {
    if (x === lrx && z === lrz) return RIV;
    lrx = x; lrz = z;
    const n = lineNearSoft(riverL, x, z, 50, 6);
    RIV.d = n.d; RIV.t = n.t; RIV.pz = n.pz; RIV.along = n.t * riverL.len;
    RIV.w = riverWidth(n.t);
    return RIV;
  }
  // the valley: the floor flattened along the river; a floodplain, then the gorge through the range's front
  function riverValley(x, z, h) {
    const r = riverAt(x, z); if (r.d > 46) return h;
    const floor = 0.55 + 0.011 * r.along;
    if (h <= floor) return h;
    const gorge = smooth(72, 94, r.pz) * (1 - smooth(106, 120, r.pz)), up = smooth(110, 124, r.pz);
    const W = lerp(lerp(19, 3.4, gorge), 6, up), S = lerp(lerp(28, 7, gorge), 12, up);
    return floor + (h - floor) * smooth(W, W + S, r.d + pnoise(x / 9, z / 9) * 2.5 * (1 - gorge));
  }
  function riverChannel(x, z, h) {
    const r = riverAt(x, z); if (r.d > r.w + 2 || r.w <= 0.05) return h;
    return Math.min(h, lerp(-1.5, h, smooth(r.w * 0.5, r.w + 1.1, r.d)));
  }

  // ---------- inland relief ----------
  const SITES = [...nations.map(n => ({ id: n.id, x: n.x, z: n.z, r0: n.r || 15, r1: (n.r || 15) + 8, h: 0 })),
    ...(wonder ? [{ id: 'wonder', x: wonder.x, z: wonder.z, r0: 10, r1: 17, h: 3.2, fixed: true }] : [])];
  function spineField(x, z) {
    let A = 0, crest = 0;
    for (const sp of spines) {
      const n = lineNearSoft(sp.L, x, z, sp.w, 9); if (n.d >= sp.w) continue;
      const a = sp.L.V(n.t) * (0.78 + 0.44 * fbm(n.t * sp.L.len / 34 + sp.w, 3.3, 2)), p = 1 - n.d / sp.w;   // saddles and summits along it
      A = union(A, a * p * p * (3 - 2 * p));
      crest = Math.max(crest, smooth(0.55, 1, p) * 0.3);
    }
    return { A, crest };
  }
  const rangeL = makeLine(RANGE.pts, { smoothIt: 2, vals: RANGE.amp });
  const axisL = makeLine(VALLEY_AXIS, { smoothIt: 2 });
  function mountains(x, z) {
    const n = lineNearSoft(rangeL, x, z, RANGE.w * 1.6, 14); if (n.d > RANGE.w * 1.6) return 0;
    const far = 1 - smooth(215, 275, flatD(x, z));
    const p = clamp(1 - n.d / (RANGE.w * 1.6), 0, 1);
    return rangeL.V(n.t) * (0.82 + 0.36 * fbm(x / 47 + 4.1, z / 47 - 1.7, 2)) * Math.pow(p, 1.25) * far;
  }
  // the uplands: rolling hill country away from our valley, the river's floodplain and the shore
  function uplands(x, z, s) {
    const dv = Math.min(lineNear(axisL, x, z, 90).d - 22, lineNear(riverL, x, z, 90).d - 10, distOutsidePlot(x, z) - 6);
    return (9 + 13 * fbm(x / 90 + 2.2, z / 90 - 7.1, 2)) * smooth(10, 70, dv) * smooth(4, 30, s) * (1 - smooth(230, 285, flatD(x, z)));
  }
  // flat-topped land: the headland's mesa, the islands, the east point, the hill town's dome
  function plateaus(x, z, F) {
    let P = 0;
    if (F.head > -2) P = Math.max(P, (6.5 + 2.5 * smooth(0.2, 0.6, F.headU)) * smooth(0, 9, F.head));
    if (F.isl > -2) P = Math.max(P, 7.5 * smooth(0, 7, F.isl));
    if (F.isl2 > -2) P = Math.max(P, 5.5 * smooth(0, 5, F.isl2) + 3.5 * smooth(3, 8, F.isl2));
    if (F.islet > -2) P = Math.max(P, (2.5 + 2 * vnoise(x / 3, z / 3)) * smooth(0, 3, F.islet));
    P = Math.max(P, 4.2 * Math.exp(-(((x - 53) / 11) ** 2 + ((z + 44) / 8) ** 2)));
    P = Math.max(P, 21 * Math.exp(-(((x - 100) / 24) ** 2 + ((z + 57) / 21) ** 2)));
    return P;
  }
  // a domain-warped ridged multifractal: spurs off the crests, valleys between them (0..1)
  function articulation(x, z) {
    const wx = x + (fbm(x / 70 + 1.3, z / 70 + 7.7, 3) - 0.5) * 46, wz = z + (fbm(x / 70 - 6.1, z / 70 + 2.9, 3) - 0.5) * 46;
    return ridged(wx / 78, wz / 78, 5);
  }
  function inland(x, z, s, F, dp) {
    // the lowland: the valley floor and gentle rolling ground, rising away from the plot toward the hills
    let h = 0.75 + 0.012 * Math.min(dp, 60) + (fbm(x / 38 + 9.2, z / 38 - 4.4, 3) - 0.5) * 3.2 * smooth(8, 40, dp);
    h += (fbm(x / 11 + 2.9, z / 11 + 6.3, 2) - 0.5) * 1.1 * smooth(10, 30, dp) * smooth(3, 12, s);   // small swells: they hold through the brush and steer the run-off
    const sp = spineField(x, z), M = mountains(x, z), P = plateaus(x, z, F);
    let A = union(union(sp.A, M), uplands(x, z, s));
    if (A > 0.05) {
      const R = articulation(x, z);
      A *= 0.4 + 0.72 * Math.max(R, sp.crest);
    }
    let top = union(A, P > 0.05 ? P * (0.88 + 0.22 * (articulation(x * 1.7, z * 1.7) - 0.45)) : 0);
    if (F.stack > -1.5) top = Math.max(top, F.stackH * smooth(-0.5, 1.1, F.stack) * (0.92 + 0.16 * vnoise(x * 1.3, z * 1.3)));   // squat pillars, flat tops
    return h + top;
  }
  // our valley: a coastal plain rising gently inland, a low hill and a knoll at the back, swells, a dry valley
  const VALLEY = makeLine([[7, 34], [3, 20], [-3, 6], [-5, -8], [-3, -24]], { smoothIt: 2 });
  const g2 = (x, z, cx, cz, rx, rz) => Math.exp(-(((x - cx) / rx) ** 2 + ((z - cz) / rz) ** 2));
  function plotRelief(x, z) {
    let r = 0.9 + 2.6 * smooth(PLOT.z0 - 2, PLOT.z1 + 12, z);
    r += 3.4 * g2(x, z, 13, 20, 14, 11) + 2.2 * g2(x, z, -20, 19, 10, 9) + 1.3 * g2(x, z, 23, -9, 7, 8) + 0.9 * g2(x, z, -22, -14, 8, 7);
    r += 2.0 * g2(x, z, -17, -22.5, 6.5, 4.5);   // the knoll over the beach (the director's "cliff": a lighthouse goes here)
    const vd = lineNear(VALLEY, x, z, 8).d;
    r -= 1.0 * (1 - smooth(0, 7, vd)) * smooth(PLOT.z0, PLOT.z0 + 12, z);
    r += (fbm(x / 26 + 31.7, z / 26 - 12.2, 2) - 0.5) * 1.1;   // broad, calm swells (no blotches on the plain)
    r = Math.max(0.78, r);
    return lerp(0.78, r, smooth(0.6, 10, lakeDist(x, z)));   // a level bank round the lake (0.78 = the map's lake bank)
  }
  const beach = s => 0.12 + 0.068 * Math.min(s, 10);
  function seaBed(x, z, s, c, F) {
    // depth from a ROUNDED union of the land fields (a plain max creases along the medial axes between islands)
    const big = smax(smax(smax(F.main, F.head, 30), F.isl, 30), F.isl2, 30), smallF = smax(F.islet, F.stack, 10);
    const sm = smax(big, smallF - 6, 18);
    const d = lerp(-s, Math.max(-sm, -s * 0.5), smooth(2, 14, -s));
    const small = lerp(1, 0.28, smooth(-10, 6, smallF - big));
    const W = lerp(18, 6.5, c) * small;
    let dep = 0.22 + 1.25 * smooth(0, W, d) + 4.5 * smooth(W * 0.8, W * 3.2, d) + 9 * smooth(40, 110, d) + 12 * smooth(110, 260, d);
    dep *= 1 + 0.6 * c * smooth(0, 8, d);
    if (c > 0.5) dep = lerp(dep, 0.35, (1 - smooth(1.2, 3.5, d)) * (c - 0.5) * 2);   // a wave-cut rock platform at a cliff's foot
    dep += (fbm(x / 34, z / 34, 2) - 0.5) * 0.9 * smooth(4, 22, d);
    // sandbars off the beach and the estuary: pale shoals under the water
    for (const [cx, cz, rx, rz, a, k] of SHOALS) {
      const dx = x - cx, dz = z - cz, ca = Math.cos(a), sa = Math.sin(a), u = (dx * ca - dz * sa) / rx, v = (dx * sa + dz * ca) / rz, q = u * u + v * v;
      if (q < 1.6) dep = lerp(dep, Math.min(dep, 0.35 + q * 0.6), k * (1 - smooth(0.5, 1.6, q)));
    }
    return -Math.max(0.12, dep);
  }

  // ---------- the height before erosion (true sea level 0, plot included, lake excluded) ----------
  function preHeight(x, z) {
    const F = fields(x, z), s = F.s, c = cliffAt(x, z);
    if (s <= 0) return seaBed(x, z, s, c, F);
    const dp = distOutsidePlot(x, z);
    const hin = inland(x, z, s, F, dp);
    const kW = F.stack >= s - 1e-6 ? 0.6 : lerp(15, 3.6, c);   // a stack stands straight out of the water; cliffs over ~3.6 m
    // no walls: right at the shore the land is at most a low cliff (~2.5 m on a beach coast .. ~7 m on a rocky one);
    // anything higher steps back inland over ~18 m as a steep slope above it (talus, then the hill)
    const cap = F.stack >= s - 1e-6 ? 99 : lerp(2.5, 7, c), hin2 = hin <= cap ? hin : cap + (hin - cap) * smooth(kW * 0.5, kW + 18, s);
    let h = beach(s) + hin2 * smooth(0, kW, s);
    h = riverValley(x, z, h);
    return h;
  }

  // ---------- erosion on a 2 m grid (droplets + thermal), stored as a delta over the analytic height ----------
  const EG = { cell: 2, half: 290, n: 0, x0: 0, z0: 0, delta: null, mask: null };
  EG.n = Math.round(EG.half * 2 / EG.cell) + 1; EG.x0 = C.x - EG.half; EG.z0 = C.z - EG.half;
  function erodibility(x, z, s, dp) {
    let m = smooth(3, 10, s) * smooth(12, 28, dp);
    for (const st of SITES) if (m > 0) m *= smooth(st.r1, st.r1 + 10, Math.hypot(x - st.x, z - st.z));
    return m;
  }
  function buildErosion() {
    const N = EG.n, cell = EG.cell, H = new Float32Array(N * N), M = new Float32Array(N * N);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const x = EG.x0 + i * cell, z = EG.z0 + j * cell, k = j * N + i;
      H[k] = preHeight(x, z);
      M[k] = H[k] > 0.4 ? erodibility(x, z, FIELD.s, distOutsidePlot(x, z)) : 0;
    }
    const H0 = H.slice();
    // hydraulic: droplets (after Mei / Lague), heights in metres, positions in cells
    const inertia = 0.06, capK = 1.6, minCap = 0, erodeK = 0.24, depositK = 0.08, evap = 0.035, gravity = 9, steps = 48;
    const RAD = 3, bOff = [], bW = []; { let sw = 0; for (let dz = -RAD; dz <= RAD; dz++) for (let dx = -RAD; dx <= RAD; dx++) { const d = Math.hypot(dx, dz); if (d <= RAD) { const w = 1 - d / (RAD + 0.5); bOff.push([dx, dz]); bW.push(w); sw += w; } } for (let q = 0; q < bW.length; q++) bW[q] /= sw; }
    const hAt = (px, pz) => {   // bilinear height + gradient
      const ix = Math.floor(px), iz = Math.floor(pz), fx = px - ix, fz = pz - iz, k = iz * N + ix;
      const a = H[k], b = H[k + 1], c = H[k + N], d = H[k + N + 1];
      G.gx = (b - a) * (1 - fz) + (d - c) * fz; G.gz = (c - a) * (1 - fx) + (d - b) * fx;
      G.h = a * (1 - fx) * (1 - fz) + b * fx * (1 - fz) + c * (1 - fx) * fz + d * fx * fz; return G;
    };
    const G = { gx: 0, gz: 0, h: 0 };
    const drops = 90000;
    for (let q = 0; q < drops; q++) {
      let px = 2 + h2(q, 71) * (N - 5), pz = 2 + h2(q, 113) * (N - 5);
      const k0 = Math.floor(pz) * N + Math.floor(px);
      if (M[k0] < 0.3 || H[k0] < 3) continue;
      let dx = 0, dz = 0, speed = 1, water = 1, sed = 0;
      for (let st = 0; st < steps; st++) {
        const ix = Math.floor(px), iz = Math.floor(pz); if (ix < 2 || iz < 2 || ix > N - 4 || iz > N - 4) break;
        const fx = px - ix, fz = pz - iz, k = iz * N + ix;
        const g = hAt(px, pz), h0 = g.h;
        dx = dx * inertia - g.gx * (1 - inertia); dz = dz * inertia - g.gz * (1 - inertia);
        const l = Math.hypot(dx, dz); if (l < 1e-6) break; dx /= l; dz /= l;
        px += dx; pz += dz;
        if (px < 2 || pz < 2 || px > N - 4 || pz > N - 4) break;
        const h1 = hAt(px, pz).h, dh = h1 - h0;
        const m = M[k];
        const cap = Math.max(-dh * speed * water * capK, minCap);
        if (sed > cap || dh > 0) {
          const amt = dh > 0 ? Math.min(dh, sed) : (sed - cap) * depositK;
          sed -= amt;
          const am = amt * m;   // only where the land may change (elsewhere the silt is carried off)
          H[k] += am * (1 - fx) * (1 - fz); H[k + 1] += am * fx * (1 - fz); H[k + N] += am * (1 - fx) * fz; H[k + N + 1] += am * fx * fz;
        } else {
          const amt = Math.min((cap - sed) * erodeK, -dh) * m * smooth(0.08, 0.3, Math.hypot(g.gx, g.gz) / cell);   // gullies on slopes, never grooves on the flats
          for (let b = 0; b < bOff.length; b++) {
            const kk = k + bOff[b][1] * N + bOff[b][0], e = amt * bW[b];
            const take = Math.min(e, Math.max(0, H[kk] - 0.3));
            H[kk] -= take; sed += take;
          }
        }
        speed = Math.sqrt(Math.max(0, speed * speed + dh * -gravity * 0.1));
        water *= 1 - evap;
        if (water < 0.02) break;
      }
    }
    // thermal: slopes past ~50 deg slump into talus at their foot (cliffs keep a steep face, gain a scree apron)
    const talus = cell * 1.25;
    for (let it = 0; it < 10; it++) {
      for (let j = 1; j < N - 1; j++) for (let i = 1; i < N - 1; i++) {
        const k = j * N + i; if (M[k] <= 0 && H[k] < 0.5) continue;
        for (const o of [1, -1, N, -N]) {
          const d = H[k] - H[k + o];
          if (d > talus) { const mv = (d - talus) * 0.22 * Math.max(0.35, M[k]); H[k] -= mv; H[k + o] += mv; }
        }
      }
    }
    const D = new Float32Array(N * N);
    for (let k = 0; k < N * N; k++) { const d = H[k] - H0[k]; D[k] = d > 0 ? 1.4 * Math.tanh(d / 1.4) : -5 * Math.tanh(-d / 5); }   // fans stay low, gullies stay gullies
    // a light blur of the change (no single-cell pits), and fade it out toward the grid's border
    const D2 = D.slice();
    for (let j = 1; j < N - 1; j++) for (let i = 1; i < N - 1; i++) {
      const k = j * N + i;
      D2[k] = D[k] * 0.5 + (D[k - 1] + D[k + 1] + D[k - N] + D[k + N]) * 0.125;
      const e = Math.min(i, j, N - 1 - i, N - 1 - j);
      D2[k] *= smooth(2, 14, e);
    }
    EG.delta = D2;
  }
  // Catmull-Rom (bicubic) sample of the erosion delta
  const cr = (p0, p1, p2, p3, t) => p1 + 0.5 * t * (p2 - p0 + t * (2 * p0 - 5 * p1 + 4 * p2 - p3 + t * (3 * (p1 - p2) + p3 - p0)));
  function erosionDelta(x, z) {
    if (!EG.delta) buildErosion();
    const N = EG.n, gx = (x - EG.x0) / EG.cell, gz = (z - EG.z0) / EG.cell;
    if (gx < 1 || gz < 1 || gx > N - 3 || gz > N - 3) return 0;
    const ix = Math.floor(gx), iz = Math.floor(gz), fx = gx - ix, fz = gz - iz, D = EG.delta;
    const row = r => { const k = (iz + r) * N + ix; return cr(D[k - 1], D[k], D[k + 1], D[k + 2], fx); };
    return cr(row(-1), row(0), row(1), row(2), fz);
  }

  // site platforms (heights from the analytic land at their centres)
  for (const st of SITES) if (!st.fixed) st.h = preHeight(st.x, st.z);

  // ---------- the height (true sea level 0; our lake is NOT carved here: each consumer bowls it its own way) ----------
  function height(x, z) {
    let h = preHeight(x, z);
    const s = FIELD.s, F = FIELD;
    if (s > 0) {
      const dp = distOutsidePlot(x, z);
      if (s > 2.5 && dp > 10) h += erosionDelta(x, z) * smooth(10, 18, dp) * smooth(2.5, 6, s);
      for (const st of SITES) {
        const d = Math.hypot(x - st.x, z - st.z);
        if (d < st.r1) h = lerp(h, st.h, (1 - smooth(st.r0, st.r1, d)) * smooth(0.5, 7, s));   // (never a platform out over a cliff)
      }
      // our valley: the plot's own relief, eased out ~18 m past its edge into the land round it
      const pw = inPlotRect(x, z) ? 1 : 1 - smooth(0, 18, dp);
      if (pw > 0) h = lerp(h, beach(s) + plotRelief(x, z) * smooth(0.6, 11, s), pw);
      h = riverChannel(x, z, h);
      if (F.stack > -1.5 && h < 0.1) h = 0.1;
    }
    return h;
  }

  // ---------- painting weights: cream (set by the caller), meadow, sand, pine (woods), rock ----------
  const NWEIGHTS = { cream: 0, meadow: 0, sand: 0, pine: 0, rock: 0 };
  function slopeAt(x, z, e = 1.5) { const gx = (height(x + e, z) - height(x - e, z)) / (2 * e), gz = (height(x, z + e) - height(x, z - e)) / (2 * e); return 1 - 1 / Math.sqrt(1 + gx * gx + gz * gz); }
  function weights(x, z, h = height(x, z), slope = null) {
    const W = { cream: 0, meadow: 0, sand: 0, pine: 0, rock: 0 };
    if (slope == null) slope = slopeAt(x, z);
    const F = fields(x, z), s = F.s, c = cliffAt(x, z), dp = distOutsidePlot(x, z);
    const r = riverAt(x, z);
    let sand = (1 - smooth(2.5, 7.5, s + (vnoise(x / 4, z / 4) - 0.5) * 3)) * (1 - c * 0.92) * (1 - smooth(1.6, 3.2, h));
    sand = Math.max(sand, (1 - smooth(r.w + 0.6, r.w + 2.8, r.d)) * 0.7 * (1 - smooth(1.2, 2.2, h)));   // river bars
    // limestone: steep faces, cliff faces, and the range's high tops (snow-free)
    let rock = Math.max(smooth(0.18, 0.42, slope), smooth(36, 54, h + (fbm(x / 22, z / 22, 2) - 0.5) * 14) * 0.95, c * (1 - smooth(1.5, 6, s)) * smooth(2, 5, h) * 0.9);
    if (F.stack > -1) rock = 1;
    // woods: masses on the mid slopes and in the valleys, thinning on the high tops; galleries along the river
    const fn = fbm(x / 27 + 5.1, z / 27 + 8.7, 3) + (fbm(x / 9 + 1.7, z / 9 - 3.3, 2) - 0.5) * 0.18;
    const band = smooth(3.5, 9, h) * (1 - smooth(32, 44, h));
    const riparian = (1 - smooth(r.w + 3, r.w + 11, r.d)) * smooth(1.2, 2.5, h) * 0.45;
    // ... and down the ravines the erosion carved (dendritic dark lines of wood, mb 1)
    const gully = s > 3 ? smooth(-0.25, -1.4, erosionDelta(x, z)) * smooth(3, 7, h) : 0;
    let forest = Math.max(smooth(0.57, 0.64, fn + band * 0.05), smooth(0.52, 0.6, fn) * band * 0.9, riparian * smooth(0.42, 0.56, fn + 0.08), gully * smooth(0.3, 0.45, fn + 0.1));
    forest *= smooth(4, 10, s) * smooth(6, 16, dp);
    let nearSite = 0; for (const st of SITES) nearSite = Math.max(nearSite, 1 - smooth(st.r0 * 0.7, st.r1 + 5, Math.hypot(x - st.x, z - st.z)));
    const pine = forest * (1 - nearSite) * (1 - rock);
    W.rock = rock * (1 - sand * 0.6);
    W.sand = Math.max(0, sand * (1 - rock));
    W.pine = pine;
    W.meadow = Math.max(0, 1 - W.sand - W.rock - W.pine);
    return W;
  }

  return { coast, fields, cliffAt, riverAt, riverWidth, height, preHeight, weights, slopeAt, plotRelief, erosionDelta,
    sites: SITES, riverLine: riverL, coastLine: coastL, EG, distOutsidePlot, beach };
}
