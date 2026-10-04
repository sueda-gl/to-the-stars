// Generated-asset cache: server/data/assets/<id>.json, one file per learned building.
import fs from 'node:fs';
import path from 'node:path';
import { ASSETS_DIR } from './config.js';
import { harden } from './codegen/validate.js';

const SAFE_ID = /^[a-z0-9][a-z0-9-]{0,63}$/;

// "another lighthouse on the cliff, please" -> "lighthouse". The noun a request is about, so the archive answers
// only for the same thing ("a clock tower" is not the cached "tower") and "another one" still hits.
const LOCATION_TAIL = /\b(on|at|by|near|next to|beside|in|into|along|there|here|over there|where|facing|towards|toward|behind|opposite|across|up|down)\b.*$/;
const LEAD_WORDS = /^(?:(?:please|now|also|and|then|build|make|put|place|raise|erect|add|create|give us|let'?s have|we need|i want|one more|another|a second|a new|a|an|the|some|two|three|four|five|six|yet another|more|bir|iki|uc|dort|bes|alti|yeni|baska|bir tane daha)\s+)+/;
export function requestNoun(text = '') {
  let t = String(text).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9' -]+/g, ' ').replace(/\s+/g, ' ').trim();
  t = t.replace(LOCATION_TAIL, '').trim();
  t = t.replace(LEAD_WORDS, '').replace(/\s*\b(please|now|right away|quickly|asap|too|as well)\b\s*$/, '').trim();
  return t.replace(/(?<![su])s$/, ''); // crude plural: houses -> house, but glass / bus stay
}
const sameNoun = (a, b) => { const x = requestNoun(a), y = requestNoun(b); return Boolean(x) && x.length > 2 && x === y; };

// Records written before audit round 1: no strict prologue, and stock (mock) assets carried the stock plan's
// generic synonyms ("tower", "keep"...) whatever they were named. Harden on the way out and keep only the
// aliases that ARE the thing (new records carry aliasesVersion 2 and are left alone).
const ALIASES_VERSION = 2;
const strict = (a) => {
  if (!a || typeof a !== 'object') return a;
  const out = { ...a, code: typeof a.code === 'string' ? harden(a.code) : a.code };
  if (a.stock && (a.aliasesVersion || 0) < ALIASES_VERSION) out.aliases = (a.aliases || []).filter(al => sameNoun(al, a.name) || sameNoun(al, a.request || ''));
  return out;
};

export function createAssetStore(dir = ASSETS_DIR) {
  fs.mkdirSync(dir, { recursive: true });
  const file = (id) => path.join(dir, `${id}.json`);
  return {
    dir,
    list() {
      const out = [];
      for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort()) {
        try { out.push(strict(JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')))); } catch { /* skip corrupt */ }
      }
      return out;
    },
    get(id) {
      if (!SAFE_ID.test(id)) return null;
      try { return strict(JSON.parse(fs.readFileSync(file(id), 'utf8'))); } catch { return null; }
    },
    // Every stored asset's code starts with 'use strict' so the browser's new Function wrapper runs it strict.
    put(asset) {
      if (!asset || !SAFE_ID.test(asset.id || '')) throw new Error('asset needs a safe id');
      const record = { ...asset, code: harden(asset.code), generated: true, aliasesVersion: ALIASES_VERSION, savedAt: new Date().toISOString() };
      fs.writeFileSync(file(asset.id), JSON.stringify(record, null, 2));
      return record;
    },
    // Find a learned asset whose name or alias IS the thing requested, so a repeated request is instant.
    find(text = '') {
      const noun = requestNoun(text);
      if (!noun) return null;
      for (const a of this.list()) {
        const names = [a.name, ...(a.aliases || [])].filter(Boolean);
        if (names.some(n => sameNoun(n, noun))) return a;
      }
      return null;
    },
  };
}
