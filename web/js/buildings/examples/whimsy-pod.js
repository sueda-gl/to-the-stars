// ALOUD trailer t6: a FUTURO POD HOUSE (Sueda's reference futuro-pods.png): a pastel saucer on splayed legs, a ring of
// oval ink windows round its rim, a little hatch stair underneath, and an atom antenna on the top (a mast with two
// crossed rings and a bead). Each registration picks its colour (mint, lilac, lemon, pink, sky, peach).
function build(api) {
  var R = api.ramps, g = api.group(), PI = Math.PI, i;
  var col = api.pick(['#a9dcc4', '#c4aef0', '#f5d468', '#f4b3c5', '#a8c8f0', '#f6c49a']);
  var trim = col === '#f5d468' ? '#c4aef0' : '#f7efdc';   // never lemon next to mint (§13)
  var r = api.range(3.6, 4.2), legH = api.range(1.8, 2.4), cy = legH + r * 0.42;
  g.add(api.sphere({ r: r, sy: 0.46, y: cy, ramp: col, seg: 28 }));
  g.add(api.torus({ r: r * 0.99, tube: 0.12, y: cy - 0.05, ramp: trim, seg: 32 }));
  var n = 7;
  for (i = 0; i < n; i++) {
    var a = i / n * PI * 2 + 0.3;
    g.add(api.sphere({ r: 0.62, sx: 1.6, sy: 0.9, sz: 0.4, rot: a, x: Math.sin(a) * r * 0.9, y: cy + 0.25, z: Math.cos(a) * r * 0.9, ramp: R.INK, seg: 14 }));
  }
  // splayed legs
  for (i = 0; i < 4; i++) {
    var b = i / 4 * PI * 2 + PI / 4, fx = Math.sin(b) * (r * 0.95), fz = Math.cos(b) * (r * 0.95), tx = Math.sin(b) * r * 0.45, tz = Math.cos(b) * r * 0.45;
    g.add(api.tube({ points: [[fx, 0, fz], [tx, cy - r * 0.3, tz]], r: 0.11, seg: 4, ramp: trim }));
    g.add(api.cylinder({ r: 0.3, h: 0.12, x: fx, y: 0.06, z: fz, ramp: trim, seg: 10 }));
  }
  g.add(api.stairs({ w: 1.0, steps: 4, rise: legH / 4.5, run: 0.35, y: 0, z: 1.2 }));
  // the atom antenna
  var ty = cy + r * 0.46;
  g.add(api.cylinder({ r: 0.55, h: 0.4, y: ty + 0.1, ramp: trim, seg: 16 }));
  g.add(api.cylinder({ r: 0.06, h: 2.4, y: ty + 1.4, ramp: R.IRON, seg: 6 }));
  g.add(api.torus({ r: 0.55, tube: 0.04, flat: false, y: ty + 2.4, rx: 0.5, ramp: R.IRON }));
  g.add(api.torus({ r: 0.55, tube: 0.04, flat: false, y: ty + 2.4, rot: PI / 2, rx: -0.5, ramp: R.IRON }));
  g.add(api.sphere({ r: 0.16, y: ty + 2.4, ramp: '#f08f74' }));
  api.proxy(api.sphereGeo({ r: r, sy: 0.46, y: cy, seg: 20 }), g);
  return g;
}
