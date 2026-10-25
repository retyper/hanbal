"""
초록 바탕(#00FF00) 위의 낱개 그림들을 덩어리마다 떼어 낸다 — 격자에 안 맞게 그려 와도 된다
(목책 말뚝 · 형 10-26: "목책될 만한 나무 하나 이미지들을 여러 개 받아서 만들면 어때 argon으로?")

  py -I tools/cut-sprites.py <그림 png> <나갈 폴더> <이름 머리> [가장 작은 덩어리 px]

위에서 아래, 왼쪽에서 오른쪽 차례로 <머리>-01.png … 를 쓴다. 덩어리마다 꼭 맞게 자르고 알파는 초록에서 뽑는다.
"""
import os
import sys
import numpy as np
from PIL import Image
from scipy import ndimage


def main(src: str, out: str, head: str, min_px: int = 1500) -> None:
    a = np.asarray(Image.open(src).convert('RGB')).astype(np.int32)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    gx = g - np.maximum(r, b)
    alpha = np.clip(255 - (gx - 40) * 4, 0, 255).astype(np.uint8)
    spill = np.where(gx > 0, np.minimum(g, np.maximum(r, b) + 10), g)
    rgba = np.dstack([r, spill, b, alpha]).clip(0, 255).astype(np.uint8)
    h, w = alpha.shape
    rgba[int(h * 0.955):, int(w * 0.955):, 3] = 0  # ✦
    solid = rgba[..., 3] > 60
    lab, n = ndimage.label(ndimage.binary_closing(solid, iterations=3))
    boxes = ndimage.find_objects(lab)
    items = []
    for i, sl in enumerate(boxes):
        if sl is None:
            continue
        area = int((lab[sl] == i + 1).sum())
        if area < min_px:
            continue
        items.append((sl[0].start, sl[1].start, sl, i + 1))
    # 줄 → 칸 차례 (위가 먼저 · 줄 높이의 반만큼 차이는 같은 줄)
    items.sort(key=lambda t: (t[0], t[1]))
    rows, cur, top = [], [], None
    for it in items:
        if top is None or it[0] - top < h * 0.08:
            cur.append(it)
            top = it[0] if top is None else top
        else:
            rows.append(cur)
            cur, top = [it], it[0]
    if cur:
        rows.append(cur)
    os.makedirs(out, exist_ok=True)
    k = 0
    for row in rows:
        for _, _, sl, lid in sorted(row, key=lambda t: t[1]):
            k += 1
            piece = rgba[sl].copy()
            piece[..., 3] = np.where(lab[sl] == lid, piece[..., 3], 0)
            Image.fromarray(piece).save(os.path.join(out, f'{head}-{k:02d}.png'))
            print('ok', f'{head}-{k:02d}', piece.shape[1], piece.shape[0])


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2], sys.argv[3], int(sys.argv[4]) if len(sys.argv) > 4 else 1500)
