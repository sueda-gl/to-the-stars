// "Peek at a developed civilisation" (Sueda, 2026-10-04 pm): at the end of the onboarding the jury can toggle from her
// early game into the city she has not built yet — the trailer's developed city (t6-city.js: the whimsy quarters, the
// civic hall, the opera, the university, the power station and works, the harbour, the rocket on its sea pad, the
// fields outside) standing in the LIVE game on the same seaside map, with its folk walking the streets and the floaties
// flying, a cabinet of five ministers, a Republic's reward tally and a mailbox of this stage's letters (sim/future-state.js).
// Then back to today: her real early game exactly as she left it.
//
//   const future = createFuture({ game, ctx, kit, world, folk, agents, ui, rewards, painter, canvas, mailDots, marks, desk,
//                                 commands, creation, stages, ministry, onboarding, log })
//   future.prepare()        builds the city, the crowd and the batches lazily in ~6 ms slices (auto from the onboarding's
//                           'mark' step on, or when no onboarding runs); -> Promise. future.ready flips when it is done.
//   await future.enter()    snapshot + the painted wipe into the developed city (resolves when the wipe is done)
//   await future.exit()     the painted wipe back; the snapshot restored (letters, notes, tally, camera, folk, buildings, marks)
//   future.toggle()         · future.active · future.busy · future.ready · future.progress (0..1 of the prebuild)
//   future.update(dt, t)    game.js calls it every frame (the crowd, smoke, boats, sails; the prebuild trigger)
//   future.command(text)    while active every command / letter reply lands here (nothing reaches the real game)
//   future.state            the future's data (makeFutureState) while active · future.stats (timings) · future.lastCheck
//
// While active the real game is PAUSED (game.js: no game.tick, no feedHud, the minds paused, commands routed here); the
// real folk and buildings are parked in an invisible group (never disposed), the real letters and notes are swapped
// out of the mailbox and back. Her look is untouched: the same painter, her saved look.json (trailer.t6_*), her shaders.
import { createBuildApi, compileAsset } from '../buildings/api.js';
import { createLibrary } from '../buildings/library.js';
import { createFillers } from '../buildings/fill.js';
import { createIdentity } from '../agents/identity.js';
import { applyColourRule } from '../agents/colour-rule.js';
import { extendFolk, strideOf, hopGait } from '../agents/species-extra.js';
import { SEA_Y } from '../world/ground.js';
import { poseFromEyeLook } from '../world/camera.js';
import { planCity, CITY_PLANS, planScale } from '../trailer/t6-city.js';
import { createPoser, hash1 } from '../trailer/shot.js';
import { makeFutureState } from '../sim/future-state.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, u) => a + (b - a) * u;
const smooth = u => { u = clamp(u, 0, 1); return u * u * (3 - 2 * u); };
const nextFrame = () => new Promise(r => requestAnimationFrame(() => setTimeout(r, 0)));
const raf = () => new Promise(r => requestAnimationFrame(r));
const fmt = n => Number(n).toLocaleString('en-GB');

// the hero view over the developed city: from the south hills, the old heart in the middle, the harbour, the sea and the
// rocket on its pad at the back (the trailer's high sweep, brought down a little)
const HERO = { eye: { x: 26, y: 76, z: 104 }, look: { x: 6, y: 0, z: -10 }, fov: 42 };
const HERO_FROM = { eye: { x: 44, y: 104, z: 128 }, look: { x: 6, y: 0, z: -6 }, fov: 42 };
const ENTER_GLIDE_MS = 3400;

export function createFuture({ game, ctx, kit, world, folk, agents, ui, rewards = null, painter = null, canvas = null, mailDots = null, marks = () => null,
  desk = null, commands = null, creation = null, stages = null, ministry = null, onboarding = () => null, log = () => {} } = {}) {
  const { scene, V } = ctx;
  const city = new THREE.Group(); city.name = 'future-city'; city.visible = false;
  const parkReal = new THREE.Group(); parkReal.name = 'future-park-today'; parkReal.visible = false; scene.add(parkReal);
  const parkCrowd = new THREE.Group(); parkCrowd.name = 'future-park-crowd'; parkCrowd.visible = false; scene.add(parkCrowd);
  let ready = false, active = false, busy = false, building = null, progress = 0, F = null, snap = null, lastCheck = null, autoAt = 0, clock0 = 0;
  const stats = { prepareMs: 0, prepareFrames: 0, longestSliceMs: 0, enterSwapMs: 0, enterMs: 0, exitSwapMs: 0, exitMs: 0, objects: 0, cells: 0, crowd: 0 };

  // ================= the prebuild (time-sliced) =================
  let sliceT0 = 0;
  const BUDGET = 6;
  async function breathe() {
    const now = performance.now();
    if (now - sliceT0 < BUDGET) return;
    stats.longestSliceMs = Math.max(stats.longestSliceMs, now - sliceT0);
    stats.prepareFrames++;
    await nextFrame(); sliceT0 = performance.now();
  }
  let fapi = null, flib = null, ffill = null, plan = null;
  const els = [], chimneys = [], boats = [], crowd = [], crowdSet = new Set(), animated = [];
  const cityMeshes = { line: [], colour: [] };   // the city's entries in ctx.lineOnly / ctx.colourOnly (out while hidden)
  const trees = { plot: [], inst: [] };          // the trees the city clears (hidden while it stands)
  let identity = null, poser = null, townExtra = null;

  async function exampleCode(name) { return (await fetch(new URL(`../buildings/examples/${name}.js`, import.meta.url))).text(); }
  function siteY(x, z, r) {
    let lo = Infinity;
    for (let k = 0; k < 9; k++) { const a = k / 8 * TAU, d = k ? r * 0.75 : 0; lo = Math.min(lo, world.groundY(x + Math.cos(a) * d, z + Math.sin(a) * d)); }
    return lo;
  }
  const addEl = (obj, it, kind) => { city.add(obj); els.push({ obj, it, kind, x: it.x, z: it.z, r0: it.r || 4, b: it.b }); };

  function prepare() {
    if (building) return building;
    building = (async () => {
      const t0 = performance.now(); sliceT0 = t0;
      try {
        await (world.ready || Promise.resolve());
        scene.add(city);
        // her building grammar with the trailer's own seeds (the same city as t6: api seed 1, fillers seed 5, plan seed 27)
        fapi = createBuildApi(ctx, kit, { keyDir: world.keyDir, seed: 1 });
        flib = createLibrary(ctx, kit, { api: fapi });
        ffill = createFillers(ctx, kit, fapi, { heightAt: (x, z) => world.groundY(x, z), lib: flib, avoid: (x, z) => world.isWater(x, z), seed: 5 });
        plan = planCity(world, { seed: 27, lib: flib });
        progress = 0.04; await breathe();
        const ids = [...new Set(plan.items.filter(i => i.type === 'lib').map(i => i.id).concat(['canoe']))];
        await flib.load(ids);
        for (const name of ['lighthouse', 'giant-duck']) { try { flib.register({ id: name, name, code: await exampleCode(name) }); } catch (e) { log('future asset', name, e.message); } }
        for (const P of Object.values(CITY_PLANS)) {
          let code = null; try { code = await exampleCode(P.file); } catch (e) { log('future plan', P.file, e.message); continue; }
          for (let k = 1; k <= P.n; k++) flib.register({ id: `${P.file}-${k}`, name: P.file, code });
        }
        sliceT0 = performance.now();
        // ---- the buildings, fields, creations ----
        const N = plan.items.length;
        for (let i = 0; i < N; i++) {
          const it = plan.items[i];
          try {
            if (it.type === 'lib' || it.type === 'asset') {
              const obj = flib.create(it.id, { variant: it.variant || 0, rot: it.rot || 0 });
              const ks = planScale(it.id);
              if (ks !== 1) { obj.scale.multiplyScalar(ks); const z0 = obj.userData.agora.size; if (z0) obj.userData.agora.size = { w: z0.w * ks, h: z0.h * ks, d: z0.d * ks }; }
              const m = flib.meta(it.id), floats = (m && m.water) || it.id === 'giant-duck';
              const y = floats ? SEA_Y : it.water ? Math.max(siteY(it.x, it.z, it.r || 3), SEA_Y + 0.4) : siteY(it.x, it.z, it.r || 3) - 0.04;
              obj.position.set(it.x, y, it.z);
              addEl(obj, it, it.type);
            } else if (it.type === 'fill') {
              const obj = ffill.make(it.id, it.poly, it.opts || {});
              if (obj) addEl(obj, it, 'fill');
            } else if (it.type === 'launch') {
              const plat = compileAsset(await exampleCode('launch-platform'), { name: 'launch-platform' })(fapi);
              const rocket = compileAsset(await exampleCode('rocket'), { name: 'rocket' })(fapi);
              const platRoot = plat.children[0], rocketRoot = rocket.children[0];
              const Lp = platRoot.userData.launch || { deckY: 4.3 }, k = plat.userData.agora.scaled || 1;
              plat.position.set(it.x - platRoot.position.x, SEA_Y, it.z - platRoot.position.z);
              const deckY = SEA_Y + platRoot.position.y + Lp.deckY * k;
              rocket.position.set(it.x - rocketRoot.position.x, deckY + 0.15 - rocketRoot.position.y, it.z - rocketRoot.position.z);
              addEl(plat, it, 'asset'); addEl(rocket, { ...it, r: 4 }, 'asset');
            }
          } catch (e) { log('future item', it.id, e.message); }
          progress = 0.04 + 0.5 * (i + 1) / N;
          await breathe();
        }
        // ---- the streets: short lengths, as the trailer cuts them ----
        for (const rd of plan.roads) {
          const pts = rd.pts, PER = 4;
          for (let i = 0; i + 1 < pts.length; i += PER) {
            const sl = pts.slice(i, Math.min(pts.length, i + PER + 1)); if (sl.length < 2) continue;
            const mx = sl.reduce((s, p) => s + p[0], 0) / sl.length, mz = sl.reduce((s, p) => s + p[1], 0) / sl.length;
            try { addEl(ffill.road(sl, { width: rd.width }), { x: mx, z: mz, b: rd.b1, r: 5 }, 'road'); } catch (e) { log('future road', e.message); }
            await breathe();
          }
        }
        progress = 0.6;
        buildChimneys(); await breathe();
        buildBoats(); await breathe();
        await buildTreeCover(); progress = 0.7;
        await buildCrowd(); progress = 0.85;
        await buildBatches(); progress = 0.95;
        // what still animates (sails, spinners): the objects that kept named parts after the batching
        // what animates (sails, spinners, bobbing): found by trying it (a prefab's animate(obj, t) moves its named parts)
        const pose = o => { const v = []; o.traverse(x => { if (x !== o) v.push(x.position.x, x.position.y, x.position.z, x.rotation.x, x.rotation.y, x.rotation.z, x.scale.x); }); return v.map(n => n.toFixed(4)).join(); };
        for (const el of els) if (el.kind === 'lib' || el.kind === 'asset') { const p0 = pose(el.obj); flib.animate(el.obj, 13.7); flib.animate(el.obj, 41.3); if (pose(el.obj) !== p0) animated.push(el.obj); }
        await mergeAll();
        city.updateMatrixWorld(true);
        // the city's entries in the painter's lists come out until she peeks (the painter walks those lists every frame)
        collectCityLists(); detachCityLists();
        stats.objects = els.length; stats.crowd = crowd.length;
        await warmUp();
        // the cabinet's faces, ahead of time (the portraits are rendered offscreen once and cached)
        try { const pre = makeFutureState(game.state); for (const c of pre.cabinet) if (c.agentId != null) agents.portrait(c.agentId, { size: 96, ring: false }); } catch (_) {}
        ready = true; progress = 1;
        stats.prepareMs = Math.round(performance.now() - t0);
        log('future ready', stats);
      } catch (e) { log('future prepare failed', e && e.message); console.error('[future] prepare', e); building = null; }
    })();
    return building;
  }

  // ---- smoke from the stacks (the plans mark each top 'stackTop'): soft puffs + one smooth proxy round each plume ----
  const PLUME_RISE = u => u * 11 + u * u * 5, PLUME_DRIFT = u => u * u * 9;
  function plumeProxy() {
    const prof = [[0.3, 0], [0.9, 1.5], [1.6, 4], [2.3, 7.5], [2.8, 11], [2.6, 14], [1.6, 15.6], [0.2, 16.2]].map(([r, y]) => new THREE.Vector2(r, y));
    const g = new THREE.LatheGeometry(prof, 18), P = g.attributes.position;
    for (let i = 0; i < P.count; i++) {
      const h = Math.max(0, P.getY(i)), u = Math.min(1, (-11 + Math.sqrt(121 + 20 * h)) / 10), d = PLUME_DRIFT(u);
      P.setX(i, P.getX(i) - d * 0.35); P.setZ(i, P.getZ(i) - d * 0.9);
    }
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial()); m.userData.agoraLine = true; m.visible = false;
    return m;
  }
  function buildChimneys() {
    const PUFF = fapi.clay('#efe6d8', '#c9bdb1', '#9a8c94'), PUFF_DARK = fapi.clay('#ddd3c8', '#ada2a4', '#7d7286');
    for (const el of els) {
      if (el.kind !== 'asset') continue;
      el.obj.updateMatrixWorld(true);
      const tops = []; el.obj.traverse(o => { if (o.name === 'stackTop') tops.push(o.getWorldPosition(new THREE.Vector3())); });
      tops.forEach((top, j) => {
        const puffs = [];
        for (let k = 0; k < 16; k++) { const p = fapi.sphere({ r: 1, seg: 14, mat: k % 3 === 2 ? PUFF_DARK : PUFF }); p.castShadow = false; p.userData.futDyn = true; city.add(p); ctx.colourOnly.push(p); puffs.push(p); }
        const proxy = plumeProxy(); proxy.userData.futDyn = true; proxy.position.set(top.x, top.y + 0.2, top.z); city.add(proxy); ctx.lineOnly.push(proxy);
        chimneys.push({ c: { x: top.x, z: top.z }, puffs, top: top.y + 0.2, seed: hash1(top.x * 3.1 + top.z + j) });
      });
    }
  }
  function setChimneys(a) {
    for (const ch of chimneys) {
      const life = 4.2, n = ch.puffs.length;
      ch.puffs.forEach((p, k) => {
        const u = ((a / life + k / n + ch.seed) % 1 + 1) % 1;
        const j = hash1(k * 7.1 + ch.seed * 13), j2 = hash1(k * 3.3 + ch.seed * 5);
        const rise = PLUME_RISE(u), drift = PLUME_DRIFT(u);
        p.position.set(ch.c.x - drift * 0.35 + (j - 0.5) * 1.6 * u + Math.sin(a * 0.6 + k) * 0.25 * u, ch.top + rise, ch.c.z - drift * 0.9 + (j2 - 0.5) * 1.4 * u);
        const s = (0.7 + u * 1.9) * (0.75 + 0.45 * j) * Math.sin(Math.min(1, u * 1.25) * Math.PI * 0.5 + 0.0001) * (1 - smooth((u - 0.72) / 0.28));
        p.scale.set(Math.max(0.001, s * 1.15), Math.max(0.001, s * 0.78), Math.max(0.001, s));
        p.visible = s > 0.01;
      });
    }
  }
  // ---- canoes and little craft criss-crossing the bay ----
  function buildBoats() {
    const lanes = [[-40, -36, 30, -40], [40, -44, -20, -47], [-10, -54, 50, -58], [-50, -48, 10, -32], [30, -34, -30, -30]];
    lanes.forEach((Ln, i) => {
      try {
        const obj = flib.create('canoe', { variant: i % 3, rot: 0 });
        obj.position.set(Ln[0], SEA_Y, Ln[1]); obj.userData.futDyn = true; city.add(obj);
        boats.push({ obj, L: Ln, ph: hash1(i * 5.3), sp: 0.05 + 0.02 * hash1(i) });
      } catch (e) { log('future boat', e.message); }
    });
  }
  function setBoats(a) {
    for (const bt of boats) {
      const [x0, z0, x1, z1] = bt.L, u = ((a * bt.sp + bt.ph) % 1 + 1) % 1, k = 1 - Math.abs(u * 2 - 1);
      bt.obj.position.set(lerp(x0, x1, k), SEA_Y + Math.sin(a * 1.3 + bt.ph * 9) * 0.05, lerp(z0, z1, k));
      const dir = u < 0.5 ? 1 : -1;
      bt.obj.rotation.y = Math.atan2((x1 - x0) * dir, (z1 - z0) * dir);
    }
  }

  // ---- the trees the city stands on: found once, hidden while it stands, put back exactly on exit ----
  function inPoly(x, z, poly) {
    let ins = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, zi] = poly[i], [xj, zj] = poly[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) ins = !ins; }
    return ins;
  }
  function covered(x, z) {
    for (const el of els) {
      const it = el.it || {};
      if (el.kind === 'road') { if (Math.hypot(x - el.x, z - el.z) < 6) return true; continue; }
      if (it.poly) { if (inPoly(x, z, it.poly) || Math.hypot(x - el.x, z - el.z) < 2) return true; continue; }
      if (Math.hypot(x - el.x, z - el.z) < (el.r0 || 3) + 1.4) return true;
    }
    const C = plan.centre;
    return Math.hypot(x - C.x, z - C.z) < 46;   // the town's own grounds
  }
  async function buildTreeCover() {
    const sc = world.scenery; if (!sc) return;
    for (const t of (sc.plot && sc.plot.trees) || []) { if (covered(t.x, t.z)) trees.plot.push({ t, grow: null }); await breathe(); }
    for (const v of sc.variants || []) {
      const im = (sc.woods || []).find(m => m.geometry === v.geo); if (!im) continue;
      for (let i = 0; i < v.list.length; i++) { const t = v.list[i]; if (covered(t.x, t.z)) trees.inst.push({ im, pm: null, i }); if (i % 40 === 0) await breathe(); }
    }
    for (const m of (sc.dress && sc.dress.meshes) || []) {
      for (let i = 0; i < m.list.length; i++) { const t = m.list[i]; if (covered(t.x, t.z)) trees.inst.push({ im: m.im, pm: m.pm, i }); if (i % 40 === 0) await breathe(); }
    }
  }
  const _M = new THREE.Matrix4(), ZERO = new THREE.Matrix4().makeScale(0.0001, 0.0001, 0.0001);
  function hideTrees() {
    const sc = world.scenery; if (!sc) return;
    const touched = new Set();
    for (const e of trees.plot) { e.grow = e.t.grow; e.t.grow = 0; }
    if (trees.plot.length) { try { sc.update(0); } catch (_) {} }
    for (const e of trees.inst) {
      e.m = e.im.instanceMatrix.array.slice(e.i * 16, e.i * 16 + 16);
      e.im.setMatrixAt(e.i, ZERO); touched.add(e.im);
      if (e.pm) { e.pm2 = e.pm.instanceMatrix.array.slice(e.i * 16, e.i * 16 + 16); e.pm.setMatrixAt(e.i, ZERO); touched.add(e.pm); }
    }
    touched.forEach(m => { m.instanceMatrix.needsUpdate = true; });
  }
  function showTrees() {
    const sc = world.scenery; if (!sc) return;
    const touched = new Set();
    for (const e of trees.plot) if (e.grow != null) { e.t.grow = e.grow; e.grow = null; }
    if (trees.plot.length) { try { sc.update(0); } catch (_) {} }
    for (const e of trees.inst) {
      if (e.m) { _M.fromArray(e.m); e.im.setMatrixAt(e.i, _M); touched.add(e.im); e.m = null; }
      if (e.pm && e.pm2) { _M.fromArray(e.pm2); e.pm.setMatrixAt(e.i, _M); touched.add(e.pm); e.pm2 = null; }
    }
    touched.forEach(m => { m.instanceMatrix.needsUpdate = true; });
  }

  // ---- batching (the trailer's grammar, made permanent: nothing un-builds here) ----
  function mergeGeos(geos, withColor) {
    let n = 0; geos.forEach(g => { n += g.attributes.position.count; });
    const pos = new Float32Array(n * 3), nrm = new Float32Array(n * 3), col = withColor ? new Float32Array(n * 3) : null;
    let o = 0;
    geos.forEach(g => {
      const c = g.attributes.position.count;
      pos.set(g.attributes.position.array.subarray(0, c * 3), o * 3);
      if (g.attributes.normal) nrm.set(g.attributes.normal.array.subarray(0, c * 3), o * 3);
      if (col) col.set(g.attributes.color.array.subarray(0, c * 3), o * 3);
      o += c;
    });
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
    if (col) out.setAttribute('color', new THREE.BufferAttribute(col, 3));
    out.computeBoundingBox(); out.computeBoundingSphere();
    return out;
  }
  const listDel = (list, m) => { const i = list.indexOf(m); if (i >= 0) list.splice(i, 1); };
  async function buildBatches() {
    const CELL = 28, cells = new Map();
    for (const el of els) {
      const Fm = el.obj.agoraForms; if (!Fm || Fm.form !== 'compact') continue;
      const key = Math.floor(el.x / CELL) + ',' + Math.floor(el.z / CELL);
      if (!cells.has(key)) cells.set(key, []);
      cells.get(key).push(el);
    }
    for (const list of cells.values()) {
      if (list.length < 2) continue;
      const buckets = new Map(), statics = [];
      for (const el of list) {
        el.obj.updateMatrixWorld(true);
        const mine = el.obj.agoraForms.merged.filter(m => m.agoraAnchor === el.obj && m.parent === el.obj);
        for (const m of mine) {
          const kind = m.userData.agoraLine ? 'line' : m.userData.agoraColour ? 'colour' : 'solid';
          const key = m.material.uuid + '|' + kind + '|' + (m.castShadow ? 1 : 0) + (m.receiveShadow ? 1 : 0);
          if (!buckets.has(key)) buckets.set(key, { mat: m.material, kind, cast: m.castShadow, receive: m.receiveShadow, geos: [], color: true });
          const b = buckets.get(key), g = m.geometry.clone(); g.applyMatrix4(m.matrixWorld);
          if (!g.attributes.color) b.color = false;
          b.geos.push(g);
        }
        statics.push(mine);
      }
      const group = new THREE.Group(); group.name = 'future-cell';
      buckets.forEach(b => {
        const mesh = new THREE.Mesh(mergeGeos(b.geos, b.color), b.mat); b.geos.forEach(g => g.dispose());
        mesh.castShadow = b.cast; mesh.receiveShadow = b.receive; mesh.name = 'future-cell'; mesh.matrixAutoUpdate = false; mesh.updateMatrix();
        if (b.kind === 'line') { mesh.userData.agoraLine = true; mesh.visible = false; ctx.lineOnly.push(mesh); }
        if (b.kind === 'colour') { mesh.userData.agoraColour = true; ctx.colourOnly.push(mesh); }
        group.add(mesh);
      });
      // the objects' own static meshes leave the scene and the lists (the cell meshes draw them now)
      for (const mine of statics) for (const m of mine) { if (m.parent) m.parent.remove(m); listDel(ctx.lineOnly, m); listDel(ctx.colourOnly, m); }
      city.add(group);
      stats.cells++;
      await breathe();
    }
  }
  // the second pass: the city never un-builds in the game, so EVERY static mesh left (fills, roads, non-compact things, the
  // trailer's cells themselves) is merged per material in coarse 64 m cells. The animated objects (sails, spinners), the
  // smoke, the boats and instanced meshes stay as they are. Same geometry, same materials, same lists: far fewer draws.
  function mergeAttrs(geos) {
    const out = new THREE.BufferGeometry(), names = Object.keys(geos[0].attributes);
    for (const nm of names) {
      const sz = geos[0].attributes[nm].itemSize; let n = 0; geos.forEach(g => { n += g.attributes[nm].count; });
      const arr = new Float32Array(n * sz); let o = 0;
      geos.forEach(g => { const A = g.attributes[nm]; arr.set(A.array.subarray(0, A.count * sz), o); o += A.count * sz; });
      out.setAttribute(nm, new THREE.BufferAttribute(arr, sz));
    }
    out.computeBoundingBox(); out.computeBoundingSphere();
    return out;
  }
  async function mergeAll() {
    const skip = new Set(animated);
    const CELL = 64, groups = new Map(), sources = [];
    const walk = o => {
      if (o.userData.futDyn || skip.has(o)) return;
      if (o.isMesh && !o.isInstancedMesh && !Array.isArray(o.material) && o.geometry && o.geometry.attributes.position) {
        const names = Object.keys(o.geometry.attributes).sort().join(',');
        if (/^(color,)?normal,position(,uv)?$/.test(names)) {
          o.updateMatrixWorld(true);
          const bs = o.geometry.boundingSphere || (o.geometry.computeBoundingSphere(), o.geometry.boundingSphere);
          const c = bs.center.clone().applyMatrix4(o.matrixWorld);
          const kind = o.userData.agoraLine ? 'line' : o.userData.agoraColour ? 'colour' : 'solid';
          const key = Math.floor(c.x / CELL) + ',' + Math.floor(c.z / CELL) + '|' + o.material.uuid + '|' + kind + '|' + (o.castShadow ? 1 : 0) + (o.receiveShadow ? 1 : 0) + '|' + names;
          if (!groups.has(key)) groups.set(key, { mat: o.material, kind, cast: o.castShadow, receive: o.receiveShadow, color: names.startsWith('color'), list: [] });
          groups.get(key).list.push(o);
          return;
        }
      }
      for (const k of o.children.slice()) walk(k);
    };
    for (const k of city.children.slice()) walk(k);
    const out = new THREE.Group(); out.name = 'future-merged';
    let n = 0;
    for (const g of groups.values()) {
      if (g.list.length < 2) continue;
      const geos = g.list.map(m => { let gg = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone(); gg.applyMatrix4(m.matrixWorld); return gg; });
      const mesh = new THREE.Mesh(mergeAttrs(geos), g.mat); geos.forEach(x => x.dispose());
      mesh.castShadow = g.cast; mesh.receiveShadow = g.receive; mesh.matrixAutoUpdate = false; mesh.updateMatrix(); mesh.name = 'future-merged';
      if (g.kind === 'line') { mesh.userData.agoraLine = true; mesh.visible = false; ctx.lineOnly.push(mesh); }
      if (g.kind === 'colour') { mesh.userData.agoraColour = true; ctx.colourOnly.push(mesh); }
      out.add(mesh);
      for (const m of g.list) { if (m.parent) m.parent.remove(m); listDel(ctx.lineOnly, m); listDel(ctx.colourOnly, m); sources.push(m); }
      if (++n % 6 === 0) await breathe();
    }
    city.add(out);
    stats.merged = { groups: n, from: sources.length, animated: animated.length };
  }
  function collectCityLists() {
    const set = new Set(); city.traverse(o => set.add(o));
    cityMeshes.line = ctx.lineOnly.filter(o => set.has(o));
    cityMeshes.colour = ctx.colourOnly.filter(o => set.has(o));
  }
  const without = (arr, gone) => { const s = new Set(gone); const keep = arr.filter(o => !s.has(o)); arr.length = 0; for (const o of keep) arr.push(o); };
  function detachCityLists() { without(ctx.lineOnly, cityMeshes.line); without(ctx.colourOnly, cityMeshes.colour); }
  function attachCityLists() { for (const o of cityMeshes.line) { o.visible = false; ctx.lineOnly.push(o); } for (const o of cityMeshes.colour) ctx.colourOnly.push(o); }

  // the programs and the GPU buffers, ahead of the toggle: the city drawn once into a tiny target from high above, a few
  // cells per frame (so the first painted frame of the peek uploads nothing)
  async function warmUp() {
    const renderer = ctx.renderer, rt = new THREE.WebGLRenderTarget(32, 32);
    const cam = new THREE.PerspectiveCamera(60, 1, 1, 2000); cam.position.set(4, 420, 20); cam.lookAt(4, 0, 0); cam.updateMatrixWorld(true);
    const kids = city.children.slice(), hide = new Map();
    // everything else in the scene stays as it is (same lights = same programs as the painter's)
    const prev = renderer.getRenderTarget();
    try {
      kids.forEach(k => { hide.set(k, k.visible); k.visible = false; });
      const step = Math.max(1, Math.ceil(kids.length / 10));
      for (let i = 0; i < kids.length; i += step) {
        for (let j = i; j < Math.min(kids.length, i + step); j++) kids[j].visible = hide.get(kids[j]);
        const t0 = performance.now();
        // visible ONLY for this off-screen draw: the game's own frames between slices must never see the city (the flash)
        city.visible = true;
        renderer.setRenderTarget(rt); renderer.render(scene, cam); renderer.setRenderTarget(prev);
        city.visible = false;
        stats.longestSliceMs = Math.max(stats.longestSliceMs, performance.now() - t0);
        await nextFrame(); sliceT0 = performance.now();
      }
    } catch (e) { log('future warm-up', e.message); }
    renderer.setRenderTarget(prev);
    kids.forEach(k => { k.visible = hide.get(k); });
    city.visible = false;
    rt.dispose();
  }

  // ================= the crowd: the grown town in the streets, the floaties and flits in the air =================
  const RIG = {
    puffer: { body: () => 0.13 + 0.34 * 0.95, hip: (f, by) => V(f.sd * 0.1, by - 0.34 * 0.95 + 0.06, 0), spread: 0.12, lift: 0.065, stride: 0.07, speed: 0.75 },
    drop: { body: a => a.LH, hip: (f, by) => V(f.sd * 0.09, by + 0.05, 0), spread: 0.1, lift: 0.06, stride: 0.07, speed: 0.7 },
    scoot: { body: a => a.LH, hip: (f, by) => V(f.sd * 0.11, by + 0.06, f.fz || 0), spread: 0.11, lift: 0.045, stride: 0.05, speed: 0.65, quad: true },
    pip: { body: a => a.LH + 0.226, hip: (f, by) => V(f.sd * 0.09, by - 0.17, 0), spread: 0.09, lift: 0.055, stride: 0.07, speed: 0.9 }
  };
  const TOWN = ['loaf', 'twinkle', 'glim', 'moth'];
  const YAX = new THREE.Vector3(0, 1, 0);
  function legsTo(a, hipFn, ankleFn, gy) {
    a.root.updateMatrixWorld(true);
    const sc = a.sc || a.root.scale.x;
    a.legs.forEach((f, i) => {
      const hip = a.root.localToWorld(hipFn(f));
      const ank = V(f.pos.x, ankleFn(f, i) + 0.03 * sc + gy, f.pos.z);
      const dir = hip.clone().sub(ank), len = Math.max(0.01, dir.length());
      f.leg.position.copy(ank); f.leg.quaternion.setFromUnitVectors(YAX, dir.divideScalar(len));
      f.leg.scale.set(sc * (f.thick || 1), len, sc * (f.thick || 1));
      f.foot.position.copy(ank); f.foot.rotation.set(0, a.heading, 0); f.foot.scale.setScalar(sc * (f.footScale || 1));
    });
  }
  function poseWalker(r, P) {
    const a = r.a, rig = RIG[r.species], sc = a.sc || a.root.scale.x, gy = P.gy;
    const ph = P.s / Math.max(0.05, (rig.stride || 0.07) * 4 * sc) * Math.PI;
    a.heading = P.heading; a.pos.set(P.x, 0, P.z);
    const side = V(Math.cos(P.heading), 0, -Math.sin(P.heading)), fwd = V(Math.sin(P.heading), 0, Math.cos(P.heading));
    const by = rig.body(a), bob = Math.abs(Math.sin(ph)) * 0.02;
    a.root.position.set(P.x, gy, P.z); a.root.rotation.set(0, P.heading, 0);
    a.body.position.set(0, by + bob, 0);
    a.body.rotation.set(0.08, 0, Math.sin(ph) * 0.06);
    a.legs.forEach((f, i) => {
      const psi = ph + ((rig.quad ? (i === 1 || i === 2) : i % 2) ? Math.PI : 0);
      const off = Math.sin(psi) * rig.stride * sc;
      f.pos.set(P.x + side.x * f.sd * rig.spread * sc + fwd.x * ((f.fz || 0) * sc + off), 0, P.z + side.z * f.sd * rig.spread * sc + fwd.z * ((f.fz || 0) * sc + off));
      f.lift = Math.max(0, Math.cos(psi)) * rig.lift * sc;
    });
    legsTo(a, f => rig.hip(f, a.body.position.y), f => f.lift, gy);
    if (a.arms) a.arms.forEach((arm, j) => { const sd = j === 0 ? -1 : 1; arm.rotation.x = sd * Math.sin(ph) * 0.5; });
    if (a.blob) { a.blob.position.set(P.x, gy + 0.015, P.z); a.blob.scale.setScalar(sc * 0.8); }
    if (a.eyes) a.eyes.forEach(e => e.scale.y = poser.blinkAt(P.t, r.i * 1.3) ? 0.12 : 1);
  }
  function lift(a, gy) {
    if (!gy) return;
    a.root.position.y += gy;
    (a.legs || []).forEach(l => { l.leg.position.y += gy; l.foot.position.y += gy; });
    if (a.blob) a.blob.position.y += gy;
  }
  function poseTown(r, x, z, heading, s, gy, t, blink) {
    const a = r.a, sc = a.sc || a.root.scale.x, pose = townExtra && townExtra.pose && townExtra.pose[r.species];
    if (!pose) return;
    if (r.species === 'loaf') {
      const g = hopGait(Math.max(0, s), 0.52 * sc, sc);
      pose(a, { x, z, heading, hop: g.hop, squash: g.squash, lift: g.lift, air: g.air, tip: g.tip, blink, t, y: gy });
    } else pose(a, { x, z, heading, stride: strideOf(r.species, Math.abs(s), sc), w: 1, blink, t, y: gy });
  }
  const floatY = (A, c, i) => (0.32 + 0.82 * Math.cos(0.3)) * A.sc + 0.45 + 0.18 * Math.sin(c * 1.3 + i * 1.7) + 0.06 * Math.sin(c * 3.1 + i);
  function streetStretch(i) {
    const C = plan.centre;
    const roads = plan.roads.filter(rd => rd.kind === 'road' && rd.pts.length > 8 && rd.pts.some(([x, z]) => Math.hypot(x - C.x, z - C.z) < 48));
    const harbour = hash1(i * 0.91 + 0.2) < 0.3;
    const pool = harbour ? roads.filter(rd => rd.pts.some(([x, z]) => z < -6 && x > -12 && x < 30)) : roads;
    const rd = (pool.length ? pool : roads)[Math.floor(hash1(i * 1.7 + 0.3) * (pool.length || roads.length))];
    const n = rd.pts.length, len = Math.min(n - 1, 6 + Math.floor(hash1(i * 2.9) * 10));
    let idx = [...Array(Math.max(1, n - len)).keys()];
    if (harbour) { const near = idx.filter(k => rd.pts[k][1] < -4 && rd.pts[k][0] > -12 && rd.pts[k][0] < 30); if (near.length) idx = near; }
    else { const town = idx.filter(k => Math.hypot(rd.pts[k][0] - C.x, rd.pts[k][1] - C.z) < 44); if (town.length) idx = town; }
    const start = idx[Math.floor(hash1(i * 4.1 + 1) * idx.length)];
    const pts = rd.pts.slice(start, start + len + 1);
    const lat = (hash1(i * 7.7) - 0.5) * (rd.width - 0.6);
    const out = [];
    for (let k = 0; k < pts.length; k++) {
      const [ax, az] = pts[Math.max(0, k - 1)], [bx, bz] = pts[Math.min(pts.length - 1, k + 1)], tl = Math.hypot(bx - ax, bz - az) || 1;
      out.push([pts[k][0] - (bz - az) / tl * lat, pts[k][1] + (bx - ax) / tl * lat]);
    }
    const cum = [0]; for (let k = 1; k < out.length; k++) cum.push(cum[k - 1] + Math.hypot(out[k][0] - out[k - 1][0], out[k][1] - out[k - 1][1]));
    return { pts: out, cum, L: cum[cum.length - 1] };
  }
  function along(route, s) {
    const L = route.L, m = ((s % (2 * L)) + 2 * L) % (2 * L), back = m > L, d = back ? 2 * L - m : m;
    let k = 1; while (k < route.cum.length - 1 && route.cum[k] < d) k++;
    const u = (d - route.cum[k - 1]) / Math.max(1e-4, route.cum[k] - route.cum[k - 1]);
    const [ax, az] = route.pts[k - 1], [bx, bz] = route.pts[k];
    let h = Math.atan2(bx - ax, bz - az); if (back) h += Math.PI;
    return { x: lerp(ax, bx, u), z: lerp(az, bz, u), heading: h };
  }
  const folkObjs = a => [a.root, a.blob, ...((a.legs || []).flatMap(l => [l.leg, l.foot]))].filter(Boolean);
  async function buildCrowd() {
    townExtra = extendFolk(ctx, folk);
    identity = createIdentity(ctx, folk, null);
    poser = createPoser(ctx, folk);
    const MIX = [['flit', 22], ['floatie', 18], ['puffer', 6], ['drop', 5], ['pip', 4], ['scoot', 4]];
    for (const sp of TOWN) if (folk.make[sp]) MIX.push([sp, 9]);
    const TRADES = ['builder', 'farmer', 'baker', 'trader', 'courier', 'scholar', 'crafter', 'diplomat'];
    const C = plan.centre, counts = {};
    let i = 0;
    for (const [sp, n] of MIX) for (let k = 0; k < n; k++, i++) {
      let a; try { a = folk.make[sp](counts[sp] = (counts[sp] || 0) + 1); } catch (e) { log('future make', sp, e.message); continue; }
      if (!a || !a.root) continue;
      a.controlled = true; a.driven = true;
      if (!a.sc) a.sc = a.root.scale.x;
      const rec = { a, species: sp, id: 'fut-' + i, sim: { id: 'fut-' + i, name: 'folk' + i, trade: TRADES[i % TRADES.length] }, i };
      if (sp === 'flit' || sp === 'floatie' || TOWN.includes(sp)) { try { identity.dress(rec); } catch (e) { log('future dress', sp, e.message); } }
      try { applyColourRule(rec, folk); } catch (_) {}
      const ours = sp === 'flit' || sp === 'floatie';
      if (TOWN.includes(sp)) { rec.mode = 'town'; rec.route = streetStretch(2000 + i); rec.s0 = hash1(i * 5.7) * 30; rec.speed = 0.75; }
      else if (ours && hash1(i * 3.3 + 0.7) < 0.42) {
        const cx = C.x + (hash1(i * 1.9) - 0.5) * 70, cz = C.z + (hash1(i * 2.3) - 0.5) * 60 - 4;
        rec.mode = 'fly'; rec.fly = { cx, cz, r: 5 + hash1(i * 5.1) * 12, y: 5 + hash1(i * 6.7) * 12, sp: (0.25 + hash1(i * 8.3) * 0.3) * (hash1(i * 9.1) < 0.5 ? 1 : -1), ph: hash1(i) * 6.28 };
      } else if (ours || RIG[sp]) {
        rec.mode = 'walk'; rec.route = streetStretch(i); rec.s0 = hash1(i * 13.7) * 40;
        rec.speed = ours ? 0.7 + hash1(i * 3.9) * 0.4 : RIG[sp].speed * (0.85 + hash1(i * 3.9) * 0.3);
      } else { folk.remove(a); continue; }
      crowd.push(rec); crowdSet.add(a);
      folkObjs(a).forEach(o => parkCrowd.add(o));
      await breathe();
    }
  }
  function setCrowd(t, a) {
    for (const r of crowd) {
      const A = r.a, ours = r.species === 'flit' || r.species === 'floatie', blink = poser.blinkAt(t, r.i * 1.7);
      if (r.mode === 'walk' || r.mode === 'town') {
        const s = r.s0 + a * r.speed, P = along(r.route, s), gy = world.groundY(P.x, P.z);
        if (r.mode === 'town') poseTown(r, P.x, P.z, P.heading, s, gy, t, blink);
        else if (ours) {
          if (r.species === 'flit') poser.flit(A, { x: P.x, z: P.z, heading: P.heading, hop: Math.abs(Math.sin(s * 3.2)) * 0.12, pitch: 0.06, prop: a * 6, blink, t });
          else poser.floatie(A, { x: P.x, z: P.z, heading: P.heading, y: floatY(A, a, r.i), air: true, airK: 1, spin: a * 0.35 + r.i, swx: 0.05 * Math.sin(a * 0.9 + r.i), blink, t });
          lift(A, gy);
        } else poseWalker(r, { x: P.x, z: P.z, heading: P.heading, s, gy, t });
      } else if (r.mode === 'fly') {
        const Fl = r.fly, ang = Fl.ph + a * Fl.sp, x = Fl.cx + Math.cos(ang) * Fl.r, z = Fl.cz + Math.sin(ang) * Fl.r;
        const heading = Math.atan2(-Math.sin(ang) * Math.sign(Fl.sp), Math.cos(ang) * Math.sign(Fl.sp));
        const y = world.groundY(x, z) + Fl.y + Math.sin(a * 1.3 + Fl.ph) * 0.6;
        if (r.species === 'flit') poser.flit(A, { x, z, heading, y, air: true, prop: t * 40, pitch: 0.15, bank: -0.25 * Math.sign(Fl.sp), blink, t });
        else poser.floatie(A, { x, z, heading, y, air: true, airK: 1, spin: t * 0.6, swz: 0.1 * Math.sign(Fl.sp), blink, t });
      }
      if (r.idn) { try { identity.step(r, 0, t); } catch (_) {} }
    }
  }

  // ================= today, parked: the real folk and buildings in an invisible group (never disposed) =================
  const parked = new Map();   // object -> its parent before the peek
  function park(o) { if (!o || o.parent === parkReal) return; parked.set(o, o.parent || scene); parkReal.add(o); }
  function parkToday() {
    const lists = [folk.creatures, folk.hoppers, folk.drops, folk.scoots, folk.flits, folk.pips, folk.floaties, ...(folk.extra ? Object.values(folk.extra.lists) : [])];
    for (const list of lists) for (const a of list || []) if (!crowdSet.has(a)) folkObjs(a).forEach(o => { if (o.parent) park(o); });
    if (creation && creation.entries) for (const e of creation.entries.values()) for (const k of ['obj', 'site', 'fill', 'sketch']) { const o = e[k]; if (o && o.isObject3D && o.parent) park(o); }
  }
  function unparkToday() {
    for (const [o, p] of parked) if (o.parent === parkReal) p.add(o);
    parked.clear();
  }

  // ================= the snapshot: her real game, as it is the moment she peeks =================
  const cloneState = s => { try { return structuredClone(s); } catch (_) { return JSON.parse(JSON.stringify(s)); } };
  const sig = s => { try { return JSON.stringify(s); } catch (_) { return ''; } };
  // a drifted value is put back IN PLACE (every module keeps its references to the state's objects)
  function restoreInto(target, src) {
    if (Array.isArray(target) && Array.isArray(src)) {
      for (let i = 0; i < src.length; i++) {
        if (i < target.length && target[i] && src[i] && typeof target[i] === 'object' && typeof src[i] === 'object' && Array.isArray(target[i]) === Array.isArray(src[i])) restoreInto(target[i], src[i]);
        else target[i] = src[i];
      }
      target.length = src.length; return;
    }
    for (const k of Object.keys(target)) if (!(k in src)) delete target[k];
    for (const k of Object.keys(src)) {
      const a = target[k], b = src[k];
      if (a && b && typeof a === 'object' && typeof b === 'object' && Array.isArray(a) === Array.isArray(b) && !(a instanceof Map) && !(a instanceof Set)) restoreInto(a, b);
      else target[k] = b;
    }
  }
  function takeSnapshot() {
    const L = ui.letters, mail = L._mail;
    return {
      state: cloneState(game.state), sig: sig(game.state),
      letters: L.all.map(l => ({ ...l })),                                   // newest first
      notes: mail ? mail.notify.list : [],                                   // newest first (copies)
      totals: rewards ? { ...rewards.totals } : null, civ: rewards ? rewards.civ : null, tallyHidden: rewards && rewards.el ? rewards.el.hidden : null,
      pose: world.rig.pose(),
      marksOn: marks() ? marks().enabled : null, marksVisible: marks() && marks().root ? marks().root.visible : null,
      bloom: world.ground && world.ground.uniforms ? world.ground.uniforms.uWorld.value : null,
      handle: commands ? commands.handle : null, cardShow: ui.agentCard ? ui.agentCard.show : null
    };
  }

  // ================= the mailbox, the tally, the cabinet: swapped in and back =================
  function closeMail() {
    const L = ui.letters;
    try { if (L.isFanned) L.gather(); } catch (_) {}
    try { L.close(); } catch (_) {}
    try { L.closeCompact(); } catch (_) {}
    try { L._mail && L._mail.notify.column.close(true); } catch (_) {}
  }
  function setMail(letters, notes) {
    const L = ui.letters, mail = L._mail;
    closeMail();
    L.setLetters(letters);
    if (!mail) return;
    mail.notify.dismissAll();
    for (const n of notes) mail.notify.push({ ...n, toast: false });
  }
  function futureNotes(list) {
    const now = Date.now(), out = [];
    list.forEach((l, k) => out.push({ letterId: l.id, letter: l, at: now - (list.length - k) * 7 * 60000, read: !!l.read }));
    return out;   // oldest first (push puts each on top)
  }

  // ---- the chrome of the peek: the "preview" badge, the cabinet (her own residents) ----
  let chrome = null;
  const CSS = `
.ag-fut { position: absolute; inset: 0; pointer-events: none; z-index: 12; font-family: var(--ag-font-text, Montserrat, sans-serif); color: var(--ink, #2a2740); }
.ag-fut[hidden] { display: none; }
.ag-fut__badge { position: absolute; left: 50%; top: var(--ag-gut, 16px); transform: translateX(-50%); display: flex; align-items: center; gap: 10px; padding: 8px 16px 8px 12px;
  border-radius: 999px; background: var(--pop-card, #fff8ec); box-shadow: var(--pop-edge-sm, 0 0 0 2px #2a2740, 4px 5px 0 4.5px #ee3d84); white-space: nowrap; }
.ag-fut__badge .dot { width: 11px; height: 11px; border-radius: 50%; background: var(--pink, #ee3d84); box-shadow: 0 0 0 2px var(--ink, #2a2740); animation: ag-fut-pulse 1.6s ease-in-out infinite; }
.ag-fut__badge b { font-size: 14px; font-weight: 800; letter-spacing: -.01em; }
.ag-fut__badge .tag { font-size: 11px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; padding: 3px 8px; border-radius: 999px; background: var(--lemon, #ffe23a); box-shadow: inset 0 0 0 1.5px var(--ink, #2a2740); }
.ag-fut__sub { position: absolute; left: 50%; top: calc(var(--ag-gut, 16px) + 46px); transform: translateX(-50%); font-size: 12px; font-weight: 600; white-space: nowrap;
  text-shadow: var(--ag-halo-strong, 0 0 6px #fff); }
@keyframes ag-fut-pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(.72); } }
.ag-fut__cab { position: absolute; left: var(--ag-gut, 16px); top: calc(var(--ag-gut, 16px) + 84px); width: 268px; padding: 12px 12px 10px; border-radius: 18px;
  background: var(--pop-card, #fff8ec); box-shadow: var(--pop-edge-sm, 0 0 0 2px #2a2740, 4px 5px 0 4.5px #ee3d84); pointer-events: auto; }
.ag-fut__cab h3 { margin: 0 2px 2px; font-size: 13px; font-weight: 800; display: flex; align-items: baseline; justify-content: space-between; }
.ag-fut__cab h3 span { font-size: 11px; font-weight: 600; opacity: .62; }
.ag-fut__cab ol { list-style: none; margin: 6px 0 0; padding: 0; display: grid; gap: 3px; }
.ag-fut__cab li { display: grid; grid-template-columns: 40px 1fr; gap: 9px; align-items: center; padding: 4px 4px; border-radius: 12px; }
.ag-fut__cab li:nth-child(2) { background: rgba(255, 226, 58, .35); }
.ag-fut__face { width: 40px; height: 40px; border-radius: 50%; overflow: hidden; background: var(--cream, #fff3dc); box-shadow: 0 0 0 2px var(--ink, #2a2740); display: grid; place-items: center; font-weight: 800; font-size: 15px; }
.ag-fut__face img { width: 100%; height: 100%; object-fit: cover; display: block; }
.ag-fut__who { min-width: 0; line-height: 1.18; }
.ag-fut__who b { display: block; font-size: 13px; font-weight: 800; }
.ag-fut__who i { display: block; font-style: normal; font-size: 11.5px; font-weight: 700; color: var(--mag, #b3175a); }
.ag-fut__who em { display: block; font-style: normal; font-size: 10.5px; font-weight: 500; opacity: .66; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ag-fut__pop { margin: 8px 2px 0; padding-top: 8px; border-top: 1.5px dashed rgba(42, 39, 64, .2); font-size: 10.5px; font-weight: 600; line-height: 1.45; opacity: .78; }
.ag-fut__pop b { font-weight: 800; }
body.ag-fut-on .agb, body.ag-fut-on .agt, body.ag-fut-on .ag-maildots, body.ag-fut-on .ag-goals, body.ag-fut-on .ag-callbtn, body.ag-fut-on .ag-call { display: none !important; }
.ag-fut-wipe { position: fixed; inset: 0; width: 100%; height: 100%; z-index: 4; pointer-events: none; display: block; }
.ag-fut-wipe[hidden] { display: none; }
@media (max-width: 760px) { .ag-fut__cab { width: 220px; } .ag-fut__sub { display: none; } }
`;
  function ensureChrome() {
    if (chrome) return chrome;
    if (!document.getElementById('ag-fut-css')) { const st = document.createElement('style'); st.id = 'ag-fut-css'; st.textContent = CSS; document.head.append(st); }
    const el = document.createElement('div'); el.className = 'ag-fut'; el.hidden = true;
    el.innerHTML = `<div class="ag-fut__badge" role="status"><i class="dot"></i><b>Developed civilisation</b><span class="tag">preview</span></div>
      <div class="ag-fut__sub"></div>
      <section class="ag-fut__cab" aria-label="The cabinet"><h3>The cabinet <span></span></h3><ol></ol><div class="ag-fut__pop"></div></section>`;
    (ui.el || document.body).append(el);
    chrome = { el, sub: el.querySelector('.ag-fut__sub'), list: el.querySelector('ol'), count: el.querySelector('h3 span'), pop: el.querySelector('.ag-fut__pop') };
    return chrome;
  }
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function fillChrome(S) {
    const c = ensureChrome();
    c.sub.textContent = `Day ${S.day} · a ${S.level} of ${fmt(S.population.total)} · where your residents could be`;
    c.count.textContent = `${S.cabinet.length} ministers`;
    c.list.innerHTML = S.cabinet.map(m => `<li data-agent="${esc(m.agentId)}"><span class="ag-fut__face">${esc((m.name || '?')[0])}</span><span class="ag-fut__who"><b>${esc(m.name)}</b><i>${esc(m.title)}</i><em>${esc(m.remit)}</em></span></li>`).join('');
    c.pop.innerHTML = `<b>${fmt(S.population.total)} residents</b> · ${S.buildings} buildings<br>` + S.population.species.map(s => `${s.n} ${s.plural}`).join(' · ');
    S.cabinet.forEach(m => {
      if (m.agentId == null) return;
      Promise.resolve(agents.portrait ? agents.portrait(m.agentId, { size: 96, ring: false }) : null).then(src => {
        if (!src || !active) return;
        const li = [...c.list.children].find(x => x.dataset.agent === String(m.agentId));
        const face = li && li.querySelector('.ag-fut__face');
        if (face) face.innerHTML = `<img src="${src}" alt="">`;
      }).catch(() => {});
    });
  }

  // ================= the painted wipe: the frame we leave, brushed away in broad strokes =================
  let wipeCv = null, brush = null;
  function makeBrush() {
    const W = 160, H = 240, c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d');
    let s = 1234567; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let y = 0; y < H; y++) {
      const v = y / (H - 1), rag = 0.06 + 0.1 * rnd();
      const edge = smooth(v / (0.12 + rag)) * smooth((1 - v) / (0.12 + rag));
      const a = edge * (0.5 + 0.5 * rnd()) * (rnd() < 0.06 ? 0.35 : 1);
      g.fillStyle = `rgba(0,0,0,${a.toFixed(3)})`; g.fillRect(0, y, W, 1);
    }
    g.globalCompositeOperation = 'destination-in';
    const gr = g.createLinearGradient(0, 0, W, 0);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.3, 'rgba(0,0,0,1)'); gr.addColorStop(0.7, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    return c;
  }
  // capture this frame (right after the game drew it), cover the screen with it, run swap(), then brush it away
  function paintedSwap(swap, { dir = 1, stall = null } = {}) {
    const src = canvas || ctx.renderer.domElement;
    if (!wipeCv) { wipeCv = document.createElement('canvas'); wipeCv.className = 'ag-fut-wipe'; wipeCv.hidden = true; document.body.append(wipeCv); ensureChrome(); }
    if (!brush) brush = makeBrush();
    return new Promise(resolve => {
      requestAnimationFrame(async () => {
        const W = src.width, H = src.height;
        if (wipeCv.width !== W || wipeCv.height !== H) { wipeCv.width = W; wipeCv.height = H; }
        const g = wipeCv.getContext('2d');
        g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
        g.clearRect(0, 0, W, H);
        try { g.drawImage(src, 0, 0, W, H); } catch (_) {}
        wipeCv.style.opacity = '1'; wipeCv.hidden = false;
        const t0 = performance.now();
        try { swap(); } catch (e) { log('future swap', e.message); console.error('[future] swap', e); }
        const swapMs = performance.now() - t0;
        if (stall) stall(swapMs);
        // let the painter draw the new world under the cover (its first frame is the heavy one)
        await raf(); await raf();
        // the strokes: broad bands at a slant, top to bottom, each brushed across like a wide flat brush
        const ang = -0.2 * dir, ca = Math.abs(Math.cos(ang)), sa = Math.abs(Math.sin(ang));
        const hx = (W * ca + H * sa) / 2 + 40, hy = (W * sa + H * ca) / 2 + 40;
        const bandH = Math.max(120, H * 0.2), n = Math.ceil(2 * hy / bandH) + 1;
        const sh = bandH * 1.4, sw = sh * 0.62, step = sw * 0.2;
        const bands = Array.from({ length: n }, (_, i) => ({ y: -hy + bandH * (i + 0.5), t0: i * 0.07 + hash1(i * 3.7) * 0.03, dur: 0.36 + hash1(i * 1.3) * 0.06, flip: (i % 2) ? -1 : 1, done: 0, wob: hash1(i * 9.1) * TAU }));
        const L = 2 * hx, tEnd = Math.max(...bands.map(b => b.t0 + b.dur));
        const start = performance.now();
        g.globalCompositeOperation = 'destination-out';
        const tick = () => {
          const t = (performance.now() - start) / 1000;
          g.setTransform(1, 0, 0, 1, 0, 0); g.translate(W / 2, H / 2); g.rotate(ang);
          for (const b of bands) {
            const p = clamp((t - b.t0) / b.dur, 0, 1), u = 1 - Math.pow(1 - p, 2.2), to = u * (L + sw);
            for (let d = b.done; d < to; d += step) {
              const x = b.flip > 0 ? -hx - sw / 2 + d : hx + sw / 2 - d;
              const y = b.y + Math.sin(d / L * 3.2 + b.wob) * bandH * 0.12;
              g.drawImage(brush, x - sw / 2, y - sh / 2, sw, sh);
              b.done = d + step;
            }
          }
          if (t < tEnd) { requestAnimationFrame(tick); return; }
          // the last of the paint lifts off
          const f0 = performance.now();
          const fade = () => { const k = (performance.now() - f0) / 160; wipeCv.style.opacity = String(Math.max(0, 1 - k)); if (k < 1) requestAnimationFrame(fade); else { wipeCv.hidden = true; resolve(); } };
          requestAnimationFrame(fade);
        };
        requestAnimationFrame(tick);
      });
    });
  }

  // ================= enter / exit =================
  const CROWD_CLOCK = () => (performance.now() - clock0) / 1000 + 100;
  async function enter() {
    if (active || busy) return active;
    if (!ready) { await prepare(); if (!ready) return false; }
    if (stages && (stages.scene !== 'world' || stages.flying || stages.paintSea === false)) { log('future: not on the seaside'); return false; }
    busy = true;
    const t0 = performance.now();
    F = makeFutureState(game.state);
    snap = takeSnapshot();
    active = true;                       // the real game pauses from the snapshot on (game.js reads .active)
    await paintedSwap(() => {
      active = true;
      document.body.classList.add('ag-fut-on');
      // her game, parked
      try { ui.agentCard.hide(); } catch (_) {}
      try { ui.talk && ui.talk.close && ui.talk.close(); } catch (_) {}
      try { ministry && ministry.call && ministry.call.isOpen && ministry.call.close && ministry.call.close(); } catch (_) {}
      const mk = marks(); if (mk) { try { mk.setEnabled(false); if (mk.root) mk.root.visible = false; } catch (_) {} }
      if (desk && desk.pause) desk.pause(true);
      try { mailDots && mailDots.setVisible && mailDots.setVisible(false); } catch (_) {}
      if (commands) commands.handle = (text, o) => command(text, o);
      if (ui.agentCard) ui.agentCard.show = () => {};
      parkToday();
      // the developed city, out
      attachCityLists(); city.visible = true;
      for (const r of crowd) folkObjs(r.a).forEach(o => scene.add(o));
      hideTrees();
      try { world.setWorldBloom(1); } catch (_) {}
      clock0 = performance.now();
      setCrowd(0, CROWD_CLOCK()); setChimneys(CROWD_CLOCK()); setBoats(CROWD_CLOCK());
      // the mailbox, the tally, the cabinet of this stage
      setMail(F.letters, futureNotes(F.letters));
      if (rewards) { try { rewards.setTotals(F.totals); rewards.setCiv({ level: F.level, progress: F.progress }); rewards.show && rewards.show(); } catch (_) {} }
      fillChrome(F); chrome.el.hidden = false;
      // the camera: from a little higher, settling over the city
      world.rig.setPose(poseFromEyeLook(HERO_FROM.eye, HERO_FROM.look, HERO_FROM.fov));
      try { world.rig.goView(poseFromEyeLook(HERO.eye, HERO.look, HERO.fov), { ms: ENTER_GLIDE_MS }); } catch (_) {}
      try { painter && painter.markDirty && painter.markDirty(); } catch (_) {}
    }, { dir: 1, stall: ms => { stats.enterSwapMs = Math.round(ms); } });
    stats.enterMs = Math.round(performance.now() - t0);
    busy = false;
    log('future entered', stats.enterSwapMs, stats.enterMs);
    return true;
  }
  async function exit() {
    if (!active || busy) return !active;
    busy = true;
    const t0 = performance.now();
    await paintedSwap(() => {
      // the city, away
      chrome && (chrome.el.hidden = true);
      city.visible = false; detachCityLists();
      for (const r of crowd) folkObjs(r.a).forEach(o => parkCrowd.add(o));
      showTrees();
      // today, back exactly
      unparkToday();
      const s = snap;
      if (s.bloom != null) { try { world.setWorldBloom(s.bloom); } catch (_) {} }
      world.rig.setPose(s.pose);
      if (commands && s.handle) commands.handle = s.handle;
      if (ui.agentCard && s.cardShow) ui.agentCard.show = s.cardShow;
      setMail(s.letters.slice().reverse(), s.notes.slice().reverse());
      if (rewards && s.totals) { try { rewards.setTotals(s.totals); if (s.civ) rewards.setCiv(s.civ); if (rewards.el && s.tallyHidden != null) rewards.el.hidden = s.tallyHidden; } catch (_) {} }
      const mk = marks(); if (mk && s.marksOn != null) { try { mk.setEnabled(s.marksOn); if (mk.root && s.marksVisible != null) mk.root.visible = s.marksVisible; } catch (_) {} }
      if (desk && desk.pause) desk.pause(false);
      try { mailDots && mailDots.setVisible && mailDots.setVisible(true); mailDots && mailDots.refresh && mailDots.refresh(); } catch (_) {}
      // the sim: paused the whole time, so this is a check; anything that drifted is put back in place
      const now = sig(game.state);
      lastCheck = { same: now === s.sig, at: Date.now() };
      if (!lastCheck.same) { try { restoreInto(game.state, cloneState(s.state)); lastCheck.restored = sig(game.state) === s.sig; } catch (e) { lastCheck.error = e.message; } }
      document.body.classList.remove('ag-fut-on');
      active = false; F = null;
      try { painter && painter.markDirty && painter.markDirty(); } catch (_) {}
    }, { dir: -1, stall: ms => { stats.exitSwapMs = Math.round(ms); } });
    snap = null;
    stats.exitMs = Math.round(performance.now() - t0);
    busy = false;
    log('future exited', stats.exitSwapMs, stats.exitMs, lastCheck);
    return true;
  }

  // every command and every letter reply while she peeks: the city answers, her real game hears nothing
  function command(text) {
    const r = F && F.replyFor(text);
    if (r) {
      try { ui.notice(r.text, { kind: 'ministry', ttl: 5200 }); } catch (_) {}
      if (r.letterId) { try { ui.letters.markResolved(r.letterId, { choice: text }); } catch (_) {} }
      return { actions: [], say: r.text, future: true };
    }
    try { ui.notice('This is a peek at a developed civilisation. Switch back to today to build your own.', { kind: 'ministry', ttl: 5200 }); } catch (_) {}
    return { actions: [], say: null, future: true };
  }

  // ================= the frame =================
  function update(dt, t) {
    if (!active) {
      // lazy prebuild: as the onboarding nears its end (from 'mark' on), or a little after the landing without one
      if (!ready && !building && t > autoAt) {
        autoAt = t + 1;
        let go = false;
        try {
          const ob = onboarding(), id = ob && ob.id;
          if (id && ['residents', 'future', 'planets', 'letters', 'build', 'mark', 'minister', 'neighbours', 'ministry'].includes(id)) go = true;
          else if ((!ob || (!ob.active && ob.state && ob.state.finished)) && stages && stages.scene === 'world' && (game.state.agents || []).length && game.state.t > 25) go = true;
        } catch (_) {}
        if (go) prepare();
      }
      return;
    }
    if (!city.visible) return;            // paused for the snapshot, the swap not yet made
    const a = CROWD_CLOCK();
    setCrowd(t, a);
    setChimneys(a);
    setBoats(a);
    for (const o of animated) flib.animate(o, a);
    // anything of today that came back into the scene by itself (an envoy, a returning courier): parked again
    parkToday();
  }

  return {
    prepare, enter, exit, update, command,
    toggle: () => (active ? exit() : enter()),
    get ready() { return ready; }, get active() { return active; }, get busy() { return busy; }, get progress() { return progress; },
    get state() { return F; }, get lastCheck() { return lastCheck; }, stats,
    _debug: { city, crowd, els, plan: () => plan, parked, trees, chimneys, cityMeshes }
  };
}
