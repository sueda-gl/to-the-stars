// The pick prompt (ui.pick: choose some folk, e.g. "Who joins the Police Patrol?") and the inbox pinned top-right
// under the stack (2026-10-04, Sueda's screenshot: the pane floated without its stack and "the Ministry of / Builds" wrapped).
//   ~/.nvm/versions/node/v22.22.3/bin/node tests/ui/pick.mjs
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const freePort = () => new Promise(res => { const s = createServer(); s.listen(0, () => { const p = s.address().port; s.close(() => res(p)); }); });
const port = await freePort();
const server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: path.join(ROOT, 'web'), stdio: 'ignore' });
const base = `http://127.0.0.1:${port}`;
for (let i = 0; i < 50; i++) { try { await fetch(base + '/'); break; } catch { await new Promise(r => setTimeout(r, 100)); } }
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--hide-scrollbars'] });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const results = []; const check = (name, ok, got) => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok ? '' : '  got ' + JSON.stringify(got)}`); };
const errors = [];
const PX = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="#8fc46a"/></svg>');

async function page(w = 1440, h = 900) {
  const p = await browser.newPage(); await p.setViewport({ width: w, height: h });
  p.on('pageerror', e => errors.push(String(e)));
  await p.goto(`${base}/ui-lab.html?state=none&font=G`, { waitUntil: 'networkidle0' });
  await p.evaluate(async PX => {
    window.ui && window.ui.destroy();
    const { createUI } = await import('./js/ui/ui.js');
    const A = { a1: { id: 'a1', name: 'Olla', species: 'floatie', trade: 'diplomat' }, a2: { id: 'a2', name: 'Brusk', species: 'flit', trade: 'builder' }, a3: { id: 'a3', name: 'Pell', species: 'flit', trade: 'scout' } };
    window.calls = [];
    window.ui = createUI({ font: 'G', getPortrait: id => A[id] ? PX : null, lookup: { agent: id => A[id] || null } });
    document.querySelector('.lab-pins')?.remove();
  }, PX);
  return p;
}
const box = (p, sel) => p.evaluate(s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, r: r.right, b: r.bottom }; }, sel);

// ---------- the pick prompt ----------
let p = await page();
await p.evaluate(() => ui.pick.show({ title: 'Who joins the Police Patrol?', hint: 'click folk, then Done', min: 1, max: 6,
  onDone: (ids, agents) => calls.push(['done', ids, agents.map(a => a.name)]), onCancel: () => calls.push(['cancel']), onRemove: id => calls.push(['remove', id]) }));
await sleep(400);
let b = await box(p, '.ag-pick');
check('pick.show: a compact card at the top centre (≤ 440 px wide, top ≤ 60 px, centred)', b && b.w <= 441 && b.y <= 60 && Math.abs(b.x + b.w / 2 - 720) < 4, b);
check('the title, the hint and "0 of 6 chosen"; Done is disabled until min', await p.evaluate(() => { const e = document.querySelector('.ag-pick'); return /Who joins the Police Patrol\?/.test(e.textContent) && /click folk, then Done/.test(e.textContent) && /0 of 6 chosen/.test(e.textContent) && document.querySelector('.ag-pick__done').disabled; }));
check('ui.pick.active; clicks pass through the layer to the world (the layer has no pointer events)', await p.evaluate(() => ui.pick.active && getComputedStyle(ui.el).pointerEvents === 'none'));
await p.evaluate(() => ui.pick.update(['a1', 'a2'])); await sleep(500);
check('update([ids]): each chosen folk\'s painted portrait + name appears; "2 of 6 chosen"; Done enabled', await p.evaluate(() => { const c = [...document.querySelectorAll('.ag-pick__chip')]; return c.length === 2 && c.every(x => x.querySelector('.ag-face img')) && /Olla/.test(c[0].textContent) && /Brusk/.test(c[1].textContent) && /2 of 6 chosen/.test(document.querySelector('.ag-pick__count').textContent) && !document.querySelector('.ag-pick__done').disabled; }));
check('one empty "next" slot waits after the chosen ones', await p.evaluate(() => document.querySelectorAll('.ag-pick__slot.is-next').length === 1));
await p.evaluate(() => ui.pick.update([{ id: 'a1' }, 'a2', 'a3'])); await sleep(300);
check('only the newly added folk pops in (is-new); objects or ids both work', await p.evaluate(() => { const c = [...document.querySelectorAll('.ag-pick__chip')]; return c.length === 3 && c.filter(x => x.classList.contains('is-new')).length === 1 && c[2].dataset.id === 'a3'; }));
await p.evaluate(() => ui.pick.hover('a3')); await sleep(100);
check('hover(agent) names the folk under the cursor (and says "chosen")', await p.evaluate(() => /Pell/.test(document.querySelector('.ag-pick__who').textContent) && /chosen/.test(document.querySelector('.ag-pick__who').textContent) && !/null/.test(document.querySelector('.ag-pick__who').textContent)));
await p.click('.ag-pick__chip[data-id="a2"]');
check('a click on a chosen portrait -> onRemove(id)', (await p.evaluate(() => calls.splice(0))).some(c => c[0] === 'remove' && c[1] === 'a2'));
const nid = await p.evaluate(() => ui.notice('A quarrel by the well.', { ttl: 0 })); await sleep(300);
const nb = await box(p, '.ag-notice'), pb = await box(p, '.ag-pick');
check('a notice steps down under the card (both live at the top centre)', nb && pb && nb.y >= pb.b - 1, { nb, pb });
await p.keyboard.press('Enter'); await sleep(400);
let c = await p.evaluate(() => calls.splice(0));
check('Enter = Done -> onDone(ids, agents); the card goes', c.length === 1 && c[0][0] === 'done' && c[0][1].join() === 'a1,a2,a3' && c[0][2].join() === 'Olla,Brusk,Pell' && !(await p.evaluate(() => ui.pick.active)), c);
check('no typed line opened by that Enter', await p.evaluate(() => !ui.voiceBar.typingOpen));
await p.evaluate(() => ui.pick.show({ title: 'Who rows the boat?', min: 2, max: 3, onDone: () => { calls.push(['done2']); return false; }, onCancel: () => calls.push(['cancel2']) })); await sleep(300);
await p.evaluate(() => ui.pick.update(['a1'])); await sleep(100);
check('min 2: one chosen keeps Done disabled', await p.evaluate(() => document.querySelector('.ag-pick__done').disabled && /1 of 3 chosen/.test(document.querySelector('.ag-pick__count').textContent)));
await p.evaluate(() => ui.pick.update(['a1', 'a2', 'a3'])); await sleep(100);
check('max reached: no empty slots left', await p.evaluate(() => document.querySelectorAll('.ag-pick__slot').length === 0));
await p.click('.ag-pick__done'); await sleep(200);
check('onDone returning false keeps the card open', await p.evaluate(() => ui.pick.active && calls.splice(0).some(c => c[0] === 'done2')));
await p.keyboard.press('Escape'); await sleep(400);
check('Esc = cancel -> onCancel(); the card goes', await p.evaluate(() => !ui.pick.active && calls.splice(0).some(c => c[0] === 'cancel2')));
await p.evaluate(() => ui.pick.show({ title: 'X', count: (n, o) => `${n} aboard (need ${o.min})`, min: 1 })); await sleep(100);
check('count as a function words the counter', await p.evaluate(() => /0 aboard \(need 1\)/.test(document.querySelector('.ag-pick__count').textContent)));
await p.click('.ag-pick__cancel'); await sleep(400);
check('cancel link hides it', await p.evaluate(() => !ui.pick.active && !document.querySelector('.ag-pick:not(.is-out)')));
await p.close();

// ---------- phone ----------
p = await page(390, 844);
await p.evaluate(() => { ui.letters.addLetter({ id: 'x', from: { kind: 'agent', id: 'a1', name: 'Olla' }, subject: 's', body: 'b' }, { silent: true });
  ui.pick.show({ title: 'Who joins the Police Patrol?', hint: 'click folk, then Done', min: 1, max: 6 }); ui.pick.update(['a1', 'a2', 'a3']); });
await sleep(500);
b = await box(p, '.ag-pick'); const sb = await box(p, '.ag-stack');
check('phone: the card sits under the stack, inside the gutters', b && b.x >= 12 && b.r <= 378 && b.y >= sb.b - 30, { b, sb });
await p.close();

// ---------- the inbox pinned top-right, under the stack ----------
for (const [w, h] of [[1440, 900], [390, 844]]) {
  p = await page(w, h);
  await p.evaluate(() => {
    ui.ministerSeal.set({ id: 'a1', name: 'Olla', species: 'floatie' }, { quiet: true });
    ui.letters.addLetter({ id: 'm1', from: { kind: 'ministry', id: 'builds', name: 'Ministry of Builds' }, kind: 'ministry', subject: 'How things stand', day: 3,
      body: 'Founder,\n\n12 of us, 31 food in the crates. No site open. Zita & Olla do not get on; keep an eye on it. My advice: a house for the ones outside.\n\n— the Ministry of Builds' }, { silent: true });
    ui.letters.addLetter({ id: 'f1', from: { kind: 'agent', id: 'a2', name: 'Brusk' }, subject: 'A crate too many', day: 3, body: 'Founder,\n\nMy back.\n\n— Brusk' }, { silent: true });
    ui.cinema(true);                       // the opening's frame, as in Sueda's screenshot
    ui.letters.openCompact('m1');
  });
  await sleep(700);
  const m = await box(p, '.ag-mailcol'), s = await box(p, '.ag-stack'), ch = await box(p, '.ag-stack__more');
  const tag = w < 600 ? 'phone' : 'desktop';
  // §24: the open mailbox takes the icon's own place top-right (the icon hides); no chevron
  check(`${tag}: the pane sits in the mailbox's place top-right, right-aligned with it (≤ 404 px)`, m && m.y < 40 && Math.abs(m.r - s.r) < 16 && m.w <= 404, { m, s, ch });
  check(`${tag}: in a cinema frame the open inbox stays visible, the mailbox icon hides`, await p.evaluate(() => getComputedStyle(document.querySelector('.ag-stack')).opacity === '0' && getComputedStyle(document.querySelector('.ag-mailcol')).opacity === '1'));
  check(`${tag}: the pane never reaches past 70vh of height and stays on screen`, m.h <= h * .7 + 30 && m.b <= h, m);
  check(`${tag}: the signature "the Ministry of Builds" is one line`, await p.evaluate(() => { const nm = document.querySelector('.ag-mread__sign .nm'); const r = nm.getBoundingClientRect(); const lh = parseFloat(getComputedStyle(nm).lineHeight) || parseFloat(getComputedStyle(nm).fontSize) * 1.25; return /Ministry of Builds/.test(nm.textContent) && r.height < lh * 1.6 && nm.scrollWidth <= nm.parentElement.clientWidth + 1; }));
  check(`${tag}: a Ministry letter keeps its seal, with the minister's portrait beside it`, await p.evaluate(() => !!document.querySelector('.ag-mread__seal .ag-cameo:not(.has-portrait) svg') && !!document.querySelector('.ag-mread__seal .ag-face.has-portrait img') && /sent by Olla, your minister/.test(document.querySelector('.ag-mread__line').textContent)));
  await p.evaluate(() => ui.letters.openCompact('f1')); await sleep(400);
  check(`${tag}: a folk's letter shows the sender's painted portrait in the header`, await p.evaluate(() => !!document.querySelector('.ag-mread__head .ag-cameo.has-portrait img') && !document.querySelector('.ag-mread__seal .ag-face.has-portrait')));
  await p.evaluate(() => { ui.cinema(false); ui.titleCard.show({ title: 'Agora' }); }); await sleep(500);
  check(`${tag}: under the title card the inbox is hidden (the unfold no longer pins its opacity)`, await p.evaluate(() => getComputedStyle(document.querySelector('.ag-mailcol')).opacity === '0'));
  await p.close();
}

await browser.close(); server.kill();
if (errors.length) { console.log('page errors:', errors); results.push(false); }
const bad = results.filter(r => !r).length;
console.log(bad ? `\n${bad} FAIL of ${results.length}` : `\nALL ${results.length} PASS`);
process.exit(bad ? 1 : 0);
