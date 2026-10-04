// Frame strips of the rewards animation in web/rewards-lab.html (or the game with --game). Usage:
//   node tests/rewards/strip.mjs [--url http://localhost:8884] [--case bakery|levelup|milestone] [--every 110] [--n 24] [--clip x,y,w,h]
import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'node:fs';
const arg = (k, d = null) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const BASE = arg('--url', 'http://localhost:8884'), CASE = arg('--case', 'bakery'), EVERY = +arg('--every', 110), N = +arg('--n', 24);
const clipA = arg('--clip'); const clip = clipA ? (([x, y, width, height]) => ({ x, y, width, height }))(clipA.split(',').map(Number)) : null;
const OUT = '/Users/suedagul/agora/shots/rewards/' + CASE + '/'; mkdirSync(OUT, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new',
  args: ['--use-angle=metal', '--window-size=1440,900'], defaultViewport: { width: 1440, height: 900 } });
const page = await browser.newPage();
page.on('pageerror', e => console.log('[pageerror]', e.message));
page.on('console', m => { if (m.type() === 'error') console.log('[console]', m.text()); });
await page.goto(`${BASE}/rewards-lab.html?clean=1&slow=${arg('--slow', 1)}`, { waitUntil: 'networkidle0' });
await page.evaluate(() => document.fonts.ready); await sleep(500);
const pre = arg('--pre');
if (pre) { for (const k of pre.split(',')) { await page.evaluate(k => __rw.make(k), k); await sleep(3800 * +arg('--slow', 1)); } }
// a CDP screencast catches real frames at the page's own cadence; we keep N evenly spaced over --dur ms
const DUR = +arg('--dur', 4000);
const cdp = await page.createCDPSession(); const frames = [];
cdp.on('Page.screencastFrame', f => { frames.push({ t: f.metadata.timestamp, data: f.data }); cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {}); });
await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 88, everyNthFrame: 1 });
await sleep(150);
await page.evaluate(c => { if (c === 'levelup') __rw.levelUp(); else if (c === 'milestone') __rw.bus.emit('reward:milestone', { area: 'happiness', text: 'Happiness 10: the folk are singing at dusk' }); else __rw.make(c); }, CASE);
await sleep(DUR);
await cdp.send('Page.stopScreencast');
const { writeFileSync } = await import('node:fs');
const fs0 = frames[0].t, dur = (frames[frames.length - 1].t - fs0);
console.log(frames.length, 'frames over', dur.toFixed(2), 's');
for (let i = 0; i < N; i++) { const want = fs0 + dur * i / (N - 1); let best = frames[0]; for (const f of frames) if (Math.abs(f.t - want) < Math.abs(best.t - want)) best = f;
  writeFileSync(OUT + String(i).padStart(2, '0') + '.png', Buffer.from(best.data, 'base64')); }
await browser.close();
console.log(OUT);
