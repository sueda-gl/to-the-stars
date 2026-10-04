// A compact Gouache look lab for a trailer page (Sueda, 2026-10-04: "so I can adjust the paint myself").
// G toggles it (or ?lab=1 opens it). Live sliders for the painter's own controls (post.js CONTROLS + the lines
// switch); "Her defaults" puts back G_DEFAULT (never edited); Save writes her values into web/assets/look.json under
// look.trailer with the page's prefix (t6_brush, t6_lines ...) through POST /api/look, keeping every other section of
// the file as it is. Until the server knows the trailer section (a restart after server/look.js gained it), the save
// falls back to this browser's localStorage and says so. applySavedLook() is awaited at boot so recordings use it.
// Never shown in a recording unless toggled on: hidden by default, and ?hold (the capture scripts) never opens it.
//
//   await applySavedLook(painter, 't6');      // at boot, before the first frame
//   mountLookLab(painter, { key: 't6', onChange: () => repaint() });
const FONT_CSS = '../../css/aloud.css';
const STORE = key => `aloud-trailer-look-${key}`;

function pick(src, key, G) {
  const out = {};
  for (const k of Object.keys(G)) {
    const v = src[`${key}_${k}`];
    if (typeof v === typeof G[k]) out[k] = v;
  }
  return out;
}
export async function applySavedLook(painter, key) {
  let saved = {};
  try {
    const r = await fetch(new URL('../../assets/look.json', import.meta.url), { cache: 'no-store' });
    if (r.ok) {
      const j = await r.json(), tr = (j && j.trailer) || {};
      saved = pick(tr, key, painter.G_DEFAULT);
      // her one trailer look (2026-10-04: "apply the saved look everywhere"): a page without its own saved values
      // uses the master look she saved on t6
      if (!Object.keys(saved).length && key !== 't6') saved = pick(tr, 't6', painter.G_DEFAULT);
    }
  } catch (_) { /* offline: her defaults */ }
  try { const l = JSON.parse(localStorage.getItem(STORE(key)) || 'null'); if (l && !Object.keys(saved).length) saved = pick(l, key, painter.G_DEFAULT); } catch (_) {}
  Object.assign(painter.G, saved);
  painter.applyG();
  return saved;
}

export function mountLookLab(painter, { key = 't6', onChange = () => {} } = {}) {
  if (!document.querySelector(`link[href$="aloud.css"]`)) {
    const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = new URL(FONT_CSS, import.meta.url).href; l.dataset.lookLab = '1';
    // aloud.css styles the game UI; only its @font-face rules are wanted here, so load it into a disabled sheet and copy them
    l.media = 'not all'; document.head.append(l);
    l.addEventListener('load', () => { try { for (const r of l.sheet.cssRules) if (r.type === CSSRule.FONT_FACE_RULE) { const s = document.createElement('style'); s.textContent = r.cssText; document.head.append(s); } } catch (_) {} });
  }
  const css = document.createElement('style');
  css.textContent = `
.tl-lab{position:fixed;top:14px;right:14px;z-index:20;width:268px;padding:14px 16px 12px;border-radius:12px;
  background:rgba(22,20,28,.86);color:#f3ecdc;font:500 12px/1.35 Montserrat,system-ui,sans-serif;letter-spacing:.01em;
  box-shadow:0 8px 30px rgba(0,0,0,.35);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)}
.tl-lab[hidden]{display:none}
.tl-lab h2{margin:0 0 2px;font:700 13px/1.2 Montserrat,system-ui,sans-serif;letter-spacing:.04em;text-transform:uppercase}
.tl-lab .sub{margin:0 0 10px;opacity:.6;font-size:11px}
.tl-lab .row{display:grid;grid-template-columns:1fr auto;align-items:center;gap:2px 8px;margin:7px 0}
.tl-lab .row label{opacity:.9}
.tl-lab .row output{font-variant-numeric:tabular-nums;opacity:.75;font-size:11px}
.tl-lab .row input[type=range]{grid-column:1/3;width:100%;margin:0;accent-color:#e0503f}
.tl-lab .row.chk{grid-template-columns:1fr auto}
.tl-lab .foot{display:flex;gap:6px;margin-top:12px;flex-wrap:wrap}
.tl-lab button{font:600 11px Montserrat,system-ui,sans-serif;padding:6px 11px;border-radius:999px;border:1px solid rgba(243,236,220,.35);
  background:transparent;color:#f3ecdc;cursor:pointer}
.tl-lab button.save{background:#f3ecdc;color:#22202a;border-color:#f3ecdc}
.tl-lab .status{flex-basis:100%;min-height:14px;font-size:11px;opacity:.7;margin-top:4px}`;
  document.head.append(css);

  const G = painter.G, D = painter.G_DEFAULT;
  const controls = [...painter.CONTROLS];
  const el = document.createElement('aside'); el.className = 'tl-lab'; el.hidden = true;
  el.innerHTML = `<h2>Gouache look</h2><p class="sub">this scene's paint · live · G to hide</p>
    ${controls.map(([k, label, min, max, step]) => `<div class="row"><label for="tl-${k}">${label}</label><output></output>
      <input type="range" id="tl-${k}" data-k="${k}" min="${min}" max="${max}" step="${step}"></div>`).join('')}
    <div class="row chk"><label for="tl-lines">Pencil lines</label><input type="checkbox" id="tl-lines" data-k="lines"></div>
    <div class="foot"><button class="save">Save</button><button data-a="defaults">Her defaults</button><div class="status"></div></div>`;
  document.body.append(el);
  const status = t => { el.querySelector('.status').textContent = t; };
  const refresh = () => el.querySelectorAll('input').forEach(i => {
    const v = G[i.dataset.k];
    if (i.type === 'checkbox') i.checked = !!v;
    else { i.value = v; i.previousElementSibling.textContent = (+v).toFixed(+i.step >= 1 ? 0 : 2); }
  });
  el.addEventListener('input', e => {
    const i = e.target; if (!i.dataset.k) return;
    G[i.dataset.k] = i.type === 'checkbox' ? i.checked : parseFloat(i.value);
    painter.applyG(); refresh(); status(''); onChange();
  });
  el.querySelector('[data-a=defaults]').addEventListener('click', () => { Object.assign(G, D); painter.applyG(); refresh(); onChange(); status('her defaults (press Save to keep them)'); });
  el.querySelector('.save').addEventListener('click', async () => {
    const mine = {}; for (const k of Object.keys(D)) mine[`${key}_${k}`] = G[k];
    try { localStorage.setItem(STORE(key), JSON.stringify(mine)); } catch (_) {}
    status('saving…');
    try {
      // keep everything else in look.json: send the whole file back with the trailer section merged in
      let cur = {};
      try { const r0 = await fetch(new URL('../../assets/look.json', import.meta.url), { cache: 'no-store' }); if (r0.ok) cur = await r0.json(); } catch (_) {}
      const look = {};
      // (the server's key rule: a letter first; old helper keys like painter._v are left out rather than refused)
      const ok = o => Object.fromEntries(Object.entries(o || {}).filter(([k]) => /^[A-Za-z][A-Za-z0-9_]{0,40}$/.test(k)));
      for (const s of ['painter', 'world', 'globe']) if (cur[s] && Object.keys(ok(cur[s])).length) look[s] = ok(cur[s]);
      look.trailer = Object.assign({}, cur.trailer || {}, mine);
      const r = await fetch('/api/look', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ look }) });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.look && j.look.trailer) status('saved to look.json: the trailer renders with it');
      else if (r.ok) status('saved in this browser only (restart the server once to save to look.json)');
      else status('saved in this browser only: ' + (j.error || r.status));
    } catch (e) { status('saved in this browser only (' + e.message + ')'); }
  });
  const toggle = force => { el.hidden = force === undefined ? !el.hidden : !force; if (!el.hidden) refresh(); };
  addEventListener('keydown', e => {
    if (e.key !== 'g' && e.key !== 'G') return;
    const t = e.target; if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    e.preventDefault(); toggle();
  }, true);
  if (/[?&]lab=1/.test(location.search)) toggle(true);
  return { open: () => toggle(true), close: () => toggle(false), el };
}
