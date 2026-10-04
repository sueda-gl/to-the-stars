// Pumpkin patch: dark soil with low rows of big-leaved vine mounds, fat orange pumpkins lying among them
// (ribbed: a squat core with four lobes and a stalk), and a little wooden cart on the grass margin in front, loaded
// with the pick of the crop. 9 x 8.4 m.
export const meta = {
  id: 'pumpkin-patch', name: 'Pumpkin patch', category: 'farm', stage: 'hamlet', area: true,
  aliases: ['pumpkins', 'pumpkin', 'pumpkin field', 'squash patch', 'squashes', 'gourds', 'balkabağı tarlası', 'balkabağı', 'kabak tarlası', 'kabak'],
  footprint: { w: 9, d: 8.4 }, height: 1.3,
  desc: 'big-leaved vine rows on dark soil with fat ribbed orange pumpkins, a small cart of picked pumpkins in front'
};

const PUMPKIN = ['#6e2d0e', '#9c4314', '#c75e1b', '#dc7524', '#e78a32'];
const PALE = ['#7a5a2a', '#a8854a', '#cdb07a', '#ddc38f', '#e8d3a4'];
const VINE = ['#24321a', '#384c25', '#4f6830', '#61803a', '#6e8f42'];

function pumpkin(api, g, x, y, z, r, ramp, rot) {
  const R = api.ramps;
  g.add(api.sphere({ r, sy: 0.62, x, y: y + r * 0.6, z, ramp, speck: 0.1, seg: 16 }));
  if (r > 0.3) for (let k = 0; k < 4; k++) {
    const a = rot + k * Math.PI / 2;
    g.add(api.sphere({ r: r * 0.62, sy: 0.85, x: x + Math.cos(a) * r * 0.48, y: y + r * 0.56, z: z + Math.sin(a) * r * 0.48, ramp, speck: 0.1, lift: -0.03, seg: 12 }));
  }
  g.add(api.cylinder({ rb: r * 0.12, rt: r * 0.08, h: r * 0.35, x, y: y + r * 1.25, z, rz: 0.3, ramp: R.WOOD, lift: 0.1 }));
}

export function build(api) {
  const R = api.ramps, g = api.group();
  const W = 9, D = 8.4;
  g.add(api.box({ w: W, h: 0.1, d: D, y: 0.05, color: '#5e4229', speck: 0.1 }));
  const rows = [-3.05, -1.35, 0.35, 1.75];
  rows.forEach((z, i) => {
    // the vine row: big leaf mounds, each a broad lump with a smaller one riding on it (round, not pads)
    for (let j = 0; j < 6; j++) {
      const x = -W / 2 + 0.9 + j * (W - 1.8) / 5 + api.range(-0.25, 0.25), zz = z - 0.25 + api.range(-0.1, 0.1);
      g.add(api.sphere({ r: api.range(0.55, 0.65), sy: 0.6, sx: 1.15, x, y: 0.1 + 0.18, z: zz, ramp: VINE, speck: 0.1, lift: api.range(-0.1, 0.0), seg: 14 }));
      g.add(api.sphere({ r: 0.36, sy: 0.75, x: x + api.range(-0.2, 0.2), y: 0.1 + 0.42, z: zz - 0.1, ramp: VINE, speck: 0.1, lift: api.range(0.0, 0.08), seg: 12 }));
    }
    for (let j = 0; j < 4; j++) {
      const x = -W / 2 + 1.3 + j * (W - 2.6) / 3 + api.range(-0.5, 0.5), r = api.range(0.28, 0.48);
      pumpkin(api, g, x, 0.1, z + 0.3 + api.range(-0.1, 0.15), r, api.rand() < 0.15 ? PALE : PUMPKIN, api.range(0, 1.5));
    }
  });
  // the cart at the front right: a plank bed on two wheels with three pumpkins
  // a grass margin along the front for the cart to stand on
  g.add(api.box({ w: W, h: 0.04, d: 1.5, y: 0.12, z: D / 2 - 0.75, ramp: ['#3d4b23', '#566830', '#6f833d', '#82964a', '#8fa253'], speck: 0.1 }));
  const c = api.group({ x: W / 2 - 2.2, y: 0.14, z: D / 2 - 0.75, rot: -0.12 });
  c.add(api.box({ w: 1.7, h: 0.14, d: 1.0, y: 0.56, ramp: R.WOOD }));
  [-1, 1].forEach(s => c.add(api.box({ w: 1.7, h: 0.3, d: 0.08, y: 0.76, z: s * 0.46, ramp: R.WOOD, lift: 0.05 })));
  [-1, 1].forEach(s => c.add(api.box({ w: 0.08, h: 0.3, d: 1.0, x: s * 0.81, y: 0.76, ramp: R.WOOD, lift: 0.02 })));
  [-1, 1].forEach(s => c.add(api.wheel({ r: 0.46, w: 0.1, spokes: 6, z: s * 0.58, y: 0.46, rot: Math.PI / 2 })));
  c.add(api.box({ w: 1.3, h: 0.07, d: 0.07, x: -1.4, y: 0.4, z: -0.32, rz: 0.25, ramp: R.WOOD }));
  c.add(api.box({ w: 1.3, h: 0.07, d: 0.07, x: -1.4, y: 0.4, z: 0.32, rz: 0.25, ramp: R.WOOD }));
  pumpkin(api, c, -0.4, 0.63, -0.12, 0.34, PUMPKIN, 0.3);
  pumpkin(api, c, 0.38, 0.63, 0.1, 0.32, PUMPKIN, 1.0);
  pumpkin(api, c, 0.0, 0.88, 0.0, 0.24, PALE, 0.5);
  g.add(c);
  return g;
}
