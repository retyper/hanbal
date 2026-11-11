"""regrid.py <키잉된 시트 -key.png> <열수> <행수> <out 4x2 시트> <r,c> x8 — 제미나이가 4x2 대신 4x4 등으로 낸 시트에서 컷 여덟을 골라
cut.sh 가 읽는 4x2 시트(1376x768, 칸 344x384, 발 기준선 맞춤)로 다시 놓는다. (11-11 소금비 동작 시트가 4x4 로 나왔다)"""
import sys
from PIL import Image
import numpy as np
src = Image.open(sys.argv[1]).convert('RGBA'); cols, rows = int(sys.argv[2]), int(sys.argv[3]); out = sys.argv[4]
picks = [tuple(int(v) for v in a.split(',')) for a in sys.argv[5:13]]
cw, ch = src.width // cols, src.height // rows
sheet = Image.new('RGBA', (1376, 768), (0, 0, 0, 0))
for i, (r, c) in enumerate(picks):
    cell = src.crop((c * cw, r * ch, (c + 1) * cw, (r + 1) * ch))
    sheet.alpha_composite(cell, ((i % 4) * 344 + (344 - cw) // 2, (i // 4) * 384 + 384 - ch))
sheet.save(out)
print('regrid', cw, ch, out)
