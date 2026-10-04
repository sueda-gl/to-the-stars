// Fidelity gate: Sueda's Tower Planet (reference/the-tower-planet-clean.html, untouched) vs web/planet.html
// (rebuilt only from web/js/planet/*). Serves the project root, freezes time on BOTH pages before any script
// runs (performance.now and requestAnimationFrame are replaced by a manual clock, so every frame is a fixed
// 1/60 s step), drives the same clicks, steps the same frames, screenshots at 1440x900 and diffs with PIL.
// Pass: mean abs diff < 0.5/255 in every case, no page errors, and the negative control must FAIL.
//   ~/.nvm/versions/node/v22.22.3/bin/node tests/planet/fidelity.mjs [--only name,name]
import { spawn, execFileSync } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SHOTS = path.join(ROOT, 'shots/planet');
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const W = 1440, H = 900, BAR = 0.5;
const ORIGINAL = '/reference/the-tower-planet-clean.html', REBUILD = '/web/planet.html';
mkdirSync(SHOTS, { recursive: true });
const only = (process.argv.find(a => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);

const freePort = () => new Promise(res => { const s = createServer(); s.listen(0, () => { const p = s.address().port; s.close(() => res(p)); }); });
const port = await freePort();
const server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
const base = `http://127.0.0.1:${port}`;
for (let i = 0; i < 50; i++) { try { await fetch(base + '/'); break; } catch { await new Promise(r => setTimeout(r, 100)); } }

// a fresh browser per page: one Tower Planet (4096 shadow map, five render targets) per GPU process
const launch = () => puppeteer.launch({
  executablePath: CHROME, headless: true, defaultViewport: { width: W, height: H, deviceScaleFactor: 1 },
  args: ['--use-angle=metal', `--window-size=${W},${H}`, '--hide-scrollbars', '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows']
});

// the frozen clock: installed before any page script
function installClock() {
  let T = 1000;
  window.__rafQ = [];
  performance.now = () => T;
  window.requestAnimationFrame = cb => { window.__rafQ.push(cb); return window.__rafQ.length; };
  window.cancelAnimationFrame = () => {};
  window.__step = (n, ms = 1000 / 60) => {
    for (let i = 0; i < n; i++) { T += ms; const q = window.__rafQ; window.__rafQ = []; for (const cb of q) cb(T); }
    return T;
  };
}

// actions run in the page between steps; identical on both pages (they only touch her DOM)
const click = sel => `document.querySelector(${JSON.stringify(sel)}).click()`;
const colour = (k, hex) => `(()=>{const i=document.getElementById('pk-${k}');i.value='${hex}';i.dispatchEvent(new Event('input'));})()`;
const CASES = [
  { name: 'orbit-first', steps: [['step', 1]] },                                       // the very first frame (Grain)
  { name: 'orbit-grain', steps: [['step', 1], ['step', 240]] },                         // 4 s of spin, clouds, sea
  { name: 'orbit-gouache', steps: [['step', 1], ['js', click('#styles button[data-mode="1"]')], ['step', 60]] },
  { name: 'descent-mid', steps: [['step', 1], ['js', click('#walk')], ['step', 32]] }, // falling: Grain -> Gouache
  { name: 'descent-late', steps: [['step', 1], ['js', click('#walk')], ['step', 90]] },
  { name: 'walk-gouache', steps: [['step', 1], ['js', click('#walk')], ['step', 720]] }, // on the road, daylight
  { name: 'walk-paused', steps: [['step', 1], ['js', click('#walk')], ['step', 400], ['js', click('#walk')], ['step', 120]] },
  { name: 'back-to-orbit', steps: [['step', 1], ['js', click('#walk')], ['step', 300], ['js', click('#back')], ['step', 100]] },
  { name: 'colours', steps: [['step', 1], ['js', colour('g2', '#e8b0a0')], ['js', colour('deep', '#204a80')],
    ['js', colour('bg', '#d8d0f0')], ['js', colour('shadow', '#506090')], ['step', 30]] },
  { name: 'walk-colours-grain', steps: [['step', 1], ['js', click('#walk')], ['step', 500], ['js', click('#styles button[data-mode="0"]')],
    ['js', colour('g1', '#a0c070')], ['step', 20]] }
];

async function shoot(url, c, out) {
  const browser = await launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()); });   // 4xx are caught below (favicon excepted)
  page.on('response', r => { if (r.status() >= 400 && !r.url().endsWith('/favicon.ico')) errors.push(`${r.status()} ${r.url()}`); });
  await page.evaluateOnNewDocument(installClock);
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 90000 });
  await page.evaluate(() => document.fonts.ready);
  try { await page.waitForFunction(() => window.__rafQ && window.__rafQ.length > 0, { timeout: 90000, polling: 100 }); }
  catch (e) { await browser.close(); throw new Error(`${url}: never queued a frame (${e.message}); page errors: ${JSON.stringify(errors)}`); }
  for (const [kind, arg] of c.steps) {
    if (kind === 'step') await page.evaluate(n => window.__step(n), arg);
    else await page.evaluate(arg);
  }
  await new Promise(r => setTimeout(r, 1600));          // her CSS fades (#ui .8s, #loading .6s) run on real time
  await page.screenshot({ path: out });
  const state = await page.evaluate(() => window.__planet ? window.__planet.state() : null);
  await browser.close();
  return { errors, state };
}
const diff = (a, b, out) => JSON.parse(execFileSync('python3', [path.join(ROOT, 'tests/fidelity/diff.py'), a, b, out]).toString());

const results = {};
let pass = true;
try {
  for (const c of CASES) {
    if (only.length && !only.includes(c.name)) continue;
    const o = path.join(SHOTS, `original-${c.name}.png`), r = path.join(SHOTS, `rebuild-${c.name}.png`);
    const so = await shoot(base + ORIGINAL, c, o);
    const sr = await shoot(base + REBUILD, c, r);
    const d = diff(o, r, path.join(SHOTS, `diff-${c.name}.png`));
    const ok = !d.error && d.mean < BAR && !so.errors.length && !sr.errors.length;
    pass = pass && ok;
    const s = sr.state || {};
    results[c.name] = { ...d, ok, originalErrors: so.errors, rebuildErrors: sr.errors, state: s };
    console.log(`${ok ? 'PASS' : 'FAIL'} ${c.name.padEnd(20)} mean ${d.mean}/255  max ${d.max}  >8: ${d.pct_over_8}%` +
      `   [mode ${s.mode}, uBlend ${(+s.blend).toFixed(3)}, DAYLIGHT ${(+s.daylight).toFixed(3)}, alt ${(+s.altitude).toFixed(1)}]` +
      (so.errors.length || sr.errors.length ? `  errors: ${JSON.stringify([...so.errors, ...sr.errors])}` : ''));
  }
  if (!only.length) {
    // negative control: the original's 4 s orbit vs the rebuild 1 s later must NOT pass, or the gate proves nothing
    const r = path.join(SHOTS, 'control-orbit-later.png');
    await shoot(base + REBUILD, { steps: [['step', 1], ['step', 300]] }, r);
    const d = diff(path.join(SHOTS, 'original-orbit-grain.png'), r, path.join(SHOTS, 'diff-control.png'));
    const ok = d.mean >= BAR;
    pass = pass && ok;
    results.control = { ...d, ok };
    console.log(`${ok ? 'PASS' : 'FAIL'} control (+1 s)       mean ${d.mean}/255 — must be >= ${BAR} (the gate can tell frames apart)`);
    // a guard against "both blank": the original must actually be painted
    const names = ['orbit-grain', 'orbit-gouache', 'walk-gouache'];
    const colours = JSON.parse(execFileSync('python3', ['-c',
      'import sys,json;from PIL import Image;print(json.dumps([len(Image.open(p).convert("RGB").getcolors(1<<24) or []) for p in sys.argv[1:]]))',
      ...names.map(n => path.join(SHOTS, `original-${n}.png`))]).toString());
    results.distinctColoursInOriginal = Object.fromEntries(names.map((n, i) => [n, colours[i]]));
    if (colours.some(c => c < 2000)) { pass = false; console.log('FAIL the original screenshots look blank', colours); }
  }
} finally {
  server.kill();
}
writeFileSync(path.join(SHOTS, only.length ? 'results-partial.json' : 'results.json'), JSON.stringify(results, null, 2));
console.log(pass ? 'PLANET FIDELITY PASS' : 'PLANET FIDELITY FAIL');
process.exit(pass ? 0 : 1);
