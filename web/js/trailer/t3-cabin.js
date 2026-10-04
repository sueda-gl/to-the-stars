// ALOUD trailer, beats t3 (CABIN) + t4 (SPACE). web/trailer/t3-cabin.html.
// Sueda, 2026-10-04: "the cabin scene should be shot from the space like this, it should look modern high tech"
// (shots/trailer/ref-cabin-porthole.png). Three shots on one fixed clock (hard cuts):
//   porthole  (alias pov)  inside a dark, modern cabin: a slow push toward one of our flits, a silhouette in a sleek
//             helmet, floating before the big white ceramic porthole. Her Tower Planet turns slowly outside, the tower
//             on the limb; the sun crests the limb beside the helmet and the flit's propeller spins up. Two more folk
//             (a floatie under her parasol, a flit) at the small viewports either side.
//   glass     (alias ots)  the reverse, from space: the pearl-ceramic hull, the porthole's outer bezel, and our folk
//             pressed to the glass, faces lit by the planet, eyes going wide; the planet glints across the glass.
//   space     her Tower Planet space (Grain): the rocket streaks from Earth toward the Plisse stand-in (unchanged).
// Everything is a pure function of t (no accumulated state), so seek(t) renders any frame exactly:
//   window.__shot = { duration, seek(t) -> Promise, play(), done, ready, shots, cuts }
//   ?t=  ?shot=porthole|pov|glass|ots|space|cabin   ?w=&h=&dpr= (recording size; default: the window at min(dpr, 2))
//
// Engines, imported read-only and never edited: the Red arch paint engine (web/js/paint: context, kit, folk, post with
// her G_DEFAULT untouched), our folk (folk.make.flit / floatie + the colour rule), the Build API + the stock rocket
// (web/js/buildings/examples/rocket.js, read at runtime), her Tower Planet (planet/planet.js createPlanet, its saved
// default look from web/assets/look.json, shaders untouched) and the Plisse stand-in.
// Additions here, all trailer-side: the cabin (white / pearl ceramic, ink and ultramarine panels, gold details,
// glowing seams; lit per pixel by the porthole and the cove strips, then painted by her gouache pass), the sleek
// helmets + life-support packs, the silhouette shading for the backlit shots, the porthole view (the live planet
// canvas sampled in screen space: a true window onto infinity) with a thin sunrise line on the limb, and a final
// light pass on top of her composite (halation on the bright rim and strips, the sunrise flare, a soft vignette).
import { createRenderer, createContext } from '../paint/context.js';
import { createKit } from '../paint/kit.js';
import { createFolk, FACE_LAYER, MASK_LAYER } from '../paint/folk.js';
import { createPainter } from '../paint/post.js';
import { createPlanet } from '../planet/planet.js';
import { createPlisseStandin } from '../planet/plisse-standin.js';
import { createBuildApi, compileAsset, RAMPS } from '../buildings/api.js';
import { createProps } from '../agents/props.js';
import { applyColourRule } from '../agents/colour-rule.js';
import { applySavedLook, mountLookLab } from './look-lab.js';

const Q = new URLSearchParams(location.search);
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, k) => a + (b - a) * k;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const ease = x => { x = clamp(x); return x * x * (3 - 2 * x); };
const easeIO = x => { x = clamp(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
const easeOut = x => 1 - Math.pow(1 - clamp(x), 3);
const backOut = x => { x = clamp(x); const c = 1.9; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
// a hop: 0 -> up -> 0 over [t0, t0 + d], with a little squash on landing (returns { y, sq })
function hop(t, t0, d = 0.42, h = 0.14) {
  const u = (t - t0) / d;
  if (u < -0.18 || u > 1.35) return { y: 0, sq: 0 };
  if (u < 0) return { y: 0, sq: -0.08 * Math.sin(Math.PI * (u + 0.18) / 0.18) };   // crouch
  if (u <= 1) return { y: h * Math.sin(Math.PI * u), sq: 0.06 * Math.sin(Math.PI * u) };
  return { y: 0, sq: -0.07 * Math.sin(Math.PI * (u - 1) / 0.35) * Math.exp(-(u - 1) * 3) };
}
const hsh = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

/* ======================================================================================================
   the shots
   ====================================================================================================== */
const SHOTS = [
  { id: 'porthole', name: 'pov', dur: 4.4 },
  { id: 'glass', name: 'ots', dur: 3.2 },
  { id: 'space', dur: 7.2 }
];
const only = Q.get('shot');
const PLAY = only === 'cabin' ? SHOTS.filter(s => s.id !== 'space') : only ? SHOTS.filter(s => s.id === only || s.name === only) : SHOTS;
let acc = 0; for (const s of PLAY) { s.t0 = acc; acc += s.dur; }
const DURATION = acc;
function shotAt(t) {
  for (const s of PLAY) if (t < s.t0 + s.dur) return { s, u: Math.max(0, t - s.t0) };
  const s = PLAY[PLAY.length - 1]; return { s, u: s.dur };
}

/* ======================================================================================================
   1. the cabin, painted by the Red arch engine
   ====================================================================================================== */
// paint settings rule (TRAILER.md): her reference's renderer (pixel ratio min(dpr, 2), canvas = the window) and her
// painter's G_DEFAULT untouched; ?w=&h=&dpr= only for recording (e.g. ?w=1920&h=1080&dpr=2 paints 3840x2160)
const prenderer = createRenderer();
const DPR = Q.has('dpr') ? +Q.get('dpr') : Math.min(window.devicePixelRatio || 1, 2);
prenderer.setPixelRatio(DPR);
const FIXED = Q.has('w') && Q.has('h');
const viewSize = () => FIXED ? [+Q.get('w'), +Q.get('h')] : [innerWidth, innerHeight];
prenderer.domElement.id = 'paint';
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(34, 16 / 9, 0.04, 80);
const ctx = createContext({ renderer: prenderer, scene, camera, seed: 11 });
const kit = createKit(ctx);
// the folk's clay cel reads KEY_DIR (set per shot); Lambert bits read key / hemi
const KEY_DIR = V3(-0.45, 0.6, 0.66).normalize();
const hemi = new THREE.HemisphereLight(0xe8eeff, 0x2a3048, 0.6); hemi.layers.enable(FACE_LAYER); scene.add(hemi);
const key = new THREE.DirectionalLight(0xf2f5ff, 0.6); key.position.set(0, 2, -3); key.layers.enable(FACE_LAYER); scene.add(key, key.target);
const backdrop = { KEY_DIR, key, hemi, update() {} };
const nav = {
  pickTarget() {}, obstacles: [], bounds() {}, extraPush() {}, flyTarget(f) { f.route = [f.pos.clone()]; },
  floatTarget(f) { f.route.push(f.pos.clone()); }, flyPush() {}, spots: [V3(0, 0, 0)], closeFocus: V3(), onArrive() {}
};
const folk = createFolk(ctx, backdrop, nav);
const props = createProps(ctx, folk);

// ---- the module: a flat bulkhead (z = 0, the room is z > 0) with the hero porthole, two small viewports, a ceiling
// and floor with chamfered coves (the light strips hide in them), side walls and a rear wall with the hatch ----
const RX = 2.6, RY = 2.9, RZ = 5.0;             // the room: x in [-RX, RX], y in [0, RY], z in [0, RZ]
const PORT = { x: 0, y: 1.45, r: 0.74 };        // the hero porthole (glass radius)
const SIDES = [{ x: -1.62, y: 1.5, r: 0.31 }, { x: 1.62, y: 1.5, r: 0.31 }];
const GLASS_Z = -0.29, HULL_Z = -0.37;          // the glass seat, the outer skin
const WIN_C = V3(PORT.x, PORT.y, GLASS_Z);

const hex3 = h => new THREE.Color(h);
// the craft's palette (rocket.js: pearl, glass, cyan strips, recess, fine gold), with a dark foot for the unlit cabin
const RAMP = {
  PEARL: ['#0e1124', '#20263f', '#5d5d74', '#9893a6', '#c9c5ca', '#eeeae2'],          // interior ceramic, dark -> lit
  RIM: ['#20263f', '#8a8597', '#b2adbb', '#d8d4d3', '#eeeae2', '#fbf8f2'],            // the porthole's white rim
  INK: ['#07091a', '#0e1124', '#161a33', '#20263f', '#2c344f', '#3e4766'],            // recesses
  ULTRA: ['#0a1220', '#0f1a2c', '#16283e', '#21405a', '#3f6f86', '#8fc3cf'],          // tinted glass panels
  GOLD: ['#3a2a10', '#6e5120', '#a07a34', '#c89c45', '#dcb95f', '#f0d996'],           // fine gold, small parts only
  HULL: ['#2c344f', '#8a8597', '#b2adbb', '#d8d4d3', '#eeeae2', '#fbf8f2']            // the hull outside, in planet light
};
// one light model for every ceramic surface, per pixel (so the sunrise can move it): the porthole is a big disc light
// (cool planet-light), the small viewports smaller ones, the cove strips line lights, plus a glow that the bright rim
// throws on the bulkhead round it. Outside (uExt) the hull takes the planet's light as a directional key.
const LIGHT = {
  uWinC: { value: WIN_C.clone() }, uWinR: { value: PORT.r }, uWinI: { value: 2.2 }, uHalo: { value: 0.16 },
  uSideW: { value: SIDES.map(s => new THREE.Vector4(s.x, s.y, GLASS_Z, s.r)) }, uSideI: { value: 2.4 },
  uLa: { value: [V3(-2.3, 2.66, 0.2), V3(-2.3, 0.2, 0.2), V3(-2.5, 2.7, 0.6), V3(-2.3, 2.66, 3.7), V3(-1.8, 2.82, 1.9)] },
  uLb: { value: [V3(2.3, 2.66, 0.2), V3(2.3, 0.2, 0.2), V3(-2.5, 2.7, 3.6), V3(2.3, 2.66, 3.7), V3(1.8, 2.82, 1.9)] },
  uLi: { value: [0.3, 0.16, 0.14, 0.3, 0.16] }, uLs: { value: [0.55, 0.45, 0.5, 0.6, 0.7] },
  uAmb: { value: 0.06 }, uExt: { value: 0 }, uExtL: { value: V3(-0.35, 0.45, -1).normalize() },
  uSun: { value: 0 }, uSunCol: { value: hex3('#ff9a5c') }, uSunP: { value: V3(1.6, 3.2, -6) }
};
const CABIN_VERT = `varying vec3 vP; varying vec3 vN;
  void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vP = w.xyz; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }`;
const CABIN_FRAG = `
  uniform vec3 uR0, uR1, uR2, uR3, uR4, uR5; uniform float uLift, uGain, uSpeck, uExtOnly;
  uniform vec3 uWinC; uniform float uWinR, uWinI, uHalo; uniform vec4 uSideW[2]; uniform float uSideI;
  uniform vec3 uLa[5]; uniform vec3 uLb[5]; uniform float uLi[5]; uniform float uLs[5];
  uniform float uAmb, uExt; uniform vec3 uExtL; uniform float uSun; uniform vec3 uSunCol, uSunP;
  varying vec3 vP; varying vec3 vN;
  float h3(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  vec3 ramp(float v){
    v = clamp(v, 0.0, 1.0) * 5.0;
    vec3 c = mix(uR0, uR1, clamp(v, 0.0, 1.0));
    c = mix(c, uR2, clamp(v - 1.0, 0.0, 1.0)); c = mix(c, uR3, clamp(v - 2.0, 0.0, 1.0));
    c = mix(c, uR4, clamp(v - 3.0, 0.0, 1.0)); c = mix(c, uR5, clamp(v - 4.0, 0.0, 1.0));
    return c;
  }
  float disc(vec3 P, vec3 N, vec3 C, float r){
    vec3 d = C - P; float dist = length(d); vec3 l = d / max(dist, 1e-4);
    float cs = max(dot(N, l), 0.0), cl = max(-l.z, 0.0);
    return cs * (0.25 + 0.75 * cl) * r * r / (dist * dist + r * r);
  }
  void main(){
    vec3 N = normalize(vN); if (!gl_FrontFacing) N = -N;
    float v = 0.0, win = 0.0;
    bool ext = uExtOnly > 0.5;
    if (!ext) {
      win = disc(vP, N, uWinC, uWinR) * uWinI;
      float rr = length(vP.xy - uWinC.xy);
      win += uHalo * exp(-pow(max(rr - uWinR, 0.0) / 0.42, 1.4)) * step(vP.z, 0.4) * (0.35 + 0.65 * max(N.z, 0.0));
      for (int i = 0; i < 2; i++) win += disc(vP, N, uSideW[i].xyz, uSideW[i].w) * uSideI;
      v += win;
      for (int i = 0; i < 5; i++) {
        vec3 ab = uLb[i] - uLa[i]; float k = clamp(dot(vP - uLa[i], ab) / dot(ab, ab), 0.0, 1.0);
        vec3 q = uLa[i] + ab * k, d = q - vP; float dist = length(d);
        v += uLi[i] * (0.35 + 0.65 * max(dot(N, d / max(dist, 1e-4)), 0.0)) / (1.0 + pow(dist / uLs[i], 2.0));
      }
      v += uAmb;
    } else {
      win = max(dot(N, uExtL), 0.0);
      v = 0.1 + 0.6 * win + 0.05 * N.y;
    }
    v = uLift + uGain * v + (h3(floor(vP * 37.0)) - 0.5) * uSpeck;
    vec3 c = ramp(v);
    // the sunrise: a warm wash where the porthole light falls (inside) / a raking glint (outside)
    vec3 ls = normalize(uSunP - vP);
    c += uSunCol * uSun * (!ext ? 0.22 * win * max(dot(N, ls), 0.0) : 0.35 * pow(max(dot(N, ls), 0.0), 3.0));
    gl_FragColor = vec4(c, 1.0);
  }`;
const cabinMats = {};
function cabinMat(name, { lift = 0, gain = 1, speck = 0.035, ext = false } = {}) {
  const key = `${name}|${lift}|${gain}|${speck}|${ext}`;
  if (cabinMats[key]) return cabinMats[key];
  const r = RAMP[name].map(hex3);
  const m = new THREE.ShaderMaterial({
    uniforms: { ...LIGHT, uR0: { value: r[0] }, uR1: { value: r[1] }, uR2: { value: r[2] }, uR3: { value: r[3] }, uR4: { value: r[4] }, uR5: { value: r[5] },
      uLift: { value: lift }, uGain: { value: gain }, uSpeck: { value: speck }, uExtOnly: { value: ext ? 1 : 0 } },
    vertexShader: CABIN_VERT, fragmentShader: CABIN_FRAG, side: THREE.DoubleSide
  });
  return (cabinMats[key] = m);
}
// glowing things (light strips, seams, LEDs, screens): drawn in the folk pass with alpha 0.5, the painter's "face"
// value, so they stay crisp light over the gouache (and in the world too, painted underneath + for the depth)
const glowMats = {};
const glowMat = hex => glowMats[hex] || (glowMats[hex] = new THREE.MeshBasicMaterial({ color: hex, opacity: 0.5 }));
const cabin = new THREE.Group(); cabin.name = 'cabin'; scene.add(cabin);       // the interior
const hull = new THREE.Group(); hull.name = 'hull-outside'; scene.add(hull);   // the outer skin (glass shot)
function addMesh(geo, mat, parent = cabin) { const m = new THREE.Mesh(geo, mat); parent.add(m); return m; }
function addGlow(geo, hex, parent = cabin) {
  const m = new THREE.Mesh(geo, glowMat(hex)); m.layers.enable(FACE_LAYER); parent.add(m); ctx.colourOnly.push(m); return m;
}
function mergeBuffers(geos) {
  const n = geos.reduce((s, g) => s + (g.index ? g.index.count : g.attributes.position.count), 0);
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3); let o = 0;
  for (let g of geos) { if (g.index) g = g.toNonIndexed(); pos.set(g.attributes.position.array, o); nor.set(g.attributes.normal.array, o); o += g.attributes.position.array.length; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); return g;
}
// a rounded rectangle shape (centred), optional round holes [{x, y, r}]
function rrect(w, h, r, holes = []) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h); s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  for (const o of holes) { const p = new THREE.Path(); p.absarc(o.x, o.y, o.r, 0, Math.PI * 2, true); s.holes.push(p); }
  return s;
}
// an extruded ceramic tile: front face at z = depth (toward +z), a small bevel = a precise seam
function tile(w, h, { r = 0.03, depth = 0.03, bevel = 0.008, holes = [], seg = 6 } = {}) {
  const g = new THREE.ExtrudeGeometry(rrect(w, h, r, holes), { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: seg });
  g.computeVertexNormals(); return g;
}
const place = (g, x, y, z, rx = 0, ry = 0, rz = 0) => { g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz))); g.translate(x, y, z); return g; };
// a ring profile turned round the z axis at (x, y): pts = [[rho, z], ...]
function turned(pts, x, y, seg = 96) {
  const g = new THREE.LatheGeometry(pts.map(([r, z]) => new THREE.Vector2(r, z)), seg);
  g.rotateX(Math.PI / 2); g.translate(x, y, 0); g.computeVertexNormals(); return g;
}
const scaleR = (pts, k, kz = 1) => pts.map(([r, z]) => [r * k, z * kz]);
const tube = (r, t, x, y, z, seg = 96) => { const g = new THREE.TorusGeometry(r, t, 8, seg); g.translate(x, y, z); return g; };

// ---- the hero porthole: a deep, flaring white ceramic sleeve, a fat rounded lip, a flange proud of the wall ----
const RIM_IN = [[0.742, GLASS_Z - 0.01], [0.752, GLASS_Z + 0.04], [0.775, -0.09], [0.795, 0.0], [0.82, 0.05], [0.86, 0.082], [0.91, 0.092],
  [0.96, 0.085], [0.995, 0.06], [1.01, 0.025], [1.012, 0.0]];
const RIM_OUT = [[0.742, GLASS_Z + 0.01], [0.75, HULL_Z + 0.02], [0.765, HULL_Z - 0.03], [0.8, HULL_Z - 0.055], [0.86, HULL_Z - 0.055], [0.9, HULL_Z - 0.03], [0.915, HULL_Z + 0.01]];
const portGeos = { rim: [], gold: [], ink: [], glowW: [], glowU: [], glowG: [] };
function porthole(p, k, hero) {
  portGeos.rim.push(turned(scaleR(RIM_IN, k), p.x, p.y));
  // the seat ring at the glass (gold, thin) and a glowing ring in the lip
  portGeos.gold.push(tube(PORT.r * k + 0.006, 0.012 * Math.max(k, 0.6), p.x, p.y, GLASS_Z + 0.01, 72));
  portGeos.glowW.push(tube(0.818 * k, 0.0055 * Math.max(k, 0.7), p.x, p.y, 0.052, 96));
  // little status LEDs round the flange (two gold, the rest ultramarine)
  const n = hero ? 14 : 6;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + 0.11, rr = 0.94 * k, g = new THREE.SphereGeometry(0.011 * Math.max(k, 0.7), 8, 6);
    g.translate(p.x + Math.cos(a) * rr, p.y + Math.sin(a) * rr, 0.093);
    (i % 5 === 2 ? portGeos.glowG : portGeos.glowU).push(g);
  }
}
porthole(PORT, 1, true);
SIDES.forEach(s => porthole(s, s.r / PORT.r, false));
// the instruments round the hero porthole (as in her reference): a sensor block on top, a gold pod upper right, a
// small screen panel to the left, a grab bar across the bottom on gold brackets
{
  const top = PORT.y + 1.07;
  portGeos.rim.push(place(tile(0.4, 0.2, { r: 0.04, depth: 0.12 }), 0, top - 0.02, 0.0));                    // sensor block
  portGeos.ink.push(place(tile(0.3, 0.1, { r: 0.03, depth: 0.012, bevel: 0.004 }), 0, top - 0.02, 0.13));
  portGeos.gold.push(tube(0.032, 0.008, 0.08, top - 0.02, 0.147, 24));
  portGeos.ink.push(place(new THREE.CylinderGeometry(0.026, 0.026, 0.02, 20), 0.08, top - 0.02, 0.142, Math.PI / 2));
  // gold pod, upper right on a white arm
  const pa = 0.72, px = Math.cos(pa) * 1.04, py = PORT.y + Math.sin(pa) * 1.04;
  portGeos.rim.push(place(tile(0.09, 0.2, { r: 0.03, depth: 0.05 }), px + 0.03, py + 0.04, 0.0, 0, 0, -0.7));
  portGeos.gold.push(place(new THREE.CylinderGeometry(0.06, 0.065, 0.16, 28), px + 0.07, py + 0.08, 0.12, 0.3, 0, -0.7));
  portGeos.rim.push(place(new THREE.SphereGeometry(0.06, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), px + 0.07 + 0.055, py + 0.08 + 0.064, 0.14, 0.3, 0, -0.7));
  // the screen panel (left, lower): white housing, ink bezel; the screen itself glows (a canvas texture, below)
  const sx = -1.02, sy = PORT.y - 0.62;
  portGeos.rim.push(place(tile(0.36, 0.25, { r: 0.035, depth: 0.05 }), sx, sy, 0.0, 0, 0.22, 0));
  portGeos.ink.push(place(tile(0.3, 0.19, { r: 0.02, depth: 0.012, bevel: 0.004 }), sx + 0.011, sy, 0.055, 0, 0.22, 0));
  // grab bar: white, ink grips, gold brackets at the rim
  const by = PORT.y - 0.86;
  const bar = new THREE.CylinderGeometry(0.022, 0.022, 1.16, 18); place(bar, 0, by, 0.2, 0, 0, Math.PI / 2); portGeos.rim.push(bar);
  for (const sd of [-1, 1]) {
    portGeos.ink.push(place(new THREE.CylinderGeometry(0.03, 0.03, 0.26, 18), sd * 0.34, by, 0.2, 0, 0, Math.PI / 2));
    portGeos.gold.push(place(new THREE.BoxGeometry(0.045, 0.045, 0.2), sd * 0.58, by, 0.1));
    portGeos.gold.push(place(new THREE.CylinderGeometry(0.035, 0.035, 0.05, 6), sd * 0.58, by, 0.02, Math.PI / 2));
  }
}
addMesh(mergeBuffers(portGeos.rim), cabinMat('RIM', { lift: 0.06, gain: 1.2 }));
addMesh(mergeBuffers(portGeos.gold), cabinMat('GOLD', { lift: 0.22, gain: 1.0 }));
addMesh(mergeBuffers(portGeos.ink), cabinMat('INK', { lift: 0.08 }));
addGlow(mergeBuffers(portGeos.glowW), '#dcfbff');
addGlow(mergeBuffers(portGeos.glowU), '#5fd0e4');
addGlow(mergeBuffers(portGeos.glowG), '#dcfbff');
// the little screen: an orbit plot in ultramarine and gold on ink (no text)
{
  const c = document.createElement('canvas'); c.width = 256; c.height = 160; const g = c.getContext('2d');
  g.fillStyle = '#0f1a2c'; g.fillRect(0, 0, 256, 160);
  g.strokeStyle = 'rgba(95,208,228,0.28)'; g.lineWidth = 1;
  for (let x = 16; x < 256; x += 24) { g.beginPath(); g.moveTo(x, 8); g.lineTo(x, 152); g.stroke(); }
  for (let y = 16; y < 160; y += 24) { g.beginPath(); g.moveTo(8, y); g.lineTo(248, y); g.stroke(); }
  g.strokeStyle = '#5fd0e4'; g.lineWidth = 3; g.beginPath(); g.ellipse(110, 88, 70, 40, -0.2, 0, Math.PI * 2); g.stroke();
  g.fillStyle = '#9fe6f2'; g.beginPath(); g.arc(110, 88, 16, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#dcfbff'; g.beginPath(); g.arc(170, 62, 6, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#dcfbff'; g.lineWidth = 2; g.setLineDash([5, 5]); g.beginPath(); g.moveTo(170, 62); g.quadraticCurveTo(220, 30, 236, 20); g.stroke(); g.setLineDash([]);
  for (let i = 0; i < 5; i++) { g.fillStyle = i < 3 ? '#5fd0e4' : '#21405a'; g.fillRect(200, 92 + i * 11, 36 - i * 3, 6); }
  const tex = new THREE.CanvasTexture(c);
  const m = new THREE.Mesh(place(new THREE.PlaneGeometry(0.27, 0.165), -1.02 + 0.012, PORT.y - 0.62, 0.071, 0, 0.22, 0), new THREE.MeshBasicMaterial({ map: tex, opacity: 0.5 }));
  m.layers.enable(FACE_LAYER); cabin.add(m); ctx.colourOnly.push(m);
}

// ---- the bulkhead: one ceramic slab with the three openings, laid out in tiles by precise seams ----
{
  const holes = [{ x: PORT.x, y: PORT.y, r: 0.81 }, ...SIDES.map(s => ({ x: s.x, y: s.y, r: s.r * 1.16 }))];
  // the slab is a big rounded rect in wall space (x, y) with its origin at the room's floor centre
  const s = rrect(2 * RX, RY, 0.001, holes.map(h => ({ x: h.x, y: h.y - RY / 2, r: h.r })));
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.02, bevelEnabled: false, curveSegments: 64 });
  g.translate(0, RY / 2, -0.02); g.computeVertexNormals();
  addMesh(g, cabinMat('PEARL', { lift: 0.0, gain: 1.0 }));
  // the seams: thin ink grooves on a grid, cut short round the openings
  const seams = [];
  const clear = (x, y, pad) => holes.every(h => Math.hypot(x - h.x, y - h.y) > h.r + 0.45 + pad);
  for (const x of [-2.15, -1.08, 1.08, 2.15]) for (let y = 0.05; y < RY - 0.05; y += 0.05) if (clear(x, y, 0)) seams.push(place(new THREE.BoxGeometry(0.012, 0.052, 0.006), x, y + 0.025, 0.002));
  for (const y of [0.45, 2.55]) for (let x = -RX + 0.05; x < RX - 0.05; x += 0.05) if (clear(x, y, 0)) seams.push(place(new THREE.BoxGeometry(0.052, 0.012, 0.006), x + 0.025, y, 0.002));
  addMesh(mergeBuffers(seams), cabinMat('INK', { lift: 0.0 }));
  // the white bezel plate under the hero rim: a big flat disc ring, slightly proud (the seam round it reads clean)
  const plate = new THREE.RingGeometry(1.0, 1.24, 128, 2); plate.translate(PORT.x, PORT.y, 0.008);
  addMesh(plate, cabinMat('PEARL', { lift: 0.05, gain: 1.15 }));
  addMesh(tube(1.24, 0.006, PORT.x, PORT.y, 0.01, 128), cabinMat('INK', { lift: 0.02 }));
  // ultramarine panels low on the bulkhead either side, ink panel inlays above the small viewports
  const ul = [], ink = [];
  for (const sd of [-1, 1]) {
    ul.push(place(tile(0.95, 0.32, { r: 0.04, depth: 0.02 }), sd * 1.62, 0.62, 0.0));
    ink.push(place(tile(0.72, 0.16, { r: 0.04, depth: 0.018 }), sd * 1.62, 2.18, 0.0));
  }
  addMesh(mergeBuffers(ul), cabinMat('ULTRA', { lift: 0.06, gain: 1.1 }));
  addMesh(mergeBuffers(ink), cabinMat('INK', { lift: 0.04 }));
  // glowing seams: thin ultramarine lines along the ultramarine panels' tops, a gold tick on each ink inlay
  const gu = [], gg = [];
  for (const sd of [-1, 1]) { gu.push(place(new THREE.BoxGeometry(0.85, 0.008, 0.004), sd * 1.62, 0.79, 0.032)); gg.push(place(new THREE.BoxGeometry(0.1, 0.012, 0.004), sd * 1.62 - sd * 0.24, 2.18, 0.03)); }
  addGlow(mergeBuffers(gu), '#5fd0e4'); addGlow(mergeBuffers(gg), '#dcfbff');
}
// ---- ceiling, floor and their chamfered coves (the cove strips glow pearl-white), side walls, rear wall ----
{
  const pearl = [], ink = [];
  // ceiling + floor slabs, split into long panels by seams
  for (let i = 0; i < 6; i++) {
    const x = -RX + (i + 0.5) * (2 * RX / 6), w = 2 * RX / 6 - 0.015;
    pearl.push(place(tile(w, RZ - 0.45, { r: 0.01, depth: 0.02 }), x, RY, 0.45 + (RZ - 0.45) / 2, Math.PI / 2));
    pearl.push(place(tile(w, RZ - 0.45, { r: 0.01, depth: 0.02 }), x, 0, 0.45 + (RZ - 0.45) / 2, -Math.PI / 2));
  }
  // chamfers at the bulkhead (45 degrees), the cove strips sit in the joints
  const ch = Math.SQRT2 * 0.45;
  pearl.push(place(tile(2 * RX, ch, { r: 0.005, depth: 0.02 }), 0, RY - 0.225, 0.225, -Math.PI / 4 + Math.PI));
  pearl.push(place(tile(2 * RX, ch, { r: 0.005, depth: 0.02 }), 0, 0.225, 0.225, Math.PI / 4));
  // side walls, panelled
  for (const sd of [-1, 1]) for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) {
    pearl.push(place(tile(RZ / 4 - 0.015, RY / 2 - 0.015, { r: 0.02, depth: 0.02 }), sd * RX, RY / 4 + j * RY / 2, RZ / 8 + i * RZ / 4, 0, -sd * Math.PI / 2));
  }
  // rear wall: panels round a hatch
  for (let i = 0; i < 6; i++) if (i !== 2 && i !== 3) pearl.push(place(tile(2 * RX / 6 - 0.015, RY - 0.03, { r: 0.02, depth: 0.02 }), -RX + (i + 0.5) * (2 * RX / 6), RY / 2, RZ, 0, Math.PI));
  pearl.push(place(tile(2 * RX / 3 - 0.015, 0.5, { r: 0.02, depth: 0.02 }), 0, RY - 0.27, RZ, 0, Math.PI));
  ink.push(place(tile(1.5, 2.2, { r: 0.18, depth: 0.03 }), 0, 1.15, RZ + 0.01, 0, Math.PI));   // the hatch
  addMesh(mergeBuffers(pearl), cabinMat('PEARL', { lift: 0.0 }));
  addMesh(mergeBuffers(ink), cabinMat('INK', { lift: 0.03 }));
  // the strips: the two coves along the bulkhead, the side coves along the ceiling, the rear cove, the hatch seam
  const sw = [], su = [];
  sw.push(place(new THREE.BoxGeometry(2 * RX - 0.3, 0.022, 0.012), 0, RY - 0.46, 0.02));
  sw.push(place(new THREE.BoxGeometry(2 * RX - 0.3, 0.022, 0.012), 0, 0.46, 0.02));
  for (const sd of [-1, 1]) sw.push(place(new THREE.BoxGeometry(0.012, 0.012, RZ - 0.6), sd * (RX - 0.04), RY - 0.04, RZ / 2 + 0.25));
  sw.push(place(new THREE.BoxGeometry(2 * RX - 0.3, 0.012, 0.012), 0, RY - 0.04, RZ - 0.04));
  { const s = rrect(1.56, 2.26, 0.2); const pts = s.getPoints(48).map(p => V3(p.x, p.y + 1.15, RZ - 0.025)); su.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 160, 0.008, 6, true)); }
  for (const sd of [-1, 1]) su.push(place(new THREE.BoxGeometry(0.008, 1.2, 0.008), sd * (RX - 0.03), 1.4, 0.5));
  addGlow(mergeBuffers(sw), '#78c9dc');
  addGlow(mergeBuffers(su), '#5fd0e4');
  // the rear console: two little screens (gold + ultramarine glows) beside the hatch
  const sc = [];
  for (const [x, y, w, h] of [[-1.55, 1.35, 0.42, 0.24], [1.55, 1.35, 0.42, 0.24], [1.55, 1.0, 0.42, 0.1]]) sc.push(place(new THREE.PlaneGeometry(w, h), x, y, RZ - 0.03, 0, Math.PI));
  addGlow(mergeBuffers(sc.slice(0, 1)), '#2fb3cf'); addGlow(mergeBuffers(sc.slice(1)), '#9fe6f2');
}
// behind the hero glass (only seen if nothing is drawn there): deep space
{
  const back = new THREE.Mesh(new THREE.CircleGeometry(PORT.r + 0.05, 64), new THREE.MeshBasicMaterial({ color: 0x05060d }));
  back.position.set(PORT.x, PORT.y, GLASS_Z - 0.03); scene.add(back); ctx.colourOnly.push(back); cabin.userData.back = back;
  SIDES.forEach(s => { const b = back.clone(); b.scale.setScalar((s.r + 0.03) / (PORT.r + 0.05)); b.position.set(s.x, s.y, GLASS_Z - 0.03); scene.add(b); ctx.colourOnly.push(b); });
}

// ---- outside: the pearl-ceramic hull round the hero porthole (the rocket's language: pearl, ultramarine and ink
// panels, gold details, glowing seams). The skin curves gently away to the sides. ----
{
  const bend = g => { const p = g.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, p.getZ(i) + 0.05 * p.getX(i) * p.getX(i)); g.computeVertexNormals(); return g; };
  const flip = g => { g.rotateY(Math.PI); return g; };   // the outer faces look toward -z (space)
  // the skin, tiled: big pearl panels with a hole for the bezel, an ultramarine band below, ink panels above
  const pearl = [], ultra = [], ink = [], gold = [], glowU = [], glowW = [];
  const holeR = 0.86;
  for (const sd of [-1, 1]) {
    ultra.push(place(tile(1.7, 0.42, { r: 0.05, depth: 0.03 }), sd * 2.0, -0.75, 0.045));
    ink.push(place(tile(1.25, 0.3, { r: 0.05, depth: 0.03 }), sd * 1.82, 0.95, 0.045));
    gold.push(place(new THREE.BoxGeometry(0.42, 0.03, 0.02), sd * 1.5, 0.95, 0.08));
    glowU.push(place(new THREE.BoxGeometry(1.6, 0.012, 0.006), sd * 2.0, -0.52, 0.06));
  }
  ultra.push(place(tile(1.6, 0.18, { r: 0.05, depth: 0.03 }), 0, -1.42, 0.045));
  // faceted white armour panels either side (big chamfers, like the craft's hull), with diagonal cyan accents
  for (const sd of [-1, 1]) {
    pearl.push(place(tile(1.15, 1.5, { r: 0.08, depth: 0.05, bevel: 0.05, seg: 2 }), sd * 1.85, 0.32, 0.045));
    glowU.push(place(new THREE.BoxGeometry(0.5, 0.012, 0.006), sd * 1.42, 0.62, 0.12, 0, 0, sd * 0.5));
    glowU.push(place(new THREE.BoxGeometry(0.28, 0.012, 0.006), sd * 1.5, 0.48, 0.12, 0, 0, sd * 0.5));
  }
  for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2 + 0.26, g = new THREE.CylinderGeometry(0.016, 0.016, 0.02, 12); place(g, Math.cos(a) * 1.0, Math.sin(a) * 1.0, 0.05, Math.PI / 2); ink.push(g); }
  gold.push(tube(0.93, 0.012, 0, 0, 0.05, 128));
  glowU.push(tube(1.08, 0.005, 0, 0, 0.045, 128));
  // panel seams across the skin (ink grooves)
  for (const x of [-2.6, 2.6]) for (let y = -2.4; y < 2.4; y += 0.06) ink.push(place(new THREE.BoxGeometry(0.014, 0.062, 0.008), x, y + 0.03, 0.04));
  for (const y of [1.6, -1.65]) for (let x = -3.4; x < 3.4; x += 0.06) if (Math.abs(x) > 0.95 || y > 0) ink.push(place(new THREE.BoxGeometry(0.062, 0.014, 0.008), x + 0.03, y, 0.04));
  const put = (geos, mat, glow) => {
    const g = mergeBuffers(geos); flip(g); g.translate(PORT.x, PORT.y, HULL_Z); bend(g);
    if (glow) addGlow(g, glow, hull); else addMesh(g, mat, hull);
  };
  // the skin needs real tessellation for the bend: rebuild it as a grid with the hole
  {
    const W = 7.0, H = 5.0, nx = 140, ny = 100, pos = [], nor = [], idx = [];
    for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) { pos.push(-W / 2 + W * i / nx, -H / 2 + H * j / ny, 0.04); nor.push(0, 0, 1); }
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const cx = -W / 2 + W * (i + 0.5) / nx, cy = -H / 2 + H * (j + 0.5) / ny; if (Math.hypot(cx, cy) < holeR) continue;
      const a = j * (nx + 1) + i; idx.push(a, a + 1, a + nx + 2, a, a + nx + 2, a + nx + 1);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setIndex(idx);
    pearl.push(g);
  }
  put(pearl, cabinMat('HULL', { lift: 0.0, ext: true }));
  put(ultra, cabinMat('ULTRA', { lift: 0.12, gain: 0.9, ext: true }));
  put(ink, cabinMat('INK', { lift: 0.1, gain: 0.8, ext: true }));
  put(gold, cabinMat('GOLD', { lift: 0.05, gain: 1.0, ext: true }));
  put(glowU, null, '#5fd0e4'); put(glowW, null, '#dcfbff');
  // the outer bezel: turned pearl, a gold seat at the glass
  addMesh(turned(RIM_OUT, PORT.x, PORT.y), cabinMat('HULL', { lift: 0.04, ext: true }), hull);
  addMesh(tube(PORT.r + 0.006, 0.01, PORT.x, PORT.y, GLASS_Z - 0.012, 96), cabinMat('GOLD', { lift: 0.1, ext: true }), hull);
}

/* ======================================================================================================
   2. our folk, in sleek helmets
   ====================================================================================================== */
// The glass, in the folk pass only (FACE_LAYER), in two layers:
//  A (renderOrder -1, no blending): the visor's rim + a faint tint, written before the bodies so it only survives
//    OUTSIDE the creature's silhouette, with alpha < 0.45 = the painter's "soft paint" (blended over the world).
//  B (transparent, after the bodies): the specular rim + a reflection of the planet, mixed into whatever is under it;
//    it keeps the destination's alpha, so body stays body, face stays face, window stays window.
// uSil = 1 in the backlit shot: the glass goes dark with a hard bright rim where the porthole light wraps it.
const helmetU = { tEnv: { value: null }, uEnv: { value: 0.5 }, uSil: { value: 0 }, uRimC: { value: hex3('#dcf3ff') }, uSun: { value: 0 }, uSunC: { value: hex3('#ffb27a') } };
const GLASS_VERT = `varying vec3 vN, vV; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vV = normalize(-mv.xyz); vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * mv; }`;
const glassA = new THREE.ShaderMaterial({
  uniforms: helmetU, depthWrite: false, transparent: false, blending: THREE.NoBlending,
  vertexShader: GLASS_VERT,
  fragmentShader: `uniform sampler2D tEnv; uniform float uEnv, uSil, uSun; uniform vec3 uRimC, uSunC; varying vec3 vN, vV;
    void main(){
      vec3 n = normalize(vN); float f = 1.0 - max(dot(n, normalize(vV)), 0.0);
      if (uSil > 0.5) {   // backlit: a dark visor with a thin bright edge
        float rim = pow(f, 4.0) * smoothstep(-0.3, 0.6, n.y * 0.5 + 0.5);
        vec3 c = mix(vec3(0.03, 0.04, 0.08), uRimC, rim) + uSunC * uSun * pow(f, 3.0) * smoothstep(0.0, 0.8, n.x);
        gl_FragColor = vec4(c, clamp(0.1 + 0.33 * rim, 0.0, 0.43)); return;
      }
      vec3 env = texture2D(tEnv, vec2(0.5) + n.xy * 0.33).rgb;
      float a = 0.06 + 0.32 * pow(f, 2.2);
      vec3 c = mix(vec3(0.9, 0.94, 1.0), env, uEnv * 0.6);
      float spec = smoothstep(0.86, 0.95, dot(n, normalize(vec3(-0.45, 0.6, 0.65))));
      c = mix(c, vec3(1.0), spec); a = max(a, spec * 0.43);
      gl_FragColor = vec4(c, min(a, 0.43));
    }`
});
const glassB = new THREE.ShaderMaterial({
  uniforms: helmetU, depthWrite: false, transparent: true,
  blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
  blendEquationAlpha: THREE.AddEquation, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
  vertexShader: GLASS_VERT,
  fragmentShader: `uniform sampler2D tEnv; uniform float uEnv, uSil, uSun; uniform vec3 uRimC, uSunC; varying vec3 vN, vV;
    void main(){
      vec3 n = normalize(vN); float f = 1.0 - max(dot(n, normalize(vV)), 0.0);
      if (uSil > 0.5) {
        float rim = pow(f, 3.0) * (0.55 + 0.45 * smoothstep(-0.4, 0.7, n.y * 0.5 + 0.5));
        float sun = uSun * pow(f, 4.0) * smoothstep(0.1, 0.9, n.x) * 0.8;
        float a = clamp(0.12 * f + rim * 0.75 + sun * 0.9, 0.0, 0.95);
        vec3 c = (vec3(0.03, 0.04, 0.08) * 0.12 * f + uRimC * rim * 0.75 + uSunC * sun * 0.9) / max(a, 1e-3);
        gl_FragColor = vec4(c, a); return;
      }
      float spec = smoothstep(0.8, 0.93, dot(n, normalize(vec3(-0.45, 0.6, 0.65))));   // the window highlight
      float dot2 = smoothstep(0.965, 0.985, dot(n, normalize(vec3(-0.2, 0.35, 0.9))));
      float rim = smoothstep(0.55, 0.95, f) * 0.22;
      vec3 env = texture2D(tEnv, vec2(0.5) + n.xy * 0.33).rgb;
      float er = smoothstep(0.9, 0.97, dot(n, normalize(vec3(0.6, -0.35, 0.72)))) * uEnv * 0.7;   // the planet, small, low right
      vec3 c = vec3(1.0, 0.99, 0.97);
      float a = spec * 0.6 + dot2 * 0.8 + rim;
      c = mix(c, env * 1.2, er / max(a + er, 1e-3));
      gl_FragColor = vec4(c, clamp(a + er, 0.0, 0.85));
    }`
});
// the silhouette (the backlit shot): the folk's own shapes, clipped as their clay is, in ink with a rim of planet
// light where the porthole wraps them, warm on the sunward side once the sun is up. Swapped in per shot; their
// clay materials are untouched and swapped back.
const silU = { uRimC: helmetU.uRimC, uSunC: helmetU.uSunC, uSun: helmetU.uSun, uWin: { value: WIN_C.clone() }, uSunP: { value: V3(1, 3, -5) }, uRimK: { value: 1.0 } };
function silMat(src) {
  const base = src.uniforms && (src.uniforms.uBase || src.uniforms.uLit) ? (src.uniforms.uBase || src.uniforms.uLit).value : hex3('#888888');
  const ink = hex3('#060912').lerp(base, 0.07);
  return new THREE.ShaderMaterial({
    uniforms: { ...silU, uInk: { value: ink }, uClipY: { value: src.uniforms && src.uniforms.uClipY ? src.uniforms.uClipY.value : 1e3 }, uClipZ: { value: src.uniforms && src.uniforms.uClipZ ? src.uniforms.uClipZ.value : 1e3 } },
    vertexShader: `varying vec3 vN; varying vec3 vW; varying vec3 vObj;
      void main(){ vObj = position; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform vec3 uInk, uRimC, uSunC, uWin, uSunP; uniform float uSun, uRimK, uClipY, uClipZ; varying vec3 vN; varying vec3 vW; varying vec3 vObj;
      void main(){
        float hem = 0.007 * sin(atan(vObj.x, vObj.z) * 9.0) + 0.005 * sin(vObj.x * 40.0);
        if (vObj.y > uClipY + hem || vObj.z > uClipZ + hem) discard;
        vec3 n = normalize(vN), v = normalize(cameraPosition - vW), l = normalize(uWin - vW), ls = normalize(uSunP - vW);
        float f = 1.0 - max(dot(n, v), 0.0);
        float rim = pow(f, 2.6) * (0.55 + 0.45 * smoothstep(-0.2, 0.5, dot(n, l))) * uRimK * 1.25;
        float sun = pow(f, 2.4) * smoothstep(0.0, 0.6, dot(n, ls)) * uSun;
        vec3 c = uInk + uRimC * rim * 0.85 + uSunC * sun * 0.9;
        gl_FragColor = vec4(c, 1.0);
      }`
  });
}
const suitHex = '#eef0f4';
const PACK_MAT = () => folk.cloth('#e6e9f0');
function helmet(rec, { r, cy, collarY, pack = true }) {
  const body = rec.a.body;
  const th = Math.acos(clamp((collarY - cy) / r, -1, 1));
  const g = new THREE.SphereGeometry(r, 48, 32, 0, Math.PI * 2, 0, th);
  const a = new THREE.Mesh(g, glassA); a.position.y = cy; a.renderOrder = -1;
  const b = new THREE.Mesh(g, glassB); b.position.y = cy; b.renderOrder = 10;
  for (const m of [a, b]) { m.layers.set(FACE_LAYER); m.castShadow = false; body.add(m); ctx.colourOnly.push(m); }
  // a slim white ceramic collar with a glowing ultramarine line (no brass: this is the modern craft)
  const cr = Math.sqrt(Math.max(0, r * r - (collarY - cy) * (collarY - cy)));
  const collar = new THREE.Mesh(new THREE.TorusGeometry(cr + 0.004, 0.024, 12, 48), folk.cloth('#eceff5'));
  collar.rotation.x = Math.PI / 2; collar.scale.z = 0.8; collar.position.y = collarY; body.add(collar);
  const led = new THREE.Mesh(new THREE.TorusGeometry(cr + 0.006, 0.006, 6, 48), glowMat('#5fd0e4'));
  led.rotation.x = Math.PI / 2; led.position.y = collarY + 0.022; body.add(led);
  [collar].forEach(m => { m.layers.enable(FACE_LAYER); m.layers.enable(MASK_LAYER); });
  led.layers.set(FACE_LAYER);
  const out = { a, b, collar, led, glows: [led] };
  if (pack) {   // the life-support pack on the back: white ceramic, an ultramarine status strip, two little LEDs
    const pg = new THREE.Group(); pg.position.set(0, cy - 0.02, -r - 0.032); body.add(pg);
    const sg = new THREE.ExtrudeGeometry(rrect(0.19, 0.24, 0.07), { depth: 0.05, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 3, curveSegments: 8 });
    sg.computeVertexNormals(); sg.translate(0, 0, -0.035);
    const shell = new THREE.Mesh(sg, PACK_MAT()); pg.add(shell);
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.17, 0.01), glowMat('#5fd0e4')); strip.position.set(-0.05, 0.0, -0.058); pg.add(strip);
    const l1 = new THREE.Mesh(new THREE.SphereGeometry(0.009, 8, 6), glowMat('#dcfbff')); l1.position.set(0.05, 0.07, -0.056); pg.add(l1);
    const l2 = new THREE.Mesh(new THREE.SphereGeometry(0.009, 8, 6), glowMat('#5fd0e4')); l2.position.set(0.05, 0.04, -0.058); pg.add(l2);
    shell.layers.enable(FACE_LAYER); [strip, l1, l2].forEach(m => m.layers.set(FACE_LAYER));
    out.pack = pg; out.glows.push(strip, l1, l2);
  }
  return out;
}
function suit(rec, geo, clipY, inflate = 1.05) {
  const m = folk.garment(rec.a.body, geo, suitHex, { clipY, inflate });
  m.layers.enable(FACE_LAYER); m.layers.enable(MASK_LAYER);
  return m;
}
function arms(rec) {   // white nub arms (suit sleeves) that can press on the glass
  const mat = folk.cloth(suitHex);
  return [-1, 1].map(sd => { const g = props.nubArm(mat); g.scale.setScalar(1.3); g.position.set(sd * 0.2, -0.215, 0.05); rec.a.body.add(g); return g; });
}
const cast = [];
function dropScarf(a) {   // the reference's neck-scarf ring hides under the suit
  a.body.children.forEach(o => { if (o.isMesh && Math.abs(o.position.y + 0.105) < 0.01 && Math.abs(o.scale.z - 1.4) < 1e-3) o.visible = false; });
}
function makeFlit(i, sim) {
  const a = folk.make.flit(i);
  a.driven = true; a.controlled = true;
  const rec = { a, species: 'flit', sim };
  applyColourRule(rec, folk);                 // ART_DIRECTION §13: no yellow on a green folk
  dropScarf(a);
  suit(rec, a.body.children[0].geometry, -0.185, 1.13);
  rec.helm = helmet(rec, { r: 0.3, cy: 0.04, collarY: -0.195, pack: false });
  rec.arms = arms(rec);
  cast.push(rec); return rec;
}
function makeFloatie(i, sim) {
  const a = folk.make.floatie(i);
  a.driven = true; a.controlled = true;
  const rec = { a, species: 'floatie', sim };
  applyColourRule(rec, folk);
  dropScarf(a);
  rec.helm = helmet(rec, { r: 0.28, cy: 0.03, collarY: -0.12, pack: false });
  cast.push(rec); return rec;
}
// the crew: three flits and a floatie
const A = makeFlit(0, { id: 'olla', name: 'Olla', trade: 'courier' });
const B = makeFlit(3, { id: 'pippo', name: 'Pippo', trade: 'scholar' });
const C = makeFlit(1, { id: 'nando', name: 'Nando', trade: 'trader' });
const D = makeFloatie(1, { id: 'momo', name: 'Momo', trade: 'diplomat' });
[A, B, C].forEach((r, k) => { r.a.sc = [0.84, 0.95, 0.95][k]; r.a.root.scale.setScalar(r.a.sc); });
D.a.sc = 1.05; D.a.root.scale.setScalar(1.05);
// every clay mesh of a folk (body, garments, cap, legs, arms) gets its silhouette twin
function meshesOf(rec) {
  const out = [];
  rec.a.root.traverse(o => { if (o.isMesh && o.material && o.material.uniforms && (o.material.uniforms.uBase || o.material.uniforms.uLit)) out.push(o); });
  rec.a.legs.forEach(l => out.push(l.leg, l.foot));
  return out;
}
cast.forEach(rec => {
  rec.meshes = meshesOf(rec);
  const soft = new Set(); if (rec.a.canopy) rec.a.canopy.traverse(o => soft.add(o));
  rec.meshes.forEach(m => { m.userData.lit = m.material; m.userData.sil = silMat(m.material); if (soft.has(m)) { m.userData.sil.uniforms.uRimK = { value: 0.35 }; m.userData.sil.uniforms.uInk.value.set('#07090f'); } });
});
function silhouette(rec, on) { rec.meshes.forEach(m => { m.material = on ? m.userData.sil : m.userData.lit; }); }

// pose a flit: world pos, heading (face dir), body pitch / roll, eyes (wide 0..1), mouth (open 0..1), hop squash
const _fw = V3(), _sd = V3();
function poseFlit(rec, { pos, heading, pitch = 0, roll = 0, wide = 0, open = 0, sq = 0, prop = 0, t = 0, armReach = 0, legY = 0.36 }) {
  const f = rec.a;
  f.pos.copy(pos); f.heading = heading;
  f.root.position.copy(pos); f.root.rotation.set(0, heading, 0);
  f.body.rotation.set(pitch, 0, roll);
  f.body.scale.set(1 - sq * 0.6, 1 + sq, 1 - sq * 0.6);
  f.prop.rotation.y = prop;
  f.eyes.forEach(e => e.scale.set(1 + 0.28 * wide, 1 + 0.6 * wide, 1));
  f.eyes.forEach(e => { e.position.y = 0.02 + 0.012 * wide; });
  f.mouth.scale.set(1 + 0.25 * open, 1 + 1.6 * open, 1);
  if (rec.arms) rec.arms.forEach((g, k) => { const sd = k ? 1 : -1; g.rotation.set(-1.9 * armReach - 0.15, 0, sd * (0.55 - 0.35 * armReach)); g.position.z = 0.05 + 0.08 * armReach; });
  _fw.set(Math.sin(heading), 0, Math.cos(heading)); _sd.set(Math.cos(heading), 0, -Math.sin(heading));
  f.legs.forEach(l => {
    const kick = Math.sin(t * 2.3 + f.fidget + l.sd * 1.6) * 0.035 * f.sc;
    l.pos.copy(pos).addScaledVector(_sd, l.sd * 0.085 * f.sc).addScaledVector(_fw, kick - 0.04 * f.sc);
  });
  folk.poseLegs(f, f.legs, l => V3(l.sd * 0.08, -0.17, 0), l => pos.y - legY * f.sc + Math.sin(t * 2.3 + l.sd) * 0.015);
  f.blob.scale.setScalar(1e-4);   // zero-g: no floor shadow
}
function poseFloatie(rec, { pos, heading, tilt = 0, roll = 0, wide = 0, t = 0, wave = 0 }) {
  const f = rec.a;
  f.pos.copy(pos); f.heading = heading;
  f.root.position.copy(pos); f.root.rotation.set(tilt, heading, roll);
  f.swing.rotation.set(Math.sin(t * 0.9) * 0.12, 0, Math.sin(t * 0.7 + 1) * 0.16);
  f.canopy.rotation.y = t * 0.5;
  f.eyes.forEach(e => e.scale.set(0.9 * (1 + 0.28 * wide), 0.9 * (1 + 0.6 * wide), 0.9));
  if (f.wave) f.wave.rotation.set(0, 0, -0.6 - 0.9 * Math.max(0, Math.sin(t * 5.5)) * wave);
  f.root.updateMatrixWorld(true);
  const bw = f.body.getWorldPosition(V3());
  f.legs.forEach(l => { l.pos.set(bw.x + l.sd * 0.07 * f.sc, 0, bw.z + Math.sin(t * 2 + l.sd) * 0.03); });
  folk.poseLegs(f, f.legs, l => { const p = V3(l.sd * 0.07, -0.16, 0); return f.root.worldToLocal(f.body.localToWorld(p)); }, l => bw.y - 0.32 * f.sc);
  f.blob.scale.setScalar(1e-4);
}

/* ======================================================================================================
   2b. the glass: the porthole view (inside), the reflections (outside)
   ====================================================================================================== */
// Inside: the window onto infinity. The live planet canvas is sampled in screen space and drawn in the folk pass with
// alpha 0.5 (the painter's "face" value): it is her painting already, so it is laid on unpainted. On top, only light:
// a thin line where the sunrise grazes the limb (computed from her planet camera, so it sits on the real limb).
let planetTex = null;   // set once the planet canvas exists
const winU = {
  tSky: { value: null }, uRes: { value: new THREE.Vector2(1, 1) },
  uPInv: { value: new THREE.Matrix4() }, uPWorld: { value: new THREE.Matrix4() }, uPCam: { value: V3() }, uRP: { value: 170 },
  uSunS: { value: new THREE.Vector2(0.5, 0.5) }, uSun: { value: 0 }, uAspect: { value: 16 / 9 }, uLineH: { value: 0.012 }, uLineW: { value: 0.006 },
  uGlint: { value: -2 }, uRefl: { value: 0.12 }
};
const winMat = new THREE.ShaderMaterial({
  uniforms: winU,
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `uniform sampler2D tSky; uniform vec2 uRes, uSunS; uniform mat4 uPInv, uPWorld; uniform vec3 uPCam; uniform float uRP, uSun, uAspect, uLineH, uLineW; varying vec2 vUv;
    void main(){
      vec2 uv = gl_FragCoord.xy / uRes;
      vec3 c = texture2D(tSky, uv).rgb;
      vec4 vp = uPInv * vec4(uv * 2.0 - 1.0, 1.0, 1.0);
      vec3 d = normalize(mat3(uPWorld) * normalize(vp.xyz / vp.w));
      float b = -dot(uPCam, d), dm = sqrt(max(dot(uPCam, uPCam) - b * b, 0.0)), h = (dm - uRP) / uRP;
      float near = exp(-pow(length((uv - uSunS) * vec2(uAspect, 1.0)) / 0.3, 2.0));
      float line = exp(-pow((h - uLineH) / uLineW, 2.0)) * step(0.0, b);
      vec3 lc = mix(vec3(0.5, 0.7, 1.0), vec3(1.0, 0.6, 0.36), near * uSun);
      c += lc * line * (0.12 + 1.5 * near * uSun);
      // the glass: a breath of cool tint toward its edge
      vec2 q = vUv - 0.5; float r = length(q) * 2.0;
      c = mix(c, vec3(0.56, 0.76, 0.81), 0.06 * r * r * r);
      gl_FragColor = vec4(c, 0.5);
    }`
});
const winDisc = new THREE.Mesh(new THREE.CircleGeometry(PORT.r + 0.01, 96), winMat);
winDisc.position.set(PORT.x, PORT.y, GLASS_Z); winDisc.layers.set(FACE_LAYER); winDisc.renderOrder = -2; scene.add(winDisc);
const sideDiscs = SIDES.map(s => { const m = new THREE.Mesh(new THREE.CircleGeometry(s.r + 0.01, 64), winMat); m.position.set(s.x, s.y, GLASS_Z); m.layers.set(FACE_LAYER); m.renderOrder = -2; scene.add(m); return m; });
// Outside: the glass reflects the planet behind the camera (mirrored), with a sheen and a glint that sweeps across.
// World layer (painted, over the cabin seen through it) + a folk-pass sheen over the faces (keeps their alpha).
const REFL_FRAG = `uniform sampler2D tSky; uniform float uGlint, uRefl; varying vec2 vUv;
  vec4 glass(){
    vec2 q = vUv - 0.5; float r = length(q) * 2.0;
    vec3 refl = texture2D(tSky, vec2(1.0 - vUv.x, vUv.y) * 0.8 + 0.1).rgb;
    float sheen = smoothstep(0.1, 0.0, abs(q.x * 0.7 + q.y + 0.42)) * 0.35 * smoothstep(0.98, 0.7, r) + smoothstep(0.04, 0.0, abs(q.x * 0.7 + q.y + 0.25)) * 0.25 * smoothstep(0.98, 0.7, r);
    float glint = smoothstep(0.035, 0.0, abs(q.x * 0.5 - q.y * 0.9 - uGlint)) * 0.6 * smoothstep(0.95, 0.4, r);
    float a = uRefl * (0.25 + 0.6 * r * r) + sheen * 0.18 + glint * 0.45;
    vec3 c = mix(refl * 1.1, vec3(1.0, 0.98, 0.95), clamp((sheen * 0.18 + glint * 0.45) / max(a, 1e-3), 0.0, 1.0));
    c = mix(c, vec3(1.0, 0.75, 0.55), glint * 0.35);
    return vec4(c, clamp(a, 0.0, 0.9));
  }`;
const reflWorld = new THREE.Mesh(new THREE.CircleGeometry(PORT.r + 0.01, 96), new THREE.ShaderMaterial({
  uniforms: winU, transparent: true, depthWrite: false,
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: REFL_FRAG + `void main(){ gl_FragColor = glass(); }`
}));
reflWorld.position.set(PORT.x, PORT.y, GLASS_Z - 0.005); reflWorld.rotation.y = Math.PI; reflWorld.renderOrder = 5; hull.add(reflWorld);
ctx.colourOnly.push(reflWorld); ctx.folkHidden.push(reflWorld);
const reflFolk = new THREE.Mesh(reflWorld.geometry, new THREE.ShaderMaterial({
  uniforms: winU, transparent: true, depthWrite: false, depthTest: false,
  blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
  blendEquationAlpha: THREE.AddEquation, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: REFL_FRAG + `void main(){ vec4 g = glass(); gl_FragColor = vec4(g.rgb, g.a * 0.45); }`
}));
reflFolk.position.copy(reflWorld.position); reflFolk.rotation.y = Math.PI; reflFolk.layers.set(FACE_LAYER); reflFolk.renderOrder = 30; hull.add(reflFolk);
/* ======================================================================================================
   3. her Tower Planet (porthole view + the space shot), the Plisse stand-in, the rocket
   ====================================================================================================== */
const pcanvas = document.createElement('canvas'); pcanvas.id = 'planet'; document.body.appendChild(pcanvas);
const plRenderer = new THREE.WebGLRenderer({ canvas: pcanvas, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: true });
const planet = createPlanet({ renderer: plRenderer, autoStart: false, input: false, autoResize: false });
planet.resize();
// ?dpr= (recording): her resize, verbatim in its formula, at the requested pixel ratio instead of the screen's
function sizePlanet() {
  planet.resize();
  if (!Q.has('dpr') && !FIXED) return;
  const [w, h] = viewSize(), pr = DPR, P = planet.post;
  plRenderer.setPixelRatio(pr); plRenderer.setSize(w, h, false);
  const s = Math.max(pr, 1.5), paintScale = Math.min(1, 1440 / Math.max(w * s, h * s));
  P.makeRT(Math.round(w * s * paintScale), Math.round(h * s * paintScale));
  P.post.uniforms.uLine.value = Math.max(1, s * 0.85); P.post.uniforms.uPR.value = pr;
  plRenderer.getDrawingBufferSize(P.post.uniforms.uOut.value);
  planet.camera.aspect = w / h; planet.camera.updateProjectionMatrix();
}
sizePlanet();
// her saved default look (web/assets/look.json, written by the planet lab's "Save as default"), applied exactly as the
// game applies it: only the uniforms she exposes, nothing else
const LOOK_KEYS = {
  style_fish: u => u.post.uniforms.uFish, style_grain: u => u.post.uniforms.uGrain, style_grainSize: u => u.post.uniforms.uSize,
  gouache_brush: u => u.kuwaharaMat.uniforms.uRadius, gouache_wobble: u => u.kuwaharaMat.uniforms.uWarp, gouache_warmth: u => u.kuwaharaMat.uniforms.uWarmth,
  gouache_tooth: u => u.post.uniforms.uPaperTooth, gouache_pooling: u => u.post.uniforms.uPooling, gouache_pencil: u => u.post.uniforms.uPencil,
  gouache_paintWarp: u => u.post.uniforms.uPaintWarp, gouache_saturation: u => u.post.uniforms.uPaintSat, gouache_lineWeight: u => u.paintLineMat.uniforms.uLineMax
};
const lookReady = fetch(new URL('../../assets/look.json', import.meta.url), { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(j => {
  const w = (j && j.world) || {}; if (!w.planet) return;
  for (const [k, v] of Object.entries(w)) {
    if (LOOK_KEYS[k]) { const u = LOOK_KEYS[k](planet.post); if (u) u.value = v; }
    else if (k.startsWith('colour_')) planet.setColour(k.slice(7), v);
  }
}).catch(() => {});
const RP = planet.terrain.RP;
planetTex = new THREE.CanvasTexture(pcanvas); planetTex.minFilter = THREE.LinearFilter; planetTex.generateMipmaps = false;
winU.tSky.value = planetTex; helmetU.tEnv.value = planetTex; winU.uRP.value = RP;

// Plisse, out in the dark toward the upper right of the space shot
// the space shot's frame: F toward Plisse, U up, Rt right
const F_DIR = V3(1, 0.45, -0.85).normalize(), Rt_DIR = F_DIR.clone().cross(V3(0, 1, 0)).normalize(), U_DIR = Rt_DIR.clone().cross(F_DIR).normalize();
const fr = (f, r, u) => V3().addScaledVector(F_DIR, f).addScaledVector(Rt_DIR, r).addScaledVector(U_DIR, u);
const PL_POS = fr(1300, 0, 0);
const standin = createPlisseStandin(planet, { radius: 110, position: PL_POS });
let sceneT = 0; standin.syncClock(() => sceneT, { ms: 1e-6 });

// the rocket: the stock plan, read at runtime and built through the Build API into her scene
const pctx = createContext({ renderer: plRenderer, scene: planet.scene, camera: planet.camera, seed: 11 });
const pkit = createKit(pctx);
const papi = createBuildApi(pctx, pkit, { keyDir: V3(-0.55, 0.62, 0.52).normalize() });
const rocket = new THREE.Group(); rocket.name = 'rocket'; rocket.visible = false; planet.scene.add(rocket);
const ROCKET_SCALE = 2.4;
let rocketInfo = { nozzleY: 0.48, height: 16.8 }, rocketPlaceholder = false;
const plume = new THREE.Group(); rocket.add(plume);
async function loadRocket() {
  let code = null;
  try {
    const src = await (await fetch(new URL('../buildings/examples/rocket.js', import.meta.url))).text();
    code = src.replace(/^(\s*\/\/[^\n]*\n)+/, '').trim();
  } catch (e) { code = null; }
  let g;
  try { g = compileAsset(code, { name: 'rocket' })(papi); }
  catch (e) {   // placeholder (noted in the report): a cream cone on a red skirt
    console.warn('[t3] rocket asset missing, placeholder', e && e.message); rocketPlaceholder = true;
    g = new THREE.Group(); const m = new THREE.Mesh(new THREE.ConeGeometry(1.7, 15, 24), new THREE.MeshBasicMaterial({ color: 0xefe7d7 })); m.position.y = 8; g.add(m);
  }
  const inner = g.children[0];
  if (inner && inner.userData.rocket) rocketInfo = inner.userData.rocket;
  g.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(g), cy = box.min.y;
  g.position.y -= cy;                         // feet at 0
  const pivot = new THREE.Group(); pivot.add(g); pivot.position.y = -box.getSize(V3()).y * 0.45;   // spin round the belly
  rocket.add(pivot); rocket.scale.setScalar(ROCKET_SCALE);
  rocket.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
  rocket.userData.nozzle = (inner ? rocketInfo.nozzleY * (inner.scale ? inner.scale.y : 1) : 0.5) + pivot.position.y + (inner ? inner.position.y : 0) - cy;
  plume.position.y = pivot.position.y + 0.2;
}

// ---- the thrusters (the new craft's blue-white engines: white core, cyan body, ultramarine lick), the trail ribbon, the flare ----
const ADD = { blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneFactor,
  blendEquationAlpha: THREE.AddEquation, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor };
const flameMat = (hex, op) => new THREE.MeshBasicMaterial({ color: hex, transparent: true, opacity: op, depthWrite: false, ...ADD });
const fl = [
  { m: new THREE.Mesh(new THREE.ConeGeometry(1.0, 1, 20, 1, true), flameMat(0x2a6fd0, 0.55)), r: 1.35, l: 11 },
  { m: new THREE.Mesh(new THREE.ConeGeometry(1.0, 1, 20, 1, true), flameMat(0x6fd2ff, 0.75)), r: 0.95, l: 7.5 },
  { m: new THREE.Mesh(new THREE.ConeGeometry(1.0, 1, 20, 1, true), flameMat(0xf4fcff, 0.95)), r: 0.55, l: 4.2 }
];
fl.forEach(o => { o.m.geometry.translate(0, 0.5, 0); o.m.rotation.x = Math.PI; plume.add(o.m); });   // base at the nozzle, tip trailing
// the exhaust: painted puffs left along the path (cream -> orange -> dusk violet), expanding and fading; additive on space
const PUFF_N = 130, PUFF_DT = 0.02;
const puffs = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 2), new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, ...ADD,
  vertexShader: `varying vec3 vC; varying float vS; void main(){
    vec4 mv = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
    vec3 n = normalize(normalMatrix * mat3(instanceMatrix) * normal);
    vC = instanceColor; vS = max(dot(n, normalize(-mv.xyz)), 0.0);
    gl_Position = projectionMatrix * mv; }`,
  fragmentShader: `varying vec3 vC; varying float vS; void main(){ gl_FragColor = vec4(vC * pow(vS, 1.6), 1.0); }`
}), PUFF_N);
puffs.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(PUFF_N * 3), 3);
puffs.frustumCulled = false; puffs.visible = false; planet.scene.add(puffs);
const TRAIL_N = 48;
const trailGeo = new THREE.BufferGeometry();
trailGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TRAIL_N * 2 * 3), 3));
trailGeo.setAttribute('aT', new THREE.BufferAttribute(new Float32Array(TRAIL_N * 2), 1));
{ const ix = []; for (let i = 0; i < TRAIL_N - 1; i++) { const a = i * 2; ix.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } trailGeo.setIndex(ix); }
for (let i = 0; i < TRAIL_N; i++) { trailGeo.attributes.aT.array[i * 2] = i / (TRAIL_N - 1); trailGeo.attributes.aT.array[i * 2 + 1] = i / (TRAIL_N - 1); }
const trailMat = new THREE.ShaderMaterial({
  uniforms: { uFade: { value: 1 } }, transparent: true, depthWrite: false, ...ADD, side: THREE.DoubleSide,
  vertexShader: `attribute float aT; varying float vT; void main(){ vT = aT; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `uniform float uFade; varying float vT;
    void main(){
      vec3 c = mix(vec3(0.92, 0.98, 1.0), vec3(0.36, 0.78, 1.0), smoothstep(0.0, 0.35, vT));
      c = mix(c, vec3(0.2, 0.26, 0.6), smoothstep(0.35, 1.0, vT));
      float a = (1.0 - smoothstep(0.05, 1.0, vT)) * uFade;
      gl_FragColor = vec4(c * a, 1.0);
    }`
});
const trail = new THREE.Mesh(trailGeo, trailMat); trail.frustumCulled = false; trail.visible = false; planet.scene.add(trail);
function flareTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  const r = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  r.addColorStop(0, 'rgba(244,252,255,1)'); r.addColorStop(0.12, 'rgba(190,236,255,0.9)'); r.addColorStop(0.35, 'rgba(80,170,240,0.35)'); r.addColorStop(1, 'rgba(40,60,140,0)');
  g.fillStyle = r; g.fillRect(0, 0, 256, 256);
  g.globalCompositeOperation = 'lighter';
  for (const [w, h, rot] of [[250, 7, 0], [7, 250, 0], [170, 4, 0.785], [170, 4, -0.785]]) {
    g.save(); g.translate(128, 128); g.rotate(rot);
    const s = g.createLinearGradient(-w / 2, 0, w / 2, 0); s.addColorStop(0, 'rgba(190,236,255,0)'); s.addColorStop(0.5, 'rgba(236,250,255,0.9)'); s.addColorStop(1, 'rgba(190,236,255,0)');
    g.fillStyle = s; g.beginPath(); g.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2); g.fill(); g.restore();
  }
  const t = new THREE.CanvasTexture(c); return t;
}
const flare = new THREE.Sprite(new THREE.SpriteMaterial({ map: flareTexture(), transparent: true, depthWrite: false, depthTest: false, ...ADD }));
flare.visible = false; flare.renderOrder = 20; planet.scene.add(flare);
// her finish re-renders the scene with an override material for its pencil lines: light has no lines, so the
// additive pieces sit out of that pass (otherwise a sprite or a puff draws as a solid quad / ball of 'normals')
{
  const glow = () => [flare, puffs, trail, ...fl.map(o => o.m)];
  let saved = [];
  planet.renderHook({
    beforeFinish() { saved = glow().map(o => o.visible); glow().forEach(o => { o.visible = false; }); },
    afterFinish() { glow().forEach((o, i) => { o.visible = saved[i]; }); }
  });
}

/* ======================================================================================================
   4. the timeline
   ====================================================================================================== */
const paintCanvas = prenderer.domElement;
let painter = null;
const show = which => { paintCanvas.classList.toggle('off', which !== 'paint'); pcanvas.classList.toggle('off', which !== 'planet'); };

// the planet clock is a pure function of t: we set her time uniform and her clouds before each frame
let plNow = 0;
function planetFrame(T) {
  const dt = 1 / 60;
  planet.uniforms.uTime.value = 20 + T - dt;
  planet.world.clouds.rotation.y = 0.15 + (T - dt) * 0.004;
  sceneT = 30 + T;
  plNow += dt * 1000; planet.frame(plNow);
}
function planetCam(position, look, up = V3(0, 1, 0), fov = 40) {
  planet.camera.fov = fov; planet.camera.updateProjectionMatrix();
  planet.cameraFree({ position, look, up, fov, snap: true });
}

// ---- the view through the porthole: her planet, the tower on the limb, the limb low across the glass ----
// A pose in her space: the camera `D` from the centre on bearing (az, el); the planet's centre put at screen NDC
// (cx, cy) with lens `fov` (a long lens, so the limb is a long gentle curve); `roll` tilts the horizon.
// The sun sits `psi` round the limb from the top of the screen, `delta` (radians) above it (negative = still below).
const PL = { D: 860, az: 0.5, el: -0.9, cx: 0.08, cy: -1.55, fov: 14, roll: 0.15, psi: 0.12, d0: -0.012, d1: 0.016, spin: 0.07 };
for (const k of Object.keys(PL)) if (Q.has('pl_' + k)) PL[k] = +Q.get('pl_' + k);   // (lab) framing overrides
const _m = new THREE.Matrix4();
function planetPose(s) {
  const az = PL.az + PL.spin * s, el = PL.el, D = PL.D * (1 + 0.035 * s);
  const pos = V3(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)).multiplyScalar(D);
  const c = pos.clone().negate().normalize();                       // toward the centre
  const right0 = c.clone().cross(V3(0, 1, 0)).normalize(), up0 = right0.clone().cross(c).normalize();
  const [vw, vh] = viewSize(), vf = THREE.MathUtils.degToRad(PL.fov), asp = vw / vh;
  const tx = Math.atan(PL.cx * Math.tan(vf / 2) * asp), ty = Math.atan(PL.cy * Math.tan(vf / 2));
  // turn the view so the centre lands at (cx, cy): yaw by -tx about up0, pitch by -ty about right0
  const fwd = c.clone().applyAxisAngle(up0, tx).applyAxisAngle(right0, -ty).normalize();
  const right = fwd.clone().cross(up0).normalize();
  let up = right.clone().cross(fwd).normalize();
  up.applyAxisAngle(fwd, PL.roll); const rr = fwd.clone().cross(up).normalize();
  return { pos, fwd, up, right: rr, c, fov: PL.fov, D };
}
// the sun: just past the limb at angle psi (from screen-up, toward screen-right), delta above it
function sunDir(P, delta) {
  const beta = Math.asin(RP / P.D);
  const u = P.up.clone().multiplyScalar(Math.cos(PL.psi)).addScaledVector(P.right, Math.sin(PL.psi));
  u.addScaledVector(P.c, -u.dot(P.c)).normalize();
  const a = beta + delta;
  return P.c.clone().multiplyScalar(Math.cos(a)).addScaledVector(u, Math.sin(a)).normalize();
}
const sunState = { uv: new THREE.Vector2(0.5, 0.5), k: 0 };
function placePlanetView(s, T, sunDelta) {
  const P = planetPose(s);
  planetCam(P.pos, P.pos.clone().addScaledVector(P.fwd, 100), P.up, P.fov);
  planetFrame(T);
  const cam = planet.camera; cam.updateMatrixWorld();
  winU.uPInv.value.copy(cam.projectionMatrixInverse); winU.uPWorld.value.copy(cam.matrixWorld); winU.uPCam.value.copy(cam.position);
  const sd = sunDir(P, sunDelta), sp = cam.position.clone().addScaledVector(sd, 4000).project(cam);
  sunState.uv.set(sp.x * 0.5 + 0.5, sp.y * 0.5 + 0.5);
  sunState.k = smooth(-0.004, 0.012, sunDelta);
  winU.uSunS.value.copy(sunState.uv); winU.uSun.value = sunState.k;
  return P;
}

// --- cabin cameras ---
function camSet(p, l, fov, roll = 0) {
  camera.position.copy(p); camera.up.set(Math.sin(roll), Math.cos(roll), 0); camera.lookAt(l); camera.fov = fov; camera.updateProjectionMatrix(); camera.updateMatrixWorld();
}
const bobF = (T, k, a = 0.035) => Math.sin(T * 1.1 + k * 2.1) * a + Math.sin(T * 0.53 + k) * a * 0.6;

let planetHeld = -1;
const NOTHING = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
function setShotLook(id) {
  const inside = id === 'porthole';
  cabin.visible = true;
  hull.visible = !inside;
  winDisc.visible = inside; sideDiscs.forEach(d => { d.visible = inside; });
  scene.children.forEach(o => { if (o.isMesh && o.material && o.material.color && o.material.color.getHex() === 0x05060d) o.visible = inside; });
  LIGHT.uExt.value = 0;
  helmetU.uSil.value = inside ? 1 : 0; helmetU.uEnv.value = inside ? 0.5 : 0.22;
  // backlit: only the blended glass layer, so the planet shows through the bubble (a material swap: the painter
  // re-shows everything in colourOnly each frame, so visibility can't be used for these)
  cast.forEach(r => { r.helm.a.material = inside ? NOTHING : glassA; });
  cast.forEach(r => silhouette(r, inside && !Q.has('dbgLit')));
}
function cabinShot(id, u, T) {
  rocket.visible = false; trail.visible = false; flare.visible = false; puffs.visible = false;
  const dur = SHOTS.find(s => s.id === id).dur, s = u / dur;
  setShotLook(id);

  if (id === 'porthole') {
    // the sun crests at ~1.9 s; the planet turns slowly the whole time
    const sunDelta = lerp(PL.d0, PL.d1, smooth(0.6, 3.4, u));
    const P = placePlanetView(s, T, sunDelta);
    const sunK = sunState.k;
    LIGHT.uSun.value = sunK; helmetU.uSun.value = sunK;
    // the sun's place in the cabin (for the warm rim + wash): out beyond the glass, toward its point on screen
    const sunW = V3((sunState.uv.x - 0.5) * 9, PORT.y + (sunState.uv.y - 0.5) * 5, -7);
    LIGHT.uSunP.value.copy(sunW); silU.uSunP.value.copy(sunW);
    KEY_DIR.set(0.1, 0.5, -1).normalize();
    // camera: a slow, steady push in on the figure and the porthole, a breath of handheld float
    const e = lerp(s, easeIO(s), 0.5);
    const cp = V3(lerp(0.14, 0.04, e) + Math.sin(T * 0.5) * 0.006, lerp(1.0, 1.06, e) + Math.sin(T * 0.7) * 0.005, lerp(3.35, 2.2, e));
    camSet(cp, V3(lerp(0.04, 0.01, e), lerp(1.42, 1.4, e), 0), lerp(40, 36, e), -0.012);
    // Olla, before the glass: still, a slow float; as the sun comes up she lifts her head and her propeller spins up
    const look = smooth(1.9, 3.0, u);
    poseFlit(A, { pos: V3(0.1 + 0.012 * Math.sin(T * 0.6), 0.98 + bobF(T, 0, 0.012) + 0.03 * look, 0.62), heading: Math.PI - 0.08 * look, pitch: lerp(0.12, -0.12, look), roll: 0.05 * look,
      prop: T * 2.2 + Math.max(0, u - 2.1) * Math.max(0, u - 2.1) * 9, t: T, armReach: 0.15 });
    // Momo at the left viewport under her parasol, Nando pressed to the right one; he turns to look at the hero window
    poseFloatie(D, { pos: V3(SIDES[0].x + 0.1, SIDES[0].y + 0.42 + bobF(T, 3, 0.02), 0.42), heading: Math.PI + 0.25, tilt: -0.05, roll: 0.05, t: T });
    const nt = smooth(2.6, 3.4, u);
    poseFlit(C, { pos: V3(SIDES[1].x - 0.04, SIDES[1].y - 0.12 + bobF(T, 2, 0.015), 0.4), heading: Math.PI + 0.1 + 0.55 * nt, pitch: 0.12, roll: -0.05, prop: T * 3, t: T, armReach: 0.9 * (1 - nt) });
    poseFlit(B, { pos: V3(0, -40, 0), heading: 0, t: T });   // Pippo is off in the glass shot only
    finalU.uSunK.value = sunK; finalU.uSun.value.copy(sunState.uv);
  } else {   // glass: the reverse, from space
    // the planet is behind the camera here: it only shows as a faint reflection, so it holds still (one fixed frame,
    // rendered once and kept: the glass shot then costs no planet render at all)
    const glassT = PLAY.find(x => x.id === 'glass').t0;
    if (planetHeld !== glassT) { placePlanetView(1.1, glassT, PL.d1 + 0.005); planetTex.needsUpdate = true; planetHeld = glassT; }
    LIGHT.uExt.value = 0;
    LIGHT.uSun.value = 0.0; helmetU.uSun.value = 0;
    KEY_DIR.set(-0.3, 0.42, -1).normalize();   // the planet's light, from behind the camera
        const e = easeIO(s);
    const cp = V3(lerp(-0.5, -0.32, e) + Math.sin(T * 0.6) * 0.006, lerp(1.28, 1.34, e), lerp(-2.25, -1.8, e));
    camSet(cp, V3(lerp(0.0, 0.02, e), 1.5, 0.4), 30, 0.025);
    const toCam = p => Math.atan2(cp.x - p.x, cp.z - p.z);
    // the glint sweeps across the glass
    winU.uGlint.value = lerp(-0.55, 0.65, smooth(0.5, 2.6, u));
    // Olla, pressed to the glass: her eyes go wide, a little hop; Pippo squeezes in on the right; Nando and Momo behind
    const wa = backOut(smooth(0.35, 0.8, u)), ha = hop(u, 1.35, 0.4, 0.07);
    const pA = V3(-0.24, 1.3 + bobF(T, 0, 0.012) + ha.y, 0.2);
    poseFlit(A, { pos: pA, heading: toCam(pA) + 0.15, pitch: lerp(0.18, 0.04, ease(smooth(0.3, 0.9, u))), roll: 0.05,
      wide: wa, open: smooth(0.45, 0.8, u) * (0.75 + 0.25 * Math.sin(T * 9)), sq: ha.sq, prop: T * 8, t: T, armReach: 1 });
    const bIn = easeOut(smooth(0.25, 1.15, u)), hb = hop(u, 1.85, 0.38, 0.06);
    const pB = V3(lerp(0.85, 0.28, bIn), 1.36 + bobF(T, 1, 0.015) + hb.y, 0.28);
    poseFlit(B, { pos: pB, heading: toCam(pB) - 0.3 * (1 - bIn) + 0.05, pitch: 0.12, roll: -0.1,
      wide: backOut(smooth(1.45, 1.8, u)), open: smooth(1.5, 1.75, u) * 0.8, sq: hb.sq, prop: T * 10, t: T, armReach: 0.7 });
    const pC = V3(0.04, 1.8 + bobF(T, 2, 0.02), 0.85);
    poseFlit(C, { pos: pC, heading: toCam(pC) + 0.1, pitch: 0.1, roll: 0.1, wide: backOut(smooth(1.9, 2.3, u)), open: 0.3 * smooth(1.9, 2.3, u), prop: T * 9, t: T });
    poseFloatie(D, { pos: V3(lerp(-0.8, -0.6, s), 2.5 + bobF(T, 3, 0.03), 0.95), heading: Math.PI + 0.2, tilt: 0.1, roll: 0.15, wide: 0.6, t: T, wave: smooth(1.6, 2.0, u) });
    finalU.uSunK.value = 0;
  }
  if (id === 'porthole') { planetTex.needsUpdate = true; planetHeld = -1; }
  if (Q.get('dbg') === 'planet') { show('planet'); return; }
  if (painter) {
    const { iw, ih } = painter.internalSize; winU.uRes.value.set(iw, ih); winU.uAspect.value = iw / ih;
    painter.renderWorld(); painter.renderFolk();
    finalPass();
  }
  show('paint');
}

// ---- the final light pass, on top of her composite: halation on what glows, the sunrise flare, a soft vignette ----
const FS_VERT = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const brightMat = new THREE.ShaderMaterial({
  uniforms: { tCol: { value: null }, uThr: { value: 0.8 } }, vertexShader: FS_VERT,
  fragmentShader: `uniform sampler2D tCol; uniform float uThr; varying vec2 vUv;
    void main(){ vec3 c = texture2D(tCol, vUv).rgb; float l = max(c.r, max(c.g, c.b)); gl_FragColor = vec4(c * smoothstep(uThr, 1.0, l), 1.0); }`
});
const blurMat = new THREE.ShaderMaterial({
  uniforms: { tCol: { value: null }, uDir: { value: new THREE.Vector2() } }, vertexShader: FS_VERT,
  fragmentShader: `uniform sampler2D tCol; uniform vec2 uDir; varying vec2 vUv;
    void main(){
      vec3 c = texture2D(tCol, vUv).rgb * 0.2270;
      c += (texture2D(tCol, vUv + uDir * 1.3846).rgb + texture2D(tCol, vUv - uDir * 1.3846).rgb) * 0.3162;
      c += (texture2D(tCol, vUv + uDir * 3.2308).rgb + texture2D(tCol, vUv - uDir * 3.2308).rgb) * 0.0703;
      gl_FragColor = vec4(c, 1.0);
    }`
});
const finalU = { tCol: { value: null }, tB1: { value: null }, tB2: { value: null }, uBloom: { value: 0.4 }, uSun: { value: new THREE.Vector2(0.5, 0.5) }, uSunK: { value: 0 },
  uAspect: { value: 16 / 9 }, uVig: { value: 0.32 }, uSunC: { value: hex3('#ffb27a') } };
const finalMat = new THREE.ShaderMaterial({
  uniforms: finalU, vertexShader: FS_VERT,
  fragmentShader: `uniform sampler2D tCol, tB1, tB2; uniform vec2 uSun; uniform float uSunK, uAspect, uBloom, uVig; uniform vec3 uSunC; varying vec2 vUv;
    void main(){
      vec3 c = texture2D(tCol, vUv).rgb;
      vec3 b = texture2D(tB1, vUv).rgb * 0.7 + texture2D(tB2, vUv).rgb * 1.0;
      c += b * uBloom * vec3(0.92, 0.96, 1.06);
      vec2 d = (vUv - uSun) * vec2(uAspect, 1.0); float r = length(d);
      float core = exp(-r * r / 0.00012), glow = exp(-r * r / 0.004) * 0.55 + exp(-r / 0.09) * 0.22 + exp(-r / 0.35) * 0.06;
      float streak = exp(-abs(d.y) / 0.0028) * exp(-abs(d.x) / 0.28) * 0.5;
      c += uSunK * (uSunC * glow + vec3(1.0, 0.97, 0.92) * core * 1.3 + mix(uSunC, vec3(0.62, 0.76, 1.0), 0.55) * streak);
      vec2 q = (vUv - 0.5) * vec2(uAspect, 1.0) * 0.62; c *= 1.0 - uVig * smoothstep(0.15, 0.75, dot(q, q) * 2.2);
      gl_FragColor = vec4(c, 1.0);
    }`
});
const fsScene = new THREE.Scene(), fsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const fsQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), finalMat); fsQuad.frustumCulled = false; fsScene.add(fsQuad);
const RT = { comp: null, a: null, b: null, c: null, d: null };
function makeFinalTargets() {
  Object.values(RT).forEach(t => t && t.dispose());
  const W = paintCanvas.width, H = paintCanvas.height, o = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };
  RT.comp = new THREE.WebGLRenderTarget(W, H, o);
  const w4 = Math.max(1, Math.round(W / 4)), h4 = Math.max(1, Math.round(H / 4)), w8 = Math.max(1, Math.round(W / 10)), h8 = Math.max(1, Math.round(H / 10));
  RT.a = new THREE.WebGLRenderTarget(w4, h4, o); RT.b = new THREE.WebGLRenderTarget(w4, h4, o);
  RT.c = new THREE.WebGLRenderTarget(w8, h8, o); RT.d = new THREE.WebGLRenderTarget(w8, h8, o);
  finalU.uAspect.value = W / H;
}
function fsPass(mat, target) { fsQuad.material = mat; prenderer.setRenderTarget(target); prenderer.render(fsScene, fsCam); }
function finalPass() {
  painter.pass(painter.materials.printMat, RT.comp);   // her composite (uniforms set by painter.composite at resize)
  brightMat.uniforms.tCol.value = RT.comp.texture; fsPass(brightMat, RT.a);
  const blur = (src, dst, w, h, k) => { blurMat.uniforms.tCol.value = src.texture; blurMat.uniforms.uDir.value.set(k / w, 0); fsPass(blurMat, dst); blurMat.uniforms.tCol.value = dst.texture; blurMat.uniforms.uDir.value.set(0, k / h); fsPass(blurMat, src); };
  blur(RT.a, RT.b, RT.a.width, RT.a.height, 1.0); blur(RT.a, RT.b, RT.a.width, RT.a.height, 2.0);
  blurMat.uniforms.tCol.value = RT.a.texture; blurMat.uniforms.uDir.value.set(0, 0); fsPass(blurMat, RT.c);
  blur(RT.c, RT.d, RT.c.width, RT.c.height, 1.5); blur(RT.c, RT.d, RT.c.width, RT.c.height, 3.0);
  finalU.tCol.value = RT.comp.texture; finalU.tB1.value = RT.a.texture; finalU.tB2.value = RT.c.texture;
  fsPass(finalMat, null);
}
// --- space ---
// the rocket's flight (her space: Earth at the origin, radius RP = 170): from just off the limb toward Plisse
const PL_DIR = PL_POS.clone().normalize();
const ROUTE = {   // quadratic Bezier: off the Earth's limb, an arc out, toward Plisse (it stops well short of it)
  p0: fr(0.35, 0.75, 0.56).normalize().multiplyScalar(RP + 16), p1: fr(330, 200, 230), p2: fr(820, 110, 10)
};
function bez(a, b, c, k) { const m = 1 - k; return V3(a.x * m * m + 2 * b.x * m * k + c.x * k * k, a.y * m * m + 2 * b.y * m * k + c.y * k * k, a.z * m * m + 2 * b.z * m * k + c.z * k * k); }
const SPACE_DUR = 7.2;
const CUT = 4.6;   // engines cut (s into the shot)
const progress = u => { // an accelerating burn, then coasting at the cut-off speed
  const v0 = 0.03, a = 0.03;
  if (u <= CUT) return v0 * u + 0.5 * a * u * u;
  const pc = v0 * CUT + 0.5 * a * CUT * CUT, vc = v0 + a * CUT;
  return pc + vc * (u - CUT) * 0.9;
};
const PMAX = progress(SPACE_DUR);
const rocketAt = u => bez(ROUTE.p0, ROUTE.p1, ROUTE.p2, progress(clamp(u, 0, SPACE_DUR)) / PMAX);
// the camera: a long eased chase from beside the Earth, swinging in behind the rocket so Plisse fills up ahead
const CAM = { c0: fr(-220, 300, 330), c1: fr(30, 330, 270), c2: fr(250, 330, 190) };
if (Q.has('c0')) CAM.c0 = fr(...Q.get('c0').split(',').map(Number));   // (lab) framing overrides
if (Q.has('c1')) CAM.c1 = fr(...Q.get('c1').split(',').map(Number));
function spaceShot(u, T) {
  hull.visible = false;
  rocket.visible = true; trail.visible = true;
  const p = rocketAt(u), vel = rocketAt(u + 0.05).sub(rocketAt(u - 0.05)).normalize();
  rocket.position.copy(p);
  // nose along the velocity (rocket +y), a slow roll
  const q = new THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0), vel);
  q.multiply(new THREE.Quaternion().setFromAxisAngle(V3(0, 1, 0), 0.6 + u * 0.35));
  rocket.quaternion.copy(q);
  // plume: full burn with a flicker, choked at the cut
  const burn = u < CUT ? 1 : Math.max(0, 1 - (u - CUT) / 0.28);
  const flick = k => 1 + 0.12 * Math.sin(T * 47 + k * 2.3) + 0.08 * Math.sin(T * 83 + k);
  fl.forEach((o, k) => { const b = Math.pow(burn, 0.7 + k * 0.3); o.m.scale.set(o.r * flick(k) * (0.6 + 0.4 * b), o.l * flick(k + 3) * b + 0.001, o.r * flick(k) * (0.6 + 0.4 * b)); o.m.visible = b > 0.01; });
  // the trail: where it has been (a camera-facing ribbon), fading after the cut
  const cam = planet.camera, pa = trailGeo.attributes.position.array, span = 2.2;
  const noz = p.clone().addScaledVector(vel, -10 * ROCKET_SCALE);
  for (let i = 0; i < TRAIL_N; i++) {
    const k = i / (TRAIL_N - 1), uu = Math.max(0, u - k * span);
    const c = i === 0 ? noz : rocketAt(uu).addScaledVector(vel, -10 * ROCKET_SCALE);
    const dir = rocketAt(uu + 0.03).sub(rocketAt(uu - 0.03)); if (dir.lengthSq() < 1e-8) dir.copy(vel); dir.normalize();
    const side = dir.clone().cross(cam.position.clone().sub(c)).normalize();
    const w = (0.5 + 1.2 * k) * ROCKET_SCALE * (uu < CUT ? 1 : 0.3);
    pa[i * 6] = c.x + side.x * w; pa[i * 6 + 1] = c.y + side.y * w; pa[i * 6 + 2] = c.z + side.z * w;
    pa[i * 6 + 3] = c.x - side.x * w; pa[i * 6 + 4] = c.y - side.y * w; pa[i * 6 + 5] = c.z - side.z * w;
  }
  trailGeo.attributes.position.needsUpdate = true; trailGeo.computeBoundingSphere();
  trailMat.uniforms.uFade.value = 0.4 * (u < CUT ? smooth(0, 0.3, u) : Math.max(0, 1 - (u - CUT) / 0.5)); trail.visible = u < CUT + 0.5;
  // the exhaust puffs: emitted every PUFF_DT while burning, each drifting out and swelling as it ages
  puffs.visible = true;
  const mtx = new THREE.Matrix4(), col = new THREE.Color(), cA = new THREE.Color('#effaff'), cB = new THREE.Color('#5fc4ff'), cC = new THREE.Color('#33377e');
  for (let i = 0; i < PUFF_N; i++) {
    const te = Math.floor(u / PUFF_DT) * PUFF_DT - i * PUFF_DT, age = u - te;
    if (te < 0 || te > CUT) { mtx.makeScale(0, 0, 0); puffs.setMatrixAt(i, mtx); col.setRGB(0, 0, 0); puffs.setColorAt(i, col); continue; }
    const n = Math.round(te / PUFF_DT), j1 = hsh(n * 3.1) - 0.5, j2 = hsh(n * 7.7) - 0.5, j3 = hsh(n * 1.9) - 0.5;
    const at = rocketAt(te), v = rocketAt(te + 0.03).sub(rocketAt(te - 0.03)).normalize();
    const pos = at.addScaledVector(v, -(12 + 8 * age) * ROCKET_SCALE).add(V3(j1, j2, j3).multiplyScalar(age * 9 * ROCKET_SCALE));
    const r = (0.9 + age * 2.8 + 0.8 * hsh(n * 5.3)) * ROCKET_SCALE;
    mtx.makeScale(r, r, r).setPosition(pos); puffs.setMatrixAt(i, mtx);
    const k = clamp(age / 1.6);
    col.copy(cA).lerp(cB, smooth(0.0, 0.35, k)).lerp(cC, smooth(0.35, 1, k)).multiplyScalar(0.75 * (1 - smooth(0.1, 1, k)) * smooth(0, 0.06, age));
    puffs.setColorAt(i, col);
  }
  puffs.instanceMatrix.needsUpdate = true; puffs.instanceColor.needsUpdate = true;
  // the flare at the cut: a bloom at the nozzle that flashes and fades in ~0.9 s
  const fu = (u - CUT) / 0.9;
  if (fu > -0.06 && fu < 1) {
    flare.visible = true;
    const k = fu < 0.1 ? smooth(-0.06, 0.1, fu) : Math.pow(1 - smooth(0.1, 1, fu), 1.6);
    flare.position.copy(p).addScaledVector(vel, -8 * ROCKET_SCALE);
    flare.scale.setScalar(lerp(20, 110, Math.sqrt(clamp(fu + 0.06))) * k + 0.01);
    flare.material.opacity = k;
  } else flare.visible = false;
  // camera
  const s = u / SPACE_DUR, e = easeIO(s);
  const cpos = bez(CAM.c0, CAM.c1, CAM.c2, e);
  // look between the Earth's limb and Plisse, panning toward Plisse as the rocket pulls away
  // track the rocket with a lead toward Plisse; a slow zoom (44 -> 27) so Plisse swells as the rocket closes on it
  const dE = V3().sub(cpos).normalize(), dR = p.clone().sub(cpos).normalize(), dP = PL_POS.clone().sub(cpos).normalize();
  const wE = 0.3 * (1 - smooth(0.0, 0.45, s)), wP = lerp(0.5, 0.42, e);
  const dir = dR.multiplyScalar(1 - wE - wP).add(dE.multiplyScalar(wE)).add(dP.multiplyScalar(wP)).normalize();
  planetCam(cpos, cpos.clone().addScaledVector(dir, 300), U_DIR.clone().applyAxisAngle(F_DIR, 0.1 - 0.1 * e), lerp(44, 27, easeIO(smooth(0.1, 1, s))));
  planetFrame(T);
  show('planet');
}

let lastT = -1;
function renderAt(t) {
  t = clamp(t, 0, DURATION - 1e-6);
  const { s, u } = shotAt(t);
  if (s.id === 'space') { planetHeld = -1; spaceShot(u, t); } else cabinShot(s.id, u, t);
  lastT = t; shot.t = t;
}

/* ======================================================================================================
   5. boot + the capture contract
   ====================================================================================================== */
const shot = {
  duration: DURATION, done: false, t: 0,
  shots: PLAY.map(s => ({ id: s.id, name: s.name, t0: s.t0, dur: s.dur })), cuts: PLAY.slice(1).map(s => s.t0),
  ready: null, rocketPlaceholder: () => rocketPlaceholder,
  seek(t) { renderAt(t); return new Promise(r => requestAnimationFrame(() => r(t))); },
  play() {
    shot.done = false;
    const t0 = performance.now();
    return new Promise(res => {
      (function step() {
        const t = (performance.now() - t0) / 1000;
        if (t >= DURATION) { renderAt(DURATION); shot.done = true; return res(true); }
        renderAt(t); requestAnimationFrame(step);
      })();
    });
  }
};
window.__shot = shot;
function resizeAll() {
  sizePlanet(); planetHeld = -1;
  painter.resize(...viewSize());   // her G_DEFAULT untouched: no paint overrides here
  painter.composite();             // sets her composite's inputs once; the final pass then draws it into its own target
  makeFinalTargets();
}
shot.ready = (async () => {
  await Promise.all([loadRocket(), lookReady]);
  // the painter, made after everything is in the scene (its targets size to the canvas)
  painter = createPainter(ctx, folk, { framing: (cam, w, h) => { cam.aspect = w / h; } });
  painter.setMode(1);
  await applySavedLook(painter, 't3');   // her saved trailer look (look.json trailer.t3_*, else her t6 master look)
  mountLookLab(painter, { key: 't3', onChange: () => { painter.markDirty(); if (lastT >= 0) renderAt(lastT); } });
  resizeAll();
  // warm both pipelines (shader compiles) on a frame of each kind
  const sp = PLAY.find(s => s.id === 'space'); if (sp) renderAt(sp.t0 + 0.1);
  for (const s of PLAY) if (s.id !== 'space') renderAt(s.t0 + 0.05);
  renderAt(0);
  if (Q.has('t')) { renderAt(+Q.get('t')); shot.done = true; }
  else if (Q.get('autoplay') === '1') shot.play();
  return true;
})();
if (!FIXED) addEventListener('resize', () => { if (!painter) return; resizeAll(); if (lastT >= 0) renderAt(lastT); });
window.__t3 = { cast, A, B, C, D, winDisc, scene, helmetU, painter: () => painter, renderAt };
