// Vegetable patch: a kitchen garden of six raised beds in wooden frames on a sand path grid: cabbages,
// lettuces, staked tomatoes (the red accent), bean tepees, carrot rows and big-leaved squash. A reed
// fence round three sides, a water barrel in the back corner. 9 x 7 m, the open side faces +z.
export const meta = {
  id: 'vegetable-patch', name: 'Vegetable patch', category: 'farm', stage: 'camp', area: true,
  aliases: ['vegetable garden', 'vegetables', 'veg patch', 'veggie patch', 'kitchen garden', 'allotment', 'garden beds', 'raised beds', 'vegetable beds', 'sebze bahçesi', 'bostan', 'sebzelik'],
  footprint: { w: 9, d: 7 }, height: 1.9,
  desc: 'six raised beds of cabbages, lettuce, tomatoes, beans, carrots and squash on sand paths, fenced on three sides'
};

export function build(api) {
  const R = api.ramps, g = api.group();
  const W = 9, D = 7;
  g.add(api.box({ w: W, h: 0.08, d: D, y: 0.04, color: '#d8c094', speck: 0.1 }));   // sand paths

  const bw = 3.4, bd = 1.55, bh = 0.3;
  const cols = [-2.05, 2.05], rows = [-2.15, 0, 2.15];
  // shuffle the crops a little per variant, keeping the tall ones (beans, tomatoes) in the back row
  const back = api.rand() < 0.5 ? ['beans', 'tomato'] : ['tomato', 'beans'];
  const rest = ['cabbage', 'lettuce', 'carrot', 'squash'].sort(() => api.rand() - 0.5);
  const plan = [back[0], back[1], rest[0], rest[1], rest[2], rest[3]];
  let k = 0;
  for (let r = 0; r < 3; r++) for (let c = 0; c < 2; c++) {
    const bx = cols[c], bz = rows[r], crop = plan[k++];
    g.add(api.box({ w: bw, h: bh, d: bd, x: bx, y: 0.08 + bh / 2, z: bz, ramp: R.WOOD, speck: 0.1 }));
    g.add(api.box({ w: bw - 0.2, h: 0.06, d: bd - 0.2, x: bx, y: 0.08 + bh + 0.01, z: bz, color: '#5e4128', speck: 0.1 }));
    const top = 0.08 + bh + 0.04;
    // a low leafy layer under the crop, so the bed still reads green when the brush paints it from far away
    if (crop !== 'beans' && crop !== 'tomato') g.add(api.colourOnly(api.box({ w: bw - 0.32, h: 0.1, d: bd - 0.32, x: bx, y: top + 0.01, z: bz, color: crop === 'cabbage' ? '#6f8762' : '#6f833d', speck: 0.06, lift: -0.06 })));
    bed(api, g, crop, bx, top, bz, bw - 0.3, bd - 0.3);
  }

  // reed fence on the back and both sides, and a water barrel in the back corner
  g.add(api.fence({ points: [[-W / 2 + 0.15, D / 2 - 0.3], [-W / 2 + 0.15, -D / 2 + 0.15], [W / 2 - 0.15, -D / 2 + 0.15], [W / 2 - 0.15, D / 2 - 0.3]], h: 0.8, gap: 1.5 }));
  g.add(api.barrel({ r: 0.32, h: 0.8, x: W / 2 - 0.6, y: 0.08, z: -D / 2 + 0.6 }));
  return g;
}

function bed(api, g, crop, x, y, z, w, d) {
  const R = api.ramps;
  if (crop === 'cabbage') {
    for (let i = 0; i < 5; i++) for (let j = 0; j < 2; j++)
      g.add(api.sphere({ r: api.range(0.26, 0.32), sy: 0.78, x: x - w / 2 + 0.33 + i * (w - 0.66) / 4, y: y + 0.18, z: z - d / 4 + j * d / 2, ramp: R.SAGE, lift: api.range(-0.05, 0.08), seg: 14 }));
  } else if (crop === 'lettuce') {
    for (let i = 0; i < 6; i++) for (let j = 0; j < 2; j++)
      g.add(api.sphere({ r: api.range(0.2, 0.24), sy: 0.7, x: x - w / 2 + 0.25 + i * (w - 0.5) / 5, y: y + 0.12, z: z - d / 4 + j * d / 2, color: '#86a648', lift: api.range(0, 0.1), seg: 12 }));
  } else if (crop === 'carrot') {
    // three rows of feathery tops: small upright tufts with a little orange shoulder showing at the front row
    for (let j = 0; j < 3; j++) for (let i = 0; i < 8; i++) {
      const px = x - w / 2 + 0.2 + i * (w - 0.4) / 7, pz = z - d / 3 + j * d / 3;
      g.add(api.sphere({ r: 0.17, sy: 1.2, x: px + api.range(-0.04, 0.04), y: y + 0.17, z: pz, color: '#8fae4c', speck: 0.1, lift: api.range(-0.04, 0.08), seg: 8 }));
      if (j === 2 && i % 2 === 0) g.add(api.cylinder({ rb: 0.05, rt: 0.06, h: 0.07, x: px, y: y + 0.03, z: pz + 0.12, ramp: ['#7a3510', '#b0561a', '#d87628', '#e88c36', '#f09d44'], seg: 8 }));
    }
  } else if (crop === 'squash') {
    // three big low leaf mounds, each with a couple of yellow-orange squashes peeping out at the front
    for (let i = 0; i < 3; i++) {
      const px = x - w / 3 + i * w / 3;
      g.add(api.sphere({ r: 0.5, sy: 0.55, sx: 1.05, x: px, y: y + 0.12, z, ramp: R.OLIVE, speck: 0.1, lift: api.range(-0.1, 0.02), seg: 14 }));
      for (let f = 0; f < 2; f++)
        g.add(api.sphere({ r: 0.13, sx: 1.5, x: px - 0.22 + f * 0.42, y: y + 0.1, z: z + 0.36 - f * 0.12, ramp: R.YELLOW, lift: -0.05, seg: 10 }));
    }
  } else if (crop === 'tomato') {
    for (let i = 0; i < 4; i++) {
      const px = x - w / 2 + 0.4 + i * (w - 0.8) / 3;
      // a bushy plant tied to a cane: a turned profile of three leafy swells
      g.add(api.lathe({ points: [[0.12, 0], [0.26, 0.2], [0.18, 0.42], [0.28, 0.62], [0.2, 0.86], [0.24, 1.02], [0.08, 1.18], [0, 1.2]], seg: 10, x: px, y, z, ramp: R.OLIVE, speck: 0.1 }));
      g.add(api.cylinder({ r: 0.025, h: 1.55, x: px + 0.04, y: y + 0.78, z: z - 0.04, ramp: R.WOOD }));
      for (let f = 0; f < 3; f++) {
        const a = -0.6 + f * 0.9 + api.range(-0.3, 0.3), fy = y + 0.3 + f * 0.28;
        g.add(api.sphere({ r: 0.1, x: px + Math.sin(a) * 0.25, y: fy, z: z + Math.cos(a) * 0.25, ramp: R.RED, lift: 0.05, seg: 8 }));
      }
    }
  } else if (crop === 'beans') {
    for (let i = 0; i < 2; i++) {
      const px = x - w / 4 + i * w / 2;
      g.add(api.cone({ r: 0.5, h: 1.55, x: px, y: y + 0.78, z, ramp: R.OLIVE, speck: 0.1, seg: 10 }));
      for (let s = 0; s < 3; s++) {
        const a = s * 2.1 + 0.4;
        g.add(api.cylinder({ r: 0.025, h: 0.4, x: px + Math.cos(a) * 0.07, y: y + 1.62, z: z + Math.sin(a) * 0.07, rx: Math.sin(a) * 0.25, rz: -Math.cos(a) * 0.25, ramp: R.WOOD }));
      }
      // a few white bean flowers on the lit side
      for (let f = 0; f < 3; f++) g.add(api.sphere({ r: 0.07, x: px - 0.25 + f * 0.08, y: y + 0.5 + f * 0.3, z: z + 0.3 - f * 0.08, ramp: R.WHITEWASH, seg: 6 }));
    }
  }
}
