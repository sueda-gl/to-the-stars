// Browser-side perf probe, injected into EVERY frame (top page + iframes) before their scripts run
// (page.evaluateOnNewDocument). Counts WebGL draw calls / framebuffer binds / contexts per realm, records the
// top window's rAF gaps, long tasks and the WebGL timer-query extension, and tags every GL context it sees.
//   window.__perf.snap()   -> { draws, binds, contexts, frames: [gaps], longTasks }  (and resets the counters)
// The realm's name is set by the harness (window.__perfName) or taken from location / the frame element.
(function () {
  if (window.__perf) return;
  const P = { draws: 0, binds: 0, texUploads: 0, contexts: 0, lost: 0, frames: [], rafCalls: 0, longTasks: [], gpuExt: null, rts: new Map() };
  const wrap = (proto, name, fn) => { const o = proto && proto[name]; if (!o) return; proto[name] = function () { fn(this, arguments); return o.apply(this, arguments); }; };
  for (const Ctx of [window.WebGL2RenderingContext, window.WebGLRenderingContext]) {
    if (!Ctx) continue;
    const p = Ctx.prototype;
    for (const d of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced', 'drawRangeElements']) wrap(p, d, () => { P.draws++; });
    wrap(p, 'bindFramebuffer', () => { P.binds++; });
    wrap(p, 'texImage2D', () => { P.texUploads++; });
    // render-target sizes: every texture given to a framebuffer (three: framebufferTexture2D on setupRenderTarget / resize)
    wrap(p, 'texStorage2D', () => { P.texUploads++; });
  }
  const gc = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, attrs) {
    const gl = gc.call(this, type, attrs);
    if (gl && /webgl/.test(String(type)) && !gl.__perfSeen) {
      gl.__perfSeen = true; P.contexts++;
      try { P.gpuExt = P.gpuExt || (gl.getExtension('EXT_disjoint_timer_query_webgl2') ? 'EXT_disjoint_timer_query_webgl2' : gl.getExtension('EXT_disjoint_timer_query') ? 'EXT_disjoint_timer_query' : 'none'); } catch (e) { /* no */ }
      this.addEventListener('webglcontextlost', () => { P.lost++; });
    }
    return gl;
  };
  // the top page's frame cadence (gaps between consecutive rAF callbacks of ONE chain)
  if (window === window.top) {
    let last = 0;
    const tick = t => { if (last) P.frames.push(t - last); last = t; requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
    try { new PerformanceObserver(l => { for (const e of l.getEntries()) P.longTasks.push({ t: Math.round(e.startTime), d: Math.round(e.duration) }); }).observe({ entryTypes: ['longtask'] }); } catch (e) { /* no longtask */ }
  }
  // rAF callback invocations in this realm (so a throttled iframe shows as 0/s)
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = function (cb) { return raf(function (t) { P.rafCalls++; return cb(t); }); };
  window.__perf = {
    P,
    snap() {
      const out = { draws: P.draws, binds: P.binds, texUploads: P.texUploads, contexts: P.contexts, lost: P.lost, rafCalls: P.rafCalls, frames: P.frames.slice(), longTasks: P.longTasks.slice(), gpuExt: P.gpuExt };
      P.draws = 0; P.binds = 0; P.texUploads = 0; P.rafCalls = 0; P.frames.length = 0; P.longTasks.length = 0;
      return out;
    }
  };
})();
