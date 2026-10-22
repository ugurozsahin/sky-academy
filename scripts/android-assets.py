#!/usr/bin/env python3
"""Generate the Android launcher icons and splash screens from the game's 賢 (wise) mark (issues #53, #2136).
Run after `npx cap add android` or whenever the mark changes: python3 scripts/android-assets.py
Needs Pillow (`pip install pillow`) and a CJK font with the mark (Debian/Ubuntu: fonts-noto-cjk;
macOS: Hiragino Kaku Gothic W6, which ships with the system)."""
from PIL import Image, ImageDraw, ImageFont
import os
RES = 'android/app/src/main/res'
BG, FG = '#131a33', '#3ec9ff'
MARK = '賢'
# Bold, not Black: 賢 has 16 strokes, and a heavier weight fills its counters at 48 dp (#2136).
FONTS = ['/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc', '/System/Library/Fonts/ヒラギノ角ゴシック W6.ttc']
FONT = next((f for f in FONTS if os.path.exists(f)), None)
if not FONT: raise SystemExit('No CJK font found — install fonts-noto-cjk (or edit FONTS)')
def ink(ch):
    im = Image.new('L', (96, 96)); ImageDraw.Draw(im).text((8, 8), ch, font=ImageFont.truetype(FONT, 64), fill=255); return im.tobytes()
if ink(MARK) == ink('\U000F0000'):   # assumes the font has no glyph at U+F0000 (true of Noto CJK and Hiragino); a font without the glyph draws the same missing-glyph box for both
    raise SystemExit(f'{FONT} has no glyph for {MARK} — pick another font in FONTS')

def mark(size, pad=0.0, circle=True):
    im = Image.new('RGBA', (size, size), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    if circle: d.ellipse([pad * size, pad * size, size - pad * size, size - pad * size], fill=BG)
    f = ImageFont.truetype(FONT, int(size * (0.6 - pad * 0.6)))
    box = d.textbbox((0, 0), MARK, font=f, anchor='lt'); w, h = box[2] - box[0], box[3] - box[1]
    d.text(((size - w) / 2 - box[0], (size - h) / 2 - box[1]), MARK, font=f, fill=FG, anchor='lt')   # same anchor as the box: centred
    return im

DENS = {'mdpi': 1, 'hdpi': 1.5, 'xhdpi': 2, 'xxhdpi': 3, 'xxxhdpi': 4}
for d, k in DENS.items():
    n = int(48 * k); folder = f'{RES}/mipmap-{d}'; os.makedirs(folder, exist_ok=True)
    mark(n).save(f'{folder}/ic_launcher.png'); mark(n).save(f'{folder}/ic_launcher_round.png')
    fg = Image.new('RGBA', (int(108 * k), int(108 * k)), (0, 0, 0, 0)); m = mark(int(72 * k), circle=False)   # adaptive: safe zone is the middle 66 %
    fg.paste(m, ((fg.width - m.width) // 2, (fg.height - m.height) // 2), m); fg.save(f'{folder}/ic_launcher_foreground.png')
open(f'{RES}/values/ic_launcher_background.xml', 'w').write(f'<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">{BG}</color>\n</resources>\n')
for folder in [x for x in os.listdir(RES) if x.startswith('drawable')]:
    p = f'{RES}/{folder}/splash.png'
    if not os.path.exists(p): continue
    w, h = Image.open(p).size
    im = Image.new('RGB', (w, h), BG); m = mark(int(min(w, h) * 0.32), circle=False); im.paste(m, ((w - m.width) // 2, (h - m.height) // 2), m); im.save(p)
print('icons + splash written to', RES)
