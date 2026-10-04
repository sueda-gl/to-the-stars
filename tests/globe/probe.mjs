import { spawn } from 'node:child_process';
import puppeteer from 'puppeteer-core';
const port = 8931 + Math.floor(Math.random()*500);
const server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: '/Users/suedagul/agora', stdio: 'ignore' });
await new Promise(r => setTimeout(r, 800));
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, defaultViewport: { width: 1440, height: 900 }, args: ['--use-angle=metal'] });
const page = await browser.newPage();
page.on('pageerror', e => console.log('ERR', String(e).slice(0, 200)));
await page.goto(`http://127.0.0.1:${port}/web/globe-lab.html?${process.argv[2] || 'view=orbit'}`, { waitUntil: 'load' });
await new Promise(r => setTimeout(r, 3000));
const out = await page.evaluate(process.argv[3] || `(() => { const bad = []; window.__globe.scene.traverse(o => { if (!o.geometry) return; for (const k in o.geometry.attributes) if (!o.geometry.attributes[k]) bad.push([o.type, k, o.parent && o.parent.type]); }); return bad; })()`);
console.log(JSON.stringify(out).slice(0, 3000));
if (process.argv[4]) { await new Promise(r => setTimeout(r, 500)); await page.screenshot({ path: process.argv[4] }); }
await browser.close(); server.kill();
