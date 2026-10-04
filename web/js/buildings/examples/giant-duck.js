// THE GIANT RUBBER DUCK (stock plan for "a giant rubber duck"): ~8 m long, 6.5 m tall, clay cel paint like the
// folk's toys. A plump body with a lifted tail, a round chest, wing lozenges, a big head, a two-part orange beak,
// ink eyes with a glint. It floats: the water line is y = 1.1 (api.floats) and it bobs. Front (+z) = the beak.
function build(api) {
  var g = api.group();
  var Y = api.clay('#f6cf3a', '#e5a537', '#b9673a');       // yellow: lit / shade / deep
  var O = api.clay('#f08a3c', '#d4612f', '#9c3f2a');       // beak
  var W = api.clay('#fbf3dc', '#e6d5b2', '#b9a27e');       // eye glints
  var K = api.ramps.INK;
  // body: one long egg, squashed so the keel sits in the water
  g.add(api.sphere({ r: 3.0, sx: 0.92, sy: 0.66, sz: 1.22, y: 2.0, mat: Y, seg: 40 }));
  // the chest swelling forward and the tail lifted at the back (-z)
  g.add(api.sphere({ r: 1.9, sy: 0.85, y: 2.35, z: 1.85, mat: Y, seg: 32 }));
  g.add(api.sphere({ r: 1.35, sx: 1.0, sy: 0.75, sz: 1.2, y: 3.15, z: -3.0, rx: 0.5, mat: Y, seg: 28 }));
  g.add(api.cone({ r: 0.9, h: 1.5, y: 3.85, z: -3.75, rx: -0.85, mat: Y, seg: 24 }));
  // wings: two flat lozenges on the flanks, tips raised toward the tail
  g.add(api.sphere({ r: 1.4, sx: 0.32, sy: 0.62, sz: 1.35, x: 2.25, y: 2.7, z: -0.45, rx: 0.15, rot: -0.08, mat: Y, seg: 24 }));
  g.add(api.sphere({ r: 1.4, sx: 0.32, sy: 0.62, sz: 1.35, x: -2.25, y: 2.7, z: -0.45, rx: 0.15, rot: 0.08, mat: Y, seg: 24 }));
  // neck and head
  g.add(api.sphere({ r: 1.45, sy: 0.9, y: 3.85, z: 1.6, mat: Y, seg: 28 }));
  g.add(api.sphere({ r: 1.85, y: 5.0, z: 1.85, mat: Y, seg: 36 }));
  // the beak: a broad flat upper bill and a smaller lower one, slightly open
  g.add(api.sphere({ r: 0.95, sx: 1.05, sy: 0.34, sz: 1.15, y: 4.55, z: 3.55, rx: -0.08, mat: O, seg: 28 }));
  g.add(api.sphere({ r: 0.8, sx: 0.9, sy: 0.26, sz: 0.95, y: 4.22, z: 3.35, rx: 0.12, mat: O, seg: 24 }));
  // eyes: ink ovals with a small glint, set wide on the head's front
  var ex = [0.85, -0.85], i;
  for (i = 0; i < 2; i++) {
    g.add(api.sphere({ r: 0.3, sy: 1.25, sz: 0.6, x: ex[i], y: 5.5, z: 3.32, rot: ex[i] * 0.45, ramp: K, seg: 16 }));
    g.add(api.sphere({ r: 0.09, x: ex[i] - 0.06, y: 5.67, z: 3.47, mat: W, seg: 10 }));
  }
  // keylines: body, head and the chest as three smooth masses
  api.proxy(api.sphereGeo({ r: 3.02, sx: 0.92, sy: 0.66, sz: 1.22, y: 2.0, seg: 32 }), g);
  api.proxy(api.sphereGeo({ r: 1.87, y: 5.0, z: 1.85, seg: 28 }), g);
  api.bob(g, { amp: 0.1, speed: 0.7 });
  api.floats(g, { line: 1.1 });
  return g;
}
