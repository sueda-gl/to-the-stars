// Icon slots (ART_DIRECTION §24): every UI icon is the pop-comic set (web/js/ui/icons.js, web/assets/icons/pop/).
// A slot is a <span class="ag-icon" data-icon=NAME> holding the set's inline SVG; the old drawing is only a fallback
// for a name the set does not have.
//
//   iconSlot(name, size, fallbackHTML) -> '<span class="ag-icon is-pop" data-icon=...><svg …></span>' (an HTML string)
//   iconEl(name, size, fallbackHTML)   -> the same as an element
//   loadIcons() -> Promise<true> (kept for callers; the set is a static import) · hasPopIcons() · fillIcons(root)

import { icon, PALETTE, ONBOARDING_STEPS as STEP_ICONS } from './icons.js';
export { PALETTE, STEP_ICONS };

// the UI's slot names -> the set's own names (icons.js ICON_USES)
const ALIASES = {
  mailbox: ['mailbox'], letters: ['letters'], letter: ['envelope'], 'letter-open': ['envelope-open'],
  mic: ['mic'], 'mic-live': ['mic-live'], space: ['space-key'], type: ['type'],
  close: ['close'], 'arrow-left': ['prev'], 'arrow-right': ['next'], chevron: ['chevron-down'],
  dot: ['alert-dot'], check: ['check'], point: ['point'], speech: ['speech'], thinking: ['thinking'],
  money: ['money'], happiness: ['happiness'], science: ['science'], civ: ['civ'], 'level-up': ['level-up'],
  flit: ['flit'], floatie: ['floatie'], seal: ['seal'], 'minister-seal': ['minister-seal'], ministry: ['ministry'], shield: ['shield'],
  ledger: ['ledger'], step: ['step'], 'step-current': ['step-current'], 'step-done': ['step-done'],
  planet: ['planet'], residents: ['residents'], build: ['build'], heart: ['heart'], folk: ['folk'], envelope: ['envelope']
};
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function render(name, size, opts) {
  for (const n of ALIASES[name] || [name]) {
    try { const v = icon(n, size, opts); if (v) return v; } catch (_) { /* not in the set */ }
  }
  return null;
}
export function iconSlot(name, size = 24, fallback = '', opts = undefined) {
  const pop = render(name, size, opts);
  return `<span class="ag-icon${pop ? ' is-pop' : ''}" data-icon="${esc(name)}" data-size="${+size || 24}" aria-hidden="true">${pop || fallback}</span>`;
}
export function iconEl(name, size = 24, fallback = '', opts = undefined) {
  const d = document.createElement('div'); d.innerHTML = iconSlot(name, size, fallback, opts); return d.firstChild;
}
export function fillIcons(root = document) {
  let n = 0;
  for (const el of root.querySelectorAll('.ag-icon[data-icon]:not(.is-pop)')) {
    const pop = render(el.dataset.icon, +el.dataset.size || 24);
    if (pop) { el.innerHTML = pop; el.classList.add('is-pop'); n++; }
  }
  return n;
}
export const hasPopIcons = () => true;
export function loadIcons() {
  if (typeof document !== 'undefined') document.documentElement.classList.add('ag-pop-icons');
  return Promise.resolve(true);
}
