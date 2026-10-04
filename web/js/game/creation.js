// Creation: the hero moment. Every building:site becomes a thing on the paper, drawn in pencil at once and washed in
// with gouache as the folk haul and hammer (sim progress), never slower than ~9 s so a spoken thing lands while the
// sentence is still in the air. Area / line kinds (a field, a forest, a road, a wall…) fill the mark's exact shape
// through buildings/fill.js. Unknown things get the Ministry of Builds: a massing sketch in pencil in seconds, the real
// object from codegen when it lands, and the sketch itself painted if codegen fails (it never fails visibly).
//
//   const creation = createCreation({ ctx, game, lib, api, world, fillers, marks, net, ui, stages, log });
//   creation.update(dt)        // every frame: the timed wash
//   creation.pending()         // codegens + sites still being drawn (the director's idle)

import { createSite } from '../buildings/construction.js';
import { createReveal } from '../buildings/reveal.js';
import { renderSketchFromMassing } from '../buildings/sketch.js';
import { SEA_Y } from '../world/ground.js';
import { LAKE_Y } from '../world/water.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const article = s => (/^(a|an|the)\s/i.test(s) ? s : (/^[aeiou]/i.test(s) ? 'an ' : 'a ') + s);

export function createCreation({ ctx, game, lib, api, world, fillers = null, marks = null, net, ui, stages = null, log = () => {}, focusCamera = true } = {}) {
  const { scene } = ctx;
  const entries = new Map();      // building id -> { b, obj, site, reveal, fill, t0, kind:'site'|'fill'|'sketch', done }
  const massings = new Map();     // asset id -> massing (so "another one" of a sketch-only thing still draws)
  const codegens = new Map();     // building id -> { abort }
  const PAINT_S = 7.5, SKETCH_S = 0.9;
  let notices = 0;

  const groundYOf = b => (b.floating ? (world.waterY ? world.waterY(b.x, b.z) : (b.z < game.state.plot.z0 ? SEA_Y : LAKE_Y)) : (world.siteY ? world.siteY(b) : world.groundY(b.x, b.z)));   // the plot is relief now: sit on the site pad
  const sizeOf = obj => { const s = obj && obj.userData.agora && obj.userData.agora.size; return s ? Math.max(s.w, s.d) : 5; };
  const shapeMark = b => b.shape && b.shape.poly ? { kind: 'area', poly: b.shape.poly } : b.shape && b.shape.pts ? { kind: 'line', pts: b.shape.pts } : { kind: 'point', x: b.x, z: b.z };
  // area / line kinds carry a polygon / polyline from the sim (the mark's exact shape, or a default rectangle / strip)
  const fillKind = k => (fillers && k ? (fillers.kinds || {})[String(k).toLowerCase()] || null : null);   // 'area' | 'line' | null
  const isFillKind = b => !!(fillKind(b.kind) && b.shape && (b.shape.poly || b.shape.pts) && !b.shape.fit);
  // on the planet (world.place, docs/game.md) things are stood on the sphere through the adapter; on the flat map they sit at the pad
  const place = (obj, b) => { if (world.place) { world.place(obj, b); return; } obj.position.set(b.x, groundYOf(b), b.z); scene.add(obj); };
  const addSite = o => { if (world.attach) world.attach(o); else scene.add(o); };
  const addFill = g => { if (world.placeFill) world.placeFill(g); else scene.add(g); };
  function focus(b, size = 6) {
    if (!focusCamera || (stages && stages.scene !== 'world') || world.rig.mode !== 'map') return;
    try { world.focus(b.x, b.z, { dist: clamp(size * 4.2 + 20, 28, 62), ms: 1600 }); } catch (_) {}
  }
  // Sueda: 'if I want a house I only want a house' — no automatic fields/trees/paths round new buildings (?bloom=1 brings it back)
  const BLOOM = /[?&]bloom=1/.test(location.search);
  const bloom = b => { if (!BLOOM) return; try { world.bloomBuilding(b); } catch (_) {} };

  // ---------- known kinds ----------
  function siteFor(b, obj) {
    const e = { b, obj, site: null, t0: performance.now(), kind: 'site', done: false, bloomed: false, simP: 0 };
    try { e.site = createSite(b, obj, { ctx, api, sketchSeconds: SKETCH_S, onBloom: null }); addSite(e.site.object); }
    catch (err) { log('site', err.message); e.reveal = createReveal(ctx, obj); e.reveal.hide(); e.reveal.sketch(SKETCH_S); }
    entries.set(b.id, e);
    return e;
  }
  function fillFor(b) {
    // the crop / mix words ride on the name or the request ("a lavender field", "an olive orchard")
    const words = `${b.name || ''} ${b.request || ''} ${b.noun || ''}`.toLowerCase();
    const crop = /lavender/.test(words) ? 'lavender' : /wheat|barley|corn/.test(words) ? 'wheat' : /vine|grape/.test(words) ? 'vines' : /veg|cabbage|allotment|kitchen/.test(words) ? 'veg' : /green|pasture|meadow/.test(words) ? 'green' : undefined;
    const g = fillers.make(b.kind, shapeMark(b), crop ? { crop } : {});
    if (!g) return null;
    addFill(g);
    const e = { b, obj: g, fill: fillers.reveal(g), t0: performance.now(), kind: 'fill', done: false, bloomed: false, simP: 0 };
    e.fill.hide(); e.fill.sketch(SKETCH_S);
    entries.set(b.id, e);
    return e;
  }
  function onSite(b) {
    if (entries.has(b.id)) return;
    if (!b.kind) return;                       // awaiting a design: building:needsDesign draws it
    let e = null;
    if (isFillKind(b)) { try { e = fillFor(b); } catch (err) { log('fill', err.message); } }
    if (!e) {
      const fit = b.shape && b.shape.fit ? { w: b.footprint.w, d: b.footprint.d } : null;
      const obj = lib.create(b.kind, { rot: b.rot || 0, variant: entries.size, footprint: b.footprint, massing: massings.get(b.kind) || null, fit });
      place(obj, b);
      e = siteFor(b, obj);
    }
    focus(b, Math.max(b.footprint.w, b.footprint.d));
    ui && ui.notice(`${b.name}: building starts here.`, { kind: 'ministry', ttl: 3500 });
  }

  // ---------- the wash: the sim's progress or the clock, whichever is further ----------
  function update() {
    const now = performance.now();
    entries.forEach(e => {
      if (e.done || e.kind === 'sketch') return;
      const timed = clamp((now - e.t0 - SKETCH_S * 1000) / (PAINT_S * 1000), 0, 0.92);
      const p = Math.max(e.simP, timed);
      if (p <= 0.02) return;
      if (e.kind === 'fill') e.fill.setPaint(p);
      else if (e.site) e.site.setProgress(p);
      else if (e.reveal) e.reveal.setPaint(p);
      if (!e.bloomed && p > 0.45) { e.bloomed = true; bloom(e.b); }
    });
  }
  function onProgress({ id, progress }) { const e = entries.get(id); if (e) e.simP = Math.max(e.simP, progress || 0); }
  async function onDone(b) {
    const e = entries.get(b.id);
    if (!e) return;
    if (e.done) return;
    e.done = true;
    try {
      if (e.kind === 'fill') { await e.fill.paint(0.8); e.fill.done(); }
      else if (e.site) { await e.site.finish(); }
      else if (e.reveal) { await e.reveal.paint(0.8); e.reveal.done(); }
    } catch (err) { log('done', err.message); }
    if (!e.bloomed) { e.bloomed = true; bloom(e.b); }
    if (stages) stages.syncGrowth();
  }
  function onRemove({ id }) {
    const e = entries.get(id); if (!e) return;
    entries.delete(id);
    try { e.site && e.site.dispose && e.site.dispose(); } catch (_) {}
    try { e.kind === 'fill' ? fillers.release(e.obj) : lib.release(e.obj); } catch (_) {}
  }

  // ---------- the unknown: Ministry of Builds ----------
  async function onNeedsDesign({ building: b, request, noun }) {
    if (codegens.has(b.id)) return;
    const label = (b.name || noun || request || 'it');
    const nid = ui ? ui.notice(`New design: ${(noun || request || label).toLowerCase()}. Drawing it now…`, { kind: 'ministry', progress: true, stage: 'drafting', sticky: true, id: 'mob-' + b.id }) : null;
    const e = { b, obj: null, reveal: null, t0: performance.now(), kind: 'sketch', done: false, bloomed: false, simP: 0, sketch: null };
    entries.set(b.id, e);
    focus(b, 7);
    let settled = false;
    const placeSketch = m => {
      if (settled || e.obj) return;
      try {
        const sk = renderSketchFromMassing(api, m); place(sk, b);
        e.sketch = sk; e.massing = m; e.reveal = createReveal(ctx, sk); e.reveal.hide(); e.reveal.sketch(0.9);
      } catch (err) { log('sketch', err.message); }
    };
    const snapshot = () => Object.assign(game.snapshot(), { scene: game.state.scene });
    const c = net.create({ request: request || b.request || label, kindHint: null, snapshot: snapshot() }, {
      onSketch: m => placeSketch(m),
      onStatus: s => { if (nid && ui) ui.updateNotice(nid, { stage: s.note || s.stage || 'drawing', progress: true }); },
      onDone: () => {}, onError: () => {}
    });
    codegens.set(b.id, c);
    let asset = null;
    try { asset = await c.done; } catch (err) { log('codegen', err.message); asset = null; }
    codegens.delete(b.id);
    settled = true;
    let reg = null;
    if (asset && asset.code) { reg = lib.register(asset); if (!reg.ok) { log('register failed', reg.error); reg = null; } }
    if (reg) {
      if (nid && ui) ui.updateNotice(nid, { text: `Ready to build: ${(asset.name || label).toLowerCase()}.`, progress: 1, stage: '', ttl: 5000 });
      game.designArrived(b.id, asset);          // -> building:design (and the sim completes it if the crew is done)
    } else {
      // never fail visibly: the massing sketch is the design. The sim learns it as a kind too, so "another one" works.
      if (!e.sketch) placeSketch(e.massing || fallbackMassing(b));
      const id = 'sketch-' + (b.requestKind || 'thing') + '-' + Math.abs(hash(label)).toString(36);
      massings.set(id, e.massing || fallbackMassing(b));
      if (nid && ui) ui.updateNotice(nid, { text: `${label}: built from the sketch.`, progress: 1, stage: '', ttl: 5000 });
      game.designArrived(b.id, { id, name: b.name || label, aliases: [], meta: { category: b.category, footprint: b.footprint, water: !!b.floating } });
    }
  }
  function fallbackMassing(b) {
    const fp = b.footprint || { w: 4, d: 4 };
    return { name: b.name, footprint: fp, height: 3.4, parts: [{ shape: 'box', x: 0, y: 1.2, z: 0, w: fp.w * 0.8, h: 2.4, d: fp.d * 0.7, color: '#efe4d2' }, { shape: 'gable', x: 0, y: 2.9, z: 0, w: fp.w * 0.8, h: 1.0, d: fp.d * 0.7, color: '#cf6a3f' }] };
  }
  // the sim adopted the design: swap the pencil sketch for the real object (or keep the sketch if it IS the design)
  function onDesign({ building: b, asset }) {
    const e = entries.get(b.id);
    if (!e) { entries.delete(b.id); onSite(b); return; }
    if (e.kind !== 'sketch') return;
    const massing = massings.get(asset && asset.id) || null;
    let obj = null;
    if (!massing && asset && lib.has(asset.id)) { try { obj = lib.create(asset.id, { rot: b.rot || 0 }); } catch (err) { log('create', err.message); } }
    if (obj) {
      if (e.sketch) { try { e.reveal && e.reveal.stop(); e.sketch.removeFromParent(); } catch (_) {} e.sketch = null; e.reveal = null; }
      place(obj, b);
      e.obj = obj; e.kind = 'site'; e.t0 = performance.now();
      try { e.site = createSite(b, obj, { ctx, api, sketchSeconds: 0.6 }); addSite(e.site.object); }
      catch (err) { e.reveal = createReveal(ctx, obj); e.reveal.hide(); e.reveal.sketch(0.6); }
    } else {
      // paint the sketch itself: it is in the scene already, drawn in pencil
      if (!e.sketch) { const sk = renderSketchFromMassing(api, massing || fallbackMassing(b)); place(sk, b); e.sketch = sk; e.reveal = createReveal(ctx, sk); e.reveal.hide(); e.reveal.setSketch(1); }
      e.obj = e.sketch; e.kind = 'reveal'; e.t0 = performance.now() - 600;
    }
    if (b.status === 'done') onDone(b);
  }

  game.on('building:site', ({ building }) => { try { onSite(building); } catch (e) { console.error('[creation] site', e); } });
  game.on('building:progress', e => onProgress(e));
  game.on('building:done', ({ building }) => { onDone(building).catch(e => console.error('[creation] done', e)); });
  game.on('building:needsDesign', e => { try { if (world.levelBuilding && e.building) world.levelBuilding(e.building); } catch {} onNeedsDesign(e).catch(err => console.error('[creation] design', err)); });
  game.on('building:design', e => { try { onDesign(e); } catch (err) { console.error('[creation] design', err); } });
  game.on('building:remove', e => onRemove(e));

  // finished buildings already in the state at wiring time (a reload, a lab): paint at once
  for (const b of game.state.buildings) if (b.status === 'done' && b.kind && !entries.has(b.id)) {
    try { let obj; if (isFillKind(b)) { obj = fillers.make(b.kind, shapeMark(b)); addFill(obj); } else { obj = lib.create(b.kind, { rot: b.rot || 0 }); place(obj, b); }
      entries.set(b.id, { b, obj, kind: 'static', done: true, bloomed: true, simP: 1 }); } catch (_) {}
  }

  return {
    update, entries, massings,
    pending: () => codegens.size + [...entries.values()].filter(e => !e.done && e.kind !== 'static' && performance.now() - e.t0 < 4500).length,
    busy: () => codegens.size > 0,
    objectOf: id => { const e = entries.get(id); return e ? e.obj : null; },
    dispose() { codegens.forEach(c => { try { c.abort(); } catch (_) {} }); [...entries.keys()].forEach(id => onRemove({ id })); }
  };
}

function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h | 0; }
