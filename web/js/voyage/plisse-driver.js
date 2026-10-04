// Plissé driver: plays Sueda's "Plissé — the lantern planet" (web/worlds/plisse.html) from the parent page.
// The file is byte-identical to reference/plisse-the-lantern-planet.html (sha256 in reference/SHA256) and is NEVER
// edited: its shaders and looks stay exactly hers. Everything here goes through its DOM from outside (same-origin
// <iframe>): synthetic pointer drags and wheel events on canvas#c (her OrbitControls), a click on her own #paint
// button, and one <style> we inject (and remove) to hide her chrome. Mirrors lounge-driver.js.
//
// Her camera lives in a closure, so the driver keeps a model of it: OrbitControls r147 round the origin, opening at
// (7, 8, 41), fov 38, rotateSpeed 0.5, distance 14..75, damping 0.06, autoRotate 0.18 — which turns theta by
// 2*pi/3600*0.18 rad EVERY FRAME until the first drag / wheel (her 'start' listener switches it off for good). The
// model counts her frames on the iframe's own requestAnimationFrame (so throttling hits both alike), replays her
// damping for the auto-rotation exactly, and is fed every pointer / wheel event that reaches the canvas (ours and
// the player's), like the lounge model.

import { installRafGate } from './raf-gate.js';

const CAM = { target: [0, 0, 0], start: [7, 8, 41], fov: 38, rotateSpeed: 0.5, min: 14, max: 75, damping: 0.06, autoRotateSpeed: 0.18 };
const AUTO = 2 * Math.PI / 60 / 60 * CAM.autoRotateSpeed;     // rad per frame (her getAutoRotationAngle)
const EPS = 0.000001;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const plisseFov = a => a < 1 ? Math.min(70, 38 / Math.pow(a, 0.7)) : 38;   // her resize()

function cameraModel() {
  const [x, y, z] = CAM.start, r0 = Math.hypot(x, y, z);
  const m = { radius: r0, phi: Math.acos(clamp(y / r0, -1, 1)), theta: Math.atan2(x, z), autoRotate: true, delta: 0, frames: 0 };
  m.home = { radius: m.radius, phi: m.phi, theta: m.theta };
  // one of her frames: controls.update() with autoRotate (rotateLeft -> sphericalDelta.theta -= angle, then damping)
  m.frame = () => {
    m.frames++;
    if (m.autoRotate) m.delta -= AUTO;
    m.theta += m.delta * CAM.damping; m.delta *= 1 - CAM.damping;
  };
  // her 'start' event: autoRotate off; the damped remainder still lands, so book it now
  m.stopAuto = () => { if (!m.autoRotate) return; m.autoRotate = false; m.theta += m.delta; m.delta = 0; };
  m.rotate = (dx, dy, h) => {   // a drag of dx, dy css px on an element h px tall (rotateLeft / rotateUp)
    m.theta -= 2 * Math.PI * dx * CAM.rotateSpeed / h;
    m.phi = clamp(m.phi - 2 * Math.PI * dy * CAM.rotateSpeed / h, EPS, Math.PI - EPS);
  };
  m.wheel = deltaY => { if (deltaY < 0) m.radius *= 0.95; else if (deltaY > 0) m.radius /= 0.95; m.radius = clamp(m.radius, CAM.min, CAM.max); };
  // two-finger pinch (her controls' TOUCH.DOLLY_PAN, pan off): every move is dollyOut(dEnd / dStart), applied at once
  // (not damped) and clamped 14..75 by the update() her touchmove calls (act3 addition, see docs/act3.md)
  m.pinch = ratio => { m.radius = clamp(m.radius / ratio, CAM.min, CAM.max); };
  m.pose = (w, h) => {
    const s = Math.sin(m.phi), th = m.theta + m.delta;   // theta + the remainder still to land = where it is heading
    const position = [m.radius * s * Math.sin(m.theta), m.radius * Math.cos(m.phi), m.radius * s * Math.cos(m.theta)];
    return { theta: m.theta, phi: m.phi, radius: m.radius, heading: th, position, target: [...CAM.target], up: [0, 1, 0], fov: plisseFov(w / h), aspect: w / h, autoRotate: m.autoRotate, frames: m.frames };
  };
  return m;
}

// The opening framing of plisse.html, i.e. what a visitor sees first (and what the space stand-in's approach ends on):
// camera (7, 8, 41) looking at the origin, y up, fov 38 (portrait: min(70, 38 / aspect^0.7)), distance 42.36.
// Plissé (radius 10, rim ~10.33) is centred and fills ~72 % of the window height. Her lantern axis points at her star
// (-1, .16, .05), off-screen left, so the lit cream day end with its red cap is the LEFT limb, the dusk ring (olive,
// mustard, teal pools, the shadelings and the elder lanterns) runs top to bottom just left of centre, and the navy
// night end is on the right with its pleats converging on the far cap, glowing warm in the folds. The two moons are
// wherever her clock has put them (red pleated moon r 19, bead r 15.5). Then the camera drifts slowly (autoRotate,
// ~1 deg/s at 60 fps, theta falling: the view slides to the right round the dusk ring) until the visitor drags.
export const ARRIVAL = {
  position: [...CAM.start], target: [...CAM.target], up: [0, 1, 0], fov: CAM.fov,
  radius: Math.hypot(...CAM.start), theta: Math.atan2(CAM.start[0], CAM.start[2]), phi: Math.acos(CAM.start[1] / Math.hypot(...CAM.start)),
  autoRotate: { speed: CAM.autoRotateSpeed, radPerFrame: AUTO }, limits: { minDistance: CAM.min, maxDistance: CAM.max }
};

export function createPlisseDriver(iframe, { log = null } = {}) {
  const cam = cameraModel();
  let doc = null, win = null, canvas = null, readyP = null, nextId = 1, styleEl = null, readyAt = 0, clockAt = 0, frameMs = 1000 / 60, loopOn = false;
  let walkT = 0, walkAt = 0;   // her walkers' clock: the sum of her per-frame dt, each clamped to 0.05 s (act3 addition)
  let gate = null, gateFps = null;   // perf: the rAF gate on her window (throttle)
  const say = (...a) => log && log(...a);

  // ---------- wiring into the page (re-done on every iframe load) ----------
  function attach() {
    try { doc = iframe.contentDocument; win = iframe.contentWindow; } catch (e) { doc = win = null; }
    canvas = doc && doc.getElementById('c');
    if (!canvas || canvas.__agoraDriver) return !!canvas;
    canvas.__agoraDriver = true;
    styleEl = null; readyAt = 0; clockAt = 0; loopOn = false; walkT = 0; walkAt = 0;
    Object.assign(cam, { ...cam.home, autoRotate: true, delta: 0, frames: 0 });
    // the rAF gate (raf-gate.js): throttle(0) freezes her page while it waits hidden (Chrome never throttles a hidden
    // same-origin iframe by itself). Installed before our own tick below, so the model's frame count is gated with hers.
    gate = installRafGate(win, iframe.ownerDocument && iframe.ownerDocument.defaultView);
    if (gate && gateFps !== null) gate.set(gateFps);
    const down = new Map();
    // pinch model (act3 addition): her controls take the two DOWN events' positions for dollyStart, then each move uses
    // the moving pointer against the other's last tracked position. Once two pointers were down, nothing rotates until
    // all are up (her state goes NONE when one lifts).
    let multi = false, dStart = 0;
    canvas.addEventListener('pointerdown', e => {
      if (e.pointerType === 'touch' || e.button === 0) down.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, touch: e.pointerType === 'touch' });
      if (e.pointerType === 'touch' || e.button === 0 || e.button === 1) cam.stopAuto();   // her 'start'
      if (down.size >= 2) {
        multi = true;
        const [a, b] = [...down.values()];
        dStart = (down.size === 2 && a.touch && b.touch) ? Math.hypot(a.x0 - b.x0, a.y0 - b.y0) : 0;
      }
    });
    canvas.addEventListener('pointermove', e => {
      const p = down.get(e.pointerId); if (!p) return;
      if (multi) {
        if (down.size === 2 && p.touch && dStart > 0) {
          const o = [...down.entries()].find(([id]) => id !== e.pointerId)[1];
          if (o.touch) { const d = Math.hypot(e.clientX - o.x, e.clientY - o.y); if (d > 0) { cam.pinch(d / dStart); dStart = d; } }
        }
        p.x = e.clientX; p.y = e.clientY;
        return;
      }
      cam.rotate(e.clientX - p.x, e.clientY - p.y, canvas.clientHeight || win.innerHeight);
      p.x = e.clientX; p.y = e.clientY;
    });
    const up = e => { down.delete(e.pointerId); if (!down.size) { multi = false; dStart = 0; } };
    canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('wheel', e => { cam.stopAuto(); cam.wheel(e.deltaY); }, { passive: true });
    // Her frames, on the frame's own requestAnimationFrame (her loop runs on it too, so throttling hits both alike).
    // The timestamps are kept from the moment we attach, which is normally before her first frame: her THREE.Clock
    // starts at the start of her FIRST frame (frame N), which compiles every shader and can take a second; the canvas
    // gets class 'ready' in a callback of frame N+1. So her clock origin is frame N's timestamp, not the time 'ready'
    // shows up. All in the frame's own time base (win.performance), which differs from the parent's.
    // her clock, read exactly (act3 addition): her THREE.Clock is the only caller of performance.now() in her page
    // (Clock.start once, then one getDelta per frame). A pass-through shim on the frame's performance object records
    // what it returns, so her scene time (last - first) and her walkers' clock (sum of min(dt, 0.05)) are hers to the
    // microsecond. Values are returned unchanged; her file is untouched. If we attach after her clock has started,
    // the frame-stamp model below is used instead. The driver itself reads the original via pnow().
    const PF = win.performance;
    if (!win.__agoraNow) {
      const orig = PF.now.bind(PF), hk = { first: null, last: null, walk: 0, calls: 0, late: canvas.classList.contains('ready') };
      win.__agoraNow = orig; win.__agoraClock = hk;
      PF.now = function () { const v = orig(); if (hk.last == null) hk.first = v; else hk.walk += Math.min(0.05, Math.max(0, v - hk.last) / 1000); hk.last = v; hk.calls++; return v; };
    }
    const me = canvas, w0 = win, stamps = [];
    let counted = false, lastT = 0;
    const tick = t => {
      if (canvas !== me || win !== w0) return;   // the frame was reloaded
      if (lastT) frameMs = frameMs * 0.9 + Math.min(100, t - lastT) * 0.1;
      lastT = t;
      // the time this callback RUNS, not the frame's timestamp t: her first frame starts late (her script builds the
      // planet first), and her clock reads performance.now() when her callback runs, right after ours (registered
      // earlier, so it runs first in the frame)
      stamps.push(pnow(w0)); if (stamps.length > 8) stamps.shift();
      if (loopOn) {
        cam.frame();
        const now = stamps[stamps.length - 1];
        walkT += Math.min(0.05, Math.max(0, now - walkAt) / 1000); walkAt = now;   // her dt = min(getDelta, 0.05)
      }
      w0.requestAnimationFrame(tick);
    };
    w0.requestAnimationFrame(tick);
    const startCounting = () => {
      if (loopOn) return; loopOn = true;
      readyAt = performance.now();
      const D = pnow(w0), n = stamps.length;
      if (n >= 2 && !counted) {
        const a = stamps[n - 1], b = stamps[n - 2];
        const ranN1 = (D - a) < (a - b);         // our tick of frame N+1 already ran (it sits right before D)
        clockAt = ranN1 ? b : a;
        cam.frame(); if (ranN1) cam.frame();      // frame N (and N+1 if our tick for it has passed)
        walkT = ranN1 ? Math.min(0.05, (a - b) / 1000) : 0; walkAt = ranN1 ? a : b;   // frame N's dt is 0 (her clock starts there)
      } else { clockAt = D - frameMs; cam.frame(); walkT = 0; walkAt = D; }   // attached late: estimate
      counted = true;
      api._clock = { D, stamps: stamps.slice(), clockAt };   // for tests/plisse/clock-probe.mjs
    };
    if (canvas.classList.contains('ready')) startCounting();
    else new win.MutationObserver((_, o) => { if (canvas.classList.contains('ready')) { o.disconnect(); startCounting(); } }).observe(canvas, { attributes: true, attributeFilter: ['class'] });
    keepFocusOut();
    return true;
  }

  // ---------- focus: the game's keyboard lives on the parent window (same three layers as lounge-driver.js) ----------
  //  1. mousedown is default-prevented inside the frame (capture), so a click never focuses it; OrbitControls runs on
  //     pointer events, which this doesn't touch;
  //  2. if focus gets in anyway, every key is re-dispatched on the parent window and Space / Tab / Enter never act
  //     inside (her #paint button would otherwise toggle on Space);
  //  3. focus is handed back on pointerup and on the frame's own focus event.
  //  Pointer moves are mirrored to the parent (for the voice's "there"). Mirrored events carry __agvForwarded.
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
    win.addEventListener('focus', () => setTimeout(giveBack, 0));
    win.addEventListener('pointerup', () => setTimeout(giveBack, 0), true);
    const fwdPtr = e => {
      if (!e.isTrusted) return;
      const r = iframe.getBoundingClientRect(), PE = P.PointerEvent || P.MouseEvent;
      const ev = new PE(e.type, {
        clientX: e.clientX + r.left, clientY: e.clientY + r.top, screenX: e.screenX, screenY: e.screenY,
        pointerId: e.pointerId, pointerType: e.pointerType, isPrimary: e.isPrimary, button: e.button, buttons: e.buttons, bubbles: true
      });
      ev.__agvForwarded = true;
      iframe.dispatchEvent(ev);
    };
    win.addEventListener('pointermove', fwdPtr, { passive: true, capture: true });
    win.addEventListener('pointerdown', fwdPtr, { passive: true, capture: true });
  }
  iframe.addEventListener('load', () => { readyP = null; attach(); });
  iframe.setAttribute('tabindex', '-1');

  // ready(): her first frame is drawn (canvas.ready). Her canvas then fades in over 1.4 s (her CSS), so pass
  // { settled: true } to wait until that fade is over (what a cross-fade should wait for).
  function ready({ timeout = 30000, settled = false } = {}) {
    const base = readyP || (readyP = new Promise((res, rej) => {
      const t0 = performance.now();
      (function poll() {
        if (attach() && canvas.classList.contains('ready')) return res(api);
        if (doc && doc.getElementById('err') && doc.getElementById('err').style.display === 'grid') { readyP = null; return rej(new Error('plisse: WebGL or three.js unavailable')); }
        if (performance.now() - t0 > timeout) { readyP = null; return rej(new Error('plisse: not ready after ' + timeout + ' ms')); }
        setTimeout(poll, 30);
      })();
    }));
    if (!settled) return base;
    return base.then(() => new Promise(r => setTimeout(() => r(api), Math.max(0, readyAt + 1450 - performance.now()))));
  }
  const isReady = () => !!(attach() && canvas.classList.contains('ready'));
  const pnow = w => (w.__agoraNow || w.performance.now.bind(w.performance))();
  const hooked = () => { const hk = win && win.__agoraClock; return hk && !hk.late && hk.first != null ? hk : null; };
  const isSettled = () => isReady() && readyAt > 0 && performance.now() - readyAt > 1450;
  const size = () => ({ w: win.innerWidth, h: win.innerHeight });

  // ---------- synthetic pointers (her OrbitControls captures the pointer; shadow it for our gesture only) ----------
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

  // ---------- cinematic nudges ----------
  // look(dx, dy): a synthetic OrbitControls drag of dx, dy css px (+dx swings the view to the left, like a hand).
  // NOTE: her controls stop the auto-rotation for good on the first drag / wheel (her own 'start' listener).
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
    return cameraNow();
  }
  // to an absolute orbit pose (theta, phi) with one drag
  function lookTo({ theta = cam.theta, phi = cam.phi } = {}, opts) {
    const hh = (canvas && canvas.clientHeight) || win.innerHeight, k = hh / (2 * Math.PI * CAM.rotateSpeed);
    return look((cam.theta - theta) * k, (cam.phi - phi) * k, opts);
  }
  // zoom(f): distance x f (f < 1 = closer), as her wheel does it: steps of 5 % (0.95 per notch), clamped 14..75.
  // Her wheel is not damped, so the notches are spread over ms.
  async function zoom(f = 0.8, { ms = 600, settle = 200 } = {}) {
    await ready();
    const n = Math.round(Math.log(f) / Math.log(0.95));
    if (!n) return cameraNow();
    const { w, h } = size(), WE = win.WheelEvent;
    for (let i = 0; i < Math.abs(n); i++) {
      canvas.dispatchEvent(new WE('wheel', { deltaY: n > 0 ? -100 : 100, deltaMode: 0, clientX: w / 2, clientY: h / 2, bubbles: true, cancelable: true, view: win }));
      await new Promise(r => setTimeout(r, ms / Math.abs(n)));
    }
    await new Promise(r => setTimeout(r, settle));
    return cameraNow();
  }
  // ---------- act3 additions: smooth, frame-locked gestures (docs/act3.md) ----------
  // Steps run on the frame's own requestAnimationFrame, one event per her frame, so her camera moves every frame
  // (no wheel-notch judder: ART_DIRECTION 19).
  function fireTouch(type, x, y, id, buttons, primary) {
    const PE = win.PointerEvent || win.MouseEvent;
    canvas.dispatchEvent(new PE(type, {
      bubbles: true, cancelable: true, composed: true, view: win, clientX: x, clientY: y, screenX: x, screenY: y,
      pointerId: id, pointerType: 'touch', isPrimary: primary, button: 0, buttons, width: 20, height: 20, pressure: buttons ? 0.5 : 0
    }));
  }
  const easeIO = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  // Steps run on the PARENT's requestAnimationFrame: the top document's callbacks run first in a frame, so each event
  // lands before her frame renders (and before any other frame, e.g. the landing bridge, reads the model this frame).
  function frames(ms, step, ease = easeIO) {
    const P = (iframe.ownerDocument && iframe.ownerDocument.defaultView) || win;
    return new Promise(res => {
      const w0 = win, t0 = P.performance.now();
      const f = () => {
        if (win !== w0) return res(false);
        const u = Math.min(1, (P.performance.now() - t0) / ms);
        step(ease(u), u);
        if (u < 1) P.requestAnimationFrame(f); else res(true);
      };
      P.requestAnimationFrame(f);
    });
  }
  // pinch(radius): her two-finger dolly to an absolute distance (clamped 14..75), on a log scale with ease-in-out.
  async function pinch(radius = CAM.min, { ms = 1800, settle = 0 } = {}) {
    await ready();
    const r0 = cam.radius, r1 = clamp(radius, CAM.min, CAM.max);
    if (Math.abs(r1 - r0) < 1e-4) return cameraNow();
    const { w, h } = size(), cx = w * 0.5, cy = h * 0.5, D0 = Math.min(w, h) * 0.16, a = 9000 + (nextId++ % 500) * 2, b = a + 1;
    // finger A stays put; finger B slides so that |AB| = D0 * r0 / r(u)  ->  radius r(u) = r0 * (r1 / r0)^e
    const ax = cx - D0 * 0.5, ay = cy, dir = [1, 0];
    let last = D0;
    await shield(async () => {
      fireTouch('pointerdown', ax, ay, a, 1, true);
      fireTouch('pointerdown', ax + D0 * dir[0], ay + D0 * dir[1], b, 1, false);
      await frames(ms, e => {
        const d = D0 * Math.pow(r0 / r1, e);
        if (Math.abs(d - last) < 1e-6) return;
        last = d; fireTouch('pointermove', ax + d * dir[0], ay + d * dir[1], b, 1, false);
      });
      fireTouch('pointerup', ax + last * dir[0], ay + last * dir[1], b, 0, false);
      fireTouch('pointerup', ax, ay, a, 0, true);
    });
    if (settle) await new Promise(r => setTimeout(r, settle));
    return cameraNow();
  }
  // turn(theta, phi): a one-finger drag to an absolute orbit pose, eased per frame (her damping still lands the rest)
  async function turn({ theta = cam.theta, phi = cam.phi } = {}, { ms = 900 } = {}) {
    await ready();
    const { w, h } = size(), hh = canvas.clientHeight || h, x0 = w * 0.5, y0 = h * 0.45, id = 9600 + (nextId++ % 300);
    let dx = 0, dy = 0;
    await shield(async () => {
      fireTouch('pointerdown', x0, y0, id, 1, true);          // her 'start': auto-rotation off, its remainder booked
      const k = hh / (2 * Math.PI * CAM.rotateSpeed);
      dx = (cam.theta - theta) * k; dy = (cam.phi - phi) * k;
      await frames(ms, e => fireTouch('pointermove', x0 + dx * e, y0 + dy * e, id, 1, true));
      fireTouch('pointerup', x0 + dx, y0 + dy, id, 0, true);
    });
    return cameraNow();
  }
  // approach({ theta, phi, radius }): her camera eases to an orbit pose and distance in one continuous move: a turn,
  // then (as her damping lands the turn) a pinch. Resolves when her camera has come to rest (damping < 1e-4 rad).
  // rest: ms to wait after the pinch (the turn's damping has long landed by then; 0 = hand straight on, no hold)
  async function approach({ theta, phi, radius = CAM.min } = {}, { turnMs = 900, pinchMs = 1900, rest = 450 } = {}) {
    await ready();
    if (theta != null || phi != null) await turn({ theta: theta ?? cam.theta, phi: phi ?? cam.phi }, { ms: turnMs });
    await pinch(radius, { ms: pinchMs });
    if (rest) await new Promise(r => setTimeout(r, rest));
    return cameraNow();
  }
  // her walkers' clock (w.lon += w.w * dt, dt = min(getDelta, 0.05)): differs from sceneTime() by the time lost to
  // slow frames (her first frames compile shaders). For copying her shadelings exactly (web/js/voyage/landing-bridge.js).
  const walkTime = () => {
    if (!loopOn || !win) return null;
    const hk = hooked(), n = pnow(win);
    return hk ? hk.walk + Math.min(0.05, Math.max(0, n - hk.last) / 1000) : walkT + Math.min(0.05, Math.max(0, n - walkAt) / 1000);
  };

  // back to her opening framing (theta, phi by one drag, distance by wheel notches)
  async function lookHome(opts) {
    await ready();
    if (Math.round(Math.log(cam.home.radius / cam.radius) / Math.log(0.95))) await zoom(cam.home.radius / cam.radius, { ms: 300, settle: 0 });
    return lookTo(cam.home, opts);
  }

  // ---------- her own button + chrome ----------
  async function setPainted(on = true) {
    await ready();
    const b = doc.getElementById('paint'), cur = b.getAttribute('aria-pressed') === 'true';
    if (cur !== !!on) b.click();
    return b.getAttribute('aria-pressed') === 'true';
  }
  // Hide (or restore) her title card, hint and button bar so the game's UI can take over. Only a <style> is added.
  async function hideOwnChrome(on = true) {
    await ready();
    if (on && !(styleEl && styleEl.isConnected)) {
      styleEl = doc.createElement('style'); styleEl.id = 'agora-plisse-chrome';
      styleEl.textContent = '.title, .hint, .bar { opacity: 0 !important; pointer-events: none !important; visibility: hidden !important; transition: opacity .5s ease, visibility 0s linear .5s !important; }';
      try { const a = doc.activeElement; if (a && a !== doc.body && a.closest && a.closest('.bar')) a.blur(); } catch (e) { /* gone */ }
      doc.head.appendChild(styleEl);
    } else if (!on && styleEl) { styleEl.remove(); styleEl = null; }
    return !!(styleEl && styleEl.isConnected);
  }

  // ---------- reading the model ----------
  // the camera now: { theta, phi, radius, position, target, up, fov, aspect, autoRotate, frames }
  function cameraNow() { const { w, h } = win ? size() : { w: innerWidth, h: innerHeight }; return cam.pose(w, h); }
  // seconds on her THREE.Clock (it starts at her first frame), for syncing the stand-in's moons and folk
  const sceneTime = () => { if (!loopOn || !win) return null; const hk = hooked(); return (pnow(win) - (hk ? hk.first : clockAt)) / 1000; };
  const arrivalPose = () => ({ ...ARRIVAL, fov: plisseFov(win ? win.innerWidth / win.innerHeight : innerWidth / innerHeight) });
  const state = () => isReady() ? {
    ready: true, settled: isSettled(),
    painted: doc.getElementById('paint').getAttribute('aria-pressed') === 'true',
    chromeHidden: !!(styleEl && styleEl.isConnected),
    camera: cameraNow(), sceneTime: sceneTime(), frameMs, throttle: gateFps
  } : { ready: false };

  // perf (docs/perf.md): throttle(0) freezes her page (nothing renders, her last frame stays on the canvas), throttle(fps)
  // trickles it, throttle(null) frees it. Use it only after ready() (her 'ready' class is set from a rAF callback) and
  // free it before she must move again (a cross-fade, a gesture, a clock the bridge copies). Her walkers lose the frozen
  // time (their clock is a sum of per-frame dt), so the stand-in follows walkTime() for its folk (plisse-standin.js).
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
    iframe, ready, isReady, isSettled, look, lookTo, lookHome, zoom, setPainted, hideOwnChrome, state, cameraNow, sceneTime, arrivalPose,
    pinch, turn, approach, walkTime, throttle, get throttled() { return gateFps; },
    camera: cam, ARRIVAL,
    get window() { return win; }, get document() { return doc; }, get canvas() { return canvas; }
  };
  attach();
  return api;
}

// three r147 for plisse.html offline: the service worker web/worlds/lounge-sw.js (scope worlds/) answers any
// cdn.jsdelivr.net/npm/three@0.147.0/ request from web/worlds/vendor/three@0.147.0/, which holds both files plisse.html
// loads (build/three.min.js, examples/js/controls/OrbitControls.js; byte-identical to jsDelivr, checked by sha256).
// Resolves true once active, false after 2.5 s / when unsupported (then the CDN is used as written).
export function registerPlisseOffline(src = 'worlds/plisse.html', log = null) {
  if (!('serviceWorker' in navigator) || !window.isSecureContext) return Promise.resolve(false);
  const page = new URL(src, location.href), sw = new URL('lounge-sw.js', page), scope = new URL('./', page);
  const reg = navigator.serviceWorker.register(sw.href, { scope: scope.href }).then(r => new Promise(res => {
    const w = r.installing || r.waiting || r.active;
    if (!w || w.state === 'activated') return res(true);
    w.addEventListener('statechange', () => { if (w.state === 'activated') res(true); });
  })).catch(e => { if (log) log('offline worker unavailable:', e.message); return false; });
  return Promise.race([reg, new Promise(r => setTimeout(() => r(false), 2500))]);
}
