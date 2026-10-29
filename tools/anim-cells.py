"""
격자 한 장(초록 #00FF00 바탕)에 칸마다 한 동작씩 그려 온 병사 시트를 칸 단위로 떼어 낸다.
제미나이(Argon)가 칸 줄을 검게 그려 넣어 tools/cut-sprites.py 로는 한 덩어리가 될 때 쓴다.
(칸 줄이 없으면 cut-sprites 가 더 낫다 — 칸 경계에 몸이 걸쳐도 안 잘린다.)

  py -I tools/anim-cells.py <시트.png> <나갈 폴더> <이름 머리> <열 수> <행 수> [칸 안쪽 여백 px=10]

<열 수>를 0 으로 주면 칸을 안 쓰고 서로 안 붙은 덩어리를 <행 수>개 만큼 센다(cut-sprites 는 닫기 때문에
가까운 둘을 붙여 버린다 — 줄 사이가 좁은 시트에 쓴다).
칸마다 가장 큰 덩어리만 남기고 <머리>-01.png … 와 <머리>-boxes.json(칸 안 위치)을 쓴다.
칸 가장자리에 닿은 조각은 edge L/R/T/B 로 알린다 — 무기·발이 잘렸을 수 있다.
"""
import os, sys, json
import numpy as np
from PIL import Image
from scipy import ndimage

src, out, head, C, R = sys.argv[1], sys.argv[2], sys.argv[3], int(sys.argv[4]), int(sys.argv[5])
inset = int(sys.argv[6]) if len(sys.argv) > 6 else 10
a = np.asarray(Image.open(src).convert('RGB')).astype(np.int32)
H, W = a.shape[:2]
os.makedirs(out, exist_ok=True)
n = 0
boxes = []


def key(c):
    r, g, b = c[..., 0], c[..., 1], c[..., 2]
    gx = g - np.maximum(r, b)
    alpha = np.clip(255 - (gx - 40) * 4, 0, 255).astype(np.uint8)
    spill = np.where(gx > 0, np.minimum(g, np.maximum(r, b) + 10), g)
    return np.dstack([r, spill, b, alpha]).clip(0, 255).astype(np.uint8)


if C == 0:
    # 칸 없이 덩어리 모드: <열 수>=0, <행 수>=기대하는 조각 수. 붙지 않은 덩어리를 그대로(닫기 없이) 센다.
    rgba = key(a)
    rgba[int(H * 0.93):, int(W * 0.95):, 3] = 0  # 제미나이 별표
    solid = rgba[..., 3] > 60
    lab, k = ndimage.label(solid, structure=np.ones((3, 3)))
    sl = ndimage.find_objects(lab)
    sizes = ndimage.sum(solid, lab, range(1, k + 1))
    big = [i for i in np.argsort(-sizes)[:R]]
    small = [i for i in range(k) if i not in big and sizes[i] > 30]
    # 작은 부스러기(날아가는 화살·끈)는 같은 줄에서 왼쪽에 있는 가장 가까운 큰 덩어리에 붙인다
    # (모두 오른쪽을 보고 쏘므로 날아간 것은 쏜 사람의 오른쪽에 있다). 없으면 그냥 가장 가까운 것.
    owner = {i: i for i in big}

    def gap(i, j):
        cy = (sl[i][0].start + sl[i][0].stop) / 2; cx = (sl[i][1].start + sl[i][1].stop) / 2
        return max(0, sl[j][0].start - cy, cy - sl[j][0].stop) + max(0, sl[j][1].start - cx, cx - sl[j][1].stop)

    for i in small:
        cy = (sl[i][0].start + sl[i][0].stop) / 2
        left = [j for j in big if sl[j][0].start <= cy <= sl[j][0].stop and sl[j][1].start <= sl[i][1].start]
        owner[i] = min(left or big, key=lambda j: gap(i, j))
    items = sorted(big, key=lambda i: (sl[i][0].start + sl[i][0].stop) / 2)
    rows = []
    for i in items:
        c = (sl[i][0].start + sl[i][0].stop) / 2
        if rows and abs(c - rows[-1][0]) < H * 0.12:
            rows[-1][1].append(i)
        else:
            rows.append([c, [i]])
    order = [i for _, row in rows for i in sorted(row, key=lambda i: sl[i][1].start)]
    for i in order:
        parts = [j for j, o in owner.items() if o == i]
        m = np.isin(lab, [j + 1 for j in parts])
        m = ndimage.binary_dilation(m, iterations=2) & (rgba[..., 3] > 0)
        ys, xs = np.nonzero(m)
        img = rgba.copy(); img[..., 3] = np.where(m, img[..., 3], 0)
        crop = img[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
        n += 1
        name = f'{head}-{n:02d}.png'
        Image.fromarray(crop).save(os.path.join(out, name))
        edge = ''.join(s for s, hit in (('L', xs.min() <= 1), ('R', xs.max() >= W - 2), ('T', ys.min() <= 1), ('B', ys.max() >= H - 2)) if hit)
        boxes.append({'file': name, 'x': int(xs.min()), 'y': int(ys.min()), 'w': crop.shape[1], 'h': crop.shape[0]})
        print(f'{name} {crop.shape[1]}x{crop.shape[0]} at {xs.min()},{ys.min()} edge {edge or "-"} parts {len(parts)}')
    json.dump(boxes, open(os.path.join(out, f'{head}-boxes.json'), 'w'))
    sys.exit(0)

for rr in range(R):
    for cc in range(C):
        x0, x1 = W * cc // C + inset, W * (cc + 1) // C - inset
        y0, y1 = H * rr // R + inset, H * (rr + 1) // R - inset
        c = a[y0:y1, x0:x1]
        r, g, b = c[..., 0], c[..., 1], c[..., 2]
        gx = g - np.maximum(r, b)
        alpha = np.clip(255 - (gx - 40) * 4, 0, 255).astype(np.uint8)
        spill = np.where(gx > 0, np.minimum(g, np.maximum(r, b) + 10), g)
        rgba = np.dstack([r, spill, b, alpha]).clip(0, 255).astype(np.uint8)
        h, w = alpha.shape
        if rr == R - 1 and cc == C - 1:
            rgba[int(h * 0.6):, int(w * 0.75):, 3] = 0  # 제미나이 별표
        solid = rgba[..., 3] > 60
        lab, k = ndimage.label(ndimage.binary_dilation(solid, iterations=4))
        if k == 0:
            print(f'cell {rr + 1},{cc + 1} empty - skipped')
            continue
        sizes = ndimage.sum(solid, lab, range(1, k + 1))
        keep = lab == 1 + int(np.argmax(sizes))
        rgba[..., 3] = np.where(keep, rgba[..., 3], 0)
        ys, xs = np.nonzero(rgba[..., 3] > 20)
        edge = ''.join(s for s, hit in (('L', xs.min() <= 1), ('R', xs.max() >= w - 2),
                                         ('T', ys.min() <= 1), ('B', ys.max() >= h - 2)) if hit)
        crop = rgba[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
        n += 1
        name = f'{head}-{n:02d}.png'
        Image.fromarray(crop).save(os.path.join(out, name))
        boxes.append({'file': name, 'x': int(xs.min()), 'y': int(ys.min()), 'w': crop.shape[1], 'h': crop.shape[0]})
        print(f'{name} {crop.shape[1]}x{crop.shape[0]} edge {edge or "-"} drops {k - 1}')
json.dump(boxes, open(os.path.join(out, f'{head}-boxes.json'), 'w'))
