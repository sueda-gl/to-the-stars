// Gazebo: an octagonal garden pavilion. A raised octagonal limestone platform with two steps at the front, eight
// slender whitewashed columns, a wooden ring beam, a terracotta eight-sided roof with a little lantern and gilded
// finial; two potted citrus trees flank the steps, a shrub at the back, a stone table in the middle.
// From above: a crisp octagonal terracotta star with the lantern at its centre. Footprint 6 x 6.
export const meta = {
  id: 'gazebo', name: 'Gazebo',
  aliases: ['gazebo', 'gazebos', 'pavilion', 'pavilions', 'bandstand', 'kiosk', 'belvedere', 'folly', 'çardak', 'köşk', 'kameriye', 'kamelya'],
  category: 'prop', stage: 'village', footprint: { w: 6, d: 6 }, height: 5.0,
  desc: 'An octagonal pavilion with slender columns and a terracotta roof.'
};

export function build(api) {
  const R = api.ramps, g = api.group();
  const O = Math.PI / 8;   // an octagon with a flat face to the front

  // platform and steps
  g.add(api.cylinder({ r: 2.45, h: 0.6, y: 0.3, seg: 8, rot: O, ramp: R.LIMESTONE, lift: 0.03 }));
  g.add(api.stairs({ w: 1.3, steps: 2, rise: 0.25, run: 0.3, y: 0, z: 2.5 }));
  const P = 0.6;

  // a round stone table in the middle on a turned foot
  g.add(api.cylinder({ rb: 0.22, rt: 0.14, h: 0.6, y: P + 0.3, seg: 12, ramp: R.LIMESTONE, lift: -0.05 }));
  g.add(api.cylinder({ r: 0.6, h: 0.1, y: P + 0.65, seg: 20, ramp: R.LIMESTONE, lift: 0.05 }));

  // eight columns at the octagon's corners
  const CR = 2.05, CH = 2.6;
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4 + Math.PI / 8;
    g.add(api.column({ r: 0.1, h: CH, x: Math.sin(a) * CR, y: P, z: Math.cos(a) * CR, ramp: R.WHITEWASH }));
  }
  // ring beam and roof
  const E = P + CH;
  g.add(api.cylinder({ r: CR + 0.14, h: 0.3, y: E + 0.15, seg: 8, rot: O, ramp: R.WOOD, lift: 0.06 }));
  g.add(api.cone({ r: CR + 0.65, h: 1.35, y: E + 0.3 + 0.675, seg: 8, rot: O, ramp: R.TERRACOTTA }));
  // the little lantern, its cap and the finial
  g.add(api.cylinder({ r: 0.32, h: 0.4, y: E + 1.55, seg: 8, rot: O, ramp: R.WHITEWASH }));
  g.add(api.cone({ r: 0.46, h: 0.42, y: E + 1.96, seg: 8, rot: O, ramp: R.TERRACOTTA }));
  g.add(api.sphere({ r: 0.09, y: E + 2.23, ramp: R.GOLD }));

  // potted citrus (or olive) flanking the steps, a shrub at the back
  [-1, 1].forEach(s => {
    g.add(api.cylinder({ rb: 0.24, rt: 0.32, h: 0.42, x: s * 1.15, y: 0.21, z: 2.7, ramp: R.TERRACOTTA, seg: 12 }));
    g.add(api.tree({ kind: api.pick(['lemon', 'orange', 'olive']), h: 1.9, x: s * 1.15, y: 0.38, z: 2.7 }));
  });
  g.add(api.shrub({ r: 0.7, h: 0.9, x: -2.3, z: -1.4 }));

  // keylines: the platform as one drum, the roof as one cone (columns keep their own)
  api.proxy(api.cylinderGeo({ r: 2.45, h: 0.6, y: 0.3, seg: 8, rot: O }), g);
  return g;
}
