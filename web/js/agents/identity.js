// Who is who: per-folk accessories on our two fliers (ART_DIRECTION §11 "Individuality").
// ADDITIVE ONLY: the Red arch creatures stay verbatim (folk.make.* builds them, nothing of theirs is moved, hidden or
// recoloured); this module only hangs extra clay-cel pieces on them, on FACE_LAYER 5 + MASK_LAYER 6 (props.layer), so
// they paint in the Gouache folk pass like the bodies do.
//   - flying gear, per folk: flit rotors (the reference's own 2 blades, + a cross bar = 4 blades, + a stacked 3-blade
//     top rotor, + a counter-spinning double rotor, + coloured tip paddles), hub finials, goggles, a tail-fin, a knit
//     beanie under the propeller; floatie parasol patterns laid over the canopy (wide stripes, polka dots, a scalloped
//     fringe, two-tone halves, a painted ring), tassels, handle colours, a sun-visor;
//   - clothes by trade: builders a hard-hat band + tool belt, crafters a leather apron + belt, bakers a toque + apron,
//     farmers a straw hat + a satchel of seeds, couriers a messenger satchel + a fluttering scarf, traders a coin purse +
//     neckerchief, diplomats a sash with a rosette, scholars round glasses + a quill; floaties also fly a trade pennant
//     on the parasol tip (it is what reads from straight above);
//   - the minister wears the red wax seal on a ribbon (setMinister).
// Deterministic: the look comes from a hash of the sim agent (id + name) and the order folk of a species were dressed,
// so a seed replays the same crowd. Never touches ctx.rnd (the paint stream).
//
//   const idn = createIdentity(ctx, folk, props)
//   idn.dress(rec)        // after folk.make.*: rec.a, rec.species, rec.sim ({ id, name, trade })
//   idn.restyle(rec)      // the trade changed (a new job, an entrepreneur): swaps the trade layer only
//   idn.setMinister(rec, on)
//   idn.step(rec, dt, t)  // double rotor counter-spin, tassels, scarf tail
//   idn.describe(rec) -> { species, kit, trade, gear, outfit, colours, words }
// ART_DIRECTION §13 (no green and yellow together on a creature): flits never get yellow / gold / straw pieces, and a
// floatie wearing anything green (a green canopy, the farmer's pennant, a teal suit) gets none either; builders wear
// coral now. colour-rule.js then re-dyes the reference's own yellow caps / brims / blades (applyColourRule, run by
// dress / restyle / setMinister).
import { applyColourRule, isYellow, isGreen } from './colour-rule.js';
import { TOWNSFOLK, dressTownsfolk, UNIFORM_WORDS } from './species-extra.js';   // the townsfolk's uniforms (loaves, twinkles, glims, moths)

export const PAL = {
  red: '#e2483a', cobalt: '#2f62d8', yellow: '#f2c14e', plum: '#7a3d8c', cream: '#f4ead6', teal: '#2b8a7a', pink: '#e85a71',
  green: '#3f7a58', ochre: '#d99a2b', terra: '#c8543a', navy: '#1f3f78', aqua: '#3fb6a8', brown: '#8a5a3a', straw: '#e9c77a',
  leather: '#9a6236', ink: '#2e2b3f', crust: '#e3a65c', white: '#f6efe2', sage: '#9cbf8a', lilac: '#b49ad6', tan: '#b5794a'
};
// §13: what a yellow / gold / straw piece becomes on a folk that may not wear yellow
const NO_YELLOW = { [PAL.yellow]: PAL.cream, '#e2b23a': PAL.cream, [PAL.ochre]: PAL.tan, [PAL.straw]: PAL.cream };
const NAME = {};
Object.entries({ red: 'red', cobalt: 'cobalt blue', yellow: 'yellow', plum: 'plum', cream: 'cream', teal: 'teal', pink: 'coral', green: 'green', tan: 'tan',
  ochre: 'ochre', terra: 'terracotta', navy: 'navy', aqua: 'aqua', brown: 'brown', straw: 'straw', leather: 'leather', crust: 'crust', white: 'white',
  sage: 'sage', lilac: 'lilac', ink: 'ink' }).forEach(([k, v]) => NAME[PAL[k]] = v);
const cname = hex => NAME[hex] || hex;

// which outfit a sim trade wears (sim trades: builder baker farmer crafter trader diplomat artist scout dreamer courier)
export const KIT_OF_TRADE = { builder: 'builder', crafter: 'crafter', baker: 'baker', farmer: 'farmer', scout: 'courier', courier: 'courier',
  trader: 'trader', merchant: 'trader', diplomat: 'diplomat', artist: 'scholar', dreamer: 'scholar', scholar: 'scholar', teacher: 'scholar' };
export const KIT_COLOUR = { builder: PAL.pink, crafter: PAL.leather, baker: PAL.crust, farmer: PAL.green, courier: PAL.red, trader: PAL.teal,
  diplomat: PAL.plum, scholar: PAL.cobalt, none: PAL.cream };
const KIT_WORDS = {
  builder: 'a coral hard-hat band and a tool belt', crafter: 'a leather apron and a tool belt', baker: "a baker's toque and a white apron",
  farmer: 'a straw hat and a satchel of seeds', courier: 'a messenger satchel and a scarf', trader: 'a coin purse and a neckerchief',
  diplomat: 'a sash with a rosette', scholar: 'round glasses and a quill', none: 'nothing special'
};
const kitOf = trade => KIT_OF_TRADE[String(trade || '').toLowerCase()] || 'none';
const HEADWEAR = new Set(['builder', 'baker', 'farmer']);   // these trades wear the head: no beanie / visor on top

export const ROTORS = ['classic', 'tri', 'double', 'cross', 'tips'];
export const CANOPIES = ['gores', 'wide', 'polka', 'scallop', 'two-tone', 'ring'];
const ROTOR_WORDS = { classic: 'the classic two-blade propeller', tri: 'a three-blade top rotor', double: 'a double rotor', cross: 'a four-blade propeller', tips: 'a propeller with painted tip paddles' };
const CANOPY_WORDS = { gores: 'the plain striped parasol', wide: 'a broad-striped parasol', polka: 'a polka-dot parasol', scallop: 'a parasol with a scalloped fringe', 'two-tone': 'a two-tone parasol', ring: 'a parasol with a painted ring' };

function hashStr(s) { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

export function createIdentity(ctx, folk, props) {
  const FACE = folk.FACE_LAYER, MASK = folk.MASK_LAYER;
  const cloth = folk.cloth;
  const counts = { flit: 0, floatie: 0 };
  const keepG = new Set(), keepM = new Set();
  const geo = (g) => (keepG.add(g), g);
  let noYellow = false;   // set per folk while it is dressed (§13)
  const fix = hex => (noYellow && hex && isYellow(hex)) ? (NO_YELLOW[hex] || PAL.cream) : hex;
  const mat = (hex, stripe = null, n = 0) => { const m = cloth(fix(hex), stripe && fix(stripe), n); keepM.add(m); return m; };
  // horizontal knit bands (the garment shader's y-stripes)
  const knitCache = {};
  function knit(a, b) {
    a = fix(a); b = fix(b);
    const k = a + b; if (knitCache[k]) return knitCache[k];
    const m = folk.clayMat(...folk.tones(a)); m.uniforms.uStripeCol.value = new THREE.Color(b); m.uniforms.uStripeF.value = 22; m.uniforms.uStripeMode.value = 1;
    keepM.add(m); return (knitCache[k] = m);
  }
  const ringCache = {};
  const ring = (r, t) => { const k = r + ':' + t; return ringCache[k] || (ringCache[k] = geo(new THREE.TorusGeometry(r, r * t, 8, 36))); };
  // ---- shared shapes ----
  const G = {
    bar: geo(new THREE.BoxGeometry(0.34, 0.012, 0.055)),
    blade3: geo((() => { const g = new THREE.BoxGeometry(0.2, 0.012, 0.07); g.translate(0.1, 0, 0); return g; })()),
    blade2: geo(new THREE.BoxGeometry(0.27, 0.01, 0.045)),
    hub: geo(new THREE.SphereGeometry(0.03, 10, 8)),
    paddle: geo((() => { const g = new THREE.SphereGeometry(0.042, 12, 8); g.scale(1.1, 0.3, 1); return g; })()),
    stem: geo(new THREE.CylinderGeometry(0.009, 0.009, 0.1, 6)),
    dome: geo(new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2)),
    disc: geo(new THREE.CylinderGeometry(1, 1, 1, 28)),
    halfDisc: geo((() => { const g = new THREE.CylinderGeometry(1, 1, 1, 20, 1, false, -Math.PI / 2, Math.PI); return g; })()),
    ball: geo(new THREE.SphereGeometry(1, 12, 9)),
    box: geo(new THREE.BoxGeometry(1, 1, 1)),
    cyl: geo(new THREE.CylinderGeometry(1, 1, 1, 10)),
    lens: geo(new THREE.TorusGeometry(0.032, 0.008, 6, 20)),
    glass: geo((() => { const g = new THREE.SphereGeometry(0.03, 12, 8); g.scale(1, 1, 0.25); return g; })()),
    fin: geo((() => { const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(-0.15, -0.02); s.lineTo(-0.03, 0.13); s.lineTo(0, 0); const g = new THREE.ExtrudeGeometry(s, { depth: 0.014, bevelEnabled: false }); g.translate(0, 0, -0.007); return g; })()),
    flag: geo((() => { const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(0.15, -0.045); s.lineTo(0, -0.09); s.lineTo(0, 0); const g = new THREE.ExtrudeGeometry(s, { depth: 0.008, bevelEnabled: false }); g.translate(0, 0, -0.004); return g; })()),
    quill: geo((() => { const g = new THREE.SphereGeometry(0.03, 10, 8); g.scale(0.55, 3.4, 0.22); return g; })()),
    // canopy shells (open cones on the reference's axis trick: the stripe shader bands go round the axis)
    shell: geo((() => { const g = new THREE.ConeGeometry(0.51, 0.163, 32, 1, true); g.rotateX(Math.PI / 2); return g; })()),
    half: geo((() => { const g = new THREE.ConeGeometry(0.512, 0.164, 32, 1, true, 0, Math.PI); g.rotateX(Math.PI / 2); return g; })()),
    dot: geo((() => { const g = new THREE.SphereGeometry(0.05, 12, 6); g.scale(1, 0.22, 1); return g; })()),
    scallop: geo((() => { const g = new THREE.SphereGeometry(0.062, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2); g.rotateX(Math.PI); g.scale(1, 0.85, 0.3); return g; })()),
    // body wear
    apronFlit: geo(new THREE.SphereGeometry(0.252, 20, 12, Math.PI / 2 - 0.95, 1.9, Math.PI / 2 - 0.1, 0.95)),
    apronFloat: geo(new THREE.SphereGeometry(0.236, 20, 12, Math.PI / 2 - 0.9, 1.8, Math.PI / 2 - 0.05, 0.95)),
    toqueSide: geo(new THREE.CylinderGeometry(0.175, 0.165, 0.085, 22, 1, true))
  };
  const layer = o => { o.traverse(m => { if (!m.isMesh) return; m.castShadow = true; m.layers.enable(FACE); m.layers.enable(MASK); }); return o; };
  function put(parent, g, m, p = [0, 0, 0], s = 1, r = [0, 0, 0], list = null) {
    const o = new THREE.Mesh(g, m); o.position.set(...p);
    if (Array.isArray(s)) o.scale.set(...s); else o.scale.setScalar(s);
    o.rotation.set(...r); parent.add(o); layer(o); if (list) list.push(o); return o;
  }
  function group(parent, p = [0, 0, 0], r = [0, 0, 0], list = null) { const g = new THREE.Group(); g.position.set(...p); g.rotation.set(...r); parent.add(g); if (list) list.push(g); return g; }
  const helpers = { put, group, mat: (...a) => mat(...a), ring: (...a) => ring(...a), knit: (...a) => knit(...a), G, PAL, KIT_COLOUR, folk };

  // ================= the look, decided once per folk =================
  function decide(rec) {
    const sim = rec.sim || {}, sp = rec.species;
    const h = hashStr(String(sim.id ?? rec.id) + '|' + String(sim.name || ''));
    const R = mulberry(h);
    const pick = arr => arr[Math.floor(R() * arr.length)];
    const ix = counts[sp] = (counts[sp] || 0) + 1;
    const kit = kitOf(sim.trade);
    const L = { h, ix, kit, sp };
    if (TOWNSFOLK.includes(sp)) { L.townsfolk = true; L.noYellow = sp === 'loaf'; return L; }   // one uniform per species (species-extra.js)
    if (sp === 'flit') {
      L.rotor = ROTORS[(ix - 1) % ROTORS.length];                      // every style shows up within the first five flits
      L.rotorCol = pick([PAL.red, PAL.cobalt, PAL.navy, PAL.plum, PAL.teal, PAL.pink, PAL.cream]);   // §13: no yellow on a flit
      L.hubCol = pick([PAL.red, PAL.cream, PAL.cobalt, PAL.pink, PAL.cream]);
      L.goggles = (ix % 3 === 1) || R() < 0.25;
      L.fin = (ix % 3 === 2) || R() < 0.2;
      L.finCol = pick([PAL.red, PAL.cobalt, PAL.pink, PAL.teal, PAL.plum]);
      L.beanie = !HEADWEAR.has(kit) && (ix % 2 === 0 || R() < 0.4);
      L.beanieCols = pick([[PAL.red, PAL.cream], [PAL.pink, PAL.cream], [PAL.cobalt, PAL.cream], [PAL.cream, PAL.green], [PAL.plum, PAL.cream], [PAL.teal, PAL.cream]]);
    } else {
      L.canopy = CANOPIES[(ix - 1) % CANOPIES.length];
      L.canopyCol = pick([PAL.red, PAL.cobalt, PAL.yellow, PAL.teal, PAL.pink, PAL.plum, PAL.navy, PAL.green]);
      L.canopyAlt = pick([PAL.white, PAL.yellow, PAL.cream, PAL.pink]);
      if (L.canopyAlt === L.canopyCol) L.canopyAlt = PAL.white;
      L.tassels = (ix % 2 === 1) || R() < 0.3;
      L.tasselCol = pick([PAL.yellow, PAL.red, PAL.cream, PAL.cobalt, PAL.pink]);
      L.handleCol = pick([PAL.red, PAL.cobalt, PAL.yellow, PAL.teal, PAL.cream, PAL.plum, PAL.brown]);
      L.visor = !HEADWEAR.has(kit) && (ix % 3 !== 0 || R() < 0.3);
      L.visorCol = pick([PAL.yellow, PAL.red, PAL.cobalt, PAL.teal, PAL.pink, PAL.cream]);
    }
    L.accent = pick([PAL.red, PAL.cobalt, PAL.yellow, PAL.teal, PAL.pink, PAL.plum, PAL.ochre, PAL.navy]);
    L.accent2 = pick([PAL.cream, PAL.yellow, PAL.white, PAL.pink]);
    // §13: a flit (green) never wears yellow; nor does a floatie that wears anything green
    L.noYellow = sp === 'flit' || isGreen(L.canopyCol || '#fff') || kit === 'farmer' || wearsGreen(rec);
    if (L.noYellow) {
      const alt = [PAL.red, PAL.cobalt, PAL.pink, PAL.plum, PAL.teal, PAL.cream];
      for (const k of ['canopyCol', 'canopyAlt', 'tasselCol', 'handleCol', 'visorCol', 'accent', 'accent2']) {
        if (L[k] && isYellow(L[k])) { let c = alt[(h >>> (k.length % 7)) % alt.length]; if (c === L.canopyCol || c === L.canopyAlt) c = PAL.cream; L[k] = c; }
      }
      if (L.canopyAlt === L.canopyCol) L.canopyAlt = PAL.white;
    }
    return L;
  }

  // does the reference creature itself wear something green (a teal suit, a teal parasol)? (the body excluded)
  function wearsGreen(rec) {
    let g = false; const skin = rec.a && rec.a.body && rec.a.body.children.find(o => o.isMesh);
    if (rec.a) rec.a.root.traverse(o => { if (g || !o.isMesh || o === skin || !o.material || !o.material.uniforms || !o.material.uniforms.uBase) return;
      const u = o.material.uniforms; if (isGreen(u.uBase.value) || (u.uStripeF.value > 0 && isGreen(u.uStripeCol.value))) g = true; });
    return g;
  }

  // ================= flits =================
  // body: r 0.24 (scaled 1, .94, .96), cap dome at y .19 (r .16, h .1), stem to .355, rotor (a.prop) at y .36,
  // eyes at y .02 x ±.07, front z ≈ .23
  const zf = (y, r = 0.24) => Math.sqrt(Math.max(0, r * r - y * y)) * 0.96;
  function gearFlit(rec, L, out) {
    const a = rec.a, b = a.body, list = out.gear;
    const rc = mat(L.rotorCol), hub = mat(L.hubCol);
    if (L.rotor === 'cross') put(a.prop, G.bar, rc, [0, 0.004, 0], 1, [0, Math.PI / 2, 0], list);
    if (L.rotor === 'tips') [-1, 1].forEach(sd => put(a.prop, G.paddle, rc, [sd * 0.175, 0.006, 0], 1, [0, 0, 0], list));
    if (L.rotor === 'tri') {
      put(a.prop, G.stem, mat(PAL.cream), [0, 0.035, 0], [1, 0.6, 1], [0, 0, 0], list);
      const top = group(a.prop, [0, 0.07, 0], [0, 0.5, 0], list);
      for (let k = 0; k < 3; k++) put(top, G.blade3, rc, [0, 0, 0], 1.25, [0.12, k * Math.PI * 2 / 3, 0], list);
    }
    if (L.rotor === 'double') {
      // a second rotor on a longer mast, turning the other way (step() spins it)
      put(b, G.stem, mat(PAL.cream), [0, 0.405, 0], 1, [0, 0, 0], list);
      const top = group(b, [0, 0.45, 0], [0, 0, 0], list); out.counter = top;
      put(top, G.blade2, rc, [0, 0, 0], 1, [0, 0, 0], list);
      put(top, G.hub, hub, [0, 0.012, 0], 0.8, [0, 0, 0], list);
    }
    put(a.prop, G.hub, hub, [0, 0.014, 0], L.rotor === 'tri' ? 0.7 : 1, [0, 0, 0], list);   // a painted finial on the hub
    if (L.goggles) {
      const brass = mat(PAL.ochre), glassM = mat(PAL.aqua), strap = mat(PAL.leather);
      const s = put(b, ring(0.214, 0.055), strap, [0, 0.115, 0], [1, 1, 1], [Math.PI / 2 - 0.12, 0, 0], list); s.scale.set(1, 0.98, 1.5);
      [-1, 1].forEach(sd => {
        const x = sd * 0.062, y = 0.125, g = group(b, [x, y, zf(y) - 0.012], [-0.55, sd * 0.28, 0], list);
        put(g, G.lens, brass, [0, 0, 0.012], 1.15, [0, 0, 0], list); put(g, G.glass, glassM, [0, 0, 0.012], 1.1, [0, 0, 0], list);
      });
    }
    if (L.fin) put(b, G.fin, mat(L.finCol), [0, 0.02, -0.225], 1.15, [0, Math.PI / 2, 0], list);
    if (L.beanie) {
      const [k1, k2] = L.beanieCols;
      put(b, G.dome, knit(k1, k2), [0, 0.165, -0.005], [0.178, 0.14, 0.178], [-0.08, 0, 0], list);
      put(b, ring(0.176, 0.2), mat(k2), [0, 0.175, -0.005], [1, 1, 1.5], [Math.PI / 2 - 0.08, 0, 0], list);
    }
  }
  function outfitFlit(rec, L, out) {
    const a = rec.a, b = a.body, list = out.trade, k = L.kit;
    const belt = (col = PAL.leather, pouch = PAL.ochre) => {
      const r = put(b, ring(0.236, 0.09), mat(col), [0, -0.075, 0], [1, 1, 1.25], [Math.PI / 2, 0, 0], list); r.scale.set(1, 0.96, 1.25);
      put(b, G.box, mat(pouch), [0.15, -0.1, 0.17], [0.075, 0.07, 0.05], [0, 0.7, 0], list);
      put(b, G.box, mat(pouch), [-0.17, -0.1, 0.15], [0.06, 0.06, 0.045], [0, -0.8, 0], list);
      put(b, G.cyl, mat(PAL.brown), [0.2, -0.06, 0.1], [0.012, 0.13, 0.012], [0, 0, 0.25], list);           // a hammer handle
      put(b, G.box, mat('#6f6470'), [0.215, 0.005, 0.105], [0.06, 0.03, 0.03], [0, 0.4, 0.25], list);       // its head
    };
    const apron = (col, strap) => {
      put(b, G.apronFlit, mat(col), [0, 0, 0], [1, 0.94, 0.97], [0, 0, 0], list);
      put(b, ring(0.24, 0.06), mat(strap), [0, -0.02, 0], [1, 1, 1.3], [Math.PI / 2, 0, 0], list);
    };
    const capBand = (col, r = 0.168, t = 0.22, y = 0.205) => put(b, ring(r, t), mat(col), [0, y, 0], [1, 1, 1.6], [Math.PI / 2, 0, 0], list);
    const satchel = (col, flap, side = 1) => {
      const g = group(b, [0, 0, 0], [0, 0, side * 0.72], list);
      put(g, ring(0.25, 0.05), mat(PAL.leather), [0, 0, 0], [1, 1, 1.2], [Math.PI / 2 + 0.05, 0, 0], list);
      put(b, G.box, mat(col), [side * 0.215, -0.12, 0.06], [0.07, 0.13, 0.15], [0, 0, side * 0.1], list);
      put(b, G.box, mat(flap), [side * 0.245, -0.085, 0.06], [0.02, 0.065, 0.155], [0, 0, side * 0.1], list);
    };
    if (k === 'builder') {
      capBand(KIT_COLOUR.builder, 0.17, 0.3, 0.2);
      put(b, G.halfDisc, mat(KIT_COLOUR.builder), [0, 0.205, 0.04], [0.19, 0.014, 0.19], [0.18, 0, 0], list);   // a little hard-hat peak
      put(b, G.ball, mat(PAL.cream), [0, 0.235, 0.17], 0.026, [0, 0, 0], list);                       // its lamp
      belt();
    } else if (k === 'crafter') {
      apron(PAL.leather, PAL.brown); belt(PAL.brown, PAL.leather);
    } else if (k === 'baker') {
      put(b, G.toqueSide, mat(PAL.white), [0, 0.245, 0], 1, [0, 0, 0], list);
      put(b, G.dome, mat(PAL.white), [0, 0.28, 0], [0.19, 0.06, 0.19], [0, 0, 0], list);
      put(b, ring(0.172, 0.24), mat(PAL.white), [0, 0.21, 0], [1, 1, 1.4], [Math.PI / 2, 0, 0], list);
      apron(PAL.white, PAL.cream);
    } else if (k === 'farmer') {
      put(b, G.disc, mat(PAL.straw), [0, 0.2, 0], [0.33, 0.014, 0.33], [-0.06, 0, 0], list);
      capBand(L.accent === PAL.yellow ? PAL.red : L.accent, 0.166, 0.2, 0.215);
      satchel(PAL.sage, PAL.straw, -1);
      [0, 1, 2].forEach(i => put(b, G.ball, mat(PAL.ochre), [-0.235 - 0.012 * i, -0.04, 0.03 + i * 0.03], 0.014, [0, 0, 0], list));   // seeds peeking out
    } else if (k === 'courier') {
      satchel(PAL.red, PAL.ochre, 1);
      const sc = L.accent2 === PAL.pink ? PAL.pink : PAL.cobalt;   // §13: a coral or a cobalt scarf, never yellow on a flit
      put(b, ring(0.205, 0.13), mat(sc), [0, -0.105, 0], [1, 1, 1.4], [Math.PI / 2, 0, 0], list);
      const tail = group(b, [-0.08, -0.1, -0.19], [0.4, 0, 0.3], list); out.tail = tail;
      put(tail, G.box, mat(sc), [0, -0.08, 0], [0.06, 0.17, 0.022], [0, 0, 0], list);
    } else if (k === 'trader') {
      put(b, ring(0.205, 0.13), mat(PAL.teal, PAL.cream, 18), [0, -0.105, 0], [1, 1, 1.4], [Math.PI / 2, 0, 0], list);
      put(b, G.ball, mat(PAL.ochre), [0.2, -0.13, 0.1], [0.06, 0.07, 0.055], [0, 0, 0], list);           // a coin purse
      put(b, G.ball, mat(PAL.yellow), [0.21, -0.07, 0.11], 0.02, [0, 0, 0], list);
    } else if (k === 'diplomat') {
      const g = group(b, [0, 0, 0], [0, 0, 0.78], list);
      put(g, ring(0.243, 0.13), mat(PAL.plum, PAL.yellow, 0), [0, 0, 0], [1, 1, 1.15], [Math.PI / 2, 0, 0], list);
      put(b, G.disc, mat(PAL.yellow), [0.1, 0.06, zf(0.06) + 0.012], [0.04, 0.012, 0.04], [Math.PI / 2 - 0.1, 0, 0], list);   // rosette
      put(b, G.disc, mat(PAL.red), [0.1, 0.06, zf(0.06) + 0.02], [0.024, 0.01, 0.024], [Math.PI / 2 - 0.1, 0, 0], list);
    } else if (k === 'scholar') {
      const ink = mat(PAL.ink);
      [-1, 1].forEach(sd => put(b, G.lens, ink, [sd * 0.07, 0.022, zf(0.022) + 0.004], [1.05, 1.15, 1], [0, sd * 0.3, 0], list));
      put(b, G.box, ink, [0, 0.03, zf(0.03) + 0.006], [0.05, 0.008, 0.008], [0, 0, 0], list);
      capBand(PAL.cobalt, 0.167, 0.16, 0.21);
      put(b, G.quill, mat(PAL.white), [0.13, 0.32, -0.04], 1, [0.2, 0, -0.5], list);
      put(b, G.quill, mat(PAL.cobalt), [0.135, 0.31, -0.035], [0.6, 0.7, 0.6], [0.2, 0, -0.5], list);
    }
  }

  // ================= floaties =================
  // canopy group: a cone (r .5, h .16, apex y .08, so the surface is y = .08 - .32 r), tip ball at y .09; swing group:
  // the handle from 0 down to -.62; body (r .22) hangs at -.82; arm up at (.05, .17), free arm (a.wave) at (-.2, 0)
  const SLOPE = Math.atan(0.32);
  const coneY = r => 0.08 - 0.32 * r;
  function gearFloatie(rec, L, out) {
    const a = rec.a, c = a.canopy, list = out.gear;
    const A = mat(L.canopyCol), B = mat(L.canopyAlt);
    if (L.canopy === 'wide') put(c, G.shell, mat(L.canopyCol, L.canopyAlt, 3), [0, 0.004, 0], 1, [-Math.PI / 2, 0, 0], list);
    if (L.canopy === 'two-tone') { put(c, G.shell, A, [0, 0.003, 0], 1, [-Math.PI / 2, 0, 0], list); put(c, G.half, B, [0, 0.006, 0], 1, [-Math.PI / 2, 0, 0], list); }
    if (L.canopy === 'polka') {
      put(c, G.shell, A, [0, 0.003, 0], 1, [-Math.PI / 2, 0, 0], list);
      [[0.19, 6, 0], [0.38, 10, 0.3]].forEach(([r, n, o]) => { for (let i = 0; i < n; i++) { const g = group(c, [0, 0, 0], [0, o + i / n * Math.PI * 2, 0], list); put(g, G.dot, B, [0, coneY(r) + 0.012, r], r > 0.3 ? 1.1 : 0.9, [SLOPE, 0, 0], list); } });
    }
    if (L.canopy === 'ring') put(c, ring(0.31, 0.11), B, [0, coneY(0.31) + 0.01, 0], [1, 1, 0.45], [Math.PI / 2, 0, 0], list);
    if (L.canopy === 'scallop' || L.canopy === 'gores') {
      // the reference gores stay as they are; a scalloped fringe (or a painted rim band) gives them a hem
      if (L.canopy === 'scallop') for (let i = 0; i < 16; i++) { const g = group(c, [0, 0, 0], [0, i / 16 * Math.PI * 2, 0], list); put(g, G.scallop, i % 2 ? A : B, [0, coneY(0.5) - 0.002, 0.5], 1, [SLOPE, 0, 0], list); }
      else put(c, ring(0.47, 0.06), B, [0, coneY(0.47) + 0.006, 0], [1, 1, 0.5], [Math.PI / 2, 0, 0], list);
    }
    if (L.tassels) {
      const tc = mat(L.tasselCol), cord = mat(PAL.cream), sway = group(c, [0, 0, 0], [0, 0, 0], list);
      out.tassels = [sway];   // the whole fringe sways as one (two draw calls once baked)
      for (let i = 0; i < 8; i++) {
        const g = group(sway, [0, 0, 0], [0, (i + 0.5) / 8 * Math.PI * 2, 0], list);
        const hang = group(g, [0, coneY(0.5) - 0.004, 0.5], [0, 0, 0], list);
        put(hang, G.cyl, cord, [0, -0.035, 0], [0.005, 0.07, 0.005], [0, 0, 0], list);
        put(hang, G.ball, tc, [0, -0.08, 0], [0.022, 0.03, 0.022], [0, 0, 0], list);
      }
    }
    // handle: a painted sleeve with two bands, and a crook-shaped grip at the hand
    const hc = mat(L.handleCol);
    put(a.swing, G.cyl, hc, [0, -0.3, 0], [0.0125, 0.34, 0.0125], [0, 0, 0], list);
    [-0.12, -0.48].forEach(y => put(a.swing, ring(0.016, 0.45), mat(L.accent2), [0, y, 0], 1, [Math.PI / 2, 0, 0], list));
    put(c, G.ball, hc, [0, 0.1, 0], 0.03, [0, 0, 0], list);                                   // finial over the reference tip
    if (L.visor) {
      const b = a.body, vc = mat(L.visorCol);
      put(b, ring(0.196, 0.1), vc, [0, 0.12, 0], [1, 1, 1.4], [Math.PI / 2 - 0.15, 0, 0], list);
      put(b, G.halfDisc, vc, [0, 0.135, 0.11], [0.15, 0.012, 0.15], [0.32, 0, 0], list);
    }
  }
  const zb = (y, r = 0.22) => Math.sqrt(Math.max(0, r * r - y * y)) * 0.95;
  function outfitFloatie(rec, L, out) {
    const a = rec.a, b = a.body, c = a.canopy, list = out.trade, k = L.kit;
    // the trade pennant on the parasol tip: what reads from straight above
    if (k !== 'none') {
      put(c, G.cyl, mat(PAL.cream), [0, 0.18, 0], [0.006, 0.16, 0.006], [0, 0, 0], list);
      const f = group(c, [0, 0.255, 0], [0, 0, 0], list); out.flag = f;
      put(f, G.flag, mat(KIT_COLOUR[k]), [0, 0, 0], 1.25, [0, 0, 0], list);
    }
    const belt = (col = PAL.leather) => {
      put(b, ring(0.224, 0.09), mat(col), [0, -0.06, 0], [1, 1, 1.2], [Math.PI / 2, 0, 0], list);
      put(b, G.box, mat(PAL.ochre), [0.15, -0.09, 0.15], [0.07, 0.065, 0.045], [0, 0.7, 0], list);
      put(b, G.cyl, mat(PAL.brown), [0.19, -0.05, 0.1], [0.011, 0.12, 0.011], [0, 0, 0.25], list);
      put(b, G.box, mat('#6f6470'), [0.205, 0.01, 0.105], [0.055, 0.028, 0.028], [0, 0.4, 0.25], list);
    };
    const apron = (col, strap) => {
      put(b, G.apronFloat, mat(col), [0, 0, 0], [1, 1.05, 0.95], [0, 0, 0], list);
      put(b, ring(0.226, 0.06), mat(strap), [0, -0.01, 0], [1, 1, 1.25], [Math.PI / 2, 0, 0], list);
    };
    const satchel = (col, flap) => {
      const g = group(b, [0, 0, 0], [0, 0, -0.7], list);
      put(g, ring(0.23, 0.05), mat(PAL.leather), [0, 0, 0], [1, 1, 1.2], [Math.PI / 2 + 0.05, 0, 0], list);
      put(b, G.box, mat(col), [0.2, -0.12, 0.06], [0.065, 0.12, 0.14], [0, 0, 0.1], list);
      put(b, G.box, mat(flap), [0.228, -0.087, 0.06], [0.02, 0.06, 0.145], [0, 0, 0.1], list);
    };
    const hatAt = (y = 0.165) => group(b, [-0.02, y, 0], [-0.1, 0, 0.12], list);
    if (k === 'builder') {
      const h = hatAt(); put(h, G.dome, mat(KIT_COLOUR.builder), [0, 0, 0], [0.15, 0.11, 0.15], [0, 0, 0], list);
      put(h, G.disc, mat(KIT_COLOUR.builder), [0, 0.005, 0.03], [0.17, 0.012, 0.18], [0, 0, 0], list);
      put(h, G.box, mat(PAL.cream), [0, 0.09, 0], [0.03, 0.03, 0.2], [0, 0, 0], list);
      belt();
    } else if (k === 'crafter') { apron(PAL.leather, PAL.brown); belt(PAL.brown); }
    else if (k === 'baker') {
      const h = hatAt(0.17);
      put(h, G.toqueSide, mat(PAL.white), [0, 0.04, 0], [0.75, 1, 0.75], [0, 0, 0], list);
      put(h, G.dome, mat(PAL.white), [0, 0.075, 0], [0.15, 0.07, 0.15], [0, 0, 0], list);
      apron(PAL.white, PAL.cream);
    } else if (k === 'farmer') {
      const h = hatAt(0.17);
      put(h, G.dome, mat(PAL.straw), [0, 0, 0], [0.12, 0.08, 0.12], [0, 0, 0], list);
      put(h, G.disc, mat(PAL.straw), [0, 0.004, 0], [0.24, 0.012, 0.24], [0, 0, 0], list);
      put(h, ring(0.121, 0.18), mat(L.accent === PAL.yellow ? PAL.red : L.accent), [0, 0.02, 0], [1, 1, 1.5], [Math.PI / 2, 0, 0], list);
      satchel(PAL.sage, PAL.straw);
    } else if (k === 'courier') {
      satchel(PAL.red, PAL.ochre);
      const sc = L.accent2 === PAL.yellow ? PAL.yellow : PAL.cobalt;
      put(b, ring(0.19, 0.13), mat(sc), [0, 0.06, 0], [1, 1, 1.4], [Math.PI / 2, 0, 0], list);
      const tail = group(b, [-0.08, 0.06, -0.17], [0.4, 0, 0.3], list); out.tail = tail;
      put(tail, G.box, mat(sc), [0, -0.08, 0], [0.055, 0.16, 0.02], [0, 0, 0], list);
    } else if (k === 'trader') {
      put(b, ring(0.19, 0.13), mat(PAL.teal, PAL.cream, 18), [0, 0.06, 0], [1, 1, 1.4], [Math.PI / 2, 0, 0], list);
      put(b, G.ball, mat(PAL.ochre), [0.19, -0.1, 0.1], [0.055, 0.065, 0.05], [0, 0, 0], list);
      put(b, G.ball, mat(PAL.yellow), [0.2, -0.045, 0.11], 0.018, [0, 0, 0], list);
    } else if (k === 'diplomat') {
      const g = group(b, [0, 0, 0], [0, 0, -0.78], list);
      put(g, ring(0.226, 0.13), mat(PAL.plum), [0, 0, 0], [1, 1, 1.15], [Math.PI / 2, 0, 0], list);
      put(b, G.disc, mat(PAL.yellow), [-0.09, 0.0, zb(0.0) + 0.012], [0.04, 0.012, 0.04], [Math.PI / 2, 0, 0], list);
      put(b, G.disc, mat(PAL.red), [-0.09, 0.0, zb(0.0) + 0.02], [0.024, 0.01, 0.024], [Math.PI / 2, 0, 0], list);
    } else if (k === 'scholar') {
      const ink = mat(PAL.ink);
      [-1, 1].forEach(sd => put(b, G.lens, ink, [sd * 0.065, 0.03, zb(0.03) + 0.004], [1, 1.1, 1], [0, sd * 0.3, 0], list));
      put(b, G.box, ink, [0, 0.036, zb(0.036) + 0.006], [0.045, 0.008, 0.008], [0, 0, 0], list);
      put(b, G.quill, mat(PAL.white), [-0.15, 0.2, -0.02], 0.9, [0.2, 0, 0.55], list);
    }
  }

  // ================= baking: one draw call per folk per colour =================
  // The pieces that never move on their own (all but the counter-rotor, the scarf tail, the pennant and the tassels)
  // are merged per parent (body / rotor / canopy / handle) and per material into one mesh: ~250 draw calls fewer for
  // twelve folk. Striped cloth keeps its own mesh: the stripe shader reads object-space positions.
  const mInv = new THREE.Matrix4(), mRel = new THREE.Matrix4();
  function bake(rec, list, out) {
    // the moving groups are containers of their own: their pieces merge among themselves and keep moving
    const a = rec.a, containers = [out.counter, out.tail, out.flag, ...(out.tassels || []), ...(out.swing || []).map(s => s.g), a.head, a.body, a.prop, a.canopy, a.swing].filter(Boolean);
    a.root.updateMatrixWorld(true);
    const buckets = new Map();
    for (const m of list) {
      if (!m.isMesh || (m.material.uniforms && m.material.uniforms.uStripeF.value > 0)) continue;
      let p = m.parent;
      while (p && !containers.includes(p)) p = p.parent;
      if (!p) continue;
      const k = containers.indexOf(p) + ':' + m.material.uuid;
      if (!buckets.has(k)) buckets.set(k, { c: p, mat: m.material, ms: [] });
      buckets.get(k).ms.push(m);
    }
    for (const { c, mat, ms } of buckets.values()) {
      if (ms.length < 2) continue;
      mInv.copy(c.matrixWorld).invert();
      const P = [], N = [];
      for (const m of ms) {
        mRel.multiplyMatrices(mInv, m.matrixWorld);
        const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
        g.applyMatrix4(mRel); P.push(g.attributes.position.array); N.push(g.attributes.normal.array); g.dispose();
        m.parent.remove(m); const i = list.indexOf(m); if (i >= 0) list.splice(i, 1);
      }
      const n = P.reduce((s, a) => s + a.length, 0), pos = new Float32Array(n), nor = new Float32Array(n);
      let o = 0; P.forEach((a, i) => { pos.set(a, o); nor.set(N[i], o); o += a.length; });
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
      geo.computeBoundingSphere();
      const mesh = new THREE.Mesh(geo, mat); c.add(mesh); layer(mesh); list.push(mesh);
    }
  }

  // ================= public =================
  function clear(list) { list.forEach(o => { if (o.parent) o.parent.remove(o); }); list.length = 0; }
  function dress(rec) {
    if (!rec || !rec.a || rec.idn) return rec && rec.idn;
    if (rec.species !== 'flit' && rec.species !== 'floatie' && !TOWNSFOLK.includes(rec.species)) return null;
    const L = decide(rec);
    const out = rec.idn = { L, gear: [], trade: [], seal: [], counter: null, tail: null, tassels: null, flag: null, trade0: rec.sim && rec.sim.trade };
    noYellow = !!L.noYellow;
    if (L.townsfolk) dressTownsfolk(rec, L, out, helpers);
    else if (rec.species === 'flit') { gearFlit(rec, L, out); outfitFlit(rec, L, out); } else { gearFloatie(rec, L, out); outfitFloatie(rec, L, out); }
    noYellow = false;
    bake(rec, out.gear, out); bake(rec, out.trade, out);
    out.colourRule = applyColourRule(rec, folk);   // §13: the reference's own yellow caps / brims / blades
    out.rev = (out.rev || 0) + 1;                  // portraits re-render when this changes
    rec.top = null;   // bodyTop() is cached per folk: let it see the hats
    return out;
  }
  function restyle(rec) {
    const o = rec && rec.idn; if (!o || !rec.a) return;
    const kit = kitOf(rec.sim && rec.sim.trade);
    o.trade0 = rec.sim && rec.sim.trade;
    if (kit === o.L.kit) return;
    clear(o.trade); o.tail = null; o.flag = null; o.L.kit = kit;
    if (kit === 'farmer' && !o.L.townsfolk) o.L.noYellow = true;
    noYellow = !!o.L.noYellow;
    if (o.L.townsfolk) dressTownsfolk(rec, o.L, o, helpers);
    else if (rec.species === 'flit') outfitFlit(rec, o.L, o); else outfitFloatie(rec, o.L, o);
    noYellow = false;
    bake(rec, o.trade, o);
    o.colourRule = applyColourRule(rec, folk); o.rev = (o.rev || 0) + 1;
  }
  // the minister wears the red wax seal on a ribbon (cream + red, the letters' seal)
  function setMinister(rec, on) {
    const o = rec && rec.idn; if (!o || !rec.a) return;
    o.rev = (o.rev || 0) + 1; o.minister = !!on;
    clear(o.seal); if (!on) return;
    if (o.L.townsfolk) {   // the seal pinned on the front, under the face
      const T = { loaf: [rec.a.body, 0.09, 0.245], twinkle: [rec.a.body, 0.2, 0.1], glim: [rec.a.body, 0.13, 0.222], moth: [rec.a.shell, -0.12, 0.13] }[rec.species];
      put(T[0], G.disc, mat('#e0503f'), [0, T[1], T[2]], [0.055, 0.016, 0.055], [Math.PI / 2 - 0.15, 0, 0], o.seal);
      put(T[0], G.disc, mat(PAL.cream), [0, T[1], T[2] + 0.01], [0.026, 0.01, 0.026], [Math.PI / 2 - 0.15, 0, 0], o.seal);
      return;
    }
    const b = rec.a.body, fl = rec.species === 'flit', y = fl ? -0.02 : 0.02, z = (fl ? zf(y) : zb(y)) + 0.01;
    put(b, ring(fl ? 0.2 : 0.185, 0.07), mat(PAL.red), [0, fl ? 0.04 : 0.08, 0], [1, 1, 1.4], [Math.PI / 2 + 0.25, 0, 0], o.seal);
    put(b, G.box, mat(PAL.red), [-0.022, y - 0.05, z - 0.004], [0.022, 0.07, 0.008], [0, 0, 0.25], o.seal);
    put(b, G.box, mat(PAL.red), [0.022, y - 0.05, z - 0.004], [0.022, 0.07, 0.008], [0, 0, -0.25], o.seal);
    put(b, G.disc, mat('#e0503f'), [0, y, z + 0.006], [0.055, 0.016, 0.055], [Math.PI / 2 - 0.15, 0, 0], o.seal);
    put(b, G.disc, mat(PAL.cream), [0, y, z + 0.016], [0.026, 0.01, 0.026], [Math.PI / 2 - 0.15, 0, 0], o.seal);
  }
  function step(rec, dt, t) {
    const o = rec.idn; if (!o || !rec.a) return;
    if (o.counter) o.counter.rotation.y = -rec.a.prop.rotation.y * 1.3;
    if (o.tail) { const v = rec.a.vel ? Math.hypot(rec.a.vel.x, rec.a.vel.z) : 0; o.tail.rotation.x = 0.35 + Math.min(1.1, v * 0.35) + Math.sin(t * (6 + v * 4) + o.L.h % 7) * (0.08 + v * 0.06); }
    if (o.tassels) { const k = o.L.h % 5; o.tassels.forEach(g => { g.rotation.x = Math.sin(t * 1.7 + k) * 0.05; g.rotation.z = Math.sin(t * 1.3 + k * 2) * 0.05; }); }
    if (o.flag) o.flag.rotation.y = Math.sin(t * 2.3 + (o.L.h % 9)) * 0.35;
    if (o.swing) {   // townsfolk: the nightcap flops, the glim's tassel swings, the moth's scarf streams
      const a = rec.a, v = a.vel ? Math.hypot(a.vel.x, a.vel.z) : 0, k = o.L.h % 7;
      o.swing.forEach(s => {
        const [bx, by, bz] = s.base;
        if (s.pend) s.g.rotation.set(bx - Math.min(0.6, v * 0.35) + Math.sin(t * 3.1 + k) * s.k * 0.4, by, bz + Math.sin(t * 2.3 + k) * s.k * 0.3);
        else if (s.stream) s.g.rotation.set(bx + Math.min(0.9, v * 0.4) + Math.sin(t * (6 + v * 4) + k) * (0.08 + v * 0.06), by, bz);
        else s.g.rotation.set(bx, by, bz + Math.sin(t * 1.7 + k) * s.k);
      });
    }
    // the sim changed this folk's trade (a new job, an entrepreneur): new clothes
    if (rec.sim && rec.sim.trade !== o.trade0) restyle(rec);
  }
  function describe(rec) {
    const o = rec && rec.idn; if (!o) return null;
    const L = o.L, words = [];
    let gear;
    if (L.townsfolk) gear = UNIFORM_WORDS[rec.species];
    else if (rec.species === 'flit') {
      gear = `${ROTOR_WORDS[L.rotor]}${L.rotor === 'classic' ? '' : ' in ' + cname(L.rotorCol)}`;
      if (L.goggles) words.push('flying goggles'); if (L.fin) words.push(`a ${cname(L.finCol)} tail-fin`);
      if (L.beanie) words.push(`a ${cname(L.beanieCols[0])} knit beanie`);
    } else {
      gear = `${CANOPY_WORDS[L.canopy]}${L.canopy === 'gores' ? '' : ' in ' + cname(L.canopyCol) + ' and ' + cname(L.canopyAlt)}`;
      if (L.tassels) words.push(`${cname(L.tasselCol)} tassels`); words.push(`a ${cname(L.handleCol)} handle`);
      if (L.visor) words.push(`a ${cname(L.visorCol)} sun-visor`);
    }
    const outfit = L.townsfolk ? (L.kit === 'none' ? '' : `a ${cname(KIT_COLOUR[L.kit])} ${L.kit}'s badge`) : KIT_WORDS[L.kit];
    return { species: rec.species, kit: L.kit, trade: rec.sim ? rec.sim.trade : null, gear, extras: words, outfit,
      colour: KIT_COLOUR[L.kit], rotor: L.rotor || null, canopy: L.canopy || null,
      words: [gear, ...words, outfit].filter(Boolean).join(', ') };
  }
  return { dress, restyle, setMinister, step, describe, keep(gs, ms) { keepG.forEach(g => gs.add(g)); keepM.forEach(m => ms.add(m)); }, G, kitOf };
}
