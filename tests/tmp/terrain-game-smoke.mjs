import puppeteer from 'puppeteer-core';
const url = process.argv[2], out = process.argv[3], wait = +(process.argv[4] || 9000);
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal', '--window-size=1440,900', '--hide-scrollbars', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
const page = await browser.newPage(); await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 300))); page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 200)); });
const t0 = Date.now();
await page.goto(url, { waitUntil: 'load', timeout: 120000 });
await new Promise(r => setTimeout(r, wait));
if (process.env.RUN) { console.log('RUN', JSON.stringify(await page.evaluate(process.env.RUN))); await new Promise(r => setTimeout(r, +(process.env.WAIT2 || 3000))); }
await page.screenshot({ path: out });
console.log(JSON.stringify({ ms: Date.now() - t0, errs }));
await browser.close();
