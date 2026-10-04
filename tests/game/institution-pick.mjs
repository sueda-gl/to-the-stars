// ART_DIRECTION §20: "start a police patrol" -> the game asks "Who joins the Police Patrol? click folk, then Done";
// real clicks on folk toggle them, Done founds it with exactly those members (the first leads); Esc cancels;
// "you choose" keeps the sim's auto-pick. Runs after the opening (auto). Usage: node tests/game/institution-pick.mjs [--url http://localhost:8870]
import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'node:fs';

const arg = (k, d = null) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const BASE = arg('--url', 'http://localhost:8870');
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
// a folk's body on screen (through her lens), for a real click
const bodyOf = id => ev(id => { const A = window.__agora, b = A.agents.screenBoxOf(id); if (!b) return null; return { x: (b.top.x + b.bottom.x) / 2, y: (b.top.y + b.bottom.y) / 2, name: (A.game.state.agents.find(a => a.id === id) || {}).name }; }, id);
const visibleFolk = () => ev(() => { const A = window.__agora, out = []; for (const a of A.game.state.agents) { const b = A.agents.screenBoxOf(a.id); if (!b) continue; const x = (b.top.x + b.bottom.x) / 2, y = (b.top.y + b.bottom.y) / 2; if (x > 40 && x < innerWidth - 40 && y > 150 && y < innerHeight - 120 && !a.role && a.id !== A.game.state.minister) out.push({ id: a.id, name: a.name, x, y }); } return out; });
// folk that stand still (two samples 300 ms apart), so a real click lands on the body it was aimed at
const stillFolk = async () => { const a = await visibleFolk(); await sleep(300); const b = await visibleFolk(); return a.filter(x => { const y = b.find(z => z.id === x.id); return y && Math.hypot(x.x - y.x, x.y - y.y) < 3; }); };
// aim fresh and click at once (a walking folk moves ~25 px a second at this distance)
const clickFolk = async id => { const p = await bodyOf(id); if (!p) return null; await page.mouse.click(p.x, p.y); return p; };

try {
  await page.goto(`${BASE}/?intro=none&opening=auto&autostart=1&minds=off&seed=7`, { waitUntil: 'load' });
  check(await until(() => window.__agora && window.__agora.introDone, 60000, 'intro'), 'booted');
  check(await until(() => window.__agora.opening && window.__agora.opening.phase === 'done', 90000, 'opening'), 'the opening is over (a minister sits)');
  await ev(() => { try { window.__agora.ui.onboarding.skip(); } catch (_) {} try { window.__agora.ui.letters.close(); } catch (_) {} });
  // closer, so the folk are clickable bodies, not dots
  await ev(() => { const A = window.__agora; const c = A.game.state.centre || { x: 0, z: 2 }; return A.world.focus(c.x, c.z + 4, { dist: 26, pitch: 0.7, ms: 600 }); }); await sleep(1200);

  // ---- 1. "start a police patrol" -> pick mode ----
  const res = await ev(() => window.__agora.handle('start a police patrol'));
  const acts = (res && res.actions) || [];
  check(acts.some(a => a.type === 'found_institution'), `the command is understood as found_institution (${acts.map(a => a.type).join(', ')})`);
  check(await until(() => window.__agora.pick && window.__agora.pick.active, 5000, 'pick mode'), 'the game asks who joins (pick mode)');
  const title = await ev(() => window.__agora.pick.title);
  check(/Who joins the Police Patrol\?/.test(title || ''), `the prompt: "${title}"`);
  check(await ev(() => !!document.querySelector('.ag-pick, .ag-pickmode')), 'the prompt is on screen');
  check(await ev(() => window.__agora.game.state.institutions.length === 0), 'nothing is founded yet (no auto-pick)');
  await sleep(300); await shot('10-pick-prompt');

  // ---- 2. real clicks on two folk toggle them; a second click on the first un-picks it; a third pick ----
  let folk = await stillFolk();
  if (folk.length < 3) folk = await visibleFolk();
  check(folk.length >= 3, `${folk.length} free folk on screen to click`);
  const [A1, A2, A3] = folk;
  let p = await clickFolk(A1.id); await sleep(250);
  let chosen = await ev(() => window.__agora.pick.chosen);
  check(chosen.length === 1 && chosen[0] === A1.id, `a real click on ${A1.name} (${Math.round(p.x)}, ${Math.round(p.y)}) picks it (${chosen})`);
  p = await clickFolk(A2.id); await sleep(250);
  chosen = await ev(() => window.__agora.pick.chosen);
  check(chosen.length === 2 && chosen[1] === A2.id, `a second click picks ${A2.name} too (${chosen})`);
  check(await ev(id => { const r = window.__agora.agents.get(id); return !!(r && r.hi); }, A1.id), 'the chosen folk are highlighted (the paper ring)');
  check(await ev(() => document.querySelectorAll('.ag-pick__chip').length === 2), 'the prompt shows the two chosen (their portraits)');
  await shot('11-pick-two');
  p = await clickFolk(A1.id); await sleep(250);
  chosen = await ev(() => window.__agora.pick.chosen);
  check(chosen.length === 1 && chosen[0] === A2.id, `clicking ${A1.name} again un-picks it (${chosen})`);
  p = await clickFolk(A3.id); await sleep(250);
  chosen = await ev(() => window.__agora.pick.chosen);
  check(chosen.length === 2 && chosen[0] === A2.id && chosen[1] === A3.id, `${A3.name} joins the pick (${chosen})`);

  // ---- 3. Done (a real click on the link) -> founded with exactly those, the first chosen leads ----
  const done = await page.$('button.ag-pick__done, .ag-pickmode .is-done');
  check(!!done, 'a Done link');
  if (done) await done.click();
  check(await until(() => window.__agora.game.state.institutions.length === 1, 4000, 'founded'), 'Done founds the institution');
  const inst = await ev(() => { const i = window.__agora.game.state.institutions[0]; return i && { kind: i.kind, name: i.name, members: i.members, leader: i.leader, chosen: i.chosen }; });
  console.log('  institution', JSON.stringify(inst));
  check(inst && inst.kind === 'patrol' && inst.members.length === 2 && inst.members[0] === A2.id && inst.members[1] === A3.id, `the Police Patrol has exactly ${A2.name} and ${A3.name}`);
  check(inst && inst.leader === A2.id && inst.chosen === true, `${A2.name}, the first chosen, leads (chosen by the sovereign)`);
  check(await ev(() => !window.__agora.pick.active && !window.__agora.ui.pick.active), 'the prompt is gone');
  await sleep(1500); await shot('12-patrol-founded');

  // ---- 4. Esc cancels ----
  await ev(() => window.__agora.handle('set up a court'));
  check(await until(() => window.__agora.pick.active, 5000, 'pick mode 2'), 'a court asks for its members too');
  await page.keyboard.press('Escape'); await sleep(300);
  check(await ev(() => !window.__agora.pick.active && window.__agora.game.state.institutions.length === 1), 'Esc cancels: no court founded');

  // ---- 5. "you choose" -> the sim picks, no prompt ----
  await ev(() => window.__agora.handle('start a night watch, you choose the members'));
  check(await until(() => window.__agora.game.state.institutions.length === 2, 6000, 'auto'), '"you choose" founds it at once (auto-pick)');
  const w = await ev(() => { const i = window.__agora.game.state.institutions[1]; return i && { kind: i.kind, n: i.members.length, chosen: i.chosen, pick: window.__agora.pick.active }; });
  check(w && w.kind === 'watch' && w.n >= 1 && w.chosen === false && !w.pick, `the Night Watch picked by the sim (${JSON.stringify(w)})`);

  const errs = await ev(() => window.__agora.errors);
  check(errs.length === 0 && pageErrors.length === 0, `no page errors (${errs.length} recorded, ${pageErrors.length} uncaught)`);
  if (errs.length) console.log('  recorded:', JSON.stringify(errs.slice(0, 5)));
} catch (e) { console.error('ERROR', e); fails++; }
await browser.close();
console.log(fails ? `FAILED ${fails}` : 'ALL PASS', T());
process.exit(fails ? 1 : 0);
