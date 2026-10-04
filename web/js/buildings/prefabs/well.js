// Well: a round limestone well-head on a stepped base, dark water in its mouth, two square stone posts
// carrying a little terracotta gable roof, a wooden windlass with a rope and a hanging bucket.
// Footprint 2 x 2, the crank faces +x, the front +z.
export const meta = { id: 'well', footprint: { w: 2, d: 2 }, height: 2.3 };

const DEEP = ['#0f2a36', '#143a4a', '#1b4f62', '#246879'];   // well water: the sea ramp, a shade deeper

export function build(api) {
  const R = api.ramps, g = api.group();
  const stone = api.lambert('#e6d6b8');

  // a round step, the drum, a rolled coping ring, the water
  g.add(api.cylinder({ r: 0.98, h: 0.12, y: 0.06, seg: 28, ramp: R.LIMESTONE, lift: -0.05 }));
  g.add(api.cylinder({ rb: 0.74, rt: 0.7, h: 0.66, y: 0.12 + 0.33, seg: 28, mat: stone }));
  g.add(api.lathe({ points: [[0.52, 0], [0.8, 0], [0.84, 0.07], [0.8, 0.15], [0.52, 0.15], [0.52, 0]], seg: 28, y: 0.78, ramp: R.LIMESTONE }));
  g.add(api.cylinder({ r: 0.53, h: 0.03, y: 0.8, seg: 24, ramp: DEEP, speck: 0.06 }));

  // two square posts on the step, a beam and the terracotta roof
  const px = 0.8, top = 1.78;
  [-1, 1].forEach(s => g.add(api.box({ w: 0.2, h: top - 0.12, d: 0.22, x: s * px, y: 0.12 + (top - 0.12) / 2, z: 0, mat: stone })));
  g.add(api.box({ w: 1.8, h: 0.1, d: 0.3, y: top + 0.05, ramp: R.WOOD }));
  g.add(api.gableRoof({ w: 1.76, d: 0.8, h: 0.46, overhang: 0.12, y: top + 0.1, ramp: R.TERRACOTTA }));

  // the windlass: a log axle between the posts, a crank on the right, rope down to a bucket
  g.add(api.cylinder({ r: 0.09, h: 1.44, seg: 12, y: 1.42, rz: Math.PI / 2, ramp: R.WOOD }));
  g.add(api.box({ w: 0.06, h: 0.3, d: 0.06, x: px + 0.14, y: 1.3, ramp: R.IRON }));
  g.add(api.cylinder({ r: 0.035, h: 0.18, seg: 8, x: px + 0.22, y: 1.18, rz: Math.PI / 2, ramp: R.WOOD }));
  g.add(api.cylinder({ r: 0.018, h: 0.36, seg: 6, x: 0.1, y: 1.17, ramp: R.SAND }));
  const bucket = api.group({ x: 0.1, y: 0.86 });
  bucket.name = 'bucket';
  bucket.add(api.cylinder({ rt: 0.17, rb: 0.13, h: 0.24, seg: 14, y: 0.12, ramp: R.WOOD, lift: 0.05 }));
  bucket.add(api.torus({ r: 0.17, tube: 0.018, seg: 16, y: 0.2, ramp: R.IRON }));
  g.add(bucket);

  // a pot of red geraniums on the step
  g.add(api.pot({ r: 0.17, x: -0.58, y: 0.12, z: 0.7, flowers: R.RED }));

  // keylines: one smooth drum (the coping ring keeps its own: the well's mouth from above)
  api.proxy(api.cylinderGeo({ rb: 0.74, rt: 0.7, h: 0.66, y: 0.45, seg: 28 }), g);
  return g;
}

// the bucket sways a little on its rope
export function animate(obj, t) {
  const b = obj.getObjectByName('bucket');
  if (b) b.rotation.z = Math.sin(t * 1.3) * 0.05;
}
