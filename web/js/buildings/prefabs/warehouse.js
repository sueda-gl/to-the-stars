// Warehouse: a big two-storey limestone store, long and plain: corner quoins, a string course, three tall
// arched ink doorways on the quay side, small square windows above, a terracotta gable roof with two vents; a
// hoist beam juts from the loading door under the eaves with a crate on its rope, and the apron in front is
// stacked with crates, sacks and barrels. From above: one long terracotta gable, a broad shadow, goods on the
// apron. Footprint 8.4 x 6.1, the doors face +z.
export const meta = {
  id: 'warehouse', name: 'Warehouse',
  aliases: ['warehouse', 'warehouses', 'storehouse', 'storehouses', 'store', 'depot', 'magazine', 'emporium', 'trading house', 'customs house', 'depo', 'ambar', 'antrepo', 'han'],
  category: 'building', stage: 'town', footprint: { w: 8.4, d: 6.1 }, height: 6.8,
  desc: 'A big two-storey limestone store with three arched doors, a hoist with a hanging crate and goods stacked on the apron.'
};

export function build(api) {
  const R = api.ramps, g = api.group();
  const P = 0.25;
  const stone = api.lambert('#e3d2b4', 0.2);
  // plinth and loading apron
  g.add(api.box({ w: 8.2, h: P, d: 5.8, y: P / 2, ramp: R.LIMESTONE, speck: 0.24 }));
  const W = 7.6, D = 3.9, H = 5.0, z0 = -0.85, front = z0 + D / 2;
  g.add(api.box({ w: W, h: H, d: D, y: P + H / 2, z: z0, mat: stone }));
  // quoins (slightly proud, painted), string course, eaves cornice
  [-1, 1].forEach(sx => [-1, 1].forEach(sz => g.add(api.box({ w: 0.42, h: H, d: 0.42, x: sx * (W / 2 - 0.15), y: P + H / 2, z: z0 + sz * (D / 2 - 0.15), ramp: R.LIMESTONE, lift: 0.06 }))));
  g.add(api.box({ w: W + 0.14, h: 0.16, d: D + 0.14, y: P + 2.85, z: z0, ramp: R.LIMESTONE, lift: 0.04 }));
  g.add(api.box({ w: W + 0.24, h: 0.2, d: D + 0.24, y: P + H - 0.05, z: z0, ramp: R.LIMESTONE, lift: 0.08 }));
  g.add(api.gableRoof({ w: W + 0.1, d: D + 0.1, h: 1.55, overhang: 0.3, y: P + H + 0.05, z: z0, ramp: R.TERRACOTTA }));
  [-2.2, 2.2].forEach(x => g.add(api.box({ w: 0.5, h: 0.6, d: 0.5, x, y: P + H + 1.25, z: z0 - 0.4, ramp: R.TERRACOTTA, lift: -0.06 })));

  // the quay side: three tall arched doors, four small windows, the loading door and its hoist
  [-2.5, 0, 2.5].forEach(x => g.add(api.inkDoor({ w: 1.4, h: 2.35, x, y: P, z: front, frame: R.LIMESTONE })));
  [-3.2, -1.25, 1.25, 3.2].forEach(x => g.add(api.inkWindow({ w: 0.5, h: 0.5, x, y: P + 3.75, z: front, frame: R.LIMESTONE })));
  g.add(api.inkDoor({ w: 0.95, h: 1.4, x: 0, y: P + 3.1, z: front, arched: false, frame: R.WOOD }));
  g.add(api.box({ w: 0.2, h: 0.2, d: 1.5, y: P + 4.75, z: front + 0.6, ramp: R.WOOD }));
  const hoist = api.group({ y: P + 4.65, z: front + 1.2 }); hoist.name = 'hoist';
  hoist.add(api.cylinder({ r: 0.02, h: 1.3, y: -0.65, ramp: R.SAND, seg: 5 }));
  hoist.add(api.crate({ s: 0.6, y: -1.9 }));
  g.add(hoist);
  // the side walls: two windows each storey on the lit end
  [-1.6, 0.0].forEach(z => g.add(api.inkWindow({ w: 0.5, h: 0.5, x: -W / 2, y: P + 3.75, z: z0 + z + 0.8, rot: -Math.PI / 2, frame: R.LIMESTONE })));
  g.add(api.inkWindow({ w: 0.4, h: 0.4, x: -W / 2, y: P + H + 0.5, z: z0, rot: -Math.PI / 2, arched: true, frame: false }));

  // goods on the apron
  const az = front + 0.75;
  g.add(api.crate({ s: 0.7, x: -3.4, y: P, z: az, rot: 0.1 }));
  g.add(api.crate({ s: 0.6, x: -3.35, y: P + 0.7, z: az, rot: -0.2 }));
  g.add(api.crate({ s: 0.65, x: -2.65, y: P, z: az + 0.15, rot: 0.35 }));
  for (let i = 0; i < 3; i++) g.add(api.barrel({ r: 0.32, h: 0.82, x: 3.5 - i * 0.68, y: P, z: az + (i % 2) * 0.12 }));
  g.add(api.barrel({ r: 0.32, h: 0.82, x: 3.15, y: P, z: az + 0.75 }));
  for (let i = 0; i < 4; i++) g.add(api.sphere({ r: 0.32, sy: 0.72, x: -1.2 + (i % 2) * 0.62, y: P + 0.22 + (i > 1 ? 0.4 : 0), z: az + 0.1 + (i > 1 ? 0.0 : 0.35), rot: i * 0.6, ramp: R.SAND, lift: 0.04 * (i % 2) }));
  g.add(api.crate({ s: 0.55, x: 1.0, y: P, z: az + 0.4, rot: -0.3, ramp: R.OCHRE }));

  api.proxy(api.boxGeo({ w: W, h: H, d: D, y: P + H / 2, z: z0 }), g);
  return g;
}

export function animate(obj, t) {
  const h = obj.getObjectByName('hoist'); if (h) { h.rotation.x = 0.04 * Math.sin(t * 0.9); h.rotation.z = 0.03 * Math.sin(t * 0.7 + 1.3); }
}
