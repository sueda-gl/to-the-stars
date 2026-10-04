// ALOUD trailer t6: a POWER STATION: a long white turbine hall with a slate roof and a ribbon of glass, two tall slim
// stacks (white, ultramarine bands) and a cream hyperbolic cooling tower. Smoke anchors: nodes 'stackTop' (both
// stacks) for the trailer's smoke. The landmark of the works.
function build(api) {
  var R = api.ramps, g = api.group();
  var L = 24, D = 12, H = 10;
  g.add(api.box({ w: L + 2, h: 0.5, d: D + 2, y: 0.25, ramp: R.LIMESTONE }));
  g.add(api.box({ w: L, h: H, d: D, y: 0.5 + H / 2, mat: api.lambert('#eeeae2', 0.36) }));
  g.add(api.box({ w: L + 0.08, h: 1.6, d: D + 0.08, y: 0.5 + H - 2.2, ramp: R.GLASS }));
  g.add(api.gableRoof({ w: L, d: D, h: 2.2, overhang: 0.3, y: 0.5 + H, ramp: R.SLATE }));
  for (var d = 0; d < 4; d++) g.add(api.inkDoor({ w: 2.0, h: 4.0, x: -L / 2 + 3.5 + d * 5.6, y: 0.5, z: D / 2, arched: true, frame: R.LIMESTONE }));
  // the stacks
  for (var s = 0; s < 2; s++) {
    var sx = -L / 2 + 4 + s * 5, sz = -D / 2 - 3, sH = 32;
    g.add(api.cylinder({ rb: 1.25, rt: 0.85, h: sH, x: sx, y: sH / 2, z: sz, mat: api.lambert('#f2efe9', 0.36), seg: 20 }));
    for (var b = 0; b < 2; b++) g.add(api.cylinder({ r: 1.18 - b * 0.22, h: 1.2, x: sx, y: sH * (0.55 + b * 0.38), z: sz, ramp: R.BLUE, seg: 20 }));
    var top = api.group({ x: sx, y: sH, z: sz }); top.name = 'stackTop'; g.add(top);
    api.proxy(api.cylinderGeo({ rb: 1.25, rt: 0.85, h: sH, x: sx, y: sH / 2, z: sz, seg: 20 }), g);
  }
  // the cooling tower: a hyperbolic lathe
  var pts = [], cx = L / 2 + 9, Ht = 18;
  for (var i = 0; i <= 10; i++) { var u = i / 10, y = u * Ht, rr = 7.2 - 4.4 * Math.sin(Math.min(1, u * 1.15) * Math.PI * 0.62) + (u > 0.8 ? (u - 0.8) * 6 : 0); pts.push([rr, y]); }
  g.add(api.lathe({ points: pts, seg: 28, x: cx, y: 0, z: -2, ramp: R.CREAM }));
  g.add(api.torus({ r: 7.2, tube: 0.35, x: cx, y: 0.3, z: -2, ramp: R.SLATE }));
  api.proxy(api.boxGeo({ w: L, h: H, d: D, y: 0.5 + H / 2 }), g);
  return g;
}
