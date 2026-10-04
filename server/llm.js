// The live mind: a thin layer over @anthropic-ai/sdk for the two models.
//   logic  claude-fable-5-1  thinking always on (no `thinking` param), effort per route, no temperature,
//                            no prefill, no forced tool_choice; structured outputs via output_config.format.
//   visual claude-opus-5-5   thinking can't be disabled; effort set explicitly (default would be medium).
// Both: server-side fallbacks "default" (beta server-side-fallback-2026-07-01), stop_reason checked,
// prompt caching on the stable system prefix (system text + catalogue), volatile snapshot last.
import Anthropic from '@anthropic-ai/sdk';

export const FALLBACK_BETA = 'server-side-fallback-2026-07-01';
// Fast mode (research preview, Claude API only): `speed:'fast'` + this beta on claude-opus-5-5 (also Opus 5 / 4.8).
// Codegen tries it first and falls back to standard on 429 / 400 / any error (routes.js).
export const FAST_MODE_BETA = 'fast-mode-2026-02-01';
export const FAST_MODELS = /^claude-opus-(5-5|5|4-8)\b/;

export class MindError extends Error {
  constructor(code, message, extra = {}) { super(message); this.name = 'MindError'; this.code = code; Object.assign(this, extra); }
}

// Most specific first; APIConnectionError is a subclass of APIError in the TS SDK, so it is checked before it.
export function classifyError(err) {
  if (err instanceof MindError) return err;
  if (err instanceof Anthropic.AuthenticationError) return new MindError('auth', 'Anthropic rejected the credential (401). Check ANTHROPIC_API_KEY / ANTHROPIC_AUTH_TOKEN.', { status: 401 });
  if (err instanceof Anthropic.PermissionDeniedError) return new MindError('forbidden', `Permission denied (403): ${err.message}`, { status: 403 });
  if (err instanceof Anthropic.NotFoundError) return new MindError('not_found', `Not found (404), probably a wrong model id: ${err.message}`, { status: 404 });
  if (err instanceof Anthropic.RateLimitError) return new MindError('rate_limit', 'Rate limited (429). Try again in a moment.', { status: 429, retryable: true });
  if (err instanceof Anthropic.BadRequestError) return new MindError('bad_request', `Bad request (400): ${err.message}`, { status: 400 });
  if (err instanceof Anthropic.UnprocessableEntityError) return new MindError('unprocessable', `Unprocessable (422): ${err.message}`, { status: 422 });
  if (err instanceof Anthropic.InternalServerError) return new MindError('server', `Anthropic server error (${err.status}): ${err.message}`, { status: err.status, retryable: true });
  if (err instanceof Anthropic.APIConnectionTimeoutError) return new MindError('timeout', 'The mind took too long to answer.', { retryable: true });
  if (err instanceof Anthropic.APIConnectionError) return new MindError('network', `Could not reach the Anthropic API: ${err.message}`, { retryable: true });
  if (err instanceof Anthropic.APIError) return new MindError('api', `API error ${err.status ?? ''}: ${err.message}`, { status: err.status });
  return new MindError('unknown', err?.message || String(err));
}

function usageOf(msg) {
  const u = msg?.usage || {};
  return { input: u.input_tokens ?? 0, output: u.output_tokens ?? 0, cacheRead: u.cache_read_input_tokens ?? 0, cacheWrite: u.cache_creation_input_tokens ?? 0 };
}

// Reads a message: refusal / truncation are errors, otherwise the joined text (fallbacks noted).
export function readMessage(msg) {
  if (msg.stop_reason === 'refusal') {
    const d = msg.stop_details || {};
    throw new MindError('refusal', `The mind declined (${d.category || 'unspecified'}): ${d.explanation || 'no explanation'}`, { category: d.category || null });
  }
  if (msg.stop_reason === 'max_tokens') throw new MindError('truncated', 'The answer hit max_tokens; raise it or shorten the prompt.');
  const text = (msg.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
  const fellBack = (msg.usage?.iterations || []).some(i => i.type === 'fallback_message');
  return { text, usage: usageOf(msg), model: msg.model, fellBack };
}

export function parseJson(text) {
  try { return JSON.parse(text); } catch { /* fall through */ }
  const m = text.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch { /* fall through */ } }
  throw new MindError('bad_json', 'The mind did not return valid JSON.');
}

export function createMind(config, { client = null, log = () => {} } = {}) {
  // Zero-arg: ANTHROPIC_API_KEY, then ANTHROPIC_AUTH_TOKEN, then an `ant auth login` profile.
  const anthropic = client || new Anthropic({ maxRetries: 1 });

  // `plain` (ART_DIRECTION §18, the Haiku 4.5 persona minds): no server-side fallbacks beta, no `fallbacks`, no `effort`
  // (Haiku 4.5 has no effort ladder; thinking is off when the `thinking` param is omitted). `systemBlocks` is an ordered list
  // of stable prefixes, each with its own cache breakpoint: [the shared rules (one cache entry for all minds), the persona].
  // Haiku 4.5's cacheable minimum is 4096 tokens per prefix (shared/prompt-caching.md), so the shared block is written long.
  const baseParams = ({ model, system, systemBlocks, user, effort, maxTokens, schema, messages, speed, plain = false }) => ({
    model,
    max_tokens: maxTokens,
    ...(plain ? {} : { betas: speed === 'fast' ? [FALLBACK_BETA, FAST_MODE_BETA] : [FALLBACK_BETA], fallbacks: 'default' }),
    ...(speed === 'fast' ? { speed: 'fast' } : {}),
    // Stable prefix: cached. Each block carries a breakpoint (the last one caches everything before it too).
    system: systemBlocks ? systemBlocks.map(text => ({ type: 'text', text, cache_control: { type: 'ephemeral' } })) : [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
    // Volatile snapshot + transcript: after the breakpoint, never cached.
    messages: messages || [{ role: 'user', content: [{ type: 'text', text: user }] }],
    output_config: { ...(effort && !plain ? { effort } : {}), ...(schema ? { format: { type: 'json_schema', schema } } : {}) },
  });

  return {
    client: anthropic,
    // One structured call -> parsed JSON object. `plain: true` + `systemBlocks` for the persona minds (above).
    async structured({ model, system, systemBlocks, user, messages, schema, effort = 'low', maxTokens = 4000, timeout = 30000, label = 'call', retries = null, plain = false }) {
      const t0 = Date.now();
      try {
        const msg = await anthropic.beta.messages.create(baseParams({ model, system, systemBlocks, user, messages, effort, maxTokens, schema, plain }), { timeout, ...(retries === null ? {} : { maxRetries: retries }) });
        const r = readMessage(msg);
        log('info', `${label} ${model} ${Date.now() - t0}ms in=${r.usage.input} cacheRead=${r.usage.cacheRead} cacheWrite=${r.usage.cacheWrite} out=${r.usage.output}${r.fellBack ? ' (served by fallback ' + r.model + ')' : ''}`);
        return { data: parseJson(r.text), usage: r.usage, model: r.model, ms: Date.now() - t0, fellBack: r.fellBack };
      } catch (err) { throw classifyError(err); }
    },
    // Streaming call (text or structured). onStatus fires once when the first text token lands.
    // `messages` lets the caller continue a conversation (repair turns) while keeping the same cached system.
    // `speed:'fast'` requests fast mode (only honoured for FAST_MODELS; others silently use standard).
    async stream({ model, system, user, schema, effort = 'high', maxTokens = 32000, timeout = 300000, label = 'stream', messages, onText, onFirstText, signal, speed = 'standard' }) {
      const t0 = Date.now();
      const fast = speed === 'fast' && FAST_MODELS.test(model);
      try {
        const s = anthropic.beta.messages.stream(baseParams({ model, system, user, effort, maxTokens, schema, messages, speed: fast ? 'fast' : 'standard' }), { timeout, signal });
        let first = true;
        s.on('text', (delta) => { if (first) { first = false; onFirstText?.(); } onText?.(delta); });
        const msg = await s.finalMessage();
        const r = readMessage(msg);
        log('info', `${label} ${model}${fast ? ' fast' : ''} ${Date.now() - t0}ms in=${r.usage.input} cacheRead=${r.usage.cacheRead} out=${r.usage.output}${r.fellBack ? ' (fallback ' + r.model + ')' : ''}`);
        return { text: r.text, message: msg, usage: r.usage, model: r.model, ms: Date.now() - t0, speed: fast ? 'fast' : 'standard' };
      } catch (err) { throw classifyError(err); }
    },
  };
}
