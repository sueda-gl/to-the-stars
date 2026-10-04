// ALOUD trailer t6: the ARCH HOUSE (Sueda's reference arch-house.png, a Magritte joke): a tall pink house that bends up
// and over into a giant arch, its far end hanging UPSIDE DOWN (roof and dormers pointing at the ground) above a
// perfectly ordinary little pink house in a white picket fence. Rows of little ink windows follow the curve.
function build(api) {
  var R = api.ramps, g = api.group(), PI = Math.PI, i;
  var pink = api.pick(['#f2a7bd', '#f4b3c5', '#efa0b6']), roof = '#5a5266';
  var Ro = 9.5, Ri = 5.0, D = 5.5, cx = 0, cy = 9.0;   // the arch: outer / inner radius, depth (z), centre height
  // the arch section: a half annulus in the XY plane (left leg down to the ground, the right end hanging at cy)
  var sh = [[-Ro, 0], [-Ro, cy]], k;
  for (k = 1; k <= 24; k++) { var t = PI - k / 24 * PI; sh.push([cx + Math.cos(t) * Ro, cy + Math.sin(t) * Ro]); }
  sh.push([Ri, cy]);
  for (k = 1; k < 24; k++) { var t2 = k / 24 * PI; sh.push([cx + Math.cos(t2) * Ri, cy + Math.sin(t2) * Ri]); }
  sh.push([-Ri, cy], [-Ri, 0]);
  g.add(api.extrude({ shape: sh, depth: D, curveSeg: 28, ramp: pink }));
  // windows: little ink slots on the front face, radial round the arch, and up the leg
  for (i = 0; i < 9; i++) {
    var a = PI - i / 8 * PI, rr = (Ro + Ri) / 2;
    g.add(api.box({ w: 0.5, h: 1.1, d: 0.1, x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr, z: D / 2 + 0.03, rz: a - PI / 2, ramp: R.INK }));
  }
  for (i = 0; i < 3; i++) g.add(api.box({ w: 0.5, h: 1.1, d: 0.1, x: -(Ro + Ri) / 2, y: 2.2 + i * 2.3, z: D / 2 + 0.03, ramp: R.INK }));
  // the hanging end: a gable roof upside down under the right end, two upside-down dormers
  var hx = (Ro + Ri) / 2, hw = Ro - Ri;
  g.add(api.gableRoof({ w: D, d: hw, h: 1.6, overhang: 0.2, x: hx, y: cy, rot: PI / 2, rz: PI, ramp: roof }));
  // the garage at the leg's foot, a door
  g.add(api.box({ w: 3, h: 2.4, d: 3, x: -Ro - 1.6, y: 1.2, z: 0.8, ramp: pink }));
  g.add(api.gableRoof({ w: 3, d: 3, h: 1.0, x: -Ro - 1.6, y: 2.4, z: 0.8, ramp: roof }));
  g.add(api.box({ w: 2.0, h: 1.8, d: 0.1, x: -Ro - 1.6, y: 0.9, z: 2.33, ramp: '#f7efdc' }));
  g.add(api.inkDoor({ w: 0.8, h: 1.6, x: -Ro + 1.2, y: 0, z: D / 2, frame: false }));
  // the ordinary little house underneath the hanging end, in its picket fence
  g.add(api.box({ w: 4.2, h: 2.6, d: 3.6, x: hx, y: 1.3, z: 0, ramp: pink }));
  g.add(api.gableRoof({ w: 4.2, d: 3.6, h: 1.5, overhang: 0.25, x: hx, y: 2.6, ramp: roof }));
  g.add(api.inkDoor({ w: 0.8, h: 1.5, x: hx, y: 0, z: 1.8, frame: false }));
  g.add(api.inkWindow({ w: 0.6, h: 0.7, x: hx - 1.3, y: 1.5, z: 1.8, frame: false }));
  g.add(api.inkWindow({ w: 0.6, h: 0.7, x: hx + 1.3, y: 1.5, z: 1.8, frame: false }));
  g.add(api.fence({ points: [[hx - 3.4, 3.4], [hx + 3.4, 3.4], [hx + 3.4, -3.0]], h: 0.9, ramp: '#f7efdc' }));
  api.proxy(api.boxGeo({ w: 4.2, h: 2.6, d: 3.6, x: hx, y: 1.3 }), g);
  return g;
}
