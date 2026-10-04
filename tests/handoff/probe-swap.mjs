// probe: the cloud's camera (anchor frame) every frame across the swap
import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new',
  args: ['--use-angle=metal', '--window-size=1440,900', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'], defaultViewport: { width: 1440, height: 900 } });
const page = await b.newPage();
page.on('pageerror', e => console.log('[pageerror]', e.message));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ev = (fn, ...a) => page.evaluate(fn, ...a);
await page.goto('http://localhost:8883/?minds=mock&opening=auto', { waitUntil: 'load' });
for (let i = 0; i < 400; i++) { if (await ev(() => !!(window.__agora && document.querySelector('.tt') && !document.querySelector('.tt').hidden)).catch(() => false)) break; await sleep(300); }
await sleep(1500);
await ev(() => { const S = window.__agora.stages, af = S.afterFrame; window.__dbg = []; const t0 = performance.now(); S.afterFrame = n => { af(n); const d = S.cloudDebug; if (d.which) window.__dbg.push({ t: Math.round(n - t0), ...d, sea: undefined, seaPose: d.sea && [d.sea.dist, d.sea.pitch, d.sea.yaw].map(v => +v.toFixed(3)) }); }; });
await page.click('.tt__begin');
for (let i = 0; i < 100; i++) { if (await ev(() => window.__agora.introDone)) break; await sleep(200); }
const d = await ev(() => window.__dbg);
for (const r of d) console.log(r.t, r.which, JSON.stringify(r.pos), 'H', r.H && r.H.toFixed(0), 'W', r.W, r.seaPose && JSON.stringify(r.seaPose), r.planetMode, r.alt);
await b.close();
