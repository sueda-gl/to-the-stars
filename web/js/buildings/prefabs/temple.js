// Temple: a small peripteral temple on a three-stepped limestone crepidoma. Fourteen pale columns (4 x 5) carry a
// stone entablature and a terracotta gable with stone pediments; inside the colonnade stands a red-walled cella
// (the Red arch's own red) with a tall ink doorway. Two cypresses stand at its flanks, by the front corners.
// From above: a long terracotta gable on a stepped pale square. Footprint 8 x 8, the portico faces +z.
export const meta = { id: 'temple', footprint: { w: 8, d: 8 }, height: 6.6 };

export function build(api) {
  const R = api.ramps, g = api.group();
  const stone = api.lambert('#e6d6b8');
  const red = api.lambert('#c23a2c', 0.08);

  // ---------- crepidoma: three steps ----------
  const steps = [[6.6, 7.6], [6.0, 7.0], [5.4, 6.4]], SH = 0.25;
  steps.forEach(([w, d], i) => g.add(api.box({ w, h: SH, d, y: SH * (i + 0.5), mat: i === 2 ? stone : undefined, ramp: R.LIMESTONE, lift: 0.04 * i })));
  const B = SH * 3;                                                       // stylobate top

  // ---------- the cella (red), inside the colonnade ----------
  const CH = 3.3, CW = 2.7, CD = 3.6, CZ = -0.35;
  g.add(api.box({ w: CW, h: CH, d: CD, y: B + CH / 2, z: CZ, mat: red }));
  g.add(api.inkDoor({ w: 1.1, h: 2.35, y: B, z: CZ + CD / 2, frame: R.LIMESTONE }));
  api.proxy(api.boxGeo({ w: CW, h: CH, d: CD, y: B + CH / 2, z: CZ }), g);

  // ---------- the peristyle: 4 across, 5 deep ----------
  const XS = [-2.1, -0.7, 0.7, 2.1], ZS = [-2.7, -1.35, 0, 1.35, 2.7], cr = 0.25, colH = 3.3;
  ZS.forEach((z, j) => XS.forEach((x, i) => {
    if (j > 0 && j < ZS.length - 1 && i > 0 && i < XS.length - 1) return;   // only the outer ring
    g.add(api.column({ r: cr, h: colH, x, y: B, z, mat: stone }));
  }));

  // ---------- entablature, gable roof (ridge along z), stone pediments ----------
  const EW = 4.9, ED = 6.1, EH = 0.5, top = B + colH;
  g.add(api.box({ w: EW, h: EH, d: ED, y: top + EH / 2, ramp: R.LIMESTONE }));
  g.add(api.box({ w: EW + 0.2, h: 0.14, d: ED + 0.2, y: top + EH + 0.07, ramp: R.LIMESTONE, lift: 0.06 }));
  const eaves = top + EH + 0.14, over = 0.22, RH = 1.35;
  g.add(api.gableRoof({ w: ED, d: EW, h: RH, overhang: over, y: eaves, rot: Math.PI / 2, ramp: R.TERRACOTTA }));
  // the pediments: pale triangles just proud of each gable end, leaving a terracotta rim
  const tri = [[-EW / 2 + 0.12, 0.04], [EW / 2 - 0.12, 0.04], [0, RH - 0.14]];
  [1, -1].forEach(s => g.add(api.extrude({ shape: tri, depth: 0.06, y: eaves, z: s * (ED / 2 + over + 0.035), ramp: R.LIMESTONE, lift: 0.06 })));
  // gilded acroteria at the ridge ends
  [1, -1].forEach(s => g.add(api.sphere({ r: 0.17, y: eaves + RH + 0.1, z: s * (ED / 2 + over - 0.05), ramp: R.GOLD })));

  // ---------- a bronze brazier on the front steps, two cypresses at the corners ----------
  g.add(api.cylinder({ rt: 0.32, rb: 0.12, h: 0.32, y: B + 0.55, z: 2.05, ramp: R.GOLD, seg: 16 }));
  g.add(api.cylinder({ r: 0.06, h: 0.42, y: B + 0.21, z: 2.05, ramp: R.IRON, seg: 8 }));
  g.add(api.cypress({ h: 5.6, w: 0.78, x: -3.5, z: 1.7 }));
  g.add(api.cypress({ h: 5.1, w: 0.72, x: 3.5, z: 2.2 }));
  return g;
}
