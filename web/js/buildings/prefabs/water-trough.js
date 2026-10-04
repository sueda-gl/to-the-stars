// Water barrels and trough: the camp's water. A tall rain barrel on a stone stand spills through a hollowed-
// log chute into a long wooden trough of blue water on two stone feet; two more barrels (one open, brim-full)
// stand by, with a bucket and a dipper. The trickle and the water shimmer (animate). Footprint 3.4 x 2.2,
// the trough's long side faces +z.
export const meta = {
  id: 'water-trough', name: 'Water barrels and trough', aliases: ['water troughs', 'trough', 'troughs', 'water barrels', 'water barrel', 'rain barrel', 'cistern', 'watering trough', 'su teknesi', 'yalak', 'su fıçısı', 'su varili'],
  category: 'prop', stage: 'camp', footprint: { w: 3.4, d: 2.2 }, height: 2.0,
  desc: 'A rain barrel on a stone stand spilling down a log chute into a wooden trough, with barrels and a bucket.'
};

export function build(api) {
  const R = api.ramps, g = api.group();
  const tx = 0.35, tz = 0.25, TW = 2.1, TD = 0.66, TH = 0.5;   // trough centre, length, width, height

  // wet ground: a darker patch round the trough
  g.add(api.colourOnly(api.cylinder({ r: 1, h: 0.03, x: tx, y: 0.015, z: tz + 0.1, sx: 1.55, sz: 0.85, color: '#a8916c', speck: 0.3, seg: 24 })));

  // the trough: two stone feet, a plank box, blue water inset at the brim
  [-1, 1].forEach(s => g.add(api.box({ w: 0.36, h: 0.22, d: TD + 0.16, x: tx + s * (TW / 2 - 0.35), y: 0.11, z: tz, ramp: R.LIMESTONE, lift: -0.04 })));
  const pt = 0.08;   // plank thickness: a floor, two long sides and two ends, so the water shows inside
  g.add(api.box({ w: TW, h: pt, d: TD, x: tx, y: 0.22 + pt / 2, z: tz, ramp: R.WOOD, lift: -0.1 }));
  [-1, 1].forEach(s => {
    g.add(api.box({ w: TW, h: TH, d: pt, x: tx, y: 0.22 + TH / 2, z: tz + s * (TD / 2 - pt / 2), ramp: R.WOOD, lift: 0.06, speck: 0.28 }));
    g.add(api.box({ w: pt, h: TH, d: TD - 2 * pt, x: tx + s * (TW / 2 - pt / 2), y: 0.22 + TH / 2, z: tz, ramp: R.WOOD, lift: 0.0, speck: 0.28 }));
  });
  [-1, 1].forEach(s => g.add(api.box({ w: 0.08, h: TH + 0.06, d: TD + 0.06, x: tx + s * (TW / 2 - 0.12), y: 0.22 + TH / 2, z: tz, ramp: R.IRON, lift: 0.1 })));   // iron bands
  const water = api.box({ w: TW - 2 * pt, h: 0.04, d: TD - 2 * pt, x: tx, y: 0.22 + TH - 0.08, z: tz, ramp: R.SEA, lift: 0.08, speck: 0.08 });
  water.name = 'water'; g.add(water);

  // the rain barrel on its stone stand, at the trough's left end, with a hollowed-log chute into the trough
  const bx = tx - TW / 2 - 0.45, bz = tz - 0.15;
  g.add(api.box({ w: 0.86, h: 0.5, d: 0.86, x: bx, y: 0.25, z: bz, ramp: R.LIMESTONE, lift: -0.02, speck: 0.3 }));
  g.add(api.barrel({ r: 0.38, h: 1.05, x: bx, y: 0.5, z: bz }));
  g.add(api.cylinder({ r: 0.36, h: 0.03, x: bx, y: 1.56, z: bz, ramp: R.SEA, lift: 0.05 }));
  const cy0 = 1.2, cy1 = 0.22 + TH + 0.12, cx0 = bx + 0.35, cx1 = tx - TW / 2 + 0.45, cl = Math.hypot(cx1 - cx0, cy0 - cy1), ct = Math.atan2(cy0 - cy1, cx1 - cx0);
  g.add(api.cylinder({ r: 0.09, h: cl, x: (cx0 + cx1) / 2, y: (cy0 + cy1) / 2, z: tz - 0.05, rz: Math.PI / 2 - ct, ramp: R.WOOD, lift: -0.06, seg: 8 }));
  g.add(api.cylinder({ r: 0.065, h: cl * 0.96, x: (cx0 + cx1) / 2, y: (cy0 + cy1) / 2 + 0.04, z: tz - 0.05, rz: Math.PI / 2 - ct, ramp: R.SEA, lift: 0.1, seg: 8 }));
  // the trickle falling from the chute's lip into the trough
  const tr = api.cylinder({ r: 0.035, h: cy1 - (0.22 + TH - 0.04) + 0.06, x: cx1 + 0.04, y: (cy1 + 0.22 + TH - 0.04) / 2, z: tz - 0.05, ramp: R.SEA, lift: 0.2, seg: 6 });
  tr.name = 'trickle'; g.add(tr);

  // two barrels standing behind the trough: one lidded, one open and brim-full
  g.add(api.barrel({ r: 0.32, h: 0.86, x: tx + 0.55, z: tz - 0.78 }));
  g.add(api.cylinder({ r: 0.31, h: 0.05, x: tx + 0.55, y: 0.885, z: tz - 0.78, ramp: R.WOOD, lift: 0.1, seg: 16 }));
  g.add(api.barrel({ r: 0.3, h: 0.8, x: tx + 1.2, z: tz - 0.6 }));
  g.add(api.cylinder({ r: 0.28, h: 0.03, x: tx + 1.2, y: 0.775, z: tz - 0.6, ramp: R.SEA, lift: 0.06, seg: 16 }));

  // a wooden bucket with its rope handle, and a gourd dipper resting on the trough's rim
  g.add(api.cylinder({ rb: 0.17, rt: 0.21, h: 0.34, x: tx + 1.05, y: 0.17, z: tz + 0.62, ramp: R.WOOD, lift: 0.04, seg: 12 }));
  g.add(api.cylinder({ r: 0.19, h: 0.02, x: tx + 1.05, y: 0.33, z: tz + 0.62, ramp: R.SEA, seg: 12 }));
  g.add(api.torus({ r: 0.2, tube: 0.018, x: tx + 1.05, y: 0.34, z: tz + 0.62, flat: false, rot: 0.4, ramp: R.SAND, seg: 14 }));
  g.add(api.sphere({ r: 0.12, sy: 0.75, x: tx + 0.55, y: 0.22 + TH + 0.06, z: tz + TD / 2 + 0.02, ramp: R.OCHRE, seg: 10 }));
  g.add(api.cylinder({ r: 0.025, h: 0.4, x: tx + 0.35, y: 0.22 + TH + 0.08, z: tz + TD / 2 + 0.02, rz: Math.PI / 2, ramp: R.OCHRE, lift: 0.1, seg: 6 }));

  // keylines: one box for the trough (its bands and water are paint only)
  api.proxy(api.boxGeo({ w: TW, h: TH, d: TD, x: tx, y: 0.22 + TH / 2, z: tz }), g);
  return g;
}

// the trickle wavers and the water in the trough shimmers
export function animate(obj, t) {
  const tr = obj.getObjectByName('trickle');
  if (tr) { tr.scale.x = tr.scale.z = 1 + 0.25 * Math.sin(t * 11.0); }
  const w = obj.getObjectByName('water');
  if (w) w.scale.y = 1 + 0.4 * Math.sin(t * 2.3);
}
