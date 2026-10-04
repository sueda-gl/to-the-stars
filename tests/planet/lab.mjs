// The planet lab (web/planet-lab.html) driven headless with the frozen clock (as fidelity.mjs / api.mjs):
// geography + adapter checks, the 40 m walk test, the pick test, and the review shots into shots/planet/home/.
//   ~/.nvm/versions/node/v22.22.3/bin/node tests/planet/lab.mjs [--only=a,b] [--keep]
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = path.join(ROOT, 'shots/planet/home');
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const W = +(process.env.W || 1440), H = +(process.env.H || 900);
const ONLY = (process.argv.find(a => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
const want = k => !ONLY.length || ONLY.includes(k);
mkdirSync(OUT, { recursive: true });

const freePort = () => new Promise(res => { const s = createServer(); s.listen(0, () => { const p = s.address().port; s.close(() => res(p)); }); });
const port = await freePort();
const server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: path.join(ROOT, 'web'), stdio: 'ignore' });
const base = `http://127.0.0.1:${port}`;
for (let i = 0; i < 50; i++) { try { await fetch(base + '/'); break; } catch { await new Promise(r => setTimeout(r, 100)); } }
const browser = await puppeteer.launch({
  executablePath: CHROME, headless: true, defaultViewport: { width: W, height: H, deviceScaleFactor: 1 },
  args: ['--use-angle=metal', `--window-size=${W},${H}`, '--hide-scrollbars', '--disable-background-timer-throttling', '--disable-renderer-backgrounding']
});
function installClock() {
  let T = 1000;
  window.__rafQ = [];
  performance.now = () => T;
  window.requestAnimationFrame = cb => { window.__rafQ.push(cb); return window.__rafQ.length; };
  window.cancelAnimationFrame = () => {};
  window.__step = (n, ms = 1000 / 60) => { for (let i = 0; i < n; i++) { T += ms; const q = window.__rafQ; window.__rafQ = []; for (const cb of q) cb(T); } return T; };
}
const checks = [];
const check = (name, ok, info = '') => { checks.push({ name, ok, info }); console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${info ? '  ' + info : ''}`); };
const results = {};
let page;
try {
  page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log('  [page]', m.type(), m.text().slice(0, 300)); });
  await page.evaluateOnNewDocument(installClock);
  await page.goto(base + '/planet-lab.html?shot&view=orbit', { waitUntil: 'networkidle0', timeout: 90000 });
  await page.waitForFunction(() => window.__lab && window.__rafQ.length > 0, { timeout: 90000, polling: 100 });
  const step = n => page.evaluate(n => window.__step(n), n);
  const shot = async name => { await page.screenshot({ path: path.join(OUT, name + '.png') }); console.log('     shot', name); };
  const state = () => page.evaluate(() => { const s = window.__lab.planet.state(); return { mode: s.mode, alt: +s.altitude.toFixed(1), blend: +s.blend.toFixed(3), daylight: +s.daylight.toFixed(3), pass: { ...window.__lab.pass.stats } }; });
  await step(2);
  await page.waitForFunction(() => window.__lab.prefabsReady, { timeout: 60000, polling: 200 });
  await step(2);

  // geography + adapter
  results.geo = await page.evaluate(() => window.__lab.geo.stats());
  console.log('     geo', JSON.stringify(results.geo));
  const g = results.geo;
  check('lake from her terrain', g.lake && g.lake.area > 40 && g.lake.maxDepth > 0.2, JSON.stringify(g.lake));
  const adp = await page.evaluate(() => {
    const L = window.__lab, A = L.adapter, G = L.geo; let worst = 0, worstR = 0;
    for (let i = 0; i < 400; i++) {
      const x = Math.sin(i * 12.9) * 40, z = Math.cos(i * 7.7) * 40, y = (i % 5) * 3;
      const f = A.toFlat(A.toWorld(x, y, z)); worst = Math.max(worst, Math.abs(f.x - x), Math.abs(f.y - y), Math.abs(f.z - z));
      // groundY vs her analytic H: how far the drawn ground is from the field it samples
      const p = G.toPlanet(x, z, {}); worstR = Math.max(worstR, Math.abs(A.groundY(x, z) - Math.max(0, L.planet.terrain.H(p.fx, p.fz))));
    }
    const inPlot = [[0, 2], [-29, -25], [29, 29]].every(([x, z]) => G.inPlot(x, z));
    const sea = [[0, -32], [-20, -34], [20, -32]].every(([x, z]) => G.waterKind(x, z) === 'sea');
    const land = [[0, 2], [0, -20], [20, 20], [-25, 25]].every(([x, z]) => !G.isWater(x, z));
    const lakeC = G.lake.box, lx = (lakeC.x0 + lakeC.x1) / 2, lz = (lakeC.z0 + lakeC.z1) / 2;
    const road = (() => { let n = 0; for (let x = -30; x <= 30; x += 2) for (let z = -26; z <= 30; z += 2) if (G.onRoad(x, z, 2.5)) n++; return n; })();
    return { worst, worstR, inPlot, sea, land, lake: G.waterKind(lx, lz), road, nations: G.nations.map(n => [n.id, n.x, n.z, G.isWater(n.x, n.z)]) };
  });
  check('toFlat(toWorld(p)) == p (game coords)', adp.worst < 1e-6, adp.worst.toExponential(2));
  check('drawn ground vs her H field', adp.worstR < 1.0, `max |groundY - H| ${adp.worstR.toFixed(3)} m (her mesh is ~2 m a cell)`);
  check('plot dry, sea beyond z0, lake inside', adp.inPlot && adp.sea && adp.land && adp.lake === 'lake');
  check('the road stays off our plot', adp.road === 0, `plot points within 2.5 m of her road: ${adp.road}`);
  check('nations stand on land', adp.nations.every(n => !n[3]), JSON.stringify(adp.nations));

  // orbit, grain
  if (want('orbit')) {
    await step(90); results.orbit = await state(); await shot('orbit-grain');
    check('orbit is Grain, no daylight', results.orbit.blend < 0.01 && results.orbit.daylight < 0.01, JSON.stringify(results.orbit));
  }
  // the descent: grain -> gouache by altitude, onto the leader view
  if (want('descent')) {
    await page.evaluate(() => { window.__desc = window.__lab.VIEWS.descend().then(v => { window.__descDone = v; }); });
    const seq = [];
    for (let i = 0; i < 7; i++) {
      await step(i ? 60 : 1); const s = await state(); seq.push(s); console.log('     descent', i, JSON.stringify(s));
      if (i === 2 || i === 3) await shot(`descent-${i}`);
    }
    await step(30); results.descent = seq;
    const mid = seq.find(s => s.blend > 0.25 && s.blend < 0.8);
    check('mid-descent half Grain half Gouache', !!mid, mid ? JSON.stringify(mid) : '');
    const end = await state();
    check('landed on the leader view in Gouache', end.mode === 'local' && end.blend > 0.9, JSON.stringify(end) + ' (daylight is her curve: smooth(190, 32, alt))');
  }
  // leader view with folk + buildings
  if (want('leader')) {
    await page.evaluate(() => window.__lab.VIEWS.leader()); await page.evaluate(() => window.__lab.local({}, true));
    await step(150); results.leader = await state(); await shot('leader');
    check('the folk pass runs', results.leader.pass.mapped > 40 && results.leader.pass.frames > 0, JSON.stringify(results.leader.pass));
  }
  if (want('towards')) {
    await page.evaluate(() => { window.__lab.VIEWS.towards(); window.__lab.local({}, true); });
    await step(150); await shot('leader-towards');
  }
  if (want('landing')) {
    await page.evaluate(() => { window.__lab.VIEWS.landing(); window.__lab.local({}, true); });
    await step(120); results.landing = await state(); await shot('landing');
  }
  if (want('close')) {
    await page.evaluate(() => { window.__lab.VIEWS.close(); window.__lab.local({}, true); });
    await step(120); await shot('close');
  }
  // the pick test: click the screen centre and a few points, the ✕ is drawn where the ground was picked
  if (want('pick')) {
    await page.evaluate(() => { window.__lab.VIEWS.leader(); window.__lab.local({}, true); });
    await step(30);
    const pk = await page.evaluate(() => {
      const L = window.__lab, A = L.adapter, out = [];
      for (const [x, z] of [[0, 2], [12, -10], [-12, 10.5], [-20, 20], [22, 18], [0, -31]]) {
        const s = A.toScreen(x, A.surfaceY(x, z), z), p = A.pick(s.x, s.y);
        out.push({ x, z, sx: +s.x.toFixed(1), sy: +s.y.toFixed(1), px: p && +p.x.toFixed(3), pz: p && +p.z.toFixed(3), water: p && p.water, err: p ? Math.hypot(p.x - x, p.z - z) : null });
      }
      return out;
    });
    console.log('     pick', JSON.stringify(pk));
    results.pick = pk;
    check('pick lands on the drawn ground (round trip through her lens)', pk.every(p => p.err != null && p.err < 0.05), `worst ${Math.max(...pk.map(p => p.err || 99)).toFixed(4)} m`);
    check('pick knows the lake and the sea', pk[2].water === 'lake' && pk[5].water === 'sea');
    // a real mouse click on the screen at the windmill's left
    const s = await page.evaluate(() => { const A = window.__lab.adapter; return A.toScreen(14, A.groundY(14, -4), -4); });
    await page.mouse.click(s.x, s.y);
    await step(20);
    const lp = await page.evaluate(() => { const p = window.__lab.pick; return p && { x: p.x, z: p.z, water: p.water }; });
    check('a mouse click leaves the pencil ✕ there', lp && Math.hypot(lp.x - 14, lp.z + 4) < 0.1, JSON.stringify(lp));
    await shot('pick');
  }
  // the 40 m walk: feet within 5 cm of the drawn ground, upright to the radial up
  if (want('walk')) {
    const r = await page.evaluate(() => window.__lab.walkTest());
    results.walk = r;
    check('a flit walks 40 m: feet within 5 cm of the drawn ground, upright', r.ok, JSON.stringify(r));
  }
  check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
} catch (e) {
  console.error(e); check('ran', false, String(e));
} finally {
  writeFileSync(path.join(OUT, 'results.json'), JSON.stringify({ checks, results }, null, 1));
  await browser.close(); server.kill();
}
const failed = checks.filter(c => !c.ok).length;
console.log(`${checks.length - failed}/${checks.length} checks pass`);
process.exit(failed ? 1 : 0);
