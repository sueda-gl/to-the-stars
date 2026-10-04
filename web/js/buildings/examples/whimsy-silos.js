// ALOUD trailer t6: STRIPED SILOS (playful industry): a row of fat round silos banded in cream and ultramarine (or
// lilac, or coral), rounded domed tops with little caps, a bright conveyor tube arching between them and a rounded
// cream loading shed. Modern and clean, never red brick.
function build(api) {
  var R = api.ramps, g = api.group(), PI = Math.PI, i, k;
  var band = api.pick(['#3d5fc4', '#c4aef0', '#f08f74', '#7f9fe8']);
  var n = 4, r = 2.4, H = api.range(11, 14);
  g.add(api.box({ w: n * 2 * r + 3, h: 0.4, d: 2 * r + 3, y: 0.2, ramp: '#efe3cf' }));
  for (i = 0; i < n; i++) {
    var x = -(n - 1) * r * 1.05 + i * 2 * r * 1.05, h = H * (i % 2 ? 0.86 : 1);
    var bands = 5;
    for (k = 0; k < bands; k++) g.add(api.cylinder({ r: r, h: h / bands, x: x, y: 0.4 + (k + 0.5) * h / bands, ramp: k % 2 ? band : '#f7efdc', seg: 22 }));
    g.add(api.dome({ r: r, h: r * 0.75, x: x, y: 0.4 + h, ramp: '#f7efdc', seg: 22 }));
    g.add(api.cylinder({ r: 0.5, h: 0.6, x: x, y: 0.4 + h + r * 0.75 + 0.2, ramp: band, seg: 12 }));
    api.proxy(api.cylinderGeo({ r: r, h: h, x: x, y: 0.4 + h / 2, seg: 16 }), g);
  }
  var ax = -(n - 1) * r * 1.05, bx = (n - 1) * r * 1.05;
  g.add(api.tube({ points: [[ax, H + 1.6, 0], [0, H + 4.5, 0], [bx, H * 0.86 + 1.6, 0]], r: 0.45, seg: 30, ramp: band }));
  g.add(api.cylinder({ r: 3.2, h: 9, rx: PI / 2, rot: PI / 2, x: 0, y: 0.4, z: r + 3.2, ramp: '#f7efdc', seg: 22 }));
  return g;
}
