// The Red arch's DOM controls, verbatim markup and behaviour: the editions pill (Riso / Gouache / Raw 3D),
// the Gouache settings panel, the Up close button, keyboard 1/2/3, C, L; plus the reference's camera rig
// (pointer parallax far away, drag-orbit + wheel-zoom up close). Styles live in css/paint.css.

const MARKUP = `<button class="tweaks-toggle" type="button" aria-expanded="false" aria-controls="tweaks" hidden>Gouache settings</button>
<div class="tweaks" id="tweaks" hidden></div>
<div class="closeup"><button class="closeup-btn" type="button" aria-pressed="false">Up close</button><span class="closeup-hint" hidden>Drag to orbit, scroll to zoom</span></div>
<div class="editions" role="group" aria-label="Edition">
  <button data-mode="0" aria-pressed="true">Riso</button>
  <button data-mode="1" aria-pressed="false">Gouache</button>
  <button data-mode="2" aria-pressed="false">Raw 3D</button>
</div>`;

export function mountPaintUI(painter, { root = document.body, closeUp = true, keys = true, hash = true, rig = null } = {}) {
  const { ctx, G, G_DEFAULT, CONTROLS } = painter;
  const { renderer, flags } = ctx;
  if (!root.querySelector('.editions')) {
    const tpl = document.createElement('template'); tpl.innerHTML = MARKUP;
    if (!closeUp) tpl.content.querySelector('.closeup').remove();
    root.append(tpl.content);
  }
  const closeBtn = root.querySelector('.closeup-btn'), closeHint = root.querySelector('.closeup-hint');
  function setCloseUp(on) {
    painter.folk.setCloseUp(on); painter.markDirty();
    if (closeBtn) { closeBtn.setAttribute('aria-pressed', String(on)); closeHint.hidden = !on; }
    renderer.domElement.style.cursor = on ? 'grab' : '';
  }
  if (closeBtn) closeBtn.addEventListener('click', () => setCloseUp(!flags.closeUp));

  const buttons = [...root.querySelectorAll('.editions button')];
  // ---------- gouache settings ----------
  const panel = document.getElementById('tweaks'), toggle = document.querySelector('.tweaks-toggle');
  const fmt = (k, v) => k === 'brush' ? String(v) : Number(v).toFixed(2);
  panel.innerHTML = '<div class="tweak-row"><label for="g-lines">Pencil lines</label><input id="g-lines" type="checkbox" checked></div>' +
    CONTROLS.map(([k, label, mn, mx, st]) => `<div class="tweak" data-k="${k}"><label for="g-${k}">${label}</label><output id="o-${k}"></output>` +
      `<input id="g-${k}" type="range" min="${mn}" max="${mx}" step="${st}"></div>`).join('') +
    '<button class="reset" type="button">Reset to defaults</button>';
  function applyG() {
    painter.applyG();
    CONTROLS.forEach(([k]) => {
      const inp = document.getElementById('g-' + k); inp.value = G[k];
      document.getElementById('o-' + k).textContent = fmt(k, G[k]);
    });
    document.getElementById('g-lines').checked = G.lines;
    panel.querySelectorAll('[data-k="lineWeight"], [data-k="lineStrength"]').forEach(el => el.classList.toggle('dim', !G.lines));
  }
  CONTROLS.forEach(([k]) => document.getElementById('g-' + k).addEventListener('input', e => { G[k] = parseFloat(e.target.value); applyG(); }));
  document.getElementById('g-lines').addEventListener('change', e => { G.lines = e.target.checked; applyG(); });
  panel.querySelector('.reset').addEventListener('click', () => { Object.assign(G, G_DEFAULT); applyG(); });
  toggle.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') !== 'true';
    toggle.setAttribute('aria-expanded', String(open)); panel.hidden = !open;
  });
  function setLines(on) { G.lines = on; applyG(); }
  function syncMode(m) {
    toggle.hidden = m !== 1; if (m !== 1) { panel.hidden = true; toggle.setAttribute('aria-expanded', 'false'); }
    else if (/settings/.test(location.hash)) { panel.hidden = false; toggle.setAttribute('aria-expanded', 'true'); }
    buttons.forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.mode === m)));
    document.documentElement.style.background = m === 2 ? '#a92e25' : '';
  }
  painter.subscribe((what, m) => { if (what === 'mode') syncMode(m); });
  const setMode = m => painter.setMode(m);
  buttons.forEach(b => b.addEventListener('click', () => setMode(+b.dataset.mode)));
  if (keys) addEventListener('keydown', e => { if (e.target.closest && e.target.closest('.tweaks')) return; if (e.key === 'c' || e.key === 'C') setCloseUp(!flags.closeUp); if (e.key === '1' || e.key === '2' || e.key === '3') setMode(+e.key - 1); if ((e.key === 'l' || e.key === 'L') && painter.mode === 1) setLines(!G.lines); });

  if (hash && /nolines/.test(location.hash)) G.lines = false;
  applyG();
  if (hash) setMode(/gouache/.test(location.hash) ? 1 : /raw/.test(location.hash) ? 2 : 0); else syncMode(painter.mode);
  if (hash && closeUp && /close/.test(location.hash)) { setCloseUp(true); if (rig) rig.closeT = 1; }
  return { setMode, setCloseUp, setLines, applyG, panel, toggle, buttons };
}

// The reference camera rig. update(dt) eases parallax / orbit / the close-up blend (call it every frame);
// place() puts the camera (call it from painter.frame's beforeDraw, like the reference).
export function createOrbitRig(painter, { camBase, lookBase, closeFocus }) {
  const { renderer, camera, V, flags } = painter.ctx;
  const aim = new THREE.Vector2(), cur = new THREE.Vector2();
  const orbit = { yaw: 0.12, pitch: 0.16, r: 5.4, yawT: 0.12, pitchT: 0.16, rT: 5.4 };
  let dragging = null, closeT = 0;
  renderer.domElement.addEventListener('pointerdown', e => { if (flags.closeUp) { dragging = { x: e.clientX, y: e.clientY }; renderer.domElement.setPointerCapture(e.pointerId); } });
  addEventListener('pointerup', () => { dragging = null; });
  addEventListener('pointermove', e => {
    aim.set(e.clientX / innerWidth * 2 - 1, e.clientY / innerHeight * 2 - 1);
    if (dragging && flags.closeUp) {
      orbit.yawT = Math.max(-1.1, Math.min(1.1, orbit.yawT - (e.clientX - dragging.x) * 0.006));
      orbit.pitchT = Math.max(0.03, Math.min(0.75, orbit.pitchT + (e.clientY - dragging.y) * 0.004));
      dragging = { x: e.clientX, y: e.clientY };
    }
  });
  renderer.domElement.addEventListener('wheel', e => {
    if (!flags.closeUp) return;
    e.preventDefault();
    orbit.rT = Math.max(2.6, Math.min(10, orbit.rT * Math.exp(e.deltaY * 0.0012)));
  }, { passive: false });
  addEventListener('pointerleave', () => aim.set(0, 0));
  function update(dt) {
    cur.lerp(aim, 1 - Math.pow(0.04, dt));
    closeT += ((flags.closeUp ? 1 : 0) - closeT) * Math.min(1, dt * 2.5);
    const ok = Math.min(1, dt * 8);
    orbit.yaw += (orbit.yawT - orbit.yaw) * ok; orbit.pitch += (orbit.pitchT - orbit.pitch) * ok; orbit.r += (orbit.rT - orbit.r) * ok;
    if (Math.abs((flags.closeUp ? 1 : 0) - closeT) > 0.002) painter.markDirty();
  }
  function place() {
      const e = closeT * closeT * (3 - 2 * closeT);
      const farPos = V(camBase.x + cur.x * 1.6, camBase.y - cur.y * 0.6, painter.camZ), farLook = V(lookBase.x + cur.x * 0.6, lookBase.y, lookBase.z);
      const cp = Math.cos(orbit.pitch);
      const nearPos = V(closeFocus.x + Math.sin(orbit.yaw) * orbit.r * cp, closeFocus.y + 0.35 + Math.sin(orbit.pitch) * orbit.r, closeFocus.z + Math.cos(orbit.yaw) * orbit.r * cp);
      camera.position.copy(farPos.lerp(nearPos, e));
      camera.lookAt(farLook.lerp(closeFocus, e));
  }
  return { update, place, aim, cur, orbit, get closeT() { return closeT; }, set closeT(v) { closeT = v; } };
}
