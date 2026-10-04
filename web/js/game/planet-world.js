// The world facade: the game's `world` object (what creation.js, input.js, opening.js, marks, agents, desk and the
// director call) implemented over Sueda's Tower Planet (web/js/planet: createPlanet + home.js geography + the
// surface adapter). ART_DIRECTION §12: the game lives on her surface; the sim, placement and marks stay in the flat
// design space, this maps them. Her look code is never touched: everything here goes through the adapter, her
// cameraLocal / descendTo / orbit, and planet.surface.
//
//   const world = createPlanetWorld({ planet, geo, adapter, ctx, game, fine, log });
//   world.update(dt)                      // every frame BEFORE planet.frame: the leader camera (RTS-ish, §1 / task §4)
//   world.groundY / isWater / inPlot / pick / project / nation / lake
//   world.place(obj, building) / attach(obj) / placeFill(group) / adoptMarks(marks)
//   world.focus / home / upClose / back / descent / orbit / jump   world.rig { mode, enabled, goal, pose(), setPose(), stop(), wasDrag(), busy, view }
//
// Camera (task §4): the leader view is a low-ish oblique over the plot (LEADER: ~53 degrees, 95 m); right-drag pans,
// the wheel zooms 15-150 m (the pitch eases a little lower as you come close), Q / E turn, WASD / arrows pan,
// Shift / Alt + right-drag turns and tilts; the target is clamped to the home region (the fine ground patch). Left is
// the pencil's (marks). Scripted moves (focus, home, up close) are eased tweens; the descent and the visits are her
// descendTo; "show the globe" is her orbit. The camera is placed EVERY frame (§19: no held-frame judder).

import { PLOT } from '../planet/home.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const wrapA = a => Math.atan2(Math.sin(a), Math.cos(a));
const EASE = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

export const LEADER = { dist: 64, pitch: 0.95, yaw: -0.35, fov: 50 };     // polish: 64 m (was 75): the folk read ~17 % bigger, still the plot + lake + coast in frame;     // §15: oblique ~53 degrees, framing the plot (60 x 56 m) at ~60 m up, inside her clear-daylight band
export const ZOOM = { min: 15, max: 150 };
export const REGION = 64;                                                   // the leader target stays within this of the plot centre
export const pitchForDist = d => 0.6 + 0.33 * smooth(15, 110, d);           // closer = a little lower, so the folk read

export function createPlanetWorld({ planet, geo, adapter, ctx = null, game, fine = null, log = () => {} } = {}) {
  const dom = planet.renderer.domElement;
  const centre = geo.centre || { x: 0, z: 2 };
  const groundY = fine ? (x, z) => fine.groundY(x, z) : (x, z) => adapter.groundY(x, z);
  const surfaceY = (x, z) => { const w = geo.waterLevel(x, z), g = groundY(x, z); return w == null ? g : Math.max(w, g); };

  /* ================= the camera ================= */
  const view = { tx: centre.x, ty: 0, tz: centre.z, yaw: LEADER.yaw, pitch: LEADER.pitch, dist: LEADER.dist, fov: LEADER.fov };
  const cur = { ...view }, goal = { ...view };
  const KEYS = ['tx', 'tz', 'yaw', 'pitch', 'dist', 'fov'];
  let mode = 'map';            // 'map' | 'close' | 'orbit' | 'flight'
  let tween = null, saved = null, enabled = true, lastDrag = false, drag = null, placed = false;
  const held = new Set();
  const LIM = { pitch: [0.28, 1.5] };

  const clampTarget = p => {
    p.tx = clamp(p.tx, centre.x - REGION, centre.x + REGION);
    p.tz = clamp(p.tz, centre.z - REGION, centre.z + REGION);
    p.dist = clamp(p.dist, ZOOM.min, ZOOM.max);
    p.pitch = clamp(p.pitch, LIM.pitch[0], LIM.pitch[1]);
    return p;
  };
  function endTween(ok = false) { if (!tween) return; const t = tween; tween = null; Object.assign(goal, ok ? t.to : cur); t.resolve(ok); }
  function startTween(to, { ms = 1600, curve = EASE, interruptible = true } = {}) {
    endTween(false);
    const target = { ...goal, ...to };
    // scripted moves may come closer than the wheel's limit (the fleet visits at 8-12 m, the ceremony at 10 m)
    if (mode === 'map') { const d = target.dist; clampTarget(target); target.dist = clamp(d, 6, 400); }
    target.yaw = cur.yaw + wrapA(target.yaw - cur.yaw);
    if (ctx && ctx.reduceMotion) ms = Math.min(ms, 400);
    return new Promise(resolve => { tween = { from: { ...cur }, to: target, t0: performance.now(), ms: Math.max(1, ms), curve, interruptible, resolve }; });
  }
  function placeCamera() {
    cur.ty = Math.max(0, surfaceY(cur.tx, cur.tz));
    adapter.cameraLocal({ x: cur.tx, z: cur.tz, dist: cur.dist, pitch: cur.pitch, yaw: cur.yaw, fov: cur.fov, snap: true });
    placed = true;
  }
  const typing = () => { const t = document.activeElement; return !!(t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)); };
  function keys(dt) {
    if (!enabled || !held.size || tween) return;
    const turn = (held.has('q') ? 1 : 0) - (held.has('e') ? 1 : 0);
    if (turn) goal.yaw += turn * 1.3 * dt;
    const tilt = (held.has('r') ? 1 : 0) - (held.has('f') ? 1 : 0);
    if (tilt) goal.pitch = clamp(goal.pitch + tilt * 0.8 * dt, LIM.pitch[0], LIM.pitch[1]);
    const mx = (held.has('d') || held.has('arrowright') ? 1 : 0) - (held.has('a') || held.has('arrowleft') ? 1 : 0);
    const mz = (held.has('s') || held.has('arrowdown') ? 1 : 0) - (held.has('w') || held.has('arrowup') ? 1 : 0);
    if (mx || mz) {
      const v = goal.dist * 0.6 * dt, s = Math.sin(goal.yaw), c = Math.cos(goal.yaw);
      goal.tx += mx * v * c - mz * v * s; goal.tz += -mx * v * s - mz * v * c;   // screen right = (c, -s), screen up = (-s, -c)
      clampTarget(goal);
    }
    if (held.has('=') || held.has('+')) goal.dist = clamp(goal.dist * Math.exp(-dt * 1.2), ZOOM.min, ZOOM.max);
    if (held.has('-')) goal.dist = clamp(goal.dist * Math.exp(dt * 1.2), ZOOM.min, ZOOM.max);
  }
  // every frame, before planet.frame: the camera moves every frame (§19)
  function update(dt) {
    if (mode === 'orbit' || mode === 'flight' || mode === 'free') return false;
    if (tween) {
      const s = clamp((performance.now() - tween.t0) / tween.ms, 0, 1), e = tween.curve(s);
      for (const k of KEYS) cur[k] = tween.from[k] + (tween.to[k] - tween.from[k]) * e;
      if (s >= 1) endTween(true);
    } else {
      keys(dt);
      const a = 1 - Math.exp(-dt * 9);
      for (const k of KEYS) cur[k] += (k === 'yaw' ? wrapA(goal[k] - cur[k]) : goal[k] - cur[k]) * a;
    }
    placeCamera();
    return !!tween;
  }

  /* ---- input: right / middle drag pans (Shift / Alt: turns + tilts), the wheel zooms, Q / E turn; left is the pencil's ---- */
  const modDown = e => e.shiftKey || e.altKey;
  dom.addEventListener('contextmenu', e => e.preventDefault());
  dom.addEventListener('pointerdown', e => {
    if (!enabled || (mode !== 'map' && mode !== 'close')) return;
    if (e.button !== 2 && e.button !== 1) return;
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, moved: false, act: modDown(e) ? 'rotate' : 'pan' };
    if (e.button === 1) e.preventDefault();
  });
  addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.id || !enabled) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY;
    if (!drag.moved && Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < 4) return;
    if (!drag.moved) { drag.moved = true; try { dom.setPointerCapture(drag.id); } catch (_) {} dom.style.cursor = drag.act === 'pan' ? 'grabbing' : 'move'; }
    if (tween && tween.interruptible) endTween(false);
    if (tween) return;
    if (drag.act === 'rotate') { goal.yaw -= dx * 0.005; goal.pitch = clamp(goal.pitch + dy * 0.004, LIM.pitch[0], LIM.pitch[1]); return; }
    if (mode !== 'map') return;
    // the ground follows the pointer: metres per pixel at the target, foreshortened along the view
    const h = dom.clientHeight || innerHeight;
    const k = goal.dist * 2 * Math.tan(THREE.MathUtils.degToRad(goal.fov) / 2) / h, kv = k / Math.max(0.35, Math.sin(goal.pitch));
    const s = Math.sin(goal.yaw), c = Math.cos(goal.yaw);
    goal.tx += -dx * k * c - dy * kv * s;
    goal.tz += dx * k * s - dy * kv * c;
    clampTarget(goal);
  }, { capture: true });
  // wasDrag() answers for THIS pointer-up: a left click after an earlier right-drag pan is not a drag (it used to keep
  // the last right-drag's `moved` forever, so every folk click after a pan was swallowed: the minister click, §20)
  const endDrag = () => { lastDrag = !!(drag && drag.moved); if (drag) dom.style.cursor = ''; drag = null; };
  addEventListener('pointerup', endDrag, { capture: true });
  addEventListener('pointercancel', endDrag, { capture: true });
  dom.addEventListener('wheel', e => {
    if (!enabled || mode !== 'map') return;
    e.preventDefault();
    if (tween && tween.interruptible) endTween(false);
    if (tween) return;
    const d0 = goal.dist, d1 = clamp(d0 * Math.exp(e.deltaY * (e.deltaMode === 1 ? 30 : 1) * 0.0012), ZOOM.min, ZOOM.max);
    goal.dist = d1;
    goal.pitch = clamp(goal.pitch + pitchForDist(d1) - pitchForDist(d0), LIM.pitch[0], LIM.pitch[1]);
  }, { passive: false });
  addEventListener('keydown', e => { if (!typing() && !e.metaKey && !e.ctrlKey) held.add(e.key.toLowerCase()); });
  addEventListener('keyup', e => held.delete(e.key.toLowerCase()));
  addEventListener('blur', () => held.clear());

  /* ---- scripted moves ---- */
  const homePose = () => ({ ...view, tx: centre.x, tz: centre.z });
  function focus(x, z, { dist = goal.dist, pitch = goal.pitch, yaw = goal.yaw, ms = 1600, fov = goal.fov } = {}) {
    if (mode === 'orbit' || mode === 'flight') return Promise.resolve(false);
    return startTween({ tx: x, tz: z, dist, pitch, yaw, fov }, { ms });
  }
  function home({ ms = 2600 } = {}) {
    if (mode === 'orbit' || mode === 'flight') return Promise.resolve(false);
    mode = 'map'; saved = null;
    return startTween(homePose(), { ms, interruptible: false });
  }
  function upClose(at = {}, { r = 10, pitch = 0.22, ms = 1800 } = {}) {
    if (mode === 'orbit' || mode === 'flight') return Promise.resolve(false);
    if (mode !== 'close') saved = { ...goal };
    mode = 'close';
    const x = at.x ?? centre.x, z = at.z ?? centre.z;
    return startTween({ tx: x, tz: z, dist: r, pitch, yaw: goal.yaw }, { ms, interruptible: false });
  }
  function back({ ms = 1600 } = {}) {
    if (mode !== 'close') return Promise.resolve(false);
    mode = 'map';
    const to = saved || homePose(); saved = null;
    return startTween(to, { ms, interruptible: false });
  }
  // snap the leader camera to a pose (tx, tz, yaw, pitch, dist, fov) with no motion
  function jump(pose = {}) {
    endTween(false);
    Object.assign(cur, pose); Object.assign(goal, pose);
    if (mode !== 'close') mode = 'map';
    placeCamera();
  }
  // her descendTo: from wherever the camera is (orbit, another place) down to a leader pose. Resolves true when it
  // lands (false if cancelled); the leader camera then carries on from exactly that pose.
  let flight = null;
  async function descent({ to = homePose(), ms = 6500, from = null } = {}) {
    endTween(false);
    const pose = { ...homePose(), ...to };
    mode = 'flight'; flight = pose;
    if (from === 'sky') { planet.cameraLocal({ ...adapterLocal(pose), dist: 700, pitch: 1.5, snap: true }); }
    let ok = false;
    try { ok = await adapter.descendTo({ x: pose.tx, z: pose.tz, dist: pose.dist, pitch: pose.pitch, yaw: pose.yaw, fov: pose.fov, ms }); } catch (e) { log('descent', e.message); }
    if (flight !== pose) return false;          // superseded by another move
    flight = null; mode = 'map';
    Object.assign(cur, pose); Object.assign(goal, pose);
    if (!ok) placeCamera();
    return ok;
  }
  const adapterLocal = p => { const q = adapter.toPlanet(p.tx, p.tz, {}); return { fx: q.fx, fz: q.fz, yaw: adapter.yawToPlanet(p.yaw), fov: p.fov }; };
  // her orbit, turned to face the point we leave (so the rise is straight up), spinning after that
  function orbit({ over = null, spin = true } = {}) {
    endTween(false); flight = null;
    const p = over || { x: cur.tx, z: cur.tz };
    const w = adapter.toWorld(p.x, 0, p.z), RP = planet.terrain.RP, t = new THREE.Vector3(0, RP * 0.16, 0);
    const d = w.clone().sub(t).normalize();
    planet.setOrbit({ az: Math.atan2(d.x, d.z), el: clamp(Math.asin(d.y), -1.25, 1.35) });
    planet.orbit(); planet.orbitSpin(!!spin);
    mode = 'orbit';
  }
  function stop() { endTween(false); if (mode === 'flight') { flight = null; mode = 'map'; placeCamera(); } }
  // her camera is driven from outside (stages.js: the rise out of the cloud, planet.cameraFree) until orbit / descent / jump
  function free() { endTween(false); flight = null; mode = 'free'; }

  /* ================= the ground, picking, places ================= */
  const pick = (cx, cy) => { const p = adapter.pick(cx, cy); if (!p) return null; return { x: p.x, z: p.z, y: p.y, water: p.water, onWater: p.onWater, inPlot: p.inPlot, fx: p.fx, fz: p.fz, world: p.world }; };
  const project = (x, y, z) => adapter.toScreen(x, y == null ? groundY(x, z) : y, z);
  const nation = id => geo.placeById(id);
  const lake = geo.lake ? { centre: { x: (geo.lake.box.x0 + geo.lake.box.x1) / 2, z: (geo.lake.box.z0 + geo.lake.box.z1) / 2 }, level: geo.lake.level, poly: geo.lake.poly } : null;
  const waterY = (x, z) => { const w = geo.waterLevel(x, z); return w == null ? groundY(x, z) : w; };

  /* ================= standing things on the surface ================= */
  // the lowest ground under a footprint (no corner floats), like adapter.place but with the fine ground
  function padY(x, z, fp, rot = 0) {
    if (!fp) return groundY(x, z);
    const hw = fp.w / 2, hd = fp.d / 2, c = Math.cos(rot), s = Math.sin(rot);
    let lo = Infinity;
    for (const [u, v] of [[0, 0], [-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd], [0, -hd], [0, hd], [-hw, 0], [hw, 0]]) lo = Math.min(lo, groundY(x + c * u + s * v, z - s * u + c * v));
    return lo;
  }
  // a building (the sim record: x, z, rot, footprint, floating) on the surface: the object's own rotation.y is kept
  function place(obj, b, { y = null, parent = planet.surface } = {}) {
    const x = b.x, z = b.z;
    if (obj.userData.agoraRot === undefined) obj.userData.agoraRot = obj.rotation.y || 0;
    const rot = obj.userData.agoraRot;
    const fp = b.footprint || (obj.userData.agora && obj.userData.agora.size) || null;
    const yy = y != null ? y : b.floating ? waterY(x, z) : padY(x, z, fp, (b.rot || 0));
    adapter.place(obj, x, z, { rot, y: yy, parent });
    return yy;
  }
  // an object already transformed in world space (a site copied from its building): just hang it on the surface
  function attach(obj) { obj.userData.planetWorld = true; if (obj.parent !== planet.surface) planet.surface.add(obj); return obj; }
  // a filler group (fill.js: positioned at the mark's centroid, children in flat metres): stood on the surface and
  // its geometry curved onto the sphere, so a 20 m field lies on the ground to its corners
  const wrapped = new WeakSet();
  const _m = new THREE.Matrix4(), _mi = new THREE.Matrix4(), _inv = new THREE.Matrix4(), _v = new THREE.Vector3(), _w = new THREE.Vector3();
  function placeFill(g) {
    const cx = g.position.x, cz = g.position.z, base = g.position.y;
    adapter.place(g, cx, cz, { rot: g.rotation.y || 0, y: base });
    wrapGroup(g, cx, base, cz);
    return g;
  }
  function wrapGroup(g, cx, base, cz) {
    g.updateMatrixWorld(true);
    _inv.copy(g.matrixWorld).invert();
    g.traverse(o => {
      if (!o.isMesh || !o.geometry || !o.geometry.attributes.position) return;
      _m.copy(_inv).multiply(o.matrixWorld);          // mesh local -> group local (flat metres about the centroid)
      _mi.copy(_m).invert();
      const curve = v => {   // group-local flat -> curved group-local
        adapter.toWorld(cx + v.x, base + v.y, cz + v.z, _w);
        return v.copy(_w).applyMatrix4(_inv);
      };
      if (o.isInstancedMesh) {
        if (wrapped.has(o.instanceMatrix)) return; wrapped.add(o.instanceMatrix);
        const im = o.instanceMatrix, M = new THREE.Matrix4();
        for (let i = 0; i < o.count; i++) {
          M.fromArray(im.array, i * 16);
          _v.setFromMatrixPosition(M).applyMatrix4(_m); curve(_v).applyMatrix4(_mi);
          M.setPosition(_v); M.toArray(im.array, i * 16);
        }
        im.needsUpdate = true;
        return;
      }
      const geo = o.geometry;
      if (wrapped.has(geo)) return; wrapped.add(geo);
      const p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) {
        _v.fromBufferAttribute(p, i).applyMatrix4(_m); curve(_v).applyMatrix4(_mi);
        p.setXYZ(i, _v.x, _v.y, _v.z);
      }
      p.needsUpdate = true; geo.computeBoundingSphere(); if (geo.boundingBox) geo.computeBoundingBox();
    });
  }
  // the marks module draws flat ribbons (x, groundY, z) on FACE_LAYER under its root: hang the root on the surface
  // and curve every ribbon it adds (positions through the map, directions through the local frame)
  function adoptMarks(marks) {
    const root = marks.root; if (!root) return;
    root.userData.planetWorld = true; planet.surface.add(root);
    const add = root.add.bind(root), _q = new THREE.Quaternion(), _d = new THREE.Vector3();
    root.add = function (obj) {
      obj.traverse(o => {
        if (!o.isMesh || !o.geometry || o.geometry.userData.wrapped) return;
        const g = o.geometry, p = g.attributes.position, dir = g.attributes.aDir;
        for (let i = 0; i < p.count; i++) {
          const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
          if (dir) { const f = adapter.frame(x, z, { y: 0 }); _q.copy(f.quaternion); _d.set(dir.getX(i), dir.getY(i), dir.getZ(i)).applyQuaternion(_q); dir.setXYZ(i, _d.x, _d.y, _d.z); }
          adapter.toWorld(x, y, z, _w); p.setXYZ(i, _w.x, _w.y, _w.z);
        }
        p.needsUpdate = true; if (dir) dir.needsUpdate = true; g.computeBoundingSphere(); g.userData.wrapped = true;
        o.userData.planetWorld = true;
      });
      return add(obj);
    };
  }

  /* ================= the nations' towns (planet/towns.js: their prefab towns, merged, with a few of their folk) ================= */
  // built once the Build API and the folk exist (game.js, after lib.load); each nation's visit camera (n.view) is set
  // to frame its town. The towns are her surface's: they stand under planet.surface, curved onto the sphere.
  let towns = null, townsP = null;
  function buildTowns({ api, folk = null } = {}) {
    if (townsP) return townsP;
    townsP = import('../planet/towns.js').then(async ({ createTowns }) => {
      towns = createTowns({ planet, geo, adapter, ctx, api, folk, groundY, log });
      await towns.build();
      return towns;
    }).catch(e => { log('towns', e.message); console.error('[towns]', e); return null; });
    return townsP;
  }

  /* ================= the rig (the old camera rig's vocabulary, for input.js / opening.js / desk.js / look-lab) ================= */
  const rig = {
    get mode() { return mode === 'close' ? 'close' : mode === 'map' ? 'map' : mode; },
    get enabled() { return enabled; }, set enabled(v) { enabled = !!v; if (!v) { drag = null; held.clear(); } },
    get busy() { return !!tween || mode === 'flight'; }, get dragging() { return !!(drag && drag.moved); },
    wasDrag: () => lastDrag, goal, cur, view,
    pose: () => ({ ...cur }), setPose: p => jump(p), stop,
    eyeOf: () => planet.camera.position.clone()
  };

  const world = {
    planet, geo, adapter, fine, rig, ctx, lake,
    get ready() { return planet.ready; },
    get mode() { return mode; }, get flight() { return flight; },
    // ground
    groundY, surfaceY, waterY, isWater: (x, z) => geo.isWater(x, z), waterAt: (x, z) => geo.waterKind(x, z), inPlot: (x, z) => geo.inPlot(x, z),
    siteY: b => (b && b.floating ? waterY(b.x, b.z) : padY(b.x, b.z, b && b.footprint, (b && b.rot) || 0)),
    pick, project, nation, places: geo.places,
    // the old world's growth hooks: no bloom, no levelling on the planet (Sueda §9: build exactly what's asked)
    levelBuilding: () => null, bloomBuilding: () => null, bloom: () => null, plant: () => null,
    // standing things
    place, attach, placeFill, wrapGroup, adoptMarks, padY,
    // camera
    update, focus, home, upClose, back, descent, orbit, jump, stop, free, homePose,
    buildTowns, get towns() { return towns; },
    showNeighbour: (id, o = {}) => { const n = nation(id); if (!n) return Promise.resolve(false); return focus(n.x, n.z, { dist: o.dist || 90, pitch: 0.9, ms: o.ms || 2600 }); },
    lookToward: (x, z, o = {}) => focus(x, z, o),
    // frame hooks the old loop called (no-ops now: planet.frame draws, the camera is placed in update)
    beforeDraw: () => {}, markDirty: () => {},
    dispose() { endTween(false); }
  };
  // the first placement: the leader view over home
  placeCamera();
  return world;
}
