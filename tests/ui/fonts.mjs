// Font fit (Sueda, 2026-10-04: the UI may switch from Instrument Serif to one of the web/fonts.html sets). For every
// font set and a wide spread of ui-lab presets at 1440x900 and 390x844: the fonts really load; no horizontal page
// scroll; every line of text stays inside its paper sheet and on screen (horizontally: a vertical scroller is fine);
// nothing is clipped sideways except deliberate one-line ellipses (names / subjects in slim rows), which are listed.
//   ~/.nvm/versions/node/v22.22.3/bin/node tests/ui/fonts.mjs [A F ...] [--shots]   (default: every set; --shots -> shots/ui/fonts/)
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const args = process.argv.slice(2), shots = args.includes('--shots');
// ART_DIRECTION §24 (2026-10-04 11:20): "just make the font montserrat": css/aloud.css sets Montserrat whatever set is named, so
// every set now loads and fits as Montserrat; the default run checks M (the game's) and G (the old game set, now overridden)
const SETS = args.filter(a => !a.startsWith('--')).length ? args.filter(a => !a.startsWith('--')) : ['M', 'G'];
const FAM = Object.fromEntries(['now', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'M'].map(k => [k, ['Montserrat']]));
const PRESETS = ['rest', 'speaking', 'typing', 'notice', 'letter', 'letter&letter=b', 'ledger', 'card', 'onboarding', 'onboarding&step=2', 'hint', 'title', 'director', 'meeting', 'envoy',
  'inbox', 'inbox-30', 'agentcard2', 'agentcard2&who=a3', 'talk', 'fleetcaption', 'election&hover=1', 'elected',
  'mail-notify', 'mail-column', 'inbox-read', 'inbox-read&long=1', 'inbox-read&who=n2', 'mail-seeall'];
const WAIT = { letter: 3400, onboarding: 4200, title: 2800, elected: 2600, 'inbox-read': 1600 };
const OUT = path.join(ROOT, 'shots/ui/fonts'); if (shots) mkdirSync(OUT, { recursive: true });

const freePort = () => new Promise(res => { const s = createServer(); s.listen(0, () => { const p = s.address().port; s.close(() => res(p)); }); });
const port = await freePort();
const server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: path.join(ROOT, 'web'), stdio: 'ignore' });
const base = `http://127.0.0.1:${port}`;
for (let i = 0; i < 50; i++) { try { await fetch(base + '/'); break; } catch { await new Promise(r => setTimeout(r, 100)); } }
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--hide-scrollbars'] });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const results = []; const check = (name, ok, got) => { results.push(ok); if (!ok || process.env.VERBOSE) console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok ? '' : '  got ' + JSON.stringify(got)}`); };
const truncs = new Map();

// in the page: every text node's line boxes against the viewport, its paper sheet and any sideways clip
const AUDIT = () => {
  const out = { page: document.documentElement.scrollWidth > innerWidth + 1, spill: [], trunc: [] };
  const layer = document.querySelector('.ag-ui'); if (!layer) return out;
  const vis = el => { for (let e = el; e && e !== document.body; e = e.parentElement) { const s = getComputedStyle(e); if (e.hidden || s.display === 'none' || s.visibility === 'hidden' || +s.opacity < .05) return false; } return true; };
  const label = el => (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : el.tagName.toLowerCase());
  const walker = document.createTreeWalker(layer, NodeFilter.SHOW_TEXT);
  const seen = new Set();
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (!n.textContent.trim()) continue;
    const el = n.parentElement; if (!el || !vis(el) || el.closest('svg, .ag-title__word span[aria-hidden]')) continue;
    const r = document.createRange(); r.selectNodeContents(n);
    const rects = [...r.getClientRects()].filter(x => x.width > 0 && x.height > 0);
    if (!rects.length) continue;
    const L = Math.min(...rects.map(x => x.left)), R = Math.max(...rects.map(x => x.right));
    const T = Math.min(...rects.map(x => x.top)), B = Math.max(...rects.map(x => x.bottom));
    const txt = n.textContent.trim().slice(0, 40);
    // the nearest sideways clip (overflow-x not visible), and the paper sheet
    let clip = null; for (let e = el; e && e !== layer; e = e.parentElement) { const s = getComputedStyle(e); if (s.overflowX !== 'visible') { clip = e; break; } }
    const sheet = el.closest('.ag-sheet, .ag-bubble__paper, .ag-mail__paper, .ag-mail__in, .ag-talk__line');
    const ell = el => { for (let e = el; e && e !== layer; e = e.parentElement) { const s = getComputedStyle(e); if (s.textOverflow === 'ellipsis' || s.webkitLineClamp !== 'none' && s.webkitLineClamp) return e; } return null; };
    const key = label(el) + ':' + txt; if (seen.has(key)) continue; seen.add(key);
    // vertically inside a scroller that is scrolled away: not on screen by design
    let scrolledAway = false; for (let e = el.parentElement; e && e !== layer; e = e.parentElement) { const s = getComputedStyle(e); if (/(auto|scroll|hidden)/.test(s.overflowY)) { const b = e.getBoundingClientRect(); if (B < b.top || T > b.bottom) scrolledAway = true; break; } }
    if (scrolledAway) continue;
    if (clip) {
      const cb = clip.getBoundingClientRect();
      if (R > cb.right + 1.5 || L < cb.left - 1.5) {
        const e2 = ell(el);
        if (e2) out.trunc.push(label(e2) + ' “' + txt + '”'); else out.spill.push(`${label(el)} “${txt}” clipped by ${label(clip)} (${Math.round(L)}-${Math.round(R)} vs ${Math.round(cb.left)}-${Math.round(cb.right)})`);
        continue;
      }
    }
    if (sheet) { const sb = sheet.getBoundingClientRect(); if (R > sb.right + 1.5 || L < sb.left - 1.5) out.spill.push(`${label(el)} “${txt}” outside its sheet ${label(sheet)} (${Math.round(L)}-${Math.round(R)} vs ${Math.round(sb.left)}-${Math.round(sb.right)})`); }
    if (L < -1 || R > innerWidth + 1) out.spill.push(`${label(el)} “${txt}” off screen (${Math.round(L)}-${Math.round(R)})`);
  }
  return out;
};

// one page per (set, size, preset); a few at a time
async function run(f, W, H, tag, pr, first) {
  const p = await browser.newPage(); await p.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto(`${base}/ui-lab.html?state=${pr}&font=${f}`, { waitUntil: 'networkidle0' });
  await p.evaluate(() => document.fonts.ready); await sleep(WAIT[pr.split('&')[0]] || 1500);
  await p.evaluate(() => document.fonts.ready);
  if (first) {
    const loaded = await p.evaluate(fams => fams.map(x => [x, document.fonts.check(`16px "${x}"`) && [...document.fonts].some(ff => ff.family.replace(/"/g, '') === x && ff.status === 'loaded')]), FAM[f]);
    check(`${f}: the set's fonts load (${FAM[f].join(' + ')})`, loaded.every(x => x[1]), loaded);
    check(`${f}: the root carries the set`, await p.evaluate(f => (document.documentElement.dataset.agFont || 'now') === f, f), null);
  }
  const a = await p.evaluate(AUDIT);
  check(`${f} ${tag} ${pr}: no page scroll, every line inside its sheet and on screen`, !a.page && !a.spill.length && !errs.length, { page: a.page, spill: a.spill, errs });
  for (const t of a.trunc) { const k = `${tag} ${pr}: ${t}`; truncs.set(k, (truncs.get(k) || []).concat(f)); }
  if (shots && ['inbox-read', 'agentcard2', 'mail-notify', 'mail-column', 'fleetcaption', 'title', 'ledger', 'talk'].includes(pr)) await p.screenshot({ path: path.join(OUT, `${pr}-${f}${tag === 'phone' ? '-mobile' : ''}.png`) });
  await p.close();
}
const jobs = [];
for (const f of SETS) for (const [W, H, tag] of [[1440, 900, 'desktop'], [390, 844, 'phone']]) PRESETS.forEach((pr, i) => jobs.push([f, W, H, tag, pr, W === 1440 && i === 0]));
const N = +(process.env.PAR || 5);
await Promise.all(Array.from({ length: N }, async () => { while (jobs.length) await run(...jobs.shift()); }));
if (truncs.size) { console.log('\none-line ellipses (by design, in slim rows):'); for (const [k, v] of truncs) console.log(`  ${k}  [${v.join(' ')}]`); }
await browser.close(); server.kill();
const pass = results.every(Boolean); console.log(pass ? `\nALL ${results.length} PASS` : `\n${results.filter(r => !r).length} FAIL of ${results.length}`); process.exit(pass ? 0 : 1);
