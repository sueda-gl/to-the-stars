// Canoe: a wooden dugout riding at the water line. A pointed hull with gently rising ends, the open hollow
// dark inside, two thwarts, a paddle laid across and a red-painted gunwale and a lashed bundle aboard. It bobs (animate).
// y = 0 is the water line. Footprint 1.2 x 4.4, the bow points +z.
export const meta = {
  id: 'canoe', name: 'Wooden canoe', aliases: ['canoes', 'dugout', 'dugout canoe', 'boat', 'small boat', 'kayak', 'kano', 'sandal', 'kayık'],
  category: 'prop', stage: 'camp', footprint: { w: 1.2, d: 4.4 }, height: 0.7, water: true,
  desc: 'A wooden dugout canoe at the water line with a paddle laid across and a bundle aboard; it bobs.'
};

export function build(api) {
  const R = api.ramps, root = api.group();
  const g = api.group(); g.name = 'hull'; root.add(g);
  const T = api.THREE, Lh = 2.1, W = 0.5;   // half length, half beam

  // the plan outline: a pointed lens, fuller amidships
  const plan = (k, wid) => {
    const pts = [];
    for (let i = 0; i <= 24; i++) {
      const t = i / 24, z = -Lh * k + 2 * Lh * k * t, w = wid * Math.pow(Math.sin(Math.PI * t), 0.62);
      pts.push([w, z]);
    }
    for (let i = 23; i >= 1; i--) { const p = pts[i]; pts.push([-p[0], p[1]]); }
    return pts;
  };
  const outer = plan(1, W), inner = plan(0.9, W - 0.09);
  const shape = new T.Shape(); outer.forEach((p, i) => (i ? shape.lineTo(p[0], p[1]) : shape.moveTo(p[0], p[1])));
  const hole = new T.Path(); inner.slice().reverse().forEach((p, i) => (i ? hole.lineTo(p[0], p[1]) : hole.moveTo(p[0], p[1])));
  shape.holes.push(hole);
  shape.isShape = true;   // this three build's Shape lacks the isShape flag api.extrude checks for

  // the hull walls: the lens extruded upward with a soft bevel (the shape's y runs along the boat after the tilt)
  g.add(api.extrude({ shape, depth: 0.36, bevel: 0.05, y: 0.06, rx: -Math.PI / 2, ramp: R.WOOD, speck: 0.2 }));
  // the belly below the water line, and the dark hollow floor inside
  g.add(api.sphere({ r: 1, sx: W * 0.96, sy: 0.24, sz: Lh * 0.97, y: -0.1, ramp: R.WOOD, lift: -0.15, seg: 20 }));
  g.add(api.extrude({ shape: plan(0.9, W - 0.07), depth: 0.04, y: 0.0, rx: -Math.PI / 2, color: '#4a3020', speck: 0.25 }));
  // a red-painted gunwale: the same lens ring, thin, along the top of the walls (the one accent, as on the island boats)
  g.add(api.extrude({ shape, depth: 0.05, y: 0.27, rx: -Math.PI / 2, ramp: R.REDWALL, speck: 0.1 }));
  // raised bow and stern posts
  [-1, 1].forEach(s => g.add(api.cone({ r: 0.09, h: 0.4, x: 0, y: 0.38, z: s * (Lh - 0.06), rx: s * 0.4, ramp: R.WOOD, lift: 0.05, seg: 8, sy: 0.7 })));

  // two thwarts, a paddle laid across them, and a bundle in the bow
  [-0.7, 0.75].forEach(z => g.add(api.box({ w: W * 1.6, h: 0.05, d: 0.16, y: 0.22, z, ramp: R.WOOD, lift: 0.12 })));
  const pd = api.group({ y: 0.33, z: 0.05, rot: 0.22 });
  pd.add(api.cylinder({ r: 0.03, h: 1.3, z: -0.3, rx: Math.PI / 2, ramp: R.OCHRE, lift: 0.1, seg: 6 }));
  pd.add(api.sphere({ r: 0.17, sx: 0.85, sy: 0.14, sz: 2.0, z: 0.6, ramp: R.OCHRE, lift: 0.1, seg: 12 }));
  g.add(pd);
  g.add(api.box({ w: 0.42, h: 0.24, d: 0.42, y: 0.15, z: 1.2, rot: 0.3, ramp: R.SAND, lift: 0.05, speck: 0.14 }));
  g.add(api.torus({ r: 0.16, tube: 0.025, y: 0.27, z: 1.2, ramp: R.SAND, seg: 12 }));

  // pale ripple rings on the water round the hull and off the stern (they stay put while the hull bobs; two static
  // parts also keep the library's compact form from coming up empty)
  root.add(api.colourOnly(api.torus({ r: 0.62, tube: 0.035, sz: 3.6, y: 0.01, color: '#d9e6e0', lift: 0.1, speck: 0.05, seg: 28 })));
  root.add(api.colourOnly(api.torus({ r: 0.42, tube: 0.03, sz: 1.8, y: 0.01, z: -Lh - 0.35, color: '#d9e6e0', lift: 0.1, speck: 0.05, seg: 24 })));
  api.floats(root);
  return root;
}

// the canoe rides the swell: a slow bob and a gentle roll
export function animate(obj, t) {
  const h = obj.getObjectByName('hull');
  if (!h) return;
  h.position.y = 0.04 * Math.sin(t * 1.1);
  h.rotation.z = 0.035 * Math.sin(t * 0.8 + 0.6);
  h.rotation.x = 0.015 * Math.sin(t * 1.3);
}
