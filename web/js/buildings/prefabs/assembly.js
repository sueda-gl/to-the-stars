// Assembly: the Red arch itself, as a faithful miniature of Sueda's "Red arch at sundown" (web/js/paint/redArch.js)
// at 0.6 of the reference's size so it fits the 20 x 14 footprint. A red #c23a2c wall (bare Lambert, like the
// reference) pierced by one great round arch cut with Shape + absarc in the reference's own proportions (radius 8.6,
// springing 4.8, depth 1.8, all x 0.6); the pale stone terrace in two slabs either side of the narrow pool, which runs
// from behind the wall, under the arch, to the front edge; two umbrella pines behind the wall, framed by the arch, as
// in the reference (a big one leaning in from the right, one from the left, each with a side crown); the two
// cypresses before the piers; flowering shrubs. Formal meetings gather on the terrace in front (+z).
//
// Why not buildRedArch(ctx, kit) itself: prefabs only get `api` (no ctx / kit), and the reference scene is a 120 m
// wall over 80 m slabs with a Reflector pool and gulls added straight to ctx.scene; library templates are cloned per
// placement (a Reflector does not survive clone) and normalise would shrink a 120 m object to 60 m. So: a miniature.
export const meta = { id: 'assembly', footprint: { w: 20, d: 14 }, height: 10.5 };

export function build(api) {
  const R = api.ramps, g = api.group(), T = api.THREE;
  const k = 0.6;                                         // scale against the reference
  const HW = 10, HD = 7;                                 // half the footprint
  const PW = 3.6 * k * 1.05;                             // the pool's half width (the reference PW = 3.6)
  const TY = 0.32;                                       // terrace top
  const terrace = api.lambert('#e0cfae', 0.12);

  // ---------- the terrace: two slabs either side of the pool, one across its far end ----------
  const sw = HW - PW;
  g.add(api.box({ w: sw, h: TY, d: HD * 2, x: -(PW + sw / 2), y: TY / 2, mat: terrace }));
  g.add(api.box({ w: sw, h: TY, d: HD * 2, x: PW + sw / 2, y: TY / 2, mat: terrace }));
  const poolBack = -6.4;
  g.add(api.box({ w: PW * 2, h: TY, d: poolBack + HD, y: TY / 2, z: (-HD + poolBack) / 2, mat: terrace }));
  // a low step along the front edge, where the meeting gathers
  g.add(api.box({ w: sw - 0.3, h: 0.14, d: 0.5, x: -(PW + sw / 2) - 0.15, y: 0.07, z: HD + 0.25, ramp: R.LIMESTONE }));
  g.add(api.box({ w: sw - 0.3, h: 0.14, d: 0.5, x: PW + sw / 2 + 0.15, y: 0.07, z: HD + 0.25, ramp: R.LIMESTONE }));

  // ---------- the pool: still dark water a hand below the terrace ----------
  const PL = HD - poolBack, PZ = (HD + poolBack) / 2;
  g.add(api.box({ w: PW * 2, h: 0.1, d: PL, y: TY - 0.2, z: PZ, ramp: ['#14303b', '#1d4554', '#2a5c6c', '#3a7184', '#4b8396'], speck: 0.06 }));
  api.proxy(api.boxGeo({ w: PW * 2, h: 0.02, d: PL, y: TY - 0.15, z: PZ }), g);

  // ---------- the red wall and its arch (the reference's Shape + absarc, scaled) ----------
  const archR = 8.6 * k, spring = 4.8 * k, depth = 1.8 * k, WH = 10.4, WZ = -2.0;
  const ws = new T.Shape();
  ws.moveTo(-HW, 0); ws.lineTo(-archR, 0); ws.lineTo(-archR, spring);
  ws.absarc(0, spring, archR, Math.PI, 0, true);
  ws.lineTo(archR, 0); ws.lineTo(HW, 0); ws.lineTo(HW, WH); ws.lineTo(-HW, WH); ws.lineTo(-HW, 0);
  // (handed over as its outline points: in three r128 a Shape has no isShape flag, so api.extrude can't take one)
  g.add(api.extrude({ shape: ws.getPoints(24), depth, curveSeg: 48, z: WZ, mat: api.lambert('#c23a2c', 0) }));
  const wallFront = WZ + depth / 2, wallBack = WZ - depth / 2;

  // ---------- umbrella pines behind the wall, framed by the arch ----------
  // The reference's two big pines, their trunk and crown points x 0.6 (z re-measured from the wall's back face).
  // Built as a tapering trunk + branches (tubes) and crowns of flattened painted pads, not the kit's leaf clumps:
  // one kit pine is ~60k triangles, half the asset budget. Pads are the painter's "few big shapes" anyway.
  const needles = ['#28320f', '#45561d', '#6c7d2b', '#94a03c', '#bbbb55'];   // the kit's PINE, a touch less yellow on top
  const bark = ['#2e2422', '#46362f', '#604a3c', '#7a5f4a', '#937558'];
  const V3 = (x, y, z) => [x, y, z];
  function crown(cx, cy, cz, r, n) {
    g.add(api.shrub({ r: r * 0.74, h: r * 0.36, x: cx, y: cy - r * 0.16, z: cz, ramp: needles }));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + 0.4, pr = r * api.range(0.44, 0.54);
      g.add(api.shrub({ r: pr, h: pr * 0.5, x: cx + Math.cos(a) * r * 0.6, y: cy - r * 0.24 - api.range(0, 0.1) * r, z: cz + Math.sin(a) * r * 0.26, ramp: needles }));
    }
  }
  function limb(points, r) { g.add(api.tube({ points, r, seg: 20, radial: 8, ramp: bark })); }
  // the big one, leaning in from the right
  limb([V3(4.56, 0, -4.0), V3(4.2, 1.56, -4.24), V3(3.36, 3.0, -4.72), V3(3.0, 4.44, -5.08), V3(3.24, 5.9, -5.26)], 0.3);
  limb([V3(3.24, 3.3, -4.8), V3(2.4, 3.96, -5.14), V3(1.6, 4.4, -5.3)], 0.12);
  limb([V3(3.1, 4.2, -5.06), V3(3.96, 4.44, -4.96), V3(4.6, 4.76, -4.84)], 0.1);
  crown(3.36, 6.42, -5.3, 2.34, 5);
  crown(1.5, 4.62, -5.3, 1.62, 3);
  crown(4.7, 4.9, -4.84, 1.32, 3);
  // the left one, leaning in from the left
  limb([V3(-5.04, 0, -4.6), V3(-4.86, 1.5, -4.66), V3(-4.32, 2.88, -4.72), V3(-3.72, 3.96, -4.78), V3(-3.2, 4.5, -4.82)], 0.27);
  limb([V3(-4.44, 3.0, -4.72), V3(-5.04, 3.66, -4.9), V3(-5.3, 4.1, -4.96)], 0.11);
  limb([V3(-3.84, 3.84, -4.78), V3(-2.64, 4.08, -4.72), V3(-1.56, 4.14, -4.6)], 0.1);
  crown(-3.12, 4.62, -4.84, 2.28, 5);
  crown(-5.4, 4.26, -4.96, 1.38, 3);
  crown(-1.44, 4.26, -4.6, 1.2, 3);

  // ---------- the cypresses before the piers (the reference's two, x 0.6), and the flowering shrubs ----------
  g.add(api.cypress({ h: 7.5, w: 0.72, x: -6.4, y: TY, z: wallFront + 1.6 }));
  g.add(api.cypress({ h: 6.9, w: 0.66, x: 6.55, y: TY, z: wallFront + 1.35 }));
  g.add(api.bush({ s: 0.6, spread: 1.4, lobes: 4, h: 1.5, flowers: R.RED, bloom: 0.6, x: 5.6, y: TY, z: wallFront + 0.55 }));
  g.add(api.shrub({ r: 0.95, h: 1.0, x: -5.7, y: TY, z: wallFront + 0.6, ramp: R.OLIVE }));
  g.add(api.bush({ s: 0.6, spread: 1.4, lobes: 4, h: 1.7, flowers: R.PINK, bloom: 0.55, x: -4.4, y: TY, z: wallBack - 3.6 }));
  g.add(api.shrub({ r: 0.85, h: 0.9, x: 5.3, y: TY, z: wallBack - 3.3, ramp: R.OLIVE }));
  return g;
}
