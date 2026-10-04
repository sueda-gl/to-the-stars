// Verbatim audit: every line of the original's <style> and <script> must appear, byte for byte
// (leading indentation aside), somewhere in web/js/paint/*.js, web/css/paint.css or web/reference.html.
// Prints the lines that don't, which must all be on the ALLOWED list below (structural seams only).
//   ~/.nvm/versions/node/v22.22.3/bin/node tests/fidelity/verbatim.mjs
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const orig = readFileSync(path.join(ROOT, 'reference/red-arch-at-sundown.html'), 'utf8').split('\n');
const mods = [...readdirSync(path.join(ROOT, 'web/js/paint')).map(f => 'web/js/paint/' + f), 'web/css/paint.css', 'web/reference.html']
  .map(f => readFileSync(path.join(ROOT, f), 'utf8')).join('\n').split('\n').map(s => s.trim());
const have = new Set(mods.map(s => s.replace(/^export /, '')));

// original line numbers that are allowed to differ, and why
const ALLOWED = {
  82: 'rnd = mulberry32(seed) in createContext',
  95: 'lineOnly lives on ctx', 96: 'colourOnly lives on ctx', 250: 'pool also pushed to ctx.folkHidden / ctx.reflectors',
  1921: 'the resize listener is added by the page (reference.html)',
  219: 'stoneTex made lazily by kit.getStoneTex() (same moment: just before the first slab)',
  221: 'slab reads the kit\'s cached stone texture',
  223: 'slab returns its mesh',
  267: 'proxyMat made on first proxy() (same moment as the reference: after the wall)',
  268: 'proxy returns its mesh',
  384: 'leafGeo built once inside finishLeaves()', 385: 'finishLeaves() wrapper', 389: 'finishLeaves() wrapper',
  563: 'people.forEach(OBST.push) dropped: the reference has no people',
  698: 'closeUp lives in ctx.flags.closeUp',
  699: 'pickTarget -> nav.pickTarget (default = this code)', 700: 'closeUp -> ctx.flags.closeUp', 701: 'CLOSE_FOCUS -> nav.closeFocus',
  706: 'nav.pickTarget assignment closes with };',
  754: 'spawn spot from nav.spots (default SPOTS)', 860: 'nav.spots', 902: 'nav.spots', 953: 'nav.spots', 1031: 'nav.spots',
  764: 'population made by the caller (reference.html)', 868: 'caller', 909: 'caller', 960: 'caller', 998: 'caller', 1038: 'caller', 1081: 'caller',
  1085: 'floatie retarget -> nav.floatTarget (+ a.controlled)', 1086: 'nav.floatTarget', 1087: 'nav.floatTarget', 1088: 'nav.floatTarget', 1089: 'nav.floatTarget',
  1096: 'floatie wall avoidance -> nav.flyPush',
  1145: 'pickTarget -> nav.pickTarget unless a.controlled', 1149: 'closeUp -> flags.closeUp', 1153: 'nav.onArrive',
  1161: 'OBST -> nav.obstacles', 1162: 'pool/arch push -> nav.extraPush', 1163: 'nav.extraPush', 1172: 'clamp -> nav.bounds',
  1201: 'flitTarget -> nav.flyTarget', 1207: 'nav.flyTarget assignment closes with };',
  1211: 'nav.flyTarget (+ a.controlled)', 1217: 'flit wall avoidance -> nav.flyPush',
  1252: 'nav.pickTarget', 1255: 'flags.closeUp', 1259: 'nav.onArrive', 1268: 'nav.obstacles', 1269: 'nav.extraPush', 1270: 'nav.extraPush', 1281: 'nav.bounds',
  1308: 'nav.pickTarget', 1311: 'flags.closeUp', 1315: 'nav.onArrive', 1325: 'nav.obstacles', 1326: 'nav.extraPush', 1327: 'nav.extraPush', 1338: 'nav.bounds',
  1373: 'nav.pickTarget', 1377: 'nav.onArrive', 1384: 'flags.closeUp', 1402: 'nav.obstacles', 1403: 'nav.extraPush (loaf)', 1409: 'nav.bounds',
  1463: 'nav.pickTarget', 1470: 'flags.closeUp', 1472: 'else if (c.path.length): a held agent with no path stands', 1476: 'nav.onArrive',
  1490: 'nav.obstacles', 1494: 'nav.extraPush', 1495: 'nav.extraPush', 1510: 'nav.bounds',
  1613: 'initial settle called by the caller', 1904: 'all ctx.reflectors resized',
  1909: 'resize(w, h)', 1910: 'resize(w, h) + optional framing hook',
  1926: 'closeUp -> flags.closeUp', 1930: 'flags.closeUp', 1937: 'flags.closeUp',
  1941: 'Up close button found under the UI root', 1943: 'setCloseUp split: folk (flag + rnd) / painter (dirty) / ui (DOM)',
  1944: 'button state guarded when the Up close button is not mounted', 1946: 'folk.setCloseUp (adds: skip a.controlled)', 1948: 'click handler guarded',
  1951: 'edition buttons found under the UI root', 1986: 'hash handling optional (hash: true)', 1987: 'applyG after the hash',
  1988: 'setMode split: painter state / ui DOM (subscribe)', 1989: 'painter.setMode', 1995: 'buttons -> ui setMode',
  1996: 'keyboard: flags.closeUp, painter.mode', 1919: 'resize sets dirty (unchanged; line moved inside framing branch)',
  2031: 'ctx.folkHidden', 2041: 'ctx.folkHidden',
  2058: 'hash -> mountPaintUI', 2059: 'hash close -> mountPaintUI + rig.closeT', 2060: 'painter.resize()',
  2064: '__arch built in reference.html', 2065: 'frame split: reference.html / rig.update / painter.frame',
  2066: 'reference.html', 2067: 'reference.html', 2069: 'painter.frame', 2070: 'reference.html', 2071: 'rig.update', 2074: 'rig.update',
  2078: 'painter.frame', 2079: 'rig.place', 2080: 'rig.place (camZ via painter.camZ)', 2082: 'rig.place (closeFocus)', 2084: 'rig.place (closeFocus)',
  2085: 'backdrop.update + arch.update', 2097: 'painter.frame', 2099: 'reference.html', 2100: 'reference.html', 2101: 'reference.html', 2102: 'reference.html', 2103: 'IIFE'
};

const start = orig.findIndex(l => l.trim() === '<style>'), sEnd = orig.findIndex(l => l.trim() === '</style>');
const js0 = orig.findIndex(l => l.trim() === '<script>'), js1 = orig.lastIndexOf('</script>');
const missing = [], allowedHit = [], lazy = [];
orig.forEach((line, i) => {
  const n = i + 1, t = line.trim();
  const inCode = (i > start && i < sEnd) || (i > js0 && i < js1);
  if (!inCode || !t || t === '(() => {' || t === '})();') return;
  if (have.has(t)) return;
  if (t.startsWith('const ') && have.has(t.slice(6))) { lazy.push(n); return; }   // `const X = ...` -> `X = ...` in a lazy species init
  (ALLOWED[n] ? allowedHit : missing).push(`${String(n).padStart(4)}: ${t.slice(0, 140)}`);
});
const total = orig.filter((l, i) => ((i > start && i < sEnd) || (i > js0 && i < js1)) && l.trim()).length;
console.log(`${total} code lines in the original; ${total - missing.length - allowedHit.length - lazy.length} copied verbatim; ` +
  `${lazy.length} verbatim but for a dropped \`const\` (lazy per-species init); ${allowedHit.length} changed at a listed seam; ${missing.length} unexplained`);
if (process.argv.includes('-v')) allowedHit.forEach(l => console.log('  seam ' + l));
missing.forEach(l => console.log('  UNEXPLAINED ' + l));
process.exit(missing.length ? 1 : 0);
