// Plissé lab screenshots (shots/plisse/), on the running server (:8870, never restarted), real clock, 1440x900.
//   ~/.nvm/versions/node/v22.22.3/bin/node tests/plisse/shots.mjs [base]
// Also checks web/worlds/plisse.html is byte-identical to the reference before and after.
import puppeteer from 'puppeteer-core';
import { createHash } from 'node:crypto';
import { readFileSync, mkdirSync } from 'node:fs';
const ROOT = '/Users/suedagul/agora/';
const OUT = ROOT + 'shots/plisse/';
mkdirSync(OUT, { recursive: true });
const BASE = process.argv[2] || 'http://localhost:8870';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const sha = f => createHash('sha256').update(readFileSync(ROOT + f)).digest('hex');
const REF = readFileSync(ROOT + 'reference/SHA256', 'utf8').split('\n').find(l => l.includes('plisse-the-lantern-planet.html')).slice(0, 64);
const before = sha('web/worlds/plisse.html');
console.log(before === REF ? 'PASS' : 'FAIL', 'plisse.html byte-identical before:', before);
const wait = ms => new Promise(r => setTimeout(r, ms));
const W = +(process.env.W || 1440), H = +(process.env.H || 900), PRE = process.env.PRE || '';
const b = await puppeteer.launch({ executablePath: CHROME, headless: true, defaultViewport: { width: W, height: H, deviceScaleFactor: 1 },
  args: ['--use-angle=metal', '--hide-scrollbars', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--autoplay-policy=no-user-gesture-required'] });
const p = await b.newPage();
const errs = [];
p.on('pageerror', e => { errs.push(String(e)); console.log('PAGEERROR', String(e)); });
p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log('console.' + m.type(), m.text()); });
const only = process.argv[3] ? process.argv[3].split(',') : null;
const want = k => !only || only.includes(k);
const shot = async n => { await p.screenshot({ path: OUT + PRE + n + '.png' }); console.log('shot', PRE + n); };
await p.goto(BASE + '/plisse-lab.html?shot=1', { waitUntil: 'domcontentloaded', timeout: 60000 });
await p.waitForFunction(() => window.__lab && window.__planet, { timeout: 60000 });
await p.evaluate(() => window.__planet.ready);
await wait(2500);
if (want('earth')) await shot('1-earth-orbit');
for (const s of [0.18, 0.5, 0.8]) {
  await p.evaluate(s => window.__lab.hold(s), s);
  await wait(s === 0.18 ? 600 : 900);
  if (want('flight')) await shot('2-flight-' + String(Math.round(s * 100)).padStart(2, '0'));
}
await p.evaluate(() => window.__lab.hold(1));
await p.waitForFunction(() => window.__lab.driver && window.__lab.driver.isSettled(), { timeout: 60000, polling: 100 });
await wait(400);
if (want('end')) await shot('3-standin-end-pose');
await p.evaluate(() => window.__lab.holdFade(0.5));
await wait(300);
if (want('fade')) await shot('4-crossfade-50');
await p.evaluate(() => window.__lab.holdFade(1));
await wait(300);
if (want('fade')) await shot('4b-iframe-only-at-hold');
await p.evaluate(() => { window.__lab.holdFade(null); window.__lab.release(); });
await p.waitForFunction(() => window.__lab.state === 'plisse', { timeout: 30000, polling: 100 });
await wait(600);
await shot('5-arrived-original');
const st = await p.evaluate(() => window.__lab.driver.state());
console.log('driver state', JSON.stringify(st));
if (want('return')) {
  await p.evaluate(() => window.__lab.returnHome());
  await p.waitForFunction(() => window.__lab.state === 'returning', { timeout: 30000, polling: 50 });
  await wait(2500);
  await shot('6-return-mid');
  await p.waitForFunction(() => window.__lab.state === 'earth', { timeout: 30000, polling: 100 });
  await wait(1500);
  await shot('7-back-in-orbit');
}
await b.close();
const after = sha('web/worlds/plisse.html');
console.log(after === REF ? 'PASS' : 'FAIL', 'plisse.html byte-identical after:', after);
console.log(errs.length ? 'FAIL page errors: ' + errs.length : 'PASS no page errors');
