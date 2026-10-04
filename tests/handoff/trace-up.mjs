// trace the lift (stages.showGlobe) after a normal landing; list long main-thread tasks with the JS on top
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new',
  args: ['--use-angle=metal', '--window-size=1440,900', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'], defaultViewport: { width: 1440, height: 900, deviceScaleFactor: 2 } });
const page = await b.newPage();
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ev = (fn, ...a) => page.evaluate(fn, ...a);
await page.goto('http://localhost:8883/?minds=mock&opening=auto', { waitUntil: 'load' });
for (let i = 0; i < 400; i++) { if (await ev(() => !!(window.__agora && document.querySelector('.tt') && !document.querySelector('.tt').hidden)).catch(() => false)) break; await sleep(300); }
await sleep(2500);
await page.click('.tt__begin');
for (let i = 0; i < 400; i++) { if (await ev(() => window.__agora.opening && window.__agora.opening.phase === 'done')) break; await sleep(500); }
await sleep(1500);
const OUT = '/private/tmp/claude-501/-Users-suedagul/f5dd2fe2-22fa-4957-b312-c2b4a64dcefd/scratchpad/trace-up.json';
await page.tracing.start({ path: OUT, categories: ['devtools.timeline', 'disabled-by-default-devtools.timeline', 'v8.execute', 'disabled-by-default-v8.cpu_profiler', 'gpu'] });
await ev(() => { window.__agora.stages.showGlobe(); });
await sleep(6000);
await page.tracing.stop();
await b.close();
const T = JSON.parse(fs.readFileSync(OUT)); const evs = T.traceEvents || T;
const names = {}; for (const e of evs) if (e.name === 'thread_name') names[e.pid + ':' + e.tid] = e.args.name;
let t0 = Infinity; for (const e of evs) if (e.ts > 0 && e.ts < t0) t0 = e.ts;
const long = evs.filter(e => e.ph === 'X' && e.dur > 150000 && e.dur < 5e6);
long.sort((a, b) => a.ts - b.ts);
for (const L of long) {
  console.log('==', ((L.ts - t0) / 1e6).toFixed(2), (L.dur / 1000).toFixed(0) + 'ms', L.name, names[L.pid + ':' + L.tid]);
  const kids = evs.filter(e => e.ph === 'X' && e.pid === L.pid && e.tid === L.tid && e.ts >= L.ts && e.ts + e.dur <= L.ts + L.dur && e.dur > 20000 && e !== L);
  for (const k of kids.slice(0, 25)) console.log('   ', ((k.ts - t0) / 1e6).toFixed(2), (k.dur / 1000).toFixed(0) + 'ms', k.name, JSON.stringify(k.args && k.args.data ? { fn: k.args.data.functionName, url: (k.args.data.url || '').split('/').slice(-2).join('/'), line: k.args.data.lineNumber } : {}).slice(0, 140));
}
