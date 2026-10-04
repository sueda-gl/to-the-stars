// SUPERSEDED (2026-10-04): the shared designed landform lives in globe/landform.js (via geography.js LANDFORM); this module is unused.
// The map's relief: ONE pure height function (no THREE, no DOM, no rnd stream), sampled by world/ground.js for the
// gouache map and importable by the globe (globe/terrain.js) so both draw the same hills:
//
//   import { createRelief } from '../world/relief.js';
//   const R = createRelief(geography, { seaY: 0 });     // the globe's sea is 0, the map's is -0.9
//   R.height(x, z)   ground height (water < seaY), R.shore(x, z) signed coast field (~ m to the coast, + land)
//   R.forest(x, z)   0..1 how much a point is woodland (the woods stand there, the ground under them is olive)
//
// It is the layout's bones (globe/geography.js heightAt / landField, read-only) plus what a relief map seen from
// above needs (ART_DIRECTION §1, mb 1). All of it is map-side and documented in docs/world.md:
//   - a ragged coast in front of our plot: the layout keeps the sim's sea line ruler-straight along the plot, so
//     the map pushes LAND out into the bay there (never water into the plot): a rocky point, a sandy spit, coves
//     between them and three sea stacks, so the shore no longer draws the plot's edge;
//   - our plot's own landform: a coastal plain rising gently inland (0.5 -> ~4 m), a low hill and a knoll at the
//     back, a swell by the east shore and a shallow dry valley draining to the beach; the lake sits in a smooth
//     bowl (the bank meets the water at the polygon, so there is no fringe or double rim);
//   - the land round the plot is read through a smooth +-7 m warp, so the plain's edge wanders;
//   - grandeur away from the plot: the layout's hills and mountains are raised (x1 near the plot -> x2.2 at the
//     map's edges, more to the east, whose shadows fall away from the plot), and carved with a domain-warped
//     ridged multifractal (knife ridges, spurs and gullies, a third of the height on the mountains) that catches
//     the raking light; headland and island cliffs are raised with them;
//   - the river meanders in its valley (biased away from the plot) and opens into an estuary at the bay.

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const g2 = (x, z, cx, cz, rx, rz) => Math.exp(-(((x - cx) / rx) ** 2 + ((z - cz) / rz) ** 2));

function pointInPoly(x, z, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i], [xj, zj] = poly[j];
    if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}
function distToPoly(x, z, poly) {
  let best = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [ax, az] = poly[j], [bx, bz] = poly[i], dx = bx - ax, dz = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)));
    best = Math.min(best, Math.hypot(ax + dx * t - x, az + dz * t - z));
  }
  return best;
}
function segDist(x, z, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az; let t = ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz); t = t < 0 ? 0 : t > 1 ? 1 : t;
  return Math.hypot(ax + dx * t - x, az + dz * t - z);
}

// sea stacks off our beach [x, z, radius, height]
export const STACKS = [[-23, -38.5, 2.3, 4.2], [7, -41.5, 1.6, 3.0], [29, -39, 2.1, 3.6], [-15.5, -41, 1.1, 2.2]];
// the dry valley across the plot (a polyline, back to beach)
const VALLEY = [[7, 34], [3, 20], [-3, 6], [-5, -8], [-3, -24]];

export function createRelief(geo, { seaY = -0.9, lake = null } = {}) {
  const { GEO, PLOT, heightAt, landField, landWeights, fbm2, vnoise2, distOutsidePlot } = geo;
  const C = GEO.C;
  const riverDist = geo.riverDist || (() => ({ d: 1e9, t: 1 }));
  const riverWidth = geo.riverWidth || (() => 2);
  const nations = (geo.places && geo.places.nations) || [];
  const sites = [...nations.map(n => ({ x: n.x, z: n.z, r: n.r || 15 })), ...(geo.places && geo.places.wonder ? [{ x: geo.places.wonder.x, z: geo.places.wonder.z, r: 10 }] : [])];
  const inPlotRect = (x, z) => x >= PLOT.x0 && x <= PLOT.x1 && z >= PLOT.z0 && z <= PLOT.z1;

  // ---------- the lake (the sim's polygon): signed distance, < 0 inside ----------
  let lakePoly = null, lakeBox = null;
  function setLake(poly) {
    lakePoly = poly && poly.length > 2 ? poly : null;
    lakeBox = lakePoly ? lakePoly.reduce((b, [x, z]) => ({ x0: Math.min(b.x0, x), x1: Math.max(b.x1, x), z0: Math.min(b.z0, z), z1: Math.max(b.z1, z) }), { x0: 1e9, x1: -1e9, z0: 1e9, z1: -1e9 }) : null;
  }
  setLake(lake || (geo.getLake ? geo.getLake() : null));
  const inLake = (x, z) => !!lakePoly && x >= lakeBox.x0 && x <= lakeBox.x1 && z >= lakeBox.z0 && z <= lakeBox.z1 && pointInPoly(x, z, lakePoly);
  function lakeSD(x, z) {
    if (!lakePoly) return 1e9;
    if (x < lakeBox.x0 - 14 || x > lakeBox.x1 + 14 || z < lakeBox.z0 - 14 || z > lakeBox.z1 + 14) return 1e9;
    const d = distToPoly(x, z, lakePoly);
    return inLake(x, z) ? -d : d;
  }

  // ---------- the coast ----------
  // how far (m) the map pushes the shore out into the bay at x, in front of our plot (0 past |x| ~ 50)
  function coastBulge(x) {
    const ex = 1 - smooth(30, 52, Math.abs(x));
    if (ex <= 0) return 0;
    let b = (fbm2(x / 15 + 7.3, 0.37, 3) - 0.4) * 10;                 // coves and bays, -4 .. +6
    b += 9.5 * Math.exp(-(((x + 12) / 4.6) ** 2));                   // the rocky point
    b += 6.0 * Math.exp(-(((x - 19) / 7.5) ** 2));                   // the sandy spit, broad and round
    b += 2.5 * Math.exp(-(((x + 30) / 6) ** 2));                     // rounds the corner at the river mouth
    return Math.max(0, b) * ex;
  }
  // signed land field (~ m to the coast, + land), tapered to open sea at the map's edge
  function shore(x, z) {
    let s = landField(x, z);
    if (z < PLOT.z0 + 34) {
      const b = coastBulge(x);
      if (b > 0) s += b * (1 - smooth(PLOT.z0 + 6, PLOT.z0 + 34, z));
    }
    for (const [cx, cz, r] of STACKS) s = Math.max(s, r - Math.hypot(x - cx, z - cz));
    const d = Math.hypot(x - C.x, z - C.z);
    if (d > 160) s = lerp(s, -10, smooth(160, 200, d));
    return inPlotRect(x, z) ? Math.max(s, 0.01) : s;
  }

  // ---------- our plot's landform (m): buildable, rolling, a plain rising inland from the beach ----------
  function plotRelief(x, z, s) {
    let r = 0.5 + 3.0 * smooth(PLOT.z0 - 2, PLOT.z1 + 12, z);                  // the plain rises inland
    r += 3.8 * g2(x, z, 13, 20, 14, 11);                                       // a low hill, back right
    r += 2.4 * g2(x, z, -20, 19, 10, 9);                                       // a knoll, back left
    r += 1.5 * g2(x, z, 23, -9, 7, 8);                                         // a swell by the east shore
    r += 1.1 * g2(x, z, -22, -14, 8, 7);                                       // and one by the river
    let vd = 1e9; for (let i = 0; i + 1 < VALLEY.length; i++) vd = Math.min(vd, segDist(x, z, VALLEY[i][0], VALLEY[i][1], VALLEY[i + 1][0], VALLEY[i + 1][1]));
    r -= 1.3 * (1 - smooth(0, 7, vd)) * smooth(PLOT.z0, PLOT.z0 + 12, z);       // a shallow dry valley to the beach
    r += (fbm2(x / 19 + 31.7, z / 19 - 12.2, 3) - 0.5) * 2.4;                    // broad rolling ground
    r = Math.max(0.05, r);
    const ld = lakeSD(x, z);
    r *= smooth(0.6, 10, ld);                                                  // a level bank round the lake
    r *= smooth(1.2, 12, s);                                                   // down to the beach
    return r;
  }

  // ---------- carving: a domain-warped ridged multifractal (knife ridges, spurs, gullies), ~0 .. 0.75 ----------
  function erosion(x, z) {
    const wx = x + (fbm2(x / 45 + 1.3, z / 45 + 7.7, 2) - 0.5) * 38, wz = z + (fbm2(x / 45 - 6.1, z / 45 + 2.9, 2) - 0.5) * 38;
    let sum = 0, amp = 1, f = 1 / 28, w = 1, norm = 0;
    for (let o = 0; o < 5; o++) {
      let n = 1 - Math.abs(2 * vnoise2(wx * f + o * 7.1, wz * f - o * 3.7) - 1);
      n *= n;
      sum += n * amp * w; norm += amp;
      w = Math.min(1, n * 1.9);
      amp *= 0.5; f *= 2.07;
    }
    return sum / norm;
  }
  // how much the layout's relief is raised: 1 near the plot, up to ~2.2 toward the edges (more to the east,
  // whose shadows fall away from the plot; less on the west bank, whose shadows would fall on it)
  function gain(x, z, dp) {
    return 1 + 1.0 * smooth(26, 95, dp) + 0.5 * smooth(40, 90, x) * smooth(10, 40, dp) - 0.25 * smooth(-40, -80, x) * (1 - smooth(60, 110, dp));
  }

  // the river: a meander inside the layout's valley, biased away from the plot near it, and an estuary
  function riverAt(x, z) {
    const near = 1 - smooth(34, 60, z);
    let off = 1.6 + 4.6 * Math.sin(z * 0.07 + 0.6) + 1.8 * Math.sin(z * 0.19 + 2.0);
    if (near > 0) off = lerp(off, Math.max(off, -1.8) + 0.8, near);          // never toward the plot
    const rv = riverDist(x + off, z);
    let w = riverWidth(rv.t);
    w *= 1 + 1.6 * (1 - smooth(0, 0.11, rv.t));                              // the estuary
    return { d: rv.d, w, t: rv.t };
  }

  // ---------- the height ----------
  function height(x, z) {
    const s = shore(x, z);
    // under the sea the bed drops away fast (the map's sea plane must win the depth test from 400 m up)
    if (s <= 0) return Math.max(seaY - 14, seaY - 0.25 + 3.2 * s);
    const dp = distOutsidePlot(x, z);
    // the layout's bones, read through a smooth +-7 m warp round the plot so the plain's edge wanders
    let hx = x, hz = z;
    const wob = 1 - smooth(12, 34, dp);
    if (wob > 0) { hx += (fbm2(x / 23 + 5.5, z / 23 - 1.7, 3) - 0.5) * 24 * wob; hz += (fbm2(x / 23 - 8.1, z / 23 + 3.3, 3) - 0.5) * 24 * wob; }
    let h = inPlotRect(hx, hz) ? 0 : heightAt(hx, hz);
    if (h < 0) h = 0.12;                                                       // layout water: carved below
    if (wob > 0) h *= smooth(0, 7, distOutsidePlot(hx, hz)) * 0.9 + 0.1;       // no crease at the plot's edge
    h *= gain(x, z, dp);
    // carving: knife ridges and gullies on the hills and mountains, never near the plot, the coast or a town
    let amp = smooth(1.5, 10, h) * (1.6 + 0.3 * Math.min(h, 110)) * smooth(2.5, 9, s) * smooth(6, 22, dp);
    for (const st of sites) if (amp > 0) amp *= smooth(st.r + 2, st.r + 14, Math.hypot(x - st.x, z - st.z));
    if (amp > 1e-3) h += amp * (erosion(x, z) - 0.24) * 1.7;
    // coastal rock: the point and the stacks stand up out of the water
    const pz = 1 - smooth(PLOT.z0 - 6, PLOT.z0 + 4, z);
    if (pz > 0) h += 3.2 * Math.exp(-(((x + 12) / 4.2) ** 2)) * smooth(0.4, 4, s) * pz;
    for (const [cx, cz, r, sh] of STACKS) { const d = Math.hypot(x - cx, z - cz); if (d < r + 1) h += sh * smooth(r, r * 0.35, d); }
    // our plot's landform, eased out ~18 m past its edge into the land round it
    const pw = 1 - smooth(0, 18, dp);
    if (pw > 0) h += plotRelief(x, z, s) * pw;
    let y = lerp(seaY + 1.2 * s, Math.max(h, 0.12), smooth(0, 3, s));
    // the lake: a smooth bowl; the bank meets the water (y ~ 0.03) right at the polygon
    const ld = lakeSD(x, z);
    if (ld < 1.2) {
      const bank = 0.1 + 0.25 * smooth(0, 1.2, ld);
      y = ld >= 0 ? Math.min(y, lerp(bank, y, smooth(0, 1.2, ld))) : -0.05 - 2.3 * smooth(0, 3.2, -ld);
    }
    // the river: water between its banks shows the sea plane, so its bed is carved under it
    if (!inPlotRect(x, z)) {
      const rv = riverAt(x, z);
      if (rv.d < rv.w + 6) {
        const bed = lerp(seaY - 0.9, y, smooth(rv.w * 0.55, rv.w + 1.6, rv.d));
        y = Math.min(y, bed);
      }
    }
    return y;
  }

  // ---------- woodland: where the woods stand (the layout's forest land, in patches) ----------
  function forest(x, z) {
    const s = shore(x, z); if (s < 2.2) return 0;
    const dp = distOutsidePlot(x, z) + (fbm2(x / 17 + 9.1, z / 17 - 3.3, 2) - 0.5) * 16;
    if (dp < 3) return 0;
    for (const n of nations) if (Math.hypot(x - n.x, z - n.z) < (n.r || 15) + 5) return 0;
    const w = landWeights(x, z);
    if ((w.rock || 0) > 0.55) return 0;
    const patch = fbm2(x / 13 + 2.2, z / 13 - 6.1, 3);
    return smooth(0.25, 0.55, w.pine) * smooth(0.36, 0.52, patch + w.pine * 0.25) * smooth(3, 8, dp) * smooth(2.2, 5, s);
  }

  return { height, shore, forest, plotRelief, erosion, coastBulge, riverAt, lakeSD, inLake, setLake, inPlotRect, seaY };
}
