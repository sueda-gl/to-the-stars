// ALOUD trailer t6: the SPIRAL LIBRARY: a tapering cream drum wound round by a coral reading ramp that spirals to
// the top (a ribbon on posts), slit windows between the turns like book spines in lilac and ultramarine, a little
// glass reading room and a weather-vane quill on the crown.
function build(api) {
  var R = api.ramps, g = api.group(), PI = Math.PI, i;
  var rb = 5.4, rt = 3.4, H = 16;
  g.add(api.cylinder({ r: rb + 2.2, h: 0.5, y: 0.25, ramp: '#efe3cf', seg: 30 }));
  g.add(api.cylinder({ rb: rb, rt: rt, h: H, y: 0.5 + H / 2, ramp: '#f7efdc', seg: 28 }));
  var turns = 2.6, pts = [];
  for (i = 0; i <= 60; i++) { var u = i / 60, a = u * turns * PI * 2, y = 0.8 + u * (H - 1.2), r = rb + (rt - rb) * (y / H) + 1.0; pts.push([Math.sin(a) * r, y, Math.cos(a) * r]); }
  g.add(api.tube({ points: pts, r: 0.85, seg: 96, radial: 10, ramp: '#f08f74' }));
  // book-spine windows round the drum
  var spines = ['#c4aef0', '#3d5fc4', '#f2a1b9', '#3d5fc4'];
  for (i = 0; i < 18; i++) {
    var a2 = i / 18 * PI * 2 * 3 + 0.4, y2 = 2.4 + (i / 18) * (H - 4), r2 = rb + (rt - rb) * (y2 / H) + 0.02;
    g.add(api.box({ w: 0.55, h: 2.2, d: 0.2, rot: a2, x: Math.sin(a2) * r2, y: y2, z: Math.cos(a2) * r2, ramp: spines[i % 4] }));
  }
  g.add(api.cylinder({ r: rt * 0.8, h: 2.2, y: 0.5 + H + 1.1, ramp: R.GLASS, seg: 20 }));
  g.add(api.cone({ r: rt * 0.95, h: 2.4, y: 0.5 + H + 3.4, ramp: '#3d5fc4', seg: 20 }));
  g.add(api.box({ w: 0.12, h: 1.6, d: 0.6, y: 0.5 + H + 5.2, rz: 0.3, ramp: '#f7efdc' }));
  g.add(api.inkDoor({ w: 1.6, h: 2.6, y: 0.5, z: rb, frame: false }));
  api.proxy(api.cylinderGeo({ rb: rb, rt: rt, h: H, y: 0.5 + H / 2, seg: 18 }), g);
  return g;
}
