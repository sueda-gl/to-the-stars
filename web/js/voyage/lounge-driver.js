// Lounge driver: plays Sueda's "Alpine lounge" (web/worlds/lounge.html) from the parent page.
// The file is byte-identical to reference/alpine-lounge-final.html and is NEVER edited. Everything here
// goes through its DOM from outside (same-origin <iframe>): synthetic pointer events on canvas#c, clicks
// on its own #toggle / #paint buttons, and a <style> we inject (and remove) for the chrome.
//
// The scene's state lives in a closure we can't read, so the driver keeps a faithful model of its camera
// (OrbitControls spherical round target (0, 2.05, -3), fed by every pointer/wheel event that reaches the
// canvas, ours or the player's) and copies of its pure terrain maths (groundH, shValid), so it knows,
// before it taps, whether a tap will raycast onto valid grass and spawn a seed.

import { installRafGate } from './raf-gate.js';

// ---------- the scene's pure maths, copied verbatim (no rand, no THREE) ----------
function h3(x, y, z) { let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(z, 1440662683)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; }
function vnoise(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
  const a = h3(xi, yi, zi), b = h3(xi + 1, yi, zi), c = h3(xi, yi + 1, zi), d = h3(xi + 1, yi + 1, zi);
  const e = h3(xi, yi, zi + 1), f = h3(xi + 1, yi, zi + 1), g = h3(xi, yi + 1, zi + 1), k = h3(xi + 1, yi + 1, zi + 1);
  const x1 = a + (b - a) * u, x2 = c + (d - c) * u, x3 = e + (f - e) * u, x4 = g + (k - g) * u;
  const y1 = x1 + (x2 - x1) * v, y2 = x3 + (x4 - x3) * v;
  return y1 + (y2 - y1) * w;
}
function fbm(x, y, z, o = 4) { let s = 0, a = 0.5, f = 1, n = 0; for (let i = 0; i < o; i++) { s += a * vnoise(x * f + i * 17.3, y * f + i * 5.1, z * f); n += a; a *= 0.5; f *= 2.03; } return s / n; }
const smooth = (a, b, x) => { let t = (x - a) / (b - a); t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); };
const WATER_Y = -0.3;
function lakeD(x, z) { const dx = x / 64, dz = (z + 34) / 31.5; return Math.sqrt(dx * dx + dz * dz) + (vnoise(x * 0.04, 3.1, z * 0.04) - 0.5) * 0.18; }
function groundH(x, z) {
  let h = (fbm(x * 0.025, 1.7, z * 0.025, 3) - 0.5) * 1.2;
  h *= 1 - Math.exp(-(x * x + (z - 0.6) * (z - 0.6)) / 80);
  h -= 2.5 * (1 - smooth(0.86, 1.0, lakeD(x, z)));
  h += smooth(-60, -135, z) * 12 * (0.6 + 0.8 * fbm(x * 0.01, 5, z * 0.01, 2));
  h += smooth(60, 150, Math.abs(x)) * 8;
  return h;
}
const shObstacles = [[-0.8, 0, 0.6], [0, 0, 0.6], [0.8, 0, 0.6], [-2.05, 0.5, 0.65], [2.05, 0.5, 0.65], [0, 1.3, 0.3], [-3.05, 0.95, 0.38], [3.0, 1.0, 0.38], [-1.38, -0.62, 0.16]];
const shRegion = { x0: -7.5, x1: 7.5, z0: -3.2, z1: 3.8 };
export function shValid(x, z) {
  if (x < shRegion.x0 || x > shRegion.x1 || z < shRegion.z0 || z > shRegion.z1) return false;
  if (groundH(x, z) < WATER_Y + 0.35) return false;
  for (const [ox, oz, r] of shObstacles) if ((x - ox) ** 2 + (z - oz) ** 2 < (r + 0.12) ** 2) return false;
  return true;
}

// ---------- the scene's camera, modelled (OrbitControls r147 with its settings) ----------
const TARGET = [0, 2.05, -3];
const CAM = { rotateSpeed: 0.5, minDist: 4, maxDist: 15, minPolar: 1.15, maxPolar: 1.7, minAz: -1.15, maxAz: 1.15 };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function norm(a) { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }

function cameraModel() {
  // camera.position (0, 1.5, 6.6) round target (0, 2.05, -3)
  const o = sub([0, 1.5, 6.6], TARGET), r0 = Math.hypot(...o);
  const m = { radius: r0, phi: Math.acos(clamp(o[1] / r0, -1, 1)), theta: Math.atan2(o[0], o[2]) };
  m.home = { ...m };
  m.rotate = (dx, dy, h) => {   // a drag of dx, dy css px on an element h px tall (rotateLeft / rotateUp)
    m.theta = clamp(m.theta - 2 * Math.PI * dx * CAM.rotateSpeed / h, CAM.minAz, CAM.maxAz);
    m.phi = clamp(m.phi - 2 * Math.PI * dy * CAM.rotateSpeed / h, Math.max(CAM.minPolar, 1e-6), Math.min(CAM.maxPolar, Math.PI - 1e-6));
  };
  m.wheel = deltaY => { if (deltaY < 0) m.radius *= 0.95; else if (deltaY > 0) m.radius /= 0.95; m.radius = clamp(m.radius, CAM.minDist, CAM.maxDist); };
  m.basis = (w, h) => {
    const s = Math.sin(m.phi);
    const pos = [TARGET[0] + m.radius * s * Math.sin(m.theta), TARGET[1] + m.radius * Math.cos(m.phi), TARGET[2] + m.radius * s * Math.cos(m.theta)];
    const f = norm(sub(TARGET, pos)), rt = norm(cross(f, [0, 1, 0])), up = cross(rt, f);
    const a = w / h, fov = a < 1 ? Math.min(80, 52 / Math.pow(a, 0.6)) : 52;   // the scene's resize()
    return { pos, f, rt, up, a, t: Math.tan(fov * Math.PI / 360) };
  };
  // client point -> ground hit (plane y = 0, as the scene's raycast)
  m.ground = (cx, cy, w, h) => {
    const B = m.basis(w, h), nx = cx / w * 2 - 1, ny = -(cy / h) * 2 + 1;
    const d = norm([0, 1, 2].map(i => B.f[i] + B.rt[i] * nx * B.t * B.a + B.up[i] * ny * B.t));
    if (d[1] >= -1e-6) return null;
    const k = -B.pos[1] / d[1];
    return { x: B.pos[0] + d[0] * k, z: B.pos[2] + d[2] * k };
  };
  // world (x, y, z) -> client point
  m.project = (x, y, z, w, h) => {
    const B = m.basis(w, h), v = sub([x, y, z], B.pos), zf = dot(v, B.f);
    if (zf <= 0.1) return null;
    return { x: (dot(v, B.rt) / (zf * B.t * B.a) + 1) / 2 * w, y: (1 - dot(v, B.up) / (zf * B.t)) / 2 * h };
  };
  return m;
}

// Where seeds can land. Measured, not guessed: the scene only accepts a tap whose ground hit passes its own
// shValid(), and near the set its meadow sits a hair under that test's water line (groundH < 0.05), so in
// practice seeds take only on the LEFT meadow (x < -4.8) and a strip back-right (x > 5.5, z < 1).
// (tests/voyage/driver-check.mjs taps a 400-point grid on the real scene and agrees with this model 400/400.)
// From the opening framing that left meadow is a small far patch, so 'auto' first turns the camera to
// SEED_VIEW, standing in the left meadow looking across at the sofas, and drops the seed in the foreground.
const SEED_VIEW = { theta: -0.78, phi: 1.6 };
// the gathering crowd's haunts (their group centres + where the scene's fallback pick puts them): a seed
// within 7.5 m of a shadeling draws it in
const CROWD = [[-4.3, 1.4], [4.0, 1.8], [-0.8, -1.9], [1.8, -1.7], [-5.0, -1.2], [5.2, -0.8], [0.9, 2.3], [0, 2.7], [-2, 2.7], [2, 2.7]];
// furniture that can hide a seed from the camera: [x, z, r, height]
const OCCLUDERS = [[-0.8, 0, 0.62, 0.85], [0, 0, 0.62, 0.85], [0.8, 0, 0.62, 0.85], [-2.05, 0.5, 0.6, 0.8], [2.05, 0.5, 0.6, 0.8], [0, 1.3, 0.3, 0.7], [-3.05, 0.95, 0.3, 0.6], [3.0, 1.0, 0.3, 0.6]];

export function createLoungeDriver(iframe, { log = null } = {}) {
  const cam = cameraModel();
  let doc = null, win = null, canvas = null, readyP = null, nextId = 1, styleEl = null, userAt = -1e9;
  let gate = null, gateFps = null;   // perf: the rAF gate on the scene's window (throttle)
  const say = (...a) => log && log(...a);

  // ---------- wiring into the page (re-done on every iframe load) ----------
  function attach() {
    try { doc = iframe.contentDocument; win = iframe.contentWindow; } catch (e) { doc = win = null; }
    canvas = doc && doc.getElementById('c');
    if (!canvas || canvas.__agoraDriver) return !!canvas;
    canvas.__agoraDriver = true;
    styleEl = null;
    Object.assign(cam, cam.home);
    // the rAF gate (raf-gate.js): throttle(0) freezes the scene while it waits hidden under the landing bridge
    gate = installRafGate(win, iframe.ownerDocument && iframe.ownerDocument.defaultView);
    if (gate && gateFps !== null) gate.set(gateFps);
    // keep the camera model in step with everything OrbitControls sees (player drags + our synthetic ones)
    const down = new Map();
    canvas.addEventListener('pointerdown', e => { if (e.pointerType === 'touch' || e.button === 0) down.set(e.pointerId, { x: e.clientX, y: e.clientY }); });
    canvas.addEventListener('pointermove', e => {
      const p = down.get(e.pointerId); if (!p || down.size > 1) return;
      cam.rotate(e.clientX - p.x, e.clientY - p.y, canvas.clientHeight || win.innerHeight);
      p.x = e.clientX; p.y = e.clientY;
    });
    const up = e => down.delete(e.pointerId);
    canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('wheel', e => { userAt = performance.now(); cam.wheel(e.deltaY); }, { passive: true });
    canvas.addEventListener('pointerdown', e => { if (e.isTrusted) userAt = performance.now(); });
    keepFocusOut();
    return true;
  }

  // ---------- focus: the game's keyboard lives on the parent window ----------
  // Space (push-to-talk), Escape, Enter... are all heard on the parent window. A real tap or drag on the
  // meadow would normally focus the iframe's window for good, so the parent would hear no keys for the
  // rest of the Moon act (and its window 'blur' would cut off a held Space mid-sentence). Three layers:
  //  1. mousedown is default-prevented inside the lounge (capture phase), which keeps focus out of the frame
  //     altogether; OrbitControls and the seed tap run on pointer events, which this doesn't touch;
  //  2. if focus gets in anyway (touch, a browser that ignores 1, someone focusing it from script), every
  //     key is re-dispatched on the parent window, and Space / Tab never act inside the lounge;
  //  3. focus is handed back to the parent on pointerup and on the frame's own focus event.
  //  Pointer moves over the lounge are mirrored to the parent window too, so the voice's "there" (its
  //  pointer history) keeps tracking the cursor on the Moon. Mirrored events carry __agvForwarded.
  function keepFocusOut() {
    const P = iframe.ownerDocument && iframe.ownerDocument.defaultView;
    if (!P || !win || win.__agoraFocus) return;
    win.__agoraFocus = true;
    const giveBack = () => {
      if (P.document.activeElement !== iframe && !(doc.hasFocus && doc.hasFocus())) return;
      try { if (doc.activeElement && doc.activeElement !== doc.body) doc.activeElement.blur(); } catch (e) { /* gone */ }
      try { iframe.blur(); P.focus(); } catch (e) { /* gone */ }
    };
    win.addEventListener('mousedown', e => { if (e.isTrusted) e.preventDefault(); }, true);
    const fwdKey = e => {
      const K = P.KeyboardEvent;
      const ev = new K(e.type, {
        key: e.key, code: e.code, location: e.location, repeat: e.repeat, isComposing: e.isComposing,
        ctrlKey: e.ctrlKey, shiftKey: e.shiftKey, altKey: e.altKey, metaKey: e.metaKey, bubbles: true, cancelable: true, composed: true
      });
      ev.__agvForwarded = true;
      const notPrevented = (P.document.body || P.document.documentElement).dispatchEvent(ev);
      if (!notPrevented || e.code === 'Space' || e.key === ' ' || e.key === 'Tab' || e.key === 'Enter') e.preventDefault();
      if (e.key === 'Tab') giveBack();
    };
    win.addEventListener('keydown', fwdKey, true);
    win.addEventListener('keyup', fwdKey, true);
    // the frame got focus anyway: hand it straight back (after the event that caused it has finished)
    win.addEventListener('focus', () => setTimeout(giveBack, 0));
    win.addEventListener('pointerup', () => setTimeout(giveBack, 0), true);
    // mirror pointer motion for the voice's deictic pointer ("put it there")
    const fwdPtr = e => {
      if (!e.isTrusted) return;
      const r = iframe.getBoundingClientRect(), PE = P.PointerEvent || P.MouseEvent;
      const ev = new PE(e.type, {
        clientX: e.clientX + r.left, clientY: e.clientY + r.top, screenX: e.screenX, screenY: e.screenY,
        pointerId: e.pointerId, pointerType: e.pointerType, isPrimary: e.isPrimary, button: e.button, buttons: e.buttons, bubbles: true
      });
      ev.__agvForwarded = true;
      iframe.dispatchEvent(ev);   // bubbles up the parent's tree to its window, from where the lounge sits
    };
    win.addEventListener('pointermove', fwdPtr, { passive: true, capture: true });
    win.addEventListener('pointerdown', fwdPtr, { passive: true, capture: true });
  }
  iframe.addEventListener('load', () => { readyP = null; attach(); });

  function ready(timeout = 30000) {
    if (readyP) return readyP;
    readyP = new Promise((res, rej) => {
      const t0 = performance.now();
      (function poll() {
        if (attach() && canvas.classList.contains('ready')) return res(api);
        if (doc && doc.getElementById('err') && doc.getElementById('err').style.display === 'grid') return rej(new Error('lounge: WebGL or three.js unavailable'));
        if (performance.now() - t0 > timeout) { readyP = null; return rej(new Error('lounge: not ready after ' + timeout + ' ms')); }
        setTimeout(poll, 60);
      })();
    });
    return readyP;
  }
  const isReady = () => !!(attach() && canvas.classList.contains('ready'));
  const size = () => ({ w: win.innerWidth, h: win.innerHeight });

  // ---------- synthetic pointers ----------
  // OrbitControls calls setPointerCapture(pointerId), which throws for a pointer the browser doesn't know
  // (a synthetic one), and that would leave the controls deaf. We shadow it on the element instance for the
  // gesture only (the file is untouched), then remove the shadow so real pointers capture normally.
  function shield(fn) {
    const own = Object.prototype.hasOwnProperty;
    const had = [own.call(canvas, 'setPointerCapture'), own.call(canvas, 'releasePointerCapture')];
    const P = win.Element.prototype;
    canvas.setPointerCapture = function (id) { try { P.setPointerCapture.call(this, id); } catch (e) { /* synthetic pointer */ } };
    canvas.releasePointerCapture = function (id) { try { P.releasePointerCapture.call(this, id); } catch (e) { /* synthetic pointer */ } };
    const done = () => { if (!had[0]) delete canvas.setPointerCapture; if (!had[1]) delete canvas.releasePointerCapture; };
    try { const r = fn(); if (r && r.then) return r.finally(done); done(); return r; } catch (e) { done(); throw e; }
  }
  function fire(type, x, y, id, buttons) {
    const PE = win.PointerEvent || win.MouseEvent;
    canvas.dispatchEvent(new PE(type, {
      bubbles: true, cancelable: true, composed: true, view: win, clientX: x, clientY: y, screenX: x, screenY: y,
      pointerId: id, pointerType: 'mouse', isPrimary: true, button: 0, buttons, width: 1, height: 1, pressure: buttons ? 0.5 : 0
    }));
  }
  function tap(x, y) {
    const id = 7000 + (nextId++ % 1000);
    shield(() => { fire('pointerdown', x, y, id, 1); fire('pointerup', x, y, id, 0); });
  }

  // ---------- seeds ----------
  // world spot -> where to tap, if that tap would land on valid grass at the current camera
  function tapFor(x, z) {
    const { w, h } = size(), p = cam.project(x, 0, z, w, h);
    if (!p || p.x < 4 || p.y < 4 || p.x > w - 4 || p.y > h - 4) return null;
    const g = cam.ground(p.x, p.y, w, h);
    return g && shValid(g.x, g.z) ? { clientX: p.x, clientY: p.y, world: g } : null;
  }
  // client point -> nearest point whose tap spawns a seed (spiral search, ~2 px steps)
  function snapClient(cx, cy) {
    const { w, h } = size();
    for (let r = 0; r <= 240; r += 6) {
      const n = r === 0 ? 1 : Math.max(8, Math.round(r * 0.8));
      for (let i = 0; i < n; i++) {
        const a = i / n * Math.PI * 2, x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
        if (x < 4 || y < 4 || x > w - 4 || y > h - 4) continue;
        const g = cam.ground(x, y, w, h);
        if (g && shValid(g.x, g.z)) return { clientX: x, clientY: y, world: g };
      }
    }
    return null;
  }
  // valid with a margin all round, so a camera still settling (damping) can't push the tap off the grass
  const solid = (x, z, m = 0.35) => shValid(x, z) && [0, 1, 2, 3, 4, 5, 6, 7].every(i => shValid(x + Math.cos(i * 0.785) * m, z + Math.sin(i * 0.785) * m));
  // is the ground point under (cx, cy) hidden behind furniture?
  function occluded(cx, cy) {
    const { w, h } = size(), B = cam.basis(w, h), nx = cx / w * 2 - 1, ny = -(cy / h) * 2 + 1;
    const d = norm([0, 1, 2].map(i => B.f[i] + B.rt[i] * nx * B.t * B.a + B.up[i] * ny * B.t));
    const far = -B.pos[1] / d[1];
    for (const [ox, oz, r, top] of OCCLUDERS) for (let s = 0; s < far; s += 0.05) {
      const x = B.pos[0] + d[0] * s, y = B.pos[1] + d[1] * s, z = B.pos[2] + d[2] * s;
      if (y < top && (x - ox) ** 2 + (z - oz) ** 2 < r * r) return true;
    }
    return false;
  }
  // the best seed spot in the current view: draws the most of the crowd, near, central, low in frame, in sight
  function bestSpot() {
    const { w, h } = size(), B = cam.basis(w, h);
    let best = null;
    for (let y = h * 0.42; y < h * 0.93; y += 12) for (let x = w * 0.08; x < w * 0.92; x += 12) {
      const g = cam.ground(x, y, w, h);
      if (!g || !solid(g.x, g.z)) continue;
      const dist = Math.hypot(g.x - B.pos[0], B.pos[1], g.z - B.pos[2]);
      const pull = CROWD.filter(([a, b]) => Math.hypot(a - g.x, b - g.z) < 7.5).length;
      const score = pull * 10 - dist * 0.8 - Math.abs(x / w - 0.5) * 8 - Math.abs(y / h - 0.76) * 12;
      if (best && score <= best.score) continue;
      if (occluded(x, y)) continue;
      best = { clientX: x, clientY: y, world: g, dist, score };
    }
    return best;
  }
  // turn the camera to an absolute orbit pose (theta, phi) with one synthetic drag
  function lookTo({ theta = cam.theta, phi = cam.phi } = {}, opts) {
    const hh = canvas.clientHeight || win.innerHeight, k = hh / (2 * Math.PI * CAM.rotateSpeed);
    return look((cam.theta - theta) * k, (cam.phi - phi) * k, opts);
  }
  // where='auto' | {u, v} (fractions of the lounge viewport) | {x, z} (lounge world, metres)
  // -> { ok, clientX, clientY, u, v, world: {x, z}, swung, reframed?: Promise (auto only, after the swing back) }
  async function dropSeed(where = 'auto', { frame = true, reframe = 6500 } = {}) {
    await ready();
    const { w, h } = size();
    let hit = null;
    let swung = false;
    if (where === 'auto' || where == null) {
      hit = bestSpot();
      if ((!hit || hit.dist > 8) && frame) { await lookTo(SEED_VIEW, { settle: 1600 }); swung = true; hit = bestSpot() || hit; }
    } else if ('x' in where && 'z' in where) {
      hit = tapFor(where.x, where.z);
      if (!hit) { const p = cam.project(where.x, 0, where.z, w, h); hit = p && snapClient(p.x, p.y); }
    } else {
      hit = snapClient(clamp(where.u, 0, 1) * w, clamp(where.v, 0, 1) * h);
    }
    if (!hit) { say('dropSeed: no valid grass in view'); return { ok: false, reason: 'no valid grass in view' }; }
    tap(hit.clientX, hit.clientY);
    say('seed at', hit.world.x.toFixed(2), hit.world.z.toFixed(2));
    const out = { ok: true, clientX: hit.clientX, clientY: hit.clientY, u: hit.clientX / w, v: hit.clientY / h, world: { x: hit.world.x, z: hit.world.z }, swung };
    // The seed view (standing in the left meadow) loses the hero composition. Once the crowd has gathered,
    // swing back toward the opening framing as far as still keeps the seed and its circle in the picture.
    // Skipped if the player has touched the camera since, or reframe: false / 0.
    if (swung && reframe) {
      const t0 = performance.now();
      out.reframed = new Promise(r => setTimeout(r, reframe)).then(() => {
        if (userAt > t0 || !isReady()) return null;
        const pose = framingFor(hit.world.x, hit.world.z);
        return pose ? lookTo(pose, { ms: 2600, settle: 1400 }) : null;
      }).catch(() => null);
    }
    return out;
  }
  // the pose nearest the opening framing (home) on the way to the current one that still shows the
  // ground round (x, z) with a margin, clear of the furniture
  function framingFor(x, z, r = 0.6) {
    const { w, h } = size(), keep = { theta: cam.theta, phi: cam.phi };
    let found = null;
    for (let i = 0; i <= 20 && !found; i++) {
      const k = i / 20;
      cam.theta = cam.home.theta + (keep.theta - cam.home.theta) * k; cam.phi = cam.home.phi + (keep.phi - cam.home.phi) * k;
      const pts = [[x, z], [x - r, z], [x + r, z], [x, z - r], [x, z + r]].map(([a, b]) => cam.project(a, 0, b, w, h));
      const inFrame = pts.every(p => p && p.x > w * 0.02 && p.x < w * 0.98 && p.y > h * 0.3 && p.y < h * 0.96)
        && pts[0].x > w * 0.08 && pts[0].x < w * 0.92;   // the seed itself clear of the edge, its circle in frame
      if (inFrame && !occluded(pts[0].x, pts[0].y)) found = { theta: cam.theta, phi: cam.phi };
    }
    cam.theta = keep.theta; cam.phi = keep.phi;
    return found && Math.abs(found.theta - keep.theta) > 0.05 ? found : null;
  }

  // ---------- the scene's own buttons ----------
  function pressTo(id, on) {
    const b = doc.getElementById(id), cur = b.getAttribute('aria-pressed') === 'true';
    if (cur !== !!on) b.click();
    return b.getAttribute('aria-pressed') === 'true';
  }
  async function setGoldenHour(on = true) { await ready(); return pressTo('toggle', on); }
  async function setPainted(on = true) { await ready(); return pressTo('paint', on); }
  const state = () => isReady() ? {
    ready: true,
    goldenHour: doc.getElementById('toggle').getAttribute('aria-pressed') === 'true',
    painted: doc.getElementById('paint').getAttribute('aria-pressed') === 'true',
    chromeHidden: !!(styleEl && styleEl.isConnected),
    camera: { radius: cam.radius, phi: cam.phi, theta: cam.theta }, throttle: gateFps
  } : { ready: false };

  // ---------- cinematic nudges: a synthetic OrbitControls drag ----------
  // dx, dy in css px of drag (+dx swings the view to the left, as a hand would drag); ms = drag length.
  // Resolves after the drag plus the controls' damping settle (~1 s).
  async function look(dx = 60, dy = 0, { ms = 900, settle = 1100 } = {}) {
    await ready();
    const { w, h } = size(), x0 = w * 0.5, y0 = h * 0.45, id = 8000 + (nextId++ % 1000);
    const steps = Math.max(2, Math.round(ms / 16));
    await shield(async () => {
      fire('pointerdown', x0, y0, id, 1);
      for (let i = 1; i <= steps; i++) {
        const t = i / steps, e = t * t * (3 - 2 * t);
        fire('pointermove', x0 + dx * e, y0 + dy * e, id, 1);
        await new Promise(r => setTimeout(r, ms / steps));
      }
      fire('pointerup', x0 + dx, y0 + dy, id, 0);
    });
    await new Promise(r => setTimeout(r, settle));
    return state().camera;
  }
  // back to the opening framing (one drag that undoes the model's offset)
  const lookHome = opts => lookTo(cam.home, opts);

  // ---------- chrome ----------
  // Hide (or restore) the scene's own hint + button bar so the game's UI can take over.
  async function hideOwnChrome(on = true) {
    await ready();
    if (on && !(styleEl && styleEl.isConnected)) {
      styleEl = doc.createElement('style'); styleEl.id = 'agora-voyage-chrome';
      // visibility (not just opacity) so its buttons drop out of the tab order and can't be keyboard-pressed
      styleEl.textContent = '.hint, .bar { opacity: 0 !important; pointer-events: none !important; visibility: hidden !important; transition: opacity .5s ease, visibility 0s linear .5s !important; }';
      try { const a = doc.activeElement; if (a && a !== doc.body && a.closest && a.closest('.bar')) a.blur(); } catch (e) { /* gone */ }
      doc.head.appendChild(styleEl);
    } else if (!on && styleEl) { styleEl.remove(); styleEl = null; }
    return !!(styleEl && styleEl.isConnected);
  }

  // perf (docs/perf.md): throttle(0) freezes the scene (its last frame stays on the canvas), throttle(fps) trickles it,
  // throttle(null) frees it. Only after ready(); free it before anything must move (its golden-hour ease, a seed, a cut).
  // perf: the frame's SIZE while it is hidden. setSize(0.1) makes the iframe a tenth of the viewport (same aspect): the
  // page renders at that size (its resize() rebuilds its targets), its clocks, gestures and animations keep running
  // exactly, and the cost is one per cent of the pixels. setSize(1) restores the full frame: call it at least two frames
  // before the frame is shown (the first full-size frame is the heavy one). Only the element's style is touched.
  let sized = 1;
  function setSize(scale = 1) {
    const P = iframe.ownerDocument && iframe.ownerDocument.defaultView;
    if (!(scale < 1)) { iframe.style.width = ''; iframe.style.height = ''; sized = 1; return 1; }
    const W = P ? P.innerWidth : 1440, H = P ? P.innerHeight : 900;
    iframe.style.width = Math.max(32, Math.round(W * scale)) + 'px'; iframe.style.height = Math.max(32, Math.round(H * scale)) + 'px';
    sized = scale; return sized;
  }
  function throttle(fps = null) { gateFps = fps == null ? null : fps; if (gate) gate.set(gateFps); return gateFps; }
  const api = {
    setSize, get sized() { return sized; },
    iframe, ready, isReady, dropSeed, setGoldenHour, setPainted, look, lookTo, lookHome, SEED_VIEW, hideOwnChrome, state, throttle, get throttled() { return gateFps; },
    tap(clientX, clientY) { if (isReady()) tap(clientX, clientY); },   // a raw click on the canvas, no validity check
    // for tests and the lab: the model, and "would a tap here spawn a seed?"
    camera: cam, framingFor, wouldSeed(cx, cy) { const { w, h } = size(), g = cam.ground(cx, cy, w, h); return !!(g && shValid(g.x, g.z)); },
    groundAt(cx, cy) { const { w, h } = size(); return cam.ground(cx, cy, w, h); },
    project(x, y, z) { const { w, h } = size(); return cam.project(x, y, z, w, h); },
    get window() { return win; }, get document() { return doc; }, get canvas() { return canvas; }
  };
  attach();
  return api;
}
