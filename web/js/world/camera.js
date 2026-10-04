// The map camera: the leader's bird's-eye (ART_DIRECTION §1). One pose = { tx, ty, tz (what we look at), yaw,
// pitch, dist, fov }: the eye sits dist away from the target, yaw round +y (0 = looking north / -z, toward the
// sea), pitch above the ground plane. Input moves a damped goal pose; scripted moves (descent, focus, up close,
// visits) tween the pose with eased curves. place() puts the camera; call it from painter.frame's beforeDraw,
// like the reference rig, so the camera moves on the painted frames.
//
// Views (VIEWS): 'leader' (the default: high oblique, ~57 degrees down, the whole plot with the coast, hills and
// the bay round it), 'eye' (the old low 3/4 view with the horizon, the sun, the moon and the nations: for up
// close / meetings / cinematic shots), 'top' (nearly straight down over the region, like a relief map).
//
// Input (left is reserved for marks by default; the game decides with rig.setInput):
//   right or middle drag: pan along the ground · Alt/Shift + right/middle drag (or input.rotateButton): turn + tilt
//   wheel / pinch: zoom (the pitch eases with the zoom: closer = a little lower, so the folk read) ·
//   Q / E: turn · R / F: tilt · WASD / arrows: pan · + / -: zoom · optional gentle edge-scroll

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const EASE = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;         // in-out cubic
const SMOOTHER = t => t * t * t * (t * (t * 6 - 15) + 10);
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const wrapA = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };

export const VIEWS = {
  leader: { tx: 0, ty: 0.6, tz: -12, yaw: 0.1, pitch: 1.0, dist: 168, fov: 40 },
  eye: { tx: -6, ty: 0, tz: -18, yaw: 0.36, pitch: 0.205, dist: 66, fov: 46 },
  top: { tx: 2, ty: 0, tz: -18, yaw: 0.06, pitch: 1.45, dist: 330, fov: 40 }
};
export const DEFAULT_VIEW = VIEWS.leader;
// zoom range (map mode) and the pitch the zoom eases toward (dist -> pitch)
export const ZOOM = { min: 12, max: 250 };
export const pitchForDist = d => 0.66 + 0.34 * smooth(12, 165, d) + 0.1 * smooth(165, 250, d);

export function eyeOf(p, out = new THREE.Vector3()) {
  const cp = Math.cos(p.pitch);
  return out.set(p.tx + Math.sin(p.yaw) * cp * p.dist, p.ty + Math.sin(p.pitch) * p.dist, p.tz + Math.cos(p.yaw) * cp * p.dist);
}
export function poseFromEyeLook(eye, look, fov = 46) {
  const dx = eye.x - look.x, dy = eye.y - look.y, dz = eye.z - look.z, dist = Math.hypot(dx, dy, dz);
  return { tx: look.x, ty: look.y, tz: look.z, yaw: Math.atan2(dx, dz), pitch: Math.asin(clamp(dy / dist, -1, 1)), dist, fov };
}

export const INPUT_DEFAULTS = {
  pan: [2, 1],              // mouse buttons that pan (2 right, 1 middle, 0 left)
  rotateMod: ['alt', 'shift'], // modifiers that turn a pan-drag into turn + tilt ('alt' | 'shift' | 'ctrl' | 'meta', one or a list)
  rotateButton: null,       // a button that always turns + tilts (e.g. 1 for middle), or null
  left: 'none',             // what a left drag does in map mode: 'none' (marks own it) | 'pan' | 'rotate'
  closeOrbit: [0, 2, 1],    // buttons that orbit in up-close mode (the reference feel)
  wheel: true, keys: true, edgeScroll: false, edgePx: 14, edgeSpeed: 0.55,
  zoomTilt: true            // the pitch eases toward pitchForDist as you zoom
};

export function createCameraRig(ctx, { ground, geo, dom = ctx.renderer.domElement, view = DEFAULT_VIEW, keys = true, blockers = [], input = {} } = {}) {
  // blockers: [x, z, radius, topY] (tall trees) that a long look at the horizon should clear
  const { camera } = ctx;
  const IN = { ...INPUT_DEFAULTS, ...(keys === false ? { keys: false } : {}), ...input };
  const home = { ...view };
  const cur = { ...home }, goal = { ...home };
  let tween = null, mode = 'map', saved = null, enabled = true, lastDrag = false;
  const held = new Set();
  const C = geo.GEO.C;
  const LIM = { dist: [ZOOM.min, ZOOM.max], pitch: [0.3, 1.52], r: 150, closeDist: [2.6, 18] };
  const gy = (x, z) => (ground ? ground.groundY(x, z) : 0);
  const clampTarget = p => {
    const dx = p.tx - C.x, dz = p.tz - C.z, l = Math.hypot(dx, dz);
    if (l > LIM.r) { p.tx = C.x + dx / l * LIM.r; p.tz = C.z + dz / l * LIM.r; }
  };

  // ---------- input ----------
  let drag = null, pointer = null;
  const modDown = e => [].concat(IN.rotateMod || []).some(m => e[m + 'Key']);
  const actionFor = e => {
    if (mode === 'close') return IN.closeOrbit.includes(e.button) ? 'rotate' : null;
    if (IN.rotateButton != null && e.button === IN.rotateButton) return 'rotate';
    if (e.button === 0 && !IN.pan.includes(0)) {
      if (IN.left === 'pan') return modDown(e) ? 'rotate' : 'pan';
      if (IN.left === 'rotate') return 'rotate';
      return null;
    }
    if (IN.pan.includes(e.button)) return modDown(e) ? 'rotate' : 'pan';
    return null;
  };
  dom.addEventListener('contextmenu', e => e.preventDefault());
  dom.addEventListener('pointerdown', e => {
    if (!enabled) return;
    const act = actionFor(e);
    lastDrag = false;
    if (!act) return;
    if (e.button === 1) e.preventDefault();
    drag = { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, button: e.button, act, moved: false, id: e.pointerId };
  });
  addEventListener('pointermove', e => {
    pointer = { x: e.clientX, y: e.clientY, t: performance.now() };
    if (!drag || !enabled) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.moved && Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < 5) return;
    if (!drag.moved) { drag.moved = true; try { dom.setPointerCapture(drag.id); } catch (_) {} dom.style.cursor = drag.act === 'pan' ? 'grabbing' : 'move'; }
    drag.x = e.clientX; drag.y = e.clientY;
    if (tween && tween.interruptible) endTween(false);
    if (tween) return;
    const rotate = drag.act === 'rotate' || modDown(e);
    if (rotate) {
      goal.yaw += -dx * 0.0055;
      goal.pitch = clamp(goal.pitch + dy * 0.0035, mode === 'close' ? 0.03 : LIM.pitch[0], mode === 'close' ? 0.9 : LIM.pitch[1]);
    } else panBy(dx, dy);
  });
  addEventListener('pointerup', () => { if (drag) { lastDrag = drag.moved; dom.style.cursor = ''; } drag = null; });
  addEventListener('pointerleave', () => { pointer = null; });
  dom.addEventListener('mouseleave', () => { pointer = null; });
  // pan by screen pixels: the ground point under the cursor stays under it (approximately, at the target)
  function panBy(dx, dy) {
    const upp = 2 * goal.dist * Math.tan(THREE.MathUtils.degToRad(cur.fov) / 2) / Math.max(1, dom.clientHeight);
    const fwd = upp / Math.max(0.25, Math.sin(goal.pitch));
    const s = Math.sin(goal.yaw), c = Math.cos(goal.yaw);
    goal.tx += -dx * upp * c - dy * fwd * s;
    goal.tz += dx * upp * s - dy * fwd * c;
    if (mode === 'map') clampTarget(goal);
  }
  function zoomBy(f) {
    const lim = mode === 'close' ? LIM.closeDist : LIM.dist;
    const d0 = goal.dist, d1 = clamp(goal.dist * f, lim[0], lim[1]);
    goal.dist = d1;
    if (IN.zoomTilt && mode === 'map') goal.pitch = clamp(goal.pitch + pitchForDist(d1) - pitchForDist(d0), LIM.pitch[0], LIM.pitch[1]);
  }
  dom.addEventListener('wheel', e => {
    if (!enabled || !IN.wheel) return;
    e.preventDefault();
    if (tween && tween.interruptible) endTween(false);
    if (tween) return;
    const k = e.ctrlKey ? 0.006 : 0.0011;   // pinch on a trackpad arrives as ctrl + wheel with small deltas
    zoomBy(Math.exp(e.deltaY * (e.deltaMode === 1 ? 30 : 1) * k));
  }, { passive: false });
  const typing = e => e.target && (e.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName));
  addEventListener('keydown', e => { if (IN.keys && !typing(e) && !e.metaKey && !e.ctrlKey) held.add(e.key.toLowerCase()); });
  addEventListener('keyup', e => held.delete(e.key.toLowerCase()));
  addEventListener('blur', () => held.clear());

  // ---------- tweens ----------
  function endTween(ok) { if (!tween) return; const t = tween; tween = null; Object.assign(goal, cur); if (t.resolve) t.resolve(ok); }
  function startTween(to, ms, { curve = 'smooth', interruptible = true, onEnd = null } = {}) {
    if (tween) endTween(false);
    const from = { ...cur };
    to = { ...cur, ...to };
    to.yaw = from.yaw + wrapA(to.yaw - from.yaw);
    if (ctx.reduceMotion) ms = Math.min(ms, 700);
    return new Promise(resolve => {
      tween = { from, to, ms: Math.max(1, ms), t: 0, curve, interruptible, resolve: ok => { if (onEnd) onEnd(ok); resolve(ok); } };
    });
  }
  function sample(tw, u) {
    const f = tw.from, t = tw.to, p = {};
    if (tw.curve === 'descent') {
      // a top-down drop over the relief map: the height falls in log space, the view stays (nearly) straight
      // down for the first half, then tilts into the leader's oblique while it turns a little
      const e = SMOOTHER(u), el = SMOOTHER(clamp((u - 0.32) / 0.68, 0, 1)), ey = EASE(clamp(u * 1.1, 0, 1));
      p.dist = Math.exp(Math.log(f.dist) + (Math.log(t.dist) - Math.log(f.dist)) * e);
      p.pitch = f.pitch + (t.pitch - f.pitch) * el;
      p.yaw = f.yaw + (t.yaw - f.yaw) * ey;
      for (const k of ['tx', 'ty', 'tz', 'fov']) p[k] = f[k] + (t[k] - f[k]) * SMOOTHER(clamp(u * 1.15, 0, 1));
    } else {
      const e = tw.curve === 'ease' ? EASE(u) : SMOOTHER(u);
      // a gentle arc: when travelling far, pull back a little mid-way (the reference orbit's feel)
      const travel = Math.hypot(t.tx - f.tx, t.tz - f.tz);
      const lift = Math.sin(Math.PI * e) * Math.min(0.35, travel / 160);
      p.dist = Math.exp(Math.log(f.dist) + (Math.log(t.dist) - Math.log(f.dist)) * e) * (1 + lift);
      for (const k of ['tx', 'ty', 'tz', 'yaw', 'pitch', 'fov']) p[k] = f[k] + (t[k] - f[k]) * e;
      p.pitch = Math.min(1.53, p.pitch + lift * 0.25);
    }
    return p;
  }

  // ---------- per frame ----------
  function update(dt) {
    if (tween) {
      tween.t += dt * 1000;
      const u = clamp(tween.t / tween.ms, 0, 1);
      Object.assign(cur, sample(tween, u)); Object.assign(goal, cur);
      if (u >= 1) endTween(true);
      return;
    }
    if (enabled) {
      const sp = goal.dist * 0.9 * dt;
      if (IN.keys) {
        const k = held.has('q') ? 1 : held.has('e') ? -1 : 0;
        if (k) goal.yaw += k * dt * 1.1;
        const tl = held.has('r') ? 1 : held.has('f') ? -1 : 0;
        if (tl) goal.pitch = clamp(goal.pitch + tl * dt * 0.7, mode === 'close' ? 0.03 : LIM.pitch[0], mode === 'close' ? 0.9 : LIM.pitch[1]);
        if (held.has('=') || held.has('+')) zoomBy(Math.exp(-dt * 1.4));
        if (held.has('-') || held.has('_')) zoomBy(Math.exp(dt * 1.4));
      }
      const s = Math.sin(goal.yaw), c = Math.cos(goal.yaw);
      let mx = 0, mz = 0;
      if (IN.keys) {
        if (held.has('arrowup') || held.has('w')) mz -= 1; if (held.has('arrowdown') || held.has('s')) mz += 1;
        if (held.has('arrowleft') || held.has('a')) mx -= 1; if (held.has('arrowright') || held.has('d')) mx += 1;
      }
      // gentle edge scroll (optional): only while the pointer rests at the very edge, never mid-drag
      if (IN.edgeScroll && pointer && !drag && performance.now() - pointer.t < 8000) {
        const r = dom.getBoundingClientRect(), e = IN.edgePx;
        const ex = pointer.x < r.left + e ? -1 : pointer.x > r.right - e ? 1 : 0, ez = pointer.y < r.top + e ? -1 : pointer.y > r.bottom - e ? 1 : 0;
        mx += ex * IN.edgeSpeed; mz += ez * IN.edgeSpeed;
      }
      if ((mx || mz) && mode === 'map') {
        goal.tx += (mx * c + mz * s) * sp; goal.tz += (-mx * s + mz * c) * sp; clampTarget(goal);
      }
    }
    // the target rides the ground, so turning pivots on the land under it (eased; never under the sea)
    if (mode === 'map') goal.ty = Math.max(0, gy(goal.tx, goal.tz));
    const a = 1 - Math.exp(-dt * 7);
    for (const key of ['tx', 'ty', 'tz', 'pitch', 'dist', 'fov']) cur[key] += (goal[key] - cur[key]) * a;
    cur.yaw += wrapA(goal.yaw - cur.yaw) * a;
  }
  const _eye = new THREE.Vector3(), _look = new THREE.Vector3();
  function place() {
    eyeOf(cur, _eye);
    // never under the hills
    const g = gy(_eye.x, _eye.z);
    if (_eye.y < g + 2.2) _eye.y = g + 2.2;
    _look.set(cur.tx, cur.ty, cur.tz);
    camera.position.copy(_eye); camera.lookAt(_look);
    const fov = fovFor(cur.fov, camera.aspect);
    if (Math.abs(camera.fov - fov) > 1e-3) { camera.fov = fov; camera.updateProjectionMatrix(); }
    camera.updateMatrixWorld();
  }
  // portrait screens: widen the vertical fov so the plot still fits across (the reference's rule)
  function fovFor(fov, a) {
    if (a >= 1.3) return fov;
    const half = Math.atan(Math.tan(THREE.MathUtils.degToRad(fov) / 2) * 1.3 / a);
    return Math.min(78, THREE.MathUtils.radToDeg(2 * half));
  }
  function framing(cam, w, h) { cam.aspect = w / h; cam.fov = fovFor(cur.fov, cam.aspect); }

  // ---------- scripted moves ----------
  const globeView = () => {   // the globe's dive end over home (geography places.home.view; docs: globe.diveView('home'))
    const h = geo.places.home, v = h.view;
    return poseFromEyeLook({ x: h.x + v.eye[0], y: v.eye[1], z: h.z + v.eye[2] }, { x: h.x + v.look[0], y: v.look[1], z: h.z + v.look[2] }, v.fov || 46);
  };
  // descent({ from: 'sky' | 'globe' | {eye, look, fov} | pose, ms, to }) -> Promise<boolean>
  //   'sky' (default, ~5.2 s): from ~330 m up looking nearly straight down at the region like a relief map,
  //   easing down and tilting into the leader view. 'globe' (3 s): from the globe's dive end.
  function descent({ from = 'sky', ms = null, to = home } = {}) {
    let start;
    if (from === 'globe') start = globeView();
    else if (from && from.eye && from.look) start = poseFromEyeLook(from.eye, from.look, from.fov || cur.fov);
    else if (from && typeof from === 'object' && 'dist' in from) start = { ...cur, ...from };
    else start = { tx: to.tx + 2, ty: 0, tz: to.tz - 14, yaw: to.yaw - 0.42, pitch: 1.47, dist: 340, fov: to.fov };
    Object.assign(cur, start); Object.assign(goal, start); mode = 'map';
    const sky = from === 'sky' || from == null;
    return startTween({ ...to }, ms || (sky ? 5200 : 3000), { curve: sky ? 'descent' : 'smooth', interruptible: false });
  }
  function homeView({ ms = 1800 } = {}) { mode = 'map'; return startTween({ ...home }, ms); }
  // goView('leader' | 'eye' | 'top' | pose, { ms }): glide to a preset (eye = the cinematic low view)
  function goView(name = 'leader', { ms = 2000, snap = false } = {}) {
    const v = typeof name === 'string' ? VIEWS[name] : name; if (!v) return Promise.resolve(false);
    mode = 'map';
    if (snap) { setPose({ ...v }); return Promise.resolve(true); }
    return startTween({ ...v }, ms);
  }
  // focus(x, z, { dist, yaw, pitch, ms }): glide to a creation site, keeping the angle unless told
  function focus(x, z, { dist = null, yaw = null, pitch = null, ms = 1500, y = null } = {}) {
    const to = { tx: x, ty: y != null ? y : Math.max(0, gy(x, z)), tz: z };
    clampTarget(to);
    to.dist = dist != null ? dist : clamp(Math.min(cur.dist, 60), 26, 60);
    if (yaw != null) to.yaw = yaw;
    to.pitch = pitch != null ? pitch : clamp(Math.max(cur.pitch, pitchForDist(to.dist) - 0.05), 0.55, 1.2);
    mode = 'map';
    return startTween(to, ms);
  }
  // lookAt({x, y, z}, { dist, ms }): aim at any point without moving far (director helper)
  function lookAt(p, { dist = null, ms = 1400, yaw = null, pitch = null } = {}) {
    return startTween({ tx: p.x, ty: p.y != null ? p.y : Math.max(0, gy(p.x, p.z)), tz: p.z, dist: dist || cur.dist, ...(yaw != null ? { yaw } : {}), ...(pitch != null ? { pitch } : {}) }, ms);
  }
  // look toward a point far off (a nation) from our plot: stand at the plot's back, long lens (cinematic)
  function lookToward(x, z, { y = null, ms = 2200, fov = 30, height = null, back = null } = {}) {
    const dx = x - C.x, dz = z - C.z, l = Math.hypot(dx, dz) || 1, ux = dx / l, uz = dz / l;
    const g0 = gy(x, z), ty = y != null ? y : g0 + 7;
    if (back == null) back = -Math.min(24, l * 0.25);
    const ex = C.x - ux * back, ez = C.z - uz * back;
    let h = height;
    if (h == null) {
      let need = gy(ex, ez) + 13;
      for (const side of [-12, 0, 12]) for (let k = 1; k < 24; k++) {   // rays to the town's middle and both flanks
        const tx2 = x - uz * side, tz2 = z + ux * side;
        const t = k / 24, px = ex + (tx2 - ex) * t, pz = ez + (tz2 - ez) * t, g = gy(px, pz);
        let top = g + 4;
        for (const [bx, bz, br, bt] of blockers) if (Math.hypot(px - bx, pz - bz) < br) top = Math.max(top, bt + 1);
        need = Math.max(need, (top - ty * t) / (1 - t));
      }
      h = Math.min(70, need);
    }
    const pose = poseFromEyeLook({ x: ex, y: h, z: ez }, { x, y: ty, z }, fov);
    mode = 'map';
    return startTween(pose, ms);
  }
  // frameToward(x, z): the leader's tilted look from our coast at a far place (a nation on its headland),
  // high enough to see the water between; the town sits in the upper middle of the frame
  function frameToward(x, z, { ms = 2200, pitch = 0.6, fov = 40 } = {}) {
    const dx = x - C.x, dz = z - C.z, l = Math.hypot(dx, dz) || 1;
    const t = { tx: C.x + dx * 0.88, tz: C.z + dz * 0.88 };
    const pose = { ...t, ty: Math.max(0, gy(t.tx, t.tz)) * 0.5, yaw: Math.atan2(-dx, -dz), pitch, dist: clamp(l * 0.6 + 40, 70, 200), fov };
    mode = 'map';
    return startTween(pose, ms);
  }
  // upClose(target {x, z, y?}, { r, ms }) -> the reference's close orbit: low, near, drag orbits, wheel zooms
  function upClose(target, { r = 9, ms = 2000, pitch = 0.2, yaw = null } = {}) {
    if (mode !== 'close') saved = { ...goal };
    mode = 'close';
    const ty = target.y != null ? target.y : Math.max(0, gy(target.x, target.z)) + 1.1;
    return startTween({ tx: target.x, ty, tz: target.z, dist: r, pitch, yaw: yaw != null ? yaw : cur.yaw }, ms, { interruptible: true });
  }
  function back({ ms = 1800 } = {}) {
    const to = saved || home; saved = null; mode = 'map';
    return startTween({ ...to }, ms);
  }
  // visit(nationId): fly over to a neighbour's town, a high oblique from our side of it
  function visit(id, { ms = 3600 } = {}) {
    const n = geo.places.nations.find(o => o.id === id); if (!n) return Promise.resolve(false);
    if (mode !== 'visit') saved = { ...goal };
    mode = 'visit';
    const toPlot = Math.atan2(C.x - n.x, C.z - n.z);
    const pose = { tx: n.x, ty: Math.max(0, gy(n.x, n.z)) + 3, tz: n.z, yaw: toPlot, pitch: 0.7, dist: 74, fov: 40 };
    return startTween(pose, ms, { interruptible: false });
  }
  function setPose(p) { if (tween) endTween(false); Object.assign(cur, p); Object.assign(goal, p); }

  // ---------- picking: march the ray over the relief (the same surface groundY reads) ----------
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  // surface(x, z) -> { y, water } : what the eye sees there (land, the lake's water, the sea / river surface)
  function surface(x, z) {
    const g = gy(x, z);
    if (ground && ground.inLake && ground.inLake(x, z)) return { y: Math.max(g, 0.03), water: 'lake' };
    if (g < -0.9) return { y: -0.9, water: ground && ground.shoreS(x, z) > 0 ? 'river' : 'sea' };
    return { y: g, water: null };
  }
  function pick(clientX, clientY) {
    const r = dom.getBoundingClientRect();
    ndc.set((clientX - r.left) / r.width * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const o = ray.ray.origin, d = ray.ray.direction;
    let t = 0, prev = 0, hit = null;
    for (let i = 0; i < 600 && t < 2600; i++) {
      const x = o.x + d.x * t, y = o.y + d.y * t, z = o.z + d.z * t, s = surface(x, z), gap = y - s.y;
      if (gap <= 0) { hit = [prev, t]; break; }
      prev = t; t += Math.max(0.12, gap * 0.45);
    }
    if (!hit) return null;
    let [a, b] = hit;
    for (let i = 0; i < 24; i++) { const m = (a + b) / 2, x = o.x + d.x * m, y = o.y + d.y * m, z = o.z + d.z * m; if (y - surface(x, z).y > 0) a = m; else b = m; }
    const x = o.x + d.x * b, z = o.z + d.z * b, s = surface(x, z);
    return { x: +x.toFixed(2), z: +z.toFixed(2), y: +s.y.toFixed(2), inPlot: geo.inPlot(x, z), onWater: !!s.water, water: s.water };
  }
  // where a world point lands on screen (css px), for labels and the voice pointer
  const _p = new THREE.Vector3();
  function project(x, y, z) {
    _p.set(x, y, z).project(camera); const r = dom.getBoundingClientRect();
    return { x: r.left + (_p.x + 1) / 2 * r.width, y: r.top + (1 - _p.y) / 2 * r.height, visible: _p.z < 1 && Math.abs(_p.x) <= 1 && Math.abs(_p.y) <= 1 };
  }

  return {
    update, place, framing, descent, home: homeView, view: home, views: VIEWS, goView, focus, lookAt, lookToward, frameToward, upClose, back, visit, setPose, pick, project, surface,
    pose: () => ({ ...cur }), goal, cur, globeView, eyeOf: p => eyeOf(p || cur),
    get input() { return { ...IN }; }, setInput(o = {}) { Object.assign(IN, o); },
    get mode() { return mode; }, get busy() { return !!tween; }, get dragging() { return !!(drag && drag.moved); },
    wasDrag: () => lastDrag,
    get enabled() { return enabled; }, set enabled(v) { enabled = !!v; if (!v) { drag = null; held.clear(); } },
    stop: () => endTween(false)
  };
}
