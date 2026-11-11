"""Compose a 20-cell battle strip from a run strip (8 cells) and an action strip (8 cells).
usage: compose20.py run.png act.png out.png
cells: idle 0-3 = act1 x4 · walk 4-11 = run 1..8 · attack 12-17 = act 1,2,3,3,4,5 · hit 18 = act6 · fall 19 = act8
Scales the action strip so act frame 1's height matches the median run-frame height (both standing, feet aligned)."""
import sys
import numpy as np
from PIL import Image

run, act, out = sys.argv[1], sys.argv[2], sys.argv[3]
R = Image.open(run).convert('RGBA')
A = Image.open(act).convert('RGBA')
H = 160


def cells(im, n=8):
    w = im.width // n
    return [im.crop((i * w, 0, (i + 1) * w, im.height)) for i in range(n)]


def bbox_h(c):
    a = np.array(c)[..., 3]
    ys = np.where(a.max(axis=1) > 40)[0]
    return (ys.max() - ys.min() + 1) if len(ys) else 0


rc, ac = cells(R), cells(A)
run_h = float(np.median([bbox_h(c) for c in rc]))
import os
k = run_h / max(1, bbox_h(ac[0])) * float(os.environ.get('ACT_SHRINK', '1'))  # 활 윗끝이 머리 위로 솟는 띠는 0.92 쯤 (11-11 매눈)
ac = [c.resize((max(1, round(c.width * k)), max(1, round(c.height * k))), Image.Resampling.LANCZOS) for c in ac]
amap = [int(v) - 1 for v in (sys.argv[4] if len(sys.argv) > 4 and sys.argv[4] else "1,2,3,3,4,5,6,8").split(",")]
order = [ac[amap[0]]] * 4 + rc + [ac[i] for i in amap]
cw = max(c.width for c in order)
strip = Image.new('RGBA', (cw * 20, H), (0, 0, 0, 0))
for i, c in enumerate(order):
    # feet on the bottom line, horizontally centred in the cell; crop if taller than the cell
    x = i * cw + (cw - c.width) // 2
    y = H - c.height
    strip.alpha_composite(c, (x, max(0, y)), (0, max(0, -y)))
strip.save(out)
print('cell', cw, 'x', H, 'scale act', round(k, 3), 'strip', strip.size)
