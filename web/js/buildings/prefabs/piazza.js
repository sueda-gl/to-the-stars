// Piazza: a paved town square. Terracotta brick paving divided by broad limestone bands into four quarters,
// a raised round stone dais with a sundial post, a raised kerb round the edge, stone benches facing in, iron
// lamp posts at the band ends and a shade tree at each corner (a different kind for each, as the square grew).
// It is an area: drawn as a loop, it fills it. From above: the cross of pale bands on red brick, the round dais, the four
// crowns at the corners. Footprint 14 x 14.
export const meta = {
  id: 'piazza', name: 'Piazza',
  aliases: ['piazza', 'piazzas', 'square', 'town square', 'plaza', 'plazas', 'forum', 'agora square', 'paved square', 'meydan', 'meydanlar', 'çarşı meydanı'],
  category: 'building', stage: 'town', footprint: { w: 14, d: 14 }, height: 5.5, area: true,
  desc: 'A brick-paved town square with stone bands, benches, lamps and corner trees.'
};

export function build(api) {
  const R = api.ramps, g = api.group();
  const S = 14, K = 0.18;

  // The paving is laid side by side, never one slab on another: a thin slab over a hidden face a few
  // centimetres below it flickers through in the painter's depth buffer from the leader's height.
  // the kerb: a pale frame round the edge
  const KW = 0.35, H2 = S / 2;
  [-1, 1].forEach(s => {
    g.add(api.box({ w: S, h: K, d: KW, y: K / 2, z: s * (H2 - KW / 2), ramp: R.LIMESTONE, lift: -0.04, speck: 0.2 }));
    g.add(api.box({ w: KW, h: K, d: S - 2 * KW, x: s * (H2 - KW / 2), y: K / 2, ramp: R.LIMESTONE, lift: -0.04, speck: 0.2 }));
  });
  // four brick quarters and the cross of limestone bands between them, flush with each other
  const BH = K - 0.02, BW = 1.3, Q = H2 - KW - BW / 2;   // quarter size
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) =>
    g.add(api.box({ w: Q, h: BH, d: Q, x: a * (BW / 2 + Q / 2), y: BH / 2, z: b * (BW / 2 + Q / 2), ramp: R.TERRACOTTA, lift: -0.06, speck: 0.3 })));
  const arm = H2 - KW;
  [-1, 1].forEach(s => {
    g.add(api.box({ w: BW, h: BH, d: arm, z: s * arm / 2, y: BH / 2, ramp: R.LIMESTONE, lift: 0.06, speck: 0.12 }));
    g.add(api.box({ w: arm - BW / 2, h: BH, d: BW, x: s * (BW / 2 + (arm - BW / 2) / 2), y: BH / 2, ramp: R.LIMESTONE, lift: 0.06, speck: 0.12 }));
  });
  // the central dais: a raised round of stone (well clear of the paving) with the sundial post on it
  const DH = 0.5;
  g.add(api.cylinder({ r: 2.5, h: DH, y: DH / 2, seg: 40, ramp: R.LIMESTONE, lift: 0.08, speck: 0.1 }));
  // its brick heart, a step higher (a full 0.3 m, so nothing flickers), reads as a red round from above
  g.add(api.cylinder({ r: 1.85, h: 0.3, y: DH + 0.15, seg: 40, ramp: R.TERRACOTTA, lift: 0.02, speck: 0.25 }));
  g.add(api.column({ r: 0.2, h: 1.5, y: DH + 0.3, ramp: R.LIMESTONE }));
  g.add(api.cone({ r: 0.32, h: 0.55, y: DH + 0.3 + 1.5 + 0.27, seg: 4, rot: Math.PI / 4, ramp: R.GOLD }));   // the gnomon

  // benches: two on each side band, facing in
  const bench = (x, z, rot) => {
    const b = api.group({ x, y: BH, z, rot });
    b.add(api.box({ w: 1.6, h: 0.12, d: 0.48, y: 0.42, ramp: R.LIMESTONE, lift: 0.06 }));
    [-0.6, 0.6].forEach(dx => b.add(api.box({ w: 0.22, h: 0.36, d: 0.4, x: dx, y: 0.18, ramp: R.LIMESTONE, lift: -0.08 })));
    g.add(b);
  };
  const E = S / 2 - 1.1;
  [-1, 1].forEach(s => {
    bench(s * 2.6, -E, 0); bench(s * 2.6, E, Math.PI);
    bench(-E, s * 2.6, Math.PI / 2); bench(E, s * 2.6, -Math.PI / 2);
  });
  // lamp posts at the ends of the bands
  [[0, -E], [0, E], [-E, 0], [E, 0]].forEach(([x, z]) => {
    g.add(api.cylinder({ rb: 0.1, rt: 0.06, h: 2.6, x, y: K + 1.3 - 0.02, z, ramp: R.IRON, seg: 8 }));
    g.add(api.box({ w: 0.32, h: 0.4, d: 0.32, x, y: K + 2.78, z, ramp: R.GOLD, lift: 0.06 }));
    g.add(api.cone({ r: 0.28, h: 0.22, x, y: K + 3.09, z, seg: 4, rot: Math.PI / 4, ramp: R.IRON }));
  });

  // a tree at each corner, each one its own kind, in a round stone surround
  const kinds = ['olive', 'oak', 'lemon', 'pine', 'cypress', 'orange', 'olive', 'oak'];
  const C = S / 2 - 2.3;
  [[-C, -C], [C, -C], [-C, C], [C, C]].forEach(([x, z]) => {
    g.add(api.torus({ r: 0.85, tube: 0.16, x, y: K + 0.08, z, seg: 24, ramp: R.LIMESTONE, lift: -0.02 }));
    const k = api.pick(kinds);
    if (k === 'pine') g.add(api.pine({ h: 5.4, x, y: 0, z }));
    else if (k === 'cypress') g.add(api.cypress({ h: api.range(4.6, 5.6), x, y: 0, z }));
    else g.add(api.tree({ kind: k, h: k === 'oak' ? 4.4 : 3.0, x, y: 0, z }));
  });
  return g;
}
