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
