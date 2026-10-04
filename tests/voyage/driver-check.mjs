// Checks the lounge driver against the REAL scene (instrumented copy, see instrument.mjs):
//  1. the camera model == the scene's camera, before and after a synthetic look() drag
//  2. for a grid of screen points, "would this tap spawn a seed?" (model) == what the scene did, and the seed lands where predicted
//  3. dropSeed('auto') makes shadelings gather (count within 1 m of the seed, at once and ~6 s later)
//  4. setGoldenHour / setPainted / hideOwnChrome do what they say
// Usage: node tests/voyage/driver-check.mjs   (Node 22; serves the repo with python3 -m http.server)
import puppeteer from 'puppeteer-core';
import { spawn, execSync } from 'node:child_process';
import { createServer } from 'node:net';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
const root = new URL('../../', import.meta.url).pathname;
const sha = f => createHash('sha256').update(readFileSync(root + f)).digest('hex');
const want = readFileSync(root + 'reference/SHA256', 'utf8').match(/(\w{64})\s+reference\/alpine-lounge-final\.html/)[1];
if (sha('web/worlds/lounge.html') !== want) { console.error('lounge.html is NOT byte-identical'); process.exit(1); }
console.log('lounge.html sha256 ok', want.slice(0, 12));
execSync('node tests/voyage/instrument.mjs', { cwd: root, stdio: 'inherit' });
const port = await new Promise(r => { const s = createServer(); s.listen(0, () => { const p = s.address().port; s.close(() => r(p)); }); });
const srv = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: root, stdio: 'ignore' });
await new Promise(r => setTimeout(r, 700));
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal', '--enable-unsafe-swiftshader', '--window-size=1440,900'], defaultViewport: { width: 1440, height: 900 } });
let fails = 0; const check = (ok, msg) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg); if (!ok) fails++; };
try {
  const page = await browser.newPage();
  page.on('pageerror', e => console.log('pageerror', e.message));
  page.on('console', m => { if (/error|driver/i.test(m.text())) console.log('console', m.text()); });
  await page.goto(`http://127.0.0.1:${port}/tests/voyage/host.html?src=/tests/voyage/out/lounge-instrumented.html`);
  await page.waitForFunction(() => window.__driver, { timeout: 10000 });
  await page.evaluate(() => window.__driver.ready(60000));
  await new Promise(r => setTimeout(r, 1500));
  const camErr = () => page.evaluate(() => {
    const d = window.__driver, L = d.window.__lounge, w = d.window.innerWidth, h = d.window.innerHeight;
    const B = d.camera.basis(w, h), p = L.camera.position;
    return Math.hypot(B.pos[0] - p.x, B.pos[1] - p.y, B.pos[2] - p.z);
  });
  check((await camErr()) < 1e-3, `camera model matches at rest (err ${(await camErr()).toExponential(2)})`);
  // grid of taps
  const grid = await page.evaluate(async () => {
    const d = window.__driver, L = d.window.__lounge, w = d.window.innerWidth, h = d.window.innerHeight;
    let agree = 0, n = 0, valid = 0, maxErr = 0; const bad = [];
    for (let v = 0.30; v <= 0.985; v += 0.035) for (let u = 0.03; u <= 0.97; u += 0.047) {
      const x = u * w, y = v * h, pred = d.wouldSeed(x, y), g = d.groundAt(x, y);
      L.seed.active = false; L.seed.pos.set(999, 999);
      d.tap(x, y);
      const got = L.seed.active && L.seed.pos.x !== 999;
      n++; if (got === pred) agree++; else bad.push([+u.toFixed(3), +v.toFixed(3), pred, got]);
      if (got) { valid++; maxErr = Math.max(maxErr, Math.hypot(L.seed.pos.x - g.x, L.seed.pos.y - g.z)); }
    }
    L.seed.active = false;
    return { agree, n, valid, maxErr, bad: bad.slice(0, 8) };
  });
  check(grid.agree === grid.n, `tap validity model agrees on ${grid.agree}/${grid.n} points (${grid.valid} spawn a seed), max landing error ${grid.maxErr.toExponential(2)} m ${grid.bad.length ? JSON.stringify(grid.bad) : ''}`);
  // look
  const lk = await page.evaluate(async () => { const c = await window.__driver.look(140, -40, { ms: 700, settle: 2200 }); return c; });
  const e2 = await camErr();
  check(e2 < 0.02 && Math.abs(lk.theta) > 0.1, `look(140,-40) turned the real camera (theta ${lk.theta.toFixed(3)}), model err ${e2.toFixed(4)} m`);
  const grid2 = await page.evaluate(async () => {
    const d = window.__driver, L = d.window.__lounge, w = d.window.innerWidth, h = d.window.innerHeight;
    let agree = 0, n = 0;
    for (let v = 0.4; v <= 0.98; v += 0.06) for (let u = 0.05; u <= 0.95; u += 0.09) {
      const x = u * w, y = v * h, pred = d.wouldSeed(x, y);
      L.seed.active = false; L.seed.pos.set(999, 999); d.tap(x, y);
      const got = L.seed.active && L.seed.pos.x !== 999; n++; if (got === pred) agree++;
    }
    L.seed.active = false; return { agree, n };
  });
  check(grid2.agree >= grid2.n - 1, `after look(): tap model agrees on ${grid2.agree}/${grid2.n}`);
  await page.evaluate(() => window.__driver.lookHome({ settle: 2200 }));
  check((await camErr()) < 0.02, `lookHome() back to the opening framing (err ${(await camErr()).toFixed(4)})`);
  // gathering
  await new Promise(r => setTimeout(r, 3000));   // let the earlier test seeds be forgotten
  const g0 = await page.evaluate(async () => {
    const d = window.__driver, L = d.window.__lounge;
    const r = await d.dropSeed('auto');
    const near = () => L.shadelings.filter(s => !s.sleeper && s.pos.distanceTo(L.seed.pos) < 1.0).length;
    window.__near = near; return { r, n0: near(), active: L.seed.active };
  });
  await new Promise(r => setTimeout(r, 6000));
  const n6 = await page.evaluate(() => window.__near());
  check(g0.r.ok && g0.active && n6 >= g0.n0 + 4, `dropSeed('auto') at (${g0.r.world.x.toFixed(2)}, ${g0.r.world.z.toFixed(2)}): shadelings within 1 m: ${g0.n0} -> ${n6} after 6 s`);
  // buttons + chrome
  const ui = await page.evaluate(async () => {
    const d = window.__driver, L = d.window.__lounge;
    const a = await d.setGoldenHour(true), a2 = await d.setGoldenHour(true);
    await new Promise(r => setTimeout(r, 4000)); const mix = L.mix;
    const b = await d.setPainted(false), b2 = await d.setPainted(true);
    const c = await d.hideOwnChrome(true);
    await new Promise(r => setTimeout(r, 900));
    const op = d.window.getComputedStyle(d.document.querySelector('.bar')).opacity;
    const c2 = await d.hideOwnChrome(false);
    await new Promise(r => setTimeout(r, 900));
    const op2 = d.window.getComputedStyle(d.document.querySelector('.bar')).opacity;
    await d.setGoldenHour(false);
    return { a, a2, mix, b, b2, c, op, c2, op2, label: d.document.getElementById('toggleLabel').textContent };
  });
  check(ui.a && ui.a2 && ui.mix > 0.9, `setGoldenHour(true) twice stays on, scene mix -> ${ui.mix.toFixed(3)}`);
  check(ui.b === false && ui.b2 === true, `setPainted(false/true) -> ${ui.b}/${ui.b2}`);
  check(ui.c && +ui.op < 0.05 && !ui.c2 && +ui.op2 > 0.95, `hideOwnChrome on/off: bar opacity ${ui.op} -> ${ui.op2}`);
  check(sha('web/worlds/lounge.html') === want, 'lounge.html still byte-identical after the run');
} finally { await browser.close(); srv.kill(); }
console.log(fails ? `${fails} FAILED` : 'all passed');
process.exit(fails ? 1 : 0);
