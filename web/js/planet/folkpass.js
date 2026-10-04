// Our folk on Sueda's Tower Planet, painted exactly as in the Red arch: the reference's folk pass (web/js/paint/post.js
// renderFolk: the folk alone on FACE_LAYER over the world's depth, clay cel + faces; folkPaintMat, its own alpha-aware
// gouache; the Gouache composite's paper tooth, pooling and soft shadows), run on top of HER finish through
// planet.renderHook, with her camera, her depth and her lens. New code (docs/planet.md "Folk pass"); web/js/paint is
// imported, never edited.
//
//   const pass = createFolkPass(planet, { adapter, ctx })    // ctx = the paint context (camera: adapter.flatCamera)
//   const folk = createFolk(ctx, pass.backdrop, nav)         // the folk light the reference's way (pass.backdrop.KEY_DIR)
//   pass.attach(folk)                                         // makes the painter (materials only) + hooks the frame
//
// Per frame (inside planet.frame): beforeRender hides every flat object (her colour, normal and shadow passes never see
// them); afterFinish shows them, maps them onto the sphere (adapter.mapFolk), renders the folk pass, composites it
// onto the screen through her fish lens, and restores the flat transforms, so folk.update keeps working in flat space.
import { createPainter } from '../paint/post.js';
import { FACE_LAYER } from '../paint/folk.js';

// the Red arch key, verbatim: key.position (-28, 22, 14) - target (0, 0, -6) (backdrop.js), in its camera's frame
// (the reference camera looks down -z: x = screen right, y = up, z = toward the viewer)
const REF_KEY = new THREE.Vector3(-28, 22, 20).normalize();

const FS_VERT = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
// her post's noise + fish (post.js GLSL_NOISE, fish()) and the Red arch Gouache composite's folk lines (paint/post.js
// printMat, uMode > 0.5): body / face / soft shadow, paper tooth, pooling. Grain: her grain's 6 levels, by uBlend.
const COMPOSITE_FRAG = `
  float hash(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
  float vnoise(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.0-2.0*f);
    return mix(mix(hash(i),hash(i+vec2(1.0,0.0)),u.x), mix(hash(i+vec2(0.0,1.0)),hash(i+vec2(1.0,1.0)),u.x), u.y); }
  float fbm(vec2 p){ float a=0.5, s=0.0; for(int i=0;i<4;i++){ s+=a*vnoise(p); p*=2.03; a*=0.5; } return s; }
  uniform sampler2D tFolk; uniform vec2 uOut; uniform float uFish, uPR, uTooth, uPool, uBlend, uGrain, uSize, uFade;
  varying vec2 vUv;
  vec2 fish(vec2 uv){
    float a=uOut.x/uOut.y; vec2 p=(uv-0.5)*vec2(a,1.0);
    float r2=dot(p,p); p*=1.0/(1.0+uFish*r2);
    return p/vec2(a,1.0)+0.5;
  }
  void main(){
    vec2 fc = gl_FragCoord.xy/uPR;
    vec4 ey = texture2D(tFolk, fish(vUv));
    if (ey.a < 0.004) discard;
    float body = step(0.9, ey.a), face = step(0.45, ey.a) * (1.0 - body);
    float fib = fbm(fc/2.2);
    vec3 col = ey.rgb * ((1.0 - uTooth) + uTooth * fib) * (1.0 - uPool * 0.6 * smoothstep(0.55, 0.75, fbm(fc / 9.0 + 3.0)));
    vec4 o = body + face > 0.5 ? vec4(col, 1.0) : vec4(ey.rgb, ey.a);
    if (uBlend < 0.999) {
      vec2 gp = floor(fc/max(uSize*0.75,1.0));
      vec3 n = vec3(hash(gp), hash(gp+17.31), hash(gp+41.77));
      n = clamp(n + (vnoise(fc*0.35)-0.5)*0.35*uGrain, 0.0, 1.0);
      vec3 q = floor(o.rgb*6.0 + mix(vec3(0.5), n, uGrain))/6.0;
      o.rgb = mix(q, o.rgb, uBlend);
    }
    o.a *= uFade;
    gl_FragColor = o;
  }`;

export function createFolkPass(planet, { adapter, ctx, keyMode = 'reference', depth = 'shared', maxAltitude = 420 } = {}) {
  const { renderer, scene, camera } = planet;
  const P = planet.post;

  /* ---- the folk's light: the reference's hemi + key, on FACE_LAYER only (her own pass never sees them) ---- */
  const KEY_DIR = REF_KEY.clone();
  const hemi = new THREE.HemisphereLight(0xb8cfd8, 0xc89a6a, 0.62); hemi.layers.set(FACE_LAYER);
  const key = new THREE.DirectionalLight(0xffe0bc, 0.85); key.layers.set(FACE_LAYER);
  const lights = new THREE.Group(); lights.name = 'folk-lights'; lights.add(hemi, key, key.target);
  lights.userData.planetWorld = true; planet.surface.add(lights);
  const backdrop = { KEY_DIR, hemi, key, folkLights: lights };

  const _f = new THREE.Vector3(), _u = new THREE.Vector3(), _N = new THREE.Vector3(), _B = new THREE.Vector3(), _R = new THREE.Vector3(), _c = new THREE.Vector3();
  // KEY_DIR keeps the reference's relation to the viewer and the local up: the light comes from the upper left
  // in front, whatever way the leader turns (her own sun does the same for her world)
  function aimLight() {
    camera.updateMatrixWorld();
    const st = planet.state(), foc = st.focus;
    const F = adapter.drawn && foc ? planet.flatToWorld(foc.fx, adapter.drawn.alt(foc.fx, foc.fz), foc.fz, _c) : _c.copy(camera.position).setLength(170);
    _N.copy(F).normalize();
    if (keyMode === 'sun') KEY_DIR.copy(planet.uniforms.SUN);
    else {
      _f.set(0, 0, -1).applyQuaternion(camera.quaternion); _u.set(0, 1, 0).applyQuaternion(camera.quaternion);
      _B.copy(_f).add(_u).addScaledVector(_N, -_f.dot(_N) - _u.dot(_N));      // where the view heads, on the ground
      if (_B.lengthSq() < 1e-8) _B.set(1, 0, 0).addScaledVector(_N, -_N.x);
      _B.normalize().negate();                                                // toward the viewer
      _R.crossVectors(_N, _B);
      KEY_DIR.set(0, 0, 0).addScaledVector(_R, REF_KEY.x).addScaledVector(_N, REF_KEY.y).addScaledVector(_B, REF_KEY.z).normalize();
    }
    hemi.position.copy(F).add(_N);                 // the hemisphere's "sky" is the local up
    key.target.position.copy(F); key.position.copy(F).addScaledVector(KEY_DIR, 40);
    lights.updateMatrixWorld(true);
  }

  /* ---- targets: the folk at her paint size, sharing her colour pass's depth texture ---- */
  let painter = null, folk = null, rtEyes = null, rtFolkPaint = null, sharedDepth = null, w = 0, h = 0;
  function targets() {
    const rt = P.rt; if (!rt) return false;
    const dt = depth === 'shared' ? rt.depthTexture : null;
    if (rtEyes && rt.width === w && rt.height === h && dt === sharedDepth) return true;
    if (rtEyes) { rtEyes.dispose(); rtFolkPaint.dispose(); }
    w = rt.width; h = rt.height; sharedDepth = dt;
    const opts = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: true, stencilBuffer: false };
    rtEyes = new THREE.WebGLRenderTarget(w, h, opts);
    if (dt) rtEyes.depthTexture = dt;   // her depth: terrain, tower, buildings occlude the folk
    rtFolkPaint = new THREE.WebGLRenderTarget(w, h, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
    if (painter) painter.materials.folkPaintMat.uniforms.uRes.value.set(w, h);
    return true;
  }

  /* ---- the composite onto her finished frame ---- */
  const compMat = new THREE.ShaderMaterial({
    uniforms: { tFolk: { value: null }, uOut: { value: P.post.uniforms.uOut.value }, uFish: P.post.uniforms.uFish, uPR: P.post.uniforms.uPR,
      uTooth: { value: 0.1 }, uPool: { value: 0.06 }, uBlend: P.post.uniforms.uBlend, uGrain: P.post.uniforms.uGrain, uSize: P.post.uniforms.uSize,
      uFade: { value: 1 } },
    vertexShader: FS_VERT, fragmentShader: COMPOSITE_FRAG, transparent: true, depthTest: false, depthWrite: false
  });
  const fsScene = new THREE.Scene(), fsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const fsQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), compMat); fsQuad.frustumCulled = false; fsScene.add(fsQuad);
  function pass(mat, target) { fsQuad.material = mat; renderer.setRenderTarget(target); renderer.render(fsScene, fsCam); }

  const BLOB_LISTS = ['creatures', 'hoppers', 'drops', 'scoots', 'flits', 'pips', 'floaties'];
  const blobs = v => { for (const k of BLOB_LISTS) for (const a of folk[k] || []) if (a.blob) a.blob.visible = v; };
  const stats = { frames: 0, skipped: 0, mapped: 0, ms: 0 };
  let enabled = true;

  // the Red arch renderFolk, with her depth instead of a depth-only redraw (depth: 'rerender' does the redraw,
  // exactly as the reference: polygon offset and all)
  const _cc = new THREE.Color();   // perf: no per-frame allocation
  function renderFolkPass() {
    const t0 = performance.now();
    const cc = renderer.getClearColor(_cc), ca = renderer.getClearAlpha(), au = renderer.autoClear, sAU = renderer.shadowMap.autoUpdate;
    renderer.shadowMap.autoUpdate = false;     // the folk pass never redraws her 4096 shadow map
    renderer.setRenderTarget(rtEyes); renderer.setClearColor(0x000000, 0);
    if (sharedDepth) renderer.clear(true, false, false);
    else {
      renderer.clear();
      const vis = [];
      for (const o of adapter.flatObjects()) { vis.push(o, o.visible); o.visible = false; }
      const sky = planet.world.sky.visible, atm = planet.world.atmosphere.visible; planet.world.sky.visible = planet.world.atmosphere.visible = false;
      scene.overrideMaterial = painter.materials.depthOnlyMat; renderer.render(scene, camera); scene.overrideMaterial = null;
      planet.world.sky.visible = sky; planet.world.atmosphere.visible = atm;
      for (let i = 0; i < vis.length; i += 2) vis[i].visible = vis[i + 1];
    }
    blobs(true);
    camera.layers.set(FACE_LAYER); renderer.autoClear = false; renderer.render(scene, camera); camera.layers.set(0);
    blobs(false);
    const fm = painter.materials.folkPaintMat, G = painter.G, resScale = Math.max(w, h) / 1000;
    fm.uniforms.tFolk.value = rtEyes.texture;
    fm.uniforms.uRadius.value = Math.max(2, Math.min(5, Math.round(G.brush * 0.75 * resScale)));
    fm.uniforms.uWarp.value = 1.5 + G.wobble * 0.5;
    renderer.autoClear = true;
    pass(fm, rtFolkPaint);
    compMat.uniforms.tFolk.value = rtFolkPaint.texture;
    compMat.uniforms.uTooth.value = G.tooth; compMat.uniforms.uPool.value = G.pooling;
    renderer.autoClear = false; pass(compMat, null); renderer.autoClear = au;
    renderer.setClearColor(cc, ca); renderer.shadowMap.autoUpdate = sAU;
    stats.ms = performance.now() - t0;
  }

  let unhook = null;
  function attach(f) {
    folk = f;
    // the painter only for its verbatim materials (folkPaintMat, depthOnlyMat) and gouache settings G; its own
    // targets are never made. It renders with HER camera; the folk simulate with the flat one (ctx.camera).
    painter = createPainter({ ...ctx, camera }, folk);
    painter.setMode(1);
    if (unhook) unhook();
    unhook = planet.renderHook({
      beforeRender() { adapter.syncFlatCamera(); adapter.hideFlat(); },
      afterFinish() {
        adapter.showFlat();
        stats.frames++;
        if (!enabled || planet.altitude > maxAltitude || !targets()) { stats.skipped++; return; }
        aimLight();
        stats.mapped = adapter.mapFolk(folk);
        try { renderFolkPass(); } finally { adapter.restore(); }
      }
    });
    return api;
  }

  const api = {
    backdrop, attach, stats, aimLight,
    get painter() { return painter; }, get folk() { return folk; },
    get targets() { return { rtEyes, rtFolkPaint, w, h, shared: !!sharedDepth }; },
    setEnabled(v) { enabled = !!v; },
    setKeyMode(m) { keyMode = m; },
    setDepth(m) { depth = m; rtEyes && (sharedDepth = 'x'); },   // forces a target rebuild
    dispose() { if (unhook) unhook(); unhook = null; lights.removeFromParent(); if (rtEyes) { rtEyes.dispose(); rtFolkPaint.dispose(); } }
  };
  return api;
}
