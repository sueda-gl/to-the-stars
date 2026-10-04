// Stock asset: a boat. A wooden hull (pointed by two yawed boxes), a red stripe, a mast and a cream sail billowing
// toward +z. y = 0 is the water line; it bobs.
export default {
  key: 'boat', name: 'Boat', aliases: ['boat', 'sailboat', 'sail boat', 'fishing boat', 'tekne', 'kayık', 'kayik', 'yelkenli'],
  meta: { footprint: { w: 3, d: 6 }, cost: { wood: 12, goods: 2 }, workers: 2, skill: 'crafting', buildSeconds: 60, perDay: { food: 2 }, housing: 0, category: 'prop', desc: 'A small painted boat with one cream sail. It fishes a little, and looks right from the terrace.' },
  code: `function build(api) {
  var R = api.ramps, g = api.group();
  // hull along z: a long box, a bow and a stern made of boxes turned 45 degrees, a red stripe
  g.add(api.box({ w: 1.7, h: 0.9, d: 3.4, y: 0.45, ramp: R.WOOD }));
  g.add(api.box({ w: 1.2, h: 0.9, d: 1.2, y: 0.45, z: 1.95, rot: Math.PI / 4, ramp: R.WOOD }));
  g.add(api.box({ w: 1.0, h: 0.9, d: 1.0, y: 0.45, z: -1.85, rot: Math.PI / 4, ramp: R.WOOD }));
  g.add(api.box({ w: 1.76, h: 0.16, d: 3.46, y: 0.8, ramp: R.REDWALL }));
  // deck, cabin and a bench
  g.add(api.box({ w: 1.5, h: 0.08, d: 3.2, y: 0.9, ramp: R.SAND }));
  g.add(api.box({ w: 1.1, h: 0.6, d: 1.0, y: 1.2, z: -0.9, ramp: R.WHITEWASH }));
  g.add(api.inkWindow({ w: 0.35, h: 0.3, y: 1.25, z: -0.4, frame: false }));
  g.add(api.box({ w: 1.3, h: 0.1, d: 0.35, y: 1.0, z: 1.1, ramp: R.INK }));
  // mast, boom, sail
  g.add(api.cylinder({ rt: 0.05, rb: 0.07, h: 3.8, x: 0, y: 2.8, z: 0.2, ramp: R.IRON, seg: 8 }));
  g.add(api.sail({ w: 1.9, h: 2.6, billow: 0.35, x: 0, y: 1.3, z: 0.25, ramp: R.WHITEWASH }));
  g.add(api.flag({ pole: 0.5, w: 0.5, h: 0.3, x: 0, y: 4.6, z: 0.2, ramp: R.REDWALL }));
  // keylines: the hull's three boxes and the sail draw their own crisp outlines (no proxy: a box would overshoot the bow)
  api.bob(g, { amp: 0.05, speed: 0.7 });
  return g;
}`,
};
