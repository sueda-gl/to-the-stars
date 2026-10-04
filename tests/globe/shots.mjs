// Globe stills: serves the repo, opens web/globe-lab.html?view=...&edition=... in headless Chrome (1440x900,
// Metal ANGLE), waits for window.__globeReady, screenshots into shots/globe/. Fails on any page error / 4xx.
//   ~/.nvm/versions/node/v22.22.3/bin/node tests/globe/shots.mjs [view:edition ...]
//   default: orbit, home, nation0..2, wonder, moon, growth in gouache + orbit/home in riso and raw
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SHOTS = process.env.OUT ? path.resolve(process.env.OUT) : path.join(ROOT, 'shots/globe');
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const W = +(process.env.W || 1440), H = +(process.env.H || 900);
mkdirSync(SHOTS, { recursive: true });

const freePort = () => new Promise(res => { const s = createServer(); s.listen(0, () => { const p = s.address().port; s.close(() => res(p)); }); });
const port = await freePort();
const server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
const base = `http://127.0.0.1:${port}`;
for (let i = 0; i < 50; i++) { try { await fetch(base + '/'); break; } catch { await new Promise(r => setTimeout(r, 100)); } }

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: true, defaultViewport: { width: W, height: H, deviceScaleFactor: 1 },
  args: ['--use-angle=metal', `--window-size=${W},${H}`, '--hide-scrollbars', '--disable-background-timer-throttling', '--disable-renderer-backgrounding']
});
const args = process.argv.slice(2);
const cases = args.length ? args.map(a => a.split(':')) : [
  ['orbit', 'gouache'], ['home', 'gouache'], ['nation0', 'gouache'], ['nation1', 'gouache'], ['nation2', 'gouache'],
  ['wonder', 'gouache'], ['moon', 'gouache'], ['growth', 'gouache'], ['far', 'gouache'], ['moonorbit', 'gouache'],
  ['orbit', 'riso'], ['home', 'riso'], ['orbit', 'raw']
];
const results = {};
let ok = true;
try {
  for (const [view, ed, extra] of cases) {
    const page = await browser.newPage();
    const errors = [], logs = [];
    page.on('pageerror', e => errors.push(String(e.stack || e).slice(0, 600)));
    page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.text()); });
    page.on('response', r => { if (r.status() >= 400 && !r.url().endsWith('/favicon.ico')) errors.push(`${r.status()} ${r.url()}`); });
    const url = `${base}/web/globe-lab.html?view=${view}&edition=${ed || 'gouache'}${extra ? '&' + extra : ''}`;
    const t0 = Date.now();
    await page.goto(url, { waitUntil: 'load', timeout: 120000 });
    try { await page.waitForFunction(() => window.__globeReady === true || window.__globeError, { timeout: 120000 }); }
    catch (e) { console.log('TIMEOUT', view, ed, errors, logs); ok = false; await page.close(); continue; }
    await page.evaluate(() => document.fonts.ready);
    await new Promise(r => setTimeout(r, 600));
    const name = `${view}-${ed || 'gouache'}${extra ? '-' + extra.replace(/[^a-z0-9]+/gi, '') : ''}.png`;
    await page.screenshot({ path: path.join(SHOTS, name) });
    const info = await page.evaluate(() => ({ buildMs: window.__buildMs, mode: window.__globe && window.__globe.mode, calls: window.__globe && window.__globe.renderer.info.render.calls }));
    results[name] = { ms: Date.now() - t0, errors, logs: logs.slice(0, 5), ...info };
    if (errors.length) ok = false;
    console.log(name, JSON.stringify(results[name]));
    await page.close();
  }
} finally {
  await browser.close(); server.kill();
}
writeFileSync(path.join(SHOTS, 'results.json'), JSON.stringify(results, null, 2));
process.exit(ok ? 0 : 1);
