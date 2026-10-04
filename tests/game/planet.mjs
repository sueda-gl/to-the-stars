// Headless check of THE game on Sueda's Tower Planet (docs/game.md "The planet in the game"): title over her orbit
// (Grain) -> Begin -> her descent (Gouache + daylight by altitude) -> the low oblique landing -> fleets -> the election
// -> the ceremony -> the leader view; then a house in the middle (pencil, paint), a drawn area filled as a field,
// right-drag pan / wheel zoom / Q turn, "show me the neighbours" (orbit), a visit to a nation, back home; and act 3
// (Plissé: the flight, the cross-fade, home). Screenshots -> shots/game/planet/*.png. Fails on any page error or a
// step that never happens.
// Usage: node tests/game/planet.mjs [--url http://localhost:8870] [--skip-moon] [--opening auto|play|none]
import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'node:fs';

const arg = (k, d = null) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const flag = k => process.argv.includes(k);
const BASE = arg('--url', 'http://localhost:8870'), OPENING = arg('--opening', 'auto'), SKIP_MOON = flag('--skip-moon');
const OUT = new URL('../../shots/game/planet/', import.meta.url).pathname;
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
const shot = name => page.screenshot({ path: OUT + name + '.png' }).then(() => console.log('  shot', name, T()));
const until = async (fn, ms, label, ...args) => { const s = Date.now(); while (Date.now() - s < ms) { if (await ev(fn, ...args)) return true; await sleep(250); } console.log('  timeout:', label); return false; };
const state = () => ev(() => { const A = window.__agora, s = A.planet.state(); return { scene: A.stages.scene, mode: s.mode, alt: Math.round(s.altitude), blend: +s.blend.toFixed(2), daylight: +s.daylight.toFixed(2), phase: A.opening && A.opening.phase, cam: Object.fromEntries(Object.entries(A.world.rig.pose()).map(([k, v]) => [k, +(+v).toFixed(2)])), errors: A.errors.length }; });
const say = async text => { const r = await ev(t => window.__agora.handle(t), text); return r && r.actions ? r.actions : []; };
const phaseIs = p => ev(p => window.__agora.opening && window.__agora.opening.phase === p, p);

try {
  await page.goto(`${BASE}/?intro=globe&opening=${OPENING}`, { waitUntil: 'load' });
  check(await until(() => window.__agora && window.__agora.stages.scene === 'globe', 60000, 'boot'), 'booted: the title over her orbit');
  let s = await state();
  check(s.mode === 'orbit' && s.blend < 0.05, `orbit in Grain (blend ${s.blend}, altitude ${s.alt})`);
  await sleep(1200); await shot('00-title-orbit');
  await ev(() => window.__agora.ui.titleCard.start());
  await sleep(2600); s = await state(); await shot('02-descent-mid');
  check(s.mode === 'path' && s.alt < 400 && s.alt > 20, `mid-descent at ${s.alt} m, blend ${s.blend}, daylight ${s.daylight}`);
  check(await until(() => window.__agora.introDone, 30000, 'descent'), 'the descent landed');
  s = await state(); await shot('04-landing');
  check(s.scene === 'world' && s.mode === 'local' && Math.abs(s.cam.pitch - 0.40) < 0.05 && s.blend > 0.98 && s.daylight > 0.98, `landed on the low landing camera (§20, ~23 degrees) (pitch ${s.cam.pitch}, ${s.cam.dist} m, Gouache ${s.blend}, daylight ${s.daylight})`);
  if (OPENING !== 'none') {
    check(await until(() => window.__agora.opening.phase === 'intro', 30000, 'fleets'), 'the fleets are introduced');
    await sleep(1800); s = await state(); await shot('06-fleet-intro');
    check(s.cam.dist <= 11.5 && Math.abs(s.cam.pitch - 0.38) < 0.05, `a square visit at ${s.cam.dist} m, pitch ${s.cam.pitch} (~22 degrees)`);
    check(await until(() => window.__agora.opening.phase === 'election', 60000, 'election'), 'the election asks');
    await sleep(1000); await shot('07-election');
    if (OPENING === 'play') {
      // click the first folk on screen (the election's click)
      const at = await ev(() => { const A = window.__agora; for (const a of A.game.state.agents) { const p = A.agents.screenOf(a.id); if (p && p.x > 60 && p.x < innerWidth - 60 && p.y > 120 && p.y < innerHeight - 80) return p; } return null; });
      if (at) { await page.mouse.move(at.x, at.y); await sleep(200); await page.mouse.click(at.x, at.y); }
    }
    check(await until(() => window.__agora.opening.phase === 'ceremony', 40000, 'ceremony'), 'the ceremony');
    await sleep(2200); s = await state(); await shot('08-ceremony');
    check(s.cam.dist <= 18 && Math.abs(s.cam.pitch - 0.38) < 0.05, `the ceremony camera at ${s.cam.dist} m, pitch ${s.cam.pitch} (~22 degrees, the minister 7 m from the eye)`);
    check(await until(() => window.__agora.opening.phase === 'done', 60000, 'rise'), 'the camera rose to the leader view');
    check(await ev(() => !!window.__agora.game.state.minister), 'a minister was elected');
  }
  await sleep(1500); s = await state();
  check(s.mode === 'local' && Math.abs(s.cam.pitch - 0.95) < 0.05 && Math.abs(s.cam.dist - 64) < 2, `the leader view: pitch ${s.cam.pitch} (~54 degrees), ${s.cam.dist} m`);
  await ev(() => { try { window.__agora.ui.onboarding.skip(); } catch (_) {} try { window.__agora.ui.letters.close(); } catch (_) {} });
  await sleep(600); await shot('09-leader');
  const tags = await ev(() => window.__agora.agents.pins().length);
  console.log('   letter tags in the world (§24: always 0, red dots instead):', tags, 'dots:', await ev(() => window.__agora.mailDots.list().length));

  // ---- a house in the middle: pencil, then paint, through the facade's place() ----
  const acts = await say("let's build a house in the middle");
  check(acts.some(a => a.type === 'build' && a.kind === 'house'), 'a house in the middle -> build house');
  await sleep(1600); await shot('10-house-pencil');
  await sleep(8000); await shot('11-house-paint');
  const house = await ev(() => { const A = window.__agora; const b = A.game.state.buildings.find(x => x.kind === 'house'); if (!b) return null; const o = A.creation.objectOf(b.id); return { x: b.x, z: b.z, status: b.status, onSurface: !!(o && o.parent && o.parent.name === 'planet-surface'), r: o ? +o.position.length().toFixed(2) : null, ground: +A.world.groundY(b.x, b.z).toFixed(2) }; });
  console.log('   house', JSON.stringify(house));
  check(house && house.onSurface && Math.abs(house.r - 170 - house.ground) < 0.6, 'the house stands on the sphere at the ground height');

  // ---- an area drawn with the real mouse, filled as a field ----
  const c = { x: 1010, y: 650 };   // clear ground right of the site (a folk under the first point takes the click as a card)
  await page.mouse.move(c.x - 90, c.y - 50); await page.mouse.down();
  for (let i = 1; i <= 36; i++) { const a = i / 36 * Math.PI * 2; await page.mouse.move(c.x - 90 + 90 - Math.cos(a) * 90, c.y - 50 + Math.sin(a) * 50); await sleep(16); }
  await page.mouse.up(); await sleep(500);
  const mark = await ev(() => window.__agora.marks && window.__agora.marks.current());
  check(mark && mark.kind === 'area', `a drawn loop became an area mark (${mark && mark.kind}, ${mark && mark.areaM2} m2)`);
  await shot('12-area-mark');
  const f = await say('this is a lavender field');
  check(f.some(a => a.type === 'build'), 'this is a lavender field -> build');
  await sleep(9000); await shot('13-field-fill');
  const fill = await ev(() => { const A = window.__agora; const b = A.game.state.buildings.filter(x => x.kind !== 'house').pop(); if (!b) return null; const o = A.creation.objectOf(b.id); return { kind: b.kind, status: b.status, onSurface: !!(o && o.parent && o.parent.name === 'planet-surface') }; });
  console.log('   fill', JSON.stringify(fill));
  check(fill && fill.onSurface, 'the field lies on the sphere');

  // ---- the leader camera: right-drag pans (the ground follows the pointer), the wheel zooms, Q turns ----
  await ev(() => window.__agora.world.home({ ms: 10 })); await sleep(600);
  const before = await ev(() => { const A = window.__agora; return { c: A.world.pick(innerWidth / 2, innerHeight / 2), l: A.world.pick(innerWidth / 2 - 200, innerHeight / 2) }; });
  await page.mouse.move(700, 450); await page.mouse.down({ button: 'right' });
  for (let i = 1; i <= 20; i++) { await page.mouse.move(700 + i * 10, 450); await sleep(16); }
  await page.mouse.up({ button: 'right' }); await sleep(900);
  const after = await ev(() => window.__agora.world.pick(innerWidth / 2, innerHeight / 2));
  const dPan = before.l && after ? Math.hypot(after.x - before.l.x, after.z - before.l.z) : 1e9;
  check(dPan < 4, `right-drag pans with the ground (the point 200 px left is now under the centre: off by ${dPan.toFixed(1)} m)`);
  const d0 = (await state()).cam.dist;
  await page.mouse.move(720, 450); await page.mouse.wheel({ deltaY: -600 }); await sleep(900);
  const d1 = (await state()).cam.dist;
  check(d1 < d0 - 10, `the wheel zooms in (${d0} -> ${d1} m)`);
  const y0 = (await state()).cam.yaw;
  await page.keyboard.down('q'); await sleep(500); await page.keyboard.up('q'); await sleep(500);
  const y1 = (await state()).cam.yaw;
  check(Math.abs(y1 - y0) > 0.2, `Q turns (yaw ${y0} -> ${y1})`);
  await shot('14-leader-moved');

  // ---- the neighbours: orbit, a visit, home ----
  const n = await say('show me the neighbours');
  check(n.some(a => a.type === 'show'), 'show me the neighbours -> show globe');
  check(await until(() => window.__agora.stages.scene === 'globe', 10000, 'globe'), 'the camera rose to her orbit');
  await sleep(3500); s = await state(); await shot('15-orbit-neighbours');
  check(s.mode === 'orbit' && s.alt > 300, `in orbit at ${s.alt} m (blend ${s.blend})`);
  const vp = ev(() => window.__agora.stages.visitNation('n2', { hold: 1500 }));
  await sleep(3000); await shot('16-visit-flight');
  await vp; s = await state(); await shot('17-visit-n2');
  const n2 = await ev(() => window.__agora.geo.placeById('n2'));
  check(s.mode === 'local' && Math.abs(s.cam.tx - n2.x) < 2 && Math.abs(s.cam.tz - n2.z) < 2, `landed over the Loaf Republic (${s.cam.tx}, ${s.cam.tz})`);
  await ev(() => window.__agora.stages.homeFromGlobe());
  check(await until(() => window.__agora.stages.scene === 'world' && window.__agora.world.mode === 'map', 20000, 'home'), 'back home on the leader view');
  await sleep(800); s = await state(); await shot('18-back-home');
  check(Math.abs(s.cam.tx) < 2 && Math.abs(s.cam.dist - 64) < 2, `home again (${s.cam.tx}, ${s.cam.tz}, ${s.cam.dist} m)`);

  // ---- act 3: Plissé ----
  if (!SKIP_MOON) {
    const gm = ev(() => window.__agora.stages.goMoon().then(() => true).catch(e => 'err:' + e.message));
    await sleep(7000); await shot('19-flight-to-plisse');
    const r = await Promise.race([gm, sleep(70000).then(() => 'timeout')]);
    s = await state();
    check(r === true && s.scene === 'moon', `arrived on Plissé (${r})`);
    await sleep(1500); await shot('20-plisse');
    const gh = ev(() => window.__agora.stages.goHome().then(() => true).catch(e => 'err:' + e.message));
    await sleep(3500); await shot('21-leaving-plisse');
    const r2 = await Promise.race([gh, sleep(60000).then(() => 'timeout')]);
    s = await state();
    check(r2 === true && s.scene === 'world', `home from Plissé (${r2}, ${s.scene})`);
    await sleep(800); await shot('22-home-again');
  }

  const errs = await ev(() => window.__agora.errors);
  check(errs.length === 0 && pageErrors.length === 0, `no page errors (${errs.length} recorded, ${pageErrors.length} uncaught)`);
  if (errs.length) console.log('  recorded:', JSON.stringify(errs.slice(0, 5)));
  const perf = await ev(() => ({ cpuMs: +(window.__agora.perf.ms / window.__agora.perf.frames).toFixed(2), folkPassMs: +window.__agora.pass.stats.ms.toFixed(2), fine: window.__agora.fine.stats() }));
  console.log('  perf', JSON.stringify(perf));
} catch (e) {
  console.log('FAIL (exception):', e.message); fails++;
}
console.log(`${fails ? 'FAILED' : 'OK'}: ${fails} failing checks in ${T()}`);
await browser.close();
process.exit(fails ? 1 : 0);
