// Input on the map (ART_DIRECTION §5): LEFT click / drag belong to the marks module (a pencil ✕, an area, a line);
// a left click on a folk opens its card. RIGHT-drag pans (the rig's default), shift/alt-drag turns, WASD / arrows and
// edge scroll move, the wheel zooms, Q / E rotate (the rig's keys).
// Also the cursor: where the pointer last was, and the ground point under it ("there" with no mark).

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function createInput({ ctx, world, agents = null, ui = null, marksRef = () => null, game, stages = null, onFolkClick = null, onFolkHover = null, edgeScroll = true } = {}) {
  const dom = ctx.renderer.domElement;
  const cursor = { x: innerWidth / 2, y: innerHeight / 2, moved: false, edgeSince: 0 };
  addEventListener('pointermove', e => { cursor.x = e.clientX; cursor.y = e.clientY; cursor.moved = true; }, { capture: true, passive: true });
  const active = () => world.rig.enabled && (!stages || stages.scene === 'world');

  // the folk under the pointer (the election's highlight, a pointer cursor): the agents' screen-box pick (through her
  // lens, cached per frame, ~0.01 ms) every ~50 ms, not every move
  let hoverT = 0, hoverId = null;
  if (onFolkHover) addEventListener('pointermove', e => {
    const now = performance.now(); if (now - hoverT < 50) return; hoverT = now;
    let id = null;
    if (active() && agents && e.target === dom) { try { id = agents.pickAgent(e.clientX, e.clientY, { radiusPx: 8 }); } catch (_) { id = null; } }
    if (id !== hoverId) { hoverId = id; try { onFolkHover(id, { x: e.clientX, y: e.clientY }); } catch (err) { console.error('[input] hover', err); } }
  }, { capture: true, passive: true });

  let downAt = { x: 0, y: 0 };
  dom.addEventListener('pointerdown', e => { downAt = { x: e.clientX, y: e.clientY }; }, { capture: true });

  // right-drag pans, shift / alt + drag turns, WASD / arrows move, Q / E rotate, the wheel zooms: the rig's own input
  // (world/camera.js INPUT_DEFAULTS: pan [2, 1], left 'none'); left is the pencil's. Only edge scroll is added here.
  let pan = null;

  // ---------- a click on a folk opens its card (marks ignore folk, the rig sees no drag) ----------
  dom.addEventListener('pointerup', e => {
    const marks = marksRef();
    if (e.button !== 0 || !active() || world.rig.wasDrag() || (marks && marks.drawing) || pan) return;
    if (Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 6) return;
    const id = agents ? agents.pickAgent(e.clientX, e.clientY, { radiusPx: 14 }) : null;
    if (id == null) return;
    const agent = game.state.agents.find(a => a.id === id);
    if (!agent) return;
    if (onFolkClick && onFolkClick(agent, { x: e.clientX, y: e.clientY }) === true) return;   // consumed (the election's click)
    if (ui) ui.agentCard.show(agent, { x: e.clientX, y: e.clientY }, { isMinister: game.state.minister === agent.id });
  });

  // ---------- edge scroll: a pointer resting at the window edge for a moment moves the map ----------
  function update(dt) {
    if (!edgeScroll || !active() || !cursor.moved || pan || world.rig.busy || (ui && ui.voiceBar.isTyping())) { cursor.edgeSince = 0; return; }
    const B = 14, W = innerWidth, H = innerHeight;
    const ex = cursor.x < B ? -1 : cursor.x > W - B ? 1 : 0, ey = cursor.y < B ? -1 : cursor.y > H - B ? 1 : 0;
    if (!ex && !ey) { cursor.edgeSince = 0; return; }
    cursor.edgeSince += dt;
    if (cursor.edgeSince < 0.3) return;
    const g = world.rig.goal, v = g.dist * 0.55 * dt, s = Math.sin(g.yaw), c = Math.cos(g.yaw);
    g.tx = clamp(g.tx + ex * v * c - ey * v * s, -48, 48);
    g.tz = clamp(g.tz - ex * v * s - ey * v * c, -44, 48);
  }

  return {
    cursor, update, get hoverId() { return hoverId; },
    pick() { try { if (cursor.moved) { const p = world.pick(cursor.x, cursor.y); if (p) return p; } } catch (_) {} const c = game.state.centre || { x: 0, z: 2 }; return { x: c.x, z: c.z, inPlot: true }; },
    // the folk under the pointer? (the marks module asks, so a click on a folk is never a mark)
    overFolk: e => !!(agents && agents.pickAgent(e.clientX, e.clientY, { radiusPx: 4 }) != null)
  };
}
