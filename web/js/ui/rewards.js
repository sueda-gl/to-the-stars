// AGORA rewards (ART_DIRECTION §22 / §22b): every creation gives something back, and the screen shows the cause -> effect.
// Four areas, no more: Money (coin), Happiness (smiling lantern), Science (flask), Civ level (rising banner).
//   1. a compact tally top-left, under the settlement name: four small painted icons + numbers, quiet at rest;
//   2. reward:gain -> a painted "+n" paper stamp pops (with a squash) over the new thing; 3-8 painted tokens of that area
//      burst out and arc into their tally slot, which pulses and counts up. Several areas play in sequence;
//   3. reward:milestone -> one elegant line under the tally that fades; reward:levelup (or the sim's 'stage') -> the
//      bigger moment: a banner unfurls with the new level's name, paper tokens burst, and it flies into the Civ slot.
//
// const rw = createRewards({ layer, anchor, locate, busy });
//   layer  : the UI layer (.ag-ui) the tally lives in (its is-title / is-cinema rules hide it)
//   anchor : the settlement-name element; the tally sits under it (re-measured on resize / each gain)
//   locate : payload -> { x, y } screen px of the thing that caused the gain (called every frame while its stamp is up,
//            so the stamp stays on the building while the camera moves), or null
//   busy   : () => true while gains must wait (title, cinema, a meeting...): they queue and play afterwards
// rw.gain(payload)       payload: { gains: { money, happiness, science, civ }, totals?: {...}, level?, progress?, at?: {x,y}, ... }
//                        also accepted: { area, amount } and the older §22 names (food/craft -> money, shelter/joy -> happiness)
// rw.milestone({ text }) rw.levelUp({ level, from?, text? })  rw.setTotals({...})  rw.setCiv({ level, progress })
// rw.attach(game)        listens to reward:gain / reward:milestone / reward:levelup / reward:totals on the sim's bus
import { iconUrl as popIconUrl, ICON_NAMES as POP_ICONS } from './icons.js';
const SVGNS = 'http://www.w3.org/2000/svg';
const ORDER = ['money', 'happiness', 'science', 'civ'];
const ALIAS = { food: 'money', craft: 'money', trade: 'money', gold: 'money', coins: 'money', shelter: 'happiness', joy: 'happiness', social: 'happiness',
  culture: 'happiness', happy: 'happiness', rnd: 'science', 'r&d': 'science', research: 'science', knowledge: 'science', level: 'civ', progress: 'civ', civilisation: 'civ', civilization: 'civ' };
const LABEL = { money: 'Money', happiness: 'Happiness', science: 'Science', civ: 'Civ level' };
const LEVELS = ['Camp', 'Hamlet', 'Village', 'Town', 'Civilisation'];
const cap = s => String(s || '').replace(/^./, c => c.toUpperCase());

// ---------- the icons: hand-drawn, painted (wobbled edges + gouache tooth through an SVG filter), inline ----------
const PAINT = (id, wob = 1.4) => `<filter id="${id}" x="-15%" y="-15%" width="130%" height="130%" color-interpolation-filters="sRGB">
<feTurbulence type="fractalNoise" baseFrequency=".75" numOctaves="2" seed="4" result="n"/>
<feDisplacementMap in="SourceGraphic" in2="n" scale="${wob}" xChannelSelector="R" yChannelSelector="G" result="d"/>
<feTurbulence type="fractalNoise" baseFrequency="1.35" numOctaves="2" seed="11" result="g"/>
<feColorMatrix in="g" type="matrix" values="0 0 0 0 .22  0 0 0 0 .16  0 0 0 0 .08  0 0 0 -1.25 .62" result="ga"/>
<feComposite in="ga" in2="d" operator="in" result="gi"/>
<feTurbulence type="fractalNoise" baseFrequency=".05" numOctaves="2" seed="2" result="w"/>
<feColorMatrix in="w" type="matrix" values="0 0 0 0 1  0 0 0 0 .97  0 0 0 0 .9  0 0 0 .9 -.38" result="wa"/>
<feComposite in="wa" in2="d" operator="in" result="wi"/>
<feMerge><feMergeNode in="d"/><feMergeNode in="wi"/><feMergeNode in="gi"/></feMerge></filter>`;

export const ICONS = {
  // a struck coin: ochre gouache, a darker rim, the arch of the tower stamped in, a cream catch-light
  money: `<svg xmlns="${SVGNS}" viewBox="0 0 48 48">${PAINT('pm')}<g filter="url(#pm)">
<ellipse cx="25.6" cy="26.6" rx="17.2" ry="16.8" fill="#9c5f1c"/>
<ellipse cx="24" cy="24.4" rx="17" ry="16.7" fill="#e3a43a"/>
<path d="M8.6 27.5c2.4 7 8.6 11.4 15.6 11.4 8.4 0 15.2-6.2 16.4-14.4-2.6 6.4-8.6 10.4-15.8 10.4-7.4 0-13.4-3-16.2-7.4z" fill="#c9852b"/>
<ellipse cx="24" cy="24.3" rx="12.4" ry="12" fill="none" stroke="#b7742a" stroke-width="2.1"/>
<path d="M18.8 31.2v-6.6c0-3.1 2.3-5.5 5.2-5.5s5.2 2.4 5.2 5.5v6.6" fill="none" stroke="#8f5419" stroke-width="2.7" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M16.4 31.6h15.2" stroke="#8f5419" stroke-width="2.2" stroke-linecap="round"/>
<path d="M12.2 18.4c1.8-4 5.6-6.8 10-7.4" fill="none" stroke="#fbe3a6" stroke-width="2.8" stroke-linecap="round"/>
<circle cx="11.4" cy="22.2" r="1.3" fill="#fbe3a6"/>
<ellipse cx="24.4" cy="24.8" rx="17.2" ry="16.9" fill="none" stroke="#2a2330" stroke-opacity=".5" stroke-width="1.2"/></g></svg>`,
  // a paper lantern that smiles: vermilion, lit from inside, ribs, ochre caps, a tassel, ink face
  happiness: `<svg xmlns="${SVGNS}" viewBox="0 0 48 48"><defs><radialGradient id="hl" cx=".42" cy=".5" r=".6"><stop offset="0" stop-color="#ffb07a"/><stop offset=".55" stop-color="#ec6a48"/><stop offset="1" stop-color="#cc3f2f"/></radialGradient>
<radialGradient id="hg" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffd58a" stop-opacity=".75"/><stop offset="1" stop-color="#ffd58a" stop-opacity="0"/></radialGradient></defs>
${PAINT('ph')}<circle cx="24" cy="26" r="23" fill="url(#hg)"/><g filter="url(#ph)">
<path d="M24 2.6v6" stroke="#2a2330" stroke-width="1.6" stroke-linecap="round"/>
<path d="M17.4 9.4h13.2l-1 3.6H18.4z" fill="#c9852b"/>
<path d="M24 12.4c-8.6 0-14.6 6-14.6 13.2S15.4 38.8 24 38.8s14.6-6 14.6-13.2S32.6 12.4 24 12.4z" fill="url(#hl)"/>
<path d="M34.4 16.6c3.4 3 5 7.2 4 12.2-1 4.8-4.6 8.6-9.6 9.6 4-2.6 6.4-6.6 6.8-11 .2-3.8-.4-7.6-1.2-10.8z" fill="#b8382c" opacity=".75"/>
<path d="M17 14.6c-3.4 6-3.4 16.2 0 22.4M31 14.6c3.4 6 3.4 16.2 0 22.4M24 12.6v26" fill="none" stroke="#f6a07c" stroke-width="1.1" opacity=".75"/>
<path d="M13.2 21.6c.8-2.6 2.4-4.6 4.4-5.8" fill="none" stroke="#ffd9b0" stroke-width="2.2" stroke-linecap="round"/>
<path d="M18.2 38.2h11.6l-.9 3.2H19.1z" fill="#c9852b"/>
<path d="M24 41.4v4.4M22.4 45.6h3.2" stroke="#2a2330" stroke-width="1.4" stroke-linecap="round"/>
<circle cx="20.2" cy="24.4" r="1.45" fill="#3d3550"/><circle cx="27.8" cy="24.4" r="1.45" fill="#3d3550"/>
<path d="M19.6 28.4c2.4 3 6.4 3 8.8 0" fill="none" stroke="#3d3550" stroke-width="1.7" stroke-linecap="round"/>
<circle cx="17.6" cy="28.2" r="1.6" fill="#ff9d86" opacity=".8"/><circle cx="30.4" cy="28.2" r="1.6" fill="#ff9d86" opacity=".8"/></g></svg>`,
  // a little flask: pale glass, teal liquid, bubbles rising, an ochre cork
  science: `<svg xmlns="${SVGNS}" viewBox="0 0 48 48">${PAINT('ps')}<g filter="url(#ps)">
<path d="M19.6 6.6h8.8" stroke="#2a2330" stroke-width="2.2" stroke-linecap="round"/>
<path d="M20.4 4.4h7.2v4h-7.2z" fill="#c9852b"/>
<path d="M20.6 8.6v10.2L9.8 37.2c-1.6 2.8.4 5.8 3.6 5.8h21.2c3.2 0 5.2-3 3.6-5.8L27.4 18.8V8.6z" fill="#e8efe6"/>
<path d="M15.4 27.6h17.2l5.6 9.6c1.6 2.8-.4 5.8-3.6 5.8H13.4c-3.2 0-5.2-3-3.6-5.8z" fill="#2f948d"/>
<path d="M30.6 27.6h2l5.6 9.6c1.6 2.8-.4 5.8-3.6 5.8h-3.4c3.4-1.2 4.2-4.4 2.8-7.2z" fill="#1f6f6c"/>
<path d="M15.4 27.6c3-1.4 5.6 1.2 8.6 0s5.6 1.4 8.6 0" fill="none" stroke="#7fd1c2" stroke-width="1.6" stroke-linecap="round"/>
<circle cx="20.4" cy="35.4" r="2" fill="#bff0e2"/><circle cx="26.6" cy="38.2" r="1.4" fill="#bff0e2"/><circle cx="24.6" cy="32.2" r="1.1" fill="#bff0e2"/>
<circle cx="24.6" cy="22.4" r="1.3" fill="#9fd9cf"/><circle cx="23" cy="15.6" r=".95" fill="#9fd9cf"/>
<path d="M18.2 22.8l-4.8 8.6" stroke="#ffffff" stroke-width="2" stroke-linecap="round" opacity=".85"/>
<path d="M20.6 8.6v10.2L9.8 37.2c-1.6 2.8.4 5.8 3.6 5.8h21.2c3.2 0 5.2-3 3.6-5.8L27.4 18.8V8.6" fill="none" stroke="#2a2330" stroke-width="1.6" stroke-linejoin="round" stroke-opacity=".8"/></g></svg>`,
  // a rising banner: an ultramarine swallowtail pennant on a wooden pole, a cream sun on it, a red finial
  civ: `<svg xmlns="${SVGNS}" viewBox="0 0 48 48">${PAINT('pc')}<g filter="url(#pc)">
<path d="M14.6 7.4v36" stroke="#6b4a2f" stroke-width="2.8" stroke-linecap="round"/>
<path d="M15.8 9.4c6.4-2.6 12.4 2.8 25-0.8l-5.4 7.8 5.6 8c-12.2 3.6-18.6-1.6-25.2.8z" fill="#2a2330"/>
<path d="M15.8 21.2c6.4-2.4 13-1.4 19.8 1.4l5.4 1.6c-12.2 3.6-18.6-1.6-25.2.8z" fill="#2a3d68"/>
<path d="M17.6 11.2c4.8-1.4 8.6.6 13 .4" fill="none" stroke="#7d93c4" stroke-width="1.6" stroke-linecap="round"/>
<circle cx="25" cy="16.4" r="3.1" fill="#f3e3bd"/>
<path d="M25 10.6v1.6M25 20.6v1.6M19.2 16.4h1.6M29.2 16.4h1.6M20.9 12.3l1.1 1.1M28 19.4l1.1 1.1M20.9 20.5l1.1-1.1M28 13.4l1.1-1.1" stroke="#f3e3bd" stroke-width="1.2" stroke-linecap="round"/>
<circle cx="14.6" cy="6" r="2.7" fill="#e0503f"/>
<path d="M8.4 43.4c2.6-2.8 9.8-2.8 12.4 0" fill="#c9a46a"/></g></svg>`
};
const INK = { money: '#a2621c', happiness: '#d0453a', science: '#1f7c77', civ: '#2a2330' };
const iconUrl = {};
// §24: the pop-comic set (icons.js; web/assets/icons/pop/money|happiness|science|civ.svg); the painted ones above are the
// fallback for an area the set lacks
for (const k of ORDER) iconUrl[k] = POP_ICONS.includes(k) ? popIconUrl(k) : 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(ICONS[k]);
export const iconSrc = area => iconUrl[area];

// ---------- easing ----------
const clamp01 = t => (t < 0 ? 0 : t > 1 ? 1 : t);
const easeOutBack = (t, s = 1.7) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2);
const easeInOutCubic = t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOutCubic = t => 1 - Math.pow(1 - t, 3);
const bez = (a, b, c, d, t) => { const u = 1 - t; return u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d; };

function ensureCss() {
  if (typeof document === 'undefined' || document.querySelector('link[data-ag-rewards]')) return;
  const l = document.createElement('link'); l.rel = 'stylesheet'; l.dataset.agRewards = '1';
  l.href = new URL('../../css/rewards.css', import.meta.url).href;
  document.head.append(l);
}
const el = (tag, cls, attrs) => { const e = document.createElement(tag); if (cls) e.className = cls; if (attrs) for (const k in attrs) e.setAttribute(k, attrs[k]); return e; };

export function normaliseGains(p = {}) {
  const out = {};
  const add = (k, v) => { const a = ALIAS[String(k).toLowerCase()] || String(k).toLowerCase(); if (!ORDER.includes(a)) return; const n = Math.round(+v || 0); if (n > 0) out[a] = (out[a] || 0) + n; };
  const src = p.gains || p.areas || p.points || p.delta || null;
  if (src && typeof src === 'object') { if (Array.isArray(src)) for (const g of src) add(g.area || g.kind, g.amount ?? g.n ?? g.value); else for (const k in src) add(k, src[k]); }
  if (p.area) add(p.area, p.amount ?? p.n ?? p.value ?? 1);
  return out;
}

export function createRewards({ layer = document.body, anchor = null, locate = null, busy = () => false, reduceMotion = null, slow = 1 } = {}) {
  ensureCss();
  // slow: a lab-only time stretch (frame strips): every duration, delay and timer is multiplied by it
  const T = ms => ms * slow;
  const wait = (f, ms) => setTimeout(f, T(ms));
  const anim = (node, kf, o) => node.animate(kf, { ...o, duration: T(o.duration || 0), delay: T(o.delay || 0) });
  if (slow !== 1) layer.style.setProperty('--rw-slow', slow);
  const reduced = () => (reduceMotion != null ? !!reduceMotion : !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches));

  // ---- the tally ----
  const tally = el('div', 'ag-rw', { 'aria-label': 'what the settlement has gained', role: 'group' });
  tally.hidden = true;
  const slots = {};
  for (const k of ORDER) {
    const s = el('div', 'ag-rw__slot ag-rw__slot--' + k, { title: LABEL[k] });
    const ic = el('img', 'ag-rw__icon', { src: iconUrl[k], alt: LABEL[k], draggable: 'false' });
    const num = el('span', 'ag-rw__num');
    s.append(ic, num);
    let bar = null;
    if (k === 'civ') { num.classList.add('ag-rw__level'); bar = el('i', 'ag-rw__bar'); s.append(bar); }
    tally.append(s);
    slots[k] = { el: s, icon: ic, num, bar, shown: 0, target: 0 };
  }
  const line = el('div', 'ag-rw__line', { 'aria-live': 'polite' });
  tally.append(line);
  const fx = el('div', 'ag-rw-fx', { 'aria-hidden': 'true' });
  const fxTokens = el('div', 'ag-rw-fx__tokens'), fxStamps = el('div', 'ag-rw-fx__stamps');   // tokens fly under the stamps
  fx.append(fxTokens, fxStamps);
  layer.append(tally);
  document.body.append(fx);   // over everything in the world layer (folk bubbles, letter tags): the moment of cause -> effect

  const totals = { money: 0, happiness: 0, science: 0, civ: 0 };
  let civ = { level: 'Camp', progress: 0 };
  const renderNum = k => { const s = slots[k]; if (k === 'civ') s.num.textContent = civ.level; else s.num.textContent = String(Math.round(s.shown)); };
  const renderBar = () => { if (slots.civ.bar) slots.civ.bar.style.setProperty('--p', clamp01(civ.progress).toFixed(3)); };
  for (const k of ORDER) renderNum(k); renderBar();

  function place() {
    const r = anchor && !anchor.hidden && anchor.getBoundingClientRect();
    const lr = layer.getBoundingClientRect ? layer.getBoundingClientRect() : { left: 0, top: 0 };
    if (r && r.width) { tally.style.left = (r.left - lr.left + 4) + 'px'; tally.style.top = (r.bottom - lr.top + 2) + 'px'; }
  }
  addEventListener('resize', place);
  function show() { if (!tally.hidden) return; tally.hidden = false; place(); tally.classList.add('is-arriving'); wait(() => tally.classList.remove('is-arriving'), 900); }

  function slotCentre(k) {
    const r = slots[k].icon.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }
  function pulse(k, strong = false) {
    const s = slots[k];
    anim(s.icon, [{ transform: 'scale(1) rotate(0)' }, { transform: `scale(${strong ? 1.5 : 1.32}) rotate(-8deg)`, offset: .3 }, { transform: 'scale(.9) rotate(3deg)', offset: .62 }, { transform: 'scale(1) rotate(0)' }],
      { duration: strong ? 620 : 460, easing: 'cubic-bezier(.3,.7,.3,1)' });
    s.el.classList.remove('is-gain'); void s.el.offsetWidth; s.el.classList.add('is-gain');
    clearTimeout(s.t); s.t = wait(() => s.el.classList.remove('is-gain'), 1600);
    const ring = el('i', 'ag-rw__ring'); ring.style.setProperty('--ink', INK[k]); s.el.append(ring); wait(() => ring.remove(), 700);
  }
  function bump(k, v) {
    const s = slots[k]; s.shown = v; renderNum(k);
    anim(s.num, [{ transform: 'translateY(5px)', opacity: .35 }, { transform: 'translateY(-1px)', opacity: 1, offset: .7 }, { transform: 'none', opacity: 1 }], { duration: 260, easing: 'ease-out' });
  }

  // ---- the animation loop: runs only while something flies ----
  const live = new Set(); let raf = 0;
  function loop(now) {
    raf = 0;
    for (const a of [...live]) { if (a.step(now) === false) live.delete(a); }
    if (live.size) raf = requestAnimationFrame(loop);
  }
  const run = a => { live.add(a); if (!raf) raf = requestAnimationFrame(loop); };

  // ---- the stamp over the thing that was made ----
  function stamp(area, n, origin, stackIdx) {
    const s = el('div', 'ag-rw-stamp ag-rw-stamp--' + area);
    s.style.setProperty('--ink', INK[area]);
    s.style.setProperty('--tilt', ((stackIdx % 2 ? 4 : -5) + (Math.random() * 3 - 1.5)).toFixed(1) + 'deg');
    const paper = el('span', 'ag-rw-stamp__paper');
    const ic = el('img', 'ag-rw-stamp__icon', { src: iconUrl[area], alt: '' });
    const t = el('b', 'ag-rw-stamp__n'); t.textContent = '+' + n;
    paper.append(ic, t); s.append(paper);
    const dust = el('i', 'ag-rw-stamp__dust'); s.append(dust);
    fxStamps.append(s);
    const st = { el: s, lift: 0, liftTo: 0, origin, dead: false };
    st.pos = () => { const p = origin(); return { x: p.x, y: p.y - 46 - st.lift } };
    const t0 = performance.now();
    run({ step(now) {
      if (st.dead) return false;
      st.lift += (st.liftTo - st.lift) * .16;
      const p = st.pos(); s.style.transform = `translate3d(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px, 0)`;
      return now - t0 < T(6000);
    } });
    anim(paper, [
      { transform: 'scale(.15,.15) rotate(-16deg)', opacity: 0 },
      { transform: 'scale(1.28,.74) rotate(calc(var(--tilt) * .4))', opacity: 1, offset: .38 },
      { transform: 'scale(.88,1.14) rotate(var(--tilt))', offset: .62 },
      { transform: 'scale(1.05,.96) rotate(var(--tilt))', offset: .82 },
      { transform: 'scale(1,1) rotate(var(--tilt))' }], { duration: 560, easing: 'cubic-bezier(.25,.8,.35,1)', fill: 'forwards' });
    anim(dust, [{ transform: 'translate(-50%,-50%) scale(.4)', opacity: .0 }, { transform: 'translate(-50%,-50%) scale(1)', opacity: .55, offset: .25 }, { transform: 'translate(-50%,-50%) scale(1.9)', opacity: 0 }],
      { duration: 640, delay: 150, easing: 'ease-out', fill: 'both' });
    st.leave = (delay = 0) => wait(() => {
      const a = anim(paper, [{ transform: `scale(1) rotate(var(--tilt))`, opacity: 1 }, { transform: `translateY(-26px) scale(.82) rotate(var(--tilt))`, opacity: 0 }], { duration: 520, easing: 'cubic-bezier(.5,0,.75,0)', fill: 'forwards' });
      a.onfinish = () => { st.dead = true; s.remove(); };
    }, delay);
    return st;
  }

  // ---- the tokens: burst out of the stamp, arc into the slot ----
  function tokens(area, n, from, onArrive) {
    const count = Math.max(3, Math.min(8, n + 2));
    const tgt0 = slotCentre(area);
    let arrived = 0;
    for (let i = 0; i < count; i++) {
      const tk = el('img', 'ag-rw-token', { src: iconUrl[area], alt: '' });
      const gh = el('img', 'ag-rw-token ag-rw-token--ghost', { src: iconUrl[area], alt: '' });   // a faint after-image: the arc reads as motion
      fxTokens.append(gh, tk);
      const trail = [];
      const ang = -Math.PI / 2 + (i - (count - 1) / 2) * (Math.PI * 0.8 / Math.max(1, count - 1)) + (Math.random() - .5) * .3;
      const rad = 58 + Math.random() * 34;
      const spin = (Math.random() - .5) * 80, size = .92 + Math.random() * .22;
      const burstMs = 300, flyMs = 620 + Math.random() * 200 + i * 18, delay = i * 62;
      const start = from();
      const B = { x: start.x + Math.cos(ang) * rad * 1.15, y: start.y + Math.sin(ang) * rad * .75 - 10 };
      let t0 = 0, landed = false;
      run({ step(now) {
        if (!t0) t0 = now + T(delay);
        const e = (now - t0) / slow;
        if (e < 0) { tk.style.opacity = 0; return true; }
        let x, y, sc, rot, op = 1;
        if (e < burstMs) {
          const u = easeOutBack(clamp01(e / burstMs), 2.2);
          x = start.x + (B.x - start.x) * u; y = start.y + (B.y - start.y) * u;
          sc = size * (.2 + .9 * clamp01(e / burstMs * 1.6)); rot = spin * .3 * u;
        } else {
          const tgt = slotCentre(area), u0 = clamp01((e - burstMs) / flyMs), u = easeInOutCubic(u0);
          // out and up, over, and down into the slot: the control points swing wide so the path reads as an arc
          const c1 = { x: B.x + Math.cos(ang) * 70, y: B.y - 110 };
          const c2 = { x: tgt.x + 70 + (i % 3) * 26, y: tgt.y + 120 + (i % 2) * 40 };
          x = bez(B.x, c1.x, c2.x, tgt.x, u); y = bez(B.y, c1.y, c2.y, tgt.y, u);
          sc = size * (1 + .12 * Math.sin(Math.min(1, u0 / .7) * Math.PI)) * (1 - .3 * easeInOutCubic(clamp01((u0 - .6) / .4))); rot = spin * (.3 + u * 1.2) + Math.sin(u0 * 9 + i) * 10 * (1 - u0);
          if (u0 >= 1) {
            if (!landed) { landed = true; arrived++; onArrive(arrived, count); tk.remove(); gh.remove(); }
            return false;
          }
        }
        tk.style.opacity = op;
        const tf = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%,-50%) rotate(${rot.toFixed(1)}deg) scale(${sc.toFixed(3)})`;
        tk.style.transform = tf;
        trail.push(tf); if (trail.length > 4) { gh.style.opacity = e > burstMs ? .32 : 0; gh.style.transform = trail.shift() + ' scale(.86)'; }
        return true;
      } });
    }
    void tgt0;
    return count;
  }

  // ---- one gain: areas in sequence ----
  const queue = []; let nextAt = 0, waiting = 0;
  function gain(payload = {}) {
    const g = normaliseGains(payload);
    // the sim (web/js/sim/rewards.js) sends totals { money, happiness, science, civ, level, levelProgress } after the gain
    const T0 = payload.totals || {}, civInfo = payload.civ && typeof payload.civ === 'object' ? payload.civ : payload;
    const lv = civInfo.level || civInfo.civLevel || T0.level, pr = civInfo.progress ?? civInfo.levelProgress ?? civInfo.civProgress ?? T0.levelProgress;
    const ends = {};
    for (const k of ORDER) { const v = T0[k] ?? T0[Object.keys(ALIAS).find(a => ALIAS[a] === k && T0[a] != null)]; if (k !== 'civ' && Number.isFinite(+v) && v != null) ends[k] = +v; }
    const areas = ORDER.filter(k => g[k] > 0);
    if (!areas.length) return false;
    queue.push({ g, areas, payload, level: lv, progress: pr, ends });
    pump();
    return true;
  }
  // nothing in flight (a milestone line and a level-up wait for the tokens to land)
  const settled = () => !queue.length && !live.size && performance.now() >= nextAt;
  function pump() {
    if (!queue.length) return;
    if (busy()) { if (!waiting) waiting = wait(() => { waiting = 0; pump(); }, 400); return; }
    const item = queue.shift();
    const now = performance.now();
    const at = Math.max(now, nextAt);
    nextAt = at + T(item.areas.length * 560 + 420);
    setTimeout(() => play(item), at - now);
    if (queue.length) pump();
  }
  function originOf(payload) {
    let last = null;
    return () => {
      let p = null;
      try { p = locate ? locate(payload) : null; } catch (_) { p = null; }
      if (!p && payload.at && Number.isFinite(payload.at.x) && Number.isFinite(payload.at.y)) p = payload.at;
      if (!p && Number.isFinite(payload.sx)) p = { x: payload.sx, y: payload.sy };
      if (p && (p.behind || !Number.isFinite(p.x))) p = null;
      if (p) { p = { x: Math.max(40, Math.min(innerWidth - 40, p.x)), y: Math.max(90, Math.min(innerHeight - 30, p.y)) }; last = p; }
      return last || (last = { x: innerWidth / 2, y: innerHeight * .55 });
    };
  }
  function play({ g, areas, payload, level, progress, ends = {} }) {
    show(); place();
    if (reduced()) {
      for (const k of areas) { if (k !== 'civ') { totals[k] = ends[k] ?? totals[k] + g[k]; bump(k, totals[k]); } pulse(k); }
      if (level || progress != null) setCiv({ level: level || civ.level, progress: progress ?? civ.progress });
      return;
    }
    const origin = originOf(payload);
    const stamps = [];
    areas.forEach((k, i) => wait(() => {
      for (const s of stamps) s.liftTo += 44;
      const st = stamp(k, g[k], origin, i); stamps.push(st);
      const from = () => st.pos();
      const start = k === 'civ' ? 0 : slots[k].shown;
      const end = k === 'civ' ? 0 : (totals[k] = ends[k] ?? totals[k] + g[k]);
      wait(() => tokens(k, g[k], from, (j, count) => {
        if (k === 'civ') {
          const p0 = civ.progress, p1 = progress != null ? +progress : Math.min(1, p0 + .04 * g[k]);
          civ.progress = p0 + (p1 - p0) * (j / count); renderBar();
          if (j === count && level && !levelPending) civ.level = cap(level), renderNum('civ');
        } else bump(k, Math.round(start + (end - start) * (j / count)));
        pulse(k, j === count);
      }), 230);
      if (i === areas.length - 1) stamps.forEach((s, m) => s.leave(1250 + m * 90));
    }, i * 560));
  }

  // ---- milestone line ----
  const lines = []; let lineBusy = false;
  function milestone(p = {}) {
    if (p && p.levelUp && p.levelUp.to) return levelUp({ level: p.levelUp.to, from: p.levelUp.from });
    if (p && (p.area === 'civ' || p.area === 'level') && !p.text) return;
    const text = typeof p === 'string' ? p : p.text || p.line || (p.area && p.value ? `${LABEL[ALIAS[p.area] || p.area] || cap(p.area)} ${p.value}` : '');
    if (!text) return;
    lines.push({ text, area: ALIAS[p.area] || p.area }); show(); nextLine();
  }
  function nextLine() {
    if (lineBusy || !lines.length) return;
    if (busy() || (!settled() && (lines[0].tries = (lines[0].tries || 0) + 1) < 30)) { wait(nextLine, 300); return; }
    lineBusy = true;
    const { text, area } = lines.shift();
    line.textContent = '';
    if (area && iconUrl[area]) line.append(el('img', 'ag-rw__lineicon', { src: iconUrl[area], alt: '' }));
    line.append(document.createTextNode(text));
    line.classList.remove('is-on'); void line.offsetWidth; line.classList.add('is-on');
    wait(() => { line.classList.remove('is-on'); wait(() => { lineBusy = false; nextLine(); }, 900); }, 5200);
  }

  // ---- level up: the bigger moment ----
  let lastLevel = '', levelPending = false;
  function levelUp(p = {}, tries = 0) {
    const level = cap(typeof p === 'string' ? p : p.level || p.stage || p.to);
    if (!level) return;
    if (!tries) { if (level === lastLevel || level === civ.level) return; lastLevel = level; levelPending = true; }   // once per level (the sim says it twice: 'stage' and reward:milestone)
    if (busy() || (!settled() && tries < 30)) { wait(() => levelUp(p, tries + 1), 300); return; }
    levelPending = false;
    show(); place();
    const from = cap(p.from || civ.level);
    if (reduced()) { civ = { level, progress: 0 }; renderNum('civ'); renderBar(); pulse('civ', true); return; }
    levelPending = true;
    const box = el('div', 'ag-rw-level');
    const kick = el('div', 'ag-rw-level__kick'); kick.textContent = p.text || (from && from.toLowerCase() !== level.toLowerCase() ? `no longer a ${from.toLowerCase()}` : 'the folk raise the banner');
    const flag = el('img', 'ag-rw-level__icon', { src: iconUrl.civ, alt: '' });
    const ban = el('div', 'ag-rw-level__banner');
    const word = el('div', 'ag-rw-level__word'); word.textContent = level;
    const tl = el('i', 'ag-rw-level__tail ag-rw-level__tail--l'), tr = el('i', 'ag-rw-level__tail ag-rw-level__tail--r');
    ban.append(tl, tr, word);
    box.append(flag, ban, kick);
    fx.append(box);
    const cx = innerWidth / 2, cy = Math.max(150, innerHeight * .26);
    box.style.left = cx + 'px'; box.style.top = cy + 'px';
    // the banner rises (squash and stretch), the ribbon unfurls from the middle, the tails fold out, the name is set
    anim(flag, [{ transform: 'translateY(46px) scale(.3,.3)', opacity: 0 }, { transform: 'translateY(-10px) scale(.86,1.2)', opacity: 1, offset: .5 }, { transform: 'translateY(2px) scale(1.12,.9)', offset: .75 }, { transform: 'none', opacity: 1 }],
      { duration: 640, easing: 'cubic-bezier(.25,.8,.35,1)', fill: 'both' });
    anim(ban, [{ transform: 'scaleX(0) scaleY(.7)', opacity: 0 }, { transform: 'scaleX(1.07) scaleY(1.04)', opacity: 1, offset: .65 }, { transform: 'scaleX(.98)', offset: .85 }, { transform: 'none', opacity: 1 }],
      { duration: 720, delay: 300, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'both' });
    for (const [t, d] of [[tl, 1], [tr, -1]]) anim(t, [{ transform: `translateX(${d * 30}px) scaleX(.2)`, opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 420, delay: 760, easing: 'cubic-bezier(.3,1.4,.5,1)', fill: 'both' });
    anim(word, [{ opacity: 0, transform: 'translateY(10px) scale(1.4)', filter: 'blur(6px)' }, { opacity: 1, transform: 'none', filter: 'blur(0)' }], { duration: 640, delay: 640, easing: 'cubic-bezier(.2,.9,.3,1.2)', fill: 'both' });
    anim(kick, [{ opacity: 0, transform: 'translateY(-6px)' }, { opacity: 1, transform: 'none' }], { duration: 500, delay: 980, fill: 'both' });
    // paper confetti of all four icons
    for (let i = 0; i < 20; i++) {
      const k = ORDER[i % 4];
      const c = el('img', 'ag-rw-token ag-rw-token--confetti', { src: iconUrl[k], alt: '' }); fx.append(c);
      const ang = (i / 20) * Math.PI * 2 + Math.random() * .3, sp = 190 + Math.random() * 170, rot = (Math.random() - .5) * 540;
      const dx = Math.cos(ang) * sp, dy = Math.sin(ang) * sp * .62;
      anim(c, [
        { transform: `translate3d(${cx}px, ${cy}px, 0) translate(-50%,-50%) scale(.2) rotate(0)`, opacity: 0 },
        { transform: `translate3d(${cx + dx * .75}px, ${cy + dy * .75 - 20}px, 0) translate(-50%,-50%) scale(1) rotate(${rot * .5}deg)`, opacity: 1, offset: .32 },
        { transform: `translate3d(${cx + dx * .92}px, ${cy + dy * .92 + 18}px, 0) translate(-50%,-50%) scale(.95) rotate(${rot * .8}deg)`, opacity: 1, offset: .72 },
        { transform: `translate3d(${cx + dx}px, ${cy + dy + 70}px, 0) translate(-50%,-50%) scale(.8) rotate(${rot}deg)`, opacity: 0 }],
        { duration: 1900 + Math.random() * 600, delay: 640 + Math.random() * 160, easing: 'cubic-bezier(.15,.7,.4,1)', fill: 'both' }).onfinish = () => c.remove();
    }
    // after the hold, the banner flies into the Civ slot
    wait(() => {
      const t = slotCentre('civ'), r = ban.getBoundingClientRect();
      const dx = t.x - (r.left + r.width / 2), dy = t.y - (r.top + r.height / 2);
      anim(kick, [{ opacity: 1 }, { opacity: 0 }], { duration: 300, fill: 'forwards' });
      const a = anim(box, [{ transform: 'translate(-50%,-50%)' }, { transform: `translate(calc(-50% + ${dx * .45}px), calc(-50% + ${dy * .45 - 40}px)) scale(.6) rotate(-4deg)`, offset: .45 }, { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(.12) rotate(-8deg)`, opacity: .2 }],
        { duration: 820, easing: 'cubic-bezier(.55,0,.35,1)', fill: 'forwards' });
      a.onfinish = () => { box.remove(); levelPending = false; civ = { level, progress: 0 }; renderNum('civ'); renderBar(); pulse('civ', true);
        anim(slots.civ.num, [{ transform: 'scale(1.7) rotate(-6deg)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 520, easing: 'cubic-bezier(.3,1.6,.5,1)' }); };
    }, 3300);
  }

  function setTotals(t = {}) { for (const k in t) { const a = ALIAS[k] || k; if (a in totals && a !== 'civ' && Number.isFinite(+t[k])) { totals[a] = +t[k]; slots[a].shown = totals[a]; renderNum(a); } } }
  function setCiv({ level, progress } = {}) { if (level && !levelPending) civ.level = cap(level); if (progress != null && Number.isFinite(+progress)) civ.progress = clamp01(+progress); renderNum('civ'); renderBar(); }

  function attach(game) {
    if (!game || !game.on) return;
    game.on('reward:gain', p => gain(p || {}));
    game.on('reward:milestone', p => milestone(p || {}));
    game.on('reward:levelup', p => levelUp(p || {}));
    game.on('reward:totals', p => { setTotals(p && p.totals || p || {}); if (p && (p.level || p.progress != null)) setCiv(p); });
    game.on('stage', p => levelUp({ level: p && p.stage }));
  }

  return { el: tally, fx, get idle() { return settled() && !levelPending; }, gain, milestone, levelUp, setTotals, setCiv, attach, place, show, totals, get civ() { return { ...civ }; }, icons: ICONS, iconSrc, LEVELS };
}
