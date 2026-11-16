"""Incremental cut-in intake from the manual workshop; preserve user originals."""
from pathlib import Path
from PIL import Image
import hashlib, json, shutil

root=Path(__file__).resolve().parent.parent
jobs=json.loads((root/'tools/out/haebi-pack/manifest.json').read_text(encoding='utf-8'))['jobs']
out=root/'public/realm/skill-body'
records=[];missing=[]
for j in jobs:
    if j['priority']!='skillbody':continue
    ident=j['heroId'];dest=out/(ident+'.jpg')
    if dest.exists():continue
    candidates=[p for d in (Path.home()/'Downloads', Path('D:/에셋창고')) for p in d.glob(j['save']+'*') if p.suffix.lower()=='.png']
    if not candidates:missing.append(ident);continue
    src=max(candidates,key=lambda p:p.stat().st_mtime)
    im=Image.open(src);im.load()
    if im.width<512 or im.height<512:raise ValueError(str(src))
    rgba=im.convert('RGBA');rgb=Image.new('RGB',rgba.size,'#111827');rgb.paste(rgba,mask=rgba.getchannel('A'))
    rgb.thumbnail((800,1200),Image.Resampling.LANCZOS);rgb.save(dest,quality=90)
    records.append({'heroId':ident,'title':j['title'],'source':str(src),'sourceSha256':hashlib.sha256(src.read_bytes()).hexdigest(),'sourceSize':im.size,'runtime':str(dest.relative_to(root)),'runtimeSize':rgb.size})
p=root/'src/realm/data/skill-body.ts';text=p.read_text(encoding='utf-8')
for r in records:
    ident=r['heroId']
    if repr(ident) not in text.split('])')[0]:text=text.replace('new Set<string>([','new Set<string>([\n  '+repr(ident)+',',1)
p.write_text(text,encoding='utf-8')
receipt={'date':'2026-11-15','installed':records,'missing':missing,'originalsPreserved':True}
(root/'tools/out/haebi-pack/skillbody-intake-20261115.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2),encoding='utf-8')
print('Installed',len(records),'missing',missing)
