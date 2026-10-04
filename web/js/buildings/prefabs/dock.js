// Dock: a limestone quay with a little red net-shed under a terracotta roof, a timber jetty on piles running out
// to +z with iron bollards and a striped mooring pole, and a blue fishing boat (red gunwale, raised stem) drawn
// up on chocks beside it, its lateen sail hung out to dry; fish crates, a barrel and a coil of rope on the quay.
// Footprint 6 x 4. The jetty points to +z: place it with the jetty toward the water.
export const meta = { id: 'dock', footprint: { w: 6, d: 4 }, height: 3.6 };

export function build(api) {
  const R = api.ramps, g = api.group();

  // the quay: one long limestone slab along the back, a step down to the strand in front
  const qz = -1.25, qd = 1.5, qh = 0.5;
  g.add(api.box({ w: 6.0, h: qh, d: qd, y: qh / 2, z: qz, ramp: R.LIMESTONE, speck: 0.24 }));
  g.add(api.box({ w: 6.0, h: 0.08, d: 2.5, y: 0.04, z: 0.75, ramp: R.SAND, speck: 0.22 }));

  // the net shed on the quay: red walls, terracotta gable, an arched ink door
  const hx = -1.75, hz = -1.3, hw = 2.0, hd = 1.2, hh = 1.6, top = qh + hh;
  g.add(api.box({ w: hw, h: hh, d: hd, x: hx, y: qh + hh / 2, z: hz, mat: api.lambert('#c23a2c', 0.12) }));
  g.add(api.gableRoof({ w: hw, d: hd, h: 0.65, overhang: 0.2, x: hx, y: top, z: hz, ramp: R.TERRACOTTA }));
  g.add(api.inkDoor({ w: 0.62, h: 1.15, x: hx + 0.35, y: qh, z: hz + hd / 2, frame: R.LIMESTONE }));
  g.add(api.inkWindow({ w: 0.36, h: 0.4, x: hx - 0.5, y: qh + 1.0, z: hz + hd / 2, frame: false, shutters: R.SEA }));

  // the jetty: a plank deck at quay height, running out over the strand on four pairs of piles
  const jx = 1.75, jw = 1.3, jz0 = -0.55, jz1 = 1.95, deckY = qh - 0.07;
  g.add(api.box({ w: jw, h: 0.14, d: jz1 - jz0, x: jx, y: deckY, z: (jz0 + jz1) / 2, ramp: R.WOOD, lift: 0.1 }));
  for (let i = 0; i < 4; i++) for (let s = -1; s <= 1; s += 2)
    g.add(api.cylinder({ r: 0.09, h: deckY + 0.05, x: jx + s * (jw / 2 - 0.05), y: (deckY + 0.05) / 2, z: jz0 + 0.35 + i * 0.68, ramp: R.WOOD, lift: -0.15, seg: 8 }));
  // iron bollards at the end, a red-and-cream mooring pole
  for (let s = -1; s <= 1; s += 2) g.add(api.cylinder({ rb: 0.11, rt: 0.08, h: 0.26, x: jx + s * 0.42, y: deckY + 0.2, z: jz1 - 0.2, ramp: R.IRON, seg: 10 }));
  g.add(api.cylinder({ r: 0.08, h: 2.6, x: jx + jw / 2 + 0.1, y: 1.3, z: jz1 - 0.05, ramp: R.WOOD, seg: 8 }));
  for (let i = 0; i < 2; i++) g.add(api.cylinder({ r: 0.095, h: 0.32, x: jx + jw / 2 + 0.1, y: 1.85 + i * 0.55, z: jz1 - 0.05, ramp: R.REDWALL, seg: 8 }));

  // the fishing boat on chocks: an upturned-dome hull, plank floor, red gunwale, stem and stern posts
  const bx = -0.95, bz = 0.95, L = 3.0, B = 1.05, rim = 0.78;
  g.add(api.box({ w: 0.25, h: 0.3, d: 0.75, x: bx - 0.7, y: 0.23, z: bz, ramp: R.WOOD, lift: -0.15 }));
  g.add(api.box({ w: 0.25, h: 0.3, d: 0.75, x: bx + 0.7, y: 0.23, z: bz, ramp: R.WOOD, lift: -0.15 }));
  g.add(api.dome({ r: 0.5, h: 0.5, sx: L, sz: B, rx: Math.PI, x: bx, y: rim, z: bz, ramp: R.BLUE, seg: 26 }));
  g.add(api.cylinder({ r: 0.47, h: 0.05, sx: L, sz: B, x: bx, y: rim - 0.08, z: bz, ramp: R.WOOD, lift: 0.1, seg: 26 }));
  g.add(api.torus({ r: 0.5, tube: 0.045, sx: L, sz: B, x: bx, y: rim, z: bz, ramp: R.REDWALL, seg: 28 }));
  g.add(api.box({ w: 0.1, h: 0.62, d: 0.1, x: bx + L / 2 - 0.02, y: rim + 0.12, z: bz, rz: -0.35, ramp: R.REDWALL }));
  g.add(api.box({ w: 0.1, h: 0.36, d: 0.1, x: bx - L / 2 + 0.06, y: rim + 0.02, z: bz, rz: 0.3, ramp: R.REDWALL }));
  g.add(api.box({ w: 0.12, h: 0.06, d: B * 0.9, x: bx + 0.2, y: rim - 0.02, z: bz, ramp: R.WOOD }));   // thwart
  g.add(api.box({ w: 1.8, h: 0.05, d: 0.08, x: bx - 0.1, y: rim + 0.05, z: bz + 0.18, rot: 0.12, ramp: R.WOOD, lift: 0.1 }));   // an oar laid across

  // a short mast stepped in the boat with its lateen sail hung out to dry (the boat's big silhouette)
  // (the mast stands toward the stern; the triangle runs forward from it and the yard lies along its long edge)
  const mast = bx - 0.85, sw = 1.95, sh = 2.1, sy0 = rim + 0.28, yard = Math.hypot(sw, sh) + 0.55;
  g.add(api.cylinder({ rb: 0.06, rt: 0.045, h: 2.45, x: mast, y: rim - 0.08 + 1.22, z: bz, ramp: R.WOOD, seg: 8 }));
  g.add(api.sail({ w: sw, h: sh, billow: 0.26, tri: true, x: mast, y: sy0, z: bz + 0.06, ramp: R.WHITEWASH }));
  g.add(api.cylinder({ r: 0.035, h: yard, x: mast + sw / 2, y: sy0 + sh / 2, z: bz + 0.05, rz: Math.atan2(sw, sh), ramp: R.WOOD, seg: 8 }));

  // fish crates, a barrel and a coil of rope on the quay
  g.add(api.crate({ s: 0.5, x: 0.45, y: qh, z: -1.15, rot: 0.2, ramp: R.WOOD }));
  g.add(api.crate({ s: 0.42, x: 0.95, y: qh, z: -0.95, rot: -0.15, ramp: R.WOOD }));
  g.add(api.crate({ s: 0.4, x: 0.55, y: qh + 0.5, z: -1.15, rot: 0.05, ramp: R.WOOD, lift: 0.1 }));
  g.add(api.barrel({ r: 0.25, h: 0.62, x: -0.35, y: qh, z: -0.8 }));
  g.add(api.torus({ r: 0.2, tube: 0.07, x: 2.55, y: qh + 0.07, z: -1.2, ramp: R.SAND, seg: 18 }));

  // keylines: the jetty deck + piles as one slab
  api.proxy(api.boxGeo({ w: jw, h: deckY + 0.07, d: jz1 - jz0, x: jx, y: (deckY + 0.07) / 2, z: (jz0 + jz1) / 2 }), g);
  return g;
}
