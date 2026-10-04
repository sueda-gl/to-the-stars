// House: a Mediterranean cottage on a limestone plinth: a washed block under a terracotta roof, an arched ink door
// under a porch lintel, shuttered windows on every face (it reads from any side of a street), a lower wing, a
// planted pot, and a bougainvillea mound at the wing's corner. Footprint 4 x 4, front faces +z.
// Three deliberate variants (api.variant()), so a street of houses doesn't repeat:
//   0  whitewash, gable roof, sage shutters, flat-roofed wing on the right
//   1  ochre wash, hip roof, ink-blue shutters, the wing on the left under its own lean-to roof
//   2  rose wash, gable turned to face the street (ridge front to back), red shutters, a walled terrace on the right
export const meta = { id: 'house', footprint: { w: 4, d: 4 }, height: 4.4 };

const STYLES = [
  { wall: '#efe4d2', roof: 'gable', shutter: '#6f8f5a', wing: 1, wingRoof: 'flat' },
  { wall: '#e8cf9c', roof: 'hip', shutter: '#3d5588', wing: -1, wingRoof: 'lean' },
  { wall: '#ecd2c2', roof: 'turned', shutter: '#b3362a', wing: 1, wingRoof: 'terrace' }
];

export function build(api) {
  const R = api.ramps, g = api.group();
  const S = STYLES[api.variant() % STYLES.length];
  const wall = api.lambert(S.wall), sh = S.shutter;
  const side = S.wing;   // +1: the wing stands on the right (+x), -1: on the left

  // plinth: one low limestone slab the whole thing stands on
  g.add(api.box({ w: 3.9, h: 0.24, d: 3.5, y: 0.12, z: 0.05, ramp: R.LIMESTONE }));
  // the main block (Lambert, so the roof throws its shadow on it)
  const bx = -0.35 * side, bw = 2.9, bd = 2.5, bz = -0.25, H = 2.3;
  g.add(api.box({ w: bw, h: H, d: bd, x: bx, y: 0.24 + H / 2, z: bz, mat: wall }));
  const eaves = 0.24 + H;
  if (S.roof === 'hip') g.add(api.hipRoof({ w: bw, d: bd, h: 1.1, overhang: 0.24, x: bx, y: eaves, z: bz, ramp: R.TERRACOTTA }));
  else if (S.roof === 'turned') g.add(api.gableRoof({ w: bd, d: bw, h: 1.15, overhang: 0.22, x: bx, y: eaves, z: bz, rot: Math.PI / 2, ramp: R.TERRACOTTA }));
  else g.add(api.gableRoof({ w: bw, d: bd, h: 1.05, overhang: 0.22, x: bx, y: eaves, z: bz, ramp: R.TERRACOTTA }));
  // chimney through the back of the roof, on the side away from the wing
  const cx = bx - side * 0.8;
  g.add(api.box({ w: 0.42, h: 1.15, d: 0.42, x: cx, y: 3.35, z: -0.85, mat: wall }));
  g.add(api.box({ w: 0.56, h: 0.14, d: 0.56, x: cx, y: 3.98, z: -0.85, ramp: R.TERRACOTTA }));

  // the wing: lower, beside the block
  const wx = side * 1.7, ww = 1.2, wd = 2.0, wz = -0.5, wh = 1.7;
  g.add(api.box({ w: ww, h: wh, d: wd, x: wx, y: 0.24 + wh / 2, z: wz, mat: wall }));
  if (S.wingRoof === 'lean') {   // a lean-to falling away from the main block
    g.add(api.box({ w: ww + 0.4, h: 0.12, d: wd + 0.36, x: wx + side * 0.05, y: 0.24 + wh + 0.22, z: wz, rz: side * -0.32, ramp: R.TERRACOTTA }));
  } else {
    g.add(api.box({ w: ww + 0.16, h: 0.16, d: wd + 0.16, x: wx, y: 0.24 + wh + 0.08, z: wz, ramp: R.LIMESTONE }));
  }
  if (S.wingRoof === 'terrace') {   // a pot on the roof terrace
    g.add(api.pot({ r: 0.2, x: wx, y: 0.24 + wh + 0.16, z: wz - 0.4, flowers: R.PINK }));
  }

  // front (+z) face of the main block at z = 1.0: door, porch lintel, one window; the wing's front at z = 0.5
  const fz = bz + bd / 2, dx = bx - side * 0.4;
  g.add(api.inkDoor({ w: 0.8, h: 1.5, x: dx, y: 0.24, z: fz }));
  g.add(api.box({ w: 1.2, h: 0.12, d: 0.4, x: dx, y: 1.95, z: fz + 0.15, ramp: R.LIMESTONE }));   // porch lintel
  g.add(api.inkWindow({ w: 0.6, h: 0.75, x: bx + side * 0.8, y: 1.45, z: fz, shutters: sh }));
  g.add(api.inkWindow({ w: 0.45, h: 0.6, x: wx - side * 0.2, y: 1.25, z: wz + wd / 2, shutters: sh }));
  // the back (-z) face: two windows, so a house turned away from the camera still has a face
  g.add(api.inkWindow({ w: 0.55, h: 0.7, x: bx - 0.7, y: 1.5, z: bz - bd / 2, rot: Math.PI, shutters: sh }));
  g.add(api.inkWindow({ w: 0.55, h: 0.7, x: bx + 0.7, y: 1.5, z: bz - bd / 2, rot: Math.PI }));
  // the outer side of the block (away from the wing) and the wing's outer side
  g.add(api.inkWindow({ w: 0.5, h: 0.6, x: bx - side * bw / 2, y: 1.55, z: bz, rot: -side * Math.PI / 2 }));
  g.add(api.inkWindow({ w: 0.45, h: 0.55, x: wx + side * ww / 2, y: 1.2, z: wz - 0.2, rot: side * Math.PI / 2 }));

  // a step and a planted pot by the door; a bougainvillea mound at the wing's front corner (inside the footprint)
  g.add(api.box({ w: 1.0, h: 0.12, d: 0.36, x: dx, y: 0.06, z: fz + 0.95, ramp: R.LIMESTONE }));
  g.add(api.pot({ r: 0.24, x: dx + side * 0.75, y: 0.24, z: fz + 0.45, flowers: R.RED }));
  g.add(api.shrub({ r: 0.45, h: 1.4, x: wx + side * 0.3, y: 0.2, z: wz + wd / 2 + 0.45, ramp: R.PINK, speck: 0.32 }));

  // keylines: one smooth proxy per big mass, so the shutters and sills don't scribble
  api.proxy(api.boxGeo({ w: bw, h: H, d: bd, x: bx, y: 0.24 + H / 2, z: bz }), g);
  api.proxy(api.boxGeo({ w: ww, h: wh + 0.16, d: wd, x: wx, y: 0.24 + (wh + 0.16) / 2, z: wz }), g);
  return g;
}
