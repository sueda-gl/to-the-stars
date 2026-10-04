// Small paper speech bubbles above our folk (ART_DIRECTION §11 "Agent card + Talk", §18 minds' lines and
// conversations): a DOM overlay positioned every frame over the folk's head in screen space, set in the text face
// (§17: Sentient), with a little tail pointing down at the speaker. Short plain sentences: the text is cut at ~90
// characters on a word boundary and wraps inside a narrow sheet.
// Calm at the leader view (2026-10-04): a letter tag wins over a bubble. A bubble a tag (or a stack) would cover
// first slides sideways along its tail (as far as the tail can still reach the head); if it is covered anyway it
// FADES to a whisper (.agb.dim) until the tag moves. Two bubbles never overlap (the higher one moves up).
// Positions go through `project(v)` (the game passes the Tower Planet's lens: planet.toScreen), so a bubble sits on
// its folk at the screen edges too.
//   const bubbles = createBubbles(ctx, { parent = document.body, project: v -> {x, y, behind} | null })
//   bubbles.show(key, text, { ms = auto, anchor: () => THREE.Vector3 (world), tone: 'say'|'think' }) -> handle
//   bubbles.hide(key) · bubbles.update(dt, avoid = [{x, y, w, h}]) (after the camera moved; the bridge calls it every
//   frame with the letter tags' boxes) · bubbles.list() · bubbles.rectOf(key)
const MAX = 90;
// ART_DIRECTION §24: "keep speech bubbles rare and small": at most two on screen; a new idle line while two show is
// dropped (a player's talk, a thinking bubble and the ceremony `force` their way in, retiring the oldest); idle lines
// are cut shorter (SHORT) than talk replies
export const MAX_LIVE = 2, SHORT = 64;
const CSS = `
.agb-layer { position: fixed; inset: 0; pointer-events: none; z-index: 30; overflow: hidden; }
.agb { position: absolute; left: 0; top: 0; max-width: 190px; width: max-content; padding: 6px 11px 7px; box-sizing: border-box;
  font-family: var(--ag-font-text, Montserrat, system-ui, sans-serif); font-size-adjust: var(--ag-fsa-text, none); font-size: 12.5px; font-weight: 500; line-height: 1.3; letter-spacing: 0;
  color: var(--ink, #2a2330); background: var(--paper, #f3ecdc); border-radius: 12px 14px 13px 11px;
  box-shadow: 0 0 0 1px rgba(42, 35, 48, .26), 0 4px 12px rgba(48, 30, 18, .15), inset 0 -2px 0 rgba(150, 120, 80, .08);
  transform-origin: 50% 100%; opacity: 0; transition: opacity .28s ease; will-change: transform; text-wrap: pretty; }
.agb.on { opacity: 1; }
.agb.on.dim { opacity: .09; }
.agb::after { content: ""; position: absolute; left: var(--tail, 50%); bottom: -6px; width: 12px; height: 12px; margin-left: -6px;
  background: var(--paper, #f3ecdc); transform: rotate(45deg) skew(8deg, 8deg); border-radius: 0 0 3px 0;
  box-shadow: 1px 1px 0 0 rgba(42, 35, 48, .26); }
.agb .agb-who { display: block; font-family: var(--ag-font-display, Montserrat, sans-serif); font-style: normal; font-weight: 600; font-size: 12px; opacity: .62; margin: -1px 0 1px; }
.agb.think { font-style: normal; }
.agb.think .agb-dots span { display: inline-block; animation: agb-dot 1.1s infinite ease-in-out; }
.agb.think .agb-dots span:nth-child(2) { animation-delay: .15s; } .agb.think .agb-dots span:nth-child(3) { animation-delay: .3s; }
@keyframes agb-dot { 0%, 70%, 100% { transform: translateY(0); opacity: .45; } 35% { transform: translateY(-3px); opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .agb { transition: none; } .agb.think .agb-dots span { animation: none; } }
`;
export function clip(text, max = MAX) {
  const s = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (s.length <= max) return s;
  const cut = s.slice(0, max - 1), sp = cut.lastIndexOf(' ');
  return (sp > max * 0.6 ? cut.slice(0, sp) : cut).replace(/[,;:.\s]+$/, '') + '…';
}

export function createBubbles(ctx, { parent = (typeof document !== 'undefined' ? document.body : null), project = null } = {}) {
  const { camera, renderer } = ctx;
  const live = new Map();   // key -> { el, anchor, until, x, y, w, h }
  const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();
  let layer = null;
  function ensureLayer() {
    if (layer || !parent) return layer;
    let st = document.getElementById('agb-style');
    if (!st) { st = document.createElement('style'); st.id = 'agb-style'; document.head.append(st); }
    st.textContent = CSS;
    layer = document.createElement('div'); layer.className = 'agb-layer'; layer.setAttribute('aria-live', 'polite'); parent.append(layer);
    return layer;
  }
  // reading time: ~1 s per 14 characters, 2.6–7 s
  const autoMs = s => Math.max(2600, Math.min(7000, 1400 + s.length * 70));
  function show(key, text, { ms = null, anchor, tone = 'say', who = null, force = false } = {}) {
    if (!ensureLayer()) return null;
    const must = force || tone === 'think';
    if (!live.has(key) && live.size >= MAX_LIVE) {
      if (!must) return null;
      const old = [...live.entries()].filter(([, x]) => !x.force).sort((a, b) => (a[1].at || 0) - (b[1].at || 0))[0] || [...live.entries()].sort((a, b) => (a[1].at || 0) - (b[1].at || 0))[0];
      if (old) hide(old[0]);
    }
    let b = live.get(key);
    if (!b) { b = { el: document.createElement('div'), x: null, y: null }; b.el.className = 'agb'; b.el.dataset.agent = String(key); layer.append(b.el); live.set(key, b); }
    const s = tone === 'think' && !text ? '' : clip(text, must ? MAX : SHORT);
    b.force = must; b.at = performance.now();
    b.el.className = 'agb' + (tone === 'think' ? ' think' : '') + (b.el.classList.contains('on') ? ' on' : '');
    b.el.textContent = '';
    if (who) { const w = document.createElement('span'); w.className = 'agb-who'; w.textContent = who; b.el.append(w); }
    if (tone === 'think' && !s) { const d = document.createElement('span'); d.className = 'agb-dots'; d.innerHTML = '<span>·</span><span>·</span><span>·</span>'; b.el.append(d); }
    else b.el.append(document.createTextNode(s));
    b.anchor = anchor; b.text = s; b.tone = tone; b.side = 0;
    b.until = ms === 0 ? Infinity : performance.now() + (ms ?? autoMs(s));
    b.el.setAttribute('role', 'status');
    b.w = b.el.offsetWidth; b.h = b.el.offsetHeight;
    camera.updateMatrixWorld(); place(b);
    if (b.x != null) { b.tf = `translate(${Math.round(b.x)}px, ${Math.round(b.y)}px)`; b.el.style.transform = b.tf; }
    requestAnimationFrame(() => b.el.classList.add('on'));
    return { key, el: b.el, close: () => hide(key) };
  }
  function hide(key) {
    const b = live.get(key); if (!b) return false;
    live.delete(key); b.el.classList.remove('on');
    setTimeout(() => b.el.remove(), 300);
    return true;
  }
  // world point -> client px (through the lens when the game gives one)
  function toScreen(p, r) {
    if (project) { const s = project(p); return s && !s.behind && isFinite(s.x) && isFinite(s.y) ? s : null; }
    tmp2.copy(p).project(camera); if (tmp2.z > 1 || tmp2.z < -1) return null;
    return { x: r.left + (tmp2.x + 1) / 2 * r.width, y: r.top + (1 - tmp2.y) / 2 * r.height };
  }
  function place(b, r = renderer.domElement.getBoundingClientRect()) {
    const p = b.anchor && b.anchor(tmp);
    const sp = p && toScreen(p, r);
    if (!sp || sp.x < r.left - 0.07 * r.width || sp.x > r.right + 0.07 * r.width || sp.y < r.top - 0.07 * r.height || sp.y > r.bottom + 0.07 * r.height) { if (!b.hiddenV) { b.hiddenV = true; b.el.style.visibility = 'hidden'; } b.x = null; return; }
    b.sx = sp.x; b.sy = sp.y;
    // the sheet sits above the head; kept on screen, the tail slides to keep pointing at the folk
    b.x0 = sp.x - b.w / 2; b.y = sp.y - b.h - 12;
    b.x = clampX(b, b.x0); b.y = Math.max(8, b.y);
    if (b.hiddenV) { b.hiddenV = false; b.el.style.visibility = ''; }
  }
  const clampX = (b, x) => Math.max(8, Math.min(innerWidth - b.w - 8, x));
  const hits = (b, x, y, R) => { let a = 0; for (const t of R) a += Math.max(0, Math.min(x + b.w, t.x + t.w) - Math.max(x, t.x)) * Math.max(0, Math.min(y + b.h, t.y + t.h) - Math.max(y, t.y)); return a; };
  function update(dt, avoid = []) {
    if (!live.size) return;
    camera.updateMatrixWorld();   // the camera may have moved since the last render
    const now = performance.now(), r = renderer.domElement.getBoundingClientRect();
    for (const [k, b] of live) if (now > b.until) hide(k);
    const list = [...live.values()];
    list.forEach(b => place(b, r));
    // two folk talking side by side: nudge the higher sheet up so they never overlap
    list.sort((a, b) => (b.y ?? 0) - (a.y ?? 0));
    for (let i = 0; i < list.length; i++) for (let j = 0; j < i; j++) {
      const A = list[i], B = list[j]; if (A.x == null || B.x == null) continue;
      if (A.x < B.x + B.w && B.x < A.x + A.w && A.y < B.y + B.h && B.y < A.y + A.h) A.y = B.y - A.h - 6;
    }
    // a letter tag wins: slide along the tail (the tail must still reach the head), else fade to a whisper
    for (const b of list) {
      if (b.x == null) continue;
      let dim = false;
      if (avoid && avoid.length && hits(b, b.x, b.y, avoid) > 0) {
        const reach = b.w / 2 - 16, opts = [b.side || 0, -reach, reach, -reach / 2, reach / 2].map(dx => ({ dx, x: clampX(b, b.x0 + dx) }));
        const free = opts.find(o => hits(b, o.x, b.y, avoid) === 0 && b.sx - o.x >= 12 && b.sx - o.x <= b.w - 12);
        if (free) { b.side = free.dx; b.x = free.x; } else { b.side = 0; dim = true; }
      } else b.side = 0;
      // a faded bubble stays faded for at least 0.7 s (tags easing past would make it blink)
      if (dim) b.dimUntil = now + 700; else if (now < (b.dimUntil || 0)) dim = true;
      if (dim !== b.dim) { b.dim = dim; b.el.classList.toggle('dim', dim); }   // perf: DOM writes only on change
      const tail = Math.max(14, Math.min(b.w - 14, b.sx - b.x)).toFixed(1) + 'px';
      if (tail !== b.tail) { b.tail = tail; b.el.style.setProperty('--tail', tail); }
    }
    list.forEach(b => { if (b.x == null) return; const tf = `translate(${Math.round(b.x)}px, ${Math.round(b.y)}px)`; if (tf !== b.tf) { b.tf = tf; b.el.style.transform = tf; } });
  }
  function dispose() { [...live.keys()].forEach(hide); if (layer) layer.remove(); layer = null; }
  // where a folk's sheet is on screen right now
  function rectOf(key) { const b = live.get(key); if (!b || b.x == null || b.el.style.visibility === 'hidden') return null; return { x: b.x, y: b.y, w: b.w, h: b.h, dim: b.el.classList.contains('dim') }; }
  return { show, hide, update, dispose, rectOf, list: () => [...live.entries()].map(([k, b]) => ({ key: k, text: b.text, x: b.sx, y: b.sy, tone: b.tone, dim: b.el.classList.contains('dim') })), has: k => live.has(k) };
}
