// probe: her camera every frame through the lift's planet phase (distance from her centre, fov, mode)
import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new',
  args: ['--use-angle=metal', '--window-size=1440,900', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'], defaultViewport: { width: 1440, height: 900 } });
const page = await b.newPage();
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ev = (fn, ...a) => page.evaluate(fn, ...a);
await page.goto('http://localhost:8883/?minds=mock&opening=none', { waitUntil: 'load' });
for (let i = 0; i < 400; i++) { if (await ev(() => !!(window.__agora && document.querySelector('.tt') && !document.querySelector('.tt').hidden)).catch(() => false)) break; await sleep(300); }
await sleep(1500);
await ev(() => window.__agora.stages.diveHome({ skip: true }));
await sleep(2000);
await ev(() => { const A = window.__agora, S = A.stages, af = S.afterFrame; window.__p = []; const t0 = performance.now(); S.afterFrame = n => { af(n); const c = A.planet.camera, m = S.handoffMove; window.__p.push([Math.round(n - t0), m ? m.phase : '-', +c.position.length().toFixed(1), +c.fov.toFixed(2), A.planet.state().mode, S.cloudDebug.which]); }; S.showGlobe(); });
await sleep(9000);
const p = await ev(() => window.__p);
let prev = null;
for (const r of p) { if (r[1] === 'planet' || (prev && prev[1] === 'planet')) { const jump = prev ? Math.abs(r[2] - prev[2]) : 0; console.log(r.join(' '), jump > 25 ? '  <== ' + jump.toFixed(0) : ''); } prev = r; }
await b.close();
