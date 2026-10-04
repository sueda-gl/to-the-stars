// Library: a limestone hall of books on a stepped podium. A deep portico of six columns carries a plain stone
// entablature and attic; behind it the reading hall has tall arched ink windows between pilasters, a flat roof with
// a parapet, and a drum lantern under a verdigris dome over the reading room. Two trees stand at the back corners.
// From above: a pale square with a green-blue dome in it and the portico's column row along the front.
// Footprint 11 x 11, the portico faces +z.
export const meta = {
  id: 'library', name: 'Library',
  aliases: ['library', 'libraries', 'reading room', 'archive', 'hall of books', 'bibliotheca', 'kütüphane', 'kütüphaneler', 'kitaplık'],
  category: 'landmark', stage: 'town', footprint: { w: 11, d: 11 }, height: 9.0,
  desc: 'A limestone library with a six-column portico and a verdigris reading-room dome.'
};

export function build(api) {
  const R = api.ramps, g = api.group();
  const stone = api.lambert('#e6d6b8');

  // the podium: two broad steps, the front flight
  g.add(api.box({ w: 9.4, h: 0.3, d: 9.4, y: 0.15, ramp: R.LIMESTONE }));
  g.add(api.box({ w: 8.8, h: 0.3, d: 8.8, y: 0.45, ramp: R.LIMESTONE, lift: 0.04 }));
  const P = 0.6;

  // the hall: front face at z = 1.5
  const HW = 7.6, HD = 5.4, HZ = -1.2, HH = 4.6, front = HZ + HD / 2;
  g.add(api.box({ w: HW, h: HH, d: HD, y: P + HH / 2, z: HZ, mat: stone }));
  g.add(api.box({ w: HW + 0.3, h: 0.3, d: HD + 0.3, y: P + HH + 0.15, z: HZ, ramp: R.LIMESTONE, lift: 0.05 }));    // cornice
  g.add(api.box({ w: HW, h: 0.5, d: HD, y: P + HH + 0.55, z: HZ, ramp: R.LIMESTONE, lift: -0.02 }));            // parapet / attic
  // the roof is the attic's flat top, so the dome sits on a calm pale square

  // the reading-room dome: an octagonal drum with arched windows, then the dome and a lantern
  const DY = P + HH + 0.8, DZ = HZ - 0.2;
  g.add(api.cylinder({ r: 1.75, h: 1.3, y: DY + 0.65, z: DZ, seg: 8, rot: Math.PI / 8, mat: stone }));
  for (let k = -2; k <= 2; k++) {   // the drum's front and side faces (a face looks at +z after the pi/8 turn)
    const a = k * Math.PI / 4;
    g.add(api.archOpening({ w: 0.45, h: 0.75, x: Math.sin(a) * 1.63, y: DY + 0.65, z: DZ + Math.cos(a) * 1.63, rot: a, frame: false }));
  }
  g.add(api.cylinder({ r: 1.9, h: 0.16, y: DY + 1.38, z: DZ, seg: 24, ramp: R.LIMESTONE }));
  g.add(api.dome({ r: 1.8, h: 1.65, y: DY + 1.46, z: DZ, seg: 28, ramp: R.SEA, lift: 0.1 }));
  g.add(api.cylinder({ r: 0.28, h: 0.5, y: DY + 3.35, z: DZ, seg: 10, ramp: R.LIMESTONE }));
  g.add(api.cone({ r: 0.36, h: 0.4, y: DY + 3.8, z: DZ, seg: 10, ramp: R.SEA, lift: 0.1 }));
  g.add(api.sphere({ r: 0.1, y: DY + 4.06, z: DZ, ramp: R.GOLD }));

  // the side walls: arched ink windows between flat pilasters on the lit (-x) side and the right
  [-1, 1].forEach(s => {
    for (let i = 0; i < 3; i++) {
      const z = HZ - 1.6 + i * 1.6;
      g.add(api.archOpening({ w: 0.7, h: 2.2, x: s * HW / 2, y: P + 2.1, z, rot: s * Math.PI / 2 }));
    }
    for (let i = 0; i < 4; i++) g.add(api.box({ w: 0.12, h: HH, d: 0.45, x: s * (HW / 2 + 0.05), y: P + HH / 2, z: HZ - 2.4 + i * 1.6, ramp: R.LIMESTONE, lift: 0.04 }));
  });

  // the portico: six columns in front of the hall, entablature and attic over them
  const PZ = front + 1.9, CH = 4.2;
  g.add(api.columns({ n: 6, from: [-3.3, PZ], to: [3.3, PZ], r: 0.26, h: CH, y: P, mat: stone }));
  g.add(api.box({ w: 7.6, h: 0.55, d: 2.4, y: P + CH + 0.275, z: front + 1.05, ramp: R.LIMESTONE }));
  g.add(api.box({ w: 7.8, h: 0.16, d: 2.6, y: P + CH + 0.63, z: front + 1.1, ramp: R.LIMESTONE, lift: 0.08 }));
  g.add(api.box({ w: 3.2, h: 0.6, d: 0.3, y: P + CH + 1.0, z: PZ, ramp: R.LIMESTONE, lift: 0.04 }));     // attic panel
  // the great door and two windows inside the portico
  g.add(api.inkDoor({ w: 1.3, h: 2.8, y: P, z: front, frame: R.LIMESTONE }));
  [-2.3, 2.3].forEach(x => g.add(api.archOpening({ w: 0.7, h: 1.8, x, y: P + 1.8, z: front, frame: false })));
  // the front flight of steps down from the podium
  g.add(api.stairs({ w: 4.2, steps: 3, rise: 0.2, run: 0.3, y: 0, z: 4.85 }));

  // two trees at the back corners (whichever grows there), the portico's bronze lamp stands
  const trees = ['cypress', 'olive', 'pine', 'oak', 'cypress', 'lemon'];
  [[-4.0, -3.9], [4.0, -3.8]].forEach(([x, z]) => {
    const k = api.pick(trees);
    if (k === 'pine') g.add(api.pine({ h: 5.4, r: 2.0, x, z }));
    else if (k === 'cypress') g.add(api.cypress({ h: api.range(5.6, 7), x, z }));
    else g.add(api.tree({ kind: k, h: k === 'oak' ? 5.2 : 3.4, x, z }));
  });
  [-2.6, 2.6].forEach(x => {
    g.add(api.cylinder({ r: 0.05, h: 1.5, x, y: P + 0.75, z: PZ + 0.9, ramp: R.IRON, seg: 8 }));
    g.add(api.sphere({ r: 0.17, x, y: P + 1.6, z: PZ + 0.9, ramp: R.GOLD }));
  });

  // keylines: the hall, the drum, the portico mass
  api.proxy(api.boxGeo({ w: HW, h: HH + 0.8, d: HD, y: P + (HH + 0.8) / 2, z: HZ }), g);
  api.proxy(api.cylinderGeo({ r: 1.75, h: 1.3, y: DY + 0.65, z: DZ, seg: 8, rot: Math.PI / 8 }), g);
  return g;
}
