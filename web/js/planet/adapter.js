// The surface adapter: our game lives in flat space (the sim, the nav, folk.js, the marks, x east / z south / y up,
// 1 unit = 1 m) and is drawn on Sueda's Tower Planet. New code (docs/planet.md "Adapter"); her look is untouched.
//
//   const drawn = createDrawnGround(planet)          // the planet mesh itself: exact heights where the GPU draws them
//   const adapter = createSurfaceAdapter(planet, { geography })   // geography = createPlanetGeography(planet) (home.js)
//
// Coordinates. "game" = the geography's frame (the sim's: the plot is x -30..30, z -26..30, the sea beyond z0);
// "planet flat" = her design space (terrain.js: C on the pole, mapFlat). geography.toPlanet / fromPlanet is a
// rigid turn + shift between them. Without a geography the adapter works in planet flat units directly.
//
// Heights. Her mesh is a 420 x 280 lat-long sphere (about 2 m a cell at home) whose vertices sit at max(H, 0):
// between vertices the drawn ground is the triangle, not H (up to ~0.3 m apart on the meadow). groundY reads the
// triangle the GPU draws, so a foot set at groundY touches the paint.
import { C, RP, mapFlat, H, heightCore, MAX_RELIEF } from './terrain.js';

const TAU = Math.PI * 2;

/* ================= the drawn ground (her planet mesh, read back) ================= */
// Works on the live mesh (planet.world.ground) or, with no planet (node tests), rebuilds the same vertices from
// heightCore exactly as build.js does.
export function createDrawnGround(planet = null, { segments = null } = {}) {
  let geo = planet && planet.world && planet.world.ground && planet.world.ground.geometry;
  if (!geo) {
    const [SW, SH] = segments || [420, 280];
    geo = new THREE.SphereGeometry(1, SW, SH);
    const p = geo.attributes.position, n = p.count, aW = new Float32Array(n);
    for (let i = 0; i < n; i++) {   // build.js lines 427-436 (positions) and 446 (aW), nothing else
      const dx = p.getX(i), dy = Math.max(-1, Math.min(1, p.getY(i))), dz = p.getZ(i);
      const th = Math.acos(dy), s = Math.sin(th);
      const ux = s > 1e-6 ? dx / s : 0, uz = s > 1e-6 ? dz / s : 1;
      const h = heightCore(C.x + ux * th * RP, C.z + uz * th * RP, dx, dy, dz, th, uz);
      const r = RP + Math.max(h, 0);
      p.setXYZ(i, dx * r, dy * r, dz * r);
      aW[i] = h < 0 ? -h : -1;
    }
    geo.setAttribute('aW', new THREE.BufferAttribute(aW, 1));
  }
  const SW = geo.parameters.widthSegments, SH = geo.parameters.heightSegments;
  const P = geo.attributes.position.array, AW = geo.attributes.aW ? geo.attributes.aW.array : null;
  const RS = geo.attributes.aRS ? geo.attributes.aRS.array : null, CO = geo.attributes.color ? geo.attributes.color.array : null;
  const ROW = SW + 1;
  const hit = { r: RP, i0: 0, i1: 0, i2: 0, w0: 1, w1: 0, w2: 0 };
  // radial ray (0 -> unit d) against the triangle (i0, i1, i2): plane hit + barycentrics (unclamped)
  function tri(dx, dy, dz, i0, i1, i2) {
    const ax = P[i0 * 3], ay = P[i0 * 3 + 1], az = P[i0 * 3 + 2];
    const e1x = P[i1 * 3] - ax, e1y = P[i1 * 3 + 1] - ay, e1z = P[i1 * 3 + 2] - az;
    const e2x = P[i2 * 3] - ax, e2y = P[i2 * 3 + 1] - ay, e2z = P[i2 * 3 + 2] - az;
    const nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x;
    const nd = nx * dx + ny * dy + nz * dz; if (Math.abs(nd) < 1e-12) return false;
    const r = (nx * ax + ny * ay + nz * az) / nd;
    // barycentrics of the hit q = r d in the triangle's plane
    const qx = dx * r - ax, qy = dy * r - ay, qz = dz * r - az;
    const d00 = e1x * e1x + e1y * e1y + e1z * e1z, d01 = e1x * e2x + e1y * e2y + e1z * e2z, d11 = e2x * e2x + e2y * e2y + e2z * e2z;
    const d20 = qx * e1x + qy * e1y + qz * e1z, d21 = qx * e2x + qy * e2y + qz * e2z, den = d00 * d11 - d01 * d01;
    const v = (d11 * d20 - d01 * d21) / den, w = (d00 * d21 - d01 * d20) / den;
    hit.r = r; hit.i0 = i0; hit.i1 = i1; hit.i2 = i2; hit.w0 = 1 - v - w; hit.w1 = v; hit.w2 = w;
    return hit.w0 > -1e-6 && v > -1e-6 && w > -1e-6;
  }
  // the drawn triangle under unit direction d: SphereGeometry's own layout (a,b,d) / (b,c,d) per cell
  function locate(dx, dy, dz) {
    const th = Math.acos(Math.max(-1, Math.min(1, dy)));
    let ph = Math.atan2(dz, -dx); if (ph < 0) ph += TAU;
    const u = ph / TAU * SW, v = th / Math.PI * SH;
    for (const [ou, ov] of [[0, 0], [0, -1], [0, 1], [-1, 0], [1, 0]]) {   // the cell, then its neighbours (seam / round-off)
      let ix = Math.floor(u) + ou, iy = Math.min(SH - 1, Math.max(0, Math.floor(v) + ov));
      ix = ((ix % SW) + SW) % SW;
      const a = iy * ROW + ix + 1, b = iy * ROW + ix, c = (iy + 1) * ROW + ix, d = (iy + 1) * ROW + ix + 1;
      if (iy !== 0 && tri(dx, dy, dz, a, b, d)) return hit;
      if (iy !== SH - 1 && tri(dx, dy, dz, b, c, d)) return hit;
    }
    return hit;   // the last plane tried (never seen off the poles)
  }
  const _d = new THREE.Vector3();
  const flatDir = (fx, fz) => mapFlat(fx, 0, fz, _d).divideScalar(RP);
  return {
    SW, SH, geometry: geo,
    // drawn altitude above the sphere along the radial through a world direction (any length)
    altAlong(v) { const l = Math.hypot(v.x, v.y, v.z); return locate(v.x / l, v.y / l, v.z / l).r - RP; },
    // drawn altitude at a planet-flat point (the sea is drawn at 0)
    alt(fx, fz) { const d = flatDir(fx, fz); return locate(d.x, d.y, d.z).r - RP; },
    // her aW interpolated: > -0.4 is painted as water (the ground shader's own test)
    wat(fx, fz) {
      if (!AW) return H(fx, fz) < 0 ? 1 : -1;
      const d = flatDir(fx, fz), h = locate(d.x, d.y, d.z);
      return AW[h.i0] * h.w0 + AW[h.i1] * h.w1 + AW[h.i2] * h.w2;
    },
    // the painted cover at a point: { sand, rock, snow, grass } from her per-vertex colour / aRS (build.js 437-447)
    cover(fx, fz) {
      const d = flatDir(fx, fz), h = locate(d.x, d.y, d.z), w = [h.w0, h.w1, h.w2], ii = [h.i0, h.i1, h.i2];
      let sand = 0, rock = 0, snow = 0, wat = 0;
      for (let k = 0; k < 3; k++) {
        const i = ii[k];
        if (AW) wat += AW[i] * w[k];
        if (CO) sand += CO[i * 3 + 2] * w[k];
        if (RS) { rock += RS[i * 2] * w[k]; snow += RS[i * 2 + 1] * w[k]; }
      }
      return { sand, rock, snow, water: wat > -0.4 };
    },
    // the drawn ground's normal (world) at a planet-flat point: the triangle's own face normal
    normal(fx, fz, out = new THREE.Vector3()) {
      const d = flatDir(fx, fz), h = locate(d.x, d.y, d.z);
      const a = h.i0 * 3, b = h.i1 * 3, c = h.i2 * 3;
      const e1x = P[b] - P[a], e1y = P[b + 1] - P[a + 1], e1z = P[b + 2] - P[a + 2];
      const e2x = P[c] - P[a], e2y = P[c + 1] - P[a + 1], e2z = P[c + 2] - P[a + 2];
      out.set(e1y * e2z - e1z * e2y, e1z * e2x - e1x * e2z, e1x * e2y - e1y * e2x).normalize();
      if (out.dot(d) < 0) out.negate();
      return out;
    }
  };
}

/* ================= the adapter ================= */
export function createSurfaceAdapter(planet, { geography = null, drawn = null } = {}) {
  const { scene, camera } = planet;
  drawn = drawn || (geography && geography.drawn) || createDrawnGround(planet);
  const G = geography;
  const ROT = G ? G.FRAME.rot : 0, cR = Math.cos(ROT), sR = Math.sin(ROT);
  // game (x, z) -> planet flat (fx, fz) and back (identity without a geography)
  const toPlanet = G ? G.toPlanet : (x, z, o = {}) => { o.fx = x; o.fz = z; return o; };
  const fromPlanet = G ? G.fromPlanet : (fx, fz, o = {}) => { o.x = fx; o.z = fz; return o; };
  const qTurn = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -ROT);   // game axes -> planet flat axes
  const V = () => new THREE.Vector3();
  const _a = V(), _b = V(), _e = V(), _n = V(), _s = V(), _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _pf = {}, _gf = {};

  // ---- heights (game coords) ----
  const groundY = (x, z) => { const p = toPlanet(x, z, _pf); return drawn.alt(p.fx, p.fz); };
  const waterLevel = (x, z) => (G ? G.waterLevel(x, z) : (drawn.wat(x, z) > -0.4 ? 0 : null));
  const surfaceY = (x, z) => { const w = waterLevel(x, z), g = groundY(x, z); return w == null ? g : Math.max(w, g); };

  // ---- the local frame: up radial, east = planet flat +x, south = +z; quaternion for game-built objects ----
  function frameQ(fx, fz, out) {
    mapFlat(fx, 0, fz, _n).normalize();
    mapFlat(fx + 0.5, 0, fz, _e).sub(mapFlat(fx - 0.5, 0, fz, _a));
    _e.addScaledVector(_n, -_e.dot(_n)).normalize(); _s.crossVectors(_e, _n);
    return out.setFromRotationMatrix(_m.makeBasis(_e, _n, _s));
  }
  // game point + altitude -> world (y = altitude above the sphere, as mapFlat)
  function toWorld(x, y, z, out = V()) { const p = toPlanet(x, z, _pf); return mapFlat(p.fx, y, p.fz, out); }
  // world -> game { x, y, z } (y = altitude above the sphere), the exact inverse
  function toFlat(w, out = {}) {
    const r = Math.hypot(w.x, w.y, w.z), s = Math.hypot(w.x, w.z), th = Math.atan2(s, w.y), d = th * RP;
    const ux = s > 1e-12 ? w.x / s : 0, uz = s > 1e-12 ? w.z / s : 1;
    const g = fromPlanet(C.x + ux * d, C.z + uz * d, _gf);
    out.x = g.x; out.y = r - RP; out.z = g.z; return out;
  }
  // { position, quaternion, up, ground } for an object built upright in game space (y up), rot = its rotation.y
  function frame(x, z, { rot = 0, yOffset = 0, y = null, normal = false } = {}) {
    const p = toPlanet(x, z, _pf), g = drawn.alt(p.fx, p.fz);
    const alt = y != null ? y : g + yOffset;
    const position = mapFlat(p.fx, alt, p.fz, V());
    const quaternion = frameQ(p.fx, p.fz, new THREE.Quaternion());
    const up = mapFlat(p.fx, 0, p.fz, V()).normalize();
    if (normal) { const nn = drawn.normal(p.fx, p.fz, V()); quaternion.premultiply(_q.setFromUnitVectors(up, nn)); }
    quaternion.multiply(qTurn);
    if (rot) quaternion.multiply(_q.setFromAxisAngle(_a.set(0, 1, 0), rot));
    return { position, quaternion, up, ground: g, fx: p.fx, fz: p.fz };
  }
  // stand a world object on the drawn ground at game (x, z). footprint {w, d}: sit on the LOWEST ground under it
  // (no corner floats), else on the ground at its centre. The object is tagged as world space (never mapped).
  function place(obj, x, z, { rot = 0, yOffset = 0, y = null, footprint = null, normal = false, parent = planet.surface } = {}) {
    let yy = y;
    if (yy == null && footprint) {
      const hw = footprint.w / 2, hd = footprint.d / 2, c = Math.cos(rot), s = Math.sin(rot);
      let lo = Infinity;
      for (const [u, v] of [[0, 0], [-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd], [0, -hd], [0, hd], [-hw, 0], [hw, 0]]) {
        lo = Math.min(lo, groundY(x + c * u + s * v, z - s * u + c * v));
      }
      yy = lo + yOffset;
    }
    const f = frame(x, z, { rot, yOffset, y: yy, normal });
    obj.position.copy(f.position); obj.quaternion.copy(f.quaternion);
    obj.userData.planetWorld = true;
    if (parent && obj.parent !== parent) parent.add(obj);
    obj.updateMatrixWorld(true);
    return f;
  }

  // ---- picking through her lens, on the DRAWN ground (and the lake's water) ----
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), _o = V(), _dir = V(), _w = V();
  function fishUV(x, y) {   // views.js fishUV (her post's fish())
    const u = planet.post.post.uniforms, o = u.uOut.value, a = o.x / o.y, F = u.uFish.value;
    let px = (x - 0.5) * a, py = y - 0.5; const k = 1 / (1 + F * (px * px + py * py)); px *= k; py *= k;
    return [px / a + 0.5, py + 0.5];
  }
  function surfaceAlong(w) {   // the drawn surface altitude under a world point, water included
    const g = drawn.altAlong(w);
    if (!G || !G.lake) return g;
    const f = toFlat(w, _gf2);
    const wl = G.waterLevel(f.x, f.z);
    return wl == null ? g : Math.max(g, wl);
  }
  const _gf2 = {};
  function rayHit(origin, dir) {
    const R1 = RP + MAX_RELIEF, b = origin.dot(dir), c = origin.lengthSq() - R1 * R1, disc = b * b - c;
    if (disc < 0) return null;
    const sq = Math.sqrt(disc), tEnd = -b + sq; if (tEnd < 0) return null;
    const gap = t => { _w.copy(origin).addScaledVector(dir, t); return _w.length() - RP - surfaceAlong(_w); };
    let t0 = Math.max(0, -b - sq), g0 = gap(t0), t1 = t0, ok = g0 <= 0;
    for (let i = 0; i < 6000 && !ok && t1 < tEnd; i++) { t1 = t0 + Math.max(0.05, g0 * 0.5); const g1 = gap(t1); if (g1 <= 0) { ok = true; break; } t0 = t1; g0 = g1; }
    if (!ok) return null;
    for (let i = 0; i < 30; i++) { const tm = (t0 + t1) / 2; if (gap(tm) > 0) t0 = tm; else t1 = tm; }
    return origin.clone().addScaledVector(dir, t1);
  }
  // screen -> { x, z, y, fx, fz, world, onWater, water: 'sea' | 'lake' | null, inPlot } | null (the sky)
  function pick(clientX, clientY) {
    const r = planet.renderer.domElement.getBoundingClientRect();
    const [sx, sy] = fishUV((clientX - r.left) / r.width, 1 - (clientY - r.top) / r.height);
    ndc.set(sx * 2 - 1, sy * 2 - 1); camera.updateMatrixWorld(); ray.setFromCamera(ndc, camera);
    const world = rayHit(_o.copy(ray.ray.origin), _dir.copy(ray.ray.direction));
    if (!world) return null;
    const f = toFlat(world, {}), p = toPlanet(f.x, f.z, {});
    const water = G ? G.waterKind(f.x, f.z) : (drawn.wat(p.fx, p.fz) > -0.4 ? 'sea' : null);
    return { x: f.x, z: f.z, y: f.y, fx: p.fx, fz: p.fz, world, onWater: !!water, water,
      inPlot: G ? G.inPlot(f.x, f.z) : false };
  }
  // world point (or game x, y, z) -> client pixels through her lens
  function toScreen(a, y, z) { return planet.toScreen(a && a.isVector3 ? a : toWorld(a, y, z, _b)); }

  /* ---- the flat camera: her camera expressed in game space (folk.js turns idle folk to camera.position.x/z) ---- */
  const flatCamera = new THREE.PerspectiveCamera(40, 1, 0.5, 2000);
  flatCamera.name = 'planet-flat-camera';
  const _qi = new THREE.Quaternion();
  function syncFlatCamera() {
    const f = toFlat(camera.position, {}), p = toPlanet(f.x, f.z, {});
    flatCamera.position.set(f.x, f.y, f.z);
    // world -> local frame -> game axes
    frameQ(p.fx, p.fz, _q); _qi.copy(_q).multiply(qTurn).invert();
    flatCamera.quaternion.copy(_qi).multiply(camera.quaternion);
    flatCamera.fov = camera.fov; flatCamera.aspect = camera.aspect; flatCamera.updateProjectionMatrix();
    flatCamera.updateMatrixWorld();
    return flatCamera;
  }

  /* ---- the folk mapping: flat transforms -> the sphere for the render, then back ---- */
  // Everything that was in the scene before the adapter (her world, planet.surface) is world space, and so is any
  // object tagged userData.planetWorld (adapter.place tags). Every OTHER direct child of the scene is flat space:
  // folk roots, their world-space legs and feet (folk.allLimbs), blob shadows, the agents' props, puffs, piles.
  const worldSet = new Set(scene.children);
  const isFlat = o => !worldSet.has(o) && !o.userData.planetWorld && !o.isCamera;
  const saved = [];   // [obj, px, py, pz, qx, qy, qz, qw, vis]
  let mapped = false, hidden = false;
  const flatObjects = () => scene.children.filter(isFlat);
  function blobSet(folk) {
    const s = new Set(); if (!folk) return s;
    for (const k of ['creatures', 'hoppers', 'drops', 'scoots', 'flits', 'pips', 'floaties']) for (const a of folk[k] || []) if (a.blob) s.add(a.blob);
    return s;
  }
  // hide every flat object (her colour pass must not see them); remembers visibility for show()
  function hideFlat() {
    if (hidden) return; hidden = true; hiddenList.length = 0;
    for (const o of scene.children) if (isFlat(o)) { hiddenList.push(o, o.visible); o.visible = false; }
  }
  const hiddenList = [];
  function showFlat() {
    if (!hidden) return; hidden = false;
    for (let i = 0; i < hiddenList.length; i += 2) hiddenList[i].visible = hiddenList[i + 1];
    hiddenList.length = 0;
  }
  const _np = V(), _nq = new THREE.Quaternion(), _up = V(), _nn = V();
  // map every flat object onto the sphere (blobs lie on the drawn ground's own slope)
  function mapFolk(folk = null) {
    if (mapped) restore();
    const blobs = blobSet(folk);
    saved.length = 0;
    for (const o of scene.children) {
      if (!isFlat(o)) continue;
      const p = o.position, q = o.quaternion;
      saved.push(o, p.x, p.y, p.z, q.x, q.y, q.z, q.w);
      const pf = toPlanet(p.x, p.z, _pf);
      frameQ(pf.fx, pf.fz, _nq);
      if (blobs.has(o)) {   // the soft shadow: on the drawn ground, tilted to its slope
        const g = drawn.alt(pf.fx, pf.fz);
        // a parked shadow (agents.js parks unplaced folk's blobs at y -100, and its per-frame ground offset then
        // drifts them): keep it under the ground, not as a dark disc at the plot's origin (polish 2026-10-04)
        const parked = Math.abs(p.y - g) > 30;
        mapFlat(pf.fx, parked ? g - 60 : g + 0.02, pf.fz, _np);
        _up.copy(_np).normalize(); drawn.normal(pf.fx, pf.fz, _nn);
        _nq.premultiply(_q.setFromUnitVectors(_up, _nn));
      } else mapFlat(pf.fx, p.y, pf.fz, _np);
      _nq.multiply(qTurn).multiply(q);
      p.copy(_np); q.copy(_nq);
    }
    mapped = true;
    return saved.length / 8;
  }
  function restore() {
    if (!mapped) return; mapped = false;
    for (let i = 0; i < saved.length; i += 8) {
      const o = saved[i]; o.position.set(saved[i + 1], saved[i + 2], saved[i + 3]); o.quaternion.set(saved[i + 4], saved[i + 5], saved[i + 6], saved[i + 7]);
    }
    saved.length = 0;
  }

  /* ---- cameras in game terms (yaw: 0 = the camera on the game's +z side of the point, looking toward -z) ---- */
  const yawToPlanet = yaw => yaw - ROT;
  const yawFromPlanet = psi => psi + ROT;
  function localOpts(o = {}) {
    const r = { ...o };
    if (o.x != null || o.z != null) { const p = toPlanet(o.x ?? 0, o.z ?? 0, {}); r.fx = p.fx; r.fz = p.fz; delete r.x; delete r.z; }
    if (o.yaw != null) r.yaw = yawToPlanet(o.yaw);
    return r;
  }
  const cameraLocal = (o = {}) => planet.cameraLocal(localOpts(o));
  const descendTo = (o = {}) => planet.descendTo(localOpts(o));

  return {
    drawn, geography: G, ROT, toPlanet, fromPlanet,
    groundY, surfaceY, waterLevel, toWorld, toFlat, frame, place, pick, toScreen, rayHit,
    flatCamera, syncFlatCamera, mapFolk, restore, hideFlat, showFlat, flatObjects, isFlat,
    markWorld(obj) { obj.userData.planetWorld = true; return obj; },
    get mapped() { return mapped; },
    yawToPlanet, yawFromPlanet, cameraLocal, descendTo
  };
}
