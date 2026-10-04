// Paint context: the Red arch's utilities, verbatim, around ONE shared rnd stream.
// Every verbatim module draws from ctx.rnd in the reference's order; never make a new RNG in a copied path.

// ================= utilities =================
export function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// the reference's renderer, verbatim (soft shadows, manual shadow updates, canvas first in <body>)
export function createRenderer() {
  // ================= renderer / scene =================
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;
  document.body.prepend(renderer.domElement);
  return renderer;
}

export function createContext({ renderer, scene, camera, seed = 11 }) {
  const rnd = mulberry32(seed);
  const R = (a, b) => a + (b - a) * rnd();
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const Y = V(0, 1, 0);
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const L = V(-0.8, 0.6, 0.45).normalize();   // painted light: from the left, slightly in front
  const col = h => new THREE.Color(h);
  function ramp(cols, v) {
    v = Math.min(1, Math.max(0, v));
    const n = cols.length - 1, i = Math.min(n - 1, Math.floor(v * n)), f = v * n - i;
    return cols[i].clone().lerp(cols[i + 1], f);
  }
  return {
    THREE, renderer, scene, camera, rnd, R, V, Y, col, ramp, L, mulberry32, reduceMotion,
    colourOnly: [],   // things that should never produce keylines (sky, sea, leaves, folk...)
    lineOnly: [],     // smooth proxies that only exist for keyline extraction
    folkHidden: [],   // hidden during the folk pass (reference: sky, sea, pool, foam, sun)
    reflectors: [],   // Reflectors resized to the internal paint size (reference: pool)
    flags: { closeUp: false }
  };
}
