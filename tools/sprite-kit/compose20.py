"""Compose a 20-cell battle strip from a run strip (8 cells) and an action strip (8 cells).
usage: compose20.py run.png act.png out.png [amap=1,2,3,3,4,5,6,8] [act cells=8]
11-12: 3x2 동작 시트(6컷: 준비·당김·찌름·마무리·맞음·누움)면 act cells=6 · amap 기본 1,2,3,3,4,1,5,6
cells: idle 0-3 = act1 x4 · walk 4-11 = run 1..8 · attack 12-17 = act 1,2,3,3,4,5 · hit 18 = act6 · fall 19 = act8
Scales the action strip so act frame 1's height matches the median run-frame height (both standing, feet aligned).
11-12: then scales EVERYTHING down together so the tallest cell (raised weapon, jump) still fits under the top edge with
TOP px to spare — before this, anything taller than the cell lost its head (형: 「독무덤 머리가 잘려 있다」 · 50 of 106 strips).
Feet are put on the bottom line by ink, not by image height."""
import sys
import numpy as np
from PIL import Image

run, act, out = sys.argv[1], sys.argv[2], sys.argv[3]
R = Image.open(run).convert('RGBA')
A = Image.open(act).convert('RGBA')
H = 160
TOP = 3  # px of air above the tallest cell


def cells(im, n=8):
    w = im.width // n
    return [im.crop((i * w, 0, (i + 1) * w, im.height)) for i in range(n)]


def ink(c):
    """(top, bottom) rows of ink, or None"""
    a = np.array(c)[..., 3]
    ys = np.where(a.max(axis=1) > 40)[0]
    return (int(ys.min()), int(ys.max())) if len(ys) else None


def bbox_h(c):
    b = ink(c)
    return (b[1] - b[0] + 1) if b else 0


def scaled(c, k):
    return c if k == 1 else c.resize((max(1, round(c.width * k)), max(1, round(c.height * k))), Image.Resampling.LANCZOS)


NACT = int(sys.argv[5]) if len(sys.argv) > 5 and sys.argv[5] else 8
rc, ac = cells(R), cells(A, NACT)
run_h = float(np.median([bbox_h(c) for c in rc]))
k = run_h / max(1, bbox_h(ac[0]))
ac = [scaled(c, k) for c in ac]
amap = [int(v) - 1 for v in (sys.argv[4] if len(sys.argv) > 4 and sys.argv[4] else ("1,2,3,3,4,1,5,6" if NACT == 6 else "1,2,3,3,4,5,6,8")).split(",")]
order = [ac[amap[0]]] * 4 + rc + [ac[i] for i in amap]
tallest = max(bbox_h(c) for c in order)
fit = min(1.0, (H - TOP) / max(1, tallest))
if fit < 1:
    order = [scaled(c, fit) for c in order]
cw = max(c.width for c in order)
strip = Image.new('RGBA', (cw * 20, H), (0, 0, 0, 0))
for i, c in enumerate(order):
    # feet (bottom ink row) on the bottom line, horizontally centred in the cell
    b = ink(c)
    x = i * cw + (cw - c.width) // 2
    y = (H - 1 - b[1]) if b else (H - c.height)
    strip.alpha_composite(c, (x, max(0, y)), (0, max(0, -y)))
strip.save(out)
print('cell', cw, 'x', H, 'scale act', round(k, 3), 'fit', round(fit, 3), 'tallest', tallest, 'strip', strip.size)
