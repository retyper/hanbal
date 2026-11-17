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
FORM = {'base': ('bust', 'bust-hd'), 'aw1': ('awaken', 'awaken-hd')}

done = []
for f in sorted(SRC.glob('hit_*.png')):
    if not f.name.endswith('_v2.png') and (SRC / f.name.replace('.png', '_v2.png')).exists():
        continue   # 11-17 상처·피 지운 _v2 가 있으면 그것을
    m = re.fullmatch(r'hit_(base|aw1)_(.+?)(?:_v2)?\.png', f.name)
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
