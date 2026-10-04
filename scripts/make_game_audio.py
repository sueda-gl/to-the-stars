#!/usr/bin/env python3
"""The live game's sound (web/js/ui/sound.js): music loops + sfx, synthesized locally with the trailer's synth
(shots/trailer/sfx/make_audio.py: its instruments, reverb and loudness code are reused verbatim, no credits).

    python3 scripts/make_game_audio.py      -> web/assets/audio/*.mp3 (128 kbps, 48 kHz)

Loops are written PERIODIC with 0.5 s of wrap-around padding on both sides: the file is [last 0.5 s] + loop +
[first 0.5 s], so any window of exactly LOOP seconds from ~0.5 s is seamless whatever the mp3 decoder's priming
delay is. sound.js plays them with loopStart = 0.5, loopEnd = 0.5 + LOOP (the lengths are in manifest.json).
"""
import json, os, subprocess, tempfile
import numpy as np
from scipy import signal

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
SRC = open(os.path.join(ROOT, 'shots', 'trailer', 'sfx', 'make_audio.py')).read()
OUT = os.path.join(ROOT, 'web', 'assets', 'audio'); os.makedirs(OUT, exist_ok=True)
SR = 48000; N = SR; rng = np.random.default_rng(11)

def chunk(a, b): i = SRC.index(a); return SRC[i:SRC.index(b, i)]
exec(chunk('# ------------------------------------------------------------------ dsp helpers', '# ------------------------------------------------------------------ the score'))
exec(chunk('# ------------------------------------------------------------------ reverb (synthetic IR)', '# ------------------------------------------------------------------ rewind'))
exec(chunk('def whoosh(', 'def sparkle('))

CH = {'D': [62, 66, 69, 74], 'A': [61, 64, 69, 73], 'Bm': [59, 62, 66, 71], 'G': [59, 62, 67, 71],
      'Dmaj7': [62, 66, 69, 73], 'Gmaj7': [59, 66, 67, 71], 'Bm9': [61, 62, 66, 69], 'Asus': [62, 64, 69, 74],
      'Em9': [62, 66, 67, 71], 'Dadd9': [62, 64, 66, 69, 74]}
ROOTS = {'D': 38, 'A': 45, 'Bm': 47, 'G': 43, 'Dmaj7': 38, 'Gmaj7': 43, 'Bm9': 47, 'Asus': 45, 'Em9': 40, 'Dadd9': 38}
MOTIF = [
    [(0, 81, .5), (.5, 78, .5), (1, 81, .5), (1.5, 86, 1.5), (3, 83, .5), (3.5, 81, .5)],
    [(0, 85, 1), (1, 83, .5), (1.5, 81, .5), (2, 76, 2)],
    [(0, 78, .5), (.5, 83, .5), (1, 86, .5), (1.5, 90, 1.5), (3, 88, .5), (3.5, 86, .5)],
    [(0, 83, 1), (1, 81, .5), (1.5, 79, .5), (2, 81, 2)],
]

class Buf:
    def __init__(s, sec): s.b = np.zeros((2, int(sec * SR)))
    def add(s, x, at, pan=0.0, gain=1.0):
        y = pan2(x, pan) * gain if x.ndim == 1 else x * gain
        i = int(round(at * SR)); j = min(s.b.shape[1], i + y.shape[1]); s.b[:, i:j] += y[:, :j - i]

class Loop:
    """content rendered into LOOP + tail, reverb applied, the tail wrapped onto the head: a periodic signal"""
    def __init__(s, loop, tail=8.0): s.L = loop; s.dry = Buf(loop + tail); s.send = Buf(loop + tail)
    def play(s, x, at, pan=0.0, gain=1.0, send=0.4): s.dry.add(x, at, pan, gain); s.send.add(x, at, pan, gain * send)
    def pad(s, name, at, dur, gain=1.0, cut=1200, att=1.5, rel=2.0, oct=0, send=0.7):
        x = saws([mtof(m + 12 * oct) for m in CH[name]], dur, cut=cut, att=att, rel=rel); s.dry.add(x, at, gain=gain); s.send.add(x, at, gain=gain * send)
    def render(s, rt=3.0, wet=0.6, pad_s=0.5):
        L = int(s.L * SR); x = s.dry.b + reverb(s.send, rt, wet)
        y = x[:, :L].copy(); tail = x[:, L:]
        for k in range(0, tail.shape[1], L): seg = tail[:, k:k + L]; y[:, :seg.shape[1]] += seg
        p = int(pad_s * SR); return np.concatenate([y[:, -p:], y, y[:, :p]], axis=1)

def norm_lufs(x, target):
    x = x * 10 ** ((target - lufs(x)) / 20); pk = np.abs(x).max()
    return x * (10 ** (-1.5 / 20) / pk) if pk > 10 ** (-1.5 / 20) else x

def norm_peak(x, db_=-3.0): return x * 10 ** (db_ / 20) / max(np.abs(x).max(), 1e-9)

def mp3(name, x):
    if x.ndim == 1: x = np.stack([x, x])
    from scipy.io import wavfile
    with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as f: tmp = f.name
    wavfile.write(tmp, SR, (np.clip(x.T, -1, 1) * 32767).astype(np.int16))
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', tmp, '-c:a', 'libmp3lame', '-b:a', '128k', '-ar', str(SR), os.path.join(OUT, name + '.mp3')], check=True)
    os.unlink(tmp)

man = {}

# ---------------------------------------------------------------- music-loop: the seaside, calm, 24 bars at 80 bpm = 72 s
bpm = 80; bt = 60 / bpm; bar = 4 * bt; bars = 24; LOOP = bars * bar
m = Loop(LOOP)
prog = ['Dmaj7', 'A', 'Bm9', 'G', 'Dmaj7', 'Asus', 'Gmaj7', 'G']
for k in range(bars):
    t = k * bar; c = prog[k % 8]
    m.pad(c, t, bar, 0.55, cut=1000, att=1.4, rel=2.2)
    m.play(pluck(mtof(ROOTS[c]), 1.2, 0.7, 0.15), t, 0, 0.55, 0.3)
    m.play(sine_bass(mtof(ROOTS[c] - 12 if ROOTS[c] > 40 else ROOTS[c]), bar * 0.8, 0.6), t, 0, 0.35, 0.05)
    if k % 2: m.play(pluck(mtof(ROOTS[c] + 7), 0.8, 0.5, 0.2), t + 2 * bt, 0.1, 0.4, 0.3)
    # a gentle marimba walk on the chord tones (quarters, some rests)
    tones = CH[c] + [x + 12 for x in CH[c]]
    for e in range(4):
        if rng.uniform() < 0.62: m.play(marimba(mtof(tones[rng.integers(len(tones))]), 0.3, 0.6), t + e * bt + (bt / 2 if rng.uniform() < 0.25 else 0), rng.uniform(-0.5, 0.5), 0.38, 0.5)
    # the motif, slow and far away, twice per loop
    if 8 <= k < 12 or 18 <= k < 22:
        for (b, n, l) in MOTIF[k % 4]: m.play(celesta(mtof(n), l * bt, 0.6), t + b * bt, 0.25, 0.32, 0.8)
    if rng.uniform() < 0.35: m.play(celesta(mtof(rng.choice([93, 95, 97, 98])), 0.3, 0.4), t + rng.integers(0, 8) * bt / 2, rng.uniform(-0.8, 0.8), 0.25, 0.9)
music = norm_lufs(m.render(3.2, 0.6), -20.0); mp3('music-loop', music); man['music-loop'] = {'loop': LOOP, 'pad': 0.5}

# ---------------------------------------------------------------- music-space: orbit / voyage / Plisse, airy, 32 s
bpm = 60; bt = 1.0; bar = 4.0; bars = 8; LOOP = bars * bar
s = Loop(LOOP, 10)
sp = ['Gmaj7', 'Asus', 'Dmaj7', 'Bm9']
for k in range(bars):
    t = k * bar; c = sp[(k // 2) % 4]
    if k % 2 == 0:
        s.pad(c, t, 2 * bar, 0.6, cut=1800, att=3.0, rel=3.0, send=0.9)
        s.play(sine_bass(mtof(ROOTS[c] - 12 if ROOTS[c] > 40 else ROOTS[c]), 2 * bar, 0.5), t, 0, 0.3, 0.1)
    arp = sorted(CH[c]) + [x + 12 for x in sorted(CH[c])]
    for e in range(8):
        if rng.uniform() < 0.7: s.play(celesta(mtof(arp[(e * 3 + k) % len(arp)] + 12), 0.4, 0.5), t + e * bt / 2, np.sin(e + k) * 0.7, 0.28, 1.0)
spc = norm_lufs(s.render(4.5, 0.75), -21.0); mp3('music-space', spc); man['music-space'] = {'loop': LOOP, 'pad': 0.5}

# ---------------------------------------------------------------- sfx
def one(sec): return Buf(sec)

# scribble: pencil strokes, short scratchy noise bursts on paper
b = one(1.3); t = 0.0
while t < 1.05:
    d = rng.uniform(0.06, 0.16); n = int(d * SR); tt_ = np.arange(n) / n
    x = bp(rng.standard_normal(n), rng.uniform(2200, 3200), rng.uniform(6000, 9000), 2) * np.sin(np.pi * tt_) ** 0.7
    x *= 0.6 + 0.4 * np.abs(np.sin(2 * np.pi * np.cumsum(np.full(n, rng.uniform(25, 45))) / SR))
    b.add(x * rng.uniform(0.5, 1.0), t, rng.uniform(-0.3, 0.3)); t += d + rng.uniform(0.01, 0.05)
mp3('scribble', norm_peak(b.b + 0.15 * reverb(b, 0.5, 1.0), -4))

# build-done: a pop and a sparkle
b = one(1.8); b.add(pop(1.0, 330, 1050), 0.0)
for i, n_ in enumerate([86, 90, 93, 98, 102]): b.add(celesta(mtof(n_), 0.2, 0.55), 0.06 + i * 0.055, -0.5 + i * 0.25, 0.6)
b.add(whoosh(0.7, 3000, 10000, 0.25), 0.05)
mp3('build-done', norm_peak(b.b + 0.3 * reverb(b, 1.4, 1.0), -3))

# letter: a soft paper slide + a little flap
b = one(1.0); n = int(0.55 * SR); tt_ = np.arange(n) / n
x = bp(rng.standard_normal(n), 900, 5000, 1) * np.sin(np.pi * tt_) ** 1.5 * (0.7 + 0.3 * np.sin(2 * np.pi * 9 * tt_)); b.add(x * 0.6, 0.0, -0.2)
k = int(0.05 * SR); flap = lp(rng.standard_normal(k), 2500) * np.exp(-np.arange(k) / (0.01 * SR)); b.add(flap, 0.58, 0.1, 0.8)
b.add(celesta(mtof(93), 0.2, 0.25), 0.6, 0.2, 0.5)
mp3('letter', norm_peak(b.b + 0.2 * reverb(b, 0.8, 1.0), -6))

# chime: rewards and stamps
b = one(2.2)
for i, n_ in enumerate([86, 93, 98]): b.add(celesta(mtof(n_), 0.6, 0.7), i * 0.07, -0.3 + i * 0.3, 0.7)
b.add(marimba(mtof(74), 0.3, 0.6), 0.0, 0, 0.5)
mp3('chime', norm_peak(b.b + 0.35 * reverb(b, 1.6, 1.0), -4))

# level-up fanfare: a rising D-major arpeggio into the motif's head, brass + celesta + timpani + crash
b = one(4.5)
b.add(timpani(vel=0.9, dec=1.4), 0.0, 0, 0.7)
for i, n_ in enumerate([62, 66, 69, 74]):
    b.add(saws([mtof(n_), mtof(n_ - 12)], 0.16, cut=2800, att=0.01, rel=0.25, voices=3), i * 0.13, gain=1.6)
    b.add(pluck(mtof(n_ + 12), 0.3, 0.8, 0.6), i * 0.13, 0.3, 0.6)
x = saws([mtof(m_) for m_ in [62, 66, 69, 74, 78, 50]], 1.6, cut=2200, cut_end=4800, att=0.05, rel=1.2, voices=4); b.add(x, 0.52, gain=1.4)
for (bb, n_, l) in MOTIF[0][:4]: b.add(celesta(mtof(n_ + 12), l * 0.25, 0.8), 0.52 + bb * 0.25, 0.2, 0.7)
b.add(crash(0.6, 1.8), 0.52, 0, 0.6); b.add(timpani(vel=1.0, dec=1.6), 0.52, 0, 0.8)
mp3('fanfare', norm_peak(b.b + 0.35 * reverb(b, 2.0, 1.0), -2))

# click: a soft wooden UI tick
n = int(0.06 * SR); t_ = np.arange(n) / SR
x = (np.sin(2 * np.pi * 1650 * t_) + 0.4 * np.sin(2 * np.pi * 2900 * t_)) * np.exp(-t_ / 0.008); x[:48] *= np.linspace(0, 1, 48)
mp3('click', norm_peak(np.stack([x, x]), -8))

# whoosh: cloud descent / camera flights
b = one(2.2); b.add(whoosh(1.8, 250, 2600, 1.0, -0.7, 0.7), 0.0); b.add(whoosh(1.6, 600, 4200, 0.5, 0.6, -0.6), 0.25)
mp3('whoosh', norm_peak(b.b + 0.2 * reverb(b, 1.2, 1.0), -4))

# rumble: the voyage lift-off, swell -> roar -> fade (5.5 s)
D_ = 5.5; n = int(D_ * SR); t_ = np.arange(n) / SR
brown = hp(np.cumsum(rng.standard_normal((2, n)), axis=1), 18, 2); brown /= np.abs(brown).max()
roar = lp(hp(rng.standard_normal((2, n)), 60, 2), 2200, 2)
crk = (rng.uniform(size=(2, n)) < 0.0008) * rng.standard_normal((2, n)); crk = lp(hp(crk, 400), 4000) * 6
e1 = np.interp(t_, [0, 1.2, 2.0, 3.5, 5.5], [0, 0.7, 1, 0.7, 0]); e2 = np.interp(t_, [0, 1.0, 2.0, 3.0, 5.5], [0, 0.1, 1, 0.6, 0])
x = lp(brown, 140, 4) * e1 * 1.6 + roar * e2 * 0.5 + crk * e2 * 0.4
mp3('rumble', norm_peak(x, -3))

json.dump(man, open(os.path.join(OUT, 'manifest.json'), 'w'), indent=1)
print('music-loop', round(lufs(music), 1), 'LUFS; music-space', round(lufs(spc), 1), 'LUFS')
print(sorted(os.listdir(OUT)))
