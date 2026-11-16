"""Bake the hand-made bandit-warlord 3x3 master into a 20-cell strip (160px tall).
No stretching or repainting; one common scale, feet on a common baseline,
horizontally centred on the feet (bottom band of the silhouette).
py -3 -I tools/sprite-kit/bake-bandit-warlord.py [--contact <png>]
Source poses: 1 idle, 2-4 walk, 5 wind-up, 6 slam, 7 recover, 8 hurt, 9 defeated. Faces right.
"""
import argparse, json
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'tools/sprite-kit/masters/bandit-warlord-20261115.png'
OUT = ROOT / 'public/realm/anim-px/bandit-warlord.png'
ORDER = [0]*4 + [1, 3, 2, 3, 1, 3, 2, 3] + [0, 4, 5, 5, 6, 0, 7, 8]
HEIGHT, BODY, BASE_PAD, FOOT_BAND = 160, 140, 4, 0.12


def bake(contact=None):
    src = Image.open(SOURCE).convert('RGBA')
    a = np.array(src)
    labels, _ = ndimage.label(a[..., 3] > 64, structure=np.ones((3, 3)))
    parts = {}
    for lab, reg in enumerate(ndimage.find_objects(labels), 1):
        if reg is None:
            continue
        mask = labels == lab
        if mask.sum() < 1000:
            continue
        ys, xs = np.nonzero(mask)
        idx = min(2, int(ys.mean()/(src.height/3)))*3 + min(2, int(xs.mean()/(src.width/3)))
        if idx in parts:
            raise ValueError('ambiguous figure')
        keep = ndimage.binary_dilation(mask, iterations=2)
        rgba = a.copy(); rgba[~keep, 3] = 0
        im = Image.fromarray(rgba); box = im.getbbox()
        if box[0] < 2 or box[1] < 2 or box[2] > src.width-2 or box[3] > src.height-2:
            raise ValueError('touches canvas edge')
        # foot centre: mean x of the lowest band of the silhouette
        h = ys.max()-ys.min()+1
        low = ys > ys.max()-h*FOOT_BAND
        fx = float(xs[low].mean())
        parts[idx] = (im.crop(box), box, fx)
    if set(parts) != set(range(9)):
        raise ValueError('need nine figures, got %s' % sorted(parts))
    scale = min(BODY/parts[0][0].height, (HEIGHT-BASE_PAD*2)/max(p[0].height for p in parts.values()))
    half = max(max(fx-b[0], b[2]-fx)*scale for _, b, fx in parts.values())
    width = int(np.ceil((half*2+12)/8)*8)
    frames, rep = [], []
    for i in ORDER:
        im, box, fx = parts[i]
        im = im.resize((round(im.width*scale), round(im.height*scale)), Image.Resampling.LANCZOS)
        x = round(width/2-(fx-box[0])*scale); y = HEIGHT-BASE_PAD-im.height
        if x < 1 or x+im.width > width-1 or y < 1:
            raise ValueError('frame crops')
        f = Image.new('RGBA', (width, HEIGHT)); f.alpha_composite(im, (x, y))
        frames.append(f); rep.append([i+1, x, y])
    sheet = Image.new('RGBA', (width*20, HEIGHT))
    for k, f in enumerate(frames):
        sheet.paste(f, (k*width, 0))
    OUT.parent.mkdir(parents=True, exist_ok=True); sheet.save(OUT)
    al = np.array(frames[0])[..., 3] > 64
    ys = np.where(al.any(axis=1))[0]
    r = {'size': sheet.size, 'cell': [width, HEIGHT], 'feet': int(ys[-1]+1), 'bodyPx': int(ys[-1]-ys[0]+1), 'scale': round(scale, 4)}
    print(json.dumps(r))
    if contact:
        c = Image.new('RGB', (width*2*5, (HEIGHT*2+24)*4), '#293b44'); d = ImageDraw.Draw(c)
        for k, f in enumerate(frames):
            x, y = k % 5*width*2, k//5*(HEIGHT*2+24)
            g = f.resize((width*2, HEIGHT*2), Image.Resampling.NEAREST)
            c.paste(g, (x, y+24), g)
            d.rectangle([x, y+24, x+width*2-1, y+24+HEIGHT*2-1], outline='#ffd400')
            d.line([x, y+24+(HEIGHT-BASE_PAD)*2, x+width*2, y+24+(HEIGHT-BASE_PAD)*2], fill='#ff4040')
            d.text((x+8, y+6), f'{k} / src {ORDER[k]+1}', fill='white')
        c.save(contact)


if __name__ == '__main__':
    p = argparse.ArgumentParser(); p.add_argument('--contact', type=Path)
    bake(p.parse_args().contact)
