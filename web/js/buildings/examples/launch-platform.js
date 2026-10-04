// THE SEA LAUNCH PLATFORM (ALOUD trailer, t2-launch): the old pier and the new machine. Below, the round limestone
// pier deck on its octagonal red-wall arcade standing in the sea (the Red arch's own arches, kept: this is where they
// came from). On top, the new work: a pearl ceramic launch plate inlaid with an ultramarine ring, a gold hairline and
// four ice-blue light channels, a deep flame pit ringed in light, gold seats for the craft's four feet; a slender
// faceted night-ultramarine gantry pylon behind-right (dark, so the pearl rocket stands out against it), pierced by tall
// round-headed slots of light, banded in pearl, crowned by a pearl service deck and a mast strung with lights; two
// sculpted pearl umbilical arms with an ultramarine keel and light lines reaching for the hull, each
// ending in a gold cradle pressed to the craft's belly with a glowing coupling; a stair down to a landing stage at the front (+z) and two light pylons.
// The water line is y = 1 (api.floats): the arcade's feet stand 1 m deep. The craft (examples/rocket.js, ground =
// its feet) stands on the pit at (0, deckY + 0.15, 0) in build units: root.userData.launch = { deckY, deckTop (above
// the water), waterLine, tower, arms }.
// The umbilical arms are groups with userData.role 'arm-low' / 'arm-high', pivoting at the pylon (turn .rotation.y to swing away).
function build(api) {
  var R = api.ramps, g = api.group();
  var PI = Math.PI;
  var BRASS = ['#5a3a16', '#835a22', '#ad8132', '#c89c45', '#dcb95f'];
  var PEARL = ['#837d97', '#aba6b9', '#d3cecf', '#ebe5da', '#f8f3ea'];
  var ULTRA = ['#11173a', '#1a2459', '#25357c', '#31479b', '#4560b0'];
  var NIGHT = ['#121630', '#1b2142', '#262e58', '#33406f', '#465487'];   // the pylon: a deep, quiet ultramarine
  var DEEP = ['#0f1229', '#181d3b', '#232a4e', '#313962'];
  var GLOW = ['#9fd9f0', '#c3ebf8', '#e2f6fc', '#f6fdff'];
  var stone = api.lambert('#e3d2b4');
  var WATER = 1.0, ARC_H = 3.7, DECK = 4.3, RD = 7.2;   // build heights: water line, arcade top, deck top; deck radius
  var i, a;
  function facet(m) { var geo = m.geometry.toNonIndexed(); geo.computeVertexNormals(); m.geometry = geo; return m; }

  // ---- the arcade: eight red-wall arched walls on an octagon, under the deck (the old pier) ----
  var AR = 6.3, side = 2 * AR * Math.tan(PI / 8);
  for (i = 0; i < 8; i++) {
    a = i * PI / 4 + PI / 8;
    g.add(api.archWall({ w: side + 0.5, h: ARC_H, d: 0.7, arches: 1, archW: side * 0.62, archH: ARC_H * 0.78,
      x: AR * Math.sin(a), y: 0, z: AR * Math.cos(a), rot: a, mat: api.lambert('#c23a2c', 0.18) }));
  }
  // a core drum inside the arcade (so the arches show dark depth, not daylight through the middle)
  g.add(api.cylinder({ r: 4.6, h: ARC_H, y: ARC_H / 2, ramp: R.INK, seg: 24 }));

  // ---- the deck: a limestone drum with a moulded lip, an ultramarine band, a low parapet open at the front ----
  g.add(api.cylinder({ rb: RD - 0.35, rt: RD, h: DECK - ARC_H, y: (DECK + ARC_H) / 2, mat: stone, seg: 48 }));
  g.add(api.torus({ r: RD - 0.02, tube: 0.16, y: ARC_H + 0.05, seg: 48, ramp: R.LIMESTONE }));
  g.add(api.cylinder({ r: RD + 0.015, h: 0.14, y: DECK - 0.16, ramp: ULTRA, seg: 48 }));
  var wallPts = [], n = 22, a0 = 0.34;
  for (i = 0; i <= n; i++) { a = a0 + (2 * PI - 2 * a0) * i / n; wallPts.push([(RD - 0.3) * Math.sin(a), (RD - 0.3) * Math.cos(a)]); }
  g.add(api.wall({ points: wallPts, h: 0.45, d: 0.3, y: DECK, mat: stone, smooth: false }));

  // ---- the launch plate: pearl ceramic, an inlaid ultramarine ring, a gold hairline, three light channels ----
  g.add(api.cylinder({ r: 5.6, h: 0.08, y: DECK + 0.04, ramp: PEARL, seg: 48 }));
  g.add(api.torus({ r: 4.6, tube: 0.16, y: DECK + 0.06, seg: 48, ramp: ULTRA }));
  g.add(api.torus({ r: 5.6, tube: 0.05, y: DECK + 0.07, seg: 48, ramp: BRASS }));
    for (i = 0; i < 4; i++) {   // light channels between the craft's feet (front, right, back, left)
    a = i * PI / 2;
    g.add(api.box({ w: 0.12, h: 0.04, d: 2.0, x: 3.45 * Math.sin(a), y: DECK + 0.09, z: 3.45 * Math.cos(a), rot: a, ramp: GLOW }));
  }
  // the flame pit: a deep mouth ringed in light
  g.add(api.cylinder({ r: 2.75, h: 0.06, y: DECK + 0.09, ramp: DEEP, seg: 48 }));
  g.add(api.torus({ r: 2.62, tube: 0.045, y: DECK + 0.12, seg: 48, ramp: GLOW }));
  g.add(api.torus({ r: 2.82, tube: 0.05, y: DECK + 0.11, seg: 48, ramp: BRASS }));
  // gold seats for the craft's four feet (its legs splay to (+-3.0, +-1.38))
  for (i = 0; i < 4; i++) g.add(api.cylinder({ r: 0.42, h: 0.06, x: (i < 2 ? 1 : -1) * 3.0, y: DECK + 0.1, z: (i % 2 ? 1 : -1) * 1.38, ramp: BRASS, seg: 20 }));

  // ---- the gantry pylon: a slender faceted night-blue shaft behind-right, tall arched slots of light, pearl bands ----
  var TX = 4.7, TZ = -3.6, TH = 14.2, RB = 1.15, RT = 0.8, ty = DECK + TH / 2;
  function rAt(y) { return RB + (RT - RB) * (y - DECK) / TH; }          // the pylon's circumradius at height y
  g.add(facet(api.cylinder({ r: RB + 0.35, h: 0.5, x: TX, y: DECK + 0.25, z: TZ, rot: PI / 8, ramp: PEARL, seg: 8 })));
  g.add(facet(api.cylinder({ rb: RB, rt: RT, h: TH, x: TX, y: ty, z: TZ, rot: PI / 8, ramp: NIGHT, seg: 8 })));
  var bands = [4.6, 8.9, 12.6];
  for (i = 0; i < 3; i++) g.add(facet(api.cylinder({ r: rAt(DECK + bands[i]) + 0.05, h: 0.32, x: TX, y: DECK + bands[i], z: TZ, rot: PI / 8, ramp: PEARL, seg: 8 })));
  for (i = 0; i < 3; i++) g.add(api.torus({ r: rAt(DECK + bands[i] - 0.22) + 0.02, tube: 0.025, x: TX, y: DECK + bands[i] - 0.22, z: TZ, seg: 8, rot: PI / 8, ramp: GLOW }));
  // tall round-headed slots on the two faces the shore sees (+z and -x), one between each pair of bands
  var slotY = [2.4, 6.75, 10.75], slotH = [3.0, 3.0, 2.4], ap, slot;
  function slotShape(w, h) { var sh = new api.THREE.Shape(), r = w / 2; sh.moveTo(-r, -h / 2); sh.lineTo(r, -h / 2); sh.lineTo(r, h / 2 - r); sh.absarc(0, h / 2 - r, r, 0, PI, false); sh.lineTo(-r, -h / 2); return sh.getPoints(10); }
  for (i = 0; i < 3; i++) {
    ap = rAt(DECK + slotY[i]) * Math.cos(PI / 8);
    slot = slotShape(0.36, slotH[i]);
    g.add(api.extrude({ shape: slot, depth: 0.06, x: TX, y: DECK + slotY[i], z: TZ + ap, ramp: GLOW }));
    g.add(api.extrude({ shape: slot, depth: 0.06, x: TX - ap, y: DECK + slotY[i], z: TZ, rot: -PI / 2, ramp: GLOW }));
  }
  g.add(api.inkDoor({ w: 0.9, h: 1.8, x: TX - rAt(DECK + 1) * Math.cos(PI / 8) - 0.02, y: DECK + 0.5, z: TZ + 0.3, rot: -PI / 2, frame: false }));
  // the crown: a pearl service deck with a gold edge, a short night-blue drum with a light band, a mast strung with lights
  var TOP = DECK + TH;
  g.add(facet(api.cylinder({ rb: RT + 0.2, rt: 1.45, h: 0.35, x: TX, y: TOP + 0.17, z: TZ, rot: PI / 8, ramp: PEARL, seg: 8 })));
  g.add(api.torus({ r: 1.4, tube: 0.04, x: TX, y: TOP + 0.36, z: TZ, seg: 8, rot: PI / 8, ramp: BRASS }));
  g.add(facet(api.cylinder({ rb: 0.62, rt: 0.5, h: 0.9, x: TX, y: TOP + 0.8, z: TZ, rot: PI / 8, ramp: NIGHT, seg: 8 })));
  g.add(api.cylinder({ r: 0.64, h: 0.12, x: TX, y: TOP + 0.95, z: TZ, ramp: GLOW, seg: 8, rot: PI / 8 }));
  g.add(api.cylinder({ rt: 0.018, rb: 0.07, h: 3.0, x: TX, y: TOP + 2.7, z: TZ, ramp: BRASS, seg: 8 }));
  g.add(api.sphere({ r: 0.1, x: TX, y: TOP + 2.0, z: TZ, ramp: GLOW, seg: 12 }));
  g.add(api.sphere({ r: 0.07, x: TX, y: TOP + 3.0, z: TZ, ramp: GLOW, seg: 10 }));
  g.add(api.sphere({ r: 0.05, x: TX, y: TOP + 4.2, z: TZ, ramp: GLOW, seg: 10 }));

  // ---- two umbilical arms: sculpted pearl beams with an ultramarine keel and a light line, a gold clamp at the hull ----
  var dist = Math.sqrt(TX * TX + TZ * TZ), th = Math.atan2(-TZ, TX) + PI;   // local +x points from the pylon to the rocket
  var arms = [['arm-low', 6.2, 1.42], ['arm-high', 10.8, 1.26]], arm, x0, x1, beam, k, arc, phi, rc;
  for (i = 0; i < 2; i++) {
    rc = arms[i][2];
    x0 = rAt(DECK + arms[i][1]) * 0.85; x1 = dist - rc - 0.12;
    arm = api.group({ x: TX, y: DECK + arms[i][1], z: TZ, rot: th });
    arm.userData.role = arms[i][0];
    beam = [[x0, -0.42], [x1, -0.12], [x1, 0.16], [x0, 0.3]];             // tapering toward the hull
    arm.add(api.extrude({ shape: beam, depth: 0.42, ramp: PEARL }));
    arm.add(api.extrude({ shape: [[x0, -0.46], [x1 + 0.02, -0.15], [x1 + 0.02, -0.06], [x0, -0.3]], depth: 0.46, ramp: ULTRA }));
    arm.add(api.box({ w: x1 - x0 - 0.3, h: 0.04, d: 0.04, x: (x0 + x1) / 2, y: 0.02, z: 0.23, ramp: GLOW }));
    arm.add(api.box({ w: x1 - x0 - 0.3, h: 0.04, d: 0.04, x: (x0 + x1) / 2, y: 0.02, z: -0.23, ramp: GLOW }));
    // the clamp: a gold cradle pad pressed flat to the craft's belly, with a glowing coupling at its centre
    arc = [];
    for (k = 0; k <= 6; k++) { phi = (k / 6 - 0.5) * 1.2; arc.push([x1 + 0.12 + 0.18 * (1 - Math.cos(phi * 1.6)), 0, Math.sin(phi) * 0.9]); }
    arm.add(api.tube({ points: arc, r: 0.07, seg: 20, ramp: BRASS }));
    arm.add(api.box({ w: 0.2, h: 0.3, d: 0.36, x: x1 + 0.03, ramp: BRASS }));
    arm.add(api.sphere({ r: 0.09, x: x1 + 0.16, ramp: GLOW, seg: 12 }));
    g.add(arm);
  }

  // ---- the front: a stair down to a landing stage at the water, two slim light pylons, bollards ----
  g.add(api.stairs({ w: 2.4, steps: 12, rise: (DECK - WATER - 0.3) / 12, run: 0.4, x: 0, y: WATER + 0.3, z: RD + 2.1, rot: 0, ramp: R.LIMESTONE }));
  g.add(api.box({ w: 4.2, h: WATER + 0.3, d: 2.2, x: 0, y: (WATER + 0.3) / 2, z: RD + 5.3, ramp: R.LIMESTONE }));
  var lx = [-1.55, 1.55];
  for (i = 0; i < 2; i++) {
    g.add(facet(api.cylinder({ rt: 0.09, rb: 0.17, h: 2.6, x: lx[i], y: DECK + 1.3, z: RD - 0.25, rot: PI / 8, ramp: PEARL, seg: 8 })));
    g.add(api.cylinder({ r: 0.12, h: 0.3, x: lx[i], y: DECK + 2.75, z: RD - 0.25, ramp: GLOW, seg: 12 }));
    g.add(api.cone({ r: 0.14, h: 0.3, x: lx[i], y: DECK + 3.05, z: RD - 0.25, ramp: ULTRA, seg: 8 }));
    g.add(api.cylinder({ rt: 0.16, rb: 0.2, h: 0.5, x: lx[i] * 1.3, y: WATER + 0.55, z: RD + 6.1, ramp: R.IRON, seg: 10 }));
  }

  // keylines: the deck drum, the launch plate as one slab (its rings and seats stop scribbling), the pylon shaft
  api.proxy(api.cylinderGeo({ r: 5.66, h: 0.2, y: DECK + 0.08, seg: 48 }), g);
  api.proxy(api.cylinderGeo({ rb: RD - 0.35, rt: RD, h: DECK - ARC_H, y: (DECK + ARC_H) / 2, seg: 48 }), g);
  api.proxy(api.cylinderGeo({ rb: RB + 0.03, rt: RT + 0.03, h: TH, x: TX, y: ty, z: TZ, rot: PI / 8, seg: 8 }), g);
  g.userData.launch = { deckY: DECK, deckTop: DECK - WATER, waterLine: WATER, tower: [TX, TZ], arms: ['arm-low', 'arm-high'] };
  api.floats(g, { line: WATER });
  return g;
}
