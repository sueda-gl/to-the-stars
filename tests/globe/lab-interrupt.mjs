// The lab's interrupt buttons, run in REAL time (the globe's own loop), against the dev server on :8870.
//   node tests/globe/lab-interrupt.mjs   -> shots/globe/after/lab-int1.png, lab-int2.png + the status lines
import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, defaultViewport: { width: 1440, height: 900 }, args: ['--use-angle=metal', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
const page = await browser.newPage(); const errs = []; page.on('pageerror', e => errs.push(String(e)));
await page.goto('http://127.0.0.1:8870/globe-lab.html', { waitUntil: 'load' });
await page.waitForFunction(() => window.__globeReady === true, { timeout: 120000 });
for (const id of ['int1', 'int2']) {
  await page.click(`button[data-do="${id}"]`);
  await page.waitForFunction(() => /->|moon (true|false)/.test(document.getElementById('status').textContent) && !/…/.test(document.getElementById('status').textContent), { timeout: 60000, polling: 200 });
  console.log(id, await page.$eval('#status', e => e.textContent));
  await page.screenshot({ path: `/Users/suedagul/agora/shots/globe/after/lab-${id}.png` });
  await page.evaluate(() => { document.getElementById('status').textContent = ''; window.__globe.snapTo(); });
}
console.log('errors', errs); await browser.close();
