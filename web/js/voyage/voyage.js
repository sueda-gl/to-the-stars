// The voyage: Earth -> the shadelings' moon (Sueda's "Alpine lounge", untouched, in a same-origin iframe) and back.
//
//   const voyage = createVoyage({ container, onArrive, onReturn, hooks: { liftOff(ms), land(ms) } });
//   await voyage.depart(snapshot?)   // Earth lifts away -> riso/gouache passage -> crossfade into the lounge -> onArrive(driver)
//                                    // (resolves null and calls onFail(err) after flying home if the lounge can't load)
//   voyage.arrive()                  // skip ahead: cut the passage short (or jump straight there from Earth)
//   await voyage.returnHome()        // the lounge fades into the passage, Earth rises, the ink sheet lifts -> onReturn()
//   voyage.driver                    // createLoungeDriver(): dropSeed, setGoldenHour, setPainted, look, hideOwnChrome...
//
// The passage is canvas2D in the print grammar of the Red arch editions: a night sky printed in ink over
// cream paper with a halftone screen and paper specks where the ink didn't take, stars knocked out as
// paper-coloured dots (a few with a pink plate a hair off register), a painted gouache moon that grows
// while its pink plate slides INTO register as you arrive, the coast's sunset as a halftone band falling
// away, a torn ink sheet that comes down over the Earth (fibrous pale core on the tear), and the title in
// Instrument Serif printed twice, paper and pink, misregistered.

import { createLoungeDriver } from './lounge-driver.js';

const INK = {
  paper: '#f3ecdc', ink: '#3d5588', night: '#222c57', deep: '#18203f',
  pink: '#f15060', yellow: '#ffe800', red: '#e0503f', peach: '#f7bd85'
};

const WORDS = {
  out: { kicker: 'Earth’s envoy, by election', title: 'To the Moon', then: 'The Shadelings', sub: 'a meadow, a lake, a red rug', wait: 'the shadelings are lighting their lanterns…', failed: 'the moon is clouded over tonight; we turn for home' },
  home: { kicker: 'the envoy returns', title: 'Home', then: 'The Coast', sub: 'back to the cream plot by the sea', wait: '' }
};

// ---------- tiny value noise for the CPU painter ----------
function hash2(x, y) { let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; }
function vn2(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const sstep = (a, b, x) => { let t = (x - a) / (b - a); t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const mix3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const ease = t => t < 0 ? 0 : t > 1 ? 1 : t * t * (3 - 2 * t);
const easeOut = t => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
const easeIn = t => Math.pow(Math.min(1, Math.max(0, t)), 2.2);
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// ---------- painted bodies (CPU, once): gouache bands, painted terminator, flat craters, brush, tooth ----------
// kind 'moon' matches web/js/world/moon.js tones; kind 'earth' is the Red arch's sea, cream land and sundown rim.
function paintBody(size, kind) {
  const cv = document.createElement('canvas'); cv.width = cv.height = size;
  const g = cv.getContext('2d'), img = g.createImageData(size, size), D = img.data;
  const L = kind === 'moon' ? [0.62, -0.42, 0.66] : [0.55, -0.35, 0.76];
  const ll = Math.hypot(...L); L[0] /= ll; L[1] /= ll; L[2] /= ll;
  const L2 = [L[0] / Math.hypot(L[0], L[1]), L[1] / Math.hypot(L[0], L[1])];
  const T = kind === 'moon'
    ? { deep: [0.50, 0.53, 0.75], peri: [0.64, 0.64, 0.82], lilac: [0.82, 0.76, 0.88], cream: [0.96, 0.92, 0.84], rim: [0.99, 0.80, 0.63] }
    : { deep: [0.16, 0.30, 0.52], peri: [0.17, 0.47, 0.66], lilac: [0.30, 0.62, 0.74], cream: [0.40, 0.74, 0.80], rim: [0.97, 0.74, 0.52] };
  const craters = [[-0.36, 0.30, 0.22], [0.30, -0.16, 0.17], [0.08, 0.56, 0.12], [-0.10, -0.52, 0.18], [0.56, 0.30, 0.11], [-0.64, -0.14, 0.09], [0.20, 0.14, 0.08], [-0.3, -0.22, 0.06], [0.42, 0.62, 0.06]];
  const h = size / 2, R = h * 0.94;
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    const k = (j * size + i) * 4;
    const x = (i + 0.5 - h) / R, y = -(j + 0.5 - h) / R, r = Math.hypot(x, y);
    const ang = Math.atan2(y, x);
    const edge = 1 + (vn2(ang * 2.5 + 10, 3) - 0.5) * 0.02 + (vn2(ang * 40, 7) - 0.5) * 0.006;
    const cover = 1 - sstep(edge - 1.4 / R, edge + 1.4 / R, r);
    if (cover <= 0) { D[k + 3] = 0; continue; }
    const z = Math.sqrt(Math.max(0, 1 - r * r));
    let lam = x * L[0] + y * L[1] + z * L[2];
    lam += (vn2(x * 3.1 + 7, y * 3.1 + 7) - 0.5) * 0.16 + (vn2(x * 8 + 2, y * 8 + 2) - 0.5) * 0.05;
    let c = T.deep;
    c = mix3(c, T.peri, sstep(-0.18, -0.14, lam));
    c = mix3(c, T.lilac, sstep(0.18, 0.22, lam));
    c = mix3(c, T.cream, sstep(0.50, 0.54, lam));
    if (kind === 'moon') {
      const mare = vn2(x * 1.7 + 4.1, y * 1.7 + 1.3) * 0.7 + vn2(x * 4.3, y * 4.3) * 0.3;
      const m = sstep(0.57, 0.59, mare) * 0.55;
      c = mix3(c, [c[0] * 0.93, c[1] * 0.9, c[2] * 0.97 + 0.04], m);
      for (let q = 0; q < craters.length; q++) {
        const [cx, cy, cr] = craters[q];
        const qx = (x - cx) / cr, qy = (y - cy) / cr;
        const d = Math.hypot(qx, qy) - 1 + (vn2(qx * 2 + q * 3.7, qy * 2) - 0.5) * 0.25;
        if (d > 0.05) continue;
        const fl = 1 - sstep(-0.015, 0.015, d);
        const lip = 1 - sstep(-0.015, 0.015, Math.hypot(qx + L2[0] * 0.3, qy + L2[1] * 0.3) - 0.84);
        c = mix3(c, [c[0] * 0.84, c[1] * 0.83, c[2] * 0.9 + 0.04], fl * (1 - lip));
        c = mix3(c, [c[0] * 0.95, c[1] * 0.94, c[2] * 0.97], fl * lip);
      }
    } else {
      // land: cream paper continents with coral coasts and a few olive groves (flat shapes)
      const land = vn2(x * 2.2 + 11, y * 2.2 + 5) * 0.65 + vn2(x * 5.5 + 3, y * 5.5) * 0.35;
      const lit = sstep(-0.2, 0.3, lam);
      const landC = mix3([0.55, 0.50, 0.58], [0.95, 0.89, 0.78], lit);
      const coast = sstep(0.585, 0.6, land) - sstep(0.61, 0.625, land);
      c = mix3(c, mix3([0.6, 0.42, 0.45], [0.88, 0.42, 0.30], lit), sstep(0.585, 0.6, land) * 0.95);
      c = mix3(c, landC, sstep(0.61, 0.625, land));
      const grove = vn2(x * 9 + 1, y * 9 + 4);
      c = mix3(c, mix3([0.35, 0.40, 0.42], [0.58, 0.62, 0.40], lit), sstep(0.68, 0.7, grove) * sstep(0.64, 0.66, land) * 0.9);
      void coast;
      // cloud wisps, flat cream
      const cl = vn2(x * 3 + 20, y * 9 + 2);
      c = mix3(c, mix3([0.6, 0.62, 0.78], [0.98, 0.95, 0.9], lit), sstep(0.74, 0.76, cl) * 0.85);
    }
    // the sundown rim on the sun's side
    const side = (x * L2[0] + y * L2[1]) / Math.max(r, 1e-4);
    const rim = (1 - sstep(-0.01, 0.01, (kind === 'moon' ? 0.84 : 0.8) - r + (vn2(x * 6, y * 6) - 0.5) * 0.04)) * sstep(0.25, 0.75, side);
    c = mix3(c, T.rim, rim * 0.9);
    // brush: strokes laid along the curve of the ball (long along the arc, thin across)
    const du = (x + y) * 0.7071, dv = (x - y) * 0.7071;
    const s1 = vn2(ang * 5 + r * 2, r * 34) * 0.45 + vn2(du * 9 + 5, dv * 46 + 3) * 0.55;
    let f = 1 + (s1 - 0.5) * 0.09;
    // paper tooth + dry brush near the edge
    const tooth = vn2(i * 0.35, j * 0.35) * 0.7 + hash2(i, j) * 0.3;
    f *= 1 + (tooth - 0.5) * 0.06;
    const dry = sstep(0.9, 0.99, tooth + (0.5 - s1) * 0.5 + sstep(0.93, 1.0, r) * 0.18);
    c = mix3([c[0] * f, c[1] * f, c[2] * f], [0.953, 0.925, 0.863], dry * 0.4);
    D[k] = Math.min(255, c[0] * 255); D[k + 1] = Math.min(255, c[1] * 255); D[k + 2] = Math.min(255, c[2] * 255); D[k + 3] = cover * 255;
  }
  g.putImageData(img, 0, 0);
  return cv;
}
// the body's silhouette as one flat plate (for the misregistered pink pass)
function plateOf(body, colour) {
  const cv = document.createElement('canvas'); cv.width = body.width; cv.height = body.height;
  const g = cv.getContext('2d'); g.drawImage(body, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = colour; g.fillRect(0, 0, cv.width, cv.height);
  return cv;
}

// ---------- the printed night: ink over paper, halftone screen, specks, registration marks ----------
function printNight(w, h, dpr) {
  const cv = document.createElement('canvas'); cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
  const g = cv.getContext('2d'); g.scale(dpr, dpr);
  const gr = g.createLinearGradient(0, 0, 0, h);
  gr.addColorStop(0, INK.deep); gr.addColorStop(0.55, INK.night); gr.addColorStop(1, INK.ink);
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  // second drum: a 45-degree halftone of deep ink, heavier toward the top
  g.save(); g.translate(w / 2, h / 2); g.rotate(Math.PI / 4);
  const cell = 7, ext = Math.hypot(w, h) / 2 + cell;
  g.fillStyle = 'rgba(16, 22, 46, 0.55)';
  for (let y = -ext; y < ext; y += cell) for (let x = -ext; x < ext; x += cell) {
    const sy = x * Math.sin(Math.PI / 4) + y * Math.cos(Math.PI / 4) + h / 2;   // back to screen y
    const dens = 0.85 - Math.min(1, Math.max(0, sy / h)) * 0.8 + (hash2(x * 3, y * 3) - 0.5) * 0.12;
    if (dens <= 0.04) continue;
    g.beginPath(); g.arc(x, y, Math.sqrt(dens) * cell * 0.52, 0, 6.283); g.fill();
  }
  g.restore();
  // paper specks where the ink didn't take, and the odd ink-heavy blot
  const r = mulberry32(7);
  for (let i = 0; i < w * h / 900; i++) {
    g.fillStyle = r() < 0.8 ? 'rgba(243, 236, 220, 0.10)' : 'rgba(10, 14, 32, 0.25)';
    g.fillRect(r() * w, r() * h, 0.6 + r() * 1.4, 0.6 + r() * 1.2);
  }
  // registration marks in the corners (pink + ink, slightly off each other)
  const mark = (x, y, col, o) => { g.strokeStyle = col; g.lineWidth = 1; g.beginPath(); g.arc(x + o, y + o * 0.6, 7, 0, 6.283); g.moveTo(x - 12 + o, y + o * 0.6); g.lineTo(x + 12 + o, y + o * 0.6); g.moveTo(x + o, y - 12 + o * 0.6); g.lineTo(x + o, y + 12 + o * 0.6); g.stroke(); };
  for (const [x, y] of [[26, 26], [w - 26, 26], [26, h - 26], [w - 26, h - 26]]) { mark(x, y, 'rgba(243,236,220,0.55)', 0); mark(x, y, 'rgba(241,80,96,0.7)', 1.6); }
  return cv;
}
// the sunset left behind: a halftone band of the coast's peach and pink, printed in two screens
function printSunset(w, h, dpr) {
  const H = Math.round(h * 0.55);
  const cv = document.createElement('canvas'); cv.width = Math.round(w * dpr); cv.height = Math.round(H * dpr);
  const g = cv.getContext('2d'); g.scale(dpr, dpr);
  const screen = (col, cell, ang, k0) => {
    g.save(); g.translate(w / 2, H / 2); g.rotate(ang); g.fillStyle = col;
    const ext = Math.hypot(w, H) / 2 + cell;
    for (let y = -ext; y < ext; y += cell) for (let x = -ext; x < ext; x += cell) {
      const sy = x * Math.sin(ang) + y * Math.cos(ang) + H / 2;
      const t = Math.min(1, Math.max(0, sy / H));
      const dens = Math.pow(t, 1.6) * k0;
      if (dens < 0.03) continue;
      g.beginPath(); g.arc(x, y, Math.sqrt(dens) * cell * 0.55, 0, 6.283); g.fill();
    }
    g.restore();
  };
  screen('rgba(247, 189, 133, 0.95)', 6, 0.26, 1.0);
  screen('rgba(241, 80, 96, 0.55)', 6, -0.26, 0.55);
  return cv;
}

// ---------- the torn edge of a sheet ----------
function tearPath(w, seed) {
  const r = mulberry32(seed), pts = [];
  for (let x = -10, y = 0; x <= w + 10; x += 6 + r() * 10) { y = (vn2(x * 0.012 + seed, 1) - 0.5) * 26 + (r() - 0.5) * 6; pts.push([x, y]); }
  return pts;
}

export function createVoyage({
  container = document.body, onArrive = null, onReturn = null, onState = null, onFail = null, hooks = {},
  src = 'worlds/lounge.html', passageMs = 4200, liftMs = 1400, landMs = 1500, fadeMs = 1500,
  hideChrome = true, keepAlive = false, zIndex = 40, words = {}, log = null,
  offline = true      // serve the lounge's three r147 from web/worlds/vendor via a service worker scoped to worlds/
} = {}) {
  const W = { out: { ...WORDS.out, ...(words.out || {}) }, home: { ...WORDS.home, ...(words.home || {}) } };
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) { passageMs = Math.min(passageMs, 1600); liftMs = Math.min(liftMs, 600); }
  injectStyle();
  const swReady = offline ? registerOffline(src, log) : Promise.resolve(false);

  // ---------- DOM ----------
  const root = document.createElement('div'); root.className = 'agv-root'; root.style.zIndex = zIndex;
  const iframe = document.createElement('iframe'); iframe.className = 'agv-lounge'; iframe.title = 'The shadelings’ meadow';
  iframe.setAttribute('allow', 'fullscreen'); iframe.tabIndex = -1;
  const cv = document.createElement('canvas'); cv.className = 'agv-passage';
  const words$ = document.createElement('div'); words$.className = 'agv-words';
  words$.innerHTML = `<div class="agv-kicker"></div><div class="agv-title"><span class="agv-pink"></span><span class="agv-paper"></span></div><div class="agv-sub"></div>`;
  const wait$ = document.createElement('div'); wait$.className = 'agv-wait';
  root.append(iframe, cv, words$, wait$);
  container.appendChild(root);
  const $ = s => words$.querySelector(s);
  const driver = createLoungeDriver(iframe, { log });
  const g = cv.getContext('2d');

  // ---------- state ----------
  let state = 'earth', raf = 0, t0 = 0, run = null, w = 0, h = 0, dpr = 1;
  let night = null, sunset = null, tears = null, snap = null, moonFrom = null;
  function readMoon() {
    if (!hooks.moonScreen) return;
    try { const m = hooks.moonScreen(); if (m && isFinite(m.x) && isFinite(m.y) && m.r > 0) moonFrom = { x: m.x, y: m.y, r: m.r }; } catch (e) { /* keep the last */ }
  }
  let moonTex = null, moonPink = null, earthTex = null, earthPink = null;
  const stars = [];
  { const r = mulberry32(31); for (let i = 0; i < 340; i++) stars.push({ x: r(), y: r(), z: 0.25 + r() * 0.75, tw: r() * 6.28, pink: r() < 0.16, big: r() < 0.05 }); }

  function bodies() {
    if (!moonTex) { moonTex = paintBody(720, 'moon'); moonPink = plateOf(moonTex, INK.pink); }
    if (!earthTex) { earthTex = paintBody(720, 'earth'); earthPink = plateOf(earthTex, INK.pink); }
  }
  function resize() {
    dpr = Math.min(devicePixelRatio || 1, 1.5);
    w = root.clientWidth || innerWidth; h = root.clientHeight || innerHeight;
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    night = printNight(w, h, Math.min(dpr, 1.25)); sunset = printSunset(w, h, Math.min(dpr, 1.25)); tears = { a: tearPath(w, 3), b: tearPath(w, 9) };
  }
  const onResize = () => { if (state !== 'earth') resize(); };
  addEventListener('resize', onResize);
  // the lounge never keeps the keyboard: Space (talk) and the game's keys belong to this window
  function releaseFocus() {
    try { if (document.activeElement === iframe) { iframe.blur(); window.focus(); } } catch (e) { /* ignore */ }
  }

  // ---------- drawing ----------
  // the ink sheet: covers from the top down to y (screen px), torn edge with a pale fibrous core
  function sheet(y, pts) {
    if (y <= -30) return;
    g.save(); g.beginPath(); g.moveTo(-10, -10);
    for (const [x, dy] of pts) g.lineTo(x, y + dy);
    g.lineTo(w + 10, -10); g.closePath(); g.clip();
    g.drawImage(night, 0, 0, w, h);
    g.restore();
    // torn paper core: a thin wavering cream fibre line just under the ink
    g.save(); g.strokeStyle = 'rgba(243, 236, 220, 0.9)'; g.lineWidth = 2.2; g.beginPath();
    pts.forEach(([x, dy], i) => { const yy = y + dy + 1.6 + Math.sin(x * 0.7) * 0.6; i ? g.lineTo(x, yy) : g.moveTo(x, yy); }); g.stroke();
    g.strokeStyle = 'rgba(205, 192, 168, 0.6)'; g.lineWidth = 0.8; g.beginPath();
    pts.forEach(([x, dy], i) => { const yy = y + dy + 3.4; i ? g.lineTo(x, yy) : g.moveTo(x, yy); }); g.stroke();
    g.restore();
  }
  function drawStars(speed, dt, alpha) {
    const minD = Math.min(w, h);
    for (const s of stars) {
      s.y += speed * s.z * dt; s.y -= Math.floor(s.y); s.tw += dt * (1 + s.z);
      const x = s.x * w, y = s.y * h, rad = (s.big ? 2.4 : 0.7 + s.z * 1.3) * (0.85 + 0.15 * Math.sin(s.tw)) * Math.max(0.8, minD / 900);
      const streak = Math.min(h * 0.05, Math.abs(speed) * s.z * h * 0.022);
      g.globalAlpha = alpha * (0.55 + 0.45 * s.z);
      if (s.pink) { g.strokeStyle = g.fillStyle = INK.pink; dot(x + 1.8, y + 1.2, rad, streak, speed); }
      g.strokeStyle = g.fillStyle = INK.paper; dot(x, y, rad, streak, speed);
      if (s.big && streak < 2) { g.lineWidth = 0.9; g.beginPath(); g.moveTo(x - rad * 3, y); g.lineTo(x + rad * 3, y); g.moveTo(x, y - rad * 3); g.lineTo(x, y + rad * 3); g.stroke(); }
    }
    g.globalAlpha = 1;
  }
  function dot(x, y, r, streak, speed) {
    if (streak > 2) { g.lineWidth = r * 1.6; g.lineCap = 'round'; g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - Math.sign(speed) * streak); g.stroke(); }
    else { g.beginPath(); g.arc(x, y, r, 0, 6.283); g.fill(); }
  }
  // a painted body with its pink plate 'mis' px off register
  function body(tex, pink, cx, cy, r, mis, rot, alpha = 1) {
    const s = r / 0.94;   // the texture's disc fills 94% of it
    g.save(); g.globalAlpha = alpha; g.translate(cx, cy); g.rotate(rot);
    if (mis > 0.2) { g.globalAlpha = alpha * 0.9; g.drawImage(pink, -s + mis, -s + mis * 0.55, s * 2, s * 2); g.globalAlpha = alpha; }
    g.drawImage(tex, -s, -s, s * 2, s * 2);
    g.restore();
  }
  // the Earth: k = 1 a big painted globe filling the bottom of the frame with the coast's sunset glowing
  // behind it in halftone; k = 0 gone below the frame. Outbound it falls away, homebound it rises.
  function earth(k) {
    if (k <= 0) return;
    const minD = Math.min(w, h), R = Math.max(w * 0.62, minD * 0.95), cy = h + R * 0.62 + (1 - k) * (R * 0.5 + h * 0.5);
    const top = cy - R, sh = sunset.height / (sunset.width / w);
    g.save(); g.globalAlpha = Math.min(1, k * 1.6);
    g.drawImage(sunset, 0, h - sh * 0.92 + (1 - k) * sh, w, sh);
    g.restore();
    body(earthTex, earthPink, w * 0.5, cy, R, lerp(10, 0, k), -0.12);
  }
  function setWords(which, p, mis) {
    const T = W[which];
    const showTitle = p < 0.5 ? T.title : T.then;
    if ($('.agv-paper').textContent !== showTitle) { $('.agv-paper').textContent = showTitle; $('.agv-pink').textContent = showTitle; }
    $('.agv-kicker').textContent = T.kicker; $('.agv-sub').textContent = T.sub;
    // in at 0.1, swap at 0.5 (a dip), out at 0.86
    const a = ease((p - 0.15) / 0.12) * (1 - ease((p - 0.84) / 0.1)) * (p < 0.5 ? 1 - ease((p - 0.42) / 0.08) : ease((p - 0.5) / 0.08));
    words$.style.opacity = a.toFixed(3);
    words$.style.setProperty('--mis', mis.toFixed(2) + 'px');
    words$.style.setProperty('--rise', ((1 - a) * 10).toFixed(1) + 'px');
    $('.agv-kicker').style.opacity = $('.agv-sub').style.opacity = (p < 0.5 ? 1 : 0.0001) + '';
  }

  // one frame of the passage. dir 'out' (to the moon) or 'home'. p = passage progress 0..1 (may run past 1)
  function drawPassage(dir, p, dt, cover = 1, sheetY = h + 40, snapY = null) {
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    if (snap && snapY !== null) g.drawImage(snap, 0, snapY, w, h);
    const minD = Math.min(w, h);
    if (cover < 1) { sheet(sheetY, tears.a); }
    else g.drawImage(night, 0, 0, w, h);
    g.save();
    if (cover < 1) { g.beginPath(); g.moveTo(-10, -10); for (const [x, dy] of tears.a) g.lineTo(x, sheetY + dy); g.lineTo(w + 10, -10); g.closePath(); g.clip(); }
    if (dir === 'out') {
      const speed = reduce ? 0.02 : 1.3 * Math.pow(Math.max(0, 1 - p), 3.6) + 0.02;
      drawStars(speed, dt, 1);
      earth(1 - easeIn(p / 0.3));
      // the moon: from a far disc high left to filling the frame, its pink plate coming into register
      const k = easeOut(p * 0.92), zoom = p > 1 ? Math.pow(p - 1, 1.6) * 3.2 : 0;
      // starts exactly where the Earth's sky moon is on screen (hooks.moonScreen), so the sheet hands it over
      const f0 = moonFrom || { x: w * 0.3, y: h * 0.24, r: minD * 0.035 };
      const r = lerp(f0.r, minD * 0.33, k) * (1 + zoom);
      const cx = lerp(f0.x, w * 0.5, k), cy = lerp(f0.y, h * 0.42, k) + zoom * h * 0.06;
      const mis = lerp(9, 0, ease(p / 0.95));
      body(moonTex, moonPink, cx, cy, r, mis, lerp(-0.25, 0.05, k));
      setWords('out', Math.min(p, 0.999), mis * 0.7);
    } else {
      const speed = reduce ? -0.02 : -(1.3 * Math.pow(Math.max(0, Math.min(1, p)), 3.6) + 0.02);
      drawStars(speed, dt, 1);
      // the moon falls behind (shrinks up and away), Earth's limb rises at the bottom, then a big Earth
      const k = easeOut(Math.min(1, p) * 0.95);
      const r = lerp(minD * 0.33, minD * 0.035, k);
      body(moonTex, moonPink, lerp(w * 0.5, w * 0.72, k), lerp(h * 0.42, h * 0.18, k), r, lerp(0, 6, k), 0.05);
      earth(easeOut((p - 0.22) / 0.78));
      setWords('home', Math.min(p, 0.999), lerp(7, 0, ease(p)));
    }
    g.restore();
  }

  function startLoop(fn) {
    cancelAnimationFrame(raf);
    let last = performance.now();
    const tick = now => { const dt = Math.min(0.05, (now - last) / 1000); last = now; if (fn(now - t0, dt) !== false) raf = requestAnimationFrame(tick); };
    t0 = performance.now(); raf = requestAnimationFrame(tick);
  }
  function setState(s) { state = s; root.dataset.state = s; if (log) log('voyage:', s); try { onState && onState(s); } catch (e) { console.error(e); } }
  function preload() {
    if (!iframe.getAttribute('src') || iframe.getAttribute('src') === 'about:blank') {
      iframe.setAttribute('src', 'about:blank');   // claimed: a second call won't double-load
      swReady.then(() => { iframe.src = src; });
    }
    return driver.ready(45000);
  }
  function grabSnapshot(s) {
    if (!s) return null;
    const c = document.createElement('canvas'); c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
    const cg = c.getContext('2d');
    const draw = img => { try { const iw = img.naturalWidth || img.videoWidth || img.width, ih = img.naturalHeight || img.videoHeight || img.height; const sc = Math.max(c.width / iw, c.height / ih); cg.drawImage(img, (c.width - iw * sc) / 2, (c.height - ih * sc) / 2, iw * sc, ih * sc); } catch (e) { /* tainted or blank */ } };
    if (typeof s === 'string') { const im = new Image(); im.onload = () => draw(im); im.src = s; } else draw(s);
    return c;
  }

  // ---------- depart ----------
  let pending = null, skip = false;
  function depart(snapshot = null) {
    if (state !== 'earth') return pending || Promise.resolve(driver);
    resize(); bodies(); skip = false; moonFrom = null; readMoon();
    snap = grabSnapshot(snapshot);
    setState('departing');
    root.classList.add('agv-on'); cv.style.opacity = '1'; cv.style.transition = 'none';
    let readyAt = 0, failed = null;
    preload().then(() => { readyAt = performance.now(); }, e => { failed = e; if (log) log('lounge failed', e.message); });
    try { hooks.liftOff && hooks.liftOff(liftMs); } catch (e) { console.error(e); }
    pending = new Promise(resolve => {
      let fadeStart = 0;
      startLoop((t, dt) => {
        // lift: the sheet of night comes down over the Earth as the camera tips up
        const lift = Math.min(1, t / liftMs), sk = easeIn((lift - 0.25) / 0.75);
        if (lift < 1) readMoon();
        const sheetY = lerp(-40, h + 40, sk);
        const snapY = snap ? easeIn(lift) * h * 0.45 : null;
        let p = Math.max(0, (t - liftMs) / passageMs);
        if (skip && p < 1) { p = 1; }
        if (state === 'departing' && lift >= 1) setState('passage');
        // hold at the end of the passage until the meadow is ready (+ its own 1.4 s fade-in)
        const ok = readyAt && performance.now() - readyAt > 1400;
        // the meadow never came (no WebGL, or 45 s without it): don't fade into a blank frame, fly home
        if (failed && p >= 1 && !fadeStart) {
          wait$.textContent = W.out.failed; wait$.style.opacity = '1';
          setState('returning');
          iframe.classList.remove('agv-in');
          if (!keepAlive) { iframe.src = 'about:blank'; iframe.removeAttribute('src'); }
          homeward(() => { wait$.style.opacity = '0'; try { onFail && onFail(failed); } catch (e) { console.error(e); } resolve(null); }, 900);
          return false;
        }
        if (p >= 1 && !ok) { p = 1 + Math.min(0.02, (t - liftMs - passageMs) / 60000); wait$.textContent = W.out.wait; wait$.style.opacity = t - liftMs - passageMs > 900 ? '1' : '0'; }
        if (p >= 1 && ok && !fadeStart) {
          fadeStart = performance.now(); wait$.style.opacity = '0';
          setState('arriving');
          iframe.classList.add('agv-in');
          if (hideChrome) driver.hideOwnChrome(true);
          cv.style.transition = `opacity ${fadeMs}ms ease`; cv.style.opacity = '0';
        }
        const pf = fadeStart ? 1 + (performance.now() - fadeStart) / fadeMs * 0.5 : p;
        drawPassage('out', pf, dt, sk >= 1 ? 1 : 0.5, sheetY, snapY);
        if (fadeStart && performance.now() - fadeStart > fadeMs + 50) {
          setState('moon'); words$.style.opacity = '0'; root.classList.add('agv-moon');
          snap = null;
          try { onArrive && onArrive(driver); } catch (e) { console.error(e); }
          resolve(driver); pending = null;
          return false;
        }
      });
    });
    return pending;
  }

  // ---------- arrive: cut the passage short, or jump straight to the moon ----------
  function arrive() {
    if (state === 'departing' || state === 'passage') { skip = true; return pending; }
    if (state !== 'earth') return pending || Promise.resolve(driver);
    resize(); setState('arriving'); root.classList.add('agv-on');
    cv.style.transition = 'none'; cv.style.opacity = '0'; words$.style.opacity = '0';
    pending = preload().then(async () => {
      if (hideChrome) await driver.hideOwnChrome(true);
      iframe.classList.add('agv-in');
      await new Promise(r => setTimeout(r, 900));
      setState('moon'); root.classList.add('agv-moon');
      try { onArrive && onArrive(driver); } catch (e) { console.error(e); }
      pending = null; return driver;
    });
    return pending;
  }

  // ---------- return home ----------
  function returnHome() {
    if (state === 'earth') return Promise.resolve();
    if (state !== 'moon') return (pending || Promise.resolve()).then(() => returnHome());
    resize(); bodies(); snap = null;
    setState('returning'); root.classList.remove('agv-moon');
    cv.style.transition = `opacity ${fadeMs * 0.7}ms ease`;
    releaseFocus();
    requestAnimationFrame(() => { cv.style.opacity = '1'; iframe.classList.remove('agv-in'); releaseFocus(); });
    pending = new Promise(resolve => homeward(resolve));
    return pending;
  }
  // the homeward passage (moon recedes, Earth rises, the sheet lifts) -> state 'earth', onReturn, done()
  function homeward(done, delayMs = 0) {
    let landed = false;
    const total = passageMs * 0.9, liftOffMs = landMs;
    startLoop((t, dt) => {
      t -= delayMs; if (t < 0) { drawPassage('out', 1, dt, 1, h + 40, null); return; }
      const p = Math.min(1, t / total);
      const lt = Math.max(0, t - total) / liftOffMs;           // the sheet lifts up off the Earth
      if (lt > 0 && !landed) {
        landed = true;
        try { hooks.land && hooks.land(landMs); } catch (e) { console.error(e); }
      }
      const sk = easeIn(1 - Math.min(1, lt));
      drawPassage('home', p, dt, lt > 0 ? 0.5 : 1, lerp(-40, h + 40, sk), null);
      if (lt >= 1) {
        g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cv.width, cv.height);
        words$.style.opacity = '0';
        setState('earth'); root.classList.remove('agv-on');
        releaseFocus();
        if (!keepAlive) { iframe.src = 'about:blank'; iframe.removeAttribute('src'); }
        try { onReturn && onReturn(); } catch (e) { console.error(e); }
        pending = null; done();
        return false;
      }
    });
  }

  // test / lab hook: paint one frozen passage frame (dir 'out'|'home', p 0..1, lift 0..1 for the sheet)
  function still(dir = 'out', p = 0.5, lift = 1) {
    resize(); bodies(); root.classList.add('agv-on'); cv.style.transition = 'none'; cv.style.opacity = '1';
    const sk = easeIn((lift - 0.25) / 0.75);
    drawPassage(dir, p, 0, lift >= 1 ? 1 : 0.5, lerp(-40, h + 40, sk), null);
  }

  return {
    depart, arrive, returnHome, preload, driver, still, el: root, iframe,
    get state() { return state; },
    dispose() { cancelAnimationFrame(raf); removeEventListener('resize', onResize); releaseFocus(); root.remove(); }
  };
}

// The lounge loads three r147 from jsDelivr. A service worker scoped to the lounge's folder answers those
// requests from byte-identical local copies (web/worlds/lounge-sw.js), so no internet is needed on stage.
// Resolves once it is active (or false after 2.5 s / when unsupported, and the CDN is used as written).
function registerOffline(src, log) {
  if (!('serviceWorker' in navigator) || !window.isSecureContext) return Promise.resolve(false);
  const page = new URL(src, location.href), sw = new URL('lounge-sw.js', page), scope = new URL('./', page);
  const reg = navigator.serviceWorker.register(sw.href, { scope: scope.href }).then(r => new Promise(res => {
    const w = r.installing || r.waiting || r.active;
    if (!w || w.state === 'activated') return res(true);
    w.addEventListener('statechange', () => { if (w.state === 'activated') res(true); });
  })).catch(e => { if (log) log('offline worker unavailable:', e.message); return false; });
  return Promise.race([reg, new Promise(r => setTimeout(() => r(false), 2500))]);
}

function injectStyle() {
  if (document.getElementById('agv-style')) return;
  const s = document.createElement('style'); s.id = 'agv-style';
  s.textContent = `
  .agv-root { position: fixed; inset: 0; pointer-events: none; visibility: hidden; }
  .agv-root.agv-on { visibility: visible; }
  .agv-lounge { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; background: #2e3a60;
    opacity: 0; transform: scale(1.035); transition: opacity 1.5s ease, transform 2.4s cubic-bezier(.2,.7,.2,1); pointer-events: none; }
  .agv-lounge.agv-in { opacity: 1; transform: none; }
  .agv-root.agv-moon .agv-lounge { pointer-events: auto; }
  .agv-passage { position: absolute; inset: 0; width: 100%; height: 100%; display: block; pointer-events: none; }
  .agv-words { position: absolute; left: 0; right: 0; bottom: 8.5vh; text-align: center; opacity: 0; pointer-events: none;
    font-family: "Instrument Serif", "Iowan Old Style", Georgia, serif; color: #f3ecdc; transform: translateY(var(--rise, 0px)); --mis: 4px; }
  .agv-kicker { font-size: clamp(14px, 1.5vw, 19px); letter-spacing: .16em; text-transform: uppercase; opacity: .9; margin-bottom: .4em; transition: opacity .4s; }
  .agv-title { position: relative; display: inline-block; font-style: italic; font-size: clamp(56px, 8.4vw, 132px); line-height: 1; letter-spacing: -0.01em; }
  .agv-title .agv-paper { position: relative; color: #f3ecdc; }
  .agv-title .agv-pink { position: absolute; left: 0; top: 0; color: #f15060; transform: translate(var(--mis), calc(var(--mis) * .6)); opacity: .92; white-space: nowrap; }
  .agv-sub { font-style: italic; font-size: clamp(16px, 1.7vw, 22px); opacity: .85; margin-top: .55em; transition: opacity .4s; }
  .agv-wait { position: absolute; left: 0; right: 0; bottom: 9vh; text-align: center; font-family: "Instrument Serif", Georgia, serif; font-style: italic; font-size: 19px; color: #f3ecdc; opacity: 0; transition: opacity .6s; pointer-events: none; }
  @media (prefers-reduced-motion: reduce) { .agv-lounge { transition: opacity .6s; transform: none; } }
  `;
  document.head.appendChild(s);
}
