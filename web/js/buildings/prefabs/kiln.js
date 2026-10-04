// Pottery kiln: a brick bottle kiln, its belly hooped with iron and its neck smoking, an arched ink firing door
// and three little fire-mouths glowing at its foot; round it the potter's yard: a shelf of pots drying in the sun,
// a row of finished jars (one glazed blue), a stack of saggars, a firewood pile and one tree. From above: a fat
// ring with a dark mouth and a long bottle shadow. Footprint 5 x 4.9, the firing door faces +z.
export const meta = {
  id: 'kiln', name: 'Pottery kiln',
  aliases: ['kiln', 'kilns', 'pottery kiln', 'bottle kiln', 'pottery', 'potteries', 'pottery works', 'brick kiln', 'çömlek fırını', 'fırın', 'çömlekçi'],
  category: 'building', stage: 'village', footprint: { w: 5, d: 4.9 }, height: 8.8,
  desc: 'A brick bottle kiln with glowing fire-mouths and a smoking neck, in a yard of drying pots.'
};

const GLOW = ['#6e1a0c', '#b0301a', '#e0501f', '#f47a2a', '#ffa847'];

export function build(api) {
  const R = api.ramps, g = api.group();
  const P = 0.16;
  // the yard: a beaten-earth slab
  g.add(api.box({ w: 4.8, h: P, d: 4.4, y: P / 2, ramp: R.SAND, speck: 0.26 }));

  // the bottle: a low stone foot, a fat brick belly drawing in to a chimney neck with a flared lip
  const kx = -0.45, kz = -0.4;
  g.add(api.cylinder({ rb: 2.0, rt: 1.95, h: 0.45, x: kx, y: P + 0.225, z: kz, ramp: R.LIMESTONE, seg: 32 }));
  const prof = [[1.82, 0], [1.9, 0.9], [1.88, 1.8], [1.72, 2.7], [1.38, 3.6], [0.98, 4.45], [0.7, 5.2], [0.6, 5.9], [0.6, 6.45], [0.74, 6.6], [0.74, 6.78], [0.5, 6.78]];
  g.add(api.lathe({ points: prof, seg: 32, x: kx, y: P + 0.45, z: kz, mat: api.lambert('#9c5a43', 0.06) }));
  g.add(api.cylinder({ r: 0.52, h: 0.06, x: kx, y: P + 0.45 + 6.72, z: kz, ramp: R.INK, seg: 20 }));   // the dark mouth
  // iron hoops round the belly (colour only: the bottle draws the line)
  [[1.2, 1.91], [2.35, 1.79], [3.4, 1.47]].forEach(([y, r]) => g.add(api.colourOnly(api.torus({ r, tube: 0.05, x: kx, y: P + 0.45 + y, z: kz, ramp: R.IRON, seg: 36 }))));
  // the firing door (front) with a limestone surround, and three glowing fire-mouths round the foot
  const fr = 1.88;
  g.add(api.inkDoor({ w: 0.95, h: 1.55, x: kx, y: P + 0.45, z: kz + fr + 0.02, frame: R.LIMESTONE }));
  [-1.0, 1.0, 2.2].forEach((a, i) => {
    const x = kx + Math.sin(a) * (fr + 0.02), z = kz + Math.cos(a) * (fr + 0.02);
    g.add(api.inkWindow({ w: 0.42, h: 0.4, x, y: P + 0.7, z, rot: a, arched: true, frame: false }));
    const e = api.sphere({ r: 0.17, sy: 0.6, x: x + Math.sin(a) * 0.04, y: P + 0.6, z: z + Math.cos(a) * 0.04, ramp: GLOW, lift: 0.15, seg: 10 });
    e.name = 'fire' + i; e.castShadow = false; api.colourOnly(e); g.add(e);
  });

  // a drying shelf on the right: two planks on posts, pots on both
  const shx = 1.75, shz = 0.1;
  [[-0.95, -0.2], [0.95, -0.2], [-0.95, 0.2], [0.95, 0.2]].forEach(([dx, dz]) => g.add(api.colourOnly(api.box({ w: 0.08, h: 1.15, d: 0.08, x: shx + dz, y: P + 0.575, z: shz + dx, ramp: R.WOOD }))));
  [0.45, 1.1].forEach(y => g.add(api.box({ w: 0.55, h: 0.07, d: 2.1, x: shx, y: P + y, z: shz, ramp: R.WOOD })));
  for (let k = 0; k < 2; k++) for (let i = 0; i < 4; i++) {
    const r = api.range(0.13, 0.18);
    g.add(api.pot({ r, h: r * api.range(1.3, 1.9), plant: false, x: shx, y: P + (k ? 1.135 : 0.485), z: shz - 0.75 + i * 0.5, ramp: k ? R.SAND : R.TERRACOTTA }));
  }
  // a row of finished jars in front (one glazed blue: the accent)
  const jars = [R.TERRACOTTA, R.TERRACOTTA, R.BLUE, R.TERRACOTTA];
  for (let i = 0; i < 4; i++) g.add(api.pot({ r: 0.25 - (i % 2) * 0.05, h: 0.5 - (i % 2) * 0.1, plant: false, x: 0.75 + i * 0.5, y: P, z: 1.75, ramp: jars[i] }));
  // saggars stacked on the left, the firewood pile at the back left
  for (let s = 0; s < 2; s++) for (let i = 0; i < 3; i++)
    g.add(api.cylinder({ r: 0.26, h: 0.22, x: -2.05 + s * 0.6, y: P + 0.11 + i * 0.23, z: 1.55, ramp: R.LIMESTONE, lift: -0.04 * i, seg: 14 }));
  for (let i = 0; i < 3; i++) g.add(api.cylinder({ r: 0.14, h: 1.5, x: -2.15 + (i === 2 ? 0.14 : i * 0.28), y: P + 0.14 + (i === 2 ? 0.24 : 0), z: -2.0, rx: Math.PI / 2, ramp: R.WOOD, lift: 0.05 * i, seg: 10 }));
  const kind = api.pick(['olive', 'cypress', 'pine', 'lemon', 'oak']);
  g.add(api.tree({ kind, h: kind === 'cypress' ? 4.6 : kind === 'pine' ? 4.8 : 3.3, x: 1.9, z: -1.85 }));

  // smoke from the neck
  const smoke = api.group({ x: kx, y: P + 7.3, z: kz }); smoke.name = 'smoke';
  const puff = api.clay('#e8e1d6', '#c3baad', '#968c7f');
  for (let i = 0; i < 3; i++) { const p = api.sphere({ r: 0.42, y: 0.3 + i * 0.6, mat: puff, seg: 14 }); p.name = 'puff' + i; p.castShadow = false; api.colourOnly(p); smoke.add(p); }
  g.add(smoke);

  api.proxy(api.latheGeo({ points: prof, seg: 32, x: kx, y: P + 0.45, z: kz }), g);
  api.proxy(api.boxGeo({ w: 0.6, h: 1.25, d: 2.15, x: shx, y: P + 0.62, z: shz }), g);
  return g;
}

export function animate(obj, t) {
  for (let i = 0; i < 3; i++) { const e = obj.getObjectByName('fire' + i); if (e) e.scale.setScalar(0.9 + 0.15 * Math.sin(t * 3.3 + i * 2.1)); }
  const smoke = obj.getObjectByName('smoke'); if (!smoke) return;
  for (let i = 0; i < 3; i++) {
    const p = smoke.getObjectByName('puff' + i); if (!p) continue;
    const k = (t * 0.16 + i / 3) % 1;
    p.position.set(k * 0.8, k * 2.2, -k * 0.3);
    p.scale.setScalar(Math.max(0.001, Math.sin(k * Math.PI) * (0.7 + k * 0.8)));
  }
}
