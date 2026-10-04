// The painted globe: the world's flat layout (geography.js) wrapped onto a planet with Tower Planet's
// mapFlat, painted in the Red arch grammar and rendered THROUGH the Red arch paint engine (web/js/paint/:
// Riso / Gouache / Raw editions, held frames, warped Kuwahara, pencil keylines from smooth proxies).
//
//   import { createGlobe } from './js/globe/globe.js';
//   const globe = createGlobe({ renderer?, canvas?, onReady, edition: 1, autoSpin: true, water: game.state.water });
//   globe.start(); globe.painter.setMode(0|1|2);
//   await globe.dive('home');  // swoop to the low oblique view the gouache map starts from (globe.diveView('home'))
//   await globe.rise(); await globe.flyToMoon(); globe.setHomeGrowth(0.4); globe.setNationGrowth('n2', 1);
//
// Nothing in web/js/paint is edited: the globe makes its own context / kit / painter, passes the painter an
// empty folk, and drives renderWorld / renderFolk / composite itself (no folk = nothing to redraw between
// held frames).

import { GEO, PLOT, places as GP, reliefAt as mapHeightAt, landWeightsSoft as landWeights, homeWeight, GLOWS, CAMP, flatToSphere, frameAt, MOON as MOONGEO, homeSpots, placeById, setWater, fbm2, inPlot, distOutsidePlot } from './geography.js';
import { createContext } from '../paint/context.js';
import { createKit } from '../paint/kit.js';
import { createPainter } from '../paint/post.js';
import { buildRedArch } from '../paint/redArch.js';
import { createTownKit, buildNation, buildHomeBuilding } from './towns.js';
import { buildBody, makeBodyMaterial, makeRamps, paintValue, hashI } from './terrain.js';
import { createSpace } from './space.js';

const EASE = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;          // in-out cubic
const SMOOTHER = t => t * t * t * (t * (t * 6 - 15) + 10);
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

export function createGlobe({ renderer = null, canvas = null, onReady = null, seed = 11, edition = 1, autoSpin = true, water = null,
  width = null, height = null } = {}) {
  if (water) setWater(water);
  // ---------- renderer / context (the reference's renderer settings) ----------
  if (!renderer) {
    renderer = new THREE.WebGLRenderer({ canvas: canvas || undefined, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.shadowMap.autoUpdate = false;
    if (!canvas) document.body.prepend(renderer.domElement);
  }
  const W0 = () => width || innerWidth, H0 = () => height || innerHeight;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, W0() / H0(), 1, 12000);
  const ctx = createContext({ renderer, scene, camera, seed });
  const { V, L } = ctx;
  const kit = createKit(ctx);
  const T = createTownKit(ctx, kit);
  const ramps = makeRamps(ctx);
  const RP = GEO.RP;

  // ---------- lights: the reference's colours and intensities, aimed from the viewer's upper left ----------
  const hemi = new THREE.HemisphereLight(0xb8cfd8, 0xc89a6a, 0.62); hemi.layers.enable(5); scene.add(hemi);
  const key = new THREE.DirectionalLight(0xffe0bc, 0.85);
  key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0006; key.shadow.radius = 3;   // normalBias follows the frustum (placeCamera) key.layers.enable(5);
  scene.add(key, key.target);

  // ---------- space ----------
  const space = createSpace(ctx);
  const U = {
    uSun: { value: new THREE.Vector3(0, 0, -1) }, uKey: { value: new THREE.Vector3(0, 1, 0) },
    uHaze: { value: new THREE.Color(0.80, 0.76, 0.68) }, uHazeAmt: { value: 0.55 },
    uTime: { value: 0 }, uCos: { value: Math.cos(space.SUN_ANG) }, uLake: { value: 0 }, uCamPos: { value: new THREE.Vector3() }, uBloom: { value: 0 }, uPaintLight: { value: 0.75 }, uDeep: { value: 1 },
    // the look (setLook): shadow tint + strength, the sea's shallow / deep colours
    uShadeTint: { value: ctx.col('#2f3d92') }, uShadeK: { value: 0.62 }, uShallowC: { value: ctx.col('#55b8bf') }, uDeepC: { value: ctx.col('#174694') },
    // ground glows (geography GLOWS: our camp + the three nations; slot 4 = the lounge lamp on the Moon)
    uGlowP: { value: [0, 1, 2, 3, 4].map(() => new THREE.Vector4(0, -1e5, 0, 1)) }, uGlowC: { value: [0, 1, 2, 3, 4].map(() => new THREE.Color(0, 0, 0)) }, uGlowK: { value: [0, 0, 0, 0, 0] }
  };

  // ---------- bodies ----------
  const earthGroup = new THREE.Group(); scene.add(earthGroup);
  const moonGroup = new THREE.Group(); scene.add(moonGroup);
  // the globe's relief is the map's, vertically scaled by VS (a 45 m range on a 170-radius planet reads as spikes);
  // water depths are kept. x / z are identical to the map's; only y differs (diveView returns MAP heights).
  // VS = 1 over our land and the hills round it (so the dive's end matches the map v2 relief exactly), easing to
  // 0.45 for the far relief
  // (2026-10-04, "not a slab": a believable small planet) the far relief is a fifth of the map's, so the range is a
  // low painted crest on the limb, not spikes; look.reliefScale multiplies it
  let VS = 0.2, RELIEF_K = 1;
  const vsAt = (x, z) => RELIEF_K * (VS + (1 - VS) * (1 - THREE.MathUtils.smoothstep(distOutsidePlot(x, z), 6, 90)) * (1 - THREE.MathUtils.smoothstep(distOutsidePlot(x, z), 6, 90))
    * THREE.MathUtils.smoothstep(Math.hypot(x - GP.wonder.x, z - GP.wonder.z), 22, 48));   // (the wonder's sea view keeps the low relief)
  // the wonder's terrace is a flat slab on a curved planet: the ground under its footprint is dipped a little
  // below the terrace top (a coplanar ground z-fights through the pool as a diagonal seam), and the relief
  // round it is kept below terrace level so no hill pokes through its front edge
  const WON = GP.wonder, WON_S = WON.scale, WON_C = Math.cos(WON.yaw || 0), WON_SN = Math.sin(WON.yaw || 0);
  const WON_TOP = Math.max(0, mapHeightAt(WON.x, WON.z)) * vsAt(WON.x, WON.z);
  const WON_BOX = { x0: -40 * WON_S - 0.4, x1: 40 * WON_S + 0.4, z0: -14 * WON_S - 0.4, z1: 30 * WON_S + 0.4 };
  function wonderGround(x, z, h) {
    const dx = x - WON.x, dz = z - WON.z; if (dx * dx + dz * dz > 1600 || inPlot(x, z)) return h;
    const lx = dx * WON_C - dz * WON_SN, lz = dx * WON_SN + dz * WON_C;   // flat -> the wonder's local frame (yaw)
    const out = Math.hypot(Math.max(WON_BOX.x0 - lx, 0, lx - WON_BOX.x1), Math.max(WON_BOX.z0 - lz, 0, lz - WON_BOX.z1));
    if (out === 0) return WON_TOP - 0.25;
    let cap = WON_TOP - 0.25 + THREE.MathUtils.smoothstep(out, 0, 3) * 0.25 + Math.max(0, out - 2.5) * 0.6;
    // beyond the terrace's far edge (where the arch looks) the bluff drops into the sea, so the arch frames a sea
    // horizon as in the reference (on a 170-radius planet a low rim of land otherwise hides the water)
    // (a cove: a widening wedge of water from the terrace's far edge out to the bay, ~20 units off)
    if (lz < WON_BOX.z0) {
      const ahead = WON_BOX.z0 - lz, wedge = 6 + ahead * 0.9;
      const fall = THREE.MathUtils.smoothstep(ahead, 0.4, 3.6) * (1 - THREE.MathUtils.smoothstep(Math.abs(lx) - wedge, 0, 6)) * (1 - THREE.MathUtils.smoothstep(ahead, 26, 34))
        * THREE.MathUtils.smoothstep(distOutsidePlot(x, z), 4, 10);   // never into our plot (the sim's level, dry land)
      cap = cap * (1 - fall) + fall * -2.6;
    } else if (out > 20) return h;
    return Math.min(h, cap);
  }
  // the map v2 relief (geography reliefAt: our land gently rolling, its lake a smooth bowl to the sim's polygon)
  const heightAt = (x, z) => { const h = mapHeightAt(x, z); return wonderGround(x, z, h > 0 ? h * vsAt(x, z) : h); };
  // UNBENDING round our land: the map is flat, the planet is not. At the dive's top-down end (100 up) the planet's
  // curvature pulled everything 40 m out ~30 px toward the centre, so the cross-fade into the map ghosted the coast
  // and the river. The Earth's wrap therefore lifts the ground round home by FLAT_K x d^2 / 2R (fading out between
  // 55 and 160 m from the plot's centre), which brings that ring most of the way back onto the map's plane. Every
  // placement goes through this wrap (terrain, tents, towns, trees, glows, camera poses), and the terrain's normals
  // and "level up" are taken from the lifted surface's own tangents, so lighting and hillshade stay those of level
  // ground (no false slope round the lifted ring).
  const FLAT_K = 0.6;
  const compW = (x, z) => FLAT_K * (1 - THREE.MathUtils.smoothstep(Math.hypot(x - GEO.C.x, z - GEO.C.z), 55, 160));
  const compAt = (x, z, w = compW(x, z)) => { if (w <= 0) return 0; const dx = x - GEO.C.x, dz = z - GEO.C.z; return w * (dx * dx + dz * dz) / (2 * RP); };
  const earthWrap = (fx, y, fz, out) => flatToSphere(fx, y + compAt(fx, fz), fz, out);
  // the LEVEL frame at a point uses the lift with its weight frozen there: level ground is level, and the fade ring
  // (where the weight falls off) neither tilts the trees nor lights up as a slope
  const earthLevelWrap = (x0, z0) => { const w = compW(x0, z0); return (fx, y, fz, out) => flatToSphere(fx, y + compAt(fx, fz, w), fz, out); };
  const EARTH = { id: 'earth', group: earthGroup, R: RP, C: GEO.C, wrap: earthWrap, levelWrap: earthLevelWrap, comp: compAt, heightAt, mapHeightAt, centre: new THREE.Vector3() };
  const MOON = { id: 'moon', group: moonGroup, R: MOONGEO.RM, C: { x: 0, z: 0 }, wrap: MOONGEO.flatToSphere, heightAt: MOONGEO.heightAt, centre: new THREE.Vector3() };
  const bodyOf = id => id === 'moon' ? MOON : EARTH;
  function toWorld(body, fx, y, fz, out = new THREE.Vector3()) { const a = body.wrap(fx, y, fz, [0, 0, 0]); out.set(a[0], a[1], a[2]); return out.applyMatrix4(body.group.matrixWorld); }
  function invWrap(body, p) {   // world -> flat {x, y, z} for a body
    const l = body.group.worldToLocal(p.clone()), r = l.length();
    const th = Math.acos(clamp(l.y / r, -1, 1)), s = Math.hypot(l.x, l.z), ux = s > 1e-9 ? l.x / s : 0, uz = s > 1e-9 ? l.z / s : 1;
    return { x: body.C.x + ux * th * body.R, y: r - body.R, z: body.C.z + uz * th * body.R };
  }
  // the level frame at a flat point: east / south along the (wrapped, unbent) ground, up = their normal
  function frameOf(body, fx, fz) {
    const e = 0.25, lw = body.levelWrap ? body.levelWrap(fx, fz) : body.wrap, tw = (x, z) => { const a = lw(x, 0, z, [0, 0, 0]); return new THREE.Vector3(a[0], a[1], a[2]).applyMatrix4(body.group.matrixWorld); };
    const p = tw(fx, fz), px = tw(fx + e, fz), pz = tw(fx, fz + e);
    const east = px.sub(p).normalize(), south0 = pz.sub(p).normalize();
    const up = new THREE.Vector3().crossVectors(south0, east).normalize();
    const south = new THREE.Vector3().crossVectors(east, up).normalize();
    return { up, east, south, p };
  }
  function localFrame(body, fx, fz) {
    const e = 0.25, a = [0, 0, 0], lw = body.levelWrap ? body.levelWrap(fx, fz) : body.wrap, p = new THREE.Vector3().fromArray(lw(fx, 0, fz, a));
    const east = new THREE.Vector3().fromArray(lw(fx + e, 0, fz, a)).sub(p).normalize(), south0 = new THREE.Vector3().fromArray(lw(fx, 0, fz + e, a)).sub(p).normalize();
    const up = new THREE.Vector3().crossVectors(south0, east).normalize();
    const south = new THREE.Vector3().crossVectors(east, up).normalize();
    return { up, east, south };
  }
  // stand a local-frame object (y up, -z north) on a body at flat (x, z)
  // (obj is a child of body.group: position and frame are in the body's local space)
  function standOn(obj, body, fx, fz, { y = null, scale = 1, yaw = 0 } = {}) {
    const h = y == null ? Math.max(0, body.heightAt(fx, fz)) : y;
    const f = localFrame(body, fx, fz);
    obj.position.fromArray(body.wrap(fx, h, fz, [0, 0, 0]));
    obj.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(f.east, f.up, f.south));
    if (yaw) obj.rotateY(yaw);
    obj.scale.setScalar(scale);
    obj.updateMatrixWorld(true);
    return obj;
  }

  // ---------- orbit frames ----------
  // Earth: az = el = 0 looks straight down at the bay (flat (0,-55)) with north up the screen
  function frameMatrix(dirZ, upHint) {
    const z = dirZ.clone().normalize(), y = upHint.clone().addScaledVector(z, -upHint.dot(z)).normalize(), x = new THREE.Vector3().crossVectors(y, z);
    return new THREE.Matrix4().makeBasis(x, y, z);
  }
  {
    const c = flatToSphere(0, 0, -50, [0, 0, 0]), n = flatToSphere(0, 0, -51, [0, 0, 0]);
    const z = new THREE.Vector3(...c).normalize();
    EARTH.W = frameMatrix(z, new THREE.Vector3(n[0] - c[0], n[1] - c[1], n[2] - c[2]));
  }
  const ORBIT0 = { az: 0.0, el: -0.08, dist: 0 };
  let orbitFov = 40;   // (look.camFov)
  // the map's key light in map axes (x east, y up, z south): backdrop.js key (-28,22,14) -> (0,0,-6), bearing kept,
  // lowered to world.js KEY_ELEVATION = 0.5 rad
  const MAP_KEY = (() => { const dx = -28, dz = 20, hz = Math.hypot(dx, dz), e = 0.5; return [dx / hz * Math.cos(e), Math.sin(e), dz / hz * Math.cos(e)]; })();
  function fitDist() {
    const a = W0() / H0(), v = THREE.MathUtils.degToRad(40), h = 2 * Math.atan(Math.tan(v / 2) * a), half = Math.min(v, h) / 2;
    return (RP + 10) / Math.sin(half * 0.76);
  }
  ORBIT0.dist = fitDist();
  function orbitPose(body, p, out = {}) {
    const d = new THREE.Vector3(Math.cos(p.el) * Math.sin(p.az), Math.sin(p.el), Math.cos(p.el) * Math.cos(p.az)).applyMatrix4(body.W);
    out.eye = body.centre.clone().addScaledVector(d, p.dist);
    out.look = body.centre.clone();
    if (body === EARTH) out.look.add(new THREE.Vector3(RP * 0.16, RP * 0.1, 0).applyMatrix4(body.W));   // the globe a touch low and left: room for the moon
    out.up = new THREE.Vector3(0, 1, 0).applyMatrix4(body.W);
    out.fov = orbitFov; out.sun = -0.42;
    return out;
  }

  // the moon: placed once from the default view, up and to the right of the Earth, beyond it
  {
    const pose = orbitPose(EARTH, { az: 0, el: ORBIT0.el, dist: fitDist() });
    const fwd = pose.look.clone().sub(pose.eye).normalize(), up = pose.up.clone(), right = new THREE.Vector3().crossVectors(fwd, up).normalize();
    const D = pose.eye.distanceTo(EARTH.centre) + 420;
    MOON.centre.copy(pose.eye).addScaledVector(fwd, D).addScaledVector(right, Math.tan(THREE.MathUtils.degToRad(21)) * D).addScaledVector(up, Math.tan(THREE.MathUtils.degToRad(10)) * D);
    moonGroup.position.copy(MOON.centre);
    // its meadow (the pole) turned toward the Earth's default viewer, tipped up a little
    const toCam = pose.eye.clone().sub(MOON.centre).normalize().addScaledVector(up, 0.55).addScaledVector(right, -0.25).normalize();
    moonGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), toCam);
    // spin it so the meadow's north (-z) points up the screen
    moonGroup.updateMatrixWorld(true);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), toCam);
    const north = new THREE.Vector3(0, 0, -1).applyQuaternion(q);
    const want = up.clone().addScaledVector(toCam, -up.dot(toCam)).normalize();
    const ang = Math.atan2(new THREE.Vector3().crossVectors(north, want).dot(toCam), north.dot(want));
    moonGroup.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(toCam, ang));
    moonGroup.updateMatrixWorld(true);
    MOON.W = frameMatrix(toCam, want);
  }
  earthGroup.updateMatrixWorld(true);

  // ---------- the Earth: one painted mesh, sea and land ----------
  const bodyMat = makeBodyMaterial(U);
  let CREAM = ctx.col('#f7ead0');
  ramps.ivoryRock = ['#8d8798', '#bdb3ab', '#ddd3c2', '#efe7d8'].map(h => ctx.col(h));   // reads as #efe4cc-ish once the key + hemi have lit it
  const tmpC = new THREE.Color(), tmpC2 = new THREE.Color();
  // two colour sets per vertex (ART_DIRECTION 1): `base` = the start state, an ivory relief map (cream paper land,
  // warm lit slopes, cobalt / violet shadow sides, muted forest masses), and `painted` = the land in colour
  // (meadow / straw / pine / rock / sand ramps). The shader shows base, blooming into painted with uBloom
  // (setWorldBloom) + aBloom (our town's colour spreading out, setHomeGrowth; the nations' own land).
  // Our land (geography homeWeight, no rectangle) is the same ivory paper, a touch lighter and warmer, shaded by its
  // own rolling relief; its painted set is the ground a town gives it. aHome (= homeWeight) keeps world bloom off it:
  // only our own town colours it (setHomeGrowth).
  const homeW = [];
  // the expensive part (the landform's cover weights, the painted value) is cached per vertex, so the look can
  // repaint the colours live (setLook creamColor / bloomPalette) without asking the landform again
  const WC = { n: 0, w: null, v: null };
  function paintEarth(x, z, h, n, i, base, painted) {
    if (h < 0) { base.setRGB(0.36, 0.62, 0.66); painted.copy(base); return; }   // under the sea shader
    if (!WC.w) { WC.w = new Float32Array(400000 * 5); WC.v = new Float32Array(400000).fill(-9); }
    const w = landWeights(x, z, h / vsAt(x, z), Math.min(1, (1 - n.y) * 1.8));
    const v = paintValue(L, n, x, z, i);
    WC.w.set([w.cream, w.meadow, w.sand, w.pine, w.rock], i * 5); WC.v[i] = v;
    colourEarth(x, z, h, i, base, painted);
  }
  function colourEarth(x, z, h, i, base, painted) {
    const q = i * 5, w = { cream: WC.w[q], meadow: WC.w[q + 1], sand: WC.w[q + 2], pine: WC.w[q + 3], rock: WC.w[q + 4] }, v = WC.v[i], hw = w.cream;
    homeW[i] = hw;
    painted.setRGB(0, 0, 0);
    let sum = 0;
    for (const k of ['meadow', 'sand', 'pine', 'rock']) if (w[k] > 0.001) {
      tmpC.copy(ctx.ramp(ramps[k], v + (k === 'pine' ? -0.06 : 0)));
      // meadows: green in the lowlands and along the water, sun-dried straw up the hills
      if (k === 'meadow') tmpC.lerp(tmpC2.copy(ctx.ramp(ramps.straw, v)), THREE.MathUtils.smoothstep(h / Math.max(0.2, vsAt(x, z)) + (fbm2(x / 30 + 9, z / 30, 2) - 0.5) * 8, 3, 18) * 0.8);
      painted.r += tmpC.r * w[k]; painted.g += tmpC.g * w[k]; painted.b += tmpC.b * w[k]; sum += w[k];
    }
    if (hw > 0.001) { tmpC.copy(ctx.ramp(ramps.painted, v - 0.22)); painted.r += tmpC.r * hw; painted.g += tmpC.g * hw; painted.b += tmpC.b * hw; sum += hw; }
    if (sum > 0) painted.multiplyScalar(1 / sum);
    // each nation's land is painted in its colours (gardens, roofs, terraces) so it reads from orbit
    for (const nt of NATION_GROUND) {
      const d = Math.hypot(x - nt.x, z - nt.z); if (d > nt.r1) continue;
      const k = (1 - THREE.MathUtils.smoothstep(d, nt.r0, nt.r1)) * (0.75 + 0.25 * fbm2(x / 3, z / 3, 2));
      tmpC.copy(ctx.ramp(nt.ramp, v - 0.06)); painted.lerp(tmpC, k * nt.k);
    }
    // the ivory relief: paper land shaded by the painted light, forests as muted dark masses, limestone a cooler
    // paper; our land the same paper a little lighter (a soft cream heart, mb 1), never a patch
    base.copy(ctx.ramp(ramps.ivory, v + 0.04 + 0.03 * hw));
    if (w.pine > 0.001) base.lerp(tmpC.copy(ctx.ramp(ramps.ivoryPine, v)), w.pine * 0.48);
    if (w.rock > 0.001) base.lerp(tmpC.copy(ctx.ramp(ramps.ivoryRock, v)), w.rock * 0.7);
    if (w.sand > 0.001) base.lerp(tmpC.copy(ctx.ramp(ramps.ivory, v + 0.12)), w.sand * 0.6);
    if (hw > 0.001) base.lerp(CREAM, hw * 0.12);
  }
  const NATION_GROUND = GP.nations.map(n => ({ x: n.x, z: n.z, r0: n.r * 0.9, r1: n.r * 1.7, k: 0.8,
    ramp: { riviera: ['#7a2e24', '#b4452f', '#d9694a', '#ec9670'], loaf: ['#25685f', '#3f978a', '#6fc0b2', '#b9e6da'], skyhold: ['#4a7426', '#74a83e', '#a9d06a', '#dfe08c'] }[n.style].map(h => ctx.col(h)) }));
  const earth = buildBody(ctx, { R: RP, C: GEO.C, fine: 2 / 3, fineHalf: 46, slope: 0.022, heightAt, paint: paintEarth, wrap: earthWrap, levelWrap: earthLevelWrap, material: bodyMat,
    normalBoost: (x, z) => Math.max(1, 0.85 / vsAt(x, z)) });   // shaded as if the relief were ~0.85 of the map's: a relief map from orbit
  earth.geo.attributes.aHome.array.set(Float32Array.from({ length: earth.nx * earth.nx }, (_, k) => homeW[k] || 0));
  earthGroup.add(earth.mesh);
  // bloom vertices: everything within reach of our town's colour (the plot and ~130 units round it), and the
  // nations' land (always in colour: they are old civilisations)
  const bloomVerts = [];
  {
    const ax = earth.axis, nx = earth.nx, bl = earth.bloom;
    for (let j = 0; j < nx; j++) for (let i = 0; i < nx; i++) {
      const x = GEO.C.x + ax[i], z = GEO.C.z + ax[j], k = j * nx + i;
      for (const nt of NATION_GROUND) { const d = Math.hypot(x - nt.x, z - nt.z); if (d < nt.r1 * 1.5) bl[k] = Math.max(bl[k], (1 - THREE.MathUtils.smoothstep(d, nt.r1 * 0.8, nt.r1 * 1.5)) * (0.8 + 0.2 * fbm2(x / 4, z / 4, 2))); }
      { const d = Math.hypot(x - GP.wonder.x, z - GP.wonder.z); if (d < 16) bl[k] = Math.max(bl[k], 1 - THREE.MathUtils.smoothstep(d, 9, 16)); }
      const dp = distOutsidePlot(x, z), hw = homeW[k] || 0;
      if (dp < 140) bloomVerts.push({ k, x, z, dp, hw, n: fbm2(x / 14 + 3, z / 14 - 5, 3), b0: bl[k] });
    }
  }
  // coast pencil lines only from afar (close up the foam + the shore's own form draw the coast)
  const farLines = new THREE.Group(), moonFarLines = new THREE.Group(); earthGroup.add(farLines); moonGroup.add(moonFarLines);
  const proxyMat = new THREE.MeshBasicMaterial();
  const tents = [];
  let TENT_K = Math.tan(THREE.MathUtils.degToRad(40));   // (look.coastLine: 30 deg faint .. 40 deg full)
  // segs -> polylines: marching-squares segments share their end points exactly, so they chain into continuous
  // lines (closed where they loop), then two Chaikin passes round off the grid's zig-zag
  function chainSegs(segs) {
    const key = (x, z) => x.toFixed(4) + ',' + z.toFixed(4), adj = new Map(), used = new Uint8Array(segs.length);
    segs.forEach((sg, i) => { for (const k of [key(sg[0], sg[1]), key(sg[2], sg[3])]) { if (!adj.has(k)) adj.set(k, []); adj.get(k).push(i); } });
    const other = (i, k) => { const sg = segs[i]; return key(sg[0], sg[1]) === k ? [sg[2], sg[3]] : [sg[0], sg[1]]; };
    const polys = [];
    for (let i0 = 0; i0 < segs.length; i0++) {
      if (used[i0]) continue;
      used[i0] = 1;
      const sg = segs[i0];
      let pts = [[sg[0], sg[1]], [sg[2], sg[3]]];
      for (const dir of [1, -1]) {   // grow forward from the end, then backward from the start
        for (;;) {
          const end = dir > 0 ? pts[pts.length - 1] : pts[0], k = key(end[0], end[1]);
          const nxt = (adj.get(k) || []).find(j => !used[j]); if (nxt == null) break;
          used[nxt] = 1; const p = other(nxt, k);
          if (dir > 0) pts.push(p); else pts.unshift(p);
        }
      }
      const closed = pts.length > 3 && Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]) < 1e-3;
      if (closed) pts.pop();
      for (let it = 0; it < 2 && pts.length > 2; it++) {
        const out = []; const n = pts.length;
        if (!closed) out.push(pts[0]);
        for (let k = 0; k < (closed ? n : n - 1); k++) {
          const p = pts[k], q = pts[(k + 1) % n];
          out.push([p[0] * 0.75 + q[0] * 0.25, p[1] * 0.75 + q[1] * 0.25], [p[0] * 0.25 + q[0] * 0.75, p[1] * 0.25 + q[1] * 0.75]);
        }
        if (!closed) out.push(pts[n - 1]);
        pts = out;
      }
      polys.push({ pts, closed });
    }
    return polys;
  }
  // pencil keylines along polylines: invisible "tents" in ctx.lineOnly. Each line is a low ridge, two faces sloping
  // 40 deg either side of it: against the ground they differ by ~40 deg (under the edge shader's normal threshold,
  // no line), against each other by ~80 deg, so exactly ONE line draws, along the ridge. The faces of a line share
  // their ridge vertices (mitred at the bends), so the ridge, and the pencil line, is unbroken; only the reference's
  // own "lost edges" (post.js) still lift it here and there. Its width follows the view (tentWidth, ~4.5 internal
  // pixels at the surface below the camera, rescaled in place when that changes), so it never goes sub-pixel in
  // the normal pass, which runs at the painter's internal size. One-sided faces, wound outward, flat normals.
  function tentLines(body, segs, { parent = body.group, lift = 0.06, ground = true } = {}) {
    const polys = chainSegs(segs);
    let nq = 0; for (const pl of polys) nq += pl.closed ? pl.pts.length : pl.pts.length - 1;
    const base = new Float32Array(nq * 12 * 3), off = new Float32Array(nq * 12 * 3);
    const a = [0, 0, 0];
    let q = 0;
    const put = (P, D, U, cd, cu) => { base[q] = P.x; base[q + 1] = P.y; base[q + 2] = P.z; off[q] = D.x * cd + U.x * (cu * TENT_K + 0.4); off[q + 1] = D.y * cd + U.y * (cu * TENT_K + 0.4); off[q + 2] = D.z * cd + U.z * (cu * TENT_K + 0.4); q += 3; };   // + 0.4 w: never buried in a steep bank
    for (const { pts, closed } of polys) {
      const n = pts.length;
      // a waterline tent sits on the bank's lip (the highest ground within ~0.6 m, at most 0.8 up), so a steep bank
      // never buries half of it (that broke river banks into dots)
      const lip = (x, z) => { let m = 0; for (const [dx, dz] of [[0.6, 0], [-0.6, 0], [0, 0.6], [0, -0.6]]) m = Math.max(m, body.heightAt(x + dx, z + dz)); return Math.min(0.8, m); };
      const P = pts.map(([x, z]) => { const h = ground ? Math.max(0, body.heightAt(x, z)) : lip(x, z); return new THREE.Vector3().fromArray(body.wrap(x, h + lift, z, a)); });
      const Us = P.map(p => p.clone().normalize());
      // mitred side vectors: the average of the two segments' sides at each vertex
      const Ds = P.map((p, k) => {
        const pr = P[closed ? (k - 1 + n) % n : Math.max(0, k - 1)], nx = P[closed ? (k + 1) % n : Math.min(n - 1, k + 1)];
        const T = nx.clone().sub(pr); return new THREE.Vector3().crossVectors(T, Us[k]).normalize();
      });
      for (let k = 0; k < (closed ? n : n - 1); k++) {
        const k1 = (k + 1) % n;
        for (const sgn of [-1, 1]) {
          const quad = [[k, sgn, 0], [k1, sgn, 0], [k1, 0, 1], [k, 0, 1]];
          const order = sgn < 0 ? [0, 2, 1, 0, 3, 2] : [0, 1, 2, 0, 2, 3];
          for (const o of order) { const [v, cd, cu] = quad[o]; put(P[v], Ds[v], Us[v], cd, cu); }
        }
      }
    }
    const pos = new Float32Array(base.length);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const tent = { body, g, base, off, w: -1 };
    setTentWidth(tent, 1);
    // flat normals, flipped where a face came out facing down (the winding depends on the line's direction)
    g.computeVertexNormals();
    const nr = g.attributes.normal.array;
    for (let t = 0; t < pos.length; t += 9) {
      const cx = (base[t] + base[t + 3] + base[t + 6]) / 3, cy = (base[t + 1] + base[t + 4] + base[t + 7]) / 3, cz = (base[t + 2] + base[t + 5] + base[t + 8]) / 3;
      const up = nr[t] * cx + nr[t + 1] * cy + nr[t + 2] * cz;
      if (up < 0) {   // swap the 2nd and 3rd vertex (positions, offsets) and flip the normals
        for (const arr of [base, off]) for (let c = 0; c < 3; c++) { const tmp = arr[t + 3 + c]; arr[t + 3 + c] = arr[t + 6 + c]; arr[t + 6 + c] = tmp; }
        for (let c = 0; c < 9; c++) nr[t + c] = -nr[t + c];
      }
    }
    tent.w = -1; setTentWidth(tent, 1);
    const mesh = new THREE.Mesh(g, proxyMat); mesh.visible = false; mesh.frustumCulled = false; parent.add(mesh); ctx.lineOnly.push(mesh);
    tent.mesh = mesh; tent.polys = polys.length; tents.push(tent); return tent;
  }
  function setTentWidth(tent, w) {
    if (tent.w > 0 && Math.abs(w - tent.w) / tent.w < 0.12) return false;
    const p = tent.g.attributes.position.array, b = tent.base, o = tent.off;
    for (let i = 0; i < p.length; i++) p[i] = b[i] + o[i] * w;
    tent.g.attributes.position.needsUpdate = true; tent.w = w; return true;
  }
  // ~3 internal pixels wide wherever the camera is (pixel footprint at the body's surface below the camera)
  function tentWidth(alt) {
    const ih = Math.max(200, painter.internalSize.ih), px = 2 * Math.max(4, alt) * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) / ih;
    return clamp(px * 4.5, 0.05, 5);
  }
  // coast contour (marching squares on the height grid; unconnected segments are fine: the ridge is continuous)
  function coastSegs(body, grid, maxD) {
    const ax = grid.axis, nx = grid.nx, hs = grid.heights, segs = [];
    const lerpZ = (a, b, ha, hb) => a + (b - a) * (ha / (ha - hb));
    for (let j = 0; j < nx - 1; j++) for (let i = 0; i < nx - 1; i++) {
      const x0 = body.C.x + ax[i], x1 = body.C.x + ax[i + 1], z0 = body.C.z + ax[j], z1 = body.C.z + ax[j + 1];
      if (Math.hypot(x0 - body.C.x, z0 - body.C.z) > maxD) continue;
      const h00 = hs[j * nx + i] - 0.05, h10 = hs[j * nx + i + 1] - 0.05, h01 = hs[(j + 1) * nx + i] - 0.05, h11 = hs[(j + 1) * nx + i + 1] - 0.05;
      const pts = [];
      if ((h00 > 0) !== (h10 > 0)) pts.push([lerpZ(x0, x1, h00, h10), z0]);
      if ((h10 > 0) !== (h11 > 0)) pts.push([x1, lerpZ(z0, z1, h10, h11)]);
      if ((h01 > 0) !== (h11 > 0)) pts.push([lerpZ(x0, x1, h01, h11), z1]);
      if ((h00 > 0) !== (h01 > 0)) pts.push([x0, lerpZ(z0, z1, h00, h01)]);
      for (let k = 0; k + 1 < pts.length; k += 2) segs.push([pts[k][0], pts[k][1], pts[k + 1][0], pts[k + 1][1]]);
    }
    return segs;
  }
  // the painter is made further down (it needs the finished scene); tents are sized on first placeCamera
  let painter = { internalSize: { ih: H0() } };
  let coastLines = tentLines(EARTH, coastSegs(EARTH, earth, Math.PI * RP * 0.92), { parent: farLines, ground: false });
  // (no pencil border round our plot: our land fades softly into the land round it, ART_DIRECTION mb 1)

  // ---------- the wonder: the Red arch itself, built verbatim by redArch.js and stood on its bluff ----------
  const wonder = (() => {
    const holder = new THREE.Group(); earthGroup.add(holder);
    const arch = buildRedArch(ctx, kit, { origin: V(0, 0, 0), scale: 1 });
    holder.add(arch.group);
    // the mirror pool would re-render the whole planet every repaint: swap it for still painted water
    const pool = arch.pool; pool.parent.remove(pool);
    [ctx.reflectors, ctx.folkHidden, ctx.colourOnly].forEach(l => { const i = l.indexOf(pool); if (i >= 0) l.splice(i, 1); });
    const still = new THREE.Mesh(pool.geometry, new THREE.MeshBasicMaterial({ color: ctx.col('#4f7f8c') }));
    still.rotation.copy(pool.rotation); still.position.copy(pool.position); arch.group.add(still); ctx.colourOnly.push(still);
    // the wall runs 60 either side and 40 up: built for a camera that never leaves the terrace. On the globe it
    // read as a long red slash from orbit and dug into the hills, so the miniature's wall is the same shape
    // (redArch.js's own arch: R 8.6, spring 4.8, depth 1.8, 96 segments) trimmed to 26 either side and 26 up,
    // still wider and taller than the reference framing sees at any aspect up to ~2.5:1
    {
      const archR = 8.6, archSpring = 4.8, wallDepth = 1.8, HW = 26, TOP = 26;
      const ws = new THREE.Shape();
      ws.moveTo(-HW, -2.2); ws.lineTo(-archR, -2.2); ws.lineTo(-archR, archSpring);
      ws.absarc(0, archSpring, archR, Math.PI, 0, true);
      ws.lineTo(archR, -2.2); ws.lineTo(HW, -2.2); ws.lineTo(HW, TOP); ws.lineTo(-HW, TOP); ws.lineTo(-HW, -2.2);
      const old = arch.wall.geometry;
      arch.wall.geometry = new THREE.ExtrudeGeometry(ws, { depth: wallDepth, bevelEnabled: false, curveSegments: 96 });
      old.dispose();
    }
    standOn(holder, EARTH, GP.wonder.x, GP.wonder.z, { y: WON_TOP, scale: GP.wonder.scale, yaw: GP.wonder.yaw || 0 });
    holder.traverse(o => { if (o.isMesh && !o.isInstancedMesh) { o.castShadow = true; } });
    return { holder, arch };
  })();

  // ---------- level of detail for the pencil: far away, small things paint without keylines ----------
  // Every child of a town (a building, a terrace, a tree part) is its own LOD unit with its own switch altitude
  // (LOD_ALT x 0.55..1.6, hashed), so a town gains its pencil lines piece by piece over the whole lower half of a
  // dive instead of in one frame. The ink-dark openings (towns.js tags them userData.fine) and the kit's keyline
  // proxies are not switched but GROW in (scale 0 -> 1) over the band just above each unit's switch altitude, so
  // the windows and doors appear gradually before the unit's pencil arrives. (Scale, not visible: the painter
  // forces visible on everything in ctx.colourOnly after each paint.)
  const lodUnits = [];
  function addLOD(group) {
    group.children.forEach((c, i) => {
      const u = { o: c, k: 0.55 + 1.05 * hashI(lodUnits.length * 7919 + i * 31 + 5), far: null, g: -1, fine: [] };
      c.traverse(o => { if (o.userData.fine || (o.isMesh && ctx.lineOnly.includes(o))) { o.userData.s0 = o.scale.clone(); u.fine.push(o); } });
      lodUnits.push(u);
    });
  }
  function setUnitLOD(u, far) {
    u.far = far;
    u.o.traverse(o => {
      if (!o.isMesh || o.isInstancedMesh || ctx.lineOnly.includes(o)) return;
      const i = ctx.colourOnly.indexOf(o);
      if (far && i < 0) { ctx.colourOnly.push(o); o.userData.lod = true; }
      else if (!far && i >= 0 && o.userData.lod) { ctx.colourOnly.splice(i, 1); o.userData.lod = false; }
    });
  }
  function setLOD(alt) {
    let any = false;
    for (const u of lodUnits) {
      const thr = LOD_ALT * u.k, far = alt > thr;
      if (far !== u.far) { setUnitLOD(u, far); any = true; }
      // the fine detail grows in over [thr, thr x 1.5] (quantised to 1/16 so a held paint isn't redrawn for nothing)
      const g = Math.round(16 * (1 - THREE.MathUtils.smoothstep(alt, thr, thr * 1.5))) / 16;
      if (g !== u.g) { u.g = g; for (const o of u.fine) o.scale.copy(o.userData.s0).multiplyScalar(Math.max(1e-4, g)); any = true; }
    }
    if (any) dirty = true;
  }

  // ---------- the three nations ----------
  const nations = {};
  for (const n of GP.nations) {
    const { group, buildings } = buildNation(ctx, kit, T, n.style, n.colours);
    earthGroup.add(group);
    standOn(group, EARTH, n.x, n.z, { scale: 1.0, yaw: n.style === 'riviera' ? 0.5 : n.style === 'loaf' ? -0.6 : 0 });
    buildings.forEach(b => { b.userData.grow = 1; });
    nations[n.id] = { id: n.id, group, buildings, growth: 0.75, shown: 0.75 };
    addLOD(group);
  }

  // ---------- warm glows over settlements (ART_DIRECTION 1: "warm glows mark settlements") ----------
  // painted halos, not a bloom pass: a soft warm wash facing the camera, seen from altitude, fading near ground.
  // Normal alpha blending of a warm apricot (additive went hot white over the cream plot and read as a flare).
  // Each sprite hangs in its own holder group: the painter forces visible = true on ctx.colourOnly members after
  // every paint, so visibility is decided by the holder.
  const glows = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,200,120,0.85)'); gr.addColorStop(0.18, 'rgba(255,160,84,0.55)'); gr.addColorStop(0.5, 'rgba(244,122,70,0.16)'); gr.addColorStop(1, 'rgba(240,110,70,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    const tex = new THREE.CanvasTexture(c);
    const list = [];
    function glow(x, z, size, tint, y = null) {
      const m = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: true, color: ctx.col('#ffb27a').lerp(ctx.col(tint), 0.18) });
      const sp = new THREE.Sprite(m); sp.renderOrder = 5;
      const h = y == null ? Math.max(0, heightAt(x, z)) + 2 : y;
      const at = toWorld(EARTH, x, h, z), up = at.clone().normalize();
      const hold = new THREE.Group(); hold.add(sp); earthGroup.add(hold);
      sp.userData = { at, up, size, hold }; sp.scale.setScalar(size);
      ctx.colourOnly.push(sp); ctx.folkHidden.push(sp);
      list.push(sp); return sp;
    }
    const out = { list, home: null };
    // the same glows pooled on the ground, in the body shader (geography GLOWS: the map v2 paints the same ones)
    GLOWS.forEach((gw, i) => {
      const p = toWorld(EARTH, gw.x, Math.max(0, heightAt(gw.x, gw.z)), gw.z);
      U.uGlowP.value[i].set(p.x, p.y, p.z, gw.r);
      U.uGlowC.value[i].copy(ctx.col('#ff8a4c')).lerp(ctx.col(gw.colour), gw.id === 'home' ? 0.15 : 0.3);
      U.uGlowK.value[i] = gw.id === 'home' ? 0.42 : 0.8;
    });
    GP.nations.forEach(n => { out[n.id] = glow(n.x, n.z, 58, n.colours.wall, Math.max(0, heightAt(n.x, n.z)) + 6); });
    out.home = glow(CAMP.x, CAMP.z, 16, '#ffd08a', Math.max(0, heightAt(CAMP.x, CAMP.z)) + 2);
    const tc = new THREE.Vector3();
    out.update = (eye, alt) => {
      const fade = THREE.MathUtils.smoothstep(alt, 50, 170);
      for (const sp of list) {
        const u = sp.userData;
        tc.copy(eye).sub(u.at); const dist = tc.length(); tc.divideScalar(dist);
        const facing = THREE.MathUtils.smoothstep(u.up.dot(tc), -0.05, 0.35);
        sp.material.opacity = fade * facing * (sp === out.home ? 0.4 + 0.45 * Math.min(1, home.growth * 3 + 0.3) : 0.85);
        sp.position.copy(u.at).addScaledVector(tc, sp.scale.x * 0.5);
        u.hold.visible = sp.material.opacity > 0.01;
      }
    };
    return out;
  })();

  // ---------- our village (appears with setHomeGrowth) ----------
  const homeSpotsList = homeSpots(16);
  const home = { growth: 0, shown: 0, items: [] };
  homeSpotsList.forEach((s, i) => {
    const g = buildHomeBuilding(ctx, kit, T, i);
    earthGroup.add(g);
    standOn(g, EARTH, s.x, s.z, { y: Math.max(0, heightAt(s.x, s.z)) - 0.05, scale: 1, yaw: s.rot });
    g.userData.t = (i + 0.5) / homeSpotsList.length;
    g.visible = false;
    home.items.push({ g, x: s.x, z: s.z, t: g.userData.t, k: 0 });
    addLOD(g);
  });
  addLOD(wonder.arch.group);

  // ---------- forests: umbrella pines and cypresses, baked tokens instanced over the pine / meadow land ----------
  let FOREST_ALT = 160, LOD_ALT = 140;
  const SITE_CLEAR = [{ x: GP.wonder.x, z: GP.wonder.z, r: 13 }, ...GP.nations.map(n => ({ x: n.x, z: n.z, r: n.r + 2 }))];
  const forest = (() => {
    const { PINE, UNDER, TRUNK, CYP } = kit.PALETTES;
    const hexes = a => a.map(c => typeof c === 'string' ? c : '#' + c.getHexString());
    function merge(geos) {
      geos = geos.map(g => g.index ? g.toNonIndexed() : g);
      let n = 0; geos.forEach(g => { n += g.attributes.position.count; });
      const pos = new Float32Array(n * 3), col = new Float32Array(n * 3); let o = 0;
      geos.forEach(g => { const gg = g.index ? g.toNonIndexed() : g; pos.set(gg.attributes.position.array, o * 3); col.set(gg.attributes.color.array, o * 3); o += gg.attributes.position.count; });
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); return g;
    }
    // umbrella pine (the reference silhouette, miniature): a slender leaning trunk under 2-3 flat pads,
    // each a dark underside with a sunlit top (1 unit tall, crown ~1.3 wide)
    const parts = [kit.bake(new THREE.CylinderGeometry(0.03, 0.055, 1.0, 6).translate(0, 0.5, 0).rotateZ(-0.12), hexes(TRUNK), 0.08)];
    for (const [x, y, z, r] of [[0.12, 1.0, 0, 0.5], [-0.24, 0.86, 0.1, 0.3], [0.44, 0.9, -0.08, 0.28]]) {
      parts.push(kit.bake(kit.blob(r, V(x, y, z), 0.24, 0.12, 12, 0.8), UNDER, 0.2));
      parts.push(kit.bake(kit.blob(r * 0.94, V(x, y + r * 0.1, z), 0.2, 0.16, 12, 0.78), hexes(PINE).slice(0, 4), 0.25, -0.05));
    }
    const pineGeo = merge(parts);
    const cypGeo = (() => {
      const prof = t => (t < 0.1 ? 0.7 + 0.3 * (t / 0.1) : Math.pow(Math.max(0, 1 - (t - 0.1) / 0.9), 0.8));
      const pts = []; for (let i = 0; i <= 10; i++) { const t = i / 10; pts.push(new THREE.Vector2(Math.max(0.001, 0.16 * prof(t)), t)); }
      return kit.bake(new THREE.LatheGeometry(pts, 8), hexes(CYP), 0.2);
    })();
    // the reveal: each tree grows out of the ground at its own moment as the camera comes down through
    // FOREST_ALT (a hashed threshold aT per instance against uReveal), so the forest sprinkles in over a dive
    // instead of switching on in one frame. The shadow pass gets the same scaling (customDepthMaterial).
    const reveal = { value: 0 }, ivory = { value: 0.85 };
    const grow = sh => {
      sh.uniforms.uReveal = reveal;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float aT; uniform float uReveal;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\n  float kGrow = smoothstep(aT, aT + 0.22, uReveal);\n  transformed *= vec3(mix(0.55, 1.0, kGrow), 1.0, mix(0.55, 1.0, kGrow)) * kGrow;');
      // the ivory start state (mb 1): forests are muted olive-sepia masses until the world blooms
      if (sh.fragmentShader.includes('#include <color_fragment>')) {
        sh.uniforms.uIvory = ivory;
        sh.fragmentShader = sh.fragmentShader
          .replace('#include <common>', '#include <common>\nuniform float uIvory;')
          .replace('#include <color_fragment>', '#include <color_fragment>\n  { float lum = dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11)); diffuseColor.rgb = mix(diffuseColor.rgb, mix(vec3(0.20, 0.25, 0.15), vec3(0.60, 0.58, 0.42), smoothstep(0.08, 0.6, lum)), uIvory); }');
      }
    };
    const mat = new THREE.MeshBasicMaterial({ vertexColors: true }); mat.onBeforeCompile = grow;
    const depthMat = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }); depthMat.onBeforeCompile = grow;
    const forestGroup = new THREE.Group(); earthGroup.add(forestGroup);
    const spots = { pine: [], cyp: [] };
    for (let gz = -300; gz <= 300; gz += 4.2) for (let gx = -300; gx <= 300; gx += 4.2) {
      const jx = gx + (hashI((gx * 131 + gz * 7) | 0) - 0.5) * 4, jz = gz + (hashI((gx * 17 - gz * 113) | 0) - 0.5) * 4;
      if (Math.hypot(jx - GEO.C.x, jz - GEO.C.z) > 300) continue;
      const h = heightAt(jx, jz); if (h < 0.3) continue;
      if (homeWeight(jx, jz) > 0.3 || SITE_CLEAR.some(c => Math.hypot(jx - c.x, jz - c.z) < c.r)) continue;
      const w = landWeights(jx, jz, h / vsAt(jx, jz), 0);
      const r = hashI((gx * 7919 + gz * 104729) | 0);
      if (w.pine > 0.5 && r < 0.4) spots[r < 0.07 ? 'cyp' : 'pine'].push([jx, jz, h, r]);
      else if (w.meadow > 0.5 && r < 0.035) spots[r < 0.012 ? 'cyp' : 'pine'].push([jx, jz, h, r]);
    }
    const out = [];
    for (const [k, geo] of [['pine', pineGeo], ['cyp', cypGeo]]) {
      const list = spots[k], im = new THREE.InstancedMesh(geo, mat, list.length);
      const aT = new Float32Array(list.length);
      list.forEach(([x, z], i) => { aT[i] = 0.78 * hashI(((x * 92821) ^ (z * 68917) ^ (i * 7)) | 0); });
      geo.setAttribute('aT', new THREE.InstancedBufferAttribute(aT, 1));
      im.customDepthMaterial = depthMat;
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), yq = new THREE.Quaternion(), white = new THREE.Color();
      list.forEach(([x, z, h, r], i) => {
        const f = frameOf(EARTH, x, z);
        q.setFromRotationMatrix(new THREE.Matrix4().makeBasis(f.east, f.up, f.south));
        yq.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r * 40); q.multiply(yq);
        const sc = k === 'pine' ? 3.6 + r * 3 : 4.2 + r * 3;
        s.set(sc, sc * (k === 'pine' ? 0.9 + r * 0.4 : 1), sc);
        m.compose(toWorld(EARTH, x, h - 0.1, z), q, s); im.setMatrixAt(i, m);
        im.setColorAt(i, white.setScalar(0.9 + r * 0.2));   // every instanced mesh must carry instanceColor (r128 shares
      });                                                  // override programs between the kit's leaves and these)
      im.castShadow = true; forestGroup.add(im); ctx.colourOnly.push(im); out.push(im);
    }
    // visibility lives on the group (the painter forces visible on the instanced meshes after every paint)
    return { meshes: out, group: forestGroup, reveal, ivory };
  })();

  // ---------- the Moon: a small painted planet (cool lilac / cream, the Alpine lounge's meadow + lake) ----------
  // The landing is lounge.html's opening view in miniature (geography MOON): the lounge facing the viewer, the little
  // lake as a band behind it, the shrub cones on the rise, the limestone spires on the skyline, in the lounge's own
  // palette (sage meadow, lilac regolith, cream stone, an oxblood rug, a lamp's warm glint).
  const moonBody = (() => {
    const mg = MOONGEO;
    const meadowW = [];
    function paintMoon(x, z, h, n, i, base, painted) {
      if (h < 0) { base.setRGB(0.4, 0.55, 0.6); painted.copy(base); meadowW[i] = 1; return; }
      const v = paintValue(L, n, x, z, i, 0.2);
      meadowW[i] = mg.landWeights(x, z).meadow;
      // painted = the sage meadow (mown stripes of warmer / cooler green), base = the lilac regolith
      painted.copy(ctx.ramp(ramps.sage, v - 0.06 + (fbm2(x / 3, z / 3, 2) - 0.5) * 0.24 + 0.05 * Math.sin(x * 0.9 + fbm2(x / 7, z / 7, 2) * 4)));
      base.copy(ctx.ramp(ramps.regolith, v * 0.9 - 0.12 + (fbm2(x / 9 + 4, z / 9, 3) - 0.5) * 0.3));
    }
    const moonMat = makeBodyMaterial(U, { uCentre: { value: MOON.centre.clone() }, uMoon: { value: 1 } });
    const mb = buildBody(ctx, { R: MOON.R, C: { x: 0, z: 0 }, fine: 0.4, fineHalf: 26, slope: 0.04, heightAt: mg.heightAt, paint: paintMoon, wrap: mg.flatToSphere, material: moonMat });
    // the meadow weight rides in aBloom; the Moon's shader thresholds it against world-space noise per pixel
    mb.geo.attributes.aBloom.array.set(Float32Array.from({ length: mb.nx * mb.nx }, (_, k) => meadowW[k] == null ? 0 : meadowW[k]));
    moonGroup.add(mb.mesh);
    // the little lake: its own painted water on the stage (MOON.lakeSurfaceAt, a polar grid wrapped onto the Moon), deep
    // teal at heart, lighter at the rim, a pale lilac sky reflection across its far side, a pencil line round it
    {
      const L0 = mg.lake, NA = 72, NR = 6, rim = [];
      for (let k = 0; k < NA; k++) {   // the shore (lakeSD = 0) along each ray, by bisection
        const a = k / NA * Math.PI * 2, dx = Math.cos(a) * L0.rx, dz = Math.sin(a) * L0.rz;
        let lo = 0, hi = 1.6; for (let it = 0; it < 22; it++) { const m = (lo + hi) / 2; if (mg.lakeSD(L0.x + dx * m, L0.z + dz * m) < 0) lo = m; else hi = m; }
        rim.push([L0.x + dx * lo, L0.z + dz * lo]);
      }
      const pos = [], col = [], idx = [], tmp = [0, 0, 0], cD = ctx.col('#2f5b6b'), cR = ctx.col('#6e9fa6'), cS = ctx.col('#b9b4cc'), c = new THREE.Color();
      for (let r = 0; r <= NR; r++) for (let k = 0; k < NA; k++) {
        const t = r / NR, x = L0.x + (rim[k][0] - L0.x) * t, z = L0.z + (rim[k][1] - L0.z) * t;
        mg.flatToSphere(x, mg.lakeSurfaceAt(x, z), z, tmp); pos.push(tmp[0], tmp[1], tmp[2]);
        c.copy(cD).lerp(cR, Math.pow(t, 2.2) * 0.85).lerp(cS, THREE.MathUtils.smoothstep(-(z - L0.z) / L0.rz, 0.15, 0.75) * 0.5 * (1 - t * 0.4));
        col.push(c.r, c.g, c.b);
      }
      for (let r = 0; r < NR; r++) for (let k = 0; k < NA; k++) {
        const a = r * NA + k, b = r * NA + (k + 1) % NA, d = a + NA, e = b + NA;
        idx.push(a, b, d, b, e, d);
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx);
      g.computeVertexNormals(); { const n = g.attributes.normal; let s = 0; for (let i = 0; i < n.count; i++) s += n.getY(i); if (s < 0) { const ix = g.index.array; for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; } } }
      const water = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }));
      moonGroup.add(water); ctx.colourOnly.push(water);
      const segs = rim.map((p, k) => { const q = rim[(k + 1) % NA]; return [p[0], p[1], q[0], q[1]]; });
      tentLines(MOON, segs, { lift: 0.02 });
    }
    // everything here is built in the Red arch kit's grammar at its own local origin (y up, -z north) and stood
    // on the Moon with standOn; leaves become one InstancedMesh per piece (so each leans with its own ground)
    const piece = (x, z, fn, { yaw = 0, scale = 1 } = {}) => {
      const g = new THREE.Group(), prev = kit.parent; kit.parent = g;
      fn(g);
      if (kit.leaves.length) kit.finishLeaves();
      kit.parent = prev; moonGroup.add(g); standOn(g, MOON, x, z, { yaw, scale, y: g.userData.sink ? Math.max(0, MOON.heightAt(x, z)) - g.userData.sink : null });
      return g;
    };
    // leaning limestone spires (the lounge's peaks): faceted (7 sides), knife-edged, broad-footed, cream stone with
    // lilac shadow sides and a little sage on the lower slopes
    for (const [x, z, h, lean] of mg.spires) piece(x, z, g => {
      const k = hashI(Math.round(x * 13 + z * 7)), pts = [], foot = h * (0.24 + 0.06 * k);
      for (let i = 0; i <= 16; i++) { const t = i / 16; pts.push(new THREE.Vector2(Math.max(0.03, foot * Math.pow(1 - t, 1.25 + 0.4 * k) * (1 + 0.1 * Math.sin(t * 13 + x))), t * h)); }
      const geo = new THREE.LatheGeometry(pts, 7, k * 6);
      const p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) { const y = p.getY(i), w = 1 + 0.2 * Math.sin(y * 1.9 + i * 0.7 + k * 9); p.setX(i, p.getX(i) * w); p.setZ(i, p.getZ(i) * w); }
      geo.rotateZ(lean); geo.translate(0, -0.4, 0); geo.computeVertexNormals();
      const sg = kit.bake(geo.toNonIndexed(), ['#5d5872', '#9d94ab', '#d3cbc6', '#f4eee2'], 0.2);
      { const c = sg.attributes.color, ps = sg.attributes.position, sage = ctx.col('#7d8c4c');   // sage tufts low down
        for (let i = 0; i < c.count; i++) { const y = ps.getY(i) / h, f = (1 - THREE.MathUtils.smoothstep(y, 0.05, 0.3)) * (0.5 + 0.5 * Math.sin(i * 1.7 + k * 5)) * 0.55;
          c.setXYZ(i, c.getX(i) + (sage.r - c.getX(i)) * f, c.getY(i) + (sage.g - c.getY(i)) * f, c.getZ(i) + (sage.b - c.getZ(i)) * f); } }
      const m = new THREE.Mesh(sg, kit.paintMat); m.castShadow = true; g.add(m);
      const pg = new THREE.LatheGeometry(pts.map(q => new THREE.Vector2(q.x * 1.1, q.y)), 14); pg.rotateZ(lean); pg.translate(0, -0.4, 0);
      const pm = new THREE.Mesh(pg, proxyMat); pm.visible = false; g.add(pm); ctx.lineOnly.push(pm);
    });
    // shrub-covered cones (the lounge's green hills): a dark cone core under hundreds of baked leaf clumps,
    // a smooth proxy for the pencil
    const CONE = ['#0f1c09', '#1d3410', '#30521a', '#4f7a2a', '#7f9c48'].map(c => ctx.col(c));
    for (const [x, z, h, r] of mg.cones) piece(x, z, g => {
      g.userData.sink = 0.3 * r;   // sunk a little into the rise, so the downhill side never floats
      const core = new THREE.ConeGeometry(r * 0.94, h * 0.97, 24, 4).translate(0, h * 0.97 / 2, 0);
      const cm = new THREE.Mesh(kit.bake(core, ['#0c1508', '#1a2a10', '#2a4018'], 0.1), kit.paintMat); cm.castShadow = true; kit.parent.add(cm);
      kit.proxy(new THREE.ConeGeometry(r * 1.06, h * 1.04, 32, 1).translate(0, h * 1.04 / 2, 0));
      const slant = Math.hypot(r, h), count = Math.round(Math.PI * r * slant * 24);
      for (let i = 0; i < count; i++) {
        const t = Math.pow(ctx.rnd(), 0.75), a = ctx.R(0, Math.PI * 2), rr = r * (1 - t) * ctx.R(0.95, 1.06);
        const n = V(Math.cos(a) * h / slant, r / slant, Math.sin(a) * h / slant);
        const val = 0.6 * n.dot(L) + 0.36 + 0.16 * t + (ctx.rnd() - 0.5) * 0.35;
        kit.leaf(V(Math.cos(a) * rr, t * h, Math.sin(a) * rr), ctx.R(0.15, 0.25), ctx.ramp(CONE, val));
      }
    });
    // the kit's own cypresses and flowering shrubs, verbatim
    for (const [x, z, h] of mg.cypresses) piece(x, z, () => kit.cypress(0, 0, h, h * 0.105));
    for (const [x, z, sp] of mg.bushes) piece(x, z, () => kit.bush(0, 0, sp, 2, kit.PALETTES.PINK, 1.0, 0.45));
    // the lounge (lounge.html's set in miniature, facing the viewer): an oxblood round rug, an olive bouclé sofa
    // and two armchairs angled in, a white tulip table, two dark-wood side tables with books, a pleated paper floor
    // lamp whose shade glows (unlit paint) and pools warm light on the grass (glow slot 4)
    const lg = mg.lounge;
    let lampAt = null;
    piece(lg.x, lg.z, g => {
      const OLIVE = '#66702a', OLIVE_D = '#4b5419', WOOD = '#4a221a';
      T.mesh(new THREE.CylinderGeometry(1.5, 1.5, 0.04, 48), T.L('#7a2414'), g, 0, 0.02, 0.45);
      T.box(g, 2.0, 0.38, 0.74, T.L(OLIVE), 0, 0.04, -0.6); T.box(g, 2.0, 0.46, 0.24, T.L(OLIVE_D), 0, 0.4, -0.88);
      T.box(g, 0.24, 0.32, 0.74, T.L(OLIVE_D), -1.08, 0.32, -0.6); T.box(g, 0.24, 0.32, 0.74, T.L(OLIVE_D), 1.08, 0.32, -0.6);
      for (const sx of [-1, 1]) {
        const ar = new THREE.Group(); ar.position.set(sx * 1.9, 0, 0.15); ar.rotation.y = -sx * 0.5; g.add(ar);
        T.box(ar, 0.86, 0.36, 0.76, T.L(OLIVE), 0, 0.04, 0); T.box(ar, 0.86, 0.42, 0.22, T.L(OLIVE_D), 0, 0.38, -0.3);
        T.box(ar, 0.18, 0.28, 0.76, T.L(OLIVE_D), -0.38, 0.38, 0); T.box(ar, 0.18, 0.28, 0.76, T.L(OLIVE_D), 0.38, 0.38, 0);
        // a side table with a stack of books beyond each armchair
        T.mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.035, 20), T.L(WOOD), g, sx * 2.75, 0.52, -0.35);
        T.mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 6), T.L(WOOD), g, sx * 2.75, 0.26, -0.35);
        T.box(g, 0.24, 0.05, 0.17, T.L(sx < 0 ? '#e6dfcc' : '#2e3b55'), sx * 2.75, 0.54, -0.35);
        T.box(g, 0.2, 0.04, 0.15, T.L(sx < 0 ? '#8a3a2a' : '#d9c27a'), sx * 2.75, 0.59, -0.33);
      }
      T.mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.05, 32), T.L('#f1ede2'), g, 0, 0.46, 0.3);
      T.mesh(new THREE.CylinderGeometry(0.05, 0.22, 0.44, 16), T.L('#f1ede2'), g, 0, 0.22, 0.3);
      const lx = -1.3, lz = -1.05;
      T.mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.7, 6), T.L('#8a5a2a'), g, lx, 0.85, lz);
      const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.34, 0.36, 18, 1, true), new THREE.MeshBasicMaterial({ color: ctx.col('#ffd77a'), side: THREE.DoubleSide }));
      shade.position.set(lx, 1.72, lz); g.add(shade);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), new THREE.MeshBasicMaterial({ color: ctx.col('#fff3cf') })); bulb.position.set(lx, 1.6, lz); g.add(bulb);
      lampAt = new THREE.Vector3(lx, 1.6, lz);
    }, { yaw: lg.yaw, scale: lg.scale });
    // the lamp's warm pool on the grass (ground glow slot 4)
    { const gpos = toWorld(MOON, lg.x - 1.3 * lg.scale, 0.2, lg.z - 1.05 * lg.scale);
      U.uGlowP.value[4].set(gpos.x, gpos.y, gpos.z, 2.6); U.uGlowC.value[4].copy(ctx.col('#ffb35c')); U.uGlowK.value[4] = 0.55; }
    return mb;
  })();

  // ---------- painter: an empty folk (no creatures on the globe) ----------
  const folk = { creatures: [], hoppers: [], drops: [], scoots: [], flits: [], pips: [], floaties: [], allLimbs: [], FACE_LAYER: 5, MASK_LAYER: 6, setCloseUp() {} };
  painter = createPainter(ctx, folk, { framing: (cam, w, h) => { cam.aspect = w / h; } });

  // ---------- growth ----------
  function applyNation(id) {
    const n = nations[id]; if (!n) return;
    for (const b of n.buildings) b.visible = n.growth + 1e-6 >= b.userData.t;
    painter.markDirty();
  }
  function setNationGrowth(id, g) { const n = nations[id]; if (!n) return; n.growth = clamp(g, 0, 1); applyNation(id); }
  for (const id in nations) applyNation(id);
  const bloomAttr = earth.geo.attributes.aBloom;
  function setHomeGrowth(g) {
    home.growth = clamp(g, 0, 1);
    const live = home.items.filter(it => home.growth + 1e-6 >= it.t);
    home.items.forEach(it => { const on = home.growth + 1e-6 >= it.t; if (on && !it.g.visible) { it.g.visible = true; it.k = 0; } if (!on) it.g.visible = false; });
    // colour blooms from the cream round every finished building, warms the whole plot, and then spreads out
    // over the ivory land round it (a soft, ragged front)
    const gr = home.growth, R0 = 7 + 9 * gr, base = gr * 0.3, front = gr * gr * 130;
    const a = bloomAttr.array;
    for (const v of bloomVerts) {
      let b = 0;
      if (v.hw > 0.02) {
        b = base;
        for (const it of live) { const d = Math.hypot(v.x - it.x, v.z - it.z); b += 1 - THREE.MathUtils.smoothstep(d, R0 * 0.35, R0); }
        b *= (0.85 + 0.3 * v.n) * v.hw;
      }
      if (gr > 0 && v.hw < 0.98) {
        b = Math.max(b, (1 - THREE.MathUtils.smoothstep(v.dp + (v.n - 0.5) * 30, front * 0.55, front + 4)) * Math.min(1, gr * 2.5) * (1 - v.hw));
      }
      a[v.k] = Math.max(v.b0, clamp(b, 0, 1));
    }
    bloomAttr.needsUpdate = true;
    glows.home.scale.setScalar(glows.home.userData.size * (1 + gr * 1.6));
    U.uGlowK.value[0] = 0.42 + 0.35 * gr; U.uGlowP.value[0].w = GLOWS[0].r * (1 + 0.8 * gr);
    painter.markDirty(); dirty = true;
  }
  // the whole world's colour (0 = the ivory relief map of the start, 1 = fully painted)
  function setWorldBloom(v) { U.uBloom.value = clamp(v, 0, 1); forest.ivory.value = 0.85 * (1 - U.uBloom.value); dirty = true; }
  // optional: show the sim's real buildings (positions) instead of the stock village spots
  function setHomeBuildings(list) {
    (list || []).forEach((b, i) => { const it = home.items[i]; if (!it) return; it.x = b.x; it.z = b.z; standOn(it.g, EARTH, b.x, b.z, { y: Math.max(0, heightAt(b.x, b.z)) - 0.05, yaw: b.rot || 0 }); it.t = 0; });
    setHomeGrowth(Math.max(home.growth, list && list.length ? 0.001 : 0));
  }

  // ---------- the look (LOOK CONTRACT: globe.getLook / globe.setLook, plain JSON, live; docs/globe.md "Look") ----------
  // The globe's key light follows the VIEW (the reference's key from the viewer's upper left), so sunAz / sunEl are
  // screen-relative here: the bearing on the view (0 = from the top of the screen, 90 right, 180 bottom, 270 left)
  // and the height toward the viewer, in degrees. bloomPalette: [deep green, meadow green, light green, ochre,
  // straw, woods] (the map's order); creamColor: the paper land of the start state. haze multiplies the limb haze.
  const hex = c => '#' + c.getHexString();
  const LOOK = {
    sunAz: 306, sunEl: 38, keyIntensity: 0.85, keyColor: '#ffe0bc', hemiIntensity: 0.62, hemiSky: '#b8cfd8', hemiGround: '#c89a6a',
    shadowTint: hex(U.uShadeTint.value), shadowStrength: 0.62, creamColor: '#f6e6c0',
    bloomPalette: ['#4f532c', '#7c7f38', '#ab9b52', '#b68e56', '#edd298', '#283a16'],
    reliefScale: 1, coastLine: 1, waterShallow: hex(U.uShallowC.value), waterDeep: hex(U.uDeepC.value), haze: 1, brush: null,
    camPitch: ORBIT0.el, camDist: ORBIT0.dist, camFov: 40
  };
  const IVORY_K = [[0.569, 0.548, 0.740], [0.813, 0.757, 0.719], [0.943, 0.904, 0.844], [1, 1, 1]];   // the ivory ramp as multiples of the cream
  function applyRamps() {
    const c = ctx.col(LOOK.creamColor);
    ramps.ivory = IVORY_K.map(k => new THREE.Color(c.r * k[0], c.g * k[1], c.b * k[2]));
    CREAM = c.clone().lerp(new THREE.Color(1, 1, 1), 0.08);
    const P = LOOK.bloomPalette.map(h => ctx.col(h)); while (P.length < 6) P.push(P[P.length - 1].clone());
    const mix = (a, b, t) => a.clone().lerp(b, t), mul = (a, k) => a.clone().multiplyScalar(k);
    ramps.meadow = [P[0], P[1], P[2], mix(P[2], P[4], 0.5)];
    ramps.straw = [mul(P[3], 0.74), P[3], mix(P[3], P[4], 0.5), P[4]];
    ramps.pine = [mul(P[5], 0.6), P[5], mix(P[5], P[0], 0.5), mix(P[5], P[1], 0.6)];
  }
  function repaint() {
    if (!WC.w) return;
    const ax = earth.axis, nx = earth.nx, maxD = Math.PI * RP, cA = earth.colours, pA = earth.painted;
    for (let j = 0; j < nx; j++) for (let i = 0; i < nx; i++) {
      const k = j * nx + i; if (WC.v[k] < -5) continue;
      let dx = ax[i], dz = ax[j]; const d = Math.hypot(dx, dz); if (d > maxD) { dx *= maxD / d; dz *= maxD / d; }
      colourEarth(GEO.C.x + dx, GEO.C.z + dz, earth.heights[k], k, tmpC3, tmpC4);
      cA[k * 3] = tmpC3.r; cA[k * 3 + 1] = tmpC3.g; cA[k * 3 + 2] = tmpC3.b; pA[k * 3] = tmpC4.r; pA[k * 3 + 1] = tmpC4.g; pA[k * 3 + 2] = tmpC4.b;
    }
    earth.geo.attributes.color.needsUpdate = true; earth.geo.attributes.aPaint.needsUpdate = true;
  }
  const tmpC3 = new THREE.Color(), tmpC4 = new THREE.Color();
  let repaintT = 0;
  function setLook(p = {}) {
    if (!p || typeof p !== 'object') return getLook();
    const has = k => p[k] !== undefined && p[k] !== null;
    if (has('sunAz')) LOOK.sunAz = +p.sunAz; if (has('sunEl')) LOOK.sunEl = clamp(+p.sunEl, 2, 89);
    if (has('keyIntensity')) key.intensity = LOOK.keyIntensity = +p.keyIntensity;
    if (has('keyColor')) { LOOK.keyColor = p.keyColor; key.color.set(p.keyColor); }
    if (has('hemiIntensity')) hemi.intensity = LOOK.hemiIntensity = +p.hemiIntensity;
    if (has('hemiSky')) { LOOK.hemiSky = p.hemiSky; hemi.color.set(p.hemiSky); }
    if (has('hemiGround')) { LOOK.hemiGround = p.hemiGround; hemi.groundColor.set(p.hemiGround); }
    if (has('shadowTint')) { LOOK.shadowTint = p.shadowTint; U.uShadeTint.value = ctx.col(p.shadowTint); }
    if (has('shadowStrength')) U.uShadeK.value = LOOK.shadowStrength = +p.shadowStrength;
    if (has('waterShallow')) { LOOK.waterShallow = p.waterShallow; U.uShallowC.value = ctx.col(p.waterShallow); }
    if (has('waterDeep')) { LOOK.waterDeep = p.waterDeep; U.uDeepC.value = ctx.col(p.waterDeep); }
    if (has('haze')) LOOK.haze = Math.max(0, +p.haze);
    if (p.brush !== undefined) LOOK.brush = p.brush === null ? null : clamp(+p.brush, 1, 8);
    let rp = false;
    if (has('creamColor')) { LOOK.creamColor = p.creamColor; rp = true; }
    if (Array.isArray(p.bloomPalette) && p.bloomPalette.length) { LOOK.bloomPalette = p.bloomPalette.slice(0, 6); rp = true; }
    if (rp) { applyRamps(); clearTimeout(repaintT); repaintT = setTimeout(() => { repaint(); dirty = true; }, 60); }
    if (has('coastLine') && +p.coastLine !== LOOK.coastLine) {
      LOOK.coastLine = clamp(+p.coastLine, 0, 1);
      const i = tents.indexOf(coastLines); if (i >= 0) tents.splice(i, 1);
      farLines.remove(coastLines.mesh); { const j = ctx.lineOnly.indexOf(coastLines.mesh); if (j >= 0) ctx.lineOnly.splice(j, 1); } coastLines.g.dispose();
      TENT_K = Math.tan(THREE.MathUtils.degToRad(29 + 11 * LOOK.coastLine));
      if (LOOK.coastLine > 0.02) coastLines = tentLines(EARTH, coastSegs(EARTH, earth, Math.PI * RP * 0.92), { parent: farLines, ground: false });
      else coastLines = { mesh: new THREE.Group(), g: new THREE.BufferGeometry() };
    }
    if (has('reliefScale')) LOOK.reliefScale = +p.reliefScale;   // (map-only for now: the planet's mesh is built once)
    if (has('camPitch') || has('camDist') || has('camFov')) {
      if (has('camPitch')) { LOOK.camPitch = clamp(+p.camPitch, -1.25, 1.25); ORBIT0.el = LOOK.camPitch; if (mode === 'orbit') orbitT.el = LOOK.camPitch; }
      if (has('camDist')) { LOOK.camDist = clamp(+p.camDist, RP * 1.45, RP * 7); ORBIT0.dist = LOOK.camDist; if (mode === 'orbit') orbitT.dist = LOOK.camDist; }
      if (has('camFov')) orbitFov = LOOK.camFov = clamp(+p.camFov, 15, 80);
    }
    dirty = true; painter.markDirty();
    return getLook();
  }
  function getLook() { return JSON.parse(JSON.stringify({ ...LOOK, camDist: orbitT.dist })); }

  // ---------- camera ----------
  const cam = { eye: new THREE.Vector3(), look: new THREE.Vector3(), up: new THREE.Vector3(0, 1, 0), fov: 40, sun: -0.42 };
  let mode = 'orbit', body = EARTH, tween = null, idleT = 0, spin = autoSpin, lastPlace = null;
  const orbitP = { ...ORBIT0 }, orbitT = { ...ORBIT0 };
  Object.assign(cam, orbitPose(EARTH, orbitP));

  function groundRadius(b, p) { const f = invWrap(b, p); return b.R + Math.max(0, b.heightAt(f.x, f.z)) + (b.comp ? b.comp(f.x, f.z) : 0); }
  // the dive's final view in flat MAP coordinates (what the gouache map's camera should start from);
  // { globe: true } gives the same view on the globe's (vertically scaled) relief
  function diveView(id, { globe = false } = {}) {
    const p = placeById(id); if (!p) return null;
    const b = id === 'moon' ? MOON : EARTH, v = p.view, H = (globe || b === MOON) ? b.heightAt : b.mapHeightAt, gh = Math.max(0, H(p.x, p.z));
    const c = Math.cos(p.yaw || 0), sn = Math.sin(p.yaw || 0), rot = o => [o[0] * c + o[2] * sn, o[1], -o[0] * sn + o[2] * c];
    const eo = rot(v.eye), lo = rot(v.look), ex = p.x + eo[0], ez = p.z + eo[2];
    return { eye: { x: ex, y: Math.max(gh + eo[1], Math.max(0, H(ex, ez)) + 1.5), z: ez }, look: { x: p.x + lo[0], y: gh + lo[1], z: p.z + lo[2] },
      fov: v.fov || 46, sun: v.sun == null ? -0.42 : v.sun, body: b.id };
  }
  function placePose(id) {
    const v = diveView(id, { globe: true }); if (!v) throw new Error('globe: unknown place ' + id);
    const b = bodyOf(v.body);
    return { eye: toWorld(b, v.eye.x, v.eye.y, v.eye.z), look: toWorld(b, v.look.x, v.look.y, v.look.z),
      up: frameOf(b, v.eye.x, v.eye.z).up, fov: v.fov, sun: v.sun, body: b };
  }

  function startTween(to, ms, { b = body, arc = 1.25, kind = 'sphere', after = null } = {}) {
    if (tween && tween.resolve) tween.resolve(false);
    const from = { eye: cam.eye.clone(), look: cam.look.clone(), up: cam.up.clone(), fov: cam.fov, sun: cam.sun };
    // a move that takes over a moving camera inherits its velocity (eye + look), decaying over ~0.35 s, so an
    // interrupt never stalls or kinks: position AND velocity stay continuous at the hand-off
    const inertia = { eye: camVel.eye.clone(), look: camVel.look.clone() };
    if (inertia.eye.length() > 1e-3 || inertia.look.length() > 1e-3) { inertia.eye.clampLength(0, 4000); inertia.look.clampLength(0, 4000); }
    return new Promise(resolve => {
      tween = { from, to, ms: Math.max(1, ms), t: 0, b, arc, kind, resolve, after, inertia };
      if (ctx.reduceMotion) tween.ms = Math.min(tween.ms, 600);
    });
  }
  const _d0 = new THREE.Vector3(), _d1 = new THREE.Vector3(), _q = new THREE.Quaternion();
  function sampleTween(tw, u) {
    const e = EASE(u), f = tw.from, t = tw.to, c = tw.b.centre;
    if (tw.kind === 'sphere') {
      _d0.copy(f.eye).sub(c); const r0 = _d0.length(); _d0.divideScalar(r0);
      _d1.copy(t.eye).sub(c); const r1 = _d1.length(); _d1.divideScalar(r1);
      const phi = Math.acos(clamp(_d0.dot(_d1), -1, 1));
      _q.setFromUnitVectors(_d0, _d1);
      const dir = _d0.clone().applyQuaternion(new THREE.Quaternion().slerp(_q, e));
      const rm = Math.max((r0 + r1) / 2, tw.b.R * (1 + tw.arc * phi));
      const ctl = 2 * rm - (r0 + r1) / 2;
      const er = SMOOTHER(u);
      const r = (1 - er) * (1 - er) * r0 + 2 * (1 - er) * er * ctl + er * er * r1;
      cam.eye.copy(c).addScaledVector(dir, r);
    } else {   // 'line': a bezier swung out away from the Earth (the flight to and from the Moon)
      const mid = f.eye.clone().add(t.eye).multiplyScalar(0.5);
      const away = mid.clone().sub(EARTH.centre).normalize();
      const ctl = mid.addScaledVector(away, f.eye.distanceTo(t.eye) * 0.35);
      const a = 1 - e;
      cam.eye.set(0, 0, 0).addScaledVector(f.eye, a * a).addScaledVector(ctl, 2 * a * e).addScaledVector(t.eye, e * e);
    }
    const el = SMOOTHER(clamp(u * 1.05, 0, 1));
    cam.look.lerpVectors(f.look, t.look, el);
    cam.up.lerpVectors(f.up, t.up, e); if (cam.up.lengthSq() < 1e-6) cam.up.copy(t.up); cam.up.normalize();
    cam.fov = f.fov + (t.fov - f.fov) * e;
    cam.sun = f.sun + ((t.sun == null ? -0.42 : t.sun) - f.sun) * e;
    if (tw.inertia) {
      const ts = tw.t / 1000, TAU = 0.35, k = TAU * (1 - Math.exp(-ts / TAU)) * (1 - u) * (1 - u);
      cam.eye.addScaledVector(tw.inertia.eye, k); cam.look.addScaledVector(tw.inertia.look, k);
    }
  }

  // ---------- public camera moves ----------
  // Every public move (and every cut) starts a new move GENERATION. A move is a chain of tweens; each link checks
  // that its generation is still the live one and that the previous tween finished (resolved true) before it
  // starts or commits any state (body, mode, lastPlace). An interrupted move therefore just stops: the new move
  // owns the camera. (Before, a chain ran on after its tween was cancelled and took the new move over.)
  let gen = 0;
  const live = g => g === gen;
  const step = (g, to, ms, opts) => live(g) ? startTween(to, ms, opts) : Promise.resolve(false);
  const nearEarth = () => cam.eye.distanceTo(EARTH.centre) - RP < RP * 0.8;

  function _orbit(g, { az, el, dist, ms = 1800 } = {}) {
    const want = { az: az != null ? az : orbitT.az, el: el != null ? clamp(el, -1.25, 1.25) : orbitT.el, dist: dist != null ? clamp(dist, RP * 1.45, RP * 7) : orbitT.dist };
    const go = () => {
      if (!live(g)) return false;
      Object.assign(orbitT, want); body = EARTH; mode = 'moving';
      return step(g, orbitPose(EARTH, orbitT), ms, { b: EARTH, arc: 0.6 }).then(ok => {
        if (!ok || !live(g)) return false;
        Object.assign(orbitP, orbitT); mode = 'orbit'; idleT = 0; lastPlace = null; return true;
      });
    };
    if (body === MOON) return _flyToEarth(g, { ms: ms * 1.6 }).then(ok => ok ? go() : false);
    return Promise.resolve(go());
  }
  function _rise(g, { ms = 2200 } = {}) {
    if (body === MOON) {
      mode = 'moving';
      return step(g, orbitPose(MOON, { az: 0, el: 0, dist: MOON.R * 3.4 }), ms, { b: MOON, arc: 0.4 }).then(ok => {
        if (!ok || !live(g)) return false; mode = 'moon-orbit'; lastPlace = null; return true;
      });
    }
    return _orbit(g, { ...ORBIT0, dist: fitDist(), ms });
  }
  function _dive(g, placeId, { ms = 3200 } = {}) {
    if (placeId === 'moon') return _flyToMoon(g, { ms });
    const to0 = placePose(placeId);   // validates the id up front
    const go = () => {
      if (!live(g)) return false;
      const wasSurface = mode === 'surface';
      mode = 'moving'; body = EARTH;
      // from the ground somewhere else: pull up, swing over, come down (one arc)
      return step(g, to0, ms, { b: EARTH, arc: wasSurface ? 1.3 : 0.9 }).then(ok => {
        if (!ok || !live(g)) return false; mode = 'surface'; lastPlace = placeId; return true;
      });
    };
    if (body === MOON) return _flyToEarth(g, { ms: ms * 1.4 }).then(ok => ok ? go() : false);
    return Promise.resolve(go());
  }
  async function _flyToMoon(g, { ms = 6000 } = {}) {
    if (body === MOON && mode === 'surface') return true;
    if (body === EARTH && nearEarth()) { if (!(await _rise(g, { ms: ms * 0.28 }))) return false; }
    if (!live(g)) return false;
    mode = 'moving';
    if (!(await step(g, orbitPose(MOON, { az: 0, el: 0.05, dist: MOON.R * 3.6 }), ms * 0.42, { kind: 'line' })) || !live(g)) return false;
    body = MOON;
    if (!(await step(g, placePose('moon'), ms * 0.36, { b: MOON, arc: 0.5 })) || !live(g)) return false;
    mode = 'surface'; lastPlace = 'moon';
    return true;
  }
  async function _flyToEarth(g, { ms = 5000 } = {}) {
    if (body !== MOON) return true;
    mode = 'moving';
    if (cam.eye.distanceTo(MOON.centre) < MOON.R * 2.5) {
      if (!(await step(g, orbitPose(MOON, { az: 0, el: 0.05, dist: MOON.R * 3.4 }), ms * 0.3, { b: MOON, arc: 0.4 })) || !live(g)) return false;
    }
    const to = { ...ORBIT0, dist: fitDist() };
    if (!(await step(g, orbitPose(EARTH, to), ms * 0.7, { kind: 'line', b: EARTH })) || !live(g)) return false;
    body = EARTH; Object.assign(orbitT, to); Object.assign(orbitP, to); mode = 'orbit'; idleT = 0; lastPlace = null;
    return true;
  }
  // the public moves: each one supersedes whatever was running
  const orbit = o => _orbit(++gen, o);
  const rise = o => _rise(++gen, o);
  const dive = (id, o) => _dive(++gen, id, o);
  const flyToMoon = o => _flyToMoon(++gen, o);
  const flyToEarth = o => _flyToEarth(++gen, o);
  // jump without animation (stills, scripted cuts); also ends any running move
  function snapTo(what) {
    gen++; prevOk = false; camVel.eye.set(0, 0, 0); camVel.look.set(0, 0, 0);
    if (tween && tween.resolve) tween.resolve(false); tween = null;
    if (typeof what === 'string') { const p = placePose(what); body = p.body; Object.assign(cam, { eye: p.eye, look: p.look, up: p.up, fov: p.fov, sun: p.sun }); mode = 'surface'; lastPlace = what; }
    else { body = EARTH; Object.assign(orbitT, ORBIT0, { dist: fitDist() }, what || {}); Object.assign(orbitP, orbitT); Object.assign(cam, orbitPose(EARTH, orbitP)); mode = 'orbit'; lastPlace = null; }
    painter.markDirty(); dirty = true;
  }

  // cut to a camera given in flat MAP coordinates (e.g. the gouache map's camera, to cross-fade back into the globe)
  function snapToFlat({ eye, look, fov = 46 }, id = 'earth') {
    gen++; prevOk = false; camVel.eye.set(0, 0, 0); camVel.look.set(0, 0, 0);
    if (tween && tween.resolve) tween.resolve(false); tween = null;
    const b = bodyOf(id); body = b; mode = 'surface';
    Object.assign(cam, { eye: toWorld(b, eye.x, eye.y, eye.z), look: toWorld(b, look.x, look.y, look.z), up: frameOf(b, eye.x, eye.z).up, fov, sun: -0.42 });
    painter.markDirty(); dirty = true;
  }

  // ---------- input: drag to spin, wheel to zoom (orbit only, never during scripted moves) ----------
  const el = renderer.domElement, ptr = new Map();
  let inputOn = true;
  const canSpin = () => inputOn && mode === 'orbit' && !tween;
  el.addEventListener('pointerdown', e => { ptr.set(e.pointerId, { x: e.clientX, y: e.clientY }); idleT = 0; if (canSpin()) { try { el.setPointerCapture(e.pointerId); } catch (_) {} el.style.cursor = 'grabbing'; } });
  el.addEventListener('pointermove', e => {
    const p = ptr.get(e.pointerId); if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY; idleT = 0;
    if (!canSpin()) return;
    orbitT.az -= dx * 0.005; orbitT.el = clamp(orbitT.el + dy * 0.004, -1.25, 1.25);
  });
  const endPtr = e => { ptr.delete(e.pointerId); el.style.cursor = ''; };
  el.addEventListener('pointerup', endPtr); el.addEventListener('pointercancel', endPtr);
  el.addEventListener('wheel', e => { if (!canSpin()) return; e.preventDefault(); idleT = 0; orbitT.dist = clamp(orbitT.dist * Math.exp(e.deltaY * 0.0012), RP * 1.45, RP * 7); }, { passive: false });

  // ---------- per-frame: camera, lights, sky, near/far ----------
  const cR = new THREE.Vector3(), cU = new THREE.Vector3(), cB = new THREE.Vector3(), sunE = new THREE.Vector3(), sunM = new THREE.Vector3();
  const camVel = { eye: new THREE.Vector3(), look: new THREE.Vector3() }, prevEye = new THREE.Vector3(), prevLook = new THREE.Vector3();
  let prevOk = false;
  function placeCamera(dt) {
    if (tween) {
      tween.t += dt * 1000;
      const u = Math.min(1, tween.t / tween.ms);
      sampleTween(tween, u);
      if (u >= 1) { const tw = tween; tween = null; tw.resolve(true); }
    } else if (mode === 'orbit') {
      idleT += dt;
      if (spin && idleT > 3.5 && !ctx.reduceMotion) orbitT.az += dt * 0.03;
      const k = 1 - Math.exp(-dt * 7);
      orbitP.az += (orbitT.az - orbitP.az) * k; orbitP.el += (orbitT.el - orbitP.el) * k; orbitP.dist += (orbitT.dist - orbitP.dist) * k;
      const p = orbitPose(EARTH, orbitP);
      cam.eye.copy(p.eye); cam.look.copy(p.look); cam.up.copy(p.up); cam.fov = p.fov; cam.sun = p.sun;
    }
    // never inside a planet: keep clear of the ground (both bodies)
    for (const b of [EARTH, MOON]) {
      const d = cam.eye.distanceTo(b.centre), gr = groundRadius(b, cam.eye) + (b === MOON ? 0.6 : 1.2);
      if (d < gr) cam.eye.sub(b.centre).setLength(gr).add(b.centre);
    }
    // the camera's velocity (units / s), for the next move's hand-off
    if (prevOk && dt > 1e-4) { camVel.eye.subVectors(cam.eye, prevEye).divideScalar(dt); camVel.look.subVectors(cam.look, prevLook).divideScalar(dt); }
    else if (dt > 1e-4 || !prevOk) { camVel.eye.set(0, 0, 0); camVel.look.set(0, 0, 0); }
    prevEye.copy(cam.eye); prevLook.copy(cam.look); prevOk = dt > 1e-4 || prevOk;
    camera.position.copy(cam.eye); camera.up.copy(cam.up); camera.lookAt(cam.look);
    camera.fov = cam.fov;
    // near / far from the altitude above the nearest surface (keeps the keyline depth pass precise)
    const altE = cam.eye.distanceTo(EARTH.centre) - RP, altM = cam.eye.distanceTo(MOON.centre) - MOON.R, alt = Math.max(0.05, Math.min(altE, altM));
    camera.near = clamp(alt * 0.03, 0.02, 30); camera.far = 12000;
    camera.updateProjectionMatrix(); camera.updateMatrixWorld(); U.uCamPos.value.copy(camera.position);
    const em = painter.materials.edgeMat.uniforms; em.cameraNear.value = camera.near; em.cameraFar.value = camera.far;

    // key light from the viewer's upper left (front), like the reference key; hemi "up" = the local up
    cR.setFromMatrixColumn(camera.matrixWorld, 0); cU.setFromMatrixColumn(camera.matrixWorld, 1); cB.setFromMatrixColumn(camera.matrixWorld, 2);
    const la = THREE.MathUtils.degToRad(LOOK.sunAz), le = THREE.MathUtils.degToRad(LOOK.sunEl);
    const Lk = new THREE.Vector3().addScaledVector(cR, Math.sin(la) * Math.cos(le)).addScaledVector(cU, Math.cos(la) * Math.cos(le)).addScaledVector(cB, Math.sin(le)).normalize();
    const near = altM < altE ? MOON : EARTH;
    // coming down to the Earth's ground the key turns into the MAP's own sun (world.js KEY_DIR: the reference key's
    // bearing, from the south-west, 0.5 rad up), so the dive's end lights the land exactly as the map it fades into
    // (only for views looking well down, like the map's: the eye-level wonder and the oblique nation views keep the
    // viewer's own key from the upper left, which lights the faces they frame)
    const down = Math.asin(clamp(cB.dot(cam.look.clone().sub(EARTH.centre).normalize()), -1, 1));   // the view's pitch below the local horizontal
    if (near === EARTH && altE < 320 && down > 0.6) {
      const f = invWrap(EARTH, cam.look), fr = frameOf(EARTH, f.x, f.z);
      const Lm = new THREE.Vector3().addScaledVector(fr.east, MAP_KEY[0]).addScaledVector(fr.up, MAP_KEY[1]).addScaledVector(fr.south, MAP_KEY[2]).normalize();
      Lk.lerp(Lm, (1 - THREE.MathUtils.smoothstep(altE, 140, 320)) * THREE.MathUtils.smoothstep(down, 0.6, 1.1)).normalize();
    }
    const focus = (mode === 'orbit' || (tween && tween.t / tween.ms < 0.5 && cam.eye.distanceTo(near.centre) > near.R * 2)) ? near.centre : cam.look;
    const wide = cam.eye.distanceTo(near.centre) > near.R * 1.9;
    const sc = key.shadow.camera;
    if (wide) { key.target.position.copy(near.centre); key.position.copy(near.centre).addScaledVector(Lk, near.R * 3); Object.assign(sc, { left: -near.R * 1.08, right: near.R * 1.08, top: near.R * 1.08, bottom: -near.R * 1.08, near: near.R * 1.5, far: near.R * 4.6 }); }
    else { const s = clamp(cam.eye.distanceTo(cam.look) * 1.1, 8, near.R * 0.9); key.target.position.copy(cam.look); key.position.copy(cam.look).addScaledVector(Lk, s * 3); Object.assign(sc, { left: -s, right: s, top: s, bottom: -s, near: s * 0.5, far: s * 6 }); }
    sc.updateProjectionMatrix(); key.target.updateMatrixWorld();
    key.shadow.normalBias = (sc.right - sc.left) / 2048 * 1.5;   // ~1.5 texels: no acne stripes on the gentle swells
    U.uKey.value.copy(Lk);
    hemi.position.copy(focus === near.centre ? cam.eye.clone().sub(near.centre).normalize() : cam.look.clone().sub(near.centre).normalize());
    // the sun: just above the nearest limb
    space.sunFor(camera, EARTH.centre, RP, altE, sunE, cam.sun);
    space.sunFor(camera, MOON.centre, MOON.R, altM * 3, sunM, cam.sun);
    const wm = THREE.MathUtils.smoothstep(altE - altM * 3, -40, 40);
    const sunDir = sunE.clone().lerp(sunM, wm).normalize();
    U.uSun.value.copy(sunDir);
    space.U.uE.value.copy(EARTH.centre); space.U.uER.value = RP; space.U.uEO.value = THREE.MathUtils.smoothstep(altE, 40, 300);
    space.U.uM.value.copy(MOON.centre); space.U.uMR.value = MOON.R; space.U.uMO.value = THREE.MathUtils.smoothstep(altM, 15, 120);
    const moonSky = near === MOON ? 1 - THREE.MathUtils.smoothstep(altM, 4, 40) : 0;
    space.U.uMoonSky.value = moonSky;
    space.sun.scale.setScalar(Math.max(1e-3, 1 - moonSky));   // no sun disc in the lounge's sky
    space.update(camera, sunDir);
    space.sun.up.copy(cU); space.sun.lookAt(camera.position);
    // (over a long, log-spaced altitude band: the trees sprinkle in over the whole second half of a dive)
    forest.reveal.value = 1 - THREE.MathUtils.smoothstep(Math.log(Math.max(1, altE)), Math.log(FOREST_ALT * 0.62), Math.log(FOREST_ALT * 2.4));
    forest.group.visible = forest.reveal.value > 0.001;
    // pencil tents: kept a few pixels wide for the current view (rescaled in place only when that changes >12%)
    farLines.visible = altE > 14; moonFarLines.visible = altM > 5;
    const lookD = cam.eye.distanceTo(cam.look) * 0.7;
    for (const t of tents) if (setTentWidth(t, tentWidth(Math.max(t.body === MOON ? altM : altE, lookD)))) dirty = true;
    glows.update(cam.eye, altE);
    setLOD(Math.min(altE, altM * 2));
    brushK = 1 - 0.66 * THREE.MathUtils.smoothstep(Math.min(altE, altM * 3), 70, 240);
    U.uHazeAmt.value = (0.14 * THREE.MathUtils.smoothstep(Math.min(altE, altM * 3), 10, 220) + 0.04) * LOOK.haze;
    // the painted two-tone light is the orbit's look; near the ground it gives way to the map's own Lambert + cobalt
    U.uPaintLight.value = 0.3 + 0.45 * THREE.MathUtils.smoothstep(Math.min(altE, altM * 3), 110, 300);   // a thin limb haze: decisive shapes, not pastel
  }

  // ---------- loop ----------
  const clock = new THREE.Clock();
  let raf = 0, running = false, held = 0, dirty = true, time = 0;
  function animateGrowth(dt) {
    let any = false;
    for (const it of home.items) if (it.g.visible && it.k < 1) { it.k = Math.min(1, it.k + dt / 0.9); const e = SMOOTHER(it.k); it.g.scale.set(1, Math.max(0.02, e), 1); any = true; }
    return any;
  }
  function loop() {
    if (!running) return;
    const dt = Math.min(clock.getDelta(), 0.1);
    tick(dt);
    raf = requestAnimationFrame(loop);
  }
  let acc = 0;
  function tick(dt) {
    // camera moves advance every animation frame; the paint is held at 12 / 24 fps (Riso / Gouache)
    time += dt * (ctx.reduceMotion ? 0.15 : 1);
    animateGrowth(dt);
    placeCamera(dt);
    const m = painter.mode;
    acc += dt;
    const hold = m === 1 ? 1 / 24 : 1 / 12;
    if (m === 2 || acc >= hold || dirty) {
      acc = acc % hold;
      render();
    }
  }
  // a finer brush from afar: the orbit view is a miniature, so it is painted with the reference's own Brush size
  // control turned down (x0.62 in orbit -> x1 below ~120 up), which keeps small towns as buildings instead of
  // Kuwahara blocks. The user's own setting (the Gouache settings panel) stays the base.
  let brushBase = painter.G.brush, brushSet = null, brushK = 1;
  function render() {
    const m = painter.mode;
    if (brushSet !== null && painter.G.brush !== brushSet) brushBase = painter.G.brush;   // the user moved the slider
    painter.G.brush = brushSet = (LOOK.brush != null ? LOOK.brush : brushBase) * brushK;
    U.uTime.value = time; wonder.arch.update(time);
    if (m === 2) { renderer.shadowMap.needsUpdate = true; renderer.setRenderTarget(null); renderer.render(scene, camera); }
    // no folk on the globe: skip the folk pass (its targets stay cleared), so a paint = world + composite
    else { painter.renderWorld(); painter.composite(); }
    dirty = false;
  }
  painter.subscribe(() => { dirty = true; });

  function resize(w = W0(), h = H0()) {
    const wasFit = Math.abs(orbitT.dist - fitDist()) < 1;
    painter.resize(w, h);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    if (wasFit) { const d = fitDist(); orbitT.dist = d; orbitP.dist = d; ORBIT0.dist = d; }
    dirty = true;
  }
  const onResize = () => resize();
  painter.setMode(edition);
  resize();
  setHomeGrowth(0);
  placeCamera(0);

  const api = {
    THREE, ctx, kit, scene, camera, renderer, painter, earth, moon: moonBody, uniforms: U, space, glows, forest,
    places: {
      home: { id: 'home', name: GP.home.name },
      nations: GP.nations.map(n => ({ id: n.id, name: n.name, simName: n.simName, species: n.species })),
      wonder: { id: 'wonder', name: GP.wonder.name },
      moon: { id: 'moon', name: MOONGEO.places.meadow.name }
    },
    start() { if (running) return; running = true; clock.getDelta(); addEventListener('resize', onResize); raf = requestAnimationFrame(loop); },
    stop() { running = false; cancelAnimationFrame(raf); removeEventListener('resize', onResize); },
    resize, tick, render,
    orbit, dive, rise, flyToMoon, flyToEarth, snapTo, snapToFlat, diveView,
    setHomeGrowth, setHomeBuildings, setNationGrowth, setWorldBloom, getLook, setLook,
    setAutoSpin(on) { spin = !!on; }, setInput(on) { inputOn = !!on; },
    get mode() { return mode; }, get body() { return body.id; }, get busy() { return !!tween; }, get lastPlace() { return lastPlace; },
    toWorld: (fx, y, fz, id = 'earth') => toWorld(bodyOf(id), fx, y, fz),
    toFlat: (p, id = 'earth') => invWrap(bodyOf(id), p),
    markDirty() { dirty = true; },
    // camera clearance above each body's ground (for tests): >= 0 means never inside a planet
    stats() { return { eye: cam.eye.toArray(), clearE: cam.eye.distanceTo(EARTH.centre) - groundRadius(EARTH, cam.eye), clearM: cam.eye.distanceTo(MOON.centre) - groundRadius(MOON, cam.eye), mode, body: body.id, busy: !!tween }; },
    set forestAlt(v) { FOREST_ALT = v; dirty = true; },
    dispose() { api.stop(); }
  };
  if (onReady) setTimeout(() => onReady(api), 0);
  return api;
}
