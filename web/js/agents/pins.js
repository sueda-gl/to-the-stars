// Letters living in the world (ART_DIRECTION §14, as revised in §15 at 03:55, and §19): every unread letter is a TINY
// rectangular paper tag above its sender's head. Only this: the sender's painted portrait, the name, ONE short line
// (the letter's gist, at most 40 characters) and 2-3 quick replies as tiny underlined words. Clicking a reply answers
// the letter right there (onReply(letterId, says), as the letter's own options do); clicking the tag body opens the
// letter in the top-right inbox (onOpen(letterId)). Nothing else, as small as it can be.
//
// Calm at the leader view (64 m, ~54 degrees; 2026-10-04):
//   - STACKS: from ~28 m out, senders standing together (their tags' anchors within ~6 m on screen) fold into ONE
//     stack tag: their portraits overlapped + "3 letters · Olla, Pippo, Momo" (the minister first, in red, then unread,
//     then newest), drawn as a little pile of paper with a hairline leader line to every sender. Clicking it fans the
//     individual tiny tags out round the knot (two columns, each with its own leader line, ordered so no lines
//     cross); Esc or a click anywhere else folds them back. Close up the knots fall apart into single tags by
//     themselves (the stack is a screen-space idea).
//   - NEVER OVERLAP: tags and stacks are placed in priority order (minister > unread > read; then nearest) and each
//     takes the first free slot round its anchor (straight up first, then higher, the sides, further out), with a
//     hairline LEADER LINE (+ a dot on the head when it stands off) back to its sender. A slot on another tag is
//     ruled out; a slot on a folk costs; it keeps its slot while that stays good (no hopping) and eases there.
//   - LEGIBLE: the size grows a little with distance (1.0 close up, ~1.22 at the leader view) by font size, not by a
//     scale transform, so the text stays crisp; tags hold to ~130 m and fade by ~190 m (§19: not hidden at 55 m).
//   - THE LENS: anchors go through `project(v)` (the game passes the Tower Planet's planet.toScreen through her
//     fisheye) so a tag sits on its folk at the screen edges too; without it, the plain camera projection.
//   - The speech bubbles yield to tags (bubbles.js fades a bubble a tag covers): `rects()` gives the visible boxes.
//
//   const pins = createPins(ctx, { parent, anchor: target -> THREE.Vector3 | null, portrait: (id, o) -> Promise<url>,
//                                  rev: id -> number, radiusOf, bodies, project: v -> {x, y, behind} | null, isMinister: id -> bool })
//   pins.pin(target, { letterId, unread = true, onOpen, onReply, onClick, from, subject, gist, replies, portrait, initial, minister }) -> handle
//   pins.unpin(letterId) · pins.setUnread(letterId, on) · pins.pinFor(agentId) · pins.list() · pins.rect(letterId)
//   pins.anchorOf(letterId) -> {x,y,z} · pins.reply(letterId, i) · pins.update(dt) (every frame, after the camera moved)
//   pins.stacks() · pins.expand(stackIdOrAgentId) · pins.collapse() · pins.rects() · pins.clear() · pins.dispose() · pins.setVisible(on)
// `replies`: [{ label, says }] (a letter's options) or strings; labels are shortened to a word or three.
// `onClick` is the old envelope callback: still called on a body click when there is no onOpen.
const CSS = `
.agt-layer { position: fixed; inset: 0; pointer-events: none; z-index: 9; overflow: hidden; }
.agt-lines { position: absolute; left: 0; top: 0; width: 100%; height: 100%; overflow: visible; pointer-events: none; }
.agt-lines path { fill: none; stroke: rgba(42, 35, 48, .6); stroke-width: .8px; stroke-linecap: round; transition: opacity .2s ease; }
.agt-lines path.dot { fill: rgba(42, 35, 48, .78); stroke: none; }
.agt { position: absolute; left: 0; top: 0; margin: 0; padding: 0; pointer-events: auto; will-change: transform, opacity;
  font-size: calc(var(--s, 1) * 10px); color: var(--ink, #2a2330); font-family: var(--ag-font-text, "Iowan Old Style", Georgia, serif); font-size-adjust: var(--ag-fsa-text, none);
  -webkit-tap-highlight-color: transparent; }
.agt-in { position: relative; display: block; padding: .32em .72em .42em .42em; border-radius: 2px; background: var(--paper, #f3ecdc);
  box-shadow: 0 0 0 .75px rgba(42, 35, 48, .55), 0 2px 5px rgba(48, 30, 18, .22); animation: agt-pop .32s cubic-bezier(.3, 1.4, .5, 1) backwards; transition: transform .16s ease, box-shadow .16s ease; }
.agt-b { display: grid; grid-template-columns: 1.8em auto; column-gap: .5em; align-items: center; margin: 0; padding: 0; border: 0; background: none; cursor: pointer;
  font: inherit; color: inherit; text-align: left; }
.agt-b:focus-visible { outline: 1px solid var(--red, #e0503f); outline-offset: 2px; border-radius: 2px; }
.agt-p { grid-row: span 2; width: 1.8em; height: 1.8em; border-radius: 50%; background: #efe5cf center / cover no-repeat; box-shadow: 0 0 0 .75px rgba(42, 35, 48, .45); position: relative; }
.agt-p.seal { background: radial-gradient(circle at 40% 35%, #ef6a57, #e0503f 55%, #b8392c); box-shadow: none; }
.agt-p.seal::after { content: attr(data-initial); position: absolute; inset: 0; display: grid; place-items: center; font-style: italic; font-size: 1.1em; line-height: 1; color: #f3ecdc; }
.agt-l { display: block; white-space: nowrap; font-size: 1.25em; line-height: 1.12; max-width: 18.2em; overflow: hidden; text-overflow: ellipsis; }
.agt-n { font-family: var(--ag-font-display, Georgia, serif); font-size-adjust: var(--ag-fsa-display, none); font-weight: 400; }
.agt-n::after { content: " ·"; opacity: .55; }
.agt-m { font-style: italic; }
.agt-c { font-style: normal; font-size: .84em; color: var(--red, #e0503f); margin-left: .16em; }
.agt-r { display: block; white-space: nowrap; line-height: 1.3em; margin-top: .1em; }
.agt-r button { margin: 0 .64em 0 0; padding: 0; border: 0; background: none; cursor: pointer; font: inherit; font-size: 1.1em; font-style: italic; color: var(--ink, #2a2330);
  text-decoration: underline; text-decoration-thickness: .6px; text-underline-offset: 2px; text-decoration-color: rgba(42, 35, 48, .5); }
.agt-r button:last-child { margin-right: 0; }
.agt-r button:hover, .agt-r button:focus-visible { color: var(--red, #e0503f); text-decoration-color: var(--red, #e0503f); outline: none; }
.agt:hover .agt-in, .agt:focus-within .agt-in { transform: translateY(-1px); box-shadow: 0 0 0 .75px rgba(42, 35, 48, .75), 0 3px 8px rgba(48, 30, 18, .26); }
.agt.min .agt-n { color: var(--red, #e0503f); }
.agt.min .agt-p:not(.seal) { box-shadow: 0 0 0 1.25px var(--red, #e0503f); }
.agt.read .agt-in { opacity: .74; }
.agt.read .agt-p:not(.seal) { filter: saturate(.7); }
.agt.sent .agt-r button { opacity: .35; text-decoration: none; pointer-events: none; }
.agt.sent .agt-r button.chosen { opacity: 1; color: var(--red, #e0503f); }
.agt.sent .agt-r button.chosen::before { content: "✓ "; font-style: normal; }
.agt.off { visibility: hidden; pointer-events: none; }
.agt.gone .agt-in { animation: agt-out .3s ease-in both; }
/* the stack: a little pile of paper (two sheets peeking out behind), overlapped portraits, "3 letters · names" */
.agt-k .agt-in { padding: .36em .8em .4em .4em; box-shadow: 0 0 0 .75px rgba(42, 35, 48, .55), 3px -3px 0 -.5px var(--paper, #f3ecdc), 3px -3px 0 .25px rgba(42, 35, 48, .4),
  6px -6px 0 -.5px var(--paper, #f3ecdc), 6px -6px 0 .25px rgba(42, 35, 48, .28), 0 2px 6px rgba(48, 30, 18, .24); }
.agt-k:hover .agt-in, .agt-k:focus-within .agt-in { box-shadow: 0 0 0 .75px rgba(42, 35, 48, .8), 3px -3px 0 -.5px var(--paper, #f3ecdc), 3px -3px 0 .25px rgba(42, 35, 48, .5),
  6px -6px 0 -.5px var(--paper, #f3ecdc), 6px -6px 0 .25px rgba(42, 35, 48, .36), 0 3px 9px rgba(48, 30, 18, .28); }
.agt-k .agt-b { grid-template-columns: auto auto; }
.agt-ps { display: flex; align-items: center; padding-left: .1em; }
.agt-ps .agt-p { grid-row: auto; flex: none; margin-left: -.62em; box-shadow: 0 0 0 1.5px var(--paper, #f3ecdc), 0 0 0 2.25px rgba(42, 35, 48, .4); }
.agt-ps .agt-p:first-child { margin-left: 0; }
.agt-ps .agt-p.minp:not(.seal) { box-shadow: 0 0 0 1.5px var(--paper, #f3ecdc), 0 0 0 2.6px var(--red, #e0503f); }
.agt-k .agt-l { max-width: 21em; }
.agt-k .agt-n { font-family: var(--ag-font-text, Georgia, serif); font-weight: 500; }
.agt-k .agt-n::after { content: none; }
.agt-k .agt-dot { opacity: .55; }
.agt-k .agt-m .mn { color: var(--red, #e0503f); }
.agt-k .agt-m .rd { opacity: .62; }
.agt-k .agt-more { font-style: normal; opacity: .62; }
@keyframes agt-pop { from { transform: translateY(6px) scale(.6); opacity: 0; } to { transform: none; opacity: 1; } }
@keyframes agt-out { to { transform: translateY(-6px) scale(.8); opacity: 0; } }
@media (prefers-reduced-motion: reduce) { .agt-in { animation: none !important; transition: none !important; } }
`;
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const GIST_MAX = 40;
// the knobs (exported for the docs and the tests)
export const TAGS = {
  fadeFrom: 130, fadeTo: 190,         // full up to 130 m, gone by 190 m (§19: visible from the leader view)
  stackFrom: 28,                      // knots fold into stacks only from this far out (close up: single tags)
  knotX: 84, knotY: 46,               // two anchors this close on screen (px at size 1, an ellipse) are one knot
  knotKeep: 1.3,                      // a knot holds until they are this much further apart (no flicker at the edge)
  sizeNear: 1, sizeFar: 1.26,         // the tag's size: 1 close up (<= 18 m), ~1.22 at the 64 m leader view (13.75 -> 15 px type)
};
// one line, at most 40 characters, cut on a word
export function gistOf(text, max = GIST_MAX) {
  let s = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (s.length <= max) return s;
  const cut = s.slice(0, max - 1), sp = cut.lastIndexOf(' ');
  return (sp > max * 0.5 ? cut.slice(0, sp) : cut).replace(/[\s,;:.–—-]+$/, '') + '…';
}
// a quick reply as a word or three: "Send a gift (3 goods or 3 coin)" -> "send a gift", "Understood, rest then" -> "understood"
export function replyWord(label) {
  let s = String(label ?? '').replace(/\(.*?\)/g, '').split(/[,;:—–]| - /)[0].replace(/\s+/g, ' ').trim();
  const w = s.split(' ');
  while (w.length > 1 && w.join(' ').length > 20) w.pop();
  while (w.length > 1 && /^(a|an|the|to|with|for|of|by|and|or|they|it|is|are)$/i.test(w[w.length - 1])) w.pop();
  s = w.join(' ');
  return s ? s[0].toLowerCase() + s.slice(1) : '';
}
function normReplies(list) {
  return (Array.isArray(list) ? list : []).map(r => typeof r === 'string' ? { label: replyWord(r), says: r } : { label: replyWord(r.short || r.label || r.says), says: r.says || r.label || '' })
    .filter(r => r.label && r.says).slice(0, 3);
}
// the stack's line: "3 letters" + up to three names (minister first) and "+n"
export function stackLine(members) {
  const n = members.reduce((k, m) => k + (m.unread || m.count), 0) || members.length;
  const names = members.slice(0, 3).map(m => ({ name: m.from || '…', minister: !!m.minister, read: !m.unread }));
  return { count: n, label: `${n} letter${n === 1 ? '' : 's'}`, names, more: Math.max(0, members.length - 3) };
}

export function createPins(ctx, { parent = (typeof document !== 'undefined' ? document.body : null), anchor, portrait, rev, radiusOf = null, bodies = null, project = null, isMinister = null } = {}) {
  const { camera, renderer } = ctx;
  const letters = new Map();   // letterId -> { letterId, key, target, agentId, unread, onOpen, onReply, onClick, from, gist, replies, portrait, initial, minister, t }
  const groups = new Map();    // key -> the tag: { key, el, body, p, name, msg, count, re, target, agentId, slot, ox, oy, ... }
  const stacksM = new Map();   // stack id -> { id, el, members: [keys], ... }
  const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3(), cp = new THREE.Vector3(), fwd = new THREE.Vector3();
  let layer = null, svg = null, seq = 0, stackSeq = 0, shown = true, expanded = new Set(), lastRects = [], fanSeq = 0;
  const fanSlots = new Map();  // key -> { side: -1 | 1, rank } for the open stack's fan (fixed while it is open)
  const SVGNS = 'http://www.w3.org/2000/svg';
  function ensureLayer() {
    if (layer || !parent) return layer;
    if (!document.getElementById('agt-style')) { const st = document.createElement('style'); st.id = 'agt-style'; st.textContent = CSS; document.head.append(st); }
    else document.getElementById('agt-style').textContent = CSS;
    layer = document.createElement('div'); layer.className = 'agt-layer'; layer.style.display = shown ? '' : 'none'; parent.append(layer);
    svg = document.createElementNS(SVGNS, 'svg'); svg.setAttribute('class', 'agt-lines'); svg.setAttribute('aria-hidden', 'true'); layer.append(svg);
    // a click anywhere else (the world, the inbox) or Esc folds an open stack back
    document.addEventListener('pointerdown', e => { if (expanded.size && !(e.target && e.target.closest && e.target.closest('.agt'))) collapse(); }, true);
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && expanded.size) collapse(); }, true);
    return layer;
  }
  const keyOf = target => (target && typeof target === 'object') ? `pt:${(+target.x).toFixed(2)},${(+target.z).toFixed(2)}` : 'ag:' + String(target);
  const agentOfTarget = target => (target != null && typeof target !== 'object') ? target : null;
  const linePath = () => { const l = document.createElementNS(SVGNS, 'path'), d = document.createElementNS(SVGNS, 'path'); d.setAttribute('class', 'dot'); svg.append(l, d); return { l, d }; };

  // newest unread first, else newest
  function lead(key) {
    let best = null;
    for (const l of letters.values()) if (l.key === key && (!best || (l.unread && !best.unread) || (l.unread === best.unread && l.t > best.t))) best = l;
    return best;
  }
  function ofKey(key) { return [...letters.values()].filter(l => l.key === key).sort((a, b) => b.t - a.t); }
  const stop = e => e.stopPropagation();
  const isMin = g => { const l = lead(g.key); return !!((l && l.minister) || (g.agentId != null && isMinister && isMinister(g.agentId))); };

  function makeGroup(key, target) {
    if (!ensureLayer()) return null;
    const el = document.createElement('div'); el.className = 'agt off'; el.setAttribute('role', 'group');
    el.innerHTML = `<span class="agt-in"><button type="button" class="agt-b"><span class="agt-p"></span><span class="agt-l"><span class="agt-n"></span> <span class="agt-m"></span><span class="agt-c"></span></span></button><span class="agt-r"></span></span>`;
    const g = { key, el, target, agentId: agentOfTarget(target), body: el.querySelector('.agt-b'), p: el.querySelector('.agt-p'), name: el.querySelector('.agt-n'), msg: el.querySelector('.agt-m'),
      countEl: el.querySelector('.agt-c'), re: el.querySelector('.agt-r'), inner: el.querySelector('.agt-in'), slot: 0, ox: 0, oy: 0, op: 0, x: null, y: null, s: 0, w: 0, h: 0, rev: null, url: null, sig: '',
      path: linePath(), stack: null, fan: null };
    // the world underneath never sees these clicks (no pencil mark, no folk card)
    ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'wheel', 'click'].forEach(ev => el.addEventListener(ev, stop));
    g.body.addEventListener('click', e => { e.preventDefault(); open(key); });
    g.re.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      e.preventDefault();
      const l = lead(key); if (!l) return;
      replyTo(l, +b.dataset.i, b);
    });
    layer.append(el); groups.set(key, g); seq++;
    return g;
  }
  function info(g, l) {
    const r = g.el.getBoundingClientRect();
    return { agentId: g.agentId, target: l.target, screen: { x: r.left + r.width / 2, y: r.top + r.height / 2 }, rect: r };
  }
  function open(key) {
    const g = groups.get(key), l = lead(key); if (!g || !l) return false;
    const fn = typeof l.onOpen === 'function' ? l.onOpen : typeof l.onClick === 'function' ? l.onClick : null;
    if (!fn) return false;
    try { fn(l.letterId, info(g, l)); } catch (err) { console.error('[pins] onOpen', err); }
    return true;
  }
  // a quick reply: the letter is answered like its own options do; the tag shows the word, then folds away
  function replyTo(l, i, btn = null) {
    const g = groups.get(l.key), r = l.replies[i]; if (!g || !r || g.el.classList.contains('sent')) return false;
    let res;
    try { res = typeof l.onReply === 'function' ? l.onReply(l.letterId, r.says, { ...info(g, l), label: r.label, index: i }) : undefined; } catch (err) { console.error('[pins] onReply', err); }
    if (res === false) return false;
    g.el.classList.add('sent');
    const b = btn || g.re.querySelectorAll('button')[i]; if (b) b.classList.add('chosen');
    const id = l.letterId;
    setTimeout(() => { if (letters.get(id) === l) unpin(id); else g.el.classList.remove('sent'); }, 1100);
    return true;
  }
  function refresh(g) {
    const list = ofKey(g.key), l = lead(g.key);
    if (!l) return;
    const unread = list.filter(x => x.unread).length;
    g.el.classList.toggle('read', !unread);
    g.unread = unread; g.count = list.length; g.from = l.from || ''; g.t = l.t;
    const sig = `${l.letterId}|${l.from}|${l.gist}|${list.length}|${l.replies.map(r => r.label).join('/')}`;
    if (sig !== g.sig) {
      g.sig = sig;
      g.el.classList.remove('sent');
      g.name.textContent = l.from || '';
      g.name.style.display = l.from ? '' : 'none';
      g.msg.textContent = l.gist || '';
      g.countEl.textContent = list.length > 1 ? `+${list.length - 1}` : '';
      g.re.innerHTML = l.replies.map((r, i) => `<button type="button" data-i="${i}" title="say: ${esc(r.says)}">${esc(r.label)}</button>`).join('');
      g.re.style.display = l.replies.length ? '' : 'none';
      g.body.setAttribute('aria-label', `${list.length > 1 ? list.length + ' letters' : 'A letter'}${l.from ? ' from ' + l.from : ''}${l.gist ? ': ' + l.gist : ''}. Open in the inbox.`);
      g.w = 0;   // re-measure
    }
    // the sender's painted portrait; else a given image; else a red wax initial (the Ministry, a nation)
    const url = l.portrait || g.url;
    g.face = url ? { url } : { initial: (l.initial || (l.from ? l.from.trim()[0] : '') || '').toUpperCase() };
    paintFace(g.p, g.face);
  }
  function paintFace(el, face) {
    if (face && face.url) { el.classList.remove('seal'); el.style.backgroundImage = `url("${face.url}")`; el.dataset.initial = ''; }
    else { el.classList.add('seal'); el.style.backgroundImage = ''; el.dataset.initial = (face && face.initial) || ''; }
  }
  function requestPortrait(g) {
    if (!g.agentId || !portrait) return;
    const r = rev ? rev(g.agentId) : 0; if (r === g.rev) return;
    g.rev = r;
    Promise.resolve(portrait(g.agentId, { size: 48, ring: false })).then(url => { if (url && groups.get(g.key) === g) { g.url = url; refresh(g); } }).catch(() => {});
  }

  function pin(target, { letterId, unread = true, onOpen = null, onReply = null, onClick = null, from = '', subject = '', gist = '', replies = null, portrait: pUrl = null, initial = '', minister = false } = {}) {
    if (letterId == null) letterId = 'pin:' + (++seq);
    const key = keyOf(target);
    const prev = letters.get(letterId);
    if (prev && prev.key !== key) unpin(letterId);
    letters.set(letterId, { letterId, key, target, agentId: agentOfTarget(target), unread: !!unread, onOpen, onReply, onClick, from, subject, minister: !!minister,
      gist: gistOf(gist || subject), replies: normReplies(replies), portrait: pUrl, initial, t: prev ? prev.t : performance.now() + (seq * 1e-3) });
    const g = groups.get(key) || makeGroup(key, target);
    if (!g) return null;
    refresh(g); requestPortrait(g);
    return { letterId, el: g.el, unpin: () => unpin(letterId), setUnread: on => setUnread(letterId, on), reply: i => reply(letterId, i), open: () => open(key) };
  }
  function dropGroup(g) {
    groups.delete(g.key); g.el.classList.add('gone'); g.el.style.pointerEvents = 'none';
    g.path.l.remove(); g.path.d.remove();
    setTimeout(() => g.el.remove(), 320);
  }
  function unpin(letterId) {
    const l = letters.get(letterId); if (!l) return false;
    letters.delete(letterId);
    const g = groups.get(l.key);
    if (g) { if (ofKey(l.key).length) refresh(g); else dropGroup(g); }
    return true;
  }
  function setUnread(letterId, on) { const l = letters.get(letterId); if (!l) return false; l.unread = !!on; const g = groups.get(l.key); if (g) refresh(g); return true; }
  function reply(letterId, i = 0) { const l = letters.get(letterId); return l ? replyTo(l, i) : false; }
  function clear() { [...letters.keys()].forEach(unpin); }

  /* ---------------- stacks ---------------- */
  function makeStack() {
    ensureLayer();
    const el = document.createElement('div'); el.className = 'agt agt-k off'; el.setAttribute('role', 'group');
    el.innerHTML = `<span class="agt-in"><button type="button" class="agt-b"><span class="agt-ps"></span><span class="agt-l"><span class="agt-n"></span><span class="agt-dot"> · </span><span class="agt-m"></span></span></button></span>`;
    const st = { id: 'stack-' + (++stackSeq), el, inner: el.querySelector('.agt-in'), body: el.querySelector('.agt-b'), ps: el.querySelector('.agt-ps'), num: el.querySelector('.agt-n'), names: el.querySelector('.agt-m'),
      members: [], x: null, y: null, ox: 0, oy: 0, op: 0, opT: 0, w: 0, h: 0, s: 0, slot: 0, sig: '', path: linePath(), used: false };
    ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'wheel', 'click'].forEach(ev => el.addEventListener(ev, stop));
    st.body.addEventListener('click', e => { e.preventDefault(); expanded = new Set(st.members); });
    layer.append(el); stacksM.set(st.id, st);
    return st;
  }
  function dropStack(st) {
    stacksM.delete(st.id); st.el.classList.add('gone'); st.el.style.pointerEvents = 'none';
    st.path.l.remove(); st.path.d.remove();
    setTimeout(() => st.el.remove(), 320);
  }
  function fillStack(st, mem) {
    const line = stackLine(mem.map(g => ({ from: g.from, minister: g.min, unread: g.unread, count: g.count })));
    const sig = mem.map(g => `${g.key}:${g.from}:${g.unread}:${g.count}:${g.min ? 1 : 0}:${g.face && (g.face.url || g.face.initial)}`).join('|');
    if (sig === st.sig) return;
    st.sig = sig;
    st.num.textContent = line.label;
    st.names.innerHTML = line.names.map(n => `<span class="${n.minister ? 'mn' : n.read ? 'rd' : ''}">${esc(n.name)}</span>`).join(', ') + (line.more ? ` <span class="agt-more">+${line.more}</span>` : '');
    st.ps.innerHTML = '';
    mem.slice(0, 3).forEach((g, i) => { const p = document.createElement('span'); p.className = 'agt-p' + (g.min ? ' minp' : ''); p.style.zIndex = String(3 - i); paintFace(p, g.face); st.ps.append(p); });
    st.el.classList.toggle('read', !mem.some(g => g.unread));
    st.body.setAttribute('aria-label', `${line.label} from ${mem.map(g => g.from).filter(Boolean).join(', ')}. Show them all.`);
    st.w = 0;
  }
  function collapse() { if (!expanded.size) return false; expanded = new Set(); return true; }
  function expand(which) {
    for (const st of stacksM.values()) if (st.used && (st.id === which || st.members.includes('ag:' + String(which)) || st.members.includes(which))) { expanded = new Set(st.members); return true; }
    return false;
  }

  function anchorWorld(g, v) {
    if (g.agentId != null) return anchor(g.agentId, v);
    return anchor(g.target, v);
  }
  // world point -> client px (through the lens when the game gives one); null when behind
  function toScreen(p, r) {
    if (project) { const s = project(p); return s && !s.behind && isFinite(s.x) && isFinite(s.y) ? s : null; }
    tmp2.copy(p).project(camera); if (tmp2.z > 1 || tmp2.z < -1) return null;
    return { x: r.left + (tmp2.x + 1) / 2 * r.width, y: r.top + (1 - tmp2.y) / 2 * r.height };
  }
  // screen boxes of the folk, so a tag never lands on one: bodies() gives world boxes { id, top, bottom, r } (a floatie
  // gives two: the wide canopy and the narrow body under it)
  function folkBoxes(r) {
    if (!bodies) return [];
    const out = [], th = Math.tan(THREE.MathUtils.degToRad((camera.fov || 40) / 2)), v = new THREE.Vector3();
    for (const b of bodies()) {
      const h = toScreen(v.set(b.top.x, b.top.y, b.top.z), r); if (!h) continue;
      const hx = h.x, hy = h.y;
      const f = toScreen(v.set(b.bottom.x, b.bottom.y, b.bottom.z), r); if (!f) continue;
      const d = cp.distanceTo(v.set(b.top.x, b.top.y, b.top.z));
      const half = Math.max(4, (b.r || 0.3) * (r.height / 2) / (Math.max(0.1, d) * th));
      out.push({ id: b.id, x0: Math.min(hx, f.x) - half, x1: Math.max(hx, f.x) + half, y0: Math.min(hy, f.y) - half * 0.35, y1: Math.max(hy, f.y) + half * 0.35 });
    }
    return out;
  }
  // candidate slots round the anchor (in tag widths / heights): straight up first, then higher, the sides, further out
  const SLOTS = [[0, 0], [0, -1], [-0.62, -0.35], [0.62, -0.35], [0, -2], [-0.62, -1.35], [0.62, -1.35], [-1.15, 0], [1.15, 0], [-1.15, -1], [1.15, -1], [0, -3],
    [-1.2, -2], [1.2, -2], [-0.62, -2.4], [0.62, -2.4], [-1.75, -0.5], [1.75, -0.5], [0, -4], [-1.2, 1.1], [1.2, 1.1]];
  const over = (a, b) => Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));
  const measure = o => { if (!o.w || o.sM !== o.s) { o.el.style.setProperty('--s', o.s.toFixed(2)); o.w = o.inner.offsetWidth || 120; o.h = o.inner.offsetHeight || 34; o.sM = o.s; } };

  // dt: the frame's seconds (the bridge passes its own); none = snap everything into place (a still, a test)
  function update(dt = null) {
    if (!groups.size) { for (const st of [...stacksM.values()]) dropStack(st); lastRects = []; return; }
    const snap = dt == null;
    dt = snap ? 10 : Math.min(0.1, Math.max(0, dt));
    camera.updateMatrixWorld();
    const r = renderer.domElement.getBoundingClientRect();
    camera.getWorldPosition(cp); camera.getWorldDirection(fwd);
    const down = Math.max(0, -fwd.y);   // 1 looking straight down, 0 level
    const pxPerUnitAt = d => (r.height / 2) / (Math.max(0.1, d) * Math.tan(THREE.MathUtils.degToRad((camera.fov || 40) / 2)));
    const vis = [];
    for (const g of groups.values()) {
      requestPortrait(g);
      const mn = isMin(g); if (mn !== g.min) { g.min = mn; g.el.classList.toggle('min', mn); }
      const p = anchorWorld(g, tmp);
      if (!p) { g.el.classList.add('off'); g.op = 0; g.vis = false; continue; }
      const dist = cp.distanceTo(p);
      const op = 1 - smooth(TAGS.fadeFrom, TAGS.fadeTo, dist);
      const sp = toScreen(p, r);
      const m = 40;
      if (op < 0.04 || !sp || sp.x < r.left - m || sp.x > r.right + m || sp.y < r.top - m || sp.y > r.bottom + m) { g.el.classList.add('off'); g.op = 0; g.vis = false; continue; }
      // a little bigger far out, by font size (crisp text), in steps of .02 so the layout is not redone every frame
      g.s = Math.round((TAGS.sizeNear + (TAGS.sizeFar - TAGS.sizeNear) * smooth(18, 80, dist)) * 50) / 50;
      // clear of the folk: from above, a parasol (or a flit's rotor) spreads round the anchor, so lift by its radius
      const rad = radiusOf && g.agentId != null ? (radiusOf(g.agentId) || 0) : 0;
      g.sx = sp.x; g.sy = sp.y; g.ax = sp.x; g.ay = sp.y - 3 - rad * pxPerUnitAt(dist) * down;
      g.dist = dist; g.opT = op; g.vis = true;
      if (g.el.classList.contains('off')) { g.el.classList.remove('off'); if (g.x === null) g.op = 0; }
      measure(g);
      g.prio = (g.min ? 4 : 0) + (g.unread ? 2 : 0) + (g.agentId != null ? 0.5 : 0);
      vis.push(g);
    }
    // ---- knots: senders standing together fold into one stack (union-find on the screen anchors) ----
    const up = new Map(), find = k => { while (up.get(k) !== k) { up.set(k, up.get(up.get(k))); k = up.get(k); } return k; };
    vis.forEach(g => up.set(g.key, g.key));
    const cand = vis.filter(g => g.dist > TAGS.stackFrom && g.opT > 0.2 && !g.el.classList.contains('sent'));
    for (let i = 0; i < cand.length; i++) for (let j = 0; j < i; j++) {
      const a = cand[i], b = cand[j], s = (a.s + b.s) / 2;
      const keep = a.stack && a.stack === b.stack ? TAGS.knotKeep : 1;
      const dx = (a.ax - b.ax) / (TAGS.knotX * s * keep), dy = (a.ay - b.ay) / (TAGS.knotY * s * keep);
      if (dx * dx + dy * dy < 1) up.set(find(a.key), find(b.key));
    }
    const knots = new Map();
    for (const g of cand) { const k = find(g.key); if (!knots.has(k)) knots.set(k, []); knots.get(k).push(g); }
    const rank = (a, b) => (b.prio - a.prio) || ((b.t || 0) - (a.t || 0)) || (a.dist - b.dist);
    const clusters = [...knots.values()].filter(m => m.length > 1).map(m => m.sort(rank));
    // an open stack stays open while its knot lasts (new members join it); gone knot = folded
    const openKnots = clusters.filter(m => m.some(g => expanded.has(g.key)));
    if (expanded.size && !openKnots.length) expanded = new Set();
    for (const m of openKnots) m.forEach(g => expanded.add(g.key));
    // match knots to stacks by shared members (a stack keeps its element, no re-pop)
    for (const st of stacksM.values()) st.used = false;
    vis.forEach(g => { g.stack = null; g.fan = null; });
    const items = [], fans = [];
    for (const m of clusters) {
      if (openKnots.includes(m)) { fans.push(m); m.forEach(g => { g.fan = { x: g.ax, y: g.ay }; }); continue; }
      let best = null, bn = 0;
      for (const st of stacksM.values()) { if (st.used) continue; const n = m.filter(g => st.members.includes(g.key)).length; if (n > bn) { bn = n; best = st; } }
      const st = best || makeStack();
      st.used = true; st.members = m.map(g => g.key); st.mem = m;
      m.forEach(g => { g.stack = st.id; });
      fillStack(st, m);
      st.s = Math.max(...m.map(g => g.s)); measure(st);
      st.ax = m.reduce((k, g) => k + g.ax, 0) / m.length; st.ay = Math.min(...m.map(g => g.ay));
      st.dist = Math.min(...m.map(g => g.dist)); st.opT = Math.max(...m.map(g => g.opT));
      st.prio = Math.max(...m.map(g => g.prio)) + 0.25; st.t = Math.max(...m.map(g => g.t || 0));
      st.el.classList.remove('off');
      items.push(st);
    }
    for (const st of [...stacksM.values()]) if (!st.used) dropStack(st);
    for (const g of vis) if (!g.stack && !g.fan) items.push(g);

    // ---- placement ----
    const boxes = vis.length ? folkBoxes(r) : [], taken = [];
    const inView = (cx, w) => cx + Math.max(0, r.left + 4 - (cx - w / 2)) - Math.max(0, (cx + w / 2) - (r.right - 4));
    // an open knot: the tags fan out in two columns beside it, the column's top tag going to the farthest sender
    // (lines never cross, and never run through a tag of the same column)
    // the side and row are decided once, when the stack opens (folk walking about must not shuffle the fan); a
    // sender joining an open knot is added at the top of the shorter column
    if (!expanded.size) fanSlots.clear();
    for (const m of fans) {
      const fresh = m.filter(g => !fanSlots.has(g.key));
      if (fresh.length) {
        const byX = fresh.slice().sort((a, b) => a.ax - b.ax), known = m.filter(g => fanSlots.has(g.key));
        let nl = known.filter(g => fanSlots.get(g.key).side < 0).length, nr = known.length - nl;
        const half = known.length ? null : Math.ceil(byX.length / 2);
        byX.forEach((g, i) => { const side = half != null ? (i < half ? -1 : 1) : (nl <= nr ? -1 : 1); if (side < 0) nl++; else nr++;
          fanSlots.set(g.key, { side, rank: half != null ? (side < 0 ? -g.ax : g.ax) : -1e6 - (++fanSeq) }); });
      }
      const left = m.filter(g => fanSlots.get(g.key).side < 0), right = m.filter(g => fanSlots.get(g.key).side > 0);
      const base = Math.min(...m.map(g => g.ay)) + 6;
      // the left column's right edge left of its senders, the right column's left edge right of its senders (and
      // the two never cross, even if the folk walk past each other)
      let eL = left.length ? Math.min(...left.map(g => g.ax)) - 14 : 0, eR = right.length ? Math.max(...right.map(g => g.ax)) + 14 : 0;
      if (left.length && right.length && eL > eR - 28) { const mid = (eL + eR) / 2; eL = mid - 14; eR = mid + 14; }
      const col = (list, side) => {
        if (!list.length) return;
        const edge = side < 0 ? eL : eR;
        const order = list.slice().sort((a, b) => fanSlots.get(a.key).rank - fanSlots.get(b.key).rank);   // top = farthest (when it opened); newcomers on top
        let y = base; const ys = [];
        for (let i = order.length - 1; i >= 0; i--) { ys[i] = y; y -= order[i].h + 6; }
        order.forEach((g, i) => {
          const cx = inView(side < 0 ? edge - g.w / 2 : edge + g.w / 2, g.w);
          g.fan = { x: cx, y: ys[i] };
          taken.push({ x0: cx - g.w / 2, x1: cx + g.w / 2, y0: ys[i] - g.h, y1: ys[i] });
        });
      };
      col(left, -1); col(right, 1);
    }
    // everything else: priority first (minister, unread), then nearest; each takes the first free slot
    items.sort(rank);
    for (const it of items) {
      const w = it.w, h = it.h, tick = 6 * it.s;
      const box = k => { const [kx, ky] = SLOTS[k]; const cx = inView(it.ax + kx * w, w); const by = it.ay - tick + ky * (h + 4);
        return { x0: cx - w / 2, x1: cx + w / 2, y0: by - h, y1: by }; };
      const cost = k => { const bx = box(k); let c = 0;
        for (const t of taken) { const o = over(bx, t); if (o > 0) c += 1e6 + 25 * o; }   // on another tag: ruled out
        const own = it.members || (it.agentId != null ? [it.key] : []);
        for (const f of boxes) if (!own.includes('ag:' + f.id)) c += over(bx, f);
        c += 4 * Math.max(0, r.top + 4 - bx.y0) * w + 2 * Math.max(0, bx.y1 - (r.bottom - 4)) * w;
        return c + k * 60; };
      let k = 0, best = Infinity; it.costs = [];
      for (let i = 0; i < SLOTS.length; i++) { const c = cost(i); it.costs.push(Math.round(c)); if (c < best) { best = c; k = i; } }
      // stay put unless the slot is ruled out (another tag took it) or a new one is clearly better: a folk walking
      // under a tag is fine for a moment (the leader line says whose it is), a hopping tag is not. After a move it
      // holds for 0.8 s. Straight above the head wins back as soon as it is clear.
      const bare = i => it.costs[i] - i * 60, now = performance.now();
      if (it.slot !== k && it.slot < SLOTS.length && bare(it.slot) < 1e6) {
        const better = bare(it.slot) - bare(k);
        if ((now < (it.holdUntil || 0) && !snap) || (better <= 1600 && (it.slot === 0 || bare(0) > 150))) k = it.slot;
      }
      if (k !== it.slot) it.holdUntil = now + 800;
      it.slot = k;
      const bx = box(k); taken.push(bx);
      it.tx = (bx.x0 + bx.x1) / 2; it.ty = bx.y1;
    }
    for (const g of vis) if (g.fan) { g.tx = g.fan.x; g.ty = g.fan.y; }
    // members folded into a stack ride with it (and fan out from it when it opens)
    for (const st of stacksM.values()) for (const g of st.mem || []) { g.tx = st.tx; g.ty = st.ty; g.opT = 0; }

    // ---- ease toward the targets (the anchor itself is followed exactly) and draw ----
    const e = 1 - Math.pow(0.0005, dt), eo = 1 - Math.pow(0.002, dt);
    const ease = o => {
      const tx = o.tx - o.ax, ty = o.ty - o.ay;
      if (o.x === null || snap) { o.ox = tx; o.oy = ty; } else { o.ox += (tx - o.ox) * e; o.oy += (ty - o.oy) * e; }
      o.op += (o.opT - o.op) * (snap ? 1 : eo);
      o.x = o.ax + o.ox; o.y = o.ay + o.oy;
    };
    const rects = [];
    // perf: every DOM write below is skipped when its value is unchanged (a still tag costs no style invalidation, no
    // SVG re-parse); the last written values live on the tag (o.last)
    const put = (L, k, v, fn) => { if (L[k] === v) return; L[k] = v; fn(v); };
    const draw = (o, heads, z) => {
      const w = o.w, h = o.h, x0 = o.x - w / 2, y0 = o.y - h, L = o.last || (o.last = {}), st = o.el.style;
      put(L, 'tf', `translate(${x0.toFixed(1)}px, ${y0.toFixed(1)}px)`, v => { st.transform = v; });
      put(L, 'op', o.op.toFixed(3), v => { st.opacity = v; });
      put(L, 'pe', o.op < 0.35 ? 'none' : '', v => { st.pointerEvents = v; });
      put(L, 'z', String(z), v => { st.zIndex = v; });
      // leader lines: from the nearest point of the tag's edge down to each head (+ a dot on a head it stands off from)
      let dl = '', dd = '';
      for (const hd of heads) {
        const px = clamp(hd.x, x0 + 4, o.x + w / 2 - 4), py = clamp(hd.y - 2, y0, o.y), len = Math.hypot(hd.x - px, hd.y - 2 - py);
        if (len < 1.5) continue;
        dl += `M${px.toFixed(1)} ${py.toFixed(1)}L${hd.x.toFixed(1)} ${(hd.y - 2).toFixed(1)}`;
        if (len > 14) dd += `M${(hd.x - 1.5).toFixed(1)} ${(hd.y - 2).toFixed(1)}a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0 -3 0`;
      }
      put(L, 'dl', dl, v => o.path.l.setAttribute('d', v)); put(L, 'dd', dd, v => o.path.d.setAttribute('d', v));
      const lo = (o.op * (o.el.classList.contains('read') ? 0.6 : 1)).toFixed(3);
      put(L, 'lo', lo, v => { o.path.l.style.opacity = v; o.path.d.style.opacity = v; });
      if (o.op > 0.3) rects.push({ x: x0, y: y0, w, h, kind: o.members ? 'stack' : 'tag', agentId: o.agentId ?? null, members: o.members ? o.members.slice() : null });
    };
    for (const g of vis) ease(g);
    for (const st of stacksM.values()) ease(st);
    for (const g of vis) draw(g, [{ x: g.sx, y: g.sy }], g.fan ? 3000 : Math.round(1000 + g.prio * 200 - Math.min(190, g.dist)));
    for (const st of stacksM.values()) draw(st, st.mem.map(g => ({ x: g.sx, y: g.sy })), Math.round(1000 + st.prio * 200 - Math.min(190, st.dist)));
    // hidden tags leave no lines behind
    for (const g of groups.values()) if (!g.vis && g.last && (g.last.dl || g.last.dd)) { g.last.dl = g.last.dd = ''; g.path.l.setAttribute('d', ''); g.path.d.setAttribute('d', ''); }
    lastRects = rects;
  }
  function pinFor(agentId) {
    const key = keyOf(agentId), list = ofKey(key); if (!list.length) return null;
    const l = lead(key);
    return { letterId: l.letterId, letterIds: list.map(x => x.letterId), unread: list.filter(x => x.unread).length, count: list.length,
      replies: l.replies.map(r => ({ ...r })), open: () => open(key), reply: i => replyTo(l, i) };
  }
  function list() {
    return [...letters.values()].map(l => { const g = groups.get(l.key);
      return { letterId: l.letterId, agentId: l.agentId, target: l.target, unread: l.unread, from: l.from, subject: l.subject, gist: l.gist, replies: l.replies.map(r => r.label), minister: !!(g && g.min),
        visible: !!(g && !g.el.classList.contains('off') && g.op > 0.05), stack: g ? g.stack : null, fanned: !!(g && g.fan),
        x: g ? g.sx : null, y: g ? g.sy : null, scale: g ? g.s : null, opacity: g ? +g.op.toFixed(2) : 0, slot: g ? g.slot : null, costs: g ? g.costs : null }; });
  }
  function stacks() {
    return [...stacksM.values()].filter(st => st.used).map(st => ({ id: st.id, count: stackLine(st.mem.map(g => ({ from: g.from, minister: g.min, unread: g.unread, count: g.count }))).count,
      text: st.inner.textContent.replace(/\s+/g, ' ').trim(), members: st.mem.map(g => ({ agentId: g.agentId, from: g.from, minister: g.min, unread: g.unread })),
      rect: { x: st.x - st.w / 2, y: st.y - st.h, w: st.w, h: st.h }, opacity: +st.op.toFixed(2) }));
  }
  function rect(letterId) { const l = letters.get(letterId), g = l && groups.get(l.key); if (!g || g.el.classList.contains('off') || g.op < 0.05) return null; const b = g.inner.getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height }; }
  function anchorOf(letterId) { const l = letters.get(letterId), g = l && groups.get(l.key); const p = g && anchorWorld(g, new THREE.Vector3()); return p ? { x: p.x, y: p.y, z: p.z } : null; }
  // off the map (globe, Plissé, a full-screen scene): the whole layer hides; tags are kept
  function setVisible(on) { shown = !!on; if (layer) layer.style.display = shown ? '' : 'none'; if (!shown) collapse(); }
  function dispose() { letters.clear(); groups.forEach(g => g.el.remove()); groups.clear(); stacksM.forEach(st => st.el.remove()); stacksM.clear(); if (layer) layer.remove(); layer = null; svg = null; }
  return { pin, unpin, setUnread, pinFor, reply, list, stacks, expand, collapse, rect, anchorOf, update, clear, dispose, setVisible,
    // the boxes on screen now (tags and stacks, opacity > .3): the speech bubbles step aside or fade under them
    rects: () => shown ? lastRects : [],
    get visible() { return shown; }, has: id => letters.has(id) };
}
