// Grove: three olive trees with silvery sage crowns, a domed umbrella pine at the back left and a dark cypress
// spindle at the back right, a couple of scrub mounds. No earth disc: the world paints the ground, so from above
// the grove reads as separate crown volumes (lit lemon-sage tops, cool deep sides, one pencil line each) over
// their long cobalt shadows (ART_DIRECTION §1; the earth disc was part of Sueda's complaint, mb 9). Footprint 6 x 6.
// Uses only api.tree / api.pine / api.shrub, so it works with the current api.js (trees.js does the painting).
export const meta = { id: 'grove', footprint: { w: 6, d: 6 }, height: 5.6 };

export function build(api) {
  const g = api.group();
  const j = () => api.range(-0.18, 0.18);
  // three olives across the front, room between the crowns (r ~1.05 m each)
  [[-1.55, 1.55, 2.8], [1.45, 1.75, 2.6], [1.75, -0.45, 2.9]].forEach(([x, z, h]) =>
    g.add(api.tree({ kind: 'olive', x: x + j(), z: z + j(), h: h * api.range(0.94, 1.06), lean: api.range(0.25, 0.45), rot: api.range(0, 6.28) })));
  // the umbrella pine at the back left, its canopy leaning out over the corner
  g.add(api.pine({ h: 5.4, r: 1.6, lean: 0.45, leanTo: [-0.7, -1], x: -1.25, z: -1.25 }));
  // the cypress at the back right
  g.add(api.tree({ kind: 'cypress', h: api.range(4.4, 4.9), x: 0.75, z: -2.35 }));
  // scrub between them
  g.add(api.shrub({ r: 0.5, h: 0.55, x: -0.15, z: 0.45, ramp: api.ramps.SAGE }));
  g.add(api.shrub({ r: 0.42, h: 0.45, x: 2.45, z: -2.2, ramp: api.ramps.OLIVE }));
  return g;
}
