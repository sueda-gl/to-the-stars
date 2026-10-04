// Our home on Sueda's Tower Planet: the game's flat layout, with the SAME API as web/js/globe/geography.js, so the
// sim, the agents and the game can switch to the planet with no other changes. New code (docs/planet.md "Home").
//
//   const geo = createPlanetGeography(planet)        // planet = createPlanet(...) (or null in node: rebuilt mesh)
//
// The site (chosen from a top-down hillshade of her terrain, shots/planet/home/map-*.png): the cream coastal plain
// EAST of her road, between the road and the east chain's foot, with the sea along its south-east shore. Gentle
// rolling relief (about 3 m over the middle 40 x 40 m), a low hill at the back corner, a hollow that holds our lake.
//
// Coordinates. "game" = the sim's frame: plot x -30..30, z -26..30, the sea beyond z0 (north = -z), y up, 1 unit =
// 1 m. Her flat design space is turned 165 degrees and shifted: toPlanet(x, z) = FRAME + R(rot) (x, z). The turn puts
// the coast exactly where the sim expects its sea line (game z ~ -28) and her tower inland, behind the plot (+z).
import { C, RP, TOWER_BASE, TOWER_H, mapFlat, H, pathDist } from './terrain.js';
import { createDrawnGround } from './adapter.js';

export const FRAME = { fx: 44, fz: 21, rot: 165 * Math.PI / 180 };
const cR = Math.cos(FRAME.rot), sR = Math.sin(FRAME.rot);
export function toPlanet(x, z, o = {}) { o.fx = FRAME.fx + cR * x - sR * z; o.fz = FRAME.fz + sR * x + cR * z; return o; }
export function fromPlanet(fx, fz, o = {}) { const dx = fx - FRAME.fx, dz = fz - FRAME.fz; o.x = cR * dx + sR * dz; o.z = -sR * dx + cR * dz; return o; }

export const PLOT = { x0: -30, x1: 30, z0: -26, z1: 30 };   // the sim's state.plot
export const CAMP = { x: 0, z: 9 };                          // the sim's spawn
// where her terrain holds still water: a hollow at the foot of the knoll (planet flat), filled to just under its lip
export const LAKE_SEED = { fx: 52.9, fz: 7.6 };
// the three nations, on real sites of her planet (planet flat; game x/z are derived): searched for flat ground of
// the right kind (shots/planet/home/map-region.png)
export const NATION_SITES = [
  { id: 'n1', name: 'The Drop Riviera', simName: 'Sorrento-on-the-Rock', species: 'drop', style: 'riviera', kind: 'headland',
    fx: 204, fz: 46, r: 15, colours: { wall: '#ff8f78', accent: '#c23a2c', stone: '#e9d5b5' } },
  { id: 'n2', name: 'The Loaf Republic', simName: 'Little Lantern', species: 'loaf', style: 'loaf', kind: 'hill town',
    fx: -86, fz: 12, r: 15, colours: { wall: '#4cc7b8', accent: '#efe6d2', stone: '#efe6d2' } },
  { id: 'n3', name: 'The Puffer Harbour', simName: 'Grey Harbour', species: 'puffer', style: 'harbour', kind: 'island harbour',
    fx: 170, fz: 128, r: 15, colours: { wall: '#ffd23f', accent: '#2f62d8', stone: '#e8dcc0' } }
];

// ---------------- small geometry helpers (pure) ----------------
export function pointInPoly(x, z, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i], [xj, zj] = poly[j];
    if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}
function polyArea(poly) { let a = 0; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) a += (poly[j][0] + poly[i][0]) * (poly[j][1] - poly[i][1]); return a / 2; }
function bbox(poly) { let a = 1e9, b = -1e9, c = 1e9, d = -1e9; for (const [x, z] of poly) { a = Math.min(a, x); b = Math.max(b, x); c = Math.min(c, z); d = Math.max(d, z); } return { x0: a, x1: b, z0: c, z1: d }; }
function simplify(pts, tol) {   // Douglas-Peucker on a closed ring
  if (pts.length < 8) return pts;
  const rdp = (a, b, out) => {
    let best = -1, bd = tol;
    const [ax, az] = pts[a], [bx, bz] = pts[b], dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz) || 1e-9;
    for (let i = a + 1; i < b; i++) { const d = Math.abs((pts[i][0] - ax) * dz - (pts[i][1] - az) * dx) / L; if (d > bd) { bd = d; best = i; } }
    if (best < 0) { out.push(pts[a]); return; }
    rdp(a, best, out); rdp(best, b, out);
  };
  const half = Math.floor(pts.length / 2), out = [];
  rdp(0, half, out); rdp(half, pts.length - 1, out); out.push(pts[pts.length - 1]);
  return out;
}
// marching squares on a node grid f[j*nx+i] (inside > 0): closed loops of [u, v] in grid units, chained exactly
function contours(f, nx, nz) {
  // edge ids: horizontal (i,j)->(i+1,j) = 2*(j*nx+i), vertical (i,j)->(i,j+1) = that + 1
  const eH = (i, j) => 2 * (j * nx + i), eV = (i, j) => 2 * (j * nx + i) + 1;
  const pt = (e) => {
    const n = e >> 1, i = n % nx, j = (n - i) / nx;
    if (e & 1) { const a = f[j * nx + i], b = f[(j + 1) * nx + i]; return [i, j + a / (a - b)]; }
    const a = f[j * nx + i], b = f[j * nx + i + 1]; return [i + a / (a - b), j];
  };
  const next = new Map();
  const add = (a, b) => { next.set(a, b); };
  for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const v0 = f[j * nx + i] > 0, v1 = f[j * nx + i + 1] > 0, v2 = f[(j + 1) * nx + i + 1] > 0, v3 = f[(j + 1) * nx + i] > 0;
    const c = (v0 ? 1 : 0) | (v1 ? 2 : 0) | (v2 ? 4 : 0) | (v3 ? 8 : 0);
    if (c === 0 || c === 15) continue;
    const B = eH(i, j), R = eV(i + 1, j), T = eH(i, j + 1), L = eV(i, j);
    // segments oriented with the inside on the left
    switch (c) {
      case 1: add(L, B); break; case 2: add(B, R); break; case 3: add(L, R); break;
      case 4: add(R, T); break; case 5: add(L, T); add(R, B); break; case 6: add(B, T); break;
      case 7: add(L, T); break; case 8: add(T, L); break; case 9: add(T, B); break;
      case 10: add(T, R); add(B, L); break; case 11: add(T, R); break; case 12: add(R, L); break;
      case 13: add(R, B); break; case 14: add(B, L); break;
    }
  }
  const loops = [], used = new Set();
  for (const s of next.keys()) {
    if (used.has(s)) continue;
    const loop = []; let e = s;
    while (e != null && !used.has(e)) { used.add(e); loop.push(pt(e)); e = next.get(e); }
    if (loop.length > 2) loops.push(loop);
  }
  return loops;
}

/* ================= the geography ================= */
export function createPlanetGeography(planet = null, { drawn = null, lakeArea = 64, renderLake = true } = {}) {
  drawn = drawn || createDrawnGround(planet);
  const _p = {}, _g = {};
  const groundY = (x, z) => { toPlanet(x, z, _p); return drawn.alt(_p.fx, _p.fz); };
  const inPlot = (x, z, p = PLOT) => x >= p.x0 && x <= p.x1 && z >= p.z0 && z <= p.z1;
  const distOutsidePlot = (x, z, p = PLOT) => Math.hypot(Math.max(p.x0 - x, 0, x - p.x1), Math.max(p.z0 - z, 0, z - p.z1));

  /* ---- the lake: her hollow at LAKE_SEED, filled until ~lakeArea m2 or just under its spill ---- */
  const lake = (() => {
    const half = 16, st = 0.25, n = Math.round(2 * half / st) + 1, alt = new Float32Array(n * n);
    const fx0 = LAKE_SEED.fx - half, fz0 = LAKE_SEED.fz - half;
    let lo = Infinity, si = 0;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const a = drawn.alt(fx0 + i * st, fz0 + j * st); alt[j * n + i] = a;
      if (Math.hypot(i * st - half, j * st - half) < 6 && a < lo) { lo = a; si = j * n + i; }
    }
    const mask = new Uint8Array(n * n), queue = new Int32Array(n * n);
    const flood = L => {
      mask.fill(0); let qh = 0, qt = 0, cnt = 0, edge = false;
      queue[qt++] = si; mask[si] = 1;
      while (qh < qt) {
        const c = queue[qh++]; cnt++;
        const i = c % n, j = (c - i) / n;
        if (i === 0 || j === 0 || i === n - 1 || j === n - 1) edge = true;
        for (const d of [c - 1, c + 1, c - n, c + n]) {
          if (d < 0 || d >= n * n || mask[d]) continue;
          if (Math.abs((d % n) - i) > 1) continue;
          if (alt[d] < L) { mask[d] = 1; queue[qt++] = d; }
        }
      }
      return { area: cnt * st * st, edge };
    };
    let L = lo + 0.02, best = null;
    for (let k = 0; k < 300; k++, L += 0.01) {
      const r = flood(L);
      if (r.edge) break;
      best = { L, area: r.area };
      if (r.area >= lakeArea) break;
    }
    if (!best) return null;
    flood(best.L);
    // contour of L - alt inside the component (outside = -1), padded so loops close
    const f = new Float32Array(n * n);
    for (let c = 0; c < n * n; c++) f[c] = mask[c] ? best.L - alt[c] : alt[c] >= best.L ? Math.min(-1e-4, best.L - alt[c]) : -0.05;
    const loops = contours(f, n, n);
    let ring = loops[0] || [];
    for (const l of loops) if (Math.abs(polyArea(l)) > Math.abs(polyArea(ring))) ring = l;
    const planetRing = ring.map(([u, v]) => [fx0 + u * st, fz0 + v * st]);
    const poly = simplify(planetRing.map(([fx, fz]) => { fromPlanet(fx, fz, _g); return [+_g.x.toFixed(2), +_g.z.toFixed(2)]; }), 0.1);
    let maxDepth = 0; for (let c = 0; c < n * n; c++) if (mask[c]) maxDepth = Math.max(maxDepth, best.L - alt[c]);
    return { level: best.L, area: best.area, maxDepth, poly, planetRing, grid: { fx0, fz0, st, n, alt, mask } };
  })();
  const LAKE = lake ? lake.poly : [];
  const LAKE_BOX = lake ? bbox(LAKE) : { x0: 1, x1: 0, z0: 1, z1: 0 };
  const LAKE_Y = lake ? lake.level : null;
  const inLake = (x, z) => !!lake && x >= LAKE_BOX.x0 && x <= LAKE_BOX.x1 && z >= LAKE_BOX.z0 && z <= LAKE_BOX.z1 && pointInPoly(x, z, LAKE);

  /* ---- the sea round home, traced from her painted waterline (aW > -0.4), as the sim's sea polygon ---- */
  const sea = (() => {
    const X0 = -110, X1 = 110, Z0 = -90, Z1 = 50, st = 1;
    const nx = Math.round((X1 - X0) / st) + 3, nz = Math.round((Z1 - Z0) / st) + 3, f = new Float32Array(nx * nz).fill(-1);
    for (let j = 1; j < nz - 1; j++) for (let i = 1; i < nx - 1; i++) {
      toPlanet(X0 + (i - 1) * st, Z0 + (j - 1) * st, _p);
      f[j * nx + i] = drawn.wat(_p.fx, _p.fz) + 0.4;
    }
    const loops = contours(f, nx, nz);
    let ring = null, ba = 0;
    for (const l of loops) { const a = Math.abs(polyArea(l)); if (a > ba) { ba = a; ring = l; } }
    if (!ring) return [];
    return simplify(ring.map(([u, v]) => [+(X0 + (u - 1) * st).toFixed(2), +(Z0 + (v - 1) * st).toFixed(2)]), 0.35);
  })();
  const SEA_BOX = sea.length ? bbox(sea) : null;

  // water: 'lake' | 'sea' | null (her painted sea is the truth for the sea; our lake is the polygon)
  function waterKind(x, z) {
    if (inLake(x, z)) return 'lake';
    toPlanet(x, z, _p);
    return drawn.wat(_p.fx, _p.fz) > -0.4 ? 'sea' : null;
  }
  const isWater = (x, z) => waterKind(x, z) != null;
  // the water surface altitude: the sea at 0, the lake at LAKE_Y; null on land
  function waterLevel(x, z) { const k = waterKind(x, z); return k === 'lake' ? LAKE_Y : k === 'sea' ? 0 : null; }
  // the globe contract: < 0 = water (its depth); on land the drawn ground's altitude above the sphere
  function heightAt(x, z) {
    toPlanet(x, z, _p);
    const g = drawn.alt(_p.fx, _p.fz);
    if (inLake(x, z)) return Math.min(-0.01, g - LAKE_Y);
    if (drawn.wat(_p.fx, _p.fz) > -0.4) return Math.min(-0.01, H(_p.fx, _p.fz));
    return g;
  }
  // what stands there: the drawn ground, or the water's surface
  const surfaceY = (x, z) => { const w = waterLevel(x, z), g = groundY(x, z); return w == null ? g : Math.max(w, g); };

  // ground cover, from her own per-vertex paint (build.js: sand / rock / snow), cream on our plot
  function landWeights(x, z) {
    if (inPlot(x, z)) return { cream: 1, meadow: 0, sand: 0, pine: 0, rock: 0 };
    toPlanet(x, z, _p);
    const c = drawn.cover(_p.fx, _p.fz), rock = Math.min(1, c.rock + c.snow), sand = Math.min(1 - rock, c.sand);
    return { cream: 0, meadow: Math.max(0, 1 - rock - sand), sand, pine: 0, rock };
  }
  const landWeightsSoft = landWeights;
  function landKind(x, z) {
    const wk = waterKind(x, z); if (wk) return wk;
    const w = landWeights(x, z); let best = 'meadow', bv = -1;
    for (const k in w) if (w[k] > bv) { bv = w[k]; best = k; }
    return best;
  }

  // ---- the flat <-> sphere wrap, in game coordinates ----
  const _v = new THREE.Vector3();
  function flatToSphere(x, y, z, out = [0, 0, 0]) {
    toPlanet(x, z, _p); mapFlat(_p.fx, y, _p.fz, _v);
    if (out.set) return out.set(_v.x, _v.y, _v.z);
    out[0] = _v.x; out[1] = _v.y; out[2] = _v.z; return out;
  }
  function sphereToFlat(X, Y, Z) {
    const r = Math.hypot(X, Y, Z), s = Math.hypot(X, Z), th = Math.atan2(s, Y), d = th * RP;
    const ux = s > 1e-12 ? X / s : 0, uz = s > 1e-12 ? Z / s : 1;
    fromPlanet(C.x + ux * d, C.z + uz * d, _g);
    return { x: _g.x, y: r - RP, z: _g.z };
  }
  function frameAt(x, z) {   // { up, east: game +x, south: game +z } as arrays (globe/geography.js shape)
    const p = flatToSphere(x, 0, z), px = flatToSphere(x + 0.25, 0, z), pz = flatToSphere(x, 0, z + 0.25);
    const n = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
    const up = n(p), e0 = n([px[0] - p[0], px[1] - p[1], px[2] - p[2]]), s0 = n([pz[0] - p[0], pz[1] - p[1], pz[2] - p[2]]);
    const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const east = n([e0[0] - up[0] * dot(e0, up), e0[1] - up[1] * dot(e0, up), e0[2] - up[2] * dot(e0, up)]);
    const south = n([s0[0] - up[0] * dot(s0, up), s0[1] - up[1] * dot(s0, up), s0[2] - up[2] * dot(s0, up)]);
    return { up, east, south };
  }

  // ---- places (x, z in game coordinates; fx, fz on her planet) ----
  const centre = { x: 0, z: 2 };
  const homeP = toPlanet(centre.x, centre.z, {});
  const nations = NATION_SITES.map(s => {
    const g = fromPlanet(s.fx, s.fz, {});
    return { ...s, x: +g.x.toFixed(1), z: +g.z.toFixed(1), y: drawn.alt(s.fx, s.fz),
      view: { dist: 70, pitch: 0.95, yaw: Math.atan2(-g.x, -g.z), fov: 50 } };
  });
  const wonderG = fromPlanet(C.x, C.z, {});
  // the camera poses (adapter.cameraLocal / descendTo take these as they are): yaw 0 = from the game's +z side
  // (inland, the tower behind the camera) looking out to sea; LEADER_YAW turns it a little so the coast runs across
  const LEADER_YAW = -0.35;
  const places = {
    home: { id: 'home', name: 'Our land', x: centre.x, z: centre.z, fx: homeP.fx, fz: homeP.fz, kind: 'home',
      view: { dist: 90, pitch: 1.0, yaw: LEADER_YAW, fov: 50 },
      // the other way round: from over the bay, the plot in front, the road and the tower's chain beyond
      towerView: { dist: 90, pitch: 1.0, yaw: Math.PI + LEADER_YAW, fov: 50 },
      landing: { x: CAMP.x, z: CAMP.z + 4.5, dist: 22, pitch: 1.3, yaw: LEADER_YAW, fov: 50 } },
    nations,
    wonder: { id: 'wonder', name: 'The Tower', x: +wonderG.x.toFixed(1), z: +wonderG.z.toFixed(1), fx: C.x, fz: C.z, kind: 'wonder',
      top: TOWER_BASE + TOWER_H, view: { dist: 150, pitch: 0.45, yaw: 0, fov: 50 } }
  };
  function placeById(id) {
    if (id === 'home' || id === 'wonder') return places[id];
    return nations.find(n => n.id === id) || null;
  }
  const GLOWS = [
    { id: 'home', x: CAMP.x, z: CAMP.z, r: 18, colour: '#ffb46e' },
    ...nations.map(n => ({ id: n.id, x: n.x, z: n.z, r: 22, colour: n.colours.wall }))
  ];
  // home-growth spots: centre outward, off the water, not on the steepest ground
  function homeSpots(n = 16) {
    const cand = [];
    const h2 = (x, z) => { let h = Math.imul(x | 0, 374761393) ^ Math.imul(z | 0, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
    for (let gz = -20; gz <= 26; gz += 7) for (let gx = -24; gx <= 24; gx += 7.5) {
      const j = h2(gx * 3 + 1, gz * 7 + 5), x = gx + (j - 0.5) * 3, z = gz + (h2(gx + 9, gz - 3) - 0.5) * 3;
      if (Math.abs(x) < 4 && Math.abs(z - 2) < 4) continue;
      let near = 1e9; for (const [lx, lz] of LAKE) near = Math.min(near, Math.hypot(x - lx, z - lz));
      if (isWater(x, z) || near < 4) continue;
      const slope = Math.abs(groundY(x + 2, z) - groundY(x - 2, z)) / 4 + Math.abs(groundY(x, z + 2) - groundY(x, z - 2)) / 4;
      cand.push({ x, z, d: Math.hypot(x, z - 2) + j * 4 + slope * 30, rot: (h2(gx, gz) - 0.5) * 0.5 });
    }
    cand.sort((a, b) => a.d - b.d);
    return cand.slice(0, n);
  }

  // the sim's water, from her terrain: game.state.water = geo.water (then re-run campSpots), see docs/planet.md
  const water = [{ kind: 'lake', poly: LAKE.map(p => [p[0], p[1]]) }, { kind: 'sea', poly: sea.map(p => [p[0], p[1]]) }];

  /* ---- the lake, drawn: a level sheet at LAKE_Y in HER ground material (her sea's own paint and foam) ---- */
  let lakeMesh = null;
  if (planet && lake && renderLake) lakeMesh = buildLakeMesh(planet, lake);

  const geo = {
    GEO: { RP, C: { x: wonderG.x, z: wonderG.z }, k: 1, seaLevel: 0, version: 'planet-1' },
    FRAME, toPlanet, fromPlanet, drawn,
    PLOT, plot: { ...PLOT }, CAMP, centre, SIM_SEA_LINE: sea, LAKE_SPOTS: lake ? [{ x: LAKE_BOX.x0 / 2 + LAKE_BOX.x1 / 2, z: LAKE_BOX.z0 / 2 + LAKE_BOX.z1 / 2 }] : [],
    lake: lake ? { poly: LAKE, level: LAKE_Y, area: lake.area, maxDepth: lake.maxDepth, box: LAKE_BOX, mesh: lakeMesh } : null,
    LAKE_Y, sea: { poly: sea, box: SEA_BOX }, water,
    homeLake: () => LAKE.map(p => [p[0], p[1]]),
    // her terrain fixes the lake: the sim's own lake is not adopted (push ours to the sim instead); returns ours
    setWater: () => LAKE, getLake: () => LAKE,
    heightAt, groundY, surfaceY, waterLevel, isWater, waterKind, landWeights, landWeightsSoft, landKind,
    inPlot, distOutsidePlot, inLake, flatToSphere, sphereToFlat, frameAt,
    places, placeById, homeSpots, GLOWS, nations, wonder: places.wonder,
    // the road and the crag (her objects): keep game things off them
    onRoad: (x, z, r = 2.2) => { toPlanet(x, z, _p); return pathDist(_p.fx, _p.fz) < r; },
    stats() {
      return { lake: lake && { level: +LAKE_Y.toFixed(3), area: +lake.area.toFixed(1), maxDepth: +lake.maxDepth.toFixed(2), points: LAKE.length, box: LAKE_BOX },
        seaPoints: sea.length, seaBox: SEA_BOX, home: homeP, nations: nations.map(n => ({ id: n.id, x: n.x, z: n.z, fx: n.fx, fz: n.fz, y: +n.y.toFixed(1) })),
        wonder: { x: places.wonder.x, z: places.wonder.z } };
    }
  };
  return geo;
}

// a level water sheet over the lake's hollow (grid in planet flat, kept where the ground is near or under the level)
function buildLakeMesh(planet, lake) {
  const { level: L, grid } = lake, { fx0, fz0, st, n, alt, mask } = grid;
  // the sheet covers the flooded hollow plus a thin lip (<= `lip` cells) round it, nothing else: other low spots
  // within the box used to show as stray foam squares, and the box's edge as a straight foam cut (polish 2026-10-04)
  const lip = 4, near = new Uint8Array(n * n);
  {
    const dist = new Int16Array(n * n).fill(-1), q = new Int32Array(n * n); let qh = 0, qt = 0;
    for (let c = 0; c < n * n; c++) if (mask[c]) { dist[c] = 0; q[qt++] = c; }
    while (qh < qt) {
      const c = q[qh++], i = c % n; near[c] = 1;
      if (dist[c] >= lip) continue;
      for (const d of [c - 1, c + 1, c - n, c + n]) {
        if (d < 0 || d >= n * n || dist[d] >= 0 || Math.abs((d % n) - i) > 1) continue;
        dist[d] = dist[c] + 1; q[qt++] = d;
      }
    }
  }
  let i0 = n, i1 = 0, j0 = n, j1 = 0;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) if (mask[j * n + i]) { i0 = Math.min(i0, i); i1 = Math.max(i1, i); j0 = Math.min(j0, j); j1 = Math.max(j1, j); }
  const pad = 6; i0 = Math.max(0, i0 - pad); j0 = Math.max(0, j0 - pad); i1 = Math.min(n - 1, i1 + pad); j1 = Math.min(n - 1, j1 + pad);
  const step = 2, cols = Math.floor((i1 - i0) / step) + 1, rows = Math.floor((j1 - j0) / step) + 1;
  const pos = [], nor = [], aW = [], aG = [], aRS = [], colr = [], idx = [], keep = [];
  const v = new THREE.Vector3();
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const i = i0 + c * step, j = j0 + r * step, fx = fx0 + i * st, fz = fz0 + j * st, a = alt[j * n + i];
    // a vertex over dry ground dives just under it, so the shore is where the sheet meets the ground (no level sheet
    // poking through a 1-2 cm dry rise as a stray foam square; polish 2026-10-04)
    mapFlat(fx, a > L ? a - 0.2 : L, fz, v); pos.push(v.x, v.y, v.z); v.normalize(); nor.push(v.x, v.y, v.z);
    // her sea shader paints by depth: a foam lip at the waterline, shallow teal over the hollow
    aW.push(Math.max(0, Math.min(3.2, (L - a) * 8))); aG.push(0); aRS.push(0, 0); colr.push(0, 0, 0);   // x8 (was 4.5): her foam is aW < 0.9, a ~10 cm lip instead of half the 0.44 m-deep lake
    keep.push(!!near[j * n + i] && a < L + 0.25);
  }
  for (let r = 0; r < rows - 1; r++) for (let c = 0; c < cols - 1; c++) {
    const a = r * cols + c, b = a + 1, d = a + cols, e = d + 1;
    if (!(keep[a] || keep[b] || keep[d] || keep[e])) continue;
    idx.push(a, d, b, b, d, e);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colr, 3));
  g.setAttribute('aW', new THREE.Float32BufferAttribute(aW, 1));
  g.setAttribute('aG', new THREE.Float32BufferAttribute(aG, 1));
  g.setAttribute('aRS', new THREE.Float32BufferAttribute(aRS, 2));
  g.setIndex(idx); g.computeBoundingSphere();
  // keep the triangle winding facing out (toward +radial)
  const m = new THREE.Mesh(g, planet.world.ground.material);
  m.name = 'home-lake'; m.receiveShadow = true; m.userData.planetWorld = true;
  planet.surface.add(m);
  return m;
}
