// The minister click, with REAL mouse clicks (ART_DIRECTION §20): the election must take a click on a folk's body
// (head, body or canopy, not just a point near its root), at three different screen positions including near the
// edges, and must still work right after a right-drag pan. Also measures frame times (median / p95) during the
// landing, the fleets and the election. Usage: node tests/game/election-click.mjs [--url http://localhost:8870] [--full]
import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'node:fs';

const arg = (k, d = null) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const flag = k => process.argv.includes(k);
const BASE = arg('--url', 'http://localhost:8870'), FULL = flag('--full');
const OUT = new URL('../../shots/game/election/', import.meta.url).pathname;
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
const until = async (fn, ms, label, ...args) => { const s = Date.now(); while (Date.now() - s < ms) { if (await ev(fn, ...args)) return true; await sleep(150); } console.log('  timeout:', label); return false; };
const phase = () => ev(() => window.__agora.opening && window.__agora.opening.phase);
const stats = arr => { if (!arr.length) return { n: 0 }; const s = arr.slice().sort((a, b) => a - b); const q = p => s[Math.min(s.length - 1, Math.floor(p * s.length))]; return { n: s.length, median: +q(0.5).toFixed(1), p95: +q(0.95).toFixed(1), max: +s[s.length - 1].toFixed(1), mean: +(s.reduce((a, b) => a + b, 0) / s.length).toFixed(1) }; };

// frame-time probe: rAF deltas (what the eye sees), long tasks, the game's own CPU time per frame
await page.evaluateOnNewDocument(() => {
  window.__ft = { frames: [], long: [], marks: {} };
  let last = 0;
  const tick = now => { if (last) window.__ft.frames.push({ t: now, dt: now - last }); last = now; requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
  try { new PerformanceObserver(l => { for (const e of l.getEntries()) window.__ft.long.push({ t: e.startTime, ms: e.duration }); }).observe({ entryTypes: ['longtask'] }); } catch (_) {}
  window.__ft.mark = name => { window.__ft.marks[name] = performance.now(); };
});
const mark = name => ev(n => window.__ft.mark(n), name);
const framesBetween = (a, b) => ev((a, b) => { const M = window.__ft.marks, f = window.__ft.frames.filter(x => x.t >= M[a] && x.t <= M[b]); return { dts: f.map(x => x.dt), long: window.__ft.long.filter(x => x.t >= M[a] && x.t <= M[b]).map(x => x.ms) }; }, a, b);

// the folk on screen: for each live folk the screen box (head / foot through her lens) so a click can aim at the body
const folkBoxes = () => ev(() => {
  const A = window.__agora, out = [];
  for (const a of A.game.state.agents) {
    const b = A.agents.screenBoxOf ? A.agents.screenBoxOf(a.id) : null;
    const h = A.agents.screenOf(a.id);
    if (!h) continue;
    out.push({ id: a.id, name: a.name, species: A.agents.speciesOf(a.id), head: h, box: b });
  }
  return out;
});

try {
  const url = FULL ? `${BASE}/?intro=globe&opening=play&minds=off&seed=7` : `${BASE}/?intro=none&opening=play&autostart=1&minds=off&seed=7`;
  await page.goto(url, { waitUntil: 'load' });
  check(await until(() => window.__agora && (window.__agora.stages.scene === 'globe' || window.__agora.stages.scene === 'world'), 60000, 'boot'), 'booted');
  if (FULL) { await sleep(1500); await ev(() => window.__agora.ui.titleCard.start()); }
  check(await until(() => window.__agora.introDone, 40000, 'intro'), 'the intro finished');
  await mark('landing');
  check(await until(() => window.__agora.opening && window.__agora.opening.phase === 'intro', 30000, 'fleets'), 'the fleets are introduced');
  await mark('intro');
  await sleep(1500); await shot('01-fleet-intro');
  check(await until(() => window.__agora.opening.phase === 'election', 60000, 'election'), 'the election asks');
  await mark('election');
  await sleep(2600);   // the camera is back on the landing view
  await shot('02-election');
  const pose = await ev(() => { const p = window.__agora.world.rig.pose(); return { dist: +p.dist.toFixed(1), pitch: +p.pitch.toFixed(2), deg: +(p.pitch * 180 / Math.PI).toFixed(0) }; });
  console.log('  election camera', JSON.stringify(pose));
  check(pose.pitch <= 0.46 && pose.pitch >= 0.3, `the election camera is low (${pose.deg}°, ${pose.dist} m)`);

  // ---- the frame times so far ----
  for (const [a, b, label] of [['landing', 'intro', 'landing'], ['intro', 'election', 'fleets + introductions'], ['election', null, 'election (so far)']]) {
    if (!b) await mark('now');
    const f = await framesBetween(a, b || 'now');
    console.log(`  frames ${label}: ${JSON.stringify(stats(f.dts))}  long tasks: ${f.long.length}${f.long.length ? ' (' + f.long.map(x => Math.round(x)).join(', ') + ' ms)' : ''}`);
  }

  // ---- real pointer events on a folk's BODY (not its root point) at three places on screen, incl. near the edges ----
  const boxes = await folkBoxes();
  console.log('  folk on screen:', boxes.length, boxes.map(b => `${b.name}(${Math.round(b.head.x)},${Math.round(b.head.y)})`).join(' '));
  const W = 1440, H = 900;
  const inView = b => b.head.x > 20 && b.head.x < W - 20 && b.head.y > 60 && b.head.y < H - 40;
  const vis = boxes.filter(inView);
  // three targets: the left-most, the right-most, and the one nearest the middle
  const byX = vis.slice().sort((a, b) => a.head.x - b.head.x);
  const mid = vis.slice().sort((a, b) => Math.abs(a.head.x - W / 2) + Math.abs(a.head.y - H / 2) - Math.abs(b.head.x - W / 2) - Math.abs(b.head.y - H / 2))[0];
  const targets = [byX[0], mid, byX[byX.length - 1]].filter(Boolean);
  check(targets.length === 3 && new Set(targets.map(t => t.id)).size === 3, `three distinct targets: ${targets.map(t => t.name).join(', ')} (x ${targets.map(t => Math.round(t.head.x)).join(', ')})`);
  // the point to aim at: the body's middle (between head and foot) when the box is known, else a little under the head
  const aim = b => b.box ? { x: (b.box.top.x + b.box.bottom.x) / 2, y: (b.box.top.y + b.box.bottom.y) / 2 } : { x: b.head.x, y: b.head.y + 14 };

  // a RIGHT-DRAG pan first (Sueda looks around before she chooses): the clicks after it must still count
  await page.mouse.move(W / 2, H / 2); await page.mouse.down({ button: 'right' });
  for (let i = 1; i <= 8; i++) { await page.mouse.move(W / 2 + i * 6, H / 2 + i * 2); await sleep(16); }
  await page.mouse.up({ button: 'right' }); await sleep(900);

  // real hover (pointer moves) on each of the three: the election's highlight follows the pointer through her lens
  for (const t of targets) {
    const bx = (await folkBoxes()).find(b => b.id === t.id); if (!bx) { check(false, `${t.name} still on screen`); continue; }
    const p = aim(bx);
    await page.mouse.move(p.x - 3, p.y + 2); await sleep(90); await page.mouse.move(p.x, p.y); await sleep(220);
    const hov = await ev(() => window.__agora.opening.hoverId);
    check(hov === t.id, `hover on ${t.name}'s body at (${Math.round(p.x)}, ${Math.round(p.y)}) highlights it (hoverId ${hov})`);
  }
  await shot('03-hover');
  // the real click on the last hovered (the right-most, near the edge) elects
  const first = targets[2];
  const bxf = (await folkBoxes()).find(b => b.id === first.id); const a1 = aim(bxf);
  const pickT0 = Date.now();
  await page.mouse.click(a1.x, a1.y);
  const elected = await until(() => !!window.__agora.game.state.minister, 4000, 'elected');
  const min = await ev(() => window.__agora.game.state.minister);
  check(elected && min === first.id, `a real click on ${first.name}'s body (${Math.round(a1.x)}, ${Math.round(a1.y)}) after a right-drag elects it (minister ${min}, ${Date.now() - pickT0} ms)`);
  await sleep(1500); await shot('04-elected');
  check(await until(() => window.__agora.opening.phase === 'ceremony', 10000, 'ceremony'), 'the ceremony follows');
  await sleep(2000); await shot('04b-ceremony');
  const cer = await ev(() => { const p = window.__agora.world.rig.pose(); return { dist: +p.dist.toFixed(1), deg: +(p.pitch * 180 / Math.PI).toFixed(0) }; });
  const mscreen = await ev(id => window.__agora.agents.screenOf(id), first.id);
  check(cer.deg <= 26 && mscreen && mscreen.y > H * 0.5 && mscreen.y < H * 0.92 && mscreen.x > W * 0.2 && mscreen.x < W * 0.8, `the ceremony camera is low (${cer.deg}°, ${cer.dist} m) and the minister bows in the lower half, in frame (${mscreen && Math.round(mscreen.x)}, ${mscreen && Math.round(mscreen.y)})`);

  // ---- the pick cost: hover picks must be cheap ----
  const cost = await ev(() => { const A = window.__agora, t0 = performance.now(); let n = 0; for (let i = 0; i < 200; i++) { A.agents.pickAgent(300 + (i % 20) * 40, 200 + (i % 7) * 70); n++; } return +((performance.now() - t0) / n).toFixed(3); });
  console.log('  pickAgent cost per call:', cost, 'ms');
  check(cost < 0.5, `pickAgent costs ${cost} ms a call`);

  check(await until(() => window.__agora.opening.phase === 'done', 60000, 'rise'), 'the camera rose to the leader view');
  await mark('done');
  const fe = await framesBetween('election', 'done');
  console.log(`  frames election -> done: ${JSON.stringify(stats(fe.dts))}  long tasks: ${fe.long.length}`);
  await sleep(1200); await shot('05-leader');
  // the same real-click path after the opening: a click on a folk's body opens ITS card (two more positions, the leader view)
  await ev(() => { try { window.__agora.ui.onboarding.skip(); } catch (_) {} try { window.__agora.ui.letters.close(); } catch (_) {} });
  await ev(() => { const A = window.__agora; const c = A.game.state.centre || { x: 0, z: 2 }; return A.world.focus(c.x, c.z + 4, { dist: 26, pitch: 0.7, ms: 500 }); }); await sleep(1100);
  const l0 = (await folkBoxes()).filter(b => b.box && inView(b)); await sleep(300);
  const l1 = (await folkBoxes()).filter(b => b.box && inView(b));
  // folk standing still (the walkers move ~25 px a second at this distance), left-most and right-most
  const later = l1.filter(b => { const o = l0.find(x => x.id === b.id); return o && Math.hypot(o.head.x - b.head.x, o.head.y - b.head.y) < 3; }).sort((a, b) => a.head.x - b.head.x);
  for (const t0 of [later[0], later[later.length - 1]].filter(Boolean)) {
    await ev(() => { try { window.__agora.ui.agentCard.hide(); } catch (_) {} });
    const t = (await folkBoxes()).find(b => b.id === t0.id) || t0;
    const p = aim(t); await page.mouse.click(p.x, p.y); await sleep(500);
    const card = await ev(() => { const e = document.querySelector('.ag-card__name'); return e ? e.textContent.trim() : null; });
    const under = await ev((x, y, id) => { const e = document.elementFromPoint(x, y); const b = window.__agora.agents.screenBoxOf(id); return { el: e ? e.tagName + '.' + e.className : null, now: b && [Math.round((b.top.x + b.bottom.x) / 2), Math.round((b.top.y + b.bottom.y) / 2), Math.round(b.half)], pick: window.__agora.agents.pickAgent(x, y, { radiusPx: 14 }) }; }, p.x, p.y, t.id);
    check(card === t.name, `a real click on ${t.name}'s body at (${Math.round(p.x)}, ${Math.round(p.y)}) opens its card (${card}; under the pointer: ${JSON.stringify(under)})`);
  }
  await shot('06-card');
  const perf = await ev(() => ({ cpuMs: +(window.__agora.perf.ms / window.__agora.perf.frames).toFixed(2), folkPassMs: +window.__agora.pass.stats.ms.toFixed(2) }));
  console.log('  game cpu per frame', JSON.stringify(perf));
  const errs = await ev(() => window.__agora.errors);
  check(errs.length === 0 && pageErrors.length === 0, `no page errors (${errs.length} recorded, ${pageErrors.length} uncaught)`);
  if (errs.length) console.log('  recorded:', JSON.stringify(errs.slice(0, 5)));
} catch (e) { console.error('ERROR', e); fails++; }
await browser.close();
console.log(fails ? `FAILED ${fails}` : 'ALL PASS', T());
process.exit(fails ? 1 : 0);
