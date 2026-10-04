// The opening (ART_DIRECTION §11): after the descent the camera drops to the CLOSE OVERHEAD landing view (~20 m,
// ~75° down) while our folk fly down and form square fleets by trade; the camera then visits each square as the sim
// introduces it (a lower-third caption, the roll-call); then "Choose your minister: click one of them" (hover lifts
// the folk, a click elects); the ceremony up close; then the camera eases up to the leader view and the welcome
// letter follows. Skippable: a 'skip' link, or any key twice. Director / tests: run({ auto: true }) picks the best
// diplomat by itself. The sim owns the script (sim/fleets.js: fleet:form, fleet:introduce, election:ask,
// ceremony:start/end, fleet:release); the agents bridge owns the poses; this module owns the camera, the UI and the click.
//
//   const opening = createOpening({ game, world, ui, agents, marksRef: () => marks, log });
//   await opening.run({ auto })          // resolves when the fleets are released and the camera is back up
//   opening.onFolkClick(agent, at) -> true when the click was the election's
//   opening.onFolkHover(agentId)         // the highlight under the cursor during the election
//   opening.skip()                       // the link / the double key
//   opening.phase -> 'idle' | 'landing' | 'intro' | 'paused' | 'election' | 'ceremony' | 'rising' | 'done'
//
// GUIDED (ART_DIRECTION §24, game/onboarding.js): run({ guided: true }) lands, spawns and forms the squares, then WAITS:
// no skip link, no key-twice skip, no auto intro (the onboarding panel speaks). introduce() starts the roll-call (the
// camera still visits each square; the names go to the panel); at the sim's ask the squares break and the folk go to
// work, the ask stays open with no crowd deadline, the camera rises to the leader view and onPaused() fires (phase
// 'paused': the opening is not "active", clicks open cards). elect() opens the election by click (the panel asks);
// the ceremony and the rise follow as before and run() resolves. finishGuided() ends it early (the panel's skip).

const sleep = ms => new Promise(r => setTimeout(r, ms));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ART_DIRECTION §20 (2026-10-04): until the election is finished the camera stays LOW and close (~20-25 degrees), so the
// folk read as characters (faces, clothes, gear), never as hats; it rises to the leader view only after the minister is
// chosen. The older values (35 / 28 / 24 degrees, §15) are superseded.
export const LANDING = { dist: 16, pitch: 0.40, ahead: 2.5 };      // the landing + the election view: ~23 degrees, the eye 6 m up and 15 m back, aimed 2.5 m past the spawn
                                                                    // (into the squares' arc), so the side squares stay inside her fisheye frame
export const SQUARE = { pitch: 0.38, min: 7.5, max: 11 };           // a visit to one square: ~22 degrees, 7.5-11 m by the square's size
export const CEREMONY = { pitch: 0.38, depth: 7, frac: 0.42 };     // the minister (floating up: agents/fleets.js lifts a flit to ~2 m, a floatie to ~3 m) is seen
                                                                    // side-on from `depth` m, `frac` of the half frame below the centre, clear of the seal title; the
                                                                    // target and the distance are solved from that in ministerView (they depend on the lift)

export function createOpening({ game, world, ui, agents, marksRef = () => null, log = () => {} } = {}) {
  const marksOf = () => { try { return marksRef(); } catch (_) { return null; } };
  let guided = false, pausedCb = null, pausedP = null;
  let phase = 'idle', electing = false, auto = false, skipping = false, hoverId = null, resolveRun = null, skipEl = null, keyT = 0, landedAt = 0, resulted = null, skipLabel = '';
  const agentOf = id => game.state.agents.find(a => a.id === id) || null;
  const active = () => phase !== 'idle' && phase !== 'done' && phase !== 'paused';
  const inWorld = () => !world.rig || world.rig.mode === 'map' || world.rig.mode === undefined;

  // ---------- camera ----------
  // the landing pose: the descent (globe dive / sky drop) ends on it, so the folk are seen coming down from close up
  function landingPose() {
    const sp = game.state.spawn || { x: 0, z: 9 }, v = (world.rig && world.rig.view) || { yaw: 0.1, fov: 40 };
    const x = sp.x, z = sp.z + LANDING.ahead; let y = 0; try { y = Math.max(0, world.groundY(x, z)); } catch (_) {}
    return { tx: x, ty: y, tz: z, yaw: v.yaw, pitch: LANDING.pitch, dist: LANDING.dist, fov: v.fov };
  }
  function landingView(ms = 2400) {
    const p = landingPose();
    try { return world.focus(p.tx, p.tz, { dist: p.dist, pitch: p.pitch, ms }); } catch (e) { log('opening camera', e.message); return Promise.resolve(false); }
  }
  function squareView(f, ms = 1200) {
    let info = null; try { info = agents.fleetInfo(f.fleetId || f.id); } catch (_) {}
    const c = (info && info.centre) || f.centre || game.state.spawn;
    const r = (info && info.radius) || 2;
    try { return world.focus(c.x, c.z, { dist: clamp(r * 4 + 7, SQUARE.min, SQUARE.max), pitch: SQUARE.pitch, ms }); } catch (e) { return Promise.resolve(false); }
  }
  function ministerView(a, ms = 1400) {
    if (!a) return Promise.resolve(false);
    let p = { x: a.x, z: a.z }; try { const h = agents.headOf(a.id); if (h) p = h; } catch (_) {}
    // the minister floats up by `lift` (its head above the ground): the camera target sits `ahead` m beyond it along the
    // view and `dist` m from the eye, solved so the floating folk is `depth` m from the eye and `frac` of the half frame
    // below the centre (screen-up offset u = -ahead sin p + lift cos p; depth = dist - ahead cos p - lift sin p)
    const sp = (() => { try { return agents.speciesOf(a.id); } catch (_) { return null; } })() || a.species;
    const lift = sp === 'floatie' ? 2.7 : 1.8, pt = CEREMONY.pitch, sn = Math.sin(pt), cs = Math.cos(pt);
    const fov = (world.rig && world.rig.goal && world.rig.goal.fov) || 50, tanHalf = Math.tan(fov * Math.PI / 360);
    const u = -CEREMONY.frac * tanHalf * CEREMONY.depth;
    const ahead = Math.max(0, (lift * cs - u) / sn), dist = CEREMONY.depth + ahead * cs + lift * sn;
    const yaw = (world.rig && world.rig.goal && world.rig.goal.yaw) || 0;
    try { return world.focus(p.x - Math.sin(yaw) * ahead, p.z - Math.cos(yaw) * ahead, { dist, pitch: pt, ms }); } catch (e) { return Promise.resolve(false); }
  }

  // ---------- the skip link (bottom-right, quiet) ----------
  function setSkip(text) {
    skipLabel = text || '';
    if (!text) { if (skipEl) { skipEl.remove(); skipEl = null; } return; }
    if (!skipEl) { skipEl = document.createElement('button'); skipEl.type = 'button'; skipEl.className = 'ag-link ag-skip'; skipEl.addEventListener('click', e => { e.currentTarget.blur(); skip(); }); (ui && ui.el || document.body).append(skipEl); }
    skipEl.textContent = text;
  }
  let hintT = 0;
  function skipHint(text, ms = 2200) { if (!skipEl) return; clearTimeout(hintT); skipEl.textContent = text; skipEl.classList.add('is-hint'); hintT = setTimeout(() => { if (skipEl) { skipEl.textContent = skipLabel; skipEl.classList.remove('is-hint'); } }, ms); }
  function onKey(e) {
    if (!active() || e.code === 'Space' || e.key === 'Shift' || e.key === 'Meta' || e.key === 'Control' || e.key === 'Alt' || e.key === 'Escape') return;
    if (ui && ui.voiceBar && ui.voiceBar.isTyping()) return;
    const now = performance.now();
    if (now - keyT < 2200) { keyT = 0; skip(); return; }
    keyT = now;
    skipHint(phase === 'election' ? 'press any key again and the folk choose for you' : 'press any key again to skip');
  }

  // ---------- the election click / hover ----------
  function highlight(id, on) { try { agents.highlight(id, on); } catch (_) {} }
  function onFolkHover(id) {
    if (!electing) { if (hoverId != null) { highlight(hoverId, false); hoverId = null; } return; }
    if (id === hoverId) return;
    if (hoverId != null) highlight(hoverId, false);
    hoverId = id;
    if (id != null) highlight(id, true);
    try { ui.election.hover(id != null ? agentOf(id) : null); } catch (_) {}
    document.body.style.cursor = id != null ? 'pointer' : '';
  }
  function onFolkClick(agent) {
    if (!electing || !agent) return false;
    elect(agent.id, 'click');
    return true;
  }
  function elect(id, how = 'click') {
    if (!electing) return false;
    const r = game.electMinister(id);
    log('opening elect', how, id, r && r.ok);
    if (!(r && r.ok)) { try { ui.notice(r && r.reason || 'That one cannot be minister.', { kind: 'minister', ttl: 4000 }); } catch (_) {} return false; }
    return true;
  }
  const bestDiplomat = () => game.state.agents.filter(a => a.status !== 'left').slice().sort((a, b) => ((b.skills || {}).diplomacy || 0) - ((a.skills || {}).diplomacy || 0))[0];

  // ---------- skip ----------
  function skip() {
    if (!active()) return false;
    const S = game.state;
    if (phase === 'election') {           // the folk choose for you
      if (!S.minister) { try { game.crowdElection('minister'); } catch (e) { log('crowd', e.message); } }
      return true;
    }
    if (phase === 'ceremony' || phase === 'rising') return false;
    skipping = true;
    try { ui.fleet.hide(); } catch (_) {}
    // the sim's own schedule, pulled to now: the introductions are over, the ask comes on the next tick
    if (!S.intro || !S.intro.started) game.introduceFleets({ first: 0, every: 0 });
    else S.fleetBeats = (S.fleetBeats || []).filter(b => b.what !== 'introduce' && b.what !== 'hop').map(b => (b.what === 'ask' ? { ...b, at: S.t } : b));
    return true;
  }

  // ---------- guided (the onboarding panel drives it) ----------
  // the roll-call is over: the squares break, the folk go to work, the ask stays open (no 90 s hold, no crowd at 150 s)
  async function pause() {
    phase = 'paused'; electing = false; skipping = false;
    try { ui.fleet.hide(); } catch (_) {}
    const S = game.state;
    S.fleetBeats = (S.fleetBeats || []).filter(b => b.what !== 'hold_over' && b.what !== 'crowd_if_open' && b.what !== 'auto_intro');
    try { if (S.fleetHold && !S.ceremony) game.releaseFleets(); } catch (e) { log('release', e.message); }
    const mk = marksOf(); if (mk) { try { mk.setEnabled(true); } catch (_) {} }
    try { await world.home({ ms: 3200 }); } catch (_) {}
    const cb = pausedCb; pausedCb = null; if (cb) cb(true);
  }
  // step 2: the camera visits each square while the panel names it; resolves when the folk go to work (the pause)
  function introduce({ every = 3.4, first = 0.6 } = {}) {
    if (!pausedP) pausedP = new Promise(res => { pausedCb = res; });
    if (phase === 'paused') { const cb = pausedCb; pausedCb = null; cb && cb(true); return pausedP; }
    (async () => {
      const t0 = performance.now();
      while (performance.now() - t0 < 3000 && phase === 'landing') { let ok = false; try { ok = agents.fleetsReady(); } catch (_) {} if (ok) break; await sleep(200); }
      if (game.state.intro && game.state.intro.started) return;
      if (game.state.minister) { onAsk(); return; }
      game.introduceFleets({ every, first });
    })().catch(e => log('introduce', e.message));
    return pausedP;
  }
  // step 2: one wide, low view over every square at once
  function overview(ms = 2400) {
    const sp = game.state.spawn || { x: 0, z: 9 };
    try { return world.focus(sp.x, sp.z + 1.5, { dist: 30, pitch: 0.52, ms }); } catch (e) { return Promise.resolve(false); }
  }
  // the panel's Continue during the roll-call: the rest of the introductions are dropped, the ask comes now
  function skipIntros() {
    const S = game.state;
    if (phase === 'paused' || phase === 'idle' || phase === 'done') return false;
    skipping = true;
    try { ui.fleet.hide(); } catch (_) {}
    if (!S.intro || !S.intro.started) game.introduceFleets({ first: 0, every: 0 });
    else S.fleetBeats = (S.fleetBeats || []).filter(b => b.what !== 'introduce' && b.what !== 'hop').map(b => (b.what === 'ask' ? { ...b, at: S.t } : b));
    return true;
  }
  // step 5: the election by click; the camera comes a little closer over the folk so they are easy to click
  function openElection() {
    if (game.state.minister) return false;
    phase = 'election'; electing = true; resulted = null;
    { const mk = marksOf(); if (mk) { try { mk.setEnabled(false); } catch (_) {} } }   // a left click is the election's, not the pencil's
    try {
      const folk = game.state.agents.filter(a => a.status !== 'left');
      if (folk.length) {
        const cx = folk.reduce((t, a) => t + a.x, 0) / folk.length, cz = folk.reduce((t, a) => t + a.z, 0) / folk.length;
        world.focus(cx, cz, { dist: 34, pitch: 0.82, ms: 1800 });
      }
    } catch (e) { log('elect camera', e.message); }
    try { ui.election.prompt(); } catch (e) { log('prompt', e.message); }
    return true;
  }
  // the panel's skip (or a minister chosen by voice while paused): no ceremony to wait for
  function finishGuided({ crowd = false } = {}) {
    if (phase === 'idle' || phase === 'done') return;
    if (crowd && !game.state.minister) { try { game.crowdElection('minister'); } catch (e) { log('crowd', e.message); } }
    try { ui.election.end(); } catch (_) {}
    finish();
  }

  // ---------- the script, by the sim's events ----------
  let introduced = 0;
  function onIntroduce(f) {
    if (!active() || skipping) return;
    phase = 'intro'; introduced++;
    if (guided) return;      // §24: the panel says it in one line; the camera holds the overview (no tour, no captions)
    squareView(f);
    const counts = { flit: 0, floatie: 0 };
    for (const id of f.members || []) { let sp = null; try { sp = agents.speciesOf(id); } catch (_) {} const a = agentOf(id); sp = sp || (a && a.species); if (sp) counts[sp] = (counts[sp] || 0) + 1; }   // + the townsfolk companies (nine loaves, nine twinkles ...)
    try { ui.fleet.caption({ name: f.name, counts, index: (f.index || 0) + 1, total: f.total || (game.state.fleets || []).length || null }); } catch (e) { log('caption', e.message); }
  }
  async function onAsk() {
    if (!active()) return;
    if (guided) { await pause(); return; }
    phase = 'election'; electing = true; skipping = false;
    try { ui.fleet.hide(); } catch (_) {}
    landingView(1800);
    setSkip('let the folk choose');
    try { ui.election.prompt(); } catch (e) { log('prompt', e.message); }
    if (auto) { await sleep(1600); const a = bestDiplomat(); if (a && electing) elect(a.id, 'auto'); }
  }
  function onResult({ agentId, by }) {
    if (!active() || agentId == null || resulted === agentId) return;
    resulted = agentId; electing = false; onFolkHover(null);
    const a = agentOf(agentId);
    setSkip(null);
    if (by === 'crowd') { try { ui.notice(`The folk have voted: ${a ? a.name : 'someone'} carries the seal.`, { kind: 'ministry', ttl: 5000 }); } catch (_) {} }
    try { ui.election.elected(a).catch(() => {}); } catch (e) { log('elected', e.message); }
    // the crowd's choice holds no ceremony in the sim (the ask is closed before the appointment): break the squares ourselves
    if (by === 'crowd' && game.state.fleetHold) setTimeout(() => { try { if (game.state.fleetHold && !game.state.ceremony) game.releaseFleets(); } catch (e) { log('release', e.message); } }, 3600);
  }
  function onCeremony({ agentId }) {
    if (!active()) return;
    phase = 'ceremony'; electing = false; onFolkHover(null); setSkip(null);
    try { ui.fleet.hide(); } catch (_) {}
    ministerView(agentOf(agentId));
  }
  async function onRelease() {
    if (!active()) return;
    if (electing) { /* the sim's 90 s safety net: they go to work, the ask stays open; the camera still rises */ }
    phase = electing ? 'election' : 'rising';
    if (!electing) { setSkip(null); try { ui.election.end(); } catch (_) {} }
    try { await world.home({ ms: 3200 }); } catch (_) {}
    if (!electing) finish();
    else { try { ui.hint.show('Choose your minister: click one of the folk, or say "make Olla our minister".', { ttl: 9000, guide: true }); } catch (_) {} }
  }
  function finish() {
    if (phase === 'done') return;
    phase = 'done'; electing = false; onFolkHover(null); setSkip(null);
    try { ui.fleet.hide(); } catch (_) {}
    const mk = marksOf(); if (mk) { try { mk.setEnabled(true); } catch (_) {} }
    removeEventListener('keydown', onKey, true);
    const r = resolveRun; resolveRun = null; if (r) r(true);
  }
  // a minister chosen with no ask open (voice during the intro, or a late one) still ends an open election
  function onMinisterSet({ agentId, by }) { if (electing && agentId != null) onResult({ agentId, by: by || 'sovereign' }); }

  game.on('fleet:introduce', f => { try { onIntroduce(f); } catch (e) { log('opening', e.message); } });
  game.on('election:ask', () => { onAsk().catch(e => log('opening ask', e.message)); });
  game.on('election:result', r => { try { onResult(r); } catch (e) { log('opening', e.message); } });
  game.on('minister:set', m => { try { onMinisterSet(m); } catch (_) {} });
  game.on('ceremony:start', c => { try { onCeremony(c); } catch (e) { log('opening', e.message); } });
  game.on('fleet:release', () => { onRelease().catch(e => log('opening release', e.message)); });
  // the squares already broke (the sim's 90 s net) and the minister came later: no second fleet:release follows the ceremony
  game.on('ceremony:end', () => { if (active() && !game.state.fleetHold) onRelease().catch(e => log('opening end', e.message)); });

  // ---------- run ----------
  async function run({ auto: a = false, every = null, guided: g = false } = {}) {
    if (active()) return new Promise(res => { const r0 = resolveRun; resolveRun = v => { r0 && r0(v); res(v); }; });
    auto = !!a; guided = !!g && !auto; skipping = false; introduced = 0; resulted = null; phase = 'landing'; pausedP = null; pausedCb = null;
    const done = new Promise(res => { resolveRun = res; });
    { const mk = marksOf(); if (mk) { try { mk.setEnabled(false); } catch (_) {} } }
    if (!guided) { addEventListener('keydown', onKey, true); setSkip('skip the introductions'); }
    // the camera drops to the landing view while the folk glide down into their squares (game.spawnAll forms the fleets)
    landingView(2400);
    game.spawnAll();
    if (guided) {   // the panel holds the moment: no auto intro 14 s after the squares form
      game.state.fleetBeats = (game.state.fleetBeats || []).filter(b => b.what !== 'auto_intro');
      landedAt = performance.now();
      return done;
    }
    const t0 = performance.now();
    while (performance.now() - t0 < 12500 && active() && !skipping) { let ok = false; try { ok = agents.fleetsReady(); } catch (_) {} if (ok && performance.now() - t0 > 4000) break; await sleep(250); }
    landedAt = performance.now();
    if (!active()) return done;
    if (phase === 'landing' && !game.state.minister) { await sleep(skipping ? 0 : 900); if (!(game.state.intro && game.state.intro.started)) game.introduceFleets({ every: every != null ? every : auto ? 2.6 : 3.4, first: 0.8 }); }
    return done;
  }

  return {
    run, skip, onFolkClick, onFolkHover, finish, introduce, skipIntros, elect: openElection, finishGuided, overview, get guided() { return guided; },
    get phase() { return phase; }, get electing() { return electing; }, get active() { return active(); }, get hoverId() { return hoverId; },
    get introduced() { return introduced; }, get landedAt() { return landedAt; }, landingView, landingPose
  };
}
