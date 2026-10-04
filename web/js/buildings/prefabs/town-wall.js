// Town wall: one straight segment of the stone curtain wall. A battered limestone foot, the tall ashlar wall
// with two darker courses and a few arrow slits, a walkway on top behind a crenellated parapet facing out (+z), a
// low rail on the town side, and a red-wall stripe of the commune under the merlons. Segments chain end to end
// along x (pair it with wall-tower at the corners). From above: a long pale band with its merlon teeth on the outer
// edge and a deep shadow. Footprint 10 x 3, the outside faces +z.
export const meta = {
  id: 'town-wall', name: 'Town wall',
  aliases: ['town wall', 'town walls', 'city wall', 'city walls', 'wall segment', 'stone wall', 'rampart', 'ramparts', 'fortification', 'sur', 'surlar', 'kale duvarı', 'şehir suru'],
  category: 'building', stage: 'town', footprint: { w: 10, d: 3 }, height: 5.8,
  desc: 'A straight segment of crenellated limestone town wall with a walkway.'
};

export function build(api) {
  const R = api.ramps, g = api.group();
  const stone = api.lambert('#e3d2b4');
  const L = 10;

  // battered foot and the wall
  g.add(api.box({ w: L, h: 1.0, d: 2.7, y: 0.5, ramp: R.LIMESTONE, lift: -0.06, speck: 0.3 }));
  const WH = 4.4, WD = 2.2;
  g.add(api.box({ w: L, h: WH, d: WD, y: WH / 2, mat: stone }));
  // two darker stone courses on the outer face
  [1.6, 3.1].forEach(y => g.add(api.box({ w: L, h: 0.12, d: 0.04, y, z: WD / 2 + 0.02, ramp: R.LIMESTONE, lift: -0.12, speck: 0.1 })));
  // arrow slits
  [-3.3, 0, 3.3].forEach(x => g.add(api.inkWindow({ w: 0.16, h: 0.8, x, y: 2.5, z: WD / 2, frame: false })));

  // the walkway is the wall's own top; the outer parapet with merlons
  g.add(api.box({ w: L, h: 0.22, d: 0.5, y: WH + 0.25, z: WD / 2 - 0.2, mat: api.lambert('#c23a2c', 0.1) }));
  const n = 8;
  for (let i = 0; i < n; i++) g.add(api.box({ w: 0.72, h: 0.85, d: 0.45, x: -L / 2 + 0.36 + i * (L - 0.72) / (n - 1), y: WH + 0.36 + 0.425, z: WD / 2 - 0.2, ramp: R.LIMESTONE, lift: 0.02 }));
  // the town-side rail
  g.add(api.box({ w: L, h: 0.5, d: 0.3, y: WH + 0.39, z: -WD / 2 + 0.15, ramp: R.LIMESTONE, lift: -0.02 }));

  // keylines: the wall body; the merlon row as one band
  api.proxy(api.boxGeo({ w: L, h: WH, d: WD, y: WH / 2 }), g);
  return g;
}
