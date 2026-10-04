// Boots the server on a random port in mock mode and hits every endpoint, including the SSE stream.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createServer } from '../../server/index.js';

let app, base;
const tmpAssets = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-assets-'));

before(async () => {
  app = await createServer({ mock: true, mockReason: 'test', mockCodegenMs: 250, assetsDir: tmpAssets, logLevel: 'silent', dotenv: false });
  const port = await app.listen(0);
  base = `http://127.0.0.1:${port}`;
});
after(async () => { await app.close(); fs.rmSync(tmpAssets, { recursive: true, force: true }); });

const post = (p, body) => fetch(base + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
const snapshot = {
  day: 3, stage: 'camp', resources: { food: 2, wood: 30, stone: 20, coin: 10 },
  buildings: [{ id: 'b1', kind: 'windmill', name: 'Old mill', status: 'done' }],
  agents: [{ id: 'a1', name: 'Olla', species: 'loaf', trade: 'baker', status: 'idle', traits: ['proud'], skills: { baking: 4 } }, { id: 'a2', name: 'Pim', species: 'puffer', trade: 'builder', status: 'idle' }, { id: 'a3', name: 'Bruno', species: 'puffer', trade: 'builder', status: 'idle' }],
  letters: [{ id: 'l1', subject: 'Hungry', resolved: false }], neighbours: [{ id: 'n1', name: 'Ashfolk', attitude: 20, leaderSpecies: 'drop' }], minister: 'a1',
};

test('GET /api/health', async () => {
  const r = await fetch(base + '/api/health'); const j = await r.json();
  assert.equal(r.status, 200); assert.equal(j.ok, true); assert.equal(j.mock, true);
  assert.deepEqual(j.models, { logic: 'claude-fable-5-1', visual: 'claude-opus-5-5', sketch: 'claude-fable-5-1', command: 'claude-fable-5-1' }); assert.equal(j.stt, 'webspeech');
  assert.equal(j.sketch, true); assert.equal(j.fastMode, true); assert.ok(j.stock.includes('rocket')); assert.ok(j.letterPurposes.includes('election'));
  assert.equal(j.buildApi, 'web/js/buildings/BUILD_API.md');
});

test('POST /api/command', async () => {
  const r = await post('/api/command', { transcript: 'A windmill there', pointer: { x: 1, z: 2 }, snapshot });
  const j = await r.json();
  assert.equal(r.status, 200);
  assert.deepEqual(j.actions, [{ type: 'build', kind: 'windmill', at: { mode: 'pointer' } }]);
  assert.equal(j.say.from, 'ministry'); assert.equal(j.meta.mind, 'mock');
});

test('POST /api/society writes letters that reflect hunger, with spoken options; report when wanted', async () => {
  const r = await post('/api/society', { snapshot, recent: [], wants: ['report'] }); const j = await r.json();
  assert.equal(r.status, 200);
  assert.ok(j.letters.length >= 1 && j.letters.length <= 3);
  assert.equal(j.letters[0].kind, 'report'); assert.match(j.letters[0].body, /2 food/);
  const hunger = j.letters.find(l => /hungry|crates/i.test(l.subject));
  assert.ok(hunger, 'hunger letter'); assert.ok(hunger.options.length >= 2); assert.match(hunger.options[0].says, /bakery near the windmill/);
  assert.ok(Array.isArray(j.events));
});

test('POST /api/letter for each purpose', async () => {
  for (const purpose of ['refusal', 'skill_answer', 'report', 'reply']) {
    const r = await post('/api/letter', { purpose, agent: snapshot.agents[0], context: { skill: 'baking', why: 'I am too tired', text: 'well done' }, snapshot });
    const j = await r.json();
    assert.equal(r.status, 200, purpose);
    assert.ok(j.subject && j.body, purpose); assert.ok(j.options.length >= 1, purpose);
  }
  const proud = await (await post('/api/letter', { purpose: 'skill_answer', agent: snapshot.agents[0], context: { skill: 'baking' }, snapshot })).json();
  assert.match(proud.body, /7 out of ten|Nobody here can bake/); // proud over-claim of a 4
});

test('POST /api/codegen streams status events then done; GET /api/assets returns it', async () => {
  const r = await post('/api/codegen', { request: 'a lighthouse on the cliff', kindHint: '', snapshot });
  assert.equal(r.status, 200); assert.match(r.headers.get('content-type'), /text\/event-stream/);
  const text = await r.text();
  const events = [...text.matchAll(/^event: (\w+)\ndata: (.*)$/gm)].map(m => [m[1], JSON.parse(m[2])]);
  const stages = events.filter(e => e[0] === 'status').map(e => e[1].stage);
  assert.deepEqual(stages, ['drafting', 'writing', 'checking']);
  const done = events.find(e => e[0] === 'done');
  assert.ok(done, 'done event'); const asset = done[1].asset;
  assert.equal(asset.name, 'Lighthouse'); assert.match(asset.code, /function build\(api\)/); assert.ok(asset.meta.footprint.w >= 1);
  assert.ok(fs.existsSync(path.join(tmpAssets, `${asset.id}.json`)));
  const list = await (await fetch(base + '/api/assets')).json();
  assert.equal(list.length, 1); assert.equal(list[0].id, asset.id); assert.equal(typeof list[0].code, 'string');
  // learned: second request is instant from the archive
  const again = await (await post('/api/codegen', { request: 'another lighthouse', snapshot })).text();
  assert.match(again, /"mind":"cache"/);
});

test('errors: bad JSON, unknown endpoint, wrong method', async () => {
  const bad = await fetch(base + '/api/command', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{nope' });
  assert.equal(bad.status, 400);
  assert.equal((await fetch(base + '/api/nothing', { method: 'POST' })).status, 404);
  assert.equal((await fetch(base + '/api/command')).status, 405);
});

test('static: web/ files with MIME types and no caching; traversal refused', async () => {
  const idx = await fetch(base + '/');
  assert.ok([200, 404].includes(idx.status));
  if (idx.status === 200) assert.match(idx.headers.get('content-type'), /text\/html/);
  const ref = await fetch(base + '/reference/red-arch-at-sundown.html');
  assert.equal(ref.status, 200); assert.match(ref.headers.get('cache-control'), /no-store/);
  assert.equal((await fetch(base + '/../package.json')).status, 404);
  assert.equal((await fetch(base + '/%2e%2e/package.json')).status, 404);
  const { mimeFor } = await import('../../server/static.js');
  assert.equal(mimeFor('a.mjs'), 'text/javascript; charset=utf-8'); assert.equal(mimeFor('a.json'), 'application/json; charset=utf-8');
  assert.equal(mimeFor('a.png'), 'image/png'); assert.equal(mimeFor('a.md'), 'text/markdown; charset=utf-8');
});

test('audit round 1: null/array bodies are not 500s; CORS only for local origins; cached code is strict', async () => {
  for (const raw of ['null', '[]', '"x"', '1']) {
    const r = await fetch(base + '/api/command', { method: 'POST', headers: { 'content-type': 'application/json' }, body: raw });
    assert.equal(r.status, 200, raw); const j = await r.json(); assert.equal(j.actions[0].type, 'noop');
  }
  const evil = await fetch(base + '/api/health', { headers: { origin: 'https://evil.example' } });
  assert.equal(evil.headers.get('access-control-allow-origin'), null);
  const pre = await fetch(base + '/api/command', { method: 'OPTIONS', headers: { origin: 'https://evil.example' } });
  assert.equal(pre.status, 204); assert.equal(pre.headers.get('access-control-allow-origin'), null);
  const local = await fetch(base + '/api/health', { headers: { origin: 'http://localhost:5173' } });
  assert.equal(local.headers.get('access-control-allow-origin'), 'http://localhost:5173');
  const list = await (await fetch(base + '/api/assets')).json();
  assert.ok(list.length >= 1); for (const a of list) assert.ok(a.code.startsWith("'use strict';"), a.id);
  // "a clock tower" is not the cached lighthouse (or any cached tower): it goes to the Ministry, not the archive
  const fresh = await (await post('/api/codegen', { request: 'a clock tower', snapshot })).text();
  assert.doesNotMatch(fresh, /"mind":"cache"/); assert.match(fresh, /"mind":"mock"/);
});

test('POST /api/sketch -> a massing (≤16 palette parts) for any request; the footprint follows the parts', async () => {
  for (const [request, family, category] of [['a giant rubber duck in the lake', 'duck', 'prop'], ['a lighthouse on the cliff', 'lighthouse', 'landmark'], ['a bathhouse', 'generic', 'building'], ['a giant tree', 'tree', 'nature']]) {
    const r = await post('/api/sketch', { request, snapshot }); const j = await r.json();
    assert.equal(r.status, 200, request); assert.equal(j.meta.mind, 'mock');
    assert.ok(j.parts.length >= 3 && j.parts.length <= 16, request); assert.equal(j.family, family); assert.equal(j.category, category);
    assert.ok(j.footprint.w >= 1 && j.footprint.d >= 1 && j.height > 0, request); assert.ok(j.name, request);
    for (const p of j.parts) { assert.match(p.color, /^#[0-9a-f]{6}$/); assert.ok(['box', 'cylinder', 'cone', 'sphere', 'gable', 'dome'].includes(p.shape)); }
  }
  const empty = await (await post('/api/sketch', {})).json();
  assert.ok(empty.parts.length >= 3); // never nothing
});

test('POST /api/codegen: every keyword family streams status then done with a category; the generic fallback is raised from the sketch', async () => {
  const cases = { 'a giant rubber duck in the lake': ['duck', 'prop', 'Giant Rubber Duck'], 'a dragon statue in the square': ['dragon', 'landmark', 'Dragon Statue'], 'build a rocket': ['rocket', 'landmark', 'Rocket'], 'a boat on the lake': ['boat', 'prop', 'Boat'], 'a giant tree': ['tree', 'nature', 'Giant Tree'], 'a statue of our minister': ['statue', 'landmark', 'Statue Of Our Minister'], 'a bathhouse': ['generic', 'building', 'Bathhouse'] };
  for (const [request, [stock, category, name]] of Object.entries(cases)) {
    const text = await (await post('/api/codegen', { request, snapshot })).text();
    const events = [...text.matchAll(/^event: (\w+)\ndata: (.*)$/gm)].map(m => [m[1], JSON.parse(m[2])]);
    assert.deepEqual(events.filter(e => e[0] === 'status').map(e => e[1].stage), ['drafting', 'writing', 'checking'], request);
    const done = events.find(e => e[0] === 'done'); assert.ok(done, request);
    assert.equal(done[1].meta.stock, stock, request); assert.equal(done[1].asset.meta.category, category, request); assert.equal(done[1].asset.name, name, request);
    assert.match(done[1].asset.code, /function build\(api\)/); assert.ok(done[1].asset.code.startsWith("'use strict';"));
    if (stock === 'generic') assert.match(done[1].asset.code, /massing sketch/);
  }
  // the second rocket is instant from the archive; "a giant rocket" is a new thing
  assert.match(await (await post('/api/codegen', { request: 'another rocket', snapshot })).text(), /"mind":"cache"/);
  assert.doesNotMatch(await (await post('/api/codegen', { request: 'a giant rocket', snapshot })).text(), /"mind":"cache"/);
});

test('GET /api/stock lists the mock library; /api/stock/<key>.js serves raw build(api) code for the gallery', async () => {
  const list = await (await fetch(base + '/api/stock')).json();
  assert.deepEqual(list.map(s => s.key).sort(), ['boat', 'dragon', 'duck', 'generic', 'lighthouse', 'rocket', 'statue', 'tower', 'tree', 'windclock']);
  const r = await fetch(base + '/api/stock/rocket.js');
  assert.equal(r.status, 200); assert.match(r.headers.get('content-type'), /javascript/); assert.match(await r.text(), /^function build\(api\)/);
  assert.match(await (await fetch(base + '/api/stock/generic.js?request=a%20bathhouse')).text(), /massing sketch/);
  assert.equal((await fetch(base + '/api/stock/nope.js')).status, 404);
  // and a cached generated asset's raw code, the same way (the rocket was cached by the codegen test above)
  const list2 = await (await fetch(base + '/api/assets')).json();
  const rocket = list2.find(a => a.name === 'Rocket');
  const code = await fetch(base + `/api/assets/${rocket.id}.js`);
  assert.equal(code.status, 200); assert.match(await code.text(), /^'use strict';\nfunction build\(api\)/);
  assert.equal((await fetch(base + '/api/assets/gen-nope.js')).status, 404);
});

test('POST /api/letter: story purposes (election, envoy, gift thanks, the four shadeling letters) with from / kind and executable options', async () => {
  const nations = { ...snapshot, neighbours: [{ id: 'n1', name: 'Sorrento-on-the-Rock', leaderName: 'Donna Perla', temperament: 'proud', attitude: 50 }, { id: 'n2', name: 'Little Lantern', leaderName: 'Baker Odo', temperament: 'warm', attitude: 62 }, { id: 'n3', name: 'Grey Harbour', leaderName: 'Harbourmaster Brusco', temperament: 'gruff', attitude: 40 }] };
  const election = await (await post('/api/letter', { purpose: 'election', snapshot: nations })).json();
  assert.equal(election.from.kind, 'neighbour'); assert.equal(election.kind, 'election');
  for (const n of ['Sorrento-on-the-Rock', 'Little Lantern', 'Grey Harbour']) assert.match(election.body, new RegExp(n));
  assert.ok(election.options.some(o => o.says === "let's go to the moon")); assert.ok(election.options.some(o => o.says === 'build a rocket'));
  const envoy = await (await post('/api/letter', { purpose: 'envoy', context: { neighbour: 'n2', kind: 'trade', give: { wood: 6 }, get: { food: 8 } }, snapshot: nations })).json();
  assert.equal(envoy.from.id, 'n2'); assert.equal(envoy.kind, 'envoy'); assert.match(envoy.body, /8 food for 6 wood/); assert.match(envoy.options[0].says, /accept the trade with Little Lantern/);
  const thanks = await (await post('/api/letter', { purpose: 'gift_thanks', context: { neighbour: 'n3', gift: 'a basket of bread' }, snapshot: nations })).json();
  assert.equal(thanks.from.name, 'Grey Harbour'); assert.equal(thanks.kind, 'thanks'); assert.match(thanks.body, /basket of bread/i);
  // "them" with no neighbour given = the nation that wrote most recently (unread), else the friendliest
  const them = await (await post('/api/letter', { purpose: 'gift_thanks', context: { gift: 'some wood' }, snapshot: { ...nations, unread: [{ id: 'l4', from: 'Sorrento-on-the-Rock', subject: 'x' }] } })).json();
  assert.equal(them.from.id, 'n1');
  const friendliest = await (await post('/api/letter', { purpose: 'gift_thanks', context: { gift: 'some wood' }, snapshot: nations })).json();
  assert.equal(friendliest.from.id, 'n2');
  for (const p of ['shadeling_contact', 'shadeling_seed', 'shadeling_golden', 'shadeling_farewell']) {
    const l = await (await post('/api/letter', { purpose: p, snapshot: nations })).json();
    assert.equal(l.from.id, 'shadelings', p); assert.equal(l.kind, 'shadeling', p);
    const lines = l.body.split('\n').filter(x => x.trim() && !x.startsWith('—'));
    assert.ok(lines.length >= 3 && lines.length <= 7, p); for (const line of lines) assert.ok(line.split(' ').length <= 10, `${p}: "${line}"`);
    assert.ok(l.options.length >= 2, p);
  }
  // the commands those options speak all map in the mock parser (no noop), on the right scene
  const says = new Set();
  for (const l of [election, envoy, thanks]) for (const o of l.options) says.add(['earth', o.says]);
  for (const p of ['shadeling_contact', 'shadeling_seed', 'shadeling_golden', 'shadeling_farewell']) for (const o of (await (await post('/api/letter', { purpose: p, snapshot: nations })).json()).options) says.add(['moon', o.says]);
  for (const [scene, text] of says) {
    const snap = scene === 'earth' ? { ...nations, unread: [{ id: 'l1', from: 'Little Lantern', subject: 'x' }] } : nations;
    const j = await (await post('/api/command', { transcript: text, scene, snapshot: snap })).json();
    assert.notEqual(j.actions[0].type, 'noop', `${scene}: "${text}" -> ${JSON.stringify(j.actions)}`);
  }
});
