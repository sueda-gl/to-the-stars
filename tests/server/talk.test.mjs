// POST /api/talk (ART_DIRECTION §11): a folk's bubble answer. Mock replies by intent through the real server, the schema's
// union count, the normaliser, and the live path with a fake client (effort low, the talk prompt, mock fallback).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createServer } from '../../server/index.js';
import { TALK_SCHEMA, normaliseTalk } from '../../server/schemas.js';
import { createMind, FALLBACK_BETA } from '../../server/llm.js';
import { createRoutes } from '../../server/routes.js';
import { loadCatalogue } from '../../server/catalogue.js';
import { loadLetterTemplates } from '../../server/mock/letters.js';
import { createAssetStore } from '../../server/assets.js';
import { trimReply } from '../../server/mock/talk.js';

let app, base;
const tmpAssets = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-talk-'));
before(async () => { app = await createServer({ mock: true, mockReason: 'test', mockCodegenMs: 250, assetsDir: tmpAssets, logLevel: 'silent', dotenv: false }); base = `http://127.0.0.1:${await app.listen(0)}`; });
after(async () => { await app.close(); fs.rmSync(tmpAssets, { recursive: true, force: true }); });

const post = (p, body) => fetch(base + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
const agent = { id: 'f1', name: 'Pim', species: 'flit', trade: 'builder', traits: ['proud'], mood: 72, moodWord: 'well', skills: { building: 8, baking: 2 }, known: {}, job: 'gatherer at the camp', fleet: 'The Builders', homeless: true };
const snapshot = { name: 'Agora', day: 2, stage: 'camp', res: { food: 40, wood: 20, stone: 10, coin: 10, goods: 0 }, hungry: false, buildings: [{ id: 'b1', kind: 'house', name: 'House', status: 'done' }], agents: [{ id: 'f1', name: 'Pim', trade: 'builder', work: 'gatherer at the camp' }, { id: 'f2', name: 'Olla', trade: 'diplomat', work: 'minister' }], minister: 'f2', neighbours: [{ id: 'n2', name: 'Little Lantern', attitude: 62 }] };
const short = s => (s.match(/[.!?]+/g) || []).length <= 3 && s.length <= 170;   // two sentences (a two-word question may ride with the next)

test('GET /api/health advertises talk', async () => {
  const j = await (await fetch(base + '/api/health')).json();
  assert.equal(j.talk, true); assert.equal(j.timeouts.talk, 15000);
});

test('POST /api/talk: short plain replies by intent, in character, with actions for builds and rest', async () => {
  const cases = {
    'hello': /Pim|propeller|Good day|Hello/,
    'how are you?': /roof|house|outside|well|Good/i,
    'what do you do?': /gatherer at the camp/,
    'what are you good at?': /best here|Ten out of ten/,
    'what do you think of the minister?': /Olla/,
    'thank you': /Naturally/,
    'which fleet are you in?': /The Builders/,
  };
  for (const [text, re] of Object.entries(cases)) {
    const r = await post('/api/talk', { agentId: 'f1', agent, text, history: [], snapshot }); const j = await r.json();
    assert.equal(r.status, 200, text); assert.equal(j.meta.mind, 'mock'); assert.equal(j.agentId, 'f1');
    assert.ok(short(j.reply), `${text} -> "${j.reply}"`); assert.match(j.reply, re, text);
    assert.ok(Number.isInteger(j.mood) && Math.abs(j.mood) <= 5);
  }
  const build = await (await post('/api/talk', { agentId: 'f1', agent, text: 'could you build a well?', snapshot })).json();
  assert.deepEqual(build.action, { type: 'build', request: 'a well', text: 'build a well' }); assert.match(build.reply, /well/);
  const rest = await (await post('/api/talk', { agentId: 'f1', agent, text: 'go and rest', snapshot })).json();
  assert.equal(rest.action.type, 'rest');
  const chat = await (await post('/api/talk', { agentId: 'f1', agent, text: 'lovely weather', snapshot })).json();
  assert.equal(chat.action, null);
  const hungry = await (await post('/api/talk', { agentId: 'f1', agent, text: 'how are you?', snapshot: { ...snapshot, hungry: true } })).json();
  assert.match(hungry.reply, /ungry|stomach/);
  const timid = await (await post('/api/talk', { agentId: 'f1', agent: { ...agent, traits: ['timid'] }, text: 'what are you good at?', snapshot })).json();
  assert.match(timid.reply, /Others are better/);
  const empty = await (await post('/api/talk', {})).json();
  assert.ok(empty.reply && short(empty.reply), 'never nothing');
});

test('TALK_SCHEMA has no union-typed parameters; normaliseTalk trims, clamps and drops bad actions', () => {
  const unions = (s) => { let n = 0; const w = (x) => { if (!x || typeof x !== 'object') return; if (x.anyOf || Array.isArray(x.type)) n++; if (x.properties) Object.values(x.properties).forEach(w); if (x.items) w(x.items); if (x.anyOf) x.anyOf.forEach(w); }; w(s); return n; };
  assert.equal(unions(TALK_SCHEMA), 0);
  assert.deepEqual(TALK_SCHEMA.required, ['reply', 'mood', 'action']); assert.equal(TALK_SCHEMA.additionalProperties, false);
  const t = normaliseTalk({ reply: 'One. Two. Three.', mood: 9, action: { type: 'build', request: 'a bakery near the windmill', text: '' } }, { trim: trimReply });
  assert.deepEqual(t, { reply: 'One. Two.', mood: 5, action: { type: 'build', request: 'a bakery near the windmill', text: '' } });
  assert.equal(normaliseTalk({ reply: 'Hi.', mood: 0, action: { type: 'none', request: '', text: '' } }).action, null);
  assert.equal(normaliseTalk({ reply: 'Hi.', mood: 'x', action: { type: 'build', request: '', text: '' } }).action, null, 'a build without a request is nothing');
  assert.equal(normaliseTalk({ reply: 'Hi.', mood: 0, action: { type: 'dance' } }).action, null);
  assert.deepEqual(normaliseTalk({ reply: 'Yes.', mood: -2, action: { type: 'assign', request: '', text: 'the bakery' } }).action, { type: 'assign', request: '', text: 'the bakery' });
  assert.equal(normaliseTalk({ reply: '   ', mood: 0, action: { type: 'none' } }), null);
  assert.equal(normaliseTalk(null), null);
});

test('live path: effort low, the talk prompt, structured output; a bad answer falls back to the mock', async () => {
  const msg = (text) => ({ id: 'msg_1', model: 'claude-fable-5-1', stop_reason: 'end_turn', content: [{ type: 'text', text }], usage: { input_tokens: 10, output_tokens: 5 } });
  const calls = [];
  const script = [msg(JSON.stringify({ reply: 'A well? Yes. I will fetch the others. And we start at dawn, with songs.', mood: 2, action: { type: 'build', request: 'a well in the square', text: '' } })), msg('not json at all')];
  const client = { beta: { messages: { async create(params, opts) { calls.push({ params, opts }); return script.shift(); } } } };
  const catalogue = await loadCatalogue(); const letters = await loadLetterTemplates();
  const config = { mock: false, models: { logic: 'claude-fable-5-1', visual: 'claude-opus-5-5' }, liveFallbackToMock: true };
  const routes = createRoutes({ config, catalogue, mind: createMind(config, { client }), letters, assets: createAssetStore(tmpAssets), log: () => {} });
  const r = await routes.talk({ agentId: 'f1', agent, text: 'could you build a well?', history: [{ you: 'hi', me: 'Hello.' }], snapshot });
  const { params, opts } = calls[0];
  assert.equal(params.model, 'claude-fable-5-1'); assert.equal(params.output_config.effort, 'low'); assert.equal(params.output_config.format.type, 'json_schema');
  assert.deepEqual(params.betas, [FALLBACK_BETA]); assert.ok(opts.timeout <= 15000); assert.equal(opts.maxRetries, 0);
  assert.match(params.system[0].text, /speech bubble/); assert.deepEqual(params.system[0].cache_control, { type: 'ephemeral' });
  const user = JSON.parse(params.messages[0].content[0].text);
  assert.equal(user.text, 'could you build a well?'); assert.equal(user.agent.name, 'Pim'); assert.equal(user.history.length, 1); assert.equal(user.snapshot.minister, 'f2'); assert.equal(user.snapshot.agents[1].work, 'minister');
  assert.equal(r.meta.mind, 'live');
  assert.equal(r.reply, 'A well? Yes. I will fetch the others.', 'trimmed to two sentences');
  assert.deepEqual(r.action, { type: 'build', request: 'a well in the square', text: '' }); assert.equal(r.mood, 2);
  const r2 = await routes.talk({ agentId: 'f1', agent, text: 'how are you?', snapshot });
  assert.equal(r2.meta.mind, 'mock'); assert.equal(r2.meta.liveError.code, 'bad_json'); assert.ok(short(r2.reply));
});
