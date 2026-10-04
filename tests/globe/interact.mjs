// Globe interaction + cost: drag spins and wheel zooms in orbit (not during scripted moves), and the
// average paint time per edition (forced repaints, finished with a pixel read).
//   ~/.nvm/versions/node/v22.22.3/bin/node tests/globe/interact.mjs
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const freePort = () => new Promise(res => { const s = createServer(); s.listen(0, () => { const p = s.address().port; s.close(() => res(p)); }); });
const port = await freePort();
const server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
const base = `http://127.0.0.1:${port}`;
for (let i = 0; i < 50; i++) { try { await fetch(base + '/'); break; } catch { await new Promise(r => setTimeout(r, 100)); } }
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, defaultViewport: { width: 1440, height: 900 }, args: ['--use-angle=metal', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
const page = await browser.newPage();
const errors = []; page.on('pageerror', e => errors.push(String(e)));
await page.goto(`${base}/web/globe-lab.html?ui=0`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__globeReady === true, { timeout: 120000 });
const eye = () => page.evaluate(() => window.__globe.stats().eye);
await page.evaluate(() => window.__globe.setAutoSpin(false));
await new Promise(r => setTimeout(r, 400));
const e0 = await eye();
await page.mouse.move(700, 450); await page.mouse.down(); for (let i = 1; i <= 10; i++) await page.mouse.move(700 + i * 20, 450 + i * 4); await page.mouse.up();
await new Promise(r => setTimeout(r, 900));
const e1 = await eye();
const d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const spun = d(e0, e1);
const r0 = Math.hypot(...e1);
await page.mouse.wheel({ deltaY: 400 }); await new Promise(r => setTimeout(r, 900));
const r1 = Math.hypot(...await eye());
// a drag during a scripted move must not steer it
await page.evaluate(() => { window.__d = window.__globe.dive('home', { ms: 2500 }); });
await new Promise(r => setTimeout(r, 300));
await page.mouse.move(700, 450); await page.mouse.down(); for (let i = 1; i <= 10; i++) await page.mouse.move(700 - i * 30, 450); await page.mouse.up();
await page.evaluate(() => window.__d);
const endEye = await eye();
const want = await page.evaluate(() => { const g = window.__globe, v = g.diveView('home'); return g.toWorld(v.eye.x, v.eye.y, v.eye.z).toArray(); });
const cost = await page.evaluate(() => {
  const g = window.__globe, gl = g.renderer.getContext(), px = new Uint8Array(4), out = {};
  g.stop(); g.snapTo();
  for (const [name, m] of [['riso', 0], ['gouache', 1], ['raw', 2]]) {
    g.painter.setMode(m); g.render(); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    const t0 = performance.now(); for (let i = 0; i < 10; i++) { g.render(); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); }
    out[name] = +((performance.now() - t0) / 10).toFixed(1);
  }
  const tri = g.earth.geo.index.count / 3;
  return { msPerPaint: out, earthTriangles: tri, buildMs: window.__buildMs };
});
console.log(JSON.stringify({ spun: +spun.toFixed(1), zoom: [+r0.toFixed(0), +r1.toFixed(0)], diveEndError: +d(endEye, want).toFixed(3), cost, errors }));
await browser.close(); server.kill();
process.exit(errors.length || spun < 5 || !(r1 > r0) || d(endEye, want) > 0.05 ? 1 : 0);
