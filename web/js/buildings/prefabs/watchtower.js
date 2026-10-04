// Watchtower: the camp's lookout. Four log legs leaning in on stone footings, X-braced on every side, carry a
// plank platform closed by a solid board parapet; corner posts hold a pyramid of thatch with a red pennant on
// top, and a ladder climbs the front. Footprint 3.6 x 4.4, the ladder faces +z.
export const meta = {
  id: 'watchtower', name: 'Wooden watchtower', aliases: ['watchtowers', 'watch tower', 'lookout', 'lookout tower', 'wooden tower', 'guard tower', 'gözetleme kulesi', 'nöbet kulesi', 'kule'],
  category: 'building', stage: 'camp', footprint: { w: 3.6, d: 4.4 }, height: 9.0,
  desc: 'A log lookout on four X-braced legs: plank platform, board parapet, thatched pyramid roof and a ladder.'
};

export function build(api) {
  const R = api.ramps, g = api.group();
  const foot = 1.25, head = 0.95, P = 5.0;        // leg half-spread at the ground and at the platform, platform height
  const thatch = '#c49a52';
  const at = (y, s) => s * (foot + (head - foot) * (y / P));   // a leg's x or z at height y

  // stone footings and four legs leaning in
  const corners = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
  corners.forEach(([sx, sz]) => {
    g.add(api.box({ w: 0.5, h: 0.3, d: 0.5, x: sx * foot, y: 0.15, z: sz * foot, ramp: R.LIMESTONE, lift: -0.04 }));
    const len = Math.hypot(P, (foot - head) * Math.SQRT2), tilt = Math.atan2(foot - head, P);
    g.add(api.cylinder({ rb: 0.15, rt: 0.12, h: len + 0.2, x: sx * (foot + head) / 2, y: P / 2 + 0.2, z: sz * (foot + head) / 2,
      rz: sx * tilt, rx: -sz * tilt, ramp: R.WOOD, seg: 9 }));
  });

  // X braces on all four sides, and a ring of girts at mid height
  const brace = (x0, y0, z0, x1, y1, z1) => g.add(api.tube({ points: [[x0, y0, z0], [x1, y1, z1]], r: 0.06, seg: 2, radial: 6, ramp: R.WOOD, lift: 0.06 }));
  const y0 = 0.7, y1 = P - 0.5;
  [-1, 1].forEach(s => {
    brace(at(y0, -1), y0, s * at(y0, 1), at(y1, 1), y1, s * at(y1, 1));
    brace(at(y0, 1), y0, s * at(y0, 1), at(y1, -1), y1, s * at(y1, 1));
    brace(s * at(y0, 1), y0, at(y0, -1), s * at(y1, 1), y1, at(y1, 1));
    brace(s * at(y0, 1), y0, at(y0, 1), s * at(y1, 1), y1, at(y1, -1));
  });
  const yg = P * 0.5, wg = at(yg, 1) * 2 + 0.2;
  [-1, 1].forEach(s => {
    g.add(api.box({ w: wg, h: 0.14, d: 0.14, y: yg, z: s * at(yg, 1), ramp: R.WOOD, lift: -0.05 }));
    g.add(api.box({ w: 0.14, h: 0.14, d: wg, x: s * at(yg, 1), y: yg, ramp: R.WOOD, lift: -0.05 }));
  });

  // the platform and its board parapet (solid: it reads as a crisp box from above)
  const pw = head * 2 + 0.6;
  g.add(api.box({ w: pw + 0.2, h: 0.22, d: pw + 0.2, y: P + 0.11, ramp: R.WOOD, lift: -0.08 }));
  const ph = 0.95, pt = 0.1;
  [-1, 1].forEach(s => {
    g.add(api.box({ w: pw, h: ph, d: pt, y: P + 0.22 + ph / 2, z: s * (pw / 2 - pt / 2), ramp: R.WOOD, lift: 0.1, speck: 0.3 }));
    g.add(api.box({ w: pt, h: ph, d: pw - 2 * pt, x: s * (pw / 2 - pt / 2), y: P + 0.22 + ph / 2, ramp: R.WOOD, lift: 0.04, speck: 0.3 }));
  });
  // a hatch gap in the front parapet where the ladder arrives: an ink-dark opening
  g.add(api.box({ w: 0.62, h: ph * 0.8, d: 0.02, y: P + 0.22 + ph * 0.42, z: pw / 2 + 0.005, ramp: R.INK }));

  // corner posts up to the roof, and the thatched pyramid
  const rp = pw / 2 - 0.1, roofY = P + 2.35;
  corners.forEach(([sx, sz]) => g.add(api.box({ w: 0.13, h: roofY - P - 0.22, d: 0.13, x: sx * rp, y: (roofY + P + 0.22) / 2, z: sz * rp, ramp: R.WOOD })));
  g.add(api.hipRoof({ w: pw, d: pw, h: 1.45, overhang: 0.42, y: roofY, color: thatch, speck: 0.4 }));
  g.add(api.flag({ pole: 1.1, w: 0.62, h: 0.34, y: roofY + 1.35, ramp: R.REDWALL }));

  // the ladder up the front, leaning on the platform edge
  const lz0 = head + 1.35, lz1 = pw / 2 + 0.05, lh = P + 0.3, lt = Math.atan2(lz0 - lz1, lh), ll = Math.hypot(lz0 - lz1, lh);
  const lad = api.group({ z: (lz0 + lz1) / 2, y: lh / 2 });
  [-0.28, 0.28].forEach(x => lad.add(api.box({ w: 0.08, h: ll, d: 0.08, x, rx: -lt, ramp: R.WOOD, lift: 0.08 })));
  for (let i = 0; i < 12; i++) {
    const k = -ll / 2 + 0.35 + i * (ll - 0.6) / 11;
    lad.add(api.colourOnly(api.box({ w: 0.56, h: 0.05, d: 0.06, y: k * Math.cos(lt), z: -k * Math.sin(lt), ramp: R.WOOD, lift: 0.15 })));
  }
  g.add(lad);

  // keylines: one box for the parapet, one pyramid-ish block for the roof
  api.proxy(api.boxGeo({ w: pw, h: ph + 0.22, d: pw, y: P + (ph + 0.22) / 2 }), g);
  return g;
}
