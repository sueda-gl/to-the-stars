// Globe camera moves: runs dive / rise / neighbours / moon / back in headless Chrome, samples the camera's
// clearance above both planets every animation frame (must never go below 0), and saves a contact sheet of
// frames per move to shots/globe/moves-<name>.png.
//   ~/.nvm/versions/node/v22.22.3/bin/node tests/globe/moves.mjs [edition]
import { spawn, execFileSync } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SHOTS = path.join(ROOT, 'shots/globe'), TMP = path.join(SHOTS, '.frames');
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const edition = process.argv[2] || 'gouache';
mkdirSync(TMP, { recursive: true });
const freePort = () => new Promise(res => { const s = createServer(); s.listen(0, () => { const p = s.address().port; s.close(() => res(p)); }); });
const port = await freePort();
const server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
const base = `http://127.0.0.1:${port}`;
for (let i = 0; i < 50; i++) { try { await fetch(base + '/'); break; } catch { await new Promise(r => setTimeout(r, 100)); } }
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, defaultViewport: { width: 960, height: 600, deviceScaleFactor: 1 },
  args: ['--use-angle=metal', '--hide-scrollbars', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e.stack || e).slice(0, 400)));
await page.goto(`${base}/web/globe-lab.html?edition=${edition}&ui=0`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__globeReady === true, { timeout: 120000 });
await page.evaluate(() => { const g = window.__globe; g.setAutoSpin(false); window.__minClear = { E: 1e9, M: 1e9 };
  (function watch() { const s = g.stats(); window.__minClear.E = Math.min(window.__minClear.E, s.clearE); window.__minClear.M = Math.min(window.__minClear.M, s.clearM); requestAnimationFrame(watch); })(); });
const MOVES = [
  ['dive-home', 'g.dive("home", { ms: 3200 })'],
  ['to-neighbour', 'g.dive("n2", { ms: 3600 })'],
  ['rise', 'g.rise({ ms: 2400 })'],
  ['dive-wonder', 'g.dive("wonder", { ms: 3600 })'],
  ['to-moon', 'g.flyToMoon({ ms: 6000 })'],
  ['back-to-earth', 'g.dive("n1", { ms: 3600 })']
];
const results = {};
for (const [name, call] of MOVES) {
  await page.evaluate(c => { const g = window.__globe; window.__done = false; window.__minClear = { E: 1e9, M: 1e9 }; Promise.resolve(eval(c)).then(() => { window.__done = true; }); }, call);
  const frames = [];
  const t0 = Date.now();
  for (let i = 0; ; i++) {
    const f = path.join(TMP, `${name}-${String(i).padStart(2, '0')}.png`);
    await page.screenshot({ path: f }); frames.push(f);
    if (await page.evaluate(() => window.__done)) break;
    if (Date.now() - t0 > 30000) { errors.push('timeout ' + name); break; }
    await new Promise(r => setTimeout(r, 420));
  }
  const stats = await page.evaluate(() => ({ min: window.__minClear, s: window.__globe.stats() }));
  results[name] = { frames: frames.length, ms: Date.now() - t0, minClearEarth: +stats.min.E.toFixed(2), minClearMoon: +stats.min.M.toFixed(2), end: { mode: stats.s.mode, body: stats.s.body } };
  console.log(name, JSON.stringify(results[name]));
  const pick = frames.length <= 8 ? frames : Array.from({ length: 8 }, (_, k) => frames[Math.round(k * (frames.length - 1) / 7)]);
  execFileSync('python3', ['-c', `
import sys
from PIL import Image
fs = sys.argv[2:]; ims = [Image.open(f).resize((480, 300)) for f in fs]
cols = 4; rows = (len(ims) + cols - 1) // cols
sheet = Image.new('RGB', (cols * 480, rows * 300), (243, 236, 220))
for i, im in enumerate(ims): sheet.paste(im, ((i % cols) * 480, (i // cols) * 300))
sheet.save(sys.argv[1])`, path.join(SHOTS, `moves-${name}.png`), ...pick]);
}
await browser.close(); server.kill();
rmSync(TMP, { recursive: true, force: true });
writeFileSync(path.join(SHOTS, 'moves.json'), JSON.stringify({ edition, results, errors }, null, 2));
const bad = errors.length || Object.values(results).some(r => r.minClearEarth < 0 || r.minClearMoon < 0);
console.log(bad ? 'FAIL' : 'PASS', errors);
process.exit(bad ? 1 : 0);
