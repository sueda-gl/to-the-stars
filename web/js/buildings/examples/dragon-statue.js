// THE DRAGON STATUE (stock plan for "a dragon statue"): a weathered bronze dragon coiled on a stepped limestone
// plinth, ~8 m. Verdigris-green bronze (sage), a brass crest, horns, claws and tail spade, ink eyes; a serpent coil
// rising into a long S neck, the wings spread up and back. Few big masses. Front (+z) = the face.
function build(api) {
  var R = api.ramps, g = api.group();
  var PI = Math.PI, i;
  var BRONZE = ['#2f3e33', '#46594a', '#5f7a64', '#7c9a7e', '#9db79a'];   // verdigris, dark to light
  var BRASS = ['#5a3a16', '#835a22', '#ad8132', '#c89c45', '#dcb95f'];
  var stone = api.lambert('#e3d2b4');

  // ---- the plinth: three limestone steps and a dado with a red-wall panel ----
  g.add(api.box({ w: 5.6, h: 0.45, d: 5.6, y: 0.225, ramp: R.LIMESTONE }));
  g.add(api.box({ w: 4.8, h: 0.45, d: 4.8, y: 0.675, ramp: R.LIMESTONE }));
  g.add(api.box({ w: 3.9, h: 1.5, d: 3.9, y: 0.9 + 0.75, mat: stone }));
  g.add(api.box({ w: 4.2, h: 0.28, d: 4.2, y: 2.54, ramp: R.LIMESTONE }));
  g.add(api.box({ w: 2.2, h: 0.9, d: 0.06, y: 1.65, z: 1.97, ramp: R.REDWALL }));
  var TOP = 2.68;

  // ---- the body: a thick serpent coil lying round the plinth top, rising at the front into a long S neck ----
  var coil = [[1.45, TOP + 0.52, -0.2], [1.0, TOP + 0.55, -1.3], [-0.35, TOP + 0.58, -1.55], [-1.45, TOP + 0.62, -0.55], [-1.25, TOP + 0.7, 0.75], [-0.2, TOP + 0.85, 1.25], [0.45, TOP + 1.35, 0.95]];
  g.add(api.tube({ points: coil, r: 0.55, seg: 40, ramp: BRONZE }));
  var neck = [[0.45, TOP + 1.35, 0.95], [0.55, TOP + 2.4, 0.45], [0.35, TOP + 3.45, 0.55], [0.15, TOP + 4.2, 1.05]];
  g.add(api.tube({ points: neck, r: 0.44, seg: 24, ramp: BRONZE }));
  g.add(api.sphere({ r: 0.62, x: 0.48, y: TOP + 1.5, z: 0.85, ramp: BRONZE, seg: 18 }));               // the shoulder knot
  // fore legs gripping the plinth's front edge, brass claws
  var paws = [[0.0, 1.7], [0.95, 1.55]], P;
  for (i = 0; i < 2; i++) {
    P = paws[i];
    g.add(api.tube({ points: [[0.48 + (P[0] - 0.48) * 0.3, TOP + 1.3, 1.0], [P[0], TOP + 0.75, P[1] - 0.15], [P[0], TOP + 0.15, P[1]]], r: 0.2, seg: 10, ramp: BRONZE }));
    g.add(api.sphere({ r: 0.27, sy: 0.5, sz: 1.3, x: P[0], y: TOP + 0.12, z: P[1] + 0.12, ramp: BRONZE, seg: 12 }));
    g.add(api.cone({ r: 0.07, h: 0.26, x: P[0], y: TOP + 0.1, z: P[1] + 0.5, rx: PI / 2, ramp: BRASS, seg: 6 }));
  }
  // a brass crest of spines along the coil's back and up the neck
  var crest = [[1.25, TOP + 1.0, -0.85], [0.3, TOP + 1.08, -1.55], [-1.0, TOP + 1.12, -1.15], [-1.5, TOP + 1.2, 0.1], [0.25, TOP + 2.4, 0.05], [0.12, TOP + 3.35, 0.12], [0.0, TOP + 4.05, 0.62]];
  for (i = 0; i < crest.length; i++) g.add(api.cone({ r: 0.17, h: 0.5, x: crest[i][0], y: crest[i][1], z: crest[i][2], rx: i < 4 ? 0 : -0.9, ramp: BRASS, seg: 8 }));
  // the head: a long skull, a tapering snout, an open jaw, ink eyes and nostrils, swept brass horns
  var hd = api.group({ x: 0.12, y: TOP + 4.45, z: 1.3 });
  hd.scale.setScalar(1.15);
  hd.add(api.sphere({ r: 0.55, sx: 0.95, sy: 0.78, sz: 1.15, ramp: BRONZE, seg: 22 }));
  hd.add(api.cylinder({ rt: 0.24, rb: 0.38, h: 1.2, y: -0.06, z: 0.8, rx: PI / 2 + 0.08, ramp: BRONZE, seg: 16 }));
  hd.add(api.sphere({ r: 0.26, sy: 0.75, y: -0.12, z: 1.4, ramp: BRONZE, seg: 14 }));
  hd.add(api.sphere({ r: 0.28, sx: 0.85, sy: 0.38, sz: 2.0, y: -0.38, z: 0.8, rx: 0.28, ramp: BRONZE, seg: 16 }));   // the lower jaw, a little open
  hd.add(api.box({ w: 0.75, h: 0.13, d: 0.34, y: 0.28, z: 0.36, rx: -0.35, ramp: BRONZE }));                       // brow
  hd.add(api.sphere({ r: 0.09, x: 0.28, y: 0.13, z: 0.48, ramp: R.INK, seg: 10 }));
  hd.add(api.sphere({ r: 0.09, x: -0.28, y: 0.13, z: 0.48, ramp: R.INK, seg: 10 }));
  hd.add(api.sphere({ r: 0.05, x: 0.11, y: -0.02, z: 1.63, ramp: R.INK, seg: 8 }));
  hd.add(api.sphere({ r: 0.05, x: -0.11, y: -0.02, z: 1.63, ramp: R.INK, seg: 8 }));
  hd.add(api.cone({ r: 0.12, h: 1.05, x: 0.28, y: 0.45, z: -0.35, rx: -1.2, rz: -0.25, ramp: BRASS, seg: 10 }));
  hd.add(api.cone({ r: 0.12, h: 1.05, x: -0.28, y: 0.45, z: -0.35, rx: -1.2, rz: 0.25, ramp: BRASS, seg: 10 }));
  g.add(hd);

  // ---- wings: bat wings spread up and back, each a membrane on three brass-tipped spars ----
  var wing = [[0, 0], [0.9, 1.6], [2.2, 2.9], [3.1, 3.2], [2.7, 2.2], [3.0, 1.5], [2.2, 1.0], [2.25, 0.25], [1.4, 0.0]];
  var side = [1, -1], wg;
  for (i = 0; i < 2; i++) {
    wg = api.group({ x: 0.5 + side[i] * 0.35, y: TOP + 1.9, z: 0.55, rot: side[i] > 0 ? -0.45 : PI + 0.45 });
    wg.add(api.extrude({ points: wing, depth: 0.12, rz: 0.2, ramp: BRONZE, lift: 0.08 }));
    wg.add(api.tube({ points: [[0, 0, 0], [1.1, 1.75, 0], [2.2, 2.9, 0], [3.1, 3.2, 0]], r: 0.09, seg: 12, rz: 0.2, ramp: BRONZE }));
    wg.add(api.cone({ r: 0.09, h: 0.4, x: 2.45, y: 3.75, rz: -0.9, ramp: BRASS, seg: 6 }));
    g.add(wg);
  }

  // ---- the tail: from the coil's end round the front of the plinth top, a brass spade at the tip ----
  g.add(api.tube({ points: [[1.45, TOP + 0.52, -0.2], [1.72, TOP + 0.36, 0.75], [1.35, TOP + 0.26, 1.55], [0.6, TOP + 0.2, 1.88], [-0.4, TOP + 0.18, 1.85]], r: 0.24, seg: 20, ramp: BRONZE }));
  g.add(api.extrude({ points: [[0, 0.32], [0.3, 0], [0, -0.5], [-0.3, 0]], depth: 0.08, x: -0.75, y: TOP + 0.08, z: 1.8, rx: -PI / 2, rot: -1.4, ramp: BRASS }));

  // keylines: the body masses, the head
  api.proxy(api.boxGeo({ w: 3.9, h: 1.5, d: 3.9, y: 1.65 }), g);
  return g;
}
