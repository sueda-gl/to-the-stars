#!/usr/bin/env node
// Renders every mock stock asset (server/mock/assets/*.js) through the real Build API and paint engine:
// boots the server in mock mode, opens web/gallery.html?code=/api/stock/<key>.js in headless Chrome, checks the
// library registered it (no .tag.err, no [buildings] console warning) and screenshots it to shots/server/.
// Usage: node tests/server/render-stock.mjs [key ...]  [--view=bird|eye] [--mode=gouache|riso|raw] [--assets  (the cached generated assets instead)]
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
import { createServer } from '../../server/index.js';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const args = process.argv.slice(2);
const opt = (k, d) => { const a = args.find(x => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const keys = args.filter(a => !a.startsWith('--'));
const view = opt('view', 'bird'), mode = opt('mode', 'gouache');
const outDir = path.resolve('shots/server');
fs.mkdirSync(outDir, { recursive: true });

// --assets renders the server's cached generated assets (server/data/assets, live or mock) instead of the stock library.
const useAssets = args.includes('--assets');
const app = await createServer({ mock: true, mockReason: 'render-stock', ...(useAssets ? {} : { assetsDir: fs.mkdtempSync('/tmp/agora-render-') }), logLevel: 'silent', dotenv: false });
const port = await app.listen(0);
const base = `http://127.0.0.1:${port}`;
const stock = useAssets
  ? (await (await fetch(`${base}/api/assets`)).json()).map(a => ({ key: a.id, name: a.name, generic: false, url: `/api/assets/${a.id}.js` }))
  : await (await fetch(`${base}/api/stock`)).json();
const wanted = keys.length ? stock.filter(s => keys.includes(s.key)) : stock;

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--use-angle=metal', '--enable-unsafe-swiftshader', '--window-size=1440,900', '--autoplay-policy=no-user-gesture-required'] });
const results = [];
try {
  for (const s of wanted) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
    const warnings = [];
    page.on('console', m => { const t = m.text(); if (/\[buildings\]|error/i.test(t)) warnings.push(t); });
    page.on('pageerror', e => warnings.push(`pageerror: ${e.message}`));
    const req = s.generic ? '&request=' + encodeURIComponent('a bathhouse') : '';
    const codeUrl = s.url || `/api/stock/${s.key}.js${req ? '?' + req.slice(1) : ''}`;
    const url = `${base}/gallery.html?code=${encodeURIComponent(codeUrl)}&only=gen-${s.url ? s.key : s.key}&view=${view}&notags&nofolk${mode === 'gouache' ? '#gouache' : mode === 'raw' ? '#raw' : ''}`;
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });
    await new Promise(r => setTimeout(r, 2500));   // held frames + the painted pass
    const err = await page.evaluate(() => Array.from(document.querySelectorAll('.tag.err')).map(e => e.textContent));
    const sub = await page.evaluate(() => document.getElementById('sub')?.textContent || '');
    const file = path.join(outDir, `${useAssets ? 'asset' : 'stock'}-${s.key}${view === 'bird' ? '' : '-' + view}.png`);
    await page.screenshot({ path: file });
    results.push({ key: s.key, ok: !err.length && !warnings.length, sub, err, warnings, file });
    console.log(`${!err.length && !warnings.length ? 'PASS' : 'FAIL'}  ${s.key.padEnd(11)} ${sub}${err.length ? '  ERR ' + err.join(' | ') : ''}${warnings.length ? '  WARN ' + warnings.join(' | ') : ''}  -> ${path.relative(process.cwd(), file)}`);
    await page.close();
  }
} finally {
  await browser.close();
  await app.close();
}
const failed = results.filter(r => !r.ok);
console.log(failed.length ? `render-stock: ${failed.length} failed` : `render-stock: all ${results.length} stock assets compiled and rendered`);
process.exit(failed.length ? 1 : 0);
