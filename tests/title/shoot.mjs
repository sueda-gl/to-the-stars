// Title lab screenshots (docs/title.md). Own static server (never :8870).
//   node tests/title/shoot.mjs [all|sheet|one name font [tone]] [--w=1440 --h=900]
// -> shots/title/: <name>-<font>.png per combination, sheet.png (the in-page contact sheet), contact-<font>.png
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = path.join(ROOT, 'shots/title'); mkdirSync(OUT, { recursive: true });
const args = process.argv.slice(2), opt = k => (args.find(a => a.startsWith(`--${k}=`)) || '').split('=')[1];
const W = +(opt('w') || 1440), H = +(opt('h') || 900), mode = args.find(a => !a.startsWith('--')) || 'all';
const pos = args.filter(a => !a.startsWith('--'));
const freePort = () => new Promise(res => { const s = createServer(); s.listen(0, () => { const p = s.address().port; s.close(() => res(p)); }); });
const port = await freePort();
const server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: path.join(ROOT, 'web'), stdio: 'ignore' });
const base = `http://127.0.0.1:${port}`;
for (let i = 0; i < 50; i++) { try { await fetch(base + '/'); break; } catch { await new Promise(r => setTimeout(r, 100)); } }
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true,
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--hide-scrollbars', '--autoplay-policy=no-user-gesture-required'] });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const page = await browser.newPage(); await page.setViewport({ width: W, height: H });
const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
const sfx = W < 800 ? '-mobile' : '';
// python's server sometimes resets a module request under load: reload until the lab is up
async function open(url) {
  for (let i = 0; i < 4; i++) {
    await page.goto(url, { waitUntil: 'load' });
    try { await page.waitForFunction(() => window.__planet && window.__titleLab, { timeout: 15000 }); return; } catch (e) { if (i === 3) throw e; }
  }
}
try {
  if (mode === 'one') {
    const [, n, f, tone] = pos;
    await open(`${base}/title-lab.html?shot&name=${n}&font=${f}${tone ? '&tone=' + tone : ''}&nospin`); await sleep(4200);
    await page.screenshot({ path: path.join(OUT, `${n}-${f}${tone ? '-' + tone : ''}${sfx}.png`) });
  } else {
    await open(`${base}/title-lab.html?shot&nospin`); await sleep(3500);
    if (mode === 'all') {
      const names = await page.evaluate(() => [...document.querySelectorAll('#names [data-name]')].map(b => b.dataset.name));
      const fonts = await page.evaluate(() => [...document.querySelectorAll('#fonts [data-font]')].map(b => b.dataset.font));
      for (const f of fonts) for (const n of names) {
        await page.evaluate((n, f) => { window.__titleLab.set({ name: n, font: f }); document.querySelectorAll('.tt.is-main > *').forEach(e => { e.style.animation = 'none'; }); }, n, f);
        await sleep(350);
        await page.screenshot({ path: path.join(OUT, `${n}-${f}${sfx}.png`) });
      }
    }
    await page.evaluate(() => window.__titleLab.toggleGrid(true)); await sleep(1500);
    await page.screenshot({ path: path.join(OUT, `sheet${sfx}.png`), fullPage: false });
    const el = await page.$('#sheet table'); if (el) await el.screenshot({ path: path.join(OUT, `sheet-full${sfx}.png`) });
  }
} finally {
  console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'no page errors');
  await browser.close(); server.kill();
}
