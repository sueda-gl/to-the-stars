// Trees for AGORA, painted in the Red arch grammar, made to read from the leader's bird's-eye view AND at eye level.
// ONE module for every tree in the game (reference/moodboard/9-trees-PROBLEM.png is what it replaces):
//
//   createTreeBuilders(base)          -> { tree, olive, oak, lemon, pine, cypress, roundTree, shrub, grove }
//        what api.js imports today (base = the build api's own primitives), so api.tree / api.pine / api.olive /
//        api.oak / api.lemon are these trees with no change to api.js. Same options as before (h, r, s, lean as a
//        fraction of r, leanTo [dx, dz], ramp, trunk, fruit, lumps, x, y, z, rot). api.cypress / api.bush (the kit's
//        eye-level Red arch cypress and flowering bush) are not touched, so the Assembly keeps its set piece.
//   createTrees(ctx, kit, { seed })   -> { umbrellaPine, cypress, olive, roundTree, shrub, grove, RAMPS }
//        the same trees outside the build api (labs, scenery), metres, ground y = 0 at the trunk base.
//
// How a crown is painted (and why it reads from above):
//   - a crown is a VOLUME: a few merged lumpy lobes. Their painted normals are pulled toward one rounded envelope
//     (the whole crown is lit as one dome from the upper left), bent down in the crevices where lobes meet (each
//     lobe keeps its own lit cap) and bent down underneath (painted occlusion: the dark underbelly);
//   - then the surface is cut into PATCHES (a Voronoi of the crown's own surface) and every patch takes one flat
//     painted normal, nudged up or down at random: flat, crisp light/dark value patches like the Red arch's gouache
//     dabs, not a smooth clay gradient. The nudge is vertical, so it survives finish()'s re-bake after any rotation;
//   - ONE invisible proxy per crown: a hull shrink-wrapped to the crown's real vertices (binned on a sphere grid
//     round the crown centre, dilated, smoothed, never inside the paint), so the pencil draws the outer silhouette
//     only: no ring per lobe, no halo, no strokes across the crown;
//   - trunks are tapered tubes with a root flare that start in the ground and end INSIDE the crown; colour-only;
//   - everything of one ramp is merged per tree (and per grove): a tree is 2-3 painted meshes + 1 proxy.
// Tags follow api.js: painted meshes carry userData.agora = { part, ramp, speck, lift } and agoraColour (colour
// only); proxies carry { part: 'proxy' } and agoraLine (invisible, line only).

export const TREE_RAMPS = Object.freeze({
  PINE: Object.freeze(['#1d2810', '#43541c', '#788b2e', '#b2b24f', '#e3d978']),            // kit.PALETTES.PINE, a touch deeper
  OLIVE: Object.freeze(['#1c2721', '#36483a', '#59704f', '#88a06b', '#bcc787']),           // silver-sage, a warm lit top
  OAK: Object.freeze(['#18240f', '#2c4318', '#4a6827', '#77923b', '#b0bb5e']),
  CYPRESS: Object.freeze(['#0d1409', '#1d2a12', '#33451f', '#5d6d34', '#929a54']),         // kit CYP
  ROUND: Object.freeze(['#192914', '#30501f', '#537a2b', '#89a443', '#c9cd6b']),           // a fresh broadleaf (lemon, orange)
  LEAF: Object.freeze(['#16220f', '#2e4219', '#4f6a2c', '#7f9a46', '#b0bd68']),            // kit LEAF + a lit stop
  TRUNK: Object.freeze(['#1a130e', '#2f241b', '#4a3a2c', '#665140', '#806a55']),
  OLIVE_BARK: Object.freeze(['#231d19', '#3d342c', '#5a4e42', '#76695a', '#8f8270']),
  PINK: Object.freeze(['#5a1530', '#a83863', '#e0779a', '#f6b6c6']),                       // kit PINK (blossom)
  RED: Object.freeze(['#4e1210', '#a62c26', '#e0603f', '#f4a07c']),                        // kit RED
  LEMON: Object.freeze(['#8a5414', '#c08519', '#e5ac22', '#f2c42a', '#f8d84e']),
  ORANGE: Object.freeze(['#8a3a10', '#b85a16', '#dd7a1e', '#ee9633', '#f5ad4e'])
});

const num = (v, d) => (typeof v === 'number' && isFinite(v) ? v : d);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const mulberry32 = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };

// ======================================================================================================
// the engine. env = { paint(geo, ramp, speck, lift, part) -> painted colour-only Mesh, proxy(geo) -> line-only
// Mesh, rand() -> [0, 1), ramp(name|hex|array, fallback) -> ramp }
// ======================================================================================================
function createEngine(env) {
  let rand = env.rand;
  const R = (a, b) => a + (b - a) * rand();
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const rampOf = (r, d) => env.ramp(r, d);

  // ---------- geometry helpers ----------
  function indexed(g) {
    if (!g.index) { const n = g.attributes.position.count, a = new (n > 65535 ? Uint32Array : Uint16Array)(n); for (let i = 0; i < n; i++) a[i] = i; g.setIndex(new THREE.BufferAttribute(a, 1)); }
    return g;
  }
  function merge(geos) {   // position + normal (+ index) of many geometries into one
    let nv = 0, ni = 0;
    geos.forEach(g => { indexed(g); nv += g.attributes.position.count; ni += g.index.count; });
    const pos = new Float32Array(nv * 3), nrm = new Float32Array(nv * 3), idx = new (nv > 65535 ? Uint32Array : Uint16Array)(ni);
    let ov = 0, oi = 0;
    geos.forEach(g => {
      const p = g.attributes.position, n = g.attributes.normal, ix = g.index;
      pos.set(p.array.subarray(0, p.count * 3), ov * 3); nrm.set(n.array.subarray(0, n.count * 3), ov * 3);
      for (let i = 0; i < ix.count; i++) idx[oi + i] = ix.getX(i) + ov;
      ov += p.count; oi += ix.count;
    });
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
    out.setIndex(new THREE.BufferAttribute(idx, 1)); out.computeBoundingSphere();
    return out;
  }
  const lumpK = (l, x, y, z) => 1 + l.lump * (Math.sin(x * 3.3 + l.ph[0]) * Math.sin(y * 3.9 + l.ph[1]) * Math.sin(z * 3.1 + l.ph[2]) + 0.45 * Math.sin(x * 7.3 + z * 6.1 + l.ph[1]) * Math.sin(y * 5.7 + l.ph[0]));
  function lobe(l, lump = 0.12, seg = 22) {   // a lumpy ellipsoid
    const g = new THREE.SphereGeometry(1, seg, Math.max(7, Math.round(seg * 0.62)));
    const p = g.attributes.position, c = l.c, s = l.s;
    l.lump = lump; l.ph = [R(0, 10), R(0, 10), R(0, 10)];
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i), k = lumpK(l, x, y, z);
      p.setXYZ(i, c.x + x * k * s.x, c.y + y * k * s.y, c.z + z * k * s.z);
    }
    g.computeVertexNormals();
    return g;
  }
  // a tapered tube along points: root flare at the base, a little bark wobble, open ends (hidden in the ground
  // and inside the crown)
  function limb(pts, r0, r1, { radial = 9, flare = 0.0, wob = 0.07 } = {}) {
    const curve = new THREE.CatmullRomCurve3(pts), len = curve.getLength();
    const n = Math.max(3, Math.min(16, Math.round(len / 0.45)));
    const fr = curve.computeFrenetFrames(n, false), pos = [], idx = [], P = V(0, 0, 0), ph = R(0, 6.28);
    for (let i = 0; i <= n; i++) {
      const t = i / n; curve.getPointAt(t, P);
      const r = (r0 + (r1 - r0) * Math.pow(t, 0.85)) * (1 + flare * Math.pow(1 - t, 5));
      const N = fr.normals[i], B = fr.binormals[i];
      for (let j = 0; j <= radial; j++) {
        const a = j / radial * Math.PI * 2, w = 1 + wob * Math.sin(a * 3 + i * 1.7 + ph);
        const ca = Math.cos(a) * r * w, sa = Math.sin(a) * r * w;
        pos.push(P.x + N.x * ca + B.x * sa, P.y + N.y * ca + B.y * sa, P.z + N.z * ca + B.z * sa);
      }
    }
    for (let i = 0; i < n; i++) for (let j = 0; j < radial; j++) {
      const a = i * (radial + 1) + j, b = a + radial + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    return g;
  }
  function farHit(o, d, c, s) {   // far hit of a ray (o + t d) on an ellipsoid; -1 if it misses
    const ox = (o.x - c.x) / s.x, oy = (o.y - c.y) / s.y, oz = (o.z - c.z) / s.z, dx = d.x / s.x, dy = d.y / s.y, dz = d.z / s.z;
    const a = dx * dx + dy * dy + dz * dz, b = ox * dx + oy * dy + oz * dz, cc = ox * ox + oy * oy + oz * oz - 1;
    const disc = b * b - a * cc; if (disc < 0) return -1;
    const t = (-b + Math.sqrt(disc)) / a; return t > 0 ? t : -1;
  }

  // ---------- PATCHES: flat, crisp value patches (the Red arch's gouache dabs) ----------
  // The surface is cut into Voronoi cells of about `size` metres (seeds drawn by area; `sy` < 1 stretches the
  // cells vertically, the cypress's flame dabs). Every cell takes the area-weighted mean of its painted normals,
  // then a random vertical nudge of +-dapple (two values: a lit dab or a dark dab), so after kit.bake each patch
  // is one flat value. Returns a non-indexed geometry.
  function patchify(geo, size, dapple, sy = 1) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    const p = g.attributes.position, n = g.attributes.normal, T = p.count / 3;
    const cx = new Float32Array(T), cy = new Float32Array(T), cz = new Float32Array(T), cum = new Float64Array(T);
    const A = V(0, 0, 0), B = V(0, 0, 0), C = V(0, 0, 0);
    let tot = 0;
    const pa = p.array;
    for (let t = 0; t < T; t++) {
      const o = 9 * t; A.set(pa[o], pa[o + 1], pa[o + 2]); B.set(pa[o + 3], pa[o + 4], pa[o + 5]); C.set(pa[o + 6], pa[o + 7], pa[o + 8]);
      cx[t] = (A.x + B.x + C.x) / 3; cy[t] = (A.y + B.y + C.y) / 3; cz[t] = (A.z + B.z + C.z) / 3;
      B.sub(A); C.sub(A); tot += 0.5 * B.cross(C).length(); cum[t] = tot;
    }
    const N = clamp(Math.round(tot / (size * size)), 3, 700), sx = new Float32Array(N), sY = new Float32Array(N), sz = new Float32Array(N);
    for (let k = 0; k < N; k++) {   // seeds by area
      const x = rand() * tot; let lo = 0, hi = T - 1;
      while (lo < hi) { const m = (lo + hi) >> 1; if (cum[m] < x) lo = m + 1; else hi = m; }
      sx[k] = cx[lo]; sY[k] = cy[lo] * sy; sz[k] = cz[lo];
    }
    const cell = new Int32Array(T), acc = new Float32Array(N * 3), wsum = new Float32Array(N);
    // nearest seed through a uniform grid of the seeds (cell = 1.5 patch sizes, counting-sorted into typed arrays;
    // the 27 neighbouring cells, brute force if they are all empty)
    const G = size * 1.5;
    let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
    for (let t = 0; t < T; t++) { const y = cy[t] * sy; if (cx[t] < x0) x0 = cx[t]; if (cx[t] > x1) x1 = cx[t]; if (y < y0) y0 = y; if (y > y1) y1 = y; if (cz[t] < z0) z0 = cz[t]; if (cz[t] > z1) z1 = cz[t]; }
    const nx = Math.max(1, Math.ceil((x1 - x0) / G) + 1), ny = Math.max(1, Math.ceil((y1 - y0) / G) + 1), nz = Math.max(1, Math.ceil((z1 - z0) / G) + 1);
    const cellOf = (x, y, z) => { const i = clamp(Math.floor((x - x0) / G), 0, nx - 1), j = clamp(Math.floor((y - y0) / G), 0, ny - 1), k = clamp(Math.floor((z - z0) / G), 0, nz - 1); return i + nx * (j + ny * k); };
    const start = new Int32Array(nx * ny * nz + 1), order = new Int32Array(N), sc = new Int32Array(N);
    const assign = () => {
      start.fill(0);
      for (let k = 0; k < N; k++) { sc[k] = cellOf(sx[k], sY[k], sz[k]); start[sc[k] + 1]++; }
      for (let c = 0; c < nx * ny * nz; c++) start[c + 1] += start[c];
      const fillp = start.slice(0, -1); for (let k = 0; k < N; k++) order[fillp[sc[k]]++] = k;
      for (let t = 0; t < T; t++) {
        let best = -1, bd = Infinity; const x = cx[t], y = cy[t] * sy, z = cz[t];
        const i0 = clamp(Math.floor((x - x0) / G), 0, nx - 1), j0 = clamp(Math.floor((y - y0) / G), 0, ny - 1), k0 = clamp(Math.floor((z - z0) / G), 0, nz - 1);
        for (let k = Math.max(0, k0 - 1); k <= Math.min(nz - 1, k0 + 1); k++) for (let j = Math.max(0, j0 - 1); j <= Math.min(ny - 1, j0 + 1); j++) for (let i = Math.max(0, i0 - 1); i <= Math.min(nx - 1, i0 + 1); i++) {
          const c = i + nx * (j + ny * k);
          for (let q = start[c]; q < start[c + 1]; q++) { const s2 = order[q], dx = x - sx[s2], dy = y - sY[s2], dz = z - sz[s2], d = dx * dx + dy * dy + dz * dz; if (d < bd) { bd = d; best = s2; } }
        }
        if (best < 0 || bd > G * G) for (let k = 0; k < N; k++) { const dx = x - sx[k], dy = y - sY[k], dz = z - sz[k], d = dx * dx + dy * dy + dz * dz; if (d < bd) { bd = d; best = k; } }
        cell[t] = best;
      }
    };
    assign();
    // one Lloyd step: every seed moves to the centre of its cell, so the cells even out (no slivers that the
    // Kuwahara pass would turn into stray little strokes)
    acc.fill(0);
    for (let t = 0; t < T; t++) { const k = cell[t], w = cum[t] - (t ? cum[t - 1] : 0); acc[k * 3] += cx[t] * w; acc[k * 3 + 1] += cy[t] * w; acc[k * 3 + 2] += cz[t] * w; wsum[k] += w; }
    for (let k = 0; k < N; k++) if (wsum[k] > 0) { sx[k] = acc[k * 3] / wsum[k]; sY[k] = acc[k * 3 + 1] / wsum[k] * sy; sz[k] = acc[k * 3 + 2] / wsum[k]; }
    assign(); acc.fill(0);
    const na = n.array;
    for (let t = 0; t < T; t++) {
      const best = cell[t], w = cum[t] - (t ? cum[t - 1] : 0), o = 9 * t;
      acc[best * 3] += (na[o] + na[o + 3] + na[o + 6]) * w; acc[best * 3 + 1] += (na[o + 1] + na[o + 4] + na[o + 7]) * w; acc[best * 3 + 2] += (na[o + 2] + na[o + 5] + na[o + 8]) * w;
    }
    const M = V(0, 0, 0), out = new Float32Array(N * 3);
    for (let k = 0; k < N; k++) {
      M.set(acc[k * 3], acc[k * 3 + 1], acc[k * 3 + 2]); if (M.lengthSq() < 1e-12) M.set(0, 1, 0);
      // a lit dab or a dark dab; on the sunlit top a dark dab is rarer and softer (no dark specks on the lemon cap)
      M.normalize(); const dn = rand() < (M.y > 0.6 ? 0.3 : 0.5); M.y += (dn ? -(M.y > 0.6 ? 0.5 : 1) : 1) * dapple * R(0.45, 1); M.normalize();
      out[k * 3] = M.x; out[k * 3 + 1] = M.y; out[k * 3 + 2] = M.z;
    }
    for (let t = 0; t < T; t++) { const k = cell[t] * 3, o = 9 * t; for (let j = 0; j < 9; j += 3) { na[o + j] = out[k]; na[o + j + 1] = out[k + 1]; na[o + j + 2] = out[k + 2]; } }
    n.needsUpdate = true;
    return g;
  }

  // ---------- crowns ----------
  // A crown = lobes [{ c, s }] round centre C with extent E, built into ONE geometry with painted normals.
  function crownGeo(C, E, lobes, { lump = 0.12, seg = 22, unify = 0.55, ao = 0.9, crevice = 0.5, round = 1.25, flatTop = null } = {}) {
    const geos = lobes.map(l => lobe(l, lump, seg));
    const owner = []; geos.forEach((g, k) => { for (let i = 0; i < g.attributes.position.count; i++) owner.push(k); });
    const g = merge(geos), p = g.attributes.position, n = g.attributes.normal;
    // the painted envelope is rounder than the crown (a dome, never a plate): from above the top turns from
    // lit (upper left) to deep (lower right) instead of reading as one flat pale disc
    const ex = E.x, ey = Math.max(E.y, E.x * round), ez = E.z, yb = C.y - E.y, yt = C.y + E.y, Q = V(0, 0, 0), M = V(0, 0, 0);
    for (let i = 0; i < p.count; i++) {
      let y = p.getY(i); const x = p.getX(i), z = p.getZ(i);
      let cr = 0;   // crevice: how deep this vertex sits inside a neighbouring lobe
      if (crevice > 0) lobes.forEach((l, k) => {
        if (k === owner[i]) return;
        const dx = (x - l.c.x) / l.s.x, dy = (y - l.c.y) / l.s.y, dz = (z - l.c.z) / l.s.z;
        cr = Math.max(cr, sstep(1.25, 0.9, Math.sqrt(dx * dx + dy * dy + dz * dz)));
      });
      if (flatTop !== null && y > flatTop) { y = flatTop + (y - flatTop) * 0.3; p.setY(i, y); }   // the umbrella pine's flat top
      Q.set((x - C.x) / (ex * ex), (y - C.y + ey - E.y) / (ey * ey), (z - C.z) / (ez * ez)).normalize();
      M.set(n.getX(i), n.getY(i), n.getZ(i)).lerp(Q, unify);
      const h = clamp((y - yb) / (yt - yb), 0, 1);
      M.y -= ao * Math.pow(1 - h, 1.7) + crevice * cr;   // occlusion: underside, heart and crevices go deep
      M.normalize(); n.setXYZ(i, M.x, M.y, M.z);
    }
    p.needsUpdate = true; g.computeBoundingSphere();
    return g;
  }
  // the crown's ONE keyline proxy, shrink-wrapped to the crown's real surface. Working in the crown's own
  // normalised space (divided by its half-extents, so a wide flat pine canopy is a round ball there), every vertex
  // and triangle centre is binned by its direction from the crown centre on a sphere grid (the farthest wins),
  // empty bins are filled from their neighbours and the radii are smoothed, never below what was binned. So the
  // pencil draws the crown's outer silhouette (its big scallops) close to the paint: no ring per lobe, no halo,
  // no fold across the crown.
  function hullGeo(C, geo, { seg = 40, smooth = 3, pad = 1.01 } = {}) {
    const H = Math.round(seg * 0.55), g = new THREE.SphereGeometry(1, seg, H), sp = g.attributes.position, W = seg + 1, NN = (H + 1) * W;
    const raw = new Float32Array(NN), p = geo.attributes.position, TAU = Math.PI * 2;
    let ex = 1e-3, ey = 1e-3, ez = 1e-3;   // half-extents round C
    for (let i = 0; i < p.count; i++) { ex = Math.max(ex, Math.abs(p.getX(i) - C.x)); ey = Math.max(ey, Math.abs(p.getY(i) - C.y)); ez = Math.max(ez, Math.abs(p.getZ(i) - C.z)); }
    const bin = (x, y, z) => {
      const dx = (x - C.x) / ex, dy = (y - C.y) / ey, dz = (z - C.z) / ez, d = Math.sqrt(dx * dx + dy * dy + dz * dz); if (d < 1e-5) return;
      const iy = Math.round(Math.acos(clamp(dy / d, -1, 1)) / Math.PI * H);
      let u = Math.atan2(dz, -dx) / TAU; if (u < 0) u += 1;
      const k = iy * W + Math.round(u * seg) % seg; if (d > raw[k]) raw[k] = d;
    };
    for (let i = 0; i < p.count; i++) bin(p.getX(i), p.getY(i), p.getZ(i));
    const ix = geo.index;
    if (ix) for (let t = 0; t < ix.count; t += 3) {
      const a = ix.getX(t), b = ix.getX(t + 1), c = ix.getX(t + 2);
      bin((p.getX(a) + p.getX(b) + p.getX(c)) / 3, (p.getY(a) + p.getY(b) + p.getY(c)) / 3, (p.getZ(a) + p.getZ(b) + p.getZ(c)) / 3);
    }
    const at = (a, r, c) => a[r * W + ((c + seg) % seg)];
    const poles = a => {   // a pole is one direction: the row takes its max; the seam copies column 0
      [0, H].forEach(r => { let m = 0; for (let c = 0; c < seg; c++) m = Math.max(m, a[r * W + c]); for (let c = 0; c < W; c++) a[r * W + c] = m; });
      for (let r = 0; r <= H; r++) a[r * W + seg] = a[r * W];
    };
    poles(raw);
    for (let pass = 0; pass < 10; pass++) {   // fill empty bins from their filled neighbours
      let empty = 0; const nx = new Float32Array(raw);
      for (let r = 0; r <= H; r++) for (let c = 0; c < seg; c++) {
        if (raw[r * W + c] > 0) continue;
        let m = 0; if (r > 0) m = Math.max(m, at(raw, r - 1, c)); if (r < H) m = Math.max(m, at(raw, r + 1, c)); m = Math.max(m, at(raw, r, c - 1), at(raw, r, c + 1));
        nx[r * W + c] = m; if (!m) empty++;
      }
      raw.set(nx); poles(raw); if (!empty) break;
    }
    { const nx = new Float32Array(raw);   // de-spike: a bin far beyond all four neighbours is capped near them (a
      // lone spike would fold the hull and draw a pencil stroke across the crown)
      for (let r = 1; r < H; r++) for (let c = 0; c < seg; c++) {
        const m = Math.max(at(raw, r - 1, c), at(raw, r + 1, c), at(raw, r, c - 1), at(raw, r, c + 1));
        nx[r * W + c] = Math.min(raw[r * W + c], m * 1.03);
      }
      raw.set(nx); poles(raw); }
    const rad = new Float32Array(raw);
    for (let s = 0; s < smooth; s++) {   // smooth, never (more than a hair) inside the binned surface
      const nx = new Float32Array(rad);
      for (let r = 1; r < H; r++) for (let c = 0; c < seg; c++) {
        const i = r * W + c;
        nx[i] = Math.max(raw[i] * 0.985, (rad[i] * 2 + at(rad, r, c - 1) + at(rad, r, c + 1) + at(rad, r - 1, c) + at(rad, r + 1, c)) / 6);
      }
      // the poles sit level with the ring next to them (a pinch there would draw a little star of strokes)
      [[0, 1], [H, H - 1]].forEach(([r, n]) => { let m = 0; for (let c = 0; c < seg; c++) m += nx[n * W + c]; m /= seg; for (let c = 0; c < W; c++) nx[r * W + c] = m; });
      for (let r = 0; r <= H; r++) nx[r * W + seg] = nx[r * W];
      rad.set(nx);
    }
    const D = V(0, 0, 0);
    for (let i = 0; i < sp.count; i++) {
      D.set(sp.getX(i), sp.getY(i), sp.getZ(i)).normalize();
      const r = rad[i] * pad;
      sp.setXYZ(i, C.x + D.x * r * ex, C.y + D.y * r * ey, C.z + D.z * r * ez);
    }
    g.computeVertexNormals();
    // one normal at each pole and along the seam (the sphere grid duplicates those vertices)
    const nr = g.attributes.normal, S = V(0, 0, 0), T = V(0, 0, 0);
    [0, H].forEach(r => { S.set(0, 0, 0); for (let c = 0; c < W; c++) S.add(T.fromBufferAttribute(nr, r * W + c)); S.normalize(); for (let c = 0; c < W; c++) nr.setXYZ(r * W + c, S.x, S.y, S.z); });
    for (let r = 1; r < H; r++) { S.fromBufferAttribute(nr, r * W).add(T.fromBufferAttribute(nr, r * W + seg)).normalize(); nr.setXYZ(r * W, S.x, S.y, S.z); nr.setXYZ(r * W + seg, S.x, S.y, S.z); }
    nr.needsUpdate = true;
    return g;
  }

  // ---------- a builder collects geometry per ramp, then merges ----------
  const builder = () => ({ paint: new Map(), proxies: [] });
  function add(B, key, ramp, geo, speck = 0.2, lift = 0) {
    const k = key + '|' + ramp.join(',') + '|' + lift;
    if (!B.paint.has(k)) B.paint.set(k, { key, ramp, speck, lift, geos: [] });
    B.paint.get(k).geos.push(geo);
  }
  function assemble(B, kind, o = {}) {
    const g = new THREE.Group();
    B.paint.forEach(({ key, ramp, speck, lift, geos }) => {
      // trunks draw their own pencil line (and hide the lines of crowns behind them, as the kit's trunks do);
      // trunkLines: false makes them colour-only
      const m = env.paint(merge(geos), ramp, speck, lift, key === 'trunk' ? 'trunk' : 'leaves', key === 'trunk' && o.trunkLines !== false);
      m.name = key; g.add(m);
    });
    if (B.proxies.length) { const pm = env.proxy(merge(B.proxies)); pm.name = 'keyline'; g.add(pm); }
    g.userData.agora = { part: 'tree', kind };
    g.position.set(num(o.x, 0), num(o.y, 0), num(o.z, 0));
    if (num(o.rot, 0)) g.rotation.y = o.rot;
    return g;
  }
  // a crown: painted (patches) + its one proxy. lift lowers the whole ramp lookup (kit.bake's v)
  function crown(B, ramp, C, E, lobes, opts = {}, lift = 0) {
    const g = crownGeo(C, E, lobes, opts);
    B.proxies.push(hullGeo(C, g));
    add(B, 'crown', ramp, patchify(g, num(opts.patch, E.x * 0.34), num(opts.dapple, 0.09)), num(opts.speck, 0.06), lift);
  }
  // n lobes in a ring round C (plus a centre lobe): ring radius / lobe size as fractions of rad, squash
  function ringLobes(C, rad, thick, { n = 6, ringR = [0.42, 0.62], size = [0.4, 0.52], sy = [0.55, 0.75], dy = [-0.22, 0.08], centre = 0.62, cy = 0.08, csy = 0.55 } = {}) {
    const out = [{ c: V(C.x, C.y + thick * cy, C.z), s: V(rad * centre, thick * csy, rad * centre) }];
    const a0 = R(0, 6.28);
    for (let i = 0; i < n; i++) {
      const a = a0 + i / n * Math.PI * 2 + R(-0.3, 0.3), d = rad * R(ringR[0], ringR[1]), r = rad * R(size[0], size[1]);
      out.push({ c: V(C.x + Math.cos(a) * d, C.y + R(dy[0], dy[1]) * thick, C.z + Math.sin(a) * d), s: V(r, Math.min(thick * 0.62, r * R(sy[0], sy[1])), r * R(0.85, 1)) });
    }
    return out;
  }
  const at = o => V(num(o._x, 0), 0, num(o._z, 0));   // a tree's base inside a builder (grove)
  const seeded = (o, fn) => { if (o.seed === undefined) return fn(); const keep = rand; rand = mulberry32(Math.floor(o.seed)); try { return fn(); } finally { rand = keep; } };
  const leanDir = o => (Array.isArray(o.leanTo) ? Math.atan2(num(o.leanTo[1], 0), num(o.leanTo[0], 1)) : num(o.dir, R(0, 6.28)));

  // ================= species =================
  // umbrella pine (Pinus pinea): a leaning bare trunk, limbs into the crown, a wide flat-topped canopy of thin
  // layered pads (each with a lit top and a dark underside), sometimes a second lower canopy on a side limb.
  // o: { h [8], r [h*0.42], lean [h*0.14] (crown offset, m), dir (radians) | leanTo [dx, dz], tiers [1|2], ramp
  //      [PINE], lift [-0.12], trunk (radius), bark (ramp), lumps (pads in the ring) }
  function addUmbrellaPine(B, o) {
    const base = at(o), h = num(o.h, 8), rad = num(o.r, h * 0.42), lean = num(o.lean, h * 0.14), dir = leanDir(o);
    const ramp = rampOf(o.ramp, TREE_RAMPS.PINE), bark = rampOf(o.bark, TREE_RAMPS.TRUNK), thick = Math.max(0.45, rad * 0.46), lift = num(o.lift, -0.12);
    const lx = Math.cos(dir) * lean, lz = Math.sin(dir) * lean, top = h, cy = top - thick * 0.5;
    const C = V(base.x + lx, cy, base.z + lz);
    const n = clamp(Math.round(num(o.lumps, 5 + Math.floor(rand() * 2))), 3, 8);
    const lobes = ringLobes(C, rad, thick, { n, ringR: [0.46, 0.6], size: [0.36, 0.47], sy: [0.3, 0.4], dy: [-0.34, 0.02], centre: 0.62, cy: 0.12, csy: 0.42 });
    crown(B, ramp, C, V(rad, thick * 0.5, rad), lobes, { flatTop: top - thick * 0.08, ao: 1.5, crevice: 0.4, unify: 0.5, lump: 0.1, dapple: 0.07, patch: rad * 0.28 }, lift);
    const r0 = num(o.trunk, Math.max(0.08, h * 0.032)), bend = R(-0.25, 0.25);
    const pts = [V(base.x, -0.1, base.z), V(base.x + lx * 0.22 - lz * bend * 0.3, h * 0.35, base.z + lz * 0.22 + lx * bend * 0.3), V(base.x + lx * 0.7, h * 0.66, base.z + lz * 0.7), V(C.x, cy - thick * 0.1, C.z)];   // ends under the flat top
    add(B, 'trunk', bark, limb(pts, r0, r0 * 0.45, { flare: 0.45 }), 0.1);
    lobes.slice(1).filter((_, i) => i % 2 === 0).forEach(l => {   // limbs spreading into the pads
      const s = V(base.x + lx * 0.62, h * 0.62, base.z + lz * 0.62), m = s.clone().lerp(l.c, 0.55); m.y = cy - thick * 0.45;
      add(B, 'trunk', bark, limb([s, m, V(l.c.x, l.c.y, l.c.z)], r0 * 0.5, r0 * 0.28, { radial: 7 }), 0.1);
    });
    const tiers = num(o.tiers, h >= 7.5 && rand() < 0.65 ? 2 : 1);
    if (tiers >= 2) {   // a second, lower canopy on a side limb, opposite the lean (the Red arch silhouette)
      const a = dir + Math.PI + R(-0.9, 0.9), rr = rad * R(0.5, 0.6), d = rad * R(0.8, 0.98), t2 = thick * 0.8;
      const C2 = V(C.x + Math.cos(a) * d, cy - thick * R(1.0, 1.35), C.z + Math.sin(a) * d);
      const s = V(base.x + lx * 0.5, h * 0.55, base.z + lz * 0.5);
      add(B, 'trunk', bark, limb([s, s.clone().lerp(C2, 0.5).setY(C2.y - t2 * 0.3), C2.clone()], r0 * 0.6, r0 * 0.32, { radial: 7 }), 0.1);
      crown(B, ramp, C2, V(rr, t2 * 0.5, rr), ringLobes(C2, rr, t2, { n: 4, ringR: [0.42, 0.56], size: [0.42, 0.55], sy: [0.32, 0.42], dy: [-0.3, 0.02], centre: 0.6, cy: 0.1, csy: 0.42 }), { flatTop: C2.y + t2 * 0.4, ao: 1.5, crevice: 0.4, unify: 0.5, lump: 0.1, dapple: 0.07, patch: rr * 0.3 }, lift);
    }
  }

  // cypress: a vertical flame (a lathe with soft bulges and vertical flame ridges) covered in tall flat dabs
  // of two values over a left-lit / right-deep body. o: { h [9], w [h*0.11] (radius), ramp [CYPRESS], lift [-0.02] }
  function addCypress(B, o) {
    const base = at(o), h = num(o.h, 9), w = num(o.w, h * 0.11), ramp = rampOf(o.ramp, TREE_RAMPS.CYPRESS);
    const tip = V(R(-0.1, 0.1) * w, 0, R(-0.1, 0.1) * w), b1 = R(0, 6), b2 = R(0, 6);
    const prof = t => {   // 0 at the ground .. 1 at the tip
      const body = t < 0.06 ? 0.55 + 0.45 * Math.sin(t / 0.06 * Math.PI / 2) : Math.pow(Math.max(0, 1 - (t - 0.06) / 0.94), 0.72) * (1 + 0.12 * Math.sin(t * 9 + b1) * (1 - t));
      return Math.max(0.002, body);
    };
    const rows = clamp(Math.round(h * 5), 24, 56), seg = 26, pos = [], idx = [], ph = R(0, 6.28);
    for (let i = 0; i <= rows; i++) {
      const t = i / rows, y = 0.15 + t * (h - 0.15), r = w * prof(t), sway = t * t;
      for (let j = 0; j <= seg; j++) {
        const a = (j + (i % 2) * 0.5) / seg * Math.PI * 2;   // alternate rows half a step: rounder dabs, not bricks
        const flame = 1 + 0.09 * Math.sin(a * 5 + ph + t * 2.2) + 0.06 * Math.sin(a * 9 - t * 7 + b2) + 0.04 * Math.sin(a * 13 + t * 23 + b1);
        pos.push(base.x + tip.x * sway + Math.cos(a) * r * flame, y, base.z + tip.z * sway + Math.sin(a) * r * flame);
      }
    }
    for (let i = 0; i < rows; i++) for (let j = 0; j < seg; j++) { const a = i * (seg + 1) + j, b = a + seg + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    // painted normals: half way to the smooth spindle (one volume), the foot in occlusion
    const p = g.attributes.position, n = g.attributes.normal, M = V(0, 0, 0), Q = V(0, 0, 0);
    for (let i = 0; i < p.count; i++) {
      const t = clamp((p.getY(i) - 0.15) / h, 0, 1);
      Q.set(p.getX(i) - base.x - tip.x * t * t, w * 0.35 * (1 - t) + 0.25 * w, p.getZ(i) - base.z - tip.z * t * t).normalize();
      M.set(n.getX(i), n.getY(i), n.getZ(i)).lerp(Q, 0.5); M.y -= 0.45 * Math.pow(1 - t, 3); M.normalize(); n.setXYZ(i, M.x, M.y, M.z);
    }
    // tall flame dabs: cells about 0.5 w across, stretched 2x vertically, two values
    add(B, 'crown', ramp, patchify(g, num(o.patch, w * 0.5), num(o.dapple, 0.24), 0.5), 0.05, num(o.lift, -0.02));
    const pp = []; for (let i = 0; i <= 24; i++) { const t = i / 24; pp.push(new THREE.Vector2(Math.max(0.001, w * prof(t) * 1.04 + 0.01), 0.15 + t * (h - 0.15))); }
    const pg = new THREE.LatheGeometry(pp, 24); pg.translate(base.x, 0, base.z); B.proxies.push(pg);
    add(B, 'trunk', rampOf(o.bark, TREE_RAMPS.TRUNK), limb([V(base.x, -0.1, base.z), V(base.x, 0.5, base.z)], w * 0.22, w * 0.18, { radial: 7 }), 0.1);
  }

  // olive: a short gnarled grey trunk forking into limbs, a wide irregular silver-green crown of a few
  // separate-ish lobes, lit warm on top. o: { h [5], r [h*0.5], lean [r*0.1..0.3] (m), dir | leanTo, ramp [OLIVE],
  // lift [0], trunk (radius), bark (ramp), lumps }
  function addOlive(B, o) {
    const base = at(o), h = num(o.h, 5), rad = num(o.r, h * 0.5), ramp = rampOf(o.ramp, TREE_RAMPS.OLIVE), bark = rampOf(o.bark, TREE_RAMPS.OLIVE_BARK);
    const thick = rad * 0.95, cy = h - thick * 0.5, dir = leanDir(o), lean = num(o.lean, R(0.1, 0.3) * rad);   // a deep crown, low on a short trunk
    const C = V(base.x + Math.cos(dir) * lean, cy, base.z + Math.sin(dir) * lean);
    const n = clamp(Math.round(num(o.lumps, 4 + Math.floor(rand() * 2))), 2, 7);
    const lobes = ringLobes(C, rad, thick, { n, ringR: [0.45, 0.64], size: [0.4, 0.54], sy: [0.62, 0.8], dy: [-0.3, 0.12], centre: 0.52 });
    crown(B, ramp, C, V(rad, thick * 0.6, rad), lobes, { ao: 0.8, lump: 0.12, crevice: 0.55 }, num(o.lift, -0.03));
    const r0 = num(o.trunk, Math.max(0.09, h * 0.06)), fork = V(base.x + (C.x - base.x) * 0.35, h * 0.32, base.z + (C.z - base.z) * 0.35);
    add(B, 'trunk', bark, limb([V(base.x, -0.1, base.z), V(base.x + R(-0.05, 0.05) * h, h * 0.16, base.z + R(-0.05, 0.05) * h), fork], r0, r0 * 0.75, { flare: 0.6, wob: 0.14 }), 0.12);
    lobes.slice(0, 4).forEach((l, i) => {
      const m = fork.clone().lerp(l.c, 0.5); m.x += R(-0.06, 0.06) * h; m.z += R(-0.06, 0.06) * h;
      add(B, 'trunk', bark, limb([fork, m, V(l.c.x, l.c.y - l.s.y * 0.2, l.c.z)], r0 * (i ? 0.5 : 0.62), r0 * 0.25, { radial: 7, wob: 0.12 }), 0.12);
    });
  }

  // a round broadleaf (oak / lemon / orange / plane): a straight trunk, a full rounded crown of lobes.
  // o: { h [6.5], r [h*0.36], tall [1.6] (crown height / r), lean (m), dir | leanTo, ramp [ROUND], lift [-0.06],
  //      trunk, bark, lumps, fruit [false | true (lemons) | 'ORANGE' | ramp], fruitCount }
  function addRoundTree(B, o) {
    const base = at(o), h = num(o.h, 6.5), rad = num(o.r, h * 0.36), ramp = rampOf(o.ramp, TREE_RAMPS.ROUND), bark = rampOf(o.bark, TREE_RAMPS.TRUNK);
    const thick = rad * num(o.tall, 1.6), cy = h - thick * 0.5, dir = leanDir(o), lean = num(o.lean, R(0, 0.12) * rad);
    const C = V(base.x + Math.cos(dir) * lean, cy, base.z + Math.sin(dir) * lean);
    const n = clamp(Math.round(num(o.lumps, 5)), 2, 8);
    const lobes = ringLobes(C, rad, thick, { n, ringR: [0.38, 0.55], size: [0.48, 0.62], sy: [0.85, 1.05], dy: [-0.18, 0.18], centre: 0.72 });
    lobes.push({ c: V(C.x + R(-0.15, 0.15) * rad, C.y + thick * 0.28, C.z + R(-0.15, 0.15) * rad), s: V(rad * 0.5, rad * 0.45, rad * 0.5) });
    crown(B, ramp, C, V(rad, thick * 0.5, rad), lobes, { ao: 0.95 }, num(o.lift, -0.06));
    if (o.fruit) sprinkle(B, C, lobes, rampOf(o.fruit === true ? 'LEMON' : o.fruit, TREE_RAMPS.LEMON), Math.round(num(o.fruitCount, clamp(6 * rad * rad, 9, 40))), clamp(rad * 0.13, 0.08, 0.3), -0.2);
    const r0 = num(o.trunk, Math.max(0.07, h * 0.045));
    add(B, 'trunk', bark, limb([V(base.x, -0.1, base.z), V(base.x + R(-0.02, 0.02) * h, h * 0.3, base.z + R(-0.02, 0.02) * h), V(C.x, cy, C.z)], r0, r0 * 0.55, { flare: 0.4 }), 0.1);
  }

  // shrub: a low dome of 1-6 lobes on the ground (no trunk), optional blossom.
  // o: { r [0.9], h [r*1.1], lobes [3], spread [r*0.7], ramp [LEAF], lift [-0.06], flowers [false | 'PINK' | 'RED' | ramp], bloom [0.5] }
  function addShrub(B, o) {
    const base = at(o), r = num(o.r, 0.9), h = num(o.h, r * 1.1), n = clamp(Math.round(num(o.lobes, 3)), 1, 6), spread = num(o.spread, r * 0.7);
    const ramp = rampOf(o.ramp, TREE_RAMPS.LEAF), lobes = [];
    for (let i = 0; i < n; i++) {
      const a = R(0, 6.28), d = i === 0 ? 0 : spread * R(0.5, 1), rr = r * (i === 0 ? 1 : R(0.6, 0.85)), hh = h * (i === 0 ? 1 : R(0.6, 0.85));
      lobes.push({ c: V(base.x + Math.cos(a) * d, hh * 0.42, base.z + Math.sin(a) * d * 0.8), s: V(rr, hh * 0.6, rr) });
    }
    const ext = n > 1 ? spread + r : r, C = V(base.x, h * 0.42, base.z);
    crown(B, ramp, C, V(ext, h * 0.6, ext), lobes, { ao: 0.75, seg: 16, patch: Math.max(0.12, ext * 0.42) }, num(o.lift, -0.06));
    if (o.flowers) {
      const bloom = clamp(num(o.bloom, 0.5), 0, 1);
      sprinkle(B, C, lobes, rampOf(o.flowers === true ? 'PINK' : o.flowers, TREE_RAMPS.PINK), Math.round((6 + 22 * bloom) * Math.max(0.5, ext * ext)), r * 0.13, 0);
    }
  }
  // chunky dabs (blossom, fruit) on the crown's surface, in their own ramp
  function sprinkle(B, C, lobes, ramp, count, size, minUp = 0) {
    const geos = [], D = V(0, 0, 0);
    for (let i = 0; i < count; i++) {
      const th = R(0, 6.28), ph = Math.acos(R(minUp, 1)); D.set(Math.sin(ph) * Math.cos(th), Math.cos(ph), Math.sin(ph) * Math.sin(th));
      let t = 0; lobes.forEach(l => { t = Math.max(t, farHit(C, D, l.c, l.s)); }); if (t <= 0) continue;
      const s = size * R(0.75, 1.25), ico = new THREE.IcosahedronGeometry(1, 0); ico.scale(s, s * 0.8, s);
      ico.translate(C.x + D.x * t * 0.98, C.y + D.y * t * 0.98, C.z + D.z * t * 0.98); ico.computeVertexNormals(); geos.push(ico);
    }
    if (geos.length) add(B, 'blossom', ramp, merge(geos), 0.25, 0.12);
  }

  // ================= public: each returns a THREE.Group, ground y = 0 =================
  const one = (kind, fn) => (o = {}) => seeded(o, () => { const B = builder(); fn(B, Object.assign({}, o, { _x: 0, _z: 0 })); return assemble(B, kind, o); });
  const umbrellaPine = one('umbrellaPine', addUmbrellaPine);
  const cypress = one('cypress', addCypress);
  const olive = one('olive', addOlive);
  const roundTree = one('roundTree', addRoundTree);
  const shrub = one('shrub', addShrub);

  // grove: 1-16 mixed trees (+ shrubs at the edge) with room between the crowns and size variety, merged into a
  // handful of meshes. NO base disc. o: { n [7], r [area radius], mix { pine, olive, cypress, round, shrub },
  // scale [1], shrubs [n*0.35], patch [false | true | '#hex'] (a soft colour-only ground tint), seed, x, y, z, rot }
  const grove = (o = {}) => seeded(o, () => {
    const n = clamp(Math.round(num(o.n, 7)), 1, 16), S = num(o.scale, 1), area = num(o.r, (2.5 * Math.sqrt(n) + 1.2) * S);
    const mix = Object.assign({ pine: 2, olive: 3, cypress: 1, round: 1.4, shrub: 0 }, o.mix || {});
    const kinds = Object.keys(mix).filter(k => mix[k] > 0), tot = kinds.reduce((a, k) => a + mix[k], 0);
    const pick = () => { let x = rand() * tot; for (const k of kinds) { x -= mix[k]; if (x <= 0) return k; } return kinds[0]; };
    const size = { pine: () => R(6.5, 9.5), olive: () => R(4, 5.6), cypress: () => R(5.5, 8), round: () => R(5.2, 7.2), shrub: () => R(1, 1.8) };
    // the room a tree needs: its crown radius (a cypress also needs room for its height seen from above)
    const reach = { pine: h => h * 0.42, olive: h => h * 0.5, cypress: h => h * 0.22, round: h => h * 0.36, shrub: h => h * 0.75 };
    const list = []; for (let i = 0; i < n; i++) { const k = pick(), h = size[k]() * S; list.push({ k, h, r: reach[k](h) }); }
    list.sort((a, b) => b.r - a.r);   // big crowns first
    const placed = [];
    list.forEach(t => {
      let best = null, bestScore = -Infinity;
      for (let tries = 0; tries < 60; tries++) {   // best of 60: inside the area, crowns apart (a little overlap at most)
        const a = R(0, 6.28), d = area * Math.sqrt(rand()) * (t.k === 'cypress' ? 1.05 : 0.92), x = Math.cos(a) * d, z = Math.sin(a) * d * 0.85;
        let gap = Infinity; placed.forEach(p => { gap = Math.min(gap, Math.hypot(x - p.x, z - p.z) - (p.r + t.r) * 0.98); });
        const score = Math.min(gap, 2 * S) - d * 0.05;
        if (score > bestScore) { bestScore = score; best = { x, z }; }
      }
      placed.push(Object.assign(t, best));
    });
    const B = builder();
    placed.forEach(t => {
      const p = { _x: t.x, _z: t.z, h: t.h };
      if (t.k === 'pine') addUmbrellaPine(B, Object.assign(p, { tiers: t.h > 8 ? 2 : 1 }));
      else if (t.k === 'olive') addOlive(B, p);
      else if (t.k === 'cypress') addCypress(B, p);
      else if (t.k === 'round') addRoundTree(B, p);
      else addShrub(B, Object.assign(p, { r: t.h * 0.6, h: t.h }));
    });
    const ns = Math.round(num(o.shrubs, n * 0.35));
    for (let i = 0; i < ns; i++) {   // a few shrubs tucked in round the edge
      const a = R(0, 6.28), d = area * R(0.8, 1.05), r = R(0.6, 1.0) * S;
      addShrub(B, { _x: Math.cos(a) * d, _z: Math.sin(a) * d * 0.85, r, h: r * R(0.9, 1.2), lobes: 2 + Math.floor(rand() * 2), ramp: rand() < 0.4 ? TREE_RAMPS.OLIVE : TREE_RAMPS.LEAF });
    }
    const g = assemble(B, 'grove', o);
    if (o.patch) g.add(groundPatch(area * 1.25, o.patch === true ? '#b9a06e' : o.patch));
    g.userData.agora.trees = placed.map(t => ({ kind: t.k, h: +t.h.toFixed(2), x: +t.x.toFixed(2), z: +t.z.toFixed(2) }));
    return g;
  });

  // a soft painted ground tint under a grove: colour-only, ragged alpha edge, no keyline, no shadow
  function groundPatch(r, hex) {
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { uCol: { value: new THREE.Color(hex) }, uSeed: { value: R(0, 50) } },
      vertexShader: 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: `uniform vec3 uCol; uniform float uSeed; varying vec2 vP;
        float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
        float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
        void main(){ float r = length(vP) + 0.28*(n(vP*1.1+uSeed)-0.5) + 0.12*(n(vP*3.7-uSeed)-0.5);
          float a = smoothstep(1.0, 0.55, r) * 0.38; if (a < 0.01) discard; gl_FragColor = vec4(uCol, a); }`
    });
    const m = new THREE.Mesh(new THREE.CircleGeometry(1, 40), mat);
    m.rotation.x = -Math.PI / 2; m.position.y = 0.02; m.scale.setScalar(r); m.renderOrder = -1; m.name = 'patch';
    env.colourOnly(m); m.userData.agora = { part: 'patch' };
    return m;
  }

  return { umbrellaPine, cypress, olive, roundTree, shrub, grove, RAMPS: TREE_RAMPS, reseed: s => { rand = mulberry32(Math.floor(s)); } };
}

// ======================================================================================================
// createTrees(ctx, kit, { seed }): standalone (labs, scenery). Own shape stream; kit.bake still spends ctx.rnd.
// ======================================================================================================
export function createTrees(ctx, kit, { seed = 5 } = {}) {
  const proxyMat = new THREE.MeshBasicMaterial();
  const rampOf = (r, d) => (Array.isArray(r) && r.length >= 2 ? r : (typeof r === 'string' && TREE_RAMPS[r.toUpperCase()]) || d);
  const colourOnly = m => { m.userData.agoraColour = true; if (!ctx.colourOnly.includes(m)) ctx.colourOnly.push(m); return m; };
  const E = createEngine({
    rand: mulberry32(seed),
    ramp: rampOf,
    colourOnly,
    paint(geo, ramp, speck, lift, part, lines) {
      kit.bake(geo, ramp, speck, lift);
      const m = new THREE.Mesh(geo, kit.paintMat); m.castShadow = true;
      m.userData.agora = { part, ramp, speck, lift };
      if (!lines) colourOnly(m);
      return m;
    },
    proxy(geo) {
      const m = new THREE.Mesh(geo, proxyMat); m.visible = false;
      m.userData.agora = { part: 'proxy' }; m.userData.agoraLine = true; ctx.lineOnly.push(m);
      return m;
    }
  });
  return Object.assign(E, { seed: E.reseed });
}

// ======================================================================================================
// createTreeBuilders(base): the build api's trees (api.js passes { group, mesh, proxy, colourOnly, cypress, ramps,
// ramp, range, rand }). Shapes draw from the api's own rand, so api.seed(n) keeps prefab variants stable.
//   api.tree({ kind ['oak' | 'olive' | 'lemon' | 'orange' | 'pine' | 'cypress'], h, r, s (scales h and r), lean
//              (a fraction of r), leanTo [dx, dz], x, y, z, rot, ramp, trunk (bark ramp, or radius in m), fruit
//              [ramp | true | false], lumps })
//   api.olive / api.oak / api.lemon (o)  = tree with that kind;  api.pine({ h [6], r [0.4 h], lean, leanTo, ... })
//   kind 'cypress' is the painted, dappled cypress; api.cypress itself stays the kit's (the Assembly's set piece).
// Also returned for api.js to expose if it wants: roundTree, shrub (painted, one outline), grove, paintedCypress.
// ======================================================================================================
const KINDS = {
  olive: { h: 2.7, r: 1.05, ramp: 'OLIVE', twist: 0.3 },
  oak: { h: 4.6, r: 1.75, ramp: 'OAK', twist: 0.12, tall: 1.45 },
  lemon: { h: 2.1, r: 0.72, ramp: 'ROUND', twist: 0.08, tall: 1.55, fruit: 'LEMON' },
  orange: { h: 2.3, r: 0.8, ramp: 'ROUND', twist: 0.08, tall: 1.55, fruit: 'ORANGE' },
  pine: { h: 6, r: 2.4, ramp: 'PINE', twist: 0.5 }
};
export function createTreeBuilders(base) {
  const toRamp = (r, d) => {
    if (Array.isArray(r) && r.length >= 2) return r;
    if (typeof r === 'string') {
      const k = r.toUpperCase();
      if (TREE_RAMPS[k]) return TREE_RAMPS[k];
      if (base.ramps && base.ramps[k]) return base.ramps[k];
      if (/^#|^rgb|^hsl/i.test(r) && base.ramp) return base.ramp(r);
      return d || TREE_RAMPS.LEAF;
    }
    if (typeof r === 'number' && base.ramp) return base.ramp('#' + new THREE.Color(r).getHexString());
    return d;
  };
  const E = createEngine({
    rand: () => base.rand(),
    ramp: toRamp,
    colourOnly: m => base.colourOnly(m),
    paint(geo, ramp, speck, lift, part, lines) {
      const m = base.mesh(geo, ramp, { speck, lift });
      m.userData.agora.part = part;
      if (!lines) base.colourOnly(m);
      return m;
    },
    proxy: geo => base.proxy(geo)
  });
  // kind 'random' (or 'mixed' / 'any'): one of every tree type, weighted like a Mediterranean hillside; drawn from the
  // api's own rand, so a prefab variant always gets the same mix. `mix: { pine, olive, cypress, oak, lemon, orange }` reweights.
  const RANDOM_MIX = { pine: 2, olive: 2.2, cypress: 1.3, oak: 1, lemon: 0.5, orange: 0.4 };
  function randomKind(mix) {
    const m = mix && typeof mix === 'object' ? mix : RANDOM_MIX;
    const kinds = Object.keys(m).filter(k => (KINDS[k] || k === 'cypress') && m[k] > 0), tot = kinds.reduce((a, k) => a + m[k], 0);
    let x = base.rand() * tot;
    for (const k of kinds) { x -= m[k]; if (x <= 0) return k; }
    return kinds[kinds.length - 1] || 'oak';
  }
  function tree(o = {}) {
    let kindName = String(o.kind || 'oak').toLowerCase();
    if (kindName === 'random' || kindName === 'mixed' || kindName === 'any') kindName = randomKind(o.mix);
    if (kindName === 'cypress') {   // the painted, dappled cypress (api.cypress stays the kit's, for the Assembly)
      const s = num(o.s, 1), h = num(o.h, 5 * s);
      const g = E.cypress({ x: o.x, y: o.y, z: o.z, rot: o.rot, seed: o.seed, h, w: num(o.w, num(o.r, h * 0.12)), ramp: toRamp(o.ramp || o.color || o.colour, TREE_RAMPS.CYPRESS), lift: o.lift });
      g.userData.agora = { part: 'tree', kind: 'cypress' };
      return g;
    }
    const kind = KINDS[kindName] ? kindName : 'oak', K = KINDS[kind];
    const s = num(o.s, 1), h = num(o.h, K.h * s), r = num(o.r, K.r * (h / K.h));
    const p = { x: o.x, y: o.y, z: o.z, rot: o.rot, seed: o.seed, h, r, lumps: o.lumps, leanTo: o.leanTo, dir: o.dir, lift: o.lift, trunkLines: o.trunkLines };
    p.lean = num(o.lean, K.twist) * r * (kind === 'pine' ? 0.6 : 0.5);
    p.ramp = toRamp(o.ramp || o.color || o.colour, TREE_RAMPS[K.ramp]);
    if (typeof o.trunk === 'number') p.trunk = o.trunk; else if (o.trunk) p.bark = toRamp(o.trunk);
    if (o.bark) p.bark = toRamp(o.bark);
    let g;
    if (kind === 'pine') g = E.umbrellaPine(Object.assign(p, { tiers: o.tiers }));
    else if (kind === 'olive') g = E.olive(p);
    else {
      const fruit = o.fruit === false ? false : (o.fruit ? (o.fruit === true ? TREE_RAMPS[K.fruit || 'LEMON'] : toRamp(o.fruit, TREE_RAMPS.LEMON)) : (K.fruit ? TREE_RAMPS[K.fruit] : false));
      g = E.roundTree(Object.assign(p, { tall: K.tall, fruit, fruitCount: o.fruitCount }));
    }
    g.userData.agora = { part: 'tree', kind };
    return g;
  }
  const olive = (o = {}) => tree(Object.assign({}, o, { kind: 'olive' }));
  const oak = (o = {}) => tree(Object.assign({}, o, { kind: 'oak' }));
  const lemon = (o = {}) => tree(Object.assign({}, o, { kind: 'lemon' }));
  const pine = (o = {}) => tree(Object.assign({}, o, { kind: 'pine', r: num(o.r, num(o.h, 6 * num(o.s, 1)) * 0.4) }));
  // painted extras (one outline per crown), for api.js to expose: api.grove / api.roundTree / api.paintedShrub
  const grove = (o = {}) => E.grove(o);
  const roundTree = (o = {}) => E.roundTree(Object.assign({}, o, { ramp: toRamp(o.ramp || o.color || o.colour, TREE_RAMPS.ROUND) }));
  const shrub = (o = {}) => E.shrub(Object.assign({}, o, { ramp: toRamp(o.ramp || o.color || o.colour, TREE_RAMPS.LEAF), flowers: o.flowers ? (o.flowers === true ? true : toRamp(o.flowers, TREE_RAMPS.PINK)) : false }));
  const paintedCypress = (o = {}) => E.cypress(Object.assign({}, o, { ramp: toRamp(o.ramp, TREE_RAMPS.CYPRESS) }));
  return { tree, olive, oak, lemon, pine, grove, roundTree, shrub, paintedCypress, randomKind, RANDOM_MIX, RAMPS: TREE_RAMPS };
}
