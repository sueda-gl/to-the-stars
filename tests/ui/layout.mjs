// Layout regression test for the UI (ui-lab.html presets) at 1440x900 and 390x844: the clutter budget at rest,
// hit-testing (elementFromPoint), overlaps between our pieces, on-screen checks, no horizontal scroll.
//   ~/.nvm/versions/node/v22.22.3/bin/node tests/ui/layout.mjs
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

async function open(state, w, h, wait = 1600) {
  const page = await browser.newPage(); await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
  page.on('pageerror', e => errors.push(`${state}@${w}: ${e}`));
  page.on('console', m => { if (m.type() === 'error') errors.push(`${state}@${w}: ${m.text()}`); });
  await page.goto(`${base}/ui-lab.html?state=${state}`, { waitUntil: 'networkidle0' });
  await page.evaluate(() => document.fonts.ready); await sleep(wait);
  await page.evaluate(() => {
    window.vis = el => { if (!el) return false; let e = el; while (e && e !== document.body) { const s = getComputedStyle(e); if (e.hidden || s.display === 'none' || s.visibility === 'hidden' || +s.opacity < .05) return false; e = e.parentElement; } const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    window.hit = el => { if (!el) return 'missing'; if (!vis(el)) return 'invisible'; const r = el.getBoundingClientRect(); const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return el.contains(t) ? 'ok' : 'covered by ' + ((t && (t.closest('.ag-paper') || t).className) || t); };
    window.ov = (a, b) => { if (!a || !b || !vis(a) || !vis(b)) return 0; const A = a.getBoundingClientRect(), B = b.getBoundingClientRect(); return Math.round(Math.max(0, Math.min(A.right, B.right) - Math.max(A.left, B.left)) * Math.max(0, Math.min(A.bottom, B.bottom) - Math.max(A.top, B.top))); };
    window.onScreen = el => { const r = el.getBoundingClientRect(); return r.left >= -1 && r.top >= -1 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1; };
    window.$ = s => document.querySelector(s);
  });
  return page;
}

for (const [W, H, tag] of [[1440, 900, 'desktop'], [390, 844, 'phone']]) {
  let p;
  // 1. rest: only the name, the stack and the voice mark; a tiny clutter budget; no overlaps; all clickable
  p = await open('rest', W, H);
  const rest = await p.evaluate(() => {
    const shown = [...document.querySelectorAll('.ag-ui > *')].filter(vis).map(e => e.className.split(' ')[0]).filter(c => c !== 'ag-notices' || document.querySelector('.ag-notice'));
    // §24: no settlement name top-left, no chevron: the mailbox and the voice mark
    const parts = ['.ag-stack', '.ag-mark'].map(s => $(s));
    const area = ['.ag-stack', '.ag-voice__mark'].map(s => { const r = $(s).getBoundingClientRect(); return r.width * r.height; }).reduce((a, b) => a + b, 0);
    return { shown, hits: parts.map(hit), on: parts.map(onScreen), pct: +(area / (innerWidth * innerHeight) * 100).toFixed(2),
      ov: [ov(parts[0], parts[1])], chrome: [...document.querySelectorAll('.editions, .closeup, .tweaks-toggle')].filter(vis).length, name: vis($('.ag-place')), chev: vis($('.ag-stack__more')) };
  });
  check(`${tag} rest: only the mailbox and the voice mark are on screen (no name, no chevron: §24)`, rest.shown.every(c => ['ag-stack', 'ag-voice'].includes(c)) && rest.shown.length === 2 && !rest.name && !rest.chev, rest);
  check(`${tag} rest: clutter budget, UI covers < ${W > 600 ? 2 : 6}% of the screen`, rest.pct < (W > 600 ? 2 : 6), rest.pct);
  check(`${tag} rest: both clickable, on screen, apart`, rest.hits.every(h => h === 'ok') && rest.on.every(Boolean) && rest.ov.every(v => v === 0), rest);
  check(`${tag} rest: no paint chrome (editions / Gouache settings / Up close)`, rest.chrome === 0, rest.chrome);
  check(`${tag} no horizontal scroll`, await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), null);
  await p.close();

  // 2. reading a letter (A and B): the letter is on screen, replies + fold + next are clickable, the voice mark too
  for (const v of ['a', 'b']) {
    p = await open('letter&letter=' + v, W, H, 3400);
    const lt = await p.evaluate(() => {
      const L = $('.ag-letter'), sheet = L.querySelector('.ag-sheet');
      return { on: onScreen(L), replies: [...L.querySelectorAll('.ag-reply')].map(b => { b.scrollIntoView({ block: 'nearest' }); return hit(b); }),
        // the foot never needs scrolling: "fold it away" and "next letter" are visible and wholly inside the sheet
        fold: hit(L.querySelector('.ag-letter__foot .ag-link')), next: hit(L.querySelector('.ag-letter__next')),
        footIn: (() => { const f = L.querySelector('.ag-letter__foot').getBoundingClientRect(), sh = sheet.getBoundingClientRect(); return f.bottom <= sh.bottom - 6 && f.top >= sh.top; })(),
        mark: hit($('.ag-mark')), markOv: ov($('.ag-voice__mark'), L), one: document.querySelectorAll('.ag-letter').length,
        overflowX: sheet.scrollWidth > sheet.clientWidth + 1 };
    });
    check(`${tag} letter ${v.toUpperCase()}: one letter, on screen, nothing clipped sideways`, lt.on && lt.one === 1 && !lt.overflowX, lt);
    check(`${tag} letter ${v.toUpperCase()}: reply links + "fold it away" clickable`, lt.replies.length === 3 && lt.replies.every(h => h === 'ok') && lt.fold === 'ok', lt);
    check(`${tag} letter ${v.toUpperCase()}: "fold it away" + "next letter" visible without scrolling, above the deckle`, lt.fold === 'ok' && lt.next === 'ok' && lt.footIn, lt);
    check(`${tag} letter ${v.toUpperCase()}: the voice mark stays reachable below the letter (reply aloud)`, lt.mark === 'ok' && lt.markOv === 0, lt);
    await p.close();
  }

  // 3. ledger: one sheet, on screen, links clickable, clear of the stack
  p = await open('ledger', W, H);
  const lg = await p.evaluate(() => ({ on: onScreen($('.ag-ledger')), links: [...document.querySelectorAll('.ag-ledger .ag-link')].map(hit), stack: ov($('.ag-ledger'), $('.ag-stack')), mark: ov($('.ag-ledger'), $('.ag-voice__mark')) }));
  check(`${tag} ledger: on screen, every link clickable, clear of the stack and voice mark`, lg.on && lg.links.length === 6 && lg.links.every(h => h === 'ok') && lg.stack === 0 && lg.mark === 0, lg);
  await p.close();

  // 4. notice: one line, not truncated, clear of the name and the stack
  p = await open('notice', W, H);
  const nt = await p.evaluate(() => { const n = $('.ag-notice.is-shown'), t = n.querySelector('.ag-notice__txt'); return { count: document.querySelectorAll('.ag-notice.is-shown').length, cut: t.scrollWidth > t.clientWidth + 1, on: onScreen(n), place: ov(n, $('.ag-place')), stack: ov(n, $('.ag-stack')), lines: Math.round(t.getBoundingClientRect().height / parseFloat(getComputedStyle(t).lineHeight)) }; });
  check(`${tag} notice: one at a time, one line (two on a phone), not cut, clear of name + stack`, nt.count === 1 && !nt.cut && nt.on && nt.place === 0 && nt.stack === 0 && nt.lines <= (W > 600 ? 1 : 2), nt);
  await p.close();

  // 5. speaking + typing + director: the caption sits above the mark; the typed line is focused and clickable
  p = await open('speaking', W, H);
  const sp = await p.evaluate(() => ({ cap: ov($('.ag-caption'), $('.ag-voice')), on: onScreen($('.ag-caption')), vis: vis($('.ag-caption')) }));
  check(`${tag} speaking: live caption on screen, above the voice mark`, sp.vis && sp.on && sp.cap === 0, sp);
  await p.close();
  p = await open('typing', W, H);
  const ty = await p.evaluate(() => ({ input: hit($('.ag-type__input')), focus: document.activeElement === $('.ag-type__input'), on: onScreen($('.ag-type')), mark: vis($('.ag-mark')) }));
  check(`${tag} typing: one underlined line in place of the mark, focused`, ty.input === 'ok' && ty.focus && ty.on && !ty.mark, ty);
  await p.close();
  p = await open('director', W, H);
  const dr = await p.evaluate(() => ({ cap: ov($('.ag-director'), $('.ag-caption')), on: onScreen($('.ag-director')), mark: ov($('.ag-director'), $('.ag-voice')) }));
  check(`${tag} director: on screen, clear of the caption`, dr.cap === 0 && dr.on && dr.mark === 0, dr);
  await p.close();

  // 6. agent card: small, on screen, off the stack / name / voice mark, at several click spots
  p = await open('rest', W, H);
  for (const [x, y] of [[W - 40, 40], [W - 10, H - 10], [W * .4, H * .4], [10, H - 10], [W / 2, H - 30]]) {
    const cd = await p.evaluate((x, y) => { ui.agentCard.show({ id: 'a2', name: 'Brusk', species: 'puffer', trade: 'builder', skills: { building: 8 }, known: { building: true }, mood: 40 }, { x, y }); const c = $('.ag-card'); return { on: onScreen(c), hits: ['.ag-stack', '.ag-place', '.ag-voice__mark'].map(s => ov(c, $(s))), w: Math.round(c.getBoundingClientRect().width) }; }, x, y);
    check(`${tag} agent card at (${Math.round(x)},${Math.round(y)}): small, on screen, off the stack/name/mark`, cd.on && cd.w <= 320 && cd.hits.every(v => v === 0), cd);
  }
  await p.close();

  // 7. onboarding (§24): ONE panel on the lower half, legible, its button clickable, clear of the voice mark and the mailbox
  for (const st of ['onboarding', 'onboarding&step=2']) {
    p = await open(st, W, H, 2400);
    const ob = await p.evaluate(() => { const g = $('.ag-guide__card'), r = g && g.getBoundingClientRect();
      return { vis: vis(g), on: g && onScreen(g), low: r && r.top > innerHeight * .4, btn: hit($('.ag-guide__btn')), skip: hit($('.ag-guide__skip')), mark: ov(g, $('.ag-voice__mark')), stack: ov(g, $('.ag-stack')),
        size: parseFloat(getComputedStyle($('.ag-guide__body')).fontSize), letter: !!ui.letters.openId, chips: !!document.querySelector('.ag-voice__chips') }; });
    check(`${tag} ${st}: the panel on the lower half, Continue + skip clickable, clear of the mark and the mailbox, ≥ 13 px body, no letter`, ob.vis && ob.on && ob.low && ob.btn === 'ok' && ob.skip === 'ok' && ob.mark === 0 && ob.stack === 0 && ob.size >= 13 && !ob.letter && !ob.chips, ob);
    await p.close();
  }

  // 8. title: nothing else of ours, no paint chrome
  p = await open('title', W, H);
  // (the §23 title, ui/title.js: section.tt on document.body, Begin = .tt__begin; it fades in at 1.7 s)
  await new Promise(r => setTimeout(r, 1800));
  const tt = await p.evaluate(() => ({ begin: hit($('.tt__begin')), others: [...document.querySelectorAll('.ag-ui > *')].filter(vis).length, chrome: [...document.querySelectorAll('.editions, .closeup, .tweaks-toggle')].filter(vis).length }));
  check(`${tag} title: Begin clickable, nothing else on screen`, tt.begin === 'ok' && tt.others === 0 && tt.chrome === 0, tt);
  await p.close();

  // 9. meeting: options + voice mark clickable, the mark clear of the report
  p = await open('meeting', W, H, 1800);
  const mt = await p.evaluate(() => ({ opts: [...document.querySelectorAll('.ag-band__opts .ag-reply')].map(hit), mark: hit($('.ag-mark')), rep: ov($('.ag-voice__mark'), $('.ag-band__report')), who: ov($('.ag-voice__mark'), $('.ag-band__who')) }));
  check(`${tag} meeting: options + voice mark clickable, mark clear of the report`, mt.opts.every(h => h === 'ok') && mt.mark === 'ok' && mt.rep === 0 && mt.who === 0, mt);
  await p.close();

  // 10. envoy decree
  p = await open('envoy', W, H, 1400);
  const ev = await p.evaluate(() => ({ on: onScreen($('.ag-decree')), opts: [...document.querySelectorAll('.ag-decree__opts .ag-reply')].map(hit) }));
  check(`${tag} envoy decree: on screen, replies clickable`, ev.on && ev.opts.every(h => h === 'ok'), ev);
  await p.close();

  // 11. the inbox fanned out: on screen, clear of the voice mark, every card's top strip clickable, the head readable
  for (const [preset, n] of [['inbox', 12], ['inbox-1', 1], ['inbox-30', 30]]) {
    p = await open(preset, W, H, 2200);
    const fn = await p.evaluate(() => { const m = [...document.querySelectorAll('.ag-mail')];
      return { n: m.length, on: m.every(onScreen), mark: Math.max(0, ...m.map(e => ov(e, $('.ag-voice__mark')))), head: ov($('.ag-fan__head'), m[0]) ,
        strips: m.filter(e => { const r = e.querySelector('.ag-mail__from').getBoundingClientRect(); const t = document.elementFromPoint(r.left + 6, r.top + r.height / 2); return t && t.closest('.ag-mail') === e; }).length,
        gather: hit($('.ag-fan__gather')), side: [...document.querySelectorAll('.ag-ui > *')].filter(e => vis(e) && !e.matches('.ag-fan, .ag-voice, .ag-caption, .ag-notices, .ag-hint')).map(e => e.className) }; });
    check(`${tag} ${preset}: ${n} cards on screen, clear of the voice mark and the head, top strips + "gather" clickable, nothing docked`, fn.n === n && fn.on && fn.mark === 0 && fn.head === 0 && fn.strips === n && fn.gather === 'ok' && fn.side.length === 0, fn);
    await p.close();
  }
  // 12. card v2 + talk: on screen, the talk line clear of the card, the stack, the name and the mark
  p = await open('talk', W, H, 1600);
  const tk = await p.evaluate(() => ({ card: onScreen($('.ag-card')), talk: onScreen($('.ag-talk')), cv: ov($('.ag-talk'), $('.ag-card')), hits: ['.ag-stack', '.ag-place', '.ag-voice__mark'].map(s => ov($('.ag-talk'), $(s)) + ov($('.ag-card'), $(s))), input: hit($('.ag-talk__input')), talkBtn: hit($('.ag-card__talkbtn')) }));
  check(`${tag} talk: card + bubble + line on screen, apart, clear of stack/name/mark, clickable`, tk.card && tk.talk && tk.cv === 0 && tk.hits.every(v => v === 0) && tk.input === 'ok' && tk.talkBtn === 'ok', tk);
  await p.close();
  // 13. the opening: fleet caption, election prompt, elected moment on screen and clear of the voice mark
  for (const [preset, sel] of [['fleetcaption', '.ag-fleet'], ['election', '.ag-elect'], ['elected', '.ag-elected']]) {
    p = await open(preset, W, H, 2200);
    const op = await p.evaluate(sel => ({ on: onScreen($(sel)), vis: vis($(sel)), mark: ov($(sel), $('.ag-voice__mark')), pe: getComputedStyle($(sel)).pointerEvents }), sel);
    check(`${tag} ${preset}: on screen, clear of the voice mark, clicks pass through to the folk`, op.on && op.vis && op.mark === 0 && op.pe === 'none', op);
    await p.close();
  }
  // 14. mail (ART_DIRECTION §14): the notes under the stack, the column, the compact card beside its sender
  p = await open('mail-notify', W, H, 1500);
  const nf = await p.evaluate(() => { const n = [...document.querySelectorAll('.ag-note')], sb = $('.ag-stack').getBoundingClientRect();
    return { n: n.length, on: n.every(onScreen), below: n.every(e => e.getBoundingClientRect().top >= sb.bottom - 14), hits: n.map(e => hit(e.querySelector('.ag-note__main'))), xs: n.map(e => hit(e.querySelector('.ag-note__x'))),
      apart: n.every((e, i) => n.every((f, j) => i === j || ov(e, f) === 0)), chrome: Math.max(0, ...n.map(e => ov(e, $('.ag-stack')) + ov(e, $('.ag-place')) + ov(e, $('.ag-voice__mark')))),
      first: n[0] && n[0].textContent, cameo: n.every(e => !!e.querySelector('.ag-cameo svg')), portrait: !!n[0].querySelector('.ag-cameo img') }; });
  check(`${tag} mail notes: 3 under the stack, newest on top, apart, on screen, clickable, clear of the chrome`, nf.n === 3 && nf.on && nf.below && nf.apart && nf.chrome === 0 && nf.hits.every(h => h === 'ok') && nf.xs.every(h => h === 'ok') && /Olla/.test(nf.first) && nf.cameo && nf.portrait, nf);
  await p.close();
  p = await open('mail-column', W, H, 1500);
  const cl = await p.evaluate(() => { const c = $('.ag-mailcol'), it = [...document.querySelectorAll('.ag-mailcol__item')], r = c.getBoundingClientRect(), lst = $('.ag-mailcol__list');
    return { on: onScreen(c), h: Math.round(r.height), max: Math.round(innerHeight * .6) + 4, w: Math.round(r.width), n: it.length, first: hit(it[0].querySelector('.ag-mailcol__main')),
      x: hit(it[0].querySelector('.ag-mailcol__x')), dot: hit(it[0].querySelector('.ag-mailcol__dot')), all: hit($('.ag-mailcol__clear')), see: hit($('.ag-mailcol__all')), stack: ov(c, $('.ag-stack')), mark: ov(c, $('.ag-voice__mark')),
      scrolls: lst.scrollHeight >= lst.clientHeight, unread: document.querySelectorAll('.ag-mailcol__item.is-unread').length, read: document.querySelectorAll('.ag-mailcol__item.is-read').length }; });
  // §24: the list takes the mailbox's own place (its icon hides while it is open), so it may grow to 60vh
  check(`${tag} mail column: slim, ≤ 60vh, on screen, in the mailbox's place, every control clickable, unread + read rows`, cl.on && cl.h <= cl.max && cl.w <= 380 && cl.n === 7 && cl.first === 'ok' && cl.x === 'ok' && cl.dot === 'ok' && cl.all === 'ok' && cl.see === 'ok' && cl.stack === 0 && cl.mark === 0 && cl.unread >= 3 && cl.read >= 2, cl);
  await p.close();
  // §15: every letter is read IN the inbox (top-right, under the stack), never beside the sender or mid-screen
  for (const q of ['inbox-read', 'inbox-read&long=1', 'inbox-read&font=A', 'mail-compact', 'mail-compact&bg=folk', 'mail-compact&who=n2']) {
    p = await open(q, W, H, 1500);
    const rp = await p.evaluate(() => { const c = $('.ag-mailcol'), m = c && c.querySelector('.ag-mread'); if (!m) return { missing: true };
      const r = c.getBoundingClientRect(), s = $('.ag-stack').getBoundingClientRect(), mk = $('.ag-voice__mark').getBoundingClientRect();
      return { on: onScreen(c), w: Math.round(r.width), h: Math.round(r.height), right: innerWidth - r.right, underStack: r.top < 40 && +getComputedStyle($('.ag-stack')).opacity < .05, rightHalf: r.left > innerWidth * (innerWidth > 600 ? .6 : 0) - 1,
        chrome: ['.ag-stack', '.ag-place', '.ag-voice__mark'].map(sel => ov(c, $(sel))), clearOfMark: r.bottom <= mk.top - 4,
        veil: !!document.querySelector('.ag-read__veil, .ag-fan, .ag-cc'), blur: [...document.querySelectorAll('.ag-ui *')].some(e => { if (e.closest('.ag-mailcol') || !/blur/.test(getComputedStyle(e).backdropFilter || '')) return false; const q = e.getBoundingClientRect(); return q.width * q.height > innerWidth * innerHeight * .35; }),   // §24: panels are frosted glass; no screen-wide blur
        reply: hit(m.querySelector('.ag-reply')), x: hit(m.querySelector('.ag-mread__x')), back: hit(m.querySelector('.ag-mread__back')), next: hit(m.querySelector('.ag-mread__next')), portrait: !!m.querySelector('.ag-mread__head .ag-cameo') }; });
    check(`${tag} ${q}: the letter reads inside the top-right inbox (in the mailbox's place, ≤ 404 wide), on screen, clear of the chrome, no veil or screen blur, controls clickable`,
      !rp.missing && rp.on && rp.w <= 405 && rp.right < 40 && rp.underStack && rp.rightHalf && rp.chrome.every(v => v === 0) && rp.clearOfMark && !rp.veil && !rp.blur && rp.reply === 'ok' && rp.x === 'ok' && rp.back === 'ok' && rp.next === 'ok' && rp.portrait, rp);
    await p.close();
  }
}
check('no page errors', errors.length === 0, errors);
await browser.close(); server.kill();
const pass = results.every(Boolean); console.log(pass ? `\nALL ${results.length} PASS` : `\n${results.filter(r => !r).length} FAIL`); process.exit(pass ? 0 : 1);
