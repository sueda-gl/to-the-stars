// Marks: the sovereign's pencil on the map (ART_DIRECTION §5, ARCHITECTURE §10). Placement is never arbitrary.
//   click            -> a small hand-drawn pencil ✕ on the ground; "a house here" builds exactly on it
//   left-drag, loop  -> a pencil outline + faint graphite hatching: an AREA ("this is a field" fills exactly it)
//   left-drag, open  -> a slightly wobbly pencil LINE ("a road", "a wall", "a river" follow it)
//   Esc              -> clears the latest mark · right-click on a mark clears it
//
//   const marks = createMarks(ctx, world, { onChange, canvas, buildings: () => game.state.buildings });
//   marks.current() / list() / summarize() / consume(id) / remove(id) / clear() / setEnabled(bool) / handles(e)
//
// How the pencil is drawn: through the folk pass's soft-shadow channel. Marks live on FACE_LAYER (5) only, as
// screen-space ribbons with alpha < 0.45, depth-tested against the painted world. post.js composites those pixels
// AFTER the Kuwahara pass (mix(c, ink, a)), so the graphite stays crisp and grainy instead of being smeared into
// paint, it is redrawn every frame (marks draw live while the world is held at 24 fps), and it never masks the
// keylines. Widths are in screen px, so the pencil reads the same from the region view and from 15 m up.
// (The lab compares the other two routes, style 'keyline' and 'colour'; see docs/marks.md.)

const FACE_LAYER = 5;
const INK = '#25212b';            // graphite, a touch violet like the reference's line colour
const MAX_A = 0.44;               // the folk pass treats alpha >= 0.45 as a face/body: stay under it
const r2 = v => Math.round(v * 100) / 100, r1 = v => Math.round(v * 10) / 10;

// ======================= plane geometry helpers (exported for fill.js) =======================
export function polyArea(p) { let a = 0; for (let i = 0, n = p.length; i < n; i++) { const [x0, z0] = p[i], [x1, z1] = p[(i + 1) % n]; a += x0 * z1 - x1 * z0; } return a / 2; }
export function polyCentroid(p) {
  let a = 0, cx = 0, cz = 0;
  for (let i = 0, n = p.length; i < n; i++) { const [x0, z0] = p[i], [x1, z1] = p[(i + 1) % n], k = x0 * z1 - x1 * z0; a += k; cx += (x0 + x1) * k; cz += (z0 + z1) * k; }
  if (Math.abs(a) < 1e-6) { const s = p.reduce((o, q) => [o[0] + q[0], o[1] + q[1]], [0, 0]); return { x: s[0] / p.length, z: s[1] / p.length }; }
  return { x: cx / (3 * a), z: cz / (3 * a) };
}
export function bboxOf(p) {
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (const [x, z] of p) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
  return { x0: r2(x0), z0: r2(z0), x1: r2(x1), z1: r2(z1), w: r2(x1 - x0), d: r2(z1 - z0) };
}
export function pathLength(p, closed = false) { let l = 0; for (let i = 1; i < p.length; i++) l += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); if (closed && p.length > 2) l += Math.hypot(p[0][0] - p.at(-1)[0], p[0][1] - p.at(-1)[1]); return l; }
export function pointInPoly(x, z, p) {
  let inside = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const [xi, zi] = p[i], [xj, zj] = p[j];
    if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}
// even spacing along a polyline
export function resample(p, step, closed = false) {
  if (p.length < 2) return p.slice();
  const src = closed ? [...p, p[0]] : p, out = [src[0].slice()];
  let carry = 0;
  for (let i = 1; i < src.length; i++) {
    const [ax, az] = src[i - 1], [bx, bz] = src[i], L = Math.hypot(bx - ax, bz - az);
    let t = step - carry;
    while (t <= L) { out.push([ax + (bx - ax) * t / L, az + (bz - az) * t / L]); t += step; }
    carry = L - (t - step);
  }
  if (closed) { if (Math.hypot(out.at(-1)[0] - p[0][0], out.at(-1)[1] - p[0][1]) < step * 0.5) out.pop(); }
  else if (Math.hypot(out.at(-1)[0] - p.at(-1)[0], out.at(-1)[1] - p.at(-1)[1]) > step * 0.25) out.push(p.at(-1).slice());
  return out;
}
// Ramer–Douglas–Peucker
export function simplify(p, eps) {
  if (p.length < 3) return p.slice();
  const keep = new Uint8Array(p.length); keep[0] = keep[p.length - 1] = 1;
  const stack = [[0, p.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop(); let dm = 0, im = -1;
    const [ax, az] = p[a], [bx, bz] = p[b], L = Math.hypot(bx - ax, bz - az) || 1e-9;
    for (let i = a + 1; i < b; i++) { const d = Math.abs((bx - ax) * (az - p[i][1]) - (ax - p[i][0]) * (bz - az)) / L; if (d > dm) { dm = d; im = i; } }
    if (dm > eps) { keep[im] = 1; stack.push([a, im], [im, b]); }
  }
  return p.filter((_, i) => keep[i]);
}
// centripetal Catmull-Rom through p, sampled about every `step` metres
export function catmull(p, step, closed = false) {
  const n = p.length; if (n < 3) return resample(p, step, closed);
  const P = i => closed ? p[(i + n) % n] : p[Math.max(0, Math.min(n - 1, i))];
  const out = [], segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    const d = (a, b) => Math.pow(Math.max(1e-6, Math.hypot(b[0] - a[0], b[1] - a[1])), 0.5);
    const t0 = 0, t1 = t0 + d(p0, p1), t2 = t1 + d(p1, p2), t3 = t2 + d(p2, p3);
    const k = Math.max(1, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / step));
    for (let j = 0; j < k; j++) {
      const t = t1 + (t2 - t1) * j / k, L = (a, b, ta, tb) => [0, 1].map(c => (tb - t) / (tb - ta) * a[c] + (t - ta) / (tb - ta) * b[c]);
      const A1 = L(p0, p1, t0, t1), A2 = L(p1, p2, t1, t2), A3 = L(p2, p3, t2, t3), B1 = L(A1, A2, t0, t2), B2 = L(A2, A3, t1, t3);
      out.push(L(B1, B2, t1, t2));
    }
  }
  if (!closed) out.push(p[n - 1].slice());
  return out;
}
function segX(a, b, c, d) {   // proper intersection of ab and cd -> t along ab, or -1
  const rx = b[0] - a[0], rz = b[1] - a[1], sx = d[0] - c[0], sz = d[1] - c[1], den = rx * sz - rz * sx;
  if (Math.abs(den) < 1e-9) return -1;
  const t = ((c[0] - a[0]) * sz - (c[1] - a[1]) * sx) / den, u = ((c[0] - a[0]) * rz - (c[1] - a[1]) * rx) / den;
  return t > 0 && t < 1 && u > 0 && u < 1 ? t : -1;
}
// is the stroke an area (closed near its start, or looped over itself) or a line?
export function classifyStroke(raw, { closeGap = 3, minArea = 4 } = {}) {
  const pts = resample(raw, 0.4);
  const len = pathLength(pts);
  if (pts.length < 3 || len < 1.2) return { kind: 'point', x: raw[0][0], z: raw[0][1] };
  // a loop: the first place the stroke crosses itself (the enclosed part must be a real shape)
  for (let j = 2; j < pts.length - 1; j++) {
    for (let i = 0; i < j - 1; i++) {
      const t = segX(pts[i], pts[i + 1], pts[j], pts[j + 1]);
      if (t < 0) continue;
      const hit = [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * t, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t];
      const loop = [hit, ...pts.slice(i + 1, j + 1)];
      if (pathLength(loop, true) > 6 && Math.abs(polyArea(loop)) >= minArea) return { kind: 'area', ring: loop, raw: pts };
    }
  }
  const gap = Math.hypot(pts.at(-1)[0] - pts[0][0], pts.at(-1)[1] - pts[0][1]);
  if (len > 6 && gap < Math.max(closeGap, len * 0.08) && Math.abs(polyArea(pts)) >= minArea) return { kind: 'area', ring: pts, raw: pts };
  return { kind: 'line', pts, raw: pts };
}

// ======================= the pencil material =======================
const NOISE = `
  float mkH(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
  float mkN(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.0-2.0*f);
    return mix(mix(mkH(i),mkH(i+vec2(1.0,0.0)),u.x), mix(mkH(i+vec2(0.0,1.0)),mkH(i+vec2(1.0,1.0)),u.x), u.y); }`;
const PENCIL_VERT = NOISE + `
  attribute vec3 aDir; attribute float aSide; attribute vec4 aStroke; attribute vec3 aLook;
  uniform vec2 uPx; uniform float uWidth;
  varying float vAcross, vU, vLen, vSeed, vA, vT0, vT1;
  void main(){
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    mv.xyz *= 1.0 - min(0.3, 0.22 / max(0.5, length(mv.xyz)));        // pulled a hair toward the eye: never sinks into relief
    vec4 c = projectionMatrix * mv;
    vec4 d = projectionMatrix * (modelViewMatrix * vec4(position + aDir * 0.4, 1.0));
    vec2 t = (d.xy / d.w - c.xy / c.w) / uPx;                            // tangent in css px
    vec2 n = length(t) > 1e-5 ? normalize(vec2(-t.y, t.x)) : vec2(0.0, 1.0);
    float u = aStroke.x, len = aStroke.y, seed = aStroke.z;
    float taper = 0.45 + 0.55 * smoothstep(0.0, 0.7, u) * smoothstep(0.0, 0.9, len - u);
    float press = 0.7 + 0.55 * mkN(vec2(u * 0.45, seed * 7.0));
    float w = aStroke.w * uWidth * taper * press;
    c.xy += n * aSide * w * 0.5 * uPx * c.w;
    gl_Position = c;
    vAcross = aSide; vU = u; vLen = len; vSeed = seed; vA = aLook.x * (0.7 + 0.3 * taper); vT0 = aLook.y; vT1 = aLook.z;
  }`;
const PENCIL_FRAG = NOISE + `
  uniform vec3 uInk; uniform float uTime, uFade, uMaxA, uPxScale;
  varying float vAcross, vU, vLen, vSeed, vA, vT0, vT1;
  void main(){
    float shown = vT1 > vT0 ? clamp((uTime - vT0) / (vT1 - vT0), 0.0, 1.0) : step(vT0, uTime);
    if (vU > shown * vLen + 0.02) discard;
    vec2 f = gl_FragCoord.xy * uPxScale;
    float prof = 1.0 - smoothstep(0.4, 1.0, abs(vAcross));              // graphite thins toward the stroke's edge
    float tooth = mkN(f * 0.9 + vSeed * 31.0) * 0.6 + mkN(f * 0.37 + 7.0) * 0.4;      // the paper's tooth catches it
    float grain = 0.42 + 0.58 * smoothstep(0.22, 0.6, tooth * 0.8 + prof * 0.3);
    float streak = (0.8 + 0.2 * mkN(vec2(vU * 2.6, vAcross * 1.7 + vSeed))) * (0.72 + 0.4 * mkN(vec2(vU * 0.3, vSeed * 5.0)));   // lengthwise streaks, the hand's pressure
    float a = vA * 1.45 * prof * grain * streak;
    // consumed: rubbed out into the paint in grainy patches
    float er = mkN(f * 0.11 + vSeed * 3.0) * 0.6 + mkN(f * 0.7) * 0.4;
    a *= smoothstep(er - 0.12, er + 0.12, uFade * 1.25 - 0.12);
    a = min(a, uMaxA);
    if (a < 0.012) discard;
    gl_FragColor = vec4(uInk, a);
  }`;

// ======================= the module =======================
export function createMarks(ctx, world, opts = {}) {
  const {
    onChange = null, canvas = ctx.renderer.domElement, claimLeft = true, ignore = null, keys = true,
    buildings = null, style = 'overlay', max = 12, ink = INK, width = 3.0,
    groundY = (x, z) => (world && world.groundY ? world.groundY(x, z) : 0),
    pick = (cx, cy) => (world && world.pick ? world.pick(cx, cy) : null)
  } = opts;
  const { scene, camera } = ctx;
  const root = new THREE.Group(); root.name = 'marks'; scene.add(root);
  const marks = [];
  let enabled = true, seq = 0, draft = null, stroke = null, rdown = null, clock = 0, last = performance.now();
  const rnd = ctx.mulberry32(4711);             // the hand's own jitter stream (never ctx.rnd)
  const J = (a, b) => a + (b - a) * rnd();
  const emit = (type, mark) => { if (onChange) try { onChange({ type, mark: mark ? publicOf(mark) : null, current: api.current() }); } catch (e) { console.warn('marks: onChange', e); } };

  // ---------- stroke -> ribbon geometry ----------
  // strokes: [{ pts:[[x,z]...], w (px multiplier), a (alpha), t0, t1 (draw-in window, s), seed }]
  function ribbon(strokes) {
    const pos = [], dir = [], side = [], st = [], look = [], idx = [];
    for (const s of strokes) {
      const p = s.pts; if (p.length < 2) continue;
      const ys = p.map(([x, z]) => groundY(x, z) + 0.05);
      let u = 0; const us = [0];
      for (let i = 1; i < p.length; i++) { u += Math.hypot(p[i][0] - p[i - 1][0], ys[i] - ys[i - 1], p[i][1] - p[i - 1][1]); us.push(u); }
      const len = u, base = pos.length / 3;
      for (let i = 0; i < p.length; i++) {
        const a = p[Math.max(0, i - 1)], b = p[Math.min(p.length - 1, i + 1)];
        const ya = ys[Math.max(0, i - 1)], yb = ys[Math.min(p.length - 1, i + 1)];
        let dx = b[0] - a[0], dy = yb - ya, dz = b[1] - a[1]; const dl = Math.hypot(dx, dy, dz) || 1; dx /= dl; dy /= dl; dz /= dl;
        for (const sg of [-1, 1]) { pos.push(p[i][0], ys[i], p[i][1]); dir.push(dx, dy, dz); side.push(sg); st.push(us[i], len, s.seed, s.w); look.push(s.a, s.t0, s.t1); }
      }
      for (let i = 0; i < p.length - 1; i++) { const k = base + i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('aDir', new THREE.Float32BufferAttribute(dir, 3));
    g.setAttribute('aSide', new THREE.Float32BufferAttribute(side, 1));
    g.setAttribute('aStroke', new THREE.Float32BufferAttribute(st, 4));
    g.setAttribute('aLook', new THREE.Float32BufferAttribute(look, 3));
    g.setIndex(idx); g.computeBoundingSphere();
    return g;
  }
  const baseMat = new THREE.ShaderMaterial({
    uniforms: { uPx: { value: new THREE.Vector2(0.001, 0.001) }, uWidth: { value: width }, uInk: { value: new THREE.Color(ink) }, uTime: { value: 1e4 }, uFade: { value: 1 }, uMaxA: { value: MAX_A }, uPxScale: { value: 1 } },
    vertexShader: PENCIL_VERT, fragmentShader: PENCIL_FRAG,
    transparent: true, depthWrite: false, depthTest: true, side: THREE.DoubleSide,
    blending: THREE.CustomBlending, blendEquation: THREE.MaxEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor
  });
  function pencilMesh(strokes) {
    const mat = baseMat.clone(); mat.uniforms.uPx = baseMat.uniforms.uPx; mat.uniforms.uPxScale = baseMat.uniforms.uPxScale; mat.uniforms.uWidth = baseMat.uniforms.uWidth;
    const m = new THREE.Mesh(ribbon(strokes), mat);
    m.frustumCulled = false; m.renderOrder = -2; m.layers.set(FACE_LAYER); m.name = 'pencil';
    return m;
  }
  // the two routes the lab compares against (docs/marks.md): keyline tents in the line world, or graphite in the paint
  function altMesh(strokes) {
    const g = new THREE.Group();
    const pos = [], idx = [];
    for (const s of strokes) {
      if (s.a < 0.3) continue;   // no hatching in these routes
      const p = s.pts, W = style === 'keyline' ? 0.1 : 0.16 * s.w, H = style === 'keyline' ? 0.22 : 0.02;
      for (let i = 0; i < p.length - 1; i++) {
        const [ax, az] = p[i], [bx, bz] = p[i + 1], l = Math.hypot(bx - ax, bz - az) || 1, px = -(bz - az) / l, pz = (bx - ax) / l;
        const ya = groundY(ax, az) + 0.03, yb = groundY(bx, bz) + 0.03, b = pos.length / 3;
        if (style === 'keyline') {
          pos.push(ax + px * W, ya - 0.02, az + pz * W, ax, ya + H, az, bx + px * W, yb - 0.02, bz + pz * W, bx, yb + H, bz,
            ax - px * W, ya - 0.02, az - pz * W, bx - px * W, yb - 0.02, bz - pz * W);
          idx.push(b, b + 1, b + 2, b + 2, b + 1, b + 3, b + 4, b + 5, b + 1, b + 1, b + 5, b + 3);
        } else {
          pos.push(ax + px * W, ya + H, az + pz * W, ax - px * W, ya + H, az - pz * W, bx + px * W, yb + H, bz + pz * W, bx - px * W, yb + H, bz - pz * W);
          idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
        }
      }
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: new THREE.Color(ink), side: THREE.DoubleSide }));
    m.frustumCulled = false;
    if (style === 'keyline') { m.visible = false; ctx.lineOnly.push(m); } else ctx.colourOnly.push(m);
    g.add(m); g.userData.alt = m;
    return g;
  }
  const build = strokes => (style === 'overlay' ? pencilMesh(strokes) : altMesh(strokes));
  function dropMesh(obj) {
    if (!obj) return;
    root.remove(obj);
    obj.traverse(o => {
      if (!o.isMesh) return;
      for (const L of [ctx.lineOnly, ctx.colourOnly]) { const i = L.indexOf(o); if (i >= 0) L.splice(i, 1); }
      o.geometry.dispose(); if (o.material !== baseMat) o.material.dispose();
    });
  }

  // ---------- the hand: wobble, overshoot, a second pass, hatching ----------
  function wobble(p, amp, seed, closed = false) {   // low-frequency hand tremor, perpendicular to the stroke
    const n = p.length;
    return p.map((q, i) => {
      const a = p[closed ? (i - 1 + n) % n : Math.max(0, i - 1)], b = p[closed ? (i + 1) % n : Math.min(n - 1, i + 1)];
      const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1;
      const s = i / Math.max(1, n - 1) * Math.PI * 2;
      const o = amp * (Math.sin(s * 3 + seed) * 0.6 + Math.sin(s * 7.3 + seed * 2.1) * 0.3 + Math.sin(i * 0.9 + seed) * 0.1);
      return [q[0] - dz / l * o, q[1] + dx / l * o];
    });
  }
  function hatch(poly, seed) {
    const A = Math.abs(polyArea(poly)), sp = Math.max(0.8, Math.min(2.4, Math.sqrt(A) / 14));
    const ang = 0.78 + J(-0.12, 0.12), ca = Math.cos(ang), sa = Math.sin(ang);
    const rot = poly.map(([x, z]) => [x * ca + z * sa, -x * sa + z * ca]);   // hatch lines run along +u
    let v0 = Infinity, v1 = -Infinity; rot.forEach(q => { v0 = Math.min(v0, q[1]); v1 = Math.max(v1, q[1]); });
    const out = []; let k = 0;
    for (let v = v0 + sp * J(0.4, 0.9); v < v1; v += sp * J(0.85, 1.15), k++) {
      const xs = [];
      for (let i = 0, n = rot.length; i < n; i++) {
        const [ua, va] = rot[i], [ub, vb] = rot[(i + 1) % n];
        if ((va > v) !== (vb > v)) xs.push(ua + (ub - ua) * (v - va) / (vb - va));
      }
      xs.sort((a, b) => a - b);
      for (let i = 0; i + 1 < xs.length; i += 2) {
        const ua = xs[i] + J(0.25, 0.7), ub = xs[i + 1] - J(0.25, 0.7); if (ub - ua < 0.6) continue;
        const dv = J(-0.12, 0.12), seg = [];
        for (let u = ua; u <= ub + 1e-6; u += Math.min(0.6, Math.max(0.3, (ub - ua) / 12))) { const vv = v + dv * (u - ua) / (ub - ua + 1e-6); seg.push([u * ca - vv * sa, u * sa + vv * ca]); }
        if (seg.length >= 2) out.push(seg);
      }
    }
    return out;
  }
  // a hand-drawn ✕, crossing exactly at (x, z); upright for the current camera
  function crossStrokes(x, z) {
    const d = camera.position.distanceTo(new THREE.Vector3(x, groundY(x, z), z));
    const L = Math.max(1.3, Math.min(7, d * 0.058));
    const yaw = Math.atan2(camera.position.x - x, camera.position.z - z);   // the screen's "down" on the ground
    const fx = Math.cos(yaw), fz = -Math.sin(yaw), dx = Math.sin(yaw), dz = Math.cos(yaw);   // screen right / down on the ground
    const one = (ang, seed, t0) => {
      const ux = fx * Math.cos(ang) + dx * Math.sin(ang), uz = fz * Math.cos(ang) + dz * Math.sin(ang);
      const a = L * J(0.42, 0.56), b = L * J(0.42, 0.56), bow = L * J(-0.06, 0.06), pts = [];
      for (let i = 0; i <= 10; i++) {
        const t = -a + (a + b) * i / 10, s = Math.sin(Math.PI * i / 10) * bow;
        pts.push([x + ux * t - uz * s, z + uz * t + ux * s]);
      }
      return { pts, w: 1.55, a: 0.55, t0, t1: t0 + 0.14, seed };
    };
    return [one(Math.PI / 4 + J(-0.12, 0.1), J(0, 9), 0), one(-Math.PI / 4 + J(-0.1, 0.12), J(0, 9), 0.2)];
  }
  function areaStrokes(ring, live = false) {
    const seed = J(0, 9);
    const loop = wobble(ring, 0.07, seed, true);
    // the outline: one stroke round, overshooting its start a little where the hand closes it
    const n = loop.length, over = Math.max(2, Math.round(n * 0.05));
    const out = [...loop, ...loop.slice(0, over).map((q, i) => [q[0] + (i + 1) * 0.02, q[1] - (i + 1) * 0.03])];
    const strokes = [{ pts: out, w: 1, a: 0.42, t0: 0, t1: live ? 0 : 0.001, seed }];
    // a lighter second pass over part of it, as a hand retraces a shape
    const s0 = Math.floor(J(0, n)), m = Math.floor(n * J(0.35, 0.6)), retrace = [];
    const loop2 = wobble(ring, 0.12, seed + 3.3, true);
    for (let i = 0; i < m; i++) retrace.push(loop2[(s0 + i) % n]);
    if (retrace.length > 3) strokes.push({ pts: retrace, w: 0.7, a: 0.3, t0: live ? 0 : 0.05, t1: live ? 0 : 0.35, seed: seed + 1 });
    if (!live) hatch(ring, seed).forEach((h, i) => strokes.unshift({ pts: h, w: 0.62, a: 0.2, t0: 0.15 + i * 0.035, t1: 0.27 + i * 0.035, seed: seed + 2 + i * 0.37 }));
    return strokes;
  }
  function lineStrokes(pts, live = false) {
    const seed = J(0, 9);
    return [{ pts: wobble(pts, live ? 0.03 : 0.06, seed), w: 1, a: 0.42, t0: 0, t1: 0, seed }];
  }

  // ---------- marks ----------
  function makeMark(spec) {
    const id = 'mk' + (++seq);
    let mark;
    if (spec.kind === 'point') {
      mark = { id, kind: 'point', x: r2(spec.x), z: r2(spec.z) };
      mark.strokes = crossStrokes(spec.x, spec.z);
    } else if (spec.kind === 'area') {
      let ring = spec.poly.map(q => [q[0], q[1]]);
      if (polyArea(ring) < 0) ring.reverse();
      const c = polyCentroid(ring);
      mark = { id, kind: 'area', poly: ring.map(q => [r2(q[0]), r2(q[1])]), centroid: { x: r2(c.x), z: r2(c.z) }, bbox: bboxOf(ring), areaM2: r1(Math.abs(polyArea(ring))) };
      mark.strokes = areaStrokes(ring);
    } else {
      const pts = spec.pts.map(q => [q[0], q[1]]);
      const c = midAlong(pts);
      mark = { id, kind: 'line', pts: pts.map(q => [r2(q[0]), r2(q[1])]), length: r1(pathLength(pts)), centroid: { x: r2(c[0]), z: r2(c[1]) }, bbox: bboxOf(pts) };
      mark.strokes = lineStrokes(pts);
    }
    mark.born = clock; mark.fade = null; mark.mesh = build(mark.strokes); root.add(mark.mesh);
    return mark;
  }
  function midAlong(p) {
    const L = pathLength(p) / 2; let acc = 0;
    for (let i = 1; i < p.length; i++) { const l = Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); if (acc + l >= L) { const t = (L - acc) / (l || 1); return [p[i - 1][0] + (p[i][0] - p[i - 1][0]) * t, p[i - 1][1] + (p[i][1] - p[i - 1][1]) * t]; } acc += l; }
    return p.at(-1);
  }
  function publicOf(m) {
    if (!m) return null;
    if (m.kind === 'point') return { id: m.id, kind: 'point', x: m.x, z: m.z };
    if (m.kind === 'area') return { id: m.id, kind: 'area', poly: m.poly, centroid: m.centroid, bbox: m.bbox, areaM2: m.areaM2 };
    return { id: m.id, kind: 'line', pts: m.pts, length: m.length, centroid: m.centroid, bbox: m.bbox };
  }
  // shape a raw stroke (world points) into a mark spec
  function shape(raw) {
    const c = classifyStroke(raw);
    if (c.kind === 'point') return { kind: 'point', x: raw[0][0], z: raw[0][1] };
    if (c.kind === 'area') {
      const ring = catmull(simplify(c.ring, 0.22), 0.6, true);
      return { kind: 'area', poly: ring };
    }
    const pts = catmull(simplify(c.pts, 0.22), 0.6, false);
    return { kind: 'line', pts };
  }
  function add(spec) {
    if (!spec) return null;
    if (spec.kind === 'area' && (!spec.poly || spec.poly.length < 3)) return null;
    if (spec.kind === 'line' && (!spec.pts || spec.pts.length < 2)) return null;
    const m = makeMark(spec); marks.push(m);
    while (marks.filter(k => !k.fade).length > max) remove(marks.find(k => !k.fade).id, true);
    emit('add', m);
    return publicOf(m);
  }
  function remove(id, quiet = false) {
    const i = marks.findIndex(m => m.id === id); if (i < 0) return false;
    const [m] = marks.splice(i, 1); dropMesh(m.mesh);
    if (!quiet) emit('remove', m);
    return true;
  }
  function consume(id, seconds = 1.5) {
    const m = marks.find(k => k.id === id && !k.fade); if (!m) return null;
    m.fade = { t0: clock, dur: Math.max(0.05, seconds) };
    if (!m.mesh.material) setTimeout(() => remove(m.id, true), seconds * 1000);   // the alt routes just vanish
    emit('consume', m);
    return publicOf(m);
  }
  function clear() { [...marks].forEach(m => remove(m.id, true)); setDraft(null); emit('clear', null); }

  // ---------- live drawing ----------
  function setDraft(raw) {
    if (draft) { dropMesh(draft); draft = null; }
    if (!raw || raw.length < 2) return;
    let p = resample(raw, 0.35);
    if (p.length >= 4) p = catmull(simplify(p, 0.08), 0.35, false);
    draft = build([{ pts: p, w: 1, a: 0.42, t0: 0, t1: 0, seed: 1.7 }]);
    root.add(draft);
  }

  // ---------- input ----------
  const isTyping = e => { const t = e.target; return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable); };
  function handles(e) {
    if (!enabled || e.button !== 0 || e.altKey) return false;
    if (ignore && ignore(e)) return false;
    return !!pick(e.clientX, e.clientY);
  }
  function onDown(e) {
    if (e.button === 2) { rdown = { x: e.clientX, y: e.clientY }; return; }
    if (!handles(e)) return;
    const p = pick(e.clientX, e.clientY); if (!p) return;
    if (claimLeft) { e.stopImmediatePropagation(); e.preventDefault(); }
    stroke = { id: e.pointerId, sx: e.clientX, sy: e.clientY, travel: 0, lx: e.clientX, ly: e.clientY, pts: [[p.x, p.z]], first: p };
    try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
  }
  function onMove(e) {
    if (!stroke || e.pointerId !== stroke.id) return;
    const dd = Math.hypot(e.clientX - stroke.lx, e.clientY - stroke.ly);
    if (dd < 2.5) return;
    stroke.travel += dd; stroke.lx = e.clientX; stroke.ly = e.clientY;
    if (claimLeft) e.stopImmediatePropagation();
    const p = pick(e.clientX, e.clientY); if (!p) return;
    stroke.pts.push([p.x, p.z]);
    if (stroke.travel > 6) { setDraft(stroke.pts); emit('draft', null); }
  }
  function onUp(e) {
    if (e.button === 2 && rdown) {
      const moved = Math.hypot(e.clientX - rdown.x, e.clientY - rdown.y); rdown = null;
      if (moved < 5) { const m = hitTest(e.clientX, e.clientY); if (m) remove(m.id); }
      return;
    }
    if (!stroke || e.pointerId !== stroke.id) return;
    const s = stroke; stroke = null; setDraft(null);
    try { canvas.releasePointerCapture(s.id); } catch (_) {}
    if (claimLeft) e.stopImmediatePropagation();
    if (s.travel < 7 || s.pts.length < 3) add({ kind: 'point', x: s.first.x, z: s.first.z });
    else add(shape(s.pts));
  }
  function onKey(e) {
    if (!enabled || e.key !== 'Escape' || isTyping(e) || e.defaultPrevented) return;
    if (stroke) { stroke = null; setDraft(null); return; }
    const live = marks.filter(m => !m.fade); if (live.length) remove(live.at(-1).id);
  }
  canvas.addEventListener('pointerdown', onDown, { capture: true });
  addEventListener('pointermove', onMove, { capture: true });
  addEventListener('pointerup', onUp, { capture: true });
  const onCancel = () => { stroke = null; setDraft(null); };
  addEventListener('pointercancel', onCancel, { capture: true });
  if (keys) addEventListener('keydown', onKey);

  // screen-space hit test: the ✕, an outline/line within ~12 px, or inside an area
  const _v = new THREE.Vector3();
  function toScreen(x, z) { _v.set(x, groundY(x, z), z).project(camera); const r = canvas.getBoundingClientRect(); return [r.left + (_v.x + 1) / 2 * r.width, r.top + (1 - _v.y) / 2 * r.height, _v.z]; }
  function hitTest(cx, cy) {
    let best = null, bd = 14;
    const segD = (p, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1))); return Math.hypot(p[0] - a[0] - dx * t, p[1] - a[1] - dy * t); };
    for (const m of marks) {
      if (m.fade) continue;
      let d = Infinity;
      if (m.kind === 'point') { const s = toScreen(m.x, m.z); d = Math.hypot(s[0] - cx, s[1] - cy) - 6; }
      else {
        const pts = (m.kind === 'area' ? [...m.poly, m.poly[0]] : m.pts).map(q => toScreen(q[0], q[1]));
        for (let i = 1; i < pts.length; i++) d = Math.min(d, segD([cx, cy], pts[i - 1], pts[i]));
        if (m.kind === 'area') { const g = pick(cx, cy); if (g && pointInPoly(g.x, g.z, m.poly)) d = Math.min(d, 8); }
      }
      if (d < bd) { bd = d; best = m; }
    }
    return best;
  }

  // ---------- per frame ----------
  let raf = 0;
  function loop() { update(); raf = requestAnimationFrame(loop); }
  function update() {
    const now = performance.now(), dt = Math.min(0.1, (now - last) / 1000); last = now; clock += dt;
    const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight;
    baseMat.uniforms.uPx.value.set(2 / w, 2 / h);
    const dpr = ctx.renderer.getPixelRatio(), W = w * dpr, H = h * dpr;
    baseMat.uniforms.uPxScale.value = 1 / (Math.min(1, 1500 / Math.max(W, H)) * dpr);   // paint-target px -> css px: the grain keeps its size
    for (const m of [...marks]) {
      const mat = m.mesh.material;
      if (mat && mat.uniforms) {
        mat.uniforms.uTime.value = clock - m.born;
        if (m.fade) {
          const k = (clock - m.fade.t0) / m.fade.dur;
          mat.uniforms.uFade.value = Math.max(0, 1 - k);
          if (k >= 1) remove(m.id, true);
        }
      }
    }
  }
  if (opts.autoUpdate !== false) raf = requestAnimationFrame(loop);

  // ---------- the LLM's view ----------
  function nearestName(x, z) {
    const list = typeof buildings === 'function' ? buildings() : buildings;
    if (!Array.isArray(list) || !list.length) return null;
    let best = null, bd = Infinity;
    for (const b of list) { if (!b || b.status === 'removed' || !Number.isFinite(b.x)) continue; const d = Math.hypot(b.x - x, b.z - z); if (d < bd) { bd = d; best = b; } }
    if (!best) return null;
    const dx = x - best.x, dz = z - best.z, dir = bd < 2 ? '' : ' ' + (Math.abs(dz) > Math.abs(dx) * 0.5 ? (dz < 0 ? 'N' : 'S') : '') + (Math.abs(dx) > Math.abs(dz) * 0.5 ? (dx > 0 ? 'E' : 'W') : '') + ' of it';
    return { name: best.name || best.kind, id: best.id, dist: r1(bd), where: Math.round(bd) + ' m' + dir };
  }
  function summarize(m = null) {
    m = m ? (typeof m === 'string' ? marks.find(k => k.id === m) : marks.find(k => k.id === m.id)) : marks.filter(k => !k.fade).at(-1);
    if (!m) return null;
    const c = m.kind === 'point' ? { x: r1(m.x), z: r1(m.z) } : { x: r1(m.centroid.x), z: r1(m.centroid.z) };
    const out = { id: m.id, kind: m.kind, centroid: c };
    if (m.kind !== 'point') out.bbox = { x0: r1(m.bbox.x0), z0: r1(m.bbox.z0), x1: r1(m.bbox.x1), z1: r1(m.bbox.z1), w: r1(m.bbox.w), d: r1(m.bbox.d) };
    if (m.kind === 'area') out.areaM2 = Math.round(m.areaM2);
    if (m.kind === 'line') { out.length = r1(m.length); out.from = { x: r1(m.pts[0][0]), z: r1(m.pts[0][1]) }; out.to = { x: r1(m.pts.at(-1)[0]), z: r1(m.pts.at(-1)[1]) }; }
    const n = nearestName(c.x, c.z); if (n) out.near = n;
    return out;
  }

  const api = {
    root,
    current: () => publicOf(marks.filter(m => !m.fade).at(-1) || null),
    list: () => marks.filter(m => !m.fade).map(publicOf),
    get: id => publicOf(marks.find(m => m.id === id)),
    add, remove: id => remove(id), consume, clear, summarize, handles, hitTest, shape,
    setEnabled(v) { enabled = !!v; if (!enabled) { stroke = null; setDraft(null); } root.visible = enabled || marks.length > 0; },
    get enabled() { return enabled; }, get drawing() { return !!stroke; },
    update, style,
    dispose() {
      cancelAnimationFrame(raf); clear(); scene.remove(root);
      canvas.removeEventListener('pointerdown', onDown, { capture: true });
      removeEventListener('pointermove', onMove, { capture: true }); removeEventListener('pointerup', onUp, { capture: true }); removeEventListener('pointercancel', onCancel, { capture: true });
      if (keys) removeEventListener('keydown', onKey);
    }
  };
  return api;
}
