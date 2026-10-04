// Painted planet bodies. A body is the flat layout wrapped onto a sphere (mapFlat), built as ONE mesh on a
// non-uniform square grid in flat space: fine (0.5) round the centre, coarser outward, the corners beyond the
// antipode folded onto it. Colours are painted per vertex in FLAT space against the Red arch's fixed light L
// (kit.bake's formula: 0.5 n.L + 0.3 n.y + 0.4 + speck, on dark-to-light ramps), so every place on the globe
// is painted as the flat map paints it; the big round form then gets real Lambert light (warm key + hemi).
// Water is the same mesh: a per-vertex height attribute (aH) lets the fragment paint the Red arch sea (teal
// shallows -> deeper blue, foam at the shore, the warm sun glint) wherever the interpolated height is below 0.

import { vnoise2, fbm2 } from './geography.js';

export function gridAxis(half, fine, fineHalf, slope) {
  const pos = [0]; let x = 0;
  while (x < half - 1e-6) { const st = x < fineHalf ? fine : fine + (x - fineHalf) * slope; x = Math.min(half, x + st); pos.push(x); }
  return [...pos.slice(1).reverse().map(v => -v), ...pos];
}
function hashI(i) { let h = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16; return (h >>> 0) / 4294967296; }

// buildBody: heightAt(x,z) (flat), paint(x, z, h, n, i, base:Color, painted:Color) fills both colour sets,
// wrap(fx, y, fz, out[]) -> sphere point. base = the unpainted ivory relief (vertex colour), painted = the coloured
// land (aPaint); the shader mixes them by uBloom (global) + aBloom (per vertex: our town's colour spreading)
// normalBoost(x, z): a multiplier on the relief's slope for SHADING only (normals + the painted value), so a planet
// whose relief is kept low for its silhouette still reads as a shaded relief map
export function buildBody(ctx, { R, C, half = Math.PI * R, fine, fineHalf, slope, heightAt, paint, wrap, levelWrap = null, material, normalBoost = null }) {
  const ox = gridAxis(half, fine, fineHalf, slope), nx = ox.length, n = nx * nx;
  const hs = new Float32Array(n), pos = new Float32Array(n * 3), col = new Float32Array(n * 3), col2 = new Float32Array(n * 3), bloom = new Float32Array(n);
  const maxD = Math.PI * R;
  for (let j = 0; j < nx; j++) for (let i = 0; i < nx; i++) {
    let dx = ox[i], dz = ox[j]; const d = Math.hypot(dx, dz);
    if (d > maxD) { dx *= maxD / d; dz *= maxD / d; }
    hs[j * nx + i] = heightAt(C.x + dx, C.z + dz);
  }
  const c = new THREE.Color(), c2 = new THREE.Color(), nrm = new THREE.Vector3(), w = [0, 0, 0], w1 = [0, 0, 0], w2 = [0, 0, 0];
  const nrmW = new Float32Array(n * 3), upW = new Float32Array(n * 3), E = new THREE.Vector3(), S = new THREE.Vector3(), Uv = new THREE.Vector3(), Nw = new THREE.Vector3();
  for (let j = 0; j < nx; j++) for (let i = 0; i < nx; i++) {
    const k = j * nx + i;
    let dx = ox[i], dz = ox[j]; const d = Math.hypot(dx, dz);
    if (d > maxD) { dx *= maxD / d; dz *= maxD / d; }
    const x = C.x + dx, z = C.z + dz, h = hs[k];
    // flat-space normal from the grid's own neighbours (water is level)
    const i0 = Math.max(0, i - 1), i1 = Math.min(nx - 1, i + 1), j0 = Math.max(0, j - 1), j1 = Math.min(nx - 1, j + 1);
    const H = q => Math.max(0, hs[q]);
    const gx = (H(j * nx + i1) - H(j * nx + i0)) / (ox[i1] - ox[i0]), gz = (H(j1 * nx + i) - H(j0 * nx + i)) / (ox[j1] - ox[j0]);
    const kb = normalBoost ? normalBoost(x, z) : 1;
    nrm.set(-gx * kb, 1, -gz * kb).normalize();
    c2.setRGB(-1, 0, 0);
    paint(x, z, h, nrm, k, c, c2);
    if (c2.r < 0) c2.copy(c);
    col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b;
    col2[k * 3] = c2.r; col2[k * 3 + 1] = c2.g; col2[k * 3 + 2] = c2.b;
    wrap(x, Math.max(0, h), z, w);
    pos[k * 3] = w[0]; pos[k * 3 + 1] = w[1]; pos[k * 3 + 2] = w[2];
    // the level frame from the wrap's own tangents (so an unbent wrap keeps level ground level), and the flat-space
    // normal carried into it: these are the mesh's normals (smooth, the grid's own gradient)
    { const e = 0.2, lw = levelWrap ? levelWrap(x, z) : wrap; lw(x, 0, z, w); lw(x + e, 0, z, w1); lw(x, 0, z + e, w2);
      E.set(w1[0] - w[0], w1[1] - w[1], w1[2] - w[2]).normalize(); S.set(w2[0] - w[0], w2[1] - w[1], w2[2] - w[2]).normalize();
      Uv.crossVectors(S, E).normalize(); S.crossVectors(E, Uv).normalize();
      Nw.set(0, 0, 0).addScaledVector(E, nrm.x).addScaledVector(Uv, nrm.y).addScaledVector(S, nrm.z).normalize();
      nrmW[k * 3] = Nw.x; nrmW[k * 3 + 1] = Nw.y; nrmW[k * 3 + 2] = Nw.z; upW[k * 3] = Uv.x; upW[k * 3 + 1] = Uv.y; upW[k * 3 + 2] = Uv.z; }
  }
  const idx = new Uint32Array((nx - 1) * (nx - 1) * 6); let q = 0;
  for (let j = 0; j < nx - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const a = j * nx + i, b = a + 1, d = a + nx, e = d + 1;
    // winding: flat +y faces up once wrapped (x east, z south)
    idx[q++] = a; idx[q++] = d; idx[q++] = b; idx[q++] = b; idx[q++] = d; idx[q++] = e;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('aH', new THREE.BufferAttribute(hs, 1));
  geo.setAttribute('aPaint', new THREE.BufferAttribute(col2, 3));
  geo.setAttribute('aBloom', new THREE.BufferAttribute(bloom, 1));
  geo.setAttribute('aHome', new THREE.BufferAttribute(new Float32Array(n), 1));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.setAttribute('normal', new THREE.BufferAttribute(nrmW, 3));
  geo.setAttribute('aUp', new THREE.BufferAttribute(upW, 3));
  geo.computeBoundingSphere();
  const mesh = new THREE.Mesh(geo, material);
  mesh.receiveShadow = true; mesh.castShadow = true;
  return { mesh, geo, axis: ox, nx, heights: hs, colours: col, painted: col2, bloom, C };
}

// the painter's ramps, dark-to-light in hue with coloured shadows (the Red arch habit)
export function makeRamps(ctx) {
  const r = a => a.map(h => ctx.col(h));
  return {
    meadow: r(['#4f532c', '#7c7f38', '#ab9b52', '#cdb276']),
    sand: r(['#97765e', '#c4a07a', '#e2c89c', '#f0dfbd']),
    pine: r(['#18220f', '#283a16', '#425522', '#647232']),
    straw: r(['#86663e', '#b68e56', '#dab574', '#edd298']),
    rock: r(['#625068', '#957a80', '#bc9f8c', '#d8c0a2']),
    painted: r(['#6f6a34', '#97904a', '#bfae6a', '#d9c48c']),
    // the ivory relief map (mb 1): cobalt-violet shadow sides -> warm paper on the lit slopes
    ivory: r(['#8c7e8e', '#c8ae8a', '#e8d0a2', '#f6e6c0']),
    ivoryPine: r(['#384528', '#56613a', '#7b7c52', '#9c9670']),
    regolith: r(['#4f4a80', '#7f74b0', '#b2a5cf', '#e4d9de']),
    moss: r(['#2c371a', '#3d4f22', '#5a6c2e', '#7f8a3e']),
    // the Alpine lounge's lawn (lounge.html gDark #45592a, gLight #71863a, gWarm #7f8a3e): sage, never acid
    sage: r(['#34401f', '#46582a', '#5f7434', '#748a40', '#93a258'])
  };
}
// kit.bake's painted-light value for a normal (flat space), with a hashed speck + a slow brush wash
export function paintValue(L, n, x, z, i, speck = 0.1) {
  return 0.5 * (n.x * L.x + n.y * L.y + n.z * L.z) + 0.3 * n.y + 0.4 + (hashI(i) - 0.5) * speck + (fbm2(x / 13, z / 13, 3) - 0.5) * 0.22;
}
export { hashI, vnoise2 };

// Lambert (warm key + hemi, real shadows) with the Red arch sea painted in where aH < 0, and a limb haze
export function makeBodyMaterial(U, own = {}) {
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const OWN = { uCentre: { value: new THREE.Vector3() }, uMoon: { value: 0 }, ...own };
  // the look (globe.setLook): shared uniforms live in U (uShadeTint, uShadeK, uShallowC, uDeepC)
  mat.userData.uniforms = OWN;
  mat.customProgramCacheKey = () => 'body' + (OWN.uMoon.value ? 'M' : 'E');
  mat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, U, OWN);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aH; attribute vec3 aPaint; attribute float aBloom; attribute float aHome; attribute vec3 aUp; varying vec3 vUp; varying float vH; varying vec3 vWP; varying vec3 vWN; varying vec3 vPaint; varying float vBloom; varying float vHome;')
      .replace('#include <color_vertex>', '#include <color_vertex>\n  vPaint = aPaint; vBloom = aBloom; vHome = aHome;')
      .replace('#include <fog_vertex>', '#include <fog_vertex>\n  vH = aH; vWP = (modelMatrix * vec4(transformed, 1.0)).xyz; vWN = normalize(mat3(modelMatrix) * objectNormal); vUp = normalize(mat3(modelMatrix) * aUp);');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform vec3 uSun, uKey, uHaze, uCamPos; uniform float uTime, uCos, uHazeAmt, uLake, uBloom;
        varying float vH; varying vec3 vWP; varying vec3 vWN; varying vec3 vPaint; varying float vBloom; varying float vHome; varying vec3 vUp;
        uniform float uPaintLight, uDeep, uMoon, uShadeK; uniform vec3 uCentre, uShadeTint, uShallowC, uDeepC; float sMaskG = 1.0;
        uniform vec4 uGlowP[5]; uniform vec3 uGlowC[5]; uniform float uGlowK[5];
        float gH(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
        float gN(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(mix(gH(i), gH(i + vec3(1,0,0)), f.x), mix(gH(i + vec3(0,1,0)), gH(i + vec3(1,1,0)), f.x), f.y),
                     mix(mix(gH(i + vec3(0,0,1)), gH(i + vec3(1,0,1)), f.x), mix(gH(i + vec3(0,1,1)), gH(i + vec3(1,1,1)), f.x), f.y), f.z); }`)
      .replace('#include <color_fragment>', `float mixK = clamp((1.0 - vHome) * uBloom + vBloom, 0.0, 1.0);
        // the Moon: the meadow weight (aBloom) thresholded against world-space noise per pixel: a brushy, ragged
        // meadow edge that never follows the grid
        if (uMoon > 0.5) mixK = smoothstep(0.42, 0.58, vBloom + (gN(vWP * 0.55) - 0.5) * 0.55 + (gN(vWP * 2.4) - 0.5) * 0.2);
        diffuseColor.rgb *= mix(vColor, vPaint, mixK);`)   // our land only colours by our own town
      .replace('reflectedLight.directDiffuse *= BRDF_Diffuse_Lambert( diffuseColor.rgb ) * getShadowMask();',
        'sMaskG = getShadowMask(); reflectedLight.directDiffuse *= BRDF_Diffuse_Lambert( diffuseColor.rgb ) * sMaskG;')
      .replace('#include <dithering_fragment>', `#include <dithering_fragment>
        vec3 Vd = normalize(vWP - uCamPos);   // (r128 doesn't upload cameraPosition to Lambert)
        vec3 N = normalize(vWN);
        // painted light (gouache value structure, mb 4): a decisive two-tone relief, warm lit planes against cobalt /
        // violet shadow planes, the terminator brushed by a little noise; mixed over the Lambert by uPaintLight
        if (vH >= 0.0) {
          // first the map v2's own cobalt shade on the Lambert (world/ground.js, same terms and constants), so near
          // the ground the globe is lit and shaded exactly as the map it cross-fades into
          {
            vec3 Up0 = normalize(vUp);
            float steepS = smoothstep(0.99, 0.94, dot(N, Up0));   // gentle swells stay clean paper (no mushy blotches)
            float slopeS = (1.0 - smoothstep(0.0, 0.62, clamp(dot(N, uKey) / max(dot(Up0, uKey), 0.08), 0.0, 1.6))) * steepS;
            float shadeS = max(slopeS * 0.55, 1.0 - sMaskG);
            float lumS = dot(gl_FragColor.rgb, vec3(0.3, 0.59, 0.11));
            vec3 tintN = uShadeTint / max(0.05, dot(uShadeTint, vec3(0.3, 0.59, 0.11)));
            vec3 cob = mix(vec3(lumS), lumS * tintN, 0.62) * 1.12 + uShadeTint * 0.12;
            gl_FragColor.rgb = mix(gl_FragColor.rgb, cob, shadeS * uShadeK * 0.8);
          }
          float ndl = dot(N, uKey) + (gN(vWP * 0.35) - 0.5) * 0.16;
          // hillshade: the slope against the light relative to level ground here (a relief map's shading), so even
          // gentle swells read; plus the absolute terminator and the cast shadows
          vec3 Up = normalize(vUp);
          float hs = ndl - dot(Up, uKey);
          float lit = smoothstep(0.06, 0.16, ndl) * mix(0.22, 1.0, smoothstep(0.3, 0.7, sMaskG));
          lit *= mix(mix(0.46, 1.0, smoothstep(-0.12, -0.04, hs)), 1.0, 1.0 - smoothstep(0.99, 0.94, dot(N, Up)));   // crisp planes, not soft blotches
          vec3 tintP = uShadeTint / max(0.05, dot(uShadeTint, vec3(0.3, 0.59, 0.11)));
          vec3 pc = diffuseColor.rgb * mix(mix(vec3(0.66), tintP * 0.62, 0.55 * uShadeK / 0.62), vec3(1.02, 0.95, 0.82), lit) * (1.0 + 0.10 * smoothstep(0.02, 0.2, hs));
          gl_FragColor.rgb = mix(gl_FragColor.rgb, pc, uPaintLight);
        }
        if (vH < 0.0) {
          // the Red arch sea: teal shallows -> deeper blue -> the far grey-blue
          float dep = -vH;
          // the landform's true depth: a pale teal shelf (sand under a metre of water), the bay's teal, ultramarine in the deep
          vec3 c = mix(uShallowC * vec3(1.08, 1.06, 1.0), uShallowC, smoothstep(0.15, 1.2, dep));
          c = mix(c, mix(uShallowC, uDeepC, 0.45), smoothstep(1.0, 5.0, dep));
          c = mix(c, uDeepC, smoothstep(5.0, 20.0, dep) * uDeep);   // ultramarine out in the deep (mb 5)
          c *= 0.97 + 0.07 * gN(vWP * 0.18) - 0.03 * gN(vWP * 0.9);
          float lam = dot(N, uKey);
          c *= 0.8 + 0.24 * smoothstep(-0.3, 0.8, lam);
          vec3 p = vWP * 0.35; float t = uTime;
          vec3 n2 = normalize(N + 0.03 * vec3(sin(p.x + t * 0.6) + 0.6 * sin(p.z * 1.3 - p.y * 0.4 + t), sin(p.y * 0.8 - t * 0.5), sin(p.z * 0.9 + t * 0.8) + 0.5 * sin(p.y * 1.7 + p.x * 0.3 - t * 1.2)));
          float s = dot(reflect(Vd, n2), uSun);
          c = mix(c, vec3(0.92, 0.45, 0.32), smoothstep(uCos - 0.004, uCos + 0.0008, s) * 0.42);
          c = mix(c, vec3(0.96, 0.66, 0.48), pow(max(s, 0.0), 30.0) * 0.3);
          c = mix(c, vec3(0.90, 0.93, 0.91), (1.0 - smoothstep(0.12, 0.42, dep)) * 0.75);   // foam at the shore
          gl_FragColor.rgb = c;
        }
        // warm settlement glows (mb 1): a soft apricot light pooled on the ground round each camp / town
        for (int i = 0; i < 5; i++) {
          vec3 dg = vWP - uGlowP[i].xyz; float q = dot(dg, dg) / (uGlowP[i].w * uGlowP[i].w);
          float gw = uGlowK[i] * exp(-q * 2.4), gc = uGlowK[i] * exp(-q * 12.0);
          gl_FragColor.rgb = mix(gl_FragColor.rgb, gl_FragColor.rgb * uGlowC[i] * 1.18, min(1.0, gw * (i == 0 ? 1.0 : 0.4)));   // a warm pool (lighter over the towns' own colours)
          gl_FragColor.rgb += vec3(1.0, 0.72, 0.42) * (gc * 0.32 + (i == 0 ? 0.0 : gw * 0.08));                                             // its bright heart
        }
        // atmosphere at the limb: warm peach haze on the lit side, a cool blue veil on the shadow side
        float fr = pow(1.0 - max(dot(N, -Vd), 0.0), 2.6);
        vec3 haze = mix(vec3(0.36, 0.50, 0.68), uHaze, smoothstep(-0.35, 0.55, dot(N, uKey)));
        gl_FragColor.rgb = mix(gl_FragColor.rgb, haze, fr * uHazeAmt);`);
  };
  return mat;
}
