// The leader rig's input, driven with real pointer / wheel / key events in headless Chrome:
// node tests/world/input.mjs   -> prints each check and exits 1 on a failure
import puppeteer from 'puppeteer-core';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const freePort = () => new Promise(r => { const s = createServer(); s.listen(0, () => { const p = s.address().port; s.close(() => r(p)); }); });
const port = await freePort();
const srv = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
await new Promise(r => setTimeout(r, 700));
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--use-angle=metal', '--window-size=1440,900'] });
let fails = 0;
const check = (name, ok, info) => { console.log(ok ? 'ok  ' : 'FAIL', name, info ? JSON.stringify(info) : ''); if (!ok) fails++; };
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  const errors = []; page.on('pageerror', e => errors.push(String(e)));
  await page.goto(`http://127.0.0.1:${port}/web/world-lab.html?shot=1&left=none#gouache`, { waitUntil: 'load' });
  await page.waitForFunction('window.__lab', { timeout: 60000 });
  await page.evaluate('window.__lab.ready');
  const goal = () => page.evaluate('({ ...window.__lab.world.rig.goal })');
  const settle = () => page.evaluate('new Promise(r => setTimeout(r, 150))');
  const drag = async (button, dx, dy, mods = []) => {
    for (const m of mods) await page.keyboard.down(m);
    await page.mouse.move(720, 450); await page.mouse.down({ button });
    for (let i = 1; i <= 10; i++) await page.mouse.move(720 + dx * i / 10, 450 + dy * i / 10);
    await page.mouse.up({ button });
    for (const m of mods) await page.keyboard.up(m);
    await settle();
  };
  let g0 = await goal();
  await drag('left', 200, 120);
  let g1 = await goal();
  check('left drag is left alone (marks own it)', g1.tx === g0.tx && g1.tz === g0.tz && g1.yaw === g0.yaw, { dtx: g1.tx - g0.tx, dyaw: g1.yaw - g0.yaw });
  g0 = g1; await drag('right', 200, 120); g1 = await goal();
  check('right drag pans along the ground', Math.hypot(g1.tx - g0.tx, g1.tz - g0.tz) > 10 && g1.yaw === g0.yaw, { dtx: +(g1.tx - g0.tx).toFixed(1), dtz: +(g1.tz - g0.tz).toFixed(1) });
  g0 = g1; await drag('middle', -150, 0); g1 = await goal();
  check('middle drag pans', Math.abs(g1.tx - g0.tx) > 5, { dtx: +(g1.tx - g0.tx).toFixed(1) });
  g0 = g1; await drag('right', 160, 60, ['Alt']); g1 = await goal();
  check('alt + right drag turns and tilts', Math.abs(g1.yaw - g0.yaw) > 0.3 && Math.abs(g1.pitch - g0.pitch) > 0.1 && Math.hypot(g1.tx - g0.tx, g1.tz - g0.tz) < 0.01, { dyaw: +(g1.yaw - g0.yaw).toFixed(2), dpitch: +(g1.pitch - g0.pitch).toFixed(2) });
  g0 = g1; await page.mouse.move(720, 450); for (let i = 0; i < 8; i++) await page.mouse.wheel({ deltaY: -120 }); await settle(); g1 = await goal();
  check('wheel zooms in (and the pitch eases lower)', g1.dist < g0.dist * 0.5 && g1.pitch < g0.pitch, { dist: +g1.dist.toFixed(1), pitch: +g1.pitch.toFixed(2) });
  for (let i = 0; i < 30; i++) await page.mouse.wheel({ deltaY: -240 }); await settle(); g1 = await goal();
  check('zoom stops at ~12 m', Math.abs(g1.dist - 12) < 0.01, { dist: g1.dist });
  for (let i = 0; i < 40; i++) await page.mouse.wheel({ deltaY: 240 }); await settle(); g1 = await goal();
  check('zoom out stops at the region overview (250 m)', Math.abs(g1.dist - 250) < 0.01, { dist: g1.dist });
  g0 = g1; await page.keyboard.down('q'); await page.evaluate('new Promise(r => setTimeout(r, 500))'); await page.keyboard.up('q'); g1 = await goal();
  check('Q turns', g1.yaw - g0.yaw > 0.2, { dyaw: +(g1.yaw - g0.yaw).toFixed(2) });
  g0 = g1; await page.keyboard.down('w'); await page.evaluate('new Promise(r => setTimeout(r, 500))'); await page.keyboard.up('w'); g1 = await goal();
  check('W moves', Math.hypot(g1.tx - g0.tx, g1.tz - g0.tz) > 20, { moved: +Math.hypot(g1.tx - g0.tx, g1.tz - g0.tz).toFixed(1) });
  await page.keyboard.down('w'); await page.evaluate('new Promise(r => setTimeout(r, 4000))'); await page.keyboard.up('w'); g1 = await goal();
  check('the target stays in the region (r <= 150 from the plot centre)', Math.hypot(g1.tx - 0, g1.tz - 2) <= 150.01, { r: +Math.hypot(g1.tx, g1.tz - 2).toFixed(1) });
  // the descent can't be interrupted; other moves can
  await page.evaluate("void window.__lab.world.descent({ from: 'sky', ms: 60000 })"); await settle();
  await drag('right', 200, 0);
  check('a drag during the descent does not interrupt it', await page.evaluate('window.__lab.world.rig.busy'), {});
  await page.evaluate("window.__lab.world.rig.stop(); void window.__lab.world.descent({ from: 'sky' })");
  await page.waitForFunction('!window.__lab.world.rig.busy', { timeout: 60000 });
  const end = await page.evaluate('window.__lab.world.rig.pose()');
  check('the descent lands on the leader view', Math.abs(end.pitch - 1.0) < 0.01 && Math.abs(end.dist - 168) < 0.5, { pitch: +end.pitch.toFixed(3), dist: +end.dist.toFixed(1) });
  // pick vs groundY across the screen
  const pk = await page.evaluate(`(() => { const W = window.__lab.world; let worst = 0, n = 0; for (let y = 60; y < 900; y += 90) for (let x = 60; x < 1440; x += 120) { const p = W.pick(x, y); if (!p) continue; n++; const want = p.water ? (p.water === 'lake' ? 0.03 : -0.9) : W.groundY(p.x, p.z); worst = Math.max(worst, Math.abs(p.y - want)); } return { n, worst }; })()`);
  check('pick lands on the visible surface (land / lake / sea)', pk.n > 100 && pk.worst < 0.02, pk);
  check('no page errors', !errors.length, errors.slice(0, 3));
} finally { await browser.close(); srv.kill(); }
process.exit(fails ? 1 : 0);
