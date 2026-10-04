// Lavender field: Provence rows of round lavender cushions in long purple lines over pale ochre earth (from
// above: purple stripes; close up: a scalloped line of separate bushes), with one tree standing in the back
// corner (an olive, an oak or an umbrella pine, picked at random). 12 x 10 m, rows run front to back.
export const meta = {
  id: 'lavender-field', name: 'Lavender field', category: 'farm', stage: 'village', area: true,
  aliases: ['lavender', 'lavender fields', 'lavender rows', 'field of lavender', 'lavanta tarlası', 'lavanta', 'lavantalık'],
  footprint: { w: 12, d: 10 }, height: 3,
  desc: 'long purple rows of round lavender cushions on pale ochre earth, a lone tree in the back corner'
};

const LAV_A = ['#3b2c50', '#56447a', '#7563a0', '#8a79b4', '#9a8bc2'];
const hump = (w, h) => [[-w / 2, 0], [-w * 0.48, h * 0.45], [-w * 0.34, h * 0.85], [0, h], [w * 0.34, h * 0.85], [w * 0.48, h * 0.45], [w / 2, 0]];
const arch = (w, h) => { const p = [[-w / 2, 0]]; for (let k = 1; k < 12; k++) { const a = Math.PI * k / 12; p.push([-Math.cos(a) * w / 2, Math.sin(a) * h]); } p.push([w / 2, 0]); return p; };   // a smooth half-ellipse (row outlines)
const LAV_B = ['#3f2f52', '#5d4880', '#7c66a6', '#927db9', '#a392c7'];

export function build(api) {
  const g = api.group();
  const W = 12, D = 10;

  // rows of cushions on a continuous lavender bank: the bank keeps the row a solid purple stripe when the brush
  // works at a distance (separate small cushions would be painted out), the cushions scallop its top and sides.
  // One smooth outline per row. The first row stops short at the back to leave the corner to the tree
  const n = 7, pitch = (W - 0.6) / n, per = 8, L = D - 1.2;   // wide rows, narrow furrows: a stripe the brush keeps
  for (let i = 0; i < n; i++) {
    const x = -W / 2 + 0.3 + pitch * (i + 0.5), ramp = i % 2 ? LAV_A : LAV_B;
    const j0 = i === 0 ? 2 : 0, za = -L / 2 + j0 * L / per, zb = L / 2, zc = (za + zb) / 2, len = zb - za;
    g.add(api.extrude({ shape: hump(pitch - 0.2, 0.8), depth: len - 0.5, x, y: 0, z: zc, ramp, speck: 0.08, lift: -0.08 }));
    api.proxy(api.extrudeGeo({ shape: arch(pitch - 0.12, 1.12), depth: len + 0.05, x, y: 0, z: zc }), g);
    for (let j = j0; j < per; j++) {
      const z = -L / 2 + (j + 0.5) * L / per + api.range(-0.06, 0.06), r = api.range(0.64, 0.72);
      g.add(api.sphere({ r, sy: 0.8, x: x + api.range(-0.05, 0.05), y: r * 0.8, z, ramp, speck: 0.1, lift: api.range(-0.06, 0.06), seg: 14 }));
    }
  }

  const xs = []; for (let i = 0; i < n; i++) xs.push(-W / 2 + 0.3 + pitch * (i + 0.5));
  earth(api, g, W, D, xs, pitch - 0.2, L, '#bf9a62', [[xs[0] - (pitch - 0.2) / 2, xs[0] + (pitch - 0.2) / 2, -L / 2, -L / 2 + 2 * L / per]]);
  // one tree in the back-left corner, kind picked at random
  const kind = api.pick(['olive', 'olive', 'oak', 'pine']);
  const tx = -W / 2 + 1.35, tz = -D / 2 + 1.5;
  if (kind === 'pine') g.add(api.pine({ h: 5.0, x: tx, z: tz, leanTo: [1, 0.4] }));
  else g.add(api.tree({ kind, h: kind === 'oak' ? 3.8 : 3.0, x: tx, y: 0.06, z: tz, leanTo: [1, 0.3] }));
  return g;
}

// The earth between and around the rows, laid as strips that never sit under a row. (A slab under the rows
// would be a ground-hugger with a polygon-offset material: at the leader's distance it paints over anything
// less than about a metre above it, and the rows vanish into the soil.)
function earth(api, g, W, D, xs, rw, L, ramp, holes) {
  const strip = (x0, x1, z0, z1) => { if (x1 - x0 > 0.02 && z1 - z0 > 0.02) g.add(api.box({ w: x1 - x0, h: 0.06, d: z1 - z0, x: (x0 + x1) / 2, y: 0.03, z: (z0 + z1) / 2, color: ramp, speck: 0.08 })); };
  let x = -W / 2;
  xs.forEach(cx => { strip(x, cx - rw / 2, -L / 2, L / 2); x = cx + rw / 2; });
  strip(x, W / 2, -L / 2, L / 2);
  strip(-W / 2, W / 2, -D / 2, -L / 2); strip(-W / 2, W / 2, L / 2, D / 2);
  (holes || []).forEach(h => strip(h[0], h[1], h[2], h[3]));
}
