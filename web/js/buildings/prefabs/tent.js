// Tent: a ridge tent of sun-bleached canvas. Two slopes over a ridge pole that pokes out at both ends, the
// front flaps tied back off an ink-dark triangle of a doorway, a painted red band along the hem, guy lines
// pegged out at the corners, a bedroll and a crate by the door. Footprint 3.6 x 4.2, the doorway faces +z.
export const meta = {
  id: 'tent', name: 'Tent', aliases: ['tents', 'canvas tent', 'ridge tent', 'shelter tent', 'çadır', 'çadırlar'],
  category: 'building', stage: 'camp', footprint: { w: 3.6, d: 4.2 }, height: 2.0,
  desc: 'A canvas ridge tent with tied-back flaps, guy lines pegged out and a bedroll by the door.'
};

export function build(api) {
  const R = api.ramps, g = api.group();
  const canvas = api.pick(['#e9dcbf', '#e4d3b0', '#ecdcc0']);
  const hw = 1.15, H = 1.62, D = 2.6;              // half width at the hem, ridge height, length (along z)

  // a pale groundsheet showing round the hem
  g.add(api.box({ w: hw * 2 + 0.3, h: 0.04, d: D + 0.35, y: 0.02, ramp: R.SAND, speck: 0.2, lift: -0.04 }));

  // the canvas: one triangular prism, ridge along z, the slopes face +-x
  g.add(api.extrude({ shape: [[-hw, 0], [hw, 0], [0, H]], depth: D, y: 0.04, color: canvas, speck: 0.12 }));
  // a red band painted along the hem of both slopes (the one accent)
  const slope = Math.atan2(H, hw), bandW = 0.24;
  [-1, 1].forEach(s => g.add(api.box({ w: bandW, h: 0.03, d: D + 0.02, x: s * (hw - bandW * 0.5 * Math.cos(slope)), y: 0.04 + bandW * 0.5 * Math.sin(slope),
    rz: -s * slope, ramp: R.REDWALL })));

  // the doorway: an ink triangle on the front gable, its two flaps rolled up and tied along the door's edges
  const dw = 0.62, dh = H * 0.84, edge = Math.hypot(dw, dh), lean = Math.atan2(dw, dh);
  g.add(api.extrude({ shape: [[-dw, 0], [dw, 0], [0, dh]], depth: 0.03, y: 0.04, z: D / 2 + 0.01, ramp: R.INK, speck: 0.05 }));
  [-1, 1].forEach(s => g.add(api.cylinder({ r: 0.08, h: edge * 0.94, x: s * dw / 2, y: 0.04 + dh / 2 - 0.04, z: D / 2 + 0.07, rz: s * lean,
    color: canvas, lift: -0.08, speck: 0.14, seg: 10 })));
  // the ridge pole, poking out front and back, and the two upright poles at the gables
  g.add(api.cylinder({ r: 0.05, h: D + 0.6, y: 0.04 + H + 0.02, rx: Math.PI / 2, ramp: R.WOOD, seg: 8 }));
  [-1, 1].forEach(s => g.add(api.cylinder({ r: 0.045, h: H, x: 0, y: 0.04 + H / 2, z: s * (D / 2 + 0.1), ramp: R.WOOD, seg: 8 })));

  // guy lines from the ridge ends and the hem corners out to wooden pegs
  const peg = (x, z) => g.add(api.box({ w: 0.07, h: 0.22, d: 0.07, x, y: 0.11, z, rz: x > 0 ? -0.25 : 0.25, ramp: R.WOOD, lift: 0.1 }));
  [-1, 1].forEach(s => {
    const z0 = s * (D / 2 + 0.25), z1 = s * (D / 2 + 1.0);
    g.add(api.tube({ points: [[0, H + 0.06, z0], [0, H * 0.55, (z0 + z1) / 2], [0, 0.18, z1]], r: 0.014, seg: 8, ramp: R.SAND }));
    peg(0, z1);
    [-1, 1].forEach(sx => {
      const x0 = sx * hw * 0.55, y0 = H * 0.5, x1 = sx * (hw + 0.75), zc = s * (D / 2 - 0.35);
      g.add(api.tube({ points: [[x0, y0, zc], [x1, 0.18, zc + s * 0.25]], r: 0.012, seg: 4, ramp: R.SAND }));
      peg(x1, zc + s * 0.25);
    });
  });

  // a rolled bedroll and a small crate by the door
  g.add(api.cylinder({ r: 0.17, h: 0.95, x: 0.95, y: 0.17, z: D / 2 + 0.55, rz: Math.PI / 2, rot: 0.25, ramp: api.pick([R.OCHRE, R.SAGE, R.REDWALL]), seg: 12 }));
  g.add(api.crate({ s: 0.48, x: -0.95, z: D / 2 + 0.5, rot: 0.3 }));

  // keylines: the canvas prism draws its own clean triangle; the guy lines are colour only
  return g;
}
