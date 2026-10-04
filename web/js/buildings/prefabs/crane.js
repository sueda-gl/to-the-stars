// Harbour crane: a timber treadwheel crane on a limestone quay block. The great wheel stands between two
// trestles under a little terracotta gable on four posts; from its frame a long jib leans out over the water,
// stayed back to the roof, and a rope runs to its tip where a crate and a bale hang (the wheel walks them up and
// down). Iron bollards and a rope coil on the quay. From above: a tile roof, a long timber stroke reaching out
// past the quay edge, the load's dot at its tip. Footprint 4.6 x 7.4, the jib reaches to +z (toward the water).
export const meta = {
  id: 'crane', name: 'Harbour crane',
  aliases: ['crane', 'cranes', 'harbour crane', 'harbor crane', 'treadwheel crane', 'treadmill crane', 'tread wheel', 'dock crane', 'hoist', 'vinç', 'liman vinci', 'ayak değirmeni vinci'],
  category: 'building', stage: 'town', footprint: { w: 4.6, d: 7.4 }, height: 5.5, shore: true,
  desc: 'A timber treadwheel crane under a little tile roof on a stone quay, its jib reaching over the water with a load on the rope.'
};

export function build(api) {
  const R = api.ramps, g = api.group();
  const Q = 0.9;
  // the quay block and its coping
  g.add(api.box({ w: 4.4, h: Q, d: 4.0, y: Q / 2, z: -0.4, ramp: R.LIMESTONE, speck: 0.26, lift: -0.04 }));
  g.add(api.box({ w: 4.55, h: 0.16, d: 4.15, y: Q + 0.02, z: -0.4, ramp: R.LIMESTONE, lift: 0.06 }));
  const T = Q + 0.1;
  g.add(api.box({ w: 2.7, h: 0.14, d: 2.6, y: T + 0.07, z: -0.75, ramp: R.WOOD, lift: -0.05 }));

  // the wheel: two rims, spokes, rungs; it turns about x
  const WR = 1.5, wy = T + 1.75, wz = -0.75;
  const wheel = api.group({ y: wy, z: wz }); wheel.name = 'wheel';
  [-0.5, 0.5].forEach(x => {
    wheel.add(api.torus({ r: WR, tube: 0.08, flat: false, rot: Math.PI / 2, x, ramp: R.WOOD, seg: 36 }));
    for (let k = 0; k < 4; k++) wheel.add(api.box({ w: 0.09, h: WR * 2, d: 0.1, x, rx: k * Math.PI / 4, ramp: R.WOOD, lift: -0.06 }));
  });
  for (let i = 0; i < 18; i++) { const a = i / 18 * Math.PI * 2; wheel.add(api.box({ w: 1.06, h: 0.07, d: 0.12, y: Math.cos(a) * (WR - 0.02), z: Math.sin(a) * (WR - 0.02), rx: a, ramp: R.WOOD, lift: 0.08 })); }
  g.add(wheel);
  g.add(api.cylinder({ r: 0.1, h: 1.9, y: wy, z: wz, rz: Math.PI / 2, ramp: R.IRON, seg: 10 }));
  // two trestles carrying the axle
  [-0.85, 0.85].forEach(x => [-1.1, 1.1].forEach(dz => g.add(api.tube({ points: [[x, T + 0.14, wz + dz], [x, wy + 0.05, wz]], r: 0.08, seg: 2, radial: 6, ramp: R.WOOD }))));
  // four posts and the little gable roof over the wheel
  const ey = T + 3.55;
  [-0.95, 0.95].forEach(x => [-1.7, 1.7].forEach(dz => g.add(api.box({ w: 0.15, h: ey - T, d: 0.15, x, y: (ey + T) / 2, z: wz + dz, ramp: R.WOOD }))));
  g.add(api.gableRoof({ w: 3.6, d: 2.0, h: 0.75, overhang: 0.2, y: ey, z: wz, rot: Math.PI / 2, ramp: R.TERRACOTTA }));

  // the jib: from the frame's front up and out past the quay edge; a stay back to the roof; the rope
  const p0 = [0, T + 2.4, wz + 1.6], p1 = [0, T + 4.3, 4.3];
  const dz = p1[2] - p0[2], dy = p1[1] - p0[1], L = Math.hypot(dz, dy), ang = Math.atan2(dy, dz);
  g.add(api.box({ w: 0.26, h: 0.26, d: L + 0.3, x: 0, y: (p0[1] + p1[1]) / 2, z: (p0[2] + p1[2]) / 2, rx: -ang, ramp: R.WOOD }));
  g.add(api.tube({ points: [[0, ey + 0.7, wz + 1.0], [0, p1[1] + 0.05, p1[2] - 0.1]], r: 0.04, seg: 2, radial: 5, ramp: R.SAND }));
  g.add(api.tube({ points: [[0, wy, wz + 0.15], [0, p0[1] + 0.2, p0[2]], [0, p1[1] + 0.15, p1[2] - 0.05]], r: 0.03, seg: 8, radial: 5, ramp: R.SAND }));
  g.add(api.cylinder({ r: 0.16, h: 0.3, x: 0, y: p1[1] + 0.05, z: p1[2], rz: Math.PI / 2, ramp: R.WOOD, lift: -0.1, seg: 12 }));
  const load = api.group({ x: 0, y: p1[1], z: p1[2] }); load.name = 'load';
  const rope = api.cylinder({ r: 0.025, h: 1.0, y: -0.5, ramp: R.SAND, seg: 5 }); rope.name = 'rope'; rope.scale.y = 2.3; rope.position.y = -1.15; load.add(rope);
  const goods = api.group({ y: -2.3 }); goods.name = 'goods';
  goods.add(api.crate({ s: 0.75, y: -0.78 }));
  goods.add(api.sphere({ r: 0.32, sy: 0.75, x: 0.0, y: -1.05, z: 0.0, ramp: R.OCHRE, lift: 0.05 }));
  load.add(goods);
  g.add(load);

  // bollards and a rope coil on the quay edge
  [-1.75, 1.75].forEach(x => { g.add(api.cylinder({ rb: 0.16, rt: 0.13, h: 0.4, x, y: T + 0.2, z: 1.3, ramp: R.IRON, seg: 12 })); g.add(api.sphere({ r: 0.16, sy: 0.6, x, y: T + 0.42, z: 1.3, ramp: R.IRON })); });
  g.add(api.torus({ r: 0.3, tube: 0.08, x: 1.3, y: T + 0.08, z: 0.6, ramp: R.SAND, seg: 20 }));
  g.add(api.barrel({ r: 0.28, h: 0.75, x: -1.65, y: T, z: 0.5 }));

  api.proxy(api.cylinderGeo({ r: WR + 0.08, h: 1.16, y: wy, z: wz, rz: Math.PI / 2, seg: 36 }), g);
  api.proxy(api.boxGeo({ w: 4.4, h: Q, d: 4.0, y: Q / 2, z: -0.4 }), g);
  return g;
}

// the wheel walks the load up and down
export function animate(obj, t) {
  const a = 1.4 * Math.sin(t * 0.35);
  const w = obj.getObjectByName('wheel'); if (w) w.rotation.x = a;
  const lift = 0.45 * a;   // wheel radius x angle, geared down
  const rope = obj.getObjectByName('rope'), goods = obj.getObjectByName('goods');
  if (rope && goods) { const len = Math.max(0.6, 2.3 - lift); rope.scale.y = len; rope.position.y = -len / 2; goods.position.y = -len; goods.rotation.y = 0.2 * Math.sin(t * 0.5); }
}
