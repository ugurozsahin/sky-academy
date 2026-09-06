#!/usr/bin/env python3
"""Generate the Android launcher icons and splash screens from the game's 忍 mark (issue #53).
Run after `npx cap add android` or whenever the mark changes: python3 scripts/android-assets.py
Needs Pillow (`pip install pillow`) and a Noto CJK font (Debian/Ubuntu: fonts-noto-cjk; macOS uses Hiragino)."""
from PIL import Image, ImageDraw, ImageFont
import os
RES = 'android/app/src/main/res'
BG, FG = '#131a33', '#3ec9ff'
FONTS = ['/usr/share/fonts/opentype/noto/NotoSansCJK-Black.ttc', '/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc', '/System/Library/Fonts/Hiragino Sans GB.ttc']
FONT = next((f for f in FONTS if os.path.exists(f)), None)
if not FONT: raise SystemExit('No CJK font found — install fonts-noto-cjk (or edit FONTS)')

def mark(size, pad=0.0, circle=True):
    im = Image.new('RGBA', (size, size), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    if circle: d.ellipse([pad * size, pad * size, size - pad * size, size - pad * size], fill=BG)
    f = ImageFont.truetype(FONT, int(size * (0.52 - pad * 0.6)))
    box = d.textbbox((0, 0), '忍', font=f, anchor='lt'); w, h = box[2] - box[0], box[3] - box[1]
    d.text(((size - w) / 2 - box[0], (size - h) / 2 - box[1] + size * 0.02), '忍', font=f, fill=FG)
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
