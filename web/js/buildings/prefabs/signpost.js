// Signpost: the first way-mark. A weathered post set in a little cairn of field stones, three arrow boards
// pointing off three ways (ochre, bare wood and one red), a capped top with a tied ribbon, and a young tree
// beside it (olive, oak, lemon or pine, picked at random). No lettering. Footprint 2.6 x 2.4, the arrows fan toward +z.
export const meta = {
  id: 'signpost', name: 'Signpost', aliases: ['signposts', 'sign post', 'sign', 'signs', 'waymark', 'way marker', 'fingerpost', 'direction sign', 'tabela', 'yön tabelası', 'işaret direği'],
  category: 'prop', stage: 'camp', footprint: { w: 2.6, d: 2.4 }, height: 3.0,
  desc: 'A post in a stone cairn with three arrow boards pointing three ways and a tied ribbon on top.'
};

export function build(api) {
  const R = api.ramps, g = api.group();
  const H = 2.6;

  // the cairn: a ring of field stones with two more piled on, wedging the post
  const stones = [[0.3, 0, 0.2, 0], [-0.28, 0.06, 0.2, 0], [0.04, 0.32, 0.19, 0], [0.05, -0.3, 0.2, 0], [0.1, 0.06, 0.17, 0.18], [-0.14, -0.08, 0.15, 0.2]];
  stones.forEach(([x, z, r, y], i) => g.add(api.sphere({ r, sx: 1.25, sy: 0.75, x, y: y + r * 0.7, z, rot: i * 0.9, ramp: R.LIMESTONE, lift: api.range(-0.1, 0.06), speck: 0.3, seg: 10 })));

  // the post and its little cap
  g.add(api.cylinder({ rb: 0.085, rt: 0.075, h: H, y: H / 2, ramp: R.WOOD, seg: 10 }));
  g.add(api.cone({ r: 0.13, h: 0.18, y: H + 0.09, ramp: R.WOOD, lift: -0.1, seg: 10 }));

  // three arrow boards, each from the post outward, turned to point three ways
  const arrow = [[0, -0.12], [0.86, -0.12], [1.08, 0], [0.86, 0.12], [0, 0.12]];
  const boards = [[2.25, 0.35, R.OCHRE], [1.92, 2.3, R.WOOD], [1.6, -0.75, R.REDWALL]];
  boards.forEach(([y, rot, ramp]) => {
    const b = api.group({ y, rot });
    b.add(api.extrude({ shape: arrow, depth: 0.05, x: 0.06, ramp, lift: ramp === R.WOOD ? 0.14 : 0, speck: 0.16 }));
    b.add(api.box({ w: 0.04, h: 0.3, d: 0.08, x: 0.1, ramp: R.IRON }));   // the iron strap holding it to the post
    g.add(b);
  });

  // a red ribbon tied under the cap, its tails lifting in the wind
  g.add(api.torus({ r: 0.09, tube: 0.025, y: H - 0.08, ramp: R.REDWALL, seg: 12 }));
  g.add(api.box({ w: 0.36, h: 0.06, d: 0.02, x: 0.22, y: H - 0.16, rz: -0.35, ramp: R.REDWALL, lift: 0.05 }));

  // a young tree growing beside it: an olive, an oak, a lemon or a little pine (a round 3D crown, picked at random)
  const kind = api.pick(['olive', 'oak', 'lemon', 'pine', 'olive']);
  g.add(api.tree({ kind, h: kind === 'pine' ? 3.4 : 2.8, x: -1.0, z: -0.75 }));
  return g;
}
