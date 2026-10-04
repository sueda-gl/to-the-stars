// Stock asset: a stone tower (the answer for keeps, belfries, observatories, campaniles).
export default {
  key: 'tower', name: 'Stone tower', aliases: ['tall tower', 'keep', 'belfry', 'campanile', 'kule'],
  meta: { footprint: { w: 4, d: 4 }, cost: { stone: 16, wood: 4 }, workers: 2, skill: 'building', buildSeconds: 80, perDay: {}, housing: 0, category: 'landmark', desc: 'A square limestone tower with an arcade of ink-dark windows and a terracotta hip roof.' },
  code: `function build(api) {
  var R = api.ramps, g = api.group();
  var wall = api.lambert('#e3d2b4');
  g.add(api.box({ w: 3.4, h: 0.5, d: 3.4, y: 0.25, ramp: R.LIMESTONE }));
  g.add(api.box({ w: 2.6, h: 6.5, d: 2.6, y: 0.5 + 3.25, mat: wall }));
  g.add(api.box({ w: 3.0, h: 0.3, d: 3.0, y: 7.9, ramp: R.IRON }));
  g.add(api.box({ w: 2.8, h: 1.3, d: 2.8, y: 8.7, mat: api.lambert('#efe4d2') }));
  // an arcade of arched windows round the belfry, slit windows lower down
  var i, rot, dx, dz;
  for (i = 0; i < 4; i++) {
    rot = i * Math.PI / 2; dx = Math.sin(rot) * 1.41; dz = Math.cos(rot) * 1.41;
    g.add(api.inkWindow({ w: 0.7, h: 0.95, x: dx, y: 8.7, z: dz, rot: rot, arched: true, frame: false }));
    g.add(api.inkWindow({ w: 0.36, h: 0.6, x: dx * 0.93, y: 4.2, z: dz * 0.93, rot: rot, arched: true, frame: false }));
  }
  g.add(api.hipRoof({ w: 3.2, d: 3.2, h: 1.3, y: 9.35, ramp: R.TERRACOTTA }));
  g.add(api.sphere({ r: 0.14, y: 10.8, ramp: R.GOLD }));
  g.add(api.inkDoor({ w: 0.8, h: 1.5, y: 0.5, z: 1.31 }));
  api.proxy(api.boxGeo({ w: 2.7, h: 9.0, d: 2.7, y: 5.0 }), g);
  return g;
}`,
};
