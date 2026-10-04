// Beehives: a bee shelter in the old way. A limestone bench under a little terracotta pent roof on a back
// wall, three straw skeps on the bench and two more standing in front, each with its ink-dark doorway
// at the foot, a lavender bush beside them for the bees. 4.5 x 3.5 m.
export const meta = {
  id: 'beehives', name: 'Beehives', category: 'farm', stage: 'hamlet',
  aliases: ['beehive', 'bee hive', 'bee hives', 'hives', 'hive', 'skeps', 'skep', 'apiary', 'bees', 'bee yard', 'bee garden', 'arı kovanı', 'arı kovanları', 'kovan', 'arılık'],
  footprint: { w: 4.5, d: 3.5 }, height: 2.5,
  desc: 'straw skeps on a stone bench under a little terracotta pent roof, two more in front, lavender beside'
};

const STRAW = ['#6c4a17', '#97692a', '#bf8f3f', '#d4a752', '#e0b864'];
const LAV = ['#3b2c50', '#56447a', '#7563a0', '#8a79b4', '#9a8bc2'];

// a skep: a coiled straw dome (banded turned profile) with a little ink doorway at its foot, facing +z
function skep(api, g, x, y, z, s) {
  const pts = [];
  const H = 0.78 * s, Rr = 0.4 * s;
  for (let i = 0; i <= 8; i++) {
    const t = i / 8, band = (i % 2) ? 0.035 * s : 0;
    pts.push([Math.max(0.0, Rr * Math.sqrt(Math.max(0, 1 - Math.pow(t, 2.2))) + band), t * H]);
  }
  pts[pts.length - 1][0] = 0;
  g.add(api.lathe({ points: pts, seg: 18, x, y, z, ramp: STRAW, speck: 0.1 }));
  g.add(api.inkDoor({ w: 0.16 * s, h: 0.12 * s, x, y, z: z + Rr - 0.01, frame: false }));
}

export function build(api) {
  const R = api.ramps, g = api.group();
  // back wall, bench, and a pent roof resting on the wall top and two front posts
  const wz = -1.45, wh = 2.1, eaveF = 1.72, rd = 1.5;
  g.add(api.box({ w: 3.6, h: wh, d: 0.4, y: 0.06 + wh / 2, z: wz, mat: api.lambert('#e3d2b4') }));
  g.add(api.box({ w: 3.6, h: 0.14, d: 0.75, y: 0.06 + 0.62, z: wz + 0.55, ramp: R.LIMESTONE }));
  [-1.55, 0, 1.55].forEach(x => g.add(api.box({ w: 0.22, h: 0.62, d: 0.5, x, y: 0.06 + 0.31, z: wz + 0.55, ramp: R.LIMESTONE, lift: -0.08 })));
  const backY = 0.06 + wh + 0.08, ra = Math.atan2(backY - eaveF, rd - 0.3);
  const ry = (backY + eaveF) / 2 + 0.07, rz0 = wz - 0.15 + rd / 2;
  g.add(api.box({ w: 4.0, h: 0.14, d: rd + 0.25, y: ry, z: rz0, rx: ra, ramp: R.TERRACOTTA, lift: -0.05 }));
  // barrel-tile rows down the slope
  for (let k = 0; k < 9; k++) g.add(api.colourOnly(api.cylinder({ r: 0.09, h: rd + 0.2, seg: 8, x: -1.8 + k * 0.45, y: ry + 0.07 * Math.cos(ra), z: rz0 + 0.07 * Math.sin(ra), rx: Math.PI / 2 + ra, ramp: R.TERRACOTTA, lift: 0.08, speck: 0.1 })));   // the slab draws the roof's line
  [-1.7, 1.7].forEach(x => g.add(api.box({ w: 0.12, h: eaveF - 0.06, d: 0.12, x, y: 0.06 + (eaveF - 0.06) / 2, z: wz + rd - 0.35, ramp: R.WOOD })));
  // three skeps on the bench, two on stone slabs in front
  [-1.1, 0, 1.1].forEach(x => skep(api, g, x, 0.06 + 0.69, wz + 0.55, api.range(0.92, 1.0)));
  [[-0.8, 0.75], [0.75, 0.95]].forEach(([x, z]) => {
    skep(api, g, x, 0.06, z, api.range(1.0, 1.1));
  });
  // lavender for the bees at the lit (left) end: two cushions, each with a smaller one on top
  [[-2.0, 0.6, 0.46], [-1.85, 1.4, 0.36]].forEach(([x, z, r]) => {
    g.add(api.sphere({ r, sy: 0.85, x, y: 0.06 + r * 0.7, z, ramp: LAV, speck: 0.1, seg: 14 }));
    g.add(api.sphere({ r: r * 0.6, sy: 0.9, x: x + 0.08, y: 0.06 + r * 1.25, z: z - 0.05, ramp: LAV, speck: 0.1, lift: 0.06, seg: 12 }));
  });
  api.proxy(api.boxGeo({ w: 3.6, h: wh, d: 0.4, y: 0.06 + wh / 2, z: wz }), g);
  return g;
}
