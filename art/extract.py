"""Extract character cut-outs from the reference comic panels -> public/avatars/<id>.png (RGBA, trimmed)."""
from PIL import Image
from rembg import remove, new_session
import sys
R = 'art/refs/'
# id: (file, box(l,t,r,b), erase rects relative to crop [(l,t,r,b)...])
CHARS = {
  'volt':   ('23853400-image.png', (330, 590, 640, 1240), []),
  'blaze':  ('1b9a636d-image.png', (680, 800, 1055, 1380), [(0, 380, 110, 540), (140, 470, 375, 580)]),
  'kai':    ('1b9a636d-image.png', (700, 540, 1055, 830), []),          # ninja boy (bust)
  'terra':  ('23853400-image.png', (650, 840, 970, 1270), []),          # soil ninja
  'bolt':   ('23853400-image.png', (20, 860, 340, 1290), []),           # robot
  'hammer': ('9eb4fd45-image.png', (760, 230, 1055, 720), []),          # villain
}
sess = new_session('u2net')
only = sys.argv[1:] 
for cid, (f, box, erase) in CHARS.items():
    if only and cid not in only: continue
    im = Image.open(R + f).convert('RGBA').crop(box)
    out = remove(im, session=sess, alpha_matting=False, post_process_mask=True)
    px = out.load()
    for (l, t, r, b) in erase:
        for y in range(t, min(b, out.height)):
            for x in range(l, min(r, out.width)):
                px[x, y] = (0, 0, 0, 0)
    bbox = out.getbbox()
    out = out.crop(bbox)
    out.save(f'public/avatars/{cid}.png', optimize=True)
    print(cid, out.size)
