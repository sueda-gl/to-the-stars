// Mail dots (ART_DIRECTION §24, replaces the letter tags over the folk's heads): "delete the letters showing on top of
// their heads ... Instead they should have a red dot if there is sth they sent, and i will see the stuff on the mailbox
// on the right." A folk with an unread letter gets ONE small red dot just above its head; the letter itself lives only
// in the mailbox (top right). A click on the dot opens that folk's newest unread letter there; a click on the folk is
// still the card (the dot is tiny and sits above the head). Nations, the Ministry and the minister's briefings get no
// dot (they have no head on the map); their letters are only in the mailbox. No floating "Welcome from ..." tags.
//
//   const dots = createMailDots({ ui, agents, stages, open: letterId => ..., icon })
//   dots.update() (each frame: positions)  · dots.refresh() (the unread set, also 4x a second by itself)
//   dots.list() -> [{ agentId, letterId, x, y }] (tests) · dots.setVisible(on) · dots.dispose()

import { iconSlot } from '../ui/icon-slots.js';

const HEADS = new Set(['agent', 'minister']);

export function createMailDots({ ui, agents, stages = null, open = null, parent = null } = {}) {
  const layer = document.createElement('div');
  layer.className = 'ag-maildots';
  (parent || (ui && ui.el) || document.body).append(layer);
  const dots = new Map();          // agentId -> { el, letterId, x, y, on }
  let shown = true, lastRefresh = 0, raf = 0, teach = null, lastOpen = null;   // teach: the onboarding's dot, bigger and pulsing

  function unreadBySender() {
    const out = new Map();
    let all = [];
    try { all = ui.letters.all || []; } catch (_) { all = []; }
    // ui.letters.all is newest first: the first unread letter met per sender is its newest
    for (const L of all) {
      if (!L || L.read || L.resolved) continue;
      const f = L.from || {};
      if (!HEADS.has(f.kind) || f.id == null) continue;
      if (L.meta && L.meta.director) continue;          // the minister's briefing: the mailbox only
      if (!out.has(f.id)) out.set(f.id, L.id);
    }
    return out;
  }
  function make(agentId) {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'ag-maildot';
    el.dataset.agent = String(agentId);
    el.setAttribute('aria-label', 'Unread letter: open it in the mailbox');
    el.innerHTML = iconSlot('dot', 14, '<i></i>');
    el.addEventListener('click', e => {
      e.stopPropagation(); e.currentTarget.blur();
      const d = dots.get(agentId); if (!d) return;
      lastOpen = { letterId: d.letterId, agentId, at: performance.now() };
      if (typeof open === 'function') open(d.letterId, agentId);
    });
    el.addEventListener('pointerdown', e => e.stopPropagation());
    layer.append(el);
    return { el, letterId: null, x: 0, y: 0, on: false };
  }
  function refresh() {
    lastRefresh = performance.now();
    const want = unreadBySender();
    for (const [id, d] of dots) if (!want.has(id)) { d.el.remove(); dots.delete(id); }
    for (const [id, letterId] of want) {
      let d = dots.get(id);
      if (!d) { d = make(id); dots.set(id, d); }
      d.letterId = letterId;
      d.el.classList.toggle('is-teach', teach != null && String(teach) === String(id));
    }
  }
  function update() {
    if (performance.now() - lastRefresh > 250) refresh();
    const vis = shown && (!stages || stages.scene === 'world') && !(ui && ui.titleCard && ui.titleCard.visible);
    layer.classList.toggle('is-off', !vis);
    if (!vis) return;
    for (const [id, d] of dots) {
      let p = null; try { p = agents.screenOf(id); } catch (_) { p = null; }
      const on = !!(p && Number.isFinite(p.x) && Number.isFinite(p.y) && p.x > -20 && p.x < innerWidth + 20 && p.y > -20 && p.y < innerHeight + 20);
      if (on !== d.on) { d.on = on; d.el.classList.toggle('is-on', on); }
      if (!on) continue;
      const x = Math.round(p.x), y = Math.round(p.y - 14);
      if (x !== d.x || y !== d.y) { d.x = x; d.y = y; d.el.style.transform = `translate(${x}px, ${y}px)`; }
    }
  }
  function loop() { try { update(); } catch (_) {} raf = requestAnimationFrame(loop); }
  raf = requestAnimationFrame(loop);

  return {
    update, refresh,
    setVisible(on) { shown = !!on; },
    teach(agentId) { teach = agentId ?? null; refresh(); },        // §24: the onboarding's red dot: larger, pulsing
    get lastOpen() { return lastOpen; },

    list: () => [...dots.entries()].map(([agentId, d]) => ({ agentId, letterId: d.letterId, x: d.x, y: d.y, on: d.on })),
    get layer() { return layer; },
    dispose() { cancelAnimationFrame(raf); layer.remove(); dots.clear(); }
  };
}
