// ALOUD trailer t6: the ROUNDED WORKS (a playful modern factory): three long barrel-vaulted halls side by side, cream
// with ultramarine (or lilac) ribs, round porthole lights along the sides, rounded ends with big ink doors, and two
// slim striped stacks with rounded caps (smoke anchors: nodes named 'stackTop').
function build(api) {
  var R = api.ramps, g = api.group(), PI = Math.PI, i, k;
  var rib = api.pick(['#3d5fc4', '#9a86d8', '#7f9fe8']);
  var L = 18, vr = 3.2;
  g.add(api.box({ w: 3 * vr * 2 + 2, h: 0.4, d: L + 2, y: 0.2, ramp: '#efe3cf' }));
  for (k = 0; k < 3; k++) {
    var x = (k - 1) * vr * 2.05, len = L * (k === 1 ? 1 : 0.85);
    g.add(api.box({ w: vr * 2, h: 1.8, d: len, x: x, y: 0.4 + 0.9, ramp: '#f7efdc' }));
    g.add(api.cylinder({ r: vr, h: len, rx: PI / 2, x: x, y: 2.2, ramp: '#f7efdc', seg: 24 }));
    for (i = 0; i < 6; i++) g.add(api.torus({ r: vr + 0.04, tube: 0.12, flat: false, x: x, y: 2.2, z: -len / 2 + 1 + i * (len - 2) / 5, ramp: rib, seg: 24 }));
    g.add(api.inkDoor({ w: 2.4, h: 2.8, x: x, y: 0.4, z: len / 2, arched: true, frame: false }));
    for (i = 0; i < 5; i++) g.add(api.cylinder({ r: 0.45, h: 0.2, rx: PI / 2, rot: PI / 2, x: x + vr * (k === 0 ? -1 : 1), y: 1.6, z: -len / 2 + 2 + i * (len - 4) / 4, ramp: R.INK, seg: 12 }));
    api.proxy(api.cylinderGeo({ r: vr, h: len, rx: PI / 2, x: x, y: 2.2, seg: 16 }), g);
  }
  for (k = 0; k < 2; k++) {
    var sx = (k ? 1 : -1) * vr * 3.6, sz = -L / 2 + 2, sH = 15 + k * 3;
    for (i = 0; i < 4; i++) g.add(api.cylinder({ rb: 0.8 - i * 0.06, rt: 0.74 - i * 0.06, h: sH / 4, x: sx, y: (i + 0.5) * sH / 4, z: sz, ramp: i % 2 ? rib : '#f7efdc', seg: 16 }));
    g.add(api.sphere({ r: 0.62, sy: 0.6, x: sx, y: sH, z: sz, ramp: '#f7efdc', seg: 14 }));
    var top = api.group({ x: sx, y: sH + 0.4, z: sz }); top.name = 'stackTop'; g.add(top);
  }
  return g;
}
