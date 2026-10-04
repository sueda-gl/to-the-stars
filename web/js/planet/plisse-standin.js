// Plissé, seen from Earth's space: a stand-in of Sueda's "Plissé — the lantern planet" for the Tower Planet's sky
// (ART_DIRECTION §16). The real world is web/worlds/plisse.html (byte-identical to reference/, never edited); this is
// only what Earth sees of it from a distance, and the body the voyage flies toward before it cross-fades into the
// original.
//
// What is recreated from the reference (its maths copied verbatim below, so the silhouette and the colours are hers):
//   - the planet: surf() — 46 pleats, the wire ribs at lat ±0.95, the flat red end caps, fbm relief — on the same
//     368 x 200 sphere turned so its lantern axis points at its own star; the same vertex colours (day cream, dusk
//     olive / mustard ring with teal pools, night navy, red ribs + caps) and the same `glow` (warm light leaking
//     through the night folds, the far cap, the dusk-ring lantern patches);
//   - its thin warm atmosphere (her shader), the two moons (the pleated red one and the bead) on her orbits;
//   - the 190 shadelings and 7 elder lanterns, placed from her own random sequence (mulberry32(11), same call order)
//     and moving by her formulas, so at the end of the approach they stand where the original draws them.
// What is the Tower Planet's: the shading is banded like her toon ramp, and the whole thing renders inside her scene,
// so her Grain finish (6-level dither + grain + ink outline, her fisheye lens) paints it like the Earth.
// Lighting: its own star direction (fixed, as in the reference), not the Tower Planet's camera-following sun, so
// the day end, dusk ring and night side sit where the original has them. Values are lit and tone-mapped like her
// r147 MeshStandard + ACES (linear colours, key #ffe2b0 x 1.25, hemisphere #4a5694 / #140f1c x 0.32).
//
// Needs the global THREE (the Tower Planet's vendored r128). See docs/plisse.md.

/* ---------- Plissé's maths, verbatim from reference/plisse-the-lantern-planet.html (lines 98-113, 174-193) ---------- */
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
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
const tri = x => 1 - Math.abs(2 * (x - Math.floor(x)) - 1);

// her constants: the planet radius, the pleat count, her star, and the lantern frame (A = axis to the star)
export const PLISSE = {
  R: 10, N_PLEATS: 46, SUN: [-1, 0.16, 0.05],
  // the opening camera of plisse.html: (7, 8, 41) looking at the origin, fov 38 (landscape), OrbitControls
  // autoRotate 0.18 (theta falls 2*pi/3600*0.18 rad per frame), distance limits 14..75
  CAMERA: { position: [7, 8, 41], target: [0, 0, 0], fov: 38, min: 14, max: 75, autoRotateSpeed: 0.18 },
  RIM: 10.33   // the silhouette radius (R * (1 + mean pleat lift)), used to match apparent sizes
};
// her fov rule (resize): portrait windows widen it
export const plisseFov = aspect => aspect < 1 ? Math.min(70, 38 / Math.pow(aspect, 0.7)) : 38;

function lanternFrame() {
  const A = new THREE.Vector3(...PLISSE.SUN).normalize();
  const B = new THREE.Vector3().crossVectors(A, new THREE.Vector3(0, 1, 0)).normalize();
  const Cc = new THREE.Vector3().crossVectors(A, B).normalize();
  return { A, B, Cc };
}
const { A, B, Cc } = (typeof THREE !== 'undefined') ? lanternFrame() : { A: null, B: null, Cc: null };
const R = PLISSE.R, N_PLEATS = PLISSE.N_PLEATS;
function surf(n) {
  const lat = Math.asin(Math.max(-1, Math.min(1, n.dot(A))));
  const lon = Math.atan2(n.dot(Cc), n.dot(B));
  const t = tri(lon / (Math.PI * 2) * N_PLEATS);
  const fold = t * t * (3 - 2 * t);
  const band = Math.pow(Math.cos(lat), 0.6);
  const big = fbm(n.x * 1.6 + 3, n.y * 1.6, n.z * 1.6, 3);
  let r = 1 + 0.032 * fold * band * (0.55 + 0.9 * big) + 0.014 * (fbm(n.x * 4, n.y * 4, n.z * 4, 3) - 0.5);
  const rib = l => Math.exp(-Math.pow((lat - l) / 0.022, 2));
  r += 0.011 * (rib(0.95) + rib(-0.95));
  r += 0.018 * smooth(1.2, 1.24, Math.abs(lat));
  return { r: R * r, lat, lon, fold, big };
}

/* ---------- shading: her r147 lighting, banded like the Tower Planet's toon ramp ---------- */
const lin = hex => new THREE.Color(hex).convertSRGBToLinear();   // r147 with legacyMode=false stores colours linear
const SHADE_VERT = `
  #ifdef VCOL
  attribute vec3 color;
  #endif
  #ifdef GLOW
  attribute float glow;
  #endif
  #ifdef ICOL
  attribute vec3 aCol;
  #endif
  uniform vec3 uColor;
  varying vec3 vN; varying vec3 vW; varying vec3 vCol; varying float vGlow;
  void main(){
    #ifdef USE_INSTANCING
      mat4 m = modelMatrix * instanceMatrix;
    #else
      mat4 m = modelMatrix;
    #endif
    vec4 w = m * vec4(position, 1.0); vW = w.xyz; vN = normalize(mat3(m) * normal);
    vCol = uColor;
    #ifdef VCOL
      vCol = color;
    #endif
    #ifdef ICOL
      vCol = aCol;
    #endif
    vGlow = 0.0;
    #ifdef GLOW
      vGlow = glow;
    #endif
    gl_Position = projectionMatrix * viewMatrix * w;
  }`;
const SHADE_FRAG = `
  uniform vec3 uStar, uKey, uSky, uGround, uEmissive; uniform float uKeyI, uHemiI, uGlowAmt, uToon, uFade, uSat, uMatch;
  varying vec3 vN; varying vec3 vW; varying vec3 vCol; varying float vGlow;
  vec3 RRTAndODTFit(vec3 v){ vec3 a = v * (v + 0.0245786) - 0.000090537; vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081; return a / b; }
  vec3 aces(vec3 color){   // three r147 ACESFilmicToneMapping, exposure 1
    const mat3 I = mat3(vec3(0.59719, 0.07600, 0.02840), vec3(0.35458, 0.90834, 0.13383), vec3(0.04823, 0.01566, 0.83777));
    const mat3 O = mat3(vec3(1.60475, -0.10208, -0.00327), vec3(-0.53108, 1.10813, -0.07276), vec3(-0.07367, -0.00605, 1.07602));
    color *= 1.0 / 0.6; color = I * color; color = RRTAndODTFit(color); color = O * color; return clamp(color, 0.0, 1.0);
  }
  vec3 toSRGB(vec3 c){ c = max(c, 0.0); return mix(c * 12.92, pow(c, vec3(1.0 / 2.4)) * 1.055 - 0.055, step(0.0031308, c)); }
  void main(){
    vec3 n = normalize(vN);
    float lam = max(dot(n, uStar), 0.0);
    // the Tower Planet's toon read: four soft-edged value steps, centred so the mean stays her lambert
    float f = fract(lam * 4.0);
    float band = (floor(lam * 4.0) + smoothstep(0.35, 0.65, f)) / 4.0;
    float k = mix(lam, band, uToon);
    vec3 hemi = mix(uGround, uSky, 0.5 * n.y + 0.5);
    vec3 rad = vCol * (uKey * uKeyI * k + hemi * uHemiI) + uEmissive + vec3(1.0, 0.5, 0.18) * vGlow * uGlowAmt;
    vec3 c = toSRGB(aces(rad));
    // near the cross-fade: her gouache body's value grade (compPass: x1.1 chroma, then 0.87 + lifted blacks), so the last
    // frames before the fade carry the original's muted paper values
    vec3 g = mix(vec3(dot(c, vec3(0.299, 0.587, 0.114))), c, 1.1); g = mix(g, g * 0.87 + vec3(0.07, 0.066, 0.06), 0.85);
    c = mix(c, g, uMatch);
    c = mix(vec3(dot(c, vec3(0.299, 0.587, 0.114))), c, uSat);   // undo her Grain grade (x1.22) so its colours land as Plissé's
    gl_FragColor = vec4(c * uFade, 1.0);
  }`;

export function createPlisseStandin(target, opts = {}) {
  const {
    position = null, radius = 74, detail = 1, toon = 1, toonNear = 0.35, sat = 1 / 1.22, moons: withMoons = true, folk: withFolk = true,
    name = 'plisse-standin'
  } = opts;
  const planet = target && target.scene && target.camera ? target : null;
  const scene = planet ? planet.scene : target;
  const s = radius / R;                                   // world units per Plissé unit

  const group = new THREE.Group(); group.name = name;
  group.scale.setScalar(s);
  if (position) group.position.copy(Array.isArray(position) ? new THREE.Vector3(...position) : position);
  scene.add(group);

  const shared = {
    uStar: { value: A.clone() }, uKey: { value: lin('#ffe2b0') }, uKeyI: { value: 1.25 },
    uSky: { value: lin('#4a5694') }, uGround: { value: lin('#140f1c') }, uHemiI: { value: 0.32 },
    uGlowAmt: { value: 0.8 }, uToon: { value: toon }, uFade: { value: 1 }, uSat: { value: sat }, uMatch: { value: 0 }
  };
  const mats = [];
  function shadeMat({ color = '#ffffff', emissive = null, ei = 1, defines = {} } = {}) {
    const m = new THREE.ShaderMaterial({
      uniforms: { ...shared, uColor: { value: lin(color) }, uEmissive: { value: emissive ? lin(emissive).multiplyScalar(ei) : new THREE.Color(0, 0, 0) } },
      vertexShader: SHADE_VERT, fragmentShader: SHADE_FRAG, defines, fog: false
    });
    mats.push(m);
    return m;
  }

  /* ---------- the planet: her vertex loop (reference lines 194-237), same resolution by default ---------- */
  {
    const W = Math.round(368 * detail), H = Math.round(200 * detail);
    const geo = new THREE.SphereGeometry(1, W, H);
    geo.applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), A)));   // r128: no applyQuaternion
    const pos = geo.attributes.position, n = new THREE.Vector3();
    const col = new Float32Array(pos.count * 3), glow = new Float32Array(pos.count);
    const cream = lin('#d9ceb0'), creamWarm = lin('#dcbf84'), olive = lin('#6f7f2f'), oliveD = lin('#4e5e22'), mustard = lin('#e2b13c'), pool = lin('#2b4844'),
      navy = lin('#273058'), navyL = lin('#36407a'), red = lin('#b8432a'), c = new THREE.Color(), d = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      n.fromBufferAttribute(pos, i).normalize();
      const sf = surf(n);
      pos.setXYZ(i, n.x * sf.r, n.y * sf.r, n.z * sf.r);
      const day = smooth(0.12, 0.42, sf.lat), night = smooth(-0.1, -0.42, sf.lat), dusk = Math.max(0, 1 - day - night);
      const m = fbm(n.x * 7, n.y * 7, n.z * 7, 3);
      c.copy(cream).lerp(creamWarm, smooth(0.9, 1.4, sf.lat) * 0.8 + (m - 0.5) * 0.3).multiplyScalar(day);
      d.copy(oliveD).lerp(olive, m).lerp(mustard, smooth(0.62, 0.72, fbm(n.x * 11 + 4, n.y * 11, n.z * 11, 2)) * 0.85);
      if (sf.fold < 0.14 && sf.big > 0.52) d.lerp(pool, 0.85);
      c.add(d.multiplyScalar(dusk));
      d.copy(navy).lerp(navyL, sf.fold * 0.6); c.add(d.multiplyScalar(night));
      const ribs = Math.exp(-Math.pow((sf.lat - 0.95) / 0.03, 2)) + Math.exp(-Math.pow((sf.lat + 0.95) / 0.03, 2)) + smooth(1.2, 1.23, Math.abs(sf.lat));
      c.lerp(red, Math.min(1, ribs));
      col.set([c.r, c.g, c.b], i * 3);
      let g = night * Math.pow(1 - sf.fold, 4) * (0.2 + 0.8 * smooth(0.35, 0.7, sf.big)) * 0.4;
      g += smooth(-1.18, -1.32, sf.lat) * 1.1;
      g += dusk * smooth(0.82, 0.92, vnoise(n.x * 18, n.y * 18, n.z * 18)) * 0.8 * smooth(0.06, -0.08, sf.lat);
      glow[i] = g;
    }
    geo.computeVertexNormals();
    const nr = geo.attributes.normal, WW = W + 1;
    for (let row = 0; row <= H; row++) {
      const a = row * WW, b = a + W;
      for (let k = 0; k < 3; k++) { const v = (nr.array[a * 3 + k] + nr.array[b * 3 + k]) / 2; nr.array[a * 3 + k] = nr.array[b * 3 + k] = v; }
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('glow', new THREE.BufferAttribute(glow, 1));
    const body = new THREE.Mesh(geo, shadeMat({ defines: { VCOL: '', GLOW: '' } }));
    body.name = 'plisse-body';
    group.add(body);
  }
  // her thin warm atmosphere (lines 240-253), brightest along the dusk ring; she adds it in linear light before
  // the sRGB step, here it is added on screen values, so it is encoded first and kept a touch fainter
  const atmoMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    uniforms: { sunDir: { value: A.clone() }, uFade: shared.uFade, uAtmo: { value: 0.85 } },
    vertexShader: 'varying vec3 vN; varying vec3 vW; void main(){ vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `uniform vec3 sunDir; uniform float uFade, uAtmo; varying vec3 vN; varying vec3 vW;
      vec3 toSRGB(vec3 c){ c = max(c, 0.0); return mix(c * 12.92, pow(c, vec3(1.0 / 2.4)) * 1.055 - 0.055, step(0.0031308, c)); }
      void main(){
        float f = 1.0 - max(dot(normalize(cameraPosition - vW), vN), 0.0); f = pow(f, 2.6);
        float s = dot(vN, sunDir);
        vec3 col = mix(vec3(0.18, 0.22, 0.5), vec3(0.95, 0.85, 0.66), smoothstep(-0.25, 0.4, s));
        col = mix(col, vec3(1.0, 0.55, 0.28), exp(-pow(s * 4.0, 2.0)) * 0.9);
        gl_FragColor = vec4(toSRGB(col * f * (0.12 + 0.9 * smoothstep(-0.6, 0.15, s))) * uAtmo * uFade, 1.0);
      }`
  });
  const atmo = new THREE.Mesh(new THREE.SphereGeometry(R * 1.07, 96, 64), atmoMat);
  atmo.name = 'plisse-atmosphere';
  group.add(atmo);

  /* ---------- her random sequence: stars (unused here), then the shadelings, then the elders ---------- */
  const rand = mulberry32(11);
  const rr = (a, b) => a + (b - a) * rand();
  for (const count of [900, 220, 60]) for (let i = 0; i < count; i++) { rr(-1, 1); rr(-1, 1); rr(-1, 1); }   // her painted stars

  /* ---------- moons: a pleated red one and a bead (lines 256-264) ---------- */
  const moons = [];
  if (withMoons) {
    const g = new THREE.SphereGeometry(1, 96, 48), p = g.attributes.position, v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const l = Math.atan2(v.z, v.x); v.multiplyScalar(1 + 0.06 * tri(l / (Math.PI * 2) * 18) * Math.sqrt(Math.max(0, 1 - v.y * v.y))); p.setXYZ(i, v.x, v.y, v.z); }
    g.computeVertexNormals();
    const m1 = new THREE.Mesh(g, shadeMat({ color: '#b8432a' })); m1.scale.setScalar(0.95); group.add(m1);
    const m2 = new THREE.Mesh(new THREE.SphereGeometry(0.6, 32, 20), shadeMat({ color: '#e2b13c', emissive: '#ffc266', ei: 0.15 })); group.add(m2);
    m1.name = 'plisse-moon-red'; m2.name = 'plisse-moon-bead';
    moons.push({ m: m1, r: 19, speed: 0.045, inc: 0.32, ph: 0.8, spin: 0.2 }, { m: m2, r: 15.5, speed: 0.09, inc: -0.5, ph: 2.6, spin: 0 });
  }

  /* ---------- shadelings + elder lanterns, where she puts them (lines 266-347) ---------- */
  const SH_N = 190;
  const palette = ['#e2b13c', '#b8432a', '#efe6cc', '#8a8f3a', '#3e4a78', '#e08a3a'];
  const walkers = [], elders = [];
  for (let i = 0; i < SH_N; i++) walkers.push({ lat: (rand() + rand() - 1) * 0.14 + 0.01, lon: rr(-Math.PI, Math.PI), w: rr(0.006, 0.013), ph: rr(0, 6), wob: rr(0.5, 1.2), k: rr(0.75, 1.1) });
  const elderScale = [];
  for (let i = 0; i < 7; i++) { elderScale.push(rr(2.2, 2.9)); elders.push({ lat: rr(-0.06, 0.08), lon: -Math.PI + i * (Math.PI * 2 / 7) + rr(-0.2, 0.2), ph: rr(0, 6) }); }
  for (const w of walkers) w.lon0 = w.lon;
  for (const e of elders) e.lon0 = e.lon;

  let folk = null;
  if (withFolk) {
    const shBodyGeo = (() => {
      const g = new THREE.CylinderGeometry(0.052, 0.115, 0.17, 24, 1);
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), f = Math.abs(Math.cos(Math.atan2(z, x) * 14)); p.setX(i, x * (1 + 0.08 * f)); p.setZ(i, z * (1 + 0.08 * f)); }
      g.computeVertexNormals(); g.translate(0, 0.085, 0); return g;
    })();
    const shCapGeo = new THREE.SphereGeometry(0.056, 12, 5, 0, Math.PI * 2, 0, Math.PI / 2);
    const shBeadGeo = new THREE.SphereGeometry(0.02, 8, 6);
    const shLegGeo = new THREE.CylinderGeometry(0.006, 0.011, 0.2, 5); shLegGeo.translate(0, -0.1, 0);
    const shAntGeo = new THREE.CylinderGeometry(0.004, 0.004, 0.15, 4); shAntGeo.translate(0, 0.26, 0.04);
    const bodyGeo = shBodyGeo.clone();
    const aCol = new Float32Array(SH_N * 3);
    for (let i = 0; i < SH_N; i++) lin(palette[i % palette.length]).toArray(aCol, i * 3);
    bodyGeo.setAttribute('aCol', new THREE.InstancedBufferAttribute(aCol, 3));
    const dark = shadeMat({ color: '#3a2418' });
    const beadMat = shadeMat({ color: '#ffd68a', emissive: '#ffc266', ei: 2.2 });
    const capMat = shadeMat({ color: '#f3ecd8' });
    const parts = {
      body: new THREE.InstancedMesh(bodyGeo, shadeMat({ defines: { ICOL: '' } }), SH_N),
      cap: new THREE.InstancedMesh(shCapGeo, capMat, SH_N),
      bead: new THREE.InstancedMesh(shBeadGeo, beadMat, SH_N),
      legL: new THREE.InstancedMesh(shLegGeo, dark, SH_N),
      legR: new THREE.InstancedMesh(shLegGeo, dark, SH_N)
    };
    Object.values(parts).forEach(m => { m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.frustumCulled = false; group.add(m); });
    const elderGroups = elders.map((e, i) => {
      const g = new THREE.Group();
      const body = new THREE.Mesh(shBodyGeo, shadeMat({ color: palette[(i * 2) % 6] })); body.scale.y = 2.4; body.position.y = 0.2; g.add(body);
      const cap = new THREE.Mesh(shCapGeo, capMat); cap.position.y = 0.2 + 0.17 * 2.4; g.add(cap);
      const ant = new THREE.Mesh(shAntGeo, dark); ant.position.y = 0.2 + 0.17 * 2.4 - 0.19; g.add(ant);
      const bead = new THREE.Mesh(shBeadGeo, beadMat); bead.position.set(0, 0.2 + 0.17 * 2.4 - 0.19 + 0.33, 0.09); bead.scale.setScalar(1.4); g.add(bead);
      for (const sx of [-1, 1]) { const l = new THREE.Mesh(shLegGeo, dark); l.position.set(0.035 * sx, 0.2, 0); g.add(l); }
      g.scale.setScalar(elderScale[i]);
      group.add(g);
      return g;
    });
    folk = { parts, elderGroups };
  }

  const eul = new THREE.Euler(), mBody = new THREE.Matrix4();
  const vN = new THREE.Vector3(), vF = new THREE.Vector3(), vX = new THREE.Vector3(), mB = new THREE.Matrix4(), mP = new THREE.Matrix4(), mT = new THREE.Matrix4(), qB = new THREE.Quaternion(), vS = new THREE.Vector3(), vP = new THREE.Vector3();
  function placeOnSurface(lat, lon, out) {
    vN.copy(A).multiplyScalar(Math.sin(lat)).addScaledVector(B, Math.cos(lat) * Math.cos(lon)).addScaledVector(Cc, Math.cos(lat) * Math.sin(lon)).normalize();
    vF.copy(B).multiplyScalar(-Math.sin(lon)).addScaledVector(Cc, Math.cos(lon)).normalize();
    vX.crossVectors(vN, vF).normalize();
    out.makeBasis(vX, vN, vF);
    const r = surf(vN).r;
    out.setPosition(vN.x * r, vN.y * r, vN.z * r);
    return out;
  }
  function setPart(mesh, i, base, x, y, z, rx, rz) {
    mT.makeRotationFromEuler(eul.set(rx, 0, rz)); mT.setPosition(x, y, z);
    mP.multiplyMatrices(base, mT); mesh.setMatrixAt(i, mP);
  }

  /* ---------- time: its own, or plisse.html's clock (so the moons and folk meet the original at the fade) ---------- */
  let nearFrac = 1;   // the stand-in's apparent radius as a fraction of half the view height (set by toonFor)
  let tOwn = 0, off = 0, offFrom = 0, offT0 = -1, offMs = 2500, clockSrc = null;
  // the walkers' clock: hers is a sum of per-frame dt (each <= 0.05 s), so it falls behind her scene clock whenever her
  // page is frozen or slow (plisse-driver.js throttle / slow frames). With a `walk` source (driver.walkTime) the folk
  // follow it (eased like the scene clock), so they still stand where she draws them at the cross-fade; without one
  // they run on the scene clock as before.
  let walkOff = 0, walkFrom = 0, walkSrc = null;
  const sceneTime = () => tOwn + off;
  const walkTime = () => tOwn + walkOff;
  function syncClock(fn, { ms = 2500, walk = null } = {}) {
    clockSrc = fn || null; walkSrc = typeof walk === 'function' ? walk : null; offMs = ms; offFrom = off; walkFrom = walkOff; offT0 = clockSrc ? tOwn : -1;
    if (!clockSrc) { /* keep the current offset: no jump when the source goes away */ }
  }
  function update(dt = 1 / 60) {
    tOwn += Math.min(dt, 0.25);
    if (clockSrc) {
      let target = null, wt = null;
      try { target = clockSrc(); } catch (e) { target = null; }
      if (walkSrc) { try { wt = walkSrc(); } catch (e) { wt = null; } }
      const k = offT0 < 0 ? 1 : smooth(0, offMs / 1000, tOwn - offT0);
      if (target != null && isFinite(target)) off = offFrom + (target - tOwn - offFrom) * k;
      if (wt != null && isFinite(wt)) walkOff = walkFrom + (wt - tOwn - walkFrom) * k; else walkOff = off;
    } else walkOff = off;
    const t = sceneTime(), tw = walkTime();
    for (const m of moons) {
      const a = t * m.speed + m.ph;
      m.m.position.set(Math.cos(a) * m.r, Math.sin(a) * m.r * Math.sin(m.inc), Math.sin(a) * m.r * Math.cos(m.inc));
      m.m.rotation.y = t * m.spin;
    }
    shared.uGlowAmt.value = 0.8 + Math.sin(t * 0.55) * 0.12;
    if (folk) {   // the shadelings are sub-pixel until Plissé is big on screen; the elders a little sooner
      for (const m of Object.values(folk.parts)) m.visible = nearFrac > 0.06;
      for (const g of folk.elderGroups) g.visible = nearFrac > 0.03;
    }
    if (folk && group.visible && nearFrac > 0.03) {   // sub-pixel when far: skip the per-frame placement
      const { parts, elderGroups } = folk;
      for (let i = 0; i < SH_N; i++) {
        const w = walkers[i];
        const lon = w.lon0 + w.w * tw;   // her w.lon += w.w * dt, summed: the walk clock
        const lat = w.lat + Math.sin(t * 0.15 * w.wob + w.ph) * 0.012;
        placeOnSurface(lat, lon, mB);
        mB.scale(vS.set(w.k, w.k, w.k));
        const st = t * 5.5 * w.wob + w.ph, swing = Math.sin(st) * 0.5, bob = Math.abs(Math.cos(st)) * 0.018;
        mT.makeRotationFromEuler(eul.set(0.1, 0, Math.sin(st) * 0.08)); mT.setPosition(0, 0.2 + bob, 0); mBody.multiplyMatrices(mB, mT);
        parts.body.setMatrixAt(i, mBody);
        setPart(parts.cap, i, mBody, 0, 0.17, 0, 0, 0);
        setPart(parts.bead, i, mBody, 0, 0.33, 0.09, 0, 0);
        setPart(parts.legL, i, mB, -0.035, 0.2 + bob, 0, swing, 0);
        setPart(parts.legR, i, mB, 0.035, 0.2 + bob, 0, -swing, 0);
      }
      Object.values(parts).forEach(m => { m.instanceMatrix.needsUpdate = true; });
      elders.forEach((e, i) => {
        placeOnSurface(e.lat, e.lon0 + 0.0015 * tw, mB);
        mB.decompose(vP, qB, vS); const g = elderGroups[i]; g.position.copy(vP); g.quaternion.copy(qB);
        g.rotateZ(Math.sin(t * 0.4 + e.ph) * 0.03);
      });
    }
  }
  // the toon steps read at a distance; as Plissé fills the screen they soften toward her own smooth shading (toonNear),
  // so the last frames before the cross-fade already look like the original
  let toonF = toon, toonN = toonNear, matchNear = 1;
  const _c = new THREE.Vector3();
  function toonFor(camera) {
    if (!camera) return;
    const d = camera.getWorldPosition(_c).distanceTo(group.position);
    const frac = Math.tan(Math.asin(Math.min(0.999, radius * 1.033 / d))) / Math.tan((camera.fov || 40) * Math.PI / 360);
    nearFrac = frac;
    const k = smooth(0.3, 0.75, frac);
    shared.uToon.value = toonF + (toonN - toonF) * k;
    shared.uMatch.value = k * matchNear;
  }
  let unhook = null;
  if (planet && planet.onFrame) unhook = planet.onFrame(dt => { update(dt); toonFor(planet.camera); });
  update(0);

  /* ---------- composing it in the sky + matching plisse.html's camera ---------- */
  const _v = new THREE.Vector3(), _u = new THREE.Vector3();
  // the Tower Planet's lens (post `fish`, uFish .38): the screen at uv shows the scene at fish(uv)
  const fishUV = (x, y, aspect, F) => { let px = (x - 0.5) * aspect, py = y - 0.5; const k = 1 / (1 + F * (px * px + py * py)); return [px * k / aspect + 0.5, py * k + 0.5]; };
  // put it on the ray through a SCREEN point (u right, v down, 0..1, through the lens) at `dist` from `camera`
  function composeFor(camera, { screen = [0.8, 0.24], dist = 2400, fish = 0.38 } = {}) {
    camera.updateMatrixWorld();
    const [sx, sy] = fishUV(screen[0], 1 - screen[1], camera.aspect, fish);
    _v.set(sx * 2 - 1, sy * 2 - 1, 0.5).unproject(camera).sub(camera.position).normalize();
    group.position.copy(camera.position).addScaledVector(_v, dist);
    return group.position.clone();
  }
  // The Tower Planet camera pose that shows the stand-in exactly as plisse.html's camera shows Plissé:
  // same direction (her spherical theta/phi round the origin, y up), and a distance chosen so the rim lands on the same
  // screen radius after the Tower Planet's lens (fisheye) at its fov (40), with plisse.html's fov from her aspect rule.
  //   cam: { theta, phi, radius } (driver.cameraNow()) | omitted = the opening pose (7, 8, 41)
  function arrivalPose(cam = null, { aspect = (typeof innerWidth !== 'undefined' ? innerWidth / innerHeight : 1.6), fov = 40, fish = 0.38 } = {}) {
    let dir, r;
    if (cam && cam.theta != null) {
      const sp = Math.sin(cam.phi);
      dir = new THREE.Vector3(sp * Math.sin(cam.theta), Math.cos(cam.phi), sp * Math.cos(cam.theta));
      r = cam.radius;
    } else {
      dir = new THREE.Vector3(...PLISSE.CAMERA.position); r = dir.length(); dir.normalize();
    }
    const fP = plisseFov(aspect) * Math.PI / 360;
    const rho = Math.tan(Math.asin(Math.min(0.999, PLISSE.RIM / r))) / Math.tan(fP);    // her rim, NDC (y) radius
    const rt = rho / 2, rs = rt / (1 + fish * rt * rt);                                    // through the lens
    const angT = Math.atan(2 * rs * Math.tan(fov * Math.PI / 360));
    const d = s * PLISSE.RIM / Math.sin(angT);
    const look = group.position.clone();
    return { position: look.clone().addScaledVector(dir, d), look, up: new THREE.Vector3(0, 1, 0), fov, dir, dist: d, plisseRadius: r };
  }

  // A flight between two poses. Seen from the stand-in: the camera first turns to face it, then comes in on a log
  // distance scale while swinging round to the arrival direction, and settles (ease-out) on `to`.
  //   from: {position, look, up}; to: a pose or a function returning one (re-read every sample, so the end can
  //   follow plisse.html's slowly auto-rotating camera). at(s) -> {position, look, up, fov}
  function flight({ from, to, turn = 0.3, swing = [0.12, 0.86] } = {}) {
    const P = () => group.position;
    const F = { position: from.position.clone(), look: from.look.clone(), up: (from.up || new THREE.Vector3(0, 1, 0)).clone(), fov: from.fov ?? 40 };
    const dir0 = F.position.clone().sub(P()).normalize(), d0 = F.position.distanceTo(P());
    const q = new THREE.Quaternion(), dir = new THREE.Vector3();
    function at(sIn) {
      const sc = Math.max(0, Math.min(1, sIn));
      const T = typeof to === 'function' ? to() : to;
      const dir1 = T.position.clone().sub(P()), d1 = dir1.length(); dir1.divideScalar(d1);
      const ed = smooth(0.06, 1, sc), es = smooth(swing[0], swing[1], sc), el = smooth(0, turn, sc);
      // shortest arc from dir0 to dir1
      q.setFromUnitVectors(dir0, dir1); const qs = new THREE.Quaternion().slerp(q, es);
      dir.copy(dir0).applyQuaternion(qs);
      const d = Math.exp(Math.log(d0) + (Math.log(d1) - Math.log(d0)) * ed);
      const position = P().clone().addScaledVector(dir, d);
      const look = F.look.clone().lerp(T.look || P(), el);
      const up = F.up.clone().lerp(T.up || _u.set(0, 1, 0), smooth(0, 0.6, sc)).normalize();
      return { position, look, up, fov: F.fov + ((T.fov ?? 40) - F.fov) * ed };
    }
    return { at, from: F };
  }
  // flyTo: animates `camera` (or a planet, through cameraFree) along flight() over ms; resolves at the end pose.
  // For the Tower Planet pass the planet: each frame calls planet.cameraFree({ ...pose, snap: true }).
  function flyTo(cam, ms = 7000, { to = () => arrivalPose(), from = null, onProgress = null, apply = null } = {}) {
    const isPlanet = cam && cam.cameraFree;
    const camera = isPlanet ? cam.camera : cam;
    const f = from || { position: camera.position.clone(), look: camera.position.clone().add(camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(100)), up: camera.up.clone(), fov: camera.fov };
    const path = flight({ from: f, to });
    const put = apply || (pose => {
      if (isPlanet) cam.cameraFree({ position: pose.position, look: pose.look, up: pose.up, fov: pose.fov, snap: true });
      else { camera.position.copy(pose.position); camera.up.copy(pose.up); camera.lookAt(pose.look); camera.fov = pose.fov; camera.updateProjectionMatrix(); }
    });
    let cancelled = false;
    const p = new Promise(res => {
      const t0 = performance.now();
      (function step() {
        if (cancelled) return res(false);
        const sc = Math.min(1, (performance.now() - t0) / ms);
        put(path.at(sc)); if (onProgress) onProgress(sc);
        if (sc >= 1) return res(true);
        requestAnimationFrame(step);
      })();
    });
    p.cancel = () => { cancelled = true; };
    p.path = path;
    return p;
  }

  return {
    group, get position() { return group.position; }, radius, scale: s, moons, uniforms: shared,
    update, syncClock, get time() { return sceneTime(); }, get walkTime() { return walkTime(); },
    composeFor, arrivalPose, flight, flyTo,
    setToon(far, near = far) { toonF = far; toonN = near; shared.uToon.value = far; },   // band strength far / near (0 = smooth)
    toonFor, setMatch(v) { matchNear = v; },
    set visible(v) { group.visible = v; }, get visible() { return group.visible; },
    dispose() {
      if (unhook) unhook();
      group.traverse(o => { if (o.geometry) o.geometry.dispose(); });
      mats.forEach(m => m.dispose()); atmoMat.dispose();
      group.removeFromParent ? group.removeFromParent() : scene.remove(group);
    }
  };
}
