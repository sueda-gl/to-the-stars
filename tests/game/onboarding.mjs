// The first-time flow with the §24 onboarding (ART_DIRECTION §24), headless at dpr 2, every step completed by actually
// doing it: the title, Begin, the landing, (1) Continue, (2) the roll-call, (3) a resident's letter opened from the
// mailbox (the icon hides while the list is open), (4) a build TYPED into the line, (5) a minister elected by a real
// click on a folk, (6) a request letter opened, then free play: no tags over heads, red dots for unread mail, at most two
// speech bubbles, Montserrat, no blue. Shots: shots/game/onboarding/*.png (full size).
//   node tests/game/onboarding.mjs [--url http://localhost:8870/?minds=mock] [--dpr 2]
import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const URL0 = arg('url', 'http://localhost:8870/?minds=mock');
const DPR = +arg('dpr', 2);
const OUT = path.join(ROOT, 'shots/game/onboarding');
mkdirSync(OUT, { recursive: true });
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new',
  args: ['--use-angle=metal', '--enable-unsafe-swiftshader', '--window-size=1440,900', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required'],
  defaultViewport: { width: 1440, height: 900, deviceScaleFactor: DPR } });
const page = await b.newPage();
const errs = [];
page.on('pageerror', e => { errs.push(e.message); console.log('[pageerror]', e.message); });
page.on('console', m => { if (m.type() === 'error' && !/favicon|404|Failed to load resource/.test(m.text())) console.log('[console.error]', m.text().slice(0, 240)); });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ev = (fn, ...a) => page.evaluate(fn, ...a);
const t0 = Date.now(), T = () => ((Date.now() - t0) / 1000).toFixed(1) + 's';
let pass = 0, fail = 0;
const check = (ok, what, got) => { if (ok) pass++; else fail++; console.log(`${ok ? 'PASS' : 'FAIL'} ${T()} ${what}${ok || got === undefined ? '' : '  got ' + JSON.stringify(got)}`); };
const shot = async name => { await page.screenshot({ path: path.join(OUT, name + '.png') }); console.log('  shot', name); };
async function until(fn, ms = 20000, every = 200, ...a) { const t = Date.now(); while (Date.now() - t < ms) { try { if (await ev(fn, ...a)) return true; } catch (_) {} await sleep(every); } return false; }
const step = () => ev(() => window.__agora && __agora.onboarding ? __agora.onboarding.current : -1);
// the step's button: on the strip, or the ▸ on the corner pill when it has tucked itself away
async function cont() { const pill = await ev(() => __agora.ui.guide.collapsed); if (pill) await page.click('.ag-guide-pill__go'); else await page.click('.ag-guide__btn'); await sleep(400); }
async function chip(re) { if (await ev(() => __agora.ui.guide.collapsed)) { await page.click('.ag-guide-pill'); await sleep(600); } await ev(src => { const r = new RegExp(src, 'i'); const c = [...document.querySelectorAll('.ag-guide__chip')].find(x => r.test(x.textContent)); c && c.click(); }, re.source); await sleep(400); }

await page.goto(URL0, { waitUntil: 'load' });
check(await until(() => window.__agora && __agora.ui && __agora.ui.titleCard.visible, 90000, 300), 'the title card is up');
await sleep(1500);
await shot('00-title');
// the title: the pop face (Titan One), everything else Montserrat
const fonts = await ev(() => ({ title: getComputedStyle(document.querySelector('.tt__name')).fontFamily, pop: document.querySelector('.tt').dataset.font, stars: document.querySelectorAll('.tt__star').length, ui: getComputedStyle(document.querySelector('.ag-ui')).fontFamily }));
check(/montserrat/i.test(fonts.ui) && /Titan/.test(fonts.title) && fonts.pop === 'pop' && fonts.stars >= 3, 'the pop title (Titan One, stars); the game UI in Montserrat', fonts);
await page.click('.tt__begin');
check(await until(() => __agora.onboarding.current === 1, 60000), 'after the landing: onboarding step 1 (welcome)');
await sleep(2600);
const s1 = await ev(() => ({ title: document.querySelector('.ag-guide__title').textContent, body: document.querySelector('.ag-guide__body').textContent, font: getComputedStyle(document.querySelector('.ag-guide__title')).fontFamily,
  bottom: document.querySelector('.ag-guide__card').getBoundingClientRect().bottom, top: document.querySelector('.ag-guide__card').getBoundingClientRect().top,
  place: !!document.querySelector('.ag-place') && getComputedStyle(document.querySelector('.ag-place')).display !== 'none', fleet: !!document.querySelector('.ag-fleet'), elect: !!document.querySelector('.ag-elect'),
  letters: __agora.ui.letters.all.map(l => l.subject) }));
check(/R-99/.test(s1.title) && /country/.test(s1.body), 'step 1 says welcome to planet R-99', s1);
check(s1.top > 600 && s1.bottom - s1.top < 190 && /montserrat/i.test(s1.font), 'a SLIM strip low on the screen, in Montserrat', s1);
check(!s1.place, 'no "Agora" name top-left', s1);
check(!s1.letters.some(t => /welcome, founder/i.test(t)), 'no "Welcome, founder" letter', s1.letters);
await shot('01-step1-welcome');
await cont();
check(await until(() => __agora.onboarding.current === 2, 5000), 'Continue -> step 2 (meet your residents)');
check(await until(() => !document.querySelector('.ag-guide__aside').hidden, 8000), 'step 2: every resident in ONE panel line (no tour, no caption per fleet)');
await sleep(2600);
const s2 = await ev(() => ({ aside: document.querySelector('.ag-guide__aside').textContent, fleet: !!document.querySelector('.ag-fleet') }));
check(!s2.fleet && /residents/.test(s2.aside), 'no fleet caption; the census in the panel', s2);
await shot('02-step2-residents');
await cont();
check(await until(() => __agora.onboarding.id === 'letters', 20000), 'Continue: the squares break, the folk go to work -> the letters step');
check(await until(() => __agora.ui.letters.all.length >= 1, 15000), 'a resident\'s letter arrives');
check(await until(() => !!document.querySelector('.ag-maildot.is-teach.is-on'), 15000), 'a BIG pulsing red dot over the writer (the camera frames them)');
const s3 = await ev(() => ({ title: document.querySelector('.ag-guide__title').textContent, ring: document.querySelector('.ag-guide-ring').classList.contains('is-on'), tags: document.querySelectorAll('.agt:not(.off)').length }));
check(/has written to you/.test(s3.title) && s3.tags === 0, 'the step names the writer: "… has written to you"; no tags over heads', s3);
await sleep(1200);
await shot('03-letters-red-dot');
await sleep(5200);
check(await ev(() => __agora.ui.guide.collapsed && !!document.querySelector('.ag-guide-pill.is-on')), 'after the read the strip tucks itself into the corner pill');
await shot('03b-pill');
await page.click('.ag-maildot.is-teach.is-on'); await sleep(900);
check(await until(() => __agora.ui.letters.isOpen && __agora.ui.letters.openId === __agora.onboarding.state.sent.welcome, 4000), 'a click on the red dot opens the letter');
const lt = await ev(() => ({ chips: document.querySelectorAll('.ag-mread .ag-reply:not(.is-quiet)').length, write: !!document.querySelector('.ag-mread__winput') }));
check(lt.chips <= 2 && lt.write, 'the letter: at most two choices and a "Write back…" field', lt);
await page.click('.ag-mread__winput'); await page.keyboard.type('Welcome to you too! How are you all?', { delay: 10 }); await page.keyboard.press('Enter');
check(await until(() => document.querySelectorAll('.ag-mread__msg:not(.is-wait)').length >= 2, 20000), 'written back: the resident answers in the letter\'s thread');
await sleep(600);
await shot('04-letter-thread');
check(await until(() => __agora.onboarding.id === 'build', 9000), 'the letter opened from the dot -> the build step');
for (let i = 0; i < 3 && await ev(() => __agora.ui.notify.column.isOpen); i++) { await page.keyboard.press('Escape'); await sleep(400); }
await sleep(2400);
await shot('05-step-build');
await chip(/type it/i);
check(await ev(() => __agora.ui.voiceBar.typingOpen), 'the "Type it" chip opens the typed line');
await page.keyboard.type('a windmill by the lake', { delay: 20 });
await page.keyboard.press('Enter');
check(await until(() => __agora.onboarding.state.built, 90000, 400), 'the typed build lands (building:site)');
await sleep(900);
await shot('06-build-success');
check(await until(() => __agora.onboarding.id === 'mark', 12000), 'the first build -> mark the land');
await sleep(1500);
await shot('07-step-mark');
// a real left click on bare ground: the pencil ✕
let marked = false;
for (const [fx, fy] of [[.3, .56], [.68, .5], [.4, .35], [.6, .62]]) {
  if (marked) break;
  await page.mouse.click(1440 * fx, 900 * fy); await sleep(900);
  marked = await ev(() => !!__agora.onboarding.state.done.mark);
}
check(marked, 'a click on the ground leaves a mark -> the step completes');
await shot('08-mark-success');
check(await until(() => __agora.onboarding.id === 'minister', 12000), '-> pick a minister');
await sleep(2600);
await shot('09-step-minister');
let elected = false;
for (let i = 0; i < 6 && !elected; i++) {
  const p = await ev(() => { const A = __agora.game.state.agents.filter(a => a.status !== 'left').sort((a, b) => ((b.skills || {}).diplomacy || 0) - ((a.skills || {}).diplomacy || 0)); for (const a of A) { const s = __agora.agents.screenOf(a.id); if (s && s.x > 80 && s.x < innerWidth - 80 && s.y > 120 && s.y < innerHeight - 200) return { id: a.id, x: s.x, y: s.y }; } return null; });
  if (p) { await page.mouse.move(p.x, p.y + 4); await sleep(200); await page.mouse.down(); await page.mouse.up(); }
  elected = await until(() => !!__agora.game.state.minister, 2500);
}
check(elected, 'a click on a folk elects the minister');
await sleep(1600);
await shot('10-minister-elected');
check(await until(() => __agora.onboarding.id === 'neighbours', 30000), 'the ceremony, then the neighbours step');
check(await until(() => { const id = __agora.onboarding.state.sent.neighbour; return id && __agora.ui.letters.all.some(l => l.id === id); }, 20000), 'a nation\'s letter arrives (an envoy)');
await sleep(1200);
await shot('11-step-neighbours');
await page.click('.ag-stack'); await sleep(700);
await ev(() => { const id = __agora.onboarding.state.sent.neighbour; const r = document.querySelector(`.ag-mailcol__item[data-note="n:${id}"] .ag-mailcol__main`) || document.querySelector('.ag-mailcol__item.is-unread .ag-mailcol__main'); r && r.click(); });
check(await until(() => !!__agora.onboarding.state.done.neighbours, 5000), 'their letter opened -> done');
await sleep(800);
await shot('12-neighbour-letter');
check(await until(() => __agora.onboarding.id === 'future', 9000), '-> peek at the future');
for (let i = 0; i < 3 && await ev(() => __agora.ui.notify.column.isOpen); i++) { await page.keyboard.press('Escape'); await sleep(400); }
await sleep(800);
const fu = await ev(() => ({ sw: !!document.querySelector('.ag-guide .ag-future'), ready: __agora.futureToggle.ready, body: document.querySelector('.ag-guide__body').textContent }));
check(fu.sw && /developed civilisation/.test(fu.body), 'the future step: a pop toggle in the panel', fu);
await shot('13-step-future');
if (fu.ready) {
  await page.click('.ag-guide .ag-future');
  check(await until(() => __agora.futureToggle.on && !(__agora.game.future && __agora.game.future.busy), 30000), 'toggle on: the developed civilisation (game.future.enter)');
  await sleep(1500); await shot('13b-future-on');
  await page.click('.ag-guide .ag-future');
  check(await until(() => !__agora.futureToggle.on && !(__agora.game.future && (__agora.game.future.busy || __agora.game.future.active)), 30000), 'toggle off: back to her real early game (game.future.exit)');
}
else await cont();
check(await until(() => /lots to build/.test(document.querySelector('.ag-guide')?.textContent + document.querySelector('.ag-guide-pill')?.textContent), 6000), '"Now let\'s go, we have lots to build!"');
check(await until(() => __agora.onboarding.id === 'ministry', 8000), '-> the Ministry step');
await sleep(1500);
const gl = await ev(() => ({ on: !!document.querySelector('.ag-goals.is-on'), items: [...document.querySelectorAll('.ag-goals__item')].map(e => e.textContent), body: document.querySelector('.ag-guide__body').textContent }));
check(gl.on && gl.items.length >= 3 && /homes/i.test(gl.items.join(' ')) && /details from here/.test(gl.body), 'the Ministry\'s first jobs (homes, a bakery, a field…) and "The Ministry will tell you the details from here"', gl);
await shot('14-step-ministry');
// a call with the Ministry, typed: babble (WebAudio nodes) + the subtitle
await page.click('.ag-callbtn'); await sleep(900);
check(await ev(() => __agora.ministry.call.isOpen && !!document.querySelector('.ag-call.is-on .ag-call__face')), 'Call the Ministry: a compact call card with the minister\'s face');
await page.click('.ag-call__input'); await page.keyboard.type('What should I build next?', { delay: 15 }); await page.keyboard.press('Enter');
check(await until(() => (__agora.ministry.call.log.filter(l => l.who === 'minister').length >= 2), 15000), 'the minister answers');
await sleep(1500);
const cl = await ev(() => ({ sub: document.querySelector('.ag-call__sub').textContent, stats: __agora.ministry.call.babble.stats }));
check(cl.stats.context && cl.stats.nodes > 20 && cl.stats.syllables > 5 && cl.stats.state === 'running', 'the answer is babbled: WebAudio running, oscillator nodes created', cl.stats);
check(/build|house|home|job/i.test(cl.sub), 'the live translation says what to build next', cl.sub);
await shot('15-ministry-call');
await page.click('.ag-call__x'); await sleep(500);
await cont();
check(await until(() => __agora.onboarding.current === 0 && __agora.onboarding.state.finished, 8000), 'Start playing: the onboarding is done; the game runs');
check(await ev(() => !document.querySelector('.ag-future--dock').hidden), 'the future switch stays in a small corner spot');
for (let i = 0; i < 3 && await ev(() => __agora.ui.notify.column.isOpen); i++) { await page.keyboard.press('Escape'); await sleep(450); }
await sleep(400);
check(await ev(() => !__agora.ui.notify.column.isOpen && +getComputedStyle(document.querySelector('.ag-stack')).opacity > .9), 'Esc folds the mailbox away; its icon comes back');
// free play: the leader view, red dots, no tags, bubbles rare
let maxB = 0;
for (let i = 0; i < 20; i++) { maxB = Math.max(maxB, await ev(() => document.querySelectorAll('.agb.on').length)); await sleep(500); }
check(maxB <= 2, 'at most two speech bubbles at a time', maxB);
await shot('12-free-play');
// close over a folk with a red dot: the dot, no tag, the card on click
const dotted = await ev(() => { const d = __agora.mailDots.list()[0]; if (!d) return null; const a = __agora.game.state.agents.find(x => x.id === d.agentId); return a ? { id: a.id, x: a.x, z: a.z } : null; });
if (dotted) {
  await ev(p => __agora.world.focus(p.x, p.z, { dist: 16, pitch: 0.5, ms: 1200 }), dotted); await sleep(2200);
  check(await ev(id => __agora.mailDots.list().some(d => d.agentId === id && d.on), dotted.id), 'close up: the red dot sits over the sender');
  await shot('13-red-dot-close');
  const s = await ev(id => __agora.agents.screenOf(id), dotted.id);
  if (s) { await page.mouse.click(s.x, s.y + 16); await sleep(900); }
  check(await ev(() => !!__agora.ui.agentCard.el), 'a click on the folk still opens its card');
  await shot('14-card');
  await page.keyboard.press('Escape'); await sleep(300);
}
await page.click('.ag-stack'); await sleep(800);
await shot('15-mailbox-open');
const end = await ev(() => ({ guide: __agora.ui.guide.visible, tags: document.querySelectorAll('.agt:not(.off)').length, dots: __agora.mailDots.list().filter(d => d.on).length,
  blue: [...document.querySelectorAll('.ag-ui *')].filter(e => /rgb\(61, 85, 136\)/.test(getComputedStyle(e).color)).length, minister: __agora.game.state.minister, errors: __agora.errors.slice() }));
check(!end.guide && end.tags === 0, 'free play: no panel, no tags', end);
check(end.blue === 0, 'no blue ink left in the UI', end.blue);
check(end.errors.length === 0 && errs.length === 0, 'no page errors', { errors: end.errors, errs });
console.log(`\n${fail ? fail + ' FAIL' : 'ALL ' + pass + ' PASS'} in ${T()}`);
await b.close();
process.exit(fail ? 1 : 0);
