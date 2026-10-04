// The world on the gouache map, seen the way a leader sees it (ART_DIRECTION §1): a high oblique bird's-eye over
// a painted relief of a real place. Our plot lies on gently rolling land by the sea; round it the coast, hills,
// a mountain range, headlands, the river and islands come from the shared flat layout (globe/geography.js, so the
// map's coast is the globe's), with map-side detail relief so it reads from above. It starts as the ivory relief
// map of mb 1 (paper land, soft relief light, teal paper-crinkled sea, warm glows on our camp and the far
// towns) and colour blooms in as we build (fields in striped bands, meadows, sand paths, round trees: mb 4 / 5).
// Everything is drawn through the verbatim paint engine (web/js/paint/).
//
//   import { createWorld, worldCamBase } from './js/world/world.js';
//   import { makeNav } from './js/world/nav.js';
//   import * as geography from './js/globe/geography.js';
//   const backdrop = createBackdrop(ctx, { camBase: worldCamBase() });          // or let the world make it
//   const world = createWorld(ctx, kit, game, { geography, backdrop });
//   const folk = createFolk(ctx, backdrop, makeNav(game, world));
//   const painter = createPainter(ctx, folk, { framing: world.framing });
//   loop: world.update(dt, t); folk.update(dt, t); painter.frame(dt, t, tt => world.beforeDraw(tt));

import { createBackdrop } from '../paint/backdrop.js';
import { buildGround, SEA_Y, GROUND_LOOK } from './ground.js';
import { buildLake, buildSea, SEA_LOOK } from './water.js';
import { buildScenery } from './scenery.js';
import { buildNeighbours } from './horizon.js';
import { buildGlows } from './glow.js';
import { planDressing, meadowMask } from './dressing.js';
import { createCameraRig, DEFAULT_VIEW, VIEWS, eyeOf } from './camera.js';
export { makeNav } from './nav.js';
export { DEFAULT_VIEW, VIEWS, ZOOM, pitchForDist } from './camera.js';

// the key light: the reference's colour and intensity, re-aimed on the map side only. The reference light comes
// from the left and a little toward the viewer (azimuth ~35 deg off the west, ~33 deg up). Seen from the leader's
// height that front light flattens the relief, so the map turns it to come across the land from the west (the
// left of the leader view, a touch toward the viewer) at about the reference's height: slopes read by their
// light and shadow sides, and hills and trees throw their shadows east across the land (mb 1). (Lower suns were
// tried: the west hills then shade a third of our plot.)
export const KEY_ELEVATION = 0.56;   // radians (~32 deg, about the reference's own)
export const KEY_AZIMUTH = 0.22;     // radians from due west toward the south (the reference's is ~0.62)
// the LOOK CONTRACT (world.getLook / world.setLook, plain JSON, applied live; docs/world.md "Look"). sunAz is the
// compass bearing the light comes FROM in degrees (0 north = the sea / -z, 90 east = +x, 180 south, 270 west);
// sunEl its height in degrees. brush: the Kuwahara radius for this view (null = the painter's own G.brush, scaled by
// the view: smaller far out); camPitch (rad) / camDist (m) / camFov (deg): the leader view.
export const WORLD_LOOK = {
  sunAz: 270 - KEY_AZIMUTH * 180 / Math.PI, sunEl: KEY_ELEVATION * 180 / Math.PI,
  keyIntensity: 0.85, keyColor: '#ffe0bc', hemiIntensity: 0.62, hemiSky: '#b8cfd8', hemiGround: '#c89a6a',
  ...GROUND_LOOK, ...SEA_LOOK, coastLine: 1, brush: null,
  camPitch: 1.0, camDist: 168, camFov: 40
};

// the backdrop's camBase: the sun is placed 380 out from it, due north, facing it. It belongs to the low 'eye'
// view (the only one that sees the horizon), so pass this to createBackdrop.
export function worldCamBase(view = VIEWS.eye) { return eyeOf(view, new THREE.Vector3()); }

export function createWorld(ctx, kit, game, { geography: geo, backdrop = null, view = DEFAULT_VIEW, scenery = true, neighbours = true,
  moon = true, autoBloom = true, autoLevel = true, plotOutline = true, glows = true, input = {}, trees = true, dressing = true } = {}) {
  if (!geo) throw new Error('createWorld: pass { geography } (web/js/globe/geography.js)');
  const { scene } = ctx;
  const st = game.state;
  if (geo.setWater) geo.setWater(st.water);
  const camBase = worldCamBase(VIEWS.eye);
  const root = new THREE.Group(); root.name = 'world'; scene.add(root);

  // ---------- backdrop: the reference sky / sun / lights, re-aimed for the map ----------
  if (!backdrop) backdrop = createBackdrop(ctx, { camBase });
  else {   // made by the caller: put the sun where the eye view sees it set
    backdrop.sun.position.copy(camBase).add(backdrop.sunDir.clone().multiplyScalar(380)); backdrop.sun.lookAt(camBase);
    backdrop.sunPos && backdrop.sunPos.copy(backdrop.sun.position);
  }
  // the reference's sea plane and straight foam strip belong to its terrace; the map lays its own sea (water.js,
  // the same shader + depth and paper crinkle) and paints foam on the real coast
  for (const o of [backdrop.sea, backdrop.foam]) if (o && o.parent) {
    o.parent.remove(o);
    for (const list of [ctx.colourOnly, ctx.folkHidden]) { const i = list.indexOf(o); if (i >= 0) list.splice(i, 1); }
  }
  // the reference's two far ridge cut-outs stand at z -300 / -320; from the leader's height they read as
  // slivers lying on the sea, so they go (the map has real far land)
  for (const o of [...scene.children]) {
    if (o.isMesh && o.geometry && o.geometry.type === 'ShapeGeometry' && (o.position.z === -300 || o.position.z === -320)) {
      scene.remove(o); const i = ctx.colourOnly.indexOf(o); if (i >= 0) ctx.colourOnly.splice(i, 1);
    }
  }
  // the key light: same colour and intensity, same bearing, a lower sun; its shadow camera follows the view
  const key = backdrop.key;
  const keyDirOf = (az, el) => { const a = THREE.MathUtils.degToRad(az), e = THREE.MathUtils.degToRad(el); return new THREE.Vector3(Math.sin(a) * Math.cos(e), Math.sin(e), -Math.cos(a) * Math.cos(e)); };
  const KEY_DIR = keyDirOf(WORLD_LOOK.sunAz, WORLD_LOOK.sunEl);
  key.shadow.mapSize.set(4096, 4096); if (key.shadow.map) { key.shadow.map.dispose(); key.shadow.map = null; }
  key.shadow.bias = -0.00035; if ('normalBias' in key.shadow) key.shadow.normalBias = 0.04;
  let shadowFit = '';
  function fitShadow(cx, cz, dist) {
    const half = Math.min(240, Math.max(36, dist * 1.05 + 14));
    const qh = Math.pow(1.25, Math.ceil(Math.log(half) / Math.log(1.25)));     // stepped sizes: no swimming
    const texel = qh * 2 / 4096, qx = Math.round(cx / (texel * 8)) * texel * 8, qz = Math.round(cz / (texel * 8)) * texel * 8;
    const sig = qh.toFixed(2) + '|' + qx.toFixed(2) + '|' + qz.toFixed(2);
    if (sig === shadowFit) return;
    shadowFit = sig;
    const D = 260 + qh;
    key.target.position.set(qx, 0, qz); key.position.copy(key.target.position).addScaledVector(KEY_DIR, D);
    Object.assign(key.shadow.camera, { left: -qh, right: qh, top: qh, bottom: -qh, near: D - 220 - qh * 0.4, far: D + 120 + qh * 0.6 });
    key.shadow.camera.updateProjectionMatrix(); key.target.updateMatrixWorld(); key.updateMatrixWorld();
  }
  fitShadow(view.tx, view.tz, view.dist);

  // ---------- ground (the relief, the plot, the bloom) ----------
  const lakeW = st.water.find(w => w.kind === 'lake' && w.poly && w.poly.length > 2);
  const ground = buildGround(ctx, geo, { lake: lakeW ? lakeW.poly : null });
  root.add(ground.contours);
  ground.uniforms.uOutline.value = plotOutline ? 1 : 0;
  root.add(ground.mesh);
  root.add(ground.landProxy);

  // ---------- water: the sea (depth-coloured, crinkled paper) and the lake (the reference pool) ----------
  const sea = buildSea(ctx, { depth: ground.depthTexture(), sunDir: backdrop.sunDir, keyDir: KEY_DIR, y: SEA_Y, parent: root });
  // ---------- what grows on the land ----------
  const sceneryOut = scenery ? buildScenery(ctx, kit, ground, geo, { parent: root, game: trees ? game : null }) : null;
  // contours never run under the woods or the dressing's trees (the trees are colour-only: a line would cross their crowns)
  function maskContours(extra = []) {
    if (!sceneryOut || !sceneryOut.variants) return;
    const cell = 3, H = new Set(), keyOf = (i, j) => i * 100003 + j;
    const mark = (x, z, r) => { for (let i = Math.floor((x - r) / cell); i <= Math.floor((x + r) / cell); i++) for (let j = Math.floor((z - r) / cell); j <= Math.floor((z + r) / cell); j++) H.add(keyOf(i, j)); };
    for (const v of sceneryOut.variants) for (const t of v.list) mark(t.x, t.z, v.r * t.s + 0.8);
    for (const t of extra) mark(t.x, t.z, t.r + 0.8);
    ground.setContourMask((x, z) => H.has(keyOf(Math.floor(x / cell), Math.floor(z / cell))));
  }
  const lake = lakeW ? buildLake(ctx, lakeW.poly, { parent: root, hideInReflection: () => (sceneryOut ? (sceneryOut.reflectionHidden ? sceneryOut.reflectionHidden() : sceneryOut.woods) : []) }) : null;

  // ---------- glows: our camp and the far towns ----------
  const glow = glows ? buildGlows(ctx, { parent: root }) : null;
  if (glow) {
    const sp = st.spawn || st.centre;
    glow.add('home', sp.x, ground.groundY(sp.x, sp.z) + 3, sp.z, { size: 40, strength: 0.62, near: 70 });
    for (const n of geo.places.nations) glow.add(n.id, n.x, ground.groundY(n.x, n.z) + 6, n.z, { size: 70, strength: 1.0, near: 80 });
  }

  // ---------- old tracks: from our plot's edges toward the neighbours and up into the hills (mb 1's roads) ----------
  // each one walks the land in 4 m steps, choosing the gentlest way toward its goal; it fords the river
  function walkTrack(from, to, maxSteps = 60) {
    const pts = [[from.x, from.z]]; let x = from.x, z = from.z, hd = Math.atan2(to.z - z, to.x - x);
    const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
    for (let k = 0; k < maxSteps; k++) {
      const goal = Math.atan2(to.z - z, to.x - x); let best = null;
      for (let da = -1.05; da <= 1.051; da += 0.15) {
        const a = goal + da, nx = x + Math.cos(a) * 4, nz = z + Math.sin(a) * 4;
        if (ground.shoreS(nx, nz) < 1.2) continue;
        const gy0 = ground.groundY(x, z), gy1 = ground.groundY(nx, nz);
        const cost = Math.abs(gy1 - gy0) * 2.6 + Math.abs(da) * 1.1 + Math.abs(wrap(a - hd)) * 0.9 + (gy1 < -0.5 ? 5 : 0);
        if (!best || cost < best.c) best = { c: cost, a, nx, nz };
      }
      if (!best) break;
      hd = best.a; x = best.nx; z = best.nz; pts.push([x, z]);
      if (Math.hypot(to.x - x, to.z - z) < 6) break;
    }
    return pts;
  }
  const P0 = st.plot;
  const trackEnds = [
    [{ x: P0.x0 + 2, z: 6 }, (() => { const n = geo.places.nations.find(o => o.id === 'n1'); return n ? { x: n.x + 16, z: n.z + 8 } : { x: -95, z: -30 }; })()],
    [{ x: P0.x1 - 2, z: -8 }, (() => { const n = geo.places.nations.find(o => o.id === 'n2'); return n ? { x: n.x - 16, z: n.z + 10 } : { x: 90, z: -45 }; })()],
    [{ x: 4, z: P0.z1 - 2 }, { x: 14, z: 118 }],
    [{ x: P0.x1 - 4, z: P0.z1 - 2 }, { x: 70, z: 70 }]
  ];
  ground.setTracks(trackEnds.map(([a, b]) => walkTrack(a, b)));

  // ---------- the seaside dressing (§21): trees and green spots added to the old map, nothing else changed ----------
  const dress = dressing ? planDressing(geo, ground, st, { lakePoly: lakeW ? lakeW.poly : null, woods: sceneryOut ? sceneryOut.variants : null, treesOn: !!(sceneryOut && trees) }) : { trees: [], meadows: [] };
  if (dress.meadows.length) ground.setMeadows(meadowMask(geo, ground, dress.meadows, { C: geo.GEO.C, lakePoly: lakeW ? lakeW.poly : null }));
  if (sceneryOut && trees && dress.trees.length) sceneryOut.dressTrees(dress.trees);
  maskContours(dress.trees);

  // ---------- camera ----------
  const rig = createCameraRig(ctx, { ground, geo, view, blockers: sceneryOut ? sceneryOut.tall : [], input });

  const world = {
    ctx, game, geo, root, backdrop, ground, lake, sea, scenery: sceneryOut, glows: glow, rig, cameraRig: rig, camBase, keyDir: KEY_DIR, dressing: dress,
    neighbours: null, moon: null, views: VIEWS,
    // camera
    framing: (cam, w, h) => rig.framing(cam, w, h),
    descent: o => rig.descent(o), focus: (x, z, o) => rig.focus(x, z, o), upClose: (t, o) => rig.upClose(t, o), back: o => rig.back(o),
    visit: (id, o) => rig.visit(id, o), home: o => rig.home(o), view: (name, o) => rig.goView(name, o),
    lookAt: (p, o) => rig.lookAt(p, o), lookToward: (x, z, o) => rig.lookToward(x, z, o),
    // a nation on its headland / island, from our coast: the leader's tilted look ({ cinematic: true } = the old long lens)
    showNeighbour: (id, o = {}) => { const n = nation(id); if (!n) return Promise.resolve(false); return o.cinematic ? rig.lookToward(n.x, n.z, { y: n.y + 7, ...o }) : rig.frameToward(n.x, n.z, o); },
    pick: (cx, cy) => rig.pick(cx, cy), project: (x, y, z) => rig.project(x, y, z),
    // ground
    groundY: (x, z) => ground.groundY(x, z), inPlot: (x, z) => geo.inPlot(x, z),
    isWater: (x, z) => !!rig.surface(x, z).water,
    waterAt: (x, z) => rig.surface(x, z).water,
    level: (key, o) => { const y = ground.level(key, o); if (sceneryOut) sceneryOut.restand(); return y; },
    unlevel: key => { ground.unlevel(key); if (sceneryOut) sceneryOut.restand(); },
    siteY: b => (b && ground.pads.has(b.id) ? ground.pads.get(b.id).y : ground.groundY(b.x, b.z)),
    // colour
    bloom: (x, z, r, o) => ground.bloom(x, z, r, o), path: (ax, az, bx, bz, o) => ground.path(ax, az, bx, bz, o), unbloom: k => ground.unbloom(k),
    bloomBuilding, setWorldBloom: (v, o) => ground.setWorldBloom(v, o),
    plant: (x, z, o) => (sceneryOut ? sceneryOut.plant(x, z, o) : null),
    // neighbours: where each nation is, the direction to it, and where its envoys cross our plot's edge
    nation, nations: () => geo.places.nations.map(n => nation(n.id)),
    update, beforeDraw, getLook, setLook, usePainter, handoffPose, readyForHandoff
  };

  // ---------- the landing hand-off (§21): the planet's descent cross-fades into this map at a matched framing ----------
  // handoffPose({ view, aspect }) -> { eye:{x,y,z}, look:{x,y,z}, up:{x,y,z}, fov, fovV, aspect, pose, near, far, descend }:
  // the leader view's camera (or any named view / pose), with the portrait widening applied for that aspect.
  // fov is the rig's own (horizontal-safe) vertical fov in degrees; fovV the one actually used at that aspect.
  function handoffPose({ view: v = 'leader', aspect = null } = {}) {
    const p = typeof v === 'string' ? (v === 'leader' ? { ...rig.view } : { ...(VIEWS[v] || rig.view) }) : { ...rig.view, ...v };
    const a = aspect || ctx.camera.aspect || 16 / 10;
    const e = eyeOf(p, new THREE.Vector3());
    const fovV = a >= 1.3 ? p.fov : THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(p.fov) / 2) * 1.3 / a));
    return { eye: { x: e.x, y: e.y, z: e.z }, look: { x: p.tx, y: p.ty, z: p.tz }, up: { x: 0, y: 1, z: 0 }, fov: p.fov, fovV, aspect: a,
      pose: p, near: ctx.camera.near, far: ctx.camera.far,
      // the same framing for her planet (planet/adapter.js descendTo / cameraLocal take game x, z and the game's yaw,
      // same convention as this rig: yaw 0 = the eye on the +z side looking toward the sea, pitch = angle down)
      descend: { x: p.tx, z: p.tz, dist: p.dist, pitch: p.pitch, yaw: p.yaw, fov: fovV } };
  }
  // readyForHandoff({ painter, warm = true }) -> Promise<pose>: everything the map draws is built (nations, the trees.js
  // kinds, the dressing), its programs are compiled, and (with a painter) one painted frame has been made at the
  // hand-off pose, so the first visible frame after the cross-fade costs nothing extra. Resolves with handoffPose().
  let handoffP = null;
  function readyForHandoff({ painter: pt = null, warm = true } = {}) {
    if (handoffP) return handoffP;
    handoffP = (async () => {
      await world.ready;
      if (sceneryOut && trees) { try { await sceneryOut.ready(); } catch (e) { /* the woods stand anyway */ } }
      const pose = handoffPose();
      if (warm) {
        const r = ctx.renderer;
        rig.place();
        try { r.compile(ctx.scene, ctx.camera); } catch (e) { /* older three */ }
        await new Promise(res => requestAnimationFrame(() => res()));
        const p = pt || painter || (typeof window !== 'undefined' && (window.__agora || window.__lab) ? (window.__agora || window.__lab).painter : null);
        if (p && p.renderPainted) { beforeDraw(performance.now() / 1000); try { p.renderPainted(); } catch (e) { /* the caller's loop paints */ } }
      }
      return pose;
    })();
    return handoffP;
  }

  function nation(id) {
    const n = geo.places.nations.find(o => o.id === id); if (!n) return null;
    const C = st.centre, dx = n.x - C.x, dz = n.z - C.z, l = Math.hypot(dx, dz), ux = dx / l, uz = dz / l, P = st.plot;
    const tx = ux > 0 ? (P.x1 - C.x) / ux : ux < 0 ? (P.x0 - C.x) / ux : Infinity, tz = uz > 0 ? (P.z1 - C.z) / uz : uz < 0 ? (P.z0 - C.z) / uz : Infinity;
    const t = Math.min(tx, tz) - 1;
    return { id, name: n.name, x: n.x, y: ground.groundY(n.x, n.z), z: n.z, dir: { x: ux, z: uz }, edge: { x: C.x + ux * t, z: C.z + uz * t }, colours: n.colours };
  }

  // ---------- building pads: a site's ground is levelled the moment it is laid out ----------
  const padOf = b => b && b.status !== 'removed' && !b.floating && !(b.shape && (b.shape.pts || (b.shape.poly && !b.shape.rect)));
  function levelBuilding(b) {
    if (!padOf(b)) return null;
    const w = b.footprint.w, d = b.footprint.d;
    const y = world.level(b.id, { x: b.x, z: b.z, w, d, rot: b.rot || 0 });
    if (sceneryOut) sceneryOut.clearRect(b.x, b.z, w, d, b.rot || 0);
    return y;
  }
  world.levelBuilding = levelBuilding;
  if (autoLevel) {
    game.on('building:site', e => levelBuilding(e.building));
    game.on('building:design', e => levelBuilding(e.building));   // a design can bring a new footprint or a shifted site
    for (const b of st.buildings) levelBuilding(b);
  }

  // ---------- the colour bloom, driven by the game ----------
  // bloomBuilding(b): a brushy disc of paint round it, sand paths to its two nearest finished neighbours, a few
  // trees growing in round it, and our plot's lushness creeping out with the town (mb 4 / 5)
  const treed = new Set();
  function bloomBuilding(b, { ms = 2000, delay = 0, paths = true, trees: withTrees = true } = {}) {
    if (!b || b.status === 'removed') return null;
    const r = Math.max(b.footprint.w, b.footprint.d) * 0.7 + 5.5;
    const bl = ground.bloom(b.x, b.z, r, { ms, key: b.id, delay });
    const done = st.buildings.filter(o => o.status === 'done' || o === b);
    if (paths) {
      const others = done.filter(o => o !== b && Math.hypot(o.x - b.x, o.z - b.z) < 24)
        .sort((p, q) => Math.hypot(p.x - b.x, p.z - b.z) - Math.hypot(q.x - b.x, q.z - b.z)).slice(0, 2);
      for (const o of others) ground.path(b.x, b.z, o.x, o.z, { key: [b.id, o.id].sort().join('|'), delay: delay + ms * 0.6, ms: 1500 });
    }
    if (withTrees && sceneryOut && !treed.has(b.id)) { treed.add(b.id); plantRound(b, r, delay + ms * 0.35); }
    // the town's own green: a soft wash centred on what we've built, growing with every building
    if (done.length >= 2) {
      let cx = 0, cz = 0; for (const o of done) { cx += o.x; cz += o.z; } cx /= done.length; cz /= done.length;
      ground.bloom(cx, cz, Math.min(34, 7 + Math.sqrt(done.length) * 7.5), { key: '__town', ms: ms * 1.4, delay: delay + ms * 0.5 });
    }
    return bl;
  }
  // a few trees round a finished building, on free ground in its bloom ring
  function plantRound(b, r, delay) {
    const R = ctx.mulberry32(Math.round(b.x * 131 + b.z * 977) >>> 0);
    const blocked = (x, z) => {
      if (!geo.inPlot(x, z) || x < st.plot.x0 + 1.5 || x > st.plot.x1 - 1.5 || z < st.plot.z0 + 2 || z > st.plot.z1 - 1.5) return true;
      if (ground.inLake(x, z)) return true;
      if (lakeW && lakeW.poly.some(([lx, lz]) => Math.hypot(lx - x, lz - z) < 2.2)) return true;
      for (const o of st.buildings) {
        if (o.status === 'removed') continue;
        const c = Math.cos(o.rot || 0), s = Math.sin(o.rot || 0), dx = x - o.x, dz = z - o.z;
        if (Math.abs(dx * c - dz * s) < o.footprint.w / 2 + 2.2 && Math.abs(dx * s + dz * c) < o.footprint.d / 2 + 2.2) return true;
      }
      for (const p of ground.paths) { const ax = p.ax, az = p.az, ex = p.bx - ax, ez = p.bz - az, t = Math.max(0, Math.min(1, ((x - ax) * ex + (z - az) * ez) / (ex * ex + ez * ez || 1))); if (Math.hypot(ax + ex * t - x, az + ez * t - z) < 1.8) return true; }
      if (Math.hypot(x - st.spawn.x, z - st.spawn.z) < 4) return true;
      for (const t of sceneryOut.plot.trees) if (Math.hypot(t.x - x, t.z - z) < 3) return true;
      return false;
    };
    const n = 2 + Math.floor(R() * 3);
    let planted = 0;
    for (let k = 0; k < 24 && planted < n; k++) {
      const a = R() * Math.PI * 2, d = r * (0.62 + R() * 0.42), x = b.x + Math.cos(a) * d, z = b.z + Math.sin(a) * d;
      if (blocked(x, z)) continue;
      sceneryOut.plant(x, z, { delay: delay + planted * 260, ms: 1700 });
      planted++;
    }
  }
  if (autoBloom) {
    game.on('building:done', e => bloomBuilding(e.building));
    game.on('building:remove', e => { ground.unbloom(e.id); });
    for (const b of st.buildings) if (b.status === 'done') bloomBuilding(b, { ms: 1, paths: true });
  }

  // ---------- neighbours + sky moon (async: they load other modules) ----------
  world.ready = (async () => {
    if (neighbours) {
      try { world.neighbours = await buildNeighbours(ctx, kit, ground, geo, { parent: root }); }
      catch (e) { console.warn('world: neighbours failed', e); }
    }
    if (moon) {
      try {
        const { createSkyMoon } = await import('./moon.js');
        world.moon = createSkyMoon(ctx, { position: moonPosition(VIEWS.eye), radius: 21 });
      } catch (e) { console.warn('world: sky moon unavailable', e); }
    }
    if (sceneryOut && trees) { try { await sceneryOut.ready(); } catch (e) { /* the woods stand anyway */ } }
    return world;
  })();

  // ---------- the look (LOOK CONTRACT, shared with the globe and the gouache lab) ----------
  const look = { ...WORLD_LOOK, bloomPalette: [...WORLD_LOOK.bloomPalette] };
  let painter = null, brushBase = null, brushSet = null, lastDist = -1, lastVS = '';
  function usePainter(p) { painter = p || null; brushBase = painter ? painter.G.brush : null; brushSet = null; return world; }
  function markDirty() { if (painter && painter.markDirty) painter.markDirty(); }
  function setLook(p = {}) {
    if (!p || typeof p !== 'object') return getLook();
    const has = k => p[k] !== undefined && p[k] !== null;
    if (has('sunAz') || has('sunEl')) {
      if (has('sunAz')) look.sunAz = +p.sunAz; if (has('sunEl')) look.sunEl = Math.max(2, Math.min(89, +p.sunEl));
      KEY_DIR.copy(keyDirOf(look.sunAz, look.sunEl)); shadowFit = '';
      sea.material.uniforms.uKey.value.copy(KEY_DIR);
      const p0 = rig.cur; fitShadow(p0.tx, p0.tz, p0.dist);
    }
    if (has('keyIntensity')) { look.keyIntensity = +p.keyIntensity; key.intensity = look.keyIntensity; }
    if (has('keyColor')) { look.keyColor = p.keyColor; key.color.set(p.keyColor); }
    if (has('hemiIntensity')) { look.hemiIntensity = +p.hemiIntensity; if (backdrop.hemi) backdrop.hemi.intensity = look.hemiIntensity; }
    if (has('hemiSky')) { look.hemiSky = p.hemiSky; if (backdrop.hemi) backdrop.hemi.color.set(p.hemiSky); }
    if (has('hemiGround')) { look.hemiGround = p.hemiGround; if (backdrop.hemi) backdrop.hemi.groundColor.set(p.hemiGround); }
    const gk = {}; for (const k of Object.keys(GROUND_LOOK)) if (has(k)) gk[k] = p[k];
    if (Object.keys(gk).length) { ground.setLook(gk); Object.assign(look, ground.getLook()); if (has('reliefScale') && sceneryOut) sceneryOut.restandAll && sceneryOut.restandAll(); }
    const sk = {}; for (const k of ['waterShallow', 'waterDeep', 'haze']) if (has(k)) sk[k] = p[k];
    if (Object.keys(sk).length) { sea.setLook(sk); Object.assign(look, { ...sea.getLook(), haze: look.haze }); }
    if (has('coastLine')) look.coastLine = Math.max(0, Math.min(1, +p.coastLine));
    if (p.brush !== undefined) { look.brush = p.brush === null ? null : Math.max(1, Math.min(8, +p.brush)); }
    if (has('camPitch') || has('camDist') || has('camFov')) {
      if (has('camPitch')) look.camPitch = +p.camPitch; if (has('camDist')) look.camDist = +p.camDist; if (has('camFov')) look.camFov = +p.camFov;
      Object.assign(rig.view, { pitch: look.camPitch, dist: look.camDist, fov: look.camFov });
      if (rig.mode === 'map' && !rig.busy) rig.setPose({ ...rig.pose(), pitch: look.camPitch, dist: look.camDist, fov: look.camFov });
    }
    if (sceneryOut && sceneryOut.setIvory) sceneryOut.setIvory(1 - ground.uniforms.uWorld.value);
    markDirty();
    return getLook();
  }
  function getLook() {
    const pose = rig.view;
    return JSON.parse(JSON.stringify({ ...look, ...ground.getLook(), ...sea.getLook(), camPitch: pose.pitch, camDist: pose.dist, camFov: pose.fov }));
  }
  // the woods are muted olive-sepia masses in the start state (mb 1) and take their colour with the world's bloom
  ground.onWorldBloom(v => { if (sceneryOut && sceneryOut.setIvory) sceneryOut.setIvory(1 - v); });
  if (sceneryOut && sceneryOut.setIvory) sceneryOut.setIvory(1);
  // per view: the pencil tents' width (~2 internal px) and the brush (smaller far out, like the globe's orbit)
  function perView(p) {
    if (!painter && typeof window !== 'undefined') {   // the game / labs make the painter after the world: find it
      const w = window.__agora || window.__lab; if (w && w.painter && w.painter.G) usePainter(w.painter);
    }
    const ih = painter && painter.internalSize ? painter.internalSize.ih : (ctx.renderer.domElement.height || 900);
    const mpp = 2 * p.dist * Math.tan(THREE.MathUtils.degToRad(ctx.camera.fov) / 2) / Math.max(200, ih);
    const sig = mpp.toFixed(4) + '|' + Math.round(p.dist / 20);
    if (sig !== lastVS) { lastVS = sig; ground.setViewScale(mpp, p.dist); }
    if (painter && painter.G) {
      if (brushSet !== null && painter.G.brush !== brushSet) brushBase = painter.G.brush;   // the user moved the slider
      if (brushBase == null) brushBase = painter.G.brush;
      const k = look.brush != null ? 1 : 0.62 + 0.38 * (1 - THREE.MathUtils.smoothstep(p.dist, 150, 330));
      const b = Math.max(1, Math.round((look.brush != null ? look.brush : brushBase) * k * 2) / 2);
      if (b !== painter.G.brush) { painter.G.brush = b; painter.markDirty && painter.markDirty(); }
      brushSet = painter.G.brush;
    }
    ground.uniforms.uCamPos.value.copy(ctx.camera.position);
    // contour lines are the MAP's: seen from the low eye view they'd be dashes across the beach
    ground.contours.visible = p.pitch > 0.5 && rig.mode !== 'close';
  }

  // ---------- per frame ----------
  let busy = false;
  function update(dt, t) {
    rig.update(dt);
    busy = ground.update(dt);
    if (sceneryOut && sceneryOut.update(dt)) busy = true;
    return busy;
  }
  function beforeDraw(t) {
    rig.place();
    const p = rig.cur;
    fitShadow(p.tx, p.tz, p.dist);
    perView(p);
    backdrop.update(t); sea.update(t);
    if (lake) lake.update(t);
    if (glow) glow.update(p.dist, ctx.camera.position);
  }
  return world;
}

// the moon high left of the sun in the eye view (docs/voyage.md: ~380 from the eye, left of the sun's bearing)
function moonPosition(view) {
  const cam = new THREE.PerspectiveCamera(view.fov, 16 / 10, 0.5, 1400);
  cam.position.copy(eyeOf(view)); cam.lookAt(view.tx, view.ty, view.tz); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
  const p = new THREE.Vector3(-0.5, 0.74, 0.5).unproject(cam).sub(cam.position).normalize();
  const pos = cam.position.clone().addScaledVector(p, 380);
  if (pos.length() > 560) pos.setLength(560);
  return pos;
}
