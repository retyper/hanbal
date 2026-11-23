# -*- coding: utf-8 -*-
"""걷는 여덟 칸의 윗몸을 한자리에 (11-23 · 뿌리 맞춤 다음 걸음).
bake-scene motion8 … scene= 이 발로 뿌리를 맞춘 뒤에도, 그림 도구가 칸마다 윗몸을 조금씩 다른 자리에 그려 머리가 좌우로 흔들린다.
잘 만든 도트 걷기는 윗몸이 한 그림이고 다리만 바뀐다 → 여덟 칸의 윗몸(위 4~45%)을 서로 겹쳐 가로 밀림을 재고 가운데 값에 맞춘다(뿌리는 평균으로 제자리에 남는다).
  머리 평균 자리로 맞추던 것을 바꿨다(11-24): 흔들리는 머리카락이 평균을 끌어 anim-check 에서 3px(키의 2.2%)이 남았다.
  py -3 -I tools/sprite-kit/walk-anchor.py <이름>      (그 뒤 head-lock.py)
"""
import sys
import numpy as np
from PIL import Image

PXD = 'D:/에셋창고/STD/px'


def upper(im):
    a = np.asarray(im)[..., 3] > 40
    ys = np.nonzero(a.any(1))[0]
    h = ys.max() - ys.min() + 1
    u = np.zeros_like(a)
    u[ys.min() + int(h * .04):ys.min() + int(h * .45)] = a[ys.min() + int(h * .04):ys.min() + int(h * .45)]
    return u


def reg(a, r, reach=14):
    c = [int((a ^ np.roll(r, dx, axis=1)).sum()) for dx in range(-reach, reach + 1)]
    return int(np.argmin(c)) - reach


def main(name):
    paths = [f'{PXD}/{name}-walk-{t}-{i}.png' for t in 'ab' for i in (1, 2, 3, 4)]
    ims = [Image.open(p).convert('RGBA') for p in paths]
    for _ in range(2):   # 기준 칸을 한 번 바꿔 다시(첫 기준이 튀는 칸일 수 있다)
        ups = [upper(i) for i in ims]
        off = [reg(u, ups[0]) for u in ups]          # 기준 칸에서 각 칸의 윗몸이 얼마나 밀렸나
        mid = int(round(float(np.median(off))))
        out = []
        for im, v in zip(ims, off):
            d = mid - v
            o = Image.new('RGBA', im.size, (0, 0, 0, 0))
            o.alpha_composite(im.crop((max(0, -d), 0, im.size[0] - max(0, d), im.size[1])), (max(0, d), 0))
            out.append(o)
        ims = out
    for p, im in zip(paths, ims):
        im.save(p)
    print(name, '윗몸 가로 밀림', off, '→ 가운데 값', mid, '· 흔들림', max(off) - min(off))


if __name__ == '__main__':
    main(sys.argv[1])
