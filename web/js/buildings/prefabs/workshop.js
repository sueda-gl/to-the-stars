// Workshop: the Red arch's own grammar on a working building. A red-walled atelier, its gable end to the
// front, pierced by one big round-headed ink-dark arch and a round oculus, under a terracotta roof with a
// limestone forge chimney; on the shady side a canvas awning over a workbench and a grindstone that turns,
// planks leaning on the lit wall, a cart wheel and a barrel. Footprint 5 x 5, the arch faces +z.
export const meta = { id: 'workshop', footprint: { w: 5, d: 5 }, height: 5.6 };

export function build(api) {
  const R = api.ramps, g = api.group();
  const red = api.lambert('#c23a2c', 0.12);

  // plinth, then the red block (gable end to the front)
  g.add(api.box({ w: 4.9, h: 0.22, d: 4.6, x: 0.1, y: 0.11, ramp: R.LIMESTONE }));
  const mx = -0.55, mz = -0.45, W = 3.4, D = 3.3, H = 2.9, top = 0.22 + H, front = mz + D / 2;
  g.add(api.box({ w: W, h: H, d: D, x: mx, y: 0.22 + H / 2, z: mz, mat: red }));

  // the roof: two terracotta slabs meeting at a ridge along z, leaving the red gable triangle open to the front
  const hr = 1.35, over = 0.28, half = W / 2 + over, k = hr / (W / 2), len = half * Math.hypot(1, k) + 0.08, tilt = Math.atan(k);
  for (let s = -1; s <= 1; s += 2)
    g.add(api.box({ w: len, h: 0.16, d: D + over * 2, x: mx + s * half / 2, y: top + hr - k * half / 2 + 0.06, z: mz, rz: -s * tilt, ramp: R.TERRACOTTA }));
  for (let s = -1; s <= 1; s += 2)   // the gable triangles, front and back
    g.add(api.extrude({ shape: [[-W / 2, 0], [W / 2, 0], [0, hr]], depth: 0.2, x: mx, y: top, z: mz + s * (D / 2 - 0.1), mat: red }));
  // a limestone band at the eaves line across the front, like the reference wall's coping
  g.add(api.box({ w: W + 0.12, h: 0.16, d: 0.14, x: mx, y: top - 0.02, z: front + 0.02, ramp: R.LIMESTONE }));

  // the big arch and the oculus
  g.add(api.inkDoor({ w: 1.75, h: 2.35, x: mx, y: 0.22, z: front, frame: R.LIMESTONE }));
  g.add(api.cylinder({ r: 0.27, h: 0.1, x: mx, y: top + 0.52, z: front + 0.02, rx: Math.PI / 2, ramp: R.INK, lift: 0.1, seg: 20 }));
  g.add(api.torus({ r: 0.31, tube: 0.06, x: mx, y: top + 0.52, z: front + 0.05, flat: false, ramp: R.LIMESTONE, seg: 22 }));
  // a window on the lit (left) side
  g.add(api.inkWindow({ w: 0.6, h: 0.85, x: mx - W / 2, y: 1.7, z: mz + 0.4, rot: -Math.PI / 2, arched: true }));

  // forge chimney through the back-left of the roof
  g.add(api.box({ w: 0.55, h: 2.6, d: 0.55, x: mx - 0.95, y: top + 0.4, z: mz - 1.0, ramp: R.LIMESTONE }));
  g.add(api.box({ w: 0.7, h: 0.14, d: 0.7, x: mx - 0.95, y: top + 1.75, z: mz - 1.0, ramp: R.LIMESTONE, lift: 0.08 }));

  // the shady (right) side: a canvas awning on two posts over a workbench
  const ex = mx + W / 2;
  for (let i = -1; i <= 1; i += 2) g.add(api.box({ w: 0.12, h: 2.0, d: 0.12, x: ex + 1.25, y: 0.22 + 1.0, z: mz + i * 1.15, ramp: R.WOOD }));
  g.add(api.box({ w: 1.55, h: 0.08, d: 2.75, x: ex + 0.7, y: 2.45, z: mz, rz: -0.32, ramp: R.WHITEWASH, lift: 0.05 }));
  g.add(api.box({ w: 0.75, h: 0.12, d: 2.0, x: ex + 0.55, y: 1.05, z: mz - 0.1, ramp: R.WOOD, lift: 0.1 }));
  g.add(api.box({ w: 0.6, h: 0.82, d: 0.1, x: ex + 0.55, y: 0.63, z: mz - 0.95, ramp: R.WOOD, lift: -0.1 }));
  g.add(api.box({ w: 0.6, h: 0.82, d: 0.1, x: ex + 0.55, y: 0.63, z: mz + 0.75, ramp: R.WOOD, lift: -0.1 }));
  g.add(api.box({ w: 0.3, h: 0.25, d: 0.45, x: ex + 0.5, y: 1.23, z: mz + 0.4, ramp: R.IRON }));   // anvil block

  // the grindstone in front of the bench (its wheel turns; see animate)
  const gx = ex + 0.85, gz = front + 0.55;
  g.add(api.box({ w: 0.1, h: 0.75, d: 0.1, x: gx - 0.15, y: 0.22 + 0.375, z: gz, ramp: R.WOOD }));
  g.add(api.box({ w: 0.1, h: 0.75, d: 0.1, x: gx + 0.15, y: 0.22 + 0.375, z: gz, ramp: R.WOOD }));
  const grind = api.group({ x: gx, y: 0.92, z: gz }); grind.name = 'grind';
  grind.add(api.cylinder({ r: 0.42, h: 0.16, rz: Math.PI / 2, ramp: R.SLATE, lift: 0.1, seg: 22 }));
  grind.add(api.cylinder({ r: 0.05, h: 0.5, rz: Math.PI / 2, ramp: R.IRON, seg: 8 }));
  g.add(grind);

  // planks leaning on the lit wall, a cart wheel against the front, a barrel
  for (let i = 0; i < 3; i++) g.add(api.box({ w: 0.08, h: 2.2, d: 0.3, x: mx - W / 2 - 0.3 + i * 0.05, y: 0.22 + 1.05, z: mz - 0.9 + i * 0.34, rz: -0.18, ramp: R.WOOD, lift: 0.12 * (i % 2) }));
  g.add(api.wheel({ r: 0.55, w: 0.1, spokes: 6, x: mx + 1.25, y: 0.22 + 0.55, z: front + 0.12, rot: Math.PI / 2 }));
  g.add(api.barrel({ r: 0.3, h: 0.78, x: mx - 1.35, y: 0.22, z: front + 0.55 }));

  // keylines: the block as one box (the arch and oculus still sit on it as colour), the planks draw their own
  api.proxy(api.boxGeo({ w: W, h: H, d: D, x: mx, y: 0.22 + H / 2, z: mz }), g);
  return g;
}

// the grindstone turns slowly
export function animate(obj, t) {
  const grind = obj.getObjectByName('grind');
  if (grind) grind.rotation.x = -0.9 * t;
}
