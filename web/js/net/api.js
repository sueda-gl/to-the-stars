// The net client for server/ (ARCHITECTURE §3 and §8). JSON in, JSON out, except codegen (SSE).
//   const api = createApi({ base: '' })
//   api.health()                                   -> { ok, mock, models:{logic, visual}, stt }
//   api.command({ transcript, pointer, selected, snapshot }) -> { actions:[Action], say?:{from, text} }
//   api.society({ snapshot, recent, wants })       -> { letters:[LetterDraft], events:[...] }   wants: ['report'] asks for the minister's report
//   api.letter({ purpose, agent, context, snapshot }) -> { subject, body, options? }
//   api.talk(game.talkContext(agentId, text))      -> { agentId, reply, mood, action|null }   one folk answers in a bubble
//   api.minds(route, body, { timeoutMs })          -> the JSON answer of POST /api/minds/<cast|think|converse|reflect|direct> (ART_DIRECTION §18)
//   api.sketch({ request, snapshot })              -> { name, footprint, height, parts:[...] } | null when the server has no /api/sketch yet
//   api.codegen({ request, kindHint, snapshot }, { onStatus, onDone, onError }) -> { abort(), done:Promise<asset> }
//   api.create({ request, kindHint, snapshot }, { onSketch, onStatus, onDone, onError }) -> { abort(), done }  sketch + codegen together
//   api.assets()                                   -> [asset]
// Errors are ApiError { code:'timeout'|'network'|'http'|'bad_json'|'aborted'|'server'|'stream', status?, body? }.
// Network errors retry once (not timeouts, not HTTP errors, not aborts).
// Client timeouts sit ABOVE the server's live-model timeouts (command 25 s, letter 30 s, society 60 s) so a slow live
// mind falls back to the server's mock answer instead of the client erroring first.
import { readSSE } from './sse.js';

export class ApiError extends Error {
  constructor(code, message, extra = {}) { super(message); this.name = 'ApiError'; this.code = code; Object.assign(this, extra); }
  get retryable() { return this.code === 'network' || (this.code === 'http' && this.status >= 502 && this.status <= 504); }
}

export const TIMEOUTS = { health: 4000, command: 32000, society: 70000, letter: 38000, sketch: 32000, talk: 22000, assets: 10000, codegen: 300000, codegenIdle: 120000 };
// The minds routes (ART_DIRECTION §18, docs/minds.md "net"): the client timeout sits ABOVE the loop's own race (think 5 s,
// converse 12 s, reflect 8 s, cast 60 s, direct 90 s) and above the server's live caps (4.5 s / 2-4 x 4 s / 7 s / 90 s / 60 s),
// so the loop's rules fallback fires first and a server mock answer never races a client error.
export const MINDS_TIMEOUTS = { think: 6500, converse: 14000, reflect: 10000, cast: 95000, direct: 95000 };

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

export function createApi({ base = '', fetch: fetchFn = (...a) => globalThis.fetch(...a), timeouts = {}, retries = 1, retryDelayMs = 400, log = () => {} } = {}) {
  const T = { ...TIMEOUTS, ...timeouts };
  const url = (p) => `${base}${p}`;

  // One request with a hard timeout; returns the Response. Throws ApiError on network/timeout/abort.
  async function request(path, { method = 'GET', body, timeoutMs, signal, accept = 'application/json' }) {
    const ac = new AbortController();
    const onAbort = () => ac.abort(signal?.reason);
    if (signal?.aborted) throw new ApiError('aborted', 'request aborted');
    signal?.addEventListener('abort', onAbort, { once: true });
    const timer = setTimeout(() => ac.abort(new ApiError('timeout', `${path} took longer than ${timeoutMs} ms`)), timeoutMs);
    try {
      return await fetchFn(url(path), {
        method, signal: ac.signal,
        headers: { Accept: accept, ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch (e) {
      if (e instanceof ApiError) throw e;
      if (ac.signal.aborted) { const r = ac.signal.reason; throw r instanceof ApiError ? r : new ApiError('aborted', 'request aborted'); }
      throw new ApiError('network', `${path}: ${e?.message || 'network error'}`, { cause: e });
    } finally { clearTimeout(timer); signal?.removeEventListener('abort', onAbort); }
  }

  async function readError(res, path) {
    let body = null, text = '';
    try { text = await res.text(); body = JSON.parse(text); } catch { /* keep text */ }
    const msg = body?.error?.message || body?.error || body?.message || text.slice(0, 200) || res.statusText;
    return new ApiError(res.status >= 500 ? 'server' : 'http', `${path} -> ${res.status}: ${msg}`, { status: res.status, body: body ?? text });
  }

  async function json(path, { method = 'GET', body, timeoutMs, signal } = {}) {
    let attempt = 0;
    for (;;) {
      try {
        const res = await request(path, { method, body, timeoutMs, signal });
        if (!res.ok) throw await readError(res, path);
        try { return await res.json(); }
        catch (e) { throw new ApiError('bad_json', `${path}: response was not JSON`, { cause: e }); }
      } catch (e) {
        const err = e instanceof ApiError ? e : new ApiError('network', e?.message || String(e), { cause: e });
        if (err.code === 'network' && attempt < retries) { attempt++; log('retry', path, err.message); await sleep(retryDelayMs); continue; }
        throw err;
      }
    }
  }

  // one minds call: a single attempt (the loop has the rules behind it, a retry would only blow its timeout)
  async function mindsJson(path, body, timeoutMs, signal) {
    const res = await request(path, { method: 'POST', body, timeoutMs, signal });
    if (!res.ok) throw await readError(res, path);
    try { return await res.json(); }
    catch (e) { throw new ApiError('bad_json', `${path}: response was not JSON`, { cause: e }); }
  }

  const api = {
    ApiError,
    health: (o = {}) => json('/api/health', { timeoutMs: T.health, ...o }),
    // scene ('earth' | 'moon') and mark (the cursor mark, ARCHITECTURE §10) ride along when given
    command: ({ transcript, pointer = null, selected = null, snapshot, scene = undefined, mark = undefined }, o = {}) =>
      json('/api/command', { method: 'POST', body: { transcript, pointer, selected, snapshot, ...(scene ? { scene } : {}), ...(mark ? { mark } : {}) }, timeoutMs: T.command, ...o }),
    society: ({ snapshot, recent = [], wants = [] }, o = {}) =>
      json('/api/society', { method: 'POST', body: { snapshot, recent, wants }, timeoutMs: T.society, ...o }),
    letter: ({ purpose, agent = null, context = null, snapshot }, o = {}) =>
      json('/api/letter', { method: 'POST', body: { purpose, agent, context, snapshot }, timeoutMs: T.letter, ...o }),
    // Talk to one folk (ART_DIRECTION §11): the body is the sim's game.talkContext(agentId, text);
    // -> { agentId, reply, mood, action|null, meta }. The server's mock answers offline; 22 s sits above its 15 s live cap.
    talk: (body, o = {}) => json('/api/talk', { method: 'POST', body, timeoutMs: T.talk, ...o }),
    // The agent minds (ART_DIRECTION §18): POST /api/minds/<cast|think|converse|reflect|direct> with the loop's request body
    // -> the JSON answer (with `meta.mind` 'live' | 'mock'). The loop (sim/mindloop.js) races each call against its own
    // timeout and passes it as `timeoutMs`; the client waits a little longer than that (MINDS_TIMEOUTS, never less than the
    // loop's + 1 s), so a late answer is the loop's to drop. No retry: a network error, a 503 `{ code: 'off' }` or any HTTP
    // error rejects at once and the loop answers from the rules for that call.
    minds: (route, body, { timeoutMs = null, signal = null } = {}) => {
      const r = String(route || '').replace(/^\/?api\/minds\//, '');
      if (!['cast', 'think', 'converse', 'reflect', 'direct'].includes(r)) return Promise.reject(new ApiError('http', `no such minds route: ${route}`, { status: 404 }));
      const own = MINDS_TIMEOUTS[r], ms = Math.max(own, (Number(timeoutMs) || 0) + 1000);
      return mindsJson(`/api/minds/${r}`, body, ms, signal);
    },
    // Massing sketch (ARCHITECTURE §8). Resolves null, never throws 404, while the server lacks the route; after
    // one 404/405 it stops asking (api.sketchAvailable === false) so codegen runs alone.
    sketch: async ({ request, snapshot }, o = {}) => {
      if (api.sketchAvailable === false) return null;
      try {
        const r = await json('/api/sketch', { method: 'POST', body: { request, snapshot }, timeoutMs: T.sketch, ...o });
        api.sketchAvailable = true;
        return r && typeof r === 'object' ? (r.sketch || r) : null;
      } catch (e) {
        if (e instanceof ApiError && e.code === 'http' && (e.status === 404 || e.status === 405)) { api.sketchAvailable = false; log('sketch', 'no /api/sketch on this server; codegen alone'); return null; }
        throw e;
      }
    },
    sketchAvailable: null,   // null = unknown, true/false once probed
    assets: (o = {}) => json('/api/assets', { timeoutMs: T.assets, ...o }).then(r => Array.isArray(r) ? r : (r?.assets || [])),

    // SSE over POST. Events: status {stage}, done {asset}, error {message}.
    // Also accepts data-only framing where the JSON carries `type`/`event`.
    codegen({ request: req, kindHint = null, snapshot }, { onStatus = () => {}, onDone = () => {}, onError = () => {}, signal: outer = null } = {}) {
      const ac = new AbortController();
      outer?.addEventListener?.('abort', () => ac.abort(), { once: true });
      // Total bound: the per-request timer is cleared once headers land, so this one covers the whole stream.
      const total = setTimeout(() => ac.abort(new ApiError('timeout', `/api/codegen took longer than ${T.codegen} ms`)), T.codegen);
      const done = (async () => {
        let asset = null, failed = null;
        try {
          const res = await request('/api/codegen', { method: 'POST', body: { request: req, kindHint, snapshot }, timeoutMs: T.codegen, signal: ac.signal, accept: 'text/event-stream' });
          if (!res.ok) throw await readError(res, '/api/codegen');
          const ctype = res.headers?.get?.('content-type') || '';
          if (!ctype.includes('text/event-stream')) {
            // A plain JSON answer (a cached asset, or a mock that doesn't stream): accept it.
            const j = await res.json().catch(() => { throw new ApiError('bad_json', '/api/codegen: not SSE and not JSON'); });
            if (j?.asset) { asset = j.asset; return asset; }
            if (j?.error) throw new ApiError('server', j.error.message || String(j.error), { body: j });
            throw new ApiError('bad_json', '/api/codegen: unexpected JSON shape', { body: j });
          }
          await readSSE(res, {
            signal: ac.signal, idleMs: T.codegenIdle,
            onEvent: ({ event, json: data }) => {
              const d = data && typeof data === 'object' ? data : { message: String(data ?? '') };
              const kind = event !== 'message' ? event : (d.type || d.event || 'message');
              if (kind === 'status') onStatus({ stage: d.stage || d.status || 'working', ...d });
              else if (kind === 'done') { asset = d.asset || d; }
              else if (kind === 'error') { failed = new ApiError('server', d.message || 'codegen failed', { body: d }); }
            },
          });
          if (failed) throw failed;
          if (!asset) throw new ApiError('stream', '/api/codegen: stream ended without a done event');
          return asset;
        } catch (e) {
          const reason = ac.signal.aborted ? ac.signal.reason : null;
          const err = e instanceof ApiError ? e : reason instanceof ApiError ? reason : new ApiError(e?.code === 'timeout' ? 'timeout' : ac.signal.aborted ? 'aborted' : 'network', e?.message || String(e), { cause: e });
          throw err;
        } finally { clearTimeout(total); }
      })();
      done.then(a => onDone(a), e => onError(e));
      return { abort: () => ac.abort(), done };
    },

    // The creation moment for an unknown thing (CONCEPT "pencil, then paint"): codegen starts at once; the massing
    // sketch is asked for in parallel and handed to onSketch if it lands first. A missing /api/sketch, a sketch error
    // or a late sketch are all silent: codegen alone is the contract, the sketch is a bonus.
    create({ request: req, kindHint = null, snapshot }, { onSketch = () => {}, onStatus = () => {}, onDone = () => {}, onError = () => {}, signal = null } = {}) {
      let settled = false;
      const gen = api.codegen({ request: req, kindHint, snapshot }, { onStatus, signal, onDone: (a) => { settled = true; onDone(a); }, onError: (e) => { settled = true; onError(e); } });
      const sketch = api.sketch({ request: req, snapshot }, { signal }).then(
        (s) => { if (s && !settled) onSketch(s); return s; },
        (e) => { log('sketch', e?.message || e); return null; });
      return { abort: gen.abort, done: gen.done, sketch };
    },
  };
  return api;
}

export const api = createApi();
export default api;
