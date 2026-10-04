// The rewards in THE game: build things, catch reward:gain, screencast the stamp + tokens flying into the tally.
// node tests/rewards/game.mjs [--url http://localhost:8884]
import puppeteer from 'puppeteer-core';
import { mkdirSync, writeFileSync } from 'node:fs';
const arg = (k, d = null) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const BASE = arg('--url', 'http://localhost:8884');
const OUT = '/Users/suedagul/agora/shots/rewards/game/'; mkdirSync(OUT, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new',
  args: ['--use-angle=metal', '--window-size=1440,900'], defaultViewport: { width: 1440, height: 900 } });
const page = await browser.newPage();
const errs = [];
page.on('pageerror', e => { errs.push(e.message); console.log('[pageerror]', e.message); });
const ev = (fn, ...a) => page.evaluate(fn, ...a);
const until = async (fn, ms) => { const s = Date.now(); while (Date.now() - s < ms) { if (await ev(fn).catch(() => false)) return true; await sleep(300); } return false; };
await page.goto(`${BASE}/?intro=none&autostart=1&opening=auto&minds=off&speed=1`, { waitUntil: 'load' });
console.log('intro', await until(() => window.__agora && window.__agora.introDone, 90000));
console.log('opening', await until(() => __agora.opening && __agora.opening.phase === 'done', 120000));
await sleep(1500); await page.keyboard.press('Escape'); await ev(() => { try { __agora.ui.letters.close(); } catch (_) {} }); await sleep(600);
await ev(() => { window.__gains = []; __agora.game.on('reward:gain', p => __gains.push({ t: performance.now(), p })); __agora.game.on('reward:milestone', p => __gains.push({ t: performance.now(), m: p })); });
const cdp = await page.createCDPSession(); const frames = [];
cdp.on('Page.screencastFrame', f => { frames.push({ t: f.metadata.timestamp, data: f.data }); cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {}); });
await ev(() => __agora.handle('build a house in the middle', null));
await ev(() => __agora.handle('a bakery there', { x: 820, y: 520 }));
// fast-forward the build: wait for the first reward
const ok = await until(() => window.__gains.length > 0, 120000);
console.log('gain arrived', ok, JSON.stringify(await ev(() => __gains.map(g => g.p ? { gains: g.p.gains, name: g.p.name, totals: g.p.totals } : { m: g.m }))));
await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 88 });
await sleep(4200);
await cdp.send('Page.stopScreencast');
const t0 = frames[0].t, dur = frames[frames.length - 1].t - t0; console.log(frames.length, 'frames', dur.toFixed(2));
const N = 12;
for (let i = 0; i < N; i++) { const want = t0 + dur * i / (N - 1); let b = frames[0]; for (const f of frames) if (Math.abs(f.t - want) < Math.abs(b.t - want)) b = f; writeFileSync(OUT + String(i).padStart(2, '0') + '.png', Buffer.from(b.data, 'base64')); }
await until(() => window.__gains.length > 1, 90000); await sleep(4500); await page.screenshot({ path: OUT + "after.png" }); await sleep(6000);
await page.screenshot({ path: OUT + 'after2.png' });
console.log('tally', await ev(() => __agora.rewards && __agora.rewards.el.innerText.replace(/\s+/g, ' ')), 'totals', JSON.stringify(await ev(() => __agora.game.rewards.totals())));
console.log('errors', JSON.stringify(await ev(() => __agora.errors)), errs.length);
await browser.close();
