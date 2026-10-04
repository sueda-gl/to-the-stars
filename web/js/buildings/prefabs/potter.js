// Potter's wheel stall: a reed-thatched shelter on four posts over shelves of pots, and at its open front the
// kick-wheel turning a wet clay pot, a low bench, a heap of clay and a water jar; leather-hard pots dry on a
// plank in the sun. From above: a straw hip roof, a round wheel with its pot, a row of little pots on a board.
// Footprint 4.4 x 4.3, the wheel faces +z.
export const meta = {
  id: 'potter', name: "Potter's wheel",
  aliases: ['potter', 'potters', "potter's wheel", 'potters wheel', 'pottery wheel', 'potter stall', "potter's stall", 'pottery stall', 'ceramics', 'çömlekçi', 'çömlekçi çarkı', 'çark', 'seramik atölyesi'],
  category: 'building', stage: 'hamlet', footprint: { w: 4.4, d: 4.3 }, height: 2.9,
  desc: 'A thatched shelter over shelves of pots, a turning kick-wheel with a wet pot, a clay heap and pots drying on a plank.'
};

export function build(api) {
  const R = api.ramps, g = api.group();
  const P = 0.1;
  const STRAW = ['#5e4a2a', '#7e663c', '#9f8452', '#b59a63', '#c4aa73'];
  const CLAY = ['#4c2618', '#6c3826', '#8d4c33', '#a6603f', '#b8724e'];
  const DRY = ['#8a6a4c', '#a8865f', '#c4a07a', '#d6b48e', '#e2c4a0'];
  g.add(api.box({ w: 3.6, h: P, d: 3.4, y: P / 2, ramp: R.SAND, speck: 0.26 }));

  // the shelter: four posts, a thatched hip roof over the back half
  const sz = -0.65, sw = 3.0, sd = 1.7, ey = P + 2.0;
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => g.add(api.box({ w: 0.13, h: ey - P, d: 0.13, x: a * (sw / 2 - 0.1), y: (ey + P) / 2, z: sz + b * (sd / 2 - 0.1), ramp: R.WOOD })));
  g.add(api.hipRoof({ w: sw, d: sd, h: 0.65, overhang: 0.32, y: ey, z: sz, ramp: STRAW, speck: 0.32 }));
  // shelves of pots along the back
  [0.45, 1.05].forEach((y, l) => {
    g.add(api.box({ w: 2.7, h: 0.06, d: 0.42, y: P + y, z: sz - 0.55, ramp: R.WOOD, lift: 0.04 }));
    for (let i = 0; i < 5; i++) { const r = api.range(0.11, 0.16); g.add(api.pot({ r, h: r * api.range(1.2, 2.0), plant: false, x: -1.1 + i * 0.55, y: P + y + 0.03, z: sz - 0.55, ramp: l ? DRY : R.TERRACOTTA })); }
  });

  // the kick-wheel: a heavy flywheel below, the wheel-head above, the wet pot on it (they all turn)
  const wx = -0.35, wz = 0.55;
  g.add(api.box({ w: 0.75, h: 0.38, d: 0.35, x: wx, y: P + 0.19, z: wz - 0.62, ramp: R.WOOD }));   // the bench
  const wheel = api.group({ x: wx, y: P, z: wz }); wheel.name = 'wheel';
  wheel.add(api.cylinder({ r: 0.46, h: 0.1, y: 0.12, ramp: R.WOOD, seg: 20 }));
  wheel.add(api.cylinder({ r: 0.045, h: 0.62, y: 0.45, ramp: R.WOOD, seg: 8 }));
  wheel.add(api.cylinder({ r: 0.3, h: 0.07, y: 0.78, ramp: R.WOOD, lift: 0.1, seg: 20 }));
  wheel.add(api.lathe({ points: [[0, 0], [0.16, 0], [0.2, 0.1], [0.19, 0.2], [0.12, 0.3], [0.12, 0.34], [0.1, 0.34]], seg: 16, y: 0.815, ramp: CLAY, speck: 0.1 }));
  g.add(wheel);
  g.add(api.cylinder({ rb: 0.18, rt: 0.2, h: 0.24, x: wx + 0.6, y: P + 0.12, z: wz + 0.05, ramp: R.TERRACOTTA, seg: 14 }));   // water bowl
  g.add(api.colourOnly(api.cylinder({ r: 0.17, h: 0.02, x: wx + 0.6, y: P + 0.245, z: wz + 0.05, ramp: ['#123848', '#1a4f63', '#22667a', '#2f7b8c'], seg: 14 })));
  // the clay heap and a tall water jar
  g.add(api.sphere({ r: 0.42, sy: 0.55, x: 1.05, y: P + 0.1, z: 0.65, ramp: CLAY, speck: 0.28 }));
  g.add(api.lathe({ points: [[0, 0], [0.16, 0.02], [0.27, 0.3], [0.26, 0.55], [0.13, 0.78], [0.12, 0.86], [0.15, 0.88], [0.1, 0.9]], seg: 16, x: 1.4, y: P, z: -0.1, ramp: R.TERRACOTTA }));

  // pots drying on a plank in the sun
  [-1.0, 1.0].forEach(dx => g.add(api.box({ w: 0.22, h: 0.16, d: 0.3, x: 0.1 + dx, y: P + 0.08, z: 1.35, ramp: R.TERRACOTTA, lift: -0.1 })));
  g.add(api.box({ w: 2.6, h: 0.06, d: 0.38, x: 0.1, y: P + 0.19, z: 1.35, ramp: R.WOOD, lift: 0.06 }));
  for (let i = 0; i < 6; i++) {
    const x = -1.05 + i * 0.43, bowl = i % 3 === 1;
    g.add(bowl ? api.lathe({ points: [[0, 0], [0.08, 0], [0.17, 0.06], [0.19, 0.11], [0.17, 0.11]], seg: 14, x, y: P + 0.22, z: 1.35, ramp: DRY })
      : api.pot({ r: 0.12, h: api.range(0.24, 0.34), plant: false, x, y: P + 0.22, z: 1.35, ramp: DRY }));
  }
  const kind = api.pick(['olive', 'lemon', 'cypress', 'oak']);
  g.add(api.tree({ kind, h: kind === 'cypress' ? 3.8 : 2.6, x: 1.75, z: -1.75 }));

  api.proxy(api.boxGeo({ w: 2.7, h: 1.2, d: 0.42, y: P + 0.75, z: sz - 0.55 }), g);
  return g;
}

export function animate(obj, t) {
  const w = obj.getObjectByName('wheel'); if (w) w.rotation.y = 2.2 * t;
}
