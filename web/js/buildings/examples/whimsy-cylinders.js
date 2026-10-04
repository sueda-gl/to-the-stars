// ALOUD trailer t6: STACKED-CYLINDER APARTMENTS: fat round drums of flats piled off-centre like a stack of macarons,
// each a different pastel (no lemon on a mint stack, §13), a dark ribbon of windows round each, round balconies as
// rings, a little roof garden on top in a pot.
function build(api) {
  var R = api.ramps, g = api.group(), PI = Math.PI, i;
  var warm = api.rand() < 0.5;
  var pal = warm ? ['#f6b3c4', '#f5d468', '#f7efdc', '#c4aef0', '#f6c49a'] : ['#a9dcc4', '#a8c8f0', '#f7efdc', '#c4aef0', '#f6b3c4'];
  var n = 4 + Math.floor(api.rand() * 3), y = 0.4, drums = [];
  g.add(api.cylinder({ r: 6.0, h: 0.4, y: 0.2, ramp: '#efe3cf', seg: 28 }));
  for (i = 0; i < n; i++) {
    var r = api.range(3.2, 4.6) - i * 0.15, h = api.range(2.6, 3.4), ox = api.range(-1.1, 1.1), oz = api.range(-0.9, 0.9);
    g.add(api.cylinder({ r: r, h: h, x: ox, y: y + h / 2, z: oz, ramp: pal[i % pal.length], seg: 26 }));
    g.add(api.cylinder({ r: r + 0.04, h: h * 0.34, x: ox, y: y + h * 0.56, z: oz, ramp: R.INK, seg: 26 }));
    g.add(api.cylinder({ r: r + 0.35, h: 0.18, x: ox, y: y + h - 0.05, z: oz, ramp: '#f7efdc', seg: 26 }));
    drums.push([ox, oz, r, y, h]);
    y += h + 0.1;
  }
  var last = drums[drums.length - 1];
  g.add(api.cylinder({ r: 1.0, h: 0.8, x: last[0], y: y + 0.4, z: last[1], ramp: '#f08f74', seg: 14 }));
  g.add(api.shrub({ r: 1.0, x: last[0], y: y + 0.8, z: last[1], ramp: warm ? R.LAVENDER : R.SAGE }));
  g.add(api.inkDoor({ w: 1.1, h: 1.8, x: drums[0][0], y: 0.4, z: drums[0][1] + drums[0][2], frame: false }));
  for (i = 0; i < drums.length; i++) { var d = drums[i]; api.proxy(api.cylinderGeo({ r: d[2], h: d[4], x: d[0], y: d[3] + d[4] / 2, z: d[1], seg: 16 }), g); }
  return g;
}
