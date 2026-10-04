// Quarry: a dark green hill with a warm stone cut bitten out of its face in two big terraces, a stack of cut
// blocks on a dusty apron, a timber derrick whose boom swings a hanging block, and a stone cart.
// Few big shapes at MID values: the stone is a warm ochre-grey a clear step darker than the cream paper (it was
// near-white and dissolved into the page), the hill a deep olive, so from above it reads as a bite out of a green
// hill with a pale-but-not-white floor. Footprint 7 x 6, the cut face looks to +z.
export const meta = { id: 'quarry', footprint: { w: 7, d: 6 }, height: 5.2 };

// fresh-cut stone, dark -> light: mid values (a flat top takes the last stop)
const STONE = ['#634a2e', '#87663f', '#a8845a', '#ba976a', '#c6a576'];   // warm ochre limestone, freshly cut
const BLOCK = ['#6a5034', '#8f6f48', '#b08d62', '#c29f72', '#cfae80'];
const DUST = ['#4f4232', '#665643', '#7f6d56', '#8e7b62', '#98856b'];     // trodden grey-brown: the stone stands off it
const HILL = ['#2f3a1b', '#455427', '#5d6e33', '#6f803d', '#7c8c45'];

export function build(api) {
  const R = api.ramps, g = api.group();

  // the dusty apron
  g.add(api.box({ w: 6.9, h: 0.12, d: 5.9, y: 0.06, ramp: DUST, speck: 0.28 }));

  // the hill behind and around the cut: one broad olive mound
  g.add(api.dome({ r: 1, h: 3.9, sx: 3.45, sz: 1.55, x: 0, y: 0.1, z: -2.0, seg: 14, ramp: HILL, speck: 0.3 }));
  // the cut: two square terraces of warm stone stepping down toward the front (painted: a lit top, a mid face)
  g.add(api.box({ w: 4.6, h: 2.4, d: 1.6, x: -0.35, y: 0.1 + 1.2, z: -0.95, ramp: STONE, speck: 0.22 }));
  g.add(api.box({ w: 2.8, h: 1.1, d: 1.3, x: -1.05, y: 0.1 + 0.55, z: 0.45, rot: 0.04, ramp: STONE, speck: 0.22, lift: 0.04 }));
  // one cypress on the crown of the hill
  g.add(api.cypress({ h: 2.4, x: 1.6, y: 3.2, z: -2.2 }));

  // cut blocks on the apron: a stack of three
  const s = 0.68;
  [[0, 0, 0.05], [s * 1.36, 0, -0.06], [s * 0.68, 1, 0.12]].forEach(([x, row, rot]) =>
    g.add(api.box({ w: s * 1.3, h: s, d: s, x: 1.55 + x, y: 0.12 + s / 2 + row * s, z: 1.3, rot, ramp: BLOCK, speck: 0.18 })));

  // the derrick: a mast with one guy leg, and a boom (its own group: it swings)
  const mx = 1.6, mz = -0.1, mh = 4.4;
  g.add(api.cylinder({ rb: 0.14, rt: 0.1, h: mh, x: mx, y: 0.1 + mh / 2, z: mz, ramp: R.WOOD, seg: 10 }));
  g.add(api.tube({ points: [[mx, 0.1 + mh, mz], [mx + 0.9, 2.2, mz - 0.9], [mx + 1.4, 0.1, mz - 1.2]], r: 0.07, seg: 10, ramp: R.WOOD }));
  const boom = api.group({ x: mx, y: 0.9, z: mz, rot: -0.75 }); boom.name = 'boom';
  const bl = 2.6, ang = 0.7;   // boom length and lift (radians above horizontal), reaching out over the stack
  boom.add(api.cylinder({ r: 0.09, h: bl, x: Math.cos(ang) * bl / 2, y: Math.sin(ang) * bl / 2, rz: -(Math.PI / 2 - ang), ramp: R.WOOD, seg: 8 }));
  const tipX = Math.cos(ang) * bl, tipY = Math.sin(ang) * bl;
  boom.add(api.box({ w: 0.04, h: 1.15, d: 0.04, x: tipX, y: tipY - 0.58, ramp: R.WOOD, lift: -0.2 }));
  const load = api.box({ w: 0.62, h: 0.45, d: 0.5, x: tipX, y: tipY - 1.38, ramp: BLOCK }); load.name = 'load';
  boom.add(load);
  g.add(boom);
  g.add(api.flag({ pole: 0.9, w: 0.6, h: 0.34, x: mx, y: 0.1 + mh - 0.1, z: mz, ramp: api.ramps.REDWALL }));   // the one accent

  // a stone cart in front of the low terrace
  g.add(api.box({ w: 1.1, h: 0.36, d: 0.75, x: -1.2, y: 0.62, z: 1.95, ramp: R.WOOD }));
  g.add(api.box({ w: 0.66, h: 0.34, d: 0.52, x: -1.25, y: 0.97, z: 1.95, ramp: BLOCK }));
  g.add(api.wheel({ r: 0.38, w: 0.1, spokes: 6, x: -1.2, y: 0.48, z: 2.38, rot: Math.PI / 2 }));
  g.add(api.wheel({ r: 0.38, w: 0.1, spokes: 6, x: -1.2, y: 0.48, z: 1.52, rot: Math.PI / 2 }));

  return g;   // every mass is smooth: each draws its own outline, no proxy needed
}

// the boom swings slowly over the stack and back; the block sways under it
export function animate(obj, t) {
  const boom = obj.getObjectByName('boom'); if (!boom) return;
  if (boom.userData.rest === undefined) boom.userData.rest = boom.rotation.y;
  boom.rotation.y = boom.userData.rest + Math.sin(t * 0.35) * 0.45;
  const load = boom.getObjectByName('load');
  if (load) { if (load.userData.y0 === undefined) load.userData.y0 = load.position.y; load.position.y = load.userData.y0 + Math.sin(t * 0.7) * 0.15; }
}
