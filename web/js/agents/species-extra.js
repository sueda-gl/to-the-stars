// Townsfolk: three new species of the Red arch world, ADDITIVE to the reference (web/js/paint/folk.js stays verbatim).
// Made in the reference's own grammar: the folk's clay cel material (folk.clayMat: lit / shadow / deep, a wobbly painted
// terminator, no gradients), bead-ink faces at opacity .5 with a white glint, soft blush, nub arms and the same scale
// (a body ~0.5-0.65 tall, root scale 1.4-1.8), drawn in the live folk pass (FACE_LAYER) and kept out of the keylines.
//
//   twinkle  a soft five-point lemon star. It walks on its two lower points (a waddle), the two side points are its
//            arms, the top point wears the hat. Yellow: §13, it never wears green.
//   glim     a little paper lantern on plum legs: cream-apricot paper with pleats, plum caps, a wire handle on top.
//   moth     a fawn teardrop moth that hovers: round face at the front, the body tapering behind, powder-blue forewings
//            with eye-spots and pink hindwings that flap, feathery antennae and a fluffy cream ruff.
// The loaves (folk.js, teal rounded boxes: "the blue square ones") join them as townsfolk.
//
//   const extra = extendFolk(ctx, folk)       // once per folk: folk.make.twinkle / glim / moth, folk.twinkles / glims /
//                                             // moths, the update + remove seams, the painter's folk-pass visibility
//   extra.pose[species](a, P)                 // pure pose writers (the trailer): P = { x, z, heading, stride, w, hop,
//                                             //   squash, cheer, wave, blink, t, y? }
//   dressTownsfolk(rec, kit)                  // identity.js: the species' uniform (matching accessories per species)
//
// Wiring: the painter (post.js) shows / hides folk through its lists and folk.allLimbs; the new roots go in allLimbs, so
// they are left out of the painted world and drawn in the folk pass exactly like the reference's own folk. The update
// runs right after folk.update (same seam the game uses: `controlled`, `path`, `wait`, `speed`, `heading`).

export const EXTRA_SPECIES = ['twinkle', 'glim', 'moth'];
export const TOWNSFOLK = ['loaf', 'twinkle', 'glim', 'moth'];   // our population beyond the flits and floaties
export const PLURALS = { twinkle: 'twinkles', glim: 'glims', moth: 'moths', loaf: 'loaves', flit: 'flits', floatie: 'floaties' };
// where a held thing sits (body-local) and the arm pose for it; the hand on an arm group (agents.js letters / tools)
export const CARRY = {
  twinkle: { p: [0, 0.3, 0.2], s: 0.8, armX: -1.2, armZ: 0.55 },
  glim: { p: [0, 0.2, 0.3], s: 0.8, armX: -1.25, armZ: 0.2 },
  moth: { p: [0, -0.24, 0.08], s: 0.72, armX: -0.4, armZ: 0.15 }
};
export const HAND = { twinkle: -0.31, glim: -0.06, moth: -0.05 };
export const HEAD = { twinkle: 0.86, glim: 0.78, moth: 0.95, loaf: 0.78 };   // head height (x scale) for bubbles / pins

// ---- pure gaits (the trailer): distance travelled -> the pose numbers ----
// walkers: stride phase from the distance (the same rate as the live update)
export const STRIDE = { twinkle: 0.2, glim: 0.16, moth: 0.3 };
export const strideOf = (species, dist, sc) => dist / ((STRIDE[species] || 0.2) * sc) * Math.PI * 0.5;
// loaves hop: progress along the way comes in jumps of `len`; crouch (0-.2), air (.2-.85), land (.85-1) of each cycle
export function hopGait(dist, len, sc = 1.5) {
  if (dist <= 0) return { along: 0, hop: 0, squash: 1, lift: 1, air: false, tip: 0 };
  const k = Math.floor(dist / len), u = dist / len - k;
  let along = k * len, hop = 0, squash = 1, lift = 1, air = false, tip = 0;
  if (u < 0.2) { const c = Math.sin(u / 0.2 * Math.PI * 0.5); squash = 1 - 0.22 * c; lift = 1 - 0.55 * c; }
  else if (u < 0.85) { const v = (u - 0.2) / 0.65; along += len * (v * v * (3 - 2 * v)); hop = Math.sin(Math.PI * v) * (0.26 + len / sc * 0.18) * sc; squash = 1.14 - 0.2 * Math.sin(Math.PI * v); air = true; tip = 0.18 * Math.cos(Math.PI * v); }
  else { const v = (u - 0.85) / 0.15; along += len; squash = 0.74 + 0.26 * v; lift = 0.6 + 0.4 * v; }
  return { along, hop, squash, lift, air, tip };
}

const mulberry = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const wrapA = a => Math.atan2(Math.sin(a), Math.cos(a));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function extendFolk(ctx, folk) {
  if (folk.extra) return folk.extra;
  const { V, Y, scene, camera, colourOnly, flags } = ctx;
  const FACE = folk.FACE_LAYER;
  const clay = folk.clayMat;
  const nav = folk.nav;
  const twinkles = [], glims = [], moths = [];
  const lists = { twinkle: twinkles, glim: glims, moth: moths };

  // ---- the reference's face kit (same sizes, same inks) ----
  const beadGeo = new THREE.SphereGeometry(0.03, 12, 10); beadGeo.scale(1, 1.12, 0.45);
  const shineGeo = new THREE.SphereGeometry(0.009, 6, 4); shineGeo.scale(1, 1, 0.3);
  const blushGeo = new THREE.SphereGeometry(0.028, 12, 8); blushGeo.scale(1.15, 0.8, 0.3);
  const smileGeo = new THREE.TorusGeometry(0.017, 0.0055, 6, 12, Math.PI); smileGeo.rotateZ(Math.PI);
  const oGeo = new THREE.SphereGeometry(0.016, 10, 8); oGeo.scale(1, 1.2, 0.3);
  const nubGeo = new THREE.SphereGeometry(0.045, 10, 8); nubGeo.scale(0.75, 1.1, 0.8);
  const shineMat = new THREE.MeshBasicMaterial({ color: 0xffffff, opacity: 0.5 });
  const blushMat = new THREE.MeshBasicMaterial({ color: 0xf06f78, opacity: 0.5 });
  const legGeo = new THREE.CylinderGeometry(0.034, 0.03, 1, 8); legGeo.translate(0, 0.5, 0);
  const footGeo = new THREE.SphereGeometry(0.05, 12, 8); footGeo.scale(1, 0.7, 1.2); footGeo.translate(0, 0, 0.012);
  const blobTex = (() => {
    const cv = document.createElement('canvas'); cv.width = cv.height = 64;
    const g = cv.getContext('2d'), gr = g.createRadialGradient(32, 32, 2, 32, 32, 31);
    gr.addColorStop(0, 'rgba(60,40,48,0.42)'); gr.addColorStop(0.6, 'rgba(60,40,48,0.26)'); gr.addColorStop(1, 'rgba(60,40,48,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(cv);
  })();
  const blobMat = new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false });
  const blobGeo = new THREE.CircleGeometry(0.34 * 1.05, 24); blobGeo.rotateX(-Math.PI / 2);

  function eye(parent, ink, x, y, z, ry = 0, rx = 0, s = 1) {
    const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.set(rx, ry, 0); g.scale.setScalar(s);
    const sh = new THREE.Mesh(shineGeo, shineMat); sh.position.set(0.01, 0.013, 0.014);
    g.add(new THREE.Mesh(beadGeo, ink), sh); parent.add(g); return g;
  }
  const at = (parent, geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.castShadow = true; parent.add(m); return m; };
  // a soft rounded point along +y (a star ray, a lantern finial): a puffy cone with a ball tip
  function softPoint(y0, y1, rb, rt, flat = 1) {
    const pts = [], yc = y1 - rt, N = 12;
    pts.push(new THREE.Vector2(0.001, y0));
    for (let i = 0; i <= N; i++) { const u = i / N; pts.push(new THREE.Vector2(rt + (rb - rt) * (1 - Math.pow(u, 1.5)), y0 + (yc - y0) * u)); }
    for (let k = 1; k <= 7; k++) { const a = k / 7 * Math.PI / 2; pts.push(new THREE.Vector2(Math.max(0.001, rt * Math.cos(a)), yc + rt * Math.sin(a))); }
    const g = new THREE.LatheGeometry(pts, 22); g.scale(1, 1, flat); g.computeVertexNormals(); return g;
  }
  // fewer draws: pieces that share a parent and a material and never move on their own become one mesh (the
  // identity bake's trick). Striped / ribbed paint reads object-space positions, so those meshes stay as they are.
  const _mi = new THREE.Matrix4();
  function mergeStatic(root, keep) {
    const groups = []; root.traverse(o => { if (o.children && o.children.length > 1) groups.push(o); });
    for (const g of groups) {
      const buckets = new Map();
      for (const m of g.children) {
        if (!m.isMesh || keep.has(m) || !m.visible) continue;
        const u = m.material.uniforms; if (u && ((u.uStripeF && u.uStripeF.value > 0) || (u.uRibs && u.uRibs.value > 0))) continue;
        const k = m.material.uuid; if (!buckets.has(k)) buckets.set(k, []); buckets.get(k).push(m);
      }
      for (const ms of buckets.values()) {
        if (ms.length < 2) continue;
        const P = [], N = [];
        for (const m of ms) { m.updateMatrix(); const gg = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone(); gg.applyMatrix4(m.matrix); P.push(gg.attributes.position.array); N.push(gg.attributes.normal.array); gg.dispose(); g.remove(m); }
        const n = P.reduce((s, x) => s + x.length, 0), pos = new Float32Array(n), nor = new Float32Array(n); let o = 0;
        P.forEach((x, i) => { pos.set(x, o); nor.set(N[i], o); o += x.length; });
        const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); geo.computeBoundingSphere();
        const mesh = new THREE.Mesh(geo, ms[0].material); mesh.castShadow = ms[0].castShadow; g.add(mesh);
      }
    }
  }
  // the creature's frame: root (world xz, heading) > body (squash, sway); a ground shadow; drawn in the folk pass
  function frame(a) {
    mergeStatic(a.root, new Set([a.smile, a.oMouth, ...(a.gl || []).flatMap(l => [l.leg, l.foot])]));
    a.root.traverse(o => { if (o.isMesh) { o.layers.enable(FACE); o.castShadow = !!(o.material && o.material.uniforms); } });   // the face inks cast no shadow (fewer draws)
    const blob = new THREE.Mesh(blobGeo, blobMat); blob.layers.set(FACE); blob.position.set(0, -100, 0); scene.add(blob);
    a.blob = blob; a.legs = []; a.vel = V(0, 0, 0); a.path = []; a.wait = a.wait ?? 2; a.lookViewer = false; a.lookSwap = 6;
    a.stride = 0; a.w = 0; a.hop = 0; a.blink = 0; a.nextBlink = 1 + a.rand() * 4;
    scene.add(a.root); colourOnly.push(a.root); folk.allLimbs.push(a.root);
    const sp = nav.spots && nav.spots.length ? nav.spots[Math.floor(a.rand() * nav.spots.length)] : [0, 0];
    a.pos = V(sp[0] + (a.rand() - 0.5) * 3, 0, sp[1] + (a.rand() - 0.5) * 1.6);
    a.root.position.copy(a.pos);
    lists[a.species].push(a);
    return a;
  }

  // ================= twinkle: the star =================
  const TW_COLS = [['#ffd84f', '#f5a93e', '#c66c42'], ['#ffe066', '#f7b448', '#cc7648'], ['#ffcf3e', '#f09d34', '#bd5f3c'], ['#ffe27a', '#f8bb52', '#d07e4c']];
  const TW = { C: 0.31, R: 0.2, FLAT: 0.62, L: 0.37, ARM: 1.885, LEG: 0.628 };
  let twMats, twCore, twUp, twDown, twInk;
  function initTwinkle() {
    if (twMats) return;
    twMats = TW_COLS.map(([b, s, d]) => clay(b, s, d));
    twCore = new THREE.SphereGeometry(TW.R, 30, 20); twCore.scale(1, 1, TW.FLAT);
    twUp = softPoint(0.05, TW.L, 0.13, 0.05, TW.FLAT);
    twDown = twUp.clone(); twDown.rotateZ(Math.PI);
    twInk = new THREE.MeshBasicMaterial({ color: 0x2a1812, opacity: 0.5 });
  }
  function makeTwinkle(i = 0) {
    initTwinkle();
    const rand = mulberry(7919 * (i + 1) + 17), m = twMats[i % twMats.length];
    const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
    const C = TW.C, R = TW.R, zf = (x, y) => Math.sqrt(Math.max(0, R * R - x * x - y * y)) * TW.FLAT;
    at(body, twCore, m, 0, C, 0);
    const head = new THREE.Group(); head.position.set(0, C, 0); body.add(head); at(head, twUp, m, 0, 0, 0);
    const arms = [-1, 1].map(sd => { const g = new THREE.Group(); g.position.set(0, C, 0); g.rotation.z = sd * TW.ARM; at(g, twDown, m, 0, 0, 0); body.add(g); return g; });
    const feet = [-1, 1].map(sd => { const g = new THREE.Group(); g.position.set(0, C, 0); g.rotation.z = sd * TW.LEG; at(g, twDown, m, 0, 0, 0); body.add(g); return g; });
    const eyes = [-1, 1].map(sd => eye(body, twInk, sd * 0.066, C + 0.025, zf(0.066, 0.025) - 0.006, sd * 0.3, -0.05));
    [-1, 1].forEach(sd => { const b = at(body, blushGeo, blushMat, sd * 0.118, C - 0.022, zf(0.118, -0.022) - 0.002, 0, sd * 0.5); b.castShadow = false; });
    const smile = at(body, smileGeo, twInk, 0, C - 0.03, zf(0, -0.03) + 0.002); smile.castShadow = false;
    const oMouth = at(body, oGeo, twInk, 0, C - 0.035, zf(0, -0.035) + 0.002); oMouth.visible = false;
    const sc = 1.45 + rand() * 0.3; root.scale.setScalar(sc);
    const a = { species: 'twinkle', rand, root, body, head, arms, feet, eyes, smile, oMouth, sc, speed: 0.75 + rand() * 0.2, fidget: rand() * 6.28, heading: rand() * 6.28, controlled: false };
    return frame(a);
  }
  // P: x, z, heading, stride (rad), w (0 idle .. 1 walking), hop (m), squash, cheer, wave (right point), blink, t
  function poseTwinkle(a, P) {
    const t = P.t || 0, w = P.w || 0, s = P.stride || 0, st = (P.squash || 1);
    a.root.position.set(P.x, (P.y || 0) + (P.hop || 0), P.z); a.root.rotation.set(0, P.heading, 0);
    const swing = Math.sin(s) * 0.4 * w;
    const drop = TW.L * Math.cos(TW.LEG) * (1 - Math.cos(swing));        // a swung point lifts its tip: the body sinks onto it
    const inv = 1 / Math.sqrt(st);
    a.body.scale.set(inv, st, inv);
    a.body.position.set(0, -drop, 0);
    const idle = 1 - w;
    a.body.rotation.set(0.06 * w + (P.pitch || 0), 0, Math.sin(s) * 0.09 * w + idle * Math.sin(t * 0.9 + a.fidget) * 0.05);
    a.feet.forEach((g, j) => { const sd = j ? 1 : -1; g.rotation.set(sd * swing, 0, sd * TW.LEG * (1 - 0.25 * (P.cheer || 0))); });
    const ch = P.cheer || 0, wv = P.wave || 0;
    a.arms.forEach((g, j) => {
      const sd = j ? 1 : -1;
      let z = TW.ARM - 0.12 * w + ch * 0.75 + idle * Math.sin(t * 1.3 + a.fidget + j) * 0.05;
      if (sd > 0 && wv > 0) z += wv * (0.85 + Math.sin(t * 12 + a.fidget) * 0.3);
      g.rotation.set(-sd * swing * 0.6, 0, sd * z);
    });
    a.head.rotation.set(0, 0, Math.sin(t * 0.8 + a.fidget) * 0.05 * idle - Math.sin(s) * 0.05 * w);
    a.eyes.forEach(e => e.scale.y = P.blink ? 0.12 : 1);
    a.smile.visible = !(P.hop > 0.02); a.oMouth.visible = P.hop > 0.02;
    a.blob.position.set(P.x, 0.015 + (P.y || 0), P.z); a.blob.scale.setScalar(a.sc * 0.78 * (1 - Math.min(0.45, P.hop || 0)));
  }

  // ================= glim: the paper lantern =================
  const GL_COLS = [['#fff1cf', '#f6c98e', '#c98a5e'], ['#ffe7c2', '#f3bb84', '#c27c58'], ['#fdebc8', '#f0c08c', '#be8460'], ['#fff4d8', '#f8d09a', '#cf9468']];
  const GL = { LH: 0.1, H: 0.5, hip: 0.09 };
  const GL_PROF = [[0.001, 0], [0.105, 0.0], [0.15, 0.025], [0.188, 0.08], [0.21, 0.16], [0.215, 0.25], [0.208, 0.33], [0.185, 0.41], [0.145, 0.475], [0.105, 0.5], [0.001, 0.5]];
  const glR = y => { for (let i = 1; i < GL_PROF.length; i++) if (GL_PROF[i][1] >= y) { const [ax, ay] = GL_PROF[i - 1], [bx, by] = GL_PROF[i]; return by === ay ? bx : ax + (bx - ax) * (y - ay) / (by - ay); } return 0.1; };
  let glMats, glGeo, glCap, glKnob, glHandle, glInk, glLeg, glFoot;
  function initGlim() {
    if (glMats) return;
    glMats = GL_COLS.map(([b, s, d]) => clay(b, s, d, 13));   // paper pleats (the reference's rib stripes)
    glGeo = new THREE.LatheGeometry(GL_PROF.map(p => new THREE.Vector2(p[0], p[1])), 40); glGeo.translate(0, -GL.H / 2, 0); glGeo.rotateX(Math.PI / 2); glGeo.computeVertexNormals();
    glCap = new THREE.CylinderGeometry(1, 1, 1, 22);
    glKnob = new THREE.SphereGeometry(0.03, 10, 8);
    glHandle = new THREE.TorusGeometry(0.075, 0.012, 6, 20, Math.PI);
    glInk = new THREE.MeshBasicMaterial({ color: 0x2a1820, opacity: 0.5 });
    glLeg = clay('#5a4458', '#46344a', '#30243a'); glFoot = clay('#3b2c40', '#2e2236', '#211a2a');
  }
  function makeGlim(i = 0) {
    initGlim();
    const rand = mulberry(6271 * (i + 3) + 5), m = glMats[i % glMats.length];
    const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
    const paper = at(body, glGeo, m, 0, GL.H / 2, 0, -Math.PI / 2);
    const plum = clay('#4a3848', '#3b2c40', '#2e2236');
    at(body, glCap, plum, 0, 0.005, 0).scale.set(0.12, 0.04, 0.12);
    at(body, glCap, plum, 0, GL.H + 0.012, 0).scale.set(0.115, 0.055, 0.115);
    at(body, glCap, plum, 0, GL.H + 0.045, 0).scale.set(0.07, 0.03, 0.07);
    at(body, glKnob, plum, 0, -0.03, 0);
    at(body, glHandle, plum, 0, GL.H + 0.055, 0);
    const zf = (x, y) => Math.sqrt(Math.max(0, glR(y) ** 2 - x * x));
    const ey = 0.275, eyes = [-1, 1].map(sd => eye(body, glInk, sd * 0.07, ey, zf(0.07, ey) - 0.004, sd * 0.32, 0));
    [-1, 1].forEach(sd => { const b = at(body, blushGeo, blushMat, sd * 0.125, 0.225, zf(0.125, 0.225) - 0.003, 0, sd * 0.58); b.castShadow = false; });
    const smile = at(body, smileGeo, glInk, 0, 0.222, zf(0, 0.222) + 0.002); smile.castShadow = false;
    const oMouth = at(body, oGeo, glInk, 0, 0.215, zf(0, 0.215) + 0.002); oMouth.visible = false;
    const arms = [-1, 1].map(sd => { const g = new THREE.Group(); g.position.set(sd * 0.212, 0.2, 0.01); const n = at(g, nubGeo, m, 0, -0.03, 0); body.add(g); return g; });
    // little plum legs, inside the root (analytic gait: no world-space feet to juggle)
    const legs = [-1, 1].map(sd => ({ sd, leg: at(root, legGeo, glLeg, 0, 0, 0), foot: at(root, footGeo, glFoot, 0, 0, 0) }));
    paper.userData.skin = true;
    const sc = 1.45 + rand() * 0.3; root.scale.setScalar(sc);
    const a = { species: 'glim', rand, root, body, arms, gl: legs, eyes, smile, oMouth, sc, speed: 0.8 + rand() * 0.2, fidget: rand() * 6.28, heading: rand() * 6.28, controlled: false };
    return frame(a);
  }
  const _h = new THREE.Vector3(), _k = new THREE.Vector3(), _d = new THREE.Vector3();
  function poseGlim(a, P) {
    const t = P.t || 0, w = P.w || 0, s = P.stride || 0, st = P.squash || 1, idle = 1 - w;
    a.root.position.set(P.x, (P.y || 0) + (P.hop || 0), P.z); a.root.rotation.set(0, P.heading, 0);
    const bob = Math.abs(Math.cos(s)) * 0.022 * w, inv = 1 / Math.sqrt(st);
    a.body.scale.set(inv, st * (1 + idle * Math.sin(t * 1.9 + a.fidget) * 0.012), inv);
    a.body.position.set(0, GL.LH + bob - 0.018 * w, 0);
    a.body.rotation.set(0.07 * w + (P.pitch || 0), 0, Math.sin(s) * 0.06 * w + idle * Math.sin(t * 0.8 + a.fidget) * 0.03);
    // the gait: each foot swings forward on its half of the stride and lifts; hips ride under the lantern
    const air = (P.hop || 0) > 0.02;
    a.gl.forEach(l => {
      const ph = s + (l.sd > 0 ? 0 : Math.PI);
      const fz = Math.sin(ph) * 0.09 * w, lift = air ? 0.04 : Math.max(0, Math.cos(ph)) * 0.05 * w;
      _h.set(l.sd * GL.hip, a.body.position.y + 0.03, 0); _k.set(l.sd * GL.hip * 1.05, lift + 0.03, fz);
      _d.copy(_h).sub(_k); const len = Math.max(0.01, _d.length());
      l.leg.position.copy(_k); l.leg.quaternion.setFromUnitVectors(Y, _d.divideScalar(len)); l.leg.scale.set(0.95, len, 0.95);
      l.foot.position.copy(_k); l.foot.rotation.set(air ? 0.4 : 0, 0, 0); l.foot.scale.setScalar(0.9);
    });
    const ch = P.cheer || 0, wv = P.wave || 0;
    a.arms.forEach((g, j) => {
      const sd = j ? 1 : -1;
      let z = sd * (0.28 + ch * 1.9) + idle * Math.sin(t * 1.4 + j) * 0.04;
      if (sd > 0 && wv > 0) z = 0.28 + wv * (2.2 + Math.sin(t * 13 + a.fidget) * 0.32);
      g.rotation.set(sd * Math.sin(s) * 0.55 * w, 0, z);
    });
    a.eyes.forEach(e => e.scale.y = P.blink ? 0.12 : 1);
    a.smile.visible = !air; a.oMouth.visible = air;
    a.blob.position.set(P.x, 0.015 + (P.y || 0), P.z); a.blob.scale.setScalar(a.sc * 0.8 * (1 - Math.min(0.45, P.hop || 0)));
  }

  // ================= moth: the teardrop that hovers =================
  const MO_COLS = [['#dcbfa6', '#bb9282', '#88637a'], ['#e3c8ae', '#c39a88', '#8e6a80'], ['#d6b59c', '#b4887a', '#7f5a72'], ['#e8d0b8', '#c8a290', '#947086']];
  const MO_PROF = [[0.001, 0], [0.07, 0.006], [0.13, 0.03], [0.18, 0.08], [0.2, 0.14], [0.195, 0.2], [0.17, 0.27], [0.13, 0.34], [0.085, 0.41], [0.045, 0.46], [0.016, 0.49], [0.001, 0.5]];
  const MO = { HOVER: 0.26, FRONT: 0.2, CY: 0.22 };
  // the body axis runs along -z from the round face (z = FRONT) to the tail; centre height CY above the root
  const moR = s => { for (let i = 1; i < MO_PROF.length; i++) if (MO_PROF[i][1] >= s) { const [ax, ay] = MO_PROF[i - 1], [bx, by] = MO_PROF[i]; return ax + (bx - ax) * (s - ay) / (by - ay); } return 0; };
  const moS = r => { for (let i = 1; i < 5; i++) if (MO_PROF[i][0] >= r) { const [ax, ay] = MO_PROF[i - 1], [bx, by] = MO_PROF[i]; return ay + (by - ay) * (r - ax) / (bx - ax); } return 0.14; };
  let moMats, moGeo, foreGeo, hindGeo, featherGeo, stalkGeo, ruffGeo, spotGeo, moInk, wingMats, hindMats, spotMat, dotMat, ruffMat;
  function wingGeo(rx, ry, cx, cy, tilt) {
    const s = new THREE.Shape(); s.absellipse(cx, cy, rx, ry, 0, Math.PI * 2, false, tilt);
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.01, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 3, curveSegments: 20 });
    g.translate(0, 0, -0.005); g.rotateX(Math.PI / 2); g.computeVertexNormals(); return g;   // lies in x-z: +x out from the hinge, -z back
  }
  function initMoth() {
    if (moMats) return;
    moMats = MO_COLS.map(([b, s, d]) => clay(b, s, d));
    moGeo = new THREE.LatheGeometry(MO_PROF.map(p => new THREE.Vector2(p[0], p[1])), 34); moGeo.rotateX(-Math.PI / 2); moGeo.translate(0, 0, MO.FRONT); moGeo.computeVertexNormals();
    foreGeo = wingGeo(0.2, 0.125, 0.17, 0.05, 0.35);
    hindGeo = wingGeo(0.125, 0.09, 0.11, 0.14, -0.25);
    spotGeo = new THREE.SphereGeometry(1, 14, 8); spotGeo.scale(1, 0.25, 1);
    stalkGeo = new THREE.CylinderGeometry(0.008, 0.011, 0.16, 6); stalkGeo.translate(0, 0.08, 0);
    featherGeo = new THREE.SphereGeometry(0.05, 12, 8); featherGeo.scale(0.32, 1, 0.22); featherGeo.translate(0, 0.19, 0);
    ruffGeo = new THREE.TorusGeometry(0.17, 0.055, 10, 30);
    moInk = new THREE.MeshBasicMaterial({ color: 0x24161e, opacity: 0.5 });
    wingMats = [clay('#a9c6f2', '#7f9ee0', '#55639e'), clay('#b5cdf4', '#88a6e2', '#5b69a6')];
    hindMats = [clay('#f2b0ba', '#e0848f', '#a85a74'), clay('#f4bcc2', '#e4919a', '#ae627a')];
    spotMat = clay('#f6efe2', '#e6cfc4', '#b89aa8'); dotMat = clay('#e2483a', '#c4363a', '#8e2a40');
    ruffMat = clay('#f8f1e4', '#e6cfc4', '#b89aa8');
  }
  function makeMoth(i = 0) {
    initMoth();
    const rand = mulberry(4241 * (i + 7) + 11), m = moMats[i % moMats.length];
    const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
    body.position.y = MO.HOVER;
    const shell = new THREE.Group(); shell.position.y = MO.CY; body.add(shell);   // centred on the body axis
    at(shell, moGeo, m, 0, 0, 0).userData.skin = true;
    // the round face: points on the front cap (radius r from the axis -> how far back along the axis)
    const face = (x, y, lift = 0.003) => { const r = Math.hypot(x, y), s = moS(r); return [x, y, MO.FRONT - s + lift]; };
    const eyes = [-1, 1].map(sd => { const p = face(sd * 0.07, 0.035, -0.004); return eye(shell, moInk, p[0], p[1], p[2], sd * 0.45, -0.2); });
    [-1, 1].forEach(sd => { const p = face(sd * 0.125, -0.02, -0.002); const b = at(shell, blushGeo, blushMat, p[0], p[1], p[2], 0, sd * 0.75); b.castShadow = false; });
    const sp = face(0, -0.035); const smile = at(shell, smileGeo, moInk, sp[0], sp[1], sp[2] + 0.004); smile.castShadow = false;
    const oMouth = at(shell, oGeo, moInk, sp[0], sp[1], sp[2] + 0.004); oMouth.visible = false;
    // the fluffy ruff round the neck
    at(shell, ruffGeo, ruffMat, 0, 0, MO.FRONT - 0.12).scale.set(1.08, 1.02, 0.8);
    // antennae: a stalk and a feathery leaf each
    const ants = [-1, 1].map(sd => { const g = new THREE.Group(); g.position.set(sd * 0.06, 0.15, MO.FRONT - 0.07); g.rotation.set(0.5, 0, -sd * 0.42); at(g, stalkGeo, m, 0, 0, 0); at(g, featherGeo, m, 0, 0, 0); shell.add(g); return g; });
    // wings: hinged along the back, forewing over hindwing; eye-spots painted on the forewings
    const v = i % 2;
    const wings = [-1, 1].map(sd => {
      const g = new THREE.Group(); g.position.set(sd * 0.05, 0.16, -0.02); shell.add(g);
      const inner = new THREE.Group(); inner.scale.set(sd, 1, 1); g.add(inner);
      at(inner, foreGeo, wingMats[v], 0, 0.01, 0);
      at(inner, hindGeo, hindMats[v], 0, -0.004, 0);
      at(inner, spotGeo, spotMat, 0.21, 0.024, -0.07).scale.set(0.055, 0.25 * 0.055, 0.055);
      at(inner, spotGeo, dotMat, 0.21, 0.03, -0.07).scale.set(0.026, 0.25 * 0.026, 0.026);
      return g;
    });
    const arms = [-1, 1].map(sd => { const g = new THREE.Group(); g.position.set(sd * 0.15, -0.09, MO.FRONT - 0.12); at(g, nubGeo, m, 0, -0.03, 0); shell.add(g); return g; });
    const sc = 1.4 + rand() * 0.3; root.scale.setScalar(sc);
    const a = { species: 'moth', rand, root, body, shell, wings, ants, arms, eyes, smile, oMouth, sc, speed: 0.95 + rand() * 0.25, fidget: rand() * 6.28, heading: rand() * 6.28, controlled: false };
    return frame(a);
  }
  function poseMoth(a, P) {
    const t = P.t || 0, w = P.w || 0, idle = 1 - w, st = P.squash || 1, inv = 1 / Math.sqrt(st);
    const bob = Math.sin(t * 2.2 + a.fidget) * 0.035 + Math.sin(t * 9.5 + a.fidget) * 0.006;
    a.root.position.set(P.x, (P.y || 0) + (P.hop || 0), P.z); a.root.rotation.set(0, P.heading, 0);
    a.body.position.set(0, MO.HOVER + bob + (P.lift || 0), 0);
    a.body.scale.set(inv, st, inv);
    a.body.rotation.set(0.16 * w - 0.05 + (P.pitch || 0), 0, (P.bank || 0) + idle * Math.sin(t * 0.7 + a.fidget) * 0.05);
    const hz = P.flapHz || (w > 0.2 ? 8 : 3.2), amp = 0.25 + 0.3 * w + (P.cheer || 0) * 0.35;
    const flap = Math.sin(t * hz * 6.283 + a.fidget);
    a.wings.forEach((g, j) => { const sd = j ? 1 : -1; g.rotation.set(0, sd * (0.7 + 0.12 * w), sd * (0.72 + flap * amp), 'YZX'); });
    a.ants.forEach((g, j) => { const sd = j ? 1 : -1; g.rotation.set(0.5 + 0.25 * w + Math.sin(t * 2.6 + j * 1.9 + a.fidget) * 0.08, 0, -sd * 0.42); });
    const ch = P.cheer || 0, wv = P.wave || 0;
    a.arms.forEach((g, j) => { const sd = j ? 1 : -1; let z = sd * (0.3 + ch * 1.6); if (sd > 0 && wv > 0) z = 0.3 + wv * (2.1 + Math.sin(t * 13 + a.fidget) * 0.3); g.rotation.set(-0.3 * w, 0, z); });
    a.eyes.forEach(e => e.scale.y = P.blink ? 0.12 : 1);
    const air = (P.hop || 0) > 0.02; a.smile.visible = !air; a.oMouth.visible = air;
    const h = MO.HOVER + bob + (P.hop || 0) + (P.lift || 0);
    a.blob.position.set(P.x, 0.015 + (P.y || 0), P.z); a.blob.scale.setScalar(a.sc * 0.7 / (1 + h * 0.6));
  }

  // ================= loaf (the reference's hopper), as a pure pose for the trailer and the lab =================
  // P: x, z, heading, hop (m), squash, lift (1 standing .. .45 crouched), air (bool), tip (forward tip in the air), blink, t
  function poseLoaf(a, P) {
    const sc = a.sc, t = P.t || 0, sq = Math.max(0.6, P.squash || 1), y = (P.y || 0) + (P.hop || 0), LH = a.LH || 0.085;
    a.root.position.set(P.x, y, P.z); a.root.rotation.set(0, P.heading, 0);
    a.body.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq));
    a.body.position.y = LH * (P.lift ?? 1);
    a.body.rotation.set(P.tip || 0, 0, P.air ? 0 : Math.sin(t * 1.1 + (a.fidget || 0)) * 0.03);
    const hs = Math.sin(P.heading), hc = Math.cos(P.heading);
    a.legs.forEach(f => { f.pos.set(P.x + hc * f.sd * 0.12 * sc, 0, P.z - hs * f.sd * 0.12 * sc); f.lift = 0; f.t = 1; });
    a.legsPlaced = true;
    folk.poseLegs(a, a.legs, f => V(f.sd * 0.12, a.body.position.y + 0.05, 0),
      P.air ? (f => Math.max(0, y + (a.body.position.y - LH * 0.95 + Math.sin(t * 9 + f.sd) * 0.012) * sc)) : (() => (P.y || 0)));
    a.eyes.forEach(e => e.scale.y = P.blink ? 0.12 : 1);
    if (a.smile) a.smile.visible = !P.air; if (a.oMouth) a.oMouth.visible = !!P.air;
    a.blob.position.set(P.x, 0.015 + (P.y || 0), P.z); a.blob.scale.setScalar(sc * 0.85 * (1 - Math.min(0.5, (P.hop || 0) * 0.8)));
  }

  const pose = { twinkle: poseTwinkle, glim: poseGlim, moth: poseMoth, loaf: poseLoaf };
  const STEP = { twinkle: 0.2, glim: 0.16, moth: 0.3 };   // stride length (u, unscaled) per half-step

  // ================= the life of a townsfolk (the reference walkers' steering, then the pure pose) =================
  function walkers() { return [...folk.creatures, ...folk.hoppers, ...folk.drops, ...folk.scoots, ...folk.pips, ...twinkles, ...glims, ...moths]; }
  function step(d, dt, t, others) {
    const push = V(0, 0, 0); let moving = false;
    if (d.wait > 0) {
      d.wait -= dt;
      if (d.wait <= 0 && !d.controlled) nav.pickTarget(d);
      if (d.hop <= 0 && !d.controlled && d.rand() < dt * 0.05) d.hop = 0.42;
      d.lookSwap -= dt;
      if (d.lookSwap <= 0) { d.lookViewer = !d.lookViewer && d.rand() < 0.5; d.lookSwap = d.lookViewer ? 1.5 + d.rand() * 1.5 : 5 + d.rand() * 9; }
      const want = (d.lookViewer || flags.closeUp) ? Math.atan2(camera.position.x - d.pos.x, camera.position.z - d.pos.z) : Math.PI;
      d.heading += wrapA(want - d.heading) * Math.min(1, dt * 1.8);
    } else if (d.path.length) {
      const g = d.path[0], dx = g.x - d.pos.x, dz = g.z - d.pos.z, dd = Math.hypot(dx, dz);
      if (dd < 0.45) { d.path.shift(); if (!d.path.length) { d.wait = d.controlled ? 1e6 : 4 + d.rand() * 9; d.hop = 0.42; if (nav.onArrive) nav.onArrive(d); } }
      else { push.x += dx / dd * d.speed; push.z += dz / dd * d.speed; moving = true; }
    }
    for (const o of others) {
      if (o === d) continue;
      const dx = d.pos.x - o.pos.x, dz = d.pos.z - o.pos.z, dd = dx * dx + dz * dz;
      if (dd < 1.6 && dd > 1e-5) { const k = (1.26 - Math.sqrt(dd)) * 2.5; push.x += dx * k; push.z += dz * k; }
    }
    (nav.obstacles || []).forEach(o => { const dx = d.pos.x - o[0], dz = d.pos.z - o[1], dd = Math.hypot(dx, dz), r = o[2] + 0.5; if (dd < r && dd > 1e-4) { const k = (r - dd) * 6 / dd; push.x += dx * k; push.z += dz * k; } });
    if (nav.extraPush) nav.extraPush(d, push, d.species === 'moth' ? 'flit' : 'drop');
    if (moving) {
      const turn = wrapA(Math.atan2(push.x, push.z) - d.heading);
      d.heading += turn * Math.min(1, dt * 4);
      const spd = Math.min(Math.hypot(push.x, push.z), d.speed) * Math.max(0.2, Math.cos(turn));
      push.set(Math.sin(d.heading) * spd, 0, Math.cos(d.heading) * spd);
    } else { push.multiplyScalar(0.5); if (push.length() < 0.1) push.set(0, 0, 0); }
    d.vel.lerp(push, 1 - Math.pow(0.02, dt));
    d.pos.addScaledVector(d.vel, dt);
    if (nav.bounds) nav.bounds(d.pos);
    const sp = d.vel.length();
    d.w += (Math.min(1, sp / 0.45) - d.w) * Math.min(1, dt * 8);
    d.stride += sp * dt / (STEP[d.species] * d.sc) * Math.PI * 0.5;
    d.hop = Math.max(0, d.hop - dt);
    const hk = d.hop > 0 ? 1 - d.hop / 0.42 : 0, hopY = d.hop > 0 ? Math.sin(hk * Math.PI) * 0.22 * (d.species === 'moth' ? 0.6 : 1) : 0;
    const sq = d.hop > 0 ? (hk < 0.15 ? 0.86 : hk > 0.85 ? 0.9 : 1.07) : 1;
    d.nextBlink -= dt;
    if (d.nextBlink <= 0) { d.blink = 0.12; d.nextBlink = d.rand() < 0.2 ? 0.26 : 2 + d.rand() * 4; }
    d.blink = Math.max(0, d.blink - dt);
    pose[d.species](d, { x: d.pos.x, z: d.pos.z, heading: d.heading, stride: d.stride, w: d.w, hop: hopY, squash: sq, cheer: d.hop > 0 ? 1 : 0, blink: d.blink > 0, t });
  }
  function update(dt, t) {
    const others = walkers();
    for (const list of [twinkles, glims, moths]) for (const d of list) if (!d.driven) step(d, dt, t, others);
  }

  // ---- the seams: make, update, remove, the lists ----
  Object.assign(folk.make, { twinkle: makeTwinkle, glim: makeGlim, moth: makeMoth });
  folk.twinkles = twinkles; folk.glims = glims; folk.moths = moths;
  const baseUpdate = folk.update, baseRemove = folk.remove;
  folk.update = (dt, t) => { baseUpdate(dt, t); update(dt, t); };
  folk.remove = a => {
    if (a && lists[a.species] && lists[a.species].includes(a)) {
      const l = lists[a.species]; l.splice(l.indexOf(a), 1);
      for (const o of [a.root, a.blob]) { if (!o) continue; if (o.parent) o.parent.remove(o); let i = colourOnly.indexOf(o); if (i >= 0) colourOnly.splice(i, 1); i = folk.allLimbs.indexOf(o); if (i >= 0) folk.allLimbs.splice(i, 1); }
      return;
    }
    baseRemove(a);
  };
  const extra = folk.extra = { lists, twinkles, glims, moths, pose, update, all: () => [...twinkles, ...glims, ...moths], make: { twinkle: makeTwinkle, glim: makeGlim, moth: makeMoth } };
  return extra;
}

// ======================================================================================================
// The townsfolk's uniforms (identity.js calls this): every member of a species wears the SAME distinctive set, so a
// square of nine reads as one company; the trade shows as a small painted badge in its kit colour.
//   loaf    a cobalt bow tie under the smile + a leather satchel with a cobalt flap
//   twinkle a cobalt-and-cream striped nightcap with a cream pom-pom drooping off the top point + a cream satchel
//   glim    a red silk tassel swinging under the lantern + a red bow on its wire handle + a coral scarf under the cap
//   moth    brass flying goggles pushed up on the forehead + a coral scarf whose tail streams behind
// h = the identity helpers { put, group, mat, ring, G, PAL, KIT_COLOUR }; out.trade collects meshes (baked later),
// out.swing = groups that move on their own (identity.step sways them).
export const UNIFORM_WORDS = {
  loaf: 'a cobalt bow tie and a leather satchel',
  twinkle: 'a striped cobalt nightcap and a cream satchel',
  glim: 'a red silk tassel, a red bow on the handle and a coral scarf',
  moth: 'brass flying goggles and a streaming coral scarf'
};
export function dressTownsfolk(rec, L, out, h) {
  const { put, group, mat, ring, G, PAL, KIT_COLOUR, folk } = h;
  const a = rec.a, b = a.body, list = out.trade, sp = rec.species;
  out.swing = [];
  const badge = (parent, p, r) => {   // the trade, as a painted button
    if (L.kit === 'none') return;
    put(parent, G.disc, mat(KIT_COLOUR[L.kit]), p, [0.034, 0.012, 0.034], r, list);
    put(parent, G.disc, mat(PAL.cream), [p[0], p[1], p[2]], [0.014, 0.016, 0.014], r, list);
  };
  if (sp === 'loaf') {
    // loaf: w .25 h .23 d .22 (box from y 0 to .46, front z .22); the face at y ~.25, the smock hem at .165
    const front = 0.22 * 1.04, bt = mat(PAL.cobalt);   // a cobalt bow tie under the smile
    const bow = group(b, [0, 0.112, front + 0.016], [0, 0, 0], list);
    put(bow, G.ball, bt, [0, 0, 0], [0.02, 0.02, 0.018], [0, 0, 0], list);
    put(bow, new THREE.ConeGeometry(0.034, 0.06, 4), bt, [-0.032, 0, -0.004], [1, 1, 0.4], [0, 0, -Math.PI / 2], list);
    put(bow, new THREE.ConeGeometry(0.034, 0.06, 4), bt, [0.032, 0, -0.004], [1, 1, 0.4], [0, 0, Math.PI / 2], list);
    put(b, G.box, mat(PAL.leather), [0.27, 0.14, 0.02], [0.05, 0.13, 0.16], [0, 0, 0.06], list);
    put(b, G.box, mat(PAL.cobalt), [0.296, 0.18, 0.02], [0.012, 0.06, 0.165], [0, 0, 0.06], list);
    put(b, G.box, mat(PAL.leather), [0, 0.42, 0.0], [0.53, 0.02, 0.035], [0, 0, -0.52], list);   // the strap over the shoulder
    badge(b, [-0.13, 0.11, front + 0.012], [Math.PI / 2, 0, 0]);
  } else if (sp === 'twinkle') {
    // the top point rises from the core centre (y .31) to .68; the nightcap sits over it and flops sideways
    const cap = group(a.head, [0, 0.21, 0], [0, 0, 0], list);
    put(cap, ring(0.098, 0.3), mat(PAL.cream), [0, 0, 0], [1, 1, 0.75], [Math.PI / 2, 0, 0], list);
    const cone = new THREE.ConeGeometry(0.1, 0.32, 18, 8, true); cone.translate(0, 0.16, 0);
    { const p = cone.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setX(i, p.getX(i) + 2.4 * y * y); p.setY(i, y * (1 - 0.55 * y)); } cone.computeVertexNormals(); }
    const flop = group(cap, [0, 0.02, 0], [0, 0, -0.2], list); out.swing.push({ g: flop, base: [0, 0, -0.2], k: 0.1 });
    const m = folk.clayMat(...folk.tones(PAL.cobalt)); m.uniforms.uStripeCol.value = new THREE.Color(PAL.cream); m.uniforms.uStripeF.value = 95; m.uniforms.uStripeMode.value = 1;
    put(flop, cone, m, [0, 0, 0], [1, 1, 0.75], [0, 0, 0], list);
    put(flop, G.ball, mat(PAL.cream), [2.4 * 0.32 * 0.32, 0.32 * (1 - 0.55 * 0.32), 0], 0.045, [0, 0, 0], list);
    // the satchel on the left hip, the strap behind
    put(b, G.box, mat(PAL.cream), [-0.17, 0.16, 0.05], [0.1, 0.09, 0.06], [0, 0, 0.2], list);
    put(b, G.box, mat(PAL.cobalt), [-0.17, 0.195, 0.083], [0.105, 0.04, 0.012], [0.15, 0, 0.2], list);
    put(b, G.box, mat(PAL.leather), [0, 0.32, -0.12], [0.5, 0.022, 0.02], [0, 0, -0.75], list);
    badge(b, [0.1, 0.205, 0.105], [Math.PI / 2 - 0.4, 0.5, 0]);
  } else if (sp === 'glim') {
    const red = mat(PAL.red);
    const tas = group(b, [0, -0.05, 0], [0, 0, 0], list); out.swing.push({ g: tas, base: [0, 0, 0], k: 0.25, pend: true });
    put(tas, G.cyl, red, [0, -0.04, 0], [0.008, 0.08, 0.008], [0, 0, 0], list);
    put(tas, G.ball, red, [0, -0.085, 0], 0.022, [0, 0, 0], list);
    put(tas, new THREE.ConeGeometry(0.035, 0.09, 10), red, [0, -0.13, 0], 1, [0, 0, 0], list);
    const bow = group(b, [0, 0.635, 0], [0, 0, 0], list);
    put(bow, G.ball, red, [0, 0, 0], [0.025, 0.022, 0.02], [0, 0, 0], list);
    put(bow, G.ball, red, [-0.045, 0.004, 0], [0.04, 0.026, 0.014], [0, 0, 0.35], list);
    put(bow, G.ball, red, [0.045, 0.004, 0], [0.04, 0.026, 0.014], [0, 0, -0.35], list);
    put(b, ring(0.13, 0.2), mat(PAL.pink, PAL.cream, 18), [0, 0.47, 0], [1, 1, 1.25], [Math.PI / 2, 0, 0], list);   // a little scarf under the top cap
    const tail = group(b, [-0.09, 0.465, 0.07], [0.2, 0, 0.5], list); out.swing.push({ g: tail, base: [0.2, 0, 0.5], k: 0.15 });
    put(tail, G.box, mat(PAL.pink), [0, -0.06, 0], [0.045, 0.12, 0.016], [0, 0, 0], list);
    badge(b, [-0.12, 0.13, 0.19], [Math.PI / 2, -0.55, 0]);
  } else if (sp === 'moth') {
    const sh = a.shell, brass = mat(PAL.ochre), glassM = mat('#9cc4e8'), strap = mat(PAL.leather);   // sky-blue glass: no green next to the brass (§13)
    // goggles up on the forehead: a strap round the head, two brass rims with aqua glass
    put(sh, ring(0.168, 0.07), strap, [0, 0.035, 0.12], [1, 1, 0.75], [0.25, 0, 0], list);
    [-1, 1].forEach(sd => {
      const g = group(sh, [sd * 0.055, 0.13, 0.15], [-0.85, sd * 0.25, 0], list);
      put(g, G.lens, brass, [0, 0, 0], 1.25, [0, 0, 0], list); put(g, G.glass, glassM, [0, 0, 0], 1.2, [0, 0, 0], list);
    });
    // the scarf behind the ruff, and its tail streaming back
    const coral = mat(PAL.pink);
    put(sh, ring(0.17, 0.11), coral, [0, -0.01, 0.0], [1.02, 0.98, 0.8], [0, 0, 0], list);
    const tail = group(sh, [0.1, -0.06, -0.02], [0.3, 0, 0.2], list); out.swing.push({ g: tail, base: [0.3, 0, 0.2], k: 0.3, stream: true });
    put(tail, G.box, coral, [0, 0, -0.1], [0.06, 0.018, 0.2], [0, 0, 0], list);
    badge(sh, [-0.1, -0.1, 0.13], [Math.PI / 2 - 0.3, -0.6, 0]);
  }
}
