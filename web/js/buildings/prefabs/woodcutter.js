// Woodcutter: an open timber shed with a red back wall and a sloping terracotta roof, its bay stacked with
// logs (round ends to the front); in the yard a chopping stump with the axe bitten in, a felled trunk on two
// chocks, split billets, and an umbrella pine beside it. Footprint 4 x 4, the open bay faces +z.
export const meta = { id: 'woodcutter', footprint: { w: 4, d: 4 }, height: 5.0 };

export function build(api) {
  const R = api.ramps, g = api.group();

  // a packed-earth yard
  g.add(api.box({ w: 3.9, h: 0.1, d: 3.9, y: 0.05, ramp: R.SAND, speck: 0.24 }));

  // the shed: red back wall, four posts, a mono-pitch roof falling to the front
  const sz = -0.85, sw = 2.6, sd = 1.7, hb = 2.5, hf = 1.95, shx = 0.4;   // the shed sits right of centre: the pine stands clear of its roof
  g.add(api.box({ w: sw, h: hb, d: 0.24, x: shx, y: 0.1 + hb / 2, z: sz - sd / 2, mat: api.lambert('#c23a2c', 0.12) }));
  const posts = [[shx - sw / 2 + 0.1, hf], [shx + sw / 2 - 0.1, hf]];
  for (let i = 0; i < posts.length; i++) g.add(api.box({ w: 0.16, h: posts[i][1], d: 0.16, x: posts[i][0], y: 0.1 + posts[i][1] / 2, z: sz + sd / 2 - 0.1, ramp: R.WOOD }));
  const slope = Math.atan2(hb - hf, sd), rl = Math.hypot(sd, hb - hf) + 0.55;
  g.add(api.box({ w: sw + 0.5, h: 0.14, d: rl, x: shx, y: 0.1 + (hb + hf) / 2 + 0.1, z: sz + 0.1, rx: slope, ramp: R.TERRACOTTA }));

  // the log stack in the bay: three courses, pale cut ends facing the front (each end its own pencil circle)
  const logs = api.group({ x: shx, y: 0.1, z: sz + 0.05 });
  const course = [5, 4, 3], lr = 0.24, ll = 1.35;
  for (let c = 0; c < course.length; c++) for (let i = 0; i < course[c]; i++) {
    const x = (i - (course[c] - 1) / 2) * lr * 2.05, y = lr + c * lr * 1.75;
    logs.add(api.cylinder({ r: lr, h: ll, x, y, rx: Math.PI / 2, ramp: R.WOOD, lift: 0.06 * ((i + c) % 2), seg: 12 }));
    logs.add(api.cylinder({ r: lr * 0.86, h: 0.03, x, y, z: ll / 2 + 0.01, rx: Math.PI / 2, color: '#d9b27a', speck: 0.1 }));
  }
  g.add(logs);

  // the chopping stump with an axe bitten into it
  g.add(api.cylinder({ rb: 0.42, rt: 0.36, h: 0.55, x: -1.05, y: 0.1 + 0.275, z: 0.95, ramp: R.WOOD, seg: 16 }));
  g.add(api.box({ w: 0.07, h: 0.95, d: 0.07, x: -0.9, y: 0.98, z: 1.12, rz: -0.55, rx: 0.3, ramp: R.OCHRE }));
  g.add(api.box({ w: 0.36, h: 0.2, d: 0.06, x: -1.1, y: 0.68, z: 0.98, rz: -0.55, ramp: R.IRON }));
  // a felled trunk resting on two chocks
  g.add(api.box({ w: 0.3, h: 0.22, d: 0.5, x: 0.35, y: 0.21, z: 1.25, ramp: R.WOOD, lift: -0.1 }));
  g.add(api.box({ w: 0.3, h: 0.22, d: 0.5, x: 1.55, y: 0.21, z: 1.25, ramp: R.WOOD, lift: -0.1 }));
  g.add(api.cylinder({ rb: 0.3, rt: 0.26, h: 2.3, x: 0.95, y: 0.6, z: 1.25, rz: Math.PI / 2, ramp: R.WOOD, seg: 14 }));
  // a few split billets by the stump
  for (let i = 0; i < 3; i++) g.add(api.box({ w: 0.14, h: 0.14, d: 0.5, x: -0.35 + i * 0.17, y: 0.17, z: 0.85 + (i % 2) * 0.12, rot: 0.5 + i * 0.4, ramp: R.WOOD, lift: 0.15 }));

  // an umbrella pine beside the lit wall: its trunk stands clear of the roof (the roof ends at x = -1.15), a domed
  // canopy (api.pine reads as a volume from above, not a disc) leaning a little toward the yard, above the eaves
  g.add(api.pine({ h: 4.2, r: 0.95, lean: 0.45, leanTo: [-0.15, 1], x: -1.5, z: -0.7 }));

  // keylines: the trunk as one smooth cylinder (the logs keep their round ends)
  api.proxy(api.cylinderGeo({ rb: 0.3, rt: 0.26, h: 2.3, x: 0.95, y: 0.6, z: 1.25, rz: Math.PI / 2, seg: 14 }), g);
  return g;
}
