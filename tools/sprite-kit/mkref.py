# 참고 시트 만들기 (11-12 형: 프레임 수·모습 다시 · 우하단은 워터마크용 자홍 네모)
#   mkref2.py act  <key> <원본 4×2 칸 번호 5개(서기,당김,찌름,맞음,누움)> <out>   → 16:9 3×2 · 1~4 칸 사람 왼쪽 · 5 누움 · 6 자홍 네모
#   mkref2.py walk <key> <원본 4×2 칸 번호 8개> <out>                              → 1:1 3×3 · 사람 칸 가운데 왼쪽 · 9 자홍 네모
# 픽셀은 키 뺀 그림에서 이어진 덩어리째(창끝이 옆 칸으로 넘어가도 통째로) · 몸속 구멍은 메움 · 모든 컷 같은 배율 · 바탕은 순수 #00FF00
import sys
import numpy as np
from PIL import Image
from scipy import ndimage
mode, key, picks, out = sys.argv[1], sys.argv[2], [int(x) - 1 for x in sys.argv[3].split(',')], sys.argv[4]
G = 'assets_src/realm/gemini/generals2/'
src = np.array(Image.open(G + f'{key}-{"act" if mode == "act" else "walk"}-key.png').convert('RGBA'))
h, w = src.shape[:2]
cw0, ch0 = w / 4, h / 2
lab, n = ndimage.label(src[..., 3] > 40, structure=np.ones((3, 3)))
own = {}
for i, sl in enumerate(ndimage.find_objects(lab), 1):
    m = lab[sl] == i
    if m.sum() < 80:
        continue
    ys, xs = np.nonzero(m)
    cy, cx = ys.mean() + sl[0].start, xs.mean() + sl[1].start
    own.setdefault(min(3, int(cx // cw0)) + 4 * min(1, int(cy // ch0)), []).append(i)
GREEN = np.array([0, 255, 0, 255], np.uint8)
MAG = np.array([255, 0, 255, 255], np.uint8)
if mode == 'act':
    W, H, cols, rows = 1376, 768, 3, 2
else:
    W, H, cols, rows = 1024, 1024, 3, 3
CW, CH = W / cols, H / rows
sheet = np.zeros((H, W, 4), np.uint8); sheet[:] = GREEN

CLIP = {}  # 원본 칸 번호(0부터) → 지울 곳 (옆 사람과 창이 붙어 한 덩어리가 된 것)
for a_ in sys.argv[5:]:
    c_, x_, y_ = a_.split(':'); CLIP[int(c_) - 1] = (int(x_), int(y_))
def fig(c):
    m = np.isin(lab, own[c])
    if c in CLIP:
        yy, xx = np.mgrid[0:h, 0:w]; m &= ~((xx >= CLIP[c][0]) & (yy >= CLIP[c][1]))
        l2, _ = ndimage.label(m, structure=np.ones((3, 3))); sz = ndimage.sum(m, l2, range(1, l2.max() + 1)); m = l2 == (int(np.argmax(sz)) + 1)
    m = ndimage.binary_fill_holes(m)
    ys, xs = np.nonzero(m)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    rgba = src[y0:y1, x0:x1].copy(); rgba[~m[y0:y1, x0:x1], 3] = 0  # 네모 안의 남(옆 칸 사람) 픽셀은 버림
    hole = m[y0:y1, x0:x1] & (rgba[..., 3] < 255)
    return rgba, hole

figs = [fig(c) for c in picks]
k = (CH * (0.80 if mode == 'act' else 0.82)) / figs[0][0].shape[0]
for j, (rgba, hole) in enumerate(figs):
    im = Image.fromarray(rgba).resize((max(1, round(rgba.shape[1] * k)), max(1, round(rgba.shape[0] * k))), Image.LANCZOS)
    a = np.array(im).astype(float)
    r, c = divmod(j, cols)
    lying = mode == 'act' and j == 4
    if mode == 'act' and not lying:
        ox = c * CW + CW * 0.05                      # 사람은 칸 왼쪽, 오른쪽은 무기 자리
    else:
        ox = c * CW + (CW - a.shape[1]) / 2           # 걷기·누움은 가운데
    ox, oy = int(round(ox)), int(round(r * CH + CH * 0.95 - a.shape[0]))
    assert ox >= c * CW and ox + a.shape[1] <= (c + 1) * CW, f'{j + 1}번 칸 폭 넘침 {a.shape[1]} > {CW}'
    reg = sheet[oy:oy + a.shape[0], ox:ox + a.shape[1]].astype(float)
    al = a[..., 3:4] / 255
    reg[..., :3] = a[..., :3] * al + reg[..., :3] * (1 - al)
    sheet[oy:oy + a.shape[0], ox:ox + a.shape[1]] = reg.astype(np.uint8)
# 우하단 칸 = 자홍 네모 (워터마크 ✦ 가 여기 떨어진다 · 그림은 아무것도 안 그린다)
r, c = rows - 1, cols - 1
pad = 0.06
sheet[int(r * CH + CH * pad):int((r + 1) * CH - CH * pad * 0.5), int(c * CW + CW * pad):int((c + 1) * CW - CW * pad * 0.5)] = MAG
Image.fromarray(sheet[..., :3]).save(out)
print(out, (W, H), '배율', round(k, 3))
