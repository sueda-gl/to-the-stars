// Read-only check on the running game server (default :8870): the lab opens with G, the old-server save path is graceful.
import puppeteer from 'puppeteer-core';
const base = process.argv[2] || 'http://localhost:8870';
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal', '--window-size=1440,900'], defaultViewport: { width: 1440, height: 900 } });
const page = await b.newPage(); const errs = [];
page.on('pageerror', e => { errs.push(e.message); console.log('[pageerror]', e.message); });
const sleep = ms => new Promise(r => setTimeout(r, ms));
await page.goto(base + '/?intro=none', { waitUntil: 'load' });
await page.waitForFunction(() => window.__agora && window.__agora.look, { timeout: 90000 }); await sleep(2500);
await page.keyboard.press('g'); await sleep(500);
const r = await page.evaluate(async () => ({ open: !!document.querySelector('.look-lab:not([hidden])'), probe: document.querySelector('.ll-probe').textContent,
  route: (await fetch('/api/look')).status, chain: (() => { const o = []; let e = document.querySelector('.ll-g-host .tweak'); while (e && e !== document.body) { const c = getComputedStyle(e); o.push(e.className + '|' + c.display + '|' + c.opacity + '|' + c.visibility + '|' + c.height); e = e.parentElement; } return o; })(), tweaks: [...document.querySelectorAll('#tweaks')].map(t => t.parentElement.className + ' ' + getComputedStyle(t).display + ' ' + t.children.length) }));
console.log(JSON.stringify(r), 'errors', errs.length, JSON.stringify(await page.evaluate(() => __agora.errors)));
await page.screenshot({ path: new URL('../../shots/look-lab/20-game-8870-G.png', import.meta.url).pathname });
await b.close();
