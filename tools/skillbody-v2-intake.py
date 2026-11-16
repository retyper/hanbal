# -*- coding: utf-8 -*-
"""비각성 비기 전신 새 틀(v2) 받아 넣기 (11-17 형 검수 반려 51장 · tools/release-jobs.mjs SB-<id>-v2).
D:/에셋창고/skillbody_<id>_v2.png → public/realm/skill-body/<id>.jpg (800×1200 · 남색 판 #101626 · 옛 것은 assets_src/realm/retired/skill-body-v1/)
→ 윗몸 컷 다시 굽기(tools/skill-cut-bake.py --force --only …). 이미 넣은 것(원본 sha 같음)은 건너뛴다. 에셋창고는 읽기만.
  py -3 -I tools/skillbody-v2-intake.py
"""
import hashlib, json, subprocess, sys
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = Path('D:/에셋창고')
OUT = ROOT / 'public/realm/skill-body'
RET = ROOT / 'assets_src/realm/retired/skill-body-v1'
REC = ROOT / 'tools/out/skillbody-v2-intake.json'
RET.mkdir(parents=True, exist_ok=True)
rec = json.loads(REC.read_text(encoding='utf-8')) if REC.exists() else {}
done = []
_files = {}
for f in sorted(SRC.glob('skillbody_*_v2.png')) + sorted(SRC.glob('skillbody_*_v3.png')):   # _v3(검수 반려 다시)가 _v2 를 덮는다
    if f.name.startswith(('skillbody_aw1_', 'skillbody_aw2_')): continue
    _files[f.name[len('skillbody_'):-len('_v2.png')]] = f
for ident, f in _files.items():
    sha = hashlib.sha256(f.read_bytes()).hexdigest()
    if rec.get(ident) == sha:
        continue
    dest = OUT / f'{ident}.jpg'
    if dest.exists() and not (RET / f'{ident}.jpg').exists():
        (RET / f'{ident}.jpg').write_bytes(dest.read_bytes())
    im = Image.open(f); im.load()
    rgba = im.convert('RGBA'); bg = Image.new('RGB', rgba.size, (16, 22, 38)); bg.paste(rgba, mask=rgba.getchannel('A'))
    bg = bg.resize((800, 1200), Image.LANCZOS) if abs(bg.width / bg.height - 2 / 3) < 0.02 else bg
    bg.thumbnail((800, 1200), Image.LANCZOS)
    bg.save(dest, quality=90)
    rec[ident] = sha; done.append(ident)
REC.parent.mkdir(parents=True, exist_ok=True)
REC.write_text(json.dumps(rec, ensure_ascii=False, indent=1), encoding='utf-8')
print('넣음', len(done), done)
if done:
    subprocess.run([sys.executable, '-I', str(ROOT / 'tools/skill-cut-bake.py'), '--force', '--only', ','.join(done)], check=True)
