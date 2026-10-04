// The ground: ONE painted relief mesh for the whole region, sampled from the shared designed landform
// (globe/geography.js LANDFORM, landform.js), so the map's coast, ridges, river gorge, headland, hill town and
// islands ARE the globe's. Seen from the leader's bird's-eye it reads as a hand-made relief map (ART_DIRECTION §1,
// §8 "not a slab", mb 1 / mb 4 / mb 5):
//   - heights: the landform at true sea level, with its waterline lowered onto the map's own sea plane (mapY);
//     our lake a smooth bowl to the sim's polygon; building pads levelled on demand (cut and fill, soft skirt);
//   - colour, computed per pixel from per-vertex WEIGHTS (meadow / sand / woods / limestone) and the painted-light
//     value v (kit.bake's formula), so the look is live (setLook): the start state is cream paper relief (creamColor,
//     mb 1) with muted olive woods and pale limestone; colour blooms in from bloomPalette (greens / ochres / woods)
//     as we build (brushy discs, sand paths, the nations' land, a world-wide spread), our bloomed land a patchwork of
//     striped fields (mb 4);
//   - light: the reference's hemisphere + key (Lambert, real shadows), then a SHADOW-TINT term: whatever the key does
//     not reach (cast shadows, slopes turned away) shifts to shadowTint at the same value (cobalt / violet, mb 4), and
//     a painted two-tone light (warm lit planes, a brushed terminator) firms the value structure for the Kuwahara pass;
//   - pencil: the coast is the keyline world's land proxy cut at the waterline; hand-drawn CONTOUR LINES every
//     contourSpacing metres are invisible "tents" in ctx.lineOnly (a low ridge per line whose two faces meet at an
//     angle the edge pass draws as one graphite line; the angle sets how dark), slightly wobbly, every 5th heavier;
//   - water: the sea's depth texture is the landform's TRUE bathymetry (water.js paints the shelves lighter teal).
//
// groundY(x, z) is the mesh itself (the same triangle split the GPU draws), so anything stood on it touches it.

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
export const SEA_Y = -0.9;            // the reference sea plane (backdrop.js puts it at y = -0.9)
export const LAKE_Y = 0.03;           // the lake's water lies a hair above its bank (water.js)
export const MAX_BLOOMS = 48, MAX_PATHS = 24, MAX_TRACKS = 96;
// the map lowers the landform's waterline (true sea level 0) onto its sea plane: monotonic, identity above 1.6 m
export const mapY = h => (h >= 0 ? h + SEA_Y * (1 - smooth(0, 1.6, h)) : SEA_Y - 0.3 + h * 1.2);

// the look's ground defaults (world.setLook / getLook; docs/world.md "Look")
export const GROUND_LOOK = {
  creamColor: '#f3e3bf',                 // the paper land of the start state (mb 1)
  // bloomPalette: [deep green, meadow green, light green, ochre, straw, woods]
  bloomPalette: ['#3f5a24', '#6b8a35', '#a3b356', '#c9a24e', '#e3cf8c', '#2c4219'],
  shadowTint: '#3a4a9a', shadowStrength: 0.62,
  contours: true, contourSpacing: 2.5, contourOpacity: 0.55,
  haze: 0.18, reliefScale: 1,
  meadows: 1                             // the green spots on the cream plain (dressing.js; 0 = off, 1 = as painted)
};

// the globe's grid axis: fine near the centre, coarser outward (globe/terrain.js gridAxis)
function gridAxis(half, fine, fineHalf, slope) {
  const pos = [0]; let x = 0;
  while (x < half - 1e-6) { const st = x < fineHalf ? fine : fine + (x - fineHalf) * slope; x = Math.min(half, x + st); pos.push(x); }
  return [...pos.slice(1).reverse().map(v => -v), ...pos];
}
function hashI(i) { let h = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16; return (h >>> 0) / 4294967296; }
function cellOf(axis, v) {
  let lo = 0, hi = axis.length - 2;
  if (v <= axis[0]) return 0; if (v >= axis[hi + 1]) return hi;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (axis[mid] <= v) lo = mid; else hi = mid - 1; }
  return lo;
}
function pointInPoly(x, z, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i], [xj, zj] = poly[j];
    if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}
function distToPoly(x, z, poly) {
  let best = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [ax, az] = poly[j], [bx, bz] = poly[i], dx = bx - ax, dz = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)));
    best = Math.min(best, Math.hypot(ax + dx * t - x, az + dz * t - z));
  }
  return best;
}

// kept for callers of the old API (globe/terrain.js has its own): the painter ramps, as THREE.Colors
export function makeRamps(col) {
  const r = a => a.map(h => col(h));
  return {
    meadow: r(['#3b5326', '#597a33', '#83a046', '#adc066']), sand: r(['#97765e', '#c4a07a', '#e2c89c', '#f0dfbd']),
    pine: r(['#18240f', '#2a3e18', '#455c27', '#6a7d3c']), rock: r(['#66556a', '#9a8183', '#c8ad95', '#e7d4b6']),
    ivory: r(['#8c7e8e', '#c8ae8a', '#e8d0a2', '#f6e6c0']), ivoryPine: r(['#384528', '#56613a', '#7b7c52', '#9c9670'])
  };
}

export function buildGround(ctx, geo, { half = 214, fine = 0.5, fineHalf = 42, slope = 0.017, lake = null } = {}) {
  const { L, col } = ctx;
  const { GEO, PLOT, fbm2, vnoise2, distOutsidePlot } = geo;
  const LF = geo.LANDFORM;
  const C = GEO.C;
  const ramps = makeRamps(col);
  const lakePoly = lake || (geo.getLake ? geo.getLake() : null);
  const lakeBox = lakePoly ? lakePoly.reduce((b, [x, z]) => ({ x0: Math.min(b.x0, x), x1: Math.max(b.x1, x), z0: Math.min(b.z0, z), z1: Math.max(b.z1, z) }), { x0: 1e9, x1: -1e9, z0: 1e9, z1: -1e9 }) : null;
  const inLakePoly = (x, z) => !!lakePoly && x >= lakeBox.x0 && x <= lakeBox.x1 && z >= lakeBox.z0 && z <= lakeBox.z1 && pointInPoly(x, z, lakePoly);
  const lakeSD = (x, z) => {
    if (!lakePoly) return 1e9;
    if (x < lakeBox.x0 - 14 || x > lakeBox.x1 + 14 || z < lakeBox.z0 - 14 || z > lakeBox.z1 + 14) return 1e9;
    const d = distToPoly(x, z, lakePoly); return inLakePoly(x, z) ? -d : d;
  };
  const nations = (geo.places && geo.places.nations) || [];
  const inPlotRect = (x, z) => x >= PLOT.x0 && x <= PLOT.x1 && z >= PLOT.z0 && z <= PLOT.z1;

  // ---------- heights ----------
  // signed land field (~ m to the coast, + land); the plot is always land
  function shoreS(x, z) { const s = LF.coast(x, z); return inPlotRect(x, z) ? Math.max(s, 0.01) : s; }
  let reliefK = 1;   // look.reliefScale: the hills' vertical scale (our land is never scaled: buildings stand on it)
  // the true landform height (sea level 0, our lake excluded) -> the map's y
  function baseHeight(x, z, hTrue = null) {
    const s = shoreS(x, z);
    // under the sea the bed drops away fast, so the sea plane wins the depth test even from 400 m up (16-bit)
    if (s <= 0) return Math.max(SEA_Y - 14, SEA_Y - 0.25 + 3.2 * s);
    let h = hTrue != null ? hTrue : LF.height(x, z);
    if (reliefK !== 1 && h > 1.6) h = 1.6 + (h - 1.6) * lerp(1, reliefK, smooth(14, 40, distOutsidePlot(x, z)));
    let y = mapY(h);
    // the lake: a smooth bowl; the bank meets the water (LAKE_Y) right at the polygon
    const ld = lakeSD(x, z);
    if (ld < 1.2) {
      const bank = LAKE_Y + 0.07 + 0.25 * smooth(0, 1.2, ld);
      y = ld >= 0 ? Math.min(y, lerp(bank, y, smooth(0, 1.2, ld))) : -0.05 - 2.3 * smooth(0, 3.2, -ld);
    }
    return y;
  }

  // ---------- the mesh ----------
  const ox = gridAxis(half, fine, fineHalf, slope), nx = ox.length, n = nx * nx;
  const base = new Float32Array(n), ys = new Float32Array(n), hT = new Float32Array(n);
  const sA = new Float32Array(n), plotA = new Float32Array(n), natA = new Float32Array(n), vA = new Float32Array(n), cliffA = new Float32Array(n);
  const wA = new Float32Array(n * 4);
  const pos = new Float32Array(n * 3), nrmA = new Float32Array(n * 3);
  // how much of a point is our plot: the rectangle with a hand-torn, wobbling edge (soft: no hard boundary)
  function plotWeight(x, z) {
    const bx = Math.max(PLOT.x0 - x, x - PLOT.x1), bz = Math.max(PLOT.z0 - z, z - PLOT.z1);
    const sd = bx > 0 || bz > 0 ? Math.hypot(Math.max(bx, 0), Math.max(bz, 0)) : Math.max(bx, bz);   // <0 inside
    const w = (fbm2(x / 9 + 13.1, z / 9 - 4.2, 3) - 0.5) * 6;
    return 1 - smooth(-3, 3, sd + w);
  }
  for (let j = 0; j < nx; j++) for (let i = 0; i < nx; i++) {
    const k = j * nx + i, x = C.x + ox[i], z = C.z + ox[j];
    const s = shoreS(x, z);
    sA[k] = s;
    hT[k] = LF.height(x, z);   // true heights, the sea's too (the bathymetry, for the depth map and the contours)
    base[k] = ys[k] = baseHeight(x, z, hT[k]);
    pos[k * 3] = x; pos[k * 3 + 1] = ys[k]; pos[k * 3 + 2] = z;
    plotA[k] = plotWeight(x, z);
    cliffA[k] = s > -4 && s < 8 ? LF.cliffAt(x, z) : 0;
    let nat = 0;
    for (const nn of nations) nat = Math.max(nat, 1 - smooth((nn.r || 15) + 8, (nn.r || 15) + 30, Math.hypot(x - nn.x, z - nn.z)));
    natA[k] = nat;
  }
  const nv = new THREE.Vector3();
  // normals, painted value v and the ground-cover weights for the vertices in [i0..i1] x [j0..j1]
  function shadeRange(i0, i1, j0, j1, weightsToo = true) {
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const k = j * nx + i, x = C.x + ox[i], z = C.z + ox[j];
      const ia = Math.max(0, i - 1), ib = Math.min(nx - 1, i + 1), ja = Math.max(0, j - 1), jb = Math.min(nx - 1, j + 1);
      const gx = (ys[j * nx + ib] - ys[j * nx + ia]) / (ox[ib] - ox[ia]), gz = (ys[jb * nx + i] - ys[ja * nx + i]) / (ox[jb] - ox[ja]);
      nv.set(-gx, 1, -gz).normalize();
      nrmA[k * 3] = nv.x; nrmA[k * 3 + 1] = nv.y; nrmA[k * 3 + 2] = nv.z;
      // kit.bake's painted-light value (against the reference's painted light L), a hashed speck, a slow wash
      vA[k] = 0.5 * (nv.x * L.x + nv.y * L.y + nv.z * L.z) + 0.3 * nv.y + 0.4 + (hashI(k) - 0.5) * 0.1 + (fbm2(x / 9, z / 9, 2) - 0.5) * 0.22;
      if (!weightsToo) continue;
      if (sA[k] <= 0 || ys[k] < SEA_Y - 0.05) { wA.set([1, 0, 0, 0], k * 4); continue; }
      // our plot is meadow (with the beach the land beside it has, so nothing steps at its edge), blended out
      // over its torn edge into the landform's own cover
      const pw = inPlotRect(x, z) ? Math.max(plotA[k], 0.98) : plotA[k];
      const sd = 1 - smooth(1.5, 5, sA[k]);
      const w = pw > 0.98 ? { meadow: 0, sand: 0, pine: 0, rock: 0 } : LF.weights(x, z, Math.max(0, hT[k]), 1 - nv.y);
      wA[k * 4] = lerp(w.meadow, 1 - sd, pw); wA[k * 4 + 1] = lerp(w.sand, sd, pw);
      wA[k * 4 + 2] = w.pine * (1 - pw); wA[k * 4 + 3] = w.rock * (1 - pw);
    }
  }
  shadeRange(0, nx - 1, 0, nx - 1);
  const idx = new Uint32Array((nx - 1) * (nx - 1) * 6); let q = 0;
  for (let j = 0; j < nx - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const a = j * nx + i, b = a + 1, d = a + nx, e = d + 1;
    idx[q++] = a; idx[q++] = d; idx[q++] = b; idx[q++] = b; idx[q++] = d; idx[q++] = e;
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geom.setAttribute('normal', new THREE.BufferAttribute(nrmA, 3));
  geom.setAttribute('aW', new THREE.BufferAttribute(wA, 4));
  geom.setAttribute('aPlot', new THREE.BufferAttribute(plotA, 1));
  geom.setAttribute('aS', new THREE.BufferAttribute(sA, 1));
  geom.setAttribute('aNat', new THREE.BufferAttribute(natA, 1));
  geom.setAttribute('aV', new THREE.BufferAttribute(vA, 1));
  geom.setAttribute('aH', new THREE.BufferAttribute(hT, 1));
  geom.setAttribute('aCliff', new THREE.BufferAttribute(cliffA, 1));
  geom.setIndex(new THREE.BufferAttribute(idx, 1));
  geom.computeBoundingSphere();

  // ---------- groundY: the mesh's own surface (same triangle split as the index above) ----------
  const AX0 = ox[0], AX1 = ox[nx - 1];
  function meshY(x, z, arr = ys) {
    const u = x - C.x, w = z - C.z;
    if (u < AX0 || u > AX1 || w < AX0 || w > AX1) return SEA_Y - 7;
    const i = cellOf(ox, u), j = cellOf(ox, w);
    const fx = (u - ox[i]) / (ox[i + 1] - ox[i]), fz = (w - ox[j]) / (ox[j + 1] - ox[j]);
    const a = arr[j * nx + i], b = arr[j * nx + i + 1], d = arr[(j + 1) * nx + i], e = arr[(j + 1) * nx + i + 1];
    return fx + fz <= 1 ? a + (b - a) * fx + (d - a) * fz : e + (d - e) * (1 - fx) + (b - e) * (1 - fz);
  }
  const groundY = (x, z) => meshY(x, z, ys);
  const shoreAt = (x, z) => meshY(x, z, sA);

  // ---------- paper tooth: a canvas like kit.stoneTexture's, but its own seeded stream (never ctx.rnd) ----------
  const prnd = ctx.mulberry32(9071);
  const paperTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 512;
    const g = c.getContext('2d');
    g.fillStyle = 'rgb(200,200,200)'; g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 260; i++) {
      const x = prnd() * 512, y = prnd() * 512, r = 18 + prnd() * 70, v = prnd() < 0.5 ? 255 : 150;
      for (const ox2 of [-512, 0, 512]) for (const oy of [-512, 0, 512]) {
        const gr = g.createRadialGradient(x + ox2, y + oy, 0, x + ox2, y + oy, r);
        gr.addColorStop(0, `rgba(${v},${v},${v},0.07)`); gr.addColorStop(1, `rgba(${v},${v},${v},0)`);
        g.fillStyle = gr; g.fillRect(x + ox2 - r, y + oy - r, r * 2, r * 2);
      }
    }
    for (let i = 0; i < 7000; i++) { const v = 170 + Math.floor(prnd() * 60); g.fillStyle = `rgba(${v},${v},${v},0.18)`; g.fillRect(prnd() * 512, prnd() * 512, 2, 2); }
    g.lineWidth = 1;
    for (let i = 0; i < 900; i++) {
      const x = prnd() * 512, y = prnd() * 512, a = prnd() * 6.28, l = 3 + prnd() * 9, v = prnd() < 0.5 ? 230 : 165;
      g.strokeStyle = `rgba(${v},${v},${v},0.16)`; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
    }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = ctx.renderer.capabilities.getMaxAnisotropy(); return t;
  })();

  // ---------- material ----------
  const look = { ...GROUND_LOOK, bloomPalette: [...GROUND_LOOK.bloomPalette] };
  const blooms = [], paths = [];
  const U = {
    uPaper: { value: paperTex },
    uBloom: { value: Array.from({ length: MAX_BLOOMS }, () => new THREE.Vector4(0, 0, 0, 0)) },
    uBloomN: { value: 0 },
    uPath: { value: Array.from({ length: MAX_PATHS }, () => new THREE.Vector4(0, 0, 0, 0)) },
    uPathK: { value: new Float32Array(MAX_PATHS) },
    uPathN: { value: 0 },
    uTrack: { value: Array.from({ length: MAX_TRACKS }, () => new THREE.Vector4(0, 0, 0, 0)) },
    uTrackN: { value: 0 },
    uWorld: { value: 0 },                                   // the world-wide spread of colour (0 = cream, 1 = painted)
    uNations: { value: 1 },                                 // the nations' land is in colour from the start
    uC: { value: new THREE.Vector2(C.x, C.z) },
    uPlotBox: { value: new THREE.Vector4(PLOT.x0, PLOT.z0, PLOT.x1, PLOT.z1) },
    uOutline: { value: 0.0 },
    // the look (setLook)
    uCream: { value: col(look.creamColor) },
    uPal: { value: look.bloomPalette.map(h => col(h)) },
    uShadeTint: { value: col(look.shadowTint) }, uShadeK: { value: look.shadowStrength },
    uHaze: { value: look.haze }, uHazeCol: { value: col('#d9dccf') },
    uPaintLight: { value: 0.58 }, uCamPos: { value: new THREE.Vector3(0, 150, 100) },   // (r128 doesn't upload cameraPosition to Lambert)
    // fields (mb 4): greens, yellow-green, ochre, straw (derived from the palette)
    uF0: { value: col('#5d7a2c') }, uF1: { value: col('#7f9a3c') }, uF2: { value: col('#a2b552') }, uF3: { value: col('#c7c66a') },
    uF4: { value: col('#cda94f') }, uF5: { value: col('#e2d08c') }, uHedge: { value: col('#3f5326') },
    uSand: { value: col('#e8d3a6') }, uFoam: { value: col('#f1f3ea') }, uWet: { value: col('#c2ab86') }, uPencil: { value: col('#5d5a6e') },
    uLime: { value: col('#e6ddcc') },
    // the green spots (§21): a 0..1 mask over the region (dressing.js meadowMask), thresholded here with brushy edges
    uMeadow: { value: null }, uMeadowBox: { value: new THREE.Vector4(0, 0, 1, 1) }, uMeadowK: { value: 0 }
  };
  function applyPalette() {
    const P = look.bloomPalette.map(h => col(h));
    while (P.length < 6) P.push(P[P.length - 1] || col('#6b8a35'));
    U.uPal.value = P.slice(0, 6);
    // the striped fields take the palette's greens and ochres
    U.uF0.value = P[0].clone().lerp(P[1], 0.45); U.uF1.value = P[1].clone(); U.uF2.value = P[2].clone();
    U.uF3.value = P[2].clone().lerp(P[4], 0.5); U.uF4.value = P[3].clone(); U.uF5.value = P[4].clone();
    U.uHedge.value = P[5].clone().lerp(P[0], 0.5);
  }
  applyPalette();
  const mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  mat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        attribute float aPlot; attribute float aS; attribute float aNat; attribute float aV; attribute vec4 aW; attribute float aH; attribute float aCliff;
        varying float vPlot; varying float vS; varying float vNat; varying float vV; varying vec4 vW; varying vec3 vWp; varying float vH; varying float vCliff;
        varying float vNdl; varying float vFlat; varying float vNy;`)
      .replace('#include <fog_vertex>', `#include <fog_vertex>
        vNy = normal.y; vPlot = aPlot; vS = aS; vNat = aNat; vV = aV; vW = aW; vH = aH; vCliff = aCliff; vWp = (modelMatrix * vec4(transformed, 1.0)).xyz;
        vNdl = 1.0; vFlat = 1.0;
        #if NUM_DIR_LIGHTS > 0
          vNdl = dot(normalize(transformedNormal), directionalLights[0].direction);
          vFlat = dot(normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz), directionalLights[0].direction);
        #endif`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        #define MAXB ${MAX_BLOOMS}
        #define MAXP ${MAX_PATHS}
        #define MAXT ${MAX_TRACKS}
        uniform sampler2D uPaper; uniform vec3 uF0, uF1, uF2, uF3, uF4, uF5, uHedge, uSand, uFoam, uWet, uPencil, uLime;
        uniform vec3 uCream, uPal[6], uShadeTint, uHazeCol, uCamPos; uniform float uShadeK, uHaze, uPaintLight;
        uniform vec4 uBloom[MAXB]; uniform int uBloomN; uniform vec4 uPath[MAXP]; uniform float uPathK[MAXP]; uniform int uPathN;
        uniform vec4 uTrack[MAXT]; uniform int uTrackN;
        uniform float uWorld, uNations, uOutline; uniform vec2 uC; uniform vec4 uPlotBox;
        uniform sampler2D uMeadow; uniform vec4 uMeadowBox; uniform float uMeadowK;
        varying float vPlot; varying float vS; varying float vNat; varying float vV; varying vec4 vW; varying vec3 vWp; varying float vH; varying float vCliff;
        varying float vNdl; varying float vFlat; varying float vNy;
        float gH(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
        float gN(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.0-2.0*f);
          return mix(mix(gH(i),gH(i+vec2(1.0,0.0)),u.x), mix(gH(i+vec2(0.0,1.0)),gH(i+vec2(1.0,1.0)),u.x), u.y); }
        float gF(vec2 p){ float a=0.5, s=0.0; for(int i=0;i<4;i++){ s+=a*gN(p); p*=2.03; a*=0.5; } return s/0.9375; }
        // a dark-to-light ramp through three stops (v: kit.bake's painted value, ~0.2 .. 1.1)
        vec3 ramp3(vec3 a, vec3 b, vec3 c, float v){ return v < 0.62 ? mix(a, b, smoothstep(0.2, 0.62, v)) : mix(b, c, smoothstep(0.62, 1.02, v)); }
        // our farmed land (mb 4): a patchwork of parcels, each a striped crop field, a meadow or a ripe field
        vec3 farmPaint(vec2 p){
          float a = 0.34; mat2 R = mat2(cos(a), -sin(a), sin(a), cos(a));
          vec2 q = R * p + (vec2(gN(p*0.09 + 3.0), gN(p*0.09 - 5.0)) - 0.5) * 5.0;
          vec2 cell = vec2(14.0, 10.0);
          vec2 id = floor(q / cell), f = fract(q / cell);
          float r = gH(id + 0.37), r2 = gH(id + 17.3), r3 = gH(id - 9.1);
          vec3 c;
          if (r < 0.46) {
            float w = mix(1.5, 2.4, r3);
            float t = r2 < 0.5 ? q.x : q.y;
            float band = step(0.5, fract(t / w + gN(p*0.5)*0.12));
            vec3 ca = r3 < 0.33 ? uF1 : (r3 < 0.66 ? uF0 : uF2);
            vec3 cb = r3 < 0.33 ? uF3 : (r3 < 0.66 ? uF4 : uF1);
            c = mix(ca, cb, band);
          } else if (r < 0.8) {
            c = r2 < 0.35 ? uF1 : (r2 < 0.7 ? uF2 : uF0);
            c *= 0.95 + 0.1 * gN(p * 0.35 + id);
          } else {
            c = r2 < 0.5 ? uF4 : uF5;
            c *= 0.96 + 0.06 * gN(p * 0.6);
          }
          vec2 e = min(f, 1.0 - f) * cell;
          float hedge = 1.0 - smoothstep(0.18, 0.55, min(e.x, e.y));
          return mix(c, uHedge, hedge * 0.55);
        }`)
      .replace('vec4 diffuseColor = vec4( diffuse, opacity );', `vec4 diffuseColor = vec4( diffuse, opacity );
        {
          vec2 p = vWp.xz;
          float v = vV;
          float tooth = texture2D(uPaper, p/15.0).r;
          vec4 w = vW / max(1e-3, vW.x + vW.y + vW.z + vW.w);
          // ---- the start state: cream paper relief (mb 1). Limestone a cooler paper, beaches lighter, the woods
          // muted olive-sepia masses
          vec3 creamLo = mix(uCream * vec3(0.66, 0.6, 0.6), uShadeTint, 0.32), creamHi = uCream * vec3(1.04, 1.02, 1.0);
          vec3 cream = ramp3(creamLo, uCream * 0.93, creamHi, v + 0.05);
          vec3 lime = ramp3(mix(uLime * 0.6, uShadeTint, 0.3), uLime * 0.92, uLime * 1.04, v);
          vec3 woodsIvory = mix(ramp3(vec3(0.20, 0.24, 0.14), vec3(0.36, 0.38, 0.23), vec3(0.55, 0.54, 0.36), v - 0.04), cream, 0.45);
          vec3 ivory = cream * (w.x + w.y * 1.04) + lime * w.w + woodsIvory * w.z;
          ivory = mix(ivory, ivory * (0.93 + 0.1*tooth/0.784), 1.0);
          // ---- the green spots (§21): soft painted meadow patches on the cream (mb 1 with colour), brushy edges,
          // a lighter heart and pigment pooled at the rim; the greens are the bloom palette's meadow greens
          if (uMeadowK > 0.0) {
            vec2 mu = (p - uMeadowBox.xy) / uMeadowBox.zw;
            float gm = (mu.x > 0.0 && mu.y > 0.0 && mu.x < 1.0 && mu.y < 1.0) ? texture2D(uMeadow, mu).r : 0.0;
            if (gm > 0.02) {
              float e = gm + (gF(p*0.21 + 11.0) - 0.5)*0.42 + (gN(p*1.25 + 3.0) - 0.5)*0.12 + (gN(p*2.7 - 1.0) - 0.5)*0.07;
              // the rim breaks into dry strokes (a short streak noise across the edge band)
              float streak = gN(vec2(p.x*0.55 + p.y*0.2, p.y*2.2 - p.x*0.35) + 4.0);
              e += (streak - 0.5) * 0.06 * (1.0 - smoothstep(0.4, 0.56, e));
              float mm = smoothstep(0.415, 0.475, e), core = smoothstep(0.52, 0.85, e);
              // meadow greens (deep / meadow), lighter grass in the hearts, a few drier straw-green dabs
              vec3 g0 = ramp3(uPal[0], uPal[1], mix(uPal[1], uPal[2], 0.55), v - 0.1);
              vec3 g1 = ramp3(uPal[0], mix(uPal[1], uPal[2], 0.5), uPal[2], v - 0.04);
              vec3 g2 = ramp3(mix(uPal[1], uPal[3], 0.35), mix(uPal[2], uPal[4], 0.4), mix(uPal[2], uPal[4], 0.7), v - 0.04);
              float va = gF(p*0.085 + 5.0), vb = gF(p*0.16 - 7.0);
              vec3 gc = mix(g0, g1, smoothstep(0.35, 0.7, va) * 0.7 + core * 0.3);
              gc = mix(gc, g2, smoothstep(0.62, 0.8, vb) * 0.55);
              gc *= 0.95 + 0.1*gN(vec2(p.x*0.42 + p.y*0.15, p.y*1.3 - p.x*0.12) - 2.0);   // grass strokes, close up
              gc = mix(gc, ivory, 0.08) * (1.0 - 0.12*(mm - core));
              ivory = mix(ivory, gc, mm * uMeadowK);
            }
          }
          // ---- the painted land: greens in the lowlands, sun-dried ochre / straw up the warm hills, the woods,
          // limestone, sand
          float dry = smoothstep(4.0, 22.0, vH + (gF(p*0.03 + 3.0) - 0.5) * 14.0) * 0.75;
          vec3 mead = ramp3(uPal[0], uPal[1], uPal[2], v);
          mead = mix(mead, ramp3(uPal[0]*0.8 + uPal[3]*0.2, uPal[3], uPal[4], v), dry);
          vec3 woods = ramp3(uPal[5] * 0.55, uPal[5], mix(uPal[5], uPal[1], 0.45), v - 0.04);
          vec3 rockP = ramp3(mix(uLime * 0.55, uShadeTint, 0.3), uLime * 0.9, uLime * 1.05, v);
          vec3 sandP = ramp3(uSand * 0.7, uSand * 0.94, uSand * 1.05, v);
          vec3 wild = mead * w.x + sandP * w.y + woods * w.z + rockP * w.w;
          // the bloom: brushy discs of paint round finished buildings
          float m = 0.0, inner = 0.0, mB = 0.0;
          for (int i = 0; i < MAXB; i++) {
            if (i >= uBloomN) break;
            vec4 b = uBloom[i];
            if (b.w <= 0.0) continue;
            float d = length(p - b.xy);
            if (d > b.z*1.5 + 3.0) continue;
            float k = 1.0 - pow(1.0 - b.w, 3.0);
            float R = mix(-0.6*b.z - 2.0, b.z, k);
            float dd = d + (gF(p*0.2 + b.xy*0.37) - 0.5)*b.z*0.75 + (gN(p*1.4 + b.xy) - 0.5)*1.0;
            m = max(m, 1.0 - smoothstep(R - 0.16, R + 0.16, dd));
            inner = max(inner, 1.0 - smoothstep(R - 1.5, R - 0.45, dd));
          }
          mB = m;
          if (uWorld > 0.0) {
            float wd = length(p - uC) / 200.0 + (gF(p*0.035 + 2.0) - 0.5)*0.3;
            float wm = uWorld >= 1.0 ? 1.0 : 1.0 - smoothstep(uWorld - 0.015, uWorld + 0.015, wd);
            m = max(m, wm); inner = max(inner, uWorld >= 1.0 ? 1.0 : 1.0 - smoothstep(uWorld - 0.04, uWorld - 0.01, wd));
          }
          float nat = uNations * smoothstep(0.44, 0.56, vNat + (gF(p*0.11 + 7.0) - 0.5)*0.55);
          m = max(m, nat); inner = max(inner, uNations * smoothstep(0.6, 0.75, vNat));
          float farm = mB * smoothstep(0.25, 0.7, vPlot);
          vec3 painted = mix(wild, farmPaint(p) * (0.86 + 0.28*clamp(v - 0.55, -0.4, 0.5)), farm);
          painted *= 1.0 - 0.2*clamp(m - inner, 0.0, 1.0);   // pigment pooled at the wet edge
          vec3 c = mix(ivory, painted, m);
          // sand paths between neighbours
          float pm = 0.0;
          for (int i = 0; i < MAXP; i++) {
            if (i >= uPathN) break;
            vec4 s = uPath[i]; float k = uPathK[i];
            if (k <= 0.0) continue;
            vec2 a = s.xy, bb = mix(s.xy, s.zw, k), ab = bb - a;
            float t = clamp(dot(p - a, ab)/max(dot(ab, ab), 1e-4), 0.0, 1.0);
            float d = length(p - a - ab*t);
            float pw = 0.85 + (gN(p*0.7 + float(i)*3.1) - 0.5)*0.55;
            pm = max(pm, 1.0 - smoothstep(pw - 0.14, pw + 0.14, d));
          }
          c = mix(c, uSand*(0.95 + 0.07*gN(p*2.0)) * (0.92 + 0.12*clamp(v - 0.6, -0.5, 0.5)), pm*0.92);
          // old tracks across the land
          float tm = 0.0;
          for (int i = 0; i < MAXT; i++) {
            if (i >= uTrackN) break;
            vec4 s = uTrack[i]; vec2 ab = s.zw - s.xy;
            vec2 lo = min(s.xy, s.zw) - 2.0, hi = max(s.xy, s.zw) + 2.0;
            if (p.x < lo.x || p.y < lo.y || p.x > hi.x || p.y > hi.y) continue;
            float t = clamp(dot(p - s.xy, ab)/max(dot(ab, ab), 1e-4), 0.0, 1.0);
            float d = length(p - s.xy - ab*t);
            float tw = 0.42 + (gN(p*0.5 + float(i))-0.5)*0.25;
            tm = max(tm, 1.0 - smoothstep(tw - 0.12, tw + 0.12, d));
          }
          if (tm > 0.0) {
            vec3 trackCol = mix(uCream * vec3(0.78, 0.68, 0.56), uSand * 0.92, m);
            c = mix(c, trackCol * (0.9 + 0.15*clamp(v - 0.6, -0.5, 0.5)), tm * mix(0.42, 0.8, m) * (0.75 + 0.25*gN(p*1.7)));
          }
          // shore: foam on the water line, a band of wet sand on beaches (not at a cliff's foot)
          float beachy = 1.0 - smoothstep(0.35, 0.8, vCliff);
          float foam = (1.0 - smoothstep(0.3, 0.7, vS + (gN(p*1.3)-0.5)*0.35)) * step(-0.05, vS);
          float wet = (1.0 - smoothstep(0.8, 1.9, vS + (gN(p*0.9)-0.5)*0.6)) * (1.0 - foam) * beachy;
          c = mix(c, uWet, wet*0.4);
          c = mix(c, uFoam, foam*0.85);
          if (uOutline > 0.0) {
            vec2 lo = p - uPlotBox.xy, hi = uPlotBox.zw - p;
            float sd = -min(min(lo.x, hi.x), min(lo.y, hi.y));
            vec2 ob = max(-min(lo, hi), 0.0); if (ob.x > 0.0 || ob.y > 0.0) sd = length(ob);
            float along = min(abs(lo.x), abs(hi.x)) < min(abs(lo.y), abs(hi.y)) ? p.y : p.x;
            float line = (1.0 - smoothstep(0.07, 0.17, abs(sd + (gN(p*0.8)-0.5)*0.12))) * step(0.52, fract(along / 1.25));
            line *= smoothstep(0.35, 0.6, (uCamPos.y - vWp.y) / max(1.0, length(uCamPos - vWp)));
            c = mix(c, uPencil, line * 0.42 * uOutline);
          }
          diffuseColor.rgb = c;
        }`)
      .replace('#include <envmap_fragment>', `#include <envmap_fragment>
        {
          // what the key light does not reach (slopes turned away, cast shadows) shifts to the shadow tint at the
          // same value (cobalt / violet, mb 4); a painted two-tone light firms the value structure
          float rel = clamp(vNdl / max(vFlat, 0.08), -0.5, 1.6);
          float steep = smoothstep(0.99, 0.94, vNy);   // the plain's gentle swells stay clean paper; real slopes shade
          float slope = (1.0 - smoothstep(0.0, 0.62, rel)) * steep;
          float sMask = getShadowMask();
          float castSh = 1.0 - sMask;
          float shade = max(slope * 0.55, castSh);
          outgoingLight += diffuseColor.rgb * 0.1 * slope;     // bounce light: shadows stay luminous
          float lum = dot(outgoingLight, vec3(0.3, 0.59, 0.11));
          vec3 tint = uShadeTint / max(0.05, dot(uShadeTint, vec3(0.3, 0.59, 0.11)));
          vec3 cob = mix(vec3(lum), lum * tint, 0.75) * 1.06;
          outgoingLight = mix(outgoingLight, cob, shade * uShadeK);
          // painted light: lit planes warm, turned planes cool, a brushed terminator (gouache value structure)
          // (rel = this slope's light against level ground's: a relief map's hillshade, so gentle slopes read too)
          float br = (gN(vWp.xz * 0.21) - 0.5) * 0.16;
          float lit = mix(1.0, smoothstep(0.5, 0.92, rel + br), steep) * mix(0.2, 1.0, sMask);
          float hi = smoothstep(1.08, 1.4, rel + br) * sMask;
          vec3 pl = diffuseColor.rgb * mix(mix(vec3(0.62), tint * 0.6, 0.6), vec3(1.02, 0.98, 0.9), lit) * (1.0 + 0.1 * hi) + vec3(0.05, 0.035, 0.0) * hi;
          outgoingLight = mix(outgoingLight, pl, uPaintLight * step(0.0, vS));
          // a little aerial haze toward the far land
          float dist = length(uCamPos - vWp);
          outgoingLight = mix(outgoingLight, uHazeCol, uHaze * smoothstep(140.0, 560.0, dist) * 0.8);
        }`);
  };
  const mesh = new THREE.Mesh(geom, mat);
  mesh.receiveShadow = true; mesh.name = 'ground';
  ctx.colourOnly.push(mesh);
  // the keyline world sees the land only, cut exactly at the waterline: the sea is "nothing" there, as in the
  // reference (its sea is colour-only), so coasts get an outline and the horizon gets none
  const landProxy = new THREE.Mesh(clipAbove(geom, SEA_Y), new THREE.MeshBasicMaterial());
  landProxy.visible = false; landProxy.name = 'ground-keylines'; ctx.lineOnly.push(landProxy);

  // ---------- pencil contour lines: invisible tents in the keyline world ----------
  const contourGroup = new THREE.Group(); contourGroup.name = 'contours';
  const contourMeshes = [];
  let tentW = 0.35;   // half-width of a tent in metres (follows the view: setViewScale)
  let contourMask = null;   // (x, z) -> true where a contour must not run (world: where the woods stand)
  function buildContours() {
    for (const m of contourMeshes) { contourGroup.remove(m); const i = ctx.lineOnly.indexOf(m); if (i >= 0) ctx.lineOnly.splice(i, 1); m.geometry.dispose(); }
    contourMeshes.length = 0;
    if (!look.contours) return;
    const sp = Math.max(1, look.contourSpacing);
    const levels = [];
    let maxH = 0; for (let k = 0; k < n; k++) if (hT[k] > maxH) maxH = hT[k];
    for (let lv = sp; lv < maxH; lv += sp) levels.push(lv);
    const minor = [], major = [];
    for (const [li, lv] of levels.entries()) {
      const segs = contourEdges(lv);
      const polys = chainEdges(segs);
      ((li + 1) % 5 === 0 ? major : minor).push(...polys);
    }
    const o = Math.max(0, Math.min(1, look.contourOpacity));
    if (o <= 0.01) return;
    // the tent angle sets how dark the line draws (the edge pass's normal threshold): ~32 deg faint .. ~36 full
    const deg = a => a * Math.PI / 180;
    for (const [polys, ang, name] of [[minor, lerp(32.4, 36.2, o), 'contours-minor'], [major, lerp(33.4, 37.4, o), 'contours-index']]) {
      if (!polys.length) continue;
      const m = tentMesh(polys, Math.tan(deg(ang)));
      m.name = name; contourGroup.add(m); ctx.lineOnly.push(m); contourMeshes.push(m);
    }
  }
  // marching squares on the true heights: crossings keyed by grid edge so they chain exactly; never on our plot
  // (our land is the paper the town is drawn on), never under water
  function contourEdges(level) {
    const out = [];
    const ekey = (a, b) => (a < b ? a * n + b : b * n + a);
    const cross = (a, b) => { const t = (level - hT[a]) / (hT[b] - hT[a]); return [pos[a * 3] + (pos[b * 3] - pos[a * 3]) * t, pos[a * 3 + 2] + (pos[b * 3 + 2] - pos[a * 3 + 2]) * t]; };
    for (let j = 0; j < nx - 1; j++) for (let i = 0; i < nx - 1; i++) {
      const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1;
      const ha = hT[a], hb = hT[b], hc = hT[c], hd = hT[d];
      const above = (ha > level) + (hb > level) + (hc > level) + (hd > level);
      if (above === 0 || above === 4) continue;
      if (plotA[a] > 0.35 || sA[a] < 0.5 || (contourMask && contourMask(pos[a * 3], pos[a * 3 + 2]))) continue;   // (not under trees: the lines would cross the crowns)
      // not on cliffs and steep faces (the lines would bunch into strata); the edge pass draws those anyway
      const gx = (hb - ha) / (ox[i + 1] - ox[i]), gz = (hc - ha) / (ox[j + 1] - ox[j]);
      if (gx * gx + gz * gz > 1.7) continue;
      const e = [];
      if ((ha > level) !== (hb > level)) e.push([ekey(a, b), a, b]);
      if ((hb > level) !== (hd > level)) e.push([ekey(b, d), b, d]);
      if ((hc > level) !== (hd > level)) e.push([ekey(c, d), c, d]);
      if ((ha > level) !== (hc > level)) e.push([ekey(a, c), a, c]);
      for (let q2 = 0; q2 + 1 < e.length; q2 += 2) out.push({ k0: e[q2][0], k1: e[q2 + 1][0], p0: cross(e[q2][1], e[q2][2]), p1: cross(e[q2 + 1][1], e[q2 + 1][2]) });
    }
    return out;
  }
  function chainEdges(segs) {
    const adj = new Map();
    segs.forEach((s, i) => { for (const k of [s.k0, s.k1]) { let l = adj.get(k); if (!l) adj.set(k, l = []); l.push(i); } });
    const used = new Uint8Array(segs.length), polys = [];
    for (let i0 = 0; i0 < segs.length; i0++) {
      if (used[i0]) continue; used[i0] = 1;
      const s0 = segs[i0];
      const fwd = [s0.p0, s0.p1], keys = [s0.k0, s0.k1];
      for (const dir of [1, -1]) {
        for (;;) {
          const endK = dir > 0 ? keys[keys.length - 1] : keys[0];
          const nxt = (adj.get(endK) || []).find(j => !used[j]); if (nxt == null) break;
          used[nxt] = 1; const s = segs[nxt];
          const [pk, pp] = s.k0 === endK ? [s.k1, s.p1] : [s.k0, s.p0];
          if (dir > 0) { fwd.push(pp); keys.push(pk); } else { fwd.unshift(pp); keys.unshift(pk); }
        }
      }
      if (fwd.length < 4) continue;   // specks
      const closed = keys[0] === keys[keys.length - 1];
      polys.push({ pts: simplify(fwd, 0.06), closed });
    }
    return polys;
  }
  function simplify(pts, tol) {   // Douglas-Peucker, then a wobble of the hand (a few cm, slow)
    const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
    const stack = [[0, pts.length - 1]];
    while (stack.length) {
      const [a, b] = stack.pop(); let md = 0, mi = -1;
      const ax = pts[a][0], az = pts[a][1], dx = pts[b][0] - ax, dz = pts[b][1] - az, l = Math.hypot(dx, dz) || 1e-9;
      for (let i = a + 1; i < b; i++) { const d = Math.abs((pts[i][0] - ax) * dz - (pts[i][1] - az) * dx) / l; if (d > md) { md = d; mi = i; } }
      if (md > tol && mi > 0) { keep[mi] = 1; stack.push([a, mi], [mi, b]); }
    }
    const out = [];
    for (let i = 0; i < pts.length; i++) if (keep[i]) out.push(pts[i]);
    return out.map(([x, z]) => [x + (vnoise2(x / 7 + 3.3, z / 7) - 0.5) * 0.35, z + (vnoise2(x / 7 - 1.1, z / 7 + 8.2) - 0.5) * 0.35]);
  }
  // tents over polylines: per segment two faces meeting along a ridge 0.4 w above the ground (along its normal),
  // sloping at the given tan(angle) either side; non-indexed with flat normals (the edge pass reads the crease)
  function tentMesh(polys, K) {
    let nseg = 0; for (const pl of polys) nseg += pl.pts.length - 1;
    const baseP = new Float32Array(nseg * 12 * 3), off = new Float32Array(nseg * 12 * 3), nor = new Float32Array(nseg * 12 * 3);
    let q3 = 0;
    const nAt = (x, z) => { const e = 0.6, gx = (groundY(x + e, z) - groundY(x - e, z)) / (2 * e), gz = (groundY(x, z + e) - groundY(x, z - e)) / (2 * e); const l = Math.hypot(gx, 1, gz); return [-gx / l, 1 / l, -gz / l]; };
    for (const { pts } of polys) {
      const m = pts.length;
      const P = pts.map(([x, z]) => [x, groundY(x, z), z]), N = pts.map(([x, z]) => nAt(x, z));
      const D = P.map((p, k) => {   // mitred side vector: across the line, in the ground's plane
        const a = P[Math.max(0, k - 1)], b = P[Math.min(m - 1, k + 1)];
        const tx = b[0] - a[0], ty = b[1] - a[1], tz = b[2] - a[2], nn = N[k];
        let dx = ty * nn[2] - tz * nn[1], dy = tz * nn[0] - tx * nn[2], dz = tx * nn[1] - ty * nn[0]; const l = Math.hypot(dx, dy, dz) || 1;
        return [dx / l, dy / l, dz / l];
      });
      for (let k = 0; k < m - 1; k++) {
        for (const sgn of [-1, 1]) {
          // quad: side(k), side(k+1), ridge(k+1), ridge(k)
          const V = [[k, sgn, 0], [k + 1, sgn, 0], [k + 1, 0, 1], [k, 0, 1]];
          const order = sgn < 0 ? [0, 2, 1, 0, 3, 2] : [0, 1, 2, 0, 2, 3];
          const tri = [];
          for (const o2 of order) {
            const [v, cd, cu] = V[o2], p = P[v], d = D[v], nn = N[v];
            baseP[q3] = p[0]; baseP[q3 + 1] = p[1]; baseP[q3 + 2] = p[2];
            off[q3] = d[0] * cd + nn[0] * (cu * K + 0.4); off[q3 + 1] = d[1] * cd + nn[1] * (cu * K + 0.4); off[q3 + 2] = d[2] * cd + nn[2] * (cu * K + 0.4);
            baseP[q3] += nn[0] * 0.09; baseP[q3 + 1] += nn[1] * 0.09; baseP[q3 + 2] += nn[2] * 0.09;   // never buried mid-segment on a bulging slope
            tri.push(q3); q3 += 3;
          }
          // flat normals per triangle (computed at w = 1), facing up the ground normal
          for (let t = 0; t < 6; t += 3) {
            const A = tri[t], B = tri[t + 1], Cc = tri[t + 2];
            const ax = baseP[A] + off[A], ay = baseP[A + 1] + off[A + 1], az = baseP[A + 2] + off[A + 2];
            const ux = baseP[B] + off[B] - ax, uy = baseP[B + 1] + off[B + 1] - ay, uz = baseP[B + 2] + off[B + 2] - az;
            const vx = baseP[Cc] + off[Cc] - ax, vy = baseP[Cc + 1] + off[Cc + 1] - ay, vz = baseP[Cc + 2] + off[Cc + 2] - az;
            let cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx; const l = Math.hypot(cx, cy, cz) || 1;
            const nn = N[V[order[t]][0]];
            if (cx * nn[0] + cy * nn[1] + cz * nn[2] < 0) { cx = -cx; cy = -cy; cz = -cz; }
            for (const vi of [A, B, Cc]) { nor[vi] = cx / l; nor[vi + 1] = cy / l; nor[vi + 2] = cz / l; }
          }
        }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(baseP.length), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    g.userData = { baseP, off, w: -1 };
    const mm = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })); mm.visible = false; mm.frustumCulled = false;
    setTentWidth(mm, tentW, true);
    return mm;
  }
  function setTentWidth(m, w, force = false) {
    const u = m.geometry.userData;
    if (!force && u.w > 0 && Math.abs(w - u.w) / u.w < 0.15) return false;
    const p = m.geometry.attributes.position.array, b = u.baseP, o = u.off;
    for (let i = 0; i < p.length; i++) p[i] = b[i] + o[i] * w;
    m.geometry.attributes.position.needsUpdate = true; u.w = w; return true;
  }
  // the view's metres per (internal) pixel at the target: tents stay ~2.2 px wide, minor lines thin out far away
  function setViewScale(mPerPx, dist = 100) {
    tentW = Math.max(0.03, Math.min(3, mPerPx * 3.6));   // (the face tilted away from the eye must stay >= 1 px)
    for (const m of contourMeshes) setTentWidth(m, tentW);
    const minorOn = dist < 280;
    for (const m of contourMeshes) if (m.name === 'contours-minor') m.scale.setScalar(minorOn ? 1 : 1e-4);
  }
  buildContours();

  // ---------- building pads: level the ground under a footprint (cut and fill, soft skirt) ----------
  const pads = new Map();
  function padWeight(p, x, z) {
    const dx = x - p.x, dz = z - p.z, u = Math.abs(dx * p.c - dz * p.s), v = Math.abs(dx * p.s + dz * p.c);
    const ex = Math.max(0, u - p.hw), ez = Math.max(0, v - p.hd), d = Math.hypot(ex, ez);
    return 1 - smooth(0, p.skirt, d);
  }
  function applyPads(x, z, y) {
    let W = 0, sw = 0, sy = 0;
    for (const p of pads.values()) {
      if (Math.abs(x - p.x) > p.r || Math.abs(z - p.z) > p.r) continue;
      const w = padWeight(p, x, z); if (w <= 0) continue;
      if (w >= 1) return p.y;
      const k = Math.pow(w, 24); W = Math.max(W, w); sw += k; sy += k * p.y;
    }
    return W > 0 ? lerp(y, sy / sw, W) : y;
  }
  function refresh(x0, x1, z0, z1, weightsToo = false) {
    const i0 = Math.max(0, cellOf(ox, x0 - C.x) - 1), i1 = Math.min(nx - 1, cellOf(ox, x1 - C.x) + 2);
    const j0 = Math.max(0, cellOf(ox, z0 - C.z) - 1), j1 = Math.min(nx - 1, cellOf(ox, z1 - C.z) + 2);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const k = j * nx + i, x = C.x + ox[i], z = C.z + ox[j];
      ys[k] = applyPads(x, z, base[k]); pos[k * 3 + 1] = ys[k];
    }
    shadeRange(Math.max(0, i0 - 1), Math.min(nx - 1, i1 + 1), Math.max(0, j0 - 1), Math.min(nx - 1, j1 + 1), weightsToo);
    for (const a of ['position', 'normal', 'aV', 'aW']) geom.attributes[a].needsUpdate = true;
    const lp = landProxy.geometry.attributes.position, ln = landProxy.geometry.attributes.normal;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const k = j * nx + i; lp.array[k * 3 + 1] = ys[k];
      ln.array[k * 3] = nrmA[k * 3]; ln.array[k * 3 + 1] = nrmA[k * 3 + 1]; ln.array[k * 3 + 2] = nrmA[k * 3 + 2];
    }
    lp.needsUpdate = true; ln.needsUpdate = true;
  }
  function level(key, { x, z, w = 4, d = 4, rot = 0, y = null, margin = 0.7, skirt = 2.6 } = {}) {
    const old = pads.get(key);
    if (old) pads.delete(key);
    const hy = y != null ? y : meshY(x, z, base);
    const p = { x, z, c: Math.cos(rot), s: Math.sin(rot), hw: w / 2 + margin, hd: d / 2 + margin, y: Math.max(hy, 0.02), skirt };
    p.r = Math.hypot(p.hw, p.hd) + skirt + 0.5;
    pads.set(key, p);
    const r = p.r;
    if (old) refresh(old.x - old.r, old.x + old.r, old.z - old.r, old.z + old.r);
    refresh(x - r, x + r, z - r, z + r);
    return p.y;
  }
  function unlevel(key) {
    const p = pads.get(key); if (!p) return;
    pads.delete(key); refresh(p.x - p.r, p.x + p.r, p.z - p.r, p.z + p.r);
  }
  // look.reliefScale: re-stand the whole mesh (heights, normals, the keyline proxy, the contours)
  function setReliefScale(k) {
    k = Math.max(0.3, Math.min(2.5, +k || 1));
    if (Math.abs(k - reliefK) < 1e-3) return false;
    reliefK = k; look.reliefScale = k;
    for (let j = 0; j < nx; j++) for (let i = 0; i < nx; i++) { const kk = j * nx + i; base[kk] = baseHeight(C.x + ox[i], C.z + ox[j], hT[kk]); }
    refresh(C.x + ox[0], C.x + ox[nx - 1], C.z + ox[0], C.z + ox[nx - 1]);
    landProxy.geometry.dispose(); landProxy.geometry = clipAbove(geom, SEA_Y);
    buildContours();
    return true;
  }

  // ---------- bloom API ----------
  function syncUniforms() {
    const nb = Math.min(MAX_BLOOMS, blooms.length);
    for (let i = 0; i < nb; i++) { const b = blooms[blooms.length - nb + i]; U.uBloom.value[i].set(b.x, b.z, b.r, b.k); }
    U.uBloomN.value = nb;
    const m = Math.min(MAX_PATHS, paths.length);
    for (let i = 0; i < m; i++) { const s = paths[paths.length - m + i]; U.uPath.value[i].set(s.ax, s.az, s.bx, s.bz); U.uPathK.value[i] = s.k; }
    U.uPathN.value = m;
  }
  function bloom(x, z, r = 6, { ms = 2000, key = null, delay = 0, instant = false } = {}) {
    let b = key != null ? blooms.find(o => o.key === key) : null;
    if (b) { if (r > b.r + 0.5 && b.k >= 1) b.k = 0.6; b.r = Math.max(b.r, r); b.x = x; b.z = z; }
    else { b = { x, z, r, k: instant ? 1 : 0, ms, key, delay: delay / 1000 }; blooms.push(b); }
    if (instant) b.k = 1;
    syncUniforms();
    return b;
  }
  function path(ax, az, bx, bz, { ms = 1600, delay = 0, key = null } = {}) {
    if (key != null && paths.some(p => p.key === key)) return null;
    const p = { ax, az, bx, bz, k: 0, ms, delay: delay / 1000, key }; paths.push(p); syncUniforms(); return p;
  }
  function unbloom(key) {
    const i = blooms.findIndex(o => o.key === key); if (i >= 0) blooms.splice(i, 1);
    for (let j = paths.length - 1; j >= 0; j--) if (paths[j].key && String(paths[j].key).split('|').includes(String(key))) paths.splice(j, 1);
    syncUniforms();
  }
  const tracks = [];
  function setTracks(lines) {
    tracks.length = 0;
    for (const l of lines) for (let i = 0; i + 1 < l.length; i++) if (tracks.length < MAX_TRACKS) tracks.push([l[i][0], l[i][1], l[i + 1][0], l[i + 1][1]]);
    tracks.forEach((t, i) => U.uTrack.value[i].set(t[0], t[1], t[2], t[3])); U.uTrackN.value = tracks.length;
  }
  let worldTween = null;
  const worldListeners = [];
  function setWorldBloom(v, { ms = 0 } = {}) {
    v = Math.max(0, Math.min(1, v));
    if (!ms) { U.uWorld.value = v; worldTween = null; worldListeners.forEach(f => f(v)); } else worldTween = { from: U.uWorld.value, to: v, t: 0, ms };
  }
  function update(dt) {
    let busy = false;
    for (const b of [...blooms, ...paths]) {
      if (b.k >= 1) continue;
      if (b.delay > 0) { b.delay -= dt; busy = true; continue; }
      b.k = Math.min(1, b.k + dt * 1000 / b.ms); busy = true;
    }
    if (busy) syncUniforms();
    if (worldTween) {
      worldTween.t += dt * 1000; const u = Math.min(1, worldTween.t / worldTween.ms);
      U.uWorld.value = lerp(worldTween.from, worldTween.to, u * u * (3 - 2 * u)); busy = true;
      worldListeners.forEach(f => f(U.uWorld.value));
      if (u >= 1) worldTween = null;
    }
    return busy;
  }

  // ---------- the look (the ground's share of world.setLook) ----------
  function setLook(p = {}) {
    let contoursDirty = false;
    if (p.creamColor) { look.creamColor = p.creamColor; U.uCream.value = col(p.creamColor); }
    if (Array.isArray(p.bloomPalette) && p.bloomPalette.length) { look.bloomPalette = p.bloomPalette.slice(0, 6); applyPalette(); }
    if (p.shadowTint) { look.shadowTint = p.shadowTint; U.uShadeTint.value = col(p.shadowTint); }
    if (p.shadowStrength != null) { look.shadowStrength = +p.shadowStrength; U.uShadeK.value = look.shadowStrength; }
    if (p.haze != null) { look.haze = +p.haze; U.uHaze.value = look.haze; }
    if (p.contours != null && !!p.contours !== look.contours) { look.contours = !!p.contours; contoursDirty = true; }
    if (p.contourSpacing != null && +p.contourSpacing !== look.contourSpacing) { look.contourSpacing = Math.max(1, +p.contourSpacing); contoursDirty = true; }
    if (p.contourOpacity != null && +p.contourOpacity !== look.contourOpacity) { look.contourOpacity = +p.contourOpacity; contoursDirty = true; }
    if (p.reliefScale != null && setReliefScale(p.reliefScale)) contoursDirty = false;
    if (p.meadows != null) { look.meadows = Math.max(0, Math.min(1, +p.meadows)); U.uMeadowK.value = U.uMeadow.value ? look.meadows : 0; }
    if (contoursDirty) buildContours();
  }
  function getLook() { return JSON.parse(JSON.stringify(look)); }
  // the green spots' mask (dressing.js meadowMask: { texture, box })
  function setMeadows(m) {
    if (U.uMeadow.value && U.uMeadow.value !== (m && m.texture)) U.uMeadow.value.dispose();
    U.uMeadow.value = m ? m.texture : null;
    if (m) U.uMeadowBox.value.copy(m.box);
    U.uMeadowK.value = m ? look.meadows : 0;
  }

  // ---------- the sea's depth map: the TRUE bathymetry on a regular grid (+ depth in the water, - on land) ----------
  function depthTexture(size = 512, extent = half) {
    const data = new Uint8Array(size * size * 4), k0 = Math.sqrt(12), k1 = Math.sqrt(60);
    for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
      const x = C.x - extent + (i + 0.5) / size * extent * 2, z = C.z - extent + (j + 0.5) / size * extent * 2;
      const h = meshY(x, z, hT), y = meshY(x, z, ys);
      let v;
      if (h < 0 && !inLakePoly(x, z)) v = -h;                // the sea, the river: true depth
      else v = -Math.min(12, 0.3 + Math.max(0, h) * 3);       // land (and the lake): never sea; the edge sits on the waterline
      if (y < SEA_Y - 0.05 && !inLakePoly(x, z) && v < 0.2) v = 0.25;
      v = Math.max(-12, Math.min(60, v));
      const e = (Math.sign(v) * Math.sqrt(Math.abs(v)) + k0) / (k0 + k1);
      const o = (j * size + i) * 4; data[o] = Math.round(e * 255); data[o + 1] = 0; data[o + 2] = 0; data[o + 3] = 255;
    }
    const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.needsUpdate = true;
    return { texture: t, box: new THREE.Vector4(C.x - extent, C.z - extent, extent * 2, extent * 2), k0, k1 };
  }

  return { mesh, landProxy, contours: contourGroup, material: mat, uniforms: U, geometry: geom, axis: ox, nx, heights: ys, trueHeights: hT, base, C,
    shoreS: shoreAt, shoreField: shoreS, groundY, baseHeight, plotWeight, inLake: inLakePoly,
    bloom, path, unbloom, setWorldBloom, onWorldBloom: f => worldListeners.push(f), setTracks, tracks, update, blooms, paths, ramps, level, unlevel, pads, depthTexture,
    setLook, getLook, look, setViewScale, setMeadows, buildContours, setContourMask(f) { contourMask = f; buildContours(); }, get tentW() { return tentW; } };
}

// a copy of an indexed mesh with every triangle clipped to y >= level (new vertices on the cut edges)
function clipAbove(geom, level) {
  const P = geom.attributes.position.array, N = geom.attributes.normal.array, I = geom.index.array;
  const pos = Array.from(P), nor = Array.from(N), idx = [];
  const cut = new Map();
  const mid = (a, b) => {
    const key = a < b ? a * 4194304 + b : b * 4194304 + a;
    let k = cut.get(key); if (k !== undefined) return k;
    const ya = P[a * 3 + 1], yb = P[b * 3 + 1], t = (ya - level) / (ya - yb);
    k = pos.length / 3;
    for (let c = 0; c < 3; c++) { pos.push(P[a * 3 + c] + (P[b * 3 + c] - P[a * 3 + c]) * t); nor.push(N[a * 3 + c] + (N[b * 3 + c] - N[a * 3 + c]) * t); }
    pos[k * 3 + 1] = level; cut.set(key, k); return k;
  };
  for (let q = 0; q < I.length; q += 3) {
    const v = [I[q], I[q + 1], I[q + 2]], up = v.map(i => P[i * 3 + 1] >= level), n = up.filter(Boolean).length;
    if (n === 3) { idx.push(v[0], v[1], v[2]); continue; }
    if (n === 0) continue;
    let r = 0; for (let k = 0; k < 3; k++) if ((n === 1 && up[k]) || (n === 2 && !up[k])) r = k;
    const a = v[r], b = v[(r + 1) % 3], c = v[(r + 2) % 3];
    if (n === 1) idx.push(a, mid(a, b), mid(a, c));
    else { const ab = mid(a, b), ac = mid(a, c); idx.push(ab, b, c, ab, c, ac); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(idx); g.computeBoundingSphere();
  return g;
}

// marching squares on the ground grid: segments where a per-vertex field crosses `level`
export function contourSegments(axis, nx, C, field, level, maxD = Infinity) {
  const segs = [];
  const lz = (a, b, ha, hb) => a + (b - a) * ((ha - level) / (ha - hb));
  for (let j = 0; j < nx - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const x0 = C.x + axis[i], x1 = C.x + axis[i + 1], z0 = C.z + axis[j], z1 = C.z + axis[j + 1];
    if (Math.hypot(x0 - C.x, z0 - C.z) > maxD) continue;
    const h00 = field[j * nx + i], h10 = field[j * nx + i + 1], h01 = field[(j + 1) * nx + i], h11 = field[(j + 1) * nx + i + 1];
    const pts = [];
    if ((h00 > level) !== (h10 > level)) pts.push([lz(x0, x1, h00, h10), z0]);
    if ((h10 > level) !== (h11 > level)) pts.push([x1, lz(z0, z1, h10, h11)]);
    if ((h01 > level) !== (h11 > level)) pts.push([lz(x0, x1, h01, h11), z1]);
    if ((h00 > level) !== (h01 > level)) pts.push([x0, lz(z0, z1, h00, h01)]);
    for (let q = 0; q + 1 < pts.length; q += 2) segs.push([pts[q], pts[q + 1]]);
  }
  return segs;
}

// invisible double-sided "tent" ribbons over segments: the keyline world sees a crease there (globe's trick)
export function ribbonMesh(ctx, segs, yAt, w, h) {
  const pos = [], nor = [], idx = [];
  for (const [a, b] of segs) {
    const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1, px = -dz / l, pz = dx / l;
    const ya = yAt(a[0], a[1]), yb = yAt(b[0], b[1]);
    for (const sgn of [1, -1]) {
      const base = pos.length / 3, nl = Math.hypot(h, w) || 1;
      pos.push(a[0] + px * w * sgn, ya - 0.02, a[1] + pz * w * sgn, a[0], ya + h, a[1], b[0] + px * w * sgn, yb - 0.02, b[1] + pz * w * sgn, b[0], yb + h, b[1]);
      for (let k = 0; k < 4; k++) nor.push(px * sgn * h / nl, w / nl, pz * sgn * h / nl);
      if (sgn > 0) idx.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
      else idx.push(base, base + 2, base + 1, base + 2, base + 3, base + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setIndex(idx);
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial()); m.visible = false; m.frustumCulled = false;
  ctx.lineOnly.push(m); return m;
}
