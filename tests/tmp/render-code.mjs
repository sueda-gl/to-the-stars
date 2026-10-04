// scratch: render build(api) code files in gallery.html?code=… (bird + eye). Usage: node render-code.mjs out_dir file1.js[:extra] ...
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
import { createServer } from '../../server/index.js';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const [out, ...files] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const app = await createServer({ mock: true, mockReason: 'render-code', assetsDir: fs.mkdtempSync('/tmp/agora-rc-'), logLevel: 'silent', dotenv: false });
const port = await app.listen(0);
const base = `http://127.0.0.1:${port}`;
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--use-angle=metal', '--window-size=1600,1000'] });
try {
  for (const spec of files) {
    const [f, views = 'bird,eye', extra = ''] = spec.split('|');
    for (const view of views.split(',')) {
      const page = await browser.newPage();
      await page.setViewport({ width: 1600, height: 1000, deviceScaleFactor: 1 });
      const warn = [];
      page.on('console', m => { const t = m.text(); if (/\[buildings\]|error|fail/i.test(t)) warn.push(t); });
      page.on('pageerror', e => warn.push('pageerror ' + e.message));
      const name = path.basename(f, '.js');
      const url = `${base}/gallery.html?code=${encodeURIComponent('/' + f)}&only=gen-${name}&view=${view}&notags&nofolk${extra}#gouache`;
      await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });
      await page.waitForFunction(() => window.__gallery && window.__gallery.ready, { timeout: 30000 });
      await new Promise(r => setTimeout(r, 2500));
      const info = await page.evaluate(() => { const s = window.__gallery.shown[0]; const a = s && s.obj.userData.agora; return { sub: document.getElementById('sub').textContent, err: Array.from(document.querySelectorAll('.tag.err')).map(e => e.textContent), size: a && a.size, meshes: a && a.meshes, tris: a && a.tris }; });
      const file = path.join(out, `${name}-${view}${extra ? '-' + extra.replace(/[^a-z0-9]+/gi, '') : ''}.png`);
      await page.screenshot({ path: file });
      console.log(view, name, JSON.stringify(info), warn.join(' | '), '->', file);
      await page.close();
    }
  }
} finally { await browser.close(); await app.close(); }
