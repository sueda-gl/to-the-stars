// The guide / hint line restyle (§21): shots of the onboarding guide line and the idle "try saying" hint over the
// ui-lab backdrops (bright Red-arch sand, the relief map, folk close), desktop + phone. -> shots/title/hint-*.png
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = path.join(ROOT, 'shots/title'); mkdirSync(OUT, { recursive: true });
const freePort = () => new Promise(res => { const s = createServer(); s.listen(0, () => { const p = s.address().port; s.close(() => res(p)); }); });
const port = await freePort();
const server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: path.join(ROOT, 'web'), stdio: 'ignore' });
const base = `http://127.0.0.1:${port}`;
for (let i = 0; i < 50; i++) { try { await fetch(base + '/'); break; } catch { await new Promise(r => setTimeout(r, 100)); } }
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--hide-scrollbars'] });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const GUIDE = 'One more thing: rest your cursor on the land and&nbsp;say <i>“a windmill there”</i>.';
try {
  for (const [w, h, sfx] of [[1440, 900, ''], [390, 844, '-mobile']]) for (const bg of ['arch', 'map', 'folk']) {
    const page = await browser.newPage(); await page.setViewport({ width: w, height: h });
    await page.goto(`${base}/ui-lab.html?state=rest&bg=${bg}&font=G`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.ui && window.ui.hint, { timeout: 20000 }); await page.evaluate(() => document.fonts.ready); await sleep(600);
    await page.evaluate(g => window.ui.hint.show(g, { html: true, ttl: 0, guide: true }), GUIDE); await sleep(1000);
    await page.screenshot({ path: path.join(OUT, `hint-guide-${bg}${sfx}.png`) });
    await page.evaluate(() => window.ui.hint.show('', { says: 'A rubber duck in the lake', ttl: 0 })); await sleep(1000);
    await page.screenshot({ path: path.join(OUT, `hint-says-${bg}${sfx}.png`) });
    const m = await page.evaluate(() => { const e = document.querySelector('.ag-hint'), r = e.getBoundingClientRect(), s = getComputedStyle(e); return { r: [r.left, r.top, r.width, r.height].map(Math.round), color: s.color, font: s.fontFamily.split(',')[0], bg: s.backgroundColor, fs: s.fontSize, overflow: r.left < 0 || r.right > innerWidth }; });
    console.log(bg + sfx, JSON.stringify(m));
    await page.close();
  }
} finally { await browser.close(); server.kill(); }
