// Globe verification after the review (2026-10-03): interrupted moves, the render() hazard, stepped dives with
// contact sheets, and the stills the review flagged. Deterministic: the globe's own loop is stopped and the
// test steps g.tick(1/60) by hand.
//   ~/.nvm/versions/node/v22.22.3/bin/node tests/globe/verify.mjs        -> shots/globe-fix/*.png + verify.json
import { spawn, execFileSync } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = path.join(ROOT, 'shots/globe-fix'), TMP = path.join(OUT, '.frames');
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
mkdirSync(TMP, { recursive: true });
const freePort = () => new Promise(res => { const s = createServer(); s.listen(0, () => { const p = s.address().port; s.close(() => res(p)); }); });
const port = await freePort();
const server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
const base = `http://127.0.0.1:${port}`;
for (let i = 0; i < 50; i++) { try { await fetch(base + '/'); break; } catch { await new Promise(r => setTimeout(r, 100)); } }
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, protocolTimeout: 600000, defaultViewport: { width: 1440, height: 900, deviceScaleFactor: 1 },
  args: ['--use-angle=metal', '--hide-scrollbars', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e.stack || e).slice(0, 500)));
page.on('console', m => { if (m.type() === 'error' && !/favicon|404/.test(m.text())) errors.push('console: ' + m.text().slice(0, 300)); });
await page.goto(`${base}/web/globe-lab.html?ui=0`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__globeReady === true || window.__globeError, { timeout: 120000 });
const overlayGone = await page.evaluate(() => !document.getElementById('loading'));
await page.evaluate(() => {
  const g = window.__globe; g.stop(); g.setAutoSpin(false);
  // run(code): start a move without awaiting it (the loop is stopped: the test steps the clock)
  window.__run = (code, key = 'mv') => { const g = window.__globe; const rec = window['__' + key] = { done: false, result: null }; Promise.resolve(eval(code)).then(v => { rec.done = true; rec.result = v; }); };
  window.__step = async n => { const g = window.__globe; for (let i = 0; i < n; i++) { g.tick(1 / 60); await null; await null; await null; } };
  window.__state = () => { const g = window.__globe, s = g.stats(); return { mode: g.mode, body: g.body, lastPlace: g.lastPlace, busy: g.busy, clearE: +s.clearE.toFixed(2), clearM: +s.clearM.toFixed(2) }; };
  window.__paint = () => { const g = window.__globe; g.markDirty(); g.tick(0); };
});
const ev = (f, ...a) => page.evaluate(f, ...a);
const step = n => ev(n => window.__step(n), n);
const shot = async (name, paint = true) => { if (paint) await ev(() => window.__paint()); const f = path.join(OUT, name + '.png'); await page.screenshot({ path: f }); return f; };
const settle = async (key = 'mv', max = 2400) => { for (let i = 0; i < max; i += 30) { if (await ev(k => window['__' + k].done, key)) return true; await step(30); } return false; };
const results = { overlayGoneAtReady: overlayGone, interrupt: {}, hazard: {}, moves: {}, errors };
const check = (name, got, want) => { const ok = Object.entries(want).every(([k, v]) => got[k] === v); results.interrupt[name] = { ok, got, want }; console.log(ok ? 'PASS' : 'FAIL', name, JSON.stringify(got)); return ok; };

// ---------- 1. interrupted moves: the newest move always wins, and an old chain never resumes ----------
await ev(() => window.__globe.snapTo());
await ev(() => window.__run('g.flyToMoon()', 'a')); await step(90);                          // 1.5 s into the voyage
await ev(() => window.__run('g.dive("home")', 'b')); await settle('b'); await step(240);
check('flyToMoon then dive home at 1.5s', { ...(await ev(() => window.__state())), oldResult: await ev(() => window.__a.result), newResult: await ev(() => window.__b.result) },
  { mode: 'surface', body: 'earth', lastPlace: 'home', oldResult: false, newResult: true });
await shot('interrupt-moon-then-home');

await ev(() => window.__globe.snapTo());
await ev(() => window.__run('g.flyToMoon()', 'a')); await step(210);                         // 3.5 s: already diving onto the Moon (body = moon)
await ev(() => window.__run('g.dive("n2")', 'b')); await settle('b'); await step(240);
check('flyToMoon then dive n2 at 3.5s (body already moon)', { ...(await ev(() => window.__state())), oldResult: await ev(() => window.__a.result) },
  { mode: 'surface', body: 'earth', lastPlace: 'n2', oldResult: false });

await ev(() => window.__globe.snapTo('moon'));
await ev(() => window.__run('g.flyToEarth()', 'a')); await step(60);
await ev(() => window.__run('g.dive("n1")', 'b')); await settle('b'); await step(240);
check('flyToEarth then dive n1 at 1s', { ...(await ev(() => window.__state())), oldResult: await ev(() => window.__a.result) },
  { mode: 'surface', body: 'earth', lastPlace: 'n1', oldResult: false });

await ev(() => window.__globe.snapTo());
await ev(() => window.__run('g.dive("home")', 'a')); await step(60);
await ev(() => window.__run('g.rise()', 'b')); await settle('b'); await step(240);
check('dive home then rise at 1s', await ev(() => window.__state()), { mode: 'orbit', body: 'earth', lastPlace: null });

await ev(() => window.__globe.snapTo());
await ev(() => window.__run('g.dive("n1")', 'a')); await step(60);
await ev(() => window.__globe.snapTo('n3')); await step(400);
check('dive n1 then cut to n3', { ...(await ev(() => window.__state())), oldResult: await ev(() => window.__a.result) }, { mode: 'surface', lastPlace: 'n3', busy: false, oldResult: false });

await ev(() => window.__globe.snapTo('moon'));
await ev(() => window.__run('g.orbit({ az: 2.2, el: 0.3 })', 'a')); await settle('a'); await step(240);
{
  const eye = await ev(() => window.__globe.stats().eye);
  const want = await ev(() => { const g = window.__globe; g.snapTo({ az: 2.2, el: 0.3 }); return g.stats().eye; });
  const err = Math.hypot(eye[0] - want[0], eye[1] - want[1], eye[2] - want[2]);
  check('orbit({az, el}) from the Moon lands on the asked pose', { ...(await ev(() => window.__state())), poseOk: err < 1 }, { mode: 'orbit', body: 'earth', poseOk: true });
}

await ev(() => window.__globe.snapTo('home'));
await ev(() => window.__run('g.flyToEarth()', 'a')); await settle('a');
check('flyToEarth on Earth is a no-op', await ev(() => window.__state()), { mode: 'surface', body: 'earth', lastPlace: 'home' });

// 2026-10-04: more chains, rapid fire, and continuity: at the moment a new move takes over, the camera must not
// jump (the eye's step in the interrupt frame stays within ~3x the steps around it)
async function jumpAround(code, key) {
  const before = await ev(() => { const g = window.__globe; const a = g.stats().eye; g.tick(1 / 60); const b = g.stats().eye; return [a, b]; });
  await ev(c => window.__run(c, 'j'), code);
  const after = await ev(() => { const g = window.__globe; const a = g.stats().eye; g.tick(1 / 60); const b = g.stats().eye; g.tick(1 / 60); const c = g.stats().eye; return [a, b, c]; });
  const d = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
  const s0 = d(before[0], before[1]), s1 = d(after[0], after[1]), s2 = d(after[1], after[2]);
  return { stepBefore: +s0.toFixed(3), stepAt: +s1.toFixed(3), stepAfter: +s2.toFixed(3), smooth: s1 <= Math.max(s0, s2) * 3 + 0.5 };
}
await ev(() => window.__globe.snapTo());
await ev(() => window.__run('g.flyToMoon()', 'a')); await step(200);
await ev(() => window.__run('g.flyToEarth()', 'b')); await settle('b'); await step(120);
check('flyToMoon then flyToEarth mid-flight', { ...(await ev(() => window.__state())), oldResult: await ev(() => window.__a.result), newResult: await ev(() => window.__b.result) },
  { mode: 'orbit', body: 'earth', lastPlace: null, oldResult: false, newResult: true });

await ev(() => window.__globe.snapTo());
await ev(() => window.__run('g.dive("n1")', 'a')); await step(20);
await ev(() => window.__run('g.dive("n2")', 'b')); await step(20);
await ev(() => window.__run('g.flyToMoon()', 'c')); await settle('c'); await step(120);
check('rapid fire: dive n1, dive n2, flyToMoon', { ...(await ev(() => window.__state())), r1: await ev(() => window.__a.result), r2: await ev(() => window.__b.result), r3: await ev(() => window.__c.result) },
  { mode: 'surface', body: 'moon', lastPlace: 'moon', r1: false, r2: false, r3: true });

await ev(() => window.__globe.snapTo('home'));
await ev(() => window.__run('g.flyToMoon()', 'a')); await step(320);                        // 5.3 s: descending onto the Moon
await ev(() => window.__run('g.rise()', 'b')); await settle('b'); await step(120);
check('flyToMoon then rise during the Moon descent', { ...(await ev(() => window.__state())), oldResult: await ev(() => window.__a.result) },
  { mode: 'moon-orbit', body: 'moon', lastPlace: null, oldResult: false });

await ev(() => window.__globe.snapTo());
await ev(() => window.__run('g.dive("home")', 'a')); await step(100);
await ev(() => window.__run('g.orbit({ az: 1.2, el: 0.2 })', 'b')); await settle('b'); await step(60);
check('dive home then orbit({az}) mid-dive', { ...(await ev(() => window.__state())), oldResult: await ev(() => window.__a.result), newResult: await ev(() => window.__b.result) },
  { mode: 'orbit', body: 'earth', lastPlace: null, oldResult: false, newResult: true });

results.continuity = {};
for (const [name, setup, first, steps, second] of [
  ['dive home -> dive n3', 'g.snapTo()', 'g.dive("home")', 110, 'g.dive("n3")'],
  ['flyToMoon -> dive home', 'g.snapTo()', 'g.flyToMoon()', 150, 'g.dive("home")'],
  ['flyToEarth -> flyToMoon', 'g.snapTo("moon")', 'g.flyToEarth()', 120, 'g.flyToMoon()'],
  ['dive n1 -> snap', 'g.snapTo()', 'g.dive("n1")', 90, 'g.rise()']
]) {
  await ev(c => { const g = window.__globe; eval(c); g.tick(1 / 60); }, setup);
  await ev(c => window.__run(c, 'a'), first); await step(steps);
  const j = await jumpAround(second);
  for (let i = 0; i < 40 && !(await ev(() => window.__j.done)); i++) await step(30);
  results.continuity[name] = { ...j, newResult: await ev(() => window.__j.result), oldResult: await ev(() => window.__a.result) };
  const ok = j.smooth && results.continuity[name].newResult === true && results.continuity[name].oldResult === false;
  results.interrupt['continuity: ' + name] = { ok, got: results.continuity[name] };
  console.log(ok ? 'PASS' : 'FAIL', 'continuity', name, JSON.stringify(results.continuity[name]));
}

// ---------- 2. the API hazard: a bare render() after a tick must paint the same picture ----------
for (const [name, cut] of [['orbit', 'g.snapTo()'], ['home', 'g.snapTo("home")'], ['n2', 'g.snapTo("n2")']]) {
  await ev(c => { const g = window.__globe; eval(c); g.tick(1 / 60); g.markDirty(); g.tick(1 / 60); }, cut);
  const a = await shot(`hazard-${name}-tick`, false);
  await ev(() => { window.__globe.render(); window.__globe.render(); });
  const b = await shot(`hazard-${name}-render`, false);
  const diff = execFileSync('python3', ['-c', `
import sys
from PIL import Image, ImageChops, ImageStat
a = Image.open(sys.argv[1]).convert('RGB'); b = Image.open(sys.argv[2]).convert('RGB')
print(round(sum(ImageStat.Stat(ImageChops.difference(a, b)).mean) / 3, 3))`, a, b]).toString().trim();
  results.hazard[name] = +diff; console.log('hazard', name, 'mean diff', diff);
}

// ---------- 3. stepped moves with contact sheets ----------
async function move(name, setup, code, frames = 8, ms = 3300) {
  await ev(c => { const g = window.__globe; eval(c); g.tick(1 / 60); }, setup);
  await ev(c => window.__run(c), code);
  const total = Math.ceil(ms / (1000 / 60)), files = [];
  let rec = { minClearE: 1e9, minClearM: 1e9 };
  for (let k = 1; k <= frames; k++) {
    const n = Math.round(total * k / frames) - Math.round(total * (k - 1) / frames);
    for (let i = 0; i < n; i += 10) { await step(Math.min(10, n - i)); const s = await ev(() => window.__state()); rec.minClearE = Math.min(rec.minClearE, s.clearE); rec.minClearM = Math.min(rec.minClearM, s.clearM); }
    files.push(await shot(`.frames/${name}-${k}`, false));
  }
  await settle();
  const end = await shot(`${name}-end`);
  results.moves[name] = { ...rec, end: await ev(() => window.__state()), result: await ev(() => window.__mv.result) };
  console.log('move', name, JSON.stringify(results.moves[name]));
  execFileSync('python3', ['-c', `
import sys
from PIL import Image
fs = sys.argv[2:]; ims = [Image.open(f).resize((480, 300)) for f in fs]
cols = 4; rows = (len(ims) + cols - 1) // cols
sheet = Image.new('RGB', (cols * 480, rows * 300), (243, 236, 220))
for i, im in enumerate(ims): sheet.paste(im, ((i % cols) * 480, (i // cols) * 300))
sheet.save(sys.argv[1])`, path.join(OUT, `sheet-${name}.png`), ...files]);
}
await move('dive-home', 'g.setHomeGrowth(0); g.snapTo()', 'g.dive("home")', 12, 3300);
await move('dive-n1', 'g.snapTo()', 'g.dive("n1")', 8, 3300);
await move('dive-wonder', 'g.snapTo()', 'g.dive("wonder")', 8, 3300);
await move('flyToMoon', 'g.snapTo("home")', 'g.flyToMoon()', 12, 6100);
await move('moon-rise', 'g.snapTo("moon")', 'g.rise()', 4, 2300);
await move('flyToEarth', 'g.snapTo("moon")', 'g.flyToEarth()', 8, 5100);

// ---------- 4. stills ----------
const stills = [
  ['orbit', 'g.setHomeGrowth(0); g.snapTo()'],
  ['orbit-growth1', 'g.setHomeGrowth(1); g.snapTo({ el: 0.12, dist: 420 })'],
  ['home-growth1', 'g.setHomeGrowth(1); g.snapTo("home")'],
  ['n1', 'g.setHomeGrowth(0); g.snapTo("n1")'], ['n2', 'g.snapTo("n2")'], ['n3', 'g.snapTo("n3")'],
  ['wonder', 'g.snapTo("wonder")'], ['moon', 'g.snapTo("moon")']
];
for (const [name, c] of stills) { await ev(c => { const g = window.__globe; eval(c); for (let i = 0; i < 70; i++) g.tick(1 / 60); }, c); await shot(name); }

await browser.close(); server.kill();
rmSync(TMP, { recursive: true, force: true });
writeFileSync(path.join(OUT, 'verify.json'), JSON.stringify(results, null, 2));
const bad = errors.length || Object.values(results.interrupt).some(r => !r.ok) || Object.values(results.hazard).some(d => d > 0.5) || !overlayGone
  || Object.values(results.moves).some(m => m.minClearE < 0 || m.minClearM < 0 || m.result !== true);
console.log(bad ? 'FAIL' : 'PASS', errors);
process.exit(bad ? 1 : 0);
