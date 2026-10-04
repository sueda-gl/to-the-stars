// Shared harness for the perf measurements (tests/perf/voyage.mjs, tests/perf/game.mjs): Chrome headless=new on the
// real GPU (--use-angle=metal), the probe (probe.js) in every frame, CDP Performance metrics, per-phase stats.
import puppeteer from 'puppeteer-core';
import { readFileSync, mkdirSync } from 'node:fs';

export const ROOT = '/Users/suedagul/agora/';
export const OUT = ROOT + 'shots/perf/';
mkdirSync(OUT, { recursive: true });
export const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
export const sleep = ms => new Promise(r => setTimeout(r, ms));
const PROBE = readFileSync(ROOT + 'tests/perf/probe.js', 'utf8');

export async function open(url, { W = 1440, H = 900, dpr = 1, log = false } = {}) {
  const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new', defaultViewport: { width: W, height: H, deviceScaleFactor: dpr },
    args: ['--use-angle=metal', '--hide-scrollbars', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required', `--window-size=${W},${H}`] });
  const p = await b.newPage();
  p.on('pageerror', e => console.log('PAGEERROR', String(e).slice(0, 300)));
  p.on('console', m => { const t = m.text(); if (m.type() === 'error' && !/404|favicon/.test(t)) console.log('console.error', t.slice(0, 300)); else if (log && /\[act3\]|\[agora\]/.test(t)) console.log('  ', t.slice(0, 200)); });
  await p.evaluateOnNewDocument(PROBE);
  const cdp = await p.target().createCDPSession();
  await cdp.send('Performance.enable');
  await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
  return { b, p, cdp };
}

// name every frame (top + iframes) and snapshot its probe
export async function snapAll(p) {
  const out = {};
  for (const f of p.frames()) {
    let name = 'top';
    try {
      if (f !== p.mainFrame()) { const el = await f.frameElement(); name = el ? await el.evaluate(e => e.id || e.title || 'iframe') : 'iframe'; }
      const s = await f.evaluate(() => window.__perf ? window.__perf.snap() : null);
      if (s) out[name] = s;
    } catch (e) { /* frame gone */ }
  }
  return out;
}
export async function metrics(cdp) {
  const m = (await cdp.send('Performance.getMetrics')).metrics;
  const g = k => { const x = m.find(y => y.name === k); return x ? x.value : 0; };
  return { ts: g('Timestamp'), task: g('TaskDuration'), script: g('ScriptDuration'), layout: g('LayoutDuration'), style: g('RecalcStyleDuration'), heap: g('JSHeapUsedSize'), nodes: g('Nodes'), layoutCount: g('LayoutCount'), styleCount: g('RecalcStyleCount') };
}
const q = (a, k) => { if (!a.length) return 0; const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(k * (s.length - 1)))]; };
export const r1 = v => Math.round(v * 10) / 10;

// measure one phase: snapshot before, run `during` (or wait ms), snapshot after; returns the stats row
export async function measure(p, cdp, name, during, { extra = null } = {}) {
  await snapAll(p); const m0 = await metrics(cdp); const t0 = performance.now();
  const r = typeof during === 'number' ? await sleep(during) : await during();
  const dt = (performance.now() - t0) / 1000;
  const snaps = await snapAll(p); const m1 = await metrics(cdp);
  const top = snaps.top || { frames: [], longTasks: [] }, g = top.frames;
  const row = {
    phase: name, s: r1(dt), fps: r1(g.length / dt), med: r1(q(g, 0.5)), p95: r1(q(g, 0.95)), p99: r1(q(g, 0.99)), max: r1(Math.max(0, ...g)),
    long: top.longTasks.length, longMs: top.longTasks.reduce((a, b) => a + b.d, 0), longMax: Math.max(0, ...top.longTasks.map(x => x.d)),
    cpu: r1((m1.task - m0.task) / dt * 100), script: r1((m1.script - m0.script) / dt * 100), layout: r1((m1.layout - m0.layout) / dt * 100), style: r1((m1.style - m0.style) / dt * 100),
    nodes: m1.nodes, heapMB: Math.round(m1.heap / 1048576),
    ctx: {}, draws: {}, rafs: {}
  };
  for (const [k, s] of Object.entries(snaps)) { row.ctx[k] = s.contexts; row.draws[k] = Math.round(s.draws / dt); row.rafs[k] = Math.round(s.rafCalls / dt); if (s.gpuExt && s.gpuExt !== 'none') row.gpuExt = s.gpuExt; }
  if (extra) Object.assign(row, await extra(r));
  return row;
}
export function table(rows) {
  const fmt = o => Object.entries(o).filter(([, v]) => v).map(([k, v]) => `${k}:${v}`).join(' ');
  const H = ['phase', 's', 'fps', 'med', 'p95', 'p99', 'max', 'long', 'longMax', 'cpu%', 'script%', 'layout%', 'style%', 'draws/s per ctx', 'rAF/s per frame'];
  const L = [H.join(' | '), H.map(() => '---').join(' | ')];
  for (const r of rows) L.push([r.phase, r.s, r.fps, r.med, r.p95, r.p99, r.max, r.long, r.longMax, r.cpu, r.script, r.layout, r.style, fmt(r.draws), fmt(r.rafs)].join(' | '));
  return L.join('\n');
}
