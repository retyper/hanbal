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
# 11-17 얼굴 크기 다시(prop-intake.py): 걷기 8칸 판(4x2)이 따로 오면 본편 띠 걷기 4~11칸을 그 8컷으로 채운다.
# 대결 띠(duel)는 걷기를 안 쓰므로 동작 판 20컷 그대로.
WALK_MAIN=list(range(20,28))
# 띠 차례 판의 대결 칸 (fighter-motion LEGACY_ATLAS 와 같은 자리 · 막기는 당김 칸 · 비틀은 맞음 칸)
STRIP_ATLAS=dict(cells=20,idle=[0,1,2,3],idleMs=650,attack=[12,13,14,15,16,17],windup=[12,13],guard=[13],stagger=[18],hit=18,dead=19)
THIN=4  # 두께가 이 픽셀(160 칸 기준)보다 가는 창 자루·활 끝·깃털은 키 견줄 때 뺀다

def figures(path,cols,rows):
    """투명 판에서 칸마다 사람 하나(이은 덩어리 묶음)를 찾는다. 반환: (Image, labels, {칸: [label]})"""
    im=Image.open(path).convert('RGBA');a=np.array(im)
    labels,_=ndimage.label(a[...,3]>64,structure=np.ones((3,3)))
    pieces={}
    for label,region in enumerate(ndimage.find_objects(labels),1):
        if region is None:continue
        ys,xs=np.nonzero(labels[region]==label)
        if len(xs)<90:continue
        ys=ys+region[0].start;xs=xs+region[1].start
        index=min(rows-1,int(ys.mean()/(im.height/rows)))*cols+min(cols-1,int(xs.mean()/(im.width/cols)))
        pieces.setdefault(index,[]).append(label)
    return im,labels,pieces

def core_height(part,unit):
    """가는 무기·장식을 깎아 낸 몸 덩어리 키 (unit = 이 판에서 160칸 1px 에 해당하는 원본 px)"""
    m=np.array(part)[...,3]>64;r=max(1,round(THIN*unit/2))
    o=ndimage.binary_opening(m,structure=np.ones((2*r+1,2*r+1)))
    ys=np.where(o.any(1))[0]
    return float(ys[-1]-ys[0]+1) if len(ys) else float(m.shape[0])

def bake(out,key,job=None):
    job=job or next(j for j in json.loads((HERE/'queue.json').read_text('utf-8')) if j['key']==key)
    stripOrder=job.get("sheetOrder")=="strip"  # 11-17: 판이 본편 띠 차례(서기4·걷기8·공격6·맞음·누움)로 그려져 왔다
    main=list(range(20)) if stripOrder else list(MAIN)
    for dest,pose in job.get('mainSourceOverrides',{}).items():
        assert 0<=int(dest)<20 and isinstance(pose,int) and 0<=pose<20,'Invalid reviewed pose remap'
        main[int(dest)]=pose
    source=Path(job['masterOverride']) if job.get('masterOverride') else HERE/f'{key}-master.png'
    if not source.is_absolute():source=ROOT/source
    margin=job.get('sourceEdgeMargin',2)
    assert margin in [1,2],'A transparent border is required; never accept actual edge clipping'
    def cut(path,cols,rows,tag):
        im,labels,pieces=figures(path,cols,rows);a=np.array(im);n=cols*rows
        if set(pieces)!=set(range(n)):raise ValueError(f'Expected {n} figures{tag}, got {sorted(pieces)}')
        got=[]
        for i in range(n):
            mask=np.isin(labels,pieces[i]);ys,xs=np.nonzero(mask)
            box=[int(xs.min()),int(ys.min()),int(xs.max()+1),int(ys.max()+1)]
            if box[0]<margin or box[1]<margin or box[2]>im.width-margin or box[3]>im.height-margin:raise ValueError(f'Canvas clipping pose {i}{tag}')
            rgba=a.copy();rgba[~ndimage.binary_dilation(mask,iterations=2),3]=0
            got.append((Image.fromarray(rgba).crop(box),box,float(xs.mean())))
        return got
    parts=cut(source,4,5,'')
    walk_source=None;raw_walk={};walk_factor=None
    if job.get('walkSheet'):
        walk_source=Path(job['walkSheet'])
        if not walk_source.is_absolute():walk_source=ROOT/walk_source
        walk=cut(walk_source,4,2,' (walk sheet)')
        # 걷기 판 배율: 서기 칸(띠 차례 0~3 · 옛 차례 0~2)과 새 걷기 8칸의 「몸 덩어리 키」 중앙값을 맞춘다 (가는 무기는 깎고 잰다)
        # 11-19 형 「걸을 때마다 키가 작아짐」: 11-17 판은 동작 판의 걷기 칸에 맞췄는데, 동작 판 걷기 칸이 서기보다 5~15% 작게 그려져 와서 걷기 띠가 줄었다
        unit_a=parts[0][0].height/138;unit_w=float(np.median([p[0].height for p in walk]))/138
        walk_factor=float(np.median([core_height(parts[i][0],unit_a) for i in (range(0,4) if stripOrder else range(0,3))])/np.median([core_height(p[0],unit_w) for p in walk]))
        if job.get('walkFactor'):walk_factor=float(job['walkFactor'])  # 11-18 각성 띠(aw1-intake.py): 동작 판 걷기 칸이 띠 차례와 달라 배율을 밖에서 잰다
        assert .2<walk_factor<4,'Walk sheet scale outside limits'
        for j,(part,box,cx) in enumerate(walk):
            raw_walk[20+j]=(part,walk_factor)
            small=part.resize((round(part.width*walk_factor),round(part.height*walk_factor)),Image.Resampling.LANCZOS)
            parts.append((small,[0,0,small.width,small.height],(cx-box[0])*walk_factor))
        main[4:12]=WALK_MAIN
    scale=min(job.get('idlePx',138)/parts[0][0].height,150/max(p[0].height for p in parts))  # idlePx: 각성 띠를 비각성 띠와 같은 몸 크기로 (aw1-intake.py)
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
        if i in raw_patch or i in raw_walk:
            raw,factor=raw_patch.get(i) or raw_walk[i]
            part=raw.resize((round(raw.width*factor*scale),round(raw.height*factor*scale)),Image.Resampling.LANCZOS)
        else:part=part.resize((round(part.width*scale),round(part.height*scale)),Image.Resampling.LANCZOS)
        x=round(width/2-(cx-box[0])*scale);y=156-part.height
        if x<3 or x+part.width>width-3 or y<3:raise ValueError(f'Clipped normalized pose {i}')
        f=Image.new('RGBA',(width,160));f.alpha_composite(part,(x,y));frames.append(f)
        reports.append(dict(masterPose=i+1,sourceBox=box,offset=[x,y],faceRetouch=False,**patch_report.get(i,{})) if i<20 else dict(walkPose=i-19,offset=[x,y],faceRetouch=False,walkScale=round(walk_factor,4)))
    assert len({f.tobytes() for f in frames[:3]})==3,'Missing distinct authored idle'
    out.mkdir(parents=True,exist_ok=True)
    for name,order in [(f'gen-{key}.png',main),(f'duel-{key}.png',range(20))]:
        strip=Image.new('RGBA',(width*20,160))
        for col,index in enumerate(order):strip.paste(frames[index],(col*width,0))
        strip.save(out/name)
    contact=Image.new('RGB',(width*8,-(-len(frames)//4)*344),'#293b44');d=ImageDraw.Draw(contact)
    for i,f in enumerate(frames):
        x=i%4*width*2;y=i//4*344;contact.paste(f.resize((width*2,320),Image.Resampling.NEAREST),(x,y),f.resize((width*2,320),Image.Resampling.NEAREST));d.text((x+5,y+322),str(i+1),fill='white')
    contact.save(out/f'{key}-contact.png')
    bow=job['weapon']=='bow'
    attack=np.array(frames[main[15 if bow else 14]])[...,3]>64;tx=int(np.where(attack.any(axis=0))[0].max());ty=float(np.where(attack[:,tx])[0].mean())
    atlas={**(STRIP_ATLAS if stripOrder else ATLAS),**job.get('atlasOverrides',{})}
    sources={source.relative_to(ROOT).as_posix():hashlib.sha256(source.read_bytes()).hexdigest()}
    if patch_source:sources[patch_source.relative_to(ROOT).as_posix()]=hashlib.sha256(patch_source.read_bytes()).hexdigest()
    if walk_source:sources[walk_source.relative_to(ROOT).as_posix()]=hashlib.sha256(walk_source.read_bytes()).hexdigest()
    report=dict(sources=sources,
        cell=[width,160],feet=frames[0].getbbox()[3],bodyPx=job.get('bodyPx',frames[0].getbbox()[3]-frames[0].getbbox()[1]),cells=20,kind='general',generationCalls=1,correctionCalls=job.get('correctionCalls',0),
        faceRetouch=False,idleStretch=False,idleDrawnFrames=3,frames=[reports[i] for i in main],
        contact=[15 if bow else 14,round(tx/width,2),round(ty/160,2)],duelCells=20,duelAtlas=atlas,excludedMasterPoses=job.get('excludedMasterPoses',[]),
        **({'walk8':dict(cells=list(range(4,12)),scale=round(walk_factor,4))} if walk_source else {}),
        **({'bodyPxRaw':frames[0].getbbox()[3]-frames[0].getbbox()[1]} if 'bodyPx' in job else {}))  # bodyPx 를 밖에서 정한 판(각성 띠 = 비각성 띠의 몸 키)
    (out/f'{key}-report.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    return report
