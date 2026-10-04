// Screenshots for the voyage: the sky moon (Riso / Gouache / ring), passage stills, a live departure,
// the arrival, a seed with shadelings gathering (+6 s), golden hour, and the way home.
// Usage: node tests/voyage/shots.mjs [only-these-names...]   -> shots/voyage/*.png
import puppeteer from 'puppeteer-core';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
const root = new URL('../../', import.meta.url).pathname, out = root + 'shots/voyage/';
const only = process.argv.slice(2);
const want = n => !only.length || only.some(o => n.startsWith(o));
const port = await new Promise(r => { const s = createServer(); s.listen(0, () => { const p = s.address().port; s.close(() => r(p)); }); });
const srv = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: root, stdio: 'ignore' });
await new Promise(r => setTimeout(r, 700));
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal', '--enable-unsafe-swiftshader', '--window-size=1440,900', '--autoplay-policy=no-user-gesture-required'], defaultViewport: { width: 1440, height: 900 } });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const base = `http://127.0.0.1:${port}/web/voyage-lab.html`;
async function open(q = '') {
  const page = await browser.newPage();
  page.on('pageerror', e => console.log('pageerror', e.message));
  page.on('console', m => { const t = m.text(); if (/error|\[voyage\]|\[driver\]/i.test(t) && !/favicon/.test(t)) console.log('  console:', t); });
  await page.goto(base + q, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__lab, { timeout: 20000 });
  await page.evaluate(() => document.fonts.ready);
  await sleep(1200);
  return page;
}
const shot = async (page, name) => { await page.screenshot({ path: out + name + '.png' }); console.log('shot', name); };
try {
  if (want('sky')) {
    const p = await open('?lab=0');
    await shot(p, 'sky-moon-riso');
    await p.evaluate(() => document.querySelector('[data-mode="1"]').click()); await sleep(900); await shot(p, 'sky-moon-gouache');
    await p.evaluate(() => document.querySelector('[data-mode="2"]').click()); await sleep(600); await shot(p, 'sky-moon-raw');
    await p.evaluate(() => { document.querySelector('[data-mode="0"]').click(); document.getElementById('ring').click(); }); await sleep(900); await shot(p, 'sky-moon-ring-riso');
    await p.evaluate(() => window.__lab.setLift(0.75)); await sleep(900); await shot(p, 'sky-moon-lifted');
    await p.close();
  }
  if (want('still')) {
    const p = await open('?lab=0');
    for (const [dir, pp] of [['out', 0.04], ['out', 0.2], ['out', 0.5], ['out', 0.85], ['home', 0.5], ['home', 0.95]]) {
      await p.evaluate((d, v) => window.__lab.voyage.still(d, v), dir, pp); await sleep(250);
      await shot(p, `still-${dir}-${String(pp).replace('.', '')}`);
    }
    await p.evaluate(() => window.__lab.voyage.still('out', 0, 0.62)); await sleep(200); await shot(p, 'still-sheet-tearing');
    await p.close();
  }
  if (want('voyage')) {
    const p = await open('');
    await p.evaluate(() => { document.querySelector('[data-mode="1"]').click(); }); await sleep(800);
    await shot(p, 'voyage-0-earth');
    await p.evaluate(() => { window.__t0 = performance.now(); document.getElementById('depart').click(); });
    await sleep(500); await shot(p, 'voyage-1a-liftoff');
    await sleep(300); await shot(p, 'voyage-1-liftoff');
    await sleep(1400); await shot(p, 'voyage-2-passage-early');
    await sleep(1600); await shot(p, 'voyage-3-passage-mid');
    await p.waitForFunction(() => /arriving|moon/.test(window.__lab.voyage.state), { timeout: 60000, polling: 50 });
    await shot(p, 'voyage-4-crossfade');
    await p.waitForFunction(() => window.__lab.voyage.state === 'moon', { timeout: 30000 });
    console.log('  arrived after', await p.evaluate(() => ((performance.now() - window.__t0) / 1000).toFixed(1)), 's');
    await p.evaluate(() => document.getElementById('lab').classList.add('folded'));
    await sleep(1500); await shot(p, 'moon-1-arrived');
    const r = await p.evaluate(async () => { const r = await window.__lab.driver.dropSeed('auto'); return r; });
    console.log('  seed', JSON.stringify(r));
    await sleep(700); await shot(p, 'moon-2-seed-dropped');
    await sleep(5500); await shot(p, 'moon-3-seed-gathered-6s');
    await p.evaluate(() => window.__lab.driver.setGoldenHour(true));
    await sleep(4500); await shot(p, 'moon-4-golden-hour');
    await p.evaluate(() => window.__lab.driver.dropSeed('auto'));
    await sleep(6000); await shot(p, 'moon-5-golden-seed');
    await p.evaluate(() => { window.__lab.voyage.returnHome(); });
    await sleep(600); await shot(p, 'home-1-leaving');
    await sleep(2200); await shot(p, 'home-2-passage');
    await sleep(1500); await shot(p, 'home-3-landing');
    await p.waitForFunction(() => window.__lab.voyage.state === 'earth', { timeout: 30000 });
    await sleep(1200); await shot(p, 'home-4-earth');
    await p.close();
  }
  if (want('snap')) {
    const p = await open('?earth=image&lab=0');
    await p.evaluate(() => document.getElementById('departSnap').click());
    await sleep(700); await shot(p, 'snap-1-liftoff');
    await sleep(500); await shot(p, 'snap-2-sheet');
    await p.close();
  }
} finally { await browser.close(); srv.kill(); }
