// The mind loop (ART_DIRECTION §18): who thinks when. Pure scheduling over the sim's clock (`state.t`) and a wall
// clock for the budget. The game layer gives it one `call(route, body, { timeoutMs })` that reaches the server's
// /api/minds/* routes (and `visible()` / `paused()`); without a call, or in mock mode, the sim's own mocks answer at
// the same cadence, so the folk visibly think offline. Every answer is applied through minds.js; every failure or
// timeout falls back to the rules (mockThink) for that folk, with backoff, and the sim's tasks never stop meanwhile.
//
//   const loop = createMindLoop(game, { call, visible: () => !document.hidden, paused: () => menuOpen, mode: 'live' });
//   game.attachMinds(loop);                       // game.tick drives loop.update(); game.minds === loop
//   loop.start();                                  // casts (once), then the cadence
//   loop.poke(agentId, 'spoken_to');               // an event trigger
//   loop.direct('demand');                         // the director on demand
//   loop.status() -> { mode, inFlight, calls, failures, perMin, cast, director:{ runs, lastAt, nextAt } }
//   events on the game: mind:status, mind:cast, agent:intent, agent:say (kind 'mind' | 'chat'), conversation:*, mind:direct, mind:reflect
import { MIND, castRequest, setPersonas, mockCast, thinkRequest, mockThink, applyIntent, converseRequest, mockConverse, applyConversation, reflectRequest, mockReflect, normaliseReflect, addReflection, needsReflection, directRequest, mockDirect, applyDirection, noteMilestone, mindOf, personaForNewcomer, inConversation } from './minds.js';
import { hashString } from './rng.js';

const alive = a => a && a.status !== 'left';

export function createMindLoop(game, { call = null, visible = () => true, paused = () => false, mode = null, now = null, budget = {}, directorEveryMs = null, log = null } = {}) {
  const nowInjected = typeof now === 'function';
  now = nowInjected ? now : () => Date.now();
  const { state } = game;
  const B = { maxPerMin: MIND.maxPerMin, concurrency: MIND.concurrency, timeoutMs: MIND.timeoutMs, ...budget };
  const dirEvery = Number.isFinite(directorEveryMs) ? directorEveryMs : MIND.directorEveryMs;
  const local = !call || mode === 'mock';
  const status = { mode: mode || (local ? 'mock' : 'live'), enabled: false, inFlight: 0, calls: { cast: 0, think: 0, converse: 0, reflect: 0, direct: 0 }, failures: 0, consecutive: 0, perMin: 0, lastError: null, cast: false, rulesUntil: 0, director: { runs: 0, lastAt: null, nextAt: null, pending: null } };
  const stamps = [];                       // wall-clock timestamps of dispatches in the last minute
  const waiting = new Set();               // live calls waiting for an answer: { kind, started, timeoutMs, expire }
  const realClock = !nowInjected;
  const inflight = new Map();              // key -> { kind, started }
  const pendingDirect = [];                // reasons waiting for the director (milestones)
  let castPending = false;
  let seq = 0;
  const say = (ev, p) => game.emit(ev, p);
  const emitStatus = (extra = {}) => say('mind:status', { ...snapshotStatus(), ...extra });
  const snapshotStatus = () => ({ mode: status.rulesUntil > now() ? 'rules' : status.mode, enabled: status.enabled, inFlight: status.inFlight, calls: { ...status.calls }, failures: status.failures, perMin: status.perMin, lastError: status.lastError, cast: status.cast, rulesUntil: status.rulesUntil || null, director: { ...status.director } });
  const logLine = (t) => { if (log) log(t); game.log(`[minds] ${t}`); };

  // ---- the budget: a sliding minute, a concurrency cap, the pause rules
  function trimStamps() { const t = now(); while (stamps.length && t - stamps[0] > 60000) stamps.shift(); status.perMin = stamps.length; }
  const underBudget = () => { trimStamps(); return stamps.length < B.maxPerMin && status.inFlight < B.concurrency; };
  const canSchedule = () => status.enabled && visible() && !paused() && state.scene !== 'moon' && !state.fleetHold && !state.meeting;

  // ---- one dispatch: local mock (synchronous) or the server (a promise raced against the timeout)
  function dispatch(kind, body, onResult, onError, { timeoutMs = B.timeoutMs } = {}) {
    status.calls[kind]++;
    stamps.push(now());
    if (local) {
      let r = null;
      try { r = localAnswer(kind, body); } catch (e) { onError(e); return; }
      onResult(r, { mind: 'mock' });
      return;
    }
    // the caller owns the in-flight key (think:<id>, conv:<id>, refl:<id>; the cast and the director are not persona calls and do not
    // count toward the concurrency cap); this only races the call against the timeout, and a late answer is dropped
    let settled = false;
    const entry = { kind, started: now(), timeoutMs, id: ++seq, timer: null };
    const expire = () => { if (settled) return; settled = true; waiting.delete(entry); onError(Object.assign(new Error(`${kind} timed out after ${timeoutMs} ms`), { code: 'timeout' })); };
    entry.expire = expire;
    waiting.add(entry);
    // the timeout is swept on the loop's clock in update() (so a paused or injected clock is honoured); on the real clock a timer backs it up
    if (realClock) entry.timer = setTimeout(expire, timeoutMs + 50);
    let p;
    try { p = Promise.resolve(call(kind, body, { timeoutMs })); } catch (e) { p = Promise.reject(e); }
    const done = () => { settled = true; waiting.delete(entry); if (entry.timer) clearTimeout(entry.timer); };
    p.then(r => { if (settled) return; done(); onResult(r, (r && r.meta) || { mind: 'live' }); },
      e => { if (settled) return; done(); onError(e); });
  }
  function localAnswer(kind, body) {
    switch (kind) {
      case 'cast': return mockCast(game);
      case 'think': return mockThink(body);
      case 'converse': return mockConverse(body);
      case 'reflect': return mockReflect(body);
      case 'direct': return mockDirect(game, body.reason);
      default: return null;
    }
  }
  function failed(kind, e, { agentId = null } = {}) {
    status.failures++; status.consecutive++;
    status.lastError = { kind, code: (e && e.code) || 'error', message: String((e && e.message) || e).slice(0, 160), at: now() };
    if (agentId) { const a = state.agents.find(x => x.id === agentId); if (a) mindOf(a).fails++; }
    if (status.consecutive >= 5 && status.rulesUntil <= now()) { status.rulesUntil = now() + 60000; logLine(`five calls failed in a row (${status.lastError.message}); the rules carry the town for a minute`); }
    emitStatus({ agentId, error: status.lastError });
  }
  function succeeded(meta) { status.consecutive = 0; if (meta && meta.mind === 'mock' && meta.budget) { /* the server answered from its mock: over its budget */ } }

  // ---- the cast
  function cast() {
    if (status.cast || castPending) return;
    castPending = true;
    dispatch('cast', castRequest(game), (r, meta) => { castPending = false; const n = setPersonas(game, r); status.cast = n > 0; if (n > 0) state.agents.forEach(a => { if (a.status !== 'left' && !(state.personas || {})[a.id]) personaForNewcomer(game, a); }); /* past the cast's cap (40): the townsfolk companies */ succeeded(meta); logLine(`cast ${n} personas (${meta.mind || 'live'})`); if (!status.cast) { setPersonas(game, mockCast(game)); status.cast = true; } schedule(); emitStatus(); },
      e => { castPending = false; failed('cast', e); setPersonas(game, mockCast(game)); status.cast = true; schedule(); emitStatus(); }, { timeoutMs: Math.max(B.timeoutMs, 60000) });
  }
  // the first decisions, staggered by folk (hash, so a replay staggers the same way)
  function schedule() {
    const folk = state.agents.filter(alive);
    folk.forEach((a, i) => { const m = mindOf(a); if (m.dueAt == null) m.dueAt = state.t + MIND.firstThinkAfter + (i * (MIND.thinkEvery[0] / Math.max(1, folk.length))) + (hashString(a.id) % 100) / 50; });
  }
  const nextThink = a => { const m = mindOf(a); const [lo, hi] = MIND.thinkEvery; m.dueAt = state.t + lo + ((hashString(`${a.id}|${m.calls}`) % 1000) / 1000) * (hi - lo); };
  const backoffThink = a => { const m = mindOf(a); const [lo, hi] = MIND.backoff; m.dueAt = state.t + Math.min(hi, lo * Math.pow(2, Math.max(0, m.fails - 1))); };

  // ---- one folk thinks
  function think(a, reason = 'cadence') {
    const m = mindOf(a);
    if (inflight.has(`think:${a.id}`)) return;
    const body = thinkRequest(game, a.id);
    if (!body) return;
    if (reason !== 'cadence') body.state.trigger = m.trigger = reason;
    m.dueAt = state.t + 3600;   // not again until the answer (or the timeout) lands
    if (status.rulesUntil > now()) { applyIntent(game, a.id, mockThink(body), { source: 'rules' }); nextThink(a); return; }
    const key = `think:${a.id}`;
    inflight.set(key, { kind: 'think', started: now() }); status.inFlight = inflight.size;
    const done = () => { if (inflight.delete(key)) status.inFlight = inflight.size; };
    dispatch('think', body, (r, meta) => { done(); succeeded(meta); applyIntent(game, a.id, r, { source: meta && meta.mind === 'mock' ? (local ? 'mock' : 'server-mock') : 'mind' }); m.fails = 0; nextThink(a); afterThink(a); },
      e => { done(); failed('think', e, { agentId: a.id }); applyIntent(game, a.id, mockThink(body), { source: 'rules' }); backoffThink(a); afterThink(a); });
  }
  function afterThink(a) {
    // a conversation this decision started wants its lines; a full memory wants a reflection
    const c = (state.conversations || []).find(x => x.status === 'pending' && (x.a === a.id || x.b === a.id));
    if (c) converse(c);
  }

  // ---- a conversation: the server runs the alternating turns; the lines come back together
  function converse(c) {
    if (c.status !== 'pending' || inflight.has(`conv:${c.id}`)) return;
    const body = converseRequest(game, c.id);
    if (!body) { c.status = 'done'; return; }
    c.status = 'asking';
    if (status.rulesUntil > now()) { applyConversation(game, c.id, mockConverse(body)); return; }   // the rules minute: the mock lines, no call
    const key = `conv:${c.id}`;
    inflight.set(key, { kind: 'converse', started: now() }); status.inFlight = inflight.size;
    const done = () => { if (inflight.delete(key)) status.inFlight = inflight.size; };
    dispatch('converse', body, (r, meta) => { done(); succeeded(meta); applyConversation(game, c.id, r); },
      e => { done(); failed('converse', e); applyConversation(game, c.id, mockConverse(body)); }, { timeoutMs: Math.max(B.timeoutMs, 12000) });
  }

  // ---- a reflection
  function reflect(a) {
    if (inflight.has(`refl:${a.id}`)) return;
    const body = reflectRequest(game, a.id);
    if (!body) return;
    const m = mindOf(a); m.unreflected = 0;   // asked; the count starts again (a failure reflects by the rules)
    if (status.rulesUntil > now()) { addReflection(game, a, normaliseReflect(mockReflect(body))); return; }
    const key = `refl:${a.id}`;
    inflight.set(key, { kind: 'reflect', started: now() }); status.inFlight = inflight.size;
    const done = () => { if (inflight.delete(key)) status.inFlight = inflight.size; };
    dispatch('reflect', body, (r, meta) => { done(); succeeded(meta); addReflection(game, a, normaliseReflect(r)); },
      e => { done(); failed('reflect', e); addReflection(game, a, normaliseReflect(mockReflect(body))); }, { timeoutMs: Math.max(B.timeoutMs, 8000) });
  }

  // ---- the director
  function direct(reason = 'demand') {
    if (status.director.pending) { if (reason !== 'periodic' && !pendingDirect.includes(reason)) pendingDirect.push(reason); return false; }
    const t = now();
    if (reason !== 'demand' && reason !== 'start' && status.director.lastAt != null && t - status.director.lastAt < MIND.directorMinGapMs) { if (!pendingDirect.includes(reason)) pendingDirect.push(reason); return false; }
    status.director.pending = reason;
    const body = directRequest(game, reason);
    if (status.rulesUntil > now()) { status.director.pending = null; status.director.runs++; status.director.lastAt = now(); status.director.nextAt = status.director.lastAt + dirEvery; applyDirection(game, mockDirect(game, reason), { reason: reason + ':rules' }); emitStatus(); return true; }
    dispatch('direct', body, (r, meta) => { status.director.pending = null; status.director.runs++; status.director.lastAt = now(); status.director.nextAt = status.director.lastAt + dirEvery; succeeded(meta); applyDirection(game, r, { reason }); emitStatus(); },
      e => { status.director.pending = null; status.director.lastAt = now(); status.director.nextAt = status.director.lastAt + dirEvery; failed('direct', e); applyDirection(game, mockDirect(game, reason), { reason: reason + ':rules' }); emitStatus(); }, { timeoutMs: Math.max(B.timeoutMs, 90000) });
    return true;
  }
  // milestones: the first building, an election, the first conflict, an institution founded
  game.on('building:done', () => { if (noteMilestone(game, 'first_building')) direct('milestone:first_building'); });
  game.on('election:result', () => { if (noteMilestone(game, 'election')) direct('milestone:election'); });
  game.on('conflict:start', ({ conflict }) => { if (noteMilestone(game, 'first_conflict')) direct('milestone:first_conflict'); for (const id of conflict.parties) poke(id, 'conflict'); });
  game.on('institution:found', ({ institution }) => { if (noteMilestone(game, 'institution')) direct('milestone:institution'); for (const id of institution.members) poke(id, 'appointed'); });
  // event triggers for the folk concerned
  game.on('minister:set', ({ agentId }) => { for (const a of state.agents.filter(alive)) poke(a.id, agentId === a.id ? 'made_minister' : 'decree'); });
  game.on('building:done', ({ building: b }) => { for (const a of state.agents.filter(alive)) if (Math.hypot(a.x - b.x, a.z - b.z) <= 12) poke(a.id, 'building_done'); });
  game.on('conflict:handle', ({ parties }) => { for (const id of parties) poke(id, 'decree'); });
  game.on('letter:resolved', ({ letterId }) => { const l = state.letters.find(x => x.id === letterId); if (l && l.from && l.from.kind === 'agent') poke(l.from.id, 'answered'); });
  game.on('agent:spawn', ({ agent }) => { if (status.cast && agent && !(state.personas || {})[agent.id]) { personaForNewcomer(game, agent); mindOf(agent).dueAt = state.t + MIND.firstThinkAfter; } });

  function poke(agentId, reason = 'event') {
    const a = state.agents.find(x => x.id === agentId);
    if (!alive(a) || !status.enabled) return false;
    const m = mindOf(a);
    const [lo, hi] = MIND.triggerDelay;
    const at = state.t + lo + ((hashString(`${a.id}|${reason}|${m.calls}`) % 1000) / 1000) * (hi - lo);
    if (m.dueAt == null || at < m.dueAt || m.dueAt > state.t + 3000) { m.dueAt = at; m.trigger = reason; }
    return true;
  }

  // ---- the beat, from game.tick
  function sweepTimeouts() { const t = now(); for (const e of [...waiting]) if (t - e.started >= e.timeoutMs) e.expire(); }
  function update() {
    sweepTimeouts();   // late answers are dropped even while paused: the folk run on the rules meanwhile
    if (!status.enabled) return;
    if (!status.cast) { if (!castPending && visible() && !paused()) cast(); return; }   // the cast may land while the squares still stand: talk has personas from the first click
    if (!canSchedule()) return;
    const t = now();
    // the director: start, then the cadence, then milestones waiting their turn
    if (status.director.nextAt == null && !status.director.pending) direct('start');
    else if (!status.director.pending && pendingDirect.length && status.director.lastAt != null && t - status.director.lastAt >= MIND.directorMinGapMs) direct(pendingDirect.shift());
    else if (!status.director.pending && status.director.nextAt != null && t >= status.director.nextAt) direct('periodic');
    // conversations waiting for lines
    for (const c of state.conversations || []) if (c.status === 'pending' && underBudget()) converse(c);
    // the folk, most overdue first
    const due = state.agents.filter(a => alive(a) && mindOf(a).dueAt != null && mindOf(a).dueAt <= state.t && !inflight.has(`think:${a.id}`) && !(a.task && ['deliver', 'journey', 'leave'].includes(a.task.kind)) && !inConversation(state, a.id)).sort((p, q) => mindOf(p).dueAt - mindOf(q).dueAt);
    for (const a of due) { if (!underBudget()) break; think(a, mindOf(a).trigger || 'cadence'); }
    // reflections, when there is room
    for (const a of state.agents.filter(alive)) { if (!underBudget()) break; if (needsReflection(a) && !inflight.has(`refl:${a.id}`)) reflect(a); }
    trimStamps();
  }

  const loop = {
    start() { if (status.enabled) return; status.enabled = true; status.director.nextAt = null; emitStatus(); },
    stop() { status.enabled = false; emitStatus(); },
    update, poke, direct, cast,
    status: snapshotStatus,
    inflight: () => [...inflight.entries()].map(([k, v]) => ({ key: k, ...v })),
    budget: B, mode: status.mode, local, seq: () => seq, waiting: () => waiting.size
  };
  return loop;
}
