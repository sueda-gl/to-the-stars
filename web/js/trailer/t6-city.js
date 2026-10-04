// ALOUD trailer t6: the plan of the DEVELOPED civilisation on the game's own seaside map (web/js/world), zoned like a
// modern city but built the way these creatures would build (Sueda, 2026-10-04: "whimsy interesting buildings"): a
// DENSE INSIDE of whimsical architecture, every building its own (star towers for the twinkles, lantern-stack halls for
// the glims, parasol houses for the floaties, blob towers with portholes, stacked-cylinder flats, mushroom cottages, a
// bent arch-house, a loop-the-loop ribbon house, a spiral library, an onion theatre, a dome observatory, a moth-wing
// market hall, a quarter of Futuro saucer pods on legs) round the civic hall, university, opera and station; playful
// modern industry in the east (rounded barrel-vault works, striped silos, the power station) and the harbour
// (gantries, shipyard, the lighthouse, the launch pad with the rocket); and an OUTSIDE RING of land under the plough:
// striped fields, orchards, vineyards, olive groves, pastures with animals, farms, barns, windmills.
// Every thing carries b (0..1): WHEN in the story it was built (1 = the latest). The rewind un-builds in reverse order
// of b: FIRST the rocket (the most high-tech thing they ever made), then its pad, the industry, the landmarks, the
// whimsy quarters, the roads, the fields from the outside in, and last the first house and windmill by the spawn.
//
//   const plan = planCity(world, { seed, lib })   -> { items, roads, centre, occ, fails }
//   item: { type: 'lib' | 'asset' | 'fill' | 'launch', id, x, z, rot, b, w, scaffold, r, poly?, opts?, variant? }
// 'asset' ids are the trailer's own Build API plans (web/js/buildings/examples/whimsy-*.js and city-*.js), registered
// under several ids each (whimsy-pod-1 ... -6 etc.): api.rand() differs per id, so every copy is a different building.

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// the plans: example file, how many differently seeded copies, the footprint (w along x, d along z) at scale s
export const CITY_PLANS = {
  star: { file: 'whimsy-star-tower', n: 4, w: 13, d: 13, s: 1 },
  blob: { file: 'whimsy-blob-tower', n: 4, w: 11, d: 11, s: 0.95 },
  arch: { file: 'whimsy-arch-house', n: 2, w: 24, d: 8, s: 1 },
  pod: { file: 'whimsy-pod', n: 6, w: 9, d: 9, s: 0.8 },
  parasol: { file: 'whimsy-parasol', n: 3, w: 15, d: 15, s: 0.72 },
  mushroom: { file: 'whimsy-mushroom', n: 4, w: 11, d: 10, s: 0.8 },
  lantern: { file: 'whimsy-lantern-hall', n: 3, w: 12, d: 12, s: 0.8 },
  loop: { file: 'whimsy-loop', n: 2, w: 26, d: 12, s: 1 },
  cylinders: { file: 'whimsy-cylinders', n: 4, w: 12, d: 12, s: 0.8 },
  spiral: { file: 'whimsy-spiral-library', n: 1, w: 16, d: 16, s: 1 },
  onion: { file: 'whimsy-onion-theatre', n: 1, w: 24, d: 17, s: 1 },
  observatory: { file: 'whimsy-observatory', n: 1, w: 14, d: 14, s: 1 },
  moth: { file: 'whimsy-moth-hall', n: 2, w: 22, d: 20, s: 1 },
  works: { file: 'whimsy-works', n: 2, w: 22, d: 20, s: 1 },
  silos: { file: 'whimsy-silos', n: 2, w: 23, d: 15, s: 1 },
  power: { file: 'city-power', n: 1, w: 44, d: 22, s: 0.8 },
  opera: { file: 'city-opera', n: 1, w: 26, d: 22, s: 0.8 },
  station: { file: 'city-station', n: 1, w: 20, d: 40, s: 0.8 },
  university: { file: 'city-university', n: 1, w: 24, d: 24, s: 0.8 },
  civic: { file: 'city-civic', n: 1, w: 20, d: 19, s: 0.8 },
  gantry: { file: 'city-gantry', n: 2, w: 16, d: 30, s: 0.8 }
};
export const planScale = id => { for (const P of Object.values(CITY_PLANS)) if (id.startsWith(P.file + '-')) return P.s; return 1; };

export function planCity(world, { seed = 27, lib = world.lib } = {}) {
  const rnd = world.ctx.mulberry32(seed);
  const R = (a, b) => a + (b - a) * rnd();
  const pick = a => a[Math.floor(rnd() * a.length)];
  const gy = (x, z) => world.groundY(x, z);
  const wet = (x, z) => world.isWater(x, z);
  const C = { x: 2, z: 4 };                       // the city's heart (the plot centre is (0, 2), the spawn (0, 9))
  const items = [], occ = [], fails = {};
  const dist = (x, z) => Math.hypot(x - C.x, z - C.z);

  const free = (x, z, r) => occ.every(([ox, oz, or]) => Math.hypot(ox - x, oz - z) > or + r);
  const dry = (x, z, r) => { for (let k = 0; k < 9; k++) { const a = k / 8 * TAU, d = k ? r : 0; if (wet(x + Math.cos(a) * d, z + Math.sin(a) * d)) return false; } return true; };
  const flatish = (x, z, r, tol = 1.6) => { let lo = 1e9, hi = -1e9; for (let k = 0; k < 9; k++) { const a = k / 8 * TAU, d = k ? r : 0, y = gy(x + Math.cos(a) * d, z + Math.sin(a) * d); lo = Math.min(lo, y); hi = Math.max(hi, y); } return hi - lo < tol && lo > -0.3; };
  const lm = [];   // the landmarks' circles: streets stop at them (an avenue ending on a plaza or a hall)
  const take = (x, z, r) => occ.push([x, z, r]);
  const ok = (x, z, rr, water, tol = 2.6) => free(x, z, rr) && (water || (dry(x, z, rr) && flatish(x, z, rr * 0.8, tol)));
  function spot(x, z, rr, water, search, tol) {   // a free spot at (x, z) or nearby (a spiral out to `search` metres)
    if (ok(x, z, rr, water, tol)) return [x, z];
    for (let d = 1.5; d <= search; d += 1.5) for (let k = 0; k < 12; k++) {
      const a = k / 12 * TAU + d * 0.37, px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d;
      if (ok(px, pz, rr, water, tol)) return [px, pz];
    }
    return null;
  }
  // b of a thing by its distance from the heart: the edges are the newest
  const age = (x, z, lo, hi) => clamp(lo + (hi - lo) * clamp(dist(x, z) / 90, 0, 1), 0, 1);

  function place(type, id, x, z, rot, b, { fp, r = null, scaffold = true, variant = 0, force = false, w = null, water = false, search = 0, tol } = {}) {
    const rr = r || Math.hypot(fp.w, fp.d) / 2 * (fp.w * fp.d < 40 ? 0.7 : 0.8);
    if (!force) {
      const sp = spot(x, z, rr, water, search, tol);
      if (!sp) {
        fails[id] = (fails[id] || 0) + 1;
        if (rr > 6) (fails.why = fails.why || []).push(id + ':' + (!free(x, z, rr) ? 'occ' : !dry(x, z, rr) ? 'wet' : 'slope') + '@' + x.toFixed(0) + ',' + z.toFixed(0));
        return null;
      }
      [x, z] = sp;
    }
    take(x, z, rr); if (rr > 6) lm.push([x, z, rr]);
    if (w == null) w = fp.w * fp.d < 30 ? 0.04 : 0.06;   // small things un-build quickly (fewer half-painted at once)
    const it = { type, id, x, z, rot, b, w, scaffold, variant, r: rr, water };
    items.push(it); return it;
  }
  const lib0 = lib && lib.meta ? lib : { meta: () => null };
  function prefab(id, x, z, rot, b, o = {}) {
    const m = lib0.meta(id);
    return place('lib', id, x, z, rot, b, { ...o, fp: (m && m.footprint) || { w: 4, d: 4 } });
  }
  // a modern plan: kind -> one of its seeded copies; the footprint turns with a quarter turn
  const copies = {};
  function city(kind, x, z, rot, b, o = {}) {
    const P = CITY_PLANS[kind], k = (copies[kind] = (copies[kind] || 0) + 1);
    const id = `${P.file}-${((k - 1) % P.n) + 1}`;
    const q = Math.abs(Math.round(rot / (Math.PI / 2))) % 2;
    const fp = q ? { w: P.d * P.s, d: P.w * P.s } : { w: P.w * P.s, d: P.d * P.s };
    // rectangles pack closer than their circumscribed circles: the mean of the half sides
    // round whimsy things pack like coins (their footprint boxes hold air at the corners); the boxy plans like boxes
    const r = o.r || (P.file.startsWith('whimsy') ? Math.min(fp.w, fp.d) / 2 * 0.64 : (Math.min(fp.w, fp.d) / 2 + Math.max(fp.w, fp.d) / 2) / 2 * 0.86);
    const it = place('asset', id, x, z, rot, b, { search: 10, tol: 4.2, ...o, r, fp });   // big things may sit into a slope
    if (!it) copies[kind]--;
    return it;
  }
  function fill(kind, poly, b, opts = {}, { w = 0.05, r = null } = {}) {
    let cx = 0, cz = 0; poly.forEach(([x, z]) => { cx += x; cz += z; }); cx /= poly.length; cz /= poly.length;
    const rr = r || Math.max(...poly.map(([x, z]) => Math.hypot(x - cx, z - cz)));
    const it = { type: 'fill', id: kind, poly, x: cx, z: cz, rot: 0, b, w, scaffold: false, opts, r: rr };
    items.push(it); return it;
  }
  const rectPoly = (x, z, w, d, rot = 0, sk = 0) => [[-w / 2, -d / 2], [w / 2, -d / 2 + sk], [w / 2, d / 2], [-w / 2, d / 2 - sk]]
    .map(([u, v]) => [x + u * Math.cos(rot) + v * Math.sin(rot), z - u * Math.sin(rot) + v * Math.cos(rot)]);

  // ---------------- the streets: polylines that roll up from their far tips (b0 the tip, b1 the inner end) ----------------
  const roads = [];
  function road(pts, width, b0, b1, { kind = 'road' } = {}) {
    const seg = []; let cur = [];
    for (let i = 0; i + 1 < pts.length; i++) {
      const [ax, az] = pts[i], [bx, bz] = pts[i + 1], L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.ceil(L / 2));
      for (let k = 0; k <= n; k++) {
        if (i > 0 && k === 0) continue;
        const x = ax + (bx - ax) * k / n, z = az + (bz - az) * k / n;
        if (wet(x, z) || wet(x + 1.6, z) || wet(x - 1.6, z) || wet(x, z + 1.6) || wet(x, z - 1.6) || lm.some(([lx, lz, lr]) => Math.hypot(lx - x, lz - z) < lr + width / 2)) { if (cur.length > 1) seg.push(cur); cur = []; }
        else cur.push([x, z]);
      }
    }
    if (cur.length > 1) seg.push(cur);
    for (const s of seg) { for (let i = 0; i < s.length; i++) take(s[i][0], s[i][1], width / 2 + 0.15); roads.push({ pts: s, width, b0, b1, kind }); }
  }
  // ---------------- the gameplay's own first builds ("a house there", "a windmill"): the last to go, by the spawn ----------------
  prefab('house', -3, 19.5, Math.PI, 0.05, { search: 6 });
  prefab('windmill', -13, 13, 0.4, 0.085, { search: 7 });
  // the spawn itself stays clear: the first folk stand there at the end
  take(0, 11.5, 6.6);

  // ---------------- the heart: the piazza by the lake garden, the civic hall, the moth-wing market ----------------
  fill('plaza', rectPoly(-6, -4, 15, 11, 0.05), 0.42, {}, { r: 8 }); take(-6, -4, 8);
  prefab('fountain', -6, -4, 0, 0.42, { force: true, scaffold: false });
  city('civic', 14, -8, -Math.PI / 2, 0.8, { search: 6 });
  city('moth', -21, -11, 0, 0.62, { search: 6 });
  fill('garden', [[-19, -1], [-14, -1.5], [-7, 1.5], [-12, 3.5], [-19, 3]], 0.56, {}, { r: 7 });
  // culture and learning: each a landmark of its own
  city('opera', -18, -27, Math.PI, 0.84, { search: 6, water: true });
  city('onion', 16, 16, 0, 0.8);
  city('spiral', -32, 12, 0, 0.78, { search: 9 });
  city('observatory', 30, 34, 0, 0.82, { search: 9, tol: 5 });
  city('university', -14, 36, 0, 0.77);
  city('station', 14, 48, 0, 0.78, { search: 8, tol: 5 });
  city('arch', 0, 30, 0, 0.74, { search: 6 });
  city('loop', -30, -2, 0, 0.76, { search: 8 });
  prefab('amphitheatre', -42, 42, Math.PI / 2, 0.72, { search: 10 });
  // the star towers of the twinkles: a cluster round the crossing of the avenues (the tallest things in town)
  // two star towers only (Sueda: fewer stars), the rest of the crossing goes to the other whimsy landmarks
  [[13, 2], [-14, 14]].forEach(([x, z]) => city('star', x, z, R(0, TAU), 0.82 + R(0, 0.06), { search: 6 }));
  city('arch', 31, 12, Math.PI / 2, 0.76, { search: 6 });
  city('loop', 12, -23, 0, 0.74, { search: 6 });
  city('blob', 33, -8, 0, 0.78, { search: 6 });
  city('lantern', -17, -8, 0, 0.7, { search: 6 });

  // ---------------- the harbour (the north coast) ----------------
  prefab('dock', -8, -25.5, Math.PI, 0.5, { water: true, force: true });
  prefab('dock', 12, -26.5, Math.PI, 0.55, { water: true, force: true });
  prefab('pier', 2, -32, 0, 0.64, { water: true, force: true, scaffold: false });
  prefab('shipyard', 34, -24, Math.PI, 0.86, { water: true, search: 6 });
  city('gantry', 22, -28, Math.PI, 0.88, { water: true, search: 5 });
  city('gantry', 46, -26, Math.PI, 0.89, { water: true, search: 5 });
  city('lantern', -1, -15, 0, 0.66, { search: 6 });
  prefab('fishing-nets', -16, -24, Math.PI, 0.3, { water: true, scaffold: false, search: 6 });
  items.push({ type: 'asset', id: 'lighthouse', x: 56, z: -32, rot: Math.PI * 0.8, b: 0.9, w: 0.04, scaffold: true, r: 4 }); take(56, -32, 4);
  items.push({ type: 'asset', id: 'giant-duck', x: -22, z: -40, rot: 0.9, b: 0.86, w: 0.06, scaffold: false, r: 6, water: true });
  // the rocket on its sea pad: the most high-tech thing they ever made, so the FIRST to un-build (t6-unbuild.js)
  items.push({ type: 'launch', id: 'launch-platform', x: 22, z: -52, rot: 0, b: 0.925, w: 0.03, scaffold: true, r: 9, water: true });

  // ---------------- the industry (east): playful and modern (barrel-vault works, striped silos, the power station) ----------------
  city('power', 62, 12, Math.PI / 2, 0.9, { search: 12, tol: 4 });
  city('works', 46, -8, 0, 0.89, { tol: 3.5 });
  city('works', 46, 44, Math.PI, 0.87, { tol: 4 });
  city('silos', 66, 36, 0, 0.88, { tol: 4 });
  city('silos', 40, 22, Math.PI / 2, 0.88, { tol: 3.5 });
  prefab('crane', 58, -4, -Math.PI / 2, 0.9, { search: 9, tol: 3.5 });
  prefab('quarry', 76, 30, -Math.PI / 2, 0.86, { search: 10, tol: 6 });
  // the bridge over the river on the cross avenue (and a footbridge upstream)
  { let bx = -45; for (let x = -56; x < -36; x += 0.5) if (wet(x, 6.5)) { bx = x + 2; break; } prefab('bridge', bx, 6.5, 0, 0.4, { force: true, water: true }); }
  { let bx = -46; for (let x = -58; x < -36; x += 0.5) if (wet(x, 34)) { bx = x + 1.6; break; } prefab('footbridge', bx, 34, 0, 0.5, { force: true, water: true, scaffold: false }); }

  // ---------------- the streets (after the landmarks: they stop at them) ----------------
  // the grid of the inside: two avenues each way, the quay, the works' road; tracks out to the farms
  road([[4, -21], [4, -8], [3, 6], [3, 24], [2, 40], [0, 56], [-4, 70]], 3.6, 0.6, 0.32);           // the harbour avenue
  road([[-104, 9], [-62, 7], [-48, 6], [-30, 6], [-12, 6], [3, 6], [20, 5], [36, 3], [52, -2], [70, -4]], 3.6, 0.62, 0.32);   // the cross avenue, over the bridge
  road([[-40, 24], [-22, 24], [3, 24], [22, 24], [40, 25], [56, 28]], 3.0, 0.56, 0.36);
  road([[-24, -18], [-24, 6], [-24, 24], [-26, 44]], 3.0, 0.55, 0.36);
  road([[24, -18], [24, 5], [24, 24], [26, 44]], 3.0, 0.6, 0.38);
  road([[-34, -19], [-8, -20], [8, -21], [24, -21], [40, -19], [50, -22]], 2.8, 0.66, 0.42);            // the quay
  road([[36, 3], [42, 16], [46, 30], [58, 38]], 2.8, 0.7, 0.55);                                        // the works
  road([[-62, 7], [-66, 30], [-70, 56], [-74, 80]], 2.4, 0.4, 0.22);                                    // farm tracks
  road([[-62, 7], [-60, -8]], 2.2, 0.36, 0.22);
  road([[-88, 8], [-92, 34], [-90, 62]], 2.2, 0.38, 0.22);
  road([[0, 56], [24, 64], [52, 70]], 2.2, 0.38, 0.24);
  road([[0, 56], [-26, 66], [-44, 78]], 2.2, 0.38, 0.24);


  // ---------------- the inside, filled: whimsy quarters along the streets and in between ----------------
  // the quarters: saucer pods in the south-west, mushrooms and parasols by the lake garden, blob towers, cylinder flats
  // and lantern halls in the centre and east; never two of the same kind side by side if it can be helped
  // Sueda: "so many buildings of the same type, don't do that, add variety" + "add normal buildings too". Each whimsy
  // design appears at most CAP times in the whole city (counting the landmarks above), never twice in a row, and every
  // other plot goes to one of the game's ordinary painted buildings (the catalogue), so it reads as a lived-in town
  // with whimsical landmarks. Neighbours: nothing is placed right beside a building of its own design.
  const CAP = 3, WHIMSY = ['pod', 'mushroom', 'parasol', 'lantern', 'blob', 'cylinders', 'arch', 'loop', 'star'];
  const NORMAL = ['house', 'bakery', 'workshop', 'tavern', 'weaver', 'potter', 'dovecote', 'campanile', 'tower', 'temple', 'school',
    'granary', 'well', 'garden', 'fountain', 'stalls', 'smithy', 'town-hall', 'gazebo', 'watchtower', 'bathhouse', 'statue', 'kiln', 'hut'];
  const used = {}; items.forEach(it => { const k = Object.keys(CITY_PLANS).find(k => it.id.startsWith(CITY_PLANS[k].file + '-')) || it.id; used[k] = (used[k] || 0) + 1; });
  const placed = [];   // [x, z, kind] of the inner town's plots, for the neighbour rule
  const nearSame = (x, z, k) => placed.some(([px, pz, pk]) => pk === k && Math.hypot(px - x, pz - z) < 22);
  let lastKind = null, turn = 0;
  function whimsy(x, z, rot, b, o = {}) {
    turn++;
    const wantWhimsy = turn % 2 === 0 || rnd() < 0.15;
    let kinds = wantWhimsy ? WHIMSY.filter(k => (used[k] || 0) < CAP) : NORMAL.filter(k => (used[k] || 0) < 4);
    kinds = kinds.filter(k => k !== lastKind && !nearSame(x, z, k));
    if (!kinds.length) kinds = NORMAL.filter(k => k !== lastKind && !nearSame(x, z, k));
    if (!kinds.length) return null;
    const kind = kinds[Math.floor(rnd() * kinds.length)];
    const it = CITY_PLANS[kind] ? city(kind, x, z, rot, b, o)
      : prefab(kind, x, z, rot, b, { ...o, variant: Math.floor(rnd() * 3), tol: 4 });
    if (it) { lastKind = kind; used[kind] = (used[kind] || 0) + 1; placed.push([it.x, it.z, kind]); }
    return it;
  }
  for (const rd of [...roads].sort((a, b) => b.width - a.width)) {
    const pts = rd.pts;
    for (let i = 2; i < pts.length - 2; i += 2) {
      const [px, pz] = pts[i], dd = dist(px, pz);
      if (dd > 70) continue;
      const [ax, az] = pts[i - 1], [bx, bz] = pts[i + 1];
      const tx = bx - ax, tz = bz - az, tl = Math.hypot(tx, tz) || 1, nx = -tz / tl, nz = tx / tl;
      for (const sd of [-1, 1]) {
        if (rnd() < 0.12) continue;
        if (dd < 56) {
          const off = rd.width / 2 + 4.4;
          const x = px + nx * sd * off, z = pz + nz * sd * off, rot = Math.atan2(-nx * sd, -nz * sd);
          whimsy(x, z, rot, clamp(0.78 - dd / 70 * 0.2 + R(-0.03, 0.03), 0, 0.82), { search: 2 });
        } else {
          const id = pick(['house', 'hut', 'tavern', 'bakery', 'house', 'dovecote', 'granary', 'well', 'potter']);
          const m = lib0.meta(id), fp = (m && m.footprint) || { w: 4, d: 4 };
          const off = rd.width / 2 + Math.max(fp.w, fp.d) / 2 + 0.5;
          const x = px + nx * sd * off + R(-0.3, 0.3), z = pz + nz * sd * off + R(-0.3, 0.3), rot = Math.atan2(-nx * sd, -nz * sd);
          prefab(id, x, z, rot, age(x, z, 0.36, 0.62) + R(-0.04, 0.04), { variant: Math.floor(rnd() * 3), r: Math.hypot(fp.w, fp.d) / 2 * 0.72 });
        }
      }
    }
  }
  for (let k = 0; k < 900; k++) {
    const a = rnd() * TAU, d = Math.sqrt(rnd()) * 54, x = C.x + Math.cos(a) * d, z = C.z + 4 + Math.sin(a) * d;
    if (z < -20) continue;
    if (d < 48) whimsy(x, z, R(0, TAU), clamp(0.78 - d / 54 * 0.18 + R(-0.03, 0.03), 0, 0.82), { search: 3 });
    else prefab(pick(['house', 'garden', 'hut', 'gazebo', 'dovecote']), x, z, Math.round(R(0, 4)) * Math.PI / 2, age(x, z, 0.36, 0.62) + R(-0.04, 0.04), { variant: Math.floor(rnd() * 3) });
  }

  // ---------------- the outside ring: the land under the plough ----------------
  // farmsteads first (they anchor the patchwork), then the patchwork of fields, orchards, vineyards and pastures
  prefab('windmill', -72, -4, 0.3, 0.3, { search: 9 }); prefab('windmill', -96, 22, 0.6, 0.34, { search: 9 }); prefab('windmill', -56, 46, 0.1, 0.3, { search: 9 });
  prefab('windmill', 34, 74, 0.2, 0.32, { search: 9, tol: 4 }); prefab('windmill', -36, 76, 0.9, 0.3, { search: 9, tol: 4 });
  prefab('granary', -66, 16, Math.PI / 2, 0.32, { search: 9 }); prefab('barn', -78, 36, Math.PI / 2, 0.34, { search: 9 }); prefab('farm', -100, 4, Math.PI / 2, 0.28, { search: 9 });
  prefab('horse-stable', -54, 16, Math.PI, 0.36, { search: 9 }); prefab('olive-press', -58, -6, 0, 0.4, { search: 9 });
  [[30, 62], [-8, 70], [-30, 62], [56, 56], [-112, 22], [-118, 52], [-100, 70], [72, 64], [12, 86], [84, -6]].forEach(([x, z]) =>
    prefab(pick(['farm', 'barn', 'granary', 'farm']), x, z, R(0, TAU), age(x, z, 0.24, 0.42), { search: 8, tol: 4 }));
  const crops = ['mixed', 'wheat', 'green', 'mixed', 'wheat', 'lavender', 'mixed', 'green'];
  const ANIMALS = ['cow-pasture', 'sheep-pen', 'goat-pen', 'horse-stable', 'pig-sty', 'chicken-coop', 'cow-pasture', 'sheep-pen'];
  const FARMS = ['sunflower-field', 'wheat-field', 'lavender-field', 'pumpkin-patch', 'vegetable-patch', 'haystacks', 'beehives'];
  let ci = 0, ai = 0, fi = 0;
  function patchwork(x0, x1, z0, z1, px, pz, kinds, tol, bLo, bHi) {
    for (let fz = z0; fz <= z1; fz += pz) for (let fx = x0 + ((Math.round((fz - z0) / pz) % 2) * px * 0.5); fx <= x1; fx += px) {
      if (dist(fx, fz) < 58) continue;   // the inside is the city's
      const x = fx + R(-1.2, 1.2), z = fz + R(-1, 1), w = px * R(0.86, 0.94), d = pz * R(0.82, 0.9), rot = R(-0.1, 0.1);
      const kind = kinds[Math.floor(rnd() * kinds.length)];
      const bb = age(x, z, bLo, bHi) + R(-0.03, 0.03);
      if (kind === 'animals' || kind === 'farmplot') {
        const id = kind === 'animals' ? ANIMALS[ai++ % ANIMALS.length] : FARMS[fi++ % FARMS.length];
        if (prefab(id, x, z, rot + (rnd() < 0.5 ? 0 : Math.PI / 2), bb, { scaffold: false, search: 3.5, tol })) continue;
      }
      const rr = Math.hypot(w, d) / 2 * 0.78;
      let sp = null, k = 1;
      for (k of [1, 0.78, 0.6]) { sp = spot(x, z, rr * k, false, 3.5, tol); if (sp) break; }
      if (!sp) { fails.patch = (fails.patch || 0) + 1; continue; }
      take(sp[0], sp[1], rr * k);
      const poly = rectPoly(sp[0], sp[1], w * k, d * k, rot, R(-0.7, 0.7));
      if (kind === 'olive') fill('orchard', poly, bb, { kind: 'olive', spacing: 3.6 });
      else if (kind === 'orchard') fill('orchard', poly, bb, { kind: 'mixed', spacing: 3.3 });
      else if (kind === 'vineyard') fill('vineyard', poly, bb, {});
      else fill('field', poly, bb, { crop: crops[ci++ % crops.length] });
    }
  }
  patchwork(-140, -50, -14, 92, 16, 12.5, ['field', 'field', 'field', 'orchard', 'animals', 'field', 'farmplot', 'field'], 3.6, 0.14, 0.4);
  patchwork(-56, 92, 50, 118, 15, 12, ['vineyard', 'field', 'olive', 'orchard', 'animals', 'vineyard', 'field', 'farmplot'], 6.5, 0.16, 0.42);
  patchwork(66, 116, -24, 50, 15, 12, ['vineyard', 'olive', 'field', 'animals', 'vineyard'], 6.5, 0.18, 0.44);

  return { items, roads, centre: C, occ, fails };
}
