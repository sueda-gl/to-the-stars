// Observatory: a red drum on a square limestone terrace, under a pale lime-washed dome split by an ink-dark
// observing slit, with a bronze telescope tilted out of the slit toward the sky. On the terrace's front corner an
// armillary sphere of bronze rings turns on a stone post. From above: a white dome inside a red ring on a pale
// square, the dark slit and the telescope as a stroke across it. Footprint 9 x 10, the door and slit face +z.
export const meta = {
  id: 'observatory', name: 'Observatory',
  aliases: ['observatory', 'observatories', 'star tower', 'stargazing dome', 'telescope house', 'gözlemevi', 'rasathane', 'gözlemevleri'],
  category: 'landmark', stage: 'civilisation', footprint: { w: 9, d: 10 }, height: 8.6,
  desc: 'A red-drummed observatory with a slit white dome, a telescope and an armillary sphere.'
};

export function build(api) {
  const R = api.ramps, g = api.group();
  const red = api.lambert('#c23a2c', 0.1), stone = api.lambert('#e6d6b8');

  // the terrace: a square limestone platform with a front flight of steps
  const TH = 1.1;
  g.add(api.box({ w: 8.2, h: TH, d: 8.2, y: TH / 2, mat: stone }));
  g.add(api.box({ w: 8.44, h: 0.16, d: 8.44, y: TH + 0.08, ramp: R.LIMESTONE, lift: 0.06 }));
  g.add(api.stairs({ w: 2.0, steps: 4, rise: 0.3, run: 0.3, y: 0, z: 4.75 }));
  const P = TH + 0.16;

  // the drum: red, with a limestone band at the top and an arched ink door
  const DR = 2.6, DH = 2.9;
  g.add(api.cylinder({ r: DR, h: DH, y: P + DH / 2, z: -0.5, seg: 32, mat: red }));
  g.add(api.cylinder({ r: DR + 0.14, h: 0.24, y: P + DH + 0.12, z: -0.5, seg: 32, ramp: R.LIMESTONE, lift: 0.04 }));
  g.add(api.inkDoor({ w: 0.95, h: 1.9, y: P, z: -0.5 + DR - 0.02, frame: R.LIMESTONE }));
  g.add(api.archOpening({ w: 0.42, h: 0.75, x: -DR * 0.98, y: P + 1.7, z: -0.5, rot: -Math.PI / 2, frame: false }));

  // the dome: lime-washed, a dark slit down its front, a bronze telescope out of the slit
  const DY = P + DH + 0.24, DOR = 2.55, DZ = -0.5;
  g.add(api.dome({ r: DOR, h: DOR * 0.96, y: DY, z: DZ, seg: 32, ramp: R.WHITEWASH, lift: 0.03 }));
  const slit = [];
  for (let i = 0; i <= 8; i++) {
    const p = 0.06 + i / 8 * 1.32;   // from the crown down the front
    slit.push([0, DY + Math.cos(p) * DOR * 0.96 + 0.005, DZ + Math.sin(p) * (DOR + 0.005)]);
  }
  g.add(api.tube({ points: slit, r: 0.3, seg: 20, radial: 8, ramp: R.INK, lift: 0.08, sz: 1 }));
  const tel = api.group({ y: DY + 1.4, z: DZ + 0.9 }); tel.name = 'telescope';
  tel.add(api.cylinder({ rt: 0.24, rb: 0.32, h: 3.0, y: 0.9, rx: 0.62, ramp: R.GOLD, lift: -0.06, seg: 14 }));
  tel.add(api.cylinder({ r: 0.36, h: 0.22, y: 0.1, rx: 0.62, z: -0.05, ramp: R.IRON, seg: 14 }));
  g.add(tel);
  g.add(api.sphere({ r: 0.13, y: DY + DOR * 0.96 + 0.08, z: DZ - 0.25, ramp: R.GOLD }));

  // the armillary sphere on its post at the front-right corner of the terrace
  const ax = 2.9, az = 2.9;
  g.add(api.cylinder({ rb: 0.32, rt: 0.22, h: 1.0, x: ax, y: P + 0.5, z: az, ramp: R.LIMESTONE, seg: 12 }));
  const arm = api.group({ x: ax, y: P + 1.75, z: az }); arm.name = 'armillary';
  arm.add(api.torus({ r: 0.62, tube: 0.05, flat: false, ramp: R.GOLD, seg: 28 }));
  arm.add(api.torus({ r: 0.62, tube: 0.05, flat: false, rot: Math.PI / 2, ramp: R.GOLD, seg: 28 }));
  arm.add(api.torus({ r: 0.6, tube: 0.045, rz: 0.41, ramp: R.GOLD, seg: 28 }));
  arm.add(api.sphere({ r: 0.14, ramp: R.REDWALL }));
  g.add(arm);

  // a tree at the back corner of the terrace
  const k = api.pick(['cypress', 'pine', 'olive', 'cypress', 'oak']);
  if (k === 'cypress') g.add(api.cypress({ h: 6.2, x: 3.3, y: P, z: -3.3 }));
  else if (k === 'pine') g.add(api.pine({ h: 6, x: 3.2, y: P, z: -3.2 }));
  else g.add(api.tree({ kind: k, h: k === 'oak' ? 4.6 : 3.4, x: 3.2, y: P, z: -3.2 }));

  // keylines: the drum, the dome
  api.proxy(api.cylinderGeo({ r: DR, h: DH, y: P + DH / 2, z: -0.5, seg: 32 }), g);
  return g;
}

// the armillary turns slowly
export function animate(obj, t) {
  const a = obj.getObjectByName('armillary');
  if (a) a.rotation.y = t * 0.3;
}
