// Flat 2D helpers on the ground plane (x, z). Polygons are [[x,z],...] rings.

export function pointInPoly(x, z, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i], [xj, zj] = poly[j];
    if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

function segDist2(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz;
  let t = l2 ? ((px - ax) * dx + (pz - az) * dz) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  const qx = ax + t * dx, qz = az + t * dz;
  return (px - qx) ** 2 + (pz - qz) ** 2;
}

export function distToPoly(x, z, poly) {
  if (pointInPoly(x, z, poly)) return 0;
  let best = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    best = Math.min(best, segDist2(x, z, poly[j][0], poly[j][1], poly[i][0], poly[i][1]));
  }
  return Math.sqrt(best);
}

// distance to the nearest edge, inside or out (distToPoly is 0 inside)
export function distToEdge(x, z, poly) {
  let best = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) best = Math.min(best, segDist2(x, z, poly[j][0], poly[j][1], poly[i][0], poly[i][1]));
  return Math.sqrt(best);
}

export function polyCentroid(poly) {
  let x = 0, z = 0; for (const p of poly) { x += p[0]; z += p[1]; }
  return { x: x / poly.length, z: z / poly.length };
}

// rect = { x, z, w, d } centred on (x,z); margin grows both rects
export function rectsOverlap(a, b, margin = 0) {
  return Math.abs(a.x - b.x) < (a.w + b.w) / 2 + margin && Math.abs(a.z - b.z) < (a.d + b.d) / 2 + margin;
}

export function rectInPlot(r, plot, margin = 0) {
  return r.x - r.w / 2 >= plot.x0 + margin && r.x + r.w / 2 <= plot.x1 - margin &&
         r.z - r.d / 2 >= plot.z0 + margin && r.z + r.d / 2 <= plot.z1 - margin;
}

// true when the (margin-grown) rect touches the polygon: samples the rect border + interior grid, and polygon verts inside the rect
export function rectTouchesPoly(r, poly, margin = 0) {
  const w = r.w + 2 * margin, d = r.d + 2 * margin;
  const nx = Math.max(2, Math.ceil(w / 1.5)), nz = Math.max(2, Math.ceil(d / 1.5));
  for (let i = 0; i <= nx; i++) for (let j = 0; j <= nz; j++) {
    const x = r.x - w / 2 + (w * i) / nx, z = r.z - d / 2 + (d * j) / nz;
    if (pointInPoly(x, z, poly)) return true;
  }
  for (const [px, pz] of poly) if (Math.abs(px - r.x) <= w / 2 && Math.abs(pz - r.z) <= d / 2) return true;
  return false;
}

// an organic blob ~ (rx*2) by (rz*2) with seeded wobble
export function blobPoly(rng, cx, cz, rx, rz, n = 14) {
  const poly = [];
  const k1 = rng.range(0, Math.PI * 2), k2 = rng.range(0, Math.PI * 2);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const wob = 1 + 0.14 * Math.sin(a * 3 + k1) + 0.09 * Math.sin(a * 5 + k2) + rng.range(-0.05, 0.05);
    poly.push([+(cx + Math.cos(a) * rx * wob).toFixed(2), +(cz + Math.sin(a) * rz * wob).toFixed(2)]);
  }
  return poly;
}

export const dist = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);

// ---- marks: areas and lines on the ground ----
export function polyArea(poly) {
  let s = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) s += poly[j][0] * poly[i][1] - poly[i][0] * poly[j][1];
  return Math.abs(s) / 2;
}
// { x0, z0, x1, z1, w, d, x, z } of any point list
export function ptsBBox(pts) {
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (const [x, z] of pts) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (z < z0) z0 = z; if (z > z1) z1 = z; }
  return { x0, z0, x1, z1, w: x1 - x0, d: z1 - z0, x: (x0 + x1) / 2, z: (z0 + z1) / 2 };
}
export function polylineLength(pts) {
  let l = 0; for (let i = 1; i < pts.length; i++) l += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return l;
}
// the point a fraction t (0..1) along a polyline, with the heading there (radians, atan2(dz, dx))
export function pointAlong(pts, t) {
  if (pts.length === 1) return { x: pts[0][0], z: pts[0][1], angle: 0 };
  const total = polylineLength(pts);
  let want = Math.max(0, Math.min(1, t)) * total;
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i][0] - pts[i - 1][0], dz = pts[i][1] - pts[i - 1][1], l = Math.hypot(dx, dz);
    if (want <= l || i === pts.length - 1) { const k = l ? want / l : 0; return { x: pts[i - 1][0] + dx * k, z: pts[i - 1][1] + dz * k, angle: Math.atan2(dz, dx) }; }
    want -= l;
  }
  return { x: pts[0][0], z: pts[0][1], angle: 0 };
}
export function distToPolyline(x, z, pts) {
  if (pts.length === 1) return Math.hypot(x - pts[0][0], z - pts[0][1]);
  let best = Infinity;
  for (let i = 1; i < pts.length; i++) best = Math.min(best, segDist2(x, z, pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]));
  return Math.sqrt(best);
}
// true when the rect comes within `r` of the polyline (a road / wall of half-width r)
export function rectTouchesPolyline(rect, pts, r = 0) {
  const nx = Math.max(2, Math.ceil(rect.w / 1.5)), nz = Math.max(2, Math.ceil(rect.d / 1.5));
  for (let i = 0; i <= nx; i++) for (let j = 0; j <= nz; j++) {
    const x = rect.x - rect.w / 2 + (rect.w * i) / nx, z = rect.z - rect.d / 2 + (rect.d * j) / nz;
    if (distToPolyline(x, z, pts) <= r) return true;
  }
  for (const [px, pz] of pts) if (Math.abs(px - rect.x) <= rect.w / 2 + r && Math.abs(pz - rect.z) <= rect.d / 2 + r) return true;
  return false;
}
// the four corners of a rect, as a polygon
export const rectPoly = r => [[r.x - r.w / 2, r.z - r.d / 2], [r.x + r.w / 2, r.z - r.d / 2], [r.x + r.w / 2, r.z + r.d / 2], [r.x - r.w / 2, r.z + r.d / 2]];
// the k-th point of a low-discrepancy sequence inside a polygon (k = 0, 1, 2 ...): folk work a field at spread-out spots
export function pointInsidePoly(poly, k = 0) {
  const bb = ptsBBox(poly);
  for (let i = 0; i < 40; i++) {
    const n = k * 40 + i + 1;
    const x = bb.x0 + bb.w * ((n * 0.6180339887) % 1), z = bb.z0 + bb.d * ((n * 0.7548776662) % 1);
    if (pointInPoly(x, z, poly)) return { x: +x.toFixed(2), z: +z.toFixed(2) };
  }
  return polyCentroid(poly);
}
