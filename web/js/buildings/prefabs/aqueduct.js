// Aqueduct: one segment of a two-tier aqueduct in the Red arch's grammar. Three tall round-headed arches in a
// thick red wall, a limestone impost band, a lighter arcade of seven small arches above, and on top the stone
// channel with its water running (a strip of sea blue between two stone kerbs). Cutwater feet at the piers.
// Segments chain end to end along x. From above: a long pale channel with the water line down its middle and the
// red wall's long shadow. Footprint 14 x 3, it runs along x.
export const meta = {
  id: 'aqueduct', name: 'Aqueduct',
  aliases: ['aqueduct', 'aqueducts', 'aqueduct segment', 'water bridge', 'conduit', 'su kemeri', 'su kemerleri', 'kemer'],
  category: 'landmark', stage: 'civilisation', footprint: { w: 14, d: 3 }, height: 10.4,
  desc: 'A segment of a two-tier red-arched aqueduct carrying a stone water channel.'
};

export function build(api) {
  const R = api.ramps, g = api.group();
  const red = api.lambert('#c23a2c', 0.1);
  const L = 14;

  // the lower tier: three great arches in a thick red wall
  const H1 = 6.2, D1 = 2.1;
  g.add(api.archWall({ w: L, h: H1, d: D1, arches: 3, archW: 3.0, archH: 5.0, y: 0, mat: red }));
  // cutwater feet at the four piers (the wall ends count as piers)
  for (let i = 0; i <= 3; i++) {
    const x = -L / 2 + i * L / 3;
    g.add(api.box({ w: i === 0 || i === 3 ? 1.6 : 2.0, h: 0.7, d: D1 + 0.5, x: i === 0 ? x + 0.8 : i === 3 ? x - 0.8 : x, y: 0.35, ramp: R.LIMESTONE, lift: -0.04, speck: 0.26 }));
  }
  // the impost band between the tiers
  g.add(api.box({ w: L, h: 0.32, d: D1 + 0.24, y: H1 + 0.16, ramp: R.LIMESTONE, lift: 0.04 }));

  // the upper tier: seven small arches, a little narrower in depth
  const Y2 = H1 + 0.32, H2 = 2.6, D2 = 1.7;
  g.add(api.archWall({ w: L, h: H2, d: D2, arches: 7, archW: 1.05, archH: 1.85, y: Y2, mat: red }));
  g.add(api.box({ w: L, h: 0.24, d: D2 + 0.22, y: Y2 + H2 + 0.12, ramp: R.LIMESTONE, lift: 0.06 }));

  // the channel on top: two stone kerbs and the water between them
  const Y3 = Y2 + H2 + 0.24;
  [-1, 1].forEach(s => g.add(api.box({ w: L, h: 0.45, d: 0.4, y: Y3 + 0.225, z: s * 0.62, ramp: R.LIMESTONE, lift: 0.02 })));
  g.add(api.box({ w: L, h: 0.36, d: 0.86, y: Y3 + 0.18, ramp: R.SEA, lift: 0.14, speck: 0.06 }));

  // a little green at the feet: shrubs inside the arches
  // (kept inside the 3 m strip, so a chain of segments stays clean)
  g.add(api.shrub({ r: 0.55, h: 0.7, x: 0.4, z: 0.5 }));
  if (api.rand() < 0.6) g.add(api.shrub({ r: 0.45, h: 0.6, x: -L / 3 - 0.5, z: -0.4, ramp: R.SAGE }));
  return g;
}
