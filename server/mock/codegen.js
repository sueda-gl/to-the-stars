// Mock codegen: a small library of hand-written stock assets (server/mock/assets/*.js), written against the
// Build API vocabulary of web/js/buildings/BUILD_API.md (ARCHITECTURE §5), plus a generic fallback whose code
// is generated from the massing sketch. The status timeline spreads over AGORA_MOCK_CODEGEN_MS so the
// "plans are being drawn" moment exists offline too.
import { requestNoun } from '../assets.js';
import { mockSketch, pickFamily } from './sketch.js';
import { guessCategory } from '../schemas.js';
import lighthouse from './assets/lighthouse.js';
import duck from './assets/rubber-duck.js';
import dragon from './assets/dragon-statue.js';
import rocket from './assets/rocket.js';
import boat from './assets/boat.js';
import statue from './assets/statue.js';
import tree from './assets/giant-tree.js';
import tower from './assets/tower.js';
import windclock from './assets/wind-clock.js';
import generic, { codeFromSketch } from './assets/generic.js';

// Keyed by family id (mock/sketch.js FAMILIES) so the sketch and the stock plan always agree.
export const STOCK = { lighthouse, duck, dragon, rocket, boat, statue, tree, tower, windclock, generic };
export { codeFromSketch };

export function pickStock(request = '', kindHint = '') { return pickFamily(request, kindHint); }

const slug = (s) => String(s).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32) || 'asset';
const hash = (s) => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36).slice(0, 5); };

export function assetId(name, request = '') { return `gen-${slug(name)}-${hash(request + name)}`; }

// The mock asset for a request: the family's stock plan (or code raised from the sketch), named after the
// request's own noun, with aliases that ARE the thing (so "an observatory" served by the tower never makes a later
// "tower" a cache hit).
export function mockAsset({ request = '', kindHint = '', sketch = null }) {
  const key = pickStock(request, kindHint);
  const s = STOCK[key];
  const noun = requestNoun(request) || requestNoun(kindHint);
  const name = noun ? noun.replace(/\b\p{L}/gu, c => c.toUpperCase()) : s.name;
  const asked = noun;
  const isStock = key !== 'generic' && [key, s.name, ...s.aliases].some(a => requestNoun(a) === asked);
  const aliases = Array.from(new Set([name.toLowerCase(), ...(isStock ? [key, ...s.aliases] : [])]));
  const sk = key === 'generic' ? (sketch || mockSketch({ request, kindHint })) : null;
  const code = key === 'generic' ? codeFromSketch(sk) : s.code;
  const meta = { ...s.meta, category: s.meta.category || guessCategory(`${name} ${request}`) };
  if (sk) meta.footprint = { w: Math.max(1, Math.round(sk.footprint.w)), d: Math.max(1, Math.round(sk.footprint.d)) };
  return { id: assetId(name, request), name, aliases, meta, code, generated: true, stock: key, request };
}

// Status timeline for the SSE stream; total is spread so the folk visibly work for a while.
export function mockTimeline(totalMs) {
  const t = Math.max(100, totalMs);
  return [
    { at: 0, stage: 'drafting', note: 'The Ministry of Builds unrolls fresh paper.' },
    { at: t * 0.25, stage: 'writing', note: 'Plans are inked, part by part.' },
    { at: t * 0.8, stage: 'checking', note: 'Measuring twice.' },
  ];
}
