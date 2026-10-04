# contact sheet of a frame strip: python3 sheet.py DIR COLS SCALE
import sys, os
from PIL import Image, ImageDraw
d, cols, sc = sys.argv[1], int(sys.argv[2]), float(sys.argv[3])
fs = sorted(f for f in os.listdir(d) if f[0].isdigit() and f.endswith('.png'))
crop = tuple(map(int, sys.argv[4].split(','))) if len(sys.argv) > 4 else None
ims = [Image.open(os.path.join(d, f)).convert('RGB') for f in fs]
if crop: ims = [im.crop(crop) for im in ims]
w, h = int(ims[0].width * sc), int(ims[0].height * sc)
rows = (len(ims) + cols - 1) // cols
S = Image.new('RGB', (cols * w + (cols + 1) * 4, rows * h + (rows + 1) * 4), (40, 40, 48))
for i, im in enumerate(ims):
    r, c = divmod(i, cols); x, y = 4 + c * (w + 4), 4 + r * (h + 4)
    S.paste(im.resize((w, h), Image.LANCZOS), (x, y)); ImageDraw.Draw(S).text((x + 4, y + 2), fs[i][:2], fill=(255, 40, 40))
S.save(os.path.join(d, 'sheet.png')); print(os.path.join(d, 'sheet.png'))
