// Server configuration: a tiny .env loader (no dotenv dep) and mode resolution.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const SERVER_DIR = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(SERVER_DIR, '..');
export const WEB_DIR = path.join(ROOT, 'web');
export const ASSETS_DIR = path.join(SERVER_DIR, 'data', 'assets');
export const PROMPTS_DIR = path.join(SERVER_DIR, 'prompts');
export const BUILD_API_MD = path.join(WEB_DIR, 'js', 'buildings', 'BUILD_API.md');

// Parse KEY=value lines. Supports quotes, `export KEY=`, # comments, blank lines.
export function parseEnv(text) {
  const out = {};
  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const m = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    else v = v.replace(/\s+#.*$/, '').trim();
    out[m[1]] = v;
  }
  return out;
}

// Load ROOT/.env into process.env without overriding what is already set.
export function loadDotEnv(file = path.join(ROOT, '.env')) {
  try {
    const parsed = parseEnv(fs.readFileSync(file, 'utf8'));
    for (const [k, v] of Object.entries(parsed)) if (process.env[k] === undefined) process.env[k] = v;
    return parsed;
  } catch { return {}; }
}

export function hasCredential(env = process.env) {
  return Boolean((env.ANTHROPIC_API_KEY || '').trim() || (env.ANTHROPIC_AUTH_TOKEN || '').trim());
}

// AGORA_MOCK=1 forces mock, =0 forces live, otherwise auto: live iff a key/token env var is set.
export function resolveMock(env = process.env) {
  const flag = (env.AGORA_MOCK || '').trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(flag)) return { mock: true, reason: 'AGORA_MOCK=1' };
  if (['0', 'false', 'no', 'off'].includes(flag)) return { mock: false, reason: 'AGORA_MOCK=0 (live forced; zero-arg client may use an ant auth profile)' };
  if (hasCredential(env)) return { mock: false, reason: 'credential env var present' };
  return { mock: true, reason: 'no ANTHROPIC_API_KEY / ANTHROPIC_AUTH_TOKEN (auto)' };
}

export function loadConfig(env = process.env, { dotenv = true } = {}) {
  if (dotenv) loadDotEnv();
  const { mock, reason } = resolveMock(env);
  return {
    port: Number(env.PORT || 8870),
    mock, mockReason: reason,
    models: {
      logic: env.AGORA_MODEL_LOGIC || 'claude-fable-5-1',
      visual: env.AGORA_MODEL_VISUAL || 'claude-opus-5-5',
      sketch: env.AGORA_MODEL_SKETCH || env.AGORA_MODEL_LOGIC || 'claude-fable-5-1',   // the massing sketch; a smaller model is fine here
      command: env.AGORA_MODEL_COMMAND || env.AGORA_MODEL_LOGIC || 'claude-fable-5-1', // the interpreter alone (measured 3.4-7.5 s on Fable at effort low)
    },
    stt: env.DEEPGRAM_API_KEY ? 'deepgram' : 'webspeech',
    // Mock codegen takes this long (ms) to "draw plans" so the demo shows folk working. Tests set it low.
    mockCodegenMs: Number(env.AGORA_MOCK_CODEGEN_MS || 8000),
    // If a live call fails (auth, network, refusal), answer from the mock mind instead of a 5xx.
    liveFallbackToMock: (env.AGORA_LIVE_FALLBACK || '1') !== '0',
    // Codegen tries Opus fast mode first (beta fast-mode-2026-02-01) and falls back to standard on any error. 0 disables.
    fastMode: (env.AGORA_FAST_MODE || '1') !== '0',
    // Whole-request codegen budget (ms), kept under the client's 300 s stream timeout.
    codegenBudgetMs: Number(env.AGORA_CODEGEN_BUDGET_MS || 270000),
    logLevel: env.AGORA_LOG || 'info',
    // ART_DIRECTION §18: the persona minds (Haiku 4.5 per folk) and the director (Fable 5.1).
    // AGORA_MINDS: on (live when a key is set, else mock) | off (the routes answer 'off', the game keeps the rules) | mock (always the mocks)
    minds: ['on', 'off', 'mock'].includes((env.AGORA_MINDS || 'on').trim().toLowerCase()) ? (env.AGORA_MINDS || 'on').trim().toLowerCase() : 'on',
    mindsModels: { persona: env.AGORA_MODEL_PERSONA || 'claude-haiku-4-5', director: env.AGORA_MODEL_DIRECTOR || env.AGORA_MODEL_LOGIC || 'claude-fable-5-1' },
    mindsMaxPerMin: Number(env.AGORA_MINDS_MAX_PER_MIN || 60),          // the server's own cap on persona calls per minute (over it: mock answers, meta.budget)
    directorEveryMs: Number(env.AGORA_DIRECTOR_EVERY_MS || 600000),     // the cadence the client is told to use (health.minds.directorEveryMs); Sueda floated hourly for real sessions
  };
}
