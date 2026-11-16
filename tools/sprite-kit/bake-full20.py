"""Bake reviewed 4x5 sheets without warping/repainting any face or weapon."""
from pathlib import Path
import hashlib,json,importlib.util
import numpy as np
from PIL import Image,ImageDraw
from scipy import ndimage
ROOT=Path(__file__).resolve().parents[2]
HERE=Path(__file__).resolve().with_name('nonawakened-20261113')
MAIN=[0,1,2,1,3,4,5,6,7,8,3,4,0,10,11,12,13,0,18,19]
ATLAS=dict(cells=20,idle=[0,1,2,1],idleMs=650,attack=[9,10,11,12,13,0],windup=[0,10],guard=[15,14],stagger=[16,17],hit=18,dead=19)

def bake(out,key):
    job=next(j for j in json.loads((HERE/'queue.json').read_text('utf-8')) if j['key']==key)
    main=list(MAIN)
    for dest,pose in job.get('mainSourceOverrides',{}).items():
        assert 0<=int(dest)<20 and isinstance(pose,int) and 0<=pose<20,'Invalid reviewed pose remap'
        main[int(dest)]=pose
    source=HERE/f'{key}-master.png'
    im=Image.open(source).convert('RGBA');a=np.array(im)
    labels,_=ndimage.label(a[...,3]>64,structure=np.ones((3,3)))
    pieces={}
    for label,region in enumerate(ndimage.find_objects(labels),1):
        if region is None:continue
        ys,xs=np.nonzero(labels==label)
        if len(xs)<90:continue
        index=min(4,int(ys.mean()/(im.height/5)))*4+min(3,int(xs.mean()/(im.width/4)))
        pieces.setdefault(index,[]).append(label)
    if set(pieces)!=set(range(20)):raise ValueError(f'Expected 20 figures, got {sorted(pieces)}')
    parts=[]
    for i in range(20):
        mask=np.isin(labels,pieces[i]);ys,xs=np.nonzero(mask)
        box=[int(xs.min()),int(ys.min()),int(xs.max()+1),int(ys.max()+1)]
        margin=job.get('sourceEdgeMargin',2)
        assert margin in [1,2],'A transparent border is required; never accept actual edge clipping'
        if box[0]<margin or box[1]<margin or box[2]>im.width-margin or box[3]>im.height-margin:raise ValueError(f'Canvas clipping pose {i}')
        rgba=a.copy();rgba[~ndimage.binary_dilation(mask,iterations=2),3]=0
        parts.append((Image.fromarray(rgba).crop(box),box,float(xs.mean())))
    scale=min(138/parts[0][0].height,150/max(p[0].height for p in parts))
    patch_report={};patch_source=None;raw_patch={}
    if job.get('reviewedPosePatch'):
        cfg=job['reviewedPosePatch'];patch_source=ROOT/cfg['file']
        spec=importlib.util.spec_from_file_location('patch_parts',ROOT/'tools/sprite-kit/patch-parts.py');mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
        patch_parts=mod.four_parts(patch_source)
        factor=parts[0][0].height/patch_parts[cfg.get('anchor',3)][0].height
        assert .1<factor<4,'Patch anchor scale outside reviewed limits'
        for index,patch_index in cfg['poses'].items():
            i=int(index);assert 0<=i<20 and 0<=patch_index<4
            part,box,cx=patch_parts[patch_index]
            raw_patch[i]=(part,factor)
            part=part.resize((round(part.width*factor),round(part.height*factor)),Image.Resampling.LANCZOS)
            parts[i]=(part,[0,0,part.width,part.height],(cx-box[0])*factor)
            patch_report[i]=dict(patchSource=cfg['file'],patchPose=patch_index+1,patchSourceBox=box,anchorScale=factor)
    half=max(max(cx-box[0],box[2]-cx)*scale for _,box,cx in parts)
    width=int(np.ceil((half*2+16)/8)*8);frames=[];reports=[]
    for i,(part,box,cx) in enumerate(parts):
        if i in raw_patch:
            raw,factor=raw_patch[i]
            part=raw.resize((round(raw.width*factor*scale),round(raw.height*factor*scale)),Image.Resampling.LANCZOS)
        else:part=part.resize((round(part.width*scale),round(part.height*scale)),Image.Resampling.LANCZOS)
        x=round(width/2-(cx-box[0])*scale);y=156-part.height
        if x<3 or x+part.width>width-3 or y<3:raise ValueError(f'Clipped normalized pose {i}')
        f=Image.new('RGBA',(width,160));f.alpha_composite(part,(x,y));frames.append(f)
        reports.append(dict(masterPose=i+1,sourceBox=box,offset=[x,y],faceRetouch=False,**patch_report.get(i,{})))
    assert len({f.tobytes() for f in frames[:3]})==3,'Missing distinct authored idle'
    out.mkdir(parents=True,exist_ok=True)
    for name,order in [(f'gen-{key}.png',main),(f'duel-{key}.png',range(20))]:
        strip=Image.new('RGBA',(width*20,160))
        for col,index in enumerate(order):strip.paste(frames[index],(col*width,0))
        strip.save(out/name)
    contact=Image.new('RGB',(width*8,5*344),'#293b44');d=ImageDraw.Draw(contact)
    for i,f in enumerate(frames):
        x=i%4*width*2;y=i//4*344;contact.paste(f.resize((width*2,320),Image.Resampling.NEAREST),(x,y),f.resize((width*2,320),Image.Resampling.NEAREST));d.text((x+5,y+322),str(i+1),fill='white')
    contact.save(out/f'{key}-contact.png')
    bow=job['weapon']=='bow'
    attack=np.array(frames[12 if bow else 11])[...,3]>64;tx=int(np.where(attack.any(axis=0))[0].max());ty=float(np.where(attack[:,tx])[0].mean())
    atlas={**ATLAS,**job.get('atlasOverrides',{})}
    sources={source.relative_to(ROOT).as_posix():hashlib.sha256(source.read_bytes()).hexdigest()}
    if patch_source:sources[patch_source.relative_to(ROOT).as_posix()]=hashlib.sha256(patch_source.read_bytes()).hexdigest()
    report=dict(sources=sources,
        cell=[width,160],feet=frames[0].getbbox()[3],bodyPx=frames[0].getbbox()[3]-frames[0].getbbox()[1],cells=20,kind='general',generationCalls=1,correctionCalls=job.get('correctionCalls',0),
        faceRetouch=False,idleStretch=False,idleDrawnFrames=3,frames=[reports[i] for i in main],
        contact=[15 if bow else 14,round(tx/width,2),round(ty/160,2)],duelCells=20,duelAtlas=atlas,excludedMasterPoses=job.get('excludedMasterPoses',[]))
    (out/f'{key}-report.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    return report
