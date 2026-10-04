import puppeteer from 'puppeteer-core';
const PORT = process.env.PORT || 8906;
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal'] });
const p = await b.newPage(); await p.setViewport({ width: 1440, height: 900 });
await p.goto(`http://localhost:${PORT}/?intro=none&autostart=1&opening=none`, { waitUntil: 'load' });
await p.waitForFunction('window.__agora && window.__agora.introDone', { timeout: 90000 });
const sleep = ms => new Promise(r => setTimeout(r, ms));
for (let i = 0; i < 10; i++) { await sleep(1000); await p.evaluate(() => { [...document.querySelectorAll('button')].filter(b => /fold it away/i.test(b.textContent)).forEach(b => b.click()); }); }
await p.evaluate(() => { const A = window.__agora; window.__L = []; const t0 = performance.now(); let last = 0;
  (function f(now) { if (now - last > 250) { last = now; const c = A.planet.camera, s = A.stages.standin; let px = null;
    if (s) { const v = s.group.position.clone().project(c); const fr = s.radius * 1.033 / c.position.distanceTo(s.group.position) / Math.tan(c.fov * Math.PI / 360); px = [+v.x.toFixed(2), +v.y.toFixed(2), Math.round(fr * 450)]; }
    window.__L.push([((now - t0) / 1000).toFixed(2), Math.round(c.position.length() - 170), +A.planet.blend.toFixed(2), px, A.stages.scene]); }
    if (now - t0 < 16000) requestAnimationFrame(f); })(t0);
  A.stages.goMoon(); });
await sleep(16500);
(await p.evaluate(() => window.__L)).forEach(l => console.log(JSON.stringify(l)));
await b.close();
