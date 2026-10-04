// Campanile: a tall square bell tower. A limestone base, a whitewashed shaft banded by stone string courses and
// pierced by narrow slits, then the belfry: a red cage open on all four sides through round-headed arches, with a
// bronze bell swinging inside, a stone cornice and a terracotta pyramid spire with a gilded ball.
// From above: a small square with a four-sided terracotta point and a very long shadow. Footprint 5 x 4, the door
// faces +z.
export const meta = {
  id: 'campanile', name: 'Campanile',
  aliases: ['campanile', 'campaniles', 'bell tower', 'bell towers', 'belfry', 'clock tower', 'çan kulesi', 'saat kulesi'],
  category: 'landmark', stage: 'town', footprint: { w: 5, d: 4 }, height: 17.5,
  desc: 'A tall whitewashed bell tower with a red open belfry and a terracotta spire.'
};

export function build(api) {
  const R = api.ramps, g = api.group();
  const wall = api.lambert('#efe4d2'), red = api.lambert('#c23a2c', 0.1);
  const W = 2.9;

  // base and shaft
  g.add(api.box({ w: W + 0.7, h: 1.2, d: W + 0.7, y: 0.6, ramp: R.LIMESTONE, speck: 0.24 }));
  g.add(api.box({ w: W + 0.85, h: 0.14, d: W + 0.85, y: 1.27, ramp: R.LIMESTONE, lift: 0.05 }));
  const S0 = 1.34, SH = 9.6;
  g.add(api.box({ w: W, h: SH, d: W, y: S0 + SH / 2, mat: wall }));
  [4.4, 7.8].forEach(y => g.add(api.box({ w: W + 0.18, h: 0.14, d: W + 0.18, y: S0 + y, ramp: R.LIMESTONE, lift: 0.04 })));
  g.add(api.inkDoor({ w: 0.95, h: 1.9, y: 0, z: (W + 0.7) / 2 + 0.01 }));
  // narrow slits up the front and the lit side
  [2.8, 6.2].forEach(y => {
    g.add(api.inkWindow({ w: 0.24, h: 0.95, y: S0 + y, z: W / 2, frame: false, arched: true }));
    g.add(api.inkWindow({ w: 0.24, h: 0.95, x: -W / 2, y: S0 + y + 0.6, rot: -Math.PI / 2, frame: false, arched: true }));
  });

  // the belfry: four red arched walls make an open cage
  const B0 = S0 + SH, BH = 2.7, bw = W + 0.2, bd = 0.32;
  g.add(api.box({ w: W + 0.4, h: 0.2, d: W + 0.4, y: B0 + 0.1, ramp: R.LIMESTONE, lift: 0.06 }));
  const B1 = B0 + 0.2;
  [1, -1].forEach(s => {
    g.add(api.archWall({ w: bw, h: BH, d: bd, arches: 1, archW: 1.3, archH: 2.0, y: B1, z: s * (bw - bd) / 2, mat: red }));
    g.add(api.archWall({ w: bw - 2 * bd, h: BH, d: bd, arches: 1, archW: 1.3, archH: 2.0, x: s * (bw - bd) / 2, y: B1, rot: Math.PI / 2, mat: red }));
  });
  // the bell (pivot at the top), the inside of the cage dark
  g.add(api.box({ w: bw - 2 * bd - 0.02, h: BH - 0.1, d: bw - 2 * bd - 0.02, y: B1 + (BH - 0.1) / 2, ramp: R.INK, lift: 0.12, speck: 0.05 }));
  const bell = api.group({ y: B1 + 2.05 }); bell.name = 'bell';
  bell.add(api.lathe({ points: [[0.03, -0.95], [0.6, -0.92], [0.46, -0.6], [0.36, -0.2], [0.3, -0.05], [0.03, 0]], seg: 18, ramp: R.GOLD }));
  g.add(bell);

  // cornice, spire, ball
  const C0 = B1 + BH;
  g.add(api.box({ w: bw + 0.4, h: 0.26, d: bw + 0.4, y: C0 + 0.13, ramp: R.LIMESTONE, lift: 0.05 }));
  g.add(api.hipRoof({ w: bw, d: bw, h: 2.6, overhang: 0.12, y: C0 + 0.26, ramp: R.TERRACOTTA }));
  g.add(api.sphere({ r: 0.18, y: C0 + 0.26 + 2.7, ramp: R.GOLD }));

  // a cypress at its foot, sometimes two
  g.add(api.cypress({ h: api.range(4.2, 5.4), x: -2.35, z: 1.1 }));
  if (api.rand() < 0.5) g.add(api.cypress({ h: api.range(3.4, 4.4), x: 2.3, z: -1.4 }));

  // keylines: shaft and belfry as one tall box
  api.proxy(api.boxGeo({ w: W, h: SH, d: W, y: S0 + SH / 2 }), g);
  api.proxy(api.boxGeo({ w: bw, h: BH, d: bw, y: B1 + BH / 2 }), g);
  return g;
}

// the bell swings
export function animate(obj, t) {
  const b = obj.getObjectByName('bell');
  if (b) b.rotation.x = Math.sin(t * 2.2) * 0.32;
}
