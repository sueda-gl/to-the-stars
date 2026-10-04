#!/usr/bin/env node
// t5 FIRST CONTACT: deterministic stills and frame strips.
//   node tests/trailer/t5-strip.mjs strip [step=0.5] [out=shots/trailer/t5]     a frame every `step` s + contact sheets
//   node tests/trailer/t5-strip.mjs stills 3.8,6.5,13.5 [out]                   full-size stills
//   node tests/trailer/t5-strip.mjs video [fps=30] [out]                        frame-exact MP4 (seek per frame) -> <out>/t5-contact.mp4
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const [mode = 'strip', arg = '0.5', outArg] = process.argv.slice(2);
const out = path.resolve(ROOT, outArg || 'shots/trailer/t5');
fs.mkdirSync(out, { recursive: true });
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new',
  defaultViewport: { width: 1920, height: 1080, deviceScaleFactor: 1 }, args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--hide-scrollbars', '--window-size=1920,1080'] });
const page = await browser.newPage();
page.on('console', m => { if (['error', 'warning'].includes(m.type())) console.error('page', m.type(), m.text()); });
page.on('pageerror', e => console.error('pageerror', e.message));
await page.goto('http://localhost:8870/trailer/t5-contact.html?paused=1', { waitUntil: 'load', timeout: 90000 });
await page.waitForFunction('window.__t5Ready || window.__t5Error', { timeout: 120000 });
const err = await page.evaluate('window.__t5Error'); if (err) { console.error(err); process.exit(1); }
const dur = await page.evaluate('__shot.duration');
if (mode === 'eval') { console.log(JSON.stringify(await page.evaluate(arg))); await browser.close(); process.exit(0); }
if (mode === 'video') {
  const fps = +arg || 30, n = Math.round(dur * fps) + 1, file = path.join(out, 't5-contact.mp4');
  const ff = spawn(process.env.FFMPEG || '/opt/homebrew/bin/ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
    '-vf', 'scale=in_range=pc:out_range=tv:out_color_matrix=bt709,setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv', '-color_range', 'tv', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '16', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-r', String(fps), file], { stdio: ['pipe', 'inherit', 'inherit'] });
  const t0 = Date.now();
  for (let k = 0; k < n; k++) {
    await page.evaluate(k => __shot.frame(k), k);
    const buf = await page.screenshot({ type: 'jpeg', quality: 95 });
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if (k % 60 === 0) process.stderr.write(`frame ${k}/${n} ${((Date.now() - t0) / 1000).toFixed(0)}s\n`);
  }
  ff.stdin.end(); await new Promise(r => ff.on('close', r));
  console.log(file); await browser.close(); process.exit(0);
}
if (mode === 'state') {   // node t5-strip.mjs state 9,11,13
  for (const t of arg.split(',').map(Number)) console.log(t, JSON.stringify(await page.evaluate(t => { __shot.seek(t); return __shot.state(); }, t)));
  await browser.close(); process.exit(0);
}
const times = mode === 'strip' ? Array.from({ length: Math.floor(dur / +arg) + 1 }, (_, i) => +(i * +arg).toFixed(3)) : arg.split(',').map(Number);
const files = [];
const t0 = Date.now();
for (const t of times) {
  const r = await page.evaluate(t => __shot.seek(t), t);
  const f = path.join(out, `${mode === 'strip' ? 'f' : 'still'}-${t.toFixed(2).padStart(5, '0')}.png`);
  await page.screenshot({ path: f }); files.push(f);
  process.stderr.write(`${t.toFixed(2)} ${r.shot}\n`);
}
console.error(`${times.length} frames in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
if (mode === 'strip') {
  // contact sheets: 4 x 3 at 480 x 270, in time order (sheet k starts at (k-1) * 12 * step s)
  const per = 12;
  for (let s = 0; s * per < files.length; s++) {
    const chunk = files.slice(s * per, s * per + per);
    const sheet = path.join(out, `sheet-${s + 1}.png`);
    const args = ['-y', '-loglevel', 'error'];
    chunk.forEach(f => args.push('-i', f));
    const lab = chunk.map((f, i) => `[${i}:v]scale=480:270[v${i}]`).join(';');
    const pad = Array.from({ length: per - chunk.length }, (_, i) => `color=c=black:s=480x270:d=1[p${i}]`).join(';');
    const ins = chunk.map((_, i) => `[v${i}]`).join('') + Array.from({ length: per - chunk.length }, (_, i) => `[p${i}]`).join('');
    const layout = Array.from({ length: per }, (_, i) => `${(i % 4) * 480}_${Math.floor(i / 4) * 270}`).join('|');
    args.push('-filter_complex', `${lab}${pad ? ';' + pad : ''};${ins}xstack=inputs=${per}:layout=${layout}[o]`, '-map', '[o]', '-frames:v', '1', sheet);
    execFileSync(process.env.FFMPEG || '/opt/homebrew/bin/ffmpeg', args);
    console.log(sheet);
  }
}
await browser.close();
