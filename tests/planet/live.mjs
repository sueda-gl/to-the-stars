// Real-clock smoke on the live server (:8870, never restarted): the page runs its own loop, then a descendTo.
import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, defaultViewport: { width: 1440, height: 900 }, args: ['--use-angle=metal'] });
const p = await b.newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e)));
await p.goto('http://localhost:8870/planet.html', { waitUntil: 'networkidle0' });
await new Promise(r => setTimeout(r, 5000));
const s1 = await p.evaluate(() => window.__planet.state());
await p.screenshot({ path: '/Users/suedagul/agora/shots/planet/live-8870-orbit.png' });
await p.evaluate(() => window.__planet.descendTo({ fx: 22, fz: 38, alt: 55, ms: 5000 }));
await new Promise(r => setTimeout(r, 7000));
const s2 = await p.evaluate(() => window.__planet.state());
await p.screenshot({ path: '/Users/suedagul/agora/shots/planet/live-8870-landed.png' });
console.log(JSON.stringify({ errs, a: [s1.mode, s1.orbit.az.toFixed(3)], b: [s2.mode, s2.altitude.toFixed(1), s2.blend.toFixed(3), s2.daylight.toFixed(3)] }));
await b.close();
