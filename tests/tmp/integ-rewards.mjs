// rewards on the seaside map: reward:gain stamps + tokens per area, reward:milestone lines, the level-up banner
import puppeteer from 'puppeteer-core';
const arg = (k, d = null) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const BASE = arg('--url', 'http://localhost:8870');
const OUT = '/Users/suedagul/agora/shots/integ/rw-';
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new',
  args: ['--use-angle=metal', '--window-size=1440,900', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'], defaultViewport: { width: 1440, height: 900 } });
const page = await b.newPage();
const errs = [];
page.on('pageerror', e => { errs.push(e.message); console.log('[pageerror]', e.message); });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ev = (fn, ...a) => page.evaluate(fn, ...a);
const until = async (fn, ms = 60000, step = 150, ...a) => { const s = Date.now(); while (Date.now() - s < ms) { if (await ev(fn, ...a).catch(() => false)) return true; await sleep(step); } return false; };
await page.goto(`${BASE}/?intro=none&autostart=1&opening=none&minds=off`, { waitUntil: 'load' });
console.log('landed', await until(() => window.__agora && window.__agora.introDone && window.__agora.stages.surface === 'sea', 90000));
await sleep(2500); await page.keyboard.press('Escape'); await ev(() => { try { __agora.ui.letters.close(); } catch (_) {} });
await sleep(800);
await ev(() => {
  const A = window.__agora; window.__log = [];
  A.game.on('reward:gain', p => __log.push({ ev: 'gain', name: p.name, gains: p.gains, at: [p.x, p.z] }));
  A.game.on('reward:milestone', p => __log.push({ ev: 'milestone', p: { area: p.area, at: p.at, text: p.text, level: p.level } }));
  A.game.on('stage', p => __log.push({ ev: 'stage', stage: p.stage }));
  // what the UI actually shows: every stamp / line / level banner that appears
  const seen = new WeakSet();
  new MutationObserver(() => {
    for (const el of document.querySelectorAll('.ag-rw-stamp, .ag-rw__line, .ag-rw-level, .ag-rw-token')) {
      if (seen.has(el)) continue; seen.add(el);
      if (el.classList.contains('ag-rw-token')) { window.__tokens = (window.__tokens || 0) + 1; continue; }
      const r = el.getBoundingClientRect();
      __log.push({ ev: 'dom', cls: el.className.baseVal || el.className, text: el.innerText.replace(/\s+/g, ' ').trim().slice(0, 80), x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) });
    }
  }).observe(document.body, { childList: true, subtree: true });
});
const say = async (text, pointer = null) => { await ev((t, p) => __agora.handle(t, p), text, pointer); };
const finishNew = async kind => {
  await until(k => __agora.game.state.buildings.some(b => b.kind === k && b.status !== 'done' && !b.__seen), 25000, 150, kind);
  return ev(k => { const b = __agora.game.state.buildings.find(b => b.kind === k && b.status !== 'done' && !b.__seen); b.__seen = true; const s = __agora.world.project(b.x, null, b.z); setTimeout(() => __agora.game.completeBuilding(b), 1500); return { id: b.id, x: b.x, z: b.z, screen: s && { x: Math.round(s.x), y: Math.round(s.y) } }; }, kind);
};
const steps = [['build a house in the middle', 'house'], ['a market near the house', 'market'], ['build a library', 'library'], ['a house there', 'house', { x: 560, y: 560 }], ['another house', 'house'], ['a house by the lake', 'house']];
let i = 0;
for (const [text, kind, ptr] of steps) {
  i++;
  await say(text, ptr || null);
  const site = await finishNew(kind);
  console.log('site', kind, JSON.stringify(site));
  const n0 = await ev(() => __log.filter(l => l.ev === 'gain').length);
  await until(n => __log.filter(l => l.ev === 'gain').length > n, 30000, 100, n0);
  await sleep(380); await page.screenshot({ path: `${OUT}${i}-${kind}-stamp.png` });
  await sleep(900); await page.screenshot({ path: `${OUT}${i}-${kind}-tokens.png` });
  await sleep(2600);
}
await sleep(4000); await page.screenshot({ path: `${OUT}end.png` });
const log = await ev(() => __log);
for (const l of log) console.log(JSON.stringify(l));
console.log('tokens seen', await ev(() => window.__tokens || 0));
console.log('tally', await ev(() => __agora.rewards.el.innerText.replace(/\s+/g, ' ')), JSON.stringify(await ev(() => __agora.game.rewards.totals())));
console.log('errors', JSON.stringify(await ev(() => __agora.errors)), errs.length);
await b.close();
