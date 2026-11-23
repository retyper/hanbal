# -*- coding: utf-8 -*-
"""걷는 여덟 칸의 윗몸을 한자리에 (11-23 · 뿌리 맞춤 다음 걸음).
bake-scene motion8 … scene= 이 발로 뿌리를 맞춘 뒤에도, 그림 도구가 칸마다 윗몸을 조금씩 다른 자리에 그려 머리가 좌우로 흔들린다.
잘 만든 도트 걷기는 윗몸이 한 그림이고 다리만 바뀐다 → 여덟 칸의 머리 가로 자리를 가운데 값에 맞춘다(뿌리는 평균으로 제자리에 남는다).
  py -3 -I tools/sprite-kit/walk-anchor.py <이름>      (그 뒤 head-lock.py)
"""
import sys
import numpy as np
from PIL import Image

PXD = 'D:/에셋창고/STD/px'


def head_x(im):
    a = np.asarray(im)[..., 3] > 0
    ys = np.nonzero(a.any(1))[0]
    return float(np.nonzero(a[ys.min() + 12:ys.min() + 42])[1].mean())


def main(name):
    paths = [f'{PXD}/{name}-walk-{t}-{i}.png' for t in 'ab' for i in (1, 2, 3, 4)]
    ims = [Image.open(p).convert('RGBA') for p in paths]
    hx = [head_x(i) for i in ims]
    tgt = float(np.median(hx))
    for p, im, v in zip(paths, ims, hx):
        d = int(round(tgt - v))
        o = Image.new('RGBA', im.size, (0, 0, 0, 0))
        o.alpha_composite(im.crop((max(0, -d), 0, im.size[0] - max(0, d), im.size[1])), (max(0, d), 0))
        o.save(p)
    print(name, '머리 가로 자리', [round(v, 1) for v in hx], '→', round(tgt, 1), '· 흔들림', round(max(hx) - min(hx), 1))


if __name__ == '__main__':
    main(sys.argv[1])
