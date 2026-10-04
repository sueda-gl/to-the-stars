// The waiting screen (Sueda 14:45 / 15:00): while the world loads, hand-drawn MARKER doodles of the creatures and the
// world flip by on a paper disc (black ink outline, scribbled marker fill with paper showing through, dot eyes, blush,
// little stick arms); a ring around the disc fills 0-100 %, on a dark starfield. A classic script: draws from frame one.
//   window.__bootProgress(p)   p in 0..1 (the ring eases toward it and creeps on between milestones)
//   window.__bootDone()        fills it
(function () {
  const boot = document.getElementById('boot');
  if (!boot) return;
  boot.textContent = '';
  boot.classList.add('ag-loader');
  const sky = document.createElement('canvas'); sky.className = 'ag-loader__sky';
  const disc = document.createElement('canvas'); disc.className = 'ag-loader__disc';
  const cap = document.createElement('div'); cap.className = 'ag-loader__cap';
  const wrap = document.createElement('div'); wrap.className = 'ag-loader__wrap'; wrap.append(disc, cap);
  boot.append(sky, wrap);
  const css = document.createElement('style');
  css.textContent = `
  .ag-loader { background: radial-gradient(120% 90% at 50% 40%, #121534 0%, #070815 60%, #03040a 100%) !important; }
  .ag-loader__sky { position: fixed !important; inset: 0; width: 100% !important; height: 100% !important; }
  .ag-loader__wrap { position: relative; display: grid; justify-items: center; gap: 18px; }
  .ag-loader__disc { position: relative !important; left: auto !important; top: auto !important; display: block; width: min(380px, 78vw) !important; height: min(380px, 78vw) !important; }
  .ag-loader__cap { font: 600 14px/1.2 Montserrat, system-ui, sans-serif; letter-spacing: .16em; text-transform: uppercase; color: #f6edd8; opacity: .88; min-height: 1.2em; }`;
  document.head.append(css);

  // ---------- the sky ----------
  const sx = sky.getContext('2d'); let W = 0, H = 0, stars = [], D = 1, S = 380;
  function size() {
    D = Math.min(devicePixelRatio || 1, 2); W = sky.width = innerWidth * D; H = sky.height = innerHeight * D;
    S = Math.round(Math.min(380, innerWidth * .78)); disc.width = disc.height = Math.round(S * D);
    stars = Array.from({ length: Math.round(W * H / 5200) }, () => ({ x: Math.random() * W, y: Math.random() * H, r: Math.random() * 1.3 * D + .3, p: Math.random() * 6.3, s: .6 + Math.random() * 2.2 }));
  }
  size(); addEventListener('resize', size);

  // ---------- marker drawing kit (a 300 x 300 doodle space) ----------
  const g = disc.getContext('2d');
  const INK = '#fbf2dc', FACE = '#1d1b26';
  let inkU = 1;   // the line draws itself on (0..1)
  let seed = 1; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  // the scribble fill: diagonal marker strokes clipped to the shape, paper showing through between them
  function marker(path, col, { angle = -0.6, gap = 7.2, w = 7, reveal = 1, light = false } = {}) {
    g.save(); g.clip(path);
    // the colour laid down first (on the night sky the gaps would show the dark), then the marker's own strokes
    g.globalAlpha = Math.min(1, reveal * 1.3); g.fillStyle = col; g.fill(path);
    g.strokeStyle = tint(col); g.lineCap = 'round'; g.globalAlpha = .55;
    const ca = Math.cos(angle), sa = Math.sin(angle);
    const n = Math.ceil(460 / gap), shown = Math.floor(n * Math.min(1, reveal));
    g.lineJoin = 'round'; g.lineWidth = w;
    g.beginPath();
    for (let i = 0; i < shown; i++) {   // one back-and-forth zig-zag, as a hand colours in
      const o = -230 + i * gap + (rnd() - .5) * 3, dir = i % 2 ? 1 : -1, wob = (rnd() - .5) * 10;
      const x0 = 150 - sa * o - ca * 240 * dir + wob, y0 = 150 + ca * o - sa * 240 * dir;
      const x1 = 150 - sa * o + ca * 240 * dir, y1 = 150 + ca * o + sa * 240 * dir + wob;
      if (i === 0) g.moveTo(x0, y0); else g.lineTo(x0, y0);
      g.lineTo(x1, y1);
    }
    g.stroke();
    g.globalAlpha = .18; g.strokeStyle = shade(col); g.lineWidth = w * .8;   // the darker overlaps a marker leaves
    for (let i = 0; i < shown; i += 3) { const o = -230 + i * gap + 3; g.beginPath(); g.moveTo(150 - sa * o - ca * 240, 150 + ca * o - sa * 240); g.lineTo(150 - sa * o + ca * 240, 150 + ca * o + sa * 240); g.stroke(); }
    if (light) {   // paper glints where the pen skipped
      g.globalAlpha = .55; g.strokeStyle = '#fffaf0'; g.lineWidth = 3;
      for (let k = 0; k < 5; k++) { const x = 90 + rnd() * 120, y = 90 + rnd() * 120; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 14 * ca, y + 14 * sa); g.stroke(); }
    }
    g.restore();
  }
  const hex = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
  const tint = c => { const [r, g2, b] = hex(c); return `rgb(${Math.round(r + (255 - r) * .35)},${Math.round(g2 + (255 - g2) * .35)},${Math.round(b + (255 - b) * .35)})`; };
  const shade = c => { const [r, g2, b] = hex(c); return `rgb(${Math.round(r * .72)},${Math.round(g2 * .72)},${Math.round(b * .72)})`; };
  function ink(path, w = 3.6) {
    for (let pass = 0; pass < 2; pass++) {
      g.save(); g.strokeStyle = INK; g.globalAlpha = pass ? .55 : 1; g.lineWidth = pass ? w * .55 : w; g.lineJoin = 'round'; g.lineCap = 'round';
      g.translate((rnd() - .5) * 1.8, (rnd() - .5) * 1.8); g.setLineDash([1600, 1600]); g.lineDashOffset = 1600 * (1 - inkU);
      g.shadowColor = 'rgba(255, 240, 200, .35)'; g.shadowBlur = pass ? 0 : 6;
      g.stroke(path); g.restore();
    }
  }
  function stroke(fn, w = 3.2, col = INK) { if (inkU < .2) return; g.save(); g.strokeStyle = col; g.lineWidth = w; g.lineJoin = 'round'; g.lineCap = 'round'; g.setLineDash([600, 600]); g.lineDashOffset = 600 * (1 - Math.min(1, inkU * 1.2)); g.translate((rnd() - .5) * 1.2, (rnd() - .5) * 1.2); g.beginPath(); fn(); g.stroke(); g.restore(); }
  function dot(x, y, r = 4.2, c = INK) { g.save(); g.fillStyle = c; g.beginPath(); g.arc(x, y, r, 0, 6.3); g.fill(); g.restore(); }
  function face(x, y, d = 15, s = 1) {
    if (inkU < .6) return;
    dot(x - d * s, y, 4 * s, FACE); dot(x + d * s, y, 4 * s, FACE);
    g.save(); g.fillStyle = '#fffaf0'; g.beginPath(); g.arc(x - d * s + 1.3 * s, y - 1.3 * s, 1.2 * s, 0, 6.3); g.arc(x + d * s + 1.3 * s, y - 1.3 * s, 1.2 * s, 0, 6.3); g.fill(); g.restore();
    stroke(() => { g.arc(x, y + 8 * s, 6 * s, .35, Math.PI - .35); }, 2.6 * s, FACE);
    g.save(); g.fillStyle = 'rgba(232, 92, 120, .55)'; g.beginPath(); g.ellipse(x - (d + 13) * s, y + 9 * s, 6.5 * s, 4 * s, 0, 0, 6.3); g.ellipse(x + (d + 13) * s, y + 9 * s, 6.5 * s, 4 * s, 0, 0, 6.3); g.fill(); g.restore();
  }
  function flower(x, y, col = '#d83fa8') {
    stroke(() => { g.moveTo(x, y + 6); g.quadraticCurveTo(x - 2, y + 26, x - 4, y + 44); }, 2.4);
    stroke(() => { g.moveTo(x - 2, y + 26); g.quadraticCurveTo(x + 10, y + 18, x + 14, y + 24); g.quadraticCurveTo(x + 6, y + 30, x - 2, y + 26); }, 2);
    for (let k = 0; k < 5; k++) { const a = k * 1.2566, p = new Path2D(); p.ellipse(x + Math.cos(a) * 7, y + Math.sin(a) * 7, 5.5, 5.5, 0, 0, 6.3); g.save(); g.fillStyle = col; g.globalAlpha = .9; g.fill(p); g.restore(); ink(p, 2); }
    dot(x, y, 3.6, '#ffd21a'); g.save(); g.strokeStyle = INK; g.lineWidth = 1.6; g.beginPath(); g.arc(x, y, 3.6, 0, 6.3); g.stroke(); g.restore();
  }
  function armTo(x0, y0, x1, y1, bend = 10) { stroke(() => { g.moveTo(x0, y0); g.quadraticCurveTo((x0 + x1) / 2, (y0 + y1) / 2 - bend, x1, y1); }, 3); dot(x1, y1, 4.4); }
  const star = (cx, cy, R, r) => { const p = new Path2D(), pts = []; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, k = i % 2 ? r : R; pts.push([cx + Math.cos(a) * k, cy + Math.sin(a) * k]); }
    for (let i = 0; i <= 10; i++) { const a = pts[i % 10], b = pts[(i + 1) % 10], m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; if (i === 0) p.moveTo(m[0], m[1]); else p.quadraticCurveTo(a[0], a[1], m[0], m[1]); }
    p.closePath(); return p; };
  const ellP = (x, y, rx, ry, rot = 0) => { const p = new Path2D(); p.ellipse(x, y, rx, ry, rot, 0, 6.3); return p; };
  const rr = (x, y, w, h, r) => { const p = new Path2D(); p.roundRect(x, y, w, h, r); return p; };
  const flat = { light: false };

  // each doodle: (reveal 0..1) => draw; the colour is scribbled in first, then the ink line and the face
  const DOODLES = [
    ['a twinkle', u => { const p = star(150, 158, 98, 46); marker(p, '#f39a2b', { reveal: u }); if (u > .3) { ink(p); face(150, 150, 16); armTo(70, 190, 48, 214); armTo(226, 186, 252, 160); flower(256, 132); } }],
    ['a flit', u => { const p = ellP(150, 168, 70, 64); marker(p, '#7cc95a', { reveal: u }); if (u > .3) { ink(p); stroke(() => { g.moveTo(150, 104); g.lineTo(150, 74); }); const blade = ellP(150, 72, 56, 9); marker(blade, '#ee3d84', { angle: 0, gap: 6, w: 6, ...flat }); ink(blade, 3); dot(150, 72, 5); const cap = ellP(150, 104, 30, 10); marker(cap, '#2f62d8', { angle: .5, gap: 6, w: 6, ...flat }); ink(cap, 3); face(150, 162, 18); stroke(() => { g.moveTo(124, 228); g.lineTo(118, 250); }); stroke(() => { g.moveTo(176, 228); g.lineTo(182, 250); }); } }],
    ['a floatie', u => { const um = new Path2D(); um.moveTo(56, 128); um.quadraticCurveTo(150, 22, 244, 128); um.quadraticCurveTo(150, 112, 56, 128); marker(um, '#ee3d84', { reveal: u, angle: 0.2 }); if (u > .3) { ink(um); for (const x of [96, 123, 150, 177, 204]) stroke(() => { g.moveTo(150, 52); g.lineTo(x, 122); }, 2.2); stroke(() => { g.moveTo(150, 120); g.lineTo(150, 156); }); const body = ellP(150, 200, 48, 46); marker(body, '#fff3e0', { angle: -.3, ...flat }); const st = rr(104, 206, 92, 12, 6); marker(st, '#2f62d8', { angle: 0, gap: 5, w: 5, ...flat }); ink(body); face(150, 192, 14, .9); } }],
    ['a moth', u => { const w1 = ellP(96, 140, 60, 38, -.5), w2 = ellP(204, 140, 60, 38, .5), h1 = ellP(108, 196, 36, 24, .4), h2 = ellP(192, 196, 36, 24, -.4); [w1, w2].forEach(p => marker(p, '#7fb8f2', { reveal: u })); [h1, h2].forEach(p => marker(p, '#f58fb3', { reveal: u })); if (u > .3) { [w1, w2, h1, h2].forEach(p => ink(p)); const b = ellP(150, 172, 36, 54); marker(b, '#e8c59a', { angle: -1, ...flat }); ink(b); face(150, 160, 11, .85); stroke(() => { g.moveTo(138, 122); g.quadraticCurveTo(122, 96, 110, 90); }); stroke(() => { g.moveTo(162, 122); g.quadraticCurveTo(178, 96, 190, 90); }); dot(110, 90, 5); dot(190, 90, 5); } }],
    ['a loaf', u => { const p = rr(84, 102, 132, 132, 42); marker(p, '#4fc1b0', { reveal: u }); if (u > .3) { ink(p); face(150, 160, 20); const bow = new Path2D(); bow.moveTo(150, 214); bow.lineTo(122, 200); bow.lineTo(122, 228); bow.closePath(); bow.moveTo(150, 214); bow.lineTo(178, 200); bow.lineTo(178, 228); bow.closePath(); marker(bow, '#2f62d8', { angle: 0, gap: 5, w: 5, ...flat }); ink(bow, 2.6); stroke(() => { g.moveTo(110, 234); g.lineTo(106, 254); }); stroke(() => { g.moveTo(190, 234); g.lineTo(194, 254); }); } }],
    ['a glim', u => { const p = new Path2D(); p.moveTo(100, 100); p.bezierCurveTo(70, 160, 80, 220, 110, 236); p.lineTo(190, 236); p.bezierCurveTo(220, 220, 230, 160, 200, 100); p.closePath(); marker(p, '#ffc27a', { reveal: u }); if (u > .3) { ink(p); for (const dx of [-26, 0, 26]) stroke(() => { g.moveTo(150 + dx, 102); g.quadraticCurveTo(150 + dx * 1.4, 168, 150 + dx, 234); }, 2); [rr(96, 88, 108, 16, 8), rr(102, 230, 96, 16, 8)].forEach(q => { marker(q, '#7a3d8c', { angle: 0, gap: 5, w: 5, ...flat }); ink(q, 3); }); stroke(() => { g.moveTo(124, 88); g.quadraticCurveTo(150, 52, 176, 88); }); face(150, 160, 17); } }],
    ['your planet', u => { const p = ellP(150, 172, 92, 92); marker(p, '#3f7fd0', { reveal: u, angle: -.4 }); if (u > .3) { g.save(); g.clip(p); [ellP(122, 140, 66, 38, -.3), ellP(204, 214, 38, 22, .4)].forEach(q => { marker(q, '#f2cf7d', { angle: .4, gap: 6, w: 7, ...flat }); ink(q, 2.6); }); g.restore(); ink(p); const t = rr(138, 48, 24, 40, 4); marker(t, '#f6efe0', { angle: 0, gap: 5, w: 5, ...flat }); ink(t, 3); stroke(() => { g.arc(150, 62, 6, Math.PI, 0); }, 2.4); stroke(() => { g.moveTo(130, 90); g.lineTo(170, 90); }); } }],
    ['the ship', u => { const p = new Path2D(); p.moveTo(150, 34); p.quadraticCurveTo(196, 140, 192, 212); p.lineTo(108, 212); p.quadraticCurveTo(104, 140, 150, 34); p.closePath(); marker(p, '#d9e2f6', { reveal: u, angle: -1.2 }); if (u > .3) { const win = ellP(150, 116, 15, 30); marker(win, '#5fc3d6', { angle: 0, gap: 5, w: 5, ...flat }); ink(win, 3); ink(p); stroke(() => { g.moveTo(112, 196); g.lineTo(88, 240); }); stroke(() => { g.moveTo(188, 196); g.lineTo(212, 240); }); const fl = new Path2D(); fl.moveTo(126, 214); fl.quadraticCurveTo(150, 290, 174, 214); fl.closePath(); marker(fl, '#ffb02e', { angle: 1.3, gap: 5, w: 6, ...flat }); ink(fl, 2.8); } }],
    ['a windmill', u => { const p = new Path2D(); p.moveTo(118, 246); p.lineTo(130, 126); p.lineTo(170, 126); p.lineTo(182, 246); p.closePath(); marker(p, '#f4c58a', { reveal: u }); if (u > .3) { ink(p); const roof = new Path2D(); roof.moveTo(122, 128); roof.lineTo(150, 92); roof.lineTo(178, 128); roof.closePath(); marker(roof, '#ff7a59', { angle: .3, gap: 6, w: 6, ...flat }); ink(roof, 3); const a0 = performance.now() / 700; for (let k = 0; k < 4; k++) { g.save(); g.translate(150, 116); g.rotate(a0 + k * Math.PI / 2); const bl = rr(6, -9, 74, 18, 4); g.fillStyle = '#fffaf0'; g.fill(bl); ink(bl, 2.6); g.restore(); } dot(150, 116, 6); stroke(() => { g.arc(150, 246, 13, Math.PI, 0); }); } }],
    ['a giant duck', u => { const b = ellP(146, 196, 92, 46), h = ellP(196, 128, 40, 40); marker(b, '#ffd21a', { reveal: u }); marker(h, '#ffd21a', { reveal: u }); if (u > .3) { ink(b); ink(h); const bk = new Path2D(); bk.moveTo(230, 128); bk.quadraticCurveTo(268, 132, 234, 146); bk.closePath(); marker(bk, '#ff7a59', { angle: 0, gap: 5, w: 5, ...flat }); ink(bk, 3); dot(206, 120, 4.6); stroke(() => { g.moveTo(92, 190); g.quadraticCurveTo(120, 168, 148, 196); }); g.save(); g.strokeStyle = '#5fc3d6'; g.lineWidth = 3; g.lineCap = 'round'; g.beginPath(); g.moveTo(50, 248); g.quadraticCurveTo(80, 238, 110, 248); g.quadraticCurveTo(140, 258, 170, 248); g.quadraticCurveTo(200, 238, 230, 248); g.stroke(); g.restore(); } }]
  ];
  const VERBS = ['doodling', 'colouring in', 'sketching', 'drawing', 'waking up'];
  // 15:45 (Sueda): our own creatures, not doodles: painted portraits rendered from the game (assets/loader/*.png)
  const CREATURES = [['flit', 'a flit'], ['floatie', 'a floatie'], ['loaf', 'a loaf'], ['twinkle', 'a twinkle'], ['glim', 'a glim'], ['moth', 'a moth']]
    .map(([k, label]) => { const im = new Image(); im.src = new URL('../../assets/loader/' + k + '.png', document.currentScript ? document.currentScript.src : location.href).href; return { im, label }; });
  const HELLO = ['waking up', 'meet', 'say hi to', 'here comes', 'painting'];

  let idx = 0, shownAt = performance.now(), verb = 0;
  const DWELL = 1100;
  function drawDisc(now, pct) {
    const k = disc.width / 380;   // laid out in a 380 x 380 space
    g.setTransform(k, 0, 0, k, 0, 0); g.clearRect(0, 0, 380, 380);
    // the progress ring round the disc: a faint track, then lemon with an ink edge and the pink print offset
    const cx = 190, cy = 190, R = 172, a0 = -Math.PI / 2, a1 = a0 + Math.PI * 2 * pct;
    g.lineCap = 'round';
    g.strokeStyle = 'rgba(246, 237, 216, .12)'; g.lineWidth = 10; g.beginPath(); g.arc(cx, cy, R, 0, 6.3); g.stroke();
    if (pct > 0.004) {
      g.strokeStyle = '#ee3d84'; g.lineWidth = 15; g.beginPath(); g.arc(cx + 3, cy + 4, R, a0, a1); g.stroke();
      g.strokeStyle = '#f6edd8'; g.lineWidth = 17; g.beginPath(); g.arc(cx, cy, R, a0, a1); g.stroke();
      g.strokeStyle = '#ffd21a'; g.lineWidth = 11; g.beginPath(); g.arc(cx, cy, R, a0, a1); g.stroke();
    }
    g.save(); g.fillStyle = '#fbf2dc'; g.font = '700 16px Montserrat, system-ui, sans-serif'; g.textAlign = 'center'; g.globalAlpha = .9; g.fillText(Math.round(pct * 100) + '%', cx, cy + 150); g.restore();
    // one of our creatures pops in, bobs and sways inside the ring
    const c = CREATURES[idx % CREATURES.length], age = now - shownAt;
    const t = Math.min(1, age / 420), pop = t < 1 ? 1 - Math.pow(1 - t, 3) * Math.cos(t * 9) * .9 : 1;
    g.save();
    g.beginPath(); g.arc(cx, cy, 158, 0, 6.3); g.clip();
    const glow = g.createRadialGradient(cx, cy, 10, cx, cy, 158); glow.addColorStop(0, 'rgba(255, 226, 58, .16)'); glow.addColorStop(1, 'rgba(255, 226, 58, 0)');
    g.fillStyle = glow; g.fillRect(cx - 160, cy - 160, 320, 320);
    if (c.im.complete && c.im.naturalWidth) {
      const sz = 214 * Math.max(.05, pop);
      g.translate(cx, cy + Math.sin(now / 360) * 5); g.rotate(Math.sin(now / 800) * .06);
      g.drawImage(c.im, -sz / 2, -sz / 2, sz, sz);
    }
    g.restore();
  }

  // ---------- progress ----------
  let target = 0.04, shown = 0, done = false;
  window.__bootProgress = p => { target = Math.max(target, Math.min(1, p)); };
  window.__bootDone = () => { done = true; target = 1; };
  let raf = 0;
  function frame(now) {
    if (!document.body.contains(boot)) { cancelAnimationFrame(raf); return; }
    sx.clearRect(0, 0, W, H);
    for (const st of stars) { sx.globalAlpha = .35 + .65 * (0.5 + 0.5 * Math.sin(now / 1000 * st.s + st.p)); sx.fillStyle = '#fff6e6'; sx.beginPath(); sx.arc(st.x, st.y, st.r, 0, 6.3); sx.fill(); }
    sx.globalAlpha = 1;
    if (now - shownAt > DWELL) { idx = (idx + 1) % CREATURES.length; shownAt = now; verb = (verb + 1) % HELLO.length; }
    if (!done) target = Math.min(0.96, target + 0.00035);
    shown += (target - shown) * (done ? 0.25 : 0.06);
    drawDisc(now, Math.min(1, shown));
    cap.textContent = `${HELLO[verb]} ${CREATURES[idx % CREATURES.length].label}…`;
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);
})();
