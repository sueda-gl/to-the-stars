// Placement at a cursor mark (ART_DIRECTION §5, ARCHITECTURE §10): a point mark is the centre (nudged minimally only when
// blocked, and the nudge is reported), an area mark becomes the building's outline (x/z = centroid, footprint = bbox),
// a line mark its stroke, and the folk work inside the area / along the line.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { game, run } from './helpers.mjs';
import { pointInPoly, polyCentroid, distToPolyline, rectsOverlap, rectTouchesPoly } from '../../web/js/sim/geometry.js';
import { normaliseMark, summariseMark } from '../../web/js/sim/marks.js';
import { MARK } from '../../web/js/sim/state.js';

const rich = (opts) => { const g = game(opts); g.state.resources = { food: 200, wood: 200, stone: 200, coin: 50, goods: 0 }; return g; };
const square = (cx, cz, r) => [[cx - r, cz - r], [cx + r, cz - r], [cx + r, cz + r], [cx - r, cz + r]];
const build = (g, kind, mark, extra = {}) => g.apply({ type: 'build', kind, at: { mode: 'mark', mark }, ...extra });
const last = g => g.state.buildings.at(-1);

test('normaliseMark (sim): the marks module shapes, the server echo and the summary', () => {
  const a = normaliseMark({ kind: 'area', poly: [[0, 0], [10, 0], [10, 12], [0, 12], [0, 0]], centroid: { x: 5, z: 6 }, id: 7 });
  assert.equal(a.kind, 'area'); assert.equal(a.poly.length, 4); assert.equal(a.areaM2, 120); assert.deepEqual([a.x, a.z], [5, 6]); assert.equal(a.id, 7);
  assert.deepEqual(a.bbox, { x0: 0, z0: 0, x1: 10, z1: 12, w: 10, d: 12, x: 5, z: 6 });
  // the summary alone (no polygon): the area is its bbox rectangle, the line its diagonal
  const s = normaliseMark({ kind: 'area', centroid: { x: 5, z: 6 }, bbox: { x0: 0, z0: 0, x1: 10, z1: 12 }, areaM2: 100 });
  assert.equal(s.poly.length, 4); assert.equal(s.areaM2, 100);
  const l = normaliseMark({ kind: 'line', pts: [[0, 0], [6, 8]] });
  assert.equal(l.kind, 'line'); assert.equal(l.length, 10); assert.deepEqual([l.x, l.z], [3, 4]);
  assert.deepEqual(normaliseMark({ kind: 'point', x: 2, z: 3 }), { kind: 'point', x: 2, z: 3 });
  assert.deepEqual(normaliseMark({ kind: 'point', centroid: { x: 2, z: 3 } }), { kind: 'point', x: 2, z: 3 });
  assert.equal(normaliseMark({ kind: 'area', poly: [[0, 0]] }).kind, 'point');   // too few points: the one point
  assert.equal(normaliseMark(null), null); assert.equal(normaliseMark({}), null); assert.equal(normaliseMark({ kind: 'line', pts: 'x' }), null);
  assert.deepEqual(summariseMark(l), { kind: 'line', centroid: { x: 3, z: 4 }, bbox: { x0: 0, z0: 0, x1: 6, z1: 8, w: 6, d: 8 }, length: 10 });
});

test('the catalogue knows area and line kinds; farm and grove are still themselves', () => {
  const g = game();
  for (const [id, shape] of [['field', 'area'], ['forest', 'area'], ['orchard', 'area'], ['vineyard', 'area'], ['plaza', 'area'], ['garden', 'area'], ['road', 'line'], ['wall', 'line'], ['fence', 'line'], ['river', 'line'], ['house', 'point'], ['farm', 'point'], ['grove', 'point']])
    assert.equal(g.catalog.get(id).shape, shape, id);
  assert.equal(g.catalog.resolve('field'), 'field'); assert.equal(g.catalog.resolve('a wheat field'), 'field'); assert.equal(g.catalog.resolve('forest'), 'forest'); assert.equal(g.catalog.resolve('woods'), 'forest');
  assert.equal(g.catalog.resolve('farm'), 'farm'); assert.equal(g.catalog.resolve('trees'), 'grove'); assert.equal(g.catalog.resolve('market district'), 'plaza'); assert.equal(g.catalog.resolve('canal'), 'river'); assert.equal(g.catalog.resolve('path'), 'road');
  const gen = g.catalog.add({ id: 'gen-hedge-maze', name: 'Hedge Maze', meta: { shape: 'area', category: 'nature' } });
  assert.equal(gen.shape, 'area');
  assert.equal(g.catalog.add({ id: 'gen-x', name: 'X', meta: { shape: 'blob' } }).shape, 'point');
});

test('point mark: the building is centred EXACTLY on the mark, and the mark is consumed', () => {
  const g = rich();
  const r = build(g, 'house', { kind: 'point', x: 8.37, z: 8.12, id: 'm1' });
  assert.equal(r.ok, true);
  const b = last(g);
  assert.deepEqual([b.x, b.z], [8.37, 8.12]); assert.equal(b.rot, 0); assert.equal(b.shape, undefined); assert.equal(b.nudge, undefined);
  const mk = r.effects.find(e => e.type === 'mark');
  assert.deepEqual(mk, { type: 'mark', used: true, kind: 'point', id: b.id, markId: 'm1', exact: true });
  assert.ok(!r.effects.some(e => e.type === 'nudge'));
  assert.equal(r.effects[0].type, 'site'); assert.equal(r.effects[0].x, 8.37); assert.equal(r.effects[1].type, 'mark');
  // the sim's own copy of the mark (setMark) is used when the action carries none, and cleared once used
  g.setMark({ kind: 'point', x: -5, z: -5 });
  assert.deepEqual(g.state.mark, { kind: 'point', x: -5, z: -5 });
  const r2 = g.apply({ type: 'build', kind: 'hut', at: { mode: 'mark' } });
  assert.equal(r2.ok, true); assert.deepEqual([last(g).x, last(g).z], [-5, -5]); assert.equal(g.state.mark, null);
  // mode 'mark' with no mark anywhere: the pointer coordinates, else auto (never a crash)
  const r3 = g.apply({ type: 'build', kind: 'hut', at: { mode: 'mark', x: 16, z: 12 } });
  assert.equal(r3.ok, true); assert.deepEqual([last(g).x, last(g).z], [16, 12]);
  const r4 = g.apply({ type: 'build', kind: 'hut', at: { mode: 'mark' } });
  assert.equal(r4.ok, true);
});

test('point mark on another building: the smallest nudge that fits, reported; never far', () => {
  const g = rich();
  build(g, 'house', { kind: 'point', x: 10, z: 10 });
  const r = build(g, 'house', { kind: 'point', x: 10.5, z: 10.2 });
  assert.equal(r.ok, true);
  const b = last(g), a = g.state.buildings[0];
  const nudge = r.effects.find(e => e.type === 'nudge');
  assert.ok(nudge, 'nudge reported'); assert.equal(nudge.why, 'overlap'); assert.deepEqual(nudge.from, { x: 10.5, z: 10.2 }); assert.deepEqual(nudge.to, { x: b.x, z: b.z });
  assert.ok(!rectsOverlap({ x: a.x, z: a.z, w: 4, d: 4 }, { x: b.x, z: b.z, w: 4, d: 4 }, 0));
  const d = Math.hypot(b.x - 10.5, b.z - 10.2);
  assert.ok(d <= 5.6, `moved ${d.toFixed(2)}`); assert.equal(nudge.dist, +d.toFixed(2));
  assert.equal(r.effects.find(e => e.type === 'mark').exact, false);
  assert.deepEqual(b.nudge, nudge && { from: nudge.from, to: nudge.to, dist: nudge.dist, why: 'overlap' });
  assert.ok(g.state.log.some(l => /nudged .* off the mark: overlap/.test(l.text)));
  // ringed in on every side within reach: refused with a reason naming the reach, not relocated across the plot
  const g2 = rich();
  for (let x = -16; x <= 16; x += 5.2) for (let z = -16; z <= 16; z += 5.2) if (Math.hypot(x, z) < 15) g2.placeBuilding('house', { x, z, rot: 0 });
  const r2 = build(g2, 'assembly', { kind: 'point', x: 0, z: 0 });
  g2.state.stage = 'town';
  const r3 = build(g2, 'assembly', { kind: 'point', x: 0, z: 0 });
  assert.equal(r3.ok, false); assert.match(r3.reason, new RegExp(`within ${MARK.maxNudge} m of your mark`));
  assert.ok(!g2.state.buildings.some(b => b.kind === 'assembly'));
  assert.equal(r2.ok, false);   // (the first try was the stage gate)
});

test('point mark on the water: a land thing comes ashore minimally; a floating thing floats exactly there', () => {
  const g = rich();
  const lake = g.state.water.find(w => w.kind === 'lake').poly;
  const lc = polyCentroid(lake);
  const r = build(g, 'hut', { kind: 'point', x: lc.x, z: lc.z });
  assert.equal(r.ok, true);
  const hut = last(g);
  assert.ok(!rectTouchesPoly({ x: hut.x, z: hut.z, w: 3, d: 3 }, lake, 0)); assert.equal(hut.floating, false);
  const nudge = r.effects.find(e => e.type === 'nudge');
  assert.equal(nudge.why, 'water'); assert.ok(nudge.dist <= MARK.maxNudge, `ashore in ${nudge.dist}`);
  const r2 = g.apply({ type: 'build', kind: null, request: 'a rubber duck', at: { mode: 'mark', mark: { kind: 'point', x: lc.x, z: lc.z } } });
  assert.equal(r2.ok, true);
  const duck = last(g);
  assert.equal(duck.floating, true); assert.deepEqual([duck.x, duck.z], [+lc.x.toFixed(2), +lc.z.toFixed(2)]); assert.ok(duck.workSpot);
  assert.ok(!r2.effects.some(e => e.type === 'nudge'));
  // a duck marked on dry land sits on the land (the mark says so), not on the lake
  const r3 = g.apply({ type: 'build', kind: null, request: 'a rubber duck', at: { mode: 'mark', mark: { kind: 'point', x: 5, z: 5 } } });
  assert.equal(r3.ok, true); assert.equal(last(g).floating, false); assert.deepEqual([last(g).x, last(g).z], [5, 5]);
});

test('area mark + an area kind: shape.poly is the outline, x/z the centroid, footprint the bbox; folk work inside it', () => {
  const g = rich();
  const poly = [[-12, -2], [-2, -3], [0, 6], [-6, 9], [-13, 5]];
  const r = build(g, 'field', { kind: 'area', poly, id: 'm2' });
  assert.equal(r.ok, true);
  const b = last(g);
  assert.deepEqual(b.shape.poly, poly);
  const c = polyCentroid(poly);
  assert.deepEqual([b.x, b.z], [+c.x.toFixed(2), +c.z.toFixed(2)]);
  assert.deepEqual(b.footprint, { w: 13, d: 12 });
  assert.ok(b.shape.areaM2 > 80 && b.shape.areaM2 < 130, `area ${b.shape.areaM2}`);
  assert.deepEqual(b.shape.bbox, { x0: -13, z0: -3, x1: 0, z1: 9, w: 13, d: 12, x: -6.5, z: 3 });
  const mk = r.effects.find(e => e.type === 'mark');
  assert.equal(mk.kind, 'area'); assert.equal(mk.markId, 'm2'); assert.equal(mk.areaM2, b.shape.areaM2); assert.equal(mk.exact, true);
  assert.deepEqual(r.effects[0].shape.poly, poly);
  assert.ok(g.find('building:site', e => e.building.id === b.id && e.building.shape.poly.length === 5));
  // the crew's work legs land at spread-out points INSIDE the outline
  run(g, 60, 0.25);
  const sp = g.state.stockpile;
  const sites = g.all('agent:task', t => t.task.to && t.task.buildingId === b.id && (t.task.kind === 'haul' || t.task.kind === 'walk') && Math.hypot(t.task.to.x - sp.x, t.task.to.z - sp.z) > 3).map(t => t.task.to);   // legs to the site (not to the stockpile)
  const inside = sites.filter(p => pointInPoly(p.x, p.z, poly));
  assert.ok(sites.length >= 3, `work legs ${sites.length}`);
  assert.equal(inside.length, sites.length, 'every work spot is inside the outline');
  const distinct = new Set(inside.map(p => `${p.x},${p.z}`));
  assert.ok(distinct.size >= 3, `spread out: ${distinct.size}`);
  assert.ok(sites.every(p => !g.state.water.some(w => pointInPoly(p.x, p.z, w.poly))));
  // the snapshot says it is an area
  assert.equal(g.snapshot().buildings.find(x => x.id === b.id).shape, 'area');
});

test('area mark + a single thing: at the centroid, shrunk to fit the outline, with the outline remembered', () => {
  const g = rich();
  const poly = square(10, 10, 1.2);   // a 2.4 m square: a 4x4 house shrinks to fit it
  const r = build(g, 'house', { kind: 'area', poly });
  assert.equal(r.ok, true);
  const b = last(g);
  assert.deepEqual([b.x, b.z], [10, 10]); assert.deepEqual(b.footprint, { w: 2.4, d: 2.4 });
  assert.equal(b.shape.fit, true); assert.deepEqual(b.shape.poly, poly);
  // a generated thing named for an area: the same (and its design never moves the site)
  const r2 = g.apply({ type: 'build', kind: null, request: 'a dragon statue', at: { mode: 'mark', mark: { kind: 'area', poly: square(16, -14, 6) } } });
  assert.equal(r2.ok, true);
  const d = last(g);
  assert.deepEqual([d.x, d.z], [16, -14]); assert.deepEqual(d.footprint, { w: 5, d: 5 });
  g.designArrived(d.id, { id: 'gen-dragon-1', name: 'Dragon', meta: { footprint: { w: 9, d: 9 }, category: 'landmark' } });
  assert.deepEqual([d.x, d.z], [16, -14]); assert.deepEqual(d.footprint, { w: 5, d: 5 });
  assert.equal(g.find('building:design', e => e.building.id === d.id).p.moved, false);
});

test('line mark: shape.pts is the stroke, x/z its midpoint, rot its heading; folk work along it', () => {
  const g = rich();
  const pts = [[-14, 14], [-4, 14], [6, 4]];
  const r = build(g, 'road', { kind: 'line', pts, id: 'm4' });
  assert.equal(r.ok, true);
  const b = last(g);
  assert.deepEqual(b.shape.pts, pts); assert.equal(b.shape.length, +(10 + Math.hypot(10, 10)).toFixed(1));
  assert.ok(distToPolyline(b.x, b.z, pts) < 1e-6, 'the midpoint lies on the stroke');
  assert.ok(Math.abs(b.rot - Math.PI / 4) < 1e-6, `rot ${b.rot}`);   // the second leg heads +x, +z: rot = -atan2(dz, dx)
  assert.deepEqual(b.footprint, { w: 20, d: 10 });
  assert.equal(b.shape.width, 2);
  const mk = r.effects.find(e => e.type === 'mark');
  assert.equal(mk.kind, 'line'); assert.equal(mk.length, b.shape.length); assert.equal(mk.markId, 'm4');
  // a wall along the same kind of stroke, and a bridge (a point kind) follows it too
  assert.equal(build(g, 'wall', { kind: 'line', pts: [[10, -10], [20, -10]] }).ok, true);
  assert.deepEqual([last(g).x, last(g).z, last(g).rot], [15, -10, 0]);
  const wall = last(g);
  assert.equal(build(g, 'bridge', { kind: 'line', pts: [[-20, -20], [-20, -10]] }).ok, true);
  assert.deepEqual(last(g).shape.pts, [[-20, -20], [-20, -10]]); assert.deepEqual(last(g).footprint, { w: 8, d: 3 });
  // the wall's crew stands beside the stroke, at different points along it (the road is done in 10 s: too quick to watch)
  run(g, 40, 0.25);
  const sp = g.state.stockpile;
  const legs = g.all('agent:task', t => t.task.to && t.task.buildingId === wall.id && (t.task.kind === 'haul' || t.task.kind === 'walk') && Math.hypot(t.task.to.x - sp.x, t.task.to.z - sp.z) > 3).map(t => t.task.to);
  assert.ok(legs.length >= 2, `legs ${legs.length}`);
  for (const p of legs) { const dd = distToPolyline(p.x, p.z, wall.shape.pts); assert.ok(dd > 0.5 && dd < 3, `beside the wall: ${dd.toFixed(2)}`); }
  assert.ok(new Set(legs.map(p => `${p.x},${p.z}`)).size >= 2);
  assert.equal(g.snapshot().buildings.find(x => x.id === b.id).shape, 'line');
});

test('shaped buildings block auto placement by their outline / width, not by their bbox; a marked point inside a field is allowed', () => {
  const g = rich();
  const poly = [[-20, -20], [0, -20], [0, 0], [-20, 0]];
  build(g, 'field', { kind: 'area', poly });
  const field = last(g);
  // auto placement never lands inside the field
  for (let i = 0; i < 12; i++) g.apply({ type: 'build', kind: 'hut', at: { mode: 'auto' } });
  for (const b of g.state.buildings.filter(x => x.kind === 'hut')) assert.ok(!rectTouchesPoly({ x: b.x, z: b.z, w: 3, d: 3 }, poly, 0), `hut at ${b.x},${b.z} outside the field`);
  // a long diagonal road blocks only its strip: a house fits in the corner of its bbox
  const g1 = rich();
  const pts = [[5, 5], [25, 25]];
  build(g1, 'road', { kind: 'line', pts });
  assert.equal(g1.spotFree({ x: 22, z: 8, w: 4, d: 4 }), true, 'the far corner of the road\'s bbox is free');
  assert.equal(g1.spotFree({ x: 15, z: 15, w: 4, d: 4 }), false, 'the road itself is not');
  assert.equal(g1.spotFree({ x: 13, z: 17, w: 4, d: 4 }), false, 'nor its margin');
  // the sovereign marks a point inside their field: honoured, with the overlap on record
  const r = build(g, 'house', { kind: 'point', x: -5, z: -15 });
  assert.equal(r.ok, true); assert.deepEqual([last(g).x, last(g).z], [-5, -15]);
  assert.deepEqual(r.effects.find(e => e.type === 'overlaps'), { type: 'overlaps', id: last(g).id, ids: [field.id] });
  // an area drawn over the house is exact too, and says what it crosses
  const houseId = last(g).id;
  const r2 = build(g, 'forest', { kind: 'area', poly: square(-5, -15, 4) });
  assert.equal(r2.ok, true); assert.ok(r2.effects.find(e => e.type === 'overlaps').ids.includes(houseId));
});

test('area / line kinds without a mark get a default rectangle / straight strip, so the visual layer always has a shape', () => {
  const g = rich();
  const r = g.apply({ type: 'build', kind: 'field', at: { mode: 'pointer', x: 10, z: 10 } });
  assert.equal(r.ok, true);
  const f = last(g);
  assert.deepEqual([f.x, f.z], [10, 10]); assert.equal(f.shape.rect, true); assert.equal(f.shape.poly.length, 4); assert.equal(f.shape.areaM2, 48);
  assert.ok(f.shape.poly.every(([x, z]) => Math.abs(x - 10) <= 4 && Math.abs(z - 10) <= 3));
  const r2 = g.apply({ type: 'build', kind: 'road', at: { mode: 'center' } });
  assert.equal(r2.ok, true);
  const rd = last(g);
  assert.equal(rd.shape.straight, true); assert.equal(rd.shape.pts.length, 2); assert.equal(rd.shape.length, 6); assert.equal(rd.shape.width, 2);
  assert.ok(distToPolyline(rd.x, rd.z, rd.shape.pts) < 1e-6);
  // "two fields here" with one mark: the first fills the mark, the second sits next to it
  const r3 = g.apply({ type: 'build', kind: 'hut', count: 2, at: { mode: 'mark', mark: { kind: 'point', x: 18, z: -18 } } });
  assert.equal(r3.ok, true); assert.equal(r3.buildings.length, 2);
  const [h1, h2] = r3.buildings.map(id => g.state.buildings.find(b => b.id === id));
  assert.deepEqual([h1.x, h1.z], [18, -18]); assert.ok(Math.hypot(h2.x - 18, h2.z + 18) < 8); assert.ok(!rectsOverlap({ x: h1.x, z: h1.z, w: 3, d: 3 }, { x: h2.x, z: h2.z, w: 3, d: 3 }, 0));
  assert.equal(r3.effects.filter(e => e.type === 'mark').length, 1);
});

test('a marked field feeds the town and is staffed like any production building', () => {
  const g = rich();
  build(g, 'field', { kind: 'area', poly: square(12, -12, 5) });
  const f = last(g);
  g.completeBuilding(f);
  assert.equal(f.status, 'done');
  run(g, 61, 0.5);
  const rates = g.state.rates;
  assert.ok(f.workers.length >= 1, 'staffed');
  assert.ok(g.count('day') >= 1);
  const legs = g.all('agent:task', t => t.task.to && t.task.buildingId === f.id && t.task.kind === 'walk' && Math.hypot(t.task.to.x - g.state.stockpile.x, t.task.to.z - g.state.stockpile.z) > 3).map(t => t.task.to);
  assert.ok(legs.length >= 1 && legs.every(p => pointInPoly(p.x, p.z, f.shape.poly)), 'work trips go inside the field');
});
