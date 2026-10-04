// Pig sty: a low dry-stone sty with a terracotta lean-to roof and an arched ink doorway, a walled yard of
// trodden earth in front with a dark wet mud wallow, a stone trough and a wooden gate. Three pink pigs: two
// root about with their snouts (animate) and one lies on its side in the mud, breathing. From above: a red
// roof slab, a stone-walled square, a dark wallow and three rosy shapes. Footprint 7 x 6, the gate faces +z.
export const meta = {
  id: 'pig-sty', name: 'Pig sty',
  aliases: ['pigs', 'pig', 'pigsty', 'sty', 'pig pen', 'piggery', 'hogs', 'swine', 'domuz ahırı', 'domuz', 'domuzlar'],
  category: 'animal', stage: 'hamlet', footprint: { w: 7, d: 6 }, height: 2.6,
  desc: 'A low stone sty with a walled mud yard, a wallow and three pink pigs.'
};

const PIG = ['#7a3f37', '#a85d52', '#cf8574', '#e3a08e', '#efb6a2'];
const SNOUT = ['#6a3530', '#8f4c45', '#b46a5f', '#c98073', '#d69384'];
const EARTH = ['#7d6a52', '#9c876a', '#b8a283', '#cbb595', '#d8c3a2'];   // pale trodden earth so the pink pigs and the dark wallow read
const MUD = ['#2b2017', '#3a2c1f', '#4a3828', '#5a4532', '#6b543e'];
const DRYSTONE = ['#5f5950', '#81796d', '#a29988', '#bdb4a0', '#d2cab6'];

// a pig facing +z: a round barrel on short legs, a named head pivot (rooting), floppy ears, a curly tail
function pig(api, o) {
  const s = o.s || 1, g = api.group({ x: o.x, y: o.y || 0, z: o.z, rot: o.rot || 0 });
  if (o.lying) { g.rotation.z = 1.4; g.name = 'breathe'; g.userData.ph = api.range(0, 6.28); }
  [[-0.15, 0.3], [0.15, 0.3], [-0.15, -0.3], [0.15, -0.3]].forEach(([x, z]) => g.add(api.colourOnly(api.cylinder({ rt: 0.07 * s, rb: 0.055 * s, h: 0.24 * s, x: x * s, y: 0.12 * s, z: z * s, ramp: PIG, seg: 6, lift: -0.06 }))));
  g.add(api.sphere({ r: 0.36 * s, sx: 0.88, sy: 0.82, sz: 1.42, y: 0.46 * s, ramp: PIG, speck: 0.16, seg: 18 }));
  api.proxy(api.sphereGeo({ r: 0.38 * s, sx: 0.9, sy: 0.85, sz: 1.42, y: 0.46 * s, seg: 16 }), g);
  g.add(api.tube({ points: [[0, 0.55 * s, -0.5 * s], [0.04 * s, 0.62 * s, -0.56 * s], [-0.03 * s, 0.66 * s, -0.53 * s], [0.0, 0.62 * s, -0.5 * s]], r: 0.022 * s, seg: 10, ramp: PIG }));
  const head = api.group({ y: 0.5 * s, z: 0.42 * s }); head.name = 'root';
  head.userData.ph = api.range(0, 6.28); head.userData.sp = api.range(0.5, 0.8);
  head.add(api.sphere({ r: 0.22 * s, sx: 0.95, sy: 0.88, sz: 1.05, y: -0.02 * s, z: 0.1 * s, ramp: PIG, seg: 14 }));
  head.add(api.cylinder({ rt: 0.085 * s, rb: 0.1 * s, h: 0.14 * s, y: -0.07 * s, z: 0.32 * s, rx: Math.PI / 2, ramp: SNOUT, seg: 12 }));
  [-1, 1].forEach(sd => head.add(api.cone({ r: 0.09 * s, h: 0.16 * s, sz: 0.4, x: sd * 0.12 * s, y: 0.15 * s, z: 0.18 * s, rx: 0.9, rz: -sd * 0.35, ramp: PIG, seg: 6, lift: -0.04 })));
  head.rotation.x = o.lying ? 0.1 : 0.35;
  g.add(head);
  return g;
}

export function build(api) {
  const R = api.ramps, g = api.group();
  const x0 = -3.2, x1 = 3.2, z0 = -2.6, z1 = 2.7, t = 0.4, wh = 0.62;   // the walled yard and its low wall

  // trodden earth over the whole yard and a dark wet wallow on the sunny side
  g.add(api.box({ w: x1 - x0 - 0.3, h: 0.05, d: z1 - z0 - 0.3, y: 0.025, z: (z0 + z1) / 2, ramp: EARTH, speck: 0.32 }));
  const mud = [];
  for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2, r = 1.0 + 0.16 * Math.sin(a * 3 + 0.6) + 0.08 * Math.sin(a * 5); mud.push([Math.cos(a) * r * 1.25, -Math.sin(a) * r * 0.95]); }
  g.add(api.extrude({ shape: mud, depth: 0.03, rx: -Math.PI / 2, x: 1.55, y: 0.06, z: 0.0, ramp: MUD, speck: 0.22, lift: 0.04 }));

  // the low dry-stone wall: both sides, the back beside the sty, the front with a wooden gate
  const wall = (w, d, x, z) => g.add(api.box({ w, h: wh, d, x, y: wh / 2, z, ramp: DRYSTONE, speck: 0.4 }));
  wall(t, z1 - z0, x0 + t / 2, (z0 + z1) / 2);
  wall(t, z1 - z0, x1 - t / 2, (z0 + z1) / 2);
  wall(x1 - 0.4, t, (0.4 + x1) / 2, z0 + t / 2);
  wall(2.6, t, x0 + 1.3, z1 - t / 2);
  wall(2.5, t, x1 - 1.25, z1 - t / 2);
  g.add(api.fence({ points: [[x0 + 2.65, z1 - t / 2], [x1 - 2.55, z1 - t / 2]], h: 0.75, gap: 0.5 }));

  // the sty in the back left: a low stone house, a terracotta lean-to roof falling to the front, two arched doors
  const sx = -1.4, sz = -1.55, sw = 3.6, sd = 2.0, sh = 1.4;
  g.add(api.box({ w: sw, h: sh, d: sd, x: sx, y: sh / 2, z: sz, mat: api.lambert('#e3d2b4') }));
  g.add(api.box({ w: sw + 0.35, h: 0.13, d: sd + 0.6, x: sx, y: sh + 0.2, z: sz + 0.12, rx: 0.2, ramp: R.TERRACOTTA }));
  g.add(api.inkDoor({ w: 0.7, h: 0.95, x: sx - 0.85, y: 0, z: sz + sd / 2 }));
  g.add(api.inkDoor({ w: 0.7, h: 0.95, x: sx + 0.85, y: 0, z: sz + sd / 2 }));
  g.add(api.inkWindow({ w: 0.4, h: 0.4, x: sx - sw / 2, y: 0.85, z: sz, rot: -Math.PI / 2, frame: R.LIMESTONE }));

  // a stone trough along the left wall with swill in it
  g.add(api.box({ w: 0.5, h: 0.32, d: 1.4, x: x0 + 0.7, y: 0.16, z: 1.35, ramp: R.LIMESTONE }));
  g.add(api.box({ w: 0.32, h: 0.03, d: 1.2, x: x0 + 0.7, y: 0.32, z: 1.35, ramp: ['#5e4a2a', '#7d6436', '#9c7f45', '#b39456', '#c3a564'], speck: 0.4 }));

  // a shade tree outside the back right corner, random kind
  const kind = api.pick(['olive', 'oak', 'lemon']);
  g.add(api.tree({ kind, h: kind === 'oak' ? 3.6 : 2.9, x: 2.4, z: z0 - 0.75, lean: 0.35, leanTo: [0.4, -1], rot: api.range(0, 6.28) }));

  // three pigs: one at the trough, one rooting by the gate, one lying in the wallow
  g.add(pig(api, { x: x0 + 1.6, z: 1.3 + api.range(-0.2, 0.2), rot: -1.5 + api.range(-0.2, 0.2) }));
  g.add(pig(api, { x: -0.3 + api.range(-0.2, 0.2), z: 1.2, rot: 2.5 + api.range(-0.3, 0.3), s: 0.9 }));
  g.add(pig(api, { x: 1.7, y: 0.24, z: 0.05, rot: 0.3, lying: true }));

  api.proxy(api.boxGeo({ w: sw, h: sh, d: sd, x: sx, y: sh / 2, z: sz }), g);
  return g;
}

const parts = new WeakMap();
export function animate(obj, t) {
  let p = parts.get(obj);
  if (!p) { p = { heads: [], lying: [] }; obj.traverse(o => { if (o.name === 'root') p.heads.push(o); else if (o.name === 'breathe') p.lying.push(o); }); parts.set(obj, p); }
  for (const o of p.heads) {
    const u = o.userData;
    o.rotation.x = 0.35 + 0.22 * Math.max(0, Math.sin(t * u.sp * 3 + u.ph)) * (Math.sin(t * u.sp + u.ph) > -0.3 ? 1 : 0);
    o.rotation.y = 0.18 * Math.sin(t * u.sp * 1.3 + u.ph);
  }
  for (const o of p.lying) { const s = 1 + 0.025 * Math.sin(t * 1.4 + o.userData.ph); o.scale.set(s, s, 1); }
}
