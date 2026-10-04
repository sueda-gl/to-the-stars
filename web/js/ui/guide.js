// The onboarding panel (ART_DIRECTION §24; Sueda 2026-10-04 pm: "it takes lots of space ... you can't see much when you
// really need to see the civ" + "after the read it could collapse automatically or go to a different part of the page").
// Two states:
//   - the STRIP: a slim pop card low on the screen (step n of N + dots, the step's pop picture, a short heading, one
//     line, ONE action: a Continue button or a yellow "do it" pill). Each new step pops it out with a bounce.
//   - the PILL: tucked into the bottom-left corner, "③ Open the letter" (+ a ▸ when the step has a button). The strip
//     shrinks into it by itself after a read (~4–6 s by text length) or as soon as she starts the action (a pointer
//     down outside the panel, Space, a key, typing, opening the mailbox). A click on the pill opens the strip again.
// A pulsing pop ring points at the UI the step is about (the mailbox, the mic, a resident); it stays in the pill state.
//
//   const guide = createGuide({ layer, onSkip })
//   guide.show({ step, total, id, title, body, pill, aside, todo, chips, node, action: { label, onClick }, point, pointLabel, icon, hold })   (node: an element shown with the chips)
//   guide.update(partial) · guide.aside(text | { html }) · guide.success(text) · guide.point(target, label)
//   guide.collapse() · guide.expand({ hold }) · guide.hide() · guide.visible · guide.collapsed · guide.step · guide.el
// `point`: an Element, a CSS selector, a function -> Element | {x, y} | null (re-read every frame), or null.

import { h } from './paper.js';
import { iconSlot, STEP_ICONS } from './icon-slots.js';

// The steps (Sueda, 2026-10-04 11:20 + pm). game/onboarding.js uses these words; ui-lab shows them without a game.
const AUTO_TUCK = false;   // no tucking on read / on action (the ▾ button still tucks it by hand)
export const ONBOARDING_STEPS = [
  { id: 'welcome', icon: 'planet', title: 'Welcome to planet R-99', pill: 'Welcome to R-99',
    body: 'This small part of the planet is yours: grow your own country here.', action: 'Continue' },
  { id: 'residents', icon: 'residents', title: 'Meet your residents', pill: 'Meet your residents',
    body: 'Each one has their own talents and opinions. Lead them well and treat them kindly.', action: 'Continue' },
  { id: 'future', icon: 'level-up', title: 'Peek at the future', pill: 'Peek at the future',
    body: 'Want to see how a developed civilisation looks? Toggle this.', action: 'Continue' },
  { id: 'planets', icon: 'planet', title: 'There are other planets too', pill: 'Visit another planet',
    body: 'Do you want to see some interesting places? Let\u2019s fly over and meet the creatures there.', todo: null },
  { id: 'letters', icon: 'envelope', title: 'Your residents write to you', pill: 'Open the letter',
    body: 'A red dot over someone means a letter. Read it in the mailbox, top right, and answer fairly.', todo: 'Open the letter' },
  { id: 'build', icon: 'build', title: 'Build anything, aloud', pill: 'Build something',
    body: 'Hold Space and say it, or press Enter and type. AI makes it in real time.', todo: 'Build something' },
  { id: 'mark', icon: 'point', title: 'Mark the land', pill: 'Mark a spot or a loop',
    body: 'Click the ground for a ✕, or draw a loop for a field or a zone. Then say what goes there.', todo: 'Mark a spot or draw a loop' },
  { id: 'minister', icon: 'minister-seal', title: 'Pick a minister', pill: 'Pick a minister',
    body: 'Your minister speaks for the residents, and you talk to them directly. Click someone you trust.', todo: 'Click a resident' },
  { id: 'neighbours', icon: 'shield', title: 'You have neighbours', pill: 'Read the neighbours’ letter',
    body: 'Other nations live around you. Keep your relationships good. Here is their letter. All your letters wait in the mailbox, top right: use ‹ all letters to go back to the list.', todo: 'Read their letter' },
  { id: 'ministry', icon: 'ministry', title: 'The Ministry takes it from here', pill: 'Start playing',
    body: 'Your first jobs are on the list, top left. Call the Ministry any time. The Ministry will tell you the details from here.', action: 'Start playing' }
];
const CIRCLED = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩'];
const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export function createGuide({ layer, onSkip = null } = {}) {
  let el = null, pillEl = null, ring = null, ringLbl = null, raf = 0, target = null, o = null, collapsed = false, readT = 0, armed = false;
  const parts = {};

  function build() {
    parts.label = h('span.ag-guide__label');
    parts.dots = h('span.ag-guide__dots', { 'aria-hidden': 'true' });
    parts.min = h('button.ag-guide__min', { type: 'button', 'aria-label': 'Tuck the tutorial away', title: 'tuck away', html: iconSlot('chevron', 16, '▾'), on: { click: e => { e.currentTarget.blur(); collapse(); } } });
    parts.skip = h('button.ag-guide__skip', { type: 'button', on: { click: e => { e.currentTarget.blur(); if (typeof onSkip === 'function') onSkip(); } } }, 'Skip tutorial');
    parts.badge = h('span.ag-guide__badge', { 'aria-hidden': 'true' });
    parts.title = h('h2.ag-guide__title');
    parts.body = h('p.ag-guide__body');
    parts.aside = h('div.ag-guide__aside', { hidden: true, 'aria-live': 'polite' });
    parts.chips = h('div.ag-guide__chips', { hidden: true });
    parts.todo = h('div.ag-guide__todo', { hidden: true }, h('i.ag-guide__pulse', { 'aria-hidden': 'true' }), h('span'));
    parts.ok = h('div.ag-guide__ok', { hidden: true, 'aria-live': 'assertive' }, h('span.ag-guide__tick', { html: iconSlot('check', 22, '✓') }), h('span'));
    parts.btn = h('button.ag-guide__btn', { type: 'button', hidden: true, on: { click: e => { e.currentTarget.blur(); act(); } } });
    parts.acts = h('div.ag-guide__acts', null, parts.todo, parts.ok, parts.btn);
    const card = h('div.ag-guide__card', null,
      h('div.ag-guide__top', null, parts.label, parts.dots, parts.skip, parts.min),
      h('div.ag-guide__main', null, parts.badge, h('div.ag-guide__words', null, parts.title, parts.body)),
      parts.aside, parts.chips, parts.acts);
    el = h('section.ag-guide', { role: 'region', 'aria-label': 'Getting started' }, card);
    layer.append(el);
    // the pill: the corner it shrinks into
    parts.pnum = h('span.ag-guide-pill__n');
    parts.ptxt = h('span.ag-guide-pill__t');
    parts.pgo = h('button.ag-guide-pill__go', { type: 'button', hidden: true, 'aria-label': 'Continue', html: iconSlot('arrow-right', 20, '▸'), on: { click: e => { e.stopPropagation(); e.currentTarget.blur(); act(); } } });
    pillEl = h('div.ag-guide-pill', { role: 'button', tabIndex: 0, 'aria-label': 'Open the tutorial', hidden: true,
      on: { click: () => expand({ hold: true }), keydown: e => { if (e.key === 'Enter') { e.preventDefault(); expand({ hold: true }); } } } },
      h('i.ag-guide__pulse', { 'aria-hidden': 'true' }), parts.pnum, parts.ptxt, parts.pgo);
    layer.append(pillEl);
    ring = h('div.ag-guide-ring', { hidden: true, 'aria-hidden': 'true' }, h('i'), ringLbl = h('span.ag-guide-ring__lbl'));
    layer.append(ring);
    // she starts doing it: the strip tucks itself away (never for a click on the panel / the pill themselves)
    addEventListener('pointerdown', e => { if (!o || collapsed || !armed) return; if (el.contains(e.target) || pillEl.contains(e.target)) return; collapse(); }, true);
    addEventListener('keydown', e => {
      if (!o || collapsed || !armed) return;
      if (el.contains(document.activeElement) || e.key === 'Tab' || e.key === 'Shift' || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.code === 'Space' || e.key === 'Enter' || e.key.length === 1) collapse();
    }, true);
  }
  function act() { const a = o && o.action; if (a && typeof a.onClick === 'function') a.onClick(); }

  function render() {
    if (!el) build();
    const step = o.step || 1, total = o.total || ONBOARDING_STEPS.length;
    parts.label.textContent = `${step}/${total}`;
    parts.dots.replaceChildren(...Array.from({ length: total }, (_, i) => { const k = i + 1 < step ? 'done' : i + 1 === step ? 'now' : 'todo';
      return h('i.is-' + k, { html: iconSlot(k === 'done' ? 'step-done' : k === 'now' ? 'step-current' : 'step', k === 'now' ? 17 : 13, '') }); }));
    const pic = o.icon || STEP_ICONS[step - 1];
    parts.badge.innerHTML = pic ? iconSlot(pic, 40, '') : '';
    parts.badge.hidden = !pic;
    parts.skip.hidden = o.skip === false;
    parts.title.textContent = o.title || '';
    parts.body.textContent = o.body || '';
    parts.body.hidden = !o.body;
    setAside(o.aside);
    const chips = (o.chips || []).filter(Boolean);
    parts.chips.hidden = !chips.length && !o.node;
    parts.chips.replaceChildren(...(o.node ? [o.node] : []), ...chips.map(c => h('button.ag-guide__chip' + (c.icon ? '.has-icon' : ''), { type: 'button', on: { click: e => { e.currentTarget.blur(); c.onClick && c.onClick(); } } },
      c.icon ? h('span', { html: iconSlot(c.icon, 20, '') }) : null, h('span', null, c.label))));
    parts.todo.hidden = !o.todo || !!o.ok;
    parts.todo.lastChild.textContent = o.todo || '';
    parts.ok.hidden = !o.ok;
    parts.ok.lastChild.textContent = o.ok || '';
    const a = o.action;
    parts.btn.hidden = !a || !a.label;
    if (a && a.label) parts.btn.textContent = a.label;
    el.dataset.step = String(step); el.dataset.id = o.id || '';
    // the pill's words: "③ Open the letter" (or the success)
    parts.pnum.textContent = o.ok ? '' : (CIRCLED[step - 1] || String(step));
    parts.pnum.innerHTML = o.ok ? iconSlot('check', 18, '✓') : (CIRCLED[step - 1] || String(step));
    parts.ptxt.textContent = o.ok ? 'Done!' : (o.pill || o.todo || o.title || '');
    parts.pgo.hidden = !(a && a.label);
    pillEl.classList.toggle('is-ok', !!o.ok);
    point(o.point || null, o.pointLabel || '');
  }
  function setAside(t) {
    if (!el) return;
    const txt = t == null ? '' : String(t);
    parts.aside.hidden = !txt;
    if (typeof t === 'object' && t && t.html) parts.aside.innerHTML = t.html; else parts.aside.textContent = txt;
  }
  // reading time: ~4–6 s by the length of the words
  const readMs = () => { const n = ((o && o.title) || '').length + ((o && o.body) || '').length; return Math.max(4000, Math.min(6500, 2600 + n * 32)); };
  function armRead(ms = readMs()) {
    clearTimeout(readT); armed = false;
    // a short grace, so the click that brought the step on does not tuck it away at once
    if (AUTO_TUCK) setTimeout(() => { if (o) armed = true; }, 700);
    if (o && o.hold) return;
    if (!AUTO_TUCK) return;   // Sueda 13:40: the cards stay open, they don't take much space
    readT = setTimeout(() => { if (o && !collapsed) collapse(); }, ms);
  }

  function show(opts = {}) {
    if (!el) build();
    o = { ...opts };
    render();
    el.hidden = false; layer.classList.add('is-guiding');
    expand({ pop: true });
    return el;
  }
  function expand({ hold = false, pop = false } = {}) {
    if (!o) return;
    collapsed = false;
    pillEl.classList.remove('is-on'); setTimeout(() => { if (!collapsed && pillEl) pillEl.hidden = true; }, 260);
    el.hidden = false; el.classList.remove('is-out', 'is-tucked');
    if (!el.classList.contains('is-on') || pop) { el.classList.remove('is-on'); void el.offsetWidth; el.classList.add('is-on'); }
    if (pop && !reduceMotion()) el.querySelector('.ag-guide__card').animate([{ transform: 'translateY(14px) scale(.92)', opacity: .2 }, { transform: 'translateY(-3px) scale(1.02)', opacity: 1, offset: .6 }, { transform: 'none', opacity: 1 }], { duration: 480, easing: 'cubic-bezier(.3,1.4,.5,1)' });
    layer.classList.remove('is-guide-pill');
    if (hold) { clearTimeout(readT); armed = false; setTimeout(() => { if (o) armed = true; }, 700); }   // opened on purpose: it stays until she acts
    else armRead();
  }
  function collapse() {
    if (!o || !el) return;
    clearTimeout(readT); collapsed = true;
    el.classList.remove('is-on'); el.classList.add('is-tucked');
    pillEl.hidden = false; void pillEl.offsetWidth; pillEl.classList.add('is-on');
    if (!reduceMotion()) pillEl.animate([{ transform: 'translateY(8px) scale(.7)', opacity: 0 }, { transform: 'scale(1.06)', opacity: 1, offset: .65 }, { transform: 'none', opacity: 1 }], { duration: 420, easing: 'cubic-bezier(.3,1.4,.5,1)' });
    layer.classList.add('is-guide-pill');
  }
  function update(partial = {}) { if (!o) return show(partial); o = { ...o, ...partial }; render(); }
  function success(text) {
    if (!o) return;
    o = { ...o, ok: text }; render(); point(null);
    if (!reduceMotion() && collapsed) pillEl.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.15)' }, { transform: 'scale(1)' }], { duration: 380 });
  }

  // ---------- the pointer: a pulsing pop ring round the thing to click ----------
  function resolve(t) {
    if (!t) return null;
    try {
      if (typeof t === 'function') t = t();
      if (typeof t === 'string') t = document.querySelector(t);
      if (!t) return null;
      if (t instanceof Element) {
        if (!t.isConnected) return null;
        const s = getComputedStyle(t); if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity < .05) return null;
        const r = t.getBoundingClientRect(); if (!r.width || !r.height) return null;
        const w = r.width + 16, hh = r.height + 16, round = parseFloat(s.borderRadius) >= Math.min(r.width, r.height) / 2 - 1;
        return { x: r.left + r.width / 2, y: r.top + r.height / 2, w, h: hh, rad: round ? Math.max(w, hh) / 2 : Math.min(hh / 2, 22) };
      }
      if (Number.isFinite(t.x) && Number.isFinite(t.y)) { const d = 2 * (t.r || 22); return { x: t.x, y: t.y, w: d, h: d, rad: d / 2 }; }
    } catch (_) {}
    return null;
  }
  function tick() {
    raf = 0;
    if (!target || !ring) return;
    const p = resolve(target);
    if (!p) ring.classList.remove('is-on');
    else {
      ring.classList.add('is-on');
      ring.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px)`;
      ring.style.setProperty('--rw', Math.round(p.w) + 'px'); ring.style.setProperty('--rh', Math.round(p.h) + 'px'); ring.style.setProperty('--rad', Math.round(p.rad) + 'px');
      ring.classList.toggle('is-up', p.y > innerHeight * .62);
      ring.classList.toggle('is-left', p.x > innerWidth - 120);
    }
    raf = requestAnimationFrame(tick);
  }
  function point(t, label = '') {
    target = t || null;
    if (!ring) return;
    ringLbl.textContent = label || ''; ringLbl.hidden = !label;
    ring.hidden = !target;
    if (!target) { ring.classList.remove('is-on'); cancelAnimationFrame(raf); raf = 0; return; }
    if (!raf) raf = requestAnimationFrame(tick);
  }

  function hide() {
    clearTimeout(readT); point(null); o = null; collapsed = false; armed = false;
    layer.classList.remove('is-guiding', 'is-guide-pill');
    if (pillEl) { pillEl.classList.remove('is-on'); setTimeout(() => { if (!o && pillEl) pillEl.hidden = true; }, 300); }
    if (!el || !el.classList.contains('is-on')) { if (el) el.hidden = true; return; }
    el.classList.remove('is-on');
    if (reduceMotion()) { el.hidden = true; return; }
    el.classList.add('is-out');
    const e = el; setTimeout(() => { if (!o && e === el) { e.hidden = true; e.classList.remove('is-out'); } }, 420);
  }

  return { show, update, aside: setAside, success, point, hide, collapse, expand,
    get visible() { return !!o; }, get collapsed() { return collapsed; }, get step() { return o ? o.step : 0; }, get id() { return o ? o.id : null; },
    get el() { return el; }, get pill() { return pillEl; }, get ring() { return ring; } };
}
