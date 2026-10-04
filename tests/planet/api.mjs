// The planet API, exercised on web/planet.html with the frozen clock (same as fidelity.mjs):
// surface round trips, descendTo (orbit -> a coastal meadow, a contact sheet of the flight), cameraLocal,
// pick / toScreen through her lens, an upright marker via placeOnSurface, orbit() back, overrides.
//   ~/.nvm/versions/node/v22.22.3/bin/node tests/planet/api.mjs
import { spawn, execFileSync } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = path.join(ROOT, 'shots/planet/api');
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const W = 1440, H = 900;
mkdirSync(OUT, { recursive: true });

const freePort = () => new Promise(res => { const s = createServer(); s.listen(0, () => { const p = s.address().port; s.close(() => res(p)); }); });
const port = await freePort();
const server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
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
let page;
try {
  page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.evaluateOnNewDocument(installClock);
  await page.goto(base + '/web/planet.html', { waitUntil: 'networkidle0', timeout: 90000 });
  await page.waitForFunction(() => window.__planet && window.__rafQ.length > 0, { timeout: 90000, polling: 100 });
  await page.addStyleTag({ content: '#ui,#loading{display:none!important}' });
  const step = n => page.evaluate(n => window.__step(n), n);
  const state = () => page.evaluate(() => window.__planet.state());
  const shot = async name => { await page.screenshot({ path: path.join(OUT, name + '.png') }); return path.join(OUT, name + '.png'); };
  await step(1);

  // surface API
  const surf = await page.evaluate(() => {
    const P = window.__planet; let worst = 0;
    for (let i = 0; i < 500; i++) {
      const fx = (Math.sin(i * 12.9) * 0.5) * 500, fz = (Math.cos(i * 7.7) * 0.5) * 500, y = (i % 7) * 6;
      const q = P.worldToFlat(P.flatToWorld(fx, y, fz));
      worst = Math.max(worst, Math.abs(q.x - fx), Math.abs(q.y - y), Math.abs(q.z - fz));
    }
    const f = P.frameAt(22, 38, { yaw: 0.5 }), n = P.normalAtFlat(22, 38);
    return { worst, ortho: Math.max(Math.abs(f.up.dot(f.east)), Math.abs(f.up.dot(f.south)), Math.abs(f.east.dot(f.south))),
      normalUp: n.dot(f.up), h: f.height, water: P.isWaterFlat(22, 38), seaAt: P.isWaterFlat(40, 80) };
  });
  check('worldToFlat(flatToWorld(p)) == p', surf.worst < 1e-6, `worst ${surf.worst.toExponential(2)}`);
  check('frameAt is orthonormal', surf.ortho < 1e-9, `max |dot| ${surf.ortho.toExponential(2)}`);
  check('normalAtFlat points up the right way', surf.normalUp > 0.8, `n.up ${surf.normalUp.toFixed(3)}, h ${surf.h.toFixed(2)}`);
  check('isWaterFlat: meadow dry, (40,80) sea', !surf.water && surf.seaAt);

  // descendTo: orbit -> the coastal meadow south of the tower, a contact sheet
  await page.evaluate(() => { window.__desc = window.__planet.descendTo({ fx: 22, fz: 38, alt: 52, pitch: 1.0, yaw: 0.35, ms: 6000 }).then(v => { window.__descDone = v; }); });
  const frames = [];
  for (let i = 0; i <= 6; i++) {
    if (i) await step(60);
    const s = await state();
    frames.push({ file: await shot(`descent-${i}`), s });
    console.log(`     t=${i}s  mode ${s.mode}  alt ${s.altitude.toFixed(1)}  uBlend ${s.blend.toFixed(3)}  DAYLIGHT ${s.daylight.toFixed(3)}  fov ${s.fov.toFixed(1)}`);
  }
  await step(4);
  const done = await page.evaluate(() => window.__descDone);
  const sEnd = await state();
  check('descendTo resolves true and lands in local mode', done === true && sEnd.mode === 'local', `mode ${sEnd.mode}`);
  check('blend ran Grain -> Gouache by altitude', frames[0].s.blend < 0.05 && sEnd.blend > 0.95, `${frames[0].s.blend.toFixed(3)} -> ${sEnd.blend.toFixed(3)}`);
  check('daylight came up by altitude', frames[0].s.daylight < 0.05 && sEnd.daylight > 0.9, `${frames[0].s.daylight.toFixed(3)} -> ${sEnd.daylight.toFixed(3)}`);
  const altMono = frames.every((f, i) => !i || f.s.altitude <= frames[i - 1].s.altitude + 1e-6);
  check('the flight only goes down', altMono, frames.map(f => f.s.altitude.toFixed(0)).join(' > '));
  await step(60);
  await shot('descent-landed');
  execFileSync('python3', ['-c', `
import sys
from PIL import Image
fs=sys.argv[1:-1]; ims=[Image.open(f).convert('RGB').resize((480,300)) for f in fs]
sheet=Image.new('RGB',(480*4,300*2),(0,0,0))
for i,im in enumerate(ims): sheet.paste(im,((i%4)*480,(i//4)*300))
sheet.save(sys.argv[-1])`, ...frames.map(f => f.file), path.join(OUT, 'descent-landed.png'), path.join(OUT, 'descent-sheet.png')]);

  // pick / toScreen through the lens
  const pk = await page.evaluate(() => {
    const P = window.__planet, c = P.pick(720, 450), pts = [[300, 700], [1100, 300], [200, 200], [1300, 820]];
    const round = pts.map(([x, y]) => { const h = P.pick(x, y); if (!h) return null; const s = P.toScreen(h.world); return Math.hypot(s.x - x, s.y - y); });
    return { c: c && { fx: c.fx, fz: c.fz, onWater: c.onWater }, round };
  });
  check('pick(centre) = the focus', pk.c && Math.hypot(pk.c.fx - 22, pk.c.fz - 38) < 1.5, pk.c ? `(${pk.c.fx.toFixed(2)}, ${pk.c.fz.toFixed(2)})` : 'null');
  check('toScreen(pick(x,y).world) = (x,y) under her fisheye', pk.round.every(d => d !== null && d < 1.5), pk.round.map(d => d === null ? 'sky' : d.toFixed(2) + 'px').join(', '));

  // an upright marker on the slope + the close landing view
  await page.evaluate(() => {
    const P = window.__planet, g = new THREE.Group();
    const mat = new THREE.MeshLambertMaterial({ color: 0xe0503f });
    for (const [fx, fz] of [[22, 38], [16, 30], [28, 32], [10, 41]]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(1.2, 4, 1.2).translate(0, 2, 0), mat);
      m.castShadow = true; P.placeOnSurface(m, fx, fz, { yaw: 0.6 }); g.add(m);
    }
    P.surface.add(g); window.__markers = g;
    P.cameraLocal({ fx: 22, fz: 38, dist: 24, pitch: 1.25, yaw: 0.35, snap: true });
  });
  await step(2); await shot('local-close-markers');
  await step(120); await shot('local-close-markers-settled');
  const sClose = await state();
  check('cameraLocal close view', sClose.mode === 'local' && sClose.altitude < 40, `alt ${sClose.altitude.toFixed(1)}, blend ${sClose.blend.toFixed(3)}`);

  // leader view (high oblique), eased
  await page.evaluate(() => window.__planet.cameraLocal({ fx: 22, fz: 30, dist: 110, pitch: 1.05, yaw: 0.35 }));
  await step(300); await shot('local-leader');

  // back to orbit (her return), then a second flight to the east coast
  await page.evaluate(() => { window.__planet.surface.remove(window.__markers); window.__planet.orbit(); });
  await step(420);
  const sOrb = await state();
  await shot('orbit-back');
  check('orbit() returns to Grain in orbit', sOrb.mode === 'orbit' && sOrb.blend < 0.05, `alt ${sOrb.altitude.toFixed(0)}, blend ${sOrb.blend.toFixed(3)}`);
  await page.evaluate(() => { window.__planet.descendTo({ fx: 92, fz: 12, alt: 60, pitch: 1.05, yaw: 2.3, ms: 5000 }); });
  await step(150); await shot('flight2-mid');
  await step(200); await shot('flight2-landed');
  check('second flight lands', (await state()).mode === 'local');

  // overrides
  const ov = await page.evaluate(() => {
    const P = window.__planet; P.setBlend(0); P.setDaylight(0.3); window.__step(2);
    const a = { blend: P.blend, day: P.daylight }; P.autoBlend(true); P.autoDaylight(true); window.__step(2);
    return { a, b: { blend: P.blend, day: P.daylight } };
  });
  check('setBlend / setDaylight override, auto* restore', ov.a.blend === 0 && Math.abs(ov.a.day - 0.3) < 1e-9 && ov.b.blend > 0.9,
    JSON.stringify(ov));
  await page.evaluate(() => { window.__planet.setBlend(0); window.__planet.setDaylight(1); window.__step(2); });
  await shot('flight2-grain-daylight');
  // free camera (the voyage / cut scenes): out in space, Grain + night come back by altitude
  const fr = await page.evaluate(() => {
    const P = window.__planet; P.autoBlend(true); P.autoDaylight(true);
    P.cameraFree({ position: new THREE.Vector3(600, 430, 560), look: new THREE.Vector3(0, 40, 0), up: new THREE.Vector3(0, 1, 0), fov: 40, snap: true });
    window.__step(3); return P.state();
  });
  await shot('free-space');
  check('cameraFree in space', fr.mode === 'free' && fr.blend < 0.05 && fr.daylight < 0.05, `alt ${fr.altitude.toFixed(0)}, blend ${fr.blend.toFixed(3)}`);
  check('no page errors', errors.length === 0, errors.join(' | '));
} finally {
  await browser.close();
  server.kill();
}
writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(checks, null, 2));
const ok = checks.every(c => c.ok);
console.log(ok ? 'PLANET API PASS' : 'PLANET API FAIL');
process.exit(ok ? 0 : 1);
