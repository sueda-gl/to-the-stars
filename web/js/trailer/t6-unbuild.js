// ALOUD trailer, t6 UNBUILD: the rewind of a whole civilisation, on the game's own seaside map (web/js/world, the
// very land the gameplay lands on), painted by the Red arch engine (web/js/paint, G_DEFAULT untouched).
//
// It opens on a living, developed city: the old town round its piazza inside a wall, streets of houses, the harbour
// with docks, a shipyard, cranes, the lighthouse and the launch platform with the rocket, the works in the east
// (sawmill, smithy, kilns, stonemasons) with brick chimneys smoking, the farmland over the river (fields, windmills,
// barns, pastures), vineyards and orchards on the south hills, an aqueduct, an amphitheatre, an observatory, and our
// folk (flits + floaties) and the neighbours' peoples walking, working and flying everywhere.
// Then the tape stops and runs BACKWARDS, accelerating (a story clock with momentum): smoke is sucked back into the
// chimneys, sails turn back, the folk walk backwards and leave (ours rise back into the sky, the reverse of their
// arrival), and the city un-builds in reverse order of its history, layer by layer: each building's scaffold rises
// round it, its paint washes back down to the pencil drawing (the game's "pencil, then paint", reversed), the lines
// lift off and the scaffold sinks away; roads roll up from their tips, fields un-plough to grass, the colour of the
// land drains back toward the first camp and the cleared woods grow back. It ends on the empty seaside land, quiet,
// ready for the first word ("It began with a word.").
// Camera: low over the busy harbour, a crane up into a high sweep over the whole city, then a descent as it empties.
// Fixed clock (shot.js): window.__shot = { duration, marks, seek(t), play(), done }; ?t= renders one still;
// ?w=&h=&dpr= fixed render size (recording: ?w=1920&h=1080&dpr=2), default the window at min(dpr, 2) (TRAILER.md rule).
import { createRenderer, createContext } from '../paint/context.js';
import { createKit } from '../paint/kit.js';
import { createBackdrop } from '../paint/backdrop.js';
import { createFolk } from '../paint/folk.js';
import { createPainter } from '../paint/post.js';
import { createGame } from '../sim/index.js';
import * as geography from '../globe/geography.js';
import { createWorld, worldCamBase, makeNav } from '../world/world.js';
import { SEA_Y } from '../world/ground.js';
import { poseFromEyeLook } from '../world/camera.js';
import { createBuildApi, compileAsset, internals } from '../buildings/api.js';
import { createLibrary } from '../buildings/library.js';
import { createFillers } from '../buildings/fill.js';
import { createReveal } from '../buildings/reveal.js';
import { createIdentity } from '../agents/identity.js';
import { applyColourRule } from '../agents/colour-rule.js';
import { extendFolk, strideOf, hopGait } from '../agents/species-extra.js';
import { planCity, CITY_PLANS, planScale } from './t6-city.js';
import { applySavedLook, mountLookLab } from './look-lab.js';
import { mountShot, cameraTrack, createPoser, clamp, lerp, smooth, smoother, easeInOut, span, hash1 } from './shot.js';

const q = new URLSearchParams(location.search);
// a tad slower (Sueda, 2026-10-04): the whole piece runs TS times its first cut (rocket hold, rewind, a calmer ending)
const TS = 1.45;   // (1.25, then 'slower again' +16%)
const DUR = 20 * TS;

// ================= the painter's stage (paint settings rule: her pixel ratio, the window's size) =================
const renderer = createRenderer();
const DPR = q.has('dpr') ? +q.get('dpr') : Math.min(window.devicePixelRatio || 1, 2);
renderer.setPixelRatio(DPR);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, 16 / 9, 0.5, 1400);
const ctx = createContext({ renderer, scene, camera, seed: 11 });
const { V } = ctx;
const kit = createKit(ctx);
const backdrop = createBackdrop(ctx, { camBase: worldCamBase() });
const game = createGame({ seed: 7, name: 'Agora', offline: true });
const world = createWorld(ctx, kit, game, { geography, backdrop, dressing: true, autoBloom: false, autoLevel: false, input: { left: 'none', keys: false, wheel: false, pan: [] } });
const nav = makeNav(game, world);
const folk = createFolk(ctx, backdrop, nav);
const painter = createPainter(ctx, folk, { framing: world.framing });
painter.setMode(1);   // Gouache; her G_DEFAULT untouched (no overrides here)
// (no world.usePainter: the map would scale the brush with distance; the trailer keeps her G_DEFAULT untouched)
const FIXED = q.has('w') && q.has('h');
const size = () => FIXED ? [+q.get('w'), +q.get('h')] : [innerWidth, innerHeight];
painter.resize(...size());
if (!FIXED) addEventListener('resize', () => { painter.resize(...size()); if (window.__shot) window.__shot.seek(window.__shot.t); });

// ================= dusk for the rocket shot (Sueda: a darker sky so the white rocket pops) =================
// Her sky shader is untouched: a separate veil sphere just inside it deepens the sky toward early night (indigo at the
// top, a warm band kept at the horizon round the sun), and the scene's own light / sea uniforms dim with it. As the
// tape rewinds the night lifts back into day (dusk() eases 1 -> 0 as the camera rises over the city).
const veilMat = new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, transparent: true, uniforms: { uK: { value: 1 } },
  vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform float uK; varying vec3 vDir;
    void main(){
      float h = vDir.y;
      vec3 top = vec3(0.07, 0.08, 0.22), mid = vec3(0.24, 0.20, 0.42);
      vec3 c = mix(mid, top, smoothstep(0.03, 0.45, h));
      float a = mix(0.25, 0.86, smoothstep(0.0, 0.3, h)) * uK;
      gl_FragColor = vec4(c, a);
    }`
});
const veil = new THREE.Mesh(new THREE.SphereGeometry(590, 32, 16), veilMat);
veil.renderOrder = -9; scene.add(veil); ctx.colourOnly.push(veil); ctx.folkHidden.push(veil);
const DAY = { key: backdrop.key.intensity, hemi: backdrop.hemi.intensity };
const dusk = t => 1 - smoother(span(t, 7.6 * TS, 11.2 * TS));
function setDusk(k) {
  veilMat.uniforms.uK.value = k; veil.visible = k > 0.002;
  backdrop.key.intensity = DAY.key * (1 - 0.32 * k);
  backdrop.hemi.intensity = DAY.hemi * (1 - 0.42 * k);
  const su = world.sea && world.sea.material && world.sea.material.uniforms;
  if (su) {
    su.uShallow.value.set(SEA_DAY.s).lerp(SEA_NIGHT.s, k * 0.8); su.uDeepC.value.set(SEA_DAY.d).lerp(SEA_NIGHT.d, k * 0.8);
  }
}
const SEA_DAY = { s: new THREE.Color('#93cfc3'), d: new THREE.Color('#1d4f93') }, SEA_NIGHT = { s: new THREE.Color('#3f6f86'), d: new THREE.Color('#121e4a') };

const api = createBuildApi(ctx, kit, { keyDir: backdrop.KEY_DIR, seed: 1 });
const lib = createLibrary(ctx, kit, { api });
world.lib = lib;
const fillers = createFillers(ctx, kit, api, { heightAt: (x, z) => world.groundY(x, z), lib, avoid: (x, z) => world.isWater(x, z), seed: 5 });

// ================= the story clock: forward, the tape stops, then a rewind with momentum =================
// v(t) = how fast story time runs (+1 forward, < 0 backwards); a(t) = its integral (the animation clock: smoke,
// sails, walking, boats); D(t) = how developed the world is (1 -> 0), driven by the rewind's own distance so the
// un-building accelerates with the tape.
const T = Object.fromEntries(Object.entries({ stop: 2.4, rev: 3.0, peak: 14.0, settle: 17.4 }).map(([k, v]) => [k, v * TS]));
function vAt(t) {
  if (t < T.stop) return 1;
  if (t < T.rev) return lerp(1, -0.8, smoother(span(t, T.stop, T.rev)));
  if (t < T.peak) return lerp(-0.8, -6.8, Math.pow(span(t, T.rev, T.peak), 1.7));   // slow at first: the rocket goes alone
  if (t < T.settle) return lerp(-6.2, 0, smoother(span(t, T.peak, T.settle)));
  return 0;
}
const STEP = 1 / 480, NT = Math.ceil(DUR / STEP) + 2, A_ = new Float64Array(NT), B_ = new Float64Array(NT);
for (let i = 1; i < NT; i++) { const t = (i - 0.5) * STEP, v = vAt(t); A_[i] = A_[i - 1] + v * STEP; B_[i] = B_[i - 1] + Math.max(0, -v) * STEP; }
const tab = (arr, t) => { const f = clamp(t / STEP, 0, NT - 1.001), i = Math.floor(f); return lerp(arr[i], arr[i + 1], f - i); };
const B_END = tab(B_, T.settle);
const clockAt = t => 100 + tab(A_, t);                         // never negative (prefab animations take any t >= 0)
const devAt = t => 1 - clamp(tab(B_, t) / B_END, 0, 1);       // 1 = the developed world, 0 = the empty land

// ================= the city =================
const plan = planCity(world, { seed: 27, lib });
const els = [];          // every un-buildable thing: { obj, r (reveal), b, w, scaffold?, kind, x, z, r0 }
let rocketRig = null;
const chimneys = [];
const PUFF = api.clay('#efe6d8', '#c9bdb1', '#9a8c94');
const PUFF_DARK = api.clay('#ddd3c8', '#ada2a4', '#7d7286');

// a scaffold in the construction-site grammar (buildings/construction.js, its frame without its reveal): stakes and a
// chalk outline on the footprint, corner poles, one ring of ledgers, a walking plank, a stack of crates
function makeScaffold(w, d, h) {
  const R = api.ramps, g = api.group(), stakes = api.group(), frame = api.group();
  const hx = w / 2 + 0.25, hz = d / 2 + 0.25, corners = [[-hx, -hz], [hx, -hz], [hx, hz], [-hx, hz]];
  corners.forEach(([x, z]) => stakes.add(api.box({ w: 0.1, h: 0.6, d: 0.1, x, y: 0.3, z, ramp: R.WOOD })));
  for (let i = 0; i < 4; i++) {
    const [x0, z0] = corners[i], [x1, z1] = corners[(i + 1) % 4], len = Math.hypot(x1 - x0, z1 - z0), rot = Math.atan2(x1 - x0, z1 - z0);
    stakes.add(api.colourOnly(api.box({ w: 0.12, h: 0.014, d: len, x: (x0 + x1) / 2, y: 0.01, z: (z0 + z1) / 2, rot, ramp: R.SAND })));
  }
  const sh = h + 0.6, sx = w / 2 + 0.55, sz = d / 2 + 0.55, poles = [[-sx, -sz], [sx, -sz], [sx, sz], [-sx, sz]];
  if (w > 6.5) poles.push([0, sz], [0, -sz]);
  if (d > 6.5) poles.push([sx, 0], [-sx, 0]);
  poles.forEach(([x, z]) => frame.add(api.cylinder({ r: 0.09, h: sh, x, y: sh / 2, z, ramp: R.WOOD, lift: 0.12, seg: 6 })));
  for (const ly of [Math.min(sh - 0.2, Math.max(1.4, sh * 0.45)), sh - 0.25]) {
    frame.add(api.box({ w: 2 * sx + 0.24, h: 0.1, d: 0.1, y: ly, z: sz, ramp: R.WOOD, lift: 0.12 }));
    frame.add(api.box({ w: 2 * sx + 0.24, h: 0.1, d: 0.1, y: ly, z: -sz, ramp: R.WOOD, lift: 0.12 }));
    frame.add(api.box({ w: 0.1, h: 0.1, d: 2 * sz + 0.24, x: sx, y: ly, ramp: R.WOOD }));
    frame.add(api.box({ w: 0.1, h: 0.1, d: 2 * sz + 0.24, x: -sx, y: ly, ramp: R.WOOD }));
  }
  frame.add(api.box({ w: 2 * sx - 0.1, h: 0.07, d: 0.55, y: sh * 0.45 + 0.08, z: sz + 0.05, ramp: R.SAND }));
  const pile = api.group({ x: sx + 1.1, z: sz - 0.5 });
  [[0, 0, 0, 0.62, 0.2], [0.7, 0, 0.12, 0.56, -0.3], [0.32, 0.62, 0.05, 0.52, 0.5]].forEach(([x, y, z, s, rot]) => pile.add(api.crate({ s, x, y, z, rot })));
  stakes.add(pile);
  g.add(stakes); g.add(frame);
  g.userData.stakes = stakes; g.userData.frame = frame;
  { const I = internals(api); I.finish(g); I.register(g); }   // into the keyline / colour lists, as construction.js does
  return g;
}

function siteY(x, z, r) {
  let lo = Infinity;
  for (let k = 0; k < 9; k++) { const a = k / 8 * Math.PI * 2, d = k ? r * 0.75 : 0; lo = Math.min(lo, world.groundY(x + Math.cos(a) * d, z + Math.sin(a) * d)); }
  return lo;
}
function addEl(obj, it, kind) {
  scene.add(obj);
  const r = createReveal(ctx, obj, { camera });
  // the rocket goes FIRST (D 0.995 -> 0.955); everything else waits until it is gone (its window ends by D = 0.955)
  const w0 = it.w || 0.07, b0 = Math.min(it.b, (it.rocket ? 0.995 : 0.935) - w0);
  const el = { obj, r, b: b0, w: w0, kind, x: it.x, z: it.z, r0: it.r || 4, state: 'done', it };
  if (it.scaffold) {
    const s = (obj.userData.agora && obj.userData.agora.size) || { w: 4, h: 4, d: 4 };
    const sc = makeScaffold(Math.max(1.5, s.w || 4), Math.max(1.5, s.d || 4), Math.max(2, Math.min(18, s.h || 4)));
    sc.position.copy(obj.position); sc.rotation.y = obj.rotation.y;
    scene.add(sc); sc.visible = false; el.scaffold = sc;
  }
  els.push(el);
  return el;
}

async function exampleCode(name) { return (await fetch(new URL(`../buildings/examples/${name}.js`, import.meta.url), { cache: 'no-store' })).text(); }

const ready = (async () => {
  await applySavedLook(painter, 't6');   // her saved look for this scene (look.json trailer.t6_*), else G_DEFAULT
  const ids = [...new Set(plan.items.filter(i => i.type === 'lib').map(i => i.id).concat(['canoe']))];
  await lib.load(ids);
  for (const name of ['lighthouse', 'giant-duck']) { try { lib.register({ id: name, name, code: await exampleCode(name) }); } catch (e) { console.warn('[t6] asset', name, e); } }
  // the modern city's own plans (buildings/examples/city-*.js), each registered under n ids: n different seeds
  for (const P of Object.values(CITY_PLANS)) {
    let code = null; try { code = await exampleCode(P.file); } catch (e) { console.warn('[t6] plan', P.file, e); continue; }
    for (let k = 1; k <= P.n; k++) { const r = lib.register({ id: `${P.file}-${k}`, name: P.file, code }); if (!r.ok) console.warn('[t6] plan', P.file, r.error); }
  }
  await world.ready;
  // ---- buildings, fillers, creations ----
  for (const it of plan.items) {
    if (it.type === 'lib' || it.type === 'asset') {
      const obj = lib.create(it.id, { variant: it.variant || 0, rot: it.rot || 0 });
      const ks = planScale(it.id); if (ks !== 1) { obj.scale.multiplyScalar(ks); const z0 = obj.userData.agora.size; if (z0) obj.userData.agora.size = { w: z0.w * ks, h: z0.h * ks, d: z0.d * ks }; }
      const m = lib.meta(it.id), floats = (m && m.water) || it.id === 'giant-duck';
      const y = floats ? SEA_Y : it.water ? Math.max(siteY(it.x, it.z, it.r || 3), SEA_Y + 0.4) : siteY(it.x, it.z, it.r || 3) - 0.04;
      obj.position.set(it.x, y, it.z);
      addEl(obj, it, it.type);
    } else if (it.type === 'fill') {
      const obj = fillers.make(it.id, it.poly, it.opts || {});
      if (!obj) continue;
      addEl(obj, it, 'fill');
    } else if (it.type === 'launch') {
      try {
        const plat = compileAsset(await exampleCode('launch-platform'), { name: 'launch-platform' })(api);
        const rocket = compileAsset(await exampleCode('rocket'), { name: 'rocket' })(api);
        const platRoot = plat.children[0], rocketRoot = rocket.children[0];
        const L = platRoot.userData.launch || { deckY: 4.3 }, k = plat.userData.agora.scaled || 1;
        plat.position.set(it.x - platRoot.position.x, SEA_Y, it.z - platRoot.position.z);
        const deckY = SEA_Y + platRoot.position.y + L.deckY * k;
        rocket.position.set(it.x - rocketRoot.position.x, deckY + 0.15 - rocketRoot.position.y, it.z - rocketRoot.position.z);
        addEl(plat, { ...it, scaffold: false }, 'asset');   // (its big scaffold would wrap the camera on the quay)
        addEl(rocket, { ...it, b: 0.935, w: 0.06, rocket: true, scaffold: true, r: 4 }, 'asset');
        rocketRig = { plat, rocket };
      } catch (e) { console.warn('[t6] launch platform', e); }
    }
  }
  // ---- roads: cut into short lengths that roll up from the far tip toward the old town ----
  for (const rd of plan.roads) {
    const pts = rd.pts, C = plan.centre;
    const dists = pts.map(([x, z]) => Math.hypot(x - C.x, z - C.z)), dmin = Math.min(...dists), dmax = Math.max(...dists);
    const PER = 4;   // points per length (2 m apart -> ~8 m lengths)
    for (let i = 0; i + 1 < pts.length; i += PER) {
      const sl = pts.slice(i, Math.min(pts.length, i + PER + 1));
      if (sl.length < 2) continue;
      const mx = sl.reduce((s, p) => s + p[0], 0) / sl.length, mz = sl.reduce((s, p) => s + p[1], 0) / sl.length;
      const u = dmax > dmin ? (Math.hypot(mx - C.x, mz - C.z) - dmin) / (dmax - dmin) : 0;
      const obj = fillers.road(sl, { width: rd.width });
      addEl(obj, { x: mx, z: mz, b: lerp(rd.b1, rd.b0, u), w: 0.03, r: 5 }, 'road');
    }
  }
  // ---- smoke from the stacks of the factories and the power station (their plans mark each top 'stackTop') ----
  for (const el of els) {
    if (el.kind !== 'asset') continue;
    el.obj.updateMatrixWorld(true);
    const tops = []; el.obj.traverse(o => { if (o.name === 'stackTop') tops.push(o.getWorldPosition(new THREE.Vector3())); });
    tops.forEach((top, j) => {
      const puffs = [];
      // the puffs are colour only (no pencil ring round every ball); ONE smooth invisible proxy round the whole plume
      // (the plume grammar, plume.js) draws a single outline and hides the lines behind it, so it reads as one cloud
      for (let k = 0; k < 16; k++) {
        const p = api.sphere({ r: 1, seg: 14, mat: k % 3 === 2 ? PUFF_DARK : PUFF });
        scene.add(p); p.castShadow = false; ctx.colourOnly.push(p); puffs.push(p);
      }
      const proxy = plumeProxy(); proxy.position.set(top.x, top.y + 0.2, top.z); proxy.visible = false; scene.add(proxy);
      chimneys.push({ c: { x: top.x, z: top.z }, el, puffs, proxy, top: top.y + 0.2, seed: hash1(top.x * 3.1 + top.z + j) });
    });
  }
  // the bakery / bathhouse / charcoal etc. smoke themselves through their prefab animate(obj, t)
  buildTrees();
  buildCrowd();
  buildBoats();
  els.forEach(el => { el.r.done(); el.state = 'done'; });
  if (!q.has('nobatch')) buildBatches();
  window.__t6.els = els; window.__t6.chunks = chunks;
})();

// ================= the woods and the trees: cleared by the city, grown back by the rewind =================
// every tree under a building / field / road is gone while anything covers it, and springs back when the last
// covering thing un-builds
const trees = { plot: [], woods: [], dress: [] };
function coverOf(x, z) {
  let b = -1;
  for (const el of els) {
    const it = el.it || {};
    if (el.kind === 'road') { if (Math.hypot(x - el.x, z - el.z) < 6) b = Math.max(b, el.b); continue; }
    if (it.poly) { if (inPoly(x, z, it.poly) || Math.hypot(x - el.x, z - el.z) < 2) b = Math.max(b, el.b); continue; }
    if (Math.hypot(x - el.x, z - el.z) < (el.r0 || 3) + 1.4) b = Math.max(b, el.b);
  }
  // the town's own grounds: everything within the developed footprint is cleared too (the last to regrow: the heart)
  const C = plan.centre, d = Math.hypot(x - C.x, z - C.z);
  if (b < 0 && d < 46) b = 0.12 + d / 46 * 0.3;
  return b;
}
function inPoly(x, z, poly) {
  let ins = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, zi] = poly[i], [xj, zj] = poly[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) ins = !ins; }
  return ins;
}
const _M = new THREE.Matrix4(), _Q = new THREE.Quaternion(), _S = new THREE.Vector3(), _T = new THREE.Vector3(), _Y = new THREE.Vector3(0, 1, 0);
function buildTrees() {
  const sc = world.scenery; if (!sc) return;
  for (const t of sc.plot.trees) { const b = coverOf(t.x, t.z); if (b >= 0) trees.plot.push({ t, b }); }
  sc.variants.forEach(v => {
    const im = sc.woods.find(m => m.geometry === v.geo); if (!im) return;
    v.list.forEach((t, i) => { const b = coverOf(t.x, t.z); if (b >= 0) trees.woods.push({ im, i, t, b, k: -1 }); });
  });
  for (const m of sc.dress.meshes) m.list.forEach((t, i) => { const b = coverOf(t.x, t.z); if (b >= 0) trees.dress.push({ im: m.im, pm: m.pm, i, t, b, k: -1 }); });
}
const BACK = u => { const c = 1.5; return 1 + (c + 1) * Math.pow(u - 1, 3) + c * Math.pow(u - 1, 2); };
function setTrees(D) {
  const sc = world.scenery; if (!sc) return;
  // a tree regrows as D falls through (b - 0.012) .. (b - 0.05)
  const growOf = b => 1 - span(D, b - 0.05, b - 0.012);
  let any = false;
  for (const e of trees.plot) { const g = growOf(e.b); const v = Math.min(0.9999, Math.max(0, g)); if (e.t.grow !== v) { e.t.grow = v; any = true; } }
  if (any) sc.update(0);
  const touched = new Set();
  for (const list of [trees.woods, trees.dress]) for (const e of list) {
    const g = growOf(e.b); if (g === e.k) continue; e.k = g;
    const s = g <= 0 ? 0.0001 : BACK(g), t = e.t;
    _Q.setFromAxisAngle(_Y, t.rot); _S.set(t.s * s, t.s * Math.max(0.0001, s * s), t.s * s); _T.set(t.x, t.y - (list === trees.woods ? 0.08 : 0.05), t.z);
    _M.compose(_T, _Q, _S); e.im.setMatrixAt(e.i, _M); touched.add(e.im);
    if (e.pm) { e.pm.setMatrixAt(e.i, _M); touched.add(e.pm); }
  }
  touched.forEach(m => { m.instanceMatrix.needsUpdate = true; });
}

// ================= batching: a standing quarter is drawn as a few merged meshes =================
// Every finished object is already compact (buildings/compact.js: one mesh per material). A whole developed city in
// view is still ~400 objects x 8 meshes x 4 painter passes, so while EVERY object in a 28 m cell still stands
// (D >= max(b + w) over the cell), the cell's static compact meshes are merged once more, per material, into a
// handful of cell meshes; the moment anything in the cell starts to un-build, the cell falls back to its objects.
// Pure bookkeeping (same geometry, same materials, same lists): the painting is identical, only cheaper.
const chunks = [];
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
const listAdd = (list, m) => { if (!list.includes(m)) list.push(m); }, listDel = (list, m) => { const i = list.indexOf(m); if (i >= 0) list.splice(i, 1); };
function buildBatches() {
  const CELL = 28, cells = new Map();
  for (const el of els) {
    const F = el.obj.agoraForms; if (!F || F.form !== 'compact') continue;
    const key = Math.floor(el.x / CELL) + ',' + Math.floor(el.z / CELL);
    if (!cells.has(key)) cells.set(key, []);
    cells.get(key).push(el);
  }
  cells.forEach(list => {
    if (list.length < 2) return;
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
      statics.push({ el, mine });
    }
    const meshes = [];
    buckets.forEach(b => {
      const mesh = new THREE.Mesh(mergeGeos(b.geos, b.color), b.mat); b.geos.forEach(g => g.dispose());
      mesh.castShadow = b.cast; mesh.receiveShadow = b.receive; mesh.name = 't6-cell'; mesh.matrixAutoUpdate = false; mesh.updateMatrix();
      if (b.kind === 'line') { mesh.userData.agoraLine = true; mesh.visible = false; }
      if (b.kind === 'colour') mesh.userData.agoraColour = true;
      meshes.push({ mesh, kind: b.kind });
    });
    chunks.push({ statics, meshes, bMax: Math.max(...list.map(el => el.b + el.w)) + 1e-4, on: false });
  });
}
function setChunk(ch, on) {
  if (ch.on === on) return;
  ch.on = on;
  const { lineOnly, colourOnly } = ctx;
  if (on) {
    for (const { mine } of ch.statics) for (const m of mine) { if (m.parent) m.parent.remove(m); listDel(lineOnly, m); listDel(colourOnly, m); }
    for (const { mesh, kind } of ch.meshes) { scene.add(mesh); if (kind === 'line') { mesh.visible = false; listAdd(lineOnly, mesh); } else if (kind === 'colour') listAdd(colourOnly, mesh); }
  } else {
    for (const { mesh } of ch.meshes) { scene.remove(mesh); listDel(lineOnly, mesh); listDel(colourOnly, mesh); }
    for (const { el, mine } of ch.statics) {
      if (el.obj.agoraForms.form !== 'compact') continue;
      for (const m of mine) { m.agoraAnchor.add(m); if (m.userData.agoraLine) { m.visible = false; listAdd(lineOnly, m); } else if (m.userData.agoraColour) listAdd(colourOnly, m); }
    }
  }
}

// ================= each thing's un-building, as a function of D =================
// p = clamp((D - b) / w): 1 standing, 0 gone. Buildings: the scaffold rises round it (1 .. 0.8), the paint washes
// back down (0.8 .. 0.42), the pencil drawing holds (.. 0.32), the lines lift off part by part (.. 0.08), the
// scaffold sinks away (0.22 .. 0). Fields, roads, plazas: the same without a scaffold, quicker.
function setEl(el, D) {
  const p = clamp((D - el.b) / el.w, 0, 1), r = el.r;
  const S = el.scaffold ? { paint1: 0.8, paint0: 0.42, pencil: 0.32, erase: 0.08 } : { paint1: 1, paint0: 0.5, pencil: 0.4, erase: 0.05 };
  if (el.scaffold) {
    const up = 1 - span(p, S.paint1, 1), down = span(p, 0, 0.22), k = Math.min(up, down);
    const sc = el.scaffold, on = k > 0.002;
    sc.visible = on;
    if (on) {
      sc.userData.frame.scale.y = Math.max(0.001, smooth(k)); sc.userData.frame.position.y = -0.3 * (1 - smooth(k));
      sc.userData.stakes.visible = p < 0.97 && p > 0.04;
    }
  }
  let st;
  if (p >= S.paint1) st = 'done';
  else if (p > S.paint0) st = 'paint';
  else if (p > S.pencil) st = 'pencil';
  else if (p > S.erase) st = 'erase';
  else st = 'gone';
  if (st === 'done') { if (el.state !== 'done') { r.done(); el.state = 'done'; } return; }
  if (st === 'paint') {
    if (el.state !== 'paint') { r.setSketch(1); el.state = 'paint'; }
    r.setPaint(smooth((p - S.paint0) / (S.paint1 - S.paint0))); return;
  }
  if (st === 'pencil') { if (el.state !== 'pencil') { r.setSketch(1); el.state = 'pencil'; } return; }
  if (st === 'erase') { r.setSketch((p - S.erase) / (S.pencil - S.erase)); el.state = 'erase'; return; }
  if (el.state !== 'gone') { r.hide(); el.state = 'gone'; }
}

// ================= smoke, sails, boats: the animation clock runs them (backwards in the rewind) =================
// the plume's envelope: a lathe that widens as it rises, sheared downwind exactly as the puffs drift (setChimneys)
const PLUME_RISE = u => u * 11 + u * u * 5, PLUME_DRIFT = u => u * u * 9;
function plumeProxy() {
  const prof = [[0.3, 0], [0.9, 1.5], [1.6, 4], [2.3, 7.5], [2.8, 11], [2.6, 14], [1.6, 15.6], [0.2, 16.2]].map(([r, y]) => new THREE.Vector2(r, y));
  const g = new THREE.LatheGeometry(prof, 18), P = g.attributes.position;
  for (let i = 0; i < P.count; i++) {
    const h = Math.max(0, P.getY(i)), u = Math.min(1, (-11 + Math.sqrt(121 + 20 * h)) / 10), d = PLUME_DRIFT(u);
    P.setX(i, P.getX(i) - d * 0.35); P.setZ(i, P.getZ(i) - d * 0.9);
  }
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial()); m.userData.agoraLine = true;
  return m;
}
function setChimneys(a, t) {
  for (const ch of chimneys) {
    const live = ch.el.state === 'done' ? 1 : ch.el.state === 'paint' ? 0.5 : 0;
    { const i = ctx.lineOnly.indexOf(ch.proxy); if (live >= 1 && i < 0) ctx.lineOnly.push(ch.proxy); else if (live < 1 && i >= 0) { ctx.lineOnly.splice(i, 1); ch.proxy.visible = false; } }
    const life = 4.2, n = ch.puffs.length;
    ch.puffs.forEach((p, k) => {
      const u = ((a / life + k / n + ch.seed) % 1 + 1) % 1;          // age 0 (in the stack) .. 1 (gone up)
      const j = hash1(k * 7.1 + ch.seed * 13), j2 = hash1(k * 3.3 + ch.seed * 5);
      const rise = PLUME_RISE(u), drift = PLUME_DRIFT(u);
      // overlapping soft puffs inside the envelope, wandering a little off the axis; the breeze carries them out to sea
      p.position.set(ch.c.x - drift * 0.35 + (j - 0.5) * 1.6 * u + Math.sin(a * 0.6 + k) * 0.25 * u, ch.top + rise, ch.c.z - drift * 0.9 + (j2 - 0.5) * 1.4 * u);
      const s = (0.7 + u * 1.9) * (0.75 + 0.45 * j) * Math.sin(Math.min(1, u * 1.25) * Math.PI * 0.5 + 0.0001) * (1 - smooth((u - 0.72) / 0.28)) * live;
      p.scale.set(Math.max(0.001, s * 1.15), Math.max(0.001, s * 0.78), Math.max(0.001, s));
      p.visible = s > 0.01;
    });
  }
}
const boats = [];
function buildBoats() {
  // canoes and little craft on the bay, criss-crossing (the rewind sails them backwards)
  const lanes = [[-40, -36, 30, -40], [40, -44, -20, -47], [-10, -54, 50, -58], [-50, -48, 10, -32], [30, -34, -30, -30]];
  lanes.forEach((L, i) => {
    const obj = lib.create('canoe', { variant: i % 3, rot: 0 });
    obj.position.set(L[0], SEA_Y, L[1]); scene.add(obj);
    boats.push({ obj, L, ph: hash1(i * 5.3), sp: 0.05 + 0.02 * hash1(i), b: 0.55 + 0.08 * i });
  });
}
function setBoats(a, D) {
  boats.forEach(bt => {
    const [x0, z0, x1, z1] = bt.L, u = ((a * bt.sp + bt.ph) % 1 + 1) % 1, k = 1 - Math.abs(u * 2 - 1);   // back and forth
    bt.obj.position.set(lerp(x0, x1, k), SEA_Y + Math.sin(a * 1.3 + bt.ph * 9) * 0.05, lerp(z0, z1, k));
    const dir = u < 0.5 ? 1 : -1;
    bt.obj.rotation.y = Math.atan2((x1 - x0) * dir, (z1 - z0) * dir);
    const g = clamp((D - bt.b) / 0.04, 0, 1);
    bt.obj.visible = g > 0.01; bt.obj.scale.setScalar(Math.max(0.001, smooth(g)));
  });
}

// ================= the folk: ours (flits + floaties) and the neighbours' peoples =================
const crowd = [];
const identity = createIdentity(ctx, folk, null);
const poser = createPoser(ctx, folk);
const KNOWN = ['flit', 'floatie', 'puffer', 'loaf', 'drop', 'scoot', 'pip'];
// walking rigs for the five neighbour species (the reference's own leg anchors, folk.js), as pure functions of the pose
const RIG = {
  puffer: { body: () => 0.13 + 0.34 * 0.95, hip: (f, by) => V(f.sd * 0.1, by - 0.34 * 0.95 + 0.06, 0), spread: 0.12, lift: 0.065, stride: 0.07, speed: 0.75 },
  drop: { body: a => a.LH, hip: (f, by) => V(f.sd * 0.09, by + 0.05, 0), spread: 0.1, lift: 0.06, stride: 0.07, speed: 0.7 },
  scoot: { body: a => a.LH, hip: (f, by) => V(f.sd * 0.11, by + 0.06, f.fz || 0), spread: 0.11, lift: 0.045, stride: 0.05, speed: 0.65, quad: true },
  pip: { body: a => a.LH + 0.226, hip: (f, by) => V(f.sd * 0.09, by - 0.17, 0), spread: 0.09, lift: 0.055, stride: 0.07, speed: 0.9 },
  loaf: { body: a => a.LH, hip: (f, by) => V(f.sd * 0.12, by + 0.05, 0), spread: 0.12, lift: 0, stride: 0, speed: 0.8, hop: true }
};
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
// one neighbour walking: s = distance walked along its heading (it may run backwards), moving 0..1
function poseWalker(r, P) {
  const a = r.a, rig = RIG[r.species], sc = a.sc || a.root.scale.x, gy = P.gy;
  const ph = P.s / Math.max(0.05, (rig.stride || 0.07) * 4 * sc) * Math.PI;
  a.heading = P.heading; a.pos.set(P.x, 0, P.z);
  const side = V(Math.cos(P.heading), 0, -Math.sin(P.heading)), fwd = V(Math.sin(P.heading), 0, Math.cos(P.heading));
  if (rig.hop) {
    const hp = Math.abs(Math.sin(ph * 0.5)) * P.moving, hopY = hp * 0.26 * sc;
    a.root.position.set(P.x, gy + hopY, P.z); a.root.rotation.set(0, P.heading, 0);
    const sq = P.moving ? (hp < 0.15 ? 0.8 : 1.1 - 0.2 * hp) : 1 + Math.sin(P.t * 1.9 + r.i) * 0.02;
    a.body.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq)); a.body.position.y = a.LH;
    a.legs.forEach(f => f.pos.set(P.x + side.x * f.sd * 0.12 * sc, 0, P.z + side.z * f.sd * 0.12 * sc));
    legsTo(a, f => rig.hip(f, a.body.position.y), () => Math.max(0, hopY + (a.LH * 0.05) * sc), gy);
    if (a.smile) a.smile.visible = hopY < 0.04; if (a.oMouth) a.oMouth.visible = hopY >= 0.04;
  } else {
    const by = rig.body(a);
    const bob = Math.abs(Math.sin(ph)) * 0.02 * P.moving;
    a.root.position.set(P.x, gy, P.z); a.root.rotation.set(0, P.heading, 0);
    a.body.position.set(0, by + bob, 0);
    a.body.rotation.set(0.08 * P.moving, 0, Math.sin(ph) * 0.06 * P.moving + (1 - P.moving) * Math.sin(P.t * 0.9 + r.i) * 0.03);
    a.legs.forEach((f, i) => {
      const psi = ph + ((rig.quad ? (i === 1 || i === 2) : i % 2) ? Math.PI : 0);
      const off = Math.sin(psi) * rig.stride * sc * P.moving;
      f.pos.set(P.x + side.x * f.sd * rig.spread * sc + fwd.x * ((f.fz || 0) * sc + off), 0, P.z + side.z * f.sd * rig.spread * sc + fwd.z * ((f.fz || 0) * sc + off));
      f.lift = Math.max(0, Math.cos(psi)) * rig.lift * sc * P.moving;
    });
    legsTo(a, f => rig.hip(f, a.body.position.y), f => f.lift, gy);
    if (a.arms) a.arms.forEach((arm, j) => { const sd = j === 0 ? -1 : 1; arm.rotation.x = sd * Math.sin(ph) * 0.5 * P.moving; });
  }
  if (a.blob) { a.blob.position.set(P.x, gy + 0.015, P.z); a.blob.scale.setScalar(sc * 0.8); }
  if (a.eyes) a.eyes.forEach(e => e.scale.y = poser.blinkAt(P.t, r.i * 1.3) ? 0.12 : 1);
}
// lift a flier posed on y = 0 (shot.js poser) onto the relief
function lift(a, gy) {
  if (!gy) return;
  a.root.position.y += gy;
  (a.legs || []).forEach(l => { l.leg.position.y += gy; l.foot.position.y += gy; });
  if (a.blob) a.blob.position.y += gy;
}
// the painter shows every folk in its own passes (post.js limbVis / folkVis), so a folk that has left is PARKED far
// below the land (root, legs, blob), never just hidden
function setShown(a, on) {
  if (on) return;
  a.root.position.set(0, -4000, 0); a.root.updateMatrixWorld(true);
  (a.legs || []).forEach(l => { l.leg.position.set(0, -4000, 0); l.foot.position.set(0, -4000, 0); });
  if (a.blob) a.blob.position.set(0, -4000, 0);
}

// routes: stretches of the town's streets (walkers), circuits in the air over the landmarks (fliers)
function streetStretch(i) {
  const C = plan.centre;
  const roads = plan.roads.filter(rd => rd.kind === 'road' && rd.pts.length > 8 && rd.pts.some(([x, z]) => Math.hypot(x - C.x, z - C.z) < 48));
  // two in five walk the waterfront and the market (the opening frames), the rest anywhere in town
  const harbour = hash1(i * 0.91 + 0.2) < 0.4;
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
  return { pts: out, cum, L: cum[cum.length - 1], b: (rd.b0 + rd.b1) / 2 };
}
function along(route, s) {
  const L = route.L, m = ((s % (2 * L)) + 2 * L) % (2 * L), back = m > L, d = back ? 2 * L - m : m;   // there and back again
  let k = 1; while (k < route.cum.length - 1 && route.cum[k] < d) k++;
  const u = (d - route.cum[k - 1]) / Math.max(1e-4, route.cum[k] - route.cum[k - 1]);
  const [ax, az] = route.pts[k - 1], [bx, bz] = route.pts[k];
  let h = Math.atan2(bx - ax, bz - az); if (back) h += Math.PI;
  return { x: lerp(ax, bx, u), z: lerp(az, bz, u), heading: h };
}

function buildCrowd() {
  townExtra = extendFolk(ctx, folk);   // the townsfolk (agents/species-extra.js): folk.make.twinkle / glim / moth + pure poses
  // ours: the fliers (flits, floaties) and the townsfolk companies (nine each of loaves, twinkles, glims, moths: the
  // game's own population, sim/society.js); the neighbours' peoples (puffers, drops, pips, scoots) as visitors
  const MIX = [['flit', 22], ['floatie', 18], ['puffer', 6], ['drop', 5], ['pip', 4], ['scoot', 4]];
  for (const sp of TOWN) if (folk.make[sp]) MIX.push([sp, 9]);
  const TRADES = ['builder', 'farmer', 'baker', 'trader', 'courier', 'scholar', 'crafter', 'diplomat'];
  const counts = {};
  let i = 0;
  const C = plan.centre;
  for (const [sp, n] of MIX) for (let k = 0; k < n; k++, i++) {
    let a; try { a = folk.make[sp](counts[sp] = (counts[sp] || 0) + 1); } catch (e) { console.warn('[t6] make', sp, e); continue; }
    if (!a || !a.root) continue;
    a.controlled = true; a.driven = true;
    if (!a.sc) a.sc = a.root.scale.x;
    const rec = { a, species: sp, id: 't6-' + i, sim: { id: 't6-' + i, name: 'folk' + i, trade: TRADES[i % TRADES.length] }, i };
    if (sp === 'flit' || sp === 'floatie' || TOWN.includes(sp)) { try { identity.dress(rec); } catch (e) { console.warn('[t6] dress', sp, e); } }
    try { applyColourRule(rec, folk); } catch (e) { /* the rule is additive; never break the crowd */ }
    const ours = sp === 'flit' || sp === 'floatie';
    if (TOWN.includes(sp)) {   // a townsfolk: in the streets while the town stands, then back to its company's square
      const c = TOWN.indexOf(sp), j = counts[sp] - 1, row = Math.floor(j / 3), col = j % 3;
      rec.mode = 'camp'; rec.town = true;
      rec.home = { x: (c - 1.5) * 3.3 + (col - 1) * 0.95, z: 13.6 + (row - 1) * 0.95 };
      rec.route = streetStretch(2000 + i); rec.s0 = hash1(i * 5.7) * 30; rec.speed = 0.75; rec.leave = -1;
      crowd.push(rec); continue;
    }
    if (!ours && !RIG[sp]) { setShown(a, false); continue; }   // a species we cannot walk deterministically: off stage (parked)
    // what this one does: walk a street, fly a circuit, hover at work; when it leaves (D) and how
    const hr = hash1(i * 3.3 + 0.7);
    if (ours && hr < 0.38) {
      const cx = C.x + (hash1(i * 1.9) - 0.5) * 70, cz = C.z + (hash1(i * 2.3) - 0.5) * 60 - 4;
      rec.mode = 'fly'; rec.fly = { cx, cz, r: 5 + hash1(i * 5.1) * 12, y: 5 + hash1(i * 6.7) * 12, sp: (0.25 + hash1(i * 8.3) * 0.3) * (hash1(i * 9.1) < 0.5 ? 1 : -1), ph: hash1(i) * 6.28 };
      rec.leave = 0.35 + hash1(i * 11.3) * 0.55;
    } else {
      rec.mode = 'walk'; rec.route = streetStretch(i); rec.s0 = hash1(i * 13.7) * 40;
      rec.speed = ours ? 0.7 + hash1(i * 3.9) * 0.4 : RIG[sp].speed * (0.85 + hash1(i * 3.9) * 0.3);
      rec.leave = ours ? 0.25 + hash1(i * 11.3) * 0.6 : 0.45 + hash1(i * 11.3) * 0.45;
    }
    crowd.push(rec);
  }
  // the first twelve (six flits, six floaties): they live in the town like everyone else, and as the rewind runs out
  // they walk BACKWARDS to where they first landed by the spawn and stay there: the land ends empty but for them,
  // exactly as on the day they arrived
  const flits = crowd.filter(r => r.species === 'flit'), floats = crowd.filter(r => r.species === 'floatie');
  const first = []; for (let k = 0; k < 6; k++) { if (flits[k]) first.push(flits[k]); if (floats[k]) first.push(floats[k]); }
  first.forEach((r, k) => {
    const ring = k < 5 ? 0 : 1, n = ring ? first.length - 5 : 5, j = ring ? k - 5 : k;
    const a = (j / n) * Math.PI * 2 + ring * 0.4 + 0.2, d = ring ? 3.4 : 1.6;
    r.mode = 'camp'; r.home = { x: CAMP.x + Math.cos(a) * d * 1.15, z: CAMP.z + Math.sin(a) * d * 0.85 };
    r.route = streetStretch(1000 + k); r.s0 = hash1(k * 5.7) * 30; r.speed = 0.8; r.leave = -1;
  });
}

// a floatie's hover: its standing height plus half a metre or so, bobbing (root height for poser.floatie air)
const floatY = (A, c, i) => (0.32 + 0.82 * Math.cos(0.3)) * A.sc + 0.45 + 0.18 * Math.sin(c * 1.3 + i * 1.7) + 0.06 * Math.sin(c * 3.1 + i);
const CAMP = { x: 0, z: 9 }, CAMP_LOOK = { x: 2, z: 34 };
const TOWN = ['loaf', 'twinkle', 'glim', 'moth'];
let townExtra = null;
// a townsfolk at (x, z) on the relief: s = distance walked (gait), moving 0..1
function poseTown(r, x, z, heading, s, moving, gy, t, blink) {
  const a = r.a, sc = a.sc || a.root.scale.x, pose = townExtra && townExtra.pose[r.species];
  if (!pose) return;
  if (r.species === 'loaf') {
    const g = hopGait(Math.max(0, s), 0.52 * sc, sc);
    pose(a, { x, z, heading, hop: g.hop * moving, squash: moving ? g.squash : 1, lift: moving ? g.lift : 1, air: g.air && moving > 0.5, tip: g.tip * moving, blink, t, y: gy });
  } else pose(a, { x, z, heading, stride: strideOf(r.species, Math.abs(s), sc), w: moving, blink, t, y: gy });
}
const lerpAngle = (a, b, u) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * u;
// the heading a first-comer had when it reached home (the direction it walked in from, backwards): from its route at D = 0.045
function away0(r, H) {
  if (r.away0 === undefined) { const P = along(r.route, r.s0 + clockAt(tAtDev(0.045)) * r.speed); r.away0 = Math.atan2(P.x - H.x, P.z - H.z); }
  return r.away0;
}
function tAtDev(d) { let lo = 0, hi = T.settle; for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (devAt(m) > d) lo = m; else hi = m; } return (lo + hi) / 2; }
function setCrowd(t, a, D) {
  const camY = camera.position.y;
  for (const r of crowd) {
    const A = r.a, ours = r.species === 'flit' || r.species === 'floatie';
    const e = r.leave < 0 ? 0 : clamp((r.leave - D) / Math.min(0.06, r.leave), 0, 1);   // 0 here .. 1 gone (the first twelve never leave)
    if (e >= 0.999) { setShown(A, false); continue; }
    const blink = poser.blinkAt(t, r.i * 1.7);
    if (r.mode === 'walk') {
      const s = r.s0 + a * r.speed, P = along(r.route, s);
      const gy = world.groundY(P.x, P.z);
      if (ours) {
        // ours leave by flying: they hop up off the street and climb away into the sky (their arrival, reversed)
        const up = e > 0 ? 3 + 70 * e * e : 0;
        const hop = Math.abs(Math.sin(s * 3.2)) * 0.12;
        if (r.species === 'flit') {
          if (up > 0) poser.flit(A, { x: P.x, z: P.z, heading: P.heading, y: up + 0.6, air: true, prop: t * 40, pitch: -0.2, blink, t });
          else poser.flit(A, { x: P.x, z: P.z, heading: P.heading, hop, pitch: 0.06, prop: a * 6, blink, t });
        } else {
          // floaties never walk here: they drift along the street under their parasols, bobbing just above the ground
          // (t1-reception's grammar: air, airK 1, a slow spin), backwards when the tape runs backwards
          poser.floatie(A, { x: P.x, z: P.z, heading: P.heading, y: floatY(A, a, r.i) + up, air: true, airK: 1, spin: a * 0.35 + r.i, swx: 0.05 * Math.sin(a * 0.9 + r.i), blink, t });
        }
        lift(A, gy);
      } else {
        poseWalker(r, { x: P.x, z: P.z, heading: P.heading, s: s, moving: 1, gy, t });
        // the neighbours' peoples shrink away into the distance (they are specks from the high camera by then)
        if (e > 0) { const k = Math.max(0.001, 1 - e); A.root.scale.setScalar(A.sc * k); A.legs.forEach(l => { l.leg.visible = k > 0.4; l.foot.visible = k > 0.4; }); }
        else if (A.root.scale.x !== A.sc) A.root.scale.setScalar(A.sc);
      }
    } else if (r.mode === 'fly') {
      const F = r.fly, ang = F.ph + a * F.sp, x = F.cx + Math.cos(ang) * F.r, z = F.cz + Math.sin(ang) * F.r;
      const heading = Math.atan2(-Math.sin(ang) * Math.sign(F.sp), Math.cos(ang) * Math.sign(F.sp));
      const y = world.groundY(x, z) + F.y + Math.sin(a * 1.3 + F.ph) * 0.6 + 70 * e * e;
      if (r.species === 'flit') poser.flit(A, { x, z, heading, y, air: true, prop: t * 40, pitch: 0.15, bank: -0.25 * Math.sign(F.sp), blink, t });
      else poser.floatie(A, { x, z, heading, y, air: true, airK: 1, spin: t * 0.6, swz: 0.1 * Math.sign(F.sp), blink, t });
    } else if (r.mode === 'camp') {
      // in town while it stands; walking backwards home as it empties (D 0.2 -> 0.045); then standing, looking round
      const H = r.home, s = r.s0 + a * r.speed, P = along(r.route, s);
      const k = smoother(span(D, 0.2, 0.045));
      const x = lerp(P.x, H.x, k), z = lerp(P.z, H.z, k), gy = world.groundY(x, z);
      const away = Math.atan2(x - H.x, z - H.z);                    // walking home backwards: facing away from home
      const look = Math.atan2(CAMP_LOOK.x - H.x, CAMP_LOOK.z - H.z) + Math.sin(t * 0.45 + r.i * 1.3) * 0.35;
      const home = k >= 0.999, settle = smoother(span(D, 0.045, 0.0));
      let heading = k <= 0 ? P.heading : home ? lerpAngle(away0(r, H), look, settle) : away;
      const moving = !home || settle < 1;
      const hop = home ? 0 : Math.abs(Math.sin(s * 3.2)) * 0.12;
      if (r.town) { poseTown(r, x, z, heading, s, home ? 0 : 1, gy, t, blink); continue; }
      if (r.species === 'flit') poser.flit(A, { x, z, heading, hop, pitch: home ? 0.04 * Math.sin(t * 0.9 + r.i) : 0.06, prop: home ? t * 2 : a * 6, blink, t });
      else poser.floatie(A, { x, z, heading, y: floatY(A, home ? t : a, r.i), air: true, airK: 1, spin: home ? t * 0.2 + r.i : a * 0.35 + r.i, wave: home ? 0.15 + 0.15 * Math.sin(t * 1.7 + r.i) : 0, blink, t });
      lift(A, gy);
    }
    if (r.idn) identity.step(r, 0, t);
  }
}

// ================= the camera: low over the harbour, a crane up into a high sweep, a descent as it empties =================
// eye / look in world metres (the sea is north, -z; the sun comes from the west)
const track = cameraTrack([
  // the rocket first (Sueda: "first the rocket, then the city"): from the quay, low over the water, looking OUT to
  // sea, so the rocket on its pad stands against the sea and the dusk sky with the city behind the camera
  // the rocket first (Sueda: "bring back the old rocket view but slower"): low over the water by the quay, looking OUT
  // to sea, the rocket on its pad against the dusk sky and the sea, the city behind the camera
  { t: 0.0, pos: [1, 6.5, -30], look: [22, 11.5, -52], fov: 46 },
  { t: 3.0, pos: [2.5, 6.8, -31.5], look: [22, 11.5, -52], fov: 46 },    // a slow push in; the tape stops on it
  { t: 6.4, pos: [4, 7.6, -33], look: [22, 9, -52], fov: 46 },           // held while the rocket un-builds (scaffold, pencil, gone), slowly
  { t: 7.8, pos: [-4, 40, -40], look: [12, 0, -6], fov: 41 },          // up and back over the quay (clear of the pad): the city is revealed           // then out past the empty pad and round: the city is revealed
  { t: 9.6, pos: [46, 70, -46], look: [6, 0, 6], fov: 41 },              // rising over the harbour as the city follows
  { t: 11.4, pos: [40, 122, 118], look: [-6, 0, 8], fov: 42 },         // the high sweep over the whole land
  { t: 13.2, pos: [-80, 108, 92], look: [-14, 0, 8], fov: 42 },
  { t: 15.9, pos: [-34, 44, 62], look: [-3, 0, 10], fov: 40 },         // descending as it empties
  { t: 18.2, pos: [1.5, 13.2, 25.8], look: [0, 1.2, 10.8], fov: 38 },  // down to the first folk, as on the day they arrived
  { t: 20.0, pos: [2.0, 12.8, 25.2], look: [0, 1.2, 10.8], fov: 38, linearPath: true }   // a calm hold on them (linear: no spline overshoot)
].map(k => ({ ...k, t: k.t * TS })));
const _e = new THREE.Vector3(), _l = new THREE.Vector3();
const CAM_Q = q.has('cam') ? q.get('cam').split(',').map(Number) : null;   // look-dev: ?cam=ex,ey,ez,lx,ly,lz[,fov]
function placeCamera(t) {
  let fov = track(t, _e, _l);
  if (CAM_Q) { _e.set(CAM_Q[0], CAM_Q[1], CAM_Q[2]); _l.set(CAM_Q[3], CAM_Q[4], CAM_Q[5]); fov = CAM_Q[6] || fov; }
  world.rig.setPose(poseFromEyeLook(_e, _l, fov));
}

// ================= one frame =================
let lastA = null;
// look-dev: ?camAt=9.5 holds the camera at that instant's pose; ?dev=0.7 forces the development
const CAM_AT = q.has('camAt') ? +q.get('camAt') : null, DEV = q.has('dev') ? +q.get('dev') : null;
const PROF = q.has('prof') ? {} : null;
const lap = (k, t0) => { if (PROF) PROF[k] = (PROF[k] || 0) + performance.now() - t0; return performance.now(); };
function render(t) {
  const a = clockAt(t), D = DEV ?? devAt(t);
  let t0 = performance.now();
  placeCamera(CAM_AT ?? t);
  setDusk(q.has('day') ? 0 : dusk(CAM_AT ?? t));
  for (const ch of chunks) if (D < ch.bMax) setChunk(ch, false);   // a cell that starts to un-build: back to its objects
  for (const el of els) setEl(el, D);
  for (const ch of chunks) if (D >= ch.bMax) setChunk(ch, true);   // a cell that stands whole: its merged meshes
  t0 = lap('els', t0);
  setTrees(D);
  t0 = lap('trees', t0);
  // the land's colour: fully painted while the town stands, draining back toward the first camp
  world.setWorldBloom(D > 0.45 ? 1 : 0.92 * smooth(span(D, 0.05, 0.45)));
  // every prefab's own motion (sails, smoke, bobbing ducks) on the story clock: backwards in the rewind
  for (const el of els) if (el.state === 'done' && (el.kind === 'lib' || el.kind === 'asset')) lib.animate(el.obj, a);
  setChimneys(a, t);
  setBoats(a, D);
  t0 = lap('anim', t0);
  setCrowd(t, a, D);
  t0 = lap('crowd', t0);
  world.beforeDraw(t);
  t0 = lap('world', t0);
  painter.renderPainted();
  lap('paint', t0);
}
mountShot({ duration: DUR, render, ready, marks: { living: [0, T.stop], rocket: [T.stop, 7.4 * TS], rewind: [T.stop, T.settle], empty: [T.settle, DUR] } });
// the Gouache look lab: G toggles, ?lab=1 opens; a change repaints the held frame (playback repaints by itself)
const lab = mountLookLab(painter, { key: 't6', onChange: () => { const S = window.__shot; if (S && (S.done || q.has('hold') || q.has('t'))) S.seek(S.t); } });
window.__t6 = { lab,  ctx, world, plan, els, lib, camera, painter, crowd, devAt, clockAt, T, PROF };
