// Granary: an ochre storehouse raised clear of the damp on six limestone staddle stones (mushroom-capped
// posts), under a broad terracotta hip roof with a row of ink-dark vents; timber steps climb to its door, grain
// jars wait at their foot, and a round whitewashed silo with a terracotta cone stands at its back shoulder.
// Footprint 5 x 5, the steps and door face +z.
export const meta = { id: 'granary', footprint: { w: 5, d: 5 }, height: 5.6 };

export function build(api) {
  const R = api.ramps, g = api.group();

  // the store's frame: x/z of the body and the raised floor height
  const bx = -0.45, bz = -0.25, bw = 3.3, bd = 2.7, floor = 1.0, bh = 2.0;

  // six staddle stones: a tapering limestone post with a flat round cap
  for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) {
    const x = bx - 1.3 + i * 1.3, z = bz - 0.95 + j * 1.9;
    g.add(api.cylinder({ rb: 0.2, rt: 0.13, h: 0.66, x, y: 0.33, z, ramp: R.LIMESTONE, seg: 12 }));
    g.add(api.cylinder({ r: 0.34, h: 0.14, x, y: 0.73, z, ramp: R.LIMESTONE, lift: 0.05, seg: 14 }));
  }
  // timber floor deck, then the ochre walls (Lambert: the roof shades them)
  g.add(api.box({ w: bw + 0.35, h: 0.2, d: bd + 0.35, x: bx, y: floor - 0.1, z: bz, ramp: R.WOOD }));
  g.add(api.box({ w: bw, h: bh, d: bd, x: bx, y: floor + bh / 2, z: bz, mat: api.lambert('#d4a04a', 0.16) }));
  // a broad hip roof with deep eaves
  g.add(api.hipRoof({ w: bw, d: bd, h: 1.35, overhang: 0.42, x: bx, y: floor + bh, z: bz, ramp: R.TERRACOTTA }));

  // front (+z): a square timber door, a row of three slit vents under the eaves; vents on the lit side too
  const front = bz + bd / 2;
  g.add(api.inkDoor({ w: 0.95, h: 1.45, x: bx, y: floor, z: front, arched: false, frame: R.WOOD }));
  for (let i = -1; i <= 1; i += 2) g.add(api.inkWindow({ w: 0.22, h: 0.55, x: bx + i * 1.05, y: floor + 1.35, z: front, frame: false }));
  for (let i = -1; i <= 1; i++) g.add(api.inkWindow({ w: 0.22, h: 0.55, x: bx - bw / 2, y: floor + 1.35, z: bz + i * 0.8, rot: -Math.PI / 2, frame: false }));

  // timber steps up to the door (the flight climbs toward -z, so its foot is at the front)
  g.add(api.stairs({ w: 1.0, steps: 5, rise: floor / 5, run: 0.3, x: bx, y: 0, z: front + 0.92, ramp: R.WOOD }));

  // grain jars at the foot of the steps: a turned, round-shouldered jar with a neck
  const sack = [[0.0, 0], [0.26, 0.02], [0.32, 0.22], [0.3, 0.44], [0.2, 0.58], [0.08, 0.64], [0.12, 0.72], [0.0, 0.74]];
  [[bx + 0.95, front + 0.95, 1], [bx + 1.5, front + 0.7, 0.85], [bx - 0.95, front + 1.05, 0.9]].forEach(([x, z, k]) =>
    g.add(api.lathe({ points: sack.map(p => [p[0] * k, p[1] * k]), x, y: 0, z, ramp: R.TERRACOTTA, lift: 0.06, seg: 14 })));

  // the silo: a whitewashed drum with a terracotta cone, a small ink hatch
  const cx = 1.75, cz = -1.25, cr = 0.85, ch = 4.0;
  g.add(api.cylinder({ r: cr + 0.08, h: 0.25, x: cx, y: 0.125, z: cz, ramp: R.LIMESTONE, seg: 22 }));
  g.add(api.cylinder({ rb: cr, rt: cr - 0.05, h: ch, x: cx, y: 0.25 + ch / 2, z: cz, mat: api.lambert('#efe4d2'), seg: 22 }));
  g.add(api.cylinder({ r: cr + 0.06, h: 0.16, x: cx, y: 0.25 + ch + 0.02, z: cz, ramp: R.LIMESTONE, seg: 22 }));
  g.add(api.cone({ r: cr + 0.22, h: 1.15, x: cx, y: 0.25 + ch + 0.1 + 0.575, z: cz, ramp: R.TERRACOTTA, seg: 22 }));
  g.add(api.inkWindow({ w: 0.36, h: 0.5, x: cx + 0.3, y: 3.1, z: cz + cr - 0.06, rot: 0.35, arched: true, frame: false }));

  // keylines: the store body (one box), the silo as one drum
  api.proxy(api.boxGeo({ w: bw, h: bh, d: bd, x: bx, y: floor + bh / 2, z: bz }), g);
  api.proxy(api.cylinderGeo({ rb: cr, rt: cr - 0.05, h: ch, x: cx, y: 0.25 + ch / 2, z: cz, seg: 22 }), g);
  return g;
}
