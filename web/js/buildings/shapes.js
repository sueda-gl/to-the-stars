// Flat shapes on the ground plane, for the things that follow a pencil mark (ART_DIRECTION §5): polygons
// (areas) and polylines (strokes) in (x, z), turned into painted geometry that can drape over the terrain.
// Points are [x, z] pairs (or {x, z}). Everything here is pure geometry: no materials, no ctx.
//
//   area(poly) centroid(poly) bbox(poly) inside(poly, x, z) frame(poly) -> oriented box { x, z, rot, w, d }
//   clipHalf(poly, nx, nz, c)  band(poly, angle, a, b)  chord(poly, x0, z0, dx, dz) -> inside segments
//   inset(poly, d)  smooth(pts, passes)  resample(pts, step)  scatter(poly, spacing, rand, margin)
//   surfaceGeo(poly, { y, heightAt, maxEdge, skirt })      a flat (or draped) polygon top, with a skirt edge
//   ribbonGeo(pts, width, { y, h, heightAt, step, base })   a strip along a polyline: top + both sides (+ ends)
//   mergeGeos(geos) -> one BufferGeometry (position + normal [+ color])

const P = p => (Array.isArray(p) ? { x: +p[0] || 0, z: +p[1] || 0 } : { x: +p.x || 0, z: +(p.z !== undefined ? p.z : p.y) || 0 });
export const toPts = list => (Array.isArray(list) ? list.map(P).filter(p => isFinite(p.x) && isFinite(p.z)) : []);

export function area(poly) {   // signed: > 0 when counter-clockwise in (x, z)
  let a = 0; for (let i = 0, n = poly.length; i < n; i++) { const p = poly[i], q = poly[(i + 1) % n]; a += p.x * q.z - q.x * p.z; }
  return a / 2;
}
export function centroid(poly) {
  const a = area(poly);
  if (Math.abs(a) < 1e-6) { const s = poly.reduce((s, p) => ({ x: s.x + p.x, z: s.z + p.z }), { x: 0, z: 0 }); return { x: s.x / Math.max(1, poly.length), z: s.z / Math.max(1, poly.length) }; }
  let cx = 0, cz = 0;
  for (let i = 0, n = poly.length; i < n; i++) { const p = poly[i], q = poly[(i + 1) % n], f = p.x * q.z - q.x * p.z; cx += (p.x + q.x) * f; cz += (p.z + q.z) * f; }
  return { x: cx / (6 * a), z: cz / (6 * a) };
}
export function bbox(pts) {
  const b = { x0: Infinity, x1: -Infinity, z0: Infinity, z1: -Infinity };
  pts.forEach(p => { b.x0 = Math.min(b.x0, p.x); b.x1 = Math.max(b.x1, p.x); b.z0 = Math.min(b.z0, p.z); b.z1 = Math.max(b.z1, p.z); });
  return b;
}
export function inside(poly, x, z) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.z > z) !== (b.z > z) && x < (b.x - a.x) * (z - a.z) / (b.z - a.z) + a.x) c = !c;
  }
  return c;
}
const distSeg = (p, a, b) => { const dx = b.x - a.x, dz = b.z - a.z, l = dx * dx + dz * dz || 1e-9; const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / l)); return Math.hypot(p.x - a.x - dx * t, p.z - a.z - dz * t); };
export const edgeDist = (poly, p) => { let d = Infinity; for (let i = 0; i < poly.length; i++) d = Math.min(d, distSeg(p, poly[i], poly[(i + 1) % poly.length])); return d; };

// the oriented frame of an area: its long axis (from the second moments) and the box round it in that frame
export function frame(poly) {
  const c = centroid(poly);
  let sxx = 0, szz = 0, sxz = 0;
  const dense = resample(poly.concat([poly[0]]), 0.5);
  dense.forEach(p => { const dx = p.x - c.x, dz = p.z - c.z; sxx += dx * dx; szz += dz * dz; sxz += dx * dz; });
  const ang = 0.5 * Math.atan2(2 * sxz, sxx - szz);   // the long axis, radians from +x toward +z
  const ux = Math.cos(ang), uz = Math.sin(ang);
  let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity;
  poly.forEach(p => { const dx = p.x - c.x, dz = p.z - c.z, a = dx * ux + dz * uz, b = -dx * uz + dz * ux; a0 = Math.min(a0, a); a1 = Math.max(a1, a); b0 = Math.min(b0, b); b1 = Math.max(b1, b); });
  const am = (a0 + a1) / 2, bm = (b0 + b1) / 2;
  // rot is a turn about +y (three.js): local +x maps to (cos rot, -sin rot) in (x, z), so rot = -ang
  return { x: c.x + ux * am - uz * bm, z: c.z + uz * am + ux * bm, angle: ang, rot: -ang, w: a1 - a0, d: b1 - b0, centroid: c };
}

// keep the part of a polygon where nx*x + nz*z <= c (Sutherland-Hodgman against one half plane)
export function clipHalf(poly, nx, nz, c) {
  const out = [], f = p => nx * p.x + nz * p.z - c;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length], fa = f(a), fb = f(b);
    if (fa <= 0) out.push(a);
    if ((fa < 0 && fb > 0) || (fa > 0 && fb < 0)) { const t = fa / (fa - fb); out.push({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t }); }
  }
  return out;
}
// the slice of a polygon between two lines across `angle` (a band of a striped field), a <= s <= b along the normal
export function band(poly, angle, a, b) {
  const nx = -Math.sin(angle), nz = Math.cos(angle);
  return clipHalf(clipHalf(poly, nx, nz, b), -nx, -nz, -a);
}
// the inside spans of the line through (x0, z0) along (dx, dz): [[t0, t1], ...] (vineyard rows, orchard lines)
export function chord(poly, x0, z0, dx, dz) {
  const ts = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length], ex = b.x - a.x, ez = b.z - a.z, den = dx * ez - dz * ex;
    if (Math.abs(den) < 1e-9) continue;
    const t = ((a.x - x0) * ez - (a.z - z0) * ex) / den, u = ((a.x - x0) * dz - (a.z - z0) * dx) / den;
    if (u >= 0 && u < 1) ts.push(t);
  }
  ts.sort((p, q) => p - q);
  const spans = []; for (let i = 0; i + 1 < ts.length; i += 2) spans.push([ts[i], ts[i + 1]]);
  return spans;
}
// shrink a polygon by d (vertex bisectors; good enough for the soft outlines people draw)
export function inset(poly, d) {
  const ccw = area(poly) > 0 ? 1 : -1, n = poly.length, out = [];
  for (let i = 0; i < n; i++) {
    const a = poly[(i - 1 + n) % n], p = poly[i], b = poly[(i + 1) % n];
    const e1 = norm(p.x - a.x, p.z - a.z), e2 = norm(b.x - p.x, b.z - p.z);
    const n1 = { x: -e1.z * ccw, z: e1.x * ccw }, n2 = { x: -e2.z * ccw, z: e2.x * ccw };   // inward normals
    const m = norm(n1.x + n2.x, n1.z + n2.z), k = Math.min(3, 1 / Math.max(0.35, m.x * n1.x + m.z * n1.z));
    out.push({ x: p.x + m.x * d * k, z: p.z + m.z * d * k });
  }
  return out;
}
const norm = (x, z) => { const l = Math.hypot(x, z) || 1; return { x: x / l, z: z / l }; };
// Chaikin corner cutting (a hand-drawn pencil stroke becomes a smooth road / wall line); closed loops keep closing
export function smooth(pts, passes = 2, closed = false) {
  let p = pts;
  for (let k = 0; k < passes; k++) {
    const out = closed ? [] : [p[0]], n = p.length;
    for (let i = 0; i < (closed ? n : n - 1); i++) {
      const a = p[i], b = p[(i + 1) % n];
      out.push({ x: a.x * 0.75 + b.x * 0.25, z: a.z * 0.75 + b.z * 0.25 }, { x: a.x * 0.25 + b.x * 0.75, z: a.z * 0.25 + b.z * 0.75 });
    }
    if (!closed) out.push(p[n - 1]);
    p = out;
  }
  return p;
}
// points every `step` along a polyline (the ends kept)
export function resample(pts, step) {
  if (pts.length < 2) return pts.slice();
  const out = [pts[0]]; let carry = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1], L = Math.hypot(b.x - a.x, b.z - a.z);
    let t = step - carry;
    while (t < L) { out.push({ x: a.x + (b.x - a.x) * t / L, z: a.z + (b.z - a.z) * t / L }); t += step; }
    carry = L - (t - step);
  }
  const last = pts[pts.length - 1], prev = out[out.length - 1];
  if (Math.hypot(last.x - prev.x, last.z - prev.z) > step * 0.3) out.push(last); else out[out.length - 1] = last;
  return out;
}
export const length = pts => { let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z); return L; };
// darts inside the polygon, at least `spacing` apart and `margin` in from its edge (best-candidate sampling)
export function scatter(poly, spacing, rand, { margin = 0, max = 80, jitter = 0.25 } = {}) {
  const b = bbox(poly), out = [], A = Math.abs(area(poly));
  const want = Math.min(max, Math.max(1, Math.round(A / (spacing * spacing * 0.87))));
  for (let i = 0, tries = 0; out.length < want && tries < want * 40; tries++) {
    const x = b.x0 + (b.x1 - b.x0) * rand(), z = b.z0 + (b.z1 - b.z0) * rand();
    if (!inside(poly, x, z) || (margin > 0 && edgeDist(poly, { x, z }) < margin)) continue;
    let ok = true; for (const p of out) if (Math.hypot(p.x - x, p.z - z) < spacing * (1 - jitter * rand())) { ok = false; break; }
    if (ok) { out.push({ x, z }); i++; }
  }
  if (!out.length) { const c = centroid(poly); out.push(c); }
  return out;
}

// ---------- geometry ----------
const T = () => THREE;
// split long edges until every edge is under maxEdge (so a draped surface follows the hills)
function tessellate(tris, maxEdge) {
  const out = [], stack = tris.slice();
  let guard = 0;
  while (stack.length && guard++ < 60000) {
    const t = stack.pop();   // t = [a, b, c] with {x, z}
    const l = [[0, 1], [1, 2], [2, 0]].map(([i, j]) => Math.hypot(t[i].x - t[j].x, t[i].z - t[j].z));
    const k = l.indexOf(Math.max(...l));
    if (l[k] <= maxEdge) { out.push(t); continue; }
    const i = k, j = (k + 1) % 3, o = (k + 2) % 3, m = { x: (t[i].x + t[j].x) / 2, z: (t[i].z + t[j].z) / 2 };
    stack.push([t[i], m, t[o]], [m, t[j], t[o]]);
  }
  return out.concat(stack);
}
// a polygon's top surface at height y (+ heightAt), facing up, with an optional vertical skirt of `skirt` m round
// its edge (the skirt is what the keyline pass sees as the area's pencil outline)
export function surfaceGeo(poly, { y = 0, heightAt = null, maxEdge = 0, skirt = 0, base = 0, top = true } = {}) {
  const THREE = T();
  let pts = poly.slice(); if (area(pts) < 0) pts.reverse();   // counter-clockwise in (x, z)
  const contour = pts.map(p => new THREE.Vector2(p.x, p.z));
  let tris;
  try { tris = THREE.ShapeUtils.triangulateShape(contour, []).map(f => f.map(i => pts[i])); }
  catch (e) { tris = []; }
  if (maxEdge > 0) tris = tessellate(tris, maxEdge);
  const H = (x, z) => (heightAt ? heightAt(x, z) - base : 0) + y;
  const pos = [];
  if (top) tris.forEach(([a, b, c]) => {   // wind every triangle so its normal points up
    const up = (b.z - a.z) * (c.x - a.x) - (b.x - a.x) * (c.z - a.z) > 0;
    const [p, q] = up ? [b, c] : [c, b];
    pos.push(a.x, H(a.x, a.z), a.z, p.x, H(p.x, p.z), p.z, q.x, H(q.x, q.z), q.z);
  });
  if (skirt > 0) {   // pts are counter-clockwise in (x, z): the outward normal of edge a->b is (dz, -dx)
    const ring = maxEdge > 0 ? resample(pts.concat([pts[0]]), maxEdge).slice(0, -1) : pts;
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length], ya = H(a.x, a.z), yb = H(b.x, b.z);
      face(pos, [a.x, ya, a.z], [b.x, yb, b.z], [b.x, yb - skirt, b.z], [a.x, ya - skirt, a.z], [b.z - a.z, 0, -(b.x - a.x)]);
    }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}
// a strip of `width` along a polyline: a top at y (+ heightAt) and, when h > 0, sides running down h (a wall,
// a kerbed road); the ends are capped. Mitred joints (clamped), so tight pencil turns stay tidy.
export function ribbonGeo(line, width, { y = 0, h = 0.1, heightAt = null, step = 0, base = 0, below = 0, top = true } = {}) {
  const THREE = T();
  let pts = step > 0 ? resample(line, step) : line.slice();
  if (pts.length < 2) return new THREE.BufferGeometry();
  const hw = width / 2, L = [], R = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], p = pts[i];
    let t = norm(b.x - a.x, b.z - a.z);
    let n = { x: -t.z, z: t.x }, k = 1;
    if (i > 0 && i < pts.length - 1) {   // mitre: scale by 1/cos(half the turn), clamped
      const t1 = norm(p.x - a.x, p.z - a.z), n1 = { x: -t1.z, z: t1.x };
      k = 1 / Math.max(0.5, n.x * n1.x + n.z * n1.z);
    }
    L.push({ x: p.x + n.x * hw * k, z: p.z + n.z * hw * k }); R.push({ x: p.x - n.x * hw * k, z: p.z - n.z * hw * k });
  }
  const H = (q, c) => (heightAt ? heightAt(c.x, c.z) - base : 0) + y + q;
  const pos = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const c0 = pts[i], c1 = pts[i + 1], tx = c1.x - c0.x, tz = c1.z - c0.z, nl = [-tz, 0, tx];   // nl: toward the left side
    const l0 = [L[i].x, H(0, c0), L[i].z], l1 = [L[i + 1].x, H(0, c1), L[i + 1].z], r0 = [R[i].x, H(0, c0), R[i].z], r1 = [R[i + 1].x, H(0, c1), R[i + 1].z];
    if (top) face(pos, l0, l1, r1, r0, [0, 1, 0]);
    if (h > 0) {
      const dn = v => [v[0], v[1] - h - below, v[2]];
      face(pos, l0, l1, dn(l1), dn(l0), nl); face(pos, r0, r1, dn(r1), dn(r0), [-nl[0], 0, -nl[2]]);
      if (i === 0) face(pos, l0, r0, dn(r0), dn(l0), [-tx, 0, -tz]);
      if (i === pts.length - 2) face(pos, l1, r1, dn(r1), dn(l1), [tx, 0, tz]);
    }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}
// a quad a-b-c-d emitted as two triangles wound so their normal points along `want`
function face(pos, a, b, c, d, want) {
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
  const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
  const flip = nx * want[0] + ny * want[1] + nz * want[2] < 0;
  const t = flip ? [a, c, b, a, d, c] : [a, b, c, a, c, d];
  t.forEach(v => pos.push(v[0], v[1], v[2]));
}
// merge geometries (position, normal and, when every one has it, color) into one non-indexed geometry
export function mergeGeos(geos, { colors = null } = {}) {
  const THREE = T();
  const flat = geos.filter(Boolean).map(g => (g.index ? g.toNonIndexed() : g));
  const withC = colors === null ? flat.length > 0 && flat.every(g => g.attributes.color) : colors;
  let n = 0; flat.forEach(g => { n += g.attributes.position.count; });
  const pos = new Float32Array(n * 3), nrm = new Float32Array(n * 3), col = withC ? new Float32Array(n * 3) : null;
  let o = 0;
  flat.forEach(g => {
    if (!g.attributes.normal) g.computeVertexNormals();
    const c = g.attributes.position.count;
    pos.set(g.attributes.position.array.subarray(0, c * 3), o * 3); nrm.set(g.attributes.normal.array.subarray(0, c * 3), o * 3);
    if (col) col.set(g.attributes.color.array.subarray(0, c * 3), o * 3);
    o += c;
  });
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  if (col) out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.computeBoundingSphere(); out.computeBoundingBox();
  return out;
}
