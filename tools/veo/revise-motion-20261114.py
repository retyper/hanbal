"""Auditable source replacement and unsubmitted motion-prompt revision."""
from pathlib import Path
from PIL import Image
import json, hashlib, shutil, datetime, re
ROOT=Path(__file__).resolve().parents[2]
LEDGER=Path('C:/Users/my/Documents/Codex/2026-11-06/windows-pc-claude-code-claude-code')
OUT=Path('C:/Users/my/Documents/Codex/2026-11-13/d-flutter-arrow-game-one/outputs')
P=LEDGER/'outputs/veo-production-queue.json'; S=LEDGER/'outputs/veo-production-state.json'
assert not Path(str(S)+'.lock').exists(), 'Live ledger locked'
q=json.loads(P.read_text('utf8'));s=json.loads(S.read_text('utf8'))
stamp=datetime.datetime.now(datetime.timezone.utc).isoformat()
sha=lambda p:hashlib.sha256(Path(p).read_bytes()).hexdigest()
archive=ROOT/'assets_r19/realm'
mir=next(a for a in s['attempts'] if a['id'].endswith(':183'))
mir['historicalInputPath']=mir['inputPath'];mir['inputPath']=str(archive/'awaken-hd/w-97-goguryeo-mir.jpg')
mir.update(status='held',filePath=str(archive/'awaken-loop/w-97-goguryeo-mir.mp4'),reviewNote='User identified tier1 source as adult-only; archived source and result. Replace with opaque costume image and a new video. Tier2 unchanged.',updatedAt=stamp)
assert sha(mir['inputPath'])==mir['inputSha256']
s['claims'].pop(mir['jobId'],None)
gal=next(a for a in s['attempts'] if a['id'].endswith(':182'))
gal.setdefault('reviewHistory',[]).append(dict(status=gal['status'],note=gal.get('reviewNote'),at=gal['updatedAt']))
galfile=OUT/'갈매-각성1-aaa31a23.mp4'
gal.update(status='downloaded',filePath=str(galfile),fileSha256=sha(galfile),updatedAt=stamp,reviewNote='User recovered this same conversation and reports successful result aaa31a23; downloaded file preserved. Technical motion/continuity review pending; do not regenerate.')
gal['userRecovery']={'followup':'그러면 역동성을 유지하면서 신체 자체가 자연스럽게 중력에 따라 흔들리게 만들어봐.','observedVideoReady':True,'originalPromptFingerprintPreserved':True}
s['claims'][gal['jobId']]=gal['id']
source=Path('C:/Users/my/.codex/generated_images/01a1d3a8-4428-7e93-8874-2102ea19b75e/exec-4e5fc5a7-51a6-47b1-b6ac-6c7586f49219.png')
id='w-97-goguryeo-mir'
for name in [id+'.png',id+'-opaque-20261114.png']:
    shutil.copy2(source,ROOT/'assets_src/realm/awaken'/name)
shutil.copy2(source,OUT/'미르-각성1-일반판.png')
im=Image.open(source).convert('RGB')
for folder,size in [('awaken-hd',900),('awaken',320)]:
    im.resize((size,size),Image.Resampling.LANCZOS).save(ROOT/f'public/realm/{folder}/{id}.jpg',quality=88)
BODY='''WHOLE-BODY MOTION AND FOLLOW-THROUGH: Animate a connected living body rather than a rigid cutout. Every intentional movement starts from balanced feet, travels through knees and pelvis into the torso, shoulders and arms, then settles with believable gravity, inertia and gentle damping. The shoulders and ribcage rise and fall visibly with relaxed breathing and laughter. Hair, sleeves, feathers, pendants and waist tassels respond after the body changes direction and take an extra beat to settle. Give each material its own weight: heavy ornaments lag and swing in smaller arcs, light ribbons flutter farther, soft fabric folds compress and release. Keep the skeleton, face and costume dimensions consistent; no rubber stretching or repeated whole-picture bobbing. Movement remains warm, energetic and physically coherent without sexual emphasis. Clothing remains opaque, secure and fully in place throughout.'''
prompt='''Create one continuous 10-second 9:16 living portrait of Mir, a fictional adult 25-year-old woman from an original Korean historical fantasy game, using the attached FIRST-awakening illustration. Preserve her exact face, warm confident smile, dark high ponytail, feather and headband, jade earrings, bronze bracers, purple brocade high-neck opaque bodice with bronze clasps and red piping, covered waist and purple skirt. Keep her raised hand behind her head and other hand at her hip initially. Both hands are empty; no weapons or new objects.

Fill the frame from the top of the head to around the hips at approximately the reference scale. Face stays fully inside the frame. Extend the existing dark magical ribbons and sparks naturally, without square inset or blurred bands. Locked camera: no zoom, pan, cut or spin.

Her one purposeful action is a confident hair-release stretch and balanced side-step: from the reference pose she lifts her elbow slightly, slides her fingers back through the ponytail and lets the long hair fan outward. She rolls her shoulders comfortably, shifts her weight one small step sideways and returns, with her free hand resting naturally at the belt. The ponytail, feather, sleeves, earrings and waist tassels swing and settle at different speeds. She looks warmly at the viewer throughout, with natural blinks and a restrained friendly smile. No speaking; cloth rustle and ornament chimes only.

'''+BODY+'''

TIMING: 0–1 seconds begin naturally in the source pose with visible breath; 1–7 seconds perform the connected action with varied anticipation, motion and follow-through; 7–10 seconds take one slow visible breath while easing toward a comfortable near-starting pose. Keep subtle motion through the very last frame. Never freeze, snap back or force an exact loop endpoint.

FACE AND STYLE LOCK: preserve the same eyes, eyelids, nose, lips, jaw, face proportions and illustrated skin throughout. Natural bangs stay attached and move without crossing into new facial features. No added pores, wrinkles, freckles, facial marks or photorealistic skin. Preserve the soft polished painterly style. No exaggerated mouth, closed-eye holds, distorted expressions, extra fingers, extra limbs, text or captions. Identity, sound anatomy and prop continuity take priority.'''
pp=LEDGER/'outputs/veo-queue-prompts/goguryeo-mir-t1-opaque-motion-20261114.txt';pp.write_text(prompt,encoding='utf8')
shutil.copy2(pp,OUT/'미르-각성1-영상프롬프트.txt')
jobid='t1-goguryeo-mir-opaque-20261114'
assert not any(j['id']==jobid for j in q['jobs'])
q['jobs'].append(dict(id=jobid,heroId=id,tier='1',inputPath=str(ROOT/f'public/realm/awaken-hd/{id}.jpg'),inputSha256=sha(ROOT/f'public/realm/awaken-hd/{id}.jpg'),promptPath=str(pp),promptSha256=sha(pp),priority=110,authorized=True,replacesAttemptId=mir['id'],accountId='jay-u4',aspectRatio='9:16',framing='portrait-head-to-pelvis',sourceNote='User requested opaque general-release replacement. Old source and video archived assets_r19.'))
tried={a['jobId'] for a in s['attempts']};changed=[]
for j in q['jobs']:
    if j['id'] in tried or j['id']==jobid or not j.get('authorized') or j.get('sourceRepairRequired'):continue
    old=Path(j['promptPath']);text=old.read_text('utf8')
    if 'BODY MOTION' not in text:continue
    revised=re.sub(r'BODY MOTION.*?(?=\n\n|Throughout the take|TIMING)',BODY+'\n\n',text,flags=re.S)
    if revised==text:continue
    dest=old.with_name(old.stem+'-wholebody-20261114.txt');dest.write_text(revised,encoding='utf8')
    j['priorPromptPath']=str(old);j['promptPath']=str(dest);j['promptSha256']=sha(dest);changed.append(j['id'])
for p,data in [(P,q),(S,s)]:
    backup=p.with_name(p.name+'.before-motion-20261114');assert not backup.exists();shutil.copy2(p,backup)
    tmp=p.with_suffix('.next.json');tmp.write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf8');tmp.replace(p)
(OUT/'Veo-전신움직임-공통문안.txt').write_text(BODY,encoding='utf8')
print(json.dumps({'mirJob':jobid,'pendingPromptsRevised':changed},ensure_ascii=False))
