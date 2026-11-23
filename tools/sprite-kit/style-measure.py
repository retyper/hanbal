# -*- coding: utf-8 -*-
"""그림 결 재기 (11-23 형 「초기 소서노·감실에서 왜 이렇게 멀어지나 · 싸구려 초딩 만화책 그림체」).
게임 크기(키 137)의 그림에서 「도트 그림 결」을 숫자로 본다. 기준은 승인된 띠(소서노·감실·진하)의 서기 칸.
  윤곽    = 바깥 테두리 화소의 밝기(0~255 · 낮을수록 짙은 윤곽)
  명암    = 안쪽 화소 밝기의 표준편차 (깊은 그늘과 밝은 빛이 함께 있는가)
  질감    = 이웃 화소 사이 밝기 차의 평균 (덩어리 안에 붓결·무늬가 있는가 · 납작한 칠은 낮다)
  어둠    = 밝기 70 아래 화소의 몫 (짙은 그늘)
  채도    = 평균 채도 · 밝은곳채도 = 밝기 140 넘는 화소의 채도 (사탕 같은 쨍한 색을 잡는다)
  납작    = 둘레 3×3 의 밝기 차가 8 아래인 안쪽 화소의 몫 (민무늬 칠 · 만화 셀 칠은 높다)
잰 값(11-23): 승인 띠 여섯 = 윤곽 40~52 · 채도 .39~.52 · 밝은곳채도 .34~.43 · 납작 .00~.01
             입히기 1차 = 윤곽 76~107 · 채도 .60 · 밝은곳 .48 · 납작 .01~.02 / 2차(덜 그리기) = 윤곽 59~66 · 채도 .58~.60 · 밝은곳 .53~.57 · 납작 .06~.07 / 걷기 입힘 = 납작 .18
  py -3 -I tools/sprite-kit/style-measure.py <그림.png> [...]      (자홍 바탕 원본도 되고 투명 PNG 도 된다 · 여럿이 든 그림은 왼쪽부터)
  py -3 -I tools/sprite-kit/style-measure.py ref                    → 기준 띠 셋의 값
"""
import sys
import numpy as np
from PIL import Image
from scipy import ndimage

N = 137
REF = ['public/realm/anim-px/gen-soseono.png', 'public/realm/anim-px/gen-gamsil.png', 'public/realm/anim-px/gen-jinha.png']
# 합격선 (기준 띠 셋을 잰 값의 둘레 · 아래 ref 로 다시 잴 수 있다)
GATE = dict(윤곽=(0, 58), 명암=(40, 70), 질감=(17, 32), 어둠=(.35, .70), 채도=(.36, .54), 밝은곳채도=(.28, .47), 납작=(0, .03))


def figs(path):
    im = Image.open(path)
    if 'anim-px' in path:
        im = im.convert('RGBA'); fw = im.size[0] // 20; c = im.crop((0, 0, fw, im.size[1])); return [c.crop(c.getchannel('A').getbbox())]
    if im.mode == 'RGBA' and np.asarray(im)[..., 3].min() < 10:
        return [im.crop(im.getchannel('A').getbbox())]
    a = np.asarray(im.convert('RGB')).astype(np.int16); k = np.minimum(a[..., 0], a[..., 2]) - a[..., 1]
    al = np.clip((90 - k.astype(np.float32)) * 255 / 50, 0, 255).astype(np.uint8); solid = al > 60
    lab, n = ndimage.label(ndimage.binary_closing(solid, iterations=2)); sizes = ndimage.sum(solid, lab, range(1, n + 1)); out = []
    for i in [j + 1 for j in range(n) if sizes[j] > sizes.max() * .3]:
        ys, xs = np.nonzero(lab == i); y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
        out.append((x0, Image.fromarray(np.dstack([a[y0:y1, x0:x1].astype(np.uint8), np.where(lab[y0:y1, x0:x1] == i, al[y0:y1, x0:x1], 0)]))))
    return [f for _, f in sorted(out, key=lambda t: t[0])]


def measure(im):
    if im.size[1] != N and im.size[1] > N * 1.15: im = im.resize((max(1, round(im.size[0] * N / im.size[1])), N), Image.LANCZOS)
    a = np.asarray(im.convert('RGBA')).astype(np.float32); m = a[..., 3] > 110
    lum = a[..., 0] * .299 + a[..., 1] * .587 + a[..., 2] * .114
    edge = m & ~ndimage.binary_erosion(m); inner = ndimage.binary_erosion(m, iterations=2)
    dx = np.abs(lum[:, 1:] - lum[:, :-1])[inner[:, 1:] & inner[:, :-1]]; dy = np.abs(lum[1:] - lum[:-1])[inner[1:] & inner[:-1]]
    mx, mn = a[..., :3].max(-1), a[..., :3].min(-1); sat = ((mx - mn) / np.maximum(mx, 1))[m]
    rng = ndimage.maximum_filter(lum, 3) - ndimage.minimum_filter(lum, 3); hi = m & (lum > 140)
    extra = dict(밝은곳채도=round(float(((mx - mn) / np.maximum(mx, 1))[hi].mean()) if hi.any() else 0, 2), 납작=round(float((rng[inner] < 8).mean()), 2))
    return dict(**extra, 윤곽=round(float(lum[edge].mean())), 명암=round(float(lum[inner].std()), 1), 질감=round(float(np.concatenate([dx, dy]).mean()), 1),
                어둠=round(float((lum[m] < 70).mean()), 2), 채도=round(float(sat.mean()), 2))


def gate(d):
    return [f"{k} {d[k]} (기준 {v[0]}~{v[1]})" for k, v in GATE.items() if not (v[0] <= d[k] <= v[1])]


if __name__ == '__main__':
    paths = REF if sys.argv[1] == 'ref' else sys.argv[1:]
    for p in paths:
        for i, f in enumerate(figs(p)):
            d = measure(f); bad = gate(d)
            print(f"{p.replace(chr(92), '/').split('/')[-1][:30]:30} {i} {'합격' if not bad else '불합격'}  " + ' '.join(f'{k} {v}' for k, v in d.items()) + ('' if not bad else '  ← ' + ' · '.join(bad)))
