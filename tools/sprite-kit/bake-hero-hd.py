# -*- coding: utf-8 -*-
"""53-A: native master →2x strip. Existing normal strip is verification input only, never resized intoHD."""
import sys
sys.dont_write_bytecode = True
from pathlib import Path
import json, hashlib, importlib.util, argparse
import numpy as np
from scipy import ndimage
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
def sha(p): return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--out', type=Path, required=True); ap.add_argument('--report', type=Path, required=True); args = ap.parse_args()
    spec = importlib.util.spec_from_file_location('full20', ROOT/'tools/sprite-kit/bake-full20.py'); bk = importlib.util.module_from_spec(spec); spec.loader.exec_module(bk)
    key = 'jumong'; rp = ROOT/f'tools/sprite-kit/repairs/20261113/{key}-report.json'; report = json.loads(rp.read_text('utf8'))
    source = ROOT/'tools/sprite-kit/nonawakened-20261113/jumong-master.png'; walk_source = ROOT/'tools/sprite-kit/nonawakened-20261113/jumong-walk-installed.png'
    for p in [source, walk_source]: assert sha(p) == report['sources'][p.relative_to(ROOT).as_posix()], 'Canonical sourceSHA mismatch'
    original = {str(p): sha(p) for p in [source,walk_source,ROOT/'public/realm/anim-px/gen-jumong.png']}
    def cut(p, cols, rows):
        im, labels, pieces = bk.figures(p,cols,rows); a = np.array(im); result = []
        assert set(pieces) == set(range(cols*rows))
        for i in range(cols*rows):
            mask = np.isin(labels,pieces[i]); ys,xs = np.nonzero(mask); box=[int(xs.min()),int(ys.min()),int(xs.max()+1),int(ys.max()+1)]
            assert box[0]>=2 and box[1]>=2 and box[2]<=im.width-2 and box[3]<=im.height-2, f'Original clipped {p} pose{i}'
            rgba=a.copy();rgba[~ndimage.binary_dilation(mask,iterations=2),3]=0
            result.append((Image.fromarray(rgba).crop(box),box,float(xs.mean())))
        return result
    parts=cut(source,4,5);walk=cut(walk_source,4,2)
    unit_a=parts[0][0].height/138;unit_w=float(np.median([p[0].height for p in walk]))/138
    factor=float(np.median([bk.core_height(parts[i][0],unit_a) for i in range(4)])/np.median([bk.core_height(p[0],unit_w) for p in walk]))
    assert round(factor,4)==report['walk8']['scale'], 'Current canonical walk-factor mismatch'
    scale=min(138/parts[0][0].height,150/max([p[0].height for p in parts]+[round(p[0].height*factor) for p in walk]))
    assert scale*2<=1 and scale*factor*2<=1, 'Native source insufficient for actual2x; do not upscale'
    cw,ch=report['cell'];normal=Image.open(ROOT/'public/realm/anim-px/gen-jumong.png').convert('RGBA');result=Image.new('RGBA',(cw*2*10,ch*2*2));frames=[]
    for i,f in enumerate(report['frames']):
        iswalk='walkPose'in f;part,box,cx=(walk[f['walkPose']-1]if iswalk else parts[f['masterPose']-1]);s=scale*2*(factor if iswalk else 1)
        if not iswalk: assert box==f['sourceBox'],f'Canonical pose mapping mismatch{i}'
        art=part.resize((round(part.width*s),round(part.height*s)),Image.Resampling.LANCZOS)
        x=round(cw-(cx-box[0])*s);y=report['feet']*2-art.height
        assert x>=6 and y>=6 and x+art.width<=cw*2-6, f'HD clip frame{i}'
        cell=Image.new('RGBA',(cw*2,ch*2));cell.alpha_composite(art,(x,y));result.alpha_composite(cell,(i%10*cw*2,i//10*ch*2))
        bbox=cell.getchannel('A').point(lambda a:255 if a>64 else 0).getbbox();base=normal.crop((i*cw,0,(i+1)*cw,ch));basebox=base.getchannel('A').point(lambda a:255 if a>64 else 0).getbbox()
        delta=[bbox[j]-basebox[j]*2 for j in range(4)]
        assert max(abs(v)for v in delta)<=2, f'Geometry drift frame{i}: {delta}'
        frames.append({'frame':i,'source':str(walk_source if iswalk else source),'sourceBox':box,'sourcePose':f.get('walkPose',f.get('masterPose')),'nativeToHdScale':s,'offset':[x,y],'alpha64BBox':bbox,'baseAlpha64BBox':basebox,'bboxDeltaFrom2x':delta,'feet':y+art.height})
    args.out.parent.mkdir(parents=True,exist_ok=True);result.save(args.out)
    data={'key':key,'method':'native source crop → direct Lanczos downsample into2x geometry; no160strip upscale/ESR/AI','sources':{str(p):{'sha256':sha(p),'size':list(Image.open(p).size)}for p in [source,walk_source]},'normalSHA256':original[str(ROOT/'public/realm/anim-px/gen-jumong.png')],'reportSHA256':sha(rp),'output':str(args.out),'sha256':sha(args.out),'cell':[cw*2,ch*2],'cells':20,'feet':report['feet']*2,'bodyPx':report['bodyPx']*2,'rawToNormalScale':scale,'rawToHdScale':scale*2,'walkFactor':factor,'frames':frames,'originalsUnchanged':all(sha(p)==v for p,v in original.items())}
    data['columns']=10;data['rows']=2;data['imageSize']=list(result.size)
    assert data['originalsUnchanged'];args.report.parent.mkdir(parents=True,exist_ok=True);args.report.write_text(json.dumps(data,ensure_ascii=False,indent=2),'utf8')
    print(json.dumps({'output':str(args.out),'cell':data['cell'],'feet':data['feet'],'sha256':data['sha256'],'rawToHdScale':data['rawToHdScale'],'walkHdScale':scale*factor*2,'maxBBoxDelta':max(abs(v)for f in frames for v in f['bboxDeltaFrom2x']),'originalsUnchanged':True}))
if __name__=='__main__': main()
