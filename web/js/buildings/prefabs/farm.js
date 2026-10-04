// Farm: a field in stripes of standing wheat, greens and reaped stubble with golden stooks (the moodboard's
// green / ochre bands, read from above), a dry-stone wall along the back and the lit side, a whitewashed field
// barn with a terracotta roof in the back corner, a golden haystack and two cypresses. Footprint 8 x 6, the field's open side and the barn door face +z.
export const meta = { id: 'farm', footprint: { w: 8, d: 6 }, height: 4.6 };

export function build(api) {
  const R = api.ramps, g = api.group();

  // the tilled ground: one low soil slab under the whole field
  g.add(api.box({ w: 5.5, h: 0.12, d: 5.5, x: -1.15, y: 0.06, z: 0.05, color: '#8f6b45', speck: 0.22 }));

  // the field in bands, as the painter sees it from above: a broad flat block of wheat, three low rows of
  // greens (tapered spindles, so their ends sink into the soil)
  const len = 5.0;
  g.add(api.box({ w: 1.85, h: 0.5, d: len, x: -2.85, y: 0.12 + 0.25, z: 0.05, ramp: R.GOLD, speck: 0.3 }));
  const row = [[0, 0], [0.3, 0.55], [0.32, len / 2], [0.3, len - 0.55], [0, len]];
  for (let i = 0; i < 3; i++)
    g.add(api.lathe({ points: row, x: -1.45 + i * 0.6, y: 0.12, z: 0.05 - len / 2, rx: Math.PI / 2, sz: 0.85, ramp: R.OLIVE, speck: 0.32, lift: 0.04 * (i % 2), seg: 12 }));
  // the last band is already reaped: pale stubble with two rows of golden stooks standing in it
  g.add(api.box({ w: 1.5, h: 0.08, d: len, x: 0.6, y: 0.12 + 0.04, z: 0.05, color: '#cdb06a', speck: 0.3 }));
  for (let r = 0; r < 2; r++) for (let i = 0; i < 4; i++)
    g.add(api.cone({ r: 0.24, h: 0.62, x: 0.25 + r * 0.7, y: 0.2 + 0.31, z: -1.85 + i * 1.25 + r * 0.6, rot: i * 0.7, seg: 7, ramp: R.GOLD, lift: 0.05 * ((i + r) % 2) }));

  // dry-stone wall: along the back and down the lit (left, -x) side
  g.add(api.box({ w: 7.8, h: 0.62, d: 0.42, x: 0, y: 0.31, z: -2.79, ramp: R.LIMESTONE, speck: 0.34, lift: -0.08 }));
  g.add(api.box({ w: 0.42, h: 0.55, d: 4.4, x: -3.89, y: 0.275, z: -0.37, ramp: R.LIMESTONE, speck: 0.34, lift: -0.08 }));
  // a low wooden fence closes the front, with a gap for the path
  g.add(api.fence({ points: [[-3.9, 2.85], [-0.6, 2.85]], h: 0.7, gap: 1.1 }));

  // the field barn: whitewash, terracotta gable with the ridge running back (gable end to the front)
  const bx = 2.65, bz = -1.15, bw = 2.3, bd = 2.6, bh = 2.1;
  g.add(api.box({ w: bw + 0.3, h: 0.2, d: bd + 0.3, x: bx, y: 0.1, z: bz, ramp: R.LIMESTONE }));
  g.add(api.box({ w: bw, h: bh, d: bd, x: bx, y: 0.2 + bh / 2, z: bz, mat: api.lambert('#efe4d2') }));
  g.add(api.gableRoof({ w: bd, d: bw, h: 0.95, overhang: 0.22, x: bx, y: 0.2 + bh, z: bz, rot: Math.PI / 2, ramp: R.TERRACOTTA }));
  // wide barn door (square-headed, ink) and a little loft window on the gable
  g.add(api.inkDoor({ w: 1.15, h: 1.5, x: bx, y: 0.2, z: bz + bd / 2, arched: false, frame: R.WOOD }));
  g.add(api.inkWindow({ w: 0.42, h: 0.42, x: bx - 1.15, y: 1.45, z: bz + 0.3, rot: -Math.PI / 2, frame: false }));

  // a golden haystack in front of the barn, and two cypresses behind it
  g.add(api.cylinder({ rb: 0.78, rt: 0.72, h: 0.7, x: 2.75, y: 0.35, z: 1.55, ramp: R.GOLD, speck: 0.3, seg: 18 }));
  g.add(api.dome({ r: 0.74, h: 0.9, x: 2.75, y: 0.7, z: 1.55, ramp: R.GOLD, seg: 18 }));
  g.add(api.cypress({ h: 4.4, x: 3.55, z: -2.45 }));
  g.add(api.cypress({ h: 3.4, x: 1.55, z: -2.55 }));

  // keylines: one box for the barn; the haystack as one drum + cap
  api.proxy(api.boxGeo({ w: bw, h: bh, d: bd, x: bx, y: 0.2 + bh / 2, z: bz }), g);
  api.proxy(api.cylinderGeo({ rb: 0.78, rt: 0.6, h: 1.55, x: 2.75, y: 0.78, z: 1.55, seg: 18 }), g);
  return g;
}
