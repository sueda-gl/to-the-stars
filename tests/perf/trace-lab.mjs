// Ad-hoc trace of the lab's scheduling: every 500 ms, the state, each world's throttle and real frame count, and the
// bridge loop. node tests/perf/trace-lab.mjs [--url http://localhost:8897] [--home]
import { open, sleep } from './lib.mjs';
const arg = (k, d = null) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const BASE = arg('--url', 'http://localhost:8897'), HOME = process.argv.includes('--home');
const { b, p } = await open(BASE + '/act3-lab.html?shot=1', { log: true });
await p.waitForFunction(() => window.__lab && window.__planet, { timeout: 60000 });
await p.evaluate(() => window.__planet.ready);
await p.evaluate(() => window.__lab.bridge.ready());
await sleep(2500);
const probe = () => p.evaluate(() => {
  const L = window.__lab, g = w => (w && w.__agoraGate) ? w.__agoraGate.frames : null;
  const pw = L.plisse && L.plisse.window, lw = L.lounge && L.lounge.window;
  const pf = pw ? (pw.__perf ? pw.__perf.P.draws : 0) : null, lf = lw ? (lw.__perf ? lw.__perf.P.draws : 0) : null;
  const B = L.bridge.isReady() ? L.bridge.state() : {};
  return { s: L.state, held: L.held, pT: L.plisse && L.plisse.throttled, lT: L.lounge && L.lounge.throttled, pGate: g(pw), lGate: g(lw), pDraws: pf, lDraws: lf, bT: +B.t.toFixed(1), bLoop: B.looping, bFrames: B.frames, bo: L.bridge.el.style.opacity, po: document.getElementById('plisse') && document.getElementById('plisse').style.opacity };
});
let last = await probe();
const line = (c, l) => `${String(c.s).padEnd(10)} plisse thr=${c.pT} sz=${c.held.plisseSize} gate=${c.pGate - (l.pGate || 0)} draws=${c.pDraws - (l.pDraws || 0)} op=${c.po} | lounge thr=${c.lT} sz=${c.held.loungeSize} gate=${c.lGate - (l.lGate || 0)} draws=${c.lDraws - (l.lDraws || 0)} | bridge t=${c.bT} loop=${c.bLoop} frames=${c.bFrames - (l.bFrames || 0)} op=${c.bo}`;
await p.evaluate(() => { window.__lab.playLanding(); });
for (let i = 0; i < 60; i++) { await sleep(500); const c = await probe(); console.log((i / 2).toFixed(1).padStart(5), line(c, last)); last = c; if (c.s === 'lounge' && i > 4) break; }
if (HOME) {
  await sleep(1000);
  await p.evaluate(() => { window.__lab.backHome(); });
  for (let i = 0; i < 70; i++) { await sleep(500); const c = await probe(); console.log('H' + (i / 2).toFixed(1).padStart(4), line(c, last)); last = c; if (c.s === 'earth' && i > 4) break; }
}
await b.close();
