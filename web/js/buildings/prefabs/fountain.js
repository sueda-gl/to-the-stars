// Fountain: a round limestone basin on a step, sea-blue water, a turned pedestal lifting a shallow bowl,
// four jets leaping from bronze spouts on the lip, a gilt pine-cone finial. Ripple rings run out across the water.
// Footprint 3 x 3.
export const meta = { id: 'fountain', footprint: { w: 3, d: 3 }, height: 2.3 };

const WATER = ['#1d5d72', '#287e92', '#3f9aaa', '#62b3ba', '#8ccac6'];
const SPRAY = ['#4f9fb0', '#6db5bf', '#93cbc9', '#bfe0d8'];

export function build(api) {
  const R = api.ramps, g = api.group();
  const stone = api.lambert('#e6d7bb');

  // the step and the basin (a turned ring: outer wall, rolled lip, inner wall)
  g.add(api.cylinder({ r: 1.5, h: 0.14, y: 0.07, seg: 32, ramp: R.LIMESTONE, lift: -0.06 }));
  g.add(api.lathe({ points: [[1.02, 0], [1.3, 0], [1.3, 0.38], [1.4, 0.43], [1.4, 0.53], [1.0, 0.53], [1.0, 0]], seg: 32, y: 0.14, mat: stone }));
  const wy = 0.14 + 0.4;
  g.add(api.cylinder({ r: 1.01, h: 0.04, y: wy, seg: 32, ramp: WATER, speck: 0.12 }));

  // ripple rings on the water (animated outward; they start inside the pedestal and end under the lip)
  for (let i = 0; i < 2; i++) {
    const rp = api.torus({ r: 1, tube: 0.022, seg: 32, y: wy + 0.025, ramp: SPRAY, lift: 0.1 });
    rp.name = 'ripple' + i; api.colourOnly(rp); g.add(rp);
  }

  // the pedestal rising out of the water, the bowl, the bowl's water, a stem and the pine-cone finial
  g.add(api.lathe({ points: [[0.34, 0], [0.24, 0.12], [0.17, 0.5], [0.15, 0.85], [0.22, 0.95], [0.08, 1.0]], seg: 20, y: wy, ramp: R.LIMESTONE }));
  const by = wy + 0.95;
  g.add(api.lathe({ points: [[0.06, 0], [0.32, 0.04], [0.6, 0.17], [0.68, 0.26], [0.62, 0.27], [0.4, 0.2]], seg: 28, y: by, ramp: R.LIMESTONE, lift: 0.04 }));
  g.add(api.cylinder({ r: 0.6, h: 0.03, y: by + 0.22, seg: 24, ramp: WATER, lift: 0.04 }));
  g.add(api.lathe({ points: [[0.13, 0], [0.08, 0.1], [0.07, 0.3], [0.12, 0.36], [0.02, 0.4]], seg: 14, y: by + 0.22, ramp: R.LIMESTONE }));
  g.add(api.sphere({ r: 0.13, sy: 1.45, y: by + 0.22 + 0.55, seg: 14, ramp: R.GOLD }));

  // four jets leap from the basin lip and fall back toward the pedestal
  for (let i = 0; i < 4; i++) {
    const a = i / 4 * Math.PI * 2 + Math.PI / 4, c = Math.cos(a), s = Math.sin(a);
    const pts = [[1.08, wy + 0.16], [0.92, wy + 0.5], [0.7, wy + 0.58], [0.5, wy + 0.3], [0.42, wy + 0.04]].map(([r, y]) => [c * r, y, s * r]);
    g.add(api.colourOnly(api.tube({ points: pts, r: 0.04, seg: 14, ramp: SPRAY, lift: 0.1 })));
    g.add(api.sphere({ r: 0.07, sy: 0.7, seg: 10, x: c * 1.12, y: wy + 0.15, z: s * 1.12, ramp: R.GOLD }));   // a little bronze spout
  }

  // keylines: the basin as one smooth drum
  api.proxy(api.cylinderGeo({ r: 1.4, h: 0.53, y: 0.14 + 0.265, seg: 32 }), g);
  return g;
}

// ripples run out from the pedestal to the basin wall, half a cycle apart
export function animate(obj, t) {
  for (let i = 0; i < 2; i++) {
    const rp = obj.getObjectByName('ripple' + i); if (!rp) continue;
    const p = ((t * 0.28 + i * 0.5) % 1);
    const s = 0.3 + p * 0.72;
    rp.scale.set(s, 1, s);
  }
}
