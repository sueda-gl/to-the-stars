// Bridge: a hump-backed footbridge in red wall, the Red arch's own colour, carried on three round arches (a big
// one in the middle) ringed in pale limestone, a paved limestone walkway, red parapets with stone coping, pointed
// cutwaters on the piers and four stone posts at the ends. y = 0 is the water line. Footprint 8 x 3, spans x.
export const meta = { id: 'bridge', footprint: { w: 8, d: 3 }, height: 2.6 };

export function build(api) {
  const R = api.ramps, T = api.THREE, g = api.group();
  // three r128's Shape has no isShape flag, which api.extrude looks for: tag our own
  const newShape = () => { const s = new T.Shape(); s.isShape = true; return s; };
  const red = api.lambert('#c23a2c', 0.1);
  const L = 7.8, hl = L / 2, y0 = 0.5, ctrl = 3.2;   // deck: a quadratic hump from y0 at the ends
  const deckAt = x => { const t = (hl - x) / L; return (1 - t) * (1 - t) * y0 + 2 * t * (1 - t) * ctrl + t * t * y0; };
  const arches = [[0, 2.4, 0.18], [-2.45, 1.2, 0.12], [2.45, 1.2, 0.12]];   // [centre x, width, spring height]

  // the body: profile with the hump on top and three arch holes, extruded across the bridge
  const N = 20, body = newShape();
  body.moveTo(-hl, 0); body.lineTo(hl, 0);
  for (let i = 0; i <= N; i++) { const x = hl - i * L / N; body.lineTo(x, deckAt(x)); }
  body.lineTo(-hl, 0);
  arches.forEach(([cx, w, sp]) => {
    const r = w / 2, h = new T.Path();
    h.moveTo(cx - r, 0); h.lineTo(cx + r, 0); h.lineTo(cx + r, sp); h.absarc(cx, sp, r, 0, Math.PI, false); h.lineTo(cx - r, 0);
    body.holes.push(h);
  });
  const BD = 2.0;
  g.add(api.extrude({ shape: body, depth: BD, curveSeg: 20, mat: red }));

  // limestone arch rings, proud of both faces
  arches.forEach(([cx, w, sp]) => {
    const r = w / 2, t = w > 2 ? 0.26 : 0.2, ring = newShape();
    ring.moveTo(cx + r + t, 0); ring.lineTo(cx + r + t, sp); ring.absarc(cx, sp, r + t, 0, Math.PI, false); ring.lineTo(cx - r - t, 0);
    ring.lineTo(cx - r, 0); ring.lineTo(cx - r, sp); ring.absarc(cx, sp, r, Math.PI, 0, true); ring.lineTo(cx + r, 0); ring.lineTo(cx + r + t, 0);
    [-1, 1].forEach(s => g.add(api.extrude({ shape: ring, depth: 0.08, curveSeg: 20, z: s * (BD / 2 + 0.03), ramp: R.LIMESTONE, lift: 0.04 })));
  });

  // the walkway (a pale band laid on the hump) and the parapets with their coping, both following the curve
  const band = (top, bottom) => {
    const s = newShape();
    for (let i = 0; i <= N; i++) { const x = -hl + i * L / N; if (i) s.lineTo(x, deckAt(x) + top); else s.moveTo(x, deckAt(x) + top); }
    for (let i = N; i >= 0; i--) { const x = -hl + i * L / N; s.lineTo(x, deckAt(x) + bottom); }
    return s;
  };
  g.add(api.extrude({ shape: band(0.07, -0.02), depth: BD - 0.36, curveSeg: 4, ramp: R.LIMESTONE, lift: 0.02, speck: 0.22 }));
  const pz = BD / 2 - 0.1;
  [-1, 1].forEach(s => {
    g.add(api.extrude({ shape: band(0.5, -0.02), depth: 0.2, z: s * pz, mat: red }));
    g.add(api.extrude({ shape: band(0.58, 0.5), depth: 0.3, z: s * pz, ramp: R.LIMESTONE, lift: 0.06 }));
  });

  // pointed cutwaters on both faces of the two piers (a three-sided prism with a pyramid cap)
  [-1.825, 1.825].forEach(x => [-1, 1].forEach(s => {
    const z = s * (BD / 2 + 0.12);
    g.add(api.cylinder({ r: 0.36, h: 0.8, seg: 3, x, y: 0.4, z, rot: s > 0 ? -Math.PI / 6 : Math.PI / 6, mat: red }));
    g.add(api.cone({ r: 0.36, h: 0.32, seg: 3, x, y: 0.8 + 0.16, z, rot: s > 0 ? -Math.PI / 6 : Math.PI / 6, ramp: R.LIMESTONE }));
  }));

  // four end posts with a ball on top
  [-1, 1].forEach(sx => [-1, 1].forEach(sz => {
    const x = sx * (hl - 0.18), z = sz * pz, base = y0;
    g.add(api.box({ w: 0.36, h: 0.85, d: 0.36, x, y: base + 0.425, z, ramp: R.LIMESTONE }));
    g.add(api.sphere({ r: 0.16, seg: 12, x, y: base + 0.85 + 0.14, z, ramp: R.LIMESTONE, lift: 0.05 }));
  }));

  return g;
}
