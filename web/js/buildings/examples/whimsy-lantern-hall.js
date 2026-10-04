// ALOUD trailer t6: the LANTERN-STACK HALL of the glims: three big paper lanterns stacked like a pagoda, apricot and
// cream pleated paper (ribs round each one), plum caps between them, round ink windows, a wire handle loop on top.
// The lanterns get smaller as they climb; the bottom one is the hall, with an arched door.
function build(api) {
  var R = api.ramps, g = api.group(), PI = Math.PI, i, k;
  var paper = api.pick([['#f6c49a', '#f7efdc'], ['#f4b3c5', '#f7efdc'], ['#f5d468', '#f7efdc']]), plum = '#6b4a7a';
  var y = 0, r = 5.2;
  g.add(api.cylinder({ r: r + 0.8, h: 0.6, y: 0.3, ramp: plum, seg: 24 }));
  y = 0.6;
  for (k = 0; k < 3; k++) {
    var h = r * 1.15, pts = [];
    for (i = 0; i <= 8; i++) { var u = i / 8; pts.push([r * (0.72 + 0.28 * Math.sin(u * PI)), u * h]); }
    g.add(api.lathe({ points: pts, seg: 28, y: y, ramp: paper[k % 2] }));
    for (i = 1; i < 6; i++) { var u2 = i / 6, rr = r * (0.72 + 0.28 * Math.sin(u2 * PI)); g.add(api.torus({ r: rr + 0.03, tube: 0.07, y: y + u2 * h, ramp: plum, seg: 28 })); }
    for (i = 0; i < 4; i++) { var a = i / 4 * PI * 2 + k * 0.4; g.add(api.cylinder({ r: r * 0.17, h: 0.3, rx: PI / 2, rot: a, x: Math.sin(a) * r * 0.98, y: y + h * 0.5, z: Math.cos(a) * r * 0.98, ramp: R.INK, seg: 14 })); }
    g.add(api.cylinder({ r: r * 0.78, h: 0.6, y: y + h + 0.3, ramp: plum, seg: 24 }));
    api.proxy(api.cylinderGeo({ r: r * 0.98, h: h, y: y + h / 2, seg: 16 }), g);
    y += h + 0.6; r *= 0.72;
  }
  g.add(api.inkDoor({ w: 1.6, h: 2.6, y: 0.6, z: 5.2 * 0.74, frame: false }));
  g.add(api.torus({ r: 1.0, tube: 0.12, flat: false, y: y + 0.9, ramp: plum }));
  return g;
}
