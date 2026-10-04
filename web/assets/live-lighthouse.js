'use strict';
function build(api) {
  var R = api.ramps;
  var g = api.group();
  g.add(api.cylinder({ rt: 2.6, rb: 3.0, h: 2.0, y: 1.0, seg: 7, ramp: R.SAND, speck: 0.3 }));
  g.add(api.box({ w: 2.0, h: 1.3, d: 1.8, x: 1.7, y: 0.65, z: 1.3, rot: 0.5, ramp: R.SAND, lift: -0.05 }));
  g.add(api.box({ w: 1.6, h: 0.9, d: 1.5, x: -1.9, y: 0.45, z: -1.2, rot: -0.4, ramp: R.SAND }));
  g.add(api.cylinder({ rt: 2.45, rb: 2.6, h: 0.2, y: 2.1, seg: 7, ramp: R.OLIVE }));
  g.add(api.cylinder({ r: 1.5, h: 0.4, y: 2.4, seg: 20, ramp: R.LIMESTONE }));
  g.add(api.cylinder({ rb: 1.2, rt: 0.85, h: 6.0, y: 5.6, seg: 20, mat: api.lambert('#e3d2b4') }));
  g.add(api.inkDoor({ w: 0.7, h: 1.2, y: 2.6, z: 1.18 }));
  g.add(api.inkWindow({ w: 0.34, h: 0.55, y: 5.2, z: 1.04, arched: true }));
  g.add(api.inkWindow({ w: 0.3, h: 0.5, y: 7.2, z: 0.93, arched: true }));
  g.add(api.cylinder({ rb: 0.9, rt: 0.98, h: 0.3, y: 8.45, seg: 20, ramp: R.LIMESTONE }));
  g.add(api.cylinder({ r: 1.15, h: 0.2, y: 8.7, seg: 20, ramp: R.LIMESTONE, lift: -0.05 }));
  g.add(api.torus({ r: 1.1, tube: 0.04, y: 9.1, ramp: R.IRON }));
  g.add(api.cylinder({ r: 0.6, h: 0.9, y: 9.25, seg: 16, ramp: R.GOLD }));
  g.add(api.cone({ r: 0.85, h: 0.8, y: 10.1, seg: 16, ramp: R.REDWALL }));
  g.add(api.sphere({ r: 0.12, y: 10.6, ramp: R.IRON }));
  g.add(api.shrub({ r: 0.6, x: -1.7, y: 2.2, z: 0.9, ramp: R.OLIVE }));
  g.add(api.shrub({ r: 0.45, x: 1.6, y: 2.2, z: -1.2, ramp: R.SAGE }));
  api.proxy(api.cylinderGeo({ rb: 1.2, rt: 0.85, h: 6.0, y: 5.6, seg: 20 }), g);
  api.proxy(api.cylinderGeo({ r: 1.15, h: 1.6, y: 9.4, seg: 16 }), g);
  return g;
}