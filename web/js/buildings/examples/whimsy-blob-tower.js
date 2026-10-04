// ALOUD trailer t6: the BLOB TOWER (Sueda's reference blob-tower.png): soft stacked blobby volumes, each pushed a little
// off the axis, colour-blocked lemon, lilac, coral, pink and cream (no green with the lemon, §13); round and oval ink
// portholes, a striped panel, a coral archway, and little balls and a star floating round the top.
function build(api) {
  var R = api.ramps, g = api.group(), PI = Math.PI, i;
  var pal = api.rand() < 0.5 ? ['#f5d468', '#c4aef0', '#f08f74', '#f6b3c4', '#f7efdc'] : ['#f6b3c4', '#9fb8f2', '#f7efdc', '#c4aef0', '#f08f74'];
  var y = 0, blobs = [];
  var n = 4 + Math.floor(api.rand() * 2);
  for (i = 0; i < n; i++) {
    var r = 4.0 - i * 0.4 + api.range(-0.3, 0.3), h = r * api.range(0.85, 1.05);
    var ox = api.range(-1.0, 1.0), oz = api.range(-0.8, 0.8), c = pal[i % pal.length];
    // a pillowy volume: a fat squashed ball over a soft drum, and a smaller ball of another colour bulging out of its side
    g.add(api.cylinder({ r: r * 0.88, h: h * 0.7, x: ox, y: y + h * 0.4, z: oz, ramp: c, seg: 26 }));
    g.add(api.sphere({ r: r, sy: 0.62, x: ox, y: y + h * 0.62, z: oz, ramp: c, seg: 26 }));
    var sa = api.range(0, Math.PI * 2), sr = r * api.range(0.45, 0.6);
    g.add(api.sphere({ r: sr, x: ox + Math.sin(sa) * r * 0.85, y: y + h * 0.55, z: oz + Math.cos(sa) * r * 0.85, ramp: pal[(i + 3) % pal.length], seg: 20 }));
    blobs.push({ x: ox, z: oz, r: r, y0: y, y1: y + h });
    // portholes: one big round one framed in another colour, one oval
    var a1 = api.range(-0.7, 0.7), a2 = a1 + api.range(1.4, 2.4), rr = r * 0.98;
    g.add(api.cylinder({ r: r * 0.36, h: 0.5, rx: PI / 2, rot: a1, x: ox + Math.sin(a1) * rr, y: y + h * 0.6, z: oz + Math.cos(a1) * rr, ramp: pal[(i + 2) % pal.length], seg: 20 }));
    g.add(api.cylinder({ r: r * 0.26, h: 0.6, rx: PI / 2, rot: a1, x: ox + Math.sin(a1) * (rr + 0.05), y: y + h * 0.6, z: oz + Math.cos(a1) * (rr + 0.05), ramp: R.INK, seg: 20 }));
    g.add(api.cylinder({ r: r * 0.18, h: 0.5, sx: 1.7, rx: PI / 2, rot: a2, x: ox + Math.sin(a2) * rr, y: y + h * 0.6, z: oz + Math.cos(a2) * rr, ramp: R.INK, seg: 16 }));
    y += h * 0.95;
  }
  // a striped panel up one side, a coral arch at the foot
  for (i = 0; i < 5; i++) g.add(api.box({ w: 0.28, h: 3.2, d: 0.4, x: -3.6 + i * 0.5, y: 4.5, z: 3.7, ramp: i % 2 ? '#f7efdc' : '#f08f74' }));
  g.add(api.cylinder({ r: 1.7, h: 1.0, rx: PI / 2, x: 0, y: 1.7, z: 3.9, ramp: '#f08f74', seg: 20 }));
  g.add(api.box({ w: 3.4, h: 1.7, d: 1.0, x: 0, y: 0.85, z: 3.9, ramp: '#f08f74' }));
  g.add(api.inkDoor({ w: 1.6, h: 2.6, y: 0, z: 4.42, arched: true, frame: false }));
  // the floating things: balls and a star round the top
  var top = y;
  g.add(api.sphere({ r: 0.9, x: 3.2, y: top + 1.6, z: 1.0, ramp: pal[2] }));
  g.add(api.sphere({ r: 0.55, x: -2.6, y: top + 2.6, z: -0.6, ramp: pal[1] }));
  g.add(api.sphere({ r: 0.4, x: 0.8, y: top + 3.6, z: 2.0, ramp: pal[3] }));
  g.add(api.box({ w: 1.1, h: 1.1, d: 1.1, x: -3.4, y: top + 0.6, z: 2.4, rx: 0.6, rz: 0.5, ramp: pal[0] }));
  for (i = 0; i < blobs.length; i++) { var b = blobs[i]; api.proxy(api.cylinderGeo({ r: b.r * 0.95, h: b.y1 - b.y0, x: b.x, y: (b.y0 + b.y1) / 2, z: b.z, seg: 16 }), g); }
  return g;
}
