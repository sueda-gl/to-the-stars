// Flower meadow: strips of flowers grown for seed and market, side by side like a painter's swatches:
// five of poppy, mustard, chamomile, cornflower, rose and marigold plus one strip still in leaf, each a bank of
// bloom with a scalloped crest of flower clumps, grass alleys between (from above: the moodboard's colour bands).
// 12 x 9 m, strips run front to back.
export const meta = {
  id: 'flower-meadow', name: 'Flower meadow', category: 'farm', stage: 'village', area: true,
  aliases: ['flower fields', 'flower strips', 'flower beds', 'tulip field', 'tulips', 'çiçek bahçesi', 'çiçeklik', 'lale tarlası'],
  footprint: { w: 12, d: 9 }, height: 0.8,
  desc: 'side-by-side strips of red, yellow, white, blue, pink and orange flowers on green banks, grass alleys between'
};

// mid-value, slightly earthy blooms (gouache, not candy): poppy, mustard, chamomile, cornflower, rose, marigold,
// and a strip still in leaf
const BLOOM = {
  red: ['#5a1a14', '#8a2a1e', '#ad3b29', '#bf4a33', '#c9583d'],
  yellow: ['#7a5a18', '#a37d24', '#c79d35', '#d6b044', '#dfbd52'],
  white: ['#8a8070', '#b3a893', '#d2c8b2', '#e0d7c2', '#e9e1cd'],
  blue: ['#24304f', '#34456f', '#4b5f8c', '#5d719b', '#6a7ea6'],
  pink: ['#5a2032', '#83394f', '#a85570', '#b86a82', '#c27a8e'],
  orange: ['#6e3812', '#9a5420', '#bf7130', '#cd843d', '#d79348'],
  leaf: ['#2f3d17', '#46591f', '#5f7529', '#728a33', '#7f973b']
};
const GRASS = ['#3d4b23', '#566830', '#6f833d', '#82964a', '#8fa253'];
const bank = (w, h) => [[-w / 2, 0], [-w * 0.42, h * 0.75], [-w * 0.2, h], [w * 0.2, h], [w * 0.42, h * 0.75], [w / 2, 0]];

export function build(api) {
  const g = api.group();
  const W = 12, D = 9, L = D - 1.0;
  g.add(api.box({ w: W, h: 0.1, d: D, y: 0.05, ramp: GRASS, speck: 0.1 }));
  // the colour order: a shuffled palette, so each variant paints its own swatch card
  const names = ['red', 'yellow', 'white', 'blue', 'pink', 'orange'].sort(() => api.rand() - 0.5).slice(0, 5);
  names.splice(1 + Math.floor(api.rand() * 4), 0, 'leaf');
  const n = 6, pitch = (W - 0.6) / n;
  for (let i = 0; i < n; i++) {
    const x = -W / 2 + 0.3 + pitch * (i + 0.5), ramp = BLOOM[names[i]];
    // the strip: a broad bank in the bloom colour (flat colour reads from above; the brush keeps it whole), with a
    // scalloped crest of bloom clumps along it (low speck, or the brush would erode them to dots)
    g.add(api.extrude({ shape: bank(pitch * 0.8, 0.42), depth: L, x, y: 0.1, ramp, speck: 0.1, lift: -0.05 }));
    const per = 8;
    for (let j = 0; j < per; j++) {
      const z = -L / 2 + (j + 0.5) * L / per, r = api.range(0.5, 0.58);
      g.add(api.sphere({ r, sy: 0.4, sx: pitch * 0.62 / (2 * r), x: x + api.range(-0.04, 0.04), y: 0.46, z: z + api.range(-0.05, 0.05), ramp, speck: 0.1, lift: api.range(-0.02, 0.07), seg: 14 }));
    }
    // one smooth outline per strip (the crest clumps are colour only inside it)
    api.proxy(api.extrudeGeo({ shape: bank(pitch * 0.8, 0.55), depth: L, x, y: 0.1 }), g);
  }
  return g;
}
