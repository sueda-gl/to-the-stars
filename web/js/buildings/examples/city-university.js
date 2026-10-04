// ALOUD trailer t6: the UNIVERSITY: four cream wings round a green quad with crossing paths, a domed library hall
// on the north wing (ultramarine dome), an arcade on the front gate, a few trees in the quad.
function build(api) {
  var R = api.ramps, g = api.group();
  var S = 24, wd = 5, H = 7.5, wall = api.lambert('#efe7d6', 0.32), i;
  g.add(api.box({ w: S, h: 0.4, d: S, y: 0.2, ramp: R.LIMESTONE }));
  g.add(api.box({ w: S - 2 * wd, h: 0.12, d: S - 2 * wd, y: 0.46, ramp: R.SAGE }));
  g.add(api.box({ w: 1.2, h: 0.14, d: S - 2 * wd, y: 0.5, ramp: R.SAND }));
  g.add(api.box({ w: S - 2 * wd, h: 0.14, d: 1.2, y: 0.5, ramp: R.SAND }));
  var wings = [[0, -(S - wd) / 2, S, wd], [0, (S - wd) / 2, S, wd], [-(S - wd) / 2, 0, wd, S - 2 * wd], [(S - wd) / 2, 0, wd, S - 2 * wd]];
  for (i = 0; i < 4; i++) {
    var w = wings[i];
    g.add(api.box({ w: w[2], h: H, d: w[3], x: w[0], y: 0.4 + H / 2, z: w[1], mat: wall }));
    g.add(api.hipRoof({ w: w[2], d: w[3], h: 1.8, overhang: 0.3, x: w[0], y: 0.4 + H, z: w[1], ramp: R.SLATE }));
    api.proxy(api.boxGeo({ w: w[2], h: H, d: w[3], x: w[0], y: 0.4 + H / 2, z: w[1] }), g);
  }
  for (i = 0; i < 6; i++) { g.add(api.inkWindow({ w: 1.1, h: 1.8, x: -S / 2 + 3 + i * (S - 6) / 5, y: 2.6, z: S / 2, arched: true, frame: false })); g.add(api.inkWindow({ w: 1.1, h: 1.8, x: -S / 2 + 3 + i * (S - 6) / 5, y: 5.9, z: S / 2, frame: false })); }
  g.add(api.inkDoor({ w: 2.4, h: 3.6, y: 0.4, z: S / 2, arched: true }));
  // the domed hall on the north wing
  g.add(api.cylinder({ r: 4.2, h: 3.0, y: 0.4 + H + 1.5, z: -(S - wd) / 2, mat: wall, seg: 28 }));
  g.add(api.dome({ r: 4.4, h: 4.0, y: 0.4 + H + 3.0, z: -(S - wd) / 2, ramp: R.BLUE, seg: 28 }));
  g.add(api.sphere({ r: 0.4, y: 0.4 + H + 7.2, z: -(S - wd) / 2, ramp: R.CREAM }));
  // trees in the quad
  g.add(api.tree({ kind: 'olive', h: 3.6, x: -4.5, y: 0.5, z: 4.5 })); g.add(api.tree({ kind: 'oak', h: 4.4, x: 4.5, y: 0.5, z: -4.0 }));
  g.add(api.cypress({ h: 4.6, x: 4.6, z: 4.6 }));
  return g;
}
