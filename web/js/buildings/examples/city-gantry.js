// ALOUD trailer t6: a HARBOUR GANTRY CRANE (container crane) in ultramarine steel: four legs on rails, a high
// beam reaching out over the water (+z), a cab, cables; next to a short stack of shipping containers.
function build(api) {
  var R = api.ramps, g = api.group(), i;
  var H = 16, S = 7, steel = R.BLUE;
  for (i = 0; i < 4; i++) g.add(api.box({ w: 0.6, h: H, d: 0.6, x: (i % 2 ? 1 : -1) * S / 2, y: H / 2, z: (i < 2 ? 1 : -1) * 3, ramp: steel }));
  g.add(api.box({ w: S + 0.6, h: 0.7, d: 0.7, y: H * 0.45, z: 3, ramp: steel }));
  g.add(api.box({ w: S + 0.6, h: 0.7, d: 0.7, y: H * 0.45, z: -3, ramp: steel }));
  g.add(api.box({ w: 1.6, h: 1.4, d: 24, y: H + 0.7, z: 4, ramp: steel }));
  g.add(api.box({ w: 2.2, h: 1.8, d: 2.6, y: H - 1.0, z: 9, ramp: R.WHITEWASH }));
  g.add(api.box({ w: 0.1, h: H - 4, d: 0.1, y: H - (H - 4) / 2, z: 12, ramp: R.IRON }));
  var cols = [R.RED, R.BLUE, R.WHITEWASH, R.SLATE, R.SAGE];
  for (i = 0; i < 6; i++) g.add(api.box({ w: 2.5, h: 2.6, d: 6, x: -7 - (i % 2) * 2.7, y: 1.3 + Math.floor(i / 2) * 2.6, z: -2, ramp: cols[i % cols.length] }));
  return g;
}
