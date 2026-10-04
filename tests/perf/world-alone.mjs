// The ceiling: one verbatim world alone in its own page (what her file costs by itself on this machine).
//   node tests/perf/world-alone.mjs [--url http://localhost:8897] [--dpr 1|2] [--page worlds/lounge.html|worlds/plisse.html|planet.html]
import { open, measure, table, sleep } from './lib.mjs';
const arg = (k, d = null) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const BASE = arg('--url', 'http://localhost:8897'), DPR = +(arg('--dpr', '1')), PAGE = arg('--page', 'worlds/lounge.html');
const { b, p, cdp } = await open(`${BASE}/${PAGE}`, { dpr: DPR });
await sleep(4000);
const rows = [await measure(p, cdp, `${PAGE} alone dpr${DPR}`, 5000)];
const gl = await p.evaluate(() => { const c = document.querySelector('canvas'); const g = c && (c.getContext('webgl2') || c.getContext('webgl')); const d = g && g.getExtension('WEBGL_debug_renderer_info'); return d ? g.getParameter(d.UNMASKED_RENDERER_WEBGL) : 'n/a'; });
console.log(table(rows)); console.log('renderer:', gl);
await b.close();
