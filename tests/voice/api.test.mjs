import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApi, ApiError } from '../../web/js/net/api.js';

const enc = new TextEncoder();
const sseBody = (chunks, delay = 2) => new ReadableStream({
  async start(c) { for (const ch of chunks) { await new Promise(r => setTimeout(r, delay)); c.enqueue(enc.encode(ch)); } c.close(); },
});
const jsonRes = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json' } });
const sseRes = (chunks) => new Response(sseBody(chunks), { status: 200, headers: { 'content-type': 'text/event-stream' } });

test('JSON endpoints: method, body shape, parsed result', async () => {
  const seen = [];
  const api = createApi({ fetch: async (url, init) => { seen.push([url, init.method, init.body && JSON.parse(init.body)]); return jsonRes({ ok: true, echo: true }); } });
  await api.health();
  await api.command({ transcript: 'a house', pointer: { x: 1, z: 2 }, snapshot: { s: 1 } });
  await api.society({ snapshot: { s: 1 }, recent: ['x'] });
  await api.letter({ purpose: 'refusal', agent: { id: 'a1' }, context: 'tired', snapshot: {} });
  await api.sketch({ request: 'a duck', snapshot: {} });
  const assets = await api.assets();
  assert.deepEqual(seen.map(s => [s[0], s[1]]), [['/api/health', 'GET'], ['/api/command', 'POST'], ['/api/society', 'POST'], ['/api/letter', 'POST'], ['/api/sketch', 'POST'], ['/api/assets', 'GET']]);
  assert.deepEqual(seen[1][2], { transcript: 'a house', pointer: { x: 1, z: 2 }, selected: null, snapshot: { s: 1 } });
  assert.deepEqual(seen[3][2], { purpose: 'refusal', agent: { id: 'a1' }, context: 'tired', snapshot: {} });
  assert.deepEqual(assets, [], 'a non-array JSON becomes an empty asset list');
});

test('assets() accepts a bare array or { assets }', async () => {
  const a1 = createApi({ fetch: async () => jsonRes([{ id: 'x' }]) });
  assert.deepEqual(await a1.assets(), [{ id: 'x' }]);
  const a2 = createApi({ fetch: async () => jsonRes({ assets: [{ id: 'y' }] }) });
  assert.deepEqual(await a2.assets(), [{ id: 'y' }]);
});

test('structured errors: http, server, bad_json, timeout; one retry on network error only', async () => {
  const http = createApi({ fetch: async () => jsonRes({ error: { message: 'nope' } }, 400) });
  await assert.rejects(http.health(), e => e instanceof ApiError && e.code === 'http' && e.status === 400 && /nope/.test(e.message));
  const srv = createApi({ fetch: async () => new Response('boom', { status: 500 }) });
  await assert.rejects(srv.health(), e => e.code === 'server' && e.status === 500);
  const bad = createApi({ fetch: async () => new Response('<html>', { status: 200 }) });
  await assert.rejects(bad.health(), e => e.code === 'bad_json');
  const slow = createApi({ timeouts: { health: 20 }, fetch: (url, init) => new Promise((_, rej) => init.signal.addEventListener('abort', () => rej(init.signal.reason))) });
  await assert.rejects(slow.health(), e => e.code === 'timeout');
  let n = 0;
  const flaky = createApi({ retryDelayMs: 1, fetch: async () => { n++; if (n === 1) throw new TypeError('Failed to fetch'); return jsonRes({ ok: true }); } });
  assert.deepEqual(await flaky.health(), { ok: true }); assert.equal(n, 2);
  let m = 0;
  const dead = createApi({ retryDelayMs: 1, fetch: async () => { m++; throw new TypeError('Failed to fetch'); } });
  await assert.rejects(dead.health(), e => e.code === 'network'); assert.equal(m, 2, 'exactly one retry');
  let k = 0;
  const httpNoRetry = createApi({ retryDelayMs: 1, fetch: async () => { k++; return jsonRes({}, 503); } });
  await assert.rejects(httpNoRetry.health()); assert.equal(k, 1, 'http errors do not retry');
});

test('codegen: parses the SSE stream (status, done), split across chunks', async () => {
  const api = createApi({ fetch: async (url, init) => {
    assert.equal(init.headers.Accept, 'text/event-stream');
    assert.deepEqual(JSON.parse(init.body), { request: 'a lighthouse', kindHint: 'tower', snapshot: { s: 1 } });
    return sseRes(['event: status\ndata: {"stage":"drafting"}\n\nevent: stat', 'us\ndata: {"stage":"writing"}\n\n', 'event: done\ndata: {"asset":{"id":"lighthouse","name":"Lighthouse",', '"code":"function build(api){}"}}\n\n']);
  } });
  const statuses = [];
  let doneAsset = null;
  const h = api.codegen({ request: 'a lighthouse', kindHint: 'tower', snapshot: { s: 1 } }, { onStatus: s => statuses.push(s.stage), onDone: a => doneAsset = a });
  const asset = await h.done;
  assert.deepEqual(statuses, ['drafting', 'writing']);
  assert.equal(asset.id, 'lighthouse'); assert.equal(doneAsset, asset);
});

test('codegen: error event, stream without done, data-only framing, abort, non-SSE JSON', async () => {
  const errApi = createApi({ fetch: async () => sseRes(['event: status\ndata: {"stage":"checking"}\n\nevent: error\ndata: {"message":"the mind declined"}\n\n']) });
  let onErr = null;
  await assert.rejects(errApi.codegen({ request: 'x', snapshot: {} }, { onError: e => onErr = e }).done, e => e.code === 'server' && /declined/.test(e.message));
  await new Promise(r => setTimeout(r, 1));
  assert.equal(onErr?.code, 'server');

  const cut = createApi({ fetch: async () => sseRes(['event: status\ndata: {"stage":"writing"}\n\n']) });
  await assert.rejects(cut.codegen({ request: 'x', snapshot: {} }).done, e => e.code === 'stream');

  const dataOnly = createApi({ fetch: async () => sseRes(['data: {"type":"status","stage":"drafting"}\n\ndata: {"type":"done","asset":{"id":"a"}}\n\n']) });
  const st = [];
  assert.equal((await dataOnly.codegen({ request: 'x', snapshot: {} }, { onStatus: s => st.push(s.stage) }).done).id, 'a');
  assert.deepEqual(st, ['drafting']);

  const never = createApi({ fetch: async () => new Response(new ReadableStream({ start() {} }), { headers: { 'content-type': 'text/event-stream' } }) });
  const h = never.codegen({ request: 'x', snapshot: {} });
  setTimeout(() => h.abort(), 10);
  await assert.rejects(h.done, e => e.code === 'aborted');

  const cached = createApi({ fetch: async () => jsonRes({ asset: { id: 'cached' } }) });
  assert.equal((await cached.codegen({ request: 'x', snapshot: {} }).done).id, 'cached');

  const idle = createApi({ timeouts: { codegenIdle: 15 }, fetch: async () => new Response(new ReadableStream({ start() {} }), { headers: { 'content-type': 'text/event-stream' } }) });
  await assert.rejects(idle.codegen({ request: 'x', snapshot: {} }).done, e => e.code === 'timeout');
});

// ---------- reviewer findings (2026-10-03) ----------
import { TIMEOUTS } from '../../web/js/net/api.js';

test('client timeouts sit above the server live-model timeouts (command 25 s, letter 30 s, society 60 s)', () => {
  assert.ok(TIMEOUTS.command > 25000, 'command'); assert.ok(TIMEOUTS.letter > 30000, 'letter'); assert.ok(TIMEOUTS.society > 60000, 'society');
});

test('society passes wants through (the minister report is requested with ["report"])', async () => {
  const seen = [];
  const api = createApi({ fetch: async (url, init) => { seen.push(JSON.parse(init.body)); return jsonRes({ letters: [] }); } });
  await api.society({ snapshot: { s: 1 }, recent: [], wants: ['report'] });
  await api.society({ snapshot: { s: 1 } });
  assert.deepEqual(seen[0], { snapshot: { s: 1 }, recent: [], wants: ['report'] });
  assert.deepEqual(seen[1].wants, []);
});

test('sketch: a missing /api/sketch route resolves null once and is not asked again; other errors still throw', async () => {
  let n = 0;
  const api = createApi({ fetch: async () => { n++; return new Response(JSON.stringify({ error: 'no such endpoint' }), { status: 404 }); } });
  assert.equal(api.sketchAvailable, null);
  assert.equal(await api.sketch({ request: 'a duck', snapshot: {} }), null);
  assert.equal(api.sketchAvailable, false);
  assert.equal(await api.sketch({ request: 'a duck', snapshot: {} }), null);
  assert.equal(n, 1, 'probed once');
  const ok = createApi({ fetch: async () => jsonRes({ name: 'Duck', parts: [{ shape: 'sphere', r: 1 }] }) });
  assert.equal((await ok.sketch({ request: 'a duck', snapshot: {} })).name, 'Duck'); assert.equal(ok.sketchAvailable, true);
  const wrapped = createApi({ fetch: async () => jsonRes({ sketch: { name: 'Duck2', parts: [] } }) });
  assert.equal((await wrapped.sketch({ request: 'x', snapshot: {} })).name, 'Duck2');
  const srv = createApi({ fetch: async () => new Response('boom', { status: 500 }) });
  await assert.rejects(srv.sketch({ request: 'x', snapshot: {} }), e => e.code === 'server');
});

test('create: codegen alone when /api/sketch is 404; onSketch only when the sketch lands before codegen', async () => {
  const api = createApi({ fetch: async (url) => {
    if (url === '/api/sketch') return new Response('{"error":"no such endpoint"}', { status: 404 });
    return sseRes(['event: status\ndata: {"stage":"writing"}\n\nevent: done\ndata: {"asset":{"id":"duck"}}\n\n']);
  } });
  const sketches = [], statuses = [];
  const h = api.create({ request: 'a duck', snapshot: {} }, { onSketch: s => sketches.push(s), onStatus: s => statuses.push(s.stage) });
  const asset = await h.done;
  assert.equal(asset.id, 'duck'); assert.deepEqual(statuses, ['writing']);
  assert.equal(await h.sketch, null); assert.deepEqual(sketches, []); assert.equal(api.sketchAvailable, false);

  const fast = createApi({ fetch: async (url) => {
    if (url === '/api/sketch') return jsonRes({ name: 'Duck', parts: [] });
    return sseRes(['event: done\ndata: {"asset":{"id":"duck"}}\n\n'], 30);
  } });
  const got = [];
  const h2 = fast.create({ request: 'a duck', snapshot: {} }, { onSketch: s => got.push(s.name) });
  await h2.done; await h2.sketch;
  assert.deepEqual(got, ['Duck']);

  const slowSketch = createApi({ fetch: async (url) => {
    if (url === '/api/sketch') { await new Promise(r => setTimeout(r, 60)); return jsonRes({ name: 'Late', parts: [] }); }
    return sseRes(['event: done\ndata: {"asset":{"id":"duck"}}\n\n']);
  } });
  const late = [];
  const h3 = slowSketch.create({ request: 'a duck', snapshot: {} }, { onSketch: s => late.push(s) });
  await h3.done; await h3.sketch;
  assert.deepEqual(late, [], 'a sketch after codegen is ignored');
});

test('codegen: the total timeout bounds the whole stream, not only the headers', async () => {
  const api = createApi({ timeouts: { codegen: 40, codegenIdle: 10000 }, fetch: async () => {
    const body = new ReadableStream({ start(c) { c.enqueue(enc.encode('event: status\ndata: {"stage":"writing"}\n\n')); } });   // never closes
    return new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } });
  } });
  const t0 = Date.now();
  await assert.rejects(api.codegen({ request: 'x', snapshot: {} }).done, e => e.code === 'timeout');
  assert.ok(Date.now() - t0 < 2000);
});
