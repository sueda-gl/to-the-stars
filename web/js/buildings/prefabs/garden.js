// Garden: a little giardino all'italiana. Clipped box hedges frame a square of pale gravel with an entrance
// at the front; a cross of paths divides four raised beds: lavender in rows, sage and red geraniums; a lemon tree
// in a big terracotta pot in the middle; two cypresses guard the back corners. From above it reads as a
// dark-green geometric pattern on pale gravel. Footprint 5 x 5, the entrance faces +z.
export const meta = { id: 'garden', footprint: { w: 5, d: 5 }, height: 3.4 };

const SOIL = ['#4a2e1e', '#6b4129', '#8a5636', '#a06a44', '#b47d52'];

export function build(api) {
  const R = api.ramps, g = api.group();
  const S = 4.8, hw = S / 2, hT = 0.5, hD = 0.34;   // hedge height and thickness

  // the gravel ground
  g.add(api.box({ w: S, h: 0.05, d: S, y: 0.025, ramp: R.SAND, lift: 0.04, speck: 0.22 }));

  // clipped box hedges: back, two sides, and the front split by the entrance
  const hedge = o => g.add(api.box(Object.assign({ h: hT, y: hT / 2, ramp: R.OLIVE, lift: -0.1, speck: 0.3 }, o)));
  hedge({ w: S, d: hD, z: -hw + hD / 2 });
  hedge({ w: hD, d: S - hD * 2, x: -hw + hD / 2 });
  hedge({ w: hD, d: S - hD * 2, x: hw - hD / 2 });
  const gate = 1.1, fw = (S - gate) / 2;
  hedge({ w: fw, d: hD, x: -hw + fw / 2, z: hw - hD / 2 });
  hedge({ w: fw, d: hD, x: hw - fw / 2, z: hw - hD / 2 });

  // four raised beds between the cross of paths
  const path = 0.7, bs = (S - hD * 2 - path) / 2 - 0.22, bo = path / 2 + bs / 2 + 0.06;
  const beds = [[-1, -1, 'lav'], [1, -1, 'herb'], [-1, 1, 'herb'], [1, 1, 'lav']];
  beds.forEach(([sx, sz, kind]) => {
    const cx = sx * bo, cz = sz * bo;
    g.add(api.box({ w: bs + 0.12, h: 0.16, d: bs + 0.12, x: cx, y: 0.08, z: cz, ramp: R.LIMESTONE, lift: -0.02 }));   // stone edging
    g.add(api.box({ w: bs, h: 0.04, d: bs, x: cx, y: 0.17, z: cz, ramp: SOIL }));
    if (kind === 'lav') {   // three long rows of lavender, one smooth mound each
      for (let r = 0; r < 3; r++) {
        const z = cz + (r - 1) * bs * 0.32;
        g.add(api.sphere({ r: 0.2, sx: bs * 2.3, sy: 1.15, x: cx, y: 0.19, z, seg: 18, ramp: R.LAVENDER, lift: api.range(-0.02, 0.06), speck: 0.3 }));
      }
    } else {   // sage mounds round a pot of red geraniums
      for (let k = 0; k < 4; k++) {
        const a = k / 4 * Math.PI * 2 + Math.PI / 4;
        g.add(api.shrub({ r: 0.3, h: 0.34, x: cx + Math.cos(a) * bs * 0.3, y: 0.17, z: cz + Math.sin(a) * bs * 0.3, ramp: R.SAGE, lift: api.range(-0.03, 0.05) }));
      }
      g.add(api.pot({ r: 0.2, x: cx, y: 0.17, z: cz, flowers: R.RED }));
    }
  });

  // the centrepiece: a lemon tree in a big terracotta orcio on a round stone
  g.add(api.cylinder({ r: 0.42, h: 0.12, y: 0.11, seg: 20, ramp: R.LIMESTONE }));
  g.add(api.lathe({ points: [[0.2, 0], [0.3, 0.12], [0.34, 0.42], [0.28, 0.58], [0.31, 0.62], [0.31, 0.68], [0.24, 0.68]], seg: 20, y: 0.17, ramp: R.TERRACOTTA }));
  g.add(api.cylinder({ r: 0.05, h: 0.6, seg: 8, y: 0.85 + 0.3 - 0.02, ramp: R.WOOD }));
  const crownY = 1.45;
  g.add(api.sphere({ r: 0.5, sy: 0.85, y: crownY, seg: 18, ramp: R.OLIVE, lift: 0.04, speck: 0.3 }));
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2 + api.range(-0.3, 0.3), yy = crownY + api.range(-0.2, 0.22), rr = 0.47 * Math.sqrt(1 - Math.pow((yy - crownY) / 0.45, 2));
    g.add(api.colourOnly(api.sphere({ r: 0.075, seg: 8, x: Math.cos(a) * rr, y: yy, z: Math.sin(a) * rr, ramp: R.YELLOW, lift: 0.1 })));
  }

  // two cypresses at the back corners
  g.add(api.cypress({ h: 3.3, x: -hw + 0.3, z: -hw + 0.3 }));
  g.add(api.cypress({ h: api.range(2.8, 3.1), x: hw - 0.3, z: -hw + 0.3 }));
  return g;
}
