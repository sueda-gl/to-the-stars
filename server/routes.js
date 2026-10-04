// /api/* handlers. Each one works in mock mode and in live mode; live errors fall back to mock
// (configurable) so the stage demo never shows a 500.
import { COMMAND_SCHEMA, SOCIETY_SCHEMA, LETTER_SCHEMA, CODEGEN_SCHEMA, SKETCH_SCHEMA, TALK_SCHEMA, SCENES, normaliseActions, normaliseLetterDraft, normaliseOptions, normaliseCodegenMeta, normaliseSketch, normaliseTalk, normaliseMark, summariseMark, SOCIETY_EVENT_KINDS, guessCategory } from './schemas.js';
import { parseIntent } from './mock/intent.js';
import { mockTalk, trimReply } from './mock/talk.js';
import { mockAsset, mockTimeline, assetId, STOCK } from './mock/codegen.js';
import { mockSketch } from './mock/sketch.js';
import { LETTER_PURPOSES } from './mock/letters.js';
import { systemFor, codegenSystem } from './prompts.js';
import { validateCode } from './codegen/validate.js';
import { MindError, FAST_MODELS } from './llm.js';
import { voicePrefix } from '../web/js/sim/minds.js';

const MAX_BODY = 1 << 20;

// Live timeouts (ms). The client's TIMEOUTS (web/js/net/api.js) must sit above these so a slow mind falls back to the
// server's mock answer instead of the client erroring first: command 25 s < 32 s, letter 30 s < 38 s, society 60 s < 70 s,
// sketch 12 s (one shot, no SDK retry) < 32 s, codegen: whole-request budget 270 s < 300 s (per attempt fast 110 s / standard 170 s).
export const LIVE_TIMEOUTS = { command: 25000, society: 60000, letter: 30000, sketch: 12000, talk: 15000, codegenFast: 110000, codegenStandard: 170000, codegenBudget: 270000 };

export function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', (c) => { size += c.length; if (size > MAX_BODY) { reject(new Error('body too large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch { reject(new Error('invalid JSON body')); }
    });
    req.on('error', reject);
  });
}

export function sendJson(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(data);
}

// CORS: the game is same-origin, so only local dev origins (another port serving web/) get the header.
// Any other site open in the demo browser cannot spend credits through /api/*.
export function corsOrigin(req) {
  const origin = req.headers?.origin;
  if (!origin) return null;
  return /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(origin) ? origin : null;
}

// A compact, deterministic rendering of the volatile part of a request.
const userBlock = (obj) => JSON.stringify(obj);
const snapshotOf = (body) => (body && typeof body.snapshot === 'object' && body.snapshot) || {};
const sceneOf = (body, snapshot) => (SCENES.includes(body.scene) ? body.scene : SCENES.includes(snapshot.scene) ? snapshot.scene : 'earth');
const titleNoun = (request) => request.replace(/^(a|an|the)\s+/i, '').replace(/\b(on|at|by|near|next to|in|into|there|here|over there)\b.*$/i, '').trim().replace(/\b\p{L}/gu, c => c.toUpperCase());

export function createRoutes(ctx) {
  const { config, catalogue, mind, letters, assets, log, minds = null } = ctx;
  const live = !config.mock && mind;
  const models = config.models;
  const warn = (label, err) => log('warn', `${label} live failed (${err.code || 'error'}): ${err.message}${config.liveFallbackToMock ? ' -> mock' : ''}`);

  async function withFallback(label, liveFn, mockFn) {
    const t0 = Date.now();
    if (live) {
      try { const r = await liveFn(); return { ...r, meta: { mind: 'live', model: r.model, ms: Date.now() - t0, usage: r.usage, ...(r.meta || {}) } }; }
      catch (err) {
        const e = err instanceof MindError ? err : new MindError('unknown', err.message);
        warn(label, e);
        if (!config.liveFallbackToMock) throw e;
        const r = mockFn();
        return { ...r, meta: { mind: 'mock', ms: Date.now() - t0, liveError: { code: e.code, message: e.message } } };
      }
    }
    const r = mockFn();
    return { ...r, meta: { mind: 'mock', ms: Date.now() - t0 } };
  }

  return {
    health() {
      return {
        ok: true, mock: config.mock, mockReason: config.mockReason, models, stt: config.stt, catalogue: catalogue.source, letters: letters.source,
        assets: assets.list().length, buildApi: codegenSystem().source, sketch: true, scenes: SCENES,
        fastMode: Boolean(config.fastMode !== false && FAST_MODELS.test(models.visual)), stock: Object.keys(STOCK).filter(k => STOCK[k].code),
        letterPurposes: LETTER_PURPOSES, timeouts: LIVE_TIMEOUTS, talk: true, conflicts: true,
        ...(minds ? { minds: minds.health() } : {}),   // ART_DIRECTION §18: status, models, calls, usage, $/hour, budget
      };
    },

    // ART_DIRECTION §11: a folk answers the sovereign in a speech bubble: simple, short, in character.
    // { agentId, agent, text, history, snapshot } -> { reply, mood, action|null, meta }
    async talk(body) {
      const agentId = typeof body.agentId === 'string' ? body.agentId : null;
      const agent = body.agent && typeof body.agent === 'object' ? body.agent : {};
      if (agentId && !agent.id) agent.id = agentId;
      const text = String(body.text || '').slice(0, 500);
      const history = (Array.isArray(body.history) ? body.history : []).slice(-6).map(h => h && typeof h === 'object' ? { you: String(h.you || '').slice(0, 200), me: String(h.me || '').slice(0, 200) } : null).filter(Boolean);
      const snapshot = snapshotOf(body);
      // the mock answer takes the persona's voice when one rides along (the same transform the sim uses offline)
      const mock = () => { const r = mockTalk({ agent, text, history, snapshot }); const v = body.persona && typeof body.persona.voice === 'string' ? voicePrefix(body.persona.voice) : null; return { reply: v ? trimReply(v(r.reply)) : r.reply, mood: r.mood, action: r.action, intent: r.intent }; };
      // ART_DIRECTION §18: with a persona in the body (the sim's talkContext after the cast) the folk answers from their persona and memory on the persona model
      const persona = minds && minds.wantsTalk(body) ? body.persona : null;
      const r = await withFallback('talk', async () => {
        if (persona) { const t = await minds.talk({ agentId, agent, text, history, snapshot, persona, mind: body.mind || null }); return { reply: t.reply, mood: t.mood, action: t.action, intent: t.intent, usage: t.usage, model: t.model, ...(t.meta ? { meta: t.meta } : {}) }; }
        const { data, usage, model } = await mind.structured({
          model: models.command || models.logic, effort: 'low', maxTokens: 4000, timeout: LIVE_TIMEOUTS.talk, label: 'talk', retries: 0,
          system: systemFor('talk', catalogue), schema: TALK_SCHEMA,
          user: userBlock({ agent, text, history, snapshot: { name: snapshot.name, stage: snapshot.stage, day: snapshot.day, res: snapshot.res || snapshot.resources, hungry: snapshot.hungry, minister: snapshot.minister, buildings: (snapshot.buildings || []).slice(0, 24).map(b => ({ id: b.id, kind: b.kind, name: b.name, status: b.status })), agents: (snapshot.agents || []).slice(0, 40).map(a => ({ id: a.id, name: a.name, trade: a.trade, work: a.work })), neighbours: (snapshot.neighbours || []).map(n => ({ id: n.id, name: n.name, attitude: n.attitude })) } }),
        });
        const t = normaliseTalk(data, { trim: trimReply });
        if (!t) throw new MindError('bad_json', 'talk had no reply');
        return { ...t, usage, model };
      }, mock);
      return { agentId, reply: r.reply, mood: r.mood, action: r.action || null, ...(r.intent ? { intent: r.intent } : {}), meta: r.meta };
    },

    async command(body) {
      const transcript = String(body.transcript || '');
      const pointer = body.pointer && Number.isFinite(body.pointer.x) && Number.isFinite(body.pointer.z) ? body.pointer : null;
      const selected = typeof body.selected === 'string' ? body.selected : null;
      const snapshot = snapshotOf(body);
      const scene = sceneOf(body, snapshot);
      // the cursor mark (§10): the summary goes to the model, the full mark (polygon / stroke, id) rides back on at.mark
      const mark = normaliseMark(body.mark);
      const mock = () => parseIntent({ transcript, pointer, selected, snapshot, catalogue, scene, mark });
      const r = await withFallback('command', async () => {
        const { data, usage, model } = await mind.structured({
          model: models.command || models.logic, effort: 'low', maxTokens: 16000, timeout: LIVE_TIMEOUTS.command, label: 'command',
          system: systemFor('command', catalogue), schema: COMMAND_SCHEMA,
          user: userBlock({ transcript, scene, pointer, mark: summariseMark(mark), selected, snapshot }),
        });
        const { actions, dropped } = normaliseActions(data.actions, snapshot, catalogue, { scene, mark, pointer });
        if (dropped.length) log('warn', `command: dropped ${dropped.length} invalid action(s): ${dropped.map(d => d.reason).join('; ')}`);
        const say = data.say && typeof data.say.text === 'string' && data.say.text.trim() ? { from: data.say.from === 'ministry' ? 'ministry' : 'minister', text: data.say.text.trim() } : null;
        return { actions: actions.length ? actions : [{ type: 'noop', why: 'the mind returned nothing usable' }], say, usage, model };
      }, mock);
      return { actions: r.actions, say: r.say || undefined, scene, ...(mark ? { mark: summariseMark(mark) } : {}), meta: r.meta };
    },

    async society(body) {
      const snapshot = snapshotOf(body);
      const recent = Array.isArray(body.recent) ? body.recent.slice(-12) : [];
      const wants = Array.isArray(body.wants) ? body.wants : [];
      const mock = () => {
        const r = letters.societyLetters(snapshot, recent, { max: 2 });
        const out = { letters: (r.letters || []).map(normaliseLetterDraft).filter(Boolean), events: r.events || [] };
        if (wants.includes('report')) {
          const m = (snapshot.agents || []).find(a => a.id === snapshot.minister) || (snapshot.agents || [])[0] || { name: 'The minister' };
          const rep = letters.letterFor({ purpose: 'report', agent: m, context: {}, snapshot });
          out.letters.unshift({ from: { kind: 'minister', id: m.id || null, name: m.name }, kind: 'report', ...rep, options: normaliseOptions(rep.options) });
        }
        return out;
      };
      return withFallback('society', async () => {
        const { data, usage, model } = await mind.structured({
          model: models.logic, effort: 'medium', maxTokens: 16000, timeout: LIVE_TIMEOUTS.society, label: 'society',
          system: systemFor('society', catalogue), schema: SOCIETY_SCHEMA,
          user: userBlock({ snapshot, recent, wants }),
        });
        const out = (data.letters || []).map(normaliseLetterDraft).filter(Boolean).slice(0, 3);
        const events = (data.events || []).filter(e => e && SOCIETY_EVENT_KINDS.includes(e.kind)).map(e => ({ kind: e.kind, agentId: e.agentId || null, neighbourId: e.neighbourId || null, delta: Number.isFinite(e.delta) ? Math.max(-5, Math.min(5, Math.round(e.delta))) : 0, note: String(e.note || '') }));
        return { letters: out, events, usage, model };
      }, mock);
    },

    async letter(body) {
      const purpose = LETTER_PURPOSES.includes(body.purpose) ? body.purpose : 'reply';
      const agent = body.agent && typeof body.agent === 'object' ? body.agent : {};
      const context = body.context && typeof body.context === 'object' ? body.context : {};
      const snapshot = snapshotOf(body);
      const mock = () => { const l = letters.letterFor({ purpose, agent, context, snapshot }); return { subject: l.subject, body: l.body, options: normaliseOptions(l.options), from: l.from, kind: l.kind }; };
      const r = await withFallback('letter', async () => {
        const { data, usage, model } = await mind.structured({
          model: models.logic, effort: 'low', maxTokens: 16000, timeout: LIVE_TIMEOUTS.letter, label: 'letter',
          system: systemFor('letter', catalogue), schema: LETTER_SCHEMA,
          user: userBlock({ purpose, agent, context, snapshot }),
        });
        if (typeof data.subject !== 'string' || typeof data.body !== 'string') throw new MindError('bad_json', 'letter missing subject/body');
        const m = letters.letterFor({ purpose, agent, context, snapshot });   // the mock knows who signs each purpose
        return { subject: data.subject.trim(), body: data.body.trim(), options: normaliseOptions(data.options), from: m.from, kind: m.kind, usage, model };
      }, mock);
      return { subject: r.subject, body: r.body, options: r.options, from: r.from, kind: r.kind, purpose, meta: r.meta };
    },

    // §8 massing sketch: a few primitives, fast, drawn in pencil while codegen runs.
    async sketch(body) {
      const request = String(body.request || body.kindHint || 'a thing').trim();
      const snapshot = snapshotOf(body);
      const mock = () => ({ sketch: mockSketch({ request, kindHint: String(body.kindHint || '') }) });
      const r = await withFallback('sketch', async () => {
        const { data, usage, model } = await mind.structured({
          model: models.sketch || models.logic, effort: 'low', maxTokens: 4000, timeout: LIVE_TIMEOUTS.sketch, label: 'sketch', retries: 0,   // one shot: late is useless, the mock massing is drawn instead
          system: systemFor('sketch', catalogue), schema: SKETCH_SCHEMA,
          user: userBlock({ request, snapshot: { stage: snapshot.stage, buildings: (snapshot.buildings || []).map(b => b.kind).slice(0, 24) } }),
        });
        const sketch = normaliseSketch(data, request);
        if (!sketch || sketch.parts.length < 2) throw new MindError('bad_json', 'sketch had fewer than 2 parts');
        return { sketch, usage, model };
      }, mock);
      return { ...r.sketch, meta: r.meta };
    },

    // SSE: status {stage} ... done {asset} | error {message}
    async codegen(body, sse) {
      const request = String(body.request || body.kindHint || 'a tower').trim();
      const kindHint = String(body.kindHint || '').trim();
      const snapshot = snapshotOf(body);
      const t0 = Date.now();

      // Learned before? Instant. (Matched on the request's noun, not on any word: "a clock tower" is not "a tower".)
      const cached = assets.find(request) || (kindHint && assets.find(kindHint));
      if (cached) {
        sse.send('status', { stage: 'drafting', note: `We have built a ${cached.name.toLowerCase()} before; the plans are in the archive.` });
        sse.send('done', { asset: cached, meta: { mind: 'cache', ms: Date.now() - t0 } });
        return;
      }

      const finishMock = async (note = null) => {
        const asset = mockAsset({ request, kindHint });
        const timeline = mockTimeline(config.mockCodegenMs);
        let elapsed = 0;
        for (const step of timeline) {
          await sleep(step.at - elapsed); elapsed = step.at;
          if (sse.closed) return;
          sse.send('status', { stage: step.stage, note: note && step.stage === 'drafting' ? note : step.note, stock: asset.stock });
        }
        await sleep(Math.max(0, config.mockCodegenMs - elapsed));
        if (sse.closed) return;
        const v = validateCode(asset.code);
        if (!v.ok) { sse.send('error', { message: `stock asset failed validation: ${v.errors.join('; ')}` }); return; }
        const saved = assets.put(asset);
        sse.send('done', { asset: saved, meta: { mind: 'mock', ms: Date.now() - t0, stock: asset.stock, category: saved.meta.category } });
      };

      if (!live) return finishMock();

      try {
        const { text: system, source } = codegenSystem();
        if (source === 'placeholder') log('warn', 'codegen: BUILD_API.md missing, using placeholder section');
        sse.send('status', { stage: 'drafting', note: 'The Ministry of Builds unrolls fresh paper.' });
        const user = userBlock({ request, kindHint, snapshot: { stage: snapshot.stage, resources: snapshot.resources || snapshot.res, buildings: (snapshot.buildings || []).map(b => b.kind) } });
        const messages = [{ role: 'user', content: [{ type: 'text', text: user }] }];
        const deadline = t0 + (config.codegenBudgetMs || LIVE_TIMEOUTS.codegenBudget);
        let fast = config.fastMode !== false && FAST_MODELS.test(models.visual);
        let asset = null, lastErrors = [], used = null;
        for (let attempt = 0; attempt <= 2; attempt++) {
          if (sse.closed) return;
          const remaining = deadline - Date.now();
          if (remaining < 15000) throw new MindError('timeout', `codegen budget exhausted after ${attempt} attempt(s)`);
          if (attempt > 0) sse.send('status', { stage: 'repairing', note: `Plan ${attempt} had a flaw: ${lastErrors[0]}` });
          const call = (speed) => mind.stream({
            model: models.visual, effort: 'high', maxTokens: 32000, label: `codegen#${attempt}${speed === 'fast' ? ' fast' : ''}`,
            timeout: Math.min(speed === 'fast' ? LIVE_TIMEOUTS.codegenFast : LIVE_TIMEOUTS.codegenStandard, deadline - Date.now()),
            system, schema: CODEGEN_SCHEMA, messages, speed,
            onFirstText: () => sse.send('status', { stage: 'writing', note: speed === 'fast' ? 'Plans are inked at speed, part by part.' : 'Plans are inked, part by part.' }),
          });
          let r;
          if (fast) {
            // Fast mode first; on 429 / 400 / any failure the same attempt goes again on the standard lane.
            try { r = await call('fast'); }
            catch (err) {
              const e = err instanceof MindError ? err : new MindError('unknown', err.message);
              log('warn', `codegen fast mode failed (${e.code}): ${e.message} -> standard`);
              fast = false;
              if (sse.closed) return;
              sse.send('status', { stage: 'drafting', note: 'The fast lane is closed; the plans go the usual way.' });
              r = await call('standard');
            }
          } else r = await call('standard');
          used = r;
          sse.send('status', { stage: 'checking', note: 'Measuring twice.' });
          let data;
          try { data = JSON.parse(r.text); } catch { data = null; }
          const code = data && typeof data.code === 'string' ? data.code : '';
          const v = data ? validateCode(code) : { ok: false, errors: ['the answer was not valid JSON'] };
          if (v.ok) {
            const name = (data.name && String(data.name).trim()) || titleNoun(request);
            const meta = normaliseCodegenMeta({ ...data.meta, category: data.meta?.category || guessCategory(`${name} ${request} ${data.meta?.desc || ''}`) });
            asset = { id: assetId(name, request), name, aliases: Array.from(new Set([name.toLowerCase(), ...(Array.isArray(data.aliases) ? data.aliases.map(a => String(a).toLowerCase()) : [])])), meta, code, generated: true, request, model: r.model, speed: r.speed };
            break;
          }
          lastErrors = v.errors;
          log('warn', `codegen attempt ${attempt} invalid: ${v.errors.join('; ')}`);
          // Continue the same conversation: the assistant turn is passed back unmodified (thinking blocks included).
          messages.push({ role: 'assistant', content: r.message.content });
          messages.push({ role: 'user', content: [{ type: 'text', text: `The server rejected the code:\n- ${v.errors.join('\n- ')}\nReturn the whole corrected JSON object again.` }] });
        }
        if (!asset) throw new MindError('invalid_code', `code failed validation after 3 attempts: ${lastErrors.join('; ')}`);
        const saved = assets.put(asset);
        sse.send('done', { asset: saved, meta: { mind: 'live', model: asset.model, speed: asset.speed, ms: Date.now() - t0, category: saved.meta.category, usage: used?.usage } });
      } catch (err) {
        const e = err instanceof MindError ? err : new MindError('unknown', err.message);
        warn('codegen', e);
        if (!config.liveFallbackToMock || sse.closed) { sse.send('error', { message: e.message, code: e.code }); return; }
        await finishMock(`The archive mind is unreachable (${e.code}); the builders improvise from a stock plan.`);
      }
    },

    assets() { return assets.list(); },
    asset(id) { return assets.get(String(id || '')); },

    // The mock library (server/mock/assets/*.js): the gallery loads one with ?code=/api/stock/<key>.js
    stock() { return Object.entries(STOCK).map(([key, s]) => ({ key, name: s.name, aliases: s.aliases, category: s.meta.category, generic: !s.code })); },
    stockCode(key, request = '') {
      const s = STOCK[key];
      if (!s) return null;
      return s.code || mockAsset({ request: request || 'a thing' }).code;
    },
  };
}

const sleep = (ms) => new Promise(r => setTimeout(r, Math.max(0, ms)));

// Server-sent events helper.
export function openSse(req, res) {
  res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', 'Connection': 'keep-alive', 'X-Accel-Buffering': 'no' });
  res.write(': agora codegen stream\n\n');
  const sse = {
    closed: false,
    send(event, data) { if (sse.closed) return; res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); if (event === 'done' || event === 'error') sse.end(); },
    end() { if (sse.closed) return; sse.closed = true; clearInterval(ping); res.end(); },
  };
  const ping = setInterval(() => { if (!sse.closed) res.write(': ping\n\n'); }, 10000);
  req.on('close', () => { sse.closed = true; clearInterval(ping); });
  return sse;
}
