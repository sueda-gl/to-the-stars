// Marks: what the sovereign drew on the paper with the cursor (ART_DIRECTION §5, ARCHITECTURE §10), as the sim reads it.
// A mark is never arbitrary: a point IS the centre, an area IS the shape, a line IS the route. This module only
// normalises the shapes the marks module (web/js/marks/marks.js) or the server may hand over; placement is in state.js.

import { polyCentroid, polyArea, ptsBBox, polylineLength, pointAlong, rectPoly } from './geometry.js';

const num = v => (Number.isFinite(Number(v)) ? Number(v) : null);
const pt = p => (Array.isArray(p) ? [num(p[0]), num(p[1])] : p && typeof p === 'object' ? [num(p.x), num(p.z)] : [null, null]);
const ptsOf = list => (Array.isArray(list) ? list.map(pt).filter(([x, z]) => x != null && z != null).map(([x, z]) => [+x.toFixed(2), +z.toFixed(2)]) : []);

// a bbox in any of the shapes a client might send: {x0,z0,x1,z1} | {x,z,w,d} | {min:{x,z},max:{x,z}} | [[x0,z0],[x1,z1]]
function bboxOf(b) {
  if (!b) return null;
  if (Array.isArray(b) && b.length === 2) return bboxOf({ min: { x: b[0][0], z: b[0][1] }, max: { x: b[1][0], z: b[1][1] } });
  if (typeof b !== 'object') return null;
  if (b.min && b.max) return bboxOf({ x0: b.min.x, z0: b.min.z, x1: b.max.x, z1: b.max.z });
  if (num(b.x0) != null && num(b.x1) != null && num(b.z0) != null && num(b.z1) != null) {
    const x0 = Math.min(num(b.x0), num(b.x1)), x1 = Math.max(num(b.x0), num(b.x1)), z0 = Math.min(num(b.z0), num(b.z1)), z1 = Math.max(num(b.z0), num(b.z1));
    return { x0, z0, x1, z1, w: x1 - x0, d: z1 - z0, x: (x0 + x1) / 2, z: (z0 + z1) / 2 };
  }
  if (num(b.x) != null && num(b.z) != null && num(b.w) != null && num(b.d) != null) return bboxOf({ x0: num(b.x) - num(b.w) / 2, x1: num(b.x) + num(b.w) / 2, z0: num(b.z) - num(b.d) / 2, z1: num(b.z) + num(b.d) / 2 });
  return null;
}

// -> null | { kind:'point', x, z, id? }
//         | { kind:'area', x, z, poly, bbox, areaM2, id? }      (x, z = the centroid)
//         | { kind:'line', x, z, pts, bbox, length, id? }       (x, z = the midpoint along the line)
// Accepts the marks module's current() shape, its summarize() shape (centroid / bbox only: the area becomes its bbox
// rectangle, the line its longer diagonal) and the server's echo. Anything without a usable position is null.
export function normaliseMark(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const kind = String(raw.kind || raw.type || '').toLowerCase();
  const id = raw.id != null ? raw.id : undefined;
  const c = raw.centroid || raw.center || raw.centre || null;
  const poly = ptsOf(raw.poly || raw.polygon || raw.points);
  const pts = ptsOf(raw.pts || raw.line || raw.path || (kind === 'line' ? raw.points : null));
  const bb = bboxOf(raw.bbox || raw.bounds);
  if (kind === 'area' || (!kind && poly.length >= 3)) {
    let ring = poly.length >= 3 ? poly : bb && bb.w > 0 && bb.d > 0 ? rectPoly(bb) : [];
    if (ring.length >= 3) {
      if (ring.length > 3 && ring[0][0] === ring.at(-1)[0] && ring[0][1] === ring.at(-1)[1]) ring = ring.slice(0, -1);   // closed ring: drop the repeat
      const cc = pt(c); const cen = cc[0] != null && cc[1] != null ? { x: cc[0], z: cc[1] } : polyCentroid(ring);
      const area = num(raw.areaM2) ?? num(raw.area) ?? polyArea(ring);
      return { kind: 'area', x: +cen.x.toFixed(2), z: +cen.z.toFixed(2), poly: ring, bbox: ptsBBox(ring), areaM2: +Math.max(0, area).toFixed(1), ...(id !== undefined ? { id } : {}) };
    }
  }
  if (kind === 'line' || (!kind && pts.length >= 2)) {
    let line = pts.length >= 2 ? pts : bb && (bb.w > 0 || bb.d > 0) ? [[bb.x0, bb.z0], [bb.x1, bb.z1]] : [];
    if (line.length >= 2) {
      const mid = pointAlong(line, 0.5);
      const length = num(raw.length) ?? polylineLength(line);
      return { kind: 'line', x: +mid.x.toFixed(2), z: +mid.z.toFixed(2), angle: mid.angle, pts: line, bbox: ptsBBox(line), length: +Math.max(0, length).toFixed(1), ...(id !== undefined ? { id } : {}) };
    }
  }
  // a point: x/z, else the centroid, else a single polygon / line point, else the bbox centre
  const cands = [[num(raw.x), num(raw.z)], pt(c), poly[0] || [null, null], pts[0] || [null, null], bb ? [bb.x, bb.z] : [null, null]];
  for (const [x, z] of cands) if (x != null && z != null) return { kind: 'point', x: +x.toFixed(2), z: +z.toFixed(2), ...(id !== undefined ? { id } : {}) };
  return null;
}

// the compact form that goes to the LLM (no polygon): what marks.summarize() produces
export function summariseMark(mark) {
  const m = normaliseMark(mark);
  if (!m) return null;
  const r = v => Math.round(v * 10) / 10;
  const base = { kind: m.kind, centroid: { x: r(m.x), z: r(m.z) } };
  if (m.kind === 'point') return base;
  base.bbox = { x0: r(m.bbox.x0), z0: r(m.bbox.z0), x1: r(m.bbox.x1), z1: r(m.bbox.z1), w: r(m.bbox.w), d: r(m.bbox.d) };
  if (m.kind === 'area') base.areaM2 = r(m.areaM2); else base.length = r(m.length);
  return base;
}
