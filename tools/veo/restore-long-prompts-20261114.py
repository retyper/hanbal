"""Restore three unsubmitted short jobs from their original long portrait prompts."""
from pathlib import Path
import json,re,hashlib,shutil
R=Path('C:/Users/my/Documents/Codex/2026-11-06/windows-pc-claude-code-claude-code/outputs')
p=R/'veo-production-queue.json';s=R/'veo-production-state.json'
assert not Path(str(s)+'.lock').exists()
q=json.loads(p.read_text('utf8'));state=json.loads(s.read_text('utf8'))
body=Path('C:/Users/my/Documents/Codex/2026-11-13/d-flutter-arrow-game-one/outputs/Veo-전신움직임-공통문안.txt').read_text('utf8')
sources={'t1-tahae-neoul-argon-20261113':'tneoul-t1-20261111-15-l.txt','t1-golpo-janmul-argon-20261113':'janmul-t1-20261108-f-l.txt','t1-gyeonji-beodeul-argon-20261113':'beodeul-t1-20261109d-l.txt'}
for key,name in sources.items():
    assert not any(a['jobId']==key for a in state['attempts'])
    j=next(j for j in q['jobs'] if j['id']==key)
    original=R/'veo-queue-prompts'/name;t=original.read_text('utf8')
    t=re.sub(r'BODY MOTION.*?(?=\n\n|Throughout the take|TIMING)',body+'\n\n',t,flags=re.S)
    if body not in t:t+='\n\n'+body
    t+='\n\nREFERENCE PRIORITY: the attached CURRENT illustration overrides older outfit descriptions. Preserve its exact opaque coverage, face, anatomy and props; never remove clothing or reveal new body areas. Purposeful action and natural material follow-through remain lively through the final frame. No sexual emphasis.'
    dest=original.with_name(original.stem+'-motion-20261114.txt');dest.write_text(t,encoding='utf8')
    j['priorPromptPath']=j['promptPath'];j['originalLongTemplate']=str(original);j['promptPath']=str(dest);j['promptSha256']=hashlib.sha256(dest.read_bytes()).hexdigest()
    print(key,len(t))
shutil.copy2(p,p.with_name(p.name+'.before-long-20261114'))
tmp=p.with_suffix('.next.json');tmp.write_text(json.dumps(q,ensure_ascii=False,indent=2),encoding='utf8');tmp.replace(p)
