// A requestAnimationFrame gate for a same-origin iframe we drive from outside (Plissé, the Alpine lounge): Chrome never
// throttles rAF in a same-origin iframe that is hidden (opacity 0, visibility: hidden, display: none and off-screen all
// keep running at 60 Hz, measured 2026-10-04), so a world waiting under a cross-fade costs a whole painted pipeline per
// frame for nothing. The gate shadows the frame window's own requestAnimationFrame / cancelAnimationFrame (own
// properties on the window object; the world's file is untouched, as with the performance.now shim in plisse-driver.js)
// and, while set, queues the callbacks instead of scheduling them:
//   gate.set(null)   free: every queued callback runs on the next real frame, then rAF is the browser's again
//   gate.set(0)      frozen: nothing runs until the gate is freed (the world keeps its last frame on its canvas)
//   gate.set(fps)    a trickle: the queued callbacks run on every k-th real frame (k = round(60 / fps)), so the world's
//                    GL work stays inside the frame pipeline (a timer-driven frame lands mid-frame and serialises with
//                    the visible scene's GPU work: measured 2026-10-04, the rising bridge fell to 9 fps under a 20 Hz timer)
// three's setAnimationLoop re-reads window.requestAnimationFrame every frame, so it follows the gate from the next
// frame on. A driver's own per-frame tick registered on the frame's rAF is gated too, so a camera model that counts the
// world's frames stays in step with the world (docs/plisse.md: "throttling hits the model and her scene alike").
export function installRafGate(win, parent = (typeof window !== 'undefined' ? window : null)) {
  if (!win) return null;
  if (win.__agoraGate) return win.__agoraGate;
  const RAF = win.requestAnimationFrame.bind(win), CAF = win.cancelAnimationFrame.bind(win);
  const host = parent || win;
  const now = () => (win.__agoraNow ? win.__agoraNow() : win.performance.now());
  const g = { fps: null, queue: new Map(), armed: false, count: 0, nextId: 1 << 20, frames: 0 };
  function run(t) {   // one frame: everything queued so far (callbacks queued during the run wait for the next)
    if (!g.queue.size) return;
    const list = [...g.queue.values()]; g.queue.clear(); g.frames++;
    const ts = t != null ? t : now();
    for (const cb of list) { try { cb(ts); } catch (e) { host.setTimeout(() => { throw e; }); } }
  }
  function tick(t) {   // a trickle: every k-th real frame (armed stays set while running, so a re-queue never double-arms)
    if (g.fps == null) { g.armed = false; run(t); return; }
    if (!(g.fps > 0)) { g.armed = false; return; }
    const k = Math.max(1, Math.round(60 / g.fps));
    if (++g.count % k === 0) run(t);
    if (g.queue.size) RAF(tick); else g.armed = false;
  }
  function schedule() {
    if (g.armed || !g.queue.size) return;
    if (g.fps == null || g.fps > 0) { g.armed = true; RAF(tick); }
  }
  win.requestAnimationFrame = function (cb) {
    if (g.fps == null) return RAF(cb);
    const id = g.nextId++; g.queue.set(id, cb); schedule(); return id;
  };
  win.cancelAnimationFrame = function (id) { if (!g.queue.delete(id)) CAF(id); };
  g.set = fps => {
    const v = fps == null || fps === false || fps === Infinity ? null : Math.max(0, +fps || 0);
    if (v === g.fps) return v;
    g.fps = v; g.count = 0;
    schedule();
    return v;
  };
  g.pending = () => g.queue.size;
  win.__agoraGate = g;
  return g;
}
