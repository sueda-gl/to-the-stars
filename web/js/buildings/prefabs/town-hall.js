// Town hall: the palazzo of the commune. A whitewashed two-storey block under a terracotta hip roof, fronted by a
// red-wall arcade of five round-headed arches (the Red arch's own grammar) carrying a terrace with a stone parapet,
// and a square clock tower rising from the roof with a pale clock face, an arched belfry and a pyramid cap.
// From above: a long hip roof, the pale terrace strip along the front and the tower's square cap. Footprint 11 x 9,
// the arcade faces +z. The clock hands turn (animate).
export const meta = {
  id: 'town-hall', name: 'Town hall',
  aliases: ['town hall', 'town halls', 'city hall', 'hall', 'council hall', 'palazzo', 'municipio', 'belediye', 'belediye binası', 'meclis'],
  category: 'building', stage: 'town', footprint: { w: 11, d: 9 }, height: 13.2,
  desc: 'A whitewashed palazzo with a red arcade, a terrace and a clock tower.'
};

export function build(api) {
  const R = api.ramps, g = api.group();
  const wall = api.lambert('#efe4d2'), red = api.lambert('#c23a2c', 0.1);
  const P = 0.3;                                         // plinth top

  // plinth and front steps
  g.add(api.box({ w: 10.6, h: P, d: 8.0, y: P / 2, z: 0.2, ramp: R.LIMESTONE }));
  g.add(api.stairs({ w: 3.4, steps: 2, rise: 0.15, run: 0.35, y: 0, z: 4.55 }));

  // the main block: two storeys, front face at z = 1.6
  const BW = 9.0, BD = 5.0, BZ = -0.9, BH = 5.8, front = BZ + BD / 2;
  g.add(api.box({ w: BW, h: BH, d: BD, y: P + BH / 2, z: BZ, mat: wall }));
  g.add(api.box({ w: BW + 0.2, h: 0.16, d: BD + 0.2, y: P + 3.2, z: BZ, ramp: R.LIMESTONE }));   // string course
  g.add(api.hipRoof({ w: BW, d: BD, h: 1.7, overhang: 0.35, y: P + BH, z: BZ, ramp: R.TERRACOTTA }));

  // the arcade: a red arched wall 1.8 m in front of the block, with a stone terrace slab on top
  const AZ = front + 1.8, AH = 3.2;
  g.add(api.archWall({ w: BW, h: AH, d: 0.5, arches: 5, archW: 1.15, archH: 2.55, y: P, z: AZ, mat: red }));
  // the arcade's ends close the loggia (short red returns)
  [-1, 1].forEach(s => g.add(api.box({ w: 0.5, h: AH, d: 1.8, x: s * (BW / 2 - 0.25), y: P + AH / 2, z: front + 0.9, mat: red })));
  g.add(api.box({ w: BW + 0.2, h: 0.24, d: 2.35, y: P + AH + 0.12, z: front + 1.05, ramp: R.LIMESTONE, lift: 0.04 }));
  // the terrace parapet: one low stone rail with a few posts (one proxy keeps its lines quiet)
  g.add(api.box({ w: BW, h: 0.12, d: 0.2, y: P + AH + 0.95, z: AZ + 0.05, ramp: R.LIMESTONE, lift: 0.06 }));
  for (let i = 0; i < 6; i++) g.add(api.box({ w: 0.18, h: 0.7, d: 0.18, x: -BW / 2 + 0.1 + i * (BW - 0.2) / 5, y: P + AH + 0.59, z: AZ + 0.05, ramp: R.LIMESTONE }));
  api.proxy(api.boxGeo({ w: BW, h: 0.82, d: 0.22, y: P + AH + 0.65, z: AZ + 0.05 }), g);
  // the loggia's back wall: dark doorways behind the arches
  g.add(api.box({ w: BW - 1.0, h: AH - 0.05, d: 0.06, y: P + (AH - 0.05) / 2, z: front + 0.03, ramp: R.INK, lift: 0.18, speck: 0.1 }));

  // the piano nobile: tall shuttered windows over the terrace, a balcony door in the middle
  const shutter = api.pick(['#4f7f8c', '#6f8f5a', '#3d5588']);
  [-3.6, -1.8, 1.8, 3.6].forEach(x => g.add(api.inkWindow({ w: 0.7, h: 1.35, x, y: P + 4.45, z: front, shutters: shutter })));
  g.add(api.inkDoor({ w: 0.9, h: 1.95, x: 0, y: P + AH + 0.25, z: front, frame: false }));
  // side windows on the lit (-x) face
  [-1.4, 0.4].forEach(z => g.add(api.inkWindow({ w: 0.6, h: 1.1, x: -BW / 2, y: P + 4.45, z: BZ + z, rot: -Math.PI / 2 })));
  [-1.4, 0.4].forEach(z => g.add(api.inkWindow({ w: 0.6, h: 0.9, x: -BW / 2, y: P + 1.7, z: BZ + z, rot: -Math.PI / 2, arched: true })));

  // the clock tower: rises through the roof at the back, square, whitewash
  const TX = 0, TZ = BZ - 0.4, TW = 2.0, T0 = P + BH, TH = 4.4, T1 = T0 + TH;
  g.add(api.box({ w: TW, h: TH + 1.2, d: TW, x: TX, y: T0 - 1.2 + (TH + 1.2) / 2, z: TZ, mat: wall }));
  g.add(api.box({ w: TW + 0.24, h: 0.18, d: TW + 0.24, x: TX, y: T1 - 0.9, z: TZ, ramp: R.LIMESTONE }));
  // the clock face on the front (+z) with a bronze rim and two ink hands
  const CY = T0 + 2.45, CZ = TZ + TW / 2;
  g.add(api.cylinder({ r: 0.62, h: 0.08, x: TX, y: CY, z: CZ + 0.04, rx: Math.PI / 2, ramp: R.WHITEWASH, lift: 0.08, seg: 28 }));
  g.add(api.torus({ r: 0.64, tube: 0.06, flat: false, x: TX, y: CY, z: CZ + 0.07, ramp: R.GOLD, seg: 28 }));
  const hm = api.group({ x: TX, y: CY, z: CZ + 0.11 }); hm.name = 'hand-m';
  hm.add(api.box({ w: 0.07, h: 0.52, d: 0.03, y: 0.22, ramp: R.INK })); g.add(hm);
  const hh = api.group({ x: TX, y: CY, z: CZ + 0.13 }); hh.name = 'hand-h';
  const hhand = api.box({ w: 0.09, h: 0.34, d: 0.03, y: 0.14, ramp: R.INK }); hh.add(hhand); hh.rotation.z = -2.1; g.add(hh);
  // the belfry: an arched opening on each face, then the pyramid cap and a gilded ball
  const BY = T1 - 0.9 + 0.09, BH2 = 1.55;
  g.add(api.box({ w: TW, h: BH2, d: TW, x: TX, y: BY + BH2 / 2, z: TZ, mat: wall }));
  g.add(api.archOpening({ w: 0.75, h: 1.05, x: TX, y: BY + 0.75, z: TZ + TW / 2, frame: false }));
  g.add(api.archOpening({ w: 0.75, h: 1.05, x: TX - TW / 2, y: BY + 0.75, z: TZ, rot: -Math.PI / 2, frame: false }));
  g.add(api.archOpening({ w: 0.75, h: 1.05, x: TX + TW / 2, y: BY + 0.75, z: TZ, rot: Math.PI / 2, frame: false }));
  g.add(api.box({ w: TW + 0.3, h: 0.16, d: TW + 0.3, x: TX, y: BY + BH2 + 0.08, z: TZ, ramp: R.LIMESTONE }));
  g.add(api.hipRoof({ w: TW + 0.1, d: TW + 0.1, h: 1.35, overhang: 0.12, x: TX, y: BY + BH2 + 0.16, z: TZ, ramp: R.TERRACOTTA }));
  g.add(api.sphere({ r: 0.15, x: TX, y: BY + BH2 + 1.65, z: TZ, ramp: R.GOLD }));

  // the commune's banner on the terrace, and two potted trees flanking the steps
  g.add(api.flag({ pole: 2.6, w: 1.0, h: 0.6, x: BW / 2 - 0.5, y: P + AH + 0.24, z: front + 1.6, ramp: R.REDWALL }));
  [-1, 1].forEach(s => {
    g.add(api.cylinder({ rb: 0.32, rt: 0.42, h: 0.5, x: s * 2.6, y: 0.25, z: 4.3, ramp: R.TERRACOTTA, seg: 14 }));
    g.add(api.tree({ kind: api.pick(['lemon', 'orange', 'olive']), h: 2.3, x: s * 2.6, y: 0.45, z: 4.3 }));
  });

  // keylines: the block and the tower as plain boxes
  api.proxy(api.boxGeo({ w: BW, h: BH, d: BD, y: P + BH / 2, z: BZ }), g);
  api.proxy(api.boxGeo({ w: TW, h: TH + 1.55 - 0.3, d: TW, x: TX, y: T0 + (TH + 1.55 - 0.3) / 2, z: TZ }), g);
  return g;
}

// the clock keeps (a quick) time
export function animate(obj, t) {
  const m = obj.getObjectByName('hand-m'), h = obj.getObjectByName('hand-h');
  if (m) m.rotation.z = -t * 0.25;
  if (h) h.rotation.z = -2.1 - t * 0.25 / 12;
}
