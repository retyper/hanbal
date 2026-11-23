"""구미호·무녀 동작 칸 굽기 (Codex 86-B·87-A · 형 11-23 「기울임 말고 프레임으로」).
크로마(초록 #00FF00 또는 자홍 #FF00FF) 바탕 가로 줄 그림 → 바탕 빼기·번짐 걷기 → **덩어리 단위로** 칸을 떼어(고정 칸 폭으로 자르면 치맛자락이 잘린다) →
모든 칸을 같은 크기 판에 발(맨 아래 줄 가운데)을 맞춰 가로 띠로 · 칸마다 발 x·y 를 json 에.
  py -3 -I tools/sprite-kit/bake-gm.py <원본.png> <칸 수> <나갈.png> [--scale .5]
"""
import json, sys
import numpy as np
from PIL import Image
from scipy import ndimage

src, n, out = sys.argv[1], int(sys.argv[2]), sys.argv[3]
scale = float(sys.argv[sys.argv.index('--scale') + 1]) if '--scale' in sys.argv else .5
a = np.asarray(Image.open(src).convert('RGB')).astype(np.int16)
r, g, b = a[..., 0], a[..., 1], a[..., 2]
gk = g - np.maximum(r, b); mk = np.minimum(r, b) - g
key = gk if gk.mean() > mk.mean() else mk
alpha = np.clip((90 - key.astype(np.float32)) * 255 / 50, 0, 255).astype(np.uint8)
rgb = a.copy()
if key is gk: rgb[..., 1] = np.where(gk > 0, np.maximum(r, b), g)
else:
    m = np.maximum(g, (r + b) // 2 - 20); rgb[..., 0] = np.where(mk > 0, np.minimum(r, m + 30), r); rgb[..., 2] = np.where(mk > 0, np.minimum(b, m + 30), b)
img = np.dstack([np.clip(rgb, 0, 255).astype(np.uint8), alpha])
solid = alpha > 60
lab, k = ndimage.label(ndimage.binary_dilation(solid, iterations=3))
sizes = ndimage.sum(solid, lab, range(1, k + 1))
big = [i + 1 for i in np.argsort(sizes)[::-1][:n]]
if len(big) < n or sizes[big[-1] - 1] < sizes[big[0] - 1] * .15:
    raise SystemExit(f'덩어리 {k}개 중 {n}칸을 못 뗌 (붙은 칸?) — 다시 그리기')
boxes = []
for i in big:
    ys, xs = np.nonzero(lab == i); boxes.append((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1, i))
boxes.sort()
cells = []
for x0, y0, x1, y1, i in boxes:
    c = img[y0:y1, x0:x1].copy(); c[..., 3] = np.where(lab[y0:y1, x0:x1] == i, c[..., 3], 0)
    ys = np.nonzero((c[..., 3] > 60).sum(1) >= 8)[0]; foot_y = ys.max()
    xs = np.nonzero(c[max(0, foot_y - 12):foot_y + 1, :, 3].max(0) > 60)[0]; foot_x = (xs.min() + xs.max()) / 2
    cells.append((Image.fromarray(c), foot_x, foot_y))
left = max(fx for _, fx, _ in cells); right = max(c.size[0] - fx for c, fx, _ in cells)
up = max(fy for _, _, fy in cells); down = max(c.size[1] - fy for c, _, fy in cells)
W, H = int(left + right) + 4, int(up + down) + 4
strip = Image.new('RGBA', (W * n, H), (0, 0, 0, 0))
for j, (c, fx, fy) in enumerate(cells):
    strip.alpha_composite(c, (int(j * W + left - fx) + 2, int(up - fy) + 2))
strip = strip.resize((max(1, round(strip.size[0] * scale)), max(1, round(H * scale))), Image.LANCZOS)
strip.save(out, optimize=True)
meta = {'frames': n, 'cell': [round(W * scale), round(H * scale)], 'feet': [round((left + 2) * scale), round((up + 2) * scale)]}
json.dump(meta, open(out.rsplit('.', 1)[0] + '.json', 'w'), indent=1); print(out, meta)
