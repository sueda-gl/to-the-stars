// ALOUD trailer t6: MUSHROOM COTTAGES: a cluster of fat cream stems with round doors and windows under big domed
// caps (coral, lilac or pink) with cream spots; a little one leaning on the big one. Toy-town and soft.
function build(api) {
  var R = api.ramps, g = api.group(), PI = Math.PI, i, k;
  var caps = ['#f08f74', '#c4aef0', '#f2a1b9', '#7f9fe8'];
  var list = [[0, 0, 1.0], [3.4, 1.6, 0.66], [-3.0, 2.0, 0.55]];
  for (k = 0; k < list.length; k++) {
    var x = list[k][0], z = list[k][1], s = list[k][2] * api.range(0.9, 1.1), cap = caps[(k + Math.floor(api.rand() * 4)) % 4];
    var sr = 1.9 * s, sh = 4.2 * s, cr = 3.6 * s;
    g.add(api.cylinder({ rb: sr * 1.15, rt: sr * 0.9, h: sh, x: x, y: sh / 2, z: z, ramp: '#f7efdc', seg: 20 }));
    g.add(api.inkDoor({ w: 0.9 * s + 0.2, h: 1.7 * s + 0.2, x: x, y: 0, z: z + sr * 1.05, frame: false }));
    g.add(api.cylinder({ r: 0.35 * s + 0.1, h: 0.2, rx: PI / 2, rot: 1.0, x: x + Math.sin(1.0) * sr, y: sh * 0.65, z: z + Math.cos(1.0) * sr, ramp: R.INK, seg: 12 }));
    g.add(api.sphere({ r: cr, sy: 0.62, x: x, y: sh + 0.1, z: z, ramp: cap, seg: 26 }));
    g.add(api.cylinder({ r: cr * 0.98, h: 0.3, x: x, y: sh + 0.05, z: z, ramp: '#efe3cf', seg: 26 }));
    for (i = 0; i < 6; i++) { var a = i / 6 * PI * 2 + k, rr = cr * (i % 2 ? 0.55 : 0.8), yy = sh + 0.1 + cr * 0.62 * Math.sqrt(1 - rr * rr / (cr * cr)); g.add(api.sphere({ r: 0.38 * s + 0.1, sy: 0.4, x: x + Math.sin(a) * rr, y: yy, z: z + Math.cos(a) * rr, ramp: '#f7efdc', seg: 10 })); }
    api.proxy(api.sphereGeo({ r: cr, sy: 0.62, x: x, y: sh + 0.1, z: z, seg: 20 }), g);
  }
  return g;
}
