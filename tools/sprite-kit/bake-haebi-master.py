"""Bake the generated Haebi master once, preserving its face and transparency.
No face painting, palette replacement, outline growth, stretching or AI calls.
py -3 tools/sprite-kit/bake-haebi-master.py --out <directory>
"""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'tools/sprite-kit/masters/haebi-20261113.png'
# idle x4, three supplied run poses, ready/raise/chop/recovery, hurt, defeated
ORDER = [0]*4 + [1, 3, 2, 3, 1, 3, 2, 3] + [0, 4, 5, 5, 6, 0, 7, 8]


def bake(out, height=160, body=140):
    source = Image.open(SOURCE).convert('RGBA')
    a = np.array(source)
    labels, _ = ndimage.label(a[..., 3] > 64, structure=np.ones((3, 3)))
    parts = {}
    for label, region in enumerate(ndimage.find_objects(labels), 1):
        if region is None:
            continue
        mask = labels == label
        if mask.sum() < 1000:
            continue
        ys, xs = np.nonzero(mask)
        col = min(2, int(xs.mean() / (source.width / 3)))
        row = min(2, int(ys.mean() / (source.height / 3)))
        index = row * 3 + col
        if index in parts:
            raise ValueError('Ambiguous figure assignment')
        # Include original semi-transparent edge pixels around this figure.
        keep = ndimage.binary_dilation(mask, iterations=2)
        rgba = a.copy()
        rgba[~keep, 3] = 0
        box = Image.fromarray(rgba).getbbox()
        if box is None or box[0] < 2 or box[1] < 2 or box[2] > source.width-2 or box[3] > source.height-2:
            raise ValueError('Master silhouette reaches canvas edge')
        parts[index] = (Image.fromarray(rgba).crop(box), box, float(xs.mean()))
    if set(parts) != set(range(9)):
        raise ValueError('Expected exactly nine separated figures')
    scale = min(body / parts[0][0].height, (height-8) / max(p[0].height for p in parts.values()))
    half = max(max(cx-box[0], box[2]-cx)*scale for _, box, cx in parts.values())
    width = int(np.ceil((half*2+12)/8)*8)
    frames = []
    frame_report = []
    for index in ORDER:
        im, box, cx = parts[index]
        im = im.resize((round(im.width*scale), round(im.height*scale)), Image.Resampling.LANCZOS)
        x = round(width/2 - (cx-box[0])*scale)
        y = height-4-im.height
        if x < 2 or x+im.width > width-2 or y < 2:
            raise ValueError('Frame would crop the original silhouette')
        frame = Image.new('RGBA', (width, height))
        frame.alpha_composite(im, (x,y))
        frames.append(frame)
        frame_report.append({'masterPose':index+1, 'sourceBox':box, 'offset':[x,y], 'faceRetouch':False})
    sheet = Image.new('RGBA', (width*20, height))
    for i, frame in enumerate(frames):
        sheet.paste(frame, (i*width,0))
    out.mkdir(parents=True, exist_ok=True)
    sheet.save(out/'gen-haebi.png')
    contact = Image.new('RGB', (width*2*5, (height*2+24)*4), '#293b44')
    d=ImageDraw.Draw(contact)
    for i,frame in enumerate(frames):
        x,y=i%5*width*2,i//5*(height*2+24)
        f=frame.resize((width*2,height*2),Image.Resampling.NEAREST)
        contact.paste(f,(x,y+24),f)
        d.text((x+8,y+6),f'{i} / source {ORDER[i]+1}',fill='white')
    contact.save(out/'haebi-contact.png')
    # Assert exact idle identity and stable material; no generated deformation.
    for i in [1,2,3,12,17]:
        assert frames[i].tobytes() == frames[0].tobytes()
    alpha=np.array(frames[0])[...,3]>64
    ys=np.where(alpha.any(axis=1))[0]
    attack=np.array(frames[14])[...,3]>64
    tip_x=int(np.where(attack.any(axis=0))[0].max())
    tip_y=float(np.where(attack[:,tip_x])[0].mean())
    report={'sources':{str(SOURCE.relative_to(ROOT)).replace('\\','/'):hashlib.sha256(SOURCE.read_bytes()).hexdigest()},
            'cell':[width,height], 'feet':int(ys[-1]+1), 'bodyPx':int(ys[-1]-ys[0]+1), 'cells':20, 'kind':'general',
            'generationCalls':1, 'faceRetouch':False, 'idleStretch':False, 'frames':frame_report,
            'contact':[14,round(tip_x/width,2),round(tip_y/height,2)]}
    spec=importlib.util.spec_from_file_location('idle_supplement',Path(__file__).with_name('bake-idle-supplement.py'))
    module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
    if 'haebi' in module.CONFIG:report=module.apply(out,report,'haebi')
    (out/'haebi-report.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    print(json.dumps({k:report[k] for k in ['cell','bodyPx','contact']}))
    return report


if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--out',required=True,type=Path)
    args=parser.parse_args()
    bake(args.out)
