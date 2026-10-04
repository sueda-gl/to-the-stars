// Road: a 6 m stretch of warm sand road between two darker kerbs, raised a hand's breadth so its sides draw the
// pencil edges. It is the SAME strip the stroke filler lays along a pencil line (api.path / fill.road): use
// fill.road(points) when the player drew a line; this prefab is the fallback for "a road" with no mark (and for
// strips laid end to end: it runs along x, its ends are square). Mid-value ochre-sand, so it stands off the
// cream paper at eye level and from the leader's bird's-eye. Footprint 6 x 2.
export const meta = { id: 'road', footprint: { w: 6, d: 2 }, height: 0.16 };

export function build(api) {
  const g = api.group();
  g.add(api.path({ points: [[-3, 0], [3, 0]], width: 2, h: 0.14, smooth: false }));
  // a milestone at the near side: a small mark that tells the scale and catches the light
  g.add(api.box({ w: 0.26, h: 0.5, d: 0.2, x: 2.55, y: 0.25, z: 0.88, ramp: api.ramps.LIMESTONE }));
  return g;
}
