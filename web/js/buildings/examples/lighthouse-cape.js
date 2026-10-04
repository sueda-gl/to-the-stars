// THE CAPE LIGHTHOUSE (stock plan for "a lighthouse"; the trailer's Ministry of Builds moment). ~15 m.
// A rock of big limestone boulders, an octagonal stone base with an arched door, a whitewash shaft with two proud
// red-wall bands, a corbelled stone gallery with an iron rail, a brass lantern with ink glazing round a warm lamp,
// a red-wall dome with a brass finial, and a keeper's house with a terracotta roof and blue shutters. Front = +z.
function build(api) {
  var R = api.ramps, g = api.group();
  var PI = Math.PI, i, a;
  var BRASS = ['#5a3a16', '#835a22', '#ad8132', '#c89c45', '#dcb95f'];
  var wash = api.lambert('#f1e7d6'), stone = api.lambert('#e3d2b4');

  // ---- the rock: a few big boulders under a round stone terrace ----
  var rocks = [[-2.2, 2.1, 1.6, 0.9], [2.5, 1.4, 1.4, 0.8], [0.6, -2.7, 1.8, 1.0], [-2.9, -1.4, 1.4, 0.7], [2.9, -1.9, 1.2, 0.6], [1.0, 2.9, 1.0, 0.5]];
  for (i = 0; i < rocks.length; i++) g.add(api.sphere({ r: rocks[i][2], sy: rocks[i][3] / rocks[i][2], x: rocks[i][0], y: rocks[i][3] * 0.35, z: rocks[i][1], rot: i * 0.9, ramp: R.SAND, lift: -0.12, speck: 0.3, seg: 7 }));
  g.add(api.cylinder({ rb: 3.3, rt: 3.1, h: 1.1, y: 0.55, mat: stone, seg: 28 }));
  g.add(api.torus({ r: 3.12, tube: 0.12, y: 1.12, seg: 28, ramp: R.LIMESTONE }));
  g.add(api.stairs({ w: 1.4, steps: 5, rise: 0.22, run: 0.34, x: 0, y: 0, z: 3.85, ramp: R.LIMESTONE }));

  // ---- the octagonal base (1.1 - 3.6) with an arched door and a cornice ----
  var B0 = 1.1, B1 = 3.6;
  g.add(api.cylinder({ rb: 1.95, rt: 1.8, h: B1 - B0, y: (B0 + B1) / 2, seg: 8, rot: PI / 8, mat: stone }));
  g.add(api.cylinder({ r: 2.0, h: 0.22, y: B1 + 0.05, seg: 8, rot: PI / 8, ramp: R.LIMESTONE }));
  g.add(api.inkDoor({ w: 0.9, h: 1.75, y: B0, z: 1.78, frame: R.LIMESTONE }));
  g.add(api.inkWindow({ w: 0.42, h: 0.62, x: -1.27, y: 2.6, z: 1.27, rot: -PI / 4, arched: true, frame: false }));

  // ---- the shaft (3.7 - 11.2): a whitewash taper with two proud red-wall bands and three slit windows ----
  var S0 = 3.7, S1 = 11.2, rb = 1.45, rt = 1.05;
  function rAt(y) { return rb + (rt - rb) * (y - S0) / (S1 - S0); }
  g.add(api.cylinder({ rb: rb, rt: rt, h: S1 - S0, y: (S0 + S1) / 2, mat: wash, seg: 28 }));
  var bands = [5.6, 8.6];
  for (i = 0; i < 2; i++) g.add(api.cylinder({ rb: rAt(bands[i] - 0.5) + 0.06, rt: rAt(bands[i] + 0.5) + 0.06, h: 1.0, y: bands[i], ramp: R.REDWALL, seg: 28 }));
  var wins = [[4.6, 0], [7.1, 0.0], [9.9, 0]];
  for (i = 0; i < 3; i++) g.add(api.inkWindow({ w: 0.34, h: 0.62, y: wins[i][0], z: rAt(wins[i][0]) + 0.03, arched: true, frame: false }));
  g.add(api.inkWindow({ w: 0.34, h: 0.62, x: -(rAt(7.1) + 0.03), y: 7.1, rot: -PI / 2, arched: true, frame: false }));

  // ---- corbelled gallery, deck, iron rail with posts ----
  g.add(api.cylinder({ rb: rt, rt: 1.55, h: 0.6, y: S1 + 0.3, ramp: R.LIMESTONE, seg: 28 }));
  g.add(api.cylinder({ r: 1.62, h: 0.16, y: S1 + 0.68, ramp: R.LIMESTONE, seg: 28 }));
  var rail = api.group({ y: S1 + 0.76 });
  rail.add(api.torus({ r: 1.52, tube: 0.04, y: 0.62, seg: 32, ramp: R.IRON }));
  rail.add(api.torus({ r: 1.52, tube: 0.03, y: 0.32, seg: 32, ramp: R.IRON }));
  for (i = 0; i < 12; i++) { a = i * PI / 6; rail.add(api.box({ w: 0.05, h: 0.64, d: 0.05, x: 1.52 * Math.sin(a), y: 0.32, z: 1.52 * Math.cos(a), ramp: R.IRON })); }
  g.add(rail);
  rail.traverse(function (m) { api.colourOnly(m); });

  // ---- the lantern: brass sill, ink glazing, brass mullions, a warm lamp, red-wall dome, brass finial ----
  var L0 = S1 + 0.76, LH = 1.5;
  g.add(api.cylinder({ r: 0.98, h: 0.22, y: L0 + 0.11, ramp: BRASS, seg: 20 }));
  g.add(api.cylinder({ r: 0.86, h: LH, y: L0 + 0.22 + LH / 2, ramp: R.YELLOW, lift: 0.12, speck: 0.08, seg: 16 }));   // the lit glazing
  for (i = 0; i < 8; i++) { a = i * PI / 4 + PI / 8; g.add(api.box({ w: 0.08, h: LH, d: 0.08, x: 0.88 * Math.sin(a), y: L0 + 0.22 + LH / 2, z: 0.88 * Math.cos(a), ramp: R.IRON })); }
  g.add(api.cylinder({ r: 1.04, h: 0.18, y: L0 + 0.22 + LH + 0.09, ramp: BRASS, seg: 20 }));
  g.add(api.dome({ r: 0.98, h: 1.05, y: L0 + 0.22 + LH + 0.18, ramp: R.REDWALL, seg: 24 }));
  g.add(api.cylinder({ rt: 0.03, rb: 0.07, h: 0.7, y: L0 + LH + 1.75, ramp: BRASS, seg: 8 }));
  g.add(api.sphere({ r: 0.15, y: L0 + LH + 1.5, ramp: BRASS, seg: 12 }));

  // ---- the keeper's house on the terrace, left (the lit side) ----
  var hx = -2.75, hz = 0.2;
  g.add(api.box({ w: 2.8, h: 2.2, d: 2.4, x: hx, y: 1.1 + 1.1, z: hz, mat: wash }));
  g.add(api.gableRoof({ w: 2.8, d: 2.4, h: 0.95, overhang: 0.22, x: hx, y: 3.3, z: hz, ramp: R.TERRACOTTA }));
  g.add(api.box({ w: 0.45, h: 0.9, d: 0.45, x: hx - 0.8, y: 4.2, z: hz - 0.4, mat: wash }));   // chimney
  g.add(api.inkDoor({ w: 0.7, h: 1.4, x: hx + 0.6, y: 1.1, z: hz + 1.21, frame: false }));
  g.add(api.inkWindow({ w: 0.55, h: 0.6, x: hx - 0.6, y: 2.35, z: hz + 1.21, shutters: '#3f7f95', frame: R.LIMESTONE }));
  g.add(api.inkWindow({ w: 0.55, h: 0.6, x: hx - 1.41, y: 2.35, z: hz, rot: -PI / 2, shutters: '#3f7f95', frame: R.LIMESTONE }));

  // keylines: the shaft as one taper, the base as one drum, the house as one box, the lantern as one drum
  api.proxy(api.cylinderGeo({ rb: rb, rt: rt, h: S1 - S0, y: (S0 + S1) / 2, seg: 28 }), g);
  api.proxy(api.cylinderGeo({ rb: 1.95, rt: 1.8, h: B1 - B0, y: (B0 + B1) / 2, seg: 8, rot: PI / 8 }), g);
  api.proxy(api.boxGeo({ w: 2.8, h: 2.2, d: 2.4, x: hx, y: 2.2, z: hz }), g);
  api.proxy(api.cylinderGeo({ r: 0.9, h: LH, y: L0 + 0.22 + LH / 2, seg: 16 }), g);
  return g;
}
