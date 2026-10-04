// Exercises the LIVE code path with a fake Anthropic client: request shape (betas, fallbacks, cached system,
// output_config), refusal / max_tokens handling, error classification, mock fallback, and the codegen repair loop.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
import { createMind, MindError, classifyError, FALLBACK_BETA, FAST_MODE_BETA } from '../../server/llm.js';
import { createRoutes } from '../../server/routes.js';
import { loadCatalogue } from '../../server/catalogue.js';
import { loadLetterTemplates } from '../../server/mock/letters.js';
import { createAssetStore } from '../../server/assets.js';
import { STOCK } from '../../server/mock/codegen.js';

const msg = (text, extra = {}) => ({ id: 'msg_1', model: 'claude-fable-5-1', stop_reason: 'end_turn', stop_details: null, content: [{ type: 'thinking', thinking: '', signature: 'x' }, { type: 'text', text }], usage: { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 900, cache_creation_input_tokens: 0 }, ...extra });

function fakeClient(script) {
  const calls = [];
  const next = () => { const r = script.shift(); if (r instanceof Error) throw r; return r; };
  return {
    calls,
    beta: { messages: {
      async create(params, opts) { calls.push({ params, opts }); return next(); },
      stream(params, opts) {
        calls.push({ params, opts });
        const handlers = {};
        const final = next();
        return { on(ev, fn) { handlers[ev] = fn; return this; }, async finalMessage() { const t = final.content.filter(b => b.type === 'text').map(b => b.text).join(''); if (t && handlers.text) handlers.text(t); return final; } };
      },
    } },
  };
}

const catalogue = await loadCatalogue();
const letters = await loadLetterTemplates();
const snapshot = { agents: [{ id: 'a1', name: 'Olla' }], buildings: [{ id: 'b1', kind: 'windmill', name: 'Old mill', status: 'done' }], letters: [], neighbours: [] };
const config = { mock: false, models: { logic: 'claude-fable-5-1', visual: 'claude-opus-5-5' }, liveFallbackToMock: true, mockCodegenMs: 50 };
const mkRoutes = (client, assetsDir, overrides = {}) => createRoutes({ config: { ...config, ...overrides }, catalogue, mind: createMind(config, { client }), letters, assets: createAssetStore(assetsDir), log: () => {} });
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'agora-live-'));

test('command: request shape follows the model facts and the answer is normalised', async () => {
  const client = fakeClient([msg(JSON.stringify({ actions: [{ type: 'build', kind: 'bakery', at: { mode: 'near', ref: 'windmill' }, count: null }, { type: 'appoint_minister', agentId: 'ghost' }], say: { from: 'ministry', text: 'Marked.' } }))]);
  const r = await mkRoutes(client, tmp()).command({ transcript: 'bakery near the mill', pointer: null, snapshot });
  const { params, opts } = client.calls[0];
  assert.equal(params.model, 'claude-fable-5-1');
  assert.deepEqual(params.betas, [FALLBACK_BETA]); assert.equal(params.fallbacks, 'default');
  assert.equal(params.thinking, undefined); assert.equal(params.temperature, undefined); assert.equal(params.tool_choice, undefined);
  assert.equal(params.output_config.effort, 'low'); assert.equal(params.output_config.format.type, 'json_schema');
  assert.equal(params.output_config.format.schema.additionalProperties, false);
  assert.deepEqual(params.system[0].cache_control, { type: 'ephemeral' }); assert.match(params.system[0].text, /interpreter/);
  assert.match(params.system[0].text, /"id":"windmill"/); // catalogue in the cached prefix
  assert.equal(params.messages.length, 1); assert.equal(params.messages[0].role, 'user'); assert.match(params.messages[0].content[0].text, /bakery near the mill/);
  assert.ok(opts.timeout <= 30000);
  assert.equal(r.meta.mind, 'live'); assert.equal(r.meta.usage.cacheRead, 900);
  assert.deepEqual(r.actions, [{ type: 'build', kind: 'bakery', at: { mode: 'near', ref: 'b1' } }]); // ghost appointment dropped, ref resolved
  assert.deepEqual(r.say, { from: 'ministry', text: 'Marked.' });
});

test('society and letter use medium / low effort and the right schemas', async () => {
  const client = fakeClient([
    msg(JSON.stringify({ letters: [{ from: { kind: 'agent', id: 'a1', name: 'Olla' }, subject: 'Bread', body: 'x', kind: 'idea', options: [{ label: 'Yes', says: 'yes' }] }], events: [{ kind: 'mood', agentId: 'a1', neighbourId: null, delta: 9, note: 'cheer' }] })),
    msg(JSON.stringify({ subject: 'Hi', body: 'There.', options: [] })),
  ]);
  const routes = mkRoutes(client, tmp());
  const s = await routes.society({ snapshot, recent: [] });
  assert.equal(client.calls[0].params.output_config.effort, 'medium'); assert.ok('letters' in client.calls[0].params.output_config.format.schema.properties);
  assert.equal(s.letters[0].subject, 'Bread'); assert.equal(s.events[0].delta, 5);
  const l = await routes.letter({ purpose: 'reply', agent: { name: 'Olla' }, snapshot });
  assert.equal(client.calls[1].params.output_config.effort, 'low'); assert.equal(l.subject, 'Hi'); assert.equal(l.meta.mind, 'live');
});

test('refusal, max_tokens and SDK errors fall back to the mock mind (and surface the cause)', async () => {
  const refusal = msg('', { stop_reason: 'refusal', stop_details: { category: 'general_harms', explanation: 'nope' } });
  const truncated = msg('{"actions": [', { stop_reason: 'max_tokens' });
  const client = fakeClient([refusal, truncated, new Anthropic.RateLimitError(429, { error: { message: 'slow down' } }, 'slow down', new Headers())]);
  const routes = mkRoutes(client, tmp());
  for (const code of ['refusal', 'truncated', 'rate_limit']) {
    const r = await routes.command({ transcript: 'a windmill there', pointer: { x: 1, z: 1 }, snapshot });
    assert.equal(r.meta.mind, 'mock'); assert.equal(r.meta.liveError.code, code);
    assert.deepEqual(r.actions, [{ type: 'build', kind: 'windmill', at: { mode: 'pointer' } }]);
  }
  // with fallback disabled the error propagates
  const strict = mkRoutes(fakeClient([refusal]), tmp(), { liveFallbackToMock: false });
  await assert.rejects(() => strict.command({ transcript: 'x', snapshot }), (e) => e instanceof MindError && e.code === 'refusal');
});

test('classifyError: most specific first, connection before generic APIError', () => {
  assert.equal(classifyError(new Anthropic.AuthenticationError(401, {}, 'bad key', new Headers())).code, 'auth');
  assert.equal(classifyError(new Anthropic.BadRequestError(400, {}, 'bad', new Headers())).code, 'bad_request');
  assert.equal(classifyError(new Anthropic.APIConnectionError({ message: 'down' })).code, 'network');
  assert.equal(classifyError(new Anthropic.APIConnectionTimeoutError()).code, 'timeout');
  assert.equal(classifyError(new Anthropic.InternalServerError(503, {}, 'overloaded', new Headers())).code, 'server');
  assert.equal(classifyError(new Error('boom')).code, 'unknown');
});

test('codegen: Opus 5.5 stream at effort high, repairs invalid code by continuing the conversation, caches the asset', async () => {
  const bad = { name: 'Lighthouse', aliases: ['beacon'], meta: { footprint: { w: 3, d: 3 }, cost: { stone: 10, wood: 0, coin: 0, food: 0, goods: 0 }, workers: 2, skill: 'building', buildSeconds: 60, perDay: { food: 0, wood: 0, stone: 0, coin: 0, goods: 0 }, housing: 0, desc: 'd' }, code: 'function build(api){ window.alert(1); return api.group(); }' };
  const good = { ...bad, code: STOCK.lighthouse.code };
  const client = fakeClient([msg(JSON.stringify(bad), { model: 'claude-opus-5-5' }), msg(JSON.stringify(good), { model: 'claude-opus-5-5' })]);
  const dir = tmp();
  const routes = mkRoutes(client, dir);
  const events = [];
  const sse = { closed: false, send: (e, d) => events.push([e, d]), end() {} };
  await routes.codegen({ request: 'a lighthouse on the cliff', snapshot }, sse);
  const p0 = client.calls[0].params;
  assert.equal(p0.model, 'claude-opus-5-5'); assert.equal(p0.output_config.effort, 'high'); assert.equal(p0.thinking, undefined);
  assert.deepEqual(p0.betas, [FALLBACK_BETA, FAST_MODE_BETA]); assert.equal(p0.speed, 'fast'); assert.equal(p0.fallbacks, 'default'); // fast mode first
  assert.match(p0.system[0].text, /Build API/); assert.deepEqual(p0.system[0].cache_control, { type: 'ephemeral' });
  const p1 = client.calls[1].params;
  assert.equal(p1.messages.length, 3); assert.equal(p1.messages[1].role, 'assistant'); assert.equal(p1.messages[1].content[0].type, 'thinking'); // passed back unmodified
  assert.match(p1.messages[2].content[0].text, /forbidden tokens: window/);
  assert.deepEqual(events.filter(e => e[0] === 'status').map(e => e[1].stage), ['drafting', 'writing', 'checking', 'repairing', 'writing', 'checking']);
  const done = events.find(e => e[0] === 'done');
  assert.equal(done[1].meta.mind, 'live'); assert.equal(done[1].meta.speed, 'fast'); assert.equal(done[1].asset.name, 'Lighthouse'); assert.equal(done[1].asset.meta.workers, 2);
  assert.equal(done[1].asset.meta.category, 'landmark'); // guessed from the name when the model gives none
  assert.ok(fs.readdirSync(dir).some(f => f.startsWith('gen-lighthouse-')));
  assert.equal(routes.assets().length, 1);
});

test('codegen: three invalid attempts -> mock fallback with a note; closed client stops the stream', async () => {
  const bad = (code) => msg(JSON.stringify({ name: 'X', aliases: [], meta: {}, code }), { model: 'claude-opus-5-5' });
  const client = fakeClient([bad('nope('), bad('function build(api){ fetch(1) }'), bad('function build(api){ return }')]);
  const routes = mkRoutes(client, tmp());
  const events = [];
  await routes.codegen({ request: 'an observatory', snapshot }, { closed: false, send: (e, d) => events.push([e, d]), end() {} });
  assert.equal(client.calls.length, 3);
  const done = events.find(e => e[0] === 'done');
  assert.equal(done[1].meta.mind, 'mock'); assert.equal(done[1].asset.name, 'Observatory');
  assert.ok(events.some(e => e[0] === 'status' && /improvise/.test(e[1].note)));
});

test('codegen: fast mode 429 / 400 falls back to the standard lane within the same attempt; AGORA_FAST_MODE=0 skips it', async () => {
  const good = { name: 'Boat', aliases: ['tekne'], meta: { footprint: { w: 5, d: 2 }, cost: { wood: 10, stone: 0, coin: 0, food: 0, goods: 0 }, workers: 2, skill: 'crafting', buildSeconds: 60, perDay: { food: 0, wood: 0, stone: 0, coin: 0, goods: 0 }, housing: 0, desc: 'd', category: 'prop' }, code: STOCK.boat.code };
  for (const err of [new Anthropic.RateLimitError(429, { error: { message: 'fast lane busy' } }, 'busy', new Headers()), new Anthropic.BadRequestError(400, {}, 'speed not supported', new Headers())]) {
    const client = fakeClient([err, msg(JSON.stringify(good), { model: 'claude-opus-5-5' })]);
    const events = [];
    await mkRoutes(client, tmp()).codegen({ request: 'a boat on the lake', snapshot }, { closed: false, send: (e, d) => events.push([e, d]), end() {} });
    assert.equal(client.calls.length, 2);
    assert.equal(client.calls[0].params.speed, 'fast'); assert.equal(client.calls[1].params.speed, undefined); assert.deepEqual(client.calls[1].params.betas, [FALLBACK_BETA]);
    const done = events.find(e => e[0] === 'done');
    assert.equal(done[1].meta.mind, 'live'); assert.equal(done[1].meta.speed, 'standard'); assert.equal(done[1].asset.meta.category, 'prop');
    assert.ok(events.some(e => e[0] === 'status' && /fast lane/.test(e[1].note)));
  }
  const client = fakeClient([msg(JSON.stringify(good), { model: 'claude-opus-5-5' })]);
  await mkRoutes(client, tmp(), { fastMode: false }).codegen({ request: 'a boat', snapshot }, { closed: false, send() {}, end() {} });
  assert.equal(client.calls[0].params.speed, undefined); assert.deepEqual(client.calls[0].params.betas, [FALLBACK_BETA]);
});

test('sketch: logic model at effort low with the sketch schema; a bad answer falls back to the mock massing', async () => {
  const live = { name: 'Duck', category: 'prop', footprint: { w: 3, d: 2 }, height: 3, parts: [{ shape: 'sphere', x: 0, y: 1.2, z: 0, w: 2.4, h: 2.4, d: 2.4, r: 1.2, rot: 0, color: '#d9a441' }, { shape: 'sphere', x: 0.8, y: 2.4, z: 0, w: 1.6, h: 1.6, d: 1.6, r: 0.8, rot: 0, color: '#d9a441' }, { shape: 'box', x: 1.5, y: 2.3, z: 0, w: 0.6, h: 0.3, d: 0.4, r: 0, rot: 0, color: 'orange' }] };
  const client = fakeClient([msg(JSON.stringify(live)), msg(JSON.stringify({ name: 'x', parts: [] }))]);
  const routes = mkRoutes(client, tmp());
  const s = await routes.sketch({ request: 'a rubber duck in the lake', snapshot });
  assert.equal(client.calls[0].params.output_config.effort, 'low'); assert.ok('parts' in client.calls[0].params.output_config.format.schema.properties);
  assert.ok(client.calls[0].opts.timeout <= 12000); assert.equal(client.calls[0].opts.maxRetries, 0);
  assert.equal(s.meta.mind, 'live'); assert.equal(s.parts.length, 3); assert.equal(s.parts[2].color, '#e8dcc4'); // off-palette colour -> limestone
  const m = await routes.sketch({ request: 'a rubber duck in the lake', snapshot });
  assert.equal(m.meta.mind, 'mock'); assert.equal(m.meta.liveError.code, 'bad_json'); assert.ok(m.parts.length >= 3);
});

test('command carries the scene: moon actions are dropped on earth, go_moon on the moon; letters come from unread/recent too', async () => {
  const client = fakeClient([
    msg(JSON.stringify({ actions: [{ type: 'moon', do: 'seed' }, { type: 'go_moon' }], say: null })),
    msg(JSON.stringify({ actions: [{ type: 'go_moon' }, { type: 'moon', do: 'greet', text: 'we come in peace' }], say: null })),
    msg(JSON.stringify({ actions: [{ type: 'reply_letter', letterId: 'l7', decision: 'yes', text: 'yes' }], say: null })),
  ]);
  const routes = mkRoutes(client, tmp());
  const earth = await routes.command({ transcript: 'x', scene: 'earth', snapshot });
  assert.deepEqual(earth.actions, [{ type: 'go_moon' }]); assert.equal(earth.scene, 'earth');
  assert.match(client.calls[0].params.messages[0].content[0].text, /"scene":"earth"/);
  const moon = await routes.command({ transcript: 'x', scene: 'moon', snapshot });
  assert.deepEqual(moon.actions, [{ type: 'moon', do: 'greet', text: 'we come in peace' }]);
  const r = await routes.command({ transcript: 'yes', snapshot: { ...snapshot, unread: [{ id: 'l7', from: 'Olla', subject: 'Bread' }] } });
  assert.deepEqual(r.actions, [{ type: 'reply_letter', letterId: 'l7', decision: 'yes', text: 'yes' }]);
});
