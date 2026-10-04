// /api/minds/* (ART_DIRECTION §18): the routes in mock mode through the real server, the schemas' union counts, the live
// path with a fake client (Haiku 4.5 persona calls: plain, cached persona prefix, no effort / fallbacks; Fable 5.1 for
// the cast and the director), bad answers -> mock, the server's budget, the cost accounting in health, /api/talk with a persona.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createServer } from '../../server/index.js';
import { createMinds, THINK_SCHEMA, CAST_SCHEMA, CONVERSE_TURN_SCHEMA, DIRECT_SCHEMA, REFLECT_SCHEMA, RATES, usdOf, MINDS_TIMEOUTS, personaBlock } from '../../server/minds.js';
import { createMind, FALLBACK_BETA } from '../../server/llm.js';
import { createRoutes } from '../../server/routes.js';
import { loadCatalogue } from '../../server/catalogue.js';
import { loadLetterTemplates } from '../../server/mock/letters.js';
import { createAssetStore } from '../../server/assets.js';
import { createGame } from '../../web/js/sim/index.js';

let app, base;
const tmpAssets = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-minds-'));
before(async () => { app = await createServer({ mock: true, mockReason: 'test', mockCodegenMs: 250, assetsDir: tmpAssets, logLevel: 'silent', dotenv: false }); base = `http://127.0.0.1:${await app.listen(0)}`; });
after(async () => { await app.close(); fs.rmSync(tmpAssets, { recursive: true, force: true }); });
const post = (p, body) => fetch(base + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

const run = (g, s) => { for (let t = 0; t < s; t += 0.5) g.tick(0.5); };
const settled = () => { const g = createGame({ seed: 7 }); g.spawnAll(); run(g, 4); g.introduceFleets({ every: 0.6, first: 0.3 }); run(g, 6); g.electMinister(g.state.agents.find(a => a.name === 'Olla').id); run(g, 8); return g; };
const unions = (s) => { let n = 0; const w = (x) => { if (!x || typeof x !== 'object') return; if (x.anyOf || Array.isArray(x.type)) n++; if (x.properties) Object.values(x.properties).forEach(w); if (x.items) w(x.items); if (x.anyOf) x.anyOf.forEach(w); } ; w(s); return n; };

test('GET /api/health reports the minds: status mock, models, budget, rates, the cached prefix estimate', async () => {
  const j = await (await fetch(base + '/api/health')).json();
  assert.equal(j.minds.status, 'mock'); assert.deepEqual(j.minds.models, { persona: 'claude-haiku-4-5', director: 'claude-fable-5-1' });
  assert.equal(j.minds.directorEveryMs, 600000); assert.equal(j.minds.budget.maxPerMin, 60); assert.equal(j.minds.usd.total, 0);
  assert.ok(j.minds.cache.sharedPrefixTokensEst > j.minds.cache.minimumToCache, 'the shared rules block is past Haiku 4.5\'s 4096-token cache minimum');
  assert.ok(j.minds.rates === undefined && j.minds.usd.rates['claude-fable-5-1'].input === 10);
  assert.deepEqual(j.minds.actions.slice(0, 3), ['work', 'rest', 'wander_to']);
});

test('the schemas: 0 union-typed parameters each, every key required', () => {
  for (const [n, s] of Object.entries({ THINK_SCHEMA, CAST_SCHEMA, CONVERSE_TURN_SCHEMA, DIRECT_SCHEMA, REFLECT_SCHEMA })) { assert.equal(unions(s), 0, n); assert.equal(s.additionalProperties, false); assert.deepEqual(s.required, Object.keys(s.properties)); }
  assert.deepEqual(THINK_SCHEMA.properties.intent.properties.type.enum.slice(0, 2), ['work', 'rest']);
});

test('POST /api/minds/* in mock mode: cast (distinct), think (executable), converse (alternating), reflect, direct; talk keeps its shape', async () => {
  const g = settled();
  const cast = await (await post('/api/minds/cast', g.castRequest())).json();
  assert.equal(cast.personas.length, 12); assert.equal(cast.meta.mind, 'mock'); assert.ok(cast.tensions.length >= 3);
  assert.equal(new Set(cast.personas.map(p => p.voice)).size, 12);
  assert.equal(g.castPersonas(cast), 12);
  const think = await (await post('/api/minds/think', g.thinkRequest('f1'))).json();
  assert.ok(['work', 'rest', 'wander_to', 'talk_to', 'help', 'complain', 'propose_venture', 'write_letter', 'vote', 'refuse', 'celebrate', 'steal', 'gossip'].includes(think.intent.type)); assert.equal(think.meta.mind, 'mock');
  assert.equal(typeof g.applyIntent('f1', think).ok, 'boolean');
  const a = g.state.agents[1], b = g.state.agents[2];
  const cid = g.applyIntent(a.id, { intent: { type: 'talk_to', target: b.id, text: 'Seen the sky?' } }).effects[0].conversationId;
  const conv = await (await post('/api/minds/converse', g.converseRequest(cid))).json();
  assert.ok(conv.lines.length >= 2); conv.lines.forEach((l, i) => assert.equal(l.speaker, i % 2 ? b.id : a.id)); assert.ok(conv.lines.every(l => l.text.split(' ').length <= 14));
  assert.ok(['none', 'letter', 'conflict'].includes(conv.outcome.spawns));
  g.applyConversation(cid, conv);
  const refl = await (await post('/api/minds/reflect', g.reflectRequest('f1'))).json();
  assert.ok(refl.reflection.length > 10);
  const dir = await (await post('/api/minds/direct', g.directRequest('start'))).json();
  assert.ok(dir.arc_note && dir.events.length >= 1 && dir.minister_briefing && dir.minister_briefing.body.includes('—'));
  assert.ok(g.applyDirection(dir).applied.length >= 1);
  const talk = await (await post('/api/talk', g.talkContext('f1', 'how are you?'))).json();
  assert.ok(talk.reply && typeof talk.mood === 'number' && 'action' in talk && talk.meta.mind === 'mock');
  const empty = await (await post('/api/minds/think', {})).json(); assert.equal(empty.intent.type, 'work'); assert.equal(empty.meta.empty, true);
  assert.equal((await post('/api/minds/dance', {})).status, 404);
});

test('AGORA_MINDS=off: the routes answer 503 off; health says off', async () => {
  const off = await createServer({ mock: true, mockReason: 'test', minds: 'off', assetsDir: tmpAssets, logLevel: 'silent', dotenv: false });
  const b = `http://127.0.0.1:${await off.listen(0)}`;
  const r = await fetch(b + '/api/minds/think', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
  assert.equal(r.status, 503); assert.equal((await r.json()).code, 'off');
  assert.equal((await (await fetch(b + '/api/health')).json()).minds.status, 'off');
  await off.close();
});

const msg = (text, extra = {}) => ({ id: 'msg_1', model: 'claude-haiku-4-5', stop_reason: 'end_turn', stop_details: null, content: [{ type: 'text', text }], usage: { input_tokens: 500, output_tokens: 80, cache_read_input_tokens: 5000, cache_creation_input_tokens: 0 }, ...extra });
function fakeClient(script) {
  const calls = [];
  return { calls, beta: { messages: { async create(params, opts) { calls.push({ params, opts }); const r = script.shift(); if (r instanceof Error) throw r; if (typeof r === 'function') return r(params); return r; } } } };
}
const liveConfig = (over = {}) => ({ mock: false, minds: 'on', models: { logic: 'claude-fable-5-1', visual: 'claude-opus-5-5' }, mindsModels: { persona: 'claude-haiku-4-5', director: 'claude-fable-5-1' }, mindsMaxPerMin: 60, directorEveryMs: 600000, liveFallbackToMock: true, ...over });

test('live think: Haiku 4.5, plain (no betas / fallbacks / effort / thinking), two cached system blocks (shared rules then the persona), volatile state last, 4.5 s one shot; usage accounted', async () => {
  const g = settled(); g.castPersonas();
  const client = fakeClient([msg(JSON.stringify({ intent: { type: 'talk_to', target: 'f2', text: 'Seen the sky?', place: '' }, say: 'Momo! A word about the sky, if you have a moment there.', memory_note: 'I went to talk to Momo.', mood_delta: 1 }))]);
  const minds = createMinds({ config: liveConfig(), mind: createMind(liveConfig(), { client }), log: () => {} });
  assert.equal(minds.status, 'live');
  const r = await minds.think(g.thinkRequest('f1'));
  const { params, opts } = client.calls[0];
  assert.equal(params.model, 'claude-haiku-4-5');
  assert.equal(params.betas, undefined); assert.equal(params.fallbacks, undefined); assert.equal(params.thinking, undefined); assert.equal(params.temperature, undefined);
  assert.deepEqual(params.output_config, { format: { type: 'json_schema', schema: THINK_SCHEMA } });
  assert.equal(params.system.length, 2); assert.match(params.system[0].text, /^# You are one of the folk of AGORA/); assert.match(params.system[1].text, /^# Your persona/); assert.match(params.system[1].text, /Nando/);
  assert.deepEqual(params.system[0].cache_control, { type: 'ephemeral' }); assert.deepEqual(params.system[1].cache_control, { type: 'ephemeral' });
  assert.ok(params.system[0].text.length / 3.8 > 4096, 'the shared prefix passes the Haiku 4.5 cache minimum');
  const user = JSON.parse(params.messages[0].content[0].text);
  assert.ok(user.now.job && user.memory && user.relationships && user.options.includes('gossip'));
  assert.equal(params.max_tokens, 400); assert.equal(opts.timeout, MINDS_TIMEOUTS.think); assert.equal(opts.maxRetries, 0);
  assert.equal(r.meta.mind, 'live'); assert.equal(r.intent.type, 'talk_to'); assert.equal(r.intent.target, 'f2'); assert.equal(r.say.split(' ').length, 12, 'say clamped to 12 words'); assert.equal(r.mood_delta, 1);
  assert.equal(typeof g.applyIntent('f1', r).ok, 'boolean');
  const h = minds.health();
  assert.equal(h.calls.think, 1); assert.equal(h.usage['claude-haiku-4-5'].cacheRead, 5000); assert.ok(h.usd.total > 0 && h.usd.perHour > 0);
  assert.equal(usdOf('claude-haiku-4-5', { input: 1e6 }), RATES['claude-haiku-4-5'].input);
});

test('live converse: alternating per-speaker Haiku turns with each speaker\'s own persona prefix and the transcript so far; outcome from the turns', async () => {
  const g = settled(); g.castPersonas();
  const a = g.state.agents[1], b = g.state.agents[2];
  const cid = g.applyIntent(a.id, { intent: { type: 'talk_to', target: b.id, text: 'Hungry yet?' } }).effects[0].conversationId;
  const req = g.converseRequest(cid); req.turns = 3;
  const client = fakeClient([
    msg(JSON.stringify({ text: 'Hungry yet, or is it only me?', affinity: 0, spawns: 'none', note: '' })),
    msg(JSON.stringify({ text: 'Since yesterday. The crates are a rumour now.', affinity: 1, spawns: 'letter', note: `${a.name} asked. Nobody else does.` })),
    msg(JSON.stringify({ text: 'Then we write to the sky together.', affinity: 1, spawns: 'none', note: 'We will write.' })),
  ]);
  const minds = createMinds({ config: liveConfig(), mind: createMind(liveConfig(), { client }), log: () => {} });
  const r = await minds.converse(req);
  assert.equal(client.calls.length, 3);
  assert.match(client.calls[0].params.system[1].text, new RegExp(a.name)); assert.match(client.calls[1].params.system[1].text, new RegExp(b.name)); assert.match(client.calls[2].params.system[1].text, new RegExp(a.name));
  assert.match(client.calls[1].params.messages[0].content[0].text, /Hungry yet, or is it only me\?/, 'the transcript so far');
  assert.match(client.calls[0].params.messages[0].content[0].text, /You open with something like: "Hungry yet\?"/);
  assert.match(client.calls[2].params.messages[0].content[0].text, /last line/);
  assert.equal(client.calls[0].params.max_tokens, 200); assert.equal(client.calls[0].opts.timeout, MINDS_TIMEOUTS.converseTurn);
  assert.deepEqual(r.lines.map(l => l.speaker), [a.id, b.id, a.id]); assert.equal(r.outcome.spawns, 'letter'); assert.equal(r.outcome.affinity, 1); assert.equal(r.outcome.noteA, 'We will write.'); assert.match(r.outcome.noteB, /asked/);
  assert.equal(minds.health().calls.converseTurns, 3); assert.equal(minds.health().calls.converse, 1);
  g.applyConversation(cid, r);
  assert.equal(g.state.letters.at(-1).kind, 'petition');
});

test('live cast and direct: Fable 5.1 with the fallbacks beta, effort medium, structured output; a short cast is topped up from the mock; bad answers fall back to the mock', async () => {
  const g = settled();
  const castReq = g.castRequest();
  const half = castReq.settlers.slice(0, 6).map(s => ({ id: s.id, backstory: `${s.name} came from the hills with a hammer and a grudge against rain.`, voice: 'clipped', quirks: ['x', 'y'], values: ['a', 'b'], fear: 'rain', goal: 'a roof', opinions: castReq.settlers.filter(o => o.id !== s.id).map(o => ({ id: o.id, line: 'fine' })), secret: '' }));
  const client = fakeClient([
    msg(JSON.stringify({ personas: half, tensions: [{ kind: 'rivals', a: 'f1', b: 'f2' }] }), { model: 'claude-fable-5-1' }),
    msg(JSON.stringify({ arc_note: 'Act one.', events: [{ kind: 'weather', agentIds: [], neighbourId: '', topic: 'fog', text: 'Fog.', severity: 1 }], nudges: [{ agentId: 'f3', goal: 'a kite' }], minister_briefing: { subject: 'Fog', body: 'Fog, founder. — Olla' } }), { model: 'claude-fable-5-1' }),
    msg('not json', { model: 'claude-fable-5-1' }),
  ]);
  const minds = createMinds({ config: liveConfig(), mind: createMind(liveConfig(), { client }), log: () => {} });
  const cast = await minds.cast(castReq);
  const p0 = client.calls[0].params;
  assert.equal(p0.model, 'claude-fable-5-1'); assert.deepEqual(p0.betas, [FALLBACK_BETA]); assert.equal(p0.fallbacks, 'default'); assert.equal(p0.output_config.effort, 'medium'); assert.equal(p0.output_config.format.schema, CAST_SCHEMA);
  assert.match(p0.system[0].text, /casting director/); assert.equal(client.calls[0].opts.timeout, MINDS_TIMEOUTS.cast);
  assert.equal(cast.meta.mind, 'live'); assert.equal(cast.personas.length, 12, 'six live + six topped up from the mock'); assert.deepEqual(cast.tensions, [{ kind: 'rivals', a: 'f1', b: 'f2' }]);
  assert.equal(cast.personas[0].opinions.f2, 'fine'); assert.equal(g.castPersonas(cast), 12);
  const dir = await minds.direct(g.directRequest('start'));
  const p1 = client.calls[1].params;
  assert.equal(p1.model, 'claude-fable-5-1'); assert.equal(p1.output_config.effort, 'medium'); assert.match(p1.system[0].text, /director/); assert.equal(client.calls[1].opts.timeout, MINDS_TIMEOUTS.direct);
  assert.equal(dir.meta.mind, 'live'); assert.equal(dir.events[0].kind, 'weather'); assert.equal(dir.nudges[0].agentId, 'f3'); assert.equal(dir.minister_briefing.body, 'Fog, founder. — Olla');
  assert.deepEqual(g.applyDirection(dir).applied.map(x => x.kind), ['weather', 'nudge', 'briefing']);
  const bad = await minds.direct(g.directRequest('periodic'));
  assert.equal(bad.meta.mind, 'mock'); assert.equal(bad.meta.liveError.code, 'bad_json'); assert.ok(bad.arc_note);
  assert.equal(minds.health().calls.failed, 1); assert.ok(minds.health().usage['claude-fable-5-1'].calls === 2);
});

test('live reflect and talk with a persona: the persona model, the persona prefix, the memory in the user block; the talk route keeps its shape and falls back to the (voiced) mock on a bad answer', async () => {
  const g = settled(); g.castPersonas();
  const client = fakeClient([
    msg(JSON.stringify({ reflection: 'I count the seconds between everything, and lately between Momo\'s visits.' })),
    msg(JSON.stringify({ reply: 'Well enough. I count the crates twice, like a lamp counts flashes.', mood: 1, action: { type: 'none', request: '', text: '' } })),
    msg('{"nope":1}'),
  ]);
  const config = liveConfig();
  const mind = createMind(config, { client });
  const minds = createMinds({ config, mind, log: () => {} });
  const refl = await minds.reflect(g.reflectRequest('f1'));
  assert.equal(client.calls[0].params.model, 'claude-haiku-4-5'); assert.match(client.calls[0].params.messages[0].content[0].text, /Recent memories/); assert.equal(client.calls[0].params.output_config.format.schema, REFLECT_SCHEMA);
  assert.match(refl.reflection, /Momo/);
  const catalogue = await loadCatalogue(); const letters = await loadLetterTemplates();
  const routes = createRoutes({ config, catalogue, mind, letters, assets: createAssetStore(tmpAssets), log: () => {}, minds });
  const ctx = g.talkContext('f1', 'how are you?');
  assert.ok(ctx.persona && ctx.mind);
  const t = await routes.talk(ctx);
  const p = client.calls[1].params;
  assert.equal(p.model, 'claude-haiku-4-5'); assert.equal(p.betas, undefined); assert.equal(p.output_config.effort, undefined); assert.match(p.system[1].text, /Nando/);
  const user = JSON.parse(p.messages[0].content[0].text);
  assert.equal(user.sovereign_said, 'how are you?'); assert.ok(user.memory.memory.length >= 1 && user.memory.goal);
  assert.equal(t.meta.mind, 'live'); assert.equal(t.agentId, 'f1'); assert.match(t.reply, /crates twice/); assert.equal(t.mood, 1); assert.equal(t.action, null);
  assert.equal(minds.health().calls.talk, 1);
  const t2 = await routes.talk(ctx);
  assert.equal(t2.meta.mind, 'mock'); assert.equal(t2.meta.liveError.code, 'bad_json'); assert.ok(t2.reply.length > 0);
  // without a persona the talk route stays on the command model as before
  const noPersona = { ...ctx }; delete noPersona.persona; delete noPersona.mind;
  client.calls.length = 0; await routes.talk(noPersona).catch(() => {});
  assert.equal(client.calls[0].params.model, 'claude-fable-5-1');
});

test('the server\'s budget: over AGORA_MINDS_MAX_PER_MIN persona calls a minute the mock answers with meta.budget, nothing is spent; the director is not capped', async () => {
  const g = settled(); g.castPersonas();
  const client = fakeClient(Array.from({ length: 10 }, () => msg(JSON.stringify({ intent: { type: 'work', target: '', text: '', place: '' }, say: '', memory_note: '', mood_delta: 0 }))).concat([msg(JSON.stringify({ arc_note: 'x', events: [], nudges: [], minister_briefing: { subject: '', body: '' } }), { model: 'claude-fable-5-1' })]));
  const minds = createMinds({ config: liveConfig({ mindsMaxPerMin: 3 }), mind: createMind(liveConfig(), { client }), log: () => {} });
  const req = g.thinkRequest('f1');
  const results = [];
  for (let i = 0; i < 5; i++) results.push(await minds.think(req));
  assert.deepEqual(results.map(r => r.meta.mind), ['live', 'live', 'live', 'mock', 'mock']);
  assert.equal(results[3].meta.budget, true); assert.equal(client.calls.length, 3);
  const h = minds.health();
  assert.equal(h.budget.usedLastMin, 3); assert.equal(h.budget.rejected, 2); assert.equal(h.calls.mock, 2);
  const d = await minds.direct(g.directRequest('demand'));
  assert.equal(d.meta.mind, 'live', 'the director is not under the persona cap');
  assert.equal(personaBlock(null, { name: 'Pim' }).startsWith('# Your persona'), true);
});

test('the mock answers through the real server are persona-voiced on /api/talk when a persona rides along', async () => {
  const g = settled(); g.castPersonas();
  const ctx = g.talkContext('f1', 'what are you good at?');
  const voiced = await (await post('/api/talk', ctx)).json();
  delete ctx.persona; delete ctx.mind;
  const plain = await (await post('/api/talk', ctx)).json();
  assert.ok(voiced.reply && plain.reply && voiced.meta.mind === 'mock');
  assert.notEqual(voiced.reply, plain.reply, `${voiced.reply} vs ${plain.reply}`);
});
