// The landing / lift shot, recorded: a CDP screencast of the page at dpr 2 across the descent (Begin -> landing view),
// the lift (stages.showGlobe: up through the cloud to her orbit) and the way home (homeFromGlobe: down to the leader view).
// Frames land in shots/handoff/<tag>/<leg>/f-<ms>.jpg with a timeline (frame times, the swap moment, rAF gaps).
//   node tests/handoff/record.mjs --port 8883 --tag run1 [--legs down,up,home]
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
const arg = (k, d = null) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const PORT = arg('--port', '8883'), TAG = arg('--tag', 'run'), LEGS = arg('--legs', 'down,up,home').split(','), DPR = +arg('--dpr', '2');
const W = +arg('--w', '1440'), H = +arg('--h', '900'), NOSHOT = process.argv.includes('--noshot');
const URL = `http://localhost:${PORT}/?minds=mock&opening=auto`;
const ROOT = `/Users/suedagul/agora/shots/handoff/${TAG}`;
fs.mkdirSync(ROOT, { recursive: true });
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new',
  args: ['--use-angle=metal', `--window-size=${W},${H}`, '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'],
  defaultViewport: { width: W, height: H, deviceScaleFactor: DPR } });
const page = await b.newPage();
page.on('pageerror', e => console.log('[pageerror]', e.message));
page.on('console', m => { const t = m.text(); if (m.type() === 'error' && !/favicon|404/.test(t)) console.log('[console.error]', t.slice(0, 300)); });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ev = (fn, ...a) => page.evaluate(fn, ...a);
const until = async (fn, ms = 60000, step = 100) => { const s = Date.now(); while (Date.now() - s < ms) { if (await ev(fn).catch(() => false)) return true; await sleep(step); } return false; };
await page.goto(URL, { waitUntil: 'load' });
await until(() => window.__agora && document.querySelector('.tt') && !document.querySelector('.tt').hidden, 120000, 300);
await sleep(2500);
// in-page timeline: rAF gaps, the stage steps, the swap
await ev(() => {
  const L = window.__hl = { t0: performance.now(), raf: [], marks: [] };
  let last = performance.now();
  const f = now => { L.raf.push([now - L.t0, now - last]); last = now; requestAnimationFrame(f); };
  requestAnimationFrame(f);
  const S = window.__agora.stages; let prevStep = null, prevSurf = S.surface, prevMove = null;
  setInterval(() => {
    const st = S.step, sf = S.surface, mv = JSON.stringify(S.handoffMove);
    if (st !== prevStep) { L.marks.push([performance.now() - L.t0, 'step', st]); prevStep = st; }
    if (sf !== prevSurf) { L.marks.push([performance.now() - L.t0, 'surface', sf]); prevSurf = sf; }
    if (mv !== prevMove) { L.marks.push([performance.now() - L.t0, 'move', mv]); prevMove = mv; }
  }, 4);
});
const cdp = await page.createCDPSession();
let leg = null, frames = [];
cdp.on('Page.screencastFrame', async f => {
  try { await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }); } catch (_) {}
  if (!leg) return;
  frames.push({ ts: f.metadata.timestamp, data: f.data });
});
async function record(name, start, done, tail = 1200) {
  frames = []; leg = name;
  const hl0 = await ev(() => performance.now() - window.__hl.t0);
  if (!NOSHOT) await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 85, maxWidth: W * DPR, maxHeight: H * DPR, everyNthFrame: 1 });
  await sleep(300);
  const wall0 = Date.now() / 1000;
  await start();
  await until(done, 60000, 50);
  await sleep(tail);
  if (!NOSHOT) await cdp.send('Page.stopScreencast');
  leg = null;
  const dir = `${ROOT}/${name}`; fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  const t0 = frames.length ? frames[0].ts : 0;
  const idx = frames.map((f, i) => { const ms = Math.round((f.ts - t0) * 1000); const fn = `f-${String(ms).padStart(6, '0')}.jpg`; fs.writeFileSync(`${dir}/${fn}`, Buffer.from(f.data, 'base64')); return { ms, fn, ts: f.ts }; });
  const tl = await ev(h => ({ marks: window.__hl.marks.filter(m => m[0] >= h), raf: window.__hl.raf.filter(r => r[0] >= h) }), hl0);
  fs.writeFileSync(`${dir}/timeline.json`, JSON.stringify({ name, frames: idx, startWall: wall0, firstFrameTs: t0, hl0, ...tl }, null, 1));
  const gaps = tl.raf.map(r => r[1]); gaps.sort((a, b) => b - a);
  const mv0 = (tl.marks.find(m => m[1] === 'move' && m[2] && m[2] !== 'null') || [hl0])[0];
  { const mvEnd = (tl.marks.filter(m => m[1] === 'move' && m[2] === 'null').pop() || [Infinity])[0]; const g = tl.raf.filter(r => r[0] >= mv0 && r[0] <= mvEnd).map(r => r[1]).sort((a, b) => a - b); const q = k => g.length ? g[Math.min(g.length - 1, Math.floor(g.length * k))].toFixed(1) : '-'; console.log(name, 'frame ms during the move: p50', q(0.5), 'p90', q(0.9), 'p99', q(0.99), 'max', q(1), 'n', g.length); }
  console.log(name, 'gaps>40ms (s from move start):', tl.raf.filter(r => r[1] > 40).map(r => ((r[0] - mv0) / 1000).toFixed(2) + ':' + r[1].toFixed(0)).join(' '));
  console.log(name, 'frames', idx.length, 'span', idx.length ? idx[idx.length - 1].ms : 0, 'ms; worst rAF gaps', gaps.slice(0, 6).map(x => x.toFixed(0)).join(' '), '; marks', JSON.stringify(tl.marks.map(m => [Math.round(m[0] - hl0), m[1], m[2]])));
}
if (process.argv.includes('--noclouds')) await ev(() => { window.__agora.stages.clouds.draw = () => 0; });
if (LEGS.includes('down')) {
  await record('down', () => page.click('.tt__begin'), () => window.__agora.introDone === true, 1500);
  await until(() => window.__agora.opening && window.__agora.opening.phase === 'done', 150000, 500);
  try { await ev(() => window.__agora.ui.letters.close()); } catch (e) {}
  await sleep(1500);
}
if (LEGS.includes('up')) {
  await record('up', () => { ev(() => { window.__upDone = false; window.__agora.stages.showGlobe().then(() => { window.__upDone = true; }); }); }, () => window.__upDone === true, 500);
}
if (LEGS.includes('home')) {
  await record('home', () => { ev(() => { window.__homeDone = false; window.__agora.stages.homeFromGlobe().then(() => { window.__homeDone = true; }); }); }, () => window.__homeDone === true, 1200);
}
console.log('errors', JSON.stringify(await ev(() => window.__agora.errors.slice(0, 5))));
await b.close();
