// Headless check of the rewards in THE game (web/index.html): build a house, a farm and a market, fast-forward the sim,
// and read the reward:gain / reward:milestone events the UI gets, with screenshots -> shots/sim/rewards-*.png.
// Usage: node tests/sim/rewards-browser.mjs [--url http://localhost:8877]
import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'node:fs';

const arg = (k, d = null) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const BASE = arg('--url', 'http://localhost:8877');
const OUT = new URL('../../shots/sim/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fails = 0;
const check = (ok, msg) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg); if (!ok) fails++; return ok; };

const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new',
  args: ['--use-angle=metal', '--enable-unsafe-swiftshader', '--window-size=1440,900', '--use-fake-ui-for-media-stream'], defaultViewport: { width: 1440, height: 900 } });
const page = await browser.newPage();
const pageErrors = [];
page.on('pageerror', e => { pageErrors.push(e.message); console.log('  [pageerror]', e.message); });
page.on('console', m => { if (m.type() === 'error' && !/favicon|404/.test(m.text())) console.log('  [console.error]', m.text().slice(0, 240)); });
const ev = (fn, ...a) => page.evaluate(fn, ...a);
const until = async (fn, ms, label) => { const s = Date.now(); while (Date.now() - s < ms) { if (await ev(fn)) return true; await sleep(300); } console.log('  timeout:', label); return false; };
const say = async (text, pointer = null) => ev((t, p) => window.__agora.handle(t, p), text, pointer);
const tidy = async () => { await page.keyboard.press('Escape'); await ev(() => { try { __agora.ui.letters.close(); } catch (_) {} }); await sleep(600); };
const ff = seconds => ev(s => { const g = window.__agora.game; for (let t = 0; t < s; t += 0.5) g.tick(0.5); }, seconds);

try {
  await page.goto(`${BASE}/?intro=none&autostart=1&opening=none`, { waitUntil: 'load' });
  check(await until(() => window.__agora && window.__agora.introDone, 90000, 'intro'), 'booted');
  await sleep(1500);
  await page.keyboard.press('Escape'); await sleep(300);
  await ev(() => { try { __agora.ui.letters.close(); } catch (_) {} });
  await ev(() => {
    const g = __agora.game; window.__rw = { gains: [], milestones: [] };
    g.on('reward:gain', p => __rw.gains.push(p)); g.on('reward:milestone', p => __rw.milestones.push(p));
  });
  check(await ev(() => !!__agora.game.rewards && JSON.stringify(__agora.game.state.areas) === '{"money":0,"happiness":0,"science":0,"civ":0}'), 'game.rewards is wired and the tally starts at zero');

  await say("let's build a house in the middle");
  await sleep(1200); await ff(120); await sleep(2500);
  await tidy(); await page.screenshot({ path: OUT + 'rewards-01-house.png' });
  let rw = await ev(() => __rw);
  check(rw.gains.length === 1 && rw.gains[0].kind === 'house' && rw.gains[0].gains.happiness === 3 && rw.gains[0].gains.civ === 3, `house -> ${JSON.stringify(rw.gains[0] && rw.gains[0].gains)} at (${rw.gains[0] && rw.gains[0].x}, ${rw.gains[0] && rw.gains[0].z})`);

  await say('a farm there', { x: 980, y: 560 });
  await say('a market there', { x: 520, y: 520 });
  await sleep(1200); await ff(150); await sleep(2500);
  await tidy(); await page.screenshot({ path: OUT + 'rewards-02-farm-market.png' });
  rw = await ev(() => __rw);
  const kinds = rw.gains.map(g => g.kind);
  check(kinds.includes('farm') && kinds.includes('market'), `farm + market paid: ${JSON.stringify(rw.gains.map(g => [g.kind, g.gains]))}`);
  const totals = await ev(() => __agora.game.rewards.totals());
  check(totals.money === 7 && totals.happiness === 3 && totals.civ >= 9, `totals ${JSON.stringify(totals)}`);
  const snap = await ev(() => __agora.game.snapshot().areas);
  check(JSON.stringify(snap) === JSON.stringify({ money: totals.money, happiness: totals.happiness, science: totals.science, civ: totals.civ }), 'the snapshot carries the areas');
  console.log('  milestones:', JSON.stringify(rw.milestones.map(m => [m.area, m.at, m.text])));
  console.log('  last gain payload:', JSON.stringify(rw.gains[rw.gains.length - 1]));
  check(pageErrors.length === 0, `no page errors (${pageErrors.length})`);
} catch (e) { console.log('ERROR', e.message); fails++; }
await browser.close();
console.log(fails ? `FAILED (${fails})` : 'ALL PASS');
process.exit(fails ? 1 : 0);
