// The whole landing in act3-lab.html, on the live :8870 (never restarted), Chrome headless (metal), 1440x900.
//   ~/.nvm/versions/node/v22.22.3/bin/node tests/act3/sequence.mjs [strip|mid|home|all] [golden]
//   strip: a frame every 1 s from "Play the landing" to the lounge          -> shots/act3/seq-NN.png (+ seq-strip.png)
//   mid:   both cross-fade midpoints of the landing (Plissé->bridge, bridge->lounge) -> shots/act3/mid-*.png
//   home:  a frame every 1 s over "Back home"                                 -> shots/act3/home-NN.png (+ home-strip.png)
// Checks both world files are byte-identical (sha256) before and after.
import puppeteer from 'puppeteer-core';
import { createHash } from 'node:crypto';
import { readFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const ROOT = '/Users/suedagul/agora/', OUT = ROOT + 'shots/act3/', BASE = 'http://localhost:8870';
mkdirSync(OUT, { recursive: true });
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const sha = f => createHash('sha256').update(readFileSync(ROOT + f)).digest('hex');
const REF = { 'web/worlds/plisse.html': 'c04218c1a5d2010f045676faaeb89f90bf335c2c1433a21cbeca3fae52275fd3', 'web/worlds/lounge.html': '8d9ff437041bf3ce01601c198768a6f5029e41503296f0b45273c26f843788ef' };
const checkSha = when => { for (const [f, h] of Object.entries(REF)) console.log(sha(f) === h ? 'PASS' : 'FAIL', f, 'byte-identical', when); };
const mode = process.argv[2] || 'all', golden = process.argv[3] === 'golden', PRE = golden ? 'golden-' : '';
const W = +(process.env.W || 1440), H = +(process.env.H || 900);
const wait = ms => new Promise(r => setTimeout(r, ms));
checkSha('before');

async function open() {
  const b = await puppeteer.launch({ executablePath: CHROME, headless: true, defaultViewport: { width: W, height: H, deviceScaleFactor: 1 },
    args: ['--use-angle=metal', '--hide-scrollbars', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'] });
  const p = await b.newPage();
  p.on('pageerror', e => console.log('PAGEERROR', String(e)));
  p.on('console', m => { const t = m.text(); if (m.type() === 'error' && !t.includes('404')) console.log('console.error', t); else if (t.startsWith('[act3]') && !t.includes('[plisse]') && !t.includes('[lounge]')) console.log('  ', t); });
  await p.goto(BASE + '/act3-lab.html?shot=1' + (golden ? '&golden=1' : ''), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForFunction(() => window.__lab && window.__planet, { timeout: 60000 });
  await p.evaluate(() => window.__planet.ready);
  await p.evaluate(() => window.__lab.bridge.ready());
  await wait(1500);
  return { b, p };
}
const strip = (files, out, cols = 6) => execFileSync('python3', ['-c', `
from PIL import Image
fs=${JSON.stringify(files)}
w,h=360,225
ims=[Image.open(f).resize((w,h)) for f in fs]
cols=${cols}; rows=(len(ims)+cols-1)//cols
S=Image.new('RGB',(cols*w,rows*h),'white')
for i,im in enumerate(ims): S.paste(im,((i%cols)*w,(i//cols)*h))
S.save('${out}')`]);

async function timed(p, prefix, start, until, maxS = 45) {
  await p.evaluate(start);
  const t0 = Date.now(), files = [];
  for (let i = 0; i <= maxS; i++) {
    const due = t0 + i * 1000; if (due > Date.now()) await wait(due - Date.now());
    const f = OUT + PRE + prefix + '-' + String(i).padStart(2, '0') + '.png';
    await p.screenshot({ path: f }); files.push(f);
    const s = await p.evaluate(() => ({ state: window.__lab.state, bt: window.__lab.bridge.state().t, bo: window.__lab.bridge.el.style.opacity, po: (document.getElementById('plisse') || {}).style?.opacity, lo: (document.getElementById('lounge') || {}).style?.opacity }));
    console.log(prefix, i + 's', JSON.stringify(s));
    if (await p.evaluate(until)) { if (i > 0) break; }
  }
  strip(files, OUT + PRE + prefix + '-strip.png');
  console.log('total', ((Date.now() - t0) / 1000).toFixed(1), 's; longest frame gap per state (ms):', JSON.stringify(await p.evaluate(() => Object.fromEntries(Object.entries(window.__lab.gaps).map(([k, v]) => [k, Math.round(v)])))));
  await p.evaluate(() => { for (const k in window.__lab.gaps) delete window.__lab.gaps[k]; });
}

if (mode === 'strip' || mode === 'all' || mode === 'home') {
  const { b, p } = await open();
  if (mode !== 'home') await timed(p, 'seq', () => { window.__lab.playLanding(); }, () => window.__lab.state === 'lounge' && !window.__lab.busy);
  else { await p.evaluate(() => window.__lab.playLanding()); }
  if (mode === 'home' || mode === 'all') {
    await wait(1500);
    await timed(p, 'home', () => { window.__lab.backHome(); }, () => window.__lab.state === 'earth' && !window.__lab.busy, 60);
  }
  await b.close();
}
if (mode === 'mid' || mode === 'all') {
  const { b, p } = await open();
  await p.evaluate(() => { window.__lab.fadeHold = 0.5; window.__lab.playLanding(); });
  const midShot = async (cond, name, sel) => {
    try { await p.waitForFunction(cond, { timeout: 40000, polling: 50 }); }
    catch (e) { console.log('TIMEOUT', name, JSON.stringify(await p.evaluate(() => ({ s: window.__lab.state, hold: window.__lab.fadeHold, b: window.__lab.bridge.state(), lo: document.getElementById('lounge')?.style.opacity, lex: !!document.getElementById('lounge'), lr: window.__lab.lounge && window.__lab.lounge.isReady(), src: document.getElementById('lounge')?.src })))); throw e; }
    await wait(150);
    await p.screenshot({ path: OUT + PRE + name });
    console.log(name, 'opacity', await p.evaluate(sel));
    await p.evaluate(() => { window.__lab.fadeHold = 0.5; });
  };
  // the Tower -> Plissé fade is plisse-lab's own (not via fade()); the two new cuts park at 50 %
  // freeze the bridge's timeline (not its creatures) the moment cut 1 parks, so the three shots share one camera
  await p.waitForFunction(() => window.__lab.state === 'diving' && +window.__lab.bridge.el.style.opacity === 0.5, { timeout: 90000, polling: 'raf' });
  console.log('cut 1 parked at bridge t', await p.evaluate(() => { const B = window.__lab.bridge, t = B.state().t; B.hold(t); return t; }));
  await midShot(() => true, 'mid-1-plisse-to-bridge.png', () => window.__lab.bridge.el.style.opacity);
  // the clean sides of cut 1 for comparison: Plissé alone, then the bridge alone, at the same instant
  await p.evaluate(() => { window.__lab.fadeHold = 0.0001; }); await wait(80); await p.screenshot({ path: OUT + PRE + 'mid-1a-plisse-alone.png' });
  await p.evaluate(() => { window.__lab.fadeHold = 0.9999; }); await wait(80); await p.screenshot({ path: OUT + PRE + 'mid-1b-bridge-alone.png' });
  await p.evaluate(() => { window.__lab.fadeHold = null; window.__lab.bridge.hold(null); });
  // cut 1 has finished (since the perf work Plissé stays mounted, frozen at opacity 0, for the way home: docs/perf.md)
  await p.waitForFunction(() => { const el = document.getElementById('plisse'); return (!el || +el.style.opacity === 0) && window.__lab.bridge.state().t > 2; }, { timeout: 30000 });
  await p.evaluate(() => { window.__lab.fadeHold = 0.5; });
  await midShot(() => { const l = document.getElementById('lounge'); return l && +l.style.opacity === 0.5; }, 'mid-2-bridge-to-lounge.png', () => document.getElementById('lounge').style.opacity);
  await p.evaluate(() => { window.__lab.fadeHold = 0.0001; }); await wait(80); await p.screenshot({ path: OUT + PRE + 'mid-2a-bridge-alone.png' });
  await p.evaluate(() => { window.__lab.fadeHold = 0.9999; }); await wait(80); await p.screenshot({ path: OUT + PRE + 'mid-2b-lounge-alone.png' });
  await p.evaluate(() => { window.__lab.fadeHold = null; });
  await p.waitForFunction(() => window.__lab.state === 'lounge', { timeout: 30000 });
  await wait(1200);
  await p.screenshot({ path: OUT + PRE + 'mid-3-lounge-after.png' });
  await b.close();
}
checkSha('after');
