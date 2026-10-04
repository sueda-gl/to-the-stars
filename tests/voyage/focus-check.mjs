// Keyboard focus + chrome + failure checks for the voyage, with REAL (CDP) mouse and keyboard input.
//  - the game's keys (Space push-to-talk) keep reaching the parent window on the Moon after taps and drags
//  - a held Space survives a tap on the meadow (no parent window blur in between)
//  - focus forced into the lounge still forwards keys, and is handed back
//  - the lounge's hidden chrome can't be reached with Tab / pressed with Enter
//  - pointer moves over the lounge are mirrored to the parent (voice "there")
//  - focus is back on the parent after returnHome()
//  - lab toggles: a fast double click returns to where it started
//  - dropSeed('auto') swings to the seed view, then reframes toward the room (screenshots)
//  - a lounge that never loads -> the voyage flies home, depart() resolves null (set FAIL=1, takes ~55 s)
// Usage: node tests/voyage/focus-check.mjs [shotsDir]
import puppeteer from 'puppeteer-core';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdirSync } from 'node:fs';
const root = new URL('../../', import.meta.url).pathname;
const shots = process.argv[2] || root + 'tests/voyage/out/focus';
mkdirSync(shots, { recursive: true });
const port = await new Promise(r => { const s = createServer(); s.listen(0, () => { const p = s.address().port; s.close(() => r(p)); }); });
const srv = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: root, stdio: 'ignore' });
await new Promise(r => setTimeout(r, 700));
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal', '--enable-unsafe-swiftshader', '--window-size=1440,900'], defaultViewport: { width: 1440, height: 900 } });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fails = 0; const check = (ok, msg) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg); if (!ok) fails++; };
try {
  const p = await browser.newPage();
  p.on('pageerror', e => console.log('pageerror', e.message));
  p.on('console', m => { if (m.type() === 'error' && !/favicon/.test(m.location()?.url || '')) console.log('console', m.text()); });
  await p.goto(`http://127.0.0.1:${port}/web/voyage-lab.html?lab=0`, { waitUntil: 'load' });
  await p.waitForFunction(() => window.__lab); await sleep(1000);
  await p.evaluate(() => {
    window.__keys = []; window.__blurs = 0; window.__moves = [];
    addEventListener('keydown', e => __keys.push('d:' + e.code)); addEventListener('keyup', e => __keys.push('u:' + e.code));
    addEventListener('blur', () => __blurs++); addEventListener('pointermove', e => __moves.push([Math.round(e.clientX), Math.round(e.clientY)]));
  });
  const reset = () => p.evaluate(() => { __keys = []; __blurs = 0; __moves = []; });
  const probe = () => p.evaluate(() => ({ active: document.activeElement.tagName, keys: __keys.slice(), blurs: __blurs }));
  const space = async tag => { await reset(); await p.keyboard.press('Space'); await sleep(120); const r = await probe(); console.log('   ', tag, JSON.stringify(r)); return r; };
  const spaceOk = r => r.active !== 'IFRAME' && r.keys.includes('d:Space') && r.keys.includes('u:Space');

  await p.mouse.click(700, 700);
  check(spaceOk(await space('earth after click')), 'Earth: Space reaches the parent');
  await p.evaluate(() => window.__lab.voyage.depart());
  await p.waitForFunction(() => window.__lab.voyage.state === 'moon', { timeout: 90000 });
  await sleep(600);
  check(spaceOk(await space('moon untouched')), 'Moon, untouched: Space reaches the parent');

  // a real tap on valid grass (find one with the driver's model)
  const grass = await p.evaluate(() => { const d = window.__lab.voyage.driver; for (let y = 880; y > 500; y -= 10) for (let x = 40; x < 1400; x += 10) if (d.wouldSeed(x, y)) return { x, y }; return null; });
  console.log('    grass at', grass);
  await p.mouse.click(grass.x, grass.y); await sleep(300);
  check(spaceOk(await space('moon after tap')), 'Moon after a real tap on the grass: Space reaches the parent');
  await p.screenshot({ path: shots + '/01-after-tap.png' });

  // a real drag to look around
  await p.mouse.move(720, 420); await p.mouse.down(); for (let i = 1; i <= 12; i++) { await p.mouse.move(720 + i * 10, 420); await sleep(16); } await p.mouse.up(); await sleep(400);
  check(spaceOk(await space('moon after drag')), 'Moon after a real drag: Space reaches the parent');

  // hold Space, tap the meadow (pointing), release: one unbroken press, no blur
  await reset();
  await p.keyboard.down('Space'); await sleep(150);
  await p.mouse.click(grass.x + 4, grass.y - 4); await sleep(250);
  await p.keyboard.up('Space'); await sleep(120);
  let r = await probe(); console.log('    hold+tap', JSON.stringify(r));
  check(r.keys.filter(k => k === 'd:Space').length === 1 && r.keys.includes('u:Space') && r.blurs === 0, 'Held Space survives a tap on the meadow (one keydown, keyup, no parent blur)');

  // focus forced into the lounge (as a touch / other browser could): keys are forwarded, focus comes back
  await p.evaluate(() => { const f = document.querySelector('.agv-lounge'); f.contentWindow.focus(); f.contentDocument.body.tabIndex = -1; f.contentDocument.body.focus(); });
  await sleep(200);
  // forwarding itself (whatever has focus): a key event inside the lounge reaches the parent window
  await reset();
  await p.evaluate(() => { const d = document.querySelector('.agv-lounge').contentDocument, K = d.defaultView.KeyboardEvent;
    for (const t of ['keydown', 'keyup']) d.body.dispatchEvent(new K(t, { code: 'Space', key: ' ', bubbles: true, cancelable: true })); });
  r = await probe();
  check(r.keys.includes('d:Space') && r.keys.includes('u:Space'), `a key event inside the lounge is forwarded to the parent (${JSON.stringify(r.keys)})`);
  check((await p.evaluate(() => document.activeElement.tagName)) !== 'IFRAME', 'and focus has been handed back to the parent');

  // the lounge's hidden chrome is out of the tab order
  await p.mouse.click(grass.x, grass.y); await sleep(200);
  for (let i = 0; i < 4; i++) { await p.keyboard.press('Tab'); await sleep(60); }
  const inner = await p.evaluate(() => { const d = document.querySelector('.agv-lounge').contentDocument; const a = d.activeElement; return a && (a.id || a.tagName); });
  await p.keyboard.press('Enter'); await sleep(300);
  const st1 = await p.evaluate(() => window.__lab.driver.state());
  check(inner !== 'toggle' && inner !== 'paint' && !st1.goldenHour && st1.painted, `Tab x4 + Enter: lounge focus=${inner}, golden=${st1.goldenHour}, painted=${st1.painted}`);
  const bar = await p.evaluate(() => { const d = document.querySelector('.agv-lounge').contentDocument; return d.defaultView.getComputedStyle(d.querySelector('.bar')).visibility; });
  check(bar === 'hidden', 'lounge .bar is visibility:hidden while its chrome is hidden');

  // pointer mirrored
  await reset(); await p.mouse.move(611, 433); await sleep(80);
  const mv = await p.evaluate(() => __moves.slice(-1)[0]);
  check(mv && mv[0] === 611 && mv[1] === 433, `pointermove over the lounge mirrored to the parent at ${JSON.stringify(mv)}`);

  // seed: swing to the seed view, then reframe back toward the room
  const th0 = await p.evaluate(() => window.__lab.driver.state().camera.theta);
  const seed = await p.evaluate(async () => { const r = await window.__lab.driver.dropSeed('auto'); window.__reframed = r.reframed; return { ...r, reframed: !!r.reframed }; });
  console.log('    seed', JSON.stringify(seed));
  await sleep(1000); await p.screenshot({ path: shots + '/02-seed-view.png' });
  const thS = await p.evaluate(() => window.__lab.driver.state().camera.theta);
  await sleep(4500); await p.screenshot({ path: shots + '/03-gathered.png' });
  const cam = await p.evaluate(async () => window.__reframed && await window.__reframed);
  await sleep(300); await p.screenshot({ path: shots + '/04-reframed.png' });
  console.log(`    theta: before ${th0.toFixed(2)}, seed view ${thS.toFixed(2)}, reframed ${cam ? cam.theta.toFixed(2) : 'n/a'}`);
  check(!seed.swung || (cam && cam.theta > thS + 0.1), 'after a swing, dropSeed reframes back toward the room');
  check(spaceOk(await space('after seed + reframe')), 'Space still reaches the parent after the seed sequence');

  // lab double click from on
  await p.evaluate(() => { const l = document.getElementById('lab'); l.style.display = ''; });
  await p.evaluate(() => window.__lab.driver.setGoldenHour(true)); await p.evaluate(() => document.getElementById('golden').setAttribute('aria-pressed', 'true'));
  const gb = await p.evaluate(() => { const b = document.getElementById('golden').getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; });
  await p.mouse.click(gb.x, gb.y, { clickCount: 1 }); await p.mouse.click(gb.x, gb.y, { clickCount: 2 }); await sleep(400);
  const dbl = await p.evaluate(() => ({ pill: document.getElementById('golden').getAttribute('aria-pressed'), scene: window.__lab.driver.state().goldenHour }));
  check(dbl.pill === 'true' && dbl.scene === true, `lab golden: double click from on ends on (pill ${dbl.pill}, scene ${dbl.scene})`);
  await p.evaluate(() => { document.getElementById('lab').style.display = 'none'; });

  // home
  await p.mouse.click(grass.x, grass.y); await sleep(200);
  await p.evaluate(() => window.__lab.voyage.returnHome());
  await sleep(200);
  check(spaceOk(await space('earth after return')), 'Earth after returnHome (no new click): Space reaches the parent');

  if (process.env.FAIL === '1') {
    const q = await browser.newPage();
    q.on('pageerror', e => console.log('pageerror', e.message));
    await q.goto(`http://127.0.0.1:${port}/web/voyage-lab.html?lab=0&lounge=worlds/no-such-lounge.html`, { waitUntil: 'load' });
    await q.waitForFunction(() => window.__lab); await sleep(800);
    await q.evaluate(() => { window.__states = []; window.__dep = window.__lab.voyage.depart().then(v => v === null ? 'null' : 'driver'); });
    const t0 = Date.now();
    await q.waitForFunction(() => window.__lab.voyage.state === 'returning', { timeout: 70000, polling: 100 });
    await sleep(500); await q.screenshot({ path: shots + '/05-fail-message.png' });
    const res = await q.evaluate(() => window.__dep);
    const st = await q.evaluate(() => ({ state: window.__lab.voyage.state, lounge: document.querySelector('.agv-lounge').getAttribute('src'), status: document.getElementById('st') && document.getElementById('st').textContent }));
    console.log(`    fail path after ${((Date.now() - t0) / 1000).toFixed(1)} s`, res, JSON.stringify(st));
    check(res === 'null' && st.state === 'earth' && !st.lounge, 'unloadable lounge: flies home, depart() resolves null, iframe cleared');
    await q.screenshot({ path: shots + '/06-fail-home.png' });
  }
} finally { await browser.close(); srv.kill(); }
console.log(fails ? `${fails} FAILED` : 'ALL PASS');
process.exit(fails ? 1 : 0);
