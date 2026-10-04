// ART_DIRECTION §13, Sueda's colour rule: NO GREEN AND YELLOW TOGETHER ON A CREATURE.
// Flits (green bodies) never wear yellow caps, brims, propellers, scarves or accessories; floaties may wear any approved
// accent except yellow next to a green element. The reference (web/js/paint/folk.js) stays untouched: its random cap
// colours include ['#2f62d8', '#f2c14e'] and ['#f2c14e', '#e2483a'], so this is an ADDITIVE override in our layer, run
// right after folk.make.* and identity.dress (and again after a re-dress): any accessory mesh whose paint is yellow
// (or lemon / gold / straw) gets a non-yellow approved accent instead. It swaps the mesh's material (the shared cloth
// cache stays intact), keeps cap / brim / blade consistent (the same yellow on one folk becomes the same accent) and
// picks an accent the folk isn't already wearing, so cap and brim stay two colours.
// It works on any creature: green skin (flits, the neighbours' pips) -> yellow accessories go; yellow skin (puffers)
// -> green accessories go; anything else wearing both (a floatie with a green pennant and yellow tassels) -> the
// yellow goes.
//
//   applyColourRule(rec, folk) -> { skin, swaps: [{ from, to }] }     rec.a = the folk record (root, body ...)
//   isYellow(hex|Color) · isGreen(hex|Color) · ACCENTS

export const ACCENTS = { red: '#e2483a', blue: '#2f62d8', cream: '#f4ead6', violet: '#7a3d8c', coral: '#e85a71', teal: '#2b8a7a' };
const ORDER = ['cream', 'red', 'blue', 'coral', 'violet', 'teal'];

let C0 = null;
const C = () => C0 || (C0 = new THREE.Color());
function hsl(c) {
  const col = c && c.isColor ? c : C().set(c);
  const o = {}; col.getHSL(o); return { h: o.h * 360, s: o.s, l: o.l };
}
// yellow, lemon, gold, mustard, straw: hue 36-68 deg, clearly saturated, not near-white or near-black
export function isYellow(c) { const { h, s, l } = hsl(c); return h >= 36 && h <= 68 && s >= 0.35 && l >= 0.3 && l <= 0.86; }
// green, sage, and the greener teals (they read as green next to yellow)
export function isGreen(c) { const { h, s, l } = hsl(c); return h > 70 && h <= 176 && s >= 0.18 && l >= 0.12 && l <= 0.86; }
const hexOf = c => '#' + (c.isColor ? c : C().set(c)).getHexString();
function hashStr(s) { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

const clones = new Map();   // material uuid + hex -> re-dyed clone (stripes, knits, garments with clips)
function redye(folk, m, field, hex) {
  const u = m.uniforms;
  // a plain cloth swatch: use the shared cloth cache (one material per colour, as the reference does)
  if (field === 'base' && !(u.uStripeF.value > 0) && !(u.uRibs && u.uRibs.value > 0) && !(u.uClipY.value < 1e2) && !(u.uClipZ.value < 1e2)) return folk.cloth(hex);
  const k = m.uuid + field + hex;
  if (clones.has(k)) return clones.get(k);
  const n = m.clone();
  for (const key in u) if (u[key].value && u[key].value.isVector3) n.uniforms[key] = u[key];   // keep the shared key light
  if (field === 'base') { const [b, s, d] = folk.tones(hex); n.uniforms.uBase.value = new THREE.Color(b); n.uniforms.uShade.value = new THREE.Color(s); n.uniforms.uRim.value = new THREE.Color(d); }
  else n.uniforms.uStripeCol.value = new THREE.Color(hex);
  clones.set(k, n); return n;
}

export function applyColourRule(rec, folk) {
  const a = rec && rec.a; if (!a || !a.root) return null;
  const meshes = [];
  a.root.traverse(o => { if (o.isMesh && o.material && o.material.uniforms && o.material.uniforms.uBase) meshes.push(o); });
  if (!meshes.length) return null;
  // the skin: the first painted mesh on the body (every folk.make.* adds its ball first). Clay (uBase) or the
  // puffers' cel body (uLit); the skin is never re-dyed
  const tone = m => m && m.uniforms ? (m.uniforms.uBase || m.uniforms.uLit || {}).value || null : null;
  let skinMesh = null;
  if (a.body) for (const o of a.body.children) if (o.isMesh && tone(o.material)) { skinMesh = o; break; }
  const skinMat = skinMesh ? skinMesh.material : null;
  const skinCol = skinMat ? tone(skinMat) : null;
  const skin = skinCol ? (isGreen(skinCol) ? 'green' : isYellow(skinCol) ? 'yellow' : 'other') : 'other';
  const isSkin = m => m === skinMat || (skinCol && m.uniforms.uBase.value.equals(skinCol));
  const paints = m => { const u = m.uniforms, out = [['base', u.uBase.value]]; if (u.uStripeF.value > 0) out.push(['stripe', u.uStripeCol.value]); return out; };
  let anyY = false, anyG = false;
  for (const o of meshes) { if (isSkin(o.material)) continue; for (const [, c] of paints(o.material)) { if (isYellow(c)) anyY = true; if (isGreen(c)) anyG = true; } }
  if (skin === 'green') anyG = true; if (skin === 'yellow') anyY = true;
  if (!(anyY && anyG)) return { skin, swaps: [] };
  // what goes: on a yellow body the green bits; otherwise the yellow ones
  const bad = skin === 'yellow' ? isGreen : isYellow;
  // accents already worn (so the new one differs from the cap / brim it sits next to)
  const worn = new Set();
  for (const o of meshes) { if (isSkin(o.material)) continue; for (const [, c] of paints(o.material)) if (!bad(c)) worn.add(hexOf(c)); }
  const seed = hashStr(String(rec.id ?? '') + '|' + String((rec.sim && rec.sim.name) || ''));
  const choices = ORDER.filter(k => !(skin === 'yellow' && k === 'teal')).map(k => ACCENTS[k]);
  const map = new Map(), swaps = [];
  const pickFor = from => {
    if (map.has(from)) return map.get(from);
    let to = null;
    for (let i = 0; i < choices.length; i++) { const c = choices[(seed + map.size + i) % choices.length]; if (!worn.has(c)) { to = c; break; } }
    to = to || ACCENTS.cream; worn.add(to); map.set(from, to); swaps.push({ from, to }); return to;
  };
  for (const o of meshes) {
    if (isSkin(o.material)) continue;
    let m = o.material;
    for (const [field, c] of paints(m)) if (bad(c)) m = redye(folk, m, field, pickFor(hexOf(c)));
    if (m !== o.material) o.material = m;
  }
  return { skin, swaps };
}
