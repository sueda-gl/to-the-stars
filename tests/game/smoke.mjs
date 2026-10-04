// Headless smoke of THE game (web/index.html + web/js/game.js) against the running server on :8870 (live or mock):
//   boot -> Begin -> intro (?intro=none by default here: fast) -> Act 1 (a house in the middle, a windmill at a pointer,
//   a generated thing in the lake) -> a letter opens -> a minister -> a gift -> show the neighbours (globe) -> home
//   -> a meeting -> the Moon (seed, golden hour) -> home. Screenshots -> shots/game/smoke-*.png. Fails on any page
//   error, any uncaught error the game recorded (window.__agora.errors), or a step that never happens.
// Usage: node tests/game/smoke.mjs [--url http://localhost:8870] [--intro globe|sky|none] [--opening auto|none|play] [--skip-moon] [--quick]
//   --opening auto (default): the §11 opening runs with the minister picked by itself (tests/game/opening.mjs covers the click); none: the old loose spawn
import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'node:fs';

const arg = (k, d = null) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const flag = k => process.argv.includes(k);
const BASE = arg('--url', 'http://localhost:8870');
const INTRO = arg('--intro', 'none'), OPENING = arg('--opening', 'auto');
const QUICK = flag('--quick'), SKIP_MOON = flag('--skip-moon');
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
const shot = name => page.screenshot({ path: OUT + 'smoke-' + name + '.png' });
const until = async (fn, ms, label, ...args) => { const s = Date.now(); while (Date.now() - s < ms) { if (await ev(fn, ...args)) return true; await sleep(300); } console.log('  timeout:', label); return false; };
const say = async (text, pointer = null) => { const r = await ev((t, p) => window.__agora.handle(t, p), text, pointer); return r && r.actions ? r.actions : []; };
const buildings = () => ev(() => window.__agora.game.state.buildings.map(b => ({ id: b.id, kind: b.kind, name: b.name, status: b.status, x: b.x, z: b.z, floating: !!b.floating })));

try {
  await page.goto(`${BASE}/?intro=${INTRO}&autostart=1&opening=${OPENING}`, { waitUntil: 'load' });
  check(await until(() => window.__agora && window.__agora.introDone, 90000, 'intro'), `booted and the intro finished (intro=${INTRO})`);
  if (OPENING !== 'none') {
    check(await until(() => __agora.opening && __agora.opening.phase === 'done', 90000, 'opening'), `the opening ran through (fleets, introductions, the minister, the ceremony): phase ${await ev(() => __agora.opening.phase)}`);
    check(await ev(() => !!__agora.game.state.minister), 'a minister was elected during the opening');
  }
  await sleep(2500);
  const info = await ev(() => ({ scene: __agora.stages.scene, live: __agora.live, ids: __agora.lib.ids().length, marks: !!__agora.marks, fillers: !!__agora.fillers, agents: __agora.game.state.agents.length, letters: __agora.ui.letters.all.length }));
  console.log('  ', JSON.stringify(info));
  check(info.scene === 'world' && info.ids >= 20 && info.agents >= 10, 'the world is up with the library and the folk');
  check(info.letters >= 1, 'a first letter is in the mailbox (§24: no welcome letter)');
  await shot('01-world');
  await ev(() => __agora.ui.letters.close()); await sleep(400);

  // ---- Act 1 ----
  let acts = await say("let's build a house in the middle");
  check(acts.some(a => a.type === 'build' && a.kind === 'house'), 'house in the middle -> build house');
  await sleep(1500); await shot('02-house-pencil');
  await sleep(7000); await shot('03-house-paint');
  let bs = await buildings();
  check(bs.some(b => b.kind === 'house' && Math.hypot(b.x, b.z - 2) < 4), 'the house sits at the plot centre');

  const pt = { x: 980, y: 560 };
  await page.mouse.move(pt.x, pt.y); await sleep(200);
  const picked = await ev(p => __agora.world.pick(p.x, p.y), pt);
  acts = await say('a windmill there', pt);
  check(acts.some(a => a.type === 'build' && a.kind === 'windmill' && a.at && Number.isFinite(a.at.x)), 'windmill there -> build windmill at the pointer');
  bs = await buildings();
  const wm = bs.find(b => b.kind === 'windmill');
  check(!!wm && picked && Math.hypot(wm.x - picked.x, wm.z - picked.z) < 9, `the windmill is at the pointer (${wm && wm.x},${wm && wm.z} vs ${picked && picked.x.toFixed(1)},${picked && picked.z.toFixed(1)})`);
  await sleep(6000); await shot('04-windmill');

  // a mark: a point on clear ground, then "a well here" lands on it
  const spot = await ev(() => { for (const [x, y] of [[560, 470], [860, 470], [600, 420], [820, 600], [700, 440], [500, 600]]) { const p = __agora.world.pick(x, y); if (p && p.inPlot && !p.onWater && __agora.agents.pickAgent(x, y, { radiusPx: 30 }) == null) return { x, y, px: p.x, pz: p.z }; } return null; });
  if (spot && await ev(() => !!__agora.marks)) {
    await page.mouse.click(spot.x, spot.y); await sleep(500);
    const mk = await ev(() => __agora.marks.current());
    check(!!mk && mk.kind === 'point', 'a left click leaves a pencil point mark');
    acts = await say('a well here');
    bs = await buildings();
    const well = bs.find(b => b.kind === 'well');
    check(!!well && Math.hypot(well.x - spot.px, well.z - spot.pz) < 4, 'the well is on (or minimally nudged off) the mark');
    check((await ev(() => __agora.marks.list().length)) === 0, 'the mark was consumed');
    await sleep(1200); await shot('05-well-on-mark');
  }

  // an area: a drawn loop (the marks check's gesture: a world-space ring, projected, with a small overshoot) -> a field fills it
  if (await ev(() => !!__agora.marks && !!__agora.fillers)) {
    await ev(() => __agora.world.focus(-8, 8, { dist: 48, ms: 600 })); await sleep(1200);
    const ring = Array.from({ length: 27 }, (_, i) => [-12 + Math.cos(i / 24 * 6.283) * 9, 14 + Math.sin(i / 24 * 6.283) * 6.3]);
    const s = []; for (const [x, z] of ring) s.push(await ev((x, z) => { const p = __agora.world.project(x, 0, z); return [p.x, p.y]; }, x, z));
    await page.mouse.move(s[0][0], s[0][1]); await page.mouse.down(); for (let i = 1; i < s.length; i++) await page.mouse.move(s[i][0], s[i][1], { steps: 3 }); await page.mouse.up(); await sleep(600);
    const area = await ev(() => { const m = __agora.marks.current(); return m && { kind: m.kind, areaM2: m.areaM2 }; });
    check(!!area && area.kind === 'area' && area.areaM2 > 100 && area.areaM2 < 260, `a drawn loop is an area mark (${JSON.stringify(area)})`);
    acts = await say('this is a lavender field');
    bs = await buildings();
    const field = await ev(() => { const b = __agora.game.state.buildings.find(x => x.kind === 'field'); return b && { x: b.x, z: b.z, n: b.shape && b.shape.poly && b.shape.poly.length, area: b.shape && b.shape.areaM2 }; });
    check(!!field && field.n > 20 && Math.hypot(field.x + 12, field.z - 14) < 2, `the field fills the drawn outline (${JSON.stringify(field)})`);
    await sleep(8000); await shot('05b-field-on-area');
  }

  acts = await say('put a giant rubber duck in the lake');
  check(acts.some(a => a.type === 'build'), 'rubber duck -> build (generated / cached asset)');
  const designed = await until(() => __agora.game.state.buildings.some(b => /duck/i.test(b.name) && b.status !== 'awaiting_design'), QUICK ? 60000 : 300000, 'duck design');
  check(designed, 'the duck got its design (sketch -> real object)');
  bs = await buildings();
  const duck = bs.find(b => /duck/i.test(b.name));
  check(!!duck && duck.floating, 'the duck floats on the lake');
  await sleep(6000); await shot('06-duck');

  // ---- letters, minister, gift ----
  const before = await ev(() => __agora.ui.letters.all.length);
  acts = await say('who here is good at baking?');
  check(acts.some(a => a.type === 'ask_crowd'), 'who is good at baking -> ask_crowd');
  check(await until(n => __agora.ui.letters.all.length > n, 40000, 'letter', before) || await ev(n => __agora.ui.letters.all.length > n, before), 'a letter arrived');
  await ev(() => __agora.ui.letters.toggleList(true)); await sleep(2600);
  check(await ev(() => !!__agora.ui.letters.openId), 'the letter opened');
  await shot('07-letter');
  await ev(() => __agora.ui.letters.close()); await sleep(500);
  const name = await ev(() => __agora.game.state.agents.slice().sort((a, b) => (b.skills.baking || 0) - (a.skills.baking || 0))[0].name);
  acts = await say(`make ${name} our minister`);
  check(await until(() => !!__agora.game.state.minister, 8000, 'minister'), `${name} is minister`);
  acts = await say('send the neighbours a basket of bread');
  check(acts.some(a => a.type === 'send_gift'), 'bread -> send_gift');
  await sleep(4000); await shot('08-gift');

  // ---- the neighbours (globe) and back ----
  acts = await say('show me the neighbours');
  check(acts.some(a => a.type === 'show'), 'show me the neighbours -> show globe');
  check(await until(() => __agora.stages.scene === 'globe', 20000, 'globe'), 'the globe is on');
  await sleep(3500); await shot('09-globe');
  await ev(() => __agora.stages.homeFromGlobe());
  check(await until(() => __agora.stages.scene === 'world' && !__agora.stages.fading, 40000, 'home'), 'back on the map');
  await sleep(2000); await shot('10-home');

  // ---- a meeting ----
  acts = await say('call a meeting');
  check(acts.some(a => a.type === 'call_meeting'), 'call a meeting -> call_meeting');
  check(await until(() => __agora.ui.meeting.visible, 15000, 'meeting'), 'the meeting letterbox is up with the report');
  await sleep(2500); await shot('11-meeting');
  await ev(() => __agora.desk.endMeeting()); await sleep(2500);

  // ---- the Moon ----
  if (!SKIP_MOON) {
    acts = await say("let's go to the moon");
    check(acts.some(a => a.type === 'go_moon'), 'let’s go to the moon -> go_moon');
    check(await until(() => __agora.stages.scene === 'moon', 120000, 'moon'), 'arrived on the Moon (election letter, globe flight, lounge)');
    await sleep(2500); await shot('12-moon');
    const seeded = await say('offer them a seed');
    check(seeded.some(a => a.type === 'moon' && a.do === 'seed'), 'offer them a seed -> moon seed');
    await sleep(7000); await shot('13-moon-seed');
    const golden = await say('wait for the evening');
    check(golden.some(a => a.type === 'moon' && a.do === 'golden_hour'), 'wait for the evening -> golden hour');
    check(await until(() => { const d = __agora.stages.driver; return d && d.state().goldenHour; }, 10000, 'golden'), 'the lounge is in golden hour');
    await sleep(3000); await shot('14-moon-golden');
    check(await ev(() => __agora.ui.letters.all.some(l => l.kind === 'shadeling')), 'the shadelings wrote');
    const home = await say("let's go home");
    check(home.some(a => a.type === 'moon' && a.do === 'go_home'), 'let’s go home -> go_home');
    check(await until(() => __agora.stages.scene === 'world' && !__agora.stages.fading, 90000, 'earth'), 'home again on the map');
    await sleep(2500); await shot('15-home-again');
  }

  const errs = await ev(() => window.__agora.errors.slice());
  check(errs.length === 0, `no uncaught errors recorded by the game (${errs.length}) ${errs.slice(0, 3).join(' | ')}`);
  check(pageErrors.length === 0, `no page errors (${pageErrors.length})`);
} catch (e) {
  console.log('FAIL smoke threw:', e.message); fails++;
  try { await shot('99-failure'); } catch (_) {}
}
await browser.close();
console.log(fails ? `\n${fails} failure(s)` : '\nall good', T());
process.exit(fails ? 1 : 0);
