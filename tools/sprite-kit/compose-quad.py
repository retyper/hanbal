# -*- coding: utf-8 -*-
"""compose-quad.py <key> [out.png] — 2×2 다섯 장(<key>-q1..q5-key.png · 한 장 3컷 + 4번 자홍 칸)을 장수 띠 20칸으로 (11-12 형: 「한 번에 프레임 수를 줄여야」)

  q1 걷기 1 2 3   q2 걷기 4 5 6   q3 걷기 7 8 · 서기   q4 준비 · 당김 · 찌름   q5 맞음 · 누움 · 숨 들이쉰 서기
  띠 20칸: 서기 0~3 = 서기·들숨·서기·들숨(숨쉬기) · 걷기 4~11 = 1..8 · 공격 12~17 = 준비·당김·찌름·찌름·찌름·준비 · 맞음 18 · 쓰러짐 19

장마다 따로 그려 크기가 조금씩 다르다 → 장마다 기준 컷(걷기 장은 걷기 키 가운데값 · q3 서기 · q4 준비 · q5 들숨)의 키를
걷기 키 가운데값에 맞춰 배율을 정한다. 그다음 20칸 전체를 한 배율로 줄여 제일 큰 컷도 위 3px 안에 들게 하고, 발(잉크 맨 아래)을 바닥에,
가로는 몸통(잉크 무게중심)을 칸 가운데에 둔다(창끝 같은 가는 것은 무게가 거의 없다).
키 뺀 그림은 G/<key>-qN-key.png (clean.py 로 만든다). 끝값 1 = 빈 칸."""
import os
import sys
import numpy as np
from PIL import Image
from scipy import ndimage

key = sys.argv[1]
out = sys.argv[2] if len(sys.argv) > 2 else f'public/realm/anim2/gen-{key}.png'
G = 'assets_src/realm/gemini/generals2/'
H = 160
TOP = 3


R4 = os.environ.get('LAYOUT') == 'r'  # 11-12 네 칸 판: r1 걷기 1~4 · r2 걷기 5~8 · r3 준비·당김·찌름·맞음 · r4 누움·서기·들숨·찌른 뒤


def cells(n):
    a = np.array(Image.open(G + f'{key}-{"r" if R4 else "q"}{n}-key.png').convert('RGBA'))
    h, w = a.shape[:2]
    res = []
    for j in range(4 if R4 else 3):
        r, c = divmod(j, 2)
        y0, y1, x0, x1 = round(r * h / 2), round((r + 1) * h / 2), round(c * w / 2), round((c + 1) * w / 2)
        sub = a[y0:y1, x0:x1].copy()
        m0 = sub[..., 3] > 40
        # 칸 나눔선(제미나이가 「no grid lines」를 어기고 그은 것 · 11-12 아령)을 걷는다 — 칸 폭·높이의 85% 넘게 이어진 줄·열
        sub[m0.mean(axis=1) > 0.85, :, 3] = 0
        sub[:, m0.mean(axis=0) > 0.85, 3] = 0
        e = max(2, round(min(sub.shape[:2]) * 0.006))  # 칸 가장자리 몇 px 도 (선이 칸 끝에 걸쳐 반쯤 잘린 것)
        for edge in (sub[:e], sub[-e:], sub[:, :e], sub[:, -e:]):
            edge[..., 3] = 0
        m = sub[..., 3] > 40
        lab, k = ndimage.label(m, structure=np.ones((3, 3)))
        if k == 0:
            sys.exit(f'q{n} {j + 1}번 칸이 비었다')
        sizes = ndimage.sum(m, lab, range(1, k + 1))
        big = int(np.argmax(sizes)) + 1
        keep = np.zeros_like(m)
        bs = ndimage.find_objects(lab)[big - 1]
        for i in range(1, k + 1):  # 몸에서 멀지 않은 조각(창·머리카락 끝)은 남기고 먼 티끌은 버린다
            sl = ndimage.find_objects(lab)[i - 1]
            gap = max(bs[1].start - sl[1].stop, sl[1].start - bs[1].stop, bs[0].start - sl[0].stop, sl[0].start - bs[0].stop, 0)
            if i == big or (sizes[i - 1] > sizes[big - 1] * 0.002 and gap < max(h, w) * 0.03):
                keep |= lab == i
        sub[~keep, 3] = 0
        ys, xs = np.nonzero(keep)
        res.append(Image.fromarray(sub[ys.min():ys.max() + 1, xs.min():xs.max() + 1]))
    return res


def ink_h(im):
    a = np.array(im)[..., 3] > 40
    ys = np.nonzero(a.any(axis=1))[0]
    return ys.max() - ys.min() + 1


q = {n: cells(n) for n in range(1, 5 if R4 else 6) if not (R4 and n == 2 and not os.path.exists(G + f'{key}-r2.png'))}
if R4 and 2 not in q:
    q[2] = q[1]  # 걷기 둘째 장 없이 (11-12)
walk = q[1] + q[2] if R4 else q[1] + q[2] + q[3][:2]
wh = float(np.median([ink_h(c) for c in walk]))
# 장마다 배율: 걷기 장은 그 장 걷기 키의 가운데값, 나머지는 선 컷
ref = {1: np.median([ink_h(c) for c in q[1]]), 2: np.median([ink_h(c) for c in q[2]]), 3: ink_h(q[3][0]), 4: ink_h(q[4][1])} if R4 else {1: np.median([ink_h(c) for c in q[1]]), 2: np.median([ink_h(c) for c in q[2]]), 3: ink_h(q[3][2]), 4: ink_h(q[4][0]), 5: ink_h(q[5][2])}
sc = {n: wh / ref[n] for n in q}
S = lambda n, j: (q[n][j], sc[n])
# 자리 바꾸기: MAP="STAND=3:3,READY=5:3,..." (장:칸 · 칸은 1부터) — 제미나이가 칸 자세를 안 따른 장을 살릴 때
roles = {'STAND': (4, 2), 'INHALE': (4, 3), 'READY': (3, 1), 'WIND': (3, 2), 'THRUST': (3, 3), 'HIT': (3, 4), 'DOWN': (4, 1), 'FOLLOW': (4, 4)} if R4 else {'STAND': (3, 3), 'INHALE': (5, 3), 'READY': (4, 1), 'WIND': (4, 2), 'THRUST': (4, 3), 'HIT': (5, 1), 'DOWN': (5, 2), 'FOLLOW': (4, 3)}
for kv in (os.environ.get('MAP') or '').split(','):
    if '=' in kv:
        r_, v_ = kv.split('='); a_, b_ = v_.split(':'); roles[r_] = (int(a_), int(b_))
STAND, INHALE, READY, WIND, THRUST, HIT, DOWN, FOLLOW = (S(roles[r][0], roles[r][1] - 1) for r in ('STAND', 'INHALE', 'READY', 'WIND', 'THRUST', 'HIT', 'DOWN', 'FOLLOW'))
W = [S(1, j) for j in range(4)] + [S(2, j) for j in range(4)] if R4 else [S(1, 0), S(1, 1), S(1, 2), S(2, 0), S(2, 1), S(2, 2), S(3, 0), S(3, 1)]
if os.environ.get('WALK') == 'auto':
    # 11-12 소서노: 같은 대화라 걷기 자세가 「벌림」·「모음」 둘로 굳었다 → 발 벌림(아래 12% 잉크 폭/키)으로 줄 세워 한 걸음처럼:
    #   가장 벌린 둘 = 1·5 (닿음) · 가장 모은 둘 = 3·7 (지나감) · 나머지 넷 = 2·4·6·8
    def spread(im):
        a = np.array(im)[..., 3] > 40
        ys = np.nonzero(a.any(axis=1))[0]; h_ = ys.max() - ys.min() + 1
        low = a[ys.max() - int(h_ * 0.12):ys.max() + 1]
        xs = np.nonzero(low.any(axis=0))[0]
        return (xs.max() - xs.min() + 1) / h_
    sp = sorted(W, key=lambda t: spread(t[0]))
    narrow, mid, wide = sp[:2], sp[2:6], sp[6:]
    W = [wide[1], mid[2], narrow[0], mid[0], wide[0], mid[3], narrow[1], mid[1]]
    print('걷기 벌림', [round(spread(t[0]), 2) for t in W])
order = [STAND, INHALE, STAND, INHALE] + W + [READY, WIND, THRUST, THRUST, FOLLOW, READY, HIT, DOWN]
order = [im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS) for im, k in order]
fit = min(1.0, (H - TOP) / max(ink_h(c) for c in order))
order = [c.resize((max(1, round(c.width * fit)), max(1, round(c.height * fit))), Image.LANCZOS) for c in order]


def cx(im):
    a = np.array(im)[..., 3].astype(float)
    return (a.sum(axis=0) * np.arange(a.shape[1])).sum() / max(1, a.sum())


half = max(max(cx(c), c.width - cx(c)) for c in order)
CW = int(np.ceil(half * 2)) + 4
strip = Image.new('RGBA', (CW * 20, H), (0, 0, 0, 0))
for i, c in enumerate(order):
    a = np.array(c)[..., 3] > 40
    bottom = np.nonzero(a.any(axis=1))[0].max()
    strip.alpha_composite(c, (int(round(i * CW + CW / 2 - cx(c))), H - 1 - bottom))
strip.save(out)
print(out, '칸', CW, 'x', H, '· 장 배율', {n: round(v, 3) for n, v in sc.items()}, '· 전체', round(fit, 3), '· 걷기 키', round(wh))
