// Fidelity gate: the original Red arch vs web/reference.html (rebuilt only from web/js/paint/*).
// Serves the project root, forces window.__STILL = true on both (one deterministic frame: clock delta 0),
// screenshots Riso / Gouache / Raw at 1440x900 in headless Chrome, and diffs them with PIL.
// Pass: mean abs diff < 0.5/255 in every edition.
//   ~/.nvm/versions/node/v22.22.3/bin/node tests/fidelity/compare.mjs [--sandbox]
import { spawn, execFileSync } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SHOTS = path.join(ROOT, 'shots/fidelity');
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const W = 1440, H = 900, BAR = 0.5;
mkdirSync(SHOTS, { recursive: true });

const freePort = () => new Promise(res => { const s = createServer(); s.listen(0, () => { const p = s.address().port; s.close(() => res(p)); }); });
const port = await freePort();
const server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
const base = `http://127.0.0.1:${port}`;
for (let i = 0; i < 50; i++) { try { await fetch(base + '/'); break; } catch { await new Promise(r => setTimeout(r, 100)); } }

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: true, defaultViewport: { width: W, height: H, deviceScaleFactor: 1 },
  args: ['--use-angle=metal', `--window-size=${W},${H}`, '--hide-scrollbars', '--disable-background-timer-throttling', '--disable-renderer-backgrounding']
});

// load a page with __STILL set before any script runs, wait for fonts + the one frame, screenshot
async function shoot(url, out, { still = true, settle = 1200, setup = null } = {}) {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('response', r => { if (r.status() >= 400 && !r.url().endsWith('/favicon.ico')) errors.push(`${r.status()} ${r.url()}`); });
  if (still) await page.evaluateOnNewDocument(() => { window.__STILL = true; });
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });
  await page.evaluate(() => document.fonts.ready);
  await new Promise(r => setTimeout(r, settle));
  const data = setup ? await page.evaluate(setup) : null;
  if (setup) await new Promise(r => setTimeout(r, 300));
  await page.screenshot({ path: out });
  const info = await page.evaluate(() => ({ arch: !!window.__arch, mode: window.__arch ? window.__arch.mode : null }));
  await page.close();
  return { errors, data, ...info };
}
const diff = (a, b, out) => JSON.parse(execFileSync('python3', [path.join(ROOT, 'tests/fidelity/diff.py'), a, b, out]).toString());

const results = {};
let pass = true;
try {
  // first frames: the three editions (+ the close-up camera, which also spends rnd in setCloseUp)
  // motion-*: 10 s of fixed-step simulation (600 x 1/60) through the update functions, then one repaint:
  //   proves every nav default and the rnd order inside the update functions match the original
  const simulate = () => {
    const a = window.__arch, all = [a.creatures, a.hoppers, a.drops, a.scoots, a.flits, a.pips, a.floaties].flat();
    for (let i = 1; i <= 600; i++) a.updateCreatures(1 / 60, i / 60);
    a.renderPainted();
    return all.map(c => [c.pos.x, c.pos.y, c.pos.z, c.heading]);
  };
  const CASES = [['riso', ''], ['gouache', '#gouache'], ['raw', '#raw'], ['gouache-close', '#gouache-close'],
    ['motion-riso', '', simulate], ['motion-gouache-close', '#gouache-close', simulate]];
  for (const [name, hash, setup] of CASES) {
    const o = path.join(SHOTS, `original-${name}.png`), r = path.join(SHOTS, `rebuild-${name}.png`);
    const so = await shoot(`${base}/reference/red-arch-at-sundown.html${hash}`, o, { setup });
    const sr = await shoot(`${base}/web/reference.html${hash}`, r, { setup });
    const d = diff(o, r, path.join(SHOTS, `diff-${name}.png`));
    let posDiff = null;
    if (setup) posDiff = so.data.length === sr.data.length ? Math.max(...so.data.flatMap((p, i) => p.map((v, k) => Math.abs(v - sr.data[i][k])))) : Infinity;
    const ok = !d.error && d.mean < BAR && so.errors.length === 0 && sr.errors.length === 0 && (posDiff === null || posDiff === 0);
    pass = pass && ok;
    results[name] = { ...d, ok, posDiff, originalErrors: so.errors, rebuildErrors: sr.errors, modes: [so.mode, sr.mode] };
    console.log(`${ok ? 'PASS' : 'FAIL'} ${name.padEnd(21)} mean ${d.mean}/255  max ${d.max}  >8: ${d.pct_over_8}%` +
      (posDiff !== null ? `  folk pos/heading max diff ${posDiff} (${so.data.length} folk)` : '') +
      (so.errors.length || sr.errors.length ? `  errors: ${JSON.stringify([...so.errors, ...sr.errors])}` : ''));
  }
  // negative control: a different seed must NOT pass, or the gate proves nothing
  {
    const o = path.join(SHOTS, 'original-riso.png'), r = path.join(SHOTS, 'control-seed12-riso.png');
    await shoot(`${base}/web/reference.html?seed=12`, r);
    const d = diff(o, r, path.join(SHOTS, 'diff-control-seed12.png'));
    const ok = d.mean >= BAR;
    pass = pass && ok;
    results.control = { ...d, ok };
    console.log(`${ok ? 'PASS' : 'FAIL'} control (seed 12)     mean ${d.mean}/255 — must be >= ${BAR} (the gate can tell scenes apart)`);
  }
  // a guard against "both blank": the original must actually be painted (many distinct colours)
  const colours = JSON.parse(execFileSync('python3', ['-c',
    'import sys,json;from PIL import Image;print(json.dumps([len(Image.open(p).convert("RGB").getcolors(1<<24) or []) for p in sys.argv[1:]]))',
    ...['riso', 'gouache', 'raw'].map(n => path.join(SHOTS, `original-${n}.png`))]).toString());
  results.distinctColoursInOriginal = colours;
  if (colours.some(c => c < 2000)) { pass = false; console.log('FAIL the original screenshots look blank', colours); }

  if (process.argv.includes('--sandbox')) {
    const out = path.join(SHOTS, 'sandbox.png');
    const s = await shoot(`${base}/web/paint-sandbox.html#gouache`, out, { still: false, settle: 6000 });
    // run the sim for 120 s of game time and check the hooks held: everyone inside the 40x40 square
    const page = await browser.newPage();
    await page.goto(`${base}/web/paint-sandbox.html#gouache`, { waitUntil: 'networkidle0' });
    const check = await page.evaluate(() => window.__sandbox.check(3600, 1 / 30));
    await page.close();
    results.sandbox = { errors: s.errors, check };
    const ok = s.errors.length === 0 && check.ok;
    pass = pass && ok;
    console.log(`${ok ? 'PASS' : 'FAIL'} sandbox  ${JSON.stringify(check)}${s.errors.length ? ' errors: ' + JSON.stringify(s.errors) : ''}`);
  }
} finally {
  await browser.close();
  server.kill();
}
writeFileSync(path.join(SHOTS, 'results.json'), JSON.stringify(results, null, 2));
console.log(pass ? 'FIDELITY PASS' : 'FIDELITY FAIL');
process.exit(pass ? 0 : 1);
