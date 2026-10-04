// Cart: a two-wheeled farm cart at rest, its shafts down on the ground in front, the bed boarded on three sides
// and loaded (a golden hay heap, a row of amphorae in straw, or sacks and a barrel). From above: a wooden
// rectangle with its load and two spoked wheels. Footprint 1.8 x 3.6, the shafts point to +z.
export const meta = {
  id: 'cart', name: 'Cart',
  aliases: ['cart', 'carts', 'wagon', 'wagons', 'waggon', 'handcart', 'oxcart', 'ox cart', 'hay cart', 'araba', 'at arabası', 'kağnı'],
  category: 'prop', stage: 'hamlet', footprint: { w: 1.8, d: 3.6 }, height: 1.6,
  desc: 'A two-wheeled wooden cart at rest, shafts on the ground, loaded with hay, amphorae or sacks.'
};

export function build(api) {
  const R = api.ramps, g = api.group();
  const by = 0.8, bw = 1.3, bd = 2.0, bz = -0.55;
  // the bed and its boards (back and both sides; the front stays open to the shafts)
  g.add(api.box({ w: bw, h: 0.1, d: bd, y: by, z: bz, ramp: R.WOOD }));
  g.add(api.box({ w: 0.07, h: 0.38, d: bd, x: -bw / 2, y: by + 0.24, z: bz, ramp: R.WOOD, lift: 0.04 }));
  g.add(api.box({ w: 0.07, h: 0.38, d: bd, x: bw / 2, y: by + 0.24, z: bz, ramp: R.WOOD, lift: 0.04 }));
  g.add(api.box({ w: bw, h: 0.38, d: 0.07, y: by + 0.24, z: bz - bd / 2, ramp: R.WOOD, lift: 0.04 }));
  // axle and two big wheels
  g.add(api.box({ w: bw + 0.5, h: 0.09, d: 0.09, y: 0.62, z: bz, ramp: R.IRON }));
  g.add(api.wheel({ r: 0.62, w: 0.12, spokes: 8, x: -bw / 2 - 0.16, y: 0.62, z: bz }));
  g.add(api.wheel({ r: 0.62, w: 0.12, spokes: 8, x: bw / 2 + 0.16, y: 0.62, z: bz }));
  // the shafts run forward and down to the ground; a prop leg holds the tail
  const z0 = bz + bd / 2 - 0.2, z1 = 2.05, ang = Math.atan2(by - 0.1, z1 - z0), L = Math.hypot(z1 - z0, by - 0.1) + 0.5;
  [-0.42, 0.42].forEach(x => g.add(api.box({ w: 0.08, h: 0.08, d: L, x, y: (by + 0.08) / 2 + 0.02, z: (z0 + z1) / 2 + 0.12, rx: ang, ramp: R.WOOD, lift: 0.06 })));
  g.add(api.box({ w: 0.9, h: 0.07, d: 0.07, y: 0.3, z: 1.35, ramp: R.WOOD }));   // the crossbar
  g.add(api.box({ w: 0.07, h: by - 0.05, d: 0.07, y: (by - 0.05) / 2, z: bz - bd / 2 + 0.1, ramp: R.WOOD }));

  // the load
  const v = typeof api.variant === 'function' ? api.variant() : 0;
  const load = ['hay', 'amphorae', 'sacks'][v % 3];
  if (load === 'hay') {
    g.add(api.sphere({ r: 1, sx: 0.72, sy: 0.55, sz: 1.08, y: by + 0.35, z: bz, ramp: R.GOLD, speck: 0.32, seg: 20 }));
  } else if (load === 'amphorae') {
    g.add(api.box({ w: bw - 0.12, h: 0.2, d: bd - 0.12, y: by + 0.15, z: bz, ramp: R.GOLD, speck: 0.3 }));   // straw
    const amph = [[0, 0], [0.13, 0.05], [0.2, 0.25], [0.19, 0.45], [0.09, 0.58], [0.06, 0.72], [0.09, 0.75], [0.05, 0.76]];
    for (let r = 0; r < 3; r++) for (let c = 0; c < 2; c++)
      g.add(api.lathe({ points: amph, seg: 14, x: -0.3 + c * 0.6, y: by + 0.12, z: bz - 0.62 + r * 0.6, ramp: R.TERRACOTTA, lift: 0.04 * ((r + c) % 2) }));
  } else {
    for (let r = 0; r < 3; r++) for (let c = 0; c < 2; c++)
      g.add(api.sphere({ r: 0.32, sy: 0.7, sx: 0.95, x: -0.3 + c * 0.6, y: by + 0.28, z: bz - 0.6 + r * 0.6, rot: (r + c) * 0.4, ramp: R.SAND, lift: 0.05 * ((r + c) % 2) }));
    g.add(api.barrel({ r: 0.28, h: 0.7, x: 0.0, y: by + 0.45, z: bz - 0.35 }));
  }
  api.proxy(api.boxGeo({ w: bw, h: 0.48, d: bd, y: by + 0.19, z: bz }), g);
  return g;
}
