# -*- coding: utf-8 -*-
"""부분 보정 합치기 — 그림 도구에게 「여기만 고쳐라」고 한 그림에서 **그 부분만** 원본에 얹는다 (11-24).
그림 도구는 부분만 고치라고 해도 나머지 화소를 조금씩 바꾼다(「한 화소도 바꾸지 않는」 조건을 못 지킨다). 새로 그리게 하면 몸이 달라진다
(아룸 걷기: 얼굴을 단순하게 다시 그리게 했더니 가슴 폭 47 → 38px · 다른 사람). → 원본 그대로 넣어 부분만 고치게 하고, 고친 그림에서 그 부분만 가져온다.
  py -3 -I tools/sprite-kit/patch-merge.py face <원본 장면.png> <고친 장면.png> <나갈.png> [칸 배치: 5x2(걷기 여덟 칸 · 왼쪽 줄 견본) | 4x1 …] [only=줄,칸 — 그 칸의 사람만(0부터)]
  face = 사람마다 얼굴 살 덩어리(머리 위 구역의 가장 큰 살빛 덩어리)를 메우고 2px 넓힌 곳 · 가장자리는 부드럽게 · 고친 그림의 밀림(±6px)은 겹쳐서 잰다
"""
import sys
import numpy as np
from PIL import Image
from scipy import ndimage


def merge_face(orig, edit, out, layout='5x2', only=None):
    A, B = Image.open(orig).convert('RGB'), Image.open(edit).convert('RGB')
    if B.size != A.size:   # 그림 도구가 크기를 한두 화소 바꿔 돌려주기도 한다(2122×741 → 2124×742)
        print('고친 그림 크기', B.size, '→ 원본 크기', A.size, '로 맞춤')
        B = B.resize(A.size, Image.LANCZOS)
    a, b = np.asarray(A).astype(np.int16), np.asarray(B).astype(np.int16)
    W, H = A.size
    cols, rows = (int(v) for v in layout.split('x')) if 'x' in layout else (1, 1)
    cw, ch = W / cols, H / rows
    fg = lambda x: ~((x[..., 0] > 200) & (x[..., 1] < 90) & (x[..., 2] > 200))
    ma = fg(a)
    res = a.copy()
    for j in range(rows):
        for k in range(0 if only else (1 if cols > 1 else 0), cols):   # 왼쪽 줄은 견본(only 로 한 칸을 찍으면 그 칸만)
            if only and (j, k) != only:
                continue
            x0, x1, y0, y1 = int(cw * k), int(cw * (k + 1)), int(ch * j), int(ch * (j + 1))
            sa = ma[y0:y1, x0:x1]
            if sa.sum() < 500:
                continue
            reg = a[y0:y1, x0:x1]
            ys = np.nonzero(sa.any(1))[0]
            top = ys.min()
            fh = ys.max() - top + 1
            skin = sa & (reg[..., 0] > 170) & (reg[..., 0] - reg[..., 2] > 45) & (reg[..., 1] > 105)
            band = np.zeros_like(skin)
            band[top + int(fh * .04):top + int(fh * .25)] = skin[top + int(fh * .04):top + int(fh * .25)]
            lab, n = ndimage.label(band)
            if n == 0:
                print(f'줄{j + 1} 칸{k}: 얼굴을 못 찾음')
                continue
            big = 1 + int(np.argmax(ndimage.sum(band, lab, range(1, n + 1))))
            fy, fx = np.nonzero(lab == big)
            cy, cx = int(np.median(fy)), int(np.median(fx))
            win = (slice(max(0, cy - 55), cy + 45), slice(max(0, cx - 50), cx + 50))
            ga, gb = reg[win].sum(2), b[y0:y1, x0:x1].sum(2)
            best = None
            for dy in range(-6, 7):
                for dx in range(-6, 7):
                    w = gb[max(0, win[0].start + dy):win[0].stop + dy, max(0, win[1].start + dx):win[1].stop + dx]
                    if w.shape != ga.shape:
                        continue
                    c = int(np.abs(w - ga).sum())
                    if best is None or c < best[0]:
                        best = (c, dx, dy)
            _, dx, dy = best
            m = ndimage.binary_dilation(ndimage.binary_fill_holes(ndimage.binary_closing(lab == big, iterations=6)), iterations=2)
            soft = ndimage.gaussian_filter(m.astype(np.float32), 1.6)[..., None]
            src = np.roll(np.roll(b[y0:y1, x0:x1], -dy, axis=0), -dx, axis=1)
            res[y0:y1, x0:x1] = (reg * (1 - soft) + src * soft).astype(np.int16)
            print(f'줄{j + 1} 칸{k}: 얼굴 가운데 ({cx},{cy}) · 고친 그림의 밀림 ({dx:+d},{dy:+d}) · 바꾼 넓이 {int(m.sum())}px')
    Image.fromarray(res.clip(0, 255).astype(np.uint8)).save(out)
    print(out, '· 원본과 다른 화소', int((np.abs(res - a).sum(2) > 0).sum()), '/', W * H)


if __name__ == '__main__':
    if sys.argv[1] == 'face':
        only = next((tuple(int(v) for v in a[5:].split(',')) for a in sys.argv[5:] if a.startswith('only=')), None)   # only=줄,칸 (0부터)
        lay = next((a for a in sys.argv[5:] if not a.startswith('only=')), '5x2')
        merge_face(sys.argv[2], sys.argv[3], sys.argv[4], lay, only)


def merge_legs(orig, edit, out, layout='5x2'):
    """다리 살빛 보정 합치기: 사람마다 아래 50% 에서, 원본보다 밝아졌고 고친 그림에서 살빛인 화소만 가져온다(가죽 치마·장화·윤곽은 원본 그대로).
      py -3 -I tools/sprite-kit/patch-merge.py legs <원본.png> <고친.png> <나갈.png> [5x2]"""
    A, B = Image.open(orig).convert('RGB'), Image.open(edit).convert('RGB')
    if B.size != A.size:
        B = B.resize(A.size, Image.LANCZOS)
    a, b = np.asarray(A).astype(np.int16), np.asarray(B).astype(np.int16)
    W, H = A.size
    cols, rows = (int(v) for v in layout.split('x'))
    cw, ch = W / cols, H / rows
    fg = lambda x: ~((x[..., 0] > 200) & (x[..., 1] < 90) & (x[..., 2] > 200))
    lum = lambda x: x[..., 0] * .299 + x[..., 1] * .587 + x[..., 2] * .114
    ma = fg(a)
    res = a.copy()
    for j in range(rows):
        for k in range(1, cols):
            x0, x1, y0, y1 = int(cw * k), int(cw * (k + 1)), int(ch * j), int(ch * (j + 1))
            sa = ma[y0:y1, x0:x1]
            if sa.sum() < 500:
                continue
            ra, rb = a[y0:y1, x0:x1], b[y0:y1, x0:x1]
            ys = np.nonzero(sa.any(1))[0]
            top, bot = ys.min(), ys.max()
            mid = top + int((bot - top) * .50)
            # 다리 구역에서 두 그림의 밀림(±5)
            ga, gb = lum(ra)[mid:bot], lum(rb)
            best = None
            for dy in range(-5, 6):
                for dx in range(-5, 6):
                    w = np.roll(np.roll(gb, -dy, axis=0), -dx, axis=1)[mid:bot]
                    c = float(np.abs(w - ga).sum())
                    if best is None or c < best[0]:
                        best = (c, dx, dy)
            _, dx, dy = best
            src = np.roll(np.roll(rb, -dy, axis=0), -dx, axis=1)
            zone = np.zeros_like(sa)
            zone[mid:bot + 1] = True
            skin_b = (src[..., 0] > 175) & (src[..., 0] - src[..., 2] > 45) & (src[..., 1] > 110)
            m = zone & sa & skin_b & (lum(src) - lum(ra) > 14)
            m = ndimage.binary_opening(m, iterations=1)
            m = ndimage.binary_dilation(m, iterations=1) & sa & zone
            soft = np.minimum(1, ndimage.gaussian_filter(m.astype(np.float32), 1.0) * 1.6)[..., None] * sa[..., None]
            res[y0:y1, x0:x1] = (ra * (1 - soft) + src * soft).astype(np.int16)
            print(f'줄{j + 1} 칸{k}: 밀림 ({dx:+d},{dy:+d}) · 밝힌 살 {int(m.sum())}px')
    Image.fromarray(res.clip(0, 255).astype(np.uint8)).save(out)
    print(out)


if __name__ == '__main__' and sys.argv[1] == 'legs':
    merge_legs(sys.argv[2], sys.argv[3], sys.argv[4], sys.argv[5] if len(sys.argv) > 5 else '5x2')
