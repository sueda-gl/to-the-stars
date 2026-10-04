// ALOUD trailer t6: the RAILWAY STATION: a long barrel-vaulted train shed (white steel ribs, glass and slate panels)
// over two platforms with a blue-and-cream train, and a stone head building with a clock tower at the front (+z).
function build(api) {
  var R = api.ramps, g = api.group();
  var L = 30, Wd = 13, i;
  g.add(api.box({ w: Wd + 1, h: 0.5, d: L, y: 0.25, ramp: R.LIMESTONE }));
  // the vault: ribs and panels along z
  var ribs = 9;
  for (i = 0; i < ribs; i++) {
    var z = -L / 2 + 1 + i * (L - 2) / (ribs - 1);
    g.add(api.torus({ r: Wd / 2, tube: 0.16, flat: false, x: 0, y: 0.5, z: z, ramp: R.WHITEWASH, seg: 28 }));
  }
  g.add(api.cylinder({ r: Wd / 2 - 0.05, h: L - 2, x: 0, y: 0.5, z: 0, rx: Math.PI / 2, open: true, ramp: R.GLASS, seg: 28 }));
  g.add(api.box({ w: 1.4, h: 0.3, d: L - 2, y: 0.5 + Wd / 2 + 0.05, ramp: R.SLATE }));
  // platforms and the train
  g.add(api.box({ w: 2.2, h: 0.9, d: L - 3, x: -3.6, y: 0.95, ramp: R.LIMESTONE }));
  g.add(api.box({ w: 2.2, h: 0.9, d: L - 3, x: 3.6, y: 0.95, ramp: R.LIMESTONE }));
  for (i = 0; i < 4; i++) {
    g.add(api.box({ w: 2.3, h: 2.5, d: 5.6, x: 0, y: 0.5 + 1.6, z: -L / 2 + 4 + i * 6, ramp: i === 0 ? R.BLUE : R.WHITEWASH }));
    g.add(api.box({ w: 2.34, h: 0.7, d: 5.0, x: 0, y: 0.5 + 2.2, z: -L / 2 + 4 + i * 6, ramp: R.GLASS }));
  }
  // the head building with a clock tower
  var hz = L / 2 + 3;
  g.add(api.box({ w: Wd + 6, h: 6, d: 6, y: 3, z: hz, mat: api.lambert('#ebe2cf', 0.3) }));
  g.add(api.hipRoof({ w: Wd + 6, d: 6, h: 1.6, overhang: 0.3, y: 6, z: hz, ramp: R.SLATE }));
  for (i = 0; i < 3; i++) g.add(api.inkDoor({ w: 1.8, h: 3.4, x: -4 + i * 4, y: 0, z: hz + 3, arched: true }));
  g.add(api.box({ w: 3, h: 13, d: 3, x: Wd / 2 + 1.5, y: 6.5, z: hz, mat: api.lambert('#ebe2cf', 0.3) }));
  g.add(api.cylinder({ r: 1.0, h: 0.2, x: Wd / 2 + 1.5, y: 11, z: hz + 1.55, rx: Math.PI / 2, ramp: R.CREAM, seg: 20 }));
  g.add(api.hipRoof({ w: 3, d: 3, h: 2.2, overhang: 0.2, x: Wd / 2 + 1.5, y: 13, z: hz, ramp: R.BLUE }));
  api.proxy(api.boxGeo({ w: Wd + 6, h: 6, d: 6, y: 3, z: hz }), g);
  return g;
}
