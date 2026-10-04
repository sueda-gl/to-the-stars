// The waiting screen (Sueda 14:45): while the world loads, quick pencil sketches of the creatures and the world flip by
// on a dark starfield, with a 0-100 bar. A classic script (no modules), so it draws from the very first frame.
//   window.__bootProgress(p, label?)   p in 0..1, the bar eases toward it and creeps on its own between milestones
//   window.__bootDone()                fills the bar to 100
(function () {
  const boot = document.getElementById('boot');
  if (!boot) return;
  boot.textContent = '';
  boot.classList.add('ag-loader');
  const cv = document.createElement('canvas'); cv.className = 'ag-loader__sky';
  const stage = document.createElement('canvas'); stage.className = 'ag-loader__sketch';
  const cap = document.createElement('div'); cap.className = 'ag-loader__cap';
  const bar = document.createElement('div'); bar.className = 'ag-loader__bar';
  const fill = document.createElement('i'); const num = document.createElement('b');
  bar.append(fill); const row = document.createElement('div'); row.className = 'ag-loader__row'; row.append(bar, num);
  const wrap = document.createElement('div'); wrap.className = 'ag-loader__wrap'; wrap.append(stage, cap, row);
  boot.append(cv, wrap);

  const css = document.createElement('style');
  css.textContent = `
  .ag-loader { background: radial-gradient(120% 90% at 50% 40%, #121534 0%, #070815 60%, #03040a 100%) !important; }
  .ag-loader__sky { position: absolute; inset: 0; width: 100%; height: 100%; }
  .ag-loader__wrap { position: relative; display: grid; justify-items: center; gap: 14px; }
  .ag-loader__sketch { position: relative !important; left: auto !important; top: auto !important; display: block; width: min(300px, 62vw) !important; height: min(300px, 62vw) !important; }
  .ag-loader__cap { font: 600 15px/1.2 Montserrat, system-ui, sans-serif; letter-spacing: .14em; text-transform: uppercase; color: #f6edd8; opacity: .9; min-height: 1.2em; }
  .ag-loader__row { display: flex; align-items: center; gap: 12px; }
  .ag-loader__bar { width: min(320px, 64vw); height: 14px; border-radius: 99px; background: #1b1e3d; box-shadow: 0 0 0 2.5px #f6edd8, 4px 5px 0 2.5px #ee3d84; overflow: hidden; }
  .ag-loader__bar i { display: block; height: 100%; width: 0%; background: repeating-linear-gradient(-45deg, #ffe23a 0 10px, #ffd21a 10px 20px); border-radius: 99px; }
  .ag-loader__row b { font: 700 15px Montserrat, system-ui, sans-serif; color: #ffe23a; min-width: 3.2em; text-align: right; font-variant-numeric: tabular-nums; }`;
  document.head.append(css);

  // ---------- the sky: twinkling stars, a slow drift ----------
  const sx = cv.getContext('2d'); let W = 0, H = 0, stars = [];
  function size() {
    const d = Math.min(devicePixelRatio || 1, 2); W = cv.width = innerWidth * d; H = cv.height = innerHeight * d;
    const sd = Math.min(devicePixelRatio || 1, 2), s = Math.round(Math.min(300, innerWidth * .62) * sd); stage.width = stage.height = s;
    stars = Array.from({ length: Math.round(W * H / 5200) }, () => ({ x: Math.random() * W, y: Math.random() * H, r: Math.random() * 1.3 * d + .3, p: Math.random() * 6.3, s: .6 + Math.random() * 2.2 }));
  }
  size(); addEventListener('resize', size);

  // ---------- the sketches: pencil lines in cream, a pop of colour, drawn in quickly ----------
  const g = stage.getContext('2d');
  const INK = '#f6edd8', PINK = '#ee3d84', LEMON = '#ffe23a', SKY = '#5fd0e4', CORAL = '#ff7a59', LILAC = '#b9a3ff', MINT = '#7fe0b0';
  let jit = 0;
  const J = () => (Math.random() - .5) * jit;
  function line(pts, close) { g.beginPath(); g.moveTo(pts[0][0] + J(), pts[0][1] + J()); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0] + J(), pts[i][1] + J()); if (close) g.closePath(); g.stroke(); }
  function circ(x, y, r, fillC) { g.beginPath(); g.ellipse(x + J(), y + J(), r, r * (1 + J() * .01), 0, 0, 6.3); if (fillC) { g.fillStyle = fillC; g.fill(); } g.stroke(); }
  function ell(x, y, rx, ry, fillC, rot = 0) { g.beginPath(); g.ellipse(x + J(), y + J(), rx, ry, rot, 0, 6.3); if (fillC) { g.fillStyle = fillC; g.fill(); } g.stroke(); }
  function eyes(x, y, d = 12, r = 3.2) { g.save(); g.fillStyle = '#23203a'; g.beginPath(); g.arc(x - d, y, r, 0, 6.3); g.arc(x + d, y, r, 0, 6.3); g.fill(); g.restore(); }
  function smile(x, y, w = 8) { g.save(); g.strokeStyle = '#23203a'; g.lineWidth = 2.6; g.beginPath(); g.arc(x, y - 2, w, .3, Math.PI - .3); g.stroke(); g.restore(); }
  function blush(x, y, d = 20) { g.save(); g.fillStyle = 'rgba(238,61,132,.55)'; g.beginPath(); g.ellipse(x - d, y, 6, 3.5, 0, 0, 6.3); g.ellipse(x + d, y, 6, 3.5, 0, 0, 6.3); g.fill(); g.restore(); }
  function star5(x, y, R, r, fillC, rot = -Math.PI / 2) { const p = []; for (let i = 0; i < 10; i++) { const a = rot + i * Math.PI / 5, k = i % 2 ? r : R; p.push([x + Math.cos(a) * k, y + Math.sin(a) * k]); } g.beginPath(); g.moveTo(p[0][0], p[0][1]); for (const q of p.slice(1)) g.lineTo(q[0] + J(), q[1] + J()); g.closePath(); if (fillC) { g.fillStyle = fillC; g.fill(); } g.stroke(); }

  const SKETCHES = [
    ['a flit', () => { ell(150, 168, 58, 54, MINT); line([[150, 114], [150, 92]]); ell(150, 88, 46, 7, PINK); circ(150, 88, 5, INK); eyes(150, 160); smile(150, 182); blush(150, 178, 30); line([[124, 220], [120, 236]]); line([[176, 220], [180, 236]]); }],
    ['a floatie', () => { g.beginPath(); g.moveTo(70, 112); g.quadraticCurveTo(150, 30, 230, 112); g.closePath(); g.fillStyle = PINK; g.fill(); g.stroke(); for (const x of [100, 125, 150, 175, 200]) line([[150, 60], [x, 112]]); line([[150, 112], [150, 150]]); ell(150, 186, 40, 38, '#fff3e0'); line([[112, 196], [188, 196]]); line([[114, 206], [186, 206]]); eyes(150, 180, 10, 2.8); blush(150, 192, 22); }],
    ['a twinkle', () => { star5(150, 162, 82, 38, LEMON); eyes(150, 158, 13); smile(150, 176, 7); blush(150, 172, 26); g.beginPath(); g.moveTo(132, 90); g.quadraticCurveTo(150, 40, 196, 66); g.lineTo(170, 96); g.closePath(); g.fillStyle = SKY; g.fill(); g.stroke(); circ(198, 64, 7, INK); }],
    ['a moth', () => { ell(104, 140, 48, 32, SKY, -.5); ell(196, 140, 48, 32, SKY, .5); ell(112, 186, 30, 20, PINK, .4); ell(188, 186, 30, 20, PINK, -.4); circ(98, 140, 9, null); circ(202, 140, 9, null); ell(150, 166, 30, 46, '#f1dcc0'); eyes(150, 150, 10, 3); smile(150, 166, 6); line([[140, 122], [124, 92]]); line([[160, 122], [176, 92]]); circ(124, 90, 4, INK); circ(176, 90, 4, INK); }],
    ['a loaf', () => { g.beginPath(); g.roundRect(92, 112, 116, 112, 34); g.fillStyle = '#7fd1c4'; g.fill(); g.stroke(); eyes(150, 158, 18); smile(150, 180); blush(150, 176, 32); g.beginPath(); g.moveTo(150, 212); g.lineTo(126, 200); g.lineTo(126, 224); g.closePath(); g.moveTo(150, 212); g.lineTo(174, 200); g.lineTo(174, 224); g.closePath(); g.fillStyle = SKY; g.fill(); g.stroke(); }],
    ['a glim', () => { line([[130, 80], [150, 60], [170, 80]]); ell(150, 88, 34, 9, '#7a3d8c'); ell(150, 156, 52, 66, '#ffd9a8'); for (const dx of [-30, -12, 12, 30]) { g.beginPath(); g.moveTo(150 + dx, 96); g.quadraticCurveTo(150 + dx * 1.35, 156, 150 + dx, 218); g.stroke(); } ell(150, 222, 30, 8, '#7a3d8c'); eyes(150, 150, 14); blush(150, 166, 26); line([[150, 230], [150, 254]]); circ(150, 258, 5, CORAL); }],
    ['your planet', () => { circ(150, 170, 84, '#2b5c9e'); g.save(); g.beginPath(); g.arc(150, 170, 84, 0, 6.3); g.clip(); ell(124, 140, 58, 34, '#e9cf8a', -.3); ell(196, 206, 34, 20, '#e9cf8a', .4); g.restore(); circ(150, 170, 84, null); g.beginPath(); g.rect(140, 54, 20, 36); g.fillStyle = '#e8e0cc'; g.fill(); g.stroke(); g.beginPath(); g.arc(150, 70, 6, Math.PI, 0); g.stroke(); line([[132, 92], [168, 92]]); }],
    ['the ship', () => { g.beginPath(); g.moveTo(150, 40); g.lineTo(186, 200); g.lineTo(150, 216); g.lineTo(114, 200); g.closePath(); g.fillStyle = '#fbf8f2'; g.fill(); g.stroke(); ell(150, 118, 12, 28, '#3f6f86'); line([[120, 170], [180, 170]]); g.save(); g.strokeStyle = SKY; line([[132, 140], [126, 186]]); line([[168, 140], [174, 186]]); g.restore(); line([[118, 198], [100, 236]]); line([[182, 198], [200, 236]]); g.beginPath(); g.moveTo(138, 216); g.quadraticCurveTo(150, 270, 162, 216); g.fillStyle = LEMON; g.fill(); g.stroke(); }],
    ['a windmill', () => { g.beginPath(); g.moveTo(124, 236); g.lineTo(134, 120); g.lineTo(166, 120); g.lineTo(176, 236); g.closePath(); g.fillStyle = '#f4e6cc'; g.fill(); g.stroke(); g.beginPath(); g.moveTo(128, 122); g.lineTo(150, 92); g.lineTo(172, 122); g.closePath(); g.fillStyle = CORAL; g.fill(); g.stroke(); const r = Date.now() / 600; for (let k = 0; k < 4; k++) { const a = r + k * Math.PI / 2; g.save(); g.translate(150, 112); g.rotate(a); g.beginPath(); g.rect(4, -8, 66, 16); g.fillStyle = '#fff'; g.fill(); g.stroke(); g.restore(); } circ(150, 112, 6, INK); g.beginPath(); g.arc(150, 236, 12, Math.PI, 0); g.stroke(); }],
    ['a little house', () => { g.beginPath(); g.rect(96, 140, 108, 92); g.fillStyle = '#f4e6cc'; g.fill(); g.stroke(); g.beginPath(); g.moveTo(84, 146); g.lineTo(150, 84); g.lineTo(216, 146); g.closePath(); g.fillStyle = PINK; g.fill(); g.stroke(); g.beginPath(); g.roundRect(136, 186, 28, 46, [14, 14, 0, 0]); g.fillStyle = '#7a3d8c'; g.fill(); g.stroke(); g.beginPath(); g.rect(108, 160, 20, 20); g.rect(172, 160, 20, 20); g.fillStyle = LEMON; g.fill(); g.stroke(); line([[184, 104], [184, 80], [198, 80], [198, 118]]); }],
    ['a giant duck', () => { ell(150, 196, 82, 40, LEMON); circ(196, 134, 36, LEMON); g.beginPath(); g.moveTo(226, 138); g.quadraticCurveTo(262, 140, 230, 152); g.closePath(); g.fillStyle = CORAL; g.fill(); g.stroke(); eyes(204, 126, 0, 4); g.beginPath(); g.moveTo(96, 190); g.quadraticCurveTo(120, 170, 150, 196); g.stroke(); g.save(); g.strokeStyle = SKY; line([[60, 238], [100, 232], [140, 240], [180, 232], [220, 240]]); g.restore(); }]
  ];
  const LINES = ['sketching', 'painting', 'waking up', 'drawing', 'dreaming up'];

  let idx = Math.floor(Math.random() * SKETCHES.length), shownAt = performance.now(), word = 0;
  const DWELL = 640;   // ms per sketch: a rapid flip-book
  function drawSketch(now) {
    const s = stage.width / 300, t = Math.min(1, (now - shownAt) / 260);
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, stage.width, stage.height);
    const pop = 0.86 + 0.14 * (1 - Math.pow(1 - t, 3)) + Math.sin(t * Math.PI) * 0.05;
    g.setTransform(s * pop, 0, 0, s * pop, stage.width / 2 * (1 - pop), stage.height / 2 * (1 - pop));
    g.translate(0, Math.sin(now / 420) * 3);
    // reveal: a wipe, as if drawn left to right
    g.save(); g.beginPath(); g.rect(0, 0, 300 * Math.min(1, t * 1.25), 300); g.clip();
    g.lineJoin = 'round'; g.lineCap = 'round'; g.strokeStyle = INK; g.lineWidth = 3.2;
    jit = 1.6; // pencil wobble
    const seed = Math.floor(now / 110);   // the line boils a little, like a hand-drawn loop
    const rnd = Math.random; let k = seed; Math.random = () => { k = (k * 16807) % 2147483647 || 1; return (k % 1000) / 1000; };
    try { SKETCHES[idx][1](); } finally { Math.random = rnd; }
    g.restore();
  }

  // ---------- progress ----------
  let target = 0.04, shown = 0, done = false;
  window.__bootProgress = (p, label) => { target = Math.max(target, Math.min(1, p)); };
  window.__bootDone = () => { done = true; target = 1; };

  let raf = 0;
  function frame(now) {
    if (!document.body.contains(boot)) { cancelAnimationFrame(raf); return; }
    // sky
    sx.clearRect(0, 0, W, H);
    for (const st of stars) { const a = .35 + .65 * (0.5 + 0.5 * Math.sin(now / 1000 * st.s + st.p)); sx.globalAlpha = a; sx.fillStyle = '#fff6e6'; sx.beginPath(); sx.arc(st.x, st.y, st.r, 0, 6.3); sx.fill(); }
    sx.globalAlpha = 1;
    // flip-book
    if (now - shownAt > DWELL) { let n; do n = Math.floor(Math.random() * SKETCHES.length); while (n === idx); idx = n; shownAt = now; word = (word + 1) % LINES.length; }
    drawSketch(now);
    cap.textContent = `${LINES[word]} ${SKETCHES[idx][0]}…`;
    // bar: eases to the target, creeps on between milestones (never past 96% until done)
    if (!done) target = Math.min(0.96, target + 0.00035);
    shown += (target - shown) * (done ? 0.25 : 0.06);
    const pct = Math.min(100, Math.round(shown * 100));
    fill.style.width = pct + '%'; num.textContent = pct + '%';
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);
})();
