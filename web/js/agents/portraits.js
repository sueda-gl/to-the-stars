// Painted portraits of our folk (ART_DIRECTION §14): each folk's own head and shoulders, small, for the letter pins,
// the wax seal, the letter header and the notifications. The folk is cloned exactly as it is dressed (its body colour,
// rotor / parasol, clothes by trade, the minister's seal; held props left out), posed at rest, rendered offscreen with
// a fixed 3/4 front camera lit by the scene's own key light, then painted on the CPU: a small Kuwahara pass (flat
// brush patches, like the gouache), a soft ink keyline round the silhouette, paper tooth, on a paper-coloured circle.
// Cached per folk and per size; re-rendered when its gear changes (identity rev: a new trade, the minister's seal).
//
//   const portraits = createPortraits(ctx, folk, { get: id => rec })
//   portraits.now(id, { size = 96, bg = 'paper' | 'none', ring = true }) -> dataURL | null   (null: not landed yet)
//   portraits.get(id, opts) -> Promise<dataURL | null>   (waits up to 30 s for a queued folk to land)
//   portraits.update()      // the bridge calls it every frame (settles waiting promises)
//   portraits.rev(id)       // changes when the folk's look changes (pins re-request)
//   portraits.forget(id) · portraits.clear()
const PAPER = [243, 236, 220], INK = [61, 85, 136];
const SS = 3;   // supersampling: render at 3x and paint down

export function createPortraits(ctx, folk, { get }) {
  const { renderer } = ctx;
  const pScene = new THREE.Scene();
  const pCam = new THREE.PerspectiveCamera(26, 1, 0.05, 60);
  const cache = new Map();   // id -> { rev, urls: Map(key -> dataURL) }
  const waiting = [];        // { id, opts, resolve, until }
  let rt = null, rtSize = 0, buf = null;

  const revOf = rec => rec && rec.a ? ((rec.idn && rec.idn.rev) || 0) * 2 + (rec.idn && rec.idn.minister ? 1 : 0) : -1;

  // ---- a posed clone of the folk, props removed ----
  function posedClone(rec) {
    const a = rec.a, src = a.root;
    const drop = new Set(Object.values(rec.x || {}));
    if (rec.halo) drop.add(rec.halo);
    const srcNodes = [], clone = src.clone(true), dstNodes = [];
    src.traverse(o => srcNodes.push(o)); clone.traverse(o => dstNodes.push(o));
    const map = new Map(); srcNodes.forEach((o, i) => map.set(o, dstNodes[i]));
    // held things (envelope, mallet, crate, nub arms ...) and anything only drawn in the live pass are left out
    srcNodes.forEach((o, i) => { const d = dstNodes[i]; if (o !== src && (drop.has(o) || (o.isMesh && !o.layers.test(pCam.layers)))) d.userData.__drop = true; });
    dstNodes.filter(d => d.userData.__drop).forEach(d => d.parent && d.parent.remove(d));
    // at rest: no squash, no swing, no blink, propeller blades across, parasol turned to show its pattern
    clone.position.set(0, 0, 0); clone.rotation.set(0, 0, 0); clone.scale.setScalar(1);
    const m = o => o && map.get(o);
    const body = m(a.body);
    if (body) { body.rotation.set(0, 0, 0); body.scale.set(1, 1, 1); body.position.set(0, rec.species === 'floatie' ? -0.82 : 0, 0); }
    if (m(a.swing)) m(a.swing).rotation.set(0, 0, 0);
    if (m(a.canopy)) m(a.canopy).rotation.set(0, 0.35, 0);
    if (rec.species === 'floatie' && m(a.canopy) && m(a.swing)) {
      // the parasol tipped back behind the head like a halo, its pattern facing the lens; the handle left out
      const c = m(a.canopy); c.position.set(0, -0.5, -0.3); c.rotation.set(1.05, 0.35, 0);
      m(a.swing).children.filter(o => o.isMesh).forEach(o => m(a.swing).remove(o));
    }
    if (m(a.prop)) m(a.prop).rotation.set(0, 0.62, 0);
    if (m(a.wave)) m(a.wave).rotation.set(0, 0, -0.3);
    (a.eyes || []).forEach(e => { const d = m(e); if (d) d.scale.y = d.scale.x; });
    if (rec.idn && rec.idn.counter && m(rec.idn.counter)) m(rec.idn.counter).rotation.y = -0.62 * 1.3;
    if (rec.idn && rec.idn.tail && m(rec.idn.tail)) m(rec.idn.tail).rotation.set(0.4, 0, 0.3);
    return clone;
  }

  // what to frame (folk units, the clone at the origin): head and shoulders
  function framing(rec, clone) {
    if (rec.species === 'flit') return { cy: 0.1, h: 0.7 };        // the ball + cap + rotor, the bottom of the ball just cut
    if (rec.species === 'floatie') return { cy: -0.66, h: 0.84 };  // the face under the parasol tipped back like a halo
    const TF = { loaf: { cy: 0.32, h: 0.7 }, twinkle: { cy: 0.38, h: 0.72 }, glim: { cy: 0.34, h: 0.72 }, moth: { cy: 0.27, h: 0.7 } };   // the townsfolk: their faces
    if (TF[rec.species]) return TF[rec.species];
    const box = new THREE.Box3().setFromObject(clone), s = box.getSize(new THREE.Vector3());
    return { cy: box.max.y - s.y * 0.36, h: Math.max(0.5, s.y * 0.8) };   // envoys: the top of the creature
  }

  function ensureRT(px) {
    if (rt && rtSize === px) return;
    if (rt) rt.dispose();
    rt = new THREE.WebGLRenderTarget(px, px, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat, depthBuffer: true });
    rtSize = px; buf = new Uint8Array(px * px * 4);
  }

  function renderRaw(rec, px) {
    const clone = posedClone(rec);
    const f = framing(rec, clone);
    // the scene's own key light, from over the viewer's left shoulder; the folk turned 3/4 toward the lens
    const any = []; clone.traverse(o => { if (!any.length && o.isMesh && o.material && o.material.uniforms && o.material.uniforms.uLight) any.push(o.material.uniforms.uLight.value); });
    const L = any[0] || new THREE.Vector3(-0.6, 0.6, 0.5);
    const la = Math.atan2(L.x, L.z), camA = la + 0.75, elev = rec.species === "flit" ? 0.08 : 0.16;
    clone.rotation.y = camA - 0.42;
    pScene.add(clone);
    const dist = (f.h / 2) / Math.tan(THREE.MathUtils.degToRad(pCam.fov / 2)) * 1.02;
    const c = new THREE.Vector3(0, f.cy, 0);
    pCam.position.set(Math.sin(camA) * Math.cos(elev) * dist, f.cy + Math.sin(elev) * dist, Math.cos(camA) * Math.cos(elev) * dist);
    pCam.lookAt(c); pCam.updateMatrixWorld();
    ensureRT(px);
    // renderer state in and out: nothing of the painter's frame changes
    const prevRT = renderer.getRenderTarget(), prevC = renderer.getClearColor(new THREE.Color()), prevA = renderer.getClearAlpha();
    const prevAuto = renderer.autoClear, sm = renderer.shadowMap, prevNeeds = sm.needsUpdate, prevSm = sm.enabled;
    try {
      sm.enabled = false; renderer.autoClear = true;
      renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 0); renderer.clear(true, true, true);
      renderer.render(pScene, pCam);
      renderer.readRenderTargetPixels(rt, 0, 0, px, px, buf);
    } finally {
      renderer.setRenderTarget(prevRT); renderer.setClearColor(prevC, prevA); renderer.autoClear = prevAuto;
      sm.enabled = prevSm; sm.needsUpdate = prevNeeds;
      pScene.remove(clone);
    }
    return buf;
  }

  // ---- the paint: Kuwahara over folk-on-paper, an ink keyline from the silhouette, paper tooth ----
  function paint(raw, px, { bg, ring, size }) {
    const N = px * px, rgb = new Float32Array(N * 3), alpha = new Float32Array(N);
    let seed = 1234567;
    const rand = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    for (let y = 0; y < px; y++) for (let x = 0; x < px; x++) {
      const si = ((px - 1 - y) * px + x) * 4, i = y * px + x;   // GL rows are bottom-up
      const a = raw[si + 3] > 0 ? 1 : 0; alpha[i] = a;   // opaque: the reference's ink (eyes, mouth) writes alpha .5 without blending
      // over paper with a soft warm vignette (the "wash" behind the sitter)
      const dx = x / px - 0.5, dy = y / px - 0.42, v = Math.min(1, Math.sqrt(dx * dx + dy * dy) * 1.6);
      const p0 = PAPER[0] - 8 - 26 * v * v, p1 = PAPER[1] - 10 - 30 * v * v, p2 = PAPER[2] - 10 - 24 * v * v;
      rgb[i * 3] = raw[si] * a + p0 * (1 - a); rgb[i * 3 + 1] = raw[si + 1] * a + p1 * (1 - a); rgb[i * 3 + 2] = raw[si + 2] * a + p2 * (1 - a);
    }
    // Kuwahara (4 quadrants, radius r): the brush patches
    const r = 2, out = new Float32Array(N * 3);
    const q = [[-r, 0, -r, 0], [0, r, -r, 0], [-r, 0, 0, r], [0, r, 0, r]];
    for (let y = 0; y < px; y++) for (let x = 0; x < px; x++) {
      let best = 1e9, br = 0, bg_ = 0, bb = 0;
      for (const [x0, x1, y0, y1] of q) {
        let sr = 0, sg = 0, sb = 0, sl = 0, sl2 = 0, n = 0;
        for (let j = y0; j <= y1; j++) { const yy = Math.min(px - 1, Math.max(0, y + j));
          for (let k = x0; k <= x1; k++) { const xx = Math.min(px - 1, Math.max(0, x + k)), o = (yy * px + xx) * 3;
            const R = rgb[o], G = rgb[o + 1], B = rgb[o + 2], l = R * 0.3 + G * 0.59 + B * 0.11;
            sr += R; sg += G; sb += B; sl += l; sl2 += l * l; n++; } }
        const m = sl / n, varc = sl2 / n - m * m;
        if (varc < best) { best = varc; br = sr / n; bg_ = sg / n; bb = sb / n; }
      }
      const o = (y * px + x) * 3; out[o] = br; out[o + 1] = bg_; out[o + 2] = bb;
    }
    // keyline: where the silhouette's alpha changes (outer edge), a soft ink pencil line
    const cv = document.createElement('canvas'); cv.width = cv.height = px;
    const g = cv.getContext('2d'), img = g.createImageData(px, px), d = img.data;
    const A = (x, y) => alpha[Math.min(px - 1, Math.max(0, y)) * px + Math.min(px - 1, Math.max(0, x))];
    for (let y = 0; y < px; y++) for (let x = 0; x < px; x++) {
      const i = y * px + x, o = i * 3;
      let mx = 0; for (let j = -2; j <= 2; j++) for (let k = -2; k <= 2; k++) if (j * j + k * k <= 5) mx = Math.max(mx, A(x + k, y + j));
      const edge = Math.max(0, mx - alpha[i]) * 0.78;
      const tooth = (rand() - 0.5) * 9 + Math.sin(x * 0.9 + Math.sin(y * 0.37) * 2) * 2.2;
      let R = out[o] + tooth, G = out[o + 1] + tooth, B = out[o + 2] + tooth * 0.8;
      R = R * (1 - edge) + INK[0] * edge; G = G * (1 - edge) + INK[1] * edge; B = B * (1 - edge) + INK[2] * edge;
      d[i * 4] = R; d[i * 4 + 1] = G; d[i * 4 + 2] = B;
      d[i * 4 + 3] = bg === 'none' ? Math.round(Math.min(1, alpha[i] + edge * 1.4) * 255) : 255;
    }
    g.putImageData(img, 0, 0);
    // down to size, clipped to a circle on paper, a hairline ink ring
    const fc = document.createElement('canvas'); fc.width = fc.height = size;
    const f = fc.getContext('2d'); f.imageSmoothingEnabled = true; f.imageSmoothingQuality = 'high';
    if (bg !== 'none') { f.save(); f.beginPath(); f.arc(size / 2, size / 2, size / 2 - 0.5, 0, Math.PI * 2); f.clip(); }
    f.drawImage(cv, 0, 0, size, size);
    if (bg !== 'none') {
      f.restore();
      if (ring) { f.beginPath(); f.arc(size / 2, size / 2, size / 2 - Math.max(0.6, size / 96), 0, Math.PI * 2); f.lineWidth = Math.max(1, size / 64); f.strokeStyle = 'rgba(61,85,136,.55)'; f.stroke(); }
    }
    return fc.toDataURL('image/png');
  }

  function now(id, { size = 96, bg = 'paper', ring = true } = {}) {
    const rec = get(id); if (!rec || !rec.a || rec.state === 'queued') { const c = cache.get(id); return c ? [...c.urls.values()][0] || null : null; }
    size = Math.max(16, Math.min(256, Math.round(size)));
    const rev = revOf(rec), key = size + '|' + bg + '|' + (ring ? 1 : 0);
    let c = cache.get(id);
    if (!c || c.rev !== rev) { c = { rev, urls: new Map() }; cache.set(id, c); }
    if (c.urls.has(key)) return c.urls.get(key);
    const px = Math.min(384, size * SS);
    let url = null;
    try { url = paint(renderRaw(rec, px), px, { bg, ring, size }); } catch (e) { console.warn('[portraits]', e); return null; }
    c.urls.set(key, url);
    return url;
  }
  function getP(id, opts = {}) {
    const u = now(id, opts);
    if (u) return Promise.resolve(u);
    const rec = get(id); if (!rec) return Promise.resolve(null);
    return new Promise(resolve => waiting.push({ id, opts, resolve, until: performance.now() + 30000 }));
  }
  function update() {
    if (!waiting.length) return;
    const t = performance.now();
    for (let i = waiting.length - 1; i >= 0; i--) {
      const w = waiting[i], rec = get(w.id);
      if (rec && rec.a && rec.state === 'live') { waiting.splice(i, 1); w.resolve(now(w.id, w.opts)); }
      else if (t > w.until || !rec) { waiting.splice(i, 1); w.resolve(null); }
    }
  }
  return {
    now, get: getP, update,
    rev: id => revOf(get(id)),
    forget: id => cache.delete(id), clear: () => cache.clear(),
    dispose() { if (rt) rt.dispose(); rt = null; cache.clear(); waiting.splice(0).forEach(w => w.resolve(null)); }
  };
}
