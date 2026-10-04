// ALOUD trailer t6: the DOME OBSERVATORY: a round ultramarine-and-cream drum on a stepped plinth, a big pale lilac
// dome with its dark slit open and a fat brass telescope poking out at the sky, a little crescent moon on a pole.
function build(api) {
  var R = api.ramps, g = api.group(), PI = Math.PI;
  var rd = 5.0, dh = 4.4;
  g.add(api.cylinder({ r: rd + 1.6, h: 0.5, y: 0.25, ramp: '#efe3cf', seg: 30 }));
  g.add(api.cylinder({ r: rd + 0.8, h: 0.5, y: 0.75, ramp: '#f7efdc', seg: 30 }));
  g.add(api.cylinder({ r: rd, h: dh, y: 1.0 + dh / 2, ramp: '#3d5fc4', seg: 30 }));
  g.add(api.cylinder({ r: rd + 0.05, h: 0.6, y: 1.0 + dh - 0.3, ramp: '#f7efdc', seg: 30 }));
  g.add(api.dome({ r: rd, h: rd * 0.95, y: 1.0 + dh, ramp: '#d8c9f4', seg: 30 }));
  g.add(api.box({ w: 1.4, h: rd * 0.8, d: rd * 1.2, x: 0, y: 1.0 + dh + rd * 0.45, z: 0.6, rx: -0.55, ramp: R.INK }));
  g.add(api.cylinder({ rb: 0.75, rt: 0.6, h: 6.5, x: 0, y: 1.0 + dh + rd * 0.9, z: 2.3, rx: 0.75, ramp: R.GOLD, seg: 16 }));
  g.add(api.inkDoor({ w: 1.3, h: 2.2, y: 1.0, z: rd, frame: false }));
  for (var i = 0; i < 6; i++) { var a = 0.8 + i * 0.9; g.add(api.cylinder({ r: 0.35, h: 0.2, rx: PI / 2, rot: a, x: Math.sin(a) * rd, y: 1.0 + dh * 0.55, z: Math.cos(a) * rd, ramp: '#f7efdc', seg: 12 })); }
  g.add(api.cylinder({ r: 0.07, h: 5, x: rd + 1.0, y: 3.0, z: -rd * 0.6, ramp: R.IRON, seg: 6 }));
  g.add(api.torus({ r: 0.6, tube: 0.16, flat: false, x: rd + 1.0, y: 6.1, z: -rd * 0.6, ramp: '#f5d468' }));
  api.proxy(api.cylinderGeo({ r: rd, h: dh, y: 1.0 + dh / 2, seg: 18 }), g);
  return g;
}
