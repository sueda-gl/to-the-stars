// ALOUD trailer t6: the PARASOL HOUSES of the floaties: round cream houses sheltering under giant striped beach
// parasols (concentric rings of colour, a scalloped fringe, a pennant on top), the parasol pole running down through
// the roof. Two or three of them on one plot at different heights, sharing a round terrace.
function build(api) {
  var R = api.ramps, g = api.group(), PI = Math.PI, i, k;
  var sets = [['#f08f74', '#f7efdc'], ['#7f9fe8', '#f7efdc'], ['#f2a1b9', '#f7efdc'], ['#c4aef0', '#f7efdc']];
  g.add(api.cylinder({ r: 7.2, h: 0.4, y: 0.2, ramp: '#efe3cf', seg: 30 }));
  var spots = [[-2.6, -1.2, 7.5], [2.9, 0.6, 9.5], [-0.2, 3.4, 5.6]];
  var n = 2 + (api.rand() < 0.6 ? 1 : 0);
  for (k = 0; k < n; k++) {
    var s = spots[k], x = s[0], z = s[1], H = s[2], cr = api.range(3.6, 4.4), st = sets[(k + Math.floor(api.rand() * 4)) % 4];
    // the house: a cream drum, an ink door and round windows
    var hr = cr * 0.5, hh = H * 0.42;
    g.add(api.cylinder({ r: hr, h: hh, x: x, y: 0.4 + hh / 2, z: z, ramp: '#f7efdc', seg: 22 }));
    g.add(api.inkDoor({ w: 0.8, h: 1.5, x: x, y: 0.4, z: z + hr, frame: false }));
    for (i = 0; i < 3; i++) { var a = 1.2 + i * 1.6; g.add(api.cylinder({ r: 0.32, h: 0.2, rx: PI / 2, rot: a, x: x + Math.sin(a) * hr, y: 0.4 + hh * 0.62, z: z + Math.cos(a) * hr, ramp: R.INK, seg: 12 })); }
    // the pole and the parasol: concentric rings of colour, slightly domed
    g.add(api.cylinder({ r: 0.12, h: H - hh, x: x, y: 0.4 + hh + (H - hh) / 2, z: z, ramp: '#f7efdc', seg: 8 }));
    var rings = 5;
    for (i = 0; i < rings; i++) {
      var r0 = cr * (1 - i / rings), r1 = cr * (1 - (i + 1) / rings);
      var y0 = H - 0.55 * (r0 / cr) * (r0 / cr) * 1.6, y1 = H - 0.55 * (r1 / cr) * (r1 / cr) * 1.6;
      g.add(api.cylinder({ rb: r0, rt: Math.max(0.05, r1), h: Math.max(0.12, y1 - y0 + 0.12), x: x, y: 0.4 + (y0 + y1) / 2, z: z, ramp: st[i % 2], seg: 26 }));
    }
    for (i = 0; i < 12; i++) { var b = i / 12 * PI * 2; g.add(api.sphere({ r: 0.32, sy: 0.6, x: x + Math.sin(b) * cr, y: 0.4 + H - 0.95, z: z + Math.cos(b) * cr, ramp: st[0], seg: 8 })); }
    g.add(api.flag({ pole: 1.2, w: 0.8, h: 0.45, x: x, y: 0.4 + H + 0.05, z: z, ramp: st[0] }));
    api.proxy(api.cylinderGeo({ r: hr, h: hh, x: x, y: 0.4 + hh / 2, z: z, seg: 16 }), g);
  }
  return g;
}
