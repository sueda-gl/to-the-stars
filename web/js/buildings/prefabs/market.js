// Market: a whitewashed loggia of three round limestone arches under a terracotta hip roof (crates and barrels in
// its shade), and in front of it three trestle stalls under striped canvas awnings, heaped with oranges, lemons and
// melons. A pale paved square holds it all. From above: one terracotta roof and three striped awnings in a row.
// Footprint 7 x 5, the stalls face +z.
export const meta = { id: 'market', footprint: { w: 7, d: 5 }, height: 4.6 };

export function build(api) {
  const R = api.ramps, g = api.group();
  const wall = api.lambert('#efe4d2');
  const stone = api.lambert('#e6d6b6');
  const P = 0.16;                                   // paving height

  // the paved square
  g.add(api.box({ w: 7, h: P, d: 5, y: P / 2, ramp: R.LIMESTONE, speck: 0.24 }));

  // ---------- the loggia (back): z from -2.45 to -0.45 ----------
  const LZ = -1.45, LD = 2.0, LW = 6.6, H = 3.3;
  g.add(api.box({ w: LW, h: H, d: 0.36, y: P + H / 2, z: -2.27, mat: wall }));                       // back wall
  g.add(api.box({ w: 0.42, h: H, d: LD, x: -LW / 2 + 0.21, y: P + H / 2, z: LZ, mat: wall }));        // side walls
  g.add(api.box({ w: 0.42, h: H, d: LD, x: LW / 2 - 0.21, y: P + H / 2, z: LZ, mat: wall }));
  g.add(api.archWall({ w: LW, h: H, d: 0.4, arches: 3, archW: 1.55, archH: 2.75, y: P, z: -0.65, mat: stone }));   // the arcade
  g.add(api.box({ w: LW + 0.16, h: 0.18, d: LD + 0.16, y: P + H + 0.02, z: LZ, ramp: R.LIMESTONE }));  // cornice
  g.add(api.hipRoof({ w: LW, d: LD, h: 1.05, overhang: 0.32, y: P + H + 0.11, z: LZ, ramp: R.TERRACOTTA }));
  // the arcade's depth reads as ink: a dark lining inside the back and side walls
  g.add(api.colourOnly(api.box({ w: LW - 0.86, h: H - 0.1, d: 0.04, y: P + (H - 0.1) / 2, z: -2.07, ramp: R.INK, lift: 0.1, speck: 0.08 })));
  g.add(api.colourOnly(api.box({ w: 0.04, h: H - 0.1, d: LD - 0.8, x: -LW / 2 + 0.44, y: P + (H - 0.1) / 2, z: LZ - 0.2, ramp: R.INK, lift: 0.1, speck: 0.08 })));
  g.add(api.colourOnly(api.box({ w: 0.04, h: H - 0.1, d: LD - 0.8, x: LW / 2 - 0.44, y: P + (H - 0.1) / 2, z: LZ - 0.2, ramp: R.INK, lift: 0.1, speck: 0.08 })));
  // goods in the shade of the arcade
  // (colour only: the arcade keeps its own pencil arches, the clutter inside doesn't scribble)
  const quiet = o => { o.traverse(m => { if (m.isMesh) api.colourOnly(m); }); return o; };
  g.add(quiet(api.barrel({ r: 0.32, h: 0.8, x: -2.1, y: P, z: -1.65 })));
  g.add(quiet(api.crate({ s: 0.55, x: -1.45, y: P, z: -1.75, rot: 0.3 })));
  g.add(quiet(api.crate({ s: 0.5, x: 0.15, y: P, z: -1.8, rot: -0.2 })));
  g.add(quiet(api.barrel({ r: 0.3, h: 0.75, x: 2.2, y: P, z: -1.7 })));

  // ---------- three stalls (front) ----------
  const canvas = api.pick([[R.REDWALL, R.OCHRE, R.REDWALL], [R.OCHRE, R.REDWALL, R.OCHRE], [R.REDWALL, R.SAGE, R.REDWALL]]);
  const fruit = [[R.RED, R.YELLOW], [R.SAGE, R.OCHRE], [R.YELLOW, R.RED]];
  const SX = [-2.3, 0, 2.3], SW = 1.95;
  const zB = 0.45, zF = 2.1, yB = P + 2.1, yF = P + 1.7;           // awning: back edge high, front edge low
  const L = Math.hypot(zF - zB, yB - yF), tilt = Math.atan2(yB - yF, zF - zB);
  for (let i = 0; i < 3; i++) {
    const s = api.group({ x: SX[i] });
    // trestle table and two crates of fruit heaped high
    s.add(api.box({ w: 1.55, h: 0.72, d: 0.8, y: P + 0.36, z: 1.2, ramp: R.WOOD }));
    for (let k = 0; k < 2; k++) {
      const cx = k ? 0.38 : -0.38;
      s.add(api.colourOnly(api.box({ w: 0.66, h: 0.18, d: 0.62, x: cx, y: P + 0.81, z: 1.2, ramp: R.WOOD, lift: 0.08 })));
      s.add(api.sphere({ r: 0.34, sy: 0.5, sz: 0.9, x: cx, y: P + 0.92, z: 1.2, ramp: fruit[i][k], speck: 0.3, seg: 14 }));
    }
    // four posts (thin: colour only)
    [[-0.92, zB + 0.08, yB], [0.92, zB + 0.08, yB], [-0.92, zF - 0.1, yF], [0.92, zF - 0.1, yF]].forEach(([px, pz, top]) => {
      s.add(api.colourOnly(api.box({ w: 0.08, h: top - P, d: 0.08, x: px, y: P + (top - P) / 2, z: pz, ramp: R.WOOD })));
    });
    // the awning: one cream canvas sheet (it draws the keyline), coloured stripes laid on it, a scalloped valance
    const midY = (yB + yF) / 2, midZ = (zB + zF) / 2;
    s.add(api.box({ w: SW, h: 0.05, d: L, y: midY, z: midZ, rx: tilt, ramp: R.WHITEWASH, lift: 0.05 }));
    for (let k = 0; k < 3; k++) {
      s.add(api.colourOnly(api.box({ w: SW / 6, h: 0.02, d: L * 0.995, x: -SW / 2 + SW / 12 + k * SW / 3, y: midY + 0.035, z: midZ, rx: tilt, ramp: canvas[i] })));
    }
    s.add(api.box({ w: SW, h: 0.24, d: 0.04, y: yF - 0.12, z: zF + 0.02, ramp: canvas[i] }));
    g.add(s);
  }

  // ---------- the overflow: sacks, crates, a barrel, a lemon tree in a pot ----------
  g.add(api.crate({ s: 0.5, x: -3.15, y: P, z: 0.15, rot: 0.15 }));
  g.add(api.crate({ s: 0.42, x: -3.12, y: P + 0.5, z: 0.15, rot: -0.25 }));
  g.add(api.sphere({ r: 0.3, sy: 0.75, x: -3.15, y: P + 0.22, z: 0.8, ramp: R.SAND, speck: 0.2 }));
  g.add(api.barrel({ r: 0.3, h: 0.78, x: 3.15, y: P, z: 0.25 }));
  g.add(api.pot({ r: 0.32, x: 3.1, y: P, z: 2.1, plant: R.OLIVE, flowers: R.YELLOW }));
  return g;
}
