// Reeds: a clump of reeds and bulrushes at the water's edge. Tall green-to-straw blades fan out of muddy
// tussocks in five bundles, with dark velvet bulrush heads on stiff stems. y = 0 is the water line; the
// tussocks just break the surface. From above, starbursts of blades; up close, a stand of reeds.
export const meta = {
  id: 'reeds', name: 'Reeds', aliases: ['reed', 'reed bed', 'reedbed', 'rushes', 'bulrushes', 'cattails', 'sedge', 'kamış', 'sazlık', 'saz'],
  category: 'nature', stage: 'camp', water: true, footprint: { w: 3.5, d: 2.5 }, height: 2.2, desc: 'a clump of reeds and bulrushes rising from muddy tussocks at the water line'
};

const MUD = ['#2c241b', '#43372a', '#5c4c3a', '#72604a', '#83705a'];
const BLADE = ['#2f3a17', '#4a5a22', '#6a7a2e', '#8c983e', '#a5ad4f'];
const STRAW = ['#5c4a1c', '#836b26', '#a98d36', '#c4a84a', '#d6bc5e'];
const HEAD = ['#22160f', '#3a2618', '#553923', '#6b4a2e', '#7c5838'];
const STONE = MUD, SCRUB = BLADE;
// a faceted boulder: a low-poly sphere pushed out of round by smooth noise, flat underneath, flat-shaded facets
// (smooth: true keeps it round-shaded, for bushes and mounds)
function rockGeo(api, { r = 1, sx = 1, sy = 0.7, sz = 1, seg = 7, rough = 0.2, sink = 0.12, smooth = false } = {}) {
  let geo = api.sphereGeo({ r: 1, seg });
  const p = geo.attributes.position, a = api.range(0, 9), b = api.range(0, 9), c = api.range(0, 9);
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const k = 1 + rough * (Math.sin(x * 2.1 + a) * Math.cos(y * 2.7 + b) + 0.6 * Math.sin(z * 3.3 + c + x * 1.7));
    x *= k; y *= k; z *= k;
    if (y < -0.3) y = -0.3 + (y + 0.3) * 0.2;   // a flattened foot, so it sits instead of balancing
    p.setXYZ(i, x * r * sx, y * r * sy, z * r * sz);
  }
  if (!smooth) geo = geo.toNonIndexed();
  geo.computeVertexNormals(); geo.computeBoundingBox();
  geo.translate(0, -geo.boundingBox.min.y - sink * r * sy, 0);
  return geo;
}
function rock(api, g, o) {
  const geo = rockGeo(api, o);
  geo.rotateY(o.rot || 0);
  if (o.tilt) geo.rotateZ(o.tilt);
  if (o.tiltX) geo.rotateX(o.tiltX);
  geo.translate(o.x || 0, o.y || 0, o.z || 0);
  const m = api.mesh(geo, o.ramp || STONE, { speck: o.speck ?? 0.24, lift: o.lift || 0 });
  geo.computeBoundingBox(); m.userData.top = geo.boundingBox.max.y;
  g.add(m); return m;
}
// a scrub mound: a round, softly lumpy bush (smooth-shaded, one outline), never a flat pad
function scrub(api, g, { x = 0, y = 0, z = 0, r = 0.5, h = r * 0.85, ramp = SCRUB }) {
  return rock(api, g, { r, sx: 1, sy: h / r, sz: 1, x, y, z, seg: 12, rough: 0.12, sink: 0.05, smooth: true, rot: api.range(0, 6.28), ramp, speck: 0.3 });
}

export function build(api) {
  const g = api.group(), sway = api.group(); sway.name = 'sway';
  const bundles = [[-1.1, -0.3, 1.0], [-0.2, -0.6, 1.15], [0.8, -0.2, 1.0], [0.25, 0.55, 0.8], [-0.95, 0.6, 0.7], [1.35, 0.6, 0.65]];
  bundles.forEach(([x, z, s]) => {
    // the tussock the bundle grows from, just breaking the water
    rock(api, g, { r: 0.32 * s + 0.08, sy: 0.45, x, z, seg: 9, rough: 0.14, smooth: true, sink: 0, ramp: MUD });
    // blades: slim cones fanning outward from the tussock, taller in the middle (paint only: no pencil on grass)
    const n = 8, a0 = api.range(0, 6.28);
    for (let i = 0; i < n; i++) {
      const a = a0 + i / n * Math.PI * 2 + api.range(-0.3, 0.3), h = s * api.range(1.3, 2.0) * (i % 3 ? 1 : 0.8), t = api.range(0.1, 0.3);
      const bx = x + Math.cos(a) * 0.12, bz = z + Math.sin(a) * 0.12;
      // tip the cone outward: the base stays at (bx, 0.1, bz)
      const b = api.cone({ r: 0.075, h, seg: 4, x: bx + Math.cos(a) * Math.sin(t) * h / 2, y: 0.1 + Math.cos(t) * h / 2, z: bz + Math.sin(a) * Math.sin(t) * h / 2,
        rz: -Math.cos(a) * t, rx: Math.sin(a) * t, ramp: i % 3 === 2 ? STRAW : BLADE, speck: 0.1, lift: api.range(-0.04, 0.06) });
      api.colourOnly(b); sway.add(b);
    }
    // one or two bulrushes per bundle: a stiff stem and a dark velvet head
    for (let k = 0; k < (s > 0.9 ? 2 : 1); k++) {
      const h = s * api.range(1.5, 1.9), bx = x + api.range(-0.12, 0.12), bz = z + api.range(-0.12, 0.12);
      const st = api.cylinder({ r: 0.022, h, x: bx, y: h / 2 + 0.1, z: bz, ramp: BLADE, seg: 5 });
      api.colourOnly(st); sway.add(st);
      sway.add(api.lathe({ points: [[0, 0], [0.055, 0.03], [0.075, 0.12], [0.07, 0.26], [0.045, 0.34], [0, 0.37]], x: bx, y: h * 0.8 + 0.1, z: bz, ramp: HEAD, seg: 10, speck: 0.08 }));
    }
  });
  g.add(sway);
  return g;
}

// the blades and bulrushes sway a little in the wind (the tussocks stay put)
export function animate(obj, t) {
  const s = obj.getObjectByName('sway');
  if (s) { s.rotation.z = Math.sin(t * 0.9) * 0.014; s.rotation.x = Math.sin(t * 0.7 + 1) * 0.008; }
}
