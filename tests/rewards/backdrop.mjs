// Captures a clean game backdrop (world only, UI hidden) for web/rewards-lab.html, plus the screen positions of the buildings.
import puppeteer from 'puppeteer-core';
import { writeFileSync } from 'node:fs';
const BASE = process.argv[2] || 'http://localhost:8884';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new',
  args: ['--use-angle=metal', '--window-size=1440,900'], defaultViewport: { width: 1440, height: 900 } });
const page = await browser.newPage();
page.on('pageerror', e => console.log('[pageerror]', e.message));
const ev = (fn, ...a) => page.evaluate(fn, ...a);
await page.goto(`${BASE}/?intro=none&autostart=1&opening=auto&minds=off`, { waitUntil: 'load' });
const until = async (fn, ms) => { const s = Date.now(); while (Date.now() - s < ms) { if (await ev(fn).catch(() => false)) return true; await sleep(400); } return false; };
console.log('intro', await until(() => window.__agora && window.__agora.introDone, 90000));
console.log('opening', await until(() => __agora.opening && __agora.opening.phase === 'done', 120000));
await sleep(2000);
await page.keyboard.press('Escape'); await ev(() => { try { __agora.ui.letters.close(); } catch (_) {} });
for (const t of ["build a house in the middle", "a well there", "a bakery there"]) {
  await ev(t => __agora.handle(t, { x: 600 + Math.random() * 300, y: 450 + Math.random() * 150 }), t); await sleep(1500);
}
await sleep(40000);
await page.keyboard.press('Escape');
const info = await ev(() => __agora.game.state.buildings.map(b => ({ kind: b.kind, name: b.name, status: b.status, s: __agora.world.project(b.x, null, b.z) })));
console.log(JSON.stringify(info));
await page.screenshot({ path: '/Users/suedagul/agora/shots/rewards/with-ui.png' });
await ev(() => { for (const e of document.querySelectorAll('body > *:not(canvas):not(script)')) e.style.visibility = 'hidden'; });
await sleep(600);
await page.screenshot({ path: '/Users/suedagul/agora/web/assets/rewards-backdrop.jpg', type: 'jpeg', quality: 86 });
writeFileSync('/Users/suedagul/agora/shots/rewards/backdrop.json', JSON.stringify(info, null, 1));
await browser.close();
