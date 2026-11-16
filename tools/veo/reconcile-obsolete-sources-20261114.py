"""Reconnect two historical attempts to exact archived inputs, preserving all fingerprints."""
from pathlib import Path
import json,hashlib,shutil
P=Path('C:/Users/my/Documents/Codex/2026-11-06/windows-pc-claude-code-claude-code');O=P/'outputs';qp=O/'veo-production-queue.json';sp=O/'veo-production-state.json'
q=json.loads(qp.read_text('utf8'));s=json.loads(sp.read_text('utf8'));B=P/'work/veo-archive-reconcile-20261114';B.mkdir(parents=True,exist_ok=False)
shutil.copy2(qp,B/qp.name);shutil.copy2(sp,B/sp.name)
spec={
't1-yucheongan-v1-20261110:131':'D:/flutter/arrow_game_one/assets_src/realm/retired/awaken-hd/w-99-garak-yucheongan@20261110-d20fca3f.jpg',
't1-mulsae-v1-20261108:102':'D:/flutter/arrow_game_one/assets_r19/realm/awaken-hd/w-91-saro-mulsae.jpg'}
for aid,path in spec.items():
 a=next(a for a in s['attempts'] if a['id']==aid);j=next(j for j in q['jobs'] if j['id']==a['jobId'])
 assert a['status']=='downloaded';assert hashlib.sha256(Path(path).read_bytes()).hexdigest()==a['inputSha256']
 assert hashlib.sha256(Path(a['filePath']).read_bytes()).hexdigest()==a['fileSha256']
 for item in [a,j]:item['historicalInputPath']=item['inputPath'];item['inputPath']=path
 a['archiveReconciliationNote']='Exact historical source SHA recovered in existing archive. Original source and prompt fingerprints, video, and creation history unchanged. Current canonical portrait belongs to an explicitly authorized replacement job.'
qp.write_text(json.dumps(q,ensure_ascii=False,indent=2),encoding='utf8');sp.write_text(json.dumps(s,ensure_ascii=False,indent=2),encoding='utf8')
print('Reconnected exact archived inputs; no video submitted.')
