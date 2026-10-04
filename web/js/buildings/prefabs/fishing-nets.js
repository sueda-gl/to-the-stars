// Fishing nets: a row of tall wooden drying poles on a strip of sand with a rope run along their tops, rust-red
// and hemp nets hanging between them with cork floats on the head-rope, a net spread flat on the sand to dry,
// a heaped net with a coil of rope, two wicker baskets and a crate. Gulls stand on two pole tops and one on the
// spread net. The hanging nets sway in the breeze and the gulls turn their heads (animate). From above: a ruled
// line of poles and their long shadows, the red net shapes on pale sand. Footprint 7 x 5, the nets face +z.
export const meta = {
  id: 'fishing-nets', name: 'Fishing nets',
  aliases: ['nets', 'net', 'fishing net', 'drying nets', 'net drying poles', 'drying poles', 'fishermen\'s nets', 'net rack', 'ağ', 'ağlar', 'balık ağı', 'balık ağları', 'ağ sergisi'],
  category: 'prop', stage: 'camp', footprint: { w: 7, d: 5 }, height: 3.0,
  desc: 'Drying poles hung with red and hemp fishing nets on the sand, with a spread net, baskets and gulls.'
};

const SAND = ['#8d7656', '#ad9572', '#c9b18a', '#dbc49d', '#e7d2ad'];
const RED_NET = ['#4e1f16', '#6e2c1e', '#8f3b27', '#a84a31', '#b9583a'];
const HEMP = ['#4f3a20', '#6f542f', '#8f6e40', '#a6824f', '#b6935e'];
const CORK = ['#7a5a2a', '#a07a3a', '#c49a50', '#d8b266', '#e6c47a'];
const GULL = ['#8a8986', '#b1b0ad', '#d3d2cf', '#e9e8e5', '#f7f6f3'];
const GULL_WING = ['#3f4248', '#565a62', '#6f747d', '#878c95', '#9ca1aa'];

function gull(api, o) {
  const s = o.s || 1.7, g = api.group({ x: o.x, y: o.y || 0, z: o.z, rot: o.rot || 0 });
  [-0.03, 0.03].forEach(x => g.add(api.colourOnly(api.cylinder({ r: 0.012 * s, h: 0.1 * s, x: x * s, y: 0.05 * s, ramp: CORK, seg: 4 }))));
  g.add(api.sphere({ r: 0.1 * s, sx: 0.8, sy: 0.8, sz: 1.7, y: 0.17 * s, ramp: GULL, seg: 12 }));
  [-1, 1].forEach(sd => g.add(api.sphere({ r: 0.07 * s, sx: 0.4, sy: 0.6, sz: 2.2, x: sd * 0.065 * s, y: 0.2 * s, z: -0.04 * s, ramp: GULL_WING, seg: 8 })));
  const head = api.group({ y: 0.25 * s, z: 0.12 * s }); head.name = 'look'; head.userData.ph = api.range(0, 6.28);
  head.add(api.sphere({ r: 0.065 * s, y: 0.03 * s, ramp: GULL, seg: 10 }));
  head.add(api.cone({ r: 0.018 * s, h: 0.09 * s, y: 0.02 * s, z: 0.09 * s, rx: Math.PI / 2, ramp: api.ramps.YELLOW, seg: 5 }));
  g.add(head);
  return g;
}

export function build(api) {
  const R = api.ramps, g = api.group();

  // the sand strip
  const sand = [];
  for (let i = 0; i < 30; i++) {
    const a = i / 30 * Math.PI * 2, c = Math.cos(a), sn = Math.sin(a), k = Math.pow(Math.pow(Math.abs(c), 3) + Math.pow(Math.abs(sn), 3), -1 / 3);
    sand.push([c * k * 3.4 + 0.1 * Math.sin(a * 5), -sn * k * 2.4 + 0.08 * Math.cos(a * 4)]);
  }
  g.add(api.extrude({ shape: sand, depth: 0.04, rx: -Math.PI / 2, y: 0.02, ramp: SAND, speck: 0.3 }));

  // four drying poles and the head-rope along their tops
  const pz = -0.9, ph = 2.7, xs = [-2.85, -0.95, 0.95, 2.85];
  xs.forEach((x, i) => g.add(api.cylinder({ rt: 0.06, rb: 0.085, h: ph, x, y: ph / 2, z: pz, rz: (i - 1.5) * 0.02, ramp: R.WOOD, seg: 8 })));
  g.add(api.cylinder({ r: 0.035, h: 5.9, y: ph - 0.15, z: pz, rz: Math.PI / 2, ramp: R.WOOD, seg: 6 }));

  // the hanging nets: each a sagging panel (and a shorter fold in front of it) on a pivot at the head-rope
  const nets = [RED_NET, HEMP, RED_NET];
  for (let i = 0; i < 3; i++) {
    const cx = (xs[i] + xs[i + 1]) / 2, half = (xs[i + 1] - xs[i]) / 2 - 0.12, drop = api.range(1.55, 1.85);
    const net = api.group({ x: cx, y: ph - 0.18, z: pz + 0.06 }); net.name = 'net'; net.userData.ph = api.range(0, 6.28);
    const panel = [[-half, 0], [-half * 0.5, -0.07], [0, -0.09], [half * 0.5, -0.07], [half, 0], [half * 0.94, -drop * 0.72], [half * 0.5, -drop * 0.95], [0, -drop], [-half * 0.55, -drop * 0.9], [-half * 0.95, -drop * 0.68]];
    net.add(api.extrude({ shape: panel, depth: 0.05, ramp: nets[i], speck: 0.38 }));
    const fold = [[-half * 0.55, -0.05], [half * 0.45, -0.05], [half * 0.35, -drop * 0.55], [0, -drop * 0.7], [-half * 0.45, -drop * 0.5]];
    net.add(api.extrude({ shape: fold, depth: 0.04, z: 0.06, ramp: nets[i], lift: 0.06, speck: 0.4 }));
    for (let k = 0; k < 4; k++) net.add(api.colourOnly(api.cylinder({ r: 0.07, h: 0.12, x: -half + (k + 0.5) * half / 2, y: -0.06, z: 0.05, rx: Math.PI / 2, ramp: CORK, seg: 8 })));
    g.add(net);
  }

  // a net spread flat on the sand to dry
  const spread = [];
  for (let i = 0; i < 18; i++) { const a = i / 18 * Math.PI * 2, r = 1.0 + 0.2 * Math.sin(a * 3 + 0.4) + 0.12 * Math.sin(a * 5); spread.push([Math.cos(a) * r * 1.3, -Math.sin(a) * r * 0.75]); }
  g.add(api.extrude({ shape: spread, depth: 0.03, rx: -Math.PI / 2, x: -1.4, y: 0.055, z: 1.3, rot: 0.15, ramp: RED_NET, speck: 0.4, lift: 0.04 }));
  // a heaped net with a coil of rope on the right
  g.add(api.sphere({ r: 0.62, sy: 0.5, sx: 1.2, x: 1.85, y: 0.3, z: 1.15, ramp: RED_NET, speck: 0.4, seg: 12 }));
  g.add(api.sphere({ r: 0.42, sy: 0.55, x: 2.25, y: 0.42, z: 1.0, ramp: HEMP, speck: 0.4, seg: 10 }));
  g.add(api.torus({ r: 0.3, tube: 0.07, x: 0.95, y: 0.08, z: 1.75, ramp: HEMP }));
  g.add(api.torus({ r: 0.22, tube: 0.065, x: 0.95, y: 0.2, z: 1.75, ramp: HEMP, lift: 0.05 }));
  // two wicker baskets and a fish crate
  g.add(api.cylinder({ rt: 0.32, rb: 0.24, h: 0.42, x: 2.7, y: 0.25, z: 1.9, ramp: R.OCHRE, speck: 0.35, seg: 14 }));
  g.add(api.cylinder({ rt: 0.26, rb: 0.2, h: 0.34, x: 2.15, y: 0.21, z: 2.05, ramp: R.OCHRE, speck: 0.35, lift: -0.06, seg: 14 }));
  g.add(api.crate({ s: 0.55, x: -3.0, z: 0.25 }));

  // gulls: two on pole tops, one on the spread net
  g.add(gull(api, { x: xs[0], y: ph, z: pz, rot: 0.6 }));
  g.add(gull(api, { x: xs[3], y: ph, z: pz, rot: -0.9 }));
  g.add(gull(api, { x: -1.0, y: 0.07, z: 1.5, rot: 2.2 }));
  return g;
}

const parts = new WeakMap();
export function animate(obj, t) {
  let p = parts.get(obj);
  if (!p) { p = { nets: [], heads: [] }; obj.traverse(o => { if (o.name === 'net') p.nets.push(o); else if (o.name === 'look') p.heads.push(o); }); parts.set(obj, p); }
  for (const n of p.nets) { const ph = n.userData.ph; n.rotation.x = -0.1 - 0.08 * Math.sin(t * 0.8 + ph) - 0.03 * Math.sin(t * 2.1 + ph * 2); }
  for (const h of p.heads) { const ph = h.userData.ph, s = Math.sin(t * 0.35 + ph); h.rotation.y = s > 0.4 ? 0.9 : s < -0.4 ? -0.9 : 0; }
}
