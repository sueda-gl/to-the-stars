// Landing bridge: the dive from Plissé's closest view down onto its dusk ring, into the Alpine lounge (ART_DIRECTION §16).
//
// Our own three r147 scene (the worlds' vendored copy, web/worlds/vendor/three@0.147.0/), run in a same-origin srcdoc
// <iframe> so its THREE never meets the Tower Planet's. It paints with a VERBATIM copy of the shared anisotropic-Kuwahara
// gouache post of plisse.html / lounge.html (ldr -> tensor -> paint -> comp, same uniforms and values) on the same
// renderer settings (sRGB, ACES, exposure as each world sets it), so the paint is continuous across both cuts.
//
//   * Plissé part: a copy of plisse.html's scene code (its surf() maths, palette, glow, atmosphere, moons, shadelings,
//     elder lanterns; same mulberry32(11) stream, so the same walkers and elders), plus a hi-res patch of the same
//     surface round the landing site. Her clocks are copied from her driver (sceneTime / walkTime), and the camera starts
//     at her driver's camera model, so the first frame is her frame.
//   * Lounge part: a copy of lounge.html's scene code (terrain, peaks, hills, shrubs, lake, set, shadelings; same stream),
//     so the last frame is the lounge's opening frame: camera (0, 1.5, 6.6) looking at (0, 2.05, -3), fov 52.
//   * Between them, a rising painted wipe: both scenes render, mix in linear HDR under a torn fbm front that climbs the
//     frame, and the mix goes through the one gouache post, so the meadow is painted over the pleats.
//
// The two world files are NEVER edited; this file copies their code (marked [bridge] where the plumbing differs).
// Parent side: createLandingBridge(). Inside the iframe: runBridge(). docs/act3.md has the timeline and API.

const HERE = import.meta.url;
const abs = p => new URL(p, HERE).href;

export const BRIDGE = {
  T: 10.6,            // s, the whole dive (Plissé pose at 0, lounge opening frame at T)
  plisseEnd: 7.6,     // Plissé camera path [0, 7.6]
  wipe: [5.0, 7.4],   // the painted wipe: Plissé -> lounge
  loungeFrom: 4.6,    // lounge camera path [4.6, T]
  ring: { theta: -0.0180, phi: 1.3512, radius: 14 }  // her closest view facing the dusk ring: facingRing({ lat: 0.1 })
};

// The orbit pose (OrbitControls theta/phi round the origin) facing the dusk ring, nearest to a given one: her star axis
// A = (-1, .16, .05); the ring is the great circle normal to A. lat lifts it toward the day side (rad): head-on, the
// ring is her terminator and reads near-black at 14; at lat .1 the lit olive edge, where most walkers are, is centred.
export function facingRing({ theta = Math.atan2(7, 41), phi = Math.acos(8 / Math.hypot(7, 8, 41)), lat = 0.1 } = {}) {
  const l = Math.hypot(-1, 0.16, 0.05), A = [-1 / l, 0.16 / l, 0.05 / l];
  const d = [Math.sin(phi) * Math.sin(theta), Math.cos(phi), Math.sin(phi) * Math.cos(theta)];
  const k = d[0] * A[0] + d[1] * A[1] + d[2] * A[2];
  const n = [d[0] - k * A[0], d[1] - k * A[1], d[2] - k * A[2]], m = Math.hypot(...n);
  const v = n.map((x, i) => x / m * Math.cos(lat) + A[i] * Math.sin(lat));
  return { theta: Math.atan2(v[0], v[2]), phi: Math.acos(v[1]) };
}

// ---------------------------------------------------------------- parent side ----------------------------------------------------------------
// const bridge = createLandingBridge({ container, zIndex, golden });  await bridge.ready();
// bridge.start({ theta, phi, radius })            the Plissé pose the dive starts from (her driver's cameraNow())
// bridge.syncClock({ sceneTime, walkTime })       her clocks right now (driver.sceneTime(), driver.walkTime())
// bridge.play(dir = 1) -> Promise                 dir 1: t 0 -> T (the landing); dir -1: T -> 0 (rising home)
// bridge.hold(t) / bridge.hold(null)              freeze on t (stills, tests)
// bridge.follow(fn | null)                        fn() each bridge frame -> { clock, pose? }: her clocks (and live pose,
//                                                 holding t = 0) read in the bridge's own frame, for a cut that matches
// bridge.pause(on)                                stop the loop while hidden (it starts paused after its warm-up); bridge.setOpacity(v); bridge.setGolden(on)
// bridge.state() -> { t, mix, playing, synced, ... }; bridge.el (the iframe); bridge.destroy()
export function createLandingBridge({ container = document.body, zIndex = 32, golden = false, log = null } = {}) {
  const iframe = document.createElement('iframe');
  iframe.id = 'landing-bridge'; iframe.title = 'The landing'; iframe.setAttribute('aria-hidden', 'true'); iframe.setAttribute('tabindex', '-1');
  Object.assign(iframe.style, { position: 'fixed', inset: '0', width: '100%', height: '100%', border: '0', opacity: '0', pointerEvents: 'none', zIndex: String(zIndex), background: '#121834' });
  iframe.srcdoc = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<style>html,body{margin:0;height:100%;overflow:hidden;background:#121834}canvas{position:fixed;inset:0;width:100%;height:100%;display:block}</style></head>
<body><canvas id="c"></canvas>
<script src="${abs('../../worlds/vendor/three@0.147.0/build/three.min.js')}"></script>
<script src="${abs('../../worlds/vendor/three@0.147.0/examples/js/objects/Reflector.js')}"></script>
<script type="module">import { runBridge } from '${HERE}'; runBridge({ golden: ${!!golden} });</script></body></html>`;
  container.appendChild(iframe);
  let B = null;
  const readyP = new Promise((res, rej) => {
    const t0 = performance.now();
    (function poll() {
      const w = iframe.contentWindow;
      if (w && w.__bridgeError) return rej(new Error('bridge: ' + w.__bridgeError));
      if (w && w.__bridge && w.__bridge.isReady()) { B = w.__bridge; if (log) log('bridge ready', Math.round(performance.now() - t0), 'ms'); return res(api); }
      if (performance.now() - t0 > 90000) return rej(new Error('bridge: not ready after 90 s'));
      setTimeout(poll, 40);
    })();
  });
  const need = () => { if (!B) throw new Error('bridge: not ready'); return B; };
  const api = {
    el: iframe,
    ready: () => readyP,
    isReady: () => !!B,
    setOpacity(v) { iframe.style.opacity = String(v); },
    start(pose) { return need().start(pose); },
    syncClock(c) { return need().syncClock(c); },
    play(dir = 1, opts) { return need().play(dir, opts); },
    hold(t) { return need().hold(t); },
    follow(fn) { return need().follow(fn); },   // fn() -> { clock: { sceneTime, walkTime }, pose?: { theta, phi, radius } }, each bridge frame
    pause(on = true) { return need().pause(on); },
    setGolden(on) { return need().setGolden(on); },
    state() { return B ? B.state() : { ready: false }; },
    get t() { return B ? B.state().t : 0; },
    destroy() { try { if (B) B.pause(true); } catch (e) { /* gone */ } iframe.remove(); B = null; }
  };
  return api;
}

// ---------------------------------------------------------------- inside the iframe ----------------------------------------------------------------
export function runBridge({ golden = false } = {}) {
  try { build(golden); } catch (e) { window.__bridgeError = String(e && e.message || e); throw e; }
}

function build(golden) {
  'use strict';
  THREE.ColorManagement.legacyMode = false;
  const canvas = document.getElementById('c');
  // the worlds' renderer, as both set it up (the lounge adds shadows; no light in Plissé casts, so her frame is unchanged)
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const PL = buildPlisse(renderer);
  const LO = buildLounge(renderer);
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const smooth = (a, b, x) => { let t = (x - a) / (b - a); t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); };

  /* ================= the shared gouache post: plisse.html 349-533 = lounge.html 780-965, VERBATIM ================= */
  /* ---------- gouache post pass ----------
     scene -> HDR target -> sRGB -> structure tensor (edge flow)
     -> anisotropic Kuwahara (flat, directional paint dabs)
     -> composite: wobbly edges, pigment pooling at edges, brush streaks, dry-brush, paper tooth */
  let gouache = true;
  const isGL2 = renderer.capabilities.isWebGL2;
  const rtScene = new THREE.WebGLRenderTarget(1, 1, { type: isGL2 ? THREE.HalfFloatType : THREE.UnsignedByteType, samples: isGL2 ? 4 : 0 });
  const rtLDR = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: false });
  const rtTensor = new THREE.WebGLRenderTarget(1, 1, { type: isGL2 ? THREE.HalfFloatType : THREE.UnsignedByteType, depthBuffer: false });
  const rtPaint = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: false });
  const fsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const fsGeo = new THREE.PlaneGeometry(2, 2);
  const VS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
  const NOISE = `
    float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
    float vn(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y); }
    float fbm2(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++){ s += a * vn(p); p = p * 2.03 + 7.1; a *= 0.5; } return s; }
    float luma(vec3 c){ return dot(c, vec3(0.299, 0.587, 0.114)); }`;
  function pass(frag, uniforms) {
    const mat = new THREE.ShaderMaterial({ uniforms, vertexShader: VS, fragmentShader: frag, depthTest: false, depthWrite: false });
    const sc = new THREE.Scene(); sc.add(new THREE.Mesh(fsGeo, mat));
    return { u: mat.uniforms, run(target) { renderer.setRenderTarget(target); renderer.render(sc, fsCam); } };
  }

  const ldrPass = pass(`
    uniform sampler2D tSrc; varying vec2 vUv;
    vec3 toSRGB(vec3 c){ c = max(c, 0.0); return mix(c * 12.92, pow(c, vec3(1.0 / 2.4)) * 1.055 - 0.055, step(0.0031308, c)); }
    void main(){ gl_FragColor = vec4(toSRGB(texture2D(tSrc, vUv).rgb), 1.0); }`,
    { tSrc: { value: rtScene.texture } });

  const tensorPass = pass(`
    uniform sampler2D tSrc; uniform vec2 px; varying vec2 vUv;
    vec3 at(float x, float y){ return texture2D(tSrc, vUv + vec2(x, y) * px).rgb; }
    void main(){
      vec3 gx = (-at(-1.,-1.) - 2.0*at(-1.,0.) - at(-1.,1.) + at(1.,-1.) + 2.0*at(1.,0.) + at(1.,1.)) * 0.25;
      vec3 gy = (-at(-1.,-1.) - 2.0*at(0.,-1.) - at(1.,-1.) + at(-1.,1.) + 2.0*at(0.,1.) + at(1.,1.)) * 0.25;
      gl_FragColor = vec4(dot(gx, gx), dot(gx, gy), dot(gy, gy), 1.0);
    }`,
    { tSrc: { value: rtLDR.texture }, px: { value: new THREE.Vector2() } });

  const paintPass = pass(`
    uniform sampler2D tSrc, tTensor; uniform vec2 px, tpx; uniform float radius;
    varying vec2 vUv;
    const int MAXR = 12;
    vec3 tensorAt(vec2 uv){
      vec2 o = tpx * 1.5;
      vec3 t = texture2D(tTensor, uv).xyz * 0.25;
      t += (texture2D(tTensor, uv + vec2(o.x, 0.)).xyz + texture2D(tTensor, uv - vec2(o.x, 0.)).xyz
          + texture2D(tTensor, uv + vec2(0., o.y)).xyz + texture2D(tTensor, uv - vec2(0., o.y)).xyz) * 0.125;
      t += (texture2D(tTensor, uv + o).xyz + texture2D(tTensor, uv - o).xyz
          + texture2D(tTensor, uv + vec2(o.x, -o.y)).xyz + texture2D(tTensor, uv + vec2(-o.x, o.y)).xyz) * 0.0625;
      return t;
    }
    void main(){
      vec3 T = tensorAt(vUv);
      float E = T.x, F = T.y, G = T.z;
      float D = sqrt((E - G) * (E - G) + 4.0 * F * F);
      float l1 = 0.5 * (E + G + D), l2 = 0.5 * (E + G - D);
      vec2 t = vec2(l1 - E, -F);
      t = length(t) > 1e-7 ? normalize(t) : vec2(0.0, 1.0);
      float phi = atan(t.y, t.x);
      float A = (l1 + l2 > 1e-7) ? (l1 - l2) / (l1 + l2) : 0.0;
      float a = radius * clamp(1.0 + A, 0.1, 2.0);
      float b = radius * clamp(1.0 / (1.0 + A), 0.1, 2.0);
      float cp = cos(phi), sp = sin(phi);
      mat2 SR = mat2(0.5 / a, 0.0, 0.0, 0.5 / b) * mat2(cp, -sp, sp, cp);
      int mx = int(sqrt(a * a * cp * cp + b * b * sp * sp));
      int my = int(sqrt(a * a * sp * sp + b * b * cp * cp));
      vec4 m[8]; vec3 s[8];
      for (int k = 0; k < 8; k++) { m[k] = vec4(0.0); s[k] = vec3(0.0); }
      float zeta = 1.0 / radius * 2.0;
      float zc = 0.58;
      float eta = (zeta + cos(zc)) / (sin(zc) * sin(zc));
      for (int j = -MAXR; j <= MAXR; j++) {
        if (j < -my || j > my) continue;
        for (int i = -MAXR; i <= MAXR; i++) {
          if (i < -mx || i > mx) continue;
          vec2 v = SR * vec2(float(i), float(j));
          if (dot(v, v) > 0.25) continue;
          vec3 c = texture2D(tSrc, vUv + vec2(float(i), float(j)) * px).rgb;
          vec3 cc = c * c;
          float w[8]; float sum = 0.0; float z, vxx, vyy;
          vxx = zeta - eta * v.x * v.x; vyy = zeta - eta * v.y * v.y;
          z = max(0.0,  v.y + vxx); w[0] = z * z; sum += w[0];
          z = max(0.0, -v.x + vyy); w[2] = z * z; sum += w[2];
          z = max(0.0, -v.y + vxx); w[4] = z * z; sum += w[4];
          z = max(0.0,  v.x + vyy); w[6] = z * z; sum += w[6];
          vec2 r = 0.70710678 * vec2(v.x - v.y, v.x + v.y);
          vxx = zeta - eta * r.x * r.x; vyy = zeta - eta * r.y * r.y;
          z = max(0.0,  r.y + vxx); w[1] = z * z; sum += w[1];
          z = max(0.0, -r.x + vyy); w[3] = z * z; sum += w[3];
          z = max(0.0, -r.y + vxx); w[5] = z * z; sum += w[5];
          z = max(0.0,  r.x + vyy); w[7] = z * z; sum += w[7];
          float g = exp(-3.125 * dot(v, v)) / max(sum, 1e-6);
          for (int k = 0; k < 8; k++) { float wk = w[k] * g; m[k] += vec4(c * wk, wk); s[k] += cc * wk; }
        }
      }
      vec4 o = vec4(0.0);
      for (int k = 0; k < 8; k++) {
        if (m[k].w <= 0.0) continue;
        vec3 mu = m[k].rgb / m[k].w;
        vec3 sg = abs(s[k] / m[k].w - mu * mu);
        float sig2 = sg.r + sg.g + sg.b;
        float wk = 1.0 / (1.0 + pow(8.0 * 1000.0 * sig2, 4.0));
        o += vec4(mu * wk, wk);
      }
      vec3 col = o.w > 1e-6 ? o.rgb / o.w : texture2D(tSrc, vUv).rgb;
      gl_FragColor = vec4(col, 1.0);
    }`,
    { tSrc: { value: rtLDR.texture }, tTensor: { value: rtTensor.texture }, px: { value: new THREE.Vector2() }, tpx: { value: new THREE.Vector2() }, radius: { value: 5 } });

  const compPass = pass(`
    uniform sampler2D tPaint, tTensor; uniform vec2 res, ppx; uniform float scale; uniform vec3 paper;
    varying vec2 vUv;
    ${NOISE}
    float tooth(vec2 p){ return fbm2(p * 0.22) * 0.8 + vn(p * 0.9) * 0.2; }
    void main(){
      vec2 p = vUv * res / scale;                       // css-pixel space, so texture scale ignores dpr
      vec2 wob = vec2(fbm2(p * 0.04), fbm2(p * 0.04 + 31.7)) - 0.5;
      vec2 uv = vUv + wob * ppx * 3.5;                  // hand-cut, wavering shape edges
      vec3 c = texture2D(tPaint, uv).rgb;

      vec2 e = ppx * 1.2;
      float lx = luma(texture2D(tPaint, uv + vec2(e.x, 0.)).rgb) - luma(texture2D(tPaint, uv - vec2(e.x, 0.)).rgb);
      float ly = luma(texture2D(tPaint, uv + vec2(0., e.y)).rgb) - luma(texture2D(tPaint, uv - vec2(0., e.y)).rgb);
      float edge = length(vec2(lx, ly));

      // brush direction: follow image structure, fall back to a loose diagonal in flat areas
      vec3 T = texture2D(tTensor, vUv).xyz;
      float E = T.x, F = T.y, G = T.z, D = sqrt((E - G) * (E - G) + 4.0 * F * F);
      float l1 = 0.5 * (E + G + D), l2 = 0.5 * (E + G - D);
      vec2 dir = vec2(l1 - E, -F); dir = length(dir) > 1e-7 ? normalize(dir) : vec2(1.0, 0.0);
      float coh = (l1 + l2) > 1e-7 ? (l1 - l2) / (l1 + l2) : 0.0;
      float ang = 0.65 + (fbm2(p * 0.005) - 0.5) * 1.8;
      vec2 dflat = vec2(cos(ang), sin(ang));
      if (dot(dir, dflat) < 0.0) dir = -dir;
      dir = normalize(mix(dflat, dir, smoothstep(0.1, 0.5, coh) * smoothstep(0.0004, 0.004, E + G)) + 1e-4);
      vec2 q = vec2(dot(p, dir), dot(p, vec2(-dir.y, dir.x)));
      float stroke = vn(q * vec2(0.035, 0.42)) * 0.6 + vn(q * vec2(0.08, 1.05) + 13.0) * 0.4;

      // gouache body: matte, opaque, a touch chalky, flatter values
      float L = luma(c);
      c = mix(vec3(L), c, 1.1);
      float bands = 8.0;
      float f = fract(L * bands);
      float Lq = (floor(L * bands) + smoothstep(0.3, 0.7, f)) / bands;
      c *= mix(1.0, Lq / max(L, 1e-3), 0.4);
      c = mix(c, c * 0.87 + vec3(0.07, 0.066, 0.06), 0.85);
      c *= 1.0 + (stroke - 0.5) * 0.14;

      // pigment gathers where one area meets another
      c = mix(c, c * c * 0.95, smoothstep(0.05, 0.22, edge) * 0.45);

      // dry brush: paper peeks through at stroke ends and edges
      float th = tooth(p);
      float dry = smoothstep(0.8, 0.95, th + (0.5 - stroke) * 0.5 + smoothstep(0.05, 0.22, edge) * 0.22);
      c = mix(c, paper, dry * 0.45);

      // paper tooth, lit from the top left
      float tx = tooth(p + vec2(1.0, 0.0)) - th, ty = tooth(p + vec2(0.0, 1.0)) - th;
      c *= 1.0 + (ty - tx) * 0.35;
      c += (hash(floor(p * 1.5)) - 0.5) * 0.008;

      vec2 vv = vUv - 0.5;
      c *= 1.0 - dot(vv, vv) * 0.22;
      gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
    }`,
    { tPaint: { value: rtPaint.texture }, tTensor: { value: rtTensor.texture }, res: { value: new THREE.Vector2() }, ppx: { value: new THREE.Vector2() }, scale: { value: 1 }, paper: { value: new THREE.Vector3(0.93, 0.9, 0.83) } });

  function sizePost(w, h) {
    const ps = Math.min(window.devicePixelRatio || 1, 1.25);
    const pw = Math.max(1, Math.round(w * ps)), ph = Math.max(1, Math.round(h * ps));
    rtScene.setSize(pw, ph); rtLDR.setSize(pw, ph); rtPaint.setSize(pw, ph);
    const tw = Math.max(1, Math.round(pw / 2)), th = Math.max(1, Math.round(ph / 2));
    rtTensor.setSize(tw, th);
    tensorPass.u.px.value.set(1 / pw, 1 / ph);
    paintPass.u.px.value.set(1 / pw, 1 / ph);
    paintPass.u.tpx.value.set(1 / tw, 1 / th);
    paintPass.u.radius.value = Math.min(5.2 * ps, 6.2);
    const r = renderer.getPixelRatio();
    compPass.u.res.value.set(w * r, h * r);
    compPass.u.scale.value = r;
    compPass.u.ppx.value.set(1 / pw, 1 / ph);
  }
  /* ================= end of the verbatim post ================= */

  // [bridge] the painted wipe: the lounge's HDR frame climbs over Plissé's under a torn fbm front, before the post,
  // so the gouache paints the seam as one picture. Its output feeds the verbatim ldrPass (only its input changes).
  const rtB = new THREE.WebGLRenderTarget(1, 1, { type: isGL2 ? THREE.HalfFloatType : THREE.UnsignedByteType, samples: isGL2 ? 4 : 0 });
  const rtMix = new THREE.WebGLRenderTarget(1, 1, { type: isGL2 ? THREE.HalfFloatType : THREE.UnsignedByteType, depthBuffer: false });
  const mixPass = pass(`
    uniform sampler2D tA, tB; uniform float prog, soft, aspect; varying vec2 vUv;
    ${NOISE}
    void main(){
      vec2 p = vec2(vUv.x * aspect, vUv.y);
      float front = vUv.y * 0.95 + fbm2(p * 3.1 + 4.0) * 0.5 + fbm2(p * 10.0 + 9.0) * 0.16;   // 0 .. ~1.6, bottom first
      float e = mix(-soft, 1.62 + soft, prog);
      float m = 1.0 - smoothstep(e - soft, e + soft, front);
      gl_FragColor = vec4(mix(texture2D(tA, vUv).rgb, texture2D(tB, vUv).rgb, m), 1.0);
    }`, { tA: { value: rtScene.texture }, tB: { value: rtB.texture }, prog: { value: 0 }, soft: { value: 0.07 }, aspect: { value: 1 } });

  const FOV_P = a => a < 1 ? Math.min(70, 38 / Math.pow(a, 0.7)) : 38;   // plisse.html resize()
  const FOV_L = a => a < 1 ? Math.min(80, 52 / Math.pow(a, 0.6)) : 52;   // lounge.html resize()
  let aspect = 1;
  function resize() {
    const w = innerWidth, h = innerHeight; aspect = w / h;
    renderer.setSize(w, h, false);
    PL.camera.aspect = LO.camera.aspect = aspect;
    const p = renderer.getPixelRatio();
    LO.water.getRenderTarget().setSize(Math.round(w * p * 0.6), Math.round(h * p * 0.6));
    sizePost(w, h);
    rtB.setSize(rtScene.width, rtScene.height); rtMix.setSize(rtScene.width, rtScene.height);
    mixPass.u.aspect.value = aspect;
    if (lastT != null) pose(lastT);
  }

  /* ---------------- the camera paths ---------------- */
  const BR = BRIDGE;
  const A = PL.A;                          // her star axis; the dusk ring is the great circle normal to it
  const RS = 10.25;                        // mean dusk-ring ground radius (pleats 10.0 .. 10.46): the dive's datum
  const H1 = 0.8;                          // lowest Plissé altitude over that datum (walkers stand 0.4-0.6 tall)
  const BETA = 0.2;                        // rad travelled along the ring (2 units of ground)
  const PITCH = 62 * Math.PI / 180;        // from straight down at her planet to 28 deg below the local horizon
  const LAT_END = 0.04;                     // where the dive levels out: just on the day side of the walkers' band centre
  const path = { N0: V3(0, 0, 1), R0: V3(0, 0, 1), T0: V3(0, 1, 0), U0: V3(0, 1, 0), lat0: 0, r0: 14, side: 0, set: false };
  // start({theta, phi, radius}): her camera, as her driver models it (OrbitControls round the origin, y up)
  function start({ theta = BR.ring.theta, phi = BR.ring.phi, radius = BR.ring.radius } = {}) {
    const N0 = V3(Math.sin(phi) * Math.sin(theta), Math.cos(phi), Math.sin(phi) * Math.cos(theta)).normalize();
    const f = N0.clone().negate();
    const U0 = V3(0, 1, 0).addScaledVector(f, -f.y).normalize();          // her screen-up (lookAt with up = y)
    const lat0 = Math.asin(clamp(N0.dot(A), -1, 1));
    const R0 = N0.clone().addScaledVector(A, -N0.dot(A)).normalize();     // the ring point under her camera
    const T0 = new THREE.Vector3().crossVectors(A, R0).normalize();       // ring tangent = the walkers' heading
    if (T0.dot(U0) < 0) T0.negate();                                       // fly toward her screen-up: the horizon rises at the top
    Object.assign(path, { N0, R0, T0, U0, lat0, r0: radius, set: true, side: 0 });
    // the hi-res ground patch is built once at load for the default ring pose; rebuilt (a short hitch) only if far off
    const c = plisseAt(0.85, {}).n;
    if (!PL.patchCentre || c.angleTo(PL.patchCentre) > 0.12) PL.buildPatch(c);
    path.side = chooseSide();
    lastT = null;
    return { ...path, N0: N0.toArray(), T0: T0.toArray(), U0: U0.toArray() };
  }
  const tmpQ = new THREE.Quaternion(), tmpN = new THREE.Vector3(), tmpT = new THREE.Vector3(), tmpF = new THREE.Vector3(), tmpU = new THREE.Vector3();
  const POSE = { n: V3(), pos: V3(), f: V3(), up: V3(), t: V3(), h: 0, lat: 0 };   // [perf] the per-frame pose, no allocations
  function plisseAt(e, out = POSE) {
    const { R0, T0, U0, r0, side, lat0 } = path;
    const g = Math.pow(e, 1.5);
    const lat = lat0 + (LAT_END + side - lat0) * smooth(0.1, 1, e);
    if (!out.n) { out.n = V3(); out.pos = V3(); out.f = V3(); out.up = V3(); out.t = V3(); }
    const n = out.n.copy(R0).multiplyScalar(Math.cos(BETA * g)).addScaledVector(T0, Math.sin(BETA * g))
      .multiplyScalar(Math.cos(lat)).addScaledVector(A, Math.sin(lat)).normalize();
    const h0 = r0 - RS, h = h0 * Math.pow(H1 / h0, e);
    out.h = h;
    out.pos.copy(n).multiplyScalar(RS + h);
    const p = PITCH * smooth(0.04, 1, e);
    // roll: from her screen-up to the ring's own heading over the first half of the dive
    const tRing = tmpT.crossVectors(A, n).normalize(); if (tRing.dot(T0) < 0) tRing.negate();
    const t = out.t.copy(U0).lerp(tRing, smooth(0, 0.55, e)); t.addScaledVector(n, -t.dot(n)).normalize();
    out.lat = lat;
    out.f.copy(n).multiplyScalar(-Math.cos(p)).addScaledVector(t, Math.sin(p));
    out.up.copy(n).multiplyScalar(Math.sin(p)).addScaledVector(t, Math.cos(p));
    return out;
  }
  // keep the low part of the path clear of the elder lanterns (they stand ~1.5 tall): slide it a little across the ring
  function chooseSide() {
    const tops = PL.elderSpots(walkNow());
    let best = 0, bestScore = -1e9;
    for (const s of [0, 0.03, -0.03, 0.06, -0.06, 0.09, -0.09, 0.12]) {
      path.side = s;
      let clear = 1e9;
      for (let i = 0; i <= 40; i++) {
        const P = plisseAt(0.45 + 0.55 * i / 40);
        for (const [base, top] of tops) clear = Math.min(clear, segDist(P.pos, base, top));
      }
      const score = Math.min(clear, 0.9) - Math.abs(s) * 2;
      if (score > bestScore) { bestScore = score; best = s; }
    }
    path.side = best;
    return best;
  }
  function segDist(p, a, b) {
    const ab = b.clone().sub(a), t = clamp(p.clone().sub(a).dot(ab) / ab.lengthSq(), 0, 1);
    return p.distanceTo(a.clone().addScaledVector(ab, t));
  }
  // the lounge: from high over the meadow, gliding down and levelling out onto her opening framing
  // high over the meadow looking steeply down at the red rug (the landing mark), so her lake (whose mirror shows the
  // peaks at any shallow angle) stays out of frame until the camera is low; the pitch-up comes last: the peaks rise
  const LB = [V3(-0.8, 24, 4.8), V3(-0.5, 8.5, 7.4), V3(-0.1, 2.9, 8.4), V3(0, 1.5, 6.6)];
  const LOOK_START = V3(0.2, 0, 1.2), LOOK_END = V3(0, 2.05, -3);
  const bezV = V3();
  function bez(s) {
    const a = 1 - s;
    return bezV.copy(LB[0]).multiplyScalar(a * a * a).addScaledVector(LB[1], 3 * a * a * s).addScaledVector(LB[2], 3 * a * s * s).addScaledVector(LB[3], s * s * s);
  }

  /* ---------------- the timeline: pose(t) sets everything from t alone ---------------- */
  let lastT = null, mixV = 0;
  function pose(t) {
    lastT = t;
    const fovP = FOV_P(aspect), fovL = FOV_L(aspect), k = smooth(3.5, BR.T - 0.6, t);
    const fov = fovP + (fovL - fovP) * k;
    // Plissé
    const u = clamp(t / BR.plisseEnd, 0, 1), ea = 0.22, e = u < ea ? u * u / (2 * ea) / (1 - ea / 2) : (u - ea / 2) / (1 - ea / 2);
    const P = plisseAt(e);
    const cam = PL.camera;
    cam.position.copy(P.pos); cam.up.copy(P.up); cam.lookAt(tmpF.copy(P.pos).add(P.f));
    cam.fov = fov; cam.near = P.h < 2.2 ? 0.02 : 0.1; cam.updateProjectionMatrix();
    PL.air(P.h);
    PL.fine(smooth(2.7, 1.3, P.h));
    // lounge
    // Hermite: leaves at speed V0 (the dive's momentum), lands at rest on her framing
    const tau = clamp((t - BR.loungeFrom) / (BR.T - BR.loungeFrom), 0, 1), V0 = 0.7, s = V0 * tau + (3 - 2 * V0) * tau * tau + (V0 - 2) * tau * tau * tau;
    const lc = LO.camera;
    lc.position.copy(bez(s));   // (bez returns a shared vector; copied here)
    // the eye stays on the rug while it comes down, then lifts to her target: the lake, the cones and the peaks rise
    lc.up.set(0, 1, 0); lc.lookAt(tmpF.copy(LOOK_START).lerp(LOOK_END, smooth(0.42, 1, s)));
    if (tau >= 1) { lc.position.copy(LB[3]); lc.lookAt(LOOK_END); }   // exactly her opening framing
    lc.fov = fov; lc.updateProjectionMatrix();
    mixV = smooth(BR.wipe[0], BR.wipe[1], t);
    return { t, e, h: P.h, tau, mix: mixV, fov };
  }

  /* ---------------- clocks ---------------- */
  // Plissé: her scene clock (moons, wobble, legs) and her walk clock (the walkers' longitude), from her driver
  let sceneBase = 0, walkBase = 0, syncAt = performance.now(), synced = false;
  const sceneNow = () => sceneBase + (performance.now() - syncAt) / 1000;
  function walkNow() { return walkBase + (performance.now() - syncAt) / 1000; }
  function syncClock({ sceneTime = null, walkTime = null } = {}) {
    if (sceneTime == null) return false;
    sceneBase = sceneTime; walkBase = walkTime != null ? walkTime : sceneTime; syncAt = performance.now(); synced = true;
    return true;
  }

  /* ---------------- render ---------------- */
  function render() {
    const needA = mixV < 1, needB = mixV > 0;
    if (needA) { renderer.toneMappingExposure = 1.0; renderer.setRenderTarget(rtScene); renderer.render(PL.scene, PL.camera); }
    if (needB) { renderer.toneMappingExposure = LO.exposure.value; renderer.setRenderTarget(needA ? rtB : rtScene); renderer.render(LO.scene, LO.camera); }
    if (needA && needB) { mixPass.u.prog.value = mixV; mixPass.run(rtMix); ldrPass.u.tSrc.value = rtMix.texture; }
    else ldrPass.u.tSrc.value = rtScene.texture;
    ldrPass.run(rtLDR);
    tensorPass.run(rtTensor);
    paintPass.run(rtPaint);
    compPass.run(null);
    renderer.toneMappingExposure = 1.0;
  }

  /* ---------------- playback ---------------- */
  let t = 0, dir = 0, playFrom = 0, playAt = 0, holdT = null, paused = false, done = null, gateWait = false, follow = null;
  function play(d = 1, { from = null } = {}) {
    dir = d >= 0 ? 1 : -1;
    t = from != null ? from : (dir > 0 ? 0 : BR.T);
    playFrom = t; playAt = performance.now(); gateWait = false;
    return new Promise(res => { done = res; });
  }
  function hold(v) { holdT = v == null ? null : clamp(+v, 0, BR.T); if (holdT == null) { playFrom = t; playAt = performance.now(); } return holdT; }

  resize();
  addEventListener('resize', resize);
  start();
  pose(0);
  LO.setMode(golden ? 1 : 0);
  // compile every shader now, so no cut ever waits on a compile
  renderer.compile(PL.scene, PL.camera); renderer.compile(LO.scene, LO.camera);
  mixV = 0.5; render(); mixV = 0;

  const clock = new THREE.Clock();
  let frames = 0, firstAt = 0, looping = false;
  // [bridge, perf] the loop runs only while the bridge may be seen: pause(true) stops it altogether (no rAF, no JS, no
  // GPU), pause(false) restarts it. The bridge starts PAUSED after its warm-up frames (it waited at opacity 0 before,
  // painting a whole hidden pipeline every frame from page load); the lab / stages call pause(false) at the dive.
  function setLoop(on) { if (on === looping) return; looping = on; renderer.setAnimationLoop(on ? frame : null); if (on) clock.getDelta(); }
  function frame() {
    const dt = Math.min(clock.getDelta(), 0.05);
    if (dir && holdT == null && !gateWait) {
      let nt = playFrom + dir * (performance.now() - playAt) / 1000;
      // rising home: don't uncover Plissé before her clocks are known
      if (dir < 0 && !synced && nt < BR.wipe[1] + 0.05) { gateWait = true; nt = BR.wipe[1] + 0.05; }
      t = clamp(nt, 0, BR.T);
      if ((dir > 0 && t >= BR.T) || (dir < 0 && t <= 0)) { dir = 0; const r = done; done = null; if (r) r(t); }
    } else if (gateWait && synced) { gateWait = false; playFrom = t; playAt = performance.now(); }
    if (paused) return;
    // follow(fn): read her clocks (and, while her camera is still moving, her pose) in OUR frame callback, which runs
    // after the parent's (where her driver dispatches its gesture steps), so both frames draw the same instant
    if (follow) {
      let f = null; try { f = follow(); } catch (e) { f = null; }
      if (f && f.clock) syncClock(f.clock);
      if (f && f.pose) { start(f.pose); holdT = 0; }
    }
    const tt = holdT != null ? holdT : t;
    pose(tt);
    // [bridge, perf] only the scene(s) this frame draws are stepped: Plissé's folk are placed from the clocks (no state
    // is lost while it rests); the lounge's shadelings simply pause in time while the pleats alone are on screen
    if (mixV < 1) PL.update(dt, sceneNow(), walkNow());
    if (mixV > 0) LO.update(dt);
    render();
    frames++; if (frames === 1) firstAt = performance.now();
  }
  // warm-up: two frames (shaders compiled above, both scenes drawn once), then the loop rests until pause(false)
  frame(); frame();
  paused = true;

  window.__bridge = {
    isReady: () => frames > 1,
    start, syncClock, play, hold,
    follow(fn) { follow = typeof fn === 'function' ? fn : null; return !!follow; },
    pause(on = true) { paused = !!on; setLoop(!paused); return paused; },
    setGolden(on) { LO.setMode(on ? 1 : 0); return !!on; },
    pose,
    state: () => ({ ready: frames > 1, t: holdT != null ? holdT : t, playing: dir, held: holdT != null, paused, looping, synced, gateWait, mix: mixV,
      side: path.side, sceneTime: sceneNow(), walkTime: walkNow(), frames, draws: renderer.info.render.calls, pixelRatio: renderer.getPixelRatio(),
      targets: { scene: [rtScene.width, rtScene.height], paint: [rtPaint.width, rtPaint.height], tensor: [rtTensor.width, rtTensor.height], water: [LO.water.getRenderTarget().width, LO.water.getRenderTarget().height] },
      plisse: { pos: PL.camera.position.toArray(), fov: PL.camera.fov }, lounge: { pos: LO.camera.position.toArray(), fov: LO.camera.fov, exposure: LO.exposure.value } })
  };
}

/* =============================================================================================================
   Plissé, copied from web/worlds/plisse.html (lines 98-114, 126-134, 136-347). [bridge] marks plumbing changes.
   ============================================================================================================= */
function buildPlisse(renderer) {
    function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
    const rand = mulberry32(11);
    const rr = (a, b) => a + (b - a) * rand();
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
    const C = hex => new THREE.Color(hex);
    function canvasTex(size, draw, srgb) {
      const cv = document.createElement('canvas'); cv.width = cv.height = size;
      const ctx = cv.getContext('2d'); draw(ctx, size);
      const t = new THREE.CanvasTexture(cv);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.anisotropy = renderer.capabilities.getMaxAnisotropy();
      if (srgb) t.encoding = THREE.sRGBEncoding;
      return t;
    }
    const scene = new THREE.Scene();
    scene.background = C('#121834');
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 3000);
    camera.position.set(7, 8, 41);
    // [bridge] no OrbitControls: the bridge sets this camera from her driver's model, then flies it
    scene.fog = new THREE.FogExp2(C('#2a2f5c'), 0);   // [bridge] the air thickening on the way down; density 0 = her frame exactly

    /* ---------- the star ----------
       Plissé is tidally locked: one face always to its star. Its lantern axis points straight
       at the star, so the day side is one end of the lantern, the night side the other, and
       the widest band of the lantern — the "waist" — is a permanent ring of dusk. */
    const SUN = new THREE.Vector3(-1, 0.16, 0.05).normalize();
    const sun = new THREE.DirectionalLight(C('#ffe2b0'), 1.25);
    sun.position.copy(SUN).multiplyScalar(60); scene.add(sun);
    scene.add(new THREE.HemisphereLight(C('#4a5694'), C('#140f1c'), 0.32));
    {
      const disc = new THREE.Mesh(new THREE.SphereGeometry(16, 32, 16), new THREE.MeshBasicMaterial({ color: C('#fff0c6') }));
      disc.position.copy(SUN).multiplyScalar(420); scene.add(disc);
      const haloTex = canvasTex(256, (ctx, s) => {
        const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
        g.addColorStop(0, 'rgba(255,226,170,0.9)'); g.addColorStop(0.25, 'rgba(255,190,110,0.35)'); g.addColorStop(1, 'rgba(255,160,90,0)');
        ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
      }, true);
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
      halo.position.copy(disc.position); halo.scale.setScalar(260); scene.add(halo);
    }
    // painted stars
    for (const [count, size, col] of [[900, 2.2, '#efe6cc'], [220, 3.6, '#f6e7b8'], [60, 5, '#ffffff']]) {
      const p = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) { const v = new THREE.Vector3(rr(-1, 1), rr(-1, 1), rr(-1, 1)).normalize().multiplyScalar(900); p.set([v.x, v.y, v.z], i * 3); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3));
      scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: C(col), size, sizeAttenuation: false })));
    }

    /* ---------- the planet: a folded paper lantern the size of a world ---------- */
    const R = 10, N_PLEATS = 46;
    const A = SUN.clone();
    const B = new THREE.Vector3().crossVectors(A, new THREE.Vector3(0, 1, 0)).normalize();
    const Cc = new THREE.Vector3().crossVectors(A, B).normalize();
    const tri = x => 1 - Math.abs(2 * (x - Math.floor(x)) - 1);
    function surf(n) {
      const lat = Math.asin(Math.max(-1, Math.min(1, n.dot(A))));
      const lon = Math.atan2(n.dot(Cc), n.dot(B));
      const t = tri(lon / (Math.PI * 2) * N_PLEATS);
      const fold = t * t * (3 - 2 * t);
      const band = Math.pow(Math.cos(lat), 0.6);
      const big = fbm(n.x * 1.6 + 3, n.y * 1.6, n.z * 1.6, 3);
      let r = 1 + 0.032 * fold * band * (0.55 + 0.9 * big) + 0.014 * (fbm(n.x * 4, n.y * 4, n.z * 4, 3) - 0.5);
      // the wire ribs of the lantern
      const rib = l => Math.exp(-Math.pow((lat - l) / 0.022, 2));
      r += 0.011 * (rib(0.95) + rib(-0.95));
      // flat end caps
      r += 0.018 * smooth(1.2, 1.24, Math.abs(lat));
      return { r: R * r, lat, lon, fold, big };
    }
    {
      const geo = new THREE.SphereGeometry(1, 368, 200);
      geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), A));
      const pos = geo.attributes.position, n = new THREE.Vector3();
      const col = new Float32Array(pos.count * 3), glow = new Float32Array(pos.count);
      const cream = C('#d9ceb0'), creamWarm = C('#dcbf84'), olive = C('#6f7f2f'), oliveD = C('#4e5e22'), mustard = C('#e2b13c'), pool = C('#2b4844'),
        navy = C('#273058'), navyL = C('#36407a'), red = C('#b8432a'), c = new THREE.Color(), d = new THREE.Color();
      for (let i = 0; i < pos.count; i++) {
        n.fromBufferAttribute(pos, i).normalize();
        const s = surf(n);
        pos.setXYZ(i, n.x * s.r, n.y * s.r, n.z * s.r);
        const day = smooth(0.12, 0.42, s.lat), night = smooth(-0.1, -0.42, s.lat), dusk = Math.max(0, 1 - day - night);
        const m = fbm(n.x * 7, n.y * 7, n.z * 7, 3);
        c.copy(cream).lerp(creamWarm, smooth(0.9, 1.4, s.lat) * 0.8 + (m - 0.5) * 0.3).multiplyScalar(day);
        d.copy(oliveD).lerp(olive, m).lerp(mustard, smooth(0.62, 0.72, fbm(n.x * 11 + 4, n.y * 11, n.z * 11, 2)) * 0.85);
        if (s.fold < 0.14 && s.big > 0.52) d.lerp(pool, 0.85);
        c.add(d.multiplyScalar(dusk));
        d.copy(navy).lerp(navyL, s.fold * 0.6); c.add(d.multiplyScalar(night));
        const ribs = Math.exp(-Math.pow((s.lat - 0.95) / 0.03, 2)) + Math.exp(-Math.pow((s.lat + 0.95) / 0.03, 2)) + smooth(1.2, 1.23, Math.abs(s.lat));
        c.lerp(red, Math.min(1, ribs));
        col.set([c.r, c.g, c.b], i * 3);
        // light leaking through the paper on the night side: strongest in the folds and at the far cap
        let g = night * Math.pow(1 - s.fold, 4) * (0.2 + 0.8 * smooth(0.35, 0.7, s.big)) * 0.4;
        g += smooth(-1.18, -1.32, s.lat) * 1.1;
        g += dusk * smooth(0.82, 0.92, vnoise(n.x * 18, n.y * 18, n.z * 18)) * 0.8 * smooth(0.06, -0.08, s.lat);
        glow[i] = g;
      }
      // close the seam
      geo.computeVertexNormals();
      const nr = geo.attributes.normal, W = 369;
      for (let row = 0; row <= 200; row++) {
        const a = row * W, b = a + 368;
        for (let k = 0; k < 3; k++) { const v = (nr.array[a * 3 + k] + nr.array[b * 3 + k]) / 2; nr.array[a * 3 + k] = nr.array[b * 3 + k] = v; }
      }
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      geo.setAttribute('glow', new THREE.BufferAttribute(glow, 1));
      const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92 });
      var glowUniform = { value: 0.8 };
      mat.onBeforeCompile = sh => {
        sh.uniforms.glowAmt = glowUniform;
        sh.vertexShader = 'attribute float glow;\nvarying float vGlow;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vGlow = glow;');
        sh.fragmentShader = 'uniform float glowAmt;\nvarying float vGlow;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n  totalEmissiveRadiance += vec3(1.0, 0.5, 0.18) * vGlow * glowAmt;');
      };
      scene.add(new THREE.Mesh(geo, mat));
      var planetMat = mat;   // [bridge]
    }
    // thin warm atmosphere, brightest along the dusk ring
    const atmo = new THREE.Mesh(new THREE.SphereGeometry(R * 1.07, 96, 64), new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { sunDir: { value: SUN }, camPos: { value: camera.position }, uFade: { value: 1 } },
      vertexShader: 'varying vec3 vN; varying vec3 vW; void main(){ vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
      fragmentShader: `uniform vec3 sunDir; uniform vec3 camPos; uniform float uFade; varying vec3 vN; varying vec3 vW;
        void main(){
          float f = 1.0 - max(dot(normalize(camPos - vW), vN), 0.0); f = pow(f, 2.6);
          float s = dot(vN, sunDir);
          vec3 col = mix(vec3(0.18, 0.22, 0.5), vec3(0.95, 0.85, 0.66), smoothstep(-0.25, 0.4, s));
          col = mix(col, vec3(1.0, 0.55, 0.28), exp(-pow(s * 4.0, 2.0)) * 0.9);
          gl_FragColor = vec4(col * f * (0.12 + 0.9 * smoothstep(-0.6, 0.15, s)) * uFade, 1.0);
        }`
    }));
    scene.add(atmo);

    /* ---------- moons: a pleated red one and a bead ---------- */
    const moons = [];
    {
      const g = new THREE.SphereGeometry(1, 96, 48), p = g.attributes.position, v = new THREE.Vector3();
      for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const l = Math.atan2(v.z, v.x); v.multiplyScalar(1 + 0.06 * tri(l / (Math.PI * 2) * 18) * Math.sqrt(Math.max(0, 1 - v.y * v.y))); p.setXYZ(i, v.x, v.y, v.z); }
      g.computeVertexNormals();
      const m1 = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: C('#b8432a'), roughness: 0.85 })); m1.scale.setScalar(0.95); scene.add(m1);
      const m2 = new THREE.Mesh(new THREE.SphereGeometry(0.6, 32, 20), new THREE.MeshStandardMaterial({ color: C('#e2b13c'), roughness: 0.5, emissive: C('#ffc266'), emissiveIntensity: 0.15 })); scene.add(m2);
      moons.push({ m: m1, r: 19, speed: 0.045, inc: 0.32, ph: 0.8, spin: 0.2 }, { m: m2, r: 15.5, speed: 0.09, inc: -0.5, ph: 2.6, spin: 0 });
    }

    /* ---------- shadelings, at home ---------- */
    const SH_N = 190;
    const shBodyGeo = (() => {
      const g = new THREE.CylinderGeometry(0.052, 0.115, 0.17, 48, 3);
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), f = Math.abs(Math.cos(Math.atan2(z, x) * 14)); p.setX(i, x * (1 + 0.08 * f)); p.setZ(i, z * (1 + 0.08 * f)); }
      g.computeVertexNormals(); g.translate(0, 0.085, 0); return g;
    })();
    const shCapGeo = new THREE.SphereGeometry(0.056, 16, 6, 0, Math.PI * 2, 0, Math.PI / 2);
    const shLegGeo = new THREE.CylinderGeometry(0.006, 0.011, 0.2, 5); shLegGeo.translate(0, -0.1, 0);
    const shAntGeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0.19, 0), new THREE.Vector3(0, 0.27, 0.01), new THREE.Vector3(0, 0.32, 0.05), new THREE.Vector3(0, 0.33, 0.09)]), 10, 0.004, 4);
    const shBeadGeo = new THREE.SphereGeometry(0.02, 10, 8);
    const palette = ['#e2b13c', '#b8432a', '#efe6cc', '#8a8f3a', '#3e4a78', '#e08a3a'].map(C);
    const dark = new THREE.MeshStandardMaterial({ color: C('#3a2418'), roughness: 0.6 });
    const beadMat = new THREE.MeshStandardMaterial({ color: C('#ffd68a'), emissive: C('#ffc266'), emissiveIntensity: 2.2, roughness: 0.4 });
    const parts = {
      body: new THREE.InstancedMesh(shBodyGeo, new THREE.MeshStandardMaterial({ roughness: 0.85 }), SH_N),
      cap: new THREE.InstancedMesh(shCapGeo, new THREE.MeshStandardMaterial({ color: C('#f3ecd8'), roughness: 0.6 }), SH_N),
      ant: new THREE.InstancedMesh(shAntGeo, dark, SH_N),
      bead: new THREE.InstancedMesh(shBeadGeo, beadMat, SH_N),
      legL: new THREE.InstancedMesh(shLegGeo, dark, SH_N),
      legR: new THREE.InstancedMesh(shLegGeo, dark, SH_N)
    };
    Object.values(parts).forEach(m => { m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.frustumCulled = false; scene.add(m); });
    const walkers = [];
    for (let i = 0; i < SH_N; i++) {
      walkers.push({ lat: (rand() + rand() - 1) * 0.14 + 0.01, lon: rr(-Math.PI, Math.PI), w: rr(0.006, 0.013), ph: rr(0, 6), wob: rr(0.5, 1.2), k: rr(0.75, 1.1) });
      parts.body.setColorAt(i, palette[i % palette.length]);
    }
    // elder lanterns: tall, slow, the landmarks of the dusk ring
    const elders = [];
    for (let i = 0; i < 7; i++) {
      const g = new THREE.Group();
      const body = new THREE.Mesh(shBodyGeo, new THREE.MeshStandardMaterial({ color: palette[(i * 2) % 6], roughness: 0.85 })); body.scale.y = 2.4; body.position.y = 0.2; g.add(body);
      const cap = new THREE.Mesh(shCapGeo, parts.cap.material); cap.position.y = 0.2 + 0.17 * 2.4; g.add(cap);
      const ant = new THREE.Mesh(shAntGeo, dark); ant.position.y = 0.2 + 0.17 * 2.4 - 0.19; g.add(ant);
      const bead = new THREE.Mesh(shBeadGeo, beadMat); bead.position.set(0, 0.2 + 0.17 * 2.4 - 0.19 + 0.33, 0.09); bead.scale.setScalar(1.4); g.add(bead);
      for (const sx of [-1, 1]) { const l = new THREE.Mesh(shLegGeo, dark); l.position.set(0.035 * sx, 0.2, 0); g.add(l); }
      g.scale.setScalar(rr(2.2, 2.9));
      scene.add(g);
      elders.push({ g, lat: rr(-0.06, 0.08), lon: -Math.PI + i * (Math.PI * 2 / 7) + rr(-0.2, 0.2), ph: rr(0, 6) });
    }

    const eul = new THREE.Euler(), mBody = new THREE.Matrix4();
    const vN = new THREE.Vector3(), vF = new THREE.Vector3(), vX = new THREE.Vector3(), mB = new THREE.Matrix4(), mP = new THREE.Matrix4(), mT = new THREE.Matrix4(), qB = new THREE.Quaternion(), vS = new THREE.Vector3(), vP = new THREE.Vector3();
    function placeOnSurface(lat, lon, out) {
      vN.copy(A).multiplyScalar(Math.sin(lat)).addScaledVector(B, Math.cos(lat) * Math.cos(lon)).addScaledVector(Cc, Math.cos(lat) * Math.sin(lon)).normalize();
      vF.copy(B).multiplyScalar(-Math.sin(lon)).addScaledVector(Cc, Math.cos(lon)).normalize();
      vX.crossVectors(vN, vF).normalize();
      out.makeBasis(vX, vN, vF);
      const r = surf(vN).r;   // [bridge, perf] hers calls surf() three times here; the same number once
      out.setPosition(vN.x * r, vN.y * r, vN.z * r);
      return out;
    }
    function setPart(mesh, i, base, x, y, z, rx, rz, sx = 1, sy = 1, sz = 1) {
      mT.makeRotationFromEuler(eul.set(rx, 0, rz)); mT.scale(vS.set(sx, sy, sz)); mT.setPosition(x, y, z);
      mP.multiplyMatrices(base, mT); mesh.setMatrixAt(i, mP);
    }
    function updateWalkers(dt, time, walkT) {   // [bridge] walkT: her walk clock
      for (let i = 0; i < SH_N; i++) {
        const w = walkers[i];
        w.lon = w.lon0 + w.w * walkT;   // [bridge] = her w.lon += w.w * dt, summed
        const lat = w.lat + Math.sin(time * 0.15 * w.wob + w.ph) * 0.012;
        placeOnSurface(lat, w.lon, mB);
        mB.scale(vS.set(w.k, w.k, w.k));
        const st = time * 5.5 * w.wob + w.ph, swing = Math.sin(st) * 0.5, bob = Math.abs(Math.cos(st)) * 0.018;
        mT.makeRotationFromEuler(eul.set(0.1, 0, Math.sin(st) * 0.08)); mT.setPosition(0, 0.2 + bob, 0); mBody.multiplyMatrices(mB, mT);
        parts.body.setMatrixAt(i, mBody);
        setPart(parts.cap, i, mBody, 0, 0.17, 0, 0, 0);
        setPart(parts.ant, i, mBody, 0, 0, 0, 0, 0);
        setPart(parts.bead, i, mBody, 0, 0.33, 0.09, 0, 0);
        setPart(parts.legL, i, mB, -0.035, 0.2 + bob, 0, swing, 0);
        setPart(parts.legR, i, mB, 0.035, 0.2 + bob, 0, -swing, 0);
      }
      Object.values(parts).forEach(m => { m.instanceMatrix.needsUpdate = true; });
      glowUniform.value = 0.8 + Math.sin(time * 0.55) * 0.12;
      for (const e of elders) {
        e.lon = e.lon0 + 0.0015 * walkT;   // [bridge]
        placeOnSurface(e.lat, e.lon, mB);
        mB.decompose(vP, qB, vS); e.g.position.copy(vP); e.g.quaternion.copy(qB);
        e.g.rotateZ(Math.sin(time * 0.4 + e.ph) * 0.03);
      }
    }

  // [bridge] start longitudes, so every walker / elder sits where hers does at her walk clock
  walkers.forEach(w => { w.lon0 = w.lon; });
  elders.forEach(e => { e.lon0 = e.lon; });

  // [bridge] a hi-res patch of the same surface round the landing site. Her sphere is 368x200: right from orbit, faceted
  // at walker height. Every patch vertex carries two versions: a sample of HER coarse mesh at that point (barycentric
  // on her triangle: position, normal, colour, glow), and the fine surface (same surf(), same per-vertex colour and glow).
  // uFine = 0 draws exactly her coarse surface (so the first frame is hers); it eases to 1 as the camera gets low.
  const PATCH = { n: 560, rho: 0.62 };
  let patchMesh = null, patchCentre = null;
  const patchU = { axis: { value: new THREE.Vector3(0, 0, 1) }, cosR: { value: 2 }, fine: { value: 0 } };
  const coarse = scene.children.find(o => o.isMesh && o.material === planetMat);
  const CG = coarse.geometry, CW = 368, CH = 200;
  const qInv = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), A).invert();
  const cP = CG.attributes.position.array, cN = CG.attributes.normal.array, cC = CG.attributes.color.array, cG = CG.attributes.glow.array;
  const loc = new THREE.Vector3();
  function coarseSample(n, k, P2, N2, C2, G2) {
    loc.copy(n).applyQuaternion(qInv);
    const th = Math.acos(Math.max(-1, Math.min(1, loc.y)));
    let ph = Math.atan2(loc.z, -loc.x); if (ph < 0) ph += Math.PI * 2;          // SphereGeometry: x = -cos(phi) sin(theta), z = sin(phi) sin(theta)
    const fx = ph / (Math.PI * 2) * CW, fy = th / Math.PI * CH;
    const ix = Math.min(CW - 1, Math.floor(fx)), iy = Math.min(CH - 1, Math.floor(fy)), sx = fx - ix, sy = fy - iy;
    const id = (x, y) => y * (CW + 1) + x;
    const a = id(ix + 1, iy), b = id(ix, iy), c = id(ix, iy + 1), d = id(ix + 1, iy + 1);
    let W;   // her quad (a, b, d) + (b, c, d)
    if ((sx >= sy && iy !== 0) || iy === CH - 1) W = [[a, sx - sy], [b, 1 - sx], [d, sy]];
    else W = [[b, 1 - sy], [c, sy - sx], [d, sx]];
    for (let q = 0; q < 3; q++) { P2[k * 3 + q] = 0; N2[k * 3 + q] = 0; C2[k * 3 + q] = 0; }
    G2[k] = 0;
    for (const [v, w] of W) {
      for (let q = 0; q < 3; q++) { P2[k * 3 + q] += cP[v * 3 + q] * w; N2[k * 3 + q] += cN[v * 3 + q] * w; C2[k * 3 + q] += cC[v * 3 + q] * w; }
      G2[k] += cG[v] * w;
    }
  }
  const patchMat = planetMat.clone();
  patchMat.onBeforeCompile = sh => {
    sh.uniforms.glowAmt = glowUniform; sh.uniforms.uFine = patchU.fine;
    sh.vertexShader = 'attribute float glow;\nvarying float vGlow;\nattribute vec3 pos2, nrm2, col2;\nattribute float glow2;\nuniform float uFine;\n' + sh.vertexShader
      .replace('#include <beginnormal_vertex>', 'vec3 objectNormal = normalize(mix(nrm2, normal, uFine));\n#ifdef USE_TANGENT\n  vec3 objectTangent = vec3( tangent.xyz );\n#endif')
      .replace('#include <begin_vertex>', 'vec3 transformed = mix(pos2, position, uFine);\n  vGlow = mix(glow2, glow, uFine);')
      .replace('#include <color_vertex>', '#include <color_vertex>\n  vColor = mix(col2, color, uFine);');
    sh.fragmentShader = 'uniform float glowAmt;\nvarying float vGlow;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n  totalEmissiveRadiance += vec3(1.0, 0.5, 0.18) * vGlow * glowAmt;');
  };
  patchMat.customProgramCacheKey = () => 'bridge-patch';
  function buildPatch(centre) {
    if (patchMesh) { scene.remove(patchMesh); patchMesh.geometry.dispose(); }
    const Nc = centre.clone().normalize();
    const E1 = new THREE.Vector3().crossVectors(Nc, Math.abs(Nc.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0)).normalize();
    const E2 = new THREE.Vector3().crossVectors(Nc, E1).normalize();
    const N = PATCH.n, ext = Math.tan(PATCH.rho), cnt = (N + 1) * (N + 1);
    const pos = new Float32Array(cnt * 3), col = new Float32Array(cnt * 3), glw = new Float32Array(cnt);
    const P2 = new Float32Array(cnt * 3), N2 = new Float32Array(cnt * 3), C2 = new Float32Array(cnt * 3), G2 = new Float32Array(cnt);
    const n = new THREE.Vector3();
    const cream = C('#d9ceb0'), creamWarm = C('#dcbf84'), olive = C('#6f7f2f'), oliveD = C('#4e5e22'), mustard = C('#e2b13c'), pool = C('#2b4844'),
      navy = C('#273058'), navyL = C('#36407a'), red = C('#b8432a'), c = new THREE.Color(), d = new THREE.Color();
    for (let i = 0, k = 0; i <= N; i++) for (let j = 0; j <= N; j++, k++) {
      n.copy(Nc).addScaledVector(E1, (j / N * 2 - 1) * ext).addScaledVector(E2, (i / N * 2 - 1) * ext).normalize();
      coarseSample(n, k, P2, N2, C2, G2);
      // --- her per-vertex loop (plisse.html 202-219), unchanged ---
      const s = surf(n);
      pos[k * 3] = n.x * s.r; pos[k * 3 + 1] = n.y * s.r; pos[k * 3 + 2] = n.z * s.r;
      const day = smooth(0.12, 0.42, s.lat), night = smooth(-0.1, -0.42, s.lat), dusk = Math.max(0, 1 - day - night);
      const m = fbm(n.x * 7, n.y * 7, n.z * 7, 3);
      c.copy(cream).lerp(creamWarm, smooth(0.9, 1.4, s.lat) * 0.8 + (m - 0.5) * 0.3).multiplyScalar(day);
      d.copy(oliveD).lerp(olive, m).lerp(mustard, smooth(0.62, 0.72, fbm(n.x * 11 + 4, n.y * 11, n.z * 11, 2)) * 0.85);
      if (s.fold < 0.14 && s.big > 0.52) d.lerp(pool, 0.85);
      c.add(d.multiplyScalar(dusk));
      d.copy(navy).lerp(navyL, s.fold * 0.6); c.add(d.multiplyScalar(night));
      const ribs = Math.exp(-Math.pow((s.lat - 0.95) / 0.03, 2)) + Math.exp(-Math.pow((s.lat + 0.95) / 0.03, 2)) + smooth(1.2, 1.23, Math.abs(s.lat));
      c.lerp(red, Math.min(1, ribs));
      col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b;
      let g = night * Math.pow(1 - s.fold, 4) * (0.2 + 0.8 * smooth(0.35, 0.7, s.big)) * 0.4;
      g += smooth(-1.18, -1.32, s.lat) * 1.1;
      g += dusk * smooth(0.82, 0.92, vnoise(n.x * 18, n.y * 18, n.z * 18)) * 0.8 * smooth(0.06, -0.08, s.lat);
      glw[k] = g;
    }
    const idx = new Uint32Array(N * N * 6);
    for (let i = 0, q = 0; i < N; i++) for (let j = 0; j < N; j++) {
      const a = i * (N + 1) + j, b = a + N + 1;
      idx[q++] = a; idx[q++] = a + 1; idx[q++] = b; idx[q++] = b; idx[q++] = a + 1; idx[q++] = b + 1;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('glow', new THREE.BufferAttribute(glw, 1));
    geo.setAttribute('pos2', new THREE.BufferAttribute(P2, 3));
    geo.setAttribute('nrm2', new THREE.BufferAttribute(N2, 3));
    geo.setAttribute('col2', new THREE.BufferAttribute(C2, 3));
    geo.setAttribute('glow2', new THREE.BufferAttribute(G2, 1));
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    geo.computeVertexNormals();
    // outward-facing (winding), so it lights like hers
    { const nr = geo.attributes.normal; const v = new THREE.Vector3(nr.getX(0), nr.getY(0), nr.getZ(0)), p0 = new THREE.Vector3(pos[0], pos[1], pos[2]);
      if (v.dot(p0) < 0) { for (let q = 0; q < idx.length; q += 3) { const tq = idx[q + 1]; idx[q + 1] = idx[q + 2]; idx[q + 2] = tq; } geo.index.needsUpdate = true; geo.computeVertexNormals(); } }
    patchMesh = new THREE.Mesh(geo, patchMat);
    patchMesh.frustumCulled = false;
    scene.add(patchMesh);
    patchU.axis.value.copy(Nc); patchU.cosR.value = Math.cos(PATCH.rho * 0.96);
    patchCentre = Nc.clone();
  }
  // her coarse sphere steps aside inside the patch (a discard on a clone of her material, for that mesh only)
  const coarseMat = planetMat.clone();
  coarseMat.onBeforeCompile = sh => {
    planetMat.onBeforeCompile(sh);
    sh.uniforms.pAxis = patchU.axis; sh.uniforms.pCos = patchU.cosR;
    sh.vertexShader = 'varying vec3 vOP;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vOP = position;');
    sh.fragmentShader = 'uniform vec3 pAxis; uniform float pCos; varying vec3 vOP;\n' + sh.fragmentShader.replace('void main() {', 'void main() {\n  if (dot(normalize(vOP), pAxis) > pCos) discard;');
  };
  coarseMat.customProgramCacheKey = () => 'bridge-coarse';
  coarse.material = coarseMat;
  const fine = k => { patchU.fine.value = k; };

  // [bridge] the air thickening on the way down: stars and the far limb fade into a dusk haze, her atmosphere shell
  // (which the camera passes through at 10.7) thins out, the space sky lifts a little toward the lounge's
  const bg0 = scene.background.clone(), bg1 = C('#232a52');
  function air(h) {
    const k = smooth(2.6, 0.9, h);
    scene.fog.density = 0.16 * k;
    scene.background.copy(bg0).lerp(bg1, k * 0.6);
    atmo.material.uniforms.uFade.value = smooth(0.95, 2.4, h);
  }
  function elderSpots(walkT) {
    const out = [], m = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
    for (const e of elders) {
      placeOnSurface(e.lat, e.lon0 + 0.0015 * walkT, m); m.decompose(p, q, s);
      const up = p.clone().normalize();
      out.push([p.clone(), p.clone().addScaledVector(up, 1.6)]);
    }
    return out;
  }
  function update(dt, time, walkT) {
    for (const m of moons) {
      const a = time * m.speed + m.ph;
      m.m.position.set(Math.cos(a) * m.r, Math.sin(a) * m.r * Math.sin(m.inc), Math.sin(a) * m.r * Math.cos(m.inc));
      m.m.rotation.y = time * m.spin;
    }
    updateWalkers(dt, time, walkT);
  }
  return { scene, camera, A, surf, update, air, fine, elderSpots, buildPatch, get patch() { return patchMesh; }, get patchCentre() { return patchCentre; } };
}

/* =============================================================================================================
   The Alpine lounge, copied from web/worlds/lounge.html (lines 91-107, 121-778). [bridge] marks plumbing changes.
   ============================================================================================================= */
function buildLounge(renderer) {
  const exposure = { value: 1 };   // [bridge] her renderer.toneMappingExposure, per scene
    function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
    const rand = mulberry32(11);
    const rr = (a, b) => a + (b - a) * rand();
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
    const C = hex => new THREE.Color(hex);
    const scene = new THREE.Scene();
    scene.background = C('#2e3a60');
    scene.fog = new THREE.Fog(C('#8e9ab3'), 180, 1100);

    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 2500);
    camera.position.set(0, 1.5, 6.6);
    camera.layers.enable(1); // layer 1 = grass + shrubs, skipped by the lake reflection for speed
    // [bridge] no OrbitControls; her opening view is camera (0, 1.5, 6.6) looking at her controls' target (0, 2.05, -3)
    camera.lookAt(0, 2.05, -3);

    /* ---------- lights ---------- */
    const hemi = new THREE.HemisphereLight(C('#d5dcf0'), C('#55602e'), 0.45);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight(C('#fff0dc'), 2.2);
    const sunTarget = new THREE.Object3D(); sunTarget.position.set(0, 0, 0.6); scene.add(sunTarget);
    sun.target = sunTarget;
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -5.5, right: 5.5, top: 5.5, bottom: -5.5, near: 1, far: 80 });
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.02;
    scene.add(sun);

    /* ---------- canvas textures ---------- */
    function canvasTex(size, draw, srgb) {
      const cv = document.createElement('canvas'); cv.width = cv.height = size;
      const ctx = cv.getContext('2d'); draw(ctx, size);
      const t = new THREE.CanvasTexture(cv);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.anisotropy = renderer.capabilities.getMaxAnisotropy();
      if (srgb) t.encoding = THREE.sRGBEncoding;
      return t;
    }
    const boucleBump = canvasTex(256, (ctx, s) => {
      ctx.fillStyle = '#808080'; ctx.fillRect(0, 0, s, s);
      for (let i = 0; i < 2600; i++) {
        const g = Math.floor(rr(60, 230));
        ctx.strokeStyle = `rgb(${g},${g},${g})`; ctx.lineWidth = rr(1.2, 2.6);
        const x = rr(0, s), y = rr(0, s), r = rr(1.2, 3.2);
        for (const [ox, oy] of [[0, 0], [s, 0], [-s, 0], [0, s], [0, -s]]) {
          ctx.beginPath(); ctx.arc(x + ox, y + oy, r, rr(0, 6.28), rr(3, 9)); ctx.stroke();
        }
      }
    });
    const boucleCol = canvasTex(256, (ctx, s) => {
      ctx.fillStyle = '#e6e6e6'; ctx.fillRect(0, 0, s, s);
      for (let i = 0; i < 2200; i++) {
        const g = Math.floor(rr(185, 255)); ctx.fillStyle = `rgb(${g},${g},${Math.floor(g * 0.96)})`;
        const x = rr(0, s), y = rr(0, s); ctx.beginPath(); ctx.arc(x, y, rr(0.8, 2.4), 0, 6.28); ctx.fill();
      }
    }, true);
    const grassTex = canvasTex(512, (ctx, s) => {
      ctx.fillStyle = '#bfc4b2'; ctx.fillRect(0, 0, s, s);
      for (let i = 0; i < 26000; i++) {
        const g = rr(130, 235); ctx.strokeStyle = `rgba(${g * 0.95},${g},${g * 0.85},0.55)`;
        ctx.lineWidth = rr(0.6, 1.6); const x = rr(0, s), y = rr(0, s), l = rr(2, 7), a = rr(-0.5, 0.5) - Math.PI / 2;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke();
      }
    }, true);
    const rugBump = canvasTex(256, (ctx, s) => {
      const img = ctx.createImageData(s, s);
      for (let i = 0; i < s * s; i++) { const g = 90 + Math.random() * 120; img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = g; img.data[i * 4 + 3] = 255; }
      ctx.putImageData(img, 0, 0);
    });
    const blobTex = canvasTex(128, (ctx, s) => {
      const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      g.addColorStop(0, 'rgba(0,0,0,0.6)'); g.addColorStop(0.55, 'rgba(0,0,0,0.3)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
    });
    blobTex.wrapS = blobTex.wrapT = THREE.ClampToEdgeWrapping;

    /* ---------- terrain ---------- */
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
    {
      const N = 300, S = 360, zc = -25;
      const map = u => Math.sign(u) * Math.pow(Math.abs(u), 1.8) * S;
      const pos = new Float32Array((N + 1) * (N + 1) * 3), col = new Float32Array(pos.length), uv = new Float32Array((N + 1) * (N + 1) * 2);
      const gLight = C('#71863a'), gDark = C('#45592a'), gWarm = C('#7f8a3e'), shore = C('#3d4426');
      const tmp = new THREE.Color();
      for (let i = 0, k = 0; i <= N; i++) for (let j = 0; j <= N; j++, k++) {
        const x = map(j / N * 2 - 1), z = zc + map(i / N * 2 - 1), y = groundH(x, z);
        pos[k * 3] = x; pos[k * 3 + 1] = y; pos[k * 3 + 2] = z;
        uv[k * 2] = x / 3.5; uv[k * 2 + 1] = z / 3.5;
        tmp.copy(gDark).lerp(gLight, fbm(x * 0.07, 0.3, z * 0.07, 3));
        tmp.lerp(gWarm, smooth(0.55, 0.75, fbm(x * 0.02, 9, z * 0.02, 2)) * 0.6);
        tmp.lerp(shore, smooth(WATER_Y + 0.5, WATER_Y, y));
        tmp.lerp(gDark, smooth(-60, -110, z) * 0.85);
        col[k * 3] = tmp.r; col[k * 3 + 1] = tmp.g; col[k * 3 + 2] = tmp.b;
      }
      const idx = [];
      for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
        const a = i * (N + 1) + j, b = a + N + 1;
        idx.push(a, b, a + 1, b, b + 1, a + 1);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      g.setIndex(idx); g.computeVertexNormals();
      const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, map: grassTex, roughness: 1 }));
      m.receiveShadow = true;
      scene.add(m);
    }

    /* ---------- mountains + hills ---------- */
    const bushes = []; // {p, n, s, c}
    const mountMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 });
    const rockMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true });
    function makeMount(o) {
      const { cx, cz, H, R, seed, kind } = o;
      const seg = o.seg || 180, rings = o.rings || 130, yB = o.yBase !== undefined ? o.yBase : -12;
      const nv = (rings + 1) * (seg + 1);
      const pos = new Float32Array(nv * 3), Q = new Float32Array(nv * 3), T = new Float32Array(nv);
      for (let i = 0, k = 0; i <= rings; i++) {
        const t = i / rings;
        const prof = kind === 'peak' ? Math.pow(1 - t, 1.25) * (1 - 0.1 * t) + 0.02 * (1 - t) : Math.pow(1 - t, 1.15) * (1 + 0.12 * Math.sin(Math.PI * t));
        for (let j = 0; j <= seg; j++, k++) {
          const a = j / seg * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
          const qx = ca * 1.6 + seed, qy = t * H / R * 1.3, qz = sa * 1.6 - seed;
          let d;
          if (kind === 'peak') d = (fbm(qx * 0.8, qy * 0.8, qz * 0.8, 4) - 0.5) * 1.25 + (fbm(qx * 3.0, qy * 2.2, qz * 3.0, 3) - 0.5) * 0.5 + (vnoise(qx * 9, qy * 2.5, qz * 9) - 0.5) * 0.12 + (vnoise(qx * 26, qy * 3, qz * 26) - 0.5) * 0.05;
          else d = (fbm(qx * 1.1, qy * 1.1, qz * 1.1, 3) - 0.5) * 0.16 + (vnoise(qx * 11, qy * 11, qz * 11) - 0.5) * 0.07;
          const r = R * prof * (1 + d);
          const lx = kind === 'peak' ? (fbm(t * 1.6, seed, 0.5, 2) - 0.5) * R * 0.9 * t : 0;
          const lz = kind === 'peak' ? (fbm(t * 1.6, seed + 4, 2.5, 2) - 0.5) * R * 0.5 * t : 0;
          pos[k * 3] = cx + lx + ca * r; pos[k * 3 + 1] = yB + t * (H - yB); pos[k * 3 + 2] = cz + lz + sa * r;
          Q[k * 3] = qx; Q[k * 3 + 1] = qy; Q[k * 3 + 2] = qz; T[k] = t;
        }
      }
      const idx = [];
      for (let i = 0; i < rings; i++) for (let j = 0; j < seg; j++) {
        const a = i * (seg + 1) + j, b = a + seg + 1;
        idx.push(a, b, a + 1, b, b + 1, a + 1);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setIndex(idx); g.computeVertexNormals();
      const nrm = g.attributes.normal.array;
      for (let i = 0; i <= rings; i++) { // close the seam
        const a = i * (seg + 1), b = a + seg;
        for (let c = 0; c < 3; c++) { const v = (nrm[a * 3 + c] + nrm[b * 3 + c]) / 2; nrm[a * 3 + c] = nrm[b * 3 + c] = v; }
      }
      const col = new Float32Array(nv * 3);
      const rockD = C('#6f6d67'), rockL = C('#bdbab2'), scree = C('#eeeeea'), vegD = C('#1a2e11'), vegL = C('#30491c'), hillLow = C('#4b6227');
      const c = new THREE.Color(), v = new THREE.Color();
      for (let k = 0; k < nv; k++) {
        const ny = nrm[k * 3 + 1], t = T[k], qx = Q[k * 3], qy = Q[k * 3 + 1], qz = Q[k * 3 + 2];
        v.copy(vegD).lerp(vegL, fbm(qx * 6, qy * 6, qz * 6, 2));
        if (kind === 'peak') {
          c.copy(rockD).lerp(rockL, smooth(0.32, 0.62, fbm(qx * 4, qy * 2.6, qz * 4, 3)));
          c.lerp(scree, smooth(0.64, 0.72, fbm(qx * 2.4, qy * 0.6, qz * 2.4, 3)) * smooth(0.95, 0.5, t));
          let veg = smooth(0.1, 0.32, ny) * smooth(0.8 * o.vegTop, 0.3 * o.vegTop, t) * smooth(0.36, 0.52, fbm(qx * 2, qy * 1.2, qz * 2, 3));
          veg = Math.max(veg, smooth(0.3, 0.08, t) * smooth(-0.1, 0.15, ny));
          c.lerp(v, veg);
        } else {
          c.copy(v).lerp(hillLow, smooth(0.12, 0.0, t) * 0.8);
          if (pos[k * 3 + 1] > groundH(pos[k * 3], pos[k * 3 + 2]) - 0.5 && rand() < 0.5 * (1 - t) * o.bushRate)
            bushes.push({ p: [pos[k * 3], pos[k * 3 + 1], pos[k * 3 + 2]], n: [nrm[k * 3], nrm[k * 3 + 1], nrm[k * 3 + 2]], s: R * rr(0.016, 0.03), c: v.clone().multiplyScalar(rr(0.7, 1.15)) });
        }
        col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b;
      }
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      scene.add(new THREE.Mesh(g, kind === 'peak' ? rockMat : mountMat));
    }
    // tall limestone peaks
    makeMount({ kind: 'peak', cx: -88, cz: -188, H: 138, R: 72, seed: 1.3, vegTop: 1 });
    makeMount({ kind: 'peak', cx: -30, cz: -265, H: 165, R: 56, seed: 7.7, vegTop: 0.7 });
    makeMount({ kind: 'peak', cx: 98, cz: -192, H: 152, R: 66, seed: 3.9, vegTop: 0.9 });
    makeMount({ kind: 'peak', cx: 182, cz: -232, H: 122, R: 72, seed: 12.1, vegTop: 1 });
    makeMount({ kind: 'peak', cx: -185, cz: -218, H: 118, R: 72, seed: 21.4, vegTop: 1 });
    makeMount({ kind: 'peak', cx: 34, cz: -345, H: 145, R: 84, seed: 31.8, vegTop: 0.6 });
    // shrub-covered cones
    const hills = [[6, -134, 40, 30], [46, -120, 30, 23], [-26, -112, 22, 18], [76, -108, 19, 17], [-60, -104, 17, 16], [-100, -124, 25, 22], [122, -130, 28, 25]];
    hills.forEach(([x, z, H, R], i) => makeMount({ kind: 'hill', cx: x, cz: z, H: H + groundH(x, z), R, seed: 40 + i * 3.3, yBase: groundH(x, z) - 4, seg: 140, rings: 80, bushRate: 0.9 }));
    // shrubs along the far shore
    for (let i = 0; i < 0; i++) {
      const x = rr(-130, 130), z = rr(-110, -60);
      if (lakeD(x, z) < 1.04) continue;
      bushes.push({ p: [x, groundH(x, z), z], n: [0, 1, 0], s: rr(0.4, 1.1), c: C('#25401a').multiplyScalar(rr(0.7, 1.1)) });
    }
    {
      const geo = new THREE.IcosahedronGeometry(1, 1);
      const im = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ roughness: 1 }), bushes.length);
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), e = new THREE.Euler();
      bushes.forEach((b, i) => {
        p.set(b.p[0] + b.n[0] * b.s * 0.35, b.p[1] + b.n[1] * b.s * 0.35, b.p[2] + b.n[2] * b.s * 0.35);
        e.set(rr(0, 3), rr(0, 6), rr(0, 3)); q.setFromEuler(e);
        s.set(b.s * rr(0.9, 1.2), b.s * rr(0.65, 0.9), b.s * rr(0.9, 1.2));
        m.compose(p, q, s); im.setMatrixAt(i, m); im.setColorAt(i, b.c);
      });
      im.layers.set(1);
      scene.add(im);
    }

    /* ---------- lake ---------- */
    const waterShader = {
      uniforms: { color: { value: null }, tDiffuse: { value: null }, textureMatrix: { value: null }, time: { value: 0 } },
      vertexShader: `
        uniform mat4 textureMatrix; varying vec4 vUv; varying vec2 vP;
        #include <common>
        #include <logdepthbuf_pars_vertex>
        void main(){ vUv = textureMatrix * vec4(position,1.0); vP = position.xy;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
          #include <logdepthbuf_vertex>
        }`,
      fragmentShader: `
        uniform vec3 color; uniform sampler2D tDiffuse; uniform float time; varying vec4 vUv; varying vec2 vP;
        #include <logdepthbuf_pars_fragment>
        float bo(float b, float l){ return b < 0.5 ? (2.0*b*l) : (1.0 - 2.0*(1.0-b)*(1.0-l)); }
        void main(){
          #include <logdepthbuf_fragment>
          vec2 w = vec2(sin(vP.x*0.8 + time*0.5) + 0.6*sin(vP.y*1.9 - time*0.7 + vP.x*0.3),
                        cos(vP.y*1.2 + time*0.45) + 0.5*sin(vP.x*2.1 + vP.y*0.6 + time*0.9));
          vec4 uv = vUv; uv.xy += w * 0.0045 * uv.w;
          vec3 base = texture2DProj(tDiffuse, uv).rgb;
          gl_FragColor = vec4(bo(base.r,color.r), bo(base.g,color.g), bo(base.b,color.b), 1.0);
          #include <tonemapping_fragment>
          #include <encodings_fragment>
        }`
    };
    const pr = renderer.getPixelRatio();
    const water = new THREE.Reflector(new THREE.PlaneGeometry(160, 82), {
      clipBias: 0.003, textureWidth: innerWidth * pr * 0.6, textureHeight: innerHeight * pr * 0.6,
      color: C('#5e6363'), shader: waterShader
    });
    water.rotation.x = -Math.PI / 2;
    water.position.set(0, WATER_Y, -34);
    scene.add(water);

    /* ---------- grass blades near the set ---------- */
    let grassBlades;
    const RUG = { x: 0, z: 1.25, r: 1.62 };
    {
      const n = 60000, pos = new Float32Array(n * 9), col = new Float32Array(n * 9), nor = new Float32Array(n * 9);
      const base = C('#566b2c'), tipA = C('#6c8036'), tipB = C('#7b8a3d');
      let k = 0;
      for (let i = 0; i < n; i++) {
        const a = rr(0, Math.PI * 2), d = Math.pow(rand(), 0.7) * 17;
        const x = Math.cos(a) * d, z = 0.8 + Math.sin(a) * d * 0.85;
        if ((x - RUG.x) ** 2 + (z - RUG.z) ** 2 < (RUG.r + 0.02) ** 2) continue;
        const y = groundH(x, z); if (y < WATER_Y + 0.1) continue;
        const h = rr(0.02, 0.05), w = rr(0.006, 0.012), ang = rr(0, Math.PI), ca = Math.cos(ang) * w, sa = Math.sin(ang) * w;
        const lx = rr(-0.02, 0.02), lz = rr(-0.02, 0.02);
        const tip = tipA.clone().lerp(tipB, rand());
        const verts = [[x - ca, y, z - sa, base], [x + ca, y, z + sa, base], [x + lx, y + h, z + lz, tip]];
        for (const [vx, vy, vz, cc] of verts) {
          pos[k * 3] = vx; pos[k * 3 + 1] = vy; pos[k * 3 + 2] = vz;
          col[k * 3] = cc.r; col[k * 3 + 1] = cc.g; col[k * 3 + 2] = cc.b;
          nor[k * 3 + 1] = 1; k++;
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos.subarray(0, k * 3), 3));
      g.setAttribute('color', new THREE.BufferAttribute(col.subarray(0, k * 3), 3));
      g.setAttribute('normal', new THREE.BufferAttribute(nor.subarray(0, k * 3), 3));
      const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: THREE.DoubleSide }));
      m.receiveShadow = true; m.layers.set(1);
      grassBlades = m;
      scene.add(m);
    }

    /* ---------- furniture ---------- */
    const set = new THREE.Group(); scene.add(set);
    const shadowy = o => { o.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } }); return o; };

    const boucle = new THREE.MeshPhysicalMaterial({
      color: C('#5c6220'), map: boucleCol, bumpMap: boucleBump, bumpScale: 0.035,
      roughness: 0.95, sheen: 0.7, sheenColor: C('#a3a556'), sheenRoughness: 0.5
    });
    boucleCol.repeat.set(4, 4); boucleBump.repeat.set(4, 4);

    // superellipsoid "pillow" — a rounded box that still reads as soft
    function pillow(sx, sy, sz, e = 0.4) {
      const g = new THREE.SphereGeometry(1, 64, 32); g.rotateY(-Math.PI / 2);
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const f = v => Math.sign(v) * Math.pow(Math.abs(v), e);
        p.setXYZ(i, f(p.getX(i)) * sx, f(p.getY(i)) * sy, f(p.getZ(i)) * sz);
      }
      g.computeVertexNormals();
      return g;
    }

    // channel-tufted shell: vertical puffy ribs following a U around the seat
    function shellSeat({ W, D, backH, armH, r, ribs, seatH, cushions }) {
      const grp = new THREE.Group();
      const hw = W / 2 - r, hd = D / 2 - r * 0.7, cr = Math.min(hw, hd) * 0.75;
      const poly = [];
      const push = (x, z) => poly.push(new THREE.Vector2(x, z));
      const fz = hd - r * 0.15;
      for (let i = 0; i <= 20; i++) push(-hw, fz + (-hd + cr - fz) * i / 20);
      for (let i = 1; i <= 20; i++) { const a = Math.PI + i / 20 * Math.PI / 2; push(-hw + cr + Math.cos(a) * cr, -hd + cr + Math.sin(a) * cr); }
      for (let i = 1; i <= 20; i++) push(-hw + cr + (2 * hw - 2 * cr) * i / 20, -hd);
      for (let i = 1; i <= 20; i++) { const a = 1.5 * Math.PI + i / 20 * Math.PI / 2; push(hw - cr + Math.cos(a) * cr, -hd + cr + Math.sin(a) * cr); }
      for (let i = 1; i <= 20; i++) push(hw, -hd + cr + (fz - (-hd + cr)) * i / 20);
      const len = []; let L = 0; len.push(0);
      for (let i = 1; i < poly.length; i++) { L += poly[i].distanceTo(poly[i - 1]); len.push(L); }
      const at = s => { let i = 1; while (i < len.length - 1 && len[i] < s) i++; const t = (s - len[i - 1]) / (len[i] - len[i - 1] || 1); return { p: poly[i - 1].clone().lerp(poly[i], t), d: poly[i].clone().sub(poly[i - 1]).normalize() }; };
      const up = new THREE.Vector3(0, 1, 0), X = new THREE.Vector3(1, 0, 0);
      for (let k = 0; k < ribs; k++) {
        const { p, d } = at(L * k / (ribs - 1));
        const tan = new THREE.Vector3(d.x, 0, d.y);
        const out = new THREE.Vector3().crossVectors(tan, up).normalize(); // outward
        const depth = (p.y + hd) / (2 * hd); // 0 at back, 1 at front
        const crown = 1 - 0.14 * Math.pow(p.x / Math.max(hw, 0.01), 2);
        const h = (backH + (armH - backH) * smooth(0.12, 0.95, depth)) * (depth < 0.2 ? crown : 1);
        const geo = new THREE.CapsuleGeometry(r, Math.max(0.01, h - 2 * r), 10, 20);
        const m = new THREE.Mesh(geo, boucle);
        m.position.set(p.x, h / 2, p.y);
        const basis = new THREE.Matrix4().makeBasis(tan, up, out);
        m.quaternion.setFromRotationMatrix(basis).multiply(new THREE.Quaternion().setFromAxisAngle(X, 0.1 + 0.08 * (1 - depth)));
        m.scale.set(1.08, 1, 0.86);
        grp.add(m);
      }
      // base + seat cushions
      const base = new THREE.Mesh(pillow(hw + 0.02, seatH * 0.42, hd + 0.02, 0.35), boucle);
      base.position.set(0, seatH * 0.42, 0.04); grp.add(base);
      const cw = (2 * hw) / cushions;
      for (let i = 0; i < cushions; i++) {
        const c = new THREE.Mesh(pillow(cw / 2 - 0.005, 0.1, hd * 0.92, 0.42), boucle);
        c.position.set(-hw + cw * (i + 0.5), seatH * 0.84 + 0.06, 0.08); grp.add(c);
      }
      return shadowy(grp);
    }

    const sofa = shellSeat({ W: 2.35, D: 0.98, backH: 0.84, armH: 0.6, r: 0.17, ribs: 17, seatH: 0.42, cushions: 2 });
    set.add(sofa);
    const chairL = shellSeat({ W: 1.08, D: 0.95, backH: 0.78, armH: 0.58, r: 0.165, ribs: 12, seatH: 0.4, cushions: 1 });
    chairL.position.set(-2.05, 0, 0.5); chairL.rotation.y = 0.38; set.add(chairL);
    const chairR = shellSeat({ W: 1.08, D: 0.95, backH: 0.78, armH: 0.58, r: 0.165, ribs: 12, seatH: 0.4, cushions: 1 });
    chairR.position.set(2.05, 0, 0.5); chairR.rotation.y = -0.38; set.add(chairR);

    // soft contact shadows
    const blob = (x, z, sx, sz, ry = 0, y = 0.006) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false }));
      m.rotation.set(-Math.PI / 2, 0, ry); m.scale.set(sx, sz, 1); m.position.set(x, y, z); m.renderOrder = 1; set.add(m);
    };
    blob(0, 0.05, 3.2, 1.7, 0, 0.03); blob(-2.05, 0.5, 1.8, 1.7, 0.38); blob(2.05, 0.5, 1.8, 1.7, -0.38);

    // rug
    {
      const rug = new THREE.Mesh(new THREE.CylinderGeometry(RUG.r, RUG.r * 1.005, 0.022, 128),
        new THREE.MeshStandardMaterial({ color: C('#6e2213'), roughness: 1, bumpMap: rugBump, bumpScale: 0.03 }));
      rugBump.repeat.set(10, 10);
      rug.position.set(RUG.x, 0.011, RUG.z); rug.receiveShadow = true; set.add(rug);
    }

    // tulip table
    const white = new THREE.MeshStandardMaterial({ color: C('#f1f0ea'), roughness: 0.28 });
    {
      const pts = [[0, 0.022], [0.27, 0.022], [0.285, 0.032], [0.26, 0.05], [0.17, 0.08], [0.085, 0.14], [0.05, 0.25], [0.042, 0.45], [0.05, 0.58], [0.1, 0.645], [0.17, 0.67], [0.17, 0.675], [0, 0.675]].map(([x, y]) => new THREE.Vector2(x, y));
      const t = new THREE.Group();
      t.add(new THREE.Mesh(new THREE.LatheGeometry(pts, 64), white));
      const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.016, 96),
        new THREE.MeshPhysicalMaterial({ color: C('#dfe9e6'), roughness: 0.05, transparent: true, opacity: 0.32, metalness: 0, clearcoat: 1 }));
      glass.position.y = 0.685; glass.scale.set(1.25, 1, 1); glass.castShadow = false; t.add(glass);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.011, 8, 120), white);
      rim.rotation.x = Math.PI / 2; rim.position.y = 0.685; rim.scale.set(1.25, 1, 1); t.add(rim);
      // things on the table
      const top = 0.694;
      const yellow = new THREE.MeshStandardMaterial({ color: C('#e9c23a'), roughness: 0.45 });
      const tray = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.018, 0.22), yellow); tray.position.set(-0.4, top + 0.009, 0.06); tray.rotation.y = 0.15; t.add(tray);
      const nib = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.025, 0.06), new THREE.MeshStandardMaterial({ color: C('#6b3b1f'), roughness: 0.6 })); nib.position.set(-0.4, top + 0.03, 0.06); nib.rotation.y = 0.15; t.add(nib);
      for (const [x, z] of [[0.08, -0.08], [0.17, -0.02]]) { const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.032, 0.085, 32), yellow); cup.position.set(x, top + 0.0425, z); t.add(cup); }
      const bowl = new THREE.Mesh(new THREE.LatheGeometry([[0, 0], [0.05, 0.002], [0.09, 0.03], [0.095, 0.045], [0.085, 0.04], [0, 0.012]].map(([x, y]) => new THREE.Vector2(x, y)), 40),
        new THREE.MeshStandardMaterial({ color: C('#4a3326'), roughness: 0.5, side: THREE.DoubleSide }));
      bowl.position.set(-0.08, top, -0.18); t.add(bowl);
      const bk = (w, h, d, c, x, y, z, ry) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color: C(c), roughness: 0.8 })); b.position.set(x, y, z); b.rotation.y = ry; return b; };
      t.add(bk(0.3, 0.022, 0.21, '#ece4cf', 0.42, top + 0.011, 0.04, -0.12), bk(0.27, 0.02, 0.19, '#2f3b56', 0.42, top + 0.032, 0.04, -0.05));
      t.position.set(0, 0.022, 1.3);
      set.add(shadowy(t));
      glass.castShadow = false;
    }

    // side tables
    const wood = new THREE.MeshStandardMaterial({ color: C('#47201a'), roughness: 0.45 });
    function sideTable(x, z) {
      const g = new THREE.Group();
      const top = new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.29, 0.028, 48), wood); top.position.y = 0.56; g.add(top);
      const shelf = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.23, 0.02, 48), wood); shelf.position.y = 0.2; g.add(shelf);
      for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2 + 0.4; const l = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.011, 0.56, 10), wood); l.position.set(Math.cos(a) * 0.22, 0.28, Math.sin(a) * 0.22); g.add(l); }
      g.position.set(x, 0, z);
      return g;
    }
    const bookMat = c => new THREE.MeshStandardMaterial({ color: C(c), roughness: 0.85 });
    {
      const L = sideTable(-3.05, 0.95);
      const jug = new THREE.Mesh(new THREE.LatheGeometry([[0, 0], [0.065, 0], [0.072, 0.02], [0.068, 0.13], [0.058, 0.18], [0.062, 0.21], [0.055, 0.21], [0, 0.2]].map(([x, y]) => new THREE.Vector2(x, y)), 40),
        new THREE.MeshStandardMaterial({ color: C('#4d5153'), roughness: 0.35, metalness: 0.4 }));
      jug.position.set(-0.08, 0.574, -0.02); L.add(jug);
      const handle = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.009, 8, 24, Math.PI), jug.material); handle.position.set(-0.155, 0.7, -0.02); handle.rotation.z = -Math.PI / 2; L.add(handle);
      const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.028, 0.06, 24), new THREE.MeshStandardMaterial({ color: C('#2b2b2b'), roughness: 0.4 })); cup.position.set(0.12, 0.604, 0.06); L.add(cup);
      ['#e6dfcc', '#8a3a2a', '#2e3b55', '#d9c27a'].forEach((c, i) => { const b = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.03, 0.19), bookMat(c)); b.position.set(0, 0.225 + i * 0.03, 0); b.rotation.y = rr(-0.2, 0.2); L.add(b); });
      for (let i = 0; i < 3; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.24, 0.17), bookMat(['#f1ece0', '#c9b98f', '#ece6d6'][i])); b.position.set(0.25 + i * 0.04, 0.12, 0.05); L.add(b); }
      set.add(shadowy(L));
      const R = sideTable(3.0, 1.0);
      ['#f0ebdc', '#bfae86'].forEach((c, i) => { const b = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.028, 0.2), bookMat(c)); b.position.set(-0.02, 0.588 + i * 0.028, 0.02); b.rotation.y = 0.3 - i * 0.2; R.add(b); });
      const brass = new THREE.MeshStandardMaterial({ color: C('#b5873f'), roughness: 0.3, metalness: 0.8 });
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.16, 6), brass); mast.position.set(-0.12, 0.62, -0.08); R.add(mast);
      const hull = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.035, 0.05), new THREE.MeshStandardMaterial({ color: C('#7a2a1d'), roughness: 0.5 })); hull.position.set(-0.12, 0.545 + 0.03, -0.08); R.add(hull);
      set.add(shadowy(R));
      blob(-3.05, 0.95, 0.9, 0.9); blob(3.0, 1.0, 0.9, 0.9);
    }

    // floor lamp with a pleated paper shade
    let lampLight, shadeMat;
    {
      const lamp = new THREE.Group();
      const lw = new THREE.MeshStandardMaterial({ color: C('#a8743f'), roughness: 0.55 });
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.013, 1.62, 12), lw); pole.position.y = 0.81; lamp.add(pole);
      const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.12, 0.018, 32), lw); foot.position.y = 0.009; lamp.add(foot);
      const sg = new THREE.CylinderGeometry(0.12, 0.29, 0.25, 160, 2, true);
      const p = sg.attributes.position;
      for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), a = Math.atan2(z, x), f = Math.abs(Math.cos(a * 30)); p.setX(i, x * (1 + 0.05 * f)); p.setZ(i, z * (1 + 0.05 * f)); }
      sg.computeVertexNormals();
      shadeMat = new THREE.MeshStandardMaterial({ color: C('#f1b43e'), emissive: C('#f4a43a'), emissiveIntensity: 0.15, roughness: 0.85, side: THREE.DoubleSide });
      const shade = new THREE.Mesh(sg, shadeMat); shade.position.y = 1.62; lamp.add(shade);
      const cap = new THREE.Mesh(new THREE.TorusGeometry(0.125, 0.006, 6, 48), lw); cap.rotation.x = Math.PI / 2; cap.position.y = 1.745; lamp.add(cap);
      lampLight = new THREE.PointLight(C('#ffb35c'), 0, 6, 2); lampLight.position.y = 1.55; lamp.add(lampLight);
      lamp.position.set(-1.38, 0, -0.62);
      shadowy(lamp); shade.castShadow = false;
      set.add(lamp);
    }

    /* ---------- light modes ---------- */
    const modes = {
      day: { bg: C('#2e3a60'), sun: C('#fff0dc'), sunI: 2.2, dir: new THREE.Vector3(-0.55, 0.8, 0.6).normalize(), hemiI: 0.45, hemiSky: C('#d5dcf0'), lamp: 0, shade: 0.15, exp: 0.92, fog: C('#8e9ab3') },
      dusk: { bg: C('#1c2349'), sun: C('#ffa45e'), sunI: 2.4, dir: new THREE.Vector3(-0.85, 0.26, 0.45).normalize(), hemiI: 0.3, hemiSky: C('#8f9ad8'), lamp: 3.2, shade: 1.6, exp: 1.0, fog: C('#4a4f78') }
    };
    let mix = 0, mixTarget = 0;
    const tmpC = new THREE.Color(), tmpV = new THREE.Vector3();
    function applyMode(k) {
      const a = modes.day, b = modes.dusk;
      scene.background.copy(a.bg).lerp(b.bg, k);
      scene.fog.color.copy(a.fog).lerp(b.fog, k);
      sun.color.copy(a.sun).lerp(b.sun, k);
      sun.intensity = a.sunI + (b.sunI - a.sunI) * k;
      tmpV.copy(a.dir).lerp(b.dir, k).normalize();
      sun.position.copy(sunTarget.position).addScaledVector(tmpV, 40);
      hemi.intensity = a.hemiI + (b.hemiI - a.hemiI) * k;
      hemi.color.copy(a.hemiSky).lerp(b.hemiSky, k);
      lampLight.intensity = b.lamp * k;
      shadeMat.emissiveIntensity = a.shade + (b.shade - a.shade) * k;
      exposure.value = a.exp + (b.exp - a.exp) * k;   // [bridge] set on the shared renderer before this scene renders
    }
    applyMode(0);

    // [bridge] her Golden hour button and hint are hers alone; the bridge sets the mode directly (setMode)

    /* ---------- shadelings: little pleated-lantern creatures on stilt legs ----------
       They wander the meadow in loose groups, walk under the tulip table, crowd around
       seeds you drop, and drift toward the floor lamp when the light turns golden. */
    const shadelings = [];
    const SH = { hip: 0.2, n: 26 };
    const shPalette = ['#e2b13c', '#b8432a', '#efe6cc', '#8a8f3a', '#3e4a78', '#e08a3a'].map(c => new THREE.MeshStandardMaterial({ color: C(c), roughness: 0.85 }));
    const shCap = new THREE.MeshStandardMaterial({ color: C('#f3ecd8'), roughness: 0.6 });
    const shLeg = new THREE.MeshStandardMaterial({ color: C('#3a2418'), roughness: 0.6 });
    const shBead = new THREE.MeshStandardMaterial({ color: C('#ffd68a'), emissive: C('#ffc266'), emissiveIntensity: 0.3, roughness: 0.4 });
    const shBodyGeo = (() => {
      const g = new THREE.CylinderGeometry(0.052, 0.115, 0.17, 84, 3);
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), z = p.getZ(i), f = Math.abs(Math.cos(Math.atan2(z, x) * 14));
        p.setX(i, x * (1 + 0.08 * f)); p.setZ(i, z * (1 + 0.08 * f));
      }
      g.computeVertexNormals(); g.translate(0, 0.085, 0);
      return g;
    })();
    const shCapGeo = new THREE.SphereGeometry(0.056, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    const shLegGeo = new THREE.CylinderGeometry(0.0055, 0.011, SH.hip, 6); shLegGeo.translate(0, -SH.hip / 2, 0);
    const shAntGeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0.19, 0), new THREE.Vector3(0, 0.27, 0.01), new THREE.Vector3(0, 0.32, 0.05), new THREE.Vector3(0, 0.33, 0.09)]), 12, 0.0035, 5);
    const shBeadGeo = new THREE.SphereGeometry(0.019, 12, 8);
    const shBlobGeo = new THREE.PlaneGeometry(0.34, 0.34);
    const shBlobMat = new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, opacity: 0.8 });

    function makeShadeling(mat) {
      const root = new THREE.Group();
      const hipG = new THREE.Group(); hipG.position.y = SH.hip; root.add(hipG);
      const body = new THREE.Group(); hipG.add(body);
      body.add(new THREE.Mesh(shBodyGeo, mat));
      const cap = new THREE.Mesh(shCapGeo, shCap); cap.position.y = 0.17; body.add(cap);
      body.add(new THREE.Mesh(shAntGeo, shLeg));
      const bead = new THREE.Mesh(shBeadGeo, shBead); bead.position.set(0, 0.33, 0.09); body.add(bead);
      const legL = new THREE.Mesh(shLegGeo, shLeg); legL.position.x = -0.035; hipG.add(legL);
      const legR = new THREE.Mesh(shLegGeo, shLeg); legR.position.x = 0.035; hipG.add(legR);
      const blob = new THREE.Mesh(shBlobGeo, shBlobMat); blob.rotation.x = -Math.PI / 2; blob.position.y = 0.004; blob.renderOrder = 1; root.add(blob);
      root.traverse(o => { if (o.isMesh) { o.layers.set(1); if (o !== blob) { o.castShadow = true; o.receiveShadow = true; } } });
      scene.add(root);
      return { root, hipG, body, legL, legR, blob };
    }

    const shObstacles = [[-0.8, 0, 0.6], [0, 0, 0.6], [0.8, 0, 0.6], [-2.05, 0.5, 0.65], [2.05, 0.5, 0.65], [0, 1.3, 0.3], [-3.05, 0.95, 0.38], [3.0, 1.0, 0.38], [-1.38, -0.62, 0.16]];
    const shRegion = { x0: -7.5, x1: 7.5, z0: -3.2, z1: 3.8 };
    const onRug = (x, z) => (x - RUG.x) ** 2 + (z - RUG.z) ** 2 < RUG.r * RUG.r;
    const floorY = (x, z) => onRug(x, z) ? 0.022 : Math.max(groundH(x, z), 0);
    function shValid(x, z) {
      if (x < shRegion.x0 || x > shRegion.x1 || z < shRegion.z0 || z > shRegion.z1) return false;
      if (groundH(x, z) < WATER_Y + 0.35) return false;
      for (const [ox, oz, r] of shObstacles) if ((x - ox) ** 2 + (z - oz) ** 2 < (r + 0.12) ** 2) return false;
      return true;
    }
    function shPick(cx, cz, rad) {
      for (let k = 0; k < 20; k++) {
        const a = rr(0, Math.PI * 2), d = rr(0.4, rad), x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
        if (shValid(x, z)) return new THREE.Vector2(x, z);
      }
      return new THREE.Vector2(rr(-3, 3), rr(2.0, 3.4));
    }

    // a few napping on the furniture
    [[-0.45, 0.515, 0.14, -0.1, 2], [0.4, 0.515, 0.18, 0.15, 0], [-2.02, 0.495, 0.58, 0.4, 5]].forEach(([x, y, z, ry, ci]) => {
      const s = makeShadeling(shPalette[ci]);
      s.root.position.set(x, y - SH.hip + 0.045, z); s.root.rotation.y = ry;
      s.legL.rotation.x = s.legR.rotation.x = -1.45; s.blob.visible = false;
      shadelings.push({ ...s, sleeper: true, phase: rand() * 6 });
    });
    // the wandering crowd, loosely in groups
    const groupCentres = [[-4.3, 1.4], [4.0, 1.8], [-0.8, -1.9], [1.8, -1.7], [-5.0, -1.2], [5.2, -0.8], [0.9, 2.3]];
    for (let i = 0; i < SH.n; i++) {
      const [gx, gz] = groupCentres[i % groupCentres.length];
      const p = shPick(gx, gz, 1.4);
      const s = makeShadeling(shPalette[i % shPalette.length]);
      const h = rr(0.85, 1.15); s.root.scale.setScalar(h);
      shadelings.push({
        ...s, pos: p, vel: new THREE.Vector2(), target: shPick(p.x, p.y, 2), heading: rr(0, 6.28),
        phase: rr(0, 6), wait: rr(0, 2), maxSpeed: rr(0.35, 0.6) / h, hop: 0, hopV: 0, lampLover: i % 3 !== 2,
        home: i % groupCentres.length, ring: rr(0, Math.PI * 2), y: floorY(p.x, p.y)
      });
    }

    // seeds
    const seed = { active: false, pos: new THREE.Vector2(), t: 0, y: 0, vy: 0 };
    const seedMesh = new THREE.Mesh(new THREE.SphereGeometry(0.03, 14, 10), new THREE.MeshStandardMaterial({ color: C('#fff1c2'), emissive: C('#ffcc66'), emissiveIntensity: 1.6 }));
    seedMesh.visible = false; seedMesh.layers.set(1); scene.add(seedMesh);
    // [bridge] no seed taps here (the bridge is not interactive)

    const tmp2 = new THREE.Vector2(), des = new THREE.Vector2(), LAMP = new THREE.Vector2(-1.38, -0.62);
    function updateShadelings(dt, time) {
      shBead.emissiveIntensity = 0.25 + mix * 2.6;
      if (seed.active) {
        seed.t += dt;
        seed.vy -= 9.8 * dt; seed.y += seed.vy * dt;
        const fy = floorY(seed.pos.x, seed.pos.y) + 0.03;
        if (seed.y < fy) { seed.y = fy; seed.vy = Math.abs(seed.vy) > 0.4 ? -seed.vy * 0.35 : 0; }
        seedMesh.position.set(seed.pos.x, seed.y, seed.pos.y);
        if (seed.t > 7) seedMesh.scale.setScalar(Math.max(0.001, 1 - (seed.t - 7)));
        if (seed.t > 8) { seed.active = false; seedMesh.visible = false; for (const s of shadelings) if (!s.sleeper) s.wait = rr(0.5, 2.5); }
      }
      for (const s of shadelings) {
        s.phase += dt;
        if (s.sleeper) { s.body.scale.y = 1 + Math.sin(s.phase * 1.6) * 0.035; continue; }
        // pick a goal
        let goal = null, arrive = 0.5, gather = false;
        if (seed.active && s.pos.distanceTo(seed.pos) < 7.5) {
          const rad = 0.32 + (s.ring % 0.7) * 0.25;
          goal = tmp2.set(seed.pos.x + Math.cos(s.ring) * rad, seed.pos.y + Math.sin(s.ring) * rad); gather = true; arrive = 0.25;
        } else if (mix > 0.5 && s.lampLover) {
          const rad = 0.75 + (s.ring % 1) * 0.9;
          goal = tmp2.set(LAMP.x + Math.cos(s.ring) * rad, LAMP.y + 0.6 + Math.abs(Math.sin(s.ring)) * rad);
          if (!shValid(goal.x, goal.y)) { s.ring += 0.7; goal = null; }
        }
        if (!goal) {
          if (s.pos.distanceTo(s.target) < 0.2) {
            s.wait -= dt;
            if (s.wait <= 0) { const [gx, gz] = groupCentres[s.home]; const c = rand() < 0.75 ? [gx, gz] : [s.pos.x, s.pos.y]; s.target = shPick(c[0], c[1], 2.4); s.wait = rr(0.6, 3.5); if (rand() < 0.08) s.home = Math.floor(rr(0, groupCentres.length)); }
          }
          goal = s.target;
        }
        const d = des.subVectors(goal, s.pos), dist = d.length();
        if (dist > 0.001) d.multiplyScalar(s.maxSpeed * Math.min(1, dist / arrive) / dist); else d.set(0, 0);
        // keep a little personal space
        for (const o of shadelings) {
          if (o === s || o.sleeper) continue;
          const dx = s.pos.x - o.pos.x, dz = s.pos.y - o.pos.y, q = dx * dx + dz * dz;
          if (q < 0.09 && q > 1e-6) { const k = (0.3 - Math.sqrt(q)) * 2.2 / Math.sqrt(q); d.x += dx * k; d.y += dz * k; }
        }
        s.vel.lerp(d, Math.min(1, dt * 4));
        s.pos.addScaledVector(s.vel, dt);
        // stay out of furniture and water
        for (const [ox, oz, r] of shObstacles) {
          const dx = s.pos.x - ox, dz = s.pos.y - oz, q = Math.hypot(dx, dz), R = r + 0.08;
          if (q < R) { s.pos.x = ox + dx / (q || 1) * R; s.pos.y = oz + dz / (q || 1) * R; }
        }
        if (groundH(s.pos.x, s.pos.y) < WATER_Y + 0.3) { s.pos.y += 0.02; s.vel.y = Math.abs(s.vel.y); s.target = shPick(0, 2.4, 2.5); }
        s.pos.x = Math.max(shRegion.x0, Math.min(shRegion.x1, s.pos.x));
        s.pos.y = Math.max(shRegion.z0, Math.min(shRegion.z1, s.pos.y));
        // face where it's going (or the seed once it's there)
        const sp = s.vel.length();
        let want = s.heading;
        if (sp > 0.05) want = Math.atan2(s.vel.x, s.vel.y);
        else if (gather) want = Math.atan2(seed.pos.x - s.pos.x, seed.pos.y - s.pos.y);
        let dh = want - s.heading; dh = Math.atan2(Math.sin(dh), Math.cos(dh));
        s.heading += dh * Math.min(1, dt * 6);
        // walk cycle, happy hops at the seed
        const gait = Math.min(1, sp / 0.3);
        s.stride = (s.stride || 0) + sp * dt * 26;
        if (gather && dist < 0.12 && s.hop <= 0 && rand() < dt * 2.5) s.hopV = rr(0.9, 1.4);
        if (s.hopV !== 0 || s.hop > 0) { s.hopV -= 9.8 * dt; s.hop += s.hopV * dt; if (s.hop <= 0) { s.hop = 0; s.hopV = 0; } }
        const fy = floorY(s.pos.x, s.pos.y);
        s.y += (fy - s.y) * Math.min(1, dt * 10);
        s.root.position.set(s.pos.x, s.y + s.hop, s.pos.y);
        s.root.rotation.y = s.heading;
        const swing = Math.sin(s.stride) * 0.55 * gait;
        s.legL.rotation.x = swing + (s.hop > 0 ? -0.35 : 0);
        s.legR.rotation.x = -swing + (s.hop > 0 ? 0.35 : 0);
        s.hipG.position.y = SH.hip + Math.abs(Math.cos(s.stride)) * 0.018 * gait - 0.012 * gait;
        s.body.rotation.z = Math.sin(s.stride) * 0.09 * gait;
        s.body.rotation.x = 0.12 * gait + Math.sin(s.phase * 2.1 + s.ring) * 0.04 * (1 - gait);
        s.blob.position.y = fy - s.y - s.hop + 0.004;
        s.blob.scale.setScalar(1 - Math.min(0.5, s.hop * 1.5));
      }
    }

  grassBlades.visible = false;   // as her gouache post does (lounge.html 785)
  function setMode(k) { mix = mixTarget = k; applyMode(mix); }
  const clock = new THREE.Clock();
  function update(dt) {
    water.material.uniforms.time.value += dt;
    if (Math.abs(mix - mixTarget) > 0.0005) { mix += (mixTarget - mix) * Math.min(1, dt * 1.6); applyMode(mix); }
    updateShadelings(dt, clock.getElapsedTime());
  }
  return { scene, camera, water, exposure, update, setMode };
}
