// Props the folk carry and the paper dust they kick up — authored in the reference grammar:
// clay cel materials (folk.cloth, cached per colour), few big shapes, no pure black or white.
// Everything hung on a folk enables FACE_LAYER (5) + MASK_LAYER (6), or it vanishes in Gouache (docs/paint.md).
// Geometries are made once and shared; per-agent meshes only reference them (nothing to dispose per agent).

export function createProps(ctx, folk) {
  const { V } = ctx;
  const FACE = folk.FACE_LAYER, MASK = folk.MASK_LAYER;
  const cloth = folk.cloth;

  // mark a prop like a folk body part: drawn in the folk pass, pencil lines stop at it
  function layer(obj, face = false) {
    obj.traverse(o => { if (!o.isMesh) return; o.castShadow = true; o.layers.enable(FACE); if (!face) o.layers.enable(MASK); });
    return obj;
  }
  const mesh = (geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); return m; };

  // ---- shared geometry (made once) ----
  const G = {
    crate: new THREE.BoxGeometry(0.3, 0.22, 0.22),
    slat: new THREE.BoxGeometry(0.312, 0.045, 0.232),
    post: new THREE.BoxGeometry(0.035, 0.232, 0.035),
    basket: (() => { const g = new THREE.CylinderGeometry(0.15, 0.11, 0.13, 16); return g; })(),
    rim: new THREE.TorusGeometry(0.15, 0.016, 6, 22),
    handle: new THREE.TorusGeometry(0.13, 0.013, 6, 18, Math.PI),
    fruit: new THREE.SphereGeometry(0.055, 12, 9),
    bun: (() => { const g = new THREE.SphereGeometry(0.06, 12, 9); g.scale(1.5, 0.8, 0.9); return g; })(),
    env: new THREE.BoxGeometry(0.26, 0.17, 0.014),
    flap: (() => {   // the envelope's V flap: a thin triangular slab, point down
      const s = new THREE.Shape(); s.moveTo(-0.13, 0.085); s.lineTo(0.13, 0.085); s.lineTo(0, -0.012); s.lineTo(-0.13, 0.085);
      const g = new THREE.ExtrudeGeometry(s, { depth: 0.006, bevelEnabled: false }); return g;
    })(),
    seal: (() => { const g = new THREE.CylinderGeometry(0.03, 0.03, 0.014, 14); g.rotateX(Math.PI / 2); return g; })(),
    handleM: (() => { const g = new THREE.CylinderGeometry(0.013, 0.013, 0.2, 6); g.translate(0, -0.1, 0); return g; })(),
    headM: (() => { const g = new THREE.CylinderGeometry(0.042, 0.042, 0.12, 12); g.rotateZ(Math.PI / 2); return g; })(),
    nub: (() => { const g = new THREE.SphereGeometry(0.045, 10, 8); g.scale(0.75, 1.1, 0.8); g.translate(0, -0.03, 0); return g; })(),
    stick: (() => { const g = new THREE.CylinderGeometry(0.014, 0.014, 0.5, 6); g.translate(0, 0.25, 0); return g; })(),
    board: new THREE.BoxGeometry(0.34, 0.22, 0.02),
    bar: new THREE.BoxGeometry(0.24, 0.05, 0.024),
    dust: new THREE.SphereGeometry(1, 10, 8),
    // building materials and work tools (ART_DIRECTION §11: visible work)
    plank: new THREE.BoxGeometry(0.62, 0.05, 0.13),
    plankEnd: new THREE.BoxGeometry(0.02, 0.052, 0.132),
    stone: (() => { const g = new THREE.DodecahedronGeometry(0.12, 0); g.scale(1.25, 0.8, 1); return g; })(),
    log: (() => { const g = new THREE.CylinderGeometry(0.065, 0.07, 0.5, 10); g.rotateZ(Math.PI / 2); return g; })(),
    logEnd: (() => { const g = new THREE.CylinderGeometry(0.05, 0.05, 0.505, 10); g.rotateZ(Math.PI / 2); return g; })(),
    hoeBlade: new THREE.BoxGeometry(0.12, 0.016, 0.07),
    axeHead: (() => { const s = new THREE.Shape(); s.moveTo(0, 0.035); s.lineTo(0.09, 0.06); s.lineTo(0.1, -0.06); s.lineTo(0, -0.035); s.lineTo(0, 0.035); const g = new THREE.ExtrudeGeometry(s, { depth: 0.02, bevelEnabled: false }); g.translate(0, 0, -0.01); return g; })(),
    pickHead: (() => { const g = new THREE.TorusGeometry(0.11, 0.018, 6, 14, Math.PI * 0.8); g.rotateZ(Math.PI * 0.1); return g; })(),
    sack: (() => { const g = new THREE.SphereGeometry(0.11, 12, 10); g.scale(1, 1.15, 0.85); return g; })(),
    tie: new THREE.TorusGeometry(0.045, 0.012, 6, 14),
    baguette: (() => { const g = THREE.CapsuleGeometry ? new THREE.CapsuleGeometry(0.035, 0.24, 4, 8) : new THREE.CylinderGeometry(0.035, 0.035, 0.3, 8); g.rotateZ(Math.PI / 2); return g; })(),
    tray: new THREE.BoxGeometry(0.34, 0.03, 0.22),
    ring: new THREE.TorusGeometry(0.62, 0.05, 8, 48),
    ringInk: new THREE.TorusGeometry(0.71, 0.014, 6, 56)
  };
  // ---- materials (clay cel, the folk's own three-tone paint) ----
  const M = {
    wood: cloth('#cf9455'), woodDark: cloth('#9a6236'), wicker: cloth('#c98a4a', '#a8703a', 26), wickerRim: cloth('#b47a34'),
    apple: cloth('#e2483a'), lemon: cloth('#e8893a'), bread: cloth('#e3a65c'),
    paper: cloth('#f4ead6'), flap: cloth('#e6d3ae'), seal: cloth('#e0503f'),
    handle: cloth('#8a5a3a'), iron: cloth('#6f6470'),
    board: cloth('#f2e6cc'), red: cloth('#e0503f'),
    dust: [cloth('#eadcc2'), cloth('#e2d0b0'), cloth('#efe3cc')],
    plank: cloth('#d9a868'), plankDark: cloth('#a8743f'), stone: cloth('#d8cdbb'), stoneB: cloth('#c9bba6'),
    bark: cloth('#8a5a3a'), heart: cloth('#e2b98a'), sack: cloth('#c9b59c'), tieM: cloth('#9a6236'), crust: cloth('#d58e45'),
    ink: cloth('#3d5588'), cream: cloth('#f3ecdc')
  };

  function crate() {
    const g = new THREE.Group();
    g.add(mesh(G.crate, M.wood));
    g.add(mesh(G.slat, M.woodDark, 0, 0.07, 0), mesh(G.slat, M.woodDark, 0, -0.07, 0));
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => g.add(mesh(G.post, M.woodDark, sx * 0.14, 0, sz * 0.1)));
    return layer(g);
  }
  function basket() {
    const g = new THREE.Group();
    g.add(mesh(G.basket, M.wicker));
    const rim = mesh(G.rim, M.wickerRim, 0, 0.065, 0); rim.rotation.x = Math.PI / 2; g.add(rim);
    g.add(mesh(G.handle, M.wickerRim, 0, 0.065, 0));
    g.add(mesh(G.fruit, M.apple, -0.06, 0.08, 0.03), mesh(G.fruit, M.lemon, 0.065, 0.075, -0.02));
    const bun = mesh(G.bun, M.bread, 0, 0.09, 0.04); bun.rotation.y = 0.5; g.add(bun);
    return layer(g);
  }
  function envelope() {
    const g = new THREE.Group();
    g.add(mesh(G.env, M.paper));
    const f = mesh(G.flap, M.flap, 0, 0, 0.007); g.add(f);
    g.add(mesh(G.seal, M.seal, 0, 0.0, 0.016));
    return layer(g);
  }
  function mallet() {   // pivot at the grip; the head sits at the far end (-y, along the arm)
    const g = new THREE.Group();
    g.add(mesh(G.handleM, M.handle));
    g.add(mesh(G.headM, M.iron, 0, -0.2, 0));
    return layer(g);
  }
  function placard() {   // a protest board on a stick: blank cream with one red bar
    const g = new THREE.Group();
    g.add(mesh(G.stick, M.handle));
    g.add(mesh(G.board, M.board, 0, 0.56, 0));
    g.add(mesh(G.bar, M.red, 0, 0.56, 0.012));
    return layer(g);
  }
  function plank() {   // a sawn board: long, with darker end grain (reads as a stripe from above)
    const g = new THREE.Group();
    g.add(mesh(G.plank, M.plank));
    g.add(mesh(G.plankEnd, M.plankDark, -0.31, 0, 0), mesh(G.plankEnd, M.plankDark, 0.31, 0, 0));
    return layer(g);
  }
  function stone() { const g = new THREE.Group(); const m = mesh(G.stone, Math.random() < 0.5 ? M.stone : M.stoneB); m.rotation.y = Math.random() * 3; g.add(m); return layer(g); }
  function log() { const g = new THREE.Group(); g.add(mesh(G.log, M.bark), mesh(G.logEnd, M.heart)); return layer(g); }
  function loaves() {   // a baker's tray of loaves (a baguette and two round ones)
    const g = new THREE.Group();
    g.add(mesh(G.tray, M.wood));
    const b = mesh(G.baguette, M.crust, 0, 0.045, -0.04); b.rotation.y = 0.15; g.add(b);
    g.add(mesh(G.bun, M.bread, -0.08, 0.05, 0.06), mesh(G.bun, M.bread, 0.09, 0.05, 0.06));
    return layer(g);
  }
  function sack() { const g = new THREE.Group(); g.add(mesh(G.sack, M.sack)); const t = mesh(G.tie, M.tieM, 0, 0.1, 0); t.rotation.x = Math.PI / 2; g.add(t); return layer(g); }
  // tools: pivot at the grip, the working end at the far end (-y, along the arm), like the mallet
  function hoe() {
    const g = new THREE.Group();
    const h = mesh(G.handleM, M.handle); h.scale.set(1, 1.7, 1); g.add(h);
    g.add(mesh(G.hoeBlade, M.iron, 0, -0.34, 0.045));
    return layer(g);
  }
  function axe() { const g = new THREE.Group(); const h = mesh(G.handleM, M.handle); h.scale.set(1, 1.15, 1); g.add(h); const a = mesh(G.axeHead, M.iron, 0, -0.21, 0); a.rotation.y = Math.PI / 2; g.add(a); return layer(g); }
  function pick() { const g = new THREE.Group(); const h = mesh(G.handleM, M.handle); h.scale.set(1, 1.15, 1); g.add(h); const p = mesh(G.pickHead, M.iron, 0, -0.14, 0); p.rotation.y = Math.PI / 2; g.add(p); return layer(g); }
  // the minister / hover highlight: a cream paper ring with an ink thread, flat on the ground
  function halo() {
    const g = new THREE.Group();
    const a = mesh(G.ring, M.cream); a.rotation.x = Math.PI / 2; a.scale.set(1, 1, 0.3);
    const b = mesh(G.ringInk, M.ink); b.rotation.x = Math.PI / 2; b.scale.set(1, 1, 0.3);
    g.add(a, b); return g;
  }
  // free-standing things (piles, halos) are drawn in the live folk pass only: off layer 0, so the held world
  // painting never bakes a stale copy of them
  function liveOnly(obj) { obj.traverse(o => { if (!o.isMesh) return; o.layers.set(FACE); o.layers.enable(MASK); o.castShadow = false; }); return obj; }
  function nubArm(mat) {   // the drops' / pips' nub arm, for species that have none (scoots, flits)
    const g = new THREE.Group(); g.add(mesh(G.nub, mat)); return layer(g);
  }

  // ---- paper dust: a pool of cel-shaded cream puffs (no keylines: kept in colourOnly while alive) ----
  const dustRoot = new THREE.Group(); dustRoot.name = 'agents-dust'; ctx.scene.add(dustRoot);
  const pool = [], live = [];
  function grab() {
    let m = pool.pop();
    if (!m) { m = new THREE.Mesh(G.dust, M.dust[(live.length + pool.length) % 3]); m.castShadow = false; m.layers.enable(FACE); m.layers.enable(MASK); }
    dustRoot.add(m); ctx.colourOnly.push(m); return m;
  }
  function drop(m) { dustRoot.remove(m); const i = ctx.colourOnly.indexOf(m); if (i >= 0) ctx.colourOnly.splice(i, 1); pool.push(m); }
  // a ring of puffs bursting out along the ground and lifting (landing / stomp / poof): they swell, rise, thin away
  function puff(x, z, { n = 9, r = 0.3, size = 0.12, speed = 1.7, up = 0.9, life = 0.7, y = 0 } = {}) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.5, m = grab();
      const s = size * (0.7 + Math.random() * 0.6), sp = speed * (0.7 + Math.random() * 0.6);
      live.push({ m, p: V(x + Math.cos(a) * r, y + s * 0.6, z + Math.sin(a) * r),
        v: V(Math.cos(a) * sp, up * (0.5 + Math.random() * 0.8), Math.sin(a) * sp),
        s, t: 0, life: life * (0.8 + Math.random() * 0.4) });
    }
  }
  function updateDust(dt) {
    for (let i = live.length - 1; i >= 0; i--) {
      const d = live[i]; d.t += dt;
      const u = d.t / d.life;
      if (u >= 1) { drop(d.m); live.splice(i, 1); continue; }
      d.v.x *= Math.pow(0.02, dt); d.v.z *= Math.pow(0.02, dt); d.v.y *= Math.pow(0.15, dt);
      d.p.addScaledVector(d.v, dt);
      d.m.position.copy(d.p);
      const k = u < 0.25 ? 0.45 + 0.55 * (u / 0.25) : 1 - Math.pow((u - 0.25) / 0.75, 1.6);   // swell fast, thin away
      d.m.scale.set(d.s * k * 1.2, d.s * k, d.s * k * 1.2);
    }
  }
  function disposeAll() {
    live.splice(0).forEach(d => drop(d.m));
    ctx.scene.remove(dustRoot);
    Object.values(G).forEach(g => g.dispose && g.dispose());
  }

  const make = { crate, basket, plank, stone, log, loaves, sack, hoe, axe, pick, mallet, envelope, placard };
  return { crate, basket, envelope, mallet, placard, nubArm, plank, stone, log, loaves, sack, hoe, axe, pick, halo, liveOnly, make, layer, puff, updateDust, dustCount: () => live.length, G, M, disposeAll };
}
