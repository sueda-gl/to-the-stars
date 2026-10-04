// Towns in the Red arch's architectural grammar, for the globe: flat-roofed blocks with parapets, round
// arches cut like the reference wall (Shape + absarc, extruded), limestone from kit.stoneTexture, terraces,
// barrel vaults and domes, belvedere towers; cypresses, umbrella pines and lemon / oleander shrubs from the kit.
// Big forms are MeshLambert (key + hemi, real shadows); greenery is the kit's baked paint.
// Every town is built at its own local scale (1 unit ~ 1 m, y up, -z = north) into a THREE.Group; globe.js
// scales it and stands it on the sphere. Each building is a child group with userData.t = its growth threshold.

export function createTownKit(ctx, kit) {
  const { V, R, col } = ctx;
  const lam = {};   // shared Lambert materials, one per colour
  const L = hex => lam[hex] || (lam[hex] = new THREE.MeshLambertMaterial({ color: col(hex) }));
  let stoneMats = [];
  function stone(rep = 1, tint = '#f4ead8') {   // limestone, as the reference terrace (one clone per repeat + tint, cached)
    const k = Math.round(rep * 4) / 4;
    let m = stoneMats.find(s => s.k === k && s.tint === tint);
    if (!m) { const t = kit.getStoneTex().clone(); t.needsUpdate = true; t.repeat.set(k, k); m = { k, tint, mat: new THREE.MeshLambertMaterial({ map: t, color: col(tint) }) }; stoneMats.push(m); }
    return m.mat;
  }
  const DARK = '#4a2e33';   // ink-dark openings: deep warm violet-brown, never black

  function mesh(geo, mat, g, x = 0, y = 0, z = 0, ry = 0) {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.y = ry;
    m.castShadow = true; m.receiveShadow = true; g.add(m); return m;
  }
  const box = (g, w, h, d, mat, x = 0, y = 0, z = 0, ry = 0) => mesh(new THREE.BoxGeometry(w, h, d), mat, g, x, y + h / 2, z, ry);

  // a round-headed arch outline (the reference wall's opening), springing at `spring`
  function archPath(sh, cx, w, spring, y0 = 0) {
    const r = w / 2;
    sh.moveTo(cx - r, y0); sh.lineTo(cx - r, spring); sh.absarc(cx, spring, r, Math.PI, 0, true); sh.lineTo(cx + r, y0); sh.lineTo(cx - r, y0);
  }
  // a wall slab pierced by n round arches (extruded like the Red arch wall)
  function arcadeGeo(len, h, depth, n, archW, spring, y0 = 0) {
    const s = new THREE.Shape();
    s.moveTo(-len / 2, 0); s.lineTo(len / 2, 0); s.lineTo(len / 2, h); s.lineTo(-len / 2, h); s.lineTo(-len / 2, 0);
    for (let i = 0; i < n; i++) {
      const cx = -len / 2 + (i + 0.5) * len / n, hole = new THREE.Path();
      const r = archW / 2;
      hole.moveTo(cx - r, y0); hole.lineTo(cx + r, y0); hole.lineTo(cx + r, spring); hole.absarc(cx, spring, r, 0, Math.PI, false); hole.lineTo(cx - r, y0);
      s.holes.push(hole);
    }
    const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 18 }); g.translate(0, 0, -depth / 2); return g;
  }
  // an ink-dark arched door / window set into a face (a thin extruded arch, proud of the wall)
  function opening(g, w, h, x, y, z, ry = 0) {
    const s = new THREE.Shape(); archPath(s, 0, w, h - w / 2);
    const m = mesh(new THREE.ExtrudeGeometry(s, { depth: 0.12, bevelEnabled: false, curveSegments: 12 }), L(DARK), g, x, y, z, ry); m.castShadow = false;
    m.userData.fine = true;   // the globe drops these from afar (a few dark pixels only turn into Kuwahara blocks)
    return m;
  }
  // a flat-roofed block with a parapet lip and arched openings on its front (+z) and side (+x) faces
  function block(g, { w = 5, d = 5, h = 5, wall, trim = null, x = 0, z = 0, ry = 0, y = 0, doors = 1, windows = 1, parapet = 0.5 }) {
    const b = new THREE.Group(); b.position.set(x, y, z); b.rotation.y = ry; g.add(b);
    box(b, w, h, d, L(wall));
    const tm = L(trim || wall);
    if (parapet > 0) {
      const t = 0.35;
      box(b, w + 0.2, parapet, t, tm, 0, h, d / 2 - t / 2 + 0.1); box(b, w + 0.2, parapet, t, tm, 0, h, -d / 2 + t / 2 - 0.1);
      box(b, t, parapet, d, tm, w / 2 - t / 2 + 0.1, h, 0); box(b, t, parapet, d, tm, -w / 2 + t / 2 - 0.1, h, 0);
    }
    const dw = Math.min(1.5, w * 0.28);
    for (let i = 0; i < doors; i++) opening(b, dw, Math.min(h * 0.55, 2.8), (doors === 1 ? 0 : (i - (doors - 1) / 2) * w / doors), 0, d / 2 + 0.01);
    if (windows && h > 4.2) {
      const n = Math.max(1, Math.round(w / 3.2));
      for (let i = 0; i < n; i++) opening(b, 0.8, 1.6, (i - (n - 1) / 2) * w / n, h - 2.6, d / 2 + 0.01);
      const m = Math.max(1, Math.round(d / 3.4));
      for (let i = 0; i < m; i++) opening(b, 0.8, 1.6, w / 2 + 0.01, h - 2.6, (i - (m - 1) / 2) * d / m, Math.PI / 2);
    }
    return b;
  }
  // a belvedere tower: a tall shaft with a round-arched loggia and a flat cap
  function tower(g, { w = 4, h = 16, wall, top, x = 0, z = 0, y = 0, ry = 0, cap = null }) {
    const b = new THREE.Group(); b.position.set(x, y, z); b.rotation.y = ry; g.add(b);
    box(b, w, h, w, L(wall));
    opening(b, w * 0.32, 2.6, 0, 0, w / 2 + 0.01);
    for (let k = 0; k < 2; k++) opening(b, w * 0.22, 1.8, 0, h * (0.45 + k * 0.22), w / 2 + 0.01);
    const lh = w * 0.95, ag = arcadeGeo(w, lh, 0.4, 1, w * 0.56, lh * 0.5);
    for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2; mesh(ag, L(top), b, Math.sin(a) * (w / 2 - 0.2), h, Math.cos(a) * (w / 2 - 0.2), a); }
    box(b, w + 0.5, 0.45, w + 0.5, L(cap || top), 0, h + lh);
    box(b, w + 0.3, 0.35, w + 0.3, L(top), 0, h - 0.35);
    return b;
  }
  // a barrel vault ("loaf") hall: limestone walls under a coloured half-cylinder roof, arched ends
  function vault(g, { w = 6, d = 9, h = 3.6, wall, roof, x = 0, z = 0, ry = 0, y = 0 }) {
    const b = new THREE.Group(); b.position.set(x, y, z); b.rotation.y = ry; g.add(b);
    box(b, w, h, d, L(wall));
    const r = w / 2 + 0.15, vg = new THREE.CylinderGeometry(r, r, d + 0.3, 28, 1, false, -Math.PI / 2, Math.PI);
    vg.rotateX(Math.PI / 2); vg.rotateY(0); mesh(vg, L(roof), b, 0, h, 0);
    opening(b, w * 0.36, h * 0.85, 0, 0, d / 2 + 0.16);
    return b;
  }
  function dome(g, { r = 3, wall, roof, h = 3, x = 0, z = 0, y = 0 }) {
    const b = new THREE.Group(); b.position.set(x, y, z); g.add(b);
    mesh(new THREE.CylinderGeometry(r, r, h, 28), L(wall), b, 0, h / 2, 0);
    mesh(new THREE.SphereGeometry(r * 1.02, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2), L(roof), b, 0, h, 0);
    opening(b, r * 0.5, h * 0.8, 0, 0, r - 0.05);
    return b;
  }
  // an arcade: a long wall of round arches on a limestone plinth (the reference wall, in miniature)
  function arcade(g, { len = 12, h = 5, n = 4, wall, x = 0, z = 0, ry = 0, y = 0, depth = 1.2 }) {
    const b = new THREE.Group(); b.position.set(x, y, z); b.rotation.y = ry; g.add(b);
    mesh(arcadeGeo(len, h, depth, n, len / n * 0.62, h * 0.48), L(wall), b, 0, 0, 0);
    return b;
  }
  // limestone terrace / platform (the reference slab, textured)
  function terrace(g, x0, x1, z0, z1, y0, y1, tint) {
    const w = x1 - x0, d = z1 - z0;
    const m = mesh(new THREE.BoxGeometry(w, y1 - y0, d), stone(Math.max(w, d) / 8, tint), g, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    m.castShadow = false; return m;
  }
  // a little lemon tree: the kit's flowering shrub with lemons for blossom
  const LEMON = ['#6b5212', '#c99a20', '#f2d04a', '#fff0a6'].map(col);
  function lemon(x, z, s = 1) { kit.bush(x, z, 0.5 * s, 2, LEMON, 1.4 * s, 0.35); }
  // a small umbrella pine
  function umbrella(x, z, h = 7, r = 2.6, lean = 0.6) {
    kit.pine([V(x, 0, z), V(x + lean * 0.4, h * 0.45, z), V(x + lean, h * 0.85, z - lean * 0.3)], 0.26, 0.14,
      [{ c: V(x + lean, h, z - lean * 0.3), r, n: 6 }]);
  }

  return { L, stone, box, mesh, block, tower, vault, dome, arcade, terrace, opening, arcadeGeo, lemon, umbrella, DARK, PALETTES: { LEMON } };
}

// ---------- the three nations + our home village, as building lists ----------
// A building = a child Group with userData.t (growth 0..1 at which it appears). Trees are always there.
function add(g, t, fn) { const b = fn(); b.userData.t = t; return b; }

export function buildNation(ctx, kit, T, style, colours) {
  const g = new THREE.Group(), R = ctx.R;
  const prev = kit.parent; kit.parent = g;
  const { wall, accent, stone } = colours;
  const bs = [];
  const push = (t, b) => { b.userData.t = t; bs.push(b); return b; };
  if (style === 'riviera') {
    // the Drop Riviera: coral and terracotta houses stacked up a rock, limestone terraces, a campanile, lemons
    T.terrace(g, -14, 14, -12, 12, -3, 0.0, '#f0b49a');
    T.terrace(g, -16, 12, -12, 6, 0, 1.6, '#f4c6a8');
    T.terrace(g, -10, 6, -10, -1, 1.6, 3.2, '#f4c6a8');
    push(0.0, T.block(g, { w: 6, d: 5, h: 5, wall, trim: accent, x: -4, z: 2, y: 1.6, doors: 1 }));
    push(0.05, T.tower(g, { w: 3.6, h: 14, wall, top: accent, x: 2, z: -6, y: 3.2 }));
    push(0.1, T.block(g, { w: 5, d: 4.5, h: 4.2, wall: accent, trim: wall, x: 6, z: 3, y: 1.6, ry: -0.2 }));
    push(0.18, T.block(g, { w: 5.5, d: 5, h: 6, wall, trim: stone, x: -7, z: -6, y: 3.2 }));
    push(0.25, T.block(g, { w: 4.5, d: 4, h: 4.5, wall: '#f2a184', trim: accent, x: -12, z: 1, y: 1.6, ry: 0.15 }));
    push(0.32, T.arcade(g, { len: 12, h: 4.4, n: 4, wall: accent, x: -2, z: 9.6, y: 0, depth: 1 }));
    push(0.4, T.block(g, { w: 4, d: 4, h: 3.6, wall, trim: accent, x: 12, z: -4, y: 0, ry: 0.3 }));
    push(0.48, T.block(g, { w: 5, d: 4, h: 5.2, wall: '#e8735c', trim: stone, x: -14, z: -9, y: 0, ry: -0.25 }));
    push(0.56, T.dome(g, { r: 2.4, h: 3.4, wall: stone, roof: accent, x: 8, z: -10, y: 0 }));
    push(0.64, T.block(g, { w: 4.5, d: 4, h: 4, wall: accent, trim: wall, x: 14, z: 6, y: 0, ry: -0.4 }));
    push(0.72, T.block(g, { w: 4, d: 5, h: 4.8, wall, trim: accent, x: -16, z: 8, y: 0, ry: 0.4 }));
    push(0.82, T.block(g, { w: 3.6, d: 3.6, h: 3.4, wall: '#f2a184', trim: accent, x: 4, z: 12, y: 0 }));
    push(0.92, T.tower(g, { w: 2.8, h: 9, wall: accent, top: wall, x: 16, z: -12, y: 0 }));
    kit.cypress(-9, 7, 9, 0.85); kit.cypress(9.5, 7.5, 8, 0.8); kit.cypress(-1, -13, 10, 0.9);
    T.umbrella(-17, -2, 7, 2.6, 0.8); T.umbrella(12, 11, 6, 2.2, -0.7);
    T.lemon(-4, 7.5); T.lemon(1.5, 7.2, 0.9); T.lemon(10, -1, 0.9); T.lemon(-11, -12, 1);
  } else if (style === 'loaf') {
    // the Loaf Republic: white limestone halls under sea-glass vaults and domes, a round bakehouse, an arcade
    T.terrace(g, -14, 14, -12, 12, -2.5, 0.0, '#dff0e8');
    push(0.0, T.vault(g, { w: 6, d: 10, h: 4, wall: stone, roof: wall, x: 0, z: 0 }));
    push(0.06, T.dome(g, { r: 3.2, h: 4.2, wall: stone, roof: wall, x: -9, z: -4 }));
    push(0.12, T.vault(g, { w: 5, d: 8, h: 3.4, wall: stone, roof: wall, x: 8, z: -5, ry: 0.5 }));
    push(0.2, T.arcade(g, { len: 14, h: 4.6, n: 5, wall: stone, x: 0, z: 9.5 }));
    push(0.28, T.tower(g, { w: 3.4, h: 11, wall: stone, top: wall, x: -4, z: -10 }));
    push(0.36, T.vault(g, { w: 4.6, d: 7, h: 3.2, wall: wall, roof: stone, x: -12, z: 6, ry: -0.4 }));
    push(0.44, T.dome(g, { r: 2.4, h: 3.2, wall: stone, roof: wall, x: 12, z: 5 }));
    push(0.52, T.block(g, { w: 5, d: 4, h: 4, wall: stone, trim: wall, x: 6, z: -12, ry: 0.2 }));
    push(0.6, T.vault(g, { w: 4.4, d: 7, h: 3.2, wall: stone, roof: wall, x: -15, z: -8, ry: 0.9 }));
    push(0.7, T.block(g, { w: 4.4, d: 4.4, h: 3.6, wall: wall, trim: stone, x: 15, z: -3, ry: -0.3 }));
    push(0.8, T.dome(g, { r: 2, h: 2.8, wall: stone, roof: wall, x: -6, z: 13 }));
    push(0.9, T.vault(g, { w: 4, d: 6.5, h: 3, wall: stone, roof: wall, x: 13, z: 12, ry: 0.3 }));
    for (const [x, z, h] of [[-3.5, 4, 7.5], [3.5, 4, 7], [-11, 1, 8.5], [10.5, 1, 8], [-1, -15, 9], [16, -10, 7.5]]) kit.cypress(x, z, h, 0.75);
    T.umbrella(-17, 13, 6.5, 2.4, 0.6);
    kit.bush(-2, 13.5, 0.7, 2, kit.PALETTES.PINK, 1.3, 0.5); kit.bush(5.5, 13.6, 0.7, 2, kit.PALETTES.PINK, 1.2, 0.45);
  } else {
    // the Flit Sky-hold: pistachio towers with lemon belvederes on the island's rock, linked by arched bridges
    T.terrace(g, -12, 12, -11, 11, -3, 0.0, '#e6f2c4');
    push(0.0, T.tower(g, { w: 4.4, h: 22, wall, top: accent, x: 0, z: -2 }));
    push(0.08, T.tower(g, { w: 3.4, h: 15, wall: accent, top: wall, x: -8, z: 3 }));
    push(0.16, T.tower(g, { w: 3.4, h: 17, wall, top: accent, x: 8, z: 2 }));
    push(0.24, T.arcade(g, { len: 8, h: 3.2, n: 3, wall: accent, x: -4, z: 0.6, y: 10, depth: 1.2, ry: -0.56 }));
    push(0.32, T.arcade(g, { len: 8, h: 3.2, n: 3, wall: wall, x: 4, z: 0, y: 11.5, depth: 1.2, ry: 0.5 }));
    push(0.4, T.block(g, { w: 5, d: 4.5, h: 4, wall: '#cfe9a8', trim: accent, x: -3, z: 9 }));
    push(0.48, T.tower(g, { w: 3, h: 12, wall, top: accent, x: -10, z: -8 }));
    push(0.56, T.block(g, { w: 4.4, d: 4, h: 3.6, wall: accent, trim: wall, x: 6, z: 10, ry: -0.3 }));
    push(0.64, T.tower(g, { w: 3, h: 13, wall: accent, top: wall, x: 11, z: -8 }));
    push(0.74, T.dome(g, { r: 2.4, h: 3, wall: stone, roof: wall, x: -12, z: 9 }));
    push(0.84, T.tower(g, { w: 2.6, h: 10, wall, top: accent, x: 13, z: 9 }));
    push(0.94, T.tower(g, { w: 2.6, h: 9, wall: accent, top: wall, x: 2, z: 12 }));
    kit.cypress(-5, -9, 8, 0.75); kit.cypress(5, -10, 7, 0.7);
    T.umbrella(-14, -2, 6, 2.3, 0.7); T.umbrella(14, -1, 5.5, 2.1, -0.6);
  }
  if (kit.leaves.length) kit.finishLeaves();
  kit.parent = prev;
  return { group: g, buildings: bs };
}

// our village: small painted buildings that appear in the cream patch as the town grows
export function buildHomeBuilding(ctx, kit, T, i) {
  const g = new THREE.Group();
  const prev = kit.parent; kit.parent = g;
  const WALLS = ['#e9d5b5', '#d9825a', '#c23a2c', '#efc9a0', '#e9d5b5', '#d9825a'], TRIM = ['#c23a2c', '#e9d5b5', '#efe6d2', '#c23a2c', '#d9825a', '#efe6d2'];
  const k = i % 6;
  if (i === 2) {   // a windmill
    const b = T.dome(g, { r: 1.8, h: 5, wall: '#e9d5b5', roof: '#c23a2c' });
    const sail = new THREE.Group(); sail.position.set(0, 5.2, 2); g.add(sail);
    for (let s = 0; s < 4; s++) T.mesh(new THREE.BoxGeometry(0.45, 4.2, 0.12).translate(0, 2.1, 0), T.L('#efe6d2'), sail).rotation.z = s * Math.PI / 2 + 0.4;
  } else if (i === 7) {
    T.tower(g, { w: 2.6, h: 9, wall: '#e9d5b5', top: '#c23a2c' });
  } else if (i === 11) {
    T.arcade(g, { len: 7, h: 3.2, n: 3, wall: '#c23a2c', depth: 0.9 });
  } else {
    const w = 3.6 + (i * 37 % 10) / 10 * 2, d = 3.4 + (i * 53 % 10) / 10 * 1.6, h = 3.2 + (i * 71 % 10) / 10 * 2.4;
    T.block(g, { w, d, h, wall: WALLS[k], trim: TRIM[k], parapet: 0.45 });
    if (i % 3 === 0) T.lemon(w / 2 + 1.1, d / 2 - 0.3, 0.8);
    if (i % 4 === 1) kit.cypress(-w / 2 - 1, -d / 2 + 0.6, 6, 0.6);
  }
  if (kit.leaves.length) kit.finishLeaves();
  kit.parent = prev;
  return g;
}
