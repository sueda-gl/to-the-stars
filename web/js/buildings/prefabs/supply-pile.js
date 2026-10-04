// Supply pile: what the first boat or cart brought. Crates stacked two high under a red canvas tarp, plump
// grain sacks slumped against them, barrels (one rolled on its side on chocks), two terracotta amphorae and a
// coil of rope. Footprint 3.4 x 2.8, the open side faces +z.
export const meta = {
  id: 'supply-pile', name: 'Supply pile', aliases: ['supply piles', 'supplies', 'stores', 'provisions', 'crates', 'sacks', 'barrels', 'stockpile', 'stash', 'erzak', 'malzeme yığını', 'ikmal'],
  category: 'prop', stage: 'camp', footprint: { w: 3.4, d: 2.8 }, height: 1.9,
  desc: 'Crates under a red tarp, grain sacks, barrels, amphorae and a coil of rope: the camp\'s first stores.'
};

export function build(api) {
  const R = api.ramps, g = api.group();
  const sackCol = api.pick(['#d6c194', '#dcc8a0', '#cfb98c']);

  // the crate stack at the back: three below, one on top, a little askew
  const cz = -0.6;
  g.add(api.crate({ s: 0.72, x: -1.0, z: cz, rot: 0.1 }));
  g.add(api.crate({ s: 0.7, x: -0.2, z: cz - 0.12, rot: -0.18 }));
  g.add(api.crate({ s: 0.6, x: 0.55, z: cz + 0.05, rot: 0.32, ramp: '#a2764b' }));
  g.add(api.crate({ s: 0.6, x: -0.55, y: 0.72, z: cz, rot: 0.22 }));
  // the red canvas tarp thrown over the top crate and hanging down its front
  g.add(api.box({ w: 0.95, h: 0.05, d: 0.9, x: -0.55, y: 1.35, z: cz, rot: 0.22, ramp: R.REDWALL, speck: 0.12 }));
  g.add(api.box({ w: 0.9, h: 0.5, d: 0.05, x: -0.47, y: 1.1, z: cz + 0.46, rot: 0.22, rx: 0.12, ramp: R.REDWALL, lift: -0.04, speck: 0.12 }));

  // grain sacks slumped against the crates: a plump body and a tied neck each
  const sack = (x, z, s, rot, lying) => {
    const k = api.group({ x, z, rot });
    if (lying) {
      k.add(api.sphere({ r: 0.32 * s, sx: 0.85, sy: 0.62, sz: 1.35, y: 0.2 * s, color: sackCol, speck: 0.2 }));
      k.add(api.cylinder({ rb: 0.1 * s, rt: 0.07 * s, h: 0.16 * s, y: 0.22 * s, z: 0.47 * s, rx: Math.PI / 2, color: sackCol, lift: -0.08, seg: 8 }));
    } else {
      k.add(api.sphere({ r: 0.32 * s, sx: 1.0, sy: 1.12, sz: 0.9, y: 0.33 * s, color: sackCol, speck: 0.2 }));
      k.add(api.cylinder({ rb: 0.12 * s, rt: 0.08 * s, h: 0.18 * s, y: 0.72 * s, color: sackCol, lift: -0.06, seg: 8 }));
      k.add(api.torus({ r: 0.09 * s, tube: 0.025, y: 0.68 * s, ramp: R.WOOD, seg: 12 }));
    }
    g.add(k);
  };
  sack(-1.15, 0.1, 1.0, 0.2, false);
  sack(-0.55, 0.12, 0.92, -0.3, false);
  sack(-0.1, 0.45, 1.0, 0.9, true);

  // barrels: two standing on the right, one on its side in front on two chocks
  g.add(api.barrel({ r: 0.32, h: 0.86, x: 1.22, z: -0.55 }));
  g.add(api.barrel({ r: 0.3, h: 0.8, x: 1.05, z: 0.15 }));
  // (the rolled barrel is turned by hand: a closed lathe on its side, two iron hoops facing along its axis)
  const lb = api.group({ x: 0.75, y: 0.31, z: 0.95, rot: 0.3 }), br = 0.3, bh = 0.82;
  lb.add(api.lathe({ points: [[0, 0], [br * 0.82, 0], [br, bh * 0.3], [br * 1.04, bh * 0.5], [br, bh * 0.7], [br * 0.82, bh], [0, bh]], seg: 16, x: bh / 2, rz: Math.PI / 2, ramp: R.WOOD }));
  [-0.3, 0.3].forEach(f => lb.add(api.colourOnly(api.torus({ r: br * 0.98, tube: 0.025, flat: false, x: f * bh, rot: Math.PI / 2, ramp: R.IRON, seg: 18 }))));
  g.add(lb);
  g.add(api.box({ w: 0.12, h: 0.1, d: 0.3, x: 0.47, y: 0.05, z: 1.05, rot: 0.3, ramp: R.WOOD, lift: -0.15 }));
  g.add(api.box({ w: 0.12, h: 0.1, d: 0.3, x: 1.02, y: 0.05, z: 0.86, rot: 0.3, ramp: R.WOOD, lift: -0.15 }));

  // two terracotta amphorae leaning on the crates, and a coil of rope
  const amph = [[0, 0], [0.07, 0.04], [0.2, 0.26], [0.23, 0.48], [0.13, 0.72], [0.07, 0.8], [0.08, 0.9], [0.06, 0.92]];
  g.add(api.lathe({ points: amph, seg: 16, x: 0.25, z: -0.05, rx: -0.18, ramp: R.TERRACOTTA }));
  g.add(api.lathe({ points: amph, seg: 16, x: 0.55, y: 0, z: 0.05, rx: -0.12, rz: -0.15, sx: 0.9, sy: 0.88, sz: 0.9, ramp: R.TERRACOTTA, lift: -0.05 }));
  g.add(api.torus({ r: 0.24, tube: 0.06, x: -1.0, y: 0.06, z: 0.85, ramp: R.SAND, seg: 18 }));
  g.add(api.torus({ r: 0.17, tube: 0.055, x: -1.0, y: 0.15, z: 0.85, ramp: R.SAND, lift: 0.08, seg: 16 }));
  return g;
}
