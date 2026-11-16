"""Extract connected figures across grid borders; never repaint faces or stretch poses."""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'tools/sprite-kit/masters/aryeong-20261113.png'
# Source 7 omits the spearhead: use the intact raised guard as anticipation.
ORDER = [0]*4 + [1,2,3,4,1,2,3,4] + [0,10,7,8,9,0,14,15]

def bake(out, height=160, body=140, key="aryeong"):
    variants_path=SOURCE.with_name('proportion-v2.json')
    variant=json.loads(variants_path.read_text('utf-8')).get(key) if variants_path.exists() else None
    source_path = SOURCE if key == "aryeong" else SOURCE.with_name(f"{key}-20261113.png")
    legacy = key in ("aryeong", "soseono", "heo", "gamsil")
    order = ORDER if legacy else [0]*4+[1,2,3,4,1,2,3,4]+[0,6,7,8,9,0,14,15]
    if variant:
        source_path=SOURCE.with_name(variant['file']);order=variant['order']
    source = Image.open(source_path).convert('RGBA')
    a = np.array(source)
    labels, _ = ndimage.label(a[...,3] > 64, structure=np.ones((3,3)))
    parts = {}; groups = {}
    for label, region in enumerate(ndimage.find_objects(labels), 1):
        if region is None: continue
        mask = labels == label
        if mask.sum() < 1000: continue
        ys, xs = np.nonzero(mask)
        index = min(3,int(ys.mean()/(source.height/4)))*4 + min(3,int(xs.mean()/(source.width/4)))
        groups.setdefault(index,[]).append(mask)
    for index, masks in groups.items():
        # A defeated figure may lay its disconnected weapon beside the body.
        # Merge same-cell pieces but anchor on the largest body, not the weapon.
        primary=max(masks,key=lambda m:int(m.sum()))
        mask=np.logical_or.reduce(masks)
        ys,xs=np.nonzero(primary)
        rgba=a.copy()
        rgba[~ndimage.binary_dilation(mask,iterations=2),3]=0
        box=Image.fromarray(rgba).getbbox()
        if box is None or box[0]<1 or box[1]<1 or box[2]>=source.width or box[3]>=source.height:
            raise ValueError('Source silhouette reaches canvas boundary')
        parts[index]=(Image.fromarray(rgba).crop(box),box,float(xs.mean()))
    if set(parts) != set(range(16)): raise ValueError('Expected sixteen separated figures')
    scale = min(body/parts[0][0].height,(height-8)/max(p[0].height for p in parts.values()))
    half = max(max(cx-box[0],box[2]-cx)*scale for _,box,cx in parts.values())
    width = int(np.ceil((half*2+12)/8)*8)
    frames=[]; reports=[]
    for i in range(16):
        im,box,cx=parts[i]
        im=im.resize((round(im.width*scale),round(im.height*scale)),Image.Resampling.LANCZOS)
        x=round(width/2-(cx-box[0])*scale); y=height-4-im.height
        if x<2 or x+im.width>width-2 or y<2: raise ValueError('Clipped frame')
        frame=Image.new('RGBA',(width,height));frame.alpha_composite(im,(x,y));frames.append(frame)
        reports.append({'masterPose':i+1,'sourceBox':box,'offset':[x,y],'faceRetouch':False})
    out.mkdir(parents=True,exist_ok=True)
    def strip(order,path):
        sheet=Image.new('RGBA',(width*len(order),height))
        for col,i in enumerate(order): sheet.paste(frames[i],(col*width,0))
        sheet.save(path)
    strip(order,out/f'gen-{key}.png')
    # Preserve all source poses for inspection; runtime never selects bad pose 7.
    strip(list(range(16)),out/f'duel-{key}.png')
    contact=Image.new('RGB',(width*2*4,(height*2+24)*4),'#293b44');d=ImageDraw.Draw(contact)
    for i,f in enumerate(frames):
        x=i%4*width*2;y=i//4*(height*2+24)
        f=f.resize((width*2,height*2),Image.Resampling.NEAREST);contact.paste(f,(x,y+24),f)
        d.text((x+8,y+6),f'{i+1}'+(' UNUSED anticipation' if i==6 and legacy else ''),fill='white')
    contact.save(out/f'{key}-contact.png')
    alpha=np.array(frames[0])[...,3]>64;ys=np.where(alpha.any(axis=1))[0]
    attack=np.array(frames[variant['contactPose'] if variant else 7])[...,3]>64;tx=int(np.where(attack.any(axis=0))[0].max());ty=float(np.where(attack[:,tx])[0].mean())
    report={'sources':{str(source_path.relative_to(ROOT)).replace('\\','/'):hashlib.sha256(source_path.read_bytes()).hexdigest()},
      'cell':[width,height],'feet':int(ys[-1]+1),'bodyPx':int(ys[-1]-ys[0]+1),'cells':20,'kind':'general',
      'generationCalls':1,'faceRetouch':False,'idleStretch':False,'frames':[reports[i] for i in order],
      'contact':[14,round(tx/width,2),round(ty/height,2)],'duelCells':16,'excludedMasterPoses':([7] if legacy else [])}
    if variant:
        report['idleDrawnFrames']=variant['idleDrawnFrames'];report['proportionReference']='aryeong/haebi/soseono'
        report['feet']=frames[0].getbbox()[3]
        report['variantSpec']=variant
    elif key in json.loads(Path(__file__).with_name('idle-frames-20261113').joinpath('idle-config.json').read_text('utf-8')):
        spec=importlib.util.spec_from_file_location('idle_supplement',Path(__file__).with_name('bake-idle-supplement.py'))
        module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
        report=module.apply(out,report,key)
    (out/f'{key}-report.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    print(json.dumps({k:report[k] for k in ['cell','bodyPx','contact']}))
    return report

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--out',required=True,type=Path)
    bake(parser.parse_args().out)
