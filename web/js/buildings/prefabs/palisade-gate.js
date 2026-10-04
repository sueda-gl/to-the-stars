// Palisade gate: the camp's first wall. Two runs of sharpened logs bound by back rails meet a gate between two
// tall posts under a little thatched roof; the plank doors stand open inward over a trodden-earth threshold,
// and a red cloth hangs from the lintel. Footprint 8.6 x 2.6, the way out faces +z.
export const meta = {
  id: 'palisade-gate', name: 'Palisade gate', aliases: ['palisade gates', 'palisade', 'stockade', 'stockade gate', 'log wall gate', 'gate', 'camp gate', 'çit kapısı', 'kazık çit', 'ahşap kapı', 'kapı'],
  category: 'building', stage: 'camp', footprint: { w: 8.6, d: 2.6 }, height: 4.9,
  desc: 'Two runs of sharpened log palisade either side of an open plank gate under a small thatched roof.'
};

export function build(api) {
  const R = api.ramps, g = api.group();
  const gw = 2.4, pr = 0.24, PH = 4.0;   // gate opening, gate-post radius, gate-post height

  // the trodden threshold through the gate
  g.add(api.box({ w: gw + 0.4, h: 0.05, d: 2.6, y: 0.025, z: 0.2, ramp: R.SAND, lift: -0.04, speck: 0.3 }));

  // the palisade: sharpened logs, a turned profile each (shaft + point), heights a little uneven
  const log = (x, h, r) => g.add(api.lathe({ points: [[r * 0.98, 0], [r, h], [r * 0.5, h + r * 1.3], [0, h + r * 2.4]], seg: 10, x, z: api.range(-0.03, 0.03),
    ramp: R.WOOD, lift: api.range(-0.06, 0.1), speck: 0.24 }));
  const runFrom = gw / 2 + pr + 0.15, runTo = 4.3, step = 0.33;
  const n = Math.round((runTo - runFrom) / step);
  [-1, 1].forEach(s => {
    for (let i = 0; i <= n; i++) log(s * (runFrom + i * step), api.range(2.45, 2.85), 0.165);
    // two rails across the back binding the logs
    [0.8, 2.0].forEach(y => g.add(api.box({ w: runTo - runFrom + 0.3, h: 0.14, d: 0.12, x: s * (runFrom + runTo) / 2, y, z: -0.24, ramp: R.WOOD, lift: -0.12 })));
  });

  // the two gate posts and the lintel, with a small thatched gable over them
  [-1, 1].forEach(s => {
    g.add(api.cylinder({ rb: pr, rt: pr * 0.9, h: PH, x: s * (gw / 2 + pr * 0.6), y: PH / 2, ramp: R.WOOD, lift: 0.04, seg: 12 }));
  });
  g.add(api.box({ w: gw + 1.1, h: 0.3, d: 0.36, y: PH - 0.35, ramp: R.WOOD, lift: -0.04 }));
  g.add(api.gableRoof({ w: gw + 1.5, d: 1.2, h: 0.75, overhang: 0.18, y: PH, color: '#c49a52', speck: 0.4 }));
  // a red cloth hanging from the lintel's face
  g.add(api.extrude({ shape: [[-0.42, 0], [0.42, 0], [0.42, -0.95], [0, -0.75], [-0.42, -0.95]], depth: 0.03, y: PH - 0.5, z: 0.2, ramp: R.REDWALL, speck: 0.12 }));

  // the doors: plank leaves with two battens each, swung open inward (toward -z)
  [-1, 1].forEach(s => {
    const leaf = api.group({ x: s * gw / 2, rot: -s * 1.2 });
    const lw = gw / 2 - 0.05, lh = 2.75;
    leaf.add(api.box({ w: lw, h: lh, d: 0.1, x: -s * lw / 2, y: 0.1 + lh / 2, ramp: R.WOOD, lift: 0.1, speck: 0.3 }));
    [0.6, 2.2].forEach(y => leaf.add(api.box({ w: lw - 0.1, h: 0.16, d: 0.06, x: -s * lw / 2, y, z: -0.08, ramp: R.WOOD, lift: -0.12 })));
    g.add(leaf);
  });
  return g;
}
