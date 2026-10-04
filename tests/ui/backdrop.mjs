// Makes the ui-lab backdrops: the original Red arch, one still frame (window.__STILL), its own chrome hidden.
//   ~/.nvm/versions/node/v22.22.3/bin/node tests/ui/backdrop.mjs
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
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, defaultViewport: { width: 1440, height: 900, deviceScaleFactor: 1 },
  args: ['--use-angle=metal', '--window-size=1440,900', '--hide-scrollbars'] });
try {
  for (const [name, hash] of [['reference', '#gouache'], ['reference-riso', '']]) {
    const page = await browser.newPage();
    await page.evaluateOnNewDocument(() => { window.__STILL = true; });
    await page.goto(`${base}/reference/red-arch-at-sundown.html${hash}`, { waitUntil: 'networkidle0', timeout: 60000 });
    await page.addStyleTag({ content: '.editions,.closeup,.tweaks-toggle,.tweaks{display:none!important}' });
    await new Promise(r => setTimeout(r, 1500));
    const out = path.join(ROOT, `web/assets/backdrop-${name}.png`);
    await page.screenshot({ path: out });
    console.log('wrote', out);
    await page.close();
  }
} finally { await browser.close(); server.kill(); }
