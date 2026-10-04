// Screenshots the pop icon contact sheet (web/icons.html) from the running server into shots/icons/.
//   node tests/ui/icons-shot.mjs [port=8870]
import puppeteer from 'puppeteer-core';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const port = process.argv[2] || 8870;
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--hide-scrollbars'] });
const page = await browser.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('response', r => r.status() >= 400 && !r.url().includes('favicon') && errs.push(r.status() + ' ' + r.url()));
await page.setViewport({ width: 1500, height: 900, deviceScaleFactor: 1 });
await page.goto(`http://localhost:${port}/icons.html?t=${Date.now()}`, { waitUntil: 'networkidle0' });
await new Promise(r => setTimeout(r, 400));
await page.screenshot({ path: path.join(ROOT, 'shots/icons/contact-sheet.png'), fullPage: true });
// a 2x close-up of the 24 px column so the small size can be judged
await page.setViewport({ width: 1500, height: 900, deviceScaleFactor: 2 });
await page.screenshot({ path: path.join(ROOT, 'shots/icons/contact-sheet@2x.png'), fullPage: true });
const el = await page.$('#ctx'); await el.screenshot({ path: path.join(ROOT, 'shots/icons/in-context@2x.png') });
await browser.close();
if (errs.length) { console.error(errs.join('\n')); process.exit(1); }
console.log('ok');
