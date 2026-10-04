// Drying rack: the catch and the herbs, hung out in the sun. Two crossed-pole trestles carry a ridge pole
// strung with silver fish and a lower bar of herb bundles (sage, lavender, bay); on the reed mat below, split
// fish lie flat to dry, and a lidded basket waits. The fish sway in the breeze (animate). Footprint 3.4 x 2.0,
// the long side faces +z.
export const meta = {
  id: 'drying-rack', name: 'Drying rack', aliases: ['drying racks', 'fish rack', 'fish drying rack', 'herb rack', 'drying frame', 'kurutma askısı', 'balık kurutma', 'kurutmalık'],
  category: 'prop', stage: 'camp', footprint: { w: 3.4, d: 2.0 }, height: 2.0,
  desc: 'Two crossed-pole trestles strung with drying fish and herb bundles over a reed mat of split fish.'
};

export function build(api) {
  const R = api.ramps, g = api.group();
  const fishCol = ['#8ea2a6', '#9aabab', '#7f9599'];
  const L = 2.9, top = 1.75;

  // the reed mat underneath, with split fish laid flat on it (what the rack reads as from above)
  g.add(api.box({ w: L - 0.2, h: 0.05, d: 1.3, y: 0.025, z: 0.2, color: '#c9ad72', speck: 0.4 }));
  for (let i = 0; i < 6; i++) {
    const x = -1.05 + i * 0.42, z = 0.2 + (i % 2 ? 0.22 : -0.22);
    g.add(api.sphere({ r: 0.2, sx: 0.55, sy: 0.12, sz: 1.3, x, y: 0.07, z, rot: 0.15 * (i % 3 - 1), color: api.pick(['#d7b48c', '#ddbf98', '#cfa982']), speck: 0.15 }));
  }

  // two trestles of crossed poles at the ends, and the ridge pole resting in their crossings
  [-1, 1].forEach(s => {
    [-1, 1].forEach(k => g.add(api.cylinder({ rb: 0.05, rt: 0.04, h: top * 1.22, x: s * L / 2, y: top * 0.55, z: k * 0.38, rx: -k * 0.42, ramp: R.WOOD, seg: 7 })));
  });
  g.add(api.cylinder({ r: 0.05, h: L + 0.4, y: top, rz: Math.PI / 2, ramp: R.WOOD, seg: 8 }));
  // a lower bar for the herbs, lashed across the trestles at the back
  g.add(api.cylinder({ r: 0.035, h: L + 0.1, y: 1.05, z: -0.22, rz: Math.PI / 2, ramp: R.WOOD, lift: 0.08, seg: 7 }));

  // fish hung by the tail from the ridge pole (they sway, animate)
  const fish = api.group({ y: top }); fish.name = 'fish';
  for (let i = 0; i < 7; i++) {
    const x = -1.15 + i * 0.38 + api.range(-0.04, 0.04), s = api.range(0.85, 1.1), col = fishCol[i % 3];
    fish.add(api.cylinder({ r: 0.008, h: 0.12, x, y: -0.07, ramp: R.SAND, seg: 4 }));
    fish.add(api.cone({ r: 0.09 * s, h: 0.14 * s, x, y: -0.16, rx: Math.PI, sz: 0.3, color: col, seg: 8 }));
    fish.add(api.sphere({ r: 0.11 * s, sx: 1.0, sy: 2.4, sz: 0.42, x, y: -0.2 - 0.26 * s, color: col, lift: 0.06, speck: 0.12, seg: 12 }));
  }
  g.add(fish);

  // herb bundles hung head-down from the lower bar
  const herbs = [R.SAGE, R.LAVENDER, R.OLIVE, R.SAGE, R.LAVENDER];
  for (let i = 0; i < 5; i++) {
    const x = -1.0 + i * 0.5 + api.range(-0.05, 0.05);
    g.add(api.cylinder({ r: 0.03, h: 0.12, x, y: 0.97, z: -0.22, ramp: R.SAND, seg: 6 }));
    g.add(api.lathe({ points: [[0, 0], [0.09, 0.03], [0.14, 0.12], [0.12, 0.24], [0.06, 0.33], [0.035, 0.38]], seg: 10, x, y: 0.55, z: -0.22, ramp: herbs[i], lift: 0.04, speck: 0.34 }));
  }

  // a lidded basket at the end of the mat
  g.add(api.cylinder({ rb: 0.22, rt: 0.27, h: 0.36, x: 1.55, y: 0.18, z: 0.65, color: '#b98c5d', speck: 0.4, seg: 14 }));
  g.add(api.cylinder({ r: 0.29, h: 0.06, x: 1.55, y: 0.39, z: 0.65, color: '#a2764b', speck: 0.3, seg: 14 }));
  return g;
}

// the hung fish swing a little in the breeze
export function animate(obj, t) {
  const f = obj.getObjectByName('fish');
  if (f) f.rotation.x = 0.05 * Math.sin(t * 1.3) + 0.02 * Math.sin(t * 3.1);
}
