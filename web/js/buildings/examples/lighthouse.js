// BUILD_API.md worked example 2: a lighthouse (a landmark; tall, banded, a lamp room)
function build(api) {
  var R = api.ramps;
  var g = api.group();
  g.add(api.cylinder({ r: 2.1, h: 0.6, y: 0.3, ramp: R.LIMESTONE, seg: 24 }));                        // plinth
  g.add(api.cylinder({ rb: 1.45, rt: 1.0, h: 7.4, y: 0.6 + 3.7, mat: api.lambert('#f1e7d6'), seg: 24 })); // shaft
  for (var i = 0; i < 3; i++) {                                                                       // red bands
    var y = 1.9 + i * 2.2, r = 1.45 - (y - 0.6) / 7.4 * 0.45;
    g.add(api.cylinder({ rb: r + 0.03, rt: r - 0.03, h: 0.7, y: y, ramp: R.REDWALL, seg: 24 }));
  }
  g.add(api.cylinder({ r: 1.35, h: 0.22, y: 8.11, ramp: R.IRON, seg: 24 }));                          // gallery deck
  g.add(api.torus({ r: 1.3, tube: 0.04, y: 8.55, ramp: R.IRON }));                                     // railing
  g.add(api.cylinder({ r: 0.75, h: 1.1, y: 8.77, ramp: R.GOLD, seg: 16 }));                            // lamp room
  g.add(api.cone({ r: 1.0, h: 0.95, y: 9.8, ramp: R.REDWALL, seg: 16 }));
  g.add(api.sphere({ r: 0.14, y: 10.35, ramp: R.IRON }));
  g.add(api.inkDoor({ w: 0.75, h: 1.35, y: 0.6, z: 1.43 }));
  g.add(api.inkWindow({ w: 0.36, h: 0.55, y: 4.6, z: 1.22, arched: true }));
  g.add(api.box({ w: 2.0, h: 1.6, d: 1.6, x: 2.3, y: 0.8, z: 0.6, mat: api.lambert('#efe4d2') }));   // keeper's hut
  g.add(api.gableRoof({ w: 2.0, d: 1.6, h: 0.7, x: 2.3, y: 1.6, z: 0.6, ramp: R.TERRACOTTA }));
  g.add(api.inkDoor({ w: 0.55, h: 1.0, x: 2.6, y: 0, z: 1.4 }));
  api.proxy(api.cylinderGeo({ rb: 1.45, rt: 1.0, h: 7.4, y: 4.3, seg: 24 }), g);                      // smooth shaft line
  return g;
}
