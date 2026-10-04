// Haystacks: the hay yard after the harvest. A tall stack built round a pole (its tip poking out of the
// top), a squat round rick with a domed cap, a stepped pile of square bales and two round bales lying on
// their sides, a pitchfork stuck in the rick. All gold and ochre straight on the ground (no slab under them: a ground-hugging slab
// would paint over their feet at a distance). 6.4 x 4.8 m.
export const meta = {
  id: 'haystacks', name: 'Haystacks', category: 'farm', stage: 'hamlet',
  aliases: ['haystack', 'hay', 'hay bales', 'hay bale', 'bales', 'straw bales', 'straw', 'hay stack', 'hay rick', 'hay yard', 'saman balyası', 'saman', 'ot yığını', 'tınaz', 'balya'],
  footprint: { w: 6.4, d: 4.8 }, height: 4.2,
  desc: 'a tall pole haystack, a domed rick, a stepped pile of square bales and two round bales'
};

const HAY = ['#6e4d16', '#9a6f22', '#c39436', '#d9ac48', '#e6be5c'];
const HAY_OLD = ['#5a4420', '#7e6230', '#9f8044', '#b09050', '#ba9a5a'];   // last year's weathered rick
const STRAW = ['#7e6528', '#ad8f40', '#d4b762', '#e3c878', '#ecd590'];     // fresh pale straw bales

export function build(api) {
  const R = api.ramps, g = api.group();
  // the tall pole stack: a turned profile, swelling then tapering to the pole
  const px = -1.7, pz = -0.9;
  g.add(api.lathe({ points: [[1.25, 0], [1.42, 0.45], [1.4, 1.1], [1.18, 1.9], [0.8, 2.7], [0.38, 3.3], [0.08, 3.55]], seg: 20, x: px, y: 0.06, z: pz, ramp: HAY, speck: 0.1 }));
  g.add(api.cylinder({ rb: 0.06, rt: 0.04, h: 0.7, x: px, y: 0.06 + 3.6 + 0.2, z: pz, ramp: R.WOOD }));
  // the squat rick with a domed cap, a pitchfork stuck in it
  const rx = 1.5, rz = -1.2;
  g.add(api.cylinder({ rb: 1.0, rt: 0.95, h: 1.0, x: rx, y: 0.06 + 0.5, z: rz, ramp: HAY, speck: 0.1, lift: -0.04, seg: 20 }));
  g.add(api.dome({ r: 1.1, h: 0.9, x: rx, y: 1.06, z: rz, ramp: HAY_OLD, lift: -0.08, seg: 20 }));
  g.add(api.cylinder({ r: 0.03, h: 1.9, x: rx + 0.75, y: 1.5, z: rz + 0.6, rz: -0.5, rx: 0.25, ramp: R.WOOD, lift: 0.1 }));
  // a stepped pile of square bales: 3, then 2, then 1
  const bx = 0.4, bz = 1.5, bw = 1.0, bh = 0.5, bd = 0.6;
  let k = 0;
  for (let layer = 0; layer < 3; layer++) for (let i = 0; i < 3 - layer; i++) {
    const x = bx + (i - (2 - layer) / 2) * (bw + 0.04);
    g.add(api.box({ w: bw, h: bh, d: bd, x, y: 0.06 + bh / 2 + layer * bh, z: bz + api.range(-0.04, 0.04), rot: api.range(-0.04, 0.04), ramp: STRAW, lift: k++ % 2 ? 0.04 : -0.03, speck: 0.1 }));
  }
  // two round bales on their sides, rolled out in front
  g.add(api.cylinder({ r: 0.62, h: 1.0, x: -2.0, y: 0.06 + 0.62, z: 1.6, rz: Math.PI / 2, rot: 0.35, ramp: HAY, speck: 0.1, seg: 18 }));
  g.add(api.cylinder({ r: 0.58, h: 0.95, x: 2.55, y: 0.06 + 0.58, z: 1.0, rx: Math.PI / 2, rot: -0.2, ramp: STRAW, speck: 0.1, lift: -0.06, seg: 18 }));
  return g;
}
