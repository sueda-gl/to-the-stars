// The prefab library: catalogue prefabs (prefabs/<id>.js, loaded by dynamic import) and generated assets
// (code from /api/codegen or /api/assets), built once into a template and cloned per placement (geometry and
// materials shared). Every clone is registered in ctx.lineOnly / ctx.colourOnly by its tags.
//
//   const lib = createLibrary(ctx, kit);          // or createLibrary(ctx, kit, { api })
//   await lib.load();                             // imports every prefab in prefabs/manifest.js (ALL_IDS; or pass your own ids)
//   lib.has('house'); lib.ids();                  // loaded prefab ids, catalogue order then the manifest's
//   lib.meta('sheep-pen'); lib.byCategory();      // manifest meta (no build); [{ category, ids }] in CATEGORY_ORDER
//   lib.register(asset) -> { ok, id, error? }     // asset = { id, name, code, meta? } (generated)
//   const obj = lib.create('house' | asset | assetId, { variant, rot, fit:{w,d} })   // THREE.Group, ground at y=0, never throws
//   lib.animate(obj, t); lib.update(t);           // sails, spinners, bobbing ducks
//   lib.release(obj);                             // remove from the scene + ctx lists (always use this to remove)
// Objects come out in their COMPACT form (parts merged per material, see compact.js); a reveal switches them to
// full parts while it paints and back when done. obj.agoraForm('full' | 'compact') does it by hand.
import { createBuildApi, compileAsset, normalise, internals, AssetError } from './api.js';
import { renderSketchFromMassing } from './sketch.js';
import { planCompact, attachForms } from './compact.js';
import { MANIFEST, MANIFEST_IDS, CATEGORY_ORDER } from './prefabs/manifest.js';

// the fixed catalogue ids (ARCHITECTURE §2); a prefab file per id lives in prefabs/<id>.js
export const CATALOG_IDS = ['house', 'hut', 'well', 'farm', 'windmill', 'bakery', 'granary', 'woodcutter', 'grove', 'quarry',
  'workshop', 'market', 'dock', 'fountain', 'tavern', 'temple', 'tower', 'bridge', 'road', 'garden', 'assembly'];
// every prefab the manifest knows (scripts/build-manifest.mjs reads each prefabs/<id>.js meta): the fixed ids first
export const ALL_IDS = CATALOG_IDS.concat(MANIFEST_IDS.filter(id => !CATALOG_IDS.includes(id)));
export { MANIFEST, CATEGORY_ORDER };
const META = new Map(MANIFEST.map(m => [m.id, m]));

const hash = s => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };

export function createLibrary(ctx, kit, { api = null, base = new URL('./prefabs/', import.meta.url).href, onError = null, variants = 3 } = {}) {
  api = api || createBuildApi(ctx, kit);
  const I = internals(api);
  const modules = new Map();     // id -> prefab module { build, animate?, meta? }
  const assets = new Map();      // id -> { asset, make }
  const templates = new Map();   // key -> wrapper group (never in the scene)
  const plans = new WeakMap();    // template -> compact plan (merged geometries shared by every clone)
  const missing = new Set();
  const live = new Set();        // created objects (for update(t))
  const report = (id, err) => { console.warn('[buildings]', id, err && err.message || err); if (onError) onError({ id, error: err }); };

  async function load(ids = ALL_IDS) {
    await Promise.all(ids.map(async id => {
      if (modules.has(id) || missing.has(id)) return;
      const url = `${base}${id}.js`;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const mod = await import(attempt ? `${url}?retry=${attempt}` : url);
          if (typeof mod.build !== 'function') { report(id, new Error('prefab has no build(api)')); break; }
          modules.set(id, mod); return;
        } catch (e) {
          // a prefab nobody has written yet is a 404: stop. A file that exists but failed (a busy dev server,
          // a syntax error) is retried, then reported.
          let exists = false;
          try { exists = (await fetch(url, { method: 'HEAD', cache: 'no-store' })).ok; } catch (_) { /* offline */ }
          if (!exists) break;
          if (attempt === 2) report(id, e);
        }
      }
      missing.add(id);
    }));
    return ids.filter(id => modules.has(id));
  }
  // add a prefab module directly (tests, or a module imported elsewhere)
  function define(id, mod) { modules.set(id, mod); missing.delete(id); dropTemplates(id); }

  function register(asset) {
    if (!asset || !asset.code) return { ok: false, id: asset && asset.id, error: 'no code' };
    const id = asset.id || 'gen-' + hash(asset.code).toString(36);
    try {
      const make = compileAsset(asset.code, { name: asset.name || id });
      assets.set(id, { asset: Object.assign({}, asset, { id }), make }); dropTemplates(id);
      // build once now so a broken asset is caught here, not when it is placed
      template(id, 0);
      return { ok: true, id };
    } catch (e) { assets.delete(id); report(id, e); return { ok: false, id, error: e.message }; }
  }
  function dropTemplates(id) { for (const k of [...templates.keys()]) if (k.split('#')[0] === id) { I.unregister(templates.get(k)); templates.delete(k); } }

  function template(id, variant, quarter = 0) {
    const key = `${id}#${variant}@${quarter}`;
    if (templates.has(key)) return templates.get(key);
    api.seed(hash(`${id}#${variant}`) || 1);   // the same variant looks the same at every turn
    const turn = quarter * Math.PI / 2;
    let t;
    const a = assets.get(id), mod = modules.get(id);
    if (a) t = a.make(api, { turn });
    else {
      if (!mod) throw new AssetError(`${id}: no prefab or asset with this id`);
      let root;
      I.setVariant(variant);   // prefabs may ask api.variant() for a deliberate style per variant
      try { root = mod.build(api); } catch (e) { throw new AssetError(`${id}: build threw: ${e.message}`, e); }
      finally { I.setVariant(0); }
      t = normalise(api, root, { name: id, turn });
      const fp = mod.meta && mod.meta.footprint;
      if (fp && fp.w > 0 && fp.d > 0) refit(t, quarter % 2 ? { w: fp.d, d: fp.w } : fp, typeof mod.animate === 'function');
    }
    I.unregister(t);   // the template never renders; clones register themselves
    t.userData.agora = Object.assign(t.userData.agora || {}, { id, variant, generated: !!a });
    try { plans.set(t, planCompact(t, { keepNamed: !!(mod && typeof mod.animate === 'function') })); } catch (e) { report(id, e); }
    templates.set(key, t);
    return t;
  }

  // keep a prefab inside its catalogue footprint (sim/catalog.js): findSpot packs buildings by footprint, so a
  // tree or a porch hanging over would overlap the neighbour. Moving parts (sails, a crane's boom) don't count.
  // Only a gentle squeeze (>= 0.86) so doors keep their folk scale; bigger misses are fixed in the prefab.
  function refit(t, fp, animated) {
    const root = t.children[0]; if (!root) return;
    const ext = () => {
      t.updateMatrixWorld(true);
      const b = new THREE.Box3(), tmp = new THREE.Box3(), M = new THREE.Matrix4();
      const visit = o => {
        if (o.userData.agoraSpin || o.userData.agoraBob || (animated && o.name && o !== root)) return;
        if (o.isInstancedMesh) {   // the kit's leaf clumps: every instance counts
          const g = o.geometry; if (!g.boundingBox) g.computeBoundingBox();
          for (let i = 0; i < o.count; i++) { o.getMatrixAt(i, M); tmp.copy(g.boundingBox).applyMatrix4(M).applyMatrix4(o.matrixWorld); b.union(tmp); }
        } else if (o.isMesh && !o.userData.agoraLine && !o.userData.agoraSketch) { tmp.setFromObject(o); b.union(tmp); }
        o.children.forEach(visit);
      };
      visit(root); return b;
    };
    const b = ext(); if (b.isEmpty()) return;
    const w = b.max.x - b.min.x, d = b.max.z - b.min.z;
    if (w <= fp.w * 1.04 && d <= fp.d * 1.04) return;
    const k = Math.max(0.86, Math.min(fp.w / w, fp.d / d, 1));
    root.scale.multiplyScalar(k); root.position.multiplyScalar(k);
    const b2 = ext(), all = ext();
    root.position.x -= (b2.min.x + b2.max.x) / 2; root.position.z -= (b2.min.z + b2.max.z) / 2; root.position.y -= all.min.y;
    const s = new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3());
    t.userData.agora = Object.assign(t.userData.agora || {}, { size: { w: s.x, h: s.y, d: s.z }, refit: +k.toFixed(3) });
  }
  // a plain painted block + roof, sized to a footprint: what create() hands back when nothing else works
  function fallback(id, footprint = { w: 4, d: 4 }, massing = null) {
    const m = massing || { name: id, footprint, height: 3.4, parts: [
      { shape: 'box', x: 0, y: 1.1, z: 0, w: footprint.w * 0.8, h: 2.2, d: footprint.d * 0.7, color: '#efe4d2' },
      { shape: 'gable', x: 0, y: 2.7, z: 0, w: footprint.w * 0.8, h: 1.0, d: footprint.d * 0.7, color: '#cf6a3f' }] };
    return renderSketchFromMassing(api, m);
  }

  // rot: turn about y. Pass it here rather than rotating the object yourself: the template is baked at the nearest
  // quarter turn (so the painted light still comes from the upper left) and only the remainder goes on obj.rotation.y.
  // fit: { w, d [, h] } scales the object uniformly to fit that box (an object named for a drawn area); compact:
  // false hands back the full parts (they still work in a reveal either way)
  function create(what, { variant = 0, rot = 0, footprint = null, massing = null, fit = null, compact = true } = {}) {
    let id = typeof what === 'string' ? what : what && what.id;
    if (what && typeof what === 'object' && what.code && !assets.has(id)) id = register(what).id;
    const v = assets.has(id) ? 0 : Math.abs(Math.floor(variant)) % Math.max(1, variants);
    const q = ((Math.round((rot || 0) / (Math.PI / 2)) % 4) + 4) % 4, rest = (rot || 0) - Math.round((rot || 0) / (Math.PI / 2)) * Math.PI / 2;
    let obj, plan = null;
    try {
      const t = template(id, v, q);
      obj = t.clone(true); plan = plans.get(t) || null;
      obj.rotation.y = rest;
    } catch (e) {
      report(id, e);
      obj = fallback(id, footprint || (what && what.meta && what.meta.footprint) || undefined, massing);
      obj.rotation.y = rot || 0;
      obj.userData.agora = Object.assign(obj.userData.agora || {}, { id, fallback: true, error: e.message });
    }
    I.register(obj);
    obj.userData.agora = Object.assign({}, obj.userData.agora, { id });
    if (fit) scaleToFit(obj, fit);
    if (plan) { attachForms(obj, plan, ctx); if (compact && obj.agoraForm) obj.agoraForm('compact'); }
    live.add(obj);
    return obj;
  }

  function scaleToFit(obj, fit) {
    const s = obj.userData.agora.size; if (!s || !(s.w > 0) || !(s.d > 0)) return;
    const n = (v, d) => (typeof v === 'number' && isFinite(v) && v > 0 ? v : d);
    let k = Math.min(n(fit.w, Infinity) / s.w, n(fit.d, Infinity) / s.d, n(fit.h, Infinity) / Math.max(0.01, s.h || 1));
    if (!isFinite(k)) return;
    k = Math.max(0.2, Math.min(6, k * (fit.margin === undefined ? 0.92 : 1 - fit.margin)));
    obj.scale.multiplyScalar(k);
    obj.userData.agora.size = { w: s.w * k, h: (s.h || 0) * k, d: s.d * k };
    obj.userData.agora.fit = k;
  }
  function animate(obj, t) {
    const mod = modules.get(obj.userData.agora && obj.userData.agora.id);
    if (mod && typeof mod.animate === 'function') { try { mod.animate(obj, t); } catch (e) { /* a prefab's animation never breaks the frame */ } return; }
    obj.traverse(o => {
      const s = o.userData.agoraSpin;
      if (s) { const ax = s.axis === 'x' || s.axis === 'y' ? s.axis : 'z'; if (s.rest === undefined) s.rest = o.rotation[ax]; o.rotation[ax] = s.rest + s.speed * t; }
      const b = o.userData.agoraBob;
      if (b) { if (b.rest === undefined) b.rest = o.position.y; o.position.y = b.rest + Math.sin(t * b.speed * 2) * b.amp; }
    });
  }
  function update(t) { live.forEach(o => { if (!o.parent) return; animate(o, t); }); }
  function release(obj) {
    if (!obj) return;
    if (obj.parent) obj.parent.remove(obj);
    if (obj.agoraForms) obj.agoraForms.release();   // both forms: the detached parts are not in the tree
    I.unregister(obj); live.delete(obj);
  }
  // loaded prefab ids: the fixed catalogue first, then the manifest's order, then anything define()d by hand
  const ids = () => ALL_IDS.filter(id => modules.has(id)).concat([...modules.keys()].filter(id => !ALL_IDS.includes(id)));
  const assetIds = () => [...assets.keys()];
  // the manifest entry (name, aliases, category, stage, footprint, desc, water, area) without building anything
  const meta = id => META.get(id) || null;
  // ids grouped by category, in CATEGORY_ORDER (the gallery's grouping); unknown categories go last
  function byCategory(list = ids()) {
    const groups = new Map();
    for (const id of list) { const c = (META.get(id) || {}).category || 'building'; if (!groups.has(c)) groups.set(c, []); groups.get(c).push(id); }
    const order = c => { const i = CATEGORY_ORDER.indexOf(c); return i < 0 ? 99 : i; };
    return [...groups.entries()].sort((a, b) => order(a[0]) - order(b[0])).map(([category, ids]) => ({ category, ids }));
  }
  function info(id) {
    const m = Object.assign({}, META.get(id) || {}, (modules.get(id) || {}).meta || {});
    try { const t = template(id, 0); return Object.assign({ id }, m, t.userData.agora); }
    catch (e) { return META.has(id) ? Object.assign({ id, error: e.message }, m) : null; }
  }

  // plan + forms for an object made outside the library (fill.js areas, massing sketches)
  function compactable(obj, { compact = false } = {}) { attachForms(obj, planCompact(obj), ctx); if (compact && obj.agoraForm) obj.agoraForm('compact'); return obj; }
  return { api, compactable, load, define, has: id => modules.has(id) || assets.has(id), ids, assetIds, register, create, animate, update, release, info, meta, byCategory, manifest: MANIFEST, allIds: ALL_IDS, missing };
}
