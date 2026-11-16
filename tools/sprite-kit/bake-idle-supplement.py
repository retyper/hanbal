"""Use three authored idle drawings; preserve every existing combat/run frame."""
import hashlib
import json
from pathlib import Path
import numpy as np
from PIL import Image,ImageDraw
from scipy import ndimage
ROOT=Path(__file__).resolve().parents[2]
SOURCE=ROOT/'tools/sprite-kit/idle-frames-20261113/aryeong-idle-master.png'
CONFIG=json.loads(SOURCE.with_name('idle-config.json').read_text('utf-8'))

def apply(out,report,key='aryeong'):
    cfg=CONFIG[key];source=SOURCE.with_name(cfg['file'])
    columns=cfg['columns'];wanted_row=cfg['row'];selected=cfg['selected']
    cycle=[0,1,0,1] if len(selected)==2 else [0,1,2,1]
    im=Image.open(source).convert('RGBA'); a=np.array(im)
    labels,_=ndimage.label(a[...,3]>64,structure=np.ones((3,3)))
    parts={}
    for label,region in enumerate(ndimage.find_objects(labels),1):
        if region is None:continue
        mask=labels==label
        if mask.sum()<1000:continue
        ys,xs=np.nonzero(mask)
        col=int(xs.mean()/(im.width/columns)); row=int(ys.mean()/(im.height/cfg['rows']))
        if row==wanted_row and col in selected:parts.setdefault(col,[]).append(mask)
    assert set(parts)==set(selected),'Missing authored idle poses'
    raw=[]
    for i in selected:
        mask=np.logical_or.reduce(parts[i]); rgba=a.copy()
        rgba[~ndimage.binary_dilation(mask,iterations=2),3]=0
        box=Image.fromarray(rgba).getbbox()
        assert box and box[0]>1 and box[1]>1 and box[2]<im.width-1,'Clipped source'
        raw.append(Image.fromarray(rgba).crop(box))
    w,h=report['cell']; scale=report['bodyPx']/max(f.height for f in raw)
    frames=[]
    for f in raw:
        f=f.resize((round(f.width*scale),round(f.height*scale)),Image.Resampling.LANCZOS)
        # A shared grounded anchor keeps the planted feet still, not the weapon centroid.
        mask=np.array(f)[...,3]>64
        ys,xs=np.nonzero(mask[-max(2,round(f.height*.06)):])
        anchor=(int(xs.min())+int(xs.max())+1)/2
        x=round(w/2-anchor); y=report['feet']-f.height
        assert x>1 and x+f.width<w-1 and y>1,'Clipped idle frame'
        canvas=Image.new('RGBA',(w,h));canvas.alpha_composite(f,(x,y));frames.append(canvas)
    assert len({f.tobytes() for f in frames})==len(selected),'Idle drawings must differ'
    main=Image.open(out/f'gen-{key}.png').convert('RGBA')
    for i,pose in enumerate(cycle):main.paste(frames[pose],(i*w,0))
    main.save(out/f'gen-{key}.png')
    base=20 if key=='haebi' else 16
    old=Image.open(out/(f'gen-{key}.png' if key=='haebi' else f'duel-{key}.png')).convert('RGBA')
    duel=Image.new('RGBA',(w*(base+len(frames)),h));duel.paste(old,(0,0))
    for i,f in enumerate(frames):duel.paste(f,((base+i)*w,0))
    duel.save(out/f'duel-{key}.png')
    report['duelCells']=base+len(frames);report['idleMasterPoses']=[selected[i] for i in cycle]
    report['idleDrawnFrames']=len(frames);report['generationCalls']=2
    report['sources'][source.relative_to(ROOT).as_posix()]=hashlib.sha256(source.read_bytes()).hexdigest()
    for i,pose in enumerate(cycle):report['frames'][i]={**report['frames'][i],'idleSupplementPose':selected[pose],'faceRetouch':False}
    contact=Image.new('RGB',(w*3*len(frames),h*3+24),'#293b44')
    gif=[]
    for i,f in enumerate(frames):
        f=f.resize((w*3,h*3),Image.Resampling.NEAREST);contact.paste(f,(i*w*3,24),f)
        bg=Image.new('RGB',f.size,'#293b44');bg.paste(f,mask=f.getchannel('A'));gif.append(bg)
    ImageDraw.Draw(contact).text((4,4),'Authored idle A / B / C',fill='white')
    contact.save(out/f'{key}-idle-contact.png')
    gif[0].save(out/f'{key}-idle.gif',save_all=True,append_images=[gif[i] for i in cycle[1:]],duration=650,loop=0)
    return report
