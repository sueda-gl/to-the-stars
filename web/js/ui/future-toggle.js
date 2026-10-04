// "Peek at the future" (Sueda, 2026-10-04 pm): a pop toggle that swaps her early game for a developed civilisation (the
// trailer's rewound city: a cabinet of ministers, science / industry / diplomacy letters, a high civ level) and back.
// The future itself is game/future.js (another hand): `future.enter()` / `future.exit()`, guarded on `future.ready`.
// One state, many switches: the onboarding's step shows one inside its panel, and after the onboarding a small one
// stays in the bottom-left corner so the jury can peek again.
//
//   const ft = createFutureToggle({ layer, future: () => game.future, onChange: on => {} })
//   ft.switchEl({ label }) -> a new switch element bound to the state · ft.dock(true) shows the corner one
//   ft.set(on) · ft.on · ft.ready · ft.el (the corner one)

import { h } from './paper.js';
import { iconSlot } from './icon-slots.js';

export function createFutureToggle({ layer, future = () => null, onChange = null, log = () => {} } = {}) {
  let on = false, busy = false;
  const switches = new Set();
  const F = () => { try { return future() || null; } catch (_) { return null; } };
  const ready = () => { const f = F(); return !!(f && f.ready && typeof f.enter === 'function'); };

  function sync() {
    const r = ready();
    { const f = F(); if (f && typeof f.active === 'boolean' && !busy) on = f.active; }   // the future's own state wins (toggled elsewhere)
    for (const s of switches) {
      if (!s.isConnected) { switches.delete(s); continue; }
      s.setAttribute('aria-checked', String(on));
      s.classList.toggle('is-on', on); s.classList.toggle('is-busy', busy); s.classList.toggle('is-off-line', !r);
      s.disabled = !r || busy;
      const t = s.querySelector('.ag-future__state'); if (t) t.textContent = !r ? 'getting ready…' : on ? 'the future' : 'today';
    }
  }
  async function set(v) {
    const f = F(); v = !!v;
    if (v === on || busy || !ready()) { sync(); return on; }
    busy = true; sync();
    try { await (v ? f.enter() : f.exit()); on = v; } catch (e) { log('future', e && e.message); }
    busy = false; sync();
    if (typeof onChange === 'function') { try { onChange(on); } catch (_) {} }
    return on;
  }
  function switchEl({ label = 'See a developed civilisation' } = {}) {
    const s = h('button.ag-future', { type: 'button', role: 'switch', 'aria-checked': 'false', title: label, on: { click: e => { e.stopPropagation(); e.currentTarget.blur(); set(!on); } } },
      h('span.ag-future__ic', { html: iconSlot('level-up', 24, '') }),
      h('span.ag-future__lbl', null, h('b', null, label), h('span.ag-future__state', null, 'today')),
      h('span.ag-future__track', null, h('i')));
    switches.add(s); sync();
    return s;
  }
  // the corner one (after the onboarding)
  const corner = switchEl({ label: 'Peek at the future' });
  corner.classList.add('ag-future--dock'); corner.hidden = true;
  layer.append(corner);
  const iv = setInterval(sync, 1000);   // future.js may land (ready) at any moment
  return { switchEl, set, dock(show = true) { corner.hidden = !show; sync(); }, get on() { return on; }, get ready() { return ready(); }, get el() { return corner; },
    dispose() { clearInterval(iv); corner.remove(); } };
}
