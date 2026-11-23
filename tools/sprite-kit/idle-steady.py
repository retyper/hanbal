"""서기 칸 발 고정 (형 11-23 「idle 이 걷다 마는 것 같고 동작도 이상」 · 검수: 258 띠 중 발이 미끄러지거나 몸이 옆으로 밀리는 것 37).
서기 칸 1·2·3 을 칸 0 의 **발(아래 12%)** 과 가장 잘 겹치게 가로로 민다 — 숨은 윗몸이 쉬고 발은 땅에 붙어 있어야 한다.
다리 모양 자체가 바뀌는 것(두 다리가 서로 바뀜 등)은 못 고친다 → 다시 그린다.
  py -3 -I tools/sprite-kit/idle-steady.py <띠 ...>            → 재기만 (발 흔들림 px 전→후)
  py -3 -I tools/sprite-kit/idle-steady.py --write <띠 ...>    → 고쳐 쓴다 (기본 띠만 · _hd 는 따로)
"""
import os, sys
import numpy as np
from PIL import Image

PX = 'public/realm/anim-px'
FEET, LIM = .12, 8
IDLE = (1, 2, 3)


def a_of(c): return np.asarray(c)[:, :, 3].astype(np.float32) / 255


def feet_mask(a):
    ys = np.nonzero(a.max(1) > .25)[0]
    bot, top = ys.max(), ys.min(); y0 = int(bot - (bot - top) * FEET)
    m = np.zeros_like(a); m[y0:bot + 1] = a[y0:bot + 1]; return m


def best_dx(ref, a):
    r, m = feet_mask(ref), feet_mask(a); best, bd = -1., 0
    for dx in range(-LIM, LIM + 1):
        s = np.roll(m, dx, 1)
        if dx > 0: s[:, :dx] = 0
        elif dx < 0: s[:, dx:] = 0
        sc = float(np.minimum(s, r).sum()) - 1e-3 * abs(dx)
        if sc > best: best, bd = sc, dx
    return bd


def shift(c, dx):
    if dx == 0: return c
    a = np.asarray(c); o = np.zeros_like(a)
    if dx > 0: o[:, dx:] = a[:, :-dx]
    else: o[:, :dx] = a[:, -dx:]
    return Image.fromarray(o)


def feet_x(c):
    m = feet_mask(a_of(c)); xs = np.nonzero(m.max(0) > .25)[0]; return xs.mean() if len(xs) else 0


def run(key, write):
    p = os.path.join(PX, f'gen-{key}.png'); img = Image.open(p).convert('RGBA'); fw = img.size[0] // 20
    cells = [img.crop((i * fw, 0, (i + 1) * fw, img.size[1])) for i in range(4)]
    before = max(feet_x(c) for c in cells[:3]) - min(feet_x(c) for c in cells[:3])
    ref = a_of(cells[0]); fixed = [cells[0]] + [shift(cells[i], best_dx(ref, a_of(cells[i]))) for i in IDLE]
    after = max(feet_x(c) for c in fixed[:3]) - min(feet_x(c) for c in fixed[:3])
    if write and after < before - .5:
        for i in IDLE: img.paste(fixed[i], (i * fw, 0))
        img.save(p, optimize=True)
    print(f'{key}: 발 {before:.1f}→{after:.1f}px' + (' 씀' if write and after < before - .5 else ''))


if __name__ == '__main__':
    args = sys.argv[1:]; w = '--write' in args
    for k in [a for a in args if a != '--write']: run(k, w)
