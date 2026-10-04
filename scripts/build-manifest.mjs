#!/usr/bin/env node
// Builds web/js/buildings/prefabs/manifest.js from every prefab's exported `meta`:
//   export const MANIFEST = [{ id, name, aliases, category, stage, footprint, height, desc, water, area, line, file }, ...]
// Each prefab file is imported in Node (they are plain ES modules whose build(api) only runs in the browser); when an
// import fails (a file that touches THREE at module scope, a syntax slip) the `export const meta = {...};` literal is
// parsed out of the source instead, so one broken prefab never hides the rest. The catalogue's fixed ids come first,
// in their ARCHITECTURE order, then everything else alphabetically.
//   node scripts/build-manifest.mjs            writes the manifest and prints a summary
//   node scripts/build-manifest.mjs --check    exits 1 when the manifest on disk is stale (no write)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(ROOT, 'web', 'js', 'buildings', 'prefabs');
const OUT = path.join(DIR, 'manifest.js');
const FIXED = ['house', 'hut', 'well', 'farm', 'windmill', 'bakery', 'granary', 'woodcutter', 'grove', 'quarry',
  'workshop', 'market', 'dock', 'fountain', 'tavern', 'temple', 'tower', 'bridge', 'road', 'garden', 'assembly'];
const CATEGORIES = ['building', 'farm', 'animal', 'nature', 'water', 'landmark', 'prop'];   // display order in the gallery
const STAGES = ['camp', 'hamlet', 'village', 'town', 'civilisation'];

// `export const meta = { ... };` -> the object (balanced braces, then evaluated as a literal: metas are data only)
function parseMetaLiteral(src, file) {
  const m = /export\s+const\s+meta\s*=\s*\{/.exec(src);
  if (!m) throw new Error('no `export const meta = {` in ' + file);
  let i = m.index + m[0].length - 1, depth = 0, inStr = null;
  for (; i < src.length; i++) {
    const c = src[i];
    if (inStr) { if (c === '\\') i++; else if (c === inStr) inStr = null; continue; }
    if (c === '\'' || c === '"' || c === '`') { inStr = c; continue; }
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) break; }
  }
  const literal = src.slice(m.index + m[0].length - 1, i + 1);
  return new Function('return (' + literal + ');')();
}

const titleCase = id => id.split('-').map((w, i) => (i ? w : w[0].toUpperCase() + w.slice(1))).join(' ');
const str = (v, d = '') => (typeof v === 'string' ? v.trim() : d);
const num = (v, d) => (Number.isFinite(+v) && +v > 0 ? +(+v).toFixed(2) : d);

function entryFor(id, meta, file, how) {
  const fp = meta.footprint && typeof meta.footprint === 'object' ? meta.footprint : {};
  const aliases = [...new Set((Array.isArray(meta.aliases) ? meta.aliases : []).map(a => str(a).toLowerCase()).filter(a => a && a !== id))];
  const e = {
    id, name: str(meta.name) || titleCase(id),
    aliases,
    category: CATEGORIES.includes(meta.category) ? meta.category : (meta.category ? String(meta.category) : 'building'),
    stage: STAGES.includes(meta.stage) ? meta.stage : 'camp',
    footprint: { w: num(fp.w, 4), d: num(fp.d, 4) },
    height: num(meta.height, 0),
    desc: str(meta.desc).slice(0, 200),
    water: !!(meta.water || meta.floats || meta.floating),
    area: !!meta.area,
    line: !!meta.line,
    file: 'prefabs/' + file
  };
  if (how === 'parsed') e.parsed = true;
  return e;
}

async function collect() {
  const files = fs.readdirSync(DIR).filter(f => f.endsWith('.js') && f !== 'manifest.js').sort();
  const entries = [], problems = [];
  for (const file of files) {
    const full = path.join(DIR, file), src = fs.readFileSync(full, 'utf8');
    let meta = null, how = 'import', hasBuild = /export\s+function\s+build\b|export\s*\{[^}]*\bbuild\b/.test(src);
    try {
      const mod = await import(pathToFileURL(full).href + '?t=' + Date.now());
      meta = mod.meta; hasBuild = typeof mod.build === 'function';
    } catch (e) {
      try { meta = parseMetaLiteral(src, file); how = 'parsed'; problems.push(`${file}: import failed (${e.message.split('\n')[0]}), meta parsed from source`); }
      catch (e2) { problems.push(`${file}: skipped (${e2.message.split('\n')[0]})`); continue; }
    }
    if (!meta || typeof meta !== 'object') { problems.push(`${file}: skipped (no meta export)`); continue; }
    if (!hasBuild) problems.push(`${file}: no build(api) export`);
    const id = str(meta.id) || file.replace(/\.js$/, '');
    if (id !== file.replace(/\.js$/, '')) problems.push(`${file}: meta.id '${id}' differs from the file name`);
    entries.push(entryFor(id, meta, file, how));
  }
  const seen = new Set();
  const out = entries.filter(e => { if (seen.has(e.id)) { problems.push(`${e.file}: duplicate id ${e.id}`); return false; } seen.add(e.id); return true; });
  out.sort((a, b) => {
    const ia = FIXED.indexOf(a.id), ib = FIXED.indexOf(b.id);
    if (ia >= 0 || ib >= 0) return (ia < 0 ? 1e9 : ia) - (ib < 0 ? 1e9 : ib);
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
  return { entries: out, problems };
}

function render(entries) {
  const lines = entries.map(e => '  ' + JSON.stringify(e).replace(/"([a-zA-Z_]\w*)":/g, '$1: ').replace(/,/g, ', ').replace(/\{/g, '{ ').replace(/\}/g, ' }').replace(/\[ \]/g, '[]'));
  return `// GENERATED by scripts/build-manifest.mjs from every prefabs/<id>.js \`meta\`. Do not edit: re-run the script.
// { id, name, aliases, category, stage, footprint, height, desc, water (floats, placed on the water), area (can fill a
//   marked outline), line (follows a stroke), file }
export const MANIFEST = [
${lines.join(',\n')}
];
export const MANIFEST_IDS = MANIFEST.map(e => e.id);
export const ids = MANIFEST_IDS;   // game.js reads \`ids\` to know what to load
export const byId = Object.fromEntries(MANIFEST.map(e => [e.id, e]));
export const CATEGORY_ORDER = ${JSON.stringify(CATEGORIES)};
`;
}

const { entries, problems } = await collect();
const text = render(entries);
if (process.argv.includes('--check')) {
  const cur = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
  if (cur !== text) { console.error('manifest is stale: run node scripts/build-manifest.mjs'); process.exit(1); }
  console.log(`manifest up to date (${entries.length} prefabs)`); process.exit(0);
}
fs.writeFileSync(OUT, text);
const byCat = {};
for (const e of entries) (byCat[e.category] = byCat[e.category] || []).push(e.id);
console.log(`wrote ${path.relative(ROOT, OUT)}: ${entries.length} prefabs`);
for (const c of Object.keys(byCat).sort()) console.log(`  ${c.padEnd(10)} ${byCat[c].length.toString().padStart(3)}  ${byCat[c].join(' ')}`);
console.log(`  area: ${entries.filter(e => e.area).map(e => e.id).join(' ') || '-'}`);
console.log(`  water: ${entries.filter(e => e.water).map(e => e.id).join(' ') || '-'}`);
console.log(`  line: ${entries.filter(e => e.line).map(e => e.id).join(' ') || '-'}`);
for (const p of problems) console.log('  ! ' + p);
