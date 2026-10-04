// Vineyard: rows of vines trained on wooden posts, each row a long line of leafy lumps lifted on gnarled
// trunks, dark grape clusters hanging under it, a pale sandy alley between rows and a red rose bush at the
// head of every other row (the vintner's old warning flower, and the one accent). 12 x 10 m.
export const meta = {
  id: 'vineyard', name: 'Vineyard', category: 'farm', stage: 'village', area: true,
  aliases: ['vineyards', 'vines', 'vine rows', 'grapevines', 'grape vines', 'grapes', 'wine field', 'bağ', 'üzüm bağı', 'bağlık'],
  footprint: { w: 12, d: 10 }, height: 1.8,
  desc: 'vine rows on wooden posts, green canopies over hanging grapes, sandy alleys, roses at the row ends'
};

const VINE = ['#2f3d17', '#46591f', '#5f7529', '#728a33', '#82993d'];
const GRAPE = ['#1e1428', '#2f1f3c', '#45305a', '#59406f', '#694d80'];
const canopy = (w, h) => [[-w * 0.3, 0], [-w / 2, h * 0.35], [-w * 0.46, h * 0.8], [-w * 0.2, h], [w * 0.2, h], [w * 0.46, h * 0.8], [w / 2, h * 0.35], [w * 0.3, 0]];
const ROSE = ['#4e1020', '#86203a', '#b23450', '#c84a62', '#d65d72'];

export function build(api) {
  const R = api.ramps, g = api.group();
  const W = 12, D = 10, L = D - 1.6;
  const n = 6, pitch = (W - 0.6) / n;
  for (let i = 0; i < n; i++) {
    const x = -W / 2 + 0.3 + pitch * (i + 0.5);
    // the canopy on its trunks: a continuous leaf core (keeps the row a stripe at a distance) under a line of leafy
    // lumps trained along the wires (scalloped top and sides), one smooth outline per row
    g.add(api.extrude({ shape: canopy(1.15, 0.86), depth: L - 0.3, x, y: 0.64, ramp: VINE, speck: 0.08, lift: -0.08 }));
    api.proxy(api.extrudeGeo({ shape: canopy(1.4, 1.02), depth: L + 0.05, x, y: 0.6 }), g);
    for (let j = 0; j < 11; j++) {
      const z = -L / 2 + (j + 0.5) * L / 11, r = api.range(0.44, 0.52);
      g.add(api.sphere({ r, sx: 1.25, sy: 1.0, sz: 1.1, x: x + api.range(-0.05, 0.05), y: 1.08 + api.range(-0.05, 0.08), z, ramp: VINE, speck: 0.1, lift: api.range(-0.07, 0.06) + (i % 2 ? 0.03 : 0), seg: 12 }));
    }
    for (let j = 0; j < 6; j++) {
      const z = -L / 2 + 0.5 + j * (L - 1) / 5;
      g.add(api.cylinder({ rb: 0.07, rt: 0.05, h: 0.62, x: x + api.range(-0.05, 0.05), y: 0.1 + 0.31, z, rz: api.range(-0.2, 0.2), ramp: R.WOOD, lift: -0.08 }));
    }
    // posts at both ends and in the middle, standing a little above the leaves
    [-L / 2 - 0.12, 0, L / 2 + 0.12].forEach(z => g.add(api.box({ w: 0.1, h: 1.75, d: 0.1, x, y: 0.1 + 0.875, z, ramp: R.WOOD })));
    // grape clusters under the canopy edge, on the front and lit sides
    for (let k = 0; k < 5; k++) {
      const side = k % 2 ? 1 : -1, z = -L / 2 + 0.8 + k * (L - 1.6) / 4 + api.range(-0.3, 0.3);
      g.add(api.cone({ r: 0.16, h: 0.38, x: x + side * 0.5, y: 0.6, z, rx: Math.PI, ramp: GRAPE, speck: 0.1, seg: 8 }));
    }
    if (i % 2 === 0) {   // a rose bush in full flower at the row head: one deep-rose mound with a smaller one on top
      g.add(api.sphere({ r: 0.4, sy: 0.85, x, y: 0.1 + 0.34, z: L / 2 + 0.6, ramp: ROSE, speck: 0.1, lift: -0.06, seg: 12 }));
      g.add(api.sphere({ r: 0.24, sy: 0.9, x: x - 0.06, y: 0.1 + 0.68, z: L / 2 + 0.56, ramp: ROSE, speck: 0.1, lift: 0.04, seg: 10 }));
    }
  }
  const xs = []; for (let i = 0; i < n; i++) xs.push(-W / 2 + 0.3 + pitch * (i + 0.5));
  earth(api, g, W, D, xs, 1.2, L + 0.3, '#a99a62');
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
