// POST /api/look {look:{painter, world, globe, trailer}} -> writes web/assets/look.json (the Gouache lab's "Save as default";
// trailer: the trailer pages' own Gouache settings, flat keys like t6_brush, written by their look lab).
// GET /api/look -> the saved look (404 when there is none). The game and the labs load it at boot.
// Plain JSON only: numbers, booleans, short strings (hex colours), and short arrays of those. Unknown keys are kept
// (the look contract grows), but everything is size-limited. AGORA_LOOK_FILE overrides the path (tests).
import fs from 'node:fs';
import path from 'node:path';
import { WEB_DIR } from './config.js';

export const LOOK_FILE = () => process.env.AGORA_LOOK_FILE || path.join(WEB_DIR, 'assets', 'look.json');
const MAX_BYTES = 32 * 1024, MAX_KEYS = 96, MAX_ARR = 24, MAX_STR = 64;
const KEY = /^[A-Za-z][A-Za-z0-9_]{0,40}$/;

function cleanValue(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
  if (typeof v === 'boolean' || v === null) return v;
  if (typeof v === 'string') return v.length <= MAX_STR ? v : undefined;
  if (Array.isArray(v)) {
    if (v.length > MAX_ARR) return undefined;
    const out = v.map(x => (typeof x === 'number' && Number.isFinite(x)) || (typeof x === 'string' && x.length <= MAX_STR) ? x : undefined);
    return out.includes(undefined) ? undefined : out;
  }
  return undefined;
}
function cleanSection(o, name) {
  if (o == null) return undefined;
  if (typeof o !== 'object' || Array.isArray(o)) throw new Error(`look.${name} must be an object`);
  const keys = Object.keys(o);
  if (keys.length > MAX_KEYS) throw new Error(`look.${name} has too many keys`);
  const out = {};
  for (const k of keys) {
    if (!KEY.test(k)) throw new Error(`look.${name}: bad key ${JSON.stringify(k).slice(0, 50)}`);
    const v = cleanValue(o[k]);
    if (v === undefined) throw new Error(`look.${name}.${k}: unsupported value`);
    out[k] = v;
  }
  return out;
}

export function validateLook(body) {
  const look = body && typeof body === 'object' && !Array.isArray(body) ? (body.look ?? body) : null;
  if (!look || typeof look !== 'object' || Array.isArray(look)) throw new Error('expected {look:{painter, world, globe}}');
  const out = { version: 1, savedAt: new Date().toISOString() };
  for (const s of ['painter', 'world', 'globe', 'trailer']) { const c = cleanSection(look[s], s); if (c) out[s] = c; }
  for (const [k, v] of Object.entries(out.painter || {})) if (typeof v !== 'number' && typeof v !== 'boolean') throw new Error(`look.painter.${k} must be a number or a boolean`);
  if (!out.painter && !out.world && !out.globe && !out.trailer) throw new Error('look has no painter / world / globe / trailer section');
  const text = JSON.stringify(out, null, 2);
  if (text.length > MAX_BYTES) throw new Error('look too large');
  return { look: out, text };
}

export function saveLook(body) {
  const { look, text } = validateLook(body);
  const file = LOOK_FILE();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = file + '.tmp-' + process.pid;
  fs.writeFileSync(tmp, text + '\n');
  fs.renameSync(tmp, file);
  return { ok: true, file: path.relative(path.resolve(WEB_DIR, '..'), file), look };
}

export function readLook() {
  try { return JSON.parse(fs.readFileSync(LOOK_FILE(), 'utf8')); } catch { return null; }
}
