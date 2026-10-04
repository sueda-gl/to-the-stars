// Footbridge: a small wooden plank bridge with a gentle hump, carried on two log stringers between rough
// limestone abutments, a handrail of posts and a rail on both sides. Spans x (about 5 m), so it sits across a
// stream or ditch; y = 0 is the bank. From above: a pale plank deck with dark rails and stone ends.
export const meta = {
  id: 'footbridge', name: 'Footbridge', aliases: ['foot bridge', 'wooden bridge', 'plank bridge', 'little bridge', 'small bridge', 'stream bridge', 'ahşap köprü', 'küçük köprü', 'yaya köprüsü'],
  category: 'building', stage: 'hamlet', footprint: { w: 6.5, d: 1.8 }, height: 1.9, desc: 'a small humped plank footbridge on log stringers with stone abutments and handrails'
};

const STONE = ['#4c463f', '#6c645a', '#8e8576', '#aca28f', '#c3b9a3'];
const PLANK = ['#4f3a26', '#6f5236', '#906c47', '#a98258', '#bb9566'];
// an angular stone block: a box whose corners are knocked out of square and whose top narrows (strata, megaliths)
function blockGeo(api, { w = 1, h = 1, d = 1, taper = 0.15, j = 0.12, lean = 0 } = {}) {
  let geo = api.boxGeo({ w, h, d, y: h / 2 });
  const p = geo.attributes.position, s = api.range(0, 50);
  const n = (x, y, z, k) => Math.sin(x * 12.9898 + y * 78.233 + z * 37.719 + s * k) * 0.5 + Math.sin(x * 4.1 - z * 7.7 + y * 3.3 + s) * 0.5;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), t = y / h, k = 1 - taper * t;
    p.setXYZ(i, x * k + j * w * n(x, y, z, 1) + lean * y, y + j * h * 0.35 * n(x, y, z, 2), z * k + j * d * n(x, y, z, 3));
  }
  geo = geo.toNonIndexed(); geo.computeVertexNormals();
  return geo;
}
function block(api, g, o) {
  const geo = blockGeo(api, o);
  if (o.tilt) geo.rotateZ(o.tilt);
  if (o.tiltX) geo.rotateX(o.tiltX);
  geo.rotateY(o.rot || 0);
  geo.translate(o.x || 0, o.y || 0, o.z || 0);
  const m = api.mesh(geo, o.ramp || STONE, { speck: o.speck ?? 0.26, lift: o.lift || 0 });
  geo.computeBoundingBox(); m.userData.top = geo.boundingBox.max.y;
  g.add(m); return m;
}

export function build(api) {
  const R = api.ramps, g = api.group();
  const L = 5.0, hl = L / 2, W = 1.2, y0 = 0.5, rise = 0.32;
  const deckAt = x => y0 + rise * (1 - (x / hl) * (x / hl));   // a gentle parabola
  const slopeAt = x => -2 * rise * x / (hl * hl);
  // abutments: rough stone blocks at each end
  [-1, 1].forEach(s => {
    block(api, g, { w: 1.1, h: y0 + 0.05, d: W + 0.5, x: s * (hl + 0.15), taper: 0.1, j: 0.07, ramp: STONE });
    block(api, g, { w: 0.6, h: 0.3, d: 0.6, x: s * (hl + 0.75), z: 0.75, taper: 0.2, j: 0.12, ramp: STONE, rot: api.range(0, 3) });
  });
  // two log stringers following the hump
  [-1, 1].forEach(s => {
    const pts = []; for (let i = 0; i <= 6; i++) { const x = -hl - 0.2 + i * (L + 0.4) / 6; pts.push([x, deckAt(Math.max(-hl, Math.min(hl, x))) - 0.14, s * (W / 2 - 0.12)]); }
    g.add(api.tube({ points: pts, r: 0.11, ramp: R.WOOD, seg: 24 }));
  });
  // planks across, each tipped to the slope, alternate ones a touch lighter
  const N = 14;
  for (let i = 0; i < N; i++) {
    const x = -hl + (i + 0.5) * L / N;
    g.add(api.box({ w: L / N - 0.05, h: 0.07, d: W + api.range(-0.04, 0.06), x, y: deckAt(x), z: api.range(-0.03, 0.03), rz: Math.atan(slopeAt(x)), ramp: PLANK, lift: i % 2 ? 0.05 : -0.02, speck: 0.2 }));
  }
  // handrails: posts and a rail on both sides
  [-1, 1].forEach(s => {
    const z = s * (W / 2 + 0.02), px = [-hl + 0.15, -hl / 2.6, hl / 2.6, hl - 0.15], pts = [];
    px.forEach(x => { const b = deckAt(x); g.add(api.box({ w: 0.1, h: 0.85, d: 0.1, x, y: b + 0.4, z, ramp: R.WOOD })); });
    for (let i = 0; i <= 8; i++) { const x = -hl + 0.1 + i * (L - 0.2) / 8; pts.push([x, deckAt(x) + 0.82, z]); }
    g.add(api.tube({ points: pts, r: 0.045, ramp: R.WOOD, seg: 24 }));
  });
  // one outline for the deck
  const T = api.THREE, s = new T.Shape(); s.isShape = true;
  for (let i = 0; i <= 12; i++) { const x = -hl + i * L / 12; if (i) s.lineTo(x, deckAt(x) + 0.035); else s.moveTo(x, deckAt(x) + 0.035); }
  for (let i = 12; i >= 0; i--) { const x = -hl + i * L / 12; s.lineTo(x, deckAt(x) - 0.2); }
  api.proxy(api.extrudeGeo({ shape: s, depth: W }), g);
  return g;
}
