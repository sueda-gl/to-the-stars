// Lean-to: the first roof. A thatched slope falls from a crossbar on two forked posts to the ground behind,
// closed at the sides by woven wattle wings; under it a bed of straw, in front a little stone fire ring and
// a tree giving shade (oak, olive or pine, picked at random). Footprint 4.6 x 4.4. The open side faces +x and
// the thatched back slope faces the light (-x), so from the bird's-eye camera the roof reads as one lit slope.
export const meta = {
  id: 'lean-to', name: 'Lean-to shelter', aliases: ['lean-tos', 'lean to', 'leanto', 'shelter', 'shelters', 'brush shelter', 'barınak', 'sundurma', 'kulübe'],
  category: 'building', stage: 'camp', footprint: { w: 4.6, d: 4.4 }, height: 3.4,
  desc: 'A thatched slope on two forked posts with wattle sides, a straw bed under it and a small fire in front.'
};

export function build(api) {
  const R = api.ramps, root = api.group();
  const g = api.group({ rot: Math.PI / 2 });   // built facing +z, then turned so the open side faces +x
  root.add(g);
  const W = 2.8, zf = 0.55, zb = -1.35, hf = 1.75;   // roof width, front (crossbar) z, back (ground) z, crossbar height
  const run = zf - zb, slope = Math.atan2(hf, run), L = Math.hypot(run, hf) + 0.35;

  // trodden earth under the shelter
  g.add(api.box({ w: W + 0.5, h: 0.05, d: run + 1.3, x: 0, y: 0.025, z: (zf + zb) / 2 + 0.3, ramp: R.SAND, speck: 0.26, lift: -0.06 }));

  // two forked posts and the crossbar resting in the forks
  [-1, 1].forEach(s => {
    const x = s * (W / 2 - 0.15);
    g.add(api.cylinder({ rb: 0.09, rt: 0.07, h: hf, x, y: hf / 2, z: zf, ramp: R.WOOD, seg: 8 }));
    g.add(api.cylinder({ r: 0.04, h: 0.38, x: x + s * 0.07, y: hf + 0.12, z: zf, rz: -s * 0.45, ramp: R.WOOD, seg: 6 }));
  });
  g.add(api.cylinder({ r: 0.075, h: W + 0.5, y: hf + 0.02, z: zf, rz: Math.PI / 2, ramp: R.WOOD, seg: 10 }));

  // the thatch, with a straw roll along the ridge
  const midZ = (zf + zb) / 2, midY = hf / 2;
  const along = k => ({ z: midZ + Math.cos(slope) * k, y: midY + Math.sin(slope) * k });   // a point k up the slope from its middle
  // four shingled courses of straw, each lapping over the one below (its lower edge throws a step), lighter toward the ridge
  const nC = 4, cd = L / nC + 0.18, nz = -Math.sin(slope), ny = Math.cos(slope);   // nz, ny: the roof's outward normal
  for (let i = 0; i < nC; i++) {
    const p = along(-L / 2 + (i + 0.5) * L / nC), off = 0.1 + i * 0.07;
    g.add(api.box({ w: W + 0.3 - i * 0.04, h: 0.16, d: cd, y: p.y + ny * off, z: p.z + nz * off, rx: -slope, color: '#c79b50', lift: -0.06 + i * 0.06, speck: 0.42 }));
  }
  // a rolled straw bundle along the lower edge of each upper course: the thatch's rows, read from above
  for (let i = 1; i < nC; i++) {
    const p = along(-L / 2 + i * L / nC + 0.04), off = 0.1 + i * 0.07 + 0.02;
    g.add(api.cylinder({ r: 0.075, h: W + 0.26 - i * 0.04, y: p.y + ny * off, z: p.z + nz * off, rz: Math.PI / 2, color: '#a87d3e', lift: 0.02 * i, speck: 0.4, seg: 8 }));
  }
  const lip = along(L / 2 - 0.08);
  g.add(api.cylinder({ r: 0.13, h: W + 0.4, y: lip.y + 0.36, z: lip.z - 0.2, rz: Math.PI / 2, color: '#b88a45', lift: -0.02, speck: 0.45, seg: 10 }));

  // wattle wings closing the two sides (woven hazel: one triangular panel each)
  [-1, 1].forEach(s => g.add(api.extrude({ shape: [[0, 0], [run, 0], [run, hf * 0.92]], depth: 0.1, x: s * (W / 2 - 0.05), y: 0, z: zb, rot: -Math.PI / 2,
    ramp: R.WOOD, lift: 0.08, speck: 0.4 })));

  // a straw bed and a rolled hide inside, in the shade
  g.add(api.box({ w: W - 0.6, h: 0.16, d: 0.9, y: 0.08, z: -0.25, ramp: R.YELLOW, lift: -0.18, speck: 0.4 }));
  g.add(api.cylinder({ r: 0.15, h: 0.8, x: 0.55, y: 0.3, z: -0.4, rz: Math.PI / 2, ramp: R.REDWALL, seg: 10 }));

  // a little fire ring in front: six stones round a dark ash patch, one log on it
  const fz = 1.6, fx = 0.4;
  g.add(api.cylinder({ r: 0.36, h: 0.05, x: fx, y: 0.05, z: fz, ramp: R.INK, speck: 0.3, seg: 14 }));
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2 + 0.3;
    g.add(api.sphere({ r: 0.14, sx: 1.3, sy: 0.7, x: fx + Math.cos(a) * 0.48, y: 0.08, z: fz + Math.sin(a) * 0.48, rot: -a, ramp: R.LIMESTONE, lift: api.range(-0.1, 0.05), seg: 10 }));
  }
  g.add(api.cylinder({ r: 0.07, h: 0.62, x: fx, y: 0.14, z: fz, rz: Math.PI / 2, rot: 0.6, ramp: R.WOOD, seg: 8 }));
  g.add(api.sphere({ r: 0.07, sy: 0.6, x: fx + 0.08, y: 0.1, z: fz - 0.06, ramp: R.RED, seg: 8 }));

  // a shade tree behind the lit (left) corner: an oak, an olive or a pine, chosen per variant
  const kind = api.pick(['oak', 'olive', 'pine', 'oak', 'olive']);
  root.add(api.tree({ kind, h: kind === 'pine' ? 4.6 : 3.6, x: -1.9, z: -1.7 }));

  // keylines: each thatch course draws its own edge, so the courses read as bands of straw
  return root;
}
