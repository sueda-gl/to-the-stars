# Frame strips + frame-to-frame difference plot for a recorded leg (tests/handoff/record.mjs).
#   python3 tests/handoff/analyse.py shots/handoff/t1/down [--step 0.1] [--from 0] [--to 99]
import sys, json, os, numpy as np
from PIL import Image, ImageDraw
import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
d = sys.argv[1]; a = sys.argv
step = float(a[a.index('--step') + 1]) if '--step' in a else 0.1
t_from = float(a[a.index('--from') + 1]) if '--from' in a else 0
t_to = float(a[a.index('--to') + 1]) if '--to' in a else 1e9
cols = int(a[a.index('--cols') + 1]) if '--cols' in a else 6
tl = json.load(open(os.path.join(d, 'timeline.json')))
fr = sorted(tl['frames'], key=lambda f: f['ms']); hl0 = tl['hl0']   # the screencast delivers frames out of order
# screencast ts (s) -> page clock: align by the wall clock (approximate) — marks are page ms since hl0
first = tl['firstFrameTs']; startWall = tl['startWall']
marks = [(m[0] - hl0, m[1], m[2]) for m in tl['marks']]
def load(fn, w=360):
    im = Image.open(os.path.join(d, fn)).convert('RGB'); return im
# frame-to-frame differences on a uniform 50 ms grid (the nearest captured frame to each tick; screencast frames
# come irregularly, so raw neighbours are not comparable): each point = how much the picture changed in 50 ms
ts = np.array([f['ms'] for f in fr]) / 1000.0
cache = {}
def small(i):
    if i not in cache: cache[i] = np.asarray(Image.open(os.path.join(d, fr[i]['fn'])).convert('RGB').resize((240, 150), Image.BILINEAR), dtype=np.float32) / 255.0
    return cache[i]
grid = np.arange(ts[0], ts[-1], 0.05)
gi = [int(np.argmin(np.abs(ts - t))) for t in grid]
gd = np.array([0.0] + [float(np.mean(np.abs(small(gi[k]) - small(gi[k - 1])))) if gi[k] != gi[k - 1] else np.nan for k in range(1, len(gi))])
diff = np.zeros(len(fr))
for k, i in enumerate(gi): diff[i] = 0 if np.isnan(gd[k]) else gd[k]
plt.figure(figsize=(12, 4.2))
ok = ~np.isnan(gd)
plt.plot(grid[ok], gd[ok], '.-', lw=1, ms=3, color='#3a5a9a', label='mean |frame(t) - frame(t - 50 ms)|, 0..1')
for t, k, v in marks:
    if k == 'surface': plt.axvline(t / 1000 + 0.3, color='#b03030', ls='--', lw=1); plt.text(t / 1000 + 0.32, 0.9 * max(0.05, np.nanmax(gd)), 'swap -> ' + str(v), color='#b03030', fontsize=8)
plt.ylim(0, max(0.06, np.nanmax(gd) * 1.15))
plt.xlabel('s since recording start (swap line ±0.1 s)'); plt.ylabel('change per 50 ms'); plt.legend(fontsize=8); plt.title(os.path.basename(d.rstrip('/')) + ': frame-to-frame difference')
plt.tight_layout(); plt.savefig(os.path.join(d, 'diff.png'), dpi=110)
dt = np.array([0.0] + [ts[i] - ts[i - 1] for i in range(1, len(ts))])
# strips: frames nearest to every `step` s
sel = []; t = max(t_from, ts[0])
while t <= min(t_to, ts[-1]) + 1e-6:
    i = int(np.argmin(np.abs(ts - t))); sel.append(i); t += step
tw, th = 480, 300
rows = (len(sel) + cols - 1) // cols
sheet = Image.new('RGB', (cols * tw, rows * (th + 16)), (20, 20, 24))
dr = ImageDraw.Draw(sheet)
for k, i in enumerate(sel):
    im = Image.open(os.path.join(d, fr[i]['fn'])).convert('RGB').resize((tw, th), Image.LANCZOS)
    x, y = (k % cols) * tw, (k // cols) * (th + 16)
    sheet.paste(im, (x, y + 16)); dr.text((x + 4, y + 2), f"{ts[i]:.2f}s  d={diff[i]:.3f}", fill=(230, 230, 230))
name = f"strip-{t_from:g}-{min(t_to, ts[-1]):.1f}-{step:g}.jpg"
sheet.save(os.path.join(d, name), quality=88)
print('frames', len(fr), 'strip', name, 'rows', rows)
top = np.argsort(-np.nan_to_num(gd))[:8]
print('largest 50 ms changes:', ', '.join(f"{grid[k]:.2f}s={gd[k]:.3f}" for k in top))
print('marks', [(round(t / 1000 + 0.3, 2), k, v) for t, k, v in marks])
