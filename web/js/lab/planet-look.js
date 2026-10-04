// The Gouache lab for Sueda's Tower Planet (the game world since ART_DIRECTION §12).
// G toggles it (or ?lab=1 opens it at boot). It edits, live:
//   - her paint style: Grain <-> Gouache blend, daylight, lens, grain amount / size
//   - her Red-arch gouache pass: brush radius, wobble, warmth, paper tooth, pooling, pencil, paint warp, saturation, line weight
//   - her colours (her own DEFAULT_COLOURS keys)
//   - our folk's paint (the reference folk pass's G: brush, wobble, tooth, pooling)
// "Save as default" writes web/assets/look.json { world: {planet look}, painter: {folk G} } through POST /api/look;
// the saved look is applied at boot. Nothing here changes a shader; it only sets the uniforms she exposed.

const CSS = `
.pl-lab{position:fixed;top:16px;left:16px;z-index:60;width:320px;max-height:calc(100vh - 32px);overflow:auto;
  background:rgba(243,236,220,.96);color:#3d5588;border-radius:12px;box-shadow:0 0 0 1px rgba(61,85,136,.22),0 12px 34px rgba(20,10,5,.25);
  font:14px/1.3 var(--ag-font-text,Georgia,serif);padding:12px 14px 14px}
.pl-lab[hidden]{display:none}
.pl-lab h2{margin:0;font:italic 24px var(--ag-font-display,Georgia,serif)}
.pl-lab .sub{margin:2px 0 8px;opacity:.65;font-style:italic;font-size:12.5px}
.pl-lab details{border-top:1px solid rgba(61,85,136,.16);padding:6px 0}
.pl-lab summary{cursor:pointer;font:italic 17px var(--ag-font-display,Georgia,serif);list-style:none}
.pl-lab summary::-webkit-details-marker{display:none}
.pl-lab .row{display:grid;grid-template-columns:1fr auto;gap:0 8px;align-items:baseline;margin:6px 0}
.pl-lab .row output{font-size:12px;opacity:.7;font-variant-numeric:tabular-nums}
.pl-lab .row input[type=range]{grid-column:1/-1;width:100%;accent-color:#e0503f}
.pl-lab .row.col{grid-template-columns:1fr auto auto}
.pl-lab .row.col input{width:34px;height:22px;border:1px solid rgba(61,85,136,.3);border-radius:5px;padding:0;background:none}
.pl-lab .row.chk input{accent-color:#3d5588}
.pl-lab .foot{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:10px}
.pl-lab button{font:inherit;color:inherit;background:none;border:0;cursor:pointer;text-decoration:underline;text-underline-offset:3px}
.pl-lab button.save{background:#3d5588;color:#f3ecdc;text-decoration:none;border-radius:999px;padding:6px 14px}
.pl-lab .status{font-size:12px;font-style:italic;opacity:.75;width:100%}
.pl-lab .presets{display:flex;gap:6px;flex-wrap:wrap;margin:4px 0 6px}
.pl-lab .presets button{border-radius:999px;padding:3px 10px;text-decoration:none;box-shadow:0 0 0 1px rgba(61,85,136,.25)}`;

function waitFor(get, ms = 60000) {
  return new Promise((res, rej) => { const t0 = performance.now(); (function tick() { const v = get(); if (v) return res(v);
    if (performance.now() - t0 > ms) return rej(new Error('timeout')); setTimeout(tick, 150); })(); });
}

// the controls: [key, label, min, max, step, get(A), set(A, v)]
function controls(A) {
  const P = A.planet.post, u = P.post.uniforms, k = P.kuwaharaMat.uniforms, pl = P.paintLineMat.uniforms;
  const num = (o, key) => [() => o[key].value, v => { o[key].value = v; }];
  return {
    style: [
      ['autoBlend', 'Blend by altitude (her descent)', 'bool', () => A.planet.state().followDescent, v => A.planet.autoBlend(v)],
      ['blend', 'Grain ↔ Gouache', 0, 1, 0.01, () => u.uBlend.value, v => { A.planet.setBlend(v); }],
      ['autoDaylight', 'Daylight by altitude', 'bool', () => A.planet.state().daylightOverride == null, v => A.planet.autoDaylight(v)],
      ['daylight', 'Daylight', 0, 1, 0.01, () => A.planet.daylight, v => A.planet.setDaylight(v)],
      ['fish', 'Lens (fisheye)', 0, 0.9, 0.01, ...num(u, 'uFish')],
      ['grain', 'Grain amount', 0, 1, 0.01, ...num(u, 'uGrain')],
      ['grainSize', 'Grain size', 1, 5, 0.1, ...num(u, 'uSize')]
    ],
    gouache: [
      ['brush', 'Brush radius', 1, 8, 1, ...num(k, 'uRadius')],
      ['wobble', 'Brush wobble', 0, 6, 0.1, ...num(k, 'uWarp')],
      ['warmth', 'Warmth', 0, 1.5, 0.01, ...num(k, 'uWarmth')],
      ['tooth', 'Paper tooth', 0, 0.4, 0.01, ...num(u, 'uPaperTooth')],
      ['pooling', 'Pigment pooling', 0, 0.3, 0.01, ...num(u, 'uPooling')],
      ['pencil', 'Pencil lines', 0, 1, 0.01, ...num(u, 'uPencil')],
      ['paintWarp', 'Paint warp', 0, 3, 0.05, ...num(u, 'uPaintWarp')],
      ['saturation', 'Saturation', 0.5, 1.6, 0.01, ...num(u, 'uPaintSat')],
      ['lineWeight', 'Line weight', 0.5, 6, 0.1, ...num(pl, 'uLineMax')]
    ]
  };
}

const PRESETS = {
  'Her original': null,   // reset to the factory look
  'Softer': { gouache: { brush: 5, wobble: 1.6, tooth: 0.06, pooling: 0.04, pencil: 0.4, saturation: 1.0 } },
  'Crisp': { gouache: { brush: 3, wobble: 0.6, tooth: 0.12, pooling: 0.08, pencil: 0.7, saturation: 1.12, lineWeight: 2.6 } },
  'Painterly': { gouache: { brush: 6, wobble: 2.4, tooth: 0.16, pooling: 0.12, pencil: 0.5, paintWarp: 1.8 } },
  'No lens': { style: { fish: 0 } }
};

export async function install() {
  const A = await waitFor(() => window.__agora && window.__agora.planet && window.__agora.planet.post && window.__agora);
  if (/[?&]director=1/.test(location.search) && !/[?&]lab=1/.test(location.search)) return;   // never in the video
  const st = document.createElement('style'); st.textContent = CSS; document.head.append(st);
  const C = controls(A), factory = { style: {}, gouache: {}, colours: A.planet.getColours(), folk: {} };
  for (const g of ['style', 'gouache']) for (const c of C[g]) factory[g][c[0]] = c[c.length - 2]();
  const folkG = () => A.pass && A.pass.painter && A.pass.painter.G;
  const FOLK = [['brush', 'Folk brush', 1, 8, 1], ['wobble', 'Folk wobble', 0, 8, 0.5], ['tooth', 'Folk paper tooth', 0, 0.35, 0.01], ['pooling', 'Folk pooling', 0, 0.25, 0.01]];
  try { await waitFor(folkG, 20000); for (const [k] of FOLK) factory.folk[k] = folkG()[k]; } catch {}

  const el = document.createElement('aside'); el.className = 'pl-lab'; el.hidden = true;
  const sec = (title, inner, open) => `<details${open ? ' open' : ''}><summary>${title}</summary>${inner}</details>`;
  const rowHtml = (g, c) => c[2] === 'bool'
    ? `<div class="row chk"><label for="pl-${g}-${c[0]}">${c[1]}</label><input type="checkbox" id="pl-${g}-${c[0]}" data-g="${g}" data-k="${c[0]}"></div>`
    : `<div class="row"><label for="pl-${g}-${c[0]}">${c[1]}</label><output></output><input type="range" id="pl-${g}-${c[0]}" data-g="${g}" data-k="${c[0]}" min="${c[2]}" max="${c[3]}" step="${c[4]}"></div>`;
  el.innerHTML = `<h2>Gouache lab</h2><p class="sub">your planet's own paint · every change repaints · G to close</p>
    <div class="presets">${Object.keys(PRESETS).map(n => `<button data-p="${n}">${n}</button>`).join('')}</div>
    ${sec('Paint style', C.style.map(c => rowHtml('style', c)).join(''), true)}
    ${sec('Gouache pass', C.gouache.map(c => rowHtml('gouache', c)).join(''), true)}
    ${sec('Colours', A.planet.COLOUR_KEYS.map(([k, label]) => `<div class="row col"><label>${label}</label><code style="font-size:11px;opacity:.6"></code><input type="color" data-g="colours" data-k="${k}"></div>`).join(''))}
    ${sec('Folk paint', FOLK.map(c => rowHtml('folk', c)).join(''))}
    <div class="foot"><button class="save">Save as default</button><button data-a="copy">Copy JSON</button><button data-a="reset">Reset</button><div class="status"></div></div>`;
  document.body.append(el);
  const status = t => { el.querySelector('.status').textContent = t; };
  const findC = (g, k) => (C[g] || []).find(c => c[0] === k);

  function setVal(g, k, v) {
    if (g === 'colours') { A.planet.setColour(k, v); return; }
    if (g === 'folk') { const G = folkG(); if (G) { G[k] = v; try { A.pass.painter.applyG && A.pass.painter.applyG(); } catch (_) {} } return; }
    const c = findC(g, k); if (c) c[c.length - 1](v);
  }
  function getVal(g, k) {
    if (g === 'colours') return A.planet.getColours()[k];
    if (g === 'folk') { const G = folkG(); return G ? G[k] : undefined; }
    const c = findC(g, k); return c ? c[c.length - 2]() : undefined;
  }
  function refresh() {
    el.querySelectorAll('input').forEach(i => {
      const v = getVal(i.dataset.g, i.dataset.k); if (v === undefined) return;
      if (i.type === 'checkbox') i.checked = !!v;
      else if (i.type === 'color') { i.value = v; i.previousElementSibling.textContent = v; }
      else { i.value = v; const o = i.previousElementSibling; if (o && o.tagName === 'OUTPUT') o.textContent = (+v).toFixed(+i.step >= 1 ? 0 : 2); }
    });
  }
  el.addEventListener('input', e => {
    const i = e.target; if (!i.dataset || !i.dataset.g) return;
    const v = i.type === 'checkbox' ? i.checked : i.type === 'color' ? i.value : parseFloat(i.value);
    setVal(i.dataset.g, i.dataset.k, v); refresh(); status('');
  });
  function current() {
    const diff = (g, keys) => { const o = {}; for (const k of keys) { const v = getVal(g, k); if (v !== undefined && v !== factory[g][k]) o[k] = v; } return o; };
    return { style: diff('style', C.style.map(c => c[0])), gouache: diff('gouache', C.gouache.map(c => c[0])),
      colours: diff('colours', A.planet.COLOUR_KEYS.map(([k]) => k)), folk: diff('folk', FOLK.map(c => c[0])) };
  }
  function apply(look) {
    if (!look) return;
    for (const g of ['style', 'gouache', 'colours', 'folk']) for (const [k, v] of Object.entries(look[g] || {})) setVal(g, k, v);
    refresh();
  }
  function reset() { apply({ style: factory.style, gouache: factory.gouache, colours: factory.colours, folk: factory.folk }); }
  el.querySelector('.presets').addEventListener('click', e => { const n = e.target.dataset && e.target.dataset.p; if (!n) return; reset(); apply(PRESETS[n]); status(n); });
  el.querySelector('.save').addEventListener('click', async () => {
    const c = current();
    const body = { look: { world: { planet: 1, ...prefix('style', c.style), ...prefix('gouache', c.gouache), ...prefix('colour', c.colours) }, painter: c.folk } };
    if (!Object.keys(body.look.painter).length) body.look.painter = { _v: 1 };
    try { const r = await fetch('/api/look', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      const j = await r.json(); status(r.ok ? 'saved: this is now the default look' : 'could not save: ' + (j.error || r.status)); }
    catch (e) { status('could not save: ' + e.message); }
  });
  el.querySelector('[data-a=copy]').addEventListener('click', () => { navigator.clipboard && navigator.clipboard.writeText(JSON.stringify(current(), null, 2)); status('copied'); });
  el.querySelector('[data-a=reset]').addEventListener('click', () => { reset(); status('back to her original look'); });

  // apply the saved default (web/assets/look.json, written by "Save as default")
  try {
    const r = await fetch('/assets/look.json', { cache: 'no-store' });
    if (r.ok) { const j = await r.json(); const w = j.world || {}; if (w.planet) { apply({ style: unprefix(w, 'style'), gouache: unprefix(w, 'gouache'), colours: unprefix(w, 'colour'), folk: j.painter || {} }); } }
  } catch {}

  const toggle = force => { el.hidden = force === undefined ? !el.hidden : !force; if (!el.hidden) refresh(); };
  addEventListener('keydown', e => {
    if (e.key !== 'g' && e.key !== 'G') return;
    const t = e.target; if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    e.preventDefault(); e.stopImmediatePropagation(); toggle();
  }, true);
  if (/[?&]lab=1/.test(location.search)) toggle(true);
  window.__planetLook = { open: () => toggle(true), close: () => toggle(false), current, apply, reset };
}
const prefix = (p, o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [p + '_' + k, v]));
const unprefix = (o, p) => Object.fromEntries(Object.entries(o).filter(([k]) => k.startsWith(p + '_')).map(([k, v]) => [k.slice(p.length + 1), v]));

install().catch(e => console.warn('[planet-look]', e.message));
