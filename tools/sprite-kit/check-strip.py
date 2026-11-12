"""check-strip.py <png> [n cells | cols rows] — 넣기 전 검사 (11-12 형: 「머리 잘림·창칼 짧음」).
  띠:   check-strip.py gen-x.png 20          칸마다 잉크가 위 벽(머리)·왼/오 벽(무기)에 닿았는지
  격자: check-strip.py x-act6-key.png 3 2    제미나이 시트(키 뺀 것)의 칸 경계에 잉크가 걸쳤는지 — 걸쳤으면 그 무기 끝은 옆 칸으로 넘어가 못 살린다
0·0 이어야 넣는다. 끝값 1 이면 걸린 칸이 있다."""
import sys
import numpy as np
from PIL import Image

f = sys.argv[1]
im = Image.open(f).convert('RGBA')
a = np.array(im)[..., 3] > 40
args = [int(x) for x in sys.argv[2:]]
if len(args) == 2:
    cols, rows = args
    cw, ch = im.width / cols, im.height / rows
    INSET = 0.01
    top, side = [], []
    for r in range(rows):
        for c in range(cols):
            x0, x1 = round(c * cw + cw * INSET), round((c + 1) * cw - cw * INSET)
            y0, y1 = round(r * ch + ch * INSET), round((r + 1) * ch - ch * INSET)
            cell = a[y0:y1, x0:x1]
            k = r * cols + c + 1
            if cell[0].any(): top.append(k)
            if cell[:, 0].any() or cell[:, -1].any(): side.append(k)
    print(f'{f}: {cols}x{rows} · 위 경계 걸침 {top or 0} · 옆 경계 걸침(무기 잘림) {side or 0}')
else:
    n = args[0] if args else 20
    cw = im.width // n
    top, side = [], []
    for c in range(n):
        cell = a[:, c * cw:(c + 1) * cw]
        if cell[0].any(): top.append(c + 1)
        if cell[:, 0].any() or cell[:, -1].any(): side.append(c + 1)
    print(f'{f}: {n}칸 · 머리 닿음 {top or 0} · 벽 닿음 {side or 0}')
sys.exit(1 if top or side else 0)
