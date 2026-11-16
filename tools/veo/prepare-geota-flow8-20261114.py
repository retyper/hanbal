from pathlib import Path
import json,hashlib
P=Path('C:/Users/my/Documents/Codex/2026-11-06/windows-pc-claude-code-claude-code/outputs')
qp=P/'veo-production-queue.json';sp=P/'veo-production-state.json';q=json.loads(qp.read_text('utf8'));s=json.loads(sp.read_text('utf8'))
j=next(x for x in q['jobs'] if x['id']=='t1-geota-v1-r-20261113')
assert not any(a['jobId']==j['id'] for a in s['attempts'])
old=Path(j['promptPath']);new=old.with_name('geota-t1-motion-20261114-flow8.txt');assert not new.exists()
t=old.read_text('utf8').replace('10-second','8-second').replace('over the 10 seconds','over the 8 seconds').replace('1-7 s','1-5.5 s').replace('7-10 s','5.5-8 s')
t+='''

ACTION DETAIL AND WHOLE-BODY FOLLOW-THROUGH: His planted inspection stance is alive from first to last frame. A gust presses the cloak backward; he shifts his weight deliberately, turns his armored torso a few degrees toward the viewer without changing his face shape, rolls his shoulders back and settles into a commanding balanced stance. The motion travels through knees, pelvis, ribcage and shoulders, never as a flat cutout bob. The heavy iron plates lift and settle together; the crimson cloak billows behind, fur tips and loose front hair strands follow the gust, and the hanging jade discs and cords lag a beat after each direction change before gently damping. Keep the collar, shoulder lion ornaments and neck guard rigidly attached in the same places. During the final 2.5 seconds he breathes visibly and eases toward ready while the cloth, fur and pendants continue to move. Keep all hands below the existing frame edge, no new props, no camera motion, no cut, no zoom, no freeze. Fully clothed, opaque armor coverage and original painted style remain unchanged. Natural physics and character presence only.
'''
new.write_text(t,encoding='utf8');j.update(priorPromptPath=str(old),promptPath=str(new),promptSha256=hashlib.sha256(new.read_bytes()).hexdigest(),accountId='flow-hepastosian',durationSeconds=8,sourceNote=j.get('sourceNote','')+' 05AM Flow hepastosian actual20credits; Veo3.1Fast Ingredients 9:16 720p8s x1. Long original prompt retained, purposeful whole-body movement added. No purchase.')
qp.write_text(json.dumps(q,ensure_ascii=False,indent=2),encoding='utf8');print(j['promptSha256'])
