// "Call the Ministry" (ui/call.js + ui/babble.js + game/ministry.js), headless at dpr 2: the button under the mailbox in
// #ministry-call-slot, the call opens, a typed question gets a reply typed as a subtitle in step with the babble, and
// the WebAudio oscillators are really created. First the Ministry clerk (no minister), then an elected minister.
//   node tests/ui/ministry-call.mjs [--url http://localhost:8881/?minds=mock] [--dpr 2]
import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const URL0 = arg('url', 'http://localhost:8881/?minds=mock');
const DPR = +arg('dpr', 2);
const OUT = path.join(ROOT, 'shots/ui/ministry-call');
mkdirSync(OUT, { recursive: true });
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new',
  args: ['--use-angle=metal', '--enable-unsafe-swiftshader', '--window-size=1440,900', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required'],
  defaultViewport: { width: 1440, height: 900, deviceScaleFactor: DPR } });
const page = await b.newPage();
page.on('pageerror', e => console.log('[pageerror]', e.message));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ev = (fn, ...a) => page.evaluate(fn, ...a);
let pass = 0, fail = 0;
const check = (ok, what, got) => { if (ok) pass++; else fail++; console.log(`${ok ? 'PASS' : 'FAIL'} ${what}${ok || got === undefined ? '' : '  got ' + JSON.stringify(got)}`); };
const shot = async name => { await page.screenshot({ path: path.join(OUT, name + '.png') }); console.log('  shot', name); };
async function until(fn, ms = 20000, every = 200) { const t = Date.now(); while (Date.now() - t < ms) { try { if (await ev(fn)) return true; } catch (_) {} await sleep(every); } return false; }

await page.goto(URL0, { waitUntil: 'load' });
check(await until(() => window.__agora && __agora.ui && __agora.ui.titleCard.visible, 90000, 300), 'title card');
await sleep(800);
await page.click('.tt__begin');
check(await until(() => __agora.onboarding && __agora.onboarding.current >= 1, 60000), 'landed');
await sleep(2000);
// skip the onboarding (it is not what we test)
await ev(() => { try { __agora.onboarding.finish && __agora.onboarding.finish(true); } catch (_) {} try { __agora.ui.guide.hide && __agora.ui.guide.hide(); } catch (_) {} });
await sleep(1200);
const slot = await ev(() => { const s = document.querySelector('#ministry-call-slot'), btn = document.querySelector('.ag-callbtn'), r = btn.getBoundingClientRect();
  const mb = document.querySelector('.ag-stack__icon'); const m = mb && mb.getBoundingClientRect();
  return { slot: !!s, inSlot: !!(s && s.contains(btn)), btn: [r.left, r.top, r.width, r.height].map(Math.round), mailbox: m ? [m.left, m.top, m.width, m.height].map(Math.round) : null, op: getComputedStyle(btn).opacity }; });
check(slot.slot && slot.inSlot && slot.btn[2] > 40, 'the button sits in #ministry-call-slot', slot);
await shot('01-button');

// 1) the Ministry clerk (no minister yet)
await ev(() => { __agora.game.state.minister = null; });
await page.click('.ag-callbtn');
check(await until(() => __agora.ministry.call.isOpen && !!document.querySelector('.ag-call.is-on'), 3000), 'the call opens');
check(await until(() => /Ministry/.test(document.querySelector('.ag-call__sub').textContent), 8000), 'the clerk greets');
await shot('02-clerk-greeting');
await until(() => !document.querySelector('.ag-call.is-speaking'), 10000);
await page.click('.ag-call__input'); await page.keyboard.type('What should I build next?', { delay: 8 }); await page.keyboard.press('Enter');
await sleep(700);
await sleep(900);
const mid = await ev(() => ({ sub: document.querySelector('.ag-call__sub').textContent, speaking: document.querySelector('.ag-call').classList.contains('is-speaking'), stats: __agora.ministry.call.babble.stats }));
check(mid.speaking && mid.sub.length > 0, 'mid-reply: the subtitle is typing while the face bounces', mid);
await shot('03-clerk-typing');
check(await until(() => !document.querySelector('.ag-call.is-speaking') && document.querySelector('.ag-call__sub').textContent.length > 20, 15000), 'the reply finishes');
const r1 = await ev(() => ({ you: document.querySelector('.ag-call__you').textContent, sub: document.querySelector('.ag-call__sub').textContent, name: document.querySelector('.ag-call__name').textContent, stats: __agora.ministry.call.babble.stats }));
console.log('  clerk:', r1);
check(/Next job|build/i.test(r1.sub) && /Ministry/.test(r1.name), 'the clerk answers what to build next', r1);
check(r1.stats.context && r1.stats.syllables > 10 && r1.stats.nodes > 50, 'WebAudio: an AudioContext and real oscillator syllables', r1.stats);
await shot('04-clerk-reply');
await page.click('.ag-call__input'); await page.keyboard.type('Are the residents happy?', { delay: 8 }); await page.keyboard.press('Enter');
await until(() => !document.querySelector('.ag-call__sub.is-thinking') && !document.querySelector('.ag-call.is-speaking') && /happy|spirits|Unhappy/i.test(document.querySelector('.ag-call__sub').textContent), 15000);
console.log('  mood:', await ev(() => document.querySelector('.ag-call__sub').textContent));
await page.keyboard.press('Escape');
check(await until(() => !__agora.ministry.call.isOpen, 3000), 'Esc hangs up');

// 2) an elected minister
const mid2 = await ev(() => { const a = __agora.game.state.agents.find(x => x.status !== 'left'); try { __agora.game.electMinister(a.id); } catch (e) { __agora.game.state.minister = a.id; } return { id: a.id, name: a.name }; });
await sleep(1500);
await ev(() => { try { __agora.onboarding.finish && __agora.onboarding.finish(true); } catch (_) {} });
await ev(() => __agora.ministry.call.open());
check(await until(() => !!document.querySelector('.ag-call__face img'), 8000), 'the minister\'s portrait shows', mid2);
await until(() => !document.querySelector('.ag-call.is-speaking') && document.querySelector('.ag-call__sub').textContent.length > 10, 10000);
await page.click('.ag-call__input'); await page.keyboard.type('Do we have enough food?', { delay: 8 }); await page.keyboard.press('Enter');
await sleep(1500);
await shot('05-minister-typing');
await until(() => !document.querySelector('.ag-call.is-speaking') && !document.querySelector('.ag-call__sub.is-thinking'), 15000);
await sleep(300);
const r2 = await ev(() => ({ name: document.querySelector('.ag-call__name').textContent, sub: document.querySelector('.ag-call__sub').textContent, stats: __agora.ministry.call.babble.stats }));
console.log('  minister:', r2);
check(r2.name === mid2.name && /food/i.test(r2.sub), 'the minister answers about food', r2);
await shot('06-minister-reply');
// the voice path: a transcript while the call is open goes to the minister
const said = await ev(async () => { const n = __agora.ministry.call.log.length; await __agora.ministry.call.say('tell me about the neighbours', { source: 'voice' }); return __agora.ministry.call.log.length - n; });
await until(() => !document.querySelector('.ag-call.is-speaking') && !document.querySelector('.ag-call__sub.is-thinking'), 15000);
console.log('  neighbours:', await ev(() => document.querySelector('.ag-call__sub').textContent));
check(said >= 1, 'a spoken line goes to the minister');
await shot('07-neighbours');
console.log(`\n${pass} passed, ${fail} failed`);
await b.close();
process.exit(fail ? 1 : 0);
