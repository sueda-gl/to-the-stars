// The Build API: the ONLY surface prefabs and generated code may use. Everything it makes is painted in the
// Red arch grammar: painted-light vertex colours (kit.bake + kit.paintMat) on props and roofs, Lambert on big
// walls so they catch real shadows, the reference clay cel shader for small toys, ink-dark openings, and
// smooth invisible proxies for keylines. Ground y=0, footprint centred on the origin, 1 unit = 1 m.
//
//   const api = createBuildApi(ctx, kit, { keyDir })        // one per world; cheap
//   const make = compileAsset(code)                          // generated `function build(api){...}` text
//   const group = make(api)                                  // throws AssetError on anything unsound
//
// Internals (ctx, kit, finish, register...) are kept in a WeakMap, never on the api object that the
// generated code sees: `internals(api)`.

import { createTreeBuilders } from './trees.js';
import { toPts, surfaceGeo, ribbonGeo, smooth as smoothLine, band, frame as areaFrame, area as polyArea, mergeGeos } from './shapes.js';

const INTERNAL = new WeakMap();
export const internals = api => INTERNAL.get(api);

// ---------- palettes: dark -> light, hue-shifted (cool/red shade, warm light) ----------
// bake() puts a face's colour at v = 0.5 n.L + 0.3 n.y + 0.4: tops ~0.95, the lit left face ~0.75,
// the front ~0.6, the back ~0.2, the right (away from the sun) ~0.05. Stop 2 is the "front" colour.
export const RAMPS = {
  TERRACOTTA: ['#6c2a1c', '#93402a', '#b65231', '#cd653a', '#de7b47'],
  LIMESTONE: ['#8c7860', '#ae977a', '#cdb795', '#e1cfae', '#eee0c4'],
  REDWALL: ['#641c15', '#8a281e', '#b3362a', '#c64434', '#d6573e'],
  OCHRE: ['#734d1a', '#9c6c20', '#c4902d', '#dbab41', '#e9c25a'],
  WHITEWASH: ['#a39686', '#c7bba9', '#e3d9c7', '#efe7d7', '#f8f1e3'],
  WOOD: ['#432b1b', '#634028', '#865c38', '#a2764b', '#b98c5d'],
  SLATE: ['#353c48', '#4b5462', '#646d7c', '#7f8897', '#9aa1ad'],
  SEA: ['#164357', '#1d5d72', '#287e92', '#3f9aaa', '#62b3ba'],
  OLIVE: ['#2f3716', '#4a5422', '#6a7432', '#8a9445', '#a6ad5c'],
  PINE: ['#202a0f', '#4a5a1c', '#7f8f30', '#b7b452', '#e2d978'],          // kit.PALETTES.PINE
  PINK: ['#5a1530', '#a83863', '#e0779a', '#f6b6c6'],                     // kit.PALETTES.PINK
  RED: ['#4e1210', '#a62c26', '#e0603f', '#f4a07c'],                      // kit.PALETTES.RED
  YELLOW: ['#8a5414', '#c08519', '#e5ac22', '#f2c42a', '#f8d84e'],
  BLUE: ['#1d2a52', '#2a4178', '#33528e', '#4a6fae', '#6f93c8'],          // the reference ink, as paint
  SAGE: ['#38452f', '#526449', '#6f8762', '#8ea67d', '#a8bd94'],
  LAVENDER: ['#3f3055', '#5a477c', '#7a64a2', '#9682bc', '#ae9fd0'],
  SAND: ['#7d684e', '#a08868', '#c6ab84', '#dcc49c', '#e9d6b2'],
  IRON: ['#1f1d24', '#302c35', '#45414b', '#5b5661', '#746e78'],
  GOLD: ['#6e4512', '#9c681a', '#c9952c', '#e2b444', '#f0cc62'],
  INK: ['#21182a', '#2e2236', '#3b2c40', '#4a3848'],                     // openings: deep violet-brown, never black
  GLASS: ['#1b2a38', '#26404f', '#3a5e6c', '#6f939a']
};
RAMPS.STONE = RAMPS.LIMESTONE; RAMPS.CREAM = RAMPS.WHITEWASH; RAMPS.TERRA = RAMPS.TERRACOTTA; RAMPS.WHITE = RAMPS.WHITEWASH;
RAMPS.GREEN = RAMPS.OLIVE; RAMPS.BRICK = RAMPS.REDWALL; RAMPS.METAL = RAMPS.IRON; RAMPS.WATER = RAMPS.SEA;
Object.values(RAMPS).forEach(Object.freeze); Object.freeze(RAMPS);
// marks on the land: a road is a warm mid-value sand (it must stand off the cream paper from above), kerbs darker
const ROAD = Object.freeze(['#7a5d3c', '#94744c', '#ae8a5b', '#bf9a67', '#c9a571']);
const KERB = Object.freeze(['#5e4a36', '#76604a', '#8c775e', '#9d876c', '#a8927a']);
const EARTH = Object.freeze(['#5e4229', '#7a5636', '#946a43', '#a77b50', '#b48a5c']);

// the reference key light's direction (backdrop.js: key at (-28,22,14) aiming at (0,0,-6)) for the clay shader
const DEFAULT_KEY_DIR = () => new THREE.Vector3(-28, 22, 14).sub(new THREE.Vector3(0, 0, -6)).normalize();

export const LIMITS = Object.freeze({ maxMeshes: 400, maxSize: 60, minSize: 0.8, maxTriangles: 120000, maxSeg: 48 });

export class AssetError extends Error { constructor(msg, cause) { super(msg); this.name = 'AssetError'; this.cause = cause; } }

export function createBuildApi(ctx, kit, { keyDir = null, seed = 1 } = {}) {
  const { col, colourOnly, lineOnly } = ctx;
  const KEY = keyDir ? keyDir.clone() : DEFAULT_KEY_DIR();
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  let rand = ctx.mulberry32(seed);
  const num = (v, d) => (typeof v === 'number' && isFinite(v) ? v : d);
  const clampSeg = (s, d) => Math.max(3, Math.min(LIMITS.maxSeg, Math.round(num(s, d))));

  // ================= materials =================
  // a ramp is an array of 3-6 hex strings, dark -> light. Anything else that looks like a colour becomes one.
  const rampCache = new Map();
  function rampFrom(hex) {   // a 5-stop painted ramp around one colour, shaded cool, lit warm
    const key = String(hex).toLowerCase(); if (rampCache.has(key)) return rampCache.get(key);
    const c = col(hex), hsl = {}; c.getHSL(hsl);
    const stop = (dh, ds, dl) => '#' + new THREE.Color().setHSL((hsl.h + dh + 1) % 1, Math.min(1, Math.max(0, hsl.s + ds)), Math.min(0.95, Math.max(0.06, hsl.l + dl))).getHexString();
    const r = Object.freeze([stop(-0.03, 0.04, -0.28), stop(-0.015, 0.04, -0.15), '#' + c.getHexString(), stop(0.008, 0, 0.06), stop(0.018, -0.03, 0.12)]);
    rampCache.set(key, r); return r;
  }
  function toRamp(r) {
    if (Array.isArray(r) && r.length >= 2) return r;
    if (typeof r === 'string') { const k = r.toUpperCase(); if (RAMPS[k]) return RAMPS[k]; return rampFrom(r); }
    if (typeof r === 'number') return rampFrom('#' + new THREE.Color(r).getHexString());
    return RAMPS.LIMESTONE;
  }
  const lamCache = new Map();
  // lambert(hex, lift): the reference's big-plane material (key + hemi light, real shadows). `lift` adds a
  // little of the colour back as emissive so pale walls stay pale under the warm dusk light (0 = the reference).
  function lambert(hex = '#efe4d2', lift = 0.22) {
    lift = Math.max(0, Math.min(0.6, num(lift, 0.22)));
    const k = String(hex).toLowerCase() + '|' + lift;
    let m = lamCache.get(k);
    if (!m) { m = new THREE.MeshLambertMaterial({ color: col(hex), emissive: col(hex).multiplyScalar(lift) }); m.userData.agoraKind = 'lambert'; lamCache.set(k, m); }
    return m;
  }
  // the reference's clay cel shader (folk.js clayMat), verbatim: three hard tones, a wobbly painted terminator
  const CLAY_VERT = `varying vec3 vN; varying vec3 vW; varying vec3 vObj;
    void main(){
      vec4 p = vec4(position, 1.0); vec3 nn = normal;
      #ifdef USE_INSTANCING
        p = instanceMatrix * p; nn = mat3(instanceMatrix) * nn;
      #endif
      vObj = position;
      vec4 w = modelMatrix * p; vW = w.xyz;
      vN = normalize(mat3(modelMatrix) * nn);
      gl_Position = projectionMatrix * modelViewMatrix * p;
    }`;
  const CLAY_FRAG = `uniform vec3 uLight, uBase, uShade, uRim, uStripeCol; uniform float uRibs, uStripeF, uStripeMode, uClipY, uClipZ;
    varying vec3 vN; varying vec3 vW; varying vec3 vObj;
    void main(){
      float hem = 0.007 * sin(atan(vObj.x, vObj.z) * 9.0) + 0.005 * sin(vObj.x * 40.0);
      if (vObj.y > uClipY + hem || vObj.z > uClipZ + hem) discard;
      vec3 n = normalize(vN);
      float ndl = dot(n, uLight);
      float wob = (sin(vObj.y * 38.0 + vObj.x * 24.0) + sin(vObj.x * 31.0 - vObj.z * 27.0 + vObj.y * 9.0)) * 0.035;
      float band = ndl > 0.02 + wob ? 0.0 : ndl > -0.42 + wob ? 1.0 : 2.0;
      vec3 c = band < 0.5 ? uBase : band < 1.5 ? uShade : uRim;   // lit / shadow / deep shadow, no gradients
      if (uStripeF > 0.0 && sin((uStripeMode > 0.5 ? vObj.y : atan(vObj.y, vObj.x)) * uStripeF) > 0.0) c = uStripeCol * (band < 0.5 ? 1.0 : band < 1.5 ? 0.78 : 0.56);
      if (uRibs > 0.0) { float a = atan(vObj.y, vObj.x); c = mix(c, uShade, step(0.82, abs(sin(a * uRibs))) * 0.6); }
      gl_FragColor = vec4(c, 1.0);
    }`;
  function clayMat(base, shade, rim = '#c98a5c', ribs = 0) {
    return new THREE.ShaderMaterial({
      uniforms: { uLight: { value: KEY }, uBase: { value: col(base) }, uShade: { value: col(shade) }, uRim: { value: col(rim) }, uRibs: { value: ribs }, uStripeCol: { value: col('#ffffff') }, uStripeF: { value: 0 }, uStripeMode: { value: 0 }, uClipY: { value: 1e3 }, uClipZ: { value: 1e3 } },
      vertexShader: CLAY_VERT, fragmentShader: CLAY_FRAG
    });
  }
  const clayCache = new Map();
  function clay(base = '#f2c42a', shade, deep) {
    if (Array.isArray(base)) { const r = base; base = r[Math.min(r.length - 1, 2)]; shade = shade || r[1]; deep = deep || r[0]; }
    const c = col(base), hsl = {}; c.getHSL(hsl);
    shade = shade || '#' + new THREE.Color().setHSL((hsl.h - 0.02 + 1) % 1, Math.min(1, hsl.s + 0.05), Math.max(0.08, hsl.l - 0.14)).getHexString();
    deep = deep || '#' + new THREE.Color().setHSL((hsl.h - 0.05 + 1) % 1, Math.min(1, hsl.s + 0.05), Math.max(0.06, hsl.l - 0.3)).getHexString();
    const k = [base, shade, deep].join('|').toLowerCase();
    let m = clayCache.get(k);
    if (!m) { m = clayMat(base, shade, deep); m.userData.agoraKind = 'clay'; clayCache.set(k, m); }
    return m;
  }

  // ================= meshes =================
  const proxyMat = new THREE.MeshBasicMaterial();
  function tag(o, part, extra) { o.userData.agora = Object.assign({ part }, extra || {}); return o; }
  // paint(geo, ramp): painted light baked into vertex colours (re-baked in the finished object's frame by finish())
  function paint(geo, ramp = RAMPS.LIMESTONE, { speck = 0.16, lift = 0 } = {}) {
    const r = toRamp(ramp);
    if (!geo.attributes.normal) geo.computeVertexNormals();
    kit.bake(geo, r, speck, lift);
    const m = new THREE.Mesh(geo, kit.paintMat); m.castShadow = true;
    return tag(m, 'paint', { ramp: r, speck, lift });
  }
  // mesh(geo, mat|ramp|hex): the one way to turn a geometry into a part
  function mesh(geo, mat, opts) {
    if (mat && mat.isMaterial) {
      const m = new THREE.Mesh(geo, mat);
      const kind = mat.userData.agoraKind || 'material';
      m.castShadow = true; m.receiveShadow = kind === 'lambert';
      return tag(m, kind);
    }
    return paint(geo, mat, opts);
  }
  function proxy(geo, parent) {
    const m = new THREE.Mesh(geo, proxyMat); m.visible = false; lineOnly.push(m);
    tag(m, 'proxy'); m.userData.agoraLine = true;
    if (parent && parent.isObject3D) parent.add(m);
    return m;
  }
  function colourOnlyFn(obj) {
    if (!obj || !obj.isObject3D) return obj;
    obj.userData.agoraColour = true; if (!colourOnly.includes(obj)) colourOnly.push(obj);
    return obj;
  }
  const group = (o = {}) => { const g = new THREE.Group(); place(g, o); g.rotation.y = num(o.rot, 0); tag(g, 'group'); return g; };

  // place a finished part: rot (Y), rx, rz are baked into the geometry so the painted light stays true;
  // the mesh sits at (x, y, z). sx/sy/sz scale the geometry.
  function shapeGeo(geo, o) {
    const sx = num(o.sx, 1), sy = num(o.sy, 1), sz = num(o.sz, 1);
    if (sx !== 1 || sy !== 1 || sz !== 1) geo.scale(sx, sy, sz);
    if (num(o.rx, 0)) geo.rotateX(o.rx);
    if (num(o.rz, 0)) geo.rotateZ(o.rz);
    if (num(o.rot, 0)) geo.rotateY(o.rot);
    return geo;
  }
  function place(obj, o) { obj.position.set(num(o.x, 0), num(o.y, 0), num(o.z, 0)); return obj; }
  function matOf(o, fallback = RAMPS.LIMESTONE) { return o.mat || o.material || o.ramp || o.color || o.colour || fallback; }
  function part(geo, o, name, fallback) { const m = mesh(shapeGeo(geo, o), matOf(o, fallback), o); m.userData.agora.part = name; return place(m, o); }
  const segsFor = (len, per = 1.1, max = 8) => Math.max(1, Math.min(max, Math.round(len / per)));

  // ---------- geometry: *Geo(o) bakes sx/sy/sz, rx/rz/rot and (x, y, z) into the geometry (for proxies) ----------
  const at = (g, o) => { shapeGeo(g, o); g.translate(num(o.x, 0), num(o.y, 0), num(o.z, 0)); return g; };
  function boxGeo(o = {}) {
    const w = num(o.w, 1), h = num(o.h, 1), d = num(o.d, 1);
    return at(new THREE.BoxGeometry(w, h, d, segsFor(w), segsFor(h), segsFor(d)), o);
  }
  function cylinderGeo(o = {}) {
    const r = num(o.r, 0.5), rt = num(o.rt, num(o.rTop, r)), rb = num(o.rb, num(o.rBottom, r)), h = num(o.h, 1);
    return at(new THREE.CylinderGeometry(rt, rb, h, clampSeg(o.seg, 20), segsFor(h, 1.2, 6), !!o.open), o);
  }
  function coneGeo(o = {}) {
    return at(new THREE.ConeGeometry(num(o.r, 0.5), num(o.h, 1), clampSeg(o.seg, 20), segsFor(num(o.h, 1), 1.2, 6)), o);
  }
  function sphereGeo(o = {}) {
    const s = clampSeg(o.seg, 20);
    return at(new THREE.SphereGeometry(num(o.r, 0.5), s, Math.max(3, Math.round(s * 0.66))), o);
  }
  const v2 = p => (p && p.isVector2 ? p : new THREE.Vector2(num(p[0], 0), num(p[1], 0)));
  function latheGeo(o = {}) {
    const pts = (o.points || [[0.5, 0], [0.5, 1]]).map(v2).map(p => new THREE.Vector2(Math.max(0, p.x), p.y));
    const g = new THREE.LatheGeometry(pts, clampSeg(o.seg, 20));
    g.computeVertexNormals();
    return at(g, o);
  }
  function toShape(s) {
    if (s && s.isShape) return s;
    const sh = new THREE.Shape(), pts = (s || []).map(v2);
    if (pts.length < 3) { sh.moveTo(-0.5, 0); sh.lineTo(0.5, 0); sh.lineTo(0, 1); sh.closePath(); return sh; }
    sh.moveTo(pts[0].x, pts[0].y); pts.slice(1).forEach(p => sh.lineTo(p.x, p.y)); sh.closePath(); return sh;
  }
  function extrudeGeo(o = {}) {
    const depth = num(o.depth, 0.3);
    const g = new THREE.ExtrudeGeometry(toShape(o.shape || o.points), { depth, bevelEnabled: !!o.bevel, bevelSize: num(o.bevel, 0.04), bevelThickness: num(o.bevel, 0.04), bevelSegments: 2, curveSegments: clampSeg(o.curveSeg, 16) });
    g.translate(0, 0, -depth / 2);
    return at(g, o);
  }

  // ---------- primitives: (x, y, z) is the CENTRE ----------
  const box = (o = {}) => part(boxGeo({ w: o.w, h: o.h, d: o.d }), o, 'box');
  const cylinder = (o = {}) => part(cylinderGeo({ r: o.r, rt: o.rt, rb: o.rb, rTop: o.rTop, rBottom: o.rBottom, h: o.h, seg: o.seg, open: o.open }), o, 'cylinder');
  const cone = (o = {}) => part(coneGeo({ r: o.r, h: o.h, seg: o.seg }), o, 'cone');
  const sphere = (o = {}) => part(sphereGeo({ r: o.r, seg: o.seg }), o, 'sphere');
  // lathe / extrude: (x, y, z) is where the profile's origin goes
  const lathe = (o = {}) => part(latheGeo({ points: o.points, seg: o.seg }), o, 'lathe');
  const extrude = (o = {}) => part(extrudeGeo({ shape: o.shape, points: o.points, depth: o.depth, bevel: o.bevel, curveSeg: o.curveSeg }), o, 'extrude');

  // ---------- roofs and domes: y is the EAVES (bottom) ----------
  function gableGeo(w, d, h, over) {
    const W = w + over * 2, D = d / 2 + over, slope = h / (d / 2), H = h + over * slope;
    const s = new THREE.Shape(); s.moveTo(-D, -over * slope); s.lineTo(D, -over * slope); s.lineTo(0, H - over * slope); s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: W, bevelEnabled: false });
    g.translate(0, 0, -W / 2); g.rotateY(Math.PI / 2);   // ridge along x
    return g;
  }
  function gableRoof(o = {}) {
    const w = num(o.w, 4), d = num(o.d, 4), h = num(o.h, d * 0.38), over = num(o.overhang, 0.25);
    const g = gableGeo(w, d, h, over);
    return part(g, o, 'gableRoof', RAMPS.TERRACOTTA);
  }
  function hipRoof(o = {}) {
    const over = num(o.overhang, 0.25), w = num(o.w, 4) + over * 2, d = num(o.d, 4) + over * 2, h = num(o.h, Math.min(w, d) * 0.32);
    const hw = w / 2, hd = d / 2, r = Math.max(0, (w - d) / 2), rz = Math.max(0, (d - w) / 2);
    const A = V(-hw, 0, hd), B = V(hw, 0, hd), C = V(hw, 0, -hd), D = V(-hw, 0, -hd);
    const P = V(-r, h, -rz), Q = V(r, h, rz);   // ridge ends (equal when the roof is square: a pyramid)
    const tris = w >= d ? [[A, B, Q], [A, Q, P], [B, C, Q], [C, D, P], [C, P, Q], [D, A, P], [A, D, C], [A, C, B]]
      : [[A, B, Q], [B, C, P], [B, P, Q], [C, D, P], [D, A, Q], [D, Q, P], [A, D, C], [A, C, B]];
    const pos = [];
    tris.forEach(t => t.forEach(p => pos.push(p.x, p.y, p.z)));
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.computeVertexNormals();
    return part(g, o, 'hipRoof', RAMPS.TERRACOTTA);
  }
  function dome(o = {}) {
    const r = num(o.r, 2), h = num(o.h, r), s = clampSeg(o.seg, 28);
    const g = new THREE.SphereGeometry(r, s, Math.max(4, Math.round(s / 3)), 0, Math.PI * 2, 0, Math.PI / 2); g.scale(1, h / r, 1);
    return part(g, o, 'dome', RAMPS.TERRACOTTA);
  }

  // ---------- arches: the reference wall's round head (Shape + absarc) ----------
  function archShape(w, h) {   // round-headed outline standing on y=0, total height h
    const r = w / 2, spring = Math.max(0, h - r), s = new THREE.Shape();
    s.moveTo(-r, 0); s.lineTo(r, 0); s.lineTo(r, spring); s.absarc(0, spring, r, 0, Math.PI, false); s.lineTo(-r, 0);
    return s;
  }
  function rectShape(w, h) { const s = new THREE.Shape(); s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(w / 2, h); s.lineTo(-w / 2, h); s.closePath(); return s; }
  // a wall slab pierced by `arches` round-headed openings; y is the base, z the wall's centre plane
  function archWall(o = {}) {
    const w = num(o.w, 6), h = num(o.h, 4), d = num(o.d, 0.5), n = Math.max(0, Math.min(12, Math.round(num(o.arches, 1))));
    const aw = num(o.archW, Math.min(w / Math.max(1, n) * 0.6, h * 0.7)), ah = Math.min(h - 0.2, num(o.archH, h * 0.72));
    const s = new THREE.Shape(); s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(w / 2, h); s.lineTo(-w / 2, h); s.lineTo(-w / 2, 0);
    for (let i = 0; i < n; i++) {
      const cx = -w / 2 + (i + 0.5) * w / n, r = aw / 2, spring = Math.max(0.05, ah - r), hole = new THREE.Path();
      hole.moveTo(cx - r, 0.0001); hole.lineTo(cx + r, 0.0001); hole.lineTo(cx + r, spring); hole.absarc(cx, spring, r, 0, Math.PI, false); hole.lineTo(cx - r, 0.0001);
      s.holes.push(hole);
    }
    const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false, curveSegments: 24 }); g.translate(0, 0, -d / 2);
    return part(g, o, 'archWall', o.mat || o.ramp || o.color ? undefined : RAMPS.REDWALL);
  }
  // ink-dark openings: a thin extruded recess, proud of the face by depth/2. Windows: y is the CENTRE.
  function opening(o, w, h, y0, arched, name) {
    const g = group({ x: o.x, y: y0, z: o.z }); g.rotation.y = num(o.rot, 0); tag(g, name);
    const depth = num(o.depth, 0.1);
    const geo = new THREE.ExtrudeGeometry(arched ? archShape(w, h) : rectShape(w, h), { depth, bevelEnabled: false, curveSegments: 16 });
    geo.translate(0, 0, -depth / 2 + 0.005);
    const ink = paint(geo, o.ink || RAMPS.INK, { speck: 0.08, lift: 0.1 }); ink.castShadow = false; ink.userData.agora.part = name + '.ink'; g.add(ink);
    const frame = o.frame === undefined ? (name === 'window' ? RAMPS.LIMESTONE : null) : o.frame;
    if (frame && o.sill !== false) {   // a pale sill / step
      const sill = paint(new THREE.BoxGeometry(w + 0.18, 0.08, depth + 0.12), frame, { speck: 0.1 });
      sill.position.set(0, -0.04, 0.03); g.add(sill);
    }
    if (o.shutters) {   // Mediterranean shutters either side, in a painted colour
      const sr = toRamp(o.shutters);
      [-1, 1].forEach(sd => { const sh = paint(new THREE.BoxGeometry(w * 0.5, h * (arched ? 0.82 : 1), 0.06), sr, { speck: 0.1 }); sh.position.set(sd * (w * 0.75 + 0.04), h * (arched ? 0.41 : 0.5), 0.02); g.add(sh); });
    }
    g.add(sketchRidge(arched ? archShape(w, h) : rectShape(w, h), depth / 2 + 0.01));
    return g;
  }
  // the pencil outline of an opening for the SKETCH phase only: a thin steep ridge along the shape's edge (the
  // keyline pass finds lines at normal breaks, and a flush ink slab has none). Invisible, in no list: the reveal
  // lends it to ctx.lineOnly while the object is a drawing, so the doors and windows are drawn too.
  function sketchRidge(shape, z0) {
    const pts = shape.getPoints(12), pos = [], hw = 0.03, ht = 0.07;
    if (pts.length > 1 && pts[0].distanceTo(pts[pts.length - 1]) < 1e-4) pts.pop();
    const n = pts.length;
    for (let i = 0; i < n; i++) {
      const a = pts[i], b = pts[(i + 1) % n], dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1, nx = -dy / l * hw, ny = dx / l * hw;
      const A0 = [a.x - nx, a.y - ny, z0], A1 = [a.x + nx, a.y + ny, z0], B0 = [b.x - nx, b.y - ny, z0], B1 = [b.x + nx, b.y + ny, z0];
      const Ap = [a.x, a.y, z0 + ht], Bp = [b.x, b.y, z0 + ht];
      [[A0, B0, Bp], [A0, Bp, Ap], [B1, A1, Ap], [B1, Ap, Bp]].forEach(t => t.forEach(v => pos.push(v[0], v[1], v[2])));
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, proxyMat); m.visible = false; m.castShadow = false;
    m.userData.agora = { part: 'sketchLine' }; m.userData.agoraSketch = true;
    return m;
  }
  function inkWindow(o = {}) {
    const w = num(o.w, 0.6), h = num(o.h, 0.9);
    return opening(o, w, h, num(o.y, 1.6) - h / 2, !!o.arched, 'window');
  }
  // doors: y is the SILL (bottom); arched by default
  function inkDoor(o = {}) {
    const w = num(o.w, 0.9), h = num(o.h, 1.7);
    const g = opening(Object.assign({ frame: RAMPS.LIMESTONE }, o), w, h, num(o.y, 0), o.arched !== false, 'door');
    return g;
  }
  const archOpening = (o = {}) => inkWindow(Object.assign({ arched: true }, o));

  // ---------- columns and stairs: y is the BASE ----------
  function column(o = {}) {
    const r = num(o.r, 0.22), h = num(o.h, 3), ramp = matOf(o, RAMPS.LIMESTONE);
    const g = group(o); tag(g, 'column');
    const capH = o.capital === false ? 0 : r * 0.9, baseH = o.base === false ? 0 : r * 0.7;
    const shaft = new THREE.LatheGeometry([[r * 1.0, 0], [r * 1.04, (h - capH - baseH) * 0.3], [r * 0.86, h - capH - baseH]].map(v2), clampSeg(o.seg, 16));
    shaft.translate(0, baseH, 0); g.add(mesh(shaft, ramp));
    if (baseH) { const b = mesh(new THREE.BoxGeometry(r * 2.6, baseH, r * 2.6), ramp); b.position.y = baseH / 2; g.add(b); }
    if (capH) { const c = mesh(new THREE.BoxGeometry(r * 2.6, capH, r * 2.6), ramp); c.position.y = h - capH / 2; g.add(c); }
    return g;
  }
  function columns(o = {}) {
    const n = Math.max(1, Math.min(24, Math.round(num(o.n, 4))));
    const from = o.from || [-(n - 1) * num(o.spacing, 1.6) / 2, 0], to = o.to || [(n - 1) * num(o.spacing, 1.6) / 2, 0];
    const g = group({ x: o.x, y: o.y, z: o.z }); g.rotation.y = num(o.rot, 0); tag(g, 'columns');
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0.5 : i / (n - 1);
      g.add(column(Object.assign({}, o, { x: from[0] + (to[0] - from[0]) * t, y: 0, z: from[1] + (to[1] - from[1]) * t, rot: 0 })));
    }
    return g;
  }
  // a flight of steps climbing toward -z; (x, z) is the centre of its footprint, y its base
  function stairs(o = {}) {
    const n = Math.max(1, Math.min(30, Math.round(num(o.steps, 4)))), rise = num(o.rise, 0.18), run = num(o.run, 0.32), w = num(o.w, 1.6);
    const s = new THREE.Shape(), L = n * run;
    s.moveTo(0, 0);
    for (let i = 0; i < n; i++) { s.lineTo(i * run, (i + 1) * rise); s.lineTo((i + 1) * run, (i + 1) * rise); }
    s.lineTo(L, 0); s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: w, bevelEnabled: false });
    g.translate(-L / 2, 0, -w / 2); g.rotateY(Math.PI / 2);   // profile runs along -z after the turn
    return part(g, o, 'stairs', RAMPS.LIMESTONE);
  }

  // ---------- props: y is the BASE unless noted ----------
  function fence(o = {}) {
    let pts = o.points;
    if (!pts) { const L = num(o.length, 4); pts = [[-L / 2, 0], [L / 2, 0]]; }
    pts = pts.map(v2);
    const h = num(o.h, 0.9), ramp = matOf(o, RAMPS.WOOD), gap = num(o.gap, 1.2);
    const g = group({ x: o.x, y: o.y, z: o.z }); g.rotation.y = num(o.rot, 0); tag(g, 'fence');
    const bits = group();
    for (let k = 0; k < pts.length - 1; k++) {
      const a = pts[k], b = pts[k + 1], len = a.distanceTo(b), ang = Math.atan2(b.x - a.x, b.y - a.y), n = Math.max(1, Math.round(len / gap));
      for (let i = 0; i <= n; i++) {
        if (k > 0 && i === 0) continue;
        const t = i / n; bits.add(place(mesh(new THREE.BoxGeometry(0.1, h, 0.1), ramp), { x: a.x + (b.x - a.x) * t, y: h / 2, z: a.y + (b.y - a.y) * t }));
      }
      [0.38, 0.78].forEach(f => {
        const r = mesh(shapeGeo(new THREE.BoxGeometry(0.05, 0.08, len), { rot: ang }), ramp);
        place(r, { x: (a.x + b.x) / 2, y: h * f, z: (a.y + b.y) / 2 }); bits.add(r);
      });
      const pg = new THREE.BoxGeometry(0.08, h, len); pg.rotateY(ang); pg.translate((a.x + b.x) / 2, h / 2, (a.y + b.y) / 2);
      proxy(pg, g);
    }
    bits.traverse(m => { if (m.isMesh) colourOnlyFn(m); });
    g.add(bits); return g;
  }
  // a cart wheel: axle along x, (x, y, z) is the HUB centre
  function wheel(o = {}) {
    const r = num(o.r, 0.6), w = num(o.w, 0.12), n = Math.max(3, Math.min(16, Math.round(num(o.spokes, 6)))), ramp = matOf(o, RAMPS.WOOD);
    const g = group(o); g.rotation.y = num(o.rot, 0); tag(g, 'wheel');
    const rim = new THREE.TorusGeometry(r - w * 0.4, w * 0.45, 8, 28); rim.rotateY(Math.PI / 2); g.add(mesh(rim, ramp));
    const hub = new THREE.CylinderGeometry(r * 0.16, r * 0.16, w * 1.6, 12); hub.rotateZ(Math.PI / 2); g.add(mesh(hub, RAMPS.IRON));
    const spokes = group(); g.add(spokes);
    for (let i = 0; i < n; i++) { const s = new THREE.BoxGeometry(w * 0.4, r * 0.9, w * 0.4); s.translate(0, r * 0.5, 0); s.rotateX(i / n * Math.PI * 2); spokes.add(colourOnlyFn(mesh(s, ramp))); }
    const pd = new THREE.CylinderGeometry(r, r, w, 24); pd.rotateZ(Math.PI / 2); proxy(pd, g);
    return g;
  }
  // a windmill blade / spar sail: from the origin (the hub) along +y, in the XY plane, cloth facing +z
  function blade(o = {}) {
    const len = num(o.len, num(o.length, 3)), w = num(o.w, 0.75), ramp = matOf(o, RAMPS.WOOD), cloth = toRamp(o.cloth || RAMPS.WHITEWASH);
    const g = group(o); g.rotation.z = num(o.angle, 0); tag(g, 'blade');
    const spar = mesh(new THREE.BoxGeometry(0.1, len, 0.1), ramp); spar.position.y = len / 2; g.add(spar);
    const frame = group(); g.add(frame);
    const x0 = 0.08, x1 = x0 + w, y0 = len * 0.18;
    [x1].forEach(x => { const rail = mesh(new THREE.BoxGeometry(0.05, len - y0, 0.05), ramp); rail.position.set(x, (len + y0) / 2, 0.02); frame.add(rail); });
    const bars = Math.max(3, Math.round((len - y0) / 0.45));
    for (let i = 0; i <= bars; i++) { const b = mesh(new THREE.BoxGeometry(w + 0.06, 0.04, 0.04), ramp); b.position.set((x0 + x1) / 2, y0 + (len - y0) * i / bars, 0.03); frame.add(b); }
    frame.traverse(m => { if (m.isMesh) colourOnlyFn(m); });
    if (o.cloth !== false) {
      const cg = new THREE.PlaneGeometry(w * 0.94, (len - y0) * 0.9, 2, 4); const p = cg.attributes.position;
      for (let i = 0; i < p.count; i++) p.setZ(i, 0.05 * Math.cos(p.getX(i) / w * Math.PI));   // a little billow
      cg.computeVertexNormals(); cg.translate((x0 + x1) / 2, (len + y0) / 2 + (len - y0) * 0.03, -0.02);
      const c = paint(cg, cloth, { speck: 0.1, lift: 0.15 }); c.material = clothMat(); g.add(c);
    }
    const pg = new THREE.BoxGeometry(w + 0.2, len, 0.12); pg.translate((x0 + x1) / 2 - 0.05, len / 2, 0); proxy(pg, g);
    return g;
  }
  let clothMatV = null;
  const clothMat = () => clothMatV || (clothMatV = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }));
  // a boat sail: billowed cloth, (x, y, z) is the foot of its mast side; tri = triangular
  function sail(o = {}) {
    const w = num(o.w, 2), h = num(o.h, 3), b = num(o.billow, 0.35);
    const geo = new THREE.PlaneGeometry(w, h, 6, 8), p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i) + w / 2; const y = p.getY(i) + h / 2;
      if (o.tri) x *= 1 - y / h;
      p.setXYZ(i, x, y, b * Math.sin(Math.PI * x / w) * Math.sin(Math.PI * Math.min(1, y / h + 0.15)));
    }
    geo.computeVertexNormals(); shapeGeo(geo, o);
    const m = paint(geo, matOf(o, RAMPS.WHITEWASH), { speck: 0.1, lift: 0.1 }); m.material = clothMat(); m.userData.agora.part = 'sail';
    return place(m, o);
  }
  // a flag on a pole: y is the pole's foot
  function flag(o = {}) {
    const pole = num(o.pole, 3), w = num(o.w, 1), h = num(o.h, 0.6);
    const g = group(o); g.rotation.y = num(o.rot, 0); tag(g, 'flag');
    const pm = mesh(new THREE.CylinderGeometry(0.04, 0.05, pole, 8), RAMPS.WOOD); pm.position.y = pole / 2; g.add(pm);
    const knob = mesh(new THREE.SphereGeometry(0.08, 10, 8), RAMPS.GOLD); knob.position.y = pole + 0.05; g.add(knob);
    const cg = new THREE.PlaneGeometry(w, h, 8, 2), p = cg.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i) + w / 2; p.setX(i, x); p.setZ(i, 0.09 * Math.sin(x * 4.2) * (x / w)); }
    cg.computeVertexNormals(); cg.translate(0.04, pole - h / 2 - 0.08, 0);
    const c = paint(cg, matOf(o, RAMPS.REDWALL), { speck: 0.08, lift: 0.1 }); c.material = clothMat(); g.add(c);
    return g;
  }
  function crate(o = {}) {
    const s = num(o.s, 0.6), g = group(o); g.rotation.y = num(o.rot, 0); tag(g, 'crate');
    g.add(place(mesh(new THREE.BoxGeometry(s, s, s), matOf(o, RAMPS.WOOD)), { y: s / 2 }));
    const bands = group(); g.add(bands);
    [-0.32, 0.32].forEach(f => { bands.add(place(colourOnlyFn(mesh(new THREE.BoxGeometry(s * 1.02, s * 0.12, s * 1.02), RAMPS.WOOD, { lift: -0.2 })), { y: s / 2 + f * s })); });
    return g;
  }
  function barrel(o = {}) {
    const r = num(o.r, 0.35), h = num(o.h, 0.9), g = group(o); tag(g, 'barrel');
    g.add(mesh(new THREE.LatheGeometry([[r * 0.82, 0], [r, h * 0.3], [r * 1.04, h * 0.5], [r, h * 0.7], [r * 0.82, h], [0, h]].map(v2), 16), matOf(o, RAMPS.WOOD)));
    [0.14, 0.86].forEach(f => { const t = new THREE.TorusGeometry(r * (f === 0.5 ? 1.05 : 0.9), 0.025, 6, 20); t.rotateX(Math.PI / 2); t.translate(0, h * f, 0); g.add(colourOnlyFn(mesh(t, RAMPS.IRON))); });
    return g;
  }
  // a terracotta pot, optionally planted (a small painted mound, or flowers)
  function pot(o = {}) {
    const r = num(o.r, 0.3), h = num(o.h, r * 1.5), g = group(o); tag(g, 'pot');
    g.add(mesh(new THREE.LatheGeometry([[r * 0.6, 0], [r * 0.66, 0.02], [r * 0.95, h * 0.8], [r * 1.08, h * 0.86], [r * 1.08, h], [r * 0.9, h]].map(v2), 18), matOf(o, RAMPS.TERRACOTTA)));
    if (o.plant !== false) {
      const leafR = toRamp(o.plant && o.plant !== true ? o.plant : RAMPS.OLIVE);
      const b = kit.blob(r * 1.15, V(0, h + r * 0.35, 0), 0.8, 0.22, 16);
      const m = paint(b, leafR, { speck: 0.25 }); g.add(m);
      if (o.flowers) {
        const fr = toRamp(o.flowers);
        for (let i = 0; i < 6; i++) { const a = i / 6 * 6.28 + rand() * 0.6, rr = r * (0.25 + rand() * 0.6); g.add(place(mesh(new THREE.SphereGeometry(r * 0.22, 8, 6), fr, { lift: 0.2 }), { x: Math.cos(a) * rr, y: h + r * (1.05 + rand() * 0.2) - rr * 0.35, z: Math.sin(a) * rr })); }
      }
    }
    return g;
  }
  // a painted mound of foliage without leaves: the cheap "few big shapes" shrub
  function shrub(o = {}) {
    const r = num(o.r, 0.8), h = num(o.h, r * 1.1);
    const geo = kit.blob(r, V(0, h * 0.5, 0), h / r * 0.55, 0.2, 18);
    return place(tag(paint(geo, matOf(o, RAMPS.OLIVE), { speck: 0.3 }), 'shrub'), { x: o.x, y: o.y, z: o.z });
  }

  // ---------- trees: the kit's own pines / cypresses / bushes, built small into a group ----------
  function withKit(fn, s) {
    const g = new THREE.Group(), held = kit.leaves.splice(0), prev = kit.parent;
    kit.parent = g;
    const lo = lineOnly.length, co = colourOnly.length;
    try { fn(); if (kit.leaves.length) kit.finishLeaves(); }
    finally { kit.parent = prev; kit.leaves.push(...held); }
    lineOnly.slice(lo).forEach(m => { m.userData.agoraLine = true; tag(m, 'proxy'); });
    colourOnly.slice(co).forEach(m => {
      m.userData.agoraColour = true; tag(m, 'leaves');
      // scaled-down trees would get pin-prick leaves; keep the clumps chunky so they still read as brush dabs
      if (m.isInstancedMesh && s < 1) {
        const k = Math.pow(1 / s, 0.6), M = new THREE.Matrix4(), P = new THREE.Vector3(), Q = new THREE.Quaternion(), S = new THREE.Vector3();
        for (let i = 0; i < m.count; i++) { m.getMatrixAt(i, M); M.decompose(P, Q, S); S.multiplyScalar(k); M.compose(P, Q, S); m.setMatrixAt(i, M); }
        m.instanceMatrix.needsUpdate = true;
      }
    });
    g.children.forEach(c => c.traverse(m => { if (m.isMesh && !m.userData.agora) tag(m, 'tree'); }));
    g.scale.setScalar(s); tag(g, 'tree');
    return g;
  }
  // native kit sizes are 2-3x what a small garden tree needs; build big, scale down (leaves shrink too)
  function pine(o = {}) {
    const h = num(o.h, 6), r = num(o.r, h * 0.4), lean = num(o.lean, 0.5), s = Math.min(1, h / 9), H = h / s, Rr = r / s, Ln = lean / s;
    const g = withKit(() => kit.pine([V(0, 0, 0), V(Ln * 0.4, H * 0.45, 0), V(Ln, H * 0.85, -Ln * 0.3)], 0.32, 0.16, [{ c: V(Ln, H, -Ln * 0.3), r: Rr, n: 6 }]), s);
    return place(g, o);
  }
  function cypress(o = {}) {
    const h = num(o.h, 5), w = num(o.w, h * 0.14), s = Math.min(1, h / 9);
    return place(withKit(() => kit.cypress(0, 0, h / s, w / s), s), o);
  }
  function bush(o = {}) {
    const s = num(o.s, 0.6), fl = o.flowers === false ? kit.PALETTES.LEAF : (o.flowers ? toRamp(o.flowers).map(col) : kit.PALETTES.PINK);
    const g = withKit(() => kit.bush(0, 0, num(o.spread, 0.8), Math.max(1, Math.min(4, Math.round(num(o.lobes, 2)))), fl, num(o.h, 1.4), num(o.bloom, 0.5)), s);
    return place(g, o);
  }

  // ---------- behaviour tags (the library's animate() plays them) ----------
  const spin = (obj, { axis = 'z', speed = 0.6 } = {}) => { obj.userData.agoraSpin = { axis: String(axis), speed: num(speed, 0.6) }; return obj; };
  // floats(g, { line }): the object sits IN the water: the build's height `line` (default 0) becomes y = 0 of the
  // placed object (normalise does not lift the hull onto the water); everything below it is the draft
  const floats = (obj, o = {}) => { if (obj && obj.isObject3D) obj.userData.agoraFloat = { line: num(o.line, 0) }; return obj; };
  let variant = 0;   // which of the cached variants the library is building (0-2); generated code always sees 0
  const bob = (obj, { amp = 0.08, speed = 1.2 } = {}) => { obj.userData.agoraBob = { amp: num(amp, 0.08), speed: num(speed, 1.2), y0: obj.position.y }; return obj; };

  // ---------- the THREE classes generated code may touch ----------
  const SAFE_THREE = Object.freeze({
    Vector2: THREE.Vector2, Vector3: THREE.Vector3, Shape: THREE.Shape, Path: THREE.Path,
    CatmullRomCurve3: THREE.CatmullRomCurve3, QuadraticBezierCurve: THREE.QuadraticBezierCurve,
    QuadraticBezierCurve3: THREE.QuadraticBezierCurve3, CubicBezierCurve: THREE.CubicBezierCurve,
    Color: THREE.Color, Euler: THREE.Euler, Quaternion: THREE.Quaternion, Matrix4: THREE.Matrix4, MathUtils: THREE.MathUtils
  });
  function tube(o = {}) {   // a tube along a curve or a list of [x,y,z] points (ropes, pipes, handles, necks)
    const pts = o.curve && o.curve.getPoints ? null : (o.points || [[0, 0, 0], [0, 1, 0]]).map(p => (p.isVector3 ? p : V(num(p[0], 0), num(p[1], 0), num(p[2], 0))));
    const curve = o.curve && o.curve.getPoints ? o.curve : new THREE.CatmullRomCurve3(pts);
    const g = new THREE.TubeGeometry(curve, clampSeg(o.seg, 24), num(o.r, 0.08), clampSeg(o.radial, 8), !!o.closed);
    return part(g, Object.assign({}, o, { x: o.x, y: o.y, z: o.z }), 'tube', RAMPS.WOOD);
  }
  function torus(o = {}) {
    const g = new THREE.TorusGeometry(num(o.r, 0.5), num(o.tube, 0.1), 10, clampSeg(o.seg, 24));
    if (o.flat !== false) g.rotateX(Math.PI / 2);   // lying flat by default (rings, rims, hoops)
    return part(g, o, 'torus', RAMPS.IRON);
  }

  // ---------- marks on the land: strokes (a road, a wall along a line) and areas (a paved patch, a striped field) ----------
  // points are [x, z] pairs. `heightAt(x, z)` + `base` (internal, used by fill.js) drape them over the terrain.
  const linePts = o => { let p = toPts(o.points || [[-3, 0], [3, 0]]); if (p.length > 2 && o.smooth !== false) p = smoothLine(p, 2); return p; };
  const polyPts = o => { const p = toPts(o.points || o.poly || [[-2, -2], [2, -2], [2, 2], [-2, 2]]); return p.length >= 3 ? p : toPts([[-2, -2], [2, -2], [2, 2], [-2, 2]]); };
  const drape = o => ({ heightAt: typeof o.heightAt === 'function' ? o.heightAt : null, base: num(o.base, 0) });
  // a road / path along a polyline: a raised strip with darker kerbs (it reads as a sand ribbon from above)
  function path(o = {}) {
    const pts = linePts(o), w = Math.max(0.4, num(o.width, 2.2)), h = num(o.h, 0.12), D = drape(o), step = D.heightAt ? 1.5 : 0;
    const g = group({ x: o.x, y: o.y, z: o.z }); tag(g, 'path');
    const sink = D.heightAt ? 0.25 : 0;   // draped: the sides run into the ground; flat: they stop at y = 0 (normalise grounds the lowest point)
    const body = mesh(ribbonGeo(pts, w, { y: h, h: h + sink, step, ...D }), matOf(o, ROAD), { speck: num(o.speck, 0.22) });
    body.userData.agora.part = 'path'; g.add(body);
    if (o.kerb !== false && w >= 1.2) {   // kerbs: two darker bands just proud of the surface, colour only (the strip draws the line)
      const kr = toRamp(o.kerb || KERB), kw = Math.min(0.32, w * 0.14), off = w / 2 - kw / 2;
      [-1, 1].forEach(sd => {
        const k = paint(ribbonGeo(offsetLine(pts, sd * off), kw, { y: h + 0.025, h: 0.05, step, ...D }), kr, { speck: 0.18 });
        k.userData.agora.part = 'kerb'; colourOnlyFn(k); g.add(k);
      });
    }
    return g;
  }
  // a wall along a polyline: a solid run (Lambert by default: it catches real shadows), a coping, optional merlons
  function wallLine(o = {}) {
    const pts = linePts(Object.assign({ smooth: false }, o)), h = num(o.h, 2.2), d = Math.max(0.15, num(o.d, 0.6)), D = drape(o), step = D.heightAt ? 1.5 : 0;
    const g = group({ x: o.x, y: o.y, z: o.z }); tag(g, 'wall');
    const m = mesh(ribbonGeo(pts, d, { y: h, h, below: D.heightAt ? 0.6 : 0, step, ...D }), o.mat || o.material || (o.ramp || o.color ? matOf(o) : lambert('#e3d2b4', 0.2)));
    m.userData.agora.part = 'wall'; g.add(m);
    if (o.cap !== false) { const c = paint(ribbonGeo(pts, d + 0.16, { y: h + 0.12, h: 0.14, step, ...D }), toRamp(o.capRamp || RAMPS.LIMESTONE), { speck: 0.12 }); c.userData.agora.part = 'coping'; g.add(c); }
    if (o.merlons) {
      const gap = 1.1, geos = [];
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i], b = pts[i + 1], L = Math.hypot(b.x - a.x, b.z - a.z), n = Math.max(1, Math.floor(L / gap)), ang = Math.atan2(b.x - a.x, b.z - a.z);
        for (let k = 0; k < n; k++) {
          const t = (k + 0.5) / n, x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t, y0 = (D.heightAt ? D.heightAt(x, z) - D.base : 0) + h + 0.26;
          const bg = new THREE.BoxGeometry(d * 0.9, 0.42, 0.55); bg.rotateY(ang + Math.PI / 2); bg.translate(x, y0 + 0.21, z); geos.push(bg);
        }
      }
      if (geos.length) { const mm = paint(mergeGeos(geos), toRamp(o.capRamp || RAMPS.LIMESTONE), { speck: 0.12 }); mm.userData.agora.part = 'merlons'; g.add(mm); }
    }
    return g;
  }
  // a flat painted area: paving, a bed, a lawn. A low slab with a skirt (the skirt draws the pencil outline)
  function patch(o = {}) {
    const poly = polyPts(o), h = num(o.h, 0.1), D = drape(o);
    const geo = surfaceGeo(poly, { y: h, skirt: h + (D.heightAt ? 0.2 : 0), maxEdge: D.heightAt ? 2 : 0, ...D });
    const m = mesh(geo, matOf(o, RAMPS.LIMESTONE), { speck: num(o.speck, 0.2), lift: num(o.lift, 0) }); m.userData.agora.part = 'patch';
    return place(m, { x: o.x, y: o.y, z: o.z });
  }
  // a striped field: bands across the area's long axis (or `angle`), each painted in the next of `bands`
  function stripes(o = {}) {
    const poly = polyPts(o), D = drape(o), h = num(o.h, 0.1), bw = Math.max(0.6, num(o.width, 2.6));
    const ramps = (Array.isArray(o.bands) && o.bands.length ? o.bands : ['OCHRE', 'OLIVE']).map(toRamp);
    const fr = areaFrame(poly), ang = num(o.angle, fr.angle + Math.PI / 2);
    const nx = -Math.sin(ang), nz = Math.cos(ang);
    let s0 = Infinity, s1 = -Infinity; poly.forEach(p => { const v = p.x * nx + p.z * nz; s0 = Math.min(s0, v); s1 = Math.max(s1, v); });
    const n = Math.max(1, Math.min(40, Math.round((s1 - s0) / bw))), step = (s1 - s0) / n;
    const g = group({ x: o.x, y: o.y, z: o.z }); tag(g, 'stripes');
    const byRamp = new Map();
    for (let i = 0; i < n; i++) {
      const piece = band(poly, ang, s0 + i * step - 1e-4, s0 + (i + 1) * step + 1e-4);
      if (piece.length < 3 || Math.abs(polyArea(piece)) < 0.05) continue;
      const r = ramps[i % ramps.length], geo = surfaceGeo(piece, { y: h, maxEdge: D.heightAt ? 2 : 0, ...D });
      if (!byRamp.has(r)) byRamp.set(r, []); byRamp.get(r).push(geo);
    }
    byRamp.forEach((geos, r) => { const m = paint(mergeGeos(geos), r, { speck: num(o.speck, 0.26) }); m.userData.agora.part = 'band'; g.add(m); });
    // the field's edge: a skirt all round (its pencil outline) in the earth colour
    const edge = paint(surfaceGeo(poly, { y: h, skirt: h + (D.heightAt ? 0.2 : 0), maxEdge: D.heightAt ? 2 : 0, top: false, ...D }), toRamp(o.edge || EARTH), { speck: 0.2 });
    edge.userData.agora.part = 'fieldEdge'; g.add(edge);
    return g;
  }
  function offsetLine(pts, d) {   // a polyline moved sideways by d (left > 0), mitred
    return pts.map((p, i) => {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], l = Math.hypot(b.x - a.x, b.z - a.z) || 1;
      return { x: p.x - (b.z - a.z) / l * d, z: p.z + (b.x - a.x) / l * d };
    });
  }

  // ---------- round 3D trees (trees.js): the ones that read from the bird's-eye view ----------
  const trees = createTreeBuilders({ group, mesh, proxy, colourOnly: colourOnlyFn, cypress, ramps: RAMPS, ramp: rampFrom, range: (a, b) => a + (b - a) * rand(), rand: () => rand() });
  // api.pine is the 3D umbrella pine; the kit's verbatim eye-level pine (flat pads, instanced needles) stays as
  // api.pine({ kit: true }) / api.kitPine for the Assembly-style set pieces
  const pine3d = (o = {}) => (o.kit ? pine(o) : trees.pine(o));

  const api = {
    THREE: SAFE_THREE, ramps: RAMPS, LIMITS,
    group, mesh, paint, lambert, clay, ramp: rampFrom, proxy, colourOnly: colourOnlyFn,
    box, cylinder, cone, sphere, lathe, extrude, tube, torus,
    boxGeo, cylinderGeo, coneGeo, sphereGeo, latheGeo, extrudeGeo,
    gableRoof, hipRoof, dome, archWall, archOpening, inkWindow, inkDoor, window: inkWindow, door: inkDoor,
    column, columns, stairs, fence, wheel, blade, sail, flag, crate, barrel, pot, shrub, pine: pine3d, kitPine: pine, cypress, bush,
    tree: trees.tree, olive: trees.olive, oak: trees.oak, lemon: trees.lemon,
    path, road: path, wall: wallLine, patch, stripes,
    spin, bob, floats,
    variant: () => variant,
    rand: () => rand(), range: (a, b) => a + (b - a) * rand(), pick: arr => arr[Math.floor(rand() * arr.length)],
    seed: n => { rand = ctx.mulberry32(Math.floor(num(n, 1))); }
  };
  Object.freeze(api);

  // ================= finishing (internal) =================
  // finish(root): bake every painted part in the root's frame (so rotations made by the build code still get
  // the light from the upper left), hand enclosed parts to their proxies, and tag everything for reveal.
  const _m = new THREE.Matrix4(), _n = new THREE.Matrix3(), _inv = new THREE.Matrix4(), _bb = new THREE.Box3(), _pb = new THREE.Box3();
  function finish(root) {
    root.updateMatrixWorld(true); _inv.copy(root.matrixWorld).invert();
    const seen = new Map(), proxies = [], solids = [];
    root.traverse(o => {
      if (!o.isMesh) return;
      if (o.userData.agoraLine) { proxies.push(o); return; }
      if (o.userData.agoraSketch) return;   // sketch-phase outlines: never painted, never in a list
      if (!o.userData.agora) tag(o, 'mesh');
      solids.push(o);
      const a = o.userData.agora;
      if (!a.ramp || o.isInstancedMesh) return;
      _m.multiplyMatrices(_inv, o.matrixWorld); _n.getNormalMatrix(_m);
      let geo = o.geometry;
      if (seen.has(geo) && !seen.get(geo).equals(_n)) { geo = o.geometry = geo.clone(); }
      seen.set(geo, _n.clone());
      const nrm = geo.attributes.normal; if (!nrm) return;
      const tmp = new THREE.BufferGeometry(), arr = new Float32Array(nrm.count * 3), v = new THREE.Vector3();
      for (let i = 0; i < nrm.count; i++) { v.fromBufferAttribute(nrm, i).applyMatrix3(_n).normalize(); arr[i * 3] = v.x; arr[i * 3 + 1] = v.y; arr[i * 3 + 2] = v.z; }
      tmp.setAttribute('normal', new THREE.BufferAttribute(arr, 3));
      kit.bake(tmp, a.ramp, a.speck, a.lift);
      geo.setAttribute('color', tmp.attributes.color);
    });
    // a proxy stands in for the keylines of every part it encloses
    proxies.forEach(p => {
      if (!p.geometry.boundingBox) p.geometry.computeBoundingBox();
      _pb.copy(p.geometry.boundingBox).applyMatrix4(p.matrixWorld); const sz = _pb.getSize(new THREE.Vector3());
      _pb.expandByVector(sz.multiplyScalar(0.04).addScalar(0.02));
      solids.forEach(m => {
        if (m.userData.agoraColour || m.isInstancedMesh) return;
        _bb.setFromObject(m); if (_bb.isEmpty()) return;
        const inter = _bb.clone().intersect(_pb), vol = b => { const s = b.getSize(new THREE.Vector3()); return Math.max(1e-6, s.x) * Math.max(1e-6, s.y) * Math.max(1e-6, s.z); };
        if (!inter.isEmpty() && vol(inter) / vol(_bb) > 0.9) colourOnlyFn(m);
      });
    });
    return root;
  }
  // ground-huggers: the painter's colour pass has a 16-bit depth buffer, so a slab 0.1 m above the ground loses
  // to the ground at the leader's distance (it z-fights, then vanishes: the old road). Parts that lie flat on the
  // ground (top under 0.8 m, thinner than 0.8 m, wider than 0.8 m: slabs, yards, crop beds, kerbs) get a polygon-offset twin of their material
  // that wins that fight by a couple of depth steps. Never the folk, never the proxies.
  // The nudge grows with the part's height (one more depth step per 10 cm), so layers keep their order: the
  // crops beat the earth they grow in, and the earth beats the paper.
  const hugCache = new Map();
  function hugMat(mat, top = 0.1) {
    if (mat.userData && mat.userData.agoraHug) return mat;
    const units = -Math.round(2 + Math.max(0, Math.min(0.8, top)) / 0.1), k = mat.uuid + '|' + units;
    if (hugCache.has(k)) return hugCache.get(k);
    const m = mat.clone(); m.polygonOffset = true; m.polygonOffsetFactor = -1; m.polygonOffsetUnits = units;
    m.userData = Object.assign({}, mat.userData, { agoraHug: true }); hugCache.set(k, m);
    return m;
  }
  function hugGround(root, ground = 0) {
    root.updateMatrixWorld(true);
    const b = new THREE.Box3(), s = new THREE.Vector3();
    root.traverse(o => {
      if (!o.isMesh || o.isInstancedMesh || o.userData.agoraLine || o.userData.agoraSketch || Array.isArray(o.material)) return;
      b.setFromObject(o); if (b.isEmpty()) return; b.getSize(s);
      if (b.max.y - ground < 0.8 && s.y < 0.8 && Math.max(s.x, s.z) > 0.8) o.material = hugMat(o.material, b.max.y - ground);
    });
    return root;
  }
  // register / unregister: keep ctx.lineOnly / ctx.colourOnly in step with an object's tags
  function register(root) {
    root.traverse(o => {
      if (o.userData.agoraLine && !lineOnly.includes(o)) { o.visible = false; lineOnly.push(o); }
      if (o.userData.agoraColour && !colourOnly.includes(o)) colourOnly.push(o);
    });
    return root;
  }
  function unregister(root) {
    root.traverse(o => {
      let i = lineOnly.indexOf(o); if (i >= 0) lineOnly.splice(i, 1);
      i = colourOnly.indexOf(o); if (i >= 0) colourOnly.splice(i, 1);
    });
    return root;
  }
  INTERNAL.set(api, { ctx, kit, finish, register, unregister, hugGround, hugMat, toRamp, RAMPS, clayMat, KEY, setVariant: v => { variant = Math.max(0, Math.floor(num(v, 0))); } });
  return api;
}

// ================= safety: measuring and compiling generated code =================
// run fn with the escape hatches to the global object closed (see compileAsset)
const FN_PROTOS = (() => { const out = [Function.prototype]; try { out.push(Object.getPrototypeOf(async function () {})); out.push(Object.getPrototypeOf(function* () {})); out.push(Object.getPrototypeOf(async function* () {})); } catch (e) { /* old engine */ } return out; })();
function sealed(fn) {
  const blocked = function () { throw new Error('not available to generated code'); };
  const saved = FN_PROTOS.map(p => Object.getOwnPropertyDescriptor(p, 'constructor'));
  const evalDesc = Object.getOwnPropertyDescriptor(globalThis, 'eval');
  try {
    FN_PROTOS.forEach(p => Object.defineProperty(p, 'constructor', { value: blocked, writable: true, configurable: true }));
    if (evalDesc && evalDesc.configurable) Object.defineProperty(globalThis, 'eval', { value: blocked, writable: true, configurable: true });
    return fn();
  } finally {
    FN_PROTOS.forEach((p, i) => { if (saved[i]) Object.defineProperty(p, 'constructor', saved[i]); });
    if (evalDesc && evalDesc.configurable) Object.defineProperty(globalThis, 'eval', evalDesc);
  }
}
export function measure(root) {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3(), tmp = new THREE.Box3(), m = new THREE.Matrix4();
  let meshes = 0, tris = 0;
  root.traverse(o => {
    if (!o.isMesh || o.userData.agoraSketch) return;
    meshes++;
    const g = o.geometry; if (!g.boundingBox) g.computeBoundingBox();
    const n = g.index ? g.index.count / 3 : (g.attributes.position ? g.attributes.position.count / 3 : 0);
    if (o.isInstancedMesh) {
      tris += n * o.count;
      for (let i = 0; i < o.count; i++) { o.getMatrixAt(i, m); tmp.copy(g.boundingBox).applyMatrix4(m).applyMatrix4(o.matrixWorld); box.union(tmp); }
    } else {
      tris += n;
      if (o.userData.agoraLine || o.userData.agoraSketch) return;   // proxies and sketch lines don't count toward the visible extent
      tmp.copy(g.boundingBox).applyMatrix4(o.matrixWorld); box.union(tmp);
    }
  });
  return { box, meshes, tris, size: box.isEmpty() ? new THREE.Vector3() : box.getSize(new THREE.Vector3()) };
}

// normalise(root): ground it (min y = 0), centre the footprint on the origin, keep it inside LIMITS.
// `turn` (radians about y) is applied before the painted light is baked, so a turned building is still lit from the
// upper left. Returns a wrapper group (free to move; rotate it only by small amounts) holding root.
// Throws AssetError when unsound.
export function normalise(api, root, { name = 'asset', turn = 0 } = {}) {
  if (!root || !root.isObject3D) throw new AssetError(`${name}: build(api) must return api.group() (got ${root === null ? 'null' : typeof root})`);
  const I = internals(api);
  const wrap = new THREE.Group(); wrap.name = name; wrap.add(root);
  if (turn) root.rotation.y += turn;
  I.finish(wrap);
  let { box, meshes, tris, size } = measure(root);
  if (!meshes) throw new AssetError(`${name}: the group is empty (add parts with g.add(...))`);
  if (meshes > LIMITS.maxMeshes) throw new AssetError(`${name}: ${meshes} meshes (limit ${LIMITS.maxMeshes}); use fewer, bigger parts`);
  if (tris > LIMITS.maxTriangles) throw new AssetError(`${name}: ${tris | 0} triangles (limit ${LIMITS.maxTriangles}); lower seg counts`);
  if (box.isEmpty() || ![box.min.x, box.min.y, box.min.z, box.max.x, box.max.y, box.max.z].every(Number.isFinite)) throw new AssetError(`${name}: bounding box is not finite (NaN in a size or position?)`);
  const big = Math.max(size.x, size.y, size.z);
  let k = 1;
  if (big > LIMITS.maxSize) k = LIMITS.maxSize / big;          // a "giant" thing still fits the world
  else if (big < LIMITS.minSize) k = LIMITS.minSize / big;     // and a tiny one stays visible
  if (k !== 1) { root.scale.multiplyScalar(k); ({ box, size } = measure(root)); }
  const c = box.getCenter(new THREE.Vector3());
  // things that float keep their own water line (build y = line) at y = 0; everything else stands on its lowest point
  const fl = root.userData.agoraFloat, line = fl ? (Number.isFinite(fl.line) ? fl.line : 0) * k : 0;
  const lift = fl ? -line : -box.min.y;
  root.position.x -= c.x; root.position.z -= c.z; root.position.y += lift;
  wrap.userData.agora = { part: 'asset', size: { w: size.x, h: size.y, d: size.z }, meshes, tris: tris | 0, scaled: k, turn };
  if (fl) Object.assign(wrap.userData.agora, { floats: true, draft: Math.max(0, -(box.min.y + lift)) });
  else I.hugGround(wrap, 0);
  return wrap;
}

// compileAsset(code) -> (api) => wrapper group. The server's wrapper, new Function('api', "'use strict';" + code +
// '\nreturn build(api);'), plus extra parameters that shadow the common browser globals (always undefined inside
// build). That alone is NOT a sandbox: `[].constructor.constructor('return window')()` reaches the global object
// through Function.prototype.constructor, and indirect eval does too. So build() also runs SEALED: for the length
// of the (synchronous) call, the constructor slots of the function prototypes and globalThis.eval throw, and
// dynamic import() is refused at compile time. Valid code behaves identically. It is still the same realm (an
// asset can mutate shared materials or loop forever); the server's token checks are the first line.
export const SHADOWED = Object.freeze(['THREE', 'window', 'document', 'globalThis', 'self', 'top', 'parent', 'frames', 'opener', 'location',
  'navigator', 'fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'Worker', 'importScripts', 'localStorage', 'sessionStorage',
  'indexedDB', 'caches', 'setTimeout', 'setInterval', 'requestAnimationFrame', 'Function', 'Image', 'Audio']);
export function compileAsset(code, { name = 'asset' } = {}) {
  if (typeof code !== 'string' || !/function\s+build\s*\(/.test(code)) throw new AssetError(`${name}: code must define function build(api)`);
  if (/\bimport\s*\(/.test(code)) throw new AssetError(`${name}: import() is not allowed in generated code`);
  let fn;
  try { fn = new Function('api', ...SHADOWED, "'use strict';" + code + '\nreturn build(api);'); }
  catch (e) { throw new AssetError(`${name}: syntax error: ${e.message}`, e); }
  return function make(api, { turn = 0 } = {}) {
    let root;
    try { root = sealed(() => fn(api)); }
    catch (e) { throw new AssetError(`${name}: build(api) threw: ${e && e.message}`, e); }
    try { return normalise(api, root, { name, turn }); }
    catch (e) {
      if (root && root.isObject3D) internals(api).unregister(root);   // don't leave its proxies in ctx.lineOnly
      if (e instanceof AssetError) throw e; throw new AssetError(`${name}: ${e && e.message}`, e);
    }
  };
}
