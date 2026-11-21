"""Install one explicitly reviewed full20 candidate, preserve old files and queue."""
from pathlib import Path
import json,shutil,re,importlib.util,argparse
ROOT=Path(__file__).resolve().parents[3];HERE=Path(__file__).parent
import sys
sys.dont_write_bytecode = True
sys.path.insert(0, str(HERE.parent))
from manifest_ts import MANIFEST_IMPORT, manifest_expression
parser=argparse.ArgumentParser();parser.add_argument('key');args=parser.parse_args();key=args.key
queue=json.loads((HERE/'queue.json').read_text('utf-8'));job=next(x for x in queue if x['key']==key)
assert job.get('review')=='accepted','Review candidate before installation'
assert job.get('proportionReviewed') is True,'Review actual full-body result against approved game proportions'
s=importlib.util.spec_from_file_location('full20',HERE.parent/'bake-full20.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
out=HERE/'candidates';report=m.bake(out,key)
dest=HERE.parent/'repairs/20261113';reports=json.loads((dest/'repair-report.json').read_text('utf-8'))
archive=ROOT/'assets_src/realm/retired/before-full20-20261113'/key;archive.mkdir(parents=True,exist_ok=True)
for filename in [f'gen-{key}.png',f'duel-{key}.png',f'{key}-report.json']:
    if (dest/filename).exists() and not (archive/filename).exists():shutil.copy2(dest/filename,archive/filename)
    shutil.copy2(out/filename,dest/filename)
reports[key]=report;(dest/'repair-report.json').write_text(json.dumps(reports,indent=2),encoding='utf-8')
specpath=HERE.parent/'repair-pilot.json';specs=json.loads(specpath.read_text('utf-8'));specs[key]={'pipeline':'full20-master'};specpath.write_text(json.dumps(specs,indent=2),encoding='utf-8')
atlases={k:v['duelAtlas'] for k,v in reports.items() if 'duelAtlas' in v}
installed=[j for j in queue if j['status']=='installed' or j['key']==key]
own={hid:j['key'] for j in installed for hid in j['heroIds']}
anim={j['key']:dict(ar=reports[j['key']]['cell'][0]/160,body=reports[j['key']]['bodyPx']/160,**({'bow':True} if j['weapon']=='bow' else {}),**({'mount':True} if j.get('mounted') else {})) for j in installed}
(ROOT/'src/realm/data/full20Generated.ts').write_text('/** Reviewed complete non-awakened atlases. */\n'+MANIFEST_IMPORT+'export const FULL20_ATLASES = '+manifest_expression(atlases)+'\nexport const FULL20_OWN: Readonly<Record<string,string>> = '+json.dumps(own)+'\nexport const FULL20_ANIM: Readonly<Record<string,{ar:number;body:number;bow?:true;mount?:true}>> = '+json.dumps(anim)+'\n',encoding='utf-8')
p=ROOT/'src/ui/realm/battle-strikes.ts';text=p.read_text('utf-8')
pattern=r"'gen-"+re.escape(key)+r"': \[[^\]]+\]"
if re.search(pattern,text):text=re.sub(pattern,f"'gen-{key}': {json.dumps(report['contact'])}",text)
else:text=text.replace('const CONTACT: Readonly<Record<string, [number, number, number]>> = {', 'const CONTACT: Readonly<Record<string, [number, number, number]>> = {\n'+f"  'gen-{key}': {json.dumps(report['contact'])},",1)
p.write_text(text,encoding='utf-8')
job.update(status='installed',generationCalls=1,report=str((out/f'{key}-report.json').relative_to(ROOT)))
(HERE/'queue.json').write_text(json.dumps(queue,ensure_ascii=False,indent=2),encoding='utf-8')
print('Installed reviewed',key,report['cell'])
