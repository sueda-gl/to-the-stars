// The nations' towns (web/js/planet/towns.js) in the running game: built, merged, curved, with their folk; shots of
// each visit, the orbit and the horizon from home. Usage: node tests/planet/towns.mjs [--url http://localhost:8870] [--only n1,orbit]
import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'node:fs';
const arg = (k, d = null) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const BASE = arg('--url', 'http://localhost:8870'), ONLY = arg('--only', '');
const OUT = new URL('../../shots/planet/towns/', import.meta.url).pathname; mkdirSync(OUT, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fails = 0; const check = (ok, msg) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg); if (!ok) fails++; };
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new',
  args: ['--use-angle=metal', '--enable-unsafe-swiftshader', '--window-size=1440,900'], defaultViewport: { width: 1440, height: 900 } });
const page = await browser.newPage();
const errs = [];
page.on('pageerror', e => { errs.push(e.message); console.log('  [pageerror]', e.message); });
page.on('console', m => { const t = m.text(); if (m.type() === 'error' && !/favicon|404/.test(t)) console.log('  [console.error]', t.slice(0, 300)); if (/\[towns\]/.test(t)) console.log('  ', t.slice(0, 300)); });
const ev = (fn, ...a) => page.evaluate(fn, ...a);
const until = async (fn, ms) => { const s = Date.now(); while (Date.now() - s < ms) { if (await ev(fn)) return true; await sleep(250); } return false; };
const want = k => !ONLY || ONLY.split(',').includes(k);
try {
  await page.goto(`${BASE}/?intro=none&opening=none&autostart=1&log=1`, { waitUntil: 'load' });
  check(await until(() => window.__agora && window.__agora.world.towns && window.__agora.world.towns.list.length === 3, 90000), 'booted, towns built');
  await until(() => window.__agora.introDone, 30000); await sleep(1500);
  const st = await ev(() => window.__agora.world.towns.stats());
  console.log('  stats', JSON.stringify(st));
  check(st.towns.length === 3 && st.towns.every(t => t.draws > 0 && t.draws < 40 && !t.skipped.length), 'three towns, merged (< 40 draws each), nothing skipped');
  check(st.towns.every(t => t.folk >= 5), 'each town has its folk');
  await ev(() => { const st = document.createElement('style'); st.textContent = 'body > *:not(canvas) { display: none !important } canvas { filter: none !important }'; document.head.appendChild(st); });
  for (const id of ['n1', 'n2', 'n3']) {
    if (!want(id)) continue;
    await ev(id => { const A = window.__agora, n = A.geo.placeById(id), v = n.view; A.world.jump({ tx: n.x, tz: n.z, dist: v.dist, pitch: v.pitch, yaw: v.yaw, fov: v.fov }); }, id);
    await sleep(3500);
    await page.screenshot({ path: OUT + `visit-${id}.png` });
    await ev(id => { const A = window.__agora, n = A.geo.placeById(id), v = n.view; A.world.jump({ tx: n.x, tz: n.z, dist: 20, pitch: 0.5, yaw: v.yaw, fov: v.fov }); }, id);
    await sleep(2500);
    await page.screenshot({ path: OUT + `close-${id}.png` });
    await ev(id => { const A = window.__agora, n = A.geo.placeById(id), v = n.view; A.world.jump({ tx: n.x, tz: n.z, dist: 110, pitch: 1.1, yaw: v.yaw, fov: v.fov }); }, id);
    await sleep(2500);
    await page.screenshot({ path: OUT + `high-${id}.png` });
    console.log('  shot', id);
  }
  if (want('horizon')) {
    // from home, low over the plot, turned toward each nation
    for (const id of ['n1', 'n2', 'n3']) {
      await ev(id => { const A = window.__agora, n = A.geo.placeById(id), c = A.geo.centre; const yaw = Math.atan2(c.x - n.x, c.z - n.z); A.world.jump({ tx: c.x, tz: c.z, dist: 90, pitch: 0.5, yaw, fov: 50 }); }, id);
      await sleep(2500);
      await page.screenshot({ path: OUT + `horizon-${id}.png` });
    }
    await ev(() => { const A = window.__agora; A.world.jump({ ...A.world.homePose() }); });
    await sleep(2500);
    await page.screenshot({ path: OUT + `leader-home.png` });
  }
  if (want('stages')) {
    // the real path: her orbit -> stages.visitNation (her descendTo onto n.view, which the towns set) -> home
    for (const id of ['n1', 'n2', 'n3']) {
      await ev(() => window.__agora.stages.showGlobe());
      await sleep(2500);
      await ev(id => { window.__visit = window.__agora.stages.visitNation(id, { hold: 5000 }); }, id);
      await sleep(6400);
      const s = await ev(() => { const A = window.__agora, s = A.planet.state(); return { mode: s.mode, alt: Math.round(s.altitude), blend: +s.blend.toFixed(2), daylight: +s.daylight.toFixed(2) }; });
      await page.screenshot({ path: OUT + `stage-visit-${id}.png` });
      check(s.mode === 'local' && s.blend > 0.95, `visit ${id} landed (${JSON.stringify(s)})`);
      await sleep(4200);
      await ev(() => window.__agora.stages.homeFromGlobe());
      await sleep(5800);
    }
  }
  if (want('orbit')) {
    for (const id of ['home', 'n1', 'n2', 'n3']) {
      await ev(id => { const A = window.__agora, n = id === 'home' ? A.geo.centre : A.geo.placeById(id); A.world.orbit({ over: { x: n.x, z: n.z }, spin: false }); }, id);
      await sleep(4500);
      await page.screenshot({ path: OUT + `orbit-${id}.png` });
    }
  }
  check(!errs.length, 'no page errors');
} catch (e) { console.log('FAIL exception', e.message); fails++; }
await browser.close();
console.log(fails ? `${fails} FAILED` : 'ALL PASS');
process.exit(fails ? 1 : 0);
