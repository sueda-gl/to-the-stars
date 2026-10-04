// Tavern: a two-storey saffron osteria under a terracotta gable, with an outside stone stair climbing the lit left
// wall to an upper door, a hanging red sign, barrels by the arched door, and a vine pergola over a terrace of little
// tables on the right, backed by a whitewashed storeroom. From above: the terracotta gable, a green vine canopy
// beside it and a pale terrace. Footprint 6 x 5, the front faces +z.
export const meta = { id: 'tavern', footprint: { w: 6, d: 5 }, height: 6.5 };

export function build(api) {
  const R = api.ramps, g = api.group();
  const saffron = api.lambert(api.pick(['#e3b468', '#e0ac5c', '#e6bb72']));
  const white = api.lambert('#efe4d2');
  const shutter = api.pick(['#4f7f8c', '#3d5588', '#6f8f5a']);
  const quiet = o => { o.traverse(m => { if (m.isMesh) api.colourOnly(m); }); return o; };
  const P = 0.22;

  // the terrace plinth everything stands on
  g.add(api.box({ w: 6.3, h: P, d: 4.9, x: -0.2, y: P / 2, ramp: R.LIMESTONE, speck: 0.22 }));

  // ---------- the osteria: x -2.5..0.8, z -2.3..1.1, two storeys ----------
  const BX = -0.85, BZ = -0.6, BW = 3.3, BD = 3.4, BH = 4.5, front = BZ + BD / 2;
  g.add(api.box({ w: BW, h: BH, d: BD, x: BX, y: P + BH / 2, z: BZ, mat: saffron }));
  g.add(api.box({ w: BW + 0.06, h: 0.16, d: BD + 0.06, x: BX, y: P + 2.3, z: BZ, ramp: R.LIMESTONE, lift: 0.05 }));    // floor band
  g.add(api.gableRoof({ w: BW, d: BD, h: 1.35, overhang: 0.26, x: BX, y: P + BH, z: BZ, ramp: R.TERRACOTTA }));
  g.add(api.box({ w: 0.46, h: 1.4, d: 0.46, x: -2.0, y: P + BH + 0.9, z: -1.45, mat: saffron }));                     // chimney
  g.add(api.box({ w: 0.6, h: 0.14, d: 0.6, x: -2.0, y: P + BH + 1.65, z: -1.45, ramp: R.TERRACOTTA }));

  // front: the arched door under a lintel, a ground window, two shuttered upper windows
  g.add(api.inkDoor({ w: 0.95, h: 1.8, x: -0.3, y: P, z: front }));
  g.add(api.box({ w: 1.35, h: 0.12, d: 0.42, x: -0.3, y: P + 2.0, z: front + 0.16, ramp: R.LIMESTONE }));
  g.add(api.inkWindow({ w: 0.7, h: 0.85, x: -1.75, y: P + 1.35, z: front, shutters: shutter }));
  g.add(api.inkWindow({ w: 0.6, h: 0.8, x: -1.75, y: P + 3.45, z: front, shutters: shutter }));
  g.add(api.inkWindow({ w: 0.6, h: 0.8, x: -0.3, y: P + 3.45, z: front, shutters: shutter }));
  // the hanging sign, sticking out from the front corner (the one red accent)
  g.add(api.box({ w: 0.07, h: 0.07, d: 0.8, x: 0.5, y: P + 2.95, z: front + 0.4, ramp: R.IRON }));
  g.add(api.box({ w: 0.08, h: 0.62, d: 0.66, x: 0.5, y: P + 2.55, z: front + 0.48, ramp: R.REDWALL }));
  g.add(api.sphere({ r: 0.16, sx: 0.4, x: 0.5, y: P + 2.55, z: front + 0.48, ramp: R.GOLD }));
  // barrels and a pot of geraniums by the door
  g.add(quiet(api.barrel({ r: 0.32, h: 0.82, x: 0.42, y: P, z: front + 0.45 })));
  g.add(quiet(api.barrel({ r: 0.28, h: 0.7, x: 0.42, y: P + 0.82, z: front + 0.45 })));
  g.add(api.pot({ r: 0.24, x: -1.0, y: P, z: front + 0.35, flowers: R.RED }));

  // ---------- the outside stair up the lit left wall, to an upper door ----------
  const SX = BX - BW / 2 - 0.43;                                                        // stair centre line
  g.add(api.stairs({ w: 0.85, steps: 9, rise: 0.24, run: 0.3, x: SX, y: P, z: -0.15, mat: white }));
  g.add(api.box({ w: 0.85, h: 2.16, d: 0.7, x: SX, y: P + 1.08, z: -1.95, mat: white }));                           // landing
  g.add(api.inkDoor({ w: 0.7, h: 1.45, x: BX - BW / 2, y: P + 2.16, z: -1.9, rot: -Math.PI / 2, frame: false }));
  g.add(api.inkWindow({ w: 0.5, h: 0.7, x: BX - BW / 2, y: P + 1.3, z: -1.25, rot: -Math.PI / 2 }));

  // ---------- the storeroom and the vine pergola (right) ----------
  g.add(api.box({ w: 2.0, h: 2.3, d: 1.2, x: 1.85, y: P + 1.15, z: -1.7, mat: white }));
  g.add(api.box({ w: 2.14, h: 0.14, d: 1.34, x: 1.85, y: P + 2.37, z: -1.7, ramp: R.LIMESTONE }));
  g.add(api.inkDoor({ w: 0.7, h: 1.4, x: 1.9, y: P, z: -1.1, frame: false }));
  const top = P + 2.5;
  const perg = api.group();
  [[2.72, -0.95], [2.72, 0.6], [2.72, 2.05], [1.0, 2.05]].forEach(([x, z]) => perg.add(api.box({ w: 0.14, h: top - P, d: 0.14, x, y: P + (top - P) / 2, z, ramp: R.WOOD })));
  [-0.95, 0.6, 2.05].forEach(z => perg.add(api.box({ w: 2.1, h: 0.12, d: 0.12, x: 1.8, y: top + 0.06, z, ramp: R.WOOD })));
  [1.0, 1.85, 2.72].forEach(x => perg.add(api.box({ w: 0.1, h: 0.1, d: 3.3, x, y: top + 0.17, z: 0.55, ramp: R.WOOD })));
  quiet(perg); g.add(perg);
  // the vine: three flattened painted mounds lying on the beams, one hanging down the front post
  // (smooth lumps: they draw their own soft pencil line)
  [[1.45, -0.35, 1.05], [2.2, 0.8, 1.05], [1.5, 1.7, 0.95]].forEach(([x, z, r]) => g.add(api.shrub({ r, h: 0.6, x, y: top + 0.02, z, ramp: R.OLIVE })));
  // a bougainvillea climbing the front post
  g.add(api.bush({ s: 0.42, spread: 0.7, lobes: 2, h: 2.4, flowers: R.PINK, bloom: 0.75, x: 2.95, y: P, z: 2.2 }));
  // two little tables with stools under the vine
  [[1.55, 0.0], [2.05, 1.4]].forEach(([x, z]) => {
    const t = api.group({ x, z });
    t.add(api.cylinder({ r: 0.38, h: 0.06, y: P + 0.74, ramp: R.WHITEWASH, seg: 16 }));
    t.add(api.cylinder({ r: 0.05, h: 0.72, y: P + 0.37, ramp: R.IRON, seg: 8 }));
    [[-0.55, 0.1], [0.5, -0.2]].forEach(([sx, sz]) => t.add(api.cylinder({ r: 0.17, h: 0.45, x: sx, y: P + 0.225, z: sz, ramp: R.WOOD, seg: 10 })));
    g.add(quiet(t));
  });

  // keylines: the osteria block, the storeroom
  api.proxy(api.boxGeo({ w: BW, h: BH, d: BD, x: BX, y: P + BH / 2, z: BZ }), g);
  return g;
}
