// Quick look harness (2026-10-04 globe pass): stepped, deterministic stills + contact sheets from globe-lab.
//   node tests/globe/look.mjs <outdir> '<json list of [name, setupJs, moveJs|null, frames, ms]>'
// setupJs runs with g = the globe (loop stopped, auto spin off); moveJs starts a move; frames > 1 writes a sheet.
import { spawn, execFileSync } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = path.resolve(process.argv[2] || path.join(ROOT, 'shots/globe/look')), TMP = path.join(OUT, '.frames');
const CASES = JSON.parse(process.argv[3] || '[]');
const W = +(process.env.W || 1440), H = +(process.env.H || 900);
mkdirSync(TMP, { recursive: true });
const freePort = () => new Promise(res => { const s = createServer(); s.listen(0, () => { const p = s.address().port; s.close(() => res(p)); }); });
const port = await freePort();
const server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
const base = `http://127.0.0.1:${port}`;
for (let i = 0; i < 50; i++) { try { await fetch(base + '/'); break; } catch { await new Promise(r => setTimeout(r, 100)); } }
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, protocolTimeout: 600000,
  defaultViewport: { width: W, height: H, deviceScaleFactor: 1 }, args: ['--use-angle=metal', '--hide-scrollbars', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e.stack || e).slice(0, 500)));
page.on('console', m => { if (m.type() === 'error' && !/favicon|404/.test(m.text())) errors.push('console: ' + m.text().slice(0, 300)); });
await page.goto(`${base}/web/globe-lab.html?ui=0`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__globeReady === true || window.__globeError, { timeout: 120000 });
await page.evaluate(() => {
  const g = window.__globe; g.stop(); g.setAutoSpin(false);
  window.__run = code => { const g = window.__globe; const rec = window.__mv = { done: false, result: null }; Promise.resolve(eval(code)).then(v => { rec.done = true; rec.result = v; }); };
  window.__step = async n => { const g = window.__globe; for (let i = 0; i < n; i++) { g.tick(1 / 60); await null; await null; await null; } };
});
const ev = (f, ...a) => page.evaluate(f, ...a);
const shot = async f => { await page.screenshot({ path: f }); return f; };
for (const [name, setup, move, frames = 1, ms = 3300] of CASES) {
  if (name[0] === '?') { console.log(name, JSON.stringify(await ev(c => { const g = window.__globe; return eval(c); }, setup))); continue; }
  await ev(c => { const g = window.__globe; eval(c); for (let i = 0; i < 4; i++) g.tick(1 / 60); }, setup || '');
  if (!move) { await ev(() => { const g = window.__globe; for (let i = 0; i < 60; i++) g.tick(1 / 60); g.markDirty(); g.tick(0); }); await shot(path.join(OUT, name + '.png')); console.log('shot', name); continue; }
  await ev(c => window.__run(c), move);
  const total = Math.ceil(ms / (1000 / 60)), files = [];
  for (let k = 1; k <= frames; k++) {
    const n = Math.round(total * k / frames) - Math.round(total * (k - 1) / frames);
    await ev(n => window.__step(n), n);
    files.push(await shot(path.join(frames > 1 ? TMP : OUT, frames > 1 ? `${name}-${k}.png` : name + '.png')));
  }
  for (let i = 0; i < 40 && !(await ev(() => window.__mv.done)); i++) await ev(() => window.__step(30));
  await ev(() => { const g = window.__globe; for (let i = 0; i < 30; i++) g.tick(1 / 60); g.markDirty(); g.tick(0); });
  await shot(path.join(OUT, name + '-end.png'));
  console.log('move', name, JSON.stringify(await ev(() => ({ r: window.__mv.result, mode: window.__globe.mode, body: window.__globe.body, place: window.__globe.lastPlace }))));
  if (frames > 1) execFileSync('python3', ['-c', `
import sys
from PIL import Image
fs = sys.argv[2:]; ims = [Image.open(f).resize((480, 300)) for f in fs]
cols = 4; rows = (len(ims) + cols - 1) // cols
sheet = Image.new('RGB', (cols * 480, rows * 300), (243, 236, 220))
for i, im in enumerate(ims): sheet.paste(im, ((i % cols) * 480, (i // cols) * 300))
sheet.save(sys.argv[1])`, path.join(OUT, `sheet-${name}.png`), ...files]);
}
await browser.close(); server.kill();
rmSync(TMP, { recursive: true, force: true });
console.log(errors.length ? 'ERRORS ' + JSON.stringify(errors) : 'no page errors');
