"""widen-cells.py <in-key.png> <out.png> [cols=4] [rows=2] [factor=1.5]
제미나이 동작 시트에서 찌르는 창·칼끝이 옆 칸으로 넘어간 것을 살린다 (11-10 소서노·알영).
알파가 있는 시트의 이어진 덩어리마다 무게중심이 든 칸을 주인으로 삼아, 칸 폭을 factor 배로 넓힌 새 시트에 옮겨 놓는다.
그다음은 늘 하던 대로 strip-frames.mjs <out.png> 4 2 … (넓어진 칸 안에 창 전체가 들어온다).
그림 오른쪽 끝에서 잘린 것(4·8번 칸 창끝)은 살릴 수 없다 — 그 칸은 이웃 칸으로 바꿔 끼운다."""
import sys
import numpy as np
from PIL import Image
from scipy import ndimage

src, out = sys.argv[1], sys.argv[2]
cols = int(sys.argv[3]) if len(sys.argv) > 3 else 4
rows = int(sys.argv[4]) if len(sys.argv) > 4 else 2
k = float(sys.argv[5]) if len(sys.argv) > 5 else 1.5
im = np.array(Image.open(src).convert('RGBA'))
h, w = im.shape[:2]
cw, ch = w / cols, h / rows
ncw = int(round(cw * k))
pad = (ncw - cw) / 2
lab, n = ndimage.label(im[..., 3] > 40, structure=np.ones((3, 3)))
dst = np.zeros((h, ncw * cols, 4), np.uint8)
moved = 0
for i, sl in enumerate(ndimage.find_objects(lab), 1):
    m = lab[sl] == i
    ys, xs = np.nonzero(m)
    cy, cx = ys.mean() + sl[0].start, xs.mean() + sl[1].start
    c, r = min(cols - 1, int(cx // cw)), min(rows - 1, int(cy // ch))
    if c * cw > sl[1].start or (c + 1) * cw < sl[1].stop:
        moved += 1
    dx = int(round(c * ncw + pad - c * cw))
    y0, y1, x0, x1 = sl[0].start, sl[0].stop, sl[1].start + dx, sl[1].stop + dx
    if x0 < 0 or x1 > dst.shape[1]:
        continue
    reg = dst[y0:y1, x0:x1]
    reg[m] = im[sl][m]
Image.fromarray(dst).save(out)
print('덩어리', n, '· 칸을 넘던 것', moved, '· 칸', round(cw), '->', ncw)
