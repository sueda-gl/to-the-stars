// Stone hearth ring: the camp's built hearth, where the cooking happens. A low round wall of dressed
// limestone blocks on a pale flagstone apron, a bed of embers and charred logs inside, a spit across it on
// two forked posts with a terracotta pot hung over the coals, flat seat stones round about and a stone mortar. Footprint 3.8 x 3.8.
export const meta = {
  id: 'hearth-ring', name: 'Stone hearth ring', aliases: ['hearth ring', 'hearth', 'hearths', 'stone hearth', 'fire ring', 'stone ring', 'cooking hearth', 'ocak', 'taş ocak', 'ocak başı'],
  category: 'prop', stage: 'camp', footprint: { w: 3.8, d: 3.8 }, height: 1.4,
  desc: 'A low round wall of dressed stone round a bed of embers, a spit across it and seat stones about.'
};

export function build(api) {
  const R = api.ramps, g = api.group();
  const glow = api.clay('#f6b443', '#e0703a', '#a8402a');

  // the flagstone apron: a pale paved disc (reads from above as the hearth's footprint)
  g.add(api.cylinder({ r: 1.75, h: 0.06, y: 0.03, ramp: R.LIMESTONE, lift: -0.06, speck: 0.3, seg: 28 }));

  // the ring wall: twelve dressed blocks, alternating a shade so the joints read without scribbling
  const n = 12, rIn = 0.72, rOut = 1.05, hw = 0.38, rm = (rIn + rOut) / 2;
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2;
    g.add(api.box({ w: (rOut - rIn) * 0.98, h: hw, d: 2 * Math.PI * rm / n * 0.94, x: Math.cos(a) * rm, y: 0.06 + hw / 2, z: Math.sin(a) * rm,
      rot: -a, ramp: R.LIMESTONE, lift: (i % 2 ? 0.04 : -0.06) + api.range(-0.03, 0.03), speck: 0.26 }));
  }
  api.proxy(api.latheGeo({ points: [[rIn, 0.06], [rOut, 0.06], [rOut, 0.06 + hw], [rIn, 0.06 + hw], [rIn, 0.06]], seg: 28 }), g);

  // inside: the ember bed, two charred logs crossed on it, glowing coals
  g.add(api.cylinder({ r: rIn, h: 0.14, y: 0.13, ramp: R.INK, speck: 0.35, seg: 22 }));
  g.add(api.cylinder({ r: 0.09, h: 1.05, y: 0.27, rz: Math.PI / 2, rot: 0.5, ramp: R.WOOD, lift: -0.25, seg: 8 }));
  g.add(api.cylinder({ r: 0.08, h: 0.95, y: 0.33, rz: Math.PI / 2, rot: -0.7, ramp: R.WOOD, lift: -0.2, seg: 8 }));
  for (let i = 0; i < 6; i++) {
    const a = i * 1.1 + 0.2, rr = 0.15 + (i % 3) * 0.14;
    g.add(api.sphere({ r: 0.1, sy: 0.55, x: Math.cos(a) * rr, y: 0.22, z: Math.sin(a) * rr, mat: glow, seg: 8 }));
  }

  // the spit: two forked posts outside the wall and an iron bar across
  [-1, 1].forEach(s => {
    g.add(api.cylinder({ rb: 0.06, rt: 0.045, h: 1.15, x: s * 1.2, y: 0.06 + 0.575, z: 0, ramp: R.WOOD, seg: 8 }));
    g.add(api.cylinder({ r: 0.03, h: 0.26, x: s * 1.2 - 0.05, y: 1.27, rz: 0.5, ramp: R.WOOD, seg: 6 }));
    g.add(api.cylinder({ r: 0.03, h: 0.26, x: s * 1.2 + 0.05, y: 1.27, rz: -0.5, ramp: R.WOOD, seg: 6 }));
  });
  g.add(api.cylinder({ r: 0.025, h: 2.7, y: 1.2, rz: Math.PI / 2, ramp: R.IRON, seg: 6 }));
  g.add(api.cylinder({ r: 0.12, h: 0.04, x: 1.42, y: 1.2, rz: Math.PI / 2, ramp: R.IRON, seg: 10 }));   // the crank wheel
  // a terracotta cooking pot hung from the bar on a chain
  g.add(api.cylinder({ r: 0.015, h: 0.3, y: 1.05, ramp: R.IRON, seg: 4 }));
  g.add(api.lathe({ points: [[0, 0], [0.16, 0.02], [0.27, 0.14], [0.28, 0.27], [0.2, 0.38], [0.21, 0.44], [0.18, 0.44]], seg: 18, y: 0.46, ramp: R.TERRACOTTA }));
  g.add(api.torus({ r: 0.19, tube: 0.02, y: 0.9, ramp: R.IRON, seg: 14 }));

  // flat seat stones round the hearth (back and both sides; the front stays open)
  [[-Math.PI / 2, 1.0], [-Math.PI * 0.95, 0.9], [-0.15, 0.85], [Math.PI * 0.72, 0.8]].forEach(([a, s]) =>
    g.add(api.box({ w: 0.62 * s, h: 0.36, d: 0.42 * s, x: Math.cos(a) * 1.5, y: 0.18, z: Math.sin(a) * 1.5, rot: -a + Math.PI / 2,
      ramp: R.LIMESTONE, lift: api.range(-0.06, 0.08), speck: 0.3 })));

  // a stone mortar with its pestle, out front on the right
  g.add(api.cylinder({ rb: 0.26, rt: 0.3, h: 0.38, x: 1.25, y: 0.25, z: 1.05, ramp: R.LIMESTONE, lift: -0.04, seg: 16 }));
  g.add(api.cylinder({ r: 0.21, h: 0.02, x: 1.25, y: 0.445, z: 1.05, ramp: R.INK, seg: 16 }));
  g.add(api.cylinder({ rb: 0.05, rt: 0.07, h: 0.5, x: 1.3, y: 0.6, z: 1.05, rz: -0.35, ramp: R.WOOD, seg: 8 }));
  return g;
}
