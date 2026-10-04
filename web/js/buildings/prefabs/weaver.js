// Weaver's workshop: a whitewashed house under a terracotta hip roof, and beside it an open pergola (a linen
// awning over its back half) sheltering two floor looms, one weaving indigo, one madder red; in front, lengths of
// dyed cloth laid out on the ground to dry and two hanging on a line down the lit side, and three dye vats (indigo, madder,
// saffron) showing their colours to the sky. From above: one hip roof, a slatted pergola with looms, long bands
// of colour on the ground and three coloured discs. Footprint 6.2 x 5.8, the house door faces +z.
export const meta = {
  id: 'weaver', name: "Weaver's workshop",
  aliases: ['weaver', 'weavers', "weaver's workshop", 'weaving', 'weaving workshop', 'loom', 'looms', 'textile', 'textiles', 'dyer', 'dyers', 'dye works', 'cloth', 'dokumacı', 'dokuma', 'tezgah', 'boyahane'],
  category: 'building', stage: 'village', footprint: { w: 6.2, d: 5.8 }, height: 3.4,
  desc: 'A whitewashed house with two looms under a pergola, dyed cloth drying on the ground and on a line, and three dye vats.'
};

export function build(api) {
  const R = api.ramps, g = api.group();
  const P = 0.14;
  const INDIGO = ['#1a2140', '#26345e', '#334574', '#425789', '#566b9b'];
  const MADDER = R.REDWALL, SAFFRON = R.OCHRE, LINEN = ['#9e9078', '#c4b698', '#e2d6bc', '#eee4cf', '#f6efe0'];
  g.add(api.box({ w: 6.2, h: P, d: 2.9, y: P / 2, z: -1.2, ramp: R.LIMESTONE, speck: 0.22 }));   // paving under house + pergola

  // ---- the house (back left) ----
  const hx = -1.6, hz = -1.3, hw = 2.9, hd = 2.4, hh = 2.6;
  g.add(api.box({ w: hw, h: hh, d: hd, x: hx, y: P + hh / 2, z: hz, mat: api.lambert('#efe4d2') }));
  g.add(api.hipRoof({ w: hw, d: hd, h: 1.05, overhang: 0.28, x: hx, y: P + hh, z: hz, ramp: R.TERRACOTTA }));
  g.add(api.inkDoor({ w: 0.85, h: 1.6, x: hx - 0.55, y: P, z: hz + hd / 2 }));
  g.add(api.inkWindow({ w: 0.6, h: 0.75, x: hx + 0.65, y: P + 1.5, z: hz + hd / 2, shutters: INDIGO }));
  g.add(api.inkWindow({ w: 0.5, h: 0.65, x: hx - hw / 2, y: P + 1.55, z: hz, rot: -Math.PI / 2, shutters: INDIGO }));

  // ---- the pergola (right): four posts, two beams, slats; linen awning over its back half ----
  const px = 1.45, pz = -1.2, pw = 2.9, pd = 2.5, ph = 2.3;
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => g.add(api.box({ w: 0.14, h: ph, d: 0.14, x: px + a * (pw / 2 - 0.08), y: P + ph / 2, z: pz + b * (pd / 2 - 0.08), ramp: R.WOOD })));
  [-1, 1].forEach(b => g.add(api.box({ w: pw + 0.3, h: 0.14, d: 0.12, x: px, y: P + ph + 0.07, z: pz + b * (pd / 2 - 0.08), ramp: R.WOOD })));
  for (let i = 0; i < 7; i++) g.add(api.colourOnly(api.box({ w: 0.08, h: 0.08, d: pd + 0.3, x: px - pw / 2 + 0.15 + i * (pw - 0.3) / 6, y: P + ph + 0.18, z: pz, ramp: R.WOOD, lift: 0.05 })));
  g.add(api.box({ w: pw + 0.2, h: 0.04, d: pd * 0.52, x: px, y: P + ph + 0.25, z: pz - pd * 0.25, rx: -0.06, ramp: LINEN, lift: 0.04 }));

  // two floor looms under it: a frame, the cream warp, the woven cloth in its colour, a beam on top
  [[px - 0.7, INDIGO], [px + 0.7, MADDER]].forEach(([lx, cloth]) => {
    const lz = pz + 0.35;
    [[-0.5, -0.55], [0.5, -0.55], [-0.5, 0.55], [0.5, 0.55]].forEach(([dx, dz]) => g.add(api.colourOnly(api.box({ w: 0.08, h: 1.3, d: 0.08, x: lx + dx, y: P + 0.65, z: lz + dz, ramp: R.WOOD }))));
    g.add(api.box({ w: 1.1, h: 0.1, d: 0.1, x: lx, y: P + 1.32, z: lz - 0.1, ramp: R.WOOD }));                         // the heddle beam
    g.add(api.box({ w: 0.9, h: 0.03, d: 0.75, x: lx, y: P + 0.86, z: lz - 0.2, rx: 0.12, ramp: LINEN, lift: 0.06 }));     // warp
    g.add(api.box({ w: 0.9, h: 0.04, d: 0.5, x: lx, y: P + 0.82, z: lz + 0.38, ramp: cloth }));                            // cloth
    g.add(api.cylinder({ r: 0.08, h: 1.05, x: lx, y: P + 0.8, z: lz + 0.62, rz: Math.PI / 2, ramp: cloth, seg: 10 }));     // cloth beam
    api.proxy(api.boxGeo({ w: 1.1, h: 1.35, d: 1.2, x: lx, y: P + 0.68, z: lz }), g);
  });

  // ---- cloth drying: long lengths laid on the ground, two more hanging on a line ----
  const lengths = [[-2.4, INDIGO], [-1.55, LINEN], [-0.7, MADDER], [0.15, SAFFRON]];
  lengths.forEach(([x, c], i) => g.add(api.box({ w: 0.62, h: 0.03, d: 2.1, x, y: 0.03, z: 1.35 + (i % 2) * 0.12, rot: 0.03 * (i - 1.5), ramp: c, speck: 0.14, lift: -0.1 })));
  // the line runs down the house's lit side, the two lengths hanging square to it
  const lineX = -3.45;
  [-2.4, 0.2].forEach(z => g.add(api.box({ w: 0.08, h: 1.9, d: 0.08, x: lineX, y: 0.95, z, ramp: R.WOOD })));
  g.add(api.colourOnly(api.box({ w: 0.025, h: 0.025, d: 2.6, x: lineX, y: 1.86, z: -1.1, ramp: R.SAND })));
  [[-1.85, INDIGO], [-0.5, MADDER]].forEach(([z, c]) => g.add(api.box({ w: 0.03, h: 1.1, d: 0.8, x: lineX, y: 1.3, z, ramp: c })));

  // ---- three dye vats ----
  [[1.15, INDIGO], [1.95, MADDER], [2.75, SAFFRON]].forEach(([x, c], i) => {
    const z = 1.55 + (i % 2) * 0.35;
    g.add(api.cylinder({ rb: 0.36, rt: 0.42, h: 0.62, x, y: 0.31, z, ramp: R.TERRACOTTA, lift: -0.04, seg: 18 }));
    g.add(api.colourOnly(api.cylinder({ r: 0.35, h: 0.03, x, y: 0.63, z, ramp: c, seg: 18 })));
    g.add(api.colourOnly(api.torus({ r: 0.4, tube: 0.04, x, y: 0.63, z, ramp: R.TERRACOTTA, seg: 24 })));
  });
  const kind = api.pick(['lemon', 'olive', 'cypress', 'oak', 'olive']);
  g.add(api.tree({ kind, h: kind === 'cypress' ? 4.2 : 2.9, x: -2.7, z: -3.0 }));

  api.proxy(api.boxGeo({ w: hw, h: hh, d: hd, x: hx, y: P + hh / 2, z: hz }), g);
  return g;
}
