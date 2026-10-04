// Verbatim audit: every line of the Tower Planet's <style> and main <script> must appear, byte for byte
// (leading indentation aside, an `export ` prefix allowed), in web/js/planet/*.js or web/planet.html.
// The lines that don't must all be on the ALLOWED list (structural seams only, docs/planet.md).
//   ~/.nvm/versions/node/v22.22.3/bin/node tests/planet/verbatim.mjs [-v]
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const orig = readFileSync(path.join(ROOT, 'reference/the-tower-planet-clean.html'), 'utf8').split('\n');
const files = [...readdirSync(path.join(ROOT, 'web/js/planet')).filter(f => f.endsWith('.js')).map(f => 'web/js/planet/' + f), 'web/planet.html'];
const have = new Set(files.map(f => readFileSync(path.join(ROOT, f), 'utf8')).join('\n').split('\n').map(s => s.trim().replace(/^export /, '')));

const ALLOWED = {
  216: 'let renderer -> createContext({ renderer }) parameter (a host may pass its own)',
  218: 'WebGLRenderer(opts) also gets `canvas` when a host passes one',
  334: 'function build() -> export function build(ctx) (reads scene, PALU, toon... from ctx)',
  960: 'setWalking: state in views.js, DOM in ui.js (planet.on("walking"))',
  961: 'toWalk: state in views.js (+ cancels a flight), DOM in ui.js (planet.on("mode"))',
  962: 'toOrbit: state in views.js (+ cancels a flight), DOM in ui.js (planet.on("mode"))',
  963: 'walk button reads planet.mode / planet.walking',
  998: 'setColour: uniform in materials.js (createColours), the picker in ui.js (planet.on("colour"))',
  1010: 'the pickers start from planet.getColours() (= DEFAULT_COLOURS unless a host changed them first)',
  1034: 'const wp, tan, wy -> let (the local / path cameras set wy to their focus height)',
  1056: 'fovT: orbit 40, walk 68 (hers); path eases to localFov; local / free = localFov (new modes)',
  1068: 'wide shadows also while a flight / free camera is above 220 (new modes)',
  1093: 'requestAnimationFrame(frame) -> the loop in planet.js (start / stop / frame)',
  1097: 'build() inside createPlanet(); the page keeps her try / fail',
  1098: 'resize(); started=true -> views.resize(); views.markStarted() in createPlanet',
  1099: 'resize listener added by createPlanet (autoResize)',
  1100: 'first rAF -> planet.start(): prime the clock, frame, onFirstFrame'
};

const sStart = orig.findIndex(l => l.trim() === '<style>'), sEnd = orig.findIndex(l => l.trim() === '</style>');
const js0 = orig.lastIndexOf('<script>'), js1 = orig.lastIndexOf('</script>');
const missing = [], seams = [];
orig.forEach((line, i) => {
  const n = i + 1, t = line.trim();
  const inCode = (i > sStart && i < sEnd) || (i > js0 && i < js1);
  if (!inCode || !t) return;
  if (have.has(t)) return;
  (ALLOWED[n] ? seams : missing).push(`${String(n).padStart(4)}: ${t.slice(0, 150)}${ALLOWED[n] ? '   <- ' + ALLOWED[n] : ''}`);
});
const total = orig.filter((l, i) => ((i > sStart && i < sEnd) || (i > js0 && i < js1)) && l.trim()).length;
console.log(`${total} code lines in the original; ${total - missing.length - seams.length} copied verbatim; ` +
  `${seams.length} changed at a listed seam; ${missing.length} unexplained`);
if (process.argv.includes('-v')) seams.forEach(l => console.log('  seam ' + l));
missing.forEach(l => console.log('  UNEXPLAINED ' + l));
// the markup between </style> and the first <script> is copied whole into planet.html
const page = readFileSync(path.join(ROOT, 'web/planet.html'), 'utf8');
const head = orig.slice(0, orig.indexOf('<script>')).join('\n');
const headOk = page.startsWith(head);
console.log(headOk ? 'markup + CSS (lines 1-86): byte-identical' : 'markup + CSS DIFFER');
process.exit(missing.length || !headOk ? 1 : 0);
