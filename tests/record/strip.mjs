#!/usr/bin/env node
// Frame strips for the trailer pages (fixed clock): loads a page with ?hold, waits for window.__shot.ready, then
// seeks each t and screenshots it at 1920x1080 (frame-perfect, no wall clock), and tiles them into a contact sheet.
//   node tests/record/strip.mjs --url http://localhost:8870/trailer/t1-reception.html --out shots/trailer/t1 [--step 0.5] [--from 0] [--to dur]
//                               [--times 0,4.5,9] [--frames] (keep every full frame) [--fps 30 --video out.mp4] (render a fixed-step video)
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const FFMPEG = process.env.FFMPEG || '/opt/homebrew/bin/ffmpeg';
const a = { url: null, out: 'shots/trailer/strip', step: 0.5, from: 0, to: null, times: null, fps: 0, video: null, quality: 92 };
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  const k = argv[i], v = argv[i + 1];
  if (k === '--url') a.url = v, i++; else if (k === '--out') a.out = v, i++; else if (k === '--step') a.step = +v, i++;
  else if (k === '--from') a.from = +v, i++; else if (k === '--to') a.to = +v, i++; else if (k === '--times') a.times = v.split(',').map(Number), i++;
  else if (k === '--fps') a.fps = +v, i++; else if (k === '--video') a.video = v, i++;
}
const out = path.resolve(ROOT, a.out); fs.mkdirSync(out, { recursive: true });
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', defaultViewport: { width: 1920, height: 1080, deviceScaleFactor: 1 },
  args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--window-size=1920,1080', '--hide-scrollbars', '--no-first-run'] });
const page = await browser.newPage();
const errs = [];
page.on('console', m => { if (['error', 'warning'].includes(m.type())) { errs.push(m.text()); console.error('[page]', m.type(), m.text()); } });
page.on('pageerror', e => { errs.push(e.message); console.error('[pageerror]', e.message); });
const url = a.url + (a.url.includes('?') ? '&' : '?') + 'hold';
await page.goto(url, { waitUntil: 'load', timeout: 90000 });
await page.waitForFunction(() => !!window.__shot, { timeout: 90000 });
await page.evaluate(() => window.__shot.ready);
const dur = await page.evaluate(() => window.__shot.duration);
const to = a.to ?? dur;
let times = a.times;
if (!times) { times = []; const st = a.fps ? 1 / a.fps : a.step; for (let t = a.from; t <= to + 1e-6; t += st) times.push(+t.toFixed(4)); }
const files = [];
const t0 = Date.now();
for (const [i, t] of times.entries()) {
  await page.evaluate(t => window.__shot.seek(t), t);
  const f = path.join(out, `f${String(i).padStart(5, '0')}.jpg`);
  await page.screenshot({ path: f, type: 'jpeg', quality: a.quality });
  files.push({ f, t });
}
console.error(`[strip] ${files.length} frames in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
await browser.close();
if (a.video) {
  const r = spawnSync(FFMPEG, ['-y', '-loglevel', 'error', '-framerate', String(a.fps || 30), '-i', path.join(out, 'f%05d.jpg'),
    '-vf', 'scale=in_range=pc:out_range=tv:out_color_matrix=bt709,setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '16', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', path.resolve(ROOT, a.video)], { stdio: 'inherit' });
  console.error('[strip] video', a.video, r.status);
} else {
  // contact sheet: 4 columns of 480x270 with the time burnt in
  const py = `
import sys, json
from PIL import Image, ImageDraw
items = json.loads(sys.argv[1]); out = sys.argv[2]
cols = 4; W, H = 480, 270
for s in range(0, len(items), 16):
    chunk = items[s:s+16]; rows = (len(chunk)+cols-1)//cols
    sheet = Image.new('RGB', (cols*W, rows*H), (20,20,20))
    for i, it in enumerate(chunk):
        im = Image.open(it['f']).convert('RGB').resize((W, H), Image.LANCZOS)
        d = ImageDraw.Draw(im); d.rectangle([0,0,62,20], fill=(0,0,0)); d.text((4,4), 't=%.2f' % it['t'], fill=(255,255,255))
        sheet.paste(im, ((i%cols)*W, (i//cols)*H))
    sheet.save(out + '/sheet-%02d.jpg' % (s//16), quality=88)
`;
  spawnSync('python3', ['-c', py, JSON.stringify(files), out], { stdio: 'inherit' });
}
if (errs.length) console.error('[strip] page errors:', errs.length);
