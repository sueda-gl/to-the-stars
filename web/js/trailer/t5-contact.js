// ALOUD trailer, beat t5: FIRST CONTACT on Plissé's meadow (TRAILER.md, 14-22 s of the cut).
//
// The Alpine lounge at midday, exactly as she painted it (the replica in t5-lounge.js: her scene code and her r147
// anisotropic-Kuwahara gouache, copied from the landing bridge). Into it: the rocket comes down on a painted plume and
// settles on the meadow beside the red rug, steam rolls across the grass and the shadelings scatter; the hatch swings
// open and our folk (verbatim Red arch flits and floaties, web/js/paint/folk.js: five parasol floaties, two flits) come
// out in bubble helmets and the craft's pearl-and-cyan gear (t5-suits.js), the floaties down on their packs' thrusters
// with parasols furled; on the grass they take the helmets off one by one (set down in the meadow, one hugged under an
// arm) and the floaties' parasols bloom open as they lift off the grass and drift under them; the shadelings
// come back in a loose, careful ring; a flit holds out a glowing seed and lays it on the rug; the shadelings crowd
// round it (her own seed behaviour) and their bead antennae brighten; her golden hour washes in; a held last frame for
// the title card.
//
// Deterministic: everything is a function of the timeline clock t. The shadelings are stepped at a fixed 1/60 s
// from a snapshot of her meadow, so seek(t) re-simulates the same frame every time.
//   window.__shot = { duration, fps, seek(t), play(), done, ready, shots }   ·   ?t=12.5 renders one still
//
// Sizes: our folk and the rocket are authored in Red arch metres (a flit ~0.8 m, the rocket 16.8 m); the lounge's set
// is life-size furniture and its shadelings are ~0.5 m, so both come in at K = 0.42 (a flit ~ a shadeling, the rocket
// ~7 m, its hatch sill ~1.45 m above the grass, which our fliers simply fly down from).

import { buildLounge, createGouachePost } from './t5-lounge.js';
import { createContext } from '../paint/context.js';
import { createKit } from '../paint/kit.js';
import { createFolk } from '../paint/folk.js';
import { createBuildApi, compileAsset } from '../buildings/api.js';
import { applyColourRule } from '../agents/colour-rule.js';
import { createSuits } from './t5-suits.js';

const W = 1920, H = 1080, FPS = 30, SIM_DT = 1 / 60;
const K = 0.42;
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const V2 = (x, y) => new THREE.Vector2(x, y);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (a, b, x) => { let t = (x - a) / (b - a); t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); };
const lin = (a, b, x) => clamp((x - a) / (b - a), 0, 1);
const easeIO = u => u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;   // cubic in-out
const easeO = u => 1 - Math.pow(1 - u, 3);
const lerp = (a, b, u) => a + (b - a) * u;
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
const lerpAng = (a, b, u) => a + wrap(b - a) * u;
const hash = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

// ---------------------------------------------------------------- the timeline ----------------------------------------------------------------
// 2026-10-04 (Sueda: "more of the umbrella types and less green, out of the rocket in their astronaut suits, and take
// them off"): the crew comes out in bubble helmets (t5-suits.js) and takes them off one by one on the grass; the
// floaties' parasols bloom as their helmets come off. That beat needs room, so everything from the shadelings' return
// on is 1.6 s later (hatch shot +0.4 s, approach shot 2.4 -> 3.6 s); descent / landing / hatch timing is unchanged.
const DT = 1.6;
export const TL = {
  duration: 21 + DT,
  rocketH0: 17,            // m above the meadow at t = 0
  touch: 3.8,              // touchdown
  burnOff: [3.5, 4.35],    // the plume dies
  alarm: 1.7,              // the shadelings notice the fire in the sky
  hatch: [5.55, 6.35],     // the hatch swings open
  emerge: [6.05, 6.35, 6.65, 6.95, 7.25, 7.55, 7.85],
  off: [8.45, 9.45, 10.1, 9.8, 10.45, 10.8, 11.15],   // each one's helmet comes off (one by one, in landing order)
  curious: 8.3 + 0.6,      // the shadelings come back, carefully
  lift: 10.6 + DT,         // the lead flit rises with the seed
  seedShow: [10.95 + DT, 11.5 + DT], // the seed glows into being in its hands
  lay: [12.05 + DT, 12.75 + DT],     // lowered onto the rug
  release: 12.75 + DT,
  gather: 12.9 + DT,       // the shadelings crowd round it
  golden: [14.3 + DT, 18.6 + DT],    // her golden hour
  hold: 18.6 + DT          // the final frame, held to the end
};
// shots: hard cuts between eased moves; each is a usable take for the edit
export const SHOTS = [
  { name: 'descent', t0: 0.0, t1: 5.2 },
  { name: 'hatch', t0: 5.2, t1: 9.2 },
  { name: 'approach', t0: 9.2, t1: 12.8 },
  { name: 'offering', t0: 12.8, t1: 16.6 },      // 11.2 / 15.0 + DT
  { name: 'golden', t0: 16.6, t1: 22.6 }         // 15.0 / 21.0 + DT
];

// where things are (lounge metres; the set is centred on the origin, the camera of her opening frame looks down -z)
const RK = V2(3.9, -1.2), ROT = -0.55;      // the rocket's landing spot and turn (its hatch faces the rug)
const SEED = V2(0.55, 2.55);                // where the seed is laid, on the red rug's front edge
const FC = V2(2.15, 2.45);                  // our folk's little group
const ROSTER = [                            // our folk, in the order they come out: mostly parasol folk now, two flits
// helmets: `rest` = set down on the grass at land + [dx, dz] (just behind them, away from the camera, so as each floatie
// rises under its open parasol its helmet is left sitting in the meadow); `tuck` = the second flit hugs its own under
// its arm
  { kind: 'flit', sc: 1.5, land: [1.28, 2.0], lead: true, mi: 0, rest: [0.5, -0.42] },
  { kind: 'floatie', sc: 1.32, land: [1.85, 2.75], mi: 0, canopy: ['#e2483a', '#f6efe2'], rest: [0.3, -0.26] },
  { kind: 'floatie', sc: 1.26, land: [2.5, 3.2], mi: 1, canopy: ['#2f62d8', '#f6efe2'], rest: [0.22, -0.22] },
  { kind: 'flit', sc: 1.42, land: [1.95, 1.8], mi: 3, tuck: true },
  { kind: 'floatie', sc: 1.3, land: [2.6, 2.4], mi: 2, canopy: ['#e85a71', '#f6efe2'], rest: [0.2, -0.26] },
  { kind: 'floatie', sc: 1.22, land: [3.2, 2.95], mi: 3, canopy: ['#7a3d8c', '#f6efe2'], rest: [0.14, -0.3] },
  { kind: 'floatie', sc: 1.28, land: [3.15, 1.95], mi: 4, canopy: ['#f6efe2', '#e2483a'], rest: [0.24, -0.2] }
];

// ---------------------------------------------------------------- build ----------------------------------------------------------------
export async function runT5({ canvas, params = new URLSearchParams(location.search) } = {}) {
  THREE.ColorManagement.legacyMode = false;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setSize(W, H, false);

  const LO = buildLounge(renderer);
  const post = createGouachePost(renderer);
  post.sizePost(W, H);
  LO.water.getRenderTarget().setSize(Math.round(W * 0.6), Math.round(H * 0.6));
  const scene = LO.scene, camera = LO.camera;
  camera.aspect = W / H; camera.near = 0.05; camera.updateProjectionMatrix();
  const C = h => new THREE.Color(h);

  // ---------- our folk: the Red arch's verbatim flits and floaties, in the lounge's world units ----------
  const KEY_DIR = LO.modes.day.dir.clone();   // their clay light follows the lounge's sun
  const ctx = createContext({ renderer, scene, camera, seed: 23 });
  const stubNav = { obstacles: [], spots: [[0, 0]], closeFocus: V3(0, 0, 0), pickTarget() {}, onArrive() {}, flyTarget(f) { f.route.push(f.pos.clone()); },
    floatTarget(f) { f.route.push(f.pos.clone()); }, flyPush() {}, extraPush() {}, bounds() {} };
  const folk = createFolk(ctx, { KEY_DIR }, stubNav);
  const nubGeo = (() => { const g = new THREE.SphereGeometry(0.045, 10, 8); g.scale(0.75, 1.1, 0.8); g.translate(0, -0.03, 0); return g; })();
  const suits = createSuits({ folk, scene, KEY_DIR });
  // ART_DIRECTION §13 on our green flits, judged on the sRGB hex (under r147 with legacyMode off, Color.getHSL sees the
  // linear values, so colour-rule.js reads the reference's #f2c14e cap as orange and lets it through): a yellow cap /
  // brim / blade / scarf becomes cream (or red, if it sits next to cream already)
  function noYellow(a) {
    const skin = a.body.children[0].material;
    const yellow = c => { const h = c.getHexString(), r = parseInt(h.slice(0, 2), 16) / 255, g = parseInt(h.slice(2, 4), 16) / 255, b = parseInt(h.slice(4, 6), 16) / 255;
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn; if (d < 1e-4) return false;
      const sat = d / (1 - Math.abs(2 * l - 1)); let hue = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; hue = (hue * 60 + 360) % 360;
      return hue >= 36 && hue <= 68 && sat >= 0.35 && l >= 0.3 && l <= 0.86; };
    a.root.traverse(o => {
      if (!o.isMesh || o.material === skin || !o.material.uniforms || !o.material.uniforms.uBase) return;
      if (yellow(o.material.uniforms.uBase.value)) o.material = folk.cloth('#f4ead6');
    });
  }
  const crew = ROSTER.map((r, i) => {
    const a = r.kind === 'flit' ? folk.make.flit(r.mi) : folk.make.floatie(r.mi);
    a.driven = true;
    if (r.canopy) {   // our layer: a parasol mix that reads as a crowd of colours (no teal: less green in the shot)
      const cone = a.canopy.children[0], tip = a.canopy.children[1];
      cone.material = folk.cloth(r.canopy[0], r.canopy[1], 8); tip.material = folk.cloth(r.canopy[0]);
    }
    applyColourRule({ a }, folk);   // ART_DIRECTION §13: no yellow on a green flit
    if (r.kind === 'flit') noYellow(a);   // ...and its sRGB check, which colour-rule's HSL misses under r147's linear colours
    a.sc = r.sc * K; a.root.scale.setScalar(a.sc);
    if (r.kind === 'flit') {   // nub arms (the game's flits carry with them; the lead one holds the seed)
      const mat = a.body.children[0].material;
      a.arms = [-1, 1].map(sd => { const g = new THREE.Group(); g.position.set(sd * 0.215, -0.05, 0.03); const m = new THREE.Mesh(nubGeo, mat); m.castShadow = true; g.add(m); a.body.add(g); return g; });
    }
    const c = Object.assign(r, { i, a, emerge: TL.emerge[i], off: TL.off[i] });
    suits.dress(c);   // the astronaut gear: bubble helmet + collar (its own world group), pack, the flits' pearl suit
    a.root.traverse(o => { if (o.isMesh && o.material !== suits.glassMat && o.material !== suits.flameMat) o.castShadow = true; });
    a.legs.forEach(l => { l.leg.castShadow = l.foot.castShadow = true; });
    a.root.visible = false; a.legs.forEach(l => { l.leg.visible = l.foot.visible = false; }); c.gear.helm.visible = false;
    return c;
  });
  const lead = crew[0];
  // clay paint follows the light: their tones are multiplied toward the lounge's warm low sun at golden hour
  const clayMats = new Map();
  const collectClay = o => { const m = o.material; if (m && m.uniforms && m.uniforms.uBase && !clayMats.has(m)) clayMats.set(m, { b: m.uniforms.uBase.value.clone(), s: m.uniforms.uShade.value.clone(), r: m.uniforms.uRim.value.clone(), st: m.uniforms.uStripeCol.value.clone() }); };
  crew.forEach(c => { c.a.root.traverse(collectClay); c.gear.helm.traverse(collectClay); c.a.legs.forEach(l => { collectClay(l.leg); collectClay(l.foot); }); });
  // eyes / mouths are MeshBasic (tone-mapped): leave them

  // ---------- the rocket: the stock plan (web/js/buildings/examples/rocket.js) through the Build API ----------
  const rocket = await buildRocket(renderer);
  scene.add(rocket.wrap);

  // ---------- the plume: a painted flame, its glow, and steam that rolls across the meadow ----------
  const plume = makePlume(scene);
  const jets = rocket.engines.map(e => ({ e, p: makePlume(scene, { size: e.r / 0.98, glow: false }) }));   // one flame under each nacelle
  const steam = makeSteam(scene, LO);

  // ---------- the seed ----------
  const seed = makeSeed(scene);
  // a soft glow on every bead antenna, for when they brighten at the seed (and at her golden hour)
  const beadHaloMat = new THREE.SpriteMaterial({ map: haloTexture(), color: new THREE.Color('#ffd27a'), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  LO.shadelings.forEach(sh => {
    const bead = sh.body.children[3];
    sh.halo = new THREE.Sprite(beadHaloMat.clone()); sh.halo.scale.setScalar(1e-4); bead.add(sh.halo);
  });

  // ---------------------------------------------------------------- the simulation ----------------------------------------------------------------
  const rocketGroundY = LO.floorY(RK.x, RK.y);
  const sim = { t: 0, prop: crew.map(() => 0) };
  function reset() {
    LO.reseed(1234);
    sim.t = 0; sim.prop = crew.map(() => 0);
    LO.shadelings.forEach(s => { s.glow = 0; });
  }

  // the shadelings' goals: watch, flee the fire, come back in a careful ring, crowd round the seed
  const RKv = V2(RK.x, RK.y);
  // a free spot on the meadow (her shValid also refuses ground lower than 0.05, which is most of the flat meadow
  // round the set, so her shPick falls back to the strip in front of the rug; here only water and furniture count)
  const freeSpot = (x, z) => {
    const R = LO.shRegion; if (x < R.x0 || x > R.x1 || z < R.z0 || z > R.z1) return false;
    if (LO.groundH(x, z) < LO.WATER_Y + 0.15) return false;
    for (const [ox, oz, r] of LO.shObstacles) if ((x - ox) ** 2 + (z - oz) ** 2 < (r + 0.12) ** 2) return false;
    return true;
  };
  function shGoal(s, t, out) {
    const i = LO.crowd.indexOf(s), h = hash(i + 1);
    const cue = s.cue;
    // 1 · the fire in the sky: the near ones scurry out from under it, the far ones stop and stare
    const tAlarm = TL.alarm + 0.35 * h + s.pos.distanceTo(RKv) / 16;
    if (t < tAlarm) return null;   // her wander
    if (!cue.alarm) {
      cue.alarm = true;
      const d = s.pos.distanceTo(RKv);
      if (d < 6.0) {
        let dir = s.pos.clone().sub(RKv).normalize(), best = null;
        for (let k = 0; k < 13 && !best; k++) {
          const a = (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 0.26, c = Math.cos(a), sn = Math.sin(a);
          const dd = V2(dir.x * c - dir.y * sn, dir.x * sn + dir.y * c), r = Math.max(3.8, d + 1.3) + h * 0.7;
          const p = RKv.clone().addScaledVector(dd, r);
          if (freeSpot(p.x, p.y)) best = p;
        }
        cue.flee = best || s.pos.clone();
      } else cue.flee = s.pos.clone().addScaledVector(s.pos.clone().sub(RKv).normalize(), 0.4);
      return { goal: out.copy(cue.flee), speedK: 2.2, face: RKv, startle: 1.0 + 0.4 * h };
    }
    // 2 · the cautious ring round our folk (stop-and-go, watching them); a few stay shy, further out
    const shy = i % 3 === 2;
    const tCur = TL.curious + 1.3 * h;
    const tGat = TL.gather + 0.1 + 0.9 * h;
    if (t < tCur) return { goal: out.copy(cue.flee), speedK: 2.2, face: RKv };
    if (t < tGat) {
      if (!cue.ring) {
        let a = Math.atan2(s.pos.y - FC.y, s.pos.x - FC.x), p = null;
        for (let k = 0; k < 14 && !p; k++) {
          const aa = a + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 0.24, r = 1.15 + (s.ring % 0.7) * 1.0 + (shy ? 0.9 : 0);
          const q = V2(FC.x + Math.cos(aa) * r, FC.y + Math.sin(aa) * r);
          if (freeSpot(q.x, q.y) && q.distanceTo(RKv) > 2.3 && q.distanceTo(SEED) > 1.05 && crew.every(c => Math.hypot(q.x - c.land[0], q.y - c.land[1]) > 0.75)) p = q;
        }
        cue.ring = p || cue.flee;
      }
      const go = smooth(-0.4, 0.3, Math.sin(t * 2.3 + s.ring * 5.0));   // a few steps, a pause, a few steps
      return { goal: out.copy(cue.ring), speedK: 1.25 * (0.12 + 0.88 * go), face: FC, arrive: 0.5 };
    }
    // 3 · the seed: her own gather (seed.active in lounge.html), the ring she gave them
    // (her ring, 0.32-0.57 round the seed, on the side away from the camera and the flit: an open front; the shy
    // ones hang back in a looser outer ring)
    const ang = ((shy ? 185 : 140) + (s.ring / (Math.PI * 2)) * (shy ? 110 : 150)) * Math.PI / 180;   // 130-285 deg: front-left round to the back (the camera looks from ~76 deg, the flit stands at ~315)
    const rad = shy ? 0.95 + (s.ring % 0.7) * 0.6 : 0.32 + (s.ring % 0.7) * 0.25;
    return { goal: out.set(SEED.x + Math.cos(ang) * rad, SEED.y + Math.sin(ang) * rad), gather: !shy, arrive: shy ? 0.5 : 0.25, face: SEED, speedK: shy ? 0.7 : 1 };
  }

  function step(dt) {
    const t = sim.t + dt;
    // moving obstacles for the shadelings: the rocket once it is down, our folk once they stand on the grass
    const ex = [];
    if (t > TL.touch - 0.6) ex.push([RK.x, RK.y, 1.5]);
    crew.forEach(c => { const p = folkPlace(c, t); if (p && p.y < 0.35) ex.push([p.x, p.z, 0.2]); });
    crew.forEach(c => { if (!c.tuck && t > c.off + 1.1) { const r = helmetRest(c); ex.push([r.pos.x, r.pos.z, 0.14]); } });   // the helmets on the grass
    LO.setExtra(ex);
    LO.setMode(smooth(TL.golden[0], TL.golden[1], t));   // her lamp-lovers read the light: it must be this instant's
    LO.updateShadelings(dt, t, shGoal);
    // beads: brighten as each one reaches the glowing seed
    const lit = smooth(TL.release, TL.release + 0.6, t);
    LO.crowd.forEach(s => {
      const want = lit * smooth(1.25, 0.55, s.pos.distanceTo(SEED));
      s.glow += (want - s.glow) * Math.min(1, dt * 1.4);
    });
    // propellers: spin with the flight, wind down on the grass
    crew.forEach((c, k) => { sim.prop[k] += dt * propRate(c, t); });
    sim.t = t;
  }
  function seekSim(t) {
    if (t < sim.t - 1e-6) reset();
    const n = Math.round(t / SIM_DT);
    while (Math.round(sim.t / SIM_DT) < n) step(SIM_DT);
  }

  // ---------------------------------------------------------------- our folk's choreography (pure functions of t) ----------------------------------------------------------------
  // the rocket's door, in world space (the hatch faces the rug)
  const fwd = V3(Math.sin(ROT), 0, Math.cos(ROT));
  function doorAt(t) { return rocket.sill.clone().add(V3(0, rocketY(t), 0)); }   // the sill was measured with the rocket at y = 0
  const restH = c => c.kind === 'flit' ? 0.30 * c.a.sc : 1.14 * c.a.sc;   // body (flit) / parasol root (floatie) above the feet
  // phase times for one folk
  function phases(c) {
    const e = c.emerge, flit = c.kind === 'flit';
    // floaties: a beat in the doorway while the pack's thrusters light, then down on the cyan flame, parasol furled
    const door = flit ? 0.32 : 0.42, open = flit ? 0 : 0.12, fly = flit ? 1.5 : 1.7, land = flit ? 0.42 : 0.5;
    return { e, out: e + door, go: e + door + open, down: e + door + open + fly, ground: e + door + open + fly + land };
  }
  function bez(a, b, c, u) { const v = 1 - u; return V3(v * v * a.x + 2 * v * u * b.x + u * u * c.x, v * v * a.y + 2 * v * u * b.y + u * u * c.y, v * v * a.z + 2 * v * u * b.z + u * u * c.z); }
  // folkPlace(c, t) -> { x, y (feet above the floor), z, ... } or null while still inside
  function folkPlace(c, t) {
    const P = phases(c);
    if (t < P.e) return null;
    const door = doorAt(t), floor = (x, z) => LO.floorY(x, z);
    const L = V3(c.land[0], 0, c.land[1]); L.y = floor(L.x, L.z);
    const flit = c.kind === 'flit';
    const inside = door.clone().addScaledVector(fwd, -0.26), outside = door.clone().addScaledVector(fwd, 0.16);
    let feet, heading = ROT, mode, u = 0;
    if (t < P.out) { u = easeIO(lin(P.e, P.out, t)); feet = inside.clone().lerp(outside, u); mode = 'door'; }
    else if (t < P.go) { feet = outside.clone(); mode = 'open'; u = lin(P.out, P.go, t); }
    else if (t < P.down) {
      u = lin(P.go, P.down, t);
      const Lh = L.clone().add(V3(0, flit ? 0.22 : 0.3, 0));
      const mid = outside.clone().lerp(Lh, 0.5).add(V3(0, flit ? 0.45 : 0.3, 0));
      const k = flit ? easeIO(u) : u * u * (3 - 2 * u);
      feet = bez(outside, mid, Lh, k);
      if (!flit) {   // a lazy leaf-like drift
        const side = V3(fwd.z, 0, -fwd.x);
        feet.addScaledVector(side, Math.sin(Math.PI * k) * 0.32 * Math.sin(c.i * 1.7 + 1));
      }
      const tan = bez(outside, mid, Lh, Math.min(1, k + 0.02)).sub(bez(outside, mid, Lh, Math.max(0, k - 0.02)));
      heading = Math.hypot(tan.x, tan.z) > 1e-5 ? Math.atan2(tan.x, tan.z) : ROT;
      mode = 'air';
    } else if (t < P.ground) {
      u = lin(P.down, P.ground, t);
      const Lh = L.clone().add(V3(0, flit ? 0.22 : 0.3, 0));
      feet = Lh.clone().lerp(L, easeO(u));
      const tan = L.clone().sub(bez(outside, outside.clone().lerp(Lh, 0.5).add(V3(0, flit ? 0.45 : 0.3, 0)), Lh, 0.97));
      heading = lerpAng(Math.atan2(tan.x, tan.z), faceOf(c, L), easeIO(u));
      mode = 'land';
    } else { feet = L.clone(); heading = faceOf(c, L); mode = 'ground'; u = t - P.ground; }
    // a floatie, its helmet off and its parasol open, lifts off the grass and drifts under it (as in the Red arch)
    if (!flit && t > c.off + 0.85) {
      const k = easeIO(lin(c.off + 0.85, c.off + 2.6, t)), hh = 0.3 + 0.22 * hash(c.i + 11), ph = c.i * 1.9;
      feet = L.clone().add(V3(0.1 * Math.sin(t * 0.45 + ph) * k, hh * k + 0.035 * Math.sin(t * 0.9 + ph) * k, 0.08 * Math.sin(t * 0.37 + ph * 1.3) * k));
      heading = faceOf(c, L) + 0.35 * Math.sin(t * 0.3 + ph) * k;
      mode = 'float'; u = k;
    }
    // the lead flit's offering
    if (c.lead && t >= TL.lift) {
      const O = offering(t);
      if (O) { feet = O.feet; heading = O.heading; mode = O.mode; u = O.u; }
    }
    return { x: feet.x, y: feet.y, z: feet.z, feet, heading, mode, u, P };
  }
  function faceOf(c, L) {   // where a folk looks once it stands on the grass: the shadelings, then the seed
    const toward = V2(SEED.x - L.x, SEED.y - L.z);
    return Math.atan2(toward.x, toward.y) + (c.lead ? 0 : (hash(c.i + 7) - 0.5) * 0.5);
  }
  // the offering: rise, glide to the seed spot holding it out, lay it on the rug, back off, land
  const L0 = V3(lead.land[0], 0, lead.land[1]);
  function offering(t) {
    const tLift = TL.lift, tGlide = TL.lift + 0.55, tLay = TL.lay[0], tRel = TL.release, tBack = TL.release + 0.25, tLand = TL.release + 1.0;
    L0.y = LO.floorY(L0.x, L0.z);
    const toSeed = V2(SEED.x - L0.x, SEED.y - L0.z).normalize(), hd = Math.atan2(toSeed.x, toSeed.y);
    const reach = 0.3 * lead.a.sc;   // the seed sits this far in front of the body
    const hov = V3(L0.x, L0.y + 0.36, L0.z);
    const over = V3(SEED.x - toSeed.x * reach, 0, SEED.y - toSeed.y * reach); over.y = LO.floorY(over.x, over.z) + 0.3;
    const low = over.clone(); low.y = LO.floorY(over.x, over.z) + 0.1;
    const back = V3(SEED.x - toSeed.x * 0.62, 0, SEED.y - toSeed.y * 0.62); back.y = LO.floorY(back.x, back.z);
    if (t < tGlide) { const u = easeIO(lin(tLift, tGlide, t)); return { feet: L0.clone().lerp(hov, u), heading: hd, mode: 'air', u }; }
    if (t < tLay) { const u = easeIO(lin(tGlide, tLay, t)); return { feet: hov.clone().lerp(over, u), heading: hd, mode: 'air', u }; }
    if (t < tRel) { const u = easeIO(lin(tLay, tRel, t)); return { feet: over.clone().lerp(low, u), heading: hd, mode: 'air', u }; }
    if (t < tBack) return { feet: low.clone(), heading: hd, mode: 'air', u: 0 };
    if (t < tLand) { const u = easeIO(lin(tBack, tLand, t)); const p = low.clone().lerp(back, u); p.y += Math.sin(Math.PI * u) * 0.08; return { feet: p, heading: hd, mode: u > 0.75 ? 'land' : 'air', u }; }
    return { feet: back.clone(), heading: hd, mode: 'ground', u: t - tLand };
  }
  function propRate(c, t) {
    const p = folkPlace(c, t);
    if (!p) return 0;
    if (c.kind !== 'flit') return 0;
    if (p.mode === 'door') return 10 + 28 * p.u;
    const pop = t > c.off + 0.5 ? 34 * Math.exp(-(t - c.off - 0.5) / 0.45) : 0;   // a happy spin-up as the helmet comes off
    if (p.mode === 'ground') return 38 * Math.exp(-p.u / 0.5) + pop;
    return 38;
  }

  // the helmets: worn (they follow the body), lifted clear of the head, then set down on the grass beside it (the tuck
  // flit hugs its own under its arm). Where each one rests is fixed by where its owner stood when it took it off.
  const restOf = new Map();
  function helmetRest(c) {
    if (restOf.has(c)) return restOf.get(c);
    const p = folkPlace(c, c.off), H = c.gear.H, s = c.a.sc, h = p.heading, sd = c.i % 2 ? 1 : -1;
    const pos = V3(c.land[0] + c.rest[0], 0, c.land[1] + c.rest[1]);
    pos.y = LO.floorY(pos.x, pos.z) + (H.cy - H.collarY + 0.024) * s;
    const quat = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.06 * sd, h + sd * 0.7, 0.05));
    const r = { pos, quat, sd }; restOf.set(c, r); return r;
  }
  const _hq = new THREE.Quaternion(), _he = new THREE.Euler();
  function poseHelmet(c, t, p) {
    const G = c.gear, hm = G.helm;
    hm.visible = !!p; if (!p) return;
    const q = t - c.off;
    if (q < 0.18) { suits.wear(c); return; }
    const F = suits.headFrame(c), s = F.scale;
    // up, clear of the head (and the propeller); a floatie's parasol handle runs through its bubble, so its helmet
    // comes off up and out to the side, quickly
    const lk = easeIO(lin(0.18, 0.55, q));
    const S = F.pos.clone().add(V3(0, (c.kind === 'flit' ? 0.55 : 0.32) * s * lk, 0));
    if (c.kind !== 'flit') { const sd = c.tuck ? -1 : 1; S.add(c.a.body.localToWorld(V3(sd, 0, 0.35)).sub(c.a.body.localToWorld(V3(0, 0, 0))).normalize().multiplyScalar(0.5 * s * lk)); }
    let pos, quat;
    if (q < 0.55) {
      pos = S; pos.x += Math.sin(q * 30) * 0.006 * s * (1 - lin(0.18, 0.55, q));
      quat = F.quat.clone().multiply(_hq.setFromEuler(_he.set(0, 0, 0.12 * Math.sin(Math.PI * lin(0.18, 0.55, q)))));
    } else {
      let E, EQ;
      if (c.tuck) {   // flits under the right arm, floaties under the free (left) one
        const sd = c.kind === 'flit' ? 1 : -1;   // held upright at the side like a fishbowl
        E = c.a.body.localToWorld(V3(sd * (c.kind === 'flit' ? 0.45 : 0.42), -0.02, 0.1));
        EQ = F.quat.clone().multiply(_hq.setFromEuler(_he.set(0.08, 0, -0.12 * sd)));
      } else { const R = helmetRest(c); E = R.pos.clone(); EQ = R.quat.clone(); }
      const u = easeIO(lin(0.55, 1.15, q));
      const mid = S.clone().lerp(E, 0.5).add(V3(0, 0.12 * s, 0));
      pos = bez(S, mid, E, u);
      quat = F.quat.clone().slerp(EQ, u);
      if (!c.tuck && q > 1.15) {   // set down: it rocks on its collar and settles
        const r = q - 1.15, rock = 0.13 * Math.sin(r * 13) * Math.exp(-r * 4.5);
        pos.y += Math.max(0, Math.sin(Math.PI * Math.min(1, r / 0.16))) * 0.012 * Math.exp(-r * 6);
        quat.multiply(_hq.setFromEuler(_he.set(rock, 0, rock * 0.5)));
      }
    }
    hm.position.copy(pos); hm.quaternion.copy(quat); hm.scale.setScalar(s);
  }

  // write the folk's meshes for time t
  const _side = V3(), _fw = V3();
  function poseFolk(t) {
    const mixG = smooth(TL.golden[0], TL.golden[1], t);
    crew.forEach((c, k) => {
      const a = c.a, p = folkPlace(c, t), vis = !!p;
      a.root.visible = vis; a.legs.forEach(l => { l.leg.visible = l.foot.visible = vis; });
      if (!vis) { c.gear.helm.visible = false; return; }
      const sc = a.sc, flit = c.kind === 'flit';
      const blinkOn = ((t * 0.37 + hash(c.i + 3) * 7) % 3.1) < 0.12;
      // the helmet coming off (q = time since it began): reach up, it lifts, eyes squeeze shut, then a fresh wide look
      // and a little shake of the head in the open air
      const q = t - c.off;
      const reach = smooth(0, 0.22, q) * (1 - smooth(0.55, 0.8, q));
      const squeeze = q > 0.3 && q < 0.52;
      const wide = q > 0.52 ? Math.exp(-(q - 0.52) * 1.6) : 0;
      const shake = q > 0.5 ? 0.15 * Math.sin((q - 0.5) * 24) * Math.exp(-(q - 0.5) * 4.2) : 0;
      const stretch = 1 + 0.07 * Math.sin(Math.PI * lin(0.18, 0.62, q));
      const e0 = flit ? 1 : 0.9;
      a.eyes.forEach(e => { e.scale.y = (blinkOn || squeeze) ? 0.12 : e0 * (1 + 0.35 * wide); e.scale.x = e0 * (1 + 0.15 * wide); });
      const h = p.heading;
      _fw.set(Math.sin(h), 0, Math.cos(h)); _side.set(Math.cos(h), 0, -Math.sin(h));
      if (flit) {
        // body height over the feet: standing 0.30 sc; in the air it bobs and the legs dangle
        const air = p.mode === 'air' || p.mode === 'door';
        const bob = air ? Math.sin(t * 2.4 + c.i) * 0.08 * sc * 0.6 : 0;
        const pos = V3(p.x, p.y + restH(c) + bob, p.z);
        // landing: the squash that springs back
        let sq = 1;
        if (p.mode === 'ground' && p.u < 0.5) sq = 1 - 0.2 * Math.sin(Math.PI * Math.min(1, p.u / 0.12) * 0.5) * Math.exp(-p.u * 7) * Math.cos(p.u * 18);
        // a little hello-hop for the others when the shadelings crowd the seed; the lead one when it lays it
        let hop = 0;
        const hops = c.lead ? [TL.release + 1.35] : [TL.gather + 0.55 + c.i * 0.17, TL.gather + 1.6 + c.i * 0.23];
        if (p.mode === 'ground') hops.forEach(th => { const q = (t - th) / 0.42; if (q > 0 && q < 1) hop = Math.max(hop, Math.sin(Math.PI * q) * 0.09); });
        pos.y += hop;
        a.root.position.copy(pos);
        a.root.rotation.set(0, h, 0);
        const lean = p.mode === 'air' ? 0.22 : 0;
        a.body.rotation.set(lean, 0, (p.mode === 'air' ? Math.sin(t * 1.3 + c.i) * 0.08 : 0) + shake);
        sq *= stretch;
        a.body.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq));
        a.prop.rotation.y = sim.prop[k];
        // arms: at the sides; the lead one holds the seed out in front
        const holding = c.lead && t >= TL.seedShow[0] && t < TL.release + 0.15;
        a.arms.forEach((g, j) => {
          const sd = j === 0 ? -1 : 1;
          if (holding) { const u = smooth(TL.seedShow[0], TL.seedShow[0] + 0.4, t); g.rotation.set(-1.25 * u, 0, sd * (0.3 - 0.75 * u)); }
          else if (c.tuck && sd > 0 && q > 0.55) { const u = smooth(0.55, 0.85, q); g.rotation.set(-0.45 * u, 0, sd * lerp(0.3 + 2.3 * reach, 0.62, u)); }   // hugging the helmet
          else { g.rotation.set(-0.25 * reach, 0, sd * (0.3 + 2.3 * reach + (hop > 0 ? 1.6 : 0) + Math.sin(t * 1.4 + j + c.i) * 0.05)); }
        });
        // legs
        if (air) {
          a.legs.forEach(l => {
            const kick = Math.sin(t * 7 + c.i + l.sd * 1.6) * 0.035 * sc;
            l.pos.copy(pos).addScaledVector(_side, l.sd * 0.08 * sc).addScaledVector(_fw, kick - 0.03 * sc);
          });
          folk.poseLegs(a, a.legs, l => V3(l.sd * 0.08, -0.17, 0), () => pos.y - 0.33 * sc);
        } else {
          a.legs.forEach(l => { l.pos.set(p.x, 0, p.z).addScaledVector(_side, l.sd * 0.08 * sc); });
          const fy = p.y + (p.mode === 'land' ? (1 - p.u) * 0.0 : 0);
          folk.poseLegs(a, a.legs, l => V3(l.sd * 0.08, -0.17, 0), () => (hop > 0 ? fy + hop * 0.6 : fy));
        }
      } else {
        // floatie: root = the parasol's tip; the body hangs 0.82 below it, the feet 1.11 below
        const air = p.mode === 'air' || p.mode === 'land' || p.mode === 'float';
        const pos = V3(p.x, p.y + restH(c), p.z);
        if (p.mode === 'air') pos.y += Math.sin(t * 0.8 + c.i) * 0.05 * sc;
        a.root.position.copy(pos);
        a.root.rotation.set(0, h, 0);
        // the parasol: furled while the helmet is on (out of the hatch, down on the pack's thrusters); it blooms open
        // with a pop as the helmet comes off
        const tB = c.off + 0.62, bq = lin(tB, tB + 0.42, t);
        const openK = t < tB ? 0 : 1 + 2.70158 * Math.pow(bq - 1, 3) + 1.70158 * Math.pow(bq - 1, 2);   // ease-out-back
        const pop = Math.sin(Math.PI * bq) * 0.1;
        a.canopy.scale.set(lerp(0.22, 1, openK), lerp(1.9, 1, Math.min(1, openK)) + pop, lerp(0.22, 1, openK));
        a.canopy.position.y = 0;
        const swingT = p.mode === 'air' ? t - p.P.go : p.mode === 'float' ? t - c.off - 0.85 : 0;
        const pend = (p.mode === 'air' || p.mode === 'float') ? Math.exp(-swingT * 0.9) * Math.sin(swingT * 3.1) * 0.22 : 0;
        const drift = p.mode === 'float' ? p.u * (0.07 * Math.sin(t * 0.9 + c.i) ) : 0;
        a.swing.rotation.set(air ? pend + 0.06 + drift : 0, 0, air ? Math.sin(t * 0.7 + c.i * 2) * 0.06 : 0);
        a.canopy.rotation.set(-pend * 0.35 - drift * 0.4, t * 0.25 + c.i, 0);
        a.body.rotation.set(0, Math.sin(t * 0.6 + c.i) * 0.2, shake);
        a.body.scale.set(1 / Math.sqrt(stretch), stretch, 1 / Math.sqrt(stretch));
        // the free arm: up to lift the helmet off, then waves now and then
        const w = (t + c.i * 1.3) % 4.2, waving = (p.mode === 'ground' || p.mode === 'float') && q > 1.2 && w < 1.2;
        const hug = c.tuck ? smooth(0.55, 0.85, q) : 0;   // the free arm round the carried helmet
        a.wave.rotation.z = reach > 0.01 ? -(0.3 + 2.4 * reach) * (1 - hug) - 0.75 * hug : hug > 0 ? -0.75 : waving ? -(1.9 + Math.sin(t * 12) * 0.35) : -0.3;
        // the pack's thrusters: lit from the doorway to the grass
        const jet = c.gear.jets, burning = t < c.off && (p.mode === 'open' || p.mode === 'air' || (p.mode === 'land' && p.u < 0.7));
        jet.forEach((fl, j) => {
          fl.visible = burning;
          if (burning) { const ig = p.mode === 'open' ? easeO(p.u) : p.mode === 'land' ? 1 - p.u / 0.7 : 1; const fk = 1 + 0.18 * Math.sin(t * 47 + j * 2.1) + 0.1 * Math.sin(t * 71 + j); fl.scale.set(0.9 + 0.1 * fk, Math.max(0.05, ig * fk), 0.9 + 0.1 * fk); }
        });
        // legs: dangle in the air, stand on the grass
        a.root.updateMatrixWorld(true);
        a.legs.forEach(l => {
          const hip = a.body.localToWorld(V3(l.sd * 0.07, -0.16, 0));
          let ankle;
          if (p.mode === 'ground' || p.mode === 'door' || p.mode === 'open') ankle = V3(hip.x, p.y + 0.03 * sc, hip.z);
          else { const kick = Math.sin(t * 3 + c.i + l.sd * 1.6) * 0.03 * sc; ankle = hip.clone().add(V3(Math.sin(h) * kick, -0.13 * sc, Math.cos(h) * kick)); }
          const dir = hip.clone().sub(ankle), len = Math.max(0.005, dir.length());
          l.leg.position.copy(ankle); l.leg.quaternion.setFromUnitVectors(V3(0, 1, 0), dir.divideScalar(len)); l.leg.scale.set(sc * l.thick, len, sc * l.thick);
          l.foot.position.copy(ankle); l.foot.rotation.set(0, h, 0); l.foot.scale.setScalar(sc * l.footScale);
        });
      }
      poseHelmet(c, t, p);
    });
    // clay tones under the lounge's light: a touch of ACES-like restraint at midday, warm and lower at golden hour
    const day = 0.9, gold = [0.84, 0.64, 0.47];
    const tr = lerp(day, gold[0], mixG), tg = lerp(day, gold[1], mixG), tb = lerp(day, gold[2], mixG);
    clayMats.forEach((o, m) => {
      const u = m.uniforms;
      u.uBase.value.copy(o.b).multiply(_tint.setRGB(tr, tg, tb));
      u.uShade.value.copy(o.s).multiply(_tint.setRGB(tr * 0.95, tg * 0.92, tb * 0.95));
      u.uRim.value.copy(o.r).multiply(_tint.setRGB(tr * 0.9, tg * 0.88, tb * 0.95));
      u.uStripeCol.value.copy(o.st).multiply(_tint.setRGB(tr, tg, tb));
    });
  }
  const _tint = new THREE.Color();

  // ---------------------------------------------------------------- the rocket, the plume, the steam, the seed ----------------------------------------------------------------
  function rocketY(t) {
    if (t < TL.touch) { const s = t / TL.touch; return rocketGroundY + TL.rocketH0 * Math.pow(1 - s, 2.15); }
    const q = t - TL.touch;   // a soft settle on the fins
    return rocketGroundY + 0.035 * Math.max(0, Math.sin(Math.PI * q / 0.45)) * Math.exp(-q * 3);
  }
  function poseRocket(t) {
    const y = rocketY(t), w = 1 - smooth(0, TL.touch, t);
    rocket.wrap.position.set(RK.x, y, RK.y);
    rocket.wrap.rotation.set(Math.sin(t * 1.3 + 0.4) * 0.03 * w, ROT, Math.sin(t * 1.7) * 0.035 * w);
    rocket.hatch.rotation.y = -1.9 * easeO(lin(TL.hatch[0], TL.hatch[1], t)) - Math.sin(Math.PI * lin(TL.hatch[1], TL.hatch[1] + 0.35, t)) * 0.08;
    rocket.wrap.updateMatrixWorld(true);
    const noz = rocket.nozzleWorld();
    const thr = 1 - smooth(TL.burnOff[0], TL.burnOff[1], t);
    plume.set(t, noz, thr, LO.floorY(noz.x, noz.z));
    jets.forEach(j => { const n = rocket.engineWorld(j.e); j.p.set(t, n, thr, LO.floorY(n.x, n.z)); });
    steam.set(t, tt => rocket.nozzleLocal.clone().add(V3(RK.x, rocketY(tt), RK.y)), rocketGroundY);
  }
  function poseSeed(t) {
    const show = smooth(TL.seedShow[0], TL.seedShow[1], t);
    if (t < TL.seedShow[0]) { seed.hide(); return; }
    let pos;
    if (t < TL.release) {
      lead.a.root.updateMatrixWorld(true);
      pos = lead.a.root.localToWorld(V3(0, -0.07, 0.31));
    } else {
      const q = t - TL.release, fy = LO.floorY(SEED.x, SEED.y) + 0.03;
      lead.a.root.updateMatrixWorld(true);
      const p0 = folkPlace(lead, TL.release - 1e-3); // where it was let go
      const y0 = p0 ? p0.y + restH(lead) - 0.07 * lead.a.sc : fy + 0.05;
      const yy = Math.max(fy, y0 - 0.5 * 9.8 * q * q);
      const land = Math.sqrt(Math.max(0, 2 * (y0 - fy) / 9.8));
      const b = q > land ? Math.max(0, Math.sin(Math.PI * (q - land) / 0.16)) * 0.025 * Math.exp(-(q - land) * 4) : 0;
      pos = V3(SEED.x, yy + b, SEED.y);
    }
    const pulse = 1 + 0.12 * Math.sin(t * 3.1) + 0.05 * Math.sin(t * 7.3);
    const gath = smooth(TL.gather, TL.gather + 2.2, t);
    seed.show(pos, show, pulse, gath, camera.position, LO.floorY(pos.x, pos.z), smooth(TL.golden[0], TL.golden[1], t));
  }

  // ---------------------------------------------------------------- the camera ----------------------------------------------------------------
  function shotAt(t) { let s = SHOTS[0]; for (const x of SHOTS) if (t >= x.t0) s = x; return s; }
  function cameraAt(t) {
    const s = shotAt(t), u = lin(s.t0, s.t1, t);
    let pos, look, fov;
    if (s.name === 'descent') {
      const e = easeIO(u);
      pos = V3(lerp(-2.1, -1.6, e), lerp(1.75, 1.42, e), lerp(10.6, 9.4, e));
      // the eye follows the rocket down a little, then settles on the meadow
      const ry = rocketY(t) - rocketGroundY;
      look = V3(lerp(1.7, 1.25, e), 2.15 + Math.min(ry, 9) * 0.22 * (1 - smooth(2.6, 4.6, t)), lerp(-2.6, -2.2, e));
      fov = lerp(50, 47, e);
    } else if (s.name === 'hatch') {
      // a longer lens from the front-left: the door, and the folk flying out and down toward us
      const e = easeIO(u);
      pos = V3(lerp(-0.55, -0.3, e), lerp(1.02, 0.95, e), lerp(5.75, 5.4, e));
      look = V3(lerp(2.75, 2.6, e), lerp(1.12, 0.86, e), lerp(-0.15, 0.2, e));
      fov = lerp(33, 32, e);
    } else if (s.name === 'approach') {
      // the helmets come off: from the front-left, low, our folk three-quarter on (they face the rug), the rocket
      // behind them; the shadelings come back in from the left
      const e = easeIO(u);
      pos = V3(lerp(0.35, 0.6, e), lerp(0.92, 0.84, e), lerp(5.6, 5.25, e));
      look = V3(lerp(2.2, 2.1, e), lerp(0.55, 0.5, e), lerp(2.35, 2.4, e));
      fov = lerp(37, 35, e);
    } else if (s.name === 'offering') {
      // close and from above (her landing camera's angle): the ring of lanterns round the glowing seed on the red
      // rug, the flit three-quarter on at its right
      const e = easeIO(u);
      pos = V3(lerp(1.0, 0.92, e), lerp(1.5, 1.32, e), lerp(4.3, 4.0, e));
      look = V3(lerp(0.62, 0.58, e), lerp(0.14, 0.12, e), lerp(2.45, 2.42, e));
      fov = lerp(38, 35, e);
    } else {
      // the pull-back: from the seed, up and out to the whole meadow, the rocket and the peaks; then held
      const e = easeIO(lin(s.t0, TL.hold, t));
      const A = { pos: V3(0.92, 1.32, 4.0), look: V3(0.58, 0.12, 2.42), fov: 35 };   // where the offering shot rests
      const B = { pos: V3(-2.0, 1.9, 8.7), look: V3(1.05, 2.3, -2.2), fov: 47 };
      pos = A.pos.clone().lerp(B.pos, e); look = A.look.clone().lerp(B.look, easeIO(Math.min(1, e * 1.08)));
      fov = lerp(A.fov, B.fov, e);
      pos.y += Math.sin(Math.PI * e) * 0.35;   // a gentle crane arc
    }
    return { pos, look, fov, shot: s.name };
  }

  // ---------------------------------------------------------------- render ----------------------------------------------------------------
  let lastT = 0;
  function pose(t) {
    t = clamp(t, 0, TL.duration);
    seekSim(t);
    lastT = t;
    // light: midday, then her golden hour
    const mixG = smooth(TL.golden[0], TL.golden[1], t);
    LO.setMode(mixG);
    KEY_DIR.copy(LO.modes.day.dir).lerp(LO.modes.dusk.dir, mixG).normalize();
    LO.water.material.uniforms.time.value = 3 + t;
    suits.glassMat.uniforms.uGold.value = mixG;
    // beads: hers (0.25 + mix * 2.6), plus the seed's glow on the ones that reached it
    const sGlow = smooth(TL.release, TL.release + 0.6, t);
    LO.shadelings.forEach(s => {
      const g = (s.glow || 0) * sGlow;
      s.beadMat.emissiveIntensity = Math.min(3.6, 0.25 + mixG * 2.6 + 2.2 * g);
      const k = Math.max(g, mixG * 0.55) * (1 + 0.12 * Math.sin(t * 3.3 + s.phase));
      s.halo.scale.setScalar(Math.max(1e-4, 0.15 * k)); s.halo.material.opacity = Math.min(1, 0.9 * k);
    });
    const cam = cameraAt(t);
    camera.position.copy(cam.pos); camera.up.set(0, 1, 0); camera.lookAt(cam.look);
    camera.fov = cam.fov; camera.updateProjectionMatrix();
    poseRocket(t);
    poseFolk(t);
    poseSeed(t);
    return cam;
  }
  function render() { post.render(scene, camera, LO.exposure.value, null); }

  // warm-up: compile everything once with every effect alive
  pose(TL.touch - 0.3); renderer.compile(scene, camera); render();
  pose(TL.gather + 1); render();
  reset(); pose(0); render();

  // ---------------------------------------------------------------- the shot API ----------------------------------------------------------------
  let playing = false, playAt = 0, playFrom = 0;
  const shot = {
    duration: TL.duration, fps: FPS, ready: true, done: false, shots: SHOTS.map(s => ({ ...s })), timeline: { ...TL },
    seek(t) { playing = false; const c = pose(+t || 0); render(); return { t: lastT, shot: c.shot }; },
    frame(n) { return shot.seek(n / FPS); },
    play(from = 0) { shot.done = false; playing = true; playFrom = +from || 0; playAt = performance.now(); requestAnimationFrame(loop); return true; },
    pause() { playing = false; },
    get t() { return lastT; },
    state() {
      return { t: lastT, simT: sim.t, mix: LO.getMix(), rocket: rocket.wrap.position.toArray(), cam: camera.position.toArray(), draws: renderer.info.render.calls,
        folk: crew.map(c => { const p = folkPlace(c, lastT); return p ? { kind: c.kind, mode: p.mode, x: +p.x.toFixed(2), y: +p.y.toFixed(2), z: +p.z.toFixed(2) } : null; }),
        shadelings: LO.crowd.map(s => [+s.pos.x.toFixed(2), +s.pos.y.toFixed(2)]) };
    }
  };
  function loop() {
    if (!playing) return;
    const t = playFrom + (performance.now() - playAt) / 1000;
    pose(Math.min(t, TL.duration)); render();
    if (t >= TL.duration) { playing = false; shot.done = true; return; }
    requestAnimationFrame(loop);
  }
  window.__shot = shot;
  window.__t5 = { LO, crew, sim, folkPlace, TL };   // debugging hooks (tests only)
  return shot;
}

// ---------------------------------------------------------------- the rocket asset ----------------------------------------------------------------
// The stock plan through the real Build API (r147 here: the API only uses the global THREE), then re-materialled for the
// lounge: each painted part becomes a MeshStandardMaterial of its ramp's light-mid stop, lit by her sun and hemi light
// and casting her shadows, so the rocket is painted by her gouache exactly like her furniture.
async function buildRocket(renderer) {
  let code = null, placeholder = false;
  try {
    const src = await (await fetch(new URL('../buildings/examples/rocket.js', import.meta.url), { cache: 'no-store' })).text();
    if (/function\s+build\s*\(\s*api\s*\)/.test(src)) code = src.replace(/^(\s*\/\/[^\n]*\n)+/, '').trim();
  } catch (e) { /* fall through */ }
  if (!code) { placeholder = true; code = PLACEHOLDER_ROCKET; console.warn('[t5] examples/rocket.js not readable: using the placeholder rocket'); }
  const holder = new THREE.Group();
  const ctxR = createContext({ renderer, scene: holder, camera: new THREE.PerspectiveCamera(), seed: 5 });
  const kitR = createKit(ctxR);
  const api = createBuildApi(ctxR, kitR, { seed: 1 });
  const wrap = compileAsset(code, { name: 'rocket' })(api);
  const root = wrap.children[0];
  const BRASS0 = '#5a3a16';
  wrap.traverse(o => {
    if (!o.isMesh) return;
    const ud = o.userData || {};
    if (ud.agoraLine || ud.agoraSketch || o.visible === false) { o.visible = false; return; }
    const a = ud.agora || {};
    let hex = '#e3d9c7', rough = 0.7, metal = 0;
    if (a.ramp) { const r = a.ramp; hex = r[Math.min(r.length - 2, 3)]; if (r[0] === BRASS0) { hex = r[3]; rough = 0.42; metal = 0.35; } if (r[0] === '#21182a') { hex = r[1]; rough = 0.9; } if (r[0] === '#0e1124') { hex = r[2]; rough = 0.85; } if (r[0] === '#0f1a2c') { hex = r[2]; rough = 0.18; metal = 0.25; } }
    else if (o.material && o.material.uniforms && o.material.uniforms.uBase) hex = '#' + o.material.uniforms.uBase.value.getHexString();
    else if (o.material && o.material.color) hex = '#' + o.material.color.getHexString();
    o.material = new THREE.MeshStandardMaterial({ color: new THREE.Color(hex), roughness: rough, metalness: metal, side: a.part === 'flag' || /flag/.test(a.part || '') ? THREE.DoubleSide : THREE.FrontSide });
    if (a.ramp && a.ramp[0] === '#2fb3cf') { o.material.emissive = new THREE.Color(a.ramp[2]); o.material.emissiveIntensity = 0.9; }   // the craft's cyan light strips glow
    o.castShadow = true; o.receiveShadow = true;
    if (a.part === 'door.ink') o.position.z += 0.035;   // proud of the curving hull (a flat slab on an ogive pokes through at the arch top)
  });
  wrap.scale.setScalar(K);
  let hatch = null; wrap.traverse(o => { if (o.userData && o.userData.role === 'hatch') hatch = o; });
  if (!hatch) hatch = new THREE.Group();
  hatch.position.z += 0.05;   // and the door a little further out, so it never touches the ink behind it
  const info = root.userData.rocket || { nozzleY: 0.48, hatchY: 3.55, hatchZ: 1.6 };
  // the nozzle mouth and the door sill, in the wrapper's frame (the plan's units)
  const nozzleLocal = root.position.clone().add(V3(0, info.nozzleY, 0)).multiplyScalar(K);
  const sillLocal = root.position.clone().add(V3(0, info.hatchY, info.hatchZ + 0.05));
  // the sill in world space with the rocket on the ground (its y is moved with the rocket by the caller)
  const tmp = new THREE.Group(); tmp.position.set(RK.x, 0, RK.y); tmp.rotation.y = ROT; tmp.scale.setScalar(K); tmp.updateMatrixWorld(true);
  const sill = sillLocal.clone().applyMatrix4(tmp.matrixWorld);
  sill.y += 0; // ground y is added by the caller (rocketGroundY baseline)
  const nzRot = nozzleLocal.clone().applyAxisAngle(V3(0, 1, 0), ROT);
  return {
    wrap, hatch, placeholder, sill: sill.add(V3(0, 0, 0)),
    nozzleLocal: nzRot,
    nozzleWorld() { return root.localToWorld(V3(0, info.nozzleY, 0)); },
    // the craft's engine cluster (examples/rocket.js userData.craft.engines): each mouth in the world, with its size
    engines: ((root.userData.craft && root.userData.craft.engines) || []).filter(e => e.x || e.z),
    engineWorld(e) { return root.localToWorld(V3(e.x, e.y, e.z)); }
  };
}
const PLACEHOLDER_ROCKET = `function build(api) {
  var R = api.ramps, g = api.group();
  g.add(api.lathe({ points: [[1.2, 1.3], [1.7, 4], [1.6, 9], [1.0, 12.5], [0.2, 15.2], [0, 15.6]], seg: 32, ramp: R.WHITEWASH }));
  g.add(api.lathe({ points: [[0.5, 1.3], [0.95, 0.48]], seg: 24, ramp: R.IRON }));
  var hatch = api.group({ x: -0.5, y: 3.55, z: 1.72 }); hatch.userData.role = 'hatch';
  hatch.add(api.box({ w: 1, h: 2, d: 0.07, x: 0.5, y: 1, ramp: R.LIMESTONE })); g.add(hatch);
  for (var i = 0; i < 3; i++) g.add(api.box({ w: 0.2, h: 4.5, d: 2.2, x: 2.2 * Math.sin(i * 2.094), z: 2.2 * Math.cos(i * 2.094 + 3.14), y: 2.4, rot: i * 2.094, ramp: R.TERRACOTTA }));
  g.userData.rocket = { height: 16.8, nozzleY: 0.48, hatchY: 3.55, hatchZ: 1.67 };
  return g;
}`;

// ---------------------------------------------------------------- the plume ----------------------------------------------------------------
// A gouache flame: a cream core inside an orange teardrop (HDR-bright, so her ACES and her paint turn it into two flat
// warm shapes), a flicker, and a warm light that lights the steam from inside.
function makePlume(scene, { size = 1, glow = true } = {}) {
  const prof = [[0, 0.03], [0.62, 0.0], [0.9, -0.08], [1.0, -0.2], [0.86, -0.42], [0.58, -0.66], [0.28, -0.86], [0, -1]].map(([x, y]) => new THREE.Vector2(x, y));
  const geo = new THREE.LatheGeometry(prof, 28);
  const outer = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff5a1e').multiplyScalar(1.5) }));
  const mid = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffa035').multiplyScalar(2.2) }));
  const inner = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: new THREE.Color('#fff0c4').multiplyScalar(3.6) }));
  const g = new THREE.Group(); g.add(outer, mid, inner); scene.add(g);
  const light = new THREE.PointLight(new THREE.Color('#ffa24a'), 0, 9, 2); if (glow) scene.add(light);
  return {
    set(t, noz, thr, groundY) {
      g.visible = thr > 0.01;
      const h = noz.y - groundY;
      const fl = 1 + 0.09 * Math.sin(t * 41) + 0.06 * Math.sin(t * 67 + 1.3) + 0.04 * Math.sin(t * 23);
      const L = Math.max(0.12, Math.min(2.0, h + 0.05)) * fl * (0.25 + 0.75 * thr);
      const splash = 1 + 0.6 * smooth(1.5, 0.2, h);   // squashed on the ground, it spreads
      const R = 0.5 * size * thr * splash * (0.95 + 0.05 * Math.sin(t * 53 + size * 7));
      g.position.copy(noz);
      outer.scale.set(R, L, R);
      mid.scale.set(R * 0.78, L * 0.8, R * 0.78);
      inner.scale.set(R * 0.48, L * 0.55, R * 0.48);
      light.position.copy(noz).add(V3(0, -Math.min(1.2, L * 0.5), 0));
      light.intensity = 7 * thr * (0.85 + 0.15 * fl);
    }
  };
}

// ---------------------------------------------------------------- the steam ----------------------------------------------------------------
// Lumpy cream puffs, lit by her sun (so they paint as flat lit / shaded cloud shapes) and from inside by the flame.
// Trail puffs leave the nozzle on the way down; ground billows roll out across the meadow from under it, grow, slow,
// rise a little and melt away. All closed-form in t.
function makeSteam(scene, LO) {
  let s = 99173; const rnd = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  const P = [];
  const LOBES = 15, lobeTh = Array.from({ length: LOBES }, (_, j) => (j + rnd() * 0.6) / LOBES * Math.PI * 2), lobeV = lobeTh.map(() => 0.8 + rnd() * 1.0);
  for (let k = 0; k < 180; k++) {  // ground billows, in lobes: each lobe a rolling heap of overlapping puffs
    const j = k % LOBES, b = 2.2 + Math.pow(rnd(), 0.9) * 1.75;
    const heap = Math.pow(rnd(), 1.5) * 1.1, tau = 0.7 + rnd() * 0.5;
    const v0 = (lobeV[j] + rnd() * 0.9) * (1 - 0.3 * heap);
    P.push({ kind: 'roll', b, th: lobeTh[j] + (rnd() - 0.5) * 0.32, v0, tau, s0: 0.14 + rnd() * 0.26, life: Math.min(2.4 + rnd() * 2.0, 5.9 - b), rise: 0.03 + rnd() * 0.08, rot: rnd() * 6, heap });
  }
  for (let k = 0; k < 30; k++) {   // the low haze round the fins as the engine stops
    const b = 3.6 + rnd() * 0.9;
    P.push({ kind: 'linger', b, th: rnd() * Math.PI * 2, v0: 0.3 + rnd() * 0.5, tau: 1.2, s0: 0.16 + rnd() * 0.2, life: Math.min(2.6 + rnd() * 1.6, 5.9 - b), rise: 0.06 + rnd() * 0.06, rot: rnd() * 6, heap: rnd() * 0.6 });
  }
  const geo = new THREE.SphereGeometry(1, 22, 14);
  { const p = geo.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const k = 1 + 0.07 * Math.sin(x * 2.3 + y * 1.7 + 0.4) * Math.sin(z * 2.1 + 1.1); p.setXYZ(i, x * k, y * k * 0.82, z * k); } geo.computeVertexNormals(); }
  const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#f2ede3'), roughness: 1, emissive: new THREE.Color('#2c2a30') });
  const im = new THREE.InstancedMesh(geo, mat, P.length);
  im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const col = new THREE.Color();
  P.forEach((p, i) => { col.set('#f6f1e8').multiplyScalar(0.93 + rnd() * 0.08); im.setColorAt(i, col); });
  im.frustumCulled = false; im.castShadow = false; im.receiveShadow = false;
  scene.add(im);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), pos = new THREE.Vector3();
  return {
    set(t, nozzleAt, groundY) {
      P.forEach((p, i) => {
        const a = t - p.b;
        let size = 0;
        if (a > 0 && a < p.life) {
          const n = nozzleAt(p.b);
          // the nearer the nozzle was to the grass at birth, the fuller the billow
          const nearK = 0.55 + 0.45 * smooth(4.5, 0.4, n.y - groundY);
          // melting away: it shrinks and sinks into the grass
          const fade = 1 - smooth(p.life * 0.35, p.life, a), flat = 1;
          const r = (p.kind === 'roll' ? 0.45 : 1.0) + p.v0 * p.tau * (1 - Math.exp(-a / p.tau));
          const grow = 0.35 + 0.65 * (1 - Math.exp(-a / 0.35));
          const full = p.s0 * grow * nearK * (p.kind === 'roll' ? 1.0 + 0.45 * smooth(0.5, 2.6, r) : 1.0);
          size = full * (0.45 + 0.55 * fade);
          const x = n.x + Math.cos(p.th) * r, z = n.z + Math.sin(p.th) * r;
          pos.set(x, Math.max(groundY, LO.floorY(x, z)) + full * (0.42 + p.heap) * (0.35 + 0.65 * fade) + p.rise * a * fade - (1 - fade) * full * 1.1, z);
          p.flat = flat;
        }
        e.set(p.rot, p.rot * 1.7 + a * 0.15, p.rot * 0.6); q.setFromEuler(e);
        sc.set(1, size > 0 ? p.flat : 1, 1).multiplyScalar(Math.max(1e-4, size));
        m.compose(pos, q, sc); im.setMatrixAt(i, m);
      });
      im.instanceMatrix.needsUpdate = true;
    }
  };
}

// ---------------------------------------------------------------- the seed ----------------------------------------------------------------
// Her seed (lounge.html: a cream bead glowing honey-gold), plus a soft painted halo and a little warm light.
function haloTexture() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 128;
  const g = cv.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,236,190,1)'); gr.addColorStop(0.25, 'rgba(255,206,120,0.55)'); gr.addColorStop(1, 'rgba(255,180,90,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(cv); tex.encoding = THREE.sRGBEncoding;
  return tex;
}
function makeSeed(scene) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.03, 14, 10), new THREE.MeshStandardMaterial({ color: new THREE.Color('#fff1c2'), emissive: new THREE.Color('#ffcc66'), emissiveIntensity: 1.6 }));
  scene.add(mesh);
  const tex = haloTexture();
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: new THREE.Color('#ffd28a'), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  scene.add(halo);
  const light = new THREE.PointLight(new THREE.Color('#ffc46a'), 0, 2.0, 2); scene.add(light);
  // the warm pool it throws on the rug
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color('#ffb257'), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -8 }));
  pool.rotation.x = -Math.PI / 2; scene.add(pool);
  const toCam = V3();
  return {
    hide() { mesh.visible = halo.visible = pool.visible = false; light.intensity = 0; },
    show(pos, k, pulse, gath, camPos, floorY, gold) {
      mesh.visible = halo.visible = pool.visible = k > 0.001;
      mesh.position.copy(pos); mesh.scale.setScalar(Math.max(1e-3, k) * (0.9 + 0.1 * pulse));
      mesh.material.emissiveIntensity = 1.6 + 1.6 * k + 0.6 * gath;
      // the halo sits a little toward the camera, so the rug never cuts it in half
      toCam.copy(camPos).sub(pos).normalize();
      halo.position.copy(pos).addScaledVector(toCam, 0.16);
      halo.scale.setScalar(0.3 * k * pulse * (1 + 0.35 * gath) * (1 + 0.6 * gold));
      halo.material.opacity = 0.8 * k;
      const hgt = Math.max(0, pos.y - floorY);
      pool.position.set(pos.x, floorY + 0.012, pos.z);
      pool.scale.setScalar((0.55 + 0.4 * gath + 0.5 * gold) * (1 + hgt * 0.8));
      pool.material.opacity = k * 0.55 * Math.exp(-hgt * 3) * (0.9 + 0.1 * pulse);
      light.position.copy(pos).add(V3(0, 0.1, 0)); light.intensity = 1.3 * k * pulse * (1 + 0.6 * gath) * (1 + 1.2 * gold);
    }
  };
}
