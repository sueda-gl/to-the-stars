// Bathhouse (hamam): a low limestone bath block crowned by a big lime-washed dome over the hot room, flanked by two
// smaller domes over the warm rooms, each dome studded with a few glass "elephant-eye" skylights. In front, an open
// courtyard holds a turquoise plunge pool in a stone rim behind a short arcade, and a furnace chimney at the back
// breathes steam (animate). From above: three pale domes in a row, the turquoise pool and the court.
// Footprint 12 x 10, the court and the entrance face +z.
export const meta = {
  id: 'bathhouse', name: 'Bathhouse',
  aliases: ['bathhouse', 'bathhouses', 'bath house', 'baths', 'bath', 'thermae', 'spa', 'hamam', 'hamamlar', 'hammam', 'kaplıca'],
  category: 'building', stage: 'town', footprint: { w: 12, d: 10 }, height: 7.6,
  desc: 'A domed hamam with three lime-washed domes, a turquoise courtyard pool and a steaming chimney.'
};

export function build(api) {
  const R = api.ramps, g = api.group();
  const stone = api.lambert('#e3d2b4'), lime = R.WHITEWASH;

  // the ground: a limestone platform under bath and court, laid AROUND the pool (no stone under the water:
  // a hidden face a hand below a visible one flickers through it in the painter's depth buffer from far away)
  const P = 0.25, PX = -0.4, PZ = 2.9, PW = 5.2, PD = 2.8, px0 = PX - PW / 2 - 0.3, px1 = PX + PW / 2 + 0.3, pz0 = PZ - PD / 2 - 0.3, pz1 = PZ + PD / 2 + 0.3;
  const slab = (x0, x1, z0, z1) => g.add(api.box({ w: x1 - x0, h: P, d: z1 - z0, x: (x0 + x1) / 2, y: P / 2, z: (z0 + z1) / 2, ramp: R.LIMESTONE }));
  slab(-5.8, 5.8, -4.8, pz0); slab(-5.8, px0, pz0, 4.8); slab(px1, 5.8, pz0, 4.8); slab(px0, px1, pz1, 4.8);

  // the bath block along the back: a long low mass
  const BW = 10.4, BD = 4.6, BZ = -2.2, BH = 3.0;
  g.add(api.box({ w: BW, h: BH, d: BD, y: P + BH / 2, z: BZ, mat: stone }));
  g.add(api.box({ w: BW + 0.24, h: 0.2, d: BD + 0.24, y: P + BH + 0.1, z: BZ, ramp: R.LIMESTONE, lift: 0.05 }));
  const T = P + BH + 0.2;

  // the domes: big over the hot room (centre), two smaller over the warm rooms; each on a short square drum
  const domes = [[0, 2.0, 1.0], [-3.55, 1.35, 0.55], [3.55, 1.35, 0.55]];   // x, radius, drum height
  domes.forEach(([x, r, dh]) => {
    g.add(api.box({ w: r * 2 + 0.2, h: dh, d: r * 2 + 0.2, x, y: T + dh / 2, z: BZ, mat: stone }));
    g.add(api.dome({ r, h: r * 0.92, x, y: T + dh, z: BZ, seg: 28, ramp: lime, lift: 0.02 }));
    // glass skylights: a ring of small bumps on the dome's shoulder (a proxy keeps the line on the dome alone)
    const n = r > 1.5 ? 5 : 0;
    for (let i = 0; i < n; i++) {
      const a = (i + 0.5) / n * Math.PI * 2, rr = r * 0.62, yy = Math.sqrt(Math.max(0, r * r - rr * rr)) * 0.92;
      g.add(api.sphere({ r: 0.09 * r, sy: 0.55, x: x + Math.sin(a) * rr, y: T + dh + yy, z: BZ + Math.cos(a) * rr, ramp: R.SAGE, lift: 0.1, speck: 0.05 }));
    }
    g.add(api.sphere({ r: 0.12, x, y: T + dh + r * 0.92 + 0.05, z: BZ, ramp: R.GOLD }));
    api.proxy(api.sphereGeo({ r: r * 1.02, sy: 0.92, x, y: T + dh, z: BZ, seg: 24 }), g);
  });

  // the entrance: an arched ink door with a stone frame on the court side, small windows beside it
  const front = BZ + BD / 2;
  g.add(api.inkDoor({ w: 1.1, h: 2.1, y: P, z: front, frame: R.LIMESTONE }));
  [-2.4, 2.4, -4.2, 4.2].forEach(x => g.add(api.archOpening({ w: 0.42, h: 0.75, x, y: P + 1.8, z: front, frame: false })));
  g.add(api.archOpening({ w: 0.42, h: 0.75, x: -BW / 2, y: P + 1.8, z: BZ, rot: -Math.PI / 2, frame: false }));

  // the furnace chimney at the back right, with steam puffs
  const cx = 4.4, cz = BZ - 1.6;
  g.add(api.box({ w: 0.7, h: 2.4, d: 0.7, x: cx, y: T + 1.2, z: cz, mat: stone }));
  g.add(api.box({ w: 0.86, h: 0.16, d: 0.86, x: cx, y: T + 2.45, z: cz, ramp: R.TERRACOTTA }));
  for (let i = 0; i < 3; i++) {
    const puff = api.group({ x: cx, y: T + 2.7, z: cz }); puff.name = 'steam' + i;
    puff.add(api.sphere({ r: 0.32, seg: 12, ramp: R.WHITEWASH, lift: 0.1, speck: 0.05 }));
    api.colourOnly(puff.children[0]);
    g.add(puff);
  }

  // the court: a stone-rimmed turquoise pool, a short arcade on the right, a tree and a shrub on the left
  // the rim: four stone kerbs round the water, which sits a hand below their top (no coplanar faces)
  [-1, 1].forEach(s => {
    g.add(api.box({ w: PW + 0.6, h: P + 0.4, d: 0.3, x: PX, y: (P + 0.4) / 2, z: PZ + s * (PD / 2 + 0.15), ramp: R.LIMESTONE, lift: 0.06 }));
    g.add(api.box({ w: 0.3, h: P + 0.4, d: PD, x: PX + s * (PW / 2 + 0.15), y: (P + 0.4) / 2, z: PZ, ramp: R.LIMESTONE, lift: 0.06 }));
  });
  g.add(api.box({ w: PW, h: P + 0.28, d: PD, x: PX, y: (P + 0.28) / 2, z: PZ, ramp: R.SEA, lift: 0.12, speck: 0.08 }));
  g.add(api.archWall({ w: 3.4, h: 2.6, d: 0.4, arches: 3, archW: 0.8, archH: 2.0, x: 4.9, y: P, z: 2.5, rot: Math.PI / 2, mat: stone }));
  g.add(api.box({ w: 0.6, h: 0.14, d: 3.6, x: 4.9, y: P + 2.67, z: 2.5, ramp: R.LIMESTONE, lift: 0.05 }));
  const kinds = ['cypress', 'olive', 'lemon', 'orange', 'pine', 'cypress'];
  [[-4.9, 3.75]].forEach(([x, z]) => {
    const k = api.pick(kinds);
    if (k === 'cypress') g.add(api.cypress({ h: api.range(4.6, 5.8), x, z }));
    else if (k === 'pine') g.add(api.pine({ h: 4.2, r: 1.5, x, z }));
    else g.add(api.tree({ kind: k, h: 2.6, x, z }));
  });

  g.add(api.shrub({ r: 0.6, h: 0.75, x: -4.85, z: 1.2 }));

  // keylines: the bath block (the pool keeps its own lines: a proxy over the water hides it from far away)
  api.proxy(api.boxGeo({ w: BW, h: BH, d: BD, y: P + BH / 2, z: BZ }), g);
  return g;
}

// steam rises from the furnace chimney, swelling and thinning away
export function animate(obj, t) {
  for (let i = 0; i < 3; i++) {
    const p = obj.getObjectByName('steam' + i); if (!p) continue;
    if (p.userData.y0 === undefined) { p.userData.y0 = p.position.y; p.traverse(m => { m.castShadow = false; }); }   // steam throws no shadow
    const k = ((t * 0.22 + i / 3) % 1);
    p.position.y = p.userData.y0 + k * 2.6;
    p.position.x = (p.userData.x0 === undefined ? (p.userData.x0 = p.position.x) : p.userData.x0) + Math.sin(k * 3 + i) * 0.25 + k * 0.6;
    p.scale.setScalar(0.5 + k * 1.3 * (1 - k * 0.6));
    p.visible = k < 0.92;
  }
}
