// Obelisk: a single tapering four-sided shaft of rose granite on a red-wall pedestal and three limestone steps,
// capped by a gilded pyramidion that catches the low sun. Four bronze ball-feet hold the shaft off the pedestal.
// From above: a small stepped square, the gold point and a long thin shadow (a sundial for the square).
// Footprint 4 x 4.
export const meta = {
  id: 'obelisk', name: 'Obelisk',
  aliases: ['obelisk', 'obelisks', 'needle', 'monolith', 'stele', 'dikilitaş', 'sütun anıt'],
  category: 'landmark', stage: 'civilisation', footprint: { w: 4, d: 4 }, height: 10.4,
  desc: 'A rose-granite obelisk with a gilded tip on a stepped red pedestal.'
};

export function build(api) {
  const R = api.ramps, g = api.group();
  const GRANITE = ['#6e3a33', '#93524a', '#b06b5e', '#c4847a', '#d49c90'];

  // three steps
  [[3.8, 0], [3.1, 1], [2.4, 2]].forEach(([w, i]) => g.add(api.box({ w, h: 0.3, d: w, y: 0.15 + i * 0.3, ramp: R.LIMESTONE, lift: 0.03 * i })));
  // the pedestal: a red die between two stone mouldings
  g.add(api.box({ w: 1.9, h: 0.2, d: 1.9, y: 1.0, ramp: R.LIMESTONE, lift: 0.05 }));
  g.add(api.box({ w: 1.6, h: 1.3, d: 1.6, y: 1.75, mat: api.lambert('#c23a2c', 0.1) }));
  g.add(api.box({ w: 1.9, h: 0.2, d: 1.9, y: 2.5, ramp: R.LIMESTONE, lift: 0.05 }));
  // four bronze feet
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => g.add(api.sphere({ r: 0.14, x: a * 0.5, y: 2.68, z: b * 0.5, ramp: R.GOLD })));
  // the shaft (a four-sided taper: cylinder with 4 segments turned 45 degrees) and the gilded pyramidion
  const S0 = 2.78, SH = 6.6;
  g.add(api.cylinder({ rb: 0.86, rt: 0.6, h: SH, y: S0 + SH / 2, seg: 4, rot: Math.PI / 4, ramp: GRANITE, speck: 0.2 }));
  g.add(api.cone({ r: 0.6, h: 0.85, y: S0 + SH + 0.425, seg: 4, rot: Math.PI / 4, ramp: R.GOLD }));
  return g;
}
