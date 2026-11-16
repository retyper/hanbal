"""Install reviewed manual assets. Originals and replaced assets are preserved."""
from pathlib import Path
from PIL import Image
import hashlib, json, re, shutil, subprocess
import imageio_ffmpeg

root=Path(__file__).resolve().parent.parent
src=Path.home()/'Downloads'
backup=root/'tools/out/haebi-pack/intake-backups'
backup.mkdir(exist_ok=True)
records=[]
def preserve(p):
    if p.exists():
        dest=backup/(p.parent.name+'-'+p.name)
        if not dest.exists(): shutil.copy2(p,dest)
def record(s,d):
    records.append({'source':s.name,'sha256':hashlib.sha256(s.read_bytes()).hexdigest(),'runtime':str(d.relative_to(root))})
jobs=json.loads((root/'tools/out/haebi-pack/intake-jobs.json').read_text())
for j in jobs:
    if 'members' not in j: continue
    s=src/(j['save']+'.png')
    im=Image.open(s).convert('RGBA')
    for i,name in enumerate(j['members']):
        x=i%3;y=i//3
        cell=im.crop((round(x*im.width/3),round(y*im.height/2),round((x+1)*im.width/3),round((y+1)*im.height/2)))
        box=cell.getchannel('A').point(lambda a:255 if a>12 else 0).getbbox()
        if not box: raise ValueError(name)
        cell=cell.crop(box);cell.thumbnail((216,216),Image.Resampling.LANCZOS)
        tile=Image.new('RGBA',(256,256));tile.alpha_composite(cell,((256-cell.width)//2,(256-cell.height)//2))
        d=root/'public/realm/icon'/(name+'.png');preserve(d);tile.save(d);record(s,d)
bodyids=[]
for s in sorted(src.glob('skillbody_*.png.png')):
    ident=s.name[len('skillbody_'):-len('.png.png')]
    d=root/'public/realm/skill-body'/(ident+'.jpg');preserve(d)
    im=Image.open(s).convert('RGB');im.thumbnail((800,1200),Image.Resampling.LANCZOS);im.save(d,quality=90)
    bodyids.append(ident);record(s,d)
p=root/'src/realm/data/skill-body.ts';text=p.read_text(encoding='utf-8')
for ident in bodyids:
    if "'"+ident+"'" not in text.split('])')[0]: text=text.replace('new Set<string>([','new Set<string>([\n  '+repr(ident)+',',1)
if 'w-95-michuhol-haebi' in bodyids: text=text.replace("new Set(['w-95-michuhol-haebi'])","new Set<string>()")
p.write_text(text,encoding='utf-8')
for s in sorted(src.glob('veo_*_manual-20261114.mp4.mp4')):
    m=re.fullmatch(r'veo_(.+)_aw([12])_manual-20261114.mp4.mp4',s.name)
    if not m or 'yucheongan' in s.name: continue
    ident,tier=m.groups();folder='awaken2-loop' if tier=='2' else 'awaken-loop'
    d=root/'public/realm'/folder/(ident+'.mp4');preserve(d)
    subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(),'-v','error','-i',str(s),'-map','0:v:0','-an','-c:v','libx264','-crf','23','-preset','fast','-pix_fmt','yuv420p','-movflags','+faststart','-y',str(d)],check=True)
    p=root/'src/realm/data/awaken-art.ts';text=p.read_text(encoding='utf-8');key='AWAKEN2_LOOP' if tier=='2' else 'AWAKEN_LOOP'
    marker='export const '+key+': ReadonlySet<string> = new Set(['
    section=text.split(marker)[1].split('])')[0]
    if repr(ident) not in section: text=text.replace(marker,marker+'\n  '+repr(ident)+', // manual intake 2026-11-14',1)
    p.write_text(text,encoding='utf-8');record(s,d)
(root/'tools/out/haebi-pack/intake-receipt.json').write_text(json.dumps(records,indent=2),encoding='utf-8')
print('Installed',len(records),'assets; bodies',len(bodyids))
