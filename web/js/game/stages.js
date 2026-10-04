// Stages: where the camera is. Her Tower Planet (ART_DIRECTION §12) for the orbit, the descents, the nations and the
// voyage; HOME is the old seaside map (web/js/world, §21) the planet hands over to as we land. 'world' = down on the
// seaside map (its own leader rig, its own canvas under hers), 'globe' = her orbit (Grain) or a flight between places
// (her descendTo), 'moon' = Act 3, Plissé (web/worlds/plisse.html, verbatim, in an iframe driven from outside by
// voyage/plisse-driver.js; the stand-in Plissé in her space is what we fly to, ART_DIRECTION §16).
//
//   const stages = createStages({ game, world, planet, geo, agents, ui, log, sea: { world, painter, canvas, ready } });
//   stages.preload();                                            // perf (docs/perf.md §5): the bridge + Plissé + the lounge, built tiny and frozen in a calm moment
//   await stages.introGlobe(); await stages.diveHome({ to });   // ?intro=globe: the title over her orbit, Begin -> her descent -> the seaside
//   await stages.showGlobe(); await stages.visitNation('n2'); await stages.homeFromGlobe();   // diplomacy (up through her orbit, down to the seaside)
//   await stages.goMoon(); await stages.goHome();              // act 3 (Plissé; the Alpine-lounge landing is the bridge's)
//   stages.scene -> 'world' | 'globe' | 'moon';  stages.paintPlanet / stages.paintSea -> which canvas the loop draws
//
// `world` is her planet's facade (game/planet-world.js: orbit, descent, jump); `sea.world` the seaside map
// (world/world.js createWorld). The landing hand-off (docs/world.md "The landing hand-off"): descend her camera to the
// map's leader framing (handoffPose().descend) with her lens easing to zero over the last 1.5 s, snap the map's rig to
// the same pose, let it paint under her, cross-fade her canvas out over 1 s, stop her. Going up is the reverse.
// Without `sea` the stages run on her planet alone (the 2026-10-04 game).

import { createCloudPass } from './cloud-pass.js';
import { mapFlat, H as terrainH } from '../planet/terrain.js';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const frames = (n = 2) => new Promise(r => { const f = () => (--n <= 0 ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); });
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// perf (docs/perf.md §3): a hidden world is a tenth of the viewport (TINY) or frozen; Plissé grows at PLISSE_GROW of the
// flight out and GROW s before the bridge uncovers her on the way home; the lounge wakes LOUNGE_WAKE s before cut 2
const TINY = 0.1, PLISSE_GROW = 0.74, GROW = 2.2, LOUNGE_WAKE = 2.2;
const HANDOFF = { descendMs: 6000 };   // her descendTo's length (the swap is at SWAP.s of it; the map's part follows)

export function createStages({ game, world, planet, geo, agents = null, ui = null, log = () => {}, sea = null, plisseSrc = 'worlds/plisse.html', loungeSrc = 'worlds/lounge.html' } = {}) {
  let scene = 'world', fading = false, flying = false;
  const veil = document.createElement('div'); veil.className = 'ag-veil'; document.body.appendChild(veil);
  const listeners = new Set();
  const setScene = s => { if (scene === s) return; scene = s; log('stage', s); listeners.forEach(fn => { try { fn(s); } catch (e) { console.error('[stages]', e); } }); try { game.emit('stage:' + s, { scene: s }); } catch (_) {} };
  const home = () => world.homePose();
  const nationPose = n => ({ tx: n.x, tz: n.z, dist: (n.view && n.view.dist) || 70, pitch: (n.view && n.view.pitch) || 0.95, yaw: (n.view && n.view.yaw) || 0, fov: 50 });

  // ---------- her lens ----------
  // her base lens is whatever her look says while we are not touching it (assets/look.json / the G lab may change it):
  // it is read afresh each time we take the lens over, and given back exactly at k = 0
  let fishBase = null, lensOwned = false, lensRaf = 0;
  const FISH = () => planet.post.post.uniforms.uFish;
  const setLens = k => { const F = FISH(); if (!lensOwned || fishBase == null) fishBase = F.value; lensOwned = k > 0; F.value = fishBase * (1 - k); };
  const lensK = () => { if (!lensOwned || !fishBase) return 0; return 1 - FISH().value / fishBase; };
  // ease her lens from where it is to k over ms, starting `after` ms from now (cancels any running ease)
  function easeLens(k, ms, after = 0) {
    cancelAnimationFrame(lensRaf);
    const k0 = lensK(), t0 = performance.now() + after;
    return new Promise(res => {
      const f = now => { const u = smooth(0, 1, (now - t0) / Math.max(1, ms)); setLens(k0 + (k - k0) * u); if (now - t0 < ms) lensRaf = requestAnimationFrame(f); else res(); };
      lensRaf = requestAnimationFrame(f);
    });
  }

  // ---------- the seaside map (ART_DIRECTION §21): which canvas is the ground ----------
  // The landing is ONE uncut shot (Sueda 2026-10-04: "i want the descent to earth to be seamless ... no cuts in
  // between"). Her descendTo carries the camera down from wherever it is; a bank of her clouds (game/cloud-pass.js)
  // stands over the landing target; the camera flies into it, and while the inside of the cloud fills the frame her
  // canvas is swapped for the map's at the very same pose (the map has been painting under hers for a few frames).
  // The map's camera carries straight on from her path (same pose, same speed: a Hermite from her path's state at the
  // swap) out of the cloud and down to the landing view. Going up is the same shot backwards: the map's camera rises
  // into the cloud, her canvas comes back at the same pose inside it, and her camera rises on out to her orbit.
  // The puffs live in a flat frame on the landing target, so both cameras see them at the same pixels at the swap.
  const sw = sea && sea.world, seaCanvas = sea && sea.canvas, planetCanvas = planet.renderer.domElement;
  let surface = 'planet', planetOn = true, seaOn = false;
  if (sw) { sw.rig.enabled = false; world.rig.enabled = false; }
  const handoff = () => sw.handoffPose({ aspect: innerWidth / innerHeight });
  const descendPose = d => ({ tx: d.x, tz: d.z, dist: d.dist, pitch: d.pitch, yaw: d.yaw, fov: d.fov });
  const clouds = sw && sea.camera ? createCloudPass({ zIndex: 2 }) : null;
  if (clouds) clouds.prepare().catch(e => log('clouds', e.message));
  const adapter = world.adapter;
  // SWAP.s: the latest point on her path (0..1) for the swap (flyDown picks the point where the camera is down to the
  // cloud's height, past her focus slide, s >= .62). pre: ms the other canvas paints underneath before the swap: 0, since
  // the cloud is fully opaque at the swap, and two canvases painting at once doubles the GPU load (a hitch at dpr 2)
  const SWAP = { s: 0.85, pre: 0, seaMin: 1400, seaMax: 3800, upPitch: 1.4, upRate: 0.32, upSeaMs: 3000, upPlanetMs: 3800 };
  const wrapA = a => Math.atan2(Math.sin(a), Math.cos(a));
  const herm = (x0, v0, x1, v1, u, T) => { const u2 = u * u, u3 = u2 * u; return (2 * u3 - 3 * u2 + 1) * x0 + (u3 - 2 * u2 + u) * T * v0 + (3 * u2 - 2 * u3) * x1 + (u3 - u2) * T * v1; };
  // a pose between a (moving at va, per second) and b (arriving at vb) over T seconds, u in 0..1; dist eases in log space
  function poseBetween(a, va, b, vb, u, T) {
    const y1 = a.yaw + wrapA(b.yaw - a.yaw), v = (o, k) => (o && o[k]) || 0;
    return {
      tx: herm(a.tx, v(va, 'tx'), b.tx, v(vb, 'tx'), u, T), ty: herm(a.ty, 0, b.ty, 0, u, T), tz: herm(a.tz, v(va, 'tz'), b.tz, v(vb, 'tz'), u, T),
      dist: Math.exp(herm(Math.log(a.dist), v(va, 'ldist'), Math.log(b.dist), v(vb, 'ldist'), u, T)),
      pitch: herm(a.pitch, v(va, 'pitch'), b.pitch, v(vb, 'pitch'), u, T), yaw: herm(a.yaw, v(va, 'yaw'), y1, v(vb, 'yaw'), u, T),
      fov: herm(a.fov, 0, b.fov, 0, u, T)
    };
  }
  // her descent path (planet/views.js placePath), in the game's terms, for s past her focus slide
  const _d0 = new THREE.Vector3(), _d1 = new THREE.Vector3();
  function pathAt(path, s) {
    const a = path.from, b = path.to;
    mapFlat(a.fx, 0, a.fz, _d0).normalize(); mapFlat(b.fx, 0, b.fz, _d1).normalize();
    const arc = Math.acos(Math.max(-1, Math.min(1, _d0.dot(_d1))));
    const hop = Math.max(0, arc * RP * 0.55 - Math.max(a.dist, b.dist)) * Math.sin(Math.PI * Math.min(1, s / 0.8));
    const dist = Math.exp(Math.log(a.dist) + (Math.log(b.dist) - Math.log(a.dist)) * smooth(0.04, 1, s)) + hop;
    const p0 = a.pitch + (Math.PI / 2 - a.pitch) * smooth(0, 0.25, s), pitch = p0 + (b.pitch - p0) * smooth(0.58, 1, s);
    const yaw = adapter.yawFromPlanet(a.yaw + wrapA(b.yaw - a.yaw) * smooth(0.12, 0.9, s));
    return { dist, pitch, yaw };
  }
  // the cloud's frame on her planet: the tangent frame on the landing target, at her own ground there (views.js poseAt)
  function planetAnchor(A) {
    const p = adapter.toPlanet(A.x, A.z, {}), f = adapter.frame(A.x, A.z, { y: Math.max(0, terrainH(p.fx, p.fz)) });
    const M = new THREE.Matrix4().compose(f.position, f.quaternion, new THREE.Vector3(1, 1, 1));
    return { M, Minv: M.clone().invert(), q: f.quaternion, pos: f.position };
  }
  const anchorOf = hp => ({ x: hp.pose.tx, y: hp.pose.ty, z: hp.pose.tz });
  // the map camera's eye along a planned move, in the anchor frame (the cloud keeps its wisps off it)
  const eyePath = (at, A, n = 48) => { const out = []; for (let i = 0; i <= n; i++) { const p = at(i / n), cp = Math.cos(p.pitch) * p.dist; out.push({ x: p.tx - A.x + Math.sin(p.yaw) * cp, y: p.ty - A.y + Math.sin(p.pitch) * p.dist, z: p.tz - A.z + Math.cos(p.yaw) * cp }); } return out; };
  // a pose in the anchor frame -> her world: { position, look, up } (views.js poseAt's convention, the map rig's yaw)
  function anchorPose(pa, d, pitch, yaw) {
    const cp = Math.cos(pitch), sp = Math.sin(pitch), hx = Math.sin(yaw), hz = Math.cos(yaw);
    const position = new THREE.Vector3(hx * cp * d, sp * d, hz * cp * d).applyMatrix4(pa.M);
    const up = new THREE.Vector3(-hx * sp, cp, -hz * sp).applyQuaternion(pa.q).normalize();
    return { position, look: pa.pos.clone(), up };
  }

  // the move in flight: { kind: 'down' | 'up', phase, ... }; stepped by beforeFrame (game.js, before anything is placed)
  let move = null, cloudCam = null, cloudAt = null;   // cloudAt: { pa, A } of the last move (the cloud's frame)
  const lc = new THREE.PerspectiveCamera(), _m = new THREE.Matrix4();

  // planet -> seaside, one shot: her descendTo, the cloud, the map's camera carrying on to `end`
  function flyDown({ end = null, ms = HANDOFF.descendMs } = {}) {
    if (!sw) return Promise.resolve(false);
    if (surface === 'sea') return Promise.resolve(true);
    if (move) cancelMove();
    const hp = handoff(), A = anchorOf(hp), pa = planetAnchor(A);
    const to = { ...hp.pose, ...(end || {}) };
    world.rig.enabled = false; sw.rig.enabled = false; sw.rig.stop();
    const descP = world.descent({ to: descendPose(hp.descend), ms });
    const path = planet.state().path;
    if (!path) { descP.catch(() => {}); return land({ snap: true, pose: end }); }
    // the swap: on her path past the focus slide, where the camera is down to Hs (twice the end view's eye height, so the
    // cloud is well above the end view; 170-265 m: the map shows no edge under that)
    const eyeH = p => p.dist * Math.sin(p.pitch), Hs = Math.max(170, Math.min(265, 2 * eyeH(to)));
    let s = SWAP.s;
    for (let x = 0.64; x <= SWAP.s; x += 0.005) { const q = pathAt(path, x); if (eyeH(q) <= Hs) { s = x; break; } }
    const h = 0.002, P = pathAt(path, s), P0 = pathAt(path, s - h), P1 = pathAt(path, s + h), k = 1000 / ms / (2 * h);
    const Hc = eyeH(P), lo = Math.max(0.55, Math.min(0.8, eyeH(to) / Hc + 0.08));
    const start = { tx: A.x, ty: A.y, tz: A.z, dist: P.dist, pitch: P.pitch, yaw: P.yaw, fov: hp.pose.fov };
    const vel = { ldist: (Math.log(P1.dist) - Math.log(P0.dist)) * k, pitch: (P1.pitch - P0.pitch) * k, yaw: wrapA(P1.yaw - P0.yaw) * k };
    // the map's part lasts long enough that it never overshoots (her speed carried, eased to rest on `to`)
    const dl = Math.abs(Math.log(to.dist / P.dist)), seaMs = Math.max(SWAP.seaMin, Math.min(SWAP.seaMax, 1000 * 1.2 * dl / Math.max(0.05, Math.abs(vel.ldist))));
    { const cp = Math.cos(P.pitch) * P.dist; clouds.deck(Hc, Math.sin(P.yaw) * cp, Math.cos(P.yaw) * cp, { lo, avoid: eyePath(u => poseBetween(start, vel, to, null, u, seaMs / 1000), A) }); }
    cloudCam = 'planet'; cloudAt = { pa, A };
    return new Promise(resolve => { move = { kind: 'down', phase: 'planet', T0: null, ms, sw: s, seaMs, A, pa, path, start, vel, to, resolve }; });
  }
  // seaside -> planet, one shot: the map's camera rises into the cloud, hers rises on out of it to her orbit
  function flyUp() {
    if (!sw || surface !== 'sea') return Promise.resolve(false);
    if (move) cancelMove();
    const hp = handoff(), A = anchorOf(hp), pa = planetAnchor(A);
    sw.rig.enabled = false; sw.rig.stop();
    // the orbit we rise to (planet-world.js orbit({ over: geo.centre }): turned to face home)
    const T = ORBIT_TARGET, wc = adapter.toWorld(geo.centre.x, 0, geo.centre.z), dd = wc.clone().sub(T).normalize();
    const az = Math.atan2(dd.x, dd.z), el = Math.max(-1.25, Math.min(1.35, Math.asin(dd.y))), od = planet.state().orbit.dist;
    const O = new THREE.Vector3(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)).multiplyScalar(od).add(T);
    // the yaw whose screen-up is her orbit's up (so the rise never rolls)
    const ul = new THREE.Vector3(0, 1, 0).applyQuaternion(pa.q.clone().invert());
    const cur = { ...sw.rig.pose() };
    const yawUp = Math.hypot(ul.x, ul.z) > 0.05 ? Math.atan2(-ul.x, -ul.z) : cur.yaw;
    // the cloud is twice the start view's eye height up (170-265 m), so the rise starts in clear air
    const startEye = cur.dist * Math.sin(cur.pitch), Hc = Math.max(170, Math.min(265, 2 * startEye));
    // the turn to her orbit's up is shared: half on the map's rise, half on hers (never a fast spin)
    const yawEnd = cur.yaw + wrapA(yawUp - cur.yaw);
    const top = { tx: A.x, ty: A.y, tz: A.z, dist: Hc / Math.sin(SWAP.upPitch), pitch: SWAP.upPitch, yaw: (cur.yaw + yawEnd) / 2, fov: hp.pose.fov };
    const lo = Math.max(0.55, Math.min(0.8, startEye / Hc + 0.08));
    { const cp = Math.cos(top.pitch) * top.dist; clouds.deck(Hc, Math.sin(top.yaw) * cp, Math.cos(top.yaw) * cp, { lo, avoid: eyePath(u => poseBetween(cur, null, top, { ldist: SWAP.upRate }, u, SWAP.upSeaMs / 1000), A) }); }
    cloudCam = 'sea'; cloudAt = { pa, A };
    return new Promise(resolve => { move = { kind: 'up', phase: 'sea', T0: null, A, pa, cur, top, yawEnd, O, T, Dtop: O.distanceTo(pa.pos), resolve }; });
  }
  function cancelMove() { const m = move; move = null; cloudCam = null; if (clouds) clouds.hide(); if (m) m.resolve(false); }
  function showPlanet(op) { planetOn = true; planetCanvas.style.display = ''; planetCanvas.style.opacity = String(op); }
  function hidePlanet() { planetOn = false; planetCanvas.style.opacity = '0'; planetCanvas.style.display = 'none'; }

  // every frame, first (game.js): the map's camera for this frame, the swaps
  function beforeFrame(now) {
    const m = move; if (!m) return;
    if (m.T0 == null) m.T0 = now;
    const t = now - m.T0;
    if (m.kind === 'down') {
      if (m.phase === 'planet') {
        const s = t / m.ms;
        if (!seaOn && s >= m.sw - SWAP.pre / m.ms) { seaOn = true; try { sea.painter.markDirty(); } catch (_) {} }
        if (seaOn) sw.rig.setPose({ ...m.start, ...pathAt(m.path, Math.max(0.62, Math.min(m.sw, s))) });
        if (s >= m.sw) {
          // inside the cloud: her canvas goes, the map (painting under it for a few frames) is the ground
          hidePlanet(); world.stop(); surface = 'sea'; cloudCam = 'sea'; m.phase = 'sea'; at('handoff');
        }
      }
      if (m.phase === 'sea') {
        const u = Math.min(1, Math.max(0, (t - m.sw * m.ms) / m.seaMs));
        sw.rig.setPose(poseBetween(m.start, m.vel, m.to, null, u, m.seaMs / 1000));
        if (u >= 1) { sw.rig.setPose({ ...m.to }); move = null; cloudCam = null; sw.rig.enabled = true; world.rig.enabled = false; m.resolve(true); }
      }
      return;
    }
    // up
    if (m.phase === 'sea') {
      const T = SWAP.upSeaMs, u = Math.min(1, t / T);
      const p = poseBetween(m.cur, null, m.top, { ldist: SWAP.upRate }, u, T / 1000);
      sw.rig.setPose(p);
      if (t >= T - SWAP.pre) {
        // her canvas paints (unseen) at the same pose for a few frames before it is shown
        if (!planetOn) { world.free(); showPlanet(0); }
        const ap = anchorPose(m.pa, p.dist, p.pitch, p.yaw);
        planet.cameraFree({ ...ap, fov: fovV(p.fov), snap: true });
      }
      if (u >= 1) {
        showPlanet(1); seaOn = false; surface = 'planet'; cloudCam = 'planet'; m.phase = 'planet'; at('handoff');
        cancelAnimationFrame(lensRaf); setLens(0);
      } else return;
    }
    if (m.phase === 'planet') {
      const T = SWAP.upPlanetMs, v = Math.min(1, (t - SWAP.upSeaMs) / T);
      const d = Math.exp(herm(Math.log(m.top.dist), SWAP.upRate, Math.log(m.Dtop), 0, v, T / 1000));
      const pitch = herm(SWAP.upPitch, 0, Math.PI / 2 - 1e-3, 0, v, T / 1000);
      const ap = anchorPose(m.pa, d, pitch, herm(m.top.yaw, 0, m.yawEnd, 0, Math.min(1, v / 0.6), 1)), w = smooth(0.2, 1, v);
      ap.position.lerp(m.O, w); ap.look.lerp(m.T, w); ap.up.lerp(_Y, w).normalize();
      planet.cameraFree({ ...ap, fov: fovV(m.top.fov) + (40 - fovV(m.top.fov)) * w, snap: true });
      if (v >= 1) { move = null; cloudCam = null; world.orbit({ over: geo.centre, spin: false }); m.resolve(true); }
    }
  }
  const _Y = new THREE.Vector3(0, 1, 0);
  // the map rig's fov as the vertical fov it uses at this aspect (world/camera.js fovFor: portrait widens)
  const fovV = f => { const a = innerWidth / innerHeight; return a >= 1.3 ? f : Math.min(78, THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(f) / 2) * 1.3 / a))); };
  // every frame, last (game.js): the cloud, seen by whichever camera is live
  function afterFrame() {
    if (!clouds) return;
    if (!cloudCam || !cloudAt) { if (clouds.shown) clouds.hide(); return; }
    if (cloudCam === 'planet') {
      const cam = planet.camera;
      lc.matrixWorld.multiplyMatrices(cloudAt.pa.Minv, cam.matrixWorld);
      lc.projectionMatrix.copy(cam.projectionMatrix);
    } else {
      const cam = sea.camera, A = cloudAt.A;
      _m.makeTranslation(-A.x, -A.y, -A.z);
      lc.matrixWorld.multiplyMatrices(_m, cam.matrixWorld);
      lc.projectionMatrix.copy(cam.projectionMatrix);
    }
    lc.matrixWorld.decompose(lc.position, lc.quaternion, lc.scale);
    // the bank gathers (its puffs swell from nothing) over the first part of a move, and on the way up it melts away
    // (they shrink to nothing) before her orbit: it is never there when a move starts or ends
    const m = move; let grow = 1;
    if (m && m.T0 != null) {
      const t = performance.now() - m.T0;
      if (m.kind === 'up') grow = m.phase === 'sea' ? smooth(0, 0.45, t / SWAP.upSeaMs) : 1 - smooth(0.35, 0.85, (t - SWAP.upSeaMs) / SWAP.upPlanetMs);
      else if (m.phase === 'planet') grow = smooth(0.08, 0.4, t / m.ms);
    }
    clouds.draw(lc, { grow });
  }
  // a hard cut (skip): straight onto the map at the landing pose, no cloud
  let landing = null;
  async function land({ snap = true, pose = null } = {}) {
    if (!sw) return false;
    if (move) cancelMove();
    if (surface === 'sea') { if (pose) sw.rig.setPose({ ...handoff().pose, ...pose }); return true; }
    if (landing) return landing;
    landing = (async () => {
      try { await Promise.race([sea.ready, sleep(snap ? 0 : 12000)]); } catch (_) {}
      sw.rig.stop();
      sw.rig.setPose({ ...handoff().pose, ...(pose || {}) });
      try { sea.painter.markDirty(); } catch (_) {}
      seaOn = true; surface = 'sea';
      hidePlanet();
      world.rig.enabled = false; sw.rig.enabled = true;
      return true;
    })();
    try { return await landing; } finally { landing = null; }
  }
  // the old names: the descent to the map's framing, and going up (one shot each now)
  async function descendToSea(o = {}) { try { await Promise.race([sea.ready, sleep(12000)]); } catch (_) {} return flyDown(o); }
  async function lift() { const ok = await flyUp(); cloudCam = null; return ok; }

  // ---------- the opening ----------
  async function introGlobe() {
    world.orbit({ over: geo.centre, spin: true });
    setScene('globe'); world.rig.enabled = false;
    return planet;
  }
  let dive = null;
  async function diveHome({ skip = false, to = undefined, ms = sw ? HANDOFF.descendMs : 7500 } = {}) {
    if (sw) {
      // one shot from her orbit, through the cloud, down to `to` (the opening's landing camera) on the map
      world.rig.enabled = false;
      if (skip) { dive = null; await land({ snap: true, pose: to || null }); setScene('world'); return true; }
      const token = dive = {};
      const ok = await descendToSea({ end: to || null, ms });
      if (dive !== token) { if (landing) { try { await landing; } catch (_) {} } setScene('world'); return ok; }   // skipped: skipDive is landing
      dive = null;
      if (surface !== 'sea') await land({ snap: true, pose: to || null });
      setScene('world');
      return true;
    }
    const pose = { ...home(), ...(to || {}) };
    world.rig.enabled = false;
    if (skip) { world.jump(pose); setScene('world'); world.rig.enabled = true; return true; }
    dive = pose;
    const ok = await world.descent({ to: pose, ms });
    if (dive !== pose) return ok;
    dive = null;
    if (!ok) world.jump(pose);
    setScene('world'); world.rig.enabled = true;
    return true;
  }
  function skipDive() {
    if (!dive) return;
    if (sw) { dive = null; world.stop(); land({ snap: true }).then(() => setScene('world')); return; }
    const p = dive; dive = null; world.stop(); world.jump(p); setScene('world'); world.rig.enabled = true;
  }

  // ---------- diplomacy: "show me the neighbours" / "visit X" / "come back down" ----------
  async function showGlobe() {
    if (scene === 'moon' || flying) return false;
    flying = true;
    try {
      setScene('globe');
      if (surface === 'sea') { await lift(); easeLens(0, 1800); }
      world.rig.enabled = false;
      world.orbit({ over: sw ? geo.centre : { x: world.rig.cur.tx, z: world.rig.cur.tz }, spin: true });
    } finally { flying = false; }
    await sleep(2800);
    return true;
  }
  async function visitNation(id, { hold = 2600 } = {}) {
    if (scene === 'moon' || flying) return false;
    const n = geo.placeById(id); if (!n) return false;
    flying = true;
    try {
      setScene('globe');
      if (surface === 'sea') { await lift(); easeLens(0, 1800); }
      world.rig.enabled = false;
      await world.descent({ to: nationPose(n), ms: 5200 });
    } finally { flying = false; }
    await sleep(hold);
    return true;
  }
  async function homeFromGlobe() {
    if (scene === 'moon' || flying) return false;
    if (sw ? surface === 'sea' : (scene === 'world' && world.mode === 'map')) return false;
    flying = true;
    try {
      if (sw) {
        // from a nation (her local camera): out to her orbit first, so home is always reached down through the cloud
        if (planet.state().mode !== 'orbit') { at('rise'); world.rig.enabled = false; world.orbit({ over: geo.centre, spin: false }); await settleOrbit(1800, 4200); }
        at('descent'); await descendToSea({ end: null });
        if (surface !== 'sea') await land({ snap: true });
      }
      else { await world.descent({ to: home(), ms: 5200 }); world.rig.enabled = true; }
    } finally { flying = false; step = null; }
    setScene('world');
    return true;
  }

  // ---------- act 3: Plissé, the landing, the Alpine lounge (ART_DIRECTION §16; the chain of web/act3-lab.html) ----------
  // Earth orbit -> the stand-in Plissé in her sky (planet/plisse-standin.js) -> her free camera along standin.flight ->
  // the cross-fade into worlds/plisse.html (verbatim, voyage/plisse-driver.js) -> her camera eases to the dusk ring ->
  // the landing bridge (voyage/landing-bridge.js: the dive onto the ring, painted into the meadow) -> the cross-fade into
  // worlds/lounge.html (verbatim, voyage/lounge-driver.js = stages.driver: dropSeed / setGoldenHour). goHome() runs it
  // all in reverse. Every iframe is only ever faded, never scaled or filtered (setSize only resizes a HIDDEN frame).
  let standin = null, plisseEl = null, pd = null, loungeEl = null, ld = null, bridge = null, bridgeP = null, flightRaf = 0;
  let loungeReadyAt = 0, BRIDGE = null, ARRIVAL = null;
  let plisseNeeded = false, loungeNeeded = false;            // perf: a world on (or about to be on) screen is never frozen
  const FLIGHT = 8200, TOWER_FADE = 1700, CUT = 900;
  const RP = planet.terrain.RP, ORBIT_TARGET = new THREE.Vector3(0, RP * 0.16, 0);
  function orbitPose() {
    const o = planet.state().orbit;
    const position = new THREE.Vector3(Math.cos(o.el) * Math.sin(o.az), Math.sin(o.el), Math.cos(o.el) * Math.cos(o.az)).multiplyScalar(o.dist).add(ORBIT_TARGET);
    return { position, look: ORBIT_TARGET.clone(), up: new THREE.Vector3(0, 1, 0), fov: 40 };
  }
  const SKY_SPOT = () => ({ ...(innerWidth / innerHeight < 1 ? { screen: [0.74, 0.13], dist: 1800 } : { screen: [0.77, 0.25], dist: 1800 }), fish: planet.post.post.uniforms.uFish.value });
  // the stand-in's moons follow her scene clock, its folk her WALK clock (a sum of her per-frame dt, which stops while
  // she is frozen), so the two meet at the cross-fade whatever she did meanwhile (docs/perf.md: plisse-standin syncClock)
  const syncStandin = () => { try { if (standin && pd && pd.isReady()) standin.syncClock(() => pd && pd.sceneTime(), { ms: 2000, walk: () => pd && pd.walkTime() }); } catch (_) {} };
  async function ensureStandin() {
    if (standin) return standin;
    const { createPlisseStandin } = await import('../planet/plisse-standin.js');
    standin = createPlisseStandin(planet, { radius: 86 });
    // world space, not 'flat': the folk adapter (planet/adapter.js isFlat) hides every scene child added after boot
    // from her colour pass unless it is tagged, which is why the stand-in never drew in the game (only in the labs)
    standin.group.userData.planetWorld = true;
    const p = orbitPose(), cam = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.8, 9000);
    cam.position.copy(p.position); cam.up.copy(p.up); cam.lookAt(p.look); cam.updateProjectionMatrix();
    standin.composeFor(cam, SKY_SPOT());
    syncStandin();
    return standin;
  }
  function stageFrame(id, title, z, bg) {
    const el = document.createElement('iframe'); el.id = id; el.className = 'ag-stage-moon'; el.title = title; el.setAttribute('aria-hidden', 'true'); el.tabIndex = -1;
    el.style.zIndex = String(z); el.style.background = bg; el.style.transition = 'none';
    document.body.appendChild(el);
    return el;
  }
  // perf helpers (act3-lab.html's): frozen = throttle(0), awake = throttle(null); only once the world is ready
  let plisseHeld = false, loungeHeld = false;
  const setPlisse = v => { if (!pd || !pd.isReady() || plisseHeld === v) return; plisseHeld = v; try { pd.throttle(v === false ? null : v); } catch (_) {} };
  const setLounge = v => { if (!ld || !ld.isReady() || loungeHeld === v) return; loungeHeld = v; try { ld.throttle(v === false ? null : v); } catch (_) {} };
  const sizePlisse = k => { if (pd && pd.sized !== k) { try { pd.setSize(k); } catch (_) {} } };
  const sizeLounge = k => { if (ld && ld.sized !== k) { try { ld.setSize(k); } catch (_) {} } };
  // Plissé (her page, driven from outside): mounted tiny at boot, frozen once ready unless the voyage needs her
  async function mountPlisse() {
    if (plisseEl) return pd;
    const { createPlisseDriver, registerPlisseOffline } = await import('../voyage/plisse-driver.js');
    if (plisseEl) return pd;
    try { await Promise.race([registerPlisseOffline(plisseSrc, log), sleep(2500)]); } catch (_) {}
    if (plisseEl) return pd;
    plisseEl = stageFrame('ag-plisse', 'Plissé — the lantern planet', 5, '#121834');   // under the UI (z 10)
    pd = createPlisseDriver(plisseEl, { log: (...a) => log('plisse', ...a) });
    pd.setSize(TINY); plisseHeld = false;
    plisseEl.src = plisseSrc;
    const me = pd;
    pd.ready().then(() => {
      if (pd !== me) return;
      try { pd.hideOwnChrome(true); } catch (_) {}
      syncStandin();
      if (!plisseNeeded) setPlisse(0);
    }).catch(e => log('plisse', e.message));
    return pd;
  }
  function unmountPlisse() { if (!plisseEl) return; plisseEl.remove(); plisseEl = null; pd = null; plisseHeld = false; try { standin && standin.syncClock(null); } catch (_) {} }
  // the Alpine lounge (verbatim): mounted tiny at boot (setSize BEFORE src), frozen once settled unless it is needed
  async function mountLounge() {
    if (loungeEl) return ld;
    const { createLoungeDriver } = await import('../voyage/lounge-driver.js');
    if (loungeEl) return ld;
    loungeEl = stageFrame('ag-lounge', 'The shadelings — Alpine lounge', 7, '#2e3a60');
    ld = createLoungeDriver(loungeEl, { log: (...a) => log('lounge', ...a) });
    ld.setSize(TINY); loungeHeld = false;
    loungeReadyAt = 0;
    loungeEl.src = loungeSrc;
    const me = ld;
    ld.ready().then(async () => {
      if (ld !== me) return;
      loungeReadyAt = performance.now();
      try { await ld.hideOwnChrome(true); } catch (_) {}
      // her 1.4 s canvas fade-in needs frames; then she rests (her cost is draw calls: only frozen helps)
      while (ld === me && !loungeSettled()) await sleep(150);
      if (ld === me && !loungeNeeded) { setLounge(0); sizeLounge(TINY); }
    }).catch(e => log('lounge', e.message));
    return ld;
  }
  function unmountLounge() { if (!loungeEl) return; loungeEl.remove(); loungeEl = null; ld = null; loungeHeld = false; }
  const loungeSettled = () => loungeReadyAt > 0 && performance.now() - loungeReadyAt > 1450;
  // the landing bridge (its own r147 scene in a srcdoc iframe), built once; it starts paused after its warm-up
  async function ensureBridge() {
    if (bridge) return bridge;
    if (bridgeP) return bridgeP;
    bridgeP = (async () => {
      const m = await import('../voyage/landing-bridge.js');
      BRIDGE = m.BRIDGE;
      const b = m.createLandingBridge({ container: document.body, zIndex: 6, golden: false, log: (...a) => log('bridge', ...a) });
      await b.ready();
      // perf: a paused bridge draws nothing, but its full-screen frame was still composited at home (opacity 0):
      // it is hidden whenever it is paused, shown again before it plays
      b.el.style.visibility = 'hidden';
      bridge = b; return b;
    })();
    return bridgeP;
  }
  // docs/perf.md §5.1: build early, in calm moments (the title): the bridge, then Plissé, then the lounge, each tiny and
  // frozen until the voyage needs it (each build is a long task on the shared main thread: staggered)
  // Resolves once all three are built and resting (Plissé ready + frozen, the lounge settled + frozen), so the game can
  // hold its boot screen over the builds and the title's orbit plays without a stall.
  // perf: part-way down her descent a program is linked the first time something comes into view (~80 ms: a visible
  // hitch in the one-shot landing). Behind the boot screen her camera is put at a few poses along the way down (the
  // game's own loop paints them), then back on her orbit exactly where it was (no motion at the title).
  async function warmDescent() {
    if (!sw || scene !== 'globe' || planet.state().mode !== 'orbit') return;
    const op = orbitPose(), hp = handoff(), d = descendPose(hp.descend);
    for (const [dist, pitch] of [[520, 1.5], [330, 1.5], [220, 1.35], [d.dist, d.pitch]]) { world.jump({ ...d, dist, pitch }); await frames(2); }
    planet.cameraFree({ position: op.position, look: op.look, up: op.up, fov: 40, snap: true });
    await frames(1);
    world.orbit({ over: geo.centre, spin: true });
    await frames(1);
  }
  let preloaded = null;
  function preload({ gap = 0 } = {}) {
    if (preloaded) return preloaded;
    preloaded = (async () => {
      try { await warmDescent(); } catch (e) { log('warm descent', e.message); }
      try { await ensureBridge(); } catch (e) { log('bridge', e.message); }
      if (gap) await sleep(gap);
      try { await (await mountPlisse()).ready(); } catch (e) { log('plisse', e.message); }
      if (gap) await sleep(gap);
      try { const d = await mountLounge(); await d.ready(); const t0 = performance.now(); while (ld === d && loungeHeld === false && performance.now() - t0 < 6000) await sleep(100); } catch (e) { log('lounge', e.message); }
    })();
    return preloaded;
  }
  const followPlisse = () => { if (pd && pd.isReady() && bridge) { try { bridge.syncClock({ sceneTime: pd.sceneTime(), walkTime: pd.walkTime() }); } catch (_) {} } };
  // fly her free camera along a path for ms, s from a to b. The path never grazes the Earth: a soft floor keeps the
  // camera >= SAFE from her centre (zero effect at s = 0, so it starts exactly on the live camera / ends on orbitPose),
  // and her Grain finish is held (no altitude paint blend flashing on mid-flight).
  const SAFE = RP * 3.3, SOFT = 110;
  function clearEarth(pos, s) {
    const L = pos.length(), w = smooth(0, 0.12, s);
    if (!w || L > SAFE + 8 * SOFT) return pos;
    const Ls = 0.5 * (L + SAFE + Math.sqrt((L - SAFE) * (L - SAFE) + SOFT * SOFT));
    return pos.multiplyScalar((L + (Ls - L) * w) / Math.max(L, 1e-3));
  }
  function flyPath(path, ms, a = 0, b = 1, onStep = null) {
    cancelAnimationFrame(flightRaf); cancelAnimationFrame(lensRaf);
    planet.setBlend(0);   // = autoBlend off at her orbit value; the caller restores autoBlend
    return new Promise(resolve => {
      const t0 = performance.now();
      const step = now => {
        const u = Math.min(1, (now - t0) / ms), s = a + (b - a) * u;
        setLens(smooth(0.55, 0.92, s));
        const pose = path.at(s);
        planet.cameraFree({ position: clearEarth(pose.position, s), look: pose.look, up: pose.up, fov: 40, snap: true });
        if (onStep) { try { onStep(s, u); } catch (_) {} }
        if (u >= 1) return resolve(true);
        flightRaf = requestAnimationFrame(step);
      };
      flightRaf = requestAnimationFrame(step);
    });
  }
  // wait for her orbit camera to come to rest after world.orbit() (it eases in), min..max ms
  async function settleOrbit(min = 1800, max = 4200) {
    const t0 = performance.now(), cam = planet.camera, prev = cam.position.clone();
    await sleep(min);
    while (performance.now() - t0 < max) { prev.copy(cam.position); await sleep(150); if (cam.position.distanceTo(prev) < 3) break; }
  }
  const matched = () => standin.arrivalPose(pd && pd.isReady() ? pd.cameraNow() : null, { fish: planet.post.post.uniforms.uFish.value });
  let act3 = 'earth';     // earth | plisse | lounge (where the voyage stands; scene is 'moon' from Plissé on)
  // the step a move is in (tests / perf phases): lift | rise | flight | fade | approach | dive | lounge | rising | leaving | return | descent | handoff | null
  let step = null;
  const at = s => { step = s; };
  async function goMoon() {
    if (scene === 'moon') return ld || pd;
    if (flying) return null;
    flying = true;
    try {
      await ensureStandin();
      const bridgePre = ensureBridge().catch(e => { log('bridge', e.message); return null; });
      if (agents) { try { agents.showPins(false); } catch (_) {} }
      // 1. rise to her orbit, fly to the stand-in, cross-fade into Plissé (plisse-lab's)
      // Sueda: 'I don't see the planet from afar and I don't see us getting closer'. Plissé is put in the sky of the orbit
      // pose we are rising to, so it hangs there (upper right) as we rise; once the camera rests, a beat to look at it.
      const rising = scene !== 'globe' || surface === 'sea';
      let lifted = false;
      if (rising) {
        setScene('globe');
        if (surface === 'sea') { at('lift'); lifted = await lift(); easeLens(0, 1800); }
        at('rise');
        world.rig.enabled = false; world.orbit({ over: geo.centre, spin: false });
      }
      planet.orbitSpin(false);
      { const op = orbitPose(), oc = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.8, 9000); oc.position.copy(op.position); oc.up.copy(op.up); oc.lookAt(op.look); oc.updateProjectionMatrix(); standin.composeFor(oc, SKY_SPOT()); }
      plisseNeeded = true;
      const pdP = mountPlisse();                               // mounted at boot (tiny, frozen): a no-op then
      await settleOrbit(lifted ? 400 : rising ? 2200 : 600);   // lift() ends at rest on this orbit
      const live = planet.camera; live.updateMatrixWorld();
      { const v = standin.position.clone().project(live); if (Math.abs(v.x) > 0.85 || Math.abs(v.y) > 0.85 || v.z > 1) standin.composeFor(live, SKY_SPOT()); }   // not in frame (a different orbit): put it there
      await sleep(1600);   // the beat: Plissé hanging in our sky before we go
      const fwd = new THREE.Vector3(); live.getWorldDirection(fwd);
      const fromPose = { position: live.position.clone(), look: live.position.clone().addScaledVector(fwd, 400), up: live.up.clone(), fov: live.fov };
      // turn to it first, come straight in, and swing round to plisse.html's view only once we are near it
      const path = standin.flight({ from: fromPose, to: matched, turn: 0.26, swing: [0.4, 0.96] });
      // perf §5.2: awake (her clocks exact, the stand-in follows them) and tiny; full size 2.2 s before the fade
      at('flight');
      await flyPath(path, FLIGHT, 0, 1, s => { setPlisse(false); if (s >= PLISSE_GROW) sizePlisse(1); });
      setPlisse(false); sizePlisse(1);
      await Promise.race([pdP.then(d => d.ready({ settled: true })), sleep(45000)]);
      fading = true; at('fade');
      await fade(plisseEl, 0, 1, TOWER_FADE, () => { const pose = matched(); planet.cameraFree({ position: pose.position, look: pose.look, up: pose.up, fov: 40, snap: true }); });
      fading = false; act3 = 'plisse'; setScene('moon');
      try { game.setScene('moon'); } catch (_) {}
      try { plisseEl.blur(); window.focus(); } catch (_) {}
      // 2. her camera eases to its closest view on the dusk ring
      const b = await bridgePre;
      if (!b) { log('act 3: no landing bridge; staying on Plissé'); return pd; }
      at('approach');
      await pd.approach(BRIDGE.ring, { turnMs: 1000, pinchMs: 2100, rest: 0 });
      // 3. the dive: Plissé -> the bridge (matched pose); the lounge waits (mounted at boot) tiny and frozen
      mountLounge();
      at('dive');
      b.setGolden(!!(ld && ld.isReady() && ld.state().goldenHour)); b.hold(null); b.el.style.visibility = ''; b.pause(false);   // she is kept between voyages: her evening stays
      followPlisse();
      const c = pd.cameraNow();
      b.start({ theta: c.theta, phi: c.phi, radius: c.radius });
      const diveDone = b.play(1);
      await fade(b.el, 0, 1, CUT, followPlisse);
      // perf §5.3: she is KEPT at her ring pose (the way home starts there, no reload): frozen, unseen, tiny
      plisseNeeded = false; setPlisse(0); plisseEl.style.opacity = '0'; sizePlisse(TINY);
      // perf §5.4: the lounge wakes at full size 2.2 s before cut 2
      await new Promise(res => {
        const f = () => {
          const t = b.state().t;
          if (t >= BRIDGE.T - LOUNGE_WAKE && ld) { loungeNeeded = true; sizeLounge(1); setLounge(false); }
          if (t >= BRIDGE.T - 0.45 && loungeSettled()) res(); else requestAnimationFrame(f);
        };
        f();
      });
      loungeNeeded = true; sizeLounge(1); setLounge(false);
      // 4. the bridge -> the lounge (matched end frame)
      await fade(loungeEl, 0, 1, CUT);
      loungeEl.classList.add('is-on'); loungeEl.style.pointerEvents = 'auto';
      await diveDone.catch(() => {});
      b.pause(true); b.el.style.visibility = 'hidden';
      act3 = 'lounge';
      try { loungeEl.blur(); window.focus(); } catch (_) {}
      return ld;
    } finally { flying = false; step = null; }
  }
  async function goHome() {
    if (scene !== 'moon') return homeFromGlobe();
    if (flying) return false;
    flying = true;
    try {
      // lounge -> the bridge rising -> Plissé
      if (act3 === 'lounge' && bridge && ld) {
        at('rising');
        plisseNeeded = true;
        const pdP = mountPlisse();                             // she waited frozen at her ring pose (a no-op then)
        setPlisse(false);                                      // perf §5.5: awake, tiny (her gestures and clocks run for the bridge's copies)
        const ls = ld.state();
        try { if (ls.camera && ld.camera && (Math.abs(ls.camera.theta - ld.camera.home.theta) > 1e-3 || Math.abs(ls.camera.phi - ld.camera.home.phi) > 1e-3 || Math.abs(ls.camera.radius - ld.camera.home.radius) > 1e-3)) await ld.lookHome({ ms: 900, settle: 900 }); } catch (_) {}
        bridge.setGolden(!!ls.goldenHour); bridge.hold(null); bridge.el.style.visibility = ''; bridge.pause(false);
        bridge.start(BRIDGE.ring);
        let approached = null;
        pdP.then(d => d.ready()).then(() => { setPlisse(false); followPlisse(); bridge.start(BRIDGE.ring); approached = pd.approach(BRIDGE.ring, { turnMs: 900, pinchMs: 1800, rest: 0 }); }).catch(e => log('plisse', e.message));
        const done = bridge.play(-1);
        // her frame grows 2.2 s before the bridge uncovers her (the first full-size frame is the heavy one, hidden)
        let growing = true;
        (function grow() { if (!growing) return; if (bridge.state().t <= GROW) sizePlisse(1); else requestAnimationFrame(grow); })();
        loungeEl.classList.remove('is-on'); loungeEl.style.pointerEvents = 'none';
        await fade(loungeEl, 1, 0, CUT);
        // perf: she is KEPT (frozen, tiny, unseen) for the next voyage: no reload, no build stall at home or at departure
        loungeNeeded = false; setLounge(0); sizeLounge(TINY);
        await done.catch(() => {});
        growing = false;
        const t0 = performance.now(); while (!approached && performance.now() - t0 < 45000) await sleep(30);
        if (approached) await approached;
        try { await pd.ready({ settled: true }); } catch (_) {}
        setPlisse(false); sizePlisse(1);
        await sleep(50);                                       // two frames at full size before she is uncovered
        plisseEl.style.opacity = '1';
        await fade(bridge.el, 1, 0, CUT, followPlisse);
        bridge.pause(true); bridge.el.style.visibility = 'hidden';
        act3 = 'plisse';
      }
      // Plissé -> lift off (her opening framing) -> the flight back to Earth orbit
      if (pd) {
        at('leaving');
        plisseNeeded = true; setPlisse(false); sizePlisse(1);
        if (!ARRIVAL) { const m = await import('../voyage/plisse-driver.js'); ARRIVAL = m.ARRIVAL; }
        try { await pd.pinch(ARRIVAL.radius, { ms: 1800 }); await pd.turn({ theta: ARRIVAL.theta, phi: ARRIVAL.phi }, { ms: 700 }); } catch (e) { log('plisse lift', e.message); }
      }
      fading = true;
      await fade(plisseEl, 1, 0, 1300, () => { const pose = matched(); planet.cameraFree({ position: pose.position, look: pose.look, up: pose.up, fov: 40, snap: true }); });
      const lock = matched();
      fading = false; setScene('globe'); act3 = 'earth';
      try { game.setScene('earth'); } catch (_) {}
      // perf: she is KEPT too, frozen and tiny at her opening framing (where a fresh load starts): the next voyage needs no reload
      plisseNeeded = false; setPlisse(0); sizePlisse(TINY);
      at('return');
      const path = standin.flight({ from: orbitPose(), to: lock });
      await flyPath(path, FLIGHT * 0.85, 1, 0);
      setLens(0); planet.autoBlend(true);
      world.orbit({ over: geo.centre, spin: false });
      await sleep(600);
    } finally { flying = false; step = null; }
    await homeFromGlobe();
    if (agents) { try { agents.showPins(true); } catch (_) {} }
    return true;
  }

  // the paper veil: a soft wash for cuts that have no camera continuity
  async function veilFlash(ms = 700) { veil.classList.add('is-on'); await sleep(ms); veil.classList.remove('is-on'); }

  const api = {
    get scene() { return scene; }, get fading() { return fading; }, get flying() { return flying; },
    // her planet's canvas is drawn while it is the ground or fading (never on Plissé, except across the cuts)
    get paintPlanet() { return planetOn && (scene !== 'moon' || fading); },
    // the seaside map's canvas: from the hand-off until we go up again
    get paintSea() { return seaOn; },
    get paintWorld() { return sw ? seaOn || (planetOn && (scene !== 'moon' || fading)) : scene !== 'moon' || fading; },
    get surface() { return surface; }, get sea() { return sea; }, get step() { return step; },
    get globe() { return null; }, get planet() { return planet; }, get driver() { return ld; }, get plisse() { return pd; }, get iframe() { return loungeEl || plisseEl; }, get standin() { return standin; }, get bridge() { return bridge; }, get act3() { return act3; },
    get held() { return { plisse: pd ? (plisseHeld === false ? 'awake' : 'frozen') : null, plisseSize: pd ? pd.sized : null, lounge: ld ? (loungeHeld === false ? 'awake' : 'frozen') : null, loungeSize: ld ? ld.sized : null, bridge: bridge ? bridge.state().paused : null }; },
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    introGlobe, diveHome, skipDive, showGlobe, visitNation, homeFromGlobe, goMoon, goHome, ensureStandin, ensureBridge, preload, land, lift, veilFlash,
    beforeFrame, afterFrame, get clouds() { return clouds; }, get cloudDebug() { return { which: cloudCam, pos: lc.position.toArray().map(v => +v.toFixed(2)), H: clouds && clouds.H, W: clouds && cloudCam ? +clouds.cover(lc.position.y).toFixed(3) : 0, sea: sw && sw.rig.pose(), planetMode: planet.state().mode, alt: +planet.state().altitude.toFixed(1) }; }, get handoffMove() { return move ? { kind: move.kind, phase: move.phase } : null; },
    syncGrowth() {},                 // the old globe mirrored the buildings
    dispose() { cancelAnimationFrame(flightRaf); cancelAnimationFrame(lensRaf); unmountPlisse(); unmountLounge(); bridge && bridge.destroy(); veil.remove(); standin && standin.dispose(); }
  };
  return api;
}
