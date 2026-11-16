# -*- coding: utf-8 -*-
"""각성·진각성 비기 전신 새 틀(v2) 받아 넣기 (11-17 해부·그림체 검수 반려 · tools/release-jobs.mjs SB1-<id>-v2 · SB2-<id>-v2).
D:/에셋창고/skillbody_aw1_<id>_v2.png → public/realm/skill-body/aw1/<id>.jpg
D:/에셋창고/skillbody_aw2_<id>_v2.png → public/realm/skill-body/aw2/<id>.jpg   (800×1200 · 남색 판 #101626)
옛 것은 assets_src/realm/retired/skill-body-aw1-v1/ · skill-body-aw2-v1/ 로 → 윗몸 컷 다시 굽기(tools/skill-cut-bake.py --force --only aw1/<id>,…).
이미 넣은 것(원본 sha 같음)은 건너뛴다. 에셋창고는 읽기만. 받은 파일이 없으면 아무것도 안 한다.
  py -3 -I tools/skillbody-aw-v2-intake.py            → 넣기
  py -3 -I tools/skillbody-aw-v2-intake.py --dry      → 무엇을 넣을지 보기만
"""
import hashlib, json, re, subprocess, sys
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = Path('D:/에셋창고')
BODY = ROOT / 'public/realm/skill-body'
REC = ROOT / 'tools/out/skillbody-aw-v2-intake.json'
OVR = ROOT / 'tools/skill-cut-override.json'
DRY = '--dry' in sys.argv
rec = json.loads(REC.read_text(encoding='utf-8')) if REC.exists() else {}
done = []
for f in sorted(SRC.glob('skillbody_aw[12]_*_v2.png')) + sorted(SRC.glob('skillbody_aw[12]_*_v3.png')):   # _v3(검수 반려 다시)가 나중에 덮는다
    m = re.fullmatch(r'skillbody_(aw[12])_(.+)_v[23]\.png', f.name)
    if not m:
        continue
    form, ident = m.group(1), m.group(2)
    key = f'{form}/{ident}'
    if f.stat().st_size == 0:
        print('빈 파일 · 건너뜀', f.name); continue
    sha = hashlib.sha256(f.read_bytes()).hexdigest()
    if rec.get(key) == sha:
        continue
    dest = BODY / form / f'{ident}.jpg'
    ret = ROOT / f'assets_src/realm/retired/skill-body-{form}-v1'
    if DRY:
        print('넣을 것', key, '(옛 것 있음)' if dest.exists() else '(새 칸)'); continue
    ret.mkdir(parents=True, exist_ok=True)
    if dest.exists() and not (ret / f'{ident}.jpg').exists():
        (ret / f'{ident}.jpg').write_bytes(dest.read_bytes())
    im = Image.open(f); im.load()
    rgba = im.convert('RGBA'); bg = Image.new('RGB', rgba.size, (16, 22, 38)); bg.paste(rgba, mask=rgba.getchannel('A'))
    bg = bg.resize((800, 1200), Image.LANCZOS) if abs(bg.width / bg.height - 2 / 3) < 0.02 else bg
    bg.thumbnail((800, 1200), Image.LANCZOS)
    dest.parent.mkdir(parents=True, exist_ok=True)
    bg.save(dest, quality=90)
    rec[key] = sha; done.append(key)
if DRY:
    sys.exit(0)
REC.parent.mkdir(parents=True, exist_ok=True)
REC.write_text(json.dumps(rec, ensure_ascii=False, indent=1), encoding='utf-8')
print('넣음', len(done), done)
if done:
    if OVR.exists():
        ovr = json.loads(OVR.read_text(encoding='utf-8'))
        stale = [k for k in done if k in ovr]
        if stale:
            print('주의 · 옛 그림에 맞춘 윗몸 자르기 손질이 남아 있음(tools/skill-cut-override.json) · 컷을 보고 지울 것:', stale)
    subprocess.run([sys.executable, '-I', str(ROOT / 'tools/skill-cut-bake.py'), '--force', '--only', ','.join(done)], check=True)
