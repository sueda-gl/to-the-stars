// Statue: a monument with no figure. On two limestone steps and a whitewashed die with a stone cornice stands an
// abstract bronze piece: a great upright ring with a red sphere resting in its lower curve, the whole slowly
// turning (animate). A low box hedge rings the steps. From above: a pale square, the ring as a bronze stroke with the
// red dot in it. Footprint 4.5 x 4.
export const meta = {
  id: 'statue', name: 'Statue',
  aliases: ['statue', 'statues', 'monument', 'sculpture', 'plinth', 'memorial', 'heykel', 'heykeller', 'anıt', 'abide'],
  category: 'landmark', stage: 'town', footprint: { w: 4.5, d: 4 }, height: 5.6,
  desc: 'An abstract bronze ring cradling a red sphere on a stepped stone plinth.'
};

export function build(api) {
  const R = api.ramps, g = api.group();
  const BRONZE = ['#3e2a16', '#5e4220', '#83602e', '#a8813f', '#c49e55'];

  // steps and the die
  g.add(api.box({ w: 3.4, h: 0.25, d: 3.4, y: 0.125, ramp: R.LIMESTONE }));
  g.add(api.box({ w: 2.7, h: 0.25, d: 2.7, y: 0.375, ramp: R.LIMESTONE, lift: 0.04 }));
  g.add(api.box({ w: 1.9, h: 0.18, d: 1.9, y: 0.59, ramp: R.LIMESTONE, lift: 0.06 }));
  g.add(api.box({ w: 1.55, h: 1.5, d: 1.55, y: 0.68 + 0.75, mat: api.lambert('#efe4d2') }));
  g.add(api.box({ w: 1.85, h: 0.2, d: 1.85, y: 2.28, ramp: R.LIMESTONE, lift: 0.06 }));
  // a bronze plaque (no text: a plain dark tablet)
  g.add(api.box({ w: 0.8, h: 0.5, d: 0.04, y: 1.45, z: 0.79, ramp: BRONZE, lift: -0.05 }));

  // the abstract piece, on a short bronze socket: an upright ring and the red sphere in its lap
  const piece = api.group({ y: 2.38 }); piece.name = 'piece';
  piece.add(api.cylinder({ rb: 0.42, rt: 0.3, h: 0.22, y: 0.11, ramp: BRONZE, seg: 16 }));
  piece.add(api.torus({ r: 1.2, tube: 0.2, flat: false, y: 1.42, ramp: BRONZE, seg: 40 }));
  piece.add(api.sphere({ r: 0.55, y: 0.78, seg: 24, ramp: R.REDWALL, lift: 0.06 }));
  g.add(piece);

  // a low clipped hedge round the steps (open at the front), and the odd pot
  [[0, -1.95, 3.6, 0.5], [-1.95, -0.3, 0.5, 2.8], [1.95, -0.3, 0.5, 2.8]].forEach(([x, z, w, d]) =>
    g.add(api.box({ w, h: 0.6, d, x, y: 0.3, z, ramp: R.OLIVE, lift: -0.04, speck: 0.3 })));
  return g;
}

// the piece turns very slowly on its socket
export function animate(obj, t) {
  const p = obj.getObjectByName('piece');
  if (p) p.rotation.y = Math.sin(t * 0.15) * 0.7;
}
