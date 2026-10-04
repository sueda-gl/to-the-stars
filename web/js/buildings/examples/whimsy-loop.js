// ALOUD trailer t6: the RIBBON BUILDING: one long fat ribbon of rooms that rises from the ground, loops right over
// itself and lands again, cream with a lilac (or coral) stripe along its spine and a row of ink windows; a little
// glass pavilion sits inside the loop. A roller-coaster of a house.
function build(api) {
  var R = api.ramps, g = api.group(), PI = Math.PI, i;
  var stripe = api.pick(['#c4aef0', '#f08f74', '#7f9fe8', '#f2a1b9']), body = api.pick(['#f6b3c4', '#c4aef0', '#a8c8f0', '#f6c49a']);
  if (body === stripe) stripe = '#f7efdc';
  var pts = [], n = 22;
  for (i = 0; i <= n; i++) {
    var u = i / n, a = u * PI * 2;   // a loop in XY that drifts along z so the ends pass each other
    pts.push([-7 + u * 14 + Math.sin(a) * 6.5, 1.8 + (1 - Math.cos(a)) * 5.2, -2.6 + u * 5.2]);
  }
  g.add(api.tube({ points: pts, r: 2.0, seg: 48, radial: 14, ramp: body }));
  // a cream band of windows along the side that faces the street (+z)
  var side = pts.map(function (p) { return [p[0], p[1], p[2] + 1.35]; });
  g.add(api.tube({ points: side, r: 0.85, seg: 48, radial: 10, ramp: '#f7efdc' }));
  for (i = 1; i < n; i += 1) { var p = pts[i]; g.add(api.sphere({ r: 0.4, sz: 0.4, x: p[0], y: p[1], z: p[2] + 2.15, ramp: R.INK, seg: 10 })); }
  // the ends land on two round plinths with doors
  g.add(api.cylinder({ r: 2.2, h: 1.6, x: -7, y: 0.8, z: -2.6, ramp: stripe, seg: 20 }));
  g.add(api.cylinder({ r: 2.2, h: 1.6, x: 7, y: 0.8, z: 2.6, ramp: stripe, seg: 20 }));
  g.add(api.inkDoor({ w: 1.0, h: 1.4, x: 7, y: 0, z: 4.8, frame: false }));
  // the glass pavilion inside the loop
  g.add(api.cylinder({ r: 1.6, h: 2.2, x: 0, y: 1.1, z: 5.5, ramp: R.GLASS, seg: 20 }));
  g.add(api.dome({ r: 1.7, h: 0.9, x: 0, y: 2.2, z: 5.5, ramp: '#f7efdc', seg: 20 }));
  api.proxy(api.cylinderGeo({ r: 2.2, h: 1.6, x: -7, y: 0.8, z: -2.6, seg: 12 }), g);
  return g;
}
