// Amphitheatre: a stepped semicircle of limestone seats rising toward the back, ringed by a red-wall outer wall,
// two radial stairways cutting the tiers, a sandy orchestra and, across the open front, a low stage with a short
// red arched screen (the scaenae frons, kept low so the bowl reads from the leader's camera). Cypresses behind.
// From above: the pale concentric half-rings around the sand, the red rim. Footprint 22 x 14, the stage at the
// front (+z), the seats rising to the back (-z).
export const meta = {
  id: 'amphitheatre', name: 'Amphitheatre',
  aliases: ['amphitheatre', 'amphitheater', 'amphitheatres', 'theatre', 'theater', 'odeon', 'arena', 'stepped seats', 'amfitiyatro', 'tiyatro', 'antik tiyatro'],
  category: 'landmark', stage: 'civilisation', footprint: { w: 22, d: 14 }, height: 6.5,
  desc: 'A stepped semicircle of stone seats round a sandy orchestra, with a low arched stage screen.'
};

export function build(api) {
  const R = api.ramps, g = api.group();
  const N = 7, R0 = 3.4, RUN = 0.95, RISE = 0.48, ROUT = R0 + N * RUN;   // tiers
  const CZ = 1.2;                                                     // the bowl's centre (front edge of the seats)

  // a half ring in the XY plane (y >= 0), laid flat it becomes the back half (z <= CZ)
  // (a plain point list: api.extrude does not take a THREE.Shape in this build, see the report)
  const SEG = 28;
  const halfRing = (r0, r1) => {
    const pts = [];
    for (let i = 0; i <= SEG; i++) { const a = i / SEG * Math.PI; pts.push([Math.cos(a) * r1, Math.sin(a) * r1]); }
    for (let i = SEG; i >= 0; i--) { const a = i / SEG * Math.PI; pts.push([Math.cos(a) * r0, Math.sin(a) * r0]); }
    return pts;
  };
  // the tiers: each one a solid half ring from its own inner edge out to the rim, one rise higher than the last
  for (let i = 0; i < N; i++) {
    const h = (i + 1) * RISE;
    g.add(api.extrude({ shape: halfRing(R0 + i * RUN, ROUT), depth: h, rx: -Math.PI / 2, y: h / 2, z: CZ, curveSeg: 28,
      ramp: R.LIMESTONE, lift: 0.05 - (i % 2) * 0.05, speck: 0.12 }));
  }
  // the outer wall: a red half ring a little higher than the top tier
  const WH = N * RISE + 0.9;
  g.add(api.extrude({ shape: halfRing(ROUT, ROUT + 0.55), depth: WH, rx: -Math.PI / 2, y: WH / 2, z: CZ, curveSeg: 28, mat: api.lambert('#c23a2c', 0.1) }));
  g.add(api.extrude({ shape: halfRing(ROUT - 0.05, ROUT + 0.65), depth: 0.16, rx: -Math.PI / 2, y: WH + 0.08, z: CZ, curveSeg: 28, ramp: R.LIMESTONE, lift: 0.06 }));
  // the wall's ends turn into square piers at the front
  [-1, 1].forEach(s => g.add(api.box({ w: 1.0, h: WH + 0.2, d: 0.9, x: s * (ROUT + 0.3), y: (WH + 0.2) / 2, z: CZ + 0.35, mat: api.lambert('#c23a2c', 0.1) })));

  // two radial stairways: paler strips of small steps climbing the tiers
  [-0.62, 0.62].forEach(a => {
    for (let i = 0; i < N; i++) {
      const r = R0 + (i + 0.5) * RUN, h = (i + 1) * RISE;
      g.add(api.box({ w: 0.7, h: 0.12, d: RUN, x: Math.sin(a) * r, y: h + 0.02, z: CZ - Math.cos(a) * r, rot: -a, ramp: R.SAND, lift: 0.08, speck: 0.08 }));
    }
  });

  // the orchestra: a sandy half disc, and the paved front strip
  const orch = [];
  for (let i = 0; i <= SEG; i++) { const a = i / SEG * Math.PI; orch.push([Math.cos(a) * R0, Math.sin(a) * R0]); }
  g.add(api.extrude({ shape: orch, depth: 0.08, rx: -Math.PI / 2, y: 0.04, z: CZ, ramp: R.SAND, speck: 0.22 }));

  // the stage: a low stone platform across the front with a short red arched screen behind it
  const SZ = CZ + 1.6;
  g.add(api.box({ w: 11.5, h: 0.7, d: 2.2, y: 0.35, z: SZ, ramp: R.LIMESTONE, lift: -0.04 }));
  g.add(api.box({ w: 11.7, h: 0.1, d: 2.4, y: 0.75, z: SZ, ramp: R.WOOD, lift: 0.08 }));
  g.add(api.archWall({ w: 9.0, h: 2.6, d: 0.45, arches: 5, archW: 1.0, archH: 1.95, y: 0.8, z: SZ + 0.85, mat: api.lambert('#c23a2c', 0.1) }));
  g.add(api.box({ w: 9.3, h: 0.18, d: 0.65, y: 3.49, z: SZ + 0.85, ramp: R.LIMESTONE, lift: 0.06 }));
  // two little steps from the orchestra up onto the stage
  [-3.5, 3.5].forEach(x => g.add(api.stairs({ w: 1.0, steps: 2, rise: 0.33, run: 0.3, x, y: 0, z: CZ + 0.25, rot: Math.PI })));

  // cypresses and a pine behind the bowl
  const back = [[-6.8, -6.0], [0.6, -7.6], [7.2, -5.8]];
  back.forEach(([x, z]) => {
    const k = api.pick(['cypress', 'pine', 'olive', 'cypress', 'oak', 'pine']);
    if (k === 'cypress') g.add(api.cypress({ h: api.range(5.5, 7.5), x, z }));
    else if (k === 'pine') g.add(api.pine({ h: 6.5, x, z }));
    else g.add(api.tree({ kind: k, h: k === 'oak' ? 5 : 3.6, x, z }));
  });
  return g;
}
