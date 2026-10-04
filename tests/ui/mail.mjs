// The mail system (ART_DIRECTION §14, §15, docs/ui.md "Mail"): the stack -> onOpenLatest(letter); notes under the stack
// (up to 3, newest on top, tucked into the column after ~6 s; click -> onNotificationClick(letterId, {from})); the
// column (chevron / hover; mark read, ×, mark all read, dismiss all, see all at once); READING IN THE INBOX (§15): the
// column expands in place into the reading pane (top-right, under the stack; back to the list, prev / next, replies,
// Esc, ×, no veil; the old openCompact anchor is ignored); portraits (letter.portrait, getPortrait sync / Promise,
// setPortrait later; the seal when there is none; nations and the Ministry never ask for one).
//   ~/.nvm/versions/node/v22.22.3/bin/node tests/ui/mail.mjs
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

async function page(w = 1440, h = 900, opts = {}) {
  const p = await browser.newPage(); await p.setViewport({ width: w, height: h });
  p.on('pageerror', e => errors.push(String(e)));
  await p.goto(`${base}/ui-lab.html?state=none`, { waitUntil: 'networkidle0' });
  await p.evaluate(async ({ opts, PX }) => {
    window.ui && window.ui.destroy();
    const { createUI } = await import('./js/ui/ui.js');
    window.calls = [];
    const rec = name => (...a) => { window.calls.push([name, ...a.map(x => x && typeof x === 'object' && 'id' in x ? x.id : x)]); };
    const cfg = { onLetterOption: rec('onLetterOption'), onLetterRead: rec('onLetterRead'), onNotificationDismiss: rec('onNotificationDismiss'),
      lookup: { agent: id => ({ id, name: { a1: 'Olla', a2: 'Brusk' }[id] || 'Pell', species: 'floatie', trade: 'baker' }) } };
    if (opts.game) { cfg.onOpenLatest = rec('onOpenLatest'); cfg.onNotificationClick = rec('onNotificationClick'); }
    if (opts.portraits === 'sync') cfg.getPortrait = id => id === 'a1' ? PX : null;
    if (opts.portraits === 'async') { window.resolvers = []; cfg.getPortrait = id => id === 'a2' ? new Promise(r => window.resolvers.push(r)) : null; }
    window.ui = createUI(cfg);
    window.mk = (id, who = 'a1', extra = {}) => ({ id, from: { kind: 'agent', id: who, name: { a1: 'Olla', a2: 'Brusk' }[who] || 'Pell' }, subject: 'Subject ' + id, body: 'Dear founder,\n\nHello from ' + id + '.\n\n— ' + who, day: 3,
      options: [{ label: 'yes', says: 'Yes ' + id }, { label: 'no', says: 'No ' + id }], ...extra });
    document.querySelector('.lab-pins')?.remove();
  }, { opts, PX });
  return p;
}
const calls = p => p.evaluate(() => window.calls.splice(0));

// ---------- 1. notes + the game's callbacks ----------
let p = await page(1440, 900, { game: true, portraits: 'sync' });
await p.evaluate(() => { ui.letters.addLetter(mk('A')); }); await sleep(600);
check('a letter arriving slides a note in under the stack: cameo + "Olla sent a letter" + subject', await p.evaluate(() => { const n = document.querySelectorAll('.ag-note'); const t = n[0] && n[0].textContent; return n.length === 1 && /Olla\s*sent a letter/.test(t) && /Subject A/.test(t) && !!n[0].querySelector('.ag-cameo img'); }));
await p.evaluate(() => { ui.letters.addLetter(mk('B', 'a2')); ui.notify.push({ kind: 'ministry', name: 'Ministry of Builds', subject: 'A lighthouse', from: { kind: 'ministry', id: 'builds', name: 'Ministry of Builds' } }); ui.letters.addLetter(mk('C', 'a3', { from: { kind: 'neighbour', id: 'n2', name: 'Little Lantern' } })); }); await sleep(700);
const nn = await p.evaluate(() => [...document.querySelectorAll('.ag-note')].filter(e => getComputedStyle(e).opacity > .5 && e.style.pointerEvents !== 'none').map(e => e.textContent));
check('at most 3 notes; newest on top; envoy and ministry wording', nn.length === 3 && /Little Lantern\s*sent an envoy/.test(nn[0]) && /posted a notice/.test(nn[1]) && /Brusk/.test(nn[2]), nn);
await p.evaluate(() => ui.notify.letter('C')); await sleep(300);
check('notify.letter for the same letter again does not duplicate it', await p.evaluate(() => ui.notify.list.filter(n => n.letterId === 'C').length === 1));
await p.click('.ag-note .ag-note__main'); let c = await calls(p);
check('clicking a note -> onNotificationClick(letterId, {from:"toast"}) (the game glides, then openCompact)', c.some(x => x[0] === 'onNotificationClick' && x[1] === 'C' && x[2] && x[2].from === 'toast'), c);
await p.click('.ag-stack'); await sleep(300); c = await calls(p);
check('§24: clicking the mailbox opens the list (no letter jump); its icon hides while the list is open', !c.some(x => x[0] === 'onOpenLatest') && await p.evaluate(() => ui.notify.column.isOpen && ui.notify.column.pinned && +getComputedStyle(document.querySelector('.ag-stack')).opacity < .05), c);
await p.click('.ag-mailcol__close'); await sleep(350);
check('the list\'s × folds it away; the mailbox icon comes back', await p.evaluate(() => !ui.notify.column.isOpen && +getComputedStyle(document.querySelector('.ag-stack')).opacity > .9));
await p.evaluate(() => ui.letters.openCompact('C', { anchor: { x: 600, y: 450, r: 30 } })); await sleep(500);
c = await calls(p);
check('openCompact marks it read -> onLetterRead(id) once', c.filter(x => x[0] === 'onLetterRead' && x[1] === 'C').length === 1, c);
await p.evaluate(() => ui.letters.closeCompact());
await sleep(6200);
check('after ~6 s the notes tuck themselves into the column (none left on screen)', await p.evaluate(() => document.querySelectorAll('.ag-note').length === 0 && ui.notify.toasts === 0 && ui.notify.list.length === 4));
check('opening a letter opened the inbox, so those notes count as seen: no red dot', await p.evaluate(() => document.querySelector('.ag-stack__new').hidden));
check('§24: no chevron under the mailbox (the list opens from the mailbox itself)', await p.evaluate(() => getComputedStyle(document.querySelector('.ag-stack__more')).display === 'none'));
await calls(p);
await p.click('.ag-stack'); await sleep(400);
check('the mailbox opens the column: 4 rows, newest first, unread dots, the read one dimmed', await p.evaluate(() => { const it = [...document.querySelectorAll('.ag-mailcol__item')]; return ui.notify.column.isOpen && it.length === 4 && /Little Lantern/.test(it[0].textContent) && it[0].classList.contains('is-read') && it.filter(e => e.classList.contains('is-unread')).length === 3 && document.querySelector('.ag-stack__new').hidden; }));
check('each row has a time ("just now")', await p.evaluate(() => /just now/.test(document.querySelector('.ag-mailcol__time').textContent)));
await p.click('.ag-mailcol__item[data-note="n:B"] .ag-mailcol__dot'); c = await calls(p);
check('the unread dot = mark read -> onLetterRead(id); the row goes quiet', c.some(x => x[0] === 'onLetterRead' && x[1] === 'B') && await p.evaluate(() => document.querySelector('.ag-mailcol__item[data-note="n:B"]').classList.contains('is-read')), c);
await p.click('.ag-mailcol__item[data-note="n:A"] .ag-mailcol__x'); c = await calls(p);
check('× dismisses one row -> onNotificationDismiss(letterId); the letter stays', c.some(x => x[0] === 'onNotificationDismiss' && x[1] === 'A') && await p.evaluate(() => document.querySelectorAll('.ag-mailcol__item').length === 3 && ui.letters.all.some(l => l.id === 'A')), c);
await p.click('.ag-mailcol__item .ag-mailcol__main'); c = await calls(p);
check('a row click -> onNotificationClick(letterId, {from:"column"})', c.some(x => x[0] === 'onNotificationClick' && x[2] && x[2].from === 'column'), c);
await p.evaluate(() => ui.notify.column.open()); await sleep(200);
await p.click('.ag-mailcol__allread'); await sleep(100);
check('"mark all read": no unread rows, the stack count goes to 0', await p.evaluate(() => !document.querySelector('.ag-mailcol__item.is-unread') && ui.letters.unread === 0));
await p.click('.ag-mailcol__clear'); await sleep(100);
check('"dismiss all": the column says all caught up', await p.evaluate(() => ui.notify.list.length === 0 && /caught up/.test(document.querySelector('.ag-mailcol__list').textContent)));
await p.keyboard.press('Escape'); await sleep(400);
check('Esc folds the column away', await p.evaluate(() => !ui.notify.column.isOpen && !document.querySelector('.ag-mailcol')));
// §24: no hover-open (the icon hides while the list is open, so a hover would flicker)
await p.evaluate(() => ui.letters.addLetter(mk('D'))); await sleep(300);
const sk = await (await p.$('.ag-stack')).boundingBox();
await p.mouse.move(sk.x + sk.width / 2, sk.y + sk.height / 2); await sleep(700);
check('hovering the mailbox does not open the list', await p.evaluate(() => !ui.notify.column.isOpen));
await p.mouse.move(300, 600); await sleep(300);
await p.evaluate(() => { ui.notify.column.open(); }); await sleep(200);
await p.click('.ag-mailcol__all'); await sleep(900);
check('"see all at once" (column) fans every letter out on the table', await p.evaluate(() => ui.letters.isFanned && !ui.notify.column.isOpen));
await p.click('.ag-mail[data-id="B"]'); await sleep(900); c = await calls(p);
check('a card on the table -> the table folds, onNotificationClick(id, {from:"seeall"})', await p.evaluate(() => !ui.letters.isFanned) && c.some(x => x[0] === 'onNotificationClick' && x[1] === 'B' && x[2] && x[2].from === 'seeall'), c);
await p.close();

// ---------- 2. reading in the inbox: the pane, top-right, where the list was ----------
p = await page(1440, 900, { portraits: 'async' });
await p.evaluate(() => { ui.letters.setLetters([mk('X', 'a1'), mk('Y', 'a2'), mk('Z', 'a1', { body: 'Dear founder,\n\n' + 'A very long letter. '.repeat(90) + '\n\n— Olla' }), mk('N', 'a3', { from: { kind: 'neighbour', id: 'n2', name: 'Little Lantern' } })]); });
const pane = () => p.evaluate(() => { const w = document.querySelector('.ag-mailcol'), m = w && w.querySelector('.ag-mread'); if (!m) return null; const r = w.getBoundingClientRect(), s = document.querySelector('.ag-stack').getBoundingClientRect();
  return { id: m.dataset.id, l: Math.round(r.left), t: Math.round(r.top), r: Math.round(r.right), b: Math.round(r.bottom), w: Math.round(r.width), underStack: r.top < 60 && +getComputedStyle(document.querySelector('.ag-stack')).opacity < .05, pos: m.querySelector('.ag-mread__pos').textContent, list: !w.querySelector('.ag-mailcol__view').hidden }; });
const spots = [];
for (const a of [{ x: 500, y: 450, r: 30 }, { x: 1250, y: 450, r: 30 }, null]) { await p.evaluate(a => ui.letters.openCompact('X', { anchor: a }), a); await sleep(420); spots.push(await pane()); }
check('openCompact (any anchor, or none) opens the letter in the same top-right place, in the mailbox\'s place (§24), ≤ 410 wide, on screen', spots.every(g => g && g.id === 'X' && g.underStack && g.r > 1380 && g.r <= 1440 && g.w <= 410 && g.t >= 0 && g.b <= 900 && g.l === spots[0].l && g.t === spots[0].t && !g.list), spots);
check('the world stays visible: no veil, no screen-wide blur (only the panels\' own frosted glass), nothing beside the sender, nothing mid-screen', await p.evaluate(() => !document.querySelector('.ag-read__veil, .ag-cc, .ag-fan') && ![...document.querySelectorAll('.ag-ui *')].some(e => { if (!/blur/.test(getComputedStyle(e).backdropFilter || '')) return false; const r = e.getBoundingClientRect(); return r.width * r.height > innerWidth * innerHeight * .35; }) && document.querySelector('.ag-mailcol').getBoundingClientRect().left > innerWidth / 2));
check('"1 of 4" in the bar; prev off on the newest, next on', await p.evaluate(() => { const m = document.querySelector('.ag-mread'); return /\d of 4/.test(m.querySelector('.ag-mread__pos').textContent) && !!m.querySelector('.ag-mread__next'); }));
check('portrait: a pending getPortrait Promise shows the seal first', await p.evaluate(() => { ui.letters.openCompact('Y'); const c = document.querySelector('.ag-mread .ag-cameo'); return !c.querySelector('img') && !!c.querySelector('svg'); }));
await p.evaluate(PX => window.resolvers.forEach(r => r(PX)), PX); await sleep(100);
check('…and the painted portrait once it resolves', await p.evaluate(() => !!document.querySelector('.ag-mread .ag-cameo img')));
check('nations keep their shield (getPortrait is not asked for them)', await p.evaluate(() => { const before = window.resolvers.length; ui.letters.openCompact('N'); const c = document.querySelector('.ag-mread .ag-cameo'); return !c.querySelector('img') && !!c.querySelector('svg') && window.resolvers.length === before; }));
await p.evaluate(PX => ui.setPortrait('a1', PX), PX);
await p.evaluate(() => { ui.letters.markRead('X', false); ui.letters.markRead('Y', false); ui.letters.openCompact('Z'); }); await sleep(450);
check('ui.setPortrait(senderId, src) later: the next letter shows it', await p.evaluate(() => !!document.querySelector('.ag-mread .ag-cameo img')));
check('a long letter scrolls inside the pane (bar, replies and foot stay), its lower edge fades', await p.evaluate(() => { const b = document.querySelector('.ag-mread__body'), w = document.querySelector('.ag-mailcol').getBoundingClientRect(); return b.scrollHeight > b.clientHeight + 40 && b.classList.contains('is-more') && w.bottom <= innerHeight && !!document.querySelector('.ag-mread__replies .ag-reply') && !!document.querySelector('.ag-mread__bar'); }));
await p.evaluate(() => document.querySelector('.ag-mailcol').focus());
await p.keyboard.press('ArrowDown'); await sleep(450);
check('↓ in a long letter reads on (scrolls), it does not skip', await p.evaluate(() => ui.letters.compactId === 'Z' && document.querySelector('.ag-mread__body').scrollTop > 20));
const z = await pane();
await p.click('.ag-mread__next'); await sleep(400);
const z2 = await pane();
check('"next ›" opens the next letter down the list in place (no game callback)', z2 && z2.id !== 'Z' && +z2.pos.split(' ')[0] === +z.pos.split(' ')[0] + 1 && z2.l === z.l, [z, z2]);
await p.evaluate(() => document.querySelector('.ag-mailcol').focus());
await p.keyboard.press('ArrowLeft'); await sleep(400);
check('← goes back up (prev)', await p.evaluate(() => ui.letters.compactId === 'Z'));
await p.click('.ag-mread .ag-reply'); c = await calls(p);
check('a reply link -> onLetterOption(id, says)', c.some(x => x[0] === 'onLetterOption' && /^Yes /.test(x[2])), c);
await sleep(2300);
check('…and, opened from the stack, the inbox folds away after the reply', await p.evaluate(() => !ui.letters.isCompact && !ui.notify.column.isOpen));
// opened from the list: back to the list after a reply / Esc
await p.evaluate(() => { ui.notify.letter('X'); ui.notify.letter('Y'); ui.notify.column.open(); }); await sleep(300);
await p.click('.ag-mailcol__item[data-note="n:Y"] .ag-mailcol__main'); await sleep(450);
const fromList = await pane();
check('a row click opens it in the same column, which widens into the pane (the list hides)', fromList && fromList.id === 'Y' && !fromList.list && fromList.underStack, fromList);
await p.click('.ag-mread__back'); await sleep(300);
check('"back to the list" shows the rows again', await p.evaluate(() => ui.notify.column.isOpen && !ui.letters.isCompact && document.querySelectorAll('.ag-mailcol__item').length >= 2 && !document.querySelector('.ag-mread')));
await p.click('.ag-mailcol__item[data-note="n:X"] .ag-mailcol__main'); await sleep(450);
await p.keyboard.press('Escape'); await sleep(300);
check('Esc in a letter opened from the list: back to the list', await p.evaluate(() => ui.notify.column.isOpen && !ui.letters.isCompact));
await p.keyboard.press('Escape'); await sleep(350);
check('Esc again folds the inbox', await p.evaluate(() => !ui.notify.column.isOpen));
await p.evaluate(() => ui.letters.openCompact('X')); await sleep(300);
await p.mouse.click(500, 600); await sleep(400);
check('a click on the world leaves the letter open (it is in the corner, the world stays usable)', await p.evaluate(() => ui.letters.isCompact));
await p.click('.ag-mread__x'); await sleep(400);
check('× folds the inbox away', await p.evaluate(() => !ui.letters.isCompact && !document.querySelector('.ag-mailcol')));
await p.evaluate(() => ui.letters.openCompact('X')); await sleep(300);
await p.keyboard.press('Escape'); await sleep(300);
check('Esc closes a letter opened from the stack', await p.evaluate(() => !ui.letters.isCompact && !document.querySelector('.ag-mread')));
await p.close();

// ---------- 2b. the game's callbacks route next / prev too ----------
p = await page(1440, 900, { game: true });
await p.evaluate(() => { ui.letters.setLetters([mk('A'), mk('B'), mk('C')]); ui.letters.openCompact('B'); }); await sleep(400); await calls(p);
await p.click('.ag-mread__next'); c = await calls(p);
check('with the game wired, "next ›" -> onNotificationClick(id, {from:"next"}) (the game glides, then opens it here)', c.some(x => x[0] === 'onNotificationClick' && x[2] && x[2].from === 'next'), c);
await p.close();

// ---------- 3. a phone: the pane under the stack, full width, clear of the voice mark ----------
p = await page(390, 844);
await p.evaluate(() => ui.letters.setLetters([mk('P1', 'a1', { body: 'Dear founder,\n\n' + 'A long letter. '.repeat(60) + '\n\n— Olla' }), mk('P2')]));
await p.evaluate(() => ui.letters.openCompact('P1', { anchor: { x: 200, y: 300, r: 34 } })); await sleep(500);
const ph = await p.evaluate(() => { const c = document.querySelector('.ag-mailcol'), r = c.getBoundingClientRect(), m = document.querySelector('.ag-voice__mark').getBoundingClientRect(), s = document.querySelector('.ag-stack').getBoundingClientRect();
  return { t: r.top, b: r.bottom, l: r.left, rr: r.right, mark: r.bottom > m.top - 4, stack: +getComputedStyle(document.querySelector('.ag-stack')).opacity > .05, bar: [...c.querySelectorAll('.ag-mread__bar > *, .ag-mread__nav > *')].every(e => { const q = e.getBoundingClientRect(); return q.right <= r.right + 1 && q.left >= r.left - 1; }) }; });
check('phone: the pane in the mailbox\'s place (icon hidden), within the gutters, clear of the voice mark, its bar fits', !ph.mark && !ph.stack && ph.l >= 10 && ph.rr <= 380 && ph.bar, ph);
await p.close();

check('no page errors', errors.length === 0, errors);
await browser.close(); server.kill();
const pass = results.every(Boolean); console.log(pass ? `\nALL ${results.length} PASS` : `\n${results.filter(r => !r).length} FAIL`); process.exit(pass ? 0 : 1);
