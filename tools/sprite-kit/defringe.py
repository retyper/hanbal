# -*- coding: utf-8 -*-
"""띠의 자홍 테두리 걷기 — bake-scene.py game() 의 defringe 와 같은 셈(고치면 둘 다). 이미 구워 넣은 띠를 다시 굽지 않고 고칠 때.
  py -3 -I tools/sprite-kit/defringe.py <띠.png> [띠.png …]     (제자리에 덮어쓴다 · 바뀐 화소 수를 알린다)
"""
import sys
import numpy as np
from PIL import Image
from scipy import ndimage


def defringe(rgb, alpha):
    c = rgb.astype(np.int16)
    edge = alpha & ~ndimage.binary_erosion(alpha, iterations=1)
    tint = edge & (c[..., 0] > c[..., 1] + 18) & (c[..., 2] > c[..., 1] + 14) & (c[..., 2] > c[..., 0] * .55)
    # 안쪽의 작은 자홍 점(몸과 물건 사이 좁은 틈으로 바탕이 비친 것 — 아룸 턱과 메 자루 사이 · 11-24): 짙은 자홍이 6화소 이하로 뭉친 것만(보랏빛 옷은 넓어서 안 걸린다)
    strong = alpha & (c[..., 0] > c[..., 1] + 40) & (c[..., 2] > c[..., 1] + 40) & (c[..., 2] > c[..., 0] * .6)
    lab, n = ndimage.label(strong)
    if n:
        size = ndimage.sum(strong, lab, range(1, n + 1))
        tint = tint | np.isin(lab, [i + 1 for i, v in enumerate(size) if v <= 6])
    good = alpha & ~tint
    if not tint.any() or not good.any():
        return rgb, 0
    idx = ndimage.distance_transform_edt(~good, return_distances=False, return_indices=True)
    out = rgb.copy()
    out[tint] = rgb[idx[0][tint], idx[1][tint]]
    return out, int(tint.sum())


if __name__ == '__main__':
    for p in sys.argv[1:]:
        a = np.asarray(Image.open(p).convert('RGBA')).copy()
        rgb, n = defringe(a[..., :3], a[..., 3] > 40)
        a[..., :3] = rgb
        Image.fromarray(a).save(p)
        print(p, '걷은 화소', n)
