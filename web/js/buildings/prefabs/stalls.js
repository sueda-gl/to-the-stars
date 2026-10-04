// Market stalls: a row of four trestle stalls under little striped tents (ridge along the row, cream and
// madder or cream and ochre in turn), on a strip of limestone paving: fruit heaped in crates, a stall of pots,
// a spice stall with its coloured cones, bolts of dyed cloth; baskets and crates in front. From above: four
// striped gables in a line. Footprint 9.6 x 3.4, the stalls face +z.
export const meta = {
  id: 'stalls', name: 'Market stalls',
  aliases: ['stalls', 'stall', 'market stalls', 'market stall', 'stall row', 'row of stalls', 'bazaar', 'bazaars', 'souk', 'fair', 'street market', 'pazar', 'pazar tezgahları', 'tezgah', 'çarşı'],
  category: 'building', stage: 'hamlet', footprint: { w: 9.6, d: 3.4 }, height: 2.5,
  desc: 'A row of four striped tent stalls on paving: fruit, pots, spice cones and bolts of cloth.'
};

export function build(api) {
  const R = api.ramps, g = api.group();
  const P = 0.1;
  g.add(api.box({ w: 9.6, h: P, d: 3.2, y: P / 2, ramp: R.LIMESTONE, speck: 0.24 }));
  const CREAM = ['#a39686', '#c9bda9', '#e6dcc8', '#f1e9d9', '#f8f2e5'];
  const colours = [R.REDWALL, R.OCHRE, R.REDWALL, R.OCHRE];
  const kinds = ['fruit', 'pots', 'spice', 'cloth'];
  const N = 4, gap = 2.35, TW = 2.0, half = 0.92, eave = P + 1.8, ridge = P + 2.4;
  const sl = Math.hypot(half, ridge - eave), ang = Math.atan2(ridge - eave, half);
  for (let s = 0; s < N; s++) {
    const x = (s - (N - 1) / 2) * gap, c = colours[s], st = api.group({ x });
    // four posts and the trestle
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => st.add(api.colourOnly(api.box({ w: 0.08, h: eave - P, d: 0.08, x: a * (TW / 2 - 0.08), y: (eave + P) / 2, z: b * (half - 0.1), ramp: R.WOOD }))));
    st.add(api.box({ w: 1.7, h: 0.08, d: 0.8, y: P + 0.74, z: 0.25, ramp: R.WOOD }));
    st.add(api.colourOnly(api.box({ w: 1.5, h: 0.7, d: 0.06, y: P + 0.35, z: 0.25, ramp: R.WOOD, lift: -0.1 })));
    // the tent: two striped slopes, a valance in the colour along the front
    const n = 6, sw = TW / n;
    [-1, 1].forEach(side => {
      for (let i = 0; i < n; i++)
        st.add(api.box({ w: sw + 0.005, h: 0.04, d: sl, x: -TW / 2 + sw * (i + 0.5), y: (eave + ridge) / 2, z: side * half / 2, rx: side * ang, ramp: i % 2 ? CREAM : c, lift: i % 2 ? 0 : 0.02 }));
    });
    st.add(api.box({ w: TW, h: 0.22, d: 0.04, y: eave - 0.1, z: half + 0.02, ramp: c }));
    api.proxy(api.extrudeGeo({ shape: [[-half - 0.02, 0], [half + 0.02, 0], [0, ridge - eave + 0.03]], depth: TW, rot: Math.PI / 2, x, y: eave }), g);
    // goods on the trestle
    const ty = P + 0.78, k = kinds[s];
    if (k === 'fruit') {
      [[-0.45, R.RED], [0.0, R.YELLOW], [0.45, R.SAGE]].forEach(([dx, fr]) => {
        st.add(api.colourOnly(api.box({ w: 0.42, h: 0.14, d: 0.5, x: dx, y: ty + 0.07, z: 0.25, ramp: R.WOOD, lift: 0.08 })));
        st.add(api.sphere({ r: 0.24, sy: 0.55, sz: 1.15, x: dx, y: ty + 0.17, z: 0.25, ramp: fr, speck: 0.3, seg: 12 }));
      });
    } else if (k === 'pots') {
      [-0.55, -0.15, 0.25, 0.6].forEach((dx, i) => st.add(api.pot({ r: 0.13 + (i % 2) * 0.04, h: 0.3 + (i % 2) * 0.12, plant: false, x: dx, y: ty, z: 0.22 + (i % 2) * 0.12, ramp: i === 2 ? R.BLUE : R.TERRACOTTA })));
    } else if (k === 'spice') {
      [[-0.55, R.OCHRE], [-0.18, R.RED], [0.18, R.YELLOW], [0.55, R.SAGE]].forEach(([dx, sp]) => {
        st.add(api.colourOnly(api.cylinder({ r: 0.17, h: 0.1, x: dx, y: ty + 0.05, z: 0.25, ramp: R.WOOD, lift: 0.1, seg: 12 })));
        st.add(api.cone({ r: 0.16, h: 0.3, x: dx, y: ty + 0.25, z: 0.25, ramp: sp, speck: 0.3, seg: 12 }));
      });
    } else {
      [[R.BLUE, -0.3], [CREAM, 0.0], [R.REDWALL, 0.3]].forEach(([cl, dz], i) => st.add(api.cylinder({ r: 0.12, h: 1.3, y: ty + 0.12 + (i === 1 ? 0.12 : 0), z: 0.25 + dz * 0.6, rz: Math.PI / 2, ramp: cl, seg: 12 })));
    }
    // in front: a basket or a crate
    if (s % 2) st.add(api.crate({ s: 0.42, x: 0.6, y: P, z: 1.25, rot: 0.3 }));
    else st.add(api.cylinder({ rb: 0.2, rt: 0.26, h: 0.3, x: -0.55, y: P + 0.15, z: 1.25, ramp: R.SAND, seg: 12 }));
    g.add(st);
  }
  return g;
}
