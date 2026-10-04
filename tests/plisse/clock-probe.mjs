// test-only probe: reads plisse.html's THREE.Clock start (by wrapping THREE.Clock.prototype.getDelta from outside, in the
// test browser only; the file is untouched) and compares it with the driver's sceneTime().
import puppeteer from 'puppeteer-core';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const b = await puppeteer.launch({ executablePath: CHROME, headless: true, defaultViewport: { width: 1440, height: 900, deviceScaleFactor: 1 },
  args: ['--use-angle=metal', '--hide-scrollbars', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
const p = await b.newPage();
await p.evaluateOnNewDocument(() => {
  if (!location.pathname.endsWith('/worlds/plisse.html')) return;
  let T;
  let wrapped = false;
  Object.defineProperty(window, 'THREE', { configurable: true, set(v) { T = v; }, get() {
    if (!wrapped && T && T.Clock) { wrapped = true; const g = T.Clock.prototype.getDelta;
      T.Clock.prototype.getDelta = function () { const r = g.call(this); if (window.__clock === undefined) window.__clock = this; return r; }; }
    return T;
  } });
});
await p.goto('http://localhost:8870/plisse-lab.html?shot=1', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__lab && window.__planet);
await p.evaluate(() => window.__planet.ready);
await p.evaluate(() => window.__lab.hold(1));
await p.waitForFunction(() => window.__lab.driver && window.__lab.driver.isSettled(), { timeout: 60000, polling: 100 });
for (let i = 0; i < 4; i++) {
  const r = await p.evaluate(() => {
    const d = window.__lab.driver, w = d.window;
    const c = w.__clock; c.getElapsedTime && 0;
    const real = (w.performance.now() - c.startTime) / 1000;
    return { real, driver: d.sceneTime(), standin: window.__lab.standin.time, startTime: c.startTime, dbg: d._clock };
  });
  console.log(JSON.stringify(r));
  await new Promise(r => setTimeout(r, 700));
}
await b.close();
