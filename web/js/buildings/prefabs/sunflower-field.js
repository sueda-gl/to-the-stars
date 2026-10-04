// Sunflower field: rows of tall sunflowers, a dark-green band of leaves along each row and the big yellow
// heads above it, all turned toward the front and the light (from above: green stripes studded with
// yellow discs; close up: a crowd of faces taller than the folk). The heads nod slowly. 11 x 10 m.
export const meta = {
  id: 'sunflower-field', name: 'Sunflower field', category: 'farm', stage: 'village', area: true,
  aliases: ['sunflowers', 'sunflower', 'sunflower fields', 'field of sunflowers', 'ayçiçeği tarlası', 'ayçiçeği', 'günebakan'],
  footprint: { w: 11, d: 10 }, height: 2.3,
  desc: 'rows of tall sunflowers over dark-green leaf bands, the yellow heads all facing the light'
};

const LEAF = ['#253116', '#3a4b1f', '#536a2a', '#667f33', '#748d3a'];
const hump = (w, h) => [[-w / 2, 0], [-w * 0.48, h * 0.45], [-w * 0.34, h * 0.85], [0, h], [w * 0.34, h * 0.85], [w * 0.48, h * 0.45], [w / 2, 0]];
const arch = (w, h) => { const p = [[-w / 2, 0]]; for (let k = 1; k < 12; k++) { const a = Math.PI * k / 12; p.push([-Math.cos(a) * w / 2, Math.sin(a) * h]); } p.push([w / 2, 0]); return p; };   // a smooth half-ellipse (row outlines)
const PETAL = ['#8a5414', '#c08519', '#e1a623', '#ecbb2c', '#f2c83c'];
const SEED = ['#22160f', '#33231a', '#463024', '#55392a', '#5e412f'];

export function build(api) {
  const R = api.ramps, g = api.group();
  const W = 11, D = 10, L = D - 1.2;
  const n = 6, pitch = (W - 0.4) / n, per = 8;   // wide rows, narrow furrows: a stripe the brush keeps
  for (let i = 0; i < n; i++) {
    const x = -W / 2 + 0.2 + pitch * (i + 0.5);
    // the leaf mass: a continuous green bank (it keeps the stripe at a distance) under a line of big leafy lumps
    // that scallop its top; one smooth outline per row
    g.add(api.extrude({ shape: hump(pitch - 0.25, 1.05), depth: L - 0.5, x, y: 0, ramp: LEAF, speck: 0.08, lift: -0.08 }));
    api.proxy(api.extrudeGeo({ shape: arch(Math.min(pitch - 0.1, 1.45), 1.38), depth: L - 0.1, x, y: 0 }), g);
    for (let j = 0; j < 10; j++) {
      const z = -L / 2 + 0.2 + (j + 0.5) * (L - 0.4) / 10, r = api.range(0.56, 0.66);
      g.add(api.sphere({ r, sy: 1.0, sx: 1.05, x: x + api.range(-0.07, 0.07), y: r * api.range(1.0, 1.15), z, ramp: LEAF, speck: 0.1, lift: api.range(-0.08, 0.06) + (i % 2 ? 0.03 : -0.02), seg: 14 }));
    }
    const heads = api.group({ x }); heads.name = 'heads' + i;
    for (let j = 0; j < per; j++) {
      const z = -L / 2 + (j + 0.5) * L / per + api.range(-0.15, 0.15), y = api.range(1.85, 2.2), hx = api.range(-0.12, 0.12);
      const tilt = api.range(0.75, 0.95), turn = api.range(-0.35, 0.05);   // facing the front and the light (upper left)
      heads.add(api.cylinder({ r: 0.05, h: y - 1.2, x: hx, y: 1.2 + (y - 1.2) / 2, z, ramp: R.OLIVE }));
      const rr = api.range(0.36, 0.42);
      heads.add(api.cylinder({ r: rr, h: 0.07, seg: 14, x: hx, y, z, rx: tilt, rot: turn, ramp: PETAL, speck: 0.1 }));
      const nx = Math.sin(turn) * Math.sin(tilt) * 0.05, nz = Math.cos(turn) * Math.sin(tilt) * 0.05, ny = Math.cos(tilt) * 0.05;
      heads.add(api.cylinder({ r: rr * 0.48, h: 0.06, seg: 12, x: hx + nx, y: y + ny, z: z + nz, rx: tilt, rot: turn, ramp: SEED, speck: 0.1 }));
    }
    g.add(heads);
  }
  const xs = []; for (let i = 0; i < n; i++) xs.push(-W / 2 + 0.2 + pitch * (i + 0.5));
  earth(api, g, W, D, xs, pitch - 0.25, L, '#7a5838');
  return g;
}

// the heads nod a little in the breeze, row by row
export function animate(obj, t) {
  for (let i = 0; i < 6; i++) {
    const h = obj.getObjectByName('heads' + i);
    if (h) h.rotation.z = Math.sin(t * 0.9 - i * 0.7) * 0.012;
  }
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
