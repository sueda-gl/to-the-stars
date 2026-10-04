// ALOUD game UI: "the world is the interface" (ART_DIRECTION §3, §24). At rest the screen shows only the world, the
// mailbox (top-right, when letters exist), a small voice mark (bottom-centre) and the rewards tally (top-left; the
// settlement name is gone, §24). All text is Montserrat (css/aloud.css); the onboarding lives in ONE panel (guide.js). Everything else is transient (caption, notices, hints, director line) or on demand
// (the letter you are reading, the ledger, the agent card). Styles: css/agora.css. API: docs/ui.md.
// Pure DOM; no THREE, no sim imports. Everything the game needs to know comes back through the callbacks.

import { h, add, paper, hash, esc, rng, SPECIES, senderInk, sealSVG, shieldSVG, envelopeSVG, scribbleSVG, GLYPH,
  MIC_SVG, ENV_BACK_SVG, ENV_POCKET_SVG, ENV_FLAP_SVG, FLOURISH_SVG } from './paper.js';
import { traitMeaning, fleetLine, ordWord, jobOf, atPlace, ventureOf, ventureLine, plainReply } from './words.js';
import { createMail, letterChoices } from './mail.js';
import { createGuide, ONBOARDING_STEPS } from './guide.js';
import { iconSlot, loadIcons } from './icon-slots.js';
import { createTitle, TITLE_DEFAULT } from './title.js';
import { setFont as applyFont, fontFromURL, normFont, currentFont, FONT_SETS, FONT_IDS } from './fonts.js';
export { FONT_SETS, FONT_IDS } from './fonts.js';
export { TRAIT_MEANINGS, traitMeaning, fleetLine, plainReply, jobOf } from './words.js';

export const SKILLS = ['building', 'baking', 'farming', 'crafting', 'trading', 'diplomacy', 'art', 'scouting'];
export const STAGES = ['camp', 'hamlet', 'village', 'town', 'civilisation'];
// the two phrases the welcome letter offers (the juror's first sentence), and the idle hint rotation
export const EXAMPLES = ['A giant lighthouse on the cliff', 'A rubber duck in the lake'];
export const DEFAULT_CHIPS = [{ label: 'A giant lighthouse on the cliff', hero: true }, 'A rubber duck in the lake', 'A dragon statue in the square', 'Build a house in the middle', 'A windmill there'];
export const MORE_CHIPS = ['Who here is good at baking?', 'Send bread to our neighbours', 'Show me the neighbours', 'Call a meeting', 'Let’s go to the moon'];

export const moodWord = m => m == null ? 'unknown' : m < 15 ? 'furious' : m < 30 ? 'miserable' : m < 45 ? 'grumbling' : m < 60 ? 'content' : m < 78 ? 'cheerful' : 'delighted';
const moodInk = m => m < 30 ? '#e0503f' : m < 45 ? '#d9822b' : m < 60 ? '#b9a03a' : '#3f8f5a';
export const attitudeWord = (a, allied) => allied ? 'allied' : a == null ? 'unknown' : a < 20 ? 'hostile' : a < 35 ? 'cold' : a < 50 ? 'wary' : a < 65 ? 'cordial' : 'warm';
const attInk = (a, allied) => allied ? '#0078bf' : a < 35 ? '#e0503f' : a < 50 ? '#d9822b' : a < 65 ? '#b9a03a' : '#3f8f5a';
const cap = s => s ? s[0].toUpperCase() + s.slice(1) : '';
const article = w => /^[aeiou]/i.test(w) ? 'an' : 'a';
const ORD = ['', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth', 'eleventh', 'twelfth'];
const dayWords = d => ORD[d] ? `the ${ORD[d]} day` : `day ${d}`;
const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const sleep = ms => new Promise(r => setTimeout(r, ms));
function leave(el, cls = 'is-out', ms = 450) {          // remove after an exit animation (or at once under reduced motion)
  if (!el || !el.isConnected) return;
  if (reduceMotion()) { el.remove(); return; }
  el.classList.add(cls); setTimeout(() => el.remove(), ms);
}
const emph = s => esc(s).replace(/\*([^*]+)\*/g, '<em>$1</em>');
const isField = t => t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
const toStr = c => typeof c === 'string' ? { label: c, says: c } : { label: c.label, says: c.says || c.label };

export function createUI({ root = document.body, onCommand, onLetterOption, onAgentAction, onStart, onMic, onOnboardingDone, onTalk, bubble, lookup = {},
  letterVariant = 'a', paintChrome = false, hintIdleMs = 30000, holdMs = 200,
  // the mail system (ART_DIRECTION §14, docs/ui.md "Mail"): the game glides to the sender, then calls letters.openCompact
  onOpenLatest, onNotificationClick, onNextLetter, onLetterRead, onNotificationDismiss, getPortrait, notifyOnArrive = true, longPressMs = 520,
  onWriteBack = null,   // §24: (letter, text) -> Promise<string | { who, text }>: her own words back to the sender
  // the typeface set (js/ui/fonts.js, web/fonts.html): 'now' (Instrument Serif) | 'A'..'G'; ?font=A in the URL wins
  font = null } = {}) {
  const fire = (fn, ...a) => { if (typeof fn !== 'function') return; try { return fn(...a); } catch (e) { console.error('[ui]', e); } };
  const agentOf = id => (lookup.agent && id != null ? lookup.agent(id) : null) || null;
  const layer = h('div.ag-ui'); root.append(layer);
  { const f = fontFromURL() || normFont(font); if (f) applyFont(f); }
  loadIcons();                                      // §24: the pop-comic icon set, when web/js/ui/icons.js exists (icon-slots.js)
  // the game never shows the reference's editions pill / Gouache settings / Up close (labs pass paintChrome:true)
  const setPaintChrome = on => document.body.classList.toggle('ag-no-paint-chrome', !on);
  setPaintChrome(paintChrome);
  let seedN = 100; const seed = () => ++seedN;
  const hooks = { listening: null };                // late-bound links between parts built in order (talk -> voiceBar)
  const S = { name: '', stage: 'camp', day: 1, prosperity: 0, prosperityMax: 100, resources: {}, honour: null, minister: null, neighbours: [], offline: false,
    society: [],     // ART_DIRECTION §18: the minds' quiet lines (a conversation ended, a bond moved, a reflection, the director's hand), ledger only
    mind: null };    // { mode: 'live'|'mock'|'rules', cast, perHour } from the mind loop's status, shown as one line in the ledger's foot
  // a command from any source (typed, an example phrase, a hint): caption it, tell the game, reset the idle clock
  function command(text, source, who = 'you said') {
    voiceBar.setCaption(text, true, { who });
    voiceBar._used();
    idle.poke();
    fire(onCommand, text, source);
  }

  // ======================= title card =======================
  // ART_DIRECTION §23: "Aloud" (Melodrama 600, white), the title on top, her planet alone below it, Begin as quiet white
  // text with a hairline underline. The look lives in ui/title.js + css/title.css (docs/title.md); this keeps the old API
  // (show / hide / start / visible). Parented to document.body: the `.ag-ui.is-title > :not(.ag-title)` rule hides the
  // layer's children while the title is up, and `.tt` (z 60) sits above the layer.
  const titleCard = (() => {
    let t = null;
    function show({ begin = 'Begin', name = TITLE_DEFAULT.name, font = TITLE_DEFAULT.font } = {}) {
      if (!t) t = createTitle({ parent: document.body, name, font, begin, enterKey: false,
        onBegin: () => { layer.classList.remove('is-title'); fire(onStart); } });
      else t.set({ name, font });
      layer.classList.add('is-title'); t.show();          // t.show() also adds body.ag-title-on (hides the paint chrome)
    }
    function start() { if (t && t.visible) t.start(); }    // hides + onBegin
    function hide() { if (!t) return; layer.classList.remove('is-title'); t.hide(); }
    return { show, hide, start, get visible() { return !!t && t.visible; }, get el() { return t ? t.el : null; } };
  })();

  // ======================= the settlement name (top-left, no card; click = ledger) =======================
  const place = (() => {
    const name = h('span.ag-place__name');
    const honour = h('span.ag-place__honour', { hidden: true });
    const el = h('button.ag-place', { type: 'button', hidden: true, 'aria-label': 'Open the ledger (Tab)', title: 'the ledger · Tab', on: { click: () => ledger.toggle() } }, name, honour);
    layer.append(el);
    function render() {
      el.hidden = true; name.textContent = S.name;     // §24: "delete the ugly agora text from left top" (the ledger stays on Tab)
      honour.hidden = !S.honour; honour.textContent = S.honour || '';
    }
    return { el, render, stampHonour() { honour.classList.remove('is-new'); void honour.offsetWidth; honour.classList.add('is-new'); } };
  })();

  // ======================= voice: a small mark, a typed line, the live caption, the hint line =======================
  const voiceBar = (() => {
    const wave = h('span.ag-wave', { 'aria-hidden': 'true' }, Array.from({ length: 5 }, () => h('i')));
    const mark = h('button.ag-mark', { type: 'button', 'aria-label': 'Hold to speak, click to write', html: iconSlot('mic', 30, MIC_SVG) + iconSlot('mic-live', 30, '') });
    const lbl = h('span.ag-mark__lbl', { 'aria-live': 'polite' });
    const input = h('input.ag-type__input', { type: 'text', placeholder: 'tell the folk what to make…', 'aria-label': 'Tell the folk what to make', autocomplete: 'off', spellcheck: false, enterKeyHint: 'send' });
    const form = h('form.ag-type', null, input, h('span.ag-type__keys', { html: '<span>enter</span> to send · <span>esc</span>' }));
    const el = h('div.ag-voice', { 'data-state': 'idle' }, h('div.ag-voice__mark', null, mark, wave, lbl), form);
    const capTxt = h('div.txt');
    const capEl = h('div.ag-caption', { hidden: true, 'aria-live': 'polite' }, capTxt);
    layer.append(capEl, el);
    let state = 'idle', capTimer = 0, doneTimer = 0, used = false, typing = false, capBlocking = false;
    const capUnblock = () => { if (capBlocking) { capBlocking = false; hint.unblock(); } };

    function label() {
      const L = {
        idle: used ? '' : `<span class="k-key">hold ${iconSlot('space', 26, '')} Space</span><span class="k-touch">hold to speak</span>`,
        listening: 'listening',
        thinking: 'the folk are listening<span class="ag-dots"><i></i><i></i><i></i></span>',
        done: esc(doneText || 'heard'),
        error: esc(doneText || 'the folk didn’t quite catch that')
      }[state];
      lbl.innerHTML = L || '';
      el.classList.toggle('is-quiet', state === 'idle' && used);
    }
    let doneText = '';
    function setState(s = 'idle', text) {
      state = ({ idle: 1, listening: 1, thinking: 1, done: 1, error: 1 })[s] ? s : 'idle';
      el.dataset.state = state; doneText = text || '';
      mark.setAttribute('aria-pressed', String(state === 'listening'));
      if (state === 'listening') { closeTyping(); idle.poke(); }
      hooks.listening && hooks.listening(state === 'listening');
      if (state === 'done') used = true;
      clearTimeout(doneTimer);
      if (state === 'done' || state === 'error') doneTimer = setTimeout(() => setState('idle'), 1800);
      label();
    }
    // the typed fallback: one underlined line in place of the mark
    function openTyping() {
      if (state === 'listening') return;
      typing = true; el.classList.add('is-typing'); idle.poke(); hint.hide();
      requestAnimationFrame(() => input.focus()); input.focus();
    }
    function closeTyping() {
      if (!typing) return; typing = false; el.classList.remove('is-typing');
      if (document.activeElement === input) input.blur();
    }
    form.addEventListener('submit', e => {
      e.preventDefault();
      const t = input.value.trim(); if (!t) { closeTyping(); return; }
      input.value = ''; closeTyping();
      command(t, 'typed', 'you wrote');
    });
    // keystrokes in the field never reach the game's hotkeys (Space-to-talk, Tab, 1/2/3...)
    for (const ev of ['keydown', 'keyup', 'keypress']) input.addEventListener(ev, e => {
      e.stopPropagation();
      if (ev === 'keydown' && e.key === 'Escape') { e.preventDefault(); input.value = ''; closeTyping(); }
    });
    input.addEventListener('blur', () => { setTimeout(() => { if (typing && document.activeElement !== input && !input.value.trim()) closeTyping(); }, 120); });

    // the mark: hold = speak (onMic), click = write
    let micDown = false, holdT = 0, pressed = false;
    mark.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      pressed = true;
      if (typeof onMic !== 'function') return;
      e.preventDefault(); mark.setPointerCapture?.(e.pointerId);
      holdT = setTimeout(() => { if (!pressed) return; micDown = true; fire(onMic, true); }, holdMs);
    });
    const release = () => {
      if (!pressed) return; pressed = false; clearTimeout(holdT);
      if (micDown) { micDown = false; fire(onMic, false); } else openTyping();
    };
    mark.addEventListener('pointerup', release);
    mark.addEventListener('pointercancel', () => { pressed = false; clearTimeout(holdT); if (micDown) { micDown = false; fire(onMic, false); } });
    mark.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); openTyping(); } });

    // the live caption: one line of large italic serif, near the bottom; it fades ~3 s after landing
    function setCaption(text, final = false, { holdMs: hold = 3000 } = {}) {
      clearTimeout(capTimer);
      if (!text) { capEl.classList.remove('is-on'); capEl.hidden = true; capUnblock(); return; }
      const wasHidden = capEl.hidden;
      capEl.hidden = false; capEl.classList.toggle('is-final', !!final);
      if (wasHidden) { capEl.classList.remove('is-on'); void capEl.offsetWidth; }
      capEl.classList.add('is-on');
      if (!capBlocking) { capBlocking = true; hint.block(); }
      capTxt.innerHTML = final ? `“${esc(text)}”` : `<span class="interim">“${esc(text)}</span><span class="caret"></span>`;
      if (final && hold > 0) capTimer = setTimeout(() => {
        capEl.classList.remove('is-on');
        capTimer = setTimeout(() => { capEl.hidden = true; capUnblock(); }, reduceMotion() ? 0 : 900);
      }, hold);
    }
    let chipList = DEFAULT_CHIPS.concat(MORE_CHIPS).map(toStr);
    setState('idle');
    return {
      el, setState, setCaption, openTyping, closeTyping,
      // no chip bar any more: the list feeds the idle hint rotation (and nothing is drawn)
      setChips(list) { if (Array.isArray(list) && list.length) chipList = list.map(toStr); },
      get chips() { return chipList.slice(); },
      setLevel(v) { wave.style.setProperty('--lvl', String(Math.max(0, Math.min(1, +v || 0)))); },
      focus: openTyping, setValue(t = '') { input.value = t; },
      isTyping: () => document.activeElement === input || !!(document.activeElement && document.activeElement.classList && document.activeElement.classList.contains('ag-talk__input')),
      get typingOpen() { return typing; },
      get state() { return state; },
      _used() { if (!used) { used = true; label(); } }
    };
  })();

  // ======================= hint line (onboarding's pointing hint, the idle rotation) =======================
  const hint = (() => {
    const el = h('div.ag-hint', { hidden: true, 'aria-live': 'polite' });
    layer.append(el);
    let timer = 0, blocked = 0, cur = null;
    function show(htmlOrText, { says = null, ttl = 8000, html = false, guide = false } = {}) {
      clearTimeout(timer);
      el.classList.toggle('is-guide', !!guide);
      el.replaceChildren();
      const body = h('span.ag-hint__txt', html ? { html: htmlOrText } : null, html ? null : htmlOrText);
      if (says) {
        body.replaceChildren();
        body.append('try saying ', h('button.ag-hint__say', { type: 'button', on: { click: e => { e.currentTarget.blur(); hide(); command(says, 'chip'); } } }, `“${says}”`));
      }
      el.append(body); cur = { ttl };
      el.hidden = false; el.classList.remove('is-on'); void el.offsetWidth; el.classList.add('is-on');
      if (blocked) el.classList.add('is-blocked');
      if (ttl > 0) timer = setTimeout(hide, ttl);
    }
    function hide() {
      clearTimeout(timer); cur = null;
      if (el.hidden) return;
      el.classList.remove('is-on');
      timer = setTimeout(() => { if (!cur) el.hidden = true; }, reduceMotion() ? 0 : 700);
    }
    return { show, hide, el, get visible() { return !!cur; },
      block() { blocked++; el.classList.add('is-blocked'); }, unblock() { blocked = Math.max(0, blocked - 1); if (!blocked) el.classList.remove('is-blocked'); } };
  })();

  // the onboarding panel (guide.js): skipped -> the onboarding's own skip (the game's machine, or the demo)
  const guide = createGuide({ layer, onSkip: () => onboarding.skip() });

  // after hintIdleMs without a command: at most one faint rotating hint line (never a chip bar)
  const idle = (() => {
    let t = 0, i = 0, rotating = false;
    const busy = () => titleCard.visible || onboarding.current || letters.openId || letters.isFanned || mail.notify.column.isOpen || talk.isOpen || election.visible || pick.active || fleet.visible || ledger.isOpen || voiceBar.typingOpen || voiceBar.state !== 'idle' || meeting.visible || decree.visible || layer.classList.contains('is-cinema');
    function arm(ms = hintIdleMs) { clearTimeout(t); if (hintIdleMs > 0) t = setTimeout(tick, ms); }
    function tick() {
      if (busy()) { arm(4000); return; }
      const list = voiceBar.chips; if (!list.length) return;
      const c = list[i++ % list.length];
      rotating = true; hint.show('', { says: c.says, ttl: 7000 });
      arm(11000);
    }
    function poke() { if (rotating) { rotating = false; hint.hide(); } arm(); }
    return { arm, poke, stop() { clearTimeout(t); } };
  })();

  // ======================= letters: the envelope stack + the reading view =======================
  const letters = (() => {
    const items = new Map();                       // id -> letter, insertion order
    let mail = null;                               // set below (createMail needs the functions defined here)
    let variant = /^[ab]$/.test(letterVariant) ? letterVariant : 'a';
    let reader = null;                              // { id, el, letterEl, busy }
    let fanned = null, readingId = null;            // the inbox fanned out on the table: { el, table, head, cards }
    const envs = [0, 1].map(i => h('div.ag-env.ag-env--' + i, { html: envelopeSVG() }));
    const count = h('span.ag-stack__count', { 'aria-hidden': 'true' }, '0');
    const stackLbl = h('span.ag-stack__lbl', null, 'the latest');
    // click: the latest unread letter (the game glides to its sender, then openCompact). Shift-click or a long press:
    // every letter fanned out on the table ("see all at once", ART_DIRECTION §14). Hover: the recent column.
    let lpT = 0, lpFired = false;
    const stack = h('button.ag-stack', { type: 'button', hidden: true, 'aria-label': 'Letters', title: 'the latest letter · shift-click: see all at once', on: {
      click: e => { e.currentTarget.blur(); if (lpFired) { lpFired = false; return; } if (e.shiftKey) fan(); else openBox(); },
      pointerdown: e => { if (e.button !== 0) return; lpFired = false; clearTimeout(lpT); lpT = setTimeout(() => { lpFired = true; mail.notify.column.stopHover(); fan(); }, longPressMs); },
      pointerup: () => clearTimeout(lpT), pointercancel: () => clearTimeout(lpT), pointerleave: () => clearTimeout(lpT),
      contextmenu: e => { if (lpFired) e.preventDefault(); } } }, h('span.ag-stack__icon', { html: iconSlot('mailbox', 44, '') }), envs, count, stackLbl);
    layer.append(stack);

    function who(L) {
      const f = L.from || {}, a = f.kind === 'agent' || f.kind === 'minister' ? agentOf(f.id) : null;
      const nb = f.kind === 'neighbour' ? (neighbours.get(f.id) || (lookup.neighbour ? lookup.neighbour(f.id) : null)) : null;
      const species = f.species || (a && a.species) || (f.kind === 'neighbour' ? nbSpecies(f.id) : null) || (L.meta && L.meta.species);
      const trade = f.trade || (a && a.trade) || (L.meta && L.meta.trade);
      let line;
      if (f.kind === 'ministry') line = 'by order of the Ministry';
      else if (f.kind === 'minister') line = `your minister${trade ? ', ' + trade : ''}`;
      else if (f.kind === 'neighbour') line = nb && nb.leaderName ? `${nb.leaderName}, from across the water` : 'from across the water';
      else if (f.kind === 'folk') line = f.trade || 'all of us, with dusty hands';
      else line = [trade, species && `${article(species)} ${species}`].filter(Boolean).join(' · ');
      return { name: f.name || 'Someone', line, ink: senderInk(f, species), species };
    }
    const sealOf = (L, size) => {
      const w = who(L);
      // red wax for the folk (mb 7), heraldry for the nations, the ink scales for the Ministry
      if (w.ink.shield) return shieldSVG(L.from.id, size * .82, w.species).replace('<svg ', '<svg class="ag-seal ag-shield" ');
      if (L.from && L.from.kind === 'ministry') return sealSVG(w.ink.colour, w.ink.glyph, size, hash(L.id) % 997, w.ink.glyphInk);
      return sealSVG('#e0503f', L.from && L.from.kind === 'folk' ? 'F' : (w.name || '?')[0], size, hash(L.id) % 997);
    };
    const sorted = () => [...items.values()].reverse();   // newest first
    const unreadList = () => sorted().filter(l => !l.read);

    function render() {
      const all = sorted(), unread = all.filter(l => !l.read).length;
      stack.hidden = all.length === 0;
      count.textContent = String(unread); count.classList.toggle('is-zero', unread === 0);
      stack.classList.toggle('is-read', unread === 0);
      stack.setAttribute('aria-label', unread ? `${unread} unread letter${unread > 1 ? 's' : ''}` : `${all.length} letter${all.length > 1 ? 's' : ''}`);
      const top = [...all.filter(l => !l.read), ...all.filter(l => l.read)].slice(0, 2).reverse();   // [behind, front]
      envs[0].hidden = all.length < 2;           // one letter = one envelope; two or more = the stack
      envs[1].querySelector('.ag-seal')?.remove();
      const front = top[top.length - 1];
      if (front) envs[1].insertAdjacentHTML('beforeend', sealOf(front, 25));
      if (fanned) syncFan();
      if (mail) { mail._badge(); mail._render(); }
    }

    function addLetter(L, { silent = false, open: autoOpen = false } = {}) {
      if (!L || L.id == null) return;
      items.delete(L.id); items.set(L.id, { ...L, read: !!L.read, resolved: !!L.resolved });
      const wasHidden = stack.hidden;
      if (fanned) render();                         // the table is open: the new letter lands on it (syncFan), not on the stack
      else if (!silent && !reduceMotion() && !titleCard.visible) {
        render();
        // the envelope slides in and lands on the stack; the count pings when it lands
        const fly = h('div.ag-arrive', { html: iconSlot('letter', 56, envelopeSVG() + sealOf(L, 25)) });   // §24: the pop envelope
        if (wasHidden) stack.classList.add('is-arriving');
        layer.append(fly);
        setTimeout(() => { fly.remove(); stack.classList.remove('is-arriving', 'is-ping'); void stack.offsetWidth; stack.classList.add('is-ping'); }, 1150);
      } else render();
      // the note under the stack: "(portrait) Olla sent a letter · “Bread”" (not for the welcome letter, not when silent)
      if (notifyOnArrive && !silent && !autoOpen && !L.read && L.id !== WELCOME_ID && mail) mail.notify.letter(items.get(L.id));
      if (autoOpen) open(L.id);
      return L.id;
    }

    // ---------- the reading view ----------
    function splitSign(body, name) {
      const lines = String(body || '').replace(/\s+$/, '').split('\n');
      let sign = null;
      const last = (lines[lines.length - 1] || '').trim();
      const first = String(name || '').split(/[ ,]/)[0].toLowerCase();
      if (/^[—–-]\s*\S/.test(last)) { sign = last.replace(/^[—–-]\s*/, ''); lines.pop(); }
      else if (first && last.length < 48 && last.toLowerCase().startsWith(first)) { sign = last; lines.pop(); }
      const [main, ...rest] = String(sign || name || '').split(/,\s*/);
      return { text: lines.join('\n').replace(/\s+$/, ''), sign: main, signSub: rest.join(', ') };
    }
    function buildLetter(L) {
      const w = who(L), p = paper('ag-letter', hash(L.id) % 991 + 7, { amp: 2.8, n: 52 });
      const { text, sign, signSub } = splitSign(L.body, w.name);
      const ch = letterChoices(L.options), opts = ch.quiet ? [...ch.two, ch.quiet] : ch.two;   // §24: two choices + a quiet "not now"
      const replies = opts.map(o => h('button.ag-reply', { type: 'button', disabled: L.resolved || undefined, on: { click: e => {
        if (L.resolved || reader?.answered) return;
        const b = e.currentTarget; b.blur();
        reader && (reader.answered = true);
        replies.forEach(x => { x.disabled = x !== b; }); b.setAttribute('aria-pressed', 'true');
        const says = o.says || o.label;
        if (o.command) command(says, 'chip');
        else { voiceBar.setCaption(says, true, { who: 'you replied' }); voiceBar._used(); idle.poke(); fire(onLetterOption, L.id, says); }
        const id = L.id;
        setTimeout(() => { if (reader && reader.id === id) close(); }, 1500);
      } } }, h('i', null, 'say'), h('span', null, o.label || o.says)));
      if (ch.quiet && replies.length) replies[replies.length - 1].classList.add('is-quiet');
      const more = unreadList().filter(l => l.id !== L.id).length;
      const inner = h('div.ag-letter__in');
      add(p.sheet, h('div.ag-letter__day', null, `Day ${L.day ?? 1}`), inner);
      add(inner,
        h('header.ag-letter__head', null, h('span.ag-letter__seal', { html: sealOf(L, 54) }),
          h('div', null, h('div.ag-letter__from', null, w.name), h('div.ag-letter__trade', null, w.line))),
        L.subject ? h('h2.ag-letter__subject', null, L.subject) : null,
        h('div.ag-letter__body', null, text),
        h('div.ag-letter__sign' + (String(sign).length > 14 ? '.is-long' : ''), null, h('span.nm', null, sign), signSub ? h('span.sub', null, signSub) : null, h('span', { html: FLOURISH_SVG })),
        L.note ? h('div.ag-letter__note', { html: '<b>P.S.</b>' + L.note }) : null,
        replies.length ? h('div.ag-letter__replies', null, h('div.ag-letter__orn', { 'aria-hidden': 'true' }), replies,
          L.note ? null : h('div.ag-letter__aloud', { html: L.resolved ? 'answered' : 'or simply say it: hold <span class="ag-kbd">Space</span>' })) : null);
      add(p.sheet,
        h('footer.ag-letter__foot', null,
          h('button.ag-link', { type: 'button', on: { click: () => close() } }, 'fold it away'),
          more ? h('button.ag-link.ag-letter__next', { type: 'button', on: { click: () => next() } }, h('span', null, `${more} more waiting`), ' next letter →') : null),
        L.resolved ? h('div.ag-stamp', null, 'answered') : null);
      return p.wrap;
    }
    // the opened envelope: back (inside), pocket (front, over the letter), flap (opens) + its seal
    function buildEnvelope(L) {
      const back = h('div.ag-big.ag-big__back', { html: ENV_BACK_SVG });
      const pocket = h('div.ag-big.ag-big__pocket', { html: ENV_POCKET_SVG });
      const flap = h('div.ag-big__flap', { html: ENV_FLAP_SVG });
      const seal = h('div.ag-big__seal', { html: sealOf(L, 64) });
      const flapWrap = h('div.ag-big.ag-big__flapwrap', null, flap, seal);
      return { back, pocket, flapWrap, flap, seal, all: [back, pocket, flapWrap] };
    }

    // while part of the letter is below its fold, the inside fades out at its lower edge (no scrollbar on paper)
    function watchMore(r) {
      const inn = r.letterEl.querySelector('.ag-letter__in'); if (!inn) return;
      const upd = () => inn.classList.toggle('is-more', inn.scrollHeight - inn.clientHeight - inn.scrollTop > 6);
      inn.addEventListener('scroll', upd, { passive: true });
      r.more = upd; upd(); requestAnimationFrame(upd);
      document.fonts && document.fonts.ready.then(upd);
    }
    function geometry(letterEl) {
      const W = innerWidth, H = innerHeight, top = W < 700 ? 14 : 30, bottom = W < 700 ? 84 : 92;
      const LH = letterEl.offsetHeight, LW = letterEl.offsetWidth;
      const avail = H - top - bottom;
      const lt = top + Math.max(0, (avail - LH) / 2);
      return { W, H, LW, LH, lt };
    }

    async function open(id, { from = 'stack', fromRect = null } = {}) {
      const L = items.get(id); if (!L) return;
      if (reader) { const prev = reader; reader = null; swapOut(prev); }
      if (mail && mail.compact.isOpen) mail.notify.column.close(true);   // the full sheet (welcome letter, director) replaces the inbox pane
      ledger.close(); agentCard.hide(); hint.hide(); idle.poke();
      if (!L.read) setRead(id, true);
      // the envelope lifts off the stack, or off the table when the letters are fanned out
      const card = fanned && fanned.cards.get(id);
      const startRect = fromRect || (from !== 'stack' ? null : card ? card.getBoundingClientRect() : !stack.hidden && !fanned ? envs[1].getBoundingClientRect() : null);
      const v = variant;
      const veil = h('div.ag-read__veil', { on: { click: () => close() } });
      const stage = h('div.ag-read__stage');
      const el = h('div.ag-read.ag-read--' + v + (fanned ? '.ag-read--onfan' : ''), { role: 'dialog', 'aria-label': `A letter from ${who(L).name}`, 'data-variant': v }, veil, stage);
      if (fanned) fanned.el.classList.add('is-under');
      readingId = id;
      render();
      const letterEl = buildLetter(L);
      const env = buildEnvelope(L);
      const r = { id, el, letterEl, env, answered: false, variant: v };
      reader = r;
      layer.classList.add('is-reading');
      el.tabIndex = -1;
      const takeFocus = () => { if (reader === r && !isField(document.activeElement)) el.focus({ preventScroll: true }); };
      if (v === 'b') {
        const desk = paper('ag-desk', 4242, { amp: 3.4, n: 60 });
        const envBox = h('div.ag-desk__env', null, env.back, env.pocket, env.flapWrap, h('div.ag-desk__ret', null, `from ${who(L).name}`));
        add(desk.sheet, envBox, h('div.ag-desk__slot', null, letterEl));
        stage.append(desk.wrap);
        layer.append(el);
        env.flapWrap.classList.add('is-open');
        env.seal.classList.add('is-broken');
        takeFocus(); watchMore(r);
        if (!reduceMotion()) animateDesk(r, desk.wrap, envBox);
        return;
      }
      stage.append(env.back, letterEl, env.pocket, env.flapWrap);
      layer.append(el);
      placeLetter(r);
      takeFocus(); watchMore(r);
      if (reduceMotion()) { env.all.forEach(e => e.remove()); return; }
      await animateOpen(r, startRect);
    }
    function placeLetter(r) {
      const g = geometry(r.letterEl);
      r.letterEl.style.top = g.lt + 'px';
      // the envelope sits low and centred under the letter's final place
      const EW = Math.min(460, g.W - 40, g.LW * 0.9), EH = EW * 0.64;
      const ecx = g.W / 2, ety = Math.min(g.H - EH - 40, g.lt + g.LH * 0.42);
      for (const e of r.env.all) Object.assign(e.style, { left: ecx - EW / 2 + 'px', top: ety + 'px', width: EW + 'px', height: EH + 'px' });
      r.g = { ...g, EW, EH, ecx, ety };
    }
    async function animateOpen(r, sr) {
      const { env, letterEl, g } = r, { EW, EH, ety, LH, lt } = g;
      const ease = 'cubic-bezier(.2,.8,.2,1)', inOut = 'cubic-bezier(.65,0,.3,1)';
      r.el.querySelector('.ag-read__veil').animate([{ opacity: 0 }, { opacity: 1 }], { duration: 500, fill: 'both' });
      // 1. the envelope flies off the stack to the middle of the screen
      const fly = sr
        ? [{ transform: `translate(${sr.left + sr.width / 2 - g.W / 2}px, ${sr.top + sr.height / 2 - (ety + EH / 2)}px) scale(${sr.width / EW}) rotate(-3deg)`, opacity: 1 }, { transform: 'none', opacity: 1 }]
        : [{ transform: 'translateY(24px) scale(.92)', opacity: 0 }, { transform: 'none', opacity: 1 }];
      const T1 = sr ? 520 : 340;
      env.all.forEach(e => e.animate(fly, { duration: T1, easing: ease, fill: 'both' }));
      // the letter waits inside, top edge just under the envelope's mouth
      const s = Math.min(1, (EW * 0.9) / g.LW);
      const yIn = ety + EH * 0.08 - lt, yOut = ety - s * LH * 0.52 - lt;
      const vis = y => Math.max(0, Math.min(LH + 60, (ety + EH - 4 - (lt + y)) / s));   // visible height above the envelope's bottom
      const clip = y => `inset(-60px -60px ${Math.max(-60, LH - vis(y)).toFixed(1)}px -60px)`;
      letterEl.style.opacity = '0';
      await sleep(T1);
      if (reader !== r) return;
      // 2. the seal gives, the flap opens
      env.seal.animate([{ transform: 'translate(-50%,-50%) scale(1)', opacity: 1 }, { transform: 'translate(-50%,-50%) scale(1.08) rotate(-6deg)', opacity: 0 }], { duration: 260, easing: 'ease-in', fill: 'both' });
      env.flap.animate([{ transform: 'perspective(1100px) rotateX(0deg)' }, { transform: 'perspective(1100px) rotateX(180deg)' }], { duration: 420, delay: 120, easing: inOut, fill: 'both' });
      setTimeout(() => { env.flapWrap.style.zIndex = '0'; }, 330);
      await sleep(470);
      if (reader !== r) return;
      // 3. the letter rises out of the envelope
      letterEl.style.opacity = '';
      const T3 = 520;
      letterEl.animate([
        { transform: `translateY(${yIn}px) scale(${s}) rotate(0deg)`, clipPath: clip(yIn) },
        { transform: `translateY(${yOut}px) scale(${s}) rotate(-1.4deg)`, clipPath: clip(yOut) }
      ], { duration: T3, easing: 'cubic-bezier(.3,.1,.3,1)', fill: 'both' });
      await sleep(T3 - 40);
      if (reader !== r) return;
      // 4. the envelope slides away below; the letter comes up to full size and settles with a slight rotation
      const T4 = 760;
      env.all.forEach(e => e.animate([{ transform: 'none', opacity: 1 }, { transform: `translateY(${g.H * 0.5}px) rotate(4deg)`, opacity: 0 }], { duration: T4 * 0.9, easing: 'cubic-bezier(.5,0,.75,0)', fill: 'both' }));
      const a = letterEl.animate([
        { transform: `translateY(${yOut}px) scale(${s}) rotate(-1.4deg)`, clipPath: clip(yOut) },
        { transform: `translateY(${yOut * 0.18}px) scale(${(s + 1) / 2 + 0.02}) rotate(-2deg)`, clipPath: 'inset(-60px -60px -60px -60px)', offset: 0.55 },
        { transform: 'translateY(0) scale(1) rotate(-0.6deg)', clipPath: 'inset(-60px -60px -60px -60px)' }
      ], { duration: T4, easing: ease, fill: 'both' });
      await a.finished.catch(() => {});
      if (reader !== r) return;
      letterEl.getAnimations().forEach(x => x.cancel());
      env.all.forEach(e => e.remove());
    }
    function animateDesk(r, desk, envBox) {
      r.el.querySelector('.ag-read__veil').animate([{ opacity: 0 }, { opacity: 1 }], { duration: 450, fill: 'both' });
      desk.animate([{ transform: 'translateY(26px) scale(.97)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 520, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'both' });
      envBox.animate([{ transform: 'translate(-60px, 30px) rotate(-14deg)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 700, delay: 160, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'both' });
      r.letterEl.animate([{ transform: 'translate(-42%, 6%) rotate(-6deg) scale(.86)', opacity: 0 }, { opacity: 1, offset: .25 }, { transform: 'none', opacity: 1 }], { duration: 900, delay: 420, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'both' });
    }
    function swapOut(r) {
      if (reduceMotion()) { r.el.remove(); return; }
      r.el.querySelector('.ag-read__veil')?.remove();
      r.el.style.pointerEvents = 'none';
      const t = r.variant === 'b' ? r.el.querySelector('.ag-desk') : r.letterEl;
      t.getAnimations().forEach(x => x.cancel());
      t.animate([{ opacity: 1 }, { transform: 'translateX(-90px) rotate(-5deg)', opacity: 0 }], { duration: 360, easing: 'ease-in', fill: 'both' });
      setTimeout(() => r.el.remove(), 380);
    }
    // fold it back into the stack
    function close() {
      if (mail && mail.compact.isOpen && !reader) { mail.compact.close(); return; }
      if (!reader) return;
      const r = reader; reader = null; readingId = null; layer.classList.remove('is-reading');
      const onTable = fanned && fanned.cards.get(r.id);   // read from the table: it goes back to its place there
      if (reduceMotion()) { r.el.remove(); render(); if (fanned) { fanned.el.classList.remove('is-under'); fanned.el.focus({ preventScroll: true }); } return; }
      r.el.style.pointerEvents = 'none';
      const t = r.variant === 'b' ? r.el.querySelector('.ag-desk') : r.letterEl;
      const tr = t.getBoundingClientRect(), sr = (onTable || (!stack.hidden ? stack : place.el)).getBoundingClientRect();
      t.getAnimations().forEach(x => x.cancel());
      r.env.all.forEach(e => r.variant === 'a' && e.remove());
      const dx = sr.left + sr.width / 2 - (tr.left + tr.width / 2), dy = sr.top + sr.height / 2 - (tr.top + tr.height / 2);
      const endS = onTable ? Math.max(.12, sr.width / Math.max(1, tr.width)) : .12;
      t.animate([{ transform: getComputedStyle(t).transform === 'none' ? 'none' : getComputedStyle(t).transform, opacity: 1 },
        { transform: `translate(${dx * 0.35}px, ${dy * 0.35}px) scale(${onTable ? (1 + endS) / 2 : .62}) rotate(3deg)`, opacity: .95, offset: .45 },
        { transform: `translate(${dx}px, ${dy}px) scale(${endS}) rotate(${onTable ? 2 : 9}deg)`, opacity: onTable ? .4 : 0 }], { duration: onTable ? 560 : 520, easing: 'cubic-bezier(.5,0,.3,1)', fill: 'both' });
      r.el.querySelector('.ag-read__veil').animate([{ opacity: 1 }, { opacity: 0 }], { duration: 480, fill: 'both' });
      if (fanned) { fanned.el.classList.remove('is-under'); fanned.el.focus({ preventScroll: true }); }
      setTimeout(() => {
        r.el.remove();
        if (onTable) { render(); return; }
        stack.classList.remove('is-ping'); void stack.offsetWidth; stack.classList.add('is-ping');
      }, onTable ? 540 : 520);
      if (!onTable) render();
    }
    function openNext() {
      const u = unreadList(); const L = u[0] || sorted()[0];
      if (L) open(L.id);
    }
    function next() {
      if (!reader) return openNext();
      const u = unreadList().filter(l => l.id !== reader.id);
      if (u[0]) open(u[0].id, { from: 'here' }); else close();
    }
    function markResolved(id, { choice } = {}) {
      const L = items.get(id); if (!L) return;
      L.resolved = true; L.read = true; if (choice) L.choice = choice;
      if (reader && reader.id === id) {
        reader.letterEl.querySelectorAll('.ag-reply').forEach(b => { b.disabled = b.getAttribute('aria-pressed') !== 'true'; });
        const sheet = reader.letterEl.querySelector('.ag-sheet');
        if (!sheet.querySelector('.ag-stamp')) sheet.append(h('div.ag-stamp', null, 'answered'));
      }
      render();
    }
    function setLetters(arr = []) { items.clear(); for (const L of arr) items.set(L.id, { ...L }); render(); }
    function setRead(id, read = true) {
      const L = items.get(id); if (!L) return;
      const was = !!L.read; L.read = !!read; render();
      if (read && !was) { fire(onLetterRead, id); mail && mail.notify._letterRead(id); }
    }
    // ---------- §14/§15: the latest unread letter, read in the inbox pane ----------
    const latest = () => unreadList()[0] || sorted()[0] || null;
    // where every "open this letter" goes: the game's callback (camera glide + openCompact), else straight to the inbox pane
    function jump(id, from = 'notification') {
      const L = items.get(id);
      if (from === 'stack' && typeof onOpenLatest === 'function') { fire(onOpenLatest, L ? { ...L } : null); return; }
      const fn = from === 'next' && typeof onNextLetter === 'function' ? onNextLetter : onNotificationClick;
      if (typeof fn === 'function') { fire(fn, id, { from }); return; }
      if (L) mail.compact.open(L);
    }
    function openLatest() {
      const L = latest(); if (!L) return;
      jump(L.id, 'stack');
    }
    // §24: a click on the mailbox opens the list of letters (the mailbox icon hides while it is open); with no list yet,
    // the latest letter
    function openBox() {
      if (mail && mail.notify.list.length) { mail.notify.column.open({ pin: true }); return; }
      openLatest();
    }

    // ---------- the inbox: every letter fanned out across the table (ART_DIRECTION §11; no side panel) ----------
    // A click on the stack spreads ALL the letters over the dimmed, blurred world like mail on a table, in loose
    // rows that arc a little, overlapping when there are many. Unread ones sit slightly raised, answered ones are
    // dimmed. A card opens in the reading view (it lifts off the table) and folds back to its place; "gather them
    // up", Esc or a click on the bare table folds them all back into the stack.
    const MAIL_W = 236, MAIL_H = 152;
    function postmarkSVG(day, seed) {
      const r = rng(seed), waves = [0, 1, 2].map(i => { let d = `M2 ${13 + i * 8}`; for (let x = 2; x < 50; x += 8) d += ` q2 ${-2 - r()} 4 0 t4 0`; return d; }).join('');
      return `<svg viewBox="0 0 108 56" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.15" stroke-linecap="round"><path d="${waves}" opacity=".7"/>` +
        `<circle cx="80" cy="28" r="23"/><circle cx="80" cy="28" r="18.5" stroke-width=".7"/></g>` +
        `<text x="80" y="20" text-anchor="middle" font-size="7.5" letter-spacing="2.2" fill="currentColor">DAY</text>` +
        `<text x="80" y="40" text-anchor="middle" font-size="19" font-style="italic" fill="currentColor">${esc(day ?? 1)}</text></svg>`;
    }
    function mailCard(L) {
      const w = who(L), seed = hash(L.id);
      const el = h('button.ag-mail', { type: 'button', 'data-id': L.id, on: { click: e => { e.currentTarget.blur(); openFromTable(L.id); } } },
        h('span.ag-mail__in', null,
          h('span.ag-mail__paper'),
          mail ? h('span.ag-mail__seal', null, mail.cameo(L, 36)) : h('span.ag-mail__seal', { html: sealOf(L, 36) }),
          h('span.ag-mail__who', null, h('span.ag-mail__from' + (String(w.name).length > 13 ? '.is-long' : ''), null, w.name), h('span.ag-mail__line', null, w.line)),
          h('span.ag-mail__post', { html: postmarkSVG(L.day, seed % 97) }),
          h('span.ag-mail__subj', null, L.subject || 'A letter'),
          h('span.ag-mail__state')));
      el._seed = seed;
      return el;
    }
    function dressCard(el, L) {
      el.classList.toggle('is-unread', !L.read);
      el.classList.toggle('is-resolved', !!L.resolved);
      el.classList.toggle('is-reading', readingId === L.id);
      const st = el.querySelector('.ag-mail__state');
      st.textContent = L.resolved ? 'answered' : L.read ? '' : 'unread';
      el.setAttribute('aria-label', `${L.resolved ? 'Answered' : L.read ? 'Read' : 'Unread'}: ${who(L).name}, “${L.subject || 'a letter'}”, day ${L.day ?? 1}`);
    }
    function fanHeadText() {
      const all = sorted(), u = all.filter(l => !l.read).length;
      return `${all.length} letter${all.length === 1 ? '' : 's'}${u ? ` · ${u} unread` : ' · all read'}`;
    }
    // loose rows that arc a little; overlap only when they must (vertical overlap first: the top strip, with the
    // seal, the sender and the day, always shows)
    function layoutFan() {
      if (!fanned) return;
      const list = sorted(), n = list.length; if (!n) return;
      const W = innerWidth, H = innerHeight, small = W < 600;
      const hb = fanned.head.getBoundingClientRect();
      const top = hb.bottom + (small ? 24 : 34), bottom = small ? 96 : 104, side = Math.max(16, W * 0.035) + (small ? 0 : 14);
      const aw = W - 2 * side, ah = Math.max(80, H - top - bottom);
      // a big post bag gets smaller envelopes (down to .78) before they start to overlap
      let s = (small ? .7 : W < 1100 ? .9 : 1) * (n <= 2 ? 1.25 : n <= 6 ? 1.1 : n <= 12 ? 1 : Math.max(.78, Math.sqrt(12 / n)));
      s = Math.min(s, aw / (MAIL_W * 1.04), ah / (MAIL_H * 1.08));
      const cw = MAIL_W * s, ch = MAIL_H * s, gx = cw * .1, gy = ch * .16;
      let best = null;
      for (let c = 1; c <= n; c++) {
        const r = Math.ceil(n / c);
        if (r * c - n >= c) continue;
        const sx = c > 1 ? Math.min(cw + gx, (aw - cw) / (c - 1)) : 0, sy = r > 1 ? Math.min(ch + gy, (ah - ch) / (r - 1)) : 0;
        if ((c > 1 && sx <= cw * .3) || (r > 1 && sy <= 0)) continue;
        const vx = c > 1 ? Math.min(1, sx / cw) : 1, vy = r > 1 ? Math.min(1, sy / ch) : 1;
        const gw = c > 1 ? sx * (c - 1) + cw : cw, gh = r > 1 ? sy * (r - 1) + ch : ch;
        const sc = vx * vx * vx * vy - Math.abs(Math.log((gw / gh) / (aw / ah))) * .02;
        if (!best || sc > best.sc + 1e-6) best = { c, r, sx, sy, gh, sc };
      }
      if (!best) best = { c: 1, r: n, sx: 0, sy: Math.max(8, (ah - ch) / Math.max(1, n - 1)), gh: ah };
      const { c, sx, sy, gh } = best;
      const y0 = top + Math.max(0, (ah - gh) / 2), tight = sy < ch * .7;
      fanned.table.style.setProperty('--s', s.toFixed(4));
      list.forEach((L, i) => {
        const el = fanned.cards.get(L.id); if (!el) return;
        const row = Math.floor(i / c), j = i % c, k = Math.min(c, n - row * c);
        const rowW = k > 1 ? sx * (k - 1) + cw : cw, x0 = side + (aw - rowW) / 2;
        const u = k > 1 ? j / (k - 1) * 2 - 1 : 0, rr = rng(el._seed || 1);
        const arc = k > 2 ? (1 - u * u) * Math.min(22, sy * .14 + 6) : 0;
        const jx = (rr() - .5) * (tight ? 4 : 14) + (row % 2 ? 1 : -1) * (tight ? 0 : cw * .05), jy = (rr() - .5) * (tight ? 3 : 10);
        el.style.left = (x0 + j * sx + jx).toFixed(1) + 'px';
        el.style.top = (y0 + row * sy - arc + jy).toFixed(1) + 'px';
        el.style.width = cw.toFixed(1) + 'px'; el.style.height = ch.toFixed(1) + 'px';
        el.style.setProperty('--r', (u * (tight ? 1.6 : 3.6) + (rr() - .5) * (tight ? 1.8 : 4.2)).toFixed(2) + 'deg');
        el.style.zIndex = String(10 + row * 40 + j);
      });
    }
    function flyFromStack(el, i, total) {
      if (reduceMotion()) return;
      const sr = (!stack.hidden ? envs[1] : stack).getBoundingClientRect(), cr = el.getBoundingClientRect();
      const dx = sr.left + sr.width / 2 - (cr.left + cr.width / 2), dy = sr.top + sr.height / 2 - (cr.top + cr.height / 2);
      const sc = Math.max(.2, sr.width / Math.max(1, cr.width));
      el.animate([{ transform: `translate(${dx}px, ${dy}px) rotate(-14deg) scale(${sc})`, opacity: 0 }, { opacity: 1, offset: .18 }, { transform: 'none', opacity: 1 }],
        { duration: 640, delay: Math.min(i * 32, 620 * Math.min(1, i / Math.max(1, total - 1))), easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' });
    }
    function syncFan(fly = true) {
      if (!fanned) return;
      const list = sorted(), ids = new Set(list.map(l => l.id)), fresh = [];
      for (const [id, el] of fanned.cards) if (!ids.has(id)) { el.remove(); fanned.cards.delete(id); }
      for (const L of list) {
        let el = fanned.cards.get(L.id);
        if (!el) { el = mailCard(L); fanned.cards.set(L.id, el); fanned.table.append(el); fresh.push(el); }
        dressCard(el, L);
      }
      fanned.sub.textContent = fanHeadText();
      layoutFan();
      if (fly) fresh.forEach((el, i) => flyFromStack(el, i, fresh.length));
    }
    function fan() {
      if (fanned) return;
      if (!items.size) return;
      if (reader) close();
      if (mail) { mail.notify.column.close(true); mail.notify.clearToasts(); }
      ledger.close(); agentCard.hide(); hint.hide(); idle.poke();
      const veil = h('div.ag-read__veil.ag-fan__veil', { on: { click: () => gather() } });
      const sub = h('div.ag-fan__sub');
      const head = h('header.ag-fan__head', null, h('div.ag-fan__title', null, 'Your letters'), sub,
        h('button.ag-link.ag-fan__gather', { type: 'button', on: { click: e => { e.currentTarget.blur(); gather(); } } }, 'gather them up'));
      const table = h('div.ag-fan__table');
      const el = h('div.ag-fan', { role: 'dialog', 'aria-label': 'Your letters', tabIndex: -1 }, veil, head, table);
      fanned = { el, table, head, sub, cards: new Map() };
      layer.append(el); layer.classList.add('is-fanned');
      if (!reduceMotion()) { veil.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 420, fill: 'both' }); head.animate([{ opacity: 0, transform: 'translate(-50%, -8px)' }, { opacity: 1, transform: 'translate(-50%, 0)' }], { duration: 520, delay: 160, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' }); }
      syncFan(false);
      const cards = sorted().map(L => fanned.cards.get(L.id));
      cards.forEach((c, i) => flyFromStack(c, i, cards.length));
      el.focus({ preventScroll: true });
    }
    // a card on the table: the table folds away and the letter opens beside its sender (§14: no full-screen letter)
    function openFromTable(id) {
      if (fanned) gather();
      jump(id, 'seeall');
    }
    // fold every letter back into the stack
    function gather() {
      if (!fanned) return;
      if (reader) close();
      const f = fanned; fanned = null; layer.classList.remove('is-fanned');
      if (document.activeElement && f.el.contains(document.activeElement)) document.activeElement.blur();
      f.el.style.pointerEvents = 'none';
      const ping = () => { stack.classList.remove('is-ping'); void stack.offsetWidth; stack.classList.add('is-ping'); };
      if (reduceMotion()) { f.el.remove(); render(); return; }
      const sr = envs[1].getBoundingClientRect();
      const cards = [...f.cards.values()].reverse();
      cards.forEach((el, i) => {
        const cr = el.getBoundingClientRect();
        const dx = sr.left + sr.width / 2 - (cr.left + cr.width / 2), dy = sr.top + sr.height / 2 - (cr.top + cr.height / 2);
        el.animate([{ transform: 'none', opacity: 1 }, { transform: `translate(${dx}px, ${dy}px) rotate(-8deg) scale(${Math.max(.2, sr.width / Math.max(1, cr.width))})`, opacity: .2 }],
          { duration: 460, delay: Math.min(i * 22, 360), easing: 'cubic-bezier(.55,0,.3,1)', fill: 'both' });
      });
      f.head.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 250, fill: 'both' });
      f.el.querySelector('.ag-fan__veil').animate([{ opacity: 1 }, { opacity: 0 }], { duration: 560, delay: 120, fill: 'both' });
      setTimeout(() => { f.el.remove(); ping(); }, 760);
      render();
    }

    addEventListener('resize', () => { if (reader && reader.variant === 'a') placeLetter(reader); reader && reader.more && reader.more(); layoutFan(); });
    // the mail system (mail.js): the compact card, the notes under the stack, the column
    mail = createMail({ layer, stack, fire,
      L: { get: id => items.get(id) || null, add: L => { addLetter(L, { silent: true }); return items.get(L.id); }, who, seal: sealOf, setRead,
        unread: unreadList, all: sorted, splitSign },
      cb: { open: (id, from) => jump(id, from), seeAll: () => fan(),
        beforeOpen: () => { if (reader) close(); if (fanned) gather(); ledger.close(); agentCard.hide(); hint.hide(); idle.poke(); } },
      getPortrait, onDismissNote: id => fire(onNotificationDismiss, id), onWriteBack: (Lt, t) => (typeof onWriteBack === 'function' ? onWriteBack(Lt, t) : null),
      // a Ministry letter keeps its seal; the minister who speaks for it shows their face beside it
      minister: () => { const id = ministerSeal.agentId; if (id == null) return null; const a = agentOf(id) || S.minister; return { id, name: (a && a.name) || (S.minister && S.minister.name) || '' }; },
      onReply: (L, o) => {
        const says = o.says || o.label;
        if (o.command) command(says, 'chip');
        else { voiceBar.setCaption(says, true, { who: 'you replied' }); voiceBar._used(); idle.poke(); fire(onLetterOption, L.id, says); }
      } });
    const markResolved0 = markResolved;
    render();
    return { addLetter, open, close, next, setLetters, el: stack,
      markResolved(id, o) { markResolved0(id, o); mail.compact.resolved(id); },
      fan, gather, get isFanned() { return !!fanned; }, get table() { return fanned ? fanned.el : null; },
      seeAll: () => fan(),
      toggleList(force) { const on = force ?? !reader; if (on) openNext(); else close(); },   // compat (director): opens the newest unread letter
      get variant() { return variant; }, set variant(v) { variant = v === 'b' ? 'b' : 'a'; },
      // §14: the compact card beside the sender
      // §15: every letter is read in the inbox pane (top-right). openCompact is the old name, kept: the anchor is ignored
      openCompact: (L, o) => mail.compact.open(L, o || {}), closeCompact: () => mail.compact.close(), moveCompact: p => mail.compact.move(p),
      read: L => mail.compact.open(L), backToList: () => mail.reader.back(), get readingId() { return mail.compact.id; },
      get compactId() { return mail.compact.id; }, get isCompact() { return mail.compact.isOpen; }, get compactEl() { return mail.compact.el; },
      openLatest, openBox, latest, markRead: (id, read = true) => setRead(id, read), get chevron() { return mail.chevron; },
      get openId() { return reader ? reader.id : mail.compact.id; }, get isOpen() { return !!reader || mail.compact.isOpen; },
      get unread() { return unreadList().length; }, get all() { return sorted(); }, _who: who, _sealOf: sealOf, _mail: mail };
  })();
  const mail = letters._mail;
  const WELCOME_ID = 'ag-welcome';

  // ======================= notices: one short line + the pencil scribble, top-centre, one at a time =======================
  const notices = new Map(); let noticeN = 0;
  const notesEl = h('div.ag-notices', { 'aria-live': 'polite' }); layer.append(notesEl);
  function nbSpecies(id) {
    const d = neighbours.get(id) || (lookup.neighbour && id != null ? lookup.neighbour(id) : null);
    return d ? (d.species || d.leaderSpecies || null) : null;
  }
  const KICK = { ministry: 'Ministry of Builds', minister: 'The Minister', neighbour: 'From across the water' };
  function renderNotice(n) {
    const el = n.el; el.replaceChildren();
    const o = n.opts, kind = o.kind;
    let mark = null;
    if (kind === 'ministry') mark = sealSVG('#2a2330', '⚖', 22, 41, 'rgba(243,236,220,.8)');
    else if (kind === 'minister') mark = sealSVG('#e0503f', (o.from || 'M')[0], 22, 43);
    else if (kind === 'neighbour') { const nid = o.neighbourId || o.from || 'n1'; mark = shieldSVG(nid, 18, nbSpecies(nid)); }
    el.title = o.title || (kind === 'minister' && o.from ? `Minister ${o.from}` : kind === 'neighbour' && o.from ? o.from : KICK[kind] || '');
    el.append(h('div.ag-notice__line', null, mark ? h('span.ag-notice__mark', { html: mark }) : null, h('span.ag-notice__txt', null, n.text)));
    if (o.progress != null && o.progress !== false) {
      const sc = h('span', { html: scribbleSVG(n.seed, 180) }).firstChild;
      const loop = o.progress === true;
      sc.classList.toggle('is-loop', loop);
      if (!loop) sc.querySelector('path:not(.ghost)').style.strokeDashoffset = String(1 - Math.max(0, Math.min(1, o.progress)));
      el.append(h('div.ag-notice__prog', null, sc, o.stage ? h('span.ag-notice__stage', null, o.stage) : null));
    }
  }
  // only the newest live notice shows; when it goes, the one under it comes back
  function showTop() {
    const live = [...notices.values()];
    const top = live[live.length - 1] || null;
    for (const n of live) {
      const on = n === top;
      if (on && !n.el.classList.contains('is-shown')) { n.el.hidden = false; n.el.classList.remove('is-out'); void n.el.offsetWidth; n.el.classList.add('is-shown'); }
      if (!on && n.el.classList.contains('is-shown')) { n.el.classList.remove('is-shown'); n.el.hidden = true; }
    }
  }
  function notice(text, opts = {}) {
    const id = opts.id || 'nt' + (++noticeN);
    if (notices.has(id)) { updateNotice(id, { text, ...opts }); return id; }
    const kind = opts.kind || 'info';
    const el = h('div.ag-notice.ag-notice--' + kind, { hidden: true });
    const n = { id, el, text, opts: { ...opts, kind }, seed: hash(id) % 89 + 3, timer: 0 };
    notices.set(id, n); renderNotice(n);
    notesEl.append(el);
    showTop(); armNotice(n);
    if (typeof opts.progress === 'number' && !reduceMotion()) {    // first paint at 0, then the pencil visibly moves
      const path = el.querySelector('.ag-scribble path:not(.ghost)');
      if (path) { path.style.strokeDashoffset = '1'; requestAnimationFrame(() => requestAnimationFrame(() => { if (typeof n.opts.progress === 'number') path.style.strokeDashoffset = String(1 - Math.max(0, Math.min(1, n.opts.progress))); })); }
    }
    return id;
  }
  function armNotice(n) {
    clearTimeout(n.timer);
    const o = n.opts, ttl = o.ttl ?? (o.sticky || (o.progress != null && o.progress !== false && o.progress < 1) || o.progress === true ? 0 : o.kind === 'info' ? 4500 : 6500);
    if (ttl > 0) n.timer = setTimeout(() => closeNotice(n.id), ttl);
  }
  function updateNotice(id, { text, ...opts } = {}) {
    const n = notices.get(id); if (!n) return;
    if (text != null) n.text = text;
    const prevP = n.opts.progress;
    Object.assign(n.opts, opts);
    if (typeof prevP === 'number' && typeof n.opts.progress === 'number' && text == null && Object.keys(opts).every(k => k === 'progress' || k === 'stage')) {
      const path = n.el.querySelector('.ag-scribble path:not(.ghost)');
      if (path) {
        path.style.strokeDashoffset = String(1 - Math.max(0, Math.min(1, n.opts.progress)));
        const st = n.el.querySelector('.ag-notice__stage'); if (st && opts.stage) st.textContent = opts.stage;
        else if (!st && opts.stage) n.el.querySelector('.ag-notice__prog').append(h('span.ag-notice__stage', null, opts.stage));
        armNotice(n); return;
      }
    }
    renderNotice(n); armNotice(n);
  }
  function closeNotice(id, now = false) {
    const n = notices.get(id); if (!n) return;
    clearTimeout(n.timer); notices.delete(id);
    if (now || n.el.hidden) n.el.remove(); else leave(n.el, 'is-out', 500);
    setTimeout(showTop, now || reduceMotion() ? 0 : 420);
  }

  // ======================= state the ledger shows (hud / ministerSeal / neighbours / offline) =======================
  const hud = {
    set(s = {}) {
      if (s.name != null) S.name = s.name;
      if (s.stage) S.stage = s.stage;
      if (s.day != null) S.day = s.day;
      if (s.prosperity != null) S.prosperity = s.prosperity;
      if (s.prosperityMax) S.prosperityMax = s.prosperityMax;
      if (s.resources) {
        for (const [k, v] of Object.entries(s.resources)) { if (v != null && S.resources[k] != null && Math.round(S.resources[k]) !== Math.round(v)) ledger._bump(k); S.resources[k] = v; }
      }
      if (s.honour !== undefined) { S.honour = s.honour || null; place.render(); if (s.honour) place.stampHonour(); }
      place.render(); ledger.render();
    },
    get el() { return place.el; }, get state() { return { ...S, resources: { ...S.resources } }; }
  };
  const ministerSeal = {
    set(agent, { quiet = false } = {}) {
      const prev = S.minister;
      S.minister = agent ? { id: agent.id, name: agent.name, species: agent.species, trade: agent.trade } : null;
      ledger.render(); agentCard.refresh();
      // the pill is gone: a new appointment is said once, as a quiet notice
      if (agent && !quiet && (!prev || prev.id !== agent.id)) notice(`${agent.name} now carries the minister’s seal`, { kind: 'minister', from: agent.name, ttl: 4200 });
    },
    get agentId() { return S.minister ? S.minister.id : null; }
  };
  const neighbours = {
    set(list = []) { S.neighbours = list.slice(0, 3); ledger.render(); },
    open() { ledger.open({ focus: 'neighbours' }); }, close() { ledger.close(); },
    get isOpen() { return ledger.isOpen; },
    get: id => S.neighbours.find(n => n.id === id) || null, get list() { return S.neighbours.slice(); }
  };
  function offlineNote(on = true) { S.offline = !!on; ledger.render(); }

  // ======================= the ledger: one paper sheet, on demand (Tab, or click the name) =======================
  const ledger = (() => {
    let el = null; const bumped = new Set();
    function sheet() {
      const p = paper('ag-ledger', 31, { amp: 2.6, n: 40 });
      const s = p.sheet;
      const st = STAGES.indexOf(S.stage);
      s.append(h('header.ag-ledger__head', null,
        h('div.ag-ledger__name', null, S.name || 'Unnamed'),
        h('div.ag-ledger__sub', null, `${article(S.stage)} ${S.stage}, on ${dayWords(S.day)}`),
        S.honour ? h('div.ag-ledger__honour', null, S.honour) : null,
        h('span.ag-ledger__stages', { title: cap(S.stage) }, STAGES.map((_, k) => h('i' + (k < st ? '.on' : k === st ? '.now' : ''))))));
      // minister
      const m = S.minister ? (agentOf(S.minister.id) || S.minister) : null;
      s.append(h('section.ag-ledger__sec', null, h('div.ag-ledger__k', null, 'Minister'),
        m ? h('div.ag-ledger__min', null, h('span', { html: sealSVG('#e0503f', (m.name || 'M')[0], 34, hash(m.id) % 97) }),
          h('div', null, h('div.nm', null, m.name), h('div.sub', null, [m.trade, m.species && `${article(m.species)} ${m.species}`].filter(Boolean).join(' · ') || 'carries the seal')))
          : h('div.ag-ledger__none', { html: 'No one yet. Say <i>“make Olla our minister”</i>.' })));
      // neighbours
      if (S.neighbours.length) {
        const rows = S.neighbours.map(n => {
          const sp = n.species || n.leaderSpecies || null;
          const gift = h('button.ag-link', { type: 'button', on: { click: e => {
            e.currentTarget.blur(); fire(onAgentAction, 'neighbour:' + n.id, 'gift');
            gift.textContent = 'sent'; gift.disabled = true; setTimeout(() => { gift.textContent = 'Send gift'; gift.disabled = false; }, 2200);
          } } }, 'Send gift');
          return h('div.ag-ledger__nb', null, h('span.ag-ledger__shield', { html: shieldSVG(n.id, 30, sp) }),
            h('div.ag-ledger__nbmain', null,
              h('div.ag-ledger__nbname', null, h('span', null, n.name), h('span.ag-ledger__att', { style: { '--c': attInk(n.attitude, n.allied) } }, attitudeWord(n.attitude, n.allied))),
              h('div.ag-ledger__acts', null, h('button.ag-link', { type: 'button', on: { click: () => { fire(onAgentAction, 'neighbour:' + n.id, 'visit'); close(); } } }, 'Visit'), h('span.sep', null, '·'), gift)));
        });
        s.append(h('section.ag-ledger__sec.ag-ledger__sec--nb', null, h('div.ag-ledger__k', null, 'Across the water'), rows));
      }
      // stores + prosperity, a few quiet lines
      const res = ['food', 'wood', 'stone', 'coin'].filter(k => S.resources[k] != null);
      const pct = Math.max(0, Math.min(100, S.prosperity / (S.prosperityMax || 100) * 100));
      s.append(h('section.ag-ledger__sec', null, h('div.ag-ledger__k', null, 'Stores'),
        res.length ? h('div.ag-ledger__res', null, res.map(k => h('span' + (bumped.has(k) ? '.bump' : ''), { title: k, html: `${GLYPH[k]}<b>${Math.round(S.resources[k])}</b> <i>${k}</i>` }))) : h('div.ag-ledger__none', null, 'nothing counted yet'),
        h('div.ag-ledger__pros', null, h('span.lbl', null, 'prosperity'), h('span.ag-ledger__meter', { style: { '--p': pct + '%' } }), h('b', null, String(Math.round(S.prosperity))))));
      // the minds' quiet lines (§18): what the folk have been saying to each other, bonds that moved, reflections, the director's hand
      if (S.society.length) s.append(h('section.ag-ledger__sec.ag-ledger__sec--soc', null, h('div.ag-ledger__k', null, 'Of late'),
        h('div.ag-ledger__soc', null, S.society.slice(-4).map(l => h('div.ag-ledger__socline', null, l)))));
      const mindLine = () => {
        const m = S.mind;
        if (!m) return S.offline ? h('span.ag-ledger__offline', { title: 'The server is in mock mode: no model is answering, the folk use their own words.' }, 'offline mind') : h('span');
        const live = m.mode === 'live' && !m.fallback;
        const word = m.mode === 'live' ? (m.fallback ? 'live minds, answered offline' : 'live minds') : m.mode === 'rules' ? 'minds resting (rules)' : 'minds of their own (offline)';
        const cost = live && m.perHour != null ? ` · ≈ $${(+m.perHour).toFixed(2)}/h` : '';
        const title = m.fallback ? 'The server reached for the models and fell back to its mock (no credit, or a failed call): the folk use their own words.' : m.cast ? `${m.cast} personas cast; ${m.calls || 0} thoughts so far` : 'the personas are not cast yet';
        return h('span.ag-ledger__mind' + (live ? '.is-live' : ''), { title }, `${word}${m.cast ? '' : ', not yet cast'}${cost}`);
      };
      s.append(h('footer.ag-ledger__foot', null, mindLine(),
        h('span.ag-ledger__keys', { html: '<span class="ag-kbd">Tab</span> or <span class="ag-kbd">Esc</span> to close' })));
      bumped.clear();
      return p.wrap;
    }
    function render() { if (!el) return; const n = sheet(); n.classList.add('is-static'); el.replaceWith(n); el = n; }
    function open() {
      if (el) return;
      letters.close(); agentCard.hide(); hint.hide();
      el = sheet(); layer.append(el); place.el.setAttribute('aria-expanded', 'true'); layer.classList.add('is-ledger');
    }
    function close() {
      if (!el) return; const e = el; el = null; place.el.setAttribute('aria-expanded', 'false'); layer.classList.remove('is-ledger');
      leave(e, 'is-out', 300);
    }
    // §18: a quiet line for the ledger only (never a notice); the last 12 are kept, 5 shown
    function note(text) {
      let t = String(text || '').replace(/\s+/g, ' ').trim(); if (!t) return;
      if (t.length > 96) { const cut = t.slice(0, 95), sp = cut.lastIndexOf(' '); t = (sp > 60 ? cut.slice(0, sp) : cut).replace(/[,;:.\s]+$/, '') + '…'; }   // one sheet, no scroll
      S.society.push(t); if (S.society.length > 12) S.society.shift(); render();
    }
    function setMind(m) { S.mind = m ? { mode: m.mode || 'mock', cast: m.cast ? (m.castCount || m.cast) : 0, calls: m.calls || 0, perHour: m.perHour ?? null, fallback: !!m.fallback } : null; render(); }
    return { open, close, render, toggle() { el ? close() : open(); }, get isOpen() { return !!el; }, get el() { return el; }, _bump(k) { bumped.add(k); }, note, setMind, get society() { return S.society.slice(); } };
  })();

  // ======================= agent card v2: on click only, one small paper card =======================
  // Name, species, job + workplace (and an entrepreneur's venture), personality traits with plain meanings, a mood
  // word, every skill (the known ones ticked, the unknown ones '?'), the minister's seal; Talk and Make minister
  // (not during the opening election); the last four lines of talk.
  const agentCard = (() => {
    let el = null, curId = null, cur = null, at = null, curOpts = {};
    function hide() {
      if (el) { leave(el, 'is-out', 260); el = null; }
      const was = curId; curId = null; cur = null;
      if (was != null) talk._cardClosed(was);
    }
    const isMin = (agent, o) => o.isMinister ?? (ministerSeal.agentId != null && ministerSeal.agentId === agent.id);
    function build(agent, o = {}) {
      const sp = SPECIES[agent.species], known = agent.known || {};
      const minister = isMin(agent, o);
      const p = paper('ag-card', hash(agent.id) % 83 + 5, { amp: 2.2, n: 40 });
      const colour = sp ? sp.colour : '#2a2330';
      const seal = sealSVG(colour, (agent.name || '?')[0], 48, hash(agent.id) % 97, colour === '#ffe800' ? 'rgba(42, 35, 48,.72)' : undefined);
      const { title, place } = jobOf(agent, lookup);
      const v = ventureOf(agent);
      const traits = (Array.isArray(agent.traits) ? agent.traits : Array.isArray(known.traits) ? known.traits : []).slice(0, 3);
      const mood = agent.mood, tired = agent.energy != null && agent.energy < 30;
      const wears = typeof agent.wears === 'string' ? agent.wears : agent.look && typeof agent.look.desc === 'string' ? agent.look.desc : null;
      const skills = SKILLS.map(k => {
        const kn = !!(known[k] && agent.skills && agent.skills[k] != null);
        return h('div.ag-skill' + (kn ? '' : '.is-unknown'), { title: kn ? `${k}: ${Math.round(agent.skills[k])} of 10` : `${k}: not yet known` }, h('span.k', null, k),
          kn ? h('span.ticks', null, Array.from({ length: 10 }, (_, i) => h('i' + (i < Math.round(agent.skills[k]) ? '.on' : '')))) : h('span.q', null, '?'));
      });
      const electing = election.active;
      const talkBtn = h('button.ag-link.ag-link--ink.ag-card__talkbtn', { type: 'button', on: { click: e => { e.currentTarget.blur(); talk.open(agent.id); } } }, 'Talk');
      const minBtn = electing ? null : minister ? h('span.ag-card__isMin', null, 'your minister')
        : h('button.ag-link.ag-card__minbtn', { type: 'button', on: { click: () => fire(onAgentAction, agent.id, 'minister') } }, 'Make minister');
      // §15: the folk's painted portrait heads the card (the species seal until it arrives); the minister's seal is a
      // small badge pressed onto the portrait's edge
      const portrait = h('span.ag-card__face', { style: { '--c': colour } }, mail.face(agent.id, 64, seal),
        minister ? h('span.ag-card__minseal', { title: 'carries the minister’s seal', html: sealSVG('#e0503f', 'M', 26, 43) }) : null);
      add(p.sheet,
        h('div.ag-card__head', null, portrait,
          h('div.ag-card__id', null, h('div.ag-card__name', null, agent.name || 'Someone'),
            h('div.ag-card__sp', null, sp ? `${article(sp.name)} ${sp.name}` : 'one of the folk'))),
        h('div.ag-card__job', null,
          h('span.t', null, title ? cap(title) : 'No job yet'),
          place ? h('span.p', null, ' ' + atPlace(place)) : title && !/\bof\b|minister|gone/i.test(title) ? h('span.p.is-none', null, ', no workplace yet') : null),
        v ? h('div.ag-card__venture', null, ventureLine(v)) : null,
        wears ? h('div.ag-card__wears', null, `wears ${wears.replace(/^wears\s+/i, '')}`) : null,
        h('div.ag-card__mood', null, h('span.m', { style: { '--c': moodInk(mood ?? 50) } }), h('span.w', null, moodWord(mood) + (tired ? ', and tired' : '')),
          agent.status && agent.status !== 'idle' ? h('span.st', null, agent.status) : null),
        traits.length ? h('div.ag-card__traits', null, traits.map(t => h('div.ag-trait', null, h('span.t', null, t), traitMeaning(t) ? h('span.m', null, traitMeaning(t)) : null))) : null,
        h('div.ag-card__skills', null, skills),
        h('div.ag-card__acts', null, talkBtn, minBtn ? h('span.sep', null, '·') : null, minBtn),
        h('div.ag-card__talk', { 'aria-live': 'polite' }));
      return p.wrap;
    }
    function renderLog(card, id) {
      const box = card && card.querySelector('.ag-card__talk'); if (!box) return;
      const lines = talk._log(id).slice(-4);
      box.replaceChildren(...lines.map(l => h('div.ag-card__said' + (l.me ? '.is-me' : ''), null, h('span.who', null, l.me ? 'you' : (cur && cur.name) || 'them'), h('span.txt', null, l.text))));
      box.hidden = !lines.length;
      card.classList.toggle('has-talk', lines.length > 0);   // phones fold the skills away while talking
    }
    function show(agent, { x = innerWidth / 2, y = innerHeight / 2 } = {}, opts = {}) {
      if (!agent) return hide();
      if (curId != null && curId !== agent.id) talk._cardClosed(curId);
      if (el) el.remove();
      cur = agent; curId = agent.id; at = { x, y }; curOpts = opts || {};
      el = build(agent, curOpts); layer.append(el);
      renderLog(el, agent.id);
      placeCard(el, x, y); keepOn(el);
    }
    // rebuild in place (a new minister, the election ending, fresh data from the sim)
    function refresh(agent) {
      if (!el || curId == null) return;
      const a = agent || agentOf(curId) || cur; if (!a) return;
      cur = a;
      const n = build(a, curOpts); n.style.left = el.style.left; n.style.top = el.style.top; n.style.animation = 'none';
      el.replaceWith(n); el = n; renderLog(el, curId); keepOn(el);
    }
    // after it grows (talk lines): still on screen and clear of the voice mark
    function keepOn(card) {
      const r = card.getBoundingClientRect(), g = 16;
      let limit = innerHeight - g;
      const m = layer.querySelector('.ag-voice__mark'), mr = m && m.getBoundingClientRect();
      if (mr && mr.width && r.left < mr.right + 8 && r.right > mr.left - 8) limit = Math.min(limit, mr.top - 10);
      if (r.bottom > limit) card.style.top = Math.max(g, limit - r.height) + 'px';
    }
    // near the cursor, fully on screen, clear of the stack, the name, the voice mark and the folk's talk line
    function placeCard(card, x, y) {
      const r = card.getBoundingClientRect(), w = r.width, ht = r.height, g = 16, W = innerWidth, H = innerHeight;
      const vis = e => { const s = getComputedStyle(e); return !e.hidden && s.display !== 'none' && s.visibility !== 'hidden' && +s.opacity > .05; };
      const obs = [...layer.querySelectorAll('.ag-stack, .ag-place, .ag-voice__mark, .ag-type, .ag-talk'), ...document.querySelectorAll('.editions, .closeup-btn, .tweaks-toggle')]
        .filter(vis).map(e => e.getBoundingClientRect()).filter(b => b.width && b.height).map(b => ({ l: b.left - 8, t: b.top - 8, r: b.right + 8, b: b.bottom + 8 }));
      const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
      const cands = [[x + 46, y - ht * .4], [x - w - 46, y - ht * .4], [x + 18, y + 14], [x - w - 18, y + 14], [x + 18, y - ht - 14], [x - w - 18, y - ht - 14]]
        .map(([px, py]) => [clamp(px, g, Math.max(g, W - g - w)), clamp(py, g, Math.max(g, H - g - ht))]);
      // beside or above the folk's talk line, when it is open
      const tk = layer.querySelector('.ag-talk'), tb = tk && tk.getBoundingClientRect();
      if (tb && tb.width) for (const [px, py] of [[tb.left - w - 14, y - ht * .4], [tb.right + 14, y - ht * .4], [tb.left + tb.width / 2 - w / 2, tb.top - ht - 14], [tb.left + tb.width / 2 - w / 2, tb.bottom + 14]])
        cands.push([clamp(px, g, Math.max(g, W - g - w)), clamp(py, g, Math.max(g, H - g - ht))]);
      // never over the folk itself (a disc round the click)
      const folk = { l: x - 30, t: y - 60, r: x + 30, b: y + 26 };
      const all = [...obs, folk];
      const cover = ([px, py]) => all.reduce((sum, o) => sum + Math.max(0, Math.min(px + w, o.r) - Math.max(px, o.l)) * Math.max(0, Math.min(py + ht, o.b) - Math.max(py, o.t)), 0);
      let best = cands[0], bc = Infinity;
      cands.forEach((c, i) => { const v = cover(c) + i; if (v < bc) { bc = v; best = c; } });
      if (cover(best) > 0) { const top = Math.min(...obs.filter(o => o.t > H * .55).map(o => o.t), H - g); best = [best[0], clamp(Math.min(best[1], top - ht - 4), g, Math.max(g, H - g - ht))]; }
      card.style.left = best[0] + 'px'; card.style.top = best[1] + 'px';
    }
    return { show, hide, refresh, get agentId() { return curId; }, get el() { return el; }, get agent() { return cur; }, get at() { return at; },
      _replace() { if (el && at) { placeCard(el, at.x, at.y); keepOn(el); } },
      _log(id) { if (el && curId === id) { renderLog(el, id); keepOn(el); } } };
  })();

  // ======================= talk: a folk answers in a small paper speech bubble =======================
  // Talk on the card (or holding Space while a folk is selected: the game routes the transcript to talk.say when
  // talk.target is set) opens one underlined line under the folk's speech bubble. onTalk(agentId, text, {source})
  // may return the reply (a string or a Promise of one); otherwise the game calls talk.reply(agentId, text). With no
  // answer at all (no onTalk, no server, no model) the folk answer in their own plain words (words.js plainReply).
  // The bubble is drawn by the `bubble` hook when the game passes one (agents.bubble), else here, with the same look.
  const talk = (() => {
    const logs = new Map(), waiting = new Map();
    let box = null;          // { id, el, bubble, txt, form, input, at, raf, open, timer }
    const nameOf = id => (agentOf(id) || (agentCard.agentId === id ? agentCard.agent : null) || {}).name || 'them';
    function anchor(b) {
      try { const p = lookup.anchor && lookup.anchor(b.id); if (p && isFinite(p.x) && isFinite(p.y)) return { x: p.x, y: p.y, live: true }; } catch (_) {}
      return b.at;
    }
    function place(b) {
      const p = anchor(b);
      if (!p) { b.el.style.visibility = 'hidden'; return; }
      b.el.style.visibility = '';
      const r = b.el.getBoundingClientRect(), g = 12, w = r.width || 280;
      const x = Math.max(g + w / 2, Math.min(innerWidth - g - w / 2, p.x));
      const y = Math.max(r.height + g, Math.min(innerHeight - 70, p.y));
      b.el.style.left = x.toFixed(1) + 'px'; b.el.style.top = y.toFixed(1) + 'px';
      b.el.style.setProperty('--tx', Math.max(-w / 2 + 22, Math.min(w / 2 - 22, p.x - x)).toFixed(1) + 'px');
    }
    function loop() { if (!box) return; place(box); box.raf = requestAnimationFrame(loop); }
    function ensure(id, at) {
      if (box && box.id === id) { if (at) box.at = at; return box; }
      drop(true);
      const nm = nameOf(id);
      const txt = h('div.ag-bubble__txt');
      const bubble = h('div.ag-bubble', { hidden: true, 'aria-live': 'polite' }, h('div.ag-bubble__paper', null, txt), h('span.ag-bubble__tail', { 'aria-hidden': 'true' }));
      const input = h('input.ag-talk__input', { type: 'text', placeholder: `say something to ${nm}…`, 'aria-label': `Talk to ${nm}`, autocomplete: 'off', spellcheck: false, enterKeyHint: 'send' });
      const form = h('form.ag-talk__line', { hidden: true }, input, h('span.ag-talk__keys', { html: '<span>enter</span> · or hold <span>Space</span>' }));
      const el = h('div.ag-talk', null, bubble, form);
      layer.append(el);
      const cardAt = agentCard.agentId === id ? agentCard.at : null;
      const b = box = { id, el, bubble, txt, form, input, at: at || (cardAt ? { x: cardAt.x, y: cardAt.y - 34 } : { x: innerWidth / 2, y: innerHeight * .45 }), raf: 0, open: false, timer: 0 };
      form.addEventListener('submit', e => { e.preventDefault(); const t = input.value.trim(); if (!t) return; input.value = ''; say(t, { source: 'typed', agentId: b.id }); });
      for (const ev of ['keydown', 'keyup', 'keypress']) input.addEventListener(ev, e => {
        // Space on an empty line is push-to-talk: let it through to the voice module (the line gives up focus)
        if (e.code === 'Space' && !input.value) { if (ev === 'keydown' && !e.repeat) input.blur(); return; }
        e.stopPropagation();
        if (ev === 'keydown' && e.key === 'Escape') { e.preventDefault(); close(); }
      });
      place(b); b.raf = requestAnimationFrame(loop);
      return b;
    }
    function drop(now = false) {
      if (!box) return; const b = box; box = null;
      cancelAnimationFrame(b.raf); clearTimeout(b.timer);
      layer.classList.remove('is-talking');
      if (now) b.el.remove(); else leave(b.el, 'is-out', 360);
    }
    function open(agentOrId, { at = null, focus = true } = {}) {
      const id = agentOrId && typeof agentOrId === 'object' ? agentOrId.id : agentOrId;
      if (id == null) return;
      const b = ensure(id, at);
      b.open = true; b.form.hidden = false; layer.classList.add('is-talking');
      place(b);
      if (focus) { b.input.focus({ preventScroll: true }); requestAnimationFrame(() => box === b && b.input.focus({ preventScroll: true })); }
      fire(onAgentAction, id, 'talk');
      // the card steps aside if the line landed on it
      const c = agentCard.el;
      if (c && agentCard.agentId === id) {
        const cr = c.getBoundingClientRect(), tr = b.el.getBoundingClientRect();
        if (cr.left < tr.right && cr.right > tr.left && cr.top < tr.bottom && cr.bottom > tr.top) agentCard._replace();
      }
    }
    // the line goes; a bubble still showing stays for the rest of its time
    function close() {
      if (!box) return;
      const b = box;
      if (document.activeElement === b.input) b.input.blur();
      b.open = false; b.form.hidden = true; layer.classList.remove('is-talking');
      if (b.bubble.hidden || b.thinking) drop();
      else { clearTimeout(b.timer); b.timer = setTimeout(() => { if (box === b && !b.open) drop(); }, 3200); }
    }
    function push(id, me, text) {
      const l = logs.get(id) || []; l.push({ me, text: String(text) }); if (l.length > 24) l.shift(); logs.set(id, l);
      agentCard._log(id);
    }
    function showBubble(id, text, { thinking = false } = {}) {
      const ttl = thinking ? 0 : Math.max(3800, Math.min(9000, 2400 + String(text).length * 60));
      let external = false;
      if (typeof bubble === 'function') { try { external = bubble(id, thinking ? '' : text, { thinking, ttl }) === true; } catch (e) { console.error('[ui]', e); } }
      if (external) { if (box && box.id === id) { box.bubble.hidden = true; if (!box.open) drop(); } return; }
      const b = ensure(id);
      b.thinking = thinking;
      b.txt.replaceChildren(thinking ? h('span.ag-dots', { 'aria-label': `${nameOf(id)} is thinking` }, h('i'), h('i'), h('i')) : String(text));
      b.bubble.classList.toggle('is-thinking', thinking);
      const was = b.bubble.hidden; b.bubble.hidden = false;
      if (!reduceMotion()) b.bubble.animate(was ? [{ opacity: 0, transform: 'translateY(6px) scale(.9)' }, { opacity: 1, transform: 'none' }] : [{ transform: 'scale(.97)' }, { transform: 'none' }], { duration: was ? 320 : 220, easing: 'cubic-bezier(.3,1.4,.5,1)' });
      place(b);
      clearTimeout(b.timer);
      if (ttl) b.timer = setTimeout(() => {
        if (box !== b) return;
        if (b.open) return;            // while the line is open, the last answer stays until the next question
        drop();
      }, ttl);
    }
    function fallback(id, text) {
      const a = { id, name: nameOf(id), ...(agentCard.agentId === id ? agentCard.agent : null), ...agentOf(id) };
      reply(id, plainReply(a, text));
    }
    function say(text, { source = 'typed', agentId } = {}) {
      const id = agentId ?? target(); const t = String(text || '').trim();
      if (id == null || !t) return false;
      const b = ensure(id);
      if (!b.open && agentCard.agentId === id && source !== 'typed') { /* voice: bubble only, the card shows the log */ }
      push(id, true, t);
      idle.poke();
      showBubble(id, '', { thinking: true });
      clearTimeout(waiting.get(id));
      const res = fire(onTalk, id, t, { source, agent: agentOf(id) || agentCard.agent });
      const later = ms => waiting.set(id, setTimeout(() => { waiting.delete(id); fallback(id, t); }, ms));
      if (typeof onTalk !== 'function') later(reduceMotion() ? 200 : 750);
      else if (typeof res === 'string' && res.trim()) reply(id, res);
      else if (res && typeof res.then === 'function') {
        later(12000);
        res.then(r => { const s = typeof r === 'string' ? r : r && (r.text || r.say || r.reply); if (s && String(s).trim()) reply(id, s); else if (waiting.has(id)) { clearTimeout(waiting.get(id)); waiting.delete(id); fallback(id, t); } })
          .catch(() => { if (waiting.has(id)) { clearTimeout(waiting.get(id)); waiting.delete(id); fallback(id, t); } });
      } else later(9000);
      return true;
    }
    function reply(agentId, text) {
      const t = String(text || '').trim(); if (agentId == null || !t) return;
      clearTimeout(waiting.get(agentId)); waiting.delete(agentId);
      push(agentId, false, t);
      showBubble(agentId, t);
    }
    function target() { return box && box.open ? box.id : agentCard.agentId; }
    return { open, close, say, reply, thinking: id => showBubble(id, '', { thinking: true }),
      get target() { return target(); }, get isOpen() { return !!(box && box.open); }, get agentId() { return box ? box.id : null; }, get el() { return box ? box.el : null; },
      history: id => (logs.get(id) || []).slice(), isTyping: () => !!(box && document.activeElement === box.input),
      _log: id => logs.get(id) || [], _cardClosed(id) { if (box && box.id === id && box.open) close(); },
      _listening(on) { if (box && box.open) { box.form.classList.toggle('is-listening', !!on); box.input.placeholder = on ? 'listening…' : `say something to ${nameOf(box.id)}…`; } } };
  })();
  hooks.listening = on => talk._listening(on);

  // ======================= the opening: fleet captions, then the election =======================
  // fleet.caption: an elegant lower-third while the camera visits each square ("The Builders · four flits · two
  // floaties"). election.prompt: one calm centred line, "Choose your minister — click one of them". The game turns a
  // click on a folk into election.elected(agent): a short seal moment, "Olla is your minister".
  const GLYPH_SP = {
    flit: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 5.2h10" stroke="#2a2330" stroke-width="1.3" stroke-linecap="round"/><path d="M10 5.2v2" stroke="#2a2330" stroke-width="1.2"/><circle cx="10" cy="12.6" r="5.6" fill="#8fc46a"/><path d="M5.6 9.8a5.6 4 0 0 1 8.8 0z" fill="#e0503f"/></svg>',
    floatie: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 8.4a7 5.4 0 0 1 14 0z" fill="#e0503f"/><path d="M6.5 8.4a3.5 5.4 0 0 1 7 0z" fill="#f6efdf"/><path d="M10 8.4v4.2" stroke="#2a2330" stroke-width="1"/><circle cx="10" cy="15" r="3.4" fill="#fbf6ec" stroke="rgba(42, 35, 48,.45)" stroke-width=".8"/></svg>'
  };
  const fleet = (() => {
    let el = null, timer = 0;
    function caption({ name = 'The Builders', line = null, counts = null, note = null, index = null, total = null, ttl = 0 } = {}) {
      clearTimeout(timer);
      if (el) { leave(el, 'is-out', 600); el = null; }
      const kicker = index ? (total ? `Fleet ${ordWord(index)} of ${ordWord(total)}` : `Fleet ${ordWord(index)}`) : 'A fleet';
      const parts = counts ? Object.entries(counts).filter(([, n]) => n > 0) : null;
      // §24: while the onboarding panel shows, the fleet is named there (one quiet line), never as a big caption
      if (guide.visible) {
        const cnt = parts && parts.length ? parts.map(([sp, n]) => fleetLine({ [sp]: n })).join(' · ') : (line || '');
        guide.aside({ html: `<b>${esc(name)}</b>${cnt ? ` <span class="c">${esc(cnt)}</span>` : ''}${index && total ? ` <span class="n">${index} / ${total}</span>` : ''}${note ? `<em>${esc(note)}</em>` : ''}` });
        return null;
      }
      const lineEl = parts && parts.length
        ? h('div.ag-fleet__line', null, parts.map(([sp, n], i) => [i ? h('span.dot', null, '·') : null, h('span.c', null, GLYPH_SP[sp] ? h('span.g', { html: iconSlot(sp, 22, GLYPH_SP[sp]) }) : null, fleetLine({ [sp]: n }))]))
        : line ? h('div.ag-fleet__line', null, line) : null;
      el = h('div.ag-fleet', { role: 'status', 'aria-live': 'polite' },
        h('div.ag-fleet__k', null, kicker),
        h('div.ag-fleet__name', null, name),
        h('div.ag-fleet__rule'),
        lineEl,
        note ? h('div.ag-fleet__note', null, note) : null);
      layer.append(el);
      if (ttl > 0) timer = setTimeout(hide, ttl);
      return el;
    }
    function hide() { clearTimeout(timer); if (el) { leave(el, 'is-out', 600); el = null; } }
    return { caption, hide, get visible() { return !!el; }, line: fleetLine };
  })();

  const election = (() => {
    let el = null, moment = null, active = false, momentT = 0;
    const NOTE = 'Your minister speaks for the folk and carries your seal. Later on, the folk will hold their own elections.';
    function prompt({ title = 'Choose your minister', action = 'click one of them', note = NOTE } = {}) {
      if (el) el.remove();
      active = true; layer.classList.add('is-electing');
      if (guide.visible) { el = null; agentCard.hide(); agentCard.refresh(); return null; }   // §24: the panel asks
      const who = h('div.ag-elect__who', { hidden: true });
      el = h('div.ag-elect', { role: 'status', 'aria-live': 'polite' },
        h('div.ag-elect__k', null, 'The first choice'),
        h('div.ag-elect__line', null, h('span', null, title), h('span.dash', null, ' — '), h('em', null, action)),
        h('div.ag-elect__note', null, note), who);
      layer.append(el);
      agentCard.hide(); agentCard.refresh();
      return el;
    }
    // optional: the folk under the cursor, named under the prompt
    function hover(agent) {
      if (!el && guide.visible && active) {
        if (!agent) { guide.aside(null); return; }
        const { title } = jobOf(agent, lookup);
        const sub = [agent.species && `${article(agent.species)} ${agent.species}`, title].filter(Boolean).join(', ');
        guide.aside({ html: `<b>${esc(agent.name || 'Someone')}</b>${sub ? ` <span class="c">${esc(sub)}</span>` : ''}${agent.traits && agent.traits[0] ? ` <span class="n">${esc(agent.traits[0])}</span>` : ''}` });
        return;
      }
      if (!el) return; const w = el.querySelector('.ag-elect__who');
      if (!agent) { w.hidden = true; el.classList.remove('is-hovering'); return; }
      const { title } = jobOf(agent, lookup);
      w.replaceChildren(h('b', null, agent.name || 'Someone'), ` · ${[agent.species && `${article(agent.species)} ${agent.species}`, title].filter(Boolean).join(', ')}`,
        ...(agent.traits && agent.traits[0] ? [h('span.tr', null, ` · ${agent.traits[0]}`)] : []));
      w.hidden = false; el.classList.add('is-hovering');
    }
    function elected(agent, { ttl = 3800, seal = true } = {}) {
      if (!agent) return Promise.resolve();
      if (el) { const e = el; el = null; leave(e, 'is-out', 500); }
      if (guide.visible) {          // §24: the panel says it (the onboarding's step 5), no seal moment over the world
        if (seal) ministerSeal.set(agent, { quiet: true });
        guide.aside(null); end();
        return Promise.resolve();
      }
      clearTimeout(momentT); if (moment) moment.remove();
      const { title } = jobOf(agent, lookup);
      const sub = [agent.species && `${article(agent.species)} ${agent.species}`, title].filter(Boolean).join(' · ');
      moment = h('div.ag-elected', { role: 'status', 'aria-live': 'assertive' },
        h('div.ag-elected__seal', { html: sealSVG('#e0503f', (agent.name || 'M')[0], 104, hash(agent.id) % 97 + 3) }),
        h('div.ag-elected__k', null, 'Elected'),
        h('div.ag-elected__line', null, h('span.nm', null, agent.name || 'Someone'), ' is your minister'),
        sub ? h('div.ag-elected__sub', null, sub + ' · carries your seal from today') : null,
        h('span.ag-elected__fl', { html: FLOURISH_SVG }));
      layer.append(moment);
      if (seal) ministerSeal.set(agent, { quiet: true });
      return new Promise(res => {
        const m = moment;
        const done = () => { if (moment === m) { moment = null; leave(m, 'is-out', 700); } end(); res(); };
        if (ttl > 0) momentT = setTimeout(done, reduceMotion() ? Math.min(ttl, 1500) : ttl); else m._done = done;   // ttl 0: holds until end()
      });
    }
    function end() {
      if (moment && moment._done) { const d = moment._done; moment._done = null; d(); return; }
      active = false; layer.classList.remove('is-electing');
      if (el) { const e = el; el = null; leave(e, 'is-out', 500); }
      agentCard.refresh();
    }
    return { prompt, hover, elected, end, get active() { return active || !!el; }, get visible() { return !!(el || moment); } };
  })();

  // ======================= the pick prompt: choose some folk in the world (an institution's members, a crew) =======================
  // ui.pick.show({ title, hint, min, max, count, kicker, onDone, onCancel, onRemove }): a small calm card at the top
  // centre (the election prompt's voice, but compact). Clicks pass through to the world: the game turns a click on a
  // folk into its own list and calls ui.pick.update(list) (agents or ids), and each chosen folk's painted portrait
  // pops into the card's row. "Done" (Enter) is live once `min` are chosen -> onDone(ids, agents); "cancel" (Esc) ->
  // onCancel(). onDone returning false keeps the card open. `count`: how many are chosen already (before the first
  // update), or a function (n, {min, max}) -> the counter's words. onRemove(id), if given, makes each portrait a
  // button that takes that folk out again. hover(agent|null) names the folk under the cursor.
  const pick = (() => {
    let el = null, o = null, list = [], row = null, counter = null, done = null, who = null, ro = null;
    const toAgent = x => x == null ? null : typeof x === 'object' ? (agentOf(x.id) ? { ...agentOf(x.id), ...x } : x) : (agentOf(x) || { id: x, name: String(x) });
    const words = n => typeof o.count === 'function' ? String(o.count(n, { min: o.min, max: o.max }))
      : o.max && o.max < 99 ? `${n} of ${o.max} chosen` : `${n} chosen`;
    function chip(a, fresh) {
      const sp = SPECIES[a.species], colour = sp ? sp.colour : '#2a2330';
      const seal = sealSVG(colour, (a.name || '?')[0], 40, hash(a.id) % 97, colour === '#ffe800' ? 'rgba(42, 35, 48,.72)' : undefined);
      const face = h('span.ag-pick__face', { style: { '--c': colour } }, mail.face(a.id, 40, seal));
      const nm = h('span.ag-pick__nm', null, a.name || 'Someone');
      const rm = typeof o.onRemove === 'function';
      const c = h(rm ? 'button.ag-pick__chip' : 'span.ag-pick__chip', rm ? { type: 'button', title: `take ${a.name || 'them'} out`, 'aria-label': `Take ${a.name || 'them'} out`,
        'data-id': String(a.id), on: { click: e => { e.currentTarget.blur(); fire(o.onRemove, a.id); } } } : { 'data-id': String(a.id) }, face, nm);
      if (fresh) c.classList.add('is-new');
      return c;
    }
    function render(prev = new Set()) {
      if (!el) return;
      const n = list.length || (typeof o.count === 'number' ? o.count : 0);
      const slots = Math.max(0, Math.min(o.max || 6, Math.max(o.min || 1, list.length + 1)) - list.length);
      row.replaceChildren(...list.map(a => chip(a, !prev.has(String(a.id)))),
        ...Array.from({ length: list.length >= (o.max || 99) ? 0 : slots }, (_, i) => h('span.ag-pick__slot' + (i === 0 ? '.is-next' : ''), { 'aria-hidden': 'true' })));
      counter.textContent = words(n);
      const ok = n >= (o.min ?? 1) && (!o.max || n <= o.max);
      done.disabled = !ok || undefined;
      done.title = ok ? 'Done (Enter)' : `choose at least ${o.min ?? 1}`;
      measure();
    }
    // the notices slide down under the card while it shows (both live at the top centre)
    function measure() { requestAnimationFrame(() => { if (el) layer.style.setProperty('--ag-pick-b', Math.round(el.getBoundingClientRect().bottom) + 'px'); }); }
    function show(opts = {}) {
      if (el) { const e = el; el = null; e.remove(); }
      o = { title: 'Choose some of the folk', hint: 'click folk, then Done', min: 1, max: 6, kicker: null, ...opts };
      list = [];
      if (Array.isArray(o.list)) list = o.list.map(toAgent).filter(Boolean);
      const p = paper('ag-pick', hash(String(o.title)) % 71 + 9, { amp: 1.4, n: 30 });
      row = h('div.ag-pick__row', { role: 'list', 'aria-label': 'Chosen' });
      counter = h('span.ag-pick__count', { 'aria-live': 'polite' });
      who = h('div.ag-pick__who', { hidden: true });
      done = h('button.ag-pick__done', { type: 'button', on: { click: e => { e.currentTarget.blur(); finish(); } } }, 'Done');
      add(p.sheet,
        o.kicker ? h('div.ag-pick__k', null, o.kicker) : null,
        h('div.ag-pick__title', null, o.title),
        h('div.ag-pick__hint', null, h('span', null, o.hint), h('span.sep', null, '·'), counter),
        row, who,
        h('div.ag-pick__acts', null, done,
          h('button.ag-link.ag-pick__cancel', { type: 'button', title: 'cancel (Esc)', on: { click: e => { e.currentTarget.blur(); cancel(); } } }, 'cancel')));
      el = p.wrap; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', o.title);
      layer.append(el); layer.classList.add('is-picking');
      agentCard.hide();
      render();
      if (!ro && typeof ResizeObserver === 'function') { ro = new ResizeObserver(measure); }
      ro && ro.observe(el);
      return el;
    }
    function update(next = []) {
      if (!el) return;
      const prev = new Set(list.map(a => String(a.id)));
      list = (Array.isArray(next) ? next : [next]).map(toAgent).filter(Boolean);
      render(prev);
    }
    function hover(agent) {
      if (!el) return;
      const a = toAgent(agent);
      if (!a) { who.hidden = true; return; }
      const { title } = jobOf(a, lookup);
      const chosen = list.some(x => String(x.id) === String(a.id));
      who.replaceChildren(h('b', null, a.name || 'Someone'), ` · ${[a.species && `${article(a.species)} ${a.species}`, title].filter(Boolean).join(', ')}`,
        ...(chosen ? [h('span.in', null, ' · chosen')] : []));
      who.hidden = false; measure();
    }
    function hide() {
      if (!el) return;
      const e = el; el = null; ro && ro.disconnect();
      layer.classList.remove('is-picking'); layer.style.removeProperty('--ag-pick-b');
      if (document.activeElement && e.contains(document.activeElement)) document.activeElement.blur();
      leave(e, 'is-out', 320);
    }
    function finish() {
      if (!el || done.disabled) return false;
      const agents = list.map(a => ({ ...a }));
      const r = fire(o.onDone, agents.map(a => a.id), agents);
      if (r !== false) { el.classList.add('is-done'); hide(); }
      return true;
    }
    function cancel() { if (!el) return; const fn = o.onCancel; hide(); fire(fn); }
    return { show, update, hover, hide, done: finish, cancel, get active() { return !!el; }, get list() { return list.map(a => a.id); }, get el() { return el; } };
  })();

  // reply links (meeting, decree): "say <phrase>", quiet and underlined
  const replyLinks = (options, id, after) => {
    const btns = options.slice(0, 3).map(o => h('button.ag-reply', { type: 'button', on: { click: e => {
      const b = e.currentTarget; b.blur();
      btns.forEach(x => { x.disabled = x !== b; }); b.setAttribute('aria-pressed', 'true');
      voiceBar.setCaption(o.says || o.label, true, { who: 'you said' }); voiceBar._used(); idle.poke();
      fire(onLetterOption, id, o.says || o.label);
      after && after();
    } } }, h('i', null, 'say'), h('span', null, o.label || o.says)));
    return btns;
  };

  // ======================= meeting letterbox (the Assembly / up-close scene) =======================
  const meeting = (() => {
    let el = null, ro = null;
    function setBand(px) { document.documentElement.style.setProperty('--ag-band-b', px + 'px'); }
    function show({ title = 'A meeting at the town centre', kicker = 'The folk are gathered', report = '', options = [], minister = null, id = 'meeting' } = {}) {
      if (el) { el.remove(); ro && ro.disconnect(); }
      const t = paper('ag-band ag-band--t', 71, { amp: 3 }), b = paper('ag-band ag-band--b', 73, { amp: 3 });
      add(t.sheet, h('span.ag-kicker', null, kicker), h('div.tt', null, title));
      const m = minister || (ministerSeal.agentId != null ? (agentOf(ministerSeal.agentId) || S.minister) : null);
      add(b.sheet,
        h('div.ag-band__who', null, h('span', { html: sealSVG('#e0503f', m ? (m.name || 'M')[0] : 'M', 50, 77) }), h('span.nm', null, m ? m.name : 'the Minister'), h('span.ag-kicker', null, 'reports')),
        h('div.ag-band__report', null, report),
        h('div.ag-band__opts', null, replyLinks(options, id)));
      el = h('div.ag-meeting', null, t.wrap, b.wrap);
      layer.append(el); document.body.classList.add('ag-meeting-on'); layer.classList.add('is-meeting');
      ro = new ResizeObserver(() => el && setBand(Math.round(b.wrap.getBoundingClientRect().height)));
      ro.observe(b.wrap);
    }
    function hide() {
      if (!el) return; const e = el; el = null; ro && ro.disconnect(); ro = null;
      setBand(0); document.body.classList.remove('ag-meeting-on'); layer.classList.remove('is-meeting');
      leave(e, 'is-out', 600);
    }
    return { show, hide, get visible() { return !!el; } };
  })();

  // ======================= the director's line (same voice as the caption, a touch larger, with a kicker) =======================
  let dirEl = null, dirTimer = 0;
  function showDirectorCaption(text, { kicker = '', ttl = 0 } = {}) {
    clearTimeout(dirTimer);
    if (dirEl) { const d = dirEl; dirEl = null; d.remove(); }
    if (!text) return;
    dirEl = h('div.ag-director', null, kicker ? h('div.ag-director__k', null, kicker) : null, h('div.txt', { html: emph(text) }));
    layer.append(dirEl);
    if (ttl > 0) dirTimer = setTimeout(hideDirectorCaption, ttl);
  }
  function hideDirectorCaption() { clearTimeout(dirTimer); if (dirEl) { leave(dirEl, 'is-out', 700); dirEl = null; } }

  // ======================= decree: a ceremonial sheet (Earth's envoy, a stage-up) =======================
  const decree = (() => {
    let el = null, timer = 0;
    function show({ id = 'decree', kicker = 'By the three nations, together', title = 'Earth’s envoy', body = '', shields = null, honour = null, options = [], ttl = 0 } = {}) {
      hide(true);
      const ids = shields || S.neighbours.map(n => n.id);
      const p = paper('ag-decree', 307, { amp: 3, n: 48 });
      add(p.sheet,
        h('div.ag-decree__shields', null, ids.slice(0, 3).map((nid, i) => h('span', { style: { animationDelay: (0.5 + i * 0.28) + 's' }, html: shieldSVG(nid, 50, nbSpecies(nid)) }))),
        h('div.ag-decree__k', null, kicker),
        h('h2.ag-decree__title', null, title),
        body ? h('div.ag-decree__body', null, body) : null,
        options.length ? h('div.ag-decree__opts', null, h('div.ag-letter__orn', { 'aria-hidden': 'true' }), replyLinks(options, id, () => setTimeout(() => hide(), 900))) : null,
        h('button.ag-link.ag-decree__close', { type: 'button', on: { click: () => hide() } }, 'fold it away'));
      el = h('div.ag-decree-wrap', { role: 'dialog', 'aria-label': title }, h('div.ag-read__veil', { on: { click: () => hide() } }), p.wrap);
      layer.append(el);
      if (honour) hud.set({ honour });
      if (ttl > 0) timer = setTimeout(() => hide(), ttl);
    }
    function hide(now = false) { clearTimeout(timer); if (!el) return; const e = el; el = null; if (now) e.remove(); else leave(e, 'is-out', 400); }
    return { show, hide, get visible() { return !!el; } };
  })();

  // ======================= onboarding (§24): ONE panel on the lower half of the screen (guide.js) =======================
  // game/onboarding.js drives the six steps by real game events (ui.onboarding.attach(machine)); without a game (ui-lab)
  // start() / step(n) show the steps' words with a button. No welcome letter any more (Sueda: "delete the welcome
  // founder letter"); the fleet captions and the election prompt speak through this panel while it shows.
  const onboarding = (() => {
    let ext = null, cur = 0;
    const N = ONBOARDING_STEPS.length;
    function finish(skipped) { const was = cur; cur = 0; guide.hide(); if (was) fire(onOnboardingDone, { skipped }); idle.arm(); }
    function demo(n) {
      const s = ONBOARDING_STEPS[n - 1];
      if (!s) { finish(false); return; }
      cur = n; hint.hide();
      guide.show({ step: n, total: N, id: s.id, icon: s.icon, pill: s.pill, title: s.title, body: s.body, todo: s.action ? null : s.todo,
        action: { label: s.action || 'Next', onClick: () => demo(n + 1) } });
    }
    const step = n => { if (ext && ext.goto) return ext.goto(n); if (n > N || n < 1) finish(false); else demo(n); };
    return {
      attach(m) { ext = m || null; },
      start() { if (ext) return ext.start(); demo(1); },
      step,
      next() { if (ext && ext.next) return ext.next(); step(cur + 1); },
      skip() { if (ext) return ext.skip(); finish(true); },
      get current() { return ext ? ext.current : cur; },
      get active() { return ext ? !!ext.current : !!cur; },
      steps: ONBOARDING_STEPS
    };
  })();

  // ======================= keys + outside clicks =======================
  const onKey = e => {
    if (e.defaultPrevented || e.isComposing || isField(e.target)) return;
    if (e.key === 'Escape') {
      if (voiceBar.typingOpen) { voiceBar.closeTyping(); return; }
      if (talk.isOpen) { talk.close(); return; }
      if (agentCard.el) { agentCard.hide(); return; }
      if (pick.active) { pick.cancel(); return; }
      if (letters.isCompact) { letters.closeCompact(); return; }
      if (decree.visible) { decree.hide(); return; }
      if (letters.openId) { letters.close(); return; }
      if (mail.notify.column.isOpen) { mail.notify.column.close(); return; }
      if (letters.isFanned) { letters.gather(); return; }
      if (ledger.isOpen) { ledger.close(); return; }
      return;
    }
    if (titleCard.visible) { if (e.key === 'Enter' && document.activeElement?.tagName !== 'BUTTON') titleCard.start(); return; }
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'Enter' && pick.active && document.activeElement?.tagName !== 'BUTTON') { e.preventDefault(); pick.done(); return; }
    if (e.key === 'Enter' && document.activeElement?.tagName !== 'BUTTON') { e.preventDefault(); voiceBar.openTyping(); return; }
    if (e.key === '/') { e.preventDefault(); voiceBar.openTyping(); return; }
    if (e.key === 'Tab' && !letters.openId && !letters.isFanned && !decree.visible && !mail.notify.column.isOpen) { e.preventDefault(); ledger.toggle(); return; }
    if (e.key === 'ArrowRight' && letters.openId && !letters.isCompact) { letters.next(); }
    const inPane = letters.isCompact && document.activeElement && letters.compactEl && letters.compactEl.contains(document.activeElement);
    if (e.key === 'ArrowDown' && inPane) { e.preventDefault(); mail.compact.arrow(); }
    if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && inPane) { e.preventDefault(); mail.reader.go(e.key === 'ArrowLeft' ? -1 : 1); }
  };
  const onDown = e => {
    const c = agentCard.el, tk = talk.el;
    if (c && !c.contains(e.target) && !(tk && tk.contains(e.target))) agentCard.hide();
    else if (!c && talk.isOpen && tk && !tk.contains(e.target)) talk.close();
    const l = ledger.el; if (l && !l.contains(e.target) && !place.el.contains(e.target)) ledger.close();
  };
  addEventListener('keydown', onKey); addEventListener('pointerdown', onDown, true);
  // a button clicked with the mouse gives its focus back, so Space (talk) never re-fires it as a native click
  layer.addEventListener('click', e => {
    if (e.detail <= 0) return;
    const b = e.composedPath().find(n => n.tagName === 'BUTTON');
    if (b && document.activeElement === b) b.blur();
  });
  idle.arm();

  return {
    el: layer, titleCard, onboarding, guide, voiceBar, letters, hud, ledger, agentCard, talk, fleet, election, pick, ministerSeal, meeting, neighbours, hint,
    // §14 mail: notify.letter(letter) / notify.push({...}) / notify.column.open() ...; setPortrait(senderId, dataURL)
    notify: mail.notify, setPortrait: (id, src) => mail.setPortrait(id, src),
    // the typeface set, switched at once: setFont('A'..'G' | 'now') -> the id applied; font -> the current one
    setFont: id => applyFont(id), get font() { return currentFont(); },
    inbox: { open: () => letters.fan(), close: () => letters.gather(), get isOpen() { return letters.isFanned; } },
    notice, updateNotice, closeNotice, offlineNote, showDirectorCaption, hideDirectorCaption, decree, setPaintChrome,
    cinema(on = true) { layer.classList.toggle('is-cinema', !!on); },   // director: a clean frame (no name, stack or voice mark)
    destroy() {
      removeEventListener('keydown', onKey); removeEventListener('pointerdown', onDown, true); idle.stop();
      layer.remove(); document.body.classList.remove('ag-meeting-on', 'ag-title-on', 'ag-no-paint-chrome'); document.documentElement.style.removeProperty('--ag-band-b');
    }
  };
}
