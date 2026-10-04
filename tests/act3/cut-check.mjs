// Cut 1 check: her Plissé (verbatim, driven to the dusk-ring view by approach()) vs the bridge's first frame.
//   ~/.nvm/versions/node/v22.22.3/bin/node tests/act3/cut-check.mjs
import puppeteer from 'puppeteer-core';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
const ROOT = '/Users/suedagul/agora/', BASE = 'http://localhost:8870', OUT = ROOT + 'shots/act3/';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const sha = f => createHash('sha256').update(readFileSync(ROOT + f)).digest('hex');
const W = +(process.env.W || 1440), H = +(process.env.H || 900);
const b = await puppeteer.launch({ executablePath: CHROME, headless: true, defaultViewport: { width: W, height: H, deviceScaleFactor: 1 },
  args: ['--use-angle=metal', '--hide-scrollbars', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
const p = await b.newPage();
p.on('pageerror', e => console.log('PAGEERROR', String(e)));
p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning' || m.text().startsWith('[')) console.log('console', m.text()); });
await p.goto(BASE + '/fonts.html', { waitUntil: 'domcontentloaded' });
await p.evaluate(async () => {
  document.body.innerHTML = ''; document.body.style.margin = '0';
  const D = await import('/js/voyage/plisse-driver.js'), Bm = await import('/js/voyage/landing-bridge.js');
  window.__Bm = Bm;
  await D.registerPlisseOffline('worlds/plisse.html');
  const f = document.createElement('iframe');
  Object.assign(f.style, { position: 'fixed', inset: 0, width: '100%', height: '100%', border: 0, zIndex: 30 });
  document.body.appendChild(f);
  window.__d = D.createPlisseDriver(f, {});
  f.src = 'worlds/plisse.html';
  window.__br = Bm.createLandingBridge({});
  await window.__d.ready({ settled: true });
  await window.__d.hideOwnChrome(true);
});
console.log('plisse ready');
const t0 = Date.now();
const cam = await p.evaluate(async () => window.__d.approach(window.__Bm.BRIDGE.ring));
console.log('approach took', Date.now() - t0, 'ms; model', JSON.stringify({ theta: cam.theta, phi: cam.phi, radius: cam.radius }));
await p.evaluate(() => window.__br.ready());
await p.screenshot({ path: OUT + 'cut1-a-her-plisse.png' });
const st = await p.evaluate(() => {
  const d = window.__d, B = window.__br, c = d.cameraNow();
  B.syncClock({ sceneTime: d.sceneTime(), walkTime: d.walkTime() });
  B.start({ theta: c.theta, phi: c.phi, radius: c.radius });
  window.__follow = setInterval(() => B.syncClock({ sceneTime: d.sceneTime(), walkTime: d.walkTime() }), 16);
  B.hold(0); B.setOpacity(1);
  return { her: { sceneTime: d.sceneTime(), walkTime: d.walkTime() }, bridge: B.state() };
});
console.log(JSON.stringify(st));
await new Promise(r => setTimeout(r, 120));
await p.screenshot({ path: OUT + 'cut1-b-bridge-t0.png' });
await p.evaluate(() => window.__br.setOpacity(0.5));
await new Promise(r => setTimeout(r, 60));
await p.screenshot({ path: OUT + 'cut1-c-50-50.png' });
await b.close();
console.log(sha('web/worlds/plisse.html') === 'c04218c1a5d2010f045676faaeb89f90bf335c2c1433a21cbeca3fae52275fd3' ? 'PASS' : 'FAIL', 'plisse.html unchanged');
