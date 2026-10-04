// The title (ART_DIRECTION §21, Sueda 08:30: "if we see the planet on its own and a cooler darker font and a name it
// would be more cool"). Her Tower Planet stays alone in dark space with nothing over it; this module only sets a
// small light-on-dark title under it: the name, a tracked small-caps tagline between hairlines, a hairline-framed
// Begin and one quiet line about the voice. No wash, no veil, no blue pill.
//
//   import { createTitle, frameTitlePlanet } from './ui/title.js';
//   const title = createTitle({ name: 'hither', font: 'sinistre', onBegin: () => begin() });
//   const unframe = frameTitlePlanet(planet);   // pulls her orbit camera back so the planet sits above the type
//   title.show();  ...  title.hide();  unframe();
//   title.set({ name: 'aloud', font: 'cantique', tone: 'gold' });   // the lab's switcher
//
// Pure DOM; links css/title.css itself (resolved from this file). See docs/title.md (incl. the game wiring).

export const TITLE_NAMES = {
  hither:   { word: 'Hither',   tag: 'a small world that comes when called', why: '“come hither”: you call, and the little fliers come. Speech is the whole interface.' },
  stars:    { word: 'To the Stars', tag: 'a civilisation, spoken into being', why: 'the game\u2019s new name (14:10).' },
  aloud:    { word: 'Aloud',    tag: 'a civilisation, spoken aloud', why: 'says exactly what the game is, in one quiet word.' },
  bidden:   { word: 'Bidden',   tag: 'a little world at your bidding', why: 'to bid = to command by word; also “bidden” = invited, the folk arriving.' },
  parley:   { word: 'Parley',   tag: 'speak, and a small world answers', why: 'from French parler: talk, treaties, the neighbours; a word with sea-salt in it.' },
  murmur:   { word: 'Murmur',   tag: 'a flock that listens', why: 'you murmur, and a murmuration of fliers turns: voice + flock in one word.' },
  folkmoot: { word: 'Folkmoot', tag: 'the gathering of the little folk', why: 'the Old English folk assembly: the agora, but ours and stranger.' },
  orison:   { word: 'Orison',   tag: 'a small world, spoken into being', why: 'an old word for a spoken prayer; it rhymes with horizon, a planet’s edge.' },
  tellus:   { word: 'Tellus',   tag: 'tell us what to build', why: 'Tellus = the Earth; read aloud it is “tell us”, the folk asking you.' }
};
export const TITLE_FONTS = {
  sinistre:   { label: 'Sinistre',      foundry: 'Collletttivo · OFL', tone: 'ivory', note: 'uncial-cut serif, set lowercase: dark, sharp, mythic' },
  cantique:   { label: 'Cantique',      foundry: 'Velvetyne · OFL', tone: 'gold', note: 'hairline art-nouveau serif, title case, with its long-legged capitals' },
  melodrama:  { label: 'Melodrama',     foundry: 'Fontshare · ITF FFL', tone: 'ivory', note: 'light condensed Didone, widely tracked: cinematic' },
  lineal:     { label: 'Lineal Light',   foundry: 'Velvetyne · OFL', tone: 'gold', note: 'light geometric caps, very open: cold, spacious, orbital' },
  aujournuit: { label: 'Aujournuit Wide', foundry: 'Collletttivo · OFL', tone: 'ivory', note: 'wide engraved serif caps: calm, monumental, a little strange' },
  pop:        { label: 'Titan One (pop)', foundry: 'Rodrigo Fuenzalida · OFL', tone: 'lemon', note: 'ART_DIRECTION §23/§24: chunky comic display, lemon with an ink outline, pink halftone shade, a misregistered pink print shadow, little stars' }
};
export const TITLE_NAME_IDS = Object.keys(TITLE_NAMES);
export const TITLE_FONT_IDS = Object.keys(TITLE_FONTS);
// what the game uses until Sueda picks (docs/title.md has the lab's recommendation)
export const TITLE_DEFAULT = { name: 'stars', font: 'pop', alt: 'melodrama' };   // §23 (revised 2026-10-04 pm): the pop-comic title

const CSS_HREF = new URL('../../css/title.css', import.meta.url).href;
export function linkTitleCSS() {
  if (document.querySelector('link[data-tt-css]')) return;
  const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = CSS_HREF; l.dataset.ttCss = '';
  document.head.append(l);
}
const FAMILY = { sinistre: '400 40px "Title Sinistre"', cantique: '400 40px "Title Cantique"', melodrama: '600 40px "Title Melodrama"', lineal: '300 40px "Title Lineal"', aujournuit: '400 40px "Title Aujournuit Wide"', pop: '400 40px "Title Titan"' };
// resolves when the face is ready (so the title never flashes in a fallback)
export function loadTitleFont(font) {
  linkTitleCSS();
  const f = FAMILY[font] || FAMILY[TITLE_DEFAULT.font];
  try { return Promise.all([document.fonts.load(f), document.fonts.load('600 12px Montserrat'), document.fonts.load('400 12px Montserrat')]).catch(() => {}); }
  catch (_) { return Promise.resolve(); }
}

const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

export function createTitle({ parent = document.body, name = TITLE_DEFAULT.name, font = TITLE_DEFAULT.font, tone = null, tagline = null,
  begin = 'Begin', hint = true, onBegin = null, enterKey = true } = {}) {
  linkTitleCSS();
  const root = el('section', 'tt'); root.hidden = true; root.setAttribute('role', 'dialog');
  const nameEl = el('h1', 'tt__name');
  const tagEl = el('p', 'tt__tag');
  const btn = el('button', 'tt__begin'); btn.type = 'button'; btn.append(el('span', null, begin));
  const hintEl = el('p', 'tt__hint'); hintEl.innerHTML = 'sound on, then hold <kbd>Space</kbd> and speak';
  // the pop title's little stars (only drawn for data-font="pop"; css/title.css)
  const STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1.8l2.9 6.4 7 .7-5.3 4.7 1.6 6.9L12 16.9l-6.2 3.6 1.6-6.9L2.1 8.9l7-.7z" fill="#ffe23a" stroke="#2a2740" stroke-width="2" stroke-linejoin="round"/></svg>';
  const SPARK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1c.8 6.4 4.6 10.2 11 11-6.4.8-10.2 4.6-11 11-.8-6.4-4.6-10.2-11-11C7.4 11.2 11.2 7.4 12 1z" fill="#ee3d84" stroke="#2a2740" stroke-width="1.6" stroke-linejoin="round"/></svg>';
  const nameWrap = el('div', 'tt__namewrap'); nameWrap.append(nameEl);
  for (const [k, svg] of [['a', STAR], ['b', SPARK], ['c', STAR], ['d', SPARK]]) { const st = el('span', 'tt__star tt__star--' + k); st.innerHTML = svg; nameWrap.append(st); }
  root.append(nameWrap, tagEl, btn); if (hint) root.append(hintEl);
  parent.append(root);

  let cur = { name, font, tone, tagline }, shown = false, leaving = false;
  function render() {
    const n = TITLE_NAMES[cur.name] || { word: cur.name, tag: '' };
    const fid = TITLE_FONTS[cur.font] ? cur.font : TITLE_DEFAULT.font;
    root.dataset.font = fid; root.dataset.name = cur.name;
    root.classList.toggle('is-gold', false);   // Sueda: white, not yellow
    root.classList.toggle('is-long', n.word.length > 7);
    nameEl.textContent = n.word; nameEl.dataset.text = n.word; root.setAttribute('aria-label', n.word);
    tagEl.textContent = cur.tagline || n.tag;
  }
  // replay the entrance (the lab, after a switch)
  function replay() { for (const e of root.children) { e.style.animation = 'none'; void e.offsetWidth; e.style.animation = ''; } }
  function set(o = {}) { cur = { ...cur, ...o }; render(); loadTitleFont(cur.font); if (o.replay) replay(); }
  async function show() {
    render(); await loadTitleFont(cur.font);
    leaving = false; root.classList.remove('is-leaving'); root.hidden = false; shown = true; replay();
    document.body.classList.add('ag-title-on');
  }
  function hide({ instant = false } = {}) {
    if (!shown) return; shown = false; leaving = true; document.body.classList.remove('ag-title-on');
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (instant || reduce) { root.hidden = true; leaving = false; return; }
    root.classList.add('is-leaving');
    setTimeout(() => { if (leaving) { root.hidden = true; root.classList.remove('is-leaving'); leaving = false; } }, 1150);
  }
  function start() { if (!shown || leaving) return; hide(); if (onBegin) onBegin(); }
  btn.addEventListener('click', () => { btn.blur(); start(); });
  const onKey = e => { if (enterKey && shown && !leaving && e.key === 'Enter' && document.activeElement?.tagName !== 'BUTTON' && document.activeElement?.tagName !== 'INPUT') { e.preventDefault(); start(); } };
  addEventListener('keydown', onKey);
  function dispose() { removeEventListener('keydown', onKey); root.remove(); document.body.classList.remove('ag-title-on'); }
  render();
  return { el: root, show, hide, start, set, replay, dispose, get visible() { return shown; }, get state() { return { ...cur }; } };
}

// Her orbit, framed for the title: the camera pulled back (zoom x her fit distance) and the frame slid down a little
// (a camera view offset, `lift` x the screen height) so the planet, tower and all, sits in the upper part and the type
// has the dark below it. Only her own setOrbit distance and the camera's view window change; the look, the spin, the
// lens and the descent are untouched. Returns release(ms): eases both back to her framing (call it at Begin, as the
// descent starts; the descent flies from wherever the camera is, so the hand-over is seamless).
export function frameTitlePlanet(planet, { zoom = null, lift = null } = {}) {
  if (!planet || !planet.state) return () => Promise.resolve();
  const cam = planet.camera;
  const portrait = () => innerWidth / innerHeight < 1;
  const Z = () => zoom || (portrait() ? 1.06 : 1.4), L = () => (lift != null ? lift : (portrait() ? -0.05 : -0.055));   // Sueda 08:54: title on top, planet below
  let k = 1, raf = 0, released = false;   // k: 1 = title framing, 0 = hers
  const fit = () => planet.state().orbit.fitDist;
  function apply() {
    const w = innerWidth, h = innerHeight, l = L() * k;
    if (Math.abs(l) > 0.0005) cam.setViewOffset(w, h, 0, h * l, w, h); else cam.clearViewOffset();
    cam.updateProjectionMatrix();
    if (planet.mode === 'orbit') planet.setOrbit({ dist: fit() * (1 + (Z() - 1) * k) });
  }
  const onResize = () => apply();
  addEventListener('resize', onResize);
  apply();
  return function release(ms = 1400) {
    if (released) return Promise.resolve(); released = true;
    cancelAnimationFrame(raf);
    return new Promise(res => {
      const t0 = performance.now(), k0 = k;
      const step = now => {
        const t = Math.min(1, (now - t0) / Math.max(1, ms)); k = k0 * (1 - t * t * (3 - 2 * t)); apply();
        if (t < 1) raf = requestAnimationFrame(step); else { removeEventListener('resize', onResize); cam.clearViewOffset(); cam.updateProjectionMatrix(); planet.setOrbit({ dist: fit() }); res(); }
      };
      raf = requestAnimationFrame(step);
    });
  };
}
