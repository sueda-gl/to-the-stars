// Interaction smoke test for the UI module (ui-lab.html, bare): every callback fires with the documented arguments,
// typing never leaks hotkeys, the rest state holds only the world + stack + voice mark + name, a letter opens and folds,
// notices show one at a time, the ledger opens on Tab, onboarding is one panel (§24).
//   ~/.nvm/versions/node/v22.22.3/bin/node tests/ui/smoke.mjs
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
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--use-angle=metal'] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
const errors = []; page.on('pageerror', e => errors.push(String(e)));
await page.goto(`${base}/ui-lab.html?state=none`, { waitUntil: 'networkidle0' });
const fresh = (opts = {}) => page.evaluate(async (opts) => {
  window.ui && window.ui.destroy();
  const { createUI } = await import('./js/ui/ui.js');
  window.calls = window.calls || []; window.calls.length = 0; window.leaked = window.leaked || [];
  if (!window.__leakHook) { window.__leakHook = true; addEventListener('keydown', e => { if (!e.defaultPrevented) window.leaked.push(e.key); }); }
  const rec = name => (...a) => window.calls.push([name, ...a]);
  // functions don't cross page.evaluate: { noTalk } leaves onTalk out (mock mode), { bubbleHook } records an agents.bubble stand-in
  const { noTalk, bubbleHook, ...optsIn } = opts;
  if (bubbleHook) { window.bubbles = []; optsIn.bubble = (id, text, o) => { window.bubbles.push([id, text, o.thinking]); return true; }; }
  window.ui = createUI({ onTalk: noTalk ? undefined : rec('onTalk'), onCommand: rec('onCommand'), onLetterOption: rec('onLetterOption'), onAgentAction: rec('onAgentAction'), onStart: rec('onStart'), onMic: rec('onMic'), onOnboardingDone: rec('onOnboardingDone'),
    lookup: { agent: id => ({ id, name: 'Olla', species: 'loaf', trade: 'baker' }) }, ...optsIn });
}, opts);
await fresh();
const sleep = ms => new Promise(r => setTimeout(r, ms));
const calls = () => page.evaluate(() => window.calls.splice(0));
const results = []; const check = (name, ok, got) => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok ? '' : '  got ' + JSON.stringify(got)}`); };
const visible = sel => page.evaluate(sel => { const e = document.querySelector(sel); if (!e) return false; const s = getComputedStyle(e); const r = e.getBoundingClientRect(); return !e.closest('[hidden]') && s.display !== 'none' && s.visibility !== 'hidden' && +s.opacity > .05 && r.width > 0 && r.height > 0; }, sel);
let c;

// ---------- title ----------
await page.evaluate(() => document.body.insertAdjacentHTML('beforeend', '<div class="editions"><button>Gouache</button></div><button class="tweaks-toggle">Gouache settings</button>'));
check('paint chrome (editions, Gouache settings) never shows in the game', !(await visible('.editions')) && !(await visible('.tweaks-toggle')));
await page.evaluate(() => ui.titleCard.show({ title: 'Agora' })); await sleep(1500);
check('title card is calm: no registration marks, colour strip or edition line', await page.evaluate(() => !document.querySelector('.ag-reg, .ag-title__strip, .ag-title__edition')));
await page.click('.tt__begin'); c = await calls();   // the §23 title (ui/title.js)
check('Begin -> onStart()', c.length === 1 && c[0][0] === 'onStart', c);
await sleep(1400); check('title card removed after lift', await page.evaluate(() => { const t = document.querySelector('.tt'); return (!t || t.hidden) && !ui.titleCard.visible; }));

// ---------- rest: only the world, the stack (when letters exist), the voice mark, the name ----------
await page.evaluate(() => { ui.hud.set({ name: 'Cala Serena', stage: 'hamlet', day: 3, prosperity: 42, resources: { food: 38, wood: 24, stone: 17, coin: 12 } }); ui.ministerSeal.set({ id: 'a1', name: 'Olla' }, { quiet: true }); ui.neighbours.set([{ id: 'n1', name: 'Sorrento', species: 'drop', attitude: 50 }, { id: 'n3', name: 'Grey Harbour', attitude: 30 }]); ui.voiceBar.setChips(['A rubber duck in the lake']); });
check('no chip bar, HUD card, minister pill, neighbours pill or letter list in the DOM', await page.evaluate(() => !document.querySelector('.ag-voice__chips, .ag-hud, .ag-minister, .ag-nb-toggle, .ag-list, .ag-pill--say')));
check('stack hidden while there are no letters', !(await visible('.ag-stack')));
check('§24: no settlement name top-left (the ledger stays on Tab)', await page.evaluate(() => { const e = document.querySelector('.ag-place'); return !e || getComputedStyle(e).display === 'none'; }));
check('voice mark idle says "hold Space"', /hold\s*Space/.test(await page.$eval('.ag-mark__lbl', e => e.textContent)));

// ---------- typed fallback ----------
await page.keyboard.press('Enter'); await sleep(150);
check('Enter opens the typed line in place of the mark', await page.evaluate(() => ui.voiceBar.typingOpen && document.activeElement === document.querySelector('.ag-type__input')) && !(await visible('.ag-mark')));
await page.keyboard.type('a rubber duck in the lake'); await page.keyboard.press('Enter'); c = await calls();
check('typed + Enter -> onCommand(text, "typed")', c.length === 1 && c[0][1] === 'a rubber duck in the lake' && c[0][2] === 'typed', c);
check('typing leaks no keydown to the game', (await page.evaluate(() => window.leaked.filter(k => k !== 'Enter').length)) === 0, await page.evaluate(() => window.leaked));
check('typed text shown as the caption; the line folds back to the mark', await page.evaluate(() => !document.querySelector('.ag-caption').hidden && /rubber duck/.test(document.querySelector('.ag-caption .txt').textContent) && !ui.voiceBar.typingOpen));
check('after the first command the mark goes quiet (no "hold Space")', await page.evaluate(() => document.querySelector('.ag-voice').classList.contains('is-quiet') && document.querySelector('.ag-mark__lbl').textContent === ''));
await sleep(4300);
check('caption fades ~3 s after landing', await page.evaluate(() => document.querySelector('.ag-caption').hidden));
await page.keyboard.press('/'); await sleep(100);
check('"/" opens the typed line', await page.evaluate(() => ui.voiceBar.typingOpen));
await page.keyboard.press('Escape'); await sleep(100);
check('Esc closes it', await page.evaluate(() => !ui.voiceBar.typingOpen));
const mk = await (await page.$('.ag-mark')).boundingBox();
await page.mouse.click(mk.x + 20, mk.y + 20); await sleep(150); c = await calls();
check('a click on the mark opens the typed line (no onMic without hold)', await page.evaluate(() => ui.voiceBar.typingOpen) && c.length === 0, c);
await page.keyboard.press('Escape'); await sleep(100);
await page.mouse.move(mk.x + 20, mk.y + 20); await page.mouse.down(); await sleep(420); await page.mouse.up(); await sleep(50); c = await calls();
check('holding the mark -> onMic(true) then onMic(false), no typing', c.length === 2 && c[0][1] === true && c[1][1] === false && !(await page.evaluate(() => ui.voiceBar.typingOpen)), c);
for (const s of ['listening', 'thinking', 'done', 'error', 'idle']) { await page.evaluate(s => ui.voiceBar.setState(s), s); check(`voiceBar.setState("${s}")`, (await page.$eval('.ag-voice', e => e.dataset.state)) === s, null); }
await page.evaluate(() => ui.voiceBar.setChips(['x', 'y']));
check('setChips draws nothing', await page.evaluate(() => !document.querySelector('.ag-voice__chips, .ag-pill')));

// ---------- letters ----------
await page.evaluate(() => { ui.letters.addLetter({ id: 'L1', from: { kind: 'agent', id: 'a1', name: 'Olla' }, subject: 'Bread', body: 'Dear founder,\n\nHello.\n\nWith flour,\nOlla', day: 3, options: [{ label: 'yes, build it', says: 'Yes, build it' }, { label: 'not yet', says: 'No' }] }); });
await sleep(1300);
check('stack shows with a red count of 1', (await visible('.ag-stack')) && (await page.$eval('.ag-stack__count', e => e.textContent)) === '1');
check('stack seal is red wax with the initial (mb 7)', await page.evaluate(() => { const s = document.querySelector('.ag-env--1 .ag-seal'); return s && s.querySelector('path').getAttribute('fill') === '#e0503f' && s.querySelector('text').textContent === 'O'; }));
// §14/§15: a click on the stack opens the latest letter in the inbox pane, top-right (no game callback: straight there)
await page.click('.ag-stack'); await sleep(700);
// §24: the mailbox opens to the list of letters, in its own place; its icon disappears while it is open
check('clicking the mailbox opens the list top-right; the mailbox icon hides', await page.evaluate(() => { const c = document.querySelector('.ag-mailcol:not(.is-reading)'), r = c && c.getBoundingClientRect(); return !!c && r.right > innerWidth - 40 && r.top < 60 && +getComputedStyle(document.querySelector('.ag-stack')).opacity < .05 && document.querySelectorAll('.ag-mailcol__item').length === 1; }));
await page.click('.ag-mailcol__item .ag-mailcol__main'); await sleep(700);
check('a row opens the letter in the box, top-right: no veil, no blur, no table', await page.evaluate(() => { const m = document.querySelector('.ag-mailcol.is-reading .ag-mread'), r = m && m.closest('.ag-mailcol').getBoundingClientRect(); return ui.letters.compactId === 'L1' && ui.letters.openId === 'L1' && !!m && r.right > innerWidth - 40 && r.top < 60 && !document.querySelector('.ag-read__veil, .ag-fan'); }));
check('the pane: cameo, sender, trade, subject, body, the choice + a quiet "not yet" + Write back (§24), back to the list, prev / next, ×', await page.evaluate(() => { const c = document.querySelector('.ag-mread'); return !!c.querySelector('.ag-cameo svg') && c.querySelector('.ag-mread__from').textContent === 'Olla' && /baker/.test(c.querySelector('.ag-mread__line').textContent) && c.querySelector('.ag-mread__subject').textContent === 'Bread' && /Hello/.test(c.querySelector('.ag-mread__text').textContent) && c.querySelectorAll('.ag-reply').length === 1 && /not yet/i.test(c.querySelector('.ag-mread__nope').textContent) && !!c.querySelector('.ag-mread__winput') && !!c.querySelector('.ag-mread__x') && /all letters/.test(c.querySelector('.ag-mread__back').textContent) && !!c.querySelector('.ag-mread__prev') && !!c.querySelector('.ag-mread__next'); }));
check('opening it marks the letter read (count 0)', await page.evaluate(() => ui.letters.unread === 0 && document.querySelector('.ag-stack__count').classList.contains('is-zero')));
await page.click('.ag-mread .ag-reply'); c = await calls();
check('a reply in the pane -> onLetterOption(id, says)', c.length === 1 && c[0][0] === 'onLetterOption' && c[0][1] === 'L1' && c[0][2] === 'Yes, build it', c);
await page.evaluate(() => ui.letters.markResolved('L1'));
check('markResolved stamps the letter in the pane', await page.evaluate(() => !!document.querySelector('.ag-mread .ag-stamp')));
await sleep(2300);
check('a reply folds the inbox away (it was opened from the stack)', await page.evaluate(() => !ui.letters.isCompact && !document.querySelector('.ag-mread')));
// the full reading view stays for the onboarding's welcome letter and the director (letters.open / toggleList)
await page.evaluate(() => { ui.letters.open('L1'); }); await sleep(200);   // (open() returns a Promise that settles after the unfolding)
check('letters.open(id) still opens the full letter over a dimmed, blurred world', await page.evaluate(() => { const v = document.querySelector('.ag-read__veil'); return ui.letters.openId === 'L1' && document.querySelectorAll('.ag-letter').length === 1 && /blur/.test(getComputedStyle(v).backdropFilter || getComputedStyle(v).webkitBackdropFilter); }));
check('the envelope opens (flap, pocket, back) during the unfolding', await page.evaluate(() => !!document.querySelector('.ag-big__flap') && !!document.querySelector('.ag-big__pocket')));
await sleep(2400);
check('after unfolding: envelope gone, letter settled with a slight rotation', await page.evaluate(() => !document.querySelector('.ag-read .ag-big') && /matrix\(0\.99/.test(getComputedStyle(document.querySelector('.ag-letter')).transform)), await page.evaluate(() => getComputedStyle(document.querySelector('.ag-letter')).transform));
check('letter: sender, trade, Day 3, signature, answered stamp', await page.evaluate(() => document.querySelector('.ag-letter__from').textContent === 'Olla' && /baker/.test(document.querySelector('.ag-letter__trade').textContent) && document.querySelector('.ag-letter__day').textContent === 'Day 3' && document.querySelector('.ag-letter__sign .nm').textContent === 'Olla' && !/Olla$/.test(document.querySelector('.ag-letter__body').textContent.trim()) && !!document.querySelector('.ag-letter .ag-stamp')));
await page.keyboard.press('Escape'); await sleep(700);
check('Esc folds the full letter away', await page.evaluate(() => !ui.letters.openId && !document.querySelector('.ag-read')));
await page.evaluate(() => { for (const id of ['L2', 'L3']) ui.letters.addLetter({ id, from: { kind: 'neighbour', id: 'n1', name: 'Sorrento' }, subject: 'Lemons', body: 'Hello\n— Donna Perla', day: 4 }, { silent: true }); });
await page.evaluate(() => ui.letters.open('L3')); await sleep(300);
check('"next letter" shows when more are waiting', await visible('.ag-letter__next'));
await page.click('.ag-letter__next'); await sleep(400);
check('next letter -> opens the next one', await page.evaluate(() => ui.letters.openId === 'L2'));
await sleep(2200);
await page.mouse.click(60, 450); await sleep(700);
check('outside click folds it away', await page.evaluate(() => !ui.letters.openId && !document.querySelector('.ag-read')));
await page.evaluate(() => { ui.letters.markRead('L2', false); ui.letters.markRead('L3', false); });
// "see all at once": shift-click the stack fans every letter out; a card there opens in the inbox pane
// (§24: the list opened from the mailbox earlier is still pinned open, hiding the icon: fold it first)
await page.evaluate(() => ui.notify.column.close(true)); await sleep(300);
{ await page.keyboard.down('Shift'); const sb = await (await page.$('.ag-stack')).boundingBox();
  await page.mouse.click(sb.x + sb.width / 2, sb.y + sb.height / 2); await page.keyboard.up('Shift'); await sleep(900);
  check('shift-click on the stack fans every letter out on the table, over a dimmed, blurred world', await page.evaluate(() => { const v = document.querySelector('.ag-fan .ag-read__veil'); return ui.letters.isFanned && !ui.letters.openId && document.querySelectorAll('.ag-mail').length === 3 && /blur/.test(getComputedStyle(v).backdropFilter || getComputedStyle(v).webkitBackdropFilter); }));
  check('a table card shows seal, sender, subject and the day; answered / unread', await page.evaluate(() => { const m = document.querySelector('.ag-mail[data-id="L1"]'), u = document.querySelector('.ag-mail[data-id="L3"]'); return m.classList.contains('is-resolved') && u.classList.contains('is-unread') && !!m.querySelector('.ag-mail__seal svg') && m.querySelector('.ag-mail__from').textContent === 'Olla' && m.querySelector('.ag-mail__subj').textContent === 'Bread' && /DAY\s*3/.test(m.querySelector('.ag-mail__post').textContent); }));
  const fo = await page.evaluate(() => ({ onStack: document.activeElement === ui.letters.el, inFan: !!document.activeElement.closest('.ag-fan') }));
  check('mouse click on the stack: the table takes focus, not the stack', !fo.onStack && fo.inFan, fo);
  await page.keyboard.press('Space'); await sleep(300);
  check('Space on the table opens nothing', await page.evaluate(() => !ui.letters.openId && ui.letters.isFanned));
  { const mb = await (await page.$('.ag-mail[data-id="L3"]')).boundingBox(); await page.mouse.click(mb.x + mb.width / 2, mb.y + mb.height / 2); } await sleep(1100);
  check('a card on the table: the table folds away and that letter opens in the inbox pane', await page.evaluate(() => !ui.letters.isFanned && ui.letters.compactId === 'L3' && !!document.querySelector('.ag-mread') && !document.querySelector('.ag-read')));
  const st = await page.evaluate(() => ({ inCard: !!document.activeElement.closest('.ag-mailcol.is-reading'), onStack: document.activeElement === ui.letters.el }));
  check('focus moves into the inbox pane', st.inCard && !st.onStack, st);
  await page.keyboard.press('Enter'); await sleep(250);
  check('Enter with the letter open opens the typed line (the letter stays)', await page.evaluate(() => ui.letters.compactId === 'L3' && ui.voiceBar.typingOpen));
  await page.keyboard.press('Escape'); await sleep(100); await page.keyboard.press('Escape'); await sleep(400);
  check('Esc closes the letter (and the inbox it opened)', await page.evaluate(() => !ui.letters.isCompact && !document.querySelector('.ag-mread')));
  // a long press on the stack: see all at once too
  const sk = await (await page.$('.ag-stack')).boundingBox();
  await page.mouse.move(sk.x + sk.width / 2, sk.y + sk.height / 2); await page.mouse.down(); await sleep(700); await page.mouse.up(); await sleep(900);
  check('a long press on the stack fans the letters out (and no letter pane)', await page.evaluate(() => ui.letters.isFanned && !ui.letters.isCompact));
  await page.click('.ag-fan__gather'); await sleep(900);
  check('"gather them up" folds the table away', await page.evaluate(() => !ui.letters.isFanned && !document.querySelector('.ag-fan'))); }
await page.evaluate(() => { ui.letters.variant = 'b'; ui.letters.open('L1'); }); await sleep(1500);
check('variant B: the letter laid on a desk with the opened envelope beside it', await page.evaluate(() => !!document.querySelector('.ag-read--b .ag-desk .ag-desk__env .ag-big__flapwrap.is-open') && !!document.querySelector('.ag-desk .ag-letter')));
await page.keyboard.press('Escape'); await sleep(700);
check('Esc folds it away', await page.evaluate(() => !ui.letters.openId));
await page.evaluate(() => { ui.letters.variant = 'a'; });

// ---------- notices: one at a time ----------
const nid = await page.evaluate(() => ui.notice('We have never built a lighthouse.', { kind: 'ministry', progress: 0.1, stage: 'drafting plans' }));
const n2 = await page.evaluate(() => ui.notice('Two pips arrived.', { ttl: 0 })); await sleep(300);
check('two live notices -> only the newest shows', await page.evaluate(() => document.querySelectorAll('.ag-notice.is-shown').length === 1 && document.querySelector('.ag-notice.is-shown').textContent.includes('pips')));
await page.evaluate(id => ui.updateNotice(id, { progress: 0.7, stage: 'painting' }), nid);
await page.evaluate(id => ui.closeNotice(id), n2); await sleep(1100);
check('when it closes, the one under it returns, its pencil moved + stage updated', await page.evaluate(() => { const n = document.querySelector('.ag-notice.is-shown'); if (!n) return false; const p = n.querySelector('.ag-scribble path:not(.ghost)'); return Math.abs(parseFloat(getComputedStyle(p).strokeDashoffset) - 0.3) < 0.02 && n.querySelector('.ag-notice__stage').textContent === 'painting'; }));
await page.evaluate(id => ui.closeNotice(id), nid); await sleep(700);
check('closeNotice removes it', await page.evaluate(() => !document.querySelector('.ag-notice')));

// ---------- ledger ----------
await page.keyboard.press('Tab'); await sleep(300);
check('Tab opens the ledger (one paper sheet)', await page.evaluate(() => ui.ledger.isOpen && document.querySelectorAll('.ag-ledger').length === 1));
check('ledger: minister seal + name, neighbours with attitude, stores, prosperity', await page.evaluate(() => { const l = document.querySelector('.ag-ledger'); return /Olla/.test(l.querySelector('.ag-ledger__min').textContent) && l.querySelectorAll('.ag-ledger__nb').length === 2 && /cordial/.test(l.textContent) && /cold/.test(l.textContent) && /38/.test(l.querySelector('.ag-ledger__res').textContent) && /42/.test(l.querySelector('.ag-ledger__pros').textContent); }));
check('neighbour shields follow the leading species (drop pink)', await page.evaluate(() => document.querySelector('.ag-ledger__shield svg path').getAttribute('fill') === '#f15060'));
const links = await page.$$('.ag-ledger__acts .ag-link');
await links[1].click(); c = await calls();
check('Send gift -> onAgentAction("neighbour:n1", "gift")', c.length === 1 && c[0][1] === 'neighbour:n1' && c[0][2] === 'gift', c);
await page.evaluate(() => ui.offlineNote(true));
check('offlineNote -> a tiny note in the ledger only', await page.evaluate(() => !!document.querySelector('.ag-ledger .ag-ledger__offline') && !document.querySelector('.ag-offline')));
await page.keyboard.press('Escape'); await sleep(400);
check('Esc closes the ledger', await page.evaluate(() => !ui.ledger.isOpen));
await page.keyboard.press('Tab'); await sleep(300);
check('Tab opens the ledger again (§24: no settlement name to click)', await page.evaluate(() => ui.ledger.isOpen));
await page.mouse.click(900, 500); await sleep(400);
check('outside click closes the ledger', await page.evaluate(() => !ui.ledger.isOpen));
await page.evaluate(() => ui.ministerSeal.set({ id: 'a2', name: 'Brusk' })); await sleep(200);
check('a new minister is said once, as a quiet notice', await page.evaluate(() => /Brusk now carries/.test(document.querySelector('.ag-notice.is-shown')?.textContent || '')));

// ---------- agent card ----------
await page.evaluate(() => ui.agentCard.show({ id: 'a3', name: 'Pell', species: 'flit', trade: 'scout', workplace: 'the lookout', traits: ['curious', 'loyal'], venture: { name: 'a boat workshop', status: 'proposed' }, skills: { building: 8, scouting: 6 }, known: { building: true }, mood: 40 }, { x: 1400, y: 880 }));
const cb = await page.$eval('.ag-card', e => { const r = e.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom, r.width]; });
check('agent card small and on screen near a corner click', cb[0] >= 0 && cb[1] >= 0 && cb[2] <= 1440 && cb[3] <= 900 && cb[4] <= 320, cb);
check('card v2: name, species, job + workplace, venture, traits with plain meanings, mood word', await page.evaluate(() => { const c = document.querySelector('.ag-card'); return c.querySelector('.ag-card__name').textContent === 'Pell' && /a flit/.test(c.querySelector('.ag-card__sp').textContent) && /Scout at the lookout/.test(c.querySelector('.ag-card__job').textContent) && /asked to open a boat workshop/.test(c.querySelector('.ag-card__venture').textContent) && /curious.*asks about everything/.test(c.querySelector('.ag-card__traits').textContent) && /loyal.*sticks with you/.test(c.querySelector('.ag-card__traits').textContent) && /content|grumbling/.test(c.querySelector('.ag-card__mood').textContent); }));
check('card v2: all 8 skills, the known one ticked, the unknown ones "?"', await page.evaluate(() => { const sk = [...document.querySelectorAll('.ag-card .ag-skill')]; return sk.length === 8 && sk.filter(s => s.querySelector('.ticks')).length === 1 && sk.filter(s => s.querySelector('.q')?.textContent === '?').length === 7; }));
// §15: the card's header is the folk's painted portrait (the species seal until it arrives), the minister's seal a badge on it
check('card header: the species seal stands in until the portrait arrives', await page.evaluate(() => { const f = document.querySelector('.ag-card .ag-card__face .ag-face'); return !!f && !f.querySelector('img') && !!f.querySelector('svg') && !document.querySelector('.ag-card .ag-card__seal'); }));
await page.evaluate(() => ui.setPortrait('a3', 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="#8fc46a"/></svg>')));
check('…then ui.setPortrait(id) puts the painted portrait in the header', await page.evaluate(() => !!document.querySelector('.ag-card .ag-card__face .ag-face img')));
// §15 bug: the sim's job label already names the place ("farmer at the Field") and the workplace is "Field" too
await page.evaluate(() => ui.agentCard.show({ id: 'a5', name: 'Tilde', species: 'flit', job: 'farmer at the Field', workplace: 'Field', mood: 60 }, { x: 700, y: 400 }, { isMinister: true }));
check('the workplace is said once: "Farmer at the Field" (not "at the Field at the Field")', await page.evaluate(() => { const t = document.querySelector('.ag-card__job').textContent.replace(/\s+/g, ' ').trim(); return t === 'Farmer at the Field'; }), await page.evaluate(() => document.querySelector('.ag-card__job').textContent));
check('a minister: the red seal is a small badge on the portrait', await page.evaluate(() => !!document.querySelector('.ag-card__face .ag-card__minseal')));
check('jobOf: sim labels + workplace names never repeat the place', await page.evaluate(async () => { const { jobOf } = await import('./js/ui/words.js'); const t = (a, w) => { const j = jobOf(a, { workplace: () => w }); return [j.title, j.place].join('|'); };
  return t({ job: 'farmer at the Field' }, 'Field') === 'farmer|the Field' && t({ job: 'builder at the Windmill site' }, 'Windmill') === 'builder|the Windmill site' && t({ job: 'forager at the camp' }, null) === 'forager|the camp' && t({ job: 'keeper of the Tea house' }, 'Tea house') === 'keeper of the Tea house|' && t({ trade: 'baker', workplace: 'the bakery' }, 'X') === 'baker|the bakery'; }));
await page.evaluate(() => ui.agentCard.show({ id: 'a3', name: 'Pell', species: 'flit', trade: 'scout', workplace: 'the lookout', traits: ['curious', 'loyal'], venture: { name: 'a boat workshop', status: 'proposed' }, skills: { building: 8, scouting: 6 }, known: { building: true }, mood: 40 }, { x: 1400, y: 880 }));
await page.click('.ag-card__minbtn'); c = await calls();
check('Make minister -> onAgentAction(id, "minister")', c.length === 1 && c[0][1] === 'a3' && c[0][2] === 'minister', c);
await page.click('.ag-card__talkbtn'); await sleep(250); c = await calls();
check('Talk -> onAgentAction(id, "talk") + a one-line input under the folk, focused', c.some(x => x[2] === 'talk') && (await page.evaluate(() => ui.talk.isOpen && ui.talk.target === 'a3' && document.activeElement === document.querySelector('.ag-talk__input') && ui.voiceBar.isTyping())), c);
await page.evaluate(() => { window.leaked.length = 0; }); await page.keyboard.type('hello there'); await page.keyboard.press('Enter'); await sleep(120);
check('typed talk -> onTalk(agentId, text, {source:"typed"}); thinking bubble; no hotkey leaks', await page.evaluate(() => { const t = window.calls.find(x => x[0] === 'onTalk'); return t && t[1] === 'a3' && t[2] === 'hello there' && t[3].source === 'typed' && !!document.querySelector('.ag-bubble.is-thinking'); }) && (await page.evaluate(() => window.leaked.filter(k => k !== 'Enter').length)) === 0);
await page.evaluate(() => ui.talk.reply('a3', 'Hello! I watch the hills.')); await sleep(300);
check('talk.reply -> the paper speech bubble + the card scrollback (you / Pell)', await page.evaluate(() => document.querySelector('.ag-bubble__txt').textContent === 'Hello! I watch the hills.' && [...document.querySelectorAll('.ag-card__said')].map(e => e.textContent).join('|') === 'youhello there|PellHello! I watch the hills.'));
await page.evaluate(() => { for (let i = 0; i < 4; i++) { ui.talk.say('q' + i, { agentId: 'a3' }); ui.talk.reply('a3', 'a' + i); } });
check('card scrollback keeps the last 4 lines', await page.evaluate(() => document.querySelectorAll('.ag-card__said').length === 4 && /a3$/.test(document.querySelector('.ag-card__said:last-child').textContent)));
check('the talk line is on screen and clear of the card', await page.evaluate(() => { const a = document.querySelector('.ag-talk').getBoundingClientRect(), b = document.querySelector('.ag-card').getBoundingClientRect(); return a.left >= 0 && a.top >= 0 && a.right <= innerWidth && !(a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top); }));
await page.keyboard.press('Escape'); await sleep(100);
check('Esc in the talk line closes it (the card stays)', await page.evaluate(() => !ui.talk.isOpen && !!ui.agentCard.el));
await page.evaluate(() => { window.calls.length = 0; ui.talk.say('how are you', { source: 'voice' }); });
check('voice while a folk is selected: talk.target is that folk, talk.say routes there', await page.evaluate(() => { const t = window.calls.find(x => x[0] === 'onTalk'); return ui.talk.target === 'a3' && t && t[1] === 'a3' && t[3].source === 'voice'; }));
await calls();
await page.keyboard.press('Escape'); await sleep(300);

// ---------- meeting + decree + director ----------
await page.evaluate(() => ui.meeting.show({ title: 'A meeting', report: 'All is well.', options: [{ label: 'carry on', says: 'Carry on' }] })); await sleep(1100);
check('meeting band sets --ag-band-b', await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ag-band-b')) > 50));
await page.click('.ag-band__opts .ag-reply'); c = await calls();
check('meeting option -> onLetterOption("meeting", says)', c.length === 1 && c[0][1] === 'meeting' && c[0][2] === 'Carry on', c);
await page.evaluate(() => ui.meeting.hide()); await sleep(700);
check('meeting hide resets band', await page.evaluate(() => !document.querySelector('.ag-meeting') && getComputedStyle(document.documentElement).getPropertyValue('--ag-band-b').trim() === '0px'));
await page.evaluate(() => ui.decree.show({ id: 'env', title: 'Earth’s envoy', honour: 'Earth’s envoy', body: 'Speak for Earth.', shields: ['n1'], options: [{ label: 'to the moon', says: 'Let’s go to the moon' }] })); await sleep(900);
await page.click('.ag-decree__opts .ag-reply'); c = await calls();
check('decree option -> onLetterOption(id, says) + the honour under the name', c.length === 1 && c[0][1] === 'env' && c[0][2] === 'Let’s go to the moon' && (await page.$eval('.ag-place__honour', e => !e.hidden && e.textContent === 'Earth’s envoy')), c);
await page.evaluate(() => ui.showDirectorCaption('You *speak*.', { kicker: 'I' }));
check('director line renders, *word* in red italic', await page.evaluate(() => document.querySelector('.ag-director em').textContent === 'speak'));
await page.evaluate(() => ui.hideDirectorCaption());

// ---------- the opening: fleet caption, election ----------
await page.evaluate(() => ui.fleet.caption({ name: 'The Builders', counts: { flit: 4, floatie: 2 }, index: 1, total: 5 })); await sleep(300);
check('fleet caption: name + "four flits · two floaties" + kicker', await page.evaluate(() => { const f = document.querySelector('.ag-fleet'); return /The Builders/.test(f.textContent) && /four flits\s*·\s*two floaties/.test(f.querySelector('.ag-fleet__line').textContent) && /Fleet one of five/i.test(f.querySelector('.ag-fleet__k').textContent); }));
await page.evaluate(() => ui.fleet.hide()); await sleep(700);
check('fleet caption hides', await page.evaluate(() => !document.querySelector('.ag-fleet')));
await page.evaluate(() => ui.election.prompt()); await sleep(300);
check('election prompt: "Choose your minister — click one of them", clicks pass through to the world', await page.evaluate(() => { const e = document.querySelector('.ag-elect'); return /Choose your minister\s*—\s*click one of them/.test(e.querySelector('.ag-elect__line').textContent) && getComputedStyle(e).pointerEvents === 'none' && ui.election.active; }));
await page.evaluate(() => ui.agentCard.show({ id: 'a1', name: 'Olla', species: 'floatie', trade: 'diplomat' }, { x: 500, y: 400 }));
check('during the election the card offers Talk but not Make minister', await page.evaluate(() => !!document.querySelector('.ag-card__talkbtn') && !document.querySelector('.ag-card__minbtn')));
await page.evaluate(() => { ui.agentCard.hide(); window.__el = ui.election.elected({ id: 'a1', name: 'Olla', species: 'floatie', trade: 'diplomat' }, { ttl: 1200 }); }); await sleep(300);
check('elected: the seal moment says "Olla is your minister", the seal is set', await page.evaluate(() => /Olla is your minister/.test(document.querySelector('.ag-elected__line').textContent) && ui.ministerSeal.agentId === 'a1' && !document.querySelector('.ag-elect:not(.is-out)')));
await page.evaluate(() => window.__el); await sleep(900);
check('after the moment: election over, card offers Make minister again', await page.evaluate(() => { ui.agentCard.show({ id: 'a2', name: 'Brusk', species: 'flit' }, { x: 500, y: 400 }); return !ui.election.active && !document.querySelector('.ag-elected') && !!document.querySelector('.ag-card__minbtn'); }));
await page.evaluate(() => ui.agentCard.hide());

// ---------- the inbox with many letters ----------
await page.evaluate(() => { const L = []; for (let i = 0; i < 30; i++) L.push({ id: 'B' + i, from: { kind: 'agent', id: 'a1', name: 'Olla' }, subject: 'Letter ' + i, body: 'Hi', day: 1 + (i % 9), read: i % 3 === 0, resolved: i % 5 === 0 }); ui.letters.setLetters(L); ui.letters.fan(); }); await sleep(1400);
check('30 letters fan out, every card on screen, unread raised, answered dimmed', await page.evaluate(() => { const m = [...document.querySelectorAll('.ag-mail')]; const on = m.every(e => { const r = e.getBoundingClientRect(); return r.left >= -2 && r.top >= 0 && r.right <= innerWidth + 2 && r.bottom <= innerHeight; }); const un = m.find(e => e.classList.contains('is-unread')), rs = m.find(e => e.classList.contains('is-resolved')); return m.length === 30 && on && getComputedStyle(un).translate.includes('-6') && +getComputedStyle(rs).opacity < .9; }));
check('the top strip (seal + sender) of every card can be hit', await page.evaluate(() => [...document.querySelectorAll('.ag-mail')].every(e => { const r = e.querySelector('.ag-mail__from').getBoundingClientRect(); const t = document.elementFromPoint(r.left + 6, r.top + r.height / 2); return t && t.closest('.ag-mail') === e; })));
await page.evaluate(() => ui.letters.addLetter({ id: 'NEW', from: { kind: 'agent', id: 'a2', name: 'Brusk' }, subject: 'Fresh', body: 'x', day: 9 })); await sleep(900);
check('a letter arriving while the table is open lands on it', await page.evaluate(() => !!document.querySelector('.ag-mail[data-id="NEW"]') && document.querySelectorAll('.ag-mail').length === 31));
await page.evaluate(() => ui.letters.gather()); await sleep(900);

// ---------- talk with no answer from the game (mock mode): the folk's own plain words ----------
await fresh({ noTalk: true });
await page.evaluate(() => { ui.agentCard.show({ id: 'a1', name: 'Olla', species: 'floatie', trade: 'baker', workplace: 'the bakery', mood: 70 }, { x: 600, y: 400 }); ui.talk.open('a1', { focus: false }); ui.talk.say('what do you do?', { agentId: 'a1' }); }); await sleep(1200);
check('mock mode: no onTalk -> a short plain reply in the bubble', await page.evaluate(() => document.querySelector('.ag-bubble__txt').textContent === 'I am a baker. I work at the bakery.'));
await fresh({ noTalk: true, bubbleHook: true });
await page.evaluate(() => { ui.agentCard.show({ id: 'a1', name: 'Olla', species: 'floatie', mood: 70 }, { x: 600, y: 400 }); ui.talk.say('hello', { agentId: 'a1', source: 'voice' }); }); await sleep(1200);
check('a bubble hook (agents.bubble) draws the reply instead of the UI', await page.evaluate(() => window.bubbles.length === 2 && window.bubbles[1][1].startsWith('Hello! I am Olla') && !document.querySelector('.ag-bubble:not([hidden])')));

// ---------- onboarding (§24): ONE panel on the lower half, six steps, no welcome letter ----------
await fresh();
await page.evaluate(() => ui.onboarding.start()); await sleep(700);
check('the onboarding panel shows step 1 on the lower half (no welcome letter)', await page.evaluate(() => { const g = document.querySelector('.ag-guide.is-on'), r = g && g.getBoundingClientRect(); return !!g && r.top > innerHeight * .45 && /R-99/.test(g.querySelector('.ag-guide__title').textContent) && ui.onboarding.current === 1 && !ui.letters.all.length && /montserrat/i.test(getComputedStyle(g).fontFamily); }));
check('step dots (9) and a Continue button', await page.evaluate(() => document.querySelectorAll('.ag-guide__dots > i').length === 9 && /continue/i.test(document.querySelector('.ag-guide__btn').textContent)));
await page.click('.ag-guide__btn'); await sleep(400);
check('Continue -> step 2 (meet your residents)', await page.evaluate(() => ui.onboarding.current === 2 && /residents/i.test(document.querySelector('.ag-guide__title').textContent)));
for (let k = 3; k <= 9; k++) await page.evaluate(n => ui.onboarding.step(n), k);
check('the last step: the Ministry takes it from here', await page.evaluate(() => ui.onboarding.current === 9 && /Ministry/i.test(document.querySelector('.ag-guide__title').textContent) && /details from here/.test(document.querySelector('.ag-guide__body').textContent)));
await page.evaluate(() => ui.onboarding.step(10)); c = await calls();
check('finishing -> onOnboardingDone({skipped:false}), the panel goes', c.length === 1 && c[0][0] === 'onOnboardingDone' && c[0][1].skipped === false && !(await page.evaluate(() => ui.guide.visible)), c);
await page.evaluate(() => ui.onboarding.start()); await sleep(300);
await page.click('.ag-guide__skip'); c = await calls();
check('Skip tutorial -> onOnboardingDone({skipped:true})', c.length === 1 && c[0][1].skipped === true, c);

// ---------- idle hint ----------
await fresh({ hintIdleMs: 700 }); await sleep(1300);
check('after idle: at most one faint hint line, never a chip bar', await page.evaluate(() => document.querySelectorAll('.ag-hint:not([hidden])').length === 1 && !!document.querySelector('.ag-hint__say') && !document.querySelector('.ag-voice__chips')));
await page.click('.ag-hint__say'); c = await calls();
check('clicking the hint phrase -> onCommand(text, "chip")', c.length === 1 && c[0][2] === 'chip', c);

check('no page errors', errors.length === 0, errors);
await browser.close(); server.kill();
const pass = results.every(Boolean); console.log(pass ? `\nALL ${results.length} PASS` : `\n${results.filter(r => !r).length} FAIL`); process.exit(pass ? 0 : 1);
