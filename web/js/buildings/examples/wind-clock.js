// THE WIND CLOCK (stock plan for "a wind clock"): a curiosity. A whitewash Cycladic mill tower whose six cloth sails
// drive a great clock: the sails turn on the front, a brass gear train turns on the lit side, and the dial below the
// sails keeps (wind) time with two ink hands. A terracotta cap with a brass weathervane. ~11 m. Front (+z) = the dial.
function build(api) {
  var R = api.ramps, g = api.group();
  var PI = Math.PI, i, a;
  var BRASS = ['#5a3a16', '#835a22', '#ad8132', '#c89c45', '#dcb95f'];
  var wash = api.lambert('#f2e9d9');
  var T0 = 0.5, T1 = 7.6, rb = 2.3, rt = 2.0;
  function rAt(y) { return rb + (rt - rb) * (y - T0) / (T1 - T0); }

  // ---- the footing and the round whitewash tower ----
  g.add(api.cylinder({ rb: 2.95, rt: 2.8, h: 0.5, y: 0.25, ramp: R.LIMESTONE, seg: 28 }));
  g.add(api.cylinder({ rb: rb, rt: rt, h: T1 - T0, y: (T0 + T1) / 2, mat: wash, seg: 32 }));
  g.add(api.torus({ r: rt + 0.04, tube: 0.12, y: T1, seg: 32, ramp: R.LIMESTONE }));
  g.add(api.inkDoor({ w: 0.95, h: 1.8, x: -(rAt(1.4) + 0.02), y: T0, rot: -PI / 2, frame: R.LIMESTONE }));
  g.add(api.inkWindow({ w: 0.45, h: 0.7, x: -(rAt(5.2) + 0.02), y: 5.2, rot: -PI / 2, arched: true, frame: false, shutters: '#3f7f95' }));
  g.add(api.inkWindow({ w: 0.45, h: 0.7, y: 6.6, x: rAt(6.6) * Math.sin(2.3), z: rAt(6.6) * Math.cos(2.3), rot: 2.3, arched: true, frame: false }));

  // ---- the cap: a terracotta cone on a brass curb, a brass weathervane ----
  g.add(api.cylinder({ r: rt + 0.15, h: 0.26, y: T1 + 0.13, ramp: BRASS, seg: 32 }));
  g.add(api.cone({ r: rt + 0.35, h: 2.4, y: T1 + 0.26 + 1.2, ramp: R.TERRACOTTA, seg: 32 }));
  g.add(api.cylinder({ r: 0.05, h: 1.4, y: T1 + 3.2, ramp: BRASS, seg: 8 }));
  g.add(api.sphere({ r: 0.14, y: T1 + 2.75, ramp: BRASS, seg: 10 }));
  var vane = api.group({ y: T1 + 3.6 });
  vane.add(api.box({ w: 1.5, h: 0.06, d: 0.06, ramp: BRASS }));
  vane.add(api.extrude({ points: [[0, 0.22], [0.42, 0], [0, -0.22]], depth: 0.05, x: 0.72, ramp: BRASS }));
  vane.add(api.extrude({ points: [[0, 0.3], [0.32, 0.3], [0.32, -0.3], [0, -0.3], [0.12, 0]], depth: 0.05, x: -0.9, ramp: R.REDWALL }));
  g.add(vane);

  // ---- the sails: a brass hub on a short axle at the front of the cap, six cloth blades, turning ----
  var HY = T1 + 0.9, HZ = rt + 0.65;
  g.add(api.cylinder({ r: 0.16, h: 0.9, y: HY, z: HZ - 0.4, rx: PI / 2, ramp: R.WOOD, seg: 10 }));
  var hub = api.group({ y: HY, z: HZ });
  hub.add(api.sphere({ r: 0.32, ramp: BRASS, seg: 14 }));
  for (i = 0; i < 6; i++) hub.add(api.blade({ len: 4.0, w: 0.95, angle: i * PI / 3, z: 0.05, cloth: R.WHITEWASH }));
  api.spin(hub, { axis: 'z', speed: 0.55 });
  g.add(hub);

  // ---- the dial below the sails: a cream face in a brass bezel, twelve ink hour marks, two ink hands ----
  var DY = 3.2, DZ = rAt(DY) + 0.08, DR = 1.25;
  g.add(api.cylinder({ r: DR, h: 0.12, y: DY, z: DZ, rx: PI / 2, ramp: R.WHITEWASH, lift: 0.08, seg: 32 }));
  g.add(api.torus({ r: DR + 0.04, tube: 0.12, y: DY, z: DZ + 0.06, flat: false, seg: 36, ramp: BRASS }));
  for (i = 0; i < 12; i++) {
    a = i * PI / 6;
    g.add(api.box({ w: i % 3 === 0 ? 0.14 : 0.1, h: i % 3 === 0 ? 0.36 : 0.22, d: 0.05, x: Math.sin(a) * (DR - 0.22), y: DY + Math.cos(a) * (DR - 0.22), z: DZ + 0.07, rz: -a, ramp: R.INK }));
  }
  var hourHand = api.group({ y: DY, z: DZ + 0.1 }), minHand = api.group({ y: DY, z: DZ + 0.13 });
  hourHand.add(api.extrude({ points: [[-0.1, -0.12], [0.1, -0.12], [0.06, 0.62], [0, 0.74], [-0.06, 0.62]], depth: 0.05, ramp: R.INK }));
  minHand.add(api.extrude({ points: [[-0.07, -0.16], [0.07, -0.16], [0.04, 0.92], [0, 1.02], [-0.04, 0.92]], depth: 0.05, ramp: R.INK }));
  hourHand.rotation.z = -1.1; minHand.rotation.z = 0.8;
  api.spin(hourHand, { axis: 'z', speed: -0.05 });
  api.spin(minHand, { axis: 'z', speed: -0.6 });
  g.add(hourHand); g.add(minHand);
  g.add(api.sphere({ r: 0.1, y: DY, z: DZ + 0.16, ramp: BRASS, seg: 10 }));

  // ---- the gear train on the lit (-x) side: two brass wheels meshing, turning against each other ----
  var gx = -(rAt(4.2) + 0.12);
  var big = api.wheel({ r: 1.0, w: 0.14, spokes: 6, x: gx, y: 4.6, z: 0.35, ramp: BRASS });
  var small = api.wheel({ r: 0.6, w: 0.14, spokes: 4, x: gx - 0.02, y: 3.25, z: -0.95, ramp: BRASS });
  api.spin(big, { axis: 'x', speed: 0.35 });
  api.spin(small, { axis: 'x', speed: -0.58 });
  g.add(big); g.add(small);

  // keylines: the tower taper, the cap cone
  api.proxy(api.cylinderGeo({ rb: rb, rt: rt, h: T1 - T0, y: (T0 + T1) / 2, seg: 32 }), g);
  api.proxy(api.coneGeo({ r: rt + 0.35, h: 2.4, y: T1 + 1.46, seg: 32 }), g);
  return g;
}
