// Fillers: the things that take the SHAPE of a pencil mark (ART_DIRECTION §5, ARCHITECTURE §10).
//   areas   field · forest · orchard · garden · plaza · vineyard        fill exactly the drawn outline
//   strokes road · wall · fence · hedge · river · canal                  follow exactly the drawn line
// Every filler takes WORLD points ([x, z] pairs or {x, z}), drapes over the terrain when the world gives
// heightAt(x, z), and returns a THREE.Group placed at the mark's centroid (y = the ground there), painted in the
// Red arch grammar (painted vertex light, a pencil outline from a skirt or the object's own sides, trees from
// api.tree), registered in ctx.lineOnly / ctx.colourOnly, and ready for the reveal (pencil, then paint). The group
// comes back in its COMPACT form (one mesh per material); createReveal switches it to parts while it paints.
//
//   const fill = createFillers(ctx, kit, api, { heightAt: world.groundY });
//   const obj = fill.make('forest', mark);        // mark: marks.current() ({kind:'area', poly} | {kind:'line', pts})
//   scene.add(obj); const r = createReveal(ctx, obj); r.hide(); await r.sketch(1); await r.paint(4); r.done();
//   fill.field(poly, { crop: 'wheat' | 'green' | 'lavender' | 'mixed' }) · fill.forest(poly, { density, mix })
//   fill.road(pts, { width }) · fill.wall(pts, { h }) · fill.river(pts, { width }) ...
//   fill.frame(mark) -> { x, z, rot, w, d }       // where a SINGLE object named for an area goes (lib.create fit)
//   fill.release(obj)                             // remove + unregister (both forms)
// Mixed marks work too: an area kind on a stroke fills a band along it; a stroke kind on an area runs round it.
//
// Also answers the marks lab's contract: createFillers(ctx, kit, api, { groundY, library, avoid, trees }) with
// fill(kind, mark, o) (= make), reveal(obj) (= createReveal(ctx, obj)) and release(obj).
import { internals } from './api.js';
import * as S from './shapes.js';
import { planCompact, attachForms } from './compact.js';
import { createReveal } from './reveal.js';

const FLAT = new Set(['path', 'kerb', 'patch', 'band', 'fieldEdge', 'hedge', 'vines']);
// which kinds fill an area, which follow a line (and the aliases the sim / LLM may use)
export const FILL_KINDS = Object.freeze({
  field: 'area', fields: 'area', crops: 'area', farmland: 'area', meadow: 'area', pasture: 'area', farm: 'area', wheat: 'area', lavender: 'area',
  forest: 'area', woods: 'area', wood: 'area', woodland: 'area', grove: 'area', orchard: 'area',
  garden: 'area', park: 'area', plaza: 'area', square: 'area', piazza: 'area', courtyard: 'area', district: 'area', vineyard: 'area', vines: 'area',
  road: 'line', path: 'line', street: 'line', lane: 'line', track: 'line',
  wall: 'line', walls: 'line', rampart: 'line', fence: 'line', palisade: 'line', hedge: 'line',
  river: 'line', stream: 'line', brook: 'line', canal: 'line', channel: 'line'
});
const CANON = { fields: 'field', crops: 'field', farmland: 'field', meadow: 'field', pasture: 'field', farm: 'field', wheat: 'field', lavender: 'field',
  woods: 'forest', wood: 'forest', woodland: 'forest', grove: 'forest', park: 'garden', square: 'plaza', piazza: 'plaza', courtyard: 'plaza', district: 'plaza',
  vines: 'vineyard', path: 'road', street: 'road', lane: 'road', track: 'road', walls: 'wall', rampart: 'wall', palisade: 'fence',
  stream: 'river', brook: 'river', channel: 'canal' };

// painted ramps (dark -> light; a flat top takes the LAST stop, so that is the colour seen from above): mid values
const CROPS = {
  wheat: ['#6f5418', '#94722a', '#b48e3a', '#c9a246', '#d4ad4e'],
  barley: ['#75611f', '#9a8233', '#b99c46', '#cbb057', '#d6bd63'],
  green: ['#3c4a1b', '#58692a', '#728538', '#8a9a46', '#97a64f'],
  deep: ['#2b3a19', '#3f5323', '#55692d', '#647a36', '#6f863f'],
  lavender: ['#40355a', '#5d4f80', '#7a6b9d', '#8d7eae', '#9787b6'],
  earth: ['#5c3f26', '#7a5434', '#93683f', '#a4774a', '#b08353']
};
const LAWN = ['#4a5426', '#667233', '#828d42', '#97a04f', '#a3ab58'];   // a dry Mediterranean lawn: lighter than the trees on it
const FLOOR = ['#2f3a1c', '#414f25', '#54632f', '#617136', '#6b7c3c'];      // the forest floor: one dark green mass
const PAVING = ['#6f5a44', '#8e765b', '#a98f70', '#b69c7b', '#c0a683'];     // warm limestone flags, a clear step darker than the paper
const GRAVEL = ['#7a6447', '#977e5c', '#b19670', '#bea37c', '#c7ad86'];
const WATER = ['#173f56', '#1f5670', '#2a6f86', '#33809a', '#3d8ea6'];     // ultramarine-teal, deeper than the sea's top
const BANK = ['#6f5a3e', '#8d7553', '#a88d66', '#b69b72', '#c0a57b'];
const HEDGE = ['#253117', '#37481f', '#4b5f29', '#5b7032', '#667d38'];
const VINE = ['#2f3d17', '#46591f', '#5f7529', '#728a33', '#7f973b'];
const BLOOMS = ['PINK', 'RED', 'LAVENDER', 'YELLOW'];

export function createFillers(ctx, kit, api, { heightAt = null, groundY = null, seed = 3, lib = null, library = null, avoid = null } = {}) {
  const I = internals(api), R = api.ramps;
  heightAt = heightAt || groundY; lib = lib || library;
  const blocked = (F, p) => !!(avoid && avoid(p.x + F.c.x, p.z + F.c.z));   // e.g. world.isWater: no trees in the lake
  let rnd = ctx.mulberry32(seed);
  const rand = () => rnd(), range = (a, b) => a + (b - a) * rnd(), pickOf = a => a[Math.floor(rnd() * a.length)];

  // ---------- frame every filler the same way ----------
  function begin(points, kind) {
    let pts = S.toPts(points);
    if (pts.length > 2 && kind === 'area') { const a = pts[0], b = pts[pts.length - 1]; if (Math.hypot(a.x - b.x, a.z - b.z) < 0.05) pts = pts.slice(0, -1); }
    const c = kind === 'area' && pts.length >= 3 ? S.centroid(pts) : (() => { const b = S.bbox(pts); return { x: (b.x0 + b.x1) / 2, z: (b.z0 + b.z1) / 2 }; })();
    const base = heightAt ? heightAt(c.x, c.z) : 0;
    const local = pts.map(p => ({ x: p.x - c.x, z: p.z - c.z }));
    const H = heightAt ? (x, z) => heightAt(x + c.x, z + c.z) - base : () => 0;   // local ground height
    const dr = { heightAt: heightAt ? (x, z) => heightAt(x + c.x, z + c.z) : null, base };
    return { pts: local, world: pts, c, base, H, dr, root: api.group() };
  }
  function end(F, kind, extra = {}) {
    const wrap = new THREE.Group(); wrap.name = 'fill-' + kind;
    wrap.position.set(F.c.x, F.base, F.c.z); wrap.add(F.root);
    I.finish(wrap);
    // the flat parts lie on the ground (draped): all of them get the depth nudge (api.js hugGround)
    const LAYER = { patch: 0.05, fieldEdge: 0.1, band: 0.1, path: 0.12, kerb: 0.16, hedge: 0.3, vines: 0.3 };
    wrap.traverse(o => { const part = o.userData.agora && o.userData.agora.part; if (o.isMesh && !o.userData.agoraLine && FLAT.has(part)) o.material = I.hugMat(o.material, LAYER[part]); });
    wrap.updateMatrixWorld(true);
    const box = new THREE.Box3(); F.root.traverse(o => { if (o.isMesh && !o.userData.agoraLine && !o.userData.agoraSketch) box.expandByObject(o); });
    const s = box.isEmpty() ? new THREE.Vector3() : box.getSize(new THREE.Vector3());
    wrap.userData.agora = Object.assign({ part: 'fill', id: kind, kind, fill: true, size: { w: s.x, h: s.y, d: s.z }, centroid: { x: F.c.x, z: F.c.z } }, extra);
    try { attachForms(wrap, planCompact(wrap), ctx); if (wrap.agoraForm) wrap.agoraForm('compact'); } catch (e) { console.warn('[fill] compact', e); }
    return wrap;
  }
  const closedLine = pts => pts.concat([pts[0]]);
  const areaOf = pts => Math.abs(S.area(pts));

  // ================= areas =================
  // field: crop bands across the long axis (mb 4), clipped to the outline, with an earth edge
  function field(poly, { crop = 'mixed', width } = {}) {
    const F = begin(poly, 'area'), A = areaOf(F.pts);
    const bands = crop === 'wheat' ? [CROPS.wheat, CROPS.barley] : crop === 'green' || crop === 'vegetables' || crop === 'veg' ? [CROPS.green, CROPS.deep]
      : crop === 'lavender' ? [CROPS.lavender, CROPS.green] : [CROPS.wheat, CROPS.green, CROPS.barley, CROPS.deep];
    const bw = width || Math.max(1.8, Math.min(4.5, Math.sqrt(A) / 4.2));
    F.root.add(api.stripes({ points: F.pts.map(p => [p.x, p.z]), bands, width: bw, h: 0.08, edge: CROPS.earth, ...F.dr }));
    return end(F, 'field', { area: A, crop });
  }
  // forest: trees scattered inside the outline over a dark forest floor (one green mass from above)
  function forest(poly, { density = 1, mix = null, floor = true, max = 70 } = {}) {
    const F = begin(poly, 'area'), A = areaOf(F.pts);
    if (floor) F.root.add(api.patch({ points: F.pts.map(p => [p.x, p.z]), h: 0.05, ramp: FLOOR, speck: 0.3, ...F.dr }));
    const m = Object.assign({ pine: 4, oak: 2, olive: 2, cypress: 1 }, mix || {}), kinds = Object.keys(m).filter(k => m[k] > 0), tot = kinds.reduce((a, k) => a + m[k], 0);   // every tree type, mixed
    const kindOf = () => { let x = rand() * tot; for (const k of kinds) { x -= m[k]; if (x <= 0) return k; } return kinds[0]; };
    const spacing = 3.3 / Math.sqrt(Math.max(0.2, density));
    const spots = S.scatter(F.pts, spacing, rand, { margin: Math.min(0.9, Math.sqrt(A) * 0.08), max });
    spots.forEach(p => {
      if (blocked(F, p)) return;
      const k = kindOf(), y = F.H(p.x, p.z);
      // kind 'cypress' is the painted one (docs/trees.md: ~20x lighter than the kit's api.cypress, same painter)
      F.root.add(api.tree({ kind: k, h: k === 'pine' ? range(5.2, 7.5) : k === 'cypress' ? range(4.5, 6.5) : k === 'oak' ? range(3.8, 5.4) : range(2.4, 3.2), x: p.x, y, z: p.z, rot: range(0, 6.28) }));
    });
    return end(F, 'forest', { area: A, trees: spots.length });
  }
  // orchard: trees in rows along the long axis, on grass
  function orchard(poly, { kind = 'lemon', spacing = 3.2 } = {}) {
    const F = begin(poly, 'area'), A = areaOf(F.pts), fr = S.frame(F.pts);
    F.root.add(api.patch({ points: F.pts.map(p => [p.x, p.z]), h: 0.05, ramp: LAWN, speck: 0.28, ...F.dr }));
    const ux = Math.cos(fr.angle), uz = Math.sin(fr.angle), vx = -uz, vz = ux;
    let n = 0;
    for (let b = -fr.d / 2 + spacing / 2; b < fr.d / 2 && n < 70; b += spacing) {
      const ox = fr.x + vx * b, oz = fr.z + vz * b;
      S.chord(F.pts, ox, oz, ux, uz).forEach(([t0, t1]) => {
        for (let t = t0 + spacing * 0.5; t <= t1 - spacing * 0.35 && n < 70; t += spacing) {
          const x = ox + ux * t, z = oz + uz * t;
          if (S.edgeDist(F.pts, { x, z }) < 0.7 || blocked(F, { x, z })) continue;
          F.root.add(api.tree({ kind: kind === 'mixed' ? pickOf(['lemon', 'orange', 'olive']) : kind, s: range(1.25, 1.45), x, y: F.H(x, z), z, rot: range(0, 6.28) })); n++;
        }
      });
    }
    return end(F, 'orchard', { area: A, trees: n });
  }
  // garden: a lawn inside a clipped hedge, gravel paths crossing on the long axes, flower beds, cypresses at corners
  function garden(poly) {
    const F = begin(poly, 'area'), A = areaOf(F.pts), fr = S.frame(F.pts), P = F.pts.map(p => [p.x, p.z]);
    F.root.add(api.patch({ points: P, h: 0.06, ramp: LAWN, speck: 0.26, ...F.dr }));
    const ring = S.inset(F.pts, 0.45);
    F.root.add(hedgeGeo(closedLine(ring), 0.55, 0.62, F));
    const ux = Math.cos(fr.angle), uz = Math.sin(fr.angle), cx = fr.x, cz = fr.z;
    const walk = (dx, dz) => S.chord(F.pts, cx, cz, dx, dz).forEach(([t0, t1]) => {
      const a = t0 + 0.9, b = t1 - 0.9; if (b - a < 1) return;
      F.root.add(api.path({ points: [[cx + dx * a, cz + dz * a], [cx + dx * b, cz + dz * b]], width: Math.min(1.4, Math.sqrt(A) * 0.12 + 0.6), h: 0.1, ramp: GRAVEL, kerb: false, smooth: false, ...F.dr }));
    });
    walk(ux, uz); if (fr.d > 5) walk(-uz, ux);
    // flower beds in the quarters, as low painted mounds
    const beds = S.scatter(S.inset(F.pts, 1.4), Math.max(1.8, Math.sqrt(A) / 3), rand, { max: 8 });
    beds.forEach(p => {
      if (Math.abs((p.x - cx) * -uz + (p.z - cz) * ux) < 0.9 || Math.abs((p.x - cx) * ux + (p.z - cz) * uz) < 0.9) return;   // keep off the paths
      F.root.add(api.shrub({ r: range(0.55, 0.85), h: range(0.4, 0.6), x: p.x, y: F.H(p.x, p.z) + 0.05, z: p.z, ramp: R[pickOf(BLOOMS)], speck: 0.32 }));
    });
    // cypresses at up to four corners (the sharpest turns of the outline)
    const corners = F.pts.map((p, i) => { const a = F.pts[(i - 1 + F.pts.length) % F.pts.length], b = F.pts[(i + 1) % F.pts.length]; const t1 = Math.atan2(p.z - a.z, p.x - a.x), t2 = Math.atan2(b.z - p.z, b.x - p.x); let d = Math.abs(t2 - t1); if (d > Math.PI) d = 2 * Math.PI - d; return { i, d }; })
      .sort((a, b) => b.d - a.d).slice(0, Math.min(4, Math.max(2, Math.round(Math.sqrt(A) / 3))));
    const inner = S.inset(F.pts, 1.0);
    corners.forEach(({ i }) => { const p = inner[i]; if (p && S.inside(F.pts, p.x, p.z)) F.root.add(api.cypress({ h: range(3.6, 4.6), x: p.x, y: F.H(p.x, p.z), z: p.z })); });
    return end(F, 'garden', { area: A });
  }
  // plaza: warm limestone paving with a darker kerb all round, a terracotta inlay ring, trees in the corners
  function plaza(poly) {
    const F = begin(poly, 'area'), A = areaOf(F.pts), P = F.pts.map(p => [p.x, p.z]);
    F.root.add(api.patch({ points: P, h: 0.14, ramp: PAVING, speck: 0.22, ...F.dr }));
    F.root.add(api.colourOnly(api.path({ points: closedLine(S.inset(F.pts, 0.22)).map(p => [p.x, p.z]), width: 0.4, h: 0.17, ramp: R.LIMESTONE, kerb: false, smooth: false, ...F.dr })));
    const fr = S.frame(F.pts), r = Math.min(fr.w, fr.d) * 0.24;
    if (A > 30 && r > 1) {   // an inlay: a terracotta ring round a pale centre
      const ringPts = []; for (let i = 0; i <= 32; i++) { const a = i / 32 * Math.PI * 2; ringPts.push([fr.x + Math.cos(a) * r, fr.z + Math.sin(a) * r]); }
      F.root.add(api.colourOnly(api.path({ points: ringPts, width: Math.min(0.7, r * 0.25), h: 0.16, ramp: R.TERRACOTTA, kerb: false, smooth: false, ...F.dr })));
    }
    if (A > 24) {
      const inner = S.inset(F.pts, Math.min(2.2, Math.sqrt(A) * 0.14));
      const n = Math.min(4, Math.round(Math.sqrt(A) / 3.5));
      inner.map((p, i) => ({ p, i })).sort(() => rand() - 0.5).slice(0, n).forEach(({ p }) => {
        if (S.inside(F.pts, p.x, p.z)) F.root.add(api.tree({ kind: pickOf(['lemon', 'oak', 'olive']), s: 0.9, x: p.x, y: F.H(p.x, p.z) + 0.14, z: p.z, rot: range(0, 6.28) }));
      });
    }
    return end(F, 'plaza', { area: A });
  }
  // vineyard: earth with rows of vines along the long axis (each row a low green hedge on posts)
  function vineyard(poly, { spacing = 1.8 } = {}) {
    const F = begin(poly, 'area'), A = areaOf(F.pts), fr = S.frame(F.pts);
    F.root.add(api.patch({ points: F.pts.map(p => [p.x, p.z]), h: 0.05, ramp: CROPS.earth, speck: 0.3, ...F.dr }));
    const ux = Math.cos(fr.angle), uz = Math.sin(fr.angle), vx = -uz, vz = ux, rows = [], posts = [];
    for (let b = -fr.d / 2 + spacing / 2; b < fr.d / 2 && rows.length < 40; b += spacing) {
      const ox = fr.x + vx * b, oz = fr.z + vz * b;
      S.chord(F.pts, ox, oz, ux, uz).forEach(([t0, t1]) => {
        const a = t0 + 0.5, e = t1 - 0.5; if (e - a < 1) return;
        const line = [{ x: ox + ux * a, z: oz + uz * a }, { x: ox + ux * e, z: oz + uz * e }];
        rows.push(S.ribbonGeo(line, 0.5, { y: 0.95, h: 0.62, step: 2, heightAt: F.dr.heightAt, base: F.dr.base }));
        [a, e].forEach(t => { const x = ox + ux * t, z = oz + uz * t, y = F.H(x, z); const g = new THREE.BoxGeometry(0.12, 1.1, 0.12); g.translate(x, y + 0.55, z); posts.push(g); });
      });
    }
    if (rows.length) { const m = api.paint(S.mergeGeos(rows), VINE, { speck: 0.34 }); m.userData.agora.part = 'vines'; F.root.add(m); }
    if (posts.length) { const m = api.paint(S.mergeGeos(posts), R.WOOD, { speck: 0.1 }); api.colourOnly(m); F.root.add(m); }
    return end(F, 'vineyard', { area: A, rows: rows.length });
  }

  // ================= strokes =================
  function road(pts, { width = 2.4 } = {}) {
    const F = begin(pts, 'line');
    F.root.add(api.path({ points: F.pts.map(p => [p.x, p.z]), width, h: 0.12, ...F.dr }));
    return end(F, 'road', { length: S.length(F.world) });
  }
  function wall(pts, { h = 2.4, d = 0.7, merlons = true, towers = true, red = false } = {}) {
    const F = begin(pts, 'line'), L = S.length(F.world);
    const P = F.pts.map(p => [p.x, p.z]);
    F.root.add(api.wall({ points: P, h, d, merlons, mat: api.lambert(red ? '#c23a2c' : '#e3d2b4', red ? 0.12 : 0.2), ...F.dr }));
    if (towers && L > 9) {   // square towers at the ends (and at sharp corners): the few big shapes that read from above
      const ends = [F.pts[0], F.pts[F.pts.length - 1]];
      for (let i = 1; i < F.pts.length - 1; i++) { const a = F.pts[i - 1], p = F.pts[i], b = F.pts[i + 1]; const t1 = Math.atan2(p.z - a.z, p.x - a.x), t2 = Math.atan2(b.z - p.z, b.x - p.x); let dd = Math.abs(t2 - t1); if (dd > Math.PI) dd = 2 * Math.PI - dd; if (dd > 0.7) ends.push(p); }
      ends.slice(0, 6).forEach(p => {
        const y = F.H(p.x, p.z), th = h + 1.3, tw = d * 2.4;
        F.root.add(api.box({ w: tw, h: th + 0.6, d: tw, x: p.x, y: y + th / 2 - 0.3, z: p.z, mat: api.lambert(red ? '#c23a2c' : '#e3d2b4', red ? 0.12 : 0.2) }));
        F.root.add(api.hipRoof({ w: tw, d: tw, h: tw * 0.55, overhang: 0.18, x: p.x, y: y + th, z: p.z, ramp: R.TERRACOTTA }));
      });
    }
    return end(F, 'wall', { length: L });
  }
  // fence: posts and two rails, following the ground (one painted mesh; a thin sheet draws its pencil line)
  function fence(pts, { h = 1.1, gap = 1.6 } = {}) {
    const F = begin(pts, 'line'), line = S.resample(F.pts, gap), posts = [], rails = [];
    line.forEach(p => { const y = F.H(p.x, p.z), g = new THREE.BoxGeometry(0.18, h, 0.18); g.translate(p.x, y + h / 2, p.z); posts.push(g); });
    [0.42, 0.82].forEach(f => rails.push(S.ribbonGeo(line, 0.1, { y: h * f + 0.06, h: 0.12, heightAt: F.dr.heightAt, base: F.dr.base })));
    const m = api.paint(S.mergeGeos(posts.concat(rails)), R.WOOD, { speck: 0.12, lift: 0.12 }); api.colourOnly(m); F.root.add(m);
    api.proxy(S.ribbonGeo(line, 0.06, { y: h, h, heightAt: F.dr.heightAt, base: F.dr.base }), F.root);
    return end(F, 'fence', { length: S.length(F.world) });
  }
  function hedge(pts, { h = 1.1, width = 0.9 } = {}) {
    const F = begin(pts, 'line');
    F.root.add(hedgeGeo(S.smooth(F.pts, 2), width, h, F));
    return end(F, 'hedge', { length: S.length(F.world) });
  }
  function hedgeGeo(line, width, h, F) {
    const m = api.paint(S.ribbonGeo(line, width, { y: h, h, step: 1.2, heightAt: F.dr.heightAt, base: F.dr.base }), HEDGE, { speck: 0.34 });
    m.userData.agora.part = 'hedge'; return m;
  }
  // river: a ribbon of deep water between sand banks (canal: straight-edged, with stone kerbs)
  function river(pts, { width = 3.2, canal = false } = {}) {
    const F = begin(pts, 'line'), line = canal ? F.pts : S.smooth(F.pts, 3);
    const P = line.map(p => [p.x, p.z]);
    if (canal) F.root.add(api.path({ points: P, width: width + 1.2, h: 0.16, ramp: R.LIMESTONE, kerb: false, smooth: false, ...F.dr }));
    else F.root.add(api.colourOnly(api.path({ points: P, width: width + 1.8, h: 0.04, ramp: BANK, kerb: false, smooth: false, ...F.dr })));
    const w = api.path({ points: P, width, h: canal ? 0.12 : 0.08, ramp: WATER, kerb: false, smooth: false, speck: 0.12, ...F.dr });
    w.traverse(o => { if (o.isMesh) o.castShadow = false; });
    F.root.add(w);
    return end(F, canal ? 'canal' : 'river', { length: S.length(F.world), water: true });
  }

  // ================= dispatch =================
  // make(kind, mark): mark = marks.current() ({kind:'area', poly} | {kind:'line', pts} | {kind:'point', x, z}) or a
  // bare list of points (closed = area). Returns null when the kind is not a filler.
  function make(kind, mark, opts = {}) {
    const k0 = String(kind || '').toLowerCase().trim(), k = CANON[k0] || k0, want = FILL_KINDS[k0] || FILL_KINDS[k];
    if (!want) return null;
    let poly = null, line = null;
    if (Array.isArray(mark)) { if (mark.length >= 3 && want === 'area') poly = mark; else line = mark; }
    else if (mark && mark.poly) poly = mark.poly;
    else if (mark && (mark.pts || mark.points)) line = mark.pts || mark.points;
    else if (mark && Number.isFinite(mark.x)) {   // a point: a default-sized shape round it
      const x = mark.x, z = mark.z, r = opts.r || 4;
      if (want === 'area') poly = [[x - r, z - r * 0.75], [x + r, z - r * 0.75], [x + r, z + r * 0.75], [x - r, z + r * 0.75]];
      else line = [[x - r, z], [x + r, z]];
    }
    if (!poly && !line) return null;
    if (want === 'area' && !poly) poly = buffer(S.toPts(line), opts.width || 6).map(p => [p.x, p.z]);   // a band along the stroke
    if (want === 'line' && !line) line = closedLine(S.toPts(poly)).map(p => [p.x, p.z]);             // round the area
    const crop = k0 === 'wheat' ? 'wheat' : k0 === 'lavender' ? 'lavender' : k0 === 'meadow' || k0 === 'pasture' ? 'green' : undefined;
    switch (k) {
      case 'field': return field(poly, Object.assign({ crop: crop || 'mixed' }, opts));
      case 'forest': return k0 === 'grove' ? forest(poly, Object.assign({ mix: { olive: 4, pine: 1, cypress: 0.6 } }, opts)) : forest(poly, opts);
      case 'orchard': return orchard(poly, opts);
      case 'garden': return garden(poly, opts);
      case 'plaza': return plaza(poly, opts);
      case 'vineyard': return vineyard(poly, opts);
      case 'road': return road(line, opts);
      case 'wall': return wall(line, opts);
      case 'fence': return fence(line, opts);
      case 'hedge': return hedge(line, opts);
      case 'river': return river(line, opts);
      case 'canal': return river(line, Object.assign({ canal: true, width: 2.6 }, opts));
      default: return null;
    }
  }
  // a closed band round a polyline (an area kind drawn as a stroke)
  function buffer(pts, w) {
    const left = [], right = [];
    pts.forEach((p, i) => {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], l = Math.hypot(b.x - a.x, b.z - a.z) || 1, nx = -(b.z - a.z) / l, nz = (b.x - a.x) / l;
      left.push({ x: p.x + nx * w / 2, z: p.z + nz * w / 2 }); right.push({ x: p.x - nx * w / 2, z: p.z - nz * w / 2 });
    });
    return left.concat(right.reverse());
  }
  // where a single object named for an area goes: the oriented box of the outline. Pass rot and {w, d} to
  // lib.create(id, { rot, fit: { w, d } }) and place it at (x, z).
  function frame(mark) {
    const pts = S.toPts(Array.isArray(mark) ? mark : (mark && (mark.poly || mark.pts)) || []);
    if (pts.length < 3) { const b = S.bbox(pts); return { x: (b.x0 + b.x1) / 2, z: (b.z0 + b.z1) / 2, rot: 0, w: Math.max(1, b.x1 - b.x0), d: Math.max(1, b.z1 - b.z0) }; }
    const f = S.frame(pts);
    // keep the turn within a quarter: the object's front faces the viewer side (+z) as far as possible
    let rot = f.rot, w = f.w, d = f.d;
    while (rot > Math.PI / 4) { rot -= Math.PI / 2; [w, d] = [d, w]; }
    while (rot < -Math.PI / 4) { rot += Math.PI / 2; [w, d] = [d, w]; }
    return { x: f.x, z: f.z, rot, w, d, area: Math.abs(S.area(pts)) };
  }
  function release(obj) {
    if (!obj) return;
    if (obj.parent) obj.parent.remove(obj);
    if (obj.agoraForms) obj.agoraForms.release();
    I.unregister(obj);
  }

  return { make, fill: make, reveal: (obj, o) => createReveal(ctx, obj, o), frame, release, field, forest, orchard, garden, plaza, vineyard, road, wall, fence, hedge, river,
    canal: (pts, o = {}) => river(pts, Object.assign({ canal: true, width: 2.6 }, o)), kinds: FILL_KINDS, seed: s => { rnd = ctx.mulberry32(Math.floor(s) || 1); } };
}
