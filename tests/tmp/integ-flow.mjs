// integration flow: title -> Begin -> descent -> seaside -> build (typed) -> rewards -> Plissé -> back
import puppeteer from 'puppeteer-core';
const arg = (k, d = null) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const URL = arg('--url', 'http://localhost:8870/?minds=mock&opening=auto');
const OUT = '/Users/suedagul/agora/shots/integ/' + (arg('--tag', '') ? arg('--tag') + '-' : '');
const STOP = arg('--stop', 'all');
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new',
  args: ['--use-angle=metal', '--window-size=1440,900', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'], defaultViewport: { width: 1440, height: 900 } });
const page = await b.newPage();
const errs = [];
page.on('pageerror', e => { errs.push(e.message); console.log('[pageerror]', e.message); });
page.on('console', m => { const t = m.text(); if (m.type() === 'error' && !/favicon|404/.test(t)) console.log('[console.error]', t.slice(0, 300)); });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const t0 = Date.now(); const T = () => ((Date.now() - t0) / 1000).toFixed(1) + 's';
const shot = async n => { await page.screenshot({ path: OUT + n + '.png' }); console.log(T(), 'shot', n); };
const ev = (fn, ...a) => page.evaluate(fn, ...a);
const until = async (fn, ms = 60000, step = 200) => { const s = Date.now(); while (Date.now() - s < ms) { if (await ev(fn).catch(() => false)) return true; await sleep(step); } return false; };
const state = () => ev(() => { const A = window.__agora, s = A.stages; const pc = A.planet.renderer.domElement; return { scene: s.scene, surface: s.surface, paintSea: s.paintSea, paintPlanet: s.paintPlanet, flying: s.flying, act3: s.act3, planetOpacity: pc.style.opacity, planetDisplay: pc.style.display, held: s.held, errors: A.errors.slice(0, 5) }; });
await page.goto(URL, { waitUntil: 'load' });
await until(() => window.__agora && window.__agora.ui && document.querySelector('.tt') && !document.querySelector('.tt').hidden, 90000);
await sleep(3500);
await shot('01-title');
console.log(T(), 'title', JSON.stringify(await ev(() => { const t = document.querySelector('.tt'); const n = t.querySelector('.tt__name'); const cs = getComputedStyle(n); return { name: n.textContent, font: cs.fontFamily, weight: cs.fontWeight, color: cs.color, tag: t.querySelector('.tt__tag').textContent, begin: t.querySelector('.tt__begin').textContent, under: document.querySelector('.tt').parentElement.tagName }; })));
await page.click('.tt__begin');
await sleep(2600); await shot('02-descent-mid');
await sleep(2300); await shot('03-descent-late');
await until(() => window.__agora.stages.surface === 'sea', 20000, 50);
await sleep(450); await shot('04-handoff-fade');
await until(() => window.__agora.introDone, 20000);
console.log(T(), 'landed', JSON.stringify(await state()));
await sleep(300); await shot('05-landed');
await until(() => window.__agora.opening && window.__agora.opening.phase !== 'landing', 30000);
await sleep(3000); await shot('06-opening');
await until(() => window.__agora.opening && window.__agora.opening.phase === 'done', 120000, 500);
await sleep(2500); await shot('07-leader');
try { await ev(() => window.__agora.ui.letters.close()); } catch (e) {}
if (STOP === 'land') { console.log('errors', errs, await state()); await b.close(); process.exit(0); }
// rewards spy
await ev(() => { const A = window.__agora; window.__rw = []; for (const k of ['reward:gain', 'reward:milestone', 'stage', 'building:site', 'building:done']) A.game.on(k, p => window.__rw.push({ k, p: JSON.parse(JSON.stringify(p, (kk, v) => (kk === 'building' ? (v && { id: v.id, kind: v.kind, x: v.x, z: v.z }) : v))) })); });
// a typed command through the UI's own input (Enter opens it)
await page.keyboard.press('Enter'); await sleep(400);
await page.keyboard.type('build a house in the middle', { delay: 15 }); await page.keyboard.press('Enter');
await until(() => window.__agora.game.state.buildings.some(b => b.kind === 'house'), 20000);
await sleep(1200); await shot('08-house-site');
const hb = await ev(() => { const A = window.__agora, b = A.game.state.buildings.find(x => x.kind === 'house'); const e = A.creation && A.creation.entries ? null : null; let obj = null; A.ctx.scene.traverse(o => { if (!obj && o.userData && o.userData.agora && Math.hypot(o.position.x - b.x, o.position.z - b.z) < 0.01) obj = o; }); return { id: b.id, x: b.x, z: b.z, siteY: A.world.siteY(b), groundY: A.world.groundY(b.x, b.z), objY: obj ? obj.position.y : null, inPlot: A.world.inPlot(b.x, b.z), scr: A.world.project(b.x, null, b.z) }; });
console.log(T(), 'house', JSON.stringify(hb));
await until(() => (window.__rw || []).some(r => r.k === 'reward:gain'), 25000, 100);
await sleep(500); await shot('09-reward-gain');
await sleep(1600); await shot('10-reward-tally');
// a pointer command at a screen spot
await ev(() => window.__agora.handle('a windmill there', { x: 900, y: 520 }));
await until(() => window.__agora.game.state.buildings.some(b => b.kind === 'windmill'), 20000);
await sleep(9000); await shot('11-windmill');
console.log(T(), 'rewards', JSON.stringify(await ev(() => (window.__rw || []).filter(r => /reward|stage/.test(r.k)).map(r => ({ k: r.k, p: r.p })))).slice(0, 1500));
console.log(T(), 'rewards dom', JSON.stringify(await ev(() => { const r = document.querySelector('.ag-rw'); return r ? { text: r.innerText.slice(0, 200), cls: r.className } : null; })));
console.log(T(), 'pins/marks', JSON.stringify(await ev(() => ({ pins: document.querySelectorAll('.agp, .ag-pin, [class*=pin]').length, letters: window.__agora.game.state.letters.length }))));
if (STOP === 'build') { console.log('errors', errs, await state()); await b.close(); process.exit(0); }
// the voyage
await page.keyboard.press('Enter'); await sleep(300);
await page.keyboard.type("let's go to Plissé", { delay: 15 }); await page.keyboard.press('Enter');
const started = await until(() => window.__agora.stages.scene !== 'world', 20000, 100);
console.log(T(), 'voyage started?', started, JSON.stringify(await state()));
if (!started) { // the sim may ask for an election letter first: start it directly
  await ev(() => window.__agora.stages.goMoon()); }
await sleep(700); await shot('12-lift-fade');
await sleep(2500); await shot('13-orbit-rise');
await until(() => window.__agora.stages.scene === 'moon', 60000, 200);
await sleep(1500); await shot('14-plisse');
console.log(T(), 'plisse', JSON.stringify(await state()));
await until(() => window.__agora.stages.act3 === 'lounge' && !window.__agora.stages.flying, 60000, 300);
await sleep(1500); await shot('15-lounge');
console.log(T(), 'lounge', JSON.stringify(await state()));
await ev(() => { window.__agora.stages.goHome(); });
await sleep(5000); await shot('16-rising');
await until(() => window.__agora.stages.scene === 'globe', 60000, 200);
await sleep(2500); await shot('17-return-flight');
await until(() => window.__agora.stages.surface === 'sea', 60000, 50);
await sleep(400); await shot('17b-handoff-home');
await until(() => window.__agora.stages.surface === 'sea' && window.__agora.stages.scene === 'world', 60000, 200);
await sleep(1500); await shot('18-home-again');
console.log(T(), 'home', JSON.stringify(await state()));
await sleep(5000);
console.log(T(), 'after remount', JSON.stringify(await state()));
// build again after coming home
await ev(() => window.__agora.handle('a well near the lake'));
await sleep(6000); await shot('19-build-after-home');
console.log('buildings', JSON.stringify(await ev(() => window.__agora.game.state.buildings.map(b => [b.kind, b.status, b.x, b.z]))));
console.log('errors', errs, JSON.stringify(await state()));
await b.close();
