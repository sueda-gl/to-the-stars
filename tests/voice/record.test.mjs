import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cfrSchedule, parseArgs, stamp } from '../record/record.mjs';

test('cfrSchedule duplicates and drops frames by timestamp to a constant fps', () => {
  // captured at 0, .05, .10, .40 s (a stall), then .41 .42 .43 (a burst)
  const ts = [0, 0.05, 0.10, 0.40, 0.41, 0.42, 0.43];
  const s = cfrSchedule(ts, 10, 0.6);   // 10 fps for 0.6 s -> 6 output frames at 0, .1, .2, .3, .4, .5
  assert.deepEqual(s, [0, 2, 2, 2, 3, 6]);
  assert.deepEqual(cfrSchedule([5], 30, 5), [0], 'a single frame still yields one output frame');
  assert.deepEqual(cfrSchedule([], 30), []);
  const dense = cfrSchedule(Array.from({ length: 120 }, (_, i) => i / 60), 30);
  assert.equal(dense.length, 60); assert.deepEqual(dense.slice(0, 3), [0, 2, 4], 'drops every other 60 fps frame');
});

test('parseArgs defaults and flags', () => {
  const d = parseArgs([]);
  assert.equal(d.url, 'http://localhost:8870/?director=1'); assert.equal(d.max, 240); assert.equal(d.fps, 30); assert.equal(d.headed, false);
  const a = parseArgs(['--url', 'http://x/?director=1', '--out', 'o.mp4', '--max', '12', '--fps', '24', '--headed', '--size', '1280x720', '--crf', '20']);
  assert.deepEqual([a.url, a.out, a.max, a.fps, a.headed, a.width, a.height, a.crf], ['http://x/?director=1', 'o.mp4', 12, 24, true, 1280, 720, 20]);
  assert.match(stamp(new Date('2026-10-03T20:16:37Z')), /^20261003-201637$/);
});

test('ffmpeg args squeeze full-range MJPEG to limited-range BT.709 and tag it', async () => {
  const { ffmpegArgs } = await import('../record/record.mjs');
  const a = ffmpegArgs({ fps: 30, crf: 18, out: '/x/out.mp4' });
  const after = (flag) => a[a.indexOf(flag) + 1];
  assert.equal(after('-vf'), 'scale=in_range=pc:out_range=tv:out_color_matrix=bt709,setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv');
  assert.equal(after('-color_range'), 'tv'); assert.equal(after('-colorspace'), 'bt709'); assert.equal(after('-color_trc'), 'bt709'); assert.equal(after('-color_primaries'), 'bt709');
  assert.ok(a.indexOf('-vf') < a.indexOf('libx264'), 'filter is an output option before the encoder');
  assert.equal(a.at(-1), '/x/out.mp4'); assert.equal(after('-pix_fmt'), 'yuv420p'); assert.equal(after('-crf'), '18');
});
