#!/usr/bin/env node
// Records a director run to an MP4: Chrome (puppeteer-core) -> CDP Page.startScreencast -> ffmpeg.
//   node tests/record/record.mjs [--url http://localhost:8870/?director=1] [--out shots/video/x.mp4]
//                                [--max 240] [--fps 30] [--headed] [--quality 90] [--crf 18] [--keep-frames]
// Stops when window.__directorDone === true or after --max seconds. Frames are written to a temp
// dir as they arrive (with their CDP timestamps) and replayed into ffmpeg at a constant fps, duplicating
// or dropping by timestamp, so the video's clock matches wall time even when the page paints unevenly.
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const FFMPEG = process.env.FFMPEG || '/opt/homebrew/bin/ffmpeg';
const FFPROBE = process.env.FFPROBE || path.join(path.dirname(FFMPEG), 'ffprobe');

export function parseArgs(argv) {
  const a = { url: 'http://localhost:8870/?director=1', out: null, max: 240, fps: 30, headed: false, quality: 90, crf: 18, keepFrames: false, width: 1920, height: 1080 };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i], v = argv[i + 1];
    if (k === '--url') a.url = v, i++;
    else if (k === '--out') a.out = v, i++;
    else if (k === '--max') a.max = Number(v), i++;
    else if (k === '--fps') a.fps = Number(v), i++;
    else if (k === '--quality') a.quality = Number(v), i++;
    else if (k === '--crf') a.crf = Number(v), i++;
    else if (k === '--size') { const [w, h] = v.split('x').map(Number); a.width = w; a.height = h; i++; }
    else if (k === '--headed') a.headed = true;
    else if (k === '--keep-frames') a.keepFrames = true;
    else if (k === '-h' || k === '--help') { console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 8).join('\n')); process.exit(0); }
  }
  return a;
}

export const stamp = (d = new Date()) => d.toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '-');

// Constant-fps timeline: for output frame k at t0 + k/fps, the latest captured frame at or before it.
// Returns an array of capture indices (one per output frame). Pure; used by the test.
export function cfrSchedule(timestamps, fps, endTime = timestamps.at(-1)) {
  if (!timestamps.length) return [];
  const t0 = timestamps[0], out = [];
  const n = Math.max(1, Math.round((endTime - t0) * fps));
  let j = 0;
  for (let k = 0; k < n; k++) {
    const t = t0 + k / fps;
    while (j + 1 < timestamps.length && timestamps[j + 1] <= t) j++;
    out.push(j);
  }
  return out;
}

// MJPEG frames in, limited-range BT.709 H.264 out (see the note at the encode step). Pure; used by the test.
export function ffmpegArgs({ fps, crf, out }) {
  return ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
    '-vf', 'scale=in_range=pc:out_range=tv:out_color_matrix=bt709,setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv', '-color_range', 'tv', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', String(crf), '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-r', String(fps), out];
}

export async function record(opts) {
  const { url, max, fps, headed, quality, crf, width, height } = opts;
  const out = path.resolve(ROOT, opts.out || path.join('shots', 'video', `agora-demo-${stamp()}.mp4`));
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'agora-rec-'));
  const log = (...a) => console.error('[record]', ...a);

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: headed ? false : 'new',
    defaultViewport: { width, height, deviceScaleFactor: 1 },
    args: [
      '--use-angle=metal', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist',
      `--window-size=${width},${height}`, '--hide-scrollbars', '--disable-infobars',
      '--autoplay-policy=no-user-gesture-required', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream',
      '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-features=CalculateNativeWinOcclusion',
      '--font-render-hinting=none', '--no-first-run', '--no-default-browser-check',
    ],
  });
  const page = await browser.newPage();
  page.on('console', m => { if (['error', 'warning'].includes(m.type())) log('page', m.type(), m.text()); });
  page.on('pageerror', e => log('pageerror', e.message));
  const cdp = await page.createCDPSession();

  const frames = [];   // { file, t }
  const writes = [];   // every frame's write promise; awaited before encoding
  let bytes = 0;
  cdp.on('Page.screencastFrame', async ({ data, metadata, sessionId }) => {
    const buf = Buffer.from(data, 'base64');
    const file = path.join(tmp, `${String(frames.length).padStart(6, '0')}.jpg`);
    frames.push({ file, t: metadata.timestamp });
    bytes += buf.length;
    writes.push(fsp.writeFile(file, buf).catch(e => log('frame write failed', file, e.message)));
    try { await cdp.send('Page.screencastFrameAck', { sessionId }); } catch { /* closing */ }
  });

  log('open', url);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality, maxWidth: width, maxHeight: height, everyNthFrame: 1 });
  const started = Date.now();
  log(`recording up to ${max}s, waiting for window.__directorDone`);
  let done = false;
  while (!done && Date.now() - started < max * 1000) {
    await new Promise(r => setTimeout(r, 500));
    try { done = await page.evaluate(() => window.__directorDone === true); } catch { break; }
    if (frames.length && (frames.length % 300 === 0)) log(`${frames.length} frames, ${(bytes / 1e6).toFixed(0)} MB, ${((Date.now() - started) / 1000).toFixed(0)}s`);
  }
  await cdp.send('Page.stopScreencast').catch(() => {});
  await new Promise(r => setTimeout(r, 300));   // frames still in flight from CDP
  await Promise.all(writes);                     // every captured frame is on disk
  await browser.close();
  const wall = (Date.now() - started) / 1000;
  log(`captured ${frames.length} frames in ${wall.toFixed(1)}s (${done ? 'director done' : 'max reached'}), ${(bytes / 1e6).toFixed(1)} MB jpeg`);
  if (!frames.length) throw new Error('no frames captured');

  // Encode: replay at constant fps, holding the last frame to the wall-clock end.
  // MJPEG is full-range; libx264 would propagate color_range=pc and many players/editors then wash out the paper
  // tones. Squeeze to limited range and tag it (plus BT.709) so the cream reads the same everywhere.
  const ts = frames.map(f => f.t);
  const schedule = cfrSchedule(ts, fps, ts[0] + wall);
  log(`encoding ${schedule.length} frames at ${fps} fps -> ${path.relative(ROOT, out)}`);
  await new Promise((resolve, reject) => {
    const ff = spawn(FFMPEG, ffmpegArgs({ fps, crf, out }), { stdio: ['pipe', 'inherit', 'inherit'] });
    ff.on('error', reject);
    ff.on('close', code => code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}`)));
    (async () => {
      let last = -1, buf = null;
      for (const idx of schedule) {
        if (idx !== last) { buf = fs.readFileSync(frames[idx].file); last = idx; }
        if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      }
      ff.stdin.end();
    })().catch(reject);
  });
  if (!opts.keepFrames) fs.rmSync(tmp, { recursive: true, force: true }); else log('frames kept in', tmp);

  let probe = null;
  try {
    const p = spawn(FFPROBE, ['-v', 'error', '-show_entries', 'format=duration,size:stream=width,height,r_frame_rate,nb_frames,color_range,color_space', '-of', 'json', out]);
    let s = ''; p.stdout.on('data', d => s += d);
    await new Promise(r => p.on('close', r));
    probe = JSON.parse(s);
  } catch { /* ffprobe optional */ }
  const result = { out, frames: frames.length, wallSeconds: wall, done, duration: Number(probe?.format?.duration), sizeBytes: Number(probe?.format?.size), stream: probe?.streams?.[0] };
  log(`done: ${result.duration?.toFixed?.(1)}s, ${(result.sizeBytes / 1e6).toFixed(1)} MB, ${result.stream?.width}x${result.stream?.height}@${result.stream?.r_frame_rate} range=${result.stream?.color_range} (no audio track: narration is added in the edit)`);
  return result;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  record(parseArgs(process.argv.slice(2))).then(r => { console.log(JSON.stringify(r)); }, e => { console.error('[record] failed:', e.message); process.exit(1); });
}
