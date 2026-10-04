// Irrigation ditch: one straight 12 m length of a stone-lined water channel (an acequia) between grassy
// earth banks, the water a deep teal, a wooden sluice gate in the middle and a plank footbridge near one end,
// reed clumps at the water's edge and one tree (of a random
// kind) on the back bank at the end. Segments can be laid end to end along x.
export const meta = {
  id: 'irrigation-ditch', name: 'Irrigation ditch', category: 'farm', stage: 'village',
  aliases: ['irrigation', 'irrigation channel', 'irrigation canal', 'water channel', 'ditch', 'acequia', 'water ditch', 'sluice', 'sulama kanalı', 'sulama arkı', 'ark', 'su arkı'],
  footprint: { w: 12, d: 4.4 }, height: 3.5,
  desc: 'a stone-lined channel of teal water between grassy banks, a wooden sluice gate and a plank footbridge'
};

const WATER = ['#173f56', '#1f5670', '#2a6f86', '#33809a', '#3d8ea6'];
const BANK = ['#4a5a2a', '#62763a', '#7b9048', '#8ca253', '#97ad5c'];
const bank = (w, h) => [[-w / 2, 0], [-w * 0.2, h], [w * 0.3, h * 0.92], [w / 2, 0]];

export function build(api) {
  const R = api.ramps, g = api.group();
  const L = 12, cw = 1.1;
  // channel bed, the water, and the limestone lining on both sides
  g.add(api.box({ w: L, h: 0.1, d: cw, y: 0.05, color: '#6e5a40' }));
  g.add(api.box({ w: L, h: 0.08, d: cw, y: 0.26, ramp: WATER, speck: 0.1 }));
  [-1, 1].forEach(s => g.add(api.box({ w: L, h: 0.48, d: 0.24, y: 0.24, z: s * (cw / 2 + 0.12), ramp: R.LIMESTONE, speck: 0.1, lift: s > 0 ? -0.05 : 0 })));
  // grassy earth banks outside the lining
  [-1, 1].forEach(s => g.add(api.extrude({ shape: bank(0.95, 0.42), depth: L, y: 0, z: s * (cw / 2 + 0.24 + 0.47), rot: Math.PI / 2 + (s > 0 ? Math.PI : 0), ramp: BANK, speck: 0.1 })));
  // the sluice gate: two posts, a crossbeam and a lowered plank gate
  const gx = 0.6;
  [-1, 1].forEach(s => g.add(api.box({ w: 0.16, h: 1.25, d: 0.16, x: gx, y: 0.62, z: s * (cw / 2 + 0.05), ramp: R.WOOD })));
  g.add(api.box({ w: 0.2, h: 0.14, d: cw + 0.5, x: gx, y: 1.2, ramp: R.WOOD, lift: 0.05 }));
  g.add(api.box({ w: 0.08, h: 0.45, d: cw - 0.04, x: gx, y: 0.42, ramp: R.WOOD, lift: -0.05 }));
  g.add(api.wheel({ r: 0.2, w: 0.05, spokes: 4, x: gx, y: 1.42, rot: Math.PI / 2 }));
  // a plank footbridge
  g.add(api.box({ w: 0.9, h: 0.1, d: cw + 0.9, x: -4.2, y: 0.53, ramp: R.WOOD }));
  // two reed clumps at the water's edge: three fat blades each, leaning apart
  [[gx + 1.2, -1], [-2.4, 1]].forEach(([rx0, s]) => {
    for (let i = 0; i < 3; i++) {
      const a = i * 2.1 + 0.3, h = api.range(0.95, 1.3);
      g.add(api.cone({ r: 0.16, h, x: rx0 + Math.cos(a) * 0.14, y: 0.3 + h / 2, z: s * (cw / 2 + 0.38) + Math.sin(a) * 0.12, rx: Math.sin(a) * 0.18, rz: -Math.cos(a) * 0.18, ramp: R.SAGE, lift: i === 1 ? 0.06 : -0.04, seg: 7 }));
    }
    api.proxy(api.coneGeo({ r: 0.42, h: 1.35, x: rx0, y: 0.3 + 0.675, z: s * (cw / 2 + 0.38) }), g);
  });
  // a tree on the back bank at one end, its kind picked at random (laid end to end, the ditch becomes a lined lane)
  const kind = api.pick(['oak', 'olive', 'cypress', 'oak']), tx = -L / 2 + 1.7, tz = -(cw / 2 + 0.75);
  if (kind === 'cypress') g.add(api.cypress({ h: 4.6, x: tx, z: tz }));
  else g.add(api.tree({ kind, h: kind === 'oak' ? 4.2 : 3.0, x: tx, y: 0.3, z: tz, leanTo: [0.4, -1] }));
  return g;
}
