// "Peek at a developed civilisation" (game/future.js), headless at dpr 2: start the game, build something real, let the
// future prebuild, enter it (the city, the open mailbox with the science letters, the cabinet, the tally), exit, and check
// that her early game is back exactly (sim state, buildings, folk, letters, notes, rewards, camera). Toggle times and fps.
//   node tests/game/future.mjs [--url http://localhost:8897/?minds=mock] [--dpr 2]
import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const URL0 = arg('url', 'http://localhost:8897/?minds=mock&autostart=1');
const DPR = +arg('dpr', 2);
const OUT = path.join(ROOT, 'shots/game/future');
mkdirSync(OUT, { recursive: true });
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new',
  args: ['--use-angle=metal', '--enable-unsafe-swiftshader', '--window-size=1440,900', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required'],
  defaultViewport: { width: 1440, height: 900, deviceScaleFactor: DPR } });
const page = await b.newPage();
const errs = [];
page.on('pageerror', e => { errs.push(e.message); console.log('[pageerror]', e.message); });
page.on('console', m => { const t = m.text(); if (m.type() === 'error' && !/favicon|404|Failed to load resource/.test(t)) console.log('[console.error]', t.slice(0, 240)); if (/\[future\]/.test(t)) console.log('[page]', t.slice(0, 300)); });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ev = (fn, ...a) => page.evaluate(fn, ...a);
const t0 = Date.now(), T = () => ((Date.now() - t0) / 1000).toFixed(1) + 's';
let pass = 0, fail = 0;
const check = (ok, what, got) => { if (ok) pass++; else fail++; console.log(`${ok ? 'PASS' : 'FAIL'} ${T()} ${what}${got === undefined ? '' : '  ' + JSON.stringify(got)}`); };
const shot = async (name, clip) => { await page.screenshot({ path: path.join(OUT, name + '.png'), ...(clip ? { clip } : {}) }); console.log('  shot', name); };
async function until(fn, ms = 20000, every = 200, ...a) { const t = Date.now(); while (Date.now() - t < ms) { try { if (await ev(fn, ...a)) return true; } catch (_) {} await sleep(every); } return false; }
// fps over ms: frames, mean, the longest frame
const fps = ms => ev(ms => new Promise(res => { const ts = []; const f = t => { ts.push(t); if (t - ts[0] < ms) requestAnimationFrame(f); else { const d = ts.slice(1).map((x, i) => x - ts[i]); res({ fps: +(1000 * d.length / (ts[ts.length - 1] - ts[0])).toFixed(1), worstMs: +Math.max(...d).toFixed(1), over50: d.filter(x => x > 50).length }); } }; requestAnimationFrame(f); }), ms);
// everything that must come back exactly
const today = () => ev(() => {
  const A = __agora, s = A.game.state;
  const strip = JSON.stringify(s);
  const folkLists = [A.folk.creatures, A.folk.hoppers, A.folk.drops, A.folk.scoots, A.folk.flits, A.folk.pips, A.folk.floaties, ...(A.folk.extra ? Object.values(A.folk.extra.lists) : [])].flat();
  const crowd = new Set(A.future ? A.future._debug.crowd.map(r => r.a) : []);
  const inScene = o => { let p = o; while (p && p.parent) p = p.parent; return p === A.ctx.scene && (() => { let q = o; while (q) { if (!q.visible && q !== o) return false; q = q.parent; } return true; })(); };
  const real = folkLists.filter(a => !crowd.has(a));
  return {
    stateLen: strip.length, stateHash: [...strip].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7),
    buildings: s.buildings.map(x => x.id + ':' + x.status), agents: s.agents.length, t: +s.t.toFixed(3),
    objs: [...A.creation.entries.values()].map(e => !!(e.obj && inScene(e.obj))),
    realFolkShown: real.filter(a => inScene(a.root)).length, realFolk: real.length,
    letters: A.ui.letters.all.map(l => l.id + (l.read ? 'r' : 'u')), notes: A.ui.letters._mail.notify.list.map(n => n.id + (n.read ? 'r' : 'u')),
    totals: A.rewards ? { ...A.rewards.totals } : null, civ: A.rewards ? A.rewards.civ : null,
    pose: Object.fromEntries(Object.entries(A.world.rig.pose()).map(([k, v]) => [k, +(+v).toFixed(3)])),
    bloom: A.world.ground.uniforms.uWorld.value, lineOnly: A.ctx.lineOnly.length, colourOnly: A.ctx.colourOnly.length
  };
});

await page.goto(URL0, { waitUntil: 'load' });
check(await until(() => window.__agora && __agora.onboarding && __agora.onboarding.current >= 1, 120000, 300), 'landed: the onboarding runs');
check(await until(() => !!(__agora.future && typeof __agora.future.enter === 'function'), 5000), 'game.future is wired');
// a bit of real early game: through the residents, a letter, then skip the rest (the folk elect a minister), and a real build
await sleep(2000);
await ev(() => { const b = document.querySelector('.ag-guide__btn'); b && b.click(); });
await until(() => __agora.onboarding.current >= 2, 8000); await sleep(2500);
await ev(() => { const b = document.querySelector('.ag-guide__btn'); b && b.click(); });
check(await until(() => __agora.ui.letters.all.length >= 1, 25000), 'a resident\'s letter arrived (real early mail)');
await ev(() => __agora.onboarding.skip());
await sleep(1500);
await ev(() => __agora.handle('build a house by the lake'));
check(await until(() => __agora.game.state.buildings.length >= 1, 30000), 'a real building is under way');
await sleep(9000);
console.log('  early game:', JSON.stringify(await ev(() => ({ b: __agora.game.state.buildings.map(x => x.kind + ':' + x.status), letters: __agora.ui.letters.all.length, minister: __agora.game.state.minister, ready: __agora.future.ready }))));
await shot('00-today-before');
const base = await fps(3000);
console.log('  fps today (before the prebuild):', JSON.stringify(base));

// ---- the prebuild (the game would start it at the onboarding's 'mark' step; here by hand), with the fps while it runs ----
const prepT = Date.now();
const [prepFps] = await Promise.all([ev(() => new Promise(res => { const ts = []; let on = true; __agora.future.prepare().then(() => { on = false; }); const f = t => { ts.push(t); if (on) requestAnimationFrame(f); else { const d = ts.slice(1).map((x, i) => x - ts[i]); res({ frames: d.length, fps: +(1000 * d.length / (ts[ts.length - 1] - ts[0])).toFixed(1), worstMs: +Math.max(...d).toFixed(1), over50: d.filter(x => x > 50).length, over100: d.filter(x => x > 100).length }); } }; requestAnimationFrame(f); }))]);
check(await ev(() => __agora.future.ready), 'future.ready after prepare()', { s: (Date.now() - prepT) / 1000 });
console.log('  prebuild:', JSON.stringify(prepFps), JSON.stringify(await ev(() => __agora.future.stats)));
const after = await fps(3000);
console.log('  fps today (after the prebuild, city parked):', JSON.stringify(after));
check(after.fps > base.fps * 0.85, 'the parked city costs little', { base: base.fps, after: after.fps });

await ev(() => { __agora.__tick = __agora.game.tick; __agora.game.tick = () => {}; });
const before = await today();
await ev(() => { window.__co0 = __agora.ctx.colourOnly.slice(); });
// ---- enter ----
const enter = await ev(() => new Promise(res => {
  const ts = []; let on = true; const t0 = performance.now();
  __agora.future.enter().then(ok => { on = false; res({ ok, ms: Math.round(performance.now() - t0), frames: ts.length, worstMs: +Math.max(...ts.slice(1).map((x, i) => x - ts[i])).toFixed(1), stats: { ...__agora.future.stats } }); });
  const f = t => { ts.push(t); if (on) requestAnimationFrame(f); }; requestAnimationFrame(f);
}));
console.log('  enter:', JSON.stringify(enter));
check(enter.ok && await ev(() => __agora.future.active), 'entered the developed civilisation');
await ev(() => { __agora.game.tick = __agora.__tick; });   // (the future pauses the sim itself from here)
await sleep(500);
await shot('01-wipe-done');
await sleep(3200);
const inF = await ev(() => ({ badge: document.querySelector('.ag-fut__badge') && document.querySelector('.ag-fut__badge').textContent, cab: [...document.querySelectorAll('.ag-fut__cab li')].map(li => li.textContent.trim().replace(/\s+/g, ' ')),
  faces: document.querySelectorAll('.ag-fut__cab li img').length, letters: __agora.ui.letters.all.map(l => l.subject), unread: __agora.ui.letters.unread,
  totals: __agora.rewards && __agora.rewards.totals, civ: __agora.rewards && __agora.rewards.civ, simT: __agora.game.state.t }));
console.log('  in the future:', JSON.stringify(inF));
check(/Developed civilisation/.test(inF.badge || '') && /preview/i.test(inF.badge || ''), 'the "Developed civilisation · preview" badge');
check(inF.cab.length === 5 && ['Science', 'Industry', 'Culture', 'Diplomacy', 'Builds'].every(r => inF.cab.some(c => c.includes('Minister of ' + r))), 'a cabinet of five ministers');
check(inF.letters.some(s => /observatory/i.test(s)) && inF.letters.some(s => /test flight/i.test(s)) && inF.letters.some(s => /power station/i.test(s)) && inF.letters.some(s => /treaty/i.test(s)) && inF.letters.some(s => /opera/i.test(s)), 'this stage\'s letters', inF.letters);
check(inF.civ && inF.civ.level === 'Republic' && inF.totals.money > 10000, 'the tally: a Republic, big numbers', { civ: inF.civ, totals: inF.totals });
const cityStats = await ev(() => ({ objects: __agora.future._debug.els.length, crowd: __agora.future._debug.crowd.length, cells: __agora.future.stats.cells, realShown: (() => { const A = __agora; const crowd = new Set(A.future._debug.crowd.map(r => r.a)); return [A.folk.flits, A.folk.floaties, A.folk.hoppers].flat().filter(a => !crowd.has(a) && a.root.parent && a.root.parent.visible !== false && a.root.parent.name !== 'future-park-today').length; })() }));
check(cityStats.objects > 300 && cityStats.crowd > 60 && cityStats.realShown === 0, 'the city stands, its crowd walks, today\'s folk are parked', cityStats);
await shot('02-city');
const inFps = await fps(4000);
console.log('  fps in the future:', JSON.stringify(inFps));
// orbit a little (the camera is hers to move): Q turns
await page.keyboard.down('KeyQ'); await sleep(900); await page.keyboard.up('KeyQ'); await sleep(1200);
await shot('03-city-turned');
// the mailbox: the list, then the science letter
await page.click('.ag-stack');
await sleep(900);
await shot('04-mailbox-list');
await ev(() => { const rows = [...document.querySelectorAll('.ag-mailcol__item')]; const r = rows.find(x => /observatory/i.test(x.textContent)) || rows[0]; (r.querySelector('.ag-mailcol__main') || r).click(); });
await sleep(1100);
await shot('05-science-letter');
// a reply: the city answers, her game hears nothing
const simT0 = await ev(() => __agora.game.state.t);
await ev(() => { const b = [...document.querySelectorAll('.ag-mread .ag-reply, .ag-mread button')].find(x => /pad/i.test(x.textContent)); b && b.click(); });
await sleep(1200);
await shot('06-reply-answered');
await page.keyboard.press('Escape'); await sleep(400); await page.keyboard.press('Escape'); await sleep(600);
const cab = await ev(() => { const r = document.querySelector('.ag-fut__cab').getBoundingClientRect(), t = document.querySelector('.ag-rw') ? document.querySelector('.ag-rw').getBoundingClientRect() : r; return { x: 0, y: 0, width: Math.ceil(Math.max(r.right, t.right) + 30), height: Math.ceil(r.bottom + 30) }; });
await shot('07-cabinet-tally', cab);
await shot('08-future-full');
check(await ev(t => __agora.game.state.t === t, simT0), 'the real sim stayed paused (state.t unchanged)');

// ---- exit ---- (the test holds the sim for the compare: after exit the real game runs on, so its clock would move)
await ev(() => { __agora.__tick = __agora.game.tick; __agora.game.tick = () => {}; });
const exit = await ev(() => new Promise(res => {
  const ts = []; let on = true; const t0 = performance.now();
  __agora.future.exit().then(ok => { on = false; res({ ok, ms: Math.round(performance.now() - t0), worstMs: +Math.max(...ts.slice(1).map((x, i) => x - ts[i])).toFixed(1), stats: { ...__agora.future.stats }, check: __agora.future.lastCheck }); });
  const f = t => { ts.push(t); if (on) requestAnimationFrame(f); }; requestAnimationFrame(f);
}));
console.log('  exit:', JSON.stringify(exit));
check(exit.ok && !(await ev(() => __agora.future.active)), 'back to today');
await sleep(600);
const back = await today();
const same = k => JSON.stringify(before[k]) === JSON.stringify(back[k]);
for (const k of ['stateHash', 'stateLen', 'buildings', 'agents', 't', 'objs', 'realFolkShown', 'realFolk', 'letters', 'notes', 'totals', 'civ', 'pose', 'bloom', 'lineOnly', 'colourOnly'])
  check(same(k), `restored exactly: ${k}`, same(k) ? undefined : { before: before[k], after: back[k] });
check(exit.check && exit.check.same, 'the sim state never drifted (signature equal)', exit.check);
console.log('  colourOnly diff:', await ev(() => { const a = new Set(window.__co0), b = new Set(__agora.ctx.colourOnly); const nm = o => { let p = o, path = []; while (p && path.length < 4) { path.push(p.name || p.type); p = p.parent; } return path.join('<'); }; return JSON.stringify({ added: [...b].filter(o => !a.has(o)).map(nm).slice(0, 8), removed: [...a].filter(o => !b.has(o)).map(nm).slice(0, 8) }); }));
await ev(() => { __agora.game.tick = __agora.__tick; });
await shot('09-today-restored');
const backFps = await fps(3000);
console.log('  fps today again:', JSON.stringify(backFps));
// the game runs on: the sim ticks again
check(await until(t => __agora.game.state.t > t + 0.5, 6000, 200, back.t), 'the real sim runs again after the peek');
// a second round trip (the toggle must stay quick)
const e2 = await ev(async () => { const t0 = performance.now(); await __agora.future.enter(); const a = performance.now() - t0; await new Promise(r => setTimeout(r, 1500)); const t1 = performance.now(); await __agora.future.exit(); return { enterMs: Math.round(a), exitMs: Math.round(performance.now() - t1), stats: { ...__agora.future.stats } }; });
console.log('  second round trip:', JSON.stringify(e2));
const errsIn = await ev(() => __agora.errors.slice());
check(errs.length === 0 && errsIn.length === 0, 'no page errors', { errs, errsIn });
console.log(`\n${pass} passed, ${fail} failed in ${T()}`);
await b.close();
process.exit(fail ? 1 : 0);
