// Barn: the big farm barn, red-ochre walls with pale limestone quoins on a limestone plinth, a deep
// terracotta roof with its ridge running front to back (barrel-tile rows down each slope, a ridge cap and a
// little louvred vent turret), a tall
// arched ink doorway in a limestone portal on the gable end, a hay-loft door above it under a hoist beam,
// slit vents down the lit side, and an open lean-to shed on the right sheltering hay bales. A stone water
// trough by the door. About 11 x 10.5 m; the gable end and door face +z.
export const meta = {
  id: 'barn', name: 'Barn', category: 'building', stage: 'village',
  aliases: ['barns', 'big barn', 'red barn', 'farm barn', 'hay barn', 'hayloft', 'cowshed', 'cattle shed', 'samanlık', 'çiftlik ahırı'],
  footprint: { w: 11.2, d: 10.5 }, height: 8.5,
  desc: 'a big red-ochre barn with a deep terracotta roof, an arched door in a limestone portal, a hay loft and a lean-to shed'
};

const HAY = ['#6e4d16', '#9a6f22', '#c39436', '#d9ac48', '#e6be5c'];
const WATER = ['#173f56', '#1f5670', '#2a6f86', '#33809a', '#3d8ea6'];

export function build(api) {
  const R = api.ramps, g = api.group();
  const wall = api.lambert('#a24a32', 0.12), lime = api.lambert('#e6d6b8');   // red-ochre, a step deeper than the roof
  const W = 7.6, D = 8.8, H = 3.8, rise = 2.8, ov = 0.45, ox = -1.35;   // main block, shifted left to leave room for the shed
  const top = 0.4 + H, half = W / 2, a = Math.atan2(rise, half), Ls = Math.hypot(half, rise) + ov, t = 0.24;

  // plinth and walls
  g.add(api.box({ w: W + 0.5, h: 0.4, d: D + 0.5, x: ox, y: 0.2, ramp: R.LIMESTONE }));
  g.add(api.box({ w: W, h: H, d: D, x: ox, y: 0.4 + H / 2, mat: wall }));
  // limestone quoins at the four corners
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => g.add(api.box({ w: 0.5, h: H, d: 0.5, x: ox + sx * (half - 0.22), y: 0.4 + H / 2, z: sz * (D / 2 - 0.22), mat: lime })));
  // the gable triangles (wall colour), flush with the end walls
  [-1, 1].forEach(s => g.add(api.extrude({ shape: [[-half, 0], [half, 0], [0, rise]], depth: 0.4, x: ox, y: top, z: s * (D / 2 - 0.2), mat: wall })));
  // the roof: two thick slabs meeting at the ridge, rows of barrel tiles running down them, a ridge cap
  [-1, 1].forEach(s => {
    const cx = Math.cos(a), sn = Math.sin(a);
    const mx = ox + s * (cx * Ls / 2 + sn * t / 2), my = top + rise - sn * Ls / 2 + cx * t / 2;
    g.add(api.box({ w: Ls, h: t, d: D + 0.7, x: mx, y: my, rz: -s * a, ramp: R.TERRACOTTA, lift: -0.04 }));
    for (let k = 0; k < 12; k++) {
      const z = -D / 2 - 0.2 + (k + 0.5) * (D + 0.4) / 12;
      g.add(api.cylinder({ r: 0.13, h: Ls - 0.05, seg: 8, x: mx + s * sn * (t / 2), y: my + cx * (t / 2), z, rz: Math.PI / 2 - s * a, ramp: R.TERRACOTTA, lift: 0.08, speck: 0.1 }));
    }
  });
  g.add(api.cylinder({ r: 0.2, h: D + 0.8, x: ox, y: top + rise + 0.16, rx: Math.PI / 2, ramp: R.TERRACOTTA, lift: -0.1, seg: 10 }));
  // a little louvred vent turret astride the ridge
  const vt = top + rise;
  g.add(api.box({ w: 1.4, h: 1.3, d: 1.4, x: ox, y: vt + 0.35, mat: lime }));
  [[0, 0.71, 0], [0, -0.71, Math.PI], [-0.71, 0, -Math.PI / 2], [0.71, 0, Math.PI / 2]].forEach(([dx, dz, r]) =>
    g.add(api.inkWindow({ w: 0.6, h: 0.5, x: ox + dx, y: vt + 0.62, z: dz, rot: r, frame: false })));
  g.add(api.hipRoof({ w: 1.4, d: 1.4, h: 0.85, overhang: 0.22, x: ox, y: vt + 1.0, ramp: R.TERRACOTTA }));
  api.proxy(api.boxGeo({ w: 1.4, h: 1.3, d: 1.4, x: ox, y: vt + 0.35 }), g);

  // front (+z) gable end: limestone portal with a tall arched ink door, the loft door and hoist beam above
  const fz = D / 2;
  g.add(api.archWall({ w: 3.3, h: 3.55, d: 0.14, arches: 1, archW: 2.5, archH: 3.2, x: ox, y: 0.4, z: fz + 0.07, mat: lime }));
  g.add(api.inkDoor({ w: 2.5, h: 3.2, x: ox, y: 0.4, z: fz + 0.02, frame: false }));
  g.add(api.inkWindow({ w: 1.05, h: 1.15, x: ox, y: top + 0.85, z: fz + 0.02, frame: R.WOOD }));
  g.add(api.box({ w: 0.2, h: 0.2, d: 1.5, x: ox, y: top + 1.85, z: fz + 0.55, ramp: R.WOOD }));
  // slit vents down the lit (left) side
  [-2.6, 0, 2.6].forEach(z => g.add(api.inkWindow({ w: 0.24, h: 0.95, x: ox - half - 0.01, y: 0.4 + H * 0.66, z, rot: -Math.PI / 2, frame: false })));

  // the open lean-to shed on the right: posts, a mono-pitch roof, hay bales and a cart wheel under it
  const sx0 = ox + half, sw = 2.7, sd = 6.2, sz = -0.6, sh = 2.9;
  g.add(api.box({ w: sw, h: 0.18, d: sd, x: sx0 + sw / 2, y: 0.09, z: sz, ramp: R.LIMESTONE, lift: -0.06 }));
  [-1, 0, 1].forEach(k => g.add(api.box({ w: 0.18, h: sh - 0.2, d: 0.18, x: sx0 + sw - 0.2, y: 0.18 + (sh - 0.2) / 2, z: sz + k * (sd / 2 - 0.2), ramp: R.WOOD })));
  const sa = Math.atan2(0.75, sw), sl = Math.hypot(sw, 0.75) + 0.35;
  g.add(api.box({ w: sl, h: 0.18, d: sd + 0.4, x: sx0 + sw / 2 + 0.15, y: 0.18 + sh - 0.75 / 2 + 0.05, z: sz, rz: -sa, ramp: R.TERRACOTTA }));
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2 - i; j++)
    g.add(api.box({ w: 1.0, h: 0.5, d: 0.6, x: sx0 + 1.2, y: 0.18 + 0.25 + i * 0.5, z: sz - 1.9 + j * 0.65 + i * 0.32, ramp: HAY, speck: 0.1, lift: (i + j) % 2 ? 0.05 : -0.03 }));
  g.add(api.wheel({ r: 0.62, w: 0.1, spokes: 8, x: sx0 + 0.25, y: 0.8, z: sz + 1.6, rot: Math.PI / 2, rz: 0.12 }));

  // a stone water trough by the door
  g.add(api.box({ w: 1.7, h: 0.55, d: 0.6, x: ox - 2.4, y: 0.275, z: fz + 1.0, ramp: R.LIMESTONE }));
  g.add(api.box({ w: 1.5, h: 0.04, d: 0.42, x: ox - 2.4, y: 0.52, z: fz + 1.0, ramp: WATER, speck: 0.1 }));

  // keylines: the main block with its gable, and the roof as two smooth slabs (not every tile course)
  api.proxy(api.boxGeo({ w: W, h: H, d: D, x: ox, y: 0.4 + H / 2 }), g);
  [-1, 1].forEach(s => {
    const mx = ox + s * (Ls / 2) * Math.cos(a), my = top + rise - (Ls / 2) * Math.sin(a) + Math.cos(a) * 0.2;
    api.proxy(api.boxGeo({ w: Ls, h: 0.36, d: D + 0.7, x: mx, y: my, rz: -s * a }), g);
  });
  return g;
}
