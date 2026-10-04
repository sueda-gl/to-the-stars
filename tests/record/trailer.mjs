#!/usr/bin/env node
// ALOUD launch trailer: capture + edit pipeline (docs/trailer.md, beat sheet TRAILER.md).
//   node tests/record/trailer.mjs capture  [--scene <id>] [--force]      web/trailer/*.html -> PNG sequences -> ProRes/H.264 clips
//   node tests/record/trailer.mjs gameplay [--max 300] [--url ...]       ?director=1 screencast -> shots/trailer/gameplay/raw.mp4 + beats.json
//   node tests/record/trailer.mjs edit     [--out shots/trailer/aloud-trailer-v1.mp4]   the cut list shots/trailer/cut.json -> final H.264
//   node tests/record/trailer.mjs sheet    [--in <mp4>] [--every 2]      contact sheet (1 frame / 2 s, timestamped; needs ffmpeg drawtext)
//   node tests/record/trailer.mjs segsheet [--in <mp4>] [--out <jpg>]    one labelled frame per segment of the last edit -> shots/trailer/v2-sheet.jpg
//   node tests/record/trailer.mjs all                                     capture (no gameplay unless missing) + edit + sheet
// Scenes are captured frame-by-frame, deterministically: the page exposes window.__shot = { duration, seek(t), play(), done };
// every frame is seek(k/fps) + Page.captureScreenshot, never real time. Serves web/ from :8870 when it is up (never restarts it),
// otherwise from its own python static server on a free port.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { cfrSchedule, ffmpegArgs as recordArgs, stamp } from './record.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const WEB = path.join(ROOT, 'web');
const OUT = path.join(ROOT, 'shots', 'trailer');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const FFMPEG = process.env.FFMPEG || '/opt/homebrew/bin/ffmpeg';
const FFPROBE = process.env.FFPROBE || path.join(path.dirname(FFMPEG), 'ffprobe');
const log = (...a) => console.error('[trailer]', ...a);
const rel = p => path.relative(ROOT, p);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const exists = p => { try { return fs.statSync(p).isFile(); } catch { return false; } };
const mkdir = p => fs.mkdirSync(p, { recursive: true });
const r3 = x => Math.round(x * 1000) / 1000;

// ---------- args / cut list ----------
export function parseArgs(argv) {
  const a = { cmd: argv[0] || 'all', scene: null, force: false, max: 300, url: 'http://localhost:8870/?director=1', out: null, in: null, every: 2, fps: null, dry: false, cut: null, tag: null, dpr: 1, shots: false };
  for (let i = 1; i < argv.length; i++) {
    const k = argv[i], v = argv[i + 1];
    if (k === '--scene') a.scene = v, i++;
    else if (k === '--force') a.force = true;
    else if (k === '--dry') a.dry = true;
    else if (k === '--max') a.max = Number(v), i++;
    else if (k === '--url') a.url = v, i++;
    else if (k === '--out') a.out = v, i++;
    else if (k === '--in') a.in = v, i++;
    else if (k === '--cut') a.cut = v, i++;
    else if (k === '--every') a.every = Number(v), i++;
    else if (k === '--fps') a.fps = Number(v), i++;
    else if (k === '--gameplay') a.gameplay = v, i++;   // edit: swap in gameplay/raw-<tag>.mp4 + beats-<tag>.json (+ the segment's takes.<tag> cuts)
    else if (k === '--fresh') a.fresh = true;           // edit: rebuild every segment (ignore the build cache)
    else if (k === '--tag') a.tag = v, i++;          // gameplay: raw-<tag>.mp4 + beats-<tag>.json (keeps the old take)
    else if (k === '--dpr') a.dpr = Number(v), i++;  // gameplay: deviceScaleFactor (2 = her Retina paint), frames downscaled to cut.width
    else if (k === '--shots') a.shots = true;        // gameplay: also one PNG per beat (mid-beat) next to the take, for checking
  }
  return a;
}
export function loadCut(file = process.env.TRAILER_CUT || path.join(OUT, 'cut.json')) {
  const cut = JSON.parse(fs.readFileSync(path.resolve(ROOT, file), 'utf8'));
  cut.fps ||= 30; cut.width ||= 1920; cut.height ||= 1080;
  for (const s of cut.segments) { s.out ||= 'cut'; s.xd = s.xd ?? (s.out === 'cut' ? 0 : s.out === 'push' ? 0.35 : 0.5); }
  return cut;
}
// the scenes a cut list needs (scene segments + rewind sources), with the longest duration asked of each
export function scenesOf(cut) {
  const need = new Map();
  const add = (scene, dur) => { if (!scene) return; need.set(scene, Math.max(need.get(scene) || 0, dur || 0)); };
  for (const s of cut.segments) {
    if (s.type === 'scene') add(s.scene, typeof s.in === 'string' ? Infinity : (s.in || 0) + (s.dur || 0));
    if (s.type === 'rewind') for (const src of s.sources || []) add(src.scene, src.dur || 0);
  }
  return need;
}
// a glob-ish lookup: "shots/trailer/music.*" -> the first matching file, or null
export function findFile(pattern) {
  if (!pattern) return null;
  const abs = path.resolve(ROOT, pattern);
  if (!abs.includes('*')) return exists(abs) ? abs : null;
  const dir = path.dirname(abs), re = new RegExp('^' + path.basename(abs).replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$');
  try { const f = fs.readdirSync(dir).filter(n => re.test(n) && !n.startsWith('.')).sort()[0]; return f ? path.join(dir, f) : null; } catch { return null; }
}

// ---------- ffmpeg helpers ----------
function run(bin, args, { quiet = true, input = null } = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(bin, args, { stdio: [input ? 'pipe' : 'ignore', 'pipe', 'pipe'] });
    let out = '', err = '';
    p.stdout.on('data', d => out += d); p.stderr.on('data', d => { err += d; if (!quiet) process.stderr.write(d); });
    p.on('error', reject);
    p.on('close', code => code === 0 ? resolve(out) : reject(new Error(`${path.basename(bin)} exited ${code}\n${args.join(' ')}\n${err.slice(-4000)}`)));
    if (input) { p.stdin.write(input); p.stdin.end(); }
  });
}
const ff = (args, o) => run(FFMPEG, ['-y', '-hide_banner', '-loglevel', 'error', ...args], o);
async function probe(file) {
  const s = await run(FFPROBE, ['-v', 'error', '-count_frames', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,r_frame_rate,nb_read_frames,duration:format=duration', '-of', 'json', file]);
  const j = JSON.parse(s), v = j.streams?.[0] || {};
  const [n, d] = String(v.r_frame_rate || '30/1').split('/').map(Number);
  return { width: v.width, height: v.height, fps: n / (d || 1), frames: Number(v.nb_read_frames) || 0, duration: Number(v.duration ?? j.format?.duration) || 0 };
}
async function hasAudio(file) {
  const s = await run(FFPROBE, ['-v', 'error', '-select_streams', 'a', '-show_entries', 'stream=codec_type', '-of', 'csv=p=0', file]).catch(() => '');
  return /audio/.test(s);
}
// intermediates: near-lossless H.264 4:4:4 (crf 8, exact frames; ~20x smaller than ProRes HQ, which filled the disk),
// or ProRes 422 HQ with INTER=prores; previews: ordinary H.264
const PRORES = process.env.INTER === 'prores' ? ['-c:v', 'prores_ks', '-profile:v', '3', '-vendor', 'apl0', '-pix_fmt', 'yuv422p10le']
  : ['-c:v', 'libx264', '-preset', 'fast', '-crf', '8', '-pix_fmt', 'yuv444p', '-g', '30'];
const H264 = (crf = 16) => ['-c:v', 'libx264', '-preset', 'medium', '-crf', String(crf), '-pix_fmt', 'yuv420p', '-movflags', '+faststart'];
// normalise any source to the trailer's frame: 1920x1080 (letterboxed if the aspect differs), constant fps, sar 1
const NORM = (cut) => `scale=${cut.width}:${cut.height}:force_original_aspect_ratio=decrease:flags=lanczos,pad=${cut.width}:${cut.height}:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1,fps=${cut.fps},format=yuv444p`;

// ---------- static server + browser ----------
async function ensureServer() {
  try { const r = await fetch('http://localhost:8870/trailer/card.html'); if (r.ok) return { base: 'http://localhost:8870', close() {} }; } catch { /* not up */ }
  const port = await new Promise(res => { const s = createServer(); s.listen(0, () => { const p = s.address().port; s.close(() => res(p)); }); });
  const proc = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: WEB, stdio: 'ignore' });
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 50; i++) { try { await fetch(base + '/'); break; } catch { await sleep(100); } }
  log('own static server on', base);
  return { base, close() { proc.kill(); } };
}
async function launch(cut, { alpha = false, dpr = 1 } = {}) {
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new',
    defaultViewport: { width: cut.width, height: cut.height, deviceScaleFactor: dpr },
    args: ['--use-angle=metal', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', `--window-size=${cut.width},${cut.height}`, '--hide-scrollbars',
      '--disable-infobars', '--autoplay-policy=no-user-gesture-required', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream',
      '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--font-render-hinting=none', '--no-first-run', '--no-default-browser-check'],
  });
  const page = await browser.newPage();
  page.on('pageerror', e => log('pageerror', e.message));
  page.on('console', m => { if (m.type() === 'error') log('page error:', m.text()); });
  const cdp = await page.createCDPSession();
  if (alpha) await cdp.send('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } });
  return { browser, page, cdp };
}

// ---------- 1. capture: deterministic frame-by-frame ----------
// Seeks the page's fixed clock to k/fps and screenshots each frame. maxDur caps the scene's own duration.
// render: { w, h, dpr } (TRAILER.md paint settings rule: ?w=1920&h=1080&dpr=2 paints 3840x2160 like her Retina screen);
// the browser viewport runs at deviceScaleFactor dpr so every screenshot is the full-res canvas, and one ffmpeg per scene
// downscales the stream with lanczos to out.w x out.h PNGs (crisp painted lines, 1/4 the disk of 4K frames)
export async function captureFrames({ page, cdp }, url, dir, { fps, maxDur = Infinity, alpha = false, render = null, out = null } = {}) {
  mkdir(dir);
  for (const f of fs.readdirSync(dir)) if (f.endsWith('.png')) fs.unlinkSync(path.join(dir, f));
  // hold=1 / paused=1: the scene must not run its own real-time clock while we seek (mountShot honours ?hold, t5 ?paused)
  url += (url.includes('?') ? '&' : '?') + 'hold=1&paused=1';
  if (render) url += `&w=${render.w}&h=${render.h}&dpr=${render.dpr}`;
  const down = render && out && render.dpr !== 1 ? spawn(FFMPEG, ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'image2pipe', '-c:v', 'png', '-framerate', String(fps), '-i', '-',
    '-vf', `scale=${out.w}:${out.h}:flags=lanczos+accurate_rnd+full_chroma_int`, '-start_number', '0', path.join(dir, '%05d.png')], { stdio: ['pipe', 'ignore', 'pipe'] }) : null;
  let downErr = ''; const downDone = down ? new Promise((res, rej) => { down.stderr.on('data', d => downErr += d); down.on('close', c => c === 0 ? res() : rej(new Error('downscale ffmpeg exited ' + c + ' ' + downErr))); }) : null;
  let ok = false;
  for (let i = 0; i < 3 && !ok; i++) {
    await page.goto(url, { waitUntil: 'load', timeout: 60000 });
    try { await page.waitForFunction(() => window.__shot && typeof window.__shot.seek === 'function', { timeout: 30000 }); ok = true; }
    catch (e) { if (i === 2) throw new Error(`no window.__shot on ${url}: ${e.message}`); }
  }
  const meta = await page.evaluate(async () => {
    const sh = window.__shot;
    if (sh.ready && typeof sh.ready.then === 'function') await sh.ready;   // assets compiled, first frame drawn
    if (typeof sh.stop === 'function') sh.stop(); if (typeof sh.pause === 'function') sh.pause();
    return { duration: Number(sh.duration) || 0, marks: sh.marks || null, shots: sh.shots || null };
  });
  const duration = Math.min(meta.duration, maxDur);
  if (!(duration > 0)) throw new Error(`__shot.duration is ${duration} on ${url}`);
  const n = Math.max(1, Math.round(duration * fps));
  const t0 = Date.now();
  for (let k = 0; k < n; k++) {
    await page.evaluate(async t => {
      const r = window.__shot.seek(t); if (r && typeof r.then === 'function') await r;
      await new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res)));
    }, k / fps);
    const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false });
    if (down) { if (!down.stdin.write(Buffer.from(data, 'base64'))) await new Promise(r => down.stdin.once('drain', r)); }
    else fs.writeFileSync(path.join(dir, `${String(k).padStart(5, '0')}.png`), Buffer.from(data, 'base64'));
    if (k % 60 === 59) log(`  ${k + 1}/${n} frames (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
  }
  if (down) { down.stdin.end(); await downDone; }
  return { frames: n, duration: n / fps, marks: meta.marks, shots: meta.shots };
}
async function encodeSeq(dir, base, fps) {   // the preview clip; the edit cuts from the PNG sequence itself
  await ff(['-framerate', String(fps), '-i', path.join(dir, '%05d.png'), '-vf', 'format=yuv420p', ...H264(14), `${base}.mp4`]);
}
const cardUrl = (base, p) => `${base}/trailer/card.html?` + new URLSearchParams(Object.fromEntries(Object.entries(p).filter(([, v]) => v != null && v !== '').map(([k, v]) => [k, String(v)]))).toString();

export async function capture(opts) {
  const cut = loadCut(); const fps = opts.fps || cut.fps;
  const need = new Map([...scenesOf(cut)].map(([k, v]) => [k, Number.isFinite(v) ? v : 4]));
  const manifestFile = path.join(OUT, 'seq', 'manifest.json');
  const manifest = exists(manifestFile) ? JSON.parse(fs.readFileSync(manifestFile, 'utf8')) : {};
  const server = await ensureServer();
  const R = cut.render || { w: cut.width, h: cut.height, dpr: 1 }, OUTSZ = { w: cut.width, h: cut.height };
  const b = await launch(cut, { dpr: R.dpr || 1 });
  // parallel captures (one process per --scene) share manifest.json: merge into the file as it is now, never overwrite others
  const saveManifest = (key, val) => { const cur = exists(manifestFile) ? JSON.parse(fs.readFileSync(manifestFile, 'utf8')) : {}; cur[key] = manifest[key] = val; fs.writeFileSync(manifestFile, JSON.stringify(cur, null, 2)); };
  try {
    // a. the scenes (web/trailer/<id>.html). A missing scene gets a paper placeholder card so the edit still runs end to end.
    for (const [scene, dur] of need) {
      if (opts.scene && opts.scene !== scene) continue;
      const html = path.join(WEB, 'trailer', `${scene}.html`), have = exists(html);
      const mtime = have ? fs.statSync(html).mtimeMs : 0, prev = manifest[scene];
      const fresh = prev && prev.mtime === mtime && prev.fps === fps && !prev.placeholder === have && exists(path.join(OUT, 'seq', scene, '00000.png')) && (have || prev.dur >= dur);
      if (fresh && !opts.force) { log(`scene ${scene}: up to date (${prev.frames} frames${prev.placeholder ? ', placeholder' : ''})`); continue; }
      const url = have ? `${server.base}/trailer/${scene}.html` : cardUrl(server.base, { text: scene.replace(/-/g, ' '), sub: 'scene not built yet', bg: 'paper', dur: Math.max(dur, 2), fin: 0.3, fout: 0.3, face: 'sentient' });
      log(`scene ${scene}: ${have ? 'capturing' : 'PLACEHOLDER (web/trailer/' + scene + '.html missing)'} at ${fps} fps`);
      const dir = path.join(OUT, 'seq', scene);
      const r = await captureFrames(b, url, dir, { fps, render: have ? R : null, out: OUTSZ });
      mkdir(path.join(OUT, 'clips'));
      await encodeSeq(dir, path.join(OUT, 'clips', scene), fps);
      saveManifest(scene, { frames: r.frames, dur: r.duration, fps, mtime, render: have ? R : null, placeholder: !have, marks: r.marks, shots: r.shots, at: new Date().toISOString() });
      log(`  -> ${rel(dir)} + ${rel(path.join(OUT, 'clips', scene + '.mp4'))} (${r.frames} frames, ${r.duration.toFixed(2)}s)`);
    }
    // b. the title cards (card.html with the segment's params): captured like scenes so the fades are frame-exact
    for (const s of cut.segments) {
      if (s.type !== 'card' || (opts.scene && opts.scene !== s.id)) continue;
      const key = `card:${s.id}`, params = { text: s.text, sub: s.sub, face: s.face, italic: s.italic, weight: s.weight, size: s.size, bg: s.bg || 'night', dur: s.dur, fin: s.fin, fout: s.fout, lb: cut.letterbox ? 1 : 0, grain: s.grain };
      const sig = JSON.stringify(params) + fs.statSync(path.join(WEB, 'trailer', 'card.html')).mtimeMs;
      if (manifest[key]?.sig === sig && manifest[key].fps === fps && exists(path.join(OUT, 'seq', `card-${s.id}`, '00000.png')) && !opts.force) { log(`card ${s.id}: up to date`); continue; }
      log(`card ${s.id}: "${s.text}"`);
      const dir = path.join(OUT, 'seq', `card-${s.id}`);
      const r = await captureFrames(b, cardUrl(server.base, params), dir, { fps, render: { ...R, w: cut.width, h: cut.height }, out: OUTSZ });
      mkdir(path.join(OUT, 'clips'));
      await encodeSeq(dir, path.join(OUT, 'clips', `card-${s.id}`), fps);
      saveManifest(key, { frames: r.frames, dur: r.duration, fps, sig, at: new Date().toISOString() });
    }
  } finally { await b.browser.close(); server.close(); }
  // c. overlay cards (over footage): one RGBA still each, faded in the edit
  const overlays = cut.segments.filter(s => s.overlay);
  if (overlays.length) {
    const server2 = await ensureServer(); const b2 = await launch(cut, { alpha: true });
    try {
      for (const s of overlays) {
        if (opts.scene && opts.scene !== s.id) continue;
        const o = s.overlay, file = path.join(OUT, 'cards', `${s.id}-overlay.png`); mkdir(path.dirname(file));
        await b2.page.goto(cardUrl(server2.base, { text: o.text, sub: o.sub, face: o.face, italic: o.italic, weight: o.weight, ink: o.ink, y: o.y, size: o.size, bg: 'clear', dur: 10, fin: 0, fout: 0, t: 5, grain: o.grain }), { waitUntil: 'load' });
        await b2.page.waitForFunction(() => window.__shot, { timeout: 30000 });
        await sleep(200);
        const { data } = await b2.cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true });
        fs.writeFileSync(file, Buffer.from(data, 'base64'));
        log(`overlay ${s.id}: ${rel(file)}`);
      }
    } finally { await b2.browser.close(); server2.close(); }
  }
  return manifest;
}

// ---------- 1b. gameplay: the director run, screencast like record.mjs, plus a beat log ----------
export async function gameplay(opts) {
  const cut = loadCut(); const fps = cut.fps;
  const dir = path.join(OUT, 'gameplay'); mkdir(dir);
  const sfx = opts.tag ? `-${opts.tag}` : '';
  const out = path.join(dir, `raw${sfx}.mp4`);
  const tmp = path.join(dir, `frames${sfx}`); fs.rmSync(tmp, { recursive: true, force: true }); mkdir(tmp);
  const b = await launch(cut, { dpr: opts.dpr || 1 });
  const { page, cdp } = b;
  const frames = [], writes = []; let bytes = 0;
  cdp.on('Page.screencastFrame', async ({ data, metadata, sessionId }) => {
    const buf = Buffer.from(data, 'base64');
    const file = path.join(tmp, `${String(frames.length).padStart(6, '0')}.jpg`);
    frames.push({ file, t: metadata.timestamp }); bytes += buf.length;
    writes.push(fs.promises.writeFile(file, buf).catch(e => log('frame write failed', e.message)));
    try { await cdp.send('Page.screencastFrameAck', { sessionId }); } catch { /* closing */ }
  });
  log('gameplay: open', opts.url);
  await page.goto(opts.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: cut.width, maxHeight: cut.height, everyNthFrame: 1 });
  const started = Date.now(), beats = []; let done = false, lastIndex = -2;
  while (!done && Date.now() - started < opts.max * 1000) {
    await sleep(250);
    try {
      const s = await page.evaluate(() => ({ done: window.__directorDone === true, index: window.__director?.state?.index ?? -1, id: window.__director?.state?.beat?.id ?? null }));
      done = s.done;
      if (s.index !== lastIndex && s.id) { beats.push({ id: s.id, index: s.index, wall: Date.now() / 1000 }); lastIndex = s.index; log(`  beat ${s.id} @ ${((Date.now() - started) / 1000).toFixed(1)}s`); }
    } catch { break; }
  }
  await cdp.send('Page.stopScreencast').catch(() => {});
  const stopWall = Date.now() / 1000;
  await sleep(300); await Promise.all(writes); await b.browser.close();
  const wall = (Date.now() - started) / 1000;
  if (!frames.length) throw new Error('no frames captured');
  log(`captured ${frames.length} frames in ${wall.toFixed(1)}s (${done ? 'director done' : 'max reached'}), ${(bytes / 1e6).toFixed(0)} MB`);
  // frame timestamps are CDP TimeSinceEpoch (s): beats map onto the same clock
  const ts = frames.map(f => f.t), t0 = ts[0];
  const schedule = cfrSchedule(ts, fps, t0 + wall);
  await new Promise((resolve, reject) => {
    const p = spawn(FFMPEG, recordArgs({ fps, crf: 16, out }), { stdio: ['pipe', 'inherit', 'inherit'] });
    p.on('error', reject); p.on('close', c => c === 0 ? resolve() : reject(new Error(`ffmpeg exited ${c}`)));
    (async () => { let last = -1, buf = null; for (const i of schedule) { if (i !== last) { buf = fs.readFileSync(frames[i].file); last = i; } if (!p.stdin.write(buf)) await new Promise(r => p.stdin.once('drain', r)); } p.stdin.end(); })().catch(reject);
  });
  fs.rmSync(tmp, { recursive: true, force: true });
  const list = beats.map((bt, i) => ({ id: bt.id, index: bt.index, t: r3(Math.max(0, bt.wall - t0)), end: r3(Math.min((beats[i + 1]?.wall ?? stopWall) - t0, schedule.length / fps)) }));
  fs.writeFileSync(path.join(dir, `beats${sfx}.json`), JSON.stringify({ file: rel(out), fps, duration: r3(schedule.length / fps), done, recorded: new Date().toISOString(), url: opts.url, dpr: opts.dpr || 1, beats: list }, null, 2));
  log(`-> ${rel(out)} (${(schedule.length / fps).toFixed(1)}s), beats.json: ${list.map(x => `${x.id}@${x.t}`).join(' ')}`);
  return { out, beats: list };
}

// ---------- 2. edit ----------
// The rewind: output frame k (k/fps) reads source time s(k) with speed v ramping 1 -> vmax so the sources are consumed exactly over D.
export function rewindPlan({ totalSource, dur, vmax = 6, fps = 30 }) {
  const D = dur, S = totalSource;
  let p, v = vmax;
  if (S <= D) { v = 1; p = 1; }                                  // nothing to ramp: play it straight (and short)
  else { p = D * (v - 1) / (S - D) - 1; if (p < 0.5) { p = 0.5; v = 1 + (p + 1) * (S / D - 1); } if (p > 8) { p = 8; v = 1 + (p + 1) * (S / D - 1); } }
  const n = Math.round(Math.min(D, S) * fps), out = [];
  let s = 0;
  for (let k = 0; k < n; k++) { out.push(Math.min(s, S - 1e-6)); s += (1 + (v - 1) * Math.pow(k / n, p)) / fps; }
  return { frames: out, p, vmax: v, n };
}
// in: a number, or "<mark|shot>[+/-offset]"; dur: a number, or unset = the mark's / shot's own length
export function resolveRange(seg, manifestEntry = {}) {
  let start = seg.in ?? 0, dur = seg.dur, span = null;
  if (typeof start === 'string') {
    const m = /^([^+-]+?)\s*([+-]\s*\d*\.?\d+)?$/.exec(start.trim()); if (!m) throw new Error(`bad in "${start}"`);
    const name = m[1].trim(), off = m[2] ? Number(m[2].replace(/\s/g, '')) : 0;
    const mk = manifestEntry.marks?.[name], sh = (manifestEntry.shots || []).find(x => x.id === name || x.name === name);
    if (Array.isArray(mk)) span = [mk[0], mk[1]];
    else if (typeof mk === 'number') span = [mk, null];
    else if (sh) span = [sh.t0 ?? 0, sh.t1 ?? (sh.t0 + (sh.dur || 0))];
    else throw new Error(`scene ${seg.scene}: no mark or shot "${name}" (have marks ${Object.keys(manifestEntry.marks || {}).join(',') || '-'}; shots ${(manifestEntry.shots || []).map(x => x.id || x.name).join(',') || '-'})`);
    start = span[0] + off;
    if (dur == null && span[1] != null) dur = span[1] - start;
  }
  return { start, dur };
}
function seqFrames(scene) { const d = path.join(OUT, 'seq', scene); return exists(path.join(d, '00000.png')) ? fs.readdirSync(d).filter(f => f.endsWith('.png')).length : 0; }

// builds every segment to shots/trailer/build/<id>.mov (ProRes, exact frame count), returns the list for assembly
async function buildSegments(cut) {
  const fps = cut.fps, dir = path.join(OUT, 'build'); mkdir(dir);
  const built = [];
  const manifestFile = path.join(OUT, 'seq', 'manifest.json');
  const manifest = exists(manifestFile) ? JSON.parse(fs.readFileSync(manifestFile, 'utf8')) : {};
  // the gameplay segment's beat log: its own `beats` (e.g. shots/trailer/gameplay/beats-v2.json), else the default one
  const playSeg = cut.segments.find(x => x.type === 'gameplay');
  const beatsFile = playSeg?.beats ? path.resolve(ROOT, playSeg.beats) : path.join(OUT, 'gameplay', 'beats.json');
  const beatsInfo = exists(beatsFile) ? JSON.parse(fs.readFileSync(beatsFile, 'utf8')) : null;
  // build cache: a segment is re-used when its cut-list entry, its sources (scene capture, card, file mtimes) and the
  // transition from the previous segment are unchanged, so a re-render after a gameplay swap only re-cuts the gameplay
  const mt = f => { try { const st = fs.statSync(f); return `${st.size}:${Math.round(st.mtimeMs)}`; } catch { return null; } };
  const CACHE_V = 3;
  for (let i = 0; i < cut.segments.length; i++) {
    const s = cut.segments[i], prev = cut.segments[i - 1];
    const out = path.join(dir, `${s.id}.mov`);
    const pushIn = prev?.out === 'push' ? (prev.push || {}) : null;
    const srcSig = s.type === 'scene' ? manifest[s.scene]?.at
      : s.type === 'rewind' ? (s.sources || []).map(x => manifest[x.scene]?.at)
      : s.type === 'card' ? manifest[`card:${s.id}`]?.at
      : s.type === 'gameplay' ? [mt(findFile(s.file) || ''), mt(beatsFile)]
      : [mt(findFile(s.file) || ''), mt(findFile(s.still) || '')];
    const sig = JSON.stringify({ v: CACHE_V, s, srcSig, pushIn, ov: s.overlay ? mt(path.join(OUT, 'cards', `${s.id}-overlay.png`)) : null, fps, w: cut.width, h: cut.height });
    const sigFile = path.join(dir, `${s.id}.sig`);
    if (!cut._fresh && exists(out) && exists(sigFile) && fs.readFileSync(sigFile, 'utf8') === sig) {
      if (s.type === 'live' || s.type === 'clip') { s._in = Number(s.in) || 0; const f = findFile(s.file); s._audio = f && await hasAudio(f) ? f : null; }
      if (s.type === 'scene') { const rg = resolveRange(s, manifest[s.scene]); s._in = rg.start; s.dur = rg.dur || s.dur; }
      const p = await probe(out); built.push({ ...s, file: out, frames: p.frames });
      log(`segment ${s.id}: cached (${p.frames} frames = ${(p.frames / fps).toFixed(2)}s)`);
      continue;
    }
    try { fs.unlinkSync(sigFile); } catch { /* none */ }
    s._sig = () => fs.writeFileSync(sigFile, sig);
    const vf = [];                             // per-segment filters appended after normalisation
    let args = null;
    if (s.type === 'live' || s.type === 'clip') {
      // a filmed clip (the cold open): `in` seconds into the file, `dur` long; `push` zooms into (push.x, push.y) over its last push.dur
      // (out: "push" also gives the next segment a bright, tight arrival; any other out, e.g. fadewhite, just joins)
      const file = findFile(s.file), still = findFile(s.still);
      const dur = s.dur || 5, push = s.push || { dur: 0, zoom: 1 }, pd = push.dur ?? 1.2, cx = push.x ?? 0.8, cy = push.y ?? 0.42, zoom = push.zoom ?? 2.6;
      const N = Math.round(dur * fps), N0 = N - Math.max(1, Math.round(pd * fps)), ts = N0 / fps;
      s._in = Number(s.in) || 0;
      if (file) { args = ['-ss', String(s._in), '-t', String(dur + 0.5), '-i', file]; log(`${s.type} ${s.id}: ${rel(file)} @${s._in}s for ${dur}s`); }
      else if (still) { args = ['-loop', '1', '-framerate', String(fps), '-i', still]; log(`live: still ${rel(still)} (no opener.mp4 yet: slow push on the start frame)`); }
      else { args = ['-f', 'lavfi', '-i', `color=c=black:s=${cut.width}x${cut.height}:r=${fps}`]; log('live: black placeholder card (no shots/trailer/live/opener.mp4 or start frame)'); }
      s._audio = file && await hasAudio(file) ? file : null;
      if (!s.push && file) { vf.push(`trim=duration=${dur}`, `setpts=PTS-STARTPTS`); }
      else {
      // zoompan: a slow 1 -> 1.06 drift on a still, then the push into the monitor over the last pd seconds (eased, zoom^2.4)
      const drift = file ? '1' : `(1+0.06*min(on/${N},1))`;
      const z = `${drift}*(1+${zoom - 1}*pow(clip((on-${N0})/${N - N0},0,1),2.4))`;
      vf.push(`tpad=stop_mode=clone:stop_duration=${dur}`, `trim=duration=${dur}`, `setpts=PTS-STARTPTS`,
        `zoompan=z='${z}':x='iw*${cx}-(iw/zoom)*${cx}':y='ih*${cy}-(ih/zoom)*${cy}':d=1:s=${cut.width}x${cut.height}:fps=${fps}`,
        // light bloom: a blurred copy screened in as we arrive at the glass; paper flicker: brightness jitter + a paper multiply
        `split[lb_a][lb_b];[lb_b]gblur=sigma=26[lb_b];[lb_a][lb_b]blend=c0_expr='min(255,A+B*0.9*pow(clip((T-${ts})/${pd},0,1),2))':c1_expr='A+(128-A)*0.8*pow(clip((T-${ts})/${pd},0,1),2)':c2_expr='A+(128-A)*0.8*pow(clip((T-${ts})/${pd},0,1),2)'`,
        `eq=eval=frame:brightness='0.05*(random(1)-0.5)*clip((t-${ts})/${pd},0,1)'`,
        `trim=duration=${dur}`, `setpts=PTS-STARTPTS`);
      }
    } else if (s.type === 'scene') {
      const n = seqFrames(s.scene); if (!n) throw new Error(`scene ${s.scene}: no frames captured (run capture)`);
      const rg = resolveRange(s, manifest[s.scene]);
      const start = Math.round(rg.start * fps), count = Math.min(n - start, Math.round((rg.dur || n / fps - rg.start) * fps));
      s.dur = rg.dur || count / fps; s._in = rg.start;
      if (count <= 0) throw new Error(`scene ${s.scene}: in=${s.in} beyond its ${n} frames`);
      args = ['-framerate', String(fps), '-start_number', String(start), '-i', path.join(OUT, 'seq', s.scene, '%05d.png')];
      vf.push(`trim=end_frame=${count}`, `setpts=PTS-STARTPTS`);
      if (count < Math.round((s.dur || 0) * fps)) vf.push(`tpad=stop_mode=clone:stop_duration=${(s.dur - count / fps).toFixed(3)}`);
    } else if (s.type === 'card') {
      const n = seqFrames(`card-${s.id}`); if (!n) throw new Error(`card ${s.id}: not captured (run capture)`);
      args = ['-framerate', String(fps), '-i', path.join(OUT, 'seq', `card-${s.id}`, '%05d.png')];
    } else if (s.type === 'rewind') {
      // reverse the captured sequences (newest first) + the un-build, on one accelerating clock
      // a source plays [in, in+dur) of its scene (in: seconds or a mark/shot name), reversed unless reverse:false
      const srcs = (s.sources || []).map(src => {
        const n0 = seqFrames(src.scene); if (!n0) return null;
        const f0 = src.in != null ? Math.max(0, Math.round(resolveRange({ ...src, dur: 0 }, manifest[src.scene]).start * fps)) : 0;
        const n = Math.max(1, Math.min(n0 - f0, src.dur ? Math.round(src.dur * fps) : n0 - f0));
        return { ...src, n, f0, dur: null };
      }).filter(Boolean);
      if (!srcs.length) throw new Error('rewind: no source frames (run capture)');
      const total = srcs.reduce((a, b) => a + b.n, 0) / fps;
      const plan = rewindPlan({ totalSource: total, dur: s.dur || 14, vmax: s.vmax || 6, fps });
      const files = [];
      for (const t of plan.frames) {
        let acc = 0;
        for (const src of srcs) {
          const len = src.dur ? Math.min(src.dur * fps, src.n) : src.n;
          if (t * fps < acc + len || src === srcs[srcs.length - 1]) {
            const local = Math.min(len - 1, Math.max(0, Math.floor(t * fps - acc)));
            const idx = src.f0 + (src.reverse === false ? local : (len - 1 - local));
            files.push(path.join(OUT, 'seq', src.scene, `${String(idx).padStart(5, '0')}.png`)); break;
          }
          acc += len;
        }
      }
      const listFile = path.join(dir, `${s.id}.txt`);
      fs.writeFileSync(listFile, files.map(f => `file '${f.replace(/'/g, "'\\''")}'\nduration ${(1 / fps).toFixed(6)}`).join('\n') + `\nfile '${files.at(-1)}'\n`);
      args = ['-f', 'concat', '-safe', '0', '-i', listFile, '-frames:v', String(plan.n)];
      // paper flutter: a scaled-up frame cropped with a small jitter, a brightness flicker, a paper-grain multiply; all subtle, growing with the speed
      const W = cut.width, H = cut.height, D = plan.n / fps;
      vf.push(`fps=${fps}`, `scale=${W + 24}:${H + 14}`,
        `crop=${W}:${H}:x='12+(5*sin(t*37)+3*sin(t*91))*min(1,0.3+t/${D})':y='7+(4*sin(t*53)+2*sin(t*131))*min(1,0.3+t/${D})'`,
        `eq=eval=frame:brightness='0.035*sin(t*47)*sin(t*13)*min(1,0.3+t/${D})'`,
        `split[rw_a][rw_b];[rw_b]noise=alls=60:allf=t+u,boxblur=1,format=yuv444p[rw_b];[rw_a][rw_b]blend=c0_expr='A*(1-0.16*min(1,0.3+T/${D}))+(A*B/255)*0.16*min(1,0.3+T/${D})':c1_expr=A:c2_expr=A`);
      log(`rewind: ${srcs.map(x => x.scene + (x.reverse === false ? '' : ' (rev)')).join(' -> ')}: ${total.toFixed(1)}s of source over ${(plan.n / fps).toFixed(1)}s, ramp 1x -> ${plan.vmax.toFixed(1)}x (p=${plan.p.toFixed(2)})`);
    } else if (s.type === 'gameplay') {
      // cuts from the director capture by beat id (from >= 0: after the beat starts; from < 0: before it ends), joined with short dissolves
      const raw = findFile(s.file) || path.join(OUT, 'gameplay', 'raw.mp4');
      if (!exists(raw)) throw new Error(`gameplay: ${rel(raw)} missing (run gameplay)`);
      const info = await probe(raw), beats = beatsInfo?.beats || [];
      const byId = Object.fromEntries(beats.map(b => [b.id, b]));
      const cuts = [];
      for (const c of s.cuts || []) {
        let at = c.at;
        if (c.beat != null) { const bt = byId[c.beat]; if (!bt) { log(`  gameplay: beat "${c.beat}" not in beats.json, skipped`); continue; } at = (c.from ?? 0) >= 0 ? bt.t + (c.from ?? 0) : bt.end + c.from; }
        at = Math.max(0, Math.min(at ?? 0, info.duration - 0.5));
        const dur = Math.min(c.dur || 4, info.duration - at);
        if (dur > 0.2) cuts.push({ at: r3(at), dur: r3(dur), beat: c.beat });
      }
      if (!cuts.length) cuts.push({ at: 0, dur: Math.min(info.duration, s.dur || 58) });
      const xd = s.cutXd ?? 0.3, parts = [], fl = [];
      cuts.forEach((c, k) => { parts.push('-ss', String(c.at), '-t', String(c.dur), '-i', raw); fl.push(`[${k}:v]${NORM(cut)},trim=duration=${c.dur},setpts=PTS-STARTPTS[g${k}]`); });
      let lab = 'g0', off = cuts[0].dur;
      for (let k = 1; k < cuts.length; k++) { const o = r3(off - xd); fl.push(`[${lab}][g${k}]xfade=transition=fade:duration=${xd}:offset=${o}[x${k}]`); lab = `x${k}`; off = o + cuts[k].dur; }
      // an over-footage card (RGBA still from capture) with alpha fades
      const ov = s.overlay && findFile(path.join('shots', 'trailer', 'cards', `${s.id}-overlay.png`));
      if (ov) {
        const at = s.overlay.at ?? 0.5, od = s.overlay.dur ?? 4, f = s.overlay.fade ?? 0.7;
        parts.push('-loop', '1', '-framerate', String(fps), '-i', ov);
        fl.push(`[${cuts.length}:v]format=rgba,trim=duration=${od},fade=t=in:st=0:d=${f}:alpha=1,fade=t=out:st=${r3(od - f)}:d=${f}:alpha=1,setpts=PTS-STARTPTS+${at}/TB[ov]`);
        fl.push(`[${lab}][ov]overlay=0:0:eof_action=pass:format=auto:enable='between(t,${at},${r3(at + od)})'[ovd]`); lab = 'ovd';
      }
      s._gameplayDur = r3(off);
      await ff([...parts, '-filter_complex', fl.join(';'), '-map', `[${lab}]`, '-r', String(fps), ...PRORES, out]);
      log(`gameplay: ${cuts.length} cuts (${cuts.map(c => `${c.beat || c.at}:${c.dur}s`).join(' ')}) -> ${off.toFixed(1)}s`);
      built.push({ ...s, file: out, frames: (await probe(out)).frames }); s._sig();
      continue;
    } else throw new Error(`unknown segment type ${s.type}`);
    // the push-in head on the segment after a push-out: we arrive inside the screen bright and a little tight, and settle
    if (pushIn) {
      const sd = pushIn.settle ?? 0.7, Ns = Math.round(sd * fps);
      vf.push(`zoompan=z='1+0.22*pow(1-min(on/${Ns},1),2)':x='iw/2-(iw/zoom)/2':y='ih/2-(ih/zoom)/2':d=1:s=${cut.width}x${cut.height}:fps=${fps}`,
        `setpts=PTS-STARTPTS`, `eq=eval=frame:brightness='0.45*pow(max(0,1-t/${sd}),2)'`);
    }
    // a flash on the head (the cold open's gold flare carried across a hard cut): a colour wash decaying over flash.dur
    if (s.flash) {
      const fd = s.flash.dur ?? 0.35, fa = s.flash.amount ?? 0.85, col = s.flash.color || '0xffe2a0';
      vf.push(`null[fh_a];color=c=${col}:s=${cut.width}x${cut.height}:r=${fps}:d=${fd},format=rgba,colorchannelmixer=aa=${fa},fade=t=out:st=0:d=${fd}:alpha=1[fh_b];[fh_a][fh_b]overlay=eof_action=pass:format=auto`);
    }
    let tailIn = [];
    const ovFile = s.overlay && s.type !== 'gameplay' && findFile(path.join('shots', 'trailer', 'cards', `${s.id}-overlay.png`));
    if (ovFile) {   // an over-footage card on any segment: at (s from the head; negative = from the tail)
      const segDur = s.dur || 0, od = s.overlay.dur ?? 4, f = s.overlay.fade ?? 0.7, at = r3((s.overlay.at ?? 0.5) < 0 ? segDur + s.overlay.at : (s.overlay.at ?? 0.5));
      tailIn = ['-loop', '1', '-framerate', String(fps), '-t', String(od), '-i', ovFile];
      vf.push(`null[ov_a];[1:v]format=rgba,fade=t=in:st=0:d=${f}:alpha=1,fade=t=out:st=${r3(od - f)}:d=${f}:alpha=1,setpts=PTS-STARTPTS+${at}/TB[ov_b];[ov_a][ov_b]overlay=0:0:eof_action=pass:format=auto`);
    }
    const chain = [NORM(cut), ...vf, 'setsar=1'].join(',');
    await ff([...args, ...tailIn, '-filter_complex', `[0:v]${chain}[v]`, '-map', '[v]', '-r', String(fps), ...PRORES, out]);
    const p = await probe(out);
    built.push({ ...s, file: out, frames: p.frames }); s._sig();
    log(`segment ${s.id} (${s.type}${s.scene ? ' ' + s.scene + (s._in != null ? ' @' + r3(s._in) + 's' : '') : ''}): ${p.frames} frames = ${(p.frames / fps).toFixed(2)}s, out=${s.out}${s.xd ? ' ' + s.xd + 's' : ''}`);
  }
  return built;
}

// one ffmpeg: cut-joined runs are concatenated, runs are joined by xfade; music bed + voice (ducked) + sfx; H.264 high
async function assemble(cut, segs, outFile) {
  const fps = cut.fps, inputs = [], fl = [];
  segs.forEach((s, i) => inputs.push('-i', s.file));
  // runs of cut-joined segments
  const runs = []; let cur = [];
  segs.forEach((s, i) => { cur.push(i); if (s.out !== 'cut' || i === segs.length - 1) { runs.push(cur); cur = []; } });
  const runLabels = [], runDur = [];
  runs.forEach((r, k) => {
    // setsar=1 on every input: a filmed clip can carry a non-square SAR that concat refuses to join
    if (r.length === 1) { fl.push(`[${r[0]}:v]setsar=1,settb=AVTB,fps=${fps},setpts=PTS-STARTPTS[r${k}]`); }
    else { r.forEach(i => fl.push(`[${i}:v]setsar=1[sq${i}]`)); fl.push(r.map(i => `[sq${i}]`).join('') + `concat=n=${r.length}:v=1:a=0,settb=AVTB,fps=${fps},setpts=PTS-STARTPTS[r${k}]`); }
    runLabels.push(`r${k}`); runDur.push(r.reduce((a, i) => a + segs[i].frames, 0) / fps);
  });
  const XF = { dissolve: 'fade', fadeblack: 'fadeblack', fadewhite: 'fadewhite', push: 'fade', wipe: 'wipeleft', smooth: 'smoothleft' };
  let lab = runLabels[0], off = runDur[0]; const marks = [{ id: segs[0].id, t: 0 }];
  const timeline = []; let t = 0;
  for (let k = 0; k < runs.length; k++) {
    for (const i of runs[k]) { timeline.push({ id: segs[i].id, type: segs[i].type, start: r3(t), end: r3(t + segs[i].frames / fps) }); t += segs[i].frames / fps; }
    if (k < runs.length - 1) {
      const last = segs[runs[k].at(-1)], xd = Math.max(1 / fps, last.xd || 0.5), o = r3(off - xd);
      fl.push(`[${lab}][${runLabels[k + 1]}]xfade=transition=${XF[last.out] || 'fade'}:duration=${xd}:offset=${o}[j${k}]`);
      lab = `j${k}`; off = o + runDur[k + 1]; t -= xd;
    }
  }
  const total = r3(off);
  let v = lab;
  if (cut.letterbox) { const bh = Math.round((cut.height - cut.width / 2.39) / 2); fl.push(`[${v}]drawbox=0:0:${cut.width}:${bh}:black:fill,drawbox=0:${cut.height - bh}:${cut.width}:${bh}:black:fill[lbx]`); v = 'lbx'; }
  fl.push(`[${v}]format=yuv420p[vout]`);
  // ---- audio: music bed (silent placeholder when shots/trailer/music.* is absent), voice line ducking it, sfx cues
  const A = [], ai = []; let n = inputs.length / 2;
  const addIn = (...a) => { inputs.push(...a); return n++; };
  const music = findFile(cut.music?.file), voice = findFile(cut.voice?.file), tape = findFile(cut.sfx?.tapeStop?.file);
  const rewindAt = timeline.find(x => x.type === 'rewind')?.start ?? null;
  const mg = cut.music?.gain ?? -6, fo = cut.music?.fadeOut ?? 3;
  if (music) { const i = addIn('-stream_loop', '-1', '-i', music); A.push(`[${i}:a]atrim=duration=${total},asetpts=PTS-STARTPTS,volume=${mg}dB,afade=t=in:d=0.5,afade=t=out:st=${r3(total - fo)}:d=${fo}[mus]`); log(`music: ${rel(music)} (${mg} dB, fade out ${fo}s)`); }
  else { A.push(`anullsrc=r=48000:cl=stereo,atrim=duration=${total}[mus]`); log('music: silent placeholder (drop a track at shots/trailer/music.mp3|wav|m4a)'); }
  const voices = [];
  // each segment's own sound (a clip with audio:true) and its sfx [{ file, in, dur, at, gain, fin, fout }], placed at the segment's
  // start on the final timeline; all of it ducks the music bed
  segs.forEach((sg, k) => {
    const st = timeline[k].start, list = [];
    if (sg._audio && sg.audio) list.push({ file: sg._audio, in: sg._in || 0, dur: sg.frames / fps + (sg.audioTail ?? 0), at: 0, gain: sg.audioGain ?? 0, fin: 0.04, fout: sg.out === 'cut' ? (sg.audioFout ?? 0.06) : (sg.xd || 0.3) + (sg.audioTail ?? 0) });
    for (const x of sg.sfx || []) { const f = findFile(x.file); if (f) list.push({ ...x, file: f, in: x.in || 0, at: x.at || 0, gain: x.gain ?? 0, fin: x.fin ?? 0.02, fout: x.fout ?? 0.3 }); else log(`sfx ${x.file}: missing, skipped`); }
    list.forEach((x, j) => {
      const i = addIn('-i', x.file), lab = `sa${k}_${j}`, d = x.dur ?? 3, at = Math.max(0, Math.round((st + x.at) * 1000));
      A.push(`[${i}:a]atrim=start=${x.in}:duration=${d},asetpts=PTS-STARTPTS,aformat=sample_rates=48000:channel_layouts=stereo,volume=${x.gain}dB,afade=t=in:d=${x.fin},afade=t=out:st=${r3(Math.max(0, d - x.fout))}:d=${x.fout},adelay=${at}|${at}[${lab}]`);
      voices.push(lab); log(`audio: ${rel(x.file)} [${x.in}s +${r3(d)}s] at ${r3(at / 1000)}s (${sg.id})`);
    });
  });
  if (voice) { const i = addIn('-i', voice), at = Math.round((cut.voice?.at ?? 1.2) * 1000); A.push(`[${i}:a]aformat=sample_rates=48000:channel_layouts=stereo,volume=${cut.voice?.gain ?? 0}dB,adelay=${at}|${at}[vox]`); voices.push('vox'); log(`voice: ${rel(voice)} at ${at / 1000}s`); }
  else if (!voices.length) log('voice: none (no clip audio, no shots/trailer/voice.*); the duck slot stays open');
  let vmix = null;
  if (voices.length) { vmix = 'vmix'; A.push(voices.length === 1 ? `[${voices[0]}]acopy[vmix]` : voices.map(x => `[${x}]`).join('') + `amix=inputs=${voices.length}:normalize=0[vmix]`); }
  if (vmix) { A.push(`[vmix]asplit[vsc][vmx]`, `[mus][vsc]sidechaincompress=threshold=${cut.music?.duckThreshold ?? 0.02}:ratio=${cut.music?.duckRatio ?? 10}:attack=15:release=${cut.music?.duckRelease ?? 500}:makeup=1[musd]`); }
  const mixIn = [vmix ? 'musd' : 'mus', vmix ? 'vmx' : null].filter(Boolean);
  if (rewindAt != null) {
    if (tape) { const i = addIn('-i', tape), at = Math.round(((cut.sfx?.tapeStop?.at ?? 0) + rewindAt) * 1000); A.push(`[${i}:a]aformat=sample_rates=48000:channel_layouts=stereo,volume=${cut.sfx?.tapeStop?.gain ?? -3}dB,adelay=${at}|${at}[tape]`); mixIn.push('tape'); log(`sfx: tape-stop ${rel(tape)} at ${at / 1000}s`); }
    else log(`sfx: tape-stop placeholder (silent) at ${rewindAt}s; drop shots/trailer/sfx/tape-stop.wav`);
  }
  A.push(mixIn.map(x => `[${x}]`).join('') + (mixIn.length > 1 ? `amix=inputs=${mixIn.length}:normalize=0:duration=first,` : '') + `atrim=duration=${total},alimiter=limit=0.95:level=false[aout]`);
  const graph = [...fl, ...A].join(';');
  fs.writeFileSync(path.join(OUT, 'build', 'assemble.filtergraph.txt'), graph.split(';').join(';\n'));
  await ff([...inputs, '-filter_complex', graph, '-map', '[vout]', '-map', '[aout]', '-r', String(fps),
    '-c:v', 'libx264', '-profile:v', 'high', '-level', '4.1', '-preset', 'slow', '-crf', String(cut.crf ?? 17), '-pix_fmt', 'yuv420p',
    '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-color_range', 'tv',
    '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-movflags', '+faststart', '-t', String(total), outFile]);
  return { total, timeline };
}

export async function edit(opts) {
  const cut = loadCut();
  cut._fresh = !!opts.fresh;
  if (opts.gameplay) {   // the take swap: gameplay/raw-<tag>.mp4 + beats-<tag>.json, and the segment's takes.<tag> cut list when it has one
    const g = cut.segments.find(x => x.type === 'gameplay'), tag = opts.gameplay;
    if (!g) throw new Error('--gameplay: no gameplay segment in the cut list');
    g.file = `shots/trailer/gameplay/raw-${tag}.mp4`; g.beats = `shots/trailer/gameplay/beats-${tag}.json`;
    if (g.takes?.[tag]) g.cuts = g.takes[tag];
    if (!findFile(g.file) || !findFile(g.beats)) throw new Error(`--gameplay ${tag}: ${g.file} or ${g.beats} missing`);
    log(`gameplay take "${tag}": ${g.file} + ${g.beats}${g.takes?.[tag] ? ` (takes.${tag}: ${g.cuts.length} cuts)` : ' (default cuts)'}`);
  }
  const outFile = path.resolve(ROOT, opts.out || cut.out || path.join('shots', 'trailer', 'aloud-trailer-v1.mp4'));
  const segs = await buildSegments(cut);
  const { total, timeline } = await assemble(cut, segs, outFile);
  const p = await probe(outFile);
  const report = { out: rel(outFile), duration: r3(p.frames / p.fps), frames: p.frames, width: p.width, height: p.height, fps: p.fps, timeline, built: new Date().toISOString() };
  fs.writeFileSync(path.join(OUT, 'timeline.json'), JSON.stringify(report, null, 2));
  log(`final: ${rel(outFile)} ${p.width}x${p.height}@${p.fps} ${p.frames} frames = ${(p.frames / p.fps).toFixed(2)}s`);
  for (const x of timeline) log(`  ${String(x.start).padStart(6)}s - ${String(x.end).padStart(6)}s  ${x.id} (${x.type})`);
  return report;
}

// ---------- 3. contact sheet: 1 frame / N s, timestamped ----------
export async function sheet(opts) {
  const cut = loadCut();
  const src = path.resolve(ROOT, opts.in || cut.out || path.join('shots', 'trailer', 'aloud-trailer-v1.mp4'));
  const p = await probe(src), every = opts.every || 2, cols = 8, rows = Math.ceil(p.frames / p.fps / every / cols);
  const out = path.resolve(ROOT, opts.out || src.replace(/\.mp4$/, `-contact.png`));
  const font = ['/System/Library/Fonts/Supplemental/Arial.ttf', '/System/Library/Fonts/Helvetica.ttc', '/Library/Fonts/Arial.ttf'].find(exists);
  const hasDrawtext = /\sdrawtext\s/.test(await run(FFMPEG, ['-hide_banner', '-filters']).catch(() => ''));
  const draw = font && hasDrawtext ? `drawtext=fontfile=${font}:text='%{pts\\:flt}':x=10:y=h-th-10:fontsize=44:fontcolor=white:box=1:boxcolor=black@0.55:boxborderw=8,` : '';
  await ff(['-i', src, '-vf', `${draw}fps=1/${every},scale=320:-1,tile=${cols}x${rows}:padding=4:margin=4:color=0x101010`, '-frames:v', '1', out]);
  log(`contact sheet: ${rel(out)} (${cols}x${rows}, 1 frame / ${every}s)`);
  return out;
}

// ---------- 3b. segment sheet: one labelled frame per segment of the last edit (timeline.json) ----------
export async function segSheet(opts) {
  const tl = JSON.parse(fs.readFileSync(path.join(OUT, 'timeline.json'), 'utf8'));
  const src = path.resolve(ROOT, opts.in || tl.out), dir = path.join(OUT, 'build', 'sheet'); mkdir(dir);
  for (const f of fs.readdirSync(dir)) fs.unlinkSync(path.join(dir, f));
  const items = [];
  for (const [k, x] of tl.timeline.entries()) {
    const t = r3(x.start + (x.end - x.start) * (x.type === 'card' ? 0.5 : 0.55)), f = path.join(dir, `${String(k).padStart(2, '0')}.jpg`);
    await ff(['-ss', String(t), '-i', src, '-frames:v', '1', '-vf', 'scale=480:-1:flags=lanczos', '-q:v', '3', f]);
    items.push({ f, label: `${k + 1}. ${x.id}  ${x.start.toFixed(1)}–${x.end.toFixed(1)}s` });
  }
  const out = path.resolve(ROOT, opts.out || path.join('shots', 'trailer', 'v2-sheet.jpg'));
  const py = `import json,sys\nfrom PIL import Image,ImageDraw,ImageFont\nit=json.loads(sys.argv[1]);cols=4;W,H=480,270;L=34;P=8\nrows=(len(it)+cols-1)//cols\nim=Image.new('RGB',(cols*(W+P)+P,rows*(H+L+P)+P),(14,14,18));d=ImageDraw.Draw(im)\ntry: fn=ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf',20)\nexcept Exception: fn=ImageFont.load_default()\nfor i,x in enumerate(it):\n  c,r=i%cols,i//cols;X,Y=P+c*(W+P),P+r*(H+L+P)\n  im.paste(Image.open(x['f']).resize((W,H)),(X,Y));d.text((X+2,Y+H+6),x['label'],fill=(235,232,225),font=fn)\nim.save(sys.argv[2],quality=90)\n`;
  await run('python3', ['-c', py, JSON.stringify(items), out]);
  log(`segment sheet: ${rel(out)} (${items.length} segments)`);
  return out;
}

// ---------- main ----------
const main = async () => {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.cut) process.env.TRAILER_CUT = opts.cut;
  const started = Date.now();
  if (opts.cmd === 'capture') await capture(opts);
  else if (opts.cmd === 'gameplay') await gameplay(opts);
  else if (opts.cmd === 'edit') console.log(JSON.stringify(await edit(opts)));
  else if (opts.cmd === 'sheet') console.log(await sheet(opts));
  else if (opts.cmd === 'segsheet') console.log(await segSheet(opts));
  else if (opts.cmd === 'all') {
    await capture(opts);
    if (!exists(path.join(OUT, 'gameplay', 'raw.mp4'))) await gameplay(opts);
    const r = await edit(opts); const s = await segSheet({ ...opts, in: r.out, out: null });
    console.log(JSON.stringify({ ...r, sheet: rel(s) }));
  } else { console.error('usage: trailer.mjs capture|gameplay|edit|sheet|all'); process.exit(2); }
  log(`${opts.cmd} done in ${((Date.now() - started) / 1000).toFixed(0)}s`);
};
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(e => { console.error('[trailer] failed:', e.message); process.exit(1); });
