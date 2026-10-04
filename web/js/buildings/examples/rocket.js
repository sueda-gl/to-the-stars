// THE CRAFT (ALOUD trailer hero; also the "build a rocket" stock plan, standing on its pad). File name kept: every
// scene loads examples/rocket.js. A tail-sitter: a sleek faceted wedge of pearl-white ceramic that stands on its tail,
// nose up, and launches straight up on its rear engines (and lands on them again). Premium industrial design, painted:
// a long wedge hull with sharp chamfered edges that tapers to a low chiselled nose; a big tinted glass canopy on its
// back (+z, the front); thin cyan light strips along the chamfers; long ink-dark recessed slots down the lower flanks;
// clean panel lines; two engine nacelles hugging the tail with dark intakes on top; three main engines pointing down
// (one central, one under each nacelle) with glowing throats; four slim landing legs with gold-shod feet.
// Front (+z) = the back of the ship (the dorsal face): the canopy high up and the hatch low down, both facing out.
// The hatch is a hinged group with userData.role 'hatch' (rotate its .rotation.y to about -1.9 to open it outward).
// root.userData.rocket = { height, nozzleY (the engine mouths, the plume pivot), hatchY (the sill), hatchZ, finFoot };
// root.userData.craft = { engines: [{ x, y, z, r }] (each engine mouth, pointing down), canopy: { y, z }, legs }.
function build(api) {
  var g = api.group();
  var PI = Math.PI, i, k, a;
  // painted ramps (dark -> light). BRASS keeps its first stop: the lounge scene reads it as metal.
  var BRASS = ['#5a3a16', '#835a22', '#ad8132', '#c89c45', '#dcb95f'];
  var PEARL = ['#8a8597', '#b2adbb', '#d8d4d3', '#eeeae2', '#fbf8f2'];    // white ceramic, violet-cool in shadow
  var DEEP = ['#0e1124', '#161a33', '#20263f', '#2c344f'];               // ink-dark recesses, intakes, engines
  var GLASS = ['#0f1a2c', '#16283e', '#21405a', '#3f6f86', '#8fc3cf'];   // the tinted canopy
  var CYAN = ['#2fb3cf', '#5fd0e4', '#9fe6f2', '#dcfbff'];              // light strips, lit from inside
  var ULTRA = ['#11173a', '#1a2459', '#25357c', '#31479b', '#4560b0'];   // a fine accent only

  // ---- a loft: rows of closed (or open) outlines in the xz plane at heights y, skinned with flat facets ----
  // rows: [{ y, p: [[x, z], ...] }], every row with the same number of points. The lathe's grid is re-used as the
  // skin (its column c, row j -> point c of row j), then unshared so every facet takes its own painted light.
  function loft(rows, ramp, open, speck) {
    var n = rows[0].p.length, seg = open ? n - 1 : n, np = rows.length, pts = [], j;
    for (j = 0; j < np; j++) pts.push([1, j]);
    var m = api.lathe({ points: pts, seg: seg, ramp: ramp, speck: speck === undefined ? 0.05 : speck });
    var p = m.geometry.attributes.position, idx, c, r, q;
    for (idx = 0; idx < p.count; idx++) {
      c = Math.floor(idx / np); r = idx % np; q = rows[r].p[c % n];
      p.setXYZ(idx, q[0], rows[r].y, q[1]);
    }
    var geo = m.geometry.toNonIndexed(); geo.computeVertexNormals(); m.geometry = geo;
    return m;
  }
  function scaled(p, s, cx, cz) { return p.map(function (q) { return [cx + (q[0] - cx) * s, cz + (q[1] - cz) * s]; }); }

  // ---- the hull's section at height y: a chamfered wedge (dorsal deck, shoulder chamfer, flank, belly chamfer) ----
  var Y0 = 1.9, Y1 = 17.4;
  function prm(y) {
    var t = Math.max(0, Math.min(1, (y - Y0) / (Y1 - Y0)));
    return {
      t: t,
      W: 2.05 * Math.pow(Math.max(0, 1 - Math.pow(t, 1.25)), 0.55) + 0.03,     // half-width
      D: 1.12 * Math.pow(Math.max(0, 1 - Math.pow(t, 1.4)), 0.6) + 0.04,       // dorsal height (+z)
      B: 0.84 * Math.pow(Math.max(0, 1 - Math.pow(t, 1.5)), 0.5) + 0.04,       // belly depth (-z)
      c: -0.3 * t * t * t                                                       // the nose dips toward the belly
    };
  }
  // ten corners, from the dorsal centre round the +x side to the belly and back up the -x side
  function sect(y, grow) {
    var s = prm(y), W = s.W + (grow || 0), D = s.D + (grow || 0), B = s.B + (grow || 0), c = s.c;
    return [[0, c + D], [0.55 * W, c + D], [W, c + 0.3 * D], [W, c - 0.25 * B], [0.66 * W, c - B],
            [0, c - B], [-0.66 * W, c - B], [-W, c - 0.25 * B], [-W, c + 0.3 * D], [-0.55 * W, c + D]];
  }
  function hullRows(ya, yb, n, grow) {
    var rows = [], j, y;
    for (j = 0; j <= n; j++) { y = ya + (yb - ya) * j / n; rows.push({ y: y, p: sect(y, grow) }); }
    return rows;
  }
  // a band of the hull's skin over corners a..b (an open strip), lifted `grow` off it: panels, slots, strips
  function band(ya, yb, a, b, ramp, grow, n) {
    var rows = [], j, y, full;
    for (j = 0; j <= (n || 8); j++) { y = ya + (yb - ya) * j / (n || 8); full = sect(y, grow); rows.push({ y: y, p: full.slice(a, b + 1) }); }
    return loft(rows, ramp, true, 0.03);
  }
  // a narrow strip on the facet between corners k and k+1 (fractions f0..f1 across it)
  function slot(ya, yb, k, f0, f1, ramp, grow) {
    var rows = [], j, y, P, q0, q1;
    for (j = 0; j <= 8; j++) {
      y = ya + (yb - ya) * j / 8; P = sect(y, grow); q0 = P[k]; q1 = P[(k + 1) % P.length];
      rows.push({ y: y, p: [[q0[0] + (q1[0] - q0[0]) * f0, q0[1] + (q1[1] - q0[1]) * f0], [q0[0] + (q1[0] - q0[0]) * f1, q0[1] + (q1[1] - q0[1]) * f1]] });
    }
    return loft(rows, ramp, true, 0.03);
  }
  // a point on the hull's corner k at height y, pushed `out` along the outward direction
  function corner(k, y, out) { var p = sect(y, out || 0)[k]; return [p[0], y, p[1]]; }

  // ---- the hull: the tail cap, the long faceted wedge, the nose ----
  var rows = [{ y: Y0, p: scaled(sect(Y0), 0.001, 0, prm(Y0).c) }].concat(hullRows(Y0, Y1 - 0.25, 22));
  rows.push({ y: Y1, p: scaled(sect(Y1 - 0.25), 0.02, 0, prm(Y1).c) });
  g.add(loft(rows, PEARL));
  g.add(loft([{ y: Y0 - 0.03, p: scaled(sect(Y0), 0.001, 0, 0) }, { y: Y0 - 0.03, p: scaled(sect(Y0), 0.86, 0, 0) }], DEEP));   // the dark tail plate
  g.add(api.cylinder({ rt: 0.01, rb: 0.035, h: 0.9, y: Y1 + 0.4, z: prm(Y1).c, ramp: BRASS, seg: 8 }));   // the sensor needle
  // panel lines: three clean rings round the hull
  var ringsY = [5.5, 8.9, 14.6];
  for (i = 0; i < 3; i++) {
    var ring = sect(ringsY[i], 0.012).map(function (q) { return [q[0], ringsY[i], q[1]]; });
    ring.push(ring[0]);
    g.add(api.tube({ points: ring, r: 0.016, seg: 60, radial: 4, ramp: DEEP }));
  }

  // ---- the long ink-dark recessed slots down both lower flanks, each with a cyan line inside ----
  g.add(band(2.3, 11.2, 3, 4, DEEP, 0.012, 10));
  g.add(band(2.3, 11.2, 6, 7, DEEP, 0.012, 10));
  function strip(k, ya, yb, out, r) {
    var pts = [], j; for (j = 0; j <= 10; j++) pts.push(corner(k, ya + (yb - ya) * j / 10, out));
    return api.tube({ points: pts, r: r || 0.032, seg: 30, radial: 6, ramp: CYAN });
  }
  // ---- ink-dark recessed chines along both shoulder chamfers (they frame the deck from the front), cyan inside ----
  g.add(slot(3.0, 10.4, 1, 0.15, 0.95, DEEP, 0.012));
  g.add(slot(3.0, 10.4, 8, 0.05, 0.85, DEEP, 0.012));
  function mid(k1, k2, y, out) { var p1 = corner(k1, y, out), p2 = corner(k2, y, out); return [(p1[0] + p2[0]) / 2, y, (p1[2] + p2[2]) / 2]; }
  function line(k1, k2, ya, yb, out, r) {
    var pts = [], j; for (j = 0; j <= 10; j++) pts.push(mid(k1, k2, ya + (yb - ya) * j / 10, out));
    return api.tube({ points: pts, r: r, seg: 30, radial: 6, ramp: CYAN });
  }
  g.add(line(1, 2, 3.3, 10.1, 0.03, 0.04)); g.add(line(8, 9, 3.3, 10.1, 0.03, 0.04));
  g.add(line(3, 4, 2.6, 10.9, 0.03, 0.035)); g.add(line(6, 7, 2.6, 10.9, 0.03, 0.035));
  g.add(strip(2, 10.9, 14.2, 0.025, 0.03)); g.add(strip(8, 10.9, 14.2, 0.025, 0.03));

  // ---- the canopy: a big tinted glass bubble on the deck, framed in pearl, a gold hairline, a reflection ----
  var CY = 12.15, cs = prm(CY), CZ = cs.c + cs.D - 0.08;
  // a teardrop: elliptic sections, widest low, tapering up toward the nose, bulging off the deck
  var cr = [], CL = 5.6, C0 = CY - 2.5, j2, u2, wv, hv, yy, sc2, ell;
  for (j2 = 0; j2 <= 12; j2++) {
    u2 = j2 / 12; yy = C0 + CL * u2;
    wv = Math.sin(Math.min(1, u2 * 3.2) * PI / 2) * Math.pow(1 - u2, 0.55); hv = wv;
    sc2 = prm(yy); ell = [];
    for (k = 0; k < 16; k++) { a = k / 16 * 2 * PI; ell.push([Math.sin(a) * sc2.W * 0.8 * wv + 0.0001, sc2.c + sc2.D - 0.12 + Math.cos(a) * 0.66 * hv]); }
    cr.push({ y: yy, p: ell });
  }
  g.add(loft(cr, GLASS, false, 0.02));
  var fr = [];
  for (j2 = 0; j2 <= 24; j2++) {   // the frame: round the teardrop where it meets the deck, both sides
    u2 = j2 / 24; yy = C0 + CL * u2; sc2 = prm(yy);
    wv = Math.sin(Math.min(1, u2 * 3.2) * PI / 2) * Math.pow(1 - u2, 0.55);
    fr.push([sc2.W * 0.8 * wv + 0.05, yy, sc2.c + sc2.D + 0.02]);
  }
  fr = fr.concat(fr.slice(0, -1).reverse().map(function (q) { return [-q[0], q[1], q[2]]; }));
  g.add(api.tube({ points: fr, r: 0.055, seg: 90, radial: 6, ramp: PEARL }));
  g.add(api.tube({ points: fr.map(function (q) { return [q[0] * 1.06, q[1] - 0.03, q[2] + 0.01]; }), r: 0.016, seg: 90, radial: 4, ramp: BRASS }));

  // ---- two side viewports on each flank, at the canopy's height (the folk look out of these too) ----
  var vy = [10.7, 12.0, 13.2], s1, s2;
  for (i = 0; i < 3; i++) {
    g.add(band(vy[i] - 0.38, vy[i] + 0.38, 2, 3, GLASS, 0.014, 2));
    g.add(band(vy[i] - 0.38, vy[i] + 0.38, 7, 8, GLASS, 0.014, 2));
  }

  // ---- the hatch: a tall rounded door low on the deck, in an ink-dark frame, with a cyan threshold ----
  var HW = 1.0, HH = 2.05, HY = 3.6, hz = prm(HY + 1.0).D + prm(HY + 1.0).c + 0.05;
  function door(w, h, r) {
    var sh = new api.THREE.Shape(), x = w / 2;
    sh.moveTo(-x + r, 0); sh.lineTo(x - r, 0); sh.quadraticCurveTo(x, 0, x, r); sh.lineTo(x, h - r); sh.quadraticCurveTo(x, h, x - r, h);
    sh.lineTo(-x + r, h); sh.quadraticCurveTo(-x, h, -x, h - r); sh.lineTo(-x, r); sh.quadraticCurveTo(-x, 0, -x + r, 0);
    return sh.getPoints(6);
  }
  g.add(api.extrude({ shape: door(HW + 0.26, HH + 0.26, 0.32), depth: 0.3, y: HY - 0.13, z: hz - 0.1, ramp: DEEP }));
  g.add(api.box({ w: HW + 0.1, h: 0.05, d: 0.08, y: HY - 0.04, z: hz + 0.06, ramp: CYAN }));
  var hatch = api.group({ x: -HW / 2, y: HY, z: hz + 0.06 });
  hatch.userData.role = 'hatch';
  hatch.add(api.extrude({ shape: door(HW - 0.03, HH - 0.02, 0.28), depth: 0.08, x: HW / 2, ramp: PEARL }));
  hatch.add(api.box({ w: 0.5, h: 0.04, d: 0.04, x: HW / 2, y: HH - 0.42, z: 0.05, ramp: CYAN }));          // a light bar
  hatch.add(api.box({ w: 0.05, h: 0.42, d: 0.05, x: HW - 0.17, y: 0.95, z: 0.05, ramp: BRASS }));           // the handle
  g.add(hatch);

  // ---- two engine nacelles hugging the tail: faceted pods with ink-dark intakes on top ----
  var NX = 2.42, NW = 0.6, NT = 7.4, NB = 1.25;
  function pod(w, cx) { var c = w * 0.42; return [[cx - w + c, w], [cx + w - c, w], [cx + w, w - c], [cx + w, -w + c], [cx + w - c, -w], [cx - w + c, -w], [cx - w, -w + c], [cx - w, w - c]]; }
  var engines = [{ x: 0, y: 0.62, z: 0, r: 0.98 }];
  for (i = -1; i <= 1; i += 2) {
    var cx = i * NX, P = pod(NW, cx), Pin = scaled(P, 0.72, cx, 0);
    // a faceted pod that runs up the tail and fairs into the hull's flank
    var nr = [{ y: NB, p: scaled(P, 0.001, cx, 0) }, { y: NB, p: P }, { y: 5.2, p: P }];
    for (k = 1; k <= 5; k++) { var uu = k / 5, sh = pod(NW * (1 - 0.72 * uu * uu), i * (NX - 0.95 * uu)); nr.push({ y: 5.2 + 3.6 * uu, p: sh }); }
    g.add(loft(nr, PEARL));
    // the intake: an ink-dark scoop on the pod's outer face, a cyan lip under it
    g.add(api.box({ w: 0.06, h: 1.1, d: 0.42, x: i * (NX + NW + 0.01), y: 4.5, ramp: DEEP }));
    g.add(api.box({ w: 0.07, h: 0.05, d: 0.42, x: i * (NX + NW + 0.02), y: 3.85, ramp: CYAN }));
    g.add(api.torus({ r: NW * 1.02, tube: 0.03, x: cx, y: 2.4, seg: 8, rot: PI / 8, ramp: ULTRA }));                                // a light band
    // its engine: a bell under the pod with a glowing throat
    g.add(api.lathe({ points: [[0.36, NB], [0.38, NB - 0.15], [0.47, 0.82], [0.56, 0.6]], x: cx, seg: 24, ramp: DEEP }));
    g.add(api.cylinder({ r: 0.34, h: 0.04, x: cx, y: NB - 0.12, ramp: CYAN, seg: 20 }));
    g.add(api.torus({ r: 0.56, tube: 0.03, x: cx, y: 0.6, seg: 24, ramp: CYAN }));
    engines.push({ x: cx, y: 0.6, z: 0, r: 0.56 });
  }
  // the central engine under the tail plate: a wide bell, a nested inner bell, a glowing throat
  g.add(api.lathe({ points: [[0.62, Y0], [0.66, 1.6], [0.84, 1.0], [0.98, 0.62]], seg: 28, ramp: DEEP }));
  g.add(api.lathe({ points: [[0.42, Y0 - 0.05], [0.46, 1.5], [0.6, 1.05]], seg: 24, ramp: DEEP }));
  g.add(api.cylinder({ r: 0.42, h: 0.04, y: 1.6, ramp: CYAN, seg: 24 }));
  g.add(api.torus({ r: 0.97, tube: 0.035, y: 0.63, seg: 32, ramp: CYAN }));

  // ---- four slim landing legs from the nacelles, splayed out, with gold-shod feet ----
  var legs = [];
  for (i = 0; i < 4; i++) {
    var sx = i < 2 ? 1 : -1, sz = i % 2 ? 1 : -1;
    var top = [sx * NX, 3.4, sz * 0.45], knee = [sx * 2.85, 1.6, sz * 1.0], foot = [sx * 3.0, 0.16, sz * 1.38];
    g.add(api.tube({ points: [top, knee, foot], r: 0.075, seg: 12, radial: 6, ramp: PEARL }));
    g.add(api.sphere({ r: 0.11, x: knee[0], y: knee[1], z: knee[2], ramp: DEEP, seg: 10 }));
    g.add(api.cylinder({ rb: 0.3, rt: 0.2, h: 0.16, x: foot[0], y: 0.08, z: foot[2], ramp: BRASS, seg: 14 }));
    legs.push([foot[0], foot[2]]);
  }

  // keylines: one smooth hull, the two pods
  var prox = hullRows(Y0, Y1 - 0.25, 14, 0.0); prox.push({ y: Y1, p: scaled(sect(Y1 - 0.25), 0.02, 0, prm(Y1).c) });
  var pm = loft(prox, PEARL); api.proxy(pm.geometry, g);
  for (i = -1; i <= 1; i += 2) api.proxy(api.boxGeo({ w: 1.2, h: 5.2 - NB, d: 1.2, x: i * NX, y: (5.2 + NB) / 2 }), g);

  g.userData.rocket = { height: Y1 + 0.85, nozzleY: 0.62, hatchY: HY, hatchZ: hz + 0.06, finFoot: 3.3 };
  g.userData.craft = { engines: engines, canopy: { y: CY, z: CZ }, legs: legs, tail: Y0 };
  return g;
}
