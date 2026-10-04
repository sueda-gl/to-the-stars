// School: an ochre-washed L of two wings under terracotta gables round a sandy schoolyard. The long classroom wing
// at the back has a row of tall ink windows and a little bell-cote on its ridge; the short wing on the lit side
// holds the door under a porch. A low limestone wall with a gate closes the yard, where one shade tree stands
// over a stone bench. From above: two crossing gables, the pale yard and the tree's crown. Footprint 10 x 8,
// the yard and the classroom windows face +z.
export const meta = {
  id: 'school', name: 'School',
  aliases: ['school', 'schools', 'schoolhouse', 'classroom', 'academy', 'okul', 'okullar', 'mektep'],
  category: 'building', stage: 'village', footprint: { w: 10, d: 8 }, height: 6.4,
  desc: 'An ochre schoolhouse in an L round a sandy yard with a bell-cote and a shade tree.'
};

export function build(api) {
  const R = api.ramps, g = api.group();
  const ochre = api.lambert('#dcae5c', 0.16);
  const P = 0.25;

  // the yard: one pale sand slab under everything
  g.add(api.box({ w: 9.8, h: 0.1, d: 7.8, y: 0.05, ramp: R.SAND, speck: 0.2 }));

  // the classroom wing: long, along the back
  const AW = 8.0, AD = 3.0, AX = 0.6, AZ = -2.2, AH = 3.0;
  g.add(api.box({ w: AW + 0.3, h: P, d: AD + 0.3, x: AX, y: P / 2, z: AZ, ramp: R.LIMESTONE }));
  g.add(api.box({ w: AW, h: AH, d: AD, x: AX, y: P + AH / 2, z: AZ, mat: ochre }));
  g.add(api.gableRoof({ w: AW, d: AD, h: 1.25, overhang: 0.3, x: AX, y: P + AH, z: AZ, ramp: R.TERRACOTTA }));
  // tall classroom windows on the yard side (front face z = AZ + AD/2)
  for (let i = 0; i < 4; i++) g.add(api.inkWindow({ w: 0.85, h: 1.55, x: AX - 1.4 + i * 1.65, y: P + 1.65, z: AZ + AD / 2, frame: R.LIMESTONE }));
  // the bell-cote on the ridge: a pale arched gable with a bronze bell in it
  const bx = AX + 2.6, by = P + AH + 1.05;
  g.add(api.archWall({ w: 0.95, h: 1.25, d: 0.32, arches: 1, archW: 0.5, archH: 0.9, x: bx, y: by, z: AZ, ramp: R.WHITEWASH }));
  g.add(api.gableRoof({ w: 0.36, d: 1.1, h: 0.3, overhang: 0.05, x: bx, y: by + 1.25, z: AZ, rot: Math.PI / 2, ramp: R.TERRACOTTA }));
  const bell = api.group({ x: bx, y: by + 0.78, z: AZ }); bell.name = 'bell';
  bell.add(api.lathe({ points: [[0.02, -0.34], [0.2, -0.32], [0.15, -0.18], [0.11, -0.02], [0.02, 0]], seg: 14, ramp: R.GOLD }));
  g.add(bell);

  // the side wing on the lit (-x) side, running forward; its gable end faces the front
  const BW = 3.0, BD = 3.8, BX = -3.35, BZ = -0.2, BH = 3.0;
  g.add(api.box({ w: BW + 0.3, h: P, d: BD + 0.3, x: BX, y: P / 2, z: BZ, ramp: R.LIMESTONE }));
  g.add(api.box({ w: BW, h: BH, d: BD, x: BX, y: P + BH / 2, z: BZ, mat: ochre }));
  g.add(api.gableRoof({ w: BD, d: BW, h: 1.2, overhang: 0.3, x: BX, y: P + BH, z: BZ, rot: Math.PI / 2, ramp: R.TERRACOTTA }));
  // the door under a porch on the yard (+x) face, a round window in the front gable end
  g.add(api.inkDoor({ w: 0.9, h: 1.75, x: BX + BW / 2, y: P, z: BZ + 0.6, rot: Math.PI / 2 }));
  g.add(api.box({ w: 1.1, h: 0.12, d: 1.5, x: BX + BW / 2 + 0.5, y: P + 2.15, z: BZ + 0.6, ramp: R.TERRACOTTA }));
  [-1, 1].forEach(s => g.add(api.box({ w: 0.12, h: 2.05, d: 0.12, x: BX + BW / 2 + 0.95, y: P + 1.03, z: BZ + 0.6 + s * 0.62, ramp: R.WOOD })));
  g.add(api.inkWindow({ w: 0.7, h: 1.1, x: BX, y: P + 1.6, z: BZ + BD / 2, frame: R.LIMESTONE, shutters: R.SEA }));
  g.add(api.inkWindow({ w: 0.6, h: 1.0, x: BX - BW / 2, y: P + 1.6, z: BZ, rot: -Math.PI / 2, frame: R.LIMESTONE }));

  // the yard wall along the front and the right side, with a gate gap
  const wallR = { ramp: R.LIMESTONE, speck: 0.3, lift: -0.04 };
  g.add(api.box(Object.assign({ w: 3.3, h: 0.75, d: 0.35, x: -0.45, y: 0.375, z: 3.7 }, wallR)));
  g.add(api.box(Object.assign({ w: 2.6, h: 0.75, d: 0.35, x: 3.55, y: 0.375, z: 3.7 }, wallR)));
  g.add(api.box(Object.assign({ w: 0.35, h: 0.75, d: 3.4, x: 4.72, y: 0.375, z: 2.0 }, wallR)));
  [1.35, 2.15].forEach(x => g.add(api.box({ w: 0.42, h: 1.1, d: 0.42, x, y: 0.55, z: 3.7, ramp: R.LIMESTONE, lift: 0.04 })));

  // the shade tree over a stone bench, and a pair of shrubs by the wall
  const kind = api.pick(['oak', 'olive', 'pine', 'oak', 'orange', 'cypress']);
  if (kind === 'pine') g.add(api.pine({ h: 4.6, x: 3.2, z: 1.0 }));
  else if (kind === 'cypress') g.add(api.cypress({ h: 4.6, x: 3.6, z: 1.0 }));
  else g.add(api.tree({ kind, h: kind === 'oak' ? 3.9 : 3.0, x: 3.2, z: 1.0 }));
  g.add(api.box({ w: 1.5, h: 0.12, d: 0.42, x: 2.6, y: 0.45, z: 2.45, ramp: R.LIMESTONE, lift: 0.06 }));
  [-0.55, 0.55].forEach(dx => g.add(api.box({ w: 0.2, h: 0.4, d: 0.32, x: 2.6 + dx, y: 0.2, z: 2.45, ramp: R.LIMESTONE, lift: -0.06 })));
  g.add(api.shrub({ r: 0.55, x: 4.2, z: 3.2 }));

  // keylines: one box per wing
  api.proxy(api.boxGeo({ w: AW, h: AH, d: AD, x: AX, y: P + AH / 2, z: AZ }), g);
  api.proxy(api.boxGeo({ w: BW, h: BH, d: BD, x: BX, y: P + BH / 2, z: BZ }), g);
  return g;
}

// the bell swings now and then (lessons begin)
export function animate(obj, t) {
  const b = obj.getObjectByName('bell');
  if (b) b.rotation.x = Math.sin(t * 3.2) * 0.35 * Math.max(0, Math.sin(t * 0.25));
}
