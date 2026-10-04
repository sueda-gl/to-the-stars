// The cloud pass: the bank of cloud her planet's descent flies through on the way down to the seaside map (and back up
// through on the way out). It is what makes the landing one uncut shot (Sueda 2026-10-04: "i want the descent to earth
// to be seamless ... no cuts in between"): the planet and the map are swapped while the cloud fills the frame.
//
// The puffs are billboards in a FLAT frame anchored on the landing target (game axes, y up, metres): the same cloud
// stands at the same place over her planet (anchored on its tangent frame there) and over the map, so whichever camera
// is live (hers before the swap, the map's after) projects it to the same pixels when the two poses match. Painted in
// her own cloud palette (planet/build.js: the four toon tones, lit from the viewer's upper left, value-noise mottled);
// her shaders are not touched: this is a 2D canvas laid over both canvases (z 2: over hers, under the UI).
//
//   const clouds = createCloudPass();
//   clouds.deck(H)                          // the deck for a swap at camera height H (m above the anchor)
//   clouds.draw(localCamera)                // a THREE camera whose world is the anchor frame; returns the cover (0..1)
//   clouds.hide()
//   clouds.cover(y) -> 0..1                 // how opaque the inside of the cloud is at camera height y

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const h21 = (x, y) => { let px = x * 123.34 - Math.floor(x * 123.34), py = y * 456.21 - Math.floor(y * 456.21); const d = px * (px + 45.32) + py * (py + 45.32); px += d; py += d; const v = px * py; return v - Math.floor(v); };
function vn(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y); let fx = x - ix, fy = y - iy; fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
  const a = h21(ix, iy), b = h21(ix + 1, iy), c = h21(ix, iy + 1), d = h21(ix + 1, iy + 1);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}
const fbm = (x, y) => vn(x, y) * 0.55 + vn(x * 2.03 + 7.1, y * 2.03 - 3.3) * 0.3 + vn(x * 4.1 - 11, y * 4.1 + 5) * 0.15;

// her cloud tones (planet/build.js cloud shader), light to dark
const TONES = [[0.98, 0.99, 1.0], [0.83, 0.88, 0.98], [0.60, 0.70, 0.93], [0.36, 0.48, 0.85]].map(c => c.map(v => Math.round(v * 255)));
const tone = t => (t > 0.62 ? TONES[0] : t > 0.47 ? TONES[1] : t > 0.32 ? TONES[2] : TONES[3]);
// her sun is the viewer's upper-left-front (views.js: L = -0.55 right + 0.62 up + 0.52 back), screen y down here
const LX = -0.55, LY = -0.62, LZ = 0.52, LN = Math.hypot(LX, LY, LZ);

// one puff sprite: a cluster of lumpy balls in a loose row (her clouds: five balls, the middle one raised), toon-lit
function makeSprite(seed, W = 360) {
  const r = mulberry32(seed), n = 4 + Math.floor(r() * 3), balls = [];
  for (let k = 0; k < n; k++) {
    const c = k - (n - 1) / 2, mid = 1 - Math.abs(c) / ((n + 1) / 2);
    balls.push({ x: c * 0.62 + (r() - 0.5) * 0.2, y: -(0.18 + 0.32 * mid) + (r() - 0.5) * 0.18, z: (r() - 0.5) * 0.4, r: (0.5 + 0.45 * mid) * (0.82 + r() * 0.3), ph: r() * 40 });
  }
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (const b of balls) { x0 = Math.min(x0, b.x - b.r * 1.15); x1 = Math.max(x1, b.x + b.r * 1.15); y0 = Math.min(y0, b.y - b.r * 1.15); y1 = Math.max(y1, b.y + b.r * 1.15); }
  const sc = W / (x1 - x0), H = Math.ceil((y1 - y0) * sc);
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d'), img = g.createImageData(W, H), D = img.data;
  const nseed = r() * 100;
  for (let py = 0; py < H; py++) {
    for (let px = 0; px < W; px++) {
      const X = x0 + (px + 0.5) / sc, Y = y0 + (py + 0.5) / sc;
      let best = -1e9, nx = 0, ny = 0, nz = 0, edge = 0;
      for (const b of balls) {
        const dx = X - b.x, dy = Y - b.y, d = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
        // lumpy rim (her vertices are pushed by fbm, +-21 %)
        const rr = b.r * (1 + (fbm(Math.cos(a) * 1.3 + b.ph, Math.sin(a) * 1.3 + b.ph * 0.7) - 0.5) * 0.42);
        if (d >= rr) continue;
        const q = d / rr, z = Math.sqrt(1 - q * q);
        const zz = b.z + z * rr;
        if (zz > best) { best = zz; nx = dx / rr; ny = dy / rr; nz = z; edge = (rr - d) * sc; }
      }
      const o = (py * W + px) * 4;
      if (best < -1e8) { D[o + 3] = 0; continue; }
      // her lighting: half-lambert + mottling + a lift toward the viewer (her dot(n, normalize(vW)) term)
      let t = (nx * LX + ny * LY + nz * LZ) / LN * 0.5 + 0.5;
      t += (vn(X * 2.6 + nseed, Y * 2.6) - 0.5) * 0.32 + (h21(px * 0.37, py * 0.53) - 0.5) * 0.05;
      t += 0.14 * nz;
      const c = tone(t);
      D[o] = c[0]; D[o + 1] = c[1]; D[o + 2] = c[2]; D[o + 3] = Math.round(255 * clamp(edge / 1.4, 0, 1));
    }
  }
  g.putImageData(img, 0, 0);
  return { cv, aspect: H / W };
}

// the inside of the cloud: the two light tones in soft mottled patches (a tile, zoomed as the camera moves through)
function makeInside(W = 256) {
  const cv = document.createElement('canvas'); cv.width = W; cv.height = W;
  const g = cv.getContext('2d'), img = g.createImageData(W, W), D = img.data;
  for (let py = 0; py < W; py++) for (let px = 0; px < W; px++) {
    const u = px / W, v = py / W;
    // periodic noise (the tile repeats seamlessly)
    const f = (a, b) => { const s = Math.sin(a * Math.PI * 2), c = Math.cos(a * Math.PI * 2), s2 = Math.sin(b * Math.PI * 2), c2 = Math.cos(b * Math.PI * 2); return fbm(s * 0.9 + c2 * 0.9 + 3, c * 0.9 + s2 * 0.9 + 7); };
    // her two lightest tones, in four soft steps (no hard camouflage shapes): the inside of the cloud is pale and calm
    const t = clamp(0.5 + (f(u, v) - 0.5) * 1.6 + (h21(px * 0.31, py * 0.71) - 0.5) * 0.06, 0, 1);
    const q = Math.round(t * 3) / 3, c = TONES[0].map((v0, i) => Math.round(v0 + (TONES[1][i] - v0) * q * 0.75));
    const o = (py * W + px) * 4; D[o] = c[0]; D[o + 1] = c[1]; D[o + 2] = c[2]; D[o + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return cv;
}

export function createCloudPass({ zIndex = 2, scale = 1 } = {}) {
  const cv = document.createElement('canvas');
  cv.className = 'ag-clouds'; cv.setAttribute('aria-hidden', 'true');
  Object.assign(cv.style, { position: 'fixed', inset: '0', width: '100%', height: '100%', display: 'none', pointerEvents: 'none', zIndex: String(zIndex) });
  document.body.appendChild(cv);
  const g = cv.getContext('2d');
  let sprites = null, inside = null, puffs = [], H = 250, lo = 0.55, shown = false;

  // sprites are made once, a few per idle slice (each is ~10-20 ms of JS), well before the first descent
  let prepP = null;
  function prepare() {
    if (prepP) return prepP;
    prepP = (async () => {
      const out = [];
      const idle = () => new Promise(r => (window.requestIdleCallback ? requestIdleCallback(() => r(), { timeout: 400 }) : setTimeout(r, 30)));
      for (let i = 0; i < 7; i++) { await idle(); out.push(makeSprite(1013 + i * 97)); }
      await idle(); inside = makeInside();
      sprites = out;
      return true;
    })();
    return prepP;
  }
  const ensure = () => { if (!sprites) { const out = []; for (let i = 0; i < 7; i++) out.push(makeSprite(1013 + i * 97)); sprites = out; inside = makeInside(); } };

  // the deck for a swap with the camera at (cx, h, cz) in the anchor frame: a compact bank round the camera there (the
  // core, 0.82 h - 1.22 h, which the camera flies right through), a few loose wisps under it (passed on the way out)
  // and a few on top (met first on the way in)
  // avoid: the camera's path out of the cloud (anchor-frame points): the wisps under the core are kept off it, so they
  // slide past the camera and out of frame instead of swallowing it over open ground (a thinning puff there reads as a
  // dissolve; inside the core the wash hides that)
  function deck(h, cx = 0, cz = 0, { avoid = null, lo: low = 0.55 } = {}) {
    H = Math.max(20, h); lo = low;
    const r = mulberry32(4242), out = [];
    const clear = (x, y, z, s) => {
      if (!avoid || y > H * 0.86) return true;
      for (const q of avoid) if (Math.hypot(q.x - x, q.y - y, q.z - z) < s * 2.6) return false;
      return true;
    };
    const add = (n, y0, y1, R0, R1, s0, s1) => {
      for (let i = 0, tries = 0; i < n && tries < n * 30; tries++) {
        const y = H * (y0 + (y1 - y0) * r()), R = H * (R0 + (R1 - R0) * Math.sqrt(r())), a = r() * Math.PI * 2;
        const p = { x: cx + Math.cos(a) * R, y, z: cz + Math.sin(a) * R, s: H * (s0 + (s1 - s0) * r()), k: Math.floor(r() * 7), flip: r() < 0.5, w: 0.9 + r() * 0.35 };
        if (!clear(p.x, p.y, p.z, p.s)) continue;
        out.push(p); i++;
      }
    };
    add(70, 0.84, 1.18, 0, 0.42, 0.10, 0.17);     // the core
    add(14, 1.18, 1.34, 0.05, 0.36, 0.09, 0.14);  // the crown
    add(34, 0.5, 0.86, 0.04, 0.5, 0.06, 0.12);    // wisps under it (passed on the way out)
    puffs = out;
    return api;
  }
  // inside the cloud (camera height y): opaque from 0.93 h to 1.04 h; it gathers from 1.25 h and thins out slowly
  // below (to lo h, 0.55 by default: a move ending or starting higher gets a shorter tail), the way a cloud's underside
  // breaks up as you come out of it
  const cover = y => smooth(H * 1.25, H * 1.04, y) * Math.pow(smooth(H * lo, H * 0.93, y), 0.8);

  function size() {
    const w = Math.max(1, Math.round(innerWidth * scale)), h = Math.max(1, Math.round(innerHeight * scale));
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    return [w, h];
  }
  const _v = new THREE.Vector3(), _c = new THREE.Vector3();
  const list = [];
  // draw the deck as seen by `cam` (a camera in the anchor frame: matrixWorld / projectionMatrix up to date). `fade`
  // scales everything (0 hides). Returns the inside cover at the camera.
  function draw(cam, { fade = 1, grow: growAll = 1 } = {}) {
    ensure();
    cam.updateMatrixWorld(); cam.matrixWorldInverse.copy(cam.matrixWorld).invert();
    _c.setFromMatrixPosition(cam.matrixWorld);
    fade *= smooth(H * 0.3, H * 0.55, _c.y);          // well under the bank (the landing view) it is put away
    const W = cover(_c.y) * fade * growAll;
    const [w, h] = size();
    const P = cam.projectionMatrix.elements, fy = P[5] * h / 2;
    list.length = 0;
    for (const p of puffs) {
      _v.set(p.x, p.y, p.z).applyMatrix4(cam.matrixWorldInverse);
      const depth = -_v.z;
      if (depth < p.s * 0.25) continue;
      // far: the bank gathers (each puff swells from nothing) as we come down to it; near: a puff thins out as it
      // swallows the camera. Never a see-through puff over open space: only the near ones (over the wash) thin.
      const a = fade * smooth(p.s * 0.35, p.s * 1.6, depth);
      if (a <= 0.003) continue;
      const grow = smooth(H * 3.0, H * 1.55, _c.y - p.y + H) * growAll;
      if (grow <= 0.01) continue;
      _v.applyMatrix4(cam.projectionMatrix);
      const sx = (_v.x + 1) / 2 * w, sy = (1 - _v.y) / 2 * h, rad = p.s * grow * fy / depth;
      const sp = sprites[p.k], sw = rad * 2.3 * p.w, sh = sw * sp.aspect;
      if (sx + sw / 2 < 0 || sx - sw / 2 > w || sy + sh / 2 < 0 || sy - sh / 2 > h) continue;
      list.push({ depth, a, sx, sy, sw, sh, sp, flip: p.flip });
    }
    list.sort((A, B) => B.depth - A.depth);
    if (!list.length && W <= 0.003) { hide(); return W; }
    if (!shown) { cv.style.display = ''; shown = true; }
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, w, h);
    g.imageSmoothingEnabled = true;
    // the puffs beyond the fog are drawn first, then the inside of the cloud, then the near wisps over it
    const FOG = H * 0.14;
    let washed = false;
    const wash = () => {
      washed = true;
      if (W <= 0.003) return;
      g.globalAlpha = W;
      // the tile zooms with the height (the camera moves through it), centred
      const z = Math.pow(H / Math.max(1, _c.y), 3.2) * Math.max(w, h) / 256 * 0.9;
      const tw = 256 * z;
      g.save(); g.translate(w / 2, h / 2);
      const pat = g.createPattern(inside, 'repeat');
      pat.setTransform(new DOMMatrix([z, 0, 0, z, -tw / 2, -tw / 2]));
      g.fillStyle = pat; g.fillRect(-w / 2, -h / 2, w, h);
      g.restore();
    };
    for (const it of list) {
      if (!washed && it.depth < FOG) wash();
      if (!washed && W >= 0.995) continue;              // behind an opaque inside: never seen, never drawn (overdraw)
      g.globalAlpha = it.a;
      if (it.flip) { g.save(); g.translate(it.sx, it.sy); g.scale(-1, 1); g.drawImage(it.sp.cv, -it.sw / 2, -it.sh / 2, it.sw, it.sh); g.restore(); }
      else g.drawImage(it.sp.cv, it.sx - it.sw / 2, it.sy - it.sh / 2, it.sw, it.sh);
    }
    if (!washed) wash();
    g.globalAlpha = 1;
    return W;
  }
  function hide() { if (shown) { cv.style.display = 'none'; shown = false; } }

  const api = { el: cv, prepare, deck, draw, hide, cover, get H() { return H; }, get shown() { return shown; }, get puffs() { return puffs; } };
  return api;
}
