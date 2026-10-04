// Orchard: fruit trees planted in straight rows on mown grass, the kinds mixed at random (lemon, orange,
// apple, pear), each over a ring of dug earth, with paler mown strips along the rows, a ladder leaning on
// one tree and two crates of picked fruit. 12 x 11 m.
export const meta = {
  id: 'orchard', name: 'Orchard', category: 'farm', stage: 'village', area: true,
  aliases: ['orchards', 'fruit trees', 'fruit orchard', 'apple orchard', 'apple trees', 'citrus grove', 'lemon grove', 'orange grove', 'meyve bahçesi', 'meyvelik', 'elma bahçesi', 'narenciye bahçesi'],
  footprint: { w: 12, d: 11 }, height: 3.4,
  desc: 'rows of mixed fruit trees (lemon, orange, apple, pear) on mown grass with dug rings, a ladder and fruit crates'
};

const GRASS = ['#3d4b23', '#566830', '#6f833d', '#82964a', '#8fa253'];
const MOWN = ['#4a5a2a', '#66793a', '#82974a', '#96aa58', '#a3b662'];
const APPLE = ['#4e1210', '#8c2418', '#bb3a22', '#cf4c2c', '#dc5f36'];
const PEAR = ['#5a5a18', '#86842a', '#b0aa3c', '#c6bf4c', '#d3cc58'];

export function build(api) {
  const R = api.ramps, g = api.group();
  const W = 12, D = 11;
  g.add(api.box({ w: W, h: 0.1, d: D, y: 0.05, ramp: GRASS, speck: 0.1 }));
  const xs = [-4.4, -1.47, 1.47, 4.4], zs = [-3.6, 0, 3.6];
  zs.forEach(z => g.add(api.colourOnly(api.box({ w: W - 0.4, h: 0.02, d: 1.6, y: 0.11, z, ramp: MOWN, speck: 0.1 }))));   // paint, not pencil
  const kinds = ['lemon', 'orange', 'apple', 'pear'];
  let ladderAt = null;
  zs.forEach((z, r) => xs.forEach((x, c) => {
    const kind = api.pick(kinds), tx = x + api.range(-0.15, 0.15), tz = z + api.range(-0.15, 0.15);
    const h = api.range(2.7, 3.2);
    g.add(api.colourOnly(api.cylinder({ r: 0.62, h: 0.03, x: tx, y: 0.125, z: tz, color: '#6e4e30', speck: 0.1, seg: 18 })));
    if (kind === 'apple' || kind === 'pear') g.add(api.tree({ kind: 'oak', h, r: h * 0.38, fruit: kind === 'apple' ? APPLE : PEAR, x: tx, y: 0.1, z: tz, lumps: 4 }));
    else g.add(api.tree({ kind, h, r: h * 0.36, x: tx, y: 0.1, z: tz }));
    if (r === 2 && c === 1) ladderAt = [tx, tz];
  }));
  // a ladder leaning into a front tree, and two crates of fruit beside it
  if (ladderAt) {
    const lad = api.group({ x: ladderAt[0] + 0.75, y: 0.1, z: ladderAt[1] + 0.35, rot: 0.5 });
    [-0.22, 0.22].forEach(dx => lad.add(api.box({ w: 0.07, h: 2.5, d: 0.07, x: dx, y: 1.2, z: 0.3, rx: -0.28, ramp: R.WOOD })));
    for (let k = 0; k < 5; k++) lad.add(api.box({ w: 0.44, h: 0.05, d: 0.05, y: 0.35 + k * 0.45, z: 0.3 + 0.95 - (0.35 + k * 0.45) * 0.29 - 0.6, ramp: R.WOOD }));
    g.add(lad);
    const cx = ladderAt[0] + 1.6, cz = ladderAt[1] + 1.4;
    for (let k = 0; k < 2; k++) {
      const x = cx + k * 0.75, z = cz - k * 0.2;
      g.add(api.crate({ s: 0.55, x, y: 0.1, z }));
      const fr = k ? APPLE : R.YELLOW;
      for (let f = 0; f < 4; f++) g.add(api.sphere({ r: 0.11, x: x - 0.12 + (f % 2) * 0.24, y: 0.1 + 0.6, z: z - 0.1 + (f > 1 ? 0.2 : 0), ramp: fr, seg: 8 }));
    }
  }
  return g;
}
