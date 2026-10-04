// ALOUD trailer t6: an OPERA HOUSE on the waterfront: a broad stone podium with steps, and a cluster of white
// shell vaults (sliced spheres) rising like sails, glass between them. The landmark of the arts. ~24 x 18 m.
function build(api) {
  var R = api.ramps, g = api.group();
  var shell = api.lambert('#f6f3ec', 0.4);
  g.add(api.box({ w: 26, h: 2.2, d: 18, y: 1.1, ramp: R.LIMESTONE }));
  g.add(api.stairs({ w: 14, steps: 6, rise: 0.36, run: 0.6, y: 0, z: 10.6 }));
  var sails = [[-7, 0, 7.6, 8.5, 0.15], [-1.5, -1.5, 9.0, 10.5, 0.1], [5, -2, 8.0, 9.2, -0.05], [9.5, 2.5, 5.5, 6.0, -0.1]];
  for (var i = 0; i < sails.length; i++) {
    var s = sails[i];
    // a shell: half a squashed sphere, opening toward +z, its glass mouth behind
    g.add(api.sphere({ r: s[2], sx: 0.62, sy: s[3] / s[2], sz: 1.0, x: s[0], y: 2.2, z: s[1], rx: s[4], mat: shell, seg: 26 }));
    g.add(api.box({ w: s[2] * 1.1, h: s[3] * 0.55, d: 0.2, x: s[0], y: 2.2 + s[3] * 0.28, z: s[1] + s[2] * 0.82, ramp: R.GLASS }));
  }
  // the ground below the podium edge: a cut, so the shells sit in the stone (spheres are centred on the podium top)
  g.add(api.box({ w: 26.2, h: 0.3, d: 18.2, y: 2.25, ramp: R.LIMESTONE }));
  api.proxy(api.boxGeo({ w: 26, h: 2.2, d: 18, y: 1.1 }), g);
  return g;
}
