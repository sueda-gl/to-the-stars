// Cursor marks on /api/command (ARCHITECTURE §10, ART_DIRECTION §5): the mark summary rides on the request, the mock parser
// and the normaliser turn "this is a field" + an area mark into build field at.mode 'mark', a point mark beats the pointer,
// and the live path sends the model the summary (never the polygon) and promotes a 'pointer' answer to 'mark'.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadCatalogue } from '../../server/catalogue.js';
import { parseIntent } from '../../server/mock/intent.js';
import { normaliseMark, summariseMark, normaliseAction, AT_MODES, COMMAND_SCHEMA } from '../../server/schemas.js';
import { createServer } from '../../server/index.js';
import { createRoutes } from '../../server/routes.js';
import { createMind } from '../../server/llm.js';
import { loadLetterTemplates } from '../../server/mock/letters.js';
import { createAssetStore } from '../../server/assets.js';

const catalogue = await loadCatalogue();
const snapshot = { buildings: [{ id: 'b1', kind: 'windmill', name: 'Old mill', x: 4, z: 2, status: 'done' }], agents: [{ id: 'a1', name: 'Olla' }], letters: [], neighbours: [] };
const AREA = { kind: 'area', centroid: { x: 5, z: 6 }, bbox: { x0: 0, z0: 0, x1: 10, z1: 12 }, areaM2: 100, nearest: 'b1' };
const LINE = { kind: 'line', centroid: { x: 5, z: 5 }, bbox: { x0: 0, z0: 0, x1: 10, z1: 10 }, length: 15 };
const POINT = { kind: 'point', centroid: { x: 7, z: -3 } };
const pointer = { x: 1, z: 2 };
const first = (transcript, mark, extra = {}) => parseIntent({ transcript, pointer, snapshot, catalogue, mark, ...extra }).actions[0];

test('the catalogue has the area / line kinds with shape and category (server and sim agree)', () => {
  for (const [id, shape] of [['field', 'area'], ['forest', 'area'], ['orchard', 'area'], ['vineyard', 'area'], ['plaza', 'area'], ['garden', 'area'], ['road', 'line'], ['wall', 'line'], ['fence', 'line'], ['river', 'line'], ['house', 'point']]) {
    const e = catalogue.byId.get(id);
    assert.ok(e, id); assert.equal(e.shape, shape, id); assert.ok(e.category, id);
  }
  assert.equal(catalogue.source, 'web/js/sim/catalog.js');
  assert.ok(AT_MODES.includes('mark'));
  assert.deepEqual(COMMAND_SCHEMA.properties.actions.items.properties.at.properties.mode.enum, AT_MODES);
});

test('normaliseMark: summarize() shape, current() shape (poly / pts), odd bboxes, and junk', () => {
  assert.deepEqual(normaliseMark(POINT), { kind: 'point', centroid: { x: 7, z: -3 } });
  const a = normaliseMark(AREA);
  assert.deepEqual(a, { kind: 'area', centroid: { x: 5, z: 6 }, bbox: { x0: 0, z0: 0, x1: 10, z1: 12, w: 10, d: 12 }, areaM2: 100, nearest: 'b1' });
  // the marks module's current(): poly + centroid, no bbox / area -> computed; the polygon is kept for the sim
  const cur = normaliseMark({ kind: 'area', id: 'm3', poly: [[0, 0], [10, 0], [10, 12], [0, 12]], centroid: { x: 5, z: 6 } });
  assert.equal(cur.id, 'm3'); assert.equal(cur.poly.length, 4); assert.deepEqual(cur.bbox, { x0: 0, z0: 0, x1: 10, z1: 12, w: 10, d: 12 }); assert.equal(cur.areaM2, 120);
  const sum = summariseMark(cur);
  assert.equal(sum.poly, undefined); assert.equal(sum.id, undefined); assert.equal(sum.kind, 'area'); assert.equal(sum.areaM2, 120);
  const ln = normaliseMark({ kind: 'line', pts: [[0, 0], [3, 4]] });
  assert.equal(ln.length, 5); assert.deepEqual(ln.centroid, { x: 1.5, z: 2 }); assert.equal(ln.pts.length, 2);
  assert.deepEqual(normaliseMark({ kind: 'point', x: 1.26, z: 2.44 }), { kind: 'point', centroid: { x: 1.3, z: 2.4 } });
  assert.deepEqual(normaliseMark({ kind: 'area', centroid: { x: 1, z: 1 } }), { kind: 'point', centroid: { x: 1, z: 1 } });   // no extent: a point
  assert.equal(normaliseMark({ kind: 'area', bbox: { x: 'a' } }), null);
  assert.equal(normaliseMark(null), null); assert.equal(normaliseMark('x'), null); assert.equal(normaliseMark({}), null);
  assert.equal(normaliseMark({ kind: 'area', bbox: { x: 5, z: 5, w: 4, d: 2 } }).bbox.x0, 3);
  assert.equal(normaliseMark({ kind: 'line', bbox: { min: { x: 0, z: 0 }, max: { x: 6, z: 8 } } }).length, 10);
});

test('mock: area words + an area mark fill the outline; line words + a line mark follow it; a point mark is the centre', () => {
  const at = (m) => ({ mode: 'mark', x: m.centroid.x, z: m.centroid.z, mark: normaliseMark(m) });
  assert.deepEqual(first('this is a field', AREA), { type: 'build', kind: 'field', at: at(AREA) });
  assert.deepEqual(first('a forest here', AREA), { type: 'build', kind: 'forest', at: at(AREA) });
  assert.equal(first('make this a market district', AREA).kind, 'plaza');
  assert.equal(first('this area should be a vineyard', AREA).kind, 'vineyard');
  assert.equal(first('let this be a garden', AREA).kind, 'garden');
  assert.equal(first('an orchard in this area', AREA).kind, 'orchard');
  assert.equal(first('burası tarla olsun', AREA).kind, 'field');
  assert.deepEqual(first('a road along here', LINE), { type: 'build', kind: 'road', at: at(LINE) });
  assert.equal(first('a wall along this', LINE).kind, 'wall');
  assert.equal(first('a fence here', LINE).kind, 'fence');
  assert.equal(first('a river along here', LINE).kind, 'river');
  assert.equal(first('a canal along this line', LINE).kind, 'river');
  assert.equal(first('a bridge along here', LINE).kind, 'bridge');
  assert.deepEqual(first('put a house there', POINT), { type: 'build', kind: 'house', at: at(POINT) });
  assert.deepEqual(first('a windmill there', POINT).at, at(POINT));                     // a point mark beats the pointer
  assert.deepEqual(first('a house', AREA).at, at(AREA));                                // a single thing named for an area: its centroid
  const duck = first('a giant duck', POINT);
  assert.equal(duck.kind, null); assert.equal(duck.request, 'a giant duck'); assert.deepEqual(duck.at, at(POINT));
  const say = parseIntent({ transcript: 'this is a field', pointer, snapshot, catalogue, mark: AREA }).say;
  assert.match(say.text, /outline you drew/);
  assert.match(parseIntent({ transcript: 'a house', pointer, snapshot, catalogue, mark: AREA }).say.text, /heart of the outline/);
  assert.match(parseIntent({ transcript: 'a road along here', pointer, snapshot, catalogue, mark: LINE }).say.text, /along the line/);
});

test('mock: with no mark the same words place by pointer / auto, and the area kinds still resolve', () => {
  assert.deepEqual(first('a giant duck', null), { type: 'build', kind: null, request: 'a giant duck', name: 'Giant Duck', at: { mode: 'auto' } });
  assert.deepEqual(first('a giant duck there', null), { type: 'build', kind: null, request: 'a giant duck there', name: 'Giant Duck', at: { mode: 'pointer' } });
  assert.deepEqual(first('this is a field', null), { type: 'build', kind: 'field', at: { mode: 'pointer' } });
  assert.deepEqual(first('this is a field', null, { pointer: null }), { type: 'build', kind: 'field', at: { mode: 'auto' } });
  assert.deepEqual(first('a field', null), { type: 'build', kind: 'field', at: { mode: 'auto' } });
  assert.deepEqual(first('a road', null), { type: 'build', kind: 'road', at: { mode: 'auto' } });
  assert.equal(first('plant a forest by the lake', null).kind, 'forest');
  assert.equal(first('a farm', null).kind, 'farm');                   // the farm is still the farm
  assert.equal(first('plant some trees', null).kind, 'grove');        // and the grove the grove
  // an explicit other place with a mark present is honoured ("in the middle" is not the mark)
  assert.deepEqual(first('a forest in the middle', AREA).at, { mode: 'center' });
  assert.deepEqual(first('a bakery near the windmill', POINT).at, { mode: 'near', ref: 'b1' });
  // marks never leak into non-build actions
  assert.equal(first("who's good at baking?", AREA).type, 'ask_crowd');
  assert.equal(first('make Olla our minister', POINT).type, 'appoint_minister');
});

test('normaliseAction: pointer -> mark when a mark exists; mark -> pointer / auto when none does; x,z = the centroid', () => {
  const m = normaliseMark(AREA);
  const r = normaliseAction({ type: 'build', kind: 'field', at: { mode: 'pointer', ref: '', x: null, z: null } }, snapshot, catalogue, { mark: m, pointer });
  assert.deepEqual(r.action.at, { mode: 'mark', x: 5, z: 6, mark: m });
  const r2 = normaliseAction({ type: 'build', kind: 'house', at: { mode: 'mark', ref: '', x: null, z: null } }, snapshot, catalogue, { mark: null, pointer });
  assert.deepEqual(r2.action.at, { mode: 'pointer' });
  const r3 = normaliseAction({ type: 'build', kind: 'house', at: { mode: 'mark', ref: '', x: null, z: null } }, snapshot, catalogue, { mark: null, pointer: null });
  assert.deepEqual(r3.action.at, { mode: 'auto' });
  // other modes are untouched by a mark
  const r4 = normaliseAction({ type: 'build', kind: 'house', at: { mode: 'center', ref: '', x: null, z: null } }, snapshot, catalogue, { mark: m, pointer });
  assert.deepEqual(r4.action.at, { mode: 'center' });
  const r5 = normaliseAction({ type: 'build', kind: 'house', at: { mode: 'water', ref: '', x: null, z: null } }, snapshot, catalogue, {});
  assert.deepEqual(r5.action.at, { mode: 'water', water: 'lake' });
});

// ---- HTTP: the mark rides on the body, the full mark (polygon) comes back on at.mark ----
let app, base;
const tmpAssets = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-marks-'));
before(async () => { app = await createServer({ mock: true, mockReason: 'test', mockCodegenMs: 100, assetsDir: tmpAssets, logLevel: 'silent', dotenv: false }); base = `http://127.0.0.1:${await app.listen(0)}`; });
after(async () => { await app.close(); fs.rmSync(tmpAssets, { recursive: true, force: true }); });
const post = (p, body) => fetch(base + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json());

test('POST /api/command with a mark (mock mind): the five live-test utterances', async () => {
  const poly = [[0, 0], [10, 0], [10, 12], [0, 12]];
  const r1 = await post('/api/command', { transcript: 'this is a field', pointer, snapshot, mark: { kind: 'area', id: 'm1', poly, centroid: { x: 5, z: 6 }, bbox: { x0: 0, z0: 0, x1: 10, z1: 12 }, areaM2: 120 } });
  assert.equal(r1.actions[0].kind, 'field'); assert.equal(r1.actions[0].at.mode, 'mark'); assert.deepEqual(r1.actions[0].at.mark.poly, poly); assert.equal(r1.actions[0].at.mark.id, 'm1');
  assert.deepEqual(r1.mark, { kind: 'area', centroid: { x: 5, z: 6 }, bbox: { x0: 0, z0: 0, x1: 10, z1: 12, w: 10, d: 12 }, areaM2: 120 });
  const r2 = await post('/api/command', { transcript: 'a forest here', pointer, snapshot, mark: AREA });
  assert.equal(r2.actions[0].kind, 'forest'); assert.equal(r2.actions[0].at.mode, 'mark');
  const r3 = await post('/api/command', { transcript: 'a road along here', pointer, snapshot, mark: { kind: 'line', pts: [[0, 0], [10, 10]], length: 14.1 } });
  assert.equal(r3.actions[0].kind, 'road'); assert.equal(r3.actions[0].at.mode, 'mark'); assert.deepEqual(r3.actions[0].at.mark.pts, [[0, 0], [10, 10]]);
  const r4 = await post('/api/command', { transcript: 'put a house there', pointer, snapshot, mark: POINT });
  assert.deepEqual(r4.actions[0].at, { mode: 'mark', x: 7, z: -3, mark: { kind: 'point', centroid: { x: 7, z: -3 } } });
  const r5 = await post('/api/command', { transcript: 'a giant duck', pointer, snapshot, mark: null });
  assert.equal(r5.actions[0].kind, null); assert.equal(r5.actions[0].at.mode, 'auto'); assert.equal(r5.mark, undefined);
  // junk marks are ignored, never a 500
  const r6 = await post('/api/command', { transcript: 'a house there', pointer, snapshot, mark: 'nope' });
  assert.deepEqual(r6.actions[0].at, { mode: 'pointer' });
});

// ---- the live path with a fake client ----
const msg = (text) => ({ id: 'msg_1', model: 'claude-fable-5-1', stop_reason: 'end_turn', content: [{ type: 'text', text }], usage: { input_tokens: 10, output_tokens: 5 } });
function fakeClient(script) {
  const calls = [];
  return { calls, beta: { messages: { async create(params, opts) { calls.push({ params, opts }); const r = script.shift(); if (r instanceof Error) throw r; return r; } } } };
}
test('live: the model sees the mark summary (no polygon), the system prompt teaches it, and a pointer answer is promoted to the mark', async () => {
  const letters = await loadLetterTemplates();
  const config = { mock: false, models: { logic: 'claude-fable-5-1', visual: 'claude-opus-5-5' }, liveFallbackToMock: true, mockCodegenMs: 50 };
  const poly = [[0, 0], [10, 0], [10, 12], [0, 12]];
  const client = fakeClient([
    msg(JSON.stringify({ actions: [{ type: 'build', kind: 'field', at: { mode: 'mark', ref: '', x: null, z: null } }], say: { from: 'ministry', text: 'A field, as drawn.' } })),
    msg(JSON.stringify({ actions: [{ type: 'build', kind: 'house', at: { mode: 'pointer', ref: '', x: null, z: null } }], say: null })),
    msg(JSON.stringify({ actions: [{ type: 'build', kind: 'house', at: { mode: 'mark', ref: '', x: null, z: null } }], say: null })),
  ]);
  const routes = createRoutes({ config, catalogue, mind: createMind(config, { client }), letters, assets: createAssetStore(fs.mkdtempSync(path.join(os.tmpdir(), 'agora-live-marks-'))), log: () => {} });
  const r = await routes.command({ transcript: 'this is a field', pointer, snapshot, mark: { kind: 'area', id: 'm9', poly, centroid: { x: 5, z: 6 }, areaM2: 120 } });
  const { params } = client.calls[0];
  const user = JSON.parse(params.messages[0].content[0].text);
  assert.deepEqual(user.mark, { kind: 'area', centroid: { x: 5, z: 6 }, bbox: { x0: 0, z0: 0, x1: 10, z1: 12, w: 10, d: 12 }, areaM2: 120 });
  assert.match(params.system[0].text, /at\.mode = "mark"/); assert.match(params.system[0].text, /"shape":"area"/); assert.match(params.system[0].text, /"id":"field"/);
  assert.equal(r.meta.mind, 'live'); assert.equal(r.actions[0].at.mode, 'mark'); assert.deepEqual(r.actions[0].at.mark.poly, poly); assert.equal(r.actions[0].at.mark.id, 'm9');
  // the model said "pointer" while a point mark exists: the mark wins
  const r2 = await routes.command({ transcript: 'put a house there', pointer, snapshot, mark: POINT });
  assert.deepEqual(r2.actions[0].at, { mode: 'mark', x: 7, z: -3, mark: { kind: 'point', centroid: { x: 7, z: -3 } } });
  // the model said "mark" with no mark: the pointer
  const r3 = await routes.command({ transcript: 'put a house there', pointer, snapshot, mark: null });
  assert.deepEqual(r3.actions[0].at, { mode: 'pointer' });
  assert.equal(JSON.parse(client.calls[2].params.messages[0].content[0].text).mark, null);
});
