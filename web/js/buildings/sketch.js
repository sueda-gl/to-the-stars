// Massing sketch -> Build API group. The fast /api/sketch answer is drawn in pencil at once (reveal.sketch),
// and painted only if the real code never arrives.
//
// massing = { name, footprint:{w,d}, height, parts:[{ shape, x, y, z, w, h, d | r, rot?, color }] }   (<= 16 parts)
//   shape: 'box' | 'cylinder' | 'cone' | 'sphere' | 'gable' | 'dome'
//   (x, y, z) is the CENTRE of the part's bounding box (so a 2 m box on the ground has y: 1); sizes in metres.
//   box / gable: w, h, d.  cylinder / cone: r (or w/2), h.  sphere: r.  dome: r, h (default r).
//   rot: turn about the vertical axis, radians (|rot| > 6.3 is read as degrees). color: '#hex' (any colour; it is
//   turned into a painted ramp). Unknown shapes become boxes; parts beyond 16 are dropped.
import { normalise } from './api.js';

export const SAMPLE_MASSING = {   // ?massing=demo in the gallery: a lighthouse, as a fast model might rough it
  name: 'Lighthouse', footprint: { w: 4, d: 4 }, height: 10.4,
  parts: [
    { shape: 'cylinder', x: 0, y: 0.3, z: 0, r: 2.0, h: 0.6, color: '#dcc7a7' },
    { shape: 'cylinder', x: 0, y: 4.1, z: 0, r: 1.3, h: 7.0, color: '#efe4d2' },
    { shape: 'cylinder', x: 0, y: 2.6, z: 0, r: 1.42, h: 0.6, color: '#c23a2c' },
    { shape: 'cylinder', x: 0, y: 5.4, z: 0, r: 1.36, h: 0.6, color: '#c23a2c' },
    { shape: 'cylinder', x: 0, y: 7.8, z: 0, r: 1.5, h: 0.3, color: '#4a3848' },
    { shape: 'cylinder', x: 0, y: 8.55, z: 0, r: 0.85, h: 1.2, color: '#f2c42a' },
    { shape: 'cone', x: 0, y: 9.65, z: 0, r: 1.15, h: 1.0, color: '#c23a2c' },
    { shape: 'box', x: 2.3, y: 0.9, z: 0.4, w: 2.0, h: 1.8, d: 1.8, color: '#efe4d2' },
    { shape: 'gable', x: 2.3, y: 2.2, z: 0.4, w: 2.0, h: 0.8, d: 1.8, color: '#cf6a3f' }
  ]
};

const n = (v, d) => (typeof v === 'number' && isFinite(v) ? v : d);
const clampSize = (v, d) => Math.max(0.05, Math.min(40, n(v, d)));

export function renderSketchFromMassing(api, massing = {}) {
  const g = api.group();
  const parts = Array.isArray(massing.parts) ? massing.parts.slice(0, 16) : [];
  if (!parts.length) {   // nothing usable: a footprint-sized block, so there is always something to draw
    const fp = massing.footprint || { w: 3, d: 3 }, h = clampSize(massing.height, 3);
    parts.push({ shape: 'box', x: 0, y: h / 2, z: 0, w: clampSize(fp.w, 3), h, d: clampSize(fp.d, 3), color: '#efe4d2' });
  }
  parts.forEach(p => {
    let rot = n(p.rot, 0); if (Math.abs(rot) > 6.3) rot = rot * Math.PI / 180;
    const x = n(p.x, 0), y = n(p.y, 0), z = n(p.z, 0), color = typeof p.color === 'string' && /^#?[0-9a-f]{3,8}$/i.test(p.color.trim()) ? (p.color.trim()[0] === '#' ? p.color.trim() : '#' + p.color.trim()) : '#e9dfcf';
    const r = clampSize(p.r, n(p.w, 1) / 2), w = clampSize(p.w, r * 2), h = clampSize(p.h, 1), d = clampSize(p.d, w);
    const shape = String(p.shape || 'box').toLowerCase();
    let m;
    switch (shape) {
      case 'cylinder': m = api.cylinder({ r, h, x, y, z, rot, ramp: color, seg: 24 }); break;
      case 'cone': m = api.cone({ r, h, x, y, z, rot, ramp: color, seg: 24 }); break;
      case 'sphere': m = api.sphere({ r, x, y, z, ramp: color, seg: 20 }); break;
      case 'dome': { const dh = clampSize(p.h, r); m = api.dome({ r, h: dh, x, y: y - dh / 2, z, ramp: color }); break; }
      case 'gable': case 'roof': m = api.gableRoof({ w, d, h, overhang: 0, x, y: y - h / 2, z, rot, ramp: color }); break;
      default: m = api.box({ w, h, d, x, y, z, rot, ramp: color });
    }
    m.userData.agora.massing = shape;
    g.add(m);
  });
  const out = normalise(api, g, { name: massing.name || 'sketch' });
  out.userData.agora = Object.assign(out.userData.agora || {}, { sketch: true, name: massing.name || 'sketch' });
  return out;
}
