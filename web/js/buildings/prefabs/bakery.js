// Bakery: a whitewashed shop under a terracotta gable, with a big domed bread oven on its right shoulder
// (terracotta clay, an ink-dark mouth, its own chimney puffing smoke), a red-and-cream striped awning over the
// shop window, a gilded ring-loaf sign on a bracket, a bench of golden loaves and a stack of firewood.
// Footprint 5 x 4, the shop front faces +z.
export const meta = { id: 'bakery', footprint: { w: 5, d: 4 }, height: 5.2 };

export function build(api) {
  const R = api.ramps, g = api.group();
  const wall = api.lambert('#efe4d2');

  // plinth
  g.add(api.box({ w: 4.9, h: 0.22, d: 3.8, y: 0.11, ramp: R.LIMESTONE }));

  // the shop: whitewash block, terracotta gable (ridge along x), a chimney on the back slope
  const sx = -0.75, sz = -0.35, sw = 3.2, sd = 2.7, sh = 2.5, top = 0.22 + sh, front = sz + sd / 2;
  g.add(api.box({ w: sw, h: sh, d: sd, x: sx, y: 0.22 + sh / 2, z: sz, mat: wall }));
  g.add(api.gableRoof({ w: sw, d: sd, h: 1.15, overhang: 0.24, x: sx, y: top, z: sz, ramp: R.TERRACOTTA }));
  g.add(api.box({ w: 0.44, h: 1.2, d: 0.44, x: sx - 0.95, y: top + 0.75, z: sz - 0.7, mat: wall }));
  g.add(api.box({ w: 0.58, h: 0.14, d: 0.58, x: sx - 0.95, y: top + 1.38, z: sz - 0.7, ramp: R.TERRACOTTA }));

  // front: arched door, a wide shop window under a striped awning
  g.add(api.inkDoor({ w: 0.85, h: 1.65, x: sx - 0.85, y: 0.22, z: front }));
  g.add(api.inkWindow({ w: 1.2, h: 0.95, x: sx + 0.65, y: 1.35, z: front, frame: R.LIMESTONE }));
  const aw = api.group({ x: sx + 0.65, y: 2.12, z: front + 0.36 });
  for (let i = 0; i < 5; i++) aw.add(api.box({ w: 0.33, h: 0.07, d: 0.8, x: -0.66 + i * 0.33, rx: 0.42, ramp: i % 2 ? R.WHITEWASH : R.REDWALL, speck: 0.08 }));
  g.add(aw);
  // the lit side gets a small window
  g.add(api.inkWindow({ w: 0.5, h: 0.65, x: sx - sw / 2, y: 1.6, z: sz, rot: -Math.PI / 2, shutters: R.SAGE }));

  // sign: a gilded ring loaf hanging from an iron bracket by the door
  g.add(api.box({ w: 0.06, h: 0.06, d: 0.6, x: sx - 1.45, y: 2.25, z: front + 0.3, ramp: R.IRON }));
  g.add(api.torus({ r: 0.2, tube: 0.075, x: sx - 1.45, y: 1.98, z: front + 0.52, flat: false, ramp: R.GOLD, seg: 18 }));

  // the bread oven: a limestone drum with a terracotta dome, ink mouth to the front, chimney pot on top
  const ox = 1.55, oz = 0.0;
  g.add(api.cylinder({ r: 0.98, h: 0.75, x: ox, y: 0.22 + 0.375, z: oz, ramp: R.LIMESTONE, seg: 24 }));
  g.add(api.dome({ r: 1.02, h: 1.15, x: ox, y: 0.97, z: oz, ramp: R.TERRACOTTA, seg: 24 }));
  g.add(api.inkDoor({ w: 0.62, h: 0.62, x: ox, y: 0.78, z: oz + 0.93, frame: R.LIMESTONE }));
  g.add(api.cylinder({ rb: 0.2, rt: 0.16, h: 1.1, x: ox + 0.3, y: 2.2, z: oz - 0.3, ramp: R.TERRACOTTA, seg: 12 }));
  g.add(api.cylinder({ r: 0.22, h: 0.1, x: ox + 0.3, y: 2.78, z: oz - 0.3, ramp: R.TERRACOTTA, lift: -0.1, seg: 12 }));

  // smoke: three soft clay puffs rising from the oven chimney (animated below)
  const smoke = api.group({ x: ox + 0.3, y: 2.85, z: oz - 0.3 }); smoke.name = 'smoke';
  const puff = api.clay('#efe6d6', '#cfc2ae', '#a99a86');
  for (let i = 0; i < 3; i++) { const p = api.sphere({ r: 0.32, y: 0.35 + i * 0.55, x: i * 0.12, mat: puff, seg: 14 }); p.name = 'puff' + i; smoke.add(p); }
  g.add(smoke);

  // a bench of golden loaves by the window, firewood stacked against the oven
  g.add(api.box({ w: 1.25, h: 0.12, d: 0.42, x: sx + 0.65, y: 0.62, z: front + 0.4, ramp: R.WOOD }));
  g.add(api.box({ w: 0.1, h: 0.4, d: 0.36, x: sx + 0.12, y: 0.42, z: front + 0.4, ramp: R.WOOD }));
  g.add(api.box({ w: 0.1, h: 0.4, d: 0.36, x: sx + 1.18, y: 0.42, z: front + 0.4, ramp: R.WOOD }));
  for (let i = 0; i < 3; i++) g.add(api.sphere({ r: 0.2, sx: 1.25, sy: 0.6, x: sx + 0.25 + i * 0.4, y: 0.76, z: front + 0.4, ramp: R.GOLD, seg: 12 }));
  for (let r = 0; r < 3; r++) for (let i = 0; i < 3 - r; i++)
    g.add(api.cylinder({ r: 0.13, h: 0.85, x: ox + 0.72 + i * 0.27 + r * 0.135, y: 0.22 + 0.13 + r * 0.23, z: oz + 0.75, rx: Math.PI / 2, ramp: R.WOOD, lift: 0.1 * ((i + r) % 2), seg: 10 }));

  // keylines: the shop as one box; the oven and the woodpile draw their own
  api.proxy(api.boxGeo({ w: sw, h: sh, d: sd, x: sx, y: 0.22 + sh / 2, z: sz }), g);
  return g;
}

// the oven smokes: each puff rises, swells and shrinks away, in turn
export function animate(obj, t) {
  const smoke = obj.getObjectByName('smoke'); if (!smoke) return;
  for (let i = 0; i < 3; i++) {
    const p = smoke.getObjectByName('puff' + i); if (!p) continue;
    const k = (t * 0.22 + i / 3) % 1;
    p.position.set(0.05 + k * 0.5, 0.15 + k * 1.7, -k * 0.2);
    p.scale.setScalar(Math.max(0.001, Math.sin(k * Math.PI) * (0.7 + k * 0.6)));
  }
}
