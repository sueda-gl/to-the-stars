#!/usr/bin/env python3
"""Pixel diff of two screenshots: mean abs diff, max diff, % of pixels differing > 8/255.
usage: diff.py a.png b.png [diff_out.png]  -> prints one JSON line"""
import json, sys
from PIL import Image, ImageChops

a = Image.open(sys.argv[1]).convert('RGB')
b = Image.open(sys.argv[2]).convert('RGB')
if a.size != b.size:
    print(json.dumps({'error': f'size mismatch {a.size} vs {b.size}'}))
    sys.exit(0)
d = ImageChops.difference(a, b)
hist = d.histogram()                      # 3 x 256 bins
n = a.size[0] * a.size[1]
mean = sum(i * c for ch in range(3) for i, c in enumerate(hist[ch * 256:(ch + 1) * 256])) / (n * 3)
mx = max((i for ch in range(3) for i, c in enumerate(hist[ch * 256:(ch + 1) * 256]) if c), default=0)
# a pixel "differs" when any channel differs by more than 8
r, g, bb = d.split()
over = ImageChops.lighter(ImageChops.lighter(r, g), bb).point(lambda v: 255 if v > 8 else 0)
pct = over.histogram()[255] / n * 100
if len(sys.argv) > 3:
    # the original dimmed to a quarter, plus the difference amplified x16, plus red where it is over 8/255
    base = Image.blend(a, Image.new('RGB', a.size, (0, 0, 0)), 0.75)
    out = ImageChops.add(base, d.point(lambda v: min(255, v * 16)))
    Image.composite(Image.new('RGB', a.size, (255, 40, 40)), out, over).save(sys.argv[3])
print(json.dumps({'mean': round(mean, 4), 'max': mx, 'pct_over_8': round(pct, 4), 'pixels': n}))
