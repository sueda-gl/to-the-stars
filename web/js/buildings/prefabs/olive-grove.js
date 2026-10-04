// Olive grove: silver-green olive trees in offset rows 3-2-3 (each a little different in size and lean) on
// tilled ochre earth with paler ploughed bands, every trunk standing in a dark dug basin that holds the rain (from above: a quincunx of grey-
// green crowns over dark rings), and a low dry-stone wall along the back. 12 x 12 m.
export const meta = {
  id: 'olive-grove', name: 'Olive grove', category: 'farm', stage: 'hamlet', area: true,
  aliases: ['olive groves', 'olive orchard', 'olive yard', 'zeytinlik', 'zeytin bahçesi'],
  footprint: { w: 12, d: 12 }, height: 3.4,
  desc: 'silver-green olive trees in offset rows on dry ochre earth, each in a dark dug basin, a dry-stone wall behind'
};

const SILVER = ['#29331f', '#45553a', '#66795a', '#8c9e7e', '#aab79b'];
const SILVER_B = ['#2b3420', '#48573a', '#6a7d55', '#91a378', '#afbd95'];

export function build(api) {
  const R = api.ramps, g = api.group();
  const W = 12, D = 12;
  g.add(api.box({ w: W, h: 0.1, d: D, y: 0.05, color: '#a98052', speck: 0.1 }));
  // ploughed bands between the tree rows, a shade paler
  // (colour only: ground patterns are paint, not pencil)
  [-2.2, 1.25, 4.6].forEach(z => g.add(api.colourOnly(api.box({ w: W - 0.6, h: 0.02, d: 1.3, y: 0.11, z, color: '#b8916a', speck: 0.1 }))));
  // offset rows: 3, 2, 3 (quincunx), wide apart so every crown reads on its own
  const zs = [-3.9, -0.5, 3.0];
  zs.forEach((z, r) => {
    const n = r % 2 ? 2 : 3, step = 3.9, x0 = -(n - 1) * step / 2;
    for (let c = 0; c < n; c++) {
      const x = x0 + c * step + api.range(-0.3, 0.3), tz = z + api.range(-0.25, 0.25);
      g.add(api.colourOnly(api.cylinder({ r: 0.95, h: 0.03, x, y: 0.125, z: tz, color: '#86603c', speck: 0.1, seg: 18 })));
      const h = api.range(2.4, 3.0);
      g.add(api.olive({ h, r: h * api.range(0.44, 0.5), x, y: 0.1, z: tz, ramp: api.rand() < 0.5 ? SILVER : SILVER_B, lean: api.range(0.5, 0.9), lumps: 5 }));
    }
  });
  // a dry-stone wall along the back, in three uneven runs
  let x = -W / 2 + 0.1;
  for (let k = 0; k < 3; k++) {
    const w = (W - 0.2) / 3, h = api.range(0.75, 0.9);
    g.add(api.box({ w: w + 0.02, h, d: 0.5, x: x + w / 2, y: 0.1 + h / 2, z: -D / 2 + 0.3, ramp: R.LIMESTONE, speck: 0.1, lift: api.range(-0.06, 0.04) }));
    x += w;
  }
  return g;
}
