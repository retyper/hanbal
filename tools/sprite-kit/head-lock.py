# -*- coding: utf-8 -*-
"""걷는 칸의 머리를 한 장으로 묶는다 (11-23 형 「달빛은 걷는 게 이상한데 · 머리가 커졌다 작아졌다 하고 시선도 이상하고」).
그림 도구는 여덟 칸의 얼굴을 칸마다 새로 그린다 → 눈을 떴다 감았다 하고 시선·머리 모양이 칸마다 달라진다.
잘 만든 도트 걷기는 머리가 「같은 화소」이고 몸의 높낮이만큼 오르내릴 뿐이다. → 기준 칸의 머리 상자를 나머지 칸에 옮겨 붙인다.
  머리 자리 맞춤: 가로 = 머리 윗부분 화소의 가운데 · 세로 = 얼굴 살빛(머리 위 46줄 안)의 가운데 (머리카락 끝은 칸마다 흔들려 믿을 수 없다)
  py -3 -I tools/sprite-kit/head-lock.py <이름> <기준 칸: walk-a-3 처럼> <꼬리표 ...>      예) dalbit walk-a-3 walk-a walk-b
  상자: 머리 꼭대기 위 4줄 ~ 턱 아래(얼굴 가운데 + CHIN) · 가로는 얼굴 가운데에서 LEFT/RIGHT
"""
import sys
import numpy as np
from PIL import Image

PXD = 'D:/에셋창고/STD/px'
LEFT, RIGHT, UP, CHIN = 26, 22, 30, 15   # 얼굴 가운데에서 왼쪽·오른쪽·위·아래로 (게임 화소)


def anchor(im):
    a = np.asarray(im).astype(np.int16)
    m = a[..., 3] > 0
    ys = np.nonzero(m.any(1))[0]
    top = ys.min()
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    skin = m & (r > 170) & (r - b > 40) & (g > 110)
    band = np.zeros_like(skin)
    band[top:top + 46] = skin[top:top + 46]
    sy, sx = np.nonzero(band)
    return int(round(np.median(sx))), int(round(np.median(sy)))


def lock(name, ref, tags):
    rim = Image.open(f'{PXD}/{name}-{ref}.png').convert('RGBA')
    rx, ry = anchor(rim)
    box = (rx - LEFT, ry - UP, rx + RIGHT, ry + CHIN)
    head = rim.crop(box)
    for tag in tags:
        for i in (1, 2, 3, 4):
            p = f'{PXD}/{name}-{tag}-{i}.png'
            im = Image.open(p).convert('RGBA')
            if f'{tag}-{i}' == ref:
                continue
            x, y = anchor(im)
            a = np.asarray(im).copy()
            x0, y0 = x - LEFT, y - UP
            a[max(0, y0):y0 + head.size[1], max(0, x0):x0 + head.size[0]] = 0     # 그 칸의 머리 상자를 지우고
            out = Image.fromarray(a)
            out.alpha_composite(head, (x0, y0))                                    # 기준 머리를 얹는다
            out.save(p)
            print(f'{tag}-{i}: 머리 자리 ({x},{y}) ← 기준 ({rx},{ry})')


if __name__ == '__main__':
    lock(sys.argv[1], sys.argv[2], sys.argv[3:])
