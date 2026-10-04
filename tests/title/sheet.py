# Contact sheets from tests/title/shoot.mjs's full-frame shots: shots/title/contact-all.png (names x faces) and
# contact-<face>.png (that face, every name, larger). python3 tests/title/sheet.py
import os, sys
from PIL import Image, ImageDraw, ImageFont
D = os.path.join(os.path.dirname(__file__), '../../shots/title')
NAMES = ['hither', 'aloud', 'bidden', 'parley', 'murmur', 'folkmoot', 'orison', 'tellus']
FONTS = ['sinistre', 'cantique', 'melodrama', 'lineal', 'aujournuit']
def font(sz):
    for p in ['/System/Library/Fonts/Supplemental/Arial.ttf', '/Library/Fonts/Arial.ttf']:
        if os.path.exists(p): return ImageFont.truetype(p, sz)
    return ImageFont.load_default()
def crop(im):  # the lower-middle band where the type sits + the planet above it
    w, h = im.size; return im.crop((int(w * .2), int(h * .04), int(w * .8), int(h * .985)))
def grid(rows, cols, get, cw, label_r, label_c, out, pad=8, lw=110, th=28):
    ch = None; tiles = {}
    for r in rows:
        for c in cols:
            p = get(r, c)
            if not os.path.exists(p): continue
            im = crop(Image.open(p).convert('RGB')); im = im.resize((cw, int(cw * im.size[1] / im.size[0])), Image.LANCZOS); ch = im.size[1]; tiles[(r, c)] = im
    W = lw + len(cols) * (cw + pad) + pad; H = th + len(rows) * (ch + pad) + pad
    sheet = Image.new('RGB', (W, H), (6, 8, 20)); d = ImageDraw.Draw(sheet); f = font(15)
    for j, c in enumerate(cols): d.text((lw + j * (cw + pad) + cw // 2, 8), label_c(c), fill=(214, 189, 134), font=f, anchor='mt')
    for i, r in enumerate(rows):
        d.text((lw - 10, th + i * (ch + pad) + ch // 2), label_r(r), fill=(214, 189, 134), font=f, anchor='rm')
        for j, c in enumerate(cols):
            if (r, c) in tiles: sheet.paste(tiles[(r, c)], (lw + j * (cw + pad), th + i * (ch + pad)))
    sheet.save(out); print(out, sheet.size)
grid(NAMES, FONTS, lambda n, f: f'{D}/{n}-{f}.png', 300, str.upper, str.upper, f'{D}/contact-all.png')
for f in FONTS:
    grid([0, 1], [0, 1, 2, 3], lambda r, c: f'{D}/{NAMES[r * 4 + c]}-{f}.png', 520, lambda r: '', lambda c: '', f'{D}/contact-{f}.png', lw=8, th=8)
