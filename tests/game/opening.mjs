// Headless check of ART_DIRECTION §11 in THE game: the opening (the close overhead landing camera, the fleets in squares,
// the introductions with captions, the minister elected by CLICKING a folk, the ceremony, the camera easing up to the
// leader view, then the welcome letter), a build with visibly busy folk (>= 3 in haul / work), a talk exchange (mock),
// and the inbox fanned out with 6+ letters. Screenshots -> shots/game/op-*.png. Fails on page errors or a missed step.
// Usage: node tests/game/opening.mjs [--url http://localhost:8893] [--seed 7]
import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'node:fs';

const arg = (k, d = null) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const BASE = arg('--url', 'http://localhost:8893'), SEED = arg('--seed', '7');
const OUT = new URL('../../shots/game/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const t0 = Date.now(), T = () => ((Date.now() - t0) / 1000).toFixed(1) + 's';
let fails = 0;
const check = (ok, msg) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + '  (' + T() + ')'); if (!ok) fails++; return ok; };

const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new',
  args: ['--use-angle=metal', '--enable-unsafe-swiftshader', '--window-size=1440,900', '--use-fake-ui-for-media-stream'], defaultViewport: { width: 1440, height: 900 } });
const page = await browser.newPage();
const pageErrors = [];
page.on('pageerror', e => { pageErrors.push(e.message); console.log('  [pageerror]', e.message); });
page.on('console', m => { if (m.type() === 'error' && !/favicon|manifest\.js|404/.test(m.text())) console.log('  [console.error]', m.text().slice(0, 240)); });
const ev = (fn, ...a) => page.evaluate(fn, ...a);
const shot = name => page.screenshot({ path: OUT + 'op-' + name + '.png' });
const until = async (fn, ms, label, ...args) => { const s = Date.now(); while (Date.now() - s < ms) { if (await ev(fn, ...args)) return true; await sleep(200); } console.log('  timeout:', label); return false; };
const pose = () => ev(() => { const p = __agora.world.rig.pose(); return { dist: +p.dist.toFixed(1), pitch: +p.pitch.toFixed(2), tx: +p.tx.toFixed(1), tz: +p.tz.toFixed(1) }; });
const phase = () => ev(() => __agora.opening.phase);

try {
  await page.goto(`${BASE}/?intro=none&autostart=1&seed=${SEED}&log=1`, { waitUntil: 'load' });
  check(await until(() => window.__agora && window.__agora.introDone, 60000, 'intro'), 'booted; the intro finished');

  // ---- the landing: the close overhead camera while the folk fly down into their squares ----
  check(await until(() => __agora.opening && __agora.opening.phase === 'landing', 5000, 'landing'), 'the opening starts with the landing');
  await sleep(3600);
  let p = await pose();
  check(p.dist < 30 && p.pitch < 0.46, `the landing camera is close and low (§20: dist ${p.dist} m, pitch ${(p.pitch * 180 / Math.PI).toFixed(0)}°)`);
  const nAir = await ev(() => __agora.game.state.agents.length);
  check(nAir >= 10, `${nAir} settlers spawned`);
  await shot('01-landing');
  await sleep(4500); await shot('02-landed-squares');
  const fleets = await ev(() => (__agora.game.state.fleets || []).map(f => ({ id: f.id, n: f.members.length })));
  check(fleets.length >= 3, `the folk formed ${fleets.length} fleets by trade: ${fleets.map(f => f.id + '×' + f.n).join(', ')}`);
  check(await ev(() => document.querySelector('.ag-skip') != null), 'the skip link is there');

  // ---- the introductions: the camera glides to each square, a caption names it ----
  check(await until(() => __agora.opening.phase === 'intro' && __agora.opening.introduced >= 1, 25000, 'introduce'), 'the first fleet is introduced');
  await sleep(1500);
  p = await pose();
  const cap = await ev(() => { const e = document.querySelector('.ag-fleet'); return e ? e.textContent.replace(/\s+/g, ' ').trim() : null; });
  check(!!cap && /Fleet/.test(cap), `the fleet caption shows: "${cap}"`);
  check(p.dist < 18, `the camera visits the square (dist ${p.dist} m)`);
  await shot('03-fleet-intro');
  check(await until(() => __agora.opening.introduced >= 2, 15000, 'second fleet'), 'the second fleet follows');
  await sleep(1400); await shot('04-fleet-intro-2');

  // ---- the election: click one of them ----
  check(await until(() => __agora.opening.phase === 'election', 40000, 'election'), 'the game asks for a minister');
  await sleep(2200);
  check(await ev(() => __agora.ui.election.visible && !__agora.ui.fleet.visible), 'the election prompt is up and the caption is gone');
  p = await pose();
  check(p.dist < 30 && p.pitch < 0.46, `the camera is back on the low view of all the squares (dist ${p.dist} m, ${(p.pitch * 180 / Math.PI).toFixed(0)}°)`);
  await shot('05-election-prompt');
  // hover a folk: the highlight ring + its name under the prompt
  const who = await ev(() => { const S = __agora.game.state; const a = S.agents.filter(x => x.status !== 'left').map(x => ({ id: x.id, name: x.name, s: __agora.agents.screenOf(x.id) })).filter(x => x.s && x.s.x > 80 && x.s.x < 1360 && x.s.y > 120 && x.s.y < 780); return a[Math.floor(a.length / 2)] || a[0]; });
  check(!!who, `a folk is on screen to click (${who && who.name} at ${who && Math.round(who.s.x)},${who && Math.round(who.s.y)})`);
  await page.mouse.move(who.s.x, who.s.y + 6); await sleep(250); await page.mouse.move(who.s.x + 1, who.s.y + 6); await sleep(400);
  const hov = await ev(() => ({ id: __agora.opening.hoverId, named: !!document.querySelector('.ag-elect__who:not([hidden])') }));
  check(hov.id === who.id && hov.named, `hovering ${who.name} lifts it and names it under the prompt`);
  await shot('06-election-hover');
  await page.mouse.click(who.s.x + 1, who.s.y + 6);
  check(await until(id => __agora.game.state.minister === id, 4000, 'minister', who.id), `clicking ${who.name} elects the minister`);
  await sleep(1300);
  check(await ev(() => !!document.querySelector('.ag-elected')), 'the seal moment ("… is your minister") shows');
  check(await ev(() => __agora.opening.phase === 'ceremony'), 'the ceremony runs (the camera on the minister)');
  await shot('07-elected-ceremony');
  await sleep(2600); await shot('08-ceremony-cheer');

  // ---- the camera eases up to the leader view; the welcome letter follows ----
  check(await until(() => __agora.opening.phase === 'done', 20000, 'done'), 'the opening is done after the ceremony');
  await sleep(1200);
  p = await pose();
  check(p.dist > 100, `the camera eased up to the leader view (dist ${p.dist} m)`);
  check(await until(() => __agora.ui.letters.all.length >= 1, 8000, 'welcome'), 'a first letter arrived (§24: no welcome letter; the minister writes)');
  check(await ev(() => __agora.game.state.agents.every(a => a.job)), 'every folk has a job');
  await shot('09-leader-view-welcome');
  await ev(() => __agora.ui.letters.close()); await sleep(500);

  // ---- a build: visibly busy folk ----
  const r = await ev(() => window.__agora.handle("let's build a house in the middle", null));
  check(r && r.actions && r.actions.some(a => a.type === 'build'), 'a house in the middle -> build');
  await sleep(3500);
  const busy = await ev(() => { const S = __agora.game.state; const b = S.buildings.find(x => x.kind === 'house'); const crew = b ? b.workers.length : 0;
    const sim = S.agents.filter(a => a.task && ['haul', 'work', 'walk'].includes(a.task.kind) && a.task.buildingId === (b && b.id)).length;
    const roles = S.agents.map(a => __agora.agents.roleOf(a.id)).filter(Boolean); const build = roles.filter(r => /build/.test(typeof r === 'string' ? r : r.kind || r.role || JSON.stringify(r))).length;
    return { crew, sim, build, roles: roles.length, status: b && b.status }; });
  check(busy.sim >= 3 || busy.build >= 3, `>= 3 folk on the site during construction (sim crew tasks ${busy.sim}, crew ${busy.crew}, visible build roles ${busy.build} of ${busy.roles} roles)`);
  await shot('10-busy-build');
  await sleep(3000); await shot('11-busy-build-later');

  // ---- talk (mock): click a folk -> the card; Talk -> a plain reply in a paper bubble ----
  await ev(() => __agora.world.home({ ms: 10 })); await sleep(900);
  const f2 = await ev(() => { const S = __agora.game.state; const a = S.agents.filter(x => x.status !== 'left').map(x => ({ id: x.id, name: x.name, s: __agora.agents.screenOf(x.id) })).filter(x => x.s && x.s.x > 120 && x.s.x < 1300 && x.s.y > 140 && x.s.y < 760); return a[0]; });
  await ev(() => __agora.world.focus(__agora.game.state.centre.x, __agora.game.state.centre.z + 4, { dist: 26, ms: 10 })); await sleep(700);
  const f3 = await ev(() => { const S = __agora.game.state; const a = S.agents.filter(x => x.status !== 'left').map(x => ({ id: x.id, name: x.name, s: __agora.agents.screenOf(x.id) })).filter(x => x.s && x.s.x > 120 && x.s.x < 1300 && x.s.y > 140 && x.s.y < 760); return a[0]; });
  const folk = f3 || f2;
  check(!!folk, `a folk is on screen to click (${folk && folk.name})`);
  await page.mouse.click(folk.s.x, folk.s.y + 4); await sleep(600);
  const card = await ev(() => { const c = __agora.ui.agentCard.el; return c ? { id: __agora.ui.agentCard.agentId, text: c.textContent.replace(/\s+/g, ' ').slice(0, 200), talk: !!c.querySelector('.ag-card__talkbtn') } : null; });
  check(!!card && card.id === folk.id && card.talk, `the card opens for ${folk.name} with Talk: "${card && card.text.slice(0, 90)}…"`);
  check(!!card && /wears|rotor|parasol|goggles|hat|apron|belt|satchel|scarf|sash|glasses/i.test(card.text), 'the card says what they wear');
  await shot('12-agent-card');
  await ev(id => __agora.ui.talk.open(id), folk.id); await sleep(300);
  check(await ev(id => __agora.ui.talk.target === id, folk.id), 'the folk is the talk target (Space would speak to it)');
  await ev(() => __agora.ui.talk.say('how are you?', { source: 'typed' }));
  check(await until(id => __agora.ui.talk.history(id).length >= 2, 15000, 'reply', folk.id), 'a reply came back');
  const hist = await ev(id => __agora.ui.talk.history(id), folk.id);
  console.log('   talk:', JSON.stringify(hist));
  const reply = hist[hist.length - 1]; const rtxt = typeof reply === 'string' ? reply : reply.text || reply.me || JSON.stringify(reply);
  check(rtxt.length > 3 && rtxt.length < 200, `the reply is short and plain: "${rtxt}"`);
  await sleep(600);
  check(await ev(() => !!document.querySelector('.agb.on, .agb')), 'a paper bubble is over the folk');
  await shot('13-talk');
  // voice route: a final transcript with a folk selected goes to the folk, not to the Ministry
  const before = await ev(id => __agora.ui.talk.history(id).length, folk.id);
  await ev(() => { const v = __agora.voice; v.start(); v.feed({ resultIndex: 0, results: [Object.assign([{ transcript: 'what do you do', confidence: .9 }], { isFinal: true })] }); v.stop(); });
  check(await until((id, n) => __agora.ui.talk.history(id).length >= n + 2, 15000, 'voice talk', folk.id, before), 'a spoken sentence with a folk selected goes to that folk');
  await sleep(500); await shot('14-talk-voice');
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape'); await sleep(400);
  check(await ev(() => !__agora.ui.talk.isOpen && !__agora.ui.agentCard.el), 'Esc closes the talk line and the card (deselect)');

  // ---- the inbox: 6+ letters fanned out on the table ----
  await ev(() => { const g = __agora.game, L = __agora.letters; const a = g.state.agents;
    const subjects = ['The well runs low', 'A song for the evening', 'About the roof', 'Gossip from the shore', 'An idea: a kite shop', 'We are hungry'];
    subjects.forEach((s, i) => g.sendLetter(L.makeLetter({ from: { kind: 'agent', id: a[i % a.length].id, name: a[i % a.length].name }, subject: s, body: `Sovereign, ${s.toLowerCase()}. We thought you should know.\n— ${a[i % a.length].name}`, kind: 'gossip', day: g.state.day }), { delay: 0.1 + i * 0.1 })); });
  check(await until(() => __agora.ui.letters.all.length >= 7, 15000, 'letters'), `7+ letters on the stack (${await ev(() => __agora.ui.letters.all.length)})`);
  await sleep(800);
  await ev(() => __agora.ui.letters.fan()); await sleep(2200);
  const fan = await ev(() => ({ open: __agora.ui.letters.isFanned, cards: document.querySelectorAll('.ag-fan__table button, .ag-fan__table [class*="card"], .ag-fan__card, .ag-mail').length, all: __agora.ui.letters.all.length }));
  check(fan.open && fan.cards >= fan.all, `the inbox fans every letter out (${fan.cards} cards for ${fan.all} letters)`);
  await shot('15-inbox-fanned');
  await page.keyboard.press('Escape'); await sleep(900);
  check(await ev(() => !__agora.ui.letters.isFanned), 'Esc gathers them back');

  const errs = await ev(() => window.__agora.errors.slice());
  check(errs.length === 0, `no uncaught errors recorded by the game (${errs.length}) ${errs.slice(0, 3).join(' | ')}`);
  check(pageErrors.length === 0, `no page errors (${pageErrors.length})`);
} catch (e) {
  console.log('FAIL opening threw:', e.stack || e.message); fails++;
  try { await shot('99-failure'); } catch (_) {}
}
await browser.close();
console.log(fails ? `\n${fails} failure(s)` : '\nall good', T());
process.exit(fails ? 1 : 0);
