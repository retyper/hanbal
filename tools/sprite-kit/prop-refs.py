# -*- coding: utf-8 -*-
"""얼굴 큰 전투 띠 다시 굽기 참고 그림 (형 11-16 · head-audit-20261116.json).
  assets_src/realm/sprite-prop/<key>-now.png   지금 띠 20칸을 4×5 판으로 (옷·무기·자세 차례 참고)
  assets_src/realm/sprite-prop/ref-approved.png 형이 맞다고 본 얼굴 크기: 소서노·감실·쇠비·온조 서 있기 · 같은 몸 키
다시: py -3 -I tools/sprite-kit/prop-refs.py
"""
import json
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
PX = ROOT / 'public/realm/anim-px'
OUT = ROOT / 'assets_src/realm/sprite-prop'
OUT.mkdir(parents=True, exist_ok=True)
man = json.loads((PX / 'manifest.json').read_text(encoding='utf-8'))
audit = json.loads((ROOT / 'tools/sprite-kit/head-audit-20261116.json').read_text(encoding='utf-8'))
keys = list(audit['tierA_chin_ge38']) + list(audit['tierB_chin_37'])
# 11-16 무기 감사(tools/sprite-kit/weapon-audit-20261116.json): 띠가 원화와 다른 무기를 든 장수도 다시 굽는다
_wa = json.loads((ROOT / 'tools/sprite-kit/weapon-audit-20261116.json').read_text(encoding='utf-8'))
for r in (_wa if isinstance(_wa, list) else _wa.get('rows', [])):
    if 'sprite≠art' in (r.get('mismatch') or []) and 'gen-' + r['key'] not in keys:
        keys.append('gen-' + r['key'])
Z = 2
BG = (58, 60, 68, 255)
for k in keys:
    v = man[k]; cw, ch = v['cell']; n = v.get('cells', 20)
    im = Image.open(PX / f'{k}.png').convert('RGBA')
    sheet = Image.new('RGBA', (4 * cw * Z, 5 * ch * Z), BG)
    for i in range(min(n, 20)):
        c = im.crop((i * cw, 0, (i + 1) * cw, ch)).resize((cw * Z, ch * Z), Image.NEAREST)
        sheet.alpha_composite(c, ((i % 4) * cw * Z, (i // 4) * ch * Z))
    sheet.convert('RGB').save(OUT / f'{k}-now.png')
ref = ['gen-soseono', 'gen-gamsil', 'gen-soebi', 'gen-onjo']
cells = []
for k in ref:
    v = man[k]; cw, ch = v['cell']
    cells.append(Image.open(PX / f'{k}.png').convert('RGBA').crop((0, 0, cw, ch)).resize((cw * 3, ch * 3), Image.NEAREST))
W = sum(c.width for c in cells); H = max(c.height for c in cells)
sh = Image.new('RGBA', (W, H + 40), BG); x = 0; d = ImageDraw.Draw(sh)
for k, c in zip(ref, cells):
    sh.alpha_composite(c, (x, 0)); x += c.width
sh.convert('RGB').save(OUT / 'ref-approved.png')
print('refs', len(keys), 'approved', sh.size)
