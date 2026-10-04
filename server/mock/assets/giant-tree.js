// Stock asset: a giant tree. One flared trunk, two branches, five crown lobes (olive low, pine high); the crown
// gets one smooth sphere proxy so the pencil draws a tree and not every lobe.
export default {
  key: 'tree', name: 'Giant tree', aliases: ['giant tree', 'big tree', 'great tree', 'old tree', 'dev ağaç', 'büyük ağaç'],
  meta: { footprint: { w: 7, d: 7 }, cost: { coin: 3, food: 2 }, workers: 1, skill: 'farming', buildSeconds: 45, perDay: { food: 1 }, housing: 0, category: 'nature', desc: 'A tree far older than the camp, planted by asking. Shade for everyone, and a bench underneath, eventually.' },
  code: `function build(api) {
  var R = api.ramps, g = api.group();
  // trunk with a flared root collar
  g.add(api.cylinder({ rt: 0.5, rb: 0.8, h: 3.8, y: 1.9, ramp: R.WOOD, seg: 14 }));
  g.add(api.cylinder({ rt: 0.9, rb: 1.35, h: 0.5, y: 0.25, ramp: R.WOOD, seg: 14 }));
  // two branches tipped out of the trunk
  g.add(api.cylinder({ rt: 0.16, rb: 0.32, h: 2.4, x: 0.9, y: 4.4, z: 0.2, rz: -0.8, ramp: R.WOOD, seg: 10 }));
  g.add(api.cylinder({ rt: 0.16, rb: 0.32, h: 2.2, x: -0.8, y: 4.2, z: -0.4, rz: 0.85, rx: 0.3, ramp: R.WOOD, seg: 10 }));
  // crown: a few big lobes, olive low, pine high
  g.add(api.sphere({ r: 2.3, y: 5.7, ramp: R.PINE, seg: 20 }));
  g.add(api.sphere({ r: 1.5, x: 1.4, y: 4.9, z: 0.5, ramp: R.OLIVE, seg: 18 }));
  g.add(api.sphere({ r: 1.4, x: -1.4, y: 5.0, z: -0.4, ramp: R.OLIVE, seg: 18 }));
  g.add(api.sphere({ r: 1.3, x: 0.2, y: 7.0, z: 0.1, ramp: R.PINE, seg: 18 }));
  g.add(api.sphere({ r: 1.1, x: -0.3, y: 5.3, z: 1.4, ramp: R.OLIVE, seg: 18 }));
  g.add(api.sphere({ r: 1.0, x: 0.5, y: 5.1, z: -1.5, ramp: R.SAGE, seg: 18 }));
  // a bench under it
  g.add(api.box({ w: 1.4, h: 0.08, d: 0.4, x: 1.9, y: 0.45, z: 1.6, ramp: R.WOOD }));
  g.add(api.box({ w: 0.1, h: 0.4, d: 0.36, x: 1.35, y: 0.2, z: 1.6, ramp: R.WOOD }));
  g.add(api.box({ w: 0.1, h: 0.4, d: 0.36, x: 2.45, y: 0.2, z: 1.6, ramp: R.WOOD }));
  // keylines: the crown as one mass, the trunk as one
  api.proxy(api.sphereGeo({ r: 2.75, y: 5.7 }), g);
  api.proxy(api.cylinderGeo({ rt: 0.5, rb: 0.8, h: 3.8, y: 1.9 }), g);
  return g;
}`,
};
