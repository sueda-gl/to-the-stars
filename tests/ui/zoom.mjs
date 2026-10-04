// A close-up of one ui-lab preset at 2x (for checking small type and the portrait cameos).
//   node tests/ui/zoom.mjs <preset> <x> <y> <w> <h> [out.png] [width height]
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const [preset, x, y, w, hgt, out = path.join(ROOT, 'shots/ui/zoom.png'), vw = 1440, vh = 900] = process.argv.slice(2);
const freePort = () => new Promise(res => { const s = createServer(); s.listen(0, () => { const p = s.address().port; s.close(() => res(p)); }); });
const port = await freePort();
const server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: path.join(ROOT, 'web'), stdio: 'ignore' });
const base = `http://127.0.0.1:${port}`;
for (let i = 0; i < 50; i++) { try { await fetch(base + '/'); break; } catch { await new Promise(r => setTimeout(r, 100)); } }
const browser = await puppeteer.launch({ executablePath: process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--hide-scrollbars'] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: +vw, height: +vh, deviceScaleFactor: 2 });
  page.on('pageerror', e => console.log('ERR', String(e)));
  await page.goto(`${base}/ui-lab.html?state=${preset}`, { waitUntil: 'networkidle0' });
  await page.evaluate(() => document.fonts.ready); await new Promise(r => setTimeout(r, 1900));
  await page.screenshot({ path: out, clip: { x: +x, y: +y, width: +w, height: +hgt } });
  console.log('ok', out);
} finally { await browser.close(); server.kill(); }
