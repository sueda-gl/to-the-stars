// "Pencil, then paint": the creation moment.
//  sketch  — the object exists only in the keyline world: its parts are pushed into ctx.lineOnly, so the
//            painter makes them visible for the normal/depth pass alone and only pencil lines land on the paper.
//            The lines draw on part by part (big masses first, ground up, small details last); doors and windows
//            draw through their sketch ridges (api.js), so the drawing has its openings.
//  paint   — the parts come back to the colour pass behind a brushy wash front (a clip injected into cloned
//            materials: ragged front, fingers of colour creeping ahead of it, a darker wet edge). The front
//            sweeps UP THE SCREEN: it compares each fragment's screen height, so at eye level it climbs from the
//            ground and from the leader's bird's-eye it travels from the near eaves to the far ones. Whatever
//            covers something else on screen is painted at the same moment as what it covers, so the object is
//            never seen as a hollow cutaway (a painted floor under an unpainted roof). Shadows arrive part by part once the wash
//            has passed them. onBloom lets the world bloom colour into the paper around the footprint.
//  done    — original materials back, every list as before; library objects go back to their compact form.
//
//   const r = createReveal(ctx, object, { mode: 'wash' | 'parts', onBloom, onPaint, onDone, camera });
//   r.hide(); await r.sketch(1); await r.paint(4); r.done();
//   r.setSketch(p) / r.setPaint(p)     // drive it yourself (construction sites, screenshots); p in 0..1
//   r.progress, r.state                // 'idle' | 'hidden' | 'sketch' | 'painting' | 'done'

const REVEAL_PARS = `
uniform float uRevealY, uRevealK; uniform vec3 uRevealC; varying vec3 vRW; varying vec4 vRC;
float rvH(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float rvN(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(rvH(i), rvH(i+vec2(1.0,0.0)), f.x), mix(rvH(i+vec2(0.0,1.0)), rvH(i+vec2(1.0,1.0)), f.x), f.y); }
float agoraReveal(){
  vec3 q = vRW - uRevealC;
  float s = vRC.y / vRC.w;                              // the fragment's height on the screen (NDC)
  float k = uRevealK;                                   // NDC per metre at the object: the brush is sized in metres
  float ang = atan(q.z, q.x + 1e-4);
  // a ragged wash front: a slow wobble round the object, bristle noise, fine grain
  float edge = uRevealY + k * (
      0.34 * (rvN(vec2(ang * 1.9 + 3.0, uRevealC.x * 0.1)) - 0.5)
    + 0.24 * (rvN(vRW.xz * 1.6 + vec2(vRW.y * 0.5, 0.0)) - 0.5)
    + 0.08 * (rvN(vRW.xz * 7.0 + vRW.y * 3.0) - 0.5));
  // fingers of colour creep ahead of the front: a smooth lift of the edge itself, so they always stay joined to it
  edge += k * 0.32 * smoothstep(0.58, 0.92, rvN(vec2(ang * 3.1, s / max(k, 1e-4) * 0.6) + vRW.xz * 0.9 + 7.0));
  if (s > edge) discard;
  return 1.0 - 0.17 * smoothstep(edge - 0.24 * k, edge, s);   // the wet edge pools darker
}
`;
const VERT_WORLD = `
  { vec4 rvP = vec4(position, 1.0);
    #ifdef USE_INSTANCING
      rvP = instanceMatrix * rvP;
    #endif
    vRW = (modelMatrix * rvP).xyz; }
`;
const VERT_CLIP = '\n  vRC = gl_Position;\n';   // after gl_Position is written: the clip position, divided per fragment
const MAIN = /void\s+main\s*\(\s*\)\s*\{/;

export function createReveal(ctx, object, { mode = 'wash', onBloom = null, onPaint = null, onDone = null, camera = null } = {}) {
  const { lineOnly, colourOnly } = ctx;
  const cam = () => camera || ctx.camera;
  const U = { uRevealY: { value: 1e4 }, uRevealK: { value: 0.05 }, uRevealC: { value: new THREE.Vector3() } };
  const clones = new Map();
  let state = 'idle', progress = 0, raf = 0, token = 0;
  const box = new THREE.Box3(), centre = new THREE.Vector3(), size = new THREE.Vector3();
  const full = () => { if (typeof object.agoraForm === 'function') object.agoraForm('full'); };
  full();   // a compact library object: work on its real parts

  // ---------- parts ----------
  const parts = [], ridges = [];
  object.traverse(o => {
    if (!o.isMesh) return;
    if (o.userData.agoraSketch) { ridges.push(o); return; }
    const line = !!o.userData.agoraLine || lineOnly.includes(o);
    const colour = !line && (!!o.userData.agoraColour || colourOnly.includes(o));
    parts.push({ m: o, kind: line ? 'line' : colour ? 'colour' : 'solid', mat: o.material, cast: o.castShadow, top: 0, order: 0 });
  });
  function measure() {
    object.updateMatrixWorld(true);
    box.makeEmpty();
    const b = new THREE.Box3(), maxVol = { v: 1e-6 };
    parts.forEach(p => {
      b.setFromObject(p.m);   // r128 setFromObject uses the geometry (precise enough for order)
      if (p.m.isInstancedMesh) { p.box = null; return; }
      p.box = b.clone(); const s = b.getSize(new THREE.Vector3()); p.vol = s.x * s.y * s.z + 1e-6; maxVol.v = Math.max(maxVol.v, p.vol);
      box.union(b);
    });
    if (box.isEmpty()) box.setFromObject(object);
    box.getCenter(centre); box.getSize(size);
    const H = Math.max(0.5, size.y);
    parts.forEach(p => {
      if (!p.box) { p.order = 0.6; return; }
      const vf = p.vol / maxVol.v, small = vf < 0.015;
      p.order = (p.box.min.y - box.min.y) / H * 0.65 + (1 - Math.sqrt(vf)) * 0.2 + (small ? 0.4 : 0);
    });
    parts.sort((a, b) => a.order - b.order);
    // ridges draw with the small details: after the part that holds them
    ridges.forEach(r => { r.userData.order = 0.75; });
    U.uRevealC.value.copy(centre);
  }
  // the sweep runs in screen height (NDC y): the object's span on screen, and how many NDC units a metre is there
  const _p = new THREE.Vector3(), _q = new THREE.Vector3(), _u = new THREE.Vector3();
  function sweep(c = cam()) {
    if (!c) return [box.min.y, box.max.y];
    c.updateMatrixWorld();
    const range = bx => { let lo = Infinity, hi = -Infinity; for (let i = 0; i < 8; i++) { _p.set(i & 1 ? bx.max.x : bx.min.x, i & 2 ? bx.max.y : bx.min.y, i & 4 ? bx.max.z : bx.min.z).project(c); lo = Math.min(lo, _p.y); hi = Math.max(hi, _p.y); } return [lo, hi]; };
    const [lo, hi] = range(box);
    _u.setFromMatrixColumn(c.matrixWorld, 1).normalize();
    _p.copy(centre).project(c); _q.copy(centre).add(_u).project(c);
    U.uRevealK.value = Math.max(1e-4, Math.abs(_q.y - _p.y));
    parts.forEach(p => { p.top = p.box ? range(p.box)[1] : hi; });
    return [lo, hi];
  }

  // ---------- list membership ----------
  const inL = m => lineOnly.includes(m), inC = m => colourOnly.includes(m);
  const addL = m => { if (!inL(m)) lineOnly.push(m); }, delL = m => { const i = lineOnly.indexOf(m); if (i >= 0) lineOnly.splice(i, 1); };
  const addC = m => { if (!inC(m)) colourOnly.push(m); }, delC = m => { const i = colourOnly.indexOf(m); if (i >= 0) colourOnly.splice(i, 1); };
  function hidePart(p) { delL(p.m); delC(p.m); p.m.visible = false; p.m.castShadow = false; }
  function sketchPart(p) {   // keyline world only
    p.m.material = p.mat; p.m.castShadow = false;
    if (p.kind === 'colour') { delC(p.m); p.m.visible = false; return; }   // leaves etc. draw through their proxies
    delC(p.m); addL(p.m); p.m.visible = false;
  }
  function paintPart(p, clip) {
    if (p.kind === 'line') { addL(p.m); p.m.visible = false; return; }
    delL(p.m); p.m.visible = true;
    if (p.kind === 'colour') addC(p.m);
    p.m.material = clip ? clipOf(p.mat) : p.mat;
    if (clip && !p.hooked) { p.hooked = p.m.onBeforeRender; p.m.onBeforeRender = follow; }
  }
  // the front lives in SCREEN height, so it is re-aimed for whichever camera renders the frame (the player may pan
  // or the descent may move while a site sits at 40 % for half a minute): once per camera pose, cheap
  let camKey = '';
  function follow(renderer, scene, camera) {
    if (state !== 'painting' || mode === 'parts' || !camera || !camera.isCamera) return;
    const e = camera.matrixWorld.elements, pe = camera.projectionMatrix.elements;
    const key = e[8].toFixed(4) + e[9].toFixed(4) + e[10].toFixed(4) + e[12].toFixed(3) + e[13].toFixed(3) + e[14].toFixed(3) + pe[5].toFixed(4) + pe[0].toFixed(4);
    if (key === camKey) return;
    camKey = key; aim(camera);
  }
  function aim(camera) {
    const [lo, hi] = sweep(camera), k = U.uRevealK.value, y0 = lo - 0.45 * k, y1 = hi + 0.6 * k;
    U.uRevealY.value = y0 + (y1 - y0) * progress;
    return U.uRevealY.value;
  }
  function unhook() { parts.forEach(p => { if (p.hooked !== undefined) { p.m.onBeforeRender = p.hooked; p.hooked = undefined; } }); }
  const ridgesOn = on => ridges.forEach(r => { r.visible = false; if (on) addL(r); else delL(r); });
  function restore() {
    parts.forEach(p => {
      p.m.material = p.mat; p.m.castShadow = p.cast;
      if (p.kind === 'line') { addL(p.m); p.m.visible = false; }
      else { delL(p.m); p.m.visible = true; if (p.kind === 'colour') addC(p.m); }
    });
    ridgesOn(false);
  }

  // ---------- the wash: clip-cloned materials ----------
  function clipOf(mat) {
    if (Array.isArray(mat)) return mat.map(clipOf);
    if (clones.has(mat)) return clones.get(mat);
    let c;
    if (mat.isShaderMaterial) {
      c = mat.clone();
      Object.assign(c.uniforms, U);
      c.vertexShader = 'varying vec3 vRW; varying vec4 vRC;\n' + mat.vertexShader.replace(MAIN, m => m + VERT_WORLD);
      const lv = c.vertexShader.lastIndexOf('}');
      c.vertexShader = c.vertexShader.slice(0, lv) + VERT_CLIP + c.vertexShader.slice(lv);
      c.fragmentShader = REVEAL_PARS + mat.fragmentShader.replace(MAIN, m => m + '\n  float rvWet = agoraReveal();\n');
      const last = c.fragmentShader.lastIndexOf('}');
      c.fragmentShader = c.fragmentShader.slice(0, last) + '  gl_FragColor.rgb *= rvWet;\n' + c.fragmentShader.slice(last);
    } else {
      c = mat.clone();
      c.onBeforeCompile = shader => {
        Object.assign(shader.uniforms, U);
        shader.vertexShader = 'varying vec3 vRW; varying vec4 vRC;\n' + shader.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n' + VERT_WORLD + VERT_CLIP);
        shader.fragmentShader = REVEAL_PARS + shader.fragmentShader
          .replace(MAIN, m => m + '\n  float rvWet = agoraReveal();\n')
          .replace('#include <dithering_fragment>', 'gl_FragColor.rgb *= rvWet;\n#include <dithering_fragment>');
      };
      c.customProgramCacheKey = () => 'agora-reveal-3';
    }
    clones.set(mat, c);
    return c;
  }
  function disposeClones() { clones.forEach(c => c.dispose()); clones.clear(); }

  // ---------- phases ----------
  const ease = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  function hide() { stop(); full(); measure(); rawPaint = 0; parts.forEach(hidePart); ridgesOn(false); state = 'hidden'; progress = 0; return api; }
  function _sketch(p) {
    if (state === 'idle' || state === 'done') { full(); measure(); }
    state = 'sketch'; progress = Math.max(0, Math.min(1, p));
    const n = Math.ceil(progress * parts.length);
    parts.forEach((part, i) => (i < n ? sketchPart(part) : hidePart(part)));
    ridgesOn(progress >= 0.7);   // the openings are the last marks of the drawing
    if (onBloom) onBloom({ x: centre.x, z: centre.z, radius: 0, p: 0 });
    return api;
  }
  function _paint(p) {
    if (state !== 'painting') { full(); measure(); state = 'painting'; }
    progress = Math.max(0, Math.min(1, p));
    ridgesOn(progress < 0.5);   // the drawn openings give way to the ink as the paint arrives
    if (mode === 'parts') {
      const n = Math.ceil(progress * parts.length);
      parts.forEach((part, i) => { if (i < n) { paintPart(part, false); part.m.castShadow = part.cast; } else sketchPart(part); });
    } else {
      camKey = '';
      const y = aim(cam()), k = U.uRevealK.value;
      // shadows arrive once the wash has passed a part AND most of the object is paint (so no shadow is seen
      // falling on the paper through a roof that is still only a drawing)
      parts.forEach(part => { paintPart(part, true); part.m.castShadow = part.cast && progress > 0.55 && y > part.top + 0.2 * k; });
    }
    const r = Math.max(size.x, size.z) * 0.5 + 0.6;
    if (onBloom) onBloom({ x: centre.x, z: centre.z, radius: r * (0.35 + 1.25 * (1 - Math.pow(1 - progress, 2))), p: progress });
    if (onPaint) onPaint(progress);
    return api;
  }
  let rawPaint = 0;
  const setSketch = p => { stop(); return _sketch(p); };
  const setPaint = p => { stop(); rawPaint = p; return _paint(p); };
  function done() {
    stop(); restore(); unhook(); disposeClones(); U.uRevealY.value = 1e4;
    const was = state; state = 'done'; progress = 1;
    if (typeof object.agoraForm === 'function') object.agoraForm('compact');
    if (was !== 'done' && onDone) onDone();
    return api;
  }
  function stop() { token++; if (raf) cancelAnimationFrame(raf); raf = 0; }
  function run(seconds, from, step) {
    stop(); const my = token;
    if (!(seconds > 0)) { step(1); return Promise.resolve(); }
    return new Promise(res => {
      const t0 = performance.now(), slow = ctx.reduceMotion ? 0.6 : 1;
      const tick = now => {
        if (my !== token) return res();
        const k = Math.min(1, (now - t0) / 1000 / (seconds / slow));
        step(from + (1 - from) * k);
        if (k < 1) raf = requestAnimationFrame(tick); else { raf = 0; res(); }
      };
      raf = requestAnimationFrame(tick);
    });
  }
  function sketch(seconds = 1) {
    if (state !== 'sketch' && state !== 'hidden') hide();
    const from = state === 'sketch' ? progress : 0;
    return run(seconds, from, p => _sketch(p));
  }
  function paint(seconds = 4) {
    if (state === 'idle' || state === 'hidden' || state === 'done') _sketch(1);
    const from = state === 'painting' ? rawPaint : 0;
    return run(seconds, from, p => { rawPaint = p; _paint(ease(p)); });
  }

  const api = {
    hide, sketch, paint, done, setSketch, setPaint, stop,
    get progress() { return progress; }, get state() { return state; },
    get box() { return box; }, parts, ridges
  };
  return api;
}
