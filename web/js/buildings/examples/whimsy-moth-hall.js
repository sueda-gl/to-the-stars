// ALOUD trailer t6: the MOTH HALL (the moths' market hall): a long low cream hall roofed by two pairs of huge moth
// wings, powder-blue forewings and pink hindwings tilted up like a butterfly at rest, each with a big eye-spot; a
// fluffy cream ruff along the ridge and two feathery antennae over the door.
function build(api) {
  var R = api.ramps, g = api.group(), PI = Math.PI, i;
  var L = 8, W = 12, H = 3.4;
  g.add(api.box({ w: L + 1, h: 0.4, d: W + 1, y: 0.2, ramp: '#efe3cf' }));
  g.add(api.box({ w: L, h: H, d: W, y: 0.4 + H / 2, ramp: '#f7efdc' }));
  for (i = 0; i < 5; i++) g.add(api.inkDoor({ w: 1.6, h: 2.4, x: -L / 2 + 2 + i * (L - 4) / 4, y: 0.4, z: W / 2, frame: false }));
  // the roof is a moth at rest, seen from above: a fluffy body along the ridge and four big wings spread out over the
  // hall, tilted up a little, each with an eye-spot (forewings powder blue, hindwings pink)
  function wing(len, wid) { var s = [], n = 14; for (var k = 0; k <= n; k++) { var u = k / n * PI; s.push([Math.cos(u) * len / 2, Math.sin(u) * wid]); } return s; }
  var top = 0.4 + H;
  // [outward x, outward z, colour, length, reach, z offset]: forewings reach forward-out, hindwings back-out
  var wings = [[-1, 0.5, '#8fb2ea', 9.5, 7.5, 1.2], [1, 0.5, '#8fb2ea', 9.5, 7.5, 1.2], [-1, -0.7, '#f29bb5', 7.5, 5.8, -1.6], [1, -0.7, '#f29bb5', 7.5, 5.8, -1.6]];
  for (i = 0; i < 4; i++) {
    var w = wings[i], phi = Math.atan2(w[0], w[1]);
    var wg = api.group({ x: w[0] * 0.6, y: top + 0.3 + (w[5] > 0 ? 0.35 : 0), z: w[5], rot: phi + PI });
    wg.add(api.extrude({ shape: wing(w[3], w[4]), depth: 0.3, rx: -PI / 2, ramp: w[2] }));
    wg.add(api.cylinder({ r: w[4] * 0.26, h: 0.36, y: 0.08, z: -w[4] * 0.55, ramp: '#f7efdc', seg: 18 }));
    wg.add(api.cylinder({ r: w[4] * 0.15, h: 0.42, y: 0.1, z: -w[4] * 0.55, ramp: i < 2 ? '#3d5fc4' : '#f08f74', seg: 16 }));
    g.add(wg);
  }
  g.add(api.sphere({ r: 1.3, sz: 4.2, sy: 0.8, y: top + 0.9, ramp: '#efe3cf', seg: 18 }));
  // the ruff along the ridge and the antennae
  for (var s2 = -1; s2 <= 1; s2 += 2) g.add(api.tube({ points: [[s2 * 0.3, top + 1.2, 5.2], [s2 * 1.2, top + 2.6, 6.4], [s2 * 2.4, top + 3.0, 6.8]], r: 0.12, ramp: '#6b4a7a' }));
  api.proxy(api.boxGeo({ w: L, h: H, d: W, y: 0.4 + H / 2 }), g);
  return g;
}
