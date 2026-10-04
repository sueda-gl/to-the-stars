// "Call the Ministry" (ART_DIRECTION §24): a pop button under the mailbox, and a compact call card in the pop style
// with the minister's painted portrait. The minister answers in babble (ui/babble.js: high, cute WebAudio chirps,
// timed to the text) while the English "live translation" types itself as a subtitle. She speaks to it directly: hold
// Space (the game routes the transcript here while the call is open), hold the mic in the card, or type.
// Pure DOM; game/ministry.js wires the answers (the minds' talk when live, the Ministry's canned advice otherwise).
//
//   const call = createCall({ layer, onAsk: text => Promise<string>|string, onMic: down => {}, caller: () => ({ id, name, line, portrait }) })
//   call.open() · call.close() · call.say(text, { source }) · call.answer(text) · call.isOpen · call.el · call.babble · call.log

import { h } from './paper.js';
import { iconSlot } from './icon-slots.js';
import { createBabble } from './babble.js';

export function createCall({ layer, onAsk = null, onMic = null, caller = () => null, onOpen = null, onClose = null } = {}) {
  const babble = createBabble();
  const log = [];          // [{ who: 'you' | 'minister', text }]
  let el = null, sub = null, you = null, input = null, faceEl = null, nameEl = null, lineEl = null, typing = 0, open = false, busy = 0, micBtn = null;

  // the button under the mailbox
  const btn = h('button.ag-callbtn', { type: 'button', 'aria-label': 'Call the Ministry', title: 'call the Ministry',
    html: iconSlot('ministry', 34, '☎') + '<span>Call the Ministry</span>', on: { click: e => { e.currentTarget.blur(); toggle(); } } });
  layer.append(btn);

  function build() {
    faceEl = h('span.ag-call__face');
    nameEl = h('div.ag-call__name');
    lineEl = h('div.ag-call__line');
    sub = h('div.ag-call__sub', { 'aria-live': 'polite' });
    you = h('div.ag-call__you');
    input = h('input.ag-call__input', { type: 'text', placeholder: 'ask the Ministry…', 'aria-label': 'Ask the Ministry', autocomplete: 'off', spellcheck: false, enterKeyHint: 'send' });
    for (const ev of ['keydown', 'keyup', 'keypress']) input.addEventListener(ev, e => {
      if (e.code === 'Space' && !input.value) { if (ev === 'keydown' && !e.repeat) input.blur(); return; }   // Space on an empty line = push-to-talk
      e.stopPropagation();
      if (ev === 'keydown' && e.key === 'Escape') { e.preventDefault(); close(); }
    });
    const form = h('form.ag-call__form', null, input, h('button.ag-call__send', { type: 'submit', 'aria-label': 'Send', html: iconSlot('arrow-right', 22, '›') }));
    form.addEventListener('submit', e => { e.preventDefault(); const t = input.value.trim(); if (!t) return; input.value = ''; say(t, { source: 'typed' }); });
    micBtn = h('button.ag-call__mic', { type: 'button', 'aria-label': 'Hold to speak', title: 'hold to speak (or hold Space)', html: iconSlot('mic', 26, '🎙') });
    let down = false;
    micBtn.addEventListener('pointerdown', e => { if (e.button !== 0) return; e.preventDefault(); down = true; micBtn.classList.add('is-on'); if (onMic) onMic(true); });
    const up = () => { if (!down) return; down = false; micBtn.classList.remove('is-on'); if (onMic) onMic(false); };
    micBtn.addEventListener('pointerup', up); micBtn.addEventListener('pointerleave', up); micBtn.addEventListener('pointercancel', up);
    const x = h('button.ag-call__x', { type: 'button', 'aria-label': 'Hang up', title: 'hang up (Esc)', html: iconSlot('close', 22, '×'), on: { click: e => { e.currentTarget.blur(); close(); } } });
    el = h('section.ag-call', { role: 'dialog', 'aria-label': 'A call with the Ministry' },
      h('header.ag-call__head', null, faceEl, h('div.ag-call__id', null, nameEl, lineEl), h('span.ag-call__live', null, h('i'), 'on the line'), x),
      h('div.ag-call__body', null, you, sub, h('div.ag-call__tr', null, 'live translation')),
      h('div.ag-call__bar', null, micBtn, form));
    layer.append(el);
  }
  function dress() {
    const c = caller() || {};
    nameEl.textContent = c.name || 'Ministry of Builds';
    lineEl.textContent = c.line || 'the Ministry desk';
    faceEl.innerHTML = c.portrait ? `<img src="${String(c.portrait).replace(/"/g, '&quot;')}" alt="">` : iconSlot('ministry', 52, '');
    faceEl.classList.toggle('has-portrait', !!c.portrait);
  }
  function openCall() {
    if (!el) build();
    babble.unlock();
    dress();
    el.hidden = false; el.classList.remove('is-out'); void el.offsetWidth; el.classList.add('is-on');
    open = true; layer.classList.add('is-calling'); btn.setAttribute('aria-pressed', 'true');
    requestAnimationFrame(() => input && input.focus({ preventScroll: true }));
    if (typeof onOpen === 'function') onOpen();
    if (!log.length) setTimeout(() => { if (open && !log.length) answer(greeting()); }, 350);
  }
  const greeting = () => { const c = caller() || {}; return c.greeting || 'Hello, leader! Ministry here. Ask me what to build next.'; };
  function close() {
    if (!el || !open) return;
    open = false; layer.classList.remove('is-calling'); btn.removeAttribute('aria-pressed');
    babble.stop(); clearInterval(typing);
    if (document.activeElement === input) input.blur();
    el.classList.remove('is-on'); el.classList.add('is-out');
    setTimeout(() => { if (!open && el) el.hidden = true; }, 260);
    if (typeof onClose === 'function') onClose();
  }
  function toggle() { open ? close() : openCall(); }

  // the subtitle types itself in step with the babble's syllables
  function answer(text) {
    const t = String(text || '').trim(); if (!t || !el) return;
    log.push({ who: 'minister', text: t });
    clearInterval(typing);
    const plan = babble.speak(t, { seed: (caller() || {}).seed });
    sub.textContent = ''; sub.classList.remove('is-thinking');
    el.classList.add('is-speaking');
    const t0 = performance.now(), marks = plan.marks;
    let i = 0;
    typing = setInterval(() => {
      const now = (performance.now() - t0) / 1000;
      while (i < marks.length && marks[i].at <= now) i++;
      sub.textContent = t.slice(0, i);
      if (i >= marks.length) { clearInterval(typing); sub.textContent = t; setTimeout(() => el && el.classList.remove('is-speaking'), 250); }
    }, 30);
  }
  async function say(text, { source = 'typed' } = {}) {
    const t = String(text || '').trim(); if (!t) return false;
    if (!open) openCall();
    log.push({ who: 'you', text: t, source });
    you.textContent = `“${t}”`;
    sub.textContent = ''; sub.classList.add('is-thinking');
    const my = ++busy;
    babble.speak('hm…', { seed: (caller() || {}).seed, rate: 1.3 });
    let r = null;
    try { r = typeof onAsk === 'function' ? await onAsk(t, { source }) : null; } catch (_) { r = null; }
    if (my !== busy || !open) return true;
    answer(r || 'Sorry, the line crackled. Could you say that again?');
    return true;
  }
  return { open: openCall, close, toggle, say, answer, dress, get isOpen() { return open; }, get el() { return el; }, button: btn, babble, get log() { return log.slice(); },
    setListening(on) { if (micBtn) micBtn.classList.toggle('is-on', !!on); if (input) input.placeholder = on ? 'listening…' : 'ask the Ministry…'; },
    setPartial(t) { if (you && open) you.textContent = t ? `“${t}…”` : ''; } };
}
