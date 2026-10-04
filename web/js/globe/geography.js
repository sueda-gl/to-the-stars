// The world's ONE flat layout, shared by the painted globe and the gouache map.
// Pure data + pure functions: no THREE, no DOM, no rnd stream (all noise is hashed, so it never shifts).
//
// Flat design space = the map's own coordinates: x east, z south (north / the sea is -z), y up, 1 unit = 1 map unit (~1 m).
// The globe wraps this plane onto a sphere with mapFlat (Tower Planet's azimuthal-equidistant wrap):
// distance from C becomes an arc on a planet of radius RP, height becomes altitude. k = 1 (no rescale), so a
// point (x, z) on the map IS the point (x, z) on the globe; the dive lands exactly on the map's coordinates.
//
//   home plot = sim state.plot { x0:-30, x1:30, z0:-26, z1:30 }, flat at y = 0, with the sim's seeded lake
//   the sea   = beyond the plot's far edge (z < z0 - 2..3.6, the sim's own sea line), opening north into a bay;
//               the sun sets over it, as in the Red arch
//   nations   = at the sim neighbour positions: n1 (-95,-40) on the west headland, n2 (100,-55) a hill town above
//               the east coast, n3 (0,-130) on the island across the bay
//   the land  = the designed landform (landform.js, 2026-10-04): coast, ridges, the river's gorge, islands, stacks,
//               the range, an erosion pass; reliefAt / heightAt / landField / landWeights read it
//   wonder    = the Red arch, on a low bluff east of the plot looking out to sea

import { createRng } from '../sim/rng.js';
import { blobPoly, pointInPoly } from '../sim/geometry.js';
import { createLandform, RIVER_PTS } from './landform.js';

export const GEO = {
  RP: 170,                 // planet radius in globe units
  C: { x: 0, z: 2 },       // the flat point that sits on the globe's +Y pole (the plot's centre)
  k: 1,                    // 1 globe unit = k map units (k = 1: identical coordinates)
  seaLevel: 0,
  version: 1
};
export const PLOT = { x0: -30, x1: 30, z0: -26, z1: 30 };
// the sim's sea line along the plot's far edge (state.js: [-400,z0-2],[-40,z0-3.2],[0,z0-2.4],[40,z0-3.6],[400,z0-2])
export const SIM_SEA_LINE = [[-400, PLOT.z0 - 2], [-40, PLOT.z0 - 3.2], [0, PLOT.z0 - 2.4], [40, PLOT.z0 - 3.6], [400, PLOT.z0 - 2]];
// the sim's candidate lake spots (state.js); the seed picks one and blobPoly wobbles it
export const LAKE_SPOTS = [{ x: -16, z: -9 }, { x: 16, z: -11 }, { x: -17, z: 15 }, { x: 18, z: 16 }];

// the lake createGame({ seed }) makes: the same first two rng draws (pick + blobPoly)
export function homeLake(seed = 7) {
  const rng = createRng(seed);
  const ls = rng.pick(LAKE_SPOTS);
  return blobPoly(rng, ls.x, ls.z, 5, 3.5, 14);
}
let LAKE = homeLake(7), LAKE_BOX = bbox(LAKE);
// adopt the live game's water (game.state.water): the lake poly is taken; the sea stays the layout's own
export function setWater(water) {
  const lake = (water || []).find(w => w.kind === 'lake');
  if (lake && lake.poly && lake.poly.length > 2) { LAKE = lake.poly.map(p => [p[0], p[1]]); LAKE_BOX = bbox(LAKE); }
  return LAKE;
}
export function getLake() { return LAKE; }
function bbox(poly) { let a = 1e9, b = -1e9, c = 1e9, d = -1e9; for (const [x, z] of poly) { a = Math.min(a, x); b = Math.max(b, x); c = Math.min(c, z); d = Math.max(d, z); } return { x0: a, x1: b, z0: c, z1: d }; }

// ---------------- noise (hashed, deterministic) ----------------
function h2(x, z) { let h = Math.imul(x | 0, 374761393) ^ Math.imul(z | 0, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; }
function h3(x, y, z) { let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 1440662683); h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; }
const fade = t => t * t * (3 - 2 * t);
export function vnoise2(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z), fx = fade(x - xi), fz = fade(z - zi);
  const a = h2(xi, zi), b = h2(xi + 1, zi), c = h2(xi, zi + 1), d = h2(xi + 1, zi + 1);
  return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz;
}
export function fbm2(x, z, o = 4) { let a = 0.5, f = 1, s = 0, n = 0; for (let i = 0; i < o; i++) { s += a * vnoise2(x * f + i * 17.1, z * f - i * 9.3); n += a; f *= 2.03; a *= 0.5; } return s / n; }
function vnoise3(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), fx = fade(x - xi), fy = fade(y - yi), fz = fade(z - zi);
  const L = (a, b, t) => a + (b - a) * t;
  return L(L(L(h3(xi, yi, zi), h3(xi + 1, yi, zi), fx), L(h3(xi, yi + 1, zi), h3(xi + 1, yi + 1, zi), fx), fy),
           L(L(h3(xi, yi, zi + 1), h3(xi + 1, yi, zi + 1), fx), L(h3(xi, yi + 1, zi + 1), h3(xi + 1, yi + 1, zi + 1), fx), fy), fz);
}
function fbm3(x, y, z, o = 4) { let a = 0.5, f = 1, s = 0, n = 0; for (let i = 0; i < o; i++) { s += a * vnoise3(x * f, y * f, z * f); n += a; f *= 2.03; a *= 0.5; } return s / n; }
export const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const smax = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.max(a, b) + h * h * k * 0.25; };

// ---------------- the flat <-> sphere wrap (Tower Planet's mapFlat) ----------------
// flat (x, y, z) -> sphere point around the origin, pole = +Y. out: any {x,y,z} with .set or a plain array
export function flatToSphere(fx, y, fz, out = [0, 0, 0]) {
  const { RP, C } = GEO;
  const rx = fx - C.x, rz = fz - C.z, d = Math.hypot(rx, rz), r = RP + y;
  let X, Y, Z;
  if (d < 1e-9) { X = 0; Y = r; Z = 0; }
  else { const th = Math.min(Math.PI, d / RP), s = Math.sin(th); X = s * rx / d * r; Y = Math.cos(th) * r; Z = s * rz / d * r; }
  if (out.set) return out.set(X, Y, Z);
  out[0] = X; out[1] = Y; out[2] = Z; return out;
}
// sphere point -> flat {x, y, z} (y = altitude above RP)
export function sphereToFlat(X, Y, Z) {
  const { RP, C } = GEO;
  const r = Math.hypot(X, Y, Z), th = Math.acos(Math.max(-1, Math.min(1, Y / r))), s = Math.hypot(X, Z);
  const ux = s > 1e-9 ? X / s : 0, uz = s > 1e-9 ? Z / s : 1;
  return { x: C.x + ux * th * RP, y: r - RP, z: C.z + uz * th * RP };
}
// the local frame at a flat point: up (sphere normal), east (+x on the map), south (+z on the map), unit vectors
export function frameAt(fx, fz) {
  const e = 0.25, p = flatToSphere(fx, 0, fz), px = flatToSphere(fx + e, 0, fz), pz = flatToSphere(fx, 0, fz + e);
  const up = norm(p), east = norm(sub(px, p)), south0 = sub(pz, p);
  // orthonormalise: south = up x east (right-handed: east, up, south = x, y, z)
  const south = norm(cross(east, up));
  const s2 = dot(south, south0) < 0 ? [-south[0], -south[1], -south[2]] : south;
  return { up, east: norm(cross(up, s2)), south: s2 };
}
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

// ---------------- places ----------------
// views: the low oblique camera a dive ends on, in flat map coordinates (eye/look are offsets from the place)
export const places = {
  // home: the dive ends (nearly) top-down, ~100 up, like a relief map (ART_DIRECTION: "the descent is top-down"),
  // the plot whole with the bay above it and no horizon in frame; the gouache map's descent starts from this
  // same camera (world camera.js globeView) and eases into the leader view
  home: { id: 'home', name: 'Our land', x: 0, z: 2, kind: 'home',
    view: { eye: [0, 100, 14], look: [0, 0, -6], fov: 46 } },
  nations: [
    // sim neighbours: n1 Sorrento-on-the-Rock (drop), n2 Little Lantern (loaf), n3 Grey Harbour (sim says puffer;
    // the story arc makes it the Flit Sky-hold). Positions are the sim's; names are the story arc's nation titles.
    { id: 'n1', name: 'The Drop Riviera', simName: 'Sorrento-on-the-Rock', species: 'drop', style: 'riviera', x: -95, z: -40, r: 15,
      colours: { wall: '#ff8f78', accent: '#c23a2c', stone: '#e9d5b5' },
      view: { eye: [40, 30, 38], look: [-4, 5, -6], fov: 46 } },
    { id: 'n2', name: 'The Loaf Republic', simName: 'Little Lantern', species: 'loaf', style: 'loaf', x: 100, z: -55, r: 15,
      colours: { wall: '#4cc7b8', accent: '#efe6d2', stone: '#efe6d2' },
      view: { eye: [-36, 24, 30], look: [2, 2, -4], fov: 46 } },
    { id: 'n3', name: 'The Flit Sky-hold', simName: 'Grey Harbour', species: 'flit', style: 'skyhold', x: 0, z: -130, r: 15,
      colours: { wall: '#a8dc6e', accent: '#ffe27a', stone: '#e8dcc0' },
      view: { eye: [0, 30, 52], look: [0, 10, -2], fov: 46 } }
  ],
  // yaw: the arch turns (radians, about up) to look north-west down the open bay, as the original looks at the sea
  wonder: { id: 'wonder', name: 'The Red Arch', x: 44, z: -15, kind: 'wonder', scale: 0.2, yaw: 0.62,
    // the reference camera (camBase (-0.4,4,22) -> lookBase (0,7.2,-20)) at the wonder's scale
    view: { eye: [-0.08, 0.8, 4.4], look: [0, 1.44, -4], fov: 50, sun: 0 } }
};
const NATIONS = places.nations;
const WONDER = places.wonder;

// ---------------- the land (2026-10-04: the designed landform, globe/landform.js) ----------------
// ONE terrain for the map and the globe: a composed coastal region (crescent beach + estuary in front of our
// plot, the river out of the mountains through a gorge, ridgelines with spurs and eroded gullies, the west
// headland, the hill town above the east coast, the island across the bay, a second island, stacks and islets,
// the limestone range at the back) at TRUE sea level 0. See landform.js for the design and docs/globe.md.
export function distOutsidePlot(x, z, p = PLOT) { const bx = Math.max(p.x0 - x, 0, x - p.x1), bz = Math.max(p.z0 - z, 0, z - p.z1); return Math.hypot(bx, bz); }
export function inPlot(x, z, p = PLOT) { return x >= p.x0 && x <= p.x1 && z >= p.z0 && z <= p.z1; }
export function inLake(x, z) { return x >= LAKE_BOX.x0 && x <= LAKE_BOX.x1 && z >= LAKE_BOX.z0 && z <= LAKE_BOX.z1 && pointInPoly(x, z, LAKE); }
export const CAMP = { x: 0, z: 9 };   // the sim's spawn: where the settlers make camp
export function lakeSD(x, z) {
  const P = LAKE; let d = 1e9;
  for (let i = 0, n = P.length; i < n; i++) {
    const [ax, az] = P[i], [bx, bz] = P[(i + 1) % n], ex = bx - ax, ez = bz - az;
    let t = ((x - ax) * ex + (z - az) * ez) / (ex * ex + ez * ez); t = t < 0 ? 0 : t > 1 ? 1 : t;
    d = Math.min(d, Math.hypot(ax + ex * t - x, az + ez * t - z));
  }
  return inLake(x, z) ? -d : d;
}
const nearLake = (x, z) => x > LAKE_BOX.x0 - 14 && x < LAKE_BOX.x1 + 14 && z > LAKE_BOX.z0 - 14 && z < LAKE_BOX.z1 + 14;
const lakeDist = (x, z) => nearLake(x, z) ? Math.max(0, lakeSD(x, z)) : 1e9;

export const LANDFORM = createLandform({ PLOT, C: GEO.C, nations: NATIONS, wonder: WONDER, lakeDist });
export { COAST, HEADLAND, ISLAND, ISLAND2, STACKS, ISLETS, RIVER_PTS } from './landform.js';
// the river's control line (mouth -> source); riverDist / riverWidth read the smoothed, meandering line
export const RIVER = RIVER_PTS;

// signed land field: + land, - sea, ~ metres to the coast (the plot is always land)
export function landField(x, z) { const s = LANDFORM.coast(x, z); return inPlot(x, z) ? Math.max(s, 0.01) : s; }
// distance to the river's centre line and the along-river parameter t (0 mouth .. 1 source)
export function riverDist(x, z) { const r = LANDFORM.riverAt(x, z); return { d: r.d, t: r.t }; }
export const riverWidth = t => LANDFORM.riverWidth(t);
// (kept for old callers: the river is designed with its meanders now, so this is the identity)
export function riverMeanderX(x) { return x; }

// reliefAt(x, z): THE ground height of the map and the globe (true sea level 0, water < 0). Our lake is a smooth
// bowl to the sim's polygon (water < 0 inside). The map lowers its waterline to its own sea plane (ground.js).
export function reliefAt(x, z) {
  let h = LANDFORM.height(x, z);
  if (nearLake(x, z)) {
    const l = lakeSD(x, z);
    if (l < 0) return Math.max(-2.2, l * 0.6 - 0.05);
    if (l < 1.6) h = lerp(0.05, h, smooth(0, 1.6, l));
  }
  return h;
}
// heightAt(x, z): the v1 contract: 0 on the plot (level, buildable: the sim's ground; the lake -2.2), < 0 water,
// > 0 the relief everywhere else (the landform)
export function heightAt(x, z) {
  if (inPlot(x, z)) return inLake(x, z) ? -2.2 : 0;
  return LANDFORM.height(x, z);
}
// the plot's own relief and the hills' detail are part of the landform now (kept for old callers)
export function plotRelief(x, z) { return LANDFORM.plotRelief(x, z); }
export function detailRelief() { return 0; }

// "our land" for the LOOK: a rounded, ragged region round the plot (no straight sides)
const RC = 12;   // corner radius of the home region's rounded outline
export function homeSD(x, z) {   // signed distance to the plot as a rounded rectangle, with a ragged wobble (< 0 inside)
  const cx = (PLOT.x0 + PLOT.x1) / 2, cz = (PLOT.z0 + PLOT.z1) / 2, hx = (PLOT.x1 - PLOT.x0) / 2, hz = (PLOT.z1 - PLOT.z0) / 2;
  const qx = Math.abs(x - cx) - (hx - RC), qz = Math.abs(z - cz) - (hz - RC);
  const sd = Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0) - RC;
  return sd + (fbm2(x / 16 + 5.3, z / 16 - 8.1, 3) - 0.5) * 14;
}
export function homeWeight(x, z) { return 1 - smooth(-8, 14, homeSD(x, z)); }
export const GLOWS = [
  { id: 'home', x: CAMP.x, z: CAMP.z, r: 18, colour: '#ffb46e' },
  ...NATIONS.map(n => ({ id: n.id, x: n.x, z: n.z, r: 22, colour: n.colours.wall }))
];

export function isWater(x, z) { return heightAt(x, z) < 0; }
export function waterKind(x, z) {
  if (inPlot(x, z)) return inLake(x, z) ? 'lake' : null;
  if (LANDFORM.coast(x, z) <= 0) return 'sea';
  return LANDFORM.height(x, z) < 0 ? 'river' : null;
}
// soft ground-cover weights (the globe and the map paint with these; landKind is their argmax)
//   cream (our plot / our land) · meadow · sand (beaches, river bars) · pine (woods) · rock (limestone: cliffs, steep
//   faces, the range's tops)
export function landWeights(x, z, h = null, slope = null) {
  if (inPlot(x, z)) return { cream: 1, meadow: 0, sand: 0, pine: 0, rock: 0 };
  return LANDFORM.weights(x, z, h == null ? LANDFORM.height(x, z) : h, slope);
}
// landWeights with no rectangle: the land round our plot is painted through it and fades out under homeWeight
export function landWeightsSoft(x, z, h = null, slope = null) {
  const hw = homeWeight(x, z), w = LANDFORM.weights(x, z, h == null ? LANDFORM.height(x, z) : h, slope), k = 1 - hw;
  return { cream: hw, meadow: w.meadow * k, sand: w.sand * k, pine: w.pine * k, rock: w.rock * k };
}
// 'cream' (our plot), 'meadow' | 'sand' | 'pine' | 'rock' on land; 'lake' | 'sea' | 'river' on water
export function landKind(x, z) {
  const wk = waterKind(x, z); if (wk) return wk;
  const w = landWeights(x, z); let best = 'meadow', bv = -1;
  for (const k in w) if (w[k] > bv) { bv = w[k]; best = k; }
  return best;
}
// a place by id: 'home' | 'wonder' | 'moon' | 'n1' | 'n2' | 'n3'
export function placeById(id) {
  if (id === 'home' || id === 'wonder') return places[id];
  if (id === 'moon') return MOON.places.meadow;
  return NATIONS.find(n => n.id === id) || null;
}
// home-growth spots: where small painted buildings appear in the plot (centre outward, off the lake)
export function homeSpots(n = 16) {
  const out = [], cand = [];
  for (let gz = -20; gz <= 26; gz += 7) for (let gx = -24; gx <= 24; gx += 7.5) {
    const j = h2(gx * 3 + 1, gz * 7 + 5), x = gx + (j - 0.5) * 3, z = gz + (h2(gx + 9, gz - 3) - 0.5) * 3;
    if (Math.abs(x) < 4 && Math.abs(z - 2) < 4) continue;   // the square stays open
    let near = 1e9; for (const [lx, lz] of LAKE) near = Math.min(near, Math.hypot(x - lx, z - lz));
    if (inLake(x, z) || near < 4) continue;
    cand.push({ x, z, d: Math.hypot(x, z - 2) + j * 4, rot: (h2(gx, gz) - 0.5) * 0.5 });
  }
  cand.sort((a, b) => a.d - b.d);
  for (let i = 0; i < Math.min(n, cand.length); i++) out.push(cand[i]);
  return out;
}

// ---------------- the Moon: the shadelings' world, a second small painted planet ----------------
// Its own flat design space around its own pole (the meadow), wrapped with the same mapFlat at radius RM.
export const MOON = {
  RM: 54,
  places: {
    // the landing (2026-10-04): lounge.html's opening view in miniature. Eye level a few metres in front of the
    // lounge, looking north over it: the rug and the sofa centred, an armchair either side, the little lake as a band
    // behind them, the shrub cones on the rise beyond, the limestone spires on the skyline. Ends on a framing that
    // cross-fades into lounge.html (camera (0, 1.5, 6.6) -> target (0, 2.05, -3), fov 52).
    meadow: { id: 'moon', name: 'The Moon meadow', x: 0, z: 0, kind: 'moon', view: { eye: [0, 3.3, 7.8], look: [0, 1.05, -4], fov: 52 } }
  },
  lake: { x: 0.3, z: -7.0, rx: 10, rz: 2.8 },
  // leaning limestone spires (the Alpine lounge's peaks, cream with lilac shadow sides): x, z, height, lean
  spires: [[-10.5, -18.5, 14, 0.1], [-16.5, -14, 10, -0.12], [-4.2, -21.5, 12, 0.05], [7.5, -20.5, 15, -0.08], [14.5, -16.5, 11, 0.14], [20, -11.5, 7.5, 0.2], [-21, -8.5, 6.5, -0.18], [1.8, -24, 9, -0.04]],
  // shrub-covered cones (the lounge's green hills) on the rise behind the lake: x, z, height, radius
  cones: [[-7.5, -11.5, 4.2, 2.6], [-1.5, -12.6, 4.8, 2.8], [4.8, -11.8, 4.4, 2.6], [10.8, -10.4, 3.7, 2.3], [-13.2, -9.2, 3.4, 2.1], [15.8, -7.4, 2.9, 1.9], [-18, -5.8, 2.4, 1.7]],
  cypresses: [[-11.6, -3.6, 3.8], [-12.8, -5.2, 3.0], [12.2, -4.0, 3.6], [13.4, -2.6, 2.8], [-8.6, 1.4, 3.0], [9.0, 1.0, 2.8]],   // x, z, height
  bushes: [[-5.0, 2.2, 0.3], [5.2, 1.9, 0.32], [-7.0, 0.2, 0.36], [7.2, -0.2, 0.36], [-10.2, -1.6, 0.4], [10.6, -1.8, 0.4]],     // x, z, spread
  // an oxblood rug, an olive sofa + armchairs facing the viewer, a white tulip table, side tables, a paper floor lamp
  lounge: { x: 0, z: 0, scale: 1.3, yaw: 0, lamp: { x: -1.7, z: -1.0 } },
  // the lake shore is a signed distance (linear across it), so the painted water edge follows the ellipse
  // instead of stepping along the grid
  lakeSD(x, z) {
    const L = MOON.lake;
    const ld = Math.hypot((x - L.x) / L.rx, (z - L.z) / L.rz) + (vnoise2(x * 0.6, z * 0.6) - 0.5) * 0.12;
    return (ld - 1) * L.rz * 0.9;
  },
  heightAt(x, z) {
    const d = Math.hypot(x, z);
    let h = 2.6 + (fbm2(x / 18 + 3, z / 18, 3) - 0.5) * 3 * smooth(14, 30, d);
    // soft craters (bowls with rims), off the meadow
    for (const [cx, cz, r] of CRATERS) {
      const q = Math.hypot(x - cx, z - cz) / r;
      if (q < 1.5) h += (q < 1 ? -2.2 * (1 - q * q) * r / 9 + 0.9 * q * q * q * r / 9 : 0.9 * (1 - smooth(1, 1.5, q)) * r / 9);
    }
    // the meadow: level round the lounge, a gentle rise behind the lake up to the cones and the spires
    const rise = 2.4 * smooth(8.5, 15, -z) * (1 - smooth(18, 28, Math.abs(x))) + 0.35 * (fbm2(x / 5, z / 5, 2) - 0.5);
    const md = Math.hypot(x / 1.2, z + 4);
    h = lerp(MOON.stageAt(x, z) + rise, h, smooth(19, 27, md));
    h = Math.max(0.15, h);
    // the little lake: a shallow dish in the stage under its own water (globe.js: a painted water mesh at
    // MOON.lakeSurfaceAt), so it sits up in view from the lounge instead of in a pit at the Moon's sea level
    const sd = MOON.lakeSD(x, z);
    if (sd < 1.6) { const lv = MOON.lakeSurfaceAt(x, z); h = sd < 0 ? lv - Math.min(0.5, 0.08 - sd * 0.6) : lerp(lv + 0.05, h, smooth(0, 1.6, sd)); }
    return h;
  },
  // the stage round the landing: the meadow rises with distance from the viewer to cancel most of the Moon's
  // curvature (0.7 d^2 / 2R), so from the lounge the lake and the cones sit up in view as on lounge.html's flat meadow
  stageAt(x, z) {
    const md = Math.hypot(x / 1.2, z + 4);
    return 0.3 + 0.7 * (x * x + (z - 6) * (z - 6)) / (2 * MOON.RM) * (1 - smooth(16, 26, md)) * smooth(-2, 6, -z + 6);
  },
  // the lake's water follows the stage (so, like the stage, it is near-flat in 3D and faces the lounge; a water
  // level at a constant radius would tilt away from the viewer and vanish edge-on)
  lakeSurfaceAt(x, z) { return MOON.stageAt(x, z) - 0.04; },
  // soft ground weights: the sage meadow frays into the lilac regolith over a brushy band (the globe's shader
  // thresholds this weight against world-space noise per pixel, so the edge is painted, never a grid staircase)
  landWeights(x, z) {
    const d = Math.hypot(x / 1.2, z + 4) + (fbm2(x / 6, z / 6, 3) - 0.5) * 6 + (vnoise2(x / 1.7 + 4, z / 1.7) - 0.5) * 1.4;
    return { meadow: 1 - smooth(16, 22, d) };
  },
  landKind(x, z) {
    if (MOON.lakeSD(x, z) < 0) return 'lake';
    return MOON.landWeights(x, z).meadow > 0.5 ? 'meadow' : 'regolith';
  },
  flatToSphere(fx, y, fz, out = [0, 0, 0]) {
    const RM = MOON.RM, d = Math.hypot(fx, fz), r = RM + y;
    let X, Y, Z;
    if (d < 1e-9) { X = 0; Y = r; Z = 0; } else { const th = Math.min(Math.PI, d / RM), s = Math.sin(th); X = s * fx / d * r; Y = Math.cos(th) * r; Z = s * fz / d * r; }
    if (out.set) return out.set(X, Y, Z);
    out[0] = X; out[1] = Y; out[2] = Z; return out;
  }
};
const CRATERS = [[30, 8, 9], [-26, 22, 7], [18, 34, 11], [-38, -12, 8], [44, -30, 12], [-8, 52, 10], [60, 30, 9], [-56, 40, 12], [10, -44, 8], [-30, -48, 6]];
