// ALOUD trailer, beats t1 + t2: the RECEPTION and the LAUNCH at the Red arch at sundown.
// Sueda's Red arch, verbatim (web/js/paint/*: the reference build order, so the terrace, pool, wall, pines and sky
// are the painting itself), with our twelve folk (6 flits + 6 floaties, dressed by agents/identity.js) gathered on the
// far terrace with paper lanterns, facing the sea, and the townsfolk marching in as five squares of nine (arrivals.js:
// twinkles, glims, loaves, moths in their species' uniforms, and her plain floaties), halting in a row before the sea. Beyond the arch, on its stone sea platform, the rocket (the stock
// plans web/js/buildings/examples/launch-platform.js + rocket.js, compiled through the Build API at runtime: the
// very same code the Ministry of Builds draws).
//   0.0 - 1.2  the match-cut frame: her painting's own camera
//   1.2 - 7.6  a slow crane in, through the arch and under the pines, to the crowd's shoulders
//   7.6 - 9.0  held: the swing arms fold away; a couple of folk glance back at us
//   9.0        ignition: a painted plume, steam rolling out of the trench arches over the water
//  11.0        lift-off: the folk look up, hop and wave; the camera tilts up after it into the dusk sky
// Fixed clock (shot.js): window.__shot.seek(t) renders any instant; ?t=4.5 for a still.
import { createRenderer, createContext } from '../paint/context.js';
import { createKit } from '../paint/kit.js';
import { createBackdrop } from '../paint/backdrop.js';
import { buildRedArch, referenceNav, camBase, lookBase } from '../paint/redArch.js';
import { createFolk } from '../paint/folk.js';
import { createPainter } from '../paint/post.js';
import { createBuildApi, compileAsset } from '../buildings/api.js';
import { createIdentity } from '../agents/identity.js';
import { createPlume } from './plume.js';
import { createArrivals } from './arrivals.js';
import { applySavedLook, mountLookLab } from './look-lab.js';
import { mountShot, cameraTrack, createPoser, clamp, lerp, smooth, smoother, easeInOut, easeIn, span, hash1 } from './shot.js';

const q = new URLSearchParams(location.search);
const T = { craneA: 1.2, craneB: 7.6, arms: 7.9, ignite: 9.0, lift: 11.0, rev0: 13.3, rev1: 16.1, end: 22.0 };
const SEA_Y = -0.9;
const FIRE = new THREE.Color('#ffb65a');
const PAD = { x: -0.4, z: -70 };            // the pit, in line with the sun and the pool

// ---------- the Red arch, in the reference's order ----------
const renderer = createRenderer();
// paint settings rule (TRAILER.md): her reference's pixel ratio, min(dpr, 2), canvas sized to the window;
// ?w=&h=&dpr= for recording (e.g. ?w=1920&h=1080&dpr=2 paints 3840x2160 exactly as on her Retina screen)
const DPR = q.has('dpr') ? +q.get('dpr') : Math.min(window.devicePixelRatio || 1, 2);
renderer.setPixelRatio(DPR);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.5, 1400);
camera.position.copy(camBase); camera.lookAt(lookBase);
const ctx = createContext({ renderer, scene, camera, seed: 11 });
const { V } = ctx;
const kit = createKit(ctx);
const backdrop = createBackdrop(ctx, { camBase });
const arch = buildRedArch(ctx, kit);
const folk = createFolk(ctx, backdrop, referenceNav(ctx));

// ---------- our twelve: 6 flits + 6 floaties, by trade ----------
const TRADES = ['builder', 'farmer', 'baker', 'trader', 'courier', 'courier', 'scholar', 'baker', 'farmer', 'crafter', 'diplomat', 'builder'];
const NAMES = ['Pell', 'Orzo', 'Mimi', 'Tamsin', 'Bruno', 'Liesl', 'Caper', 'Nell', 'Sorrel', 'Fig', 'Juno', 'Pip'];
// the far end of the terrace (z -11.6 .. -14: the pool stops at -11.6) belongs to the four squares of townsfolk
// (arrivals.js, x -3.6 .. 4.8); our fliers keep the air over them (floaties under their parasols, flits hovering),
// and a few stand on the flanks. hover = a flier that keeps to the air over the crowd
const SPOTS = [
  { sp: 'flit', x: -8.5, z: -12.4 }, { sp: 'floatie', x: 6.4, z: -13.4, hover: 4.6 }, { sp: 'flit', x: 8.6, z: -12.3 },
  { sp: 'floatie', x: -2.5, z: -13.1, hover: 3.35 }, { sp: 'flit', x: 1.9, z: -12.7, hover: 2.3 }, { sp: 'floatie', x: 3.6, z: -13.3, hover: 3.9 },
  { sp: 'flit', x: 6.1, z: -12.9, hover: 2.6 }, { sp: 'floatie', x: -4.6, z: -13.5, hover: 4.1 }, { sp: 'flit', x: -1.9, z: -12.3, hover: 2.55 },
  { sp: 'floatie', x: 5.6, z: -12.1, hover: 3.5 }, { sp: 'flit', x: 3.3, z: -12.2, hover: 2.05 }, { sp: 'floatie', x: -5.4, z: -12.2, hover: 3.3 }
];
const counts = { flit: 0, floatie: 0 };
const crowd = SPOTS.map((s, i) => {
  const a = folk.make[s.sp](counts[s.sp]++);
  a.controlled = true; a.driven = true;
  return { a, species: s.sp, id: 'trailer-' + i, sim: { id: 'trailer-' + i, name: NAMES[i], trade: TRADES[i] }, spot: s, i };
});
const identity = createIdentity(ctx, folk, null);
crowd.forEach(r => { try { identity.dress(r); } catch (e) { console.warn('[t1] dress', e); } });

// ---------- paper lanterns on poles at the terrace edge ----------
function lantern(x, z, h, hex) {
  const g = new THREE.Group(); g.position.set(x, 0, z); scene.add(g);
  const WOOD = ['#432b1b', '#634028', '#865c38', '#a2764b'];
  const pole = new THREE.Mesh(kit.bake(new THREE.CylinderGeometry(0.035, 0.045, h, 8).translate(0, h / 2, 0), WOOD), kit.paintMat);
  const arm = new THREE.Mesh(kit.bake(new THREE.BoxGeometry(0.5, 0.04, 0.04).translate(0.22, h - 0.06, 0), WOOD), kit.paintMat);
  const glowCols = hex === 'red' ? ['#b8382a', '#e0603f', '#f4935a', '#ffc98a'] : ['#e8a058', '#f6c47c', '#ffe2a8', '#fff3d2'];
  const globeGeo = new THREE.SphereGeometry(0.3, 18, 12); globeGeo.scale(1, 1.18, 1); globeGeo.translate(0.42, h - 0.5, 0);
  const globe = new THREE.Mesh(kit.bake(globeGeo, glowCols, 0.12, 0.28), kit.paintMat);
  const capGeo = new THREE.CylinderGeometry(0.11, 0.13, 0.08, 12);
  const capT = new THREE.Mesh(kit.bake(capGeo.clone().translate(0.42, h - 0.13, 0), ['#2e2236', '#3b2c40', '#4a3848']), kit.paintMat);
  const capB = new THREE.Mesh(kit.bake(capGeo.clone().translate(0.42, h - 0.88, 0), ['#2e2236', '#3b2c40', '#4a3848']), kit.paintMat);
  const ribs = [];
  for (let k = -1; k <= 1; k++) {
    const r = new THREE.Mesh(new THREE.TorusGeometry(0.3 * Math.cos(k * 0.55) + 0.006, 0.008, 4, 28), new THREE.MeshBasicMaterial({ color: hex === 'red' ? 0x8a281e : 0xc08a4a }));
    r.rotation.x = Math.PI / 2; r.position.set(0.42, h - 0.5 + k * 0.17, 0); ribs.push(r);
  }
  [pole, arm, globe, capT, capB, ...ribs].forEach(m => { m.castShadow = m !== globe; g.add(m); });
  ribs.forEach(r => ctx.colourOnly.push(r));
  return g;
}
const lanterns = [lantern(-7.9, -13.6, 2.7, 'cream'), lantern(-4.3, -14.0, 2.9, 'red'), lantern(4.7, -14.0, 3.0, 'cream'), lantern(8.1, -13.6, 2.45, 'red'), lantern(9.4, -10.6, 2.75, 'cream')];
lanterns[4].rotation.y = Math.PI;

// ---------- the painter ----------
const painter = createPainter(ctx, folk, { framing: (cam, w, h) => { cam.aspect = w / h; } });
painter.setMode(1);   // Gouache
const FIXED = q.has('w') && q.has('h');
const size = () => FIXED ? [+q.get('w'), +q.get('h')] : [innerWidth, innerHeight];
painter.resize(...size());   // her G_DEFAULT untouched: no paint overrides here
if (!FIXED) addEventListener('resize', () => { painter.resize(...size()); if (window.__shot) window.__shot.seek(window.__shot.t); });
await applySavedLook(painter, 't1');   // her saved trailer look (look.json trailer.t1_*, else her t6 master look)
mountLookLab(painter, { key: 't1', onChange: () => { painter.markDirty(); if (window.__shot) window.__shot.seek(window.__shot.t); } });

// ---------- the rocket and its sea platform: the Ministry's stock plans, compiled at runtime ----------
const api = createBuildApi(ctx, kit, { keyDir: backdrop.KEY_DIR, seed: 1 });
const rig = { plat: null, rocket: null, rocketRoot: null, platRoot: null, arms: [], hatch: null, base: V(0, 0, 0), deckY: 0, nozzleY: 0.48 };
async function loadAsset(name) {
  const src = await (await fetch(new URL(`../buildings/examples/${name}.js`, import.meta.url), { cache: 'no-store' })).text();
  return compileAsset(src, { name })(api);
}
const ready = (async () => {
  const [plat, rocket] = [await loadAsset('launch-platform'), await loadAsset('rocket')];
  const platRoot = plat.children[0], rocketRoot = rocket.children[0];
  const L = platRoot.userData.launch || { deckY: 4.3, waterLine: 1 };
  const k = plat.userData.agora.scaled || 1;
  // the platform floats: its water line sits at wrapper y = 0. Put the pit (build origin) at PAD.
  plat.position.set(PAD.x - platRoot.position.x, SEA_Y, PAD.z - platRoot.position.z);
  scene.add(plat);
  rig.deckY = SEA_Y + platRoot.position.y + L.deckY * k;            // the deck top, in the world
  rig.base.set(PAD.x - rocketRoot.position.x, rig.deckY + 0.15 - rocketRoot.position.y, PAD.z - rocketRoot.position.z);
  rocket.position.copy(rig.base); scene.add(rocket);
  rig.nozzleY = ((rocketRoot.userData.rocket && rocketRoot.userData.rocket.nozzleY) || 0.48) + rocketRoot.position.y;
  plat.traverse(o => { if (o.userData.role === 'arm-low' || o.userData.role === 'arm-high') rig.arms.push({ o, ry: o.rotation.y }); });
  rocket.traverse(o => { if (o.userData.role === 'hatch') rig.hatch = o; });
  Object.assign(rig, { plat, rocket, platRoot, rocketRoot });
  // fire in the flame trench: a ring inside the arcade that glows through the eight arches at ignition
  const fireMat = new THREE.MeshBasicMaterial({ color: 0x2e2236, side: THREE.DoubleSide });
  const fire = new THREE.Mesh(new THREE.CylinderGeometry(5.5 * k, 5.5 * k, 2.5 * k, 40, 1, true), fireMat);
  fire.position.set(PAD.x, SEA_Y + 1.15 * k, PAD.z); scene.add(fire); ctx.colourOnly.push(fire);
  rig.fire = fireMat;
  // the craft's engine cluster (examples/rocket.js: a central bell + one under each nacelle): one flame per engine
  const craft = rocketRoot.userData.craft;
  const nozzles = craft && craft.engines ? craft.engines.map(e => ({ x: e.x, z: e.z, s: e.r / 0.98 })) : undefined;
  plume = createPlume(ctx, { keyDir: backdrop.KEY_DIR, seaY: SEA_Y, pad: { x: PAD.x, z: PAD.z, deckY: rig.deckY }, rocketAt: nozzleAt, tiltAt, tIgnite: T.ignite, tLift: T.lift, tEnd: T.end,
    nozzles, width: nozzles ? 1.6 : 0 });
  window.__t1 = { ctx, rig, crowd, camera, painter, plume, T };
})();
let plume = null;

// the rocket's climb: still on the pad, a shudder at ignition, then a slow heavy lift that keeps accelerating,
// and a gentle gravity turn out over the sea (to the right), so the trail it leaves curves
const climb = t => { const u = Math.max(0, t - T.lift); return 1.0 * u * u + 0.06 * u * u * u; };
const T_TURN = T.lift + 3.5;
const tiltAt = t => 0.5 * smoother(span(t, T_TURN, T.end + 2));
function rocketPos(t, out) {
  out.copy(rig.base);
  const h = climb(t), th = tiltAt(t);
  out.y += h;
  out.x += Math.max(0, h - climb(T_TURN)) * Math.sin(th) * 0.8;
  if (t > T.ignite && t < T.lift + 1.5) { const k = 0.035 * smooth(span(t, T.ignite, T.ignite + 0.6)) * (1 - span(t, T.lift, T.lift + 1.5)); out.x += Math.sin(t * 53) * k; out.z += Math.sin(t * 41 + 1) * k * 0.6; }
  return out;
}
const _n = V(0, 0, 0);
// the nozzle in the world: the wrapper's root offset + the nozzle height, turned with the rocket's lean
function nozzleAt(t) {
  rocketPos(t, _n); const o = rig.rocketRoot.position, th = tiltAt(t);
  return { x: _n.x + o.x * Math.cos(th) + rig.nozzleY * Math.sin(th), y: _n.y + rig.nozzleY * Math.cos(th) - o.x * Math.sin(th), z: _n.z + o.z, th };
}

// ---------- the camera ----------
const P0 = camBase.toArray(), L0 = lookBase.toArray();
const track = cameraTrack([
  { t: 0, pos: P0, look: L0, fov: 50 },
  { t: T.craneA, pos: [-0.4, 3.98, 21.4], look: [-0.1, 7.1, -20], fov: 50, linearPath: true },
  { t: 4.6, pos: [0.2, 3.0, 6.0], look: [-0.3, 5.6, -50], fov: 46, ease: u => u },
  { t: T.craneB, pos: [0.7, 1.8, -2.8], look: [-0.4, 4.6, -70], fov: 48, ease: u => 1 - Math.pow(1 - u, 2.4) },   // the hold: all five squares in frame
  { t: T.ignite, pos: [0.8, 1.75, -3.2], look: [-0.4, 4.5, -70], fov: 47, linearPath: true }
]);
const camPos = V(0, 0, 0), camLook = V(0, 0, 0), rp = V(0, 0, 0);
function shake(t, k) { camPos.x += Math.sin(t * 47) * k; camPos.y += Math.sin(t * 59 + 2) * k; }
function placeCamera(t) {
  let fov;
  rocketPos(t, rp);
  const up = rp.y - rig.base.y;
  if (t <= T.ignite) fov = track(t, camPos, camLook);
  else if (t < T.rev0) {
    // ignition and lift-off, wide, from the crowd's shoulders: a slow push, the aim lifting with the rocket
    const u = span(t, T.ignite, T.rev0);
    camPos.set(lerp(0.8, 1.05, u), lerp(1.75, 1.42, u), lerp(-3.2, -6.6, u));
    camLook.set(PAD.x, 4.5 + up * 0.55, PAD.z);
    fov = lerp(47, 37.5, u);
    shake(t, 0.02 * smooth(span(t, T.ignite, T.ignite + 0.8)));
  } else if (t < T.rev1) {
    // the reverse: low over the water, looking back up at their faces, the Red arch behind them
    const u = smoother(span(t, T.rev0, T.rev1));
    camPos.set(lerp(0.9, 0.35, u), lerp(0.85, 0.95, u), lerp(-21.0, -20.2, u));
    camLook.set(lerp(0.45, 0.15, u), lerp(1.55, 1.75, u), -12);
    fov = lerp(31, 29.5, u);
    shake(t, 0.01 * (1 - u));
  } else {
    // after it: low behind the crowd, tilting up as it climbs into the dusk sky, the pines framing the top
    const u = span(t, T.rev1, T.end), w = smoother(u);
    camPos.set(lerp(0.9, 1.2, w), lerp(1.05, 1.5, w), lerp(-7.6, -8.4, w));
    fov = lerp(54, 50, w);
    const half = THREE.MathUtils.degToRad(fov / 2);
    const dx = rp.x - camPos.x, dz = rp.z - camPos.z, hd = Math.hypot(dx, dz);
    const el = Math.atan2(rp.y + 9 - camPos.y, hd);                      // the rocket's elevation from here
    const c = Math.max(0.08, el - 0.6 * half);                           // keep it in the upper part of the frame
    const yaw = Math.atan2(lerp(PAD.x, rp.x, 0.7) - camPos.x, camPos.z - PAD.z);   // turn a little with its lean
    camLook.set(camPos.x + Math.sin(yaw) * 40, camPos.y + Math.tan(c) * 40, camPos.z - Math.cos(yaw) * 40);
  }
  camera.position.copy(camPos); camera.lookAt(camLook);
  if (camera.fov !== fov) { camera.fov = fov; camera.updateProjectionMatrix(); }
}

// ---------- the folk ----------
const poser = createPoser(ctx, folk);
// the townsfolk's four squares of nine (made after the twelve, so the fliers keep their looks)
const arrivals = createArrivals(ctx, folk, identity, { T, PAD, poser });
window.__t1arr = arrivals;
const TAKEOFF = { 2: T.lift + 1.9, 6: T.lift + 2.4, 0: T.lift + 3.3 };   // ground flits that lift off for joy
// the floaties' flight: where each one drifts during the crane (round the arch, over the pool), then over the crowd
const FLOAT_EARLY = { 1: [4.6, 6.1, 4.2], 3: [-1.8, 5.2, -4.5], 5: [2.6, 6.0, -8.5], 7: [-4.4, 6.5, 3.6], 9: [3.6, 4.6, -2.8], 11: [-3.4, 4.4, -9.5] };
function floatPath(i, s, t) {
  const E = FLOAT_EARLY[i] || [s.x, s.hover, s.z], ph = hash1(i * 7.3) * 6.28;
  const k = smoother(span(t, 0.8 + hash1(i * 1.9) * 1.6, 7.3)), R = lerp(1.1, 0.65, k);
  const crossing = Math.max(0, 1 - Math.abs(lerp(E[2], s.z, k) - 0.9) / 2.5);   // never brush the wall going through the arch
  return {
    x: lerp(E[0], s.x, k) + R * (1 - 0.6 * crossing) * Math.sin(t * 0.42 + ph),
    z: lerp(E[2], s.z, k) + R * 0.7 * Math.cos(t * 0.34 + ph * 1.3),
    y: lerp(E[1], s.hover, k) + 0.22 * Math.sin(t * 0.6 + ph) + 1.2 * smoother(span(t, T.lift + 1.5, T.end))
  };
}
function poseCrowd(t) {
  rocketPos(t, rp);
  const top = rp.y + 12;
  crowd.forEach((r, i) => {
    const a = r.a, s = r.spot, ph = hash1(i * 7.3) * 6.28;
    const toPad = Math.atan2(lerp(PAD.x, rp.x, 0.5) - s.x, PAD.z - s.z);
    // idle: small turns to the neighbours; two of them look back at us as the camera arrives
    let heading = toPad + 0.22 * Math.sin(t * 0.37 + ph) * (1 - span(t, T.ignite, T.ignite + 0.4));
    const glance = (i === 3 || i === 6) ? smooth(span(t, 5.4 + i * 0.12, 6.4 + i * 0.12)) * (1 - smooth(span(t, 8.2, 8.9))) : 0;
    if (glance > 0) { const toCam = Math.atan2(camera.position.x - s.x, camera.position.z - s.z); heading = lerp(heading, toCam + (heading > toCam ? -0.2 : 0.2), glance * 0.92); }
    // after lift-off a few turn to each other in delight
    const share = (i === 1 || i === 4 || i === 7) ? smooth(span(t, T.lift + 3.0 + i * 0.1, T.lift + 3.6 + i * 0.1)) * (1 - smooth(span(t, T.lift + 4.6, T.lift + 5.2))) : 0;
    heading += share * (i === 4 ? -0.9 : 0.9);
    // ignition: a startle (a squash and a small jump), then everyone faces the pad
    const st0 = T.ignite + 0.12 + hash1(i * 3.1) * 0.25, startle = t > st0 ? Math.exp(-(t - st0) * 5) * Math.sin(Math.min(Math.PI, (t - st0) * 9)) : 0;
    // look up as it climbs: the angle from their eyes to the rocket's middle
    const el = Math.atan2(Math.max(0, rp.y - rig.base.y + 9 - (s.hover || 0)), Math.hypot(PAD.x - s.x, PAD.z - s.z));
    const lookUp = smooth(span(t, T.lift + 0.2 + hash1(i) * 0.4, T.lift + 1.6)) * clamp(el * 1.2 + 0.12, 0, 0.5);
    const idleNod = 0.05 * Math.sin(t * 0.9 + ph);
    // celebration: hops after lift-off, in their own rhythm
    const hopOn = span(t, T.lift + 1.0 + hash1(i * 5.7) * 0.8, T.lift + 1.6 + hash1(i * 5.7) * 0.8);
    const hz = 1.5 + hash1(i * 2.2) * 0.5, hp = Math.sin((t - T.lift) * hz * Math.PI * 2 + ph);
    const hopH = hopOn * Math.max(0, hp) ** 1.6 * 0.32 * a.sc;
    const land = hopOn * Math.max(0, -hp) ** 3 * 0.1;
    const blink = poser.blinkAt(t, i * 1.7);
    if (r.species === 'flit') {
      const hov = s.hover || 0, tk = TAKEOFF[i];
      const fly = tk ? smoother(span(t, tk, tk + 1.4)) : 0;
      if (hov || fly > 0) {
        // hovering (or lifting off for joy): the rotor spins, the legs dangle, they climb a little after the rocket
        const y0 = poser.STAND.flit * a.sc;
        const y = hov ? hov + 0.12 * Math.sin(t * 2.4 + ph) + 1.6 * smoother(span(t, T.lift + 1.2, T.end))
          : y0 + fly * (1.3 + hash1(i) * 0.6) + 0.1 * fly * Math.sin(t * 2.4 + ph);
        const spinUp = hov ? 1 : clamp((t - tk + 0.5) / 0.5, 0, 1);
        poser.flit(a, { x: s.x + 0.25 * Math.sin(t * 0.5 + ph) * (hov ? 1 : fly), z: s.z + 0.2 * Math.cos(t * 0.43 + ph) * (hov ? 1 : fly), heading, y, air: true,
          prop: t * 38 * spinUp, pitch: idleNod * 0.5 - lookUp, bank: 0.06 * Math.sin(t * 0.8 + ph), blink, t });
      } else poser.flit(a, { x: s.x, z: s.z, heading, hop: hopH + Math.max(0, startle) * 0.12 * a.sc, squash: 1 - land, pitch: idleNod - lookUp, prop: hopOn * Math.max(0, t - T.lift) * 12, blink, t });
    } else {
      const hov = s.hover || 0;
      const wave = smooth(span(t, T.lift + 0.6 + hash1(i * 4.4) * 0.6, T.lift + 1.2 + hash1(i * 4.4) * 0.6));
      const spin = t * 0.18 + ph;
      if (hov) {
        // flying under the parasol (her original): drifting in slow loops, first round the arch and over the pool in
        // the wide shots, then over the crowd for the hold; the hanging body swings back as it drifts
        const fp = floatPath(i, s, t), fq = floatPath(i, s, t + 0.05), vx = (fq.x - fp.x) / 0.05, vz = (fq.z - fp.z) / 0.05, sp = Math.hypot(vx, vz);
        const drift = clamp(sp / 0.5, 0, 1), hd = heading + Math.atan2(Math.sin(Math.atan2(vx, vz) - heading), Math.cos(Math.atan2(vx, vz) - heading)) * drift * 0.85;
        poser.floatie(a, { x: fp.x, z: fp.z, heading: hd, y: fp.y, air: true, airK: 1, spin: spin + t * 0.4, wave, pitch: -lookUp * 0.7,
          swx: 0.12 * drift + 0.05 * Math.sin(t * 0.9 + ph), swz: 0.06 * Math.sin(t * 0.7 + ph), blink, t });
      }
      else poser.floatie(a, { x: s.x, z: s.z, heading, hop: hopH * 0.6 + Math.max(0, startle) * 0.08 * a.sc, squash: 1 - land * 0.8, spin, wave, pitch: -lookUp * 0.8 + idleNod * 0.5, swx: startle * 0.12, blink, t });
    }
    if (r.idn) identity.step(r, 1 / 30, t);
  });
}

// ---------- the timeline ----------
function render(t) {
  placeCamera(t);
  if (rig.rocket) {
    rocketPos(t, rp); rig.rocket.position.copy(rp); rig.rocket.rotation.z = -tiltAt(t);
    const fold = smoother(span(t, T.arms, T.arms + 1.0));
    rig.arms.forEach((m, j) => { m.o.rotation.y = m.ry + fold * (j ? 1.25 : -1.1); });
  }
  if (plume) {
    plume.update(t);
    const h = plume.heat(t) * (1 - 0.7 * span(t, T.lift + 2, T.lift + 6)), fl = 0.88 + 0.12 * Math.sin(t * 31) * Math.sin(t * 13.7);
    rig.fire.color.set(0x2e2236).lerp(FIRE, clamp(h * fl, 0, 1));
  }
  poseCrowd(t);
  arrivals.pose(t, rig.rocket ? rp.y - rig.base.y : 0);
  backdrop.update(t); arch.update(t);
  painter.renderPainted();
}
const duration = +(q.get('dur') || T.end);
mountShot({ duration, render, ready, marks: { matchCut: 0, crane: [T.craneA, T.craneB], hold: [T.craneB, T.ignite], ignite: T.ignite, lift: T.lift, reception: [0, T.ignite], launch: [T.ignite, T.rev0], faces: [T.rev0, T.rev1], climb: [T.rev1, T.end] } });
