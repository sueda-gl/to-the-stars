// cost baseline: the Red arch rebuild's own paint time, same harness as interact.mjs
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const freePort = () => new Promise(res => { const s = createServer(); s.listen(0, () => { const p = s.address().port; s.close(() => res(p)); }); });
const port = await freePort();
const server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
const base = `http://127.0.0.1:${port}`;
for (let i = 0; i < 50; i++) { try { await fetch(base + '/'); break; } catch { await new Promise(r => setTimeout(r, 100)); } }
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, defaultViewport: { width: 1440, height: 900 }, args: ['--use-angle=metal'] });
const page = await browser.newPage();
await page.goto(`${base}/web/reference.html?still=1`, { waitUntil: 'load' });
await new Promise(r => setTimeout(r, 3000));
console.log(await page.evaluate(() => {
  const a = window.__arch; if (!a) return 'no __arch: ' + Object.keys(window).filter(k => k.startsWith('__'));
  const gl = a.renderer.getContext(), px = new Uint8Array(4);
  const out = {}; for (const m of [0, 1]) { a.setMode ? a.setMode(m) : 0; a.renderPainted(); const t0 = performance.now(); for (let i = 0; i < 10; i++) { a.renderPainted(); gl && gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); } out[m] = +((performance.now() - t0) / 10).toFixed(1); }
  return JSON.stringify(out);
}));
await browser.close(); server.kill();
