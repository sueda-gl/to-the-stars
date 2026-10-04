// Tower: a pale limestone watchtower over the bay. A square shaft on a stepped plinth, an arched ink door and slit
// windows, a string course, then a red belvedere: two round-headed arches a side opening onto ink-dark shade (the
// Red arch's red, the Tower Road's attic arcade), a stone cornice, a terracotta pyramid roof, a gilded finial and a
// red pennant. A cypress at the lit back corner. From above: a terracotta pyramid on a pale square with a long cast
// shadow. Footprint 4 x 4.
export const meta = { id: 'tower', footprint: { w: 4, d: 4 }, height: 13.9 };

export function build(api) {
  const R = api.ramps, g = api.group();
  const stone = api.lambert('#e8d9bc');
  const red = api.lambert('#c23a2c', 0.08);

  // plinth: two low steps
  g.add(api.box({ w: 3.9, h: 0.24, d: 3.9, y: 0.12, ramp: R.LIMESTONE }));
  g.add(api.box({ w: 3.45, h: 0.26, d: 3.45, y: 0.37, ramp: R.LIMESTONE, lift: 0.04 }));
  const B = 0.5;

  // the shaft, with a slight batter: a broad lower stage and a narrower upper stage
  const S1 = 3.0, H1 = 3.6, S2 = 2.8, H2 = 3.0;
  g.add(api.box({ w: S1, h: H1, d: S1, y: B + H1 / 2, mat: stone }));
  g.add(api.box({ w: S1 + 0.14, h: 0.16, d: S1 + 0.14, y: B + H1 + 0.02, ramp: R.LIMESTONE }));
  g.add(api.box({ w: S2, h: H2, d: S2, y: B + H1 + H2 / 2, mat: stone }));
  const T = B + H1 + H2;                                                       // top of the shaft
  g.add(api.box({ w: S2 + 0.3, h: 0.22, d: S2 + 0.3, y: T + 0.11, ramp: R.LIMESTONE, lift: 0.04 }));   // string course

  // door and slit windows: front (+z) and the lit left face (-x)
  g.add(api.inkDoor({ w: 1.0, h: 1.95, y: B, z: S1 / 2 }));
  g.add(api.archOpening({ w: 0.34, h: 0.85, y: B + 2.85, z: S1 / 2, frame: false }));
  g.add(api.archOpening({ w: 0.34, h: 0.85, y: B + H1 + 1.6, z: S2 / 2, frame: false }));
  g.add(api.archOpening({ w: 0.34, h: 0.85, x: -S1 / 2, y: B + 1.9, rot: -Math.PI / 2, frame: false }));
  g.add(api.archOpening({ w: 0.34, h: 0.85, x: -S2 / 2, y: B + H1 + 1.4, rot: -Math.PI / 2, frame: false }));

  // ---------- the belvedere: four red arcaded faces round an ink-dark core ----------
  const Y = T + 0.22, BH = 2.5, BS = 3.0, th = 0.3;
  const arc = { h: BH, d: th, arches: 2, archW: 0.82, archH: 1.85, y: Y, mat: red };
  g.add(api.archWall(Object.assign({ w: BS, z: BS / 2 - th / 2 }, arc)));
  g.add(api.archWall(Object.assign({ w: BS, z: -BS / 2 + th / 2 }, arc)));
  g.add(api.archWall(Object.assign({ w: BS - th * 2, x: -BS / 2 + th / 2, rot: Math.PI / 2 }, arc)));
  g.add(api.archWall(Object.assign({ w: BS - th * 2, x: BS / 2 - th / 2, rot: Math.PI / 2 }, arc)));
  g.add(api.colourOnly(api.box({ w: BS - th * 2 - 0.08, h: BH - 0.05, d: BS - th * 2 - 0.08, y: Y + BH / 2, ramp: R.INK, lift: 0.08, speck: 0.06 })));

  // cornice, pyramid roof, finial, pennant
  const C = Y + BH;
  g.add(api.box({ w: BS + 0.4, h: 0.3, d: BS + 0.4, y: C + 0.15, ramp: R.LIMESTONE, lift: 0.04 }));
  g.add(api.hipRoof({ w: BS + 0.2, d: BS + 0.2, h: 1.9, overhang: 0.18, y: C + 0.3, ramp: R.TERRACOTTA }));
  const apex = C + 0.3 + 1.9;
  g.add(api.sphere({ r: 0.17, y: apex + 0.05, ramp: R.GOLD }));
  g.add(api.flag({ pole: 1.5, w: 0.95, h: 0.42, y: apex - 0.1, ramp: R.REDWALL }));

  // a cypress tucked behind the lit back corner, for scale and the coast's grammar
  g.add(api.cypress({ h: 5.2, w: 0.62, x: -1.8, z: -1.55 }));

  api.proxy(api.boxGeo({ w: S1, h: H1, d: S1, y: B + H1 / 2 }), g);
  api.proxy(api.boxGeo({ w: S2, h: H2, d: S2, y: B + H1 + H2 / 2 }), g);
  return g;
}
