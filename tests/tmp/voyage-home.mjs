import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
const PORT = process.env.PORT || 8906, OUT = 'shots/voyage-fix/h';
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal'] });
const p = await b.newPage(); await p.setViewport({ width: 1440, height: 900 });
p.on('pageerror', e => console.log('[pageerror]', e.message));
await p.goto(`http://localhost:${PORT}/?intro=none&autostart=1&opening=none`, { waitUntil: 'load' });
await p.waitForFunction('window.__agora && window.__agora.introDone', { timeout: 90000 });
const sleep = ms => new Promise(r => setTimeout(r, ms));
for (let i = 0; i < 10; i++) { await sleep(1000); await p.evaluate(() => { [...document.querySelectorAll('button')].filter(b => /fold it away/i.test(b.textContent)).forEach(b => b.click()); }); }
await p.evaluate(() => window.__agora.stages.goMoon());
console.log('at', await p.evaluate(() => window.__agora.stages.act3));
await sleep(1500);
p.evaluate(() => { window.__home = 'run'; window.__agora.stages.goHome().then(r => window.__home = r).catch(e => window.__home = 'err ' + e.message); });
for (let i = 0; i < 30; i++) { await sleep(1000); await p.screenshot({ path: `${OUT}${String(i).padStart(2, '0')}.jpg`, type: 'jpeg', quality: 60 });
  if (i % 3 === 2) console.log(i, JSON.stringify(await p.evaluate(() => { const A = window.__agora; return { home: window.__home, scene: A.stages.scene, blend: +A.planet.blend.toFixed(2), follow: A.planet.state().followDescent, alt: Math.round(A.planet.altitude) }; }))); }
await b.close();
