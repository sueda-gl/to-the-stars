// Per-phase performance of THE game (web/index.html, read-only: driven through window.__agora), Chrome headless=new on
// the real GPU. Phases: title/orbit, descent, landing + fleets (the opening, auto minister), leader view idle, building,
// the act 3 voyage (rise, flight, fade, Plissé, approach, dive, lounge) and back home.
//   ~/.nvm/versions/node/v22.22.3/bin/node tests/perf/game.mjs [--url http://localhost:8897] [--dpr 1|2] [--tag before|after] [--no-voyage]
// Writes shots/perf/<tag>-game-<phase>.png and <tag>-game-dpr<N>.json, prints a table. minds=mock: no API calls.
import { open, measure, table, sleep, OUT, r1 } from './lib.mjs';
import { writeFileSync } from 'node:fs';
const arg = (k, d = null) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const BASE = arg('--url', 'http://localhost:8897'), DPR = +(arg('--dpr', '1')), TAG = arg('--tag', 'before'), VOYAGE = !process.argv.includes('--no-voyage');

const { b, p, cdp } = await open(`${BASE}/?intro=globe&opening=auto&minds=mock&seed=7`, { dpr: DPR });
await p.waitForFunction(() => window.__agora && window.__agora.planet, { timeout: 90000 });
await p.evaluate(() => window.__agora.planet.ready);
// a JS breakdown of the game's own frame: wrap the pieces game.js calls each frame (planet.frame = her render + the folk pass)
await p.evaluate(() => {
  const A = window.__agora, T = window.__perfJs = {};
  const wrap = (obj, k, name) => { const f = obj[k]; if (typeof f !== 'function') return; obj[k] = function () { const t0 = performance.now(); try { return f.apply(this, arguments); } finally { T[name] = (T[name] || 0) + performance.now() - t0; T.n_ + name; } }; };
  wrap(A.game, 'tick', 'sim'); wrap(A.world, 'update', 'world'); wrap(A.folk, 'update', 'folk'); wrap(A.agents, 'update', 'agents'); wrap(A.lib, 'update', 'lib'); wrap(A.planet, 'frame', 'planet'); if (A.painter) wrap(A.painter, 'frame', 'sea');   // the seaside map's painter (home since §21)
  // inside her frame: the folk pass (afterFinish hook) is timed by pass.stats.ms; the DOM overlay (pins + bubbles) runs in the agents' afterFinish hook
  T.reset = () => { for (const k of Object.keys(T)) if (typeof T[k] === 'number') T[k] = 0; };
});
await sleep(1500);
const rows = [];
const shot = name => p.screenshot({ path: `${OUT}${TAG}-game-${name}.png` });
const js = async () => { const t = await p.evaluate(() => { const T = window.__perfJs, o = {}; for (const k of Object.keys(T)) if (typeof T[k] === 'number') o[k] = Math.round(T[k]); T.reset(); o.folkPassMs = Math.round(window.__agora.pass.stats.ms * 10) / 10; return o; }); return { js: t }; };
async function phase(name, during, maxMs = 60000) {
  const t0 = Date.now();
  const d = typeof during === 'number' ? during : async () => { while (Date.now() - t0 < maxMs && await p.evaluate(during)) await sleep(80); };
  await p.evaluate(() => window.__perfJs.reset());
  const row = await measure(p, cdp, name, d, { extra: js });
  // JS ms per frame of the game loop (the sum of the wrapped pieces / frames in this phase)
  const frames = Math.max(1, Math.round(row.fps * row.s));
  row.jsPerFrame = Object.fromEntries(Object.entries(row.js).map(([k, v]) => [k, k === 'folkPassMs' ? v : r1(v / frames)]));
  rows.push(row);
  await shot(name);
}
await phase('title-orbit', 5000);
// Begin as she does: the title card's own button (its wash and blend-mode letters go away with it)
// (the §23 title, ui/title.js: .tt__begin; the old card's .ag-title__begin for runs against an older build)
const BEGIN = await p.waitForFunction(() => document.querySelector('.tt:not([hidden]) .tt__begin') ? '.tt__begin' : document.querySelector('.ag-title__begin') ? '.ag-title__begin' : null, { timeout: 20000 }).then(h => h.jsonValue());
await sleep(BEGIN === '.tt__begin' ? 1800 : 0);   // its Begin fades in at 1.7 s
await p.click(BEGIN);
await phase('descent', () => !window.__agora.introDone, 20000);
await phase('landing-fleets', () => window.__agora.opening && window.__agora.opening.phase !== 'done', 90000);
await sleep(2500);
try { await p.evaluate(() => window.__agora.ui.letters.close()); } catch (e) { /* no */ }
await phase('leader-idle', 8000);
await p.evaluate(() => window.__agora.handle("let's build a house in the middle"));
await phase('building', 9000);
await p.evaluate(() => window.__agora.handle('a windmill there', { x: 980, y: 560 }));
await phase('building-2', 8000);
if (VOYAGE) {
  const S = () => p.evaluate(() => { const s = window.__agora.stages, b = s.bridge; const el = id => document.getElementById(id); return { scene: s.scene, flying: s.flying, fading: s.fading, act3: s.act3, bt: b ? b.state().t : null, bo: b ? +b.el.style.opacity : null, po: el('ag-plisse') ? +el('ag-plisse').style.opacity : null, lo: el('ag-lounge') ? +el('ag-lounge').style.opacity : null }; });
  // since the seaside hand-off (§21) stages.step names each move: lift | rise | flight | fade | approach | dive | rising | leaving | return | descent | handoff
  const STEP = await p.evaluate(() => 'step' in window.__agora.stages);
  await p.evaluate(() => { window.__agora.stages.goMoon().catch(e => console.error('goMoon', e.message)); });
  if (STEP) {
    await phase('v-rise', () => { const s = window.__agora.stages.step; return s === 'lift' || s === 'rise' || s == null; }, 15000);
    await phase('v-flight', () => window.__agora.stages.step === 'flight', 20000);
    await phase('v-fade', () => window.__agora.stages.step === 'fade', 5000);
    await phase('v-plisse-approach', () => window.__agora.stages.step === 'approach', 15000);
    await phase('v-dive', () => window.__agora.stages.step === 'dive', 25000);
  } else {
    await phase('v-rise', () => { const s = window.__agora.stages; return s.scene === 'globe' && !document.getElementById('ag-plisse'); }, 10000);
    await phase('v-flight', () => { const s = window.__agora.stages; return s.scene === 'globe' && !s.fading; }, 20000);
    await phase('v-fade', () => window.__agora.stages.fading, 5000);
    await phase('v-plisse-approach', () => { const s = window.__agora.stages, b = s.bridge; return s.act3 === 'plisse' && !(b && +b.el.style.opacity > 0); }, 15000);
    await phase('v-dive', () => { const s = window.__agora.stages; return s.act3 === 'plisse'; }, 25000);
  }
  await p.waitForFunction(() => window.__agora.stages.act3 === 'lounge' && !window.__agora.stages.flying, { timeout: 40000 });
  await phase('v-lounge-idle', 5000);
  console.log('  state at the lounge', JSON.stringify(await S()));
  await p.evaluate(() => { window.__agora.stages.goHome().catch(e => console.error('goHome', e.message)); });
  if (STEP) {
    await phase('h-rising', () => { const s = window.__agora.stages.step; return s === 'rising' || s == null; }, 30000);
    await phase('h-plisse-leave', () => window.__agora.stages.step === 'leaving', 20000);
    await phase('h-return-flight', () => window.__agora.stages.scene !== 'world', 40000);   // the flight, her descent home and the hand-off
  } else {
    await phase('h-rising', () => window.__agora.stages.act3 === 'lounge', 30000);
    await phase('h-plisse-leave', () => window.__agora.stages.act3 === 'plisse', 20000);
    await phase('h-return-flight', () => window.__agora.stages.scene !== 'world', 30000);
  }
  await sleep(1500);
  await phase('home-idle', 5000);
  // diagnostics: what the home view pays for (the left-behind bridge iframe, the DOM tags, the stand-in)
  await p.evaluate(() => { const b = document.getElementById('landing-bridge'); if (b) b.style.display = 'none'; });
  await phase('home-no-bridge-el', 4000);
  await p.evaluate(() => { try { window.__agora.agents.showPins(false); } catch (e) {} });
  await phase('home-no-tags', 4000);
}
// scene diagnostics: objects, casters, draws per pass of one frame
const diag = await p.evaluate(() => new Promise(res => {
  const A = window.__agora, sc = A.planet.scene, R = A.planet.renderer;
  let objects = 0, meshes = 0, casters = 0, instanced = 0, visible = 0, flat = 0, tris = 0;
  sc.traverse(o => { objects++; if (o.isMesh) { meshes++; if (o.castShadow) casters++; if (o.isInstancedMesh) instanced++; if (o.visible) visible++; const g = o.geometry; if (g && g.index) tris += g.index.count / 3 * (o.isInstancedMesh ? o.count : 1); else if (g && g.attributes.position) tris += g.attributes.position.count / 3 * (o.isInstancedMesh ? o.count : 1); } });
  try { flat = A.adapter.flatObjects().length; } catch (e) {}
  const passes = []; const orig = R.render.bind(R); R.info.autoReset = false;
  R.render = function (scene, cam) { R.info.reset(); const t0 = performance.now(); orig(scene, cam); passes.push({ calls: R.info.render.calls, tris: R.info.render.triangles, ms: Math.round((performance.now() - t0) * 100) / 100, target: R.getRenderTarget() ? `${R.getRenderTarget().width}x${R.getRenderTarget().height}` : 'screen', shadows: R.shadowMap.enabled }); };
  setTimeout(() => { R.render = orig; R.info.autoReset = true; const n = passes.length; res({ objects, meshes, casters, instanced, visibleMeshes: visible, flatObjects: flat, trianglesInScene: Math.round(tris), passesPerFrame: n / Math.max(1, Math.round(n / 10)), lastFrame: passes.slice(-10), shadowMap: A.planet.world.sun.shadow.mapSize.x, targets: Object.fromEntries(Object.entries(A.planet.post.targets).map(([k, t]) => [k, t ? `${t.width}x${t.height}` : null])), folkTargets: A.pass.targets.w + 'x' + A.pass.targets.h, drawingBuffer: R.getDrawingBufferSize(new THREE.Vector2()).toArray(), pixelRatio: R.getPixelRatio() }); }, 400);
}));
console.log('\nscene diagnostics:', JSON.stringify(diag));
const errors = await p.evaluate(() => window.__agora.errors);
console.log(`\n## game (${TAG}, dpr ${DPR})\n`); console.log(table(rows));
console.log('\nJS ms per frame (game loop pieces; folkPassMs = the folk pass of the last frame):');
for (const r of rows) console.log(' ', r.phase.padEnd(18), JSON.stringify(r.jsPerFrame));
console.log('\ncontexts per frame (last):', JSON.stringify(rows[rows.length - 1].ctx), ' page errors:', JSON.stringify(errors));
writeFileSync(`${OUT}${TAG}-game-dpr${DPR}.json`, JSON.stringify({ rows, errors }, null, 1));
await b.close();
