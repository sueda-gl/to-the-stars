// The minds routes (ART_DIRECTION §18): /api/minds/cast | think | converse | reflect | direct, and the persona-aware
// /api/talk. Live: Haiku 4.5 plays each folk (persona prefix cached: the shared rules block + the persona block, both
// with cache_control; no fallbacks beta, no effort, no thinking param, structured outputs with 0 union-typed
// parameters), Fable 5.1 casts and directs (effort medium, the fallbacks beta, structured outputs). Mock: the sim's own
// deterministic minds (web/js/sim/minds.js), so the server and the browser's offline loop say the same things.
// A sliding-minute budget caps persona calls (over it: the mock answers with meta.budget = true, the folk run on the
// rules); every live answer's usage is accounted and health reports an estimated $/hour.
import { readPrompt, render } from './prompts.js';
import { TALK_SCHEMA, normaliseTalk } from './schemas.js';
import { MindError } from './llm.js';
import { MIND_ACTIONS, TENSION_KINDS, DIRECTOR_EVENTS, mockCast, mockThink, mockConverse, mockReflect, normaliseThink, normaliseConverse, normaliseDirection, normaliseReflect, clampWords, voicePrefix } from '../web/js/sim/minds.js';
import { mockTalk, trimReply } from './mock/talk.js';

const S = (type) => ({ type });
const STR = S('string'), INT = S('integer'), BOOL = S('boolean');
const OBJ = (properties) => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });
const ARR = (items) => ({ type: 'array', items });
const ENUM = (values) => ({ type: 'string', enum: values });

// Structured-output schemas: every key required, additionalProperties false, NO nullable fields (0 union-typed parameters each).
export const THINK_SCHEMA = OBJ({ intent: OBJ({ type: ENUM(MIND_ACTIONS), target: STR, text: STR, place: STR }), say: STR, memory_note: STR, mood_delta: INT });
export const CONVERSE_TURN_SCHEMA = OBJ({ text: STR, affinity: INT, spawns: ENUM(['none', 'letter', 'conflict']), note: STR });
export const REFLECT_SCHEMA = OBJ({ reflection: STR });
export const CAST_SCHEMA = OBJ({
  personas: ARR(OBJ({ id: STR, backstory: STR, voice: STR, quirks: ARR(STR), values: ARR(STR), fear: STR, goal: STR, opinions: ARR(OBJ({ id: STR, line: STR })), secret: STR })),
  tensions: ARR(OBJ({ kind: ENUM(TENSION_KINDS), a: STR, b: STR })),
});
export const DIRECT_SCHEMA = OBJ({
  arc_note: STR,
  events: ARR(OBJ({ kind: ENUM(DIRECTOR_EVENTS), agentIds: ARR(STR), neighbourId: STR, topic: STR, text: STR, severity: INT })),
  nudges: ARR(OBJ({ agentId: STR, goal: STR })),
  minister_briefing: OBJ({ subject: STR, body: STR }),
});

// Live timeouts (ms). The browser's loop drops a think after 5 s (MIND.timeoutMs) and falls back to the rules, so the
// server gives up first. A conversation is 2-4 turns in one request; the loop allows 12 s.
export const MINDS_TIMEOUTS = { think: 4500, converseTurn: 4000, reflect: 7000, talk: 12000, cast: 90000, direct: 60000 };

// $/MTok. Fable 5.1: shared/models.md (input 10, output 50, cache read 0.25 = 0.025x; cache write = 1.25x input for the
// 5-minute TTL). Haiku 4.5: the bundled docs carry no rate table for it; these are from memory and marked unverified
// in health (`rates[model].source`). Replace from the live pricing page when a key with credit is in hand.
export const RATES = {
  'claude-haiku-4-5': { input: 1, output: 5, cacheRead: 0.1, cacheWrite: 1.25, source: 'unverified (from memory; not in the bundled docs)' },
  'claude-fable-5-1': { input: 10, output: 50, cacheRead: 0.25, cacheWrite: 12.5, source: 'shared/models.md' },
  'claude-opus-5-5': { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5, source: 'shared/models.md' },
};
export function usdOf(model, usage = {}) {
  const r = RATES[model] || RATES[Object.keys(RATES).find(k => String(model || '').startsWith(k.slice(0, 12)))] || RATES['claude-haiku-4-5'];
  const M = 1e6;
  return ((usage.input || 0) * r.input + (usage.output || 0) * r.output + (usage.cacheRead || 0) * r.cacheRead + (usage.cacheWrite || 0) * r.cacheWrite) / M;
}
const tokensEst = text => Math.round(String(text || '').length / 3.8);

// the two cached blocks: the shared rules (one cache entry for all twelve minds) and this folk's persona
export function personaBlock(p, extra = {}) {
  const q = p || {};
  const name = q.name || extra.name || 'one of the folk';
  const lines = [`# Your persona\n\nYou are **${name}**${extra.species ? `, a ${extra.species}` : ''}${extra.trade ? ` and a ${extra.trade}` : ''}.`];
  if (q.backstory) lines.push(`\n**Your past.** ${q.backstory}`);
  if (q.voice) lines.push(`\n**How you talk.** ${q.voice}`);
  if (q.quirks && q.quirks.length) lines.push(`\n**Quirks.** ${q.quirks.join('; ')}.`);
  if (q.values && q.values.length) lines.push(`\n**What you value.** ${q.values.join('; ')}.`);
  if (q.fear) lines.push(`\n**What you fear.** ${q.fear}.`);
  if (q.goal) lines.push(`\n**What you want.** ${q.goal}.`);
  if (q.opinions && Object.keys(q.opinions).length) lines.push(`\n**What you think of the others** (by id):\n${Object.entries(q.opinions).map(([id, l]) => `- ${id}: ${l}`).join('\n')}`);
  if (q.secret) lines.push(`\n**A thing you keep to yourself** (never say it outright; let it colour you): ${q.secret}.`);
  if (extra.traits && extra.traits.length) lines.push(`\n**Traits.** ${extra.traits.join(', ')}.`);
  return lines.join('\n');
}
export function personaSystem(persona, extra) { return [readPrompt('persona'), personaBlock(persona, extra)]; }

export function createMinds({ config, mind, log = () => {} }) {
  const live = config.minds !== 'off' && config.minds !== 'mock' && !config.mock && !!mind;
  const status = config.minds === 'off' ? 'off' : live ? 'live' : 'mock';
  const models = config.mindsModels || { persona: 'claude-haiku-4-5', director: 'claude-fable-5-1' };
  const maxPerMin = Number(config.mindsMaxPerMin) || 60;
  const calls = { cast: 0, think: 0, converse: 0, converseTurns: 0, reflect: 0, direct: 0, talk: 0, mock: 0, budget: 0, failed: 0 };
  const usage = {};                 // model -> { input, output, cacheRead, cacheWrite, calls }
  const spend = [];                 // [{ t, usd }] in the last 10 minutes
  const stamps = [];                // persona calls in the last minute
  const t0 = Date.now();
  let usdTotal = 0;
  const now = () => Date.now();

  function allow() {
    const t = now();
    while (stamps.length && t - stamps[0] > 60000) stamps.shift();
    if (stamps.length >= maxPerMin) { calls.budget++; return false; }
    stamps.push(t);
    return true;
  }
  function account(model, u) {
    if (!u) return 0;
    const m = usage[model] || (usage[model] = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, calls: 0 });
    m.input += u.input || 0; m.output += u.output || 0; m.cacheRead += u.cacheRead || 0; m.cacheWrite += u.cacheWrite || 0; m.calls++;
    const usd = usdOf(model, u);
    usdTotal += usd;
    const t = now(); spend.push({ t, usd }); while (spend.length && t - spend[0].t > 600000) spend.shift();
    return usd;
  }
  const warn = (label, err) => { calls.failed++; log('warn', `minds ${label} live failed (${err.code || 'error'}): ${err.message} -> mock`); };

  // live-with-mock-fallback, like routes.withFallback, plus the budget and the accounting
  async function run(label, { persona = true } = {}, liveFn, mockFn) {
    const t0 = now();
    if (live && (!persona || allow())) {
      try { const r = await liveFn(); return { ...r, meta: { mind: 'live', model: r.model, ms: now() - t0, usage: r.usage, ...(r.meta || {}) } }; }
      catch (err) {
        const e = err instanceof MindError ? err : new MindError('unknown', err.message);
        warn(label, e);
        if (config.liveFallbackToMock === false) throw e;
        calls.mock++;
        return { ...mockFn(), meta: { mind: 'mock', ms: now() - t0, liveError: { code: e.code, message: e.message } } };
      }
    }
    calls.mock++;
    const over = live && persona;
    return { ...mockFn(), meta: { mind: 'mock', ms: now() - t0, ...(over ? { budget: true } : {}) } };
  }
  const userBlock = obj => JSON.stringify(obj);
  const pseudoGame = (settlers, world) => {
    const agents = (settlers || []).map(s => ({ id: s.id, name: s.name, species: s.species, trade: s.trade, traits: Array.isArray(s.traits) ? s.traits : [], skills: s.skills || {}, status: 'idle', fleetId: s.fleet || null, campRole: 'gatherer', x: 0, z: 0 }));
    const fleets = Object.values(agents.reduce((m, a) => { if (a.fleetId) (m[a.fleetId] = m[a.fleetId] || { id: a.fleetId, members: [] }).members.push(a.id); return m; }, {}));
    return { state: { agents, fleets: fleets.length ? fleets : null, neighbours: (world && world.nations) || [] } };
  };

  return {
    status, live, models, maxPerMin, calls, usage, account,
    wantsTalk: body => live && !!(body && body.persona && typeof body.persona === 'object'),

    // POST /api/minds/cast { settlers:[{id,name,species,trade,traits,skills,fleet?}], world, tensions? } -> { personas, tensions, meta }
    async cast(body) {
      const settlers = (Array.isArray(body.settlers) ? body.settlers : []).filter(s => s && typeof s.id === 'string' && typeof s.name === 'string').slice(0, 40);
      const world = body.world && typeof body.world === 'object' ? body.world : {};
      const tensions = (Array.isArray(body.tensions) ? body.tensions : []).filter(t => t && TENSION_KINDS.includes(t.kind) && typeof t.a === 'string' && typeof t.b === 'string');
      const mock = () => { const c = mockCast(pseudoGame(settlers, world)); return { personas: c.personas, tensions: c.tensions }; };
      if (!settlers.length) return { personas: [], tensions: [], meta: { mind: 'mock', ms: 0, empty: true } };
      const r = await run('cast', { persona: false }, async () => {
        const { data, usage, model } = await mind.structured({ model: models.director, effort: 'medium', maxTokens: 16000, timeout: MINDS_TIMEOUTS.cast, label: 'minds.cast', system: readPrompt('cast'), schema: CAST_SCHEMA, user: userBlock({ settlers, world, tensions }) });
        calls.cast++; account(model, usage);
        const ids = new Set(settlers.map(s => s.id));
        const personas = (data.personas || []).filter(p => p && ids.has(p.id)).map(p => ({ ...p, name: settlers.find(s => s.id === p.id).name, opinions: Object.fromEntries((p.opinions || []).filter(o => o && ids.has(o.id) && o.id !== p.id).map(o => [o.id, String(o.line || '').slice(0, 120)])) }));
        if (personas.length < Math.min(settlers.length, 3)) throw new MindError('bad_json', `cast returned ${personas.length} personas`);
        const missing = settlers.filter(s => !personas.some(p => p.id === s.id));
        if (missing.length) { const m = mock(); for (const s of missing) { const p = m.personas.find(x => x.id === s.id); if (p) personas.push(p); } }
        return { personas, tensions: (data.tensions || []).filter(t => t && TENSION_KINDS.includes(t.kind) && ids.has(t.a) && ids.has(t.b) && t.a !== t.b), usage, model };
      }, mock);
      return { personas: r.personas, tensions: r.tensions, meta: r.meta };
    },

    // POST /api/minds/think (the body = game.thinkRequest(agentId)) -> { intent, say, memory_note, mood_delta, meta }
    async think(body) {
      if (!body || typeof body.agentId !== 'string' || !body.state) return { ...normaliseThink({}), meta: { mind: 'mock', ms: 0, empty: true } };
      const mock = () => normaliseThink(mockThink(body));
      const r = await run('think', {}, async () => {
        const { data, usage, model } = await mind.structured({ model: models.persona, plain: true, maxTokens: 400, timeout: MINDS_TIMEOUTS.think, retries: 0, label: `minds.think ${body.agentId}`,
          systemBlocks: personaSystem(body.persona, { name: body.state.name, species: body.state.species, trade: body.state.trade, traits: body.state.traits }), schema: THINK_SCHEMA,
          user: userBlock({ now: body.state, memory: body.memory, relationships: body.relationships, world: body.world, options: body.options || MIND_ACTIONS, instruction: 'Decide what you do next. Most decisions are "work". Answer as JSON: { intent: { type, target, text, place }, say, memory_note, mood_delta }.' }) });
        calls.think++; account(model, usage);
        return { ...normaliseThink(data), usage, model };
      }, mock);
      return { intent: r.intent, say: r.say, memory_note: r.memory_note, mood_delta: r.mood_delta, meta: r.meta };
    },

    // POST /api/minds/converse (the body = game.converseRequest(id)) -> { lines:[{speaker,text}], outcome:{affinity,noteA,noteB,spawns,subject}, meta }
    // Live: `turns` alternating Haiku calls (a, b, a, b), each with that speaker's cached persona prefix and the transcript so far.
    async converse(body) {
      if (!body || !body.a || !body.b) return { lines: [], outcome: { affinity: 0, noteA: '', noteB: '', spawns: 'none', subject: '' }, meta: { mind: 'mock', ms: 0, empty: true } };
      const turns = Math.max(2, Math.min(4, Number(body.turns) || 3));
      const mock = () => normaliseConverse(mockConverse(body), body);
      const r = await run('converse', {}, async () => {
        const lines = [], notes = { a: '', b: '' }, aff = { a: 0, b: 0 }, spawns = new Set();
        let usageSum = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, model = models.persona;
        for (let i = 0; i < turns; i++) {
          const me = i % 2 === 0 ? body.a : body.b, other = i % 2 === 0 ? body.b : body.a, key = i % 2 === 0 ? 'a' : 'b';
          const memory = (i % 2 === 0 ? body.memoryA : body.memoryB) || { items: [], reflections: [] };
          if (i > 0 && !allow()) break;   // over budget mid-conversation: stop here, what was said stands
          const transcript = lines.map(l => `${l.speaker === body.a.id ? body.a.name : body.b.name}: ${l.text}`).join('\n') || '(nothing yet)';
          const instruction = i === 0 ? (body.opener ? `You open with something like: "${body.opener}" (in your own words, at most 14 words).` : 'You speak first: open the exchange in at most 14 words.') : i === turns - 1 ? 'This is the last line of the exchange: answer and close it in at most 14 words.' : 'Answer in at most 14 words.';
          const user = render(readPrompt('converse'), { OTHER: `${other.name} (${other.id})`, OTHER_TRADE: other.trade || 'folk', OPINION: me.opinionOfOther || 'no strong opinion yet', AFFINITY: describeAffinity(body.affinity), TOPIC: body.topic || 'the day', WORLD: describeWorld(body.world), MEMORY: [...(memory.reflections || []), ...(memory.items || [])].slice(-6).join(' | ') || 'nothing much', TRANSCRIPT: transcript, INSTRUCTION: instruction });
          const { data, usage, model: m } = await mind.structured({ model: models.persona, plain: true, maxTokens: 200, timeout: MINDS_TIMEOUTS.converseTurn, retries: 0, label: `minds.converse ${me.id}`, systemBlocks: personaSystem(me.persona, { name: me.name, species: me.species, trade: me.trade, traits: me.traits }), schema: CONVERSE_TURN_SCHEMA, user });
          calls.converseTurns++; account(m, usage); model = m;
          for (const k of Object.keys(usageSum)) usageSum[k] += (usage && usage[k]) || 0;
          const text = clampWords(String(data.text || '').replace(/\s+/g, ' ').trim(), 14);
          if (!text) break;
          lines.push({ speaker: me.id, text });
          if (typeof data.note === 'string' && data.note.trim()) notes[key] = data.note.trim().slice(0, 140);
          if (Number.isFinite(Number(data.affinity))) aff[key] = Math.max(-2, Math.min(2, Math.round(Number(data.affinity))));
          if (['letter', 'conflict'].includes(data.spawns)) spawns.add(data.spawns);
        }
        if (lines.length < 2) throw new MindError('bad_json', `conversation had ${lines.length} line(s)`);
        calls.converse++;
        const outcome = { affinity: Math.round((aff.a + aff.b) / 2), noteA: notes.a, noteB: notes.b, spawns: spawns.has('conflict') ? 'conflict' : spawns.has('letter') ? 'letter' : 'none', subject: body.topic || '' };
        return { ...normaliseConverse({ lines, outcome }, body), usage: usageSum, model };
      }, mock);
      return { lines: r.lines, outcome: r.outcome, meta: r.meta };
    },

    // POST /api/minds/reflect (the body = game.reflectRequest(agentId)) -> { reflection, meta }
    async reflect(body) {
      if (!body || typeof body.agentId !== 'string') return { reflection: '', meta: { mind: 'mock', ms: 0, empty: true } };
      const mock = () => ({ reflection: normaliseReflect(mockReflect(body)) });
      const r = await run('reflect', {}, async () => {
        const user = render(readPrompt('reflect'), { ITEMS: (body.items || []).map(i => `- ${i}`).join('\n') || '- (nothing yet)', REFLECTIONS: (body.reflections || []).join(' | ') || 'none', RELATIONSHIPS: (body.relationships || []).map(r => `${r.name} (${r.affinity > 0 ? '+' : ''}${r.affinity})`).join(', ') || 'nobody in particular' });
        const { data, usage, model } = await mind.structured({ model: models.persona, plain: true, maxTokens: 200, timeout: MINDS_TIMEOUTS.reflect, retries: 0, label: `minds.reflect ${body.agentId}`, systemBlocks: personaSystem(body.persona, { name: body.name }), schema: REFLECT_SCHEMA, user });
        calls.reflect++; account(model, usage);
        const reflection = normaliseReflect(data);
        if (!reflection) throw new MindError('bad_json', 'empty reflection');
        return { reflection, usage, model };
      }, mock);
      return { reflection: r.reflection, meta: r.meta };
    },

    // POST /api/minds/direct (the body = game.directRequest(reason)) -> { arc_note, events, nudges, minister_briefing, meta }
    async direct(body) {
      const snapshot = body && body.snapshot && typeof body.snapshot === 'object' ? body.snapshot : {};
      const reason = typeof (body && body.reason) === 'string' ? body.reason : 'periodic';
      const mock = () => mockDirectFromSnapshot({ ...body, snapshot, reason });
      const r = await run('direct', { persona: false }, async () => {
        const { data, usage, model } = await mind.structured({ model: models.director, effort: 'medium', maxTokens: 16000, timeout: MINDS_TIMEOUTS.direct, label: `minds.direct ${reason}`, system: readPrompt('direct'), schema: DIRECT_SCHEMA, user: userBlock({ reason, snapshot, personas: body.personas || [], memories: body.memories || {}, relationships: body.relationships || [], tensions: body.tensions || [], story: body.story || {}, options: body.options || { events: DIRECTOR_EVENTS } }) });
        calls.direct++; account(model, usage);
        return { ...normaliseDirection(data), usage, model };
      }, mock);
      return { arc_note: r.arc_note, events: r.events, nudges: r.nudges, minister_briefing: r.minister_briefing, meta: r.meta };
    },

    // /api/talk with a persona (ART_DIRECTION §11 + §18): the folk answers the sovereign from their persona and memory, on Haiku.
    // Same answer shape as routes.talk: { reply, mood, action } (+ usage, model). Throws a MindError on a bad answer (the caller falls back).
    async talk({ agentId, agent, text, history, snapshot, persona, mind: mem }) {
      if (!allow()) { calls.budget++; const r = mockTalk({ agent, text, history, snapshot }); return { reply: r.reply, mood: r.mood, action: r.action, intent: r.intent, usage: null, model: null, meta: { mind: 'mock', budget: true } }; }
      const { data, usage, model } = await mind.structured({ model: models.persona, plain: true, maxTokens: 300, timeout: MINDS_TIMEOUTS.talk, retries: 0, label: `minds.talk ${agentId}`,
        systemBlocks: personaSystem(persona, { name: agent.name, species: agent.species, trade: agent.trade, traits: agent.traits }), schema: TALK_SCHEMA,
        user: userBlock({ sovereign_said: text, history: (history || []).slice(-6), you_now: { job: agent.job, mood: agent.mood, moodWord: agent.moodWord, energy: agent.energy, status: agent.status, homeless: agent.homeless, isMinister: agent.isMinister, fleet: agent.fleet, role: agent.role || null, conflict: agent.conflict || null }, memory: mem || null,
          world: { name: snapshot.name, stage: snapshot.stage, day: snapshot.day, res: snapshot.res || snapshot.resources, hungry: snapshot.hungry, minister: snapshot.minister, buildings: (snapshot.buildings || []).slice(0, 16).map(b => `${b.name} (${b.status})`), agents: (snapshot.agents || []).slice(0, 24).map(a => `${a.id} ${a.name}: ${a.work || a.trade}`) },
          instruction: 'Answer the sovereign in one or two plain sentences (at most 25 words), in your voice. Answer as JSON: { reply, mood, action: { type, request, text } }.' }) });
      calls.talk++; account(model, usage);
      const t = normaliseTalk(data, { trim: trimReply });
      if (!t) throw new MindError('bad_json', 'persona talk had no reply');
      return { ...t, usage, model };
    },

    health() {
      const t = now();
      while (stamps.length && t - stamps[0] > 60000) stamps.shift();
      while (spend.length && t - spend[0].t > 600000) spend.shift();
      const windowUsd = spend.reduce((s, x) => s + x.usd, 0);
      const windowMs = Math.min(600000, Math.max(1, t - (spend.length ? spend[0].t : t)));
      const perHour = spend.length ? windowUsd / (windowMs / 3600000) : 0;
      const prefix = readPrompt('persona');
      return {
        status, models, directorEveryMs: Number(config.directorEveryMs) || 600000,
        calls: { ...calls }, usage: Object.fromEntries(Object.entries(usage).map(([m, u]) => [m, { ...u, usd: +usdOf(m, u).toFixed(4) }])),
        usd: { total: +usdTotal.toFixed(4), perHour: +perHour.toFixed(3), window: '10 min', uptimeMin: +((t - t0) / 60000).toFixed(1), rates: RATES },
        budget: { maxPerMin, usedLastMin: stamps.length, rejected: calls.budget },
        cache: { sharedPrefixTokensEst: tokensEst(prefix), minimumToCache: 4096, note: 'Haiku 4.5 caches a prefix only from 4096 tokens; the shared rules block is written past that so one cache entry serves every mind' },
        timeouts: MINDS_TIMEOUTS, actions: MIND_ACTIONS,
      };
    },
  };
}

const describeAffinity = a => (a <= -0.5 ? 'you cannot stand each other' : a < -0.15 ? 'you do not get on' : a >= 0.5 ? 'close friends' : a > 0.15 ? 'you get on well' : 'neither here nor there');
const describeWorld = w => (!w ? 'an ordinary day' : `day ${w.day || 1}${w.hungry ? ', the town is hungry' : ''}${w.food != null ? `, ${w.food} food in the crates` : ''}${w.minister ? `, ${w.minister} is minister` : ', no minister yet'}${w.sites && w.sites.length ? `, sites: ${w.sites.join(', ')}` : ''}`);

// the server's mock director: from the snapshot alone (the browser's mock reads the live state; this one answers the route offline)
export function mockDirectFromSnapshot(body) {
  const s = body.snapshot || {};
  const n = (body.story && body.story.directions) || 0;
  const agents = Array.isArray(s.agents) ? s.agents : [];
  const seed = `${n}|${s.day || 1}|${body.reason}`;
  const h = [...seed].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  const events = [];
  const bonds = Array.isArray(body.relationships) ? body.relationships : [];
  const worst = bonds.find(b => b.affinity <= -0.3);
  const open = Array.isArray(s.conflicts) && s.conflicts.length > 0;
  if (body.reason === 'start') events.push({ kind: 'weather', agentIds: [], neighbourId: '', topic: 'arrival', text: 'A clear morning: the cream ground is warm and the sea is gold.', severity: 1 });
  else if (!open && worst && !s.election) events.push({ kind: 'conflict', agentIds: [worst.a, worst.b], neighbourId: '', topic: ['who gets the credit for the first wall', 'a borrowed tool not returned', 'who should lead the next site'][h % 3], text: '', severity: 1 });
  else if ((s.mood || 65) < 50) events.push({ kind: 'festival', agentIds: [], neighbourId: '', topic: 'lanterns', text: 'Lanterns on the square tonight: a small feast to lift the mood.', severity: 1 });
  else if (Array.isArray(s.neighbours) && s.neighbours.some(x => x.attitude < 40) && h % 2 === 0) { const cold = s.neighbours.filter(x => x.attitude < 40)[0]; events.push({ kind: 'visitor', agentIds: [], neighbourId: cold.id, topic: 'a cautious visit', text: `A traveller of ${cold.name} walks in with news and a long look at our crates.`, severity: 1 }); }
  else events.push({ kind: 'weather', agentIds: [], neighbourId: '', topic: ['sea fog', 'a warm wind', 'a short rain'][h % 3], text: ['Sea fog creeps over the plot; the folk work close and talk low.', 'A warm wind from the Riviera; everyone is a little lighter.', 'A short rain, then a rainbow over the lake.'][h % 3], severity: 1 });
  const nudges = agents.filter(a => a.homeless).slice(0, 1).map(a => ({ agentId: a.id, goal: 'a roof of my own before the next cold night' }));
  const amb = agents.filter(a => Array.isArray(a.traits) && a.traits.includes('ambitious') && a.id !== s.minister)[n % Math.max(1, agents.filter(a => Array.isArray(a.traits) && a.traits.includes('ambitious') && a.id !== s.minister).length)];
  if (amb) nudges.push({ agentId: amb.id, goal: `${amb.goal || 'a place of my own'}, and soon` });
  const minister = agents.find(a => a.id === s.minister);
  const res = s.res || s.resources || {};
  const sites = (s.buildings || []).filter(b => b.status !== 'done');
  const body2 = `${['Founder,', 'A short report, as promised.', 'From the minister\'s desk:'][h % 3]}\n\n${agents.length} of us, ${res.food != null ? res.food + ' food in the crates' : 'the crates as they are'}${s.hungry ? ' and empty bowls' : ''}. ${sites.length ? `Sites: ${sites.map(b => b.name).join(', ')}. ` : 'No site open. '}${worst ? `${worst.names} do not get on; keep an eye on it. ` : 'Moods hold. '}${open ? `Trouble: ${s.conflicts[0].summary} ` : ''}My advice: ${s.hungry ? 'a farm before anything' : sites.length ? 'let the crews finish' : 'a house for the ones outside'}.\n\n— ${minister ? minister.name : 'the Ministry of Builds'}`;
  return normaliseDirection({ arc_note: `Day ${s.day || 1}: ${worst ? worst.names.replace(' & ', ' and ') + ' circle each other' : 'the camp finds its feet'}; ${sites.length ? 'walls go up' : 'a pause'}.`, events, nudges, minister_briefing: { subject: ['How things stand', 'The crates and the folk', 'A word from the minister'][h % 3], body: body2 } });
}

export { voicePrefix };
