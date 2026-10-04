// Generic fallback: code generated FROM the massing sketch (mock/sketch.js), so an unknown noun still gets a
// painted object made of the same few primitives the pencil drew. Colours map to the nearest Build API ramp.
import { SKETCH_PALETTE as P } from '../../schemas.js';

// sketch colour -> api.ramps.* name (hex from the Red arch grammar; any other hex is passed through as a colour ramp)
const RAMP_OF = {
  [P.terracotta]: 'TERRACOTTA', [P.red]: 'REDWALL', [P.limestone]: 'LIMESTONE', [P.cream]: 'WHITEWASH', [P.stone]: 'SAND', [P.ink]: 'INK',
  [P.glass]: 'GLASS', [P.wood]: 'WOOD', [P.trunk]: 'WOOD', [P.pine]: 'PINE', [P.olive]: 'OLIVE', [P.pink]: 'PINK', [P.gold]: 'GOLD',
  [P.teal]: 'SEA', [P.sea]: 'SEA',
};
const rampExpr = (hex) => { const h = String(hex || '').toLowerCase(); const n = RAMP_OF[h]; return n ? `R.${n}` : /^#[0-9a-f]{6}$/.test(h) ? `'${h}'` : 'R.LIMESTONE'; };
const f = (n) => Number(Math.round(n * 1000) / 1000);
const pos = (p) => `x: ${f(p.x)}, y: ${f(p.y)}, z: ${f(p.z)}`;
const yaw = (p) => (p.rot ? `, rot: ${f(p.rot)}` : '');

// One sketch part -> one api call. Solids are centre-placed like the sketch; roofs and domes take their base
// (BUILD_API.md: y = eaves), so the sketch's centre becomes y - h/2.
function partLine(p) {
  const ramp = rampExpr(p.color);
  switch (p.shape) {
    case 'cylinder': return `g.add(api.cylinder({ r: ${f(p.r)}, h: ${f(p.h)}, ${pos(p)}${yaw(p)}, seg: 20, ramp: ${ramp} }));`;
    case 'cone': return `g.add(api.cone({ r: ${f(p.r)}, h: ${f(p.h)}, ${pos(p)}${yaw(p)}, seg: 20, ramp: ${ramp} }));`;
    case 'sphere': return `g.add(api.sphere({ r: ${f(p.r)}, ${pos(p)}, seg: 20, ramp: ${ramp} }));`;
    case 'dome': return `g.add(api.dome({ r: ${f(p.r)}, h: ${f(p.h)}, x: ${f(p.x)}, y: ${f(p.y - p.h / 2)}, z: ${f(p.z)}, ramp: ${ramp} }));`;
    case 'gable': return `g.add(api.gableRoof({ w: ${f(p.w)}, d: ${f(p.d)}, h: ${f(p.h)}, overhang: 0.15, x: ${f(p.x)}, y: ${f(p.y - p.h / 2)}, z: ${f(p.z)}${yaw(p)}, ramp: ${ramp} }));`;
    default: return `g.add(api.box({ w: ${f(p.w)}, h: ${f(p.h)}, d: ${f(p.d)}, ${pos(p)}${yaw(p)}, ramp: ${ramp} }));`;
  }
}

// The biggest part gets a smooth proxy so the keylines read as one mass.
function proxyLine(parts) {
  const big = [...parts].sort((a, b) => (b.w * b.h * b.d) - (a.w * a.h * a.d))[0];
  if (!big) return '';
  if (big.shape === 'sphere' || big.shape === 'dome') return `api.proxy(api.sphereGeo({ r: ${f(big.r)}, ${pos(big)} }), g);`;
  if (big.shape === 'cylinder' || big.shape === 'cone') return `api.proxy(api.cylinderGeo({ r: ${f(big.r)}, h: ${f(big.h)}, ${pos(big)} }), g);`;
  return `api.proxy(api.boxGeo({ w: ${f(big.w)}, h: ${f(big.h)}, d: ${f(big.d)}, ${pos(big)} }), g);`;
}

export function codeFromSketch(sketch) {
  const parts = (sketch?.parts || []).slice(0, 16);
  return `function build(api) {
  var R = api.ramps, g = api.group();
  // raised from the Ministry's massing sketch: ${parts.length} parts
  ${parts.map(partLine).join('\n  ')}
  ${proxyLine(parts)}
  return g;
}`;
}

export default {
  key: 'generic', name: 'Thing', aliases: [],
  meta: { footprint: { w: 4, d: 4 }, cost: { wood: 5, stone: 9, coin: 2 }, workers: 2, skill: 'building', buildSeconds: 70, perDay: {}, housing: 0, category: 'building', desc: 'Raised from the Ministry\'s massing sketch, in the painted grammar.' },
  code: null, // filled per request by codeFromSketch(mockSketch(request))
};
