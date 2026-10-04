// What grows on the land, made to read from the leader's bird's-eye view (ART_DIRECTION §1, the trees builder's
// grammar in buildings/trees.js): every tree is a few big ROUND lumps stacked in height over a dark underside, on
// a visible trunk, with painted light baked in (kit.bake, the reference's formula) so each crown has a lit top-left
// and a shaded right, and the key light throws its long shadow.
//
//  - woods: the layout's forest land (geography landWeights.pine) and a scatter of lone trees on the meadows,
//    as a few low-poly variants of that grammar (umbrella pine, oak, olive) drawn as InstancedMeshes: thousands of
//    trees in a handful of draw calls. Colour only (no pencil): from above a wood is a dark painted mass (mb 1, 2).
//  - plot trees: as the colour blooms round a finished building, a few olives / oaks / lemons / pines from
//    trees.js itself (api.tree, via the build api) grow in round it (~2 s), with pencil outlines like the
//    buildings. A new site clears the trees off its footprint.

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const EASE_OUT_BACK = t => { const c = 1.5; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };

// the build api's ramps (buildings/api.js RAMPS), so the woods and the plot trees are the same greens
const R_PINE = ['#101a10', '#1b2d17', '#2d4320', '#45602d', '#5f783a'];
const R_OAK = ['#202a17', '#33401d', '#4b5828', '#667236', '#828c45'];
const R_OLIVE = ['#38452f', '#526449', '#6f8762', '#8ea67d', '#a8bd94'];
const R_BARK = ['#241b14', '#3a2c21', '#524030', '#685342', '#7b6652'];

function mergeGeos(list) {
  // non-indexed merge of position / normal / color
  let n = 0; for (const g of list) n += (g.index ? g.index.count : g.attributes.position.count);
  const P = new Float32Array(n * 3), N = new Float32Array(n * 3), Cc = new Float32Array(n * 3);
  let o = 0;
  for (const g0 of list) {
    const g = g0.index ? g0.toNonIndexed() : g0;
    const p = g.attributes.position.array, nn = g.attributes.normal.array, c = g.attributes.color ? g.attributes.color.array : null;
    P.set(p, o * 3); N.set(nn, o * 3); if (c) Cc.set(c, o * 3); else Cc.fill(1, o * 3, o * 3 + p.length);
    o += p.length / 3;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(P, 3)); out.setAttribute('normal', new THREE.BufferAttribute(N, 3)); out.setAttribute('color', new THREE.BufferAttribute(Cc, 3));
  out.computeBoundingSphere();
  return out;
}

// one low-poly tree in the trees.js grammar, built at the origin (trunk foot at y = 0), painted
function lowTree(kit, kind, rnd) {
  const R = (a, b) => a + (b - a) * rnd();
  const parts = [];
  const lumpGeo = (r, sy, x, y, z) => {
    const g = new THREE.IcosahedronGeometry(1, 1), p = g.attributes.position, s1 = R(0, 10);
    for (let i = 0; i < p.count; i++) {
      const vx = p.getX(i), vy = p.getY(i), vz = p.getZ(i), k = 1 + 0.1 * Math.sin(vx * 4 + s1) * Math.sin(vy * 5 + s1) * Math.sin(vz * 4.5);
      p.setXYZ(i, vx * k, vy * k, vz * k);
    }
    g.scale(r, r * sy, r); g.translate(x, y, z); g.computeVertexNormals(); return g;
  };
  const trunk = (h, rb, rt, lx, lz) => {
    const g = new THREE.CylinderGeometry(rt, rb, h, 6, 2, true); g.translate(0, h / 2, 0);
    const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const t = p.getY(i) / h; p.setX(i, p.getX(i) + lx * t * t); p.setZ(i, p.getZ(i) + lz * t * t); }
    g.computeVertexNormals(); kit.bake(g, R_BARK, 0.08, -0.05); return g;
  };
  const la = R(0, 6.28), lean = R(0.1, 0.35);
  const lx = Math.cos(la) * lean, lz = Math.sin(la) * lean;
  if (kind === 'pine') {          // umbrella pine: a tall bare trunk under a wide domed canopy of pads
    const h = R(7, 9), r = R(2.4, 3.1), th = h * 0.68;
    parts.push(trunk(th, 0.26, 0.15, lx * 2, lz * 2));
    const cx = lx * 2, cz = lz * 2, cy = th + r * 0.16;
    parts.push(kit.bake(lumpGeo(r * 0.8, 0.5, cx, cy + r * 0.14, cz), R_PINE, 0.12, 0));
    parts.push(kit.bake(lumpGeo(r * 0.48, 0.6, cx + R(-0.2, 0.2) * r, cy + r * 0.42, cz + R(-0.2, 0.2) * r), R_PINE, 0.12, 0.05));
    const n = 4, a0 = R(0, 6.28);
    for (let i = 0; i < n; i++) { const a = a0 + i / n * 6.28 + R(-0.3, 0.3), d = r * R(0.5, 0.64); parts.push(kit.bake(lumpGeo(r * R(0.38, 0.48), 0.55, cx + Math.cos(a) * d, cy + R(-0.1, 0.08) * r, cz + Math.sin(a) * d), R_PINE, 0.12, R(-0.18, -0.04))); }
    parts.push(kit.bake(lumpGeo(r * 0.95, 0.26, cx, cy - r * 0.12, cz), [R_PINE[0], R_PINE[0], R_PINE[1], R_PINE[1]], 0.12, -0.1));
    return { geo: mergeGeos(parts), h, r };
  }
  // round-crowned: oak (big, olive-green) or olive (small, sage)
  const oak = kind === 'oak', ramp = oak ? R_OAK : R_OLIVE;
  const h = oak ? R(5.2, 6.6) : R(3.2, 4.2), r = oak ? R(1.9, 2.4) : R(1.2, 1.55), th = h * (oak ? 0.36 : 0.44);
  parts.push(trunk(th * 1.1, oak ? 0.24 : 0.16, oak ? 0.15 : 0.1, lx, lz));
  const cx = lx, cz = lz, cy = th + r * 0.78, sy = oak ? 0.95 : 0.9;
  parts.push(kit.bake(lumpGeo(r * 0.86, sy, cx, cy, cz), ramp, 0.14, 0));
  parts.push(kit.bake(lumpGeo(r * 0.56, sy, cx + R(-0.2, 0.2) * r, cy + r * 0.6, cz + R(-0.2, 0.2) * r), ramp, 0.14, 0.05));
  const n = oak ? 4 : 3, a0 = R(0, 6.28);
  for (let i = 0; i < n; i++) { const a = a0 + i / n * 6.28 + R(-0.3, 0.3), d = r * R(0.5, 0.66); parts.push(kit.bake(lumpGeo(r * R(0.48, 0.6), sy, cx + Math.cos(a) * d, cy + R(-0.3, 0.05) * r, cz + Math.sin(a) * d), ramp, 0.14, R(-0.28, -0.1))); }
  parts.push(kit.bake(lumpGeo(r * 0.88, 0.6, cx, cy - r * 0.42, cz), [ramp[0], ramp[0], ramp[1], ramp[1]], 0.12, -0.08));
  return { geo: mergeGeos(parts), h, r };
}

export function buildScenery(ctx, kit, ground, geo, { parent = ctx.scene, maxTrees = 1500, seed = 4103, game = null } = {}) {
  const group = new THREE.Group(); group.name = 'scenery'; parent.add(group);
  const C = geo.GEO.C, P = geo.PLOT;
  const rnd = ctx.mulberry32(seed);          // placement has its own stream; the bake spends ctx.rnd like the kit
  const tall = [];                           // [x, z, radius, topY] for the camera's long looks

  // ---------- the woods ----------
  const VAR = [];
  for (const kind of ['pine', 'pine', 'pine', 'oak', 'oak', 'olive', 'olive']) VAR.push({ kind, ...lowTree(kit, kind, rnd), list: [] });
  const byKind = k => VAR.filter(v => v.kind === k);
  const nations = (geo.places && geo.places.nations) || [];
  const step = 2.25, R0 = 196;
  for (let gz = -R0; gz <= R0; gz += step) for (let gx = -R0; gx <= R0; gx += step) {
    const x = C.x + gx + (rnd() - 0.5) * step * 0.9, z = C.z + gz + (rnd() - 0.5) * step * 0.9;
    const d = Math.hypot(x - C.x, z - C.z);
    if (d > R0) continue;
    const dp = geo.distOutsidePlot(x, z) + (geo.fbm2(x / 17 + 9.1, z / 17 - 3.3, 2) - 0.5) * 16;
    if (dp < 3) continue;
    const s = ground.shoreS(x, z);
    if (s < 2.2) continue;
    const y = ground.groundY(x, z);
    if (y < 0.15) continue;   // the river's banks, the lake
    let near = false; for (const n of nations) if (Math.hypot(x - n.x, z - n.z) < (n.r || 15) + 5) near = true;
    if (near) continue;
    const w = geo.landWeights(x, z);
    const patch = geo.fbm2(x / 13 + 2.2, z / 13 - 6.1, 3);
    // the woods stand as MASSES (mb 1, 2): dense where the landform says woods, a few lone trees on the meadows
    const dense = smooth(0.4, 0.7, w.pine) * smooth(0.36, 0.5, patch + w.pine * 0.2);
    const lone = 0.03 * (w.meadow || 0) * smooth(10, 30, dp) * (1 - smooth(20, 34, y));
    if (rnd() > Math.max(dense * 0.92, lone)) continue;
    if ((w.rock || 0) > 0.45) continue;
    // conifers up high and in the dense woods, oaks and olives on the lower, gentler land
    const kind = y > 14 || (dense > 0.5 && rnd() < 0.7) ? 'pine' : (rnd() < 0.55 ? 'oak' : 'olive');
    const vs = byKind(kind), v = vs[Math.floor(rnd() * vs.length)];
    v.list.push({ x, y, z, s: 0.5 + rnd() * 0.32, rot: (rnd() - 0.5) * 0.5, tint: 0.9 + rnd() * 0.18 });
  }
  // keep the budget: thin evenly if the land asks for more
  let total = VAR.reduce((a, v) => a + v.list.length, 0);
  if (total > maxTrees) { const keep = maxTrees / total; for (const v of VAR) v.list = v.list.filter(() => rnd() < keep); total = VAR.reduce((a, v) => a + v.list.length, 0); }
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), T = new THREE.Vector3(), YA = new THREE.Vector3(0, 1, 0), tint = new THREE.Color();
  const woodMeshes = [];
  // every InstancedMesh here carries an instanceColor: r128 keys programs on it but never re-checks it per
  // object, so under the painter's override materials (keylines, depth, shadows) instanced meshes with and
  // without one (the kit's leaves always have one) would share a program and break; own material too
  const woodMat = kit.paintMat.clone();
  // the start state (mb 1): the woods are muted olive-sepia masses; they take their colour with the world's bloom
  const uIvory = { value: 1 };
  woodMat.onBeforeCompile = sh => {
    sh.uniforms.uIvory = uIvory;
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uIvory;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        { float l = dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11));
          vec3 iv = mix(vec3(0.21, 0.24, 0.15), vec3(0.6, 0.58, 0.41), smoothstep(0.04, 0.42, l));
          diffuseColor.rgb = mix(diffuseColor.rgb, iv, uIvory * 0.85); }`);
  };
  woodMat.customProgramCacheKey = () => 'agora-woods';
  for (const v of VAR) {
    if (!v.list.length) continue;
    const im = new THREE.InstancedMesh(v.geo, woodMat, v.list.length);
    v.list.forEach((t, i) => {
      Q.setFromAxisAngle(YA, t.rot); S.setScalar(t.s); T.set(t.x, t.y - 0.08, t.z);
      M.compose(T, Q, S); im.setMatrixAt(i, M);
      tint.setRGB(t.tint, t.tint * (0.98 + (t.tint - 1) * 0.3), t.tint * 0.96); im.setColorAt(i, tint);
      if (Math.hypot(t.x - C.x, t.z - C.z) < 90 && i % 3 === 0) tall.push([t.x, t.z, v.r * t.s * 1.2, t.y + v.h * t.s]);
    });
    im.instanceMatrix.needsUpdate = true; im.instanceColor.needsUpdate = true;
    im.castShadow = true; im.name = 'woods-' + v.kind; im.frustumCulled = false;
    // folkHidden: the folk pass redraws the world's depth every frame; the woods never stand in front of the folk
    group.add(im); ctx.colourOnly.push(im); ctx.folkHidden.push(im); woodMeshes.push(im);
  }

  // ---------- plot trees: trees.js, grown in round finished buildings ----------
  const plot = { trees: [], kinds: null, meshes: [], cap: 200, pending: [] };
  // every tree type, picked at random ([kind, seed, options]); the later variants (orange, a taller two-tier pine, a
  // second cypress / oak / olive) give the seaside dressing (§21) its variety
  const KINDS = [['olive', 1], ['olive', 2], ['oak', 3], ['lemon', 4], ['pine', 5], ['olive', 6], ['cypress', 7],
    ['orange', 8], ['pine', 9, { h: 7.6, tiers: 2 }], ['cypress', 10, { h: 5.6 }], ['oak', 11], ['olive', 12], ['pine', 13, { h: 5.4 }]];
  // the seaside dressing outside our plot (§21): the same variants, instanced, colour + one pencil proxy per crown;
  // static, so they stay out of the folk pass (they never stand in front of the folk) and the lake's mirror
  const dress = { list: [], meshes: [], pending: null };
  let loading = null;
  function loadKinds() {
    if (loading) return loading;
    loading = (async () => {
      try {
        const m = await import('../buildings/api.js');
        const api = m.createBuildApi(ctx, kit, { seed: 77 }), I = m.internals(api);
        plot.kinds = KINDS.map(([kind, sd, o = {}]) => {
          api.seed(sd);
          const g = kind === 'pine' ? api.pine({ h: 6.2, ...o }) : api.tree({ kind, s: kind === 'oak' ? 0.85 : 1, ...o });
          const root = new THREE.Group(); root.add(g); I.finish(root); root.updateMatrixWorld(true);
          const colour = [], line = [];
          root.traverse(o => {
            if (!o.isMesh) return;
            const gg = o.geometry.clone(); gg.applyMatrix4(o.matrixWorld);
            if (o.userData.agoraLine) { line.push(gg); return; }
            if (o.material === kit.paintMat && gg.attributes.color) colour.push(gg);
          });
          I.unregister(root);
          const box = new THREE.Box3().setFromObject(root);
          const lineGeo = line.length ? mergeGeos(line.map(x => { if (!x.attributes.normal) x.computeVertexNormals(); return x; })) : null;
          return { kind, colour: mergeGeos(colour), line: lineGeo, h: box.max.y, r: Math.max(box.max.x - box.min.x, box.max.z - box.min.z) / 2 };
        });
      } catch (e) {
        console.warn('world: trees.js unavailable, plot trees use the low-poly woods variants', e);
        plot.kinds = ['olive', 'oak', 'olive', 'pine'].map(kind => { const v = byKind(kind)[0]; return { kind, colour: v.geo, line: null, h: v.h, r: v.r }; });
      }
      const plotMat = kit.paintMat.clone();
      const whiten = im => { const w = new THREE.Color(1, 1, 1); for (let i = 0; i < im.count; i++) im.setColorAt(i, w); im.instanceColor.needsUpdate = true; };   // before count drops: r128 sizes instanceColor by count
      plot.meshes = plot.kinds.map(k => {
        const im = new THREE.InstancedMesh(k.colour, plotMat, plot.cap); whiten(im); im.count = 0; im.castShadow = true; im.frustumCulled = false; im.name = 'plot-trees-' + k.kind;
        group.add(im); ctx.colourOnly.push(im);
        let pm = null;
        if (k.line) { pm = new THREE.InstancedMesh(k.line, new THREE.MeshBasicMaterial(), plot.cap); whiten(pm); pm.count = 0; pm.visible = false; pm.frustumCulled = false; group.add(pm); ctx.lineOnly.push(pm); }
        return { im, pm, list: [] };
      });
      for (const p of plot.pending.splice(0)) plant(p.x, p.z, p);
      if (dress.pending) { const l = dress.pending; dress.pending = null; dressTrees(l); }
      return plot;
    })();
    return loading;
  }
  function writeTree(t) {
    const m = plot.meshes[t.k]; if (!m) return;
    const g = t.grow < 1 ? EASE_OUT_BACK(Math.max(0, t.grow)) : 1;
    Q.setFromAxisAngle(YA, t.rot); S.set(t.s * Math.max(0.001, g), t.s * Math.max(0.001, g * g), t.s * Math.max(0.001, g)); T.set(t.x, t.y - 0.05, t.z);
    M.compose(T, Q, S); m.im.setMatrixAt(t.i, M); m.im.instanceMatrix.needsUpdate = true;
    if (m.pm) { m.pm.setMatrixAt(t.i, M); m.pm.instanceMatrix.needsUpdate = true; }
  }
  function rebuildKind(k) {
    const m = plot.meshes[k]; if (!m) return;
    m.list = plot.trees.filter(t => t.k === k);
    m.list.forEach((t, i) => { t.i = i; writeTree(t); });
    m.im.count = m.list.length; if (m.pm) m.pm.count = m.list.length;
  }
  // plant(x, z, { kind?, s, delay, ms }) -> a tree record (or null if the spot is taken)
  function plant(x, z, { kind = null, s = 1, delay = 0, ms = 1800, key = null } = {}) {
    if (!plot.kinds) { plot.pending.push({ x, z, kind, s, delay, ms, key }); loadKinds(); return null; }
    let k = kind ? plot.kinds.findIndex(o => o.kind === kind) : Math.floor(rnd() * plot.kinds.length);
    if (k < 0) k = 0;
    if (plot.meshes[k].list.length >= plot.cap) return null;
    const t = { x, z, y: ground.groundY(x, z), k, s: s * (0.85 + rnd() * 0.3), rot: (rnd() - 0.5) * 0.6, grow: -delay / ms, ms, key, r: plot.kinds[k].r * s };
    plot.trees.push(t); rebuildKind(k);
    return t;
  }
  // the seaside dressing (§21, dressing.js planDressing): trees inside our plot become ordinary plot trees (grown,
  // nav obstacles, cleared by a new site); the rest are static instanced copses. list: [{ x, z, kind, s, rot, inPlot }]
  function dressTrees(list) {
    if (!plot.kinds) { dress.pending = list; loadKinds(); return; }
    for (const m of dress.meshes) { group.remove(m.im); m.im.dispose(); if (m.pm) { group.remove(m.pm); m.pm.dispose(); } for (const L of [ctx.colourOnly, ctx.folkHidden, ctx.lineOnly]) for (const o of [m.im, m.pm]) { const i = L.indexOf(o); if (i >= 0) L.splice(i, 1); } }
    dress.meshes = []; dress.list = [];
    const variantsOf = kind => plot.kinds.map((k, i) => (k.kind === kind ? i : -1)).filter(i => i >= 0);
    const per = plot.kinds.map(() => []);
    for (const t of list) {
      const vs = variantsOf(t.kind); if (!vs.length) continue;
      const k = vs[Math.floor(rnd() * vs.length)];
      if (t.inPlot) {
        const pt = { x: t.x, z: t.z, y: ground.groundY(t.x, t.z), k, s: t.s, rot: t.rot, grow: 1, ms: 1, key: 'dress', r: plot.kinds[k].r * t.s, dress: true };
        plot.trees.push(pt);
      } else per[k].push({ ...t, k, y: ground.groundY(t.x, t.z) });
    }
    plot.kinds.forEach((_, k) => rebuildKind(k));
    const mat = dress.mat || (dress.mat = (() => { const m = kit.paintMat.clone(); m.customProgramCacheKey = () => 'agora-dress-trees'; return m; })());
    per.forEach((ts, k) => {
      if (!ts.length) return;
      const kk = plot.kinds[k];
      const im = new THREE.InstancedMesh(kk.colour, mat, ts.length); im.name = 'dress-trees-' + kk.kind; im.castShadow = true; im.frustumCulled = false;
      const pm = kk.line ? new THREE.InstancedMesh(kk.line, new THREE.MeshBasicMaterial(), ts.length) : null;
      if (pm) { pm.visible = false; pm.frustumCulled = false; pm.name = 'dress-tree-lines-' + kk.kind; }
      const w = new THREE.Color(1, 1, 1);
      ts.forEach((t, i) => {
        Q.setFromAxisAngle(YA, t.rot); S.setScalar(t.s); T.set(t.x, t.y - 0.05, t.z); M.compose(T, Q, S);
        im.setMatrixAt(i, M); im.setColorAt(i, w); if (pm) { pm.setMatrixAt(i, M); pm.setColorAt(i, w); }
        if (Math.hypot(t.x - C.x, t.z - C.z) < 90) tall.push([t.x, t.z, kk.r * t.s * 1.1, t.y + kk.h * t.s]);
      });
      im.instanceMatrix.needsUpdate = true; im.instanceColor.needsUpdate = true;
      group.add(im); ctx.colourOnly.push(im); ctx.folkHidden.push(im);
      if (pm) { pm.instanceMatrix.needsUpdate = true; pm.instanceColor.needsUpdate = true; group.add(pm); ctx.lineOnly.push(pm); }
      dress.meshes.push({ im, pm, k, list: ts });
      dress.list.push(...ts);
    });
  }
  function restandDress() {
    for (const m of dress.meshes) {
      m.list.forEach((t, i) => { t.y = ground.groundY(t.x, t.z); Q.setFromAxisAngle(YA, t.rot); S.setScalar(t.s); T.set(t.x, t.y - 0.05, t.z); M.compose(T, Q, S); m.im.setMatrixAt(i, M); if (m.pm) m.pm.setMatrixAt(i, M); });
      m.im.instanceMatrix.needsUpdate = true; if (m.pm) m.pm.instanceMatrix.needsUpdate = true;
    }
  }
  function clearArea(test) {
    const ks = new Set();
    for (let i = plot.trees.length - 1; i >= 0; i--) if (test(plot.trees[i])) { ks.add(plot.trees[i].k); plot.trees.splice(i, 1); }
    ks.forEach(rebuildKind);
    return ks.size > 0;
  }
  // clear the trees off a rotated footprint (+ margin)
  function clearRect(x, z, w, d, rot = 0, margin = 1.2) {
    const c = Math.cos(rot), s = Math.sin(rot);
    return clearArea(t => { const dx = t.x - x, dz = t.z - z; return Math.abs(dx * c - dz * s) < w / 2 + margin + t.r * 0.6 && Math.abs(dx * s + dz * c) < d / 2 + margin + t.r * 0.6; });
  }
  // after a pad re-levels the ground, stand the plot trees on it again
  function restand() { for (const t of plot.trees) { t.y = ground.groundY(t.x, t.z); writeTree(t); } }
  function update(dt) {
    let busy = false;
    for (const t of plot.trees) if (t.grow < 1) { t.grow = Math.min(1, t.grow + dt * 1000 / t.ms); if (t.grow > -0.001) writeTree(t); busy = true; }
    return busy;
  }
  if (game) loadKinds();

  // the woods stood on the ground again (after the look's reliefScale re-stood the mesh)
  function restandAll() {
    for (const v of VAR) {
      const im = woodMeshes.find(m => m.geometry === v.geo); if (!im) continue;
      v.list.forEach((t, i) => { t.y = ground.groundY(t.x, t.z); Q.setFromAxisAngle(YA, t.rot); S.setScalar(t.s); T.set(t.x, t.y - 0.08, t.z); M.compose(T, Q, S); im.setMatrixAt(i, M); });
      im.instanceMatrix.needsUpdate = true;
    }
    restand(); restandDress();
  }
  function setIvory(k) { uIvory.value = Math.max(0, Math.min(1, k)); }
  return { group, tall, woods: woodMeshes, variants: VAR, treeCount: total, plot, dress, dressTrees, plant, clearRect, clearArea, restand, restandAll, setIvory, update,
    ready: () => loadKinds(),
    // the meshes the lake's mirror skips (from above it shows the sky; the shore's own plot trees stay in it)
    reflectionHidden: () => [...woodMeshes, ...dress.meshes.map(m => m.im)] };
}
