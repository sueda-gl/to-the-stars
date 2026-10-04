// Stock asset: a statue (no human figure: an abstract standing form on a plinth, in the Red arch grammar).
export default {
  key: 'statue', name: 'Statue', aliases: ['statue', 'monument', 'obelisk', 'memorial', 'heykel', 'anıt', 'anit'],
  meta: { footprint: { w: 3, d: 3 }, cost: { stone: 10, coin: 4 }, workers: 1, skill: 'art', buildSeconds: 50, perDay: {}, housing: 0, category: 'landmark', desc: 'A pale stone plinth and a tall turned form with a red cap; the folk gather round it at dusk.' },
  code: `function build(api) {
  var R = api.ramps, g = api.group();
  // two steps and a drum
  g.add(api.box({ w: 2.6, h: 0.35, d: 2.6, y: 0.175, ramp: R.LIMESTONE }));
  g.add(api.box({ w: 1.8, h: 0.4, d: 1.8, y: 0.55, ramp: R.LIMESTONE }));
  g.add(api.cylinder({ r: 0.7, h: 0.5, y: 1.0, ramp: R.LIMESTONE, seg: 20 }));
  // the form: a turned profile (vase waist, shoulder, neck) and a head sphere, then a red cap
  g.add(api.lathe({ points: [[0.42, 0], [0.55, 0.3], [0.32, 1.6], [0.5, 2.3], [0.42, 2.9], [0.2, 3.2]], y: 1.25, seg: 20, ramp: R.WHITEWASH }));
  g.add(api.sphere({ r: 0.46, y: 4.85, ramp: R.WHITEWASH, seg: 20 }));
  g.add(api.cone({ r: 0.28, h: 0.5, y: 5.5, ramp: R.REDWALL, seg: 12 }));
  // four small pots at the corners of the lower step
  g.add(api.pot({ r: 0.2, x: 1.0, y: 0.35, z: 1.0, flowers: R.RED }));
  g.add(api.pot({ r: 0.2, x: -1.0, y: 0.35, z: 1.0, flowers: R.RED }));
  g.add(api.pot({ r: 0.2, x: 1.0, y: 0.35, z: -1.0, flowers: R.PINK }));
  g.add(api.pot({ r: 0.2, x: -1.0, y: 0.35, z: -1.0, flowers: R.PINK }));
  api.proxy(api.cylinderGeo({ rt: 0.4, rb: 0.5, h: 3.3, y: 2.9, seg: 20 }), g);
  api.proxy(api.sphereGeo({ r: 0.5, y: 4.85 }), g);
  return g;
}`,
};
