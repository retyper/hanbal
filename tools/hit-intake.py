# -*- coding: utf-8 -*-
"""피격 초상 그림 받아 넣기 (11-17 형 「피격 이미지」 · release-jobs HIT-*).
D:/에셋창고/hit_<base|aw1>_<초상 id>.png  →  public/realm/hit/<bust|awaken>/<초상 id>.webp (원래 초상과 같은 크기)
그다음 src/ui/hit-portrait.ts 의 HIT_ART 목록을 public/realm/hit 에 있는 파일로 다시 쓴다. 에셋창고는 읽기만.
  py -3 -I tools/hit-intake.py
"""
import re
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = Path('D:/에셋창고')
OUT = ROOT / 'public/realm/hit'
TS = ROOT / 'src/ui/hit-portrait.ts'
FORM = {'base': ('bust', 'bust-hd'), 'aw1': ('awaken', 'awaken-hd'), 'aw2': ('awaken2', 'awaken2-hd')}   # aw2 = 진각성(11-18 · DLC · 그림 먼저)

done = []
_files = {}
for f in sorted(SRC.glob('Codex-*-candidates/hit_*.png')) + sorted(SRC.glob('hit_*.png')):   # Codex 보류 후보도 · 정식 자리가 나중이라 덮는다
    if re.search(r'-\d{12}\.png$', f.name): continue
    if f.name in _files and _files[f.name].stat().st_mtime >= f.stat().st_mtime: continue   # 11-18 같은 이름이면 더 새로 그린 쪽(Codex 다시 그린 후보가 옛 정식 자리보다 새것일 수 있다)
    _files[f.name] = f
for f in _files.values():
    if not f.name.endswith('_v2.png') and f'{f.name[:-4]}_v2.png' in _files:
        continue   # 11-17 상처·피 지운 _v2 가 있으면 그것을
    m = re.fullmatch(r'hit_(base|aw1|aw2)_(.+?)(?:_v2)?\.png', f.name)
    if not m or f.stat().st_size == 0:
        continue
    form, pid = m.groups()
    sub, srcdir = FORM[form]
    ref = ROOT / f'public/realm/{srcdir}/{pid}.jpg'
    dest = OUT / sub / f'{pid}.webp'
    if dest.exists() and dest.stat().st_mtime >= f.stat().st_mtime:
        continue
    im = Image.open(f).convert('RGB')
    if ref.exists():
        im = im.resize(Image.open(ref).size, Image.LANCZOS)
    dest.parent.mkdir(parents=True, exist_ok=True)
    im.save(dest, 'WEBP', quality=86, method=6)
    done.append(f'{sub}/{pid}')

have = sorted(f'{p.parent.name}/{p.stem}' for p in OUT.glob('*/*.webp'))
body = ', '.join(f"'{h}'" for h in have)
s = TS.read_text(encoding='utf-8')
s2 = re.sub(r'export const HIT_ART: ReadonlySet<string> = new Set<string>\(\[[^\]]*\]\)',
            f'export const HIT_ART: ReadonlySet<string> = new Set<string>([{body}])', s, count=1)
if s2 != s:
    TS.write_bytes(s2.encode('utf-8'))
print('넣음', len(done), done, '· 목록', len(have))

# 얼굴 자리 재기 (11-18 형: 열전처럼 그림이 다 안 나오는 판에서 얼굴이 잘리지 않게) — tools/hit-focus.py 가 새 그림 · 바뀐 그림만 재고
# src/ui/hit-focus.generated.ts 를 다시 쓴다. 실패해도 받기는 끝난 것이다 (그 그림은 자리 자료 없이 가운데로 나온다).
try:
    import subprocess
    import sys
    r = subprocess.run([sys.executable, '-I', str(ROOT / 'tools/hit-focus.py')], timeout=3600)
    if r.returncode != 0:
        print('얼굴 자리 재기 실패 · 받기는 끝났다 · 따로 돌리기: py -3 -I tools/hit-focus.py')
except Exception as e:
    print('얼굴 자리 재기 못 함 · 받기는 끝났다:', e)
