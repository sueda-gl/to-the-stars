import puppeteer from 'puppeteer-core';
const SP='/private/tmp/claude-501/-Users-suedagul/f5dd2fe2-22fa-4957-b312-c2b4a64dcefd/scratchpad';
const W = +(process.argv[2]||1440), H = +(process.argv[3]||900);
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=metal','--ignore-gpu-blocklist'] });
const p = await browser.newPage(); await p.setViewport({ width: W, height: H });
p.on('pageerror', e => console.log('ERR', String(e).slice(0,200)));
await p.goto('http://localhost:8897/?intro=none&opening=auto&minds=mock', { waitUntil: 'domcontentloaded' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
await sleep(6000);
await p.evaluate(() => { const b=[...document.querySelectorAll('button')].find(b=>/Begin/.test(b.textContent)); b && b.click(); });
for (let i=0;i<40;i++){ await sleep(3000); const s = await p.evaluate(()=>({n:__agora.ui.letters.all.length, ph: __agora.opening && __agora.opening.phase, pins: document.querySelectorAll('.agt:not(.off)').length})); console.log(i, JSON.stringify(s)); if (s.n>=2 && s.pins) break; }
await p.screenshot({ path: SP + '/flow-1.png' });
const r = await p.evaluate(() => { const t = document.querySelector('.agt:not(.off) .agt-b'); if (!t) return null; const b=t.getBoundingClientRect(); return [b.x+b.width/2,b.y+b.height/2]; });
console.log('tag', r);
if (r) { await p.mouse.click(r[0], r[1]); await sleep(1500); }
const info = await p.evaluate(() => { const q = s => { const e=document.querySelector(s); if(!e) return null; const b=e.getBoundingClientRect(); return [Math.round(b.x),Math.round(b.y),Math.round(b.width),Math.round(b.height)]; }; return { cls: document.querySelector('.ag-ui').className, so: getComputedStyle(document.querySelector('.ag-stack')).opacity, mo: getComputedStyle(document.querySelector('.ag-mailcol')||document.body).opacity, sh: document.querySelector('.ag-stack').hidden, mailcol: q('.ag-mailcol'), read: q('.ag-read .ag-letter'), stack: q('.ag-stack'), card: q('.ag-card') }; });
console.log(JSON.stringify(info));
await p.screenshot({ path: SP + '/flow-2.png' });
await p.evaluate(async () => { const ui = __agora.ui; ui.letters.closeCompact && ui.notify.column.close(true);
  const ids = __agora.game.state.agents.slice(0, 3).map(a => a.id);
  ui.pick.show({ title: 'Who joins the Police Patrol?', kicker: 'A new institution', hint: 'click folk, then Done', min: 1, max: 6 });
  await new Promise(r => setTimeout(r, 400)); ui.pick.update(ids); ui.pick.hover(__agora.game.state.agents[4]); });
await sleep(1500);
await p.screenshot({ path: SP + '/flow-3.png' });
const errs = await p.evaluate(() => (__agora.errors || []).slice(-5));
console.log('errors', JSON.stringify(errs));
await browser.close();
