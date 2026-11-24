# -*- coding: utf-8 -*-
"""우물 부품 자르기 (11-25 · pocha-cut.py 와 같은 길). 받은 장면(out-well-parts.png)에서 부품을 코드로 자르고(도식의 자리로 어느 부품인지 안다),
축 자리를 도식 좌표로 적어 둔다 → public/realm/raid/well/<부품>.png (게임 화소의 2배) + well.json.
  py -3 -I tools/sprite-kit/well-cut.py [원본 png] [나갈 폴더]
"""
import importlib.util
import json
import math
import os
import sys
import numpy as np
from PIL import Image
from scipy import ndimage

spec = importlib.util.spec_from_file_location('pocha_cut', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'pocha-cut.py'))
pc = importlib.util.module_from_spec(spec); spec.loader.exec_module(pc)

SRC = sys.argv[1] if len(sys.argv) > 1 else 'D:/에셋창고/STD/out-well-parts.png'
OUT = sys.argv[2] if len(sys.argv) > 2 else 'public/realm/raid/well'
GUIDE_W, Z, HD = 1920, 4, 2
# 도식(well-guide.py)에서의 부품 한가운데 어림(1920 좌표) + 축(같은 좌표)
PARTS = {
    'rimBack': dict(at=(960, 185), pivots=dict(c=(960, 200))),
    'rimFront': dict(at=(960, 490), pivots=dict(c=(960, 420))),
    'waterFull': dict(at=(1600, 190), pivots=dict(c=(1600, 190))),
    'waterDry': dict(at=(1600, 440), pivots=dict(c=(1600, 440))),
    'post': dict(at=(770, 840), pivots=dict(foot=(770, 940))),
    'roof': dict(at=(1020, 840), pivots=dict(base=(1020, 890))),
    'beam': dict(at=(970, 1070), pivots=dict(c=(970, 1070))),
    'pulley': dict(at=(1450, 830), pivots=dict(hub=(1450, 830))),
    'bucket': dict(at=(1720, 810), pivots=dict(hang=(1720, 770))),
}


def defringe(im):
    """가장자리 한 겹의 보랏빛(자홍 번짐)을 갈색으로 — 푸른 몫(B)을 초록 몫(G) 근처로 눌러 짙은 갈색 윤곽이 되게 한다"""
    a = np.asarray(im).astype(np.int16).copy()
    sol = a[..., 3] > 128
    edge = sol & ~ndimage.binary_erosion(sol, iterations=2)
    bad = edge & (a[..., 2] > a[..., 1] + 10) & (a[..., 0] > a[..., 1] + 10)
    a[..., 2] = np.where(bad, np.minimum(a[..., 2], a[..., 1] + 4), a[..., 2])
    return Image.fromarray(a.clip(0, 255).astype(np.uint8))


def cut():
    src = Image.open(SRC)
    s = src.size[0] / GUIDE_W
    rgba = pc.key(src)
    solid = rgba[..., 3] > 60
    lab, n = ndimage.label(ndimage.binary_dilation(solid, iterations=4))
    boxes = []
    for i in range(1, n + 1):
        ys, xs = np.nonzero((lab == i) & solid)
        if len(xs) >= 60:
            boxes.append((i, xs.min(), xs.max() + 1, ys.min(), ys.max() + 1))
    out, meta = {}, {}
    k = HD / (Z * s)
    for name, p in PARTS.items():
        cx, cy = p['at'][0] * s, p['at'][1] * s
        d, i, x0, x1, y0, y1 = min((math.hypot((b[1] + b[2]) / 2 - cx, (b[3] + b[4]) / 2 - cy), *b) for b in boxes)
        c = rgba[y0:y1, x0:x1].copy()
        c[..., 3] = np.where(lab[y0:y1, x0:x1] == i, c[..., 3], 0)
        g = defringe(pc.shrink(Image.fromarray(c), k))
        out[name] = g
        meta[name] = dict(size=list(g.size), miss=round(d / s))
        for pn, (px, py) in p['pivots'].items():
            meta[name][pn] = [float(round((px * s - x0) * k, 1)), float(round((py * s - y0) * k, 1))]
    return out, meta


def main():
    os.makedirs(OUT, exist_ok=True)
    parts, meta = cut()
    for n, im in parts.items():
        im.save(f'{OUT}/{n}.png')
    with open(f'{OUT}/well.json', 'w', encoding='utf-8', newline='\n') as f:
        json.dump(dict(hd=HD, parts=meta), f, ensure_ascii=False, indent=1)
    for n, m in meta.items():
        print(n, m)


if __name__ == '__main__':
    main()
