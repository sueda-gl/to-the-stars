// Construction sites: stakes and a chalk outline on the footprint, scaffold poles round it, a stack of crates
// beside it; the building itself is drawn in pencil at once and the paint climbs with the work.
//
//   const site = createSite(building, group, { ctx, api });   // group: the placed building (library.create)
//   scene.add(site.object);                                     // the site props, placed like the building
//   site.setProgress(p);      // 0..1 from building:progress — the wash rises, crates get used up
//   await site.finish();      // paint completes, scaffold sinks away, the building settles; site.object is removed
//   site.reset()              // back to stakes + pencil (galleries / replays)
// The building's size comes from its userData.agora.size (already scaled when lib.create had a fit).
// building: the sim record ({ kind, footprint:{w,d}, ... }) or null; the footprint falls back to the group's size.
import { createReveal } from './reveal.js';
import { internals } from './api.js';

export function createSite(building, group, { ctx, api, sketchSeconds = 0.9, onBloom = null, onPaint = null, autoSketch = true } = {}) {
  if (!ctx || !api) throw new Error('createSite(building, group, { ctx, api })');
  const I = internals(api), R = api.ramps;
  const size = (group.userData.agora && group.userData.agora.size) || {};
  const fp = (building && building.footprint) || {};
  const w = Math.max(1.5, size.w || fp.w || 4), d = Math.max(1.5, size.d || fp.d || 4), h = Math.max(1.5, size.h || 4);

  const object = new THREE.Group(); object.name = 'site';
  object.position.copy(group.position); object.quaternion.copy(group.quaternion);
  const reveal = createReveal(ctx, group, { onBloom, onPaint });

  // ---------- stakes + chalk outline ----------
  const hx = w / 2 + 0.25, hz = d / 2 + 0.25;
  const corners = [[-hx, -hz], [hx, -hz], [hx, hz], [-hx, hz]];
  const stakes = api.group();
  corners.forEach(([x, z]) => stakes.add(api.box({ w: 0.08, h: 0.55, d: 0.08, x, y: 0.27, z, ramp: R.WOOD })));
  for (let i = 0; i < 4; i++) {   // the string, and a chalk line on the paper under it
    const [x0, z0] = corners[i], [x1, z1] = corners[(i + 1) % 4], len = Math.hypot(x1 - x0, z1 - z0), rot = Math.atan2(x1 - x0, z1 - z0);
    stakes.add(api.colourOnly(api.box({ w: 0.025, h: 0.025, d: len, x: (x0 + x1) / 2, y: 0.42, z: (z0 + z1) / 2, rot, ramp: R.IRON })));
    stakes.add(api.colourOnly(api.box({ w: 0.09, h: 0.012, d: len, x: (x0 + x1) / 2, y: 0.006, z: (z0 + z1) / 2, rot, ramp: R.SAND })));
  }
  object.add(stakes);

  // ---------- scaffold: a light frame, not a cage (few big shapes): corner poles (+ one mid pole on a long side),
  // one ring of ledgers at two thirds of the height, one walking plank across the front ----------
  const scaffold = api.group(), sh = h + 0.4, sx = w / 2 + 0.5, sz = d / 2 + 0.5;
  const poles = [[-sx, -sz], [sx, -sz], [sx, sz], [-sx, sz]];
  if (w > 6.5) poles.push([0, sz], [0, -sz]);
  if (d > 6.5) poles.push([sx, 0], [-sx, 0]);
  poles.forEach(([x, z]) => scaffold.add(api.cylinder({ r: 0.06, h: sh, x, y: sh / 2, z, ramp: R.WOOD, lift: 0.12, seg: 6 })));
  const ly = Math.min(sh - 0.2, Math.max(1.4, sh * 0.62));
  scaffold.add(api.box({ w: 2 * sx + 0.24, h: 0.08, d: 0.08, y: ly, z: sz, ramp: R.WOOD, lift: 0.12 }));
  scaffold.add(api.box({ w: 2 * sx + 0.24, h: 0.08, d: 0.08, y: ly, z: -sz, ramp: R.WOOD, lift: 0.12 }));
  scaffold.add(api.box({ w: 0.08, h: 0.08, d: 2 * sz + 0.24, x: sx, y: ly, ramp: R.WOOD }));
  scaffold.add(api.box({ w: 0.08, h: 0.08, d: 2 * sz + 0.24, x: -sx, y: ly, ramp: R.WOOD }));
  scaffold.add(api.box({ w: 2 * sx - 0.1, h: 0.06, d: 0.46, y: ly + 0.07, z: sz + 0.05, ramp: R.SAND }));   // the walking plank
  object.add(scaffold);

  // ---------- crates (and a stone or two) by the front-right corner ----------
  const pile = api.group({ x: sx + 1.2, z: sz - 0.4 }), crates = [];
  [[0, 0, 0, 0.62, 0.2], [0.7, 0, 0.12, 0.56, -0.3], [0.32, 0.62, 0.05, 0.52, 0.5], [-0.1, 0, 0.78, 0.5, 0.9], [0.78, 0, 0.82, 0.46, 0.1]].forEach(([x, y, z, s, rot]) => {
    const c = api.crate({ s, x, y, z, rot }); crates.push(c); pile.add(c);
  });
  pile.add(api.box({ w: 0.7, h: 0.32, d: 0.5, x: -0.75, y: 0.16, z: 0.1, rot: 0.3, ramp: R.LIMESTONE }));
  object.add(pile);

  I.finish(object);
  const settleFrom = group.scale.clone();
  let finished = false, p = 0;

  function setProgress(v) {
    p = Math.max(0, Math.min(1, v));
    if (p <= 0.02) { if (reveal.state !== 'sketch') reveal.setSketch(1); }
    else reveal.setPaint((p - 0.02) / 0.98);
    crates.forEach((c, i) => { c.visible = p < 1 - (i + 1) / (crates.length + 1) * 0.92; });
  }
  function reset() {
    finished = false; object.visible = true; group.scale.copy(settleFrom);
    scaffold.scale.set(1, 1, 1); scaffold.position.y = 0; stakes.visible = true; crates.forEach(c => { c.visible = true; });
    if (!object.parent && reset.parent) reset.parent.add(object);
    reveal.hide(); if (autoSketch) reveal.sketch(sketchSeconds);
  }
  function finish() {
    if (finished) return Promise.resolve();
    finished = true; reveal.done();
    crates.forEach(c => { c.visible = false; });
    reset.parent = object.parent;
    return new Promise(res => {
      const t0 = performance.now(), dur = ctx.reduceMotion ? 300 : 900;
      const tick = now => {
        const k = Math.min(1, (now - t0) / dur), e = k * k;
        scaffold.scale.y = Math.max(0.001, 1 - e); scaffold.position.y = -0.2 * e;              // the scaffold sinks away
        stakes.visible = k < 0.5;
        const s = 1 + Math.sin(Math.min(1, k * 1.6) * Math.PI) * 0.035 * (1 - k);               // a little settle
        group.scale.set(settleFrom.x * (1 + (s - 1) * -0.5), settleFrom.y * (2 - s), settleFrom.z * (1 + (s - 1) * -0.5));
        if (k < 1) requestAnimationFrame(tick);
        else { group.scale.copy(settleFrom); if (object.parent) object.parent.remove(object); res(); }
      };
      requestAnimationFrame(tick);
    });
  }
  function dispose() { if (object.parent) object.parent.remove(object); I.unregister(object); }

  if (autoSketch) { reveal.hide(); reveal.sketch(sketchSeconds); }
  return { object, reveal, setProgress, finish, reset, dispose, get progress() { return p; } };
}
