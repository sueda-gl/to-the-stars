// two voyages in a row (the worlds are kept between them), steps logged, a frame at each cut
import puppeteer from 'puppeteer-core';
const BASE = process.argv[2] || 'http://localhost:8870';
const OUT = '/Users/suedagul/agora/shots/integ/v2-';
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal', '--window-size=1440,900', '--disable-background-timer-throttling'], defaultViewport: { width: 1440, height: 900 } });
const page = await b.newPage(); const errs = []; page.on('pageerror', e => { errs.push(e.message); console.log('[pageerror]', e.message); });
const sleep = ms => new Promise(r => setTimeout(r, ms)); const ev = (fn, ...a) => page.evaluate(fn, ...a);
const t0 = Date.now(); const T = () => ((Date.now() - t0) / 1000).toFixed(1);
await page.goto(`${BASE}/?intro=none&autostart=1&opening=none&minds=off`, { waitUntil: 'load' });
const bootT = Date.now(); while (Date.now() - t0 < 90000) { if (await ev(() => window.__agora && window.__agora.introDone).catch(() => false)) break; await sleep(200); }
console.log(T(), 'landed; boot screen gone?', await ev(() => !document.getElementById('boot')), JSON.stringify(await ev(() => __agora.stages.held)));
await sleep(2000);
for (let v = 1; v <= 2; v++) {
  await ev(() => { window.__steps = []; let last; const f = () => { const s = __agora.stages.step; if (s !== last) { __steps.push([Math.round(performance.now()), s]); last = s; } requestAnimationFrame(f); }; f(); __agora.stages.goMoon(); });
  let shotAt = new Set();
  const s0 = Date.now();
  while (Date.now() - s0 < 90000) { const st = await ev(() => ({ a: __agora.stages.act3, f: __agora.stages.flying, s: __agora.stages.step })); if (st.s && !shotAt.has(st.s)) { shotAt.add(st.s); await page.screenshot({ path: `${OUT}${v}-${st.s}.png` }); } if (st.a === 'lounge' && !st.f) break; await sleep(250); }
  console.log(T(), `voyage ${v} at the lounge`, JSON.stringify(await ev(() => __agora.stages.held)));
  await sleep(1500); await page.screenshot({ path: `${OUT}${v}-lounge.png` });
  await ev(() => { __agora.stages.goHome(); });
  const s1 = Date.now();
  while (Date.now() - s1 < 90000) { const st = await ev(() => ({ sc: __agora.stages.scene, su: __agora.stages.surface, s: __agora.stages.step })); if (st.s && !shotAt.has('h' + st.s)) { shotAt.add('h' + st.s); await page.screenshot({ path: `${OUT}${v}-h-${st.s}.png` }); } if (st.sc === 'world' && st.su === 'sea' && !st.s) break; await sleep(250); }
  console.log(T(), `voyage ${v} home`, JSON.stringify(await ev(() => ({ held: __agora.stages.held, steps: __steps.map(x => x[1]).join('>') }))));
  await sleep(2000);
}
await page.screenshot({ path: `${OUT}end.png` });
console.log('errors', JSON.stringify(await ev(() => __agora.errors)), errs.length);
await b.close();
