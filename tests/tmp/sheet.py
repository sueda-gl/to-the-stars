import sys, glob
from PIL import Image, ImageDraw
pre, out = sys.argv[1], sys.argv[2]; cols = int(sys.argv[3]) if len(sys.argv) > 3 else 6
fs = sorted(glob.glob(pre + '[0-9][0-9].jpg'))
W, H = 360, 225
rows = (len(fs) + cols - 1) // cols
S = Image.new('RGB', (W * cols, H * rows))
for k, f in enumerate(fs):
    im = Image.open(f).resize((W, H)); d = ImageDraw.Draw(im); d.text((6, 6), '%.2fs' % (k * float(sys.argv[4]) if len(sys.argv) > 4 else k * 0.5), fill=(255, 255, 0))
    S.paste(im, ((k % cols) * W, (k // cols) * H))
S.save(out)
