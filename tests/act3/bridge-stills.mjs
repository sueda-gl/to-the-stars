// Bridge alone: stills along its timeline (shots/act3/bridge-t*.png). On the live :8870 (never restarted).
//   ~/.nvm/versions/node/v22.22.3/bin/node tests/act3/bridge-stills.mjs [t,t,...] [golden]
import puppeteer from 'puppeteer-core';
const BASE = 'http://localhost:8870', OUT = '/Users/suedagul/agora/shots/act3/';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const W = +(process.env.W || 1440), H = +(process.env.H || 900), PRE = process.env.PRE || 'bridge-';
const ts = (process.argv[2] || '0,1,2,3,4,5,5.6,6.2,6.8,7.4,8,9,10,10.6').split(',').map(Number);
const golden = process.argv[3] === 'golden';
const b = await puppeteer.launch({ executablePath: CHROME, headless: true, defaultViewport: { width: W, height: H, deviceScaleFactor: 1 },
  args: ['--use-angle=metal', '--hide-scrollbars', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
const p = await b.newPage();
p.on('pageerror', e => console.log('PAGEERROR', String(e)));
p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log('console.' + m.type(), m.text()); });
await p.goto(BASE + '/fonts.html', { waitUntil: 'domcontentloaded' });
const t0 = Date.now();
await p.evaluate(async golden => {
  document.body.innerHTML = '';
  const m = await import('/js/voyage/landing-bridge.js');
  window.__br = m.createLandingBridge({ golden });
  window.__br.setOpacity(1);
  await window.__br.ready();
}, golden);
console.log('bridge ready in', Date.now() - t0, 'ms');
const st0 = await p.evaluate(() => { const B = window.__br; B.syncClock({ sceneTime: 30, walkTime: 29.5 }); B.start({}); return B.state(); });
console.log(JSON.stringify(st0));
for (const t of ts) {
  await p.evaluate(t => window.__br.hold(t), t);
  await new Promise(r => setTimeout(r, 350));
  await p.screenshot({ path: OUT + PRE + 't' + String(t.toFixed(1)).padStart(4, '0') + '.png' });
  const s = await p.evaluate(() => window.__br.state());
  console.log('t', t, 'mix', s.mix.toFixed(2), 'plisse', s.plisse.pos.map(v => v.toFixed(2)).join(','), 'lounge', s.lounge.pos.map(v => v.toFixed(1)).join(','), 'fps-frames', s.frames);
}
await b.close();
