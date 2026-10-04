// AGORA mail (ART_DIRECTION §14, §15): letters live in the world; the inbox stays top-right and letters are READ there.
//  - the INBOX (top-right, under the envelope stack): the recent column (portrait, sender, subject, time, an unread dot
//    = mark read, ×, mark all read, dismiss all, see all at once) that EXPANDS IN PLACE into a reading pane when a
//    letter opens (§15: a click on the stack, a note, a row, a folk's tag). The pane: the sender's painted portrait,
//    name + trade, Day n, the subject, the body (scrolls), the signature, P.S., 2–3 quick replies, "back to the list",
//    prev / next. Nothing beside the sender, nothing mid-screen: the world stays fully visible (no veil, no blur).
//  - NOTIFICATIONS: slim notes that slide in under the stack ("(portrait) Olla sent a letter · “Bread”"), up to
//    three, newest on top; after ~6 s each one tucks itself into the column.
// The old "compact card" API (letters.openCompact / closeCompact / moveCompact / compactId ...) is kept as an alias:
// it opens the letter in the inbox pane; an anchor is accepted and ignored.
// Pure DOM. Built by ui.js (createUI), which owns the letters; docs/ui.md "Mail" has the game-side contract.

import { h, add, paper, hash, sealSVG, heraldry, INK } from './paper.js';
import { iconSlot } from './icon-slots.js';

const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const TOAST_MS = 6000, MAX_TOASTS = 3, MAX_NOTES = 40;
const CHEVRON0 = '<svg viewBox="0 0 16 10" aria-hidden="true"><path d="M2 2.2l6 5.4 6-5.4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const CROSS0 = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 2.5l7 7M9.5 2.5l-7 7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
// §24: the pop-comic icons when the set exists (icon-slots.js), else these
const CHEVRON = () => iconSlot('chevron', 14, CHEVRON0), CROSS = () => iconSlot('close', 14, CROSS0);

// what kind of note a letter makes, and the words for it
export function noteKind(L = {}) {
  const f = L.from || {}, k = String(L.kind || '').toLowerCase();
  if (k === 'election' || k === 'vote' || k === 'ballot') return 'election';
  if (f.kind === 'ministry' || k === 'ministry' || k === 'notice') return 'ministry';
  if (f.kind === 'neighbour' || k === 'envoy') return 'envoy';
  return 'letter';
}
const VERB = { letter: 'sent a letter', ministry: 'posted a notice', envoy: 'sent an envoy', election: 'held a vote' };
export function ago(t, now = Date.now()) {
  const s = Math.max(0, (now - t) / 1000);
  if (s < 50) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} d ago`;
}

// §24 (Sueda, 2026-10-04 pm): every letter offers exactly TWO clear choices; "not now" (or "later", "no") is a small quiet
// link, never a third chip. Two options that say the same thing (the same first three words) keep the first one only
// when a third, different one can take its place.
const NOPE = /^(not now|not yet|later|maybe later|no\b|no thanks|decline|ignore|finish first)/i;
export function letterChoices(options = []) {
  const all = (options || []).filter(o => o && (o.label || o.says));
  const txt = o => String(o.label || o.says);
  const quiet = all.find(o => NOPE.test(txt(o))) || null;
  const pos = all.filter(o => !NOPE.test(txt(o)));
  const key = o => txt(o).toLowerCase().split(/\s+/).slice(0, 3).join(' ');
  const two = [];
  for (const o of pos) { if (two.length >= 2) break; if (two.some(t => key(t) === key(o)) && pos.filter(p => !two.includes(p) && p !== o && !two.some(t => key(t) === key(p))).length) continue; two.push(o); }
  return { two, quiet };
}

export function createMail({ layer, stack, L, fire, cb, getPortrait, onReply, onDismissNote, minister = null, onWriteBack = null }) {
  // ======================= portraits =======================
  // letter.portrait (a dataURL) > letter.from.portrait > getPortrait(senderId, letter) (a string, or a Promise of
  // one) > ui.setPortrait(senderId, src) later > the sender's wax seal (or shield, or the Ministry's scales).
  // Only folk have faces (§15): nations keep their shields, the Ministry its scales, "the folk" their seal.
  const pcache = new Map();              // senderId -> src | Promise
  const pkey = Lt => String((Lt.from && Lt.from.id) ?? '');
  const FACELESS = new Set(['neighbour', 'ministry', 'folk']);
  function srcById(key, Lt = null) {
    const c = pcache.get(key);
    if (typeof c === 'string') return c;
    if (c) return null;                  // pending
    if (typeof getPortrait !== 'function' || !key) return null;
    let v = null; try { v = getPortrait(key, Lt); } catch (e) { console.error('[ui] getPortrait', e); }
    if (typeof v === 'string' && v) { pcache.set(key, v); return v; }
    if (v && typeof v.then === 'function') {
      pcache.set(key, v);
      v.then(s => { if (typeof s === 'string' && s) setPortrait(key, s); else if (pcache.get(key) === v) pcache.delete(key); })
        .catch(() => { if (pcache.get(key) === v) pcache.delete(key); });
    }
    return null;
  }
  function srcOf(Lt) {
    const f = Lt.from || {}, key = pkey(Lt);
    const own = Lt.portrait || f.portrait;
    if (own) { if (key) pcache.set(key, own); return own; }
    if (FACELESS.has(f.kind)) return null;
    return srcById(key, Lt);
  }
  const waxOf = Lt => {
    const f = Lt.from || {};
    if (f.kind === 'neighbour') return heraldry(f.id, f.species).colour;
    if (f.kind === 'ministry') return INK.ink;
    return INK.red;
  };
  const imgTag = src => `<img src="${String(src).replace(/"/g, '&quot;')}" alt="" draggable="false">`;
  // the cameo: the portrait pressed into a disc of wax; without one, the sender's own seal
  function cameoInner(Lt, size) {
    const src = srcOf(Lt);
    if (!src) return { html: L.seal(Lt, size), portrait: false };
    return { html: sealSVG(waxOf(Lt), '', size, hash(pkey(Lt)) % 97 + 3) + imgTag(src), portrait: true };
  }
  function cameo(Lt, size) {
    const { html, portrait } = cameoInner(Lt, size);
    const el = h('span.ag-cameo' + (portrait ? '.has-portrait' : ''), { html, 'data-pkey': pkey(Lt), 'aria-hidden': 'true', style: { '--s': size + 'px' } });
    el._letter = Lt; el._size = size;
    return el;
  }
  // a folk's face without a letter (the agent card header): the painted portrait in a paper ring, else `fallback` (html)
  function face(agentId, size, fallback = '') {
    const key = String(agentId ?? '');
    const el = h('span.ag-face', { 'data-pkey': key, 'aria-hidden': 'true', style: { '--s': size + 'px' } });
    el._fallback = fallback; el._face = true;
    const src = key ? srcById(key) : null;
    el.innerHTML = src ? imgTag(src) : fallback; el.classList.toggle('has-portrait', !!src);
    return el;
  }
  function setPortrait(senderId, src) {
    const key = String(senderId);
    if (src) pcache.set(key, src); else pcache.delete(key);
    for (const el of document.querySelectorAll('.ag-cameo, .ag-face')) {
      if (el.dataset.pkey !== key) continue;
      if (el._face) { el.innerHTML = src ? imgTag(src) : el._fallback; el.classList.toggle('has-portrait', !!src); continue; }
      if (!el._letter) continue;
      const { html, portrait } = cameoInner(el._letter, el._size);
      el.innerHTML = html; el.classList.toggle('has-portrait', portrait);
    }
  }

  // ======================= the chevron under the stack =======================
  const chev = h('button.ag-stack__more', { type: 'button', hidden: true, 'aria-label': 'Recent letters and notices', 'aria-expanded': 'false', title: 'recent letters and notices', html: CHEVRON() + '<i class="ag-stack__new" hidden></i>' });
  layer.append(chev);

  // ======================= notifications (toasts) + the column =======================
  const notes = [];                       // newest first: { id, letterId, kind, name, verb, subject, at, read, letter, toast, timer }
  let noteN = 0;
  const toastsEl = h('div.ag-notes', { 'aria-live': 'polite', 'aria-label': 'New letters' });
  layer.append(toastsEl);
  const letterOf = n => (n.letterId != null && L.get(n.letterId)) || n.letter || null;
  const isRead = n => { const Lt = n.letterId != null ? L.get(n.letterId) : null; return Lt ? !!Lt.read : !!n.read; };

  function noteText(n, { time = false } = {}) {
    return h('span.ag-note__txt', null,
      h('span.ag-note__who', null, h('b', null, n.name), ' ', h('i', null, n.verb)),
      n.subject ? h('span.ag-note__subj', null, `“${n.subject}”`) : null,
      time ? h('span.ag-note__time', { 'data-at': String(n.at) }, ago(n.at)) : null);
  }
  function makeToast(n) {
    const Lt = letterOf(n) || { id: n.id, from: n.from || { name: n.name } };
    const main = h('button.ag-note__main', { type: 'button', 'aria-label': `${n.name} ${n.verb}${n.subject ? ': ' + n.subject : ''}. Open it.`,
      on: { click: e => { e.currentTarget.blur(); click(n, 'toast'); } } }, cameo(Lt, 36), noteText(n));
    const x = h('button.ag-note__x', { type: 'button', 'aria-label': 'Dismiss', title: 'dismiss', html: CROSS(), on: { click: e => { e.stopPropagation(); e.currentTarget.blur(); collapse(n, true); } } });
    const p = paper('ag-note', hash(n.id) % 89 + 11, { amp: 1.3, n: 26 });
    add(p.sheet, main, x);
    p.wrap.dataset.note = n.id;
    p.wrap.addEventListener('pointerenter', () => pause(true));
    p.wrap.addEventListener('pointerleave', () => pause(false));
    return p.wrap;
  }
  let paused = false;
  function pause(on) {
    paused = on;
    for (const n of notes) if (n.toast) { clearTimeout(n.timer); if (!on) arm(n, 2200); }
  }
  function arm(n, ms = TOAST_MS) { clearTimeout(n.timer); n.timer = setTimeout(() => { if (!paused) collapse(n); else arm(n, 1500); }, ms); }
  // a toast tucks itself into the column (it flies to the chevron), or is dismissed outright (×)
  function collapse(n, dismiss = false) {
    clearTimeout(n.timer);
    const t = n.toast; n.toast = null;
    if (dismiss) { remove(n.id); return; }
    renderColumn(); badge();
    if (!t || !t.isConnected) return;
    if (reduceMotion()) { t.remove(); ping(); return; }
    const tr = t.getBoundingClientRect(), cr = (chev.hidden ? stack : chev).getBoundingClientRect();
    const dx = cr.left + cr.width / 2 - (tr.left + tr.width / 2), dy = cr.top + cr.height / 2 - (tr.top + tr.height / 2);
    t.style.pointerEvents = 'none';
    const a = t.animate([{ transform: 'none', opacity: 1 }, { transform: `translate(${dx * .55}px, ${dy}px) scale(.28)`, opacity: 0 }], { duration: 520, easing: 'cubic-bezier(.55,0,.35,1)', fill: 'forwards' });
    a.finished.then(() => { t.remove(); ping(); }).catch(() => t.remove());
  }
  function ping() { chev.classList.remove('is-ping'); void chev.offsetWidth; chev.classList.add('is-ping'); }

  function push(o = {}) {
    const Lt = o.letter || (o.letterId != null ? L.get(o.letterId) : null);
    const kind = o.kind || (Lt ? noteKind(Lt) : 'letter');
    const who = Lt ? L.who(Lt) : null;
    const id = o.id || (o.letterId != null ? 'n:' + o.letterId : Lt ? 'n:' + Lt.id : 'nt' + (++noteN));
    const old = notes.findIndex(n => n.id === id);
    if (old >= 0) { const [p] = notes.splice(old, 1); clearTimeout(p.timer); if (p.toast) p.toast.remove(); }
    const n = { id, letterId: o.letterId ?? (Lt ? Lt.id : null), kind, letter: Lt ? { ...Lt } : (o.from || o.portrait ? { id, from: o.from || { name: o.name }, portrait: o.portrait } : null),
      name: o.name || (who && who.name) || 'Someone', verb: o.verb || VERB[kind] || VERB.letter, subject: o.subject ?? (Lt && Lt.subject) ?? '', at: o.at || Date.now(), read: !!o.read, from: o.from, toast: null, timer: 0 };
    notes.unshift(n);
    while (notes.length > MAX_NOTES) { const z = notes.pop(); clearTimeout(z.timer); z.toast && z.toast.remove(); }
    chev.hidden = false;
    if (o.toast !== false && !col.isOpen && !layer.classList.contains('is-title')) {
      n.toast = makeToast(n);
      toastsEl.prepend(n.toast);
      if (!reduceMotion()) n.toast.animate([{ transform: 'translateX(46px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 460, easing: 'cubic-bezier(.2,.9,.25,1)' });
      arm(n);
      // at most three: the oldest tucks itself away early
      const live = notes.filter(x => x.toast);
      live.slice(MAX_TOASTS).forEach(x => collapse(x));
    }
    renderColumn(); badge();
    return id;
  }
  const letterNote = (Lt, o = {}) => {
    if (Lt == null) return null;
    const x = typeof Lt === 'object' ? Lt : L.get(Lt);
    if (!x) return null;
    return push({ ...o, letter: L.get(x.id) || x, letterId: x.id });
  };
  function click(n, from) {
    clearTimeout(n.timer);
    if (n.toast) { const t = n.toast; n.toast = null; t.remove(); }
    cb.open(n.letterId ?? n.id, from);
    renderColumn(); badge();
  }
  function remove(id) {
    const i = notes.findIndex(n => n.id === id || (n.letterId != null && n.letterId === id));
    if (i < 0) return;
    const [n] = notes.splice(i, 1); clearTimeout(n.timer);
    if (n.toast) { const t = n.toast; n.toast = null; if (reduceMotion()) t.remove(); else t.animate([{ opacity: 1 }, { transform: 'translateX(40px)', opacity: 0 }], { duration: 240, easing: 'ease-in', fill: 'forwards' }).finished.then(() => t.remove()).catch(() => t.remove()); }
    fire(onDismissNote, n.letterId ?? n.id);
    renderColumn(); badge();
  }
  function dismissAll() {
    for (const n of notes.splice(0)) { clearTimeout(n.timer); n.toast && n.toast.remove(); fire(onDismissNote, n.letterId ?? n.id); }
    renderColumn(); badge();
  }
  function markRead(idOrNote, read = true) {
    const n = typeof idOrNote === 'object' ? idOrNote : notes.find(x => x.id === idOrNote || x.letterId === idOrNote);
    const lid = n ? n.letterId : idOrNote;
    if (lid != null && L.get(lid)) L.setRead(lid, read);
    else if (n) n.read = read;
    renderColumn(); badge();
  }
  // every note read, and every letter too (the stack's count goes to 0)
  function markAllRead() {
    for (const n of notes) if (!(n.letterId != null && L.get(n.letterId))) n.read = true;
    for (const Lt of L.unread()) L.setRead(Lt.id, true);
    renderColumn(); badge();
  }
  // a letter read elsewhere (the compact card, the game): its toast goes, its dot clears
  function letterRead(letterId) {
    const n = notes.find(x => x.letterId === letterId);
    if (n && n.toast) { clearTimeout(n.timer); const t = n.toast; n.toast = null; t.remove(); }
    renderColumn(); badge();
  }
  function clearToasts() { for (const n of notes) if (n.toast) { clearTimeout(n.timer); n.toast.remove(); n.toast = null; } badge(); }
  // a small red dot on the chevron while the column holds unread notes the player has not looked at
  let seenAt = 0;
  function badge() {
    const dot = chev.querySelector('.ag-stack__new');
    const fresh = notes.some(n => !n.toast && !isRead(n) && n.at > seenAt);
    dot.hidden = !fresh || col.isOpen;
    layer.classList.toggle('has-notes', notes.some(n => n.toast));
    chev.hidden = !notes.length && stack.hidden;
  }

  // ---------- the inbox column (the list; it expands into the reading pane, rd below) ----------
  const col = (() => {
    let el = null, list = null, sub = null, view = null, pinned = false, hoverT = 0, leaveT = 0, tick = 0;
    function build() {
      const p = paper('ag-mailcol', 977, { amp: 1.6, n: 30 });
      sub = h('span.ag-mailcol__sub');
      list = h('ul.ag-mailcol__list', { role: 'list' });
      view = h('div.ag-mailcol__view', null,
        h('header.ag-mailcol__head', null,
          h('div.ag-mailcol__title', null, 'Letters', sub),
          h('button.ag-mailcol__close', { type: 'button', 'aria-label': 'Close the mailbox', title: 'close (Esc)', html: CROSS(), on: { click: e => { e.currentTarget.blur(); close(); } } }),
          h('div.ag-mailcol__acts', null,
            h('button.ag-link.ag-mailcol__allread', { type: 'button', on: { click: e => { e.currentTarget.blur(); markAllRead(); } } }, 'mark all read'),
            h('span.sep', null, '·'),
            h('button.ag-link.ag-mailcol__clear', { type: 'button', on: { click: e => { e.currentTarget.blur(); dismissAll(); } } }, 'dismiss all'))),
        list,
        h('footer.ag-mailcol__foot', null,
          h('button.ag-link.ag-mailcol__all', { type: 'button', on: { click: e => { e.currentTarget.blur(); close(true); cb.seeAll(); } } }, 'see all at once'),
          h('span.ag-mailcol__tip', null, 'or shift-click the stack')));
      add(p.sheet, view);
      p.wrap.setAttribute('role', 'region'); p.wrap.setAttribute('aria-label', 'Your post');
      p.wrap.tabIndex = -1;
      p.wrap.addEventListener('pointerenter', () => clearTimeout(leaveT));
      p.wrap.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') leaveSoon(); });
      return p.wrap;
    }
    function item(n) {
      const read = isRead(n), Lt = letterOf(n) || { id: n.id, from: n.from || { name: n.name } };
      const dot = h('button.ag-mailcol__dot', { type: 'button', disabled: read || undefined, 'aria-label': read ? 'Read' : 'Mark read', title: read ? 'read' : 'mark read',
        on: { click: e => { e.stopPropagation(); e.currentTarget.blur(); markRead(n); } } });
      const x = h('button.ag-mailcol__x', { type: 'button', 'aria-label': 'Dismiss', title: 'dismiss', html: CROSS(), on: { click: e => { e.stopPropagation(); e.currentTarget.blur(); remove(n.id); } } });
      const main = h('button.ag-mailcol__main', { type: 'button', 'aria-label': `${read ? '' : 'Unread: '}${n.name} ${n.verb}${n.subject ? ', ' + n.subject : ''}, ${ago(n.at)}`,
        on: { click: e => { e.currentTarget.blur(); click(n, 'column'); } } }, cameo(Lt, 38), noteText(n));
      return h('li.ag-mailcol__item' + (read ? '.is-read' : '.is-unread'), { 'data-note': n.id }, main,
        h('span.ag-mailcol__side', null, h('span.ag-mailcol__time', { 'data-at': String(n.at) }, ago(n.at)), h('span.ag-mailcol__btns', null, dot, x)));
    }
    function render() {
      if (!el) return;
      const unread = notes.filter(n => !isRead(n)).length;
      sub.textContent = notes.length ? (unread ? ` · ${unread} unread` : ' · all read') : '';
      list.replaceChildren(...(notes.length ? notes.map(item) : [h('li.ag-mailcol__empty', null, 'Nothing new. All caught up.')]));
      el.querySelector('.ag-mailcol__allread').disabled = !unread || undefined;
      el.querySelector('.ag-mailcol__clear').disabled = !notes.length || undefined;
      rd.sync();
    }
    // pinned top-right, directly under the stack (and its chevron), whatever the stack's size on this screen; the
    // inbox only grows downward from there (agora.css reads --ag-inbox-top; its calc is the fallback)
    // §24: "when the mailbox is open the mailbox icon should disappear and we should only have the list": the list (and
    // the letter read in it) takes the mailbox's own place, top-right (css/aloud.css hides the icon while .is-mailcol)
    function place() { layer.style.removeProperty('--ag-inbox-top'); }
    addEventListener('resize', () => { if (el) place(); });
    function ensure() {
      clearTimeout(hoverT); clearTimeout(leaveT);
      if (el) { place(); return false; }
      clearToasts();
      place();
      el = build(); layer.append(el); render();
      seenAt = Date.now();
      chev.setAttribute('aria-expanded', 'true'); layer.classList.add('is-mailcol');
      tick = setInterval(() => el && el.querySelectorAll('.ag-mailcol__time').forEach(t => { t.textContent = ago(+t.dataset.at); }), 30000);
      badge();
      return true;
    }
    function open({ pin = true } = {}) {
      if (pin) pinned = true;
      if (!ensure()) { chev.setAttribute('aria-expanded', 'true'); return; }
    }
    function close(now = false) {
      clearTimeout(hoverT); clearTimeout(leaveT); clearInterval(tick);
      pinned = false;
      if (!el) return; const e = el; el = null; view = null;
      rd._gone();
      chev.setAttribute('aria-expanded', 'false'); layer.classList.remove('is-mailcol', 'is-mread');
      if (document.activeElement && e.contains(document.activeElement)) document.activeElement.blur();
      if (now || reduceMotion()) e.remove(); else { e.style.pointerEvents = 'none'; e.classList.add('is-out'); setTimeout(() => e.remove(), 260); }
      badge();
    }
    function leaveSoon() { clearTimeout(leaveT); if (pinned) return; leaveT = setTimeout(() => { if (!pinned) close(); }, 450); }
    // hovering the stack (a mouse) opens it unpinned; leaving both closes it again; the chevron pins it
    // (§24: no hover-open any more: the mailbox icon hides while the list is open, so a hover would flicker; a click opens it)
    chev.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') clearTimeout(leaveT); });
    chev.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') leaveSoon(); });
    chev.addEventListener('click', e => { e.currentTarget.blur(); if (el && pinned) close(); else open({ pin: true }); });
    return { open, close, render, ensure, toggle() { el && pinned ? close() : open(); }, get isOpen() { return !!el; }, get pinned() { return pinned; }, set pinned(v) { pinned = !!v; },
      get el() { return el; }, get view() { return view; }, stopHover() { clearTimeout(hoverT); } };
  })();
  const renderColumn = () => col.render();

  // ======================= reading a letter: the inbox expands into a pane, in the same top-right place =======================
  // (§15) the stack, a note, a row, a folk's tag in the world: every letter is read here. The world stays visible.
  const rd = (() => {
    let cur = null;      // { id, box, body, answered, fromList }
    const order = () => L.all();                                   // the post, newest first (the column's order)
    function build(Lt) {
      const w = L.who(Lt);
      const { text, sign, signSub } = L.splitSign(Lt.body, w.name);
      const { two: opts, quiet } = letterChoices(Lt.options);
      // a Ministry notice has no face of its own: the minister who speaks for it is pressed beside the seal
      let mn = null;
      if ((Lt.from || {}).kind === 'ministry' && typeof minister === 'function') { try { mn = minister(); } catch (_) { mn = null; } }
      const all = order(), i = all.findIndex(x => x.id === Lt.id), n = all.length;
      const prevL = i > 0 ? all[i - 1] : null, nextL = i >= 0 && i < n - 1 ? all[i + 1] : null;
      const replies = opts.map(o => h('button.ag-reply', { type: 'button', disabled: Lt.resolved || undefined, on: { click: e => {
        if (Lt.resolved || !cur || cur.answered || cur.id !== Lt.id) return;
        const b = e.currentTarget; b.blur(); cur.answered = true;
        replies.forEach(x => { x.disabled = x !== b; }); b.setAttribute('aria-pressed', 'true');
        const id = Lt.id;
        onReply(Lt, o);
        setTimeout(() => { if (cur && cur.id === id) leave(); }, 1800);
      } } }, h('i', null, 'say'), h('span', null, o.label || o.says)));
      // the quiet "not now"
      const nope = quiet ? h('button.ag-link.ag-mread__nope', { type: 'button', disabled: Lt.resolved || undefined, on: { click: e => {
        if (Lt.resolved || !cur || cur.answered || cur.id !== Lt.id) return;
        e.currentTarget.blur(); cur.answered = true; replies.forEach(x => { x.disabled = true; });
        const id = Lt.id; onReply(Lt, quiet); setTimeout(() => { if (cur && cur.id === id) leave(); }, 1200);
      } } }, quiet.label || quiet.says) : null;
      // write back in her own words: to the resident (talk / minds), or a build said as a reply; the answer comes back here
      const thread = h('div.ag-mread__thread', { 'aria-live': 'polite' });
      const drawThread = () => { const T = (L.get(Lt.id) || Lt).thread || []; thread.replaceChildren(...T.map(m => h('div.ag-mread__msg' + (m.me ? '.is-me' : '') + (m.wait ? '.is-wait' : ''), null, h('b', null, m.me ? 'You' : m.who || w.name), h('span', null, m.text)))); thread.hidden = !T.length; };
      drawThread();
      const wInput = h('input.ag-mread__winput', { type: 'text', placeholder: `Write back to ${w.name}…`, 'aria-label': `Write back to ${w.name}`, autocomplete: 'off', spellcheck: true, enterKeyHint: 'send' });
      for (const ev of ['keydown', 'keyup', 'keypress']) wInput.addEventListener(ev, e => { if (e.code === 'Space' && !wInput.value) { if (ev === 'keydown' && !e.repeat) wInput.blur(); return; } e.stopPropagation(); if (ev === 'keydown' && e.key === 'Escape') { e.preventDefault(); wInput.blur(); } });
      const write = h('form.ag-mread__write', null, wInput, h('button.ag-mread__wsend', { type: 'submit', 'aria-label': 'Send', html: iconSlot('arrow-right', 20, '›') }));
      write.addEventListener('submit', async e => {
        e.preventDefault();
        const t = wInput.value.trim(); if (!t) return; wInput.value = '';
        const rec = L.get(Lt.id) || Lt; rec.thread = rec.thread || [];
        rec.thread.push({ me: true, text: t }); const wait = { who: w.name, text: '…', wait: true }; rec.thread.push(wait); drawThread();
        if (cur && cur.box === box) cur.answered = true;
        let r = null; try { r = typeof onWriteBack === 'function' ? await onWriteBack(rec, t) : null; } catch (_) { r = null; }
        const i2 = rec.thread.indexOf(wait); if (i2 >= 0) rec.thread.splice(i2, 1);
        const rt = r && (typeof r === 'string' ? r : r.text);
        if (rt) rec.thread.push({ who: (r && r.who) || w.name, text: String(rt) });
        if (box.isConnected) { drawThread(); requestAnimationFrame(() => { body.scrollTop = body.scrollHeight; }); }
      });
      const nav = (dir, other) => h('button.ag-link.ag-mread__' + dir, { type: 'button', disabled: !other || undefined,
        title: other ? `${dir === 'prev' ? 'newer' : 'older'}: ${L.who(other).name}${other.subject ? ' · “' + other.subject + '”' : ''} (${dir === 'prev' ? '←' : '→'})` : '',
        'aria-label': dir === 'prev' ? 'Previous letter' : 'Next letter', on: { click: e => { e.currentTarget.blur(); go(dir === 'prev' ? -1 : 1); } } },
        h('span', { html: dir === 'prev' ? iconSlot('arrow-left', 18, '‹') + ' prev' : 'next ' + iconSlot('arrow-right', 18, '›') }));
      const body = h('div.ag-mread__body', null,
        Lt.subject ? h('h2.ag-mread__subject', null, Lt.subject) : null,
        h('div.ag-mread__text', null, String(text || '').split(/\n\s*\n/).map(t => h('p', null, t))),
        sign ? h('div.ag-mread__sign' + (String(sign).length > 12 ? '.is-long' : ''), null, h('span.nm', null, sign), signSub ? h('span.sub', null, signSub) : null) : null,
        Lt.note ? h('div.ag-mread__note', { html: '<b>P.S.</b> ' + Lt.note }) : null,
        thread);
      const box = h('article.ag-mread', { 'data-id': Lt.id, 'aria-label': `A letter from ${w.name}` },
        h('nav.ag-mread__bar', null,
          h('button.ag-link.ag-mread__back', { type: 'button', title: 'back to the list (Esc)', on: { click: e => { e.currentTarget.blur(); back(); } } }, h('span', { html: iconSlot('arrow-left', 18, '‹') + ' all letters' })),
          h('span.ag-mread__nav', null, nav('prev', prevL), h('span.ag-mread__pos', null, i >= 0 ? `${i + 1} of ${n}` : ''), nav('next', nextL)),
          h('button.ag-mread__x', { type: 'button', 'aria-label': 'Close the inbox', title: 'close', html: CROSS(), on: { click: e => { e.currentTarget.blur(); col.close(); } } })),
        h('header.ag-mread__head', null, h('span.ag-mread__seal', null, cameo(Lt, 62), mn ? face(mn.id, 30, '') : null),
          h('div.ag-mread__id', null, h('div.ag-mread__from', null, w.name), (w.line || mn) ? h('div.ag-mread__line', null, mn && mn.name ? `sent by ${mn.name}, your minister` : w.line) : null),
          h('span.ag-mread__day', null, `Day ${Lt.day ?? 1}`)),
        body,
        (replies.length || nope) ? h('div.ag-mread__replies', null, replies, nope) : null,
        h('div.ag-mread__writewrap', null, write),
        h('footer.ag-mread__foot', null,
          h('span.ag-mread__aloud', { html: Lt.resolved ? 'answered' : 'or say it: hold <span class="ag-kbd">Space</span>' })),
        Lt.resolved ? h('div.ag-stamp.ag-mread__stamp', null, 'answered') : null);
      const upd = () => { fitSign(box); body.classList.toggle('is-more', body.scrollHeight - body.clientHeight - body.scrollTop > 6); };
      body.addEventListener('scroll', upd, { passive: true });
      return { box, body, upd };
    }
    // the signature stays on one line ("Ministry of Builds", never "Ministry of / Builds"): it moves left, then shrinks
    function fitSign(box) {
      const sg = box.querySelector('.ag-mread__sign'), nm = sg && sg.querySelector('.nm');
      if (!nm || !nm.isConnected || !sg.clientWidth) return;
      nm.style.fontSize = ''; sg.style.paddingLeft = ''; sg.style.textAlign = '';
      const room = () => sg.clientWidth - parseFloat(getComputedStyle(sg).paddingLeft || 0);
      if (nm.scrollWidth <= room() + .5) return;
      sg.style.paddingLeft = '0px'; sg.style.textAlign = 'right';
      let fs = parseFloat(getComputedStyle(nm).fontSize) || 19;
      while (nm.scrollWidth > room() + .5 && fs > 14) { fs -= 1; nm.style.fontSize = fs + 'px'; }
    }
    function open(LtOrId) {
      const Lt = typeof LtOrId === 'object' && LtOrId ? (L.get(LtOrId.id) || L.add(LtOrId)) : L.get(LtOrId);
      if (!Lt) return null;
      cb.beforeOpen();
      const fromList = cur ? cur.fromList : (col.isOpen && !col.el.classList.contains('is-reading'));
      col.ensure(); col.pinned = true;
      const wrap = col.el, view = col.view;
      const v = build(Lt);
      const old = wrap.querySelector('.ag-mread');
      if (old) old.replaceWith(v.box); else wrap.querySelector('.ag-sheet').append(v.box);
      view.hidden = true;
      const was = wrap.classList.contains('is-reading');
      wrap.classList.add('is-reading'); layer.classList.add('is-mread');
      cur = { id: Lt.id, box: v.box, body: v.body, answered: false, fromList };
      v.upd(); requestAnimationFrame(v.upd); document.fonts && document.fonts.ready.then(() => { if (cur && cur.box === v.box) v.upd(); });
      if (!reduceMotion()) {
        if (!was) wrap.animate([{ transform: 'translateY(-10px) scaleY(.96)', opacity: .4 }, { transform: 'none', opacity: 1 }], { duration: 300, easing: 'cubic-bezier(.2,.8,.2,1)' });
        else v.box.animate([{ opacity: 0, transform: 'translateX(10px)' }, { opacity: 1, transform: 'none' }], { duration: 240, easing: 'cubic-bezier(.2,.8,.2,1)' });
      }
      if (!Lt.read) L.setRead(Lt.id, true);
      letterRead(Lt.id);
      requestAnimationFrame(() => { if (cur && cur.box === v.box && !(document.activeElement && /INPUT|TEXTAREA/.test(document.activeElement.tagName))) wrap.focus({ preventScroll: true }); });
      return Lt.id;
    }
    // the reading pane folds back into the list (it stays pinned)
    function back() {
      if (!cur || !col.el) { cur = null; return; }
      const wrap = col.el; cur = null;
      wrap.querySelector('.ag-mread')?.remove();
      col.view.hidden = false; col.render();
      wrap.classList.remove('is-reading'); layer.classList.remove('is-mread');
      if (!reduceMotion()) wrap.animate([{ opacity: .5 }, { opacity: 1 }], { duration: 200 });
    }
    // Esc / a reply: back to the list when the letter was opened from it, else the inbox folds away
    function leave() { if (!cur) return; if (cur.fromList) back(); else col.close(); }
    function go(d) {
      if (!cur) return;
      const all = order(), i = all.findIndex(x => x.id === cur.id), t = all[i + d];
      if (t) cb.open(t.id, d > 0 ? 'next' : 'prev');
    }
    function nextUnread() {
      const u = L.unread().filter(x => !cur || x.id !== cur.id);
      if (!u[0]) { leave(); return; }
      cb.open(u[0].id, 'next');
    }
    // ↓ in the pane: read on while there is more below, then the next letter down the list
    function arrow() { if (!cur) return; const b = cur.body; if (b.scrollHeight - b.clientHeight - b.scrollTop > 6) b.scrollBy({ top: 90, behavior: reduceMotion() ? 'auto' : 'smooth' }); else go(1); }
    function resolved(id) {
      if (!cur || cur.id !== id) return;
      cur.box.querySelectorAll('.ag-reply').forEach(b => { b.disabled = b.getAttribute('aria-pressed') !== 'true'; });
      if (!cur.box.querySelector('.ag-stamp')) cur.box.append(h('div.ag-stamp.ag-mread__stamp', null, 'answered'));
      const al = cur.box.querySelector('.ag-mread__aloud'); if (al) al.textContent = 'answered';
    }
    // the post changed (a letter arrived, dismissed): keep "n of m" and prev / next true
    function sync() {
      if (!cur) return;
      const all = order(), i = all.findIndex(x => x.id === cur.id), n = all.length;
      const pos = cur.box.querySelector('.ag-mread__pos'); if (pos) pos.textContent = i >= 0 ? `${i + 1} of ${n}` : '';
      const pv = cur.box.querySelector('.ag-mread__prev'), nx = cur.box.querySelector('.ag-mread__next');
      if (pv) pv.disabled = !(i > 0) || undefined;
      if (nx) nx.disabled = !(i >= 0 && i < n - 1) || undefined;
    }
    return { open, back, leave, go, nextUnread, arrow, resolved, sync, _gone() { cur = null; layer.classList.remove('is-mread'); },
      get id() { return cur ? cur.id : null; }, get isOpen() { return !!cur; }, get el() { return cur && col.el ? col.el : null; } };
  })();

  return {
    setPortrait, cameo, face, chevron: chev,
    notify: { letter: letterNote, push, dismiss: remove, dismissAll, markRead, markAllRead, clearToasts, _letterRead: letterRead,
      get list() { return notes.map(({ toast, timer, letter, ...n }) => ({ ...n, read: isRead(n), toast: !!toast })); },
      get toasts() { return notes.filter(n => n.toast).length; },
      column: col },
    reader: rd,
    // the old compact-card API, now the inbox pane (anchor / move are accepted and ignored: §15, nothing beside the sender)
    compact: { open: Lt => rd.open(Lt), close: () => rd.leave(), move() {}, next: () => rd.nextUnread(), arrow: () => rd.arrow(), resolved: id => rd.resolved(id),
      get id() { return rd.id; }, get isOpen() { return rd.isOpen; }, get el() { return rd.el; } },
    _badge: badge, _render: renderColumn
  };
}
