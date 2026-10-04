// World lab screenshots: node tests/world/shoot.mjs [case ...]   (see CASES; default set = the review set)
// Serves the repo root with python3 -m http.server on a free port, drives headless Chrome (puppeteer-core),
// steps the lab with a fixed clock (window.__lab.step) and writes shots/world/<case>.png.
// env: QUERY='&view=eye' (extra lab query), POSE='{"dist":40}', PRE / RUN (js), TAG=prefix-, VIEWPORT=390x844
import puppeteer from 'puppeteer-core';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = process.env.OUT ? path.resolve(process.env.OUT) : path.join(ROOT, 'shots/world');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const freePort = () => new Promise(r => { const s = createServer(); s.listen(0, () => { const p = s.address().port; s.close(() => r(p)); }); });

const WAIT_LIB = 'for (let i = 0; i < 40 && !L.lib; i++) await new Promise(r => setTimeout(r, 100));';
const TOWN = WAIT_LIB + ' L.town(7); await new Promise(r => setTimeout(r, 900));';
const FULL = WAIT_LIB + ' L.town(14); await new Promise(r => setTimeout(r, 900)); L.world.setWorldBloom(1);';
const CLOSE20 = 'const sp = L.game.state.spawn; L.world.rig.setPose({ ...L.world.rig.pose(), tx: sp.x, tz: sp.z - 2, ty: L.world.groundY(sp.x, sp.z), dist: 20, pitch: 0.74 });';
const PICK = `const out = [];
  for (const [fx, fy] of [[0.5, 0.5], [0.2, 0.3], [0.8, 0.7], [0.5, 0.1], [0.1, 0.9]]) {
    const p = L.world.pick(innerWidth * fx, innerHeight * fy);
    out.push(p && { ...p, gy: +L.world.groundY(p.x, p.z).toFixed(3) });
  }
  const bs = L.game.state.buildings.map(b => ({ id: b.id, y: +L.world.siteY(b).toFixed(3), c: +L.world.groundY(b.x, b.z).toFixed(3),
    corners: [[1, 1], [-1, 1], [1, -1], [-1, -1]].map(([sx, sz]) => { const c = Math.cos(b.rot || 0), s = Math.sin(b.rot || 0), u = sx * b.footprint.w / 2, v = sz * b.footprint.d / 2; return +L.world.groundY(b.x + u * c + v * s, b.z - u * s + v * c).toFixed(3); }) }));
  console.error('PICK', JSON.stringify(out)); console.error('PADS', JSON.stringify(bs));`;
const PERF = `L.manual(false); ${TOWN}
  const t0 = performance.now(); for (let i = 0; i < 20; i++) L.painter.renderPainted(); L.ctx.renderer.getContext().finish();
  console.error('PERF renderPainted ms', ((performance.now() - t0) / 20).toFixed(1));
  let n = 0; const s0 = performance.now();
  await new Promise(r => { const f = () => { n++; if (performance.now() - s0 < 3000) requestAnimationFrame(f); else r(); }; requestAnimationFrame(f); });
  console.error('PERF raf fps', (n / 3).toFixed(1)); L.manual(true); await L.step(0.1);`;

const CASES = {
  default: { hash: '#gouache', run: 'await L.step(2)' },
  raw: { hash: '#raw', run: 'await L.step(2)' },
  town: { hash: '#gouache', run: TOWN + ' await L.step(4)' },
  bloommid: { hash: '#gouache', run: TOWN + ' await L.step(1.0)' },
  full: { hash: '#gouache', run: FULL + ' await L.step(4)' },
  fullwide: { hash: '#gouache', run: FULL + ' L.world.rig.setPose({ ...L.world.rig.pose(), dist: 210, pitch: 1.12 }); await L.step(4)' },
  descent0: { hash: '#gouache', run: "L.world.descent({ from: 'sky' }); await L.step(0.05)" },
  descent: { hash: '#gouache', run: "L.world.descent({ from: 'sky' }); await L.step(2.6)" },
  descent2: { hash: '#gouache', run: "L.world.descent({ from: 'sky' }); await L.step(3.9)" },
  descentend: { hash: '#gouache', run: "L.world.descent({ from: 'sky' }); await L.step(5.5)" },
  globe: { hash: '#gouache', run: "L.world.descent({ from: 'globe' }); await L.step(0.05)" },
  close20: { hash: '#gouache', run: TOWN + ' await L.step(3); ' + CLOSE20 + ' await L.step(1.5)' },
  close20raw: { hash: '#raw', run: TOWN + ' await L.step(3); ' + CLOSE20 + ' await L.step(1.5)' },
  close20start: { hash: '#gouache', run: CLOSE20 + ' await L.step(1.5)' },
  eye: { hash: '#gouache', run: 'L.world.rig.setPose({ ...L.VIEWS.eye }); await L.step(1)' },
  top: { hash: '#gouache', run: 'L.world.rig.setPose({ ...L.VIEWS.top }); await L.step(1)' },
  wide: { hash: '#gouache', run: 'L.world.rig.setPose({ ...L.world.rig.pose(), dist: 210, pitch: 1.12 }); await L.step(1)' },
  horizon: { hash: '#gouache', run: "L.world.showNeighbour('n1', { ms: 10 }); await L.step(0.5)" },
  horizon2: { hash: '#gouache', run: "L.world.showNeighbour('n2', { ms: 10 }); await L.step(0.5)" },
  horizon3: { hash: '#gouache', run: "L.world.showNeighbour('n3', { ms: 10 }); await L.step(0.5)" },
  visit: { hash: '#gouache', run: "L.world.visit('n3', { ms: 10 }); await L.step(0.5)" },
  close: { hash: '#gouache', run: TOWN + ' await L.step(3); L.ACT.close(); await L.step(2.5)' },
  custom: { hash: '#gouache', run: process.env.RUN || 'await L.step(0.1)' },
  nav: { hash: '#raw', run: WAIT_LIB + " for (let i = 0; i < 8; i++) L.place(); await new Promise(r => setTimeout(r, 900)); console.error('NAV', JSON.stringify(L.navCheck(3600)))" },
  pick: { hash: '#gouache', run: TOWN + ' await L.step(1); ' + PICK },
  perf: { hash: '#gouache', run: PERF },
  chrome: { hash: '#gouache', chrome: true, run: 'await L.step(1)' }
};
const want = process.argv.slice(2).length ? process.argv.slice(2) : ['default', 'town', 'full', 'descent0', 'descent', 'descentend', 'close20', 'eye'];
const port = await freePort();
const srv = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
await new Promise(r => setTimeout(r, 700));
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--use-angle=metal', '--enable-unsafe-swiftshader', '--window-size=1440,900', '--hide-scrollbars'] });
const results = {};
try {
  for (const name of want) {
    const c = CASES[name]; if (!c) { console.log('unknown case', name); continue; }
    const page = await browser.newPage();
    const [VW, VH] = (process.env.VIEWPORT || '1440x900').split('x').map(Number);
    await page.setViewport({ width: VW, height: VH, deviceScaleFactor: 1 });
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    page.on('console', m => {
      const t = m.text();
      if (/^(NAV|PICK|PADS|PERF|INFO)/.test(t)) { console.log(t); return; }
      if ((m.type() === 'error' || m.type() === 'warning') && !/Failed to load resource/.test(t)) errors.push(t);
    });
    const t0 = Date.now();
    await page.goto(`http://127.0.0.1:${port}/web/world-lab.html${c.chrome ? '?' : '?shot=1'}${process.env.QUERY || ''}${c.hash}`, { waitUntil: 'load' });
    await page.waitForFunction('window.__lab', { timeout: 60000 });
    const tb = Date.now() - t0;
    await page.evaluate('window.__lab.ready');
    await page.evaluate('new Promise(r => setTimeout(r, 600))');
    const info = await page.evaluate(`(async () => { const L = window.__lab; L.manual(true); ${process.env.PRE || ''}; ${process.env.POSE ? `L.world.rig.setPose({ ...L.world.rig.pose(), ...${process.env.POSE} });` : ''} ${c.run}; return { pose: L.world.rig.pose(), blooms: L.world.ground.blooms.length, paths: L.world.ground.paths.length, buildings: L.game.state.buildings.length, trees: L.world.scenery && L.world.scenery.treeCount, calls: L.ctx.renderer.info.render.calls, tris: L.ctx.renderer.info.render.triangles }; })()`);
    const file = path.join(OUT, `${process.env.TAG || ''}${name}.png`);
    await page.screenshot({ path: file });
    results[name] = { ...info, build: tb, ms: Date.now() - t0, errors };
    console.log(name, JSON.stringify(results[name]));
    await page.close();
  }
} finally { await browser.close(); srv.kill(); }
