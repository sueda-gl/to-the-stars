// Campfire: the first thing anyone builds. A ring of pale field stones round a dark ember bed, a teepee of
// logs with a cel-painted flame inside, two log benches drawn up to it, a tripod with an iron pot, and a lazy
// wisp of smoke that rises, swells and thins out (animate). Footprint 3.4 x 3.4, the open side faces +z.
export const meta = {
  id: 'campfire', name: 'Campfire', aliases: ['campfires', 'fire', 'bonfire', 'fire pit', 'firepit', 'kamp ateşi', 'ateş', 'şenlik ateşi'],
  category: 'prop', stage: 'camp', footprint: { w: 3.4, d: 3.4 }, height: 3.6,
  desc: 'A ring of stones round a log teepee and a live flame, two log benches and a cooking pot; smoke drifts up.'
};

export function build(api) {
  const R = api.ramps, g = api.group();
  const flameMat = api.clay('#f9cf4a', '#ef8f36', '#d0532e');
  const emberMat = api.clay('#f08a3c', '#d0532e', '#9c3324');

  // the ember bed: a dark disc of ash with a few glowing coals
  g.add(api.cylinder({ r: 0.62, h: 0.07, y: 0.035, ramp: R.INK, speck: 0.3, seg: 18 }));
  for (let i = 0; i < 5; i++) {
    const a = i * 1.3 + 0.4, rr = 0.2 + (i % 3) * 0.12;
    g.add(api.sphere({ r: 0.09, sy: 0.55, x: Math.cos(a) * rr, y: 0.08, z: Math.sin(a) * rr, ramp: R.RED, lift: 0.1, seg: 8 }));
  }

  // the stone ring: nine squat field stones, each with its own pencil line
  const n = 9, ringR = 0.78;
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2 + api.range(-0.12, 0.12), s = api.range(0.85, 1.15);
    g.add(api.sphere({ r: 0.21 * s, sx: 1.35, sy: 0.72, sz: 1.0, x: Math.cos(a) * ringR, y: 0.12 * s, z: Math.sin(a) * ringR,
      rot: -a, ramp: api.pick([R.LIMESTONE, R.LIMESTONE, R.STONE]), lift: api.range(-0.12, 0.06), speck: 0.3, seg: 12 }));
  }

  // a teepee of five logs leaning in over the coals
  for (let i = 0; i < 5; i++) {
    const leg = api.group({ rot: i / 5 * Math.PI * 2 + 0.3 });
    leg.add(api.cylinder({ rb: 0.075, rt: 0.05, h: 1.05, y: 0.42, z: 0.27, rx: -0.5, ramp: R.WOOD, lift: 0.05 * (i % 2), seg: 8 }));
    g.add(leg);
  }

  // the flame: three cel-painted tongues leaning together, the tallest in the middle (flicker in animate)
  const flame = api.group({ y: 0.06 }); flame.name = 'flame';
  const tongue = [[0, 0], [0.28, 0.08], [0.31, 0.26], [0.22, 0.5], [0.1, 0.76], [0.03, 0.94], [0, 1.0]];
  [[0, 0, 1.15, 0, 0], [0.2, 0.08, 0.8, -0.42, 0.12], [-0.19, -0.07, 0.86, 0.4, -0.12], [0.02, 0.2, 0.62, 0.05, 0.4]].forEach(([x, z, s, rz, rx]) =>
    flame.add(api.lathe({ points: tongue.map(p => [p[0] * (0.75 + s * 0.25), p[1] * s]), seg: 12, x, z, rz, rx, mat: flameMat })));
  flame.add(api.sphere({ r: 0.2, sy: 0.6, y: 0.06, mat: emberMat }));
  g.add(flame);

  // two log benches drawn up to the fire (left and back), each on two little chocks
  const bench = (x, z, rot, L) => {
    const b = api.group({ x, z, rot });
    b.add(api.cylinder({ rb: 0.19, rt: 0.17, h: L, y: 0.3, rz: Math.PI / 2, ramp: R.WOOD, seg: 12 }));
    b.add(api.cylinder({ r: 0.16, h: 0.02, x: L / 2 + 0.005, y: 0.3, rz: Math.PI / 2, color: '#d9b27a', speck: 0.1, seg: 12 }));
    b.add(api.box({ w: 0.2, h: 0.14, d: 0.32, x: -L * 0.32, y: 0.07, ramp: R.WOOD, lift: -0.15 }));
    b.add(api.box({ w: 0.2, h: 0.14, d: 0.32, x: L * 0.32, y: 0.07, ramp: R.WOOD, lift: -0.15 }));
    g.add(b);
  };
  bench(-0.25, -1.45, 0.08, 1.8);
  bench(-1.45, 0.25, Math.PI / 2 - 0.1, 1.5);

  // a cooking tripod over the right edge of the ring, an iron pot hung under it
  const tp = api.group({ x: 0.95, z: 0.55 });
  for (let i = 0; i < 3; i++) {
    const leg = api.group({ rot: i / 3 * Math.PI * 2 });
    leg.add(api.cylinder({ r: 0.03, h: 1.55, y: 0.74, z: 0.25, rx: -0.33, ramp: R.WOOD, seg: 6 }));
    tp.add(leg);
  }
  tp.add(api.cylinder({ r: 0.012, h: 0.5, y: 1.15, ramp: R.IRON, seg: 4 }));
  tp.add(api.sphere({ r: 0.24, sy: 0.8, y: 0.78, ramp: R.IRON, seg: 14 }));
  tp.add(api.torus({ r: 0.2, tube: 0.03, y: 0.94, ramp: R.IRON, seg: 16 }));
  g.add(tp);

  // the smoke: five soft puffs that ride up and thin away (animate); no pencil and no cast shadow, just paint
  const smoke = api.group({ y: 1.0 }); smoke.name = 'smoke';
  for (let i = 0; i < 5; i++) {
    const p = api.sphere({ r: 0.26, sy: 0.8, y: i * 0.45, color: '#d9d2cf', lift: 0.04, speck: 0.06, seg: 12 });
    p.name = 'puff' + i; p.castShadow = false; api.colourOnly(p); smoke.add(p);
  }
  g.add(smoke);
  return g;
}

// smoke rises from the flame, drifts a little to the right, swells, then shrinks away at the top; the flame breathes
export function animate(obj, t) {
  const smoke = obj.getObjectByName('smoke');
  if (smoke) for (let i = 0; i < 5; i++) {
    const p = smoke.getObjectByName('puff' + i); if (!p) continue;
    const k = (t * 0.2 + i / 5) % 1, s = Math.sin(Math.PI * Math.min(1, 0.12 + k)) * (0.6 + k * 1.1);
    p.position.set(Math.sin(k * 3.2 + i) * 0.14 + k * k * 0.8, k * 2.3, -k * 0.2);
    p.scale.setScalar(Math.max(0.01, s));
  }
  const f = obj.getObjectByName('flame');
  if (f) { f.scale.y = 1 + 0.12 * Math.sin(t * 9.1) + 0.06 * Math.sin(t * 23.7); f.rotation.y = t * 0.8; }
}
