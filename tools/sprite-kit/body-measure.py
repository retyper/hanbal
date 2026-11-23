# -*- coding: utf-8 -*-
"""기본 몸 재기 (11-23 형 「뼈대를 정하는 일은 매우 중요」) — 눈대중 금지.
자홍(또는 초록) 바탕의 그림에서 사람을 하나씩 떼어, 키를 137 로 맞춘 눈금으로 잰다:
  머리(정수리~목 가장 가는 줄) · 등신 · 어깨 폭 · 가슴통 · 허리 · 골반 · 허벅지(한쪽) · 가랑이 높이
팔은 몸통과 떨어져 있으면 빼고(가운데 덩어리만) 잰다. 대머리 기본 몸이라 머리뼈가 그대로 재진다.
  py -3 -I tools/sprite-kit/body-measure.py <그림.png> [그림 ...]
"""
import sys
import numpy as np
from PIL import Image
from scipy import ndimage


def figures(path):
    a = np.asarray(Image.open(path).convert('RGB')).astype(np.int16); r, g, b = a[..., 0], a[..., 1], a[..., 2]
    mk, gk = np.minimum(r, b) - g, g - np.maximum(r, b); k = mk if mk.mean() > gk.mean() else gk
    solid = k < 60
    lab, n = ndimage.label(ndimage.binary_closing(solid, iterations=2))
    sizes = ndimage.sum(solid, lab, range(1, n + 1)); big = [i + 1 for i in range(n) if sizes[i] > sizes.max() * .3]
    out = []
    for i in big:
        ys, xs = np.nonzero(lab == i); out.append((xs.min(), (lab == i)[ys.min():ys.max() + 1, xs.min():xs.max() + 1]))
    return [m for _, m in sorted(out, key=lambda t: t[0])]


def center_run(row, cx):
    """가운데(cx)를 지나는 이어진 토막의 폭 — 팔이 떨어져 있으면 몸통만"""
    if not row[cx]:
        xs = np.nonzero(row)[0]
        if len(xs) == 0: return 0, cx, cx
        cx = xs[np.abs(xs - cx).argmin()]
    l = cx
    while l > 0 and row[l - 1]: l -= 1
    r = cx
    while r < len(row) - 1 and row[r + 1]: r += 1
    return r - l + 1, l, r


def measure(m):
    H, W = m.shape; s = 137 / H
    wid = m.sum(1)
    # 머리: 위 12~38% 구간에서 전체 폭이 가장 가는 줄 = 목
    lo, hi = int(H * .12), int(H * .38); neck = lo + int(np.argmin(wid[lo:hi]))
    head = neck
    cx = int(np.nonzero(m[int(H * .5)])[0].mean())
    seg = lambda y: center_run(m[y], cx)[0]
    rng = lambda a, b: range(int(H * a), int(H * b))
    shoulder = max(m[y].sum() for y in rng(.27, .36))          # 어깨는 팔 포함 전체 폭
    waist_y = min(rng(.42, .56), key=seg); waist = seg(waist_y)
    chest = max(seg(y) for y in rng(.32, .44))
    hip = max(seg(y) for y in rng(.52, .68))
    # 가랑이: 아래에서 올라가며 가운데 토막이 둘로 갈린 가장 높은 줄
    crotch = None
    for y in range(H - 5, int(H * .45), -1):
        row = m[y]; xs = np.nonzero(row)[0]
        if len(xs) == 0: continue
        runs = np.split(xs, np.nonzero(np.diff(xs) > 2)[0] + 1); legs = [r for r in runs if len(r) > W * .06]
        if len(legs) >= 2: crotch = y
        elif crotch is not None: break
    thigh = 0
    if crotch:
        y = min(H - 1, crotch + int(H * .04)); xs = np.nonzero(m[y])[0]; runs = np.split(xs, np.nonzero(np.diff(xs) > 2)[0] + 1)
        legs = sorted((len(r) for r in runs if len(r) > W * .06), reverse=True)[:2]; thigh = np.mean(legs) if legs else 0
    f = lambda v: round(v * s, 1)
    return dict(등신=round(H / head, 2), 머리=f(head), 어깨=f(shoulder), 가슴통=f(chest), 허리=f(waist), 골반=f(hip), 허벅지=f(thigh), 가랑이=f(crotch or 0))


if __name__ == '__main__' and not (len(sys.argv) > 2 and sys.argv[1] == 'gate'):
    for p in sys.argv[1:]:
        for i, m in enumerate(figures(p)):
            d = measure(m); print(p.split('/')[-1][:28].ljust(28), i, ' '.join(f'{k} {v}' for k, v in d.items()))


# ── 합격선 (11-23 Fable · 승인된 띠의 얼굴을 7배로 재서 정함) ──────────────────────────
# 대머리 기본 몸을 키 137 로 맞춘 값. 머리 = 정수리~목 가장 가는 줄(턱보다 1~2px 아래).
# 근거: 옛 소서노·감실·진하는 머리카락 끝~턱이 35~40 → 머리뼈 31~32 에 머리카락 3~8 을 얹은 꼴. 남자도 머리뼈 절대 크기는 같다(키 142 → 137 눈금 30~31).
SPEC = {
    #            머리(±1.5)  어깨        허리        골반        허벅지
    # 여자는 축 셋(11-23 형 「살해 범은 몸은 평범한데 가슴은 큰 스타일 · 허벅지 너무 큼」): 뼈대(가냘픈·표준·우람한) × 가슴(작은·보통·큰·아주 큰) × 허벅지(보통·튼실한)
    # 가슴 크기는 실루엣 폭으로 재기 어렵다(팔에 가림) → 가슴 표는 눈으로 · 나머지 폭은 그 뼈대의 합격선을 그대로 지켜야 한다
    'f-slender':  dict(머리=32, 어깨=(27, 31), 허리=(12, 15), 골반=(23, 27), 허벅지=(8, 10.5)),
    'f-standard': dict(머리=32, 어깨=(33, 38), 허리=(15, 19), 골반=(29, 34), 허벅지=(10.5, 12.5)),
    'f-sturdy':   dict(머리=32, 어깨=(42, 48), 허리=(20, 25), 골반=(34, 40), 허벅지=(12.5, 15)),
    'f-thick':    dict(머리=32, 어깨=(33, 38), 허리=(15, 19), 골반=(33, 38), 허벅지=(13.5, 16)),   # 표준 뼈대 + 튼실한 허벅지
    'm-lean':     dict(머리=31, 어깨=(34, 39), 허리=(15, 19), 골반=(24, 29), 허벅지=(9, 12)),
    'm-standard': dict(머리=31, 어깨=(42, 48), 허리=(19, 24), 골반=(29, 34), 허벅지=(11, 13.5)),
    'm-muscular': dict(머리=31, 어깨=(50, 57), 허리=(21, 26), 골반=(33, 39), 허벅지=(12.5, 15.5)),
    'm-heavy':    dict(머리=31, 어깨=(50, 58), 허리=(32, 40), 골반=(38, 46), 허벅지=(13.5, 17)),
}
HEAD_TOL = 1.5


def gate(d, kind):
    sp = SPEC[kind]; bad = []
    if abs(d['머리'] - sp['머리']) > HEAD_TOL: bad.append(f"머리 {d['머리']} (기준 {sp['머리']}±{HEAD_TOL} · {'작다' if d['머리'] < sp['머리'] else '크다'} {abs(round((d['머리'] / sp['머리'] - 1) * 100))}%)")
    for k, v in sp.items():
        if k == '머리': continue
        if not (v[0] <= d[k] <= v[1]): bad.append(f"{k} {d[k]} (기준 {v[0]}~{v[1]})")
    return bad


if __name__ == '__main__' and len(sys.argv) > 2 and sys.argv[1] == 'gate':
    # py -3 -I tools/sprite-kit/body-measure.py gate <그림.png> <체형,체형,...>   (그림 속 왼쪽부터)
    kinds = sys.argv[3].split(',')
    for i, (m, kind) in enumerate(zip(figures(sys.argv[2]), kinds)):
        d = measure(m); bad = gate(d, kind)
        print(f"{kind:11} {'합격' if not bad else '불합격'}  등신 {d['등신']} 머리 {d['머리']} 어깨 {d['어깨']} 허리 {d['허리']} 골반 {d['골반']} 허벅지 {d['허벅지']}" + ('' if not bad else '  ← ' + ' · '.join(bad)))
