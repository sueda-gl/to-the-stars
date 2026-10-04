// Member pick mode (ART_DIRECTION §20): when the sovereign founds an institution ("start a police patrol"), she picks
// its members HERSELF by clicking folk: a prompt ("Who joins the Police Patrol? click folk, then Done"), every clicked
// folk toggles (agents.highlight: the hover lift + the paper ring), Done hands the chosen ids back, Esc / "cancel"
// cancels. The auto-pick stays for "you choose" (commands.js decides; this module only runs the mode).
// The prompt is the UI's ui.pick (docs/ui.md: show({ title, hint, min, max, kicker, onDone, onCancel, onRemove }),
// update(ids), hover(agent), done(), cancel(), active; it handles Enter / Esc and hides itself after onDone / onCancel);
// without one (an older UI, the labs) a minimal prompt in the election prompt's clothes with two quiet links.
//
//   const pick = createPick({ game, ui, agents, log });
//   pick.start({ title, hint, min, max, onDone(ids), onCancel() })   // one at a time: a new start cancels the old
//   pick.toggle(agentId) -> true when taken     pick.hover(agentId | null)     pick.done()     pick.cancel()
//   pick.active · pick.chosen (ids, in click order) · pick.title

const STYLE = `
.ag-pickmode .ag-elect__line { font-size: clamp(26px, 3vw, 40px); }
.ag-pickmode__who { margin-top: 10px; font-size: 16px; font-style: italic; opacity: .85; min-height: 1.4em; text-shadow: var(--ag-halo-soft); }
.ag-pickmode__who b { color: var(--red); font-weight: normal; }
.ag-pickmode__row { display: flex; justify-content: center; gap: 28px; margin-top: 12px; }
.ag-pickmode__row .ag-link { font-size: 17px; text-shadow: var(--ag-halo-soft); }
.ag-pickmode__row .ag-link.is-done { color: var(--red); }
`;

export function createPick({ game, ui = null, agents = null, log = () => {} } = {}) {
  let st = null, styled = false;
  const agentOf = id => game.state.agents.find(a => a.id === id) || null;
  const nameOf = id => { const a = agentOf(id); return a ? a.name : String(id); };
  const hi = (id, on) => { try { agents && agents.highlight(id, on); } catch (_) {} };
  const uiPick = () => (ui && ui.pick && typeof ui.pick.show === 'function' ? ui.pick : null);
  const layer = () => (ui && ui.el) || document.body;
  const h = (cls, text) => { const e = document.createElement('div'); e.className = cls; if (text != null) e.textContent = text; return e; };

  // ---- the UI's prompt ----
  function showUi(P) {
    P.show({
      title: st.title, hint: st.hint, min: st.min, max: st.max || 99, kicker: st.kicker,
      onDone: () => { finish('done'); },            // the UI hides itself after this returns
      onCancel: () => { finish('cancel'); },
      onRemove: id => { toggle(id); }
    });
    st.ui = P;
  }
  // ---- the fallback prompt ----
  function ensureStyle() { if (styled) return; styled = true; const s = document.createElement('style'); s.textContent = STYLE; document.head.append(s); }
  function showFallback() {
    ensureStyle();
    const el = h('ag-elect ag-pickmode'); el.setAttribute('role', 'status'); el.setAttribute('aria-live', 'polite');
    el.append(h('ag-elect__k', st.kicker || 'Your choice'));
    const line = h('ag-elect__line'); const t = document.createElement('span'); t.textContent = st.title; const d = document.createElement('span'); d.className = 'dash'; d.textContent = ' — '; const em = document.createElement('em'); em.textContent = st.hint; line.append(t, d, em); el.append(line);
    el.append(h('ag-pickmode__who'));
    const row = h('ag-pickmode__row');
    const bd = document.createElement('button'); bd.type = 'button'; bd.className = 'ag-link is-done'; bd.textContent = 'Done'; bd.addEventListener('click', e => { e.currentTarget.blur(); done(); });
    const bc = document.createElement('button'); bc.type = 'button'; bc.className = 'ag-link'; bc.textContent = 'cancel'; bc.addEventListener('click', e => { e.currentTarget.blur(); cancel(); });
    row.append(bd, bc); el.append(row);
    layer().append(el); st.el = el;
    addEventListener('keydown', onKey, true);
  }
  function onKey(e) {
    if (!st || !st.el) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); cancel(); }
    else if (e.key === 'Enter' && !(document.activeElement && /^(INPUT|TEXTAREA|BUTTON)$/.test(document.activeElement.tagName))) { e.preventDefault(); e.stopImmediatePropagation(); done(); }
  }
  function render() {
    if (!st) return;
    const n = st.chosen.length;
    if (st.ui) { try { st.ui.update(st.chosen.slice()); } catch (e) { log('ui.pick.update', e.message); } return; }
    if (!st.el) return;
    const who = st.el.querySelector('.ag-pickmode__who'), bd = st.el.querySelector('.is-done');
    who.replaceChildren();
    if (n) { const b = document.createElement('b'); b.textContent = st.chosen.map(nameOf).join(', '); who.append(b, ` · ${n} chosen${st.max ? ` of up to ${st.max}` : ''}${n < st.min ? ` (at least ${st.min})` : ''}`); }
    bd.disabled = n < st.min;
  }
  // the mode ends: the rings go, the cursor and keys are released; the prompt is the UI's to fold (or ours)
  function finish(how) {
    const s = st; if (!s) return false; st = null;
    for (const id of s.chosen) hi(id, false);
    if (s.hoverId != null) hi(s.hoverId, false);
    document.body.style.cursor = '';
    if (s.el) { const e = s.el; s.el = null; removeEventListener('keydown', onKey, true); e.classList.add('is-out'); setTimeout(() => e.remove(), 500); }
    log('pick', how, s.chosen);
    try { if (how === 'done') s.onDone && s.onDone(s.chosen.slice()); else s.onCancel && s.onCancel(); } catch (e) { log('pick ' + how, e.message); }
    return true;
  }

  function start({ title = 'Who joins?', hint = 'click folk, then Done', min = 1, max = 6, kicker = 'Your choice', onDone = null, onCancel = null } = {}) {
    if (st) cancel();
    st = { title, hint, min: Math.max(0, min | 0), max: max > 0 ? max | 0 : 0, kicker, chosen: [], onDone, onCancel, el: null, ui: null, hoverId: null };
    const P = uiPick();
    if (P) { try { showUi(P); } catch (e) { log('ui.pick', e.message); st.ui = null; } }
    if (!st.ui) showFallback();
    try { ui && ui.agentCard && ui.agentCard.hide(); } catch (_) {}
    log('pick start', title);
    return true;
  }
  function toggle(id) {
    if (!st || id == null || !agentOf(id)) return false;
    const i = st.chosen.indexOf(id);
    if (i >= 0) { st.chosen.splice(i, 1); if (st.hoverId !== id) hi(id, false); }
    else {
      if (st.max && st.chosen.length >= st.max) { try { ui && ui.notice(`That is enough: ${st.max} at most.`, { kind: 'ministry', ttl: 2500 }); } catch (_) {} return true; }
      st.chosen.push(id); hi(id, true);
    }
    render();
    return true;
  }
  function hover(id) {
    if (!st || id === st.hoverId) return;
    if (st.hoverId != null && !st.chosen.includes(st.hoverId)) hi(st.hoverId, false);
    st.hoverId = id;
    if (id != null) hi(id, true);
    document.body.style.cursor = id != null ? 'pointer' : '';
    if (st.ui) { try { st.ui.hover(id != null ? agentOf(id) : null); } catch (_) {} }
  }
  function done() {
    if (!st) return false;
    if (st.chosen.length < st.min) { render(); return false; }
    if (st.ui) { if (st.ui.active) return !!st.ui.done(); return finish('done'); }   // the UI calls back finish('done')
    return finish('done');
  }
  function cancel() {
    if (!st) return false;
    if (st.ui) { if (st.ui.active) { st.ui.cancel(); return true; } return finish('cancel'); }   // the UI calls back finish('cancel')
    return finish('cancel');
  }
  return {
    start, toggle, hover, done, cancel,
    get active() { return !!st; }, get chosen() { return st ? st.chosen.slice() : []; }, get title() { return st ? st.title : null; }
  };
}
