// The Gouache lab: tune the look live, save it as the default (docs/look-lab.md).
//
//   import { bootLook } from './lab/look-lab.js';
//   const look = await bootLook({ painter, world, stages, director });  // applies web/assets/look.json if present
//   look.syncGlobe();            // after the (lazy) globe exists; also polled
//   look.installKey({ open });   // G toggles the sheet (not in director mode); open: start open (?lab=1)
//   look.open() / close() / toggle() / lab (the sheet, once mounted)
//
// The sheet edits three things:
//   1. the painter's own G (the reference's "Gouache settings" panel, mounted verbatim through paint/ui.js); the
//      same G is copied to the globe's painter, so map and globe are painted with one hand;
//   2. the map's LOOK CONTRACT  world.getLook() / world.setLook(partial);
//   3. the globe's LOOK CONTRACT globe.getLook() / globe.setLook(partial).
// Keys a target does not report in getLook() are greyed out ("not wired") and re-probed every time the sheet opens.
// A few map keys have a lab-side fallback until world.setLook owns them (light colour / intensity / aim and the
// camera, through world.backdrop and world.rig): a key the world reports always goes to world.setLook instead.
//
// Saved file (POST /api/look -> web/assets/look.json): { version, savedAt, painter:{G diff}, world:{diff}, globe:{diff} }
// Only values that differ from the factory look (captured at boot, before the saved look was applied) are written,
// so later improvements to the defaults still come through for every key nobody tuned.

const DEG = Math.PI / 180;

// ---------------- the controls ----------------
export const SECTIONS = [
  ['light', 'Light', [
    { k: 'sunAz', label: 'Sun azimuth', min: 0, max: 360, step: 1, unit: '°' },
    { k: 'sunEl', label: 'Sun elevation', min: 2, max: 88, step: 1, unit: '°' },
    { k: 'keyIntensity', label: 'Key intensity', min: 0, max: 2, step: 0.01 },
    { k: 'keyColor', label: 'Key colour', type: 'color' },
    { k: 'hemiIntensity', label: 'Sky fill', min: 0, max: 1.5, step: 0.01 },
    { k: 'hemiSky', label: 'Sky colour', type: 'color' },
    { k: 'hemiGround', label: 'Ground bounce', type: 'color' },
    { k: 'shadowTint', label: 'Shadow tint', type: 'color' },
    { k: 'shadowStrength', label: 'Shadow strength', min: 0, max: 1, step: 0.01 }
  ]],
  ['land', 'Land', [
    { k: 'creamColor', label: 'Paper cream', type: 'color' },
    { k: 'bloomPalette', label: 'Bloom palette', type: 'palette' },
    { k: 'reliefScale', label: 'Relief', min: 0, max: 3, step: 0.05, unit: '×' },
    { k: 'contours', label: 'Pencil contours', type: 'bool' },
    { k: 'contourSpacing', label: 'Contour spacing', min: 1, max: 40, step: 0.5, unit: ' m' },
    { k: 'contourOpacity', label: 'Contour strength', min: 0, max: 1, step: 0.01 },
    { k: 'coastLine', label: 'Coast line', min: 0, max: 1, step: 0.01 },
    { k: 'haze', label: 'Haze', min: 0, max: 1, step: 0.01 }
  ]],
  ['water', 'Water', [
    { k: 'waterShallow', label: 'Shallows', type: 'color' },
    { k: 'waterDeep', label: 'Deep water', type: 'color' }
  ]],
  ['camera', 'Camera', [
    { k: 'camPitch', label: 'Pitch (down)', min: 10, max: 89, step: 0.5, unit: '°' },
    { k: 'camDist', label: 'Distance', min: 12, max: 400, step: 1, unit: ' m' },
    { k: 'camFov', label: 'Lens (fov)', min: 18, max: 75, step: 0.5, unit: '°' }
  ]],
  ['view', 'View brush', [
    { k: 'brush', label: 'Brush for this view', min: 1, max: 8, step: 1, note: 'Kuwahara radius override' }
  ]]
];
const SPEC = Object.fromEntries(SECTIONS.flatMap(([, , list]) => list.map(s => [s.k, s])));
export const LOOK_KEYS = Object.keys(SPEC);

// ---------------- presets (sunAz is a compass bearing of the sun: 0 N (the bay), 90 E, 180 S, 270 W) ----------------
const REF_G = { brush: 4, wobble: 3, saturation: 1.06, warmth: 0, tooth: 0.1, pooling: 0.06, lines: true, lineWeight: 3.4, lineStrength: 0.55 };
export const PRESETS = {
  Reference: {   // the Red arch's own light and paint, aimed across the map from the west
    painter: { ...REF_G },
    look: { sunAz: 257, sunEl: 32, keyIntensity: 0.85, keyColor: '#ffe0bc', hemiIntensity: 0.62, hemiSky: '#b8cfd8', hemiGround: '#c89a6a',
      shadowTint: '#3d55a0', shadowStrength: 0.6, waterShallow: '#5cb8c7', waterDeep: '#2b78a8', haze: 0.12 }
  },
  Dawn: {
    painter: { saturation: 0.98, warmth: 0.12, tooth: 0.13, pooling: 0.07 },
    look: { sunAz: 95, sunEl: 11, keyIntensity: 0.78, keyColor: '#ffc8ac', hemiIntensity: 0.72, hemiSky: '#c9c6e6', hemiGround: '#d6a58c',
      shadowTint: '#5a5aa8', shadowStrength: 0.72, creamColor: '#f4e3d2', waterShallow: '#8ec7cb', waterDeep: '#4a70a8', haze: 0.38 }
  },
  Noon: {
    painter: { saturation: 1.1, warmth: -0.05, tooth: 0.09, pooling: 0.05 },
    look: { sunAz: 200, sunEl: 68, keyIntensity: 1.0, keyColor: '#fff4e2', hemiIntensity: 0.55, hemiSky: '#bcd8e6', hemiGround: '#c8a878',
      shadowTint: '#2f4a9a', shadowStrength: 0.5, waterShallow: '#4fc0c4', waterDeep: '#1f6aa8', haze: 0.08 }
  },
  Golden: {
    painter: { saturation: 1.12, warmth: 0.3, tooth: 0.11, pooling: 0.08 },
    look: { sunAz: 252, sunEl: 13, keyIntensity: 1.02, keyColor: '#ffb878', hemiIntensity: 0.55, hemiSky: '#b4b8d8', hemiGround: '#d08a5a',
      shadowTint: '#3a3f9e', shadowStrength: 0.78, creamColor: '#f8e2bc', waterShallow: '#6cb9b8', waterDeep: '#2a5f98', haze: 0.24 }
  },
  'Moodboard 1': {   // mb 1: the cream relief map, long warm shadows, teal sea, pencil contours
    painter: { brush: 3, wobble: 2.5, saturation: 0.98, warmth: 0.05, tooth: 0.14, pooling: 0.05, lines: true, lineWeight: 2.6, lineStrength: 0.5 },
    look: { sunAz: 248, sunEl: 21, keyIntensity: 0.95, keyColor: '#ffe2b8', hemiIntensity: 0.6, hemiSky: '#c4d4d6', hemiGround: '#cfae86',
      shadowTint: '#4f5f9a', shadowStrength: 0.55, creamColor: '#f3e6c8', reliefScale: 1.4, contours: true, contourSpacing: 6, contourOpacity: 0.35,
      coastLine: 0.7, waterShallow: '#7fc3c0', waterDeep: '#3f8f9c', haze: 0.15 }
  },
  Lush: {        // mb 4 / 5: full colour, saturated greens, ultramarine water, cobalt shadows
    painter: { saturation: 1.24, warmth: 0.08, pooling: 0.09 },
    look: { sunAz: 235, sunEl: 40, keyIntensity: 0.95, keyColor: '#fff0c8', hemiIntensity: 0.65, hemiSky: '#a8d0d8', hemiGround: '#9aa860',
      shadowTint: '#2a3f9e', shadowStrength: 0.7, bloomPalette: ['#4f8a2e', '#7db342', '#b7cf5a', '#e0c45a', '#c8873a'], reliefScale: 1.2,
      waterShallow: '#46b3b0', waterDeep: '#1d5c9a', haze: 0.08 }
  }
};
const GLOBE_SKIP = new Set(['camPitch', 'camDist', 'camFov']);   // the globe's camera is its own orbit: presets leave it

// ---------------- helpers ----------------
const clone = o => JSON.parse(JSON.stringify(o == null ? null : o));
const same = (a, b) => (typeof a === 'number' && typeof b === 'number') ? Math.abs(a - b) < 1e-6 : JSON.stringify(a) === JSON.stringify(b);
export function hex(v) {
  if (typeof v === 'number') return '#' + (v >>> 0).toString(16).padStart(6, '0').slice(-6);
  if (v && typeof v === 'object' && v.isColor) return '#' + v.getHexString();
  if (typeof v === 'string') { const s = v.trim(); if (/^#[0-9a-f]{3}$/i.test(s)) return '#' + s.slice(1).split('').map(c => c + c).join(''); if (/^#[0-9a-f]{6}/i.test(s)) return s.slice(0, 7).toLowerCase(); }
  return '#000000';
}
const safe = (fn, fb) => { try { return fn(); } catch (e) { return fb; } };

// ---------------- adapters: one per target (map / globe) ----------------
// get() -> the supported keys' values (lab units: degrees for angles, '#hex' colours); set(partial) applies them.
function worldAdapter(painter, world) {
  const native = () => (world && typeof world.getLook === 'function') ? (safe(() => world.getLook(), null) || {}) : {};
  const bd = world && world.backdrop, key = bd && bd.key, hemi = bd && bd.hemi, rig = world && world.rig, kd = world && world.keyDir;
  // lab-side fallbacks (until world.setLook owns the key)
  const FB = {};
  if (kd && key) {
    const dir = () => ({ az: ((Math.atan2(kd.x, -kd.z) / DEG) + 360) % 360, el: Math.asin(Math.max(-1, Math.min(1, kd.y / (kd.length() || 1)))) / DEG });
    const aim = (az, el) => {
      kd.set(Math.sin(az * DEG) * Math.cos(el * DEG), Math.sin(el * DEG), -Math.cos(az * DEG) * Math.cos(el * DEG));
      const D = key.position.distanceTo(key.target.position) || 300;
      key.position.copy(key.target.position).addScaledVector(kd, D); key.updateMatrixWorld();
    };
    FB.sunAz = { get: () => Math.round(dir().az * 10) / 10, set: v => aim(v, dir().el) };
    FB.sunEl = { get: () => Math.round(dir().el * 10) / 10, set: v => aim(dir().az, v) };
  }
  if (key) {
    FB.keyIntensity = { get: () => key.intensity, set: v => { key.intensity = v; } };
    FB.keyColor = { get: () => hex(key.color), set: v => key.color.set(hex(v)) };
  }
  if (hemi) {
    FB.hemiIntensity = { get: () => hemi.intensity, set: v => { hemi.intensity = v; } };
    FB.hemiSky = { get: () => hex(hemi.color), set: v => hemi.color.set(hex(v)) };
    FB.hemiGround = { get: () => hex(hemi.groundColor), set: v => hemi.groundColor.set(hex(v)) };
  }
  if (rig && typeof rig.setPose === 'function' && typeof rig.pose === 'function') {
    const put = p => { rig.setPose(p); if (rig.view) Object.assign(rig.view, p); };
    FB.camPitch = { get: () => Math.round(rig.pose().pitch / DEG * 10) / 10, set: v => put({ pitch: v * DEG }) };
    FB.camDist = { get: () => Math.round(rig.pose().dist), set: v => put({ dist: v }) };
    FB.camFov = { get: () => rig.pose().fov || 40, set: v => put({ fov: v }) };
  }
  return makeAdapter('map', () => world, native, p => world.setLook(p), FB, () => painter && painter.markDirty());
}
function globeAdapter(getGlobe) {
  const g = () => getGlobe();
  const native = () => { const gl = g(); return (gl && typeof gl.getLook === 'function') ? (safe(() => gl.getLook(), null) || {}) : {}; };
  return makeAdapter('globe', g, native, p => g().setLook(p), {}, () => { const gl = g(); if (gl && gl.painter && gl.painter.markDirty) gl.painter.markDirty(); });
}
function makeAdapter(name, target, native, setNative, FB, dirty) {
  let pitchRad = false;   // a native camPitch under 1.6 is in radians: the lab shows degrees either way
  const a = {
    name,
    available: () => !!target(),
    hasNative: () => { const t = target(); return !!(t && typeof t.getLook === 'function' && typeof t.setLook === 'function'); },
    probe() {
      const n = a.hasNative() ? native() : {};
      a.nativeKeys = new Set(Object.keys(n));
      a.fbKeys = new Set(Object.keys(FB).filter(k => !a.nativeKeys.has(k)));
      if (typeof n.camPitch === 'number') pitchRad = n.camPitch < 1.6;
      return a;
    },
    nativeKeys: new Set(), fbKeys: new Set(),
    supports: k => a.nativeKeys.has(k) || a.fbKeys.has(k),
    get() {
      if (!target()) return {};
      const out = {};
      const n = a.hasNative() ? native() : {};
      for (const k of a.fbKeys) out[k] = safe(() => FB[k].get(), undefined);
      for (const [k, v] of Object.entries(n)) out[k] = (k === 'camPitch' && pitchRad && typeof v === 'number') ? Math.round(v / DEG * 10) / 10 : (SPEC[k] && SPEC[k].type === 'color') ? hex(v) : clone(v);
      return out;
    },
    set(partial) {
      if (!target() || !partial) return;
      const nat = {};
      for (const [k, v] of Object.entries(partial)) {
        if (v === undefined) continue;
        if (a.nativeKeys.has(k)) nat[k] = (k === 'camPitch' && pitchRad) ? v * DEG : v;
        else if (a.fbKeys.has(k)) safe(() => FB[k].set(v));
        else if (!a.nativeKeys.size && a.hasNative()) nat[k] = v;   // native API with an empty getLook: pass through
      }
      if (Object.keys(nat).length) safe(() => setNative(nat));
      dirty();
    }
  };
  return a.probe();
}

// ---------------- saved look ----------------
export async function fetchSavedLook() {
  for (const url of ['/api/look', new URL('../../assets/look.json', import.meta.url).href]) {
    try {
      const r = await fetch(url, { cache: 'no-store' });
      if (!r.ok) continue;
      const j = await r.json();
      if (j && typeof j === 'object' && (j.painter || j.world || j.globe)) return j;
    } catch (_) { /* next */ }
  }
  return null;
}

// ---------------- boot: apply the saved look, keep the factory one ----------------
export async function bootLook({ painter, world, stages = null, getGlobe = null, director = false, root = document.body } = {}) {
  const globeOf = getGlobe || (() => (stages && stages.globe) || null);
  const W = worldAdapter(painter, world), Gl = globeAdapter(globeOf);
  const factory = { painter: clone(painter.G_DEFAULT || painter.G), world: W.get(), globe: null };
  let saved = await fetchSavedLook();
  if (saved) {
    if (saved.painter) { Object.assign(painter.G, saved.painter); painter.applyG(); }
    if (saved.world) W.set(saved.world);
  }
  // the painter's G is shared with the globe's painter (one hand paints both)
  let lastGlobe = null;
  function copyG() {
    const g = globeOf(); if (!g || !g.painter || !g.painter.G) return;
    Object.assign(g.painter.G, painter.G); safe(() => g.painter.applyG());
  }
  painter.subscribe && painter.subscribe(what => { if (what === 'g') copyG(); });
  function syncGlobe() {
    const g = globeOf();
    if (!g || g === lastGlobe) return;
    lastGlobe = g; Gl.probe();
    factory.globe = Gl.get();
    copyG();
    if (saved && saved.globe) Gl.set(saved.globe);
    if (lab) lab.reprobe();
  }
  syncGlobe();
  const poll = setInterval(syncGlobe, 500);
  if (stages && stages.onChange) safe(() => stages.onChange(() => setTimeout(syncGlobe, 0)));

  let lab = null;
  const ctl = {
    factory, get saved() { return saved; }, set saved(v) { saved = v; }, world: W, globe: Gl, painter, syncGlobe, copyG, globeOf, stages,
    get lab() { return lab; },
    mount() {
      if (!lab) lab = createLookLab(ctl, { root });
      return lab;
    },
    open() { ctl.mount().open(); }, close() { if (lab) lab.close(); }, toggle() { ctl.mount().toggle(); },
    installKey({ open = false } = {}) {
      if (open) ctl.open();
      if (director && !open) return ctl;   // hidden from the director / the video unless ?lab=1
      addEventListener('keydown', e => {
        if (e.key !== 'g' && e.key !== 'G') return;
        if (e.metaKey || e.ctrlKey || e.altKey) return;
        const t = e.target; if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) && t.type !== 'range' && t.type !== 'checkbox' && t.type !== 'color')) return;
        e.preventDefault(); ctl.toggle();
      });
      return ctl;
    },
    stop() { clearInterval(poll); }
  };
  return ctl;
}

// ---------------- the sheet ----------------
function ensureCss() {
  if (document.querySelector('link[data-look-lab]')) return;
  const l = document.createElement('link'); l.rel = 'stylesheet'; l.dataset.lookLab = '1';
  l.href = new URL('../../css/look-lab.css', import.meta.url).href; document.head.appendChild(l);
}
const fmt = (s, v) => {
  if (typeof v !== 'number') return '—';
  const d = s.step >= 1 ? 0 : s.step >= 0.1 ? 1 : 2;
  return v.toFixed(d) + (s.unit || '');
};

export function createLookLab(ctl, { root = document.body } = {}) {
  ensureCss();
  const { painter } = ctl;
  let target = 'map';
  const ad = () => target === 'map' ? ctl.world : ctl.globe;
  const el = document.createElement('aside');
  el.className = 'look-lab'; el.hidden = true; el.setAttribute('aria-label', 'Gouache lab');
  el.innerHTML = `
    <header class="ll-head">
      <div class="ll-title"><h2>Gouache lab</h2><button class="ll-close" type="button" title="G">close</button></div>
      <p class="ll-sub">Every change repaints at once · G to close</p>
      <div><span class="ll-pill" role="group" aria-label="Tune"><button type="button" data-t="map" aria-pressed="true">Map</button><button type="button" data-t="globe" aria-pressed="false">Globe</button></span><button class="ll-stage" type="button" hidden></button></div>
      <p class="ll-probe"></p>
    </header>
    <div class="ll-presets" role="group" aria-label="Presets">${Object.keys(PRESETS).map(n => `<button type="button" data-p="${n}">${n}</button>`).join('')}</div>
    <div class="ll-body">
      <details class="ll-sec ll-gouache" open><summary>Gouache settings <small>the reference's own</small></summary><div class="ll-sec-body ll-g-host"></div></details>
      ${SECTIONS.map(([id, title, list], i) => `<details class="ll-sec" data-sec="${id}"${i < 2 ? ' open' : ''}><summary>${title} <small></small></summary><div class="ll-sec-body">${list.map(row).join('')}</div></details>`).join('')}
    </div>
    <footer class="ll-foot">
      <button class="ll-save" type="button">Save as default</button>
      <button class="ll-link" type="button" data-a="copy">Copy JSON</button>
      <button class="ll-link" type="button" data-a="reset">Reset</button>
      <div class="ll-status" role="status" aria-live="polite"></div>
    </footer>`;
  function row(s) {
    const id = 'll-' + s.k;
    if (s.type === 'color') return `<div class="ll-row is-color" data-k="${s.k}"><label for="${id}">${s.label}</label><span class="ll-swatch"><code></code><input id="${id}" type="color"></span></div>`;
    if (s.type === 'bool') return `<div class="ll-row is-bool" data-k="${s.k}"><label for="${id}">${s.label}</label><input id="${id}" type="checkbox"></div>`;
    if (s.type === 'palette') return `<div class="ll-row is-palette" data-k="${s.k}"><label>${s.label}</label><output></output><div class="ll-palette"></div></div>`;
    return `<div class="ll-row" data-k="${s.k}"${s.note ? ` title="${s.note}"` : ''}><label for="${id}">${s.label}</label><output></output><input id="${id}" type="range" min="${s.min}" max="${s.max}" step="${s.step}"></div>`;
  }
  root.appendChild(el);
  // keep the lab's own input away from the map (the wheel zooms the canvas only, but be explicit)
  for (const ev of ['wheel', 'pointerdown', 'keydown', 'keyup']) el.addEventListener(ev, e => { if (!/^(keydown|keyup)$/.test(ev) || !/^(g|G|Escape)$/.test(e.key)) e.stopPropagation(); }, { passive: true });

  // which sections are open is a per-viewer convenience (browser storage; the page works without it)
  const OPEN_KEY = 'agora.lookLab.open';
  try { const o = JSON.parse(localStorage.getItem(OPEN_KEY) || 'null'); if (o) el.querySelectorAll('details.ll-sec').forEach((d, i) => { if (i in o) d.open = !!o[i]; }); } catch (_) {}
  el.querySelectorAll('details.ll-sec').forEach(d => d.addEventListener('toggle', () => {
    try { localStorage.setItem(OPEN_KEY, JSON.stringify([...el.querySelectorAll('details.ll-sec')].map(x => x.open))); } catch (_) {}
  }));
  // ---- the reference's Gouache settings, verbatim (paint/ui.js), seated in the sheet ----
  const host = el.querySelector('.ll-g-host');
  let paintUI = null;
  const existing = document.getElementById('tweaks');
  if (existing) host.appendChild(existing);               // ?lab=1 already mounted it on <body>: adopt it
  else import('../paint/ui.js').then(m => {
    paintUI = m.mountPaintUI(painter, { root: host, closeUp: false, keys: false, hash: false });
    const p = host.querySelector('.tweaks'); if (p) p.hidden = false;
  }).catch(e => { host.textContent = 'paint/ui.js failed: ' + e.message; });
  function refreshG() {   // = paint/ui.js applyG's DOM half, for presets / reset
    if (paintUI) { paintUI.applyG(); return; }
    painter.applyG();
    for (const [k] of painter.CONTROLS || []) {
      const inp = document.getElementById('g-' + k), out = document.getElementById('o-' + k);
      if (inp) inp.value = painter.G[k]; if (out) out.textContent = k === 'brush' ? String(painter.G[k]) : Number(painter.G[k]).toFixed(2);
    }
    const lines = document.getElementById('g-lines'); if (lines) lines.checked = painter.G.lines;
  }

  // ---- values ----
  const rows = Object.fromEntries([...el.querySelectorAll('.ll-row[data-k]')].map(r => [r.dataset.k, r]));
  let values = {};
  let pending = {}, raf = 0, dirtySince = false;
  // the camera is also moved by the wheel / drags: only camera values set HERE are saved (else a stray zoom would
  // become the default view). camSet[target][k] = the value the lab gave it.
  const CAM = new Set(['camPitch', 'camDist', 'camFov']), camSet = { map: {}, globe: {} };
  function queue(k, v) {
    values[k] = v; pending[k] = v; dirtySince = true; status('Unsaved changes.');
    if (CAM.has(k)) camSet[target][k] = v;
    if (!raf) raf = requestAnimationFrame(() => { raf = 0; const p = pending; pending = {}; ad().set(p); });
  }
  function paintRow(k) {
    const r = rows[k], s = SPEC[k], v = values[k]; if (!r) return;
    const ok = ad().available() && ad().supports(k);
    r.classList.toggle('is-missing', !ok);
    r.title = ok ? (s.note || '') : (ad().available() ? `${target === 'map' ? 'world' : 'globe'}.setLook doesn't take “${k}” yet` : 'open the globe first');
    if (s.type === 'color') { const inp = r.querySelector('input'); inp.disabled = !ok; if (v !== undefined) { inp.value = hex(v); r.querySelector('code').textContent = hex(v); } else r.querySelector('code').textContent = ''; }
    else if (s.type === 'bool') { const inp = r.querySelector('input'); inp.disabled = !ok; inp.checked = !!v; }
    else if (s.type === 'palette') {
      const box = r.querySelector('.ll-palette'), list = Array.isArray(v) ? v : [];
      r.querySelector('output').textContent = list.length ? list.length + ' colours' : '';
      if (box.children.length !== Math.max(list.length, ok ? 0 : 5)) {
        box.innerHTML = (list.length ? list : ['#6f9a3c', '#a9c35a', '#d7b45a', '#c98f3a', '#8a6a3a']).map((c, i) => `<input type="color" data-i="${i}" aria-label="Bloom colour ${i + 1}">`).join('');
      }
      [...box.children].forEach((inp, i) => { inp.disabled = !ok; inp.value = hex(list[i] || '#888888'); });
    } else {
      const inp = r.querySelector('input'); inp.disabled = !ok;
      if (typeof v === 'number') inp.value = v;
      r.querySelector('output').textContent = typeof v === 'number' ? fmt(s, v) : '';
    }
  }
  function paintAll() {
    for (const k of LOOK_KEYS) paintRow(k);
    for (const [id, , list] of SECTIONS) {
      const n = list.filter(s => ad().available() && ad().supports(s.k)).length, sm = el.querySelector(`[data-sec="${id}"] summary small`);
      sm.textContent = n === list.length ? '' : n ? `${n} of ${list.length} wired` : 'not wired yet';
    }
  }
  function reprobe() {
    ctl.world.probe(); ctl.globe.probe();
    values = ad().get();
    const A = ad(), who = target === 'map' ? 'world' : 'globe';
    const msg = !A.available() ? 'The globe is built on first use: “show the globe” makes it.'
      : A.hasNative() ? `${who}.setLook: ${A.nativeKeys.size} keys live${A.fbKeys.size ? `, ${A.fbKeys.size} through the lab’s fallback` : ''}.`
      : `${who}.setLook isn’t there yet${A.fbKeys.size ? ` · light & camera through the lab’s fallback` : ''}; the rest greys out.`;
    el.querySelector('.ll-probe').textContent = msg;
    stageBtn();
    paintAll();
  }

  // ---- inputs ----
  el.querySelector('.ll-body').addEventListener('input', e => {
    const r = e.target.closest('.ll-row[data-k]'); if (!r) return;
    const k = r.dataset.k, s = SPEC[k];
    if (s.type === 'color') { r.querySelector('code').textContent = e.target.value; queue(k, e.target.value); }
    else if (s.type === 'bool') queue(k, e.target.checked);
    else if (s.type === 'palette') { const list = [...r.querySelectorAll('.ll-palette input')].map(i => i.value); queue(k, list); }
    else { const v = parseFloat(e.target.value); r.querySelector('output').textContent = fmt(s, v); queue(k, v); }
  });
  el.querySelector('.ll-body').addEventListener('change', e => { if (e.target.type === 'checkbox' && e.target.closest('.ll-row[data-k]')) e.target.dispatchEvent(new Event('input', { bubbles: true })); });
  painter.subscribe && painter.subscribe(what => { if (what === 'g') { dirtySince = true; } });

  // ---- target switch + the globe stage ----
  el.querySelector('.ll-pill').addEventListener('click', e => {
    const b = e.target.closest('button[data-t]'); if (!b) return;
    target = b.dataset.t;
    el.querySelectorAll('.ll-pill button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    reprobe();
  });
  const stages = ctl.stages;
  const stageBtn = () => {
    const btn = el.querySelector('.ll-stage');
    if (!stages || !stages.showGlobe) { btn.hidden = true; return; }
    btn.hidden = false;
    btn.textContent = stages.scene === 'globe' ? 'back to the map' : 'show the globe';
  };
  el.querySelector('.ll-stage').addEventListener('click', async () => {
    try {
      status(stages.scene === 'globe' ? 'Back to the map…' : 'Opening the globe…');
      if (stages.scene === 'globe') { await stages.homeFromGlobe(); target = 'map'; }
      else { await stages.showGlobe(); ctl.syncGlobe(); target = 'globe'; }
      el.querySelectorAll('.ll-pill button').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.t === target)));
      reprobe(); status('');
    } catch (e) { status('Stage: ' + e.message, true); }
  });

  // ---- presets ----
  el.querySelector('.ll-presets').addEventListener('click', e => {
    const b = e.target.closest('button[data-p]'); if (!b) return;
    const P = PRESETS[b.dataset.p];
    Object.assign(painter.G, P.painter); refreshG();
    ctl.world.set(P.look);
    if (ctl.globe.available()) ctl.globe.set(Object.fromEntries(Object.entries(P.look).filter(([k]) => !GLOBE_SKIP.has(k))));
    el.querySelectorAll('.ll-presets button').forEach(x => x.classList.toggle('is-on', x === b));
    dirtySince = true; reprobe(); status(`${b.dataset.p} · unsaved.`);
  });

  // ---- save / copy / reset ----
  const diff = (cur, base) => { const o = {}; for (const [k, v] of Object.entries(cur || {})) if (v !== undefined && !(base && k in base && same(v, base[k]))) o[k] = v; return o; };
  function withCam(cur, t, prev) {   // camera keys: the lab's own values, else what was saved, never the live pose
    const o = { ...cur }; for (const k of CAM) delete o[k];
    for (const k of CAM) { if (k in camSet[t]) o[k] = camSet[t][k]; else if (prev && k in prev) o[k] = prev[k]; }
    return o;
  }
  function lookJSON() {
    const f = ctl.factory, sv = ctl.saved || {};
    const out = { painter: diff(painter.G, f.painter), world: diff(withCam(ctl.world.get(), 'map', sv.world), f.world) };
    if (ctl.globe.available() && f.globe) out.globe = diff(withCam(ctl.globe.get(), 'globe', sv.globe), f.globe);
    else if (ctl.saved && ctl.saved.globe) out.globe = ctl.saved.globe;   // the globe isn't built: keep what was saved
    for (const k of Object.keys(out)) if (!Object.keys(out[k]).length) delete out[k];
    if (!Object.keys(out).length) out.painter = {};
    return out;
  }
  async function copy(text) {
    try { await navigator.clipboard.writeText(text); return true; }
    catch (_) { const ta = document.createElement('textarea'); ta.value = text; ta.style.cssText = 'position:fixed;left:-9999px'; document.body.appendChild(ta); ta.select(); let ok = false; try { ok = document.execCommand('copy'); } catch (_) {} ta.remove(); return ok; }
  }
  function download(text) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' })); a.download = 'look.json';
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  el.querySelector('.ll-save').addEventListener('click', async () => {
    const look = lookJSON(), text = JSON.stringify({ version: 1, ...look }, null, 2);
    status('Saving…');
    try {
      const r = await fetch('/api/look', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ look }) });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.ok) { ctl.saved = j.look; dirtySince = false; status(`Saved as the default (${j.file || 'web/assets/look.json'}). The game and the labs load it at boot.`); return; }
      if (r.status === 404 || r.status === 405) {
        await copy(text); download(text);
        status('This server predates /api/look: restart it (npm start) to save from here. The JSON is copied and downloaded: drop it in web/assets/look.json.', true);
        return;
      }
      status('Not saved: ' + (j.error || r.status), true);
    } catch (e) { await copy(text); status('Not saved (' + e.message + '). The JSON is on the clipboard.', true); }
  });
  el.querySelector('[data-a="copy"]').addEventListener('click', async () => {
    const ok = await copy(JSON.stringify({ version: 1, ...lookJSON() }, null, 2));
    status(ok ? 'Look JSON copied (only what differs from the factory look).' : 'Copy failed.', !ok);
  });
  el.querySelector('[data-a="reset"]').addEventListener('click', () => {
    const f = ctl.factory;
    Object.assign(painter.G, f.painter); refreshG();
    ctl.world.set(f.world);
    if (ctl.globe.available() && f.globe) ctl.globe.set(f.globe);
    for (const t of ['map', 'globe']) { camSet[t] = {}; const fl = t === 'map' ? f.world : f.globe; for (const k of CAM) if (fl && k in fl) camSet[t][k] = fl[k]; }
    el.querySelectorAll('.ll-presets button').forEach(x => x.classList.remove('is-on'));
    reprobe(); status('Back to the factory look (not saved). Save to make it the default again.');
  });
  el.querySelector('.ll-close').addEventListener('click', () => api.close());
  let statusT = 0;
  function status(msg, warn = false) {
    const s = el.querySelector('.ll-status'); s.textContent = msg; s.classList.toggle('is-warn', !!warn);
    clearTimeout(statusT); if (msg && !warn && !/unsaved/i.test(msg)) statusT = setTimeout(() => { if (s.textContent === msg) s.textContent = dirtySince ? 'Unsaved changes.' : ''; }, 6000);
  }

  const api = {
    el, reprobe, status, lookJSON, get target() { return target; },
    setTarget(t) { const b = el.querySelector(`.ll-pill button[data-t="${t}"]`); if (b) b.click(); },
    get isOpen() { return !el.hidden; },
    open() { el.hidden = false; reprobe(); },
    close() { el.hidden = true; },
    toggle() { if (el.hidden) api.open(); else api.close(); }
  };
  return api;
}
