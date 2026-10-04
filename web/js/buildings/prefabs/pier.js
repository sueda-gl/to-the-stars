// Harbour pier: a stone mole running out from the shore (-z) into the water (+z). A limestone pier on a darker
// wet-stone foot, a paved deck with iron bollards along both edges, a flight of water steps cut into its lit side,
// timber mooring posts standing in the water alongside, coils of rope, a little lamp post and a round pier-head at
// the end. It sits in water: y = 0 is the water line. From above: a long pale finger into the blue with its bollard
// dots, the posts as a dotted line beside it. Footprint 6 x 16, the pier-head points to +z.
export const meta = {
  id: 'pier', name: 'Harbour pier',
  aliases: ['pier', 'piers', 'harbour pier', 'harbor pier', 'mole', 'breakwater', 'mooring', 'harbour wall', 'iskele', 'iskeleler', 'mendirek', 'rıhtım'],
  category: 'building', stage: 'town', footprint: { w: 6, d: 16 }, height: 3.2, water: true,
  desc: 'A stone harbour pier with bollards, water steps and timber mooring posts.'
};

export function build(api) {
  const R = api.ramps, g = api.group();
  const L = 13, W = 3.0, Z0 = -7, ZC = Z0 + L / 2, top = 0.9, foot = -1.2;

  // the wet foot (below and just above the water) and the pier body
  g.add(api.box({ w: W + 0.3, h: 0.5 - foot, d: L, y: (foot + 0.5) / 2, z: ZC, ramp: R.LIMESTONE, lift: -0.22, speck: 0.3 }));
  g.add(api.box({ w: W, h: top - 0.45, d: L, y: 0.45 + (top - 0.45) / 2, z: ZC, mat: api.lambert('#e3d2b4') }));
  // the paved deck: a pale kerb all round and a slightly darker paving inside
  // (side by side, never stacked: a thin slab on a slab flickers from the leader's height)
  [-1, 1].forEach(s => g.add(api.box({ w: 0.36, h: 0.12, d: L, x: s * (W / 2 - 0.12), y: top + 0.06, z: ZC, ramp: R.LIMESTONE, lift: 0.06 })));
  g.add(api.box({ w: W - 0.6, h: 0.12, d: L, y: top + 0.06, z: ZC, ramp: R.SAND, lift: -0.04, speck: 0.22 }));

  // the round pier-head
  const HZ = Z0 + L;
  g.add(api.cylinder({ r: W / 2 + 0.6, h: 0.5 - foot, y: (foot + 0.5) / 2, z: HZ, seg: 28, ramp: R.LIMESTONE, lift: -0.22, speck: 0.3 }));
  g.add(api.cylinder({ r: W / 2 + 0.45, h: top - 0.45 + 0.12, y: 0.45 + (top - 0.33) / 2, z: HZ, seg: 28, ramp: R.LIMESTONE, lift: 0.04 }));
  // a lamp post on the head (a lantern, not a lighthouse)
  g.add(api.cylinder({ r: 0.07, h: 2.2, y: top + 0.12 + 1.1, z: HZ + 0.4, ramp: R.IRON, seg: 8 }));
  g.add(api.box({ w: 0.36, h: 0.42, d: 0.36, y: top + 2.5, z: HZ + 0.4, ramp: R.GOLD, lift: 0.08 }));
  g.add(api.cone({ r: 0.3, h: 0.26, y: top + 2.84, z: HZ + 0.4, seg: 4, rot: Math.PI / 4, ramp: R.IRON }));

  // bollards along both edges
  for (let i = 0; i < 4; i++) [-1, 1].forEach(s =>
    g.add(api.cylinder({ rb: 0.17, rt: 0.13, h: 0.42, x: s * (W / 2 - 0.25), y: top + 0.12 + 0.21, z: Z0 + 2.2 + i * 3.0, ramp: R.IRON, seg: 12 })));
  // rope coils by two of them
  g.add(api.torus({ r: 0.26, tube: 0.08, x: W / 2 - 0.65, y: top + 0.2, z: Z0 + 5.6, ramp: R.SAND }));
  g.add(api.torus({ r: 0.22, tube: 0.07, x: -W / 2 + 0.65, y: top + 0.2, z: Z0 + 8.8, ramp: R.SAND }));

  // water steps down the lit (-x) side
  g.add(api.stairs({ w: 2.4, steps: 4, rise: 0.27, run: 0.28, x: -W / 2 - 0.15 - 0.56, y: -0.18, z: Z0 + 6.5, rot: -Math.PI / 2, ramp: R.LIMESTONE, lift: -0.08 }));

  // mooring posts in the water on the right, a pair at the head
  for (let i = 0; i < 4; i++) {
    const h = api.range(2.2, 2.7);
    g.add(api.cylinder({ rt: 0.12, rb: 0.15, h, x: W / 2 + 1.3, y: foot + h / 2, z: Z0 + 2.4 + i * 3.0, ramp: R.WOOD, seg: 9, lift: -0.08 }));
    g.add(api.cylinder({ r: 0.155, h: 0.18, x: W / 2 + 1.3, y: 0.15, z: Z0 + 2.4 + i * 3.0, ramp: R.SEA, lift: 0.05, seg: 9 }));   // the wet tide line
  }
  [-1, 1].forEach(s => g.add(api.cylinder({ rt: 0.12, rb: 0.15, h: 2.5, x: s * 1.2, y: foot + 1.25, z: HZ + W / 2 + 1.2, ramp: R.WOOD, seg: 9, lift: -0.08 })));

  // keylines: the pier as one long box, the head as a drum
  api.proxy(api.boxGeo({ w: W + 0.3, h: top - foot, d: L, y: (foot + top) / 2, z: ZC }), g);
  api.proxy(api.cylinderGeo({ r: W / 2 + 0.6, h: top - foot, y: (foot + top) / 2, z: HZ, seg: 28 }), g);
  api.floats(g);
  return g;
}
