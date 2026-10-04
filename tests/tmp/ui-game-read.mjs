import puppeteer from 'puppeteer-core';
const SP='/private/tmp/claude-501/-Users-suedagul/f5dd2fe2-22fa-4957-b312-c2b4a64dcefd/scratchpad';
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=metal','--enable-webgl','--ignore-gpu-blocklist'] });
const p = await browser.newPage(); await p.setViewport({ width: 1440, height: 900 });
p.on('pageerror', e => console.log('ERR', String(e).slice(0,200)));
await p.goto('http://localhost:8897/?intro=none&opening=none&minds=mock', { waitUntil: 'domcontentloaded' });
await new Promise(r => setTimeout(r, 15000));
const info = await p.evaluate(async () => {
  const A = window.__agora; const ui = A.ui;
  const ag = A.game.state.agents[0];
  ui.letters.addLetter({ id: 'T1', from: { kind: 'agent', id: ag.id, name: ag.name }, subject: 'On the matter of bread', body: 'Dear founder,\n\nThe ovens are cold and the folk are hungry. Could we build a bakery by the lake?\n\n— ' + ag.name, day: 2, options: [{label:'yes', says:'yes, build it'}, {label:'no', says:'not now'}] });
  ui.letters.addLetter({ id: 'T2', from: { kind: 'ministry', id: 'builds', name: 'the Ministry of Builds' }, subject: 'A lighthouse', body: 'The lighthouse stands.\n\n— the Ministry of Builds', day: 2 });
  await new Promise(r => setTimeout(r, 800));
  ui.letters.openCompact('T1');
  await new Promise(r => setTimeout(r, 1500));
  const el = document.querySelector('.ag-mailcol'); const r = el && el.getBoundingClientRect();
  const chain = []; let e = el; while (e) { const cs = getComputedStyle(e); chain.push([e.tagName + '.' + e.className, cs.position, cs.transform, cs.top, cs.right, cs.left]); e = e.parentElement; }
  return { r: r && [r.x, r.y, r.width, r.height], chain, keys: Object.keys(A) };
});
console.log(JSON.stringify(info, null, 1));
await p.screenshot({ path: SP + '/game-read.png' });
await browser.close();
