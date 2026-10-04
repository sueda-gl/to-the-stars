// Wall tower: the corner tower of the town wall. A square limestone tower with a battered base, rising well
// above two short stubs of crenellated wall that leave it at a right angle (toward -x and -z: the corner), with
// arrow slits, an arched gate door on the town side, a red-wall band under machicolation corbels, a ring of merlons
// and a banner. From above: a square with toothed edges, the two wall stubs making the L. Footprint 7 x 7,
// the outside faces +z and +x.
export const meta = {
  id: 'wall-tower', name: 'Wall tower',
  aliases: ['wall tower', 'wall towers', 'corner tower', 'bastion', 'turret', 'tower of the wall', 'burç', 'burçlar', 'kale kulesi'],
  category: 'building', stage: 'town', footprint: { w: 7, d: 7 }, height: 10.4,
  desc: 'A square crenellated corner tower with two stubs of town wall.'
};

export function build(api) {
  const R = api.ramps, g = api.group();
  const stone = api.lambert('#e3d2b4'), red = api.lambert('#c23a2c', 0.1);
  const TX = 1.6, TZ = 1.6, W = 3.6, H = 7.6;

  // the two wall stubs (to -x and to -z), their parapets and merlons on the outside
  const WH = 4.4, WD = 2.0;
  // the stubs run flush with the tower's outer faces, leaving the inside of the corner free for the gate
  const stubs = [{ x: TX - W / 2 - 1.6, z: TZ + W / 2 - WD / 2, w: 3.4, d: WD, rot: 0 }, { x: TX + W / 2 - WD / 2, z: TZ - W / 2 - 1.6, w: 3.4, d: WD, rot: Math.PI / 2 }];
  stubs.forEach(s => {
    const along = s.rot === 0;
    g.add(api.box({ w: along ? s.w : s.d, h: WH, d: along ? s.d : s.w, x: s.x, y: WH / 2, z: s.z, mat: stone }));
    g.add(api.box({ w: along ? s.w : s.d + 0.5, h: 0.9, d: along ? s.d + 0.5 : s.w, x: s.x, y: 0.45, z: s.z, ramp: R.LIMESTONE, lift: -0.06, speck: 0.3 }));
    for (let i = 0; i < 3; i++) {
      const t = -s.w / 2 + 0.5 + i * (s.w - 1.0) / 2;
      g.add(api.box({ w: along ? 0.66 : 0.42, h: 0.8, d: along ? 0.42 : 0.66, x: along ? s.x + t : s.x + WD / 2 - 0.2, y: WH + 0.4, z: along ? s.z + WD / 2 - 0.2 : s.z + t, ramp: R.LIMESTONE, lift: 0.02 }));
    }
    api.proxy(api.boxGeo({ w: along ? s.w : s.d, h: WH, d: along ? s.d : s.w, x: s.x, y: WH / 2, z: s.z }), g);
  });

  // the tower: battered base, shaft
  g.add(api.box({ w: W + 0.7, h: 1.3, d: W + 0.7, x: TX, y: 0.65, z: TZ, ramp: R.LIMESTONE, lift: -0.06, speck: 0.3 }));
  g.add(api.box({ w: W, h: H, d: W, x: TX, y: H / 2, z: TZ, mat: stone }));
  // the red band and the corbelled parapet that overhangs it
  g.add(api.box({ w: W + 0.06, h: 0.4, d: W + 0.06, x: TX, y: H - 0.2, z: TZ, mat: red }));
  g.add(api.box({ w: W + 0.5, h: 0.5, d: W + 0.5, x: TX, y: H + 0.25, z: TZ, ramp: R.LIMESTONE, lift: 0.03 }));
  // merlons: three per side on the overhanging parapet
  const P = (W + 0.5) / 2 - 0.2;
  for (let side = 0; side < 4; side++) for (let i = 0; i < 3; i++) {
    const t = -P + 0.3 + i * (2 * P - 0.6) / 2, sx = [0, 1, 0, -1][side], sz = [1, 0, -1, 0][side];
    g.add(api.box({ w: sz ? 0.62 : 0.4, h: 0.8, d: sz ? 0.4 : 0.62, x: TX + (sx ? sx * P : t), y: H + 0.9, z: TZ + (sz ? sz * P : t), ramp: R.LIMESTONE, lift: 0.04 }));
  }
  // slits on the two outer faces, an arched door on the town side (-x face, inside the corner)
  [[0, 3.0], [0, 5.4]].forEach(([dx, y]) => {
    g.add(api.inkWindow({ w: 0.18, h: 0.85, x: TX + dx, y, z: TZ + W / 2, frame: false }));
    g.add(api.inkWindow({ w: 0.18, h: 0.85, x: TX + W / 2, y: y + 0.5, z: TZ, rot: Math.PI / 2, frame: false }));
  });
  // the gate: a stone portal block on the town-side (-x) face, inside the corner, the door on its face
  const gz = TZ - 0.8;
  g.add(api.box({ w: 0.55, h: 2.7, d: 1.7, x: TX - W / 2 - 0.27, y: 1.35, z: gz, ramp: R.LIMESTONE, lift: 0.02 }));
  g.add(api.inkDoor({ w: 1.0, h: 2.05, x: TX - W / 2 - 0.55, y: 0, z: gz, rot: -Math.PI / 2, frame: false }));
  // the banner
  g.add(api.flag({ pole: 2.6, w: 1.1, h: 0.62, x: TX - 0.9, y: H + 0.5, z: TZ - 0.9, ramp: R.REDWALL }));

  api.proxy(api.boxGeo({ w: W, h: H, d: W, x: TX, y: H / 2, z: TZ }), g);
  return g;
}
